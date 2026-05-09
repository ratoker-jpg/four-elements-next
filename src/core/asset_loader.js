// Four Elements v0.4 module: asset loader.

(function () {
  function img(path) {
    const im = new Image();
    im.src = path;
    return im;
  }

  function loadUnitAnimation(basePath, unitName, options = {}) {
    const dirs = [];
    const useMoveFrames = options.useMoveFrames === true;
    const idleCacheVersion = options.idleCacheVersion || options.cacheVersion || 'v04_unit8_1';
    const moveCacheVersion = options.moveCacheVersion || options.cacheVersion || idleCacheVersion;

    for (let d = 0; d < 8; d++) {
      const idleFrame = img(`${basePath}/${unitName}_idle_dir${d}_0.png?v=${idleCacheVersion}`);
      dirs[d] = {
        idle: [idleFrame],
        move: useMoveFrames
          ? [0, 1, 2, 3].map(f =>
            img(`${basePath}/${unitName}_move_dir${d}_${f}.png?v=${moveCacheVersion}`)
          )
          : [idleFrame, idleFrame, idleFrame, idleFrame]
      };
    }

    return dirs;
  }

  function loadAssets(faction='cyan') {
    return {
      units: {
        harvester: img(`assets/factions/${faction}/units/harvester.png?v=v04_harvester8_1`),
        builder: img(`assets/factions/${faction}/units/builder.png?v=v04_hq_clean_1`),
        light_tank: img(`assets/factions/${faction}/units/light_tank.png?v=v04_light_tank8_1`),
        scout: img(`assets/factions/${faction}/units/scout_8dirs/scout_idle_dir0_0.png?v=v04_scout_1`)
      },
      unitFallbacks: {
        harvester: img(`assets/factions/${faction}/units/harvester_solid.png?v=v04_harvester8_1`)
      },
      unitAnimations: {
        builder: loadUnitAnimation(`assets/factions/${faction}/units/builder_8dirs`, 'builder', {
          useMoveFrames: window.FE_BUILDER_USE_MOVE_FRAMES === true,
          idleCacheVersion: 'v04_builder_bright_v2',
          moveCacheVersion: 'v04_builder8_1'
        }),
        harvester: loadUnitAnimation(`assets/factions/${faction}/units/harvester_8dirs`, 'harvester', {
          useMoveFrames: false,
          cacheVersion: 'v04_harvester8_1'
        }),
        light_tank: loadUnitAnimation(`assets/factions/${faction}/units/light_tank_8dirs`, 'light_tank', {
          useMoveFrames: false,
          cacheVersion: 'v04_light_tank8_1'
        }),
        scout: loadUnitAnimation(`assets/factions/${faction}/units/scout_8dirs`, 'scout', {
          useMoveFrames: false,
          cacheVersion: 'v04_scout_1'
        })
      },
      buildings: {
        hq_base: img(`assets/factions/${faction}/buildings/hq_base.png?v=v04_hq_clean_1`),
        separator: img(`assets/factions/${faction}/buildings/separator.png?v=v04_hq_clean_1`),
        minerals_storage: img(`assets/factions/${faction}/buildings/minerals_storage.png?v=v04_hq_clean_1`),
        energy_storage: img(`assets/factions/${faction}/buildings/energy_storage.png?v=v04_hq_clean_1`),
        elements_storage: img(`assets/factions/${faction}/buildings/elements_storage.png?v=v04_hq_clean_1`),
        energy_reactor: img(`assets/factions/${faction}/buildings/energy_reactor.png?v=v04_hq_clean_1`),
        power_plant: img(`assets/factions/${faction}/buildings/power_plant.png?v=v04_hq_clean_1`),
        units_factory: img(`assets/factions/${faction}/buildings/units_factory.png?v=v04_hq_clean_1`),
        repair_center: img(`assets/factions/${faction}/buildings/repair_center.png?v=v04_hq_clean_1`),
        defense_tower: img(`assets/factions/${faction}/buildings/defense_tower.png?v=v04_hq_clean_1`)
      },
      tiles: {
        sand: img('assets/tiles/tile_sand_v03.png?v=v04_hq_clean_1'),
        sand_default: img('assets/tiles/sand_tile.png?v=v04_hq_clean_1'),
        sand_dark: img('assets/tiles/sand_tile_dark.png?v=v04_hq_clean_1'),
        sand_light: img('assets/tiles/sand_tile_light.png?v=v04_hq_clean_1'),
        base_grid: img('assets/tiles/base_grid_tile.png?v=v04_hq_clean_1'),
        territory_green: img('assets/tiles/territory_green.png?v=v04_hq_clean_1'),
        territory_cyan: img('assets/tiles/territory_cyan.png?v=v04_hq_clean_1'),
        territory_yellow: img('assets/tiles/territory_yellow.png?v=v04_hq_clean_1'),
        territory_purple: img('assets/tiles/territory_purple.png?v=v04_hq_clean_1')
      },
      environment: {
        mineral_small: img('assets/environment/mineral_small.png?v=v04_hq_clean_1'),
        mineral_medium: img('assets/environment/mineral_medium.png?v=v04_hq_clean_1'),
        mineral_large: img('assets/environment/mineral_large.png?v=v04_hq_clean_1'),
        mineral_infinite: img('assets/environment/mineral_infinite.png?v=v04_hq_clean_1'),
        mountain_small_01: img('assets/environment/mountain_small_01.png?v=v04_hq_clean_1'),
        mountain_medium_01: img('assets/environment/mountain_medium_01.png?v=v04_hq_clean_1'),
        mountain_ridge_01: img('assets/environment/mountain_ridge_01.png?v=v04_hq_clean_1'),
        mountain_large_01: img('assets/environment/mountain_large_01.png?v=v04_hq_clean_1'),
        volcano_small_01: img('assets/environment/volcano_small_01.png?v=v04_hq_clean_1'),
        volcano_medium_01: img('assets/environment/volcano_medium_01.png?v=v04_hq_clean_1'),
        volcano_large_01: img('assets/environment/volcano_large_01.png?v=v04_hq_clean_1'),
        rock_cluster_small_01: img('assets/environment/rock_cluster_small_01.png?v=v04_hq_clean_1'),
        dry_bush_01: img('assets/environment/dry_bush_01.png?v=v04_hq_clean_1'),
        sand_bump_01: img('assets/environment/sand_bump_01.png?v=v04_hq_clean_1')
      }
    };
  }

  window.FE_ASSET_LOADER = {
    img,
    loadUnitAnimation,
    loadAssets
  };
})();
