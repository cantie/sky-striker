# Deploying Sky Striker (manual zip upload to Dokploy)

The whole app is **one container**: the NestJS server serves the game on `/` and the API on `/api`
(port **3100**). It needs a **MySQL 8** (or MariaDB ≥ 10.4) database; tables are created by migrations
on boot.

## 1. Build the upload zip
```bash
npm run export:zip        # → export/sky-striker.zip
```
The zip contains only what the root `Dockerfile` needs (game + server sources, assets, lockfiles).
No secrets, `node_modules` or build output are included.

## 2. Create the database
In Dokploy: **Project → Create Service → Database → MySQL** (or reuse an existing MySQL).
Create a database `sky_striker` and note the **internal** connection string, e.g.
`mysql://user:password@<db-app-name>:3306/sky_striker`.

## 3. Create the application
**Project → Create Service → Application**, then on the *General* tab:
- **Source / Provider:** *Drop* → upload `export/sky-striker.zip`
- **Build type:** *Dockerfile* (Docker file path `Dockerfile`, context `.`)

## 4. Environment variables (*Environment* tab)
| Variable | Required | Value |
|---|---|---|
| `MYSQL_URL` | ✅ | internal URL from step 2 |
| `JWT_SECRET` | ✅ | long random string (changing it logs everyone out) |
| `JWT_EXPIRES_IN` | | `30d` (default) |
| `KEYCLOAK_ISSUER` | for login | `https://<sso-host>/realms/<realm>` |
| `KEYCLOAK_CLIENT_ID` | for login | e.g. `sky-striker` |
| `KEYCLOAK_CLIENT_SECRET` | for login | client secret |
| `KEYCLOAK_REDIRECT_URIS` | for login | the public URL, e.g. `https://sky-striker.zingplay.dev` |
| `LOCAL_LOGIN` | | `false` in production |
| `GUEST_COOP` | | `false` = guests must log in to play co-op (default on). Set the same value on Nakama |
| `PORT` | | `3100` (default) |

Without the `KEYCLOAK_*` values the game still works fully in **Guest** mode (login is hidden).
Secrets from Vault: inject them as env vars, or render a dotenv file into the container and set
`ENV_FILE=/path/to/file` — `start.sh` loads it before starting.

## 5. Domain (*Domains* tab)
Add the host (e.g. `sky-striker.zingplay.dev`), **container port `3100`**, HTTPS on. Then **Deploy**.
The image has a `HEALTHCHECK` on `/api/health` (API up + database reachable).

## 6. Keycloak client (once)
- Client type **confidential** (client authentication on), **Standard flow** enabled
- PKCE: *Proof Key for Code Exchange Code Challenge Method* = `S256`
- *Valid redirect URIs* = the public URL **without a trailing slash**, e.g. `https://sky-striker.zingplay.dev`
  (same as `KEYCLOAK_REDIRECT_URIS`; the game sends exactly this value)
- *Valid post logout redirect URIs* = the same URL

## Updating
Run `npm run export:zip` again, upload the new zip on the same application and redeploy.
Data lives in MySQL, so redeploys keep accounts, saves and leaderboards.

## Smoke test
- `https://<host>/api/health` → `{"ok":true}`
- `https://<host>/api/config` → shows `keycloak` settings when login is configured
- Open the game, **LOG IN**, finish a stage, check **LEADERBOARD**
