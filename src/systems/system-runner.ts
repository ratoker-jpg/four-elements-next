/** System runner: executes all game systems in the correct order for one tick. */

import type { GameState } from '../game/game-state.js';
import { BUILDING_DEFINITIONS } from '../config/buildings.js';
import { tickConstruction } from './construction.js';
import { applyCompletedBuildingToEconomy } from './economy.js';
import { tickPower, isBuildingOnline, addBuildingToPowerState } from './power.js';
import { tickControl } from './control.js';
import { tickEconomy } from './economy.js';

/**
 * Run all game systems in the correct order for one tick.
 *
 * Order: construction → completion cascade → power → control → economy.
 * This matches the previous inline sequence in GameWorld.update().
 */
export function runSystems(state: GameState, dt: number): void {
  // 1. Construction tick
  const constructionResult = tickConstruction(state.map, dt);

  // 2. Completion cascade: wire each completed building into economy and power
  for (const building of constructionResult.completedBuildings) {
    applyCompletedBuildingToEconomy(state.economy, building);
    addBuildingToPowerState(state.power, building);
    const definition = BUILDING_DEFINITIONS[building.type];
    state.constructionStatusMessage = `${definition.label} построен. Строитель свободен.`;
  }

  // 3. Power tick
  tickPower(state.power);

  // 4. Control tick — recalculate based on online relays
  const relayOnlineCount = state.power.buildings.filter(
    (b) => b.type === 'command-relay' && b.online,
  ).length;
  tickControl(state.control, relayOnlineCount);

  // 5. Economy tick — build separator online map from power state
  const separatorOnlineMap = new Map<string, boolean>();
  for (const sep of state.economy.separators) {
    separatorOnlineMap.set(`${sep.tx},${sep.ty}`, isBuildingOnline(state.power, sep.tx, sep.ty));
  }
  tickEconomy(state.economy, dt, separatorOnlineMap);
}
