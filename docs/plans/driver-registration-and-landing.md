# Driver landing and email registration

Implementation reference for bee-driver (driver app only, no backend changes).

## Goals

1. Pre-login landing with clear **Create Account** CTA
2. **Email + OTP** as primary sign-up; **phone/SMS** as secondary
3. Post-sign-up: login → liveness → driver-complete (unchanged)

## Phase 1 — Landing

- [`app/welcome.tsx`](../app/welcome.tsx): driver copy, Sign In + Create Account, Support mailto
- [`app/_layout.tsx`](../app/_layout.tsx): `initialRouteName: welcome`, NavigationGuard allows `/welcome`
- [`app/login.tsx`](../app/login.tsx): “Don’t have an account? Sign up” link + Create Account button

## Phase 2 — Registration

- [`features/auth/components/RegistrationSteps.tsx`](../features/auth/components/RegistrationSteps.tsx):
  - Default step: `email-entry` → `email-otp` → `enter-details` → `enter-security-questions` → `register` (Driver)
  - Secondary: “Use phone number instead” → existing phone/SMS flow
  - Legacy in-signup document upload removed; resume incomplete → login

## QA checklist

| Case | Expected |
|------|----------|
| Logout → app open | Welcome with Sign In + Create Account |
| Welcome → Create Account | Email entry (not phone) |
| Email OTP → register | Success → login |
| Login as new driver | liveness → driver-complete |
| “Use phone instead” | SMS flow works |
| Existing email, complete | Prompt to login |

## Out of scope

- Backend API changes
- TanStack Query / full customer `useRegistrationFlow` port
- `credentials.json` in git
