const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcrypt");
const rateLimit = require("express-rate-limit");

const config = require("./config");
const db = require("./db");
const security = require("./security");
const { sendOtpEmail, sendResetTokenEmail } = require("./email");

const app = express();
app.set("trust proxy", 1);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'", config.frontendOrigin],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
      },
    },
  }),
);

app.use(
  cors({
    origin: config.frontendOrigin,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  }),
);

app.use(express.json({ limit: "120kb" }));
app.use(cookieParser());

const apiLimiter = rateLimit({
  windowMs: config.apiRateLimitWindowMs,
  limit: config.apiRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: config.authRateLimitWindowMs,
  limit: config.authRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api", apiLimiter);

const accessCookie = "access_token";
const adminAccessCookie = "admin_access_token";
const mfaCookie = "pending_mfa_token";
const csrfCookie = "csrf_token";
const oauthStateCookie = "oauth_state";
const serverStartedAt = new Date().toISOString();
const activeSessionByToken = new Map();
const sessionIdleMs = Math.max(config.sessionIdleTimeoutMinutes, 1) * 60 * 1000;

function isGithubOauthConfigured() {
  return Boolean(
    config.oauthGithubEnabled
      && config.oauthGithubClientId
      && config.oauthGithubClientSecret
      && config.oauthGithubCallbackUrl,
  );
}

function getPasswordPolicyErrors(password) {
  const value = String(password || "");
  const errors = [];
  if (value.length < 10) errors.push("at least 10 characters");
  if (!/[a-z]/.test(value)) errors.push("one lowercase letter");
  if (!/[A-Z]/.test(value)) errors.push("one uppercase letter");
  if (!/[0-9]/.test(value)) errors.push("one number");
  if (!/[^A-Za-z0-9]/.test(value)) errors.push("one special character");
  return errors;
}

function isValidLoanAmount(value) {
  const amount = Number(value);
  if (Number.isNaN(amount)) return false;
  return amount > 0 && amount <= 10000000;
}

function isValidLoanTerm(termMonths) {
  const term = Number(termMonths);
  if (!Number.isInteger(term)) return false;
  return term >= 6 && term <= 60;
}

function isValidLoanRate(rate) {
  const value = Number(rate);
  if (Number.isNaN(value)) return false;
  return value >= 0 && value <= 36;
}

function buildLoanRepaymentSchedule(principal, annualRate, termMonths) {
  const p = Number(principal);
  const months = Number(termMonths);
  const monthlyRate = Number(annualRate) / 12 / 100;
  let monthlyPayment;

  if (monthlyRate === 0) {
    monthlyPayment = p / months;
  } else {
    const factor = Math.pow(1 + monthlyRate, months);
    monthlyPayment = (p * monthlyRate * factor) / (factor - 1);
  }

  const roundedPayment = Number(monthlyPayment.toFixed(2));
  const rows = [];
  let accumulated = 0;

  for (let i = 1; i <= months; i += 1) {
    let amount = roundedPayment;
    if (i === months) {
      const totalTarget = Number((roundedPayment * months).toFixed(2));
      amount = Number((totalTarget - accumulated).toFixed(2));
    }
    accumulated += amount;
    const dueDate = new Date();
    dueDate.setMonth(dueDate.getMonth() + i);
    rows.push({
      installmentNumber: i,
      dueDate: dueDate.toISOString(),
      amount,
    });
  }

  return rows;
}

function touchSession(token) {
  const key = security.hashToken(token);
  const expiresAt = Date.now() + sessionIdleMs;
  activeSessionByToken.set(key, expiresAt);
  return expiresAt;
}

function clearSession(token) {
  const key = security.hashToken(token);
  activeSessionByToken.delete(key);
}

function generateAccountNumber() {
  return `AC${Date.now().toString().slice(-10)}${Math.floor(Math.random() * 90 + 10)}`;
}

function generateCardLast4() {
  return String(Math.floor(Math.random() * 9000) + 1000);
}

function createProviderReference(prefix) {
  return `${prefix}_${Date.now()}_${security.createRandomToken().slice(0, 10)}`;
}

function mapProviderCardStatusToInternal(providerStatus) {
  if (providerStatus === "succeeded") {
    return "active";
  }
  if (providerStatus === "blocked") {
    return "frozen";
  }
  if (providerStatus === "lost") {
    return "lost";
  }
  if (providerStatus === "failed") {
    return "disabled";
  }
  return "pending";
}


async function submitCardToProvider(payload) {
  const mode = config.cardProviderMode;
  const providerRef = createProviderReference("card");

  if (mode !== "sandbox") {
    return {
      externalProvider: mode,
      providerRef,
      providerStatus: "pending",
      providerErrorCode: null,
      providerErrorMessage: null,
      providerLastSyncedAt: new Date().toISOString(),
    };
  }

  const chance = Math.random();
  let providerStatus = "succeeded";
  let providerErrorCode = null;
  let providerErrorMessage = null;

  if (chance < config.providerFailureRate) {
    providerStatus = "failed";
    providerErrorCode = "SANDBOX_CARD_REJECTED";
    providerErrorMessage = "Sandbox card issuance rejected the request.";
  } else if (chance < config.providerFailureRate + config.providerPendingRate) {
    providerStatus = "pending";
  }

  return {
    externalProvider: "sandbox",
    providerRef,
    providerStatus,
    providerErrorCode,
    providerErrorMessage,
    providerLastSyncedAt: new Date().toISOString(),
    requestPayload: payload,
  };
}


function resolveCardProviderStatusForSync(currentProviderStatus) {
  const normalized = String(currentProviderStatus || "pending").toLowerCase();
  if (["succeeded", "failed", "blocked", "lost"].includes(normalized)) {
    return {
      providerStatus: normalized,
      providerErrorCode: null,
      providerErrorMessage: null,
    };
  }

  if (config.cardProviderMode !== "sandbox") {
    return {
      providerStatus: "pending",
      providerErrorCode: null,
      providerErrorMessage: null,
    };
  }

  const chance = Math.random();
  if (chance < config.providerFailureRate) {
    return {
      providerStatus: "failed",
      providerErrorCode: "SANDBOX_CARD_REJECTED",
      providerErrorMessage: "Sandbox card issuance rejected the request.",
    };
  }

  if (chance < config.providerFailureRate + config.providerPendingRate) {
    return {
      providerStatus: "pending",
      providerErrorCode: null,
      providerErrorMessage: null,
    };
  }

  return {
    providerStatus: "succeeded",
    providerErrorCode: null,
    providerErrorMessage: null,
  };
}

function verifyProviderWebhookSignature(req) {
  const signature = String(req.header("x-provider-signature") || "");
  return signature && signature === config.providerWebhookSecret;
}


async function fetchStatementRows(accountId, userId, fromDate, toDate) {
  const ownerCheck = await db.query(
    `SELECT id, account_number
     FROM accounts
     WHERE id = $1 AND user_id = $2`,
    [accountId, userId],
  );

  const account = ownerCheck.rows[0];
  if (!account) {
    return { account: null, rows: [] };
  }

  const params = [accountId, config.databaseEncryptionKey];
  let whereSql = "WHERE (t.from_account_id = $1 OR t.to_account_id = $1)";

  if (fromDate) {
    params.push(fromDate.toISOString());
    whereSql += ` AND t.created_at >= $${params.length}`;
  }

  if (toDate) {
    params.push(toDate.toISOString());
    whereSql += ` AND t.created_at <= $${params.length}`;
  }

  const rows = await db.query(
    `SELECT t.id,
            t.created_at,
            t.amount,
            t.status,
            af.account_number AS from_account,
            at.account_number AS to_account,
            CASE
              WHEN t.note_ciphertext IS NOT NULL AND $2::text IS NOT NULL
                THEN pgp_sym_decrypt(t.note_ciphertext, $2::text)
              ELSE t.note
            END AS note
     FROM transactions t
     JOIN accounts af ON af.id = t.from_account_id
     JOIN accounts at ON at.id = t.to_account_id
     ${whereSql}
     ORDER BY t.created_at DESC`,
    params,
  );

  return { account, rows: rows.rows };
}

async function ensureAccountForUser(userId, startingBalance = 0) {
  const existing = await db.query(
    "SELECT id, is_primary FROM accounts WHERE user_id = $1 ORDER BY created_at ASC",
    [userId],
  );
  if (existing.rows[0]) {
    const hasPrimary = existing.rows.some((row) => row.is_primary === true);
    if (!hasPrimary) {
      await db.query("UPDATE accounts SET is_primary = TRUE WHERE id = $1", [existing.rows[0].id]);
    }
    return;
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const accountNumber = generateAccountNumber();
    try {
      await db.query(
        `INSERT INTO accounts (user_id, account_number, currency, account_type, account_status, is_primary, balance)
         VALUES ($1, $2, 'EGP', 'checking', 'active', TRUE, $3)`,
        [userId, accountNumber, startingBalance],
      );
      return;
    } catch (error) {
      const duplicateAccountNumber = String(error.message || "").includes("accounts_account_number_key");
      if (!duplicateAccountNumber) {
        throw error;
      }
    }
  }

  throw new Error("Failed to generate a unique account number.");
}

function setCookie(res, name, value, maxAgeMs, httpOnly = true, options = {}) {
  res.cookie(name, value, {
    httpOnly,
    secure: config.isProduction,
    sameSite: "strict",
    maxAge: maxAgeMs,
    path: "/",
    ...options,
  });
}

function clearAuthCookies(res) {
  res.clearCookie(accessCookie, { path: "/" });
  res.clearCookie(adminAccessCookie, { path: "/" });
  res.clearCookie(mfaCookie, { path: "/" });
  res.clearCookie(csrfCookie, { path: "/" });
}

function createOAuthPasswordFallback() {
  return security.createRandomToken();
}

async function audit(actorUserId, eventType, metadata = {}) {
  await db.query(
    `INSERT INTO audit_logs (actor_user_id, event_type, metadata)
     VALUES ($1, $2, $3::jsonb)`,
    [actorUserId, eventType, JSON.stringify(metadata)],
  );
}

function toNotificationPreferencesDto(row) {
  return {
    inAppEnabled: Boolean(row.in_app_enabled),
    emailEnabled: Boolean(row.email_enabled),
    accountEnabled: Boolean(row.account_enabled),
    transferEnabled: Boolean(row.transfer_enabled),
    paymentEnabled: Boolean(row.payment_enabled),
    supportEnabled: Boolean(row.support_enabled),
    securityEnabled: Boolean(row.security_enabled),
    systemEnabled: Boolean(row.system_enabled),
    updatedAt: row.updated_at,
  };
}

function getTypePreferenceColumn(type) {
  const mapping = {
    account: "account_enabled",
    transfer: "transfer_enabled",
    payment: "payment_enabled",
    support: "support_enabled",
    security: "security_enabled",
    system: "system_enabled",
  };
  return mapping[type] || null;
}

async function ensureNotificationPreferences(userId) {
  const existing = await db.query(
    `SELECT *
     FROM notification_preferences
     WHERE user_id = $1`,
    [userId],
  );

  if (existing.rows[0]) {
    return existing.rows[0];
  }

  const inserted = await db.query(
    `INSERT INTO notification_preferences (user_id)
     VALUES ($1)
     RETURNING *`,
    [userId],
  );

  return inserted.rows[0];
}

async function createUserNotification(userId, type, title, body, metadata = {}) {
  const prefs = await ensureNotificationPreferences(userId);
  const prefColumn = getTypePreferenceColumn(type);

  if (!prefColumn || prefs[prefColumn] !== true) {
    return;
  }

  if (prefs.in_app_enabled === true) {
    await db.query(
      `INSERT INTO notifications (user_id, type, title, body, metadata)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [userId, type, title, body, JSON.stringify(metadata)],
    );
  }

  if (prefs.email_enabled === true) {
    await db.query(
      `INSERT INTO notification_outbox (user_id, channel, payload, status)
       VALUES ($1, 'email', $2::jsonb, 'pending')`,
      [
        userId,
        JSON.stringify({
          type,
          title,
          body,
          metadata,
          queuedAt: new Date().toISOString(),
        }),
      ],
    );
  }
}

function requireAuth(req, res, next) {
  try {
    const token = req.cookies[accessCookie];
    if (!token) {
      return res.status(401).json({ error: "Authentication required." });
    }
    const payload = security.verifyAccessToken(token);
    req.authToken = token;
    req.user = payload;
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid session." });
  }
}

function requireActiveSession(req, res, next) {
  const token = req.authToken;
  if (!token) {
    return res.status(401).json({ error: "Authentication required." });
  }

  const key = security.hashToken(token);
  const expiresAt = activeSessionByToken.get(key);
  if (expiresAt && expiresAt < Date.now()) {
    activeSessionByToken.delete(key);
    clearAuthCookies(res);
    audit(req.user?.sub, "auth.session.timeout", {}).catch(() => {});
    return res.status(401).json({ error: "Session timed out due to inactivity." });
  }

  touchSession(token);
  return next();
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ error: "Forbidden." });
    }
    return next();
  };
}

function requireCsrf(req, res, next) {
  const unsafe = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method);
  if (!unsafe) {
    return next();
  }
  const cookieToken = req.cookies[csrfCookie];
  const headerToken = req.header("x-csrf-token");
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({ error: "CSRF validation failed." });
  }
  return next();
}

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/health/workers", (_req, res) => {
  res.json({
    status: "ok",
    startedAt: serverStartedAt,
    uptimeSeconds: Math.floor(process.uptime()),
    workers: {
      providerSync: {
        enabled: config.providerSyncWorkerEnabled,
        intervalSeconds: config.providerSyncWorkerIntervalSeconds,
        batchSize: config.providerSyncWorkerBatchSize,
        busy: providerSyncWorkerBusy,
        ...providerSyncWorkerState,
      },
    },
  });
});

app.get("/api/notifications", requireAuth, requireActiveSession, async (req, res) => {
  const where = ["user_id = $1"];
  const params = [req.user.sub];

  const typeFilter = String(req.query.type || "").trim().toLowerCase();
  if (["account", "transfer", "payment", "support", "security", "system"].includes(typeFilter)) {
    params.push(typeFilter);
    where.push(`type = $${params.length}`);
  }

  const unreadOnly = String(req.query.unreadOnly || "").trim().toLowerCase();
  if (["1", "true", "yes"].includes(unreadOnly)) {
    where.push("is_read = FALSE");
  }

  const search = String(req.query.search || "").trim();
  if (search) {
    params.push(`%${search}%`);
    where.push(`(title ILIKE $${params.length} OR body ILIKE $${params.length})`);
  }

  const requestedLimit = Number(req.query.limit || 20);
  const safeLimit = Number.isNaN(requestedLimit)
    ? 20
    : Math.min(Math.max(requestedLimit, 1), 100);
  const requestedOffset = Number(req.query.offset || 0);
  const safeOffset = Number.isNaN(requestedOffset)
    ? 0
    : Math.max(requestedOffset, 0);

  const whereSql = `WHERE ${where.join(" AND ")}`;
  params.push(safeLimit, safeOffset);

  const rows = await db.query(
    `SELECT id, type, title, body, metadata, is_read, read_at, created_at
     FROM notifications
     ${whereSql}
     ORDER BY created_at DESC
     LIMIT $${params.length - 1}
     OFFSET $${params.length}`,
    params,
  );

  const countParams = params.slice(0, params.length - 2);
  const count = await db.query(
    `SELECT COUNT(*)::int AS total
     FROM notifications
     ${whereSql}`,
    countParams,
  );

  const unread = await db.query(
    `SELECT COUNT(*)::int AS unread_count
     FROM notifications
     WHERE user_id = $1 AND is_read = FALSE`,
    [req.user.sub],
  );

  return res.json({
    notifications: rows.rows,
    unreadCount: Number(unread.rows[0]?.unread_count || 0),
    pagination: {
      total: Number(count.rows[0]?.total || 0),
      limit: safeLimit,
      offset: safeOffset,
      hasNext: safeOffset + safeLimit < Number(count.rows[0]?.total || 0),
      hasPrevious: safeOffset > 0,
    },
  });
});

app.get("/api/notifications/preferences", requireAuth, requireActiveSession, async (req, res) => {
  const prefs = await ensureNotificationPreferences(req.user.sub);
  return res.json({ preferences: toNotificationPreferencesDto(prefs) });
});

app.put("/api/notifications/preferences", requireAuth, requireActiveSession, requireCsrf, async (req, res) => {
  const body = req.body || {};
  const fieldMap = {
    inAppEnabled: "in_app_enabled",
    emailEnabled: "email_enabled",
    accountEnabled: "account_enabled",
    transferEnabled: "transfer_enabled",
    paymentEnabled: "payment_enabled",
    supportEnabled: "support_enabled",
    securityEnabled: "security_enabled",
    systemEnabled: "system_enabled",
  };

  await ensureNotificationPreferences(req.user.sub);

  const updates = [];
  const params = [];

  for (const [key, column] of Object.entries(fieldMap)) {
    if (body[key] !== undefined) {
      if (typeof body[key] !== "boolean") {
        return res.status(400).json({ error: `${key} must be a boolean.` });
      }
      params.push(body[key]);
      updates.push(`${column} = $${params.length}`);
    }
  }

  if (!updates.length) {
    return res.status(400).json({ error: "No preference fields provided." });
  }

  updates.push("updated_at = NOW()");
  params.push(req.user.sub);

  const updated = await db.query(
    `UPDATE notification_preferences
     SET ${updates.join(", ")}
     WHERE user_id = $${params.length}
     RETURNING *`,
    params,
  );

  await audit(req.user.sub, "user.notifications.preferences.updated", {});
  return res.json({
    message: "Notification preferences updated.",
    preferences: toNotificationPreferencesDto(updated.rows[0]),
  });
});

app.post("/api/notifications/:id/read", requireAuth, requireActiveSession, requireCsrf, async (req, res) => {
  const updated = await db.query(
    `UPDATE notifications
     SET is_read = TRUE,
         read_at = NOW()
     WHERE id = $1 AND user_id = $2
     RETURNING id`,
    [req.params.id, req.user.sub],
  );

  if (!updated.rows[0]) {
    return res.status(404).json({ error: "Notification not found." });
  }

  return res.json({ message: "Notification marked as read." });
});

app.post("/api/notifications/read-all", requireAuth, requireActiveSession, requireCsrf, async (req, res) => {
  await db.query(
    `UPDATE notifications
     SET is_read = TRUE,
         read_at = NOW()
     WHERE user_id = $1 AND is_read = FALSE`,
    [req.user.sub],
  );

  return res.json({ message: "All notifications marked as read." });
});

app.post("/api/providers/cards/webhook", async (req, res) => {
  if (!verifyProviderWebhookSignature(req)) {
    return res.status(403).json({ error: "Invalid provider signature." });
  }

  const provider = String(req.body?.provider || "sandbox").trim().toLowerCase();
  const providerRef = String(req.body?.providerRef || "").trim();
  const providerStatus = String(req.body?.status || "").trim().toLowerCase();
  const providerErrorCode = req.body?.errorCode ? String(req.body.errorCode).trim() : null;
  const providerErrorMessage = req.body?.errorMessage ? String(req.body.errorMessage).trim() : null;

  if (!providerRef || !["pending", "succeeded", "failed", "blocked", "lost"].includes(providerStatus)) {
    return res.status(400).json({ error: "Invalid card webhook payload." });
  }

  const updated = await db.query(
    `UPDATE cards
     SET provider_status = $1,
         provider_error_code = $2,
         provider_error_message = $3,
         provider_last_synced_at = NOW(),
         status = CASE
           WHEN is_reported_lost = TRUE THEN 'lost'
           WHEN $1 = 'succeeded' THEN 'active'
           WHEN $1 = 'blocked' THEN 'frozen'
           WHEN $1 = 'lost' THEN 'lost'
           WHEN $1 = 'failed' THEN 'disabled'
           ELSE 'pending'
         END,
         is_frozen = CASE
           WHEN is_reported_lost = TRUE THEN TRUE
           WHEN $1 IN ('blocked', 'lost') THEN TRUE
           WHEN $1 = 'succeeded' THEN FALSE
           ELSE is_frozen
         END,
         is_reported_lost = CASE WHEN is_reported_lost = TRUE OR $1 = 'lost' THEN TRUE ELSE FALSE END,
         updated_at = NOW()
     WHERE external_provider = $4 AND provider_ref = $5
     RETURNING id, user_id`,
    [providerStatus, providerErrorCode, providerErrorMessage, provider, providerRef],
  );

  if (!updated.rows[0]) {
    return res.status(404).json({ error: "Card not found for provider reference." });
  }

  await audit(updated.rows[0].user_id, "provider.card.webhook.processed", {
    cardId: updated.rows[0].id,
    provider,
    providerRef,
    providerStatus,
  });

  return res.json({ message: "Card webhook processed." });
});

app.post("/api/providers/cards/sync", requireAuth, requireActiveSession, requireCsrf, async (req, res) => {
  const pendingRows = await db.query(
    `SELECT id, provider_status
     FROM cards
     WHERE user_id = $1 AND provider_status = 'pending'
     ORDER BY created_at DESC
     LIMIT 150`,
    [req.user.sub],
  );

  const updatedCards = [];

  for (const card of pendingRows.rows) {
    const nextProvider = resolveCardProviderStatusForSync(card.provider_status);
    const mappedStatus = mapProviderCardStatusToInternal(nextProvider.providerStatus);

    const updated = await db.query(
      `UPDATE cards
       SET provider_status = $1,
           provider_error_code = $2,
           provider_error_message = $3,
           provider_last_synced_at = NOW(),
           status = $4,
           is_frozen = CASE WHEN $1 IN ('blocked', 'lost') THEN TRUE ELSE is_frozen END,
           is_reported_lost = CASE WHEN $1 = 'lost' THEN TRUE ELSE is_reported_lost END,
           updated_at = NOW()
       WHERE id = $5 AND user_id = $6
       RETURNING id, account_id, card_type, card_last4, status, is_frozen, is_reported_lost,
                 external_provider, provider_ref, provider_status, provider_error_code, provider_error_message, provider_last_synced_at,
                 created_at, updated_at`,
      [
        nextProvider.providerStatus,
        nextProvider.providerErrorCode,
        nextProvider.providerErrorMessage,
        mappedStatus,
        card.id,
        req.user.sub,
      ],
    );

    if (updated.rows[0]) {
      updatedCards.push(updated.rows[0]);
    }
  }

  await audit(req.user.sub, "provider.card.sync.requested", {
    updatedCount: updatedCards.length,
    pendingCount: pendingRows.rows.length,
  });

  return res.json({
    message: "Card provider sync completed.",
    summary: {
      updatedCount: updatedCards.length,
      pendingCount: pendingRows.rows.length,
    },
    cards: updatedCards,
  });
});

app.get("/api/providers/status", requireAuth, requireActiveSession, async (req, res) => {
  const cardSummary = await db.query(
    `SELECT
       COUNT(*) FILTER (WHERE provider_status = 'pending')::int AS pending_count,
       MAX(provider_last_synced_at) AS last_synced_at
     FROM cards
     WHERE user_id = $1`,
    [req.user.sub],
  );

  return res.json({
    payments: { pendingCount: 0, lastSyncedAt: null },
    cards: {
      pendingCount: Number(cardSummary.rows[0]?.pending_count || 0),
      lastSyncedAt: cardSummary.rows[0]?.last_synced_at || null,
    },
  });
});

app.get("/api/auth/oauth/providers", (_req, res) => {
  res.json({
    github: {
      enabled: isGithubOauthConfigured(),
    },
  });
});

app.get("/api/auth/oauth/github/start", (_req, res) => {
  if (!isGithubOauthConfigured()) {
    return res.status(503).json({ error: "GitHub OAuth is not configured." });
  }

  const state = security.createRandomToken();
  // OAuth callback returns from a third-party domain; Lax keeps CSRF protection while allowing this redirect.
  setCookie(res, oauthStateCookie, state, 10 * 60 * 1000, true, { sameSite: "lax" });

  const params = new URLSearchParams({
    client_id: config.oauthGithubClientId,
    redirect_uri: config.oauthGithubCallbackUrl,
    scope: "read:user user:email",
    state,
  });

  return res.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
});

app.get("/api/auth/oauth/github/callback", async (req, res) => {
  if (!isGithubOauthConfigured()) {
    return res.status(503).json({ error: "GitHub OAuth is not configured." });
  }

  const stateFromQuery = String(req.query.state || "");
  const code = String(req.query.code || "");
  const stateFromCookie = req.cookies[oauthStateCookie];
  res.clearCookie(oauthStateCookie, { path: "/" });

  if (!code || !stateFromQuery || !stateFromCookie || stateFromQuery !== stateFromCookie) {
    return res.status(403).json({ error: "Invalid OAuth state." });
  }

  const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: config.oauthGithubClientId,
      client_secret: config.oauthGithubClientSecret,
      code,
      redirect_uri: config.oauthGithubCallbackUrl,
    }),
  });

  if (!tokenResponse.ok) {
    return res.status(502).json({ error: "GitHub token exchange failed." });
  }

  const tokenData = await tokenResponse.json();
  if (!tokenData.access_token) {
    return res.status(401).json({ error: "OAuth token not issued." });
  }

  const githubHeaders = {
    Authorization: `Bearer ${tokenData.access_token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "secure-banking-project",
  };

  const profileResponse = await fetch("https://api.github.com/user", { headers: githubHeaders });
  if (!profileResponse.ok) {
    return res.status(502).json({ error: "GitHub profile request failed." });
  }

  const profile = await profileResponse.json();
  let githubEmail = profile.email ? String(profile.email).trim() : "";

  if (!githubEmail) {
    const emailsResponse = await fetch("https://api.github.com/user/emails", { headers: githubHeaders });
    if (emailsResponse.ok) {
      const emails = await emailsResponse.json();
      const preferred = Array.isArray(emails)
        ? emails.find((item) => item.primary && item.verified) || emails.find((item) => item.verified)
        : null;
      githubEmail = preferred?.email ? String(preferred.email).trim() : "";
    }
  }

  if (!githubEmail) {
    return res.status(400).json({ error: "No verified email available from GitHub." });
  }

  const safeEmail = githubEmail.toLowerCase();
  const fullName = String(profile.name || profile.login || safeEmail.split("@")[0]).trim();

  const existingRes = await db.query(
    `SELECT id, email, role, is_locked, locked_until FROM users WHERE email = $1`,
    [safeEmail],
  );

  let user = existingRes.rows[0];

  if (!user) {
    const hash = await bcrypt.hash(createOAuthPasswordFallback(), 12);
    const createdRes = await db.query(
      `INSERT INTO users (full_name, email, password_hash, role)
       VALUES ($1, $2, $3, 'user')
       RETURNING id, email, role, is_locked, locked_until`,
      [fullName, safeEmail, hash],
    );
    user = createdRes.rows[0];
    await ensureAccountForUser(user.id, 5000.0);
    await audit(user.id, "auth.oauth.github.signup", { email: safeEmail });
  }

  const lockedUntil = user.locked_until ? new Date(user.locked_until) : null;
  if (user.is_locked || (lockedUntil && lockedUntil > new Date())) {
    return res.status(423).json({ error: "Account is temporarily locked. Try again later." });
  }

  const accessToken = security.signAccessToken(user);
  const csrfToken = security.createCsrfToken();
  setCookie(res, accessCookie, accessToken, 15 * 60 * 1000, true);
  setCookie(res, csrfCookie, csrfToken, 15 * 60 * 1000, false);
  const sessionExpiresAt = touchSession(accessToken);

  await audit(user.id, "auth.oauth.github.login", {
    email: safeEmail,
    sessionExpiresAt,
  });

  // Redirect to a public route first; the SPA bootstrap will hydrate session and route to dashboard.
  return res.redirect(`${config.frontendOrigin}/login?oauth=success`);
});

app.post("/api/auth/register", authLimiter, async (req, res) => {
  const { fullName, email, password } = req.body || {};
  if (!fullName || !email || !password) {
    return res.status(400).json({ error: "Invalid registration payload." });
  }

  const passwordPolicyErrors = getPasswordPolicyErrors(password);
  if (passwordPolicyErrors.length) {
    return res.status(400).json({
      error: `Password must include ${passwordPolicyErrors.join(", ")}.`,
    });
  }

  const safeEmail = String(email).toLowerCase().trim();
  const hash = await bcrypt.hash(password, 12);

  try {
    const userResult = await db.query(
      `INSERT INTO users (full_name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, full_name, email, role`,
      [fullName.trim(), safeEmail, hash],
    );

    const user = userResult.rows[0];
    await ensureAccountForUser(user.id, 5000.0);

    await audit(user.id, "user.register", { email: safeEmail });
    return res.status(201).json({ message: "Registration successful." });
  } catch (error) {
    if (String(error.message || "").includes("users_email_key")) {
      return res.status(409).json({ error: "Email already exists." });
    }
    return res.status(500).json({ error: "Registration failed." });
  }
});

app.post("/api/auth/login", authLimiter, async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  const safeEmail = String(email).toLowerCase().trim();
  const result = await db.query(
    `SELECT id, full_name, email, password_hash, role, is_locked, failed_login_attempts, locked_until, mfa_enabled, account_status
     FROM users WHERE email = $1`,
    [safeEmail],
  );

  const user = result.rows[0];
  if (!user) {
    return res.status(401).json({ error: "Invalid credentials." });
  }

  if (user.account_status !== "active") {
    return res.status(403).json({ error: "Account is not active. Contact support." });
  }

  const lockedUntil = user.locked_until ? new Date(user.locked_until) : null;
  if (user.is_locked || (lockedUntil && lockedUntil > new Date())) {
    return res.status(423).json({ error: "Account is temporarily locked. Try again later." });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    const updatedAttempts = Number(user.failed_login_attempts || 0) + 1;
    const lockoutReached = updatedAttempts >= config.maxFailedLoginAttempts;

    if (lockoutReached) {
      await db.query(
        `UPDATE users
         SET failed_login_attempts = 0,
             is_locked = TRUE,
             locked_until = NOW() + ($1::int * INTERVAL '1 minute')
         WHERE id = $2`,
        [config.loginLockoutMinutes, user.id],
      );
      await audit(user.id, "auth.login.locked", { email: safeEmail });
      return res.status(423).json({ error: "Account is temporarily locked. Try again later." });
    }

    await db.query(
      `UPDATE users
       SET failed_login_attempts = failed_login_attempts + 1
       WHERE id = $1`,
      [user.id],
    );
    await audit(user.id, "auth.login.failed", { email: safeEmail });
    return res.status(401).json({ error: "Invalid credentials." });
  }

  await db.query(
    `UPDATE users
     SET failed_login_attempts = 0,
         is_locked = FALSE,
         locked_until = NULL
     WHERE id = $1`,
    [user.id],
  );

  if (user.mfa_enabled === false) {
    const accessToken = security.signAccessToken(user);
    const csrfToken = security.createCsrfToken();
    setCookie(res, accessCookie, accessToken, 15 * 60 * 1000, true);
    setCookie(res, csrfCookie, csrfToken, 15 * 60 * 1000, false);
    const sessionExpiresAt = touchSession(accessToken);

    await audit(user.id, "auth.login.success", { mfaBypassed: true });
    return res.json({
      message: "Authentication complete.",
      requiresMfa: false,
      session: {
        idleTimeoutMinutes: config.sessionIdleTimeoutMinutes,
        expiresAt: new Date(sessionExpiresAt).toISOString(),
      },
    });
  }

  const code = security.createOtpCode();
  const codeHash = await bcrypt.hash(code, 10);

  const mfaRes = await db.query(
    `INSERT INTO mfa_codes (user_id, code_hash, expires_at)
     VALUES ($1, $2, NOW() + INTERVAL '5 minutes')
     RETURNING id`,
    [user.id, codeHash],
  );

  const pendingToken = security.signMfaToken(user.id, mfaRes.rows[0].id);
  setCookie(res, mfaCookie, pendingToken, 10 * 60 * 1000, true);

  try {
    await sendOtpEmail({
      to: user.email,
      fullName: user.full_name,
      code,
    });
  } catch (error) {
    await db.query("DELETE FROM mfa_codes WHERE id = $1", [mfaRes.rows[0].id]);
    res.clearCookie(mfaCookie, { path: "/" });
    return res.status(503).json({ error: "Could not deliver MFA code. Please try again shortly." });
  }

  await audit(user.id, "auth.mfa.challenge", { email: safeEmail });
  return res.json({ message: "MFA code sent to your email.", requiresMfa: true });
});

app.post("/api/auth/mfa/verify", authLimiter, async (req, res) => {
  const token = req.cookies[mfaCookie];
  const { code } = req.body || {};
  if (!token || !code) {
    return res.status(400).json({ error: "MFA session and code are required." });
  }

  let pending;
  try {
    pending = security.verifyMfaToken(token);
  } catch {
    return res.status(401).json({ error: "MFA session expired." });
  }

  const mfaResult = await db.query(
    `SELECT id, user_id, code_hash, expires_at, attempts, consumed_at
     FROM mfa_codes
     WHERE id = $1`,
    [pending.mfaId],
  );

  const mfa = mfaResult.rows[0];
  if (!mfa || mfa.consumed_at || new Date(mfa.expires_at) < new Date()) {
    return res.status(401).json({ error: "MFA code expired." });
  }

  if (mfa.attempts >= 5) {
    return res.status(429).json({ error: "Too many invalid MFA attempts." });
  }

  const matched = await bcrypt.compare(String(code), mfa.code_hash);
  if (!matched) {
    await db.query("UPDATE mfa_codes SET attempts = attempts + 1 WHERE id = $1", [mfa.id]);
    await audit(mfa.user_id, "auth.mfa.failed", {});
    return res.status(401).json({ error: "Invalid MFA code." });
  }

  await db.query("UPDATE mfa_codes SET consumed_at = NOW() WHERE id = $1", [mfa.id]);

  const userRes = await db.query(
    `SELECT id, email, role FROM users WHERE id = $1`,
    [mfa.user_id],
  );
  const user = userRes.rows[0];

  const accessToken = security.signAccessToken(user);
  const csrfToken = security.createCsrfToken();

  setCookie(res, accessCookie, accessToken, 15 * 60 * 1000, true);
  setCookie(res, csrfCookie, csrfToken, 15 * 60 * 1000, false);
  res.clearCookie(mfaCookie, { path: "/" });
  const sessionExpiresAt = touchSession(accessToken);

  await audit(user.id, "auth.login.success", {});
  return res.json({
    message: "Authentication complete.",
    session: {
      idleTimeoutMinutes: config.sessionIdleTimeoutMinutes,
      expiresAt: new Date(sessionExpiresAt).toISOString(),
    },
  });
});

app.get("/api/auth/me", requireAuth, requireActiveSession, async (req, res) => {
  const userResult = await db.query(
    `SELECT id, full_name, email, role, phone_number, mfa_enabled, account_status, created_at
     FROM users WHERE id = $1`,
    [req.user.sub],
  );

  if (!userResult.rows[0]) {
    return res.status(404).json({ error: "User not found." });
  }

  const user = {
    ...userResult.rows[0],
    is_impersonating: req.user?.type === "impersonation",
    impersonated_by: req.user?.impersonatedBy || null,
  };

  return res.json({ user, sessionIdleTimeoutMinutes: config.sessionIdleTimeoutMinutes });
});

app.post("/api/auth/impersonation/stop", requireAuth, requireActiveSession, requireCsrf, async (req, res) => {
  if (req.user?.type !== "impersonation" || !req.user?.impersonatedBy) {
    return res.status(400).json({ error: "No active impersonation session." });
  }

  const adminToken = req.cookies[adminAccessCookie];
  if (!adminToken) {
    await audit(req.user.impersonatedBy, "admin.user.impersonation.restore_failed", {
      targetUserId: req.user.sub,
      reason: "admin_backup_cookie_missing",
    });
    return res.status(401).json({ error: "Original admin session not found. Please start impersonation again." });
  }

  let adminPayload;
  try {
    adminPayload = security.verifyAccessToken(adminToken);
  } catch {
    await audit(req.user.impersonatedBy, "admin.user.impersonation.restore_failed", {
      targetUserId: req.user.sub,
      reason: "admin_backup_token_invalid",
    });
    return res.status(401).json({ error: "Original admin session is invalid. Please start impersonation again." });
  }

  if (adminPayload.role !== "admin" || adminPayload.sub !== req.user.impersonatedBy || adminPayload.type !== "access") {
    await audit(req.user.impersonatedBy, "admin.user.impersonation.restore_failed", {
      targetUserId: req.user.sub,
      reason: "admin_restore_context_mismatch",
    });
    return res.status(403).json({ error: "Impersonation restore context is invalid." });
  }

  const adminSessionKey = security.hashToken(adminToken);
  const adminSessionExpiresAt = activeSessionByToken.get(adminSessionKey);
  if (!adminSessionExpiresAt || adminSessionExpiresAt < Date.now()) {
    activeSessionByToken.delete(adminSessionKey);
    await audit(req.user.impersonatedBy, "admin.user.impersonation.restore_failed", {
      targetUserId: req.user.sub,
      reason: "admin_session_expired",
    });
    return res.status(401).json({ error: "Original admin session expired. Please start impersonation again." });
  }

  clearSession(req.authToken);
  const csrfToken = security.createCsrfToken();
  // Keep cookie lifetime aligned with active-session timeout to avoid premature restore logout.
  setCookie(res, accessCookie, adminToken, sessionIdleMs, true);
  setCookie(res, csrfCookie, csrfToken, sessionIdleMs, false);
  res.clearCookie(adminAccessCookie, { path: "/" });
  const sessionExpiresAt = touchSession(adminToken);

  await audit(req.user.impersonatedBy, "admin.user.impersonation.stopped", {
    targetUserId: req.user.sub,
    sessionExpiresAt: new Date(sessionExpiresAt).toISOString(),
  });

  return res.json({
    message: "Returned to admin session.",
    session: {
      idleTimeoutMinutes: config.sessionIdleTimeoutMinutes,
      expiresAt: new Date(sessionExpiresAt).toISOString(),
    },
  });
});

app.get("/api/profile", requireAuth, requireActiveSession, async (req, res) => {
  const profileResult = await db.query(
    `SELECT id, full_name, email, role, phone_number, mfa_enabled, account_status, created_at
     FROM users
     WHERE id = $1`,
    [req.user.sub],
  );

  if (!profileResult.rows[0]) {
    return res.status(404).json({ error: "User not found." });
  }

  return res.json({ user: profileResult.rows[0] });
});

app.put("/api/profile", requireAuth, requireActiveSession, requireCsrf, async (req, res) => {
  const { fullName, phoneNumber } = req.body || {};
  const safeFullName = String(fullName || "").trim();
  const safePhone = String(phoneNumber || "").trim();

  if (!safeFullName || safeFullName.length < 3) {
    return res.status(400).json({ error: "Full name must be at least 3 characters." });
  }

  if (safePhone && !/^\+?[0-9\-\s]{7,20}$/.test(safePhone)) {
    return res.status(400).json({ error: "Phone number format is invalid." });
  }

  const updated = await db.query(
    `UPDATE users
     SET full_name = $1,
         phone_number = NULLIF($2, '')
     WHERE id = $3
     RETURNING id, full_name, email, role, phone_number, mfa_enabled, account_status, created_at`,
    [safeFullName, safePhone, req.user.sub],
  );

  await audit(req.user.sub, "user.profile.updated", {});
  return res.json({ message: "Profile updated successfully.", user: updated.rows[0] });
});

app.post("/api/auth/password/change", requireAuth, requireActiveSession, requireCsrf, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "Current and new passwords are required." });
  }

  const passwordPolicyErrors = getPasswordPolicyErrors(newPassword);
  if (passwordPolicyErrors.length) {
    return res.status(400).json({
      error: `Password must include ${passwordPolicyErrors.join(", ")}.`,
    });
  }

  const userResult = await db.query(
    `SELECT id, password_hash FROM users WHERE id = $1`,
    [req.user.sub],
  );
  const row = userResult.rows[0];
  if (!row) {
    return res.status(404).json({ error: "User not found." });
  }

  const valid = await bcrypt.compare(String(currentPassword), row.password_hash);
  if (!valid) {
    return res.status(401).json({ error: "Current password is incorrect." });
  }

  const hash = await bcrypt.hash(String(newPassword), 12);
  await db.query("UPDATE users SET password_hash = $1 WHERE id = $2", [hash, req.user.sub]);
  await audit(req.user.sub, "auth.password.change", {});

  return res.json({ message: "Password changed successfully." });
});

app.get("/api/security/mfa-settings", requireAuth, requireActiveSession, async (req, res) => {
  const result = await db.query("SELECT mfa_enabled FROM users WHERE id = $1", [req.user.sub]);
  const row = result.rows[0];
  if (!row) {
    return res.status(404).json({ error: "User not found." });
  }
  return res.json({ enabled: Boolean(row.mfa_enabled) });
});

app.put("/api/security/mfa-settings", requireAuth, requireActiveSession, requireCsrf, async (req, res) => {
  const { enabled } = req.body || {};
  if (typeof enabled !== "boolean") {
    return res.status(400).json({ error: "Enabled must be a boolean value." });
  }

  const updated = await db.query(
    `UPDATE users
     SET mfa_enabled = $1
     WHERE id = $2
     RETURNING mfa_enabled`,
    [enabled, req.user.sub],
  );

  await audit(req.user.sub, "user.security.mfa.updated", { enabled });
  return res.json({ message: "MFA settings updated.", enabled: Boolean(updated.rows[0]?.mfa_enabled) });
});

app.post("/api/auth/logout", requireAuth, requireActiveSession, requireCsrf, async (req, res) => {
  clearSession(req.authToken);
  await audit(req.user.sub, "auth.logout", {});
  clearAuthCookies(res);
  return res.json({ message: "Logged out." });
});

app.post("/api/auth/password-reset/request", authLimiter, async (req, res) => {
  const { email } = req.body || {};
  if (!email) {
    return res.status(400).json({ error: "Email is required." });
  }

  const safeEmail = String(email).toLowerCase().trim();
  const userResult = await db.query("SELECT id, full_name FROM users WHERE email = $1", [safeEmail]);
  const user = userResult.rows[0];

  if (!user) {
    return res.json({ message: "If the account exists, reset instructions were issued." });
  }

  const rawToken = security.createRandomToken();
  const tokenHash = security.hashToken(rawToken);

  await db.query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, NOW() + INTERVAL '15 minutes')`,
    [user.id, tokenHash],
  );

  try {
    const resetUrl = `${config.frontendOrigin}/reset-confirm?token=${encodeURIComponent(rawToken)}`;
    await sendResetTokenEmail({
      to: safeEmail,
      fullName: user.full_name,
      resetUrl,
    });
  } catch (_error) {
    await db.query("DELETE FROM password_reset_tokens WHERE token_hash = $1", [tokenHash]);
    return res.status(503).json({ error: "Could not send reset instructions. Please try again." });
  }

  await audit(user.id, "auth.password_reset.request", {});
  return res.json({ message: "If the account exists, reset instructions were issued." });
});

app.post("/api/auth/password-reset/confirm", authLimiter, async (req, res) => {
  const { token, newPassword } = req.body || {};
  if (!token || !newPassword) {
    return res.status(400).json({ error: "Invalid reset payload." });
  }

  const passwordPolicyErrors = getPasswordPolicyErrors(newPassword);
  if (passwordPolicyErrors.length) {
    return res.status(400).json({
      error: `Password must include ${passwordPolicyErrors.join(", ")}.`,
    });
  }

  const tokenHash = security.hashToken(String(token));
  const resetRes = await db.query(
    `SELECT id, user_id, expires_at, consumed_at
     FROM password_reset_tokens
     WHERE token_hash = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [tokenHash],
  );

  const row = resetRes.rows[0];
  if (!row || row.consumed_at || new Date(row.expires_at) < new Date()) {
    return res.status(401).json({ error: "Invalid or expired token." });
  }

  const hash = await bcrypt.hash(String(newPassword), 12);
  await db.query("UPDATE users SET password_hash = $1 WHERE id = $2", [hash, row.user_id]);
  await db.query("UPDATE password_reset_tokens SET consumed_at = NOW() WHERE id = $1", [row.id]);
  await audit(row.user_id, "auth.password_reset.confirm", {});

  return res.json({ message: "Password updated successfully." });
});

app.get("/api/accounts/me", requireAuth, requireActiveSession, async (req, res) => {
  const accountRes = await db.query(
    `SELECT id, account_number, currency, account_type, account_status, is_primary, can_send_transfers, can_receive_transfers, balance
     FROM accounts
     WHERE user_id = $1
     ORDER BY is_primary DESC, created_at ASC`,
    [req.user.sub],
  );

  const accounts = accountRes.rows;
  const account = accounts.find((row) => row.is_primary) || accounts[0];
  if (!account) {
    return res.status(404).json({ error: "Account not found." });
  }

  const txRes = await db.query(
    `SELECT t.id, t.amount, t.status,
            CASE
              WHEN t.note_ciphertext IS NOT NULL AND $2::text IS NOT NULL
                THEN pgp_sym_decrypt(t.note_ciphertext, $2::text)
              ELSE t.note
            END AS note,
            t.created_at,
            af.account_number AS from_account,
            at.account_number AS to_account
     FROM transactions t
     JOIN accounts af ON af.id = t.from_account_id
     JOIN accounts at ON at.id = t.to_account_id
     WHERE t.from_account_id = $1 OR t.to_account_id = $1
     ORDER BY t.created_at DESC
     LIMIT 20`,
    [account.id, config.databaseEncryptionKey],
  );

  return res.json({ account, accounts, transactions: txRes.rows });
});

app.get("/api/accounts", requireAuth, requireActiveSession, async (req, res) => {
  const accountsRes = await db.query(
    `SELECT id, account_number, currency, account_type, account_status, is_primary, can_send_transfers, can_receive_transfers, balance, created_at
     FROM accounts
     WHERE user_id = $1
     ORDER BY is_primary DESC, created_at ASC`,
    [req.user.sub],
  );

  return res.json({ accounts: accountsRes.rows });
});

app.get("/api/accounts/:id", requireAuth, requireActiveSession, async (req, res) => {
  const accountRes = await db.query(
    `SELECT id, account_number, currency, account_type, account_status, is_primary, can_send_transfers, can_receive_transfers, balance, created_at
     FROM accounts
     WHERE id = $1 AND user_id = $2`,
    [req.params.id, req.user.sub],
  );

  const account = accountRes.rows[0];
  if (!account) {
    return res.status(404).json({ error: "Account not found." });
  }

  return res.json({ account });
});

app.post("/api/accounts", requireAuth, requireActiveSession, requireCsrf, async (req, res) => {
  const { accountType = "checking" } = req.body || {};
  const safeType = String(accountType || "").trim().toLowerCase();
  if (!["checking", "savings"].includes(safeType)) {
    return res.status(400).json({ error: "Invalid account type. Must be checking or savings." });
  }

  const countRes = await db.query(
    `SELECT COUNT(*)::int AS account_count
     FROM accounts
     WHERE user_id = $1 AND account_status <> 'closed'`,
    [req.user.sub],
  );

  const accountCount = Number(countRes.rows[0]?.account_count || 0);
  if (accountCount >= 5) {
    return res.status(400).json({ error: "Maximum 5 active/deactivated accounts are allowed." });
  }

  let inserted = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const accountNumber = generateAccountNumber();
      const result = await db.query(
        `INSERT INTO accounts (
            user_id,
            account_number,
            currency,
            account_type,
            balance,
            account_status,
            is_primary,
            can_send_transfers,
            can_receive_transfers
          )
         VALUES ($1, $2, 'EGP', $3, 0, 'active', FALSE, TRUE, TRUE)
         RETURNING id, account_number, currency, account_type, account_status, is_primary, can_send_transfers, can_receive_transfers, balance, created_at`,
        [req.user.sub, accountNumber, safeType],
      );
      inserted = result.rows[0];
      break;
    } catch (error) {
      if (error?.code !== "23505" || attempt === 4) {
        throw error;
      }
    }
  }

  if (!inserted) {
    return res.status(500).json({ error: "Unable to create account right now." });
  }

  await audit(req.user.sub, "user.account.created", {
    accountId: inserted.id,
    accountNumber: inserted.account_number,
    accountType: inserted.account_type,
  });

  await createUserNotification(
    req.user.sub,
    "account",
    "Account Created",
    `New ${inserted.account_type} account ${inserted.account_number} was created successfully.`,
    { accountId: inserted.id, accountNumber: inserted.account_number, accountType: inserted.account_type },
  );

  return res.status(201).json({ message: "Account created successfully.", account: inserted });
});

app.post("/api/accounts/:id/deactivate", requireAuth, requireActiveSession, requireCsrf, async (req, res) => {
  const updated = await db.query(
    `UPDATE accounts
     SET account_status = 'deactivated',
         can_send_transfers = FALSE,
         deactivated_at = NOW()
     WHERE id = $1 AND user_id = $2 AND account_status = 'active'
     RETURNING id, account_number`,
    [req.params.id, req.user.sub],
  );

  if (!updated.rows[0]) {
    return res.status(400).json({ error: "Account cannot be deactivated." });
  }

  await audit(req.user.sub, "user.account.deactivated", {
    accountId: updated.rows[0].id,
    accountNumber: updated.rows[0].account_number,
  });

  await createUserNotification(
    req.user.sub,
    "account",
    "Account Deactivated",
    `Account ${updated.rows[0].account_number} was deactivated successfully.`,
    { accountId: updated.rows[0].id, accountNumber: updated.rows[0].account_number },
  );

  return res.json({ message: "Account deactivated successfully." });
});

app.post("/api/accounts/:id/reactivate", requireAuth, requireActiveSession, requireCsrf, async (req, res) => {
  // First, deactivate any other active accounts for the user
  const otherActiveRes = await db.query(
    `UPDATE accounts
     SET account_status = 'deactivated',
         can_send_transfers = FALSE,
         deactivated_at = NOW()
     WHERE user_id = $1 AND account_status = 'active' AND id <> $2
     RETURNING id, account_number`,
    [req.user.sub, req.params.id],
  );

  // Create audit and notification for each deactivated account
  for (const deactivated of otherActiveRes.rows) {
    await audit(req.user.sub, "user.account.deactivated", {
      accountId: deactivated.id,
      accountNumber: deactivated.account_number,
    });

    await createUserNotification(
      req.user.sub,
      "account",
      "Account Deactivated",
      `Account ${deactivated.account_number} was deactivated to activate another account.`,
      { accountId: deactivated.id, accountNumber: deactivated.account_number },
    );
  }

  // Now reactivate the target account
  const updated = await db.query(
    `UPDATE accounts
     SET account_status = 'active',
         can_send_transfers = TRUE,
         can_receive_transfers = TRUE,
         deactivated_at = NULL
     WHERE id = $1 AND user_id = $2 AND account_status = 'deactivated'
     RETURNING id, account_number`,
    [req.params.id, req.user.sub],
  );

  if (!updated.rows[0]) {
    return res.status(400).json({ error: "Account cannot be reactivated." });
  }

  await audit(req.user.sub, "user.account.reactivated", {
    accountId: updated.rows[0].id,
    accountNumber: updated.rows[0].account_number,
  });

  await createUserNotification(
    req.user.sub,
    "account",
    "Account Reactivated",
    `Account ${updated.rows[0].account_number} was reactivated successfully.`,
    { accountId: updated.rows[0].id, accountNumber: updated.rows[0].account_number },
  );

  return res.json({ 
    message: "Account reactivated successfully.",
    deactivatedCount: otherActiveRes.rows.length
  });
});

app.post("/api/accounts/:id/close", requireAuth, requireActiveSession, requireCsrf, async (req, res) => {
  const accountRes = await db.query(
    `SELECT id, account_number, balance, account_status
     FROM accounts
     WHERE id = $1 AND user_id = $2`,
    [req.params.id, req.user.sub],
  );

  const account = accountRes.rows[0];
  if (!account) {
    return res.status(404).json({ error: "Account not found." });
  }

  if (account.account_status === "closed") {
    return res.status(400).json({ error: "Account is already closed." });
  }

  if (Number(account.balance) !== 0) {
    return res.status(400).json({ error: "Account balance must be zero before closure." });
  }

  await db.query(
    `UPDATE accounts
     SET account_status = 'closed',
         can_send_transfers = FALSE,
         can_receive_transfers = FALSE,
         closed_at = NOW(),
         is_primary = FALSE
     WHERE id = $1`,
    [account.id],
  );

  const primaryCount = await db.query(
    `SELECT COUNT(*)::int AS active_primary_count
     FROM accounts
     WHERE user_id = $1 AND is_primary = TRUE AND account_status = 'active'`,
    [req.user.sub],
  );

  if (Number(primaryCount.rows[0]?.active_primary_count || 0) === 0) {
    const fallback = await db.query(
      `SELECT id
       FROM accounts
       WHERE user_id = $1 AND account_status = 'active'
       ORDER BY created_at ASC
       LIMIT 1`,
      [req.user.sub],
    );
    if (fallback.rows[0]) {
      await db.query("UPDATE accounts SET is_primary = TRUE WHERE id = $1", [fallback.rows[0].id]);
    }
  }

  await audit(req.user.sub, "user.account.closed", {
    accountId: account.id,
    accountNumber: account.account_number,
  });

  await createUserNotification(
    req.user.sub,
    "account",
    "Account Closed",
    `Account ${account.account_number} has been closed.`,
    { accountId: account.id, accountNumber: account.account_number },
  );

  return res.json({ message: "Account closed successfully." });
});

app.get("/api/beneficiaries", requireAuth, requireActiveSession, async (req, res) => {
  const rows = await db.query(
    `SELECT id, nickname, account_number, created_at
     FROM beneficiaries
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [req.user.sub],
  );

  return res.json({ beneficiaries: rows.rows });
});

app.post("/api/beneficiaries", requireAuth, requireActiveSession, requireCsrf, async (req, res) => {
  const { nickname, accountNumber } = req.body || {};
  const safeNickname = String(nickname || "").trim();
  const safeAccountNumber = String(accountNumber || "").trim();

  if (!safeNickname || safeNickname.length < 2) {
    return res.status(400).json({ error: "Nickname must be at least 2 characters." });
  }

  if (!safeAccountNumber || safeAccountNumber.length < 5) {
    return res.status(400).json({ error: "Account number is invalid." });
  }

  const targetAccount = await db.query(
    `SELECT id FROM accounts WHERE account_number = $1`,
    [safeAccountNumber],
  );

  if (!targetAccount.rows[0]) {
    return res.status(404).json({ error: "Destination account not found." });
  }

  const ownAccount = await db.query(
    `SELECT id FROM accounts WHERE user_id = $1 AND account_number = $2`,
    [req.user.sub, safeAccountNumber],
  );

  if (ownAccount.rows[0]) {
    return res.status(400).json({ error: "Use own-account transfer instead of adding your own account as beneficiary." });
  }

  try {
    const inserted = await db.query(
      `INSERT INTO beneficiaries (user_id, nickname, account_number)
       VALUES ($1, $2, $3)
       RETURNING id, nickname, account_number, created_at`,
      [req.user.sub, safeNickname, safeAccountNumber],
    );
    await audit(req.user.sub, "user.beneficiary.created", { accountNumber: safeAccountNumber });
    return res.status(201).json({ message: "Beneficiary saved.", beneficiary: inserted.rows[0] });
  } catch (error) {
    if (String(error.message || "").includes("beneficiaries_user_id_account_number_key")) {
      return res.status(409).json({ error: "Beneficiary already exists." });
    }
    return res.status(500).json({ error: "Failed to save beneficiary." });
  }
});

app.delete("/api/beneficiaries/:id", requireAuth, requireActiveSession, requireCsrf, async (req, res) => {
  const deleted = await db.query(
    `DELETE FROM beneficiaries
     WHERE id = $1 AND user_id = $2
     RETURNING id`,
    [req.params.id, req.user.sub],
  );

  if (!deleted.rows[0]) {
    return res.status(404).json({ error: "Beneficiary not found." });
  }

  await audit(req.user.sub, "user.beneficiary.deleted", { beneficiaryId: req.params.id });
  return res.json({ message: "Beneficiary removed." });
});

app.post("/api/support/tickets", requireAuth, requireActiveSession, requireCsrf, async (req, res) => {
  const { subject, message } = req.body || {};
  const safeSubject = String(subject || "").trim();
  const safeMessage = String(message || "").trim();

  if (!safeSubject || safeSubject.length < 5) {
    return res.status(400).json({ error: "Subject must be at least 5 characters." });
  }

  if (!safeMessage || safeMessage.length < 10) {
    return res.status(400).json({ error: "Message must be at least 10 characters." });
  }

  const inserted = await db.query(
    `INSERT INTO support_tickets (user_id, subject, message)
     VALUES ($1, $2, $3)
     RETURNING id, subject, message, status, created_at, updated_at`,
    [req.user.sub, safeSubject, safeMessage],
  );

  await audit(req.user.sub, "user.support.ticket.created", { ticketId: inserted.rows[0].id });
  await createUserNotification(
    req.user.sub,
    "support",
    "Support Ticket Created",
    `Your ticket \"${inserted.rows[0].subject}\" was submitted successfully.`,
    { ticketId: inserted.rows[0].id },
  );
  return res.status(201).json({ message: "Support ticket created.", ticket: inserted.rows[0] });
});

app.get("/api/support/tickets", requireAuth, requireActiveSession, async (req, res) => {
  const rows = await db.query(
    `SELECT id, subject, message, status, created_at, updated_at
     FROM support_tickets
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [req.user.sub],
  );

  return res.json({ tickets: rows.rows });
});

app.get("/api/cards", requireAuth, requireActiveSession, async (req, res) => {
  const rows = await db.query(
    `SELECT id, account_id, card_type, card_last4, status, is_frozen, is_reported_lost,
            external_provider, provider_ref, provider_status, provider_error_code, provider_error_message, provider_last_synced_at,
            created_at, updated_at
     FROM cards
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [req.user.sub],
  );
  return res.json({ cards: rows.rows });
});

app.post("/api/cards/request", requireAuth, requireActiveSession, requireCsrf, async (req, res) => {
  const { accountId, cardType } = req.body || {};
  const safeType = String(cardType || "debit").trim().toLowerCase();
  if (!["debit", "virtual", "credit"].includes(safeType)) {
    return res.status(400).json({ error: "Invalid card type." });
  }

  let safeAccountId = null;
  if (accountId) {
    const accountCheck = await db.query(
      `SELECT id FROM accounts WHERE id = $1 AND user_id = $2`,
      [accountId, req.user.sub],
    );
    if (!accountCheck.rows[0]) {
      return res.status(404).json({ error: "Account not found." });
    }
    safeAccountId = accountId;
  }

  const providerResult = await submitCardToProvider({
    userId: req.user.sub,
    accountId: safeAccountId,
    cardType: safeType,
  });

  const inserted = await db.query(
    `INSERT INTO cards (
        user_id, account_id, card_type, card_last4, status,
        external_provider, provider_ref, provider_status, provider_error_code, provider_error_message, provider_last_synced_at
      )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING id, account_id, card_type, card_last4, status, is_frozen, is_reported_lost,
               external_provider, provider_ref, provider_status, provider_error_code, provider_error_message, provider_last_synced_at,
               created_at, updated_at`,
    [
      req.user.sub,
      safeAccountId,
      safeType,
      generateCardLast4(),
      mapProviderCardStatusToInternal(providerResult.providerStatus),
      providerResult.externalProvider,
      providerResult.providerRef,
      providerResult.providerStatus,
      providerResult.providerErrorCode,
      providerResult.providerErrorMessage,
      providerResult.providerLastSyncedAt,
    ],
  );

  await audit(req.user.sub, "user.card.requested", { cardId: inserted.rows[0].id, cardType: safeType });
  return res.status(201).json({ message: "Card request submitted.", card: inserted.rows[0] });
});

app.post("/api/cards/:id/freeze", requireAuth, requireActiveSession, requireCsrf, async (req, res) => {
  const updated = await db.query(
    `UPDATE cards
     SET is_frozen = TRUE,
         status = 'frozen',
         updated_at = NOW()
     WHERE id = $1
       AND user_id = $2
       AND is_reported_lost = FALSE
       AND status = 'active'
       AND is_frozen = FALSE
     RETURNING id`,
    [req.params.id, req.user.sub],
  );

  if (!updated.rows[0]) {
    return res.status(404).json({ error: "Card not found or cannot be frozen." });
  }
  await audit(req.user.sub, "user.card.frozen", { cardId: req.params.id });
  return res.json({ message: "Card frozen." });
});

app.post("/api/cards/:id/unfreeze", requireAuth, requireActiveSession, requireCsrf, async (req, res) => {
  const updated = await db.query(
    `UPDATE cards
     SET is_frozen = FALSE,
         status = 'active',
         updated_at = NOW()
     WHERE id = $1
       AND user_id = $2
       AND is_reported_lost = FALSE
       AND status = 'frozen'
       AND is_frozen = TRUE
     RETURNING id`,
    [req.params.id, req.user.sub],
  );

  if (!updated.rows[0]) {
    return res.status(404).json({ error: "Card not found or cannot be unfrozen." });
  }
  await audit(req.user.sub, "user.card.unfrozen", { cardId: req.params.id });
  return res.json({ message: "Card unfrozen." });
});

app.post("/api/cards/:id/report-lost", requireAuth, requireActiveSession, requireCsrf, async (req, res) => {
  const updated = await db.query(
    `UPDATE cards
     SET is_reported_lost = TRUE,
         is_frozen = TRUE,
         status = 'lost',
         updated_at = NOW()
     WHERE id = $1 AND user_id = $2 AND is_reported_lost = FALSE
     RETURNING id`,
    [req.params.id, req.user.sub],
  );

  if (!updated.rows[0]) {
    return res.status(404).json({ error: "Card not found or already reported lost." });
  }
  await audit(req.user.sub, "user.card.reported_lost", { cardId: req.params.id });
  return res.json({ message: "Card reported as lost." });
});

app.post("/api/cards/:id/retry", requireAuth, requireActiveSession, requireCsrf, async (req, res) => {
  const cardRes = await db.query(
    `SELECT id, account_id, card_type, status, provider_status, is_reported_lost
     FROM cards
     WHERE id = $1 AND user_id = $2`,
    [req.params.id, req.user.sub],
  );

  const card = cardRes.rows[0];
  if (!card) {
    return res.status(404).json({ error: "Card not found." });
  }

  if (card.is_reported_lost) {
    return res.status(400).json({ error: "Lost cards cannot be retried." });
  }

  if (card.provider_status !== "failed") {
    return res.status(400).json({ error: "Only failed provider card requests can be retried." });
  }

  if (card.status !== "disabled") {
    return res.status(400).json({ error: "Only disabled cards can be retried." });
  }

  const providerResult = await submitCardToProvider({
    userId: req.user.sub,
    accountId: card.account_id,
    cardType: card.card_type,
  });

  const updated = await db.query(
    `UPDATE cards
     SET status = $1,
         external_provider = $2,
         provider_ref = $3,
         provider_status = $4,
         provider_error_code = $5,
         provider_error_message = $6,
         provider_last_synced_at = $7,
         updated_at = NOW()
     WHERE id = $8 AND user_id = $9
     RETURNING id, account_id, card_type, card_last4, status, is_frozen, is_reported_lost,
               external_provider, provider_ref, provider_status, provider_error_code, provider_error_message, provider_last_synced_at,
               created_at, updated_at`,
    [
      mapProviderCardStatusToInternal(providerResult.providerStatus),
      providerResult.externalProvider,
      providerResult.providerRef,
      providerResult.providerStatus,
      providerResult.providerErrorCode,
      providerResult.providerErrorMessage,
      providerResult.providerLastSyncedAt,
      req.params.id,
      req.user.sub,
    ],
  );

  await audit(req.user.sub, "user.card.retry_requested", {
    cardId: req.params.id,
    providerStatus: providerResult.providerStatus,
  });
  return res.json({ message: "Card request retried.", card: updated.rows[0] });
});

app.post("/api/transfers", requireAuth, requireActiveSession, requireCsrf, async (req, res) => {
  const { fromAccountId, toAccountNumber, amount, note } = req.body || {};
  const transferAmount = Number(amount);

  if (!toAccountNumber || Number.isNaN(transferAmount) || transferAmount <= 0) {
    return res.status(400).json({ error: "Invalid transfer payload." });
  }

  if (transferAmount > config.perTransferCap) {
    return res.status(400).json({ error: `Amount exceeds per-transfer cap (${config.perTransferCap}).` });
  }

  const client = await db.pool.connect();

  try {
    await client.query("BEGIN");

    const fromRes = fromAccountId
      ? await client.query(
        `SELECT id, account_number, balance, account_status, can_send_transfers
         FROM accounts
         WHERE user_id = $1 AND id = $2
         FOR UPDATE`,
        [req.user.sub, fromAccountId],
      )
      : await client.query(
        `SELECT id, account_number, balance, account_status, can_send_transfers
         FROM accounts
         WHERE user_id = $1
         ORDER BY is_primary DESC, created_at ASC
         LIMIT 1
         FOR UPDATE`,
        [req.user.sub],
      );
    const from = fromRes.rows[0];

    const toRes = await client.query(
      `SELECT id, account_number, account_status, can_receive_transfers FROM accounts WHERE account_number = $1 FOR UPDATE`,
      [String(toAccountNumber).trim()],
    );
    const to = toRes.rows[0];

    if (!from || !to) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Source or destination account not found." });
    }

    if (from.id === to.id) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Cannot transfer to the same account." });
    }

    if (from.account_status !== "active" || from.can_send_transfers !== true) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Source account is not allowed to send transfers." });
    }

    if (to.account_status !== "active" || to.can_receive_transfers !== true) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Destination account cannot receive transfers." });
    }

    const dailyTotalRes = await client.query(
      `SELECT COALESCE(SUM(amount), 0) AS daily_total
       FROM transactions
       WHERE from_account_id = $1 AND created_at >= NOW() - INTERVAL '24 hours'`,
      [from.id],
    );

    const hourlyCountRes = await client.query(
      `SELECT COUNT(*)::int AS hourly_count
       FROM transactions
       WHERE from_account_id = $1 AND created_at >= NOW() - INTERVAL '1 hour'`,
      [from.id],
    );

    const currentDailyTotal = Number(dailyTotalRes.rows[0].daily_total || 0);
    const hourlyCount = Number(hourlyCountRes.rows[0].hourly_count || 0);

    if (currentDailyTotal + transferAmount > config.dailyTransferCap) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: `Daily transfer cap reached (${config.dailyTransferCap}).` });
    }

    if (hourlyCount >= config.hourlyTransferCapCount) {
      await client.query("ROLLBACK");
      return res.status(429).json({ error: `Hourly transfer count cap reached (${config.hourlyTransferCapCount}).` });
    }

    if (Number(from.balance) < transferAmount) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Insufficient balance." });
    }

    await client.query("UPDATE accounts SET balance = balance - $1 WHERE id = $2", [transferAmount, from.id]);
    await client.query("UPDATE accounts SET balance = balance + $1 WHERE id = $2", [transferAmount, to.id]);

    await client.query(
      `INSERT INTO transactions (from_account_id, to_account_id, amount, note, note_ciphertext)
       VALUES (
         $1,
         $2,
         $3,
         NULL,
         CASE
           WHEN $4::text IS NULL THEN NULL
           ELSE pgp_sym_encrypt($4::text, $5::text)
         END
       )`,
      [from.id, to.id, transferAmount, note || null, config.databaseEncryptionKey],
    );

    await client.query("COMMIT");
  } catch (_error) {
    await client.query("ROLLBACK");
    return res.status(500).json({ error: "Transfer failed." });
  } finally {
    client.release();
  }

  await audit(req.user.sub, "bank.transfer.created", {
    fromAccountId: fromAccountId || null,
    toAccountNumber: String(toAccountNumber).trim(),
    amount: transferAmount,
  });

  await createUserNotification(
    req.user.sub,
    "transfer",
    "Transfer Completed",
    `Transfer of ${transferAmount} EGP to ${String(toAccountNumber).trim()} completed.`,
    { fromAccountId: fromAccountId || null, toAccountNumber: String(toAccountNumber).trim(), amount: transferAmount },
  );

  return res.status(201).json({ message: "Transfer simulated successfully." });
});

app.get("/api/statements/transactions", requireAuth, requireActiveSession, async (req, res) => {
  const accountId = String(req.query.accountId || "").trim();
  const fromDate = req.query.from ? new Date(String(req.query.from)) : null;
  const toDate = req.query.to ? new Date(String(req.query.to)) : null;

  if (!accountId) {
    return res.status(400).json({ error: "accountId is required." });
  }

  if ((fromDate && Number.isNaN(fromDate.getTime())) || (toDate && Number.isNaN(toDate.getTime()))) {
    return res.status(400).json({ error: "Invalid date filter." });
  }

  const { account, rows } = await fetchStatementRows(accountId, req.user.sub, fromDate, toDate);
  if (!account) {
    return res.status(404).json({ error: "Account not found." });
  }

  let totalDebits = 0;
  let totalCredits = 0;
  for (const row of rows) {
    const amount = Number(row.amount || 0);
    if (row.from_account === account.account_number) {
      totalDebits += amount;
    }
    if (row.to_account === account.account_number) {
      totalCredits += amount;
    }
  }

  return res.json({
    account,
    summary: {
      transactionCount: rows.length,
      totalDebits,
      totalCredits,
      netFlow: totalCredits - totalDebits,
    },
    transactions: rows,
  });
});

app.get("/api/statements/transactions.csv", requireAuth, requireActiveSession, async (req, res) => {
  const accountId = String(req.query.accountId || "").trim();
  const fromDate = req.query.from ? new Date(String(req.query.from)) : null;
  const toDate = req.query.to ? new Date(String(req.query.to)) : null;

  if (!accountId) {
    return res.status(400).json({ error: "accountId is required." });
  }

  if ((fromDate && Number.isNaN(fromDate.getTime())) || (toDate && Number.isNaN(toDate.getTime()))) {
    return res.status(400).json({ error: "Invalid date filter." });
  }

  const { account, rows } = await fetchStatementRows(accountId, req.user.sub, fromDate, toDate);
  if (!account) {
    return res.status(404).json({ error: "Account not found." });
  }

  const header = ["id", "created_at", "from_account", "to_account", "amount", "status", "note"];
  const csvRows = [header.map(csvEscape).join(",")];

  for (const row of rows) {
    csvRows.push(
      [
        row.id,
        row.created_at,
        row.from_account,
        row.to_account,
        row.amount,
        row.status,
        row.note || "",
      ]
        .map(csvEscape)
        .join(","),
    );
  }

  const fileName = `transactions-${account.account_number}-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.csv`;
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename=\"${fileName}\"`);
  return res.send(csvRows.join("\n"));
});

app.post("/api/loans/apply", requireAuth, requireActiveSession, requireCsrf, async (req, res) => {
  const { amount, termMonths, purpose, targetAccountId, requestedInterestRate = 0 } = req.body || {};
  const safePurpose = String(purpose || "").trim();

  if (!isValidLoanAmount(amount) || !isValidLoanTerm(termMonths) || !isValidLoanRate(requestedInterestRate)) {
    return res.status(400).json({ error: "Invalid loan payload." });
  }

  if (!targetAccountId || safePurpose.length < 8 || safePurpose.length > 300) {
    return res.status(400).json({ error: "Please provide a valid target account and purpose (8-300 chars)." });
  }

  const accountRes = await db.query(
    `SELECT id, account_number, account_status
     FROM accounts
     WHERE id = $1 AND user_id = $2`,
    [targetAccountId, req.user.sub],
  );
  const targetAccount = accountRes.rows[0];
  if (!targetAccount) {
    return res.status(404).json({ error: "Target account not found." });
  }
  if (targetAccount.account_status !== "active") {
    return res.status(400).json({ error: "Target account must be active." });
  }

  const schedule = buildLoanRepaymentSchedule(Number(amount), Number(requestedInterestRate), Number(termMonths));

  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    const inserted = await client.query(
      `INSERT INTO loans (
        user_id,
        target_account_id,
        amount,
        requested_term_months,
        requested_interest_rate,
        purpose,
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'pending')
      RETURNING id, amount, requested_term_months, requested_interest_rate, purpose, status, applied_at`,
      [req.user.sub, targetAccount.id, Number(amount), Number(termMonths), Number(requestedInterestRate), safePurpose],
    );
    const loan = inserted.rows[0];

    for (const item of schedule) {
      await client.query(
        `INSERT INTO loan_repayments (loan_id, installment_number, due_date, amount, status)
         VALUES ($1, $2, $3, $4, 'due')`,
        [loan.id, item.installmentNumber, item.dueDate, item.amount],
      );
    }

    await client.query("COMMIT");

    await audit(req.user.sub, "user.loan.applied", {
      loanId: loan.id,
      amount: Number(amount),
      termMonths: Number(termMonths),
      targetAccountId: targetAccount.id,
    });

    await createUserNotification(
      req.user.sub,
      "payment",
      "Loan Application Submitted",
      `Your loan request for ${Number(amount).toFixed(2)} EGP was submitted and is pending review.`,
      { loanId: loan.id, amount: Number(amount), termMonths: Number(termMonths) },
    );

    return res.status(201).json({
      message: "Loan application submitted successfully.",
      loan,
    });
  } catch (_error) {
    await client.query("ROLLBACK");
    return res.status(500).json({ error: "Could not submit loan application." });
  } finally {
    client.release();
  }
});

app.get("/api/loans/me", requireAuth, requireActiveSession, async (req, res) => {
  const rows = await db.query(
    `SELECT l.id,
            l.amount,
            l.requested_term_months,
            l.approved_term_months,
            l.requested_interest_rate,
            l.approved_interest_rate,
            l.purpose,
            l.status,
            l.applied_at,
            l.decided_at,
            l.disbursed_at,
            a.account_number AS target_account_number
     FROM loans l
     JOIN accounts a ON a.id = l.target_account_id
     WHERE l.user_id = $1
     ORDER BY l.created_at DESC`,
    [req.user.sub],
  );

  return res.json({ loans: rows.rows });
});

app.get("/api/loans/:id", requireAuth, requireActiveSession, async (req, res) => {
  const loanRes = await db.query(
    `SELECT l.*, a.account_number AS target_account_number
     FROM loans l
     JOIN accounts a ON a.id = l.target_account_id
     WHERE l.id = $1 AND l.user_id = $2`,
    [req.params.id, req.user.sub],
  );
  const loan = loanRes.rows[0];
  if (!loan) {
    return res.status(404).json({ error: "Loan not found." });
  }

  const repaymentsRes = await db.query(
    `SELECT id, installment_number, due_date, amount, status, paid_at
     FROM loan_repayments
     WHERE loan_id = $1
     ORDER BY installment_number ASC`,
    [loan.id],
  );

  return res.json({ loan, repayments: repaymentsRes.rows });
});

app.get("/api/admin/loans", requireAuth, requireActiveSession, requireRole("admin"), async (req, res) => {
  const params = [];
  const where = [];

  const status = String(req.query.status || "").trim().toLowerCase();
  if (["pending", "approved", "rejected", "disbursed", "repaid"].includes(status)) {
    params.push(status);
    where.push(`l.status = $${params.length}`);
  }

  const search = String(req.query.search || "").trim();
  if (search) {
    params.push(`%${search}%`);
    where.push(`(u.full_name ILIKE $${params.length} OR u.email ILIKE $${params.length})`);
  }

  const requestedLimit = Number(req.query.limit || 50);
  const limit = Number.isNaN(requestedLimit) ? 50 : Math.min(Math.max(requestedLimit, 1), 200);
  const requestedOffset = Number(req.query.offset || 0);
  const offset = Number.isNaN(requestedOffset) ? 0 : Math.max(requestedOffset, 0);

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  params.push(limit, offset);

  const rows = await db.query(
    `SELECT l.id,
            l.user_id,
            u.full_name,
            u.email,
            l.amount,
            l.requested_term_months,
            l.approved_term_months,
            l.requested_interest_rate,
            l.approved_interest_rate,
            l.purpose,
            l.status,
            l.applied_at,
            l.decided_at,
            l.disbursed_at,
            l.rejection_reason,
            l.target_account_id,
            a.account_number AS target_account_number
     FROM loans l
     JOIN users u ON u.id = l.user_id
     JOIN accounts a ON a.id = l.target_account_id
     ${whereSql}
     ORDER BY l.created_at DESC
     LIMIT $${params.length - 1}
     OFFSET $${params.length}`,
    params,
  );

  const countParams = params.slice(0, params.length - 2);
  const count = await db.query(
    `SELECT COUNT(*)::int AS total
     FROM loans l
     JOIN users u ON u.id = l.user_id
     ${whereSql}`,
    countParams,
  );

  return res.json({
    loans: rows.rows,
    pagination: {
      total: Number(count.rows[0]?.total || 0),
      limit,
      offset,
      hasNext: offset + limit < Number(count.rows[0]?.total || 0),
      hasPrevious: offset > 0,
    },
  });
});

app.post("/api/admin/loans/:id/approve", requireAuth, requireActiveSession, requireRole("admin"), requireCsrf, async (req, res) => {
  const { approvedTermMonths, approvedInterestRate } = req.body || {};
  if (approvedTermMonths != null && !isValidLoanTerm(approvedTermMonths)) {
    return res.status(400).json({ error: "Approved term must be between 6 and 60 months." });
  }
  if (approvedInterestRate != null && !isValidLoanRate(approvedInterestRate)) {
    return res.status(400).json({ error: "Approved interest rate must be between 0 and 36." });
  }

  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    const loanRes = await client.query(
      `SELECT id, user_id, target_account_id, amount, requested_term_months, requested_interest_rate, status
       FROM loans
       WHERE id = $1
       FOR UPDATE`,
      [req.params.id],
    );
    const loan = loanRes.rows[0];
    if (!loan) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Loan not found." });
    }
    if (loan.status !== "pending") {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Only pending loans can be approved." });
    }

    const finalTerm = approvedTermMonths != null ? Number(approvedTermMonths) : Number(loan.requested_term_months);
    const finalRate = approvedInterestRate != null ? Number(approvedInterestRate) : Number(loan.requested_interest_rate);

    const accountRes = await client.query(
      `SELECT id, account_number, account_status
       FROM accounts
       WHERE id = $1 AND user_id = $2
       FOR UPDATE`,
      [loan.target_account_id, loan.user_id],
    );
    const targetAccount = accountRes.rows[0];
    if (!targetAccount || targetAccount.account_status !== "active") {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Target account is not active." });
    }

    const sourceAccountRes = await client.query(
      `SELECT id, account_number, balance
       FROM accounts
       WHERE user_id = $1 AND account_status = 'active' AND id <> $2
       ORDER BY is_primary DESC, created_at ASC
       LIMIT 1
       FOR UPDATE`,
      [req.user.sub, targetAccount.id],
    );
    const sourceAccount = sourceAccountRes.rows[0];
    if (!sourceAccount) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "No active admin funding account available for disbursement." });
    }

    if (Number(sourceAccount.balance || 0) < Number(loan.amount)) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Admin funding account has insufficient balance for disbursement." });
    }

    await client.query(
      `UPDATE accounts
       SET balance = balance - $1
       WHERE id = $2`,
      [Number(loan.amount), sourceAccount.id],
    );

    await client.query(
      `UPDATE accounts
       SET balance = balance + $1
       WHERE id = $2`,
      [Number(loan.amount), targetAccount.id],
    );

    const disbursementNote = `Loan disbursement for loan ${loan.id}`;
    const disbursementTxRes = await client.query(
      `INSERT INTO transactions (from_account_id, to_account_id, amount, status, note, note_ciphertext)
       VALUES (
         $1,
         $2,
         $3,
         'completed',
         NULL,
         pgp_sym_encrypt($4::text, $5::text)
       )
       RETURNING id`,
      [sourceAccount.id, targetAccount.id, Number(loan.amount), disbursementNote, config.databaseEncryptionKey],
    );

    await client.query(
      `UPDATE loans
       SET status = 'disbursed',
           approved_term_months = $1,
           approved_interest_rate = $2,
           approved_by = $3,
           decided_at = NOW(),
           disbursed_at = NOW(),
           updated_at = NOW()
       WHERE id = $4`,
      [finalTerm, finalRate, req.user.sub, loan.id],
    );

    await client.query(
      `INSERT INTO loan_decisions (loan_id, admin_id, decision, approved_term_months, approved_interest_rate)
       VALUES ($1, $2, 'approved', $3, $4)`,
      [loan.id, req.user.sub, finalTerm, finalRate],
    );

    await client.query("DELETE FROM loan_repayments WHERE loan_id = $1", [loan.id]);
    const schedule = buildLoanRepaymentSchedule(Number(loan.amount), finalRate, finalTerm);
    for (const item of schedule) {
      await client.query(
        `INSERT INTO loan_repayments (loan_id, installment_number, due_date, amount, status)
         VALUES ($1, $2, $3, $4, 'due')`,
        [loan.id, item.installmentNumber, item.dueDate, item.amount],
      );
    }

    await client.query("COMMIT");

    await audit(req.user.sub, "admin.loan.approved", {
      loanId: loan.id,
      disbursementTransactionId: disbursementTxRes.rows[0]?.id,
      targetUserId: loan.user_id,
      amount: Number(loan.amount),
      termMonths: finalTerm,
      interestRate: finalRate,
      sourceAccountId: sourceAccount.id,
      targetAccountId: loan.target_account_id,
    });

    await createUserNotification(
      loan.user_id,
      "payment",
      "Loan Approved and Disbursed",
      `Your loan was approved and ${Number(loan.amount).toFixed(2)} EGP was added to account ${targetAccount.account_number}.`,
      {
        loanId: loan.id,
        transactionId: disbursementTxRes.rows[0]?.id,
        amount: Number(loan.amount),
        sourceAccountId: sourceAccount.id,
        targetAccountId: loan.target_account_id,
        termMonths: finalTerm,
        interestRate: finalRate,
      },
    );

    return res.json({ message: "Loan approved and disbursed." });
  } catch (_error) {
    await client.query("ROLLBACK");
    return res.status(500).json({ error: "Failed to approve loan." });
  } finally {
    client.release();
  }
});

app.post("/api/admin/loans/:id/reject", requireAuth, requireActiveSession, requireRole("admin"), requireCsrf, async (req, res) => {
  const reason = String(req.body?.reason || "").trim();
  if (!reason || reason.length < 3 || reason.length > 300) {
    return res.status(400).json({ error: "Rejection reason must be between 3 and 300 characters." });
  }

  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    const loanRes = await client.query(
      `SELECT id, user_id, amount, status
       FROM loans
       WHERE id = $1
       FOR UPDATE`,
      [req.params.id],
    );
    const loan = loanRes.rows[0];
    if (!loan) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Loan not found." });
    }
    if (loan.status !== "pending") {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Only pending loans can be rejected." });
    }

    await client.query(
      `UPDATE loans
       SET status = 'rejected',
           approved_by = $1,
           decided_at = NOW(),
           rejection_reason = $2,
           updated_at = NOW()
       WHERE id = $3`,
      [req.user.sub, reason, loan.id],
    );

    await client.query(
      `INSERT INTO loan_decisions (loan_id, admin_id, decision, reason)
       VALUES ($1, $2, 'rejected', $3)`,
      [loan.id, req.user.sub, reason],
    );

    await client.query("COMMIT");

    await audit(req.user.sub, "admin.loan.rejected", {
      loanId: loan.id,
      targetUserId: loan.user_id,
      reason,
    });

    await createUserNotification(
      loan.user_id,
      "payment",
      "Loan Application Rejected",
      `Your loan application was rejected. Reason: ${reason}`,
      { loanId: loan.id, reason },
    );

    return res.json({ message: "Loan rejected." });
  } catch (_error) {
    await client.query("ROLLBACK");
    return res.status(500).json({ error: "Failed to reject loan." });
  } finally {
    client.release();
  }
});

app.get("/api/admin/users", requireAuth, requireActiveSession, requireRole("admin"), async (req, res) => {
  const where = [];
  const params = [];

  const search = String(req.query.search || "").trim();
  if (search) {
    params.push(`%${search}%`);
    where.push(`(u.full_name ILIKE $${params.length} OR u.email ILIKE $${params.length})`);
  }

  const accountStatus = String(req.query.accountStatus || "").trim().toLowerCase();
  if (["active", "deactivated", "closed"].includes(accountStatus)) {
    params.push(accountStatus);
    where.push(`u.account_status = $${params.length}`);
  }

  const requestedLimit = Number(req.query.limit || 50);
  const limit = Number.isNaN(requestedLimit) ? 50 : Math.min(Math.max(requestedLimit, 1), 200);
  const requestedOffset = Number(req.query.offset || 0);
  const offset = Number.isNaN(requestedOffset) ? 0 : Math.max(requestedOffset, 0);

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  params.push(limit, offset);

  const rows = await db.query(
    `SELECT u.id,
            u.full_name,
            u.email,
            u.role,
            u.account_status,
            u.mfa_enabled,
            u.created_at,
            COALESCE(a.account_count, 0)::int AS account_count,
            COALESCE(c.card_count, 0)::int AS card_count
     FROM users u
     LEFT JOIN (
       SELECT user_id, COUNT(*)::int AS account_count
       FROM accounts
       GROUP BY user_id
     ) a ON a.user_id = u.id
     LEFT JOIN (
       SELECT user_id, COUNT(*)::int AS card_count
       FROM cards
       GROUP BY user_id
     ) c ON c.user_id = u.id
     ${whereSql}
     ORDER BY u.created_at DESC
     LIMIT $${params.length - 1}
     OFFSET $${params.length}`,
    params,
  );

  const countParams = params.slice(0, params.length - 2);
  const count = await db.query(
    `SELECT COUNT(*)::int AS total
     FROM users u
     ${whereSql}`,
    countParams,
  );

  return res.json({
    users: rows.rows,
    pagination: {
      total: Number(count.rows[0]?.total || 0),
      limit,
      offset,
      hasNext: offset + limit < Number(count.rows[0]?.total || 0),
      hasPrevious: offset > 0,
    },
  });
});

app.get("/api/admin/users/:id", requireAuth, requireActiveSession, requireRole("admin"), async (req, res) => {
  const userRes = await db.query(
    `SELECT id, full_name, email, role, phone_number, mfa_enabled, account_status, created_at
     FROM users
     WHERE id = $1`,
    [req.params.id],
  );
  const user = userRes.rows[0];
  if (!user) {
    return res.status(404).json({ error: "User not found." });
  }

  const [accountsRes, cardsRes, txRes, activityRes] = await Promise.all([
    db.query(
      `SELECT id, account_number, currency, account_type, account_status, is_primary, can_send_transfers, can_receive_transfers, balance, created_at
       FROM accounts
       WHERE user_id = $1
       ORDER BY is_primary DESC, created_at ASC`,
      [req.params.id],
    ),
    db.query(
      `SELECT id, account_id, card_type, card_last4, status, is_frozen, is_reported_lost,
              external_provider, provider_ref, provider_status, provider_error_message, created_at, updated_at
       FROM cards
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.params.id],
    ),
    db.query(
      `SELECT t.id, t.amount, t.status, t.created_at,
              af.account_number AS from_account,
              at.account_number AS to_account
       FROM transactions t
       JOIN accounts af ON af.id = t.from_account_id
       JOIN accounts at ON at.id = t.to_account_id
       WHERE af.user_id = $1 OR at.user_id = $1
       ORDER BY t.created_at DESC
       LIMIT 100`,
      [req.params.id],
    ),
    db.query(
      `SELECT id, event_type, metadata, created_at
       FROM audit_logs
       WHERE actor_user_id = $1
       ORDER BY created_at DESC
       LIMIT 100`,
      [req.params.id],
    ),
  ]);

  return res.json({
    user,
    accounts: accountsRes.rows,
    cards: cardsRes.rows,
    transactions: txRes.rows,
    activity: activityRes.rows,
  });
});

app.post("/api/admin/users/:id/deactivate", requireAuth, requireActiveSession, requireRole("admin"), requireCsrf, async (req, res) => {
  if (req.params.id === req.user.sub) {
    return res.status(400).json({ error: "Admin cannot deactivate own account." });
  }

  const updated = await db.query(
    `UPDATE users
     SET account_status = 'deactivated'
     WHERE id = $1 AND account_status <> 'deactivated'
     RETURNING id, email`,
    [req.params.id],
  );

  if (!updated.rows[0]) {
    return res.status(404).json({ error: "User not found or already deactivated." });
  }

  await audit(req.user.sub, "admin.user.deactivated", { targetUserId: req.params.id });
  await createUserNotification(
    req.params.id,
    "security",
    "Account Deactivated by Admin",
    "Your account was deactivated by an administrator.",
    { adminUserId: req.user.sub },
  );

  return res.json({ message: "User account deactivated." });
});

app.post("/api/admin/users/:id/reactivate", requireAuth, requireActiveSession, requireRole("admin"), requireCsrf, async (req, res) => {
  const updated = await db.query(
    `UPDATE users
     SET account_status = 'active',
         is_locked = FALSE,
         locked_until = NULL,
         failed_login_attempts = 0
     WHERE id = $1 AND account_status <> 'active'
     RETURNING id, email`,
    [req.params.id],
  );

  if (!updated.rows[0]) {
    return res.status(404).json({ error: "User not found or already active." });
  }

  await audit(req.user.sub, "admin.user.reactivated", { targetUserId: req.params.id });
  await createUserNotification(
    req.params.id,
    "security",
    "Account Reactivated by Admin",
    "Your account was reactivated by an administrator.",
    { adminUserId: req.user.sub },
  );

  return res.json({ message: "User account reactivated." });
});

app.post("/api/admin/users/:id/reset-password", requireAuth, requireActiveSession, requireRole("admin"), requireCsrf, async (req, res) => {
  const target = await db.query("SELECT id FROM users WHERE id = $1", [req.params.id]);
  if (!target.rows[0]) {
    return res.status(404).json({ error: "User not found." });
  }

  const temporaryPassword = `Tmp-${security.createRandomToken().slice(0, 10)}!1a`;
  const hash = await bcrypt.hash(temporaryPassword, 12);
  await db.query("UPDATE users SET password_hash = $1 WHERE id = $2", [hash, req.params.id]);

  await audit(req.user.sub, "admin.user.password_reset", { targetUserId: req.params.id });
  await createUserNotification(
    req.params.id,
    "security",
    "Password Reset by Admin",
    "An administrator reset your password. Please change it after signing in.",
    { adminUserId: req.user.sub },
  );

  return res.json({ message: "Temporary password issued.", temporaryPassword });
});

app.delete("/api/admin/users/:id", requireAuth, requireActiveSession, requireRole("admin"), requireCsrf, async (req, res) => {
  if (req.params.id === req.user.sub) {
    return res.status(400).json({ error: "Admin cannot delete own account." });
  }

  const deleted = await db.query(
    `DELETE FROM users
     WHERE id = $1
     RETURNING id, email`,
    [req.params.id],
  );

  if (!deleted.rows[0]) {
    return res.status(404).json({ error: "User not found." });
  }

  await audit(req.user.sub, "admin.user.deleted", {
    targetUserId: deleted.rows[0].id,
    targetEmail: deleted.rows[0].email,
  });

  return res.json({ message: "User deleted successfully." });
});

app.post("/api/admin/users/:id/impersonate", requireAuth, requireActiveSession, requireRole("admin"), requireCsrf, async (req, res) => {
  if (req.params.id === req.user.sub) {
    return res.status(400).json({ error: "Admin cannot impersonate own account." });
  }

  const targetRes = await db.query(
    `SELECT id, email, role, account_status
     FROM users
     WHERE id = $1`,
    [req.params.id],
  );
  const target = targetRes.rows[0];

  if (!target) {
    return res.status(404).json({ error: "User not found." });
  }

  if (target.role !== "user") {
    return res.status(400).json({ error: "Only bank users can be impersonated." });
  }

  if (target.account_status !== "active") {
    return res.status(400).json({ error: "Only active users can be impersonated." });
  }

  const impersonationToken = security.signImpersonationToken(target, req.user.sub);
  setCookie(res, adminAccessCookie, req.authToken, 30 * 60 * 1000, true);
  setCookie(res, accessCookie, impersonationToken, 30 * 60 * 1000, true);
  setCookie(res, csrfCookie, security.createCsrfToken(), 30 * 60 * 1000, false);

  const impersonationWindowMs = 30 * 60 * 1000;
  const adminSessionKey = security.hashToken(req.authToken);
  activeSessionByToken.set(adminSessionKey, Date.now() + impersonationWindowMs);
  const impersonationSessionKey = security.hashToken(impersonationToken);
  const sessionExpiresAt = Date.now() + impersonationWindowMs;
  activeSessionByToken.set(impersonationSessionKey, sessionExpiresAt);

  await audit(req.user.sub, "admin.user.impersonation.started", {
    targetUserId: target.id,
    targetEmail: target.email,
    sessionExpiresAt: new Date(sessionExpiresAt).toISOString(),
  });

  return res.json({ message: "Impersonation session started.", targetUserId: target.id });
});

app.get("/api/admin/cards", requireAuth, requireActiveSession, requireRole("admin"), async (req, res) => {
  const params = [];
  const where = [];

  const userId = String(req.query.userId || "").trim();
  if (userId) {
    params.push(userId);
    const exactIndex = params.length;
    params.push(`%${userId}%`);
    const likeIndex = params.length;
    where.push(`(
      c.user_id::text = $${exactIndex}
      OR u.email ILIKE $${likeIndex}
      OR u.full_name ILIKE $${likeIndex}
    )`);
  }

  const status = String(req.query.status || "").trim().toLowerCase();
  if (["pending", "active", "frozen", "lost", "disabled"].includes(status)) {
    params.push(status);
    where.push(`c.status = $${params.length}`);
  }

  const providerStatus = String(req.query.providerStatus || "").trim().toLowerCase();
  if (["pending", "succeeded", "failed", "blocked", "lost"].includes(providerStatus)) {
    params.push(providerStatus);
    where.push(`c.provider_status = $${params.length}`);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const rows = await db.query(
    `SELECT c.id,
            c.user_id,
            u.full_name,
            u.email,
            c.account_id,
            c.card_type,
            c.card_last4,
            c.status,
            c.is_frozen,
            c.is_reported_lost,
            c.external_provider,
            c.provider_ref,
            c.provider_status,
            c.provider_error_message,
            c.created_at,
            c.updated_at
     FROM cards c
     JOIN users u ON u.id = c.user_id
     ${whereSql}
     ORDER BY c.created_at DESC
     LIMIT 500`,
    params,
  );

  return res.json({ cards: rows.rows });
});

app.post("/api/admin/cards/:id/freeze", requireAuth, requireActiveSession, requireRole("admin"), requireCsrf, async (req, res) => {
  const updated = await db.query(
    `UPDATE cards
     SET is_frozen = TRUE,
         status = 'frozen',
         updated_at = NOW()
     WHERE id = $1
       AND is_reported_lost = FALSE
       AND status = 'active'
       AND is_frozen = FALSE
     RETURNING id, user_id`,
    [req.params.id],
  );

  if (!updated.rows[0]) {
    return res.status(400).json({ error: "Card cannot be frozen." });
  }

  await audit(req.user.sub, "admin.card.frozen", { cardId: req.params.id, targetUserId: updated.rows[0].user_id });
  return res.json({ message: "Card frozen." });
});

app.post("/api/admin/cards/:id/unfreeze", requireAuth, requireActiveSession, requireRole("admin"), requireCsrf, async (req, res) => {
  const updated = await db.query(
    `UPDATE cards
     SET is_frozen = FALSE,
         status = 'active',
         updated_at = NOW()
     WHERE id = $1
       AND is_reported_lost = FALSE
       AND status = 'frozen'
       AND is_frozen = TRUE
     RETURNING id, user_id`,
    [req.params.id],
  );

  if (!updated.rows[0]) {
    return res.status(400).json({ error: "Card cannot be unfrozen." });
  }

  await audit(req.user.sub, "admin.card.unfrozen", { cardId: req.params.id, targetUserId: updated.rows[0].user_id });
  return res.json({ message: "Card unfrozen." });
});

app.post("/api/admin/cards/:id/report-lost", requireAuth, requireActiveSession, requireRole("admin"), requireCsrf, async (req, res) => {
  const updated = await db.query(
    `UPDATE cards
     SET is_reported_lost = TRUE,
         is_frozen = TRUE,
         status = 'lost',
         updated_at = NOW()
     WHERE id = $1 AND is_reported_lost = FALSE
     RETURNING id, user_id`,
    [req.params.id],
  );

  if (!updated.rows[0]) {
    return res.status(400).json({ error: "Card cannot be reported lost." });
  }

  await audit(req.user.sub, "admin.card.reported_lost", { cardId: req.params.id, targetUserId: updated.rows[0].user_id });
  return res.json({ message: "Card reported lost." });
});

app.post("/api/admin/cards/:id/retry", requireAuth, requireActiveSession, requireRole("admin"), requireCsrf, async (req, res) => {
  const cardRes = await db.query(
    `SELECT id, user_id, account_id, card_type, status, provider_status, is_reported_lost
     FROM cards
     WHERE id = $1`,
    [req.params.id],
  );
  const card = cardRes.rows[0];
  if (!card) {
    return res.status(404).json({ error: "Card not found." });
  }

  if (card.is_reported_lost || card.provider_status !== "failed" || card.status !== "disabled") {
    return res.status(400).json({ error: "Only failed/disabled non-lost cards can be retried." });
  }

  const providerResult = await submitCardToProvider({
    userId: card.user_id,
    accountId: card.account_id,
    cardType: card.card_type,
  });

  const updated = await db.query(
    `UPDATE cards
     SET status = $1,
         external_provider = $2,
         provider_ref = $3,
         provider_status = $4,
         provider_error_code = $5,
         provider_error_message = $6,
         provider_last_synced_at = $7,
         updated_at = NOW()
     WHERE id = $8
     RETURNING id, user_id`,
    [
      mapProviderCardStatusToInternal(providerResult.providerStatus),
      providerResult.externalProvider,
      providerResult.providerRef,
      providerResult.providerStatus,
      providerResult.providerErrorCode,
      providerResult.providerErrorMessage,
      providerResult.providerLastSyncedAt,
      req.params.id,
    ],
  );

  await audit(req.user.sub, "admin.card.retry_requested", { cardId: req.params.id, targetUserId: updated.rows[0]?.user_id || null });
  return res.json({ message: "Card retry submitted." });
});

app.post("/api/admin/notifications/send", requireAuth, requireActiveSession, requireRole("admin"), requireCsrf, async (req, res) => {
  const { userId, title, body, type, metadata, broadcast } = req.body || {};
  const safeTitle = String(title || "").trim();
  const safeBody = String(body || "").trim();
  const safeType = String(type || "system").trim().toLowerCase();
  const allowedTypes = ["account", "transfer", "payment", "support", "security", "system"];

  if (!safeTitle || !safeBody || !allowedTypes.includes(safeType)) {
    return res.status(400).json({ error: "Invalid notification payload." });
  }

  if (!broadcast && !userId) {
    return res.status(400).json({ error: "userId is required for non-broadcast notifications." });
  }

  const targets = broadcast
    ? await db.query(`SELECT id FROM users WHERE account_status = 'active'`)
    : { rows: [{ id: userId }] };

  if (!targets.rows.length) {
    return res.status(404).json({ error: "No recipients found." });
  }

  for (const target of targets.rows) {
    await createUserNotification(
      target.id,
      safeType,
      safeTitle,
      safeBody,
      {
        ...(metadata && typeof metadata === "object" ? metadata : {}),
        adminUserId: req.user.sub,
        broadcast: Boolean(broadcast),
      },
    );
  }

  await audit(req.user.sub, "admin.notification.sent", {
    recipientCount: targets.rows.length,
    type: safeType,
    broadcast: Boolean(broadcast),
  });

  return res.json({ message: "Notification(s) sent successfully.", recipientCount: targets.rows.length });
});

app.get("/api/admin/activity", requireAuth, requireActiveSession, requireRole("admin"), async (req, res) => {
  const params = [];
  const where = [];

  const userId = String(req.query.userId || "").trim();
  if (userId) {
    params.push(userId);
    const exactIndex = params.length;
    params.push(`%${userId}%`);
    const likeIndex = params.length;
    where.push(`(
      a.actor_user_id::text = $${exactIndex}
      OR u.email ILIKE $${likeIndex}
      OR u.full_name ILIKE $${likeIndex}
    )`);
  }

  const fromDate = req.query.from ? new Date(String(req.query.from)) : null;
  const toDate = req.query.to ? new Date(String(req.query.to)) : null;
  if ((fromDate && Number.isNaN(fromDate.getTime())) || (toDate && Number.isNaN(toDate.getTime()))) {
    return res.status(400).json({ error: "Invalid date filter." });
  }
  if (fromDate) {
    params.push(fromDate.toISOString());
    where.push(`a.created_at >= $${params.length}`);
  }
  if (toDate) {
    params.push(toDate.toISOString());
    where.push(`a.created_at <= $${params.length}`);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const rows = await db.query(
    `SELECT a.id, a.actor_user_id, u.full_name, u.email, a.event_type, a.metadata, a.created_at
     FROM audit_logs a
     LEFT JOIN users u ON u.id = a.actor_user_id
     ${whereSql}
     ORDER BY a.created_at DESC
     LIMIT 500`,
    params,
  );

  return res.json({ items: rows.rows });
});

app.get("/api/admin/transactions", requireAuth, requireActiveSession, requireRole("admin"), async (req, res) => {
  const params = [];
  const where = [];

  const userId = String(req.query.userId || "").trim();
  if (userId) {
    params.push(userId);
    const exactIndex = params.length;
    params.push(`%${userId}%`);
    const likeIndex = params.length;
    where.push(`(
      uf.id::text = $${exactIndex}
      OR ut.id::text = $${exactIndex}
      OR uf.email ILIKE $${likeIndex}
      OR ut.email ILIKE $${likeIndex}
      OR uf.full_name ILIKE $${likeIndex}
      OR ut.full_name ILIKE $${likeIndex}
    )`);
  }

  const status = String(req.query.status || "").trim().toLowerCase();
  if (["completed", "rejected"].includes(status)) {
    params.push(status);
    where.push(`t.status = $${params.length}`);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const rows = await db.query(
    `SELECT t.id,
            t.amount,
            t.status,
            t.created_at,
            af.id AS from_account_id,
            af.account_number AS from_account,
            at.id AS to_account_id,
            at.account_number AS to_account,
            uf.id AS from_user_id,
            uf.full_name AS from_user_name,
            uf.email AS from_user_email,
            ut.id AS to_user_id,
            ut.full_name AS to_user_name,
            ut.email AS to_user_email,
            CASE
              WHEN t.note_ciphertext IS NOT NULL AND $${params.length + 1}::text IS NOT NULL
                THEN pgp_sym_decrypt(t.note_ciphertext, $${params.length + 1}::text)
              ELSE t.note
            END AS note
     FROM transactions t
     JOIN accounts af ON af.id = t.from_account_id
     JOIN accounts at ON at.id = t.to_account_id
     JOIN users uf ON uf.id = af.user_id
     JOIN users ut ON ut.id = at.user_id
     ${whereSql}
     ORDER BY t.created_at DESC
     LIMIT 500`,
    [...params, config.databaseEncryptionKey],
  );

  return res.json({ transactions: rows.rows });
});

app.post("/api/admin/transactions/:id/reverse", requireAuth, requireActiveSession, requireRole("admin"), requireCsrf, async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");

    const txRes = await client.query(
      `SELECT id, from_account_id, to_account_id, amount, status
       FROM transactions
       WHERE id = $1
       FOR UPDATE`,
      [req.params.id],
    );

    const tx = txRes.rows[0];
    if (!tx) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Transaction not found." });
    }

    if (tx.status !== "completed") {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Only completed transactions can be reversed." });
    }

    const amount = Number(tx.amount || 0);
    const sourceRes = await client.query(
      `SELECT id, balance FROM accounts WHERE id = $1 FOR UPDATE`,
      [tx.to_account_id],
    );
    const destinationRes = await client.query(
      `SELECT id FROM accounts WHERE id = $1 FOR UPDATE`,
      [tx.from_account_id],
    );

    if (!sourceRes.rows[0] || !destinationRes.rows[0]) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Related accounts not found." });
    }

    if (Number(sourceRes.rows[0].balance) < amount) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Destination account has insufficient balance for reversal." });
    }

    await client.query("UPDATE accounts SET balance = balance - $1 WHERE id = $2", [amount, tx.to_account_id]);
    await client.query("UPDATE accounts SET balance = balance + $1 WHERE id = $2", [amount, tx.from_account_id]);

    const note = `Admin reversal for transaction ${tx.id}`;
    const insertRes = await client.query(
      `INSERT INTO transactions (from_account_id, to_account_id, amount, status, note, note_ciphertext)
       VALUES (
         $1,
         $2,
         $3,
         'completed',
         NULL,
         pgp_sym_encrypt($4::text, $5::text)
       )
       RETURNING id`,
      [tx.to_account_id, tx.from_account_id, amount, note, config.databaseEncryptionKey],
    );

    await client.query("COMMIT");

    await audit(req.user.sub, "admin.transaction.reversed", {
      transactionId: tx.id,
      reversalTransactionId: insertRes.rows[0].id,
      amount,
    });

    return res.status(201).json({
      message: "Transaction reversed successfully.",
      reversalTransactionId: insertRes.rows[0].id,
    });
  } catch (_error) {
    await client.query("ROLLBACK");
    return res.status(500).json({ error: "Failed to reverse transaction." });
  } finally {
    client.release();
  }
});

function buildAuditLogQuery(filters = {}, defaultLimit = 50, maxLimit = 200, defaultOffset = 0) {
  const where = [];
  const params = [];

  if (filters.eventType) {
    params.push(`%${String(filters.eventType).trim()}%`);
    where.push(`event_type ILIKE $${params.length}`);
  }

  if (filters.actorUserId) {
    const actorQuery = String(filters.actorUserId).trim();
    params.push(actorQuery);
    const exactIndex = params.length;
    params.push(`%${actorQuery}%`);
    const likeIndex = params.length;
    where.push(`(
      actor_user_id::text = $${exactIndex}
      OR EXISTS (
        SELECT 1
        FROM users u
        WHERE u.id = actor_user_id
          AND (u.email ILIKE $${likeIndex} OR u.full_name ILIKE $${likeIndex})
      )
    )`);
  }

  if (filters.fromDate) {
    params.push(filters.fromDate.toISOString());
    where.push(`created_at >= $${params.length}`);
  }

  if (filters.toDate) {
    params.push(filters.toDate.toISOString());
    where.push(`created_at <= $${params.length}`);
  }

  const numericLimit = Number(filters.limit || defaultLimit);
  const safeLimit = Number.isNaN(numericLimit)
    ? defaultLimit
    : Math.min(Math.max(numericLimit, 1), maxLimit);

  const numericOffset = Number(filters.offset ?? defaultOffset);
  const safeOffset = Number.isNaN(numericOffset) ? defaultOffset : Math.max(numericOffset, 0);

  params.push(safeLimit);
  const limitParamIndex = params.length;
  params.push(safeOffset);
  const offsetParamIndex = params.length;

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const sql = `SELECT id, actor_user_id, event_type, metadata, created_at
               FROM audit_logs
               ${whereSql}
               ORDER BY created_at DESC
               LIMIT $${limitParamIndex}
               OFFSET $${offsetParamIndex}`;

  const countSql = `SELECT COUNT(*)::int AS total FROM audit_logs ${whereSql}`;

  const countParams = params.slice(0, params.length - 2);

  return { sql, params, countSql, countParams, safeLimit, safeOffset };
}

app.get("/api/admin/audit-logs", requireAuth, requireActiveSession, requireRole("admin"), async (req, res) => {
  const fromDate = req.query.from ? new Date(String(req.query.from)) : null;
  const toDate = req.query.to ? new Date(String(req.query.to)) : null;

  if ((fromDate && Number.isNaN(fromDate.getTime())) || (toDate && Number.isNaN(toDate.getTime()))) {
    return res.status(400).json({ error: "Invalid date filter." });
  }

  const query = buildAuditLogQuery(
    {
      eventType: req.query.eventType,
      actorUserId: req.query.actorUserId,
      fromDate,
      toDate,
      limit: req.query.limit,
      offset: req.query.offset,
    },
    50,
    200,
    0,
  );

  const [rows, count] = await Promise.all([
    db.query(query.sql, query.params),
    db.query(query.countSql, query.countParams),
  ]);

  return res.json({
    logs: rows.rows,
    pagination: {
      total: count.rows[0].total,
      limit: query.safeLimit,
      offset: query.safeOffset,
      hasNext: query.safeOffset + query.safeLimit < count.rows[0].total,
      hasPrevious: query.safeOffset > 0,
    },
  });
});

function csvEscape(value) {
  const raw = value == null ? "" : String(value);
  return `"${raw.replace(/"/g, '""')}"`;
}

app.get("/api/admin/audit-logs.csv", requireAuth, requireActiveSession, requireRole("admin"), async (req, res) => {
  const fromDate = req.query.from ? new Date(String(req.query.from)) : null;
  const toDate = req.query.to ? new Date(String(req.query.to)) : null;

  if ((fromDate && Number.isNaN(fromDate.getTime())) || (toDate && Number.isNaN(toDate.getTime()))) {
    return res.status(400).json({ error: "Invalid date filter." });
  }

  const query = buildAuditLogQuery(
    {
      eventType: req.query.eventType,
      actorUserId: req.query.actorUserId,
      fromDate,
      toDate,
      limit: 1000,
    },
    1000,
    1000,
  );

  const rows = await db.query(query.sql, query.params);

  const header = ["id", "created_at", "event_type", "actor_user_id", "metadata"];
  const csvRows = [header.map(csvEscape).join(",")];

  for (const row of rows.rows) {
    csvRows.push(
      [
        row.id,
        row.created_at,
        row.event_type,
        row.actor_user_id || "",
        JSON.stringify(row.metadata || {}),
      ]
        .map(csvEscape)
        .join(","),
    );
  }

  const fileName = `audit-logs-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.csv`;
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename=\"${fileName}\"`);
  return res.send(csvRows.join("\n"));
});

app.get("/api/admin/suspicious-activity", requireAuth, requireActiveSession, requireRole("admin"), async (req, res) => {
  const lookbackMinutes = Math.min(
    Math.max(Number(req.query.lookbackMinutes || config.suspiciousActivityLookbackMinutes), 1),
    1440,
  );
  const minRiskScore = Math.min(
    Math.max(Number(req.query.minRiskScore || config.suspiciousActivityMinRiskScore), 1),
    50,
  );

  const suspicious = await db.query(
    `SELECT
       u.id AS user_id,
       u.full_name,
       u.email,
       COALESCE(COUNT(*) FILTER (WHERE a.event_type = 'auth.login.failed'), 0)::int AS login_failed_count,
       COALESCE(COUNT(*) FILTER (WHERE a.event_type = 'auth.mfa.failed'), 0)::int AS mfa_failed_count,
       COALESCE(COUNT(*) FILTER (WHERE a.event_type = 'auth.login.locked'), 0)::int AS lock_count,
       MAX(a.created_at) AS last_event_at,
       (
         COALESCE(COUNT(*) FILTER (WHERE a.event_type = 'auth.login.failed'), 0)
         + COALESCE(COUNT(*) FILTER (WHERE a.event_type = 'auth.mfa.failed'), 0) * 2
         + COALESCE(COUNT(*) FILTER (WHERE a.event_type = 'auth.login.locked'), 0) * 4
       )::int AS risk_score
     FROM audit_logs a
     JOIN users u ON u.id = a.actor_user_id
     WHERE a.created_at >= NOW() - ($1::int * INTERVAL '1 minute')
       AND a.event_type IN ('auth.login.failed', 'auth.mfa.failed', 'auth.login.locked')
     GROUP BY u.id, u.full_name, u.email
     HAVING (
       COALESCE(COUNT(*) FILTER (WHERE a.event_type = 'auth.login.failed'), 0)
       + COALESCE(COUNT(*) FILTER (WHERE a.event_type = 'auth.mfa.failed'), 0) * 2
       + COALESCE(COUNT(*) FILTER (WHERE a.event_type = 'auth.login.locked'), 0) * 4
     ) >= $2
     ORDER BY risk_score DESC, last_event_at DESC`,
    [lookbackMinutes, minRiskScore],
  );

  return res.json({
    lookbackMinutes,
    minRiskScore,
    items: suspicious.rows,
  });
});

app.get("/api/admin/providers/status", requireAuth, requireActiveSession, requireRole("admin"), async (_req, res) => {
  const cardSummary = await db.query(
    `SELECT
       COUNT(*) FILTER (WHERE provider_status = 'pending')::int AS pending_count,
       COUNT(*) FILTER (WHERE provider_status = 'failed')::int AS failed_count,
       MAX(provider_last_synced_at) AS last_synced_at
     FROM cards`,
  );

  return res.json({
    worker: {
      enabled: config.providerSyncWorkerEnabled,
      intervalSeconds: config.providerSyncWorkerIntervalSeconds,
      batchSize: config.providerSyncWorkerBatchSize,
      busy: providerSyncWorkerBusy,
      ...providerSyncWorkerState,
    },
    payments: { pendingCount: 0, failedCount: 0, lastSyncedAt: null },
    cards: {
      pendingCount: Number(cardSummary.rows[0]?.pending_count || 0),
      failedCount: Number(cardSummary.rows[0]?.failed_count || 0),
      lastSyncedAt: cardSummary.rows[0]?.last_synced_at || null,
    },
  });
});

app.get("/api/admin/providers/timeline", requireAuth, requireActiveSession, requireRole("admin"), async (req, res) => {
  const supportedEventTypes = [
    "provider.card.sync.requested",
    "provider.card.webhook.processed",
    "user.card.retry_requested",
  ];

  const where = [
    `event_type IN (${supportedEventTypes.map((_, index) => `$${index + 1}`).join(", ")})`,
  ];
  const params = [...supportedEventTypes];

  const eventType = String(req.query.eventType || "").trim();
  if (eventType && supportedEventTypes.includes(eventType)) {
    params.push(eventType);
    where.push(`event_type = $${params.length}`);
  }

  const actorUserId = String(req.query.actorUserId || "").trim();
  if (actorUserId) {
    params.push(actorUserId);
    const exactIndex = params.length;
    params.push(`%${actorUserId}%`);
    const likeIndex = params.length;
    where.push(`(
      actor_user_id::text = $${exactIndex}
      OR EXISTS (
        SELECT 1
        FROM users u
        WHERE u.id = actor_user_id
          AND (u.email ILIKE $${likeIndex} OR u.full_name ILIKE $${likeIndex})
      )
    )`);
  }

  const fromDate = req.query.from ? new Date(String(req.query.from)) : null;
  const toDate = req.query.to ? new Date(String(req.query.to)) : null;
  if ((fromDate && Number.isNaN(fromDate.getTime())) || (toDate && Number.isNaN(toDate.getTime()))) {
    return res.status(400).json({ error: "Invalid date filter." });
  }

  if (fromDate) {
    params.push(fromDate.toISOString());
    where.push(`created_at >= $${params.length}`);
  }

  if (toDate) {
    params.push(toDate.toISOString());
    where.push(`created_at <= $${params.length}`);
  }

  const numericLimit = Number(req.query.limit || 25);
  const limit = Number.isNaN(numericLimit) ? 25 : Math.min(Math.max(numericLimit, 1), 100);
  const numericOffset = Number(req.query.offset || 0);
  const offset = Number.isNaN(numericOffset) ? 0 : Math.max(numericOffset, 0);

  params.push(limit);
  const limitIndex = params.length;
  params.push(offset);
  const offsetIndex = params.length;

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const rows = await db.query(
    `SELECT id, actor_user_id, event_type, metadata, created_at
     FROM audit_logs
     ${whereSql}
     ORDER BY created_at DESC
     LIMIT $${limitIndex}
     OFFSET $${offsetIndex}`,
    params,
  );

  const count = await db.query(
    `SELECT COUNT(*)::int AS total
     FROM audit_logs
     ${whereSql}`,
    params.slice(0, params.length - 2),
  );

  return res.json({
    items: rows.rows,
    pagination: {
      total: count.rows[0].total,
      limit,
      offset,
      hasNext: offset + limit < count.rows[0].total,
      hasPrevious: offset > 0,
    },
  });
});

app.get("/api/admin/providers/timeline.csv", requireAuth, requireActiveSession, requireRole("admin"), async (req, res) => {
  const supportedEventTypes = [
    "provider.card.sync.requested",
    "provider.card.webhook.processed",
    "user.card.retry_requested",
  ];

  const where = [
    `event_type IN (${supportedEventTypes.map((_, index) => `$${index + 1}`).join(", ")})`,
  ];
  const params = [...supportedEventTypes];

  const eventType = String(req.query.eventType || "").trim();
  if (eventType && supportedEventTypes.includes(eventType)) {
    params.push(eventType);
    where.push(`event_type = $${params.length}`);
  }

  const actorUserId = String(req.query.actorUserId || "").trim();
  if (actorUserId) {
    params.push(actorUserId);
    const exactIndex = params.length;
    params.push(`%${actorUserId}%`);
    const likeIndex = params.length;
    where.push(`(
      actor_user_id::text = $${exactIndex}
      OR EXISTS (
        SELECT 1
        FROM users u
        WHERE u.id = actor_user_id
          AND (u.email ILIKE $${likeIndex} OR u.full_name ILIKE $${likeIndex})
      )
    )`);
  }

  const fromDate = req.query.from ? new Date(String(req.query.from)) : null;
  const toDate = req.query.to ? new Date(String(req.query.to)) : null;
  if ((fromDate && Number.isNaN(fromDate.getTime())) || (toDate && Number.isNaN(toDate.getTime()))) {
    return res.status(400).json({ error: "Invalid date filter." });
  }

  if (fromDate) {
    params.push(fromDate.toISOString());
    where.push(`created_at >= $${params.length}`);
  }

  if (toDate) {
    params.push(toDate.toISOString());
    where.push(`created_at <= $${params.length}`);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const rows = await db.query(
    `SELECT id, created_at, event_type, actor_user_id, metadata
     FROM audit_logs
     ${whereSql}
     ORDER BY created_at DESC
     LIMIT 1000`,
    params,
  );

  const header = ["id", "created_at", "event_type", "actor_user_id", "metadata"];
  const csvRows = [header.map(csvEscape).join(",")];

  for (const row of rows.rows) {
    csvRows.push(
      [
        row.id,
        row.created_at,
        row.event_type,
        row.actor_user_id || "",
        JSON.stringify(row.metadata || {}),
      ]
        .map(csvEscape)
        .join(","),
    );
  }

  const fileName = `provider-timeline-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.csv`;
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename=\"${fileName}\"`);
  return res.send(csvRows.join("\n"));
});

app.use((err, _req, res, _next) => {
  if (!config.isProduction) {
    console.error(err);
  }
  res.status(500).json({ error: "Internal server error." });
});

async function runSchemaIfNeeded() {
  const schemaPath = path.resolve(process.cwd(), "db", "schema.sql");
  if (!fs.existsSync(schemaPath)) {
    return;
  }
  const sql = fs.readFileSync(schemaPath, "utf8");
  await db.query(sql);
}

async function assertDatabaseIntegrity() {
  if (!config.dbPreflightEnabled) {
    return;
  }

  const requiredColumns = [
    ["cards", "external_provider"],
    ["cards", "provider_ref"],
    ["cards", "provider_status"],
    ["cards", "provider_last_synced_at"],
  ];

  const columnRows = await db.query(
    `SELECT table_name, column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name IN ('cards')`,
  );
  const existingColumns = new Set(columnRows.rows.map((row) => `${row.table_name}.${row.column_name}`));
  const missingColumns = requiredColumns
    .map(([tableName, columnName]) => `${tableName}.${columnName}`)
    .filter((value) => !existingColumns.has(value));

  const constraintRows = await db.query(
    `SELECT t.relname AS table_name,
            c.conname AS constraint_name,
            LOWER(pg_get_constraintdef(c.oid)) AS definition
     FROM pg_constraint c
     JOIN pg_class t ON t.oid = c.conrelid
     JOIN pg_namespace n ON n.oid = t.relnamespace
     WHERE n.nspname = 'public'
       AND t.relname = 'cards'
       AND c.conname IN ('cards_status_check', 'cards_provider_status_check')`,
  );

  const constraintMap = new Map(
    constraintRows.rows.map((row) => [`${row.table_name}.${row.constraint_name}`, row.definition || ""]),
  );

  const requiredConstraints = [
    {
      key: "cards.cards_status_check",
      tokens: ["pending", "active", "frozen", "lost", "disabled"],
    },
    {
      key: "cards.cards_provider_status_check",
      tokens: ["pending", "succeeded", "failed", "blocked", "lost"],
    },
  ];

  const constraintErrors = [];
  for (const requirement of requiredConstraints) {
    const definition = constraintMap.get(requirement.key);
    if (!definition) {
      constraintErrors.push(`Missing constraint: ${requirement.key}`);
      continue;
    }

    const missingTokens = requirement.tokens.filter((token) => !definition.includes(token));
    if (missingTokens.length > 0) {
      constraintErrors.push(
        `Constraint ${requirement.key} missing expected token(s): ${missingTokens.join(", ")}`,
      );
    }
  }

  const indexRows = await db.query(
    `SELECT indexname
     FROM pg_indexes
     WHERE schemaname = 'public'
       AND indexname IN ('idx_cards_provider_ref')`,
  );
  const existingIndexes = new Set(indexRows.rows.map((row) => row.indexname));
  const missingIndexes = ["idx_cards_provider_ref"].filter(
    (name) => !existingIndexes.has(name),
  );

  const failures = [];
  if (missingColumns.length > 0) {
    failures.push(`Missing provider column(s): ${missingColumns.join(", ")}`);
  }
  failures.push(...constraintErrors);
  if (missingIndexes.length > 0) {
    failures.push(`Missing provider index(es): ${missingIndexes.join(", ")}`);
  }

  if (failures.length > 0) {
    throw new Error(`Database preflight failed. ${failures.join(" | ")}`);
  }
}

async function seedDevelopmentAdmin() {
  if (!config.seedAdminEnabled) {
    return;
  }

  const email = config.seedAdminEmail;
  const hash = await bcrypt.hash(config.seedAdminPassword, 12);

  const existingUser = await db.query(
    `SELECT id FROM users WHERE email = $1`,
    [email],
  );

  let userId;

  if (existingUser.rows[0]) {
    userId = existingUser.rows[0].id;
    await db.query(
      `UPDATE users
       SET full_name = $1, role = 'admin', password_hash = $2, is_locked = FALSE
       WHERE id = $3`,
      [config.seedAdminName, hash, userId],
    );
  } else {
    const inserted = await db.query(
      `INSERT INTO users (full_name, email, password_hash, role)
       VALUES ($1, $2, $3, 'admin')
       RETURNING id`,
      [config.seedAdminName, email, hash],
    );
    userId = inserted.rows[0].id;
  }

  await ensureAccountForUser(userId, 100000.0);
  await audit(userId, "system.seed.admin", { email });

  console.log("Development admin ready:");
  console.log(`  Email: ${email}`);
  console.log(`  Password: ${config.seedAdminPassword}`);
}

let providerSyncWorkerBusy = false;
const providerSyncWorkerState = {
  lastStartedAt: null,
  lastCompletedAt: null,
  lastDurationMs: null,
  lastErrorAt: null,
  lastErrorMessage: null,
  lastCardUpdatedCount: 0,
};

async function processPendingProviderStatuses() {
  if (providerSyncWorkerBusy) {
    return;
  }

  const startedAtMs = Date.now();
  providerSyncWorkerState.lastStartedAt = new Date(startedAtMs).toISOString();
  providerSyncWorkerBusy = true;
  const client = await db.pool.connect();

  try {
    await client.query("BEGIN");

    const cardRows = await client.query(
      `SELECT id, provider_status
       FROM cards
       WHERE provider_status = 'pending'
       ORDER BY created_at ASC
       LIMIT $1
       FOR UPDATE SKIP LOCKED`,
      [config.providerSyncWorkerBatchSize],
    );

    let cardUpdatedCount = 0;
    for (const card of cardRows.rows) {
      const nextProvider = resolveCardProviderStatusForSync(card.provider_status);
      const mappedStatus = mapProviderCardStatusToInternal(nextProvider.providerStatus);

      const updated = await client.query(
        `UPDATE cards
         SET provider_status = $1,
             provider_error_code = $2,
             provider_error_message = $3,
             provider_last_synced_at = NOW(),
             status = $4,
             is_frozen = CASE WHEN $1 IN ('blocked', 'lost') THEN TRUE ELSE is_frozen END,
             is_reported_lost = CASE WHEN $1 = 'lost' THEN TRUE ELSE is_reported_lost END,
             updated_at = NOW()
         WHERE id = $5
         RETURNING id`,
        [
          nextProvider.providerStatus,
          nextProvider.providerErrorCode,
          nextProvider.providerErrorMessage,
          mappedStatus,
          card.id,
        ],
      );

      if (updated.rows[0]) {
        cardUpdatedCount += 1;
      }
    }

    await client.query("COMMIT");
    providerSyncWorkerState.lastCompletedAt = new Date().toISOString();
    providerSyncWorkerState.lastDurationMs = Date.now() - startedAtMs;
    providerSyncWorkerState.lastCardUpdatedCount = cardUpdatedCount;
    providerSyncWorkerState.lastErrorAt = null;
    providerSyncWorkerState.lastErrorMessage = null;

    if (!config.isProduction && cardUpdatedCount > 0) {
      console.log(`Provider sync worker reconciled ${cardUpdatedCount} card(s).`);
    }
  } catch (error) {
    await client.query("ROLLBACK");
    providerSyncWorkerState.lastErrorAt = new Date().toISOString();
    providerSyncWorkerState.lastErrorMessage = String(error?.message || "Provider sync worker failed");
    if (!config.isProduction) {
      console.error("Provider sync worker failed", error);
    }
  } finally {
    client.release();
    providerSyncWorkerBusy = false;
  }
}

function scheduleProviderSyncWorker() {
  if (!config.providerSyncWorkerEnabled) {
    return;
  }

  processPendingProviderStatuses().catch(() => {});
  const intervalMs = config.providerSyncWorkerIntervalSeconds * 1000;
  const timer = setInterval(() => {
    processPendingProviderStatuses().catch(() => {});
  }, intervalMs);

  if (typeof timer.unref === "function") {
    timer.unref();
  }

  console.log(`Provider sync worker enabled (interval ${config.providerSyncWorkerIntervalSeconds}s).`);
}

module.exports = app;

async function start() {
  await runSchemaIfNeeded();
  await assertDatabaseIntegrity();
  await seedDevelopmentAdmin();
  scheduleProviderSyncWorker();
  app.listen(config.port, () => {
    console.log(`Backend listening on http://localhost:${config.port}`);
  });
}

if (require.main === module) {
  start().catch((error) => {
    console.error("Failed to start backend", error);
    process.exit(1);
  });
}
