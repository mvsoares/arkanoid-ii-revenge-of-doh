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
import { GRID_COLS, GRID_ROWS } from '../constants';

const VALID_BRICK_KINDS = new Set<BrickKind>([
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
]);

const VALID_CAPSULES = new Set<CapsuleType>([
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
]);

const VALID_THEMES = new Set<SectorTheme>([
  'hull_breach',
  'cryo_vault',
  'reactor_core',
  'bio_nexus',
  'gold_citadel',
  'doh_sanctum',
]);

const VALID_ENEMIES = new Set<EnemyKind>([
  'pyramid',
  'trisphere',
  'splitter',
  'builder',
  'gold_critter',
]);

const VALID_BOSSES = new Set<BossKind>(['suirei', 'sentinel', 'doh']);

function utf8ToBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToUtf8(encoded: string): string | null {
  try {
    let b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4 !== 0) {
      b64 += '=';
    }
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

function sanitizeMoving(raw: unknown): MovingSpec | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const m = raw as Record<string, unknown>;
  const minCol = Number(m.minCol);
  const maxCol = Number(m.maxCol);
  const speed = Number(m.speed);
  const dir = m.dir === -1 ? -1 : 1;
  if (
    !Number.isInteger(minCol) ||
    !Number.isInteger(maxCol) ||
    minCol < 0 ||
    maxCol >= GRID_COLS ||
    minCol > maxCol ||
    !Number.isFinite(speed) ||
    speed <= 0 ||
    speed > 12
  ) {
    return undefined;
  }
  return { minCol, maxCol, speed, dir };
}

function validateStageObject(raw: unknown): StageDefinition | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;

  if (typeof obj.name !== 'string' || !Array.isArray(obj.bricks)) {
    return null;
  }

  const bricks: BrickBlueprint[] = [];
  for (const item of obj.bricks) {
    if (!item || typeof item !== 'object') return null;
    const b = item as Record<string, unknown>;
    const col = Number(b.col);
    const row = Number(b.row);
    const kind = b.kind as BrickKind;

    if (
      !Number.isInteger(col) ||
      !Number.isInteger(row) ||
      col < 0 ||
      col >= GRID_COLS ||
      row < 0 ||
      row >= GRID_ROWS ||
      !VALID_BRICK_KINDS.has(kind)
    ) {
      return null;
    }

    const bp: BrickBlueprint = { col, row, kind };
    if (b.hits !== undefined) {
      const hits = Number(b.hits);
      if (!Number.isInteger(hits) || hits < 1 || hits > 20) return null;
      bp.hits = hits;
    }
    if (b.capsule !== undefined) {
      if (typeof b.capsule !== 'string' || !VALID_CAPSULES.has(b.capsule as CapsuleType)) {
        return null;
      }
      bp.capsule = b.capsule as CapsuleType;
    }
    if (b.moving !== undefined) {
      const mv = sanitizeMoving(b.moving);
      if (!mv) return null;
      bp.moving = mv;
    }
    bricks.push(bp);
  }

  const theme = VALID_THEMES.has(obj.theme as SectorTheme)
    ? (obj.theme as SectorTheme)
    : 'hull_breach';
  const enemyKind = VALID_ENEMIES.has(obj.enemyKind as EnemyKind)
    ? (obj.enemyKind as EnemyKind)
    : 'pyramid';
  const boss = VALID_BOSSES.has(obj.boss as BossKind) ? (obj.boss as BossKind) : undefined;

  const rawId = Number(obj.id);
  const rawRound = Number(obj.round);
  const dropRate = Number(obj.capsuleDropRate);

  let capsuleWeights: Partial<Record<CapsuleType, number>> | undefined;
  if (obj.capsuleWeights && typeof obj.capsuleWeights === 'object') {
    const weights: Partial<Record<CapsuleType, number>> = {};
    for (const [k, v] of Object.entries(obj.capsuleWeights as Record<string, unknown>)) {
      const num = Number(v);
      if (VALID_CAPSULES.has(k as CapsuleType) && Number.isFinite(num) && num >= 0) {
        weights[k as CapsuleType] = num;
      }
    }
    if (Object.keys(weights).length > 0) {
      capsuleWeights = weights;
    }
  }

  return {
    id: Number.isFinite(rawId) ? rawId : 1000,
    round: Number.isFinite(rawRound) && rawRound >= 1 ? Math.round(rawRound) : 1,
    branchLabel:
      typeof obj.branchLabel === 'string' && obj.branchLabel.trim().length > 0
        ? obj.branchLabel.trim().slice(0, 12)
        : 'CUSTOM',
    name: obj.name.trim().slice(0, 48) || 'CUSTOM SECTOR',
    subtitle:
      typeof obj.subtitle === 'string' ? obj.subtitle.trim().slice(0, 64) : 'CUSTOM STAGE',
    theme,
    enemyKind,
    boss,
    bricks,
    capsuleDropRate:
      Number.isFinite(dropRate) && dropRate >= 0 && dropRate <= 1 ? dropRate : 0.24,
    capsuleWeights,
  };
}

export function encodeStageToUrlParam(stage: StageDefinition): string {
  const compact: Record<string, unknown> = {
    v: 1,
    id: stage.id,
    round: stage.round,
    branchLabel: stage.branchLabel,
    name: stage.name,
    subtitle: stage.subtitle,
    theme: stage.theme,
    enemyKind: stage.enemyKind,
    bricks: stage.bricks.map((b) => {
      const out: Record<string, unknown> = { col: b.col, row: b.row, kind: b.kind };
      if (b.hits !== undefined) out.hits = b.hits;
      if (b.moving !== undefined) out.moving = b.moving;
      if (b.capsule !== undefined) out.capsule = b.capsule;
      return out;
    }),
  };
  if (stage.boss) compact.boss = stage.boss;
  if (stage.capsuleDropRate !== undefined) compact.capsuleDropRate = stage.capsuleDropRate;
  if (stage.capsuleWeights) compact.capsuleWeights = stage.capsuleWeights;
  return utf8ToBase64Url(JSON.stringify(compact));
}

export function decodeStageFromUrlParam(encoded: string): StageDefinition | null {
  if (!encoded || encoded.length > 65536) return null;
  const jsonStr = base64UrlToUtf8(encoded.trim());
  if (!jsonStr) return null;
  try {
    const parsed = JSON.parse(jsonStr);
    return validateStageObject(parsed);
  } catch {
    return null;
  }
}

export function exportStageJson(stage: StageDefinition): string {
  return JSON.stringify(stage, null, 2);
}

export function importStageJson(jsonStr: string): StageDefinition | null {
  if (!jsonStr || jsonStr.length > 262144) return null;
  try {
    const parsed = JSON.parse(jsonStr);
    return validateStageObject(parsed);
  } catch {
    return null;
  }
}
