/**
 * GameScene — main spike scene.
 * Stage 2: 48×48 isometric map, static entities, camera pan/zoom,
 *          harvester movement with spritesheet animation, dynamic depth sorting,
 *          debug HUD overlay.
 */
import Phaser from 'phaser';
import { TILE_W, TILE_H, MAP_SIZE, tileToScreen, screenToTile, getDepthKey, getMapWorldBounds } from '../iso/IsoUtils.js';
import { SPIKE_PROFILES, type SpikeProfile } from '../profiles/PhaserProfiles.js';
import { directionToRow, directionName, DIRECTION_NAMES, type DirectionName } from '../iso/DirectionUtils.js';

// ─── Camera config ────────────────────────────────────────────────
const CAM_PAN_SPEED = 500;       // world pixels per second
const CAM_ZOOM_MIN = 0.4;
const CAM_ZOOM_MAX = 3.0;
const CAM_ZOOM_STEP = 0.08;
const CAM_LERP = 0.1;

// ─── Harvester movement config ────────────────────────────────────
const HARVESTER_SPEED = 100;      // world pixels per second
const GATHER_DURATION = 2000;     // ms to pause at mineral (gathering)
const UNLOAD_DURATION = 1000;     // ms to pause at HQ (unloading)

// ─── Harvester state machine ──────────────────────────────────────
type HarvesterState = 'moving_to_mineral' | 'gathering' | 'returning' | 'unloading';

/** Hardcoded route waypoints in tile coordinates. */
const ROUTE_HQ_TILE = { tx: 6, ty: 6 };         // near HQ (5,5)
const ROUTE_MINERAL_TILE = { tx: 8, ty: 4 };    // mineral_small at (8,4)

/** Harvester runtime data. */
interface HarvesterData {
  sprite: Phaser.GameObjects.Sprite;
  state: HarvesterState;
  /** Current world position (pixel coordinates). */
  worldX: number;
  worldY: number;
  /** Target world position for movement phases. */
  targetX: number;
  targetY: number;
  /** Timer for gathering/unloading pauses (ms remaining). */
  pauseTimer: number;
  /** Current facing direction row (0-7). */
  dirRow: number;
  /** Current depth value. */
  depth: number;
}

// ─── Static entity placements ─────────────────────────────────────
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
  // Rock on harvester route for depth-sorted overlap testing
  { textureKey: 'rock_cluster', tx: 7, ty: 5 },
  // Builder near HQ (static, no animation yet)
  { textureKey: 'builder', tx: 7, ty: 5 },
];

// ─── GameScene ────────────────────────────────────────────────────

export class GameScene extends Phaser.Scene {
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };
  private camTargetX = 0;
  private camTargetY = 0;

  /** Harvester runtime state — the single moving unit for this spike. */
  private harvester!: HarvesterData;

  /** Fake resource counter. */
  private rawCount = 30;

  /** HTML HUD element references. */
  private hudRaw!: HTMLElement;
  private hudState!: HTMLElement;
  private hudDirection!: HTMLElement;
  private hudDepth!: HTMLElement;

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

    // HTML HUD references
    this.hudRaw = document.getElementById('hud-raw')!;
    this.hudState = document.getElementById('hud-state')!;
    this.hudDirection = document.getElementById('hud-direction')!;
    this.hudDepth = document.getElementById('hud-depth')!;

    // Render isometric map
    this.renderMap();

    // Render static entities (excluding harvester — handled separately)
    this.renderStaticEntities();

    // Create harvester with state machine
    this.createHarvester();

    // Update HUD with initial values
    this.updateHud();
  }

  update(_time: number, delta: number): void {
    this.handleCameraPan(delta);
    this.updateHarvester(delta);
    this.updateHud();
  }

  // ─── Camera ──────────────────────────────────────────────────────

  private handleCameraPan(delta: number): void {
    const dt = delta / 1000;
    let dx = 0;
    let dy = 0;

    if (this.cursors.left.isDown || this.wasd.A.isDown) dx -= 1;
    if (this.cursors.right.isDown || this.wasd.D.isDown) dx += 1;
    if (this.cursors.up.isDown || this.wasd.W.isDown) dy -= 1;
    if (this.cursors.down.isDown || this.wasd.S.isDown) dy += 1;

    if (dx !== 0 || dy !== 0) {
      const len = Math.sqrt(dx * dx + dy * dy);
      dx /= len;
      dy /= len;
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

  // ─── Map rendering ───────────────────────────────────────────────

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
          0xd9c67a,
        );
        diamond.setDepth(getDepthKey(tx, ty, 1));
        diamond.setOrigin(0, 0);

        // Overlay sand tile sprite if loaded
        if (this.textures.exists('sand_tile')) {
          const tile = this.add.image(x, y, 'sand_tile');
          tile.setDisplaySize(TILE_W, TILE_H);
          tile.setDepth(getDepthKey(tx, ty, 1));
          tile.setOrigin(0.5, 0);
        }
      }
    }
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

  // ─── Static entity rendering ─────────────────────────────────────

  private renderStaticEntities(): void {
    // Sort entities by depth key for correct rendering order.
    // The harvester is handled separately by the state machine.
    const staticEntities = ENTITIES.filter(e => e.textureKey !== 'harvester');
    const sorted = [...staticEntities].sort((a, b) =>
      getDepthKey(a.tx, a.ty, this.getFootprint(a.textureKey))
      - getDepthKey(b.tx, b.ty, this.getFootprint(b.textureKey))
    );

    for (const ent of sorted) {
      this.placeStaticEntity(ent);
    }
  }

  private placeStaticEntity(ent: EntityDef): void {
    const profile = SPIKE_PROFILES[ent.textureKey];
    if (!profile) {
      console.warn(`No profile for entity: ${ent.textureKey}`);
      return;
    }

    const { x, y } = tileToScreen(ent.tx, ent.ty);
    const depth = getDepthKey(ent.tx, ent.ty, profile.footprint);

    const isSpritesheet = ent.textureKey === 'builder';

    if (isSpritesheet) {
      const sprite = this.add.sprite(x, y - profile.groundOffset, ent.textureKey, 0);
      sprite.setDisplaySize(profile.displayW, profile.displayH);
      sprite.setDepth(depth + 0.5);
      sprite.setOrigin(0.5, 1);
    } else {
      const img = this.add.image(x, y - profile.groundOffset, ent.textureKey);
      img.setDisplaySize(profile.displayW, profile.displayH);
      img.setDepth(depth + 0.5);
      img.setOrigin(0.5, 1);
    }
  }

  // ─── Harvester ───────────────────────────────────────────────────

  private createHarvester(): void {
    const profile = SPIKE_PROFILES['harvester']!;
    const startPos = tileToScreen(ROUTE_HQ_TILE.tx, ROUTE_HQ_TILE.ty);
    const depth = getDepthKey(ROUTE_HQ_TILE.tx, ROUTE_HQ_TILE.ty, profile.footprint);

    // Use texture key 'harvester' with south-idle frame (row 2, col 0 → frame 16)
    // Animation keys like 'harvester_south_idle' are for .play(), not for sprite creation.
    const SOUTH_IDLE_FRAME = 2 * 8 + 0; // row 2 (south), col 0 (idle)
    const sprite = this.add.sprite(
      startPos.x,
      startPos.y - profile.groundOffset,
      'harvester',
      SOUTH_IDLE_FRAME,
    );
    sprite.setDisplaySize(profile.displayW, profile.displayH);
    sprite.setDepth(depth + 0.5);
    sprite.setOrigin(0.5, 1);
    sprite.play('harvester_south_idle');

    const mineralPos = tileToScreen(ROUTE_MINERAL_TILE.tx, ROUTE_MINERAL_TILE.ty);

    this.harvester = {
      sprite,
      state: 'moving_to_mineral',
      worldX: startPos.x,
      worldY: startPos.y,
      targetX: mineralPos.x,
      targetY: mineralPos.y,
      pauseTimer: 0,
      dirRow: 2, // south default
      depth,
    };
  }

  /**
   * Main harvester update — state machine with movement + depth sorting.
   *
   * Movement implementation: manual update loop (not Phaser tween).
   * Rationale: we need per-frame velocity for facing direction,
   *           continuous depth updates, and clean state transitions.
   *           A tween would require onComplete callbacks and wouldn't
   *           give us the velocity vector naturally.
   *
   * Depth sorting approach: every frame, convert the harvester's
   * current world position back to approximate tile coordinates
   * using screenToTile(), then recompute depth with getDepthKey().
   * This ensures correct front/behind rendering as the harvester
   * crosses tile boundaries during movement.
   */
  private updateHarvester(delta: number): void {
    const h = this.harvester;
    const dt = delta / 1000;

    switch (h.state) {
      case 'moving_to_mineral':
        this.moveHarvesterTowardTarget(h, dt);
        if (this.reachedTarget(h)) {
          h.state = 'gathering';
          h.pauseTimer = GATHER_DURATION;
          this.playHarvesterAnim(h, 'idle');
        }
        break;

      case 'gathering':
        h.pauseTimer -= delta;
        if (h.pauseTimer <= 0) {
          // Start returning to HQ
          const hqPos = tileToScreen(ROUTE_HQ_TILE.tx, ROUTE_HQ_TILE.ty);
          h.targetX = hqPos.x;
          h.targetY = hqPos.y;
          h.state = 'returning';
        }
        break;

      case 'returning':
        this.moveHarvesterTowardTarget(h, dt);
        if (this.reachedTarget(h)) {
          h.state = 'unloading';
          h.pauseTimer = UNLOAD_DURATION;
          this.playHarvesterAnim(h, 'unload');
        }
        break;

      case 'unloading':
        h.pauseTimer -= delta;
        if (h.pauseTimer <= 0) {
          // Increment fake resource counter
          this.rawCount += 1;

          // Start moving to mineral again
          const mineralPos = tileToScreen(ROUTE_MINERAL_TILE.tx, ROUTE_MINERAL_TILE.ty);
          h.targetX = mineralPos.x;
          h.targetY = mineralPos.y;
          h.state = 'moving_to_mineral';
        }
        break;
    }

    // Update depth every frame based on current world position
    this.updateHarvesterDepth(h);
  }

  /**
   * Move harvester toward its target position at HARVESTER_SPEED.
   * Also computes facing direction from the velocity vector and
   * switches the spritesheet animation accordingly.
   */
  private moveHarvesterTowardTarget(h: HarvesterData, dt: number): void {
    const dx = h.targetX - h.worldX;
    const dy = h.targetY - h.worldY;
    const dist = Math.hypot(dx, dy);

    if (dist < 1) {
      // Close enough — snap to target
      h.worldX = h.targetX;
      h.worldY = h.targetY;
    } else {
      // Move toward target at constant speed
      const step = Math.min(HARVESTER_SPEED * dt, dist);
      h.worldX += (dx / dist) * step;
      h.worldY += (dy / dist) * step;

      // Compute facing direction from world-space velocity.
      // Convert to tile-space direction for the spritesheet row:
      //   In isometric, screen X = (tx - ty) * TILE_W/2
      //   So screen dx maps to tile dx - dy. We simplify by using
      //   screen-to-tile conversion on two nearby points.
      const currentTile = screenToTile(h.worldX, h.worldY);
      const aheadTile = screenToTile(h.worldX + dx * 0.1, h.worldY + dy * 0.1);
      const tileDx = aheadTile.tx - currentTile.tx;
      const tileDy = aheadTile.ty - currentTile.ty;

      const newRow = directionToRow(tileDx, tileDy);
      h.dirRow = newRow;
      // Always ensure 'move' animation is playing while the harvester is
      // in a movement state — direction may not change but phase must.
      this.playHarvesterAnim(h, 'move');
    }

    // Update sprite position
    const profile = SPIKE_PROFILES['harvester']!;
    h.sprite.setPosition(h.worldX, h.worldY - profile.groundOffset);
  }

  /** Check if harvester has reached its target within a small threshold. */
  private reachedTarget(h: HarvesterData): boolean {
    const dx = h.targetX - h.worldX;
    const dy = h.targetY - h.worldY;
    return Math.hypot(dx, dy) < 2;
  }

  /**
   * Update harvester depth based on current approximate tile position.
   * This ensures correct isometric depth sorting while the harvester
   * moves across tile boundaries.
   */
  private updateHarvesterDepth(h: HarvesterData): void {
    const approxTile = screenToTile(h.worldX, h.worldY);
    const profile = SPIKE_PROFILES['harvester']!;
    h.depth = getDepthKey(approxTile.tx, approxTile.ty, profile.footprint);
    h.sprite.setDepth(h.depth + 0.5);
  }

  /** Play the appropriate animation for the current direction + phase. */
  private playHarvesterAnim(h: HarvesterData, phase: 'idle' | 'move' | 'unload'): void {
    const dir = directionName(h.dirRow);
    const animKey = `harvester_${dir}_${phase}`;
    if (h.sprite.anims.currentAnim?.key !== animKey) {
      h.sprite.play(animKey);
    }
  }

  // ─── HUD ─────────────────────────────────────────────────────────

  private updateHud(): void {
    this.hudRaw.textContent = String(this.rawCount);
    this.hudState.textContent = this.harvester.state;
    this.hudDirection.textContent = directionName(this.harvester.dirRow);
    this.hudDepth.textContent = this.harvester.depth.toFixed(1);
  }

  // ─── Helpers ─────────────────────────────────────────────────────

  private getFootprint(textureKey: string): number {
    const profile = SPIKE_PROFILES[textureKey];
    return profile ? profile.footprint : 1;
  }
}
