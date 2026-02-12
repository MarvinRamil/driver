# Driver app deployment

## Why you get 401 on `/api/auth/me` after deploying

**Tokens are tied to the API that issued them.** If you were testing locally against `localhost` (or a different API URL), the app stored a token from that environment. After you deploy a build that points to **staging** (`https://staging-api.bee-app.tech`), the app still has the old token. Staging rejects it (different JWT secret/issuer) and returns **401 Unauthorized**.

**What to do:** On the deployed app, **log in again**. That issues a new token from the staging API; `/api/auth/me` will then succeed.

- **Local** → token from local API → invalid on staging → 401  
- **Staging build** → log in on staging → token from staging API → valid on staging

The app clears tokens on 401 and shows the login screen with a “Session expired or invalid” style message so users can sign in again.
