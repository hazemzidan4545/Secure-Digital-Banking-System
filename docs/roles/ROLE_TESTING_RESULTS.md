# Role-Based Functional Testing Results

This document organizes functional testing evidence by role to match submission requirements.

## Latest Automated Backend Execution (March 23, 2026)

- Command: `cd backend && npm test -- --runInBand`
- Test suites: `5 passed, 5 total`
- Tests: `2 skipped, 26 passed, 28 total`
- Scope note: remaining skipped tests are payment-provider scenarios in `providerLifecycle.test.js` that are intentionally marked out of current implementation scope.

## Latest Automated Frontend Execution (March 24, 2026)

- Command: `cd frontend && npm test -- --runInBand`
- Test suites: `3 passed, 3 total`
- Tests: `12 passed, 12 total`
- Evidence log: `docs/evidence/frontend_jest_results_2026-03-24.txt`

## 1) Frontend Role Testing

| Test ID | Test Case | Expected Result | Result |
|---|---|---|---|
| FE-01 | Unauthenticated access to protected route | Redirect to login page | Pass |
| FE-02 | Customer role opens admin page route | Access denied/redirected by route guard | Pass |
| FE-03 | Login + MFA UI flow | User reaches authorized dashboard | Pass |
| FE-04 | Transfer form invalid input | Validation feedback shown, no unsafe request | Pass |
| FE-05 | Notification lifecycle | Message auto-dismisses after timeout | Pass |

## 2) Backend Role Testing

| Test ID | Test Case | Expected Result | Result |
|---|---|---|---|
| BE-01 | Valid login with MFA verification | Auth success and session established | Pass |
| BE-02 | Repeated failed logins | Account lockout enforced | Pass |
| BE-03 | Missing/invalid CSRF token on state-changing route | Request blocked | Pass |
| BE-04 | Unauthorized role calls admin endpoint | Access denied by RBAC | Pass |
| BE-05 | Transfer exceeding configured cap | Request denied with policy response | Pass |
| BE-06 | Suspicious transfer behavior | Elevated suspicious score produced | Pass |
| BE-07 | Audit query with filters/pagination | Correct subset returned | Pass |
| BE-08 | Audit CSV export endpoint | Downloaded export generated | Pass |

## 3) DevOps Role Testing

| Test ID | Test Case | Expected Result | Result |
|---|---|---|---|
| DO-01 | Start full stack via Docker Compose | All required services become healthy/reachable | Pass |
| DO-02 | API path through Nginx proxy | Requests forwarded correctly to backend | Pass |
| DO-03 | Security headers from proxy | Required headers present in responses | Pass |
| DO-04 | Rate limiting behavior | Excess requests constrained by proxy policy | Pass |
| DO-05 | Environment variable configuration | Services boot with valid runtime configuration | Pass |

## 4) Consolidated Evidence Sources

- `SECURITY_TEST_REPORT.md` contains control-level security test details.
- `REQUIREMENT_EVIDENCE_MATRIX.md` contains requirement coverage with Met/Partial/Gap notes.

## 5) Notes

- Results reflect current implementation scope and implemented controls.
- Production-hardening gaps documented in matrix/report remain tracked separately and do not invalidate demonstrated role-functional correctness.
