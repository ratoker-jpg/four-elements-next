/**
 * ARCH-AI-01: Tank Decider — Priority Stack decision layer for enemy light_tank.
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
 */
(function () {
  'use strict';

  // ── Rule definitions (evaluated highest-priority-first) ──────────────

  var RULES = [
    { name: 'defend_hq_if_base_threatened',   priority: 100, evaluate: evaluateDefendHq   },
    { name: 'retreat_if_losing_or_overextended', priority: 90, evaluate: evaluateRetreat    },
    { name: 'keep_attacking_valid_current_target', priority: 80, evaluate: evaluateKeepAttacking },
    { name: 'idle_fallback',                    priority: 10, evaluate: evaluateIdle        }
  ];

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
    var isNearHome      = distToHome <= 15;
    var isIdleOrLost    = !hasActiveAttack || tank.state === 'idle' || tank.state === 'moving';

    if (!isNearHome && !isIdleOrLost) return null;

    // Stand-and-fight: if tank is already attacking near home, don't redirect.
    if (hasActiveAttack && isNearHome && tank.state === 'attacking') return null;

    return {
      action:              'defend_hq',
      priority:            100,
      reason:              ctx.threatsNearHome.length + '_player_tanks_near_hq',
      targetId:            primaryThreat.id || null,
      targetX:             primaryThreat.x,
      targetY:             primaryThreat.y,
      ruleName:            'defend_hq_if_base_threatened',
      suppressLegacyOrders: true,
      telemetry:           {}
    };
  }

  /**
   * Priority 90 — retreat_if_losing_or_overextended
   *
   * Conditions (any one is sufficient):
   *   - HP < 25%
   *   - Outnumbered nearby (2+ player tanks within 8 tiles) AND HP < 60%
   *   - Overextended (>20 tiles from home) AND HP < 55%
   *
   * Skip if:
   *   - wave-locked (ATTACK-10)
   *   - stand-and-fight conditions met
   */
  function evaluateRetreat(ctx) {
    var tank     = ctx.tank;
    var homeBase = ctx.homeBase;
    var helpers  = ctx.helpers;

    // Wave-locked tanks do not retreat.
    if (tank._attack10WaveLocked) return null;

    // Stand-and-fight approximation:
    //   If tank has an active attack target, is near home (<=6 tiles),
    //   and target is in or near range, don't retreat.
    if (tank.attackApproachTargetId || tank.attackTargetId) {
      var sTarget = tank.attackTarget || helpers.resolveTarget(tank.attackApproachTargetId || tank.attackTargetId);
      if (sTarget && helpers.isAlive(sTarget)) {
        var sDistHome = helpers.distTiles(tank, homeBase);
        if (sDistHome <= 6) {
          var sStats = helpers.getCombatStats(tank);
          if (sStats) {
            var sTgtDist = helpers.distTiles(tank, sTarget);
            if (sTgtDist <= sStats.range + 2) return null; // stand and fight
          }
        }
      }
    }

    var hpPct = (tank.maxHp > 0) ? (tank.hp / tank.maxHp) : 1;
    var shouldRetreat = false;
    var reason = '';

    // Condition 1: Very low HP.
    if (hpPct < 0.25) {
      shouldRetreat = true;
      reason = 'hp_low_' + Math.round(hpPct * 100) + 'pct';
    }

    // Condition 2: Outnumbered nearby.
    if (!shouldRetreat && ctx.nearbyThreats && ctx.nearbyThreats.length >= 2) {
      var playerNearby = 0;
      for (var ni = 0; ni < ctx.nearbyThreats.length; ni++) {
        if (ctx.nearbyThreats[ni].distance <= 8) playerNearby++;
      }
      if (playerNearby >= 2 && hpPct < 0.6) {
        shouldRetreat = true;
        reason = 'outnumbered_' + playerNearby + 'v1_hp_' + Math.round(hpPct * 100) + 'pct';
      }
    }

    // Condition 3: Overextended.
    if (!shouldRetreat) {
      var distHome = helpers.distTiles(tank, homeBase);
      if (distHome > 20 && hpPct < 0.55) {
        shouldRetreat = true;
        reason = 'overextended_dist_' + distHome + '_hp_' + Math.round(hpPct * 100) + 'pct';
      }
    }

    if (!shouldRetreat) return null;

    return {
      action:              'retreat',
      priority:            90,
      reason:              reason,
      targetId:            null,
      targetX:             homeBase.x,
      targetY:             homeBase.y,
      ruleName:            'retreat_if_losing_or_overextended',
      suppressLegacyOrders: true,
      telemetry:           {}
    };
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

    return {
      action:              'keep_attacking',
      priority:            80,
      reason:              'valid_target_hp_' + (target.hp || 0),
      targetId:            targetId,
      targetX:             null,
      targetY:             null,
      ruleName:            'keep_attacking_valid_current_target',
      suppressLegacyOrders: true,
      telemetry:           {}
    };
  }

  /**
   * Priority 10 — idle_fallback
   *
   * Always matches. Legacy code handles idle behavior (10D1 autopilot).
   */
  function evaluateIdle(ctx) {
    return {
      action:              'idle',
      priority:            10,
      reason:              'no_rule_matched',
      targetId:            null,
      targetX:             null,
      targetY:             null,
      ruleName:            'idle_fallback',
      suppressLegacyOrders: false,
      telemetry:           {}
    };
  }

  // ── Main API ──────────────────────────────────────────────────────────

  /**
   * Evaluate a single tank decision using Priority Stack.
   *
   * @param {Object} context — built in main.js wiring (see Context contract in audit)
   * @returns {Object} decision — { action, priority, reason, targetId, targetX, targetY,
   *                                ruleName, suppressLegacyOrders, telemetry }
   */
  function evaluateTankDecision(context) {
    if (!context || !context.tank) {
      return {
        action: 'idle', priority: 0, reason: 'invalid_context',
        targetId: null, targetX: null, targetY: null,
        ruleName: 'idle_fallback', suppressLegacyOrders: false,
        telemetry: { evaluatedRules: 0 }
      };
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
    return {
      action: 'idle', priority: 0, reason: 'fallback',
      targetId: null, targetX: null, targetY: null,
      ruleName: 'idle_fallback', suppressLegacyOrders: false,
      telemetry: { evaluatedRules: evaluatedRules }
    };
  }

  // ── Browser global ────────────────────────────────────────────────────

  window.FE_TANK_DECIDER = {
    evaluateTankDecision: evaluateTankDecision
  };

})();
