# Testing Document

Date: April 1, 2026  
Project: Secure Digital Banking Platform  
Scope: Security-focused testing across Frontend, Backend, and DevOps

This document follows the required structure:
- Section 1: Frontend Testing (max 5 pages)
- Section 2: Backend Testing (max 5 pages)
- Section 3: DevOps Testing (max 5 pages)

Each scenario is written in the required format:
- Input
- Background Process
- Output

---

## Section 1: Frontend Testing

### Frontend Scenario 1 (FE-SEC-01): CSRF Header Injection on State-Changing Requests

Objective:
- Verify that state-changing frontend requests include CSRF header values and fail safely when token validation fails.

Input:
- User is authenticated and has `csrf_token` cookie set by backend.
- User submits transfer form from UI:
  - `toAccountNumber = "1000000001"`
  - `amount = 500`
  - `note = "Invoice #42"`
- Browser sends `POST /api/transfers`.

Background Process:
- In frontend API layer, request interceptor in `frontend/src/api.js` checks HTTP method.
- For `POST/PUT/PATCH/DELETE`, it reads `csrf_token` from `document.cookie` using `getCookie()`.
- Interceptor attaches `x-csrf-token` header before sending request.
- Backend receives both cookie token and header token, then compares values in CSRF middleware.
- If header is missing or mismatched, request is rejected before business logic executes.

Output:
- Success case: transfer request proceeds and UI shows success message.
- Failure case (token missing/mismatch): backend returns `403`, frontend error handler maps `response.data.error` to a user-visible alert.
- Final data state: no transfer row is inserted when CSRF validation fails.

### Frontend Scenario 2 (FE-SEC-02): Route Guard Enforcement (Unauthorized Access Prevention)

Objective:
- Verify client-side route guards prevent unauthorized rendering of protected pages.

Input:
- User directly opens protected route URL in browser (for example `/admin/audit`).
- Session state in frontend has either:
  - `user = null`, or
  - `user.role = "user"` for admin route.

Background Process:
- React Router route wrappers execute in `frontend/src/components/RouteGuards.jsx`.
- `PrivateRoute` checks if `user` exists; unauthenticated users are redirected to `/login`.
- `AdminRoute` checks `user.role === "admin"`; non-admin users are redirected to dashboard.
- `UserRoute` blocks admins from user-only pages unless `is_impersonating` is true.
- This authorization gate runs before protected component rendering, preventing sensitive UI state exposure.

Output:
- Unauthenticated user: redirected to login page.
- Authenticated non-admin on admin page: redirected to dashboard.
- Final UI state: protected page content is not mounted for unauthorized contexts.
- Final data state: no privileged admin API action is triggered from blocked route.

### Frontend Scenario 3 (FE-SEC-03): Session Timeout Enforcement from Inactivity

Objective:
- Verify inactivity timeout logic logs out the user, clears state, and blocks access to protected pages.

Input:
- Authenticated user logs in successfully.
- User remains inactive longer than configured timeout window (default 10 minutes).

Background Process:
- In `frontend/src/App.jsx`, frontend stores last activity timestamp (`lastActivityAt`) and updates it on user events (keyboard, mouse, touch, scroll).
- Timer checks elapsed time in intervals.
- Once elapsed inactivity exceeds timeout, frontend calls logout flow.
- Logout request is sent to backend; frontend clears in-memory state (`user`, accounts, cards, notifications).
- Timeout notice is shown to user and route is moved to `/login`.

Output:
- Backend returns logout response (`200` in normal path) and invalidates session context.
- UI displays timeout message: session expired due to inactivity.
- Final state: user is no longer authenticated in frontend; protected pages are inaccessible.

### Frontend Scenario 4 (FE-SEC-04): MFA Verification Input and Authentication Completion

Objective:
- Verify second-factor verification is mandatory before frontend transitions to authenticated state.

Input:
- User enters correct credentials on login form.
- Backend responds `requiresMfa = true` and issues pending MFA cookie.
- User enters 6-digit OTP code (example: `123456`) in MFA form.

Background Process:
- `handleVerifyMfa()` in `frontend/src/App.jsx` submits `POST /api/auth/mfa/verify`.
- Axios interceptor attaches CSRF header for this POST request.
- Backend verifies pending MFA token and bcrypt-hashed OTP record.
- On success, backend issues access token cookie + CSRF cookie and ends pending MFA state.
- Frontend refreshes current user (`/api/auth/me`) and updates application auth state.

Output:
- Correct OTP: `200`, user lands in authenticated dashboard.
- Invalid OTP: `401`, frontend shows error feedback and keeps user on MFA page.
- Final state: access is granted only after successful second factor verification.

### Frontend Scenario 5 (FE-SEC-05): Password Policy and Strength Logic Before Submission

Objective:
- Verify frontend enforces password-policy checks and strength feedback before submission.

Input:
- User types candidate password values in register/reset form.
- Example weak input: `abc123`.
- Example strong input: `StrongPass123!`.

Background Process:
- `getPasswordPolicyErrors()` in `frontend/src/utils/securityUi.js` validates:
  - minimum length 10
  - lowercase
  - uppercase
  - number
  - special character
- `getPasswordStrength()` computes score from 0 to 5 based on same constraints.
- `strengthLabel()` maps score to Weak/Medium/Strong.
- Frontend shows policy feedback before submit, reducing bad requests sent to backend.

Output:
- Weak password: UI displays unmet policy requirements; submit is blocked or rejected after backend validation.
- Strong password: request proceeds to backend.
- Final state: invalid credentials are filtered early at UI layer and validated again server-side.

---

## Section 2: Backend Testing

### Backend Scenario 1 (BE-SEC-01): Brute-Force Login Lockout

Objective:
- Verify repeated failed login attempts trigger lockout controls and prevent credential stuffing progression.

Input:
- Same user account receives repeated login attempts with wrong password.
- Sequence: 5 consecutive invalid passwords in lockout window.

Background Process:
- Login endpoint (`POST /api/auth/login`) loads user row and counters (`failed_login_attempts`, `locked_until`).
- Password comparison uses `bcrypt.compare()`.
- For each failed attempt, counter increments.
- On threshold (`MAX_FAILED_LOGIN_ATTEMPTS`, default 5), backend sets:
  - `is_locked = true`
  - `locked_until = NOW() + LOGIN_LOCKOUT_MINUTES`
- Audit event is written for lockout event.

Output:
- Attempts before threshold: `401 Invalid credentials`.
- Threshold attempt and while locked: `423 Account temporarily locked`.
- Final database state: lock metadata persisted in `users` table until timeout expires.

### Backend Scenario 2 (BE-SEC-02): MFA Attempt Limiting and OTP Validation

Objective:
- Verify MFA verification path enforces expiration and attempt limits against OTP brute-force attacks.

Input:
- User reaches MFA challenge phase after valid email/password.
- User submits wrong OTP code repeatedly (6 attempts).

Background Process:
- Backend stores OTP hash in `mfa_codes` using bcrypt and expiry timestamp.
- On each verify request:
  - checks pending MFA token validity
  - checks code record expiry/consumed status
  - compares user input with stored hash via `bcrypt.compare()`
- `attempts` counter increments for each failure.
- At attempts >= 5, backend blocks additional tries to prevent brute-force OTP guessing.

Output:
- Wrong code before limit: `401 Invalid MFA code`.
- Sixth invalid attempt: `429 Too many invalid MFA attempts`.
- Final data state: MFA row reflects attempt count; access token is never issued for failed MFA path.

### Backend Scenario 3 (BE-SEC-03): CSRF Enforcement Order in Middleware Chain

Objective:
- Verify middleware order enforces authentication first, then CSRF validation for authenticated unsafe requests.

Input:
- Client sends unsafe request (`POST /api/transfers`) under two cases:
  - Case A: no auth cookie, no CSRF header.
  - Case B: auth cookie present, missing/invalid CSRF header.

Background Process:
- Route middleware stack executes in order:
  1. `requireAuth`
  2. `requireActiveSession`
  3. `requireCsrf`
- Case A fails immediately in `requireAuth` (authentication gate before CSRF).
- Case B passes auth/session and then fails in `requireCsrf` if tokens differ.
- This ordering avoids exposing CSRF behavior to unauthenticated traffic and still strictly enforces anti-CSRF for authenticated writes.

Output:
- Case A: `401 Authentication required`.
- Case B: `403 CSRF validation failed`.
- Final data state: transfer operation is not executed in either failure path.

### Backend Scenario 4 (BE-SEC-04): RBAC Enforcement on Admin Audit Endpoint

Objective:
- Verify admin-only endpoints are inaccessible to unauthenticated and non-admin users.

Input:
- Request to admin endpoint `GET /api/admin/audit-logs` with three caller types:
  - unauthenticated
  - authenticated normal user
  - authenticated admin user

Background Process:
- `requireAuth` validates access token cookie.
- `requireActiveSession` verifies session has not timed out.
- `requireRole("admin")` checks role claim in token payload.
- Only admin request reaches SQL query that returns audit logs with filters/pagination.

Output:
- Unauthenticated: `401`.
- Non-admin: `403`.
- Admin: `200` with audit log payload.
- Final state: only privileged role can read security-event history.

### Backend Scenario 5 (BE-SEC-05): Encryption of Transaction Notes at Rest

Objective:
- Verify sensitive transfer notes are encrypted at rest and only decrypted for authorized reads.

Input:
- Authenticated user sends transfer with plaintext note:
  - `note = "Payment for invoice #42"`

Background Process:
- Database has `pgcrypto` extension enabled.
- During transfer insert, backend stores sensitive note in encrypted form (`note_ciphertext`) using `pgp_sym_encrypt()` and runtime key (`DB_ENCRYPTION_KEY`).
- Plaintext note column remains null/unused for protected data path.
- During statement retrieval, backend conditionally decrypts with `pgp_sym_decrypt()` when key is available and user is authorized.

Output:
- API response: transfer success (`201`/`200` depending route response path).
- Database state:
  - ciphertext stored in `transactions.note_ciphertext` as binary data
  - plaintext not stored in clear text field for encrypted records
- Retrieval output to authorized caller: decrypted note string is returned in statement data.

---

## Section 3: DevOps Testing

### DevOps Scenario 1 (DO-SEC-01): HTTPS Redirect and TLS 1.3 Enforcement

Objective:
- Verify production ingress enforces encrypted transport and prevents insecure plain-HTTP access.

Input:
- Client requests banking app over plain HTTP (`http://host/...`).
- Client then connects via HTTPS.

Background Process:
- Nginx production config on port 80 returns `301` redirect to HTTPS.
- TLS server on port 443 is configured with:
  - `ssl_protocols TLSv1.3`
  - HSTS header (`max-age=31536000; includeSubDomains`)
  - session tickets disabled (`ssl_session_tickets off`)
- Backend API is proxied only through HTTPS ingress in production profile.

Output:
- HTTP request: redirected to HTTPS endpoint.
- HTTPS response includes strict transport and hardening headers.
- Final transport state: client-server communication is encrypted and downgrade risk is reduced.

### DevOps Scenario 2 (DO-SEC-02): Container Privilege Restriction and Filesystem Hardening

Objective:
- Verify runtime hardening controls reduce privilege-escalation and filesystem-tampering risk.

Input:
- Production stack starts backend and nginx services via `docker-compose.prod.yml`.
- Simulated malicious process attempts privilege escalation or filesystem writes.

Background Process:
- Compose security settings enforce:
  - `no-new-privileges:true`
  - `cap_drop: ALL`
  - `read_only: true`
  - `tmpfs` for required writable paths
- Backend image runs as non-root user in production Dockerfile.
- Nginx receives only `NET_BIND_SERVICE` capability as minimal exception for binding service port.

Output:
- Unauthorized escalation/write attempts fail at runtime due to container policy.
- Services remain operational with least-privilege profile.
- Final infrastructure state: reduced blast radius if app-level compromise occurs.

### DevOps Scenario 3 (DO-SEC-03): API Rate Limiting at Reverse Proxy Layer

Objective:
- Verify reverse-proxy throttling limits burst traffic before backend resource exhaustion occurs.

Input:
- Single IP sends burst traffic to `/api/*` exceeding configured threshold.

Background Process:
- Nginx defines `limit_req_zone` and applies `limit_req` in `/api/` location.
- Requests inside normal rate are proxied to backend.
- Excess requests are delayed/rejected according to configured rate + burst behavior.
- Backend is shielded from uncontrolled request spikes before app code executes.

Output:
- Normal traffic: proxied successfully to API.
- Excess traffic: rate-limited responses (`429` behavior depending runtime handling).
- Final platform state: backend resource pressure is reduced during flooding patterns.

### DevOps Scenario 4 (DO-SEC-04): Production Secret Presence Enforcement

Objective:
- Verify deployment fails safely if mandatory production secrets are not provided.

Input:
- Operator starts production compose profile with missing required secret variables.
- Example missing values: `DB_ENCRYPTION_KEY`, `JWT_ACCESS_SECRET`.

Background Process:
- Compose uses required-variable syntax `${VAR:?set in .env}` for critical secrets.
- Startup fails immediately when required secrets are absent.
- Backend config additionally validates production environment with `requireEnv()` checks.
- This prevents insecure boot with default or empty credentials.

Output:
- Deployment fails fast with clear configuration error.
- Service does not start in insecure configuration.
- Final state: production runtime only starts when mandatory secret set is present.

### DevOps Scenario 5 (DO-SEC-05): Container Vulnerability Scan Evidence and Remediation Loop

Objective:
- Verify container-security testing includes repeatable scan evidence and remediation feedback loops.

Input:
- Security team scans production images using Trivy.
- Scan artifacts produced for backend and nginx images.

Background Process:
- Trivy analyzes OS packages and dependencies in built images.
- Findings are exported to table and JSON evidence files.
- Team reviews severity levels (including HIGH/CRITICAL where present).
- Remediation path: update base images/packages, rebuild containers, re-run scans, compare delta.

Output:
- Evidence files document current vulnerability posture.
- Risk is measurable and trackable over time through repeated scan cycles.
- Final DevOps state: security testing includes continuous vulnerability assessment, not one-time checks.

---

## Evidence References Used in This Document

- Frontend tests: `docs/evidence/frontend_jest_results_2026-03-24.txt`
- Backend tests: `docs/evidence/backend_jest_results_2026-03-23.txt`
- Backend security report: `SECURITY_TEST_REPORT.md`
- Requirement mapping: `REQUIREMENT_EVIDENCE_MATRIX.md`
- DB encryption evidence: `docs/evidence/DB_ENCRYPTION_EVIDENCE.md`
- Container scan evidence: `docs/evidence/CONTAINER_SCAN_EVIDENCE.md`
- Production runtime config: `docker-compose.prod.yml`
- Production reverse proxy config: `nginx/default.prod.conf`

## Conclusion

The three required testing sections are covered with detailed security scenarios and hidden technical logic. Each scenario documents concrete inputs, internal processing (functions, middleware, encryption, runtime controls), and measurable outputs (UI behavior, HTTP status, and/or resulting data/infrastructure state). This provides clear proof of implementation understanding, not only feature usage.
