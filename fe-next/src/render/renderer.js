// FEN-01: Geometric isometric renderer.
// Renders the isometric map, buildings, units, and markers using
// Canvas 2D geometric shapes. No sprite dependency.
// Exposed as window.FE_NEXT_RENDERER.

(function () {
  'use strict';

  var C = window.FE_NEXT_CONSTANTS;
  var COORDS = window.FE_NEXT_COORDS;

  /**
   * Draw a single isometric diamond tile.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} cx - Canvas X of tile center
   * @param {number} cy - Canvas Y of tile center
   * @param {number} hw - Half-width in canvas pixels
   * @param {number} hh - Half-height in canvas pixels
   * @param {string} fillColor
   * @param {string} strokeColor
   */
  function drawDiamond(ctx, cx, cy, hw, hh, fillColor, strokeColor) {
    ctx.beginPath();
    ctx.moveTo(cx, cy - hh);     // top
    ctx.lineTo(cx + hw, cy);     // right
    ctx.lineTo(cx, cy + hh);     // bottom
    ctx.lineTo(cx - hw, cy);     // left
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();
    if (strokeColor) {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  /**
   * Render the full terrain grid.
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} state
   * @param {number} canvasW
   * @param {number} canvasH
   */
  function renderTerrain(ctx, state, canvasW, canvasH) {
    var camera = state.camera;
    var hw = C.TILE_W / 2 * camera.zoom;
    var hh = C.TILE_H / 2 * camera.zoom;
    var colors = C.TERRAIN_COLORS;

    for (var ty = 0; ty < state.mapH; ty++) {
      for (var tx = 0; tx < state.mapW; tx++) {
        var scr = COORDS.tileToScreen(tx + 0.5, ty + 0.5);
        var canvas = COORDS.worldToCanvas(scr.x, scr.y, camera, canvasW, canvasH);

        // Cull tiles outside the viewport (with margin)
        if (canvas.x < -hw - 10 || canvas.x > canvasW + hw + 10) continue;
        if (canvas.y < -hh - 10 || canvas.y > canvasH + hh + 10) continue;

        var terrainType = state.terrain[ty][tx];
        var color = colors[terrainType] || colors.grass;

        drawDiamond(ctx, canvas.x, canvas.y, hw, hh, color, C.GRID_COLOR);
      }
    }
  }

  /**
   * Render a building (HQ as a raised isometric box).
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} building
   * @param {object} camera
   * @param {number} canvasW
   * @param {number} canvasH
   */
  function renderBuilding(ctx, building, camera, canvasW, canvasH) {
    var s = building.size || 1;
    // Center of the building (s x s tiles)
    var centerScr = COORDS.tileToScreen(building.tx + s / 2, building.ty + s / 2);
    var canvasPos = COORDS.worldToCanvas(centerScr.x, centerScr.y, camera, canvasW, canvasH);
    var z = camera.zoom;

    // Draw base (same as terrain diamond but larger)
    var hw = C.TILE_W / 2 * s * z;
    var hh = C.TILE_H / 2 * s * z;

    // Building "height" in pixels
    var bHeight = 18 * z;

    // Draw sides (isometric box)
    // Right face
    ctx.beginPath();
    ctx.moveTo(canvasPos.x + hw, canvasPos.y);
    ctx.lineTo(canvasPos.x, canvasPos.y + hh);
    ctx.lineTo(canvasPos.x, canvasPos.y + hh - bHeight);
    ctx.lineTo(canvasPos.x + hw, canvasPos.y - bHeight);
    ctx.closePath();
    ctx.fillStyle = '#a07830';
    ctx.fill();
    ctx.strokeStyle = '#6b4e1a';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Left face
    ctx.beginPath();
    ctx.moveTo(canvasPos.x - hw, canvasPos.y);
    ctx.lineTo(canvasPos.x, canvasPos.y + hh);
    ctx.lineTo(canvasPos.x, canvasPos.y + hh - bHeight);
    ctx.lineTo(canvasPos.x - hw, canvasPos.y - bHeight);
    ctx.closePath();
    ctx.fillStyle = '#8b6820';
    ctx.fill();
    ctx.strokeStyle = '#5a4015';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Top face
    drawDiamond(ctx, canvasPos.x, canvasPos.y - bHeight, hw, hh, C.HQ_COLOR, C.HQ_OUTLINE);

    // Label
    ctx.fillStyle = '#3a2400';
    ctx.font = (10 * z) + 'px "Trebuchet MS", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('HQ', canvasPos.x, canvasPos.y - bHeight);
  }

  /**
   * Render a unit as a colored circle with an optional selection ring.
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} unit
   * @param {object} state
   * @param {number} canvasW
   * @param {number} canvasH
   */
  function renderUnit(ctx, unit, state, canvasW, canvasH) {
    var camera = state.camera;
    var scr = COORDS.tileToScreen(unit.tx + 0.5, unit.ty + 0.5);
    var canvasPos = COORDS.worldToCanvas(scr.x, scr.y, camera, canvasW, canvasH);
    var z = camera.zoom;
    var r = C.UNIT_RADIUS * C.TILE_W / 2 * z;

    // Selection ring
    if (unit.id === state.selectedUnitId) {
      ctx.beginPath();
      ctx.arc(canvasPos.x, canvasPos.y, r + 4 * z, 0, Math.PI * 2);
      ctx.strokeStyle = C.UNIT_SELECTED;
      ctx.lineWidth = 2 * z;
      ctx.stroke();
    }

    // Unit body
    ctx.beginPath();
    ctx.arc(canvasPos.x, canvasPos.y, r, 0, Math.PI * 2);
    ctx.fillStyle = C.UNIT_COLOR;
    ctx.fill();
    ctx.strokeStyle = C.UNIT_OUTLINE;
    ctx.lineWidth = 1.5 * z;
    ctx.stroke();

    // Unit direction indicator (small triangle pointing in move direction)
    if (unit.moving && unit.moveTarget) {
      var dx = unit.moveTarget.tx - unit.tx;
      var dy = unit.moveTarget.ty - unit.ty;
      var angle = Math.atan2(dy, dx);
      var triSize = r * 0.7;
      ctx.beginPath();
      ctx.moveTo(
        canvasPos.x + Math.cos(angle) * (r + triSize),
        canvasPos.y + Math.sin(angle) * (r + triSize)
      );
      ctx.lineTo(
        canvasPos.x + Math.cos(angle + 2.5) * r * 0.5,
        canvasPos.y + Math.sin(angle + 2.5) * r * 0.5
      );
      ctx.lineTo(
        canvasPos.x + Math.cos(angle - 2.5) * r * 0.5,
        canvasPos.y + Math.sin(angle - 2.5) * r * 0.5
      );
      ctx.closePath();
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }

    // Health bar (if damaged)
    if (unit.hp < unit.maxHp) {
      var barW = 24 * z;
      var barH = 3 * z;
      var barX = canvasPos.x - barW / 2;
      var barY = canvasPos.y - r - 8 * z;
      var hpRatio = unit.hp / unit.maxHp;

      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(barX, barY, barW, barH);

      var barColor = hpRatio > 0.5 ? '#5de06b' : hpRatio > 0.25 ? '#f2d75c' : '#e05243';
      ctx.fillStyle = barColor;
      ctx.fillRect(barX, barY, barW * hpRatio, barH);
    }
  }

  /**
   * Render move command markers (fading circles at right-click target).
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} state
   * @param {number} canvasW
   * @param {number} canvasH
   */
  function renderMoveMarkers(ctx, state, canvasW, canvasH) {
    var camera = state.camera;
    var z = camera.zoom;

    for (var i = 0; i < state.moveMarkers.length; i++) {
      var m = state.moveMarkers[i];
      var scr = COORDS.tileToScreen(m.tx + 0.5, m.ty + 0.5);
      var canvasPos = COORDS.worldToCanvas(scr.x, scr.y, camera, canvasW, canvasH);
      var alpha = Math.max(0, m.life / 0.8);
      var radius = (8 + (1 - alpha) * 12) * z;

      ctx.beginPath();
      ctx.arc(canvasPos.x, canvasPos.y, radius, 0, Math.PI * 2);
      ctx.strokeStyle = C.MOVE_MARKER_COLOR;
      ctx.globalAlpha = alpha * 0.7;
      ctx.lineWidth = 2 * z;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  /**
   * Sort entities for correct isometric draw order (painter's algorithm).
   * Entities with higher (tx + ty) are drawn later (on top).
   * @param {object} state
   * @returns {Array} Sorted list of {type, entity}
   */
  function sortEntities(state) {
    var entities = [];

    for (var i = 0; i < state.buildings.length; i++) {
      var b = state.buildings[i];
      entities.push({ type: 'building', entity: b, sortKey: (b.tx + b.ty) * 10 });
    }

    for (var j = 0; j < state.units.length; j++) {
      var u = state.units[j];
      entities.push({ type: 'unit', entity: u, sortKey: (u.tx + u.ty) * 10 + 1 });
    }

    entities.sort(function (a, b) { return a.sortKey - b.sortKey; });
    return entities;
  }

  /**
   * Main render function.
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} state
   */
  function render(ctx, state) {
    var canvasW = ctx.canvas.width;
    var canvasH = ctx.canvas.height;

    // Clear
    ctx.clearRect(0, 0, canvasW, canvasH);
    ctx.fillStyle = '#171008';
    ctx.fillRect(0, 0, canvasW, canvasH);

    // Terrain
    renderTerrain(ctx, state, canvasW, canvasH);

    // Move markers (below entities)
    renderMoveMarkers(ctx, state, canvasW, canvasH);

    // Entities (sorted for isometric depth)
    var sorted = sortEntities(state);
    for (var i = 0; i < sorted.length; i++) {
      if (sorted[i].type === 'building') {
        renderBuilding(ctx, sorted[i].entity, state.camera, canvasW, canvasH);
      } else if (sorted[i].type === 'unit') {
        renderUnit(ctx, sorted[i].entity, state, canvasW, canvasH);
      }
    }
  }

  window.FE_NEXT_RENDERER = {
    render: render
  };
})();
