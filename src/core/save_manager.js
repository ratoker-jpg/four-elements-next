// Four Elements v0.4 module: save/load and save-slot UI.

(function () {
  function canContinue(saveKey) {
    return !!localStorage.getItem(saveKey);
  }

  function save(api) {
    const game = api.game;
    if (!game || game.screen !== 'game') return;

    const payload = {
      savedAt: new Date().toISOString(),
      version: 'v0.4',
      faction: game.faction,
      factionLabel: api.FACTIONS[game.faction].label,
      factionWasRandom: game.factionWasRandom,
      mapSize: game.mapSize,
      time: game.time,
      resources: game.resources,
      camera: game.camera,
      terrain: game.terrain,
      minerals: game.minerals,
      units: game.units,
      buildings: game.buildings,
      obstacles: game.obstacles,
      territory: game.territory,
      fogExplored: game.fogExplored
    };

    localStorage.setItem(api.SAVE_KEY, JSON.stringify(payload));
  }

  function load(api) {
    const raw = localStorage.getItem(api.SAVE_KEY);
    if (!raw) return false;

    let p;
    try {
      p = JSON.parse(raw);
    } catch {
      return false;
    }

    const game = api.blankGame(p.mapSize || 'standard');
    game.screen = 'game';
    game.faction = p.faction || 'cyan';
    game.factionWasRandom = !!p.factionWasRandom;

    api.loadAssets(game.faction);

    game.time = p.time || 0;
    game.resources = p.resources || game.resources;
    game.camera = p.camera || game.camera;
    game.terrain = p.terrain || game.terrain;
    game.minerals = p.minerals || [];
    game.units = p.units || [];
    game.buildings = p.buildings || [];
    game.obstacles = p.obstacles || [];
    game.territory = p.territory || game.territory;
    game.clickMarkers = [];
    game.fogVisible = Array.from({ length:game.mapH }, () => Array.from({ length:game.mapW }, () => false));
    game.fogExplored = p.fogExplored || Array.from({ length:game.mapH }, () => Array.from({ length:game.mapW }, () => false));

    api.setGame(game);
    api.setSelected(null);
    api.updateFog();
    api.updateHud(true);
    api.hideMenus();
    api.hideScreens();
    game.paused = false;
    api.showToast('Сохранение загружено');

    return true;
  }

  function renderSaveMenu(api) {
    const saveSlotBox = api.saveSlotBox;
    saveSlotBox.innerHTML = '';

    const raw = localStorage.getItem(api.SAVE_KEY);
    if (!raw) {
      const b = document.createElement('button');
      b.className = 'menu-btn disabled';
      b.textContent = 'Пустой слот';
      saveSlotBox.appendChild(b);
      return;
    }

    const p = JSON.parse(raw);
    const b = document.createElement('button');
    b.className = 'menu-btn';
    const date = new Date(p.savedAt).toLocaleString('ru-RU');
    b.innerHTML = `${p.factionLabel || 'Фракция'} / ${api.MAP_SIZES[p.mapSize]?.label || 'Карта'}<br><span style="font-size:13px;color:#ffe0a0">Сохранено: ${date}<br>Время игры: ${api.formatTime(p.time)}</span>`;
    b.onclick = () => api.loadGame();
    saveSlotBox.appendChild(b);
  }

  window.FE_SAVE_MANAGER = {
    canContinue,
    save,
    load,
    renderSaveMenu
  };
})();
