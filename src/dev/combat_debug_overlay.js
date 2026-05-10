// REF-MAIN-GLM-03 — Combat debug overlay module
// Extracted from src/main.js (FE_LT_04C6* functions)
// This is a dev-only debug overlay — NOT gameplay logic.

window.FE_COMBAT_DEBUG_OVERLAY = (function () {
  'use strict';

  // ----------------------------------------------------------------
  // Flag — toggled by Num9 hotkey in main.js
  // ----------------------------------------------------------------
  let _enabled = false;

  function isEnabled() { return _enabled; }
  function setEnabled(v) { _enabled = !!v; }
  function toggle() { _enabled = !_enabled; return _enabled; }

  // ----------------------------------------------------------------
  // Helpers — pure, no IIFE scope dependencies
  // ----------------------------------------------------------------

  function selectedPlayerLightTanksFrom(selectedTanks, selected, isLightTank, isPlayerUnit) {
    if (selectedTanks && selectedTanks.length > 0) return selectedTanks;
    return selected && isLightTank(selected) && isPlayerUnit(selected) ? [selected] : [];
  }

  function drawRangeDiamond(ctx, tileToScreen, unit, range) {
    const top    = tileToScreen(unit.x, unit.y - range);
    const right  = tileToScreen(unit.x + range, unit.y);
    const bottom = tileToScreen(unit.x, unit.y + range);
    const left   = tileToScreen(unit.x - range, unit.y);

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(top.x, top.y);
    ctx.lineTo(right.x, right.y);
    ctx.lineTo(bottom.x, bottom.y);
    ctx.lineTo(left.x, left.y);
    ctx.closePath();
    ctx.fillStyle   = 'rgba(90, 220, 255, 0.07)';
    ctx.strokeStyle = 'rgba(90, 220, 255, 0.65)';
    ctx.lineWidth   = 1.25;
    ctx.setLineDash([6, 4]);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawAttackMoveMarker(ctx, tileToScreen, target) {
    const p = tileToScreen(target.x, target.y);

    ctx.save();
    ctx.strokeStyle = 'rgba(255, 210, 90, 0.92)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(p.x - 10, p.y);
    ctx.lineTo(p.x + 10, p.y);
    ctx.moveTo(p.x, p.y - 10);
    ctx.lineTo(p.x, p.y + 10);
    ctx.stroke();
    ctx.fillStyle = 'rgba(30, 26, 18, 0.88)';
    ctx.fillRect(p.x + 12, p.y - 10, 124, 16);
    ctx.fillStyle = '#ffd25a';
    ctx.font = '11px Consolas, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('attack-move target', p.x + 16, p.y - 2);
    ctx.restore();
  }

  function drawTargetLine(ctx, tileToScreen, unit, target, targetCenter) {
    const from  = tileToScreen(unit.x, unit.y);
    const center = targetCenter || target;
    const to    = tileToScreen(center.x, center.y);
    const targetType = target && target.kind === 'building' ? 'building' : 'target';

    ctx.save();
    ctx.strokeStyle = 'rgba(255, 110, 110, 0.88)';
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();

    const hp = Math.max(0, Math.round(target.hp || 0)) + '/' + Math.max(0, Math.round(target.maxHp || 0));
    ctx.fillStyle = 'rgba(24, 18, 18, 0.88)';
    ctx.fillRect(to.x + 10, to.y - 10, 112, 16);
    ctx.fillStyle = '#ff9a9a';
    ctx.font = '11px Consolas, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(targetType + ' hp ' + hp, to.x + 14, to.y - 2);
    ctx.restore();
  }

  function drawPanel(ctx, units, attackMoveArmed, resolveAttackTarget) {
    const lines = [
      'selected ' + units.length,
      'attack-move armed ' + (attackMoveArmed ? 'true' : 'false')
    ];

    for (let i = 0; i < Math.min(units.length, 3); i++) {
      const unit = units[i];
      const target = resolveAttackTarget ? resolveAttackTarget(unit) : null;
      const move = unit.attackMoveTarget
        ? Math.round(unit.attackMoveTarget.x) + ',' + Math.round(unit.attackMoveTarget.y)
        : 'none';
      const targetLabel = target
        ? (unit.attackTargetKind || target.kind || 'target') + ':' + target.id
        : 'none';
      lines.push('u' + (i + 1) + ' state ' + (unit.state || 'idle'));
      lines.push('u' + (i + 1) + ' atk ' + targetLabel);
      lines.push('u' + (i + 1) + ' move ' + move);
    }

    const width  = 196;
    const lineH  = 14;
    const height = 10 + lines.length * lineH;

    ctx.save();
    ctx.fillStyle   = 'rgba(18, 20, 28, 0.78)';
    ctx.strokeStyle = 'rgba(90, 220, 255, 0.55)';
    ctx.lineWidth = 1;
    ctx.fillRect(12, 12, width, height);
    ctx.strokeRect(12, 12, width, height);
    ctx.fillStyle = '#d8f6ff';
    ctx.font = '11px Consolas, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], 20, 18 + i * lineH);
    }

    ctx.restore();
  }

  // ----------------------------------------------------------------
  // Main draw function — called from render() in main.js
  // ----------------------------------------------------------------

  /**
   * Draw the combat debug overlay.
   *
   * @param {Object} deps — all IIFE-scope dependencies passed as params
   * @param {CanvasRenderingContext2D} deps.ctx
   * @param {Function} deps.tileToScreen
   * @param {Array}    deps.selectedPlayerLightTanks — pre-computed list
   * @param {Object}   deps.selected — currently selected unit/object
   * @param {boolean}  deps.attackMoveArmed
   * @param {Function} deps.isLightTank
   * @param {Function} deps.isPlayerUnit
   * @param {Function} deps.isEnemyUnit
   * @param {Function} deps.getLightTankCombatStats
   * @param {Function} deps.resolveAttackTarget   — FE_PATCH_06BResolveAttackTarget
   * @param {Function} deps.targetCenter           — FE_PATCH_06BTargetCenter
   * @param {Function} deps.isAttackableEnemyBuilding — FE_PATCH_06BIsAttackableEnemyBuilding
   */
  function drawOverlay(deps) {
    if (!_enabled) return;

    const game = (window.FE_CORE && window.FE_CORE.game) || null;
    if (!game || game.screen !== 'game') return;

    const {
      ctx,
      tileToScreen,
      selectedPlayerLightTanks: tanksFn,
      selected,
      attackMoveArmed,
      isLightTank,
      isPlayerUnit,
      isEnemyUnit,
      getLightTankCombatStats,
      resolveAttackTarget,
      targetCenter,
      isAttackableEnemyBuilding
    } = deps;

    const units = selectedPlayerLightTanksFrom(
      tanksFn ? tanksFn() : [],
      selected,
      isLightTank,
      isPlayerUnit
    );

    drawPanel(ctx, units, attackMoveArmed, resolveAttackTarget);
    if (!units.length) return;

    for (const unit of units) {
      const stats = getLightTankCombatStats(unit);
      const range = Math.max(1, Math.round(stats.range || 1));
      drawRangeDiamond(ctx, tileToScreen, unit, range);

      if (unit.attackMoveTarget) {
        drawAttackMoveMarker(ctx, tileToScreen, unit.attackMoveTarget);
      }

      if (unit.attackTargetId) {
        const target = resolveAttackTarget(unit);
        if (
          (target && unit.attackTargetKind === 'building' && isAttackableEnemyBuilding(target)) ||
          (target && unit.attackTargetKind !== 'building' && isLightTank(target) && isEnemyUnit(target))
        ) {
          drawTargetLine(ctx, tileToScreen, unit, target, targetCenter(target));
        }
      }
    }
  }

  // ----------------------------------------------------------------
  // Public API
  // ----------------------------------------------------------------

  return {
    drawOverlay: drawOverlay,
    isEnabled: isEnabled,
    setEnabled: setEnabled,
    toggle: toggle
  };
})();
