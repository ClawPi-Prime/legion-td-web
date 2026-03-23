# CPU Player / Game AI — Research & Theoretical Implementation for Legion TD Web

*Research document. No implementation. Sources cited.*

---

## 1. What We're Actually Solving

A CPU player in Legion TD Web needs to do exactly one thing during the build phase: **decide which units to buy and where to place them**. The combat phase is fully deterministic — units fight automatically with no player input.

This is a classic **sequential decision problem under budget constraint**: given a finite amount of gold, a grid to place on, and knowledge of the incoming wave, pick a combination of defenders that maximises survival.

It's not a real-time planning problem. It's not pathfinding. The AI has 30 seconds of build time per wave, the same as a human player.

---

## 2. The Decision Space

Each build phase, the CPU must decide:

1. **Which units to buy** — from a roster of N unit types, each with a cost and role
2. **Where to place them** — on a grid with valid placement zones
3. **How much gold to spend** — spending all vs. saving for later waves

The grid is 12×18 usable tiles (prototype). At 10g minimum unit cost, wave 1 budget of ~100g gives around 10 units maximum. The combination space is enormous but tractable because:

- Units are fungible within type (an archer at row 3 col 0 vs row 3 col 1 differ only in position)
- Placement has strong spatial intuitions (front-liners in front, ranged behind, support near high-HP units)
- Gold is the binding constraint — most decisions collapse to "what's the best unit I can afford right now"

---

## 3. Approaches: Literature Review

### 3.1 Rule-Based AI (Scripted AI)

The simplest and most common approach in tower defence games. The AI follows a fixed decision tree or priority list:

> "If I have ≥60g, buy a catapult. Else if I have ≥25g, buy a knight. Else buy an archer."

**Source:** Amitp (Amit Patel), *Game Programming articles*, Stanford CS:
https://theory.stanford.edu/~amitp/GameProgramming/

This is how most commercial tower defence games implement their "Easy" CPU — scripted purchase priorities, fixed placement patterns (front row first, then back row).

**Pros:** Trivial to implement, predictable difficulty, easy to tune.
**Cons:** Exploitable, no adaptation, brittle against unusual wave compositions.

---

### 3.2 Dijkstra Maps / Influence Maps for Placement

Amit Patel's work on flow fields (https://www.redblobgames.com/pathfinding/tower-defense/, Feb 2014) demonstrates that a **Dijkstra map** — a distance field computed from a goal — can guide not just enemy movement but AI decision-making.

Brian Walker (creator of *Brogue*) in "The Incredible Power of Dijkstra Maps" (RogueBasin, https://www.roguebasin.com/index.php/The_Incredible_Power_of_Dijkstra_Maps) extends this further: Dijkstra maps can encode **desire** as distance. Multiple goals with different weights (e.g. "be near the exit portal" weighted higher than "be near the lane centre") produce combined influence maps that drive intelligent-looking positioning.

**Applied to placement decisions:**

Build a "threat map" — assign high values to tiles near the lane and spawn zone (high enemy traffic), lower values further away. The CPU places high-HP units on high-threat tiles and support units on low-threat tiles behind them.

This is exactly the "desire-driven AI" Walker describes: create one Dijkstra map per goal (threat, synergy, coverage), weight them, and sum. The resulting map tells you where each unit type *should* go.

**Pros:** Spatially intelligent, cheap to compute, generalises to any map layout.
**Cons:** Requires computing the map each wave (trivial). Doesn't handle unit synergies naturally.

---

### 3.3 Greedy Heuristic with Role Priorities

A step above scripted AI: assign each unit type a **role priority** per wave phase, and greedily fill that priority order.

Concept from game AI literature (Game AI Pro series, freely available at http://www.gameaipro.com/):

> "The simplest AI that works well is the one that uses the best available heuristic at each step."

For Legion TD specifically, a workable heuristic is:

1. **Wave N < 5:** Prioritise cheap high-DPS units (archers). Cover the lane.
2. **Wave N 5-10:** Add a tank (knight). Begin placing support.
3. **Wave N > 10:** Prioritise synergies (priest behind tank, medic near front-liners).

This is an **evaluation function** over build states: given a partial build, score it, and greedily add the unit that most improves the score.

Score = Σ(unit DPS × survival factor) + Σ(support bonus) − lane_coverage_gap

---

### 3.4 Monte Carlo Simulation (MCTS-lite)

More sophisticated: before committing to a purchase, **simulate** a small number of combat outcomes with different unit configurations and pick the one with the best survival rate.

This is a simplified version of Monte Carlo Tree Search (MCTS), well-documented in game AI literature. The key insight: you don't need the full tree search. During the 30-second build phase, you can simulate 50–100 mini-combats (running the same wave simulation at accelerated speed with different unit placements) and compare outcomes.

**Simulated annealing / random search variant** (from *Game AI Pro Online Edition 2021*, Chapter 10 "AI-Driven Autoplay Agents for Prelaunch Game Tuning", Borovikov — http://www.gameaipro.com/GameAIProOnlineEdition2021/):

1. Start with a random valid build within budget
2. Simulate the wave
3. Swap one unit / change one position
4. If survival improved, keep the change
5. Repeat until time limit

This is lightweight enough to run in-browser in JavaScript. Legion TD's wave simulation is already implemented — the same `update()` loop can run headlessly (no rendering) at 60× speed. 100 simulations of a 30-second wave takes ~30 seconds of compute at normal speed, or about 500ms at 60× — well within the build timer.

**Pros:** Actually finds good builds without domain knowledge. Self-improving.
**Cons:** More implementation complexity. Computationally heavier (but manageable).

---

### 3.5 Why NOT Machine Learning (for now)

ML approaches (deep reinforcement learning) exist for tower defence — see OpenAI Five for the concept applied to Dota 2. They require:

- Thousands of training games
- A reward signal (easy: king HP remaining)
- Significant training infrastructure

For a prototype on a Pi this is out of scope. Noteworthy but not relevant yet.

---

## 4. Theoretical Implementation for Legion TD Web

Based on the research, the best approach for our current codebase is a **hybrid**: rule-based selection with influence-map placement, with optional simulation for higher difficulty.

### 4.1 Architecture

```
BuildPhaseAI
├── BudgetManager       — tracks gold, decides when to spend vs. save
├── UnitSelector        — picks which unit type to buy next
│   ├── WaveAnalyser    — reads incoming wave HP/count/speed
│   └── RosterEvaluator — scores each affordable unit against current composition
├── PlacementEngine     — decides where to place the chosen unit
│   ├── ThreatMap       — Dijkstra map from lane/spawn (high = exposed)
│   ├── SynergyMap      — proximity to units that benefit from each other (priest near knight)
│   └── CoverageMap     — areas not yet defended
└── DifficultyProfile   — scales decision quality (Easy: random noise, Hard: optimal)
```

### 4.2 ThreatMap (Dijkstra-based placement)

Run BFS from the exit portal outward. Assign each tile a distance value. Invert: tiles near the exit/lane get high threat scores. Place:

- High HP units: high-threat tiles (front line)
- Ranged/DPS units: mid-threat tiles (behind front line)
- Support units: low-threat tiles (rear, near tanks)

This directly implements the Walker/Patel approach. It requires no knowledge of unit stats — just their role tag from the config.

### 4.3 UnitSelector (greedy heuristic)

Each wave, score each affordable unit type:

```
score(unit) =
  + unit.dmg × dmgWeight(currentComposition)
  + unit.hp × tankWeight(currentComposition)
  + specialBonus(unit, currentComposition)
  - redundancyPenalty(unit, currentComposition)
```

`specialBonus`: priest scores higher if a knight is already placed (aura synergy). Medic scores higher if any unit has taken wave damage.

`redundancyPenalty`: if 5 archers are already placed, marginal value of a 6th is lower.

Buy the highest-scoring unit you can afford. Repeat until budget is exhausted.

### 4.4 Difficulty Tiers

| Tier | Behaviour |
|---|---|
| Easy | Random selection from affordable units; random valid placement |
| Medium | UnitSelector heuristic; ThreatMap placement |
| Hard | Medium + 20 mini-simulations to validate each placement before committing |
| Adaptive | Hard, but monitors win/loss ratio and adjusts weights toward what works |

### 4.5 Multiplayer Integration

The CPU player is just another client that:
1. Joins the lobby normally
2. Receives `wave:state` like any player
3. Runs the build AI locally on the server during the build phase
4. Emits `lobby:place` events (new event needed) the same as a human clicking

No special server treatment needed. The server doesn't care whether a placement decision came from a human or an algorithm.

---

## 5. Key Implementation Notes

**The simulation runs the existing engine.** `update(dt)` already handles all combat. For simulation mode, call it with `dt = 1/60` in a tight loop, skip rendering, count leaked enemies and king HP at the end. This is the most important insight — zero new combat logic needed.

**The threat map is computed once per wave start.** It doesn't change during the build phase unless the CPU places new units (which act as obstacles). In our current map it's fixed.

**Placement must respect existing units.** The `isOccupied(col, row)` function already exists. The AI just needs to filter candidate tiles by it.

**Gold saving is a valid strategy.** Skip a build phase if the next wave is easy. Bank gold. This is the "patience" strategy used by strong Legion TD players. A Medium+ AI should evaluate "spend now vs. save" each wave.

---

## 6. Recommended Starting Point

Implement **Easy + Medium** first:

1. **Easy**: random affordable unit, random valid placement tile. 2 hours of work.
2. **Medium**: ThreatMap placement (BFS from exit portal, invert) + greedy unit selection by DPS/cost ratio. ~1 day of work.

These two tiers give enough contrast to test the gameplay loop with a CPU opponent. Hard (simulation) can follow once the core is validated.

---

## Sources

1. Amit Patel — *Flow Field Pathfinding for Tower Defense* (redblobgames.com, 2014): https://www.redblobgames.com/pathfinding/tower-defense/
2. Amit Patel — *Introduction to A\** (redblobgames.com, 2014): https://www.redblobgames.com/pathfinding/a-star/introduction.html
3. Brian Walker — *The Incredible Power of Dijkstra Maps* (RogueBasin): https://www.roguebasin.com/index.php/The_Incredible_Power_of_Dijkstra_Maps
4. jiceq — *Dijkstra Maps Visualized* (RogueBasin): https://www.roguebasin.com/index.php/Dijkstra_Maps_Visualized
5. Igor Borovikov — *AI-Driven Autoplay Agents for Prelaunch Game Tuning*, Game AI Pro Online Edition 2021, Chapter 10: http://www.gameaipro.com/GameAIProOnlineEdition2021/GameAIProOnlineEdition2021_Chapter10_AI-Driven_Autoplay_Agents_for_Prelaunch_Game_Tuning.pdf
6. Steve Rabin (ed.) — *Game AI Pro* series (all chapters free): http://www.gameaipro.com/
