/** Camera with pan and zoom. No DOM dependencies. */

import {
  CAMERA_MIN_ZOOM,
  CAMERA_MAX_ZOOM,
  CAMERA_PAN_SPEED,
  CAMERA_ZOOM_STEP,
} from '../core/constants.js';
import { worldToCanvas, canvasToWorld, clamp } from '../core/coordinates.js';

export class Camera {
  x: number;
  y: number;
  zoom: number;

  constructor(x: number, y: number, zoom: number = 1.0) {
    this.x = x;
    this.y = y;
    this.zoom = clamp(zoom, CAMERA_MIN_ZOOM, CAMERA_MAX_ZOOM);
  }

  /** Pan camera by delta in world pixels. */
  pan(dx: number, dy: number): void {
    this.x += dx;
    this.y += dy;
  }

  /** Pan at CAMERA_PAN_SPEED for the given dt (seconds). Direction: -1, 0, +1. */
  panDirection(dirX: number, dirY: number, dt: number): void {
    this.pan(dirX * CAMERA_PAN_SPEED * dt, dirY * CAMERA_PAN_SPEED * dt);
  }

  /** Zoom at a specific canvas point, preserving that point's world coordinate. */
  zoomAt(delta: number, canvasX: number, canvasY: number, canvasW: number, canvasH: number): void {
    const worldBefore = canvasToWorld(canvasX, canvasY, this.x, this.y, this.zoom, canvasW, canvasH);
    this.zoom = clamp(this.zoom + delta * CAMERA_ZOOM_STEP, CAMERA_MIN_ZOOM, CAMERA_MAX_ZOOM);
    const worldAfter = canvasToWorld(canvasX, canvasY, this.x, this.y, this.zoom, canvasW, canvasH);
    this.x += worldBefore.x - worldAfter.x;
    this.y += worldBefore.y - worldAfter.y;
  }

  /** World (screen) coords → canvas pixel coords. */
  toCanvas(sx: number, sy: number, canvasW: number, canvasH: number) {
    return worldToCanvas(sx, sy, this.x, this.y, this.zoom, canvasW, canvasH);
  }

  /** Canvas pixel coords → world (screen) coords. */
  toWorld(cx: number, cy: number, canvasW: number, canvasH: number) {
    return canvasToWorld(cx, cy, this.x, this.y, this.zoom, canvasW, canvasH);
  }
}
