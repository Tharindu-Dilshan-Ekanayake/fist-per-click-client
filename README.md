# +1 Ammo Per Click — client

A blocky clicker shooter: every click fires your gun for Ammo, Ammo breaks the
stage walls, the Win pads at the end of each stage pay Wins (1, 5, 10, 50, 250…),
and Wins buy better guns, targets and pets. Rebirth for a permanent multiplier;
Rebirth 1 opens the **Boss Arena**, Rebirth 3 opens **Space World**.

React + three.js (react-three-fiber, Rapier physics), with the Bloxity SDK for
login and avatars. Everything in the game is bought with Wins - there is no
real-money currency.

## Running it locally

```bash
npm install
cp .env.example .env     # set VITE_GAME_SLUG
npm run dev
```

Run the server too (`../ammo-per-click-server`, `npm run dev`). With
`VITE_SERVER_URL=http://localhost:3000` in `.env`, a localhost page talks to it
directly — lobbies and cloud saves both.

## Where things are

| | |
| --- | --- |
| `src/game/guns.js` | every gun: price, Ammo per click, model type, colours |
| `src/game/walls.js` | wall health and the stage payouts (`STAGE_WINS`) |
| `src/game/trainers.js` | the shooting targets and their multipliers |
| `src/game/boss.js` | boss health, rewards and the fight clock |
| `src/game/passes.js` | the passes (2x Power, 2x Wins, Auto Wins, VIP Wins Pad) |
| `src/game/cloudSave.js` | loading and saving progress on the game server |
| `src/net/hosting.js` | which back end and matchmaker this page uses |
| `src/game/world/layout.js` | the whole map: lobby, stages, Boss Arena, Space World |

## Deploying

Push to `dev` or `main` and `.github/workflows/deploy.yml` builds the game and
uploads it to Bloxity's frontend hosting (dev → `https://<id>.dev.play.bloxity.io`,
main → `https://<id>.play.bloxity.io`). It needs, in this repo's GitHub settings:

| where | name | value |
| --- | --- | --- |
| Actions → **Secrets** | `LEGION_DEPLOY_TOKEN` | the deploy token from My Games |
| Actions → **Variables** | `LEGION_GAME_ID` | the hosting id |
| Actions → **Variables** | `VITE_GAME_SLUG` | the slug on bloxity.io (usually the same) |

The page works out its own back end from its address: saves go to
`https://<id>[.dev].host.bloxity.io`, and the lobby socket goes through the Boxity
matchmaker (`Legion.SDK.net.resolveEndpoint`), never straight to the host.

## Prices

Everything costs Wins. The VIP items, on their gold platforms, cost far more than
their place in the ladder - that is what makes them VIP:

| item | where | Wins |
| --- | --- | --- |
| VIP Wins Pad | shop / blue pad | 100K |
| 2x Power | shop | 500K |
| 2x Wins | shop | 1M |
| Auto Wins | shop | 2.5M |
| Phantom Blaster | gun zone, VIP platform | 1M |
| Celestial Minigun | gun zone, VIP platform | 25M |
| VIP Target (250x) | training zone, VIP platform | 250K |
| Golden VIP Target (1000x) | training zone, VIP platform | 5M |
| Exclusive Egg (Tralaledon, x20) | egg zone, VIP platform | 50M |

Change them in `guns.js`, `trainers.js`, `eggs.js` and `passes.js` (`cost`).
