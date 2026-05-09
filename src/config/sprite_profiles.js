window.FE_SPRITE_PROFILES = {
  buildings: {
    hq_base:          { footprint:[3,3], size:[172,172], groundFactor:1.00, groundOffset:36, alphaCutoff:115, hpOffset:-86 },

    separator:        { footprint:[2,2], size:[128,128], groundFactor:1.00, groundOffset:14, alphaCutoff:125, hpOffset:-72 },
    minerals_storage: { footprint:[2,2], size:[128,128], groundFactor:1.00, groundOffset:14, alphaCutoff:125, hpOffset:-72 },
    energy_storage:   { footprint:[2,2], size:[128,128], groundFactor:1.00, groundOffset:14, alphaCutoff:125, hpOffset:-72 },
    elements_storage: { footprint:[2,2], size:[128,128], groundFactor:1.00, groundOffset:14, alphaCutoff:125, hpOffset:-72 },
    power_plant:      { footprint:[2,2], size:[128,128], groundFactor:1.00, groundOffset:14, alphaCutoff:125, hpOffset:-72 },
    energy_reactor:   { footprint:[2,2], size:[128,128], groundFactor:1.00, groundOffset:14, alphaCutoff:125, hpOffset:-72 },
    units_factory:    { footprint:[2,2], size:[128,128], groundFactor:1.00, groundOffset:14, alphaCutoff:125, hpOffset:-72 },
    repair_center:    { footprint:[2,2], size:[128,128], groundFactor:1.00, groundOffset:14, alphaCutoff:125, hpOffset:-72 },
    defense_tower:    { footprint:[2,2], size:[128,128], groundFactor:1.00, groundOffset:14, alphaCutoff:125, hpOffset:-72 }
  },

units: {
  builder: { footprint:[1,1], size:[92,92], groundFactor:0.76, groundOffset:0, anchorX:0.50, anchorY:0.88, screenOffsetX:0, screenOffsetY:0, alphaCutoff:110, hpOffset:44 },
  harvester:  { footprint:[1,1], size:[92,92], groundFactor:0.76, groundOffset:0, anchorX:0.50, anchorY:0.88, screenOffsetX:0, screenOffsetY:0, alphaCutoff:110, hpOffset:44 },
  light_tank: { footprint:[1,1], size:[104,104], groundFactor:0.76, groundOffset:0, anchorX:0.50, anchorY:0.88, screenOffsetX:-2, screenOffsetY:23, alphaCutoff:110, hpOffset:22 },
  heavy_tank: { footprint:[1,1], size:[56,56], groundFactor:0.76, groundOffset:0, anchorX:0.50, anchorY:1.00, screenOffsetX:0, screenOffsetY:0, alphaCutoff:110, hpOffset:-52 },
  bomber:     { footprint:[1,1], size:[56,56], groundFactor:0.76, groundOffset:0, anchorX:0.50, anchorY:1.00, screenOffsetX:0, screenOffsetY:0, alphaCutoff:110, hpOffset:-52 },
  scout:      { footprint:[1,1], size:[80,80], groundFactor:0.76, groundOffset:0, anchorX:0.50, anchorY:0.88, screenOffsetX:0, screenOffsetY:0, alphaCutoff:110, hpOffset:34 }
},

  minerals: {
    small:    { footprint:[1,1], size:[42,42],  groundFactor:1.02, groundOffset:-12, alphaCutoff:105, labelOffset:-22 },
    medium:   { footprint:[1,1], size:[58,58],  groundFactor:1.02, groundOffset:0, alphaCutoff:105, labelOffset:-26 },
    large:    { footprint:[1,1], size:[74,74],  groundFactor:1.02, groundOffset:0, alphaCutoff:105, labelOffset:-32 },
    infinite: { footprint:[2,2], size:[110,96], groundFactor:1.02, groundOffset:28,   alphaCutoff:105, labelOffset:-38 }
  },

  obstacles: {
    mountain_small_01:  { footprint:[1,1], size:[80,72],   groundFactor:1.02, groundOffset:0, anchorX:0.50, anchorY:1.00, screenOffsetX:0, screenOffsetY:0, alphaCutoff:115 },
    mountain_medium_01: { footprint:[2,2], size:[120,96],  groundFactor:1.02, groundOffset:12, anchorX:0.50, anchorY:1.00, screenOffsetX:0, screenOffsetY:0, alphaCutoff:115 },
    mountain_ridge_01: { footprint:[3,1], size:[170,112], groundFactor:1.02, groundOffset:0, anchorTileOffsetX:1, anchorTileOffsetY:0.5, anchorX:0.50, anchorY:1.00, screenOffsetX:0, screenOffsetY:0, alphaCutoff:115 },
    mountain_large_01:  { footprint:[3,3], size:[160,142], groundFactor:1.02, groundOffset:28, anchorX:0.50, anchorY:1.00, screenOffsetX:0, screenOffsetY:0, alphaCutoff:115 },

    volcano_small_01:   { footprint:[1,1], size:[95,90],   groundFactor:1.02, groundOffset:0, anchorX:0.50, anchorY:1.00, screenOffsetX:0, screenOffsetY:0, alphaCutoff:115 },
    volcano_medium_01:  { footprint:[2,2], size:[130,120], groundFactor:1.02, groundOffset:12, anchorX:0.50, anchorY:1.00, screenOffsetX:0, screenOffsetY:0, alphaCutoff:115 },
    volcano_large_01:   { footprint:[3,3], size:[170,150], groundFactor:1.02, groundOffset:24, anchorX:0.50, anchorY:1.00, screenOffsetX:0, screenOffsetY:0, alphaCutoff:115 },

    rock_cluster_small_01: { footprint:[1,1], size:[58,46], groundFactor:1.02, groundOffset:0, anchorX:0.50, anchorY:1.00, screenOffsetX:0, screenOffsetY:0, alphaCutoff:115 },
    dry_bush_01:           { footprint:[1,1], size:[34,28], groundFactor:1.02, groundOffset:-12, anchorX:0.50, anchorY:1.00, screenOffsetX:0, screenOffsetY:0, alphaCutoff:115 },
    sand_bump_01:          { footprint:[1,1], size:[50,28], groundFactor:1.02, groundOffset:-8, anchorX:0.50, anchorY:1.00, screenOffsetX:0, screenOffsetY:0, alphaCutoff:115 }
  }
};

console.warn('[Four Elements] sprite_profiles.js loaded: visual profiles + footprints');
