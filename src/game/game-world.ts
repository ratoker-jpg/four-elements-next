/** GameWorld: owns render loop, camera, assets, GameState, input, and UI callbacks. */

import { ASSET_MANIFEST, CIVIL_8X8_256_MANIFEST, FE_CIVIL_8X8_256_SHEETS_ENABLED, BUILDING_ASSET_MANIFEST, FE_BUILDING_SPRITES_ENABLED } from '../core/constants.js';
import { tileToScreen } from '../core/coordinates.js';
import { AssetStore } from '../core/assets.js';
import type { FactionId, BuildingType, ConstructionSitePlacement } from './map-types.js';
import type { ProducibleUnitType, ReadonlyProductionState } from '../systems/production.js';
import type { GameState } from './game-state.js';
import { createGameState } from './game-state.js';
import { Camera } from '../render/camera.js';
import { render } from '../render/renderer.js';
import {
  getFactionElement,
  type ReadonlyEconomyState,
} from '../systems/economy.js';
import type { ReadonlyPowerState } from '../systems/power.js';
import type { ReadonlyControlState } from '../systems/control.js';
import { BUILDING_DEFINITIONS } from '../config/buildings.js';
import {
  startConstruction as startConstructionSystem,
  type ConstructionCommandResult as ConstructionCommandResultType,
} from '../systems/construction.js';
import {
  startProduction as startProductionSystem,
  type ProductionCommandResult,
} from '../systems/production.js';
import { runSystems } from '../systems/system-runner.js';

/** Empty readonly map passed to render() when the spritesheet flag is OFF. */
const EMPTY_PREV_POSITIONS: ReadonlyMap<number, { tx: number; ty: number }> = new Map();

export class GameWorld {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private camera: Camera;
  private state: GameState;
  private assets: AssetStore;
  private animFrameId: number | null = null;
  private lastTime = 0;
  private keys = new Set<string>();
  private isPanning = false;
  private panStartX = 0;
  private panStartY = 0;
  private camPanStartX = 0;
  private camPanStartY = 0;
  /** Monotonic tick counter for sprite animation. */
  private ticks = 0;
  /** Previous harvester positions (by index) for direction computation. */
  private prevHarvesterPositions = new Map<number, { tx: number; ty: number }>();

  onEconomyUpdate?: (state: ReadonlyEconomyState) => void;
  onPowerUpdate?: (state: ReadonlyPowerState) => void;
  onControlUpdate?: (state: ReadonlyControlState) => void;
  onConstructionUpdate?: (state: {
    builderBusy: boolean;
    matter: number;
    statusMessage: string;
    sites: ReadonlyArray<ConstructionSitePlacement>;
  }) => void;
  onProductionUpdate?: (state: ReadonlyProductionState & {
    economy: ReadonlyEconomyState;
    control: ReadonlyControlState;
    power: ReadonlyPowerState;
  }) => void;

  private boundKeyDown: (e: KeyboardEvent) => void;
  private boundKeyUp: (e: KeyboardEvent) => void;
  private boundMouseDown: (e: MouseEvent) => void;
  private boundMouseMove: (e: MouseEvent) => void;
  private boundMouseUp: () => void;
  private boundWheel: (e: WheelEvent) => void;
  private boundResize: () => void;

  constructor(canvas: HTMLCanvasElement, mapSize: string, faction: FactionId | 'random') {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Cannot get 2D context');
    this.ctx = ctx;

    this.state = createGameState(mapSize, faction);
    this.assets = new AssetStore();

    const hqScreen = tileToScreen(this.state.map.hq.tx + 1.5, this.state.map.hq.ty + 1.5);
    this.camera = new Camera(hqScreen.x, hqScreen.y);

    this.boundKeyDown = this.onKeyDown.bind(this);
    this.boundKeyUp = this.onKeyUp.bind(this);
    this.boundMouseDown = this.onMouseDown.bind(this);
    this.boundMouseMove = this.onMouseMove.bind(this);
    this.boundWheel = this.onWheel.bind(this);
    this.boundMouseUp = this.onMouseUp.bind(this);
    this.boundResize = this.onResize.bind(this);
  }

  async init(): Promise<void> {
    await this.assets.loadManifest(ASSET_MANIFEST);
    if (FE_CIVIL_8X8_256_SHEETS_ENABLED) {
      await this.assets.loadManifest(CIVIL_8X8_256_MANIFEST);
    }
    if (FE_BUILDING_SPRITES_ENABLED) {
      await this.assets.loadManifest(BUILDING_ASSET_MANIFEST);
    }
  }

  start(): void {
    window.addEventListener('keydown', this.boundKeyDown);
    window.addEventListener('keyup', this.boundKeyUp);
    this.canvas.addEventListener('mousedown', this.boundMouseDown);
    window.addEventListener('mousemove', this.boundMouseMove);
    window.addEventListener('mouseup', this.boundMouseUp);
    this.canvas.addEventListener('wheel', this.boundWheel, { passive: false });
    window.addEventListener('resize', this.boundResize);

    this.onResize();
    this.lastTime = performance.now();
    this.publishUiState();
    this.publishTestHooks();
    this.animFrameId = requestAnimationFrame(this.loop.bind(this));
  }

  destroy(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    window.removeEventListener('keydown', this.boundKeyDown);
    window.removeEventListener('keyup', this.boundKeyUp);
    this.canvas.removeEventListener('mousedown', this.boundMouseDown);
    window.removeEventListener('mousemove', this.boundMouseMove);
    window.removeEventListener('mouseup', this.boundMouseUp);
    this.canvas.removeEventListener('wheel', this.boundWheel);
    window.removeEventListener('resize', this.boundResize);
    this.keys.clear();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).__cameraPos;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).__economyState;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).__powerState;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).__controlState;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).__constructionState;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).__harvesterState;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).__productionState;

    if (import.meta.env.MODE === 'test') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).__constructionTest;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).__productionTest;
    }
  }

  getEconomyState(): ReadonlyEconomyState { return this.state.economy; }
  getPowerState(): ReadonlyPowerState { return this.state.power; }
  getControlState(): ReadonlyControlState { return this.state.control; }

  startConstruction(buildingType: BuildingType): ConstructionCommandResultType {
    const result = startConstructionSystem(this.state.map, this.state.economy, buildingType);
    this.state.constructionStatusMessage = this.resolveConstructionMessage(result);
    this.publishUiState();
    return result;
  }

  startProduction(factoryTx: number, factoryTy: number, unitType: ProducibleUnitType): ProductionCommandResult {
    const result = startProductionSystem(this.state, factoryTx, factoryTy, unitType);
    this.publishUiState();
    return result;
  }

  private debugSetMatter(value: number): void {
    this.state.economy.resources.matter = Math.max(0, Math.min(value, this.state.economy.resources.matterCap));
    this.publishUiState();
  }

  private debugAdvanceConstruction(seconds: number): void {
    this.update(seconds);
  }

  private loop(now: number): void {
    const dt = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;
    this.update(dt);
    this.ticks++;
    // Only pass prev positions when spritesheet flag is ON — direction bookkeeping
    // is visual-only and irrelevant when rendering with fallback geometry.
    const prevPositions = FE_CIVIL_8X8_256_SHEETS_ENABLED
      ? this.prevHarvesterPositions
      : (EMPTY_PREV_POSITIONS as ReadonlyMap<number, { tx: number; ty: number }>);
    render(this.ctx, this.state.map, this.camera, this.assets, this.state.economy, this.state.power, this.state.harvesters, this.ticks, prevPositions);
    // Snapshot current harvester positions for next frame's direction computation
    // only when the spritesheet flag is ON (no point burning cycles otherwise).
    if (FE_CIVIL_8X8_256_SHEETS_ENABLED) {
      this.prevHarvesterPositions.clear();
      for (let i = 0; i < this.state.harvesters.length; i++) {
        const h = this.state.harvesters[i]!;
        this.prevHarvesterPositions.set(i, { tx: h.tx, ty: h.ty });
      }
    }
    this.animFrameId = requestAnimationFrame(this.loop.bind(this));
  }

  private update(dt: number): void {
    let dx = 0;
    let dy = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) dy -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) dy += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) dx -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) dx += 1;
    if (dx !== 0 || dy !== 0) this.camera.panDirection(dx, dy, dt);

    runSystems(this.state, dt);

    this.publishUiState();

    this.publishTestHooks();
  }

  private publishUiState(): void {
    this.onEconomyUpdate?.(this.state.economy);
    this.onPowerUpdate?.(this.state.power);
    this.onControlUpdate?.(this.state.control);
    this.onConstructionUpdate?.({
      builderBusy: this.state.map.builders.some((builder) => builder.busy),
      matter: this.state.economy.resources.matter,
      statusMessage: this.state.constructionStatusMessage,
      sites: this.state.map.constructionSites,
    });
    this.onProductionUpdate?.({
      factories: this.state.production.factories,
      economy: this.state.economy,
      control: this.state.control,
      power: this.state.power,
    });
  }

  private publishTestHooks(): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__cameraPos = { x: this.camera.x, y: this.camera.y };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__economyState = {
      faction: this.state.economy.faction,
      raw: this.state.economy.resources.raw,
      matter: this.state.economy.resources.matter,
      elements: { ...this.state.economy.resources.elements },
      activeElement: getFactionElement(this.state.economy, this.state.economy.faction),
      rawCap: this.state.economy.resources.rawCap,
      matterCap: this.state.economy.resources.matterCap,
      elementCap: this.state.economy.resources.elementCap,
      separators: this.state.economy.separators.map((s) => ({
        tx: s.tx,
        ty: s.ty,
        progress: s.progress,
        active: s.active,
      })),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__powerState = {
      totalSupply: this.state.power.totalSupply,
      totalDemand: this.state.power.totalDemand,
      netPower: this.state.power.netPower,
      buildings: this.state.power.buildings.map((b) => ({
        tx: b.tx,
        ty: b.ty,
        type: b.type,
        online: b.online,
      })),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__controlState = {
      current: this.state.control.current,
      cap: this.state.control.cap,
      used: this.state.control.used,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__constructionState = {
      builderBusy: this.state.map.builders.some((builder) => builder.busy),
      builders: this.state.map.builders.map((builder) => ({
        tx: builder.tx,
        ty: builder.ty,
        busy: builder.busy,
      })),
      sites: this.state.map.constructionSites.map((site) => ({
        tx: site.tx,
        ty: site.ty,
        type: site.type,
        progress: site.progress,
      })),
      statusMessage: this.state.constructionStatusMessage,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__harvesterState = {
      harvesters: this.state.harvesters.map((h) => ({
        tx: h.tx,
        ty: h.ty,
        phase: h.phase,
        targetNodeIndex: h.targetNodeIndex,
        gatherProgress: h.gatherProgress,
        carry: h.carry,
      })),
      resourceNodes: this.state.resourceNodes.map((n) => ({
        tx: n.tx,
        ty: n.ty,
        type: n.type,
        infinite: n.infinite,
        remaining: n.remaining,
      })),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__productionState = {
      factories: this.state.production.factories.map((f) => ({
        tx: f.tx,
        ty: f.ty,
        queue: f.queue.map((item) => ({
          unitType: item.unitType,
          elapsed: item.elapsed,
          duration: item.duration,
          progress: item.progress,
          completed: item.completed,
        })),
      })),
    };

    if (import.meta.env.MODE === 'test') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__constructionTest = {
        setMatter: (value: number) => this.debugSetMatter(value),
        advanceConstruction: (seconds: number) => this.debugAdvanceConstruction(seconds),
        startConstruction: (buildingType: BuildingType) => this.startConstruction(buildingType),
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__productionTest = {
        startProduction: (factoryTx: number, factoryTy: number, unitType: ProducibleUnitType) =>
          this.startProduction(factoryTx, factoryTy, unitType),
      };
    }
  }

  private resolveConstructionMessage(result: ConstructionCommandResultType): string {
    if (result.ok && result.site) {
      const definition = BUILDING_DEFINITIONS[result.buildingType];
      return `${definition.label} строится на (${result.site.tx}, ${result.site.ty}).`;
    }

    if (result.reason === 'busy') return 'Строитель уже занят.';
    if (result.reason === 'insufficient-matter') return 'Недостаточно материи для строительства.';
    return 'Не удалось найти место для строительства.';
  }

  private onKeyDown(e: KeyboardEvent): void { this.keys.add(e.code); }
  private onKeyUp(e: KeyboardEvent): void { this.keys.delete(e.code); }

  private onMouseDown(e: MouseEvent): void {
    if (e.button === 1 || e.button === 2) {
      this.isPanning = true;
      this.panStartX = e.clientX;
      this.panStartY = e.clientY;
      this.camPanStartX = this.camera.x;
      this.camPanStartY = this.camera.y;
      this.canvas.style.cursor = 'grabbing';
    }
  }

  private onMouseMove(e: MouseEvent): void {
    if (!this.isPanning) return;
    const dx = e.clientX - this.panStartX;
    const dy = e.clientY - this.panStartY;
    this.camera.x = this.camPanStartX - dx / this.camera.zoom;
    this.camera.y = this.camPanStartY - dy / this.camera.zoom;
  }

  private onMouseUp(): void {
    if (this.isPanning) {
      this.isPanning = false;
      this.canvas.style.cursor = 'grab';
    }
  }

  private onWheel(e: WheelEvent): void {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -1 : 1;
    const rect = this.canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    this.camera.zoomAt(delta, cx, cy, this.canvas.width, this.canvas.height);
  }

  private onResize(): void {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }
}
