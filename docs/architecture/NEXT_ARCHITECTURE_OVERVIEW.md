# Architecture Overview — four-elements-next

> **This document describes the current architecture, not a proposed rewrite.**

For high-level guardrails (composition root rules, no-legacy patterns, test policy), see
[docs/ARCHITECTURE_RULES.md](../ARCHITECTURE_RULES.md).
This document is the concrete companion: layer map, tick order, system integration,
and the checklist for adding new systems.

---

## 1. Project Layers

| Layer       | Directory      | Responsibility                                     | Key Files |
|-------------|----------------|----------------------------------------------------|-----------|
| Core        | `src/core/`    | Constants, coordinates, assets, screen manager     | `constants.ts`, `coordinates.ts`, `assets.ts`, `screen-manager.ts` |
| Config      | `src/config/`  | Building definitions and parameters — data only    | `buildings.ts` |
| Types       | `src/types/`   | Shared type definitions                            | `screens.ts` |
| Game        | `src/game/`    | GameState aggregate, GameWorld glue, mapgen, types | `game-state.ts`, `game-world.ts`, `mapgen.ts`, `map-types.ts` |
| Systems     | `src/systems/` | Pure simulation logic — each system owns one domain | `system-runner.ts`, `economy.ts`, `power.ts`, `control.ts`, `construction.ts`, `production.ts`, `harvesting.ts` |
| Render      | `src/render/`  | Canvas2D drawing + DOM HUD overlays                | `renderer.ts`, `economy-hud.ts`, `production-panel.ts`, `build-menu.ts`, `buildings.ts`, `terrain.ts`, `environment.ts`, `camera.ts` |
| Screens     | `src/screens/` | DOM screen lifecycle, creates UI, wires callbacks  | `game-screen.ts`, `main-menu.ts`, `settings.ts`, `map-size.ts`, `faction-select.ts` |
| Main        | `src/main.ts`  | App bootstrap — wiring only                        | `main.ts` |

**Dependency rule:** lower layers never import from upper layers.
Systems never import from render/screens. Game never imports from render.

---

## 2. GameState

`GameState` is a single mutable aggregate object. All systems read/write it directly.

```typescript
interface GameState {
  readonly map: MapData;              // tiles, buildings, builders, resources, construction sites
  economy: EconomyState;             // raw, matter, elements, separators
  power: PowerState;                 // buildings[], supply, demand, netPower
  control: ControlState;             // current, cap, used
  constructionStatusMessage: string; // UI status string
  harvesters: HarvesterState[];      // runtime harvester units
  resourceNodes: ResourceNodeState[];// runtime node depletion tracking
  production: ProductionState;       // factories[], queues
}
```

- **Factory:** `createGameState(mapSize, faction)` — single entry point. Initializes all sub-states.
- **Initial `control.used`:** `builders.length * BUILDER_CONTROL_COST + harvesters.length * HARVESTER_CONTROL_COST`.
- **Rule:** No hidden state outside GameState. Systems may hold temporary local state within a tick but must not store it across ticks outside GameState.

---

## 3. GameWorld

`GameWorld` is the only class in the project. It is **thin glue**, not a logic owner.

**Owns:**
- Render loop (`requestAnimationFrame` → `update(dt)` → `render()`)
- Camera, keyboard/mouse/wheel input, asset loading
- `GameState` instance
- UI update callbacks: `onEconomyUpdate`, `onPowerUpdate`, `onControlUpdate`, `onConstructionUpdate`, `onProductionUpdate`
- Test hook publishing

**Does NOT own:**
- Gameplay rules — delegates to system functions
- Rendering logic — delegates to `render()` and HUD components

**Command wrappers** (thin delegation):
- `startConstruction(buildingType)` → calls `startConstructionSystem()`, updates status message, publishes UI
- `startProduction(factoryTx, factoryTy, unitType)` → calls `startProductionSystem()`, publishes UI

**Update loop:**
```
loop(now) → dt → update(dt) → runSystems(state, dt) → publishUiState() → publishTestHooks()
                         → render(ctx, map, camera, assets, ...)
```

---

## 4. System Runner — Tick Order

`runSystems(state, dt)` executes systems in a fixed order. The order matters.

| Step | System            | Call                                            | Why this position |
|------|-------------------|-------------------------------------------------|-------------------|
| 1    | Construction      | `tickConstruction(state.map, dt)`               | Progress sites, detect completions |
| 2    | Completion cascade| Apply completed buildings to economy/power/production | Must happen before downstream ticks |
| 3    | Power             | `tickPower(state.power)`                        | Recalculate online/offline by priority |
| 4    | Control           | `tickControl(state.control, relayOnlineCount)`  | Needs online relay count from step 3 |
| 5    | Production        | `tickProduction(state, dt)`                     | After control (reads control state); new harvesters act this tick |
| 6    | Harvesting        | `tickHarvesting(state, dt)`                     | After production (spawned harvesters act immediately); before economy |
| 7    | Economy           | `tickEconomy(state.economy, dt, separatorOnlineMap)` | Needs power status (step 3) and raw deliveries (step 6) |

**Critical constraints:**
- Power before Control: `control.current` depends on online relay count from power state.
- Control before Production: production reads `control.used`/`control.current` for decisions.
- Production before Harvesting: newly spawned harvesters can act in the same tick.
- Harvesting before Economy: raw deliveries visible to `tickEconomy` in the same tick.
- Completion cascade between Construction and all downstream systems.

**`tickControl` never modifies `used`.** The `used` field is only modified by:
- `createGameState()` (initial unit costs)
- `startProduction()` (reserves control at enqueue time, not at spawn)

---

## 5. Systems Ownership

Each system owns one domain. No hidden cross-system mutation.

| System       | File              | State Type              | Tick Signature                             | Owns                                     | Reads from other systems |
|--------------|-------------------|-------------------------|--------------------------------------------|------------------------------------------|--------------------------|
| Construction | `construction.ts` | MapData (builders/sites)| `tickConstruction(map, dt)`                | Builder busy, site progress, placement   | Economy (matter cost)    |
| Economy      | `economy.ts`      | `EconomyState`          | `tickEconomy(state, dt, sepOnlineMap)`     | Resources, separator conversion          | Power (via sepOnlineMap) |
| Power        | `power.ts`        | `PowerState`            | `tickPower(state)`                         | Building online/offline, supply/demand   | —                        |
| Control      | `control.ts`      | `ControlState`          | `tickControl(state, relayOnlineCount)`     | current capacity                          | Power (relay count)      |
| Production   | `production.ts`   | `ProductionState`       | `tickProduction(state, dt)`                | Factory queues, progress, unit spawning  | Power, Control, Economy  |
| Harvesting   | `harvesting.ts`   | `HarvesterState[]`      | `tickHarvesting(state, dt)`                | Harvester state machine, raw delivery    | Economy (raw cap)        |

**Pattern per system file:**
1. Constants (exported)
2. State type + Readonly type (exported)
3. Factory function: `createXxxState(...)`
4. Tick function: `tickXxx(state, dt, ...)`
5. Command functions (if any): `startXxx(...)`
6. Helper functions

---

## 6. Render / UI Rules

- **Render reads state, never mutates gameplay state.** `renderer.ts` and all HUD components receive `ReadonlyXxxState` types.
- **UI components call back to GameWorld for mutations.** Production panel calls `onProduce(tx, ty, unitType)`; build menu calls `onBuild(type)`.
- **No gameplay logic in render/UI files.** Disabled-state checks in `production-panel.ts` mirror `canProduce()` for UI feedback only — the authoritative validation is in the system.
- **Renderer orchestrator target:** under 150 lines. Rendering details live in separate files (`buildings.ts`, `terrain.ts`, `environment.ts`).

---

## 7. Test Hooks

Test hooks are published by `GameWorld.publishTestHooks()` and cleaned up in `destroy()`.

**Read-only state snapshots (all modes):**

| Hook                 | Source                     | Content |
|----------------------|----------------------------|---------|
| `__cameraPos`        | Camera                     | x, y |
| `__economyState`     | `state.economy`            | faction, raw, matter, elements, caps, separators |
| `__powerState`       | `state.power`              | totalSupply, totalDemand, netPower, buildings |
| `__controlState`     | `state.control`            | current, cap, used |
| `__constructionState`| `state.map.builders/sites` | builderBusy, builders, sites, statusMessage |
| `__harvesterState`   | `state.harvesters/nodes`   | harvesters, resourceNodes |
| `__productionState`  | `state.production`         | factories, queues |

**Command hooks (mode=test only):**

| Hook                | Methods                                         | Purpose |
|---------------------|-------------------------------------------------|---------|
| `__constructionTest`| `setMatter(value)`, `advanceConstruction(seconds)`, `startConstruction(type)` | Debug control for E2E tests |
| `__productionTest`  | `startProduction(tx, ty, unitType)`             | Direct production command for E2E tests |

**E2E test pattern:** Use `expect.poll()` for async assertions on hook values, then assert DOM state.

---

## 8. Adding a New System

Checklist for integrating a new system into the project:

1. **Define state type** — `export interface XxxState { ... }` + `export type ReadonlyXxxState = Readonly<XxxState>`
2. **Create state factory** — `export function createXxxState(...): XxxState`
3. **Implement tick function** — `export function tickXxx(state, dt, ...)`
4. **Add state field to GameState** — `xxx: XxxState` in the `GameState` interface
5. **Initialize in createGameState()** — call factory, set field
6. **Add tick call to system-runner** — in the correct position (see tick order rules above)
7. **Add completion cascade wiring** — if the system reacts to completed buildings, add wiring in the cascade loop
8. **Add GameWorld wrapper** — only if the system has user-facing commands (startXxx). Keep it thin: delegate to system, then publishUiState
9. **Add UI/render** — only after logic is complete and tested. Use ReadonlyXxxState
10. **Unit tests** — pure logic tests using direct state construction
11. **E2E tests** — only for user-facing flows

---

## 9. Do / Don't

### Do

- Keep GameWorld thin — delegate simulation to systems, rendering to renderer
- Keep systems pure — no DOM, no rendering, no imports from render/screens
- Reserve control at command time (enqueue), not at spawn time
- Run power before control in tick order
- Use `ReadonlyXxxState` types for render/UI
- Use `expect.poll()` for async E2E assertions
- Document tick order changes in this file
- Add unit tests before E2E tests for new systems

### Don't

- Put gameplay logic in render/UI files
- Add game rules to GameWorld
- Mutate gameplay state from render code
- Create cross-system hidden mutations
- Add test hooks that bypass system validation
- Skip tick order when adding a new system
- Propose ECS/event bus/DI as a refactoring target
- Mix current architecture with aspirational redesign in this document
