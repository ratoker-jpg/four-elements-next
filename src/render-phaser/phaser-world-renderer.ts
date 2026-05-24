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
import { tileToScreen } from '../core/coordinates.js';
import { RESOURCE_FOOTPRINTS, type BuildingType, type FactionId, type TerrainType } from '../game/map-types.js';
import { isBuildingOnline } from '../systems/power.js';
import { builderAnimColumn, directionToRow, harvesterAnimColumn } from '../render/spritesheet.js';
import { containFit } from '../render/contain-fit.js';
import type { BuilderPlacement, ConstructionSitePlacement, ResourcePlacement } from '../game/map-types.js';
import type { HarvesterState } from '../systems/harvesting.js';
import type { WorldRenderer, WorldRenderSnapshot } from './types.js';

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

interface DisposableObject extends Phaser.GameObjects.GameObject {
  setDepth(value: number): this;
}

class PhaserProductionScene extends Phaser.Scene {
  private terrainGraphics: Phaser.GameObjects.Graphics | null = null;
  private shadowGraphics: Phaser.GameObjects.Graphics | null = null;
  private readonly transientObjects: DisposableObject[] = [];
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
    this.terrainGraphics = this.add.graphics();
    this.terrainGraphics.setDepth(0);
    this.shadowGraphics = this.add.graphics();
    this.shadowGraphics.setDepth(100);

    this.resolveReady?.();
    this.resolveReady = null;

    if (this.pendingSnapshot) {
      this.renderSnapshot(this.pendingSnapshot);
      this.pendingSnapshot = null;
    }
  }

  renderSnapshot(snapshot: WorldRenderSnapshot): void {
    if (!this.terrainGraphics || !this.shadowGraphics) {
      this.pendingSnapshot = snapshot;
      return;
    }

    this.syncCamera(snapshot);
    this.clearTransientObjects();
    this.drawTerrain(snapshot);
    this.drawEntities(snapshot);
  }

  private loadImages(manifest: Readonly<Record<string, string>>): void {
    for (const [key, path] of Object.entries(manifest)) {
      this.load.image(key, assetPath(path));
    }
  }

  private syncCamera(snapshot: WorldRenderSnapshot): void {
    const camera = this.cameras.main;
    camera.setZoom(snapshot.camera.zoom);
    camera.setScroll(
      snapshot.camera.x - camera.width / (2 * snapshot.camera.zoom),
      snapshot.camera.y - camera.height / (2 * snapshot.camera.zoom),
    );
  }

  private clearTransientObjects(): void {
    for (const object of this.transientObjects) {
      object.destroy();
    }
    this.transientObjects.length = 0;
    this.shadowGraphics?.clear();
  }

  private drawTerrain(snapshot: WorldRenderSnapshot): void {
    const graphics = this.terrainGraphics;
    if (!graphics) return;

    graphics.clear();
    const halfW = TILE_W / 2;
    const halfH = TILE_H / 2;
    const strokeAlpha = alphaFromRgba(GRID_COLOR);

    for (let ty = 0; ty < snapshot.map.height; ty++) {
      for (let tx = 0; tx < snapshot.map.width; tx++) {
        const terrainType: TerrainType = snapshot.map.terrain[ty]?.[tx] ?? 'sand';
        const fill = colorNumber(TERRAIN_COLORS[terrainType] ?? TERRAIN_COLORS.sand!);
        const center = tileToScreen(tx + 0.5, ty + 0.5);

        graphics.fillStyle(fill, 1);
        graphics.lineStyle(1, TERRAIN_STROKE, strokeAlpha);
        graphics.beginPath();
        graphics.moveTo(center.x, center.y - halfH);
        graphics.lineTo(center.x + halfW, center.y);
        graphics.lineTo(center.x, center.y + halfH);
        graphics.lineTo(center.x - halfW, center.y);
        graphics.closePath();
        graphics.fillPath();
        graphics.strokePath();
      }
    }
  }

  private drawEntities(snapshot: WorldRenderSnapshot): void {
    const faction = snapshot.map.hq.faction;

    this.drawShadow(snapshot.map.hq.tx, snapshot.map.hq.ty, HQ_FOOTPRINT, 0.09);
    this.addProfileImage({
      key: HQ_ASSET_KEYS[faction],
      profileKey: 'hq_base',
      tx: snapshot.map.hq.tx,
      ty: snapshot.map.hq.ty,
      footprint: HQ_FOOTPRINT,
      depth: this.entityDepth(snapshot.map.hq.tx, snapshot.map.hq.ty, HQ_FOOTPRINT),
      fallback: () => this.addFallbackBox(snapshot.map.hq.tx, snapshot.map.hq.ty, HQ_FOOTPRINT, '#d4a544', 'HQ'),
    });

    for (const building of snapshot.map.buildings) {
      const footprint = getBuildingFootprint(building.type);
      this.drawShadow(building.tx, building.ty, footprint, 0.08);
      this.addProfileImage({
        key: factionBuildingKey(faction, building.type),
        profileKey: `building_${building.type.replace(/-/g, '_')}`,
        tx: building.tx,
        ty: building.ty,
        footprint,
        depth: this.entityDepth(building.tx, building.ty, footprint),
        fallback: () => this.addFallbackBox(
          building.tx,
          building.ty,
          footprint,
          isBuildingOnline(snapshot.power, building.tx, building.ty) ? '#c27a3a' : '#9a6a3a',
          building.type.slice(0, 3).toUpperCase(),
        ),
      });
    }

    for (const site of snapshot.map.constructionSites) {
      this.drawShadow(site.tx, site.ty, getBuildingFootprint(site.type), 0.08);
      this.addConstructionSite(site);
    }

    for (const resource of snapshot.map.resources) {
      if (this.isResourceDepleted(resource, snapshot)) continue;
      const resolved = resolveResourceAsset(resource.type, resource.tx, resource.ty, snapshot.visualSeed);
      this.drawShadow(resource.tx, resource.ty, resource.footprint, 0.09);
      this.addProfileImage({
        key: this.textureExists(resolved.preferredKey) ? resolved.preferredKey : resolved.fallbackKey,
        profileKey: resolved.profileKey,
        tx: resource.tx,
        ty: resource.ty,
        footprint: resource.footprint,
        depth: this.entityDepth(resource.tx, resource.ty, resource.footprint),
        fallback: () => this.addResourceFallback(resource),
      });
    }

    for (const obstacle of snapshot.map.obstacles) {
      const resolved = resolveObstacleAsset(obstacle.type, obstacle.tx, obstacle.ty, snapshot.visualSeed);
      this.drawShadow(obstacle.tx, obstacle.ty, obstacle.footprint, 0.09);
      this.addProfileImage({
        key: this.textureExists(resolved.preferredKey) ? resolved.preferredKey : resolved.fallbackKey,
        profileKey: resolved.profileKey,
        tx: obstacle.tx,
        ty: obstacle.ty,
        footprint: obstacle.footprint,
        depth: this.entityDepth(obstacle.tx, obstacle.ty, obstacle.footprint),
        fallback: () => this.addFallbackBox(obstacle.tx, obstacle.ty, obstacle.footprint, '#7a7a6a', ''),
      });
    }

    for (const decor of snapshot.map.decor) {
      const resolved = resolveDecorAsset(decor.type, decor.tx, decor.ty, snapshot.visualSeed);
      this.addProfileImage({
        key: this.textureExists(resolved.preferredKey) ? resolved.preferredKey : resolved.fallbackKey,
        profileKey: resolved.profileKey,
        tx: decor.tx,
        ty: decor.ty,
        footprint: 1,
        depth: this.entityDepth(decor.tx, decor.ty, 1),
        fallback: () => this.addResourceFallback({ tx: decor.tx, ty: decor.ty, type: 'small', footprint: 1 }),
      });
    }

    for (const builder of snapshot.map.builders) {
      this.addBuilder(builder, faction, snapshot.ticks);
    }

    for (let i = 0; i < snapshot.harvesters.length; i++) {
      const harvester = snapshot.harvesters[i]!;
      const previous = snapshot.prevHarvesterPositions.get(i) ?? { tx: harvester.tx, ty: harvester.ty };
      this.addHarvester(harvester, faction, snapshot.ticks, previous.tx, previous.ty);
    }
  }

  private addProfileImage(options: {
    key: string;
    profileKey: keyof typeof SPRITE_PROFILES | string;
    tx: number;
    ty: number;
    footprint: number;
    depth: number;
    fallback: () => void;
  }): void {
    if (!this.textureExists(options.key)) {
      options.fallback();
      return;
    }

    const profile = SPRITE_PROFILES[options.profileKey as keyof typeof SPRITE_PROFILES] as SpriteProfile | undefined;
    if (!profile) {
      options.fallback();
      return;
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
    this.transientObjects.push(image);
  }

  private addBuilder(builder: BuilderPlacement, faction: FactionId, ticks: number): void {
    const key = builderKey(faction);
    const renderTx = builder.phase === 'moving-to-site' ? builder.ftx : builder.tx + 0.5;
    const renderTy = builder.phase === 'moving-to-site' ? builder.fty : builder.ty + 0.5;
    this.drawUnitShadow(renderTx, renderTy, 0.11);

    if (!this.textureExists(key)) {
      this.addUnitFallback(renderTx, renderTy, '#9ad8ff', this.entityDepth(renderTx, renderTy, 1));
      return;
    }

    const target = builder.path[builder.pathIndex] ?? { tx: builder.targetTx, ty: builder.targetTy };
    const row = directionToRow(target.tx + 0.5 - renderTx, target.ty + 0.5 - renderTy);
    const col = builderAnimColumn(builder.busy, ticks);
    const center = tileToScreen(renderTx, renderTy);
    const profile = SPRITE_PROFILES.builder_base;
    const fitted = containFit(UNIT_FRAME_SIZE, UNIT_FRAME_SIZE, profile.size[0], profile.size[1]);
    const sprite = this.add.sprite(center.x, center.y - profile.groundOffset, key, row * 8 + col);
    sprite.setOrigin(0.5);
    sprite.setDisplaySize(fitted.drawWidth, fitted.drawHeight);
    sprite.setDepth(this.entityDepth(renderTx, renderTy, 1));
    this.transientObjects.push(sprite);
  }

  private addHarvester(
    harvester: HarvesterState,
    faction: FactionId,
    ticks: number,
    prevTx: number,
    prevTy: number,
  ): void {
    const key = harvesterKey(faction);
    this.drawUnitShadow(harvester.tx, harvester.ty, 0.1);

    if (!this.textureExists(key)) {
      this.addUnitFallback(harvester.tx, harvester.ty, '#5ee89a', this.entityDepth(harvester.tx, harvester.ty, 1));
      return;
    }

    const row = directionToRow(harvester.tx - prevTx, harvester.ty - prevTy);
    const col = harvesterAnimColumn(harvester.phase, ticks);
    const center = tileToScreen(harvester.tx, harvester.ty);
    const profile = SPRITE_PROFILES.harvester_base;
    const fitted = containFit(UNIT_FRAME_SIZE, UNIT_FRAME_SIZE, profile.size[0], profile.size[1]);
    const sprite = this.add.sprite(center.x, center.y - profile.groundOffset, key, row * 8 + col);
    sprite.setOrigin(0.5);
    sprite.setDisplaySize(fitted.drawWidth, fitted.drawHeight);
    sprite.setDepth(this.entityDepth(harvester.tx, harvester.ty, 1));
    this.transientObjects.push(sprite);
  }

  private addConstructionSite(site: ConstructionSitePlacement): void {
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
    this.transientObjects.push(graphics);
  }

  private addFallbackBox(tx: number, ty: number, footprint: number, color: string, label: string): void {
    const center = tileToScreen(tx + footprint / 2, ty + footprint / 2);
    const graphics = this.add.graphics();
    graphics.setDepth(this.entityDepth(tx, ty, footprint));
    graphics.fillStyle(colorNumber(color), 1);
    graphics.lineStyle(1, TERRAIN_STROKE, 0.35);
    graphics.fillEllipse(center.x, center.y - 12, TILE_W * footprint * 0.32, TILE_H * footprint * 0.8);
    graphics.strokeEllipse(center.x, center.y - 12, TILE_W * footprint * 0.32, TILE_H * footprint * 0.8);
    this.transientObjects.push(graphics);

    if (label.length > 0) {
      const text = this.add.text(center.x, center.y - 18, label, {
        color: '#2a1704',
        fontFamily: 'Arial, sans-serif',
        fontSize: '10px',
        fontStyle: 'bold',
      });
      text.setOrigin(0.5);
      text.setDepth(this.entityDepth(tx, ty, footprint) + 0.01);
      this.transientObjects.push(text);
    }
  }

  private addResourceFallback(resource: ResourcePlacement): void {
    const footprint = RESOURCE_FOOTPRINTS[resource.type] ?? resource.footprint;
    const center = tileToScreen(resource.tx + footprint / 2, resource.ty + footprint / 2);
    const graphics = this.add.graphics();
    graphics.setDepth(this.entityDepth(resource.tx, resource.ty, footprint));
    graphics.fillStyle(0x7de1ff, 1);
    graphics.lineStyle(1, 0x1a768c, 1);
    graphics.fillCircle(center.x, center.y - 8, resource.type === 'infinite' ? 16 : 8);
    graphics.strokeCircle(center.x, center.y - 8, resource.type === 'infinite' ? 16 : 8);
    this.transientObjects.push(graphics);
  }

  private addUnitFallback(tx: number, ty: number, color: string, depth: number): void {
    const center = tileToScreen(tx, ty);
    const graphics = this.add.graphics();
    graphics.setDepth(depth);
    graphics.fillStyle(colorNumber(color), 1);
    graphics.lineStyle(1, 0x2a1704, 0.5);
    graphics.fillEllipse(center.x, center.y - 7, 24, 16);
    graphics.strokeEllipse(center.x, center.y - 7, 24, 16);
    this.transientObjects.push(graphics);
  }

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

  destroy(): void {
    this.game?.destroy(false);
    this.game = null;
    this.scene = null;
  }
}
