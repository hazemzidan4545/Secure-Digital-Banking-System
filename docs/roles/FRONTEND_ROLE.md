# Frontend Role Documentation

## 1) Role Scope

The Frontend role is responsible for:

- User-facing security flows and secure interaction patterns
- Role-aware navigation and route access control
- Safe request handling with CSRF token propagation
- UI behavior that supports secure usage and auditability

## 2) Frontend Module Design and Interfaces

### 2.1 Core Modules

- Routing and app orchestration: `frontend/src/App.jsx`
- Layout and navigation shell: `frontend/src/components/Layout.jsx`
- Route protection logic: `frontend/src/components/RouteGuards.jsx`
- Feature pages:
  - Auth pages: `frontend/src/pages/AuthPages.jsx`
  - Account pages: `frontend/src/pages/AccountPages.jsx`
  - Admin pages: `frontend/src/pages/AdminPages.jsx`
- Security UI helpers: `frontend/src/utils/securityUi.js`

### 2.2 Interfaces Between Frontend Modules

- App state interface (in `App.jsx`):
  - `user`, `token`, `csrfToken`, `notifications`, `loadingState`
- Route guard interface:
  - Input: current user role and authentication status
  - Output: allow route, redirect to login, or block unauthorized route
- Page component interface:
  - Input props: API methods, role context, and UI callbacks
  - Output: events for login, transfer, beneficiary actions, audit filtering

### 2.3 Role-Specific Module Interface Map

| Frontend Module | Interface | Security Responsibility |
|---|---|---|
| `App.jsx` | Global app/session state and route transitions | Controls auth state transitions and timeout logout UX |
| `RouteGuards.jsx` | Route gating based on role/auth context | Enforces frontend-level least privilege navigation |
| `api.js` | `apiFetch(path, options)` wrapper | Ensures cookie credentials and CSRF header usage |
| `AuthPages.jsx` | Login/register/MFA/reset forms | Validates user input before auth API calls |
| `AdminPages.jsx` | Audit and suspicious activity views | Limits admin workflows to admin route context |

### 2.4 Frontend to Backend API Interface (Implemented)

- `POST /api/auth/login`
- `POST /api/auth/mfa/verify`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/accounts/me`
- `POST /api/transfers`
- `GET /api/admin/audit-logs`
- `GET /api/admin/audit-logs.csv`
- `GET /api/admin/suspicious-activity`

Request/response contracts are consumed through fetch calls and mapped to page-level UI states.

## 3) Security Principles Applied in Frontend Implementation

### 3.1 Access Control and Least Privilege

- Route-level guards enforce role access before rendering sensitive pages.
- Navigation options are role-filtered so users only see allowed actions.

### 3.2 CSRF and Session Safety

- CSRF token is fetched and attached to state-changing requests.
- Session timeout handling drives logout/reauthentication UX behavior.

### 3.3 Secure UX and Error Handling

- Validation and constrained form inputs reduce invalid requests.
- Notifications auto-dismiss to reduce stale sensitive messages on screen.
- Generic error messaging avoids exposing backend internals.

### 3.4 Accessibility and Safe Interaction

- Focus management and skip links support secure and reliable navigation.
- Reduced-motion fallback reduces usability risk in critical flows.

## 4) Frontend Functional Testing (Role Responsibility)

### 4.1 Tested Functional Areas

- Authentication flow and MFA screens
- Route blocking for unauthorized role/page combinations
- Transfer form validation and feedback
- Audit table filtering and pagination behavior
- Notification lifecycle (appearance and auto-dismiss)

### 4.2 Evidence References

- `SECURITY_TEST_REPORT.md`
- `REQUIREMENT_EVIDENCE_MATRIX.md`
- `docs/roles/ROLE_TESTING_RESULTS.md`
- `docs/evidence/frontend_jest_results_2026-03-24.txt`

## 5) Frontend Security Outcomes

- Frontend enforces role-aware UX boundaries and secure request behavior.
- Sensitive interactions are routed through guarded screens and validated actions.
- UI supports reliability, usability, and security traceability for demonstration.
