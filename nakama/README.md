# Sky Striker co-op — Nakama module

- `modules/skystriker_coop.lua`: authoritative match + RPCs + leaderboards (Lua 5.1, gopher-lua).
- `modules/skystriker_data.lua`: **generated** stage data/rules (`npm run gen:coop`).
- `test/`: runs the module in vitest through fengari with a mock `nakama` module.

Workflow: change stages → `npm run gen:coop` → `npx vitest run` → `npm run nakama:install`
(copies both files into `../nakama-cluster/modules`, or `NAKAMA_CLUSTER_DIR`) → commit there.

Runtime env on every Nakama node: `SKYSTRIKER_API_URL=https://<game host>` (joins are verified with `GET /api/me`).

Local check (Docker): `docker compose -f nakama/docker-compose.yml up -d` then `node scripts/coop-smoke.mjs`.
