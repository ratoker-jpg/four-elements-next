/**
 * FE_ENEMY_TARGETING — Pure decision module for enemy attack targeting.
 *
 * ARCH-LAB-05B: contract-only + pure decision functions — no main.js changes,
 * no runtime behavior changes. Module is runtime-unwired; 05B2 may wire
 * delegation from FE_ATTACK11ChooseIntelTarget / FE_ATTACK12EvaluateAttackDecision.
 *
 * This module contains:
 *   - Constants mirroring ATTACK-11/12 string values and numeric thresholds
 *   - Factory functions for decision result shapes
 *   - Pure decision functions (chooseIntelTarget, evaluateAttackDecision)
 *   - Structural validators
 *
 * Constraints:
 *   - No game access
 *   - No FE_CORE access
 *   - No DOM / canvas / getContext
 *   - No pathfinding
 *   - No command execution
 *   - No combat execution
 *   - No bot/scout runtime execution
 *   - No production/economy access
 *   - No runtime flags
 *   - No mutation of game objects
 *   - No dependency on tank_decider.js
 *   - No dependency on enemy_intel.js
 */
(function () {
  'use strict';

  // ── Constants ────────────────────────────────────────────────────────

  /** Attack target sources — matches targetSource field values in FE_ATTACK11ChooseIntelTarget */
  var ATTACK_TARGET_SOURCES = Object.freeze({
    CONFIRMED_HQ: 'confirmed_hq',
    ESTIMATED_HQ: 'estimated_hq'
  });

  /** Attack decision results — matches decision field values in FE_ATTACK12EvaluateAttackDecision */
  var ATTACK_DECISION_RESULTS = Object.freeze({
    ALLOW: 'allow',
    DELAY: 'delay'
  });

  /** Attack delay reasons — matches reason field values in FE_ATTACK12EvaluateAttackDecision */
  var ATTACK_DELAY_REASONS = Object.freeze({
    NO_INTEL:          'delay_no_intel',
    STALE_INTEL:       'delay_stale_intel',
    TOO_FEW_TANKS:     'delay_too_few_tanks',
    ENEMY_OUTNUMBERED: 'delay_enemy_outnumbered',
    FAVORABLE_INTEL:   'allow_favorable_intel'
  });

  /** ATTACK-12 default thresholds — mirrors FE_ATTACK12_* constants in main.js */
  var ATTACK12_DEFAULTS = Object.freeze({
    MAX_INTEL_AGE_SEC: 180,
    MIN_ATTACK_TANKS: 2,
    FORCE_ADVANTAGE: 1
  });

  // ── Factory: Attack Target Result ────────────────────────────────────

  /**
   * createAttackTargetResult(props)
   * Creates an ATTACK-11 result object with the exact shape from
   * FE_ATTACK11ChooseIntelTarget. All fields have safe defaults.
   */
  function createAttackTargetResult(props) {
    var p = props || {};
    return {
      targetX:                 p.targetX !== undefined ? p.targetX : null,
      targetY:                 p.targetY !== undefined ? p.targetY : null,
      targetSource:            p.targetSource || '',
      targetReason:            p.targetReason || '',
      intelFreshnessSec:       typeof p.intelFreshnessSec === 'number' ? p.intelFreshnessSec : -1,
      playerHqSeen:            !!p.playerHqSeen,
      playerHqEstimateAvailable: !!p.playerHqEstimateAvailable
    };
  }

  // ── Factory: Attack Decision Result ──────────────────────────────────

  /**
   * createAttackDecisionResult(props)
   * Creates an ATTACK-12 result object with the exact shape from
   * FE_ATTACK12EvaluateAttackDecision. full ATTACK-12 result shape, no fields invented
   * or omitted, no defaults changed.
   */
  function createAttackDecisionResult(props) {
    var p = props || {};
    return {
      attackAllowed:                   !!p.attackAllowed,
      decision:                        p.decision || ATTACK_DECISION_RESULTS.DELAY,
      reason:                          p.reason || '',
      readyEnemyTanks:                 typeof p.readyEnemyTanks === 'number' ? p.readyEnemyTanks : 0,
      assignableEnemyTanks:            typeof p.assignableEnemyTanks === 'number' ? p.assignableEnemyTanks : 0,
      skippedAssignedAttackTargetCount: typeof p.skippedAssignedAttackTargetCount === 'number' ? p.skippedAssignedAttackTargetCount : 0,
      skippedAttackApproachCount:      typeof p.skippedAttackApproachCount === 'number' ? p.skippedAttackApproachCount : 0,
      knownPlayerLightTanks:           typeof p.knownPlayerLightTanks === 'number' ? p.knownPlayerLightTanks : 0,
      knownPlayerHarvesters:           typeof p.knownPlayerHarvesters === 'number' ? p.knownPlayerHarvesters : 0,
      playerHqSeen:                    !!p.playerHqSeen,
      playerHqEstimateAvailable:       !!p.playerHqEstimateAvailable,
      hqIntelAvailable:                !!p.hqIntelAvailable,
      forceIntelKnown:                 !!p.forceIntelKnown,
      forceIntelFresh:                 !!p.forceIntelFresh,
      forceIntelAgeSec:                typeof p.forceIntelAgeSec === 'number' ? p.forceIntelAgeSec : -1,
      intelFreshnessSec:               typeof p.intelFreshnessSec === 'number' ? p.intelFreshnessSec : -1,
      lastUsefulIntelAt:               typeof p.lastUsefulIntelAt === 'number' ? p.lastUsefulIntelAt : 0,
      lastScoutSweepDoneAt:            typeof p.lastScoutSweepDoneAt === 'number' ? p.lastScoutSweepDoneAt : 0,
      requiredTanks:                   typeof p.requiredTanks === 'number' ? p.requiredTanks : ATTACK12_DEFAULTS.MIN_ATTACK_TANKS,
      forceAdvantageRequired:          typeof p.forceAdvantageRequired === 'number' ? p.forceAdvantageRequired : ATTACK12_DEFAULTS.FORCE_ADVANTAGE,
      attack11DispatchSource:          p.attack11DispatchSource || '',
      gateApplied:                     p.gateApplied !== undefined ? !!p.gateApplied : true,
      skippedBecauseActiveAttack:      !!p.skippedBecauseActiveAttack
    };
  }

  // ── Pure Decision: chooseIntelTarget ─────────────────────────────────

  /**
   * chooseIntelTarget(intel, now)
   *
   * Mirrors FE_ATTACK11ChooseIntelTarget() from main.js exactly.
   * Pure function — accepts intel object and timestamp as explicit params.
   *
   * @param {Object|null} intel  — game.enemyIntel object (or null/undefined)
   * @param {number}      now    — current game time in seconds
   * @returns {Object|null} — {targetX, targetY, targetSource, targetReason,
   *                            intelFreshnessSec, playerHqSeen,
   *                            playerHqEstimateAvailable} or null
   */
  function chooseIntelTarget(intel, now) {
    if (!intel) return null;

    // Priority 1: Confirmed player HQ from scout visual.
    if (intel.playerHqSeen === true
        && Number.isFinite(intel.playerHqCenterX)
        && Number.isFinite(intel.playerHqCenterY)) {
      return {
        targetX: intel.playerHqCenterX,
        targetY: intel.playerHqCenterY,
        targetSource: 'confirmed_hq',
        targetReason: 'scout_confirmed_player_hq',
        intelFreshnessSec: intel.lastUsefulIntelAt > 0 ? (now - intel.lastUsefulIntelAt) : -1,
        playerHqSeen: true,
        playerHqEstimateAvailable: !!(intel.playerHqEstimateCenterX != null)
      };
    }

    // Priority 2: Estimated player HQ from scout target metadata.
    if (intel.playerHqEstimateCenterX != null
        && intel.playerHqEstimateCenterY != null) {
      return {
        targetX: intel.playerHqEstimateCenterX,
        targetY: intel.playerHqEstimateCenterY,
        targetSource: 'estimated_hq',
        targetReason: 'scout_estimate_player_hq',
        intelFreshnessSec: intel.lastPlayerHqEstimateAt > 0 ? (now - intel.lastPlayerHqEstimateAt) : -1,
        playerHqSeen: false,
        playerHqEstimateAvailable: true
      };
    }

    return null;
  }

  // ── Pure Decision: evaluateAttackDecision ────────────────────────────

  /**
   * evaluateAttackDecision(intel, tankStatuses, now, options)
   *
   * Mirrors FE_ATTACK12EvaluateAttackDecision(enemyTanks, now) from main.js exactly.
   * Pure function — all inputs are explicit parameters.
   *
   * @param {Object|null} intel          — game.enemyIntel object (or null/undefined)
   * @param {Array}       tankStatuses   — pre-computed array of tank status objects:
   *   { isAlive: bool, isIntelRally: bool, isWaveLocked: bool,
   *     hasAttackTargetId: bool, hasAttackApproachTargetId: bool }
   *   Caller will pre-compute these from enemyTanks in 05B2 wiring.
   * @param {number}      now            — current game time in seconds
   * @param {Object}      options        — {
   *   attack11DispatchSource: string,
   *   maxIntelAgeSec: number,
   *   minAttackTanks: number,
   *   forceAdvantage: number
   * }
   * @returns {Object} — full ATTACK-12 result shape matching FE_ATTACK12EvaluateAttackDecision return
   */
  function evaluateAttackDecision(intel, tankStatuses, now, options) {
    var opts = options || {};
    var _maxAge = typeof opts.maxIntelAgeSec === 'number' ? opts.maxIntelAgeSec : ATTACK12_DEFAULTS.MAX_INTEL_AGE_SEC;
    var _minTanks = typeof opts.minAttackTanks === 'number' ? opts.minAttackTanks : ATTACK12_DEFAULTS.MIN_ATTACK_TANKS;
    var _forceAdv = typeof opts.forceAdvantage === 'number' ? opts.forceAdvantage : ATTACK12_DEFAULTS.FORCE_ADVANTAGE;
    var _attack11Ds = opts.attack11DispatchSource || '';

    // Count ready enemy tanks: alive, not wave-locked, not on intel rally.
    // BOT-ATTACK-12A: also count assignable (subset without active attack orders).
    var _a12Ready = 0;
    var _a12Assignable = 0;
    var _a12SkipAssignedAttackTarget = 0;
    var _a12SkipAttackApproach = 0;
    for (var _a12i = 0; _a12i < (tankStatuses || []).length; _a12i++) {
      var _a12s = tankStatuses[_a12i];
      if (!_a12s || !_a12s.isAlive) continue;
      if (_a12s.isIntelRally) continue;
      if (_a12s.isWaveLocked) continue;
      _a12Ready++;
      // BOT-ATTACK-12A: assignable subset — tanks actually eligible for new dispatch.
      if (_a12s.hasAttackTargetId) { _a12SkipAssignedAttackTarget++; }
      else if (_a12s.hasAttackApproachTargetId) { _a12SkipAttackApproach++; }
      else { _a12Assignable++; }
    }

    // HQ position intel: confirmed or estimated.
    var _a12HqAvailable = !!(intel && (intel.playerHqSeen || intel.playerHqEstimateCenterX != null));
    var _a12PlayerHqSeen = !!(intel && intel.playerHqSeen);
    var _a12HqEstimateAvailable = !!(intel && intel.playerHqEstimateCenterX != null);

    // Force intel: needs to be fresh (age <= MAX_AGE).
    var _a12LastUsefulAt = intel ? (intel.lastUsefulIntelAt || 0) : 0;
    var _a12LastSweepAt = intel ? (intel.lastScoutSweepDoneAt || 0) : 0;
    var _a12ForceKnown = _a12LastUsefulAt > 0 || _a12LastSweepAt > 0;
    var _a12ForceAge1 = _a12LastUsefulAt > 0 ? (now - _a12LastUsefulAt) : Infinity;
    var _a12ForceAge2 = _a12LastSweepAt > 0 ? (now - _a12LastSweepAt) : Infinity;
    var _a12ForceAgeSec = _a12ForceKnown ? Math.min(_a12ForceAge1, _a12ForceAge2) : -1;
    var _a12ForceFresh = _a12ForceKnown && _a12ForceAgeSec <= _maxAge;

    var _a12IntelFreshness = _a12LastUsefulAt > 0 ? (now - _a12LastUsefulAt) : -1;
    var _a12KnownPlayerLT = (intel && intel.knownPlayerUnitsByType) ? (intel.knownPlayerUnitsByType.light_tank || 0) : 0;
    var _a12KnownPlayerHv = (intel && intel.knownPlayerUnitsByType) ? (intel.knownPlayerUnitsByType.harvester || 0) : 0;

    // Decision logic (ordered checks).
    var _a12Allowed = false;
    var _a12Decision = 'delay';
    var _a12Reason = '';

    if (!_a12HqAvailable) {
      _a12Reason = 'delay_no_intel';
    } else if (!_a12ForceKnown || !_a12ForceFresh) {
      _a12Reason = 'delay_stale_intel';
    } else if (_a12Assignable < _minTanks) {
      _a12Reason = 'delay_too_few_tanks';
    } else if (_a12KnownPlayerLT > 0 && _a12Assignable < _a12KnownPlayerLT + _forceAdv) {
      _a12Reason = 'delay_enemy_outnumbered';
    } else {
      _a12Allowed = true;
      _a12Decision = 'allow';
      _a12Reason = 'allow_favorable_intel';
    }

    return {
      attackAllowed: _a12Allowed,
      decision: _a12Decision,
      reason: _a12Reason,
      readyEnemyTanks: _a12Ready,
      assignableEnemyTanks: _a12Assignable,
      skippedAssignedAttackTargetCount: _a12SkipAssignedAttackTarget,
      skippedAttackApproachCount: _a12SkipAttackApproach,
      knownPlayerLightTanks: _a12KnownPlayerLT,
      knownPlayerHarvesters: _a12KnownPlayerHv,
      playerHqSeen: _a12PlayerHqSeen,
      playerHqEstimateAvailable: _a12HqEstimateAvailable,
      hqIntelAvailable: _a12HqAvailable,
      forceIntelKnown: _a12ForceKnown,
      forceIntelFresh: _a12ForceFresh,
      forceIntelAgeSec: _a12ForceAgeSec,
      intelFreshnessSec: _a12IntelFreshness,
      lastUsefulIntelAt: _a12LastUsefulAt,
      lastScoutSweepDoneAt: _a12LastSweepAt,
      requiredTanks: _minTanks,
      forceAdvantageRequired: _forceAdv,
      attack11DispatchSource: _attack11Ds,
      gateApplied: true,
      skippedBecauseActiveAttack: false
    };
  }

  // ── Validators ────────────────────────────────────────────────────────

  /**
   * isValidAttackTargetResult(obj)
   * Structural validation only. Returns true or a descriptive string error.
   */
  function isValidAttackTargetResult(obj) {
    if (!obj || typeof obj !== 'object') return 'attackTargetResult must be an object';
    if (obj.targetX !== null && typeof obj.targetX !== 'number') return 'attackTargetResult.targetX must be null or number';
    if (obj.targetY !== null && typeof obj.targetY !== 'number') return 'attackTargetResult.targetY must be null or number';
    if (typeof obj.targetSource !== 'string') return 'attackTargetResult.targetSource must be a string';
    if (typeof obj.targetReason !== 'string') return 'attackTargetResult.targetReason must be a string';
    if (typeof obj.intelFreshnessSec !== 'number') return 'attackTargetResult.intelFreshnessSec must be a number';
    if (typeof obj.playerHqSeen !== 'boolean') return 'attackTargetResult.playerHqSeen must be a boolean';
    if (typeof obj.playerHqEstimateAvailable !== 'boolean') return 'attackTargetResult.playerHqEstimateAvailable must be a boolean';
    return true;
  }

  /**
   * isValidAttackDecisionResult(obj)
   * Structural validation only. Returns true or a descriptive string error.
   */
  function isValidAttackDecisionResult(obj) {
    if (!obj || typeof obj !== 'object') return 'attackDecisionResult must be an object';
    if (typeof obj.attackAllowed !== 'boolean') return 'attackDecisionResult.attackAllowed must be a boolean';
    if (typeof obj.decision !== 'string') return 'attackDecisionResult.decision must be a string';
    if (typeof obj.reason !== 'string') return 'attackDecisionResult.reason must be a string';
    if (typeof obj.readyEnemyTanks !== 'number') return 'attackDecisionResult.readyEnemyTanks must be a number';
    if (typeof obj.assignableEnemyTanks !== 'number') return 'attackDecisionResult.assignableEnemyTanks must be a number';
    if (typeof obj.skippedAssignedAttackTargetCount !== 'number') return 'attackDecisionResult.skippedAssignedAttackTargetCount must be a number';
    if (typeof obj.skippedAttackApproachCount !== 'number') return 'attackDecisionResult.skippedAttackApproachCount must be a number';
    if (typeof obj.knownPlayerLightTanks !== 'number') return 'attackDecisionResult.knownPlayerLightTanks must be a number';
    if (typeof obj.knownPlayerHarvesters !== 'number') return 'attackDecisionResult.knownPlayerHarvesters must be a number';
    if (typeof obj.playerHqSeen !== 'boolean') return 'attackDecisionResult.playerHqSeen must be a boolean';
    if (typeof obj.playerHqEstimateAvailable !== 'boolean') return 'attackDecisionResult.playerHqEstimateAvailable must be a boolean';
    if (typeof obj.hqIntelAvailable !== 'boolean') return 'attackDecisionResult.hqIntelAvailable must be a boolean';
    if (typeof obj.forceIntelKnown !== 'boolean') return 'attackDecisionResult.forceIntelKnown must be a boolean';
    if (typeof obj.forceIntelFresh !== 'boolean') return 'attackDecisionResult.forceIntelFresh must be a boolean';
    if (typeof obj.forceIntelAgeSec !== 'number') return 'attackDecisionResult.forceIntelAgeSec must be a number';
    if (typeof obj.intelFreshnessSec !== 'number') return 'attackDecisionResult.intelFreshnessSec must be a number';
    if (typeof obj.lastUsefulIntelAt !== 'number') return 'attackDecisionResult.lastUsefulIntelAt must be a number';
    if (typeof obj.lastScoutSweepDoneAt !== 'number') return 'attackDecisionResult.lastScoutSweepDoneAt must be a number';
    if (typeof obj.requiredTanks !== 'number') return 'attackDecisionResult.requiredTanks must be a number';
    if (typeof obj.forceAdvantageRequired !== 'number') return 'attackDecisionResult.forceAdvantageRequired must be a number';
    if (typeof obj.attack11DispatchSource !== 'string') return 'attackDecisionResult.attack11DispatchSource must be a string';
    if (typeof obj.gateApplied !== 'boolean') return 'attackDecisionResult.gateApplied must be a boolean';
    if (typeof obj.skippedBecauseActiveAttack !== 'boolean') return 'attackDecisionResult.skippedBecauseActiveAttack must be a boolean';
    return true;
  }

  // ── Public API ────────────────────────────────────────────────────────

  window.FE_ENEMY_TARGETING = {
    ATTACK_TARGET_SOURCES:    ATTACK_TARGET_SOURCES,
    ATTACK_DECISION_RESULTS:  ATTACK_DECISION_RESULTS,
    ATTACK_DELAY_REASONS:     ATTACK_DELAY_REASONS,
    ATTACK12_DEFAULTS:        ATTACK12_DEFAULTS,
    createAttackTargetResult:  createAttackTargetResult,
    createAttackDecisionResult: createAttackDecisionResult,
    chooseIntelTarget:        chooseIntelTarget,
    evaluateAttackDecision:   evaluateAttackDecision,
    isValidAttackTargetResult:  isValidAttackTargetResult,
    isValidAttackDecisionResult: isValidAttackDecisionResult
  };
})();
