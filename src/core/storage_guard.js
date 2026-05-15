// Four Elements v0.4 module: storage_guard
// Защита от переполнения localStorage тяжёлыми debug-логами.

(function () {
  const DEBUG_KEYS = new Set([
    'four_elements_debug_log_v04_full',
    'four_elements_harvester_debug_log'
  ]);

  function isDebugKey(key) {
    return DEBUG_KEYS.has(String(key));
  }

  function clearDebugKeys() {
    for (const key of DEBUG_KEYS) {
      try { localStorage.removeItem(key); } catch (e) {}
      try { sessionStorage.removeItem(key); } catch (e) {}
    }
  }

  clearDebugKeys();

  if (!window.__FE_STORAGE_GUARD_INSTALLED__) {
    window.__FE_STORAGE_GUARD_INSTALLED__ = true;

    const originalGetItem = Storage.prototype.getItem;
    const originalSetItem = Storage.prototype.setItem;

    Storage.prototype.getItem = function (key) {
      if (isDebugKey(key)) return '[]';
      return originalGetItem.call(this, key);
    };

    Storage.prototype.setItem = function (key, value) {
      if (isDebugKey(key)) return;

      try {
        return originalSetItem.call(this, key, value);
      } catch (e) {
        if (e && (e.name === 'QuotaExceededError' || e.code === 22)) {
          clearDebugKeys();
          return originalSetItem.call(this, key, value);
        }

        throw e;
      }
    };
  }

  console.warn('[Four Elements] module loaded: storage_guard');
})();
