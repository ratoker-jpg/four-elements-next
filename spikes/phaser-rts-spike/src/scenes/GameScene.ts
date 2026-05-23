/**
 * GameScene — main spike scene.
 * Renders 48×48 isometric map with static entities, camera pan/zoom, depth sorting.
 */
import Phaser from 'phaser';
import { TILE_W, TILE_H, MAP_SIZE, tileToScreen, getDepthKey, getMapWorldBounds } from '../iso/IsoUtils.js';
import { SPIKE_PROFILES, type SpikeProfile } from '../profiles/PhaserProfiles.js';

/** Camera config */
const CAM_PAN_SPEED = 500;       // world pixels per second
const CAM_ZOOM_MIN = 0.4;
const CAM_ZOOM_MAX = 3.0;
const CAM_ZOOM_STEP = 0.08;
const CAM_LERP = 0.1;

/** Hardcoded entity placements for the spike */
interface EntityDef {
  textureKey: string;
  tx: number;
  ty: number;
}

const ENTITIES: EntityDef[] = [
  // HQ near player start corner
  { textureKey: 'hq', tx: 5, ty: 5 },
  // Minerals near HQ
  { textureKey: 'mineral_small', tx: 8, ty: 4 },
  { textureKey: 'mineral_small', tx: 4, ty: 8 },
  { textureKey: 'mineral_small', tx: 7, ty: 7 },
  // Central infinite mineral
  { textureKey: 'mineral_infinite', tx: 24, ty: 24 },
  // Mountains near edges
  { textureKey: 'mountain_small', tx: 2, ty: 20 },
  { textureKey: 'mountain_small', tx: 40, ty: 5 },
  { textureKey: 'mountain_small', tx: 35, ty: 40 },
  // Rocks scattered
  { textureKey: 'rock_cluster', tx: 15, ty: 10 },
  { textureKey: 'rock_cluster', tx: 30, ty: 35 },
  // Harvester near HQ
  { textureKey: 'harvester', tx: 6, ty: 6 },
  // Builder near HQ
  { textureKey: 'builder', tx: 7, ty: 5 },
];

export class GameScene extends Phaser.Scene {
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };
  private camTargetX = 0;
  private camTargetY = 0;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    // Camera initial position: center of map
    const center = tileToScreen(MAP_SIZE / 2, MAP_SIZE / 2);
    this.camTargetX = center.x;
    this.camTargetY = center.y;
    this.cameras.main.centerOn(this.camTargetX, this.camTargetY);
    this.cameras.main.setZoom(1.0);

    // Input
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.wasd = {
        W: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        A: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        S: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        D: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      };
    }

    // Zoom via mouse wheel
    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _gameObjects: Phaser.GameObjects.GameObject[], _dx: number, _dy: number, _dz: number) => {
      const cam = this.cameras.main;
      const newZoom = Phaser.Math.Clamp(cam.zoom - _dy * CAM_ZOOM_STEP * 0.01, CAM_ZOOM_MIN, CAM_ZOOM_MAX);
      cam.setZoom(newZoom);
    });

    // Render isometric map
    this.renderMap();

    // Render entities
    this.renderEntities();
  }

  update(_time: number, delta: number): void {
    this.handleCameraPan(delta);
  }

  // ---- Camera ----

  private handleCameraPan(delta: number): void {
    const dt = delta / 1000;
    let dx = 0;
    let dy = 0;

    if (this.cursors.left.isDown || this.wasd.A.isDown) dx -= 1;
    if (this.cursors.right.isDown || this.wasd.D.isDown) dx += 1;
    if (this.cursors.up.isDown || this.wasd.W.isDown) dy -= 1;
    if (this.cursors.down.isDown || this.wasd.S.isDown) dy += 1;

    if (dx !== 0 || dy !== 0) {
      // Normalize diagonal
      const len = Math.sqrt(dx * dx + dy * dy);
      dx /= len;
      dy /= len;

      // Pan in screen space then convert — simpler for isometric:
      // move camera target directly in world space
      this.camTargetX += dx * CAM_PAN_SPEED * dt;
      this.camTargetY += dy * CAM_PAN_SPEED * dt;
    }

    // Clamp to map bounds
    const bounds = getMapWorldBounds();
    this.camTargetX = Phaser.Math.Clamp(this.camTargetX, bounds.minX, bounds.maxX);
    this.camTargetY = Phaser.Math.Clamp(this.camTargetY, bounds.minY, bounds.maxY);

    // Smooth camera follow with lerp
    const cam = this.cameras.main;
    cam.centerOn(
      Phaser.Math.Linear(cam.scrollX + cam.width / 2 / cam.zoom, this.camTargetX, CAM_LERP),
      Phaser.Math.Linear(cam.scrollY + cam.height / 2 / cam.zoom, this.camTargetY, CAM_LERP),
    );
  }

  // ---- Map rendering ----

  private renderMap(): void {
    const profile = SPIKE_PROFILES['sand_tile'];
    if (!profile) return;

    for (let ty = 0; ty < MAP_SIZE; ty++) {
      for (let tx = 0; tx < MAP_SIZE; tx++) {
        const { x, y } = tileToScreen(tx, ty);

        // Draw isometric diamond tile
        const diamond = this.add.polygon(
          x,
          y,
          this.tileDiamondPoints(),
          0xd9c67a,  // sand color matching production
        );
        diamond.setDepth(getDepthKey(tx, ty, 1));
        diamond.setOrigin(0, 0);

        // Overlay sand tile sprite if loaded
        if (this.textures.exists('sand_tile')) {
          const tile = this.add.image(x, y, 'sand_tile');
          tile.setDisplaySize(TILE_W, TILE_H);
          tile.setDepth(getDepthKey(tx, ty, 1));
          tile.setOrigin(0.5, 0); // center horizontally, top vertically
        }
      }
    }

    // Subtle grid lines are implied by tile edges in the diamond fill.
    // We skip explicit grid lines to keep the spike minimal.
  }

  private tileDiamondPoints(): number[] {
    const hw = TILE_W / 2;
    const hh = TILE_H / 2;
    return [
      0, -hh,   // top
      hw, 0,    // right
      0, hh,    // bottom
      -hw, 0,   // left
    ];
  }

  // ---- Entity rendering ----

  private renderEntities(): void {
    // Sort entities by depth key for correct rendering order
    const sorted = [...ENTITIES].sort((a, b) =>
      getDepthKey(a.tx, a.ty, this.getFootprint(a.textureKey))
      - getDepthKey(b.tx, b.ty, this.getFootprint(b.textureKey))
    );

    for (const ent of sorted) {
      this.placeEntity(ent);
    }
  }

  private placeEntity(ent: EntityDef): void {
    const profile = SPIKE_PROFILES[ent.textureKey];
    if (!profile) {
      console.warn(`No profile for entity: ${ent.textureKey}`);
      return;
    }

    const { x, y } = tileToScreen(ent.tx, ent.ty);
    const depth = getDepthKey(ent.tx, ent.ty, profile.footprint);

    // Determine if this is a sprite sheet (units) or a static image
    const isSpritesheet = ent.textureKey === 'harvester' || ent.textureKey === 'builder';

    if (isSpritesheet) {
      // Place sprite with first frame (idle)
      const sprite = this.add.sprite(x, y - profile.groundOffset, ent.textureKey, 0);
      sprite.setDisplaySize(profile.displayW, profile.displayH);
      sprite.setDepth(depth + 0.5); // slight offset so units render above terrain
      sprite.setOrigin(0.5, 1);     // center horizontally, bottom vertically (feet on ground)
    } else {
      // Static image
      const img = this.add.image(x, y - profile.groundOffset, ent.textureKey);
      img.setDisplaySize(profile.displayW, profile.displayH);
      img.setDepth(depth + 0.5); // render above terrain tile at same position
      img.setOrigin(0.5, 1);     // center horizontally, bottom anchored to ground
    }
  }

  private getFootprint(textureKey: string): number {
    const profile = SPIKE_PROFILES[textureKey];
    return profile ? profile.footprint : 1;
  }
}
