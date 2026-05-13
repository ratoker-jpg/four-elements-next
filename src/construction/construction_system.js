// Four Elements v0.4 module: construction system — pure data API.
// ARCH-LAB-06-BUNDLE: construction contract — building states, construction
//   states, build order states, HP defaults, refund rates, factories,
//   validators, affordability, refund calculation, completion check.
// Provides window.FE_CONSTRUCTION_SYSTEM with construction/building constants,
// factory functions, and predicates.
// All functions are pure: zero game mutation, zero DOM/canvas access,
// zero pathfinding, zero construction execution.
// All objects are plain serializable data.

(function () {
  'use strict';

  // ── Building state constants ─────────────────────────────────
  // Describes the operational state of a completed building.
  var BUILDING_STATES = Object.freeze({
    ACTIVE:    'active',      // building is operational
    DAMAGED:   'damaged',     // building is operational but below full HP
    DESTROYED: 'destroyed',   // building has been destroyed (HP <= 0)
    PLANNED:   'planned'      // building is placed but not yet under construction
  });

  // ── Construction state constants ─────────────────────────────
  // Describes the lifecycle state of a building under construction.
  var CONSTRUCTION_STATES = Object.freeze({
    NOT_STARTED:   'not_started',   // build order placed, builder not yet arrived
    IN_PROGRESS:   'in_progress',   // builder is actively constructing
    PAUSED:        'paused',        // construction paused (builder left, power deficit, etc.)
    COMPLETED:     'completed',     // construction finished, building now active
    CANCELLED:     'cancelled'      // construction cancelled, resources partially refunded
  });

  // ── Build order state constants ──────────────────────────────
  // Describes the state of a build order in the player's command queue.
  var BUILD_ORDER_STATES = Object.freeze({
    PENDING:   'pending',    // order placed, waiting for builder assignment
    ASSIGNED:  'assigned',   // builder assigned, moving to site
    BUILDING:  'building',   // builder on-site, actively constructing
    DONE:      'done',       // construction completed
    FAILED:    'failed'      // order failed (site blocked, builder killed, etc.)
  });

  // ── Building HP defaults ─────────────────────────────────────
  // Default HP values for building types. These mirror the current
  // runtime baseline in main.js, not invented new values.
  // buildings.js may override them with specific hp fields.
  var DEFAULT_BUILDING_HP    = 320;
  var HQ_HP                  = 1000;

  // ── Refund rate defaults ─────────────────────────────────────
  // Fraction of energy cost refunded when a building is cancelled/destroyed.
  var DEFAULT_CANCEL_REFUND_RATE      = 0.75;  // matches FE_BUILDER_CONSTRUCTION_CANCEL_REFUND_RATE
  var DEFAULT_DESTROY_REFUND_RATE     = 0.0;   // no refund for destroyed buildings by default

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
   * Create a build cost result: a plain object describing the cost
   * and refund of a building construction action.
   * @param {Object} [params]
   * @param {number} [params.energyCost]   — energy cost of the building
   * @param {number} [params.buildTime]    — construction time in seconds
   * @param {number} [params.refundAmount] — energy refunded on cancel
   * @param {string} [params.buildingType] — building type key
   * @returns {Object} plain build cost result
   */
  function createBuildCostResult(params) {
    var p = params && typeof params === 'object' ? params : {};
    return {
      energyCost:   _safeNum(p.energyCost, 0),
      buildTime:    _safeNum(p.buildTime, 0),
      refundAmount: _safeNum(p.refundAmount, 0),
      buildingType: String(p.buildingType || '')
    };
  }

  /**
   * Create a build order state: a plain object tracking a build order
   * from placement through completion.
   * @param {Object} [params]
   * @param {string} [params.state]        — one of BUILD_ORDER_STATES values
   * @param {string} [params.buildingType] — building type key
   * @param {string} [params.builderId]    — assigned builder unit ID
   * @param {number} [params.tileX]        — construction site X
   * @param {number} [params.tileY]        — construction site Y
   * @returns {Object} plain build order state
   */
  function createBuildOrderState(params) {
    var p = params && typeof params === 'object' ? params : {};
    return {
      state:        String(p.state || BUILD_ORDER_STATES.PENDING),
      buildingType: String(p.buildingType || ''),
      builderId:    String(p.builderId || ''),
      tileX:        _safeNum(p.tileX, 0),
      tileY:        _safeNum(p.tileY, 0)
    };
  }

  /**
   * Create a construction state: a plain object tracking a building
   * under construction, including progress and HP.
   * @param {Object} [params]
   * @param {string} [params.state]          — one of CONSTRUCTION_STATES values
   * @param {number} [params.progress]       — 0..1 fraction completed
   * @param {number} [params.currentHp]      — HP built so far
   * @param {number} [params.maxHp]          — total HP when complete
   * @param {string} [params.buildingType]   — building type key
   * @returns {Object} plain construction state
   */
  function createConstructionState(params) {
    var p = params && typeof params === 'object' ? params : {};
    return {
      state:         String(p.state || CONSTRUCTION_STATES.NOT_STARTED),
      progress:      Math.max(0, Math.min(1, _safeNum(p.progress, 0))),
      currentHp:     _safeNum(p.currentHp, 0),
      maxHp:         _safeNum(p.maxHp, DEFAULT_BUILDING_HP),
      buildingType:  String(p.buildingType || '')
    };
  }

  // ── Validators ───────────────────────────────────────────────

  /**
   * Structural validation: is the value a valid build cost result?
   * Returns true if valid, or a descriptive error string if not.
   * @param {*} value
   * @returns {true|string}
   */
  function isValidBuildCostResult(value) {
    if (!value || typeof value !== 'object') {
      return 'Not a valid build cost result: must be an object';
    }
    if (typeof value.energyCost !== 'number') {
      return 'Build cost result.energyCost must be a number';
    }
    if (typeof value.buildTime !== 'number') {
      return 'Build cost result.buildTime must be a number';
    }
    if (typeof value.refundAmount !== 'number') {
      return 'Build cost result.refundAmount must be a number';
    }
    if (typeof value.buildingType !== 'string') {
      return 'Build cost result.buildingType must be a string';
    }
    return true;
  }

  /**
   * Structural validation: is the value a valid build order state?
   * Returns true if valid, or a descriptive error string if not.
   * @param {*} value
   * @returns {true|string}
   */
  function isValidBuildOrderState(value) {
    if (!value || typeof value !== 'object') {
      return 'Not a valid build order state: must be an object';
    }
    var validStates = [
      BUILD_ORDER_STATES.PENDING,
      BUILD_ORDER_STATES.ASSIGNED,
      BUILD_ORDER_STATES.BUILDING,
      BUILD_ORDER_STATES.DONE,
      BUILD_ORDER_STATES.FAILED
    ];
    if (typeof value.state !== 'string' || validStates.indexOf(value.state) === -1) {
      return 'Build order state.state must be one of: pending, assigned, building, done, failed';
    }
    if (typeof value.buildingType !== 'string') {
      return 'Build order state.buildingType must be a string';
    }
    return true;
  }

  // ── Pure decision helpers ────────────────────────────────────

  /**
   * Pure predicate: can the player afford to build a structure?
   * Reads building cost from FE_BUILDINGS config and checks against resource snapshot.
   * @param {string} buildingType — building type key from FE_BUILDINGS
   * @param {Object} snapshot     — resource snapshot (from FE_ECONOMY_SYSTEM)
   * @returns {boolean}
   */
  function canAffordBuild(buildingType, snapshot) {
    if (!buildingType || typeof buildingType !== 'string') return false;
    if (!snapshot || typeof snapshot !== 'object') return false;
    var buildings = window.FE_BUILDINGS;
    if (!buildings || !buildings[buildingType]) return false;
    var costEnergy = _safeNum(buildings[buildingType].costEnergy, 0);
    if (costEnergy > 0 && _safeNum(snapshot.energy, 0) < costEnergy) return false;
    return true;
  }

  /**
   * Calculate refund amount for a cancelled/destroyed building.
   * @param {number} energyCost   — original energy cost of the building
   * @param {number} [refundRate] — refund rate (0..1, default DEFAULT_CANCEL_REFUND_RATE)
   * @returns {number} refund amount in energy
   */
  function calculateRefund(energyCost, refundRate) {
    var cost = _safeNum(energyCost, 0);
    var rate = _safeNum(refundRate, DEFAULT_CANCEL_REFUND_RATE);
    if (rate < 0) rate = 0;
    if (rate > 1) rate = 1;
    return Math.floor(cost * rate);
  }

  /**
   * Pure predicate: is construction complete?
   * Returns true if the construction state indicates completion.
   * @param {Object} constructionState — construction state from createConstructionState
   * @returns {boolean}
   */
  function isConstructionComplete(constructionState) {
    if (!constructionState || typeof constructionState !== 'object') return false;
    return constructionState.state === CONSTRUCTION_STATES.COMPLETED;
  }

  // ── Public API ───────────────────────────────────────────────

  window.FE_CONSTRUCTION_SYSTEM = {
    BUILDING_STATES:          BUILDING_STATES,
    CONSTRUCTION_STATES:      CONSTRUCTION_STATES,
    BUILD_ORDER_STATES:       BUILD_ORDER_STATES,
    DEFAULT_BUILDING_HP:      DEFAULT_BUILDING_HP,
    HQ_HP:                    HQ_HP,
    DEFAULT_CANCEL_REFUND_RATE:      DEFAULT_CANCEL_REFUND_RATE,
    DEFAULT_DESTROY_REFUND_RATE:     DEFAULT_DESTROY_REFUND_RATE,
    createBuildCostResult:    createBuildCostResult,
    createBuildOrderState:    createBuildOrderState,
    createConstructionState:  createConstructionState,
    isValidBuildCostResult:   isValidBuildCostResult,
    isValidBuildOrderState:   isValidBuildOrderState,
    canAffordBuild:           canAffordBuild,
    calculateRefund:          calculateRefund,
    isConstructionComplete:   isConstructionComplete
  };
})();
