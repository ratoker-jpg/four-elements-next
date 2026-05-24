import Phaser from 'phaser';
import { getBuildingFootprint } from '../config/buildings.js';
import {
  ASSET_MANIFEST,
  BG_COLOR,
  BUILDING_ASSET_MANIFEST,
  CIVIL_8X8_256_MANIFEST,
  GRID_COLOR,
  HQ_FOOTPRINT,
  SPRITE_PROFILES,
  TERRAIN_COLORS,
  TILE_H,
  TILE_W,
  assetPath,
  type SpriteProfile,
} from '../core/constants.js';
import { resolveDecorAsset, resolveObstacleAsset, resolveResourceAsset } from '../core/asset-variants.js';
import { tileToScreen, terrainWorldBounds, type TerrainWorldBounds } from '../core/coordinates.js';
import { RESOURCE_FOOTPRINTS, type BuildingType, type FactionId, type TerrainType } from '../game/map-types.js';
import { isBuildingOnline } from '../systems/power.js';
import { builderAnimColumn, directionToRow, harvesterAnimColumn } from '../render/spritesheet.js';
import { containFit } from '../render/contain-fit.js';
import type { ConstructionSitePlacement, ResourcePlacement } from '../game/map-types.js';
import type { WorldRenderer, WorldRenderSnapshot } from './types.js';
import { ObjectRegistry, type DisposableObject } from './object-registry.js';

const UNIT_FRAME_SIZE = 256;
const TERRAIN_STROKE = 0x000000;
const SHADOW_COLOR = 0x12100e;

const HQ_ASSET_KEYS: Record<FactionId, string> = {
  cyan: 'hq_cyan',
  green: 'hq_green',
  yellow: 'hq_yellow',
  purple: 'hq_purple',
};

function factionBuildingKey(faction: FactionId, type: BuildingType): string {
  return `building_${faction}_${type.replace(/-/g, '_')}`;
}

function builderKey(faction: FactionId): string {
  return `builder_${faction}`;
}

function harvesterKey(faction: FactionId): string {
  return `harvester_${faction}`;
}

function colorNumber(hex: string): number {
  return Number.parseInt(hex.replace('#', ''), 16);
}

function alphaFromRgba(value: string): number {
  const match = /rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*([0-9.]+)\s*\)/.exec(value);
  return match ? Number(match[1]) : 1;
}

function textureSize(textures: Phaser.Textures.TextureManager, key: string): { width: number; height: number } {
  const source = textures.get(key).getSourceImage() as { width?: number; height?: number };
  return {
    width: source.width ?? 0,
    height: source.height ?? 0,
  };
}

/** Produce a stable identity key for map-anchored entities. */
function entityKey(prefix: string, tx: number, ty: number): string {
  return `${prefix}_${tx}_${ty}`;
}

/** Renderer stats exposed via window test hook in test/dev mode. */
export interface PhaserRendererStats {
  readonly kind: 'phaser';
  readonly registrySizes: {
    readonly hq: number;
    readonly buildings: number;
    readonly constructionSites: number;
    readonly resources: number;
    readonly obstacles: number;
    readonly decor: number;
    readonly builders: number;
    readonly harvesters: number;
    readonly territory: number;
  };
  readonly terrainBuildCount: number;
  readonly terrainCached: boolean;
  /** World-space bounds of the terrain RenderTexture (includes negative-X isometric area). */
  readonly terrainBounds: TerrainWorldBounds | null;
}

class PhaserProductionScene extends Phaser.Scene {
  // Persistent registries — objects survive across frames
  private readonly hqRegistry = new ObjectRegistry<DisposableObject>();
  private readonly buildingRegistry = new ObjectRegistry<DisposableObject>();
  private readonly constructionRegistry = new ObjectRegistry<DisposableObject>();
  private readonly resourceRegistry = new ObjectRegistry<DisposableObject>();
  private readonly obstacleRegistry = new ObjectRegistry<DisposableObject>();
  private readonly decorRegistry = new ObjectRegistry<DisposableObject>();
  private readonly builderRegistry = new ObjectRegistry<DisposableObject>();
  private readonly harvesterRegistry = new ObjectRegistry<DisposableObject>();
  private readonly territoryRegistry = new ObjectRegistry<DisposableObject>();

  // Terrain cache
  private terrainRenderTexture: Phaser.GameObjects.RenderTexture | null = null;
  private terrainBuildCount = 0;
  private cachedMapIdentity: string = '';
  private cachedTerrainBounds: TerrainWorldBounds | null = null;

  // Shadow layer — redrawn each frame (lightweight, position-based)
  private shadowGraphics: Phaser.GameObjects.Graphics | null = null;

  private readonly readyPromise: Promise<void>;
  private resolveReady: (() => void) | null = null;
  private pendingSnapshot: WorldRenderSnapshot | null = null;

  constructor() {
    super('PhaserProductionRenderScene');
    this.readyPromise = new Promise((resolve) => {
      this.resolveReady = resolve;
    });
  }

  waitUntilReady(): Promise<void> {
    return this.readyPromise;
  }

  preload(): void {
    this.loadImages(ASSET_MANIFEST);
    this.loadImages(BUILDING_ASSET_MANIFEST);
    for (const [key, path] of Object.entries(CIVIL_8X8_256_MANIFEST)) {
      this.load.spritesheet(key, assetPath(path), {
        frameWidth: UNIT_FRAME_SIZE,
        frameHeight: UNIT_FRAME_SIZE,
      });
    }
  }

  create(): void {
    this.cameras.main.setBackgroundColor(BG_COLOR);
    this.shadowGraphics = this.add.graphics();
    this.shadowGraphics.setDepth(100);

    this.resolveReady?.();
    this.resolveReady = null;

    if (this.pendingSnapshot) {
      this.renderSnapshot(this.pendingSnapshot);
      this.pendingSnapshot = null;
    }
  }

  getStats(): PhaserRendererStats {
    return {
      kind: 'phaser',
      registrySizes: {
        hq: this.hqRegistry.size,
        buildings: this.buildingRegistry.size,
        constructionSites: this.constructionRegistry.size,
        resources: this.resourceRegistry.size,
        obstacles: this.obstacleRegistry.size,
        decor: this.decorRegistry.size,
        builders: this.builderRegistry.size,
        harvesters: this.harvesterRegistry.size,
        territory: this.territoryRegistry.size,
      },
      terrainBuildCount: this.terrainBuildCount,
      terrainCached: this.cachedMapIdentity !== '',
      terrainBounds: this.cachedTerrainBounds,
    };
  }

  renderSnapshot(snapshot: WorldRenderSnapshot): void {
    if (!this.shadowGraphics) {
      this.pendingSnapshot = snapshot;
      return;
    }

    this.syncCamera(snapshot);
    this.shadowGraphics.clear();
    this.syncTerrain(snapshot);
    this.syncTerritory(snapshot);
    this.syncHQ(snapshot);
    this.syncBuildings(snapshot);
    this.syncConstructionSites(snapshot);
    this.syncResources(snapshot);
    this.syncObstacles(snapshot);
    this.syncDecor(snapshot);
    this.syncBuilders(snapshot);
    this.syncHarvesters(snapshot);
  }

  // ── Terrain ──────────────────────────────────────────────────

  /** Compute a map identity string from dimensions + visual seed. */
  private mapIdentity(snapshot: WorldRenderSnapshot): string {
    return `${snapshot.map.width}x${snapshot.map.height}_${snapshot.visualSeed}_${snapshot.map.terrain.length}`;
  }

  private syncTerrain(snapshot: WorldRenderSnapshot): void {
    const identity = this.mapIdentity(snapshot);
    if (identity === this.cachedMapIdentity && this.terrainRenderTexture) {
      // Terrain unchanged — reuse cached RenderTexture
      return;
    }

    // Rebuild terrain RenderTexture
    if (this.terrainRenderTexture) {
      this.terrainRenderTexture.destroy();
      this.terrainRenderTexture = null;
    }

    // Compute full isometric terrain world bounds.
    // The isometric diamond has negative X on the left side (tiles with large ty, small tx)
    // so we must account for that when sizing and positioning the RenderTexture.
    const bounds = terrainWorldBounds(snapshot.map.width, snapshot.map.height);
    const rtWidth = Math.max(1, Math.ceil(bounds.maxX - bounds.minX));
    const rtHeight = Math.max(1, Math.ceil(bounds.maxY - bounds.minY));

    // Create a temporary Graphics object for terrain drawing.
    // We draw at shifted coordinates so all positions are non-negative within the RT.
    const graphics = this.add.graphics();
    const halfW = TILE_W / 2;
    const halfH = TILE_H / 2;
    const strokeAlpha = alphaFromRgba(GRID_COLOR);
    const shiftX = -bounds.minX;
    const shiftY = -bounds.minY;

    for (let ty = 0; ty < snapshot.map.height; ty++) {
      for (let tx = 0; tx < snapshot.map.width; tx++) {
        const terrainType: TerrainType = snapshot.map.terrain[ty]?.[tx] ?? 'sand';
        const fill = colorNumber(TERRAIN_COLORS[terrainType] ?? TERRAIN_COLORS.sand!);
        const center = tileToScreen(tx + 0.5, ty + 0.5);
        const sx = center.x + shiftX;
        const sy = center.y + shiftY;

        graphics.fillStyle(fill, 1);
        graphics.lineStyle(1, TERRAIN_STROKE, strokeAlpha);
        graphics.beginPath();
        graphics.moveTo(sx, sy - halfH);
        graphics.lineTo(sx + halfW, sy);
        graphics.lineTo(sx, sy + halfH);
        graphics.lineTo(sx - halfW, sy);
        graphics.closePath();
        graphics.fillPath();
        graphics.strokePath();
      }
    }

    // Bake into RenderTexture at (0,0) with shifted coords, then reposition to world bounds.
    const rt = this.add.renderTexture(0, 0, rtWidth, rtHeight);
    rt.setDepth(0);
    rt.setOrigin(0, 0);
    rt.draw(graphics);
    rt.setVisible(true);
    // Position the RT so its top-left corner is at (minX, minY) in world coordinates.
    // This makes the shifted drawing align correctly with the isometric world.
    rt.setPosition(bounds.minX, bounds.minY);

    graphics.destroy();

    this.terrainRenderTexture = rt;
    this.cachedMapIdentity = identity;
    this.cachedTerrainBounds = bounds;
    this.terrainBuildCount++;
  }

  // ── Territory ────────────────────────────────────────────────

  private syncTerritory(snapshot: WorldRenderSnapshot): void {
    const territory = snapshot.territory;
    if (!territory || territory.width <= 0 || territory.height <= 0) {
      // No territory data — clear registry
      this.territoryRegistry.clear((_key, obj) => obj.destroy());
      return;
    }

    const currentKeys: string[] = [];
    const tileData = new Map<string, { progress: number }>();

    for (let i = 0; i < territory.tiles.length; i++) {
      const tile = territory.tiles[i]!;
      if (tile.progress > 0) {
        const tx = i % territory.width;
        const ty = Math.floor(i / territory.width);
        const key = entityKey('terr', tx, ty);
        currentKeys.push(key);
        tileData.set(key, { progress: tile.progress });
      }
    }

    this.territoryRegistry.sync(
      currentKeys,
      (key) => {
        const data = tileData.get(key);
        const [_, txStr, tyStr] = key.split('_');
        const tx = Number(txStr);
        const ty = Number(tyStr);
        const center = tileToScreen(tx + 0.5, ty + 0.5);
        const alpha = Math.min(0.35, (data?.progress ?? 0) * 0.35);
        const graphics = this.add.graphics();
        graphics.setDepth(500 + (tx + ty) * 10);
        graphics.fillStyle(0x44aaff, alpha);
        graphics.beginPath();
        graphics.moveTo(center.x, center.y - TILE_H / 2);
        graphics.lineTo(center.x + TILE_W / 2, center.y);
        graphics.lineTo(center.x, center.y + TILE_H / 2);
        graphics.lineTo(center.x - TILE_W / 2, center.y);
        graphics.closePath();
        graphics.fillPath();
        return graphics;
      },
      (_key, _obj) => {
        // Territory tiles: update is a no-op for Stage 2 (progress changes are subtle)
      },
      (_key, obj) => obj.destroy(),
    );
  }

  // ── HQ ───────────────────────────────────────────────────────

  private syncHQ(snapshot: WorldRenderSnapshot): void {
    const hq = snapshot.map.hq;
    const key = entityKey('hq', hq.tx, hq.ty);
    const faction = hq.faction;
    const depth = this.entityDepth(hq.tx, hq.ty, HQ_FOOTPRINT);

    this.drawShadow(hq.tx, hq.ty, HQ_FOOTPRINT, 0.09);

    this.hqRegistry.sync(
      [key],
      (_k) => this.createProfileImage({
        key: HQ_ASSET_KEYS[faction],
        profileKey: 'hq_base',
        tx: hq.tx,
        ty: hq.ty,
        footprint: HQ_FOOTPRINT,
        depth,
        fallback: () => this.createFallbackBox(hq.tx, hq.ty, HQ_FOOTPRINT, '#d4a544', 'HQ'),
      }),
      (_k, obj) => {
        // HQ doesn't move, but depth may change if camera logic changes
        obj.setDepth(depth);
      },
      (_k, obj) => obj.destroy(),
    );
  }

  // ── Buildings ────────────────────────────────────────────────

  private syncBuildings(snapshot: WorldRenderSnapshot): void {
    const faction = snapshot.map.hq.faction;
    const currentKeys: string[] = [];

    for (const building of snapshot.map.buildings) {
      const key = entityKey('bld', building.tx, building.ty);
      currentKeys.push(key);
      const footprint = getBuildingFootprint(building.type);
      this.drawShadow(building.tx, building.ty, footprint, 0.08);
    }

    const buildingData = new Map(snapshot.map.buildings.map((b) => [entityKey('bld', b.tx, b.ty), b]));

    this.buildingRegistry.sync(
      currentKeys,
      (key) => {
        const building = buildingData.get(key);
        if (!building) return this.createFallbackBox(0, 0, 1, '#9a6a3a', '??');
        const footprint = getBuildingFootprint(building.type);
        return this.createProfileImage({
          key: factionBuildingKey(faction, building.type),
          profileKey: `building_${building.type.replace(/-/g, '_')}`,
          tx: building.tx,
          ty: building.ty,
          footprint,
          depth: this.entityDepth(building.tx, building.ty, footprint),
          fallback: () => this.createFallbackBox(
            building.tx, building.ty, footprint,
            isBuildingOnline(snapshot.power, building.tx, building.ty) ? '#c27a3a' : '#9a6a3a',
            building.type.slice(0, 3).toUpperCase(),
          ),
        });
      },
      (key, obj) => {
        const building = buildingData.get(key);
        if (building) {
          const footprint = getBuildingFootprint(building.type);
          obj.setDepth(this.entityDepth(building.tx, building.ty, footprint));
        }
      },
      (_key, obj) => obj.destroy(),
    );
  }

  // ── Construction Sites ───────────────────────────────────────

  private syncConstructionSites(snapshot: WorldRenderSnapshot): void {
    const currentKeys: string[] = [];

    for (const site of snapshot.map.constructionSites) {
      currentKeys.push(entityKey('cs', site.tx, site.ty));
      const footprint = getBuildingFootprint(site.type);
      this.drawShadow(site.tx, site.ty, footprint, 0.08);
    }

    const siteData = new Map(snapshot.map.constructionSites.map((s) => [entityKey('cs', s.tx, s.ty), s]));

    this.constructionRegistry.sync(
      currentKeys,
      (key) => {
        const site = siteData.get(key);
        if (!site) return this.createFallbackBox(0, 0, 1, '#9b682b', '');
        return this.createConstructionSite(site);
      },
      (key, obj) => {
        // Update progress bar — reconstruct the site graphics
        const site = siteData.get(key);
        if (site && obj instanceof Phaser.GameObjects.Graphics) {
          // Redraw with new progress
          obj.clear();
          const footprint = getBuildingFootprint(site.type);
          const center = tileToScreen(site.tx + footprint / 2, site.ty + footprint / 2);
          const halfW = (TILE_W / 2) * footprint * 0.82;
          const halfH = (TILE_H / 2) * footprint * 0.82;
          obj.fillStyle(0x9b682b, 0.85);
          obj.lineStyle(1, 0xf0c96a, 1);
          obj.beginPath();
          obj.moveTo(center.x, center.y - halfH - 3);
          obj.lineTo(center.x + halfW, center.y - 3);
          obj.lineTo(center.x, center.y + halfH - 3);
          obj.lineTo(center.x - halfW, center.y - 3);
          obj.closePath();
          obj.fillPath();
          obj.strokePath();
          const barWidth = 30;
          const barY = center.y - halfH - 15;
          obj.fillStyle(0x000000, 0.6);
          obj.fillRect(center.x - barWidth / 2, barY, barWidth, 4);
          obj.fillStyle(0xffdc73, 1);
          obj.fillRect(center.x - barWidth / 2, barY, barWidth * site.progress, 4);
        }
      },
      (_key, obj) => obj.destroy(),
    );
  }

  // ── Resources ────────────────────────────────────────────────

  private syncResources(snapshot: WorldRenderSnapshot): void {
    const currentKeys: string[] = [];
    const resourceData = new Map<string, ResourcePlacement>();

    for (let i = 0; i < snapshot.map.resources.length; i++) {
      const resource = snapshot.map.resources[i]!;
      if (this.isResourceDepleted(resource, snapshot)) continue;
      const key = entityKey('res', resource.tx, resource.ty);
      currentKeys.push(key);
      resourceData.set(key, resource);
      this.drawShadow(resource.tx, resource.ty, resource.footprint, 0.09);
    }

    this.resourceRegistry.sync(
      currentKeys,
      (key) => {
        const resource = resourceData.get(key);
        if (!resource) return this.createResourceFallback({ tx: 0, ty: 0, type: 'small', footprint: 1 });
        const resolved = resolveResourceAsset(resource.type, resource.tx, resource.ty, snapshot.visualSeed);
        return this.createProfileImage({
          key: this.textureExists(resolved.preferredKey) ? resolved.preferredKey : resolved.fallbackKey,
          profileKey: resolved.profileKey,
          tx: resource.tx,
          ty: resource.ty,
          footprint: resource.footprint,
          depth: this.entityDepth(resource.tx, resource.ty, resource.footprint),
          fallback: () => this.createResourceFallback(resource),
        });
      },
      (_key, _obj) => {
        // Resources don't move; depth unchanged
      },
      (_key, obj) => obj.destroy(),
    );
  }

  // ── Obstacles ────────────────────────────────────────────────

  private syncObstacles(snapshot: WorldRenderSnapshot): void {
    const currentKeys: string[] = [];
    const obstacleData = new Map<string, typeof snapshot.map.obstacles[number]>();

    for (const obstacle of snapshot.map.obstacles) {
      const key = entityKey('obs', obstacle.tx, obstacle.ty);
      currentKeys.push(key);
      obstacleData.set(key, obstacle);
      this.drawShadow(obstacle.tx, obstacle.ty, obstacle.footprint, 0.09);
    }

    this.obstacleRegistry.sync(
      currentKeys,
      (key) => {
        const obstacle = obstacleData.get(key);
        if (!obstacle) return this.createFallbackBox(0, 0, 1, '#7a7a6a', '');
        const resolved = resolveObstacleAsset(obstacle.type, obstacle.tx, obstacle.ty, snapshot.visualSeed);
        return this.createProfileImage({
          key: this.textureExists(resolved.preferredKey) ? resolved.preferredKey : resolved.fallbackKey,
          profileKey: resolved.profileKey,
          tx: obstacle.tx,
          ty: obstacle.ty,
          footprint: obstacle.footprint,
          depth: this.entityDepth(obstacle.tx, obstacle.ty, obstacle.footprint),
          fallback: () => this.createFallbackBox(obstacle.tx, obstacle.ty, obstacle.footprint, '#7a7a6a', ''),
        });
      },
      (_key, _obj) => {
        // Obstacles are static
      },
      (_key, obj) => obj.destroy(),
    );
  }

  // ── Decor ────────────────────────────────────────────────────

  private syncDecor(snapshot: WorldRenderSnapshot): void {
    const currentKeys: string[] = [];
    const decorData = new Map<string, typeof snapshot.map.decor[number]>();

    for (const decor of snapshot.map.decor) {
      const key = entityKey('dcr', decor.tx, decor.ty);
      currentKeys.push(key);
      decorData.set(key, decor);
    }

    this.decorRegistry.sync(
      currentKeys,
      (key) => {
        const decor = decorData.get(key);
        if (!decor) return this.createResourceFallback({ tx: 0, ty: 0, type: 'small', footprint: 1 });
        const resolved = resolveDecorAsset(decor.type, decor.tx, decor.ty, snapshot.visualSeed);
        return this.createProfileImage({
          key: this.textureExists(resolved.preferredKey) ? resolved.preferredKey : resolved.fallbackKey,
          profileKey: resolved.profileKey,
          tx: decor.tx,
          ty: decor.ty,
          footprint: 1,
          depth: this.entityDepth(decor.tx, decor.ty, 1),
          fallback: () => this.createResourceFallback({ tx: decor.tx, ty: decor.ty, type: 'small', footprint: 1 }),
        });
      },
      (_key, _obj) => {
        // Decor is static
      },
      (_key, obj) => obj.destroy(),
    );
  }

  // ── Builders ─────────────────────────────────────────────────

  private syncBuilders(snapshot: WorldRenderSnapshot): void {
    const faction = snapshot.map.hq.faction;
    const currentKeys: string[] = [];

    for (let i = 0; i < snapshot.map.builders.length; i++) {
      currentKeys.push(`builder_${i}`);
    }

    this.builderRegistry.sync(
      currentKeys,
      (key) => this.createBuilder(key, snapshot, faction),
      (key, obj) => this.updateBuilder(key, obj, snapshot, faction),
      (_key, obj) => obj.destroy(),
    );
  }

  private createBuilder(key: string, snapshot: WorldRenderSnapshot, faction: FactionId): DisposableObject {
    const index = Number(key.split('_')[1]);
    const builder = snapshot.map.builders[index];
    if (!builder) return this.createUnitFallback(0, 0, '#9ad8ff', 1000);

    const keyName = builderKey(faction);
    const renderTx = builder.phase === 'moving-to-site' ? builder.ftx : builder.tx + 0.5;
    const renderTy = builder.phase === 'moving-to-site' ? builder.fty : builder.ty + 0.5;
    this.drawUnitShadow(renderTx, renderTy, 0.11);

    if (!this.textureExists(keyName)) {
      return this.createUnitFallback(renderTx, renderTy, '#9ad8ff', this.entityDepth(renderTx, renderTy, 1));
    }

    const target = builder.path[builder.pathIndex] ?? { tx: builder.targetTx, ty: builder.targetTy };
    const row = directionToRow(target.tx + 0.5 - renderTx, target.ty + 0.5 - renderTy);
    const col = builderAnimColumn(builder.busy, snapshot.ticks);
    const center = tileToScreen(renderTx, renderTy);
    const profile = SPRITE_PROFILES.builder_base;
    const fitted = containFit(UNIT_FRAME_SIZE, UNIT_FRAME_SIZE, profile.size[0], profile.size[1]);
    const sprite = this.add.sprite(center.x, center.y - profile.groundOffset, keyName, row * 8 + col);
    sprite.setOrigin(0.5);
    sprite.setDisplaySize(fitted.drawWidth, fitted.drawHeight);
    sprite.setDepth(this.entityDepth(renderTx, renderTy, 1));
    return sprite;
  }

  private updateBuilder(key: string, obj: DisposableObject, snapshot: WorldRenderSnapshot, faction: FactionId): void {
    const index = Number(key.split('_')[1]);
    const builder = snapshot.map.builders[index];
    if (!builder) return;

    const renderTx = builder.phase === 'moving-to-site' ? builder.ftx : builder.tx + 0.5;
    const renderTy = builder.phase === 'moving-to-site' ? builder.fty : builder.ty + 0.5;
    this.drawUnitShadow(renderTx, renderTy, 0.11);

    if (!(obj instanceof Phaser.GameObjects.Sprite)) return;

    const keyName = builderKey(faction);
    if (!this.textureExists(keyName)) return;

    const target = builder.path[builder.pathIndex] ?? { tx: builder.targetTx, ty: builder.targetTy };
    const row = directionToRow(target.tx + 0.5 - renderTx, target.ty + 0.5 - renderTy);
    const col = builderAnimColumn(builder.busy, snapshot.ticks);
    const center = tileToScreen(renderTx, renderTy);
    const profile = SPRITE_PROFILES.builder_base;
    const fitted = containFit(UNIT_FRAME_SIZE, UNIT_FRAME_SIZE, profile.size[0], profile.size[1]);

    obj.setPosition(center.x, center.y - profile.groundOffset);
    obj.setDepth(this.entityDepth(renderTx, renderTy, 1));
    if (obj instanceof Phaser.GameObjects.Sprite) {
      obj.setFrame(row * 8 + col);
      obj.setDisplaySize(fitted.drawWidth, fitted.drawHeight);
    }
  }

  // ── Harvesters ───────────────────────────────────────────────

  private syncHarvesters(snapshot: WorldRenderSnapshot): void {
    const faction = snapshot.map.hq.faction;
    const currentKeys: string[] = [];

    for (let i = 0; i < snapshot.harvesters.length; i++) {
      currentKeys.push(`harvester_${i}`);
    }

    this.harvesterRegistry.sync(
      currentKeys,
      (key) => this.createHarvester(key, snapshot, faction),
      (key, obj) => this.updateHarvester(key, obj, snapshot, faction),
      (_key, obj) => obj.destroy(),
    );
  }

  private createHarvester(key: string, snapshot: WorldRenderSnapshot, faction: FactionId): DisposableObject {
    const index = Number(key.split('_')[1]);
    const harvester = snapshot.harvesters[index];
    if (!harvester) return this.createUnitFallback(0, 0, '#5ee89a', 1000);

    const prev = snapshot.prevHarvesterPositions.get(index) ?? { tx: harvester.tx, ty: harvester.ty };
    const keyName = harvesterKey(faction);
    this.drawUnitShadow(harvester.tx, harvester.ty, 0.1);

    if (!this.textureExists(keyName)) {
      return this.createUnitFallback(harvester.tx, harvester.ty, '#5ee89a', this.entityDepth(harvester.tx, harvester.ty, 1));
    }

    const row = directionToRow(harvester.tx - prev.tx, harvester.ty - prev.ty);
    const col = harvesterAnimColumn(harvester.phase, snapshot.ticks);
    const center = tileToScreen(harvester.tx, harvester.ty);
    const profile = SPRITE_PROFILES.harvester_base;
    const fitted = containFit(UNIT_FRAME_SIZE, UNIT_FRAME_SIZE, profile.size[0], profile.size[1]);
    const sprite = this.add.sprite(center.x, center.y - profile.groundOffset, keyName, row * 8 + col);
    sprite.setOrigin(0.5);
    sprite.setDisplaySize(fitted.drawWidth, fitted.drawHeight);
    sprite.setDepth(this.entityDepth(harvester.tx, harvester.ty, 1));
    return sprite;
  }

  private updateHarvester(key: string, obj: DisposableObject, snapshot: WorldRenderSnapshot, faction: FactionId): void {
    const index = Number(key.split('_')[1]);
    const harvester = snapshot.harvesters[index];
    if (!harvester) return;

    const prev = snapshot.prevHarvesterPositions.get(index) ?? { tx: harvester.tx, ty: harvester.ty };
    this.drawUnitShadow(harvester.tx, harvester.ty, 0.1);

    if (!(obj instanceof Phaser.GameObjects.Sprite)) return;

    const keyName = harvesterKey(faction);
    if (!this.textureExists(keyName)) return;

    const row = directionToRow(harvester.tx - prev.tx, harvester.ty - prev.ty);
    const col = harvesterAnimColumn(harvester.phase, snapshot.ticks);
    const center = tileToScreen(harvester.tx, harvester.ty);
    const profile = SPRITE_PROFILES.harvester_base;
    const fitted = containFit(UNIT_FRAME_SIZE, UNIT_FRAME_SIZE, profile.size[0], profile.size[1]);

    obj.setPosition(center.x, center.y - profile.groundOffset);
    obj.setDepth(this.entityDepth(harvester.tx, harvester.ty, 1));
    if (obj instanceof Phaser.GameObjects.Sprite) {
      obj.setFrame(row * 8 + col);
      obj.setDisplaySize(fitted.drawWidth, fitted.drawHeight);
    }
  }

  // ── Shared factory methods ───────────────────────────────────

  private createProfileImage(options: {
    key: string;
    profileKey: keyof typeof SPRITE_PROFILES | string;
    tx: number;
    ty: number;
    footprint: number;
    depth: number;
    fallback: () => DisposableObject;
  }): DisposableObject {
    if (!this.textureExists(options.key)) {
      return options.fallback();
    }

    const profile = SPRITE_PROFILES[options.profileKey as keyof typeof SPRITE_PROFILES] as SpriteProfile | undefined;
    if (!profile) {
      return options.fallback();
    }

    const center = tileToScreen(options.tx + options.footprint / 2, options.ty + options.footprint / 2);
    const baseY = center.y + (TILE_H / 2) * options.footprint;
    const { width, height } = textureSize(this.textures, options.key);
    const fitted = containFit(width, height, profile.size[0], profile.size[1]);
    const image = this.add.image(
      center.x + (profile.screenOffsetX ?? 0),
      baseY - profile.groundOffset + (profile.screenOffsetY ?? 0),
      options.key,
    );
    image.setOrigin(0.5, 1);
    image.setDisplaySize(fitted.drawWidth, fitted.drawHeight);
    image.setDepth(options.depth);
    return image;
  }

  private createConstructionSite(site: ConstructionSitePlacement): DisposableObject {
    const footprint = getBuildingFootprint(site.type);
    const center = tileToScreen(site.tx + footprint / 2, site.ty + footprint / 2);
    const halfW = (TILE_W / 2) * footprint * 0.82;
    const halfH = (TILE_H / 2) * footprint * 0.82;
    const graphics = this.add.graphics();
    graphics.setDepth(this.entityDepth(site.tx, site.ty, footprint));
    graphics.fillStyle(0x9b682b, 0.85);
    graphics.lineStyle(1, 0xf0c96a, 1);
    graphics.beginPath();
    graphics.moveTo(center.x, center.y - halfH - 3);
    graphics.lineTo(center.x + halfW, center.y - 3);
    graphics.lineTo(center.x, center.y + halfH - 3);
    graphics.lineTo(center.x - halfW, center.y - 3);
    graphics.closePath();
    graphics.fillPath();
    graphics.strokePath();

    const barWidth = 30;
    const barY = center.y - halfH - 15;
    graphics.fillStyle(0x000000, 0.6);
    graphics.fillRect(center.x - barWidth / 2, barY, barWidth, 4);
    graphics.fillStyle(0xffdc73, 1);
    graphics.fillRect(center.x - barWidth / 2, barY, barWidth * site.progress, 4);
    return graphics;
  }

  private createFallbackBox(tx: number, ty: number, footprint: number, color: string, label: string): DisposableObject {
    const center = tileToScreen(tx + footprint / 2, ty + footprint / 2);
    const graphics = this.add.graphics();
    graphics.setDepth(this.entityDepth(tx, ty, footprint));
    graphics.fillStyle(colorNumber(color), 1);
    graphics.lineStyle(1, TERRAIN_STROKE, 0.35);
    graphics.fillEllipse(center.x, center.y - 12, TILE_W * footprint * 0.32, TILE_H * footprint * 0.8);
    graphics.strokeEllipse(center.x, center.y - 12, TILE_W * footprint * 0.32, TILE_H * footprint * 0.8);

    if (label.length > 0) {
      const text = this.add.text(center.x, center.y - 18, label, {
        color: '#2a1704',
        fontFamily: 'Arial, sans-serif',
        fontSize: '10px',
        fontStyle: 'bold',
      });
      text.setOrigin(0.5);
      text.setDepth(this.entityDepth(tx, ty, footprint) + 0.01);
      // Return a container-like wrapper that groups both — but Phaser doesn't have
      // a lightweight container for this, so return graphics and manage text lifecycle
      // separately via a group object
      const container = this.add.container(0, 0);
      container.add(graphics);
      container.add(text);
      container.setDepth(graphics.depth);
      return container as unknown as DisposableObject;
    }

    return graphics;
  }

  private createResourceFallback(resource: ResourcePlacement): DisposableObject {
    const footprint = RESOURCE_FOOTPRINTS[resource.type] ?? resource.footprint;
    const center = tileToScreen(resource.tx + footprint / 2, resource.ty + footprint / 2);
    const graphics = this.add.graphics();
    graphics.setDepth(this.entityDepth(resource.tx, resource.ty, footprint));
    graphics.fillStyle(0x7de1ff, 1);
    graphics.lineStyle(1, 0x1a768c, 1);
    graphics.fillCircle(center.x, center.y - 8, resource.type === 'infinite' ? 16 : 8);
    graphics.strokeCircle(center.x, center.y - 8, resource.type === 'infinite' ? 16 : 8);
    return graphics;
  }

  private createUnitFallback(tx: number, ty: number, color: string, depth: number): DisposableObject {
    const center = tileToScreen(tx, ty);
    const graphics = this.add.graphics();
    graphics.setDepth(depth);
    graphics.fillStyle(colorNumber(color), 1);
    graphics.lineStyle(1, 0x2a1704, 0.5);
    graphics.fillEllipse(center.x, center.y - 7, 24, 16);
    graphics.strokeEllipse(center.x, center.y - 7, 24, 16);
    return graphics;
  }

  // ── Shadow helpers ───────────────────────────────────────────

  private drawShadow(tx: number, ty: number, footprint: number, alpha: number): void {
    const center = tileToScreen(tx + footprint / 2, ty + footprint / 2);
    this.shadowGraphics?.fillStyle(SHADOW_COLOR, alpha);
    this.shadowGraphics?.fillEllipse(center.x - 3 * footprint, center.y + 2 * footprint, TILE_W * footprint * 0.38, TILE_H * footprint * 0.42);
  }

  private drawUnitShadow(tx: number, ty: number, alpha: number): void {
    const center = tileToScreen(tx, ty);
    this.shadowGraphics?.fillStyle(SHADOW_COLOR, alpha);
    this.shadowGraphics?.fillEllipse(center.x - 3, center.y + 1, 24, 8);
  }

  // ── Camera ───────────────────────────────────────────────────

  private syncCamera(snapshot: WorldRenderSnapshot): void {
    const camera = this.cameras.main;
    camera.setZoom(snapshot.camera.zoom);
    camera.setScroll(
      snapshot.camera.x - camera.width / (2 * snapshot.camera.zoom),
      snapshot.camera.y - camera.height / (2 * snapshot.camera.zoom),
    );
  }

  // ── Helpers ──────────────────────────────────────────────────

  private loadImages(manifest: Readonly<Record<string, string>>): void {
    for (const [key, path] of Object.entries(manifest)) {
      this.load.image(key, assetPath(path));
    }
  }

  private textureExists(key: string): boolean {
    return this.textures.exists(key);
  }

  private entityDepth(tx: number, ty: number, footprint: number): number {
    return 1000 + (tx + ty + (footprint - 1) * 2) * 10;
  }

  private isResourceDepleted(resource: ResourcePlacement, snapshot: WorldRenderSnapshot): boolean {
    const index = snapshot.map.resources.indexOf(resource);
    const node = snapshot.resourceNodes[index];
    return Boolean(node && !node.infinite && node.remaining <= 0);
  }

  /** Destroy all registries and terrain cache. */
  destroyAll(): void {
    this.hqRegistry.clear((_k, obj) => obj.destroy());
    this.buildingRegistry.clear((_k, obj) => obj.destroy());
    this.constructionRegistry.clear((_k, obj) => obj.destroy());
    this.resourceRegistry.clear((_k, obj) => obj.destroy());
    this.obstacleRegistry.clear((_k, obj) => obj.destroy());
    this.decorRegistry.clear((_k, obj) => obj.destroy());
    this.builderRegistry.clear((_k, obj) => obj.destroy());
    this.harvesterRegistry.clear((_k, obj) => obj.destroy());
    this.territoryRegistry.clear((_k, obj) => obj.destroy());
    this.terrainRenderTexture?.destroy();
    this.terrainRenderTexture = null;
    this.cachedMapIdentity = '';
    this.cachedTerrainBounds = null;
  }
}

export class PhaserWorldRenderer implements WorldRenderer {
  readonly kind = 'phaser';

  private readonly canvas: HTMLCanvasElement;
  private scene: PhaserProductionScene | null = null;
  private game: Phaser.Game | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  async init(): Promise<void> {
    if (this.scene) {
      await this.scene.waitUntilReady();
      return;
    }

    const scene = new PhaserProductionScene();
    this.scene = scene;
    this.game = new Phaser.Game({
      type: Phaser.CANVAS,
      canvas: this.canvas,
      width: Math.max(1, this.canvas.width),
      height: Math.max(1, this.canvas.height),
      backgroundColor: BG_COLOR,
      audio: { noAudio: true },
      scene,
      render: {
        antialias: true,
        pixelArt: false,
      },
    });

    await scene.waitUntilReady();
  }

  render(snapshot: WorldRenderSnapshot): void {
    this.scene?.renderSnapshot(snapshot);
  }

  resize(width: number, height: number): void {
    this.game?.scale.resize(width, height);
  }

  /** Get renderer stats for debugging/E2E. */
  getStats(): PhaserRendererStats | null {
    return this.scene?.getStats() ?? null;
  }

  destroy(): void {
    this.scene?.destroyAll();
    this.game?.destroy(false);
    this.game = null;
    this.scene = null;
  }
}
