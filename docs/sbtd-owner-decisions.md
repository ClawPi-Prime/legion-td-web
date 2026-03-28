# SquadBattleTD — Owner Decisions & Answers

*Decisions that require input from Morbror (product owner). Updated as answers are provided.*

---

## Infrastructure

| Decision | Answer | Status |
|---|---|---|
| Cloudflare account — shared project account or personal? | **Shared account for the project** | ✅ Decided |
| Who owns/pays for the Cloudflare account? | **Morbror owns it, Morbror pays** | ✅ Decided |
| Domain registration (sbtd.io, ~$32/year) | Morbror registers via Cloudflare account | ✅ Decided |

---

## Art & Assets

| Decision | Answer | Status |
|---|---|---|
| Who handles art? | **Morbror handles art direction** | ✅ Decided |
| External artist? | **No** | ✅ Decided |
| Asset strategy for alpha | **Royalty-free packs (Kenney.nl) for alpha, commission originals later** | ✅ Decided |

**Note:** Kenney.nl (https://kenney.nl/assets) has extensive free tower defence and top-down sprite packs under CC0 license. Good starting point.

---

## Audio

| Decision | Answer | Status |
|---|---|---|
| Audio in alpha scope? | **Scaffold only — no actual audio for alpha** | ✅ Decided |
| Style for post-alpha? | TBD | ⏳ Later |

---

## Game Balance

| Decision | Answer | Status |
|---|---|---|
| Who owns balance decisions? | **Morbror, or community vote in Discord** | ✅ Decided |
| Balance process | **Daily game stats → nerf/buff based on outcomes** | ✅ Decided |
| Carry over numbers from prototype? | **No — starting fresh** | ✅ Decided |

**Implication:** Backend must log per-game stats (waves survived, units used, win/loss, king HP remaining) so balance decisions have data to lean on.

---

## Map Design

| Decision | Answer | Status |
|---|---|---|
| Number of lanes (first map) | **1 lane** | ✅ Decided |
| Map size | **Small to start** | ✅ Decided |
| Opponent layout | **Mirror image** | ✅ Decided |
| Maps at alpha | **1 map** | ✅ Decided |
| Who designs the map layout? | **Morbror (grid sketch)** | ✅ Decided |
| Map design format | Rough sketch (Paint / paper photo) — drop in Discord | ⏳ Pending Morbror sketch |

---

## Game Modes

| Decision | Answer | Status |
|---|---|---|
| First mode to implement | TBD — 1v1 or 1vCPU? | ⏳ Needs answer |
| FFA up to 8 players | Confirmed in requirements | ✅ In requirements |

---

## Race Design

| Decision | Answer | Status |
|---|---|---|
| Races for alpha | Human Alliance confirmed. Others? | ⏳ Needs answer |

---

## Release Criteria

| Decision | Answer | Status |
|---|---|---|
| What defines "good enough for alpha"? | TBD | ⏳ Needs answer |

---

## Summary: Still Pending

1. **Map sketch** — Morbror to draw first map layout (grid, lane, spawn zone, exit portal) and post in Discord
2. **First game mode** — 1v1 or 1vCPU first?
3. **Additional races** for alpha (beyond Human Alliance)?
4. **Alpha release criteria** — what needs to be working before inviting external players?

---

*Last updated: 2026-03-28*
