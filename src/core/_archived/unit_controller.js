// ╔══════════════════════════════════════════════════════════════════════╗
// ║  WARNING — DEPRECATED MODULE — DO NOT ACTIVATE                     ║
// ║                                                                     ║
// ║  This module was an alternative unit movement controller that was   ║
// ║  never activated in production. FE_UNIT_CONTROLLER_ENABLED has      ║
// ║  always been false. The production movement code remains in         ║
// ║  main.js (Z14). This file is archived for design record only.       ║
// ║                                                                     ║
// ║  Archived: 2026-05-13 (ARCH-LAB-01)                                ║
// ║  Decision: ARCH-LAB-00B — archive, do not delete                   ║
// ║  Do NOT remove FE_UNIT_CONTROLLER_ENABLED flag — main.js reads it  ║
// ╚══════════════════════════════════════════════════════════════════════╝
// Four Elements v0.4.2 Unit Controller
// Отдельный контроллер движения и состояний юнитов.
// main.js передаёт сюда game + функции через api.
// Важно: только этот файл должен страховать движение по path.

(function () {
  function log(api, event, payload) {
    try {
      if (api && typeof api.debugLog === 'function') {
        api.debugLog(event, payload || {});
      } else {
        console.warn('[FE_UNIT_CONTROLLER]', event, payload || {});
      }
    } catch (e) {
      console.warn('[FE_UNIT_CONTROLLER]', event, payload || {});
    }
  }

  function grid(u) {
    return { x: Math.round(u.x), y: Math.round(u.y) };
  }

  function sameCell(a, b) {
    if (!a || !b) return false;
    return Math.round(a.x) === Math.round(b.x) && Math.round(a.y) === Math.round(b.y);
  }

  function manhattan(a, b) {
    if (!a || !b) return 9999;
    return Math.abs(Math.round(a.x) - Math.round(b.x)) + Math.abs(Math.round(a.y) - Math.round(b.y));
  }

  function passable(api, c, unitId) {
    if (!c) return false;

    try {
      if (typeof api.passable === 'function') {
        return api.passable(Math.round(c.x), Math.round(c.y), unitId);
      }
    } catch (e) {}

    return true;
  }

  function normalizePath(api, u) {
    if (!u || !Array.isArray(u.path)) return false;

    const g = grid(u);
    let changed = false;

    while (u.path.length && sameCell(g, u.path[0])) {
      u.path.shift();
      changed = true;
    }

    if (changed) {
      log(api, 'unit_path_current_cell_removed', {
        unitId: u.id,
        type: u.type,
        state: u.state,
        grid: g,
        pathLength: u.path.length
      });
    }

    return changed;
  }

  function ensureMemory(u) {
    if (!u._feUnitController) {
      u._feUnitController = {
        lastX: u.x,
        lastY: u.y,
        lastTarget: '',
        lastDist: null,
        noProgress: 0,
        repathCooldown: 0,
        failTimer: 0
      };
    }

    return u._feUnitController;
  }

  function clearMemory(u) {
    if (u) u._feUnitController = null;
  }

  function unitSpeed(api, u) {
    let speed = null;

    try {
      const def = api.UNIT_DEFS && api.UNIT_DEFS[u.type] ? api.UNIT_DEFS[u.type] : null;

      if (def) {
        if (Number(def.speed) > 0) speed = Number(def.speed);
        if (Number(def.moveSpeed) > 0) speed = Number(def.moveSpeed);
      }
    } catch (e) {}

    if (!speed) {
      if (u.type === 'builder') speed = 1.05;
      else if (u.type === 'harvester') speed = 0.95;
      else speed = 1.05;
    }

    // Защита, если в конфиге скорость в других единицах.
    if (speed > 3) speed = 1.05;

    return Math.max(0.35, Math.min(1.5, speed));
  }

  function setFacing(u, dx, dy) {
    if (!u) return;

    if (Math.abs(dx) >= Math.abs(dy)) {
      if (dx > 0) {
        u.facing = 'east';
        u.flip = false;
      } else if (dx < 0) {
        u.facing = 'west';
        u.flip = true;
      }
    } else {
      if (dy > 0) u.facing = 'south';
      else if (dy < 0) u.facing = 'north';
    }
  }

  function allowedMoveState(u) {
    return (
      u &&
      Array.isArray(u.path) &&
      (
        u.state === 'manual_move' ||
        u.state === 'moving_to_mine' ||
        u.state === 'returning' ||
        u.state === 'moving_to_build'
      )
    );
  }

  function pathTargetForStep(u, next) {
    if (!u || !next) return null;

    let tx = Number(next.x);
    let ty = Number(next.y);

    const gx = Math.round(u.x);
    const gy = Math.round(u.y);
    const nx = Math.round(next.x);
    const ny = Math.round(next.y);

    // Не режем диагональ. Двигаемся по одной оси.
    if (gx !== nx) {
      ty = u.y;
    } else if (gy !== ny) {
      tx = u.x;
    }

    return { x: tx, y: ty };
  }

  function finishPath(api, u) {
    if (!u) return;

    if (u.state === 'manual_move') {
      u.state = 'idle';
      u.path = [];
      clearMemory(u);
      return;
    }

    if (u.type === 'builder' && u.state === 'moving_to_build') {
      if (u.buildOrder) {
        startBuild(api, u, 'finish_path');
      } else {
        u.state = 'idle';
        u.path = [];
      }

      clearMemory(u);
      return;
    }

    if (u.type === 'harvester' && u.state === 'moving_to_mine') {
      if (adjacentToMine(api, u)) {
        u.state = 'harvesting';
        u.path = [];
        u.actionTimer = Math.max(u.actionTimer || 0, 0.55);
      } else {
        repathHarvester(api, u, 'finish_path_not_adjacent_to_mine');
      }

      clearMemory(u);
      return;
    }

    if (u.type === 'harvester' && u.state === 'returning') {
      if (adjacentToBase(api, u)) {
        u.state = 'unloading';
        u.path = [];
        u.actionTimer = Math.max(u.actionTimer || 0, 0.45);
      } else {
        repathHarvester(api, u, 'finish_path_not_adjacent_to_base');
      }

      clearMemory(u);
      return;
    }
  }

  function moveAlongPath(api, u, dt) {
    if (!allowedMoveState(u)) {
      clearMemory(u);
      return;
    }

    normalizePath(api, u);

    if (!u.path.length) {
      finishPath(api, u);
      return;
    }

    const next = u.path[0];

    if (!next) {
      finishPath(api, u);
      return;
    }

    if (!passable(api, next, u.id)) {
      if (u.state === 'manual_move') {
        u.state = 'idle';
        u.path = [];
        clearMemory(u);

        try {
          if (typeof api.showToast === 'function') api.showToast('Путь недоступен');
        } catch (e) {}

        return;
      }

      if (u.type === 'builder' && u.state === 'moving_to_build') {
        if (!repathBuilder(api, u, 'next_cell_blocked')) {
          cancelBuild(api, u, 'next_cell_blocked');
        }

        return;
      }

      if (u.type === 'harvester') {
        repathHarvester(api, u, 'next_cell_blocked');
        return;
      }
    }

    const target = pathTargetForStep(u, next);
    if (!target) return;

    const dx = target.x - u.x;
    const dy = target.y - u.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const mem = ensureMemory(u);
    const targetKey = `${Math.round(next.x)},${Math.round(next.y)}`;

    if (mem.lastTarget !== targetKey) {
      mem.lastTarget = targetKey;
      mem.lastDist = dist;
      mem.noProgress = 0;
      mem.failTimer = 0;
    } else {
      if (mem.lastDist === null || dist < mem.lastDist - 0.001) {
        mem.noProgress = 0;
        mem.lastDist = dist;
      } else {
        mem.noProgress += dt;
        mem.failTimer += dt;
      }
    }

    if (dist <= 0.035) {
      u.x = target.x;
      u.y = target.y;

      const nodeDist = Math.abs(u.x - next.x) + Math.abs(u.y - next.y);

      if (nodeDist <= 0.08) {
        u.x = next.x;
        u.y = next.y;
        u.path.shift();
        clearMemory(u);

        if (!u.path.length) {
          finishPath(api, u);
        }
      }

      return;
    }

    // Если штатная логика main.js двигает юнита - не мешаем.
    // Если не двигает, через короткое время берём управление.
    if (mem.noProgress < 0.18) {
      return;
    }

    const speed = unitSpeed(api, u);
    const maxStep = Math.max(0.003, Math.min(0.04, speed * dt));

    setFacing(u, dx, dy);

    u.x += (dx / dist) * maxStep;
    u.y += (dy / dist) * maxStep;

    mem.lastX = u.x;
    mem.lastY = u.y;
    mem.lastDist = Math.max(0, dist - maxStep);
    mem.noProgress = 0;

    log(api, 'unit_controller_moved', {
      unitId: u.id,
      type: u.type,
      state: u.state,
      x: u.x,
      y: u.y,
      next,
      pathLength: u.path.length
    });

    if (mem.failTimer > 8) {
      if (u.state === 'manual_move') {
        u.state = 'idle';
        u.path = [];
        clearMemory(u);
      }

      if (u.type === 'builder' && u.state === 'moving_to_build') {
        cancelBuild(api, u, 'move_fail_timer');
      }

      if (u.type === 'harvester') {
        repathHarvester(api, u, 'move_fail_timer');
      }
    }
  }

  // ============================================================
  // Builder
  // ============================================================

  function buildSize(api, type) {
    if (api.BUILDING_SIZE && api.BUILDING_SIZE[type]) return api.BUILDING_SIZE[type];
    return [2, 2];
  }

  function addResource(api, key, value) {
    if (!key || !Number(value)) return;

    try {
      if (typeof api.addResource === 'function') {
        api.addResource(key, Number(value));
        return;
      }
    } catch (e) {}

    if (api.game && api.game.resources && Object.prototype.hasOwnProperty.call(api.game.resources, key)) {
      api.game.resources[key] += Number(value);
    }
  }

  function refundBuild(api, builder, reason) {
    if (!builder || builder._buildRefunded || builder.buildRefunded) return;

    const reserved = builder.reservedBuildCost || builder._reservedBuildCost;
    const order = builder.buildOrder;

    if (reserved && reserved.cost && typeof reserved.cost === 'object') {
      for (const [key, value] of Object.entries(reserved.cost)) {
        addResource(api, key, Number(value));
      }
    } else if (order && api.BUILDINGS && api.BUILDINGS[order.type]) {
      const def = api.BUILDINGS[order.type];

      if (typeof def.cost === 'number') {
        addResource(api, 'energy', Number(def.cost));
      } else if (def.cost && typeof def.cost === 'object') {
        for (const [key, value] of Object.entries(def.cost)) {
          addResource(api, key, Number(value));
        }
      }
    }

    builder._buildRefunded = true;
    builder.buildRefunded = true;

    log(api, 'build_refunded', {
      reason,
      builderId: builder.id,
      order
    });
  }

  function cancelBuild(api, builder, reason) {
    if (!builder) return;

    refundBuild(api, builder, reason);

    builder.state = 'idle';
    builder.path = [];
    builder.buildOrder = null;
    builder.currentBuilding = null;
    builder.reservedBuildCost = null;
    builder._reservedBuildCost = null;
    clearMemory(builder);

    try {
      if (typeof api.showToast === 'function') {
        api.showToast('Стройка отменена: путь недоступен, ресурсы возвращены');
      }
    } catch (e) {}

    log(api, 'build_cancelled', {
      reason,
      builderId: builder.id,
      grid: grid(builder)
    });
  }

  function buildAccessCells(api, builder) {
    const order = builder && builder.buildOrder;
    if (!order || !order.spot) return [];

    const cells = [];

    if (order.accessCell) {
      cells.push(order.accessCell);
    }

    const [bw, bh] = buildSize(api, order.type);

    try {
      if (typeof api.adjacentFreeCellsForRect === 'function') {
        const extra = api.adjacentFreeCellsForRect(
          order.spot.x,
          order.spot.y,
          bw,
          bh,
          builder.id
        ) || [];

        for (const c of extra) {
          if (!cells.some(v => v.x === c.x && v.y === c.y)) {
            cells.push(c);
          }
        }
      }
    } catch (e) {}

    cells.sort((a, b) => manhattan(builder, a) - manhattan(builder, b));

    return cells;
  }

  function startBuild(api, builder, reason) {
    const order = builder && builder.buildOrder;

    if (!builder || !order || !order.spot || !order.type) {
      cancelBuild(api, builder, 'bad_build_order');
      return false;
    }

    let building = null;

    try {
      building = api.game.buildings.find(b =>
        b.type === order.type &&
        b.x === order.spot.x &&
        b.y === order.spot.y &&
        !b.complete
      );
    } catch (e) {}

    if (!building) {
      const [bw, bh] = buildSize(api, order.type);

      try {
        if (typeof api.canPlaceBuilding === 'function') {
          const canPlace = api.canPlaceBuilding(order.spot.x, order.spot.y, bw, bh);

          // Если canPlace false, но там уже есть именно наша стройка - это ок.
          if (!canPlace) {
            const existing = api.game.buildings.find(b =>
              b.type === order.type &&
              b.x === order.spot.x &&
              b.y === order.spot.y
            );

            if (existing) {
              building = existing;
            } else {
              cancelBuild(api, builder, 'build_spot_not_placeable');
              return false;
            }
          }
        }
      } catch (e) {}

      if (!building) {
        try {
          if (typeof api.createBuilding === 'function') {
            building = api.createBuilding(order.type, order.spot.x, order.spot.y, false);

            if (building && !api.game.buildings.includes(building)) {
              api.game.buildings.push(building);
            }
          }
        } catch (e) {
          cancelBuild(api, builder, 'create_building_failed');
          return false;
        }
      }
    }

    if (!building || !building.id) {
      cancelBuild(api, builder, 'building_empty');
      return false;
    }

    builder.currentBuilding = building.id;
    builder.state = 'building';
    builder.path = [];
    clearMemory(builder);

    try {
      if (typeof api.showToast === 'function') {
        const name = api.BUILDINGS && api.BUILDINGS[order.type] ? api.BUILDINGS[order.type].name : order.type;
        api.showToast('Строительство: ' + name);
      }
    } catch (e) {}

    log(api, 'build_started', {
      reason,
      builderId: builder.id,
      buildingId: building.id,
      order
    });

    return true;
  }

  function repathBuilder(api, builder, reason) {
    if (!builder || !builder.buildOrder) return false;

    const cells = buildAccessCells(api, builder);

    for (const c of cells) {
      if (sameCell(grid(builder), c)) {
        return startBuild(api, builder, 'already_on_access_cell');
      }

      let path = null;

      try {
        if (typeof api.findPath === 'function') {
          path = api.findPath(builder, c, builder.id);
        }
      } catch (e) {
        path = null;
      }

      if (path !== null && path.length) {
        builder.path = path;
        normalizePath(api, builder);

        log(api, 'builder_repath_success', {
          reason,
          builderId: builder.id,
          target: c,
          pathLength: builder.path.length
        });

        return true;
      }
    }

    return false;
  }

  function updateBuilder(api, builder, dt) {
    if (!builder || builder.type !== 'builder') return;

    if (builder.state === 'building') {
      if (builder.currentBuilding) return;

      if (builder.buildOrder) {
        startBuild(api, builder, 'building_without_current_building');
      } else {
        builder.state = 'idle';
      }

      return;
    }

    if (builder.state !== 'moving_to_build') return;

    const mem = ensureMemory(builder);
    mem.failTimer += dt;

    if (!builder.buildOrder) {
      builder.state = 'idle';
      builder.path = [];
      clearMemory(builder);
      return;
    }

    const cells = buildAccessCells(api, builder);

    if (cells.some(c => sameCell(grid(builder), c))) {
      startBuild(api, builder, 'reached_access_cell');
      return;
    }

    if ((!builder.path || !builder.path.length) && mem.failTimer > 0.75) {
      const ok = repathBuilder(api, builder, 'empty_path');

      if (!ok && mem.failTimer > 3.0) {
        cancelBuild(api, builder, 'cannot_repath_to_build');
      }
    }
  }

  // ============================================================
  // Harvester
  // ============================================================

  function targetMine(api, h) {
    if (!h || !h.target) return null;
    return api.game.minerals.find(m => m.id === h.target) || null;
  }

  function validMine(m) {
    return !!m && (m.infinite || Number(m.remaining) > 0);
  }

  function adjacentToMine(api, h) {
    const mine = targetMine(api, h);
    if (!mine) return false;

    const g = grid(h);
    return Math.abs(g.x - mine.x) + Math.abs(g.y - mine.y) <= 1;
  }

  function adjacentToBase(api, h) {
    const base = api.game.buildings.find(b => b.type === 'hq_base' && b.complete);
    if (!h || !base) return false;

    const g = grid(h);

    const around =
      g.x >= base.x - 1 &&
      g.x <= base.x + base.w &&
      g.y >= base.y - 1 &&
      g.y <= base.y + base.h;

    const inside =
      g.x >= base.x &&
      g.x < base.x + base.w &&
      g.y >= base.y &&
      g.y < base.y + base.h;

    return around && !inside;
  }

  function repathHarvester(api, h, reason) {
    if (!h || h.type !== 'harvester') return false;

    if (h.state === 'moving_to_mine') {
      let mine = targetMine(api, h);

      if (!validMine(mine)) {
        h.target = null;

        try {
          if (typeof api.assignNextMine === 'function') {
            api.assignNextMine(h);
            return true;
          }
        } catch (e) {}

        h.state = 'idle';
        h.path = [];
        return false;
      }

      if (adjacentToMine(api, h)) {
        h.state = 'harvesting';
        h.path = [];
        h.actionTimer = Math.max(h.actionTimer || 0, 0.55);
        return true;
      }

      let cells = [];

      try {
        if (typeof api.adjacentFreeCells === 'function') {
          cells = api.adjacentFreeCells(mine, h.id) || [];
        }
      } catch (e) {
        cells = [];
      }

      cells.sort((a, b) => manhattan(h, a) - manhattan(h, b));

      for (const c of cells) {
        let path = null;

        try {
          if (typeof api.findPath === 'function') {
            path = api.findPath(h, c, h.id);
          }
        } catch (e) {
          path = null;
        }

        if (path !== null && path.length) {
          h.path = path;
          h.state = 'moving_to_mine';
          normalizePath(api, h);

          log(api, 'harvester_repath_to_mine', {
            reason,
            harvesterId: h.id,
            mineId: mine.id,
            target: c,
            pathLength: h.path.length
          });

          return true;
        }
      }

      h.target = null;

      try {
        if (typeof api.assignNextMine === 'function') {
          api.assignNextMine(h);
          return true;
        }
      } catch (e) {}

      h.state = 'idle';
      h.path = [];
      return false;
    }

    if (h.state === 'returning') {
      const base = api.game.buildings.find(b => b.type === 'hq_base' && b.complete);

      if (!base) {
        h.state = 'idle';
        h.path = [];
        return false;
      }

      if (adjacentToBase(api, h)) {
        h.state = 'unloading';
        h.path = [];
        h.actionTimer = Math.max(h.actionTimer || 0, 0.45);
        return true;
      }

      let cells = [];

      try {
        if (typeof api.adjacentFreeCellsForRect === 'function') {
          cells = api.adjacentFreeCellsForRect(base.x, base.y, base.w, base.h, h.id) || [];
        }
      } catch (e) {
        cells = [];
      }

      cells.sort((a, b) => manhattan(h, a) - manhattan(h, b));

      for (const c of cells) {
        let path = null;

        try {
          if (typeof api.findPath === 'function') {
            path = api.findPath(h, c, h.id);
          }
        } catch (e) {
          path = null;
        }

        if (path !== null && path.length) {
          h.path = path;
          h.state = 'returning';
          normalizePath(api, h);

          log(api, 'harvester_repath_to_base', {
            reason,
            harvesterId: h.id,
            target: c,
            pathLength: h.path.length
          });

          return true;
        }
      }

      h.state = 'idle';
      h.path = [];
      return false;
    }

    return false;
  }

  function updateHarvester(api, h, dt) {
    if (!h || h.type !== 'harvester') return;

    if (h.state === 'moving_to_mine') {
      if (adjacentToMine(api, h)) {
        h.state = 'harvesting';
        h.path = [];
        h.actionTimer = Math.max(h.actionTimer || 0, 0.55);
        return;
      }

      if (!h.path || !h.path.length) {
        repathHarvester(api, h, 'empty_path_to_mine');
      }

      return;
    }

    if (h.state === 'returning') {
      if (adjacentToBase(api, h)) {
        h.state = 'unloading';
        h.path = [];
        h.actionTimer = Math.max(h.actionTimer || 0, 0.45);
        return;
      }

      if (!h.path || !h.path.length) {
        repathHarvester(api, h, 'empty_path_to_base');
      }
    }
  }

  function update(api) {
    if (!api || !api.game || !Array.isArray(api.game.units)) return;

    const dt = Number(api.dt) || 0.016;

    for (const u of api.game.units) {
      if (u.type === 'builder') {
        updateBuilder(api, u, dt);
      }

      if (u.type === 'harvester') {
        updateHarvester(api, u, dt);
      }

      moveAlongPath(api, u, dt);
    }
  }

  window.FE_UNIT_CONTROLLER = {
    update
  };

  console.warn('[Four Elements] unit_controller.js loaded');
})();
