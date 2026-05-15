// FEN-01: FE Next composition root.
// Thin wiring layer that initializes state, canvas, input,
// and starts the requestAnimationFrame loop.
//
// Target: < 500 lines. Hard stop at 700.
// Exposes window.FE_NEXT_DEBUG for test/debug access.

(function () {
  'use strict';

  // ---- Module references ----
  var C = window.FE_NEXT_CONSTANTS;
  var COORDS = window.FE_NEXT_COORDS;
  var STATE = window.FE_NEXT_STATE;
  var RENDERER = window.FE_NEXT_RENDERER;
  var INPUT = window.FE_NEXT_INPUT;
  var HUD = window.FE_NEXT_HUD;

  // ---- Canvas setup ----
  var canvas = document.getElementById('game');
  if (!canvas) {
    throw new Error('[FE Next] Canvas element #game not found');
  }
  var ctx = canvas.getContext('2d');

  /**
   * Resize canvas to fill the viewport at device pixel ratio.
   */
  function resizeCanvas() {
    var dpr = window.devicePixelRatio || 1;
    var w = window.innerWidth;
    var h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // ---- Game state ----
  var state = STATE.createInitialState();

  // ---- Input ----
  INPUT.initInput(canvas, state);

  // ---- Game loop ----
  var lastTime = 0;
  var running = true;

  /**
   * Per-frame update: process input, move units, update markers.
   * @param {number} dt - Delta time in seconds
   */
  function update(dt) {
    // Clamp delta to prevent spiral of death after tab switch
    if (dt > 0.25) dt = 0.25;

    // Camera panning from held keys
    INPUT.update(state, dt);

    // Unit movement
    STATE.updateMovement(state, dt);

    // Move markers (fade out)
    STATE.updateMoveMarkers(state, dt);

    // Advance game clock
    state.time += dt;
    state.tickCount++;
  }

  /**
   * Per-frame render: clear, draw terrain, draw entities, update HUD.
   */
  function render() {
    RENDERER.render(ctx, state);
    HUD.updateHUD(state);
  }

  /**
   * Main loop tick.
   * @param {DOMHighResTimeStamp} timestamp
   */
  function tick(timestamp) {
    if (!running) return;

    var dt = lastTime ? (timestamp - lastTime) / 1000 : 0;
    lastTime = timestamp;

    update(dt);
    render();

    requestAnimationFrame(tick);
  }

  // Start the loop
  requestAnimationFrame(tick);

  // ---- Debug / test access ----
  window.FE_NEXT_DEBUG = {
    getState: function () { return state; },
    getCanvas: function () { return canvas; },
    getContext: function () { return ctx; },
    isRunning: function () { return running; },
    pause: function () { running = false; },
    resume: function () {
      running = true;
      lastTime = 0;
      requestAnimationFrame(tick);
    }
  };

  // FE_NEXT_GAME: stable reference for tests that expect a game-like object
  window.FE_NEXT_GAME = {
    state: state,
    canvas: canvas,
    debug: window.FE_NEXT_DEBUG
  };

  console.info('[FE Next] FEN-01 scaffold initialized. State:', state);
})();
