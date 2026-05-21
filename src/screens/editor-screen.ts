/**
 * MAP-EDITOR-ARCH-01 PR1 — Editor screen shell.
 *
 * Dev-only screen for viewing a generated map preview.
 * Camera pan/zoom works. No placement, removal, save/load, or gameplay.
 *
 * Availability: same guard as dev panel (DEV / test / ?devtools=1).
 */

import type { Screen, ScreenTransitionData, EditorScreenData } from '../types/screens.js';
import type { NavigateFn } from '../core/screen-manager.js';
import { MAP_SIZE_STANDARD, MAP_SIZE_LARGE, ASSET_MANIFEST } from '../core/constants.js';
import { tileToScreen } from '../core/coordinates.js';
import { AssetStore } from '../core/assets.js';
import { generateMap } from '../game/mapgen.js';
import { createResourceNodeStates } from '../systems/harvesting.js';
import { Camera } from '../render/camera.js';
import { editorPreviewRender } from '../render/editor-preview.js';

function resolveMapSize(mapSize: string): number {
  return mapSize === 'large' ? MAP_SIZE_LARGE : MAP_SIZE_STANDARD;
}

export function createEditorScreen(navigate: NavigateFn): Screen {
  let camera: Camera | null = null;
  let assets: AssetStore | null = null;
  let animFrameId: number | null = null;
  let mapWidth = 0;
  let mapHeight = 0;

  // Input state
  const keys = new Set<string>();
  let isPanning = false;
  let panStartX = 0;
  let panStartY = 0;
  let camPanStartX = 0;
  let camPanStartY = 0;

  // Bound handlers for cleanup
  let boundKeyDown: ((e: KeyboardEvent) => void) | null = null;
  let boundKeyUp: ((e: KeyboardEvent) => void) | null = null;
  let boundMouseDown: ((e: MouseEvent) => void) | null = null;
  let boundMouseMove: ((e: MouseEvent) => void) | null = null;
  let boundMouseUp: (() => void) | null = null;
  let boundWheel: ((e: WheelEvent) => void) | null = null;
  let boundResize: (() => void) | null = null;

  // Map data — stored for render loop
  let mapData: ReturnType<typeof generateMap> | null = null;
  let resourceNodes: ReturnType<typeof createResourceNodeStates> | null = null;

  return {
    id: 'editor-screen',

    async mount(container: HTMLElement, data: ScreenTransitionData): Promise<void> {
      const editorData = data as EditorScreenData | null;
      const mapSize = editorData?.mapSize ?? 'standard';
      const size = resolveMapSize(mapSize);

      // Generate map and resource node states
      mapData = generateMap(size, size, 'cyan');
      resourceNodes = createResourceNodeStates(mapData.resources);
      mapWidth = mapData.width;
      mapHeight = mapData.height;

      // Create wrapper
      const wrapper = document.createElement('div');
      wrapper.className = 'screen screen--editor';

      // Create canvas
      const canvas = document.createElement('canvas');
      canvas.className = 'screen__canvas';
      canvas.id = 'editor-canvas';
      canvas.style.cursor = 'grab';
      wrapper.appendChild(canvas);

      // Editor overlay UI
      const overlay = document.createElement('div');
      overlay.className = 'editor-overlay';
      overlay.id = 'editor-overlay';

      const title = document.createElement('h2');
      title.className = 'editor-overlay__title';
      title.textContent = 'Редактор карты';
      overlay.appendChild(title);

      const info = document.createElement('div');
      info.className = 'editor-overlay__info';
      info.id = 'editor-info';
      info.innerHTML =
        `<span>Размер: ${mapWidth}×${mapHeight}</span>` +
        `<span>Ресурсы: ${mapData.resources.length}</span>` +
        `<span>Препятствия: ${mapData.obstacles.length}</span>`;
      overlay.appendChild(info);

      const btnBack = document.createElement('button');
      btnBack.className = 'btn btn--back editor-overlay__back';
      btnBack.id = 'editor-back-btn';
      btnBack.textContent = 'В меню';
      btnBack.addEventListener('click', () => navigate('main-menu', null));
      overlay.appendChild(btnBack);

      wrapper.appendChild(overlay);
      container.appendChild(wrapper);

      // Setup canvas context
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Cannot get 2D context for editor canvas');

      // Load assets
      const store = new AssetStore();
      await store.loadManifest(ASSET_MANIFEST);
      assets = store;

      // Setup camera — center on map center
      const centerScreen = tileToScreen(mapWidth / 2, mapHeight / 2);
      camera = new Camera(centerScreen.x, centerScreen.y);

      // Setup event handlers
      boundKeyDown = (e: KeyboardEvent) => { keys.add(e.code); };
      boundKeyUp = (e: KeyboardEvent) => { keys.delete(e.code); };
      boundMouseDown = (e: MouseEvent) => {
        if (e.button === 1 || e.button === 2) {
          isPanning = true;
          panStartX = e.clientX;
          panStartY = e.clientY;
          camPanStartX = camera!.x;
          camPanStartY = camera!.y;
          canvas.style.cursor = 'grabbing';
        }
      };
      boundMouseMove = (e: MouseEvent) => {
        if (!isPanning || !camera) return;
        const dx = e.clientX - panStartX;
        const dy = e.clientY - panStartY;
        camera.x = camPanStartX - dx / camera.zoom;
        camera.y = camPanStartY - dy / camera.zoom;
      };
      boundMouseUp = () => {
        if (isPanning) {
          isPanning = false;
          canvas.style.cursor = 'grab';
        }
      };
      boundWheel = (e: WheelEvent) => {
        e.preventDefault();
        if (!camera) return;
        const delta = e.deltaY > 0 ? -1 : 1;
        const rect = canvas.getBoundingClientRect();
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;
        camera.zoomAt(delta, cx, cy, canvas.width, canvas.height);
      };
      boundResize = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      };

      window.addEventListener('keydown', boundKeyDown);
      window.addEventListener('keyup', boundKeyUp);
      canvas.addEventListener('mousedown', boundMouseDown);
      window.addEventListener('mousemove', boundMouseMove);
      window.addEventListener('mouseup', boundMouseUp);
      canvas.addEventListener('wheel', boundWheel, { passive: false });
      window.addEventListener('resize', boundResize);

      // Initial resize
      boundResize();

      // Start render loop
      const loop = () => {
        if (!camera || !mapData || !assets) return;

        // Keyboard pan
        let dx = 0;
        let dy = 0;
        if (keys.has('KeyW') || keys.has('ArrowUp')) dy -= 1;
        if (keys.has('KeyS') || keys.has('ArrowDown')) dy += 1;
        if (keys.has('KeyA') || keys.has('ArrowLeft')) dx -= 1;
        if (keys.has('KeyD') || keys.has('ArrowRight')) dx += 1;
        if (dx !== 0 || dy !== 0) camera.panDirection(dx, dy, 0.016);

        // Render editor preview
        editorPreviewRender(ctx, mapData, camera, assets, resourceNodes ?? undefined);

        animFrameId = requestAnimationFrame(loop);
      };
      animFrameId = requestAnimationFrame(loop);
    },

    unmount(): void {
      if (animFrameId !== null) {
        cancelAnimationFrame(animFrameId);
        animFrameId = null;
      }

      // Remove event listeners
      if (boundKeyDown) window.removeEventListener('keydown', boundKeyDown);
      if (boundKeyUp) window.removeEventListener('keyup', boundKeyUp);
      if (boundMouseDown) {
        const canvas = document.getElementById('editor-canvas');
        if (canvas) canvas.removeEventListener('mousedown', boundMouseDown);
      }
      if (boundMouseMove) window.removeEventListener('mousemove', boundMouseMove);
      if (boundMouseUp) window.removeEventListener('mouseup', boundMouseUp);
      if (boundWheel) {
        const canvas = document.getElementById('editor-canvas');
        if (canvas) canvas.removeEventListener('wheel', boundWheel);
      }
      if (boundResize) window.removeEventListener('resize', boundResize);

      keys.clear();
      isPanning = false;
      camera = null;
      assets = null;
      mapData = null;
      resourceNodes = null;

      boundKeyDown = null;
      boundKeyUp = null;
      boundMouseDown = null;
      boundMouseMove = null;
      boundMouseUp = null;
      boundWheel = null;
      boundResize = null;
    },
  };
}
