import type {
  BossKind,
  BrickBlueprint,
  BrickKind,
  CapsuleType,
  EnemyKind,
  MovingSpec,
  SectorTheme,
  StageDefinition,
} from '../types';
import {
  BRICK_COLORS,
  BRICK_POINTS,
  CAPSULE_META,
  GRID_COLS,
  GRID_ROWS,
  STORAGE_KEYS,
} from '../constants';
import {
  decodeStageFromUrlParam,
  encodeStageToUrlParam,
  exportStageJson,
  importStageJson,
} from '../stages/codec';
import { CAMPAIGN_STAGES } from '../stages/stageCatalog';

export interface EditorCallbacks {
  onPlaytest: (stage: StageDefinition) => void;
  onExit: () => void;
  onUiSound?: () => void;
}

type EditorTool = 'paint' | 'erase' | 'row_fill' | 'pick';

interface StageMetaState {
  id: number;
  round: number;
  branchLabel: string;
  name: string;
  subtitle: string;
  theme: SectorTheme;
  enemyKind: EnemyKind;
  boss?: BossKind;
  capsuleDropRate: number;
  capsuleWeights?: Partial<Record<CapsuleType, number>>;
}

const BRICK_ORDER: BrickKind[] = [
  'white',
  'orange',
  'cyan',
  'green',
  'red',
  'blue',
  'magenta',
  'yellow',
  'silver',
  'regen',
  'gold',
];

const CAPSULE_ORDER: CapsuleType[] = [
  'E',
  'L',
  'C',
  'S',
  'B',
  'D',
  'P',
  'M',
  'T',
  'I',
  'N',
  'R',
  '?',
  'G',
];

const THEME_OPTIONS: { value: SectorTheme; label: string; bgTop: string; bgBottom: string; accent: string }[] = [
  { value: 'hull_breach', label: 'Hull Breach', bgTop: '#081226', bgBottom: '#040711', accent: '#18e0ff' },
  { value: 'cryo_vault', label: 'Cryo Vault', bgTop: '#071d2c', bgBottom: '#040b16', accent: '#7ce8ff' },
  { value: 'reactor_core', label: 'Reactor Core', bgTop: '#240b16', bgBottom: '#0c0409', accent: '#ff5733' },
  { value: 'bio_nexus', label: 'Bio Nexus', bgTop: '#092119', bgBottom: '#040d0a', accent: '#2cf2a9' },
  { value: 'gold_citadel', label: 'Gold Citadel', bgTop: '#231a07', bgBottom: '#0c0903', accent: '#ffcc14' },
  { value: 'doh_sanctum', label: 'DOH Sanctum', bgTop: '#1d0929', bgBottom: '#090311', accent: '#f23cff' },
];

const ENEMY_OPTIONS: { value: EnemyKind; label: string }[] = [
  { value: 'pyramid', label: 'Pyramid (Roamer)' },
  { value: 'trisphere', label: 'Tri-Sphere (Orbiter)' },
  { value: 'splitter', label: 'Splitter (Mitosis)' },
  { value: 'builder', label: 'Builder (Repair)' },
  { value: 'gold_critter', label: 'Gold Critter (Armored)' },
];

const BOSS_OPTIONS: { value: '' | BossKind; label: string }[] = [
  { value: '', label: 'None (Standard Stage)' },
  { value: 'suirei', label: 'Suirei (Bio-Guardian)' },
  { value: 'sentinel', label: 'Sentinel (Cyber Core)' },
  { value: 'doh', label: 'DOH (Overlord)' },
];

// Logical dimensions for the 13x22 interactive studio grid canvas
const CELL_W = 36;
const CELL_H = 20;
const GRID_ORIGIN_X = 28;
const GRID_ORIGIN_Y = 24;
const GRID_PIXEL_W = GRID_COLS * CELL_W; // 468
const GRID_PIXEL_H = GRID_ROWS * CELL_H; // 440
const LOGICAL_CANVAS_W = GRID_ORIGIN_X + GRID_PIXEL_W + 10; // 506
const LOGICAL_CANVAS_H = GRID_ORIGIN_Y + GRID_PIXEL_H + 34; // 498
const DANGER_START_ROW = 18;
const MAX_UNDO_STEPS = 40;

const STYLE_TAG_ID = 'construction-set-styles';

function injectConstructionSetStyles(): void {
  if (typeof document === 'undefined' || document.getElementById(STYLE_TAG_ID)) {
    return;
  }

  const style = document.createElement('style');
  style.id = STYLE_TAG_ID;
  style.textContent = `
    .cs-root {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      pointer-events: auto;
      display: flex;
      flex-direction: column;
      background:
        radial-gradient(circle at 50% 15%, rgba(24, 224, 255, 0.09) 0%, rgba(6, 9, 20, 0.97) 65%),
        #050812;
      color: #e4f0ff;
      font-family: 'Courier New', Courier, monospace;
      font-size: 11px;
      z-index: 30;
      overflow: hidden;
      border: 1px solid rgba(24, 224, 255, 0.35);
      box-shadow: inset 0 0 36px rgba(0, 0, 0, 0.85);
    }

    .cs-root::after {
      content: '';
      position: absolute;
      inset: 0;
      pointer-events: none;
      background: repeating-linear-gradient(
        to bottom,
        rgba(255, 255, 255, 0.018) 0px,
        rgba(255, 255, 255, 0.018) 1px,
        transparent 1px,
        transparent 3px
      );
      z-index: 40;
    }

    .cs-root input,
    .cs-root select,
    .cs-root textarea {
      user-select: text;
      -webkit-user-select: text;
      font-family: inherit;
    }

    .cs-topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 6px 10px;
      background: linear-gradient(90deg, #0b1329 0%, #101d3b 50%, #0b1329 100%);
      border-bottom: 1px solid rgba(24, 224, 255, 0.38);
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.55);
      flex-shrink: 0;
    }

    .cs-brand {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }

    .cs-badge-logo {
      padding: 2px 6px;
      background: linear-gradient(180deg, #ff3864 0%, #a80c30 100%);
      color: #fff;
      font-weight: 700;
      font-size: 10px;
      letter-spacing: 1px;
      border: 1px solid #ff9eb3;
      border-radius: 3px;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
      white-space: nowrap;
    }

    .cs-title-group {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .cs-title-main {
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 1.4px;
      color: #7ef4ff;
      text-shadow: 0 0 8px rgba(24, 224, 255, 0.55);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .cs-title-sub {
      font-size: 9px;
      color: #8ba3c7;
      letter-spacing: 0.8px;
      white-space: nowrap;
    }

    .cs-top-actions {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-shrink: 0;
    }

    .cs-toast {
      padding: 3px 8px;
      border-radius: 3px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.5px;
      background: rgba(24, 224, 255, 0.16);
      border: 1px solid #18e0ff;
      color: #affaff;
      opacity: 0;
      transform: translateY(-3px);
      transition: opacity 0.16s ease, transform 0.16s ease;
      pointer-events: none;
      white-space: nowrap;
    }

    .cs-toast.visible {
      opacity: 1;
      transform: translateY(0);
    }

    .cs-toast.warn {
      background: rgba(255, 62, 94, 0.2);
      border-color: #ff4d6d;
      color: #ffc2cd;
    }

    .cs-btn {
      cursor: pointer;
      padding: 4px 8px;
      background: linear-gradient(180deg, #162442 0%, #0d162b 100%);
      color: #d6e8ff;
      border: 1px solid rgba(110, 168, 255, 0.42);
      border-radius: 3px;
      font-family: inherit;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.5px;
      transition: all 0.1s ease;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      white-space: nowrap;
    }

    .cs-btn:hover {
      background: linear-gradient(180deg, #1f3461 0%, #132242 100%);
      border-color: #4de8ff;
      color: #ffffff;
      box-shadow: 0 0 8px rgba(24, 224, 255, 0.3);
    }

    .cs-btn:active {
      transform: translateY(1px);
    }

    .cs-btn.active {
      background: linear-gradient(180deg, #134b63 0%, #0b2b3d 100%);
      border-color: #18e0ff;
      color: #8cf6ff;
      box-shadow: 0 0 10px rgba(24, 224, 255, 0.38), inset 0 0 6px rgba(24, 224, 255, 0.25);
    }

    .cs-btn-playtest {
      padding: 5px 12px;
      background: linear-gradient(180deg, #1fd655 0%, #0d7a30 100%);
      border-color: #8cffae;
      color: #ffffff;
      font-size: 11px;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.75);
      box-shadow: 0 0 12px rgba(31, 214, 85, 0.4);
    }

    .cs-btn-playtest:hover {
      background: linear-gradient(180deg, #2bf065 0%, #12963c 100%);
      border-color: #c9ffd8;
      box-shadow: 0 0 16px rgba(31, 214, 85, 0.65);
    }

    .cs-btn-exit {
      padding: 5px 10px;
      background: linear-gradient(180deg, #4f1828 0%, #2b0b14 100%);
      border-color: #ff5c7c;
      color: #ffd6de;
    }

    .cs-btn-exit:hover {
      background: linear-gradient(180deg, #732038 0%, #3d0f1d 100%);
      border-color: #ff99ad;
      box-shadow: 0 0 10px rgba(255, 60, 100, 0.45);
    }

    .cs-btn-accent {
      background: linear-gradient(180deg, #2d2159 0%, #191136 100%);
      border-color: #b56bff;
      color: #ebd6ff;
    }

    .cs-btn-accent:hover {
      background: linear-gradient(180deg, #3e2d7a 0%, #24184d 100%);
      border-color: #d9b0ff;
    }

    .cs-btn-danger {
      background: linear-gradient(180deg, #471622 0%, #260b12 100%);
      border-color: rgba(255, 82, 110, 0.6);
      color: #ffb8c5;
    }

    .cs-btn-danger:hover {
      background: linear-gradient(180deg, #631d2e 0%, #380f19 100%);
      border-color: #ff6b86;
    }

    .cs-workspace {
      flex: 1;
      min-height: 0;
      display: grid;
      grid-template-columns: minmax(212px, 245px) 1fr minmax(218px, 252px);
      gap: 8px;
      padding: 8px;
    }

    .cs-sidebar {
      display: flex;
      flex-direction: column;
      gap: 7px;
      min-height: 0;
      overflow-y: auto;
      padding-right: 2px;
      scrollbar-width: thin;
      scrollbar-color: #24487a #080e1c;
    }

    .cs-sidebar::-webkit-scrollbar {
      width: 5px;
    }
    .cs-sidebar::-webkit-scrollbar-track {
      background: #080e1c;
    }
    .cs-sidebar::-webkit-scrollbar-thumb {
      background: #24487a;
      border-radius: 3px;
    }

    .cs-card {
      background: rgba(10, 17, 34, 0.92);
      border: 1px solid rgba(56, 122, 204, 0.36);
      border-radius: 4px;
      padding: 7px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
    }

    .cs-card-hdr {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.9px;
      color: #63dcff;
      border-bottom: 1px solid rgba(64, 135, 215, 0.25);
      padding-bottom: 3px;
      text-transform: uppercase;
    }

    .cs-brick-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 4px;
    }

    .cs-brick-swatch {
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 5px;
      padding: 3px 5px;
      border-radius: 3px;
      background: #091021;
      border: 1px solid rgba(90, 130, 190, 0.28);
      color: #cde0fa;
      font-family: inherit;
      font-size: 10px;
      font-weight: 700;
      text-align: left;
      transition: all 0.1s ease;
    }

    .cs-brick-swatch:hover {
      border-color: #75e6ff;
      background: #101d38;
    }

    .cs-brick-swatch.selected {
      border-color: #18e0ff;
      background: rgba(24, 224, 255, 0.16);
      color: #ffffff;
      box-shadow: 0 0 8px rgba(24, 224, 255, 0.35);
    }

    .cs-brick-chip {
      width: 20px;
      height: 11px;
      border-radius: 2px;
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 8px;
      font-weight: 700;
      color: rgba(0, 0, 0, 0.72);
    }

    .cs-brick-label {
      flex: 1;
      text-transform: uppercase;
      font-size: 9.5px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .cs-brick-pts {
      font-size: 8.5px;
      color: #7e98bf;
    }

    .cs-hp-bar {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 3px;
    }

    .cs-mini-btn {
      cursor: pointer;
      padding: 3px 2px;
      background: #0a1224;
      border: 1px solid rgba(92, 140, 210, 0.32);
      border-radius: 3px;
      color: #b8d0f0;
      font-family: inherit;
      font-size: 9.5px;
      font-weight: 700;
      text-align: center;
    }

    .cs-mini-btn:hover {
      border-color: #6ee7ff;
      color: #fff;
    }

    .cs-mini-btn.active {
      background: rgba(24, 224, 255, 0.22);
      border-color: #18e0ff;
      color: #ffffff;
      box-shadow: 0 0 6px rgba(24, 224, 255, 0.35);
    }

    .cs-capsule-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 3px;
    }

    .cs-cap-btn {
      cursor: pointer;
      padding: 3px 2px;
      border-radius: 3px;
      border: 1px solid rgba(100, 140, 200, 0.3);
      background: #091021;
      color: #dbeaff;
      font-family: inherit;
      font-size: 10px;
      font-weight: 700;
      text-align: center;
      transition: all 0.1s ease;
    }

    .cs-cap-btn:hover {
      transform: translateY(-1px);
      border-color: #fff;
    }

    .cs-cap-btn.active {
      border-color: #ffffff;
      box-shadow: 0 0 8px rgba(255, 255, 255, 0.55);
      color: #fff;
    }

    .cs-cap-desc {
      font-size: 9px;
      color: #9cb6db;
      min-height: 22px;
      line-height: 1.25;
      background: rgba(5, 9, 18, 0.65);
      padding: 3px 5px;
      border-radius: 3px;
      border: 1px solid rgba(70, 110, 170, 0.2);
    }

    .cs-field-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
    }

    .cs-field-col {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .cs-label {
      font-size: 9.5px;
      color: #95b1d9;
      letter-spacing: 0.4px;
    }

    .cs-input,
    .cs-select {
      width: 100%;
      padding: 4px 6px;
      background: #060b17;
      color: #e8f3ff;
      border: 1px solid rgba(82, 138, 214, 0.42);
      border-radius: 3px;
      font-size: 10px;
      outline: none;
    }

    .cs-input:focus,
    .cs-select:focus {
      border-color: #18e0ff;
      box-shadow: 0 0 6px rgba(24, 224, 255, 0.32);
    }

    .cs-input-num {
      width: 52px;
      text-align: center;
    }

    .cs-range {
      width: 100%;
      accent-color: #18e0ff;
      cursor: pointer;
      height: 12px;
    }

    .cs-moving-box {
      display: flex;
      flex-direction: column;
      gap: 5px;
      padding: 5px;
      border-radius: 3px;
      background: rgba(6, 12, 26, 0.75);
      border: 1px dashed rgba(24, 224, 255, 0.28);
    }

    .cs-moving-box.disabled {
      opacity: 0.48;
    }

    .cs-center-col {
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-width: 0;
      min-height: 0;
    }

    .cs-toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 4px;
      padding: 5px 7px;
      background: rgba(10, 17, 34, 0.94);
      border: 1px solid rgba(56, 122, 204, 0.36);
      border-radius: 4px;
      flex-shrink: 0;
    }

    .cs-tool-group {
      display: flex;
      align-items: center;
      gap: 4px;
      flex-wrap: wrap;
    }

    .cs-canvas-stage {
      flex: 1;
      min-height: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(4, 7, 15, 0.9);
      border: 1px solid rgba(24, 224, 255, 0.32);
      border-radius: 4px;
      padding: 5px;
      position: relative;
      overflow: hidden;
      box-shadow: inset 0 0 24px rgba(0, 0, 0, 0.9);
    }

    .cs-grid-canvas {
      max-width: 100%;
      max-height: 100%;
      width: auto;
      height: auto;
      aspect-ratio: ${LOGICAL_CANVAS_W} / ${LOGICAL_CANVAS_H};
      cursor: crosshair;
      display: block;
      border-radius: 2px;
    }

    .cs-statusbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 4px 8px;
      background: rgba(9, 15, 30, 0.94);
      border: 1px solid rgba(56, 122, 204, 0.32);
      border-radius: 4px;
      font-size: 9.5px;
      color: #9bb8e0;
      flex-shrink: 0;
    }

    .cs-stat-pill {
      color: #7ef4ff;
      font-weight: 700;
    }

    .cs-btn-row-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4px;
    }

    .cs-btn-row-3 {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 4px;
    }

    .cs-slot-list {
      display: flex;
      flex-direction: column;
      gap: 3px;
      max-height: 92px;
      overflow-y: auto;
      padding-right: 2px;
    }

    .cs-slot-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 4px;
      padding: 3px 5px;
      background: #060b17;
      border: 1px solid rgba(72, 118, 188, 0.3);
      border-radius: 3px;
      font-size: 9.5px;
    }

    .cs-slot-name {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: #d4e6ff;
      font-weight: 700;
    }

    .cs-slot-empty {
      font-size: 9px;
      color: #6d86ab;
      text-align: center;
      padding: 6px 4px;
      font-style: italic;
    }
  `;
  document.head.appendChild(style);
}

function cloneBrick(b: BrickBlueprint): BrickBlueprint {
  return {
    col: b.col,
    row: b.row,
    kind: b.kind,
    ...(b.hits !== undefined ? { hits: b.hits } : {}),
    ...(b.moving ? { moving: { ...b.moving } } : {}),
    ...(b.capsule ? { capsule: b.capsule } : {}),
  };
}

function cloneStage(stage: StageDefinition): StageDefinition {
  return {
    id: stage.id,
    round: stage.round,
    branchLabel: stage.branchLabel,
    name: stage.name,
    subtitle: stage.subtitle,
    theme: stage.theme,
    enemyKind: stage.enemyKind,
    ...(stage.boss ? { boss: stage.boss } : {}),
    bricks: stage.bricks.map(cloneBrick),
    ...(stage.capsuleDropRate !== undefined ? { capsuleDropRate: stage.capsuleDropRate } : {}),
    ...(stage.capsuleWeights ? { capsuleWeights: { ...stage.capsuleWeights } } : {}),
  };
}

function createStarterStage(): StageDefinition {
  const bricks: BrickBlueprint[] = [];
  const rowKinds: { row: number; kind: BrickKind }[] = [
    { row: 2, kind: 'silver' },
    { row: 3, kind: 'red' },
    { row: 4, kind: 'orange' },
    { row: 5, kind: 'yellow' },
    { row: 6, kind: 'green' },
    { row: 7, kind: 'cyan' },
    { row: 8, kind: 'blue' },
    { row: 9, kind: 'magenta' },
  ];

  for (const { row, kind } of rowKinds) {
    for (let col = 1; col <= 11; col++) {
      if (col === 6 && (row === 4 || row === 5)) {
        bricks.push({ col, row, kind: 'gold' });
        continue;
      }
      const capsule: CapsuleType | undefined =
        row === 7 && col === 3 ? 'L' : row === 7 && col === 9 ? 'E' : row === 5 && col === 2 ? 'M' : undefined;
      bricks.push({
        col,
        row,
        kind,
        ...(capsule ? { capsule } : {}),
      });
    }
  }

  // Symmetric moving sentinel bricks on row 11
  bricks.push({
    col: 2,
    row: 11,
    kind: 'regen',
    hits: 2,
    moving: { minCol: 1, maxCol: 5, speed: 1.8, dir: 1 },
  });
  bricks.push({
    col: 10,
    row: 11,
    kind: 'regen',
    hits: 2,
    moving: { minCol: 7, maxCol: 11, speed: 1.8, dir: -1 },
  });

  return {
    id: 1001,
    round: 1,
    branchLabel: 'CUST',
    name: 'VAUS CITADEL',
    subtitle: 'ARKANOID II CONSTRUCTION SET',
    theme: 'hull_breach',
    enemyKind: 'pyramid',
    bricks,
    capsuleDropRate: 0.24,
  };
}

export class ConstructionSetEditor {
  private readonly overlayRoot: HTMLElement;
  private readonly callbacks: EditorCallbacks;
  private opened = false;

  // Stage grid [row 0..21][col 0..12]
  private grid: (BrickBlueprint | null)[][] = [];
  private meta: StageMetaState = {
    id: 1001,
    round: 1,
    branchLabel: 'CUST',
    name: 'VAUS CITADEL',
    subtitle: 'ARKANOID II CONSTRUCTION SET',
    theme: 'hull_breach',
    enemyKind: 'pyramid',
    boss: undefined,
    capsuleDropRate: 0.24,
  };

  // Undo / Redo stacks
  private undoStack: StageDefinition[] = [];
  private redoStack: StageDefinition[] = [];

  // Active brush & tool state
  private activeTool: EditorTool = 'paint';
  private mirrorX = true;
  private selectedKind: BrickKind = 'cyan';
  private customHits: number | null = null; // null = Auto, 1..6 = override for silver/regen
  private selectedCapsule: CapsuleType | null = null;
  private movingEnabled = false;
  private movingMinCol = 1;
  private movingMaxCol = 11;
  private movingSpeed = 1.8;
  private movingDir: 1 | -1 = 1;
  private targetFillRow = 4;
  private patternSeedCounter = 0;

  // Pointer & hover state
  private isDragging = false;
  private dragEraseMode = false;
  private lastPaintedCellKey = '';
  private hoverCell: { col: number; row: number } | null = null;

  // DOM Elements
  private rootEl!: HTMLDivElement;
  private gridCanvas!: HTMLCanvasElement;
  private gridCtx!: CanvasRenderingContext2D;
  private toastEl!: HTMLDivElement;
  private toastTimer: number | null = null;
  private statusCoordsEl!: HTMLSpanElement;
  private statusCountsEl!: HTMLSpanElement;

  // Dynamic UI references for synchronization
  private toolButtons = new Map<EditorTool, HTMLButtonElement>();
  private mirrorBtn!: HTMLButtonElement;
  private rowFillSelect!: HTMLSelectElement;
  private swatchButtons = new Map<BrickKind, HTMLButtonElement>();
  private hpButtons = new Map<number | null, HTMLButtonElement>();
  private capsuleButtons = new Map<CapsuleType | null, HTMLButtonElement>();
  private capsuleDescEl!: HTMLDivElement;

  private movingToggleBtn!: HTMLButtonElement;
  private movingBoxEl!: HTMLDivElement;
  private minColInput!: HTMLInputElement;
  private maxColInput!: HTMLInputElement;
  private speedSlider!: HTMLInputElement;
  private speedLabelEl!: HTMLSpanElement;
  private dirLeftBtn!: HTMLButtonElement;
  private dirRightBtn!: HTMLButtonElement;

  private nameInput!: HTMLInputElement;
  private subtitleInput!: HTMLInputElement;
  private themeSelect!: HTMLSelectElement;
  private enemySelect!: HTMLSelectElement;
  private bossSelect!: HTMLSelectElement;
  private dropRateSlider!: HTMLInputElement;
  private dropRateLabelEl!: HTMLSpanElement;

  private campaignSelect!: HTMLSelectElement;
  private slotListEl!: HTMLDivElement;
  private fileInputEl!: HTMLInputElement;

  private readonly boundKeyDown: (e: KeyboardEvent) => void;
  private readonly boundWindowPointerUp: () => void;

  constructor(overlayRoot: HTMLElement, callbacks: EditorCallbacks) {
    this.overlayRoot = overlayRoot;
    this.callbacks = callbacks;

    injectConstructionSetStyles();
    this.initEmptyGrid();

    this.boundKeyDown = (e: KeyboardEvent) => this.handleKeyDown(e);
    this.boundWindowPointerUp = () => this.finishDrag();

    this.buildDom();
    this.applyStageToState(createStarterStage(), false);
  }

  public open(initialStage?: StageDefinition): void {
    if (typeof document !== 'undefined' && document.pointerLockElement) {
      try {
        document.exitPointerLock?.();
      } catch {
        // Ignore pointer lock exit errors
      }
    }

    if (initialStage) {
      this.undoStack = [];
      this.redoStack = [];
      this.applyStageToState(cloneStage(initialStage), false);
    }

    this.populateCampaignPresets();
    this.renderCustomSlots();
    this.syncUiControls();
    this.renderGridCanvas();

    if (!this.opened) {
      this.opened = true;
      this.rootEl.style.pointerEvents = 'auto';
      if (!this.rootEl.parentElement) {
        this.overlayRoot.appendChild(this.rootEl);
      }
      window.addEventListener('keydown', this.boundKeyDown);
      window.addEventListener('pointerup', this.boundWindowPointerUp);
    }
  }

  public close(): void {
    if (!this.opened) {
      return;
    }
    this.opened = false;
    this.isDragging = false;
    this.hoverCell = null;
    this.rootEl.style.pointerEvents = 'none';
    if (this.rootEl.parentElement) {
      this.rootEl.parentElement.removeChild(this.rootEl);
    }
    window.removeEventListener('keydown', this.boundKeyDown);
    window.removeEventListener('pointerup', this.boundWindowPointerUp);
  }

  public isOpen(): boolean {
    return this.opened;
  }

  public getCurrentStage(): StageDefinition {
    const bricks: BrickBlueprint[] = [];
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const cell = this.grid[row]?.[col];
        if (cell) {
          bricks.push(cloneBrick(cell));
        }
      }
    }

    return {
      id: this.meta.id >= 1 ? this.meta.id : 1001,
      round: this.meta.round >= 1 ? this.meta.round : 1,
      branchLabel: this.meta.branchLabel || 'CUST',
      name: this.meta.name.trim() || 'UNTITLED SECTOR',
      subtitle: this.meta.subtitle.trim() || 'ARKANOID II CONSTRUCTION SET',
      theme: this.meta.theme,
      enemyKind: this.meta.enemyKind,
      ...(this.meta.boss ? { boss: this.meta.boss } : {}),
      bricks,
      capsuleDropRate: Number(this.meta.capsuleDropRate.toFixed(2)),
      ...(this.meta.capsuleWeights ? { capsuleWeights: { ...this.meta.capsuleWeights } } : {}),
    };
  }

  // =========================================================================
  // INTERNAL STATE & GRID HELPERS
  // =========================================================================

  private initEmptyGrid(): void {
    this.grid = Array.from({ length: GRID_ROWS }, () =>
      Array.from({ length: GRID_COLS }, () => null)
    );
  }

  private pushUndoSnapshot(): void {
    this.undoStack.push(this.getCurrentStage());
    if (this.undoStack.length > MAX_UNDO_STEPS) {
      this.undoStack.shift();
    }
    this.redoStack = [];
  }

  private undo(): void {
    const prev = this.undoStack.pop();
    if (!prev) {
      this.showToast('Nothing to undo');
      return;
    }
    this.redoStack.push(this.getCurrentStage());
    this.applyStageToState(prev, false);
    this.playUiTick();
    this.showToast('Undo');
  }

  private redo(): void {
    const next = this.redoStack.pop();
    if (!next) {
      this.showToast('Nothing to redo');
      return;
    }
    this.undoStack.push(this.getCurrentStage());
    this.applyStageToState(next, false);
    this.playUiTick();
    this.showToast('Redo');
  }

  private applyStageToState(stage: StageDefinition, recordUndo = true): void {
    if (recordUndo) {
      this.pushUndoSnapshot();
    }
    this.initEmptyGrid();
    for (const raw of stage.bricks) {
      const col = Math.max(0, Math.min(GRID_COLS - 1, Math.round(raw.col)));
      const row = Math.max(0, Math.min(GRID_ROWS - 1, Math.round(raw.row)));
      this.grid[row][col] = {
        ...cloneBrick(raw),
        col,
        row,
      };
    }

    this.meta = {
      id: stage.id || 1001,
      round: stage.round || 1,
      branchLabel: stage.branchLabel || 'CUST',
      name: stage.name || 'CUSTOM STAGE',
      subtitle: stage.subtitle || 'ARKANOID II STUDIO',
      theme: stage.theme || 'hull_breach',
      enemyKind: stage.enemyKind || 'pyramid',
      boss: stage.boss,
      capsuleDropRate:
        stage.capsuleDropRate !== undefined
          ? Math.max(0, Math.min(0.6, stage.capsuleDropRate))
          : 0.24,
      capsuleWeights: stage.capsuleWeights ? { ...stage.capsuleWeights } : undefined,
    };

    if (this.rootEl) {
      this.syncUiControls();
      this.updateStatusBar();
      this.renderGridCanvas();
    }
  }

  private playUiTick(): void {
    this.callbacks.onUiSound?.();
  }

  private showToast(msg: string, warn = false): void {
    if (!this.toastEl) return;
    this.toastEl.textContent = msg;
    this.toastEl.classList.toggle('warn', warn);
    this.toastEl.classList.add('visible');
    if (this.toastTimer !== null) {
      window.clearTimeout(this.toastTimer);
    }
    this.toastTimer = window.setTimeout(() => {
      this.toastEl.classList.remove('visible');
      this.toastTimer = null;
    }, 2400);
  }

  private createBrickForCell(col: number, row: number, mirrored = false): BrickBlueprint {
    const bp: BrickBlueprint = {
      col,
      row,
      kind: this.selectedKind,
    };

    if (
      this.customHits !== null &&
      (this.selectedKind === 'silver' || this.selectedKind === 'regen')
    ) {
      bp.hits = Math.max(1, Math.min(6, this.customHits));
    }

    if (this.selectedCapsule !== null) {
      bp.capsule = this.selectedCapsule;
    }

    if (this.movingEnabled) {
      const rawLo = Math.max(0, Math.min(GRID_COLS - 1, Math.min(this.movingMinCol, this.movingMaxCol)));
      const rawHi = Math.max(0, Math.min(GRID_COLS - 1, Math.max(this.movingMinCol, this.movingMaxCol)));
      const speed = Number(Math.max(0.8, Math.min(4.0, this.movingSpeed)).toFixed(1));

      if (!mirrored) {
        bp.moving = {
          minCol: Math.min(rawLo, col),
          maxCol: Math.max(rawHi, col),
          speed,
          dir: this.movingDir,
        };
      } else {
        const mirLo = GRID_COLS - 1 - rawHi;
        const mirHi = GRID_COLS - 1 - rawLo;
        bp.moving = {
          minCol: Math.min(mirLo, col),
          maxCol: Math.max(mirHi, col),
          speed,
          dir: this.movingDir === 1 ? -1 : 1,
        };
      }
    }

    return bp;
  }

  private applyCellAction(col: number, row: number, forceErase: boolean): void {
    if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return;

    this.targetFillRow = row;
    if (this.rowFillSelect) {
      this.rowFillSelect.value = String(row);
    }

    if (!forceErase && this.activeTool === 'pick') {
      const existing = this.grid[row][col];
      if (existing) {
        this.selectedKind = existing.kind;
        this.customHits = existing.hits !== undefined ? existing.hits : null;
        this.selectedCapsule = existing.capsule ?? null;
        if (existing.moving) {
          this.movingEnabled = true;
          this.movingMinCol = existing.moving.minCol;
          this.movingMaxCol = existing.moving.maxCol;
          this.movingSpeed = existing.moving.speed;
          this.movingDir = existing.moving.dir;
        } else {
          this.movingEnabled = false;
        }
        this.activeTool = 'paint';
        this.syncUiControls();
        this.playUiTick();
        this.showToast(`Picked ${existing.kind.toUpperCase()} @ C${col}:R${row}`);
      }
      return;
    }

    if (!forceErase && this.activeTool === 'row_fill') {
      this.fillSingleRow(row, false);
      return;
    }

    const erasing = forceErase || this.activeTool === 'erase';
    const mirrorCol = GRID_COLS - 1 - col;

    if (erasing) {
      this.grid[row][col] = null;
      if (this.mirrorX) {
        this.grid[row][mirrorCol] = null;
      }
    } else {
      this.grid[row][col] = this.createBrickForCell(col, row, false);
      if (this.mirrorX && mirrorCol !== col) {
        this.grid[row][mirrorCol] = this.createBrickForCell(mirrorCol, row, true);
      }
    }

    this.updateStatusBar();
    this.renderGridCanvas();
  }

  private fillSingleRow(row: number, standaloneUndo = true): void {
    if (row < 0 || row >= GRID_ROWS) return;
    if (standaloneUndo) {
      this.pushUndoSnapshot();
    }
    for (let col = 0; col < GRID_COLS; col++) {
      const mirrored = this.mirrorX && col > 6;
      this.grid[row][col] = this.createBrickForCell(col, row, mirrored);
    }
    this.updateStatusBar();
    this.renderGridCanvas();
  }

  private clearBoard(): void {
    this.pushUndoSnapshot();
    this.initEmptyGrid();
    this.playUiTick();
    this.updateStatusBar();
    this.renderGridCanvas();
    this.showToast('Board Cleared');
  }

  private randomizeArcadePattern(): void {
    this.pushUndoSnapshot();
    this.initEmptyGrid();

    const patternType = this.patternSeedCounter % 5;
    this.patternSeedCounter++;

    const vibrantPalette: BrickKind[] = [
      'red',
      'orange',
      'yellow',
      'green',
      'cyan',
      'blue',
      'magenta',
      'white',
    ];
    const powerPool: CapsuleType[] = ['E', 'L', 'C', 'S', 'D', 'M', 'T', 'I', 'N', '?', 'G'];
    const randCap = (): CapsuleType | undefined =>
      Math.random() < 0.12 ? powerPool[Math.floor(Math.random() * powerPool.length)] : undefined;

    if (patternType === 0) {
      // Twin Neon Bastions + Moving Patrol Row
      for (let r = 2; r <= 12; r++) {
        const kind = vibrantPalette[(r - 2) % vibrantPalette.length];
        for (let c = 1; c <= 5; c++) {
          if (r === 12 && (c === 2 || c === 4)) continue;
          const isShield = r === 10 && c >= 2 && c <= 4;
          const k: BrickKind = isShield ? 'silver' : c === 3 && r === 6 ? 'gold' : kind;
          const cap = k !== 'gold' ? randCap() : undefined;
          this.grid[r][c] = { col: c, row: r, kind: k, ...(cap ? { capsule: cap } : {}) };
          const mc = GRID_COLS - 1 - c;
          this.grid[r][mc] = { col: mc, row: r, kind: k, ...(cap ? { capsule: cap } : {}) };
        }
      }
      this.grid[14][2] = {
        col: 2,
        row: 14,
        kind: 'regen',
        hits: 2,
        moving: { minCol: 0, maxCol: 5, speed: 2.0, dir: 1 },
      };
      this.grid[14][10] = {
        col: 10,
        row: 14,
        kind: 'regen',
        hits: 2,
        moving: { minCol: 7, maxCol: 12, speed: 2.0, dir: -1 },
      };
    } else if (patternType === 1) {
      // Diamond Reactor Core
      const centerC = 6;
      const centerR = 8;
      for (let r = 1; r <= 15; r++) {
        for (let c = 0; c <= 6; c++) {
          const dist = Math.abs(c - centerC) + Math.abs(r - centerR);
          if (dist <= 7) {
            const kind: BrickKind =
              dist === 0
                ? 'gold'
                : dist === 7
                  ? 'silver'
                  : vibrantPalette[dist % vibrantPalette.length];
            const cap = dist === 2 && c === 6 ? 'G' : kind !== 'gold' ? randCap() : undefined;
            this.grid[r][c] = { col: c, row: r, kind, ...(cap ? { capsule: cap } : {}) };
            const mc = GRID_COLS - 1 - c;
            this.grid[r][mc] = { col: mc, row: r, kind, ...(cap ? { capsule: cap } : {}) };
          }
        }
      }
    } else if (patternType === 2) {
      // Diagonal Arcade Ribbons + Gold Chicanes
      for (let r = 2; r <= 14; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          if (r === 8 && (c <= 2 || c >= 10)) {
            this.grid[r][c] = { col: c, row: r, kind: 'gold' };
            continue;
          }
          if ((r + c) % 2 === 0) {
            const kind = vibrantPalette[(r + Math.min(c, 12 - c)) % vibrantPalette.length];
            const cap = randCap();
            this.grid[r][c] = { col: c, row: r, kind, ...(cap ? { capsule: cap } : {}) };
          }
        }
      }
    } else if (patternType === 3) {
      // DOH Sentinel Glyph (Symmetric Alien Visor)
      const mask = [
        '0011111111100',
        '0111111111110',
        '1110011100111',
        '1110011100111',
        '1111111111111',
        '0111101011110',
        '0011111111100',
        '0001010101000',
      ];
      for (let i = 0; i < mask.length; i++) {
        const r = i + 3;
        for (let c = 0; c < GRID_COLS; c++) {
          if (mask[i][c] === '1') {
            const kind: BrickKind =
              i === 0 ? 'silver' : i === 2 || i === 3 ? 'magenta' : vibrantPalette[i % vibrantPalette.length];
            const cap = randCap();
            this.grid[r][c] = { col: c, row: r, kind, ...(cap ? { capsule: cap } : {}) };
          }
        }
      }
      for (let c = 3; c <= 9; c += 2) {
        this.grid[13][c] = {
          col: c,
          row: 13,
          kind: 'cyan',
          moving: { minCol: Math.max(0, c - 2), maxCol: Math.min(12, c + 2), speed: 1.6, dir: 1 },
        };
      }
    } else {
      // Layered Citadel Corridors
      for (let r = 2; r <= 15; r += 2) {
        const kind: BrickKind = r === 14 ? 'silver' : vibrantPalette[(r / 2) % vibrantPalette.length];
        for (let c = 0; c < GRID_COLS; c++) {
          if (c === 6) continue;
          const isGate = (c === 3 || c === 9) && r === 10;
          const cap = randCap();
          this.grid[r][c] = {
            col: c,
            row: r,
            kind: isGate ? 'regen' : kind,
            ...(isGate ? { hits: 3 } : {}),
            ...(cap ? { capsule: cap } : {}),
          };
        }
      }
    }

    this.playUiTick();
    this.updateStatusBar();
    this.renderGridCanvas();
    this.showToast('Randomized Arcade Pattern!');
  }

  // =========================================================================
  // DOM CONSTRUCTION
  // =========================================================================

  private buildDom(): void {
    this.rootEl = document.createElement('div');
    this.rootEl.className = 'cs-root modal-panel';
    this.rootEl.addEventListener('contextmenu', (e) => e.preventDefault());

    // Prevent typing in inputs from triggering global gameplay shortcuts
    const stopKeys = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') {
        e.stopPropagation();
      }
    };
    this.rootEl.addEventListener('keydown', stopKeys);
    this.rootEl.addEventListener('keyup', stopKeys);

    // 1. TOP HEADER BAR
    const topBar = document.createElement('div');
    topBar.className = 'cs-topbar';

    const brand = document.createElement('div');
    brand.className = 'cs-brand';
    const badge = document.createElement('span');
    badge.className = 'cs-badge-logo';
    badge.textContent = 'TAITO // 1988-2026';
    const titleGroup = document.createElement('div');
    titleGroup.className = 'cs-title-group';
    const titleMain = document.createElement('div');
    titleMain.className = 'cs-title-main';
    titleMain.textContent = 'ARKANOID II CONSTRUCTION SET';
    const titleSub = document.createElement('div');
    titleSub.className = 'cs-title-sub';
    titleSub.textContent = 'REVENGE OF DOH — IN-BROWSER LEVEL & CAMPAIGN STUDIO';
    titleGroup.append(titleMain, titleSub);
    brand.append(badge, titleGroup);

    const topActions = document.createElement('div');
    topActions.className = 'cs-top-actions';

    this.toastEl = document.createElement('div');
    this.toastEl.className = 'cs-toast';

    const playtestBtn = document.createElement('button');
    playtestBtn.type = 'button';
    playtestBtn.className = 'cs-btn cs-btn-playtest';
    playtestBtn.textContent = '▶ PLAYTEST STAGE';
    playtestBtn.addEventListener('click', () => {
      this.playUiTick();
      const stage = this.getCurrentStage();
      this.close();
      this.callbacks.onPlaytest(stage);
    });

    const exitBtn = document.createElement('button');
    exitBtn.type = 'button';
    exitBtn.className = 'cs-btn cs-btn-exit';
    exitBtn.textContent = '✕ EXIT TO MENU';
    exitBtn.addEventListener('click', () => {
      this.playUiTick();
      this.close();
      this.callbacks.onExit();
    });

    topActions.append(this.toastEl, playtestBtn, exitBtn);
    topBar.append(brand, topActions);

    // 2. THREE-COLUMN STUDIO WORKSPACE
    const workspace = document.createElement('div');
    workspace.className = 'cs-workspace';

    const leftSidebar = this.buildLeftSidebar();
    const centerColumn = this.buildCenterColumn();
    const rightSidebar = this.buildRightSidebar();

    workspace.append(leftSidebar, centerColumn, rightSidebar);
    this.rootEl.append(topBar, workspace);
  }

  private buildLeftSidebar(): HTMLElement {
    const col = document.createElement('div');
    col.className = 'cs-sidebar';

    // Card 1: Brick Kind Palette
    const paletteCard = document.createElement('div');
    paletteCard.className = 'cs-card';
    const paletteHdr = document.createElement('div');
    paletteHdr.className = 'cs-card-hdr';
    paletteHdr.innerHTML = '<span>01 // BRICK PALETTE</span><span>11 KINDS</span>';

    const brickGrid = document.createElement('div');
    brickGrid.className = 'cs-brick-grid';

    for (const kind of BRICK_ORDER) {
      const colors = BRICK_COLORS[kind];
      const pts = BRICK_POINTS[kind];
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cs-brick-swatch';
      btn.title = `${kind.toUpperCase()} (${pts} pts)`;

      const chip = document.createElement('span');
      chip.className = 'cs-brick-chip';
      chip.style.background = `linear-gradient(180deg, ${colors.light} 0%, ${colors.fill} 55%, ${colors.dark} 100%)`;
      chip.style.border = `1px solid ${colors.light}`;
      chip.textContent = colors.symbol;

      const label = document.createElement('span');
      label.className = 'cs-brick-label';
      label.textContent = kind;

      const ptsSpan = document.createElement('span');
      ptsSpan.className = 'cs-brick-pts';
      ptsSpan.textContent = kind === 'gold' ? '∞' : `${pts}`;

      btn.append(chip, label, ptsSpan);
      btn.addEventListener('click', () => {
        this.selectedKind = kind;
        if (this.activeTool === 'erase' || this.activeTool === 'pick') {
          this.activeTool = 'paint';
        }
        this.playUiTick();
        this.syncUiControls();
        this.renderGridCanvas();
      });

      this.swatchButtons.set(kind, btn);
      brickGrid.appendChild(btn);
    }

    // Custom Hit Points override (1..6) for Silver/Regen
    const hpWrap = document.createElement('div');
    hpWrap.className = 'cs-field-col';
    const hpLabel = document.createElement('div');
    hpLabel.className = 'cs-label';
    hpLabel.textContent = 'Silver / Regen Hit Points (1..6):';
    const hpBar = document.createElement('div');
    hpBar.className = 'cs-hp-bar';

    const hpValues: (number | null)[] = [null, 1, 2, 3, 4, 5, 6];
    for (const val of hpValues) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'cs-mini-btn';
      b.textContent = val === null ? 'AUTO' : `${val}HP`;
      b.title = val === null ? 'Default round-scaled HP' : `Override to ${val} hits`;
      b.addEventListener('click', () => {
        this.customHits = val;
        this.playUiTick();
        this.syncUiControls();
      });
      this.hpButtons.set(val, b);
      hpBar.appendChild(b);
    }
    hpWrap.append(hpLabel, hpBar);
    paletteCard.append(paletteHdr, brickGrid, hpWrap);

    // Card 2: Guaranteed Capsule Drop Selector
    const capCard = document.createElement('div');
    capCard.className = 'cs-card';
    const capHdr = document.createElement('div');
    capHdr.className = 'cs-card-hdr';
    capHdr.innerHTML = '<span>02 // CAPSULE DROP</span><span>BADGE</span>';

    const capGrid = document.createElement('div');
    capGrid.className = 'cs-capsule-grid';

    const noneBtn = document.createElement('button');
    noneBtn.type = 'button';
    noneBtn.className = 'cs-cap-btn';
    noneBtn.textContent = 'RND';
    noneBtn.title = 'None (Uses Stage Random Drop Rate)';
    noneBtn.addEventListener('click', () => {
      this.selectedCapsule = null;
      this.playUiTick();
      this.syncUiControls();
    });
    this.capsuleButtons.set(null, noneBtn);
    capGrid.appendChild(noneBtn);

    for (const c of CAPSULE_ORDER) {
      const meta = CAPSULE_META[c];
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'cs-cap-btn';
      b.textContent = c;
      b.title = `${c} — ${meta.name}: ${meta.desc}`;
      b.style.background = `linear-gradient(180deg, ${meta.color}cc 0%, #091021 100%)`;
      b.style.borderColor = `${meta.accent}88`;
      b.addEventListener('click', () => {
        this.selectedCapsule = c;
        this.playUiTick();
        this.syncUiControls();
      });
      this.capsuleButtons.set(c, b);
      capGrid.appendChild(b);
    }

    this.capsuleDescEl = document.createElement('div');
    this.capsuleDescEl.className = 'cs-cap-desc';

    capCard.append(capHdr, capGrid, this.capsuleDescEl);

    // Card 3: Moving Brick Inspector / Rail Config
    const moveCard = document.createElement('div');
    moveCard.className = 'cs-card';
    const moveHdr = document.createElement('div');
    moveHdr.className = 'cs-card-hdr';
    moveHdr.innerHTML = '<span>03 // MOVING BRICK</span><span>RAILS</span>';

    this.movingToggleBtn = document.createElement('button');
    this.movingToggleBtn.type = 'button';
    this.movingToggleBtn.className = 'cs-btn';
    this.movingToggleBtn.addEventListener('click', () => {
      this.movingEnabled = !this.movingEnabled;
      this.playUiTick();
      this.syncUiControls();
      this.renderGridCanvas();
    });

    this.movingBoxEl = document.createElement('div');
    this.movingBoxEl.className = 'cs-moving-box';

    const colSpanRow = document.createElement('div');
    colSpanRow.className = 'cs-field-row';
    const minLbl = document.createElement('span');
    minLbl.className = 'cs-label';
    minLbl.textContent = 'Min..Max Col:';

    const spanInputs = document.createElement('div');
    spanInputs.style.display = 'flex';
    spanInputs.style.alignItems = 'center';
    spanInputs.style.gap = '4px';

    this.minColInput = document.createElement('input');
    this.minColInput.type = 'number';
    this.minColInput.min = '0';
    this.minColInput.max = '12';
    this.minColInput.className = 'cs-input cs-input-num';
    this.minColInput.addEventListener('change', () => {
      this.movingMinCol = Math.max(0, Math.min(12, Number(this.minColInput.value) || 0));
      if (this.movingMinCol > this.movingMaxCol) {
        this.movingMaxCol = this.movingMinCol;
      }
      this.syncUiControls();
      this.renderGridCanvas();
    });

    this.maxColInput = document.createElement('input');
    this.maxColInput.type = 'number';
    this.maxColInput.min = '0';
    this.maxColInput.max = '12';
    this.maxColInput.className = 'cs-input cs-input-num';
    this.maxColInput.addEventListener('change', () => {
      this.movingMaxCol = Math.max(0, Math.min(12, Number(this.maxColInput.value) ?? 12));
      if (this.movingMaxCol < this.movingMinCol) {
        this.movingMinCol = this.movingMaxCol;
      }
      this.syncUiControls();
      this.renderGridCanvas();
    });

    spanInputs.append(this.minColInput, this.maxColInput);
    colSpanRow.append(minLbl, spanInputs);

    const speedCol = document.createElement('div');
    speedCol.className = 'cs-field-col';
    const speedTop = document.createElement('div');
    speedTop.className = 'cs-field-row';
    const speedTitle = document.createElement('span');
    speedTitle.className = 'cs-label';
    speedTitle.textContent = 'Patrol Speed:';
    this.speedLabelEl = document.createElement('span');
    this.speedLabelEl.className = 'cs-stat-pill';
    speedTop.append(speedTitle, this.speedLabelEl);

    this.speedSlider = document.createElement('input');
    this.speedSlider.type = 'range';
    this.speedSlider.min = '0.8';
    this.speedSlider.max = '4.0';
    this.speedSlider.step = '0.1';
    this.speedSlider.className = 'cs-range';
    this.speedSlider.addEventListener('input', () => {
      this.movingSpeed = Number(this.speedSlider.value);
      this.speedLabelEl.textContent = `${this.movingSpeed.toFixed(1)} col/s`;
    });
    speedCol.append(speedTop, this.speedSlider);

    const dirRow = document.createElement('div');
    dirRow.className = 'cs-field-row';
    const dirLbl = document.createElement('span');
    dirLbl.className = 'cs-label';
    dirLbl.textContent = 'Initial Dir:';
    const dirBtns = document.createElement('div');
    dirBtns.className = 'cs-btn-row-2';
    dirBtns.style.width = '112px';

    this.dirLeftBtn = document.createElement('button');
    this.dirLeftBtn.type = 'button';
    this.dirLeftBtn.className = 'cs-mini-btn';
    this.dirLeftBtn.textContent = '◄ -1';
    this.dirLeftBtn.addEventListener('click', () => {
      this.movingDir = -1;
      this.playUiTick();
      this.syncUiControls();
      this.renderGridCanvas();
    });

    this.dirRightBtn = document.createElement('button');
    this.dirRightBtn.type = 'button';
    this.dirRightBtn.className = 'cs-mini-btn';
    this.dirRightBtn.textContent = '+1 ►';
    this.dirRightBtn.addEventListener('click', () => {
      this.movingDir = 1;
      this.playUiTick();
      this.syncUiControls();
      this.renderGridCanvas();
    });

    dirBtns.append(this.dirLeftBtn, this.dirRightBtn);
    dirRow.append(dirLbl, dirBtns);

    this.movingBoxEl.append(colSpanRow, speedCol, dirRow);
    moveCard.append(moveHdr, this.movingToggleBtn, this.movingBoxEl);

    col.append(paletteCard, capCard, moveCard);
    return col;
  }

  private buildCenterColumn(): HTMLElement {
    const center = document.createElement('div');
    center.className = 'cs-center-col';

    // Studio Grid Toolbar
    const toolbar = document.createElement('div');
    toolbar.className = 'cs-toolbar';

    const leftTools = document.createElement('div');
    leftTools.className = 'cs-tool-group';

    const makeToolBtn = (tool: EditorTool, label: string, tip: string) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cs-btn';
      btn.textContent = label;
      btn.title = tip;
      btn.addEventListener('click', () => {
        this.activeTool = tool;
        this.playUiTick();
        this.syncUiControls();
      });
      this.toolButtons.set(tool, btn);
      return btn;
    };

    const paintBtn = makeToolBtn('paint', '✎ Paint', 'Left-click & drag to paint bricks (Right-click erases)');
    const eraseBtn = makeToolBtn('erase', '⌫ Erase', 'Erase cells');
    const pickBtn = makeToolBtn('pick', '⌖ Pick', 'Eyedropper: copy brick settings from grid (or Alt+Click)');

    this.mirrorBtn = document.createElement('button');
    this.mirrorBtn.type = 'button';
    this.mirrorBtn.className = 'cs-btn';
    this.mirrorBtn.title = 'Mirror X Symmetry across column 6 (12 - col)';
    this.mirrorBtn.addEventListener('click', () => {
      this.mirrorX = !this.mirrorX;
      this.playUiTick();
      this.syncUiControls();
      this.renderGridCanvas();
    });

    leftTools.append(paintBtn, eraseBtn, pickBtn, this.mirrorBtn);

    const rightTools = document.createElement('div');
    rightTools.className = 'cs-tool-group';

    this.rowFillSelect = document.createElement('select');
    this.rowFillSelect.className = 'cs-select';
    this.rowFillSelect.style.width = '56px';
    this.rowFillSelect.style.padding = '3px 4px';
    this.rowFillSelect.title = 'Target row for Row Fill';
    for (let r = 0; r < GRID_ROWS; r++) {
      const opt = document.createElement('option');
      opt.value = String(r);
      opt.textContent = `R${String(r).padStart(2, '0')}`;
      this.rowFillSelect.appendChild(opt);
    }
    this.rowFillSelect.value = String(this.targetFillRow);
    this.rowFillSelect.addEventListener('change', () => {
      this.targetFillRow = Number(this.rowFillSelect.value) || 0;
    });

    const rowFillBtn = document.createElement('button');
    rowFillBtn.type = 'button';
    rowFillBtn.className = 'cs-btn';
    rowFillBtn.textContent = '═ Row Fill';
    rowFillBtn.title = 'Fill selected row with current brick (Shift+Click on grid also fills any row)';
    rowFillBtn.addEventListener('click', () => {
      this.playUiTick();
      this.fillSingleRow(this.targetFillRow, true);
      this.showToast(`Filled Row ${String(this.targetFillRow).padStart(2, '0')}`);
    });

    const randomBtn = document.createElement('button');
    randomBtn.type = 'button';
    randomBtn.className = 'cs-btn cs-btn-accent';
    randomBtn.textContent = '🎲 Randomize';
    randomBtn.title = 'Randomize Arcade Pattern';
    randomBtn.addEventListener('click', () => this.randomizeArcadePattern());

    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'cs-btn cs-btn-danger';
    clearBtn.textContent = '🗑 Clear';
    clearBtn.title = 'Clear all bricks on the board';
    clearBtn.addEventListener('click', () => this.clearBoard());

    const undoBtn = document.createElement('button');
    undoBtn.type = 'button';
    undoBtn.className = 'cs-btn';
    undoBtn.textContent = '↶';
    undoBtn.title = 'Undo (Ctrl+Z)';
    undoBtn.addEventListener('click', () => this.undo());

    const redoBtn = document.createElement('button');
    redoBtn.type = 'button';
    redoBtn.className = 'cs-btn';
    redoBtn.textContent = '↷';
    redoBtn.title = 'Redo (Ctrl+Y)';
    redoBtn.addEventListener('click', () => this.redo());

    rightTools.append(this.rowFillSelect, rowFillBtn, randomBtn, clearBtn, undoBtn, redoBtn);
    toolbar.append(leftTools, rightTools);

    // Interactive 13x22 Canvas Container
    const canvasStage = document.createElement('div');
    canvasStage.className = 'cs-canvas-stage';

    this.gridCanvas = document.createElement('canvas');
    this.gridCanvas.className = 'cs-grid-canvas';
    // 2x internal HiDPI resolution for crisp vector bevels & capsule badges
    this.gridCanvas.width = LOGICAL_CANVAS_W * 2;
    this.gridCanvas.height = LOGICAL_CANVAS_H * 2;

    const ctx = this.gridCanvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to initialize 2D context for ConstructionSetEditor');
    }
    this.gridCtx = ctx;

    this.bindCanvasEvents();
    canvasStage.appendChild(this.gridCanvas);

    // Footer Status Bar
    const statusBar = document.createElement('div');
    statusBar.className = 'cs-statusbar';

    this.statusCoordsEl = document.createElement('span');
    this.statusCoordsEl.textContent = 'L-Drag: Paint · R-Drag: Erase · Shift+Click: Row Fill · Alt+Click: Pick';

    this.statusCountsEl = document.createElement('span');
    this.statusCountsEl.className = 'cs-stat-pill';

    statusBar.append(this.statusCoordsEl, this.statusCountsEl);
    center.append(toolbar, canvasStage, statusBar);
    return center;
  }

  private buildRightSidebar(): HTMLElement {
    const col = document.createElement('div');
    col.className = 'cs-sidebar';

    // Card 4: Stage Metadata & Atmosphere
    const metaCard = document.createElement('div');
    metaCard.className = 'cs-card';
    const metaHdr = document.createElement('div');
    metaHdr.className = 'cs-card-hdr';
    metaHdr.innerHTML = '<span>04 // STAGE ATMOSPHERE</span><span>META</span>';

    const nameField = document.createElement('div');
    nameField.className = 'cs-field-col';
    const nameLbl = document.createElement('label');
    nameLbl.className = 'cs-label';
    nameLbl.textContent = 'Stage Name:';
    this.nameInput = document.createElement('input');
    this.nameInput.type = 'text';
    this.nameInput.maxLength = 32;
    this.nameInput.className = 'cs-input';
    this.nameInput.placeholder = 'VAUS CITADEL';
    this.nameInput.addEventListener('input', () => {
      this.meta.name = this.nameInput.value;
      this.renderGridCanvas();
    });
    nameField.append(nameLbl, this.nameInput);

    const subField = document.createElement('div');
    subField.className = 'cs-field-col';
    const subLbl = document.createElement('label');
    subLbl.className = 'cs-label';
    subLbl.textContent = 'Subtitle:';
    this.subtitleInput = document.createElement('input');
    this.subtitleInput.type = 'text';
    this.subtitleInput.maxLength = 44;
    this.subtitleInput.className = 'cs-input';
    this.subtitleInput.placeholder = 'CUSTOM SECTOR';
    this.subtitleInput.addEventListener('input', () => {
      this.meta.subtitle = this.subtitleInput.value;
    });
    subField.append(subLbl, this.subtitleInput);

    const themeField = document.createElement('div');
    themeField.className = 'cs-field-col';
    const themeLbl = document.createElement('label');
    themeLbl.className = 'cs-label';
    themeLbl.textContent = 'Sector Theme:';
    this.themeSelect = document.createElement('select');
    this.themeSelect.className = 'cs-select';
    for (const opt of THEME_OPTIONS) {
      const o = document.createElement('option');
      o.value = opt.value;
      o.textContent = opt.label;
      this.themeSelect.appendChild(o);
    }
    this.themeSelect.addEventListener('change', () => {
      this.meta.theme = this.themeSelect.value as SectorTheme;
      this.playUiTick();
      this.renderGridCanvas();
    });
    themeField.append(themeLbl, this.themeSelect);

    const enemyField = document.createElement('div');
    enemyField.className = 'cs-field-col';
    const enemyLbl = document.createElement('label');
    enemyLbl.className = 'cs-label';
    enemyLbl.textContent = 'Enemy Hatch Kind:';
    this.enemySelect = document.createElement('select');
    this.enemySelect.className = 'cs-select';
    for (const opt of ENEMY_OPTIONS) {
      const o = document.createElement('option');
      o.value = opt.value;
      o.textContent = opt.label;
      this.enemySelect.appendChild(o);
    }
    this.enemySelect.addEventListener('change', () => {
      this.meta.enemyKind = this.enemySelect.value as EnemyKind;
      this.playUiTick();
      this.renderGridCanvas();
    });
    enemyField.append(enemyLbl, this.enemySelect);

    const bossField = document.createElement('div');
    bossField.className = 'cs-field-col';
    const bossLbl = document.createElement('label');
    bossLbl.className = 'cs-label';
    bossLbl.textContent = 'Boss Encounter:';
    this.bossSelect = document.createElement('select');
    this.bossSelect.className = 'cs-select';
    for (const opt of BOSS_OPTIONS) {
      const o = document.createElement('option');
      o.value = opt.value;
      o.textContent = opt.label;
      this.bossSelect.appendChild(o);
    }
    this.bossSelect.addEventListener('change', () => {
      const val = this.bossSelect.value;
      this.meta.boss = val ? (val as BossKind) : undefined;
      this.playUiTick();
      this.renderGridCanvas();
    });
    bossField.append(bossLbl, this.bossSelect);

    const dropField = document.createElement('div');
    dropField.className = 'cs-field-col';
    const dropHdr = document.createElement('div');
    dropHdr.className = 'cs-field-row';
    const dropLbl = document.createElement('span');
    dropLbl.className = 'cs-label';
    dropLbl.textContent = 'Capsule Drop Rate:';
    this.dropRateLabelEl = document.createElement('span');
    this.dropRateLabelEl.className = 'cs-stat-pill';
    dropHdr.append(dropLbl, this.dropRateLabelEl);

    this.dropRateSlider = document.createElement('input');
    this.dropRateSlider.type = 'range';
    this.dropRateSlider.min = '0';
    this.dropRateSlider.max = '60';
    this.dropRateSlider.step = '1';
    this.dropRateSlider.className = 'cs-range';
    this.dropRateSlider.addEventListener('input', () => {
      const pct = Number(this.dropRateSlider.value);
      this.meta.capsuleDropRate = pct / 100;
      this.dropRateLabelEl.textContent = `${pct}%`;
    });
    dropField.append(dropHdr, this.dropRateSlider);

    metaCard.append(metaHdr, nameField, subField, themeField, enemyField, bossField, dropField);

    // Card 5: Campaign Remix Preset Loader
    const remixCard = document.createElement('div');
    remixCard.className = 'cs-card';
    const remixHdr = document.createElement('div');
    remixHdr.className = 'cs-card-hdr';
    remixHdr.innerHTML = '<span>05 // CAMPAIGN REMIX</span><span>1..64</span>';

    this.campaignSelect = document.createElement('select');
    this.campaignSelect.className = 'cs-select';
    this.campaignSelect.addEventListener('change', () => {
      this.loadSelectedCampaignPreset();
    });

    const loadPresetBtn = document.createElement('button');
    loadPresetBtn.type = 'button';
    loadPresetBtn.className = 'cs-btn';
    loadPresetBtn.textContent = '📥 Load Selected Campaign Stage';
    loadPresetBtn.addEventListener('click', () => this.loadSelectedCampaignPreset());

    remixCard.append(remixHdr, this.campaignSelect, loadPresetBtn);

    // Card 6: Local Save Slots & Instant Web Sharing
    const shareCard = document.createElement('div');
    shareCard.className = 'cs-card';
    const shareHdr = document.createElement('div');
    shareHdr.className = 'cs-card-hdr';
    shareHdr.innerHTML = '<span>06 // SLOTS & SHARING</span><span>IO</span>';

    const saveSlotBtn = document.createElement('button');
    saveSlotBtn.type = 'button';
    saveSlotBtn.className = 'cs-btn cs-btn-accent';
    saveSlotBtn.textContent = '💾 Save to Local Slots';
    saveSlotBtn.addEventListener('click', () => this.saveCurrentToLocalSlot());

    this.slotListEl = document.createElement('div');
    this.slotListEl.className = 'cs-slot-list';

    const jsonRow = document.createElement('div');
    jsonRow.className = 'cs-btn-row-2';

    const exportBtn = document.createElement('button');
    exportBtn.type = 'button';
    exportBtn.className = 'cs-btn';
    exportBtn.textContent = '⬇ Export .JSON';
    exportBtn.addEventListener('click', () => this.handleExportJson());

    const importBtn = document.createElement('button');
    importBtn.type = 'button';
    importBtn.className = 'cs-btn';
    importBtn.textContent = '⬆ Import .JSON';
    importBtn.addEventListener('click', () => this.fileInputEl.click());

    this.fileInputEl = document.createElement('input');
    this.fileInputEl.type = 'file';
    this.fileInputEl.accept = '.json,application/json';
    this.fileInputEl.style.display = 'none';
    this.fileInputEl.addEventListener('change', () => this.handleImportJsonFile());

    jsonRow.append(exportBtn, importBtn, this.fileInputEl);

    const urlShareBtn = document.createElement('button');
    urlShareBtn.type = 'button';
    urlShareBtn.className = 'cs-btn active';
    urlShareBtn.textContent = '🔗 Copy Shareable URL (?level=...)';
    urlShareBtn.addEventListener('click', () => this.handleCopyShareUrl());

    const loadUrlBtn = document.createElement('button');
    loadUrlBtn.type = 'button';
    loadUrlBtn.className = 'cs-btn';
    loadUrlBtn.textContent = '🌐 Load from Current URL (?level=)';
    loadUrlBtn.title = 'Decode ?level= parameter from current browser URL if present';
    loadUrlBtn.addEventListener('click', () => this.handleLoadFromWindowUrl());

    shareCard.append(shareHdr, saveSlotBtn, this.slotListEl, jsonRow, urlShareBtn, loadUrlBtn);

    col.append(metaCard, remixCard, shareCard);
    return col;
  }

  // =========================================================================
  // UI SYNCHRONIZATION & EVENTS
  // =========================================================================

  private syncUiControls(): void {
    for (const [tool, btn] of this.toolButtons.entries()) {
      btn.classList.toggle('active', this.activeTool === tool);
    }

    this.mirrorBtn.classList.toggle('active', this.mirrorX);
    this.mirrorBtn.textContent = this.mirrorX ? '⇄ Mirror X: ON' : '⇄ Mirror X: OFF';

    for (const [kind, btn] of this.swatchButtons.entries()) {
      btn.classList.toggle('selected', this.selectedKind === kind);
    }

    for (const [hp, btn] of this.hpButtons.entries()) {
      btn.classList.toggle('active', this.customHits === hp);
    }

    for (const [cap, btn] of this.capsuleButtons.entries()) {
      btn.classList.toggle('active', this.selectedCapsule === cap);
    }

    if (this.selectedCapsule === null) {
      this.capsuleDescEl.textContent = 'Random Drop: Uses stage Capsule Drop Rate %.';
    } else {
      const m = CAPSULE_META[this.selectedCapsule];
      this.capsuleDescEl.textContent = `[${this.selectedCapsule}] ${m.name}: ${m.desc}`;
    }

    this.movingToggleBtn.classList.toggle('active', this.movingEnabled);
    this.movingToggleBtn.textContent = this.movingEnabled
      ? '◄► Moving Brick: ENABLED'
      : '◄► Moving Brick: OFF';
    this.movingBoxEl.classList.toggle('disabled', !this.movingEnabled);
    this.minColInput.value = String(this.movingMinCol);
    this.maxColInput.value = String(this.movingMaxCol);
    this.speedSlider.value = String(this.movingSpeed);
    this.speedLabelEl.textContent = `${this.movingSpeed.toFixed(1)} col/s`;
    this.dirLeftBtn.classList.toggle('active', this.movingDir === -1);
    this.dirRightBtn.classList.toggle('active', this.movingDir === 1);

    if (document.activeElement !== this.nameInput) {
      this.nameInput.value = this.meta.name;
    }
    if (document.activeElement !== this.subtitleInput) {
      this.subtitleInput.value = this.meta.subtitle;
    }
    this.themeSelect.value = this.meta.theme;
    this.enemySelect.value = this.meta.enemyKind;
    this.bossSelect.value = this.meta.boss ?? '';

    const dropPct = Math.round(this.meta.capsuleDropRate * 100);
    this.dropRateSlider.value = String(dropPct);
    this.dropRateLabelEl.textContent = `${dropPct}%`;
  }

  private updateStatusBar(): void {
    let total = 0;
    let destructible = 0;
    let gold = 0;
    let moving = 0;

    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const b = this.grid[r][c];
        if (!b) continue;
        total++;
        if (b.kind === 'gold') gold++;
        else destructible++;
        if (b.moving) moving++;
      }
    }

    this.statusCountsEl.textContent = `Bricks: ${total} (Clearable: ${destructible} · Gold: ${gold} · Moving: ${moving})`;
  }

  private mapPointerToCell(e: PointerEvent): { col: number; row: number } | null {
    const rect = this.gridCanvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;

    const lx = ((e.clientX - rect.left) / rect.width) * LOGICAL_CANVAS_W;
    const ly = ((e.clientY - rect.top) / rect.height) * LOGICAL_CANVAS_H;

    const col = Math.floor((lx - GRID_ORIGIN_X) / CELL_W);
    const row = Math.floor((ly - GRID_ORIGIN_Y) / CELL_H);

    if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) {
      return null;
    }
    return { col, row };
  }

  private bindCanvasEvents(): void {
    this.gridCanvas.addEventListener('pointerdown', (e: PointerEvent) => {
      e.preventDefault();
      const cell = this.mapPointerToCell(e);
      if (!cell) return;

      // Alt+Click quick eyedropper
      if (e.altKey && e.button === 0) {
        const prevTool = this.activeTool;
        this.activeTool = 'pick';
        this.applyCellAction(cell.col, cell.row, false);
        if (this.activeTool === 'pick') {
          this.activeTool = prevTool;
        }
        return;
      }

      // Shift+Click quick row fill
      if (e.shiftKey && e.button === 0) {
        this.playUiTick();
        this.fillSingleRow(cell.row, true);
        this.showToast(`Filled Row ${String(cell.row).padStart(2, '0')}`);
        return;
      }

      this.pushUndoSnapshot();
      this.isDragging = true;
      this.dragEraseMode = e.button === 2 || (e.buttons & 2) !== 0;
      this.lastPaintedCellKey = `${cell.col},${cell.row},${this.dragEraseMode ? 1 : 0}`;
      this.hoverCell = cell;
      this.playUiTick();
      this.applyCellAction(cell.col, cell.row, this.dragEraseMode);
    });

    this.gridCanvas.addEventListener('pointermove', (e: PointerEvent) => {
      const cell = this.mapPointerToCell(e);
      this.hoverCell = cell;

      if (cell) {
        const zone = cell.row >= DANGER_START_ROW ? '⚠ DANGER ZONE (18-21)' : 'BRICK ZONE (0-17)';
        const existing = this.grid[cell.row][cell.col];
        const detail = existing
          ? ` · [${existing.kind.toUpperCase()}${existing.capsule ? ` +${existing.capsule}` : ''}${existing.moving ? ' ◄►' : ''}]`
          : '';
        this.statusCoordsEl.textContent = `Col ${String(cell.col).padStart(2, '0')} · Row ${String(cell.row).padStart(2, '0')} — ${zone}${detail}`;
      } else {
        this.statusCoordsEl.textContent =
          'L-Drag: Paint · R-Drag: Erase · Shift+Click: Row Fill · Alt+Click: Pick';
      }

      if (this.isDragging && cell) {
        const eraseNow = this.dragEraseMode || (e.buttons & 2) !== 0;
        const key = `${cell.col},${cell.row},${eraseNow ? 1 : 0}`;
        if (key !== this.lastPaintedCellKey) {
          this.lastPaintedCellKey = key;
          this.applyCellAction(cell.col, cell.row, eraseNow);
          return;
        }
      }

      this.renderGridCanvas();
    });

    this.gridCanvas.addEventListener('pointerleave', () => {
      this.hoverCell = null;
      this.statusCoordsEl.textContent =
        'L-Drag: Paint · R-Drag: Erase · Shift+Click: Row Fill · Alt+Click: Pick';
      this.renderGridCanvas();
    });
  }

  private finishDrag(): void {
    this.isDragging = false;
    this.lastPaintedCellKey = '';
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (!this.opened) return;
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') {
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) this.redo();
      else this.undo();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      this.redo();
      return;
    }
    if (e.key.toLowerCase() === 'm') {
      this.mirrorX = !this.mirrorX;
      this.syncUiControls();
      this.renderGridCanvas();
      this.showToast(`Mirror X: ${this.mirrorX ? 'ON' : 'OFF'}`);
    }
  }

  // =========================================================================
  // CAMPAIGN PRESETS, LOCAL STORAGE SLOTS & SHARING
  // =========================================================================

  private populateCampaignPresets(): void {
    if (!this.campaignSelect) return;
    this.campaignSelect.innerHTML = '';

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = `— Select Campaign Stage (1..${CAMPAIGN_STAGES.length || 64}) —`;
    this.campaignSelect.appendChild(placeholder);

    CAMPAIGN_STAGES.forEach((st: StageDefinition, idx: number) => {
      const opt = document.createElement('option');
      opt.value = String(idx);
      const num = String(st.id ?? idx + 1).padStart(2, '0');
      opt.textContent = `#${num} [R${st.round} · ${st.branchLabel}] ${st.name}`;
      this.campaignSelect.appendChild(opt);
    });
  }

  private loadSelectedCampaignPreset(): void {
    const rawIdx = this.campaignSelect.value;
    if (rawIdx === '') {
      this.showToast('Pick a Campaign Stage (1..64) first', true);
      return;
    }
    const preset = CAMPAIGN_STAGES[Number(rawIdx)];
    if (!preset) return;

    const remixed = cloneStage(preset);
    remixed.id = 1000 + preset.id;
    remixed.branchLabel = preset.branchLabel || 'REMIX';
    this.applyStageToState(remixed, true);
    this.playUiTick();
    this.showToast(`Loaded Preset #${preset.id}: ${preset.name}`);
  }

  private readSavedCustomStages(): StageDefinition[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.CUSTOM_STAGES);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];

      const valid: StageDefinition[] = [];
      for (const entry of parsed) {
        if (!entry || typeof entry !== 'object') continue;
        const candidate =
          'stage' in entry && entry.stage && typeof entry.stage === 'object'
            ? (entry.stage as StageDefinition)
            : (entry as StageDefinition);
        if (typeof candidate.name === 'string' && Array.isArray(candidate.bricks)) {
          valid.push(cloneStage(candidate));
        }
      }
      return valid;
    } catch {
      return [];
    }
  }

  private writeSavedCustomStages(stages: StageDefinition[]): boolean {
    try {
      localStorage.setItem(STORAGE_KEYS.CUSTOM_STAGES, JSON.stringify(stages));
      return true;
    } catch {
      this.showToast('Storage Full / Blocked', true);
      return false;
    }
  }

  private saveCurrentToLocalSlot(): void {
    const current = this.getCurrentStage();
    const list = this.readSavedCustomStages();
    const matchIdx = list.findIndex(
      (s) => s.name.trim().toLowerCase() === current.name.trim().toLowerCase()
    );

    if (matchIdx >= 0) {
      current.id = list[matchIdx].id >= 1000 ? list[matchIdx].id : 1001 + matchIdx;
      this.meta.id = current.id;
      list[matchIdx] = current;
    } else {
      const maxId = list.reduce((acc, s) => Math.max(acc, s.id || 1000), 1000);
      current.id = maxId + 1;
      this.meta.id = current.id;
      list.unshift(current);
    }

    if (this.writeSavedCustomStages(list)) {
      this.playUiTick();
      this.renderCustomSlots();
      this.showToast(`Saved "${current.name}"!`);
    }
  }

  private renderCustomSlots(): void {
    if (!this.slotListEl) return;
    this.slotListEl.innerHTML = '';

    const slots = this.readSavedCustomStages();
    if (slots.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'cs-slot-empty';
      empty.textContent = 'No local custom stages saved yet.';
      this.slotListEl.appendChild(empty);
      return;
    }

    for (const slot of slots) {
      const row = document.createElement('div');
      row.className = 'cs-slot-item';

      const nameSpan = document.createElement('span');
      nameSpan.className = 'cs-slot-name';
      nameSpan.textContent = `${slot.name} (${slot.bricks.length})`;
      nameSpan.title = `${slot.name} — ${slot.subtitle} (${slot.bricks.length} bricks)`;

      const loadBtn = document.createElement('button');
      loadBtn.type = 'button';
      loadBtn.className = 'cs-mini-btn';
      loadBtn.textContent = 'LOAD';
      loadBtn.addEventListener('click', () => {
        this.applyStageToState(cloneStage(slot), true);
        this.playUiTick();
        this.showToast(`Loaded "${slot.name}"`);
      });

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'cs-mini-btn';
      delBtn.style.color = '#ff7b93';
      delBtn.textContent = '✕';
      delBtn.title = `Delete "${slot.name}"`;
      delBtn.addEventListener('click', () => {
        const filtered = this.readSavedCustomStages().filter(
          (s) => !(s.id === slot.id && s.name === slot.name)
        );
        this.writeSavedCustomStages(filtered);
        this.playUiTick();
        this.renderCustomSlots();
        this.showToast(`Deleted "${slot.name}"`);
      });

      row.append(nameSpan, loadBtn, delBtn);
      this.slotListEl.appendChild(row);
    }
  }

  private handleExportJson(): void {
    const stage = this.getCurrentStage();
    const jsonStr = exportStageJson(stage);
    const slug = stage.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'custom-stage';

    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `arkanoid2-${slug}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    this.playUiTick();
    this.showToast('Stage .JSON Exported!');
  }

  private async handleImportJsonFile(): Promise<void> {
    const file = this.fileInputEl.files?.[0];
    this.fileInputEl.value = '';
    if (!file) return;

    try {
      const text = await file.text();
      const imported = importStageJson(text);
      if (!imported) {
        this.showToast('Invalid Stage JSON File', true);
        return;
      }
      this.applyStageToState(imported, true);
      this.playUiTick();
      this.showToast(`Imported "${imported.name}"!`);
    } catch {
      this.showToast('Failed to read JSON file', true);
    }
  }

  private async handleCopyShareUrl(): Promise<void> {
    const stage = this.getCurrentStage();
    const encoded = encodeStageToUrlParam(stage);
    const shareUrl = `${window.location.origin}${window.location.pathname}?level=${encoded}`;

    try {
      window.history.replaceState(null, '', `?level=${encoded}`);
    } catch {
      // Ignore history security errors in sandboxed iframes
    }

    let copied = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        copied = true;
      }
    } catch {
      copied = false;
    }

    if (!copied) {
      try {
        const ta = document.createElement('textarea');
        ta.value = shareUrl;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        copied = true;
      } catch {
        copied = false;
      }
    }

    this.playUiTick();
    this.showToast(copied ? 'Share URL Copied!' : 'URL Updated in Address Bar!');
  }

  private handleLoadFromWindowUrl(): void {
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get('level');
    if (!encoded) {
      this.showToast('No ?level= parameter in URL', true);
      return;
    }
    const decoded = decodeStageFromUrlParam(encoded);
    if (!decoded) {
      this.showToast('Invalid ?level= data', true);
      return;
    }
    this.applyStageToState(decoded, true);
    this.playUiTick();
    this.showToast(`Decoded "${decoded.name}"!`);
  }

  // =========================================================================
  // INTERACTIVE 13 × 22 GRID CANVAS RENDERING
  // =========================================================================

  private renderGridCanvas(): void {
    const ctx = this.gridCtx;
    if (!ctx) return;

    ctx.save();
    ctx.scale(2, 2); // 2x HiDPI scaling

    const themeVisual =
      THEME_OPTIONS.find((t) => t.value === this.meta.theme) ?? THEME_OPTIONS[0];

    // Outer frame background
    ctx.fillStyle = '#050914';
    ctx.fillRect(0, 0, LOGICAL_CANVAS_W, LOGICAL_CANVAS_H);

    // Playfield interior themed gradient
    const bgGrad = ctx.createLinearGradient(
      0,
      GRID_ORIGIN_Y,
      0,
      GRID_ORIGIN_Y + GRID_PIXEL_H
    );
    bgGrad.addColorStop(0, themeVisual.bgTop);
    bgGrad.addColorStop(1, themeVisual.bgBottom);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(GRID_ORIGIN_X, GRID_ORIGIN_Y, GRID_PIXEL_W, GRID_PIXEL_H);

    // Highlight Recommended Brick Zone (rows 0..17) vs Lower Danger Zone (rows 18..21)
    const dangerY = GRID_ORIGIN_Y + DANGER_START_ROW * CELL_H;
    const dangerH = (GRID_ROWS - DANGER_START_ROW) * CELL_H;

    ctx.fillStyle = 'rgba(24, 224, 255, 0.025)';
    ctx.fillRect(GRID_ORIGIN_X, GRID_ORIGIN_Y, GRID_PIXEL_W, DANGER_START_ROW * CELL_H);

    const dangerGrad = ctx.createLinearGradient(0, dangerY, 0, dangerY + dangerH);
    dangerGrad.addColorStop(0, 'rgba(255, 48, 84, 0.14)');
    dangerGrad.addColorStop(1, 'rgba(255, 30, 60, 0.25)');
    ctx.fillStyle = dangerGrad;
    ctx.fillRect(GRID_ORIGIN_X, dangerY, GRID_PIXEL_W, dangerH);

    // Subtle diagonal hazard stripes in Danger Zone (18..21)
    ctx.save();
    ctx.beginPath();
    ctx.rect(GRID_ORIGIN_X, dangerY, GRID_PIXEL_W, dangerH);
    ctx.clip();
    ctx.strokeStyle = 'rgba(255, 72, 104, 0.09)';
    ctx.lineWidth = 6;
    for (let sx = -dangerH; sx < GRID_PIXEL_W + dangerH; sx += 20) {
      ctx.beginPath();
      ctx.moveTo(GRID_ORIGIN_X + sx, dangerY);
      ctx.lineTo(GRID_ORIGIN_X + sx - dangerH, dangerY + dangerH);
      ctx.stroke();
    }
    ctx.restore();

    // Grid Lines
    ctx.lineWidth = 1;
    for (let c = 0; c <= GRID_COLS; c++) {
      const x = GRID_ORIGIN_X + c * CELL_W + 0.5;
      ctx.strokeStyle = 'rgba(110, 175, 255, 0.13)';
      ctx.beginPath();
      ctx.moveTo(x, GRID_ORIGIN_Y);
      ctx.lineTo(x, GRID_ORIGIN_Y + GRID_PIXEL_H);
      ctx.stroke();
    }

    for (let r = 0; r <= GRID_ROWS; r++) {
      const y = GRID_ORIGIN_Y + r * CELL_H + 0.5;
      ctx.strokeStyle =
        r >= DANGER_START_ROW ? 'rgba(255, 92, 120, 0.2)' : 'rgba(110, 175, 255, 0.13)';
      ctx.beginPath();
      ctx.moveTo(GRID_ORIGIN_X, y);
      ctx.lineTo(GRID_ORIGIN_X + GRID_PIXEL_W, y);
      ctx.stroke();
    }

    // Column Headers (0..12) + Top Enemy Spawn Hatches (Cols 3 & 9)
    ctx.font = 'bold 9px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let c = 0; c < GRID_COLS; c++) {
      const cx = GRID_ORIGIN_X + c * CELL_W + CELL_W / 2;
      const isHatch = c === 3 || c === 9;
      if (isHatch) {
        ctx.fillStyle = 'rgba(255, 196, 36, 0.2)';
        ctx.fillRect(GRID_ORIGIN_X + c * CELL_W + 2, 3, CELL_W - 4, 17);
        ctx.strokeStyle = '#ffbe2e';
        ctx.strokeRect(GRID_ORIGIN_X + c * CELL_W + 2, 3, CELL_W - 4, 17);
      }
      ctx.fillStyle = c === 6 && this.mirrorX ? '#18e0ff' : isHatch ? '#ffd86b' : '#7f9bc4';
      ctx.fillText(String(c), cx, 12);
    }

    // Row Numbers (00..21)
    for (let r = 0; r < GRID_ROWS; r++) {
      const ry = GRID_ORIGIN_Y + r * CELL_H + CELL_H / 2;
      const isDanger = r >= DANGER_START_ROW;
      ctx.fillStyle = isDanger ? '#ff6b86' : '#7896bf';
      ctx.fillText(String(r).padStart(2, '0'), 14, ry);
    }

    // Mirror X Symmetry Centerline across Column 6
    if (this.mirrorX) {
      const midX = GRID_ORIGIN_X + 6.5 * CELL_W;
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(24, 224, 255, 0.55)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(midX, GRID_ORIGIN_Y);
      ctx.lineTo(midX, GRID_ORIGIN_Y + GRID_PIXEL_H);
      ctx.stroke();
      ctx.restore();
    }

    // Danger Zone Divider Line & Label at Row 18
    ctx.save();
    ctx.setLineDash([5, 3]);
    ctx.strokeStyle = '#ff4769';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(GRID_ORIGIN_X, dangerY);
    ctx.lineTo(GRID_ORIGIN_X + GRID_PIXEL_W, dangerY);
    ctx.stroke();
    ctx.restore();

    ctx.font = 'bold 8.5px "Courier New", monospace';
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(126, 244, 255, 0.55)';
    ctx.fillText('▲ RECOMMENDED BRICK ZONE (00..17)', GRID_ORIGIN_X + GRID_PIXEL_W - 6, dangerY - 7);
    ctx.fillStyle = 'rgba(255, 120, 145, 0.85)';
    ctx.fillText('▼ LOWER DANGER ZONE (18..21)', GRID_ORIGIN_X + GRID_PIXEL_W - 6, dangerY + 9);

    // Optional Boss Encounter Watermark Indicator
    if (this.meta.boss) {
      ctx.save();
      const bx = GRID_ORIGIN_X + GRID_PIXEL_W / 2;
      const by = GRID_ORIGIN_Y + 6 * CELL_H;
      ctx.strokeStyle = 'rgba(242, 60, 255, 0.45)';
      ctx.fillStyle = 'rgba(242, 60, 255, 0.08)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(bx - 88, by - 36, 176, 72, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(250, 166, 255, 0.78)';
      ctx.font = 'bold 11px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`⚠ BOSS: ${this.meta.boss.toUpperCase()}`, bx, by - 6);
      ctx.font = '9px "Courier New", monospace';
      ctx.fillText('ARENA SPAWN ZONE', bx, by + 10);
      ctx.restore();
    }

    // Pass 1: Draw Moving Brick Rails (underneath bricks so tracks are always clear)
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const b = this.grid[r][c];
        if (!b?.moving) continue;
        this.drawMovingRail(ctx, r, b.moving, false);
      }
    }

    // Pass 2: Draw Placed Bricks + Moving Arrows + Capsule Badges + HP Overrides
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const b = this.grid[r][c];
        if (!b) continue;
        this.drawBrickCell(ctx, b, 1.0);
      }
    }

    // Pass 3: Hover Ghost Brush Preview (including Mirror X & Row Fill preview)
    if (this.hoverCell) {
      const { col, row } = this.hoverCell;
      if (this.activeTool === 'erase' || this.dragEraseMode) {
        this.drawEraseCursor(ctx, col, row);
        if (this.mirrorX) {
          this.drawEraseCursor(ctx, GRID_COLS - 1 - col, row);
        }
      } else if (this.activeTool === 'pick') {
        ctx.strokeStyle = '#ffe024';
        ctx.lineWidth = 2;
        ctx.strokeRect(
          GRID_ORIGIN_X + col * CELL_W + 1,
          GRID_ORIGIN_Y + row * CELL_H + 1,
          CELL_W - 2,
          CELL_H - 2
        );
      } else if (this.activeTool === 'row_fill') {
        for (let cc = 0; cc < GRID_COLS; cc++) {
          const ghost = this.createBrickForCell(cc, row, this.mirrorX && cc > 6);
          this.drawBrickCell(ctx, ghost, 0.42);
        }
      } else {
        const ghost = this.createBrickForCell(col, row, false);
        if (ghost.moving) {
          this.drawMovingRail(ctx, row, ghost.moving, true);
        }
        this.drawBrickCell(ctx, ghost, 0.5);

        const mirrorCol = GRID_COLS - 1 - col;
        if (this.mirrorX && mirrorCol !== col) {
          const mirGhost = this.createBrickForCell(mirrorCol, row, true);
          if (mirGhost.moving) {
            this.drawMovingRail(ctx, row, mirGhost.moving, true);
          }
          this.drawBrickCell(ctx, mirGhost, 0.42);
        }
      }
    }

    // Playfield Outer Bezel Border
    ctx.strokeStyle = themeVisual.accent;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(GRID_ORIGIN_X, GRID_ORIGIN_Y, GRID_PIXEL_W, GRID_PIXEL_H);

    // Bottom Reference Strip: Vaus II Interceptor Silhouette + Warp Exits
    const footerY = GRID_ORIGIN_Y + GRID_PIXEL_H + 16;
    const vausW = 76;
    const vausH = 11;
    const vausX = GRID_ORIGIN_X + GRID_PIXEL_W / 2 - vausW / 2;

    // Left & Right Warp Gate indicators
    ctx.fillStyle = 'rgba(223, 56, 255, 0.35)';
    ctx.fillRect(GRID_ORIGIN_X, footerY - 8, 8, 16);
    ctx.fillRect(GRID_ORIGIN_X + GRID_PIXEL_W - 8, footerY - 8, 8, 16);

    // Vaus II hull
    const vGrad = ctx.createLinearGradient(vausX, footerY - 5, vausX, footerY + 6);
    vGrad.addColorStop(0, '#eef6ff');
    vGrad.addColorStop(0.5, '#8fa6c9');
    vGrad.addColorStop(1, '#394b68');
    ctx.fillStyle = vGrad;
    ctx.beginPath();
    ctx.roundRect(vausX, footerY - vausH / 2, vausW, vausH, 5);
    ctx.fill();
    ctx.fillStyle = '#ff3355';
    ctx.fillRect(vausX + 3, footerY - 4, 8, 8);
    ctx.fillRect(vausX + vausW - 11, footerY - 4, 8, 8);

    ctx.font = 'bold 8.5px "Courier New", monospace';
    ctx.fillStyle = '#6f8db8';
    ctx.textAlign = 'left';
    ctx.fillText(`SECTOR: ${(this.meta.name || 'UNTITLED').toUpperCase()}`, GRID_ORIGIN_X + 12, footerY + 1);
    ctx.textAlign = 'right';
    ctx.fillText(`ENEMY: ${this.meta.enemyKind.toUpperCase()}`, GRID_ORIGIN_X + GRID_PIXEL_W - 12, footerY + 1);

    ctx.restore();
  }

  private drawMovingRail(
    ctx: CanvasRenderingContext2D,
    row: number,
    moving: MovingSpec,
    isGhost: boolean
  ): void {
    const lo = Math.max(0, Math.min(GRID_COLS - 1, Math.min(moving.minCol, moving.maxCol)));
    const hi = Math.max(0, Math.min(GRID_COLS - 1, Math.max(moving.minCol, moving.maxCol)));

    const x1 = GRID_ORIGIN_X + lo * CELL_W + 4;
    const x2 = GRID_ORIGIN_X + (hi + 1) * CELL_W - 4;
    const cy = GRID_ORIGIN_Y + row * CELL_H + CELL_H / 2;

    ctx.save();
    ctx.globalAlpha = isGhost ? 0.5 : 0.85;
    ctx.strokeStyle = '#38f8ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x1, cy);
    ctx.lineTo(x2, cy);
    ctx.stroke();

    // End-cap rail stops
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x1, cy - 5);
    ctx.lineTo(x1, cy + 5);
    ctx.moveTo(x2, cy - 5);
    ctx.lineTo(x2, cy + 5);
    ctx.stroke();
    ctx.restore();
  }

  private drawEraseCursor(ctx: CanvasRenderingContext2D, col: number, row: number): void {
    const x = GRID_ORIGIN_X + col * CELL_W + 1;
    const y = GRID_ORIGIN_Y + row * CELL_H + 1;
    const w = CELL_W - 2;
    const h = CELL_H - 2;

    ctx.save();
    ctx.fillStyle = 'rgba(255, 45, 85, 0.28)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#ff3b63';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, w, h);
    ctx.beginPath();
    ctx.moveTo(x + 4, y + 4);
    ctx.lineTo(x + w - 4, y + h - 4);
    ctx.moveTo(x + w - 4, y + 4);
    ctx.lineTo(x + 4, y + h - 4);
    ctx.stroke();
    ctx.restore();
  }

  private drawBrickCell(
    ctx: CanvasRenderingContext2D,
    brick: BrickBlueprint,
    alpha: number
  ): void {
    const x = GRID_ORIGIN_X + brick.col * CELL_W + 1;
    const y = GRID_ORIGIN_Y + brick.row * CELL_H + 1;
    const w = CELL_W - 2;
    const h = CELL_H - 2;
    const palette = BRICK_COLORS[brick.kind];

    ctx.save();
    ctx.globalAlpha = alpha;

    // Base fill
    ctx.fillStyle = palette.fill;
    ctx.fillRect(x, y, w, h);

    // Classic Taito 3D Arcade Bevel (top/left highlight, bottom/right shadow)
    ctx.fillStyle = palette.light;
    ctx.fillRect(x, y, w, 2.2);
    ctx.fillRect(x, y, 2.2, h);

    ctx.fillStyle = palette.dark;
    ctx.fillRect(x, y + h - 2.4, w, 2.4);
    ctx.fillRect(x + w - 2.4, y, 2.4, h);

    // Metallic diagonal sheen for silver / regen / gold
    if (brick.kind === 'silver' || brick.kind === 'regen' || brick.kind === 'gold') {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.32)';
      ctx.beginPath();
      ctx.moveTo(x + 5, y + 2);
      ctx.lineTo(x + 12, y + 2);
      ctx.lineTo(x + 6, y + h - 2);
      ctx.lineTo(x + 1, y + h - 2);
      ctx.closePath();
      ctx.fill();
    }

    // Subtle center symbol watermark
    ctx.font = 'bold 9px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.34)';
    ctx.fillText(palette.symbol, x + w / 2, y + h / 2 + 0.5);

    // Moving Brick Directional Arrow Badge
    if (brick.moving) {
      const arrow = brick.moving.dir === 1 ? '►' : '◄';
      ctx.fillStyle = 'rgba(4, 14, 28, 0.86)';
      ctx.fillRect(x + 2, y + h - 9, 12, 7.5);
      ctx.strokeStyle = '#38f8ff';
      ctx.lineWidth = 0.8;
      ctx.strokeRect(x + 2, y + h - 9, 12, 7.5);
      ctx.font = 'bold 7.5px "Courier New", monospace';
      ctx.fillStyle = '#62faff';
      ctx.fillText(arrow, x + 8, y + h - 5);
    }

    // Custom Hit Points Override Badge (1..6)
    if (brick.hits !== undefined) {
      ctx.fillStyle = 'rgba(8, 12, 24, 0.88)';
      ctx.fillRect(x + 2, y + 1.5, 13, 7.5);
      ctx.font = 'bold 7px "Courier New", monospace';
      ctx.fillStyle = '#ffe46b';
      ctx.fillText(`×${brick.hits}`, x + 8.5, y + 5.5);
    }

    // Guaranteed Capsule Drop Letter Pill Badge
    if (brick.capsule) {
      const capMeta = CAPSULE_META[brick.capsule];
      const pw = 13;
      const ph = 11;
      const px = x + w - pw - 2;
      const py = y + (h - ph) / 2;

      ctx.fillStyle = capMeta.color;
      ctx.beginPath();
      ctx.roundRect(px, py, pw, ph, 3);
      ctx.fill();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 0.9;
      ctx.stroke();

      ctx.font = 'bold 8.5px "Courier New", monospace';
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
      ctx.shadowBlur = 2;
      ctx.fillText(brick.capsule, px + pw / 2, py + ph / 2 + 0.5);
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }
}
