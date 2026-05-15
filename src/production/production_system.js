// Four Elements v0.4 module: production system — pure data API.
// ARCH-LAB-06-BUNDLE + 06B: production contract — production states, unit types,
//   factory queue constants, queue items, validators, affordability, timing.
// Provides window.FE_PRODUCTION_SYSTEM with production/unit constants,
// factory functions, and predicates.
// All functions are pure: zero game mutation, zero DOM/canvas access,
// zero pathfinding, zero production execution.
// All objects are plain serializable data.

(function () {
  'use strict';

  // ── Production state constants ───────────────────────────────
  // Describes the lifecycle state of a production queue item.
  var PRODUCTION_STATES = Object.freeze({
    QUEUED:    'queued',     // waiting for factory slot
    BUILDING:  'building',   // actively being produced
    PAUSED:    'paused',     // paused (e.g. power deficit)
    COMPLETED: 'completed',  // production finished, waiting to spawn
    CANCELLED: 'cancelled'   // cancelled by player or system
  });

  // ── Unit type constants ──────────────────────────────────────
  // Canonical unit type identifiers matching FE_UNITS keys.
  var UNIT_TYPES = Object.freeze({
    HARVESTER:  'harvester',
    BUILDER:    'builder',
    LIGHT_TANK: 'light_tank',
    HEAVY_TANK: 'heavy_tank',
    BOMBER:     'bomber',
    SCOUT:      'scout'
  });

  // ── Factory queue constants ──────────────────────────────────
  // Limits and defaults for the factory production queue.
  var MAX_QUEUE_SIZE            = 5;    // max items in a single factory queue (generic contract limit)
  var PLAYER_FACTORY_MAX_QUEUE  = 2;    // actual runtime queue limit for player factories
  var DEFAULT_PRODUCTION_SPEED  = 1.0;  // multiplier (1.0 = normal speed)
  var CANCEL_REFUND_RATE        = 0.75; // fraction of cost refunded on cancel

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
   * Create a production queue item: a plain object representing one
   * unit in a factory's production queue.
   * @param {Object} [params]
   * @param {string} [params.unitType]   — one of UNIT_TYPES values
   * @param {string} [params.state]      — one of PRODUCTION_STATES values
   * @param {number} [params.progress]   — 0..1 fraction completed
   * @param {number} [params.queuedAt]   — timestamp when queued
   * @param {number} [params.startedAt]  — timestamp when production started
   * @returns {Object} plain production queue item
   */
  function createProductionQueueItem(params) {
    var p = params && typeof params === 'object' ? params : {};
    return {
      unitType:  String(p.unitType || ''),
      state:     String(p.state || PRODUCTION_STATES.QUEUED),
      progress:  Math.max(0, Math.min(1, _safeNum(p.progress, 0))),
      queuedAt:  _safeNum(p.queuedAt, 0),
      startedAt: _safeNum(p.startedAt, 0)
    };
  }

  /**
   * Create a production state: a plain object capturing the full
   * state of a factory's production queue.
   * @param {Object} [params]
   * @param {Array}  [params.queue]          — array of production queue items
   * @param {string} [params.activeUnitType] — unit type currently being produced (or '')
   * @param {number} [params.factoryId]      — factory building identifier
   * @returns {Object} plain production state
   */
  function createProductionState(params) {
    var p = params && typeof params === 'object' ? params : {};
    var queue = Array.isArray(p.queue) ? p.queue : [];
    return {
      queue:           queue,
      activeUnitType:  String(p.activeUnitType || ''),
      factoryId:       String(p.factoryId || '')
    };
  }

  // ── Validators ───────────────────────────────────────────────

  /**
   * Structural validation: is the value a valid production queue item?
   * Returns true if valid, or a descriptive error string if not.
   * @param {*} value
   * @returns {true|string}
   */
  function isValidProductionQueueItem(value) {
    if (!value || typeof value !== 'object') {
      return 'Not a valid production queue item: must be an object';
    }
    if (typeof value.unitType !== 'string' || !value.unitType) {
      return 'Production queue item.unitType must be a non-empty string';
    }
    var validStates = [
      PRODUCTION_STATES.QUEUED,
      PRODUCTION_STATES.BUILDING,
      PRODUCTION_STATES.PAUSED,
      PRODUCTION_STATES.COMPLETED,
      PRODUCTION_STATES.CANCELLED
    ];
    if (typeof value.state !== 'string' || validStates.indexOf(value.state) === -1) {
      return 'Production queue item.state must be one of: queued, building, paused, completed, cancelled';
    }
    if (typeof value.progress !== 'number' || value.progress < 0 || value.progress > 1) {
      return 'Production queue item.progress must be a number between 0 and 1';
    }
    return true;
  }

  /**
   * Structural validation: is the value a valid production state?
   * Returns true if valid, or a descriptive error string if not.
   * @param {*} value
   * @returns {true|string}
   */
  function isValidProductionState(value) {
    if (!value || typeof value !== 'object') {
      return 'Not a valid production state: must be an object';
    }
    if (!Array.isArray(value.queue)) {
      return 'Production state.queue must be an array';
    }
    if (typeof value.activeUnitType !== 'string') {
      return 'Production state.activeUnitType must be a string';
    }
    if (typeof value.factoryId !== 'string') {
      return 'Production state.factoryId must be a string';
    }
    return true;
  }

  // ── Pure decision helpers ────────────────────────────────────

  /**
   * Pure predicate: can the player afford to produce a unit?
   * Reads unit cost from FE_UNITS config and checks against resource snapshot.
   * If elKey is provided, checks only that specific faction element.
   * If elKey is omitted, checks all element types (at least one must be sufficient).
   * @param {string} unitType — one of UNIT_TYPES values
   * @param {Object} snapshot — resource snapshot (from FE_ECONOMY_SYSTEM)
   * @param {string} [elKey]  — optional faction element key (e.g. 'cyanEl') for faction-specific check
   * @returns {boolean}
   */
  function canAffordUnit(unitType, snapshot, elKey) {
    if (!unitType || typeof unitType !== 'string') return false;
    if (!snapshot || typeof snapshot !== 'object') return false;
    var units = window.FE_UNITS;
    if (!units || !units[unitType]) return false;
    var costElement = _safeNum(units[unitType].costElement, 0);
    // Units cost elements (purple by default — the primary element type).
    // In the current economy, costElement is the number of faction elements required.
    if (costElement > 0) {
      if (elKey && typeof elKey === 'string') {
        // Faction-specific check: only the specified element type must be sufficient.
        if (_safeNum(snapshot[elKey], 0) < costElement) return false;
      } else {
        // Check all element types — player needs at least one type with enough
        var elementFields = ['purple', 'greenEl', 'cyanEl', 'yellowEl'];
        var canAffordAny = false;
        for (var i = 0; i < elementFields.length; i++) {
          if (_safeNum(snapshot[elementFields[i]], 0) >= costElement) {
            canAffordAny = true;
            break;
          }
        }
        if (!canAffordAny) return false;
      }
    }
    return true;
  }

  /**
   * Calculate production time for a unit type, adjusted by speed multiplier.
   * Reads base time from FE_UNITS config.
   * @param {string} unitType — one of UNIT_TYPES values
   * @param {number} [speedMultiplier] — production speed multiplier (default 1.0)
   * @returns {number} production time in seconds, or 0 if unknown
   */
  function calculateProductionTime(unitType, speedMultiplier) {
    if (!unitType || typeof unitType !== 'string') return 0;
    var units = window.FE_UNITS;
    if (!units || !units[unitType]) return 0;
    var baseTime = _safeNum(units[unitType].productionTime, 0);
    var speed = _safeNum(speedMultiplier, DEFAULT_PRODUCTION_SPEED);
    if (speed <= 0) speed = DEFAULT_PRODUCTION_SPEED;
    return baseTime / speed;
  }

  /**
   * Pure predicate: is the factory production queue full?
   * @param {Object} productionState — production state from createProductionState
   * @returns {boolean}
   */
  function isQueueFull(productionState) {
    if (!productionState || typeof productionState !== 'object') return true;
    if (!Array.isArray(productionState.queue)) return true;
    return productionState.queue.length >= MAX_QUEUE_SIZE;
  }

  // ── Public API ───────────────────────────────────────────────

  window.FE_PRODUCTION_SYSTEM = {
    PRODUCTION_STATES:       PRODUCTION_STATES,
    UNIT_TYPES:              UNIT_TYPES,
    MAX_QUEUE_SIZE:          MAX_QUEUE_SIZE,
    PLAYER_FACTORY_MAX_QUEUE: PLAYER_FACTORY_MAX_QUEUE,
    DEFAULT_PRODUCTION_SPEED:DEFAULT_PRODUCTION_SPEED,
    CANCEL_REFUND_RATE:      CANCEL_REFUND_RATE,
    createProductionQueueItem:  createProductionQueueItem,
    createProductionState:      createProductionState,
    isValidProductionQueueItem: isValidProductionQueueItem,
    isValidProductionState:     isValidProductionState,
    canAffordUnit:              canAffordUnit,
    calculateProductionTime:    calculateProductionTime,
    isQueueFull:                isQueueFull
  };
})();
