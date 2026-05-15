// Four Elements v0.4 module: command system — pure data API.
// ARCH-LAB-04A: command boundary — first step of command/movement/combat separation.
// Provides window.FE_COMMAND_SYSTEM with command types, factories, and predicates.
// All functions are pure: zero game mutation, zero DOM/canvas access,
// zero pathfinding, zero damage, zero movement execution.
// Command objects are plain serializable data.

(function () {
  'use strict';

  // ── Command type constants ──────────────────────────────────────
  var COMMAND_TYPES = Object.freeze({
    MOVE:            'move',
    ATTACK:          'attack',
    ATTACK_APPROACH: 'attack_approach',
    ATTACK_MOVE:     'attack_move',
    STOP:            'stop',
    HARVEST:         'harvest'
  });

  // Valid type values for quick lookup
  var _validTypes = Object.create(null);
  Object.keys(COMMAND_TYPES).forEach(function (k) {
    _validTypes[COMMAND_TYPES[k]] = true;
  });

  // ── Internal helpers ────────────────────────────────────────────

  /**
   * Defensive array copy: ensures unitIds is a flat array of non-empty strings.
   * Coerces single values into a one-element array.
   * @param {*} ids
   * @returns {string[]}
   */
  function _coerceUnitIds(ids) {
    if (Array.isArray(ids)) {
      return ids.filter(function (id) {
        return id !== null && id !== undefined && id !== '';
      }).map(String);
    }
    if (ids !== null && ids !== undefined && ids !== '') {
      return [String(ids)];
    }
    return [];
  }

  /**
   * Shallow-clone options, defaulting to empty object.
   * Strips undefined values so the command object is cleanly serializable.
   * @param {Object|undefined} opts
   * @returns {Object}
   */
  function _cleanOptions(opts) {
    if (!opts || typeof opts !== 'object') return {};
    var out = {};
    Object.keys(opts).forEach(function (k) {
      if (opts[k] !== undefined) out[k] = opts[k];
    });
    return out;
  }

  // ── Factory functions ───────────────────────────────────────────

  /**
   * Create a move command: order unit(s) to move to a tile position.
   * @param {string|string[]} unitIds — ID(s) of units to move
   * @param {number} targetX — tile X coordinate
   * @param {number} targetY — tile Y coordinate
   * @param {Object} [options] — optional flags: { toast, marker, source }
   * @returns {Object} plain command object
   */
  function createMoveCommand(unitIds, targetX, targetY, options) {
    return {
      type:       COMMAND_TYPES.MOVE,
      unitIds:    _coerceUnitIds(unitIds),
      target:     { x: Number(targetX) || 0, y: Number(targetY) || 0 },
      options:    _cleanOptions(options)
    };
  }

  /**
   * Create an attack command: order unit(s) to attack a specific target.
   * @param {string|string[]} unitIds — ID(s) of attacking units
   * @param {string} targetId — ID of the target (unit or building)
   * @param {string} targetKind — 'unit' or 'building'
   * @param {Object} [options] — optional flags
   * @returns {Object} plain command object
   */
  function createAttackCommand(unitIds, targetId, targetKind, options) {
    return {
      type:       COMMAND_TYPES.ATTACK,
      unitIds:    _coerceUnitIds(unitIds),
      targetId:   String(targetId || ''),
      targetKind: String(targetKind || ''),
      options:    _cleanOptions(options)
    };
  }

  /**
   * Create an attack-approach command: move to attack range, then auto-attack.
   * @param {string|string[]} unitIds — ID(s) of attacking units
   * @param {string} targetId — ID of the approach target
   * @param {string} targetKind — 'unit' or 'building'
   * @param {Object} [options] — optional flags
   * @returns {Object} plain command object
   */
  function createAttackApproachCommand(unitIds, targetId, targetKind, options) {
    return {
      type:       COMMAND_TYPES.ATTACK_APPROACH,
      unitIds:    _coerceUnitIds(unitIds),
      targetId:   String(targetId || ''),
      targetKind: String(targetKind || ''),
      options:    _cleanOptions(options)
    };
  }

  /**
   * Create an attack-move command: move to a position, auto-aggro enemies in range.
   * @param {string|string[]} unitIds — ID(s) of units
   * @param {number} targetX — tile X coordinate
   * @param {number} targetY — tile Y coordinate
   * @param {Object} [options] — optional flags
   * @returns {Object} plain command object
   */
  function createAttackMoveCommand(unitIds, targetX, targetY, options) {
    return {
      type:       COMMAND_TYPES.ATTACK_MOVE,
      unitIds:    _coerceUnitIds(unitIds),
      target:     { x: Number(targetX) || 0, y: Number(targetY) || 0 },
      options:    _cleanOptions(options)
    };
  }

  /**
   * Create a stop command: cancel current order and return to idle.
   * @param {string|string[]} unitIds — ID(s) of units to stop
   * @param {Object} [options] — optional flags
   * @returns {Object} plain command object
   */
  function createStopCommand(unitIds, options) {
    return {
      type:    COMMAND_TYPES.STOP,
      unitIds: _coerceUnitIds(unitIds),
      options: _cleanOptions(options)
    };
  }

  // ── Predicates ──────────────────────────────────────────────────

  /**
   * Type guard: is the value a command object produced by this system?
   * Checks for a valid `type` field matching a known COMMAND_TYPES value.
   * @param {*} value
   * @returns {boolean}
   */
  function isCommand(value) {
    if (!value || typeof value !== 'object') return false;
    var t = value.type;
    return typeof t === 'string' && t in _validTypes;
  }

  /**
   * Get the command type string, or null if not a command.
   * @param {Object} cmd
   * @returns {string|null}
   */
  function commandType(cmd) {
    return isCommand(cmd) ? cmd.type : null;
  }

  /**
   * Structural validation: does the command have all required fields for its type?
   * Returns true if valid, or a descriptive error string if not.
   * @param {Object} cmd
   * @returns {true|string}
   */
  function isValidCommand(cmd) {
    if (!isCommand(cmd)) {
      return 'Not a valid command: missing or invalid type field';
    }
    if (!Array.isArray(cmd.unitIds) || cmd.unitIds.length === 0) {
      return 'Command must have a non-empty unitIds array';
    }
    switch (cmd.type) {
      case COMMAND_TYPES.MOVE:
      case COMMAND_TYPES.ATTACK_MOVE:
        if (!cmd.target || typeof cmd.target.x !== 'number' || typeof cmd.target.y !== 'number') {
          return 'Move/attack-move command must have target {x, y}';
        }
        break;
      case COMMAND_TYPES.ATTACK:
      case COMMAND_TYPES.ATTACK_APPROACH:
        if (!cmd.targetId) {
          return 'Attack/attack-approach command must have targetId';
        }
        if (!cmd.targetKind) {
          return 'Attack/attack-approach command must have targetKind';
        }
        break;
      case COMMAND_TYPES.STOP:
        // No additional required fields
        break;
      case COMMAND_TYPES.HARVEST:
        // Future: will require target resource ID
        break;
      default:
        return 'Unknown command type: ' + cmd.type;
    }
    return true;
  }

  // ── Public API ──────────────────────────────────────────────────

  window.FE_COMMAND_SYSTEM = {
    COMMAND_TYPES:              COMMAND_TYPES,
    createMoveCommand:          createMoveCommand,
    createAttackCommand:        createAttackCommand,
    createAttackApproachCommand:createAttackApproachCommand,
    createAttackMoveCommand:    createAttackMoveCommand,
    createStopCommand:          createStopCommand,
    isCommand:                  isCommand,
    commandType:                commandType,
    isValidCommand:             isValidCommand
  };
})();
