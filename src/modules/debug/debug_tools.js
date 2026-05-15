(function () {
  'use strict';

  function toggleRenderDebug() {
    const r = window.FE_RENDER_DEBUG;

    if (!r) {
      console.warn('[FE DEBUG] FE_RENDER_DEBUG not loaded yet');
      return;
    }

    if (typeof r.toggle === 'function') {
      r.toggle();
      return;
    }

    const enabled =
      !!r.state?.footprints ||
      !!r.state?.anchors ||
      !!r.state?.bounds;

    if (enabled && typeof r.off === 'function') {
      r.off();
    } else if (typeof r.on === 'function') {
      r.on();
    }
  }

  window.FE_DEBUG_ALL_TOGGLE = toggleRenderDebug;

  if (!window.__FE_DEBUG_KEY_9_INSTALLED) {
    window.__FE_DEBUG_KEY_9_INSTALLED = true;

    window.addEventListener('keydown', function (e) {
      if (e.repeat) return;

      const tag = (e.target && e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      if (e.key === '9' || e.code === 'Digit9' || e.code === 'Numpad9') {
        e.preventDefault();
        toggleRenderDebug();
      }
    });
  }

  console.warn('[FE DEBUG] debug_tools.js loaded: key 9 delegates to FE_RENDER_DEBUG');
})();