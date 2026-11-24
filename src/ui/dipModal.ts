import type { DipSwitchSettings } from '../types';

export interface DipModalCallbacks {
  onChange: (next: DipSwitchSettings) => void;
  onResetScores: () => void;
  onClose: () => void;
  onUiSound?: () => void;
}

export class DipSettingsModal {
  private overlayRoot: HTMLElement;
  private container: HTMLDivElement | null = null;
  private callbacks: DipModalCallbacks;

  constructor(overlayRoot: HTMLElement, callbacks: DipModalCallbacks) {
    this.overlayRoot = overlayRoot;
    this.callbacks = callbacks;
    this.injectStyles();
  }

  private injectStyles(): void {
    if (document.getElementById('dip-modal-styles')) return;
    const style = document.createElement('style');
    style.id = 'dip-modal-styles';
    style.textContent = `
      .dip-backdrop {
        position: absolute;
        inset: 0;
        background: rgba(4, 7, 18, 0.88);
        backdrop-filter: blur(4px);
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: auto;
        z-index: 40;
      }
      .dip-card {
        width: 820px;
        max-height: 700px;
        overflow-y: auto;
        background: linear-gradient(180deg, #0d1428 0%, #070b16 100%);
        border: 2px solid #22d6ff;
        box-shadow: 0 0 32px rgba(34, 214, 255, 0.3);
        border-radius: 8px;
        padding: 20px 26px;
        color: #e6f2ff;
      }
      .dip-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid rgba(34, 214, 255, 0.35);
        padding-bottom: 12px;
        margin-bottom: 14px;
      }
      .dip-title {
        font-size: 20px;
        font-weight: bold;
        color: #22e4ff;
        letter-spacing: 2px;
      }
      .dip-presets {
        display: flex;
        gap: 10px;
        margin-bottom: 16px;
      }
      .dip-btn {
        background: #13203d;
        color: #b8dcff;
        border: 1px solid #2d558f;
        padding: 8px 14px;
        border-radius: 4px;
        font-family: inherit;
        font-size: 13px;
        font-weight: bold;
        cursor: pointer;
        transition: all 0.12s;
      }
      .dip-btn:hover {
        border-color: #22e4ff;
        color: #fff;
        background: #1a2f59;
      }
      .dip-btn.active {
        background: #0d4b6e;
        border-color: #28f0ff;
        color: #fff;
        box-shadow: 0 0 12px rgba(40, 240, 255, 0.35);
      }
      .dip-btn.danger {
        border-color: #96283e;
        color: #ff99ac;
      }
      .dip-btn.danger:hover {
        background: #4d1220;
        border-color: #ff385c;
      }
      .dip-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px 24px;
      }
      .dip-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 6px 8px;
        background: rgba(255, 255, 255, 0.03);
        border-radius: 4px;
        font-size: 13px;
      }
      .dip-row input[type="range"] {
        width: 125px;
        accent-color: #22e4ff;
      }
      .dip-row input[type="checkbox"] {
        width: 18px;
        height: 18px;
        accent-color: #22e4ff;
        cursor: pointer;
      }
      .dip-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 18px;
        padding-top: 12px;
        border-top: 1px solid rgba(34, 214, 255, 0.25);
      }
    `;
    document.head.appendChild(style);
  }

  public open(current: DipSwitchSettings): void {
    this.close();
    const state: DipSwitchSettings = { ...current };

    const backdrop = document.createElement('div');
    backdrop.className = 'dip-backdrop modal-panel';
    this.container = backdrop;

    const renderContent = () => {
      backdrop.innerHTML = `
        <div class="dip-card">
          <div class="dip-header">
            <div class="dip-title">⚙ TAITO / XORG CABINET DIP-SWITCHES</div>
            <button class="dip-btn active" id="dip-close-top">✕ DONE [ESC]</button>
          </div>

          <div class="dip-presets">
            <button class="dip-btn ${state.ruleset === 'evolved' ? 'active' : ''}" id="preset-evolved">
              ★ EVOLVED ARCADE+ (DEFAULT)
            </button>
            <button class="dip-btn ${state.ruleset === 'purist' ? 'active' : ''}" id="preset-purist">
              🕹 CLASSIC 1987 PURIST
            </button>
            <button class="dip-btn ${state.visualPreset === 'hd_neon' ? 'active' : ''}" id="vis-hd">
              ✨ HD NEON SHADER
            </button>
            <button class="dip-btn ${state.visualPreset === 'crt_1987' ? 'active' : ''}" id="vis-crt">
              📺 1987 TRINITRON CRT [F2]
            </button>
          </div>

          <div class="dip-grid">
            <label class="dip-row">
              <span>Upgrade Slot Synergy & Stacking</span>
              <input type="checkbox" id="chk-stack" ${state.upgradeStacking ? 'checked' : ''} />
            </label>
            <label class="dip-row">
              <span>Reserve Capsule Hold Bay</span>
              <input type="checkbox" id="chk-reserve" ${state.reserveCapsule ? 'checked' : ''} />
            </label>
            <label class="dip-row">
              <span>20s Stalemate Orbital Breaker</span>
              <input type="checkbox" id="chk-stalemate" ${state.stalemateBreaker ? 'checked' : ''} />
            </label>
            <label class="dip-row">
              <span>Discrete 7-Zone 1987 Bounce</span>
              <input type="checkbox" id="chk-discrete" ${state.discreteBounceZones ? 'checked' : ''} />
            </label>
            <label class="dip-row">
              <span>Optical Spinner Pointer Lock</span>
              <input type="checkbox" id="chk-lock" ${state.pointerLock ? 'checked' : ''} />
            </label>
            <label class="dip-row">
              <span>CRT Barrel Curvature</span>
              <input type="checkbox" id="chk-curve" ${state.crtCurvature ? 'checked' : ''} />
            </label>
            <label class="dip-row">
              <span>Colorblind Brick/Capsule Symbols</span>
              <input type="checkbox" id="chk-cb" ${state.colorblindSymbols ? 'checked' : ''} />
            </label>
            <label class="dip-row">
              <span>Boss/Heavy Impact Hit-Stop</span>
              <input type="checkbox" id="chk-hitstop" ${state.hitStop ? 'checked' : ''} />
            </label>

            <div class="dip-row">
              <span>Spinner Sensitivity (${state.mouseSensitivity.toFixed(2)}x)</span>
              <input type="range" id="rng-sens" min="0.35" max="2.5" step="0.05" value="${state.mouseSensitivity}" />
            </div>
            <div class="dip-row">
              <span>Cabinet Game Speed (${Math.round(state.gameSpeed * 100)}%)</span>
              <input type="range" id="rng-speed" min="0.7" max="1.3" step="0.05" value="${state.gameSpeed}" />
            </div>
            <div class="dip-row">
              <span>Screen Shake (${Math.round(state.screenShake * 100)}%)</span>
              <input type="range" id="rng-shake" min="0" max="1" step="0.05" value="${state.screenShake}" />
            </div>
            <div class="dip-row">
              <span>Master Volume (${Math.round(state.masterVolume * 100)}%)</span>
              <input type="range" id="rng-master" min="0" max="1" step="0.05" value="${state.masterVolume}" />
            </div>
            <div class="dip-row">
              <span>FM SFX Volume (${Math.round(state.sfxVolume * 100)}%)</span>
              <input type="range" id="rng-sfx" min="0" max="1" step="0.05" value="${state.sfxVolume}" />
            </div>
            <div class="dip-row">
              <span>FM Music Volume (${Math.round(state.musicVolume * 100)}%)</span>
              <input type="range" id="rng-music" min="0" max="1" step="0.05" value="${state.musicVolume}" />
            </div>
          </div>

          <div class="dip-footer">
            <button class="dip-btn danger" id="dip-reset-scores">RESET HIGH SCORES</button>
            <button class="dip-btn active" id="dip-close-bottom">SAVE &amp; RETURN</button>
          </div>
        </div>
      `;

      const commit = (reRender = true) => {
        this.callbacks.onUiSound?.();
        this.callbacks.onChange({ ...state });
        if (reRender) renderContent();
      };

      backdrop.querySelector('#preset-evolved')?.addEventListener('click', () => {
        state.ruleset = 'evolved';
        state.upgradeStacking = true;
        state.reserveCapsule = true;
        state.stalemateBreaker = true;
        state.discreteBounceZones = false;
        commit();
      });

      backdrop.querySelector('#preset-purist')?.addEventListener('click', () => {
        state.ruleset = 'purist';
        state.upgradeStacking = false;
        state.reserveCapsule = false;
        state.stalemateBreaker = false;
        state.discreteBounceZones = true;
        commit();
      });

      backdrop.querySelector('#vis-hd')?.addEventListener('click', () => {
        state.visualPreset = 'hd_neon';
        commit();
      });

      backdrop.querySelector('#vis-crt')?.addEventListener('click', () => {
        state.visualPreset = 'crt_1987';
        commit();
      });

      const bindChk = (id: string, key: keyof DipSwitchSettings) => {
        backdrop.querySelector(id)?.addEventListener('change', (e) => {
          (state[key] as boolean) = (e.target as HTMLInputElement).checked;
          commit(false);
        });
      };
      bindChk('#chk-stack', 'upgradeStacking');
      bindChk('#chk-reserve', 'reserveCapsule');
      bindChk('#chk-stalemate', 'stalemateBreaker');
      bindChk('#chk-discrete', 'discreteBounceZones');
      bindChk('#chk-lock', 'pointerLock');
      bindChk('#chk-curve', 'crtCurvature');
      bindChk('#chk-cb', 'colorblindSymbols');
      bindChk('#chk-hitstop', 'hitStop');

      const bindRng = (id: string, key: keyof DipSwitchSettings) => {
        backdrop.querySelector(id)?.addEventListener('input', (e) => {
          (state[key] as number) = parseFloat((e.target as HTMLInputElement).value);
          this.callbacks.onChange({ ...state });
        });
        backdrop.querySelector(id)?.addEventListener('change', () => renderContent());
      };
      bindRng('#rng-sens', 'mouseSensitivity');
      bindRng('#rng-speed', 'gameSpeed');
      bindRng('#rng-shake', 'screenShake');
      bindRng('#rng-master', 'masterVolume');
      bindRng('#rng-sfx', 'sfxVolume');
      bindRng('#rng-music', 'musicVolume');

      backdrop.querySelector('#dip-reset-scores')?.addEventListener('click', () => {
        this.callbacks.onUiSound?.();
        this.callbacks.onResetScores();
      });

      const closeFn = () => {
        this.callbacks.onUiSound?.();
        this.close();
        this.callbacks.onClose();
      };
      backdrop.querySelector('#dip-close-top')?.addEventListener('click', closeFn);
      backdrop.querySelector('#dip-close-bottom')?.addEventListener('click', closeFn);
    };

    renderContent();
    this.overlayRoot.appendChild(backdrop);
  }

  public close(): void {
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
  }

  public isOpen(): boolean {
    return this.container !== null;
  }
}
