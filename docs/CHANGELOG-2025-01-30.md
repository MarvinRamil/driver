# Changelog — 30 January 2025

Summary of changes made on this date across the Bee Driver app (config, API, UI, and behavior).

---

## 1. App config — null check (`app.config.js`)

**Issue:** Running the app locally (e.g. `npx expo run:android`) threw:

```text
TypeError: Cannot read properties of null (reading 'toLowerCase')
at app.config.js:118
```

**Cause:** `ENV_PREFIX` is only set when running in CI; locally it stays `null`. The code was calling `ENV_PREFIX.toLowerCase()` and `BRANCH_NAME` could be null/undefined.

**Change:**

- `environment` in `config.extra` now uses:  
  `ENV_PREFIX != null ? ENV_PREFIX.toLowerCase() : 'local'`
- `branch` uses: `BRANCH_NAME ?? 'local'`

**Files:** `app.config.js`

---

## 2. API request failure logging (`apiClient.ts`)

**Issue:** Every failed API request (e.g. 403 on bookings) was logged to the console with full error details, which was noisy.

**Change:** The `console.error` for failed requests in the `request()` catch block is now gated by `API_DEBUG`. It only runs when `EXPO_PUBLIC_API_DEBUG === 'true'`. Successful behavior and error re-throwing are unchanged.

**Files:** `shared/services/apiClient.ts`

---

## 3. Bookings API — stop calling GET `/api/bookings` (403)

**Issue:** For solo driver/operator users, the app called `GET /api/bookings?page=1&pageSize=100`, which returned **403**, and the failure was logged on every load.

**Change:** In `bookingService.getBookings()`, the branch that calls `GET /api/bookings` (solo driver/operator) no longer calls the API. It returns an empty array so the app does not hit that endpoint until the backend allows it. The dispatches path (driver under operator) is unchanged and still uses `GET /api/dispatches/driver/{driverId}`.

**Files:** `features/bookings/services/bookingService.ts`

---

## 4. Home screen — stop constant reloading

**Issue:** The home (dashboard) screen was constantly reloading or re-running effects.

**Causes:**

1. **Countdown effect:** The effect that updates offer countdowns every second depended on `[validOffers]`. `filterValidOffers(offers)` returns a new array every render, so the effect re-ran every render and re-created the interval.
2. **Bookings refetch:** `useBookings` had an effect that depended on `fetchBookings`, which depended on `[user]`. When the auth context re-rendered and passed a new `user` object reference, `fetchBookings` changed and the effect refetched bookings repeatedly.

**Changes:**

- **Countdown:** A ref holds the latest `validOffers`; the interval effect runs once with `[]` and reads from that ref each tick so it no longer re-runs on every render.
- **Bookings:** The fetch effect now depends on `userId` (`user?.id ?? null`) instead of `fetchBookings`, so bookings refetch only when the logged-in user id changes (e.g. login), not on every context re-render.

**Files:** `app/(tabs)/index.tsx`, `features/bookings/hooks/useBookings.ts`

---

## 5. Offers polling — no full-page refresh spinner

**Issue:** The offers list is polled every 5 seconds. Every poll set `isLoading` to true, and the dashboard uses `refreshing={isLoading || offersLoading}` on the ScrollView. So every 5 seconds the whole list showed the refresh spinner and felt like the page was auto-refreshing.

**Change:** `fetchOffers` in `useOffers` now accepts an optional `silent` flag. When `silent === true` (used for background polling), it does not set loading state. Only the initial fetch and manual refresh (pull-to-refresh or `refresh()`) use `silent === false` and show the spinner.

**Files:** `features/offers/hooks/useOffers.ts`

---

## 6. Offers API — support multiple response shapes

**Issue:** Pending offers were not showing because the code assumed the API returns an array directly in `response.data`. The backend may return a wrapper such as `{ items: [...] }` or `{ data: [...] }`, so `Array.isArray(response.data)` was false and the list was treated as empty.

**Change:** In `offerService.getPendingOffers()`, the list is now taken from any of:

- `response.data` (if it is an array)
- `response.data.items`
- `response.data.data`
- `response.data.data.items`

A `console.warn` was added when the response succeeds but no array is found, logging the actual shape (e.g. object keys) to help debug other formats.

**Files:** `features/offers/services/offerService.ts`

---

## 7. Accept booking — button replaced with slide switch

**Issue:** Accept was a button; product requested a slide switch for accepting.

**Changes:**

- **Dashboard (Home):** On each offer card, the "Accept" button was replaced with a row that has an "Accept" label and a `Switch`. Sliding the switch on runs the same accept flow; Reject remains a button. A short-lived "accepting" state disables the switch while the request is in flight.
- **Accept Booking screen:** The "Accept Booking" button was replaced with a row labeled "Slide to accept booking" and a `Switch`. Sliding on runs the existing accept logic (success alert + navigate back, or error alert). Decline remains a button.

**Files:** `app/(tabs)/index.tsx`, `app/accept-booking.tsx`

---

## File summary

| Area              | Files touched |
|-------------------|----------------|
| Config            | `app.config.js` |
| API / logging     | `shared/services/apiClient.ts` |
| Bookings          | `features/bookings/services/bookingService.ts`, `features/bookings/hooks/useBookings.ts` |
| Offers            | `features/offers/hooks/useOffers.ts`, `features/offers/services/offerService.ts` |
| Dashboard / Home  | `app/(tabs)/index.tsx` |
| Accept booking    | `app/accept-booking.tsx` |

---

*Generated for the Bee Driver project.*
