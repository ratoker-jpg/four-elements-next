// Four Elements v0.4 config: factions
// Тут правим бонусы фракций.

window.FE_FACTIONS = {
    cyan: {
      label:'Голубые', color:'#69d5f4', plate:'territory_cyan',
      bonus:'+10% к производству гражданских юнитов',
      harvesterSpeed:1, buildSpeed:1, civilianProductionSpeed:1.10, combatProductionSpeed:1, territoryViewBonus:0
    },
    green: {
      label:'Зелёные', color:'#62d06b', plate:'territory_green',
      bonus:'+10% к скорости строительства',
      harvesterSpeed:1, buildSpeed:1.10, civilianProductionSpeed:1, combatProductionSpeed:1, territoryViewBonus:0
    },
    yellow: {
      label:'Жёлтые', color:'#f2d75c', plate:'territory_yellow',
      bonus:'+10% к производству боевых юнитов',
      harvesterSpeed:1, buildSpeed:1, civilianProductionSpeed:1, combatProductionSpeed:1.10, territoryViewBonus:0
    },
    purple: {
      label:'Фиолетовые', color:'#c87ae8', plate:'territory_purple',
      bonus:'окрашенные клетки раскрывают радиус 2',
      harvesterSpeed:1, buildSpeed:1, civilianProductionSpeed:1, combatProductionSpeed:1, territoryViewBonus:1
    }
  };
