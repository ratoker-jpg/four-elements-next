/** System runner: executes all game systems in the correct order for one tick. */

import type { GameState } from '../game/game-state.js';
import { BUILDING_DEFINITIONS } from '../config/buildings.js';
import { tickConstruction } from './construction.js';
import { applyCompletedBuildingToEconomy } from './economy.js';
import { tickPower, isBuildingOnline, addBuildingToPowerState } from './power.js';
import { tickControl } from './control.js';
import { tickHarvesting } from './harvesting.js';
import { tickEconomy } from './economy.js';
import { applyCompletedBuildingToProduction, tickProduction } from './production.js';
import { tickTerritory, addBuildingSource } from './territory.js';

/**
 * Run all game systems in the correct order for one tick.
 *
 * Order: construction → completion cascade → territory source → power → control → production → harvesting → economy → territory.
 * Territory source registration happens in completion cascade.
 * Territory tick runs after economy (no dependency on economy, but consistent end-of-tick position).
 */
export function runSystems(state: GameState, dt: number): void {
  // 1. Construction tick
  const constructionResult = tickConstruction(state.map, state.economy, dt);

  // 2. Completion cascade: wire each completed building into economy, power, and production
  for (const building of constructionResult.completedBuildings) {
    applyCompletedBuildingToEconomy(state.economy, building);
    addBuildingToPowerState(state.power, building);
    applyCompletedBuildingToProduction(state.production, building);
    addBuildingSource(state.territory, building, state.map.hq.faction);
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

  // 5. Production tick — factory queues progress and spawn units
  tickProduction(state, dt);

  // 6. Harvesting tick — harvesters gather and deliver raw
  tickHarvesting(state, dt);

  // 7. Economy tick — build separator online map from power state
  const separatorOnlineMap = new Map<string, boolean>();
  for (const sep of state.economy.separators) {
    separatorOnlineMap.set(`${sep.tx},${sep.ty}`, isBuildingOnline(state.power, sep.tx, sep.ty));
  }
  tickEconomy(state.economy, dt, separatorOnlineMap);

  // 8. Territory tick — slow faction spread
  tickTerritory(state.territory, state.map, dt);
}
