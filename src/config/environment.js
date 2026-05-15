// Four Elements v0.4 config: minerals and map obstacles.

window.FE_MINE_TYPES = {
  small:    { label:'Малый минерал', remaining:8, yield:10, asset:'mineral_small', size:[42,42] },
  medium:   { label:'Средний минерал', remaining:25, yield:10, asset:'mineral_medium', size:[58,58] },
  large:    { label:'Большой минерал', remaining:50, yield:10, asset:'mineral_large', size:[74,74] },
  infinite: { label:'Центральная залежь', remaining:Infinity, yield:10, asset:'mineral_infinite', size:[110,96] }
};

window.FE_OBSTACLE_ASSETS = {
  mountain_small_01:  { size:[80,72] },
  mountain_medium_01: { size:[120,96] },
  mountain_ridge_01:  { size:[170,112] },
  mountain_large_01:  { size:[160,142] },
  volcano_small_01:   { size:[95,90] },
  volcano_medium_01:  { size:[130,120] },
  volcano_large_01:   { size:[170,150] },
  rock_cluster_small_01: { size:[58,46] },
  dry_bush_01: { size:[34,28] },
  sand_bump_01: { size:[50,28] }
};
