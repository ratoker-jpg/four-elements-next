// Four Elements v0.4 module: economy system — pure data API.
// ARCH-LAB-06-BUNDLE: economy contract — resource types, power states,
//   separator states, snapshots, validators, affordability, capacity, cycle.
// Provides window.FE_ECONOMY_SYSTEM with resource/power/separator constants,
// factory functions, and predicates.
// All functions are pure: zero game mutation, zero DOM/canvas access,
// zero pathfinding, zero economy execution.
// All objects are plain serializable data.

(function () {
  'use strict';

  // ── Resource type constants ──────────────────────────────────
  // Canonical resource type identifiers used across the economy system.
  var RESOURCE_TYPES = Object.freeze({
    MINERALS:  'minerals',
    ENERGY:    'energy',
    PURPLE:    'purple',
    GREEN_EL:  'greenEl',
    CYAN_EL:   'cyanEl',
    YELLOW_EL: 'yellowEl'
  });

  // ── Power state constants ────────────────────────────────────
  // Describes the overall power state of a player's building network.
  var POWER_STATES = Object.freeze({
    NOMINAL: 'nominal',   // supply >= demand — all buildings operate normally
    DEFICIT: 'deficit',   // supply < demand — buildings may slow or shut down
    OFFLINE: 'offline'    // no power source — everything inactive
  });

  // ── Separator state constants ────────────────────────────────
  // Describes the operational state of a separator (resource converter).
  var SEPARATOR_STATES = Object.freeze({
    ACTIVE:    'active',     // currently processing a cycle
    IDLE:      'idle',       // waiting for resources or power
    POWERED_DOWN: 'powered_down'  // insufficient power to operate
  });

  // ── Separator conversion constants ───────────────────────────
  // These values define the separator's per-cycle input/output rates.
  // They match the current in-game behavior and the buildings.js config.
  var SEPARATOR_INPUT_MINERALS   = 15;   // minerals consumed per cycle
  var SEPARATOR_OUTPUT_ENERGY    = 10;   // energy produced per cycle
  var SEPARATOR_OUTPUT_ELEMENT   = 1;    // element produced per cycle
  var SEPARATOR_CYCLE_SECONDS    = 6.0;  // seconds per conversion cycle

  // ── Storage / power constants ────────────────────────────────
  // Default starting caps and HQ power supply. These are baseline values;
  // buildings.js storageBonus and runtime_flags.js override them at runtime.
  var DEFAULT_MINERALS_CAP  = 200;
  var DEFAULT_ENERGY_CAP    = 300;
  var DEFAULT_ELEMENT_CAP   = 20;
  var HQ_POWER_SUPPLY_MW    = 15;    // matches FE_POWER_HQ_MW in runtime_flags.js

  // ── Internal helpers ─────────────────────────────────────────

  /**
   * Defensive number: coerce to finite number or return fallback.
   * @param {*} v
   * @param {number} fallback
   * @returns {number}
   */
  function _safeNum(v, fallback) {
    return Number.isFinite(v) ? Number(v) : (fallback || 0);
  }

  // ── Factory functions ────────────────────────────────────────

  /**
   * Create a resource snapshot: a plain object capturing the current
   * resource amounts and their capacity limits.
   * @param {Object} [amounts] — current amounts { minerals, energy, purple, greenEl, cyanEl, yellowEl }
   * @param {Object} [caps]    — capacity limits  { minerals, energy, purple, greenEl, cyanEl, yellowEl }
   * @returns {Object} plain resource snapshot
   */
  function createResourceSnapshot(amounts, caps) {
    var a = amounts && typeof amounts === 'object' ? amounts : {};
    var c = caps && typeof caps === 'object' ? caps : {};
    return {
      minerals:  _safeNum(a.minerals, 0),
      energy:    _safeNum(a.energy, 0),
      purple:    _safeNum(a.purple, 0),
      greenEl:   _safeNum(a.greenEl, 0),
      cyanEl:    _safeNum(a.cyanEl, 0),
      yellowEl:  _safeNum(a.yellowEl, 0),
      caps: {
        minerals:  _safeNum(c.minerals, DEFAULT_MINERALS_CAP),
        energy:    _safeNum(c.energy, DEFAULT_ENERGY_CAP),
        purple:    _safeNum(c.purple, DEFAULT_ELEMENT_CAP),
        greenEl:   _safeNum(c.greenEl, DEFAULT_ELEMENT_CAP),
        cyanEl:    _safeNum(c.cyanEl, DEFAULT_ELEMENT_CAP),
        yellowEl:  _safeNum(c.yellowEl, DEFAULT_ELEMENT_CAP)
      }
    };
  }

  /**
   * Create a power state snapshot: a plain object capturing current
   * power supply (MW), demand (MW), and the resolved state.
   * @param {Object} [params]
   * @param {number} [params.supplyMw]  — total power supply in MW
   * @param {number} [params.demandMw]  — total power demand in MW
   * @param {string} [params.state]     — one of POWER_STATES values
   * @returns {Object} plain power state snapshot
   */
  function createPowerStateSnapshot(params) {
    var p = params && typeof params === 'object' ? params : {};
    var supply = _safeNum(p.supplyMw, 0);
    var demand = _safeNum(p.demandMw, 0);
    var state;
    if (p.state && typeof p.state === 'string') {
      state = p.state;
    } else if (supply <= 0) {
      state = POWER_STATES.OFFLINE;
    } else if (supply < demand) {
      state = POWER_STATES.DEFICIT;
    } else {
      state = POWER_STATES.NOMINAL;
    }
    return {
      supplyMw: supply,
      demandMw: demand,
      state:    state
    };
  }

  /**
   * Create a separator state: a plain object capturing the separator's
   * operational state and cycle progress.
   * @param {Object} [params]
   * @param {string} [params.state]         — one of SEPARATOR_STATES values
   * @param {number} [params.cycleProgress] — 0..1 fraction of current cycle
   * @param {number} [params.cyclesCompleted] — total completed cycles
   * @returns {Object} plain separator state
   */
  function createSeparatorState(params) {
    var p = params && typeof params === 'object' ? params : {};
    return {
      state:           String(p.state || SEPARATOR_STATES.IDLE),
      cycleProgress:   Math.max(0, Math.min(1, _safeNum(p.cycleProgress, 0))),
      cyclesCompleted: Math.max(0, _safeNum(p.cyclesCompleted, 0))
    };
  }

  // ── Validators ───────────────────────────────────────────────

  /**
   * Structural validation: is the value a valid resource snapshot?
   * Returns true if valid, or a descriptive error string if not.
   * @param {*} value
   * @returns {true|string}
   */
  function isValidResourceSnapshot(value) {
    if (!value || typeof value !== 'object') {
      return 'Not a valid resource snapshot: must be an object';
    }
    var numFields = ['minerals', 'energy', 'purple', 'greenEl', 'cyanEl', 'yellowEl'];
    for (var i = 0; i < numFields.length; i++) {
      if (typeof value[numFields[i]] !== 'number') {
        return 'Resource snapshot.' + numFields[i] + ' must be a number';
      }
    }
    if (!value.caps || typeof value.caps !== 'object') {
      return 'Resource snapshot.caps must be an object';
    }
    for (var j = 0; j < numFields.length; j++) {
      if (typeof value.caps[numFields[j]] !== 'number') {
        return 'Resource snapshot.caps.' + numFields[j] + ' must be a number';
      }
    }
    return true;
  }

  /**
   * Structural validation: is the value a valid power state snapshot?
   * Returns true if valid, or a descriptive error string if not.
   * @param {*} value
   * @returns {true|string}
   */
  function isValidPowerStateSnapshot(value) {
    if (!value || typeof value !== 'object') {
      return 'Not a valid power state snapshot: must be an object';
    }
    if (typeof value.supplyMw !== 'number') {
      return 'Power state snapshot.supplyMw must be a number';
    }
    if (typeof value.demandMw !== 'number') {
      return 'Power state snapshot.demandMw must be a number';
    }
    var validStates = [POWER_STATES.NOMINAL, POWER_STATES.DEFICIT, POWER_STATES.OFFLINE];
    if (typeof value.state !== 'string' || validStates.indexOf(value.state) === -1) {
      return 'Power state snapshot.state must be one of: nominal, deficit, offline';
    }
    return true;
  }

  // ── Pure decision helpers ────────────────────────────────────

  /**
   * Pure predicate: can the player afford a resource cost?
   * Checks each resource field in the cost object against the snapshot.
   * @param {Object} snapshot — resource snapshot from createResourceSnapshot
   * @param {Object} cost     — { minerals, energy, purple, greenEl, cyanEl, yellowEl }
   * @returns {boolean}
   */
  function canAffordResource(snapshot, cost) {
    if (!snapshot || typeof snapshot !== 'object') return false;
    if (!cost || typeof cost !== 'object') return true;
    var fields = ['minerals', 'energy', 'purple', 'greenEl', 'cyanEl', 'yellowEl'];
    for (var i = 0; i < fields.length; i++) {
      var needed = _safeNum(cost[fields[i]], 0);
      if (needed > 0 && _safeNum(snapshot[fields[i]], 0) < needed) return false;
    }
    return true;
  }

  /**
   * Calculate remaining capacity for a resource type in a snapshot.
   * Returns the difference between cap and current amount (0 floor).
   * @param {Object} snapshot — resource snapshot
   * @param {string} resourceType — one of RESOURCE_TYPES values
   * @returns {number} remaining capacity, or 0 if unknown/invalid
   */
  function calculateRemainingCapacity(snapshot, resourceType) {
    if (!snapshot || typeof snapshot !== 'object') return 0;
    var current = _safeNum(snapshot[resourceType], 0);
    var cap = (snapshot.caps && typeof snapshot.caps === 'object')
      ? _safeNum(snapshot.caps[resourceType], 0)
      : 0;
    return Math.max(0, cap - current);
  }

  /**
   * Pure predicate: is a separator cycle ready to complete?
   * A cycle is ready when progress >= 1.0.
   * @param {Object} separatorState — separator state from createSeparatorState
   * @returns {boolean}
   */
  function isSeparatorCycleReady(separatorState) {
    if (!separatorState || typeof separatorState !== 'object') return false;
    return _safeNum(separatorState.cycleProgress, 0) >= 1.0;
  }

  // ── Public API ───────────────────────────────────────────────

  window.FE_ECONOMY_SYSTEM = {
    RESOURCE_TYPES:            RESOURCE_TYPES,
    POWER_STATES:              POWER_STATES,
    SEPARATOR_STATES:          SEPARATOR_STATES,
    SEPARATOR_INPUT_MINERALS:  SEPARATOR_INPUT_MINERALS,
    SEPARATOR_OUTPUT_ENERGY:   SEPARATOR_OUTPUT_ENERGY,
    SEPARATOR_OUTPUT_ELEMENT:  SEPARATOR_OUTPUT_ELEMENT,
    SEPARATOR_CYCLE_SECONDS:   SEPARATOR_CYCLE_SECONDS,
    DEFAULT_MINERALS_CAP:      DEFAULT_MINERALS_CAP,
    DEFAULT_ENERGY_CAP:        DEFAULT_ENERGY_CAP,
    DEFAULT_ELEMENT_CAP:       DEFAULT_ELEMENT_CAP,
    HQ_POWER_SUPPLY_MW:        HQ_POWER_SUPPLY_MW,
    createResourceSnapshot:    createResourceSnapshot,
    createPowerStateSnapshot:  createPowerStateSnapshot,
    createSeparatorState:      createSeparatorState,
    isValidResourceSnapshot:   isValidResourceSnapshot,
    isValidPowerStateSnapshot: isValidPowerStateSnapshot,
    canAffordResource:         canAffordResource,
    calculateRemainingCapacity:calculateRemainingCapacity,
    isSeparatorCycleReady:     isSeparatorCycleReady
  };
})();
