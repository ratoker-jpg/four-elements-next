import { describe, it, expect } from 'vitest';
import {
  BUILDING_DEFINITIONS,
  BUILD_MENU_ORDER,
  getBuildingFootprint,
} from '../../src/config/buildings.js';

describe('building definitions', () => {
  it('all building types have definitions', () => {
    const types: Array<keyof typeof BUILDING_DEFINITIONS> = [
      'separator',
      'raw-storage',
      'matter-storage',
      'power-plant',
      'command-relay',
      'units-factory',
    ];
    for (const type of types) {
      const def = BUILDING_DEFINITIONS[type];
      expect(def).toBeDefined();
      expect(def.type).toBe(type);
      expect(def.label.length).toBeGreaterThan(0);
      expect(def.shortCode.length).toBeGreaterThan(0);
      expect(def.costMatter).toBeGreaterThan(0);
      expect(def.buildTimeSeconds).toBeGreaterThan(0);
      expect(def.footprint).toBeGreaterThan(0);
    }
  });

  it('units-factory has correct definition', () => {
    const def = BUILDING_DEFINITIONS['units-factory'];
    expect(def.label).toBe('Фабрика юнитов');
    expect(def.shortCode).toBe('FAC');
    expect(def.costMatter).toBe(150);
    expect(def.buildTimeSeconds).toBe(30);
    expect(def.footprint).toBe(2);
  });

  it('BUILD_MENU_ORDER includes all building types', () => {
    expect(BUILD_MENU_ORDER).toContain('separator');
    expect(BUILD_MENU_ORDER).toContain('raw-storage');
    expect(BUILD_MENU_ORDER).toContain('matter-storage');
    expect(BUILD_MENU_ORDER).toContain('power-plant');
    expect(BUILD_MENU_ORDER).toContain('command-relay');
    expect(BUILD_MENU_ORDER).toContain('units-factory');
    expect(BUILD_MENU_ORDER).toHaveLength(6);
  });

  it('units-factory is last in build menu order', () => {
    expect(BUILD_MENU_ORDER[BUILD_MENU_ORDER.length - 1]).toBe('units-factory');
  });

  it('getBuildingFootprint returns 2 for all civil buildings', () => {
    expect(getBuildingFootprint('separator')).toBe(2);
    expect(getBuildingFootprint('raw-storage')).toBe(2);
    expect(getBuildingFootprint('matter-storage')).toBe(2);
    expect(getBuildingFootprint('power-plant')).toBe(2);
    expect(getBuildingFootprint('command-relay')).toBe(2);
    expect(getBuildingFootprint('units-factory')).toBe(2);
  });
});
