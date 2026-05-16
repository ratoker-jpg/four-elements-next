import './styles/main.css';
import { ScreenManager } from './core/screen-manager.js';
import { createMainMenuScreen } from './screens/main-menu.js';
import { createMapSizeScreen } from './screens/map-size.js';
import { createFactionSelectScreen } from './screens/faction-select.js';
import { createSettingsScreen } from './screens/settings.js';
import { createGameScreen } from './screens/game-screen.js';

const root = document.getElementById('app');
if (!root) throw new Error('#app element not found');

const manager = new ScreenManager(root);
const navigate = manager.show.bind(manager);

manager.addScreen(createMainMenuScreen(navigate));
manager.addScreen(createMapSizeScreen(navigate));
manager.addScreen(createFactionSelectScreen(navigate));
manager.addScreen(createSettingsScreen(navigate));
manager.addScreen(createGameScreen(navigate));

manager.start('main-menu');
