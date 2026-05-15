// FEN-01: Input handler — camera pan/zoom + unit selection/move.
// Wires DOM events to state mutations.
// Exposed as window.FE_NEXT_INPUT.

(function () {
  'use strict';

  var C = window.FE_NEXT_CONSTANTS;
  var COORDS = window.FE_NEXT_COORDS;
  var STATE = window.FE_NEXT_STATE;

  /**
   * Initialize input handlers on the given canvas.
   * Mutates the state object directly for camera and selection.
   *
   * @param {HTMLCanvasElement} canvas
   * @param {object} state - Game state (will be mutated)
   * @returns {{update: Function}} Input update function for per-frame key-based panning
   */
  function initInput(canvas, state) {
    // ---- Keyboard ----
    function onKeyDown(e) {
      state.keys[e.code] = true;
      // Prevent default for game keys
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(e.code) !== -1) {
        e.preventDefault();
      }
    }
    function onKeyUp(e) {
      state.keys[e.code] = false;
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // ---- Mouse ----
    function getCanvasCoords(e) {
      var rect = canvas.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left) * (canvas.width / rect.width),
        y: (e.clientY - rect.top) * (canvas.height / rect.height)
      };
    }

    function onMouseDown(e) {
      var pos = getCanvasCoords(e);

      if (e.button === 0) {
        // Left click — select unit
        state.mouseDown = true;
        handleLeftClick(state, pos);
      } else if (e.button === 1) {
        // Middle click — start camera pan
        e.preventDefault();
        state.middleMouseDown = true;
        state.panStartX = pos.x;
        state.panStartY = pos.y;
        state.camPanStartX = state.camera.x;
        state.camPanStartY = state.camera.y;
      } else if (e.button === 2) {
        // Right click — move selected unit
        e.preventDefault();
        handleRightClick(state, pos);
      }
    }

    function onMouseMove(e) {
      var pos = getCanvasCoords(e);
      state.lastMouseX = pos.x;
      state.lastMouseY = pos.y;

      if (state.middleMouseDown) {
        // Camera pan with middle mouse
        var dx = (pos.x - state.panStartX) / state.camera.zoom;
        var dy = (pos.y - state.panStartY) / state.camera.zoom;
        state.camera.x = state.camPanStartX - dx;
        state.camera.y = state.camPanStartY - dy;
      }
    }

    function onMouseUp(e) {
      if (e.button === 0) {
        state.mouseDown = false;
      } else if (e.button === 1) {
        state.middleMouseDown = false;
      }
    }

    function onWheel(e) {
      e.preventDefault();
      var delta = e.deltaY > 0 ? -C.CAMERA_ZOOM_STEP : C.CAMERA_ZOOM_STEP;
      state.camera.zoom = COORDS.clamp(
        state.camera.zoom + delta,
        C.CAMERA_MIN_ZOOM,
        C.CAMERA_MAX_ZOOM
      );
    }

    function onContextMenu(e) {
      e.preventDefault();
    }

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('contextmenu', onContextMenu);

    // ---- Touch (basic support) ----
    var touchId = null;
    function onTouchStart(e) {
      if (e.touches.length === 1 && touchId === null) {
        var t = e.touches[0];
        touchId = t.identifier;
        var rect = canvas.getBoundingClientRect();
        var pos = {
          x: (t.clientX - rect.left) * (canvas.width / rect.width),
          y: (t.clientY - rect.top) * (canvas.height / rect.height)
        };
        handleLeftClick(state, pos);
      }
    }
    function onTouchEnd() {
      touchId = null;
    }
    canvas.addEventListener('touchstart', onTouchStart, { passive: true });
    canvas.addEventListener('touchend', onTouchEnd);
  }

  /**
   * Handle left-click: select a unit at click position.
   * @param {object} state
   * @param {{x: number, y: number}} canvasPos
   */
  function handleLeftClick(state, canvasPos) {
    var canvasW = document.getElementById('game').width;
    var canvasH = document.getElementById('game').height;

    // Convert canvas coords to tile coords
    var tile = COORDS.canvasToTile(canvasPos.x, canvasPos.y, state.camera, canvasW, canvasH);

    // Find unit near this tile
    var unit = STATE.findUnitAtTile(state, tile.x - 0.5, tile.y - 0.5);

    if (unit) {
      // Deselect previous
      if (state.selectedUnitId && state.selectedUnitId !== unit.id) {
        var prev = STATE.findUnit(state, state.selectedUnitId);
        if (prev) prev.selected = false;
      }
      // Select new
      unit.selected = true;
      state.selectedUnitId = unit.id;
    } else {
      // Click on empty ground — deselect
      if (state.selectedUnitId) {
        var sel = STATE.findUnit(state, state.selectedUnitId);
        if (sel) sel.selected = false;
        state.selectedUnitId = null;
      }
    }
  }

  /**
   * Handle right-click: move selected unit to click position.
   * @param {object} state
   * @param {{x: number, y: number}} canvasPos
   */
  function handleRightClick(state, canvasPos) {
    if (!state.selectedUnitId) return;

    var canvasW = document.getElementById('game').width;
    var canvasH = document.getElementById('game').height;

    var tile = COORDS.canvasToTile(canvasPos.x, canvasPos.y, state.camera, canvasW, canvasH);
    var tx = Math.floor(tile.x - 0.5);
    var ty = Math.floor(tile.y - 0.5);

    // Bounds check
    if (tx < 0 || ty < 0 || tx >= state.mapW || ty >= state.mapH) return;

    STATE.issueMoveCommand(state, state.selectedUnitId, tx, ty);
  }

  /**
   * Per-frame update for continuous key-based camera panning.
   * Call this from the game loop with delta time.
   *
   * @param {object} state
   * @param {number} dt - Seconds since last frame
   */
  function update(state, dt) {
    var speed = C.CAMERA_PAN_SPEED * dt / state.camera.zoom;

    if (state.keys['KeyW'] || state.keys['ArrowUp']) {
      state.camera.y -= speed;
    }
    if (state.keys['KeyS'] || state.keys['ArrowDown']) {
      state.camera.y += speed;
    }
    if (state.keys['KeyA'] || state.keys['ArrowLeft']) {
      state.camera.x -= speed;
    }
    if (state.keys['KeyD'] || state.keys['ArrowRight']) {
      state.camera.x += speed;
    }
  }

  window.FE_NEXT_INPUT = {
    initInput: initInput,
    update: update
  };
})();
