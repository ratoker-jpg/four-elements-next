// Four Elements v0.4 module: combat system — pure data API.
// ARCH-LAB-04C1: combat boundary — first step of combat system separation.
// Provides window.FE_COMBAT_SYSTEM with combat result, target kind,
// damage reason, and attack state constants, plus factory functions and predicates.
// All functions are pure: zero game mutation, zero DOM/canvas access,
// zero pathfinding, zero combat execution, zero command execution.
// All objects are plain serializable data.

(function () {
  'use strict';

  // ── Combat result constants ────────────────────────────────────
  // These represent the possible outcomes of a combat action
  // (attack tick, damage application, kill resolution).
  var COMBAT_RESULTS = Object.freeze({
    DAMAGED:           'damaged',            // target took damage but is alive
    KILLED:            'killed',             // target was killed by this attack
    TARGET_INVALID:    'target_invalid',     // target no longer exists or is not attackable
    TARGET_DEAD:       'target_dead',        // target is already dead
    OUT_OF_RANGE:      'out_of_range',       // attacker is too far from target
    COOLDOWN_NOT_READY:'cooldown_not_ready', // attack cooldown has not elapsed
    ALREADY_DEAD:      'already_dead'        // the unit itself is already dead
  });

  // Valid combat result values for quick lookup
  var _validResults = Object.create(null);
  Object.keys(COMBAT_RESULTS).forEach(function (k) {
    _validResults[COMBAT_RESULTS[k]] = true;
  });

  // ── Target kind constants ──────────────────────────────────────
  // These classify what kind of entity is being attacked.
  // Values match the targetKind strings used in main.js command system.
  var TARGET_KINDS = Object.freeze({
    UNIT:     'unit',
    BUILDING: 'building'
  });

  // Valid target kind values for quick lookup
  var _validTargetKinds = Object.create(null);
  Object.keys(TARGET_KINDS).forEach(function (k) {
    _validTargetKinds[TARGET_KINDS[k]] = true;
  });

  // ── Damage reason constants ────────────────────────────────────
  // These describe why damage was applied (or not applied).
  var DAMAGE_REASONS = Object.freeze({
    COMBAT_DAMAGE: 'combat_damage',  // normal attack damage
    ALREADY_DEAD:  'already_dead',   // target was already dead — no damage
    SCRIPTED:      'scripted'        // scripted/triggered damage (e.g. debug, game events)
  });

  // Valid damage reason values for quick lookup
  var _validDamageReasons = Object.create(null);
  Object.keys(DAMAGE_REASONS).forEach(function (k) {
    _validDamageReasons[DAMAGE_REASONS[k]] = true;
  });

  // ── Attack state constants ─────────────────────────────────────
  // These represent the phases a unit goes through during an attack cycle.
  // Values match the actual unit state strings used in main.js.
  var ATTACK_STATES = Object.freeze({
    ATTACKING:        'attacking',         // unit is actively firing at target
    ATTACK_APPROACH:  'attack_approach',   // unit is moving toward attack range
    ATTACK_MOVE:      'attack_move',       // unit is moving and will auto-aggro
    MOVING_TO_ATTACK: 'moving_to_attack'   // unit is moving to engage a target
  });

  // Valid attack state values for quick lookup
  var _validAttackStates = Object.create(null);
  Object.keys(ATTACK_STATES).forEach(function (k) {
    _validAttackStates[ATTACK_STATES[k]] = true;
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
   * Create a combat result object describing the outcome of a combat action.
   * @param {string} type — one of COMBAT_RESULTS values
   * @param {Object} [details] — optional context:
   *   { attackerId, targetId, targetKind, damage, hpRemaining, reason }
   * @returns {Object} plain combat result object
   */
  function createCombatResult(type, details) {
    return {
      type:    String(type || ''),
      details: details && typeof details === 'object' ? {
        attackerId:  details.attackerId != null ? String(details.attackerId) : '',
        targetId:    details.targetId != null ? String(details.targetId) : '',
        targetKind:  String(details.targetKind || ''),
        damage:      _safeNum(details.damage, 0),
        hpRemaining: _safeNum(details.hpRemaining, 0),
        reason:      String(details.reason || '')
      } : null
    };
  }

  /**
   * Create a damage result object describing a damage application event.
   * Convenience factory for COMBAT_RESULTS.DAMAGED results.
   * @param {string} type — one of COMBAT_RESULTS values (typically DAMAGED)
   * @param {Object} [details] — optional context:
   *   { attackerId, targetId, targetKind, damage, hpRemaining, reason }
   * @returns {Object} plain damage result object
   */
  function createDamageResult(type, details) {
    return createCombatResult(type, details);
  }

  /**
   * Create a kill result object describing a unit/building death event.
   * Convenience factory for COMBAT_RESULTS.KILLED results.
   * @param {string} type — one of COMBAT_RESULTS values (typically KILLED)
   * @param {Object} [details] — optional context:
   *   { attackerId, targetId, targetKind, damage, hpRemaining, reason }
   * @returns {Object} plain kill result object
   */
  function createKillResult(type, details) {
    return createCombatResult(type, details);
  }

  // ── Predicates ──────────────────────────────────────────────────

  /**
   * Type guard: is the value a combat result object produced by this system?
   * Checks for a valid `type` field matching a known COMBAT_RESULTS value.
   * @param {*} value
   * @returns {boolean}
   */
  function isCombatResult(value) {
    if (!value || typeof value !== 'object') return false;
    var t = value.type;
    return typeof t === 'string' && t in _validResults;
  }

  /**
   * Structural validation: does the combat result have all required fields?
   * Returns true if valid, or a descriptive error string if not.
   * @param {Object} cr
   * @returns {true|string}
   */
  function isValidCombatResult(cr) {
    if (!isCombatResult(cr)) {
      return 'Not a valid combat result: missing or invalid type field';
    }
    if (cr.details !== null && cr.details !== undefined) {
      if (typeof cr.details !== 'object') {
        return 'Combat result details must be an object or null';
      }
      if (typeof cr.details.attackerId !== 'string') {
        return 'Combat result details.attackerId must be a string';
      }
      if (typeof cr.details.targetId !== 'string') {
        return 'Combat result details.targetId must be a string';
      }
      if (typeof cr.details.targetKind !== 'string') {
        return 'Combat result details.targetKind must be a string';
      }
      if (typeof cr.details.damage !== 'number') {
        return 'Combat result details.damage must be a number';
      }
      if (typeof cr.details.hpRemaining !== 'number') {
        return 'Combat result details.hpRemaining must be a number';
      }
      if (typeof cr.details.reason !== 'string') {
        return 'Combat result details.reason must be a string';
      }
    }
    return true;
  }

  // ── Public API ──────────────────────────────────────────────────

  window.FE_COMBAT_SYSTEM = {
    COMBAT_RESULTS:     COMBAT_RESULTS,
    TARGET_KINDS:       TARGET_KINDS,
    DAMAGE_REASONS:     DAMAGE_REASONS,
    ATTACK_STATES:      ATTACK_STATES,
    createCombatResult: createCombatResult,
    createDamageResult: createDamageResult,
    createKillResult:   createKillResult,
    isCombatResult:     isCombatResult,
    isValidCombatResult:isValidCombatResult
  };
})();
