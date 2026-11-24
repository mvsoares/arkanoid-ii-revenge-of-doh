export type BrickKind =
  | 'white'
  | 'orange'
  | 'cyan'
  | 'green'
  | 'red'
  | 'blue'
  | 'magenta'
  | 'yellow'
  | 'silver'
  | 'regen'
  | 'gold';

export type CapsuleType =
  | 'E'
  | 'L'
  | 'C'
  | 'S'
  | 'B'
  | 'D'
  | 'P'
  | 'M'
  | 'T'
  | 'I'
  | 'N'
  | 'R'
  | '?'
  | 'G';

export type RulesetMode = 'evolved' | 'purist';
export type VisualPreset = 'hd_neon' | 'crt_1987';
export type GamePlayMode =
  | 'campaign'
  | 'arcade2p'
  | 'coop2p'
  | 'bossrush'
  | 'roguelite'
  | 'practice'
  | 'editor_test';

export type SectorTheme =
  | 'hull_breach'
  | 'cryo_vault'
  | 'reactor_core'
  | 'bio_nexus'
  | 'gold_citadel'
  | 'doh_sanctum';

export type EnemyKind = 'pyramid' | 'trisphere' | 'splitter' | 'builder' | 'gold_critter';

export type BossKind = 'suirei' | 'sentinel' | 'doh';

export interface DipSwitchSettings {
  ruleset: RulesetMode;
  visualPreset: VisualPreset;
  crtCurvature: boolean;
  colorblindSymbols: boolean;
  pointerLock: boolean;
  mouseSensitivity: number;
  gameSpeed: number;
  screenShake: number;
  hitStop: boolean;
  discreteBounceZones: boolean;
  upgradeStacking: boolean;
  reserveCapsule: boolean;
  stalemateBreaker: boolean;
  masterVolume: number;
  sfxVolume: number;
  musicVolume: number;
}

export interface MovingSpec {
  minCol: number;
  maxCol: number;
  speed: number; // cols per second, e.g. 1.8
  dir: 1 | -1;
}

export interface BrickBlueprint {
  col: number; // 0..12
  row: number; // 0..21
  kind: BrickKind;
  hits?: number; // overrides default silver/regen hits if set
  moving?: MovingSpec;
  capsule?: CapsuleType; // guaranteed drop if set
}

export interface StageDefinition {
  id: number; // 1..64 (or >= 1000 for custom/procedural)
  round: number; // 1..34
  branchLabel: string; // e.g., "1", "2L", "2R", "17L", "34"
  name: string;
  subtitle: string;
  theme: SectorTheme;
  enemyKind: EnemyKind;
  boss?: BossKind;
  bricks: BrickBlueprint[];
  capsuleDropRate?: number; // 0..1 default ~0.24
  capsuleWeights?: Partial<Record<CapsuleType, number>>;
}

export interface BrickRuntime {
  uid: number;
  col: number;
  row: number;
  x: number;
  y: number;
  w: number;
  h: number;
  kind: BrickKind;
  hp: number;
  maxHp: number;
  alive: boolean;
  regenTimer: number; // > 0 when destroyed/damaged and counting down to regenerate
  hitFlash: number; // 0..1
  shimmerPhase: number;
  goldLaserHits?: number; // Hyper-Pierce laser overload hits on Gold bricks
  moving?: {
    minX: number;
    maxX: number;
    vx: number;
  };
  capsule?: CapsuleType;
}

export interface IllusionGhost {
  x: number;
  y: number;
  w: number;
  h: number;
  ttl: number;
  maxTtl: number;
}

export interface VausState {
  playerIndex: 0 | 1; // 0 = P1, 1 = P2 (Co-Op)
  x: number; // center X
  y: number;
  vx: number;
  w: number;
  h: number;
  enlargeLevel: 0 | 1 | 2; // 0=normal, 1=1.5x, 2=2.0x
  reduced: boolean; // true = 0.6x + 2x score
  laserLevel: 0 | 1 | 2; // 0=off, 1=standard twin, 2=hyper-pierce
  catchActive: boolean;
  twinActive: boolean;
  illusionActive: boolean;
  stunTimer: number;
  mercyShieldTimer: number;
  laserCooldown: number;
  autoVulcanTimer: number;
  repulsorCooldown: number;
  repulsorMaxCooldown: number;
  magneticEnergy: number; // 0..100
  illusions: IllusionGhost[];
  muzzleFlash: number;
}

export interface BallTrailPoint {
  x: number;
  y: number;
}

export interface BallState {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  speed: number;
  radius: number;
  mega: boolean;
  caughtBy: number | null; // playerIndex if caught
  catchOffsetX: number;
  catchTimer: number;
  bounceCount: number;
  nonDestructiveHits: number;
  comboCount: number;
  pierceCrit?: boolean;
  lastHitBy?: 0 | 1;
  trail: BallTrailPoint[];
}

export interface LaserBolt {
  x: number;
  y: number;
  vy: number;
  hyper: boolean;
  playerIndex: 0 | 1;
  alive: boolean;
}

export interface CapsuleEntity {
  id: number;
  x: number;
  y: number;
  vy: number;
  type: CapsuleType;
  phase: number;
  alive: boolean;
}

export interface EnemyEntity {
  id: number;
  kind: EnemyKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  hp: number;
  phase: number;
  actionTimer: number;
  mini?: boolean;
  alive: boolean;
}

export interface BossProjectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  kind: 'fireball' | 'ion_ring' | 'spore' | 'psy_wave';
  lethal: boolean; // lethal in purist, stun/shrink option in evolved
  alive: boolean;
}

export interface BossTentacleSegment {
  x: number;
  y: number;
  radius: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  regenTimer: number;
}

export interface BossTentacle {
  baseAngle: number;
  phaseOffset: number;
  segments: BossTentacleSegment[];
}

export interface BossOrbiter {
  angle: number;
  dist: number;
  radius: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  regenTimer: number;
  gold?: boolean;
}

export interface BossState {
  kind: BossKind;
  phase: 1 | 2;
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  hp: number;
  maxHp: number;
  hitFlash: number;
  attackTimer: number;
  animTime: number;
  coreOpen: boolean;
  orbiters: BossOrbiter[];
  tentacles: BossTentacle[];
  projectiles: BossProjectile[];
  defeated: boolean;
  deathTimer: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
  gravity: number;
  shard?: boolean;
  rot?: number;
  vrot?: number;
}

export interface FloatingText {
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  scale: number;
  life: number;
  maxLife: number;
}

export interface RogueliteAugment {
  id: string;
  name: string;
  icon: string;
  color: string;
  desc: string;
}

export interface HighScoreEntry {
  initials: string;
  score: number;
  round: string;
  mode: string;
  ruleset: RulesetMode;
}

export type ScreenState =
  | 'attract'
  | 'intro_story'
  | 'playing'
  | 'stage_clear_warp'
  | 'sector_map'
  | 'augment_draft'
  | 'paused'
  | 'game_over'
  | 'victory'
  | 'high_score_entry'
  | 'editor'
  | 'settings';

export type AttractPage = 'title' | 'story' | 'capsules' | 'demo' | 'highscores';

export interface RenderSnapshot {
  screen: ScreenState;
  attractPage: AttractPage;
  attractTimer: number;
  introTimer: number;
  time: number;
  credits: number;
  playMode: GamePlayMode;
  settings: DipSwitchSettings;
  stage: StageDefinition;
  loopNumber: number;
  activePlayer: 0 | 1;
  scores: [number, number];
  lives: [number, number];
  highScore: number;
  highScores: HighScoreEntry[];
  reserveCapsule: CapsuleType | null;
  activeAugments: RogueliteAugment[];
  draftOptions: RogueliteAugment[];
  discoveredStageIds: number[];
  routeHistory: number[];
  bricks: BrickRuntime[];
  paddles: VausState[];
  balls: BallState[];
  lasers: LaserBolt[];
  capsules: CapsuleEntity[];
  enemies: EnemyEntity[];
  boss: BossState | null;
  particles: Particle[];
  floatingTexts: FloatingText[];
  hatchLeftOpen: number; // 0..1
  hatchRightOpen: number; // 0..1
  warpLeftOpen: number; // 0..1
  warpRightOpen: number; // 0..1
  bonusWarpOpen: number; // 0..1
  barrierHits: number; // >0 when energy barrier floor active
  repulsorWave: { x: number; y: number; radius: number; alpha: number } | null;
  magneticActive: 0 | 1 | -1; // 1=attract, -1=repel, 0=off
  stalemateTimer: number; // seconds stuck on <=2 bricks
  orbitalStrikeFx: { x: number; y: number; alpha: number } | null;
  rewindCharges: number;
  rewindActive: boolean;
  bannerText: string | null;
  bannerSubText: string | null;
  bannerTimer: number;
  shakeX: number;
  shakeY: number;
  chromaPulse: number; // 0..1 for boss hit / explosion shader pulse
  initialsInput: string;
  selectedMenuIdx: number;
  selectedMapStageId: number;
  hoveredMapStageId: number | null;
  hoverAugmentIdx: number;
  activeCombo: number;
  warpLeftLabel: string | null;
  warpRightLabel: string | null;
  isTouchDevice: boolean;
}

