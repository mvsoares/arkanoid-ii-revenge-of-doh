import { CANVAS_H, CANVAS_W, PLAYFIELD_RIGHT, PLAYFIELD_X } from '../constants';

export interface PlayerInputSnapshot {
  moveDeltaX: number; // pointer-lock or analog delta in logical px
  targetX: number | null; // absolute cursor/touch X if unlocked
  axisX: number; // -1..1 keyboard/dpad/stick
  precision: boolean;
  firePressed: boolean; // edge trigger
  fireHeld: boolean;
  reservePressed: boolean; // deploy reserve capsule
  repulsorPressed: boolean; // EMP repulsor wave
  smartSecondaryPressed: boolean; // right-click quick tap (reserve if ready, else EMP)
  magneticDir: 0 | 1 | -1; // 1 = attract, -1 = repel
}

export class InputManager {
  private keysDown = new Set<string>();
  private keysJustPressed = new Set<string>();
  private charQueue: string[] = [];

  private mouseDeltaX = 0;
  private cursorX: number | null = null;
  private cursorY: number | null = null;
  private cursorMovedThisFrame = false;
  private mouseLeftDown = false;
  private mouseLeftJust = false;
  private mouseRightDown = false;
  private mouseRightDownAt = 0;
  private mouseRightTap = false;
  private mouseMiddleDown = false;

  private touchActive = false;
  private touchUsed = false;
  private touchX: number | null = null;
  private touchY: number | null = null;
  private touchJust = false;

  public isPointerLocked = false;
  private canvas: HTMLCanvasElement;
  private onUserGesture?: () => void;

  constructor(canvas: HTMLCanvasElement, onUserGesture?: () => void) {
    this.canvas = canvas;
    this.onUserGesture = onUserGesture;
    this.bindEvents();
  }

  private bindEvents(): void {
    window.addEventListener('keydown', (e) => {
      this.onUserGesture?.();
      if (
        [
          'ArrowLeft',
          'ArrowRight',
          'ArrowUp',
          'ArrowDown',
          'Space',
          'Tab',
          'Backspace',
          'F2',
        ].includes(e.code) &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'SELECT'
      ) {
        e.preventDefault();
      }
      if (!this.keysDown.has(e.code)) {
        this.keysJustPressed.add(e.code);
      }
      this.keysDown.add(e.code);

      if (e.key.length === 1 && /^[a-zA-Z0-9]$/.test(e.key)) {
        this.charQueue.push(e.key.toUpperCase());
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keysDown.delete(e.code);
    });

    document.addEventListener('pointerlockchange', () => {
      this.isPointerLocked = document.pointerLockElement === this.canvas;
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isPointerLocked) {
        this.mouseDeltaX += e.movementX;
      } else {
        const rect = this.canvas.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          this.cursorX = ((e.clientX - rect.left) / rect.width) * CANVAS_W;
          this.cursorY = ((e.clientY - rect.top) / rect.height) * CANVAS_H;
          this.cursorMovedThisFrame = true;
        }
      }
    });

    this.canvas.addEventListener('mousedown', (e) => {
      this.onUserGesture?.();
      const rect = this.canvas.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        this.cursorX = ((e.clientX - rect.left) / rect.width) * CANVAS_W;
        this.cursorY = ((e.clientY - rect.top) / rect.height) * CANVAS_H;
      }
      if (e.button === 0) {
        this.mouseLeftDown = true;
        this.mouseLeftJust = true;
      } else if (e.button === 2) {
        this.mouseRightDown = true;
        this.mouseRightDownAt = performance.now();
      } else if (e.button === 1) {
        this.mouseMiddleDown = true;
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseLeftDown = false;
      if (e.button === 1) this.mouseMiddleDown = false;
      if (e.button === 2) {
        if (this.mouseRightDown && performance.now() - this.mouseRightDownAt < 240) {
          this.mouseRightTap = true;
        }
        this.mouseRightDown = false;
      }
    });

    this.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });

    // Touch controls (records both X and Y for menus + lower drag zone)
    this.canvas.addEventListener(
      'touchstart',
      (e) => {
        this.onUserGesture?.();
        e.preventDefault();
        this.touchUsed = true;
        if (e.touches.length > 0) {
          const rect = this.canvas.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            this.touchActive = true;
            this.touchX = ((e.touches[0].clientX - rect.left) / rect.width) * CANVAS_W;
            this.touchY = ((e.touches[0].clientY - rect.top) / rect.height) * CANVAS_H;
            this.touchJust = true;
            if (e.touches.length >= 2) {
              this.mouseRightTap = true;
            }
          }
        }
      },
      { passive: false }
    );

    this.canvas.addEventListener(
      'touchmove',
      (e) => {
        e.preventDefault();
        if (e.touches.length > 0) {
          const rect = this.canvas.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            this.touchX = ((e.touches[0].clientX - rect.left) / rect.width) * CANVAS_W;
            this.touchY = ((e.touches[0].clientY - rect.top) / rect.height) * CANVAS_H;
          }
        }
      },
      { passive: false }
    );

    this.canvas.addEventListener('touchend', () => {
      this.touchActive = false;
    });
  }

  public setCursorStyle(style: 'default' | 'pointer'): void {
    if (this.canvas.style.cursor !== style) {
      this.canvas.style.cursor = style;
    }
  }

  public getCursorPos(): { x: number; y: number; moved: boolean } | null {
    if (this.isPointerLocked || this.cursorX === null || this.cursorY === null) return null;
    return { x: this.cursorX, y: this.cursorY, moved: this.cursorMovedThisFrame };
  }

  public usedTouch(): boolean {
    return this.touchUsed;
  }

  public requestPointerLockIfAllowed(enabled: boolean): void {
    if (!enabled || this.isPointerLocked || this.touchUsed) return;
    try {
      const res = this.canvas.requestPointerLock?.() as unknown as Promise<void> | undefined;
      if (res && typeof res.catch === 'function') {
        res.catch(() => {});
      }
    } catch {
      // Ignore if rejected outside gesture
    }
  }

  public exitPointerLock(): void {
    if (document.pointerLockElement) {
      try {
        document.exitPointerLock();
      } catch {
        // Ignore
      }
    }
  }

  public wasJustPressed(code: string): boolean {
    return this.keysJustPressed.has(code);
  }

  public isDown(code: string): boolean {
    return this.keysDown.has(code);
  }

  public wasMouseClicked(): { x: number; y: number; isTouch: boolean } | null {
    if (this.touchJust && !this.isPointerLocked) {
      return {
        x: this.touchX ?? (PLAYFIELD_X + PLAYFIELD_RIGHT) / 2,
        y: this.touchY ?? CANVAS_H / 2,
        isTouch: true,
      };
    }
    if (this.mouseLeftJust && !this.isPointerLocked) {
      return {
        x: this.cursorX ?? (PLAYFIELD_X + PLAYFIELD_RIGHT) / 2,
        y: this.cursorY ?? CANVAS_H / 2,
        isTouch: false,
      };
    }
    return null;
  }

  public consumeChar(): string | null {
    return this.charQueue.shift() ?? null;
  }

  public clearChars(): void {
    this.charQueue.length = 0;
  }

  public getPlayerInput(
    playerIndex: 0 | 1,
    coopMode: boolean,
    sensitivity: number,
    allowUnlockedMouse: boolean
  ): PlayerInputSnapshot {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = pads[playerIndex] ?? null;

    let axisX = 0;
    let moveDeltaX = 0;
    let targetX: number | null = null;
    let precision = false;
    let firePressed = false;
    let fireHeld = false;
    let reservePressed = false;
    let repulsorPressed = false;
    let smartSecondaryPressed = false;
    let magneticDir: 0 | 1 | -1 = 0;

    if (playerIndex === 0) {
      // Mouse / Touch always drives P1
      if (this.isPointerLocked) {
        moveDeltaX += this.mouseDeltaX * sensitivity * 1.15;
      } else if (this.touchActive && this.touchX !== null) {
        targetX = this.touchX;
      } else if (allowUnlockedMouse && this.cursorX !== null) {
        targetX = this.cursorX;
      }

      const leftKey = coopMode ? this.isDown('KeyA') : this.isDown('KeyA') || this.isDown('ArrowLeft');
      const rightKey = coopMode ? this.isDown('KeyD') : this.isDown('KeyD') || this.isDown('ArrowRight');
      if (leftKey) axisX -= 1;
      if (rightKey) axisX += 1;

      precision = this.isDown('ShiftLeft') || (!coopMode && this.isDown('ShiftRight'));
      fireHeld =
        this.mouseLeftDown ||
        this.touchActive ||
        this.isDown('Space') ||
        this.isDown('KeyZ') ||
        this.isDown('KeyW');
      firePressed =
        this.mouseLeftJust ||
        this.touchJust ||
        this.wasJustPressed('Space') ||
        this.wasJustPressed('KeyZ') ||
        this.wasJustPressed('KeyW');

      reservePressed = this.wasJustPressed('KeyR');
      repulsorPressed = this.wasJustPressed('KeyX') || this.wasJustPressed('KeyF');
      smartSecondaryPressed = this.mouseRightTap;

      const rightHoldActive =
        this.mouseRightDown && performance.now() - this.mouseRightDownAt >= 180;
      if (this.isDown('KeyQ') || this.mouseMiddleDown || rightHoldActive) magneticDir = 1;
      else if (this.isDown('KeyE')) magneticDir = -1;
    } else {
      // Player 2 in Simultaneous Co-Op (Arrows / J-L / Gamepad 2)
      if (this.isDown('ArrowLeft') || this.isDown('KeyJ')) axisX -= 1;
      if (this.isDown('ArrowRight') || this.isDown('KeyL')) axisX += 1;
      precision = this.isDown('ShiftRight');
      fireHeld = this.isDown('ArrowUp') || this.isDown('Enter') || this.isDown('KeyI');
      firePressed =
        this.wasJustPressed('ArrowUp') ||
        this.wasJustPressed('Enter') ||
        this.wasJustPressed('KeyI');
      reservePressed = this.wasJustPressed('Slash') || this.wasJustPressed('KeyO');
      repulsorPressed = this.wasJustPressed('ArrowDown') || this.wasJustPressed('KeyK');
      if (this.isDown('KeyU')) magneticDir = 1;
    }

    // Gamepad support
    if (pad) {
      const stickX = pad.axes[0] ?? 0;
      if (Math.abs(stickX) > 0.14) {
        axisX = Math.max(-1, Math.min(1, axisX + stickX));
        targetX = null;
      }
      if (pad.buttons[14]?.pressed) axisX = -1;
      if (pad.buttons[15]?.pressed) axisX = 1;
      if (pad.buttons[0]?.pressed || pad.buttons[7]?.pressed) {
        fireHeld = true;
      }
      if (pad.buttons[0]?.pressed && !this.prevPadBtn0[playerIndex]) {
        firePressed = true;
      }
      if (pad.buttons[1]?.pressed && !this.prevPadBtn1[playerIndex]) {
        repulsorPressed = true;
      }
      if (pad.buttons[2]?.pressed && !this.prevPadBtn2[playerIndex]) {
        reservePressed = true;
      }
      if (pad.buttons[4]?.pressed) magneticDir = 1;
      if (pad.buttons[5]?.pressed) magneticDir = -1;

      this.prevPadBtn0[playerIndex] = !!pad.buttons[0]?.pressed;
      this.prevPadBtn1[playerIndex] = !!pad.buttons[1]?.pressed;
      this.prevPadBtn2[playerIndex] = !!pad.buttons[2]?.pressed;
    }

    if (axisX !== 0) {
      targetX = null;
    }

    return {
      moveDeltaX,
      targetX,
      axisX,
      precision,
      firePressed,
      fireHeld,
      reservePressed,
      repulsorPressed,
      smartSecondaryPressed,
      magneticDir,
    };
  }

  private prevPadBtn0: [boolean, boolean] = [false, false];
  private prevPadBtn1: [boolean, boolean] = [false, false];
  private prevPadBtn2: [boolean, boolean] = [false, false];

  public endFrame(): void {
    this.keysJustPressed.clear();
    this.mouseDeltaX = 0;
    this.mouseLeftJust = false;
    this.mouseRightTap = false;
    this.touchJust = false;
    this.cursorMovedThisFrame = false;
  }
}
