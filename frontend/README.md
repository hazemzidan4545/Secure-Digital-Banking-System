# Frontend Overview

This frontend is a React + Vite client using page-based routing and a role-aware navigation layout.

## Run

1. Install dependencies:

```powershell
npm install
```

2. Start development server:

```powershell
npm run dev
```

3. Build production bundle:

```powershell
npm run build
```

## Routing (Separate Page per Feature)

Public pages:

- `/login`
- `/register`
- `/mfa`
- `/reset-request`
- `/reset-confirm`

Authenticated pages:

- `/dashboard`
- `/transfer`
- `/transactions`

Admin-only pages:

- `/admin/audit`
- `/admin/suspicious`

Routes are protected by user state and role checks.

## UX Enhancements Implemented

- Sidebar navigation with active route highlighting
- Dedicated page headers per feature
- Action loading states for all major form submissions
- Password strength meters on register and reset pages
- Transaction search and quick stats cards
- Audit metadata view toggle (compact/pretty)
- Suspicious activity page with filter controls
- Development helper panel for OTP and reset tokens
- Responsive layout for desktop and mobile
