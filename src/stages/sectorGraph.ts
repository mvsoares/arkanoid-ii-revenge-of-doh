import type {
  BossKind,
  BrickBlueprint,
  BrickKind,
  EnemyKind,
  RogueliteAugment,
  SectorTheme,
  StageDefinition,
} from '../types';
import { CAMPAIGN_STAGES } from './stageCatalog';

export interface SectorNode {
  id: number;
  round: number;
  branchLabel: string;
  name: string;
  leftNextId: number | null;
  rightNextId: number | null;
  mapX: number; // normalized 0..1 for XORG sector map rendering
  mapY: number; // normalized 0..1
  boss?: BossKind;
}

function computeNextIds(stage: StageDefinition): {
  leftNextId: number | null;
  rightNextId: number | null;
} {
  const r = stage.round;
  if (r === 1) {
    return { leftNextId: 2, rightNextId: 3 };
  }
  if (r >= 2 && r <= 15) {
    const nextL = 2 + (r + 1 - 2) * 2;
    return { leftNextId: nextL, rightNextId: nextL + 1 };
  }
  if (r === 16) {
    return { leftNextId: 32, rightNextId: 33 };
  }
  if (r === 17) {
    return { leftNextId: 34, rightNextId: 34 };
  }
  if (r === 18) {
    return { leftNextId: 35, rightNextId: 36 };
  }
  if (r >= 19 && r <= 31) {
    const nextL = 35 + (r + 1 - 19) * 2;
    return { leftNextId: nextL, rightNextId: nextL + 1 };
  }
  if (r === 32) {
    return { leftNextId: 63, rightNextId: 63 };
  }
  if (r === 33) {
    return { leftNextId: 64, rightNextId: 64 };
  }
  return { leftNextId: null, rightNextId: null };
}

function computeMapY(stage: StageDefinition): number {
  const lbl = stage.branchLabel;
  if (lbl.endsWith('L')) {
    return stage.round % 2 === 0 ? 0.24 : 0.31;
  }
  if (lbl.endsWith('R')) {
    return stage.round % 2 === 0 ? 0.76 : 0.69;
  }
  return 0.5;
}

export const SECTOR_NODES: Map<number, SectorNode> = new Map(
  CAMPAIGN_STAGES.map((stage) => {
    const { leftNextId, rightNextId } = computeNextIds(stage);
    const node: SectorNode = {
      id: stage.id,
      round: stage.round,
      branchLabel: stage.branchLabel,
      name: stage.name,
      leftNextId,
      rightNextId,
      mapX: (stage.round - 1) / 33,
      mapY: computeMapY(stage),
      boss: stage.boss,
    };
    return [stage.id, node];
  })
);

export function getStageById(id: number): StageDefinition {
  const found = CAMPAIGN_STAGES.find((s) => s.id === id);
  return found ?? CAMPAIGN_STAGES[0];
}

export function getNextStageId(currentId: number, gate: 'left' | 'right'): number | null {
  const node = SECTOR_NODES.get(currentId);
  if (!node) return null;
  return gate === 'left' ? node.leftNextId : node.rightNextId;
}

export const ROGUELITE_AUGMENTS: RogueliteAugment[] = [
  {
    id: 'wide_chassis',
    name: 'TITAN CHASSIS',
    icon: 'E+',
    color: '#2d7bff',
    desc: 'Permanently begin every floor with Enlarge Level 1.',
  },
  {
    id: 'twin_link',
    name: 'DUAL LINK CORE',
    icon: 'T+',
    color: '#14d8f5',
    desc: 'Permanently deploy a Twin Vaus companion hull.',
  },
  {
    id: 'plasma_cannons',
    name: 'TWIN BLASTERS',
    icon: 'L+',
    color: '#ff3655',
    desc: 'Start each floor armed with Vaus Laser Cannons.',
  },
  {
    id: 'pierce_rounds',
    name: 'CRIT-STRIKE ORB',
    icon: 'CR',
    color: '#ffbe24',
    desc: 'Balls deal double damage to Silver, Regen & Bosses.',
  },
  {
    id: 'gravity_well',
    name: 'GRAVITY BENDER',
    icon: 'GV',
    color: '#38ffb0',
    desc: 'Stronger Magnetic Curve pull & 45% lower energy drain.',
  },
  {
    id: 'safety_barrier',
    name: 'AEGIS FLOOR',
    icon: 'SH',
    color: '#6ce8ff',
    desc: 'Begin every floor with a 2-hit pit energy barrier.',
  },
  {
    id: 'combo_accelerator',
    name: 'COMBO OVERCLOCK',
    icon: 'X+',
    color: '#ff66ee',
    desc: 'Ricochet Combo multiplier builds 67% faster per hit.',
  },
  {
    id: 'capsule_magnet',
    name: 'TRACTOR BEAM',
    icon: 'MG',
    color: '#a3ff5c',
    desc: 'Automatically attracts safe falling capsules toward Vaus.',
  },
  {
    id: 'emp_capacitor',
    name: 'RAPID REPULSOR',
    icon: 'EM',
    color: '#a86bff',
    desc: 'Cuts EMP Repulsor Wave cooldown nearly in half (5.5s).',
  },
  {
    id: 'lucky_jackpot',
    name: 'JACKPOT MATRIX',
    icon: '?+',
    color: '#ffd93d',
    desc: 'Higher chance of Mystery (?) and Gold (G) capsules.',
  },
  {
    id: 'kinetic_boost',
    name: 'HYPER THRUSTERS',
    icon: 'V+',
    color: '#ff9640',
    desc: 'Increases base ball velocity & kinetic impact power.',
  },
  {
    id: 'mercy_aegis',
    name: 'PHOENIX SHIELD',
    icon: 'PX',
    color: '#e8f4ff',
    desc: 'Extends post-hit Mercy Invulnerability shield to 6.0s.',
  },
];

function createRng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function generateProceduralStage(floor: number, seed?: number): StageDefinition {
  const actualSeed = seed ?? Math.floor(floor * 7919 + Date.now() % 100000);
  const rand = createRng(actualSeed);

  const themes: SectorTheme[] = [
    'hull_breach',
    'cryo_vault',
    'reactor_core',
    'bio_nexus',
    'gold_citadel',
    'doh_sanctum',
  ];
  const enemies: EnemyKind[] = ['pyramid', 'trisphere', 'splitter', 'builder'];
  const theme = themes[(floor - 1) % themes.length];
  const enemyKind = enemies[Math.min(enemies.length - 1, Math.floor((floor - 1) / 3))];

  // Every 5th floor spawns a Boss encounter!
  if (floor % 5 === 0) {
    const bossCycle: BossKind[] = ['suirei', 'sentinel', 'doh'];
    const boss = bossCycle[(Math.floor(floor / 5) - 1) % bossCycle.length];
    return {
      id: 1000 + floor,
      round: floor,
      branchLabel: `B-${floor}`,
      name:
        boss === 'suirei'
          ? 'ABERRANT SUIREI'
          : boss === 'sentinel'
            ? 'OMEGA SENTINEL'
            : 'ECHO OF DOH',
      subtitle: `BREACH FLOOR ${floor} — BOSS ANOMALY`,
      theme: boss === 'doh' ? 'doh_sanctum' : theme,
      enemyKind,
      boss,
      bricks: [
        { col: 0, row: 14, kind: 'regen', capsule: 'L' },
        { col: 12, row: 14, kind: 'regen', capsule: 'E' },
      ],
      capsuleDropRate: 0.3,
    };
  }

  const palette: BrickKind[] = ['white', 'orange', 'cyan', 'green', 'red', 'blue', 'magenta', 'yellow'];
  const bricks: BrickBlueprint[] = [];
  const rows = Math.min(11, 6 + Math.floor(floor / 2));

  for (let r = 2; r < 2 + rows; r++) {
    const rowKind = palette[(r + floor) % palette.length];
    for (let c = 0; c <= 6; c++) {
      const roll = rand();
      // Symmetric mirrored layout with guaranteed open corridors
      if (roll < 0.24) continue;
      let kind: BrickKind = rowKind;
      if (roll > 0.88 && floor >= 2) {
        kind = 'silver';
      } else if (roll > 0.82 && floor >= 3) {
        kind = 'regen';
      } else if (roll > 0.78 && r > 2 && c > 0 && c < 6 && floor >= 4) {
        kind = 'gold';
      }

      const bpL: BrickBlueprint = { col: c, row: r, kind };
      if (kind !== 'gold' && roll > 0.73 && roll <= 0.78 && c <= 4) {
        bpL.moving = {
          minCol: Math.max(0, c - 1),
          maxCol: Math.min(5, c + 1),
          speed: 1.5 + Math.min(1.5, floor * 0.1),
          dir: 1,
        };
      }
      bricks.push(bpL);

      if (c < 6) {
        const mc = 12 - c;
        const bpR: BrickBlueprint = { col: mc, row: r, kind };
        if (bpL.moving) {
          bpR.moving = {
            minCol: Math.max(7, mc - 1),
            maxCol: Math.min(12, mc + 1),
            speed: bpL.moving.speed,
            dir: -1,
          };
        }
        bricks.push(bpR);
      }
    }
  }

  // Ensure at least a handful of destructible bricks exist
  if (!bricks.some((b) => b.kind !== 'gold' && b.kind !== 'regen')) {
    for (let c = 2; c <= 10; c++) {
      bricks.push({ col: c, row: 4, kind: 'cyan' });
    }
  }

  return {
    id: 1000 + floor,
    round: floor,
    branchLabel: `B-${floor}`,
    name: `XORG BREACH SECTOR ${floor}`,
    subtitle: `PROCEDURAL ANOMALY — DEPTH ${floor}`,
    theme,
    enemyKind,
    bricks,
    capsuleDropRate: Math.min(0.36, 0.24 + floor * 0.01),
  };
}
