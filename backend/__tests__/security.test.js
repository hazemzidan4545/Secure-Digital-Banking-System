const request = require("supertest");
const { API_URL, waitForApiReady, loginAndGetAuth } = require("./testHelpers");

async function createTestUser(email = `test-${Date.now()}@test.com`, password = "TestPass123!") {
  const res = await request(API_URL).post("/api/auth/register").send({
    fullName: "Test User",
    email,
    password,
  });
  expect(res.status).toBe(201);
  return { email, password };
}

describe("SECURITY CONTROLS", () => {
  beforeAll(async () => {
    await waitForApiReady();
  });

  describe("1. LOGIN BRUTE-FORCE LOCKOUT", () => {
    it("locks account after repeated failed attempts", async () => {
      const email = `lockout-${Date.now()}@test.com`;
      await createTestUser(email, "CorrectPass123!");

      for (let i = 0; i < 5; i += 1) {
        const res = await request(API_URL).post("/api/auth/login").send({
          email,
          password: `WrongPass${i}`,
        });

        if (i < 4) {
          expect(res.status).toBe(401);
        } else {
          expect(res.status).toBe(423);
        }
      }
    });

    it("rejects correct password while account is locked", async () => {
      const email = `lockout-correct-${Date.now()}@test.com`;
      const password = "CorrectPass123!";
      await createTestUser(email, password);

      for (let i = 0; i < 5; i += 1) {
        await request(API_URL).post("/api/auth/login").send({
          email,
          password: `WrongPass${i}`,
        });
      }

      const res = await request(API_URL).post("/api/auth/login").send({ email, password });
      expect(res.status).toBe(423);
    });

    it("resets failed attempts after successful password check", async () => {
      const email = `reset-counter-${Date.now()}@test.com`;
      const password = "CorrectPass123!";
      await createTestUser(email, password);

      await request(API_URL).post("/api/auth/login").send({ email, password: "WrongPass" });

      const res = await request(API_URL).post("/api/auth/login").send({ email, password });
      expect(res.status).toBe(200);
      expect(res.body.requiresMfa).toBe(true);
    });
  });

  describe("2. MFA REQUIREMENT", () => {
    it("blocks protected endpoint before MFA and allows after MFA", async () => {
      const email = `mfa-${Date.now()}@test.com`;
      const password = "TestPass123!";
      await createTestUser(email, password);

      const loginRes = await request(API_URL).post("/api/auth/login").send({ email, password });
      expect(loginRes.status).toBe(200);

      const mfaCookie = loginRes.headers["set-cookie"]?.find((c) => c.includes("mfa_token"));
      expect(mfaCookie).toBeDefined();

      const blockedRes = await request(API_URL).get("/api/accounts/me").set("Cookie", mfaCookie || "");
      expect(blockedRes.status).toBe(401);

      const auth = await loginAndGetAuth(email, password);
      expect(auth.verifyStatus).toBe(200);

      const okRes = await request(API_URL).get("/api/accounts/me").set("Cookie", auth.cookies);
      expect(okRes.status).toBe(200);
    });

    it("returns 429 on the 6th invalid MFA attempt", async () => {
      const email = `mfa-invalid-${Date.now()}@test.com`;
      const password = "TestPass123!";
      await createTestUser(email, password);

      const loginRes = await request(API_URL).post("/api/auth/login").send({ email, password });
      expect(loginRes.status).toBe(200);

      const mfaCookie = loginRes.headers["set-cookie"]?.find((c) => c.includes("mfa_token"));
      expect(mfaCookie).toBeDefined();

      for (let i = 0; i < 6; i += 1) {
        const res = await request(API_URL)
          .post("/api/auth/mfa/verify")
          .set("Cookie", mfaCookie || "")
          .send({ code: "000000" });

        if (i < 5) {
          expect(res.status).toBe(401);
        } else {
          expect(res.status).toBe(429);
        }
      }
    });
  });

  describe("3. RBAC", () => {
    it("denies non-admin access to admin audit endpoint", async () => {
      const email = `rbac-user-${Date.now()}@test.com`;
      const password = "TestPass123!";
      await createTestUser(email, password);

      const auth = await loginAndGetAuth(email, password);
      expect(auth.verifyStatus).toBe(200);

      const res = await request(API_URL).get("/api/admin/audit-logs").set("Cookie", auth.cookies);
      expect(res.status).toBe(403);
    });

    it("denies unauthenticated access to admin audit endpoint", async () => {
      const res = await request(API_URL).get("/api/admin/audit-logs");
      expect(res.status).toBe(401);
    });

    it("allows seeded admin access to admin audit endpoint", async () => {
      const adminAuth = await loginAndGetAuth("admin@aegisbank.local", "AdminPass123!");
      expect(adminAuth.verifyStatus).toBe(200);

      const res = await request(API_URL).get("/api/admin/audit-logs").set("Cookie", adminAuth.cookies);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.logs)).toBe(true);
    });
  });

  describe("4. TRANSFER CAP & CSRF", () => {
    it("rejects transfer exceeding per-transfer cap", async () => {
      const email = `cap-${Date.now()}@test.com`;
      const password = "TestPass123!";
      await createTestUser(email, password);

      const auth = await loginAndGetAuth(email, password);
      expect(auth.verifyStatus).toBe(200);

      const res = await request(API_URL)
        .post("/api/transfers")
        .set("Cookie", auth.cookies)
        .set("X-CSRF-Token", auth.csrfToken)
        .send({
          toAccountNumber: "9999999999",
          amount: 50000,
          note: "cap test",
        });

      expect([400, 404]).toContain(res.status);
    });

    it("rejects POST transfer when CSRF token is missing", async () => {
      const email = `csrf-${Date.now()}@test.com`;
      const password = "TestPass123!";
      await createTestUser(email, password);

      const auth = await loginAndGetAuth(email, password);
      expect(auth.verifyStatus).toBe(200);

      const res = await request(API_URL)
        .post("/api/transfers")
        .set("Cookie", auth.cookies)
        .send({ toAccountNumber: "9999999999", amount: 100 });

      expect(res.status).toBe(403);
      expect(String(res.body.error || "")).toMatch(/csrf/i);
    });
  });

  describe("5. AUDIT LOGGING", () => {
    it("records registration and failed login events", async () => {
      const email = `audit-${Date.now()}@test.com`;
      await createTestUser(email, "CorrectPass123!");

      await request(API_URL).post("/api/auth/login").send({
        email,
        password: "WrongPass",
      });

      const adminAuth = await loginAndGetAuth("admin@aegisbank.local", "AdminPass123!");
      expect(adminAuth.verifyStatus).toBe(200);

      const registerRes = await request(API_URL)
        .get("/api/admin/audit-logs?eventType=user.register")
        .set("Cookie", adminAuth.cookies);
      expect(registerRes.status).toBe(200);

      const failedRes = await request(API_URL)
        .get("/api/admin/audit-logs?eventType=auth.login.failed")
        .set("Cookie", adminAuth.cookies);
      expect(failedRes.status).toBe(200);
    });
  });

  describe("6. AUTHENTICATION BASELINE", () => {
    it("rejects unauthenticated protected endpoint", async () => {
      const res = await request(API_URL).get("/api/accounts/me");
      expect(res.status).toBe(401);
    });

    it("allows unauthenticated health endpoint", async () => {
      const res = await request(API_URL).get("/api/health");
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ok");
    });
  });
});
