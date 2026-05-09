// Four Elements v0.4 config: buildings
// Тут правим стоимость, HP, время строительства, footprint зданий.

window.FE_BUILDINGS = {
    separator: {
      name:'Сепаратор', costEnergy:30, buildTime:25, asset:'separator',
      desc:'Перерабатывает 20 сырья в 10 энергии и 1 элемент фракции.'
    },
    minerals_storage: {
      name:'Склад сырья', costEnergy:35, buildTime:20, asset:'minerals_storage',
      storageBonus:{ minerals:200 }, desc:'Увеличивает лимит сырья на 200.'
    },
    energy_storage: {
      name:'Склад энергии', costEnergy:45, buildTime:22, asset:'energy_storage',
      storageBonus:{ energy:300 }, desc:'Увеличивает лимит энергии на 300.'
    },
    elements_storage: {
      name:'Склад элементов', costEnergy:50, buildTime:24, asset:'elements_storage',
      storageBonus:{ purple:20, greenEl:20, cyanEl:20, yellowEl:20 },
      desc:'Увеличивает лимит каждого элемента на 20.'
    },
    power_plant: {
      name:'Электростанция', costEnergy:35, buildTime:25, asset:'power_plant',
      desc:'Заложена под будущую энергосистему.'
    },
    energy_reactor: {
      name:'Энергореактор', costEnergy:45, buildTime:35, asset:'energy_reactor',
      desc:'Заложен под будущую продвинутую энергосистему.'
    },
    units_factory: {
      name:'Фабрика юнитов', costEnergy:55, buildTime:40, asset:'units_factory',
      desc:'Производит строителей и сборщиков за элементы фракции.'
    },
    repair_center: {
      name:'Ремонтный центр', costEnergy:160, buildTime:35, asset:'repair_center',
      desc:'Заложен под будущий ремонт юнитов.'
    },
    defense_tower: {
      name:'Защитная башня', costEnergy:180, buildTime:30, asset:'defense_tower',
      desc:'Заложена под будущую оборону.'
    }
  };

window.FE_BUILDING_SIZE = {
  hq_base: [3,3],
  separator: [2,2],
  minerals_storage: [2,2],
  energy_storage: [2,2],
  elements_storage: [2,2],
  power_plant: [2,2],
  energy_reactor: [2,2],
  units_factory: [2,2],
  repair_center: [2,2],
  defense_tower: [2,2]
};

// PATCH-09B2-ECONOMY-BASELINE-FIX-V2: building energy cost baseline synced with docs.
