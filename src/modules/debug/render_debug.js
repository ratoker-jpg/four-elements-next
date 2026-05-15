(function () {
  'use strict';

  const state = {
    footprints: false,
    anchors: false,
    bounds: false
  };

  function core() {
    return window.FE_CORE || null;
  }

  function isReadyImage(im) {
    return !!(im && im.complete && im.naturalWidth && im.naturalHeight);
  }

  function calcSpriteSize(profile, im, opts, z) {
    const size = profile?.size || [64, 64];
    const preserveAspect = !!opts?.preserveAspect || !!profile?.preserveAspect;

    const w = size[0] * z;
    let h = size[1] * z;

    if (preserveAspect && isReadyImage(im)) {
      h = size[0] * (im.naturalHeight / im.naturalWidth) * z;
    }

    return { w, h };
  }

  function calcSpriteAnchorScreen(tx, ty, profile={}) {
    const a = core();
    if (!a || !a.game) return null;

    const p = a.tileToScreen(tx, ty);
    const z = a.game.camera.zoom || 1;

    const groundFactor = profile.groundFactor ?? 1.0;
    const groundOffset = profile.groundOffset || 0;
    const screenOffsetX = profile.screenOffsetX || 0;
    const screenOffsetY = profile.screenOffsetY || 0;

    return {
      x: p.x + screenOffsetX * z,
      y: p.y + a.TILE_H * z * groundFactor + groundOffset * z + screenOffsetY * z,
      z
    };
  }

  function drawTileDiamond(tx, ty, color='rgba(255,0,180,0.95)', fill='rgba(255,0,180,0.18)') {
    const a = core();
    if (!a || !a.ctx || !a.game) return;

    const ctx = a.ctx;
    const p = a.tileToScreen(tx, ty);
    const z = a.game.camera.zoom || 1;
    const w = a.TILE_W * z;
    const h = a.TILE_H * z;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + w / 2, p.y + h / 2);
    ctx.lineTo(p.x, p.y + h);
    ctx.lineTo(p.x - w / 2, p.y + h / 2);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, 1.5 * z);
    ctx.stroke();
    ctx.restore();
  }

  function drawFootprint(tx, ty, w=1, h=1) {
    for (let yy = 0; yy < h; yy++) {
      for (let xx = 0; xx < w; xx++) {
        drawTileDiamond(tx + xx, ty + yy);
      }
    }
  }

function profileFootprint(profile, fallback=[1,1]) {
  const fp = profile?.footprint;

  if (Array.isArray(fp) && fp.length >= 2) {
    return [
      Math.max(1, Math.round(fp[0] || 1)),
      Math.max(1, Math.round(fp[1] || 1))
    ];
  }

  return fallback;
}

function footprintCenter(tx, ty, w=1, h=1) {
  return {
    x: tx + w / 2 - 0.5,
    y: ty + h / 2 - 0.5
  };
}

  function drawPointScreen(x, y, color='red') {
    const a = core();
    if (!a || !a.ctx || !a.game) return;

    const z = a.game.camera.zoom || 1;
    const ctx = a.ctx;

    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(4, 5 * z), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawAnchor(tx, ty, profile={}) {
    const p = calcSpriteAnchorScreen(tx, ty, profile);
    if (!p) return;
    drawPointScreen(p.x, p.y, 'red');
  }

  function drawSpriteBounds(tx, ty, profile={}, im=null, opts={}) {
    const a = core();
    if (!a || !a.ctx || !a.game) return;

    const anchor = calcSpriteAnchorScreen(tx, ty, profile);
    if (!anchor) return;

    const { w, h } = calcSpriteSize(profile, im, opts, anchor.z);
    const ctx = a.ctx;

    const anchorX = profile.anchorX ?? 0.5;
    const anchorY = profile.anchorY ?? 1.0;

    ctx.save();
    ctx.strokeStyle = 'rgba(255,220,0,0.95)';
    ctx.lineWidth = Math.max(1, 1.5 * anchor.z);
    ctx.strokeRect(anchor.x - w * anchorX, anchor.y - h * anchorY, w, h);
    ctx.restore();
  }

function mine(m, profile, im) {
  if (!m) return;

  const [fw, fh] = profileFootprint(profile, [1,1]);
  const c = footprintCenter(m.x, m.y, fw, fh);

  if (state.footprints) drawFootprint(m.x, m.y, fw, fh);
  if (state.anchors) drawAnchor(c.x, c.y, profile);
  if (state.bounds) drawSpriteBounds(c.x, c.y, profile, im);
}

function unit(u, profile, im) {
  if (!u) return;

  const [fw, fh] = profileFootprint(profile, [1,1]);
  const tx = Math.round(u.x);
  const ty = Math.round(u.y);

  const c = footprintCenter(tx, ty, fw, fh);

  // В текущей игре юнит рисуется через u.x + 0.5 / u.y + 0.5.
  // Пока все юниты 1x1, это совпадает с центром footprint.
  if (state.footprints) drawFootprint(tx, ty, fw, fh);
  if (state.anchors) drawAnchor(c.x, c.y, profile);
  if (state.bounds) drawSpriteBounds(c.x, c.y, profile, im);
}

function obstacle(o, profile, im) {
  if (!o) return;

  const fallback = [o.w || 1, o.h || 1];
  const [fw, fh] = profileFootprint(profile, fallback);
const c = footprintCenter(o.x, o.y, fw, fh);

c.x += profile.anchorTileOffsetX ?? 0;
c.y += profile.anchorTileOffsetY ?? 0;

  if (state.footprints) drawFootprint(o.x, o.y, fw, fh);
  if (state.anchors) drawAnchor(c.x, c.y, profile);
  if (state.bounds) drawSpriteBounds(c.x, c.y, profile, im);
}

function building(b, profile, im) {
  if (!b) return;

  const fallback = [b.w || 1, b.h || 1];
  const [fw, fh] = profileFootprint(profile, fallback);
  const c = footprintCenter(b.x, b.y, fw, fh);

  if (state.footprints) drawFootprint(b.x, b.y, fw, fh);
  if (state.anchors) drawAnchor(c.x, c.y, profile);
  if (state.bounds) drawSpriteBounds(c.x, c.y, profile, im, { preserveAspect: true });
}

  function on() {
    state.footprints = true;
    state.anchors = true;
    state.bounds = true;
    console.warn('[FE DEBUG] all object debug: ON');
  }

  function off() {
    state.footprints = false;
    state.anchors = false;
    state.bounds = false;
    console.warn('[FE DEBUG] all object debug: OFF');
  }

  function footprints(value) {
    state.footprints = typeof value === 'boolean' ? value : !state.footprints;
    console.warn('[FE DEBUG] footprints:', state.footprints);
  }

  function anchors(value) {
    state.anchors = typeof value === 'boolean' ? value : !state.anchors;
    console.warn('[FE DEBUG] anchors:', state.anchors);
  }

  function bounds(value) {
    state.bounds = typeof value === 'boolean' ? value : !state.bounds;
    console.warn('[FE DEBUG] bounds:', state.bounds);
  }
  function isEnabled() {
    return state.footprints || state.anchors || state.bounds;
  }

  function toggle() {
    if (isEnabled()) {
      off();
    } else {
      on();
    }
  }

  window.FE_RENDER_DEBUG = {
    state,
    on,
    off,
    toggle,
    footprints,
    anchors,
    bounds,
    mine,
    unit,
    obstacle,
    building
  };

  window.FE_DEBUG_ALL_ON = on;
  window.FE_DEBUG_ALL_OFF = off;
  window.FE_DEBUG_ALL_TOGGLE = toggle;

  if (!window.__FE_DEBUG_KEY_9_INSTALLED) {
    window.__FE_DEBUG_KEY_9_INSTALLED = true;

    window.addEventListener('keydown', function (e) {
      if (e.repeat) return;

      const tag = (e.target && e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      if (e.key === '9' || e.code === 'Digit9' || e.code === 'Numpad9') {
        e.preventDefault();
        toggle();
      }
    });
  }

  console.warn('[Four Elements] render_debug.js loaded; press 9 to toggle overlay');
})();
