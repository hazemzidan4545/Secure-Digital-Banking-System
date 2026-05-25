# Requirement to Evidence Matrix

Date: March 22, 2026
Project: Secure Digital Banking Platform

## Legend
- Status `Met`: Implemented and evidenced in code/artifacts
- Status `Partial`: Implemented partially or not fully evidenced for production
- Status `Gap`: Not implemented/evidenced yet

## 1) Frontend Security Requirements

| Requirement | Status | Evidence | Notes / Next Action |
|---|---|---|---|
| Input validation to prevent XSS-style abuse | Met | `frontend/src/App.jsx` | Client-side validation exists on auth/transfer/reset forms. |
| Content Security Policy (CSP) | Met | `backend/src/server.js`, `nginx/default.conf` | CSP headers are present via Helmet/Nginx. |
| Disable inline JavaScript | Met | `frontend/src/**` | No inline JS usage in rendered HTML templates. |
| Secure cookies (HttpOnly/Secure/SameSite) | Met | `backend/src/server.js` | `httpOnly`, `sameSite: strict`, `secure` in production. |
| Token-based authentication with JWT expiry | Met | `backend/src/security.js`, `backend/src/server.js` | JWT access + pending MFA tokens with expiry. |
| Secure token storage (avoid localStorage) | Met | `frontend/src/api.js`, `backend/src/server.js` | Cookie-based tokens; no localStorage auth storage. |
| MFA integrated at client interface | Met | `frontend/src/App.jsx`, `backend/src/server.js` | Login -> MFA verify flow implemented. |
| Automatic session timeout for inactivity | Met | `backend/src/server.js`, `frontend/src/App.jsx` | Session idle timeout enforced and surfaced in UI. |
| Anti-CSRF request validation | Met | `backend/src/server.js`, `frontend/src/api.js` | Double-submit token model enforced. |
| Validate API responses before rendering | Partial | `frontend/src/App.jsx` | Basic handling exists; stronger schema validation can be added. |
| Frontend behavioral monitoring | Partial | `frontend/src/pages/AdminPages.jsx`, `backend/src/server.js` | Suspicious activity dashboard exists, not real-time push analytics. |
| Security notifications and user feedback | Met | `frontend/src/App.jsx`, `frontend/src/components/Layout.jsx` | Toast-style notice stack, session timeout and helper signals. |

## 2) Backend Security Requirements

| Requirement | Status | Evidence | Notes / Next Action |
|---|---|---|---|
| Secure backend architecture and reliability basics | Met | `backend/src/server.js`, `backend/src/config.js` | Layered middleware + route protections implemented. |
| Parameterized SQL queries | Met | `backend/src/server.js` | All DB operations use parameter placeholders. |
| Password hashing (bcrypt) | Met | `backend/src/server.js` | Passwords hashed with bcrypt before storage. |
| Session/auth token protection | Met | `backend/src/server.js`, `backend/src/security.js` | JWT + cookie controls + lockout + timeout. |
| MFA for identity assurance | Met | `backend/src/server.js` | OTP MFA challenge/verify flow present. |
| RBAC authorization | Met | `backend/src/server.js` | Admin endpoints protected via role guard. |
| Audit logging for unusual activity | Met | `backend/src/server.js` | Audit logs, filtering, pagination, CSV export. |
| OAuth 2.0 support | Gap | N/A | Not implemented; current solution uses JWT + MFA only. |
| Database encryption at rest / KMS / TDE evidence | Partial | `backend/db/schema.sql`, `backend/src/server.js`, `docs/evidence/DB_ENCRYPTION_EVIDENCE.md` | Application-layer at-rest encryption implemented for sensitive transaction notes; full disk-level encryption evidence depends on deployment platform controls. |
| Data in transit encrypted with TLS in deployment | Partial | `nginx/default.prod.conf`, `docker-compose.prod.yml` | TLS 1.3 config is implemented; requires certificate provisioning in deployment environment. |

## 3) DevOps / Infrastructure Requirements

| Requirement | Status | Evidence | Notes / Next Action |
|---|---|---|---|
| Containerized deployment (frontend/backend/db) | Met | `docker-compose.yml`, `backend/Dockerfile`, `frontend/Dockerfile` | Multi-service compose architecture is implemented. |
| Reverse proxy + security headers + rate limiting | Met | `nginx/default.conf`, `backend/src/server.js` | Nginx + Express rate limits and headers enabled. |
| Network/service segmentation | Met | `docker-compose.prod.yml` | Production profile removes DB host port exposure and keeps DB internal to compose network. |
| TLS 1.3 enforced for production traffic | Partial | `nginx/default.prod.conf`, `docker-compose.prod.yml` | TLS 1.3 and HTTPS redirect implemented; deployment cert lifecycle must be managed externally. |
| Container hardening (non-root, minimal caps, scans) | Partial | `backend/Dockerfile.prod`, `docker-compose.prod.yml`, `docs/evidence/CONTAINER_SCAN_EVIDENCE.md` | Non-root backend and runtime capability restrictions implemented with Trivy scan artifacts; ongoing patch/rebuild cycle required for CVE reduction. |
| Firewall/open-port minimization evidence | Partial | `docker-compose.yml`, `nginx/default.conf` | Reduced exposure by proxy pattern; formal firewall policy not documented. |

## 4) Threat/Risk Coverage Mapping

| Threat | Coverage | Evidence |
|---|---|---|
| XSS | Covered (primary controls) | CSP + input validation (`backend/src/server.js`, `frontend/src/App.jsx`) |
| CSRF | Covered | CSRF middleware + header token (`backend/src/server.js`, `frontend/src/api.js`) |
| Session hijacking | Covered (mitigated) | HttpOnly cookies, JWT expiry, idle timeout, lockout |
| SQL injection | Covered | Parameterized queries in backend routes |
| Unauthorized admin access | Covered | RBAC guards (`requireRole('admin')`) |
| Brute force login | Covered | Failed-attempt tracking + account lockout |
| DDoS / request flooding | Covered (baseline) | Nginx and Express rate limiting |
| MITM / downgrade | Partial | Full TLS deployment evidence pending |
| Container privilege escalation | Partial | Needs hardened runtime settings and scan artifacts |

## 5) Implemented Artifacts for Submission

- Core implementation summary: `README.md`
- Frontend route/UX summary: `frontend/README.md`
- Frontend Jest execution log (dated): `docs/evidence/frontend_jest_results_2026-03-24.txt`
- Security test report: `SECURITY_TEST_REPORT.md`
- Backend test script: `backend/test-security.js`
- Backend Jest execution log (dated): `docs/evidence/backend_jest_results_2026-03-23.txt`
- Standalone security script execution note (dated): `docs/evidence/security_script_results_2026-03-23.txt`
- Compose/infra configs: `docker-compose.yml`, `nginx/default.conf`
- Production hardening profile: `docker-compose.prod.yml`, `backend/Dockerfile.prod`, `nginx/Dockerfile.prod`, `nginx/default.prod.conf`
- Encryption evidence artifacts: `docs/evidence/DB_ENCRYPTION_EVIDENCE.md`, `docs/evidence/db_encryption_query_output.txt`, `docs/evidence/db_encryption_hex_sample.txt`
- Container scan artifacts: `docs/evidence/CONTAINER_SCAN_EVIDENCE.md`, `docs/evidence/trivy_backend_table.txt`, `docs/evidence/trivy_nginx_table.txt`, `docs/evidence/trivy_backend.json`

## 6) Remaining Work (High Priority for Full Compliance)

1. Add deployment-platform disk encryption evidence (managed volume encryption/KMS/TDE) for full infrastructure-level coverage.
2. Decide whether OAuth 2.0 is mandatory; if yes, implement provider flow.
3. Apply base image patch updates and re-scan to reduce current HIGH/CRITICAL CVEs.
4. Add OWASP ZAP/Burp test output screenshots/logs for report appendix.

## 7) Recommended Final Submission Statement

"The project meets the core implementation requirements for a secure digital banking prototype across frontend, backend, and infrastructure layers, with demonstrated controls for authentication, MFA, CSRF prevention, RBAC, auditability, transfer abuse controls, and session security. A production deployment profile with TLS 1.3 configuration, HTTPS redirect, non-root backend runtime, and restricted container capabilities is implemented. Remaining production-level controls are database encryption-at-rest evidence, container image scanning evidence, and optional OAuth 2.0 integration depending on final assessment scope."
