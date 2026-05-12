// Four Elements v0.4 module: movement system — pure data API.
// ARCH-LAB-04B1: movement boundary — first step of movement system separation.
// Provides window.FE_MOVEMENT_SYSTEM with movement states, results, reasons,
// recovery requests, factory functions, and predicates.
// All functions are pure: zero game mutation, zero DOM/canvas access,
// zero pathfinding execution, zero combat execution, zero command execution.
// All objects are plain serializable data.

(function () {
  'use strict';

  // ── Movement state constants ──────────────────────────────────
  // These values match the actual unit.state strings used in main.js.
  // Each state represents a distinct phase of a unit's lifecycle
  // related to movement or movement-adjacent activities.
  var MOVEMENT_STATES = Object.freeze({
    // Core movement states
    IDLE:               'idle',
    MANUAL_MOVE:        'manual_move',
    MOVING:             'moving',

    // Combat-adjacent movement states
    MOVING_TO_ATTACK:   'moving_to_attack',
    ATTACK_APPROACH:    'attack_approach',
    ATTACK_MOVE:        'attack_move',
    ATTACKING:          'attacking',

    // Builder movement states
    MOVING_TO_BUILD:    'moving_to_build',
    BUILDING:           'building',

    // Harvester movement states
    MOVING_TO_MINE:     'moving_to_mine',
    HARVESTING:         'harvesting',
    RETURNING:          'returning',
    STORAGE_FULL:       'storage_full',
    WAITING_FOR_BASE:   'waiting_for_base_path',
    UNLOADING:          'unloading'
  });

  // Valid state values for quick lookup
  var _validStates = Object.create(null);
  Object.keys(MOVEMENT_STATES).forEach(function (k) {
    _validStates[MOVEMENT_STATES[k]] = true;
  });

  // ── Movement result constants ──────────────────────────────────
  // These represent the possible outcomes of a movement tick
  // (return values of updateUnitMovement).
  var MOVEMENT_RESULTS = Object.freeze({
    WAYPOINT_REACHED:  'waypoint_reached',   // unit arrived at next waypoint
    IN_PROGRESS:       'in_progress',         // unit is moving toward next waypoint
    BLOCKED:           'blocked',             // next cell is impassable
    STUCK:             'stuck',               // unit hasn't moved for multiple ticks
    NO_PATH:           'no_path',             // unit has no path to follow
    RE_PATHED:         're_pathed',           // path was recalculated (ATTACK-06 recovery)
    ARRIVED:           'arrived'              // unit reached final destination
  });

  // ── Movement reason constants ──────────────────────────────────
  // These describe why a movement state transition occurred.
  var MOVEMENT_REASONS = Object.freeze({
    // Origin reasons — what initiated the movement
    PLAYER_COMMAND:       'player_command',        // player right-clicked move
    GROUP_COMMAND:        'group_command',          // group move order
    ATTACK_APPROACH_ORDER:'attack_approach_order',  // attack-approach command
    ATTACK_MOVE_ORDER:    'attack_move_order',      // attack-move command
    HARVEST_ASSIGNMENT:   'harvest_assignment',     // harvester sent to mine
    RETURN_TO_BASE:       'return_to_base',         // harvester returning resources
    BUILD_ORDER:          'build_order',            // builder heading to site
    ENEMY_BOT_ORDER:      'enemy_bot_order',        // enemy AI ordered movement
    RECOVERY_REPATH:      'recovery_repath',        // path recovery re-path

    // Cancellation reasons
    CANCEL_RIGHT_CLICK:   'cancel_right_click',     // RMB cancel
    CANCEL_BUILDER:       'cancel_builder',          // builder-specific cancel
    CANCEL_STOP_COMMAND:  'cancel_stop_command',     // stop command
    CANCEL_NEW_ORDER:     'cancel_new_order',        // new order overrides old
    CANCEL_TARGET_LOST:   'cancel_target_lost',      // attack target destroyed
    CANCEL_CELL_BLOCKED:  'cancel_cell_blocked',     // destination became impassable
    CANCEL_NO_PATH:       'cancel_no_path',           // no path exists to target

    // Blockage reasons — what is blocking the path
    BLOCKED_BY_UNIT:      'blocked_by_unit',
    BLOCKED_BY_BUILDING:  'blocked_by_building',
    BLOCKED_BY_MINERAL:   'blocked_by_mineral',
    BLOCKED_BY_OBSTACLE:  'blocked_by_obstacle',
    BLOCKED_BY_UNKNOWN:   'blocked_by_unknown',

    // Recovery outcome reasons
    REPATH_SUCCESS:       'repath_success',
    REPATH_FAILED:        'repath_failed',
    REPATH_THROTTLED:     'repath_throttled',
    RECOVERY_HARVESTER:   'recovery_harvester',
    RECOVERY_BUILDER:     'recovery_builder',
    RECOVERY_FALLBACK:    'recovery_fallback'
  });

  // ── Movement recovery request constants ────────────────────────
  // These describe what kind of path recovery a unit needs
  // when it gets stuck or blocked.
  var MOVEMENT_RECOVERY_REQUESTS = Object.freeze({
    ATTACK_APPROACH_REPATH: 'attack_approach_repath',  // light_tank re-path to attack target
    HARVESTER_REASSIGN:     'harvester_reassign',       // harvester needs new mine assignment
    BUILDER_REPATH:         'builder_repath',           // builder re-path to build site
    GENERIC_CLEAR:          'generic_clear'             // fallback: clear path, set idle
  });

  // ── Internal helpers ────────────────────────────────────────────

  /**
   * Defensive number: coerce to finite number or return fallback.
   * @param {*} v
   * @param {number} fallback
   * @returns {number}
   */
  function _safeNum(v, fallback) {
    return Number.isFinite(v) ? Number(v) : (fallback || 0);
  }

  // ── Factory functions ───────────────────────────────────────────

  /**
   * Create a movement result object describing the outcome of a movement tick.
   * @param {string} result — one of MOVEMENT_RESULTS values
   * @param {Object} [details] — optional context: { unitId, waypointX, waypointY, reason, pathRemaining }
   * @returns {Object} plain movement result object
   */
  function createMovementResult(result, details) {
    return {
      result:   String(result || ''),
      details:  details && typeof details === 'object' ? {
        unitId:        details.unitId != null ? String(details.unitId) : '',
        waypointX:     _safeNum(details.waypointX, 0),
        waypointY:     _safeNum(details.waypointY, 0),
        reason:        String(details.reason || ''),
        pathRemaining: _safeNum(details.pathRemaining, 0)
      } : null
    };
  }

  /**
   * Create a recovery request object describing what kind of path recovery a unit needs.
   * @param {string} requestType — one of MOVEMENT_RECOVERY_REQUESTS values
   * @param {Object} [details] — optional context: { unitId, unitType, currentState, targetId, blockerKind }
   * @returns {Object} plain recovery request object
   */
  function createRecoveryRequest(requestType, details) {
    return {
      requestType: String(requestType || ''),
      details:     details && typeof details === 'object' ? {
        unitId:       details.unitId != null ? String(details.unitId) : '',
        unitType:     String(details.unitType || ''),
        currentState: String(details.currentState || ''),
        targetId:     details.targetId != null ? String(details.targetId) : '',
        blockerKind:  String(details.blockerKind || '')
      } : null
    };
  }

  // ── Predicates ──────────────────────────────────────────────────

  /**
   * Type guard: is the value a movement result object produced by this system?
   * Checks for a valid `result` field matching a known MOVEMENT_RESULTS value.
   * @param {*} value
   * @returns {boolean}
   */
  function isMovementResult(value) {
    if (!value || typeof value !== 'object') return false;
    var r = value.result;
    return typeof r === 'string' && r in _validResultLookup;
  }

  /**
   * Type guard: is the value a recovery request object produced by this system?
   * Checks for a valid `requestType` field matching a known MOVEMENT_RECOVERY_REQUESTS value.
   * @param {*} value
   * @returns {boolean}
   */
  function isRecoveryRequest(value) {
    if (!value || typeof value !== 'object') return false;
    var rt = value.requestType;
    return typeof rt === 'string' && rt in _validRecoveryLookup;
  }

  // Valid result values for quick lookup
  var _validResultLookup = Object.create(null);
  Object.keys(MOVEMENT_RESULTS).forEach(function (k) {
    _validResultLookup[MOVEMENT_RESULTS[k]] = true;
  });

  // Valid recovery request values for quick lookup
  var _validRecoveryLookup = Object.create(null);
  Object.keys(MOVEMENT_RECOVERY_REQUESTS).forEach(function (k) {
    _validRecoveryLookup[MOVEMENT_RECOVERY_REQUESTS[k]] = true;
  });

  /**
   * Structural validation: does the movement result have all required fields?
   * Returns true if valid, or a descriptive error string if not.
   * @param {Object} mr
   * @returns {true|string}
   */
  function isValidMovementResult(mr) {
    if (!isMovementResult(mr)) {
      return 'Not a valid movement result: missing or invalid result field';
    }
    if (mr.details !== null && mr.details !== undefined) {
      if (typeof mr.details !== 'object') {
        return 'Movement result details must be an object or null';
      }
      if (typeof mr.details.unitId !== 'string') {
        return 'Movement result details.unitId must be a string';
      }
      if (typeof mr.details.waypointX !== 'number') {
        return 'Movement result details.waypointX must be a number';
      }
      if (typeof mr.details.waypointY !== 'number') {
        return 'Movement result details.waypointY must be a number';
      }
      if (typeof mr.details.reason !== 'string') {
        return 'Movement result details.reason must be a string';
      }
      if (typeof mr.details.pathRemaining !== 'number') {
        return 'Movement result details.pathRemaining must be a number';
      }
    }
    return true;
  }

  // ── Public API ──────────────────────────────────────────────────

  window.FE_MOVEMENT_SYSTEM = {
    MOVEMENT_STATES:             MOVEMENT_STATES,
    MOVEMENT_RESULTS:            MOVEMENT_RESULTS,
    MOVEMENT_REASONS:            MOVEMENT_REASONS,
    MOVEMENT_RECOVERY_REQUESTS:  MOVEMENT_RECOVERY_REQUESTS,
    createMovementResult:        createMovementResult,
    createRecoveryRequest:       createRecoveryRequest,
    isMovementResult:            isMovementResult,
    isRecoveryRequest:           isRecoveryRequest,
    isValidMovementResult:       isValidMovementResult
  };
})();
