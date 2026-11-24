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

const CHAR_TO_BRICK: Record<string, BrickKind> = {
  W: 'white',
  O: 'orange',
  C: 'cyan',
  G: 'green',
  R: 'red',
  B: 'blue',
  M: 'magenta',
  Y: 'yellow',
  S: 'silver',
  N: 'regen',
  X: 'gold',
};

interface MovingOverlay {
  col: number;
  row: number;
  moving: MovingSpec;
}

interface CapsuleOverlay {
  col: number;
  row: number;
  capsule: CapsuleType;
}

interface HitsOverlay {
  col: number;
  row: number;
  hits: number;
}

interface StageSpec {
  id: number;
  round: number;
  branchLabel: string;
  name: string;
  subtitle: string;
  theme: SectorTheme;
  enemyKind: EnemyKind;
  boss?: BossKind;
  startRow?: number;
  grid: string[];
  moving?: MovingOverlay[];
  capsules?: CapsuleOverlay[];
  hits?: HitsOverlay[];
  capsuleDropRate?: number;
}

function buildBricks(spec: StageSpec): BrickBlueprint[] {
  const startRow = spec.startRow ?? 2;
  const bricks: BrickBlueprint[] = [];
  const movingMap = new Map<string, MovingSpec>();
  const capsuleMap = new Map<string, CapsuleType>();
  const hitsMap = new Map<string, number>();

  for (const m of spec.moving ?? []) {
    movingMap.set(`${m.col},${m.row}`, m.moving);
  }
  for (const c of spec.capsules ?? []) {
    capsuleMap.set(`${c.col},${c.row}`, c.capsule);
  }
  for (const h of spec.hits ?? []) {
    hitsMap.set(`${h.col},${h.row}`, h.hits);
  }

  for (let rIdx = 0; rIdx < spec.grid.length; rIdx++) {
    const line = spec.grid[rIdx];
    const row = startRow + rIdx;
    for (let col = 0; col < 13 && col < line.length; col++) {
      const ch = line[col];
      const kind = CHAR_TO_BRICK[ch];
      if (!kind) continue;
      const bp: BrickBlueprint = { col, row, kind };
      const key = `${col},${row}`;
      const mv = movingMap.get(key);
      if (mv) bp.moving = mv;
      const cap = capsuleMap.get(key);
      if (cap) bp.capsule = cap;
      const ht = hitsMap.get(key);
      if (ht !== undefined) bp.hits = ht;
      bricks.push(bp);
    }
  }
  return bricks;
}

function makeStage(spec: StageSpec): StageDefinition {
  return {
    id: spec.id,
    round: spec.round,
    branchLabel: spec.branchLabel,
    name: spec.name,
    subtitle: spec.subtitle,
    theme: spec.theme,
    enemyKind: spec.enemyKind,
    boss: spec.boss,
    bricks: buildBricks(spec),
    capsuleDropRate: spec.capsuleDropRate ?? 0.25,
  };
}

// Helper for mirrored moving bricks on rows
function symMove(
  row: number,
  leftCol: number,
  rightCol: number,
  speed = 1.6
): MovingOverlay[] {
  return [
    {
      col: leftCol,
      row,
      moving: { minCol: Math.max(0, leftCol - 1), maxCol: Math.min(5, leftCol + 2), speed, dir: 1 },
    },
    {
      col: rightCol,
      row,
      moving: {
        minCol: Math.max(7, rightCol - 2),
        maxCol: Math.min(12, rightCol + 1),
        speed,
        dir: -1,
      },
    },
  ];
}

const RAW_STAGES: StageSpec[] = [
  // =========================================================================
  // ROUND 1 (id: 1) — Classic Arkanoid II Opening Wall
  // =========================================================================
  {
    id: 1,
    round: 1,
    branchLabel: '1',
    name: 'XORG OUTER HULL',
    subtitle: 'BREACH THE DIMENSION FORTRESS',
    theme: 'hull_breach',
    enemyKind: 'pyramid',
    startRow: 2,
    grid: [
      'SSSSSSSSSSSSS',
      'RRRRRRRRRRRRR',
      'YYYYYYYYYYYYY',
      'BBBBBBBBBBBBB',
      'MMMMMMMMMMMMM',
      'GGGGGGGGGGGGG',
      'CCCCCCCCCCCCC',
    ],
    capsules: [
      { col: 2, row: 4, capsule: 'E' },
      { col: 6, row: 5, capsule: 'L' },
      { col: 10, row: 6, capsule: 'C' },
    ],
  },

  // =========================================================================
  // ROUND 2 (2L / 2R)
  // =========================================================================
  {
    id: 2,
    round: 2,
    branchLabel: '2L',
    name: 'TWIN TURRETS',
    subtitle: 'DUAL CORRIDOR ENTRY',
    theme: 'hull_breach',
    enemyKind: 'pyramid',
    startRow: 2,
    grid: [
      'SS.CCCCCCC.SS',
      'RR.YYYYYYY.RR',
      'OO.GGGGGGG.OO',
      'WW.BBBBBBB.WW',
      'CC.MMMMMMM.CC',
      'XX.SSSSSSS.XX',
      '....RRRRR....',
    ],
    capsules: [
      { col: 6, row: 3, capsule: 'T' },
      { col: 1, row: 4, capsule: 'E' },
    ],
  },
  {
    id: 3,
    round: 2,
    branchLabel: '2R',
    name: 'INVADER MOSAIC',
    subtitle: 'RETRO XENON SENTINEL',
    theme: 'hull_breach',
    enemyKind: 'trisphere',
    startRow: 2,
    grid: [
      '...G.....G...',
      '....G...G....',
      '...GGGGGGG...',
      '..GG.GGG.GG..',
      '.GGGGGGGGGGG.',
      '.G.GGGGGGG.G.',
      '.G.G.....G.G.',
      '....YY.YY....',
    ],
    capsules: [
      { col: 6, row: 5, capsule: 'D' },
      { col: 4, row: 9, capsule: 'L' },
    ],
  },

  // =========================================================================
  // ROUND 3 (3L / 3R)
  // =========================================================================
  {
    id: 4,
    round: 3,
    branchLabel: '3L',
    name: 'AIRLOCK SLIDERS',
    subtitle: 'MOVING GATEWAY LOCKS',
    theme: 'hull_breach',
    enemyKind: 'pyramid',
    startRow: 2,
    grid: [
      '.CCCCCCCCCCC.',
      '.BBBBBBBBBBB.',
      '..X.......X..',
      '.RRRRRRRRRRR.',
      '.OOOOOOOOOOO.',
      '..S.......S..',
      '.WWWWWWWWWWW.',
    ],
    moving: [
      { col: 2, row: 4, moving: { minCol: 1, maxCol: 5, speed: 1.5, dir: 1 } },
      { col: 10, row: 4, moving: { minCol: 7, maxCol: 11, speed: 1.5, dir: -1 } },
      { col: 2, row: 7, moving: { minCol: 1, maxCol: 5, speed: 1.9, dir: 1 } },
      { col: 10, row: 7, moving: { minCol: 7, maxCol: 11, speed: 1.9, dir: -1 } },
    ],
    capsules: [{ col: 6, row: 5, capsule: 'M' }],
  },
  {
    id: 5,
    round: 3,
    branchLabel: '3R',
    name: 'CHEVRON CASCADE',
    subtitle: 'ANGLED DEFLECTOR PLATES',
    theme: 'cryo_vault',
    enemyKind: 'trisphere',
    startRow: 2,
    grid: [
      'C...........C',
      'CC.........CC',
      'CCC.......CCC',
      'BBBB.....BBBB',
      'MMMMM...MMMMM',
      'YYYYYY.YYYYYY',
      '.SSSSSSSSSSS.',
    ],
    capsules: [
      { col: 6, row: 7, capsule: 'I' },
      { col: 1, row: 5, capsule: 'E' },
    ],
  },

  // =========================================================================
  // ROUND 4 (4L / 4R)
  // =========================================================================
  {
    id: 6,
    round: 4,
    branchLabel: '4L',
    name: 'NOTCHED BULWARK',
    subtitle: 'FIRST REGENERATING PLATING',
    theme: 'hull_breach',
    enemyKind: 'pyramid',
    startRow: 2,
    grid: [
      'MMMMMMMMMMMMM',
      'YYYYYYYYYYYYY',
      'CCCCCCCCCCCCC',
      'GGGGGGGGGGGGG',
      'N.N.N.N.N.N.N',
      '.O.O.O.O.O.O.',
    ],
    capsules: [{ col: 6, row: 3, capsule: 'L' }],
  },
  {
    id: 7,
    round: 4,
    branchLabel: '4R',
    name: 'PINBALL DIAMONDS',
    subtitle: 'TRIPLE RICOCHET CLUSTERS',
    theme: 'cryo_vault',
    enemyKind: 'trisphere',
    startRow: 2,
    grid: [
      '..C.......C..',
      '.CWC.....CWC.',
      'CWYWC...CWYWC',
      '.CWC..B..CWC.',
      '..C..BMB..C..',
      '....BMYMB....',
      '.....BMB.....',
      '......B......',
    ],
    capsules: [{ col: 6, row: 7, capsule: 'N' }],
  },

  // =========================================================================
  // ROUND 5 (5L / 5R)
  // =========================================================================
  {
    id: 8,
    round: 5,
    branchLabel: '5L',
    name: 'TWIN CHIMNEYS',
    subtitle: 'TOP-WALL TRAP TUNNELS',
    theme: 'hull_breach',
    enemyKind: 'pyramid',
    startRow: 2,
    grid: [
      'RR.WWWWWWW.RR',
      'OO.YYYYYYY.OO',
      'XX.GGGGGGG.XX',
      'CC.BBBBBBB.CC',
      'XX.MMMMMMM.XX',
      'GG.SSSSSSS.GG',
      'XX.........XX',
      '...OOOOOOO...',
    ],
    capsules: [{ col: 6, row: 5, capsule: 'B' }],
  },
  {
    id: 9,
    round: 5,
    branchLabel: '5R',
    name: 'CRYO PRISM',
    subtitle: 'REFRACTIVE CRYSTAL LATTICE',
    theme: 'cryo_vault',
    enemyKind: 'trisphere',
    startRow: 2,
    grid: [
      '.....CCC.....',
      '....CWWWC....',
      '...CWBBBWC...',
      '..CWBBBBWC...',
      '.CWBBSSSBBWC.',
      '..CWBBBBWC...',
      '...CWBBBWC...',
      '....CWWWC....',
      '.....CCC.....',
    ],
    capsules: [{ col: 6, row: 6, capsule: 'C' }],
  },

  // =========================================================================
  // ROUND 6 (6L / 6R)
  // =========================================================================
  {
    id: 10,
    round: 6,
    branchLabel: '6L',
    name: 'HELIX CONDUIT',
    subtitle: 'INTERLOCKING ENERGY STRANDS',
    theme: 'reactor_core',
    enemyKind: 'trisphere',
    startRow: 2,
    grid: [
      '.RR.......BB.',
      '..OO.....CC..',
      '...YY...GG...',
      '....MM.MM....',
      '.....SSS.....',
      '....CC.YY....',
      '...BB...OO...',
      '..GG.....RR..',
      '.SS.......SS.',
    ],
    capsules: [{ col: 6, row: 6, capsule: 'T' }],
  },
  {
    id: 11,
    round: 6,
    branchLabel: '6R',
    name: 'GOLD PORTCULLIS',
    subtitle: 'SLIDING VAULT BARRIERS',
    theme: 'cryo_vault',
    enemyKind: 'pyramid',
    startRow: 2,
    grid: [
      'YYYYYYYYYYYYY',
      'MMMMMMMMMMMMM',
      'CCCCCCCCCCCCC',
      '..X.......X..',
      'GGGGGGGGGGGGG',
      'BBBBBBBBBBBBB',
      '..N...N...N..',
    ],
    moving: [
      { col: 2, row: 5, moving: { minCol: 0, maxCol: 5, speed: 2.0, dir: 1 } },
      { col: 10, row: 5, moving: { minCol: 7, maxCol: 12, speed: 2.0, dir: -1 } },
    ],
    capsules: [{ col: 6, row: 3, capsule: 'M' }],
  },

  // =========================================================================
  // ROUND 7 (7L / 7R)
  // =========================================================================
  {
    id: 12,
    round: 7,
    branchLabel: '7L',
    name: 'CHECKERBOARD MATRIX',
    subtitle: 'ALTERNATING CHROME GRID',
    theme: 'hull_breach',
    enemyKind: 'pyramid',
    startRow: 2,
    grid: [
      'S.R.S.R.S.R.S',
      '.O.Y.O.Y.O.Y.',
      'G.C.G.C.G.C.G',
      '.B.M.B.M.B.M.',
      'W.S.W.S.W.S.W',
      '.N.R.N.R.N.R.',
      'C.Y.C.Y.C.Y.C',
    ],
    capsules: [{ col: 6, row: 4, capsule: 'D' }],
  },
  {
    id: 13,
    round: 7,
    branchLabel: '7R',
    name: 'TAITO EMBLEM',
    subtitle: 'WINGED COMMAND CREST',
    theme: 'reactor_core',
    enemyKind: 'trisphere',
    startRow: 2,
    grid: [
      'BBBBBBBBBBBBB',
      '.BBBBBBBBBBB.',
      '..CCCCCCCCC..',
      '....YYYYY....',
      '....RRRRR....',
      '...RRRRRRR...',
      '..RR.RRR.RR..',
      '.RR.......RR.',
    ],
    capsules: [{ col: 6, row: 5, capsule: 'L' }],
  },

  // =========================================================================
  // ROUND 8 (8L / 8R)
  // =========================================================================
  {
    id: 14,
    round: 8,
    branchLabel: '8L',
    name: 'REGEN SANCTUARY',
    subtitle: 'PROTECTED POCKET TARGETS',
    theme: 'bio_nexus',
    enemyKind: 'trisphere',
    startRow: 2,
    grid: [
      '.XXXXXXXXXXX.',
      '.X.RRRRRRR.X.',
      '.X.YYYYYYY.X.',
      '.X.CCCCCCC.X.',
      '.N.N.N.N.N.N.',
      '....GGGGG....',
    ],
    capsules: [{ col: 6, row: 4, capsule: '?' }],
  },
  {
    id: 15,
    round: 8,
    branchLabel: '8R',
    name: 'LASER CORRIDOR',
    subtitle: 'VERTICAL PLASMA LANES',
    theme: 'reactor_core',
    enemyKind: 'splitter',
    startRow: 2,
    grid: [
      'X.R.X.Y.X.R.X',
      'X.O.X.G.X.O.X',
      'X.C.X.B.X.C.X',
      'X.M.X.W.X.M.X',
      'S.C.S.Y.S.C.S',
      '..N...N...N..',
    ],
    capsules: [
      { col: 2, row: 4, capsule: 'L' },
      { col: 10, row: 4, capsule: 'L' },
    ],
  },

  // =========================================================================
  // ROUND 9 (9L / 9R)
  // =========================================================================
  {
    id: 16,
    round: 9,
    branchLabel: '9L',
    name: 'ZIGZAG PHALANX',
    subtitle: 'SHIFTING STEPPED BASTION',
    theme: 'cryo_vault',
    enemyKind: 'pyramid',
    startRow: 2,
    grid: [
      'RRRR.........',
      '.OOOO........',
      '..YYYY.......',
      '...GGGG......',
      '....CCCC.....',
      '.....BBBB....',
      '......MMMM...',
      '.......SSSS..',
    ],
    moving: [
      { col: 2, row: 4, moving: { minCol: 0, maxCol: 6, speed: 1.7, dir: 1 } },
      { col: 8, row: 7, moving: { minCol: 6, maxCol: 12, speed: 1.7, dir: -1 } },
    ],
    capsules: [{ col: 6, row: 6, capsule: 'E' }],
  },
  {
    id: 17,
    round: 9,
    branchLabel: '9R',
    name: 'PYRAMID TEMPLE',
    subtitle: 'STEPPED SOLAR MONOLITH',
    theme: 'gold_citadel',
    enemyKind: 'trisphere',
    startRow: 2,
    grid: [
      '......Y......',
      '.....YOY.....',
      '....YOROY....',
      '...YORSROY...',
      '..YORSSROY...',
      '.YORSSSSROY..',
      'XX.NNNNNNN.XX',
    ],
    capsules: [{ col: 6, row: 5, capsule: 'P' }],
  },

  // =========================================================================
  // ROUND 10 (10L / 10R)
  // =========================================================================
  {
    id: 18,
    round: 10,
    branchLabel: '10L',
    name: 'BIO-HIVE CELLS',
    subtitle: 'HONEYCOMB MEMBRANES',
    theme: 'bio_nexus',
    enemyKind: 'splitter',
    startRow: 2,
    grid: [
      '.GG.GG.GG.GG.',
      'GYYGGYYGGYYGG',
      '.GG.GG.GG.GG.',
      '.NN.CC.CC.NN.',
      'CMMCCMMCCMMCC',
      '.NN.SS.SS.NN.',
    ],
    capsules: [{ col: 6, row: 3, capsule: 'I' }],
  },
  {
    id: 19,
    round: 10,
    branchLabel: '10R',
    name: 'REACTOR RINGS',
    subtitle: 'CONCENTRIC TURBINE CORE',
    theme: 'reactor_core',
    enemyKind: 'splitter',
    startRow: 2,
    grid: [
      '..CCCCCCCCC..',
      '.C.........C.',
      '.C.RRRRRRR.C.',
      '.C.R.YYY.R.C.',
      '.C.R.YXY.R.C.',
      '.C.R.YYY.R.C.',
      '.C.RRRRRRR.C.',
      '.C.........C.',
      '..SS.SSS.SS..',
    ],
    capsules: [{ col: 6, row: 4, capsule: 'M' }],
  },

  // =========================================================================
  // ROUND 11 (11L / 11R)
  // =========================================================================
  {
    id: 20,
    round: 11,
    branchLabel: '11L',
    name: 'CRISS-CROSS SHUTTLE',
    subtitle: 'COUNTER-SLIDING HORIZONS',
    theme: 'hull_breach',
    enemyKind: 'trisphere',
    startRow: 2,
    grid: [
      'BBBBBBBBBBBBB',
      '..R.......R..',
      'GGGGGGGGGGGGG',
      '..Y.......Y..',
      'MMMMMMMMMMMMM',
      '..C.......C..',
      'SSSSSSSSSSSSS',
    ],
    moving: [
      ...symMove(3, 2, 10, 2.1),
      ...symMove(5, 2, 10, 2.4),
      ...symMove(7, 2, 10, 2.1),
    ],
    capsules: [{ col: 6, row: 4, capsule: 'N' }],
  },
  {
    id: 21,
    round: 11,
    branchLabel: '11R',
    name: 'GOLD CAGE BAIT',
    subtitle: 'OPEN-TOP TREASURE VAULT',
    theme: 'gold_citadel',
    enemyKind: 'splitter',
    startRow: 2,
    grid: [
      'XXX.......XXX',
      'X.YYYYYYYYY.X',
      'X.MMMMMMMMM.X',
      'X.CCCCCCCCC.X',
      'XXX.NNNNN.XXX',
      '....SSSSS....',
    ],
    capsules: [
      { col: 6, row: 3, capsule: 'G' },
      { col: 4, row: 5, capsule: 'M' },
    ],
  },

  // =========================================================================
  // ROUND 12 (12L / 12R)
  // =========================================================================
  {
    id: 22,
    round: 12,
    branchLabel: '12L',
    name: 'DUAL BUTTERFLY',
    subtitle: 'SYMMETRIC WING ARMATURE',
    theme: 'cryo_vault',
    enemyKind: 'splitter',
    startRow: 2,
    grid: [
      'MM.........MM',
      'MRM.......MRM',
      'MRYM..S..MYRM',
      'MRYCM.S.MCYRM',
      'MRYM..S..MYRM',
      'MRM.......MRM',
      'MM..N...N..MM',
    ],
    capsules: [{ col: 6, row: 5, capsule: 'T' }],
  },
  {
    id: 23,
    round: 12,
    branchLabel: '12R',
    name: 'ORBITAL DEFLECTOR',
    subtitle: 'SHATTERED RING STATION',
    theme: 'reactor_core',
    enemyKind: 'trisphere',
    startRow: 2,
    grid: [
      '...SSSSSSS...',
      '..SBBBBBBBS..',
      '.SB.......BS.',
      'SB..RRRRR..BS',
      'SB..RYYYR..BS',
      '.SB.......BS.',
      '..N.CCCCC.N..',
    ],
    capsules: [{ col: 6, row: 6, capsule: 'S' }],
  },

  // =========================================================================
  // ROUND 13 (13L / 13R)
  // =========================================================================
  {
    id: 24,
    round: 13,
    branchLabel: '13L',
    name: 'REGENERATION LABYRINTH',
    subtitle: 'SELF-HEALING BULKHEADS',
    theme: 'bio_nexus',
    enemyKind: 'builder',
    startRow: 2,
    grid: [
      'GGGGGGGGGGGGG',
      'N.N.YYYYY.N.N',
      'G.G.RRRRR.G.G',
      'N.N.CCCCC.N.N',
      'G.G.MMMMM.G.G',
      '..S.N...N.S..',
    ],
    capsules: [{ col: 6, row: 4, capsule: 'L' }],
  },
  {
    id: 25,
    round: 13,
    branchLabel: '13R',
    name: 'METALLIC GAUNTLET',
    subtitle: 'SILVER ARMOR PLATING',
    theme: 'gold_citadel',
    enemyKind: 'splitter',
    startRow: 2,
    grid: [
      'SSSSSSSSSSSSS',
      'S.CCCCCCCCC.S',
      'S.RRRRRRRRR.S',
      'S.YYYYYYYYY.S',
      '..SSSSSSSSS..',
      '.XX.......XX.',
    ],
    moving: [
      { col: 1, row: 7, moving: { minCol: 0, maxCol: 5, speed: 2.2, dir: 1 } },
      { col: 11, row: 7, moving: { minCol: 7, maxCol: 12, speed: 2.2, dir: -1 } },
    ],
    capsules: [{ col: 6, row: 4, capsule: 'M' }],
  },

  // =========================================================================
  // ROUND 14 (14L / 14R)
  // =========================================================================
  {
    id: 26,
    round: 14,
    branchLabel: '14L',
    name: 'XORG SKULL CREST',
    subtitle: 'EMBLEM OF THE OVERLORD',
    theme: 'doh_sanctum',
    enemyKind: 'splitter',
    startRow: 2,
    grid: [
      '...WWWWWWW...',
      '..WWWWWWWWW..',
      '.WW.RR.RR.WW.',
      '.WW.RR.RR.WW.',
      '..WWWWWWWWW..',
      '...WW.W.WW...',
      '...W.W.W.W...',
      '....SSSSS....',
    ],
    capsules: [{ col: 6, row: 6, capsule: '?' }],
  },
  {
    id: 27,
    round: 14,
    branchLabel: '14R',
    name: 'WAVE RESONATOR',
    subtitle: 'SINUSOIDAL HARMONIC FIELD',
    theme: 'cryo_vault',
    enemyKind: 'builder',
    startRow: 2,
    grid: [
      'CC.........CC',
      '.BB.......BB.',
      '..MM.....MM..',
      '...RR...RR...',
      '....YY.YY....',
      '...GG...GG...',
      '..OO.....OO..',
      '.SS.......SS.',
      'NN.........NN',
    ],
    capsules: [{ col: 5, row: 6, capsule: 'E' }],
  },

  // =========================================================================
  // ROUND 15 (15L / 15R)
  // =========================================================================
  {
    id: 28,
    round: 15,
    branchLabel: '15L',
    name: 'SYNAPSE CHAMBER',
    subtitle: 'APPROACHING SUIREI NEXUS',
    theme: 'bio_nexus',
    enemyKind: 'builder',
    startRow: 2,
    grid: [
      '..M.M.M.M.M..',
      '.MCCCCCCCCCM.',
      '.N.RRRRRRR.N.',
      '.M.YYYYYYY.M.',
      '.N.GGGGGGG.N.',
      '..S.S.S.S.S..',
    ],
    capsules: [{ col: 6, row: 4, capsule: 'B' }],
  },
  {
    id: 29,
    round: 15,
    branchLabel: '15R',
    name: 'SENTINEL BASTION',
    subtitle: 'OUTER TURRET PERIMETER',
    theme: 'gold_citadel',
    enemyKind: 'splitter',
    startRow: 2,
    grid: [
      'XX.SSSSSSS.XX',
      'OO.BBBBBBB.OO',
      'YY.RRRRRRR.YY',
      'XX.NNNNNNN.XX',
      '..CCCCCCCCC..',
      '...GGGGGGG...',
    ],
    capsules: [{ col: 6, row: 6, capsule: 'L' }],
  },

  // =========================================================================
  // ROUND 16 (16L / 16R)
  // =========================================================================
  {
    id: 30,
    round: 16,
    branchLabel: '16L',
    name: 'CORTEX THRESHOLD',
    subtitle: 'SUIREI GUARDIAN GATE',
    theme: 'bio_nexus',
    enemyKind: 'builder',
    startRow: 2,
    grid: [
      'MM.MMMMMMM.MM',
      'SS.CCCCCCC.SS',
      'NN.YYYYYYY.NN',
      'RR.GGGGGGG.RR',
      '..X.......X..',
      '....BBBBB....',
    ],
    moving: [
      { col: 2, row: 6, moving: { minCol: 1, maxCol: 5, speed: 2.3, dir: 1 } },
      { col: 10, row: 6, moving: { minCol: 7, maxCol: 11, speed: 2.3, dir: -1 } },
    ],
    capsules: [{ col: 6, row: 3, capsule: 'P' }],
  },
  {
    id: 31,
    round: 16,
    branchLabel: '16R',
    name: 'AEGIS GATEHOUSE',
    subtitle: 'ARK-SENTINEL THRESHOLD',
    theme: 'gold_citadel',
    enemyKind: 'splitter',
    startRow: 2,
    grid: [
      'SSSSSSSSSSSSS',
      'X.YYYYYYYYY.X',
      'X.OOOOOOOOO.X',
      'X.RRRRRRRRR.X',
      '..N.N.N.N.N..',
      '....CCCCC....',
    ],
    capsules: [{ col: 6, row: 4, capsule: 'M' }],
  },

  // =========================================================================
  // ROUND 17 MID-BOSSES (17L = SUIREI, 17R = ARK-SENTINEL)
  // =========================================================================
  {
    id: 32,
    round: 17,
    branchLabel: '17L',
    name: 'SUIREI',
    subtitle: 'CYBERNETIC BRAIN GUARDIAN',
    theme: 'bio_nexus',
    enemyKind: 'splitter',
    boss: 'suirei',
    startRow: 13,
    grid: [
      'NN.........NN',
      'MM.........MM',
    ],
    capsules: [
      { col: 0, row: 14, capsule: 'L' },
      { col: 12, row: 14, capsule: 'E' },
    ],
  },
  {
    id: 33,
    round: 17,
    branchLabel: '17R',
    name: 'ARK-SENTINEL',
    subtitle: 'ARMORED MECHANICAL CORE',
    theme: 'gold_citadel',
    enemyKind: 'pyramid',
    boss: 'sentinel',
    startRow: 13,
    grid: [
      'NN.........NN',
      'YY.........YY',
    ],
    capsules: [
      { col: 0, row: 14, capsule: 'L' },
      { col: 12, row: 14, capsule: 'M' },
    ],
  },

  // =========================================================================
  // ROUND 18 (id: 34) — XORG INNER CORE BREACH
  // =========================================================================
  {
    id: 34,
    round: 18,
    branchLabel: '18',
    name: 'INNER CORE BREACH',
    subtitle: 'DEEP XORG CONVERGENCE',
    theme: 'reactor_core',
    enemyKind: 'splitter',
    startRow: 2,
    grid: [
      'SSSSSSSSSSSSS',
      'N.CCCCCCCCC.N',
      'Y.RRRRRRRRR.Y',
      'B.MMMMMMMMM.B',
      'G.OOOOOOOOO.G',
      '..S.......S..',
      'WWWWWWWWWWWWW',
    ],
    moving: [...symMove(7, 2, 10, 2.2)],
    capsules: [
      { col: 6, row: 4, capsule: 'T' },
      { col: 2, row: 5, capsule: 'E' },
    ],
  },

  // =========================================================================
  // ROUNDS 19..32 (ids: 35..62, 14 rounds × 2 = 28 stages)
  // =========================================================================
  {
    id: 35,
    round: 19,
    branchLabel: '19L',
    name: 'NEON CROSSHAIRS',
    subtitle: 'TARGETING MATRIX',
    theme: 'reactor_core',
    enemyKind: 'splitter',
    startRow: 2,
    grid: [
      '......S......',
      '..CCC.S.CCC..',
      '.C...CSC...C.',
      'SSSSSSYSSSSSS',
      '.C...CSC...C.',
      '..RRR.S.RRR..',
      '......S......',
    ],
    capsules: [{ col: 6, row: 5, capsule: 'L' }],
  },
  {
    id: 36,
    round: 19,
    branchLabel: '19R',
    name: 'DOUBLE HELIX',
    subtitle: 'GENETIC CORE SPIRAL',
    theme: 'bio_nexus',
    enemyKind: 'builder',
    startRow: 2,
    grid: [
      '.GG.......MM.',
      '..GG.....MM..',
      '...CC...YY...',
      '....NN.NN....',
      '...YY...CC...',
      '..MM.....GG..',
      '.MM.......GG.',
      '..SS.....SS..',
    ],
    capsules: [{ col: 4, row: 6, capsule: 'D' }],
  },
  {
    id: 37,
    round: 20,
    branchLabel: '20L',
    name: 'TRIPLE AIRLOCK',
    subtitle: 'TRIPLE MOVING SHIELDS',
    theme: 'gold_citadel',
    enemyKind: 'splitter',
    startRow: 2,
    grid: [
      'YYYYYYYYYYYYY',
      'RRRRRRRRRRRRR',
      '..X.......X..',
      'BBBBBBBBBBBBB',
      '..S.......S..',
      'CCCCCCCCCCCCC',
      '..N.......N..',
    ],
    moving: [
      ...symMove(4, 2, 10, 2.4),
      ...symMove(6, 2, 10, 2.0),
      ...symMove(8, 2, 10, 2.6),
    ],
    capsules: [{ col: 6, row: 3, capsule: 'M' }],
  },
  {
    id: 38,
    round: 20,
    branchLabel: '20R',
    name: 'CELLULAR ARCHIVE',
    subtitle: 'REGENERATING HONEYCOMBS',
    theme: 'bio_nexus',
    enemyKind: 'builder',
    startRow: 2,
    grid: [
      'N.C.N.Y.N.C.N',
      '.R.G.R.G.R.G.',
      'N.M.N.B.N.M.N',
      '.O.W.O.W.O.W.',
      'S.S.N.S.N.S.S',
      '...CCCCCCC...',
    ],
    capsules: [{ col: 5, row: 3, capsule: 'N' }],
  },
  {
    id: 39,
    round: 21,
    branchLabel: '21L',
    name: 'HOURGLASS CONSTRICTOR',
    subtitle: 'PINBALL FUNNEL CHAMBER',
    theme: 'cryo_vault',
    enemyKind: 'splitter',
    startRow: 2,
    grid: [
      'XBBBBBBBBBBBX',
      '.XCCCCCCCCCX.',
      '..XYYYYYYYX..',
      '...XRRRRRX...',
      '....SMMMS....',
      '...SGGGGGS...',
      '..SOOOOOOOS..',
      '.N.........N.',
    ],
    capsules: [{ col: 6, row: 6, capsule: 'C' }],
  },
  {
    id: 40,
    round: 21,
    branchLabel: '21R',
    name: 'CROWN OF XORG',
    subtitle: 'SOVEREIGN CITADEL SPIRE',
    theme: 'gold_citadel',
    enemyKind: 'builder',
    startRow: 2,
    grid: [
      'Y.....Y.....Y',
      'YY...YYY...YY',
      'YRY.YRORY.YRY',
      'RRRRRRRRRRRRR',
      'SSSSSSSSSSSSS',
      'XX.NNNNNNN.XX',
    ],
    capsules: [{ col: 6, row: 5, capsule: 'G' }],
  },
  {
    id: 41,
    round: 22,
    branchLabel: '22L',
    name: 'VAUS SILHOUETTE',
    subtitle: 'MIRRORED INTERCEPTOR',
    theme: 'reactor_core',
    enemyKind: 'trisphere',
    startRow: 2,
    grid: [
      '..RRRR.RRRR..',
      '.ROOOSSSOOOR.',
      'ROCCCCCCCCOR.',
      'ROCCCCCCCCOR.',
      '.ROOOSSSOOOR.',
      '..NN..M..NN..',
    ],
    capsules: [{ col: 6, row: 7, capsule: 'T' }],
  },
  {
    id: 42,
    round: 22,
    branchLabel: '22R',
    name: 'QUANTUM POCKETS',
    subtitle: 'RICOCHET CHAMBERS',
    theme: 'cryo_vault',
    enemyKind: 'splitter',
    startRow: 2,
    grid: [
      'X.YY.XCX.YY.X',
      'X.OO.XBX.OO.X',
      'X.RR.XMX.RR.X',
      '..SS..S..SS..',
      '.N..GGGGG..N.',
      '...SSSSSSS...',
    ],
    capsules: [{ col: 6, row: 6, capsule: 'I' }],
  },
  {
    id: 43,
    round: 23,
    branchLabel: '23L',
    name: 'PLASMA WEAVE',
    subtitle: 'INTERLACED LASER LINES',
    theme: 'reactor_core',
    enemyKind: 'builder',
    startRow: 2,
    grid: [
      'R.O.Y.G.C.B.M',
      '.M.B.C.G.Y.O.',
      'S.R.S.Y.S.C.S',
      '.N.G.N.B.N.M.',
      'C.Y.R.W.R.Y.C',
      '..SSSSSSSSS..',
    ],
    capsules: [{ col: 6, row: 6, capsule: 'L' }],
  },
  {
    id: 44,
    round: 23,
    branchLabel: '23R',
    name: 'PENDULUM VAULT',
    subtitle: 'SWINGING BLOCK GATES',
    theme: 'gold_citadel',
    enemyKind: 'splitter',
    startRow: 2,
    grid: [
      'GGGGGGGGGGGGG',
      'MMMMMMMMMMMMM',
      '..S.......S..',
      'YYYYYYYYYYYYY',
      '..X.......X..',
      'RRRRRRRRRRRRR',
      '..N...N...N..',
    ],
    moving: [
      ...symMove(4, 2, 10, 2.5),
      ...symMove(6, 2, 10, 2.7),
    ],
    capsules: [{ col: 6, row: 5, capsule: 'S' }],
  },
  {
    id: 45,
    round: 24,
    branchLabel: '24L',
    name: 'BIO-RIBCAGE',
    subtitle: 'ORGANIC TITAN HULL',
    theme: 'bio_nexus',
    enemyKind: 'builder',
    startRow: 2,
    grid: [
      '....SSSSS....',
      '..MM..R..MM..',
      '.C...RRR...C.',
      'G...RRRRR...G',
      '.Y...RRR...Y.',
      '..N...R...N..',
      '...CCCCCCC...',
    ],
    capsules: [{ col: 6, row: 5, capsule: '?' }],
  },
  {
    id: 46,
    round: 24,
    branchLabel: '24R',
    name: 'GOLD LABYRINTH',
    subtitle: 'ANGLED DEFLECTION CORRIDORS',
    theme: 'gold_citadel',
    enemyKind: 'splitter',
    startRow: 2,
    grid: [
      '..XXXXXXXXX..',
      '..RRRRRRRRR..',
      'XX.YYYYYYY.XX',
      '..CCCCCCCCC..',
      'XX.MMMMMMM.XX',
      '..SSSSSSSSS..',
      '...NNNNNNN...',
    ],
    capsules: [{ col: 6, row: 4, capsule: 'M' }],
  },
  {
    id: 47,
    round: 25,
    branchLabel: '25L',
    name: 'STARLIGHT MATRIX',
    subtitle: 'CONSTELLATION CLUSTER',
    theme: 'cryo_vault',
    enemyKind: 'builder',
    startRow: 2,
    grid: [
      '..Y.......Y..',
      '.YCY.....YCY.',
      '..Y..SWS..Y..',
      '....SWBWS....',
      '..M..SWS..M..',
      '.MRM.....MRM.',
      '..M...N...M..',
    ],
    capsules: [{ col: 6, row: 5, capsule: 'P' }],
  },
  {
    id: 48,
    round: 25,
    branchLabel: '25R',
    name: 'TURBINE PISTONS',
    subtitle: 'HIGH-SPEED SHUTTLE GRID',
    theme: 'reactor_core',
    enemyKind: 'splitter',
    startRow: 2,
    grid: [
      '.SSSSSSSSSSS.',
      '..C.......C..',
      '.RRRRRRRRRRR.',
      '..Y.......Y..',
      '.BBBBBBBBBBB.',
      '..G.......G..',
      '.NNNNNNNNNNN.',
    ],
    moving: [
      ...symMove(3, 2, 10, 2.8),
      ...symMove(5, 2, 10, 2.5),
      ...symMove(7, 2, 10, 2.9),
    ],
    capsules: [{ col: 6, row: 4, capsule: 'N' }],
  },
  {
    id: 49,
    round: 26,
    branchLabel: '26L',
    name: 'CRIMSON FORTRESS',
    subtitle: 'REINFORCED RED BASTION',
    theme: 'doh_sanctum',
    enemyKind: 'builder',
    startRow: 2,
    grid: [
      'RRRRRRRRRRRRR',
      'R.SSSSSSSSS.R',
      'R.YYYYYYYYY.R',
      'R.OOOOOOOOO.R',
      'N.RRRRRRRRR.N',
      '..XX.....XX..',
    ],
    capsules: [{ col: 6, row: 4, capsule: 'L' }],
  },
  {
    id: 50,
    round: 26,
    branchLabel: '26R',
    name: 'CRYSTAL CATHEDRAL',
    subtitle: 'TWIN GOTHIC ARCHES',
    theme: 'cryo_vault',
    enemyKind: 'builder',
    startRow: 2,
    grid: [
      '..CC.....CC..',
      '.CWWC...CWWC.',
      'CWBBWC.CWBBWC',
      'CBBBBWCBBBBWC',
      'S.MM.S.S.MM.S',
      'N....YYY....N',
    ],
    capsules: [{ col: 6, row: 7, capsule: 'B' }],
  },
  {
    id: 51,
    round: 27,
    branchLabel: '27L',
    name: 'WARP REACTOR',
    subtitle: 'STABILIZING RING ARRAY',
    theme: 'reactor_core',
    enemyKind: 'splitter',
    startRow: 2,
    grid: [
      'MMMMMMMMMMMMM',
      'S.CCCCCCCCC.S',
      'S.C.YYYYY.C.S',
      'S.C.Y.R.Y.C.S',
      'S.C.YYYYY.C.S',
      'S.CCCCCCCCC.S',
      '..N...N...N..',
    ],
    capsules: [{ col: 6, row: 5, capsule: 'M' }],
  },
  {
    id: 52,
    round: 27,
    branchLabel: '27R',
    name: 'CHROME CASCADE',
    subtitle: 'TRIPLE TIERED SILVER',
    theme: 'gold_citadel',
    enemyKind: 'builder',
    startRow: 2,
    grid: [
      'SSSSSSSSSSSSS',
      'GGGGGGGGGGGGG',
      'SSSSSSSSSSSSS',
      'BBBBBBBBBBBBB',
      'SSSSSSSSSSSSS',
      'YYYYYYYYYYYYY',
      'N.N.N.N.N.N.N',
    ],
    capsules: [{ col: 6, row: 5, capsule: 'G' }],
  },
  {
    id: 53,
    round: 28,
    branchLabel: '28L',
    name: 'SERPENTINE COIL',
    subtitle: 'WINDING BIO-CHANNEL',
    theme: 'bio_nexus',
    enemyKind: 'builder',
    startRow: 2,
    grid: [
      'GGGGGGGGGGGGG',
      '............G',
      'YYYYYYYYYYY.G',
      'Y...........G',
      'Y.RRRRRRRRR.G',
      'Y.R.......R.G',
      'N.SSSSSSSSS.N',
    ],
    capsules: [{ col: 6, row: 6, capsule: 'E' }],
  },
  {
    id: 54,
    round: 28,
    branchLabel: '28R',
    name: 'MONOLITH PILLARS',
    subtitle: 'FOUR ANCIENT COLUMNS',
    theme: 'doh_sanctum',
    enemyKind: 'splitter',
    startRow: 2,
    grid: [
      '.SS..CCC..SS.',
      '.YY..BBB..YY.',
      '.OO..MMM..OO.',
      '.RR..GGG..RR.',
      '.SS..WWW..SS.',
      '.XX..NNN..XX.',
      '....RRRRR....',
    ],
    capsules: [{ col: 6, row: 6, capsule: 'T' }],
  },
  {
    id: 55,
    round: 29,
    branchLabel: '29L',
    name: 'OVERDRIVE MATRIX',
    subtitle: 'HIGH VELOCITY DEFLECTION',
    theme: 'reactor_core',
    enemyKind: 'splitter',
    startRow: 2,
    grid: [
      'R.Y.C.M.C.Y.R',
      '.S.S.S.S.S.S.',
      'B.G.O.W.O.G.B',
      '.N.N.N.N.N.N.',
      'M.C.Y.R.Y.C.M',
      '..X.......X..',
    ],
    moving: [...symMove(7, 2, 10, 3.0)],
    capsules: [{ col: 6, row: 4, capsule: 'S' }],
  },
  {
    id: 56,
    round: 29,
    branchLabel: '29R',
    name: 'PHOENIX CITADEL',
    subtitle: 'BLAZING WING CREST',
    theme: 'gold_citadel',
    enemyKind: 'builder',
    startRow: 2,
    grid: [
      'R...........R',
      'RR....Y....RR',
      'ORY..YOY..YRO',
      '.ORYYOSOYRO..',
      '..SSSSSSSSS..',
      '...NNNNNNN...',
    ],
    capsules: [{ col: 6, row: 5, capsule: 'M' }],
  },
  {
    id: 57,
    round: 30,
    branchLabel: '30L',
    name: 'ABYSSAL CORE',
    subtitle: 'BIO-MECHANICAL WALLS',
    theme: 'doh_sanctum',
    enemyKind: 'builder',
    startRow: 2,
    grid: [
      'MMMMMMMMMMMMM',
      'M.SSSSSSSSS.M',
      'M.R.CCCCC.R.M',
      'M.R.YYYYY.R.M',
      'N.SSSSSSSSS.N',
      '..BBBBBBBBB..',
    ],
    capsules: [{ col: 6, row: 5, capsule: 'N' }],
  },
  {
    id: 58,
    round: 30,
    branchLabel: '30R',
    name: 'TRINITY LOCK',
    subtitle: 'THREE-CHAMBER BREACH',
    theme: 'gold_citadel',
    enemyKind: 'splitter',
    startRow: 2,
    grid: [
      'XXX..XXX..XXX',
      'YYY..CCC..MMM',
      'RRR..BBB..GGG',
      'SSS..SSS..SSS',
      'N.N..N.N..N.N',
      '.OOOOOOOOOOO.',
    ],
    capsules: [{ col: 6, row: 7, capsule: 'L' }],
  },
  {
    id: 59,
    round: 31,
    branchLabel: '31L',
    name: 'XORG PULSE ENGINE',
    subtitle: 'HEARTBEAT CONDUIT',
    theme: 'reactor_core',
    enemyKind: 'builder',
    startRow: 2,
    grid: [
      'S.CCCCCCCCC.S',
      'S.RRRRRRRRR.S',
      '..X.......X..',
      'S.YYYYYYYYY.S',
      'S.MMMMMMMMM.S',
      '..N.N.N.N.N..',
      '....SSSSS....',
    ],
    moving: [...symMove(4, 2, 10, 3.1)],
    capsules: [{ col: 6, row: 5, capsule: '?' }],
  },
  {
    id: 60,
    round: 31,
    branchLabel: '31R',
    name: 'SANCTUM GUARD',
    subtitle: 'ROYAL PHALANX WALL',
    theme: 'doh_sanctum',
    enemyKind: 'splitter',
    startRow: 2,
    grid: [
      'SSSSSSSSSSSSS',
      'YYYYYYYYYYYYY',
      'RRRRRRRRRRRRR',
      'XX.MMMMMMM.XX',
      'NN.CCCCCCC.NN',
      '..GGGGGGGGG..',
    ],
    capsules: [{ col: 6, row: 5, capsule: 'P' }],
  },
  {
    id: 61,
    round: 32,
    branchLabel: '32L',
    name: 'DARK DIMENSION',
    subtitle: 'FINAL LEFT APPROACH',
    theme: 'doh_sanctum',
    enemyKind: 'builder',
    startRow: 2,
    grid: [
      'RR.SSSSSSS.RR',
      'MM.YYYYYYY.MM',
      'BB.CCCCCCC.BB',
      'XX.RRRRRRR.XX',
      'NN.GGGGGGG.NN',
      '..SSSSSSSSS..',
    ],
    capsules: [{ col: 6, row: 5, capsule: 'M' }],
  },
  {
    id: 62,
    round: 32,
    branchLabel: '32R',
    name: 'GOLDEN OBLIVION',
    subtitle: 'FINAL RIGHT APPROACH',
    theme: 'gold_citadel',
    enemyKind: 'builder',
    startRow: 2,
    grid: [
      'X.YYYYYYYYY.X',
      'X.SSSSSSSSS.X',
      '.S.........S.',
      'S.RRRRRRRRR.S',
      'S.CCCCCCCCC.S',
      '..MMMMMMMMM..',
      'N.N.N.N.N.N.N',
    ],
    moving: [...symMove(4, 1, 11, 2.8)],
    capsules: [{ col: 6, row: 5, capsule: 'G' }],
  },

  // =========================================================================
  // ROUND 33 (id: 63) — DOH SANCTUM ANTECHAMBER
  // =========================================================================
  {
    id: 63,
    round: 33,
    branchLabel: '33',
    name: 'DOH ANTECHAMBER',
    subtitle: 'SHATTER THE INNER SEAL',
    theme: 'doh_sanctum',
    enemyKind: 'builder',
    startRow: 2,
    grid: [
      'SSSSSSSSSSSSS',
      'X.RRRRRRRRR.X',
      'X.YYYYYYYYY.X',
      'S.MMMMMMMMM.S',
      'S.CCCCCCCCC.S',
      '..X.......X..',
      'N.GGGGGGGGG.N',
      '..SSSSSSSSS..',
    ],
    moving: [...symMove(7, 2, 10, 3.0)],
    capsules: [
      { col: 6, row: 5, capsule: 'M' },
      { col: 3, row: 6, capsule: 'L' },
      { col: 9, row: 6, capsule: 'T' },
    ],
  },

  // =========================================================================
  // ROUND 34 (id: 64) — THE REVENGE OF DOH (FINAL 2-PHASE BOSS)
  // =========================================================================
  {
    id: 64,
    round: 34,
    branchLabel: '34',
    name: 'REVENGE OF DOH',
    subtitle: 'DIMENSION OVERLORD SHOWDOWN',
    theme: 'doh_sanctum',
    enemyKind: 'splitter',
    boss: 'doh',
    startRow: 14,
    grid: [
      'NN.........NN',
    ],
    capsules: [
      { col: 0, row: 14, capsule: 'L' },
      { col: 12, row: 14, capsule: 'E' },
    ],
  },
];

export const CAMPAIGN_STAGES: StageDefinition[] = RAW_STAGES.map(makeStage);
