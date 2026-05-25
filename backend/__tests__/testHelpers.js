const request = require("supertest");

const API_URL = process.env.API_URL || "http://localhost:8081";
const MAILHOG_MESSAGES_URL = process.env.MAILHOG_MESSAGES_URL || "http://localhost:8025/api/v2/messages";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForApiReady(maxAttempts = 30, delayMs = 1000) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const res = await request(API_URL).get("/api/health");
      if (res.status === 200) return;
    } catch {
      // retry
    }
    await sleep(delayMs);
  }
  throw new Error("API is not ready.");
}

function extractOtpFromText(text) {
  const match = String(text || "").match(/\b(\d{6})\b/);
  return match ? match[1] : null;
}

function toRecipientAddress(item) {
  const to = item?.To?.[0];
  if (!to?.Mailbox || !to?.Domain) return "";
  return `${to.Mailbox}@${to.Domain}`.toLowerCase();
}

async function fetchOtpFromMailHog(email, sinceIso, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  const targetEmail = String(email || "").toLowerCase().trim();

  while (Date.now() < deadline) {
    try {
      const response = await request(MAILHOG_MESSAGES_URL).get("");
      if (response.status === 200) {
        const payload = (response.body && Object.keys(response.body).length > 0)
          ? response.body
          : JSON.parse(response.text || "{}");
        const items = payload?.items || [];
        const message = items.find((item) => {
          const recipient = toRecipientAddress(item);
          if (recipient !== targetEmail) return false;
          const created = new Date(item?.Created || 0).getTime();
          return Number.isFinite(created) && created >= new Date(sinceIso).getTime();
        });

        if (message) {
          const plain = message?.MIME?.Parts?.find((part) => (part?.Headers?.["Content-Type"] || "").includes("text/plain"))?.Body;
          const body = plain || message?.Content?.Body || "";
          const otp = extractOtpFromText(body);
          if (otp) return otp;
        }
      }
    } catch {
      // retry
    }

    await sleep(500);
  }

  throw new Error(`Could not retrieve OTP for ${targetEmail} from MailHog.`);
}

async function loginAndGetAuth(email, password) {
  const mfaRequestedAt = new Date().toISOString();
  const loginRes = await request(API_URL).post("/api/auth/login").send({ email, password });

  if (loginRes.status !== 200) {
    return {
      loginStatus: loginRes.status,
      loginBody: loginRes.body,
      cookies: "",
      csrfToken: "",
    };
  }

  const mfaCookie = loginRes.headers["set-cookie"]?.find((cookie) => cookie.includes("mfa_token"));
  if (!mfaCookie) {
    throw new Error("Missing MFA cookie after login.");
  }

  const otp = await fetchOtpFromMailHog(email, mfaRequestedAt);

  const verifyRes = await request(API_URL)
    .post("/api/auth/mfa/verify")
    .set("Cookie", mfaCookie)
    .send({ code: otp });

  const accessCookies = verifyRes.headers["set-cookie"] || [];
  const csrfCookie = accessCookies.find((cookie) => cookie.includes("csrf_token"));
  const csrfToken = csrfCookie?.match(/csrf_token=([^;]+)/)?.[1] || "";

  return {
    loginStatus: loginRes.status,
    verifyStatus: verifyRes.status,
    verifyBody: verifyRes.body,
    cookies: accessCookies.join("; "),
    csrfToken,
  };
}

module.exports = {
  API_URL,
  waitForApiReady,
  loginAndGetAuth,
};
