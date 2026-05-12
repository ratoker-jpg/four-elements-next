/**
 * FE_ENEMY_INTEL — Pure data/contract module for enemy intel.
 *
 * ARCH-LAB-05A: contract-only — no main.js changes, no behavior changes.
 * Factories are not wired yet; 05A2 may audit/delegate
 * FE_INTEL01Init / FE_PATCH_10BCreateEnemyKnowledge if safe.
 *
 * Constraints:
 *   - No game access
 *   - No FE_CORE access
 *   - No DOM / canvas / getContext
 *   - No pathfinding
 *   - No command execution
 *   - No combat execution
 *   - No bot/scout behavior execution
 *   - No runtime flags
 *   - No mutation of game objects
 *   - No dependency on tank_decider.js
 */
(function () {
  'use strict';

  // ── Constants ────────────────────────────────────────────────────────

  /** Scout lifecycle states — matches _scout02BState values in main.js */
  var SCOUT_LIFECYCLE_STATES = Object.freeze({
    OUTBOUND:  'outbound',
    OBSERVING: 'observing',
    SWEEPING:  'sweeping',
    RETURNING: 'returning',
    COOLDOWN:  'cooldown'
  });

  /** Intel sources — matches intelSource field values in main.js */
  var INTEL_SOURCES = Object.freeze({
    SCOUT:          'scout',
    TANK_VISION:    'tank_vision',
    COMBAT_CONTACT: 'combat_contact',
    NONE:           'none'
  });

  /** Scout return reasons — matches _scout02BReason values used at returning transitions */
  var SCOUT_RETURN_REASONS = Object.freeze({
    OBSERVE_DONE:          'observe_done',
    SWEEP_DONE:            'sweep_done',
    SWEEP_TIMEOUT:         'sweep_timeout',
    SWEEP_NO_VALID_POINTS: 'sweep_no_valid_points',
    THREAT_DANGER:         'threat_danger',
    DAMAGED:               'damaged',
    RETURN_NO_ROUTE:       'return_no_route',
    COOLDOWN_DONE:         'cooldown_done'
  });

  // ── Factory: Enemy Knowledge ──────────────────────────────────────────

  /**
   * createEnemyKnowledgeShell()
   * Mirrors FE_PATCH_10BCreateEnemyKnowledge() shape from main.js exactly.
   * No fields invented, no fields omitted, no defaults changed.
   */
  function createEnemyKnowledgeShell() {
    return {
      updatedAt:          0,
      visibleUnitIds:     [],
      visibleBuildingIds: [],
      knownUnitsById:     Object.create(null),
      knownBuildingsById: Object.create(null),
      lastVisibleCounts:  { units: 0, buildings: 0 }
    };
  }

  // ── Factory: Enemy Intel Snapshot ─────────────────────────────────────

  /**
   * createEnemyIntelSnapshot()
   * Mirrors FE_INTEL01Init() game.enemyIntel shape from main.js exactly.
   * No fields invented, no fields omitted, no defaults changed.
   */
  function createEnemyIntelSnapshot() {
    return {
      playerHqSeen:              false,
      playerHqX:                 null,
      playerHqY:                 null,
      playerHqCenterX:           null,
      playerHqCenterY:           null,
      // BOT-INTEL-01B: estimate fields from scout target metadata (not confirmed visual).
      playerHqEstimateX:         null,
      playerHqEstimateY:         null,
      playerHqEstimateCenterX:   null,
      playerHqEstimateCenterY:   null,
      playerHqEstimateSource:    '',
      lastPlayerHqEstimateAt:    0,
      lastScoutSweepDoneAt:      0,
      lastUsefulIntelAt:         0,
      seenPlayerUnitsCount:      0,
      seenPlayerBuildingsCount:  0,
      knownPlayerUnitsByType: {
        harvester: 0,
        builder:   0,
        light_tank: 0,
        scout:     0,
        other:     0
      },
      knownPlayerBuildingsByType: {
        hq_base:           0,
        units_factory:     0,
        separator:         0,
        minerals_storage:  0,
        energy_storage:    0,
        elements_storage:  0,
        power_plant:       0,
        energy_reactor:    0,
        repair_center:     0,
        defense_tower:     0,
        other:             0
      },
      nearestKnownPlayerTankDist: -1,
      intelSource:                'scout'
    };
  }

  // ── Validators ────────────────────────────────────────────────────────

  /**
   * isValidEnemyKnowledge(obj)
   * Structural validation only. Returns true or a descriptive string error.
   */
  function isValidEnemyKnowledge(obj) {
    if (!obj || typeof obj !== 'object') return 'enemyKnowledge must be an object';
    if (typeof obj.updatedAt !== 'number') return 'enemyKnowledge.updatedAt must be a number';
    if (!Array.isArray(obj.visibleUnitIds)) return 'enemyKnowledge.visibleUnitIds must be an array';
    if (!Array.isArray(obj.visibleBuildingIds)) return 'enemyKnowledge.visibleBuildingIds must be an array';
    if (!obj.knownUnitsById || typeof obj.knownUnitsById !== 'object') return 'enemyKnowledge.knownUnitsById must be an object';
    if (!obj.knownBuildingsById || typeof obj.knownBuildingsById !== 'object') return 'enemyKnowledge.knownBuildingsById must be an object';
    if (!obj.lastVisibleCounts || typeof obj.lastVisibleCounts !== 'object') return 'enemyKnowledge.lastVisibleCounts must be an object';
    if (typeof obj.lastVisibleCounts.units !== 'number') return 'enemyKnowledge.lastVisibleCounts.units must be a number';
    if (typeof obj.lastVisibleCounts.buildings !== 'number') return 'enemyKnowledge.lastVisibleCounts.buildings must be a number';
    return true;
  }

  /**
   * isValidEnemyIntelSnapshot(obj)
   * Structural validation only. Returns true or a descriptive string error.
   */
  function isValidEnemyIntelSnapshot(obj) {
    if (!obj || typeof obj !== 'object') return 'enemyIntelSnapshot must be an object';
    if (typeof obj.playerHqSeen !== 'boolean') return 'enemyIntelSnapshot.playerHqSeen must be a boolean';
    // HQ coordinates — null or number
    if (obj.playerHqX !== null && typeof obj.playerHqX !== 'number') return 'enemyIntelSnapshot.playerHqX must be null or number';
    if (obj.playerHqY !== null && typeof obj.playerHqY !== 'number') return 'enemyIntelSnapshot.playerHqY must be null or number';
    if (obj.playerHqCenterX !== null && typeof obj.playerHqCenterX !== 'number') return 'enemyIntelSnapshot.playerHqCenterX must be null or number';
    if (obj.playerHqCenterY !== null && typeof obj.playerHqCenterY !== 'number') return 'enemyIntelSnapshot.playerHqCenterY must be null or number';
    // Estimate fields
    if (obj.playerHqEstimateX !== null && typeof obj.playerHqEstimateX !== 'number') return 'enemyIntelSnapshot.playerHqEstimateX must be null or number';
    if (obj.playerHqEstimateY !== null && typeof obj.playerHqEstimateY !== 'number') return 'enemyIntelSnapshot.playerHqEstimateY must be null or number';
    if (obj.playerHqEstimateCenterX !== null && typeof obj.playerHqEstimateCenterX !== 'number') return 'enemyIntelSnapshot.playerHqEstimateCenterX must be null or number';
    if (obj.playerHqEstimateCenterY !== null && typeof obj.playerHqEstimateCenterY !== 'number') return 'enemyIntelSnapshot.playerHqEstimateCenterY must be null or number';
    if (typeof obj.playerHqEstimateSource !== 'string') return 'enemyIntelSnapshot.playerHqEstimateSource must be a string';
    // Timestamps
    if (typeof obj.lastPlayerHqEstimateAt !== 'number') return 'enemyIntelSnapshot.lastPlayerHqEstimateAt must be a number';
    if (typeof obj.lastScoutSweepDoneAt !== 'number') return 'enemyIntelSnapshot.lastScoutSweepDoneAt must be a number';
    if (typeof obj.lastUsefulIntelAt !== 'number') return 'enemyIntelSnapshot.lastUsefulIntelAt must be a number';
    // Seen counts
    if (typeof obj.seenPlayerUnitsCount !== 'number') return 'enemyIntelSnapshot.seenPlayerUnitsCount must be a number';
    if (typeof obj.seenPlayerBuildingsCount !== 'number') return 'enemyIntelSnapshot.seenPlayerBuildingsCount must be a number';
    // Unit type breakdown
    if (!obj.knownPlayerUnitsByType || typeof obj.knownPlayerUnitsByType !== 'object') return 'enemyIntelSnapshot.knownPlayerUnitsByType must be an object';
    var unitTypes = ['harvester', 'builder', 'light_tank', 'scout', 'other'];
    for (var i = 0; i < unitTypes.length; i++) {
      if (typeof obj.knownPlayerUnitsByType[unitTypes[i]] !== 'number') return 'enemyIntelSnapshot.knownPlayerUnitsByType.' + unitTypes[i] + ' must be a number';
    }
    // Building type breakdown
    if (!obj.knownPlayerBuildingsByType || typeof obj.knownPlayerBuildingsByType !== 'object') return 'enemyIntelSnapshot.knownPlayerBuildingsByType must be an object';
    var bldgTypes = ['hq_base', 'units_factory', 'separator', 'minerals_storage', 'energy_storage', 'elements_storage', 'power_plant', 'energy_reactor', 'repair_center', 'defense_tower', 'other'];
    for (var j = 0; j < bldgTypes.length; j++) {
      if (typeof obj.knownPlayerBuildingsByType[bldgTypes[j]] !== 'number') return 'enemyIntelSnapshot.knownPlayerBuildingsByType.' + bldgTypes[j] + ' must be a number';
    }
    // Nearest tank distance
    if (typeof obj.nearestKnownPlayerTankDist !== 'number') return 'enemyIntelSnapshot.nearestKnownPlayerTankDist must be a number';
    // Intel source
    if (typeof obj.intelSource !== 'string') return 'enemyIntelSnapshot.intelSource must be a string';
    var validSources = ['scout', 'tank_vision', 'combat_contact', 'none'];
    if (validSources.indexOf(obj.intelSource) === -1) return 'enemyIntelSnapshot.intelSource must be one of: ' + validSources.join(', ');
    return true;
  }

  // ── Public API ────────────────────────────────────────────────────────

  window.FE_ENEMY_INTEL = {
    SCOUT_LIFECYCLE_STATES: SCOUT_LIFECYCLE_STATES,
    INTEL_SOURCES:          INTEL_SOURCES,
    SCOUT_RETURN_REASONS:   SCOUT_RETURN_REASONS,
    createEnemyKnowledgeShell: createEnemyKnowledgeShell,
    createEnemyIntelSnapshot:  createEnemyIntelSnapshot,
    isValidEnemyKnowledge:     isValidEnemyKnowledge,
    isValidEnemyIntelSnapshot: isValidEnemyIntelSnapshot
  };
})();
