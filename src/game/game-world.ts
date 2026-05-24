/** GameWorld: owns render loop, camera, assets, GameState, input, and UI callbacks. */

import { ASSET_MANIFEST, CIVIL_8X8_256_MANIFEST, FE_CIVIL_8X8_256_SHEETS_ENABLED, BUILDING_ASSET_MANIFEST, FE_BUILDING_SPRITES_ENABLED, HQ_FOOTPRINT } from '../core/constants.js';
import { tileToScreen, screenToTile } from '../core/coordinates.js';
import { AssetStore } from '../core/assets.js';
import type { FactionId, BuildingType, ConstructionSitePlacement, ResourceType, ObstacleType, MapData } from './map-types.js';
import type { MapgenPresetId } from './mapgen-presets.js';
import { DEFAULT_PRESET_ID } from './mapgen-presets.js';
import { RESOURCE_FOOTPRINTS, OBSTACLE_FOOTPRINTS } from './map-types.js';
import type { ProducibleUnitType, ReadonlyProductionState } from '../systems/production.js';
import type { GameState } from './game-state.js';
import { createGameState, createGameStateFromMap } from './game-state.js';
import { Camera } from '../render/camera.js';
import { render } from '../render/renderer.js';
import { toggleDebugOverlay } from '../render/debug-overlay.js';
import { installAssetPreviewKey } from '../dev/asset-preview.js';
import {
  getFactionElement,
  type ReadonlyEconomyState,
} from '../systems/economy.js';
import { RESOURCE_AMOUNTS } from '../systems/harvesting.js';
import type { ReadonlyPowerState } from '../systems/power.js';
import type { ReadonlyControlState } from '../systems/control.js';
import { BUILDING_DEFINITIONS } from '../config/buildings.js';
import {
  startConstruction as startConstructionSystem,
  type ConstructionCommandResult as ConstructionCommandResultType,
  buildOccupiedTileSet,
} from '../systems/construction.js';
import {
  startProduction as startProductionSystem,
  type ProductionCommandResult,
} from '../systems/production.js';
import { runSystems } from '../systems/system-runner.js';
import { isDevPanelAllowed, buildDevPanelState, type DevPanelState, type DevPanelActions } from '../dev/dev-panel.js';
import { getOverlayToggles, setOverlayToggle, type OverlayToggles } from '../dev/dev-overlays.js';
import { createPathfindingTelemetryAPI, invalidatePassabilityCache } from '../systems/path-telemetry.js';

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
  onDevPanelUpdate?: (state: DevPanelState) => void;

  private boundKeyDown: (e: KeyboardEvent) => void;
  private boundKeyUp: (e: KeyboardEvent) => void;
  private boundMouseDown: (e: MouseEvent) => void;
  private boundMouseMove: (e: MouseEvent) => void;
  private boundMouseUp: () => void;
  private boundWheel: (e: WheelEvent) => void;
  private boundResize: () => void;

  constructor(canvas: HTMLCanvasElement, mapSize: string, faction: FactionId | 'random', seed: number = 42, mapgenPresetId: MapgenPresetId = DEFAULT_PRESET_ID) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Cannot get 2D context');
    this.ctx = ctx;

    this.state = createGameState(mapSize, faction, seed, mapgenPresetId);
    this.assets = new AssetStore();

    // Invalidate passability cache on new game — fresh map means old grid is stale
    invalidatePassabilityCache();

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

  /** Create a GameWorld from a custom MapData (editor-launched game).
   *  Uses createGameStateFromMap which deep-clones the input MapData.
   *  The existing constructor path (seed/preset) remains unchanged. */
  static fromCustomMap(canvas: HTMLCanvasElement, mapData: MapData, faction: FactionId): GameWorld {
    const world = Object.create(GameWorld.prototype) as GameWorld;
    world.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Cannot get 2D context');
    world.ctx = ctx;

    world.state = createGameStateFromMap(mapData, faction);
    world.assets = new AssetStore();

    // Invalidate passability cache on custom map — fresh map means old grid is stale
    invalidatePassabilityCache();

    const hqScreen = tileToScreen(world.state.map.hq.tx + 1.5, world.state.map.hq.ty + 1.5);
    world.camera = new Camera(hqScreen.x, hqScreen.y);

    world.animFrameId = null;
    world.lastTime = 0;
    world.keys = new Set<string>();
    world.isPanning = false;
    world.panStartX = 0;
    world.panStartY = 0;
    world.camPanStartX = 0;
    world.camPanStartY = 0;
    world.ticks = 0;
    world.prevHarvesterPositions = new Map<number, { tx: number; ty: number }>();

    world.onEconomyUpdate = undefined;
    world.onPowerUpdate = undefined;
    world.onControlUpdate = undefined;
    world.onConstructionUpdate = undefined;
    world.onProductionUpdate = undefined;
    world.onDevPanelUpdate = undefined;

    world.boundKeyDown = world.onKeyDown.bind(world);
    world.boundKeyUp = world.onKeyUp.bind(world);
    world.boundMouseDown = world.onMouseDown.bind(world);
    world.boundMouseMove = world.onMouseMove.bind(world);
    world.boundWheel = world.onWheel.bind(world);
    world.boundMouseUp = world.onMouseUp.bind(world);
    world.boundResize = world.onResize.bind(world);

    return world;
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
    installAssetPreviewKey();
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
    delete (window as any).__territoryState;
    delete (window as any).__pathfindingTelemetry;

    if (import.meta.env.MODE === 'test') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).__constructionTest;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).__productionTest;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).__devActions;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).__overlayToggles;
    }
  }

  getEconomyState(): ReadonlyEconomyState { return this.state.economy; }
  getPowerState(): ReadonlyPowerState { return this.state.power; }
  getControlState(): ReadonlyControlState { return this.state.control; }

  startConstruction(buildingType: BuildingType): ConstructionCommandResultType {
    const result = startConstructionSystem(this.state.map, this.state.economy, buildingType, this.state.resourceNodes);
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
    if (value > this.state.economy.resources.matterCap) {
      this.state.economy.resources.matterCap = value;
    }
    this.state.economy.resources.matter = Math.max(0, Math.min(value, this.state.economy.resources.matterCap));
    this.publishUiState();
  }

  private debugAdvanceConstruction(seconds: number): void {
    this.update(seconds);
  }

  /** Dev panel: add raw resources. Clamped to rawCap. */
  debugAddRaw(amount: number): void {
    const r = this.state.economy.resources;
    r.raw = Math.min(r.raw + amount, r.rawCap);
    this.publishUiState();
  }

  /** Dev panel: add matter. Clamped to matterCap. */
  debugAddMatter(amount: number): void {
    const r = this.state.economy.resources;
    r.matter = Math.min(r.matter + amount, r.matterCap);
    this.publishUiState();
  }

  /** Dev panel: add elementUnits to active faction element. Clamped to elementCap. */
  debugAddElementUnits(elementUnits: number): void {
    const r = this.state.economy.resources;
    const faction = this.state.economy.faction;
    r.elements[faction] = Math.min(r.elements[faction] + elementUnits, r.elementCap);
    this.publishUiState();
  }

  /** Dev panel: fast-forward time by running systems in bounded 1-second chunks. */
  debugFastForward(seconds: number): void {
    const chunkSize = 1;
    let remaining = seconds;
    while (remaining > 0) {
      const dt = Math.min(remaining, chunkSize);
      this.update(dt);
      remaining -= dt;
    }
  }

  /** Dev panel: jump camera to HQ center. */
  debugCameraToHq(): void {
    const hqScreen = tileToScreen(this.state.map.hq.tx + 1.5, this.state.map.hq.ty + 1.5);
    this.camera.x = hqScreen.x;
    this.camera.y = hqScreen.y;
  }

  /** Dev panel: jump camera to map center. */
  debugCameraToCenter(): void {
    const centerScreen = tileToScreen(this.state.map.width / 2, this.state.map.height / 2);
    this.camera.x = centerScreen.x;
    this.camera.y = centerScreen.y;
  }

  /** Dev panel: set all resources to their caps. */
  debugMaxAll(): void {
    const r = this.state.economy.resources;
    r.raw = r.rawCap;
    r.matter = r.matterCap;
    r.elements[this.state.economy.faction] = r.elementCap;
    this.publishUiState();
  }

  /** Dev panel: set all resources to zero. */
  debugZeroAll(): void {
    const r = this.state.economy.resources;
    r.raw = 0;
    r.matter = 0;
    r.elements[this.state.economy.faction] = 0;
    this.publishUiState();
  }

  /** Dev panel: spawn a builder near HQ if a free tile exists. Dev-only — ignores economy/control costs. */
  debugSpawnBuilder(): void {
    const tile = this.findFreeTileNearHq();
    if (!tile) return;
    this.state.map.builders.push({
      tx: tile.tx,
      ty: tile.ty,
      busy: false,
      phase: 'idle',
      path: [],
      pathIndex: 0,
      ftx: tile.tx + 0.5,
      fty: tile.ty + 0.5,
      targetTx: tile.tx,
      targetTy: tile.ty,
      assignedSiteId: -1,
    });
    this.publishUiState();
  }

  /** Dev panel: spawn a harvester near HQ if a free tile exists. Dev-only — ignores economy/control costs. */
  debugSpawnHarvester(): void {
    const tile = this.findFreeTileNearHq();
    if (!tile) return;
    this.state.harvesters.push({
      tx: tile.tx + 0.5,
      ty: tile.ty + 0.5,
      phase: 'idle',
      targetNodeIndex: -1,
      gatherProgress: 0,
      carry: 0,
      targetDropoffTx: 0,
      targetDropoffTy: 0,
      path: [],
      pathIndex: 0,
    });
    this.publishUiState();
  }

  /** Dev panel: add a 1×1 obstacle at camera center tile. No-op if tile is occupied. */
  debugAddObstacle(): void {
    const tile = this.cameraCenterTile();
    if (!tile) return;
    const occupied = buildOccupiedTileSet(this.state.map, this.state.resourceNodes);
    if (occupied.has(`${tile.tx},${tile.ty}`)) return;
    this.state.map.obstacles.push({
      tx: tile.tx,
      ty: tile.ty,
      type: 'rock-cluster' as ObstacleType,
      footprint: OBSTACLE_FOOTPRINTS['rock-cluster'],
    });
    this.publishUiState();
  }

  /** Dev panel: add a 1×1 resource at camera center tile. Also creates matching ResourceNodeState. No-op if tile is occupied. */
  debugAddResource(): void {
    const tile = this.cameraCenterTile();
    if (!tile) return;
    const occupied = buildOccupiedTileSet(this.state.map, this.state.resourceNodes);
    if (occupied.has(`${tile.tx},${tile.ty}`)) return;
    const rType: ResourceType = 'small';
    this.state.map.resources.push({
      tx: tile.tx,
      ty: tile.ty,
      type: rType,
      footprint: RESOURCE_FOOTPRINTS[rType],
    });
    this.state.resourceNodes.push({
      tx: tile.tx,
      ty: tile.ty,
      type: rType,
      infinite: false,
      remaining: RESOURCE_AMOUNTS[rType],
    });
    this.publishUiState();
  }

  /** Dev panel: clear all construction sites, refund matter (clamped to cap), reset builders to idle. */
  debugClearConstruction(): void {
    const map = this.state.map;
    const r = this.state.economy.resources;
    // Refund matter for each cancelled site
    for (const site of map.constructionSites) {
      const costMatter = BUILDING_DEFINITIONS[site.type].costMatter;
      r.matter = Math.min(r.matter + costMatter, r.matterCap);
    }
    map.constructionSites.length = 0;
    // Reset all builders to idle
    for (const builder of map.builders) {
      builder.busy = false;
      builder.phase = 'idle';
      builder.path = [];
      builder.pathIndex = 0;
      builder.assignedSiteId = -1;
    }
    this.publishUiState();
  }

  /** Find a free tile in the ring around HQ using the occupied-tile set. */
  private findFreeTileNearHq(): { tx: number; ty: number } | null {
    const map = this.state.map;
    const hq = map.hq;
    const occupied = buildOccupiedTileSet(map, this.state.resourceNodes);
    // Also mark runtime harvester positions as occupied so spawned units
    // don't land on the same tile as an existing harvester.
    for (const h of this.state.harvesters) {
      occupied.add(`${Math.floor(h.tx)},${Math.floor(h.ty)}`);
    }
    for (let ty = hq.ty - 1; ty <= hq.ty + HQ_FOOTPRINT; ty++) {
      for (let tx = hq.tx - 1; tx <= hq.tx + HQ_FOOTPRINT; tx++) {
        // Skip tiles inside HQ footprint
        if (tx >= hq.tx && tx < hq.tx + HQ_FOOTPRINT && ty >= hq.ty && ty < hq.ty + HQ_FOOTPRINT) continue;
        if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) continue;
        if (!occupied.has(`${tx},${ty}`)) return { tx, ty };
      }
    }
    return null;
  }

  /** Get the tile coordinate at camera center, clamped to map bounds. */
  private cameraCenterTile(): { tx: number; ty: number } | null {
    const t = screenToTile(this.camera.x, this.camera.y);
    const tx = Math.floor(t.x);
    const ty = Math.floor(t.y);
    if (tx < 0 || ty < 0 || tx >= this.state.map.width || ty >= this.state.map.height) return null;
    return { tx, ty };
  }

  /** Dev panel: find a guaranteed free tile on the map. Scans from edges inward. Returns null if map is full. */
  debugFindFreeTile(): { tx: number; ty: number } | null {
    const map = this.state.map;
    const occupied = buildOccupiedTileSet(map, this.state.resourceNodes);
    for (const h of this.state.harvesters) {
      occupied.add(`${Math.floor(h.tx)},${Math.floor(h.ty)}`);
    }
    // Scan from map edges inward — edges are least likely to be occupied
    for (let ring = 0; ring < Math.max(map.width, map.height); ring++) {
      for (let ty = ring; ty < map.height - ring; ty++) {
        for (let tx = ring; tx < map.width - ring; tx++) {
          // Only check the ring border, not interior tiles already checked
          if (ty !== ring && ty !== map.height - ring - 1 && tx !== ring && tx !== map.width - ring - 1) continue;
          if (!occupied.has(`${tx},${ty}`)) return { tx, ty };
        }
      }
    }
    return null;
  }

  /** Dev panel: move camera to a specific tile coordinate. */
  debugMoveCameraToTile(tx: number, ty: number): void {
    const screen = tileToScreen(tx + 0.5, ty + 0.5);
    this.camera.x = screen.x;
    this.camera.y = screen.y;
  }

  /** Scenario: max resources, spawn one builder near HQ, camera to HQ. */
  debugPrepareBuilderTest(): void {
    this.debugMaxAll();
    this.debugSpawnBuilder();
    this.debugCameraToHq();
    this.publishUiState();
  }

  /** Scenario: max resources, ensure ≥3 harvesters, build separator via real flow, fast-forward. */
  debugPrepareEconomyTest(): void {
    this.debugMaxAll();
    // Ensure at least 3 harvesters (bounded loop — spawnHarvester is a no-op
    // when no free tile exists, so we must guard against infinite looping)
    const targetHarvesters = 3;
    let attempts = 0;
    while (this.state.harvesters.length < targetHarvesters && attempts < targetHarvesters) {
      const before = this.state.harvesters.length;
      this.debugSpawnHarvester();
      attempts++;
      if (this.state.harvesters.length === before) break; // no free tile
    }
    // Start separator through the real construction flow
    const result = this.startConstruction('separator');
    if (result.ok) {
      // Advance enough for builder movement + build time + margin
      this.debugFastForward(35);
    }
    this.debugCameraToHq();
    this.publishUiState();
  }

  /** Get dev panel actions object (for wiring to the panel UI). */
  getDevPanelActions(): DevPanelActions {
    return {
      addRaw: (amount: number) => this.debugAddRaw(amount),
      addMatter: (amount: number) => this.debugAddMatter(amount),
      addElementUnits: (elementUnits: number) => this.debugAddElementUnits(elementUnits),
      fastForward: (seconds: number) => this.debugFastForward(seconds),
      cameraToHq: () => this.debugCameraToHq(),
      cameraToCenter: () => this.debugCameraToCenter(),
      maxAll: () => this.debugMaxAll(),
      zeroAll: () => this.debugZeroAll(),
      spawnBuilder: () => this.debugSpawnBuilder(),
      spawnHarvester: () => this.debugSpawnHarvester(),
      addObstacle: () => this.debugAddObstacle(),
      addResource: () => this.debugAddResource(),
      clearConstruction: () => this.debugClearConstruction(),
      prepareBuilderTest: () => this.debugPrepareBuilderTest(),
      prepareEconomyTest: () => this.debugPrepareEconomyTest(),
    };
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
    render(this.ctx, this.state.map, this.state.visualSeed, this.camera, this.assets, this.state.economy, this.state.power, this.state.harvesters, this.ticks, prevPositions, this.state.territory, this.state.resourceNodes);
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

    // Update dev panel if allowed and callback is wired
    if (isDevPanelAllowed() && this.onDevPanelUpdate) {
      const devState = buildDevPanelState(this.state, this.camera.x, this.camera.y, this.camera.zoom);
      this.onDevPanelUpdate(devState);
    }
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
        phase: builder.phase,
        pathLength: builder.path.length,
        pathIndex: builder.pathIndex,
        ftx: builder.ftx,
        fty: builder.fty,
        assignedSiteId: builder.assignedSiteId,
      })),
      sites: this.state.map.constructionSites.map((site) => ({
        tx: site.tx,
        ty: site.ty,
        type: site.type,
        progress: site.progress,
        builderIndex: site.builderIndex,
        id: site.id,
        pending: site.pending,
      })),
      statusMessage: this.state.constructionStatusMessage,
      cancelledSitesCount: this.state.constructionCancelledCount,
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
        targetDropoffTx: h.targetDropoffTx,
        targetDropoffTy: h.targetDropoffTy,
        pathLength: h.path.length,
        pathIndex: h.pathIndex,
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__pathfindingTelemetry = createPathfindingTelemetryAPI();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__territoryState = {
      width: this.state.territory.width,
      height: this.state.territory.height,
      claimedCount: this.state.territory.tiles.filter((t) => t.progress > 0).length,
      sources: this.state.territory.sources.map((s) => ({
        cx: s.cx,
        cy: s.cy,
        footprintClaimed: s.footprintClaimed,
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__devActions = {
        addRaw: (amount: number) => this.debugAddRaw(amount),
        addMatter: (amount: number) => this.debugAddMatter(amount),
        addElementUnits: (elementUnits: number) => this.debugAddElementUnits(elementUnits),
        fastForward: (seconds: number) => this.debugFastForward(seconds),
        cameraToHq: () => this.debugCameraToHq(),
        cameraToCenter: () => this.debugCameraToCenter(),
        maxAll: () => this.debugMaxAll(),
        zeroAll: () => this.debugZeroAll(),
        spawnBuilder: () => this.debugSpawnBuilder(),
        spawnHarvester: () => this.debugSpawnHarvester(),
        addObstacle: () => this.debugAddObstacle(),
        addResource: () => this.debugAddResource(),
        clearConstruction: () => this.debugClearConstruction(),
        prepareBuilderTest: () => this.debugPrepareBuilderTest(),
        prepareEconomyTest: () => this.debugPrepareEconomyTest(),
        moveCameraToTile: (tx: number, ty: number) => this.debugMoveCameraToTile(tx, ty),
        findFreeTile: () => this.debugFindFreeTile(),
      };
      // Overlay toggle access for E2E tests
      (window as any).__overlayToggles = {
        get: () => ({ ...getOverlayToggles() }),
        set: (key: string, value: boolean) => setOverlayToggle(key as keyof OverlayToggles, value),
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
    if (result.reason === 'no-route') return 'Нет прохода к месту строительства.';
    return 'Не удалось найти место для строительства.';
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (e.code === 'F3') {
      e.preventDefault();
      toggleDebugOverlay();
      return;
    }
    this.keys.add(e.code);
  }
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
