# src/game/ — Game State & Data Factories

Ownership: game-state initialization, map-size configuration, and data
factories used when starting or loading a game.

## Modules

| File | Window global | Description |
|------|---------------|-------------|
| `game_state.js` | `window.FE_GAME_STATE` | `createBlankGame(sizeKey)` — returns a fresh game-state object for a new or loaded game. Depends on `window.FE_STANDALONE_CONSTANTS.MAP_SIZES`. |

## Dependencies

- `window.FE_STANDALONE_CONSTANTS` (from `src/core/standalone_constants.js`) — must be loaded **before** `game_state.js`.

## Consumers

- `src/main.js` — `blankGame()` delegates to `FE_GAME_STATE.createBlankGame()`.
- `src/core/save_manager.js` — receives `blankGame` callback via its `load()` API.

## Contract

`createBlankGame(sizeKey)` must return an object with this exact shape:

```
{
  screen, paused, mapSize, mapW, mapH, time,
  faction, factionWasRandom,
  resources, enemyResources, camera,
  terrain, minerals, units, buildings, obstacles,
  territory, fogVisible, fogExplored,
  messages, clickMarkers, dustParticles, combatFxParticles,
  _sepTimer, _reactTimer, _saveTimer,
  gameResult, gameResultReason, gameResultAt,
  gameEnded, _enemyHqSeen
}
```

If `window.FE_STANDALONE_CONSTANTS` is missing at load time, this module
throws immediately rather than silently producing a wrong state.

## Current contents

- `game_state.js` — extracted in ARCH-LAB-02 from `src/main.js blankGame()`.
