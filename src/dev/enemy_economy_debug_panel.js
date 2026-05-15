// REF-MAIN-GLM-04 — Enemy economy debug panel module
// Extracted from src/main.js (FE_DEBUG_EnemyEconomy* functions)
// This is a dev-only read-only observer — NOT gameplay logic.
// Must not create resources, buildings, units or commands.

window.FE_ENEMY_ECONOMY_DEBUG_PANEL = (function () {
  'use strict';

  // ----------------------------------------------------------------
  // Internal state (previously IIFE-scoped vars in main.js)
  // ----------------------------------------------------------------
  let _visible = false;
  let _panelEl = null;
  let _lastUpdate = 0;

  // Deps stored at init() time — IIFE-scope functions from main.js
  let _deps = null;

  // ----------------------------------------------------------------
  // Pure helpers — no IIFE scope dependencies
  // ----------------------------------------------------------------

  function safeNumber(value, fallback) {
    if (fallback === undefined) fallback = 0;
    var n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function htmlEscape(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  // ----------------------------------------------------------------
  // Panel DOM management — no IIFE scope dependencies
  // ----------------------------------------------------------------

  function isAllowed() {
    return window.FE_DEBUG_ENEMY_ECONOMY_PANEL_ENABLED !== false;
  }

  function ensurePanel() {
    if (_panelEl && document.body.contains(_panelEl)) {
      return _panelEl;
    }

    var el = document.createElement('div');
    el.id = 'fe-debug-enemy-economy-panel';
    el.style.position = 'fixed';
    el.style.right = '14px';
    el.style.top = '78px';
    el.style.zIndex = '9999';
    el.style.maxWidth = '360px';
    el.style.minWidth = '280px';
    el.style.padding = '10px 12px';
    el.style.borderRadius = '12px';
    el.style.background = 'rgba(20, 18, 32, 0.88)';
    el.style.border = '1px solid rgba(190, 150, 255, 0.45)';
    el.style.boxShadow = '0 8px 24px rgba(0,0,0,0.35)';
    el.style.color = '#f4edff';
    el.style.font = '12px/1.35 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    el.style.pointerEvents = 'none';
    el.style.whiteSpace = 'normal';
    el.style.display = 'none';

    document.body.appendChild(el);
    _panelEl = el;
    return el;
  }

  // ----------------------------------------------------------------
  // Data collection — uses _deps for IIFE-scope functions
  // ----------------------------------------------------------------

  function readBucket(game) {
    var bucket = (game && game.enemyResources && typeof game.enemyResources === 'object')
      ? game.enemyResources
      : {};
    return {
      minerals: safeNumber(bucket.minerals, 0),
      energy: Number.isFinite(Number(bucket.energy)) ? Number(bucket.energy) : null,
      purple: Number.isFinite(Number(bucket.purple)) ? Number(bucket.purple) : null,
      greenEl: Number.isFinite(Number(bucket.greenEl)) ? Number(bucket.greenEl) : null,
      cyanEl: Number.isFinite(Number(bucket.cyanEl)) ? Number(bucket.cyanEl) : null,
      yellowEl: Number.isFinite(Number(bucket.yellowEl)) ? Number(bucket.yellowEl) : null,
    };
  }

  function unitOwnerOf(unit) {
    try {
      return (_deps && typeof _deps.unitOwner === 'function')
        ? _deps.unitOwner(unit)
        : (unit?.owner || unit?.team || 'player');
    } catch (_) {
      return unit?.owner || unit?.team || 'player';
    }
  }

  function buildingOwnerOf(building) {
    try {
      return (_deps && typeof _deps.buildingOwner === 'function')
        ? _deps.buildingOwner(building)
        : (building?.owner || building?.team || 'player');
    } catch (_) {
      return building?.owner || building?.team || 'player';
    }
  }

  function collectState(game) {
    var bucket = readBucket(game);
    var limits = (_deps && typeof _deps.getStorageLimitsForOwner === 'function')
      ? _deps.getStorageLimitsForOwner('enemy')
      : {};
    var enemyHq = (_deps && typeof _deps.findBaseBuilding === 'function')
      ? _deps.findBaseBuilding('enemy')
      : null;

    var enemyUnits = (game?.units || []).filter(function (u) {
      return unitOwnerOf(u) === 'enemy' && (u.hp ?? 1) > 0;
    });
    var enemyHarvesters = enemyUnits.filter(function (u) { return u.type === 'harvester'; });
    var enemyBuilders = enemyUnits.filter(function (u) { return u.type === 'builder'; });
    var enemyTanks = (_deps && typeof _deps.FE_PATCH_08BEnemyCombatUnits === 'function')
      ? _deps.FE_PATCH_08BEnemyCombatUnits()
      : enemyUnits.filter(function (u) { return u.type === 'light_tank'; });

    var enemyBuildings = (game?.buildings || []).filter(function (b) {
      return buildingOwnerOf(b) === 'enemy' && !b.destroyed && !b.dead;
    });
    var buildingCounts = {};
    for (var i = 0; i < enemyBuildings.length; i++) {
      var key = enemyBuildings[i]?.type || 'unknown';
      buildingCounts[key] = (buildingCounts[key] || 0) + 1;
    }

    var botState = game?._enemyBotState || null;
    var enemyKnowledge = (_deps && typeof _deps.FE_PATCH_10BEnemyKnowledgeDebugSummary === 'function')
      ? _deps.FE_PATCH_10BEnemyKnowledgeDebugSummary()
      : null;

    return {
      bucket: bucket,
      limits: limits,
      enemyHq: enemyHq,
      enemyHarvesters: enemyHarvesters,
      enemyBuilders: enemyBuilders,
      enemyTanks: enemyTanks,
      buildingCounts: buildingCounts,
      botState: botState,
      enemyKnowledge: enemyKnowledge,
    };
  }

  // ----------------------------------------------------------------
  // Formatting — pure, uses own helpers only
  // ----------------------------------------------------------------

  function formatHarvester(u) {
    var id = htmlEscape(u?.id ?? '?');
    var state = htmlEscape(u?.state || 'idle');
    var cargo = safeNumber(u?.cargo, 0);
    var cap = safeNumber(u?.capacity ?? u?.cargoCap ?? u?.maxCargo, 0);
    var pathLen = Array.isArray(u?.path) ? u.path.length : 0;
    var target = u?.targetId || u?.targetMineId || u?.mineId || u?.target || '';
    var timer = Number.isFinite(Number(u?.actionTimer)) ? Number(u.actionTimer).toFixed(1) : '\u2014';
    return '<div>\u2022 #' + id + ': ' + state + ', cargo ' + cargo +
      (cap ? '/' + cap : '') +
      ', path ' + pathLen +
      ', timer ' + timer +
      (target ? ', target ' + htmlEscape(target) : '') +
      '</div>';
  }

  // ----------------------------------------------------------------
  // Render panel — main entry point
  // ----------------------------------------------------------------

  function renderPanel(force) {
    var el = ensurePanel();

    var game = (window.FE_CORE && window.FE_CORE.game) || null;
    if (!isAllowed() || !_visible || game?.screen !== 'game') {
      el.style.display = 'none';
      return;
    }

    var now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    if (!force && now - _lastUpdate < 220) return;
    _lastUpdate = now;

    var st = collectState(game);
    var mineralsCap = safeNumber(st.limits?.minerals, 0);
    var energyCap = safeNumber(st.limits?.energy, 0);
    var purpleCap = safeNumber(st.limits?.purple, 0);
    var hqHp = st.enemyHq
      ? (Math.max(0, Math.round(safeNumber(st.enemyHq.hp, 0))) + '/' + Math.max(0, Math.round(safeNumber(st.enemyHq.maxHp, st.enemyHq.hp || 0))))
      : 'missing';

    var bLines = Object.keys(st.buildingCounts).sort()
      .map(function (k) {
        return '<span style="display:inline-block;margin:0 8px 3px 0;">' + htmlEscape(k) + ': ' + st.buildingCounts[k] + '</span>';
      })
      .join('') || '<span style="opacity:.65;">none</span>';

    var harvesterLines = st.enemyHarvesters.slice(0, 6).map(formatHarvester).join('')
      || '<div style="opacity:.65;">none</div>';
    var extraHarvesters = st.enemyHarvesters.length > 6
      ? '<div style="opacity:.65;">\u2026 +' + (st.enemyHarvesters.length - 6) + ' more</div>'
      : '';

    var botPhase = st.botState?.phase || st.botState?.state || 'n/a';

    var energyText = st.bucket.energy === null
      ? 'not implemented'
      : (Math.round(st.bucket.energy) + (energyCap ? '/' + energyCap : ''));
    var purpleText = st.bucket.purple === null
      ? 'not implemented'
      : (Math.round(st.bucket.purple) + (purpleCap ? '/' + purpleCap : ''));

    var knowledgeText = st.enemyKnowledge
      ? ('visible U/B ' + st.enemyKnowledge.visibleUnits + '/' + st.enemyKnowledge.visibleBuildings +
         ', known U/B ' + st.enemyKnowledge.knownUnits + '/' + st.enemyKnowledge.knownBuildings)
      : 'not implemented';
    var knowledgeTopText = st.enemyKnowledge?.top || 'none';

    // Debug text functions — read from _deps, called only if available
    var separatorText = (_deps && typeof _deps.FE_PATCH_09C3EnemySeparatorDebugText === 'function')
      ? _deps.FE_PATCH_09C3EnemySeparatorDebugText() : 'not implemented yet';
    var factoryText = (_deps && typeof _deps.FE_PATCH_09DEnemyFactoryDebugText === 'function')
      ? _deps.FE_PATCH_09DEnemyFactoryDebugText() : 'not implemented yet';
    var factoryQueueText = (_deps && typeof _deps.FE_PATCH_09EEnemyFactoryQueueDebugText === 'function')
      ? _deps.FE_PATCH_09EEnemyFactoryQueueDebugText() : 'not implemented yet';
    var buildOrderText = (_deps && typeof _deps.FE_PATCH_09DEnemyBuildOrderDebugText === 'function')
      ? _deps.FE_PATCH_09DEnemyBuildOrderDebugText() : 'not implemented yet';
    var blockedReasonText = (_deps && typeof _deps.FE_PATCH_09EEnemyFactoryBlockedReasonDebugText === 'function')
      ? _deps.FE_PATCH_09EEnemyFactoryBlockedReasonDebugText() : 'not implemented yet';

    el.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:6px;">' +
        '<strong style="font-size:13px;color:#fff;">Enemy economy debug</strong>' +
        '<span style="opacity:.7;">F2</span>' +
      '</div>' +
      '<div style="margin-bottom:6px;">' +
        '<div>HQ: <b>' + htmlEscape(hqHp) + '</b></div>' +
        '<div>Bot phase: <b>' + htmlEscape(botPhase) + '</b></div>' +
        '<div>Units: harvesters <b>' + st.enemyHarvesters.length + '</b>, builders <b>' + st.enemyBuilders.length + '</b>, tanks <b>' + st.enemyTanks.length + '</b></div>' +
      '</div>' +
      '<div style="margin:6px 0;padding-top:6px;border-top:1px solid rgba(255,255,255,.14);">' +
        '<div>Raw minerals: <b>' + Math.round(st.bucket.minerals) + (mineralsCap ? '/' + mineralsCap : '') + '</b></div>' +
        '<div>Energy: <b>' + htmlEscape(energyText) + '</b></div>' +
        '<div>Purple element: <b>' + htmlEscape(purpleText) + '</b></div>' +
      '</div>' +
      '<div style="margin:6px 0;padding-top:6px;border-top:1px solid rgba(255,255,255,.14);">' +
        '<div style="margin-bottom:3px;color:#d9c5ff;">Harvesters</div>' +
        harvesterLines + extraHarvesters +
      '</div>' +
      '<div style="margin:6px 0;padding-top:6px;border-top:1px solid rgba(255,255,255,.14);">' +
        '<div style="margin-bottom:3px;color:#d9c5ff;">Buildings</div>' +
        '<div>' + bLines + '</div>' +
      '</div>' +
      '<div style="margin-top:6px;padding-top:6px;border-top:1px solid rgba(255,255,255,.14);opacity:.75;">' +
        'Separator: <b>' + htmlEscape(separatorText) + '</b><br>' +
        'Factory: <b>' + htmlEscape(factoryText) + '</b><br>' +
        'Factory queue: <b>' + htmlEscape(factoryQueueText) + '</b><br>' +
        'Build order: <b>' + htmlEscape(buildOrderText) + '</b><br>' +
        'Blocked reason: <b>' + htmlEscape(blockedReasonText) + '</b><br>' +
        'Knowledge: <b>' + htmlEscape(knowledgeText) + '</b><br>' +
        'Known top: <b>' + htmlEscape(knowledgeTopText) + '</b>' +
      '</div>';

    el.style.display = 'block';
  }

  // ----------------------------------------------------------------
  // Toggle — called from F2 keydown handler in main.js
  // ----------------------------------------------------------------

  function toggle() {
    if (!isAllowed()) return;
    _visible = !_visible;
    renderPanel(true);
    console.info('[FE DEBUG] Enemy economy panel', _visible ? 'shown' : 'hidden');
  }

  // ----------------------------------------------------------------
  // Init — store IIFE-scope function references from main.js
  // ----------------------------------------------------------------

  /**
   * Initialize the module with IIFE-scope function references.
   * Must be called once from main.js after all IIFE functions are defined.
   *
   * @param {Object} deps — IIFE-scope function references
   * @param {Function} deps.unitOwner
   * @param {Function} deps.buildingOwner
   * @param {Function} deps.getStorageLimitsForOwner
   * @param {Function} deps.findBaseBuilding
   * @param {Function} [deps.FE_PATCH_08BEnemyCombatUnits]
   * @param {Function} [deps.FE_PATCH_10BEnemyKnowledgeDebugSummary]
   * @param {Function} [deps.FE_PATCH_09C3EnemySeparatorDebugText]
   * @param {Function} [deps.FE_PATCH_09DEnemyFactoryDebugText]
   * @param {Function} [deps.FE_PATCH_09EEnemyFactoryQueueDebugText]
   * @param {Function} [deps.FE_PATCH_09DEnemyBuildOrderDebugText]
   * @param {Function} [deps.FE_PATCH_09EEnemyFactoryBlockedReasonDebugText]
   */
  function init(deps) {
    _deps = deps || {};

    // Start lightweight DOM refresh interval (does nothing when panel is hidden)
    if (!window.FE_DEBUG_ENEMY_ECONOMY_PANEL_INTERVAL) {
      window.FE_DEBUG_ENEMY_ECONOMY_PANEL_INTERVAL = setInterval(function () {
        try {
          renderPanel(false);
        } catch (err) {
          console.warn('[FE DEBUG] Enemy economy panel update failed', err);
        }
      }, 250);
    }
  }

  // ----------------------------------------------------------------
  // Public API
  // ----------------------------------------------------------------

  return {
    init: init,
    toggle: toggle,
    renderPanel: renderPanel,
    isAllowed: isAllowed
  };
})();
