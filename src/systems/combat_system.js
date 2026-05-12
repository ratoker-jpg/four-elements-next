// Four Elements v0.4 module: combat system — pure data API.
// ARCH-LAB-04C4: range decision helper — isTargetInRange.
// ARCH-LAB-04C3: target classification/attackability helpers — classifyHostileTarget,
//   isAttackableEnemyBuilding.
// ARCH-LAB-04C2: target/range decision helpers — targetCenter, distanceToBuilding,
//   isDeadBuilding + BUILDING_CENTER_OFFSET constant.
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

  // ── Target/range decision helpers (ARCH-LAB-04C2) ──────────────
  // These pure functions encapsulate combat-adjacent geometry and
  // state predicates. They replace inline logic in main.js wrapper
  // functions, but execution (mutation, FX, pathfinding) stays in main.js.

  /**
   * Tile-center offset for building targets.
   * Building center = position + size/2 - BUILDING_CENTER_OFFSET.
   * Must remain 0.5 — changing this changes where shots aim.
   */
  var BUILDING_CENTER_OFFSET = 0.5;

  /**
   * Pure function: compute the center point of a target (unit or building).
   *
   * Replaces FE_PATCH_06BTargetCenter in main.js.
   * For buildings: center = { x: x + (w||1)/2 - 0.5, y: y + (h||1)/2 - 0.5 }
   * For non-buildings (units): center = { x, y }
   *
   * Do NOT require targetKind === 'unit' — legacy treats every
   * non-building target as unit-like (returns { x, y }).
   *
   * @param {Object} params
   * @param {string} params.targetKind — 'building' or any other value
   * @param {number} params.x — target x coordinate
   * @param {number} params.y — target y coordinate
   * @param {number} [params.w] — building width (only used for buildings)
   * @param {number} [params.h] — building height (only used for buildings)
   * @returns {{ x: number, y: number }|null} center point, or null if params missing
   */
  function targetCenter(params) {
    if (!params || typeof params !== 'object') return null;
    if (params.targetKind === TARGET_KINDS.BUILDING) {
      // (w || 1) and (h || 1) match legacy: 0/null/undefined all default to 1.
      var w = Number.isFinite(params.w) && params.w > 0 ? Number(params.w) : 1;
      var h = Number.isFinite(params.h) && params.h > 0 ? Number(params.h) : 1;
      return {
        x: _safeNum(params.x, 0) + w / 2 - BUILDING_CENTER_OFFSET,
        y: _safeNum(params.y, 0) + h / 2 - BUILDING_CENTER_OFFSET
      };
    }
    return { x: _safeNum(params.x, 0), y: _safeNum(params.y, 0) };
  }

  /**
   * Pure function: compute Manhattan distance from a unit to a building
   * bounding box. Returns 0 if the unit is inside the box.
   *
   * Replaces FE_PATCH_06BDistanceToBuilding in main.js.
   * Uses Math.round on all coordinates before comparison (matching legacy).
   * Building box: [buildingX, buildingX + buildingW - 1] x
   *              [buildingY, buildingY + buildingH - 1]
   *
   * @param {Object} params
   * @param {number} params.unitX — unit x coordinate
   * @param {number} params.unitY — unit y coordinate
   * @param {number} params.buildingX — building x coordinate (left)
   * @param {number} params.buildingY — building y coordinate (top)
   * @param {number} params.buildingW — building width in tiles
   * @param {number} params.buildingH — building height in tiles
   * @returns {number} Manhattan distance to building box, or Infinity if data missing
   */
  function distanceToBuilding(params) {
    if (!params || typeof params !== 'object') return Infinity;
    // Validate all coordinates with Number.isFinite — do NOT use _safeNum
    // because _safeNum(v, NaN) returns (NaN || 0) === 0, masking invalid params.
    var ux = Number(params.unitX);
    var uy = Number(params.unitY);
    var bx = Number(params.buildingX);
    var by = Number(params.buildingY);
    var bw = Number(params.buildingW);
    var bh = Number(params.buildingH);
    if (!Number.isFinite(ux) || !Number.isFinite(uy) ||
        !Number.isFinite(bx) || !Number.isFinite(by) ||
        !Number.isFinite(bw) || !Number.isFinite(bh)) return Infinity;

    ux = Math.round(ux);
    uy = Math.round(uy);
    var left   = Math.round(bx);
    var top    = Math.round(by);
    var right  = Math.round(bx + bw - 1);
    var bottom = Math.round(by + bh - 1);
    var dx = ux < left ? left - ux : (ux > right ? ux - right : 0);
    var dy = uy < top  ? top  - uy : (uy > bottom ? uy - bottom : 0);
    return dx + dy;
  }

  /**
   * Pure predicate: is the entity a dead building?
   *
   * Replaces FE_PATCH_06CIsDeadBuilding in main.js.
   * A building is dead if it is a building AND either
   * destroyed === true OR (hp || 0) <= 0.
   *
   * The (hp || 0) <= 0 pattern must be preserved exactly —
   * it treats null/undefined/0/negative hp as dead.
   *
   * @param {Object} params
   * @param {boolean} params.isBuilding — whether the entity is a building
   * @param {boolean} [params.destroyed] — whether the building is marked destroyed
   * @param {number}  [params.hp] — building HP (may be null/undefined)
   * @returns {boolean}
   */
  function isDeadBuilding(params) {
    if (!params || typeof params !== 'object') return false;
    if (!params.isBuilding) return false;
    return params.destroyed === true || (params.hp || 0) <= 0;
  }

  // ── Target classification/attackability helpers (ARCH-LAB-04C3) ──
  // These pure functions classify targets and determine attackability.
  // main.js wrappers delegate to them when FE_COMBAT_SYSTEM is available,
  // falling back to identical inline logic when not.
  // main.js resolves closure-bound data (isLightTank, unitOwner,
  // buildingOwner, isEnemyBuilding) into plain params before calling.

  /**
   * Pure function: classify what kind of hostile target an entity is.
   *
   * Replaces FE_PATCH_07BGetHostileLightTankTargetKind in main.js.
   * Returns 'unit', 'building', or null.
   *
   * Legacy behavior preserved exactly:
   * 1. if !isLightTank → null
   * 2. if (targetHp || 0) <= 0 → null (target is dead)
   * 3. if attackerOwner === targetOwner → null (same team)
   * 4. if targetKind === 'unit' → 'unit'
   * 5. if targetKind === 'building' → 'building'
   * 6. otherwise → null
   *
   * Owner defaults: (attackerOwner || 'player'), (targetOwner || 'player')
   * match legacy unitOwner/buildingOwner default behavior.
   *
   * @param {Object} params
   * @param {boolean} params.isLightTank — is the attacker a light tank?
   * @param {string}  params.attackerOwner — attacker's resolved owner string
   * @param {string}  params.targetKind — 'unit' or 'building' (or other)
   * @param {string}  params.targetOwner — target's resolved owner string
   * @param {number}  params.targetHp — target's hp (may be null/undefined)
   * @returns {string|null} 'unit', 'building', or null
   */
  function classifyHostileTarget(params) {
    if (!params || typeof params !== 'object') return null;
    if (!params.isLightTank) return null;
    if ((params.targetHp || 0) <= 0) return null;
    var aOwner = String(params.attackerOwner || 'player');
    var tOwner = String(params.targetOwner || 'player');
    if (aOwner === tOwner) return null;
    if (params.targetKind === TARGET_KINDS.UNIT) return TARGET_KINDS.UNIT;
    if (params.targetKind === TARGET_KINDS.BUILDING) return TARGET_KINDS.BUILDING;
    return null;
  }

  /**
   * Pure predicate: is the target an attackable enemy building?
   *
   * Replaces FE_PATCH_06BIsAttackableEnemyBuilding in main.js.
   * Returns true only if the target is a building, is enemy-owned,
   * and has positive HP.
   *
   * Legacy behavior preserved exactly:
   * 1. if !isBuilding → false
   * 2. if !isEnemy → false
   * 3. return (hp || 0) > 0
   *
   * The (hp || 0) > 0 pattern treats null/undefined/0/negative as
   * not attackable, matching legacy.
   *
   * @param {Object} params
   * @param {boolean} params.isBuilding — is the target a building?
   * @param {boolean} params.isEnemy — is the target enemy-owned?
   * @param {number}  params.hp — target's hp (may be null/undefined)
   * @returns {boolean}
   */
  function isAttackableEnemyBuilding(params) {
    if (!params || typeof params !== 'object') return false;
    if (!params.isBuilding) return false;
    if (!params.isEnemy) return false;
    return (params.hp || 0) > 0;
  }

  // ── Range decision helper (ARCH-LAB-04C4) ─────────────────────
  // Pure predicate: is the target within attack range?
  // main.js precomputes targetKind, distance, and range, then passes
  // them as plain params. The module never accesses game state, UNIT_DEFS,
  // DOM, or pathfinding.

  /**
   * Pure predicate: is the target within attack range?
   *
   * Replaces FE_PATCH_08BTargetInRange in main.js.
   * Returns true only if targetKind is valid ('unit' or 'building'),
   * both distance and range are finite numbers, and distance <= range.
   *
   * Legacy behavior preserved exactly:
   * 1. if !params or not object → false
   * 2. if targetKind is not 'unit' or 'building' → false
   * 3. if distance is not finite → false
   * 4. if range is not finite → false
   * 5. return distance <= range
   *
   * IMPORTANT:
   * - Uses <=, not <
   * - Does NOT classify target — caller must provide targetKind
   * - Does NOT compute distance — caller must provide distance
   * - Does NOT read game, FE_CORE, UNIT_DEFS, DOM, canvas, pathfinding
   *
   * @param {Object} params
   * @param {string} params.targetKind — 'unit' or 'building'
   * @param {number} params.distance — precomputed distance to target
   * @param {number} params.range — attacker's attack range
   * @returns {boolean}
   */
  function isTargetInRange(params) {
    if (!params || typeof params !== 'object') return false;
    if (params.targetKind !== TARGET_KINDS.UNIT &&
        params.targetKind !== TARGET_KINDS.BUILDING) return false;
    if (!Number.isFinite(params.distance)) return false;
    if (!Number.isFinite(params.range)) return false;
    return params.distance <= params.range;
  }

  // ── Public API ──────────────────────────────────────────────────

  window.FE_COMBAT_SYSTEM = {
    COMBAT_RESULTS:      COMBAT_RESULTS,
    TARGET_KINDS:        TARGET_KINDS,
    DAMAGE_REASONS:      DAMAGE_REASONS,
    ATTACK_STATES:       ATTACK_STATES,
    BUILDING_CENTER_OFFSET: BUILDING_CENTER_OFFSET,
    createCombatResult:  createCombatResult,
    createDamageResult:  createDamageResult,
    createKillResult:    createKillResult,
    isCombatResult:      isCombatResult,
    isValidCombatResult: isValidCombatResult,
    targetCenter:        targetCenter,
    distanceToBuilding:  distanceToBuilding,
    isDeadBuilding:      isDeadBuilding,
    classifyHostileTarget: classifyHostileTarget,
    isAttackableEnemyBuilding: isAttackableEnemyBuilding,
    isTargetInRange: isTargetInRange
  };
})();
