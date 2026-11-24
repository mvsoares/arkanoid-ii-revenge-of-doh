import { sound } from './audio/soundEngine';
import { InputManager } from './core/input';
import { ConstructionSetEditor } from './editor/constructionSet';
import { GameEngine } from './game/gameEngine';
import { PostProcessor } from './rendering/postProcess';
import { GameRenderer } from './rendering/renderer';
import { decodeStageFromUrlParam } from './stages/codec';
import { SECTOR_NODES } from './stages/sectorGraph';
import { DipSettingsModal } from './ui/dipModal';

function bootstrap(): void {
  const gameCanvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  const glCanvas = document.getElementById('gl-canvas') as HTMLCanvasElement;
  const uiOverlay = document.getElementById('ui-overlay') as HTMLElement;

  let musicBooted = false;
  const input = new InputManager(gameCanvas, () => {
    sound.unlock();
    if (!musicBooted && engine.screen === 'attract') {
      musicBooted = true;
      sound.startMusic('attract');
    }
  });

  const renderer = new GameRenderer(gameCanvas);
  const postProcessor = new PostProcessor(gameCanvas, glCanvas);

  let editor: ConstructionSetEditor;
  let dipModal: DipSettingsModal;

  const engine = new GameEngine(input, {
    openEditor: (stage) => {
      sound.stopMusic();
      editor.open(stage);
    },
    openSettings: (currentSettings) => {
      dipModal.open(currentSettings);
    },
    closeSettings: () => {
      dipModal.close();
    },
  });

  editor = new ConstructionSetEditor(uiOverlay, {
    onPlaytest: (stage) => {
      editor.close();
      engine.launchSharedOrEditorStage(stage, true);
    },
    onExit: () => {
      editor.close();
      engine.returnToAttract();
    },
    onUiSound: () => sound.uiClick(),
  });

  dipModal = new DipSettingsModal(uiOverlay, {
    onChange: (next) => {
      engine.saveSettings(next);
    },
    onResetScores: () => {
      engine.resetHighScores();
    },
    onClose: () => {
      engine.closeSettingsScreen();
    },
    onUiSound: () => sound.uiClick(),
  });

  // Check if URL has a shared Construction Set level (?level=...)
  try {
    const params = new URLSearchParams(window.location.search);
    const encodedLevel = params.get('level');
    if (encodedLevel) {
      const sharedStage = decodeStageFromUrlParam(encodedLevel);
      if (sharedStage) {
        engine.launchSharedOrEditorStage(sharedStage, false);
      }
    }
  } catch {
    // Ignore malformed query param
  }

  let lastTime = performance.now();
  const frame = (now: number) => {
    const dt = (now - lastTime) / 1000;
    lastTime = now;

    engine.update(dt);
    const snap = engine.getRenderSnapshot();
    renderer.render(snap, SECTOR_NODES.values());
    postProcessor.render(snap.settings, snap.time, snap.chromaPulse);

    requestAnimationFrame(frame);
  };

  requestAnimationFrame(frame);
}

bootstrap();
