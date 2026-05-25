const request = require("supertest");
const { API_URL, waitForApiReady, loginAndGetAuth } = require("./testHelpers");
const PROVIDER_WEBHOOK_SECRET = process.env.PROVIDER_WEBHOOK_SECRET || "dev_provider_webhook_secret";

function uniqueEmail(prefix = "provider-lifecycle") {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}@test.com`;
}

async function registerAndAuthenticate() {
  const email = uniqueEmail();
  const password = "TestPass123!";

  const registerRes = await request(API_URL).post("/api/auth/register").send({
    fullName: "Provider Lifecycle Tester",
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

async function postPaymentWebhook(providerRef, status) {
  const res = await request(API_URL)
    .post("/api/providers/payments/webhook")
    .set("x-provider-signature", PROVIDER_WEBHOOK_SECRET)
    .send({
      provider: "sandbox",
      providerRef,
      status,
    });

  expect(res.status).toBe(200);
}

async function postCardWebhook(providerRef, status) {
  const res = await request(API_URL)
    .post("/api/providers/cards/webhook")
    .set("x-provider-signature", PROVIDER_WEBHOOK_SECRET)
    .send({
      provider: "sandbox",
      providerRef,
      status,
    });

  expect(res.status).toBe(200);
}

describe("Provider lifecycle retry and sync", () => {
  let auth;

  beforeAll(async () => {
    await waitForApiReady();
    auth = await registerAndAuthenticate();
  });

  test.skip("should retry a failed payment and issue a new provider reference", async () => {
    const scheduleAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

    const createRes = await request(API_URL)
      .post("/api/payments/scheduled")
      .set("Cookie", auth.cookies)
      .set("X-CSRF-Token", auth.csrfToken || "")
      .send({
        payeeName: "Retry Payment Merchant",
        reference: "PAY-RETRY",
        amount: 180,
        scheduleAt,
      });

    expect(createRes.status).toBe(201);
    const createdPayment = createRes.body.payment;
    expect(createdPayment.provider_ref).toBeTruthy();

    await postPaymentWebhook(createdPayment.provider_ref, "failed");

    const retryRes = await request(API_URL)
      .post(`/api/payments/${createdPayment.id}/retry`)
      .set("Cookie", auth.cookies)
      .set("X-CSRF-Token", auth.csrfToken || "")
      .send({});

    expect(retryRes.status).toBe(200);
    expect(retryRes.body.payment.provider_ref).toBeTruthy();
    expect(retryRes.body.payment.provider_ref).not.toBe(createdPayment.provider_ref);
    expect(["pending", "failed", "succeeded"]).toContain(String(retryRes.body.payment.provider_status || "").toLowerCase());
  });

  test("should retry a failed card request and issue a new provider reference", async () => {
    const createRes = await request(API_URL)
      .post("/api/cards/request")
      .set("Cookie", auth.cookies)
      .set("X-CSRF-Token", auth.csrfToken || "")
      .send({ cardType: "debit" });

    expect(createRes.status).toBe(201);
    const createdCard = createRes.body.card;
    expect(createdCard.provider_ref).toBeTruthy();

    await postCardWebhook(createdCard.provider_ref, "failed");

    const retryRes = await request(API_URL)
      .post(`/api/cards/${createdCard.id}/retry`)
      .set("Cookie", auth.cookies)
      .set("X-CSRF-Token", auth.csrfToken || "")
      .send({});

    expect(retryRes.status).toBe(200);
    expect(retryRes.body.card.provider_ref).toBeTruthy();
    expect(retryRes.body.card.provider_ref).not.toBe(createdCard.provider_ref);
    expect(["pending", "failed", "succeeded"]).toContain(String(retryRes.body.card.provider_status || "").toLowerCase());
  });

  test.skip("should sync pending payment provider items for the current user", async () => {
    const scheduleAt = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();

    const createRes = await request(API_URL)
      .post("/api/payments/scheduled")
      .set("Cookie", auth.cookies)
      .set("X-CSRF-Token", auth.csrfToken || "")
      .send({
        payeeName: "Sync Payment Merchant",
        reference: "PAY-SYNC",
        amount: 210,
        scheduleAt,
      });

    expect(createRes.status).toBe(201);
    const createdPayment = createRes.body.payment;

    await postPaymentWebhook(createdPayment.provider_ref, "pending");

    const syncRes = await request(API_URL)
      .post("/api/providers/payments/sync")
      .set("Cookie", auth.cookies)
      .set("X-CSRF-Token", auth.csrfToken || "")
      .send({});

    expect(syncRes.status).toBe(200);
    expect(syncRes.body.summary).toBeDefined();
    expect(Number(syncRes.body.summary.updatedCount || 0)).toBeGreaterThan(0);
  });

  test("should sync pending card provider items for the current user", async () => {
    const createRes = await request(API_URL)
      .post("/api/cards/request")
      .set("Cookie", auth.cookies)
      .set("X-CSRF-Token", auth.csrfToken || "")
      .send({ cardType: "credit" });

    expect(createRes.status).toBe(201);
    const createdCard = createRes.body.card;

    await postCardWebhook(createdCard.provider_ref, "pending");

    const syncRes = await request(API_URL)
      .post("/api/providers/cards/sync")
      .set("Cookie", auth.cookies)
      .set("X-CSRF-Token", auth.csrfToken || "")
      .send({});

    expect(syncRes.status).toBe(200);
    expect(syncRes.body.summary).toBeDefined();
    expect(Number(syncRes.body.summary.updatedCount || 0)).toBeGreaterThan(0);
  });
});
