const request = require("supertest");
const { API_URL, waitForApiReady, loginAndGetAuth } = require("./testHelpers");
const PROVIDER_WEBHOOK_SECRET = process.env.PROVIDER_WEBHOOK_SECRET || "dev_provider_webhook_secret";

function uniqueEmail(prefix = "card-guards") {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}@test.com`;
}

function withClient(requestBuilder) {
  const octetA = 10 + Math.floor(Math.random() * 200);
  const octetB = 1 + Math.floor(Math.random() * 250);
  return requestBuilder.set("X-Forwarded-For", `172.16.${octetA}.${octetB}`);
}

async function registerAndAuthenticate(fullName = "Card Guard Tester") {
  const email = uniqueEmail();
  const password = "TestPass123!";

  const registerRes = await withClient(request(API_URL).post("/api/auth/register")).send({
    fullName,
    email,
    password,
  });
  expect(registerRes.status).toBe(201);

  const auth = await loginAndGetAuth(email, password);
  expect(auth.verifyStatus).toBe(200);

  return {
    cookies: auth.cookies,
    csrfToken: auth.csrfToken,
  };
}

async function postCardWebhook(providerRef, status) {
  const res = await withClient(request(API_URL)
    .post("/api/providers/cards/webhook")
    .set("x-provider-signature", PROVIDER_WEBHOOK_SECRET)
    .send({
      provider: "sandbox",
      providerRef,
      status,
    }));

  expect(res.status).toBe(200);
}

describe("Card endpoint transition and guard coverage", () => {
  let authA;
  let authB;

  beforeAll(async () => {
    await waitForApiReady();
    authA = await registerAndAuthenticate("Card Guard Owner");
    authB = await registerAndAuthenticate("Card Guard Intruder");
  });

  test("requires CSRF token for state-changing card actions", async () => {
    const createRes = await withClient(request(API_URL)
      .post("/api/cards/request")
      .set("Cookie", authA.cookies)
      .set("X-CSRF-Token", authA.csrfToken || "")
      .send({ cardType: "debit" }));

    expect(createRes.status).toBe(201);
    await postCardWebhook(createRes.body.card.provider_ref, "succeeded");

    const freezeWithoutCsrf = await withClient(request(API_URL)
      .post(`/api/cards/${createRes.body.card.id}/freeze`)
      .set("Cookie", authA.cookies)
      .send({}));

    expect(freezeWithoutCsrf.status).toBe(403);
  });

  test("prevents one user from changing another user's card", async () => {
    const createRes = await withClient(request(API_URL)
      .post("/api/cards/request")
      .set("Cookie", authA.cookies)
      .set("X-CSRF-Token", authA.csrfToken || "")
      .send({ cardType: "credit" }));

    expect(createRes.status).toBe(201);
    await postCardWebhook(createRes.body.card.provider_ref, "succeeded");

    const freezeAsOtherUser = await withClient(request(API_URL)
      .post(`/api/cards/${createRes.body.card.id}/freeze`)
      .set("Cookie", authB.cookies)
      .set("X-CSRF-Token", authB.csrfToken || "")
      .send({}));

    expect(freezeAsOtherUser.status).toBe(404);
    expect(freezeAsOtherUser.body.error).toMatch(/not found or cannot be frozen/i);
  });

  test("allows freeze only after card becomes active", async () => {
    const createRes = await withClient(request(API_URL)
      .post("/api/cards/request")
      .set("Cookie", authA.cookies)
      .set("X-CSRF-Token", authA.csrfToken || "")
      .send({ cardType: "virtual" }));

    expect(createRes.status).toBe(201);
    await postCardWebhook(createRes.body.card.provider_ref, "pending");

    const freezePending = await withClient(request(API_URL)
      .post(`/api/cards/${createRes.body.card.id}/freeze`)
      .set("Cookie", authA.cookies)
      .set("X-CSRF-Token", authA.csrfToken || "")
      .send({}));

    expect(freezePending.status).toBe(404);

    await postCardWebhook(createRes.body.card.provider_ref, "succeeded");

    const freezeActive = await withClient(request(API_URL)
      .post(`/api/cards/${createRes.body.card.id}/freeze`)
      .set("Cookie", authA.cookies)
      .set("X-CSRF-Token", authA.csrfToken || "")
      .send({}));

    expect(freezeActive.status).toBe(200);
  });
});
