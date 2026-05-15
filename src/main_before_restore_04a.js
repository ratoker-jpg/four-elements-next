(() => {
  'use strict';

  // ============================================================
  // Constants / data
  // ============================================================
  const SAVE_KEY = 'four_elements_core_base_v04_save';
  const SETTINGS_KEY = 'four_elements_core_base_v04_settings';
  const TILE_W = 76;
  const TILE_H = 38;
  const MAP_SIZES = {
    standard: { label:'Стандартная', w:48, h:48 },
    large:    { label:'Большая', w:96, h:96 }
  };
  const BUILDING_SIZE = window.FE_BUILDING_SIZE;

  // v0.4: здания строятся за энергию. Минералы = сырьё, не строительная валюта.
  const BUILDINGS = window.FE_BUILDINGS;


  // V04_TEST_BUILDING_COSTS_START
  // Тестовый режим: стоимость всех зданий уменьшена в 10 раз.
  // Нужен, чтобы чаще проверять строительство, pathfinding и баги builder.
  function applyTestBuildingCostsX10() {
    if (!BUILDINGS || BUILDINGS.__testCostsX10Applied) return;

    for (const [type, def] of Object.entries(BUILDINGS)) {
      if (!def || typeof def !== 'object') continue;

      if (!def.__originalCostForTest) {
        def.__originalCostForTest = {};
      }

      // Основная текущая схема: cost = стоимость здания.
      if (typeof def.cost === 'number') {
        def.__originalCostForTest.cost = def.cost;
        def.cost = Math.max(1, Math.ceil(def.cost / 10));
      }

      // Поддержка альтернативных схем, если они есть в коде.
      const directCostKeys = [
        'costEnergy',
        'energyCost',
        'costMinerals',
        'mineralsCost',
        'mineralCost',
        'rawMineralsCost'
      ];

      for (const key of directCostKeys) {
        if (typeof def[key] === 'number') {
          def.__originalCostForTest[key] = def[key];
          def[key] = Math.max(1, Math.ceil(def[key] / 10));
        }
      }

      // Если cost вдруг объект: { energy: 80, minerals: 100 }
      if (def.cost && typeof def.cost === 'object') {
        def.__originalCostForTest.cost = Object.assign({}, def.cost);

        for (const [resource, amount] of Object.entries(def.cost)) {
          if (typeof amount === 'number') {
            def.cost[resource] = Math.max(1, Math.ceil(amount / 10));
          }
        }
      }
    }

    BUILDINGS.__testCostsX10Applied = true;

    console.warn('[Four Elements] TEST MODE: building costs divided by 10', BUILDINGS);
  }

  applyTestBuildingCostsX10();
  // V04_TEST_BUILDING_COSTS_END



  const UNIT_DEFS = window.FE_UNITS;

  const BASE_STORAGE = {
    minerals:200,
    energy:300,
    purple:20,
    greenEl:20,
    cyanEl:20,
    yellowEl:20
  };

  const FACTION_ELEMENT_KEY = {
    purple:'purple',
    green:'greenEl',
    cyan:'cyanEl',
    yellow:'yellowEl'
  };
  const FACTIONS = window.FE_FACTIONS;
  const MINE_TYPES = window.FE_MINE_TYPES;
  const OBSTACLE_ASSETS = window.FE_OBSTACLE_ASSETS;

  const SPRITE_PROFILES = window.FE_SPRITE_PROFILES;

  function spriteProfile(group, type, fallback={}) {
    return Object.assign({}, fallback, SPRITE_PROFILES[group]?.[type] || {});
  }

  // FE_ANCHOR_DEPTH_SORT_PATCH_START
  function isoSortAnchorY(tx, ty, profile={}) {
    const z = game?.camera?.zoom || 1;
    const p = tileToScreen(tx, ty);
    return (
      p.y +
      TILE_H * z * (profile.groundFactor ?? 1.0) +
      (profile.groundOffset || 0) * z +
      (profile.screenOffsetY || 0) * z
    );
  }

  function isoObjectDepth(kind, obj) {
    if (!window.FE_ANCHOR_DEPTH_SORT_ENABLED) {
      if (kind === 'unit') {
        return ((obj.x || 0) + (obj.y || 0) + 0.75) * 10000 + (obj.x || 0) * 100;
      }

      const x = obj.x || 0;
      const y = obj.y || 0;
      const w = obj.w || 1;
      const h = obj.h || 1;
      return (x + y + w + h) * 10000 + (x + w) * 100 + h;
    }

    if (kind === 'mine') {
      const def = MINE_TYPES[obj.type] || MINE_TYPES.small || { size:[70,70] };
      const profile = spriteProfile('minerals', obj.type, {
        size: def.size,
        groundFactor: 1.02,
        groundOffset: 0,
        screenOffsetY: 0
      });
      return isoSortAnchorY(obj.x || 0, obj.y || 0, profile) + (obj.x || 0) * 0.01;
    }

    if (kind === 'unit') {
      const profile = spriteProfile('units', obj.type, {
        size:[42,42],
        groundFactor:1.05,
        groundOffset:0,
        screenOffsetY:0
      });
      return isoSortAnchorY(obj.x || 0, obj.y || 0, profile) + 0.35 + (obj.x || 0) * 0.01;
    }

    if (kind === 'building') {
      const profile = spriteProfile('buildings', obj.type, {
        size:[128,128],
        groundFactor:1.00,
        groundOffset:14,
        screenOffsetY:0
      });
      const w = obj.w || 1;
      const h = obj.h || 1;
      const cx = (obj.x || 0) + w / 2 - .5;
      const cy = (obj.y || 0) + h / 2 - .5;
      return isoSortAnchorY(cx, cy, profile) + 0.20 + ((obj.x || 0) + w) * 0.01;
    }

    if (kind === 'obs') {
      const fallback = OBSTACLE_ASSETS[obj.asset] || { size:[80,80] };
      const profile = spriteProfile('obstacles', obj.asset, {
        size: fallback.size || [80,80],
        groundFactor: 1.02,
        groundOffset: 0,
        screenOffsetY: 0
      });

      const fp = Array.isArray(profile.footprint) ? profile.footprint : [obj.w || 1, obj.h || 1];
      const fw = Math.max(1, Math.round(fp[0] || 1));
      const fh = Math.max(1, Math.round(fp[1] || 1));
      const anchorTileOffsetX = profile.anchorTileOffsetX ?? 0;
      const anchorTileOffsetY = profile.anchorTileOffsetY ?? 0;
      const cx = (obj.x || 0) + fw / 2 - .5 + anchorTileOffsetX;
      const cy = (obj.y || 0) + fh / 2 - .5 + anchorTileOffsetY;
      return isoSortAnchorY(cx, cy, profile) + 0.10 + ((obj.x || 0) + fw) * 0.01;
    }

    return 0;
  }
  // FE_ANCHOR_DEPTH_SORT_PATCH_END


  // ============================================================
  // DOM
  // ============================================================
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const mainMenu = document.getElementById('mainMenu');
  const mapSizeMenu = document.getElementById('mapSizeMenu');
  const factionMenu = document.getElementById('factionMenu');
  const saveMenu = document.getElementById('saveMenu');
  const pauseMenu = document.getElementById('pauseMenu');
  const modalScreen = document.getElementById('modalScreen');
  const modalTitle = document.getElementById('modalTitle');
  const modalBody = document.getElementById('modalBody');
  const saveSlotBox = document.getElementById('saveSlotBox');
  const hudEl = document.getElementById('hud');
  const topHelp = document.getElementById('topHelp');
  const selectedInfo = document.getElementById('selectedInfo');
  const selectedPanel = selectedInfo.querySelector('.panel');
  const contextMenu = document.getElementById('contextMenu');
  const buildMenu = document.getElementById('buildMenu');
  const toastEl = document.getElementById('toast');

  // ============================================================
  // State
  // ============================================================
  let assets = {};
  let game = null;
  let selected = null;
  let lastTime = performance.now();
  let keys = {};
  let mouse = { middle:false, lastX:0, lastY:0 };
  let chosenMapSize = 'standard';
  let currentModalReturn = 'main';
  let settings = loadSettings();
  let lastHudValues = {};
  const uid = (() => { let i=1; return p => `${p}_${i++}`; })();

  function loadSettings() {
    try {
      return Object.assign({ uiScale:1 }, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'));
    } catch {
      return { uiScale:1 };
    }
  }
  function saveSettings() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }
  function applyUiScale() {
    document.documentElement.style.setProperty('--ui-scale', String(settings.uiScale || 1));
  }

  function blankGame(sizeKey='standard') {
    const cfg = MAP_SIZES[sizeKey] || MAP_SIZES.standard;
    return {
      screen:'game',
      paused:false,
      mapSize:sizeKey,
      mapW:cfg.w,
      mapH:cfg.h,
      time:0,
      faction:'cyan',
      factionWasRandom:false,
      resources:{ minerals:0, purple:0, greenEl:0, cyanEl:0, yellowEl:0, energy:160, powerTotal:0, powerUsed:0 },
      camera:{ x:0, y:0, zoom:1.05 },
      terrain:[],
      minerals:[],
      units:[],
      buildings:[],
      obstacles:[],
      territory:[],
      fogVisible:[],
      fogExplored:[],
      messages:[],
      clickMarkers:[],
      dustParticles:[],
      _sepTimer:0,
      _reactTimer:0,
      _saveTimer:0
    };
  }

  // ============================================================
  // Asset loading
  // ============================================================
  function loadAssets(faction='cyan') {
    assets = window.FE_ASSET_LOADER.loadAssets(faction);
  }

  // ============================================================
  // Helpers
  // ============================================================
  function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }
  function dist(a,b){ return Math.abs(Math.round(a.x)-Math.round(b.x)) + Math.abs(Math.round(a.y)-Math.round(b.y)); }
  function inBounds(x,y){ return game && x>=0 && y>=0 && x<game.mapW && y<game.mapH; }
  function tileToWorld(x,y) { return { x:(x-y)*TILE_W/2, y:(x+y)*TILE_H/2 }; }
  function worldToTile(wx,wy) {
    const x = wy/TILE_H + wx/TILE_W;
    const y = wy/TILE_H - wx/TILE_W;
    return { x:Math.floor(x), y:Math.floor(y) };
  }
  function worldToScreen(wx,wy) {
    return { x:(wx-game.camera.x)*game.camera.zoom + canvas.clientWidth/2, y:(wy-game.camera.y)*game.camera.zoom + canvas.clientHeight/2 };
  }
  function tileToScreen(x,y) {
    const w = tileToWorld(x,y);
    return worldToScreen(w.x,w.y);
  }
  function screenToTile(sx,sy) {
    const wx = (sx - canvas.clientWidth/2)/game.camera.zoom + game.camera.x;
    const wy = (sy - canvas.clientHeight/2)/game.camera.zoom + game.camera.y;
    return worldToTile(wx,wy);
  }
    // V04_EXTERNAL_RENDER_DEBUG_BRIDGE_START
  window.FE_CORE = {
    get game() { return game; },
    get ctx() { return ctx; },
    get assets() { return assets; },
    tileToScreen,
    spriteProfile,
    TILE_W,
    TILE_H
  };

  (function loadExternalRenderDebugOnce() {
    if (window.__FE_RENDER_DEBUG_SCRIPT_LOADING) return;
    window.__FE_RENDER_DEBUG_SCRIPT_LOADING = true;

    const s = document.createElement('script');
    s.src = 'src/modules/debug/render_debug.js?v=render_debug_1';
    s.onload = () => console.warn('[FE DEBUG] external render debug loaded');
    s.onerror = () => console.warn('[FE DEBUG] external render debug not found');
    document.head.appendChild(s);
  })();
  // V04_EXTERNAL_RENDER_DEBUG_BRIDGE_END

  const screenManager = window.FE_SCREEN_MANAGER.create({
    screens: [mainMenu,mapSizeMenu,factionMenu,saveMenu,pauseMenu,modalScreen],
    hudEl,
    topHelp,
    toastEl,
    getGame: () => game
  });

  function showToast(text, ms=6700) { screenManager.showToast(text, ms); }
  function choose(arr) { return arr[Math.floor(Math.random()*arr.length)]; }
  function safeNum(v){ return Number.isFinite(v) ? Math.round(v) : 0; }
  function formatTime(sec) {
    sec = Math.floor(sec||0);
    const h = String(Math.floor(sec/3600)).padStart(2,'0');
    const m = String(Math.floor((sec%3600)/60)).padStart(2,'0');
    const s = String(sec%60).padStart(2,'0');
    return `${h}:${m}:${s}`;
  }
  function canContinue() { return window.FE_SAVE_MANAGER.canContinue(SAVE_KEY); }
  function allScreens(){ return screenManager.allScreens(); }
  function showScreen(el) { screenManager.showScreen(el); }
  function hideScreens() { screenManager.hideScreens(); }

  // ============================================================
  // Map generation
  // ============================================================
  function makeArrays() {
    const w=game.mapW, h=game.mapH;
    game.terrain = Array.from({length:h}, (_,y)=>Array.from({length:w},(_,x)=>({
      shade: Math.sin(x*0.33 + y*0.71)*0.45 + Math.sin((x+y)*0.15)*0.35 + Math.random()*0.22})));
    game.territory = Array.from({length:h}, ()=>Array.from({length:w},()=>({ owner:null, progress:0 })));
    game.fogVisible = Array.from({length:h}, ()=>Array.from({length:w},()=>false));
    game.fogExplored = Array.from({length:h}, ()=>Array.from({length:w},()=>false));
  }

  function getStart() {
    if (game.mapSize === 'large') return { x:12, y:game.mapH-22 };
    return { x:8, y:game.mapH-15 };
  }

  // SPAWN_BASED_RESOURCE_GENERATION_PATCH_START
  function getResourcePlayerCount() {
    const raw = Number(window.FE_RESOURCE_PLAYER_COUNT || game?.playerCount || 1);
    return clamp(Number.isFinite(raw) ? raw : 1, 1, 4);
  }

  function clampStartCell(p) {
    return {
      x: clamp(Math.round(p.x), 3, game.mapW - 4),
      y: clamp(Math.round(p.y), 3, game.mapH - 4)
    };
  }

  function getPlannedPlayerStarts(count=getResourcePlayerCount()) {
    // Current playable start remains first. Other entries are future spawn slots
    // used by resource generation so 2/3/4-player maps stay economically fair.
    const s = getStart();
    const starts = [
      s,
      { x: game.mapW - 1 - s.x, y: game.mapH - 1 - s.y },
      { x: s.x, y: game.mapH - 1 - s.y },
      { x: game.mapW - 1 - s.x, y: s.y }
    ];

    return starts.slice(0, count).map(clampStartCell);
  }

  function normalizeVec(vx, vy) {
    const len = Math.hypot(vx, vy) || 1;
    return { x: vx / len, y: vy / len };
  }

  function spawnOutwardVector(start) {
    const center = { x:(game.mapW - 1) / 2, y:(game.mapH - 1) / 2 };
    return normalizeVec(start.x - center.x, start.y - center.y);
  }

  function cellFromSpawnRelative(start, outwardDist, sideDist) {
    const out = spawnOutwardVector(start);
    const side = { x:-out.y, y:out.x };
    return {
      x: Math.round(start.x + out.x * outwardDist + side.x * sideDist),
      y: Math.round(start.y + out.y * outwardDist + side.y * sideDist)
    };
  }

  function pointFromSpawnToCenter(start, t, sideDist=0) {
    const center = { x:Math.floor(game.mapW/2), y:Math.floor(game.mapH/2) };
    const vx = center.x - start.x;
    const vy = center.y - start.y;
    const dir = normalizeVec(vx, vy);
    const side = { x:-dir.y, y:dir.x };

    return {
      x: Math.round(start.x + vx * t + side.x * sideDist),
      y: Math.round(start.y + vy * t + side.y * sideDist)
    };
  }
  // SPAWN_BASED_RESOURCE_GENERATION_PATCH_END

  function rectsOverlap(a,b) {
    return !(a.x+a.w<=b.x || b.x+b.w<=a.x || a.y+a.h<=b.y || b.y+b.h<=a.y);
  }
  function reserveFree(x,y,w,h, buffer=0) {
    const r={x:x-buffer,y:y-buffer,w:w+buffer*2,h:h+buffer*2};
    if (x<1 || y<1 || x+w>=game.mapW-1 || y+h>=game.mapH-1) return false;
    for (const start of getPlannedPlayerStarts()) {
      const safe={x:start.x-9,y:start.y-9,w:20,h:20};
      if (rectsOverlap(r,safe)) return false;
    }
    for (const o of game.obstacles) if (rectsOverlap(r,o)) return false;
    for (const m of game.minerals) if (rectsOverlap(r,{x:m.x,y:m.y,w:1,h:1})) return false;
    return true;
  }
  function addObstacle(asset,x,y,w,h,block=true) {
    if (!reserveFree(x,y,w,h,1)) return false;
    game.obstacles.push({id:uid('obs'), asset,x,y,w,h,block});
    return true;
  }
  function canSpawnMine(x,y) {
    if (!inBounds(x,y) || x<2 || y<2 || x>=game.mapW-2 || y>=game.mapH-2) return false;
    if (isObstacleBlocked(x,y)) return false;
    for (const m of game.minerals) if (m.x===x && m.y===y) return false;
    // Don't place directly under planned starting units/buildings.
    for (const start of getPlannedPlayerStarts()) {
      if (Math.abs(x-start.x)<3 && Math.abs(y-start.y)<3) return false;
    }
    return true;
  }
  function spawnMine(type,x,y, meta={}) {
    if (!canSpawnMine(x,y)) return false;
    const def = MINE_TYPES[type];
    if (!def) return false;
    game.minerals.push(Object.assign({
      id:uid('mine'),
      type,
      x,
      y,
      remaining:def.remaining,
      infinite:type==='infinite'
    }, meta || {}));
    return true;
  }

  function pushMineDirect(type, x, y, meta={}) {
    const def = MINE_TYPES[type];
    if (!def) return false;
    game.minerals.push(Object.assign({
      id:uid('mine'),
      type,
      x,
      y,
      remaining:def.remaining,
      infinite:type==='infinite'
    }, meta || {}));
    return true;
  }

  // SPAWN_BASED_RESOURCE_RESOURCE_BLOCK_START
  // patch_center_infinite_visual_offset: center_infinite_offset_20260503_1
  // patch_mineral_capacity_and_large_map_fields: mineral_capacity_large_fields_20260503_1
  // patch_starter_resource_cluster_boost: starter_resource_boost_20260503_1
  function spawnMineNear(type, x, y, meta={}) {
    const offsets = [
      [0,0], [1,0], [-1,0], [0,1], [0,-1],
      [1,1], [-1,1], [1,-1], [-1,-1],
      [2,0], [-2,0], [0,2], [0,-2],
      [2,1], [-2,1], [2,-1], [-2,-1],
      [1,2], [-1,2], [1,-2], [-1,-2]
    ];

    for (const [dx,dy] of offsets) {
      if (spawnMine(type, x + dx, y + dy, meta)) return true;
    }

    return false;
  }

  function spawnResourcePatternFromCells(cells, pattern, clusterId) {
    for (const item of pattern) {
      const [type, x, y] = item;
      const meta = { clusterId, resourceField:true };
      spawnMineNear(type, Math.round(x), Math.round(y), meta);
    }
  }

  function spawnResourcePatternRelativeToSpawn(start, pattern, clusterId) {
    for (const item of pattern) {
      const [type, outwardDist, sideDist] = item;
      const cell = cellFromSpawnRelative(start, outwardDist, sideDist);
      const meta = { clusterId, resourceField:true, spawnBased:true };
      spawnMineNear(type, cell.x, cell.y, meta);
    }
  }

  const SPAWN_STARTER_RESOURCE_PATTERN = [
    // Safe-edge starter field: placed behind/side of HQ, away from the central attack route.
    // Boosted starter economy: small stays readable, medium/large carry most of the value.
    ['small',   4.0, -3.0], ['small',  4.0,  3.0],
    ['small',   5.0, -1.5], ['small',  5.0,  1.5],
    ['small',   7.0, -3.2],

    ['medium',  5.8, -3.8], ['medium', 5.8,  3.8],
    ['medium',  6.5, -2.4], ['medium', 6.5,  0.0], ['medium', 6.5,  2.4],
    ['medium',  7.7, -3.0], ['medium', 7.7,  0.0], ['medium', 7.7,  3.0],

    ['large',   8.8, -2.2], ['large',  8.8,  2.2],
    ['large',   9.8, -0.8], ['large',  9.8,  0.8]
  ];

  const SPAWN_NEUTRAL_FIELD_PATTERN = [
    // Smaller neutral field. Mostly medium/large, almost no small clutter.
    ['medium', -1,-1], ['medium', 1,-1],
    ['medium', -1, 1], ['medium', 1, 1],
    ['large',   0, 0], ['large',  2, 1]
  ];

  const SPAWN_LARGE_MAP_EXTRA_FIELD_PATTERN = [
    // Large-map-only neutral fields: medium/large deposits, no small clutter.
    // Infinite deposit remains unique and is still generated only by CENTER_RESOURCE_PATTERN.
    ['medium', -2,-1], ['medium', 0,-1], ['medium', 2,-1],
    ['medium', -2, 1], ['medium', 0, 1], ['medium', 2, 1],
    ['large',  -1, 0], ['large',  1, 0]
  ];

  const CENTER_RESOURCE_PATTERN = [
    // Strict center infinite deposit with a tight conflict ring around it.
    ['infinite',  0, 0],
    ['large',    -1, 0], ['large',  1, 0], ['large',  0,-1], ['large',  0, 1],
    ['medium',   -2,-1], ['medium', 2,-1], ['medium', -2, 1], ['medium', 2, 1],
    ['medium',   -1,-2], ['medium', 1,-2], ['medium', -1, 2], ['medium', 1, 2]
  ];

  function getCenterResourceAnchor() {
    const offsetX = Number.isFinite(window.FE_CENTER_INFINITE_VISUAL_OFFSET_X)
      ? window.FE_CENTER_INFINITE_VISUAL_OFFSET_X
      : -5;
    const offsetY = Number.isFinite(window.FE_CENTER_INFINITE_VISUAL_OFFSET_Y)
      ? window.FE_CENTER_INFINITE_VISUAL_OFFSET_Y
      : -5;

    return {
      x: clamp(Math.floor(game.mapW / 2) + offsetX, 2, game.mapW - 3),
      y: clamp(Math.floor(game.mapH / 2) + offsetY, 2, game.mapH - 3)
    };
  }

  function clearCenterResourceAnchorArea(anchor, radius=3) {
    // Center/infinite is a strategic map object. Do not let neutral fields generated earlier
    // displace it. Clear only nearby non-infinite minerals before rebuilding the center ring.
    game.minerals = game.minerals.filter(m => {
      if (m.type === 'infinite') return false;
      return !(Math.abs(m.x - anchor.x) <= radius && Math.abs(m.y - anchor.y) <= radius);
    });
  }

  function spawnCenterResourceZone() {
    const center = getCenterResourceAnchor();
    clearCenterResourceAnchorArea(center, 3);

    // Keep mineral_infinite unique and exact. The surrounding ring can use near-placement,
    // but the infinite itself must stay at the visual center anchor.
    pushMineDirect('infinite', center.x, center.y, {
      clusterId: 'center',
      resourceField: true,
      centerInfinite: true
    });

    for (const [type, dx, dy] of CENTER_RESOURCE_PATTERN) {
      if (type === 'infinite') continue;
      spawnMineNear(type, center.x + dx, center.y + dy, {
        clusterId: 'center',
        resourceField: true
      });
    }
  }

  function spawnNeutralFieldForStart(start, index) {
    // One field per spawn, between base and center, slightly off the straight route.
    const side = index % 2 === 0 ? 5 : -5;
    const anchor = pointFromSpawnToCenter(start, 0.56, side);

    const cells = SPAWN_NEUTRAL_FIELD_PATTERN.map(([type, dx, dy]) => [type, anchor.x + dx, anchor.y + dy]);
    spawnResourcePatternFromCells(cells, cells, `neutral_${index+1}`);
  }

  function spawnLargeMapExtraFieldsForStart(start, index) {
    if (game.mapSize !== 'large') return;
    if (window.FE_LARGE_MAP_EXTRA_RESOURCE_FIELDS_ENABLED === false) return;

    // Two extra fields per planned spawn:
    // - one mid-safe field
    // - one farther field closer to the center route, but not replacing the central infinite zone.
    const sideA = index % 2 === 0 ? -9 : 9;
    const sideB = index % 2 === 0 ? 12 : -12;
    const specs = [
      { t: 0.34, side: sideA, id: 'mid' },
      { t: 0.72, side: sideB, id: 'far' }
    ];

    specs.forEach((spec, n) => {
      const anchor = pointFromSpawnToCenter(start, spec.t, spec.side);
      const cells = SPAWN_LARGE_MAP_EXTRA_FIELD_PATTERN.map(([type, dx, dy]) => [
        type,
        anchor.x + dx,
        anchor.y + dy
      ]);

      spawnResourcePatternFromCells(cells, cells, `large_extra_${index + 1}_${spec.id}_${n + 1}`);
    });
  }

  function generateResourceClusters() {
    if (window.FE_SPAWN_BASED_RESOURCE_GENERATION_ENABLED === false) {
      return;
    }

    const starts = getPlannedPlayerStarts();

    starts.forEach((start, i) => {
      spawnResourcePatternRelativeToSpawn(start, SPAWN_STARTER_RESOURCE_PATTERN, `starter_p${i+1}`);
    });

    // Neutral fields are also generated per planned spawn so future 2/3/4-player maps
    // receive equal resource opportunities instead of map-fixed random advantages.
    starts.forEach((start, i) => {
      spawnNeutralFieldForStart(start, i);
    });

    // Large maps are 2x bigger, so they need more neutral resource fields.
    // Keep mineral_infinite unique: only spawnCenterResourceZone() creates it.
    if (game.mapSize === 'large' && window.FE_LARGE_MAP_EXTRA_RESOURCE_FIELDS_ENABLED !== false) {
      starts.forEach((start, i) => {
        spawnLargeMapExtraFieldsForStart(start, i);
      });
    }

    spawnCenterResourceZone();
  }
  // SPAWN_BASED_RESOURCE_RESOURCE_BLOCK_END

  function generateMap() {
    makeArrays();
    const center={x:Math.floor(game.mapW/2), y:Math.floor(game.mapH/2)};

    // Ресурсы ставим до препятствий: сначала spawn-based стартовые/нейтральные поля,
    // потом препятствия, чтобы они не перекрывали экономические зоны.
    if (window.FE_RESOURCE_CLUSTER_GENERATION_ENABLED !== false) {
      generateResourceClusters();
    }

    // Terrain blockers: more on large map, not too dense.
    const mult = game.mapSize === 'large' ? 2.1 : 1;
    const obstaclePlans = [
      ['mountain_small_01',1,1,Math.round(8*mult)],
      ['mountain_medium_01',2,2,Math.round(5*mult)],
      ['mountain_ridge_01',3,1,Math.round(3*mult)],
      ['mountain_large_01',3,3,Math.round(2*mult)],
      ['volcano_small_01',1,1,Math.round(4*mult)],
      ['volcano_medium_01',2,2,Math.round(2*mult)],
      ['rock_cluster_small_01',1,1,Math.round(12*mult)],
      ['dry_bush_01',1,1,Math.round(16*mult)],
      ['sand_bump_01',1,1,Math.round(12*mult)]
    ];
    for (const [asset,w,h,count] of obstaclePlans) {
      const block = !['rock_cluster_small_01','dry_bush_01','sand_bump_01'].includes(asset);
      let placed=0, tries=0;
      while (placed<count && tries<count*80) {
        tries++;
        const edgeBias = Math.random()<0.5;
        let x,y;
        if (edgeBias) {
          x = Math.random()<0.5 ? 2+Math.floor(Math.random()*8) : game.mapW-10+Math.floor(Math.random()*7);
          y = 2+Math.floor(Math.random()*(game.mapH-5));
        } else {
          x = 2+Math.floor(Math.random()*(game.mapW-5));
          y = 2+Math.floor(Math.random()*(game.mapH-5));
        }
        if (addObstacle(asset,x,y,w,h,block)) placed++;
      }
    }

    // One landmark-ish large volcano near center but not on resource.
    addObstacle('volcano_large_01', center.x+5, center.y-7, 3, 3, true);
  }


  // ============================================================
  // Game setup
  // ============================================================
  function startNewGame(factionChoice) {
    game = blankGame(chosenMapSize);
    let faction = factionChoice;
    if (factionChoice === 'random') {
      faction = choose(Object.keys(FACTIONS));
      game.factionWasRandom = true;
      game.resources.energy = Math.min(getStorageLimits().energy, game.resources.energy + 50);
    }
    game.faction = faction;
    loadAssets(faction);
    generateMap();

    const start=getStart();
    const base = createBuilding('hq_base', start.x, start.y, true);
    game.buildings.push(base);
    game.units.push(createUnit('harvester', start.x+5, start.y+3));
    game.units.push(createUnit('builder', start.x+4, start.y+6));
    seedTerritory(base);
    updateFog();
    focusCameraOn(start.x+4, start.y+4);
    updateHud(true);
    saveGame();

    selected = null;
    hideMenus();
    hideScreens();
    game.paused = false;
    showToast(`${FACTIONS[faction].label}: ${FACTIONS[faction].bonus}${game.factionWasRandom ? ' + 50 минералов' : ''}`);
  }

  function createUnit(type,x,y) {
    const def = UNIT_DEFS[type] || UNIT_DEFS.builder;
    return {
      id:uid(type), kind:'unit', type, x, y, hp:def.hp || 100, maxHp:def.hp || 100,
      state:'idle', path:[], target:null, cargo:0, cargoCapacity:def.cargo || 0,
      facing:'se', flip:false, angle:0,
      actionTimer:0, manualTarget:null, autoGather:false, buildOrder:null
    };
  }

  function unitLabel(type) {
    return UNIT_DEFS?.[type]?.name || ({
      harvester: 'Сборщик',
      builder: 'Строитель',
      light_tank: 'Лёгкий танк'
    }[type]) || type;
  }

  function createBuilding(type,x,y,complete=false) {
    const [w,h] = BUILDING_SIZE[type] || [2,2];
    const def = BUILDINGS[type] || {};
    const hp =
      type === 'hq_base' ? 1000 :
      type === 'defense_tower' ? 420 :
      320;

    return {
      id:uid(type),
      kind:'building',
      type,
      x,y,w,h,
      hp,
      maxHp:hp,
      complete,
      progress:complete ? 1 : 0,
      buildTime:def.buildTime || 1,
      queue:[],
      _territoryTimer:0
    };
  }

  function focusCameraOn(x,y) {
    const c = tileToWorld(x,y);
    game.camera.x = c.x;
    game.camera.y = c.y - 70;
    game.camera.zoom = game.mapSize === 'large' ? 0.95 : 1.05;
    clampCamera();
  }

  function seedTerritory(building) {
    // v0.4: стартовая территория не заливает область.
    // Даём только одну опорную клетку, дальше здание красит по одной клетке раз в 15 секунд.
    const cx = Math.floor(building.x + building.w/2);
    const cy = Math.floor(building.y + building.h/2);
    if (inBounds(cx,cy)) game.territory[cy][cx] = { owner:game.faction, progress:1 };
    building._territoryTimer = 0;
  }

  // ============================================================
  // Economy / HUD
  // ============================================================
  function getStorageLimits() {
    const limits = Object.assign({}, BASE_STORAGE);
    if (!game) return limits;
    for (const b of game.buildings || []) {
      if (!b.complete) continue;
      const bonus = BUILDINGS[b.type]?.storageBonus;
      if (!bonus) continue;
      for (const [k,v] of Object.entries(bonus)) limits[k] = (limits[k] || 0) + v;
    }
    return limits;
  }

  function resourceSpace(name) {
    const limits = getStorageLimits();
    return Math.max(0, (limits[name] ?? Infinity) - (game.resources[name] || 0));
  }

  function addResource(name, amount) {
    const old = game.resources[name] || 0;
    const limits = getStorageLimits();
    const max = limits[name] ?? Infinity;
    const next = clamp(old + amount, 0, max);
    game.resources[name] = next;
    animateHud(name, next - old);
    return next - old;
  }

  function powerConfig() {
    return {
      hqMw: Number.isFinite(window.FE_POWER_HQ_MW) ? window.FE_POWER_HQ_MW : 10,
      powerPlantMw: Number.isFinite(window.FE_POWER_PLANT_MW) ? window.FE_POWER_PLANT_MW : 20,
      separatorMw: Number.isFinite(window.FE_SEPARATOR_ACTIVE_POWER_MW) ? window.FE_SEPARATOR_ACTIVE_POWER_MW : 4,
      factoryMw: Number.isFinite(window.FE_UNITS_FACTORY_ACTIVE_POWER_MW) ? window.FE_UNITS_FACTORY_ACTIVE_POWER_MW : 5,
    };
  }

  function calculatePowerTotal() {
    if (!game || !game.buildings) return 0;
    const cfg = powerConfig();
    let total = 0;
    for (const b of game.buildings || []) {
      if (!b.complete) continue;
      if (b.type === 'hq_base') total += cfg.hqMw;
      else if (b.type === 'power_plant') total += cfg.powerPlantMw;
    }
    return total;
  }

  function resetBuildingPowerState() {
    for (const b of game.buildings || []) {
      b._powerActive = false;
      b._powerPaused = false;
      b._powerLoad = 0;
    }
  }

  function evaluatePowerState() {
    // v0.4 patch 4: Power is enforced as active grid capacity.
    // Separator consumes power only while it can process resources.
    // Units Factory consumes power only while producing a queued unit.
    if (!game || !game.resources) return { total: 0, used: 0, activeSeparatorCount: 0 };

    const cfg = powerConfig();
    const total = calculatePowerTotal();
    let used = 0;
    let activeSeparatorCount = 0;

    resetBuildingPowerState();

    const tryReservePower = (building, mw) => {
      if (!building || !Number.isFinite(mw) || mw <= 0) return true;
      building._powerLoad = mw;
      if (used + mw <= total) {
        used += mw;
        building._powerActive = true;
        building._powerPaused = false;
        return true;
      }
      building._powerActive = false;
      building._powerPaused = true;
      return false;
    };

    for (const b of game.buildings || []) {
      if (!b.complete || b.type !== 'separator') continue;
      if (!canRunSeparatorCycle()) continue;
      if (tryReservePower(b, cfg.separatorMw)) activeSeparatorCount += 1;
    }

    for (const b of game.buildings || []) {
      if (!b.complete || b.type !== 'units_factory') continue;
      b.queue = b.queue || [];
      if (!b.queue.length) continue;
      tryReservePower(b, cfg.factoryMw);
    }

    game.resources.powerTotal = total;
    game.resources.powerUsed = used;
    return { total, used, activeSeparatorCount };
  }

  function updatePower() {
    evaluatePowerState();
  }

  function formatLimitValue(current, limit) {
    return `${safeNum(current)}/${safeNum(limit)}`;
  }

  function formatPowerValue() {
    const used = safeNum(game.resources.powerUsed || 0);
    const total = safeNum(game.resources.powerTotal || 0);
    return `${used}/${total} MW`;
  }

  function factionElementKey() {
    return FACTION_ELEMENT_KEY[game.faction] || 'cyanEl';
  }

  function canRunSeparatorCycle() {
    const elKey = factionElementKey();
    return (
      game.resources.minerals >= 20 &&
      resourceSpace('energy') >= 10 &&
      resourceSpace(elKey) >= 1
    );
  }


  // V04_BUILDING_STATUS_START
  function buildingStatusColor(kind) {
    if (kind === 'ok') return '#9dffb0';
    if (kind === 'warn') return '#ffdca0';
    if (kind === 'bad') return '#ff9b8b';
    return '#d6e7ff';
  }

  function storageBonusText(b) {
    const bonus = BUILDINGS?.[b.type]?.storageBonus;
    if (!bonus) return '';

    const labels = {
      minerals: 'сырьё',
      energy: 'энергия',
      purple: 'фиолетовый элемент',
      greenEl: 'зелёный элемент',
      cyanEl: 'синий элемент',
      yellowEl: 'жёлтый элемент'
    };

    return Object.entries(bonus)
      .map(([key, value]) => `+${safeNum(value)} ${labels[key] || key}`)
      .join(', ');
  }

  function separatorStatusInfo(b) {
    if (!b.complete) return null;

    const elKey = factionElementKey();
    if ((game.resources.minerals || 0) < 20) {
      return { kind: 'warn', text: 'нет сырья для переработки' };
    }
    if (resourceSpace('energy') < 10) {
      return { kind: 'bad', text: 'склад энергии заполнен' };
    }
    if (resourceSpace(elKey) < 1) {
      return { kind: 'bad', text: 'склад элементов заполнен' };
    }
    if (b._powerPaused) {
      return { kind: 'bad', text: 'не хватает мощности' };
    }
    if (b._powerActive) {
      return { kind: 'ok', text: `работает, мощность ${safeNum(b._powerLoad)} MW` };
    }

    return { kind: 'idle', text: 'готов к переработке' };
  }

  function factoryCanAffordAnyUnit() {
    const elKey = factionElementKey();
    const elCount = game.resources[elKey] || 0;
    return ['builder', 'harvester', 'light_tank'].some(type => {
      const def = UNIT_DEFS[type];
      return def && elCount >= (def.costElement || 0);
    });
  }

  function factoryStatusInfo(b) {
    if (!b.complete) return null;

    b.queue = b.queue || [];
    if (!b.queue.length) {
      if (!factoryCanAffordAnyUnit()) {
        return { kind: 'warn', text: 'очередь пуста, не хватает элемента для юнита' };
      }
      return { kind: 'idle', text: 'очередь пуста' };
    }

    const q = b.queue[0];
    const unitName = UNIT_DEFS[q.type]?.name || q.type || 'юнит';
    if (b._powerPaused) {
      return { kind: 'bad', text: `производство ${unitName} на паузе: не хватает мощности` };
    }
    if (b._powerActive) {
      return { kind: 'ok', text: `производит ${unitName}, мощность ${safeNum(b._powerLoad)} MW` };
    }

    return { kind: 'warn', text: `производит ${unitName}` };
  }

  function buildingStatusInfo(b) {
    if (!b) return null;
    if (!b.complete) return null;

    if (b.type === 'separator') return separatorStatusInfo(b);
    if (b.type === 'units_factory') return factoryStatusInfo(b);

    if (b.type === 'power_plant') {
      const mw = powerConfig().powerPlantMw;
      return { kind: 'ok', text: `даёт +${safeNum(mw)} MW мощности` };
    }

    const storageText = storageBonusText(b);
    if (storageText) return { kind: 'ok', text: `увеличивает лимит: ${storageText}` };

    if (b.type === 'hq_base') {
      return { kind: 'ok', text: `даёт +${safeNum(powerConfig().hqMw)} MW стартовой мощности` };
    }

    return { kind: 'idle', text: 'готово' };
  }

  function buildingStatusHtml(b) {
    const info = buildingStatusInfo(b);
    if (!info || !info.text) return '';
    const color = buildingStatusColor(info.kind);
    return `<div style="margin-top:7px;color:${color}">Статус: ${info.text}</div>`;
  }
  // V04_BUILDING_STATUS_END

  function updateProduction(dt) {
    const powerState = evaluatePowerState();
    const activeSepCount = powerState.activeSeparatorCount || 0;

    // 20 сырья -> 10 энергии + 1 элемент фракции.
    // Если энергия/элементы забиты или мощности не хватает, переработка ставится на паузу.
    if (activeSepCount && canRunSeparatorCycle()) {
      game._sepTimer += dt * activeSepCount;
      if (game._sepTimer >= 6.0) {
        game._sepTimer = 0;
        if (canRunSeparatorCycle()) {
          addResource('minerals', -20);
          addResource('energy', 10);
          addResource(factionElementKey(), 1);
        }
      }
    }

    updateUnitProduction(dt);
  }

  function queueUnitProduction(factory, unitType) {
    if (!factory || factory.type !== 'units_factory' || !factory.complete) return;
    const def = UNIT_DEFS[unitType];
    if (!def) return;

    factory.queue = factory.queue || [];
    if (factory.queue.length >= 2) {
      showToast('Очередь фабрики заполнена: максимум 2 юнита');
      return;
    }

    const elKey = factionElementKey();
    if ((game.resources[elKey] || 0) < def.costElement) {
      showToast(`Не хватает элемента фракции: нужно ${def.costElement}`);
      return;
    }

    addResource(elKey, -def.costElement);
    factory.queue.push({ type:unitType, remaining:def.productionTime });
    showToast(`В очереди: ${def.name}`);
  }

  function productionSpeedForUnit(type) {
    const faction = FACTIONS[game.faction];
    if (type === 'harvester' || type === 'builder') return faction.civilianProductionSpeed || 1;
    return faction.combatProductionSpeed || 1;
  }

  function findSpawnCellNearBuilding(b) {
    const cells = adjacentFreeCellsForRect(b.x,b.y,b.w,b.h,null);
    cells.sort((a,b2)=>dist({x:b.x,y:b.y},a)-dist({x:b.x,y:b.y},b2));
    return cells[0] || null;
  }

  function updateUnitProduction(dt) {
    for (const b of game.buildings) {
      if (!b.complete || b.type !== 'units_factory') continue;
      b.queue = b.queue || [];
      if (!b.queue.length) continue;

      if (b._powerPaused) {
        continue;
      }

      const q = b.queue[0];
      q.remaining -= dt * productionSpeedForUnit(q.type);

      if (q.remaining <= 0) {
        const spot = findSpawnCellNearBuilding(b);
        if (!spot) {
          q.remaining = 1;
          showToast('Нет свободного места для выхода юнита');
          continue;
        }
        game.units.push(createUnit(q.type, spot.x, spot.y));
        b.queue.shift();
        showToast(`Готов юнит: ${UNIT_DEFS[q.type].name}`);
      }
    }
  }
  function updateHud(force=false) {
    if (!game) return;
    updatePower();
    const limits = getStorageLimits();
    const vals = {
      minerals:formatLimitValue(game.resources.minerals, limits.minerals),
      purple:formatLimitValue(game.resources.purple, limits.purple),
      greenEl:formatLimitValue(game.resources.greenEl, limits.greenEl),
      cyanEl:formatLimitValue(game.resources.cyanEl, limits.cyanEl),
      yellowEl:formatLimitValue(game.resources.yellowEl, limits.yellowEl),
      energy:formatLimitValue(game.resources.energy, limits.energy),
      powerPct:formatPowerValue()
    };
    for (const [k,v] of Object.entries(vals)) {
      const el = hudEl.querySelector(`[data-res="${k}"] .num`);
      if (el && (force || el.textContent !== String(v))) el.textContent = v;
    }
  }
  function animateHud(name, amount) {
    if (!amount) return;
    const res = hudEl.querySelector(`[data-res="${name}"]`);
    if (!res) return;
    res.classList.remove('changed-up','changed-down');
    void res.offsetWidth;
    res.classList.add(amount>0 ? 'changed-up' : 'changed-down');
    const d = document.createElement('span');
    d.className = 'delta ' + (amount>0?'up':'down');
    d.textContent = (amount>0?'+':'') + amount;
    res.appendChild(d);
    setTimeout(()=>res.classList.remove('changed-up','changed-down'), 600);
    setTimeout(()=>d.remove(), 700);
  }

  // ============================================================
  // Blocking / pathfinding
  // ============================================================
  function cleanupDepletedMinerals() {
    if (!game || !game.minerals) return;
    game.minerals = game.minerals.filter(m => m.infinite || m.remaining > 0);
  }

  function isObstacleBlocked(x,y) {
    return game.obstacles.some(o=>o.block && x>=o.x && y>=o.y && x<o.x+o.w && y<o.y+o.h);
  }
  function mineAt(x,y) {
    cleanupDepletedMinerals();
    return game.minerals.find(m=>m.x===x && m.y===y && (m.infinite || m.remaining>0)) || null;
  }
  function buildingSoftBlockAt(x,y) {
    for (const b of game.buildings || []) {
      if (b.type !== 'hq_base') continue;

      // HQ визуально крупнее, чем обычные здания.
      // Поэтому вокруг него держим буфер 1 клетка,
      // чтобы харвестер/строитель не заезжали под спрайт.
      const pad = 1;
      if (
        x >= b.x - pad &&
        x < b.x + b.w + pad &&
        y >= b.y - pad &&
        y < b.y + b.h + pad
      ) {
        return b;
      }
    }
    return null;
  }

  function buildingAt(x,y) {
    return game.buildings.find(b=>x>=b.x && y>=b.y && x<b.x+b.w && y<b.y+b.h);
  }
  function unitAt(x,y, ignoreId=null) {
    return game.units.find(u=>u.id!==ignoreId && Math.round(u.x)===x && Math.round(u.y)===y);
  }
  function isBlocked(x,y, ignoreUnitId=null) {
    if (!inBounds(x,y)) return true;
    if (isObstacleBlocked(x,y)) return true;
    if (buildingAt(x,y)) return true;
    if (mineAt(x,y)) return true;
    if (unitAt(x,y, ignoreUnitId)) return true;
    return false;
  }
  function passable(x,y, unitId) { return inBounds(x,y) && !isBlocked(x,y,unitId); }

  function findPath(start, goal, unitId) {
    cleanupDepletedMinerals();
    cleanupDepletedMinerals();
    const sx=Math.round(start.x), sy=Math.round(start.y), gx=Math.round(goal.x), gy=Math.round(goal.y);
    if (!inBounds(gx,gy)) return [];
    if (sx===gx && sy===gy) return [];
    if (!passable(gx,gy,unitId)) return [];
    const q=[{x:sx,y:sy}];
    const came=new Map();
    came.set(`${sx},${sy}`, null);
    const dirs=[[1,0],[-1,0],[0,1],[0,-1]];
    let head=0;
    while (head<q.length) {
      const cur=q[head++];
      if (cur.x===gx && cur.y===gy) break;
      for (const [dx,dy] of dirs) {
        const nx=cur.x+dx, ny=cur.y+dy, k=`${nx},${ny}`;
        if (came.has(k)) continue;
        if (!passable(nx,ny,unitId)) continue;
        came.set(k,cur);
        q.push({x:nx,y:ny});
      }
    }
    const endKey=`${gx},${gy}`;
    if (!came.has(endKey)) return null;
    const path=[];
    let cur={x:gx,y:gy};
    while(cur) { path.push(cur); cur=came.get(`${cur.x},${cur.y}`); }
    path.reverse();
    path.shift();
    return path;
  }


  const __originalFindPathForFullDebug = findPath;

findPath = function(start, goal, unitId) {
  const path = __originalFindPathForFullDebug(start, goal, unitId);

  if (!window.FE_DEBUG_LOG_ENABLED) {
    return path;
  }

  if (!path || !path.length) {
      debugLog('path_not_found_or_empty', {
        start:safeCloneForLog(start),
        goal:safeCloneForLog(goal),
        unitId,
        startDiagnosis:start ? diagnoseCell(Math.round(start.x), Math.round(start.y), unitId) : null,
        goalDiagnosis:goal ? diagnoseCell(Math.round(goal.x), Math.round(goal.y), unitId) : null
      });
    } else {
      debugLog('path_found', {
        start:safeCloneForLog(start),
        goal:safeCloneForLog(goal),
        unitId,
        pathLength:path.length,
        first:path[0],
        last:path[path.length - 1]
      });
    }

    return path;
  };


  function adjacentFreeCells(target, unitId) {
    const dirs=[[1,0],[-1,0],[0,1],[0,-1]];
    return dirs.map(([dx,dy])=>({x:target.x+dx,y:target.y+dy}))
      .filter(c=>passable(c.x,c.y,unitId));
  }
  function adjacentFreeCellsForRect(x,y,w,h,unitId) {
    const cells=[];
    for (let xx=x; xx<x+w; xx++) {
      cells.push({x:xx,y:y-1});
      cells.push({x:xx,y:y+h});
    }
    for (let yy=y; yy<y+h; yy++) {
      cells.push({x:x-1,y:yy});
      cells.push({x:x+w,y:yy});
    }
    return cells.filter((c,i,a)=>a.findIndex(z=>z.x===c.x&&z.y===c.y)===i)
      .filter(c=>passable(c.x,c.y,unitId));
  }

  // ============================================================
  // Movement
  // ============================================================
  // FE_UNIT_CLICK_MARKER_PATCH_START
  function builderClickMarkerEnabled() {
    return window.FE_BUILDER_CLICK_MARKER_ENABLED !== false;
  }

  function unitClickMarkerEnabled() {
    return window.FE_UNIT_CLICK_MARKER_ENABLED !== false;
  }

  function clickMarkerEnabledForSource(source='generic') {
    if (!unitClickMarkerEnabled()) return false;
    if (source === 'builder' && !builderClickMarkerEnabled()) return false;
    return true;
  }

  function unitClickMarkerSource(unit) {
    if (!unit || unit.kind !== 'unit') return null;

    const configured = Array.isArray(window.FE_UNIT_CLICK_MARKER_TYPES)
      ? window.FE_UNIT_CLICK_MARKER_TYPES
      : ['builder', 'harvester'];

    return configured.includes(unit.type) ? unit.type : null;
  }

  function addClickMarker(x,y,type='ok', source='generic') {
    if (!game) return;
    if (!clickMarkerEnabledForSource(source)) return;

    game.clickMarkers = game.clickMarkers || [];
    const markerLife = Number.isFinite(window.FE_UNIT_CLICK_MARKER_LIFE)
      ? window.FE_UNIT_CLICK_MARKER_LIFE
      : Number.isFinite(window.FE_BUILDER_CLICK_MARKER_LIFE)
        ? window.FE_BUILDER_CLICK_MARKER_LIFE
        : .62;

    game.clickMarkers.push({
      x,
      y,
      type,
      source,
      life:markerLife,
      maxLife:markerLife
    });
  }

  function addUnitClickMarker(unit, x, y, type='ok') {
    const source = unitClickMarkerSource(unit);
    if (!source) return;
    addClickMarker(x, y, type, source);
  }
  // FE_UNIT_CLICK_MARKER_PATCH_END

function unitIsBetweenGridCells(unit) {
  const EPS = 0.04;

  return (
    Math.abs(unit.x - Math.round(unit.x)) > EPS ||
    Math.abs(unit.y - Math.round(unit.y)) > EPS
  );
}

function queueManualMove(unit, tx, ty) {
  if (!passable(tx, ty, unit.id)) {
    addUnitClickMarker(unit, tx, ty, 'bad');
    showToast('Клетка недоступна');
    return false;
  }

  unit._queuedManualMove = { x: tx, y: ty };

  // Важно: не меняем текущий path прямо сейчас.
  // Юнит доедет до ближайшей целой клетки и только потом повернёт.
  addUnitClickMarker(unit, tx, ty, 'ok');
  showToast('Команда принята: повернёт на ближайшей клетке');

  return true;
}

function applyQueuedManualMove(unit) {
  const q = unit._queuedManualMove;
  if (!q) return false;

  unit._queuedManualMove = null;

  // Прижимаем к целой клетке, чтобы новый путь строился из нормального grid-узла.
  unit.x = Math.round(unit.x);
  unit.y = Math.round(unit.y);

  if (!passable(q.x, q.y, unit.id)) {
    addUnitClickMarker(unit, q.x, q.y, 'bad');
    showToast('Клетка стала недоступна');
    return false;
  }

  const path = findPath(unit, { x: q.x, y: q.y }, unit.id);

  if (path === null) {
    addUnitClickMarker(unit, q.x, q.y, 'bad');
    showToast('Юнит не может доехать');
    return false;
  }

  unit.path = path;
  unit.state = 'manual_move';
  unit.manualTarget = null;

  // Сбрасываем зафиксированное направление, чтобы новый сегмент выбрал новый dir.
  unit._dirTargetKey = null;
  unit._dirDx = 0;
  unit._dirDy = 0;

  if (!path.length) {
    unit.state = 'idle';
  }

  return true;
}


function unitDisplayName(unitOrType) {
  const type = typeof unitOrType === 'string' ? unitOrType : unitOrType?.type;
  return UNIT_DEFS?.[type]?.name || (type === 'harvester' ? 'Сборщик' : type === 'builder' ? 'Строитель' : 'Юнит');
}

function setManualMove(unit, tx, ty) {
  if (!passable(tx, ty, unit.id)) {
    addUnitClickMarker(unit, tx, ty, 'bad');
    showToast('Клетка недоступна');
    return;
  }

  // Если юнит уже едет между клетками — не ломаем текущий сегмент.
  // Сохраняем новую команду и применяем её только в ближайшей целой клетке.
  if (unit.path && unit.path.length && unitIsBetweenGridCells(unit)) {
    queueManualMove(unit, tx, ty);
    unit.state = 'manual_move';
    unit.manualTarget = null;
    hideMenus();
    return;
  }

  const path = findPath(unit, { x: tx, y: ty }, unit.id);

  if (path === null) {
    addUnitClickMarker(unit, tx, ty, 'bad');
    showToast('Юнит не может доехать');
    return;
  }

  addUnitClickMarker(unit, tx, ty, 'ok');

  unit.path = path;
  unit.state = 'manual_move';
  unit.manualTarget = null;

  unit._queuedManualMove = null;
  unit._dirTargetKey = null;
  unit._dirDx = 0;
  unit._dirDy = 0;

  hideMenus();
  showToast(`${unitLabel(unit.type)} едет`);
}

// FE_BUILDER_RIGHT_CLICK_CANCEL_PATCH_START
function builderRightClickCancelEnabled() {
  return window.FE_BUILDER_RIGHT_CLICK_CANCEL_ENABLED !== false;
}

function cancelBuilderManualMove(unit) {
  if (!builderRightClickCancelEnabled()) return false;
  if (!unit || unit.kind !== 'unit' || unit.type !== 'builder') return false;

  const isManualMove = unit.state === 'manual_move';
  const hasPath = !!(unit.path && unit.path.length);

  unit._queuedManualMove = null;
  unit.manualTarget = null;

  if (!isManualMove && !hasPath) {
    return false;
  }

  if (hasPath && unitIsBetweenGridCells(unit)) {
    const next = unit.path[0];
    const stopCell = { x:Math.round(next.x), y:Math.round(next.y) };

    // Не обрываем движение посреди перехода между клетками.
    // Builder доедет до текущей следующей клетки и там остановится.
    unit.path = [stopCell];
    unit.state = 'manual_move';

    if (builderClickMarkerEnabled()) {
      addClickMarker(stopCell.x, stopCell.y, 'ok', 'builder');
    }

    showToast('Команда отменена: остановится на ближайшей клетке');
    return true;
  }

  // Если builder уже стоит на целой клетке — отменяем путь сразу.
  unit.path = [];
  unit.x = Math.round(unit.x);
  unit.y = Math.round(unit.y);
  unit.state = 'idle';
  unit._dirTargetKey = null;
  unit._dirDx = 0;
  unit._dirDy = 0;

  if (builderClickMarkerEnabled()) {
    addClickMarker(unit.x, unit.y, 'ok', 'builder');
  }

  showToast('Команда движения отменена');
  return true;
}


function cancelManualMoveAfterCurrentCell(unit, label='Юнит') {
  if (!unit || unit.kind !== 'unit') return false;

  const isManualMove = unit.state === 'manual_move';
  const hasPath = !!(unit.path && unit.path.length);

  unit._queuedManualMove = null;
  unit.manualTarget = null;

  if (!isManualMove && !hasPath) return false;

  if (hasPath && unitIsBetweenGridCells(unit)) {
    const next = unit.path[0];
    const stopCell = { x:Math.round(next.x), y:Math.round(next.y) };
    unit.path = [stopCell];
    unit.state = 'manual_move';
    addUnitClickMarker(unit, stopCell.x, stopCell.y, 'ok');
    showToast(`${label}: остановится на ближайшей клетке`);
    return true;
  }

  unit.path = [];
  unit.x = Math.round(unit.x);
  unit.y = Math.round(unit.y);
  unit.state = 'idle';
  unit._dirTargetKey = null;
  unit._dirDx = 0;
  unit._dirDy = 0;
  addUnitClickMarker(unit, unit.x, unit.y, 'ok');
  showToast(`${label}: команда движения отменена`);
  return true;
}

function handleCanvasRightClickCancel(e) {
  e.preventDefault();
  e.stopPropagation();

  if (!game || game.screen !== 'game' || game.paused) return true;

  const p = getCanvasPoint(e);
  const t = screenToTile(p.x, p.y);
  const obj = inBounds(t.x, t.y) ? objectAtTile(t.x, t.y) : null;

  hideMenus();

  if (selected?.kind === 'unit' && selected.type === 'builder') {
    if (e.ctrlKey && obj?.kind === 'building' && isUnfinishedConstruction(obj)) {
      cancelUnfinishedConstruction(obj, 'ctrl_right_click_cancel_unfinished', selected);
      return true;
    }

    if (cancelBuilderBuildCommand(selected, 'right_click_cancel_builder_build')) {
      return true;
    }

    cancelBuilderManualMove(selected);
  }

  if (selected?.kind === 'unit' && selected.type === 'light_tank') {
    cancelManualMoveAfterCurrentCell(selected, 'Лёгкий танк');
  }

  return true;
}
// FE_BUILDER_RIGHT_CLICK_CANCEL_PATCH_END

  function recoverUnitPath(unit) {
    unit._blockedTimer = 0;
    unit._stuckTimer = 0;

    if (unit.type === 'harvester') {
      unit.manualTarget = null;
      assignNextMine(unit);
      return true;
    }

    if (unit.type === 'builder' && unit.state === 'moving_to_build' && unit.buildOrder?.type) {
      const plan = findBuildPlan(unit, unit.buildOrder.type);
      if (plan && plan.path && plan.path.length) {
        unit.path = plan.path;
        unit.buildOrder.spot = plan.spot;
        return true;
      }

      showToast('Строитель не может объехать препятствие');
      unit.path = [];
      unit.state = 'idle';
      unit.buildOrder = null;
      return false;
    }

    unit.path = [];
    if (unit.state === 'manual_move') unit.state = 'idle';
    return false;
  }

function updateUnitMovement(unit, dt) {
  cleanupDepletedMinerals();

  if (!unit.path || !unit.path.length) return false;

  const beforeX = unit.x;
  const beforeY = unit.y;

  const next = unit.path[0];
  const nx = Math.round(next.x);
  const ny = Math.round(next.y);

  // Если следующая клетка внезапно стала заблокирована,
  // не дёргаться, а пересчитать путь.
  if (!passable(nx, ny, unit.id)) {
    unit._blockedTimer = (unit._blockedTimer || 0) + dt;
    if (unit._blockedTimer > .35) recoverUnitPath(unit);
    return false;
  }

  unit._blockedTimer = 0;

  let dx = next.x - unit.x;
  let dy = next.y - unit.y;

  // Ключевой фикс:
  // если после прошлого шага остался микроскопический хвост по другой оси,
  // сразу прижимаем координату к целевой.
  // Иначе чистое движение по Y начинает дрожать из-за tiny dx.
  const SNAP_EPS = 0.035;

  if (Math.abs(dx) <= SNAP_EPS) {
    unit.x = next.x;
    dx = 0;
  }

  if (Math.abs(dy) <= SNAP_EPS) {
    unit.y = next.y;
    dy = 0;
  }

  if (Math.abs(dx)>0.001 || Math.abs(dy)>0.001) {
    if (Math.abs(dx) > Math.abs(dy)) {
      unit.facing = dx > 0 ? 'east' : 'west';
    } else {
      unit.facing = dy > 0 ? 'south' : 'north';
    }
  }

  const configuredSpeed = UNIT_DEFS?.[unit.type]?.speed;
  const baseSpeed = Number.isFinite(configuredSpeed)
    ? configuredSpeed
    : (unit.type === 'harvester' ? 0.46 : 0.62);
  const spd = baseSpeed * (unit.type === 'harvester' ? FACTIONS[game.faction].harvesterSpeed : 1);
  let step = spd * dt;

  const len = Math.abs(dx) + Math.abs(dy);

if (len <= step) {
  unit.x = next.x;
  unit.y = next.y;
  unit.path.shift();

  unit._stuckTimer = 0;

  // Разрешаем пересчитать визуальное направление на новом сегменте.
  unit._dirTargetKey = null;
  unit._dirDx = 0;
  unit._dirDy = 0;

  // Если игрок кликнул новую точку во время движения,
  // применяем её только после доезда до ближайшей целой клетки.
  if (unit._queuedManualMove) {
    applyQueuedManualMove(unit);
  }

  return true;
}

  // Двигаем сначала по основной оси.
  // Если есть остаток шага - добираем вторую ось.
  function moveAxis(axis) {
    if (step <= 0) return;

    const cur = unit[axis];
    const target = next[axis];
    const delta = target - cur;
    const abs = Math.abs(delta);

    if (abs <= 0.0001) {
      unit[axis] = target;
      return;
    }

    const move = Math.min(abs, step);
    unit[axis] = cur + Math.sign(delta) * move;
    step -= move;
  }

  if (Math.abs(dx) >= Math.abs(dy)) {
    moveAxis('x');
    moveAxis('y');
  } else {
    moveAxis('y');
    moveAxis('x');
  }

  const moved = Math.abs(unit.x - beforeX) + Math.abs(unit.y - beforeY);

  if (moved < 0.0001) {
    unit._stuckTimer = (unit._stuckTimer || 0) + dt;
    if (unit._stuckTimer > .75) recoverUnitPath(unit);
  } else {
    unit._stuckTimer = 0;
  }

  return false;
}
  // ============================================================
  // Harvester
  // ============================================================
window.FE_HARVESTER_LOG_ENABLED = false;
function harvesterLog(event, unit, payload={}) {
  if (!window.FE_HARVESTER_LOG_ENABLED) return;

  try {
      const item = {
        ts: new Date().toISOString(),
        t: Math.round(performance.now()),
        event,
        unit: unit ? {
          id: unit.id,
          type: unit.type,
          state: unit.state,
          x: unit.x,
          y: unit.y,
          grid:{x:Math.round(unit.x), y:Math.round(unit.y)},
          pathLength: unit.path ? unit.path.length : 0,
          target: unit.target || null,
          cargo: unit.cargo || 0,
          autoGather: !!unit.autoGather,
          manualTarget: unit.manualTarget || null
        } : null,
        payload
      };

      window.__fourElementsHarvesterLog = window.__fourElementsHarvesterLog || [];
      window.__fourElementsHarvesterLog.push(item);
      if (window.__fourElementsHarvesterLog.length > 500) window.__fourElementsHarvesterLog.shift();

      // Дополнительно кладём в localStorage, чтобы можно было достать даже без F9.
      localStorage.setItem(
        'four_elements_harvester_debug_log',
        JSON.stringify(window.__fourElementsHarvesterLog)
      );

      if (
        event.includes('fail') ||
        event.includes('stuck') ||
        event.includes('no_path') ||
        event.includes('retry')
      ) {
        console.warn('[harvester]', event, item);
      }
    } catch (e) {}
  }

  function uniqueCells(cells) {
    const seen = new Set();
    const out = [];

    for (const c of cells) {
      const key = `${c.x},${c.y}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(c);
    }

    return out;
  }

  function ringCellsAroundPoint(cx, cy, radius) {
    const cells = [];

    for (let dy=-radius; dy<=radius; dy++) {
      for (let dx=-radius; dx<=radius; dx++) {
        if (Math.abs(dx) + Math.abs(dy) !== radius) continue;
        cells.push({ x:cx + dx, y:cy + dy });
      }
    }

    return cells;
  }

  function harvesterApproachCells(mine, unitId) {
    const cells = [];

    // Сначала нормальные 4 соседние клетки.
    cells.push(...adjacentFreeCells(mine, unitId));

    // Потом запасное кольцо на 2 клетки.
    // Это нужно, если рядом стоит юнит/здание/остаточный блок.
    for (const c of ringCellsAroundPoint(mine.x, mine.y, 2)) {
      if (passable(c.x, c.y, unitId)) cells.push(c);
    }

    return uniqueCells(cells);
  }

  function findReachableCell(unit, cells) {
    const ordered = uniqueCells(cells)
      .filter(c => passable(c.x, c.y, unit.id))
      .sort((a,b) => dist(unit,a) - dist(unit,b));

    const failed = [];

    for (const cell of ordered) {
      const path = findPath(unit, cell, unit.id);

      if (path !== null) {
        return { cell, path };
      }

      failed.push({
        x:cell.x,
        y:cell.y,
        reason:'path_null'
      });
    }

    return { cell:null, path:null, failed };
  }

  function findReachableMinePlan(unit) {
    cleanupDepletedMinerals();

    let candidates = game.minerals
      .filter(m => m.infinite || m.remaining > 0)
      .sort((a,b) => dist(unit,a) - dist(unit,b));

    if (unit.manualTarget) {
      const manual = candidates.find(m => m.id === unit.manualTarget);
      candidates = manual
        ? [manual, ...candidates.filter(m => m.id !== manual.id)]
        : candidates;
    } else {
      const finite = candidates.filter(m => !m.infinite);
      const infinite = candidates.filter(m => m.infinite);
      candidates = [...finite, ...infinite];
    }

    const failedMines = [];

    for (const mine of candidates) {
      const approach = harvesterApproachCells(mine, unit.id);
      const found = findReachableCell(unit, approach);

      if (found.path !== null) {
        return {
          mine,
          cell: found.cell,
          path: found.path
        };
      }

      failedMines.push({
        id: mine.id,
        type: mine.type,
        x: mine.x,
        y: mine.y,
        remaining: mine.remaining,
        approachCells: approach,
        failedCells: found.failed || []
      });
    }

    return {
      mine:null,
      cell:null,
      path:null,
      failedMines
    };
  }

  function findBaseReturnPlan(unit) {
    const base = game.buildings.find(b => b.type === 'hq_base');

    if (!base) {
      return { cell:null, path:null, reason:'no_hq' };
    }

    const cells = adjacentFreeCellsForRect(base.x, base.y, base.w, base.h, unit.id)
      .sort((a,b) => dist(unit,a) - dist(unit,b));

    const found = findReachableCell(unit, cells);

    return {
      base,
      cell: found.cell,
      path: found.path,
      failed: found.failed || []
    };
  }

  function isNearMine(unit, mine) {
    if (!mine) return false;

    const d =
      Math.abs(Math.round(unit.x) - mine.x) +
      Math.abs(Math.round(unit.y) - mine.y);

    // 1 — идеально рядом.
    // 2 — запасной режим, если соседняя клетка была занята.
    return d <= 2;
  }

  function isNearRect(unit, rect) {
    if (!rect) return false;

    const ux = Math.round(unit.x);
    const uy = Math.round(unit.y);

    const insideExpanded =
      ux >= rect.x - 1 &&
      ux < rect.x + rect.w + 1 &&
      uy >= rect.y - 1 &&
      uy < rect.y + rect.h + 1;

    const insideReal =
      ux >= rect.x &&
      ux < rect.x + rect.w &&
      uy >= rect.y &&
      uy < rect.y + rect.h;

    return insideExpanded && !insideReal;
  }

  function harvesterMineralStorageSpace() {
    return resourceSpace('minerals');
  }

  function showHarvesterStorageFullToast(unit) {
    if (!unit || unit._storageFullToastShown) return;
    unit._storageFullToastShown = true;
    showToast('Склад сырья заполнен. Построй склад сырья.');
  }

  function setHarvesterStorageFull(unit, reason='storage_full') {
    if (!unit) return;
    unit.path = [];
    unit.target = null;
    unit.manualTarget = null;
    unit.state = 'storage_full';
    unit.actionTimer = 0;
    unit.autoGather = true;
    showHarvesterStorageFullToast(unit);
    harvesterLog('harvester_storage_full', unit, {
      reason,
      cargo: unit.cargo || 0,
      minerals: game.resources.minerals || 0,
      mineralSpace: harvesterMineralStorageSpace()
    });
  }

  function resumeHarvesterFromStorageFull(unit) {
    if (!unit || harvesterMineralStorageSpace() <= 0) return false;

    unit._storageFullToastShown = false;

    if ((unit.cargo || 0) > 0) {
      const base = game.buildings.find(b => b.type === 'hq_base');

      if (isNearRect(unit, base)) {
        unit.state = 'unloading';
        unit.actionTimer = .35;
        harvesterLog('harvester_storage_space_available_unload', unit, {
          cargo: unit.cargo || 0,
          mineralSpace: harvesterMineralStorageSpace()
        });
        return true;
      }

      const basePlan = findBaseReturnPlan(unit);
      if (basePlan.path !== null) {
        unit.path = basePlan.path;
        unit.state = 'returning';
        unit._baseRetryTimer = 0;
        harvesterLog('harvester_storage_space_available_returning', unit, {
          cell: basePlan.cell,
          pathLength: basePlan.path.length,
          cargo: unit.cargo || 0
        });
      } else {
        unit.path = [];
        unit.state = 'waiting_for_base_path';
        unit._baseRetryTimer = 0;
        harvesterLog('harvester_storage_space_available_no_base_path', unit, basePlan);
      }
      return true;
    }

    assignNextMine(unit);
    return true;
  }

  function startHarvester(unit, manualMine=null) {
    unit.autoGather = true;
    unit.manualTarget = manualMine ? manualMine.id : null;
    unit._harvestRetryTimer = 0;
    unit._baseRetryTimer = 0;
    unit._harvestNoPathToastTimer = 0;

    harvesterLog('harvester_start', unit, {
      manualMine: manualMine ? {
        id: manualMine.id,
        type: manualMine.type,
        x: manualMine.x,
        y: manualMine.y,
        remaining: manualMine.remaining
      } : null
    });

    assignNextMine(unit);
  }
  function assignNextMine(unit) {
    cleanupDepletedMinerals();

    if ((unit.cargo || 0) <= 0 && harvesterMineralStorageSpace() <= 0) {
      setHarvesterStorageFull(unit, 'no_mineral_storage_space_before_mining');
      return;
    }

    const plan = findReachableMinePlan(unit);

    if (plan.path !== null && plan.mine) {
      unit.target = plan.mine.id;
      unit.path = plan.path;
      unit.state = 'moving_to_mine';
      unit.autoGather = true;
      unit._harvestRetryTimer = 0;
      unit._blockedTimer = 0;
      unit._stuckTimer = 0;
      unit._lastPos = {x:unit.x, y:unit.y};

      harvesterLog('harvester_path_to_mine', unit, {
        mine:{
          id: plan.mine.id,
          type: plan.mine.type,
          x: plan.mine.x,
          y: plan.mine.y,
          remaining: plan.mine.remaining
        },
        approachCell: plan.cell,
        pathLength: plan.path.length,
        first: plan.path[0] || null,
        last: plan.path[plan.path.length - 1] || null
      });

      return;
    }

    unit.target = null;
    unit.path = [];
    unit.state = 'idle';
    unit.autoGather = true;

    harvesterLog('harvester_no_reachable_mine_retry', unit, {
      failedMines: plan.failedMines || []
    });

    unit._harvestNoPathToastTimer = (unit._harvestNoPathToastTimer || 0) + 1;
    if (unit._harvestNoPathToastTimer <= 1) {
      showToast('Сборщик ждёт путь к минералам');
    }
  }
  function updateHarvester(unit, dt) {
    cleanupDepletedMinerals();

    if (unit.state === 'storage_full') {
      resumeHarvesterFromStorageFull(unit);
      return;
    }

    if (unit.state === 'manual_move') {
      updateUnitMovement(unit, dt);

      if (!unit.path.length) {
        unit.state = 'idle';
        if (unit.autoGather) assignNextMine(unit);
      }

      return;
    }

    if (unit.state === 'idle') {
      if (unit.autoGather) {
        unit._harvestRetryTimer = (unit._harvestRetryTimer || 0) + dt;

        if (unit._harvestRetryTimer >= 1.0) {
          unit._harvestRetryTimer = 0;
          harvesterLog('harvester_idle_retry_mine_search', unit);
          assignNextMine(unit);
        }
      }

      return;
    }

    if (unit.state === 'moving_to_mine') {
      if ((unit.cargo || 0) <= 0 && harvesterMineralStorageSpace() <= 0) {
        setHarvesterStorageFull(unit, 'storage_filled_while_moving_to_mine');
        return;
      }

      const hadPath = !!(unit.path && unit.path.length);
      updateUnitMovement(unit, dt);

      if (!unit.path.length) {
        const mine = game.minerals.find(
          m => m.id === unit.target && (m.infinite || m.remaining > 0)
        );

        if (isNearMine(unit, mine)) {
          unit.state = 'harvesting';
          unit.actionTimer = 1.15;

          harvesterLog('harvester_started_harvesting', unit, {
            mine: mine ? {
              id: mine.id,
              type: mine.type,
              x: mine.x,
              y: mine.y,
              remaining: mine.remaining
            } : null
          });
        } else {
          harvesterLog('harvester_lost_mine_path_retry', unit, {
            hadPath,
            target: unit.target,
            current:{x:Math.round(unit.x), y:Math.round(unit.y)}
          });

          unit.manualTarget = null;
          assignNextMine(unit);
        }
      }

      return;
    }

    if (unit.state === 'harvesting') {
      if ((unit.cargo || 0) <= 0 && harvesterMineralStorageSpace() <= 0) {
        setHarvesterStorageFull(unit, 'storage_filled_before_harvest_complete');
        return;
      }

      unit.actionTimer -= dt;

      if (unit.actionTimer <= 0) {
        const mine = game.minerals.find(m => m.id === unit.target);

        if (mine && (mine.infinite || mine.remaining > 0)) {
          unit.cargo = MINE_TYPES[mine.type].yield;

          if (!mine.infinite) mine.remaining -= 1;

          harvesterLog('harvester_collected', unit, {
            mine:{
              id: mine.id,
              type: mine.type,
              x: mine.x,
              y: mine.y,
              remaining: mine.remaining
            },
            cargo: unit.cargo
          });

          cleanupDepletedMinerals();
        } else {
          harvesterLog('harvester_target_mine_missing', unit, {
            target: unit.target
          });
        }

        const basePlan = findBaseReturnPlan(unit);

        if (basePlan.path !== null) {
          unit.path = basePlan.path;
          unit.state = 'returning';
          unit._baseRetryTimer = 0;

          harvesterLog('harvester_path_to_base', unit, {
            cell: basePlan.cell,
            pathLength: basePlan.path.length
          });
        } else {
          unit.path = [];
          unit.state = 'waiting_for_base_path';
          unit._baseRetryTimer = 0;

          harvesterLog('harvester_no_path_to_base', unit, basePlan);
          showToast('Сборщик ждёт путь к базе');
        }
      }

      return;
    }

    if (unit.state === 'returning') {
      updateUnitMovement(unit, dt);

      if (!unit.path.length) {
        const base = game.buildings.find(b => b.type === 'hq_base');

        if (isNearRect(unit, base)) {
          unit.state = 'unloading';
          unit.actionTimer = .65;

          harvesterLog('harvester_started_unloading', unit);
        } else {
          unit.state = 'waiting_for_base_path';
          unit._baseRetryTimer = 0;

          harvesterLog('harvester_return_path_ended_not_near_base', unit, {
            base: base ? {x:base.x,y:base.y,w:base.w,h:base.h} : null
          });
        }
      }

      return;
    }

    if (unit.state === 'waiting_for_base_path') {
      unit._baseRetryTimer = (unit._baseRetryTimer || 0) + dt;

      if (unit._baseRetryTimer >= 1.0) {
        unit._baseRetryTimer = 0;

        const basePlan = findBaseReturnPlan(unit);

        if (basePlan.path !== null) {
          unit.path = basePlan.path;
          unit.state = 'returning';

          harvesterLog('harvester_recovered_path_to_base', unit, {
            cell: basePlan.cell,
            pathLength: basePlan.path.length
          });
        } else {
          harvesterLog('harvester_still_no_path_to_base', unit, basePlan);
        }
      }

      return;
    }

    if (unit.state === 'unloading') {
      unit.actionTimer -= dt;

      if (unit.actionTimer <= 0) {
        if (unit.cargo) {
          const cargoBeforeUnload = unit.cargo || 0;
          const accepted = addResource('minerals', cargoBeforeUnload);

          if (accepted > 0) {
            unit.cargo = Math.max(0, cargoBeforeUnload - accepted);

            harvesterLog('harvester_unloaded', unit, {
              minerals: accepted,
              cargoRemaining: unit.cargo,
              mineralSpace: harvesterMineralStorageSpace()
            });
          } else {
            harvesterLog('harvester_unload_blocked_storage_full', unit, {
              cargo: unit.cargo || 0,
              mineralSpace: harvesterMineralStorageSpace()
            });
          }

          if ((unit.cargo || 0) > 0) {
            setHarvesterStorageFull(unit, 'cargo_remaining_after_unload_attempt');
            return;
          }
        }

        unit.manualTarget = null;
        unit._storageFullToastShown = false;
        assignNextMine(unit);
      }

      return;
    }
  }

  // ============================================================
  // Builder
  // ============================================================

// V04_FULL_BUILDER_DEBUG_START

// Тяжёлый debug выключен по умолчанию, чтобы не фризить движение.
// Если нужно снова собрать лог: поставь true и обнови игру.
window.FE_DEBUG_LOG_ENABLED = false;

const DEBUG_LOG_KEY = 'four_elements_debug_log_v04_full';

  function safeCloneForLog(value, depth=0) {
    if (depth > 5) return '[max_depth]';
    if (value === null || value === undefined) return value;
    if (typeof value !== 'object') return value;

    if (Array.isArray(value)) {
      return value.slice(0, 80).map(v => safeCloneForLog(v, depth + 1));
    }

    const out = {};
    for (const k of Object.keys(value).slice(0, 80)) {
      const v = value[k];
      if (typeof v === 'function') continue;
      out[k] = safeCloneForLog(v, depth + 1);
    }

    return out;
  }

  function getDebugLog() {
    try {
      return JSON.parse(localStorage.getItem(DEBUG_LOG_KEY) || '[]');
    } catch {
      return [];
    }
  }

  function saveDebugLog(log) {
    try {
      localStorage.setItem(DEBUG_LOG_KEY, JSON.stringify(log.slice(-2000), null, 2));
    } catch (e) {
      console.warn('[FE_DEBUG] cannot save debug log', e);
    }
  }

function debugLog(event, payload={}) {
  if (!window.FE_DEBUG_LOG_ENABLED) return;

  const item = {
      ts: new Date().toISOString(),
      t: Math.round(performance.now()),
      event,
      payload: safeCloneForLog(payload),
      game: game ? {
        mode: game.mode,
        faction: game.faction,
        mapSize: game.mapSize,
        resources: safeCloneForLog(game.resources),
        camera: safeCloneForLog(game.camera),
        buildings: game.buildings?.length,
        units: game.units?.length,
        minerals: game.minerals?.length
      } : null
    };

    const log = getDebugLog();
    log.push(item);
    saveDebugLog(log);

    if (
      event.includes('error') ||
      event.includes('failed') ||
      event.includes('blocked') ||
      event.includes('stuck') ||
      event.includes('refund') ||
      event.includes('cancel') ||
      event.includes('no_progress')
    ) {
      console.warn('[FE_DEBUG]', event, payload);
    }
  }

  function exportDebugLog() {
    const log = getDebugLog();
    const blob = new Blob([JSON.stringify(log, null, 2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'four_elements_debug_log.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 500);
  }

  function clearDebugLog() {
    localStorage.removeItem(DEBUG_LOG_KEY);
    console.warn('[FE_DEBUG] log cleared');
  }

  function unitGridPos(unit) {
    return {
      x: Math.round(unit?.x ?? 0),
      y: Math.round(unit?.y ?? 0)
    };
  }

  function gridDist(a,b) {
    return Math.abs((a?.x ?? 0) - (b?.x ?? 0)) + Math.abs((a?.y ?? 0) - (b?.y ?? 0));
  }

  function changeResource(resource, delta) {
    if (!game.resources) game.resources = {};

    const aliases = {
      raw: 'minerals',
      rawMinerals: 'minerals',
      mineral: 'minerals',
      minerals: 'minerals',
      energy: 'energy'
    };

    const key = aliases[resource] || resource;

    if (typeof addResource === 'function') {
      addResource(key, delta);
      return;
    }

    if (typeof game.resources[key] !== 'number') {
      game.resources[key] = 0;
    }

    game.resources[key] += delta;
  }

  function getBuildCost(type) {
    const def = BUILDINGS[type] || {};
    const cost = {};

    // В текущей v0.4 здания строятся за энергию.
    if (typeof def.cost === 'number') {
      cost.energy = def.cost;
    }

    if (typeof def.costEnergy === 'number') cost.energy = def.costEnergy;
    if (typeof def.energy === 'number') cost.energy = def.energy;
    if (typeof def.energyCost === 'number') cost.energy = def.energyCost;

    if (typeof def.minerals === 'number') cost.minerals = def.minerals;
    if (typeof def.mineralCost === 'number') cost.minerals = def.mineralCost;

    if (def.cost && typeof def.cost === 'object') {
      for (const [k, v] of Object.entries(def.cost)) {
        if (typeof v === 'number') cost[k] = v;
      }
    }

    return cost;
  }

  function canAffordBuild(type) {
    const cost = getBuildCost(type);

    for (const [resource, amount] of Object.entries(cost)) {
      const have = game.resources?.[resource] || 0;

      if (have < amount) {
        return {
          ok:false,
          resource,
          amount,
          have,
          cost
        };
      }
    }

    return {ok:true, cost};
  }

  function spendBuildCost(type) {
    const check = canAffordBuild(type);

    if (!check.ok) {
      debugLog('build_cost_spend_failed_not_enough_resource', {
        type,
        check
      });
      return check;
    }

    for (const [resource, amount] of Object.entries(check.cost)) {
      if (!amount) continue;
      changeResource(resource, -amount);
    }

    debugLog('resources_spent_for_build', {
      type,
      cost: check.cost,
      resourcesAfter: safeCloneForLog(game.resources)
    });

    return check;
  }

  function refundBuildCost(unit, reason, extra={}) {
    if (!unit) return false;

    if (unit._buildRefunded) {
      debugLog('build_refund_skipped_already_refunded', {
        reason,
        unit: getBuilderDebugSnapshot(unit),
        extra
      });
      return false;
    }

    const reserved = unit._reservedBuildCost;

    if (!reserved || !reserved.cost) {
      debugLog('build_refund_skipped_no_reserved_cost', {
        reason,
        unit: getBuilderDebugSnapshot(unit),
        extra
      });
      return false;
    }

    for (const [resource, amount] of Object.entries(reserved.cost)) {
      if (!amount) continue;
      changeResource(resource, amount);
    }

    unit._buildRefunded = true;
    unit._reservedBuildCost = null;

    debugLog('build_cost_refunded', {
      reason,
      reserved,
      unit: getBuilderDebugSnapshot(unit),
      resourcesAfter: safeCloneForLog(game.resources),
      extra
    });

    return true;
  }

  function diagnoseCell(x, y, ignoreUnitId=null) {
    const info = {x,y};

    try {
      info.inBounds = typeof inBounds === 'function' ? inBounds(x,y) : null;

      if (info.inBounds === false) {
        info.reason = 'out_of_bounds';
        return info;
      }

      info.obstacleBlocked = typeof isObstacleBlocked === 'function' ? !!isObstacleBlocked(x,y) : null;
      if (info.obstacleBlocked) info.reason = 'obstacle';

      info.mine = typeof mineAt === 'function' ? !!mineAt(x,y) : null;
      if (info.mine) info.reason = 'mine';

      info.building = typeof buildingAt === 'function' ? safeCloneForLog(buildingAt(x,y)) : null;
      if (info.building) info.reason = 'building';

      info.softBlock = typeof buildingSoftBlockAt === 'function' ? safeCloneForLog(buildingSoftBlockAt(x,y)) : null;
      if (info.softBlock) info.reason = 'building_soft_block';

      info.unit = typeof unitAt === 'function' ? safeCloneForLog(unitAt(x,y,ignoreUnitId)) : null;
      if (info.unit) info.reason = 'unit';

      info.passable = typeof passable === 'function' ? !!passable(x,y,ignoreUnitId) : null;

      if (info.passable && !info.reason) info.reason = 'passable';
      if (!info.passable && !info.reason) info.reason = 'unknown_block';
    } catch (e) {
      info.error = String(e?.message || e);
      info.reason = 'diagnose_error';
    }

    return info;
  }

  function diagnoseAroundCell(x, y, ignoreUnitId=null) {
    return [
      diagnoseCell(x, y, ignoreUnitId),
      diagnoseCell(x + 1, y, ignoreUnitId),
      diagnoseCell(x - 1, y, ignoreUnitId),
      diagnoseCell(x, y + 1, ignoreUnitId),
      diagnoseCell(x, y - 1, ignoreUnitId),
      diagnoseCell(x + 1, y + 1, ignoreUnitId),
      diagnoseCell(x - 1, y - 1, ignoreUnitId),
      diagnoseCell(x + 1, y - 1, ignoreUnitId),
      diagnoseCell(x - 1, y + 1, ignoreUnitId)
    ];
  }

  function rectAdjacentCellsRaw(x,y,w,h) {
    const cells = [];

    for (let xx=x-1; xx<=x+w; xx++) {
      cells.push({x:xx, y:y-1});
      cells.push({x:xx, y:y+h});
    }

    for (let yy=y; yy<y+h; yy++) {
      cells.push({x:x-1, y:yy});
      cells.push({x:x+w, y:yy});
    }

    const seen = new Set();

    return cells.filter(c => {
      const key = c.x + ',' + c.y;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function diagnoseRectAdjacent(x,y,w,h,ignoreUnitId=null) {
    return rectAdjacentCellsRaw(x,y,w,h).map(c => diagnoseCell(c.x,c.y,ignoreUnitId));
  }

  function diagnoseFootprint(x,y,w,h,ignoreUnitId=null) {
    const rows = [];

    for (let yy=y; yy<y+h; yy++) {
      const row = [];
      for (let xx=x; xx<x+w; xx++) {
        row.push(diagnoseCell(xx,yy,ignoreUnitId));
      }
      rows.push(row);
    }

    return rows;
  }

  function isUnitAdjacentToRect(unit, x, y, w, h) {
    const up = unitGridPos(unit);

    return rectAdjacentCellsRaw(x,y,w,h).some(c => c.x === up.x && c.y === up.y);
  }

  function nearestBuildAccessCells(unit, x, y, w, h) {
    const u = unitGridPos(unit);

    return rectAdjacentCellsRaw(x,y,w,h)
      .filter(c => passable(c.x, c.y, unit.id) || (c.x === u.x && c.y === u.y))
      .sort((a,b) => gridDist(u,a) - gridDist(u,b));
  }

  function normalizePath(path, unit) {
    if (!Array.isArray(path)) return null;

    const clean = path.slice();
    const u = unitGridPos(unit);

    while (
      clean.length &&
      Math.round(clean[0].x) === u.x &&
      Math.round(clean[0].y) === u.y
    ) {
      clean.shift();
    }

    return clean;
  }

  function pathToAccessCell(unit, cell) {
    const raw = findPath(unit, cell, unit.id);

    if (raw === null || raw === undefined) {
      return null;
    }

    const clean = normalizePath(raw, unit);

    if (clean && clean.length === 0) {
      const u = unitGridPos(unit);

      if (u.x === cell.x && u.y === cell.y) {
        return [];
      }

      return null;
    }

    return clean;
  }

  function getBuilderDebugSnapshot(unit) {
    if (!unit) return null;

    const grid = unitGridPos(unit);
    const target = unit.path && unit.path.length ? unit.path[0] : null;
    const order = unit.buildOrder || null;

    let buildFootprint = null;
    let buildAdjacent = null;

    if (order?.spot && order?.type) {
      const [bw,bh] = BUILDING_SIZE[order.type] || [2,2];
      buildFootprint = diagnoseFootprint(order.spot.x, order.spot.y, bw, bh, unit.id);
      buildAdjacent = diagnoseRectAdjacent(order.spot.x, order.spot.y, bw, bh, unit.id);
    }

    return {
      id: unit.id,
      type: unit.type,
      state: unit.state,
      x: unit.x,
      y: unit.y,
      grid,
      hp: unit.hp,
      maxHp: unit.maxHp,
      pathLength: unit.path?.length || 0,
      nextPathCell: target ? safeCloneForLog(target) : null,
      nextPathCellDiagnosis: target ? diagnoseCell(Math.round(target.x), Math.round(target.y), unit.id) : null,
      buildOrder: safeCloneForLog(order),
      currentBuilding: unit.currentBuilding || null,
      reservedBuildCost: safeCloneForLog(unit._reservedBuildCost),
      buildRefunded: !!unit._buildRefunded,
      timers: {
        buildMoveTimer: unit._buildMoveTimer || 0,
        buildStuckTimer: unit._buildStuckTimer || 0,
        buildNoProgressTimer: unit._buildNoProgressTimer || 0,
        debugStateTimer: unit._debugStateTimer || 0
      },
      currentCellDiagnosis: diagnoseCell(grid.x, grid.y, unit.id),
      aroundCurrentCell: diagnoseAroundCell(grid.x, grid.y, unit.id),
      buildFootprint,
      buildAdjacent
    };
  }

function logBuilderState(unit, reason='tick') {
  if (!window.FE_DEBUG_LOG_ENABLED) return;

  debugLog('builder_state_tick', {
    reason,
    builder: getBuilderDebugSnapshot(unit)
  });
}

  function cancelBuildOrder(unit, reason, extra={}) {
    if (!unit) return;

    refundBuildCost(unit, reason, extra);

    debugLog('build_order_cancelled', {
      reason,
      builder: getBuilderDebugSnapshot(unit),
      extra
    });

    unit.path = [];
    unit.buildOrder = null;
    unit.currentBuilding = null;
    unit.state = 'idle';
    unit._buildMoveTimer = 0;
    unit._buildStuckTimer = 0;
    unit._buildNoProgressTimer = 0;
    unit._buildLastDist = null;
    unit._buildLastX = unit.x;
    unit._buildLastY = unit.y;

    if (typeof showToast === 'function') {
      showToast('Строитель не смог начать строительство — ресурсы возвращены');
    }
  }


  // FE_BUILDER_CONSTRUCTION_CANCEL_RESUME_PATCH_START
  function builderConstructionCancelResumeEnabled() {
    return window.FE_BUILDER_CONSTRUCTION_CANCEL_RESUME_ENABLED !== false;
  }

  function builderConstructionRefundRate() {
    const v = Number(window.FE_BUILDER_CONSTRUCTION_CANCEL_REFUND_RATE);
    return Number.isFinite(v) ? clamp(v, 0, 1) : 0.75;
  }

  function isUnfinishedConstruction(b) {
    return !!(b && b.kind === 'building' && !b.complete && (b.progress || 0) < 1);
  }

  function buildCostForBuilding(b) {
    const src = b?.buildCost || b?._buildCost || getBuildCost(b?.type);
    const cost = {};

    if (src && typeof src === 'object') {
      for (const [resource, amount] of Object.entries(src)) {
        if (typeof amount === 'number' && amount > 0) cost[resource] = amount;
      }
    }

    return cost;
  }

  function refundCostByRate(cost, rate, reason, extra={}) {
    const refunded = {};

    for (const [resource, amount] of Object.entries(cost || {})) {
      if (!amount) continue;
      const refund = Math.max(0, Math.floor(amount * rate));
      if (!refund) continue;
      changeResource(resource, refund);
      refunded[resource] = refund;
    }

    debugLog('construction_partial_refund', {
      reason,
      rate,
      cost:safeCloneForLog(cost),
      refunded:safeCloneForLog(refunded),
      resourcesAfter:safeCloneForLog(game.resources),
      extra
    });

    return refunded;
  }

  function clearBuilderConstructionRefs(buildingId) {
    for (const u of game.units || []) {
      if (!u || u.type !== 'builder') continue;

      const linkedByCurrent = u.currentBuilding === buildingId;
      const linkedByOrder = u.buildOrder?.existingBuildingId === buildingId;

      if (!linkedByCurrent && !linkedByOrder) continue;

      u.path = [];
      u.buildOrder = null;
      u.currentBuilding = null;
      u.state = 'idle';
      u._queuedManualMove = null;
      u._reservedBuildCost = null;
      u._buildRefunded = true;
      u._buildMoveTimer = 0;
      u._buildStuckTimer = 0;
      u._buildNoProgressTimer = 0;
    }
  }

  function cancelUnfinishedConstruction(building, reason='cancel_unfinished_construction', actor=null) {
    if (!builderConstructionCancelResumeEnabled()) return false;
    if (!isUnfinishedConstruction(building)) return false;

    const rate = builderConstructionRefundRate();
    const cost = buildCostForBuilding(building);
    const refunded = refundCostByRate(cost, rate, reason, {
      building:safeCloneForLog(building),
      actor:safeCloneForLog(actor)
    });

    const idx = game.buildings.findIndex(b => b.id === building.id);
    if (idx >= 0) game.buildings.splice(idx, 1);

    clearBuilderConstructionRefs(building.id);

    if (selected?.id === building.id) {
      selected = null;
      updateSelectedInfo();
    }

    hideMenus();
    showToast('Строительство отменено. Возвращено 75% стоимости');

    debugLog('unfinished_construction_cancelled', {
      reason,
      building:safeCloneForLog(building),
      cost:safeCloneForLog(cost),
      refunded:safeCloneForLog(refunded),
      actor:safeCloneForLog(actor)
    });

    return true;
  }

  function cancelBuilderBuildCommand(unit, reason='builder_build_cancelled') {
    if (!builderConstructionCancelResumeEnabled()) return false;
    if (!unit || unit.kind !== 'unit' || unit.type !== 'builder') return false;

    if (unit.state === 'building' && unit.currentBuilding) {
      const building = game.buildings.find(b => b.id === unit.currentBuilding);
      if (building && isUnfinishedConstruction(building)) {
        return cancelUnfinishedConstruction(building, reason, unit);
      }
    }

    if (unit.state === 'moving_to_build' && unit.buildOrder) {
      const rate = builderConstructionRefundRate();
      const cost = unit._reservedBuildCost?.cost || getBuildCost(unit.buildOrder.type);
      refundCostByRate(cost, rate, reason, {
        builder:getBuilderDebugSnapshot(unit),
        buildOrder:safeCloneForLog(unit.buildOrder)
      });

      unit.path = [];
      unit.buildOrder = null;
      unit.currentBuilding = null;
      unit.state = 'idle';
      unit._queuedManualMove = null;
      unit._reservedBuildCost = null;
      unit._buildRefunded = true;
      unit._buildMoveTimer = 0;
      unit._buildStuckTimer = 0;
      unit._buildNoProgressTimer = 0;

      hideMenus();
      showToast('Строительство отменено. Возвращено 75% стоимости');

      debugLog('builder_pending_build_cancelled', {
        reason,
        builder:getBuilderDebugSnapshot(unit),
        cost:safeCloneForLog(cost)
      });

      return true;
    }

    return false;
  }

  function resumeBuilderConstruction(unit, building) {
    if (!builderConstructionCancelResumeEnabled()) return false;
    if (!unit || unit.kind !== 'unit' || unit.type !== 'builder') return false;
    if (!isUnfinishedConstruction(building)) return false;

    if (unit.state === 'moving_to_build' || unit.state === 'building') {
      showToast('Строитель уже занят');
      return true;
    }

    const accessCells = nearestBuildAccessCells(unit, building.x, building.y, building.w, building.h);

    for (const cell of accessCells) {
      const path = pathToAccessCell(unit, cell);
      if (path === null) continue;

      unit.path = path;
      unit.buildOrder = {
        type: building.type,
        spot:{x:building.x, y:building.y},
        accessCell:{x:cell.x, y:cell.y},
        existingBuildingId:building.id,
        resume:true,
        createdAt:performance.now()
      };
      unit.currentBuilding = null;
      unit.state = 'moving_to_build';
      unit._reservedBuildCost = null;
      unit._buildRefunded = true;
      unit._buildMoveTimer = 0;
      unit._buildStuckTimer = 0;
      unit._buildNoProgressTimer = 0;
      unit._queuedManualMove = null;

      hideMenus();
      showToast(`Строитель едет достраивать: ${BUILDINGS[building.type]?.name || building.type}`);

      debugLog('builder_resume_construction_assigned', {
        builder:getBuilderDebugSnapshot(unit),
        building:safeCloneForLog(building),
        accessCell:safeCloneForLog(cell),
        path:safeCloneForLog(path)
      });

      return true;
    }

    showToast('Строитель не может доехать до недостроенного объекта');
    debugLog('builder_resume_construction_failed_no_path', {
      builder:getBuilderDebugSnapshot(unit),
      building:safeCloneForLog(building),
      accessCells:safeCloneForLog(accessCells)
    });
    return true;
  }
  // FE_BUILDER_CONSTRUCTION_CANCEL_RESUME_PATCH_END

  function installFullDebugLoggerOnce() {
    if (window.__fourElementsFullDebugInstalled) return;
    window.__fourElementsFullDebugInstalled = true;

    window.addEventListener('error', (e) => {
      debugLog('window_error', {
        message: e.message,
        filename: e.filename,
        lineno: e.lineno,
        colno: e.colno,
        stack: e.error?.stack
      });
    });

    window.addEventListener('unhandledrejection', (e) => {
      debugLog('unhandled_rejection', {
        reason: String(e.reason?.message || e.reason),
        stack: e.reason?.stack
      });
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'F9') {
        e.preventDefault();
        exportDebugLog();
      }

      if (e.key === 'F10') {
        e.preventDefault();
        clearDebugLog();
      }
    });

    let lastSelectedId = null;
    let lastResourcesJson = '';
setInterval(() => {
  try {
    if (!window.FE_DEBUG_LOG_ENABLED) return;
    if (!game || !game.units) return;

        const currentSelected = typeof selected !== 'undefined' ? selected : null;
        const selectedId = currentSelected?.id || null;

        if (selectedId !== lastSelectedId) {
          lastSelectedId = selectedId;

          debugLog('selected_changed', {
            selected: safeCloneForLog(currentSelected),
            selectedBuilderSnapshot: currentSelected?.type === 'builder'
              ? getBuilderDebugSnapshot(currentSelected)
              : null
          });
        }

        const resourcesJson = JSON.stringify(game.resources || {});
        if (resourcesJson !== lastResourcesJson) {
          debugLog('resources_changed_tick', {
            before: lastResourcesJson ? JSON.parse(lastResourcesJson) : null,
            after: safeCloneForLog(game.resources)
          });
          lastResourcesJson = resourcesJson;
        }

        for (const u of game.units) {
          if (u.type !== 'builder') continue;

          const isSelected = selectedId === u.id;
          const isActive = u.state && u.state !== 'idle';

          if (isSelected || isActive) {
            logBuilderState(u, isSelected ? 'selected_or_active_1s' : 'active_1s');
          }
        }
      } catch (e) {
        console.warn('[FE_DEBUG] interval logger failed', e);
      }
    }, 1000);

    debugLog('full_debug_logger_installed', {
      controls: {
        F9: 'download four_elements_debug_log.json',
        F10: 'clear log'
      },
      logs: [
        'selected_changed',
        'resources_changed_tick',
        'build_button_pressed',
        'resources_spent_for_build',
        'build_plan_created',
        'build_order_assigned',
        'builder_state_tick',
        'builder_started_construction',
        'build_cost_refunded',
        'build_order_cancelled',
        'path_not_found',
        'blocked_cells'
      ]
    });
  }

  installFullDebugLoggerOnce();

  // V04_FULL_BUILDER_DEBUG_END


  function orderBuild(unit, buildingType) {
    debugLog('build_button_pressed', {
      unit: getBuilderDebugSnapshot(unit),
      buildingType,
      resourcesBefore: safeCloneForLog(game.resources),
      buildingDef: safeCloneForLog(BUILDINGS[buildingType])
    });

    const def = BUILDINGS[buildingType];

    if (!def || !unit || unit.type !== 'builder') {
      debugLog('build_order_rejected_invalid_input', {
        unit: safeCloneForLog(unit),
        buildingType,
        def: safeCloneForLog(def)
      });
      return;
    }

    if (!isBuildTypeVisibleInMenu(buildingType)) {
      showToast('Это здание скрыто в v0.4');
      debugLog('build_order_rejected_hidden_v04_building', {
        unit: safeCloneForLog(unit),
        buildingType,
        def: safeCloneForLog(def)
      });
      return;
    }

    if (unit.state === 'moving_to_build' || unit.state === 'building') {
      showToast('Строитель уже занят');
      debugLog('build_order_rejected_builder_busy', {
        builder: getBuilderDebugSnapshot(unit),
        buildingType
      });
      return;
    }

    const afford = canAffordBuild(buildingType);

    debugLog('build_afford_check', {
      buildingType,
      afford,
      resources: safeCloneForLog(game.resources)
    });

    if (!afford.ok) {
      showToast(`Не хватает ресурса: ${afford.resource} ${afford.have}/${afford.amount}`);
      debugLog('build_order_rejected_not_enough_resource', {
        buildingType,
        afford
      });
      return;
    }

    const plan = findBuildPlan(unit, buildingType);

    if (!plan || !plan.spot || !Array.isArray(plan.path)) {
      showToast('Строитель не нашёл место для постройки');
      debugLog('build_order_failed_no_plan', {
        builder: getBuilderDebugSnapshot(unit),
        buildingType,
        plan: safeCloneForLog(plan)
      });
      return;
    }

    debugLog('build_plan_accepted_before_spend', {
      builder: getBuilderDebugSnapshot(unit),
      buildingType,
      plan: safeCloneForLog(plan)
    });

    const spent = spendBuildCost(buildingType);

    if (!spent.ok) {
      showToast(`Не хватает ресурса: ${spent.resource} ${spent.have}/${spent.amount}`);
      debugLog('build_order_failed_spend_cost', {
        builder: getBuilderDebugSnapshot(unit),
        buildingType,
        spent
      });
      return;
    }

    unit._reservedBuildCost = {
      type: buildingType,
      cost: spent.cost,
      createdAt: performance.now(),
      resourcesAfterSpend: safeCloneForLog(game.resources)
    };

    unit._buildRefunded = false;

    unit.buildOrder = {
      type: buildingType,
      spot: plan.spot,
      accessCell: plan.accessCell || null,
      createdAt: performance.now()
    };

    unit.path = plan.path || [];
    unit.state = 'moving_to_build';
    unit._buildMoveTimer = 0;
    unit._buildStuckTimer = 0;
    unit._buildNoProgressTimer = 0;
    unit._buildLastX = unit.x;
    unit._buildLastY = unit.y;
    unit._buildLastDist = null;
    unit._debugStateTimer = 0;

    hideMenus();
    showToast(`Строитель едет строить: ${def.name}`);

    debugLog('build_order_assigned', {
      builder: getBuilderDebugSnapshot(unit),
      buildingType,
      spot: plan.spot,
      accessCell: plan.accessCell,
      path: safeCloneForLog(unit.path),
      pathLength: unit.path.length,
      reservedBuildCost: safeCloneForLog(unit._reservedBuildCost)
    });
  }



  function findBuildPlan(unit, buildingType) {
    const [bw,bh] = BUILDING_SIZE[buildingType] || [2,2];
    const ux = Math.round(unit.x);
    const uy = Math.round(unit.y);

    debugLog('find_build_plan_started', {
      builder: getBuilderDebugSnapshot(unit),
      buildingType,
      footprint: {w:bw,h:bh},
      origin: {x:ux,y:uy}
    });

    const tested = [];
    const maxRadius = 32;

    for (let r=1; r<=maxRadius; r++) {
      const candidates = [];

      for (let dy=-r; dy<=r; dy++) {
        for (let dx=-r; dx<=r; dx++) {
          if (Math.abs(dx) + Math.abs(dy) !== r) continue;

          const x = ux + dx;
          const y = uy + dy;
          const canPlace = canPlaceBuilding(x,y,bw,bh);

          if (!canPlace) {
            if (tested.length < 200) {
              tested.push({
                radius:r,
                spot:{x,y},
                canPlace:false,
                footprint: diagnoseFootprint(x,y,bw,bh,unit.id)
              });
            }
            continue;
          }

          candidates.push({
            x,
            y,
            score: Math.abs(dx) + Math.abs(dy)
          });
        }
      }

      candidates.sort((a,b) => a.score - b.score);

      debugLog('find_build_plan_radius_checked', {
        buildingType,
        radius:r,
        candidatesCount:candidates.length,
        firstCandidates:candidates.slice(0, 10)
      });

      for (const spot of candidates) {
        const accessCells = nearestBuildAccessCells(unit, spot.x, spot.y, bw, bh);

        const testedSpot = {
          radius:r,
          spot:{x:spot.x,y:spot.y},
          canPlace:true,
          accessCells: accessCells.map(c => diagnoseCell(c.x,c.y,unit.id)).slice(0, 20)
        };

        for (const cell of accessCells) {
          const path = pathToAccessCell(unit, cell);

          testedSpot.pathAttempts = testedSpot.pathAttempts || [];
          testedSpot.pathAttempts.push({
            accessCell:cell,
            pathLength:path ? path.length : null,
            pathFound:path !== null,
            cellDiagnosis:diagnoseCell(cell.x,cell.y,unit.id)
          });

          if (path !== null) {
            const plan = {
              spot:{x:spot.x,y:spot.y},
              accessCell:{x:cell.x,y:cell.y},
              path
            };

            debugLog('build_plan_created', {
              builder: getBuilderDebugSnapshot(unit),
              type: buildingType,
              radius:r,
              spot: plan.spot,
              accessCell: plan.accessCell,
              path: safeCloneForLog(path),
              pathLength: path.length,
              alreadyAdjacent: path.length === 0,
              testedSpot
            });

            return plan;
          }
        }

        tested.push(testedSpot);
      }
    }

    debugLog('build_plan_failed', {
      builder: getBuilderDebugSnapshot(unit),
      buildingType,
      footprint:{w:bw,h:bh},
      tested:tested.slice(-120),
      aroundUnit:diagnoseAroundCell(ux,uy,unit.id)
    });

    return null;
  }



  function canPlaceBuilding(x,y,w,h) {
    // Footprint must be clean.
    for (let yy=y; yy<y+h; yy++) for (let xx=x; xx<x+w; xx++) {
      if (!inBounds(xx,yy)) return false;
      if (isObstacleBlocked(xx,yy)) return false;
      if (mineAt(xx,yy)) return false;
      if (buildingAt(xx,yy)) return false;
      if (buildingSoftBlockAt(xx,yy)) return false;
      if (unitAt(xx,yy)) return false;
    }

    // Минимальный зазор 1 клетка между зданиями.
    for (let yy=y-1; yy<y+h+1; yy++) for (let xx=x-1; xx<x+w+1; xx++) {
      if (!inBounds(xx,yy)) continue;
      if (buildingAt(xx,yy)) return false;
    }

    return true;
  }

  function updateBuilder(unit, dt) {
    unit._debugStateTimer = (unit._debugStateTimer || 0) + dt;

    if (unit._debugStateTimer >= 1) {
      unit._debugStateTimer = 0;

      if (unit.type === 'builder' && (unit.state !== 'idle' || selected?.id === unit.id)) {
        logBuilderState(unit, 'updateBuilder_1s');
      }
    }

    if (unit.state === 'manual_move') {
      const before = getBuilderDebugSnapshot(unit);

      updateUnitMovement(unit, dt);

      if (!unit.path.length) {
        unit.state='idle';

        debugLog('builder_manual_move_finished', {
          before,
          after:getBuilderDebugSnapshot(unit)
        });
      }

      return;
    }

    if (unit.state === 'moving_to_build') {
      if (!unit.buildOrder) {
        cancelBuildOrder(unit, 'moving_to_build_without_build_order');
        return;
      }

      const {type, spot} = unit.buildOrder;
      const [bw,bh] = BUILDING_SIZE[type] || [2,2];

      const beforeX = unit.x;
      const beforeY = unit.y;
      const beforeSnapshot = getBuilderDebugSnapshot(unit);

      const beforeDist = unit.buildOrder.accessCell
        ? gridDist(unit, unit.buildOrder.accessCell)
        : gridDist(unit, spot);

      updateUnitMovement(unit, dt);

      const moved = Math.abs(unit.x - beforeX) + Math.abs(unit.y - beforeY);

      const afterDist = unit.buildOrder?.accessCell
        ? gridDist(unit, unit.buildOrder.accessCell)
        : gridDist(unit, spot);

      unit._buildMoveTimer = (unit._buildMoveTimer || 0) + dt;

      if (unit.path && unit.path.length) {
        if (moved < 0.0005) {
          unit._buildStuckTimer = (unit._buildStuckTimer || 0) + dt;
        } else {
          unit._buildStuckTimer = 0;
        }

        if (afterDist >= beforeDist - 0.001) {
          unit._buildNoProgressTimer = (unit._buildNoProgressTimer || 0) + dt;
        } else {
          unit._buildNoProgressTimer = 0;
        }
      }

      if ((unit._buildStuckTimer || 0) > 1.2 || (unit._buildNoProgressTimer || 0) > 2.0) {
        cancelBuildOrder(unit, 'builder_stuck_or_no_progress', {
          before:beforeSnapshot,
          after:getBuilderDebugSnapshot(unit),
          moved,
          beforeDist,
          afterDist,
          pathLength:unit.path?.length || 0,
          accessCell:safeCloneForLog(unit.buildOrder?.accessCell),
          nextPathCell:unit.path?.[0] || null,
          nextPathCellDiagnosis:unit.path?.[0]
            ? diagnoseCell(Math.round(unit.path[0].x), Math.round(unit.path[0].y), unit.id)
            : null
        });
        return;
      }

      if (!unit.path.length) {
        const adjacent = isUnitAdjacentToRect(unit, spot.x, spot.y, bw, bh);

        debugLog('builder_path_finished_check', {
          builder:getBuilderDebugSnapshot(unit),
          adjacent,
          spot,
          footprint:{w:bw,h:bh},
          adjacentCells:diagnoseRectAdjacent(spot.x,spot.y,bw,bh,unit.id)
        });

        if (!adjacent) {
          const replan = findBuildPlan(unit, type);

          if (replan && Array.isArray(replan.path)) {
            unit.buildOrder.spot = replan.spot;
            unit.buildOrder.accessCell = replan.accessCell || null;
            unit.path = replan.path;
            unit._buildStuckTimer = 0;
            unit._buildNoProgressTimer = 0;

            debugLog('builder_replanned_after_wrong_position', {
              oldSpot:spot,
              newSpot:replan.spot,
              accessCell:replan.accessCell,
              path:safeCloneForLog(replan.path),
              builder:getBuilderDebugSnapshot(unit)
            });

            return;
          }

          cancelBuildOrder(unit, 'path_finished_but_builder_not_adjacent', {
            builder:getBuilderDebugSnapshot(unit),
            spot,
            footprint:{w:bw,h:bh},
            adjacentCells:diagnoseRectAdjacent(spot.x,spot.y,bw,bh,unit.id)
          });
          return;
        }

        if (unit.buildOrder?.existingBuildingId) {
          const existing = game.buildings.find(b =>
            b.id === unit.buildOrder.existingBuildingId &&
            b.type === type &&
            isUnfinishedConstruction(b)
          );

          if (!existing) {
            debugLog('builder_resume_existing_building_missing', {
              builder:getBuilderDebugSnapshot(unit),
              buildOrder:safeCloneForLog(unit.buildOrder)
            });
            unit.path = [];
            unit.buildOrder = null;
            unit.currentBuilding = null;
            unit.state = 'idle';
            showToast('Недостроенное здание не найдено');
            return;
          }

          unit.currentBuilding = existing.id;
          unit.state = 'building';
          unit._buildStuckTimer = 0;
          unit._buildNoProgressTimer = 0;

          debugLog('builder_resumed_existing_construction', {
            builder:getBuilderDebugSnapshot(unit),
            building:safeCloneForLog(existing)
          });

          showToast(`Достраиваю: ${BUILDINGS[type]?.name || type}`);
          return;
        }

        if (!canPlaceBuilding(spot.x, spot.y, bw, bh)) {
          const replan = findBuildPlan(unit, type);

          if (replan && Array.isArray(replan.path)) {
            unit.buildOrder.spot = replan.spot;
            unit.buildOrder.accessCell = replan.accessCell || null;
            unit.path = replan.path;
            unit._buildStuckTimer = 0;
            unit._buildNoProgressTimer = 0;

            debugLog('builder_replanned_after_spot_blocked', {
              oldSpot:spot,
              newSpot:replan.spot,
              accessCell:replan.accessCell,
              path:safeCloneForLog(replan.path),
              builder:getBuilderDebugSnapshot(unit)
            });

            return;
          }

          cancelBuildOrder(unit, 'build_spot_blocked_before_start', {
            builder:getBuilderDebugSnapshot(unit),
            spot,
            footprint:{w:bw,h:bh},
            footprintDiagnosis:diagnoseFootprint(spot.x,spot.y,bw,bh,unit.id),
            adjacentCells:diagnoseRectAdjacent(spot.x,spot.y,bw,bh,unit.id)
          });
          return;
        }

        const b = createBuilding(type, spot.x, spot.y, false);
        b.buildCost = Object.assign({}, unit._reservedBuildCost?.cost || getBuildCost(type));
        b.buildStartedAt = performance.now();
        game.buildings.push(b);

        unit.currentBuilding = b.id;
        unit.state = 'building';
        unit._reservedBuildCost = null;
        unit._buildRefunded = false;
        unit._buildStuckTimer = 0;
        unit._buildNoProgressTimer = 0;

        debugLog('builder_started_construction', {
          builder:getBuilderDebugSnapshot(unit),
          building:safeCloneForLog(b),
          spot,
          accessCell:safeCloneForLog(unit.buildOrder?.accessCell)
        });

        showToast(`Строительство: ${BUILDINGS[type].name}`);
      }

      return;
    }

    if (unit.state === 'building') {
      const b = game.buildings.find(x => x.id === unit.currentBuilding);

      if (!b) {
        debugLog('builder_building_missing', {
          builder:getBuilderDebugSnapshot(unit),
          currentBuilding:unit.currentBuilding
        });

        unit.state = 'idle';
        unit.buildOrder = null;
        unit.currentBuilding = null;
        return;
      }

      const speed = FACTIONS[game.faction].buildSpeed || 1;
      b.progress += dt / b.buildTime * speed;

      if (b.progress >= 1) {
        b.progress = 1;
        b.complete = true;
        unit.state = 'idle';
        unit.buildOrder = null;
        unit.currentBuilding = null;

        debugLog('builder_finished_construction', {
          builder:getBuilderDebugSnapshot(unit),
          building:safeCloneForLog(b)
        });

        showToast(`Построено: ${BUILDINGS[b.type].name}`);
      }
    }
  }
  // ============================================================
  // Territory / fog
  // ============================================================
  function claimTerritoryCell(x,y, instant=false) {
    if (!inBounds(x,y)) return false;
    const cell = game.territory[y][x];
    if (cell.owner && cell.owner !== game.faction) return false;
    if (cell.owner === game.faction && cell.progress >= 1) return false;
    cell.owner = game.faction;
    cell.progress = instant ? 1 : .28;
    return true;
  }

  function hasOwnedNeighbor(x,y) {
    const dirs=[[1,0],[-1,0],[0,1],[0,-1]];
    return dirs.some(([dx,dy])=>{
      const nx=x+dx, ny=y+dy;
      return inBounds(nx,ny) && game.territory[ny][nx].owner===game.faction && game.territory[ny][nx].progress>=1;
    });
  }

  function territoryBuildingRadius() {
    const raw = Number(window.FE_TERRITORY_BUILDING_RADIUS);
    if (!Number.isFinite(raw)) return 5;
    return Math.max(0, Math.floor(raw));
  }

  function nextTerritoryCellForBuilding(b) {
    const under=[];
    for (let y=b.y; y<b.y+b.h; y++) for (let x=b.x; x<b.x+b.w; x++) {
      if (!inBounds(x,y)) continue;
      const t=game.territory[y][x];
      if (!(t.owner===game.faction && t.progress>=1)) under.push({x,y});
    }
    if (under.length) return under[0];

    const cx = Math.floor(b.x + b.w/2);
    const cy = Math.floor(b.y + b.h/2);
    const radius = territoryBuildingRadius();
    const candidates=[];
    for (let y=cy-radius; y<=cy+radius; y++) {
      for (let x=cx-radius; x<=cx+radius; x++) {
        if (!inBounds(x,y)) continue;
        const d = Math.abs(x-cx) + Math.abs(y-cy);
        if (d>radius) continue;
        const t=game.territory[y][x];
        if (t.owner===game.faction && t.progress>=1) continue;
        if (t.owner && t.owner!==game.faction) continue;
        if (!hasOwnedNeighbor(x,y)) continue;
        candidates.push({x,y,d});
      }
    }
    candidates.sort((a,b)=>a.d-b.d || a.y-b.y || a.x-b.x);
    return candidates[0] || null;
  }

  function updateTerritory(dt) {
    // Smooth reveal for newly claimed cells.
    for (let y=0;y<game.mapH;y++) for (let x=0;x<game.mapW;x++) {
      const t=game.territory[y][x];
      if (t.owner===game.faction && t.progress<1) t.progress = clamp(t.progress + dt*.45, 0, 1);
    }

    // v0.4: каждая постройка красит только одну новую клетку за шаг.
    // 2x2 здание: примерно 4 клетки за 60 секунд.
    for (const b of game.buildings) {
      if (!b.complete) continue;
      b._territoryTimer = (b._territoryTimer || 0) + dt;
      if (b._territoryTimer < 15) continue;
      b._territoryTimer = 0;
      const next = nextTerritoryCellForBuilding(b);
      if (next) claimTerritoryCell(next.x,next.y,false);
    }
  }
  function reveal(cx,cy,radius) {
    for (let y=Math.floor(cy-radius); y<=Math.ceil(cy+radius); y++) {
      for (let x=Math.floor(cx-radius); x<=Math.ceil(cx+radius); x++) {
        if (!inBounds(x,y)) continue;
        if (Math.abs(x-cx)+Math.abs(y-cy) <= radius) {
          game.fogVisible[y][x]=true;
          game.fogExplored[y][x]=true;
        }
      }
    }
  }
  function updateFog() {
    for (let y=0;y<game.mapH;y++) for (let x=0;x<game.mapW;x++) game.fogVisible[y][x]=false;
    for (const u of game.units) {
      const r = u.type === 'harvester' ? 5 : 4;
      reveal(Math.round(u.x), Math.round(u.y), r);
    }
    for (const b of game.buildings) if (b.complete) reveal(b.x+Math.floor(b.w/2), b.y+Math.floor(b.h/2), 6);
    const territoryRadius = 1 + (FACTIONS[game.faction].territoryViewBonus || 0);
    for (let y=0;y<game.mapH;y++) for (let x=0;x<game.mapW;x++) {
      const t=game.territory[y][x];
      if (t.owner===game.faction && t.progress>=1) reveal(x,y,territoryRadius);
    }
  }

  // ============================================================
  // Save / load
  // ============================================================
  function saveGame() {
    window.FE_SAVE_MANAGER.save({ game, SAVE_KEY, FACTIONS });
  }
  function loadGame() {
    return window.FE_SAVE_MANAGER.load({
      SAVE_KEY,
      blankGame,
      loadAssets,
      setGame: value => { game = value; },
      setSelected: value => { selected = value; },
      updateFog,
      updateHud,
      hideMenus,
      hideScreens,
      showToast
    });
  }
  function renderSaveMenu() {
    window.FE_SAVE_MANAGER.renderSaveMenu({
      saveSlotBox,
      SAVE_KEY,
      MAP_SIZES,
      formatTime,
      loadGame
    });
  }

  // ============================================================
  // Rendering
  // ============================================================
  function resize() {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width = window.innerWidth+'px';
    canvas.style.height = window.innerHeight+'px';
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  const { imageReady, getAlphaBounds, getSolidSprite } = window.FE_SPRITE_ALPHA;

  function drawImageCoverTile(im, p, w, h, alpha=1) {
    if (!imageReady(im)) return false;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(im, p.x - w/2, p.y, w, h);
    ctx.restore();
    return true;
  }


  function drawDiamond(p,w,h,fill,stroke,alpha=1) {
    ctx.save(); ctx.globalAlpha=alpha;
    ctx.beginPath();
    ctx.moveTo(p.x,p.y);
    ctx.lineTo(p.x+w/2,p.y+h/2);
    ctx.lineTo(p.x,p.y+h);
    ctx.lineTo(p.x-w/2,p.y+h/2);
    ctx.closePath();
    ctx.fillStyle=fill; ctx.fill();
    if (stroke) { ctx.strokeStyle=stroke; ctx.lineWidth=1; ctx.stroke(); }
    ctx.restore();
  }
  function drawSandTile(x,y) {
    const p=tileToScreen(x,y); const z=game.camera.zoom;
    const w=TILE_W*z, h=TILE_H*z;
    if (p.x<-w || p.x>canvas.clientWidth+w || p.y<-h || p.y>canvas.clientHeight+h) return;

    const shade=game.terrain[y][x].shade;
    const seed=(x*928371+y*1237)%997;

    let tile = assets.tiles.sand || assets.tiles.sand_default;
    if (shade < -0.32 && imageReady(assets.tiles.sand_dark)) tile = assets.tiles.sand_dark;
    if (shade > 0.38 && imageReady(assets.tiles.sand_light)) tile = assets.tiles.sand_light;
    if (!imageReady(tile) && imageReady(assets.tiles.sand_default)) tile = assets.tiles.sand_default;

    if (drawImageCoverTile(tile, p, w, h, 1)) {
      // очень мягкая сетка поверх PNG, чтобы карта не выглядела шахматкой
      ctx.save();
      ctx.globalAlpha = .12;
      ctx.strokeStyle = 'rgba(75,48,22,.45)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(p.x,p.y);
      ctx.lineTo(p.x+w/2,p.y+h/2);
      ctx.lineTo(p.x,p.y+h);
      ctx.lineTo(p.x-w/2,p.y+h/2);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
      return;
    }

    // fallback, если PNG не найден
    const v = Math.round(clamp(210 + shade*18, 185, 235));
    const fill = `rgb(${v+12},${Math.round(v*.82)},${Math.round(v*.48)})`;
    drawDiamond(p,w,h,fill,'rgba(109,72,33,.13)');

    if (z>.65) {
      if (seed%5===0) {
        ctx.save();
        ctx.globalAlpha=.11;
        ctx.fillStyle='#fff1bd';
        ctx.beginPath();
        ctx.ellipse(p.x+((seed%9)-4)*z*4, p.y+h/2+((seed%7)-3)*z*2, 10*z, 4*z, 0,0,Math.PI*2);
        ctx.fill();
        ctx.restore();
      }
      if (seed%7===0) {
        ctx.fillStyle='rgba(110,76,38,.18)';
        ctx.fillRect(p.x+((seed%11)-5)*z*3, p.y+h/2+((seed%6)-3)*z*2, Math.max(1,z*1.3), Math.max(1,z*1.3));
      }
    }
  }
  function drawTerritoryTile(x,y,t) {
    if (!t.owner || t.progress < .22) return;
    const p=tileToScreen(x,y); const z=game.camera.zoom;
    const w=TILE_W*z, h=TILE_H*z;
    const f=clamp((t.progress-.22)/.78,0,1);
    const plateKey = FACTIONS[t.owner]?.plate;
    const plate = assets.tiles[plateKey];

    if (imageReady(plate)) {
      drawImageCoverTile(plate, {x:p.x, y:p.y+1*z}, w, h, .12 + .82*f);
      return;
    }

    // fallback, если PNG территории не найден
    const color=FACTIONS[t.owner].color;
    ctx.save();
    ctx.globalAlpha=.12 + .58*f;
    drawDiamond({x:p.x,y:p.y+1*z}, w, h, color, 'rgba(31,38,25,.32)', 1);
    ctx.restore();
  }
  function drawTile(x,y) {
    drawSandTile(x,y);
    drawTerritoryTile(x,y, game.territory[y][x]);
  }
  function drawIsoShadow(p, groundY, size, opts, z) {
    // v0.4: динамические canvas-тени отключены.
    // Тени вернём позже через PNG-shadow или alpha-mask, не через ellipse.
    return;
  }



  function usableImage(im) {
    return !!(im && im.complete && im.naturalWidth && im.naturalHeight);
  }

  function drawSprite(im, tx, ty, size, opts={}) {
    const p = tileToScreen(tx, ty);
    const z = game.camera.zoom;

let w = size[0] * z;
let h = size[1] * z;

if (opts.preserveAspect && im && im.complete && im.naturalWidth && im.naturalHeight) {
  h = size[0] * (im.naturalHeight / im.naturalWidth) * z;
}

    const groundFactor = opts.groundFactor ?? 1.00;
    const groundOffset = opts.groundOffset || 0;

    // Старая рабочая посадка:
    // центр footprint + TILE_H * groundFactor + groundOffset.
    const bottomY = p.y + TILE_H * z * groundFactor + groundOffset * z;

    const drawX = p.x + (opts.screenOffsetX || 0) * z;
    const drawY = bottomY + (opts.screenOffsetY || 0) * z;

    ctx.save();
    ctx.globalAlpha = opts.alpha ?? 1;
    ctx.translate(drawX, drawY);

    if (opts.angle) ctx.rotate(opts.angle);
    if (opts.flip) ctx.scale(-1, 1);

    const anchorX = opts.anchorX ?? 0.5;
    const anchorY = opts.anchorY ?? 1.0;

    if (im && im.complete && im.naturalWidth) {
      ctx.drawImage(im, -w * anchorX, -h * anchorY, w, h);
    } else {
      ctx.fillStyle = '#ddd';
      ctx.fillRect(-w * anchorX, -h * anchorY, w, h);
    }

    ctx.restore();
  }

  function isVisible(x, y) {
    if (!game) return false;

    const xx = Math.round(x);
    const yy = Math.round(y);

    // FE_DEV_FULL_MAP_REVEAL_RENDER_FILTER_PATCH_START
    // Dev reveal must affect object render filters, not only the fog overlay.
    if (typeof devFullMapRevealActive === 'function' && devFullMapRevealActive()) {
      return inBounds(xx, yy);
    }
    // FE_DEV_FULL_MAP_REVEAL_RENDER_FILTER_PATCH_END

    if (!game.fogVisible) return false;

    return (
      inBounds(xx, yy) &&
      !!game.fogVisible[yy] &&
      !!game.fogVisible[yy][xx]
    );
  }

  function footprintVisible(o) {
    if (!game || !o) return false;

    const w = o.w || 1;
    const h = o.h || 1;

    // FE_DEV_FULL_MAP_REVEAL_RENDER_FILTER_PATCH_START
    // In dev full-map reveal, buildings/obstacles are considered visible if their
    // footprint touches the map bounds, even when fogVisible cells are false.
    if (typeof devFullMapRevealActive === 'function' && devFullMapRevealActive()) {
      for (let yy = o.y; yy < o.y + h; yy++) {
        for (let xx = o.x; xx < o.x + w; xx++) {
          if (inBounds(xx, yy)) return true;
        }
      }
      return false;
    }
    // FE_DEV_FULL_MAP_REVEAL_RENDER_FILTER_PATCH_END

    if (!game.fogVisible) return false;

    for (let yy = o.y; yy < o.y + h; yy++) {
      for (let xx = o.x; xx < o.x + w; xx++) {
        if (
          inBounds(xx, yy) &&
          game.fogVisible[yy] &&
          game.fogVisible[yy][xx]
        ) {
          return true;
        }
      }
    }

    return false;
  }

  // V04_RENDER_HELPERS_FIX_END


  function drawMine(m) {
    if (!m.infinite && m.remaining <= 0) return;
    if (!isVisible(m.x, m.y)) return;

    const def = MINE_TYPES[m.type];
    const im = assets.environment[def.asset];

    const profile = spriteProfile('minerals', m.type, {
      size: def.size,
      groundFactor: 1.02,
      groundOffset: 0,
      labelOffset: -22,
      alphaCutoff: 105
    });

    drawSprite(im, m.x, m.y, profile.size, {
      groundFactor: profile.groundFactor,
      groundOffset: profile.groundOffset,
      screenOffsetX: profile.screenOffsetX || 0,
      screenOffsetY: profile.screenOffsetY || 0,
      alphaCutoff: profile.alphaCutoff,
      anchorX: profile.anchorX ?? 0.5,
      anchorY: profile.anchorY ?? 1.0
    });

    if (!m.infinite && game.camera.zoom > .75) {
      const p = tileToScreen(m.x, m.y);
      ctx.fillStyle = 'rgba(41,23,7,.72)';
      ctx.font = `${Math.round(12 * game.camera.zoom)}px Arial`;
      ctx.textAlign = 'center';
      ctx.fillText(String(m.remaining), p.x, p.y + profile.labelOffset * game.camera.zoom);
    }

    window.FE_RENDER_DEBUG?.mine?.(m, profile);
  }


  function drawObstacle(o) {
    if (!footprintVisible(o)) return;

    const fallback = OBSTACLE_ASSETS[o.asset] || {size:[80,80]};
    const profile = spriteProfile('obstacles', o.asset, {
      size: fallback.size || [80,80],
      groundFactor: 1.02,
      groundOffset: 0,
      alphaCutoff: 115
    });

    const im = assets.environment[o.asset];
const fp = Array.isArray(profile.footprint) ? profile.footprint : [o.w || 1, o.h || 1];
const fw = Math.max(1, Math.round(fp[0] || 1));
const fh = Math.max(1, Math.round(fp[1] || 1));
const anchorTileOffsetX = profile.anchorTileOffsetX ?? 0;
const anchorTileOffsetY = profile.anchorTileOffsetY ?? 0;

const cx = o.x + fw / 2 - .5 + anchorTileOffsetX;
const cy = o.y + fh / 2 - .5 + anchorTileOffsetY;

    drawSprite(im, cx, cy, profile.size, {
      groundFactor: profile.groundFactor,
      groundOffset: profile.groundOffset,
      screenOffsetX: profile.screenOffsetX || 0,
      screenOffsetY: profile.screenOffsetY || 0,
      alphaCutoff: profile.alphaCutoff,
      anchorX: profile.anchorX ?? 0.5,
      anchorY: profile.anchorY ?? 1.0
    });

    window.FE_RENDER_DEBUG?.obstacle?.(o, profile);
  }



  // V04_DRAW_HP_FIX_START
  function drawHp(tx, ty, hp, maxHp, color='#60e870', yOff=-42) {
    if (!game || !ctx) return;

    const p = tileToScreen(tx, ty);
    const z = game.camera.zoom || 1;

    const ratio = clamp((hp || 0) / Math.max(1, maxHp || 1), 0, 1);

    const w = 58 * z;
    const h = 7 * z;
    const y = p.y + yOff * z;

    ctx.save();

    ctx.fillStyle = 'rgba(0,0,0,.55)';
    ctx.fillRect(p.x - w / 2, y, w, h);

    ctx.fillStyle = color;
    ctx.fillRect(p.x - w / 2, y, w * ratio, h);

    ctx.restore();
  }
  // V04_DRAW_HP_FIX_END


  // V04_BUILDING_FOOTPRINT_DEBUG_START
  function drawBuildingFootprintDebug(b) {
    if (!window.FE_SHOW_BUILDING_FOOTPRINTS) return;
    if (!b) return;

    const z = game.camera.zoom;
    const w = TILE_W * z;
    const h = TILE_H * z;

    ctx.save();

    // Розовые клетки = реальный footprint здания.
    for (let yy = b.y; yy < b.y + b.h; yy++) {
      for (let xx = b.x; xx < b.x + b.w; xx++) {
        const p = tileToScreen(xx, yy);

        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + w / 2, p.y + h / 2);
        ctx.lineTo(p.x, p.y + h);
        ctx.lineTo(p.x - w / 2, p.y + h / 2);
        ctx.closePath();

        ctx.fillStyle = 'rgba(255, 0, 180, 0.20)';
        ctx.fill();

        ctx.strokeStyle = 'rgba(255, 0, 180, 0.95)';
        ctx.lineWidth = Math.max(1, 2 * z);
        ctx.stroke();
      }
    }

    // Та же точка, которую использует drawBuilding -> drawSprite.
    const cx = b.x + b.w / 2 - .5;
    const cy = b.y + b.h / 2 - .5;
    const p = tileToScreen(cx, cy);

    const profile = spriteProfile('buildings', b.type, {
      size:[128,128],
      groundFactor:1.00,
      groundOffset:14,
      screenOffsetX:0,
      screenOffsetY:0,
      alphaCutoff:125,
      hpOffset:-72
    });

    const anchorX = p.x + (profile.screenOffsetX || 0) * z;
    const anchorY =
      p.y +
      TILE_H * z * (profile.groundFactor ?? 1.00) +
      (profile.groundOffset || 0) * z +
      (profile.screenOffsetY || 0) * z;

    // Красная точка = нижний центр спрайта.
    ctx.fillStyle = 'red';
    ctx.beginPath();
    ctx.arc(anchorX, anchorY, Math.max(4, 5 * z), 0, Math.PI * 2);
    ctx.fill();

    // Жёлтая рамка = bbox спрайта по profile.size.
const sw = profile.size[0] * z;
let sh = profile.size[1] * z;

const im = assets.buildings[b.type] || assets.buildings.hq_base;
if (im && im.complete && im.naturalWidth && im.naturalHeight) {
  sh = profile.size[0] * (im.naturalHeight / im.naturalWidth) * z;
}

    const spriteAnchorX = profile.anchorX ?? 0.5;
    const spriteAnchorY = profile.anchorY ?? 1.0;

    ctx.strokeStyle = 'rgba(255, 220, 0, 0.9)';
    ctx.lineWidth = Math.max(1, 1.5 * z);
    ctx.strokeRect(anchorX - sw * spriteAnchorX, anchorY - sh * spriteAnchorY, sw, sh);

    ctx.restore();
  }
  // V04_BUILDING_FOOTPRINT_DEBUG_END


  function drawBuilding(b) {
    if (!footprintVisible(b)) return;

    if (typeof drawBuildingFootprintDebug === 'function') {
      drawBuildingFootprintDebug(b);
    }

    const cx = b.x + b.w / 2 - .5;
    const cy = b.y + b.h / 2 - .5;

    const profile = spriteProfile('buildings', b.type, {
      size: [128,128],
      groundFactor: 1.00,
      groundOffset: 14,
      alphaCutoff: 125,
      hpOffset: -72
    });

    const im = assets.buildings[b.type] || assets.buildings.hq_base;

drawSprite(im, cx, cy, profile.size, {
  alpha: b.complete ? 1 : .58,
  groundFactor: profile.groundFactor,
  groundOffset: profile.groundOffset,
  screenOffsetX: profile.screenOffsetX || 0,
  screenOffsetY: profile.screenOffsetY || 0,
  alphaCutoff: profile.alphaCutoff,
  anchorX: profile.anchorX ?? 0.5,
  anchorY: profile.anchorY ?? 1.0,
  preserveAspect: true
});

    if (!b.complete) {
      const p = tileToScreen(cx, cy);
      const z = game.camera.zoom;

      ctx.fillStyle = 'rgba(40,22,5,.88)';
      ctx.fillRect(p.x - 34*z, p.y - 54*z, 68*z, 9*z);

      ctx.fillStyle = '#ffd35b';
      ctx.fillRect(p.x - 34*z, p.y - 54*z, 68*z*b.progress, 9*z);
    }

    drawHp(cx, cy, b.hp, b.maxHp, '#60e870', profile.hpOffset);

    window.FE_RENDER_DEBUG?.building?.(b, profile);
  }

function unitIsMovingForAnim(u) {
  return !!(u.path && u.path.length);
}

function unitDir8(u, dirMap) {
  const next = u.path && u.path.length ? u.path[0] : null;

  if (!next) {
    return u._renderDir ?? 0;
  }

  const nx = Math.round(next.x);
  const ny = Math.round(next.y);
  const targetKey = `${nx},${ny}`;

  // Фиксируем направление на весь текущий сегмент пути.
  // Пока юнит едет к одной и той же next-клетке,
  // sprite direction не пересчитывается каждый кадр.
  if (u._dirTargetKey !== targetKey) {
    const ux = Math.round(u.x);
    const uy = Math.round(u.y);

    let dx = nx - ux;
    let dy = ny - uy;

    if (dx === 0 && dy === 0) {
      return u._renderDir ?? 0;
    }

    // Движение сейчас 4-направленное, оставляем только одну ось.
    if (Math.abs(dx) >= Math.abs(dy)) {
      dx = Math.sign(dx);
      dy = 0;
    } else {
      dx = 0;
      dy = Math.sign(dy);
    }

    u._dirTargetKey = targetKey;
    u._dirDx = dx;
    u._dirDy = dy;
  }

  const dx = u._dirDx || 0;
  const dy = u._dirDy || 0;

  if (dx === 0 && dy === 0) {
    return u._renderDir ?? 0;
  }

  const sx = dx - dy;
  const sy = dx + dy;
  const angle = Math.atan2(sy, sx);

  const rawDir = (Math.round(angle / (Math.PI / 4)) + 8) % 8;
  u._rawDir = rawDir;

  const forceDir = u.type === 'harvester'
    ? window.FE_HARVESTER_FORCE_DIR
    : (u.type === 'builder' ? window.FE_BUILDER_FORCE_DIR : null);

  if (forceDir !== null && forceDir !== undefined) {
    const forced = Number(forceDir);
    if (!Number.isNaN(forced)) {
      const dir = ((forced % 8) + 8) % 8;
      u._renderDir = dir;
      return dir;
    }
  }

  const map = dirMap || [0,1,2,3,4,5,6,7];
  const dir = map[rawDir] ?? rawDir;

  u._renderDir = dir;
  return dir;
}
  function unitAngle(u) {
    if (u.facing==='north') return -0.05;
    if (u.facing==='south') return 0.05;
    return 0;
  }
  function unitFlip(u) {
    return u.facing==='west' || u.facing==='north';
  }
  function drawUnit(u) {
    if (!isVisible(Math.round(u.x), Math.round(u.y))) return;

    const z = game.camera.zoom;
    const rx = u.x;
    const ry = u.y;
    const p = tileToScreen(rx, ry);

    const profile = spriteProfile('units', u.type, {
      size:[42,42],
      groundFactor:1.05,
      groundOffset:0,
      hpOffset:-10,
      alphaCutoff:135
    });

const unitDirectionalAnims = assets.unitAnimations || {};
const directionalAnim = unitDirectionalAnims[u.type] || null;

let unitImage = usableImage(assets.units[u.type]) ? assets.units[u.type] : assets.unitFallbacks?.[u.type];
let moving = false;
let dir = 0;
let frame = 0;

let dirOffset = { x:0, y:0 };

if (directionalAnim) {
  moving = unitIsMovingForAnim(u);
  const dirMap = u.type === 'harvester'
    ? window.FE_HARVESTER_DIR_MAP
    : u.type === 'light_tank'
      ? window.FE_LIGHT_TANK_DIR_MAP
      : window.FE_BUILDER_DIR_MAP;
  dir = unitDir8(u, dirMap);

  const useMoveFrames = u.type === 'builder' && window.FE_BUILDER_USE_MOVE_FRAMES === true;

  frame = moving && useMoveFrames
    ? Math.floor(performance.now() / 120) % 4
    : 0;

  const directionalImage = moving && useMoveFrames
    ? directionalAnim?.[dir]?.move?.[frame]
    : directionalAnim?.[dir]?.idle?.[0];

  if (usableImage(directionalImage)) {
    unitImage = directionalImage;
  }

  const dirOffsets = u.type === 'builder'
    ? window.FE_BUILDER_DIR_OFFSETS
    : u.type === 'harvester'
      ? window.FE_HARVESTER_DIR_OFFSETS
      : u.type === 'light_tank'
        ? window.FE_LIGHT_TANK_DIR_OFFSETS
        : null;
  const targetOffset = dirOffsets?.[dir] || { x:0, y:0 };

  // Плавное визуальное сглаживание offset-а при смене направления.
  // Логическая позиция юнита не меняется.
  const now = performance.now();
  const last = u._visualOffsetLastTime || now;
  const dtVisual = Math.min(0.05, (now - last) / 1000);
  u._visualOffsetLastTime = now;

  if (u._visualOffsetX === undefined) u._visualOffsetX = targetOffset.x;
  if (u._visualOffsetY === undefined) u._visualOffsetY = targetOffset.y;

  const smoothSpeed = 14; // больше = быстрее догоняет, меньше = мягче
  const k = Math.min(1, dtVisual * smoothSpeed);

  u._visualOffsetX += (targetOffset.x - u._visualOffsetX) * k;
  u._visualOffsetY += (targetOffset.y - u._visualOffsetY) * k;

  dirOffset = {
    x: u._visualOffsetX,
    y: u._visualOffsetY
  };
}

drawSprite(unitImage, rx, ry, profile.size, {
  flip: directionalAnim ? false : unitFlip(u),
  angle: directionalAnim ? 0 : unitAngle(u),
  groundFactor: profile.groundFactor,
  groundOffset: profile.groundOffset,
  screenOffsetX: (profile.screenOffsetX || 0) + dirOffset.x,
  screenOffsetY: (profile.screenOffsetY || 0) + dirOffset.y,
  alphaCutoff: profile.alphaCutoff,
  anchorX: profile.anchorX ?? 0.5,
  anchorY: profile.anchorY ?? 1.0
});
const anchorScreenX =
  p.x +
  ((profile.screenOffsetX || 0) + dirOffset.x) * z;

const anchorScreenY =
  p.y +
  TILE_H * z * (profile.groundFactor ?? 1.0) +
  (profile.groundOffset || 0) * z +
  ((profile.screenOffsetY || 0) + dirOffset.y) * z;

    const hpW = 34 * z;
    const hpH = 5 * z;
    const unitAnchorY = profile.anchorY ?? 1.0;
    const hpY = u.type === 'builder'
      ? anchorScreenY - 48 * z
      : u.type === 'harvester'
        ? anchorScreenY - 64 * z
        : anchorScreenY - profile.size[1] * z * unitAnchorY + profile.hpOffset * z;

    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.58)';
    ctx.fillRect(anchorScreenX - hpW / 2, hpY, hpW, hpH);
    ctx.fillStyle = selected?.id === u.id ? '#fff08a' : '#60e870';
    ctx.fillRect(anchorScreenX - hpW / 2, hpY, hpW * clamp(u.hp / u.maxHp, 0, 1), hpH);
    ctx.restore();

    // V04_UNIT_FOOTPRINT_DEBUG_START
    if (window.FE_SHOW_UNIT_FOOTPRINTS) {
      const w = TILE_W * z;
      const h = TILE_H * z;
const gridX = Math.round(u.x);
const gridY = Math.round(u.y);
const gp = tileToScreen(gridX, gridY);

// Голубой ромб = ближайшая реальная клетка карты.
ctx.beginPath();
ctx.moveTo(gp.x, gp.y);
ctx.lineTo(gp.x + w / 2, gp.y + h / 2);
ctx.lineTo(gp.x, gp.y + h);
ctx.lineTo(gp.x - w / 2, gp.y + h / 2);
ctx.closePath();

ctx.fillStyle = 'rgba(0, 180, 255, 0.10)';
ctx.fill();

ctx.strokeStyle = 'rgba(0, 180, 255, 0.95)';
ctx.lineWidth = Math.max(1, 2 * z);
ctx.stroke();
      ctx.save();

      // Розовый ромб = логическая клетка юнита.
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + w / 2, p.y + h / 2);
      ctx.lineTo(p.x, p.y + h);
      ctx.lineTo(p.x - w / 2, p.y + h / 2);
      ctx.closePath();

      ctx.fillStyle = 'rgba(255, 0, 180, 0.18)';
      ctx.fill();

      ctx.strokeStyle = 'rgba(255, 0, 180, 0.95)';
      ctx.lineWidth = Math.max(1, 2 * z);
      ctx.stroke();

      // Красная точка = реальная точка посадки спрайта.
      ctx.fillStyle = 'red';
      ctx.beginPath();
      ctx.arc(anchorScreenX, anchorScreenY, Math.max(4, 5 * z), 0, Math.PI * 2);
      ctx.fill();

      // Жёлтая рамка = bbox спрайта.
      const sw = profile.size[0] * z;
      const sh = profile.size[1] * z;
      const spriteAnchorX = profile.anchorX ?? 0.5;
      const spriteAnchorY = profile.anchorY ?? 1.0;

      ctx.strokeStyle = 'rgba(255, 220, 0, 0.9)';
      ctx.lineWidth = Math.max(1, 1.5 * z);
      ctx.strokeRect(
        anchorScreenX - sw * spriteAnchorX,
        anchorScreenY - sh * spriteAnchorY,
        sw,
        sh
      );

      ctx.restore();
    }
    // V04_UNIT_FOOTPRINT_DEBUG_END

if (window.FE_EXTERNAL_RENDER_DEBUG_ENABLED) {
  window.FE_RENDER_DEBUG?.unit?.(u, profile);
}
}



  // FE_DEV_FULL_MAP_REVEAL_PATCH_START
  function devFullMapRevealActive() {
    return window.FE_DEV_FULL_MAP_REVEAL_ENABLED === true &&
      window.FE_DEV_FULL_MAP_REVEAL_ACTIVE === true;
  }
  // FE_DEV_FULL_MAP_REVEAL_PATCH_END

  function drawFogTile(x,y) {
    if (devFullMapRevealActive()) return;
    if (game.fogVisible[y][x]) return;
    const p=tileToScreen(x,y); const z=game.camera.zoom;
    const w=TILE_W*z, h=TILE_H*z;
    const explored=game.fogExplored[y][x];
    drawDiamond(p,w,h, explored?'rgba(22,14,8,.47)':'rgba(5,4,3,.86)', null, 1);
  }

  // FE_BUILDER_DUST_PATCH_START
  function builderDustEnabled() {
    return window.FE_BUILDER_DUST_ENABLED !== false;
  }

  function unitMovedDistance(unit, beforeX, beforeY) {
    return Math.abs(unit.x - beforeX) + Math.abs(unit.y - beforeY);
  }

  function getBuilderDustAnchor(unit) {
    const profile = spriteProfile('units', unit.type, {
      size:[42,42],
      groundFactor:1.05,
      groundOffset:0,
      hpOffset:-10,
      alphaCutoff:135
    });

    return {
      // Same grounding model as drawUnit anchorScreenX / anchorScreenY.
      // Values are stored before zoom; drawDustParticles multiplies by camera zoom.
      baseOffsetX: (profile.screenOffsetX || 0) + (unit._visualOffsetX || 0),
      baseOffsetY:
        TILE_H * (profile.groundFactor ?? 1.0) +
        (profile.groundOffset || 0) +
        (profile.screenOffsetY || 0) +
        (unit._visualOffsetY || 0)
    };
  }

  function spawnBuilderDust(unit, mode='trail', dx=0, dy=0) {
    if (!game || !builderDustEnabled() || !unit || !['builder', 'harvester', 'light_tank'].includes(unit.type)) return;
    if (!game.dustParticles) game.dustParticles = [];

    const burst = mode === 'burst';
    const count = burst
      ? (window.FE_BUILDER_DUST_BURST_COUNT || 9)
      : (window.FE_BUILDER_DUST_TRAIL_COUNT || 3);

    const p0 = tileToScreen(unit.x, unit.y);
    const p1 = tileToScreen(unit.x + dx, unit.y + dy);
    let vxScreen = p1.x - p0.x;
    let vyScreen = p1.y - p0.y;
    const len = Math.hypot(vxScreen, vyScreen) || 1;
    vxScreen /= len;
    vyScreen /= len;

    // Direction vectors in screen space.
    const backX = -vxScreen;
    const backY = -vyScreen;
    const sideX = -vyScreen;
    const sideY = vxScreen;

    const anchor = getBuilderDustAnchor(unit);
    const wheelYOffsetFlag = unit.type === 'harvester'
      ? window.FE_HARVESTER_DUST_WHEEL_Y
      : unit.type === 'light_tank'
        ? window.FE_LIGHT_TANK_DUST_WHEEL_Y
        : window.FE_BUILDER_DUST_WHEEL_Y;
    const defaultWheelYOffset = unit.type === 'harvester' ? -34 : unit.type === 'light_tank' ? -28 : -8;
    const wheelYOffset = Number.isFinite(wheelYOffsetFlag)
      ? wheelYOffsetFlag
      : defaultWheelYOffset;

    const isHarvesterDust = unit.type === 'harvester';
    const isLightTankDust = unit.type === 'light_tank';
    const radiusMultFlag = isHarvesterDust
      ? window.FE_HARVESTER_DUST_RADIUS_MULT
      : isLightTankDust
        ? window.FE_LIGHT_TANK_DUST_RADIUS_MULT
        : 1;
    const alphaMultFlag = isHarvesterDust
      ? window.FE_HARVESTER_DUST_ALPHA_MULT
      : isLightTankDust
        ? window.FE_LIGHT_TANK_DUST_ALPHA_MULT
        : 1;
    const radiusMult = Number.isFinite(radiusMultFlag) ? radiusMultFlag : 1;
    const alphaMult = Number.isFinite(alphaMultFlag) ? alphaMultFlag : 1;
    const dustColor = isHarvesterDust && typeof window.FE_HARVESTER_DUST_COLOR === 'string'
      ? window.FE_HARVESTER_DUST_COLOR
      : isLightTankDust && typeof window.FE_LIGHT_TANK_DUST_COLOR === 'string'
        ? window.FE_LIGHT_TANK_DUST_COLOR
        : '#d9b27a';

    for (let i = 0; i < count; i++) {
      // Two wheel/contact zones around the builder anchor, not a single center cloud.
      const sideSign = Math.random() < 0.5 ? -1 : 1;
      const sideDistance = sideSign * (burst ? (8 + Math.random() * 8) : (6 + Math.random() * 6));
      const backDistance = burst ? (4 + Math.random() * 14) : (2 + Math.random() * 10);
      const jitterX = (Math.random() - 0.5) * (burst ? 5 : 3);
      const jitterY = (Math.random() - 0.5) * (burst ? 4 : 3);

      const push = burst ? (18 + Math.random() * 22) : (9 + Math.random() * 13);
      const sidePush = (Math.random() - 0.5) * (burst ? 16 : 9);
      const up = burst ? (-4 - Math.random() * 7) : (-2 - Math.random() * 5);
      const life = burst ? (0.36 + Math.random() * 0.20) : (0.32 + Math.random() * 0.16);

      const baseRadius = burst ? (3.0 + Math.random() * 3.6) : (2.5 + Math.random() * 2.6);
      const baseAlpha = burst ? (0.32 + Math.random() * 0.20) : (0.24 + Math.random() * 0.16);

      game.dustParticles.push({
        x: unit.x,
        y: unit.y,
        baseOffsetX: anchor.baseOffsetX,
        baseOffsetY: anchor.baseOffsetY,
        ox: backX * backDistance + sideX * sideDistance + jitterX,
        oy: wheelYOffset + backY * backDistance + sideY * sideDistance * 0.22 + jitterY,
        vx: backX * push + sideX * sidePush,
        vy: up + backY * (burst ? 5 : 3) + sideY * sidePush * 0.06,
        r: baseRadius * radiusMult,
        life,
        maxLife: life,
        alpha: Math.min(baseAlpha * alphaMult, 0.72),
        color: dustColor
      });
    }

    const maxDust = window.FE_BUILDER_DUST_MAX_PARTICLES || 80;
    if (game.dustParticles.length > maxDust) {
      game.dustParticles.splice(0, game.dustParticles.length - maxDust);
    }
  }

  function updateBuilderDust(unit, dt, beforeX, beforeY) {
    if (!builderDustEnabled() || !unit || !['builder', 'harvester', 'light_tank'].includes(unit.type)) return;

    const moved = unitMovedDistance(unit, beforeX, beforeY);
    const isMovingNow = moved > 0.0005 && (
      unit.state === 'manual_move' ||
      unit.state === 'moving_to_build' ||
      unit.state === 'moving_to_mine' ||
      unit.state === 'returning' ||
      (unit.path && unit.path.length)
    );

    if (isMovingNow && !unit._dustWasMoving) {
      spawnBuilderDust(unit, 'burst', unit.x - beforeX, unit.y - beforeY);
      unit._dustTrailTimer = 0;
    } else if (isMovingNow) {
      unit._dustTrailTimer = (unit._dustTrailTimer || 0) + dt;
      const trailInterval = Number.isFinite(window.FE_BUILDER_DUST_TRAIL_INTERVAL)
        ? window.FE_BUILDER_DUST_TRAIL_INTERVAL
        : 0.16;
      if (unit._dustTrailTimer >= trailInterval) {
        unit._dustTrailTimer = 0;
        spawnBuilderDust(unit, 'trail', unit.x - beforeX, unit.y - beforeY);
      }
    } else {
      unit._dustTrailTimer = 0;
    }

    unit._dustWasMoving = isMovingNow;
  }

  function updateDustParticles(dt) {
    if (!game?.dustParticles?.length) return;

    for (const d of game.dustParticles) {
      d.life -= dt;
      d.ox += d.vx * dt;
      d.oy += d.vy * dt;
      d.vx *= Math.pow(0.10, dt);
      d.vy += 7 * dt;
      d.r += 6 * dt;
    }

    game.dustParticles = game.dustParticles.filter(d => d.life > 0);
  }

  function drawDustParticles() {
    if (!game?.dustParticles?.length) return;

    const z = game.camera.zoom;
    ctx.save();
    const defaultDustColor = '#d9b27a';

    for (const d of game.dustParticles) {
      const p = tileToScreen(d.x, d.y);
      const t = clamp(d.life / d.maxLife, 0, 1);
      ctx.globalAlpha = d.alpha * t;
      ctx.fillStyle = d.color || defaultDustColor;
      ctx.beginPath();
      ctx.ellipse(
        p.x + ((d.baseOffsetX || 0) + d.ox) * z,
        p.y + ((d.baseOffsetY || 0) + d.oy) * z,
        d.r * z,
        d.r * 0.58 * z,
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }

    ctx.restore();
  }
  // FE_BUILDER_DUST_PATCH_END

  function drawClickMarkers() {
    if (!game.clickMarkers?.length) return;

    for (const m of game.clickMarkers) {
      const p = tileToScreen(m.x, m.y);
      const z = game.camera.zoom;
      const life = clamp(m.life / m.maxLife, 0, 1);
      const isBad = m.type === 'bad';
      const stroke = isBad ? '#ff5546' : '#69ff78';
      const fill = isBad ? 'rgba(255,70,55,.32)' : 'rgba(72,255,102,.30)';
      const size = Number.isFinite(window.FE_UNIT_CLICK_MARKER_SIZE)
        ? window.FE_UNIT_CLICK_MARKER_SIZE
        : Number.isFinite(window.FE_BUILDER_CLICK_MARKER_SIZE)
          ? window.FE_BUILDER_CLICK_MARKER_SIZE
          : .23;

      // Small ground marker, not a full-tile overlay. Centered on clicked tile.
      const pulse = 1 + (1 - life) * .34;
      const cx = p.x;
      const cy = p.y + TILE_H * z * .52;
      const halfW = TILE_W * z * size * pulse;
      const halfH = TILE_H * z * size * .72 * pulse;

      ctx.save();
      ctx.lineJoin = 'round';

      ctx.beginPath();
      ctx.moveTo(cx, cy - halfH);
      ctx.lineTo(cx + halfW, cy);
      ctx.lineTo(cx, cy + halfH);
      ctx.lineTo(cx - halfW, cy);
      ctx.closePath();
      ctx.globalAlpha = (isBad ? .18 : .15) * life;
      ctx.fillStyle = fill;
      ctx.fill();

      ctx.globalAlpha = (isBad ? .78 : .68) * life;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = Math.max(1.5, 2.2 * z);
      ctx.stroke();

      ctx.beginPath();
      ctx.globalAlpha = (isBad ? .30 : .26) * life;
      ctx.fillStyle = stroke;
      ctx.ellipse(cx, cy, Math.max(2.0, 3.7 * z), Math.max(1.0, 1.9 * z), 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  function render() {
    if (!game || game.screen !== 'game') {
      ctx.clearRect(0,0,canvas.clientWidth,canvas.clientHeight);
      return;
    }

    ctx.clearRect(0,0,canvas.clientWidth,canvas.clientHeight);

    ctx.fillStyle = '#2d2715';
    ctx.fillRect(0,0,canvas.clientWidth,canvas.clientHeight);

    for (let y=0; y<game.mapH; y++) {
      for (let x=0; x<game.mapW; x++) {
        drawTile(x,y);
      }
    }

    drawDustParticles();
    drawClickMarkers();

    const objects = [];

    // FE_MINERALS_IN_DEPTH_SORT_PATCH_START
    // Minerals must participate in the same z-sort as units/buildings/obstacles.
    // Otherwise sprite size/order makes far crystals cover near ones, or units cover
    // crystals even when their ground anchor is behind them.
    for (const m of game.minerals) {
      if (m.infinite || m.remaining > 0) {
        objects.push({
          kind:'mine',
          depth: isoObjectDepth('mine', m),
          obj:m
        });
      }
    }
    // FE_MINERALS_IN_DEPTH_SORT_PATCH_END

    for (const o of game.obstacles) {
      objects.push({
        kind:'obs',
        depth: isoObjectDepth('obs', o),
        obj:o
      });
    }

    for (const b of game.buildings) {
      objects.push({
        kind:'building',
        depth: isoObjectDepth('building', b),
        obj:b
      });
    }

    for (const u of game.units) {
      objects.push({
        kind:'unit',
        depth: isoObjectDepth('unit', u),
        obj:u
      });
    }

    objects.sort((a,b) => {
      if (a.depth !== b.depth) return a.depth - b.depth;

      // Same-depth tie-breaker: units can stay on top when truly occupying
      // the same visual depth, but closer ground anchors still win above.
      if (a.kind === 'unit' && b.kind !== 'unit') return 1;
      if (b.kind === 'unit' && a.kind !== 'unit') return -1;
      if (a.kind === 'mine' && b.kind !== 'mine') return -1;
      if (b.kind === 'mine' && a.kind !== 'mine') return 1;

      return 0;
    });

    for (const o of objects) {
      if (o.kind === 'mine') drawMine(o.obj);
      else if (o.kind === 'obs') drawObstacle(o.obj);
      else if (o.kind === 'building') drawBuilding(o.obj);
      else drawUnit(o.obj);
    }

    if (!devFullMapRevealActive()) {
      for (let y=0; y<game.mapH; y++) {
        for (let x=0; x<game.mapW; x++) {
          drawFogTile(x,y);
        }
      }
    }
  }

  // ============================================================
  // UI panels
  // ============================================================
  function hideMenus() {
    contextMenu.style.display='none';
    buildMenu.style.display='none';
    selectedInfo.style.display='none';
  }
  function setContextAt(tileX,tileY,html) {
    const p=tileToScreen(tileX,tileY);
    contextMenu.innerHTML=html;
    contextMenu.style.display='block';
    contextMenu.style.left=clamp(p.x+18,8,canvas.clientWidth-300)+'px';
    contextMenu.style.top=clamp(p.y-40,64,canvas.clientHeight-300)+'px';
  }
  function unitStatus(u) {
    return ({
      idle:'ожидает',
      manual_move:'едет',
      moving_to_mine:'едет к минералам',
      harvesting:'добывает',
      returning:'возвращается на базу',
      waiting_for_base_path:'ждёт путь к базе',
      unloading:'выгружает',
      storage_full:'склад сырья заполнен',
      moving_to_build:'едет строить',
      building:'строит'
    })[u.state] || u.state;
  }
  function updateSelectedInfo() {
    if (!selected) { selectedInfo.style.display='none'; return; }
    selectedInfo.style.display='block';
    if (selected.kind==='unit') {
      const title = unitLabel(selected.type);
      const cargo = selected.type==='harvester' ? `<div>Груз: ${safeNum(selected.cargo)}/10</div>` : '';
      selectedPanel.innerHTML=`
        <div class="panel-title">${title}</div>
        <div>HP: ${safeNum(selected.hp)}/${safeNum(selected.maxHp)}</div>
        <div class="bar"><div style="width:${clamp(selected.hp/selected.maxHp*100,0,100)}%"></div></div>
        ${cargo}
        <div style="margin-top:7px">Статус: ${unitStatus(selected)}</div>
      `;
    } else if (selected.kind==='building') {
      const title=selected.type==='hq_base'?'Главное здание':(BUILDINGS[selected.type]?.name || selected.type);
      const prog=selected.complete?'готово':`строится ${Math.round(selected.progress*100)}%`;
      const q = selected.type==='units_factory' && selected.queue?.length
        ? `<div style="margin-top:7px">Очередь: ${selected.queue.map(x=>UNIT_DEFS[x.type].name + ' ' + Math.ceil(x.remaining) + 'с').join(', ')}</div>`
        : '';
      const status = buildingStatusHtml(selected);
      selectedPanel.innerHTML=`
        <div class="panel-title">${title}</div>
        <div>HP: ${safeNum(selected.hp)}/${safeNum(selected.maxHp)}</div>
        <div class="bar"><div style="width:${clamp(selected.hp/selected.maxHp*100,0,100)}%"></div></div>
        <div style="margin-top:7px">Состояние: ${prog}</div>
        ${status}
        ${q}
      `;
    }
  }
  function openUnitMenu(u) {
    selected=u;
    buildMenu.style.display='none';
    contextMenu.style.display='none';
    if (u.type==='light_tank') {
      updateSelectedInfo();
      return;
    }
    if (u.type==='harvester') {
      setContextAt(u.x,u.y,`
        <div class="panel-title">Сборщик</div>
        <button class="action-btn" data-unit-action="gather">Собирать минералы</button>
        <button class="action-btn" data-unit-action="base">В базу</button>
        <button class="action-btn" data-unit-action="stop">Стоп</button>
        <button class="action-btn disabled">Торговать элементами</button>
        <button class="action-btn" data-unit-action="cancel">Отмена</button>
      `);
    } else if (u.type==='builder') {
      setContextAt(u.x,u.y,`
        <div class="panel-title">Строитель</div>
        <button class="action-btn" data-unit-action="build">Построить объект</button>
        <button class="action-btn" data-unit-action="stop">Стоп</button>
        <button class="action-btn disabled">Перейти к ремонту</button>
        <button class="action-btn" data-unit-action="cancel">Отмена</button>
      `);
    } else if (u.type==='light_tank') {
      setContextAt(u.x,u.y,`
        <div class="panel-title">Лёгкий танк</div>
        <button class="action-btn" data-unit-action="stop">Стоп</button>
        <button class="action-btn disabled">Атака — следующий патч</button>
        <button class="action-btn" data-unit-action="cancel">Отмена</button>
      `);
    }
    updateSelectedInfo();
  }

  // V04_BUILD_MENU_CLEANUP_START
  function getV04BuildMenuTypes() {
    if (Array.isArray(window.FE_V04_BUILD_MENU_TYPES) && window.FE_V04_BUILD_MENU_TYPES.length) {
      return window.FE_V04_BUILD_MENU_TYPES;
    }

    return Object.keys(BUILDINGS || {});
  }

  function getBuildMenuEntries() {
    const entries = [];
    const seen = new Set();

    for (const type of getV04BuildMenuTypes()) {
      if (!type || seen.has(type)) continue;
      seen.add(type);

      const def = BUILDINGS?.[type];
      if (!def || typeof def !== 'object') continue;
      if (def.visibleInBuildMenu === false || def.enabled === false || def.available === false) continue;

      const name = String(def.name || '').trim();
      if (!name || name.toLowerCase() === 'undefined' || name.toLowerCase() === 'unknown') continue;

      entries.push([type, def]);
    }

    return entries;
  }

  function isBuildTypeVisibleInMenu(type) {
    return getBuildMenuEntries().some(([buildType]) => buildType === type);
  }
  // V04_BUILD_MENU_CLEANUP_END

  function openBuildMenu(u) {
    contextMenu.style.display='none';
    const p=tileToScreen(u.x,u.y);
    buildMenu.innerHTML=`
      <div class="panel-title">Построить объект</div>
      ${getBuildMenuEntries().map(([k,b])=>{
        const price = b.costEnergy || 0;
        const disabled = game.resources.energy < price ? ' disabled' : '';
        const reason = game.resources.energy < price ? '<br><span style="font-size:12px;color:#ff9b8b">Не хватает энергии</span>' : '';
        return `<button class="action-btn${disabled}" data-build="${k}">${b.name}<br><span style="font-size:13px;color:#ffdca0">Цена: ${price} энергии / ${b.buildTime} сек</span>${reason}</button>`;
      }).join('')}
      <button class="action-btn" data-build-cancel="1">Отмена</button>
    `;
    buildMenu.style.display='block';
    buildMenu.style.left=clamp(p.x+18,8,canvas.clientWidth-350)+'px';
    buildMenu.style.top=clamp(p.y-40,64,canvas.clientHeight-500)+'px';
  }

  function openFactoryMenu(factory) {
    contextMenu.style.display='none';
    const p=tileToScreen(factory.x+factory.w/2, factory.y+factory.h/2);
    const q = factory.queue || [];
    const elKey = factionElementKey();
    const elCount = game.resources[elKey] || 0;
    buildMenu.innerHTML=`
      <div class="panel-title">Фабрика юнитов</div>
      <div style="font-size:13px;color:#ffdca0;margin-bottom:8px">Очередь: ${q.length}/2<br>Элемент фракции: ${elCount}</div>
      ${['builder','harvester','light_tank'].map(type=>{
        const u=UNIT_DEFS[type];
        const disabled = (q.length>=2 || elCount < u.costElement) ? ' disabled' : '';
        const time = u.productionTime;
        return `<button class="action-btn${disabled}" data-produce="${type}">${u.name}<br><span style="font-size:13px;color:#ffdca0">Цена: ${u.costElement} элемент / ${time} сек</span></button>`;
      }).join('')}
      <button class="action-btn" data-build-cancel="1">Отмена</button>
    `;
    buildMenu.style.display='block';
    buildMenu.style.left=clamp(p.x+18,8,canvas.clientWidth-350)+'px';
    buildMenu.style.top=clamp(p.y-40,64,canvas.clientHeight-360)+'px';
  }

  // ============================================================
  // Input
  // ============================================================
  function getCanvasPoint(e) {
    const r=canvas.getBoundingClientRect();
    return {x:e.clientX-r.left,y:e.clientY-r.top};
  }
  function objectAtTile(x,y) {
    for (let i=game.units.length-1;i>=0;i--) {
      const u=game.units[i];
      if (Math.round(u.x)===x && Math.round(u.y)===y && isVisible(x,y)) return u;
    }
    for (let i=game.buildings.length-1;i>=0;i--) {
      const b=game.buildings[i];
      if (x>=b.x && y>=b.y && x<b.x+b.w && y<b.y+b.h && footprintVisible(b)) return b;
    }
    const m=game.minerals.find(m=>m.x===x && m.y===y && (m.infinite || m.remaining>0) && isVisible(x,y));
    return m || null;
  }
  function onCanvasClick(e) {
    if (!game || game.screen!=='game' || game.paused) return;
    const p=getCanvasPoint(e);
    const t=screenToTile(p.x,p.y);
    if (!inBounds(t.x,t.y)) { hideMenus(); selected=null; return; }
    const obj=objectAtTile(t.x,t.y);

    if (selected?.kind==='unit' && obj && obj.id && obj.type && MINE_TYPES[obj.type] && selected.type==='harvester') {
      startHarvester(selected,obj);
      hideMenus();
      showToast('Сборщик отправлен к залежи');
      return;
    }

    if (obj?.kind==='unit') {
      selected = obj;
      hideMenus();
      updateSelectedInfo();
      if (obj.type !== 'light_tank') {
        openUnitMenu(obj);
      }
      return;
    }
    if (obj?.kind==='building') {
      if (selected?.kind === 'unit' && selected.type === 'builder' && isUnfinishedConstruction(obj)) {
        resumeBuilderConstruction(selected, obj);
        return;
      }

      selected=obj;
      hideMenus();
      updateSelectedInfo();
      if (obj.type === 'units_factory' && obj.complete) openFactoryMenu(obj);
      return;
    }

    // Manual move to free tile.
    if (selected?.kind==='unit') {
      setManualMove(selected,t.x,t.y);
      return;
    }

    selected=null;
    hideMenus();
  }
  canvas.addEventListener('click', onCanvasClick);
  canvas.addEventListener('contextmenu', e=>{
    e.preventDefault();
    e.stopPropagation();
    return false;
  });
  canvas.addEventListener('mousedown', e=>{
    if (e.button===2) {
      handleCanvasRightClickCancel(e);
      return;
    }
    if (e.button===1) {
      e.preventDefault();
      mouse.middle=true; mouse.lastX=e.clientX; mouse.lastY=e.clientY;
    }
  });
  window.addEventListener('mouseup', e=>{ if (e.button===1) mouse.middle=false; });
  window.addEventListener('mousemove', e=>{
    if (mouse.middle && game?.screen==='game') {
      const dx=e.clientX-mouse.lastX, dy=e.clientY-mouse.lastY;
      game.camera.x -= dx/game.camera.zoom;
      game.camera.y -= dy/game.camera.zoom;
      mouse.lastX=e.clientX; mouse.lastY=e.clientY;
      clampCamera();
    }
  });
  canvas.addEventListener('wheel', e=>{
    if (!game || game.screen!=='game') return;
    e.preventDefault();
    const old=game.camera.zoom;
    const minZoom = Number.isFinite(window.FE_CAMERA_MIN_ZOOM) ? window.FE_CAMERA_MIN_ZOOM : .55;
    const normalMaxZoom = Number.isFinite(window.FE_CAMERA_MAX_ZOOM) ? window.FE_CAMERA_MAX_ZOOM : 1.95;
    const devMaxZoom = Number.isFinite(window.FE_CAMERA_MAX_ZOOM_DEV) ? window.FE_CAMERA_MAX_ZOOM_DEV : 4.0;
    const maxZoom = window.FE_DEV_CAMERA_ZOOM_ENABLED === true ? devMaxZoom : normalMaxZoom;
    game.camera.zoom = clamp(old*(e.deltaY<0?1.12:.90), minZoom, maxZoom);
    clampCamera();
  }, {passive:false});

window.addEventListener('keydown', e=>{
  keys[e.key.toLowerCase()]=true;
  if (window.FE_DEV_HOTKEYS_ENABLED === true) {
    const getCalibratedUnit = () => {
      if (selected?.kind === 'unit' && (selected.type === 'builder' || selected.type === 'harvester' || selected.type === 'light_tank')) {
        return selected;
      }
      return game?.units?.find(u => u.type === 'builder') ||
        game?.units?.find(u => u.type === 'harvester') ||
        game?.units?.find(u => u.type === 'light_tank') ||
        null;
    };

    const getDirOffsetsForUnit = unit => {
      if (!unit) return null;
      if (unit.type === 'builder') return window.FE_BUILDER_DIR_OFFSETS;
      if (unit.type === 'harvester') return window.FE_HARVESTER_DIR_OFFSETS;
      if (unit.type === 'light_tank') return window.FE_LIGHT_TANK_DIR_OFFSETS;
      return null;
    };

    const getForceDirForUnit = unit => {
      if (!unit) return null;
      if (unit.type === 'harvester') return window.FE_HARVESTER_FORCE_DIR;
      if (unit.type === 'light_tank') return window.FE_LIGHT_TANK_FORCE_DIR;
      return window.FE_BUILDER_FORCE_DIR;
    };

    const setForceDirForUnit = (unit, value) => {
      if (!unit) return;
      if (unit.type === 'harvester') window.FE_HARVESTER_FORCE_DIR = value;
      else if (unit.type === 'light_tank') window.FE_LIGHT_TANK_FORCE_DIR = value;
      else window.FE_BUILDER_FORCE_DIR = value;
    };

    const nudgeCalibratedUnit = (dx, dy) => {
      const unit = getCalibratedUnit();
      const offsets = getDirOffsetsForUnit(unit);
      if (!unit || !offsets) return;
      const d = unit._renderDir ?? 0;
      offsets[d] = offsets[d] || { x:0, y:0 };
      offsets[d].x += dx;
      offsets[d].y += dy;
      showToast(`${unit.type} dir ${d} offset: ${JSON.stringify(offsets[d])}`);
    };

    if (e.key === 'j') {
      nudgeCalibratedUnit(-1, 0);
      return;
    }

    if (e.key === 'l') {
      nudgeCalibratedUnit(1, 0);
      return;
    }

    if (e.key === 'i') {
      nudgeCalibratedUnit(0, -1);
      return;
    }

    if (e.key === 'k') {
      nudgeCalibratedUnit(0, 1);
      return;
    }

    if (e.key === '8' || e.code === 'Numpad8') {
      e.preventDefault();
      window.FE_SHOW_UNIT_FOOTPRINTS = !window.FE_SHOW_UNIT_FOOTPRINTS;
      showToast(window.FE_SHOW_UNIT_FOOTPRINTS ? 'Debug юнитов: включён' : 'Debug юнитов: выключен');
      return;
    }

    if (e.key === '7' || e.code === 'Numpad7') {
      e.preventDefault();

      const unit = getCalibratedUnit();
      if (!unit) return;
      const currentForceDir = getForceDirForUnit(unit);

      if (currentForceDir === null || currentForceDir === undefined) {
        setForceDirForUnit(unit, 0);
      } else {
        setForceDirForUnit(unit, (currentForceDir + 1) % 8);
      }

      const raw = unit?._rawDir ?? '?';

      showToast(`${unit.type} forced dir: ${getForceDirForUnit(unit)} / raw: ${raw}`);
      return;
    }

    if (e.key === '6' || e.code === 'Numpad6') {
      e.preventDefault();
      const unit = getCalibratedUnit();
      setForceDirForUnit(unit, null);
      showToast(unit ? `${unit.type} dir: auto` : 'Unit dir: auto');
      return;
    }
  }

  if ((e.key === '0' || e.code === 'Numpad0') && game?.screen === 'game' && window.FE_DEV_FULL_MAP_REVEAL_ENABLED === true) {
    e.preventDefault();
    window.FE_DEV_FULL_MAP_REVEAL_ACTIVE = window.FE_DEV_FULL_MAP_REVEAL_ACTIVE !== true;
    showToast(window.FE_DEV_FULL_MAP_REVEAL_ACTIVE ? 'Туман войны: выключен' : 'Туман войны: включён');
    return;
  }

  if (e.key==='Escape') {
    e.preventDefault();
    togglePause();
  }

  if (e.key.toLowerCase()==='s' && game?.screen==='game') {
    saveGame();
    showToast('Игра сохранена');
  }
});
  window.addEventListener('keyup', e=>keys[e.key.toLowerCase()]=false);

  document.body.addEventListener('click', e=>{
    const modalClose=e.target.closest('[data-modal-close]');
    if (modalClose) {
      modalScreen.classList.remove('active');
      if (currentModalReturn==='pause') showScreen(pauseMenu);
      else if (game?.screen==='game') hideScreens();
      else showScreen(mainMenu);
      return;
    }

    const a=e.target.closest('[data-action]');
    if (a && !a.classList.contains('disabled')) {
      const act=a.dataset.action;
      if (act==='new') showScreen(mapSizeMenu);
      if (act==='continue') { renderSaveMenu(); showScreen(saveMenu); }
      if (act==='settings') openSettings(game?.screen==='game' && game.paused ? 'pause' : (game?.screen==='game' ? 'game' : 'main'));
      if (act==='about') openModal('Об игре', 'Four Elements Remake — Core Map + UX Fix v0.3. Фокус: карта, сборщик, строитель, территория, туман войны, HUD и сохранение.', game?.screen==='game' && game.paused ? 'pause':'main');
      if (act==='exit') openModal('Выход', 'В браузерной версии просто закрой вкладку.', game?.screen==='game' && game.paused ? 'pause':'main');
      return;
    }

    const ms=e.target.closest('[data-map-size]');
    if (ms) {
      chosenMapSize=ms.dataset.mapSize;
      showScreen(factionMenu);
      return;
    }

    const f=e.target.closest('[data-faction]');
    if (f) { startNewGame(f.dataset.faction); return; }

    const back=e.target.closest('[data-back]');
    if (back) {
      const target=back.dataset.back;
      if (target==='main') showScreen(mainMenu);
      else if (target==='map') showScreen(mapSizeMenu);
      return;
    }

    const pause=e.target.closest('[data-pause]');
    if (pause) {
      const act=pause.dataset.pause;
      if (act==='resume') closePause();
      if (act==='save') { saveGame(); showToast('Игра сохранена'); closePause(); }
      if (act==='load') { loadGame(); }
      if (act==='main') { game.screen='menu'; game.paused=false; selected=null; hideMenus(); showScreen(mainMenu); updateContinueButton(); }
      return;
    }

    const unitAct=e.target.closest('[data-unit-action]');
    if (unitAct && selected?.kind==='unit') {
      const act=unitAct.dataset.unitAction;
      if (act==='gather' && selected.type==='harvester') { startHarvester(selected); hideMenus(); showToast('Сборщик начал автосбор'); }
      if (act==='base' && selected.type==='harvester') {
        const base=game.buildings.find(b=>b.type==='hq_base');
        const cells=adjacentFreeCellsForRect(base.x,base.y,base.w,base.h,selected.id).sort((a,b)=>dist(selected,a)-dist(selected,b));
        for (const c of cells) {
          const path=findPath(selected,c,selected.id);
          if (path!==null) { selected.path=path; selected.state='manual_move'; hideMenus(); break; }
        }
      }
      if (act==='build' && selected.type==='builder') openBuildMenu(selected);
      if (act==='stop') { selected.path=[]; selected.state='idle'; selected.autoGather=false; selected.buildOrder=null; hideMenus(); }
      if (act==='cancel') hideMenus();
      return;
    }

    const build=e.target.closest('[data-build]');
    if (build && selected?.type==='builder' && !build.classList.contains('disabled')) { orderBuild(selected, build.dataset.build); return; }

    const produce=e.target.closest('[data-produce]');
    if (produce && selected?.kind==='building' && selected.type==='units_factory' && !produce.classList.contains('disabled')) {
      queueUnitProduction(selected, produce.dataset.produce);
      openFactoryMenu(selected);
      return;
    }

    if (e.target.closest('[data-build-cancel]')) { hideMenus(); return; }

    const scale=e.target.closest('[data-ui-scale]');
    if (scale) {
      settings.uiScale=Number(scale.dataset.uiScale);
      saveSettings();
      applyUiScale();
      showToast(`Масштаб интерфейса: ${Math.round(settings.uiScale*100)}%`);
      return;
    }
  });

  function togglePause() {
    if (!game || game.screen!=='game') return;
    if (modalScreen.classList.contains('active')) { modalScreen.classList.remove('active'); return; }
    if (pauseMenu.classList.contains('active')) closePause();
    else openPause();
  }
  function openPause() {
    if (!game) return;
    game.paused=true;
    hideMenus();
    showScreen(pauseMenu);
  }
  function closePause() {
    if (!game) return;
    game.paused=false;
    hideScreens();
  }
  function openModal(title, body, returnTo='main') {
    currentModalReturn=returnTo;
    modalTitle.textContent=title;
    modalBody.textContent=body;
    showScreen(modalScreen);
  }
  function openSettings(returnTo='main') {
    currentModalReturn=returnTo;
    modalTitle.textContent='Настройки';
    modalBody.innerHTML=`
      <div style="margin-bottom:10px">Масштаб интерфейса</div>
      <div class="settings-grid">
        <button class="menu-btn" data-ui-scale="1">100%</button>
        <button class="menu-btn" data-ui-scale="1.25">125%</button>
        <button class="menu-btn" data-ui-scale="1.5">150%</button>
        <button class="menu-btn" data-ui-scale="1.75">175%</button>
      </div>
      <div class="small-note">Масштаб меняет HUD, меню, панели, кнопки и текст. Карта и юниты масштабируются отдельно через колесо мыши.</div>
    `;
    showScreen(modalScreen);
  }

  function clampCamera() {
    if (!game) return;
    const a=tileToWorld(0,0), b=tileToWorld(game.mapW-1,game.mapH-1), c=tileToWorld(game.mapW-1,0), d=tileToWorld(0,game.mapH-1);
    const minX=Math.min(a.x,b.x,c.x,d.x)-260, maxX=Math.max(a.x,b.x,c.x,d.x)+260;
    const minY=Math.min(a.y,b.y,c.y,d.y)-220, maxY=Math.max(a.y,b.y,c.y,d.y)+260;
    game.camera.x=clamp(game.camera.x,minX,maxX);
    game.camera.y=clamp(game.camera.y,minY,maxY);
  }

  // ============================================================
  // Main loop
  // ============================================================
  function update(dt) {
    if (!game || game.screen!=='game' || game.paused) return;
    game.time += dt;
    const camSpeed = 560 * dt / game.camera.zoom;
    if (keys['w']) game.camera.y -= camSpeed;
    if (keys['s']) game.camera.y += camSpeed;
    if (keys['a']) game.camera.x -= camSpeed;
    if (keys['d']) game.camera.x += camSpeed;
    clampCamera();

    for (const u of game.units) {
      const beforeX = u.x;
      const beforeY = u.y;

      if (u.type==='harvester') updateHarvester(u,dt);
      if (u.type==='builder') updateBuilder(u,dt);
      if (u.type==='light_tank') updateUnitMovement(u,dt);

      if (u.type === 'builder' || u.type === 'harvester' || u.type === 'light_tank') {
        updateBuilderDust(u, dt, beforeX, beforeY);
      }
    }

    updateDustParticles(dt);

    // Remove exhausted finite mines visually.
    cleanupDepletedMinerals();
    if (game.clickMarkers) {
      for (const m of game.clickMarkers) m.life -= dt;
      game.clickMarkers = game.clickMarkers.filter(m=>m.life>0);
    }

    if (
  window.FE_UNIT_CONTROLLER_ENABLED === true &&
  window.FE_UNIT_CONTROLLER &&
  typeof window.FE_UNIT_CONTROLLER.update === 'function'
) {
      window.FE_UNIT_CONTROLLER.update({
        game,
        dt,
        passable,
        findPath,
        adjacentFreeCells,
        adjacentFreeCellsForRect,
        createBuilding,
        canPlaceBuilding,
        addResource,
        showToast,
        debugLog,
        assignNextMine,
        BUILDINGS,
        BUILDING_SIZE,
        UNIT_DEFS
      });
    }

    updateTerritory(dt);
    updateFog();
    updateProduction(dt);
    updateHud();
    updateSelectedInfo();

game._saveTimer += dt;

if (game._saveTimer >= 45) {
  const unitBusy = game.units.some(u =>
    (u.path && u.path.length) ||
    u.state === 'manual_move' ||
    u.state === 'moving_to_mine' ||
    u.state === 'returning' ||
    u.state === 'moving_to_build'
  );

  if (!unitBusy) {
    game._saveTimer = 0;
    saveGame();
  } else {
    game._saveTimer = 40;
  }
}
  }
  function loop(now) {
    const dt=Math.min(0.05,(now-lastTime)/1000);
    lastTime=now;
    update(dt);
    render();
    requestAnimationFrame(loop);
  }


  // V04_DEBUG_SNAPSHOT_START

  function feSnapshotSafe(value, depth=0) {
    if (depth > 5) return '[max_depth]';
    if (value === null || value === undefined) return value;
    if (typeof value !== 'object') return value;

    if (Array.isArray(value)) {
      return value.slice(0, 80).map(v => feSnapshotSafe(v, depth + 1));
    }

    const out = {};
    for (const k of Object.keys(value).slice(0, 80)) {
      const v = value[k];
      if (typeof v === 'function') continue;
      out[k] = feSnapshotSafe(v, depth + 1);
    }

    return out;
  }

  function feSnapshotDiagnoseCell(x, y, ignoreUnitId=null) {
    const info = { x, y };

    try {
      info.inBounds = typeof inBounds === 'function' ? inBounds(x, y) : null;
      info.obstacleBlocked = typeof isObstacleBlocked === 'function' ? isObstacleBlocked(x, y) : null;
      info.mine = typeof mineAt === 'function' ? feSnapshotSafe(mineAt(x, y)) : null;
      info.building = typeof buildingAt === 'function' ? feSnapshotSafe(buildingAt(x, y)) : null;
      info.unit = typeof unitAt === 'function' ? feSnapshotSafe(unitAt(x, y, ignoreUnitId)) : null;
      info.passable = typeof passable === 'function' ? passable(x, y, ignoreUnitId) : null;

      if (!info.inBounds) info.reason = 'out_of_bounds';
      else if (info.obstacleBlocked) info.reason = 'obstacle';
      else if (info.mine) info.reason = 'mine';
      else if (info.building) info.reason = 'building';
      else if (info.unit) info.reason = 'unit';
      else if (info.passable) info.reason = 'passable';
      else info.reason = 'unknown_block';
    } catch (e) {
      info.error = String(e && e.message ? e.message : e);
    }

    return info;
  }

  function feSnapshotAroundUnit(u) {
    if (!u) return [];

    const gx = Math.round(u.x);
    const gy = Math.round(u.y);
    const cells = [];

    for (let yy = gy - 2; yy <= gy + 2; yy++) {
      for (let xx = gx - 2; xx <= gx + 2; xx++) {
        cells.push(feSnapshotDiagnoseCell(xx, yy, u.id));
      }
    }

    return cells;
  }

  function feSnapshotBuildInfo(builder) {
    if (!builder || !builder.buildOrder) return null;

    const order = builder.buildOrder;
    const spot = order.spot;
    const type = order.type;
    const size = BUILDING_SIZE[type] || [2, 2];

    const info = {
      order: feSnapshotSafe(order),
      size,
      footprint: [],
      adjacent: [],
      accessCell: order.accessCell ? feSnapshotSafe(order.accessCell) : null,
      canPlaceBuilding: null
    };

    if (spot) {
      for (let yy = spot.y; yy < spot.y + size[1]; yy++) {
        const row = [];
        for (let xx = spot.x; xx < spot.x + size[0]; xx++) {
          row.push(feSnapshotDiagnoseCell(xx, yy, builder.id));
        }
        info.footprint.push(row);
      }

      try {
        info.canPlaceBuilding =
          typeof canPlaceBuilding === 'function'
            ? canPlaceBuilding(spot.x, spot.y, size[0], size[1])
            : null;
      } catch (e) {
        info.canPlaceBuildingError = String(e && e.message ? e.message : e);
      }

      try {
        const adj =
          typeof adjacentFreeCellsForRect === 'function'
            ? adjacentFreeCellsForRect(spot.x, spot.y, size[0], size[1], builder.id)
            : [];

        info.adjacent = adj.map(c => ({
          cell: c,
          diagnosis: feSnapshotDiagnoseCell(c.x, c.y, builder.id),
          pathLength: (() => {
            try {
              const p = typeof findPath === 'function' ? findPath(builder, c, builder.id) : null;
              return p === null ? null : p.length;
            } catch (e) {
              return 'path_error: ' + String(e && e.message ? e.message : e);
            }
          })()
        }));
      } catch (e) {
        info.adjacentError = String(e && e.message ? e.message : e);
      }
    }

    return info;
  }

  function feMakeSnapshot() {
    const builders = (game?.units || []).filter(u => u.type === 'builder');
    const harvesters = (game?.units || []).filter(u => u.type === 'harvester');

    return {
      createdAt: new Date().toISOString(),
      note: 'Manual Four Elements debug snapshot',
      game: game ? {
        screen: game.screen,
        paused: game.paused,
        mapSize: game.mapSize,
        mapW: game.mapW,
        mapH: game.mapH,
        faction: game.faction,
        time: game.time,
        resources: feSnapshotSafe(game.resources),
        storageLimits: typeof getStorageLimits === 'function' ? feSnapshotSafe(getStorageLimits()) : null,
        camera: feSnapshotSafe(game.camera),
        buildingsCount: game.buildings?.length || 0,
        unitsCount: game.units?.length || 0,
        mineralsCount: game.minerals?.length || 0
      } : null,

      selected: selected ? feSnapshotSafe(selected) : null,

      builders: builders.map(b => ({
        unit: feSnapshotSafe(b),
        grid: { x: Math.round(b.x), y: Math.round(b.y) },
        currentCell: feSnapshotDiagnoseCell(Math.round(b.x), Math.round(b.y), b.id),
        around: feSnapshotAroundUnit(b),
        buildInfo: feSnapshotBuildInfo(b)
      })),

      harvesters: harvesters.map(h => ({
        unit: feSnapshotSafe(h),
        grid: { x: Math.round(h.x), y: Math.round(h.y) },
        currentCell: feSnapshotDiagnoseCell(Math.round(h.x), Math.round(h.y), h.id),
        around: feSnapshotAroundUnit(h),
        targetMine: h.target ? feSnapshotSafe((game.minerals || []).find(m => m.id === h.target)) : null,
        nearestBase: feSnapshotSafe((game.buildings || []).find(b => b.type === 'hq_base'))
      })),

      buildings: feSnapshotSafe(game?.buildings || []),
      visibleMinerals: feSnapshotSafe((game?.minerals || []).slice(0, 80))
    };
  }

  window.FE_EXPORT_SNAPSHOT = function () {
    const snapshot = feMakeSnapshot();

    const blob = new Blob(
      [JSON.stringify(snapshot, null, 2)],
      { type: 'application/json' }
    );

    const a = document.createElement('a');
    const ts = new Date().toISOString().replace(/[:.]/g, '-');

    a.href = URL.createObjectURL(blob);
    a.download = 'four_elements_snapshot_' + ts + '.json';

    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(() => URL.revokeObjectURL(a.href), 500);

    console.warn('[Four Elements] Snapshot exported', snapshot);
  };

  window.addEventListener('keydown', function (e) {
    if (e.key === 'F8') {
      e.preventDefault();
      window.FE_EXPORT_SNAPSHOT();
    }
  });

  console.warn('[Four Elements] Debug snapshot ready: use FE_EXPORT_SNAPSHOT() or F8');

  // V04_DEBUG_SNAPSHOT_END


  // ============================================================
  // Boot
  // ============================================================
  function updateContinueButton() {
    const btn=document.querySelector('[data-action="continue"]');
    if (btn) btn.classList.toggle('disabled', !canContinue());
  }
  function init() {
    applyUiScale();
    resize();
    window.addEventListener('resize',resize);
    loadAssets('cyan');
    updateContinueButton();
    document.querySelectorAll('.menu-btn').forEach(b=>{
      b.addEventListener('mouseenter',()=>{
        const list=b.parentElement;
        if (!list) return;
        list.querySelectorAll('.menu-btn').forEach(x=>x.classList.remove('focused'));
        if (!b.classList.contains('disabled')) b.classList.add('focused');
      });
    });
    requestAnimationFrame(loop);
  }
init();
})();
