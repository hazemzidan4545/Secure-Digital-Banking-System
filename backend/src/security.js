const crypto = require("node:crypto");
const jwt = require("jsonwebtoken");
const config = require("./config");

function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, email: user.email, type: "access" },
    config.jwtAccessSecret,
    { expiresIn: "15m" },
  );
}

function signImpersonationToken(targetUser, adminUserId) {
  return jwt.sign(
    {
      sub: targetUser.id,
      role: targetUser.role,
      email: targetUser.email,
      type: "impersonation",
      impersonatedBy: adminUserId,
    },
    config.jwtAccessSecret,
    { expiresIn: "30m" },
  );
}

function signMfaToken(userId, mfaId) {
  return jwt.sign({ sub: userId, mfaId, type: "mfa_pending" }, config.jwtMfaSecret, {
    expiresIn: "10m",
  });
}

function verifyAccessToken(token) {
  return jwt.verify(token, config.jwtAccessSecret);
}

function verifyMfaToken(token) {
  return jwt.verify(token, config.jwtMfaSecret);
}

function hashToken(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function createOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function createRandomToken() {
  return crypto.randomBytes(24).toString("hex");
}

function createCsrfToken() {
  return crypto.randomBytes(20).toString("hex");
}

module.exports = {
  signAccessToken,
  signImpersonationToken,
  signMfaToken,
  verifyAccessToken,
  verifyMfaToken,
  hashToken,
  createOtpCode,
  createRandomToken,
  createCsrfToken,
};
