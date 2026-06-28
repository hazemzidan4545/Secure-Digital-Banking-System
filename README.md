# Secure Digital Banking System

A full-stack banking application focused on secure authentication, protected money-transfer workflows, auditability, and deployment hardening.

## Features

- React customer and admin frontend.
- Node.js and Express API.
- PostgreSQL data model for users, accounts, transfers, reset flows, MFA state, and audit events.
- Cookie-based sessions with CSRF protection.
- MFA login flow with one-time passwords.
- Password reset request and confirmation flow.
- Transfer simulation with per-transfer, hourly, and daily controls.
- Brute-force login protection and temporary account lockout.
- Inactivity-based session timeout enforcement.
- Admin audit log view and CSV export.
- Suspicious activity scoring endpoint.
- Docker Compose development stack with Nginx reverse proxy.
- Production-oriented Docker profile with TLS-ready Nginx configuration.

## Tech Stack

- Frontend: React, Vite, React Router, Axios, Tailwind CSS
- Backend: Node.js, Express, PostgreSQL, JWT, Helmet, Jest
- Infrastructure: Docker Compose, Nginx

## Repository Layout

```text
backend/                  Express API, database schema, tests
frontend/                 React client application
nginx/                    Reverse proxy configuration
docs/evidence/            Security and container scan evidence
docker-compose.yml        Local development stack
docker-compose.prod.yml   Production-oriented stack
```

## Quick Start With Docker

```bash
docker compose up --build
```

Open:

- App: `http://localhost:8081`
- Backend health: `http://localhost:8081/api/health`

The local Docker setup includes the services needed for development and testing.

## Local Development

### Backend

```bash
cd backend
npm install
npm run dev
```

Copy `backend/.env.example` to `backend/.env` first and adjust the database and secret values for your environment.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend runs on `http://localhost:5173` and proxies API calls to the backend.

## Tests

Backend:

```bash
cd backend
npm test
npm run test:lifecycle
```

Frontend:

```bash
cd frontend
npm test
npm run lint
npm run build
```

## Production Profile

Create a root `.env` file for Docker Compose:

```env
POSTGRES_PASSWORD=change_this_strong_password
DB_ENCRYPTION_KEY=change_this_long_random_db_encryption_key
JWT_ACCESS_SECRET=change_this_long_random_secret
JWT_MFA_SECRET=change_this_long_random_secret
JWT_PASSWORD_RESET_SECRET=change_this_long_random_secret
FRONTEND_ORIGIN=https://localhost
```

Provide TLS files:

```text
certs/fullchain.pem
certs/privkey.pem
```

Then run:

```bash
docker compose -f docker-compose.prod.yml up --build -d
```

## Security Notes

- Replace all development secrets before production use.
- Use HTTPS/TLS in production.
- Move OTP delivery to a real email provider outside local testing.
- Remove development token exposure before production deployment.
- Review `SECURITY_TEST_REPORT.md`, `TESTING_DOCUMENT.md`, and `docs/evidence/` for validation evidence.

## Default Development Admin

The backend can seed a development admin user on startup. Override the seed values through backend environment variables before using the system outside local development.
