/**
 * ARCH-AI-01 / ARCH-AI-05C1: Tank Decider — Priority Stack decision layer for enemy light_tank.
 *
 * Pure decision logic:
 *   - no side effects
 *   - no direct movement / attack command
 *   - no direct mutation of tank / game / state
 *   - returns one decision object per call
 *
 * Contract:
 *   window.FE_TANK_DECIDER.evaluateTankDecision(context) → result
 *
 * Context is built in main.js wiring (which has IIFE scope access).
 * Execution is performed in main.js through existing helper functions.
 *
 * 05C1 changes:
 *   - Added TANK_DECIDER_ACTIONS, TANK_DECIDER_RULE_NAMES, TANK_DECIDER_CONSTANTS enums
 *   - Added stand_and_fight_near_home rule at priority 95
 *     (action: KEEP_ATTACKING, ruleName: STAND_AND_FIGHT_NEAR_HOME)
 *   - Added createDecisionResult factory for consistent result shapes
 *   - Added isValidDecisionResult / isValidContext validators
 *   - Replaced magic numbers with TANK_DECIDER_CONSTANTS references
 *   - Replaced string literals with enum references
 *   - FE_TANK_DECIDER_ENABLED remains false — no runtime behavior change
 */
(function () {
  'use strict';

  // ── Constants ────────────────────────────────────────────────────────

  /**
   * Action values returned in decision results.
   * No new action for stand_and_fight — it reuses KEEP_ATTACKING
   * and is distinguished by ruleName instead.
   */
  var TANK_DECIDER_ACTIONS = Object.freeze({
    DEFEND_HQ:     'defend_hq',
    KEEP_ATTACKING: 'keep_attacking',
    RETREAT:       'retreat',
    IDLE:          'idle'
  });

  /** Rule names — one per rule in the priority stack. */
  var TANK_DECIDER_RULE_NAMES = Object.freeze({
    DEFEND_HQ_IF_BASE_THREATENED:       'defend_hq_if_base_threatened',
    STAND_AND_FIGHT_NEAR_HOME:          'stand_and_fight_near_home',
    RETREAT_IF_LOSING_OR_OVEREXTENDED:  'retreat_if_losing_or_overextended',
    KEEP_ATTACKING_VALID_CURRENT_TARGET: 'keep_attacking_valid_current_target',
    IDLE_FALLBACK:                      'idle_fallback'
  });

  /**
   * Numeric thresholds — mirrors FE_DEFENSE_RETREAT_01_* constants
   * and retreat/defense magic numbers from main.js.
   */
  var TANK_DECIDER_CONSTANTS = Object.freeze({
    // Stand-and-fight / near-home checks (mirrors FE_DEFENSE_RETREAT_01_NEAR_HOME_RADIUS)
    NEAR_HOME_RADIUS:     6,    // tiles from home to count as "near base" for stand-and-fight
    NEAR_RANGE_MARGIN:    2,    // tiles beyond attack range for "almost in range"

    // Defend-HQ recall eligibility
    DEFEND_HQ_NEAR_HOME: 15,   // tiles from home to consider for HQ defense recall

    // Retreat thresholds
    RETREAT_HP_CRITICAL:       0.25,  // HP% below which tank always retreats
    RETREAT_HP_OUTNUMBERED:    0.6,   // HP% below which outnumbered tank retreats
    RETREAT_HP_OVEREXTENDED:   0.55,  // HP% below which overextended tank retreats

    // Outnumbered detection
    OUTNUMBERED_RADIUS:     8,   // tiles to scan for outnumbering player tanks
    OUTNUMBERED_THRESHOLD:  2,   // player tanks within radius to trigger outnumbered

    // Overextended detection
    OVEREXTENDED_DISTANCE:  20,  // tiles from home to be "overextended"

    // Nearby threats scan radius (used by main.js context builder)
    NEARBY_THREATS_RADIUS: 12   // tiles to scan for nearby player threats
  });

  // ── Rule definitions (evaluated highest-priority-first) ──────────────

  var RULES = [
    { name: TANK_DECIDER_RULE_NAMES.DEFEND_HQ_IF_BASE_THREATENED,       priority: 100, evaluate: evaluateDefendHq },
    { name: TANK_DECIDER_RULE_NAMES.STAND_AND_FIGHT_NEAR_HOME,          priority: 95,  evaluate: evaluateStandAndFight },
    { name: TANK_DECIDER_RULE_NAMES.RETREAT_IF_LOSING_OR_OVEREXTENDED,  priority: 90,  evaluate: evaluateRetreat },
    { name: TANK_DECIDER_RULE_NAMES.KEEP_ATTACKING_VALID_CURRENT_TARGET, priority: 80,  evaluate: evaluateKeepAttacking },
    { name: TANK_DECIDER_RULE_NAMES.IDLE_FALLBACK,                      priority: 10,  evaluate: evaluateIdle }
  ];

  // ── Factory: Decision Result ─────────────────────────────────────────

  /**
   * createDecisionResult(props)
   * Creates a decision result object with the exact shape consumed by
   * main.js execution block. All fields have safe defaults.
   */
  function createDecisionResult(props) {
    var p = props || {};
    return {
      action:              p.action || TANK_DECIDER_ACTIONS.IDLE,
      priority:            typeof p.priority === 'number' ? p.priority : 0,
      reason:              p.reason || '',
      targetId:            p.targetId !== undefined ? p.targetId : null,
      targetX:             p.targetX !== undefined ? p.targetX : null,
      targetY:             p.targetY !== undefined ? p.targetY : null,
      ruleName:            p.ruleName || '',
      suppressLegacyOrders: !!p.suppressLegacyOrders,
      telemetry:           p.telemetry || {}
    };
  }

  // ── Validators ───────────────────────────────────────────────────────

  /**
   * isValidDecisionResult(result)
   * Returns true if result has the correct decision result shape and
   * a known action value. Used for post-hoc validation, not hot-path.
   */
  function isValidDecisionResult(result) {
    if (!result || typeof result !== 'object') return false;
    if (typeof result.action !== 'string') return false;
    if (typeof result.priority !== 'number') return false;
    if (typeof result.ruleName !== 'string') return false;
    if (typeof result.suppressLegacyOrders !== 'boolean') return false;
    var validActions = [
      TANK_DECIDER_ACTIONS.DEFEND_HQ,
      TANK_DECIDER_ACTIONS.KEEP_ATTACKING,
      TANK_DECIDER_ACTIONS.RETREAT,
      TANK_DECIDER_ACTIONS.IDLE
    ];
    if (validActions.indexOf(result.action) === -1) return false;
    return true;
  }

  /**
   * isValidContext(context)
   * Returns true if context has the minimum required shape for
   * evaluateTankDecision. Used for pre-call validation / debugging.
   */
  function isValidContext(context) {
    if (!context || typeof context !== 'object') return false;
    if (!context.tank || typeof context.tank !== 'object') return false;
    if (!context.homeBase || typeof context.homeBase !== 'object') return false;
    if (!context.helpers || typeof context.helpers !== 'object') return false;
    if (typeof context.helpers.isAlive !== 'function') return false;
    if (typeof context.helpers.distTiles !== 'function') return false;
    if (typeof context.helpers.resolveTarget !== 'function') return false;
    if (typeof context.helpers.getCombatStats !== 'function') return false;
    return true;
  }

  // ── Rule implementations ─────────────────────────────────────────────

  /**
   * Priority 100 — defend_hq_if_base_threatened
   *
   * Conditions:
   *   - There are player threats near enemy HQ (threatsNearHome)
   *   - Tank is near home OR has no active attack order
   *   - Tank is not wave-locked (ATTACK-10)
   *   - Bot is not on hq_push (ATTACK-04)
   *   - Tank is not already fighting near home (stand-and-fight)
   */
  function evaluateDefendHq(ctx) {
    if (!ctx.threatsNearHome || ctx.threatsNearHome.length === 0) return null;

    var tank     = ctx.tank;
    var homeBase = ctx.homeBase;
    var botState = ctx.botState;
    var helpers  = ctx.helpers;

    // Wave-locked tanks are on a committed attack wave — do not recall.
    if (tank._attack10WaveLocked) return null;

    // hq_push tanks are attacking player HQ — do not recall for base defense.
    if (botState._attack02HqPush) return null;

    // Find primary threat (closest to HQ).
    var primaryThreat = null;
    var minDist = Infinity;
    for (var i = 0; i < ctx.threatsNearHome.length; i++) {
      var t = ctx.threatsNearHome[i];
      if (!t || !t.unit || !helpers.isAlive(t.unit)) continue;
      if (t.distance < minDist) {
        minDist = t.distance;
        primaryThreat = t.unit;
      }
    }
    if (!primaryThreat) return null;

    // Tank should defend if near home OR idle/lost.
    var distToHome     = helpers.distTiles(tank, homeBase);
    var hasActiveAttack = !!(tank.attackApproachTargetId || tank.attackTargetId);
    var isNearHome      = distToHome <= TANK_DECIDER_CONSTANTS.DEFEND_HQ_NEAR_HOME;
    var isIdleOrLost    = !hasActiveAttack || tank.state === 'idle' || tank.state === 'moving';

    if (!isNearHome && !isIdleOrLost) return null;

    // Stand-and-fight: if tank is already attacking near home, don't redirect.
    if (hasActiveAttack && isNearHome && tank.state === 'attacking') return null;

    return createDecisionResult({
      action:              TANK_DECIDER_ACTIONS.DEFEND_HQ,
      priority:            100,
      reason:              ctx.threatsNearHome.length + '_player_tanks_near_hq',
      targetId:            primaryThreat.id || null,
      targetX:             primaryThreat.x,
      targetY:             primaryThreat.y,
      ruleName:            TANK_DECIDER_RULE_NAMES.DEFEND_HQ_IF_BASE_THREATENED,
      suppressLegacyOrders: true
    });
  }

  /**
   * Priority 95 — stand_and_fight_near_home
   *
   * When a tank is near home and has a valid target in or near range,
   * it should keep fighting instead of being pulled into retreat or
   * reassigned to a different defense target.
   *
   * Returns action KEEP_ATTACKING with ruleName STAND_AND_FIGHT_NEAR_HOME
   * so that main.js execution treats it identically to keep_attacking
   * (mark as managed, suppress legacy overwrite) while telemetry can
   * distinguish this specific case.
   *
   * Conditions:
   *   - Tank has an active attack/approach target
   *   - Target is alive
   *   - Tank is near home (NEAR_HOME_RADIUS tiles)
   *   - Target is in or near range (stats.range + NEAR_RANGE_MARGIN)
   *
   * Note: The existing stand-and-fight early-return in evaluateRetreat
   * (lines ~114-126 pre-05C1) is KEPT as a safety fallback until
   * 05C2/05C3 wiring is ready. This standalone rule provides explicit
   * telemetry and correct priority ordering.
   */
  function evaluateStandAndFight(ctx) {
    var tank     = ctx.tank;
    var homeBase = ctx.homeBase;
    var helpers  = ctx.helpers;

    // Must have an active attack/approach target.
    if (!tank.attackApproachTargetId && !tank.attackTargetId) return null;

    var target = tank.attackTarget || helpers.resolveTarget(tank.attackApproachTargetId || tank.attackTargetId);
    if (!target || !helpers.isAlive(target)) return null;

    // Tank must be near home.
    var distToHome = helpers.distTiles(tank, homeBase);
    if (distToHome > TANK_DECIDER_CONSTANTS.NEAR_HOME_RADIUS) return null;

    // Target must be in or near range.
    var stats = helpers.getCombatStats(tank);
    if (!stats) return null;
    var tgtDist = helpers.distTiles(tank, target);
    if (tgtDist > stats.range + TANK_DECIDER_CONSTANTS.NEAR_RANGE_MARGIN) return null;

    // All conditions met — tank should stand and fight near home.
    return createDecisionResult({
      action:              TANK_DECIDER_ACTIONS.KEEP_ATTACKING,
      priority:            95,
      reason:              'stand_fight_near_home_dist_' + distToHome + '_tgt_range_' + tgtDist,
      targetId:            tank.attackApproachTargetId || tank.attackTargetId,
      targetX:             null,
      targetY:             null,
      ruleName:            TANK_DECIDER_RULE_NAMES.STAND_AND_FIGHT_NEAR_HOME,
      suppressLegacyOrders: true
    });
  }

  /**
   * Priority 90 — retreat_if_losing_or_overextended
   *
   * Conditions (any one is sufficient):
   *   - HP < RETREAT_HP_CRITICAL (25%)
   *   - Outnumbered nearby (OUTNUMBERED_THRESHOLD+ player tanks within OUTNUMBERED_RADIUS tiles)
   *     AND HP < RETREAT_HP_OUTNUMBERED (60%)
   *   - Overextended (>OVEREXTENDED_DISTANCE tiles from home) AND HP < RETREAT_HP_OVEREXTENDED (55%)
   *
   * Skip if:
   *   - wave-locked (ATTACK-10)
   *   - stand-and-fight conditions met (safety fallback guard — retained until 05C2/05C3)
   */
  function evaluateRetreat(ctx) {
    var tank     = ctx.tank;
    var homeBase = ctx.homeBase;
    var helpers  = ctx.helpers;

    // Wave-locked tanks do not retreat.
    if (tank._attack10WaveLocked) return null;

    // Stand-and-fight safety fallback guard:
    //   If tank has an active attack target, is near home,
    //   and target is in or near range, don't retreat.
    //   This guard is retained until 05C2/05C3 wiring is ready,
    //   even though evaluateStandAndFight (priority 95) handles
    //   this case when it fires first. The guard provides defense-
    //   in-depth against any future priority ordering changes.
    if (tank.attackApproachTargetId || tank.attackTargetId) {
      var sTarget = tank.attackTarget || helpers.resolveTarget(tank.attackApproachTargetId || tank.attackTargetId);
      if (sTarget && helpers.isAlive(sTarget)) {
        var sDistHome = helpers.distTiles(tank, homeBase);
        if (sDistHome <= TANK_DECIDER_CONSTANTS.NEAR_HOME_RADIUS) {
          var sStats = helpers.getCombatStats(tank);
          if (sStats) {
            var sTgtDist = helpers.distTiles(tank, sTarget);
            if (sTgtDist <= sStats.range + TANK_DECIDER_CONSTANTS.NEAR_RANGE_MARGIN) return null;
          }
        }
      }
    }

    var hpPct = (tank.maxHp > 0) ? (tank.hp / tank.maxHp) : 1;
    var shouldRetreat = false;
    var reason = '';

    // Condition 1: Very low HP.
    if (hpPct < TANK_DECIDER_CONSTANTS.RETREAT_HP_CRITICAL) {
      shouldRetreat = true;
      reason = 'hp_low_' + Math.round(hpPct * 100) + 'pct';
    }

    // Condition 2: Outnumbered nearby.
    if (!shouldRetreat && ctx.nearbyThreats && ctx.nearbyThreats.length >= TANK_DECIDER_CONSTANTS.OUTNUMBERED_THRESHOLD) {
      var playerNearby = 0;
      for (var ni = 0; ni < ctx.nearbyThreats.length; ni++) {
        if (ctx.nearbyThreats[ni].distance <= TANK_DECIDER_CONSTANTS.OUTNUMBERED_RADIUS) playerNearby++;
      }
      if (playerNearby >= TANK_DECIDER_CONSTANTS.OUTNUMBERED_THRESHOLD && hpPct < TANK_DECIDER_CONSTANTS.RETREAT_HP_OUTNUMBERED) {
        shouldRetreat = true;
        reason = 'outnumbered_' + playerNearby + 'v1_hp_' + Math.round(hpPct * 100) + 'pct';
      }
    }

    // Condition 3: Overextended.
    if (!shouldRetreat) {
      var distHome = helpers.distTiles(tank, homeBase);
      if (distHome > TANK_DECIDER_CONSTANTS.OVEREXTENDED_DISTANCE && hpPct < TANK_DECIDER_CONSTANTS.RETREAT_HP_OVEREXTENDED) {
        shouldRetreat = true;
        reason = 'overextended_dist_' + distHome + '_hp_' + Math.round(hpPct * 100) + 'pct';
      }
    }

    if (!shouldRetreat) return null;

    return createDecisionResult({
      action:              TANK_DECIDER_ACTIONS.RETREAT,
      priority:            90,
      reason:              reason,
      targetId:            null,
      targetX:             homeBase.x,
      targetY:             homeBase.y,
      ruleName:            TANK_DECIDER_RULE_NAMES.RETREAT_IF_LOSING_OR_OVEREXTENDED,
      suppressLegacyOrders: true
    });
  }

  /**
   * Priority 80 — keep_attacking_valid_current_target
   *
   * Conditions:
   *   - Tank has attackApproachTargetId or attackTargetId
   *   - Target is alive
   *   - Tank is in attack_approach or attacking state
   *   - Tank has a path (or is already in attacking range)
   */
  function evaluateKeepAttacking(ctx) {
    var tank    = ctx.tank;
    var helpers = ctx.helpers;

    var targetId = tank.attackApproachTargetId || tank.attackTargetId;
    if (!targetId) return null;

    var target = tank.attackTarget || helpers.resolveTarget(targetId);
    if (!target || !helpers.isAlive(target)) return null;

    var inAttackState = (tank.state === 'attack_approach' || tank.state === 'attacking');
    if (!inAttackState) return null;

    if (!tank.hasPath && tank.state !== 'attacking') return null;

    return createDecisionResult({
      action:              TANK_DECIDER_ACTIONS.KEEP_ATTACKING,
      priority:            80,
      reason:              'valid_target_hp_' + (target.hp || 0),
      targetId:            targetId,
      targetX:             null,
      targetY:             null,
      ruleName:            TANK_DECIDER_RULE_NAMES.KEEP_ATTACKING_VALID_CURRENT_TARGET,
      suppressLegacyOrders: true
    });
  }

  /**
   * Priority 10 — idle_fallback
   *
   * Always matches. Legacy code handles idle behavior (10D1 autopilot).
   */
  function evaluateIdle(ctx) {
    return createDecisionResult({
      action:              TANK_DECIDER_ACTIONS.IDLE,
      priority:            10,
      reason:              'no_rule_matched',
      targetId:            null,
      targetX:             null,
      targetY:             null,
      ruleName:            TANK_DECIDER_RULE_NAMES.IDLE_FALLBACK,
      suppressLegacyOrders: false
    });
  }

  // ── Main API ──────────────────────────────────────────────────────────

  /**
   * Evaluate a single tank decision using Priority Stack.
   *
   * @param {Object} context — built in main.js wiring (see Context contract)
   * @returns {Object} decision — { action, priority, reason, targetId, targetX, targetY,
   *                                ruleName, suppressLegacyOrders, telemetry }
   */
  function evaluateTankDecision(context) {
    if (!context || !context.tank) {
      return createDecisionResult({
        action:   TANK_DECIDER_ACTIONS.IDLE,
        priority: 0,
        reason:   'invalid_context',
        ruleName: TANK_DECIDER_RULE_NAMES.IDLE_FALLBACK,
        telemetry: { evaluatedRules: 0 }
      });
    }

    var evaluatedRules = 0;
    for (var i = 0; i < RULES.length; i++) {
      var rule = RULES[i];
      evaluatedRules++;
      var result = rule.evaluate(context);
      if (result) {
        result.telemetry = result.telemetry || {};
        result.telemetry.evaluatedRules = evaluatedRules;
        return result;
      }
    }

    // Fallback — should not reach here because idle always matches.
    return createDecisionResult({
      action:   TANK_DECIDER_ACTIONS.IDLE,
      priority: 0,
      reason:   'fallback',
      ruleName: TANK_DECIDER_RULE_NAMES.IDLE_FALLBACK,
      telemetry: { evaluatedRules: evaluatedRules }
    });
  }

  // ── Browser global ────────────────────────────────────────────────────

  window.FE_TANK_DECIDER = {
    evaluateTankDecision:  evaluateTankDecision,
    createDecisionResult:  createDecisionResult,
    isValidDecisionResult: isValidDecisionResult,
    isValidContext:        isValidContext,
    TANK_DECIDER_ACTIONS:  TANK_DECIDER_ACTIONS,
    TANK_DECIDER_RULE_NAMES: TANK_DECIDER_RULE_NAMES,
    TANK_DECIDER_CONSTANTS:  TANK_DECIDER_CONSTANTS
  };

})();
