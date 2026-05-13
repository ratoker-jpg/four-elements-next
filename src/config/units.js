// Four Elements v0.4 config: units
// Тут правим скорость, HP, вместимость, обзор, стоимость и время производства юнитов.

window.FE_UNITS = {
    harvester: { name:'Сборщик', costElement:1, productionTime:25, hp:100, speed:0.46, cargo:10, view:5,
                 productionCategory:'civilian', queueGroup:'default', role:'worker' },
    builder:   { name:'Строитель', costElement:1, productionTime:20, hp:100, speed:0.62, cargo:0, view:4,
                 productionCategory:'civilian', queueGroup:'default', role:'worker' },
    light_tank:{ name:'Лёгкий танк', costElement:2, productionTime:35, hp:160, speed:0.55, view:4,
                 productionCategory:'military', queueGroup:'default', role:'combat' },
    heavy_tank:{ name:'Тяжёлый танк', costElement:4, productionTime:60, hp:260, speed:0.42, view:4,
                 productionCategory:'military', queueGroup:'default', role:'combat' },
    bomber:    { name:'Бомбардировщик', costElement:6, productionTime:55, hp:130, speed:0.58, view:4,
                 productionCategory:'military', queueGroup:'default', role:'combat' },
    scout:     { name:'Разведчик', costElement:1, productionTime:18, hp:70, speed:1.08, cargo:0, view:7, canAttack:false,
                 productionCategory:'military', queueGroup:'default', role:'recon' }
  };
