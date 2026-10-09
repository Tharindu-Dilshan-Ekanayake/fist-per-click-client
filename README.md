# +1 Fist Per Click — client

A blocky boxing clicker: every click is a punch that adds Strength, Strength smashes
the stage walls (they crack as you hit them and burst into blocks when they go),
the Win pads at the end of each stage pay Wins (1, 5, 10, 50, 250…), and Wins buy
bigger boxing gloves, punching bags to train on and pets. Rebirth for a permanent
multiplier; Rebirth 3 opens **Space World**.

Behind the training zone are four **boxing rings**. Their ropes are solid — nobody
walks in or falls out. In front of each are two pads, red corner and blue corner:
when both have someone on them, those two are taken into the ring and fight. The
stronger fist does more damage; whoever is knocked out (or behind on health when the
60-second round ends) lands back in the lobby, and the winner steps out with Wins.
Everyone can watch through the ropes: each fighter has a health bar over their
head and each ring a scoreboard.

Punches go jab, cross, hook, uppercut, haymaker (hand by hand), every tenth is a
two-fisted blast, and a punch in mid-jump is a flying superman punch that lands
with a shockwave. **Auras** (a glow round the player) come free at levels 3, 6, 10,
14 and 20 or are bought in the shop, and every pair of gloves has its own trail
off the fists — fire, frost, sparks, stars... — on walking and on every punch.
Everyone in the lobby sees everyone else's aura, trails and level-ups.

React + three.js (react-three-fiber, Rapier physics), with the Bloxity SDK for login
and avatars, and a Colyseus game server for the lobby and the rings. Everything in
the game is bought with Wins — there is no real-money currency.

## Running it locally

```bash
npm install
cp .env.example .env     # VITE_GAME_SLUG is already 1-fist-per-click
npm run dev
```

Run the server too (`../fist-per-click-server`, `npm run dev`). With
`VITE_SERVER_URL=http://localhost:3000` in `.env`, a localhost page talks to it
directly — lobbies, rings and cloud saves.

In development, `?lab=gloves` and `?lab=pets` show every glove design or every pet
on its own, and `window.__fpc` (the store, `teleport(x, y, z)`) and
`window.__fpcOrbit` (the camera) are there for poking at the game from the console.

## Where things are

| | |
| --- | --- |
| `src/game/gloves.js` | every pair of gloves: price, Strength per punch, design, colours |
| `src/game/GloveModel.jsx` | how a glove is built, for each design |
| `src/game/avatarRig.js` | the boxer's guard, the jab / hook / uppercut, the knockout fall |
| `src/game/walls.js` | wall health and the stage payouts (`STAGE_WINS`) |
| `src/game/world/StageWall.jsx` | a wall: its cracks, its health bar, how it bursts |
| `src/game/trainers.js` | the punching bags and their multipliers |
| `src/game/rings.js` | where the four boxing rings and their pads are (the server keeps a copy) |
| `src/game/RingDirector.jsx` | your side of a ring fight: into the ring, hits, knockouts, the health bars |
| `src/game/auras.js` | the auras: which levels give them, what the rest cost |
| `src/game/PlayerFx.jsx`, `particles.js` | auras, glove trails, level-up bursts, shockwaves |
| `src/game/pets.js`, `world/PetModel.jsx` | the pets and how they are drawn |
| `src/game/passes.js` | the passes (2x Power, 2x Wins, Auto Wins, VIP Wins Pad) |
| `src/game/cloudSave.js` | loading and saving progress on the game server |
| `src/net/hosting.js` | which back end and matchmaker this page uses |
| `src/game/world/layout.js` | the whole map: lobby, stages, Space World |

## The lobby, south to north

The gate to Stage 1 with the avenue leading to it; the glove shop on its west side
and the pet eggs on its east; the spawn plaza (the golden-glove statue, the VIP
gloves, Space World's portal and the leaderboards); the training zone with two rows
of punching bags; and at the back the four boxing rings with stands behind them.

## Deploying

Push to `dev` or `main` and `.github/workflows/deploy.yml` builds the game and
uploads it to Bloxity's frontend hosting (dev → `https://1-fist-per-click.dev.play.bloxity.io`,
main → `https://1-fist-per-click.play.bloxity.io`). It needs one thing in this
repo's GitHub settings:

| where | name | value |
| --- | --- | --- |
| Actions → **Secrets** | `LEGION_DEPLOY_TOKEN` | the deploy token from My Games |

`LEGION_GAME_ID` and `VITE_GAME_SLUG` can be set as Actions **Variables** too; both
default to `1-fist-per-click`.

The page works out its own back end from its address: saves go to
`https://1-fist-per-click[.dev].host.bloxity.io`, and the lobby socket goes through
the Boxity matchmaker (`Legion.SDK.net.resolveEndpoint`), never straight to the host.

## Prices

Everything costs Wins. The VIP items, on their gold platforms, cost far more than
their place in the ladder — that is what makes them VIP:

| item | where | Wins |
| --- | --- | --- |
| VIP Wins Pad | shop / blue pad | 100K |
| 2x Power | shop | 500K |
| 2x Wins | shop | 1M |
| Auto Wins | shop | 2.5M |
| Phantom Fists | spawn plaza, VIP platform | 1M |
| Celestial Gauntlets | spawn plaza, VIP platform | 25M |
| VIP Bag (250x) | training zone, VIP platform | 250K |
| Golden VIP Bag (1000x) | training zone, VIP platform | 5M |
| Exclusive Egg (Tralaledon, x20) | egg zone, VIP platform | 50M |

Change them in `gloves.js`, `trainers.js`, `eggs.js` and `passes.js` (`cost`).
