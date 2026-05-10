(() => {
  'use strict';

  // ============================================================
  // Constants / data
  // ============================================================
  // REF-MAIN-GLM-06: standalone pure constants extracted to src/core/standalone_constants.js
  const { SAVE_KEY, SETTINGS_KEY, TILE_W, TILE_H, MAP_SIZES, BASE_STORAGE, FACTION_ELEMENT_KEY } = window.FE_STANDALONE_CONSTANTS || {};
  const BUILDING_SIZE = window.FE_BUILDING_SIZE;

  // v0.4: здания строятся за энергию. Минералы = сырьё, не строительная валюта.
  const BUILDINGS = window.FE_BUILDINGS;

  const UNIT_DEFS = window.FE_UNITS;
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
  let selectedUnits = [];
  let dragSelect = { active:false, moved:false, suppressClick:false, startX:0, startY:0, x:0, y:0 };
  let attackMoveArmed = false;
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
      // FE_PATCH_09A: hidden enemy economy bucket. Not shown in player HUD.
      enemyResources:{ minerals:0, energy:160, purple:0, greenEl:0, cyanEl:0, yellowEl:0 },
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
      _saveTimer:0,
      gameResult:null,
      gameResultReason:null,
      gameResultAt:0,
      gameEnded:false,
      _enemyHqSeen:false
    };
  }

  // ============================================================
  // Asset loading
  // ============================================================
  const FE_PATCH_07A3_ENEMY_VISUAL_FACTION = 'purple';
  const factionAssetsCache = Object.create(null);

  function loadAssets(faction='cyan') {
    assets = window.FE_ASSET_LOADER.loadAssets(faction);
    factionAssetsCache[faction] = assets;
  }

  // ============================================================
  // Helpers
  // ============================================================
  function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }
  function dist(a,b){ return Math.abs(Math.round(a.x)-Math.round(b.x)) + Math.abs(Math.round(a.y)-Math.round(b.y)); }
  function inBounds(x,y){ return game && x>=0 && y>=0 && x<game.mapW && y<game.mapH; }
  function defaultFactionForOwner(owner='player') {
    return owner === 'enemy'
      ? FE_PATCH_07A3_ENEMY_VISUAL_FACTION
      : (game?.faction || 'cyan');
  }
  function getFactionRenderAssets(faction) {
    const resolvedFaction =
      typeof faction === 'string' && faction && FACTIONS?.[faction]
        ? faction
        : (game?.faction || 'cyan');
    if (!factionAssetsCache[resolvedFaction]) {
      factionAssetsCache[resolvedFaction] = window.FE_ASSET_LOADER.loadAssets(resolvedFaction);
    }
    return factionAssetsCache[resolvedFaction];
  }
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

  // PATCH-MAP-01-DIAGONAL-BASE-SPAWNS_START
  function getStart() {
    // Player starts closer to the lower-left screen corner.
    // Enemy start is handled separately so bases no longer sit on the same horizontal map band.
    if (game.mapSize === 'large') return { x:10, y:game.mapH-14 };
    return { x:7, y:game.mapH-10 };
  }

  function getEnemyDiagonalStart() {
    // Enemy starts near the opposite upper-right screen corner.
    // This is intentionally not a simple x/y mirror: in isometric projection,
    // mirroring both coordinates puts both bases on a similar vertical screen band.
    const topInset = game.mapSize === 'large' ? 8 : 6;
    const rightInset = game.mapSize === 'large' ? 22 : 12;
    return clampStartCell({
      x: game.mapW - rightInset,
      y: topInset
    });
  }
  // PATCH-MAP-01-DIAGONAL-BASE-SPAWNS_END

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
    // PATCH-MAP-01: slot 2 is the actual enemy diagonal corner start, not a raw mirror.
    const s = getStart();
    const enemyDiagonal = getEnemyDiagonalStart();
    const starts = [
      s,
      enemyDiagonal,
      { x: s.x, y: Math.max(3, Math.floor(game.mapH * 0.18)) },
      { x: game.mapW - 1 - s.x, y: game.mapH - 1 - s.y }
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

  // PATCH-MAP-04-ENVIRONMENT-COLLISION-BLOCKERS_START
  const FE_MAP04_PASSABLE_ENVIRONMENT_ASSETS = new Set([
    'dry_bush_01',
    'sand_bump_01'
  ]);

  const FE_MAP04_BLOCKING_ENVIRONMENT_ASSETS = new Set([
    'mountain_small_01',
    'mountain_medium_01',
    'mountain_ridge_01',
    'mountain_large_01',
    'volcano_small_01',
    'volcano_medium_01',
    'volcano_large_01',
    'rock_cluster_small_01'
  ]);

  function normalizeEnvironmentObstacleBlock(asset, explicitBlock=true) {
    if (FE_MAP04_PASSABLE_ENVIRONMENT_ASSETS.has(asset)) return false;
    if (FE_MAP04_BLOCKING_ENVIRONMENT_ASSETS.has(asset)) return true;
    return !!explicitBlock;
  }
  // PATCH-MAP-04-ENVIRONMENT-COLLISION-BLOCKERS_END

  function reserveFree(x,y,w,h, buffer=0) {
    const r={x:x-buffer,y:y-buffer,w:w+buffer*2,h:h+buffer*2};
    if (x<1 || y<1 || x+w>=game.mapW-1 || y+h>=game.mapH-1) return false;
    for (const start of getPlannedPlayerStarts(2)) {
      const safe={x:start.x-9,y:start.y-9,w:20,h:20};
      if (rectsOverlap(r,safe)) return false;
    }
    for (const o of game.obstacles) if (rectsOverlap(r,o)) return false;
    for (const m of game.minerals) if (rectsOverlap(r,{x:m.x,y:m.y,w:1,h:1})) return false;
    return true;
  }
  function addObstacle(asset,x,y,w,h,block=true) {
    if (!reserveFree(x,y,w,h,1)) return false;
    const normalizedBlock = normalizeEnvironmentObstacleBlock(asset, block);
    game.obstacles.push({id:uid('obs'), asset,x,y,w,h,block: normalizedBlock});
    return true;
  }
  function canSpawnMine(x,y) {
    if (!inBounds(x,y) || x<2 || y<2 || x>=game.mapW-2 || y>=game.mapH-2) return false;
    if (isObstacleBlocked(x,y)) return false;
    for (const m of game.minerals) if (m.x===x && m.y===y) return false;
    // Don't place directly under planned starting units/buildings.
    for (const start of getPlannedPlayerStarts(2)) {
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

  function canSpawnRuntimeMine(x, y) {
    if (!canSpawnMine(x, y)) return false;
    if (typeof buildingAt === 'function' && buildingAt(x, y)) return false;
    if (typeof unitAt === 'function' && unitAt(x, y)) return false;
    return true;
  }

  function spawnMineNearRuntime(type, x, y, meta={}) {
    const offsets = [
      [0,0], [1,0], [-1,0], [0,1], [0,-1],
      [1,1], [-1,1], [1,-1], [-1,-1],
      [2,0], [-2,0], [0,2], [0,-2],
      [2,1], [-2,1], [2,-1], [-2,-1],
      [1,2], [-1,2], [1,-2], [-1,-2]
    ];

    for (const [dx, dy] of offsets) {
      const tx = x + dx;
      const ty = y + dy;
      if (!canSpawnRuntimeMine(tx, ty)) continue;
      if (spawnMine(type, tx, ty, meta)) return true;
    }

    return false;
  }

  function spawnStarterMineralsAroundBase(base, clusterId='starter_runtime') {
    if (!base || base.kind !== 'building') return false;
    if (!game?.minerals) return false;
    if (game.minerals.some(m => m?.clusterId === clusterId)) return false;

    const start = {
      x: Math.round(base.x + (base.w || 2) / 2 - 0.5),
      y: Math.round(base.y + (base.h || 2) / 2 - 0.5)
    };

    let spawned = 0;

    for (const [type, outwardDist, sideDist] of SPAWN_STARTER_RESOURCE_PATTERN) {
      const cell = cellFromSpawnRelative(start, outwardDist, sideDist);
      const meta = {
        clusterId,
        resourceField: true,
        spawnBased: true,
        runtimeBaseCluster: true,
        owner: buildingOwner(base)
      };
      if (spawnMineNearRuntime(type, cell.x, cell.y, meta)) spawned += 1;
    }

    return spawned > 0;
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

    // PATCH-MAP-03-ENVIRONMENT-DISTRIBUTION-BANDS_START
    // Environment composition is band-based instead of near-uniform random noise:
    // - large/medium mountains mostly form border chains;
    // - volcanoes and small rocks are biased toward the middle;
    // - large center landmarks are rare;
    // - resources and base start positions stay protected by reserveFree()/addObstacle().
    const mult = game.mapSize === 'large' ? 2.1 : 1;
    const maxR = Math.max(1, Math.hypot(game.mapW / 2, game.mapH / 2));

    function clampObstacleCell(x, y, w, h) {
      return {
        x: Math.max(2, Math.min(game.mapW - w - 2, Math.round(x))),
        y: Math.max(2, Math.min(game.mapH - h - 2, Math.round(y)))
      };
    }

    function randomEdgeCell(w, h, depthFrac=0.16) {
      const depthX = Math.max(4, Math.floor(game.mapW * depthFrac));
      const depthY = Math.max(4, Math.floor(game.mapH * depthFrac));
      const side = Math.floor(Math.random() * 4);
      let x, y;
      if (side === 0) {
        x = 2 + Math.floor(Math.random() * depthX);
        y = 2 + Math.floor(Math.random() * Math.max(1, game.mapH - h - 4));
      } else if (side === 1) {
        x = game.mapW - w - 2 - Math.floor(Math.random() * depthX);
        y = 2 + Math.floor(Math.random() * Math.max(1, game.mapH - h - 4));
      } else if (side === 2) {
        x = 2 + Math.floor(Math.random() * Math.max(1, game.mapW - w - 4));
        y = 2 + Math.floor(Math.random() * depthY);
      } else {
        x = 2 + Math.floor(Math.random() * Math.max(1, game.mapW - w - 4));
        y = game.mapH - h - 2 - Math.floor(Math.random() * depthY);
      }
      return clampObstacleCell(x, y, w, h);
    }

    function randomCenterBandCell(w, h, minFrac=0.12, maxFrac=0.45) {
      for (let i=0; i<12; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = (minFrac + Math.random() * (maxFrac - minFrac)) * maxR;
        const x = center.x + Math.cos(angle) * radius;
        const y = center.y + Math.sin(angle) * radius;
        const cell = clampObstacleCell(x, y, w, h);
        const r = Math.hypot(cell.x - center.x, cell.y - center.y) / maxR;
        if (r >= minFrac * 0.75 && r <= maxFrac * 1.15) return cell;
      }
      return clampObstacleCell(center.x + (Math.random() * 10 - 5), center.y + (Math.random() * 10 - 5), w, h);
    }

    function placeBandObstacle(asset, w, h, count, block, picker, maxTriesMul=120) {
      let placed = 0;
      let tries = 0;
      const maxTries = Math.max(80, count * maxTriesMul);
      while (placed < count && tries < maxTries) {
        tries++;
        const p = picker(placed, tries);
        if (addObstacle(asset, p.x, p.y, w, h, block)) placed++;
      }
      return placed;
    }

    function placeEdgeChain(asset, w, h, count, block) {
      let placed = 0;
      let tries = 0;
      let anchor = null;
      const maxTries = Math.max(120, count * 160);

      while (placed < count && tries < maxTries) {
        tries++;
        if (!anchor || Math.random() < 0.34) {
          anchor = randomEdgeCell(w, h, 0.17);
        }

        const p = clampObstacleCell(
          anchor.x + Math.round((Math.random() - 0.5) * 10),
          anchor.y + Math.round((Math.random() - 0.5) * 10),
          w,
          h
        );

        if (addObstacle(asset, p.x, p.y, w, h, block)) {
          placed++;
          anchor = p;
        }
      }

      return placed;
    }

    // Border mass: heavy silhouettes on edges, with medium/ridge objects forming loose chains.
    placeEdgeChain('mountain_large_01', 3, 3, Math.round(3 * mult), true);
    placeEdgeChain('mountain_medium_01', 2, 2, Math.round(7 * mult), true);
    placeEdgeChain('mountain_ridge_01', 3, 1, Math.round(4 * mult), true);
    placeBandObstacle('mountain_small_01', 1, 1, Math.round(6 * mult), true, () => randomEdgeCell(1, 1, 0.22));

    // Middle accents: more small volcanoes/rocks around the central playable area.
    placeBandObstacle('volcano_small_01', 1, 1, Math.round(8 * mult), true, () => randomCenterBandCell(1, 1, 0.16, 0.45));
    placeBandObstacle('volcano_medium_01', 2, 2, Math.round(2 * mult), true, () => randomCenterBandCell(2, 2, 0.22, 0.50));
    placeBandObstacle('rock_cluster_small_01', 1, 1, Math.round(14 * mult), true, () => randomCenterBandCell(1, 1, 0.12, 0.52));

    // Lightweight visual noise: sparse on borders, mostly mid-map, still non-blocking.
    placeBandObstacle('dry_bush_01', 1, 1, Math.round(13 * mult), false, () => randomCenterBandCell(1, 1, 0.20, 0.66));
    placeBandObstacle('sand_bump_01', 1, 1, Math.round(10 * mult), false, () => randomCenterBandCell(1, 1, 0.18, 0.70));

    // One rare center-side large volcano landmark. It is still protected from resources/start zones by addObstacle().
    placeBandObstacle('volcano_large_01', 3, 3, 1, true, () => randomCenterBandCell(3, 3, 0.18, 0.36), 180);
    // PATCH-MAP-03-ENVIRONMENT-DISTRIBUTION-BANDS_END
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
    FE_PATCH_07ASetupSkirmishStart();
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
      owner:'player',
      faction: defaultFactionForOwner('player'),
      attackTargetId:null,
      attackTargetKind:null,
      attackCooldown:0,
      _attackCommanded:false,
      state:'idle', path:[], target:null, cargo:0, cargoCapacity:def.cargo || 0,
      attackApproachTargetKind:null,
      facing:'se', flip:false, angle:0,
      actionTimer:0, manualTarget:null, autoGather:false, buildOrder:null
    };
  }

  // FE_LT_04A_COMBAT_START
  function isLightTank(unit) {
    return !!unit && unit.kind === 'unit' && unit.type === 'light_tank';
  }

  function unitOwner(unit) {
    return unit?.owner || 'player';
  }

  function isPlayerUnit(unit) {
    return !!unit && unit.kind === 'unit' && unit.owner === 'player';
  }

  function isEnemyUnit(unit) {
    return !!unit && unit.kind === 'unit' && unit.owner === 'enemy';
  }

  function unitVisualFaction(unit) {
    return unit?.faction || defaultFactionForOwner(unitOwner(unit));
  }

  function unitDistanceCells(a, b) {
    if (!a || !b) return Infinity;
    return Math.abs(Math.round(a.x) - Math.round(b.x)) + Math.abs(Math.round(a.y) - Math.round(b.y));
  }

  function getLightTankCombatStats(unit) {
    const def = UNIT_DEFS?.light_tank || {};
    return {
      range: Number.isFinite(def.attackRange) ? def.attackRange : 1,
      damage: Number.isFinite(def.attackDamage) ? def.attackDamage : 18,
      cooldown: Number.isFinite(def.attackCooldown) ? def.attackCooldown : 0.75,
      maxHp: def.hp || 160
    };
  }

  function findUnitById(id) {
    if (!id || !game?.units) return null;
    return game.units.find(u => u.id === id) || null;
  }

  function damageUnit(target, amount) {
    if (!target || !Number.isFinite(amount) || amount <= 0) return false;
    target.hp = Math.max(0, (target.hp || 0) - amount);
    if (target.hp <= 0) {
      destroyUnit(target);
      return true;
    }
    return false;
  }

  function destroyUnit(unit) {
    if (!unit || !game?.units) return false;
    const before = game.units.length;
    game.units = game.units.filter(u => u.id !== unit.id);

    for (const u of game.units) {
      if (u.attackTargetId === unit.id) {
        FE_PATCH_06BClearAttackTarget(u);
      }
    }

    if (Array.isArray(selectedUnits)) {
      selectedUnits = selectedUnits.filter(u => u?.id !== unit.id);
    }

    if (selected?.id === unit.id) {
      selected = selectedUnits[0] || null;
      hideMenus();
      updateSelectedInfo();
    }

    return game.units.length !== before;
  }

  // FE_PATCH_06B_ATTACK_ENEMY_BUILDINGS_START
  function FE_PATCH_06BFindBuildingById(id) {
    if (!id || !game?.buildings) return null;
    return game.buildings.find(b => b.id === id) || null;
  }

  function FE_PATCH_06BIsAttackableEnemyBuilding(target) {
    return !!(
      target &&
      target.kind === 'building' &&
      target.type === 'hq_base' &&
      isEnemyBuilding(target) &&
      (target.hp || 0) > 0
    );
  }

  function FE_PATCH_06BTargetCenter(target) {
    if (!target) return null;
    if (target.kind === 'building') {
      return {
        x: target.x + (target.w || 1) / 2 - 0.5,
        y: target.y + (target.h || 1) / 2 - 0.5
      };
    }
    return { x: target.x, y: target.y };
  }

  function FE_PATCH_06BDistanceToBuilding(unit, building) {
    if (!unit || !building) return Infinity;
    const ux = Math.round(unit.x);
    const uy = Math.round(unit.y);
    const left = Math.round(building.x);
    const top = Math.round(building.y);
    const right = Math.round(building.x + building.w - 1);
    const bottom = Math.round(building.y + building.h - 1);
    const dx = ux < left ? left - ux : (ux > right ? ux - right : 0);
    const dy = uy < top ? top - uy : (uy > bottom ? uy - bottom : 0);
    return dx + dy;
  }

  function FE_PATCH_06BResolveAttackTarget(unit) {
    if (!unit?.attackTargetId) return null;
    if (unit.attackTargetKind === 'building') return FE_PATCH_06BFindBuildingById(unit.attackTargetId);
    return findUnitById(unit.attackTargetId);
  }

  function FE_PATCH_06BResolveApproachTarget(unit) {
    if (!unit?.attackApproachTargetId) return null;
    if (unit.attackApproachTargetKind === 'building') return FE_PATCH_06BFindBuildingById(unit.attackApproachTargetId);
    return findUnitById(unit.attackApproachTargetId);
  }

  function FE_PATCH_06BClearAttackTarget(unit) {
    if (!unit) return;
    unit.attackTargetId = null;
    unit.attackTargetKind = null;
    unit.attackCooldown = 0;
    unit._attackCommanded = false;
    if (unit.state === 'attacking') unit.state = 'idle';
  }

  function FE_PATCH_06BClearAttackApproach(unit) {
    if (!unit) return;
    unit.attackApproachTargetId = null;
    unit.attackApproachTargetKind = null;
    unit._attackApproachCommanded = false;
  }

  // FE_PATCH_06C_BUILDING_DEATH_STATE_START
  function FE_PATCH_06CIsDeadBuilding(building) {
    return !!(
      building &&
      building.kind === 'building' &&
      (building.destroyed === true || (building.hp || 0) <= 0)
    );
  }

  function FE_PATCH_06CClearBuildingRefs(buildingId) {
    if (!buildingId) return;

    for (const unit of game?.units || []) {
      if (!unit) continue;

      if (unit.attackTargetKind === 'building' && unit.attackTargetId === buildingId) {
        FE_PATCH_06BClearAttackTarget(unit);
      }

      if (unit.attackApproachTargetKind === 'building' && unit.attackApproachTargetId === buildingId) {
        FE_PATCH_06BClearAttackApproach(unit);
        if (unit.state === 'moving_to_attack') unit.state = 'idle';
      }

      if (unit.currentBuilding === buildingId) {
        unit.currentBuilding = null;
        if (unit.state === 'building') unit.state = 'idle';
      }

      if (unit.buildOrder?.existingBuildingId === buildingId) {
        unit.buildOrder = null;
        if (unit.state === 'moving_to_build') unit.state = 'idle';
      }
    }

    if (selected?.id === buildingId) {
      selected = selectedUnits[0] || null;
      hideMenus();
      updateSelectedInfo();
    }
  }

  function FE_PATCH_06CDestroyBuilding(building, reason='combat_damage') {
    if (!building || building.kind !== 'building' || !game?.buildings) return false;

    building.hp = 0;
    building.destroyed = true;
    building.destroyedReason = reason;
    building.destroyedAt = Date.now();

    const before = game.buildings.length;
    game.buildings = game.buildings.filter(b => b && b.id !== building.id);
    FE_PATCH_06CClearBuildingRefs(building.id);

    const removed = game.buildings.length !== before;
    const owner = buildingOwner(building);
    const label = owner === 'enemy' && building.type === 'hq_base'
      ? 'Вражеская база уничтожена'
      : 'Здание уничтожено';

    showToast(label);
    debugLog('building_destroyed', {
      reason,
      removed,
      building:safeCloneForLog(building),
      buildingsLeft:game.buildings.length
    });

    if (building.type === 'hq_base') {
      if (owner === 'enemy' && typeof FE_PATCH_06DSetGameResult === 'function') {
        FE_PATCH_06DSetGameResult('victory', 'enemy_hq_destroyed');
      } else if (owner === 'player' && typeof FE_PATCH_06DSetGameResult === 'function') {
        FE_PATCH_06DSetGameResult('defeat', 'player_hq_destroyed');
      } else {
        FE_PATCH_06DCheckVictoryDefeat(`${owner}_hq_destroyed`);
      }
    }

    return true;
  }

  function FE_PATCH_06BDamageBuilding(target, amount) {
    if (!target || !Number.isFinite(amount) || amount <= 0) return false;
    if (FE_PATCH_06CIsDeadBuilding(target)) {
      return FE_PATCH_06CDestroyBuilding(target, 'already_dead');
    }

    target.hp = Math.max(0, (target.hp || 0) - amount);

    if (target.hp <= 0) {
      return FE_PATCH_06CDestroyBuilding(target, 'combat_damage');
    }

    return false;
  }
  // FE_PATCH_06C_BUILDING_DEATH_STATE_END

  // FE_PATCH_06D_VICTORY_DEFEAT_MVP_START
  function FE_PATCH_06DResultTitle(result) {
    return result === 'victory' ? 'Победа' : 'Поражение';
  }

  function FE_PATCH_06DResultSubtitle(result) {
    return result === 'victory'
      ? 'Вражеская база уничтожена'
      : 'Твоя база уничтожена';
  }

  function FE_PATCH_06DSetGameResult(result, reason='state_check') {
    if (!game || game.screen !== 'game') return false;
    if (game.gameResult) return false;
    if (result !== 'victory' && result !== 'defeat') return false;

    game.gameResult = result;
    game.gameResultReason = reason;
    game.gameResultAt = game.time || 0;
    game.gameEnded = true;
    game.paused = true;
    attackMoveArmed = false;
    hideMenus();

    // FE_PATCH_07C1_RESULT_OVERLAY_ESC_LOCK_START
    // Result overlay is final-state UI; make sure pause/menu screens are not stacked below it.
    if (typeof hideScreens === 'function') hideScreens();
    // FE_PATCH_07C1_RESULT_OVERLAY_ESC_LOCK_END

    const title = FE_PATCH_06DResultTitle(result);
    const subtitle = FE_PATCH_06DResultSubtitle(result);
    showToast(`${title}: ${subtitle}`, 9000);
    FE_PATCH_06DShowDomOverlay(result, reason);

    debugLog('game_result', {
      result,
      reason,
      time:game.time || 0,
      playerHqAlive:!!findBaseBuilding('player'),
      enemyHqAlive:!!findBaseBuilding('enemy')
    });

    updateSelectedInfo();
    return true;
  }

  function FE_PATCH_06DCheckVictoryDefeat(reason='state_check') {
    if (!game || game.screen !== 'game' || game.gameResult) return null;

    const playerHq = findBaseBuilding('player');
    const enemyHq = findBaseBuilding('enemy');

    if (enemyHq) game._enemyHqSeen = true;

    if (!playerHq) {
      FE_PATCH_06DSetGameResult('defeat', reason);
      return 'defeat';
    }

    if ((game._enemyHqSeen || reason === 'enemy_hq_destroyed') && !enemyHq) {
      FE_PATCH_06DSetGameResult('victory', reason);
      return 'victory';
    }

    return null;
  }

  // FE_PATCH_06D_F_VISIBLE_RESULT_OVERLAY_START
  function FE_PATCH_06DGetDomOverlay() {
    let overlay = document.getElementById('fe-game-result-overlay');
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = 'fe-game-result-overlay';
    overlay.setAttribute('aria-live', 'polite');
    overlay.style.position = 'fixed';
    overlay.style.left = '0';
    overlay.style.top = '0';
    overlay.style.right = '0';
    overlay.style.bottom = '0';
    overlay.style.zIndex = '99999';
    overlay.style.display = 'none';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.background = 'rgba(6, 8, 12, 0.58)';
    // FE_PATCH_07C1_RESULT_OVERLAY_ESC_LOCK_START
    // Block click-through into pause/menu controls while result overlay is visible.
    overlay.style.pointerEvents = 'auto';
    // FE_PATCH_07C1_RESULT_OVERLAY_ESC_LOCK_END
    overlay.style.fontFamily = 'system-ui, -apple-system, Segoe UI, sans-serif';

    const panel = document.createElement('div');
    panel.dataset.role = 'panel';
    panel.style.minWidth = 'min(560px, calc(100vw - 48px))';
    panel.style.maxWidth = 'min(640px, calc(100vw - 48px))';
    panel.style.padding = '30px 34px 28px';
    panel.style.borderRadius = '22px';
    panel.style.textAlign = 'center';
    panel.style.boxShadow = '0 28px 80px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.14)';

    const titleEl = document.createElement('div');
    titleEl.dataset.role = 'title';
    titleEl.style.fontSize = '44px';
    titleEl.style.lineHeight = '1.05';
    titleEl.style.fontWeight = '900';
    titleEl.style.letterSpacing = '.08em';
    titleEl.style.textTransform = 'uppercase';

    const subtitleEl = document.createElement('div');
    subtitleEl.dataset.role = 'subtitle';
    subtitleEl.style.marginTop = '14px';
    subtitleEl.style.fontSize = '20px';
    subtitleEl.style.fontWeight = '650';

    const hintEl = document.createElement('div');
    hintEl.dataset.role = 'hint';
    hintEl.textContent = 'Новая партия — через главное меню.';
    hintEl.style.marginTop = '22px';
    hintEl.style.fontSize = '14px';
    hintEl.style.color = 'rgba(255, 245, 220, .72)';

    panel.appendChild(titleEl);
    panel.appendChild(subtitleEl);
    panel.appendChild(hintEl);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    return overlay;
  }

  function FE_PATCH_06DShowDomOverlay(result, reason='state_check') {
    const overlay = FE_PATCH_06DGetDomOverlay();
    const panel = overlay.querySelector('[data-role="panel"]');
    const titleEl = overlay.querySelector('[data-role="title"]');
    const subtitleEl = overlay.querySelector('[data-role="subtitle"]');
    const isVictory = result === 'victory';

    if (titleEl) titleEl.textContent = isVictory ? 'ПОБЕДА' : 'ПОРАЖЕНИЕ';
    if (subtitleEl) subtitleEl.textContent = FE_PATCH_06DResultSubtitle(result);

    if (panel) {
      panel.style.background = isVictory
        ? 'linear-gradient(180deg, rgba(30, 58, 36, .98), rgba(16, 28, 18, .98))'
        : 'linear-gradient(180deg, rgba(68, 28, 28, .98), rgba(32, 14, 14, .98))';
      panel.style.border = isVictory
        ? '2px solid rgba(129, 255, 147, .92)'
        : '2px solid rgba(255, 104, 104, .92)';
    }

    if (titleEl) {
      titleEl.style.color = isVictory ? '#baffc0' : '#ffd2d2';
      titleEl.style.textShadow = isVictory
        ? '0 0 24px rgba(90, 255, 130, .30)'
        : '0 0 24px rgba(255, 90, 90, .30)';
    }
    if (subtitleEl) subtitleEl.style.color = '#fff2d8';

    overlay.dataset.result = result;
    overlay.dataset.reason = reason;
    overlay.style.display = 'flex';
  }

  function FE_PATCH_06DHideDomOverlay() {
    const overlay = document.getElementById('fe-game-result-overlay');
    if (overlay) overlay.style.display = 'none';
  }
  // FE_PATCH_06D_F_VISIBLE_RESULT_OVERLAY_END

  function FE_PATCH_06DDrawGameResultOverlay() {
    if (!game || !game.gameResult) return;

    const w = canvas.clientWidth || canvas.width || 1;
    const h = canvas.clientHeight || canvas.height || 1;
    const z = Math.max(1, Math.min(1.4, game?.camera?.zoom || 1));
    const result = game.gameResult;
    const isVictory = result === 'victory';
    const title = FE_PATCH_06DResultTitle(result);
    const subtitle = FE_PATCH_06DResultSubtitle(result);
    const panelW = Math.min(520, w - 40);
    const panelH = 190;
    const x = (w - panelW) / 2;
    const y = (h - panelH) / 2;

    ctx.save();
    ctx.fillStyle = 'rgba(6, 8, 12, 0.58)';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = isVictory ? 'rgba(28, 44, 28, 0.94)' : 'rgba(48, 22, 22, 0.94)';
    ctx.strokeStyle = isVictory ? 'rgba(116, 255, 140, 0.95)' : 'rgba(255, 92, 92, 0.95)';
    ctx.lineWidth = Math.max(2, 2.5 * z);
    ctx.beginPath();
    ctx.roundRect(x, y, panelW, panelH, 18);
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = isVictory ? '#b8ffbd' : '#ffd0d0';
    ctx.font = `700 ${Math.round(34 * z)}px system-ui, sans-serif`;
    ctx.fillText(title, w / 2, y + 58);

    ctx.fillStyle = '#fff2da';
    ctx.font = `${Math.round(18 * z)}px system-ui, sans-serif`;
    ctx.fillText(subtitle, w / 2, y + 100);

    ctx.fillStyle = 'rgba(255, 245, 220, 0.72)';
    ctx.font = `${Math.round(13 * z)}px system-ui, sans-serif`;
    ctx.fillText('Новая партия — через главное меню.', w / 2, y + 142);
    ctx.restore();
  }
  // FE_PATCH_06D_VICTORY_DEFEAT_MVP_END


  function FE_PATCH_06BAttackMarkerPoint(target) {
    const center = FE_PATCH_06BTargetCenter(target);
    if (!center) return null;
    return { x: Math.round(center.x), y: Math.round(center.y) };
  }

  function FE_PATCH_06BAttackApproachCellsForBuilding(attacker, target) {
    if (!attacker || !target) return [];
    const stats = getLightTankCombatStats(attacker);
    const range = Math.max(1, Math.round(stats.range || 1));
    const left = Math.round(target.x);
    const top = Math.round(target.y);
    const right = Math.round(target.x + target.w - 1);
    const bottom = Math.round(target.y + target.h - 1);
    const cells = [];

    for (let y = top - range; y <= bottom + range; y++) {
      for (let x = left - range; x <= right + range; x++) {
        const dx = x < left ? left - x : (x > right ? x - right : 0);
        const dy = y < top ? top - y : (y > bottom ? y - bottom : 0);
        if (dx + dy > range) continue;
        if (x >= left && x <= right && y >= top && y <= bottom) continue;
        if (!lightTankDestinationCellFree(x, y, attacker.id)) continue;
        cells.push({ x, y, score: dist(attacker, { x, y }) + (dx + dy) * 0.01 });
      }
    }

    cells.sort((a, b) => a.score - b.score || a.y - b.y || a.x - b.x);
    return cells.map(({ x, y }) => ({ x, y }));
  }
  // FE_PATCH_06B_ATTACK_ENEMY_BUILDINGS_END

  function FE_PATCH_07BGetHostileLightTankTargetKind(attacker, target) {
    if (!isLightTank(attacker) || !target) return null;

    if (isLightTank(target) && unitOwner(target) !== unitOwner(attacker)) {
      return 'unit';
    }

    if (
      target.kind === 'building' &&
      target.type === 'hq_base' &&
      buildingOwner(target) !== unitOwner(attacker) &&
      (target.hp || 0) > 0
    ) {
      return 'building';
    }

    return null;
  }

  function FE_PATCH_07BAssignLightTankAttack(attacker, target, targetKind, options={}) {
    if (typeof clearLightTankAttackMove === 'function') clearLightTankAttackMove(attacker);

    attacker.attackTargetId = target.id;
    attacker.attackTargetKind = targetKind;
    attacker.attackCooldown = Math.min(attacker.attackCooldown || 0, 0.05);
    attacker._attackCommanded = true;
    attacker.state = 'attacking';
    attacker.path = [];
    attacker.manualTarget = null;
    attacker._queuedManualMove = null;
    attacker._dirTargetKey = null;
    attacker._dirDx = 0;
    attacker._dirDy = 0;
    FE_PATCH_06BClearAttackApproach(attacker);

    if (options.marker !== false) {
      const marker = FE_PATCH_06BAttackMarkerPoint(target);
      if (marker) addUnitClickMarker(attacker, marker.x, marker.y, 'ok');
    }
    if (options.toast !== false) showToast('Атака: цель захвачена');
    return true;
  }

  function setLightTankAttackGeneric(attacker, target, options={}) {
    const targetKind = FE_PATCH_07BGetHostileLightTankTargetKind(attacker, target);
    if (!targetKind) return false;

    const stats = getLightTankCombatStats(attacker);
    const distance = targetKind === 'building'
      ? FE_PATCH_06BDistanceToBuilding(attacker, target)
      : unitDistanceCells(attacker, target);
    const marker = options.marker !== false ? FE_PATCH_06BAttackMarkerPoint(target) : null;

    if (distance > stats.range) {
      if (marker) addUnitClickMarker(attacker, marker.x, marker.y, 'bad');
      if (options.toast !== false) showToast('Цель вне дальности');
      return false;
    }

    return FE_PATCH_07BAssignLightTankAttack(attacker, target, targetKind, options);
  }

  function setLightTankAttack(attacker, target) {
    if (!isLightTank(attacker) || !isPlayerUnit(attacker)) return false;
    return setLightTankAttackGeneric(attacker, target, { toast:true, marker:true });
  }

  function updateLightTankCombat(unit, dt) {
    if (!isLightTank(unit)) return;

    if (!unit.attackTargetId) {
      if (unit.state === 'attacking') unit.state = 'idle';
      return;
    }

    const target = FE_PATCH_06BResolveAttackTarget(unit);
    const isBuildingTarget = unit.attackTargetKind === 'building';
    if (!target) {
      FE_PATCH_06BClearAttackTarget(unit);
      return;
    }

    const stats = getLightTankCombatStats(unit);
    const targetKind = FE_PATCH_07BGetHostileLightTankTargetKind(unit, target);
    if (targetKind !== (isBuildingTarget ? 'building' : 'unit')) {
      FE_PATCH_06BClearAttackTarget(unit);
      return;
    }

    const distance = isBuildingTarget
      ? FE_PATCH_06BDistanceToBuilding(unit, target)
      : unitDistanceCells(unit, target);
    if (distance > stats.range) {
      FE_PATCH_06BClearAttackTarget(unit);
      return;
    }

    unit.state = 'attacking';
    unit.path = [];
    unit.attackCooldown = (unit.attackCooldown || 0) - dt;

    if (unit.attackCooldown <= 0) {
      const killed = isBuildingTarget
        ? FE_PATCH_06BDamageBuilding(target, stats.damage)
        : damageUnit(target, stats.damage);
      unit.attackCooldown = stats.cooldown;

      if (killed && !isBuildingTarget) {
        tryRetargetAfterKill(unit, target.id);
      } else if (killed && isBuildingTarget) {
        FE_PATCH_06BClearAttackTarget(unit);
      }
    }
  }

  function findLightTankSpawnCell(owner='enemy', index=0) {
    const hq = findBaseBuilding(owner) || null;
    const fallbackStart =
      owner === 'enemy'
        ? (getPlannedPlayerStarts(2)[1] || { x: game.mapW - 1 - getStart().x, y: game.mapH - 1 - getStart().y })
        : getStart();
    const start = hq
      ? { x: Math.round(hq.x + (hq.w || 2) / 2), y: Math.round(hq.y + (hq.h || 2) / 2) }
      : fallbackStart;

    const sign = owner === 'enemy' ? 1 : -1;
    const preferred = [
      { x:start.x + sign * (5 + index), y:start.y + 2 + index },
      { x:start.x + sign * (5 + index), y:start.y - 2 - index },
      { x:start.x + 2 + index, y:start.y + sign * (5 + index) },
      { x:start.x - 2 - index, y:start.y + sign * (5 + index) }
    ];

    for (const p of preferred) {
      if (passable(p.x, p.y, null)) return p;
    }

    for (let r = 2; r <= 12; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -r; dy <= r; dy++) {
          if (Math.abs(dx) + Math.abs(dy) !== r) continue;
          const x = start.x + dx;
          const y = start.y + dy;
          if (passable(x, y, null)) return { x, y };
        }
      }
    }

    return null;
  }

  function findOwnedUnitSpawnCell(owner='player', type='light_tank', index=0) {
    if (type === 'light_tank') return findLightTankSpawnCell(owner, index);

    const hq = findBaseBuilding(owner) || null;
    const fallbackStart =
      owner === 'enemy'
        ? (getPlannedPlayerStarts(2)[1] || { x: game.mapW - 1 - getStart().x, y: game.mapH - 1 - getStart().y })
        : getStart();
    const start = hq
      ? { x: Math.round(hq.x + (hq.w || 2) / 2), y: Math.round(hq.y + (hq.h || 2) / 2) }
      : fallbackStart;
    const sign = owner === 'enemy' ? 1 : -1;
    const baseStep = type === 'harvester' ? 4 : 3;
    const preferred = [
      { x:start.x + sign * (baseStep + index), y:start.y + 1 + index },
      { x:start.x + sign * (baseStep + index), y:start.y - 1 - index },
      { x:start.x + 1 + index, y:start.y + sign * (baseStep + index) },
      { x:start.x - 1 - index, y:start.y + sign * (baseStep + index) },
      { x:start.x + sign * (baseStep + 1 + index), y:start.y + 3 + index },
      { x:start.x + sign * (baseStep + 1 + index), y:start.y - 3 - index }
    ];

    for (const p of preferred) {
      if (passable(p.x, p.y, null)) return p;
    }

    for (let r = 2; r <= 12; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -r; dy <= r; dy++) {
          if (Math.abs(dx) + Math.abs(dy) !== r) continue;
          const x = start.x + dx;
          const y = start.y + dy;
          if (passable(x, y, null)) return { x, y };
        }
      }
    }

    return null;
  }

  function spawnUnitForOwner(type, owner='player', count=1, options={}) {
    if (!game || game.screen !== 'game') {
      console.warn('[FE PATCH 07B] Start a game before spawning units');
      return [];
    }

    const total = Math.max(1, Math.min(12, Number(count) || 1));
    const spawned = [];

    for (let i = 0; i < total; i++) {
      const cell = findOwnedUnitSpawnCell(owner, type, i);
      if (!cell) break;

      const unit = createUnit(type, cell.x, cell.y);
      unit.owner = owner;
      unit.team = owner;
      unit.faction = defaultFactionForOwner(owner);
      if (type === 'light_tank') {
        unit.hp = getLightTankCombatStats(unit).maxHp;
        unit.maxHp = getLightTankCombatStats(unit).maxHp;
      }
      unit.state = 'idle';
      game.units.push(unit);
      spawned.push(unit);
    }

    if (options.toast !== false && spawned.length) {
      showToast(`${owner === 'enemy' ? 'Enemy' : 'Player'} ${type}: ${spawned.length}`);
    }

    return spawned;
  }

  function ownedUnitsOfType(owner='player', type='light_tank') {
    return (game?.units || []).filter(u => u?.kind === 'unit' && unitOwner(u) === owner && u.type === type);
  }

  function ensureOwnedUnitCount(owner='player', type='light_tank', targetCount=0, options={}) {
    const existing = ownedUnitsOfType(owner, type);
    const missing = Math.max(0, Math.round(targetCount) - existing.length);
    if (missing <= 0) return existing.slice(0, targetCount);
    const spawned = spawnUnitForOwner(type, owner, missing, options);
    return existing.concat(spawned);
  }

  // PATCH-09A1-FIX-FACTION-START-HARVESTER-HELPER-SCOPE
  // FE_PATCH_09A_ENEMY_HARVESTER_AUTOSTART_START
  function FE_PATCH_09AStartEnemyHarvesters(units=[]) {
    if (!Array.isArray(units) || !units.length) return [];
    const started = [];
    for (const unit of units) {
      if (!unit || unit.type !== 'harvester' || unitOwner(unit) !== 'enemy') continue;
      if (unit.autoGather || unit.state === 'moving_to_mine' || unit.state === 'harvesting' || unit.state === 'returning') continue;
      startHarvester(unit);
      started.push(unit);
    }
    if (started.length) {
      console.info('[FE PATCH 09A] Enemy harvesters started', started.map(u => u.id));
    }
    return started;
  }
  // FE_PATCH_09A_ENEMY_HARVESTER_AUTOSTART_END

  function spawnLightTankForOwner(owner='enemy', count=1) {

    const spawned = spawnUnitForOwner('light_tank', owner, count, { toast:false });
    updateFog();
    showToast(owner === 'enemy' ? `Enemy light_tank: ${spawned.length}` : `Player light_tank: ${spawned.length}`);
    return spawned;
  }

  function spawnEnemyLightTankNearPlayer(count = 1) {
    return spawnLightTankForOwner('enemy', count);
  }

  window.FE_SPAWN_ENEMY_TANK = function(count = 1) {
    return spawnEnemyLightTankNearPlayer(count);
  };

  window.FE_SPAWN_PLAYER_TANK = function(count = 1) {
    return spawnLightTankForOwner('player', count);
  };
  // FE_LT_04A_COMBAT_END

  function unitLabel(type) {
    return UNIT_DEFS?.[type]?.name || ({
      harvester: 'Сборщик',
      builder: 'Строитель',
      light_tank: 'Лёгкий танк'
    }[type]) || type;
  }

  function createBuilding(type,x,y,complete=false, owner='player') {
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
      owner,
      faction: defaultFactionForOwner(owner),
      team: owner,
      progress:complete ? 1 : 0,
      buildTime:def.buildTime || 1,
      queue:[],
      _territoryTimer:0
    };
  }

  // FE_PATCH_06A_ENEMY_BASE_SETUP_START
  function buildingOwner(building) {
    return building?.owner || 'player';
  }

  function isPlayerBuilding(building) {
    return !!building && building.kind === 'building' && buildingOwner(building) === 'player';
  }

  function isEnemyBuilding(building) {
    return !!building && building.kind === 'building' && buildingOwner(building) === 'enemy';
  }

  function buildingVisualFaction(building) {
    return building?.faction || defaultFactionForOwner(buildingOwner(building));
  }

  function findBaseBuilding(owner='player') {
    return (game?.buildings || []).find(b => b.type === 'hq_base' && buildingOwner(b) === owner) || null;
  }

  function FE_PATCH_06AEnemyBaseId() {
    return 'enemy_hq_base';
  }

  function FE_PATCH_06AExistingEnemyBase() {
    return (game?.buildings || []).find(b =>
      b &&
      b.kind === 'building' &&
      (b.id === FE_PATCH_06AEnemyBaseId() || (b.type === 'hq_base' && isEnemyBuilding(b)))
    ) || null;
  }

  function FE_PATCH_06AEnemyBaseCandidateStarts() {
    const starts = [];
    const planned = getPlannedPlayerStarts(2);
    const diagonal = getEnemyDiagonalStart();
    const plannedEnemy = planned[1];
    const legacyMirror = {
      x: game.mapW - 1 - getStart().x,
      y: game.mapH - 1 - getStart().y
    };
    const extras = [
      diagonal,
      plannedEnemy,
      { x: game.mapW - (game.mapSize === 'large' ? 18 : 10), y: game.mapSize === 'large' ? 6 : 5 },
      legacyMirror,
      { x: game.mapW - 10, y: 8 },
      { x: game.mapW - 10, y: game.mapH - 12 },
      { x: Math.floor(game.mapW * 0.72), y: Math.floor(game.mapH * 0.24) }
    ];

    const seen = new Set();
    for (const spot of extras) {
      if (!spot) continue;
      const key = `${Math.round(spot.x)},${Math.round(spot.y)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      starts.push({ x: Math.round(spot.x), y: Math.round(spot.y) });
    }

    return starts;
  }

  function FE_PATCH_06AFindEnemyBasePlacement() {
    if (!game) return null;
    const [w, h] = BUILDING_SIZE.hq_base || [2, 2];

    for (const start of FE_PATCH_06AEnemyBaseCandidateStarts()) {
      for (let r = 0; r <= 16; r++) {
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            if (Math.abs(dx) + Math.abs(dy) !== r) continue;
            const x = Math.round(start.x + dx);
            const y = Math.round(start.y + dy);
            if (canPlaceBuilding(x, y, w, h)) return { x, y };
          }
        }
      }
    }

    return null;
  }

  function FE_PATCH_06ASpawnEnemyBase() {
    if (!game || game.screen !== 'game') {
      console.warn('[FE PATCH 06A] Start a game before spawning enemy HQ');
      return null;
    }

    const existing = FE_PATCH_06AExistingEnemyBase();
    if (existing) {
      console.warn('[FE PATCH 06A] Enemy HQ already exists', existing);
      showToast('Enemy HQ exists');
      return existing;
    }

    const spot = FE_PATCH_06AFindEnemyBasePlacement();
    if (!spot) {
      console.warn('[FE PATCH 06A] No valid enemy HQ placement found');
      showToast('Enemy HQ blocked');
      return null;
    }

    const base = createBuilding('hq_base', spot.x, spot.y, true, 'enemy');
    base.id = FE_PATCH_06AEnemyBaseId();
    base.owner = 'enemy';
    base.faction = FE_PATCH_07A3_ENEMY_VISUAL_FACTION;
    base.team = 'enemy';
    base.complete = true;
    base.progress = 1;
    base._territoryTimer = 0;
    game.buildings.push(base);
    game._enemyHqSeen = true;
    updateFog();
    updateHud(true);
    // FE_PATCH_07C_SKIRMISH_SMOKE_STABILIZATION_START
    // Keep this as a quiet dev trace only. Normal new-game flow should not show
    // a debug toast over the faction/gameplay transition.
    console.info('[FE PATCH 07C] Enemy HQ spawned', { id: base.id, x: base.x, y: base.y });
    // FE_PATCH_07C_SKIRMISH_SMOKE_STABILIZATION_END
    return base;
  }

  window.FE_SPAWN_ENEMY_BASE = function() {
    return FE_PATCH_06ASpawnEnemyBase();
  };
  // FE_PATCH_06A_ENEMY_BASE_SETUP_END

  // FE_PATCH_07A_SKIRMISH_SETUP_MVP_START
  function FE_PATCH_07AReadCount(name, fallback, min=0, max=12) {
    const raw = window[name];
    const value = Number.isFinite(raw) ? raw : fallback;
    return Math.max(min, Math.min(max, Math.round(value)));
  }

  function FE_PATCH_07ASetupSkirmishStart(options={}) {
    if (!game || game.screen !== 'game') return null;
    if (window.FE_SKIRMISH_SETUP_ENABLED === false) return null;

    const setupEnemyBase = FE_PATCH_06ASpawnEnemyBase();
    const setupPlayerHarvesters = ensureOwnedUnitCount('player', 'harvester', 2, { toast:false });
    const setupPlayerBuilders = ensureOwnedUnitCount('player', 'builder', 1, { toast:false });
    const setupPlayerTanks = ensureOwnedUnitCount('player', 'light_tank', 1, { toast:false });

    let setupEnemyHarvesters = [];
    let setupEnemyBuilders = [];
    let setupEnemyTanks = [];
    let setupEnemyStarterClusterSpawned = false;

    if (setupEnemyBase) {
      try {
        setupEnemyHarvesters = ensureOwnedUnitCount('enemy', 'harvester', 2, { toast:false });
        setupEnemyBuilders = ensureOwnedUnitCount('enemy', 'builder', 1, { toast:false });
        setupEnemyTanks = ensureOwnedUnitCount('enemy', 'light_tank', 1, { toast:false });
      } catch (error) {
        console.warn('[FE PATCH 07B1] Enemy unit normalization failed; continuing skirmish start', error);
        setupEnemyHarvesters = [];
        setupEnemyBuilders = [];
        setupEnemyTanks = [];
      }
      try {
        setupEnemyStarterClusterSpawned = spawnStarterMineralsAroundBase(setupEnemyBase, 'starter_enemy_runtime');
      } catch (error) {
        console.warn('[FE PATCH 07B1] Enemy starter minerals failed; continuing skirmish start', error);
        setupEnemyStarterClusterSpawned = false;
      }
    }

    if (setupEnemyBase) {
      FE_PATCH_09C2EnsureEnemyScenarioEnergyReserve();
    }

    const setupEnemyHarvestersStarted = setupEnemyBase
      ? FE_PATCH_09AStartEnemyHarvesters(setupEnemyHarvesters)
      : [];

    game.skirmishMode = true;
    game.skirmishStarted = true;
    game.skirmishEnemyBaseId = setupEnemyBase?.id || null;
    game.skirmishStartedAt = game.time || 0;
    game._enemyHqSeen = !!setupEnemyBase;
    game._enemyBotTimer = 0;
    game._enemyBotDelay = 6.5;
    game._enemyBotActivated = false;
    game._enemyBotState = {
      phase: 'defend',
      nextCheckAt: Number(game.time || 0),
      openingUntil: Number(game.time || 0) + 10,
      regroupUntil: 0,
      lastPressureAt: 0,
      lastAttackOrderAt: 0,
      lastDefendOrderAt: 0,
      homeBaseId: setupEnemyBase?.id || null,
      homeX: setupEnemyBase ? Math.round(setupEnemyBase.x + (setupEnemyBase.w || 1) / 2) : 0,
      homeY: setupEnemyBase ? Math.round(setupEnemyBase.y + (setupEnemyBase.h || 1) / 2) : 0,
      lastKnownTargetId: null,
      lastKnownTargetKind: null,
      attackScoreThreshold: 1
    };
    // PATCH-10B: reset runtime-only enemy knowledge shell on a new skirmish start.
    game._enemyKnowledge = null;

    updateFog();
    updateHud(true);

    showToast(`Skirmish: player H${setupPlayerHarvesters.length}/B${setupPlayerBuilders.length}/T${setupPlayerTanks.length}, enemy H${setupEnemyHarvesters.length}/B${setupEnemyBuilders.length}/T${setupEnemyTanks.length}`);
    debugLog('skirmish_setup_mvp', {
      playerHarvesters: setupPlayerHarvesters.length,
      playerBuilders: setupPlayerBuilders.length,
      playerTanks: setupPlayerTanks.length,
      enemyHarvesters: setupEnemyHarvesters.length,
      enemyBuilders: setupEnemyBuilders.length,
      enemyTanks: setupEnemyTanks.length,
      enemyHarvestersStarted: setupEnemyHarvestersStarted.length,
      enemyResources: game.enemyResources ? safeCloneForLog(game.enemyResources) : null,
      enemyBase: setupEnemyBase ? safeCloneForLog(setupEnemyBase) : null,
      enemyStarterClusterSpawned: setupEnemyStarterClusterSpawned
    });

    return {
      enemyBase: setupEnemyBase,
      playerHarvesters: setupPlayerHarvesters,
      playerBuilders: setupPlayerBuilders,
      playerTanks: setupPlayerTanks,
      enemyHarvesters: setupEnemyHarvesters,
      enemyBuilders: setupEnemyBuilders,
      enemyTanks: setupEnemyTanks,
      enemyStarterClusterSpawned: setupEnemyStarterClusterSpawned
    };
  }

  window.FE_SETUP_SKIRMISH_START = function(options={}) {
    return FE_PATCH_07ASetupSkirmishStart(options || {});
  };
  // FE_PATCH_07A_SKIRMISH_SETUP_MVP_END

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
  // FE_PATCH_09A_ENEMY_HARVESTER_MVP_START
  function getStorageLimitsForOwner(owner='player') {
    const resolvedOwner = owner === 'enemy' ? 'enemy' : 'player';
    const limits = Object.assign({}, BASE_STORAGE);
    if (!game) return limits;
    for (const b of game.buildings || []) {
      if (buildingOwner(b) !== resolvedOwner) continue;
      if (!b.complete) continue;
      const bonus = BUILDINGS[b.type]?.storageBonus;
      if (!bonus) continue;
      for (const [k,v] of Object.entries(bonus)) limits[k] = (limits[k] || 0) + v;
    }
    return limits;
  }

  function getStorageLimits() {
    return getStorageLimitsForOwner('player');
  }

  function ensureEnemyResources() {
    if (!game.enemyResources || typeof game.enemyResources !== 'object') {
      game.enemyResources = {};
    }
    const defaults = { minerals:0, energy:0, purple:0, greenEl:0, cyanEl:0, yellowEl:0 };
    for (const [key, value] of Object.entries(defaults)) {
      if (!Number.isFinite(game.enemyResources[key])) game.enemyResources[key] = value;
    }
    return game.enemyResources;
  }

  function resourcesForOwner(owner='player') {
    return owner === 'enemy' ? ensureEnemyResources() : game.resources;
  }

  function resourceSpaceForOwner(owner='player', name='minerals') {
    const limits = getStorageLimitsForOwner(owner);
    const bucket = resourcesForOwner(owner);
    return Math.max(0, (limits[name] ?? Infinity) - (bucket[name] || 0));
  }

  function resourceSpace(name) {
    return resourceSpaceForOwner('player', name);
  }

  function addResourceForOwner(owner='player', name='minerals', amount=0) {
    if (owner !== 'enemy') return addResource(name, amount);
    const bucket = ensureEnemyResources();
    const old = bucket[name] || 0;
    const limits = getStorageLimitsForOwner('enemy');
    const max = limits[name] ?? Infinity;
    const next = clamp(old + amount, 0, max);
    bucket[name] = next;
    return next - old;
  }
  // FE_PATCH_09A_ENEMY_HARVESTER_MVP_END

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
      if (!isPlayerBuilding(b)) continue;
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
      if (!isPlayerBuilding(b)) continue;
      if (!b.complete || b.type !== 'separator') continue;
      if (!canRunSeparatorCycle()) continue;
      if (tryReservePower(b, cfg.separatorMw)) activeSeparatorCount += 1;
    }

    for (const b of game.buildings || []) {
      if (!isPlayerBuilding(b)) continue;
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

  // PATCH-09B2-ECONOMY-BASELINE-FIX: separator formula baseline is 15 raw minerals -> 10 energy + 1 faction element.
  function canRunSeparatorCycle() {
    const elKey = factionElementKey();
    return (
      game.resources.minerals >= 15 &&
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
    return ['builder', 'harvester', 'light_tank', 'scout'].some(type => {
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

    // 15 сырья -> 10 энергии + 1 элемент фракции.
    // Если энергия/элементы забиты или мощности не хватает, переработка ставится на паузу.
    if (activeSepCount && canRunSeparatorCycle()) {
      game._sepTimer += dt * activeSepCount;
      if (game._sepTimer >= 6.0) {
        game._sepTimer = 0;
        if (canRunSeparatorCycle()) {
          addResource('minerals', -15);
          addResource('energy', 10);
          addResource(factionElementKey(), 1);
        }
      }
    }

    FE_PATCH_09C3UpdateEnemySeparatorProduction(dt);
    FE_PATCH_09EUpdateEnemyFactoryProduction(dt);

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
    if (type === 'harvester' || type === 'builder' || type === 'scout') return faction.civilianProductionSpeed || 1;
    return faction.combatProductionSpeed || 1;
  }

  function findSpawnCellNearBuilding(b) {
    const cells = adjacentFreeCellsForRect(b.x,b.y,b.w,b.h,null);
    cells.sort((a,b2)=>dist({x:b.x,y:b.y},a)-dist({x:b.x,y:b.y},b2));
    return cells[0] || null;
  }

  function updateUnitProduction(dt) {
    for (const b of game.buildings) {
      if (!isPlayerBuilding(b)) continue;
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

  // FE_PATCH_07B_BOT_CONTROLLER_MVP_START
  const FE_PATCH_08B_BOT_KNOBS = {
    checkIntervalMs: 1200,
    openingDelayMs: 10000,
    defendRadiusTiles: 12,
    attackScoreThreshold: 1,
    regroupDelayMs: 8000,
    maxChaseDistanceTiles: 18,
    minOrderGapMs: 2400,
    regroupArriveRadiusTiles: 3
  };

  const FE_10I1_BOT_BEHAVIOR_PROFILES = {
    normal: {
      checkIntervalMs: 1200,
      openingDelayMs: 10000,
      defendRadiusTiles: 12,
      attackScoreThreshold: 1,
      regroupDelayMs: 8000,
      maxChaseDistanceTiles: 18,
      minOrderGapMs: 2400,
      regroupArriveRadiusTiles: 3,
      scoutThinkIntervalMs: 6500,
      retreatCooldownMs: 20000,
      maxAttackWaveSize: 999
    },
    easy: {
      checkIntervalMs: 2000,
      openingDelayMs: 16000,
      defendRadiusTiles: 12,
      attackScoreThreshold: 2,
      regroupDelayMs: 12000,
      maxChaseDistanceTiles: 14,
      minOrderGapMs: 3200,
      regroupArriveRadiusTiles: 4,
      scoutThinkIntervalMs: 10000,
      retreatCooldownMs: 30000,
      maxAttackWaveSize: 2
    }
  };

  function FE_10I1_getGameObject() {
    if (typeof game !== 'undefined' && game) return game;
    if (typeof state !== 'undefined' && state) return state;
    if (typeof gameState !== 'undefined' && gameState) return gameState;
    return null;
  }

  function FE_10I1_resolveProfileName() {
    const g = FE_10I1_getGameObject();
    const raw = String(g?.enemyBotDifficulty || '').toLowerCase();
    if (raw && FE_10I1_BOT_BEHAVIOR_PROFILES[raw]) {
      return { profile: raw, source: 'game.enemyBotDifficulty' };
    }
    if (g && !g.enemyBotDifficulty) g.enemyBotDifficulty = 'normal';
    return { profile: 'normal', source: 'runtime_default' };
  }

  function FE_10I1_knobs() {
    const g = FE_10I1_getGameObject();
    const resolved = FE_10I1_resolveProfileName();
    const base = FE_10I1_BOT_BEHAVIOR_PROFILES.normal;
    const profile = FE_10I1_BOT_BEHAVIOR_PROFILES[resolved.profile] || base;
    const knobs = { ...base, ...profile };

    if (g) {
      const telemetry = g.enemyDifficultyMvp || (g.enemyDifficultyMvp = {
        profile: resolved.profile,
        source: resolved.source,
        appliedKnobs: {},
        lastAppliedAt: 0,
        affectsScouting: true,
        affectsAttack: true,
        affectsRetreat: true,
        affectsProduction: false
      });
      telemetry.profile = resolved.profile;
      telemetry.source = resolved.source;
      telemetry.appliedKnobs = { ...knobs };
      telemetry.lastAppliedAt = (typeof performance !== 'undefined' ? performance.now() : Date.now());
      telemetry.affectsScouting = true;
      telemetry.affectsAttack = true;
      telemetry.affectsRetreat = true;
      telemetry.affectsProduction = false;
    }

    return knobs;
  }

  function FE_PATCH_08BNow() {
    return Number(game?.time || 0);
  }

  function FE_PATCH_08BSeconds(ms) {
    return ms / 1000;
  }

  function FE_PATCH_08BEnemyCombatUnits() {
    return (game?.units || []).filter(u =>
      u &&
      isLightTank(u) &&
      isEnemyUnit(u) &&
      (u.hp || 0) > 0
    );
  }

  function FE_PATCH_08BResolveEnemyHomeBase(state=null) {
    const preferredId = state?.homeBaseId || game?._enemyBotState?.homeBaseId || null;
    if (preferredId) {
      const byId = (game?.buildings || []).find(b => b && b.id === preferredId && (b.hp || 0) > 0);
      if (byId) return byId;
    }
    return FE_PATCH_06AExistingEnemyBase() || findBaseBuilding('enemy') || null;
  }

  function FE_PATCH_08BHomeAnchorFromBase(base) {
    if (!base) return { x:0, y:0 };
    return {
      x: Math.round(base.x + (base.w || 1) / 2),
      y: Math.round(base.y + (base.h || 1) / 2)
    };
  }

  function FE_PATCH_08BEnsureBotState() {
    if (!game) return null;

    const now = FE_PATCH_08BNow();
    const base = FE_PATCH_08BResolveEnemyHomeBase();
    const anchor = FE_PATCH_08BHomeAnchorFromBase(base);
    const existing = game._enemyBotState || {};
    const state = {
      phase: existing.phase || 'defend',
      nextCheckAt: Number.isFinite(existing.nextCheckAt) ? existing.nextCheckAt : now,
      openingUntil: Number.isFinite(existing.openingUntil) ? existing.openingUntil : now + FE_PATCH_08BSeconds(FE_10I1_knobs().openingDelayMs),
      regroupUntil: Number.isFinite(existing.regroupUntil) ? existing.regroupUntil : 0,
      lastPressureAt: Number.isFinite(existing.lastPressureAt) ? existing.lastPressureAt : 0,
      lastAttackOrderAt: Number.isFinite(existing.lastAttackOrderAt) ? existing.lastAttackOrderAt : 0,
      lastDefendOrderAt: Number.isFinite(existing.lastDefendOrderAt) ? existing.lastDefendOrderAt : 0,
      homeBaseId: existing.homeBaseId || base?.id || null,
      homeX: Number.isFinite(existing.homeX) ? existing.homeX : anchor.x,
      homeY: Number.isFinite(existing.homeY) ? existing.homeY : anchor.y,
      lastKnownTargetId: existing.lastKnownTargetId || null,
      lastKnownTargetKind: existing.lastKnownTargetKind || null,
      attackScoreThreshold: Number.isFinite(existing.attackScoreThreshold)
        ? existing.attackScoreThreshold
        : FE_10I1_knobs().attackScoreThreshold
    };

    if (base) {
      state.homeBaseId = base.id;
      state.homeX = anchor.x;
      state.homeY = anchor.y;
    }

    game._enemyBotState = state;
    return state;
  }

  function FE_PATCH_08BResolveBotTarget(targetId, targetKind=null) {
    if (!targetId) return null;
    if (targetKind === 'building') {
      return (game?.buildings || []).find(b => b && b.id === targetId && (b.hp || 0) > 0) || null;
    }
    return (game?.units || []).find(u => u && u.id === targetId && (u.hp || 0) > 0) || null;
  }

  // FE_PATCH_10B_ENEMY_VISION_MEMORY_SHELL_START
  // Runtime-only enemy vision/memory shell. This patch observes and remembers;
  // it intentionally does not change current bot defend/attack decisions yet.
  function FE_PATCH_10BCreateEnemyKnowledge() {
    return {
      updatedAt: 0,
      visibleUnitIds: [],
      visibleBuildingIds: [],
      knownUnitsById: Object.create(null),
      knownBuildingsById: Object.create(null),
      lastVisibleCounts: { units:0, buildings:0 }
    };
  }

  function FE_PATCH_10BEnsureEnemyKnowledge() {
    if (!game) return null;
    const existing = game._enemyKnowledge;
    if (existing && existing.knownUnitsById && existing.knownBuildingsById) return existing;
    game._enemyKnowledge = FE_PATCH_10BCreateEnemyKnowledge();
    return game._enemyKnowledge;
  }

  function FE_PATCH_10BTargetCenter(target) {
    if (!target) return null;
    const w = Number(target.w || 1);
    const h = Number(target.h || 1);
    return {
      x: Math.round(Number(target.x || 0) + Math.max(0, w - 1) / 2),
      y: Math.round(Number(target.y || 0) + Math.max(0, h - 1) / 2)
    };
  }

  function FE_PATCH_10BObjectAlive(o) {
    return !!(o && !o.destroyed && !o.dead && (o.hp ?? 1) > 0);
  }

  function FE_PATCH_10BSightRadiusForSource(source) {
    if (!source) return 0;
    if (source.kind === 'building') return 6;
    if (source.type === 'harvester') return 5;
    return 4;
  }

  function FE_PATCH_10BCollectEnemyVisionSources() {
    const sources = [];
    for (const b of game?.buildings || []) {
      if (!FE_PATCH_10BObjectAlive(b)) continue;
      if (typeof buildingOwner === 'function' && buildingOwner(b) !== 'enemy') continue;
      if (!b.complete) continue;
      const p = FE_PATCH_10BTargetCenter(b);
      if (!p) continue;
      sources.push({ id:b.id || '', kind:'building', type:b.type || 'building', x:p.x, y:p.y, radius:FE_PATCH_10BSightRadiusForSource(b) });
    }
    for (const u of game?.units || []) {
      if (!FE_PATCH_10BObjectAlive(u)) continue;
      if (typeof unitOwner === 'function' && unitOwner(u) !== 'enemy') continue;
      sources.push({ id:u.id || '', kind:'unit', type:u.type || 'unit', x:Math.round(Number(u.x || 0)), y:Math.round(Number(u.y || 0)), radius:FE_PATCH_10BSightRadiusForSource(u) });
    }
    return sources;
  }

  function FE_PATCH_10BEnemyCanSeeCell(x, y) {
    const tx = Math.round(Number(x));
    const ty = Math.round(Number(y));
    if (!Number.isFinite(tx) || !Number.isFinite(ty)) return false;
    const sources = FE_PATCH_10BCollectEnemyVisionSources();
    return sources.some(source => Math.abs(source.x - tx) + Math.abs(source.y - ty) <= source.radius);
  }

  function enemyCanSeeTarget(target) {
    if (!target || !FE_PATCH_10BObjectAlive(target)) return false;
    if (target.kind === 'building') {
      const x0 = Math.round(Number(target.x || 0));
      const y0 = Math.round(Number(target.y || 0));
      const w = Math.max(1, Math.round(Number(target.w || 1)));
      const h = Math.max(1, Math.round(Number(target.h || 1)));
      for (let y = y0; y < y0 + h; y++) {
        for (let x = x0; x < x0 + w; x++) {
          if (FE_PATCH_10BEnemyCanSeeCell(x, y)) return true;
        }
      }
      const c = FE_PATCH_10BTargetCenter(target);
      return !!(c && FE_PATCH_10BEnemyCanSeeCell(c.x, c.y));
    }
    const c = FE_PATCH_10BTargetCenter(target);
    return !!(c && FE_PATCH_10BEnemyCanSeeCell(c.x, c.y));
  }

  function FE_PATCH_10BKnownCollectionForKind(knowledge, kind) {
    return kind === 'building' ? knowledge.knownBuildingsById : knowledge.knownUnitsById;
  }

  function FE_PATCH_10BUpsertKnownTarget(knowledge, target, kind, now, visibleNow) {
    if (!knowledge || !target?.id) return null;
    const c = FE_PATCH_10BTargetCenter(target);
    if (!c) return null;
    const collection = FE_PATCH_10BKnownCollectionForKind(knowledge, kind);
    const previous = collection[target.id] || {};
    const lastSeenAt = visibleNow ? now : Number(previous.lastSeenAt || 0);
    const confidence = visibleNow
      ? 1
      : Math.max(0, Math.min(1, Number(previous.confidence || 0) - 0.05));

    const entry = {
      id: target.id,
      kind,
      type: target.type || 'unknown',
      lastSeenX: visibleNow ? c.x : Number.isFinite(previous.lastSeenX) ? previous.lastSeenX : c.x,
      lastSeenY: visibleNow ? c.y : Number.isFinite(previous.lastSeenY) ? previous.lastSeenY : c.y,
      lastSeenAt,
      confidence,
      visibleNow: !!visibleNow
    };
    collection[target.id] = entry;
    return entry;
  }

  function FE_PATCH_10BMarkKnownInvisible(knowledge) {
    if (!knowledge) return;
    for (const entry of Object.values(knowledge.knownUnitsById || {})) if (entry) entry.visibleNow = false;
    for (const entry of Object.values(knowledge.knownBuildingsById || {})) if (entry) entry.visibleNow = false;
  }

  function FE_PATCH_10BPruneEnemyKnowledge(now=FE_PATCH_08BNow()) {
    const knowledge = FE_PATCH_10BEnsureEnemyKnowledge();
    if (!knowledge) return null;

    for (const [id, entry] of Object.entries(knowledge.knownUnitsById || {})) {
      const current = (game?.units || []).find(u => u && u.id === id);
      if (!FE_PATCH_10BObjectAlive(current)) delete knowledge.knownUnitsById[id];
      else if (!entry.visibleNow) entry.confidence = Math.max(0, 1 - Math.max(0, now - Number(entry.lastSeenAt || 0)) / 75);
    }
    for (const [id, entry] of Object.entries(knowledge.knownBuildingsById || {})) {
      const current = (game?.buildings || []).find(b => b && b.id === id);
      if (!FE_PATCH_10BObjectAlive(current)) delete knowledge.knownBuildingsById[id];
      else if (!entry.visibleNow) entry.confidence = Math.max(0, 1 - Math.max(0, now - Number(entry.lastSeenAt || 0)) / 90);
    }
    return knowledge;
  }

  function FE_PATCH_10BRefreshEnemyKnowledge(now=FE_PATCH_08BNow()) {
    const knowledge = FE_PATCH_10BEnsureEnemyKnowledge();
    if (!knowledge) return null;

    FE_PATCH_10BMarkKnownInvisible(knowledge);
    knowledge.updatedAt = now;
    knowledge.visibleUnitIds = [];
    knowledge.visibleBuildingIds = [];

    for (const u of game?.units || []) {
      if (!FE_PATCH_10BObjectAlive(u)) continue;
      if (typeof isPlayerUnit === 'function' ? !isPlayerUnit(u) : unitOwner(u) !== 'player') continue;
      if (!enemyCanSeeTarget(u)) continue;
      FE_PATCH_10BUpsertKnownTarget(knowledge, u, 'unit', now, true);
      knowledge.visibleUnitIds.push(u.id);
    }

    for (const b of game?.buildings || []) {
      if (!FE_PATCH_10BObjectAlive(b)) continue;
      if (typeof buildingOwner === 'function' && buildingOwner(b) !== 'player') continue;
      if (!enemyCanSeeTarget(b)) continue;
      FE_PATCH_10BUpsertKnownTarget(knowledge, b, 'building', now, true);
      knowledge.visibleBuildingIds.push(b.id);
    }

    knowledge.lastVisibleCounts = {
      units: knowledge.visibleUnitIds.length,
      buildings: knowledge.visibleBuildingIds.length
    };
    FE_PATCH_10BPruneEnemyKnowledge(now);
    return knowledge;
  }

  function FE_PATCH_10BEnemyKnowledgeDebugSummary() {
    const knowledge = FE_PATCH_10BEnsureEnemyKnowledge();
    if (!knowledge) {
      return { visibleUnits:0, visibleBuildings:0, knownUnits:0, knownBuildings:0, top:'' };
    }
    const knownUnits = Object.values(knowledge.knownUnitsById || {});
    const knownBuildings = Object.values(knowledge.knownBuildingsById || {});
    const now = FE_PATCH_08BNow();
    const topEntries = knownUnits.concat(knownBuildings)
      .sort((a, b) => Number(b.lastSeenAt || 0) - Number(a.lastSeenAt || 0))
      .slice(0, 3)
      .map(entry => {
        const age = Math.max(0, now - Number(entry.lastSeenAt || 0));
        const conf = Math.round(Math.max(0, Math.min(1, Number(entry.confidence || 0))) * 100);
        return `${entry.kind}:${entry.type}@${entry.lastSeenX},${entry.lastSeenY} ${entry.visibleNow ? 'visible' : Math.round(age) + 's'} ${conf}%`;
      });
    return {
      visibleUnits: (knowledge.visibleUnitIds || []).length,
      visibleBuildings: (knowledge.visibleBuildingIds || []).length,
      knownUnits: knownUnits.length,
      knownBuildings: knownBuildings.length,
      updatedAt: knowledge.updatedAt || 0,
      top: topEntries.join(' | ') || 'none'
    };
  }
  // FE_PATCH_10B_ENEMY_VISION_MEMORY_SHELL_END

  function FE_PATCH_08BNearestPlayerLightTankFrom(source, maxDistance=Infinity) {
    const candidates = (game?.units || [])
      .filter(u => u && isLightTank(u) && isPlayerUnit(u) && (u.hp || 0) > 0)
      .map(u => ({ unit: u, distance: unitDistanceCells(source, u) }))
      .filter(entry => entry.distance <= maxDistance)
      .sort((a, b) => a.distance - b.distance);
    return candidates[0]?.unit || null;
  }

  function FE_PATCH_07BNearestPlayerLightTank(attacker) {
    return FE_PATCH_08BNearestPlayerLightTankFrom(attacker);
  }

  function FE_PATCH_08BTargetInRange(attacker, target) {
    const targetKind = FE_PATCH_07BGetHostileLightTankTargetKind(attacker, target);
    if (!targetKind) return false;
    return targetKind === 'building'
      ? FE_PATCH_06BDistanceToBuilding(attacker, target) <= getLightTankCombatStats(attacker).range
      : unitDistanceCells(attacker, target) <= getLightTankCombatStats(attacker).range;
  }

  function FE_PATCH_08BUnitHasTarget(unit, target) {
    if (!unit || !target) return false;
    return unit.attackTargetId === target.id || unit.attackApproachTargetId === target.id;
  }

  function FE_PATCH_08BNeedsNewAttackOrder(unit, target, now, lastOrderAt) {
    if (!unit || !target) return false;
    if (FE_PATCH_08BUnitHasTarget(unit, target)) return false;
    if (unit.path && unit.path.length && unit.state === 'attack_approach') return false;
    if ((now - (lastOrderAt || 0)) < FE_PATCH_08BSeconds(FE_10I1_knobs().minOrderGapMs)) return false;
    return true;
  }

  function FE_PATCH_08BSetKnownTarget(state, target, attacker) {
    if (!state || !target || !attacker) return;
    state.lastKnownTargetId = target.id || null;
    state.lastKnownTargetKind = FE_PATCH_07BGetHostileLightTankTargetKind(attacker, target);
  }

  function FE_PATCH_08BCommandEnemyTankAttack(unit, target, state, orderType='attack') {
  // PATCH-10F1: last safety net against direct hidden attack targets.
  if (orderType === 'attack' && !FE_PATCH_10F1CanDirectAttackTarget(target, orderType)) {
    const telemetry10f1 = FE_PATCH_10F1Telemetry();
    if (telemetry10f1) {
      telemetry10f1.status = 'hidden_target_blocked';
      telemetry10f1.source = telemetry10f1.source || 'none';
      telemetry10f1.blockedHiddenTargetCount = (telemetry10f1.blockedHiddenTargetCount || 0) + 1;
      telemetry10f1.lastDecisionReason = 'attack_order_hidden_target_blocked';
      telemetry10f1.attackAllowedByVision = false;
      telemetry10f1.lastAttackSelectionAt = FE_PATCH_10F1Now();
    }
    return false;
  }

    if (!unit || !target || !state) return false;
    if (!FE_PATCH_08BNeedsNewAttackOrder(unit, target, FE_PATCH_08BNow(), orderType === 'defend' ? state.lastDefendOrderAt : state.lastAttackOrderAt)) {
      return false;
    }

    const targetKind = FE_PATCH_07BGetHostileLightTankTargetKind(unit, target);
    if (!targetKind) return false;

    let changed = false;
    if (FE_PATCH_08BTargetInRange(unit, target)) {
      changed = FE_PATCH_07BAssignLightTankAttack(unit, target, targetKind, { toast:false, marker:false });
    } else {
      changed = setLightTankAttackApproachGeneric(unit, target, { toast:false, marker:false });
    }
    if (!changed) return false;

    FE_PATCH_08BSetKnownTarget(state, target, unit);
    if (orderType === 'defend') {
      state.lastDefendOrderAt = FE_PATCH_08BNow();
    } else {
      state.lastAttackOrderAt = FE_PATCH_08BNow();
    }
    return true;
  }

  function FE_PATCH_08BCurrentDestination(unit) {
    if (!unit?.path?.length) return null;
    const goal = unit.path[unit.path.length - 1];
    if (!goal) return null;
    return { x: Math.round(goal.x), y: Math.round(goal.y) };
  }

  function FE_PATCH_08BHomeDestinationCell(unit, state) {
    if (!unit || !state) return null;
    return findNearestLightTankDestinationCell(state.homeX, state.homeY, unit.id) || null;
  }

  function FE_PATCH_08BSilentMoveTo(unit, tx, ty) {
    if (!unit || !Number.isFinite(tx) || !Number.isFinite(ty)) return false;
    if (typeof clearLightTankAttackMove === 'function') clearLightTankAttackMove(unit);

    if (unit.path && unit.path.length && unitIsBetweenGridCells(unit)) {
      queueManualMove(unit, tx, ty);
      unit.state = 'manual_move';
      unit.manualTarget = null;
      return true;
    }

    const path = findPath(unit, { x: tx, y: ty }, unit.id);
    if (path === null) return false;

    unit.path = path;
    unit.state = 'manual_move';
    unit.manualTarget = null;
    unit._queuedManualMove = null;
    unit._dirTargetKey = null;
    unit._dirDx = 0;
    unit._dirDy = 0;
    return true;
  }

  function FE_PATCH_08BReturnUnitHome(unit, state) {
    if (!unit || !state) return false;
    const dest = FE_PATCH_08BHomeDestinationCell(unit, state);
    if (!dest) return false;

    const currentGoal = FE_PATCH_08BCurrentDestination(unit);
    if (currentGoal && currentGoal.x === dest.x && currentGoal.y === dest.y) return false;
    if ((FE_PATCH_08BNow() - (unit._enemyBotLastMoveOrderAt || 0)) < FE_PATCH_08BSeconds(FE_10I1_knobs().minOrderGapMs)) {
      return false;
    }
    if (!FE_PATCH_08BSilentMoveTo(unit, dest.x, dest.y)) return false;

    unit._enemyBotLastMoveOrderAt = FE_PATCH_08BNow();
    unit._enemyBotHomeX = dest.x;
    unit._enemyBotHomeY = dest.y;
    return true;
  }

  function FE_PATCH_08BArmyScore(units) {
    return (units || []).filter(u => u && (u.hp || 0) > 0).length;
  }

  function FE_PATCH_08BThreatNearHome(state) {
    if (!state) return null;
    const home = { x: state.homeX, y: state.homeY };
    return FE_PATCH_08BNearestPlayerLightTankFrom(home, FE_10I1_knobs().defendRadiusTiles);
  }

  
// PATCH-10F1-VISION-DRIVEN-TARGET-SELECTION_START
function FE_PATCH_10F1Now() {
  return (typeof performance !== 'undefined' ? performance.now() : Date.now());
}

function FE_PATCH_10F1Game() {
  if (typeof game !== 'undefined' && game) return game;
  if (typeof window !== 'undefined' && window.FE_CORE && window.FE_CORE.game) return window.FE_CORE.game;
  return null;
}

function FE_PATCH_10F1Telemetry() {
  const g = FE_PATCH_10F1Game();
  if (!g) return null;
  const t = g.enemyTargetingMvp || (g.enemyTargetingMvp = {
    status: 'init',
    source: 'none',
    targetType: null,
    targetId: null,
    visibleNow: false,
    confidence: 0,
    blockedHiddenTargetCount: 0,
    lastDecisionReason: '',
    knownUnits: 0,
    knownBuildings: 0,
    visibleUnits: 0,
    visibleBuildings: 0,
    assumedScoutPoint: null,
    lastAttackSelectionAt: 0,
  });
  return t;
}

function FE_PATCH_10F1ObjectId(obj) {
  return obj?.id || obj?.uid || obj?._id || obj?.uuid || null;
}

function FE_PATCH_10F1TileX(obj) {
  return Math.round(Number.isFinite(obj?.x) ? obj.x : (Number.isFinite(obj?.tx) ? obj.tx : (Number.isFinite(obj?.tileX) ? obj.tileX : 0)));
}

function FE_PATCH_10F1TileY(obj) {
  return Math.round(Number.isFinite(obj?.y) ? obj.y : (Number.isFinite(obj?.ty) ? obj.ty : (Number.isFinite(obj?.tileY) ? obj.tileY : 0)));
}

function FE_PATCH_10F1Dist(a, b) {
  const ax = Number.isFinite(a?.x) ? a.x : FE_PATCH_10F1TileX(a);
  const ay = Number.isFinite(a?.y) ? a.y : FE_PATCH_10F1TileY(a);
  const bx = Number.isFinite(b?.x) ? b.x : FE_PATCH_10F1TileX(b);
  const by = Number.isFinite(b?.y) ? b.y : FE_PATCH_10F1TileY(b);
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

function FE_PATCH_10F1IsAlive(obj) {
  if (!obj) return false;
  if (obj.dead || obj.destroyed || obj.removed) return false;
  if (Number.isFinite(obj.hp) && obj.hp <= 0) return false;
  if (Number.isFinite(obj.health) && obj.health <= 0) return false;
  return true;
}

function FE_PATCH_10F1ResolveEntry(entry) {
  if (!entry || !entry.id) return null;
  const g = FE_PATCH_10F1Game();
  if (!g) return null;
  const kind = String(entry.kind || '').toLowerCase();
  if (kind === 'unit') {
    return (g.units || []).find((u) => FE_PATCH_10F1ObjectId(u) === entry.id && FE_PATCH_10F1IsAlive(u)) || null;
  }
  if (kind === 'building') {
    return (g.buildings || []).find((b) => FE_PATCH_10F1ObjectId(b) === entry.id && FE_PATCH_10F1IsAlive(b)) || null;
  }
  return (
    (g.units || []).find((u) => FE_PATCH_10F1ObjectId(u) === entry.id && FE_PATCH_10F1IsAlive(u)) ||
    (g.buildings || []).find((b) => FE_PATCH_10F1ObjectId(b) === entry.id && FE_PATCH_10F1IsAlive(b)) ||
    null
  );
}

function FE_PATCH_10F1KnownEntries(collection) {
  if (!collection) return [];
  if (collection instanceof Map) return Array.from(collection.values());
  if (Array.isArray(collection)) return collection;
  if (typeof collection === 'object') return Object.values(collection);
  return [];
}

function FE_PATCH_10F1EntryScore(entry, source) {
  const conf = Number.isFinite(entry?.confidence) ? entry.confidence : 0;
  const dist = FE_PATCH_10F1Dist(source || { x: entry?.lastSeenX || 0, y: entry?.lastSeenY || 0 }, {
    x: entry?.lastSeenX || 0,
    y: entry?.lastSeenY || 0
  });
  const visibleBonus = entry?.visibleNow ? -1000 : 0;
  const type = String(entry?.type || '').toLowerCase();
  const combatBonus = type.includes('tank') ? -80 : 0;
  return visibleBonus + combatBonus + dist - conf * 10;
}

function FE_PATCH_10F1RefreshTelemetryFromKnowledge(t, knowledge) {
  if (!t) return;
  const unitEntries = FE_PATCH_10F1KnownEntries(knowledge?.knownUnitsById);
  const buildingEntries = FE_PATCH_10F1KnownEntries(knowledge?.knownBuildingsById);
  t.knownUnits = unitEntries.length;
  t.knownBuildings = buildingEntries.length;
  t.visibleUnits = unitEntries.filter((e) => !!e?.visibleNow).length;
  t.visibleBuildings = buildingEntries.filter((e) => !!e?.visibleNow).length;
}

function FE_PATCH_10F1Decision(source, target, meta) {
  return {
    source: meta?.source || 'none',
    target: target || null,
    targetType: meta?.targetType || (target?.type || target?.kind || null),
    targetId: FE_PATCH_10F1ObjectId(target) || null,
    visibleNow: !!meta?.visibleNow,
    confidence: Number.isFinite(meta?.confidence) ? meta.confidence : 0,
    reason: meta?.reason || '',
    assumedScoutPoint: meta?.assumedScoutPoint || null,
    canDirectAttack: !!target && (meta?.source === 'visible' || meta?.source === 'known'),
  };
}

function FE_PATCH_10F1SelectAttackDecision(state, enemyUnits) {
  const g = FE_PATCH_10F1Game();
  const t = FE_PATCH_10F1Telemetry();
  const now = FE_PATCH_10F1Now();
  const source = enemyUnits?.[0] || { x: state?.homeX || 0, y: state?.homeY || 0 };

  let knowledge = null;
  try {
    knowledge = (typeof FE_PATCH_10BEnsureEnemyKnowledge === 'function') ? FE_PATCH_10BEnsureEnemyKnowledge() : (g && g._enemyKnowledge);
  } catch (_) {
    knowledge = g && g._enemyKnowledge;
  }

  FE_PATCH_10F1RefreshTelemetryFromKnowledge(t, knowledge);

  const unitEntries = FE_PATCH_10F1KnownEntries(knowledge?.knownUnitsById);
  const buildingEntries = FE_PATCH_10F1KnownEntries(knowledge?.knownBuildingsById);
  const allEntries = unitEntries.concat(buildingEntries);

  // 1) Visible targets only: direct attack is allowed.
  const visibleEntries = allEntries
    .filter((e) => e && e.visibleNow && Number.isFinite(e.confidence) && e.confidence > 0)
    .sort((a, b) => FE_PATCH_10F1EntryScore(a, source) - FE_PATCH_10F1EntryScore(b, source));

  for (const entry of visibleEntries) {
    const target = FE_PATCH_10F1ResolveEntry(entry);
    if (target) {
      return FE_PATCH_10F1Decision(source, target, {
        source: 'visible',
        targetType: entry.type || entry.kind || target.type || 'unknown',
        visibleNow: true,
        confidence: entry.confidence,
        reason: 'visible_target_selected'
      });
    }
  }

  // 2) High-confidence remembered targets. Direct attack can remain allowed only while confidence is high.
  // This is the MVP compromise: memory is allowed, exact hidden HQ fallback is not.
  const MIN_KNOWN_CONFIDENCE = 0.72;
  const MAX_KNOWN_AGE_MS = 90000;
  const knownEntries = allEntries
    .filter((e) => {
      if (!e) return false;
      const conf = Number.isFinite(e.confidence) ? e.confidence : 0;
      const age = Number.isFinite(e.lastSeenAt) ? now - e.lastSeenAt : Infinity;
      return !e.visibleNow && conf >= MIN_KNOWN_CONFIDENCE && age <= MAX_KNOWN_AGE_MS;
    })
    .sort((a, b) => FE_PATCH_10F1EntryScore(a, source) - FE_PATCH_10F1EntryScore(b, source));

  for (const entry of knownEntries) {
    const target = FE_PATCH_10F1ResolveEntry(entry);
    if (target) {
      return FE_PATCH_10F1Decision(source, target, {
        source: 'known',
        targetType: entry.type || entry.kind || target.type || 'unknown',
        visibleNow: false,
        confidence: entry.confidence,
        reason: 'high_confidence_known_target_selected'
      });
    }
  }

  // 3) Assumed/last-seen point is allowed as information only, not direct attack target.
  const lastSeen = allEntries
    .filter((e) => e && Number.isFinite(e.lastSeenX) && Number.isFinite(e.lastSeenY))
    .sort((a, b) => (b.lastSeenAt || 0) - (a.lastSeenAt || 0))[0];

  if (lastSeen) {
    const point = { x: Math.round(lastSeen.lastSeenX), y: Math.round(lastSeen.lastSeenY) };
    return FE_PATCH_10F1Decision(source, null, {
      source: 'assumed',
      targetType: null,
      confidence: Number.isFinite(lastSeen.confidence) ? lastSeen.confidence : 0,
      assumedScoutPoint: point,
      reason: 'assumed_point_only_no_direct_attack'
    });
  }

  return FE_PATCH_10F1Decision(source, null, {
    source: 'none',
    reason: 'no_safe_target_defend'
  });
}

function FE_PATCH_10F1WriteDecisionTelemetry(decision) {
  const t = FE_PATCH_10F1Telemetry();
  if (!t || !decision) return;

  t.status =
    decision.source === 'visible' ? 'visible_target_selected' :
    decision.source === 'known' ? 'known_target_selected' :
    decision.source === 'assumed' ? 'assumed_point_only_no_direct_attack' :
    'no_safe_target_defend';

  t.source = decision.source || 'none';
  t.targetType = decision.targetType || null;
  t.targetId = decision.targetId || null;
  t.visibleNow = !!decision.visibleNow;
  t.confidence = Number.isFinite(decision.confidence) ? decision.confidence : 0;
  t.lastDecisionReason = decision.reason || t.status;
  t.assumedScoutPoint = decision.assumedScoutPoint || null;
  t.attackAllowedByVision = !!decision.canDirectAttack;
  t.lastAttackSelectionAt = FE_PATCH_10F1Now();
}

function FE_PATCH_10F1CanDirectAttackTarget(target, orderType) {
  if (!target) return false;

  // Local defense / guard behavior is intentionally left alone.
  if (orderType === 'defend') return true;

  const g = FE_PATCH_10F1Game();
  const knowledge = g && g._enemyKnowledge;
  const targetId = FE_PATCH_10F1ObjectId(target);
  if (!targetId || !knowledge) return false;

  const allEntries = FE_PATCH_10F1KnownEntries(knowledge.knownUnitsById).concat(FE_PATCH_10F1KnownEntries(knowledge.knownBuildingsById));
  const entry = allEntries.find((e) => e && e.id === targetId);
  if (!entry) return false;

  if (entry.visibleNow) return true;

  const conf = Number.isFinite(entry.confidence) ? entry.confidence : 0;
  const age = Number.isFinite(entry.lastSeenAt) ? FE_PATCH_10F1Now() - entry.lastSeenAt : Infinity;
  return conf >= 0.72 && age <= 90000;
}
// PATCH-10F1-VISION-DRIVEN-TARGET-SELECTION_END

function FE_PATCH_08BAttackTarget(state, enemyUnits) {
  // PATCH-10F1: attack target selection must go through enemy vision/knowledge.
  const decision = FE_PATCH_10F1SelectAttackDecision(state, enemyUnits);
  FE_PATCH_10F1WriteDecisionTelemetry(decision);

  // Assumed/last-seen positions are for scouting/move only, not direct attack.
  if (!decision || !decision.canDirectAttack || !decision.target) {
    return null;
  }

  return decision.target;
}


  function FE_PATCH_08BStartRegroup(state, reason='attack_reset') {
    if (!state) return;
    state.phase = 'regroup';
    state.regroupUntil = FE_PATCH_08BNow() + FE_PATCH_08BSeconds(FE_10I1_knobs().regroupDelayMs);
    state.lastKnownTargetId = null;
    state.lastKnownTargetKind = null;
    state.regroupReason = reason;
  }

  function FE_PATCH_08BShouldKeepUnitNearHome(unit, state, radius=FE_10I1_knobs().defendRadiusTiles) {
    if (!unit || !state) return false;
    return unitDistanceCells(unit, { x: state.homeX, y: state.homeY }) > radius;
  }

  function FE_PATCH_08BAttackStateInvalid(enemyUnits, state) {
    if (!enemyUnits?.length || !state) return true;
    const target = FE_PATCH_08BResolveBotTarget(state.lastKnownTargetId, state.lastKnownTargetKind);
    if (!target) return true;
    return enemyUnits.every(unit => !FE_PATCH_08BUnitHasTarget(unit, target) && unit.state !== 'attack_approach' && unit.state !== 'attacking');
  }

  function FE_PATCH_08BOverChasing(enemyUnits, state) {
    if (!enemyUnits?.length || !state) return false;
    return enemyUnits.some(unit =>
      unitDistanceCells(unit, { x: state.homeX, y: state.homeY }) > FE_10I1_knobs().maxChaseDistanceTiles
    );
  }

  function FE_PATCH_08BDefend(enemyUnits, threat, state) {
    if (!enemyUnits?.length || !threat || !state) return false;
    state.phase = 'defend';
    state.lastPressureAt = FE_PATCH_08BNow();

    let issued = false;
    for (const unit of enemyUnits) {
      issued = FE_PATCH_08BCommandEnemyTankAttack(unit, threat, state, 'defend') || issued;
    }
    return issued;
  }

  function FE_PATCH_08BPrepareAttack(enemyUnits, state) {
    if (!enemyUnits?.length || !state) return false;
    if (FE_PATCH_08BArmyScore(enemyUnits) < Math.max(1, Number(state.attackScoreThreshold || FE_10I1_knobs().attackScoreThreshold))) {
      for (const unit of enemyUnits) {
        if (FE_PATCH_08BShouldKeepUnitNearHome(unit, state, FE_10I1_knobs().regroupArriveRadiusTiles)) {
          FE_PATCH_08BReturnUnitHome(unit, state);
        }
      }
      state.phase = 'defend';
      return false;
    }

    const target = FE_PATCH_08BAttackTarget(state, enemyUnits);
    if (!target) {
      state.phase = 'defend';
      return false;
    }

    let issued = false;
    const waveSize = Math.max(1, Math.min(enemyUnits.length, Number(FE_10I1_knobs().maxAttackWaveSize || enemyUnits.length)));
    for (const unit of enemyUnits.slice(0, waveSize)) {
      issued = FE_PATCH_08BCommandEnemyTankAttack(unit, target, state, 'attack') || issued;
    }

    if (issued) {
      state.phase = 'attack';
      return true;
    }
    return false;
  }

  
  // PATCH-10C1-ENEMY-SCOUTING-MVP-LIGHT_START
  function FE_10C1_getGameObject() {
    if (typeof game !== 'undefined' && game) return game;
    if (typeof state !== 'undefined' && state) return state;
    if (typeof gameState !== 'undefined' && gameState) return gameState;
    return null;
  }

  function FE_10C1_getUnitList() {
    const g = FE_10C1_getGameObject();
    if (g && Array.isArray(g.units)) return g.units;
    if (typeof units !== 'undefined' && Array.isArray(units)) return units;
    return [];
  }

  function FE_10C1_getBuildingList() {
    const g = FE_10C1_getGameObject();
    if (g && Array.isArray(g.buildings)) return g.buildings;
    if (typeof buildings !== 'undefined' && Array.isArray(buildings)) return buildings;
    return [];
  }

  function FE_10C1_getMapSize() {
    const g = FE_10C1_getGameObject();
    const width =
      (g && Number.isFinite(g.mapWidth) && g.mapWidth) ||
      (g && g.map && Number.isFinite(g.map.width) && g.map.width) ||
      (typeof MAP_W !== 'undefined' && Number.isFinite(MAP_W) && MAP_W) ||
      (typeof MAP_WIDTH !== 'undefined' && Number.isFinite(MAP_WIDTH) && MAP_WIDTH) ||
      80;
    const height =
      (g && Number.isFinite(g.mapHeight) && g.mapHeight) ||
      (g && g.map && Number.isFinite(g.map.height) && g.map.height) ||
      (typeof MAP_H !== 'undefined' && Number.isFinite(MAP_H) && MAP_H) ||
      (typeof MAP_HEIGHT !== 'undefined' && Number.isFinite(MAP_HEIGHT) && MAP_HEIGHT) ||
      80;
    return { width, height };
  }

  function FE_10C1_unitTileX(u) {
    return Math.round(Number.isFinite(u?.tx) ? u.tx : (Number.isFinite(u?.tileX) ? u.tileX : (u?.x || 0)));
  }

  function FE_10C1_unitTileY(u) {
    return Math.round(Number.isFinite(u?.ty) ? u.ty : (Number.isFinite(u?.tileY) ? u.tileY : (u?.y || 0)));
  }

  function FE_10C1_distTiles(a, b) {
    const ax = Number.isFinite(a?.x) ? a.x : FE_10C1_unitTileX(a);
    const ay = Number.isFinite(a?.y) ? a.y : FE_10C1_unitTileY(a);
    const bx = Number.isFinite(b?.x) ? b.x : FE_10C1_unitTileX(b);
    const by = Number.isFinite(b?.y) ? b.y : FE_10C1_unitTileY(b);
    return Math.abs(ax - bx) + Math.abs(ay - by);
  }

  function FE_10C1_isEnemyUnit(u) {
    return !!u && (u.owner === 'enemy' || u.side === 'enemy' || u.player === 'enemy');
  }

  function FE_10C1_isCombatScoutCandidate(u) {
    if (!FE_10C1_isEnemyUnit(u)) return false;
    const t = String(u.type || '').toLowerCase();
    return t === 'light_tank' || t.includes('tank');
  }

  function FE_10C1_getEnemyHQ() {
    return FE_10C1_getBuildingList().find((b) => {
      if (!b) return false;
      const ownerOk = b.owner === 'enemy' || b.side === 'enemy' || b.player === 'enemy';
      const type = String(b.type || b.kind || '').toLowerCase();
      return ownerOk && (type.includes('hq') || type.includes('base'));
    }) || null;
  }

  function FE_10C1_chooseScoutTargets() {
    const { width, height } = FE_10C1_getMapSize();
    const clamp = (v, min, max) => Math.max(min, Math.min(max, Math.round(v)));
    const enemyHQ = FE_10C1_getEnemyHQ();
    const center = { x: clamp(width / 2, 4, width - 5), y: clamp(height / 2, 4, height - 5), label: 'center' };

    // No omniscience: this is not the real player HQ. It is only a likely opposite-corner guess.
    let oppositeGuess = { x: 4, y: 4, label: 'opposite-corner-guess' };
    if (enemyHQ) {
      const ex = Number.isFinite(enemyHQ.x) ? enemyHQ.x : (enemyHQ.tx || enemyHQ.tileX || 0);
      const ey = Number.isFinite(enemyHQ.y) ? enemyHQ.y : (enemyHQ.ty || enemyHQ.tileY || 0);
      oppositeGuess = {
        x: ex > width / 2 ? 4 : width - 5,
        y: ey > height / 2 ? 4 : height - 5,
        label: 'opposite-corner-guess'
      };
    }

    return [
      center,
      oppositeGuess,
      { x: clamp(width * 0.25, 4, width - 5), y: clamp(height * 0.50, 4, height - 5), label: 'west-mid' },
      { x: clamp(width * 0.75, 4, width - 5), y: clamp(height * 0.50, 4, height - 5), label: 'east-mid' },
      { x: clamp(width * 0.50, 4, width - 5), y: clamp(height * 0.25, 4, height - 5), label: 'north-mid' },
      { x: clamp(width * 0.50, 4, width - 5), y: clamp(height * 0.75, 4, height - 5), label: 'south-mid' },
    ];
  }

  function FE_10G1_knownEntries(collection) {
    if (!collection) return [];
    if (Array.isArray(collection)) return collection;
    if (collection instanceof Map) return Array.from(collection.values());
    if (typeof collection === 'object') return Object.values(collection);
    return [];
  }

  function FE_10G1_clampScoutPoint(point) {
    if (!point) return null;
    const { width, height } = FE_10C1_getMapSize();
    const clamp = (v, min, max) => Math.max(min, Math.min(max, Math.round(v)));
    return {
      x: clamp(point.x, 4, width - 5),
      y: clamp(point.y, 4, height - 5),
      label: point.label || 'scout',
      source: point.source || 'map_probe',
      confidence: Number.isFinite(point.confidence) ? point.confidence : 0,
      reason: point.reason || ''
    };
  }

  function FE_10G1_isHiddenPlayerHqKnowledgeEntry(entry) {
    if (!entry) return false;
    const kind = String(entry.kind || '').toLowerCase();
    const type = String(entry.type || '').toLowerCase();
    return kind === 'building' && (type === 'hq_base' || type.includes('hq') || type.includes('base'));
  }

  function FE_10G1_entryAgeSeconds(entry, nowGameTime) {
    if (!Number.isFinite(nowGameTime) || !Number.isFinite(entry?.lastSeenAt)) return Infinity;
    return Math.max(0, nowGameTime - entry.lastSeenAt);
  }

  function FE_10G1_entryScoutScore(entry, source, nowGameTime) {
    const conf = Number.isFinite(entry?.confidence) ? entry.confidence : 0;
    const age = FE_10G1_entryAgeSeconds(entry, nowGameTime);
    const point = {
      x: Number.isFinite(entry?.lastSeenX) ? entry.lastSeenX : 0,
      y: Number.isFinite(entry?.lastSeenY) ? entry.lastSeenY : 0
    };
    const dist = FE_10C1_distTiles(source || point, point);
    const type = String(entry?.type || '').toLowerCase();
    const visibleBonus = entry?.visibleNow ? 1000 : 0;
    const combatBonus = type.includes('tank') ? 200 : 0;
    return visibleBonus + combatBonus + conf * 100 - age * 2 - dist * 0.35;
  }

  function FE_10G1_chooseKnowledgeScoutTarget(sourceUnit=null) {
    const g = FE_10C1_getGameObject();
    const knowledge = (typeof FE_PATCH_10BEnsureEnemyKnowledge === 'function')
      ? FE_PATCH_10BEnsureEnemyKnowledge()
      : (g && g._enemyKnowledge);
    if (!knowledge) return null;

    const nowGameTime = (typeof FE_PATCH_08BNow === 'function')
      ? FE_PATCH_08BNow()
      : Number(g?.time || 0);
    const source = sourceUnit || FE_10C1_getEnemyHQ() || { x: 0, y: 0 };
    const entries = FE_10G1_knownEntries(knowledge.knownUnitsById)
      .concat(FE_10G1_knownEntries(knowledge.knownBuildingsById))
      .filter((entry) => entry && Number.isFinite(entry.lastSeenX) && Number.isFinite(entry.lastSeenY))
      .filter((entry) => !FE_10G1_isHiddenPlayerHqKnowledgeEntry(entry));

    if (!entries.length) return null;

    const freshKnowledge = entries
      .filter((entry) => {
        if (entry.visibleNow) return true;
        const conf = Number.isFinite(entry.confidence) ? entry.confidence : 0;
        const age = FE_10G1_entryAgeSeconds(entry, nowGameTime);
        return conf >= 0.55 && age <= 90;
      })
      .sort((a, b) => FE_10G1_entryScoutScore(b, source, nowGameTime) - FE_10G1_entryScoutScore(a, source, nowGameTime));

    if (freshKnowledge.length) {
      const entry = freshKnowledge[0];
      return FE_10G1_clampScoutPoint({
        x: entry.lastSeenX,
        y: entry.lastSeenY,
        label: entry.visibleNow ? 'knowledge-visible' : 'knowledge-fresh',
        source: 'knowledge',
        confidence: Number.isFinite(entry.confidence) ? entry.confidence : 0,
        reason: entry.visibleNow ? 'visible_player_contact' : 'fresh_confident_last_seen'
      });
    }

    const staleLastSeen = entries
      .filter((entry) => FE_10G1_entryAgeSeconds(entry, nowGameTime) <= 180)
      .sort((a, b) => {
        const bySeen = Number(b.lastSeenAt || 0) - Number(a.lastSeenAt || 0);
        if (bySeen !== 0) return bySeen;
        return FE_10G1_entryScoutScore(b, source, nowGameTime) - FE_10G1_entryScoutScore(a, source, nowGameTime);
      });

    if (staleLastSeen.length) {
      const entry = staleLastSeen[0];
      return FE_10G1_clampScoutPoint({
        x: entry.lastSeenX,
        y: entry.lastSeenY,
        label: 'last-seen-area',
        source: 'last_seen',
        confidence: Number.isFinite(entry.confidence) ? entry.confidence : 0,
        reason: 'stale_last_seen_probe'
      });
    }

    return null;
  }

  function FE_10G1_isUnitBusyForScout(unit) {
    if (!unit) return true;
    const s = String(unit.state || unit.command || '').toLowerCase();
    return !!(
      unit.attackTargetId ||
      unit.attackApproachTargetId ||
      unit.attackTarget ||
      unit._attackCommanded ||
      unit._fe10d1Role === 'defend' ||
      unit._fe10d1Role === 'return' ||
      unit._fe10e1Role === 'strength_wait' ||
      s === 'attacking' ||
      s === 'attack_approach' ||
      s === 'attack' ||
      s === 'attack_move' ||
      s.includes('attack') ||
      s.includes('retreat')
    );
  }

  function FE_10C1_trySetScoutMove(unit, target) {
    if (!unit || !target) return false;

    if (unit.attackTargetId || unit.attackTarget || unit._attackCommanded) return false;

    const tx = Math.round(target.x);
    const ty = Math.round(target.y);

    const helperNames = [
      'issueUnitMoveCommand',
      'commandMoveUnit',
      'moveUnitTo',
      'setUnitDestination',
      'orderUnitMove',
      'setUnitMoveTarget'
    ];

    for (const name of helperNames) {
      try {
        const fn = (typeof window !== 'undefined' && window[name]) || (typeof globalThis !== 'undefined' && globalThis[name]);
        if (typeof fn === 'function') {
          const result = fn(unit, tx, ty, { silent: true, source: 'enemy_scouting_mvp' });
          unit._fe10c1ScoutTarget = {
            x: tx,
            y: ty,
            label: target.label || 'scout',
            source: target.source || 'map_probe',
            confidence: Number.isFinite(target.confidence) ? target.confidence : 0,
            reason: target.reason || ''
          };
          unit._fe10c1ScoutIssuedAt = (typeof performance !== 'undefined' ? performance.now() : Date.now());
          unit._fe10c1Role = 'scout';
          return result !== false;
        }
      } catch (_) {}
    }

    try {
      unit.destination = { x: tx, y: ty };
      unit.moveTarget = { x: tx, y: ty };
      unit.targetTile = { x: tx, y: ty };
      unit.targetX = tx;
      unit.targetY = ty;
      unit.destX = tx;
      unit.destY = ty;
      unit.goalX = tx;
      unit.goalY = ty;
      unit.command = unit.command || 'move';
      unit.state = unit.state === 'attacking' ? 'moving' : (unit.state || 'moving');
      unit.attackTargetId = null;
      unit.attackTarget = null;
      unit._attackCommanded = false;
      unit._fe10c1ScoutTarget = {
        x: tx,
        y: ty,
        label: target.label || 'scout',
        source: target.source || 'map_probe',
        confidence: Number.isFinite(target.confidence) ? target.confidence : 0,
        reason: target.reason || ''
      };
      unit._fe10c1ScoutIssuedAt = (typeof performance !== 'undefined' ? performance.now() : Date.now());
      unit._fe10c1Role = 'scout';

      const maybePathFn =
        (typeof findPath === 'function' && findPath) ||
        (typeof window !== 'undefined' && typeof window.findPath === 'function' && window.findPath) ||
        null;
      if (maybePathFn) {
        try {
          const sx = FE_10C1_unitTileX(unit);
          const sy = FE_10C1_unitTileY(unit);
          const path = maybePathFn(sx, sy, tx, ty);
          if (Array.isArray(path) && path.length) {
            unit.path = path;
            unit.pathIndex = 0;
          }
        } catch (_) {}
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  function FE_10C1_updateEnemyScoutingMvp() {
    const g = FE_10C1_getGameObject();
    if (!g) return;

    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const scoutState = g.enemyScoutingMvp || (g.enemyScoutingMvp = {
      enabled: true,
      nextThinkAt: 0,
      targetIndex: -1,
      currentTarget: null,
      lastIssuedAt: 0,
      lastScoutUnitId: null,
      issuedCount: 0,
      targetSource: 'none',
      targetConfidence: 0,
      targetReason: '',
      lastKnowledgeScoutPoint: null,
      knowledgeScoutIssuedCount: 0,
      fallbackScoutIssuedCount: 0,
    });

    if (!scoutState.enabled) return;
    if (now < (scoutState.nextThinkAt || 0)) return;

    scoutState.nextThinkAt = now + FE_10I1_knobs().scoutThinkIntervalMs;

    const enemyTanks = FE_10C1_getUnitList().filter(FE_10C1_isCombatScoutCandidate);
    scoutState.availableCombatScouts = enemyTanks.length;

    if (enemyTanks.length < 2) {
      scoutState.status = 'waiting_for_second_tank';
      scoutState.targetSource = 'none';
      scoutState.targetConfidence = 0;
      scoutState.targetReason = 'need_two_tanks_for_scout';
      return;
    }

    const activeScout = enemyTanks.find((u) => {
      if (u._fe10c1Role !== 'scout' || !u._fe10c1ScoutTarget) return false;
      const age = now - (u._fe10c1ScoutIssuedAt || 0);
      const d = FE_10C1_distTiles(u, u._fe10c1ScoutTarget);
      return age < 26000 && d > 3;
    });

    if (activeScout) {
      scoutState.status = 'scout_en_route';
      scoutState.lastScoutUnitId = activeScout.id || activeScout.uid || null;
      scoutState.currentTarget = activeScout._fe10c1ScoutTarget;
      scoutState.targetSource = activeScout._fe10c1ScoutTarget?.source || 'map_probe';
      scoutState.targetConfidence = Number.isFinite(activeScout._fe10c1ScoutTarget?.confidence) ? activeScout._fe10c1ScoutTarget.confidence : 0;
      scoutState.targetReason = activeScout._fe10c1ScoutTarget?.reason || 'existing_scout_en_route';
      return;
    }

    const scout = enemyTanks.find((u) => !FE_10G1_isUnitBusyForScout(u));
    if (!scout) {
      scoutState.status = 'no_free_scout';
      scoutState.targetSource = 'none';
      scoutState.targetConfidence = 0;
      scoutState.targetReason = 'all_tanks_busy';
      return;
    }

    const knowledgeTarget = FE_10G1_chooseKnowledgeScoutTarget(scout);
    let target = knowledgeTarget;
    if (!target) {
      const targets = FE_10C1_chooseScoutTargets();
      scoutState.targetIndex = ((scoutState.targetIndex || 0) + 1) % targets.length;
      target = FE_10G1_clampScoutPoint({
        ...targets[scoutState.targetIndex],
        source: 'map_probe',
        confidence: 0,
        reason: 'map_probe_fallback'
      });
    }

    const ok = FE_10C1_trySetScoutMove(scout, target);
    scoutState.status = ok ? 'scout_order_issued' : 'scout_order_failed';
    scoutState.currentTarget = target;
    scoutState.lastIssuedAt = now;
    scoutState.lastScoutUnitId = scout.id || scout.uid || null;
    scoutState.targetSource = target?.source || 'none';
    scoutState.targetConfidence = Number.isFinite(target?.confidence) ? target.confidence : 0;
    scoutState.targetReason = target?.reason || (ok ? 'scout_target_selected' : 'scout_target_failed');
    if (target?.source === 'knowledge' || target?.source === 'last_seen') {
      scoutState.lastKnowledgeScoutPoint = target ? { x: target.x, y: target.y, source: target.source, confidence: scoutState.targetConfidence } : null;
    }
    if (ok) {
      scoutState.issuedCount = (scoutState.issuedCount || 0) + 1;
      if (target?.source === 'knowledge' || target?.source === 'last_seen') {
        scoutState.knowledgeScoutIssuedCount = (scoutState.knowledgeScoutIssuedCount || 0) + 1;
      } else {
        scoutState.fallbackScoutIssuedCount = (scoutState.fallbackScoutIssuedCount || 0) + 1;
      }
    }
  }
  // PATCH-10C1-ENEMY-SCOUTING-MVP-LIGHT_END



  // PATCH-10D1-ENEMY-UNIT-AUTOPILOT-GUARD-PATROL_START
  function FE_10D1_getGameObject() {
    if (typeof FE_10C1_getGameObject === 'function') return FE_10C1_getGameObject();
    if (typeof game !== 'undefined' && game) return game;
    if (typeof state !== 'undefined' && state) return state;
    if (typeof gameState !== 'undefined' && gameState) return gameState;
    return null;
  }

  function FE_10D1_getUnitList() {
    if (typeof FE_10C1_getUnitList === 'function') return FE_10C1_getUnitList();
    const g = FE_10D1_getGameObject();
    if (g && Array.isArray(g.units)) return g.units;
    if (typeof units !== 'undefined' && Array.isArray(units)) return units;
    return [];
  }

  function FE_10D1_getBuildingList() {
    if (typeof FE_10C1_getBuildingList === 'function') return FE_10C1_getBuildingList();
    const g = FE_10D1_getGameObject();
    if (g && Array.isArray(g.buildings)) return g.buildings;
    if (typeof buildings !== 'undefined' && Array.isArray(buildings)) return buildings;
    return [];
  }

  function FE_10D1_unitTileX(u) {
    if (typeof FE_10C1_unitTileX === 'function') return FE_10C1_unitTileX(u);
    return Math.round(Number.isFinite(u?.tx) ? u.tx : (Number.isFinite(u?.tileX) ? u.tileX : (u?.x || 0)));
  }

  function FE_10D1_unitTileY(u) {
    if (typeof FE_10C1_unitTileY === 'function') return FE_10C1_unitTileY(u);
    return Math.round(Number.isFinite(u?.ty) ? u.ty : (Number.isFinite(u?.tileY) ? u.tileY : (u?.y || 0)));
  }

  function FE_10D1_distTiles(a, b) {
    const ax = Number.isFinite(a?.x) ? a.x : FE_10D1_unitTileX(a);
    const ay = Number.isFinite(a?.y) ? a.y : FE_10D1_unitTileY(a);
    const bx = Number.isFinite(b?.x) ? b.x : FE_10D1_unitTileX(b);
    const by = Number.isFinite(b?.y) ? b.y : FE_10D1_unitTileY(b);
    return Math.abs(ax - bx) + Math.abs(ay - by);
  }

  function FE_10D1_isEnemyUnit(u) {
    return !!u && (u.owner === 'enemy' || u.side === 'enemy' || u.player === 'enemy');
  }

  function FE_10D1_isPlayerUnit(u) {
    return !!u && (u.owner === 'player' || u.side === 'player' || u.player === 'player');
  }

  function FE_10D1_isEnemyTank(u) {
    if (!FE_10D1_isEnemyUnit(u)) return false;
    const t = String(u.type || '').toLowerCase();
    return t === 'light_tank' || t.includes('tank');
  }

  function FE_10D1_getObjectId(obj) {
    return obj?.id || obj?.uid || obj?._id || obj?.uuid || null;
  }

  function FE_10D1_getEnemyHQ() {
    return FE_10D1_getBuildingList().find((b) => {
      if (!b) return false;
      const ownerOk = b.owner === 'enemy' || b.side === 'enemy' || b.player === 'enemy';
      const type = String(b.type || b.kind || '').toLowerCase();
      return ownerOk && (type.includes('hq') || type.includes('base'));
    }) || null;
  }

  function FE_10D1_isActiveScout(unit) {
    return unit?._fe10c1Role === 'scout' || unit?._scouting === true;
  }

  function FE_10D1_hasActiveAttackOrder(unit) {
    if (!unit) return false;
    const s = String(unit.state || unit.command || '').toLowerCase();
    return !!(
      unit.attackTargetId ||
      unit.attackApproachTargetId ||
      unit.attackTarget ||
      unit._attackCommanded ||
      s === 'attacking' ||
      s === 'attack_approach' ||
      s === 'attack' ||
      s.includes('attack')
    );
  }

  function FE_10D1_hasMeaningfulMoveOrder(unit) {
    if (!unit) return false;
    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());

    // Let our own autopilot order finish briefly instead of spamming a new one every think tick.
    if (unit._fe10d1Target && now - (unit._fe10d1IssuedAt || 0) < 9000) {
      if (FE_10D1_distTiles(unit, unit._fe10d1Target) > 2) return true;
    }

    const tx =
      Number.isFinite(unit.targetX) ? unit.targetX :
      Number.isFinite(unit.destX) ? unit.destX :
      Number.isFinite(unit.goalX) ? unit.goalX :
      (unit.destination && Number.isFinite(unit.destination.x) ? unit.destination.x :
      (unit.moveTarget && Number.isFinite(unit.moveTarget.x) ? unit.moveTarget.x :
      (unit.targetTile && Number.isFinite(unit.targetTile.x) ? unit.targetTile.x : null)));

    const ty =
      Number.isFinite(unit.targetY) ? unit.targetY :
      Number.isFinite(unit.destY) ? unit.destY :
      Number.isFinite(unit.goalY) ? unit.goalY :
      (unit.destination && Number.isFinite(unit.destination.y) ? unit.destination.y :
      (unit.moveTarget && Number.isFinite(unit.moveTarget.y) ? unit.moveTarget.y :
      (unit.targetTile && Number.isFinite(unit.targetTile.y) ? unit.targetTile.y : null)));

    if (tx === null || ty === null) return false;

    const state = String(unit.state || unit.command || '').toLowerCase();
    if (state.includes('moving') || state === 'move' || state === 'moving' || Array.isArray(unit.path)) {
      return FE_10D1_distTiles(unit, { x: tx, y: ty }) > 2;
    }

    return false;
  }

  function FE_10D1_findLocalPlayerThreat(unit, enemyHQ) {
    const candidates = FE_10D1_getUnitList().filter(FE_10D1_isPlayerUnit);
    if (!candidates.length) return null;

    let best = null;
    let bestScore = Infinity;

    for (const p of candidates) {
      const dUnit = FE_10D1_distTiles(unit, p);
      const dHq = enemyHQ ? FE_10D1_distTiles(enemyHQ, p) : Infinity;

      // This is local vision/proximity, not full-map omniscience.
      const locallyVisible = dUnit <= 6 || dHq <= 9;
      if (!locallyVisible) continue;

      const type = String(p.type || '').toLowerCase();
      const combatBias = type.includes('tank') ? -2 : 0;
      const score = Math.min(dUnit, dHq) + combatBias;
      if (score < bestScore) {
        best = p;
        bestScore = score;
      }
    }

    return best;
  }

  function FE_10D1_tryAttack(unit, target) {
    if (!unit || !target) return false;
    const id = FE_10D1_getObjectId(target);
    if (!id) return false;

    const helperNames = [
      'assignAttack',
      'issueUnitAttackCommand',
      'commandAttackUnit',
      'orderUnitAttack',
      'setAttackTarget'
    ];

    for (const name of helperNames) {
      try {
        const fn = (typeof window !== 'undefined' && window[name]) || (typeof globalThis !== 'undefined' && globalThis[name]);
        if (typeof fn === 'function') {
          const result = fn(unit, target, { silent: true, source: 'enemy_autopilot_guard' });
          unit._fe10d1Role = 'defend';
          unit._fe10d1IssuedAt = (typeof performance !== 'undefined' ? performance.now() : Date.now());
          return result !== false;
        }
      } catch (_) {}
    }

    try {
      unit.attackTargetId = id;
      unit.attackTarget = target;
      unit._attackCommanded = true;
      unit.state = 'attack_approach';
      unit.command = 'attack';
      unit._fe10d1Role = 'defend';
      unit._fe10d1IssuedAt = (typeof performance !== 'undefined' ? performance.now() : Date.now());
      return true;
    } catch (_) {
      return false;
    }
  }

  function FE_10D1_tryMove(unit, target, reason) {
    if (!unit || !target) return false;

    const tx = Math.round(target.x);
    const ty = Math.round(target.y);

    const helperNames = [
      'issueUnitMoveCommand',
      'commandMoveUnit',
      'moveUnitTo',
      'setUnitDestination',
      'orderUnitMove',
      'setUnitMoveTarget'
    ];

    for (const name of helperNames) {
      try {
        const fn = (typeof window !== 'undefined' && window[name]) || (typeof globalThis !== 'undefined' && globalThis[name]);
        if (typeof fn === 'function') {
          const result = fn(unit, tx, ty, { silent: true, source: 'enemy_autopilot_guard' });
          unit._fe10d1Target = { x: tx, y: ty, reason: reason || 'move' };
          unit._fe10d1IssuedAt = (typeof performance !== 'undefined' ? performance.now() : Date.now());
          unit._fe10d1Role = reason || 'patrol';
          return result !== false;
        }
      } catch (_) {}
    }

    try {
      unit.destination = { x: tx, y: ty };
      unit.moveTarget = { x: tx, y: ty };
      unit.targetTile = { x: tx, y: ty };
      unit.targetX = tx;
      unit.targetY = ty;
      unit.destX = tx;
      unit.destY = ty;
      unit.goalX = tx;
      unit.goalY = ty;
      unit.command = 'move';
      unit.state = unit.state === 'attacking' || unit.state === 'attack_approach' ? 'moving' : (unit.state || 'moving');
      unit._fe10d1Target = { x: tx, y: ty, reason: reason || 'move' };
      unit._fe10d1IssuedAt = (typeof performance !== 'undefined' ? performance.now() : Date.now());
      unit._fe10d1Role = reason || 'patrol';

      const maybePathFn =
        (typeof findPath === 'function' && findPath) ||
        (typeof window !== 'undefined' && typeof window.findPath === 'function' && window.findPath) ||
        null;

      if (maybePathFn) {
        try {
          const sx = FE_10D1_unitTileX(unit);
          const sy = FE_10D1_unitTileY(unit);
          const path = maybePathFn(sx, sy, tx, ty);
          if (Array.isArray(path) && path.length) {
            unit.path = path;
            unit.pathIndex = 0;
          }
        } catch (_) {}
      }

      return true;
    } catch (_) {
      return false;
    }
  }

  function FE_10D1_patrolPointNear(anchor, unit, index) {
    const ax = Number.isFinite(anchor?.x) ? anchor.x : FE_10D1_unitTileX(anchor);
    const ay = Number.isFinite(anchor?.y) ? anchor.y : FE_10D1_unitTileY(anchor);
    const seed = (index || 0) + (Number(FE_10D1_getObjectId(unit)) || 0);
    const points = [
      { x: ax + 4, y: ay },
      { x: ax - 4, y: ay },
      { x: ax, y: ay + 4 },
      { x: ax, y: ay - 4 },
      { x: ax + 3, y: ay + 3 },
      { x: ax - 3, y: ay - 3 },
    ];
    const p = points[Math.abs(seed) % points.length];
    return { x: Math.max(2, Math.round(p.x)), y: Math.max(2, Math.round(p.y)) };
  }

  function FE_10D1_updateEnemyUnitAutopilotGuard() {
    const g = FE_10D1_getGameObject();
    if (!g) return;

    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const auto = g.enemyAutopilotMvp || (g.enemyAutopilotMvp = {
      enabled: true,
      nextThinkAt: 0,
      status: 'init',
      patrolIssuedCount: 0,
      returnIssuedCount: 0,
      defendIssuedCount: 0,
      skippedScoutCount: 0,
      skippedBusyCount: 0,
      lastThinkAt: 0,
    });

    if (!auto.enabled) return;
    if (now < (auto.nextThinkAt || 0)) return;

    auto.nextThinkAt = now + 2400;
    auto.lastThinkAt = now;

    const enemyHQ = FE_10D1_getEnemyHQ();
    if (!enemyHQ) {
      auto.status = 'no_enemy_hq';
      return;
    }

    const tanks = FE_10D1_getUnitList().filter(FE_10D1_isEnemyTank);
    auto.enemyTankCount = tanks.length;

    if (!tanks.length) {
      auto.status = 'no_enemy_tanks';
      return;
    }

    let actions = 0;
    let skippedScout = 0;
    let skippedBusy = 0;

    for (let i = 0; i < tanks.length; i++) {
      const u = tanks[i];
      if (!u) continue;

      if (FE_10D1_isActiveScout(u)) {
        skippedScout++;
        continue;
      }

      if (FE_10D1_hasActiveAttackOrder(u)) {
        skippedBusy++;
        continue;
      }

      if (FE_10D1_hasMeaningfulMoveOrder(u)) {
        skippedBusy++;
        continue;
      }

      const threat = FE_10D1_findLocalPlayerThreat(u, enemyHQ);
      if (threat && FE_10D1_tryAttack(u, threat)) {
        auto.defendIssuedCount++;
        actions++;
        if (actions >= 2) break;
        continue;
      }

      const distToHq = FE_10D1_distTiles(u, enemyHQ);
      if (distToHq > 18) {
        const hqx = Number.isFinite(enemyHQ.x) ? enemyHQ.x : FE_10D1_unitTileX(enemyHQ);
        const hqy = Number.isFinite(enemyHQ.y) ? enemyHQ.y : FE_10D1_unitTileY(enemyHQ);
        const target = { x: hqx + ((i % 3) - 1) * 2, y: hqy + (((i + 1) % 3) - 1) * 2 };
        if (FE_10D1_tryMove(u, target, 'return')) {
          auto.returnIssuedCount++;
          actions++;
          if (actions >= 2) break;
        }
        continue;
      }

      // Light patrol only for clearly idle/free tanks. Do not spam every tick.
      const lastPatrolAt = u._fe10d1PatrolAt || 0;
      if (distToHq <= 12 && now - lastPatrolAt > 9000) {
        const p = FE_10D1_patrolPointNear(enemyHQ, u, i + (auto.patrolIssuedCount || 0));
        if (FE_10D1_tryMove(u, p, 'patrol')) {
          u._fe10d1PatrolAt = now;
          auto.patrolIssuedCount++;
          actions++;
          if (actions >= 2) break;
        }
      }
    }

    auto.skippedScoutCount = skippedScout;
    auto.skippedBusyCount = skippedBusy;
    auto.status = actions > 0 ? 'actions_issued' : 'idle_monitoring';
  }
  // PATCH-10D1-ENEMY-UNIT-AUTOPILOT-GUARD-PATROL_END



  // PATCH-10E1-STRENGTH-ESTIMATE-BEFORE-ATTACK_START
  function FE_10E1_getGameObject() {
    if (typeof FE_10D1_getGameObject === 'function') return FE_10D1_getGameObject();
    if (typeof FE_10C1_getGameObject === 'function') return FE_10C1_getGameObject();
    if (typeof game !== 'undefined' && game) return game;
    if (typeof state !== 'undefined' && state) return state;
    if (typeof gameState !== 'undefined' && gameState) return gameState;
    return null;
  }

  function FE_10E1_getUnitList() {
    if (typeof FE_10D1_getUnitList === 'function') return FE_10D1_getUnitList();
    const g = FE_10E1_getGameObject();
    if (g && Array.isArray(g.units)) return g.units;
    if (typeof units !== 'undefined' && Array.isArray(units)) return units;
    return [];
  }

  function FE_10E1_getBuildingList() {
    if (typeof FE_10D1_getBuildingList === 'function') return FE_10D1_getBuildingList();
    const g = FE_10E1_getGameObject();
    if (g && Array.isArray(g.buildings)) return g.buildings;
    if (typeof buildings !== 'undefined' && Array.isArray(buildings)) return buildings;
    return [];
  }

  function FE_10E1_unitTileX(u) {
    if (typeof FE_10D1_unitTileX === 'function') return FE_10D1_unitTileX(u);
    return Math.round(Number.isFinite(u?.tx) ? u.tx : (Number.isFinite(u?.tileX) ? u.tileX : (u?.x || 0)));
  }

  function FE_10E1_unitTileY(u) {
    if (typeof FE_10D1_unitTileY === 'function') return FE_10D1_unitTileY(u);
    return Math.round(Number.isFinite(u?.ty) ? u.ty : (Number.isFinite(u?.tileY) ? u.tileY : (u?.y || 0)));
  }

  function FE_10E1_distTiles(a, b) {
    if (typeof FE_10D1_distTiles === 'function') return FE_10D1_distTiles(a, b);
    const ax = Number.isFinite(a?.x) ? a.x : FE_10E1_unitTileX(a);
    const ay = Number.isFinite(a?.y) ? a.y : FE_10E1_unitTileY(a);
    const bx = Number.isFinite(b?.x) ? b.x : FE_10E1_unitTileX(b);
    const by = Number.isFinite(b?.y) ? b.y : FE_10E1_unitTileY(b);
    return Math.abs(ax - bx) + Math.abs(ay - by);
  }

  function FE_10E1_isAlive(obj) {
    if (!obj) return false;
    if (obj.dead || obj.destroyed || obj.removed) return false;
    if (Number.isFinite(obj.hp) && obj.hp <= 0) return false;
    if (Number.isFinite(obj.health) && obj.health <= 0) return false;
    return true;
  }

  function FE_10E1_isEnemyUnit(u) {
    if (typeof FE_10D1_isEnemyUnit === 'function') return FE_10D1_isEnemyUnit(u);
    return !!u && (u.owner === 'enemy' || u.side === 'enemy' || u.player === 'enemy');
  }

  function FE_10E1_isPlayerUnit(u) {
    if (typeof FE_10D1_isPlayerUnit === 'function') return FE_10D1_isPlayerUnit(u);
    return !!u && (u.owner === 'player' || u.side === 'player' || u.player === 'player');
  }

  function FE_10E1_isTank(u) {
    const t = String(u?.type || '').toLowerCase();
    return t === 'light_tank' || t.includes('tank');
  }

  function FE_10E1_isEnemyTank(u) {
    return FE_10E1_isAlive(u) && FE_10E1_isEnemyUnit(u) && FE_10E1_isTank(u);
  }

  function FE_10E1_isPlayerTank(u) {
    return FE_10E1_isAlive(u) && FE_10E1_isPlayerUnit(u) && FE_10E1_isTank(u);
  }

  function FE_10E1_getObjectId(obj) {
    return obj?.id || obj?.uid || obj?._id || obj?.uuid || null;
  }

  function FE_10E1_getEnemyHQ() {
    if (typeof FE_10D1_getEnemyHQ === 'function') return FE_10D1_getEnemyHQ();
    return FE_10E1_getBuildingList().find((b) => {
      if (!b || !FE_10E1_isAlive(b)) return false;
      const ownerOk = b.owner === 'enemy' || b.side === 'enemy' || b.player === 'enemy';
      const type = String(b.type || b.kind || '').toLowerCase();
      return ownerOk && (type.includes('hq') || type.includes('base'));
    }) || null;
  }

  function FE_10E1_hasActiveAttackOrder(unit) {
    if (typeof FE_10D1_hasActiveAttackOrder === 'function') return FE_10D1_hasActiveAttackOrder(unit);
    if (!unit) return false;
    const s = String(unit.state || unit.command || '').toLowerCase();
    return !!(
      unit.attackTargetId ||
      unit.attackApproachTargetId ||
      unit.attackTarget ||
      unit._attackCommanded ||
      s === 'attacking' ||
      s === 'attack_approach' ||
      s === 'attack' ||
      s.includes('attack')
    );
  }

  function FE_10E1_isScout(unit) {
    return !!unit && (unit._fe10c1Role === 'scout' || unit._scouting === true);
  }

  function FE_10E1_localPlayerTanks(enemyTanks, enemyHQ) {
    const playerTanks = FE_10E1_getUnitList().filter(FE_10E1_isPlayerTank);
    const visible = [];
    const seenIds = new Set();

    for (const p of playerTanks) {
      let local = false;

      if (enemyHQ && FE_10E1_distTiles(enemyHQ, p) <= 10) {
        local = true;
      }

      if (!local) {
        for (const e of enemyTanks) {
          if (FE_10E1_distTiles(e, p) <= 7) {
            local = true;
            break;
          }
        }
      }

      if (local) {
        const id = FE_10E1_getObjectId(p) || `${FE_10E1_unitTileX(p)}:${FE_10E1_unitTileY(p)}:${p.type || 'unit'}`;
        if (!seenIds.has(id)) {
          seenIds.add(id);
          visible.push(p);
        }
      }
    }

    return visible;
  }

  function FE_10E1_getEstimateState() {
    const g = FE_10E1_getGameObject();
    if (!g) return null;

    const enemyHQ = FE_10E1_getEnemyHQ();
    const enemyTanks = FE_10E1_getUnitList().filter(FE_10E1_isEnemyTank);
    const localPlayerTanks = FE_10E1_localPlayerTanks(enemyTanks, enemyHQ);

    const myStrength = enemyTanks.length;
    const hasKnownLocalPlayerArmy = localPlayerTanks.length > 0;
    const playerEstimate = hasKnownLocalPlayerArmy ? localPlayerTanks.length : 1;

    // MVP rule:
    // - unknown player army requires at least 2 tanks before attack;
    // - known local army requires enemy to be stronger by 1 tank;
    const requiredStrength = hasKnownLocalPlayerArmy ? playerEstimate + 1 : 2;
    const attackAllowed = myStrength >= requiredStrength;

    const estimate = g.enemyStrengthEstimateMvp || (g.enemyStrengthEstimateMvp = {});
    estimate.myStrength = myStrength;
    estimate.playerEstimate = playerEstimate;
    estimate.requiredStrength = requiredStrength;
    estimate.knownLocalPlayerTanks = localPlayerTanks.length;
    estimate.attackAllowed = attackAllowed;
    estimate.reason = attackAllowed ? 'strong_enough' : (hasKnownLocalPlayerArmy ? 'too_weak_vs_known_local_army' : 'need_min_two_tanks_for_unknown_attack');
    estimate.enemyTankCount = enemyTanks.length;
    estimate.hasEnemyHQ = !!enemyHQ;

    return {
      g,
      enemyHQ,
      enemyTanks,
      localPlayerTanks,
      myStrength,
      playerEstimate,
      requiredStrength,
      attackAllowed,
      estimate
    };
  }

  function FE_10E1_clearAttackOrder(unit) {
    if (!unit) return;
    unit.attackTargetId = null;
    unit.attackApproachTargetId = null;
    unit.attackTarget = null;
    unit._attackCommanded = false;
    const s = String(unit.state || '').toLowerCase();
    if (s.includes('attack')) unit.state = 'idle';
    if (String(unit.command || '').toLowerCase().includes('attack')) unit.command = 'idle';
  }

  function FE_10E1_returnToHq(unit, enemyHQ, index) {
    if (!unit || !enemyHQ) return false;

    const hqx = Number.isFinite(enemyHQ.x) ? enemyHQ.x : FE_10E1_unitTileX(enemyHQ);
    const hqy = Number.isFinite(enemyHQ.y) ? enemyHQ.y : FE_10E1_unitTileY(enemyHQ);
    const target = {
      x: hqx + ((index % 3) - 1) * 2,
      y: hqy + (((index + 1) % 3) - 1) * 2
    };

    if (typeof FE_10D1_tryMove === 'function') {
      try {
        return FE_10D1_tryMove(unit, target, 'strength_wait');
      } catch (_) {}
    }

    try {
      unit.destination = { x: target.x, y: target.y };
      unit.moveTarget = { x: target.x, y: target.y };
      unit.targetTile = { x: target.x, y: target.y };
      unit.targetX = target.x;
      unit.targetY = target.y;
      unit.destX = target.x;
      unit.destY = target.y;
      unit.goalX = target.x;
      unit.goalY = target.y;
      unit.command = 'move';
      unit.state = 'moving';
      unit._fe10e1Role = 'strength_wait';
      unit._fe10e1Target = target;
      unit._fe10e1IssuedAt = (typeof performance !== 'undefined' ? performance.now() : Date.now());
      return true;
    } catch (_) {
      return false;
    }
  }

  function FE_10E1_hasLocalDefenseThreat(estimateState) {
    if (!estimateState) return false;
    // If player tanks are actually close, allow defense/engagement even when enemy is weaker.
    return estimateState.localPlayerTanks.length > 0;
  }

  function FE_10E1_updateStrengthGateAfterEnemyBot() {
    const state = FE_10E1_getEstimateState();
    if (!state) return;

    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const e = state.estimate;
    e.lastThinkAt = now;

    if (state.attackAllowed) {
      e.status = 'attack_allowed';
      return;
    }

    if (FE_10E1_hasLocalDefenseThreat(state)) {
      e.status = 'local_defense_allowed_even_if_weaker';
      return;
    }

    let suppressed = 0;
    let returned = 0;

    for (let i = 0; i < state.enemyTanks.length; i++) {
      const u = state.enemyTanks[i];

      // Do not break active scout probes; scouting is how the bot resolves uncertainty.
      if (FE_10E1_isScout(u)) continue;

      if (!FE_10E1_hasActiveAttackOrder(u)) continue;

      FE_10E1_clearAttackOrder(u);
      suppressed++;

      if (state.enemyHQ && FE_10E1_returnToHq(u, state.enemyHQ, i)) {
        returned++;
      }
    }

    e.status = suppressed > 0 ? 'weak_attack_suppressed' : 'waiting_for_strength';
    e.suppressedAttackOrders = (e.suppressedAttackOrders || 0) + suppressed;
    e.returnOrders = (e.returnOrders || 0) + returned;
  }
  // PATCH-10E1-STRENGTH-ESTIMATE-BEFORE-ATTACK_END

  // PATCH-10H1-RETREAT-AND-DEFENSE-UPGRADE_START
  function FE_10H1_getGameObject() {
    if (typeof FE_10E1_getGameObject === 'function') return FE_10E1_getGameObject();
    if (typeof FE_10D1_getGameObject === 'function') return FE_10D1_getGameObject();
    if (typeof game !== 'undefined' && game) return game;
    return null;
  }

  function FE_10H1_getTelemetry() {
    const g = FE_10H1_getGameObject();
    if (!g) return null;
    return g.enemyRetreatMvp || (g.enemyRetreatMvp = {
      status: 'init',
      phase: 'unknown',
      retreatActive: false,
      retreatReason: '',
      lastRetreatAt: 0,
      retreatCooldownUntil: 0,
      retreatIssuedCount: 0,
      defendAllIssuedCount: 0,
      localThreatCount: 0,
      enemyTankCount: 0,
      playerThreatEstimate: 0,
      skippedScoutCount: 0,
      skippedBusyCount: 0
    });
  }

  function FE_10H1_getEnemyHq(state=null) {
    if (typeof FE_PATCH_08BResolveEnemyHomeBase === 'function') {
      const resolved = FE_PATCH_08BResolveEnemyHomeBase(state);
      if (resolved) return resolved;
    }
    if (typeof FE_10D1_getEnemyHQ === 'function') return FE_10D1_getEnemyHQ();
    if (typeof FE_10E1_getEnemyHQ === 'function') return FE_10E1_getEnemyHQ();
    return null;
  }

  function FE_10H1_getEnemyTanks() {
    if (typeof FE_PATCH_08BEnemyCombatUnits === 'function') return FE_PATCH_08BEnemyCombatUnits();
    return [];
  }

  function FE_10H1_isScout(unit) {
    return !!unit && (unit._fe10c1Role === 'scout' || unit._scouting === true);
  }

  function FE_10H1_isRetreating(unit) {
    return !!unit && (
      unit._fe10h1Role === 'retreat' ||
      unit._fe10d1Role === 'return' ||
      unit._fe10e1Role === 'strength_wait'
    );
  }

  function FE_10H1_hasActiveAttackOrder(unit) {
    if (typeof FE_10D1_hasActiveAttackOrder === 'function') return FE_10D1_hasActiveAttackOrder(unit);
    if (!unit) return false;
    const s = String(unit.state || unit.command || '').toLowerCase();
    return !!(
      unit.attackTargetId ||
      unit.attackApproachTargetId ||
      unit.attackTarget ||
      unit._attackCommanded ||
      s === 'attacking' ||
      s === 'attack_approach' ||
      s === 'attack' ||
      s.includes('attack')
    );
  }

  function FE_10H1_clearAttackOrder(unit) {
    if (typeof FE_10E1_clearAttackOrder === 'function') {
      FE_10E1_clearAttackOrder(unit);
      return;
    }
    if (!unit) return;
    unit.attackTargetId = null;
    unit.attackApproachTargetId = null;
    unit.attackTarget = null;
    unit._attackCommanded = false;
  }

  function FE_10H1_moveToSafePoint(unit, enemyHQ, index, state=null) {
    if (!unit || !enemyHQ) return false;
    if (typeof FE_PATCH_08BReturnUnitHome === 'function' && state) {
      const returned = FE_PATCH_08BReturnUnitHome(unit, state);
      if (returned) {
        unit._fe10h1Role = 'retreat';
        return true;
      }
    }
    if (typeof FE_10E1_returnToHq === 'function') {
      const ok = FE_10E1_returnToHq(unit, enemyHQ, index || 0);
      if (ok) unit._fe10h1Role = 'retreat';
      return ok;
    }
    return false;
  }

  function FE_10H1_getLocalPlayerThreatsNearHq(enemyHQ, radius=10) {
    if (!enemyHQ) return [];
    const units = (typeof FE_10E1_getUnitList === 'function') ? FE_10E1_getUnitList() : [];
    const threats = [];
    for (const u of units) {
      if (!u) continue;
      const isPlayer = (typeof FE_10D1_isPlayerUnit === 'function') ? FE_10D1_isPlayerUnit(u) : (u.owner === 'player');
      if (!isPlayer) continue;
      const kind = String(u.type || '').toLowerCase();
      if (!(kind === 'light_tank' || kind.includes('tank'))) continue;
      const d = (typeof FE_10D1_distTiles === 'function') ? FE_10D1_distTiles(enemyHQ, u) : Infinity;
      if (d > radius) continue;
      let visible = true;
      if (typeof enemyCanSeeTarget === 'function') {
        try { visible = !!enemyCanSeeTarget(u); } catch (_) {}
      }
      if (!visible && d > 6) continue;
      threats.push({ unit: u, distance: d });
    }
    return threats.sort((a, b) => a.distance - b.distance);
  }

  function FE_10H1_getPlayerThreatEstimate() {
    const g = FE_10H1_getGameObject();
    const estimate = g?.enemyStrengthEstimateMvp;
    if (Number.isFinite(estimate?.playerEstimate)) return estimate.playerEstimate;
    if (typeof FE_10E1_getEstimateState === 'function') {
      const state = FE_10E1_getEstimateState();
      if (Number.isFinite(state?.playerEstimate)) return state.playerEstimate;
    }
    return 0;
  }

  function FE_10H1_shouldRetreat(state, enemyTanks, telemetry) {
    if (!state || !enemyTanks?.length || !telemetry) return null;
    const phase = String(state.phase || '');
    const activeWave = enemyTanks.filter((u) => FE_10H1_hasActiveAttackOrder(u));
    const waveUnits = activeWave.length ? activeWave : (phase === 'attack' || phase === 'prepare_attack' ? enemyTanks : []);
    if (!waveUnits.length) return null;

    const enemyTankCount = enemyTanks.length;
    const playerThreatEstimate = FE_10H1_getPlayerThreatEstimate();
    const g = FE_10H1_getGameObject();
    const estimate = g?.enemyStrengthEstimateMvp || null;
    const previousCount = Number.isFinite(telemetry.enemyTankCount) ? telemetry.enemyTankCount : enemyTankCount;

    if (enemyTankCount <= 1) return 'last_tank_in_attack_wave';
    if (enemyTankCount < previousCount) return 'lost_tank_during_attack';
    if (estimate && estimate.attackAllowed === false && phase === 'attack') return String(estimate.reason || 'lost_strength_advantage');
    if (playerThreatEstimate > 0 && enemyTankCount <= playerThreatEstimate) return 'enemy_not_stronger_than_player_estimate';
    return null;
  }

  function FE_10H1_startRetreat(state, enemyTanks, enemyHQ, telemetry, reason, now) {
    if (!state || !enemyTanks?.length || !enemyHQ || !telemetry) return false;
    let cleared = 0;
    let moved = 0;
    let skippedScout = 0;
    let skippedBusy = 0;

    for (let i = 0; i < enemyTanks.length; i++) {
      const unit = enemyTanks[i];
      if (!unit) continue;
      const attacking = FE_10H1_hasActiveAttackOrder(unit);
      const scout = FE_10H1_isScout(unit);
      if (scout && !attacking) {
        skippedScout++;
        continue;
      }
      if (!attacking && !FE_10H1_isRetreating(unit)) {
        skippedBusy++;
        continue;
      }
      if (attacking) {
        FE_10H1_clearAttackOrder(unit);
        cleared++;
      }
      if (FE_10H1_moveToSafePoint(unit, enemyHQ, i, state)) moved++;
    }

    state.phase = 'regroup';
    state.regroupReason = reason || 'retreat';
    const cooldownSeconds = FE_PATCH_08BSeconds(FE_10I1_knobs().retreatCooldownMs);
    state.regroupUntil = Math.max(Number(state.regroupUntil || 0), now + cooldownSeconds);
    state.retreatCooldownUntil = Math.max(Number(state.retreatCooldownUntil || 0), now + cooldownSeconds);

    telemetry.status = moved > 0 ? 'retreat_started' : 'retreat_pending';
    telemetry.phase = state.phase || 'regroup';
    telemetry.retreatActive = true;
    telemetry.retreatReason = reason || 'retreat';
    telemetry.lastRetreatAt = now;
    telemetry.retreatCooldownUntil = state.retreatCooldownUntil;
    telemetry.retreatIssuedCount = (telemetry.retreatIssuedCount || 0) + moved;
    telemetry.skippedScoutCount = skippedScout;
    telemetry.skippedBusyCount = skippedBusy;
    return moved > 0 || cleared > 0;
  }

  function FE_10H1_defendHqWithAvailableTanks(state, enemyTanks, enemyHQ, threats, telemetry, now) {
    if (!state || !enemyTanks?.length || !enemyHQ || !threats?.length || !telemetry) return false;
    const primaryThreat = threats[0]?.unit || null;
    if (!primaryThreat) return false;

    const seriousThreat = threats[0].distance <= 6 || threats.length >= 2;
    let issued = 0;
    let skippedScout = 0;
    let skippedBusy = 0;

    for (const unit of enemyTanks) {
      if (!unit) continue;
      if (FE_10H1_isRetreating(unit)) continue;
      const scout = FE_10H1_isScout(unit);
      if (scout && !seriousThreat) {
        skippedScout++;
        continue;
      }
      const ok = FE_PATCH_08BCommandEnemyTankAttack(unit, primaryThreat, state, 'defend');
      if (ok) {
        unit._fe10h1Role = 'defend_hq';
        issued++;
      } else if (scout) {
        skippedScout++;
      } else {
        skippedBusy++;
      }
    }

    state.phase = 'defend';
    state.lastPressureAt = now;
    telemetry.status = issued > 0 ? 'hq_defense_issued' : 'hq_defense_waiting';
    telemetry.phase = state.phase || 'defend';
    telemetry.retreatActive = false;
    telemetry.retreatReason = '';
    telemetry.defendAllIssuedCount = (telemetry.defendAllIssuedCount || 0) + issued;
    telemetry.skippedScoutCount = skippedScout;
    telemetry.skippedBusyCount = skippedBusy;
    return issued > 0 || seriousThreat;
  }

  function FE_10H1_updateEnemyRetreatAndDefenseMvp(state, enemyTanks, now) {
    const telemetry = FE_10H1_getTelemetry();
    const enemyHQ = FE_10H1_getEnemyHq(state);
    if (!telemetry || !state || !enemyHQ) return false;

    telemetry.phase = state.phase || 'unknown';
    telemetry.enemyTankCount = enemyTanks?.length || 0;
    telemetry.playerThreatEstimate = FE_10H1_getPlayerThreatEstimate();
    telemetry.localThreatCount = 0;
    telemetry.retreatCooldownUntil = Number(state.retreatCooldownUntil || telemetry.retreatCooldownUntil || 0);

    const threats = FE_10H1_getLocalPlayerThreatsNearHq(enemyHQ, 10);
    telemetry.localThreatCount = threats.length;
    if (threats.length > 0) {
      return FE_10H1_defendHqWithAvailableTanks(state, enemyTanks, enemyHQ, threats, telemetry, now);
    }

    const retreatReason = FE_10H1_shouldRetreat(state, enemyTanks, telemetry);
    if (retreatReason) {
      return FE_10H1_startRetreat(state, enemyTanks, enemyHQ, telemetry, retreatReason, now);
    }

    if (Number.isFinite(state.retreatCooldownUntil) && now < state.retreatCooldownUntil) {
      state.phase = 'regroup';
      state.regroupUntil = Math.max(Number(state.regroupUntil || 0), Number(state.retreatCooldownUntil || 0));
      for (let i = 0; i < enemyTanks.length; i++) {
        const unit = enemyTanks[i];
        if (!unit || FE_10H1_isScout(unit)) continue;
        FE_10H1_moveToSafePoint(unit, enemyHQ, i, state);
      }
      telemetry.status = 'retreat_cooldown_hold';
      telemetry.phase = state.phase || 'regroup';
      telemetry.retreatActive = true;
      telemetry.retreatReason = telemetry.retreatReason || 'cooldown_after_retreat';
      telemetry.retreatCooldownUntil = state.retreatCooldownUntil;
      return true;
    }

    telemetry.status = 'idle_monitoring';
    telemetry.retreatActive = false;
    telemetry.retreatReason = '';
    return false;
  }
  // PATCH-10H1-RETREAT-AND-DEFENSE-UPGRADE_END


function updateEnemyBot(dt) {
    // PATCH-10E1B-STRENGTH-GATE-EARLY-HOOK_START
    try {
      const g10e1b = (typeof FE_10E1_getGameObject === 'function') ? FE_10E1_getGameObject() : null;
      const now10e1b = (typeof performance !== 'undefined' ? performance.now() : Date.now());

      // Throttle because updateEnemyBot may run often.
      if (g10e1b && now10e1b >= (g10e1b._fe10e1EarlyHookNextAt || 0)) {
        g10e1b._fe10e1EarlyHookNextAt = now10e1b + 1200;

        const run10e1bStrengthGate = () => {
          try {
            FE_10E1_updateStrengthGateAfterEnemyBot();
          } catch (err) {
            const g10e1bErr = (typeof FE_10E1_getGameObject === 'function') ? FE_10E1_getGameObject() : null;
            if (g10e1bErr) {
              g10e1bErr.enemyStrengthEstimateMvpError = String(err && err.message ? err.message : err);
            }
          }
        };

        // Immediate run creates telemetry even if updateEnemyBot returns early.
        run10e1bStrengthGate();

        // Async run catches attack orders created later in this updateEnemyBot tick.
        if (typeof setTimeout === 'function') {
          setTimeout(run10e1bStrengthGate, 0);
        }
      }
    } catch (err) {
      const g10e1bTop = (typeof FE_10E1_getGameObject === 'function') ? FE_10E1_getGameObject() : null;
      if (g10e1bTop) {
        g10e1bTop.enemyStrengthEstimateMvpError = String(err && err.message ? err.message : err);
      }
    }
    // PATCH-10E1B-STRENGTH-GATE-EARLY-HOOK_END

    // PATCH-10D1-ENEMY-UNIT-AUTOPILOT-GUARD-PATROL_HOOK
    try {
      FE_10D1_updateEnemyUnitAutopilotGuard();
    } catch (err) {
      const g10d1 = FE_10D1_getGameObject && FE_10D1_getGameObject();
      if (g10d1) g10d1.enemyAutopilotMvpError = String(err && err.message ? err.message : err);
    }

    // PATCH-10C1-ENEMY-SCOUTING-MVP-LIGHT_HOOK
    try {
      FE_10C1_updateEnemyScoutingMvp();
    } catch (err) {
      const g10c1 = FE_10C1_getGameObject && FE_10C1_getGameObject();
      if (g10c1) g10c1.enemyScoutingMvpError = String(err && err.message ? err.message : err);
    }

    if (!game || game.screen !== 'game' || game.paused) return;
    if (game.skirmishMode !== true) return;
    if (game.gameResult || game.result || game.gameEnded || game.ended) return;

    const state = FE_PATCH_08BEnsureBotState();
    if (!state) return;

    const homeBase = FE_PATCH_08BResolveEnemyHomeBase(state);
    if (!homeBase) return;

    const now = FE_PATCH_08BNow();
    if (now < state.nextCheckAt) return;
    FE_10I1_knobs();
    state.nextCheckAt = now + FE_PATCH_08BSeconds(FE_10I1_knobs().checkIntervalMs);

    // BOT-BRAIN-01: priority decision loop replaces linear checklist.
    var brainAction = FE_PATCH_BRAIN_01_ChoosePriorityAction(state);
    FE_PATCH_BRAIN_01_ExecuteAction(brainAction, state);

    // PATCH-10B: refresh enemy knowledge before combat-unit early returns.
    // 10B only observes/remembers; current phase-bot decisions stay unchanged.
    FE_PATCH_10BRefreshEnemyKnowledge(now);

    const enemyTanks = FE_PATCH_08BEnemyCombatUnits();
    if (!enemyTanks.length) return;

    // PATCH-10H1-RETREAT-AND-DEFENSE-UPGRADE_HOOK
    try {
      if (FE_10H1_updateEnemyRetreatAndDefenseMvp(state, enemyTanks, now)) return;
    } catch (err) {
      const g10h1 = FE_10H1_getGameObject && FE_10H1_getGameObject();
      if (g10h1) {
        const t10h1 = g10h1.enemyRetreatMvp || (g10h1.enemyRetreatMvp = {});
        t10h1.status = 'error';
        t10h1.lastError = String(err && err.message ? err.message : err);
      }
    }

    const pressureTarget = FE_PATCH_08BThreatNearHome(state);
    if (pressureTarget) {
      FE_PATCH_08BDefend(enemyTanks, pressureTarget, state);
      return;
    }

    if (state.phase === 'attack' && FE_PATCH_08BOverChasing(enemyTanks, state)) {
      FE_PATCH_08BStartRegroup(state, 'over_chase');
    }
    if (state.phase === 'attack' && FE_PATCH_08BAttackStateInvalid(enemyTanks, state)) {
      FE_PATCH_08BStartRegroup(state, 'target_invalid');
    }

    if (state.phase === 'regroup') {
      for (const unit of enemyTanks) {
        if (FE_PATCH_08BShouldKeepUnitNearHome(unit, state, FE_10I1_knobs().regroupArriveRadiusTiles)) {
          FE_PATCH_08BReturnUnitHome(unit, state);
        }
      }
      if (now < state.regroupUntil) return;
      state.phase = 'prepare_attack';
    }

    if (state.phase === 'defend' && now < state.openingUntil) {
      for (const unit of enemyTanks) {
        if (FE_PATCH_08BShouldKeepUnitNearHome(unit, state)) {
          FE_PATCH_08BReturnUnitHome(unit, state);
        }
      }
      return;
    }

    if (state.phase === 'attack') {
      return;
    }

    if (state.phase !== 'prepare_attack') {
      state.phase = 'prepare_attack';
    }

    FE_PATCH_08BPrepareAttack(enemyTanks, state);
  
    // PATCH-10E1-STRENGTH-ESTIMATE-BEFORE-ATTACK_HOOK
    try {
      FE_10E1_updateStrengthGateAfterEnemyBot();
    } catch (err) {
      const g10e1 = FE_10E1_getGameObject && FE_10E1_getGameObject();
      if (g10e1) g10e1.enemyStrengthEstimateMvpError = String(err && err.message ? err.message : err);
    }
}
  // FE_PATCH_07B_BOT_CONTROLLER_MVP_END

  function isObstacleBlocked(x,y) {
    return game.obstacles.some(o=>
      normalizeEnvironmentObstacleBlock(o.asset, o.block) &&
      x>=o.x && y>=o.y && x<o.x+o.w && y<o.y+o.h
    );
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
    // PATCH-09E1: enemy bot orders must not produce player command markers.
    // Enemy decisions are AI/internal actions, not direct player input feedback.
    if (typeof unitOwner === 'function' && unitOwner(unit) === 'enemy') return;

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

// PATCH-09E1-ENEMY-BOT-SILENT-MOVE-TOAST-FIX
// Enemy bot commands must be silent for the player UI.
// They may move/queue/path exactly like normal units, but should not show player toasts
// such as "Команда принята" or hide player menus while the bot is issuing orders.
function FE_PATCH_09E1IsPlayerCommandFeedbackUnit(unit) {
  return !(typeof unitOwner === 'function' && unitOwner(unit) === 'enemy');
}

function FE_PATCH_09E1ShowUnitCommandToast(unit, message) {
  if (!FE_PATCH_09E1IsPlayerCommandFeedbackUnit(unit)) return;
  showToast(message);
}

function FE_PATCH_09E1HideMenusForUnitCommand(unit) {
  if (!FE_PATCH_09E1IsPlayerCommandFeedbackUnit(unit)) return;
  hideMenus();
}

function queueManualMove(unit, tx, ty) {
  if (!passable(tx, ty, unit.id)) {
    addUnitClickMarker(unit, tx, ty, 'bad');
    FE_PATCH_09E1ShowUnitCommandToast(unit, 'Клетка недоступна');
    return false;
  }

  unit._queuedManualMove = { x: tx, y: ty };

  // Важно: не меняем текущий path прямо сейчас.
  // Юнит доедет до ближайшей целой клетки и только потом повернёт.
  addUnitClickMarker(unit, tx, ty, 'ok');
  FE_PATCH_09E1ShowUnitCommandToast(unit, 'Команда принята: повернёт на ближайшей клетке');

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
    FE_PATCH_09E1ShowUnitCommandToast(unit, 'Клетка стала недоступна');
    return false;
  }

  const path = findPath(unit, { x: q.x, y: q.y }, unit.id);

  if (path === null) {
    addUnitClickMarker(unit, q.x, q.y, 'bad');
    FE_PATCH_09E1ShowUnitCommandToast(unit, 'Юнит не может доехать');
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
  // FE_PATCH_08B2_MANUAL_MOVE_CLEARS_ATTACK_APPROACH
  // Single-unit ground move must cancel any remembered player light_tank attack/approach target.
  // Without this, a tank moved away after attacking enemy HQ can resume the stale attack_approach.
  if (typeof FE_PATCH_08B1ClearPlayerLightTankAttackState === 'function') {
    FE_PATCH_08B1ClearPlayerLightTankAttackState(unit, 'set_manual_move');
  }
  if (typeof clearLightTankAttackMove === 'function') clearLightTankAttackMove(unit);
  if (!passable(tx, ty, unit.id)) {
    addUnitClickMarker(unit, tx, ty, 'bad');
    FE_PATCH_09E1ShowUnitCommandToast(unit, 'Клетка недоступна');
    return;
  }

  // Если юнит уже едет между клетками — не ломаем текущий сегмент.
  // Сохраняем новую команду и применяем её только в ближайшей целой клетке.
  if (unit.path && unit.path.length && unitIsBetweenGridCells(unit)) {
    queueManualMove(unit, tx, ty);
    unit.state = 'manual_move';
    unit.manualTarget = null;
    FE_PATCH_09E1HideMenusForUnitCommand(unit);
    return;
  }

  const path = findPath(unit, { x: tx, y: ty }, unit.id);

  if (path === null) {
    addUnitClickMarker(unit, tx, ty, 'bad');
    FE_PATCH_09E1ShowUnitCommandToast(unit, 'Юнит не может доехать');
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

  FE_PATCH_09E1HideMenusForUnitCommand(unit);
  FE_PATCH_09E1ShowUnitCommandToast(unit, `${unitLabel(unit.type)} едет`);
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

  // FE_PATCH_08B3_RIGHT_CLICK_CANCEL_CLEARS_ATTACK
  // RMB cancel must cancel the current player light_tank attack/approach command too.
  // Ground-click move was fixed in 08B2 via setManualMove(...); right-click uses this cancel path instead.
  const clearedAttackState = (typeof FE_PATCH_08B1ClearPlayerLightTankAttackState === 'function')
    ? FE_PATCH_08B1ClearPlayerLightTankAttackState(unit, 'right_click_cancel')
    : false;
  if (typeof clearLightTankAttackMove === 'function') clearLightTankAttackMove(unit);

  unit._queuedManualMove = null;
  unit.manualTarget = null;

  if (!isManualMove && !hasPath) {
    if (clearedAttackState) {
      unit.path = [];
      if (unit.state === 'attack' || unit.state === 'attack_approach' || unit.state === 'attack_move') {
        unit.state = 'idle';
      }
      unit._dirTargetKey = null;
      unit._dirDx = 0;
      unit._dirDy = 0;
      addUnitClickMarker(unit, Math.round(unit.x), Math.round(unit.y), 'ok');
      showToast(`${label}: атака отменена`);
      return true;
    }
    return false;
  }

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
  const speedFaction = unit.type === 'harvester' ? unitVisualFaction(unit) : game.faction;
  const factionSpeed = unit.type === 'harvester' ? (FACTIONS?.[speedFaction]?.harvesterSpeed || 1) : 1;
  const spd = baseSpeed * factionSpeed;
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
    const owner = unitOwner(unit);
    const base = findBaseBuilding(owner);

    if (!base) {
      return { cell:null, path:null, reason:'no_hq', owner };
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

  function harvesterMineralStorageSpace(unit=null) {
    return resourceSpaceForOwner(unitOwner(unit), 'minerals');
  }

  function showHarvesterStorageFullToast(unit) {
    if (!unit || !isPlayerUnit(unit) || unit._storageFullToastShown) return;
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
      mineralSpace: harvesterMineralStorageSpace(unit)
    });
  }

  function resumeHarvesterFromStorageFull(unit) {
    if (!unit || harvesterMineralStorageSpace(unit) <= 0) return false;

    unit._storageFullToastShown = false;

    if ((unit.cargo || 0) > 0) {
      const base = findBaseBuilding(unitOwner(unit));

      if (isNearRect(unit, base)) {
        unit.state = 'unloading';
        unit.actionTimer = .35;
        harvesterLog('harvester_storage_space_available_unload', unit, {
          cargo: unit.cargo || 0,
          mineralSpace: harvesterMineralStorageSpace(unit)
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

    if ((unit.cargo || 0) <= 0 && harvesterMineralStorageSpace(unit) <= 0) {
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
    if (isPlayerUnit(unit) && unit._harvestNoPathToastTimer <= 1) {
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
      if ((unit.cargo || 0) <= 0 && harvesterMineralStorageSpace(unit) <= 0) {
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
      if ((unit.cargo || 0) <= 0 && harvesterMineralStorageSpace(unit) <= 0) {
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
          if (isPlayerUnit(unit)) showToast('Сборщик ждёт путь к базе');
        }
      }

      return;
    }

    if (unit.state === 'returning') {
      updateUnitMovement(unit, dt);

      if (!unit.path.length) {
        const base = findBaseBuilding(unitOwner(unit));

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
          const accepted = addResourceForOwner(unitOwner(unit), 'minerals', cargoBeforeUnload);

          if (accepted > 0) {
            unit.cargo = Math.max(0, cargoBeforeUnload - accepted);

            harvesterLog('harvester_unloaded', unit, {
              minerals: accepted,
              cargoRemaining: unit.cargo,
              mineralSpace: harvesterMineralStorageSpace(unit)
            });
          } else {
            harvesterLog('harvester_unload_blocked_storage_full', unit, {
              cargo: unit.cargo || 0,
              mineralSpace: harvesterMineralStorageSpace(unit)
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

  // FE_PATCH_09C2_ENEMY_BUILDER_SEPARATOR_MVP_START
  function changeResourceForOwner(owner='player', resource='minerals', delta=0) {
    const resolvedOwner = owner === 'enemy' ? 'enemy' : 'player';
    const aliases = {
      raw: 'minerals',
      rawMinerals: 'minerals',
      mineral: 'minerals',
      minerals: 'minerals',
      energy: 'energy'
    };
    const key = aliases[resource] || resource;

    if (resolvedOwner !== 'enemy') {
      changeResource(key, delta);
      return true;
    }

    const bucket = ensureEnemyResources();
    const limits = getStorageLimitsForOwner('enemy');
    const max = limits[key] ?? Infinity;
    const old = Number.isFinite(bucket[key]) ? bucket[key] : 0;
    bucket[key] = clamp(old + delta, 0, max);
    return true;
  }

  const FE_PATCH_09C2_SEPARATOR_COST_ENERGY = 30;
  // BOT-BASELINE-01: enemy starting energy must match player (160).
  const FE_PATCH_BASELINE_01_START_ENERGY = 160;

  function FE_PATCH_09C2EnsureEnemyScenarioEnergyReserve() {
    const bucket = ensureEnemyResources();
    if (bucket._patch09c2ScenarioEnergyReady === true) return bucket;

    bucket.energy = Math.max(
      Number.isFinite(bucket.energy) ? bucket.energy : 0,
      FE_PATCH_BASELINE_01_START_ENERGY
    );
    bucket._patch09c2ScenarioEnergyReady = true;

    debugLog('enemy_scenario_energy_reserved_09c2', {
      energy: bucket.energy,
      baseline: FE_PATCH_BASELINE_01_START_ENERGY
    });

    return bucket;
  }

  function FE_PATCH_09C2EnemySeparatorExistsOrQueued() {
    if (!game) return false;

    const hasBuilding = (game.buildings || []).some(b =>
      b &&
      b.kind === 'building' &&
      b.type === 'separator' &&
      buildingOwner(b) === 'enemy' &&
      !b.destroyed &&
      !b.dead
    );
    if (hasBuilding) return true;

    return (game.units || []).some(u =>
      u &&
      u.kind === 'unit' &&
      u.type === 'builder' &&
      unitOwner(u) === 'enemy' &&
      (
        u.buildOrder?.type === 'separator' ||
        (u.currentBuilding && (game.buildings || []).some(b =>
          b && b.id === u.currentBuilding && b.type === 'separator' && buildingOwner(b) === 'enemy'
        ))
      )
    );
  }

  function FE_PATCH_09C2FindEnemyBuilderForSeparator() {
    return (game?.units || []).find(u =>
      u &&
      u.kind === 'unit' &&
      u.type === 'builder' &&
      unitOwner(u) === 'enemy' &&
      (u.hp ?? 1) > 0 &&
      u.state !== 'moving_to_build' &&
      u.state !== 'building'
    ) || null;
  }

  function FE_PATCH_09C2EnemySeparatorBuildCost() {
    const cost = Object.assign({}, getBuildCost('separator'));
    if (!Number.isFinite(cost.energy) || cost.energy <= 0) {
      cost.energy = FE_PATCH_09C2_SEPARATOR_COST_ENERGY;
    }
    return cost;
  }

  function FE_PATCH_09C2SpendEnemyBuildCost(type='separator') {
    const cost = type === 'separator'
      ? FE_PATCH_09C2EnemySeparatorBuildCost()
      : getBuildCost(type);
    const bucket = ensureEnemyResources();

    for (const [resource, amount] of Object.entries(cost)) {
      if (!amount) continue;
      const have = bucket[resource] || 0;
      if (have < amount) {
        debugLog('enemy_build_cost_spend_failed_not_enough_resource_09c2', {
          type,
          resource,
          amount,
          have,
          cost:safeCloneForLog(cost),
          enemyResources:safeCloneForLog(bucket)
        });
        return { ok:false, resource, amount, have, cost };
      }
    }

    for (const [resource, amount] of Object.entries(cost)) {
      if (!amount) continue;
      changeResourceForOwner('enemy', resource, -amount);
    }

    debugLog('enemy_resources_spent_for_build_09c2', {
      type,
      cost:safeCloneForLog(cost),
      enemyResourcesAfter:safeCloneForLog(ensureEnemyResources())
    });

    return { ok:true, cost };
  }

  function FE_PATCH_09C2OrderEnemyBuilderBuildSeparator() {
    if (!game || game.screen !== 'game' || game.skirmishMode !== true) return false;
    if (FE_PATCH_09C2EnemySeparatorExistsOrQueued()) return false;

    const builder = FE_PATCH_09C2FindEnemyBuilderForSeparator();
    if (!builder) {
      debugLog('enemy_separator_build_skipped_no_available_builder_09c2', {
        enemyBuilders:(game.units || []).filter(u => u?.type === 'builder' && unitOwner(u) === 'enemy').map(getBuilderDebugSnapshot)
      });
      return false;
    }

    const plan = findBuildPlan(builder, 'separator');
    if (!plan || !plan.spot || !Array.isArray(plan.path)) {
      debugLog('enemy_separator_build_failed_no_plan_09c2', {
        builder:getBuilderDebugSnapshot(builder),
        plan:safeCloneForLog(plan),
        enemyBase:safeCloneForLog(FE_PATCH_08BResolveEnemyHomeBase?.() || FE_PATCH_06AExistingEnemyBase?.())
      });
      return false;
    }

    const spent = FE_PATCH_09C2SpendEnemyBuildCost('separator');
    if (!spent.ok) return false;

    builder._reservedBuildCost = {
      type: 'separator',
      owner: 'enemy',
      cost: spent.cost,
      createdAt: performance.now(),
      resourcesAfterSpend: safeCloneForLog(ensureEnemyResources())
    };
    builder._buildRefunded = false;
    builder.buildOrder = {
      type: 'separator',
      spot: plan.spot,
      accessCell: plan.accessCell || null,
      owner: 'enemy',
      silent: true,
      createdAt: performance.now(),
      sourcePatch: '09C2'
    };
    builder.path = plan.path || [];
    builder.state = 'moving_to_build';
    builder._buildMoveTimer = 0;
    builder._buildStuckTimer = 0;
    builder._buildNoProgressTimer = 0;
    builder._buildLastX = builder.x;
    builder._buildLastY = builder.y;
    builder._buildLastDist = null;
    builder._debugStateTimer = 0;

    debugLog('enemy_builder_separator_build_order_assigned_09c2', {
      builder:getBuilderDebugSnapshot(builder),
      plan:safeCloneForLog(plan),
      reservedBuildCost:safeCloneForLog(builder._reservedBuildCost)
    });

    return true;
  }
  // FE_PATCH_09C2_ENEMY_BUILDER_SEPARATOR_MVP_END

  // FE_PATCH_09C3_ENEMY_SEPARATOR_PROCESSING_MVP_START
  const FE_PATCH_09C3_SEPARATOR_INPUT_MINERALS = 15;
  const FE_PATCH_09C3_SEPARATOR_OUTPUT_ENERGY = 10;
  const FE_PATCH_09C3_SEPARATOR_OUTPUT_ELEMENT = 1;
  const FE_PATCH_09C3_SEPARATOR_CYCLE_SECONDS = 6.0;

  function FE_PATCH_09C3EnemyElementKey() {
    const enemyBase = (typeof findBaseBuilding === 'function' ? findBaseBuilding('enemy') : null)
      || (typeof FE_PATCH_06AExistingEnemyBase === 'function' ? FE_PATCH_06AExistingEnemyBase() : null);
    const faction = enemyBase?.faction || FE_PATCH_07A3_ENEMY_VISUAL_FACTION || 'purple';
    return FACTION_ELEMENT_KEY[faction] || 'purple';
  }

  function FE_PATCH_09C3CompleteEnemySeparators() {
    return (game?.buildings || []).filter(b =>
      b &&
      b.kind === 'building' &&
      b.type === 'separator' &&
      buildingOwner(b) === 'enemy' &&
      b.complete &&
      !b.destroyed &&
      !b.dead
    );
  }

  function FE_PATCH_09C3EnemySeparatorCycleCheck() {
    const bucket = ensureEnemyResources();
    const elKey = FE_PATCH_09C3EnemyElementKey();

    if ((bucket.minerals || 0) < FE_PATCH_09C3_SEPARATOR_INPUT_MINERALS) {
      return { ok:false, reason:'not_enough_raw_minerals', elKey };
    }
    if (resourceSpaceForOwner('enemy', 'energy') < FE_PATCH_09C3_SEPARATOR_OUTPUT_ENERGY) {
      return { ok:false, reason:'energy_storage_full', elKey };
    }
    if (resourceSpaceForOwner('enemy', elKey) < FE_PATCH_09C3_SEPARATOR_OUTPUT_ELEMENT) {
      return { ok:false, reason:'element_storage_full', elKey };
    }
    return { ok:true, reason:'ready', elKey };
  }

  function FE_PATCH_09C3UpdateEnemySeparatorMarks(separators, active=false, reason='idle') {
    for (const sep of separators || []) {
      sep._enemySeparatorActive = !!active;
      sep._enemySeparatorPaused = !active;
      sep._enemySeparatorReason = reason;
      sep._enemySeparatorPatch = '09C3';
    }
  }

  function FE_PATCH_09C3UpdateEnemySeparatorProduction(dt) {
    if (!game || game.screen !== 'game' || game.paused) return;
    if (game.skirmishMode !== true) return;
    if (game.gameResult || game.result || game.gameEnded || game.ended) return;

    const separators = FE_PATCH_09C3CompleteEnemySeparators();
    if (!separators.length) return;

    const check = FE_PATCH_09C3EnemySeparatorCycleCheck();
    if (!check.ok) {
      FE_PATCH_09C3UpdateEnemySeparatorMarks(separators, false, check.reason);
      return;
    }

    FE_PATCH_09C3UpdateEnemySeparatorMarks(separators, true, 'processing');
    game._enemySepTimer = Number.isFinite(game._enemySepTimer) ? game._enemySepTimer : 0;
    game._enemySepTimer += dt * separators.length;

    let cycles = 0;
    while (game._enemySepTimer >= FE_PATCH_09C3_SEPARATOR_CYCLE_SECONDS && cycles < 10) {
      const currentCheck = FE_PATCH_09C3EnemySeparatorCycleCheck();
      if (!currentCheck.ok) {
        FE_PATCH_09C3UpdateEnemySeparatorMarks(separators, false, currentCheck.reason);
        break;
      }

      game._enemySepTimer -= FE_PATCH_09C3_SEPARATOR_CYCLE_SECONDS;
      changeResourceForOwner('enemy', 'minerals', -FE_PATCH_09C3_SEPARATOR_INPUT_MINERALS);
      changeResourceForOwner('enemy', 'energy', FE_PATCH_09C3_SEPARATOR_OUTPUT_ENERGY);
      changeResourceForOwner('enemy', currentCheck.elKey, FE_PATCH_09C3_SEPARATOR_OUTPUT_ELEMENT);
      cycles += 1;
    }

    if (cycles > 0) {
      debugLog('enemy_separator_processed_resources_09c3', {
        cycles,
        separatorCount: separators.length,
        formula: `${FE_PATCH_09C3_SEPARATOR_INPUT_MINERALS} raw -> ${FE_PATCH_09C3_SEPARATOR_OUTPUT_ENERGY} energy + ${FE_PATCH_09C3_SEPARATOR_OUTPUT_ELEMENT} element`,
        elementKey: check.elKey,
        enemyResources:safeCloneForLog(ensureEnemyResources())
      });
    }
  }

  function FE_PATCH_09C3EnemySeparatorDebugText() {
    if (!game) return 'n/a';
    const allSeparators = (game.buildings || []).filter(b =>
      b && b.kind === 'building' && b.type === 'separator' && buildingOwner(b) === 'enemy' && !b.destroyed && !b.dead
    );
    if (!allSeparators.length) {
      const queued = FE_PATCH_09C2EnemySeparatorExistsOrQueued?.() ? 'queued/building' : 'missing';
      return queued;
    }

    const completeSeparators = allSeparators.filter(b => b.complete);
    if (!completeSeparators.length) return 'building';

    const check = FE_PATCH_09C3EnemySeparatorCycleCheck();
    if (!check.ok) return `${completeSeparators.length} complete, paused: ${check.reason}`;

    const timer = Number.isFinite(game._enemySepTimer) ? game._enemySepTimer : 0;
    return `${completeSeparators.length} active, timer ${timer.toFixed(1)}/${FE_PATCH_09C3_SEPARATOR_CYCLE_SECONDS}`;
  }
  // FE_PATCH_09C3_ENEMY_SEPARATOR_PROCESSING_MVP_END

  // FE_PATCH_09D_ENEMY_FACTORY_BUILD_MVP_START
  const FE_PATCH_09D_FACTORY_TYPE = 'units_factory';

  function FE_PATCH_09DEnemyFactories() {
    return (game?.buildings || []).filter(b =>
      b &&
      b.kind === 'building' &&
      b.type === FE_PATCH_09D_FACTORY_TYPE &&
      buildingOwner(b) === 'enemy' &&
      !b.destroyed &&
      !b.dead
    );
  }

  function FE_PATCH_09DCompleteEnemyFactoryExists() {
    return FE_PATCH_09DEnemyFactories().some(b => b.complete);
  }

  function FE_PATCH_09DEnemyFactoryExistsOrQueued() {
    if (!game) return false;

    if (FE_PATCH_09DEnemyFactories().length > 0) return true;

    return (game.units || []).some(u =>
      u &&
      u.kind === 'unit' &&
      u.type === 'builder' &&
      unitOwner(u) === 'enemy' &&
      (
        u.buildOrder?.type === FE_PATCH_09D_FACTORY_TYPE ||
        (u.currentBuilding && (game.buildings || []).some(b =>
          b &&
          b.id === u.currentBuilding &&
          b.type === FE_PATCH_09D_FACTORY_TYPE &&
          buildingOwner(b) === 'enemy'
        ))
      )
    );
  }

  function FE_PATCH_09DFindEnemyBuilderForFactory() {
    return (game?.units || []).find(u =>
      u &&
      u.kind === 'unit' &&
      u.type === 'builder' &&
      unitOwner(u) === 'enemy' &&
      (u.hp ?? 1) > 0 &&
      u.state !== 'moving_to_build' &&
      u.state !== 'building'
    ) || null;
  }

  function FE_PATCH_09DEnemyFactoryBuildCost() {
    return Object.assign({}, getBuildCost(FE_PATCH_09D_FACTORY_TYPE));
  }

  function FE_PATCH_09DSetEnemyFactoryBuildStatus(status, extra={}) {
    if (!game) return;
    const prev = game._enemyFactoryBuildOrderStatus || {};
    const next = Object.assign({
      patch: '09D',
      status,
      updatedAt: game.time || 0
    }, extra || {});
    game._enemyFactoryBuildOrderStatus = next;

    if (prev.status !== next.status || prev.resource !== next.resource) {
      debugLog('enemy_factory_build_order_status_09d', safeCloneForLog(next));
    }
  }

  function FE_PATCH_09DCanBuildEnemyFactory() {
    if (FE_PATCH_09DEnemyFactoryExistsOrQueued()) {
      return { ok:false, reason:'factory_exists_or_queued' };
    }

    const completeSeparators = typeof FE_PATCH_09C3CompleteEnemySeparators === 'function'
      ? FE_PATCH_09C3CompleteEnemySeparators()
      : [];
    if (!completeSeparators.length) {
      return { ok:false, reason:'waiting_complete_separator' };
    }

    const builder = FE_PATCH_09DFindEnemyBuilderForFactory();
    if (!builder) {
      return { ok:false, reason:'no_available_builder' };
    }

    const cost = FE_PATCH_09DEnemyFactoryBuildCost();
    const bucket = ensureEnemyResources();
    for (const [resource, amount] of Object.entries(cost)) {
      if (!amount) continue;
      const have = bucket[resource] || 0;
      if (have < amount) {
        return { ok:false, reason:'not_enough_resource', resource, amount, have, cost, builder };
      }
    }

    return { ok:true, builder, cost };
  }

  function FE_PATCH_09DOrderEnemyBuilderBuildFactory() {
    if (!game || game.screen !== 'game' || game.skirmishMode !== true) return false;
    if (game.gameResult || game.result || game.gameEnded || game.ended) return false;

    const canBuild = FE_PATCH_09DCanBuildEnemyFactory();
    if (!canBuild.ok) {
      FE_PATCH_09DSetEnemyFactoryBuildStatus(canBuild.reason, {
        resource: canBuild.resource || null,
        amount: canBuild.amount || null,
        have: canBuild.have || null,
        cost: safeCloneForLog(canBuild.cost || FE_PATCH_09DEnemyFactoryBuildCost()),
        enemyResources: safeCloneForLog(ensureEnemyResources())
      });
      return false;
    }

    const builder = canBuild.builder;
    const plan = findBuildPlan(builder, FE_PATCH_09D_FACTORY_TYPE);
    if (!plan || !plan.spot || !Array.isArray(plan.path)) {
      FE_PATCH_09DSetEnemyFactoryBuildStatus('no_valid_build_plan', {
        builder:getBuilderDebugSnapshot(builder),
        plan:safeCloneForLog(plan),
        enemyBase:safeCloneForLog(FE_PATCH_08BResolveEnemyHomeBase?.() || FE_PATCH_06AExistingEnemyBase?.())
      });
      return false;
    }

    const spent = FE_PATCH_09C2SpendEnemyBuildCost(FE_PATCH_09D_FACTORY_TYPE);
    if (!spent.ok) {
      FE_PATCH_09DSetEnemyFactoryBuildStatus('spend_failed', {
        resource: spent.resource || null,
        amount: spent.amount || null,
        have: spent.have || null,
        cost: safeCloneForLog(spent.cost),
        enemyResources: safeCloneForLog(ensureEnemyResources())
      });
      return false;
    }

    builder._reservedBuildCost = {
      type: FE_PATCH_09D_FACTORY_TYPE,
      owner: 'enemy',
      cost: spent.cost,
      createdAt: performance.now(),
      resourcesAfterSpend: safeCloneForLog(ensureEnemyResources())
    };
    builder._buildRefunded = false;
    builder.buildOrder = {
      type: FE_PATCH_09D_FACTORY_TYPE,
      spot: plan.spot,
      accessCell: plan.accessCell || null,
      owner: 'enemy',
      silent: true,
      createdAt: performance.now(),
      sourcePatch: '09D'
    };
    builder.path = plan.path || [];
    builder.state = 'moving_to_build';
    builder._buildMoveTimer = 0;
    builder._buildStuckTimer = 0;
    builder._buildNoProgressTimer = 0;
    builder._buildLastX = builder.x;
    builder._buildLastY = builder.y;
    builder._buildLastDist = null;
    builder._debugStateTimer = 0;

    FE_PATCH_09DSetEnemyFactoryBuildStatus('factory_build_order_assigned', {
      builder:getBuilderDebugSnapshot(builder),
      plan:safeCloneForLog(plan),
      reservedBuildCost:safeCloneForLog(builder._reservedBuildCost)
    });

    debugLog('enemy_builder_factory_build_order_assigned_09d', {
      builder:getBuilderDebugSnapshot(builder),
      plan:safeCloneForLog(plan),
      reservedBuildCost:safeCloneForLog(builder._reservedBuildCost)
    });

    return true;
  }

  function FE_PATCH_09DEnemyFactoryDebugText() {
    if (!game) return 'n/a';

    const factories = FE_PATCH_09DEnemyFactories();
    const complete = factories.filter(b => b.complete);
    if (complete.length) return `${complete.length} complete`;

    if (factories.length) {
      const progress = Math.max(...factories.map(b => Number.isFinite(b.progress) ? b.progress : 0));
      return `building, progress ${Math.round(progress * 100)}%`;
    }

    const queued = (game.units || []).some(u =>
      u &&
      u.kind === 'unit' &&
      u.type === 'builder' &&
      unitOwner(u) === 'enemy' &&
      u.buildOrder?.type === FE_PATCH_09D_FACTORY_TYPE
    );
    if (queued) return 'queued by builder';

    const status = game._enemyFactoryBuildOrderStatus || {};
    if (status.status === 'waiting_complete_separator') return 'waiting for complete separator';
    if (status.status === 'not_enough_resource') {
      const resource = status.resource || 'resource';
      return `waiting ${resource}: ${safeNum(status.have || 0)}/${safeNum(status.amount || 0)}`;
    }
    if (status.status === 'no_available_builder') return 'waiting for idle builder';
    if (status.status === 'no_valid_build_plan') return 'no valid build place';
    if (status.status === 'spend_failed') return 'spend failed';

    return 'missing, waiting build order';
  }

  function FE_PATCH_09DEnemyBuildOrderDebugText() {
    const status = game?._enemyFactoryBuildOrderStatus || null;
    if (!status) return 'factory build order not started';
    if (status.status === 'factory_build_order_assigned') return 'factory build order assigned';
    if (status.status === 'not_enough_resource') {
      return `factory blocked: ${status.resource || 'resource'} ${safeNum(status.have || 0)}/${safeNum(status.amount || 0)}`;
    }
    return `factory: ${status.status || 'idle'}`;
  }
  // FE_PATCH_09D_ENEMY_FACTORY_BUILD_MVP_END

  // FE_PATCH_09E_ENEMY_FACTORY_LIGHT_TANK_PRODUCTION_MVP_START
  const FE_PATCH_09E_FACTORY_UNIT_TYPE = 'light_tank';
  const FE_PATCH_09E_FACTORY_MAX_QUEUE = 1;

  function FE_PATCH_09EEnemyElementKey() {
    const faction = defaultFactionForOwner('enemy');
    return FACTION_ELEMENT_KEY[faction] || 'purple';
  }

  function FE_PATCH_09EEnemyUnitDef() {
    return UNIT_DEFS?.[FE_PATCH_09E_FACTORY_UNIT_TYPE] || { name:'Лёгкий танк', costElement:2, productionTime:35 };
  }

  function FE_PATCH_09ECompleteEnemyFactories() {
    return (typeof FE_PATCH_09DEnemyFactories === 'function' ? FE_PATCH_09DEnemyFactories() : [])
      .filter(b => b && b.complete && !b.destroyed && !b.dead);
  }

  function FE_PATCH_09EEnsureFactoryQueue(factory) {
    if (!factory) return [];
    if (!Array.isArray(factory._enemyFactoryQueue09E)) {
      factory._enemyFactoryQueue09E = [];
    }
    return factory._enemyFactoryQueue09E;
  }

  function FE_PATCH_09ESetProductionStatus(status, extra={}) {
    if (!game) return;
    const prev = game._enemyFactoryProductionStatus || {};
    const next = Object.assign({
      patch: '09E',
      status,
      updatedAt: game.time || 0
    }, extra || {});
    game._enemyFactoryProductionStatus = next;

    if (prev.status !== next.status || prev.resource !== next.resource) {
      debugLog('enemy_factory_production_status_09e', safeCloneForLog(next));
    }
  }

  function FE_PATCH_09ECanStartLightTankProduction(factory) {
    if (!factory || factory.type !== 'units_factory' || !factory.complete || buildingOwner(factory) !== 'enemy') {
      return { ok:false, reason:'no_complete_enemy_factory' };
    }

    const queue = FE_PATCH_09EEnsureFactoryQueue(factory);
    if (queue.length >= FE_PATCH_09E_FACTORY_MAX_QUEUE) {
      return { ok:false, reason:'queue_busy', queueLength:queue.length };
    }

    const def = FE_PATCH_09EEnemyUnitDef();
    const elKey = FE_PATCH_09EEnemyElementKey();
    const cost = Number.isFinite(def.costElement) ? def.costElement : 2;
    const bucket = ensureEnemyResources();
    const have = Number.isFinite(bucket[elKey]) ? bucket[elKey] : 0;
    if (have < cost) {
      return { ok:false, reason:'not_enough_element', resource:elKey, have, amount:cost };
    }

    return { ok:true, queue, def, elKey, cost };
  }

  function FE_PATCH_09EStartLightTankProduction(factory) {
    const canStart = FE_PATCH_09ECanStartLightTankProduction(factory);
    if (!canStart.ok) {
      FE_PATCH_09ESetProductionStatus(canStart.reason, {
        resource: canStart.resource || null,
        have: canStart.have || null,
        amount: canStart.amount || null,
        factoryId: factory?.id || null,
        enemyResources: safeCloneForLog(ensureEnemyResources())
      });
      return false;
    }

    changeResourceForOwner('enemy', canStart.elKey, -canStart.cost);
    const productionTime = Number.isFinite(canStart.def.productionTime) ? canStart.def.productionTime : 35;
    canStart.queue.push({
      type: FE_PATCH_09E_FACTORY_UNIT_TYPE,
      remaining: productionTime,
      total: productionTime,
      costElement: canStart.cost,
      elementKey: canStart.elKey,
      startedAt: game.time || 0,
      sourcePatch: '09E'
    });

    FE_PATCH_09ESetProductionStatus('producing', {
      factoryId: factory.id,
      unitType: FE_PATCH_09E_FACTORY_UNIT_TYPE,
      queueLength: canStart.queue.length,
      costElement: canStart.cost,
      elementKey: canStart.elKey,
      enemyResources: safeCloneForLog(ensureEnemyResources())
    });
    return true;
  }

  function FE_PATCH_09ESpawnEnemyFactoryUnit(factory, queueItem) {
    const spot = findSpawnCellNearBuilding(factory);
    if (!spot) {
      FE_PATCH_09ESetProductionStatus('blocked_no_spawn_cell', {
        factoryId: factory?.id || null,
        unitType: queueItem?.type || FE_PATCH_09E_FACTORY_UNIT_TYPE
      });
      return false;
    }

    const unit = createUnit(queueItem?.type || FE_PATCH_09E_FACTORY_UNIT_TYPE, spot.x, spot.y);
    unit.owner = 'enemy';
    unit.team = 'enemy';
    unit.faction = defaultFactionForOwner('enemy');
    unit.state = 'idle';
    unit.path = [];
    unit.manualTarget = null;
    unit.autoGather = false;
    unit._spawnedByEnemyFactory = true;
    unit._spawnedByPatch = '09E';
    unit._spawnedAt = game.time || 0;

    game.units.push(unit);

    FE_PATCH_09ESetProductionStatus('unit_completed', {
      factoryId: factory.id,
      unitId: unit.id,
      unitType: unit.type,
      spawn: { x: spot.x, y: spot.y },
      enemyTankCount: typeof FE_PATCH_08BEnemyCombatUnits === 'function' ? FE_PATCH_08BEnemyCombatUnits().length : null
    });
    debugLog('enemy_factory_unit_completed_09e', {
      factoryId: factory.id,
      unit: safeCloneForLog(unit),
      spawn: { x: spot.x, y: spot.y }
    });
    return true;
  }

  function FE_PATCH_09EUpdateEnemyFactoryProduction(dt) {
    if (!game || game.screen !== 'game' || game.paused) return;
    if (game.skirmishMode !== true) return;
    if (game.gameResult || game.result || game.gameEnded || game.ended) return;

    const factories = FE_PATCH_09ECompleteEnemyFactories();
    if (!factories.length) {
      FE_PATCH_09ESetProductionStatus('waiting_complete_factory');
      return;
    }

    for (const factory of factories) {
      const queue = FE_PATCH_09EEnsureFactoryQueue(factory);

      // BOT-BASELINE-01: choose unit type — workers have priority over tanks.
      if (!queue.length) {
        var unitType = FE_PATCH_BASELINE_01_ChooseFactoryUnitType();
        if (unitType === 'light_tank') {
          FE_PATCH_09EStartLightTankProduction(factory);
        } else {
          FE_PATCH_BASELINE_01_StartFactoryProduction(factory, unitType);
        }
      }

      if (!queue.length) continue;

      const q = queue[0];
      const speed = 1;
      q.remaining -= dt * speed;
      FE_PATCH_09ESetProductionStatus('producing', {
        factoryId: factory.id,
        unitType: q.type,
        remaining: q.remaining,
        total: q.total,
        queueLength: queue.length
      });

      if (q.remaining <= 0) {
        var unitsBefore = game.units.length;
        const spawned = FE_PATCH_09ESpawnEnemyFactoryUnit(factory, q);
        if (spawned) {
          // BOT-BASELINE-01: auto-start enemy harvesters after spawn.
          for (var i = unitsBefore; i < game.units.length; i++) {
            if (game.units[i].type === 'harvester' && game.units[i].owner === 'enemy') {
              try { startHarvester(game.units[i]); } catch (e) { /* safe fallback */ }
            }
          }
          queue.shift();
        } else {
          q.remaining = 1;
        }
      }
    }
  }

  function FE_PATCH_09EEnemyFactoryQueueDebugText() {
    if (!game) return 'n/a';
    const factories = FE_PATCH_09ECompleteEnemyFactories();
    if (!factories.length) return 'waiting complete factory';

    let busy = 0;
    let bestRemaining = null;
    let bestTotal = null;
    for (const factory of factories) {
      const queue = FE_PATCH_09EEnsureFactoryQueue(factory);
      if (!queue.length) continue;
      busy += 1;
      const q = queue[0];
      if (Number.isFinite(q.remaining)) {
        bestRemaining = bestRemaining === null ? q.remaining : Math.min(bestRemaining, q.remaining);
        bestTotal = Number.isFinite(q.total) ? q.total : bestTotal;
      }
    }

    if (busy > 0) {
      const totalText = Number.isFinite(bestTotal) ? `/${safeNum(bestTotal)}s` : 's';
      return `${busy} producing ${FE_PATCH_09E_FACTORY_UNIT_TYPE}, ${Math.max(0, bestRemaining || 0).toFixed(1)}${totalText}`;
    }

    const status = game._enemyFactoryProductionStatus || {};
    if (status.status === 'not_enough_element') {
      return `waiting ${status.resource || 'element'}: ${safeNum(status.have || 0)}/${safeNum(status.amount || 0)}`;
    }
    if (status.status === 'blocked_no_spawn_cell') return 'blocked: no spawn cell';
    if (status.status === 'unit_completed') return 'last unit completed';
    return status.status || 'idle, waiting resources';
  }

  function FE_PATCH_09EEnemyFactoryBlockedReasonDebugText() {
    const status = game?._enemyFactoryProductionStatus || null;
    if (!status) return 'none';
    if (status.status === 'not_enough_element') return `not enough ${status.resource || 'element'}`;
    if (status.status === 'blocked_no_spawn_cell') return 'no free spawn cell near factory';
    if (status.status === 'waiting_complete_factory') return 'waiting complete factory';
    return status.status || 'none';
  }
  // FE_PATCH_09E_ENEMY_FACTORY_LIGHT_TANK_PRODUCTION_MVP_END

  // BOT-BASELINE-01: worker replenishment — enemy bot can rebuild lost workers.
  // Workers have production priority over light_tank. Cooldown prevents spam.
  const FE_PATCH_BASELINE_01_HARVESTER_MIN = 2;
  const FE_PATCH_BASELINE_01_BUILDER_MIN = 1;
  const FE_PATCH_BASELINE_01_HARVESTER_CAP = 4;
  const FE_PATCH_BASELINE_01_BUILDER_CAP = 2;
  const FE_PATCH_BASELINE_01_WORKER_CHECK_COOLDOWN_MS = 5000;

  function FE_PATCH_BASELINE_01_CountEnemyWorkers(type) {
    return (game?.units || []).filter(u =>
      u && u.kind === 'unit' && u.type === type && unitOwner(u) === 'enemy' && (u.hp ?? 1) > 0
    ).length;
  }

  function FE_PATCH_BASELINE_01_ChooseFactoryUnitType() {
    if (!game) return 'light_tank';
    var now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (now - (game._baseline01LastWorkerCheck || 0) < FE_PATCH_BASELINE_01_WORKER_CHECK_COOLDOWN_MS) return 'light_tank';
    game._baseline01LastWorkerCheck = now;

    // Check if a worker is already queued in any factory to avoid double-order.
    var harvesterQueued = false, builderQueued = false;
    var factories = FE_PATCH_09ECompleteEnemyFactories();
    for (var fi = 0; fi < factories.length; fi++) {
      var fq = FE_PATCH_09EEnsureFactoryQueue(factories[fi]);
      for (var qi = 0; qi < fq.length; qi++) {
        if (fq[qi].type === 'harvester') harvesterQueued = true;
        if (fq[qi].type === 'builder') builderQueued = true;
      }
    }

    var harvCount = FE_PATCH_BASELINE_01_CountEnemyWorkers('harvester');
    var buildCount = FE_PATCH_BASELINE_01_CountEnemyWorkers('builder');

    // Builder first (no builder = no buildings), then harvester.
    if (buildCount < FE_PATCH_BASELINE_01_BUILDER_MIN && !builderQueued && buildCount < FE_PATCH_BASELINE_01_BUILDER_CAP) return 'builder';
    if (harvCount < FE_PATCH_BASELINE_01_HARVESTER_MIN && !harvesterQueued && harvCount < FE_PATCH_BASELINE_01_HARVESTER_CAP) return 'harvester';
    return 'light_tank';
  }

  function FE_PATCH_BASELINE_01_CanStartFactoryProduction(factory, unitType) {
    if (!factory || factory.type !== 'units_factory' || !factory.complete || buildingOwner(factory) !== 'enemy')
      return { ok: false, reason: 'no_complete_enemy_factory' };
    var queue = FE_PATCH_09EEnsureFactoryQueue(factory);
    if (queue.length >= FE_PATCH_09E_FACTORY_MAX_QUEUE)
      return { ok: false, reason: 'queue_busy', queueLength: queue.length };
    var def = UNIT_DEFS && UNIT_DEFS[unitType]
      ? UNIT_DEFS[unitType]
      : (unitType === 'light_tank' ? FE_PATCH_09EEnemyUnitDef() : { name: unitType, costElement: 1, productionTime: 25 });
    var elKey = FE_PATCH_09EEnemyElementKey();
    var cost = Number.isFinite(def.costElement) ? def.costElement : 1;
    var bucket = ensureEnemyResources();
    var have = Number.isFinite(bucket[elKey]) ? bucket[elKey] : 0;
    if (have < cost) return { ok: false, reason: 'not_enough_element', resource: elKey, have: have, amount: cost };
    return { ok: true, queue: queue, def: def, elKey: elKey, cost: cost };
  }

  function FE_PATCH_BASELINE_01_StartFactoryProduction(factory, unitType) {
    var canStart = FE_PATCH_BASELINE_01_CanStartFactoryProduction(factory, unitType);
    if (!canStart.ok) {
      FE_PATCH_09ESetProductionStatus(canStart.reason, {
        resource: canStart.resource || null, have: canStart.have || null, amount: canStart.amount || null,
        factoryId: factory ? factory.id : null, enemyResources: safeCloneForLog(ensureEnemyResources())
      });
      return false;
    }
    changeResourceForOwner('enemy', canStart.elKey, -canStart.cost);
    var productionTime = Number.isFinite(canStart.def.productionTime) ? canStart.def.productionTime : 25;
    canStart.queue.push({
      type: unitType, remaining: productionTime, total: productionTime,
      costElement: canStart.cost, elementKey: canStart.elKey, startedAt: game.time || 0, sourcePatch: 'BASELINE-01'
    });
    FE_PATCH_09ESetProductionStatus('producing', {
      factoryId: factory.id, unitType: unitType, queueLength: canStart.queue.length,
      costElement: canStart.cost, elementKey: canStart.elKey, enemyResources: safeCloneForLog(ensureEnemyResources())
    });
    return true;
  }
  // BOT-BASELINE-01_WORKER_REPLENISHMENT_END

  // BOT-BRAIN-01: priority decision loop — thin decision layer.
  // Evaluates current state and chooses the highest-priority action.
  // Does NOT replace phase-bot (defend/attack/regroup) or AI layers (10B–10I1).
  // Future: scout, storage, upgrade decisions plug into this loop.
  var FE_PATCH_BRAIN_01_ACTIONS = [
    'build_separator',      // no separator exists → build it
    'build_factory',        // no factory exists → build it
    'produce_builder',      // builder count below minimum → produce
    'produce_harvester',    // harvester count below minimum → produce
    'produce_combat',       // workers ok → produce light_tank / attack
    'wait'                  // nothing critical — defer to phase-bot
  ];

  function FE_PATCH_BRAIN_01_ChoosePriorityAction(state) {
    if (!game) return { action: 'wait', reason: 'no_game' };

    // Priority 1: separator — without it, no energy conversion.
    if (!FE_PATCH_09C2EnemySeparatorExistsOrQueued()) {
      return { action: 'build_separator', reason: 'no_separator' };
    }

    // Priority 2: factory — without it, no unit production.
    if (!FE_PATCH_09DEnemyFactoryExistsOrQueued()) {
      return { action: 'build_factory', reason: 'no_factory' };
    }

    // Priority 3: builder — without builder, no buildings can be built.
    var buildCount = FE_PATCH_BASELINE_01_CountEnemyWorkers('builder');
    if (buildCount < FE_PATCH_BASELINE_01_BUILDER_MIN) {
      // Check if builder is already queued in a factory.
      var builderQueued = FE_PATCH_BRAIN_01_IsUnitTypeQueued('builder');
      if (!builderQueued) return { action: 'produce_builder', reason: 'builder_below_min', count: buildCount };
    }

    // Priority 4: harvester — without harvesters, economy dies.
    var harvCount = FE_PATCH_BASELINE_01_CountEnemyWorkers('harvester');
    if (harvCount < FE_PATCH_BASELINE_01_HARVESTER_MIN) {
      var harvesterQueued = FE_PATCH_BRAIN_01_IsUnitTypeQueued('harvester');
      if (!harvesterQueued) return { action: 'produce_harvester', reason: 'harvester_below_min', count: harvCount };
    }

    // Priority 5: combat — workers are ok, time to make army.
    return { action: 'produce_combat', reason: 'economy_stable' };
  }

  function FE_PATCH_BRAIN_01_IsUnitTypeQueued(unitType) {
    var factories = FE_PATCH_09ECompleteEnemyFactories();
    for (var fi = 0; fi < factories.length; fi++) {
      var fq = FE_PATCH_09EEnsureFactoryQueue(factories[fi]);
      for (var qi = 0; qi < fq.length; qi++) {
        if (fq[qi].type === unitType) return true;
      }
    }
    return false;
  }

  function FE_PATCH_BRAIN_01_ExecuteAction(decision, state) {
    // Record decision for telemetry / debug panel.
    game._brain01LastDecision = Object.assign({}, decision, { at: game.time || 0 });

    switch (decision.action) {
      case 'build_separator':
        FE_PATCH_09C2OrderEnemyBuilderBuildSeparator();
        break;
      case 'build_factory':
        FE_PATCH_09DOrderEnemyBuilderBuildFactory();
        break;
      case 'produce_builder':
        FE_PATCH_BRAIN_01_TryProduceWorker('builder');
        break;
      case 'produce_harvester':
        FE_PATCH_BRAIN_01_TryProduceWorker('harvester');
        break;
      case 'produce_combat':
        // Combat production is handled by FE_PATCH_09EUpdateEnemyFactoryProduction
        // which uses FE_PATCH_BASELINE_01_ChooseFactoryUnitType internally.
        // This action just signals: economy is stable, tank production is appropriate.
        break;
      default: // 'wait' — nothing to do, phase-bot handles the rest.
        break;
    }
  }

  function FE_PATCH_BRAIN_01_TryProduceWorker(unitType) {
    var factories = FE_PATCH_09ECompleteEnemyFactories();
    for (var fi = 0; fi < factories.length; fi++) {
      var queue = FE_PATCH_09EEnsureFactoryQueue(factories[fi]);
      if (queue.length > 0) continue; // factory busy, try next.
      if (FE_PATCH_BASELINE_01_StartFactoryProduction(factories[fi], unitType)) return;
    }
  }
  // BOT-BRAIN-01_PRIORITY_DECISION_LOOP_END

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

    const refundOwner = reserved.owner === 'enemy' ? 'enemy' : 'player';

    for (const [resource, amount] of Object.entries(reserved.cost)) {
      if (!amount) continue;
      changeResourceForOwner(refundOwner, resource, amount);
    }

    unit._buildRefunded = true;
    unit._reservedBuildCost = null;

    debugLog('build_cost_refunded', {
      reason,
      reserved,
      refundOwner,
      unit: getBuilderDebugSnapshot(unit),
      resourcesAfter: refundOwner === 'enemy' ? safeCloneForLog(ensureEnemyResources()) : safeCloneForLog(game.resources),
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

    if (typeof showToast === 'function' && unitOwner(unit) !== 'enemy') {
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

        const buildOwner = unit.buildOrder?.owner === 'enemy' ? 'enemy' : unitOwner(unit);
        const b = createBuilding(type, spot.x, spot.y, false, buildOwner);
        b.owner = buildOwner;
        b.team = buildOwner;
        b.faction = defaultFactionForOwner(buildOwner);
        b.buildCost = Object.assign({}, unit._reservedBuildCost?.cost || getBuildCost(type));
        b.buildCostOwner = buildOwner;
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

        if (buildOwner !== 'enemy') {
          showToast(`Строительство: ${BUILDINGS[type].name}`);
        }
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

      const buildOwner = buildingOwner(b);
      const buildFaction = b.faction || defaultFactionForOwner(buildOwner);
      const speed = FACTIONS[buildFaction]?.buildSpeed || 1;
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

        if (buildOwner !== 'enemy') {
          showToast(`Построено: ${BUILDINGS[b.type].name}`);
        }
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
      if (!isPlayerBuilding(b)) continue;
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
    // FE_PATCH_07A1_ENEMY_UNITS_NO_PLAYER_VISION_START
    // Fog of war is player-centric. Enemy units spawned by skirmish setup
    // must not reveal map cells for the player.
    for (const u of game.units) {
      if (!isPlayerUnit(u)) continue;
      const r = u.type === 'harvester' ? 5 : 4;
      reveal(Math.round(u.x), Math.round(u.y), r);
    }
    // FE_PATCH_07A1_ENEMY_UNITS_NO_PLAYER_VISION_END
    for (const b of game.buildings) if (b.complete && isPlayerBuilding(b)) reveal(b.x+Math.floor(b.w/2), b.y+Math.floor(b.h/2), 6);
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

    const renderAssets = getFactionRenderAssets(buildingVisualFaction(b));
    const im = renderAssets.buildings[b.type] || renderAssets.buildings.hq_base || assets.buildings[b.type] || assets.buildings.hq_base;

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
    : u.type === 'light_tank'
      ? window.FE_LIGHT_TANK_FORCE_DIR
      : u.type === 'scout'
        ? window.FE_SCOUT_FORCE_DIR
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

const renderAssets = getFactionRenderAssets(unitVisualFaction(u));
const unitDirectionalAnims = renderAssets.unitAnimations || {};
const directionalAnim = unitDirectionalAnims[u.type] || null;

let unitImage = usableImage(renderAssets.units?.[u.type]) ? renderAssets.units[u.type] : renderAssets.unitFallbacks?.[u.type];
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
      : u.type === 'scout'
        ? window.FE_SCOUT_DIR_MAP
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
        : u.type === 'scout'
          ? window.FE_SCOUT_DIR_OFFSETS
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

const anchorScreenX =
  p.x +
  ((profile.screenOffsetX || 0) + dirOffset.x) * z;

const anchorScreenY =
  p.y +
  TILE_H * z * (profile.groundFactor ?? 1.0) +
  (profile.groundOffset || 0) * z +
  ((profile.screenOffsetY || 0) + dirOffset.y) * z;

const unitSelectedForGlow = selected?.id === u.id || isMultiSelectedUnit(u);
if (unitSelectedForGlow && isPlayerUnit(u)) {
  // FE_LT_04C2G3_SELECTION_GLOW_REAL_ANCHOR
  drawSelectedUnitRingFor(u, selected?.id === u.id, anchorScreenX, anchorScreenY);
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

    const hpW = 34 * z;
    const hpH = 5 * z;
    const unitAnchorY = profile.anchorY ?? 1.0;
    const hpY = u.type === 'builder'
      ? anchorScreenY - 48 * z
      : u.type === 'harvester'
        ? anchorScreenY - 64 * z
        : u.type === 'scout'
          ? anchorScreenY - 52 * z
          : anchorScreenY - profile.size[1] * z * unitAnchorY + profile.hpOffset * z;

    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.58)';
    ctx.fillRect(anchorScreenX - hpW / 2, hpY, hpW, hpH);
    const unitSelected = selected?.id === u.id || isMultiSelectedUnit(u);
    ctx.fillStyle = unitSelected
        ? '#fff08a'
        : '#60e870';
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
    if (!game || !builderDustEnabled() || !unit || !['builder', 'harvester', 'light_tank', 'scout'].includes(unit.type)) return;
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
        : unit.type === 'scout'
          ? window.FE_SCOUT_DUST_WHEEL_Y
          : window.FE_BUILDER_DUST_WHEEL_Y;
    const defaultWheelYOffset = unit.type === 'harvester' ? -34 : unit.type === 'light_tank' ? -28 : unit.type === 'scout' ? -14 : -8;
    const wheelYOffset = Number.isFinite(wheelYOffsetFlag)
      ? wheelYOffsetFlag
      : defaultWheelYOffset;

    const isHarvesterDust = unit.type === 'harvester';
    const isLightTankDust = unit.type === 'light_tank';
    const isScoutDust = unit.type === 'scout';
    const radiusMultFlag = isHarvesterDust
      ? window.FE_HARVESTER_DUST_RADIUS_MULT
      : isLightTankDust
        ? window.FE_LIGHT_TANK_DUST_RADIUS_MULT
        : isScoutDust
          ? window.FE_SCOUT_DUST_RADIUS_MULT
          : 1;
    const alphaMultFlag = isHarvesterDust
      ? window.FE_HARVESTER_DUST_ALPHA_MULT
      : isLightTankDust
        ? window.FE_LIGHT_TANK_DUST_ALPHA_MULT
        : isScoutDust
          ? window.FE_SCOUT_DUST_ALPHA_MULT
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
    if (!builderDustEnabled() || !unit || !['builder', 'harvester', 'light_tank', 'scout'].includes(unit.type)) return;

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
      const isAttack = m.type === 'attack';
      const stroke = isBad ? '#ff5546' : isAttack ? '#ff3434' : '#69ff78';
      const fill = isBad ? 'rgba(255,70,55,.32)' : isAttack ? 'rgba(255,45,45,.30)' : 'rgba(72,255,102,.30)';
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
      if (typeof FE_PATCH_06DHideDomOverlay === 'function') FE_PATCH_06DHideDomOverlay();
      ctx.clearRect(0,0,canvas.clientWidth,canvas.clientHeight);
      return;
    }

    if (game.gameResult && typeof FE_PATCH_06DShowDomOverlay === 'function') {
      FE_PATCH_06DShowDomOverlay(game.gameResult, game.gameResultReason || 'render_sync');
    } else if (typeof FE_PATCH_06DHideDomOverlay === 'function') {
      FE_PATCH_06DHideDomOverlay();
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

    if (window.FE_COMBAT_DEBUG_OVERLAY) {
      window.FE_COMBAT_DEBUG_OVERLAY.drawOverlay({
        ctx, tileToScreen, selectedPlayerLightTanks, selected,
        attackMoveArmed, isLightTank, isPlayerUnit, isEnemyUnit,
        getLightTankCombatStats,
        resolveAttackTarget: FE_PATCH_06BResolveAttackTarget,
        targetCenter: FE_PATCH_06BTargetCenter,
        isAttackableEnemyBuilding: FE_PATCH_06BIsAttackableEnemyBuilding
      });
    }
    drawDragSelectionBox();
    FE_PATCH_06DDrawGameResultOverlay();
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
    if (u.state === 'attack_move') return 'атака-движение';
    return ({
      idle:'ожидает',
      manual_move:'едет',
      moving_to_mine:'едет к минералам',
      harvesting:'добывает',
      returning:'возвращается на базу',
      waiting_for_base_path:'ждёт путь к базе',
      unloading:'выгружает',
      storage_full:'склад сырья заполнен',
      attacking:'атакует',
      attack_approach:'едет атаковать',
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
    if (u.type==='light_tank' || u.type==='scout') {
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
      ${['builder','harvester','light_tank','scout'].map(type=>{
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
  // FE_LT_04B1_DRAG_SELECT_START
  function clearSelectionState() {
    selected = null;
    selectedUnits = [];
  }

  function isMultiSelectedUnit(unit) {
    return !!unit && Array.isArray(selectedUnits) && selectedUnits.some(u => u?.id === unit.id);
  }

  function setSingleSelection(obj) {
    if (obj?.kind === 'unit' && !isPlayerUnit(obj)) {
      selected = null;
      selectedUnits = [];
      return;
    }

    selected = obj || null;
    selectedUnits = isLightTank(obj) && isPlayerUnit(obj) ? [obj] : [];
  }

  function setMultiSelection(units) {
    selectedUnits = (units || []).filter(u => isLightTank(u) && isPlayerUnit(u));
    selected = selectedUnits[0] || null;
    hideMenus();
    updateSelectedInfo();

    if (selectedUnits.length > 1) {
      showToast(`Выбрано танков: ${selectedUnits.length}`);
    } else if (selectedUnits.length === 1) {
      showToast('Выбран лёгкий танк');
    }
  }

  // FE_LT_04C4_DOUBLE_CLICK_SELECT_START
  function FE_LT_04C4VisiblePlayerLightTanks() {
    if (!game?.units?.length) return [];

    // FE_LT_04C4F_SCREEN_VISIBLE_DOUBLE_CLICK_START
    const screenMargin = 40;
    const viewportLeft = -screenMargin;
    const viewportTop = -screenMargin;
    const viewportRight = canvas.clientWidth + screenMargin;
    const viewportBottom = canvas.clientHeight + screenMargin;
    // FE_LT_04C4F_SCREEN_VISIBLE_DOUBLE_CLICK_END

    return game.units.filter(u =>
      {
        if (!u || !isLightTank(u) || !isPlayerUnit(u)) return false;
        if (!isVisible(Math.round(u.x), Math.round(u.y))) return false;

        const p = tileToScreen(u.x, u.y);
        const z = game?.camera?.zoom || 1;
        const profile = spriteProfile('units', u.type, {
          size:[42,42],
          groundFactor:1.05,
          groundOffset:0,
          hpOffset:-10,
          alphaCutoff:135
        });
        const anchorScreenX = p.x + (profile.screenOffsetX || 0) * z;
        const anchorScreenY =
          p.y +
          TILE_H * z * (profile.groundFactor ?? 1.0) +
          (profile.groundOffset || 0) * z +
          (profile.screenOffsetY || 0) * z;
        const sw = profile.size[0] * z;
        const sh = profile.size[1] * z;
        const spriteAnchorX = profile.anchorX ?? 0.5;
        const spriteAnchorY = profile.anchorY ?? 1.0;
        const left = anchorScreenX - sw * spriteAnchorX;
        const top = anchorScreenY - sh * spriteAnchorY;
        const right = left + sw;
        const bottom = top + sh;

        return (
          right >= viewportLeft &&
          left <= viewportRight &&
          bottom >= viewportTop &&
          top <= viewportBottom
        );
      }
    );
  }
  // FE_LT_04C4_DOUBLE_CLICK_SELECT_END

  function dragSelectionRect() {
    return {
      x1: Math.min(dragSelect.startX, dragSelect.x),
      y1: Math.min(dragSelect.startY, dragSelect.y),
      x2: Math.max(dragSelect.startX, dragSelect.x),
      y2: Math.max(dragSelect.startY, dragSelect.y)
    };
  }

  function lightTankScreenPoint(unit) {
    const p = tileToScreen(unit.x, unit.y);
    const z = game.camera.zoom || 1;
    return { x:p.x, y:p.y + TILE_H * z * 0.55 };
  }

  function playerLightTanksInDragRect() {
    if (!game?.units?.length) return [];

    const r = dragSelectionRect();

    return game.units.filter(u => {
      if (!isLightTank(u) || !isPlayerUnit(u)) return false;
      if (!isVisible(Math.round(u.x), Math.round(u.y))) return false;

      const p = lightTankScreenPoint(u);
      return p.x >= r.x1 && p.x <= r.x2 && p.y >= r.y1 && p.y <= r.y2;
    });
  }

    function drawUnitSelectionRingAt(x, y, active=false, tune=null) {
    // FE_LT_04C2G_SELECTION_VISUAL_FIX
    // FE_LT_04C2G2_DRAW_SELECTION_GLOW_UNDER_UNIT
    // FE_LT_04C2G3_SELECTION_GLOW_REAL_ANCHOR
    // PATCH-VIS-01-TANK-SELECTION-RING-POLISH_START
    // PATCH-VIS-02-SELECTION-RING-UNIT-GROUND-OFFSETS_START
    // PATCH-VIS-04B-ROBUST-FACTION-RING-COLOR-BUILDER-FIX_START
    const z = game?.camera?.zoom || 1;
    const rxScale = Number.isFinite(tune?.rx) ? tune.rx : 1;
    const ryScale = Number.isFinite(tune?.ry) ? tune.ry : 1;
    const rX = Math.max(20, TILE_W * z * 0.39 * rxScale);
    const rY = Math.max(6, TILE_H * z * 0.155 * ryScale);

    const factionColor = tune?.factionColor || { r: 105, g: 238, b: 255 };
    const factionRGBA = (a) => `rgba(${factionColor.r}, ${factionColor.g}, ${factionColor.b}, ${a})`;

    ctx.save();
    ctx.globalCompositeOperation = 'source-over';

    const shadow = ctx.createRadialGradient(x, y, 1, x, y, rX * 1.20);
    shadow.addColorStop(0.00, 'rgba(0, 0, 0, 0.24)');
    shadow.addColorStop(0.58, 'rgba(0, 0, 0, 0.13)');
    shadow.addColorStop(1.00, 'rgba(0, 0, 0, 0.00)');
    ctx.fillStyle = shadow;
    ctx.beginPath();
    ctx.ellipse(x, y + 1 * z, rX * 1.06, rY * 0.90, 0, 0, Math.PI * 2);
    ctx.fill();

    // Increase the glow itself, not the ring size.
    const factionGlow = ctx.createRadialGradient(x, y, 1, x, y, rX * 1.02);
    factionGlow.addColorStop(0.00, active ? factionRGBA(0.92) : factionRGBA(0.60));
    factionGlow.addColorStop(0.50, active ? factionRGBA(0.50) : factionRGBA(0.32));
    factionGlow.addColorStop(1.00, factionRGBA(0.00));
    ctx.fillStyle = factionGlow;
    ctx.beginPath();
    ctx.ellipse(x, y, rX * 1.00, rY * 0.96, 0, 0, Math.PI * 2);
    ctx.fill();

    // Keep a warm selection aura, but faction glow should now dominate visually.
    const warmGlow = ctx.createRadialGradient(x, y, 1, x, y, rX);
    warmGlow.addColorStop(0.00, active ? 'rgba(255, 214, 88, 0.18)' : 'rgba(255, 214, 88, 0.12)');
    warmGlow.addColorStop(0.58, active ? 'rgba(255, 190, 64, 0.10)' : 'rgba(255, 190, 64, 0.07)');
    warmGlow.addColorStop(1.00, 'rgba(255, 190, 64, 0.00)');
    ctx.fillStyle = warmGlow;
    ctx.beginPath();
    ctx.ellipse(x, y, rX, rY, 0, 0, Math.PI * 2);
    ctx.fill();

    // Visible ring returns to faction color.
    ctx.strokeStyle = active ? factionRGBA(0.94) : factionRGBA(0.76);
    ctx.lineWidth = Math.max(1.25, 1.55 * z);
    ctx.beginPath();
    ctx.ellipse(x, y, rX * 0.92, rY * 0.82, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = active ? factionRGBA(0.60) : factionRGBA(0.42);
    ctx.lineWidth = Math.max(1, 1.05 * z);
    ctx.beginPath();
    ctx.ellipse(x, y, rX * 0.68, rY * 0.56, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
    // PATCH-VIS-04B-ROBUST-FACTION-RING-COLOR-BUILDER-FIX_END
    // PATCH-VIS-02-SELECTION-RING-UNIT-GROUND-OFFSETS_END
    // PATCH-VIS-01-TANK-SELECTION-RING-POLISH_END
  }


  function drawDragSelectionBox() {
    if (!dragSelect.active || !dragSelect.moved) return;

    const r = dragSelectionRect();
    const w = r.x2 - r.x1;
    const h = r.y2 - r.y1;
    if (w < 4 || h < 4) return;

    ctx.save();
    ctx.fillStyle = 'rgba(95, 220, 255, 0.10)';
    ctx.strokeStyle = 'rgba(125, 235, 255, 0.82)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.fillRect(r.x1, r.y1, w, h);
    ctx.strokeRect(r.x1, r.y1, w, h);
    ctx.restore();
  }

  function beginDragSelect(e) {
    if (!game || game.screen !== 'game' || game.paused || e.button !== 0) return;

    const p = getCanvasPoint(e);
    dragSelect.active = true;
    dragSelect.moved = false;
    dragSelect.suppressClick = false;
    dragSelect.startX = p.x;
    dragSelect.startY = p.y;
    dragSelect.x = p.x;
    dragSelect.y = p.y;
  }

  function updateDragSelect(e) {
    if (!dragSelect.active || !game || game.screen !== 'game') return;

    const p = getCanvasPoint(e);
    dragSelect.x = p.x;
    dragSelect.y = p.y;

    if (Math.hypot(dragSelect.x - dragSelect.startX, dragSelect.y - dragSelect.startY) > 6) {
      dragSelect.moved = true;
    }
  }

  function endDragSelect(e) {
    if (!dragSelect.active || e.button !== 0) return;

    updateDragSelect(e);

    if (dragSelect.moved) {
      dragSelect.suppressClick = true;
      setMultiSelection(playerLightTanksInDragRect());
    }

    dragSelect.active = false;
    dragSelect.moved = false;
  }
  // FE_LT_04B1_DRAG_SELECT_END

  // FE_LT_04B1F_SELECTION_RING_GROUP_MOVE_START
  function selectedPlayerLightTanks() {
    return (selectedUnits || []).filter(u =>
      u &&
      game?.units?.some(live => live.id === u.id) &&
      isLightTank(u) &&
      isPlayerUnit(u)
    );
  }

  // FE_LT_04C2H_TANK_COLLISION_GUARD_START
  function cellKeyXY(x, y) {
    return `${Math.round(x)},${Math.round(y)}`;
  }

  function lightTankAtCell(x, y, ignoreId=null) {
    if (!game?.units?.length) return null;
    const cx = Math.round(x);
    const cy = Math.round(y);

    return game.units.find(u =>
      u &&
      u.id !== ignoreId &&
      isLightTank(u) &&
      Math.round(u.x) === cx &&
      Math.round(u.y) === cy
    ) || null;
  }

  function lightTankReservedGoalCell(x, y, ignoreId=null) {
    if (!game?.units?.length) return null;
    const cx = Math.round(x);
    const cy = Math.round(y);

    return game.units.find(u => {
      if (!u || u.id === ignoreId || !isLightTank(u)) return false;
      if (!u.path || !u.path.length) return false;

      const goal = u.path[u.path.length - 1];
      return Math.round(goal.x) === cx && Math.round(goal.y) === cy;
    }) || null;
  }

  function lightTankDestinationCellFree(x, y, ignoreId=null, reservedKeys=null) {
    const cx = Math.round(x);
    const cy = Math.round(y);
    const key = cellKeyXY(cx, cy);

    if (reservedKeys?.has(key)) return false;
    if (!inBounds(cx, cy)) return false;
    if (!passable(cx, cy, ignoreId)) return false;
    if (lightTankAtCell(cx, cy, ignoreId)) return false;
    if (lightTankReservedGoalCell(cx, cy, ignoreId)) return false;

    return true;
  }

  function lightTankDestinationOffsets() {
    return [
      [0,0],
      [1,0], [-1,0], [0,1], [0,-1],
      [1,1], [-1,1], [1,-1], [-1,-1],
      [2,0], [-2,0], [0,2], [0,-2],
      [2,1], [-2,1], [2,-1], [-2,-1],
      [1,2], [-1,2], [1,-2], [-1,-2],
      [2,2], [-2,2], [2,-2], [-2,-2],
      [3,0], [-3,0], [0,3], [0,-3]
    ];
  }

  // FE_MOVE_02_LIGHT_TANK_DEST_PATH_COST_START
  function FE_MOVE_02ResolveUnitForPathCost(unitOrId) {
    if (unitOrId && typeof unitOrId === 'object') return unitOrId;
    if (unitOrId === null || unitOrId === undefined) return null;
    return game?.units?.find(u => u.id === unitOrId) || null;
  }

  function FE_MOVE_02PickBestLightTankDestination(unitOrId, tx, ty, reservedKeys=null) {
    const unit = FE_MOVE_02ResolveUnitForPathCost(unitOrId);
    const ignoreId = unit?.id ?? unitOrId ?? null;
    const anchorX = Math.round(tx);
    const anchorY = Math.round(ty);
    let bestCell = null;
    let bestScore = Infinity;

    for (const [dx, dy] of lightTankDestinationOffsets()) {
      const x = Math.round(anchorX + dx);
      const y = Math.round(anchorY + dy);

      if (!lightTankDestinationCellFree(x, y, ignoreId, reservedKeys)) continue;

      const candidate = { x, y };
      const anchorDistance = Math.abs(x - anchorX) + Math.abs(y - anchorY);
      let pathLength = 0;

      if (unit) {
        const path = findPath(unit, candidate, unit.id);
        if (path === null) continue;
        pathLength = Array.isArray(path) ? path.length : 9999;
      }

      // MOVE-03: the clicked cell is the anchor. Prefer cells closest to the click first;
      // path length is only a tie-breaker. The older path-first scoring made groups stop
      // several cells before the player's clicked point.
      const score = anchorDistance * 10000 + pathLength;

      if (score < bestScore) {
        bestScore = score;
        bestCell = candidate;
      }
    }

    return bestCell;
  }
  // FE_MOVE_02_LIGHT_TANK_DEST_PATH_COST_END

  function findNearestLightTankDestinationCell(tx, ty, unitId=null, reservedKeys=null) {
    return FE_MOVE_02PickBestLightTankDestination(unitId, tx, ty, reservedKeys);
  }
  // FE_LT_04C2H_TANK_COLLISION_GUARD_END

  function groupMoveDestinationCells(tx, ty, count, units=null) {
    const result = [];
    const reserved = new Set();
    const orderedUnits = Array.isArray(units) ? units : [];

    for (let i = 0; i < orderedUnits.length && result.length < count; i++) {
      const unit = orderedUnits[i];
      const cell = FE_MOVE_02PickBestLightTankDestination(unit, tx, ty, reserved);
      if (!cell) continue;

      reserved.add(cellKeyXY(cell.x, cell.y));
      result.push(cell);
    }

    for (const [dx, dy] of lightTankDestinationOffsets()) {
      if (result.length >= count) break;

      const x = Math.round(tx + dx);
      const y = Math.round(ty + dy);
      const key = cellKeyXY(x, y);

      if (!lightTankDestinationCellFree(x, y, null, reserved)) continue;

      reserved.add(key);
      result.push({ x, y });
    }

    return result;
  }

  
// FE_PATCH_08B1_PLAYER_MOVE_CANCELS_ATTACK_START
function FE_PATCH_08B1IsPlayerLightTankForCancel(unit) {
  if (!unit) return false;

  if (typeof isLightTank === 'function') {
    if (!isLightTank(unit)) return false;
  } else if (unit.type !== 'light_tank') {
    return false;
  }

  if (typeof isEnemyUnit === 'function' && isEnemyUnit(unit)) return false;
  if (typeof isPlayerUnit === 'function') return !!isPlayerUnit(unit);

  return !unit.owner || unit.owner === 'player';
}

function FE_PATCH_08B1ClearPlayerLightTankAttackState(unit, reason='manual_move') {
  if (!FE_PATCH_08B1IsPlayerLightTankForCancel(unit)) return false;

  const explicitNullFields = [
    'attackTargetId',
    'attackTarget',
    'attackTargetKind',
    'attackTargetType',
    'manualAttackTargetId',
    'manualAttackTarget',
    'manualAttackTargetKind',
    'attackApproachTargetId',
    'attackApproachTarget',
    'attackApproachTargetKind',
    'attackApproachTargetType',
    'attackApproachTx',
    'attackApproachTy',
    'attackApproachX',
    'attackApproachY',
    'attackMoveTarget',
    'attackMoveTargetId',
    'attackMoveTx',
    'attackMoveTy',
    '_attackTargetId',
    '_attackTarget',
    '_attackCommandTargetId',
    '_attackApproachTargetId',
    '_attackApproachTarget'
  ];

  const explicitFalseFields = [
    'attackCommanded',
    'manualAttackCommanded',
    'attackApproach',
    'isAttackApproaching',
    'attackMoveCommanded',
    '_attackCommanded',
    '_attackApproach'
  ];

  for (const key of explicitNullFields) {
    if (Object.prototype.hasOwnProperty.call(unit, key)) unit[key] = null;
  }

  for (const key of explicitFalseFields) {
    if (Object.prototype.hasOwnProperty.call(unit, key)) unit[key] = false;
  }

  // Defensive cleanup for patch-era fields with slightly different names.
  // Only clears attack target/approach/command/move fields on PLAYER light_tank
  // when a real manual ground-move command is issued.
  for (const key of Object.keys(unit)) {
    if (!/attack/i.test(key)) continue;
    if (!/(target|approach|command|move)/i.test(key)) continue;
    if (/cooldown|range|damage|rate|speed|radius/i.test(key)) continue;

    const value = unit[key];
    if (typeof value === 'boolean') {
      unit[key] = false;
    } else {
      unit[key] = null;
    }
  }

  unit._lastPlayerAttackCancelReason = reason;
  unit._lastPlayerAttackCancelAt = (typeof performance !== 'undefined' && performance.now)
    ? performance.now()
    : Date.now();

  return true;
}

function FE_PATCH_08B1ClearSelectedPlayerLightTankAttackState(reason='group_manual_move') {
  const seen = new Set();
  const candidates = [];

  const pushCandidate = (item) => {
    if (!item || seen.has(item)) return;
    seen.add(item);
    candidates.push(item);
  };

  if (typeof selectedUnits !== 'undefined') {
    if (Array.isArray(selectedUnits)) {
      for (const unit of selectedUnits) pushCandidate(unit);
    } else if (selectedUnits && typeof selectedUnits.forEach === 'function') {
      selectedUnits.forEach(pushCandidate);
    }
  }

  if (typeof selectedUnit !== 'undefined') pushCandidate(selectedUnit);

  if (typeof selected !== 'undefined') {
    if (Array.isArray(selected)) {
      for (const unit of selected) pushCandidate(unit);
    } else {
      pushCandidate(selected);
    }
  }

  let cleared = 0;
  for (const unit of candidates) {
    if (FE_PATCH_08B1ClearPlayerLightTankAttackState(unit, reason)) cleared += 1;
  }
  return cleared;
}
// FE_PATCH_08B1_PLAYER_MOVE_CANCELS_ATTACK_END

function setGroupManualMove(units, tx, ty) {
  FE_PATCH_08B1ClearSelectedPlayerLightTankAttackState('group_manual_move');
    const group = (units || []).filter(u => isLightTank(u) && isPlayerUnit(u));
    if (!group.length) return false;

    let ordered = group.slice().sort((a, b) => dist(a, {x:tx,y:ty}) - dist(b, {x:tx,y:ty}));
    const cells = groupMoveDestinationCells(tx, ty, group.length, ordered);

    if (!cells.length) {
      showToast('Группа не может доехать');
      return true;
    }

    let moved = 0;

    for (let i = 0; i < ordered.length; i++) {
      const unit = ordered[i];
      const cell = cells[i] || cells[cells.length - 1];

      if (!cell) continue;

      setManualMove(unit, cell.x, cell.y);
      moved += 1;
    }

    hideMenus();
    showToast(`Группа едет: ${moved}`);
    return true;
  }

  function drawSelectedUnitRingFor(unit, active=false, anchorX=null, anchorY=null) {
    if (!isPlayerUnit(unit)) return;

    const z = game?.camera?.zoom || 1;
        const ringTuneByType = {
      // PATCH-VIS-04B-ROBUST-FACTION-RING-COLOR-BUILDER-FIX_START
      // Harvester remains the baseline. Builder was too high, so move it down.
      light_tank: { x: 0, y: -32, rx: 0.98, ry: 0.92 },
      harvester: { x: 0, y: -30, rx: 1.00, ry: 0.94 },
      builder: { x: 0, y: -12, rx: 0.92, ry: 0.88 },
      scout: { x: 0, y: -28, rx: 0.88, ry: 0.84 },
      // PATCH-VIS-04B-ROBUST-FACTION-RING-COLOR-BUILDER-FIX_END
    };

    const factionRingColors = {
      green:  { r: 110, g: 235, b: 120 },
      cyan:   { r: 105, g: 238, b: 255 },
      yellow: { r: 255, g: 222, b: 92 },
      purple: { r: 196, g: 122, b: 255 },
    };
    const factionKey = String(
      unit?.visualFaction ||
      unit?.faction ||
      unit?.ownerFaction ||
      game?.playerFaction ||
      'cyan'
    ).toLowerCase();
    const factionColor = factionRingColors[factionKey] || factionRingColors.cyan;

    const tuneBase = ringTuneByType[unit?.type] || { x: 0, y: -20, rx: 0.94, ry: 0.90 };
    const tune = { ...tuneBase, factionColor };

if (Number.isFinite(anchorX) && Number.isFinite(anchorY)) {
      drawUnitSelectionRingAt(
        anchorX + (tune.x || 0) * z,
        anchorY + (tune.y || 0) * z,
        active,
        tune
      );
      return;
    }

    const p = tileToScreen(unit.x, unit.y);
    drawUnitSelectionRingAt(
      p.x + (tune.x || 0) * z,
      p.y + TILE_H * z * 0.42 + (tune.y || 0) * z,
      active,
      tune
    );
  }

  // FE_LT_04B1F_SELECTION_RING_GROUP_MOVE_END

  // FE_LT_04B2_GROUP_ATTACK_START
  function setGroupLightTankAttack(units, target) {
    const group = (units || []).filter(u =>
      u &&
      game?.units?.some(live => live.id === u.id) &&
      isLightTank(u) &&
      isPlayerUnit(u)
    );

    if (!group.length) return false;
    if (!isLightTank(target) || !isEnemyUnit(target)) return false;

    let accepted = 0;
    let outOfRange = 0;

    for (const unit of group) {
      const ok = setLightTankAttack(unit, target);
      if (ok) accepted += 1;
      else outOfRange += 1;
    }

    if (accepted > 0 && outOfRange > 0) {
      showToast(`Атакуют: ${accepted}, вне дальности: ${outOfRange}`);
    } else if (accepted > 1) {
      showToast(`Группа атакует: ${accepted}`);
    } else if (accepted === 0) {
      showToast('Цель вне дальности');
    }

    hideMenus();
    updateSelectedInfo();
    return true;
  }
  // FE_LT_04B2_GROUP_ATTACK_END

  // FE_LT_04C_CLEAN1_REMOVE_DUPLICATE_ATTACK_APPROACH
  // FE_LT_04C1_ATTACK_APPROACH_START
  function clearLightTankAttackApproach(unit) {
    if (!unit) return;
    FE_PATCH_06BClearAttackApproach(unit);
  }

  function attackApproachCellsForTarget(attacker, target) {
    if (!attacker || !target) return [];
    if (target.kind === 'building') return FE_PATCH_06BAttackApproachCellsForBuilding(attacker, target);

    const stats = getLightTankCombatStats(attacker);
    const range = Math.max(1, Math.round(stats.range || 1));
    const tx = Math.round(target.x);
    const ty = Math.round(target.y);

    const cells = [];

    for (let y = ty - range; y <= ty + range; y++) {
      for (let x = tx - range; x <= tx + range; x++) {
        if (Math.abs(x - tx) + Math.abs(y - ty) > range) continue;
        if (x === tx && y === ty) continue;
        if (!lightTankDestinationCellFree(x, y, attacker.id)) continue;
        cells.push({ x, y });
      }
    }

    cells.sort((a, b) => dist(attacker, a) - dist(attacker, b));
    return cells;
  }

  function setLightTankAttackApproachGeneric(attacker, target, options={}) {
    const targetKind = FE_PATCH_07BGetHostileLightTankTargetKind(attacker, target);
    if (!targetKind) return false;
    if (typeof clearLightTankAttackMove === 'function') clearLightTankAttackMove(attacker);

    const inRange = targetKind === 'building'
      ? FE_PATCH_06BDistanceToBuilding(attacker, target) <= getLightTankCombatStats(attacker).range
      : unitDistanceCells(attacker, target) <= getLightTankCombatStats(attacker).range;
    if (inRange) {
      return setLightTankAttackGeneric(attacker, target, options);
    }

    const cells = attackApproachCellsForTarget(attacker, target);

    for (const cell of cells) {
      const path = findPath(attacker, cell, attacker.id);
      if (path === null) continue;

      attacker.attackApproachTargetId = target.id;
      attacker.attackApproachTargetKind = targetKind;
      attacker._attackApproachCommanded = true;
      FE_PATCH_06BClearAttackTarget(attacker);
      attacker.path = path;
      attacker.state = 'attack_approach';
      attacker.manualTarget = null;
      attacker._queuedManualMove = null;
      attacker._dirTargetKey = null;
      attacker._dirDx = 0;
      attacker._dirDy = 0;

      if (options.marker !== false) addUnitClickMarker(attacker, cell.x, cell.y, 'ok');
      return true;
    }

    const marker = options.marker !== false ? FE_PATCH_06BAttackMarkerPoint(target) : null;
    if (marker) addUnitClickMarker(attacker, marker.x, marker.y, 'bad');
    if (options.toast !== false) showToast('Танк не может подъехать к цели');
    return false;
  }

  function setLightTankAttackApproach(attacker, target) {
    if (!isLightTank(attacker) || !isPlayerUnit(attacker)) return false;
    return setLightTankAttackApproachGeneric(attacker, target, { toast:true, marker:true });
  }

  function updateLightTankAttackApproach(unit, dt) {
    if (!isLightTank(unit)) return false;
    if (unit.state !== 'attack_approach' && !unit.attackApproachTargetId) return false;

    const target = FE_PATCH_06BResolveApproachTarget(unit);

    if (!target) {
      clearLightTankAttackApproach(unit);
      if (unit.state === 'attack_approach') unit.state = 'idle';
      return true;
    }

    if (FE_PATCH_07BGetHostileLightTankTargetKind(unit, target) !== unit.attackApproachTargetKind) {
      clearLightTankAttackApproach(unit);
      if (unit.state === 'attack_approach') unit.state = 'idle';
      return true;
    }

    const inRange = unit.attackApproachTargetKind === 'building'
      ? FE_PATCH_06BDistanceToBuilding(unit, target) <= getLightTankCombatStats(unit).range
      : unitDistanceCells(unit, target) <= getLightTankCombatStats(unit).range;
    if (inRange) {
      clearLightTankAttackApproach(unit);
      setLightTankAttackGeneric(unit, target, {
        toast: isPlayerUnit(unit),
        marker: isPlayerUnit(unit)
      });
      return true;
    }

    if (unit.path && unit.path.length) {
      updateUnitMovement(unit, dt);
      return true;
    }

    const ok = setLightTankAttackApproach(unit, target);
    if (!ok) {
      clearLightTankAttackApproach(unit);
      unit.state = 'idle';
      showToast('Танк не может подъехать к цели');
    }

    return true;
  }

  function setGroupLightTankAttackApproach(units, target) {
    const group = (units || []).filter(u =>
      u &&
      game?.units?.some(live => live.id === u.id) &&
      isLightTank(u) &&
      isPlayerUnit(u)
    );

    if (!group.length) return false;
    const isEnemyTankTarget = isLightTank(target) && isEnemyUnit(target);
    const isEnemyBuildingTarget = FE_PATCH_06BIsAttackableEnemyBuilding(target);
    if (!isEnemyTankTarget && !isEnemyBuildingTarget) return false;

    let direct = 0;
    let approaching = 0;
    let failed = 0;

    for (const unit of group) {
      const inRange = isEnemyBuildingTarget
        ? FE_PATCH_06BDistanceToBuilding(unit, target) <= getLightTankCombatStats(unit).range
        : unitDistanceCells(unit, target) <= getLightTankCombatStats(unit).range;
      if (inRange) {
        if (setLightTankAttack(unit, target)) direct += 1;
        else failed += 1;
        continue;
      }

      if (setLightTankAttackApproach(unit, target)) approaching += 1;
      else failed += 1;
    }

    if (direct || approaching) {
      showToast(`Атака: ${direct}, подъезжают: ${approaching}${failed ? `, не дошли: ${failed}` : ''}`);
    } else {
      showToast('Группа не может атаковать цель');
    }

    hideMenus();
    updateSelectedInfo();
    return true;
  }
  // FE_LT_04C1_ATTACK_APPROACH_END

  // FE_LT_04C3B_ATTACK_MOVE_THIN_LAYER_START
  function clearLightTankAttackMove(unit) {
    if (!unit) return;
    unit.attackMoveTarget = null;
    unit.attackMoveAggroTargetId = null;
  }

  function selectedAttackMoveUnits() {
    const group = selectedPlayerLightTanks();
    if (group.length > 0) return group;

    return isLightTank(selected) && isPlayerUnit(selected) ? [selected] : [];
  }

  function findAttackMoveEnemyInRange(unit) {
    if (!isLightTank(unit) || !game?.units?.length) return null;

    const stats = getLightTankCombatStats(unit);

    const candidates = game.units
      .filter(u =>
        u &&
        isLightTank(u) &&
        isEnemyUnit(u) &&
        unitDistanceCells(unit, u) <= stats.range
      )
      .sort((a, b) => unitDistanceCells(unit, a) - unitDistanceCells(unit, b));

    return candidates[0] || null;
  }

  function setLightTankAttackMove(unit, tx, ty, options={}) {
    if (!isLightTank(unit) || !isPlayerUnit(unit)) return false;

    const markerEnabled = options?.marker !== false;
    const cell = findNearestLightTankDestinationCell(tx, ty, unit.id);
    if (!cell) {
      if (markerEnabled) addUnitClickMarker(unit, tx, ty, 'bad');
      return false;
    }

    const path = findPath(unit, cell, unit.id);
    if (path === null) {
      if (markerEnabled) addUnitClickMarker(unit, cell.x, cell.y, 'bad');
      return false;
    }

    FE_PATCH_06BClearAttackTarget(unit);
    FE_PATCH_06BClearAttackApproach(unit);
    unit._attackApproachCommanded = false;
    unit.attackMoveTarget = { x:cell.x, y:cell.y };
    unit.attackMoveAggroTargetId = null;
    unit.path = path;
    unit.state = 'attack_move';
    unit.manualTarget = null;
    unit._queuedManualMove = null;
    unit._dirTargetKey = null;
    unit._dirDx = 0;
    unit._dirDy = 0;

    if (markerEnabled) addUnitClickMarker(unit, cell.x, cell.y, 'attack');
    return true;
  }

  function setGroupLightTankAttackMove(units, tx, ty) {
    const group = (units || []).filter(u =>
      u &&
      game?.units?.some(live => live.id === u.id) &&
      isLightTank(u) &&
      isPlayerUnit(u)
    );

    if (!group.length) return false;

    let ordered = group.slice().sort((a, b) => dist(a, {x:tx,y:ty}) - dist(b, {x:tx,y:ty}));
    const cells = groupMoveDestinationCells(tx, ty, group.length, ordered);
    if (!cells.length) {
      showToast('Группа не может выполнить attack-move');
      return true;
    }

    let accepted = 0;

    for (let i = 0; i < ordered.length; i++) {
      const unit = ordered[i];
      const cell = cells[i] || cells[cells.length - 1];
      if (!cell) continue;

      if (setLightTankAttackMove(unit, cell.x, cell.y, { marker:false })) accepted += 1;
    }

    if (accepted > 0) addClickMarker(tx, ty, 'attack', 'light_tank');

    hideMenus();
    showToast(`Attack-move: ${accepted}`);
    return true;
  }

  function updateLightTankAttackMove(unit, dt) {
    if (!isLightTank(unit) || !unit.attackMoveTarget) return false;
    if (unit.attackApproachTargetId || unit.state === 'attack_approach') return false;

    if (unit.attackTargetId) {
      const target = FE_PATCH_06BResolveAttackTarget(unit);
      const targetInRange =
        !!target &&
        isLightTank(target) &&
        isEnemyUnit(target) &&
        unitDistanceCells(unit, target) <= getLightTankCombatStats(unit).range;

      if (targetInRange) {
        return true;
      }

      FE_PATCH_06BClearAttackTarget(unit);
      unit.attackMoveAggroTargetId = null;
    }

    const enemy = findAttackMoveEnemyInRange(unit);
    if (enemy) {
      unit.attackTargetId = enemy.id;
      unit.attackTargetKind = 'unit';
      unit.attackMoveAggroTargetId = enemy.id;
      unit.path = [];
      unit.state = 'attacking';
      unit._attackCommanded = true;
      return true;
    }

    if (
      Math.round(unit.x) === Math.round(unit.attackMoveTarget.x) &&
      Math.round(unit.y) === Math.round(unit.attackMoveTarget.y)
    ) {
      unit.state = 'idle';
      clearLightTankAttackMove(unit);
      return true;
    }

    if (!unit.path || !unit.path.length) {
      const path = findPath(unit, unit.attackMoveTarget, unit.id);
      if (path === null) {
        if (unit.state === 'attack_move') unit.state = 'idle';
        clearLightTankAttackMove(unit);
        return false;
      }

      unit.path = path;
      unit.state = 'attack_move';
    }

    updateUnitMovement(unit, dt);
    if (unit.attackMoveTarget && (!unit.path || !unit.path.length) && unit.state === 'idle') {
      unit.state = 'attack_move';
    }
    return true;
  }
  // FE_LT_04C3B_ATTACK_MOVE_THIN_LAYER_END

  // FE_LT_04C2_RETARGET_ON_KILL_START
  function findRetargetEnemyInRange(attacker, excludeId=null) {
    if (!isLightTank(attacker) || !game?.units?.length) return null;

    const stats = getLightTankCombatStats(attacker);

    const candidates = game.units
      .filter(u =>
        u &&
        u.id !== excludeId &&
        isLightTank(u) &&
        isEnemyUnit(u) &&
        unitDistanceCells(attacker, u) <= stats.range
      )
      .sort((a, b) => unitDistanceCells(attacker, a) - unitDistanceCells(attacker, b));

    return candidates[0] || null;
  }

  function tryRetargetAfterKill(attacker, killedTargetId=null) {
    if (!isLightTank(attacker) || !isPlayerUnit(attacker)) return false;

    const nextTarget = findRetargetEnemyInRange(attacker, killedTargetId);

    if (!nextTarget) {
      FE_PATCH_06BClearAttackTarget(attacker);
      return false;
    }

    attacker.attackTargetId = nextTarget.id;
    attacker.attackTargetKind = 'unit';
    attacker.attackCooldown = Math.min(attacker.attackCooldown || 0, 0.05);
    attacker._attackCommanded = true;
    attacker.state = 'attacking';
    attacker.path = [];
    attacker.manualTarget = null;
    attacker._queuedManualMove = null;
    attacker._dirTargetKey = null;
    attacker._dirDx = 0;
    attacker._dirDy = 0;

    addUnitClickMarker(attacker, Math.round(nextTarget.x), Math.round(nextTarget.y), 'ok');
    return true;
  }
  // FE_LT_04C2_RETARGET_ON_KILL_END

  function onCanvasClick(e) {
    if (dragSelect.suppressClick) {
      dragSelect.suppressClick = false;
      return;
    }

    if (!game || game.screen!=='game' || game.paused) return;
    const p=getCanvasPoint(e);
    const t=screenToTile(p.x,p.y);
    if (!inBounds(t.x,t.y)) { attackMoveArmed = false; hideMenus(); clearSelectionState(); return; }
    const obj=objectAtTile(t.x,t.y);

    if (selected?.kind==='unit' && obj && obj.id && obj.type && MINE_TYPES[obj.type] && selected.type==='harvester') {
      startHarvester(selected,obj);
      hideMenus();
      showToast('Сборщик отправлен к залежи');
      return;
    }

    if (isLightTank(selected) && isPlayerUnit(selected) && isLightTank(obj) && isEnemyUnit(obj)) {
      attackMoveArmed = false;
      const group = selectedPlayerLightTanks();
      if (group.length > 1) {
        setGroupLightTankAttackApproach(group, obj);
        return;
      }

      setLightTankAttackApproach(selected, obj);
      hideMenus();
      updateSelectedInfo();
      return;
    }

    if (obj?.kind==='unit') {
      attackMoveArmed = false;
      // FE_LT_04C2F_ENEMY_SELECTION_LOCK
      if (isEnemyUnit(obj)) {
        hideMenus();
        updateSelectedInfo();
        showToast('Это вражеский юнит');
        return;
      }

      if (e.detail >= 2 && isLightTank(obj) && isPlayerUnit(obj)) {
        setMultiSelection(FE_LT_04C4VisiblePlayerLightTanks());
        return;
      }

      setSingleSelection(obj);
      hideMenus();
      updateSelectedInfo();
      if (obj.type !== 'light_tank') {
        openUnitMenu(obj);
      }
      return;
    }
    if (obj?.kind==='building') {
      attackMoveArmed = false;
      if (isEnemyBuilding(obj)) {
        const group = selectedPlayerLightTanks();
        if (group.length > 1 && FE_PATCH_06BIsAttackableEnemyBuilding(obj)) {
          setGroupLightTankAttackApproach(group, obj);
          return;
        }
        if (isLightTank(selected) && isPlayerUnit(selected) && FE_PATCH_06BIsAttackableEnemyBuilding(obj)) {
          setLightTankAttackApproach(selected, obj);
          hideMenus();
          updateSelectedInfo();
          return;
        }
        hideMenus();
        updateSelectedInfo();
        showToast('Enemy building');
        return;
      }
      if (selected?.kind === 'unit' && selected.type === 'builder' && isUnfinishedConstruction(obj)) {
        resumeBuilderConstruction(selected, obj);
        return;
      }

      setSingleSelection(obj);
      hideMenus();
      updateSelectedInfo();
      if (obj.type === 'units_factory' && obj.complete) openFactoryMenu(obj);
      return;
    }

    // Manual move to free tile.
    if (selected?.kind==='unit') {
      const attackMoveUnits = selectedAttackMoveUnits();
      if (attackMoveArmed && attackMoveUnits.length > 0) {
        if (attackMoveUnits.length > 1) {
          setGroupLightTankAttackMove(attackMoveUnits, t.x, t.y);
        } else {
          const ok = setLightTankAttackMove(attackMoveUnits[0], t.x, t.y);
          showToast(ok ? 'Attack-move' : 'Танк не может выполнить attack-move');
        }

        attackMoveArmed = false;
        return;
      }

      if (attackMoveArmed && attackMoveUnits.length === 0) {
        attackMoveArmed = false;
      }

      attackMoveArmed = false;
      const group = selectedPlayerLightTanks();
      if (group.length > 1 && isLightTank(selected) && isPlayerUnit(selected)) {
        setGroupManualMove(group, t.x, t.y);
        return;
      }

      if (isLightTank(selected) && isPlayerUnit(selected)) {
        const cell = findNearestLightTankDestinationCell(t.x, t.y, selected.id);
        if (!cell) {
          addUnitClickMarker(selected, t.x, t.y, 'bad');
          showToast('Танк не может доехать');
          return;
        }

        setManualMove(selected, cell.x, cell.y);
        return;
      }

      setManualMove(selected,t.x,t.y);
      return;
    }

    attackMoveArmed = false;
    clearSelectionState();
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
    if (e.button===0) {
      beginDragSelect(e);
    }
    if (e.button===1) {
      e.preventDefault();
      mouse.middle=true; mouse.lastX=e.clientX; mouse.lastY=e.clientY;
    }
  });
  window.addEventListener('mouseup', e=>{
    if (e.button===0) endDragSelect(e);
    if (e.button===1) mouse.middle=false;
  });
  window.addEventListener('mousemove', e=>{
    updateDragSelect(e);

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



  // FE_PATCH_07C3_RESULT_ESC_TO_MAIN_MENU_START
  function FE_PATCH_07C3ElementVisible(el) {
    if (!el) return false;
    const style = window.getComputedStyle ? window.getComputedStyle(el) : null;
    if (style && (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0')) return false;
    return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  }

  function FE_PATCH_07C3HasResultOverlayVisible() {
    return FE_PATCH_07C3ElementVisible(document.getElementById('fe-game-result-overlay')) ||
      FE_PATCH_07C3ElementVisible(document.getElementById('fe-debug-result-overlay'));
  }

  function FE_PATCH_07C3HideResultOverlays() {
    const normal = document.getElementById('fe-game-result-overlay');
    if (normal) normal.style.display = 'none';
    const debug = document.getElementById('fe-debug-result-overlay');
    if (debug) debug.style.display = 'none';
  }

  function FE_PATCH_07C3ResultEscToMainMenu(event) {
    const resultActive = !!(game?.gameResult || game?.result || game?.gameEnded || FE_PATCH_07C3HasResultOverlayVisible());
    if (!resultActive) return false;

    if (event) {
      event.preventDefault();
      if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
      else if (typeof event.stopPropagation === 'function') event.stopPropagation();
    }

    attackMoveArmed = false;
    selected = null;
    selectedUnits = [];
    hideMenus();
    FE_PATCH_07C3HideResultOverlays();

    if (game) {
      game.screen = 'menu';
      game.paused = false;
      game.gameResult = null;
      game.result = null;
      game.gameEnded = false;
      game.ended = false;
    }

    hideScreens();
    showScreen(mainMenu);
    updateContinueButton();
    return true;
  }

  window.FE_PATCH_07C3ResultEscToMainMenu = FE_PATCH_07C3ResultEscToMainMenu;
  window.FE_PATCH_07C3HasResultOverlayVisible = FE_PATCH_07C3HasResultOverlayVisible;
  // FE_PATCH_07C3_RESULT_ESC_TO_MAIN_MENU_END


  // PATCH-09C1-DEBUG-ENEMY-ECONOMY-PANEL-MVP-V2_START
  // Dev-only read-only observer. Extracted to src/dev/enemy_economy_debug_panel.js (REF-MAIN-GLM-04).
  window.FE_ENEMY_ECONOMY_DEBUG_PANEL.init({
    unitOwner,
    buildingOwner,
    getStorageLimitsForOwner,
    findBaseBuilding,
    FE_PATCH_08BEnemyCombatUnits,
    FE_PATCH_10BEnemyKnowledgeDebugSummary,
    FE_PATCH_09C3EnemySeparatorDebugText,
    FE_PATCH_09DEnemyFactoryDebugText,
    FE_PATCH_09EEnemyFactoryQueueDebugText,
    FE_PATCH_09DEnemyBuildOrderDebugText,
    FE_PATCH_09EEnemyFactoryBlockedReasonDebugText,
  });
  // PATCH-09C1-DEBUG-ENEMY-ECONOMY-PANEL-MVP-V2_END

window.addEventListener('keydown', e=>{
    // PATCH-09C1-DEBUG-ENEMY-ECONOMY-PANEL-MVP-V2: read-only enemy economy debug panel.
    if (!e.repeat && e.code === 'F2' && game?.screen === 'game') {
      e.preventDefault();
      window.FE_ENEMY_ECONOMY_DEBUG_PANEL.toggle();
      return;
    }

  keys[e.key.toLowerCase()]=true;
  if (window.FE_DEV_HOTKEYS_ENABLED === true) {
    const getCalibratedUnit = () => {
      if (selected?.kind === 'unit' && (selected.type === 'builder' || selected.type === 'harvester' || selected.type === 'light_tank' || selected.type === 'scout')) {
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
      if (unit.type === 'scout') return window.FE_SCOUT_DIR_OFFSETS;
      return null;
    };

    const getForceDirForUnit = unit => {
      if (!unit) return null;
      if (unit.type === 'harvester') return window.FE_HARVESTER_FORCE_DIR;
      if (unit.type === 'light_tank') return window.FE_LIGHT_TANK_FORCE_DIR;
      if (unit.type === 'scout') return window.FE_SCOUT_FORCE_DIR;
      return window.FE_BUILDER_FORCE_DIR;
    };

    const setForceDirForUnit = (unit, value) => {
      if (!unit) return;
      if (unit.type === 'harvester') window.FE_HARVESTER_FORCE_DIR = value;
      else if (unit.type === 'light_tank') window.FE_LIGHT_TANK_FORCE_DIR = value;
      else if (unit.type === 'scout') window.FE_SCOUT_FORCE_DIR = value;
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

  if ((e.key === '9' || e.code === 'Numpad9') && game?.screen === 'game' && !game.paused) {
    e.preventDefault();
    keys['9'] = false;
    const enabled = window.FE_COMBAT_DEBUG_OVERLAY ? window.FE_COMBAT_DEBUG_OVERLAY.toggle() : false;
    showToast(enabled ? 'Combat debug: ON' : 'Combat debug: OFF');
    return;
  }

  if ((e.key === 'a' || e.key === 'A' || e.code === 'KeyA') && game?.screen === 'game' && !game.paused) {
    const units = selectedAttackMoveUnits();
    attackMoveArmed = units.length > 0;
    keys['a'] = false;
    e.preventDefault();
    if (units.length > 0) {
      hideMenus();
      showToast('Attack-move: РІС‹Р±РµСЂРё С‚РѕС‡РєСѓ');
      return;
    }

    showToast('Р’С‹Р±РµСЂРё light_tank РґР»СЏ attack-move');
    return;
  }

  if (e.key==='Escape') {
    // FE_PATCH_07C3_RESULT_ESC_TO_MAIN_MENU_START
    if (typeof FE_PATCH_07C3ResultEscToMainMenu === 'function' && FE_PATCH_07C3ResultEscToMainMenu(e)) return;
    // FE_PATCH_07C3_RESULT_ESC_TO_MAIN_MENU_END
    // FE_PATCH_07C2_RESULT_STATE_BLOCKS_PAUSE_START
    if (typeof window.FE_PATCH_07C2BlockResultEsc === 'function' && window.FE_PATCH_07C2BlockResultEsc(e)) return;
    if (game?.gameResult || game?.result || game?.gameEnded) {
      e.preventDefault();
      if (typeof FE_PATCH_06DShowDomOverlay === 'function' && game?.gameResult) {
        FE_PATCH_06DShowDomOverlay(game.gameResult, game.gameResultReason || 'escape_result_lock');
      }
      return;
    }
    // FE_PATCH_07C2_RESULT_STATE_BLOCKS_PAUSE_END
    // FE_PATCH_07C1_RESULT_OVERLAY_ESC_LOCK_START
    if (game?.gameResult) {
      e.preventDefault();
      if (typeof FE_PATCH_06DShowDomOverlay === 'function') {
        FE_PATCH_06DShowDomOverlay(game.gameResult, game.gameResultReason || 'escape_result_lock');
      }
      return;
    }
    // FE_PATCH_07C1_RESULT_OVERLAY_ESC_LOCK_END

    if (attackMoveArmed) {
      attackMoveArmed = false;
      e.preventDefault();
      showToast('Attack-move РѕС‚РјРµРЅС‘РЅ');
      return;
    }

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
        const base=findBaseBuilding('player');
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
    // FE_PATCH_07C1_RESULT_OVERLAY_ESC_LOCK_START
    if (game.gameResult) {
      if (typeof FE_PATCH_06DShowDomOverlay === 'function') {
        FE_PATCH_06DShowDomOverlay(game.gameResult, game.gameResultReason || 'pause_result_lock');
      }
      return;
    }
    // FE_PATCH_07C1_RESULT_OVERLAY_ESC_LOCK_END
    if (modalScreen.classList.contains('active')) { modalScreen.classList.remove('active'); return; }
    if (pauseMenu.classList.contains('active')) closePause();
    else openPause();
  }
  function openPause() {
    if (!game) return;
    // FE_PATCH_07C1_RESULT_OVERLAY_ESC_LOCK_START
    if (game.gameResult) return;
    // FE_PATCH_07C1_RESULT_OVERLAY_ESC_LOCK_END
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
      if (u.type==='light_tank') {
        const handledAttackApproach = updateLightTankAttackApproach(u,dt);
        if (!handledAttackApproach) {
          const handledAttackMove = updateLightTankAttackMove(u,dt);
          if (!handledAttackMove) {
            updateUnitMovement(u,dt);
          }
        }
        updateLightTankCombat(u,dt);
      }
      if (u.type==='scout') {
        updateUnitMovement(u,dt);
      }

      if (u.type === 'builder' || u.type === 'harvester' || u.type === 'light_tank' || u.type === 'scout') {
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

    updateEnemyBot(dt);
    updateTerritory(dt);
    updateFog();
    FE_PATCH_06DCheckVictoryDefeat('update_check');
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
  // Snapshot/export system extracted to src/dev/snapshot_export.js (REF-MAIN-GLM-05).
  // FE_DEV_SPAWN_UNIT remains here — it is a separate dev tool.
  window.FE_SNAPSHOT_EXPORT.init({
    inBounds,
    isObstacleBlocked,
    mineAt,
    buildingAt,
    unitAt,
    passable,
    canPlaceBuilding,
    adjacentFreeCellsForRect,
    findPath,
    getStorageLimits,
    getSelected: () => selected,
    BUILDING_SIZE,
  });

  // FE_DEV_SPAWN_UNIT: dev-only helper to spawn any known unit type from browser console.
  // Usage: FE_DEV_SPAWN_UNIT('scout', 10, 10)
  //        FE_DEV_SPAWN_UNIT('light_tank')  — spawns near player HQ
  window.FE_DEV_SPAWN_UNIT = function FE_DEV_SPAWN_UNIT(type, x, y) {
    if (!game || game.screen !== 'game') {
      console.warn('[FE_DEV_SPAWN_UNIT] Игра не запущена. Начните игру сначала.');
      return null;
    }
    if (!type || typeof type !== 'string') {
      console.warn('[FE_DEV_SPAWN_UNIT] Укажите тип юнита: FE_DEV_SPAWN_UNIT("scout", x, y)');
      return null;
    }
    const def = UNIT_DEFS[type];
    if (!def) {
      console.warn('[FE_DEV_SPAWN_UNIT] Неизвестный тип юнита: "' + type + '". Доступные: ' + Object.keys(UNIT_DEFS).join(', '));
      return null;
    }
    // If x/y not provided, spawn near player HQ
    if (typeof x !== 'number' || typeof y !== 'number') {
      const hq = (game.buildings || []).find(b => b.type === 'hq_base' && b.complete);
      if (hq) {
        x = hq.x + 2;
        y = hq.y + 2;
      } else {
        x = game.mapW / 2;
        y = game.mapH / 2;
      }
    }
    // Bounds check
    x = Math.max(0, Math.min(Math.round(x), game.mapW - 1));
    y = Math.max(0, Math.min(Math.round(y), game.mapH - 1));
    const unit = createUnit(type, x, y);
    game.units.push(unit);
    console.warn('[FE_DEV_SPAWN_UNIT] Создан юнит:', def.name, '#' + unit.id, 'на клетке', x + ',' + y);
    return unit;
  };
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

// FE_PATCH_INFRA_PLAYWRIGHT_VISUAL_SCENARIOS_START
(function installFePlaywrightVisualDebugHelpers() {
  if (typeof window === 'undefined') return;
  if (window.FE_DEBUG_FORCE_RESULT && window.FE_DEBUG_FORCE_VICTORY && window.FE_DEBUG_FORCE_DEFEAT) return;

  function getRootGame() {
    try {
      if (window.game && typeof window.game === 'object') return window.game;
      if (window.FE_GAME && typeof window.FE_GAME === 'object') return window.FE_GAME;
      if (window.__FE_GAME__ && typeof window.__FE_GAME__ === 'object') return window.__FE_GAME__;
    } catch (err) {}
    return null;
  }

  function applyGameResultState(result, reason) {
    const g = getRootGame();
    if (!g) return false;
    try {
      g.gameResult = result;
      g.result = result;
      g.gameEnded = true;
      g.ended = true;
      g.paused = true;
      g.resultReason = reason;
      g.reason = reason;
      g.gameResultReason = reason;
      g.gameResultTimestamp = Date.now();
      g.timestamp = g.timestamp || Date.now();
      return true;
    } catch (err) {
      return false;
    }
  }

  function ensureResultDomOverlay(result, reason) {
    const victory = result === 'victory';
    const id = 'fe-debug-result-overlay';
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement('div');
      el.id = id;
      el.setAttribute('data-fe-debug-result-overlay', '1');
      document.body.appendChild(el);
    }

    el.innerHTML = '' +
      '<div class="fe-debug-result-card">' +
        '<div class="fe-debug-result-title">' + (victory ? 'ПОБЕДА' : 'ПОРАЖЕНИЕ') + '</div>' +
        '<div class="fe-debug-result-subtitle">' + String(reason || (victory ? 'Вражеская база уничтожена' : 'Главная база уничтожена')) + '</div>' +
        '<div class="fe-debug-result-hint">Esc — главное меню</div>' +
      '</div>';

    Object.assign(el.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '2147483647',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0, 0, 0, 0.62)',
      pointerEvents: 'auto',
      fontFamily: 'Arial, sans-serif'
    });

    const card = el.querySelector('.fe-debug-result-card');
    if (card) Object.assign(card.style, {
      minWidth: '420px',
      maxWidth: '680px',
      padding: '36px 52px',
      borderRadius: '18px',
      border: victory ? '3px solid #65f08a' : '3px solid #ff6b6b',
      background: victory ? 'rgba(16, 64, 32, 0.90)' : 'rgba(70, 24, 24, 0.90)',
      boxShadow: victory ? '0 0 34px rgba(101, 240, 138, 0.35)' : '0 0 34px rgba(255, 90, 90, 0.35)',
      textAlign: 'center',
      color: '#f6ffe8'
    });

    const title = el.querySelector('.fe-debug-result-title');
    if (title) Object.assign(title.style, {
      fontSize: '48px',
      lineHeight: '1.05',
      fontWeight: '900',
      letterSpacing: '2px',
      marginBottom: '16px',
      color: victory ? '#b8ffc4' : '#ffd0d0'
    });

    const subtitle = el.querySelector('.fe-debug-result-subtitle');
    if (subtitle) Object.assign(subtitle.style, {
      fontSize: '22px',
      fontWeight: '700',
      marginBottom: '24px'
    });

    const hint = el.querySelector('.fe-debug-result-hint');
    if (hint) Object.assign(hint.style, {
      fontSize: '14px',
      opacity: '0.72'
    });

    return true;
  }

  window.FE_DEBUG_FORCE_RESULT = function FE_DEBUG_FORCE_RESULT(result, reason) {
    const normalized = result === 'defeat' ? 'defeat' : 'victory';
    const defaultReason = normalized === 'victory' ? 'Вражеская база уничтожена' : 'Главная база уничтожена';
    const finalReason = reason || defaultReason;
    const gameTouched = applyGameResultState(normalized, finalReason);
    ensureResultDomOverlay(normalized, finalReason);
    if (typeof window.FE_PATCH_07C2ClosePauseMenuDom === 'function') {
      window.FE_PATCH_07C2ClosePauseMenuDom();
    }
    return { ok: true, result: normalized, gameTouched };
  };

  window.FE_DEBUG_FORCE_VICTORY = function FE_DEBUG_FORCE_VICTORY(reason) {
    return window.FE_DEBUG_FORCE_RESULT('victory', reason || 'Вражеская база уничтожена');
  };

  window.FE_DEBUG_FORCE_DEFEAT = function FE_DEBUG_FORCE_DEFEAT(reason) {
    return window.FE_DEBUG_FORCE_RESULT('defeat', reason || 'Главная база уничтожена');
  };
})();
// FE_PATCH_INFRA_PLAYWRIGHT_VISUAL_SCENARIOS_END

// FE_PATCH_07C2_RESULT_STATE_BLOCKS_PAUSE_START
(function installFePatch07C2ResultStateEscGuard() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.FE_PATCH_07C2_RESULT_STATE_ESC_GUARD_INSTALLED) return;
  window.FE_PATCH_07C2_RESULT_STATE_ESC_GUARD_INSTALLED = true;

  function isVisible(el) {
    if (!el) return false;
    const style = window.getComputedStyle ? window.getComputedStyle(el) : null;
    if (style && (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0')) return false;
    return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  }

  function hasVisibleResultOverlay() {
    return isVisible(document.getElementById('fe-game-result-overlay')) ||
      isVisible(document.getElementById('fe-debug-result-overlay'));
  }

  function closePauseMenuDom() {
    const pause = document.getElementById('pauseMenu');
    if (pause && pause.classList) pause.classList.remove('active');
    const modal = document.getElementById('modalScreen');
    if (modal && modal.classList && hasVisibleResultOverlay()) modal.classList.remove('active');
    const body = document.body;
    if (body) body.setAttribute('data-fe-result-state', hasVisibleResultOverlay() ? 'active' : '');
  }

  window.FE_PATCH_07C2HasVisibleResultOverlay = hasVisibleResultOverlay;
  window.FE_PATCH_07C2ClosePauseMenuDom = closePauseMenuDom;
  window.FE_PATCH_07C2BlockResultEsc = function FE_PATCH_07C2BlockResultEsc(event) {
    if (typeof window.FE_PATCH_07C3ResultEscToMainMenu === 'function') {
      return window.FE_PATCH_07C3ResultEscToMainMenu(event);
    }
    return false;
  };

  window.addEventListener('keydown', function fePatch07C2CaptureEsc(event) {
    if (!event || event.key !== 'Escape') return;
    if (!hasVisibleResultOverlay()) return;
    window.FE_PATCH_07C2BlockResultEsc(event);
  }, true);
})();
// FE_PATCH_07C2_RESULT_STATE_BLOCKS_PAUSE_END

