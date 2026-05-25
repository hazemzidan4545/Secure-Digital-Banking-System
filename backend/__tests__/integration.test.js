const request = require("supertest");
const { API_URL, waitForApiReady, loginAndGetAuth } = require("./testHelpers");

async function createTestUser(email = `test-${Date.now()}@test.com`, password = "TestPass123!") {
  const res = await request(API_URL).post("/api/auth/register").send({
    fullName: "Integration Test User",
    email,
    password,
  });
  expect(res.status).toBe(201);
  return { email, password };
}

describe("SECURE BANKING API - INTEGRATION", () => {
  beforeAll(async () => {
    await waitForApiReady();
  });

  test("non-admin cannot access admin audit logs", async () => {
    const email = `it-rbac-${Date.now()}@test.com`;
    const password = "TestPass123!";
    await createTestUser(email, password);

    const auth = await loginAndGetAuth(email, password);
    expect(auth.verifyStatus).toBe(200);

    const res = await request(API_URL)
      .get("/api/admin/audit-logs")
      .set("Cookie", auth.cookies);

    expect(res.status).toBe(403);
  });

  test("admin can access audit logs", async () => {
    const admin = await loginAndGetAuth("admin@aegisbank.local", "AdminPass123!");
    expect(admin.verifyStatus).toBe(200);

    const res = await request(API_URL)
      .get("/api/admin/audit-logs")
      .set("Cookie", admin.cookies);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.logs)).toBe(true);
  });

  test("MFA login yields working authenticated session", async () => {
    const email = `it-mfa-${Date.now()}@test.com`;
    const password = "TestPass123!";
    await createTestUser(email, password);

    const auth = await loginAndGetAuth(email, password);
    expect(auth.verifyStatus).toBe(200);

    const profile = await request(API_URL)
      .get("/api/accounts/me")
      .set("Cookie", auth.cookies);

    expect(profile.status).toBe(200);
    expect(profile.body.account || profile.body.accounts).toBeDefined();
  });

  test("CSRF blocks state-changing request without token", async () => {
    const email = `it-csrf-${Date.now()}@test.com`;
    const password = "TestPass123!";
    await createTestUser(email, password);

    const auth = await loginAndGetAuth(email, password);
    expect(auth.verifyStatus).toBe(200);

    const res = await request(API_URL)
      .post("/api/transfers")
      .set("Cookie", auth.cookies)
      .send({ toAccountNumber: "9999999999", amount: 100 });

    expect(res.status).toBe(403);
  });

  test("health endpoint is public", async () => {
    const res = await request(API_URL).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });
});
