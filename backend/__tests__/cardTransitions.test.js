const request = require("supertest");
const { API_URL, waitForApiReady, loginAndGetAuth } = require("./testHelpers");
const PROVIDER_WEBHOOK_SECRET = process.env.PROVIDER_WEBHOOK_SECRET || "dev_provider_webhook_secret";

function uniqueEmail(prefix = "card-transition") {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}@test.com`;
}

function withClient(requestBuilder) {
  const octetA = 10 + Math.floor(Math.random() * 200);
  const octetB = 1 + Math.floor(Math.random() * 250);
  return requestBuilder.set("X-Forwarded-For", `172.16.${octetA}.${octetB}`);
}

async function registerAndAuthenticate() {
  const email = uniqueEmail();
  const password = "TestPass123!";

  const registerRes = await withClient(request(API_URL).post("/api/auth/register")).send({
    fullName: "Card Transition Tester",
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

describe("Card action state machine", () => {
  let auth;

  beforeAll(async () => {
    await waitForApiReady();
    auth = await registerAndAuthenticate();
  });

  test("should freeze active card and allow unfreeze from frozen state", async () => {
    const createRes = await withClient(request(API_URL)
      .post("/api/cards/request")
      .set("Cookie", auth.cookies)
      .set("X-CSRF-Token", auth.csrfToken || "")
      .send({ cardType: "debit" }));

    expect(createRes.status).toBe(201);
    await postCardWebhook(createRes.body.card.provider_ref, "succeeded");

    const freezeRes = await withClient(request(API_URL)
      .post(`/api/cards/${createRes.body.card.id}/freeze`)
      .set("Cookie", auth.cookies)
      .set("X-CSRF-Token", auth.csrfToken || "")
      .send({}));

    expect(freezeRes.status).toBe(200);

    const unfreezeRes = await withClient(request(API_URL)
      .post(`/api/cards/${createRes.body.card.id}/unfreeze`)
      .set("Cookie", auth.cookies)
      .set("X-CSRF-Token", auth.csrfToken || "")
      .send({}));

    expect(unfreezeRes.status).toBe(200);

  });

  test("should reject freezing a lost card", async () => {
    const createRes = await withClient(request(API_URL)
      .post("/api/cards/request")
      .set("Cookie", auth.cookies)
      .set("X-CSRF-Token", auth.csrfToken || "")
      .send({ cardType: "credit" }));

    expect(createRes.status).toBe(201);
    await postCardWebhook(createRes.body.card.provider_ref, "succeeded");

    const reportLostRes = await withClient(request(API_URL)
      .post(`/api/cards/${createRes.body.card.id}/report-lost`)
      .set("Cookie", auth.cookies)
      .set("X-CSRF-Token", auth.csrfToken || "")
      .send({}));

    expect(reportLostRes.status).toBe(200);

    const freezeRes = await withClient(request(API_URL)
      .post(`/api/cards/${createRes.body.card.id}/freeze`)
      .set("Cookie", auth.cookies)
      .set("X-CSRF-Token", auth.csrfToken || "")
      .send({}));

    expect(freezeRes.status).toBe(404);
  });

  test("should prevent retry for lost cards", async () => {
    const createRes = await withClient(request(API_URL)
      .post("/api/cards/request")
      .set("Cookie", auth.cookies)
      .set("X-CSRF-Token", auth.csrfToken || "")
      .send({ cardType: "debit" }));

    expect(createRes.status).toBe(201);
    await postCardWebhook(createRes.body.card.provider_ref, "failed");

    const reportLostRes = await withClient(request(API_URL)
      .post(`/api/cards/${createRes.body.card.id}/report-lost`)
      .set("Cookie", auth.cookies)
      .set("X-CSRF-Token", auth.csrfToken || "")
      .send({}));

    expect(reportLostRes.status).toBe(200);

    const retryRes = await withClient(request(API_URL)
      .post(`/api/cards/${createRes.body.card.id}/retry`)
      .set("Cookie", auth.cookies)
      .set("X-CSRF-Token", auth.csrfToken || "")
      .send({}));

    expect(retryRes.status).toBe(400);
    expect(retryRes.body.error).toMatch(/lost cards cannot be retried/i);
  });
});
