// Four Elements v0.4 config: units
// Тут правим скорость, HP, вместимость, обзор, стоимость и время производства юнитов.

window.FE_UNITS = {
    harvester: { name:'Сборщик', costElement:1, productionTime:25, hp:100, speed:0.46, cargo:10, view:5 },
    builder:   { name:'Строитель', costElement:1, productionTime:20, hp:100, speed:0.62, cargo:0, view:4 },
    light_tank:{ name:'Лёгкий танк', costElement:2, productionTime:35, hp:160, speed:0.55, view:4 },
    heavy_tank:{ name:'Тяжёлый танк', costElement:4, productionTime:60, hp:260, speed:0.42, view:4 },
    bomber:    { name:'Бомбардировщик', costElement:6, productionTime:55, hp:130, speed:0.58, view:4 },
    scout:     { name:'Разведчик', costElement:1, productionTime:18, hp:70, speed:0.72, cargo:0, view:7, canAttack:false }
  };
