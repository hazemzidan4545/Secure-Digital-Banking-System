const path = require("node:path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

function requireEnv(name, fallback) {
  const value = process.env[name] || fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const isProduction = process.env.NODE_ENV === "production";
const isTest = process.env.NODE_ENV === "test";

module.exports = {
  isProduction,
  port: Number(process.env.PORT || 4000),
  frontendOrigin: requireEnv("FRONTEND_ORIGIN", "http://localhost:5173"),
  databaseUrl: requireEnv("DATABASE_URL"),
  databaseEncryptionKey: isProduction
    ? requireEnv("DB_ENCRYPTION_KEY")
    : (process.env.DB_ENCRYPTION_KEY || "dev_db_encryption_key_change_me"),
  jwtAccessSecret: requireEnv("JWT_ACCESS_SECRET"),
  jwtMfaSecret: requireEnv("JWT_MFA_SECRET"),
  jwtPasswordResetSecret: requireEnv("JWT_PASSWORD_RESET_SECRET"),
  perTransferCap: Number(process.env.PER_TRANSFER_CAP || 10000),
  dailyTransferCap: Number(process.env.DAILY_TRANSFER_CAP || 25000),
  hourlyTransferCapCount: Number(process.env.HOURLY_TRANSFER_CAP_COUNT || 5),
  maxFailedLoginAttempts: Number(process.env.MAX_FAILED_LOGIN_ATTEMPTS || 5),
  loginLockoutMinutes: Number(process.env.LOGIN_LOCKOUT_MINUTES || 10),
  sessionIdleTimeoutMinutes: Number(process.env.SESSION_IDLE_TIMEOUT_MINUTES || 10),
  suspiciousActivityLookbackMinutes: Number(process.env.SUSPICIOUS_ACTIVITY_LOOKBACK_MINUTES || 60),
  suspiciousActivityMinRiskScore: Number(process.env.SUSPICIOUS_ACTIVITY_MIN_RISK_SCORE || 3),
  apiRateLimitWindowMs: Math.max(Number(process.env.API_RATE_LIMIT_WINDOW_MS || (15 * 60 * 1000)), 1000),
  apiRateLimitMax: isTest ? 100000 : Math.max(Number(process.env.API_RATE_LIMIT_MAX || 200), 1),
  authRateLimitWindowMs: Math.max(Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || (15 * 60 * 1000)), 1000),
  authRateLimitMax: isTest ? 100000 : Math.max(Number(process.env.AUTH_RATE_LIMIT_MAX || 25), 1),
  dbPreflightEnabled: process.env.DB_PREFLIGHT_ENABLED !== "false",
  recurringWorkerEnabled: process.env.RECURRING_WORKER_ENABLED !== "false",
  recurringWorkerIntervalSeconds: Math.max(Number(process.env.RECURRING_WORKER_INTERVAL_SECONDS || 30), 5),
  paymentProviderMode: String(process.env.PAYMENT_PROVIDER_MODE || "sandbox").toLowerCase(),
  cardProviderMode: String(process.env.CARD_PROVIDER_MODE || "sandbox").toLowerCase(),
  providerFailureRate: Math.min(Math.max(Number(process.env.PROVIDER_FAILURE_RATE || 0.1), 0), 1),
  providerPendingRate: Math.min(Math.max(Number(process.env.PROVIDER_PENDING_RATE || 0.2), 0), 1),
  providerWebhookSecret: process.env.PROVIDER_WEBHOOK_SECRET || "dev_provider_webhook_secret",
  providerSyncWorkerEnabled: process.env.PROVIDER_SYNC_WORKER_ENABLED !== "false",
  providerSyncWorkerIntervalSeconds: Math.max(Number(process.env.PROVIDER_SYNC_WORKER_INTERVAL_SECONDS || 20), 5),
  providerSyncWorkerBatchSize: Math.min(Math.max(Number(process.env.PROVIDER_SYNC_WORKER_BATCH_SIZE || 100), 10), 500),
  oauthGithubEnabled: process.env.OAUTH_GITHUB_ENABLED === "true",
  oauthGithubClientId: process.env.OAUTH_GITHUB_CLIENT_ID || "",
  oauthGithubClientSecret: process.env.OAUTH_GITHUB_CLIENT_SECRET || "",
  oauthGithubCallbackUrl: process.env.OAUTH_GITHUB_CALLBACK_URL || "",
  smtpHost: process.env.SMTP_HOST || "",
  smtpPort: Math.max(Number(process.env.SMTP_PORT || 587), 1),
  smtpSecure: process.env.SMTP_SECURE === "true",
  smtpUser: process.env.SMTP_USER || "",
  smtpPassword: process.env.SMTP_PASSWORD || "",
  smtpFrom: process.env.SMTP_FROM || "no-reply@aegisbank.local",
  seedAdminEnabled: !isProduction && process.env.SEED_ADMIN_ENABLED !== "false",
  seedAdminName: process.env.SEED_ADMIN_NAME || "System Admin",
  seedAdminEmail: (process.env.SEED_ADMIN_EMAIL || "admin@aegisbank.local").toLowerCase(),
  seedAdminPassword: process.env.SEED_ADMIN_PASSWORD || "AdminPass123!",
};
