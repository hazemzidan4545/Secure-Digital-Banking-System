# Backend Role Documentation

## 1) Role Scope

The Backend role is responsible for:

- Implementing secure business logic and API contracts
- Enforcing authentication, authorization, and request validation
- Applying threat controls for brute force, CSRF, and abuse scenarios
- Producing audit evidence and security-relevant telemetry

## 2) Backend Module Design and Interfaces

### 2.1 Core Modules

- Main API and security middleware: `backend/src/server.js`
- Configuration and environment mapping: `backend/src/config.js`
- Database integration (PostgreSQL)

### 2.2 Internal Backend Interfaces

- Middleware interfaces:
  - `requireAuth` for authenticated access
  - role-check middleware for RBAC enforcement
  - CSRF check middleware for state-changing routes
- Service-level interfaces:
  - Auth services: register, login, MFA verification, logout, password reset
  - Account services: account summary and transfer processing
  - Admin services: audit retrieval/export, suspicious activity scoring

### 2.3 Role-Specific Module Interface Map

| Backend Module | Interface | Security Responsibility |
|---|---|---|
| `requireAuth` middleware | Requires valid access cookie token | Prevents unauthenticated access |
| `requireActiveSession` middleware | Checks idle timeout and token activity | Enforces inactivity session expiry |
| `requireRole("admin")` middleware | Restricts endpoint execution by role | Enforces RBAC segregation |
| `requireCsrf` middleware | Verifies cookie/header token match | Prevents CSRF on unsafe methods |
| Transfer handler (`POST /api/transfers`) | Validates amount/account and policy thresholds | Enforces anti-abuse transaction controls |

### 2.4 External API Interface (Implemented)

- Authentication endpoints:
  - `POST /api/auth/register`
  - `POST /api/auth/login`
  - `POST /api/auth/mfa/verify`
  - `GET /api/auth/me`
  - `POST /api/auth/logout`
  - `POST /api/auth/password-reset/request`
  - `POST /api/auth/password-reset/confirm`
- Account endpoints:
  - `GET /api/accounts/me`
  - `POST /api/transfers`
- Admin endpoints:
  - `GET /api/admin/audit-logs`
  - `GET /api/admin/audit-logs.csv`
  - `GET /api/admin/suspicious-activity`

## 3) Security Principles Applied in Backend Implementation

### 3.1 Authentication and Password Security

- Password hashing with bcrypt
- MFA verification flow for stronger login assurance
- JWT-based session handling with secure cookie use

### 3.2 Authorization and Segregation of Duties

- RBAC enforced per endpoint and operation
- Admin-only paths for sensitive audit and detection functions

### 3.3 Input Safety and Abuse Protection

- Request validation for transfer and auth payloads
- Parameterized SQL queries to mitigate SQL injection
- Login lockout/rate limits to reduce brute-force risk
- Transfer caps and suspicious activity scoring to reduce fraud risk

### 3.4 Integrity and Accountability

- Audit logging for security-relevant operations
- CSV export support for compliance and review artifacts

## 4) Backend Functional Testing (Role Responsibility)

### 4.1 Tested Functional Areas

- Login + MFA success/failure paths
- Lockout behavior after repeated failed authentication
- CSRF enforcement on state-changing endpoints
- RBAC enforcement for role-restricted APIs
- Transfer cap and suspicious activity detection behavior
- Audit filtering and export behavior

### 4.2 Evidence References

- `SECURITY_TEST_REPORT.md`
- `REQUIREMENT_EVIDENCE_MATRIX.md`
- `docs/roles/ROLE_TESTING_RESULTS.md`

## 5) Backend Security Outcomes

- Core security controls are implemented and demonstrated in tests.
- Backend enforces security policies independent of frontend behavior.
- Evidence artifacts support grading on secure implementation and testing.
