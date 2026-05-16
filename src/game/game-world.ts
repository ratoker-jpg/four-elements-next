/** GameWorld: owns render loop, camera, map, assets, economy, power, control, and input for the game screen. */

import { ASSET_MANIFEST, MAP_SIZE_STANDARD, MAP_SIZE_LARGE } from '../core/constants.js';
import { tileToScreen } from '../core/coordinates.js';
import { AssetStore } from '../core/assets.js';
import { generateMap } from './mapgen.js';
import type { MapData, FactionId } from './map-types.js';
import { Camera } from '../render/camera.js';
import { render } from '../render/renderer.js';
import {
  createEconomyState,
  tickEconomy,
  getFactionElement,
  applyCompletedBuildingToEconomy,
  getSeparatorPositions,
  getStorageCount,
  type EconomyState,
  type ReadonlyEconomyState,
} from '../systems/economy.js';
import {
  createPowerState,
  tickPower,
  isBuildingOnline,
  addBuildingToPowerState,
  type PowerState,
  type ReadonlyPowerState,
} from '../systems/power.js';
import {
  createControlState,
  tickControl,
  type ControlState,
  type ReadonlyControlState,
} from '../systems/control.js';
import { BUILDING_DEFINITIONS } from '../config/buildings.js';
import {
  BUILDER_CONTROL_COST,
  startConstruction,
  tickConstruction,
  type ConstructionCommandResult,
} from '../systems/construction.js';
import type { BuildingType, ConstructionSitePlacement } from './map-types.js';

/** Map the UI map-size string to a grid dimension. */
function resolveMapSize(mapSize: string): number {
  return mapSize === 'large' ? MAP_SIZE_LARGE : MAP_SIZE_STANDARD;
}

export class GameWorld {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private camera: Camera;
  private map: MapData;
  private assets: AssetStore;
  private economy: EconomyState;
  private power: PowerState;
  private control: ControlState;
  private animFrameId: number | null = null;
  private lastTime: number = 0;
  private keys = new Set<string>();
  private isPanning = false;
  private panStartX = 0;
  private panStartY = 0;
  private camPanStartX = 0;
  private camPanStartY = 0;
  private constructionStatusMessage = 'Builder готов к строительству.';

  /** Callbacks invoked each frame for HUD updates. */
  onEconomyUpdate?: (state: ReadonlyEconomyState) => void;
  onPowerUpdate?: (state: ReadonlyPowerState) => void;
  onControlUpdate?: (state: ReadonlyControlState) => void;
  onConstructionUpdate?: (state: {
    builderBusy: boolean;
    matter: number;
    statusMessage: string;
    sites: ReadonlyArray<ConstructionSitePlacement>;
  }) => void;

  // Bound handlers for cleanup
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

    // Resolve "random" faction immediately at game start
    const factions: FactionId[] = ['cyan', 'green', 'yellow', 'purple'];
    const resolvedFaction: FactionId = faction === 'random'
      ? factions[Math.floor(Math.random() * factions.length)]!
      : faction;

    const size = resolveMapSize(mapSize);
    this.assets = new AssetStore();
    this.map = generateMap(size, size, resolvedFaction);

    // Build economy state from building placements
    const separatorPositions = getSeparatorPositions(this.map.buildings);
    const storageCount = getStorageCount(this.map.buildings);
    this.economy = createEconomyState(separatorPositions, storageCount, resolvedFaction);

    // Build power state from buildings + HQ
    this.power = createPowerState(this.map.hq, this.map.buildings);

    // Build control state from online Command Relays
    const relayOnlineCount = this.power.buildings.filter(
      (b) => b.type === 'command-relay' && b.online,
    ).length;
    this.control = createControlState(
      this.map.buildings.filter((b) => b.type === 'command-relay').length,
      relayOnlineCount,
      this.map.builders.length * BUILDER_CONTROL_COST,
    );

    const hqScreen = tileToScreen(
      this.map.hq.tx + 1.5,
      this.map.hq.ty + 1.5,
    );
    this.camera = new Camera(hqScreen.x, hqScreen.y);

    // Bind event handlers
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
    // Clean up testing hooks
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
    delete (window as any).__constructionDebug;
  }

  /** Read-only accessors for HUD and tests. */
  getEconomyState(): ReadonlyEconomyState { return this.economy; }
  getPowerState(): ReadonlyPowerState { return this.power; }
  getControlState(): ReadonlyControlState { return this.control; }

  startConstruction(buildingType: BuildingType): ConstructionCommandResult {
    const result = startConstruction(this.map, this.economy, buildingType);
    this.constructionStatusMessage = this.resolveConstructionMessage(result);
    this.publishUiState();
    return result;
  }

  debugSetMatter(value: number): void {
    this.economy.resources.matter = Math.max(0, Math.min(value, this.economy.resources.matterCap));
    this.publishUiState();
  }

  debugAdvanceConstruction(seconds: number): void {
    this.update(seconds);
  }

  private loop(now: number): void {
    const dt = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;
    this.update(dt);
    render(this.ctx, this.map, this.camera, this.assets, this.economy, this.power);
    this.animFrameId = requestAnimationFrame(this.loop.bind(this));
  }

  private update(dt: number): void {
    // Camera input
    let dx = 0;
    let dy = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) dy -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) dy += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) dx -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) dx += 1;
    if (dx !== 0 || dy !== 0) this.camera.panDirection(dx, dy, dt);

    const constructionResult = tickConstruction(this.map, dt);
    for (const building of constructionResult.completedBuildings) {
      applyCompletedBuildingToEconomy(this.economy, building);
      addBuildingToPowerState(this.power, building);
      const definition = BUILDING_DEFINITIONS[building.type];
      this.constructionStatusMessage = `${definition.label} построен. Builder свободен.`;
    }

    // Power tick
    tickPower(this.power);

    // Control tick — recalculate based on online relays
    const relayOnlineCount = this.power.buildings.filter(
      (b) => b.type === 'command-relay' && b.online,
    ).length;
    tickControl(this.control, relayOnlineCount);

    // Economy tick — build separator online map from power state
    const separatorOnlineMap = new Map<string, boolean>();
    for (const sep of this.economy.separators) {
      separatorOnlineMap.set(`${sep.tx},${sep.ty}`, isBuildingOnline(this.power, sep.tx, sep.ty));
    }
    tickEconomy(this.economy, dt, separatorOnlineMap);

    // Notify HUDs
    this.onEconomyUpdate?.(this.economy);
    this.onPowerUpdate?.(this.power);
    this.onControlUpdate?.(this.control);
    this.onConstructionUpdate?.({
      builderBusy: this.map.builders.some((builder) => builder.busy),
      matter: this.economy.resources.matter,
      statusMessage: this.constructionStatusMessage,
      sites: this.map.constructionSites,
    });

    // Expose testing hooks (cleaned up in destroy)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__cameraPos = { x: this.camera.x, y: this.camera.y };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__economyState = {
      faction: this.economy.faction,
      raw: this.economy.resources.raw,
      matter: this.economy.resources.matter,
      elements: { ...this.economy.resources.elements },
      activeElement: getFactionElement(this.economy, this.economy.faction),
      rawCap: this.economy.resources.rawCap,
      matterCap: this.economy.resources.matterCap,
      elementCap: this.economy.resources.elementCap,
      separators: this.economy.separators.map((s) => ({
        tx: s.tx,
        ty: s.ty,
        progress: s.progress,
        active: s.active,
      })),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__powerState = {
      totalSupply: this.power.totalSupply,
      totalDemand: this.power.totalDemand,
      netPower: this.power.netPower,
      buildings: this.power.buildings.map((b) => ({
        tx: b.tx,
        ty: b.ty,
        type: b.type,
        online: b.online,
      })),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__controlState = {
      current: this.control.current,
      cap: this.control.cap,
      used: this.control.used,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__constructionState = {
      builderBusy: this.map.builders.some((builder) => builder.busy),
      builders: this.map.builders.map((builder) => ({
        tx: builder.tx,
        ty: builder.ty,
        busy: builder.busy,
      })),
      sites: this.map.constructionSites.map((site) => ({
        tx: site.tx,
        ty: site.ty,
        type: site.type,
        progress: site.progress,
      })),
      statusMessage: this.constructionStatusMessage,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__constructionDebug = {
      setMatter: (value: number) => this.debugSetMatter(value),
      advanceConstruction: (seconds: number) => this.debugAdvanceConstruction(seconds),
      startConstruction: (buildingType: BuildingType) => this.startConstruction(buildingType),
    };
  }

  private publishUiState(): void {
    this.onEconomyUpdate?.(this.economy);
    this.onPowerUpdate?.(this.power);
    this.onControlUpdate?.(this.control);
    this.onConstructionUpdate?.({
      builderBusy: this.map.builders.some((builder) => builder.busy),
      matter: this.economy.resources.matter,
      statusMessage: this.constructionStatusMessage,
      sites: this.map.constructionSites,
    });
  }

  private resolveConstructionMessage(result: ConstructionCommandResult): string {
    if (result.ok && result.site) {
      const definition = BUILDING_DEFINITIONS[result.buildingType];
      return `${definition.label} строится на (${result.site.tx}, ${result.site.ty}).`;
    }

    if (result.reason === 'busy') return 'Builder уже занят.';
    if (result.reason === 'insufficient-matter') return 'Недостаточно Matter для строительства.';
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
