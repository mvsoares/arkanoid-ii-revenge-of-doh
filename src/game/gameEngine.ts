import {
  BALL_RADIUS,
  BASE_BALL_SPEED,
  BONUS_WARP_H,
  BONUS_WARP_Y,
  BRICK_COLORS,
  BRICK_H,
  BRICK_POINTS,
  BRICK_W,
  CANVAS_H,
  CANVAS_W,
  CAPSULE_META,
  DEFAULT_DIP_SWITCHES,
  HATCH_LEFT_X,
  HATCH_RIGHT_X,
  MAX_BALL_SPEED,
  PHYSICS_DT,
  PLAYFIELD_BOTTOM,
  PLAYFIELD_RIGHT,
  PLAYFIELD_W,
  PLAYFIELD_X,
  PLAYFIELD_Y,
  STORAGE_KEYS,
  VAUS_BASE_W,
  VAUS_H,
  VAUS_Y,
  WARP_GATE_H,
  WARP_GATE_Y,
} from '../constants';
import { sound } from '../audio/soundEngine';
import { InputManager } from '../core/input';
import {
  collideBallWithBoss,
  collideLasersWithBoss,
  createBoss,
  updateBoss,
} from '../entities/bosses';
import {
  applyVausBounce,
  enforceBallVelocityBounds,
  sweepCircleAABB,
  updateMovingBricks,
} from '../physics/collision';
import { CAMPAIGN_STAGES } from '../stages/stageCatalog';
import {
  generateProceduralStage,
  getNextStageId,
  getStageById,
  ROGUELITE_AUGMENTS,
  SECTOR_NODES,
} from '../stages/sectorGraph';
import type {
  AttractPage,
  BallState,
  BossState,
  BrickKind,
  BrickRuntime,
  CapsuleEntity,
  CapsuleType,
  DipSwitchSettings,
  EnemyEntity,
  EnemyKind,
  FloatingText,
  GamePlayMode,
  HighScoreEntry,
  LaserBolt,
  Particle,
  RenderSnapshot,
  RogueliteAugment,
  ScreenState,
  StageDefinition,
  VausState,
} from '../types';

interface RewindFrame {
  bricks: BrickRuntime[];
  paddles: VausState[];
  balls: BallState[];
  lasers: LaserBolt[];
  capsules: CapsuleEntity[];
  enemies: EnemyEntity[];
  boss: BossState | null;
  scores: [number, number];
  barrierHits: number;
}

interface PlayerBoardSave {
  stageId: number;
  bricks: BrickRuntime[];
  routeHistory: number[];
  reserveCapsule: CapsuleType | null;
}

const DEFAULT_HIGH_SCORES: HighScoreEntry[] = [
  { initials: 'DOH', score: 150000, round: '34', mode: 'CAMPAIGN', ruleset: 'evolved' },
  { initials: 'TAI', score: 120000, round: '28L', mode: 'CAMPAIGN', ruleset: 'purist' },
  { initials: 'VAU', score: 95000, round: '22R', mode: 'CO-OP', ruleset: 'evolved' },
  { initials: 'MIX', score: 80000, round: '18', mode: 'CAMPAIGN', ruleset: 'evolved' },
  { initials: 'XRG', score: 65000, round: '17L', mode: 'ROGUELITE', ruleset: 'evolved' },
  { initials: 'SUI', score: 50000, round: '14R', mode: 'CAMPAIGN', ruleset: 'purist' },
  { initials: 'ARK', score: 40000, round: '11L', mode: 'CAMPAIGN', ruleset: 'evolved' },
  { initials: 'ZUN', score: 30000, round: '8L', mode: 'BOSS RUSH', ruleset: 'evolved' },
  { initials: 'NEO', score: 22000, round: '6R', mode: 'CAMPAIGN', ruleset: 'evolved' },
  { initials: '198', score: 15000, round: '4L', mode: 'CAMPAIGN', ruleset: 'purist' },
];

const ALL_CAPSULES: CapsuleType[] = [
  'E', 'L', 'C', 'S', 'B', 'D', 'P', 'M', 'T', 'I', 'N', 'R', '?', 'G',
];

const DEFAULT_CAPSULE_WEIGHTS: Record<CapsuleType, number> = {
  E: 16,
  L: 15,
  C: 12,
  S: 11,
  D: 10,
  T: 8,
  I: 8,
  N: 6,
  M: 5,
  B: 3.5,
  R: 5,
  '?': 4,
  P: 2.2,
  G: 1.8,
};

export interface EngineExternalHooks {
  openEditor: (stage?: StageDefinition) => void;
  openSettings: (settings: DipSwitchSettings) => void;
  closeSettings: () => void;
}

export class GameEngine {
  private input: InputManager;
  private hooks: EngineExternalHooks;

  public screen: ScreenState = 'attract';
  private attractPage: AttractPage = 'title';
  private attractTimer = 0;
  private introTimer = 0;
  private time = 0;
  private accumulator = 0;
  private hitStopTimer = 0;

  private credits = 2;
  public settings: DipSwitchSettings = { ...DEFAULT_DIP_SWITCHES };
  private playMode: GamePlayMode = 'campaign';

  private stage: StageDefinition = CAMPAIGN_STAGES[0];
  private editorReturnStage: StageDefinition | null = null;
  private loopNumber = 1;
  private rogueliteFloor = 1;
  private bossRushIdx = 0;

  private activePlayer: 0 | 1 = 0;
  private arcade2pBoards: [PlayerBoardSave | null, PlayerBoardSave | null] = [null, null];
  private scores: [number, number] = [0, 0];
  private nextExtraLifeScore: [number, number] = [20000, 20000];
  private lives: [number, number] = [3, 3];
  private settingsReturnScreen: ScreenState = 'attract';
  private hoveredMapStageId: number | null = null;
  private hoverAugmentIdx = -1;

  private highScores: HighScoreEntry[] = [...DEFAULT_HIGH_SCORES];
  private discoveredStageIds = new Set<number>([1]);
  private routeHistory: number[] = [1];

  private reserveCapsule: CapsuleType | null = null;
  private infiniteSplitActive = false;
  private needMercyDrop = false;

  private activeAugments: RogueliteAugment[] = [];
  private draftOptions: RogueliteAugment[] = [];

  private bricks: BrickRuntime[] = [];
  private paddles: VausState[] = [];
  private balls: BallState[] = [];
  private lasers: LaserBolt[] = [];
  private capsules: CapsuleEntity[] = [];
  private enemies: EnemyEntity[] = [];
  private boss: ReturnType<typeof createBoss> | null = null;

  private particles: Particle[] = [];
  private floatingTexts: FloatingText[] = [];

  private nextUid = 1;
  private enemySpawnTimer = 4.5;
  private hatchLeftOpen = 0;
  private hatchRightOpen = 0;
  private warpLeftOpen = 0;
  private warpRightOpen = 0;
  private bonusWarpOpen = 0;
  private barrierHits = 0;

  private repulsorWave: { x: number; y: number; radius: number; alpha: number } | null = null;
  private magneticActive: 0 | 1 | -1 = 0;
  private stalemateTimer = 0;
  private orbitalStrikeFx: { x: number; y: number; alpha: number } | null = null;

  private rewindBuffer: RewindFrame[] = [];
  private rewindRecordTimer = 0;
  private rewindCharges = 3;
  private rewindActive = false;
  private rewindPlaybackAccum = 0;

  private bannerText: string | null = null;
  private bannerSubText: string | null = null;
  private bannerTimer = 0;

  private shakeMag = 0;
  private shakeX = 0;
  private shakeY = 0;
  private chromaPulse = 0;

  private initialsInput = 'AAA';
  private selectedMenuIdx = 0;
  private selectedMapStageId = 1;

  constructor(input: InputManager, hooks: EngineExternalHooks) {
    this.input = input;
    this.hooks = hooks;
    this.loadPersistence();
    this.setupAttractDemoBoard();
  }

  private loadPersistence(): void {
    try {
      const savedSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (savedSettings) {
        this.settings = { ...DEFAULT_DIP_SWITCHES, ...JSON.parse(savedSettings) };
      }
      const savedScores = localStorage.getItem(STORAGE_KEYS.HIGH_SCORES);
      if (savedScores) {
        const parsed = JSON.parse(savedScores);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.highScores = parsed;
        }
      }
      const savedDiscovered = localStorage.getItem(STORAGE_KEYS.DISCOVERED_STAGES);
      if (savedDiscovered) {
        const arr = JSON.parse(savedDiscovered);
        if (Array.isArray(arr)) {
          for (const id of arr) this.discoveredStageIds.add(Number(id));
        }
      }
    } catch {
      // Ignore storage errors
    }
    sound.setVolumes(this.settings.masterVolume, this.settings.sfxVolume, this.settings.musicVolume);
  }

  public saveSettings(next: DipSwitchSettings): void {
    this.settings = { ...next };
    sound.setVolumes(this.settings.masterVolume, this.settings.sfxVolume, this.settings.musicVolume);
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(this.settings));
    } catch {
      // Ignore
    }
  }

  public resetHighScores(): void {
    this.highScores = [...DEFAULT_HIGH_SCORES];
    try {
      localStorage.setItem(STORAGE_KEYS.HIGH_SCORES, JSON.stringify(this.highScores));
    } catch {
      // Ignore
    }
  }

  private saveDiscovered(): void {
    try {
      localStorage.setItem(
        STORAGE_KEYS.DISCOVERED_STAGES,
        JSON.stringify(Array.from(this.discoveredStageIds))
      );
    } catch {
      // Ignore
    }
  }

  private hasAugment(id: string): boolean {
    return this.activeAugments.some((a) => a.id === id);
  }

  public launchSharedOrEditorStage(customStage: StageDefinition, fromEditor = false): void {
    this.playMode = fromEditor ? 'editor_test' : 'practice';
    this.editorReturnStage = fromEditor ? customStage : null;
    this.loopNumber = 1;
    this.scores = [0, 0];
    this.lives = [3, 3];
    this.activeAugments = [];
    this.reserveCapsule = null;
    this.loadStage(customStage, true);
    this.screen = 'playing';
    this.input.requestPointerLockIfAllowed(this.settings.pointerLock);
  }

  public returnToAttract(): void {
    this.input.exitPointerLock();
    this.input.setCursorStyle('default');
    this.screen = 'attract';
    this.attractPage = 'title';
    this.attractTimer = 0;
    this.setupAttractDemoBoard();
    sound.startMusic('attract');
  }

  public closeSettingsScreen(): void {
    if (this.screen !== 'settings') return;
    this.screen = this.settingsReturnScreen;
    if (this.screen === 'attract') {
      this.attractTimer = 0;
    }
  }

  private setupAttractDemoBoard(): void {
    this.stage = getStageById(1);
    this.buildStageEntities(this.stage);
    this.paddles = [this.createVaus(0)];
    this.balls = [this.createBall(this.paddles[0], false)];
    // Auto-launch ball for AI demo
    this.releaseCaughtBalls(0);
  }

  private createVaus(playerIndex: 0 | 1): VausState {
    const center = PLAYFIELD_X + PLAYFIELD_W * 0.5;
    const offset = this.playMode === 'coop2p' ? (playerIndex === 0 ? -70 : 70) : 0;
    const vaus: VausState = {
      playerIndex,
      x: center + offset,
      y: VAUS_Y,
      vx: 0,
      w: VAUS_BASE_W,
      h: VAUS_H,
      enlargeLevel: this.hasAugment('wide_chassis') ? 1 : 0,
      reduced: false,
      laserLevel: this.hasAugment('plasma_cannons') ? 1 : 0,
      catchActive: false,
      twinActive: this.hasAugment('twin_link'),
      illusionActive: false,
      stunTimer: 0,
      mercyShieldTimer: 0,
      laserCooldown: 0,
      autoVulcanTimer: 0,
      repulsorCooldown: 0,
      repulsorMaxCooldown: this.hasAugment('emp_capacitor') ? 5.5 : 10.0,
      magneticEnergy: 100,
      illusions: [],
      muzzleFlash: 0,
    };
    this.recalcVausWidth(vaus);
    return vaus;
  }

  private recalcVausWidth(vaus: VausState): void {
    let mult = 1.0;
    if (vaus.reduced) mult = 0.6;
    else if (vaus.enlargeLevel === 1) mult = 1.48;
    else if (vaus.enlargeLevel === 2) mult = 1.92;

    if (vaus.twinActive) {
      mult = Math.max(mult, 1.85);
    }
    vaus.w = Math.round(VAUS_BASE_W * mult);
  }

  private createBall(vaus: VausState, caught = true): BallState {
    const roundSpeedBoost = Math.min(160, (this.stage.round - 1) * 4.2 + (this.loopNumber - 1) * 65);
    const puristExtra = this.settings.ruleset === 'purist' ? 18 : 0;
    const kineticBoost = this.hasAugment('kinetic_boost') ? 32 : 0;
    const speed = BASE_BALL_SPEED + roundSpeedBoost + puristExtra + kineticBoost;
    const angle = (24 * Math.PI) / 180;

    return {
      id: this.nextUid++,
      x: vaus.x + 8,
      y: vaus.y - vaus.h * 0.5 - BALL_RADIUS - 1,
      vx: Math.sin(angle) * speed,
      vy: -Math.cos(angle) * speed,
      speed,
      radius: BALL_RADIUS,
      mega: false,
      caughtBy: caught ? vaus.playerIndex : null,
      catchOffsetX: 8,
      catchTimer: 4.0,
      bounceCount: 0,
      nonDestructiveHits: 0,
      comboCount: 0,
      pierceCrit: this.hasAugment('pierce_rounds'),
      trail: [],
    };
  }

  private buildStageEntities(stage: StageDefinition): void {
    this.bricks = [];
    for (const bp of stage.bricks) {
      const x = PLAYFIELD_X + bp.col * BRICK_W;
      const y = PLAYFIELD_Y + bp.row * BRICK_H;
      let defaultHp = 1;
      if (bp.kind === 'silver') {
        defaultHp = Math.min(5, 2 + Math.floor((stage.round - 1) / 9) + (this.loopNumber - 1));
      } else if (bp.kind === 'regen') {
        defaultHp = 2;
      } else if (bp.kind === 'gold') {
        defaultHp = 999;
      }
      const maxHp = bp.hits ?? defaultHp;

      this.bricks.push({
        uid: this.nextUid++,
        col: bp.col,
        row: bp.row,
        x,
        y,
        w: BRICK_W,
        h: BRICK_H,
        kind: bp.kind,
        hp: maxHp,
        maxHp,
        alive: true,
        regenTimer: 0,
        hitFlash: 0,
        shimmerPhase: (bp.col * 0.35 + bp.row * 0.2) % (Math.PI * 2),
        moving: bp.moving
          ? {
              minX: PLAYFIELD_X + bp.moving.minCol * BRICK_W,
              maxX: PLAYFIELD_X + (bp.moving.maxCol + 1) * BRICK_W,
              vx: bp.moving.speed * BRICK_W * bp.moving.dir,
            }
          : undefined,
        capsule: bp.capsule,
      });
    }

    this.lasers = [];
    this.capsules = [];
    this.enemies = [];
    this.particles = [];
    this.floatingTexts = [];
    this.warpLeftOpen = 0;
    this.warpRightOpen = 0;
    this.bonusWarpOpen = 0;
    this.hatchLeftOpen = 0;
    this.hatchRightOpen = 0;
    this.enemySpawnTimer = 3.8;
    this.stalemateTimer = 0;
    this.orbitalStrikeFx = null;
    this.repulsorWave = null;
    this.infiniteSplitActive = false;
    this.rewindBuffer = [];
    this.rewindCharges = this.settings.ruleset === 'evolved' ? 3 : 0;
    this.barrierHits = this.hasAugment('safety_barrier') ? 2 : 0;

    if (stage.boss) {
      this.boss = createBoss(stage.boss, 1 + (this.loopNumber - 1) * 0.45);
    } else {
      this.boss = null;
    }
  }

  public startNewGame(mode: GamePlayMode, startStageId = 1): void {
    this.playMode = mode;
    this.loopNumber = 1;
    this.rogueliteFloor = 1;
    this.bossRushIdx = 0;
    this.activePlayer = 0;
    this.arcade2pBoards = [null, null];
    this.scores = [0, 0];
    this.nextExtraLifeScore = [20000, 20000];
    this.lives = mode === 'arcade2p' ? [3, 3] : [3, 0];
    if (mode === 'coop2p') this.lives = [4, 0]; // Shared 4-life pool in Co-Op
    this.input.setCursorStyle('default');
    this.reserveCapsule = this.settings.ruleset === 'evolved' && this.settings.reserveCapsule ? 'E' : null;
    this.activeAugments = [];
    this.routeHistory = [startStageId];
    this.needMercyDrop = false;

    sound.startGame();

    if (mode === 'bossrush') {
      const suireiStage = getStageById(32); // 17L Suirei
      this.reserveCapsule = 'L';
      this.loadStage(suireiStage, true);
      this.screen = 'playing';
      this.input.requestPointerLockIfAllowed(this.settings.pointerLock);
    } else if (mode === 'roguelite') {
      const procStage = generateProceduralStage(1);
      this.loadStage(procStage, true);
      this.screen = 'playing';
      this.input.requestPointerLockIfAllowed(this.settings.pointerLock);
    } else if (mode === 'campaign' && startStageId === 1) {
      this.introTimer = 0;
      this.screen = 'intro_story';
      sound.startMusic('sector');
    } else {
      const st = getStageById(startStageId);
      this.loadStage(st, true);
      this.screen = 'playing';
      this.input.requestPointerLockIfAllowed(this.settings.pointerLock);
    }
  }

  private loadStage(stage: StageDefinition, resetPaddles: boolean): void {
    this.stage = stage;
    if (stage.id >= 1 && stage.id <= 64) {
      this.discoveredStageIds.add(stage.id);
      this.saveDiscovered();
    }
    this.buildStageEntities(stage);

    if (resetPaddles || this.paddles.length === 0) {
      this.paddles =
        this.playMode === 'coop2p'
          ? [this.createVaus(0), this.createVaus(1)]
          : [this.createVaus(0)];
    } else {
      // Reposition paddles cleanly and keep upgrades in Evolved mode (reset in Purist!)
      if (this.settings.ruleset === 'purist') {
        this.paddles =
          this.playMode === 'coop2p'
            ? [this.createVaus(0), this.createVaus(1)]
            : [this.createVaus(0)];
      } else {
        const center = PLAYFIELD_X + PLAYFIELD_W * 0.5;
        this.paddles.forEach((p, idx) => {
          p.x = center + (this.playMode === 'coop2p' ? (idx === 0 ? -70 : 70) : 0);
          p.illusions = [];
          p.stunTimer = 0;
        });
      }
    }

    this.balls = [this.createBall(this.paddles[0], true)];

    this.bannerText = `ROUND ${stage.branchLabel} — ${stage.name.toUpperCase()}`;
    this.bannerSubText = stage.subtitle;
    this.bannerTimer = 2.4;

    sound.stageIntro();
    if (stage.boss === 'doh') {
      sound.startMusic('boss_doh1');
    } else if (stage.boss) {
      sound.startMusic('boss_mid');
    } else {
      sound.startMusic('sector');
    }
  }

  public update(rawDt: number): void {
    const clampedDt = Math.min(0.05, Math.max(0, rawDt));
    this.time += clampedDt;

    // Global hotkeys
    if (this.input.wasJustPressed('F2')) {
      this.settings.visualPreset =
        this.settings.visualPreset === 'hd_neon' ? 'crt_1987' : 'hd_neon';
      this.saveSettings(this.settings);
      sound.uiClick();
    }

    if (this.input.wasJustPressed('KeyC') || this.input.wasJustPressed('Digit5')) {
      this.credits = Math.min(99, this.credits + 1);
      sound.coin();
    }

    // Screen shake & chroma decay
    if (this.shakeMag > 0) {
      this.shakeMag = Math.max(0, this.shakeMag - clampedDt * 28);
      const amt = this.shakeMag * this.settings.screenShake;
      this.shakeX = (Math.random() * 2 - 1) * amt;
      this.shakeY = (Math.random() * 2 - 1) * amt;
    } else {
      this.shakeX = 0;
      this.shakeY = 0;
    }
    if (this.chromaPulse > 0) {
      this.chromaPulse = Math.max(0, this.chromaPulse - clampedDt * 2.5);
    }
    if (this.bannerTimer > 0) {
      this.bannerTimer = Math.max(0, this.bannerTimer - clampedDt);
    }

    switch (this.screen) {
      case 'attract':
        this.updateAttract(clampedDt);
        break;
      case 'intro_story':
        this.updateIntroStory(clampedDt);
        break;
      case 'playing':
      case 'stage_clear_warp':
        this.updateGameplayFrame(clampedDt);
        break;
      case 'sector_map':
        this.updateSectorMap();
        break;
      case 'augment_draft':
        this.updateAugmentDraft();
        break;
      case 'paused':
        this.updatePaused();
        break;
      case 'game_over':
      case 'victory':
        this.updateEndScreen();
        break;
      case 'high_score_entry':
        this.updateHighScoreEntry();
        break;
      case 'editor':
      case 'settings':
        this.input.setCursorStyle('default');
        if (this.input.wasJustPressed('Escape') && this.screen === 'settings') {
          this.hooks.closeSettings();
          this.closeSettingsScreen();
        }
        break;
    }

    this.input.endFrame();
  }

  private updateAttract(dt: number): void {
    this.attractTimer += dt;
    const pages: AttractPage[] = ['title', 'story', 'capsules', 'demo', 'highscores'];

    // Stay on title if user recently moved menu selection
    const pageDuration = this.attractPage === 'title' ? 14 : this.attractPage === 'demo' ? 16 : 9;
    if (this.attractTimer >= pageDuration) {
      this.attractTimer = 0;
      const idx = (pages.indexOf(this.attractPage) + 1) % pages.length;
      this.attractPage = pages[idx];
      if (this.attractPage === 'demo') {
        this.setupAttractDemoBoard();
      }
    }

    if (this.attractPage === 'demo') {
      this.stepDemoAi(dt);
    }

    // Menu Navigation on Title (or wake back to Title from any attract page)
    const menuCount = 8;
    if (this.input.wasJustPressed('ArrowUp') || this.input.wasJustPressed('KeyW')) {
      if (this.attractPage !== 'title') {
        this.attractPage = 'title';
      } else {
        this.selectedMenuIdx = (this.selectedMenuIdx - 1 + menuCount) % menuCount;
      }
      this.attractTimer = 0;
      sound.uiClick();
    }
    if (this.input.wasJustPressed('ArrowDown') || this.input.wasJustPressed('KeyS')) {
      if (this.attractPage !== 'title') {
        this.attractPage = 'title';
      } else {
        this.selectedMenuIdx = (this.selectedMenuIdx + 1) % menuCount;
      }
      this.attractTimer = 0;
      sound.uiClick();
    }

    if (this.input.wasJustPressed('Tab')) {
      this.settings.ruleset = this.settings.ruleset === 'evolved' ? 'purist' : 'evolved';
      this.settings.upgradeStacking = this.settings.ruleset === 'evolved';
      this.settings.reserveCapsule = this.settings.ruleset === 'evolved';
      this.settings.stalemateBreaker = this.settings.ruleset === 'evolved';
      this.settings.discreteBounceZones = this.settings.ruleset === 'purist';
      this.saveSettings(this.settings);
      this.attractTimer = 0;
      sound.uiClick();
    }

    const cursor = this.input.getCursorPos();
    let hoverPointer = false;
    if (cursor && this.attractPage === 'title') {
      if (cursor.x >= PLAYFIELD_X + 46 && cursor.x <= PLAYFIELD_RIGHT - 46 && cursor.y >= 314 && cursor.y <= 314 + menuCount * 40) {
        const hoverIdx = Math.floor((cursor.y - 314) / 40);
        if (hoverIdx >= 0 && hoverIdx < menuCount) {
          hoverPointer = true;
          if (cursor.moved && this.selectedMenuIdx !== hoverIdx) {
            this.selectedMenuIdx = hoverIdx;
            this.attractTimer = 0;
          }
        }
      }
    }
    this.input.setCursorStyle(hoverPointer || this.attractPage !== 'title' ? 'pointer' : 'default');

    const click = this.input.wasMouseClicked();
    if (click) {
      if (this.attractPage !== 'title') {
        this.attractPage = 'title';
        this.attractTimer = 0;
        sound.uiClick();
        return;
      }
      // Check if clicked on one of the 8 menu items in the center playfield (Y ~ 314..634)
      if (click.x >= PLAYFIELD_X && click.x <= PLAYFIELD_RIGHT && click.y >= 310 && click.y <= 646) {
        const clickedIdx = Math.floor((click.y - 314) / 40);
        if (clickedIdx >= 0 && clickedIdx < menuCount) {
          this.selectedMenuIdx = clickedIdx;
          this.triggerSelectedMenu();
          return;
        }
      }
    }

    if (
      this.input.wasJustPressed('Enter') ||
      this.input.wasJustPressed('Space') ||
      this.input.wasJustPressed('Digit1')
    ) {
      if (this.attractPage !== 'title') {
        this.attractPage = 'title';
        this.attractTimer = 0;
        sound.uiClick();
      } else {
        this.triggerSelectedMenu();
      }
    }
  }

  private triggerSelectedMenu(): void {
    sound.uiClick();
    switch (this.selectedMenuIdx) {
      case 0:
        this.startNewGame('campaign', 1);
        break;
      case 1:
        this.startNewGame('coop2p', 1);
        break;
      case 2:
        this.startNewGame('arcade2p', 1);
        break;
      case 3:
        this.startNewGame('bossrush', 32);
        break;
      case 4:
        this.startNewGame('roguelite', 1);
        break;
      case 5:
        this.selectedMapStageId = 1;
        this.screen = 'sector_map';
        break;
      case 6:
        this.screen = 'editor';
        this.hooks.openEditor(getStageById(1));
        break;
      case 7:
        this.settingsReturnScreen = 'attract';
        this.screen = 'settings';
        this.hooks.openSettings(this.settings);
        break;
    }
  }

  private stepDemoAi(dt: number): void {
    const subSteps = Math.max(1, Math.round(dt / PHYSICS_DT));
    for (let i = 0; i < subSteps; i++) {
      const vaus = this.paddles[0];
      if (vaus && this.balls.length > 0) {
        // Track lowest downward ball
        let targetBall = this.balls[0];
        for (const b of this.balls) {
          if (b.y > targetBall.y) targetBall = b;
        }
        const desiredX = targetBall.x + Math.sin(this.time * 2.7) * 18;
        const diff = desiredX - vaus.x;
        const maxMove = 520 * PHYSICS_DT;
        const move = Math.max(-maxMove, Math.min(maxMove, diff));
        vaus.vx = move / PHYSICS_DT;
        vaus.x = Math.max(
          PLAYFIELD_X + vaus.w * 0.5,
          Math.min(PLAYFIELD_RIGHT - vaus.w * 0.5, vaus.x + move)
        );
        if (vaus.laserLevel > 0 && vaus.laserCooldown <= 0) {
          this.fireVausLasers(vaus);
        }
      }
      this.stepPhysicsTick(PHYSICS_DT, true);
      if (this.balls.length === 0) {
        this.setupAttractDemoBoard();
        break;
      }
    }
  }

  private updateIntroStory(dt: number): void {
    this.introTimer += dt;
    const skip =
      this.input.wasJustPressed('Enter') ||
      this.input.wasJustPressed('Space') ||
      this.input.wasJustPressed('Escape') ||
      this.input.wasMouseClicked() !== null;
    if (skip || this.introTimer >= 6.5) {
      this.loadStage(getStageById(1), true);
      this.screen = 'playing';
      this.input.requestPointerLockIfAllowed(this.settings.pointerLock);
    }
  }

  private updateGameplayFrame(dt: number): void {
    if (this.input.wasJustPressed('Escape') || this.input.wasJustPressed('KeyP')) {
      if (this.playMode === 'editor_test' && this.editorReturnStage) {
        this.input.exitPointerLock();
        this.screen = 'editor';
        this.hooks.openEditor(this.editorReturnStage);
        return;
      }
      this.input.exitPointerLock();
      this.screen = 'paused';
      sound.uiClick();
      return;
    }

    // Re-engage pointer lock on canvas click during active play if enabled (unless tapping bottom touch bar)
    const activeClick = this.input.wasMouseClicked();
    if (activeClick && activeClick.isTouch && activeClick.y >= PLAYFIELD_BOTTOM - 28) {
      const p0 = this.paddles[0];
      if (activeClick.x >= PLAYFIELD_RIGHT - 86) {
        this.screen = 'paused';
        sound.uiClick();
        return;
      } else if (activeClick.x >= PLAYFIELD_RIGHT - 178 && p0) {
        if (this.settings.ruleset === 'evolved' && p0.repulsorCooldown <= 0) {
          this.triggerRepulsorWave(p0);
        }
      } else if (activeClick.x <= PLAYFIELD_X + 105 && p0) {
        if (
          this.settings.ruleset === 'evolved' &&
          this.settings.reserveCapsule &&
          this.reserveCapsule !== null
        ) {
          const cap = this.reserveCapsule;
          this.reserveCapsule = null;
          this.applyCapsulePowerup(cap, p0, true);
          this.spawnFloatingText(p0.x, p0.y - 26, `RESERVE: ${CAPSULE_META[cap].name}!`, '#ffe95c', 1.15);
        }
      }
    } else if (this.settings.pointerLock && !this.input.isPointerLocked && activeClick) {
      this.input.requestPointerLockIfAllowed(true);
    }

    // Tactical Rewind (hold Backspace)
    const wantRewind = this.input.isDown('Backspace');
    if (wantRewind && this.rewindBuffer.length > 0 && (this.rewindCharges > 0 || this.rewindActive)) {
      if (!this.rewindActive) {
        this.rewindActive = true;
        this.rewindCharges = Math.max(0, this.rewindCharges - 1);
        sound.rewind();
      }
      this.rewindPlaybackAccum += dt;
      while (this.rewindPlaybackAccum >= 0.03 && this.rewindBuffer.length > 0) {
        this.rewindPlaybackAccum -= 0.03;
        const snap = this.rewindBuffer.pop()!;
        this.restoreRewindFrame(snap);
      }
      return;
    } else {
      this.rewindActive = false;
    }

    if (this.hitStopTimer > 0) {
      this.hitStopTimer = Math.max(0, this.hitStopTimer - dt);
      this.updateCosmetics(dt);
      return;
    }

    // Record rewind snapshot every 0.06s
    this.rewindRecordTimer += dt;
    if (this.rewindRecordTimer >= 0.06 && this.settings.ruleset === 'evolved') {
      this.rewindRecordTimer = 0;
      this.pushRewindFrame();
    }

    // Player discrete button actions (once per visual frame)
    this.handlePlayerDiscreteActions(dt);

    // Fixed 240Hz physics sub-stepping
    const scaledDt = dt * this.settings.gameSpeed;
    this.accumulator = Math.min(0.1, this.accumulator + scaledDt);
    while (this.accumulator >= PHYSICS_DT) {
      this.accumulator -= PHYSICS_DT;
      this.stepPhysicsTick(PHYSICS_DT, false);
      if (this.screen !== 'playing' && this.screen !== 'stage_clear_warp') {
        break;
      }
    }

    this.updateCosmetics(scaledDt);
  }

  private handlePlayerDiscreteActions(dt: number): void {
    const coop = this.playMode === 'coop2p';
    this.magneticActive = 0;

    for (const vaus of this.paddles) {
      const inp = this.input.getPlayerInput(
        vaus.playerIndex,
        coop,
        this.settings.mouseSensitivity,
        !this.settings.pointerLock || !this.input.isPointerLocked
      );

      // Update Vaus horizontal position cleanly once per frame with sub-pixel smoothness
      const prevX = vaus.x;
      if (vaus.stunTimer <= 0) {
        let nextX = vaus.x;
        if (inp.moveDeltaX !== 0) {
          nextX += inp.moveDeltaX;
        } else if (inp.targetX !== null) {
          nextX = inp.targetX;
        } else if (inp.axisX !== 0) {
          const kbSpeed = inp.precision ? 340 : 660;
          nextX += inp.axisX * kbSpeed * dt;
        }

        // Allow sliding into Left/Right Warp Gates when open!
        const leftBound =
          this.warpLeftOpen > 0.8
            ? PLAYFIELD_X - 18
            : PLAYFIELD_X + vaus.w * 0.5;
        const rightBound =
          this.warpRightOpen > 0.8 || this.bonusWarpOpen > 0.8
            ? PLAYFIELD_RIGHT + 18
            : PLAYFIELD_RIGHT - vaus.w * 0.5;

        nextX = Math.max(leftBound, Math.min(rightBound, nextX));
        vaus.vx = dt > 1e-5 ? (nextX - prevX) / dt : 0;
        vaus.x = nextX;

        // Spawn Illusion after-images when moving fast
        if (vaus.illusionActive && Math.abs(vaus.vx) > 220) {
          if (
            vaus.illusions.length === 0 ||
            Math.abs(vaus.illusions[vaus.illusions.length - 1].x - vaus.x) > 22
          ) {
            vaus.illusions.push({
              x: prevX,
              y: vaus.y,
              w: vaus.w,
              h: vaus.h,
              ttl: 0.36,
              maxTtl: 0.36,
            });
          }
        }
      } else {
        vaus.vx = 0;
      }

      // Sync caught balls to paddle X
      for (const b of this.balls) {
        if (b.caughtBy === vaus.playerIndex) {
          b.x = Math.max(
            PLAYFIELD_X + b.radius,
            Math.min(PLAYFIELD_RIGHT - b.radius, vaus.x + b.catchOffsetX)
          );
          b.y = vaus.y - vaus.h * 0.5 - b.radius - 0.5;
        }
      }

      // Primary Fire: Release caught balls & fire lasers
      if (inp.firePressed) {
        const released = this.releaseCaughtBalls(vaus.playerIndex);
        if (!released && vaus.laserLevel > 0 && vaus.laserCooldown <= 0) {
          this.fireVausLasers(vaus);
        }
      } else if (inp.fireHeld && vaus.laserLevel > 0 && vaus.laserCooldown <= 0) {
        this.fireVausLasers(vaus);
      }

      // Deploy Reserve Capsule (or smart right-click fallback to EMP Repulsor if bay empty)
      let secondaryUsed = false;
      if (
        (inp.reservePressed || inp.smartSecondaryPressed) &&
        this.settings.ruleset === 'evolved' &&
        this.settings.reserveCapsule &&
        this.reserveCapsule !== null
      ) {
        const cap = this.reserveCapsule;
        this.reserveCapsule = null;
        this.applyCapsulePowerup(cap, vaus, true);
        this.spawnFloatingText(vaus.x, vaus.y - 26, `RESERVE: ${CAPSULE_META[cap].name}!`, '#ffe95c', 1.15);
        secondaryUsed = true;
      }

      // Repulsor EMP Wave
      if (
        (inp.repulsorPressed || (inp.smartSecondaryPressed && !secondaryUsed)) &&
        this.settings.ruleset === 'evolved' &&
        vaus.repulsorCooldown <= 0
      ) {
        this.triggerRepulsorWave(vaus);
      }

      // Magnetic Curve (Shatter tribute)
      if (inp.magneticDir !== 0 && this.settings.ruleset === 'evolved' && vaus.magneticEnergy > 2) {
        this.magneticActive = inp.magneticDir;
        sound.magneticHum();
        const drainRate = this.hasAugment('gravity_well') ? 16 : 28;
        vaus.magneticEnergy = Math.max(0, vaus.magneticEnergy - drainRate * dt);
        const pullStrength = this.hasAugment('gravity_well') ? 540 : 350;
        for (const b of this.balls) {
          if (b.caughtBy !== null) continue;
          if (inp.magneticDir === 1) {
            // Pull ball horizontally toward Vaus center X
            const dirX = Math.sign(vaus.x - b.x);
            b.vx += dirX * pullStrength * dt;
          } else {
            // Lift/deflect ball upward & outward
            b.vy -= pullStrength * 0.85 * dt;
          }
          enforceBallVelocityBounds(b);
        }
      } else {
        vaus.magneticEnergy = Math.min(100, vaus.magneticEnergy + 18 * dt);
      }
    }
  }

  private triggerRepulsorWave(vaus: VausState): void {
    vaus.repulsorCooldown = vaus.repulsorMaxCooldown;
    this.repulsorWave = { x: vaus.x, y: vaus.y, radius: 18, alpha: 1 };
    sound.repulsor();

    // Vaporize nearby unwanted capsules into bonus points & clear nearby enemies/projectiles
    for (const cap of this.capsules) {
      if (!cap.alive) continue;
      if (Math.hypot(cap.x - vaus.x, cap.y - vaus.y) <= 230) {
        cap.alive = false;
        this.awardPoints(500, vaus.playerIndex);
        this.spawnBurst(cap.x, cap.y, '#38f6ff', 10);
        this.spawnFloatingText(cap.x, cap.y, 'EMP +500', '#38f6ff');
      }
    }
    for (const en of this.enemies) {
      if (!en.alive) continue;
      if (Math.hypot(en.x - vaus.x, en.y - vaus.y) <= 220) {
        en.alive = false;
        this.awardPoints(400, vaus.playerIndex);
        this.spawnBurst(en.x, en.y, '#ff8f38', 14);
        sound.enemyDestroy();
      }
    }
    if (this.boss) {
      for (const proj of this.boss.projectiles) {
        if (Math.hypot(proj.x - vaus.x, proj.y - vaus.y) <= 200) {
          proj.alive = false;
          this.spawnBurst(proj.x, proj.y, '#5ceeff', 8);
        }
      }
    }
  }

  private releaseCaughtBalls(playerIndex: 0 | 1): boolean {
    let any = false;
    for (const b of this.balls) {
      if (b.caughtBy === playerIndex) {
        const vaus = this.paddles.find((p) => p.playerIndex === playerIndex) ?? this.paddles[0];
        b.caughtBy = null;
        if (vaus) {
          applyVausBounce(
            b,
            vaus,
            this.settings.discreteBounceZones,
            this.settings.ruleset === 'evolved'
          );
        }
        sound.paddleHit(0);
        any = true;
      }
    }
    return any;
  }

  private fireVausLasers(vaus: VausState): void {
    const activeCount = this.lasers.filter((l) => l.alive && l.playerIndex === vaus.playerIndex).length;
    if (activeCount >= 8) return;
    const hyper = vaus.laserLevel >= 2;
    vaus.laserCooldown = vaus.autoVulcanTimer > 0 ? 0.11 : hyper ? 0.18 : 0.23;
    vaus.muzzleFlash = 1.0;

    const offset = Math.max(12, vaus.w * 0.34);
    this.lasers.push(
      {
        x: vaus.x - offset,
        y: vaus.y - vaus.h * 0.5 - 4,
        vy: -740,
        hyper,
        playerIndex: vaus.playerIndex,
        alive: true,
      },
      {
        x: vaus.x + offset,
        y: vaus.y - vaus.h * 0.5 - 4,
        vy: -740,
        hyper,
        playerIndex: vaus.playerIndex,
        alive: true,
      }
    );
    sound.laserShoot(hyper);
  }

  private stepPhysicsTick(dt: number, isDemo: boolean): void {
    // 1. Update Paddle timers & Auto-Vulcan
    for (const vaus of this.paddles) {
      if (vaus.stunTimer > 0) vaus.stunTimer = Math.max(0, vaus.stunTimer - dt);
      if (vaus.mercyShieldTimer > 0) vaus.mercyShieldTimer = Math.max(0, vaus.mercyShieldTimer - dt);
      if (vaus.laserCooldown > 0) vaus.laserCooldown = Math.max(0, vaus.laserCooldown - dt);
      if (vaus.repulsorCooldown > 0) vaus.repulsorCooldown = Math.max(0, vaus.repulsorCooldown - dt);
      if (vaus.muzzleFlash > 0) vaus.muzzleFlash = Math.max(0, vaus.muzzleFlash - dt * 10);
      if (vaus.autoVulcanTimer > 0) {
        vaus.autoVulcanTimer = Math.max(0, vaus.autoVulcanTimer - dt);
        if (vaus.laserCooldown <= 0) {
          this.fireVausLasers(vaus);
        }
      }
      for (const ill of vaus.illusions) {
        ill.ttl -= dt;
      }
      vaus.illusions = vaus.illusions.filter((g) => g.ttl > 0);
    }

    // 2. Update Moving Bricks & Regenerating Notched Silver Bricks
    updateMovingBricks(this.bricks, dt);
    for (const b of this.bricks) {
      b.shimmerPhase += dt * 2.5;
      if (b.hitFlash > 0) b.hitFlash = Math.max(0, b.hitFlash - dt * 6);
      if (b.kind === 'regen') {
        if (!b.alive && b.regenTimer > 0) {
          b.regenTimer -= dt;
          if (b.regenTimer <= 0) {
            // Ensure no ball is currently inside the cell before respawning
            const blocked = this.balls.some(
              (ball) =>
                ball.x + ball.radius > b.x &&
                ball.x - ball.radius < b.x + b.w &&
                ball.y + ball.radius > b.y &&
                ball.y - ball.radius < b.y + b.h
            );
            if (!blocked) {
              b.alive = true;
              b.hp = b.maxHp;
              b.hitFlash = 1;
              if (!isDemo) sound.brickRegen();
            } else {
              b.regenTimer = 0.5;
            }
          }
        } else if (b.alive && b.hp < b.maxHp && b.regenTimer > 0) {
          b.regenTimer -= dt;
          if (b.regenTimer <= 0) {
            b.hp = b.maxHp;
            b.hitFlash = 0.8;
            if (!isDemo) sound.brickRegen();
          }
        }
      }
    }

    // 3. Check Warp Gate Entry when open!
    if (!isDemo) {
      for (const vaus of this.paddles) {
        if (this.warpLeftOpen > 0.8 && vaus.x - vaus.w * 0.5 <= PLAYFIELD_X - 8) {
          this.completeStageViaGate('left');
          return;
        }
        if (this.warpRightOpen > 0.8 && vaus.x + vaus.w * 0.5 >= PLAYFIELD_RIGHT + 8) {
          this.completeStageViaGate('right');
          return;
        }
        if (this.bonusWarpOpen > 0.8 && vaus.x + vaus.w * 0.5 >= PLAYFIELD_RIGHT + 8) {
          this.awardPoints(10000, vaus.playerIndex);
          this.spawnFloatingText(PLAYFIELD_RIGHT - 60, BONUS_WARP_Y, 'BREAK WARP +10,000!', '#f55cff', 1.3);
          this.completeStageViaGate('right');
          return;
        }
      }
    }

    // 4. Update Lasers
    this.stepLasers(dt, isDemo);

    // 5. Update Balls
    this.stepBalls(dt, isDemo);

    // 6. Infinite Split ('N' Capsule) regeneration check
    if (
      this.infiniteSplitActive &&
      this.balls.length > 0 &&
      this.balls.length < 3 &&
      this.balls.every((b) => b.caughtBy === null)
    ) {
      const donor = this.balls[0];
      while (this.balls.length < 3) {
        const spread = (this.balls.length === 1 ? -0.28 : 0.28);
        const baseAng = Math.atan2(donor.vy, donor.vx) + spread;
        this.balls.push({
          ...donor,
          id: this.nextUid++,
          vx: Math.cos(baseAng) * donor.speed,
          vy: Math.sin(baseAng) * donor.speed,
          trail: [],
        });
      }
    }

    // 7. Update Capsules
    this.stepCapsules(dt, isDemo);

    // 8. Update Hatch Enemies
    this.stepEnemies(dt, isDemo);

    // 9. Update Boss
    if (this.boss) {
      const ev = updateBoss(
        this.boss,
        dt,
        this.paddles,
        this.settings.ruleset,
        1 + (this.loopNumber - 1) * 0.45
      );
      if (ev.spawnEnemy) this.spawnEnemyFromHatch();
      if (ev.roar && !isDemo) sound.bossRoar();
      if (ev.phase2Transform) {
        this.shakeMag = 14;
        this.chromaPulse = 1.0;
        this.bannerText = 'WARNING: DOH MUTATION DETECTED!';
        this.bannerSubText = 'SEVER THE REGENERATING TENTACLES TO EXPOSE THE HEART!';
        this.bannerTimer = 3.2;
        this.spawnBurst(this.boss.x, this.boss.y, '#ff2e63', 45);
        if (!isDemo) sound.startMusic('boss_doh2');
      }
      if (ev.paddleHitByProjectile && !isDemo) {
        const hitP = this.paddles.find((p) => p.playerIndex === ev.paddleHitByProjectile!.playerIndex);
        if (hitP) {
          if (ev.paddleHitByProjectile.lethal) {
            // Classic 1987 Purist lethal DOH fireball!
            this.balls = [];
            this.handleAllBallsLost();
            return;
          } else {
            // Evolved Mode: Stun + knock off Enlarge instead of cheap instant-kill
            hitP.stunTimer = 0.65;
            if (hitP.enlargeLevel > 0) {
              hitP.enlargeLevel = (hitP.enlargeLevel - 1) as 0 | 1;
              this.recalcVausWidth(hitP);
            }
            this.shakeMag = 6;
            this.spawnBurst(hitP.x, hitP.y, '#58e8ff', 14);
            sound.bossHit(false);
          }
        }
      }
      if (ev.deathExplosion && !isDemo) {
        this.spawnBurst(ev.deathExplosion.x, ev.deathExplosion.y, '#ffbe38', 18);
        this.spawnBurst(ev.deathExplosion.x, ev.deathExplosion.y, '#ff3d6e', 10);
        this.shakeMag = Math.max(this.shakeMag, 8);
        this.chromaPulse = Math.max(this.chromaPulse, 0.45);
        sound.bossHit(true);
      }
      if (ev.bossDestroyed && !isDemo) {
        this.awardPoints(this.boss.kind === 'doh' ? 50000 : 20000, 0);
        this.spawnBurst(this.boss.x, this.boss.y, '#ffde38', 70);
        this.boss = null;
        this.onAllObjectivesCleared();
        return;
      }
    }

    // 10. Check Stage Clear & Stalemate Orbital Breaker
    if (!isDemo && !this.boss && this.screen === 'playing') {
      const remaining = this.countRequiredBricks();
      if (remaining === 0) {
        this.onAllObjectivesCleared();
      } else if (
        remaining <= 2 &&
        this.settings.ruleset === 'evolved' &&
        this.settings.stalemateBreaker
      ) {
        this.stalemateTimer += dt;
        if (this.stalemateTimer >= 20) {
          this.triggerStalemateOrbitalStrike();
        }
      } else {
        this.stalemateTimer = 0;
      }
    }

    // 11. Check All Balls Drained
    if (!isDemo && this.balls.length === 0 && this.screen === 'playing') {
      this.handleAllBallsLost();
    }
  }

  private countRequiredBricks(): number {
    let count = 0;
    for (const b of this.bricks) {
      // Gold and Regenerating Notched Silver bricks do NOT block stage completion (authentic Arkanoid II!)
      if (b.alive && b.kind !== 'gold' && b.kind !== 'regen') {
        count++;
      }
    }
    return count;
  }

  private triggerStalemateOrbitalStrike(): void {
    this.stalemateTimer = 0;
    const target = this.bricks.find((b) => b.alive && b.kind !== 'gold' && b.kind !== 'regen');
    if (target) {
      target.alive = false;
      target.hp = 0;
      this.orbitalStrikeFx = { x: target.x + target.w * 0.5, y: target.y + target.h * 0.5, alpha: 1 };
      this.spawnBurst(target.x + target.w * 0.5, target.y + target.h * 0.5, '#38f8ff', 28);
      this.spawnFloatingText(
        PLAYFIELD_X + PLAYFIELD_W * 0.5,
        PLAYFIELD_Y + 110,
        'MIXTEC ORBITAL BREAKER!',
        '#38f8ff',
        1.2
      );
      this.awardPoints(500, 0);
      sound.stalemateStrike();
      if (this.countRequiredBricks() === 0) {
        this.onAllObjectivesCleared();
      }
    }
  }

  private onAllObjectivesCleared(): void {
    if (this.playMode === 'editor_test' && this.editorReturnStage) {
      sound.warpOpen();
      this.bannerText = 'PLAYTEST STAGE CLEARED!';
      this.bannerSubText = 'RETURNING TO CONSTRUCTION SET...';
      this.bannerTimer = 2.0;
      setTimeout(() => {
        if (this.playMode === 'editor_test' && this.editorReturnStage) {
          this.input.exitPointerLock();
          this.screen = 'editor';
          this.hooks.openEditor(this.editorReturnStage);
        }
      }, 1400);
      return;
    }

    if (this.playMode === 'bossrush') {
      const sequence = [32, 33, 64]; // Suirei -> Sentinel -> DOH
      this.bossRushIdx++;
      if (this.bossRushIdx >= sequence.length) {
        this.triggerVictory();
      } else {
        sound.warpEnter();
        this.loadStage(getStageById(sequence[this.bossRushIdx]), false);
      }
      return;
    }

    if (this.playMode === 'roguelite') {
      sound.warpOpen();
      this.draftOptions = this.pickAugmentDraftOptions();
      this.input.exitPointerLock();
      this.screen = 'augment_draft';
      return;
    }

    if (this.stage.id === 64 || this.stage.boss === 'doh') {
      this.triggerVictory();
      return;
    }

    // Open BOTH Left and Right Warp Gates on the bottom walls!
    if (this.warpLeftOpen === 0 && this.warpRightOpen === 0) {
      // Vaporize active balls/enemies into celebratory sparks so player glides cleanly into chosen Warp Gate
      for (const b of this.balls) {
        this.spawnBurst(b.x, b.y, '#6ceeff', 12);
      }
      for (const en of this.enemies) {
        this.spawnBurst(en.x, en.y, '#ffe14d', 10);
      }
      this.balls = [];
      this.lasers = [];
      this.enemies = [];
      this.infiniteSplitActive = false;

      this.warpLeftOpen = 1;
      this.warpRightOpen = 1;
      this.screen = 'stage_clear_warp';
      this.bannerText = 'SECTOR CLEARED — CHOOSE WARP GATE!';
      this.bannerSubText = '◄ SLIDE LEFT FOR L-SECTOR   |   SLIDE RIGHT FOR R-SECTOR ►';
      this.bannerTimer = 6.0;
      sound.warpOpen();
    }
  }

  private completeStageViaGate(gate: 'left' | 'right'): void {
    sound.warpEnter();
    if (this.playMode === 'practice') {
      this.selectedMapStageId = this.stage.id;
      this.input.exitPointerLock();
      this.screen = 'sector_map';
      return;
    }

    const nextId = getNextStageId(this.stage.id, gate);
    if (!nextId) {
      this.triggerVictory();
      return;
    }
    this.routeHistory.push(nextId);
    const nextStage = getStageById(nextId);
    this.screen = 'playing';
    this.loadStage(nextStage, false);
  }

  private triggerVictory(): void {
    this.input.exitPointerLock();
    this.screen = 'victory';
    sound.startMusic('victory');
  }

  private handleAllBallsLost(): void {
    sound.playerLoseLife();
    this.shakeMag = 10;
    this.chromaPulse = 0.8;
    this.infiniteSplitActive = false;

    const pIdx = this.playMode === 'arcade2p' ? this.activePlayer : 0;
    this.lives[pIdx]--;

    if (this.lives[pIdx] <= 0) {
      if (this.playMode === 'arcade2p') {
        const other: 0 | 1 = pIdx === 0 ? 1 : 0;
        if (this.lives[other] > 0) {
          this.swapArcade2pPlayer(other, false);
          return;
        }
      }
      // Game Over!
      this.input.exitPointerLock();
      this.input.setCursorStyle('default');
      sound.stopMusic();
      sound.gameOver();
      if (this.qualifiesForHighScore(this.getBestSessionScore())) {
        this.initialsInput = '';
        this.input.clearChars();
        this.screen = 'high_score_entry';
      } else {
        this.screen = 'game_over';
      }
      return;
    }

    // Alternating 2P swap on death (preserving independent boards & stage progress!)
    if (this.playMode === 'arcade2p') {
      const other: 0 | 1 = this.activePlayer === 0 ? 1 : 0;
      if (this.lives[other] > 0) {
        this.swapArcade2pPlayer(other, true);
        return;
      }
    }

    // Respawn Vaus & Ball — with Evolved Anti-"Death Spiral" Mercy System!
    this.lasers = [];
    this.capsules = [];
    this.paddles =
      this.playMode === 'coop2p'
        ? [this.createVaus(0), this.createVaus(1)]
        : [this.createVaus(0)];

    if (this.settings.ruleset === 'evolved') {
      const mercyDur = this.hasAugment('mercy_aegis') ? 6.0 : 3.5;
      for (const p of this.paddles) {
        p.mercyShieldTimer = mercyDur;
      }
      if (this.stage.round >= 10 || this.boss !== null) {
        this.needMercyDrop = true;
        this.barrierHits = Math.max(this.barrierHits, 1);
        if (this.reserveCapsule === null && this.settings.reserveCapsule) {
          this.reserveCapsule = 'L';
        }
      }
    }

    this.balls = [this.createBall(this.paddles[0], true)];
  }

  private stepBalls(dt: number, isDemo: boolean): void {
    const survivingBalls: BallState[] = [];

    for (const ball of this.balls) {
      if (ball.caughtBy !== null) {
        ball.catchTimer -= dt;
        if (ball.catchTimer <= 0) {
          const holder =
            this.paddles.find((p) => p.playerIndex === ball.caughtBy) ?? this.paddles[0];
          ball.caughtBy = null;
          if (holder) {
            applyVausBounce(
              ball,
              holder,
              this.settings.discreteBounceZones,
              this.settings.ruleset === 'evolved'
            );
          }
        }
        survivingBalls.push(ball);
        continue;
      }

      // Record ribbon trail every few ticks
      if (
        ball.trail.length === 0 ||
        Math.hypot(ball.x - ball.trail[ball.trail.length - 1].x, ball.y - ball.trail[ball.trail.length - 1].y) > 5
      ) {
        ball.trail.push({ x: ball.x, y: ball.y });
        if (ball.trail.length > 12) ball.trail.shift();
      }

      const dx = ball.vx * dt;
      const dy = ball.vy * dt;

      // 1. Check Swept Brick Collisions (find earliest t)
      let earliestHit: { brick: BrickRuntime; t: number; nx: number; ny: number; cx: number; cy: number } | null =
        null;

      for (const brick of this.bricks) {
        if (!brick.alive) continue;
        const hit = sweepCircleAABB(
          ball.x,
          ball.y,
          dx,
          dy,
          ball.radius,
          brick.x,
          brick.y,
          brick.w,
          brick.h
        );
        if (hit && (!earliestHit || hit.t < earliestHit.t)) {
          earliestHit = {
            brick,
            t: hit.t,
            nx: hit.nx,
            ny: hit.ny,
            cx: hit.contactX,
            cy: hit.contactY,
          };
        }
      }

      if (earliestHit) {
        const { brick, nx, ny, cx, cy } = earliestHit;
        const isMegaPlow = ball.mega; // Mega Ball plows through ALL bricks including Gold!

        if (!isMegaPlow) {
          ball.x = cx + nx * 0.6;
          ball.y = cy + ny * 0.6;
          if (nx !== 0) ball.vx = Math.abs(ball.vx) * nx;
          if (ny !== 0) ball.vy = Math.abs(ball.vy) * ny;
          // Remaining fraction step
          const rem = 1 - earliestHit.t;
          ball.x += ball.vx * dt * rem;
          ball.y += ball.vy * dt * rem;
        } else {
          ball.x += dx;
          ball.y += dy;
        }

        this.damageBrickWithBall(brick, ball, isDemo);
      } else {
        ball.x += dx;
        ball.y += dy;
      }

      // 2. Boss Collision
      if (this.boss) {
        const bRes = collideBallWithBoss(
          ball,
          this.boss,
          dt,
          1 + (this.loopNumber - 1) * 0.45
        );
        if (bRes) {
            if (bRes.goldBounce) {
              if (!isDemo) sound.goldClang();
              this.spawnBurst(bRes.hitX, bRes.hitY, '#ffd84d', 6);
            } else {
              this.awardPoints(bRes.pointsAwarded, ball.lastHitBy ?? 0);
            this.spawnBurst(bRes.hitX, bRes.hitY, bRes.hitCore ? '#ff3870' : '#4df5ff', 14);
            if (!isDemo) sound.bossHit(bRes.hitCore);
            if (bRes.hitCore && this.settings.hitStop) {
              this.hitStopTimer = 0.024;
              this.shakeMag = Math.max(this.shakeMag, 5);
            }
            if (bRes.transformedToPhase2) {
              this.shakeMag = 15;
              this.chromaPulse = 1.0;
              this.bannerText = 'WARNING: DOH MUTATION DETECTED!';
              this.bannerSubText = 'SEVER THE REGENERATING TENTACLES TO EXPOSE THE HEART!';
              this.bannerTimer = 3.2;
              if (!isDemo) sound.startMusic('boss_doh2');
            }
            // Occasional helpful capsule drop during prolonged boss battles
            if (bRes.hitCore && Math.random() < 0.22) {
              this.spawnCapsule(bRes.hitX, bRes.hitY);
            }
          }
        }
      }

      // 3. Wall Collisions
      let hitWall = false;
      if (ball.x - ball.radius <= PLAYFIELD_X) {
        ball.x = PLAYFIELD_X + ball.radius;
        ball.vx = Math.abs(ball.vx);
        hitWall = true;
      } else if (ball.x + ball.radius >= PLAYFIELD_RIGHT) {
        ball.x = PLAYFIELD_RIGHT - ball.radius;
        ball.vx = -Math.abs(ball.vx);
        hitWall = true;
      }
      if (ball.y - ball.radius <= PLAYFIELD_Y) {
        ball.y = PLAYFIELD_Y + ball.radius;
        ball.vy = Math.abs(ball.vy);
        hitWall = true;
      }
      if (hitWall) {
        ball.nonDestructiveHits++;
        if (!isDemo) sound.wallHit();
      }

      // 4. Vaus Paddle & Illusion Ghost Collisions
      if (ball.vy > 0) {
        let bouncedOnPaddle = false;
        for (const vaus of this.paddles) {
          if (
            ball.x + ball.radius >= vaus.x - vaus.w * 0.5 &&
            ball.x - ball.radius <= vaus.x + vaus.w * 0.5 &&
            ball.y + ball.radius >= vaus.y - vaus.h * 0.5 &&
            ball.y - ball.radius <= vaus.y + vaus.h * 0.5 + 4
          ) {
            ball.bounceCount++;
            // Gentle arcade speed escalation
            if (ball.bounceCount % 4 === 0) {
              ball.speed = Math.min(MAX_BALL_SPEED, ball.speed + 8);
            }

            if (vaus.catchActive && !isDemo) {
              ball.caughtBy = vaus.playerIndex;
              ball.lastHitBy = vaus.playerIndex;
              ball.catchOffsetX = Math.max(-vaus.w * 0.42, Math.min(vaus.w * 0.42, ball.x - vaus.x));
              ball.catchTimer = 4.2;
              ball.comboCount = 0;
              ball.nonDestructiveHits = 0;
              sound.paddleHit(0);
            } else {
              ball.lastHitBy = vaus.playerIndex;
              const norm = applyVausBounce(
                ball,
                vaus,
                this.settings.discreteBounceZones,
                this.settings.ruleset === 'evolved'
              );
              if (!isDemo) sound.paddleHit(norm);
            }
            bouncedOnPaddle = true;
            break;
          }

          // Check Illusion holographic trails!
          for (const ghost of vaus.illusions) {
            if (
              ball.x + ball.radius >= ghost.x - ghost.w * 0.5 &&
              ball.x - ball.radius <= ghost.x + ghost.w * 0.5 &&
              ball.y + ball.radius >= ghost.y - ghost.h * 0.5 &&
              ball.y - ball.radius <= ghost.y + ghost.h * 0.5
            ) {
              ball.lastHitBy = vaus.playerIndex;
              ball.vy = -Math.abs(ball.vy);
              ball.y = ghost.y - ghost.h * 0.5 - ball.radius - 1;
              ball.nonDestructiveHits = 0;
              ghost.ttl = 0;
              this.spawnBurst(ball.x, ball.y, '#2cf2a9', 10);
              if (!isDemo) sound.paddleHit(0);
              bouncedOnPaddle = true;
              break;
            }
          }
          if (bouncedOnPaddle) break;
        }
      }

      // 5. Energy Barrier Floor Check
      const barrierY = VAUS_Y + 22;
      if (this.barrierHits > 0 && ball.vy > 0 && ball.y + ball.radius >= barrierY) {
        ball.y = barrierY - ball.radius - 1;
        ball.vy = -Math.abs(ball.vy);
        ball.nonDestructiveHits = 0;
        this.barrierHits--;
        this.spawnBurst(ball.x, barrierY, '#38f6ff', 14);
        if (!isDemo) sound.paddleHit(0);
      }

      // 6. Enforce velocity sanity & anti-horizontal-loop
      if (ball.caughtBy === null) {
        const nudged = enforceBallVelocityBounds(ball);
        if (nudged) {
          this.spawnBurst(ball.x, ball.y, '#ffe85c', 6);
        }
      }

      // 7. Check Bottom Pit Drain
      if (ball.y - ball.radius <= PLAYFIELD_BOTTOM + 8) {
        survivingBalls.push(ball);
      }
    }

    this.balls = survivingBalls;
  }

  private damageBrickWithBall(brick: BrickRuntime, ball: BallState, isDemo: boolean): void {
    if (brick.kind === 'gold' && !ball.mega) {
      brick.hitFlash = 1;
      ball.nonDestructiveHits++;
      if (!isDemo) sound.goldClang();
      this.spawnBurst(ball.x, ball.y, '#ffd84d', 5);
      return;
    }

    ball.nonDestructiveHits = 0;
    const dmg = ball.mega ? 999 : ball.pierceCrit ? 2 : 1;
    brick.hp -= dmg;
    brick.hitFlash = 1;

    if (brick.hp > 0) {
      if (brick.kind === 'regen') brick.regenTimer = 6.0;
      if (!isDemo) sound.brickChip(brick.kind);
      this.spawnBurst(brick.x + brick.w * 0.5, brick.y + brick.h * 0.5, BRICK_COLORS[brick.kind].light, 6);
      return;
    }

    this.destroyBrick(brick, ball.comboCount + 1, ball.lastHitBy ?? 0, isDemo);
    ball.comboCount++;
  }

  private destroyBrick(
    brick: BrickRuntime,
    comboStep: number,
    playerIndex: 0 | 1,
    isDemo: boolean
  ): void {
    brick.alive = false;
    brick.hp = 0;
    if (brick.kind === 'regen') {
      brick.regenTimer = 6.0; // Regenerating Notched Silver brick respawns in 6 seconds!
    }
    this.stalemateTimer = 0;

    // Score calculation (Silver/Regen scale by round #, Evolved Ricochet Combo multiplier, Reduce 2x!)
    let basePts = BRICK_POINTS[brick.kind];
    if (brick.kind === 'silver' || brick.kind === 'regen') {
      basePts *= this.stage.round;
    }
    if (brick.moving) basePts += 50;

    let comboMult = 1.0;
    if (this.settings.ruleset === 'evolved' && comboStep > 1) {
      const stepFactor = this.hasAugment('combo_accelerator') ? 0.25 : 0.15;
      comboMult = Math.min(5.0, 1.0 + (comboStep - 1) * stepFactor);
    }

    const totalPts = Math.round(basePts * comboMult);
    if (!isDemo) {
      this.awardPoints(totalPts, playerIndex);
      sound.brickBreak(brick.kind, comboStep);
      if (comboStep >= 3 && this.settings.ruleset === 'evolved') {
        this.spawnFloatingText(
          brick.x + brick.w * 0.5,
          brick.y,
          `${comboStep}x +${totalPts}`,
          '#ffe95c',
          Math.min(1.35, 0.9 + comboStep * 0.05)
        );
      }
    }

    // Shatter particles
    this.spawnBrickShatter(brick);

    // Capsule Drop check
    if (!isDemo && brick.kind !== 'gold') {
      const multiBallBlock = this.settings.ruleset === 'purist' && this.balls.length > 1;
      if (!multiBallBlock && this.capsules.length < 3) {
        if (brick.capsule) {
          this.spawnCapsule(brick.x + brick.w * 0.5, brick.y + brick.h * 0.5, brick.capsule);
        } else if (this.needMercyDrop) {
          this.needMercyDrop = false;
          const mercyPool: CapsuleType[] = ['E', 'L', 'C', 'T'];
          const pick = mercyPool[Math.floor(Math.random() * mercyPool.length)];
          this.spawnCapsule(brick.x + brick.w * 0.5, brick.y + brick.h * 0.5, pick);
        } else {
          const dropChance = this.stage.capsuleDropRate ?? 0.24;
          if (Math.random() < dropChance && brick.kind !== 'silver') {
            this.spawnCapsule(brick.x + brick.w * 0.5, brick.y + brick.h * 0.5);
          }
        }
      }
    }
  }

  private stepLasers(dt: number, isDemo: boolean): void {
    for (const bolt of this.lasers) {
      if (!bolt.alive) continue;
      bolt.y += bolt.vy * dt;
      if (bolt.y < PLAYFIELD_Y) {
        bolt.alive = false;
        continue;
      }

      // Collide against bricks
      for (const brick of this.bricks) {
        if (!brick.alive) continue;
        if (
          bolt.x >= brick.x &&
          bolt.x <= brick.x + brick.w &&
          bolt.y >= brick.y &&
          bolt.y <= brick.y + brick.h
        ) {
          if (brick.kind === 'gold') {
            bolt.alive = false;
            if (bolt.hyper && this.settings.ruleset === 'evolved') {
              // Hyper-Pierce Laser overloads Gold bricks in 6 hits in Evolved mode!
              brick.goldLaserHits = (brick.goldLaserHits ?? 0) + 1;
              brick.hitFlash = 1;
              this.spawnBurst(brick.x + brick.w * 0.5, brick.y + brick.h * 0.5, '#ffe866', 6);
              if (brick.goldLaserHits >= 6) {
                this.destroyBrick(brick, 1, bolt.playerIndex, isDemo);
                this.spawnFloatingText(brick.x + brick.w * 0.5, brick.y, 'GOLD OVERLOAD!', '#ffe44d', 1.15);
                this.shakeMag = Math.max(this.shakeMag, 4.5);
              } else if (!isDemo) {
                sound.goldClang();
              }
            } else if (!isDemo) {
              brick.hitFlash = 0.7;
              sound.goldClang();
            }
            break;
          }

          brick.hp -= bolt.hyper ? 2 : 1;
          brick.hitFlash = 1;
          if (brick.hp <= 0) {
            this.destroyBrick(brick, 1, bolt.playerIndex, isDemo);
            if (!bolt.hyper) {
              bolt.alive = false;
              break;
            }
          } else {
            if (brick.kind === 'regen') brick.regenTimer = 6.0;
            if (!isDemo) sound.brickChip(brick.kind);
            bolt.alive = false;
            break;
          }
        }
      }
      if (!bolt.alive) continue;

      // Collide against enemies
      for (const en of this.enemies) {
        if (!en.alive) continue;
        if (Math.hypot(bolt.x - en.x, bolt.y - en.y) <= en.radius + 5) {
          bolt.alive = false;
          this.damageEnemy(en, true, bolt.playerIndex, isDemo);
          break;
        }
      }
    }

    if (this.boss) {
      const bHit = collideLasersWithBoss(
        this.lasers,
        this.boss,
        1 + (this.loopNumber - 1) * 0.45
      );
      if (bHit.points > 0 && !isDemo) {
        this.awardPoints(bHit.points, 0);
        sound.bossHit(false);
      }
      if (bHit.transformed && !isDemo) {
        this.shakeMag = 14;
        this.chromaPulse = 1.0;
        sound.startMusic('boss_doh2');
      }
    }

    this.lasers = this.lasers.filter((l) => l.alive);
  }

  private spawnCapsule(x: number, y: number, forcedType?: CapsuleType): void {
    let chosen: CapsuleType = forcedType ?? 'E';
    if (!forcedType) {
      const weights: Record<CapsuleType, number> = { ...DEFAULT_CAPSULE_WEIGHTS };
      if (this.stage.capsuleWeights) {
        for (const k of ALL_CAPSULES) {
          if (this.stage.capsuleWeights[k] !== undefined) {
            weights[k] = this.stage.capsuleWeights[k]!;
          }
        }
      }
      if (this.hasAugment('lucky_jackpot')) {
        weights['?'] *= 2.5;
        weights['G'] *= 2.5;
        weights['M'] *= 1.8;
        weights['R'] *= 0.25;
      }

      let total = 0;
      for (const k of ALL_CAPSULES) total += weights[k];
      let r = Math.random() * total;
      for (const k of ALL_CAPSULES) {
        r -= weights[k];
        if (r <= 0) {
          chosen = k;
          break;
        }
      }
    }

    this.capsules.push({
      id: this.nextUid++,
      x,
      y,
      vy: 145,
      type: chosen,
      phase: 0,
      alive: true,
    });
    sound.capsuleDrop();
  }

  private stepCapsules(dt: number, isDemo: boolean): void {
    for (const cap of this.capsules) {
      if (!cap.alive) continue;
      cap.phase += dt * 6;
      cap.y += cap.vy * dt;

      // Capsule Magnet augment gently pulls beneficial capsules horizontally toward Vaus
      if (this.hasAugment('capsule_magnet') && cap.type !== 'R' && this.paddles[0]) {
        const dx = this.paddles[0].x - cap.x;
        if (Math.abs(dx) < 170 && cap.y > VAUS_Y - 220) {
          cap.x += Math.sign(dx) * 115 * dt;
        }
      }

      for (const vaus of this.paddles) {
        if (
          cap.x + 15 >= vaus.x - vaus.w * 0.5 &&
          cap.x - 15 <= vaus.x + vaus.w * 0.5 &&
          cap.y + 8 >= vaus.y - vaus.h * 0.5 &&
          cap.y - 8 <= vaus.y + vaus.h * 0.5
        ) {
          cap.alive = false;
          if (!isDemo) {
            this.awardPoints(1000, vaus.playerIndex);
            this.applyCapsulePowerup(cap.type, vaus, false);
          }
          break;
        }
      }

      if (cap.y > PLAYFIELD_BOTTOM + 20) {
        cap.alive = false;
      }
    }
    this.capsules = this.capsules.filter((c) => c.alive);
  }

  private applyCapsulePowerup(type: CapsuleType, vaus: VausState, fromReserve: boolean): void {
    sound.capsuleCatch(type);
    const evolvedStack = this.settings.ruleset === 'evolved' && this.settings.upgradeStacking;
    const canReserve =
      !fromReserve &&
      this.settings.ruleset === 'evolved' &&
      this.settings.reserveCapsule &&
      type !== 'R';

    // In Classic 1987 Purist (or when stacking is off), catching a new paddle mode clears old paddle modes
    if (!evolvedStack && ['E', 'L', 'C', 'T', 'I', 'R'].includes(type)) {
      this.releaseCaughtBalls(vaus.playerIndex);
      vaus.enlargeLevel = 0;
      vaus.reduced = false;
      vaus.laserLevel = 0;
      vaus.catchActive = false;
      vaus.twinActive = false;
      vaus.illusionActive = false;
    }

    if (!fromReserve) {
      this.spawnFloatingText(
        vaus.x,
        vaus.y - 22,
        CAPSULE_META[type].name,
        CAPSULE_META[type].accent,
        1.05
      );
    }

    switch (type) {
      case 'E': {
        vaus.reduced = false;
        if (vaus.enlargeLevel === 0) {
          vaus.enlargeLevel = 1;
        } else if (evolvedStack && vaus.enlargeLevel === 1) {
          vaus.enlargeLevel = 2;
          this.spawnFloatingText(vaus.x, vaus.y - 40, 'MAX ENLARGE 2.0X!', '#80c4ff', 1.1);
        } else if (canReserve) {
          this.reserveCapsule = 'E';
        }
        this.recalcVausWidth(vaus);
        break;
      }
      case 'L': {
        if (vaus.laserLevel === 0) {
          vaus.laserLevel = 1;
          if (!evolvedStack) vaus.catchActive = false;
        } else if (evolvedStack && vaus.laserLevel === 1) {
          vaus.laserLevel = 2;
          this.spawnFloatingText(vaus.x, vaus.y - 40, 'HYPER-PIERCE LASER!', '#ff7aa2', 1.15);
        } else if (canReserve) {
          this.reserveCapsule = 'L';
        }
        break;
      }
      case 'C': {
        if (vaus.catchActive && canReserve) this.reserveCapsule = 'C';
        vaus.catchActive = true;
        break;
      }
      case 'S': {
        for (const b of this.balls) {
          b.speed = Math.max(245, b.speed * 0.68);
          b.bounceCount = 0;
          enforceBallVelocityBounds(b);
        }
        break;
      }
      case 'B': {
        this.bonusWarpOpen = 1;
        sound.warpOpen();
        break;
      }
      case 'D': {
        this.splitBallsToCount(3);
        break;
      }
      case 'P': {
        const pIdx = this.playMode === 'arcade2p' ? this.activePlayer : 0;
        this.lives[pIdx]++;
        sound.extraLife();
        break;
      }
      case 'M': {
        const alreadyMega = this.balls.every((b) => b.mega);
        if (alreadyMega && canReserve) this.reserveCapsule = 'M';
        for (const b of this.balls) b.mega = true;
        break;
      }
      case 'T': {
        if (vaus.twinActive && canReserve) this.reserveCapsule = 'T';
        vaus.twinActive = true;
        vaus.reduced = false;
        this.recalcVausWidth(vaus);
        break;
      }
      case 'I': {
        if (vaus.illusionActive && canReserve) this.reserveCapsule = 'I';
        vaus.illusionActive = true;
        break;
      }
      case 'N': {
        this.infiniteSplitActive = true;
        this.splitBallsToCount(3);
        break;
      }
      case 'R': {
        // Reduce hazard: shrinks Vaus, but doubles all points!
        vaus.enlargeLevel = 0;
        vaus.twinActive = false;
        vaus.reduced = true;
        this.recalcVausWidth(vaus);
        break;
      }
      case '?': {
        const roll = Math.floor(Math.random() * 5);
        if (roll === 0) {
          this.splitBallsToCount(8);
          this.spawnFloatingText(vaus.x, vaus.y - 44, 'JACKPOT: 8-BALL FRENZY!', '#38ffe8', 1.25);
        } else if (roll === 1) {
          vaus.laserLevel = Math.max(vaus.laserLevel, 1) as 1 | 2;
          vaus.autoVulcanTimer = 12;
          this.spawnFloatingText(vaus.x, vaus.y - 44, 'JACKPOT: AUTO-VULCAN 12S!', '#ff5c8a', 1.25);
        } else if (roll === 2) {
          this.thunderClearBottomRows(2, vaus.playerIndex);
          this.spawnFloatingText(vaus.x, vaus.y - 44, 'JACKPOT: THUNDER CLEAR!', '#ffe84d', 1.25);
        } else if (roll === 3) {
          this.barrierHits += 3;
          this.spawnFloatingText(vaus.x, vaus.y - 44, 'JACKPOT: BARRIER FLOOR +3!', '#38f6ff', 1.25);
        } else {
          for (let i = 0; i < 5; i++) {
            this.enemies.push({
              id: this.nextUid++,
              kind: 'gold_critter',
              x: PLAYFIELD_X + 70 + i * 82,
              y: PLAYFIELD_Y + 34,
              vx: (i % 2 === 0 ? 1 : -1) * 85,
              vy: 58,
              radius: 13,
              hp: 1,
              phase: i,
              actionTimer: 5,
              alive: true,
            });
          }
          this.spawnFloatingText(vaus.x, vaus.y - 44, 'JACKPOT: GOLDEN PINATA SWARM!', '#ffd426', 1.25);
        }
        break;
      }
      case 'G': {
        this.barrierHits += 3;
        for (const b of this.balls) b.mega = true;
        vaus.laserLevel = 2;
        vaus.autoVulcanTimer = 8;
        this.spawnFloatingText(vaus.x, vaus.y - 44, 'GOLDEN OVERLOAD!', '#ffdf38', 1.3);
        break;
      }
    }

    // Auto-bank into empty Reserve Bay on first beneficial catch if still empty!
    if (canReserve && this.reserveCapsule === null && ['E', 'L', 'C', 'M', 'T', 'S'].includes(type)) {
      this.reserveCapsule = type;
    }
  }

  private splitBallsToCount(targetCount: number): void {
    this.releaseCaughtBalls(0);
    this.releaseCaughtBalls(1);
    if (this.balls.length === 0 && this.paddles[0]) {
      this.balls.push(this.createBall(this.paddles[0], false));
    }
    const base = this.balls[0];
    while (this.balls.length < targetCount && this.balls.length < 10) {
      const idx = this.balls.length;
      const offsetDeg = (idx % 2 === 0 ? 1 : -1) * (12 + idx * 6);
      const ang = Math.atan2(base.vy, base.vx) + (offsetDeg * Math.PI) / 180;
      this.balls.push({
        ...base,
        id: this.nextUid++,
        vx: Math.cos(ang) * base.speed,
        vy: Math.sin(ang) * base.speed,
        caughtBy: null,
        trail: [],
      });
    }
  }

  private thunderClearBottomRows(rowCount: number, playerIndex: 0 | 1): void {
    const aliveRows = Array.from(
      new Set(
        this.bricks
          .filter((b) => b.alive && b.kind !== 'gold')
          .map((b) => b.row)
      )
    ).sort((a, b) => b - a);

    const rowsToClear = new Set(aliveRows.slice(0, rowCount));
    for (const b of this.bricks) {
      if (b.alive && b.kind !== 'gold' && rowsToClear.has(b.row)) {
        this.destroyBrick(b, 2, playerIndex, false);
      }
    }
    this.shakeMag = 9;
    this.chromaPulse = 0.7;
  }

  private spawnEnemyFromHatch(): void {
    if (this.enemies.length >= 5) return;
    const leftSide = Math.random() < 0.5;
    if (leftSide) this.hatchLeftOpen = 1;
    else this.hatchRightOpen = 1;

    const x = leftSide ? HATCH_LEFT_X : HATCH_RIGHT_X;
    const y = PLAYFIELD_Y + 14;
    const kind: EnemyKind = this.stage.enemyKind ?? 'pyramid';

    this.enemies.push({
      id: this.nextUid++,
      kind,
      x,
      y,
      vx: (leftSide ? 1 : -1) * 58,
      vy: 48,
      radius: 12,
      hp: kind === 'builder' ? 2 : 1,
      phase: Math.random() * Math.PI * 2,
      actionTimer: 5.5,
      alive: true,
    });
  }

  private stepEnemies(dt: number, isDemo: boolean): void {
    if (this.hatchLeftOpen > 0) this.hatchLeftOpen = Math.max(0, this.hatchLeftOpen - dt * 1.4);
    if (this.hatchRightOpen > 0) this.hatchRightOpen = Math.max(0, this.hatchRightOpen - dt * 1.4);

    this.enemySpawnTimer -= dt;
    if (this.enemySpawnTimer <= 0) {
      this.enemySpawnTimer = this.boss ? 6.5 : 4.6;
      this.spawnEnemyFromHatch();
    }

    for (const en of this.enemies) {
      if (!en.alive) continue;
      en.phase += dt * 3.5;
      en.x += (en.vx + Math.sin(en.phase) * 36) * dt;
      en.y += en.vy * dt;

      if (en.x - en.radius < PLAYFIELD_X) {
        en.x = PLAYFIELD_X + en.radius;
        en.vx = Math.abs(en.vx);
      } else if (en.x + en.radius > PLAYFIELD_RIGHT) {
        en.x = PLAYFIELD_RIGHT - en.radius;
        en.vx = -Math.abs(en.vx);
      }

      // Builder enemy occasionally drops a colored block in deep sectors!
      if (en.kind === 'builder' && !isDemo) {
        en.actionTimer -= dt;
        if (en.actionTimer <= 0 && en.y > PLAYFIELD_Y + 54 && en.y < PLAYFIELD_Y + 290) {
          en.actionTimer = 7.5;
          const col = Math.max(0, Math.min(12, Math.floor((en.x - PLAYFIELD_X) / BRICK_W)));
          const row = Math.max(1, Math.min(15, Math.floor((en.y - PLAYFIELD_Y) / BRICK_H)));
          const occupied = this.bricks.some((b) => b.alive && b.col === col && b.row === row);
          if (!occupied && this.bricks.filter((b) => b.alive).length < 130) {
            this.bricks.push({
              uid: this.nextUid++,
              col,
              row,
              x: PLAYFIELD_X + col * BRICK_W,
              y: PLAYFIELD_Y + row * BRICK_H,
              w: BRICK_W,
              h: BRICK_H,
              kind: 'cyan',
              hp: 1,
              maxHp: 1,
              alive: true,
              regenTimer: 0,
              hitFlash: 1,
              shimmerPhase: 0,
            });
          }
        }
      }

      // Collide enemy with Balls -> destroys enemy AND randomly deflects ball trajectory!
      for (const ball of this.balls) {
        if (ball.caughtBy !== null) continue;
        if (Math.hypot(ball.x - en.x, ball.y - en.y) <= ball.radius + en.radius) {
          this.damageEnemy(en, false, 0, isDemo);
          if (!ball.mega) {
            const randTurn = ((Math.random() * 54 - 27) * Math.PI) / 180;
            const curAng = Math.atan2(ball.vy, ball.vx) + randTurn;
            ball.vx = Math.cos(curAng) * ball.speed;
            ball.vy = Math.sin(curAng) * ball.speed;
            enforceBallVelocityBounds(ball);
          }
          break;
        }
      }
      if (!en.alive) continue;

      // Collide enemy with Vaus -> harmlessly pops enemy for points!
      for (const vaus of this.paddles) {
        if (
          en.x + en.radius >= vaus.x - vaus.w * 0.5 &&
          en.x - en.radius <= vaus.x + vaus.w * 0.5 &&
          en.y + en.radius >= vaus.y - vaus.h * 0.5 &&
          en.y - en.radius <= vaus.y + vaus.h * 0.5
        ) {
          en.alive = false;
          if (!isDemo) {
            const pts = en.kind === 'gold_critter' ? 2000 : 250;
            this.awardPoints(pts, vaus.playerIndex);
            sound.enemyDestroy();
          }
          this.spawnBurst(en.x, en.y, '#ff9e38', 12);
          break;
        }
      }

      if (en.y > PLAYFIELD_BOTTOM + 20) {
        en.alive = false;
      }
    }

    this.enemies = this.enemies.filter((e) => e.alive);
  }

  private damageEnemy(
    en: EnemyEntity,
    byLaser: boolean,
    playerIndex: 0 | 1,
    isDemo: boolean
  ): void {
    en.hp--;
    if (en.hp > 0) return;
    en.alive = false;

    // Splitter splits into 2 fast mini-drones if shot by laser!
    if (en.kind === 'splitter' && !en.mini && byLaser) {
      for (const dir of [-1, 1]) {
        this.enemies.push({
          id: this.nextUid++,
          kind: 'splitter',
          x: en.x + dir * 10,
          y: en.y,
          vx: dir * 95,
          vy: 78,
          radius: 8,
          hp: 1,
          phase: en.phase,
          actionTimer: 99,
          mini: true,
          alive: true,
        });
      }
    }

    const pts = en.kind === 'gold_critter' ? 2000 : 400;
    if (!isDemo) {
      this.awardPoints(pts, playerIndex);
      sound.enemyDestroy();
      if (en.kind === 'gold_critter') {
        this.spawnFloatingText(en.x, en.y, '+2,000!', '#ffdf38', 1.2);
      }
    }
    this.spawnBurst(en.x, en.y, en.kind === 'gold_critter' ? '#ffdf38' : '#ff6a38', 16);
  }

  private awardPoints(rawPoints: number, playerIndex: 0 | 1): void {
    const scoreIdx: 0 | 1 =
      this.playMode === 'arcade2p'
        ? this.activePlayer
        : this.playMode === 'coop2p'
          ? playerIndex
          : 0;
    const hasReduced2x = this.paddles.some((p) => p.reduced);
    const finalPts = rawPoints * (hasReduced2x ? 2 : 1);
    this.scores[scoreIdx] += finalPts;

    // Extra life milestones: 20,000, 60,000, and every +60,000!
    const lifeIdx: 0 | 1 = this.playMode === 'arcade2p' ? this.activePlayer : 0;
    const trackScore =
      this.playMode === 'coop2p' ? this.scores[0] + this.scores[1] : this.scores[lifeIdx];
    if (trackScore >= this.nextExtraLifeScore[lifeIdx]) {
      this.lives[lifeIdx]++;
      this.nextExtraLifeScore[lifeIdx] =
        this.nextExtraLifeScore[lifeIdx] === 20000
          ? 60000
          : this.nextExtraLifeScore[lifeIdx] + 60000;
      sound.extraLife();
      const p = this.paddles[playerIndex] ?? this.paddles[0];
      if (p) this.spawnFloatingText(p.x, p.y - 38, '1UP EXTRA VAUS!', '#ffffff', 1.3);
    }
  }

  private getBestSessionScore(): number {
    return Math.max(this.scores[0], this.scores[1]);
  }

  private swapArcade2pPlayer(nextPlayer: 0 | 1, saveCurrent: boolean): void {
    if (saveCurrent) {
      this.arcade2pBoards[this.activePlayer] = {
        stageId: this.stage.id,
        bricks: this.bricks.map((b) => ({
          ...b,
          moving: b.moving ? { ...b.moving } : undefined,
        })),
        routeHistory: [...this.routeHistory],
        reserveCapsule: this.reserveCapsule,
      };
    }

    this.activePlayer = nextPlayer;
    const saved = this.arcade2pBoards[nextPlayer];
    if (saved) {
      const stageDef = getStageById(saved.stageId);
      this.loadStage(stageDef, true);
      this.bricks = saved.bricks.map((b) => ({
        ...b,
        moving: b.moving ? { ...b.moving } : undefined,
      }));
      this.routeHistory = [...saved.routeHistory];
      this.reserveCapsule = saved.reserveCapsule;
    } else {
      this.routeHistory = [1];
      this.reserveCapsule = this.settings.ruleset === 'evolved' && this.settings.reserveCapsule ? 'E' : null;
      this.loadStage(getStageById(1), true);
    }
    this.bannerText = `PLAYER ${nextPlayer + 1} READY — ROUND ${this.stage.branchLabel}`;
    this.bannerSubText = this.stage.name;
    this.bannerTimer = 2.6;
  }

  private spawnBrickShatter(brick: BrickRuntime): void {
    const col = BRICK_COLORS[brick.kind];
    const count = this.settings.visualPreset === 'hd_neon' ? 10 : 6;
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 45 + Math.random() * 165;
      this.particles.push({
        x: brick.x + Math.random() * brick.w,
        y: brick.y + Math.random() * brick.h,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 35,
        size: 3 + Math.random() * 4,
        color: i % 2 === 0 ? col.fill : col.light,
        alpha: 1,
        life: 0.45 + Math.random() * 0.35,
        maxLife: 0.8,
        gravity: 280,
        shard: true,
        rot: Math.random() * Math.PI,
        vrot: (Math.random() - 0.5) * 12,
      });
    }
  }

  private spawnBurst(x: number, y: number, color: string, count: number): void {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 40 + Math.random() * 190;
      this.particles.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        size: 2.5 + Math.random() * 3.5,
        color,
        alpha: 1,
        life: 0.35 + Math.random() * 0.35,
        maxLife: 0.7,
        gravity: 90,
      });
    }
  }

  private spawnFloatingText(
    x: number,
    y: number,
    text: string,
    color: string,
    scale = 1.0
  ): void {
    this.floatingTexts.push({
      x,
      y,
      vy: -44,
      text,
      color,
      scale,
      life: 1.05,
      maxLife: 1.05,
    });
  }

  private updateCosmetics(dt: number): void {
    for (const p of this.particles) {
      p.life -= dt;
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.rot !== undefined && p.vrot !== undefined) p.rot += p.vrot * dt;
      p.alpha = Math.max(0, p.life / p.maxLife);
    }
    this.particles = this.particles.filter((p) => p.life > 0);

    for (const ft of this.floatingTexts) {
      ft.life -= dt;
      ft.y += ft.vy * dt;
    }
    this.floatingTexts = this.floatingTexts.filter((f) => f.life > 0);

    if (this.repulsorWave) {
      this.repulsorWave.radius += 580 * dt;
      this.repulsorWave.alpha -= 2.4 * dt;
      if (this.repulsorWave.alpha <= 0) this.repulsorWave = null;
    }

    if (this.orbitalStrikeFx) {
      this.orbitalStrikeFx.alpha -= 1.8 * dt;
      if (this.orbitalStrikeFx.alpha <= 0) this.orbitalStrikeFx = null;
    }
  }

  private cloneBossState(b: BossState | null): BossState | null {
    if (!b) return null;
    return {
      ...b,
      orbiters: b.orbiters.map((o) => ({ ...o })),
      tentacles: b.tentacles.map((t) => ({
        ...t,
        segments: t.segments.map((s) => ({ ...s })),
      })),
      projectiles: b.projectiles.map((p) => ({ ...p })),
    };
  }

  private pushRewindFrame(): void {
    const cloneBricks = this.bricks.map((b) => ({
      ...b,
      moving: b.moving ? { ...b.moving } : undefined,
    }));
    const clonePaddles = this.paddles.map((p) => ({
      ...p,
      illusions: p.illusions.map((g) => ({ ...g })),
    }));
    const cloneBalls = this.balls.map((b) => ({
      ...b,
      trail: b.trail.map((t) => ({ ...t })),
    }));
    this.rewindBuffer.push({
      bricks: cloneBricks,
      paddles: clonePaddles,
      balls: cloneBalls,
      lasers: this.lasers.map((l) => ({ ...l })),
      capsules: this.capsules.map((c) => ({ ...c })),
      enemies: this.enemies.map((e) => ({ ...e })),
      boss: this.cloneBossState(this.boss),
      scores: [this.scores[0], this.scores[1]],
      barrierHits: this.barrierHits,
    });
    if (this.rewindBuffer.length > 60) {
      this.rewindBuffer.shift();
    }
  }

  private restoreRewindFrame(snap: RewindFrame): void {
    this.bricks = snap.bricks;
    this.paddles = snap.paddles;
    this.balls = snap.balls;
    this.lasers = snap.lasers;
    this.capsules = snap.capsules;
    this.enemies = snap.enemies;
    this.boss = this.cloneBossState(snap.boss);
    this.scores = [snap.scores[0], snap.scores[1]];
    this.barrierHits = snap.barrierHits;
  }

  private pickAugmentDraftOptions(): RogueliteAugment[] {
    const pool = ROGUELITE_AUGMENTS.filter((a) => !this.hasAugment(a.id));
    const source = pool.length >= 3 ? [...pool] : [...ROGUELITE_AUGMENTS];
    const picked: RogueliteAugment[] = [];
    while (picked.length < 3 && source.length > 0) {
      const idx = Math.floor(Math.random() * source.length);
      picked.push(source.splice(idx, 1)[0]);
    }
    return picked;
  }

  private updateAugmentDraft(): void {
    let pickIdx = -1;
    if (this.input.wasJustPressed('Digit1')) pickIdx = 0;
    if (this.input.wasJustPressed('Digit2')) pickIdx = 1;
    if (this.input.wasJustPressed('Digit3')) pickIdx = 2;

    const cardW = 220;
    const startX = (CANVAS_W - cardW * 3 - 40) * 0.5;
    const cursor = this.input.getCursorPos();
    this.hoverAugmentIdx = -1;
    if (cursor && cursor.y >= 240 && cursor.y <= 540) {
      const relX = cursor.x - startX;
      if (relX >= 0 && relX <= cardW * 3 + 40) {
        const idx = Math.floor(relX / (cardW + 20));
        if (idx >= 0 && idx <= 2 && relX - idx * (cardW + 20) <= cardW) {
          this.hoverAugmentIdx = idx;
        }
      }
    }
    this.input.setCursorStyle(this.hoverAugmentIdx >= 0 ? 'pointer' : 'default');

    const click = this.input.wasMouseClicked();
    if (click && click.y >= 240 && click.y <= 540) {
      const relX = click.x - startX;
      if (relX >= 0 && relX <= cardW * 3 + 40) {
        pickIdx = Math.min(2, Math.max(0, Math.floor(relX / (cardW + 20))));
      }
    }

    if (pickIdx >= 0 && this.draftOptions[pickIdx]) {
      const aug = this.draftOptions[pickIdx];
      this.activeAugments.push(aug);
      this.hoverAugmentIdx = -1;
      this.input.setCursorStyle('default');
      sound.capsuleCatch('G');
      this.rogueliteFloor++;
      const nextStage = generateProceduralStage(this.rogueliteFloor);
      this.screen = 'playing';
      this.loadStage(nextStage, true);
      this.input.requestPointerLockIfAllowed(this.settings.pointerLock);
    }
  }

  private updateSectorMap(): void {
    if (this.input.wasJustPressed('Escape')) {
      this.hoveredMapStageId = null;
      this.returnToAttract();
      return;
    }

    // Unlock all 64 stages shortcut for practice exploration!
    if (this.input.wasJustPressed('KeyU')) {
      for (let i = 1; i <= 64; i++) this.discoveredStageIds.add(i);
      this.saveDiscovered();
      sound.extraLife();
    }

    if (this.input.wasJustPressed('ArrowRight') || this.input.wasJustPressed('KeyD')) {
      this.selectedMapStageId = (this.selectedMapStageId % 64) + 1;
      sound.uiClick();
    }
    if (this.input.wasJustPressed('ArrowLeft') || this.input.wasJustPressed('KeyA')) {
      this.selectedMapStageId = ((this.selectedMapStageId - 2 + 64) % 64) + 1;
      sound.uiClick();
    }

    // Hover detection on Sector Map nodes
    const cursor = this.input.getCursorPos();
    this.hoveredMapStageId = null;
    if (cursor) {
      let bestHoverDist = 24;
      for (const node of SECTOR_NODES.values()) {
        const nx = 90 + node.mapX * (CANVAS_W - 180);
        const ny = 150 + node.mapY * (CANVAS_H - 290);
        const d = Math.hypot(cursor.x - nx, cursor.y - ny);
        if (d < bestHoverDist) {
          bestHoverDist = d;
          this.hoveredMapStageId = node.id;
        }
      }
    }
    this.input.setCursorStyle(this.hoveredMapStageId !== null ? 'pointer' : 'default');

    const click = this.input.wasMouseClicked();
    if (click) {
      // Find closest sector node on the rendered map
      let bestId = this.selectedMapStageId;
      let bestDist = 28;
      for (const node of SECTOR_NODES.values()) {
        const nx = 90 + node.mapX * (CANVAS_W - 180);
        const ny = 150 + node.mapY * (CANVAS_H - 290);
        const d = Math.hypot(click.x - nx, click.y - ny);
        if (d < bestDist) {
          bestDist = d;
          bestId = node.id;
        }
      }
      if (bestDist < 28) {
        if (this.selectedMapStageId === bestId && this.discoveredStageIds.has(bestId)) {
          this.startNewGame('practice', bestId);
          return;
        }
        this.selectedMapStageId = bestId;
        sound.uiClick();
      }
    }

    if (this.input.wasJustPressed('Enter') || this.input.wasJustPressed('Space')) {
      if (this.discoveredStageIds.has(this.selectedMapStageId)) {
        this.startNewGame('practice', this.selectedMapStageId);
      } else {
        sound.goldClang();
      }
    }
  }

  private updatePaused(): void {
    if (
      this.input.wasJustPressed('Escape') ||
      this.input.wasJustPressed('KeyP') ||
      this.input.wasJustPressed('Enter')
    ) {
      this.screen = this.warpLeftOpen > 0.8 ? 'stage_clear_warp' : 'playing';
      this.input.requestPointerLockIfAllowed(this.settings.pointerLock);
      sound.uiClick();
      return;
    }
    if (this.input.wasJustPressed('KeyQ')) {
      this.returnToAttract();
      return;
    }
    if (this.input.wasJustPressed('KeyO')) {
      this.settingsReturnScreen = 'paused';
      this.screen = 'settings';
      this.hooks.openSettings(this.settings);
    }
  }

  private updateEndScreen(): void {
    const click = this.input.wasMouseClicked();
    if (this.screen === 'victory' && this.input.wasJustPressed('KeyL')) {
      // Start Hardcore Loop 2+ carrying score forward!
      this.loopNumber++;
      this.routeHistory = [1];
      this.loadStage(getStageById(1), false);
      this.screen = 'playing';
      this.input.requestPointerLockIfAllowed(this.settings.pointerLock);
      return;
    }

    if (
      this.input.wasJustPressed('Enter') ||
      this.input.wasJustPressed('Space') ||
      this.input.wasJustPressed('Escape') ||
      click !== null
    ) {
      if (this.screen === 'victory' && this.qualifiesForHighScore(this.getBestSessionScore())) {
        this.initialsInput = '';
        this.input.clearChars();
        this.screen = 'high_score_entry';
      } else {
        this.returnToAttract();
      }
    }
  }

  private qualifiesForHighScore(score: number): boolean {
    if (score <= 0) return false;
    return (
      this.highScores.length < 10 ||
      score > this.highScores[this.highScores.length - 1].score
    );
  }

  private updateHighScoreEntry(): void {
    let ch = this.input.consumeChar();
    while (ch !== null) {
      if (this.initialsInput.length < 3) {
        this.initialsInput += ch;
        sound.uiClick();
      }
      ch = this.input.consumeChar();
    }

    if (this.input.wasJustPressed('Backspace') && this.initialsInput.length > 0) {
      this.initialsInput = this.initialsInput.slice(0, -1);
      sound.uiClick();
    }

    if (this.input.wasJustPressed('Enter') && this.initialsInput.length > 0) {
      const entry: HighScoreEntry = {
        initials: this.initialsInput.padEnd(3, 'A').slice(0, 3),
        score: this.getBestSessionScore(),
        round: this.stage.branchLabel,
        mode: this.playMode.toUpperCase(),
        ruleset: this.settings.ruleset,
      };
      this.highScores.push(entry);
      this.highScores.sort((a, b) => b.score - a.score);
      this.highScores = this.highScores.slice(0, 10);
      try {
        localStorage.setItem(STORAGE_KEYS.HIGH_SCORES, JSON.stringify(this.highScores));
      } catch {
        // Ignore
      }
      sound.extraLife();
      this.returnToAttract();
    }
  }

  public getRenderSnapshot(): RenderSnapshot {
    const topScore = Math.max(
      this.highScores[0]?.score ?? 0,
      this.scores[0],
      this.scores[1]
    );

    let activeCombo = 0;
    for (const b of this.balls) {
      if (b.comboCount > activeCombo) activeCombo = b.comboCount;
    }

    let warpLeftLabel: string | null = null;
    let warpRightLabel: string | null = null;
    if (this.warpLeftOpen > 0.05 || this.warpRightOpen > 0.05) {
      const node = SECTOR_NODES.get(this.stage.id);
      if (node?.leftNextId) {
        const ln = SECTOR_NODES.get(node.leftNextId);
        if (ln) warpLeftLabel = `${ln.branchLabel} ${ln.name}${ln.boss ? ' [BOSS]' : ''}`;
      }
      if (node?.rightNextId) {
        const rn = SECTOR_NODES.get(node.rightNextId);
        if (rn) warpRightLabel = `${rn.branchLabel} ${rn.name}${rn.boss ? ' [BOSS]' : ''}`;
      }
    }

    return {
      screen: this.screen,
      attractPage: this.attractPage,
      attractTimer: this.attractTimer,
      introTimer: this.introTimer,
      time: this.time,
      credits: this.credits,
      playMode: this.playMode,
      settings: this.settings,
      stage: this.stage,
      loopNumber: this.loopNumber,
      activePlayer: this.activePlayer,
      scores: this.scores,
      lives: this.lives,
      highScore: topScore,
      highScores: this.highScores,
      reserveCapsule: this.reserveCapsule,
      activeAugments: this.activeAugments,
      draftOptions: this.draftOptions,
      discoveredStageIds: Array.from(this.discoveredStageIds),
      routeHistory: this.routeHistory,
      bricks: this.bricks,
      paddles: this.paddles,
      balls: this.balls,
      lasers: this.lasers,
      capsules: this.capsules,
      enemies: this.enemies,
      boss: this.boss,
      particles: this.particles,
      floatingTexts: this.floatingTexts,
      hatchLeftOpen: this.hatchLeftOpen,
      hatchRightOpen: this.hatchRightOpen,
      warpLeftOpen: this.warpLeftOpen,
      warpRightOpen: this.warpRightOpen,
      bonusWarpOpen: this.bonusWarpOpen,
      barrierHits: this.barrierHits,
      repulsorWave: this.repulsorWave,
      magneticActive: this.magneticActive,
      stalemateTimer: this.stalemateTimer,
      orbitalStrikeFx: this.orbitalStrikeFx,
      rewindCharges: this.rewindCharges,
      rewindActive: this.rewindActive,
      bannerText: this.bannerText,
      bannerSubText: this.bannerSubText,
      bannerTimer: this.bannerTimer,
      shakeX: this.shakeX,
      shakeY: this.shakeY,
      chromaPulse: this.chromaPulse,
      initialsInput: this.initialsInput,
      selectedMenuIdx: this.selectedMenuIdx,
      selectedMapStageId: this.selectedMapStageId,
      hoveredMapStageId: this.hoveredMapStageId,
      hoverAugmentIdx: this.hoverAugmentIdx,
      activeCombo,
      warpLeftLabel,
      warpRightLabel,
      isTouchDevice: this.input.usedTouch(),
    };
  }
}
