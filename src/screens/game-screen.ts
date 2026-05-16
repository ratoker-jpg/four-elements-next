import type { Screen, ScreenTransitionData, GameScreenData } from '../types/screens.js';
import type { NavigateFn } from '../core/screen-manager.js';

export function createGameScreen(navigate: NavigateFn): Screen {
  let cleanup: (() => void) | null = null;

  return {
    id: 'game-screen',

    mount(container: HTMLElement, data: ScreenTransitionData): void {
      const gameData = data as GameScreenData | null;
      const mapSize = gameData?.mapSize ?? 'standard';
      const faction = gameData?.faction ?? 'cyan';

      const wrapper = document.createElement('div');
      wrapper.className = 'screen screen--game';

      const canvas = document.createElement('canvas');
      canvas.className = 'screen__canvas';
      canvas.id = 'game-canvas';
      wrapper.appendChild(canvas);

      const overlay = document.createElement('div');
      overlay.className = 'screen__overlay';
      overlay.textContent = `Game Screen Placeholder — Map: ${mapSize}, Faction: ${faction}`;
      wrapper.appendChild(overlay);

      const btnBack = document.createElement('button');
      btnBack.className = 'btn btn--back screen__back-btn';
      btnBack.textContent = 'Back to Menu';
      btnBack.addEventListener('click', () => navigate('main-menu', null));
      wrapper.appendChild(btnBack);

      container.appendChild(wrapper);

      resizeCanvas(canvas);
      drawPlaceholder(canvas);

      const onResize = () => {
        resizeCanvas(canvas);
        drawPlaceholder(canvas);
      };
      window.addEventListener('resize', onResize);
      cleanup = () => window.removeEventListener('resize', onResize);
    },

    unmount(): void {
      if (cleanup) {
        cleanup();
        cleanup = null;
      }
    },
  };
}

function resizeCanvas(canvas: HTMLCanvasElement): void {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

function drawPlaceholder(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}
