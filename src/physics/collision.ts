import {
  MAX_BALL_SPEED,
  PLAYFIELD_RIGHT,
  PLAYFIELD_X,
  PLAYFIELD_Y,
} from '../constants';
import type { BallState, BrickRuntime, VausState } from '../types';

export interface SweepHit {
  t: number; // 0..1
  nx: number;
  ny: number;
  contactX: number;
  contactY: number;
}

/**
 * Swept Circle vs Static AABB (Minkowski-expanded rectangle) collision check.
 * Prevents high-speed tunneling at 240Hz across thin bricks and paddle edges.
 */
export function sweepCircleAABB(
  cx: number,
  cy: number,
  dx: number,
  dy: number,
  radius: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number
): SweepHit | null {
  const minX = rx - radius;
  const maxX = rx + rw + radius;
  const minY = ry - radius;
  const maxY = ry + rh + radius;

  // Already overlapping check
  if (cx >= minX && cx <= maxX && cy >= minY && cy <= maxY) {
    const overlapLeft = cx - minX;
    const overlapRight = maxX - cx;
    const overlapTop = cy - minY;
    const overlapBottom = maxY - cy;
    const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);
    let nx = 0;
    let ny = 0;
    if (minOverlap === overlapTop) ny = -1;
    else if (minOverlap === overlapBottom) ny = 1;
    else if (minOverlap === overlapLeft) nx = -1;
    else nx = 1;
    return { t: 0, nx, ny, contactX: cx, contactY: cy };
  }

  let tEntryX = -Infinity;
  let tExitX = Infinity;
  if (Math.abs(dx) < 1e-8) {
    if (cx < minX || cx > maxX) return null;
  } else {
    const invDx = 1 / dx;
    const t1 = (minX - cx) * invDx;
    const t2 = (maxX - cx) * invDx;
    tEntryX = Math.min(t1, t2);
    tExitX = Math.max(t1, t2);
  }

  let tEntryY = -Infinity;
  let tExitY = Infinity;
  if (Math.abs(dy) < 1e-8) {
    if (cy < minY || cy > maxY) return null;
  } else {
    const invDy = 1 / dy;
    const t1 = (minY - cy) * invDy;
    const t2 = (maxY - cy) * invDy;
    tEntryY = Math.min(t1, t2);
    tExitY = Math.max(t1, t2);
  }

  const tEntry = Math.max(tEntryX, tEntryY);
  const tExit = Math.min(tExitX, tExitY);

  if (tEntry > tExit || tEntry < 0 || tEntry > 1) {
    return null;
  }

  let nx = 0;
  let ny = 0;
  if (tEntryX > tEntryY) {
    nx = dx > 0 ? -1 : 1;
  } else {
    ny = dy > 0 ? -1 : 1;
  }

  return {
    t: tEntry,
    nx,
    ny,
    contactX: cx + dx * tEntry,
    contactY: cy + dy * tEntry,
  };
}

/**
 * Computes authentic Arkanoid II Vaus reflection velocity.
 * Supports discrete 7-zone 1987 arcade angles AND smooth Evolved curve + Kinetic Spin.
 */
export function applyVausBounce(
  ball: BallState,
  vaus: VausState,
  discreteZones: boolean,
  allowKineticSpin: boolean
): number {
  const halfW = vaus.w * 0.5;
  let rel = (ball.x - vaus.x) / Math.max(12, halfW); // -1..1

  // If Twin Vaus is active, create two sub-paddles side-by-side so each pod has full reflection control
  if (vaus.twinActive) {
    const podCenterOffset = halfW * 0.52;
    const subCenter = ball.x < vaus.x ? vaus.x - podCenterOffset : vaus.x + podCenterOffset;
    const subHalfW = halfW * 0.46;
    rel = (ball.x - subCenter) / Math.max(10, subHalfW);
  }

  rel = Math.max(-1.05, Math.min(1.05, rel));

  let angleDegFromUp: number;
  if (discreteZones) {
    // Classic 7-segment Taito arcade angle table (degrees from straight vertical up)
    const absRel = Math.abs(rel);
    let magDeg: number;
    if (absRel < 0.14) magDeg = 14;
    else if (absRel < 0.42) magDeg = 32;
    else if (absRel < 0.74) magDeg = 52;
    else magDeg = 68;
    const sign = rel === 0 ? (ball.vx >= 0 ? 1 : -1) : Math.sign(rel);
    angleDegFromUp = sign * magDeg;
  } else {
    // Continuous responsive curve: gentle near center, sharp near red outer tips
    const sign = Math.abs(rel) < 0.02 ? (ball.vx >= 0 ? 1 : -1) : Math.sign(rel);
    const shaped = Math.pow(Math.min(1, Math.abs(rel)), 1.15);
    angleDegFromUp = sign * (10 + shaped * 59);
  }

  // Evolved Kinetic Spin ("English"): brisk paddle motion bends the shot up to +-11 deg
  if (allowKineticSpin && Math.abs(vaus.vx) > 25) {
    const spinDeg = Math.max(-11, Math.min(11, (vaus.vx / 620) * 10));
    angleDegFromUp += spinDeg;
    const speedBoost = Math.min(28, Math.abs(vaus.vx) * 0.03);
    ball.speed = Math.min(MAX_BALL_SPEED, ball.speed + speedBoost);
  }

  // Clamp angle so ball always travels meaningfully upward (at least 20 deg above horizon)
  angleDegFromUp = Math.max(-70, Math.min(70, angleDegFromUp));
  const rad = (angleDegFromUp * Math.PI) / 180;

  ball.vx = Math.sin(rad) * ball.speed;
  ball.vy = -Math.cos(rad) * ball.speed;
  ball.y = Math.min(ball.y, vaus.y - vaus.h * 0.5 - ball.radius - 0.5);
  ball.nonDestructiveHits = 0;
  ball.comboCount = 0;

  return Math.max(-1, Math.min(1, rel));
}

/**
 * Ensures ball velocity matches ball.speed and prevents infinite horizontal loops.
 */
export function enforceBallVelocityBounds(ball: BallState): boolean {
  let nudged = false;
  if (ball.nonDestructiveHits >= 8) {
    // Perturb vertical trajectory to break wall-to-gold infinite horizontal bounce loops
    const signY = ball.vy >= 0 ? 1 : -1;
    ball.vy += signY * ball.speed * 0.14;
    ball.nonDestructiveHits = 0;
    nudged = true;
  }

  const minVy = ball.speed * 0.2;
  if (Math.abs(ball.vy) < minVy) {
    const signY = ball.vy === 0 ? -1 : Math.sign(ball.vy);
    ball.vy = signY * minVy;
  }

  const len = Math.hypot(ball.vx, ball.vy);
  if (len > 1e-5) {
    ball.vx = (ball.vx / len) * ball.speed;
    ball.vy = (ball.vy / len) * ball.speed;
  } else {
    ball.vx = ball.speed * 0.5;
    ball.vy = -ball.speed * 0.866;
  }

  // Clamp inside playfield walls
  if (ball.x - ball.radius < PLAYFIELD_X) {
    ball.x = PLAYFIELD_X + ball.radius;
    ball.vx = Math.abs(ball.vx);
  } else if (ball.x + ball.radius > PLAYFIELD_RIGHT) {
    ball.x = PLAYFIELD_RIGHT - ball.radius;
    ball.vx = -Math.abs(ball.vx);
  }
  if (ball.y - ball.radius < PLAYFIELD_Y) {
    ball.y = PLAYFIELD_Y + ball.radius;
    ball.vy = Math.abs(ball.vy);
  }

  return nudged;
}

/**
 * Slides Moving Bricks horizontally along their rail bounds and bounces off neighboring alive bricks.
 */
export function updateMovingBricks(bricks: BrickRuntime[], dt: number): void {
  for (let i = 0; i < bricks.length; i++) {
    const b = bricks[i];
    if (!b.alive || !b.moving) continue;

    let nextX = b.x + b.moving.vx * dt;
    let reversed = false;

    if (nextX <= b.moving.minX) {
      nextX = b.moving.minX;
      b.moving.vx = Math.abs(b.moving.vx);
      reversed = true;
    } else if (nextX + b.w >= b.moving.maxX) {
      nextX = b.moving.maxX - b.w;
      b.moving.vx = -Math.abs(b.moving.vx);
      reversed = true;
    }

    if (!reversed) {
      // Check horizontal overlap against other bricks on the same row
      for (let j = 0; j < bricks.length; j++) {
        if (i === j) continue;
        const other = bricks[j];
        if (!other.alive) continue;
        if (Math.abs(other.y - b.y) >= b.h - 2) continue;

        if (nextX < other.x + other.w && nextX + b.w > other.x) {
          if (b.moving.vx > 0) {
            nextX = other.x - b.w;
            b.moving.vx = -Math.abs(b.moving.vx);
          } else {
            nextX = other.x + other.w;
            b.moving.vx = Math.abs(b.moving.vx);
          }
          break;
        }
      }
    }

    b.x = nextX;
  }
}
