import type { Camera } from '../render/camera.js';
import type { MapData } from '../game/map-types.js';
import type { ReadonlyEconomyState } from '../systems/economy.js';
import type { ReadonlyPowerState } from '../systems/power.js';
import type { HarvesterState, ResourceNodeState } from '../systems/harvesting.js';
import type { TerritoryState } from '../systems/territory.js';

export type WorldRendererKind = 'canvas' | 'phaser';

export interface WorldRenderSnapshot {
  readonly map: MapData;
  readonly visualSeed: number;
  readonly camera: Camera;
  readonly economy: ReadonlyEconomyState;
  readonly power: ReadonlyPowerState;
  readonly harvesters: readonly HarvesterState[];
  readonly ticks: number;
  readonly prevHarvesterPositions: ReadonlyMap<number, { tx: number; ty: number }>;
  readonly territory: TerritoryState;
  readonly resourceNodes: readonly ResourceNodeState[];
}

export interface WorldRenderer {
  readonly kind: WorldRendererKind;
  init(): Promise<void>;
  render(snapshot: WorldRenderSnapshot): void;
  resize(width: number, height: number): void;
  destroy(): void;
}
