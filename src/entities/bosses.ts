import { PLAYFIELD_BOTTOM, PLAYFIELD_RIGHT, PLAYFIELD_W, PLAYFIELD_X, PLAYFIELD_Y } from '../constants';
import { sweepCircleAABB } from '../physics/collision';
import type {
  BallState,
  BossKind,
  BossOrbiter,
  BossState,
  BossTentacle,
  LaserBolt,
  RulesetMode,
  VausState,
} from '../types';

export function createBoss(kind: BossKind, loopMultiplier = 1): BossState {
  const centerX = PLAYFIELD_X + PLAYFIELD_W * 0.5;

  if (kind === 'suirei') {
    const orbiters: BossOrbiter[] = [];
    for (let i = 0; i < 8; i++) {
      orbiters.push({
        angle: (i / 8) * Math.PI * 2,
        dist: 76,
        radius: 13,
        hp: 2,
        maxHp: 2,
        alive: true,
        regenTimer: 0,
      });
    }
    const maxHp = Math.round(24 * loopMultiplier);
    return {
      kind: 'suirei',
      phase: 1,
      x: centerX,
      y: PLAYFIELD_Y + 128,
      w: 96,
      h: 82,
      vx: 62,
      hp: maxHp,
      maxHp,
      hitFlash: 0,
      attackTimer: 2.2,
      animTime: 0,
      coreOpen: true,
      orbiters,
      tentacles: [],
      projectiles: [],
      defeated: false,
      deathTimer: 0,
    };
  }

  if (kind === 'sentinel') {
    const orbiters: BossOrbiter[] = [];
    for (let i = 0; i < 6; i++) {
      const isGold = i % 2 === 0;
      orbiters.push({
        angle: (i / 6) * Math.PI * 2,
        dist: 84,
        radius: 15,
        hp: isGold ? 999 : 3,
        maxHp: isGold ? 999 : 3,
        alive: true,
        regenTimer: 0,
        gold: isGold,
      });
    }
    const maxHp = Math.round(28 * loopMultiplier);
    return {
      kind: 'sentinel',
      phase: 1,
      x: centerX,
      y: PLAYFIELD_Y + 132,
      w: 92,
      h: 92,
      vx: 88,
      hp: maxHp,
      maxHp,
      hitFlash: 0,
      attackTimer: 1.8,
      animTime: 0,
      coreOpen: true,
      orbiters,
      tentacles: [],
      projectiles: [],
      defeated: false,
      deathTimer: 0,
    };
  }

  // Round 34 Final Boss: DOH (Phase 1 = Towering Moai Statue; Phase 2 = Tentacled Leviathan)
  const maxHp = Math.round(32 * loopMultiplier);
  return {
    kind: 'doh',
    phase: 1,
    x: centerX,
    y: PLAYFIELD_Y + 150,
    w: 112,
    h: 152,
    vx: 0,
    hp: maxHp,
    maxHp,
    hitFlash: 0,
    attackTimer: 2.0,
    animTime: 0,
    coreOpen: true,
    orbiters: [],
    tentacles: [],
    projectiles: [],
    defeated: false,
    deathTimer: 0,
  };
}

function buildDohTentacles(): BossTentacle[] {
  const tentacles: BossTentacle[] = [];
  const baseAngles = [-2.35, -1.85, -1.35, 1.35, 1.85, 2.35]; // fanning downward & outward
  for (let t = 0; t < baseAngles.length; t++) {
    const segments = [];
    for (let s = 0; s < 5; s++) {
      segments.push({
        x: 0,
        y: 0,
        radius: 14 - s * 1.4,
        hp: 2,
        maxHp: 2,
        alive: true,
        regenTimer: 0,
      });
    }
    tentacles.push({
      baseAngle: baseAngles[t] + Math.PI * 0.5,
      phaseOffset: t * 1.05,
      segments,
    });
  }
  return tentacles;
}

export interface BossStepEvents {
  spawnEnemy: boolean;
  phase2Transform: boolean;
  roar: boolean;
  bossDestroyed: boolean;
  deathExplosion: { x: number; y: number } | null;
  paddleHitByProjectile: { playerIndex: number; lethal: boolean; kind: string } | null;
}

export function updateBoss(
  boss: BossState,
  dt: number,
  paddles: VausState[],
  ruleset: RulesetMode,
  loopMultiplier = 1
): BossStepEvents {
  const events: BossStepEvents = {
    spawnEnemy: false,
    phase2Transform: false,
    roar: false,
    bossDestroyed: false,
    deathExplosion: null,
    paddleHitByProjectile: null,
  };

  boss.animTime += dt;
  if (boss.hitFlash > 0) boss.hitFlash = Math.max(0, boss.hitFlash - dt * 4);

  if (boss.defeated) {
    const prevTick = Math.floor(boss.deathTimer / 0.18);
    boss.deathTimer -= dt;
    const nextTick = Math.floor(boss.deathTimer / 0.18);
    if (nextTick < prevTick && boss.deathTimer > 0) {
      events.deathExplosion = {
        x: boss.x + (Math.random() - 0.5) * boss.w * 1.15,
        y: boss.y + (Math.random() - 0.5) * boss.h * 1.15,
      };
      boss.hitFlash = 0.9;
    }
    if (boss.deathTimer <= 0) {
      events.bossDestroyed = true;
    }
    return events;
  }

  const centerX = PLAYFIELD_X + PLAYFIELD_W * 0.5;
  const targetPaddle = paddles[0];

  // Movement & Orbiters / Tentacles
  if (boss.kind === 'suirei') {
    boss.x = centerX + Math.sin(boss.animTime * 1.15) * 125;
    boss.y = PLAYFIELD_Y + 125 + Math.sin(boss.animTime * 2.3) * 24;
    boss.coreOpen = Math.sin(boss.animTime * 1.4) > -0.45;

    for (const orb of boss.orbiters) {
      orb.angle += dt * 1.45;
      if (!orb.alive) {
        orb.regenTimer -= dt;
        if (orb.regenTimer <= 0) {
          orb.alive = true;
          orb.hp = orb.maxHp;
        }
      }
    }
  } else if (boss.kind === 'sentinel') {
    boss.x += boss.vx * dt;
    boss.coreOpen = Math.sin(boss.animTime * 1.6) > -0.35 || boss.attackTimer < 0.65;
    const minX = PLAYFIELD_X + 105;
    const maxX = PLAYFIELD_RIGHT - 105;
    if (boss.x < minX) {
      boss.x = minX;
      boss.vx = Math.abs(boss.vx);
    } else if (boss.x > maxX) {
      boss.x = maxX;
      boss.vx = -Math.abs(boss.vx);
    }
    for (const orb of boss.orbiters) {
      orb.angle -= dt * 1.65;
      if (!orb.alive && !orb.gold) {
        orb.regenTimer -= dt;
        if (orb.regenTimer <= 0) {
          orb.alive = true;
          orb.hp = orb.maxHp;
        }
      }
    }
  } else if (boss.kind === 'doh') {
    if (boss.phase === 1) {
      boss.x = centerX + Math.sin(boss.animTime * 0.7) * 52;
    } else {
      // Phase 2 Leviathan sweeps aggressively and lashes regenerating tentacles
      boss.x = centerX + Math.sin(boss.animTime * 1.35) * 110;
      boss.y = PLAYFIELD_Y + 142 + Math.cos(boss.animTime * 1.9) * 22;
      for (let tIdx = 0; tIdx < boss.tentacles.length; tIdx++) {
        const tent = boss.tentacles[tIdx];
        const side = tIdx < 3 ? -1 : 1;
        const spreadIdx = tIdx % 3;
        let px = boss.x + side * 34;
        let py = boss.y + 18;
        for (let s = 0; s < tent.segments.length; s++) {
          const seg = tent.segments[s];
          const sway =
            Math.sin(boss.animTime * 3.1 + tent.phaseOffset + s * 0.55) * (0.34 + s * 0.06);
          const dirAngle = Math.PI * 0.5 + side * (0.28 + spreadIdx * 0.26) + sway;
          px += Math.cos(dirAngle) * 26;
          py += Math.sin(dirAngle) * 26;
          seg.x = px;
          seg.y = py;

          if (!seg.alive) {
            seg.regenTimer -= dt;
            if (seg.regenTimer <= 0) {
              seg.alive = true;
              seg.hp = seg.maxHp;
            }
          }
        }
      }
    }
  }

  // Boss Attacks
  boss.attackTimer -= dt;
  if (boss.attackTimer <= 0 && targetPaddle) {
    const dx = targetPaddle.x - boss.x;
    const dy = targetPaddle.y - (boss.y + boss.h * 0.3);
    const baseAng = Math.atan2(dy, dx);

    if (boss.kind === 'suirei') {
      boss.attackTimer = 2.4;
      for (const offset of [-0.24, 0, 0.24]) {
        boss.projectiles.push({
          x: boss.x,
          y: boss.y + 28,
          vx: Math.cos(baseAng + offset) * 215,
          vy: Math.sin(baseAng + offset) * 215,
          radius: 7,
          kind: 'psy_wave',
          lethal: false,
          alive: true,
        });
      }
      if (Math.random() < 0.45) events.spawnEnemy = true;
    } else if (boss.kind === 'sentinel') {
      boss.attackTimer = 1.95;
      for (const offset of [-0.16, 0.16]) {
        boss.projectiles.push({
          x: boss.x,
          y: boss.y + 34,
          vx: Math.cos(baseAng + offset) * 250,
          vy: Math.sin(baseAng + offset) * 250,
          radius: 9,
          kind: 'ion_ring',
          lethal: false,
          alive: true,
        });
      }
    } else if (boss.kind === 'doh') {
      if (boss.phase === 1) {
        boss.attackTimer = Math.max(1.25, 2.1 - (1 - boss.hp / boss.maxHp) * 0.7);
        events.roar = true;
        const mouthY = boss.y + 42;
        for (const offset of [-0.26, 0, 0.26]) {
          boss.projectiles.push({
            x: boss.x,
            y: mouthY,
            vx: Math.cos(baseAng + offset) * 265,
            vy: Math.sin(baseAng + offset) * 265,
            radius: 8,
            kind: 'fireball',
            lethal: ruleset === 'purist',
            alive: true,
          });
        }
      } else {
        boss.attackTimer = 1.55;
        for (const offset of [-0.36, -0.12, 0.12, 0.36]) {
          boss.projectiles.push({
            x: boss.x,
            y: boss.y + 24,
            vx: Math.cos(baseAng + offset) * 280,
            vy: Math.sin(baseAng + offset) * 280,
            radius: 7.5,
            kind: 'spore',
            lethal: ruleset === 'purist',
            alive: true,
          });
        }
      }
    }
  }

  // Update Boss Projectiles
  for (const proj of boss.projectiles) {
    if (!proj.alive) continue;
    proj.x += proj.vx * dt;
    proj.y += proj.vy * dt;

    if (
      proj.x < PLAYFIELD_X - 20 ||
      proj.x > PLAYFIELD_RIGHT + 20 ||
      proj.y > PLAYFIELD_BOTTOM + 20 ||
      proj.y < PLAYFIELD_Y - 20
    ) {
      proj.alive = false;
      continue;
    }

    for (const p of paddles) {
      if (
        proj.x + proj.radius >= p.x - p.w * 0.5 &&
        proj.x - proj.radius <= p.x + p.w * 0.5 &&
        proj.y + proj.radius >= p.y - p.h * 0.5 &&
        proj.y - proj.radius <= p.y + p.h * 0.5
      ) {
        proj.alive = false;
        if (p.mercyShieldTimer <= 0) {
          events.paddleHitByProjectile = {
            playerIndex: p.playerIndex,
            lethal: proj.lethal,
            kind: proj.kind,
          };
        }
        break;
      }
    }
  }
  boss.projectiles = boss.projectiles.filter((p) => p.alive);

  // Check Phase Transition / Defeat inside damage helpers too, or safeguard here
  if (boss.hp <= 0 && !boss.defeated) {
    triggerBossZeroHp(boss, loopMultiplier, events);
  }

  return events;
}

function triggerBossZeroHp(boss: BossState, loopMultiplier: number, events?: BossStepEvents): boolean {
  if (boss.kind === 'doh' && boss.phase === 1) {
    boss.phase = 2;
    boss.maxHp = Math.round(40 * loopMultiplier);
    boss.hp = boss.maxHp;
    boss.w = 96;
    boss.h = 96;
    boss.tentacles = buildDohTentacles();
    boss.projectiles = [];
    boss.hitFlash = 1;
    boss.attackTimer = 2.0;
    if (events) {
      events.phase2Transform = true;
      events.roar = true;
    }
    return true; // transformed, not defeated yet
  } else {
    boss.hp = 0;
    boss.defeated = true;
    boss.deathTimer = 2.6;
    boss.projectiles = [];
    return false;
  }
}

export interface BossCollisionResult {
  hitCore: boolean;
  hitSubpart: boolean;
  goldBounce: boolean;
  transformedToPhase2: boolean;
  pointsAwarded: number;
  hitX: number;
  hitY: number;
}

export function collideBallWithBoss(
  ball: BallState,
  boss: BossState,
  dt: number,
  loopMultiplier = 1
): BossCollisionResult | null {
  if (boss.defeated) return null;

  // 1. Check Orbiters (Suirei & Sentinel)
  for (const orb of boss.orbiters) {
    if (!orb.alive) continue;
    const ox = boss.x + Math.cos(orb.angle) * orb.dist;
    const oy = boss.y + Math.sin(orb.angle) * orb.dist;
    const dist = Math.hypot(ball.x - ox, ball.y - oy);
    const minDist = ball.radius + orb.radius;
    if (dist <= minDist) {
      const nx = dist > 1e-4 ? (ball.x - ox) / dist : 0;
      const ny = dist > 1e-4 ? (ball.y - oy) / dist : -1;
      ball.x = ox + nx * (minDist + 1);
      ball.y = oy + ny * (minDist + 1);

      if (!ball.mega) {
        const dot = ball.vx * nx + ball.vy * ny;
        if (dot < 0) {
          ball.vx -= 2 * dot * nx;
          ball.vy -= 2 * dot * ny;
        }
      }

      if (orb.gold && !ball.mega) {
        ball.nonDestructiveHits++;
        return {
          hitCore: false,
          hitSubpart: false,
          goldBounce: true,
          transformedToPhase2: false,
          pointsAwarded: 0,
          hitX: ox,
          hitY: oy,
        };
      }

      orb.hp -= ball.mega ? 3 : 1;
      ball.nonDestructiveHits = 0;
      if (orb.hp <= 0) {
        orb.alive = false;
        orb.regenTimer = 6.5;
      }
      return {
        hitCore: false,
        hitSubpart: true,
        goldBounce: false,
        transformedToPhase2: false,
        pointsAwarded: 250,
        hitX: ox,
        hitY: oy,
      };
    }
  }

  // 2. Check DOH Phase 2 Regenerating Tentacles
  for (const tent of boss.tentacles) {
    for (let s = 0; s < tent.segments.length; s++) {
      const seg = tent.segments[s];
      if (!seg.alive) continue;
      const dist = Math.hypot(ball.x - seg.x, ball.y - seg.y);
      const minDist = ball.radius + seg.radius;
      if (dist <= minDist) {
        const nx = dist > 1e-4 ? (ball.x - seg.x) / dist : 0;
        const ny = dist > 1e-4 ? (ball.y - seg.y) / dist : 1;
        ball.x = seg.x + nx * (minDist + 1);
        ball.y = seg.y + ny * (minDist + 1);
        if (!ball.mega) {
          const dot = ball.vx * nx + ball.vy * ny;
          if (dot < 0) {
            ball.vx -= 2 * dot * nx;
            ball.vy -= 2 * dot * ny;
          }
        }
        seg.hp -= ball.mega ? 3 : 1;
        ball.nonDestructiveHits = 0;
        if (seg.hp <= 0) {
          // Severing an upper segment also temporarily severs outer tip segments!
          for (let k = s; k < tent.segments.length; k++) {
            tent.segments[k].alive = false;
            tent.segments[k].regenTimer = 5.5 + (k - s) * 0.6;
          }
        }
        return {
          hitCore: false,
          hitSubpart: true,
          goldBounce: false,
          transformedToPhase2: false,
          pointsAwarded: 300,
          hitX: seg.x,
          hitY: seg.y,
        };
      }
    }
  }

  // 3. Check Main Boss Hull (Swept Circle vs Boss AABB)
  const rx = boss.x - boss.w * 0.5;
  const ry = boss.y - boss.h * 0.5;
  const hit = sweepCircleAABB(
    ball.x,
    ball.y,
    ball.vx * dt,
    ball.vy * dt,
    ball.radius,
    rx,
    ry,
    boss.w,
    boss.h
  );

  if (hit) {
    ball.x = hit.contactX + hit.nx * 1.5;
    ball.y = hit.contactY + hit.ny * 1.5;
    if (hit.nx !== 0) ball.vx = Math.abs(ball.vx) * hit.nx;
    if (hit.ny !== 0) ball.vy = Math.abs(ball.vy) * hit.ny;

    // Suirei & Sentinel armor deflects normal balls when core shield is closed!
    if ((boss.kind === 'suirei' || boss.kind === 'sentinel') && !boss.coreOpen && !ball.mega) {
      boss.hitFlash = 0.35;
      ball.nonDestructiveHits++;
      return {
        hitCore: false,
        hitSubpart: false,
        goldBounce: true,
        transformedToPhase2: false,
        pointsAwarded: 0,
        hitX: hit.contactX,
        hitY: hit.contactY,
      };
    }

    const closedMegaPenalty = !boss.coreOpen && ball.mega ? 0.5 : 1;
    const dmg = Math.max(1, Math.round((ball.mega ? 2 : 1) * (ball.pierceCrit ? 2 : 1) * closedMegaPenalty));
    boss.hp -= dmg;
    boss.hitFlash = 1;
    ball.nonDestructiveHits = 0;
    ball.comboCount++;

    let transformed = false;
    if (boss.hp <= 0) {
      transformed = triggerBossZeroHp(boss, loopMultiplier);
    }

    return {
      hitCore: true,
      hitSubpart: false,
      goldBounce: false,
      transformedToPhase2: transformed,
      pointsAwarded: 1000,
      hitX: hit.contactX,
      hitY: hit.contactY,
    };
  }

  return null;
}

export function collideLasersWithBoss(
  lasers: LaserBolt[],
  boss: BossState,
  loopMultiplier = 1
): { points: number; hitCore: boolean; transformed: boolean } {
  let points = 0;
  let hitCore = false;
  let transformed = false;
  if (boss.defeated) return { points, hitCore, transformed };

  for (const bolt of lasers) {
    if (!bolt.alive) continue;

    // Check tentacles first
    let consumed = false;
    for (const tent of boss.tentacles) {
      for (const seg of tent.segments) {
        if (!seg.alive) continue;
        if (Math.hypot(bolt.x - seg.x, bolt.y - seg.y) <= seg.radius + 4) {
          seg.hp -= bolt.hyper ? 2 : 1;
          if (seg.hp <= 0) {
            seg.alive = false;
            seg.regenTimer = 5.5;
          }
          points += 150;
          if (!bolt.hyper) {
            bolt.alive = false;
            consumed = true;
            break;
          }
        }
      }
      if (consumed) break;
    }
    if (consumed) continue;

    // Check boss core AABB
    if (
      bolt.x >= boss.x - boss.w * 0.5 &&
      bolt.x <= boss.x + boss.w * 0.5 &&
      bolt.y >= boss.y - boss.h * 0.5 &&
      bolt.y <= boss.y + boss.h * 0.5
    ) {
      bolt.alive = false;
      if ((boss.kind === 'suirei' || boss.kind === 'sentinel') && !boss.coreOpen && !bolt.hyper) {
        boss.hitFlash = 0.25;
        continue;
      }
      const scale = !boss.coreOpen ? 0.35 : 1;
      boss.hp -= (bolt.hyper ? 0.85 : 0.45) * scale;
      boss.hitFlash = 0.7;
      points += 200;
      hitCore = true;
      if (boss.hp <= 0) {
        transformed = triggerBossZeroHp(boss, loopMultiplier);
        break;
      }
    }
  }

  return { points, hitCore, transformed };
}
