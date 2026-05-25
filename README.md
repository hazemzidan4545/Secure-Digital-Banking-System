# Secure Banking Project Starter

This repository contains the initial implementation for your security-focused digital banking project.

## Implemented in this starter

- React frontend with flows for:
  - Register
  - Login + MFA verification
  - Password reset request/confirm
  - Account dashboard
  - Transfer simulation
  - Admin read-only audit log view
  - Admin audit CSV export
- Node.js + Express backend with:
  - Helmet security headers
  - CORS allowlist
  - Cookie-based auth session
  - Double-submit CSRF token check
  - JWT-based access and pending-MFA tokens
  - Email OTP challenge and verification flow (local Docker testing can retrieve OTP via MailHog)
  - Transfer caps (per transfer, daily, hourly count)
  - Login brute-force protection (temporary lockout after repeated failures)
  - Inactivity-based session timeout enforcement
  - Strong password policy on registration and reset
  - Admin suspicious-activity risk scoring endpoint
  - Audit logging
- PostgreSQL schema for users/accounts/transactions/MFA/reset/audit
- Docker Compose with Nginx reverse proxy

## Quick start (Docker)

1. Open a terminal in this folder.
2. Run:

```powershell
docker compose up --build
```

3. Open:

- App: http://localhost:8081
- Backend health: http://localhost:8081/api/health

## Production profile (Docker + TLS)

The repository now includes a hardened production-oriented profile:

- `docker-compose.prod.yml`
- `backend/Dockerfile.prod`
- `nginx/Dockerfile.prod`
- `nginx/default.prod.conf`

### 1) Create production environment file

Create a `.env` file in the project root (used by compose):

```env
POSTGRES_PASSWORD=change_this_strong_password
DB_ENCRYPTION_KEY=change_this_long_random_db_encryption_key
JWT_ACCESS_SECRET=change_this_long_random_secret
JWT_MFA_SECRET=change_this_long_random_secret
JWT_PASSWORD_RESET_SECRET=change_this_long_random_secret
FRONTEND_ORIGIN=https://localhost
```

### 2) Provide TLS certificate files

Create `certs/` in project root and place:

- `certs/fullchain.pem`
- `certs/privkey.pem`

For local validation only, you can generate self-signed certs:

```powershell
mkdir certs
openssl req -x509 -nodes -days 365 -newkey rsa:2048 `
  -keyout certs/privkey.pem -out certs/fullchain.pem `
  -subj "/CN=localhost"
```

### 3) Run production profile

```powershell
docker compose -f docker-compose.prod.yml up --build -d
```

### 4) Verify endpoints

- App: `https://localhost`
- Health: `https://localhost/healthz`

## Security evidence artifacts

- Database encryption evidence: `docs/evidence/DB_ENCRYPTION_EVIDENCE.md`
- Container scan evidence: `docs/evidence/CONTAINER_SCAN_EVIDENCE.md`

## Local development without Docker

### Backend

1. Copy `backend/.env.example` to `backend/.env` and adjust values.
2. Ensure PostgreSQL is running and `DATABASE_URL` is valid.
3. Run:

```powershell
cd backend
npm install
npm run dev
```

### Backend lifecycle integration tests

Run focused provider/payment lifecycle suites:

```powershell
cd backend
npm run test:lifecycle
```

If repeated local runs trigger auth rate-limit noise, restart backend first and run clean:

```powershell
cd backend
npm run test:lifecycle:clean
```

## Operations and reliability

- Worker health endpoint: `GET /api/health/workers`
  - Includes uptime and recurring/provider-worker runtime metrics (busy state, last run timestamps, duration, and last error).
- Startup schema preflight:
  - Backend now validates critical provider columns, constraints, and indexes before listening.
  - Controlled by `DB_PREFLIGHT_ENABLED` (default `true`).
- Tunable API/auth rate limits:
  - `API_RATE_LIMIT_WINDOW_MS`, `API_RATE_LIMIT_MAX`
  - `AUTH_RATE_LIMIT_WINDOW_MS`, `AUTH_RATE_LIMIT_MAX`

## CI lifecycle gate

- Workflow: `.github/workflows/backend-lifecycle.yml`
- Triggers on backend and compose changes.
- Builds the stack with Docker Compose, waits for readiness, runs lifecycle suites, and always tears down containers.

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173` and proxies `/api` to backend.

## Important notes

- MFA login returns `requiresMfa: true` and sends OTP through the configured provider flow (MailHog in local Docker setup).
- Password reset token is returned in dev response (`devResetToken`).
- The backend auto-applies `db/schema.sql` on startup.
- A development admin user is auto-seeded on backend startup:
  - Email: admin@aegisbank.local
  - Password: AdminPass123!
- You can override admin seed settings via backend environment variables.
- Login lockout defaults:
  - `MAX_FAILED_LOGIN_ATTEMPTS=5`
  - `LOGIN_LOCKOUT_MINUTES=10`
- Session timeout default:
  - `SESSION_IDLE_TIMEOUT_MINUTES=10`
- Suspicious activity defaults:
  - `SUSPICIOUS_ACTIVITY_LOOKBACK_MINUTES=60`
  - `SUSPICIOUS_ACTIVITY_MIN_RISK_SCORE=3`
- For production, rotate secrets, remove dev token exposure, enforce HTTPS/TLS, and move OTP delivery to a real email provider.

## Admin audit export

- Login as admin and open the admin audit panel.
- Optional: apply filters by event type, actor user id, and date range.
- Click `Refresh logs` to view filtered results.
- Use `Previous` / `Next` controls to move across paginated results.
- Click `Export CSV` to download the filtered audit events as a CSV file for reporting evidence.

## Quick security test: lockout

1. Attempt login with wrong password 5 times for the same user.
2. On the 5th attempt, API returns `423` and account is locked temporarily.
3. Valid credentials remain blocked until lockout period ends.

## Extended admin detection

- Open the admin panel and use the `Suspicious activity flags` section.
- Set lookback window (minutes) and minimum risk score.
- Click `Refresh flags` to list users with repeated failed login/MFA/lock events.
