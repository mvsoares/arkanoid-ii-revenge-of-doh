import type { BrickKind, CapsuleType, DipSwitchSettings } from './types';

export const CANVAS_W = 960;
export const CANVAS_H = 768;

// Playfield interior (13 columns * 36px = 468px)
export const GRID_COLS = 13;
export const GRID_ROWS = 22;
export const BRICK_W = 36;
export const BRICK_H = 18;

export const PLAYFIELD_W = GRID_COLS * BRICK_W; // 468
export const PLAYFIELD_X = (CANVAS_W - PLAYFIELD_W) / 2; // 246
export const PLAYFIELD_RIGHT = PLAYFIELD_X + PLAYFIELD_W; // 714
export const PLAYFIELD_Y = 58;
export const PLAYFIELD_BOTTOM = 752;
export const PLAYFIELD_H = PLAYFIELD_BOTTOM - PLAYFIELD_Y; // 694

export const WALL_THICKNESS = 22;
export const VAUS_Y = 708;
export const VAUS_BASE_W = 76;
export const VAUS_H = 15;

export const BALL_RADIUS = 5.5;
export const BASE_BALL_SPEED = 360; // px/sec
export const MAX_BALL_SPEED = 740;
export const PHYSICS_HZ = 240;
export const PHYSICS_DT = 1 / PHYSICS_HZ;

// Hatch X offsets relative to PLAYFIELD_X
export const HATCH_LEFT_X = PLAYFIELD_X + BRICK_W * 3;
export const HATCH_RIGHT_X = PLAYFIELD_X + BRICK_W * 9;

// Warp Gates Y span on Left/Right walls
export const WARP_GATE_Y = 668;
export const WARP_GATE_H = 62;
export const BONUS_WARP_Y = 590;
export const BONUS_WARP_H = 56;

export const BRICK_POINTS: Record<BrickKind, number> = {
  white: 50,
  orange: 60,
  cyan: 70,
  green: 80,
  red: 90,
  blue: 100,
  magenta: 110,
  yellow: 120,
  silver: 50, // multiplied by round number
  regen: 100, // multiplied by round number
  gold: 500, // if destroyed via Mega Ball / Overcharge
};

export const BRICK_COLORS: Record<BrickKind, { fill: string; light: string; dark: string; symbol: string }> = {
  white:   { fill: '#e8eef7', light: '#ffffff', dark: '#9aa8bd', symbol: '○' },
  orange:  { fill: '#ff881c', light: '#ffc278', dark: '#a84700', symbol: '△' },
  cyan:    { fill: '#18e0ff', light: '#a3f5ff', dark: '#007d99', symbol: '◇' },
  green:   { fill: '#28df56', light: '#95ffae', dark: '#0c7c29', symbol: '□' },
  red:     { fill: '#ff2b4a', light: '#ff96a5', dark: '#99081e', symbol: '▽' },
  blue:    { fill: '#2d6dff', light: '#93b6ff', dark: '#0b3296', symbol: '☆' },
  magenta: { fill: '#f23cff', light: '#faa6ff', dark: '#880a94', symbol: '◈' },
  yellow:  { fill: '#ffe024', light: '#fff49c', dark: '#a88900', symbol: '⬡' },
  silver:  { fill: '#9eb0c7', light: '#eef6ff', dark: '#4d5b6e', symbol: '═' },
  regen:   { fill: '#7f98b8', light: '#d7ecff', dark: '#36465c', symbol: '✕' },
  gold:    { fill: '#f5b81d', light: '#fff2a6', dark: '#8c5e00', symbol: '❖' },
};

export const CAPSULE_META: Record<
  CapsuleType,
  { name: string; color: string; accent: string; hazard?: boolean; desc: string }
> = {
  E: { name: 'ENLARGE', color: '#246bff', accent: '#99bfff', desc: 'Expands Vaus II width (stacks up to 2.0x in Evolved)' },
  L: { name: 'LASER', color: '#f52742', accent: '#ff9ca8', desc: 'Twin plasma cannons (stacks to Hyper-Pierce Laser)' },
  C: { name: 'CATCH', color: '#1fd655', accent: '#a3ffbe', desc: 'Magnetizes Vaus II to catch & aim the Energy Ball' },
  S: { name: 'SLOW', color: '#ff8c1a', accent: '#ffd099', desc: 'Decelerates all active balls & resets speed curve' },
  B: { name: 'BREAK', color: '#df38ff', accent: '#f6b3ff', desc: 'Opens Bonus Warp Exit (+10,000 pts instant stage clear)' },
  D: { name: 'DISRUPTION', color: '#14d8f5', accent: '#b0f5ff', hazard: false, desc: 'Splits the Energy Ball into 3 simultaneous orbs' },
  P: { name: 'PLAYER', color: '#b4c2d4', accent: '#ffffff', desc: 'Grants 1 Extra Vaus II interceptor life' },
  M: { name: 'MEGA BALL', color: '#8b2eff', accent: '#ffe14d', desc: 'Plows straight through ALL bricks including Gold!' },
  T: { name: 'TWIN VAUS', color: '#0f9bb8', accent: '#8df0ff', desc: 'Deploys a synchronized Twin Vaus companion hull' },
  I: { name: 'ILLUSION', color: '#2cf2a9', accent: '#dcfff2', desc: 'Fast movements leave solid holographic deflection trails' },
  N: { name: 'INFINITE SPLIT', color: '#e6f7ff', accent: '#18e0ff', desc: '3-Ball split that auto-regenerates lost balls!' },
  R: { name: 'REDUCE (2X)', color: '#2c303b', accent: '#ff3b3b', hazard: true, desc: 'Shrinks Vaus II to 60%, but DOUBLES all points (2x)!' },
  '?': { name: 'MYSTERY', color: '#ff38b8', accent: '#38ffe8', desc: 'Wildcard Jackpot: 8-Ball, Vulcan, Thunder, Shield or Swarm!' },
  G: { name: 'GOLD JACKPOT', color: '#ffcc14', accent: '#fff9bd', desc: 'Golden Overload: Barrier Shield + Multi-Mega / Vulcan!' },
};

export const DEFAULT_DIP_SWITCHES: DipSwitchSettings = {
  ruleset: 'evolved',
  visualPreset: 'hd_neon',
  crtCurvature: true,
  colorblindSymbols: false,
  pointerLock: true,
  mouseSensitivity: 1.0,
  gameSpeed: 1.0,
  screenShake: 0.7,
  hitStop: true,
  discreteBounceZones: false,
  upgradeStacking: true,
  reserveCapsule: true,
  stalemateBreaker: true,
  masterVolume: 0.8,
  sfxVolume: 0.85,
  musicVolume: 0.55,
};

export const STORAGE_KEYS = {
  HIGH_SCORES: 'arkanoid2_highscores_v1',
  SETTINGS: 'arkanoid2_settings_v1',
  DISCOVERED_STAGES: 'arkanoid2_discovered_v1',
  CUSTOM_STAGES: 'arkanoid2_custom_stages_v1',
};
