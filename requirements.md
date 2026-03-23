# Legion TD Web — Requirements

*Living document. Updated as mechanics are validated through prototyping.*

---

## 1. Overview

Legion TD Web is a competitive real-time multiplayer tower defence game played between two players simultaneously. Each player defends their own lane and king independently. The game ends when one player's king is defeated.

---

## 2. Core Game Loop

### 2.1 Session Flow

1. Players join a lobby and select a race.
2. A countdown begins. The game starts when both players are ready or the countdown expires.
3. The game alternates between **build phases** and **combat phases**.
4. During the build phase, players place defenders using gold.
5. During the combat phase, enemy waves spawn and march toward the exit portal.
6. Enemies that reach the exit portal leak into the King's Chamber.
7. Leaked enemies attack the king. If the king's HP reaches zero, that player loses.
8. The game ends when one king is defeated.

### 2.2 Wave Synchronisation

- All players enter and exit build/combat phases simultaneously.
- A shared server-driven countdown governs build phase duration.
- Players may vote to start the wave early. The wave fires immediately if all players vote.
- The server is the authority on wave timing — clients do not manage their own timers.

### 2.3 Economy

- Players start with a fixed amount of gold.
- Gold is earned per wave completion and per enemy killed.
- A clean wave (no leaks) grants a bonus income.
- All economy values are defined in a central configuration file.

---

## 3. Map Structure

### 3.1 Main Field

- Grid-based play area divided into columns and rows.
- A designated **spawn zone** at the top where enemies enter.
- A designated **exit portal** at the bottom where enemies exit toward the King's Chamber.
- A centre lane that enemies default to when no defenders are nearby.
- Defenders may be placed in the combat zone (all rows except spawn and exit).

### 3.2 King's Chamber

- Separate canvas rendered alongside the main field.
- Contains the player's king unit.
- Leaked enemies teleport into the King's Chamber and attack the king.
- The king has an auto-attack that retaliates against leaked enemies.

---

## 4. Defenders

### 4.1 General Behaviour

- Defenders are placed on the grid during the build phase.
- Each defender has a home position they return to when no enemies are nearby.
- Defenders move within a limited pursuit range to engage enemies.
- Separation logic prevents defenders from stacking on the same tile.

### 4.2 Combat Mechanics

- **Armor:** Each unit has a flat armor value. Incoming damage is reduced by armor. Minimum damage is 1.
- **Aura bonuses:** Some units passively boost the armor and/or damage of nearby allies. Multiple aura sources stack.
- **Attack range:** Defenders attack the nearest enemy within their attack range.
- **Squad alert:** When any defender spots an enemy, nearby defenders are alerted and pursue that target. A maximum number of defenders will respond to a single alert to avoid over-concentration.

### 4.3 Unit Archetypes

Each race defines a roster of units. Unit archetypes include but are not limited to:

| Archetype | Role | Key Mechanic |
|---|---|---|
| Melee fighter | Front-line damage | High HP and armor, melee range |
| Ranged attacker | Consistent damage | Low HP, no armor, fast attack speed |
| Heavy cavalry | Burst + disruption | Periodic charge: bonus damage + knockback on impact |
| Support healer | Sustain | Locks onto most-injured ally in range, heals until full, then picks next |
| Siege weapon | Area denial | Slow attack, splash damage to all enemies near impact point |
| Aura support | Team buff | Passive aura: bonus armor and damage to all allies within range; follows the tankiest teammate |

### 4.4 Unit Configuration

All unit stats (HP, damage, armor, attack speed, move speed, range, cost, special parameters) are defined in an external configuration file, not hardcoded. This allows balance iteration without modifying game logic.

---

## 5. Enemies

### 5.1 Behaviour

- Enemies spawn horizontally distributed across the spawn zone each wave.
- Default movement: march down the centre lane toward the exit portal.
- If a defender is within pursuit range, enemies deviate to engage it.
- When any enemy engages a defender, nearby enemies are alerted and converge on that defender.
- Enemies have armor; all damage calculations apply the same armor reduction as defenders.

### 5.2 Scaling

- Each wave increases enemy count, HP, and movement speed according to configurable scaling factors.
- All scaling parameters live in the central configuration file.

### 5.3 Leaking

- Enemies that reach the exit portal are removed from the main field.
- They reappear in the King's Chamber with their remaining HP and increased speed.
- A visual indicator signals a leak event.

---

## 6. Races

### 6.1 Structure

- Each race is a named set of exactly 6 unit types.
- Units within a race are balanced as a cohesive roster, not independently.
- Races are designed to have distinct playstyle identities.

### 6.2 Selection

- Race is selected in the lobby before the game starts.
- Players may change their race selection during the countdown.
- Race choice is visible to both players in the lobby.

### 6.3 Future Races

The system must support adding new races without changes to game engine code. New races require only a new entry in the configuration file.

---

## 7. Multiplayer

### 7.1 Visibility

- Both players' grids are visible simultaneously on each player's screen.
- The opponent's grid is rendered in real-time using networked state updates.
- Opponent state is interpolated between received snapshots for smooth rendering.

### 7.2 Player Identity

- Players enter a name before joining a lobby.
- The last-used name is saved client-side (cookie) and pre-filled on return.
- A random default name is generated if no prior name exists.

### 7.3 Leaderboard

- Player scores (waves survived) are persisted server-side.
- A global leaderboard is accessible from the game UI at any time.

### 7.4 Game End

- The game ends when either player's king dies.
- Both players see a result screen indicating winner and loser.
- If a player disconnects mid-game, their opponent wins.

---

## 8. Technical Constraints

- **Rendering:** HTML5 Canvas. No third-party game engine.
- **Client:** Plain JavaScript. No build tooling required in development.
- **Backend:** Node.js with Socket.io for real-time communication.
- **Database:** Relational (PostgreSQL). Player identity and scores persisted.
- **Infrastructure:** Containerised. Deployable on a single-node cluster.
- **Configuration:** All balance values in a single external config file. No hardcoded game constants in logic code.

---

## 9. Out of Scope (current phase)

- Authentication / accounts
- Ranked matchmaking
- Spectator mode
- Replay system
- Mobile-native app
- Sound / music
- Animated sprites (placeholder shapes acceptable)

---

*Last updated: 2026-03-23*
