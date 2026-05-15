// FEN-01: Minimal HUD updater.
// Reads game state and updates DOM HUD elements.
// No state mutation — pure read + DOM write.
// Exposed as window.FE_NEXT_HUD.

(function () {
  'use strict';

  /**
   * Format time as M:SS.
   * @param {number} sec
   * @returns {string}
   */
  function formatTime(sec) {
    sec = Math.floor(sec || 0);
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    return m + ':' + String(s).padStart(2, '0');
  }

  /**
   * Update HUD elements from game state.
   * @param {object} state
   */
  function updateHUD(state) {
    // Resources
    var mineralsEl = document.getElementById('hud-minerals');
    var energyEl = document.getElementById('hud-energy');
    var timeEl = document.getElementById('hud-time');

    if (mineralsEl) mineralsEl.textContent = state.resources.minerals;
    if (energyEl) energyEl.textContent = state.resources.energy;
    if (timeEl) timeEl.textContent = formatTime(state.time);

    // Selection info
    var selInfo = document.getElementById('selection-info');
    var selTitle = document.getElementById('sel-title');
    var selType = document.getElementById('sel-type');
    var selPos = document.getElementById('sel-pos');

    if (!selInfo) return;

    var selectedUnit = state.selectedUnitId
      ? window.FE_NEXT_STATE.findUnit(state, state.selectedUnitId)
      : null;

    if (selectedUnit) {
      selInfo.style.display = 'block';
      if (selTitle) selTitle.textContent = selectedUnit.type || 'Unit';
      if (selType) selType.textContent = 'HP: ' + selectedUnit.hp + '/' + selectedUnit.maxHp;
      if (selPos) selPos.textContent = 'Позиция: (' + Math.round(selectedUnit.tx) + ', ' + Math.round(selectedUnit.ty) + ')';
    } else {
      selInfo.style.display = 'none';
    }
  }

  window.FE_NEXT_HUD = {
    updateHUD: updateHUD
  };
})();
