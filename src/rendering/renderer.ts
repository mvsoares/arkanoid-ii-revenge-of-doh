import {
  BONUS_WARP_H,
  BONUS_WARP_Y,
  BRICK_COLORS,
  CANVAS_H,
  CANVAS_W,
  CAPSULE_META,
  HATCH_LEFT_X,
  HATCH_RIGHT_X,
  PLAYFIELD_BOTTOM,
  PLAYFIELD_H,
  PLAYFIELD_RIGHT,
  PLAYFIELD_W,
  PLAYFIELD_X,
  PLAYFIELD_Y,
  VAUS_Y,
  WALL_THICKNESS,
  WARP_GATE_H,
  WARP_GATE_Y,
} from '../constants';
import { getStageById, type SectorNode } from '../stages/sectorGraph';
import type {
  BallState,
  BossState,
  BrickRuntime,
  CapsuleEntity,
  CapsuleType,
  EnemyEntity,
  RenderSnapshot,
  SectorTheme,
  VausState,
} from '../types';

interface Star {
  x: number;
  y: number;
  z: number;
  phase: number;
}

const THEME_PALETTES: Record<
  SectorTheme,
  { bgTop: string; bgBot: string; grid: string; accent: string }
> = {
  hull_breach: { bgTop: '#060c1f', bgBot: '#0c1a3a', grid: '#17366e', accent: '#28b4ff' },
  cryo_vault: { bgTop: '#051420', bgBot: '#0a293d', grid: '#145a7a', accent: '#5cf2ff' },
  reactor_core: { bgTop: '#18081c', bgBot: '#2d0d2e', grid: '#6e1c5c', accent: '#ff4ad8' },
  bio_nexus: { bgTop: '#061a14', bgBot: '#0b2d22', grid: '#186349', accent: '#36ff9f' },
  gold_citadel: { bgTop: '#1a1204', bgBot: '#2e1f08', grid: '#6e4c12', accent: '#ffd23f' },
  doh_sanctum: { bgTop: '#1c0509', bgBot: '#330812', grid: '#781428', accent: '#ff2b4a' },
};

const MENU_LABELS = [
  '1P CAMPAIGN',
  '2P CO-OP (SIMULTANEOUS)',
  '2P ARCADE (ALTERNATING)',
  'BOSS RUSH',
  'XORG BREACH (ROGUELITE)',
  '64-STAGE SECTOR SELECT',
  'CONSTRUCTION SET EDITOR',
  'DIP-SWITCH SETTINGS',
];

export class GameRenderer {
  private ctx: CanvasRenderingContext2D;
  private stars: Star[];

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('2D canvas context unavailable');
    }
    this.ctx = ctx;
    this.stars = [];
    for (let i = 0; i < 85; i++) {
      this.stars.push({
        x: ((i * 7919) % 1000) / 1000,
        y: ((i * 6271) % 1000) / 1000,
        z: 0.35 + ((i * 3571) % 100) / 110,
        phase: (i * 0.71) % (Math.PI * 2),
      });
    }
  }

  public render(snap: RenderSnapshot, sectorNodes?: Iterable<SectorNode>): void {
    const ctx = this.ctx;
    ctx.save();

    // Outer cabinet backdrop
    ctx.fillStyle = '#040711';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Apply screen shake during active gameplay (already scaled by settings.screenShake in GameEngine)
    if (
      snap.screen === 'playing' ||
      snap.screen === 'stage_clear_warp' ||
      (snap.screen === 'attract' && snap.attractPage === 'demo')
    ) {
      ctx.translate(snap.shakeX, snap.shakeY);
    }

    // 1. Playfield background & XORG frame
    this.drawPlayfieldBackground(snap);
    this.drawWallsAndGates(snap);

    // 2. Gameplay entities
    const showBoard =
      snap.screen === 'playing' ||
      snap.screen === 'stage_clear_warp' ||
      snap.screen === 'paused' ||
      snap.screen === 'game_over' ||
      snap.screen === 'high_score_entry' ||
      (snap.screen === 'attract' && snap.attractPage === 'demo');

    if (showBoard) {
      this.drawBarrierFloor(snap);
      this.drawMovingRails(snap);
      this.drawBricks(snap);
      if (snap.boss) {
        this.drawBoss(snap.boss, snap);
      }
      this.drawLasers(snap);
      this.drawCapsules(snap);
      this.drawEnemies(snap.enemies, snap);
      this.drawPaddles(snap.paddles, snap);
      this.drawBalls(snap.balls, snap);
      this.drawEffects(snap);
      this.drawPlayfieldStatusBadges(snap);
      if (snap.isTouchDevice && (snap.screen === 'playing' || snap.screen === 'stage_clear_warp')) {
        this.drawTouchControlsBar(snap);
      }
    }

    // 3. Left & Right Arcade HUD Panels
    this.drawLeftHud(snap, sectorNodes);
    this.drawRightHud(snap);

    // 4. Screen-specific overlays
    if (snap.screen === 'attract') {
      this.drawAttractOverlay(snap);
    } else if (snap.screen === 'intro_story') {
      this.drawIntroStory(snap);
    } else if (snap.screen === 'sector_map') {
      this.drawSectorMap(snap, sectorNodes);
    } else if (snap.screen === 'augment_draft') {
      this.drawAugmentDraft(snap);
    } else if (snap.screen === 'paused') {
      this.drawPausedOverlay(snap);
    } else if (snap.screen === 'game_over') {
      this.drawGameOverOverlay(snap);
    } else if (snap.screen === 'victory') {
      this.drawVictoryOverlay(snap);
    } else if (snap.screen === 'high_score_entry') {
      this.drawHighScoreEntryOverlay(snap);
    }

    // 5. Stage banner & Rewind VHS effect
    if (snap.bannerTimer > 0 && snap.bannerText && snap.screen !== 'attract') {
      this.drawStageBanner(snap);
    }
    if (snap.rewindActive) {
      this.drawRewindOverlay(snap);
    }

    ctx.restore();
  }

  private drawPlayfieldBackground(snap: RenderSnapshot): void {
    const ctx = this.ctx;
    const theme = snap.stage.theme;
    const pal = THEME_PALETTES[theme];
    const t = snap.time;

    ctx.save();
    ctx.beginPath();
    ctx.rect(PLAYFIELD_X, PLAYFIELD_Y, PLAYFIELD_W, PLAYFIELD_H);
    ctx.clip();

    const grad = ctx.createLinearGradient(0, PLAYFIELD_Y, 0, PLAYFIELD_BOTTOM);
    grad.addColorStop(0, pal.bgTop);
    grad.addColorStop(1, pal.bgBot);
    ctx.fillStyle = grad;
    ctx.fillRect(PLAYFIELD_X, PLAYFIELD_Y, PLAYFIELD_W, PLAYFIELD_H);

    // Parallax starfield
    for (const s of this.stars) {
      const sy = PLAYFIELD_Y + ((s.y * PLAYFIELD_H + t * 18 * s.z) % PLAYFIELD_H);
      const sx = PLAYFIELD_X + s.x * PLAYFIELD_W;
      const alpha = 0.25 + 0.5 * (0.5 + 0.5 * Math.sin(t * 2.4 + s.phase));
      ctx.fillStyle = `rgba(210, 235, 255, ${alpha.toFixed(2)})`;
      const sz = s.z > 0.95 ? 2 : 1.3;
      ctx.fillRect(sx, sy, sz, sz);
    }

    // Theme-specific architectural backdrop pattern
    ctx.strokeStyle = pal.grid;
    ctx.lineWidth = 1;
    const pulse = 0.22 + 0.1 * Math.sin(t * 1.8);
    ctx.globalAlpha = pulse;

    if (theme === 'hull_breach') {
      const step = 36;
      const scroll = (t * 14) % step;
      for (let x = PLAYFIELD_X; x <= PLAYFIELD_RIGHT; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, PLAYFIELD_Y);
        ctx.lineTo(x, PLAYFIELD_BOTTOM);
        ctx.stroke();
      }
      for (let y = PLAYFIELD_Y + scroll; y <= PLAYFIELD_BOTTOM; y += step) {
        ctx.beginPath();
        ctx.moveTo(PLAYFIELD_X, y);
        ctx.lineTo(PLAYFIELD_RIGHT, y);
        ctx.stroke();
      }
    } else if (theme === 'cryo_vault') {
      const size = 44;
      for (let y = PLAYFIELD_Y + 20; y < PLAYFIELD_BOTTOM; y += size * 1.5) {
        for (let x = PLAYFIELD_X + 20; x < PLAYFIELD_RIGHT; x += size * 1.2) {
          ctx.beginPath();
          ctx.moveTo(x, y - 16);
          ctx.lineTo(x + 14, y);
          ctx.lineTo(x, y + 16);
          ctx.lineTo(x - 14, y);
          ctx.closePath();
          ctx.stroke();
        }
      }
    } else if (theme === 'reactor_core') {
      const cx = PLAYFIELD_X + PLAYFIELD_W * 0.5;
      const cy = PLAYFIELD_Y + PLAYFIELD_H * 0.42;
      for (let r = 40; r <= 340; r += 44) {
        const rr = r + ((t * 22) % 44);
        ctx.beginPath();
        ctx.arc(cx, cy, rr, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (theme === 'bio_nexus') {
      const cx = PLAYFIELD_X + PLAYFIELD_W * 0.5;
      for (let y = PLAYFIELD_Y + 28; y < PLAYFIELD_BOTTOM; y += 42) {
        const w = 130 + Math.sin(y * 0.03 + t * 1.5) * 45;
        ctx.beginPath();
        ctx.moveTo(cx - w, y);
        ctx.quadraticCurveTo(cx, y + 22, cx + w, y);
        ctx.stroke();
      }
    } else if (theme === 'gold_citadel') {
      const step = 48;
      for (let y = PLAYFIELD_Y; y < PLAYFIELD_BOTTOM; y += step) {
        for (let x = PLAYFIELD_X; x < PLAYFIELD_RIGHT; x += step) {
          ctx.strokeRect(x + 6, y + 6, step - 12, step - 12);
        }
      }
    } else {
      // doh_sanctum
      const cx = PLAYFIELD_X + PLAYFIELD_W * 0.5;
      const cy = PLAYFIELD_Y + 210;
      for (let i = 0; i < 12; i++) {
        const ang = (i / 12) * Math.PI * 2 + t * 0.15;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(ang) * 35, cy + Math.sin(ang) * 35);
        ctx.lineTo(cx + Math.cos(ang) * 360, cy + Math.sin(ang) * 360);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  private drawWallsAndGates(snap: RenderSnapshot): void {
    const ctx = this.ctx;
    const isNeon = snap.settings.visualPreset === 'hd_neon';
    const pal = THEME_PALETTES[snap.stage.theme];

    const leftWallX = PLAYFIELD_X - WALL_THICKNESS;
    const rightWallX = PLAYFIELD_RIGHT;
    const topWallY = PLAYFIELD_Y - WALL_THICKNESS;

    // Metallic pipe gradient for Left, Right, Top walls
    const drawMetallicSeg = (x: number, y: number, w: number, h: number, horiz: boolean) => {
      const g = horiz
        ? ctx.createLinearGradient(x, y, x, y + h)
        : ctx.createLinearGradient(x, y, x + w, y);
      g.addColorStop(0, '#3a465c');
      g.addColorStop(0.32, '#9fb3cc');
      g.addColorStop(0.55, '#d8e6f7');
      g.addColorStop(0.85, '#4b5a73');
      g.addColorStop(1, '#232c3d');
      ctx.fillStyle = g;
      ctx.fillRect(x, y, w, h);

      ctx.strokeStyle = isNeon ? pal.accent : '#6d829e';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    };

    // Top bar & corner caps
    drawMetallicSeg(leftWallX, topWallY, PLAYFIELD_W + WALL_THICKNESS * 2, WALL_THICKNESS, true);

    // Left wall (split around Left Warp Gate when open)
    drawMetallicSeg(leftWallX, PLAYFIELD_Y, WALL_THICKNESS, PLAYFIELD_H, false);
    // Right wall
    drawMetallicSeg(rightWallX, PLAYFIELD_Y, WALL_THICKNESS, PLAYFIELD_H, false);

    // Rivet notches along side walls
    ctx.fillStyle = '#1b2230';
    for (let y = PLAYFIELD_Y + 18; y < PLAYFIELD_BOTTOM - 16; y += 36) {
      ctx.fillRect(leftWallX + 4, y, WALL_THICKNESS - 8, 5);
      ctx.fillRect(rightWallX + 4, y, WALL_THICKNESS - 8, 5);
    }

    // Top Enemy Iris Hatches
    this.drawIrisHatch(HATCH_LEFT_X, topWallY, snap.hatchLeftOpen, pal.accent);
    this.drawIrisHatch(HATCH_RIGHT_X, topWallY, snap.hatchRightOpen, pal.accent);

    // Left & Right Warp Gates with next-sector destination previews
    this.drawWarpGate(
      leftWallX,
      WARP_GATE_Y,
      WALL_THICKNESS,
      WARP_GATE_H,
      snap.warpLeftOpen,
      'left',
      snap.time,
      snap.warpLeftLabel
    );
    this.drawWarpGate(
      rightWallX,
      WARP_GATE_Y,
      WALL_THICKNESS,
      WARP_GATE_H,
      snap.warpRightOpen,
      'right',
      snap.time,
      snap.warpRightLabel
    );

    // Bonus Break Warp on Right Wall
    if (snap.bonusWarpOpen > 0.05) {
      this.drawBonusWarp(rightWallX, BONUS_WARP_Y, WALL_THICKNESS, BONUS_WARP_H, snap.bonusWarpOpen, snap.time);
    }

    // Top stage header strip above the top wall
    ctx.fillStyle = '#a8c7ff';
    ctx.font = 'bold 12px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(
      `SECTOR ${snap.stage.branchLabel} • ${snap.stage.name}${snap.loopNumber > 1 ? ` [LOOP ${snap.loopNumber}]` : ''}`,
      PLAYFIELD_X + PLAYFIELD_W * 0.5,
      23
    );
  }

  private drawIrisHatch(centerX: number, topY: number, openAmt: number, accent: string): void {
    const ctx = this.ctx;
    const w = 44;
    const x = centerX - w * 0.5;
    ctx.fillStyle = '#131926';
    ctx.fillRect(x, topY + 2, w, WALL_THICKNESS - 4);
    ctx.strokeStyle = '#7389a8';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, topY + 2, w, WALL_THICKNESS - 4);

    if (openAmt > 0.05) {
      const gap = (w * 0.5 - 3) * openAmt;
      ctx.fillStyle = '#050810';
      ctx.fillRect(centerX - gap, topY + 3, gap * 2, WALL_THICKNESS - 6);
      ctx.fillStyle = accent;
      ctx.globalAlpha = 0.45 * openAmt;
      ctx.fillRect(centerX - gap, topY + WALL_THICKNESS - 5, gap * 2, 4);
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = '#5c6f8c';
      ctx.fillRect(x + 3, topY + 5, w * 0.5 - 4, WALL_THICKNESS - 10);
      ctx.fillRect(centerX + 1, topY + 5, w * 0.5 - 4, WALL_THICKNESS - 10);
    }
  }

  private drawWarpGate(
    wallX: number,
    gateY: number,
    wallW: number,
    gateH: number,
    openAmt: number,
    side: 'left' | 'right',
    time: number,
    destLabel: string | null
  ): void {
    const ctx = this.ctx;
    if (openAmt <= 0.05) {
      // Closed shutter groove
      ctx.fillStyle = '#252f42';
      ctx.fillRect(wallX + 3, gateY, wallW - 6, gateH);
      ctx.strokeStyle = '#556885';
      ctx.strokeRect(wallX + 3, gateY, wallW - 6, gateH);
      return;
    }

    const pulse = 0.65 + 0.35 * Math.sin(time * 9);
    const col = side === 'left' ? '#24e0ff' : '#ff5ce6';
    ctx.save();
    ctx.fillStyle = '#040812';
    ctx.fillRect(wallX, gateY, wallW, gateH);

    // Energy portal shimmer
    const grad = ctx.createLinearGradient(wallX, gateY, wallX + wallW, gateY);
    grad.addColorStop(0, side === 'left' ? `rgba(36, 224, 255, ${0.9 * pulse})` : 'rgba(255, 92, 230, 0.25)');
    grad.addColorStop(1, side === 'right' ? `rgba(255, 92, 230, ${0.9 * pulse})` : 'rgba(36, 224, 255, 0.25)');
    ctx.fillStyle = grad;
    ctx.fillRect(wallX + 2, gateY + 2, wallW - 4, gateH - 4);

    // Holo label + destination preview inside playfield edge
    ctx.font = 'bold 11px "Courier New", monospace';
    ctx.fillStyle = col;
    ctx.textAlign = side === 'left' ? 'left' : 'right';
    const tx = side === 'left' ? PLAYFIELD_X + 8 : PLAYFIELD_RIGHT - 8;
    ctx.fillText(side === 'left' ? '◄ L-WARP' : 'R-WARP ►', tx, gateY + gateH * 0.5 - 3);
    if (destLabel) {
      ctx.fillStyle = '#e8f4ff';
      ctx.font = 'bold 9px "Courier New", monospace';
      ctx.fillText(destLabel.slice(0, 22), tx, gateY + gateH * 0.5 + 11);
    }
    ctx.restore();
  }

  private drawBonusWarp(
    wallX: number,
    gateY: number,
    wallW: number,
    gateH: number,
    openAmt: number,
    time: number
  ): void {
    const ctx = this.ctx;
    const pulse = 0.65 + 0.35 * Math.sin(time * 12);
    ctx.save();
    ctx.fillStyle = `rgba(235, 56, 255, ${0.85 * openAmt * pulse})`;
    ctx.fillRect(wallX + 1, gateY, wallW - 2, gateH);
    ctx.font = 'bold 11px "Courier New", monospace';
    ctx.fillStyle = '#ffb8ff';
    ctx.textAlign = 'right';
    ctx.fillText('10,000 BREAK ►', PLAYFIELD_RIGHT - 8, gateY + gateH * 0.5 + 4);
    ctx.restore();
  }

  private drawBarrierFloor(snap: RenderSnapshot): void {
    if (snap.barrierHits <= 0) return;
    const ctx = this.ctx;
    const y = VAUS_Y + 22;
    const pulse = 0.7 + 0.3 * Math.sin(snap.time * 10);

    ctx.save();
    ctx.strokeStyle = snap.barrierHits >= 2 ? `rgba(60, 240, 255, ${pulse})` : `rgba(255, 200, 60, ${pulse})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(PLAYFIELD_X, y);
    ctx.lineTo(PLAYFIELD_RIGHT, y);
    ctx.stroke();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(PLAYFIELD_X, y);
    ctx.lineTo(PLAYFIELD_RIGHT, y);
    ctx.stroke();

    ctx.fillStyle = '#d4f8ff';
    ctx.font = 'bold 10px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`ENERGY BARRIER x${snap.barrierHits}`, PLAYFIELD_X + PLAYFIELD_W * 0.5, y + 12);
    ctx.restore();
  }

  private drawMovingRails(snap: RenderSnapshot): void {
    const ctx = this.ctx;
    ctx.save();
    for (const b of snap.bricks) {
      if (!b.moving) continue;
      const cy = b.y + b.h * 0.5;
      ctx.strokeStyle = 'rgba(130, 200, 255, 0.25)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(b.moving.minX + 4, cy);
      ctx.lineTo(b.moving.maxX - 4, cy);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  private drawBricks(snap: RenderSnapshot): void {
    const ctx = this.ctx;
    const isNeon = snap.settings.visualPreset === 'hd_neon';
    const cb = snap.settings.colorblindSymbols;

    for (const b of snap.bricks) {
      const palette = BRICK_COLORS[b.kind];

      // Ghostly holographic reconstitution outline for destroyed regenerating bricks
      if (!b.alive) {
        if (b.kind === 'regen' && b.regenTimer > 0) {
          const progress = Math.max(0, Math.min(1, 1 - b.regenTimer / 6.0));
          const flicker = 0.35 + 0.35 * Math.sin(snap.time * 18 + b.shimmerPhase);
          ctx.save();
          ctx.strokeStyle = `rgba(125, 225, 255, ${flicker * (0.4 + progress * 0.6)})`;
          ctx.lineWidth = 1.5;
          ctx.setLineDash([3, 3]);
          ctx.strokeRect(b.x + 2, b.y + 2, b.w - 4, b.h - 4);
          ctx.setLineDash([]);
          ctx.fillStyle = `rgba(110, 210, 255, ${0.22 * progress})`;
          ctx.fillRect(b.x + 3, b.y + 3, (b.w - 6) * progress, b.h - 6);
          ctx.restore();
        }
        continue;
      }

      const bx = b.x + 1;
      const by = b.y + 1;
      const bw = b.w - 2;
      const bh = b.h - 2;

      if (isNeon) {
        const g = ctx.createLinearGradient(bx, by, bx, by + bh);
        g.addColorStop(0, palette.light);
        g.addColorStop(0.28, palette.fill);
        g.addColorStop(1, palette.dark);
        ctx.fillStyle = g;
        ctx.fillRect(bx, by, bw, bh);

        ctx.strokeStyle = palette.light;
        ctx.lineWidth = 1;
        ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
      } else {
        // Classic 1987 3D Beveled Arcade Brick
        ctx.fillStyle = palette.fill;
        ctx.fillRect(bx, by, bw, bh);
        ctx.fillStyle = palette.light;
        ctx.fillRect(bx, by, bw, 2.5);
        ctx.fillRect(bx, by, 2.5, bh);
        ctx.fillStyle = palette.dark;
        ctx.fillRect(bx, by + bh - 2.5, bw, 2.5);
        ctx.fillRect(bx + bw - 2.5, by, 2.5, bh);
      }

      // Metallic sweep on Silver & Gold
      if (b.kind === 'silver' || b.kind === 'gold') {
        const sweep = ((snap.time * 1.1 + b.shimmerPhase) % 3.2) / 3.2;
        if (sweep < 0.35) {
          const sx = bx + (sweep / 0.35) * bw;
          ctx.save();
          ctx.beginPath();
          ctx.rect(bx, by, bw, bh);
          ctx.clip();
          ctx.fillStyle = b.kind === 'gold' ? 'rgba(255, 255, 220, 0.55)' : 'rgba(255, 255, 255, 0.45)';
          ctx.beginPath();
          ctx.moveTo(sx - 6, by);
          ctx.lineTo(sx + 2, by);
          ctx.lineTo(sx - 6, by + bh);
          ctx.lineTo(sx - 14, by + bh);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      }

      // Gold brick Hyper-Pierce overload glow & stress fractures
      if (b.kind === 'gold' && (b.goldLaserHits ?? 0) > 0) {
        const ratio = Math.min(1, (b.goldLaserHits ?? 0) / 6);
        ctx.fillStyle = `rgba(255, 90, 220, ${0.18 + ratio * 0.42})`;
        ctx.fillRect(bx, by, bw, bh);
        ctx.strokeStyle = '#fff5b8';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(bx + 6, by + 2);
        ctx.lineTo(bx + bw * 0.5, by + bh * 0.55);
        ctx.lineTo(bx + bw - 6, by + bh - 2);
        ctx.stroke();
      }

      // Silver damage cracks
      if (b.kind === 'silver' && b.hp < b.maxHp) {
        ctx.strokeStyle = '#202b38';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(bx + 7, by + 3);
        ctx.lineTo(bx + 15, by + 9);
        ctx.lineTo(bx + 11, by + bh - 2);
        if (b.hp <= 1) {
          ctx.moveTo(bx + 26, by + 3);
          ctx.lineTo(bx + 20, by + 11);
          ctx.lineTo(bx + 28, by + bh - 3);
        }
        ctx.stroke();
      }

      // Regenerating Notched Silver rivets + X notch
      if (b.kind === 'regen') {
        ctx.fillStyle = '#182433';
        ctx.fillRect(bx + 3, by + 3, 3, 3);
        ctx.fillRect(bx + bw - 6, by + 3, 3, 3);
        ctx.fillRect(bx + 3, by + bh - 6, 3, 3);
        ctx.fillRect(bx + bw - 6, by + bh - 6, 3, 3);
        ctx.strokeStyle = b.hp < b.maxHp ? '#7af5ff' : '#25354a';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(bx + 9, by + 4);
        ctx.lineTo(bx + bw - 9, by + bh - 4);
        ctx.moveTo(bx + bw - 9, by + 4);
        ctx.lineTo(bx + 9, by + bh - 4);
        ctx.stroke();
      }

      // Hit flash overlay
      if (b.hitFlash > 0.02) {
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(0.85, b.hitFlash)})`;
        ctx.fillRect(bx, by, bw, bh);
      }

      // Colorblind high-contrast geometric symbol
      if (cb) {
        ctx.fillStyle = b.kind === 'white' || b.kind === 'yellow' ? '#101824' : '#ffffff';
        ctx.font = 'bold 10px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(palette.symbol, bx + bw * 0.5, by + bh * 0.5 + 3.5);
      }
    }
  }

  private drawPaddles(paddles: VausState[], snap: RenderSnapshot): void {
    const ctx = this.ctx;

    // Repulsor EMP Wave
    if (snap.repulsorWave) {
      ctx.save();
      ctx.strokeStyle = `rgba(150, 235, 255, ${snap.repulsorWave.alpha})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(snap.repulsorWave.x, snap.repulsorWave.y, snap.repulsorWave.radius, Math.PI, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    for (const v of paddles) {
      // 1. Illusion ghost after-images
      for (const ill of v.illusions) {
        const a = Math.max(0, (ill.ttl / ill.maxTtl) * 0.45);
        ctx.save();
        ctx.fillStyle = `rgba(44, 242, 169, ${a})`;
        ctx.strokeStyle = `rgba(210, 255, 240, ${a * 1.4})`;
        ctx.lineWidth = 1.5;
        this.roundRect(ill.x - ill.w * 0.5, ill.y - ill.h * 0.5, ill.w, ill.h, 6);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      // Magnetic Curve field lines
      if (snap.magneticActive !== 0 && v.playerIndex === 0) {
        ctx.save();
        const col = snap.magneticActive > 0 ? 'rgba(60, 255, 190, 0.45)' : 'rgba(255, 130, 80, 0.45)';
        ctx.strokeStyle = col;
        ctx.lineWidth = 1.5;
        for (let r = 1; r <= 3; r++) {
          const rad = 22 + r * 14 + ((snap.time * 40) % 14);
          ctx.beginPath();
          ctx.arc(v.x, v.y - 4, rad, Math.PI * 1.15, Math.PI * 1.85);
          ctx.stroke();
        }
        ctx.restore();
      }

      if (v.twinActive) {
        const gap = 8;
        const podW = (v.w - gap) * 0.5;
        // Center Energy Bridge
        ctx.fillStyle = '#18d8f5';
        ctx.fillRect(v.x - gap * 0.5 - 2, v.y - 2, gap + 4, 4);
        this.drawSingleVausHull(v, v.x - gap * 0.5 - podW * 0.5, v.y, podW, v.h, snap.time);
        this.drawSingleVausHull(v, v.x + gap * 0.5 + podW * 0.5, v.y, podW, v.h, snap.time);
      } else {
        this.drawSingleVausHull(v, v.x, v.y, v.w, v.h, snap.time);
      }

      // Mercy Shield Bubble
      if (v.mercyShieldTimer > 0) {
        const pulse = 0.5 + 0.5 * Math.sin(snap.time * 14);
        ctx.save();
        ctx.strokeStyle = `rgba(110, 240, 255, ${0.4 + 0.4 * pulse})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(v.x, v.y, v.w * 0.58, v.h * 1.2, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Stun electric sparks
      if (v.stunTimer > 0) {
        ctx.save();
        ctx.strokeStyle = '#fff36b';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const px = v.x - v.w * 0.45 + (i / 5) * v.w * 0.9;
          const py = v.y + (Math.sin(snap.time * 45 + i * 2.1) * 9);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.restore();
      }

      // 2X Reduce badge
      if (v.reduced) {
        ctx.save();
        ctx.fillStyle = '#ffe033';
        ctx.font = 'bold 10px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('2X', v.x, v.y + 18);
        ctx.restore();
      }
    }
  }

  private drawSingleVausHull(
    v: VausState,
    cx: number,
    cy: number,
    w: number,
    h: number,
    time: number
  ): void {
    const ctx = this.ctx;
    const left = cx - w * 0.5;
    const top = cy - h * 0.5;
    const tipW = Math.min(13, w * 0.22);

    ctx.save();
    // Main metallic cylinder body
    const bodyG = ctx.createLinearGradient(left, top, left, top + h);
    bodyG.addColorStop(0, '#eef5ff');
    bodyG.addColorStop(0.45, '#9cb2cc');
    bodyG.addColorStop(1, '#3b4a61');
    ctx.fillStyle = bodyG;
    this.roundRect(left, top, w, h, 6);
    ctx.fill();

    // Red (P1) or Cyan-Gold (P2) side thrusters
    const tipCol = v.playerIndex === 0 ? '#ff2b4a' : '#00d8ff';
    const tipHi = v.playerIndex === 0 ? '#ff99a8' : '#b8f7ff';
    const drawTip = (tx: number) => {
      const tg = ctx.createLinearGradient(tx, top, tx, top + h);
      tg.addColorStop(0, tipHi);
      tg.addColorStop(0.5, tipCol);
      tg.addColorStop(1, '#520a18');
      ctx.fillStyle = tg;
      this.roundRect(tx, top, tipW, h, 4);
      ctx.fill();
    };
    drawTip(left);
    drawTip(left + w - tipW);

    // Center cockpit core
    ctx.fillStyle = v.catchActive ? '#22ff6b' : v.laserLevel > 0 ? '#ff4766' : '#33b5ff';
    ctx.fillRect(cx - 8, top + 3, 16, h - 6);

    // Laser Cannons
    if (v.laserLevel > 0) {
      const offset = Math.max(8, w * 0.32);
      const isHyper = v.laserLevel >= 2;
      ctx.fillStyle = isHyper ? '#ffd94a' : '#ff4d6d';
      ctx.fillRect(cx - offset - 2, top - 6, 4, 7);
      ctx.fillRect(cx + offset - 2, top - 6, 4, 7);
      if (v.muzzleFlash > 0.05) {
        ctx.fillStyle = `rgba(255, 250, 180, ${v.muzzleFlash})`;
        ctx.beginPath();
        ctx.arc(cx - offset, top - 7, 5 * v.muzzleFlash, 0, Math.PI * 2);
        ctx.arc(cx + offset, top - 7, 5 * v.muzzleFlash, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Catch magnetic energy arc
    if (v.catchActive) {
      const glow = 0.55 + 0.45 * Math.sin(time * 12);
      ctx.strokeStyle = `rgba(45, 255, 115, ${glow})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(left + tipW, top - 2);
      ctx.lineTo(left + w - tipW, top - 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  private drawBalls(balls: BallState[], snap: RenderSnapshot): void {
    const ctx = this.ctx;
    for (const b of balls) {
      // Motion ribbon trail
      if (b.trail.length > 1) {
        for (let i = 0; i < b.trail.length; i++) {
          const pt = b.trail[i];
          const frac = (i + 1) / b.trail.length;
          ctx.fillStyle = b.mega
            ? `rgba(255, 196, 45, ${frac * 0.42})`
            : `rgba(80, 225, 255, ${frac * 0.35})`;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, b.radius * frac * 0.9, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Aim guide when caught in Evolved mode
      if (b.caughtBy !== null && snap.settings.ruleset === 'evolved') {
        const len = 62;
        const norm = Math.hypot(b.vx, b.vy) || 1;
        const dx = b.vx / norm;
        const dy = b.vy / norm;
        ctx.save();
        ctx.strokeStyle = 'rgba(130, 255, 180, 0.7)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(b.x + dx * len, b.y + dy * len);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      ctx.save();
      if (b.mega) {
        // Mega Ball blazing plasma orb
        const pulse = 1 + 0.18 * Math.sin(snap.time * 24);
        const aura = ctx.createRadialGradient(b.x, b.y, 1, b.x, b.y, b.radius * 2.4 * pulse);
        aura.addColorStop(0, '#fff7bd');
        aura.addColorStop(0.45, '#ffae19');
        aura.addColorStop(0.8, 'rgba(162, 56, 255, 0.65)');
        aura.addColorStop(1, 'rgba(162, 56, 255, 0)');
        ctx.fillStyle = aura;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius * 2.4 * pulse, 0, Math.PI * 2);
        ctx.fill();
      }

      const g = ctx.createRadialGradient(b.x - 1.8, b.y - 1.8, 0.5, b.x, b.y, b.radius);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.55, b.mega ? '#ffe26a' : '#8ceeff');
      g.addColorStop(1, b.mega ? '#b624ff' : '#1b78d6');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private drawLasers(snap: RenderSnapshot): void {
    const ctx = this.ctx;
    for (const l of snap.lasers) {
      if (!l.alive) continue;
      ctx.save();
      ctx.fillStyle = l.hyper ? '#ffe66d' : '#ff3d5a';
      ctx.fillRect(l.x - (l.hyper ? 2.5 : 1.8), l.y - 8, l.hyper ? 5 : 3.6, 14);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(l.x - 0.8, l.y - 7, 1.6, 12);
      ctx.restore();
    }
  }

  private drawCapsules(snap: RenderSnapshot): void {
    const ctx = this.ctx;
    const cb = snap.settings.colorblindSymbols;
    for (const cap of snap.capsules) {
      if (!cap.alive) continue;
      this.drawSingleCapsule(cap.x, cap.y, cap.type, cap.phase, snap.time, cb);
    }
  }

  private drawSingleCapsule(
    x: number,
    y: number,
    type: CapsuleType,
    phase: number,
    time: number,
    colorblind: boolean
  ): void {
    const ctx = this.ctx;
    const meta = CAPSULE_META[type];
    const w = 28;
    const h = 14;
    const rx = x - w * 0.5;
    const ry = y - h * 0.5;

    ctx.save();
    let mainColor = meta.color;
    let accentColor = meta.accent;
    if (type === '?') {
      const hue = (time * 320 + phase * 60) % 360;
      mainColor = `hsl(${hue}, 92%, 55%)`;
      accentColor = '#ffffff';
    } else if (type === 'G') {
      const pulse = 0.6 + 0.4 * Math.sin(time * 12);
      ctx.strokeStyle = `rgba(255, 240, 130, ${pulse})`;
      ctx.lineWidth = 2.5;
      this.roundRect(rx - 2, ry - 2, w + 4, h + 4, 8);
      ctx.stroke();
    } else if (type === 'R') {
      const warn = 0.5 + 0.5 * Math.sin(time * 16);
      ctx.strokeStyle = `rgba(255, 50, 50, ${warn})`;
      ctx.lineWidth = 2.2;
      this.roundRect(rx - 2, ry - 2, w + 4, h + 4, 8);
      ctx.stroke();
    }

    // 3D Cylindrical Pill Body
    const bandShift = Math.sin(phase + time * 5) * 0.35;
    const g = ctx.createLinearGradient(rx, ry, rx, ry + h);
    g.addColorStop(0, '#1a202c');
    g.addColorStop(Math.max(0.1, 0.35 + bandShift * 0.2), mainColor);
    g.addColorStop(0.5, accentColor);
    g.addColorStop(Math.min(0.9, 0.72 + bandShift * 0.2), mainColor);
    g.addColorStop(1, '#0d111a');
    ctx.fillStyle = g;
    this.roundRect(rx, ry, w, h, 7);
    ctx.fill();

    // Metallic end caps
    ctx.fillStyle = '#dce6f2';
    ctx.fillRect(rx + 1, ry + 3, 3, h - 6);
    ctx.fillRect(rx + w - 4, ry + 3, 3, h - 6);

    if (colorblind && type === 'R') {
      ctx.strokeStyle = '#ff3838';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(rx + 4, ry + 1);
      ctx.lineTo(rx + 8, ry + h - 1);
      ctx.moveTo(rx + w - 8, ry + 1);
      ctx.lineTo(rx + w - 4, ry + h - 1);
      ctx.stroke();
    }

    ctx.fillStyle = '#070a12';
    ctx.font = 'bold 11px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(type, x + 0.8, y + 4.3);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(type, x, y + 3.8);
    ctx.restore();
  }

  private drawEnemies(enemies: EnemyEntity[], snap: RenderSnapshot): void {
    const ctx = this.ctx;
    for (const e of enemies) {
      if (!e.alive) continue;
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(e.phase * 1.4);
      const r = e.radius;

      if (e.kind === 'pyramid') {
        ctx.fillStyle = '#ff6b3d';
        ctx.strokeStyle = '#ffd1a3';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, -r);
        ctx.lineTo(r * 0.9, r * 0.8);
        ctx.lineTo(-r * 0.9, r * 0.8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (e.kind === 'trisphere') {
        ctx.fillStyle = '#29e3ff';
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI * 2;
          ctx.beginPath();
          ctx.arc(Math.cos(a) * r * 0.45, Math.sin(a) * r * 0.45, r * 0.48, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (e.kind === 'splitter') {
        ctx.fillStyle = e.mini ? '#ff91f8' : '#d62eff';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(0, -r);
        ctx.lineTo(r, 0);
        ctx.lineTo(0, r);
        ctx.lineTo(-r, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (e.kind === 'builder') {
        ctx.fillStyle = '#3cff8f';
        ctx.strokeStyle = '#d4ffe8';
        ctx.lineWidth = 1.5;
        ctx.fillRect(-r * 0.75, -r * 0.75, r * 1.5, r * 1.5);
        ctx.strokeRect(-r * 0.75, -r * 0.75, r * 1.5, r * 1.5);
      } else {
        // gold_critter
        const pulse = 0.7 + 0.3 * Math.sin(snap.time * 16 + e.phase);
        ctx.fillStyle = `rgba(255, 224, 60, ${pulse})`;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.85, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  private drawBoss(boss: BossState, snap: RenderSnapshot): void {
    const ctx = this.ctx;
    ctx.save();

    const flash = boss.hitFlash > 0.05;

    if (boss.kind === 'suirei') {
      // Orbiting cellular shields
      for (const orb of boss.orbiters) {
        const ox = boss.x + Math.cos(orb.angle) * orb.dist;
        const oy = boss.y + Math.sin(orb.angle) * orb.dist;
        if (!orb.alive) {
          ctx.strokeStyle = 'rgba(210, 120, 255, 0.3)';
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.arc(ox, oy, orb.radius, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
          continue;
        }
        ctx.fillStyle = '#a238ff';
        ctx.strokeStyle = '#f0b8ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(ox, oy, orb.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      // Bioluminescent brain hemispheres
      const pulse = 1 + 0.04 * Math.sin(boss.animTime * 6);
      ctx.save();
      ctx.translate(boss.x, boss.y);
      ctx.scale(pulse, pulse);
      ctx.fillStyle = flash ? '#ffffff' : '#c93bff';
      ctx.strokeStyle = '#ff99f5';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(-20, 0, 28, 36, -0.12, 0, Math.PI * 2);
      ctx.ellipse(20, 0, 28, 36, 0.12, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Brain folds
      ctx.strokeStyle = '#68128a';
      ctx.lineWidth = 2;
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.arc(-18, i * 11, 12, 0.2, Math.PI - 0.2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(18, i * 11, 12, 0.2, Math.PI - 0.2);
        ctx.stroke();
      }

      // Central Cortex Synapse + Shield Barrier when closed
      ctx.fillStyle = boss.coreOpen ? '#4afff6' : '#3d2252';
      ctx.beginPath();
      ctx.arc(0, 6, boss.coreOpen ? 14 : 10, 0, Math.PI * 2);
      ctx.fill();
      if (!boss.coreOpen && !boss.defeated) {
        ctx.strokeStyle = 'rgba(130, 225, 255, 0.85)';
        ctx.lineWidth = 3;
        ctx.setLineDash([7, 4]);
        ctx.beginPath();
        ctx.ellipse(0, 0, 54, 46, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.restore();
    } else if (boss.kind === 'sentinel') {
      // Rotating Gold & Silver shield plates
      for (const orb of boss.orbiters) {
        const ox = boss.x + Math.cos(orb.angle) * orb.dist;
        const oy = boss.y + Math.sin(orb.angle) * orb.dist;
        if (!orb.alive) {
          ctx.strokeStyle = 'rgba(180, 220, 255, 0.28)';
          ctx.strokeRect(ox - orb.radius, oy - orb.radius, orb.radius * 2, orb.radius * 2);
          continue;
        }
        ctx.fillStyle = orb.gold ? '#f5b81d' : '#9eb0c7';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.8;
        ctx.fillRect(ox - orb.radius, oy - orb.radius, orb.radius * 2, orb.radius * 2);
        ctx.strokeRect(ox - orb.radius, oy - orb.radius, orb.radius * 2, orb.radius * 2);
      }

      // Armored Octagonal Mechanical Core
      ctx.save();
      ctx.translate(boss.x, boss.y);
      ctx.fillStyle = flash ? '#ffffff' : '#4a5a73';
      ctx.strokeStyle = '#d4e4ff';
      ctx.lineWidth = 3;
      const r = 44;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Scanning cyclops optic eye
      const eyeOffsetX = Math.sin(boss.animTime * 2.4) * 14;
      ctx.fillStyle = '#0e131c';
      ctx.fillRect(-26, -12, 52, 24);
      ctx.fillStyle = boss.coreOpen ? '#ff3355' : '#662233';
      ctx.beginPath();
      ctx.arc(eyeOffsetX, 0, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(eyeOffsetX - 3, -3, 3, 0, Math.PI * 2);
      ctx.fill();
      if (!boss.coreOpen && !boss.defeated) {
        ctx.strokeStyle = 'rgba(255, 212, 70, 0.9)';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(0, 0, 50, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    } else if (boss.kind === 'doh') {
      if (boss.phase === 1) {
        // Towering Chiseled Moai Statue
        const dmgRatio = 1 - boss.hp / Math.max(1, boss.maxHp);
        const baseCol = flash
          ? '#ffffff'
          : dmgRatio > 0.6
            ? '#b8324a'
            : dmgRatio > 0.3
              ? '#c47933'
              : '#b59d6b';
        const darkCol = dmgRatio > 0.6 ? '#5e1120' : '#5e4b2a';

        ctx.save();
        ctx.translate(boss.x, boss.y);
        // Outer stone silhouette
        ctx.fillStyle = baseCol;
        ctx.strokeStyle = '#fff0c4';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(-42, -74);
        ctx.lineTo(42, -74);
        ctx.lineTo(56, 20);
        ctx.lineTo(44, 74);
        ctx.lineTo(-44, 74);
        ctx.lineTo(-56, 20);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Brow ridge
        ctx.fillStyle = darkCol;
        ctx.fillRect(-44, -36, 88, 12);
        // Glowing eyes
        ctx.fillStyle = '#ff2949';
        ctx.fillRect(-30, -24, 18, 12);
        ctx.fillRect(12, -24, 18, 12);
        // Nose ridge
        ctx.fillStyle = darkCol;
        ctx.fillRect(-10, -22, 20, 44);
        // Mouth (opens when about to attack)
        const mouthOpen = boss.attackTimer < 0.45 ? 18 : 8;
        ctx.fillStyle = '#180408';
        ctx.fillRect(-26, 36, 52, mouthOpen);
        if (boss.attackTimer < 0.45) {
          ctx.fillStyle = '#ff8833';
          ctx.fillRect(-18, 39, 36, mouthOpen - 6);
        }
        ctx.restore();
      } else {
        // Phase 2: Mutated Bio-Leviathan with Articulated Tentacles!
        for (const tent of boss.tentacles) {
          let prevX = boss.x;
          let prevY = boss.y + 18;
          for (const seg of tent.segments) {
            if (seg.alive) {
              ctx.strokeStyle = '#7e2299';
              ctx.lineWidth = 6;
              ctx.beginPath();
              ctx.moveTo(prevX, prevY);
              ctx.lineTo(seg.x, seg.y);
              ctx.stroke();

              ctx.fillStyle = seg.hp < seg.maxHp ? '#ff70a6' : '#c736ff';
              ctx.strokeStyle = '#ffd1ff';
              ctx.lineWidth = 1.5;
              ctx.beginPath();
              ctx.arc(seg.x, seg.y, seg.radius, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();
            } else {
              // Ghostly regrowth ring
              ctx.strokeStyle = 'rgba(200, 120, 255, 0.35)';
              ctx.lineWidth = 1.2;
              ctx.setLineDash([3, 3]);
              ctx.beginPath();
              ctx.arc(seg.x, seg.y, seg.radius * 0.85, 0, Math.PI * 2);
              ctx.stroke();
              ctx.setLineDash([]);
            }
            prevX = seg.x;
            prevY = seg.y;
          }
        }

        // Pulsing Biomechanical Heart Core
        const beat = 1 + 0.08 * Math.sin(boss.animTime * 9);
        ctx.save();
        ctx.translate(boss.x, boss.y);
        ctx.scale(beat, beat);
        ctx.fillStyle = flash ? '#ffffff' : '#ff1f4c';
        ctx.strokeStyle = '#ffbfd4';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 48, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffe14d';
        ctx.beginPath();
        ctx.arc(0, 0, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // Boss Projectiles
    for (const p of boss.projectiles) {
      if (!p.alive) continue;
      if (p.kind === 'fireball') {
        ctx.fillStyle = '#ff6a1a';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff59c';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * 0.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'ion_ring') {
        ctx.strokeStyle = '#33e6ff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.kind === 'psy_wave') {
        ctx.strokeStyle = '#ee5cff';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = '#5cff88';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Overhead Boss HP Bar
    const barW = 320;
    const barH = 10;
    const bx = PLAYFIELD_X + (PLAYFIELD_W - barW) * 0.5;
    const by = PLAYFIELD_Y + 8;
    const ratio = Math.max(0, Math.min(1, boss.hp / Math.max(1, boss.maxHp)));

    const title =
      boss.kind === 'suirei'
        ? 'SECTOR 17L GUARDIAN: SUIREI'
        : boss.kind === 'sentinel'
          ? 'SECTOR 17R GUARDIAN: ARK-SENTINEL'
          : boss.phase === 1
            ? 'DIMENSION OVERLORD: DOH'
            : 'TRUE FORM: MUTATED DOH';

    ctx.fillStyle = 'rgba(8, 12, 24, 0.82)';
    ctx.fillRect(bx - 4, by - 2, barW + 8, 28);
    ctx.fillStyle = '#ff3859';
    ctx.fillRect(bx, by + 13, barW * ratio, barH);
    ctx.strokeStyle = '#e6f0ff';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by + 13, barW, barH);

    const stateTag =
      boss.defeated
        ? 'CRITICAL FAILURE!'
        : boss.kind === 'suirei' || boss.kind === 'sentinel'
          ? boss.coreOpen
            ? 'CORE OPEN'
            : 'SHIELDED'
          : `${Math.ceil(boss.hp)}/${boss.maxHp}`;

    ctx.fillStyle =
      boss.kind === 'suirei' || boss.kind === 'sentinel'
        ? boss.coreOpen
          ? '#66ffba'
          : '#ffaa55'
        : '#ffe38f';
    ctx.font = 'bold 10px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${title} • ${stateTag}`, PLAYFIELD_X + PLAYFIELD_W * 0.5, by + 9);

    ctx.restore();
    void snap;
  }

  private drawEffects(snap: RenderSnapshot): void {
    const ctx = this.ctx;

    // MIXTEC Orbital Strike Beam (Stalemate Breaker)
    if (snap.orbitalStrikeFx) {
      const fx = snap.orbitalStrikeFx;
      ctx.save();
      ctx.fillStyle = `rgba(60, 235, 255, ${fx.alpha * 0.55})`;
      ctx.fillRect(fx.x - 14, PLAYFIELD_Y, 28, fx.y - PLAYFIELD_Y);
      ctx.fillStyle = `rgba(255, 255, 255, ${fx.alpha})`;
      ctx.fillRect(fx.x - 4, PLAYFIELD_Y, 8, fx.y - PLAYFIELD_Y);
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, 26 * fx.alpha, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Particles (sparks & rotating brick shards)
    for (const p of snap.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, p.alpha));
      ctx.fillStyle = p.color;
      if (p.shard) {
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot ?? 0);
        ctx.fillRect(-p.size, -p.size * 0.55, p.size * 2, p.size * 1.1);
      } else {
        ctx.fillRect(p.x - p.size * 0.5, p.y - p.size * 0.5, p.size, p.size);
      }
      ctx.restore();
    }

    // Floating score / status texts
    for (const ft of snap.floatingTexts) {
      const alpha = Math.max(0, Math.min(1, ft.life / ft.maxLife));
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#050810';
      ctx.font = `bold ${Math.round(12 * ft.scale)}px "Courier New", monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(ft.text, ft.x + 1, ft.y + 1);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }
  }

  private drawPlayfieldStatusBadges(snap: RenderSnapshot): void {
    const ctx = this.ctx;
    const isReduced = snap.paddles.some((p) => p.reduced);
    const hasCombo = snap.settings.ruleset === 'evolved' && snap.activeCombo >= 2;

    if (!isReduced && !hasCombo) return;

    ctx.save();
    const yBase = snap.boss ? PLAYFIELD_Y + 42 : PLAYFIELD_Y + 8;

    if (hasCombo) {
      const stepFactor = snap.activeAugments.some((a) => a.id === 'combo_accelerator') ? 0.25 : 0.15;
      const mult = Math.min(5.0, 1.0 + (snap.activeCombo - 1) * stepFactor);
      const pulse = 0.78 + 0.22 * Math.sin(snap.time * 14);
      const bx = PLAYFIELD_RIGHT - 134;
      ctx.fillStyle = `rgba(14, 18, 42, 0.85)`;
      this.roundRect(bx, yBase, 126, 22, 5);
      ctx.fill();
      ctx.strokeStyle = `rgba(255, 224, 77, ${pulse})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = '#ffe659';
      ctx.font = 'bold 11px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`COMBO ${snap.activeCombo} (${mult.toFixed(1)}X)`, bx + 63, yBase + 15);
    }

    if (isReduced) {
      const warn = 0.65 + 0.35 * Math.sin(snap.time * 10);
      const bx = PLAYFIELD_X + 8;
      ctx.fillStyle = 'rgba(42, 10, 18, 0.85)';
      this.roundRect(bx, yBase, 118, 22, 5);
      ctx.fill();
      ctx.strokeStyle = `rgba(255, 70, 90, ${warn})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = '#ffdf4d';
      ctx.font = 'bold 11px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('★ 2X SCORE ★', bx + 59, yBase + 15);
    }
    ctx.restore();
  }

  private drawTouchControlsBar(snap: RenderSnapshot): void {
    const ctx = this.ctx;
    const y = PLAYFIELD_BOTTOM - 26;
    ctx.save();
    ctx.fillStyle = 'rgba(6, 12, 28, 0.72)';
    ctx.fillRect(PLAYFIELD_X, y, PLAYFIELD_W, 26);
    ctx.strokeStyle = 'rgba(70, 175, 255, 0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PLAYFIELD_X, y);
    ctx.lineTo(PLAYFIELD_RIGHT, y);
    ctx.stroke();

    const drawTouchBtn = (x: number, w: number, label: string, active: boolean) => {
      ctx.fillStyle = active ? 'rgba(40, 170, 255, 0.25)' : 'rgba(20, 32, 56, 0.6)';
      ctx.fillRect(x + 2, y + 3, w - 4, 20);
      ctx.strokeStyle = active ? '#5ce6ff' : '#35507a';
      ctx.strokeRect(x + 2, y + 3, w - 4, 20);
      ctx.fillStyle = active ? '#ffffff' : '#809ec4';
      ctx.font = 'bold 10px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(label, x + w * 0.5, y + 16);
    };

    const p0 = snap.paddles[0];
    const empReady = !!p0 && p0.repulsorCooldown <= 0;
    drawTouchBtn(PLAYFIELD_X, 102, snap.reserveCapsule ? `RES [${snap.reserveCapsule}]` : 'RESERVE', !!snap.reserveCapsule);
    ctx.fillStyle = 'rgba(130, 180, 235, 0.55)';
    ctx.font = '9px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('◄ SLIDE HERE TO STEER ►', PLAYFIELD_X + 195, y + 16);
    drawTouchBtn(PLAYFIELD_RIGHT - 176, 88, empReady ? 'EMP READY' : 'EMP', empReady);
    drawTouchBtn(PLAYFIELD_RIGHT - 86, 86, 'PAUSE', true);
    ctx.restore();
  }

  private drawLeftHud(snap: RenderSnapshot, sectorNodes?: Iterable<SectorNode>): void {
    const ctx = this.ctx;
    const panelX = 10;
    const panelW = 204;

    ctx.save();
    ctx.fillStyle = 'rgba(10, 16, 34, 0.85)';
    ctx.strokeStyle = '#274375';
    ctx.lineWidth = 1.5;
    this.roundRect(panelX, 16, panelW, CANVAS_H - 32, 8);
    ctx.fill();
    ctx.stroke();

    // Mini XORG Sector Tree
    ctx.fillStyle = '#6ec8ff';
    ctx.font = 'bold 12px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('XORG SECTOR MAP', panelX + panelW * 0.5, 38);

    const mapBoxX = panelX + 12;
    const mapBoxY = 48;
    const mapBoxW = panelW - 24;
    const mapBoxH = 148;
    ctx.fillStyle = '#060b18';
    ctx.fillRect(mapBoxX, mapBoxY, mapBoxW, mapBoxH);
    ctx.strokeStyle = '#1e355e';
    ctx.strokeRect(mapBoxX, mapBoxY, mapBoxW, mapBoxH);

    if (sectorNodes) {
      const nodes = Array.from(sectorNodes);
      const discovered = new Set(snap.discoveredStageIds);
      const route = new Set(snap.routeHistory);

      // Draw edges
      ctx.strokeStyle = 'rgba(70, 120, 190, 0.35)';
      ctx.lineWidth = 1;
      for (const n of nodes) {
        const x1 = mapBoxX + 10 + n.mapX * (mapBoxW - 20);
        const y1 = mapBoxY + 16 + n.mapY * (mapBoxH - 32);
        for (const nxtId of [n.leftNextId, n.rightNextId]) {
          if (!nxtId) continue;
          const target = nodes.find((m) => m.id === nxtId);
          if (!target) continue;
          const x2 = mapBoxX + 10 + target.mapX * (mapBoxW - 20);
          const y2 = mapBoxY + 16 + target.mapY * (mapBoxH - 32);
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
      }

      // Draw nodes
      for (const n of nodes) {
        const nx = mapBoxX + 10 + n.mapX * (mapBoxW - 20);
        const ny = mapBoxY + 16 + n.mapY * (mapBoxH - 32);
        const isCurrent = n.id === snap.stage.id;
        const isRoute = route.has(n.id);
        const isDisc = discovered.has(n.id);
        ctx.fillStyle = isCurrent
          ? '#ffe44d'
          : isRoute
            ? '#38ffad'
            : n.boss
              ? '#ff4566'
              : isDisc
                ? '#4ca6ff'
                : '#23324d';
        ctx.beginPath();
        ctx.arc(nx, ny, isCurrent ? 4 : n.boss ? 3 : 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.fillStyle = '#9bb8db';
    ctx.font = '10px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`DISCOVERED: ${snap.discoveredStageIds.length} / 64`, panelX + panelW * 0.5, 212);

    // Active Upgrades / Synergies
    const vaus = snap.paddles[snap.activePlayer] ?? snap.paddles[0];
    ctx.fillStyle = '#6ec8ff';
    ctx.font = 'bold 12px "Courier New", monospace';
    ctx.fillText('VAUS II SYNERGY SLOTS', panelX + panelW * 0.5, 240);

    const chassisText = vaus
      ? [
          vaus.enlargeLevel === 2 ? 'ENLARGE 2X' : vaus.enlargeLevel === 1 ? 'ENLARGE' : '',
          vaus.twinActive ? 'TWIN' : '',
          vaus.illusionActive ? 'ILLUSION' : '',
          vaus.reduced ? 'REDUCE (2X)' : '',
        ]
          .filter(Boolean)
          .join(' + ') || 'STANDARD'
      : 'STANDARD';

    const weaponText = vaus
      ? [
          vaus.laserLevel === 2 ? 'HYPER LASER' : vaus.laserLevel === 1 ? 'LASER' : '',
          vaus.catchActive ? 'CATCH' : '',
        ]
          .filter(Boolean)
          .join(' + ') || 'NONE'
      : 'NONE';

    const hasMega = snap.balls.some((b) => b.mega);
    const ballText =
      [
        hasMega ? 'MEGA BALL' : '',
        snap.balls.length > 1 ? `MULTI x${snap.balls.length}` : '',
      ]
        .filter(Boolean)
        .join(' + ') || 'ENERGY ORB';

    const drawSlot = (label: string, val: string, y: number, col: string) => {
      ctx.fillStyle = '#081022';
      ctx.fillRect(panelX + 12, y, panelW - 24, 38);
      ctx.strokeStyle = '#253f6e';
      ctx.strokeRect(panelX + 12, y, panelW - 24, 38);
      ctx.fillStyle = '#7e9ec4';
      ctx.font = 'bold 9px "Courier New", monospace';
      ctx.textAlign = 'left';
      ctx.fillText(label, panelX + 18, y + 13);
      ctx.fillStyle = col;
      ctx.font = 'bold 11px "Courier New", monospace';
      ctx.fillText(val.slice(0, 22), panelX + 18, y + 29);
    };

    drawSlot('CHASSIS', chassisText, 250, '#5ce6ff');
    drawSlot('WEAPON', weaponText, 294, '#ff6b8b');
    drawSlot('ENERGY BALL', ballText, 338, '#ffd94d');

    // Roguelite Augments (when active)
    if (snap.activeAugments.length > 0) {
      ctx.fillStyle = '#38ffad';
      ctx.font = 'bold 11px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('BREACH AUGMENTS', panelX + panelW * 0.5, 400);
      snap.activeAugments.slice(0, 6).forEach((aug, idx) => {
        const ax = panelX + 14 + (idx % 3) * 60;
        const ay = 408 + Math.floor(idx / 3) * 28;
        ctx.fillStyle = '#0c182e';
        ctx.fillRect(ax, ay, 54, 22);
        ctx.strokeStyle = aug.color;
        ctx.strokeRect(ax, ay, 54, 22);
        ctx.fillStyle = aug.color;
        ctx.font = 'bold 10px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(aug.icon, ax + 27, ay + 14);
      });
    }

    // Stalemate Lock-On Countdown
    if (snap.stalemateTimer > 5 && snap.settings.stalemateBreaker) {
      const rem = Math.max(0, Math.ceil(20 - snap.stalemateTimer));
      ctx.fillStyle = 'rgba(255, 70, 90, 0.22)';
      ctx.fillRect(panelX + 12, 476, panelW - 24, 34);
      ctx.strokeStyle = '#ff4a68';
      ctx.strokeRect(panelX + 12, 476, panelW - 24, 34);
      ctx.fillStyle = '#ff8599';
      ctx.font = 'bold 10px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`MIXTEC LOCK-ON: ${rem}s`, panelX + panelW * 0.5, 497);
    }

    // Controls Quick-Card
    ctx.fillStyle = '#6ec8ff';
    ctx.font = 'bold 11px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('CONTROLS', panelX + panelW * 0.5, 542);

    const lines = [
      'MOVE   Mouse / A-D / ◄►',
      'FIRE   L-Click / Space',
      'RESERVE R-Tap / R',
      'EMP    X / F (or R-Tap)',
      'CURVE  Hold R-Clk / Q-E',
      'REWIND Backspace',
      'CRT/HD F2   PAUSE P/Esc',
    ];
    ctx.textAlign = 'left';
    ctx.font = '10px "Courier New", monospace';
    ctx.fillStyle = '#a8bedb';
    lines.forEach((line, i) => {
      ctx.fillText(line, panelX + 12, 560 + i * 20);
    });

    ctx.restore();
  }

  private drawRightHud(snap: RenderSnapshot): void {
    const ctx = this.ctx;
    const panelX = 746;
    const panelW = 204;

    ctx.save();
    ctx.fillStyle = 'rgba(10, 16, 34, 0.85)';
    ctx.strokeStyle = '#274375';
    ctx.lineWidth = 1.5;
    this.roundRect(panelX, 16, panelW, CANVAS_H - 32, 8);
    ctx.fill();
    ctx.stroke();

    const drawScoreBlock = (label: string, value: string, y: number, col: string) => {
      ctx.fillStyle = '#8aa8cf';
      ctx.font = 'bold 11px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(label, panelX + panelW * 0.5, y);
      ctx.fillStyle = col;
      ctx.font = 'bold 20px "Courier New", monospace';
      ctx.fillText(value, panelX + panelW * 0.5, y + 22);
    };

    const p1Label = snap.playMode === 'arcade2p' && snap.activePlayer === 0 ? '▶ 1UP ◀' : '1UP';
    const p2Label = snap.playMode === 'arcade2p' && snap.activePlayer === 1 ? '▶ 2UP ◀' : '2UP';
    drawScoreBlock('HIGH SCORE', snap.highScore.toString().padStart(7, '0'), 42, '#ff4d6d');
    drawScoreBlock(p1Label, snap.scores[0].toString().padStart(7, '0'), 96, '#ffffff');
    if (snap.playMode === 'arcade2p' || snap.playMode === 'coop2p') {
      drawScoreBlock(p2Label, snap.scores[1].toString().padStart(7, '0'), 150, '#5ce6ff');
    }

    // Round / Sector Badge
    ctx.fillStyle = '#091229';
    ctx.fillRect(panelX + 14, 186, panelW - 28, 46);
    ctx.strokeStyle = '#335c9c';
    ctx.strokeRect(panelX + 14, 186, panelW - 28, 46);
    ctx.fillStyle = '#75caff';
    ctx.font = 'bold 11px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('ROUND / SECTOR', panelX + panelW * 0.5, 203);
    ctx.fillStyle = '#ffe659';
    ctx.font = 'bold 16px "Courier New", monospace';
    ctx.fillText(
      snap.playMode === 'roguelite' ? `FLOOR ${snap.stage.round}` : `RND ${snap.stage.branchLabel}`,
      panelX + panelW * 0.5,
      224
    );

    // Reserve Capsule Bay
    ctx.fillStyle = '#8aa8cf';
    ctx.font = 'bold 11px "Courier New", monospace';
    ctx.fillText('RESERVE CAPSULE', panelX + panelW * 0.5, 258);
    ctx.fillStyle = '#060c1a';
    ctx.fillRect(panelX + 34, 266, panelW - 68, 42);
    ctx.strokeStyle = snap.reserveCapsule ? '#38ffad' : '#263e6b';
    ctx.strokeRect(panelX + 34, 266, panelW - 68, 42);
    if (snap.reserveCapsule) {
      this.drawSingleCapsule(
        panelX + panelW * 0.5,
        287,
        snap.reserveCapsule,
        0,
        snap.time,
        snap.settings.colorblindSymbols
      );
      ctx.fillStyle = '#92b6dc';
      ctx.font = '9px "Courier New", monospace';
      ctx.fillText('[R-CLICK / R]', panelX + panelW * 0.5, 320);
    } else {
      ctx.fillStyle = '#3b4f73';
      ctx.font = '10px "Courier New", monospace';
      ctx.fillText('EMPTY BAY', panelX + panelW * 0.5, 291);
    }

    // Vaus Lives Icons
    const lives = snap.lives[snap.playMode === 'arcade2p' ? snap.activePlayer : 0];
    ctx.fillStyle = '#8aa8cf';
    ctx.font = 'bold 11px "Courier New", monospace';
    ctx.fillText(`VAUS LIVES (${Math.max(0, lives)})`, panelX + panelW * 0.5, 352);
    for (let i = 0; i < Math.min(6, Math.max(0, lives)); i++) {
      const ix = panelX + 24 + (i % 3) * 58;
      const iy = 368 + Math.floor(i / 3) * 18;
      ctx.fillStyle = '#b4c9e4';
      this.roundRect(ix, iy, 44, 10, 4);
      ctx.fill();
      ctx.fillStyle = '#ff3859';
      ctx.fillRect(ix, iy, 8, 10);
      ctx.fillRect(ix + 36, iy, 8, 10);
    }

    // Magnetic Curve & Repulsor Energy Bars
    const vaus = snap.paddles[snap.activePlayer] ?? snap.paddles[0];
    const magPct = vaus ? vaus.magneticEnergy / 100 : 1;
    const repPct = vaus
      ? 1 - vaus.repulsorCooldown / Math.max(0.1, vaus.repulsorMaxCooldown)
      : 1;

    const drawBar = (label: string, pct: number, y: number, col: string) => {
      ctx.fillStyle = '#8aa8cf';
      ctx.font = 'bold 10px "Courier New", monospace';
      ctx.textAlign = 'left';
      ctx.fillText(label, panelX + 16, y);
      ctx.fillStyle = '#081022';
      ctx.fillRect(panelX + 16, y + 6, panelW - 32, 12);
      ctx.fillStyle = col;
      ctx.fillRect(panelX + 16, y + 6, (panelW - 32) * Math.max(0, Math.min(1, pct)), 12);
      ctx.strokeStyle = '#2d4a7a';
      ctx.strokeRect(panelX + 16, y + 6, panelW - 32, 12);
    };

    drawBar('MAGNETIC CURVE', magPct, 428, '#33f5b2');
    drawBar(
      repPct >= 0.99 ? 'EMP REPULSOR [READY]' : 'EMP REPULSOR',
      repPct,
      468,
      repPct >= 0.99 ? '#75caff' : '#536e96'
    );

    // Rewind Charges
    ctx.fillStyle = '#8aa8cf';
    ctx.font = 'bold 10px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`TACTICAL REWIND [BKSP]: ${snap.rewindCharges}`, panelX + panelW * 0.5, 522);

    // Ruleset & Visual Preset Badges
    ctx.fillStyle = '#0a1329';
    ctx.fillRect(panelX + 14, 548, panelW - 28, 72);
    ctx.strokeStyle = '#2b4a80';
    ctx.strokeRect(panelX + 14, 548, panelW - 28, 72);
    ctx.fillStyle = snap.settings.ruleset === 'evolved' ? '#38ffad' : '#ffb84d';
    ctx.font = 'bold 12px "Courier New", monospace';
    ctx.fillText(
      snap.settings.ruleset === 'evolved' ? 'MODE: EVOLVED+' : 'MODE: 1987 PURIST',
      panelX + panelW * 0.5,
      574
    );
    ctx.fillStyle = '#75caff';
    ctx.font = 'bold 11px "Courier New", monospace';
    ctx.fillText(
      snap.settings.visualPreset === 'crt_1987' ? 'VIDEO: CRT 1987 [F2]' : 'VIDEO: HD NEON [F2]',
      panelX + panelW * 0.5,
      600
    );

    // Credits
    ctx.fillStyle = '#ffe047';
    ctx.font = 'bold 13px "Courier New", monospace';
    ctx.fillText(`CREDIT  ${snap.credits.toString().padStart(2, '0')}`, panelX + panelW * 0.5, 680);
    ctx.fillStyle = '#6f8eb5';
    ctx.font = '10px "Courier New", monospace';
    ctx.fillText('[C / 5] INSERT COIN', panelX + panelW * 0.5, 702);

    ctx.restore();
  }

  private drawAttractOverlay(snap: RenderSnapshot): void {
    const ctx = this.ctx;
    const cx = PLAYFIELD_X + PLAYFIELD_W * 0.5;

    if (snap.attractPage === 'demo') {
      const blink = Math.sin(snap.time * 5) > 0;
      if (blink) {
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
        ctx.fillRect(PLAYFIELD_X + 24, PLAYFIELD_BOTTOM - 58, PLAYFIELD_W - 48, 30);
        ctx.fillStyle = '#ffe64d';
        ctx.font = 'bold 11px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('DEMO PLAY — PRESS ENTER OR CLICK TO MENU', cx, PLAYFIELD_BOTTOM - 39);
        ctx.restore();
      }
      return;
    }

    ctx.save();
    ctx.fillStyle = 'rgba(4, 8, 20, 0.88)';
    ctx.fillRect(PLAYFIELD_X, PLAYFIELD_Y, PLAYFIELD_W, PLAYFIELD_H);

    if (snap.attractPage === 'title') {
      // Bold Title Logo
      ctx.textAlign = 'center';
      const titleGrad = ctx.createLinearGradient(cx - 180, 95, cx + 180, 175);
      titleGrad.addColorStop(0, '#5ce6ff');
      titleGrad.addColorStop(0.5, '#ffffff');
      titleGrad.addColorStop(1, '#ff4586');
      ctx.fillStyle = titleGrad;
      ctx.font = 'bold 42px "Courier New", monospace';
      ctx.fillText('ARKANOID II', cx, 132);

      ctx.fillStyle = '#ffe04d';
      ctx.font = 'bold 19px "Courier New", monospace';
      ctx.fillText('REVENGE OF DOH', cx, 162);

      ctx.fillStyle = '#89b4e8';
      ctx.font = '11px "Courier New", monospace';
      ctx.fillText(
        `RULESET: ${snap.settings.ruleset === 'evolved' ? 'EVOLVED ARCADE+' : '1987 PURIST'}  [TAB TO TOGGLE]`,
        cx,
        204
      );

      if (Math.sin(snap.time * 4.5) > -0.25) {
        ctx.fillStyle = '#38ffad';
        ctx.font = 'bold 12px "Courier New", monospace';
        ctx.fillText('INSERT COIN [C] • SELECT MISSION MODE', cx, 246);
      }

      // 8 Menu Items aligned to GameEngine hitboxes (y = 314 + i * 40)
      for (let i = 0; i < MENU_LABELS.length; i++) {
        const y = 314 + i * 40;
        const selected = i === snap.selectedMenuIdx;
        ctx.fillStyle = selected ? 'rgba(36, 170, 255, 0.25)' : 'rgba(12, 22, 46, 0.72)';
        ctx.strokeStyle = selected ? '#5ce6ff' : '#244173';
        ctx.lineWidth = selected ? 2 : 1;
        this.roundRect(PLAYFIELD_X + 46, y, PLAYFIELD_W - 92, 34, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = selected ? '#ffffff' : '#9bb8db';
        ctx.font = `bold 13px "Courier New", monospace`;
        ctx.fillText(
          selected ? `▶ ${MENU_LABELS[i]} ◀` : MENU_LABELS[i],
          cx,
          y + 22
        );
      }
    } else if (snap.attractPage === 'story') {
      this.drawMixtecAndXorgArt(cx, 200, snap.time);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffe04d';
      ctx.font = 'bold 18px "Courier New", monospace';
      ctx.fillText('THE DIMENSION FORTRESS XORG', cx, 325);

      const story = [
        'YEARS AFTER THE FALL OF DOH,',
        'THE COLOSSAL FORTRESS XORG WARPS',
        'INTO OUR GALAXY BEARING A',
        'RESURRECTED, VENGEFUL DOH.',
        '',
        'MOTHER SHIP MIXTEC SCRAMBLES THE',
        'UPGRADED VAUS II INTERCEPTOR',
        'INTO XORG’S OUTER BREACH...',
      ];
      ctx.fillStyle = '#b9d6f8';
      ctx.font = '13px "Courier New", monospace';
      story.forEach((line, idx) => {
        ctx.fillText(line, cx, 375 + idx * 28);
      });
    } else if (snap.attractPage === 'capsules') {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#5ce6ff';
      ctx.font = 'bold 18px "Courier New", monospace';
      ctx.fillText('14-CAPSULE ARSENAL', cx, 108);

      const types: CapsuleType[] = ['E', 'L', 'C', 'S', 'B', 'D', 'P', 'M', 'T', 'I', 'N', 'R', '?', 'G'];
      types.forEach((t, i) => {
        const y = 148 + i * 38;
        this.drawSingleCapsule(PLAYFIELD_X + 52, y, t, i * 0.4, snap.time, snap.settings.colorblindSymbols);
        ctx.textAlign = 'left';
        ctx.fillStyle = CAPSULE_META[t].hazard ? '#ff6b6b' : '#ffe38f';
        ctx.font = 'bold 11px "Courier New", monospace';
        ctx.fillText(CAPSULE_META[t].name, PLAYFIELD_X + 80, y - 2);
        ctx.fillStyle = '#a3c0e6';
        ctx.font = '10px "Courier New", monospace';
        ctx.fillText(CAPSULE_META[t].desc.slice(0, 48), PLAYFIELD_X + 80, y + 12);
      });
    } else if (snap.attractPage === 'highscores') {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffe04d';
      ctx.font = 'bold 20px "Courier New", monospace';
      ctx.fillText('TOP 10 XORG DEFENDERS', cx, 122);

      ctx.fillStyle = '#6ec8ff';
      ctx.font = 'bold 11px "Courier New", monospace';
      ctx.fillText('RNK  NAME   SCORE     RND   MODE', cx, 165);

      snap.highScores.slice(0, 10).forEach((entry, idx) => {
        const y = 200 + idx * 38;
        ctx.fillStyle = idx === 0 ? '#ffe04d' : idx < 3 ? '#5ce6ff' : '#c2d8f5';
        ctx.font = 'bold 13px "Courier New", monospace';
        const row = `${String(idx + 1).padStart(2, ' ')}.  ${entry.initials.padEnd(3, ' ')}   ${String(entry.score).padStart(7, '0')}   ${entry.round.padEnd(4, ' ')}  ${entry.mode.slice(0, 8)}`;
        ctx.fillText(row, cx, y);
      });
    }

    ctx.restore();
  }

  private drawMixtecAndXorgArt(cx: number, cy: number, time: number): void {
    const ctx = this.ctx;
    ctx.save();
    // XORG Fortress on the right
    ctx.fillStyle = '#2c3954';
    ctx.strokeStyle = '#ff3868';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx + 105, cy, 58, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ff2b4a';
    ctx.beginPath();
    ctx.arc(cx + 95, cy, 14 + Math.sin(time * 5) * 2, 0, Math.PI * 2);
    ctx.fill();

    // MIXTEC Mothership on the left
    ctx.fillStyle = '#9bb5d6';
    ctx.strokeStyle = '#5ce6ff';
    ctx.beginPath();
    ctx.moveTo(cx - 160, cy);
    ctx.lineTo(cx - 105, cy - 22);
    ctx.lineTo(cx - 80, cy);
    ctx.lineTo(cx - 105, cy + 22);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Launching Vaus II shuttle
    const vausX = cx - 65 + ((time * 42) % 120);
    ctx.fillStyle = '#e8f3ff';
    this.roundRect(vausX, cy - 5, 22, 10, 4);
    ctx.fill();
    ctx.restore();
  }

  private drawIntroStory(snap: RenderSnapshot): void {
    const ctx = this.ctx;
    const cx = PLAYFIELD_X + PLAYFIELD_W * 0.5;
    ctx.save();
    ctx.fillStyle = 'rgba(3, 6, 16, 0.92)';
    ctx.fillRect(PLAYFIELD_X, PLAYFIELD_Y, PLAYFIELD_W, PLAYFIELD_H);

    this.drawMixtecAndXorgArt(cx, 270, snap.introTimer);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#5ce6ff';
    ctx.font = 'bold 18px "Courier New", monospace';
    ctx.fillText('MIXTEC DEPLOYING VAUS II', cx, 420);
    ctx.fillStyle = '#ffe04d';
    ctx.font = '13px "Courier New", monospace';
    ctx.fillText('TARGET: DIMENSION FORTRESS XORG', cx, 456);
    ctx.fillStyle = '#8faed4';
    ctx.font = '11px "Courier New", monospace';
    ctx.fillText('PRESS ENTER / CLICK TO LAUNCH IMMEDIATELY', cx, 610);
    ctx.restore();
  }

  private drawSectorMap(snap: RenderSnapshot, sectorNodes?: Iterable<SectorNode>): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = 'rgba(4, 8, 22, 0.94)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#5ce6ff';
    ctx.font = 'bold 24px "Courier New", monospace';
    ctx.fillText('XORG 64-SECTOR TACTICAL MAP', CANVAS_W * 0.5, 58);

    ctx.fillStyle = '#ffe04d';
    ctx.font = '13px "Courier New", monospace';
    ctx.fillText(
      `DISCOVERED: ${snap.discoveredStageIds.length} / 64   •   [U] UNLOCK ALL FOR PRACTICE   •   [ESC] BACK`,
      CANVAS_W * 0.5,
      92
    );

    if (sectorNodes) {
      const nodes = Array.from(sectorNodes);
      const discovered = new Set(snap.discoveredStageIds);
      const pos = (n: SectorNode) => ({
        x: 90 + n.mapX * (CANVAS_W - 180),
        y: 150 + n.mapY * (CANVAS_H - 290),
      });

      // Connections
      ctx.strokeStyle = 'rgba(70, 140, 230, 0.35)';
      ctx.lineWidth = 1.5;
      for (const n of nodes) {
        const p1 = pos(n);
        for (const nxtId of [n.leftNextId, n.rightNextId]) {
          if (!nxtId) continue;
          const target = nodes.find((m) => m.id === nxtId);
          if (!target) continue;
          const p2 = pos(target);
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
      }

      // Nodes
      for (const n of nodes) {
        const { x, y } = pos(n);
        const sel = n.id === snap.selectedMapStageId;
        const hov = n.id === snap.hoveredMapStageId;
        const disc = discovered.has(n.id);
        ctx.fillStyle = sel
          ? '#ffe44d'
          : hov
            ? '#ffffff'
            : n.boss
              ? '#ff3d68'
              : disc
                ? '#38d8ff'
                : '#1f304d';
        ctx.beginPath();
        ctx.arc(x, y, sel ? 9 : hov ? 7.5 : n.boss ? 7 : 4.5, 0, Math.PI * 2);
        ctx.fill();
        if (sel || hov) {
          ctx.strokeStyle = sel ? '#ffffff' : '#5ce6ff';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }

      const previewId = snap.hoveredMapStageId ?? snap.selectedMapStageId;
      const current = nodes.find((n) => n.id === previewId);
      if (current) {
        const disc = discovered.has(current.id);
        const boxX = 110;
        const boxY = CANVAS_H - 122;
        const boxW = CANVAS_W - 220;
        const boxH = 92;
        ctx.fillStyle = '#09142b';
        ctx.fillRect(boxX, boxY, boxW, boxH);
        ctx.strokeStyle = '#47a6ff';
        ctx.strokeRect(boxX, boxY, boxW, boxH);

        // Live Brick Thumbnail Preview for discovered stages!
        const thumbX = boxX + 16;
        const thumbY = boxY + 10;
        const thumbW = 104;
        const thumbH = 72;
        ctx.fillStyle = '#040814';
        ctx.fillRect(thumbX, thumbY, thumbW, thumbH);
        ctx.strokeStyle = '#254375';
        ctx.strokeRect(thumbX, thumbY, thumbW, thumbH);
        if (disc) {
          const stDef = getStageById(current.id);
          const cw = thumbW / 13;
          const ch = thumbH / 18;
          for (const b of stDef.bricks) {
            if (b.row >= 18) continue;
            ctx.fillStyle = BRICK_COLORS[b.kind].fill;
            ctx.fillRect(thumbX + b.col * cw + 0.5, thumbY + b.row * ch + 0.5, cw - 1, Math.max(2, ch - 1));
          }
          if (stDef.boss) {
            ctx.fillStyle = '#ff3864';
            ctx.font = 'bold 9px "Courier New", monospace';
            ctx.textAlign = 'center';
            ctx.fillText('BOSS', thumbX + thumbW * 0.5, thumbY + 36);
          }
        } else {
          ctx.fillStyle = '#38527a';
          ctx.font = 'bold 20px "Courier New", monospace';
          ctx.textAlign = 'center';
          ctx.fillText('?', thumbX + thumbW * 0.5, thumbY + 44);
        }

        const textCenterX = boxX + 128 + (boxW - 140) * 0.5;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px "Courier New", monospace';
        ctx.fillText(
          disc
            ? `SECTOR ${current.branchLabel}: ${current.name}${current.boss ? ' [BOSS]' : ''}`
            : `SECTOR ${current.branchLabel}: ??? (UNDISCOVERED)`,
          textCenterX,
          boxY + 38
        );
        ctx.fillStyle = disc ? '#38ffad' : '#ff6b8b';
        ctx.font = '12px "Courier New", monospace';
        ctx.fillText(
          disc
            ? 'PRESS ENTER OR CLICK SELECTED NODE TO DEPLOY PRACTICE SORTIE'
            : 'DISCOVER IN CAMPAIGN OR PRESS [U] TO UNLOCK ALL 64 SECTORS',
          textCenterX,
          boxY + 66
        );
      }
    }

    ctx.restore();
  }

  private drawAugmentDraft(snap: RenderSnapshot): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = 'rgba(4, 10, 24, 0.92)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#38ffad';
    ctx.font = 'bold 24px "Courier New", monospace';
    ctx.fillText('SECTOR CLEARED — DRAFT VAUS AUGMENT', CANVAS_W * 0.5, 165);
    ctx.fillStyle = '#9ac0eb';
    ctx.font = '13px "Courier New", monospace';
    ctx.fillText('CLICK A MODULE OR PRESS [1] [2] [3]', CANVAS_W * 0.5, 198);

    const cardW = 220;
    const cardH = 300;
    const startX = (CANVAS_W - cardW * 3 - 40) * 0.5;
    snap.draftOptions.forEach((aug, i) => {
      const hovered = snap.hoverAugmentIdx === i;
      const cx = startX + i * (cardW + 20);
      const cy = hovered ? 232 : 240;
      ctx.fillStyle = hovered ? '#10244a' : '#09152e';
      ctx.strokeStyle = hovered ? '#ffffff' : aug.color;
      ctx.lineWidth = hovered ? 3.5 : 2.5;
      this.roundRect(cx, cy, cardW, cardH, 10);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = aug.color;
      ctx.font = 'bold 34px "Courier New", monospace';
      ctx.fillText(aug.icon, cx + cardW * 0.5, cy + 78);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 15px "Courier New", monospace';
      ctx.fillText(aug.name, cx + cardW * 0.5, cy + 132);

      // Wrap description
      ctx.fillStyle = '#b4d0f0';
      ctx.font = '12px "Courier New", monospace';
      this.drawWrappedText(aug.desc, cx + cardW * 0.5, cy + 172, cardW - 28, 18);

      ctx.fillStyle = '#ffe04d';
      ctx.font = 'bold 13px "Courier New", monospace';
      ctx.fillText(`[${i + 1}] INSTALL`, cx + cardW * 0.5, cy + cardH - 24);
    });

    ctx.restore();
  }

  private drawPausedOverlay(snap: RenderSnapshot): void {
    const ctx = this.ctx;
    const cx = PLAYFIELD_X + PLAYFIELD_W * 0.5;
    ctx.save();
    ctx.fillStyle = 'rgba(4, 8, 20, 0.78)';
    ctx.fillRect(PLAYFIELD_X, PLAYFIELD_Y, PLAYFIELD_W, PLAYFIELD_H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffe04d';
    ctx.font = 'bold 32px "Courier New", monospace';
    ctx.fillText('PAUSED', cx, 310);

    ctx.fillStyle = '#c4dcf8';
    ctx.font = '14px "Courier New", monospace';
    ctx.fillText('[P / ESC / ENTER] RESUME', cx, 368);
    ctx.fillText('[O] DIP-SWITCH SETTINGS', cx, 402);
    ctx.fillText('[Q] ABORT TO TITLE', cx, 436);
    ctx.fillStyle = '#6ec8ff';
    ctx.font = '12px "Courier New", monospace';
    ctx.fillText(`SECTOR ${snap.stage.branchLabel}: ${snap.stage.name}`, cx, 494);
    ctx.restore();
  }

  private drawGameOverOverlay(snap: RenderSnapshot): void {
    const ctx = this.ctx;
    const cx = PLAYFIELD_X + PLAYFIELD_W * 0.5;
    ctx.save();
    ctx.fillStyle = 'rgba(18, 4, 10, 0.84)';
    ctx.fillRect(PLAYFIELD_X, PLAYFIELD_Y, PLAYFIELD_W, PLAYFIELD_H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff3859';
    ctx.font = 'bold 38px "Courier New", monospace';
    ctx.fillText('GAME OVER', cx, 320);

    const bestScore = Math.max(snap.scores[0], snap.scores[1]);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px "Courier New", monospace';
    ctx.fillText(`FINAL SCORE: ${bestScore.toLocaleString()}`, cx, 376);
    ctx.fillStyle = '#9cc0eb';
    ctx.font = '13px "Courier New", monospace';
    ctx.fillText(`REACHED SECTOR ${snap.stage.branchLabel}`, cx, 408);
    ctx.fillStyle = '#ffe04d';
    ctx.fillText('PRESS ENTER OR CLICK TO CONTINUE', cx, 470);
    ctx.restore();
  }

  private drawVictoryOverlay(snap: RenderSnapshot): void {
    const ctx = this.ctx;
    const cx = PLAYFIELD_X + PLAYFIELD_W * 0.5;
    ctx.save();
    ctx.fillStyle = 'rgba(4, 10, 26, 0.9)';
    ctx.fillRect(PLAYFIELD_X, PLAYFIELD_Y, PLAYFIELD_W, PLAYFIELD_H);

    // Animated celebratory starburst
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + snap.time * 0.6;
      ctx.strokeStyle = i % 2 === 0 ? 'rgba(255, 224, 77, 0.35)' : 'rgba(92, 230, 255, 0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, 220);
      ctx.lineTo(cx + Math.cos(a) * 180, 220 + Math.sin(a) * 180);
      ctx.stroke();
    }

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffe04d';
    ctx.font = 'bold 28px "Courier New", monospace';
    ctx.fillText('DOH DESTROYED!', cx, 210);
    ctx.fillStyle = '#38ffad';
    ctx.font = 'bold 15px "Courier New", monospace';
    ctx.fillText('VAUS II ESCAPES XORG COLLAPSE!', cx, 246);

    const bestScore = Math.max(snap.scores[0], snap.scores[1]);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px "Courier New", monospace';
    ctx.fillText(`SCORE: ${bestScore.toLocaleString()}`, cx, 320);
    ctx.fillStyle = '#9cc0eb';
    ctx.font = '13px "Courier New", monospace';
    ctx.fillText(`STAGES DISCOVERED: ${snap.discoveredStageIds.length} / 64`, cx, 355);

    ctx.fillStyle = '#ff70a6';
    ctx.font = 'bold 14px "Courier New", monospace';
    ctx.fillText(`[L] START HARDCORE LOOP ${snap.loopNumber + 1}`, cx, 440);
    ctx.fillStyle = '#5ce6ff';
    ctx.font = '12px "Courier New", monospace';
    ctx.fillText('[ENTER / CLICK] RECORD SCORE & FINISH', cx, 482);
    ctx.restore();
  }

  private drawHighScoreEntryOverlay(snap: RenderSnapshot): void {
    const ctx = this.ctx;
    const cx = PLAYFIELD_X + PLAYFIELD_W * 0.5;
    ctx.save();
    ctx.fillStyle = 'rgba(4, 10, 26, 0.92)';
    ctx.fillRect(PLAYFIELD_X, PLAYFIELD_Y, PLAYFIELD_W, PLAYFIELD_H);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffe04d';
    ctx.font = 'bold 22px "Courier New", monospace';
    ctx.fillText('NEW HIGH SCORE!', cx, 240);
    const bestScore = Math.max(snap.scores[0], snap.scores[1]);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px "Courier New", monospace';
    ctx.fillText(bestScore.toString().padStart(7, '0'), cx, 278);

    ctx.fillStyle = '#5ce6ff';
    ctx.font = '13px "Courier New", monospace';
    ctx.fillText('ENTER YOUR 3-LETTER INITIALS', cx, 330);

    const chars = snap.initialsInput.padEnd(3, '_').split('');
    chars.forEach((ch, idx) => {
      const bx = cx - 72 + idx * 54;
      ctx.fillStyle = '#09152e';
      ctx.strokeStyle = idx === snap.initialsInput.length ? '#ffe04d' : '#4a85d4';
      ctx.lineWidth = 2;
      ctx.fillRect(bx, 354, 40, 52);
      ctx.strokeRect(bx, 354, 40, 52);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 28px "Courier New", monospace';
      ctx.fillText(ch, bx + 20, 390);
    });

    ctx.fillStyle = '#9cbde6';
    ctx.font = '12px "Courier New", monospace';
    ctx.fillText('TYPE A-Z  •  [BKSP] ERASE  •  [ENTER] SAVE', cx, 456);
    ctx.restore();
  }

  private drawStageBanner(snap: RenderSnapshot): void {
    const ctx = this.ctx;
    const cx = PLAYFIELD_X + PLAYFIELD_W * 0.5;
    const alpha = Math.min(1, snap.bannerTimer * 1.4);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(4, 10, 24, 0.85)';
    ctx.fillRect(PLAYFIELD_X + 18, 345, PLAYFIELD_W - 36, 74);
    ctx.strokeStyle = '#5ce6ff';
    ctx.lineWidth = 2;
    ctx.strokeRect(PLAYFIELD_X + 18, 345, PLAYFIELD_W - 36, 74);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffe04d';
    ctx.font = 'bold 16px "Courier New", monospace';
    ctx.fillText(snap.bannerText ?? '', cx, 376);
    if (snap.bannerSubText) {
      ctx.fillStyle = '#b4d6ff';
      ctx.font = '11px "Courier New", monospace';
      ctx.fillText(snap.bannerSubText, cx, 400);
    }
    ctx.restore();
  }

  private drawRewindOverlay(snap: RenderSnapshot): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = 'rgba(20, 210, 255, 0.14)';
    ctx.fillRect(PLAYFIELD_X, PLAYFIELD_Y, PLAYFIELD_W, PLAYFIELD_H);
    ctx.fillStyle = '#e0f8ff';
    ctx.font = 'bold 20px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(
      `REWINDING <<  (${Math.floor(snap.time * 10) % 2 === 0 ? 'REC' : 'TAC'})`,
      PLAYFIELD_X + PLAYFIELD_W * 0.5,
      PLAYFIELD_Y + 42
    );
    ctx.restore();
  }

  private drawWrappedText(
    text: string,
    cx: number,
    y: number,
    maxWidth: number,
    lineHeight: number
  ): void {
    const ctx = this.ctx;
    const words = text.split(' ');
    let line = '';
    let curY = y;
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, cx, curY);
        line = w;
        curY += lineHeight;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, cx, curY);
  }

  private roundRect(x: number, y: number, w: number, h: number, r: number): void {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}
