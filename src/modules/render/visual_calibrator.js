// Four Elements visual calibrator
// Не трогает main.js. Меняет только window.FE_SPRITE_PROFILES в runtime.

(function () {
  const state = {
    group: 'buildings',
    type: 'separator'
  };

  function getProfile() {
    const root = window.FE_SPRITE_PROFILES;
    if (!root) {
      console.warn('[FE_CAL] FE_SPRITE_PROFILES не найден');
      return null;
    }

    const group = root[state.group];
    if (!group) {
      console.warn('[FE_CAL] группа не найдена:', state.group);
      return null;
    }

    const p = group[state.type];
    if (!p) {
      console.warn('[FE_CAL] профиль не найден:', state.group, state.type);
      return null;
    }

    return p;
  }

  function print() {
    const p = getProfile();
    if (!p) return;

    console.warn('[FE_CAL]', state.group + '.' + state.type, {
      size: p.size,
      anchorX: p.anchorX,
      anchorY: p.anchorY,
      footprint: p.footprint,
      screenOffsetX: p.screenOffsetX || 0,
      screenOffsetY: p.screenOffsetY || 0,
      anchorTileOffsetX: p.anchorTileOffsetX || 0,
      anchorTileOffsetY: p.anchorTileOffsetY || 0,
      groundOffset: p.groundOffset || 0,
      groundFactor: p.groundFactor
    });
  }

  function setType(type, group='buildings') {
    state.group = group;
    state.type = type;
    print();
  }

  function offset(x, y) {
    const p = getProfile();
    if (!p) return;

    p.screenOffsetX = Number(x) || 0;
    p.screenOffsetY = Number(y) || 0;

    print();
  }

  function move(dx, dy) {
    const p = getProfile();
    if (!p) return;

    p.screenOffsetX = (Number(p.screenOffsetX) || 0) + (Number(dx) || 0);
    p.screenOffsetY = (Number(p.screenOffsetY) || 0) + (Number(dy) || 0);

    print();
  }

  function anchor(x, y) {
    const p = getProfile();
    if (!p) return;

    if (x !== null && x !== undefined) p.anchorX = Number(x);
    if (y !== null && y !== undefined) p.anchorY = Number(y);

    print();
  }

  function ground(offset) {
    const p = getProfile();
    if (!p) return;

    p.groundOffset = Number(offset) || 0;

    print();
  }

  function size(w, h=w) {
    const p = getProfile();
    if (!p) return;

    p.size = [Number(w), Number(h)];

    print();
  }

  function copy() {
    const p = getProfile();
    if (!p) return;

    const footprintLine = Array.isArray(p.footprint)
      ? `  footprint:[${p.footprint[0]},${p.footprint[1]}],\n`
      : '';

    const anchorTileOffsetXLine = p.anchorTileOffsetX !== undefined
      ? `  anchorTileOffsetX:${p.anchorTileOffsetX || 0},\n`
      : '';

    const anchorTileOffsetYLine = p.anchorTileOffsetY !== undefined
      ? `  anchorTileOffsetY:${p.anchorTileOffsetY || 0},\n`
      : '';

    const hpOffsetLine = p.hpOffset !== undefined
      ? `  hpOffset:${p.hpOffset},\n`
      : '';

    const labelOffsetLine = p.labelOffset !== undefined
      ? `  labelOffset:${p.labelOffset},\n`
      : '';

    const code =
`${state.type}: {
${footprintLine}  size:[${p.size[0]},${p.size[1]}],
  groundFactor:${p.groundFactor ?? 1.00},
  groundOffset:${p.groundOffset || 0},
${anchorTileOffsetXLine}${anchorTileOffsetYLine}  anchorX:${p.anchorX ?? 0.5},
  anchorY:${p.anchorY ?? 1.0},
  screenOffsetX:${p.screenOffsetX || 0},
  screenOffsetY:${p.screenOffsetY || 0},
  alphaCutoff:${p.alphaCutoff ?? 125},
${hpOffsetLine}${labelOffsetLine}}`;

    console.warn('[FE_CAL COPY]\\n' + code);

    try {
      navigator.clipboard.writeText(code);
      console.warn('[FE_CAL] скопировано в clipboard');
    } catch (e) {
      console.warn('[FE_CAL] не смог скопировать автоматически, скопируй из Console');
    }

    return code;
  }

  window.FE_CAL = {
    type: setType,
    print,
    offset,
    move,
    anchor,
    ground,
    size,
    copy
  };

  console.warn('[Four Elements] visual calibrator loaded');
  console.warn('[FE_CAL] commands: FE_CAL.type("separator"), FE_CAL.move(x,y), FE_CAL.offset(x,y), FE_CAL.anchor(x,y), FE_CAL.copy()');
})();
