import type { BrickKind, CapsuleType } from '../types';

export type MusicTrack =
  | 'none'
  | 'attract'
  | 'sector'
  | 'boss_mid'
  | 'boss_doh1'
  | 'boss_doh2'
  | 'victory';

interface FMVoiceOptions {
  freq: number;
  freqEnd?: number;
  duration: number;
  startTime?: number;
  carrierType?: OscillatorType;
  modType?: OscillatorType;
  modRatio?: number;
  modIndex?: number;
  modIndexEnd?: number;
  gain?: number;
  attack?: number;
  decay?: number;
  pan?: number;
  bus?: 'sfx' | 'music';
}

interface NoiseBurstOptions {
  duration: number;
  startTime?: number;
  gain?: number;
  attack?: number;
  filterType?: BiquadFilterType;
  filterFreq?: number;
  filterFreqEnd?: number;
  q?: number;
  metallic?: boolean;
  bus?: 'sfx' | 'music';
}

interface TrackStepPattern {
  bpm: number;
  stepsPerBeat: number;
  length: number;
  bass: readonly (number | null)[];
  lead: readonly (number | null)[];
  arp: readonly (number | null)[];
  drum: readonly ('k' | 's' | 'h' | 'o' | 'ks' | null)[];
  leadStyle: 'brass' | 'bell' | 'cyber' | 'dread';
  bassStyle: 'slap' | 'sub' | 'grit';
  arpGain: number;
  leadGain: number;
  bassGain: number;
  drumGain: number;
}

const BRICK_BASE_MIDI: Record<BrickKind, number> = {
  white: 64,   // E4
  orange: 66,  // F#4
  cyan: 67,    // G4
  green: 69,   // A4
  red: 71,     // B4
  blue: 72,    // C5
  magenta: 74, // D5
  yellow: 76,  // E5
  silver: 69,  // A4
  regen: 71,   // B4
  gold: 79,    // G5
};

// Bright Lydian/Major arcade combo intervals (semitones)
const COMBO_SCALE_OFFSETS = [
  0, 2, 4, 6, 7, 9, 11, 12,
  14, 16, 18, 19, 21, 23, 24, 26,
];

function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

// Procedural Zuntata-inspired YM2151 + PSG track definitions (MIDI note numbers)
const TRACK_PATTERNS: Record<Exclude<MusicTrack, 'none'>, TrackStepPattern> = {
  attract: {
    bpm: 124,
    stepsPerBeat: 4,
    length: 32,
    // D Dorian / Minor cosmic arcade theme
    bass: [
      38, null, 38, 50, null, 38, 48, 50,
      34, null, 34, 46, null, 34, 45, 46,
      36, null, 36, 48, null, 36, 48, 50,
      33, null, 33, 45, 36, null, 37, null,
    ],
    lead: [
      62, null, 69, null, 67, 65, null, 64,
      65, null, null, 62, 60, null, 58, null,
      60, null, 67, null, 65, 64, null, 67,
      69, null, null, 72, 71, null, 69, null,
    ],
    arp: [
      74, 77, 81, 77, 74, 77, 81, 86,
      70, 74, 77, 74, 70, 74, 77, 82,
      72, 76, 79, 76, 72, 76, 79, 84,
      69, 73, 76, 81, 72, 76, 73, 79,
    ],
    drum: [
      'k', 'h', 'h', 'h', 's', 'h', 'h', 'k',
      'k', 'h', 'o', 'h', 's', 'h', 'h', 'h',
      'k', 'h', 'h', 'h', 's', 'h', 'h', 'k',
      'k', 'h', 'o', 'k', 's', 'h', 's', 'o',
    ],
    leadStyle: 'brass',
    bassStyle: 'slap',
    arpGain: 0.05,
    leadGain: 0.11,
    bassGain: 0.14,
    drumGain: 0.09,
  },

  sector: {
    bpm: 128,
    stepsPerBeat: 4,
    length: 32,
    // Sleek futuristic cruise (low-clutter mix so brick combos shine)
    bass: [
      45, null, 45, null, 57, null, 45, 55,
      41, null, 41, null, 53, null, 41, 52,
      43, null, 43, null, 55, null, 43, 50,
      40, null, 40, 52, 43, null, 44, null,
    ],
    lead: [
      null, null, 69, null, 71, null, 72, null,
      76, null, null, 74, 72, null, 69, null,
      null, null, 67, null, 69, null, 71, null,
      72, null, 74, null, 76, null, null, null,
    ],
    arp: [
      69, 72, 76, 81, 69, 72, 76, 79,
      65, 69, 72, 77, 65, 69, 72, 76,
      67, 71, 74, 79, 67, 71, 74, 77,
      64, 68, 71, 76, 67, 71, 68, 74,
    ],
    drum: [
      'k', null, 'h', null, 's', null, 'h', 'k',
      null, 'h', 'h', null, 's', null, 'o', null,
      'k', null, 'h', null, 's', null, 'h', 'k',
      null, 'h', 'o', null, 's', 'h', 'h', null,
    ],
    leadStyle: 'bell',
    bassStyle: 'sub',
    arpGain: 0.045,
    leadGain: 0.075,
    bassGain: 0.12,
    drumGain: 0.065,
  },

  boss_mid: {
    bpm: 150,
    stepsPerBeat: 4,
    length: 32,
    // Urgent E-minor / Phrygian dominant mechanical sentinel battle
    bass: [
      40, 40, 52, 40, 43, 40, 46, 45,
      40, 40, 52, 40, 48, 47, 45, 43,
      36, 36, 48, 36, 39, 36, 48, 36,
      35, 35, 47, 35, 43, 42, 40, 39,
    ],
    lead: [
      64, null, 67, 64, 70, null, 69, 67,
      64, null, 76, null, 75, 72, 71, null,
      60, null, 64, 67, 72, null, 71, 67,
      71, null, 75, null, 76, null, 78, null,
    ],
    arp: [
      76, 79, 83, 79, 76, 82, 81, 79,
      76, 79, 83, 88, 87, 84, 83, 79,
      72, 76, 79, 84, 72, 76, 79, 83,
      71, 75, 78, 83, 75, 78, 83, 87,
    ],
    drum: [
      'k', 'h', 'k', 'h', 's', 'h', 'k', 'h',
      'k', 'h', 'o', 'k', 's', 'h', 's', 'o',
      'k', 'h', 'k', 'h', 's', 'h', 'k', 'h',
      'k', 'k', 's', 'h', 'ks', 'h', 's', 'o',
    ],
    leadStyle: 'cyber',
    bassStyle: 'grit',
    arpGain: 0.05,
    leadGain: 0.11,
    bassGain: 0.15,
    drumGain: 0.10,
  },

  boss_doh1: {
    bpm: 136,
    stepsPerBeat: 4,
    length: 32,
    // Monolithic, ominous DOH Phase 1 dread ostinato (C diminished / Hungarian minor)
    bass: [
      36, null, 36, 42, 43, null, 36, 37,
      36, null, 36, 42, 44, null, 42, 37,
      35, null, 35, 41, 43, null, 35, 36,
      33, null, 39, null, 38, null, 37, null,
    ],
    lead: [
      60, null, null, 66, 67, null, 63, null,
      61, null, null, 60, null, 59, 60, null,
      62, null, null, 68, 67, null, 63, null,
      66, null, 65, null, 63, null, 62, null,
    ],
    arp: [
      72, 75, 78, 84, 73, 78, 75, 72,
      72, 75, 80, 84, 78, 75, 73, 72,
      71, 74, 77, 83, 79, 77, 74, 71,
      69, 75, 78, 81, 68, 74, 77, 80,
    ],
    drum: [
      'k', null, 'h', 'k', 's', null, 'k', 'h',
      'k', null, 'o', null, 's', 'k', 'h', 'o',
      'k', null, 'h', 'k', 's', null, 'k', 'h',
      'ks', null, 'k', 's', 'ks', 'h', 's', 'o',
    ],
    leadStyle: 'dread',
    bassStyle: 'grit',
    arpGain: 0.05,
    leadGain: 0.12,
    bassGain: 0.16,
    drumGain: 0.10,
  },

  boss_doh2: {
    bpm: 170,
    stepsPerBeat: 4,
    length: 32,
    // Frantic, climatic DOH Phase 2 dimensional meltdown (F# harmonic minor -> G)
    bass: [
      42, 42, 54, 42, 45, 42, 49, 42,
      43, 43, 55, 43, 46, 43, 41, 41,
      42, 42, 54, 42, 50, 50, 49, 49,
      47, 47, 45, 45, 44, 44, 41, 41,
    ],
    lead: [
      66, 69, 73, null, 74, 73, 69, 73,
      74, null, 76, 74, 73, null, 77, null,
      78, 76, 73, null, 81, null, 80, 78,
      77, null, 74, 73, 71, 73, 77, null,
    ],
    arp: [
      78, 81, 85, 90, 78, 81, 85, 89,
      79, 82, 86, 91, 77, 80, 85, 89,
      78, 81, 85, 90, 86, 81, 85, 89,
      83, 86, 81, 85, 80, 83, 77, 85,
    ],
    drum: [
      'k', 'h', 's', 'h', 'k', 'k', 's', 'o',
      'k', 'h', 's', 'h', 'k', 'o', 'ks', 'h',
      'k', 'h', 's', 'h', 'k', 'k', 's', 'o',
      'ks', 'h', 'ks', 'h', 's', 's', 'ks', 'o',
    ],
    leadStyle: 'cyber',
    bassStyle: 'grit',
    arpGain: 0.055,
    leadGain: 0.12,
    bassGain: 0.16,
    drumGain: 0.11,
  },

  victory: {
    bpm: 132,
    stepsPerBeat: 4,
    length: 32,
    // Triumphant Zuntata-style C Lydian / Major ending fanfare loop
    bass: [
      36, null, 48, null, 43, null, 48, null,
      45, null, 57, null, 40, null, 52, null,
      41, null, 53, null, 43, null, 55, null,
      45, null, 43, null, 41, null, 43, null,
    ],
    lead: [
      72, null, 76, 79, 84, null, 83, 79,
      81, null, 79, 76, 79, null, null, null,
      77, null, 81, 84, 86, null, 84, 83,
      84, null, 79, null, 81, 83, 84, null,
    ],
    arp: [
      72, 76, 79, 83, 72, 76, 79, 84,
      69, 72, 76, 81, 67, 71, 76, 79,
      69, 72, 77, 81, 71, 74, 79, 83,
      72, 76, 81, 84, 74, 77, 79, 83,
    ],
    drum: [
      'k', 'h', 'h', 'h', 's', 'h', 'h', 'k',
      'k', 'h', 'o', 'h', 's', 'h', 'h', 'o',
      'k', 'h', 'h', 'k', 's', 'h', 'o', 'h',
      'k', 's', 'k', 's', 'ks', 'h', 's', 'o',
    ],
    leadStyle: 'brass',
    bassStyle: 'slap',
    arpGain: 0.06,
    leadGain: 0.13,
    bassGain: 0.14,
    drumGain: 0.085,
  },
};

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private musicDuckGain: GainNode | null = null;
  private whiteNoiseBuffer: AudioBuffer | null = null;
  private metallicNoiseBuffer: AudioBuffer | null = null;

  private masterVol = 0.8;
  private sfxVol = 0.85;
  private musicVol = 0.55;

  private currentTrack: MusicTrack = 'none';
  private schedulerId: ReturnType<typeof setInterval> | null = null;
  private nextNoteTime = 0;
  private currentStep = 0;

  // Rate-limiting timestamps (in seconds on AudioContext clock or performance clock)
  private lastSfxTime: Record<string, number> = {};

  private ensureContext(allowCreate = false): AudioContext | null {
    if (this.ctx) {
      return this.ctx;
    }
    if (!allowCreate || typeof window === 'undefined') {
      return null;
    }

    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;

      const ctx = new AudioCtx();
      this.ctx = ctx;

      // Dynamics compressor for authentic arcade punch and multi-ball headroom
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -10;
      comp.knee.value = 14;
      comp.ratio.value = 5;
      comp.attack.value = 0.003;
      comp.release.value = 0.16;
      comp.connect(ctx.destination);

      const master = ctx.createGain();
      master.gain.value = this.masterVol;
      master.connect(comp);
      this.masterGain = master;

      const sfx = ctx.createGain();
      sfx.gain.value = this.sfxVol;
      sfx.connect(master);
      this.sfxGain = sfx;

      // Music bus passes through a gentle high-shelf / low-cut friendliness & ducking node
      const musicDuck = ctx.createGain();
      musicDuck.gain.value = 1.0;
      musicDuck.connect(master);
      this.musicDuckGain = musicDuck;

      const music = ctx.createGain();
      music.gain.value = this.musicVol;
      music.connect(musicDuck);
      this.musicGain = music;

      this.buildNoiseBuffers(ctx);
      return ctx;
    } catch {
      this.ctx = null;
      return null;
    }
  }

  private buildNoiseBuffers(ctx: AudioContext): void {
    const sampleRate = ctx.sampleRate;
    const len = Math.floor(sampleRate * 1.5);

    // 1. Standard white noise buffer
    const whiteBuf = ctx.createBuffer(1, len, sampleRate);
    const whiteData = whiteBuf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      whiteData[i] = Math.random() * 2 - 1;
    }
    this.whiteNoiseBuffer = whiteBuf;

    // 2. Arcade PSG LFSR-inspired crunchy metallic noise buffer
    const metalBuf = ctx.createBuffer(1, len, sampleRate);
    const metalData = metalBuf.getChannelData(0);
    let lfsr = 0x7fff;
    let hold = 0;
    let currentSample = 1;
    for (let i = 0; i < len; i++) {
      if (hold <= 0) {
        const bit = ((lfsr >> 0) ^ (lfsr >> 1) ^ (lfsr >> 4)) & 1;
        lfsr = (lfsr >> 1) | (bit << 14);
        currentSample = (lfsr & 1) ? 0.9 : -0.9;
        hold = 3 + (i % 2);
      }
      hold--;
      metalData[i] = currentSample;
    }
    this.metallicNoiseBuffer = metalBuf;
  }

  private readyCtx(): AudioContext | null {
    const ctx = this.ensureContext(true);
    if (!ctx) return null;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    if (ctx.state !== 'running') {
      // Avoid queuing huge bursts while browser still blocks autoplay
      return null;
    }
    return ctx;
  }

  private throttled(key: string, minGapSec: number, now: number): boolean {
    const prev = this.lastSfxTime[key] ?? -999;
    if (now - prev < minGapSec) {
      return true;
    }
    this.lastSfxTime[key] = now;
    return false;
  }

  private duckMusic(durationSec: number, dipLevel = 0.25): void {
    const ctx = this.ctx;
    const duck = this.musicDuckGain;
    if (!ctx || !duck) return;
    const now = ctx.currentTime;
    try {
      duck.gain.cancelScheduledValues(now);
      duck.gain.setValueAtTime(duck.gain.value, now);
      duck.gain.linearRampToValueAtTime(dipLevel, now + 0.02);
      duck.gain.setValueAtTime(dipLevel, now + Math.max(0.05, durationSec - 0.18));
      duck.gain.linearRampToValueAtTime(1.0, now + durationSec + 0.12);
    } catch {
      // Ignore scheduling edge cases
    }
  }

  private getBus(bus: 'sfx' | 'music' = 'sfx'): AudioNode | null {
    return bus === 'music' ? this.musicGain : this.sfxGain;
  }

  /**
   * Core YM2151-inspired 2-Operator FM Voice
   */
  private playFM(opts: FMVoiceOptions): void {
    const ctx = this.ctx;
    const dest = this.getBus(opts.bus ?? 'sfx');
    if (!ctx || !dest) return;

    const t0 = Math.max(ctx.currentTime, opts.startTime ?? ctx.currentTime);
    const dur = Math.max(0.012, opts.duration);
    const tEnd = t0 + dur;
    const attack = Math.min(dur * 0.45, Math.max(0.0015, opts.attack ?? 0.004));
    const peakGain = Math.max(0.0002, opts.gain ?? 0.18);

    const fStart = clamp(opts.freq, 18, 16000);
    const fEnd = opts.freqEnd !== undefined ? clamp(opts.freqEnd, 18, 16000) : fStart;

    const modRatio = opts.modRatio ?? 2.0;
    const modIdxStart = opts.modIndex ?? 1.5;
    const modIdxEnd = opts.modIndexEnd ?? modIdxStart * 0.15;

    const carrier = ctx.createOscillator();
    carrier.type = opts.carrierType ?? 'sine';
    carrier.frequency.setValueAtTime(fStart, t0);
    if (fEnd !== fStart) {
      carrier.frequency.exponentialRampToValueAtTime(fEnd, tEnd);
    }

    const mod = ctx.createOscillator();
    mod.type = opts.modType ?? 'sine';
    mod.frequency.setValueAtTime(fStart * modRatio, t0);
    if (fEnd !== fStart) {
      mod.frequency.exponentialRampToValueAtTime(fEnd * modRatio, tEnd);
    }

    const modGain = ctx.createGain();
    const devStart = Math.max(0.1, fStart * modIdxStart);
    const devEnd = Math.max(0.1, fEnd * modIdxEnd);
    modGain.gain.setValueAtTime(devStart, t0);
    modGain.gain.exponentialRampToValueAtTime(devEnd, tEnd);

    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, t0);
    amp.gain.linearRampToValueAtTime(peakGain, t0 + attack);
    if (opts.decay !== undefined && t0 + attack + opts.decay < tEnd) {
      amp.gain.exponentialRampToValueAtTime(peakGain * 0.35, t0 + attack + opts.decay);
    }
    amp.gain.exponentialRampToValueAtTime(0.0001, tEnd);

    mod.connect(modGain);
    modGain.connect(carrier.frequency);
    carrier.connect(amp);

    let finalNode: AudioNode = amp;
    if (opts.pan !== undefined && typeof ctx.createStereoPanner === 'function') {
      const panner = ctx.createStereoPanner();
      panner.pan.setValueAtTime(clamp(opts.pan, -1, 1), t0);
      amp.connect(panner);
      finalNode = panner;
    }

    finalNode.connect(dest);

    mod.start(t0);
    carrier.start(t0);
    const stopAt = tEnd + 0.02;
    mod.stop(stopAt);
    carrier.stop(stopAt);
  }

  /**
   * Filtered White / Arcade LFSR Noise Burst for percussion, explosions, iris slides
   */
  private playNoise(opts: NoiseBurstOptions): void {
    const ctx = this.ctx;
    const dest = this.getBus(opts.bus ?? 'sfx');
    const buf = opts.metallic ? this.metallicNoiseBuffer : this.whiteNoiseBuffer;
    if (!ctx || !dest || !buf) return;

    const t0 = Math.max(ctx.currentTime, opts.startTime ?? ctx.currentTime);
    const dur = Math.max(0.01, opts.duration);
    const tEnd = t0 + dur;
    const attack = Math.min(dur * 0.4, Math.max(0.001, opts.attack ?? 0.002));
    const peakGain = Math.max(0.0002, opts.gain ?? 0.16);

    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const maxOffset = Math.max(0, buf.duration - Math.min(dur, buf.duration) - 0.05);
    const randomOffset = Math.random() * maxOffset;

    const filter = ctx.createBiquadFilter();
    filter.type = opts.filterType ?? 'bandpass';
    const f0 = clamp(opts.filterFreq ?? 1800, 35, 16000);
    filter.frequency.setValueAtTime(f0, t0);
    if (opts.filterFreqEnd !== undefined) {
      filter.frequency.exponentialRampToValueAtTime(clamp(opts.filterFreqEnd, 35, 16000), tEnd);
    }
    filter.Q.setValueAtTime(opts.q ?? 1.5, t0);

    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, t0);
    amp.gain.linearRampToValueAtTime(peakGain, t0 + attack);
    amp.gain.exponentialRampToValueAtTime(0.0001, tEnd);

    src.connect(filter);
    filter.connect(amp);
    amp.connect(dest);

    src.start(t0, randomOffset);
    src.stop(tEnd + 0.02);
  }

  // =========================================================================
  // PUBLIC LIFECYCLE & MIXING API
  // =========================================================================

  unlock(): void {
    try {
      const ctx = this.ensureContext(true);
      if (!ctx) return;

      const onRunning = () => {
        if (this.currentTrack !== 'none' && this.schedulerId === null) {
          this.beginScheduler();
        }
      };

      if (ctx.state === 'suspended') {
        ctx.resume().then(onRunning).catch(() => {});
      } else {
        onRunning();
      }
    } catch {
      // Never throw if browser audio is unavailable
    }
  }

  setVolumes(master: number, sfx: number, music: number): void {
    this.masterVol = clamp(master, 0, 1);
    this.sfxVol = clamp(sfx, 0, 1);
    this.musicVol = clamp(music, 0, 1);

    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    try {
      if (this.masterGain) {
        this.masterGain.gain.setTargetAtTime(this.masterVol, now, 0.015);
      }
      if (this.sfxGain) {
        this.sfxGain.gain.setTargetAtTime(this.sfxVol, now, 0.015);
      }
      if (this.musicGain) {
        this.musicGain.gain.setTargetAtTime(this.musicVol, now, 0.015);
      }
    } catch {
      // Ignore if context closed
    }
  }

  startMusic(track: MusicTrack): void {
    if (track === 'none') {
      this.stopMusic();
      return;
    }

    if (this.currentTrack === track && this.schedulerId !== null) {
      return;
    }

    this.currentTrack = track;
    this.stopSchedulerOnly();

    const ctx = this.ensureContext(false);
    if (ctx && ctx.state === 'running') {
      this.beginScheduler();
    }
  }

  stopMusic(): void {
    this.currentTrack = 'none';
    this.stopSchedulerOnly();
  }

  private stopSchedulerOnly(): void {
    if (this.schedulerId !== null) {
      clearInterval(this.schedulerId);
      this.schedulerId = null;
    }
  }

  private beginScheduler(): void {
    this.stopSchedulerOnly();
    const ctx = this.ctx;
    if (!ctx || this.currentTrack === 'none') return;

    this.currentStep = 0;
    this.nextNoteTime = ctx.currentTime + 0.05;

    this.schedulerId = setInterval(() => {
      this.scheduleTick();
    }, 45);
  }

  private scheduleTick(): void {
    const ctx = this.ctx;
    const track = this.currentTrack;
    if (!ctx || track === 'none') {
      this.stopSchedulerOnly();
      return;
    }
    if (ctx.state !== 'running') {
      return;
    }

    const pattern = TRACK_PATTERNS[track];
    const stepDur = 60 / pattern.bpm / pattern.stepsPerBeat;
    const lookahead = 0.13;

    // Resync if tab was backgrounded
    if (this.nextNoteTime < ctx.currentTime - 0.25) {
      this.nextNoteTime = ctx.currentTime + 0.03;
    }

    while (this.nextNoteTime < ctx.currentTime + lookahead) {
      this.schedulePatternStep(pattern, this.currentStep, this.nextNoteTime, stepDur);
      this.nextNoteTime += stepDur;
      this.currentStep = (this.currentStep + 1) % pattern.length;
    }
  }

  private schedulePatternStep(
    pattern: TrackStepPattern,
    step: number,
    time: number,
    stepDur: number
  ): void {
    // 1. Bassline (YM2151 2-op FM Bass)
    const bassMidi = pattern.bass[step];
    if (bassMidi !== null && bassMidi !== undefined) {
      const freq = midiToHz(bassMidi);
      if (pattern.bassStyle === 'slap') {
        this.playFM({
          freq,
          duration: stepDur * 1.55,
          startTime: time,
          modRatio: 2.0,
          modIndex: 3.4,
          modIndexEnd: 0.35,
          gain: pattern.bassGain,
          attack: 0.003,
          decay: stepDur * 0.6,
          bus: 'music',
        });
      } else if (pattern.bassStyle === 'grit') {
        this.playFM({
          freq,
          duration: stepDur * 1.2,
          startTime: time,
          carrierType: 'triangle',
          modType: 'sawtooth',
          modRatio: 1.0,
          modIndex: 2.8,
          modIndexEnd: 0.8,
          gain: pattern.bassGain,
          attack: 0.003,
          bus: 'music',
        });
      } else {
        this.playFM({
          freq,
          duration: stepDur * 1.7,
          startTime: time,
          modRatio: 1.0,
          modIndex: 1.6,
          modIndexEnd: 0.25,
          gain: pattern.bassGain,
          attack: 0.006,
          bus: 'music',
        });
      }
    }

    // 2. Arpeggio / Shimmer Channel
    const arpMidi = pattern.arp[step];
    if (arpMidi !== null && arpMidi !== undefined) {
      this.playFM({
        freq: midiToHz(arpMidi),
        duration: stepDur * 0.95,
        startTime: time,
        modRatio: 3.0,
        modIndex: 1.2,
        modIndexEnd: 0.1,
        gain: pattern.arpGain,
        attack: 0.003,
        pan: step % 2 === 0 ? -0.28 : 0.28,
        bus: 'music',
      });
    }

    // 3. Lead Melody (YM2151 Brass / Crystalline Bell / Cyber / Dread)
    const leadMidi = pattern.lead[step];
    if (leadMidi !== null && leadMidi !== undefined) {
      // Peek ahead to extend sustained notes across null rests
      let holdSteps = 1;
      while (
        holdSteps < 4 &&
        step + holdSteps < pattern.length &&
        pattern.lead[step + holdSteps] === null
      ) {
        holdSteps++;
      }
      const freq = midiToHz(leadMidi);
      const noteDur = stepDur * (holdSteps * 0.92);

      switch (pattern.leadStyle) {
        case 'brass':
          this.playFM({
            freq,
            duration: noteDur,
            startTime: time,
            carrierType: 'sawtooth',
            modRatio: 1.0,
            modIndex: 2.2,
            modIndexEnd: 0.65,
            gain: pattern.leadGain * 0.8,
            attack: 0.012,
            pan: 0.1,
            bus: 'music',
          });
          this.playFM({
            freq: freq * 1.004,
            duration: noteDur,
            startTime: time,
            modRatio: 2.0,
            modIndex: 1.5,
            modIndexEnd: 0.4,
            gain: pattern.leadGain * 0.55,
            attack: 0.016,
            pan: -0.1,
            bus: 'music',
          });
          break;
        case 'bell':
          this.playFM({
            freq,
            duration: noteDur * 1.15,
            startTime: time,
            modRatio: 3.5,
            modIndex: 2.1,
            modIndexEnd: 0.15,
            gain: pattern.leadGain,
            attack: 0.004,
            bus: 'music',
          });
          break;
        case 'cyber':
          this.playFM({
            freq,
            duration: noteDur,
            startTime: time,
            carrierType: 'square',
            modRatio: 2.0,
            modIndex: 2.5,
            modIndexEnd: 0.5,
            gain: pattern.leadGain * 0.72,
            attack: 0.004,
            bus: 'music',
          });
          break;
        case 'dread':
          this.playFM({
            freq,
            duration: noteDur * 1.05,
            startTime: time,
            modRatio: 1.414,
            modIndex: 2.6,
            modIndexEnd: 0.7,
            gain: pattern.leadGain,
            attack: 0.01,
            bus: 'music',
          });
          break;
      }
    }

    // 4. Arcade PSG / FM Percussion
    const drum = pattern.drum[step];
    if (drum) {
      const dg = pattern.drumGain;
      if (drum === 'k' || drum === 'ks') {
        this.playFM({
          freq: 145,
          freqEnd: 38,
          duration: 0.095,
          startTime: time,
          modRatio: 1.5,
          modIndex: 2.0,
          modIndexEnd: 0.1,
          gain: dg * 1.35,
          attack: 0.0015,
          bus: 'music',
        });
      }
      if (drum === 's' || drum === 'ks') {
        this.playNoise({
          duration: 0.11,
          startTime: time,
          gain: dg * 0.95,
          filterType: 'bandpass',
          filterFreq: 2400,
          filterFreqEnd: 950,
          q: 1.1,
          bus: 'music',
        });
        this.playFM({
          freq: 210,
          freqEnd: 115,
          duration: 0.055,
          startTime: time,
          modRatio: 2.3,
          modIndex: 1.8,
          gain: dg * 0.7,
          bus: 'music',
        });
      }
      if (drum === 'h') {
        this.playNoise({
          duration: 0.032,
          startTime: time,
          gain: dg * 0.45,
          filterType: 'highpass',
          filterFreq: 7500,
          q: 0.8,
          bus: 'music',
        });
      }
      if (drum === 'o') {
        this.playNoise({
          duration: 0.11,
          startTime: time,
          gain: dg * 0.52,
          filterType: 'highpass',
          filterFreq: 6800,
          q: 1.2,
          bus: 'music',
        });
      }
    }
  }

  // =========================================================================
  // ARCADE SOUND EFFECTS (100% Procedural YM2151 FM + PSG)
  // =========================================================================

  /** Classic Taito 2-tone coin chime (B5 -> E6) */
  coin(): void {
    const ctx = this.readyCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    this.playFM({
      freq: 987.77, // B5
      duration: 0.09,
      startTime: now,
      carrierType: 'triangle',
      modRatio: 3.0,
      modIndex: 2.2,
      modIndexEnd: 0.3,
      gain: 0.24,
      attack: 0.002,
    });
    this.playFM({
      freq: 1318.51, // E6
      duration: 0.38,
      startTime: now + 0.075,
      carrierType: 'triangle',
      modRatio: 3.0,
      modIndex: 2.5,
      modIndexEnd: 0.15,
      gain: 0.26,
      attack: 0.002,
    });
  }

  /** Energetic arcade start fanfare */
  startGame(): void {
    const ctx = this.readyCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    this.duckMusic(0.75, 0.3);

    const notes = [523.25, 659.25, 783.99, 987.77, 1046.5]; // C5 E5 G5 B5 C6
    notes.forEach((f, idx) => {
      const isLast = idx === notes.length - 1;
      const t = now + idx * 0.068;
      this.playFM({
        freq: f,
        duration: isLast ? 0.36 : 0.11,
        startTime: t,
        carrierType: 'sawtooth',
        modRatio: 2.0,
        modIndex: 2.4,
        modIndexEnd: 0.4,
        gain: isLast ? 0.22 : 0.18,
        attack: 0.004,
      });
      if (isLast) {
        this.playFM({
          freq: f * 0.5,
          duration: 0.36,
          startTime: t,
          modRatio: 1.0,
          modIndex: 2.0,
          gain: 0.16,
          attack: 0.005,
        });
      }
    });
  }

  /** Iconic Arkanoid stage-ready brassy YM2151 FM fanfare */
  stageIntro(): void {
    const ctx = this.readyCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    this.duckMusic(1.85, 0.12);

    const phrase: Array<{ t: number; d: number; lead: number; harm: number; bass?: number }> = [
      { t: 0.00, d: 0.13, lead: 69, harm: 64, bass: 45 }, // A4 + E4
      { t: 0.14, d: 0.13, lead: 69, harm: 64 },
      { t: 0.28, d: 0.13, lead: 69, harm: 64 },
      { t: 0.42, d: 0.32, lead: 74, harm: 69, bass: 50 }, // D5 + A4
      { t: 0.76, d: 0.16, lead: 72, harm: 67, bass: 48 }, // C5 + G4
      { t: 0.94, d: 0.16, lead: 74, harm: 69, bass: 50 }, // D5 + A4
      { t: 1.12, d: 0.62, lead: 76, harm: 71, bass: 52 }, // E5 + B4 heroic hold
    ];

    for (const step of phrase) {
      const t = now + step.t;
      // Brass Voice 1
      this.playFM({
        freq: midiToHz(step.lead),
        duration: step.d,
        startTime: t,
        carrierType: 'sawtooth',
        modRatio: 1.0,
        modIndex: 2.8,
        modIndexEnd: 0.75,
        gain: 0.17,
        attack: 0.012,
        pan: -0.15,
      });
      // Brass Harmony Voice 2
      this.playFM({
        freq: midiToHz(step.harm),
        duration: step.d,
        startTime: t,
        carrierType: 'sawtooth',
        modRatio: 2.0,
        modIndex: 2.1,
        modIndexEnd: 0.6,
        gain: 0.12,
        attack: 0.014,
        pan: 0.15,
      });
      if (step.bass !== undefined) {
        this.playFM({
          freq: midiToHz(step.bass),
          duration: step.d * 1.05,
          startTime: t,
          modRatio: 2.0,
          modIndex: 3.2,
          modIndexEnd: 0.4,
          gain: 0.16,
          attack: 0.004,
        });
      }
    }
  }

  /** Crisp resonant Vaus bounce (subtle pitch & stereo variation by normOffset -1..1) */
  paddleHit(normOffset = 0): void {
    const ctx = this.readyCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    if (this.throttled('paddleHit', 0.022, now)) return;

    const off = clamp(normOffset, -1, 1);
    const edgeBoost = Math.abs(off) * 48;
    const baseFreq = 450 + edgeBoost;

    this.playFM({
      freq: baseFreq,
      freqEnd: baseFreq * 1.32,
      duration: 0.075,
      startTime: now,
      carrierType: 'triangle',
      modRatio: 2.0,
      modIndex: 2.1,
      modIndexEnd: 0.2,
      gain: 0.24,
      attack: 0.002,
      pan: off * 0.35,
    });
  }

  /** Short tight wall tick */
  wallHit(): void {
    const ctx = this.readyCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    if (this.throttled('wallHit', 0.018, now)) return;

    this.playFM({
      freq: 300,
      freqEnd: 175,
      duration: 0.038,
      startTime: now,
      carrierType: 'triangle',
      modRatio: 2.5,
      modIndex: 1.5,
      modIndexEnd: 0.1,
      gain: 0.15,
      attack: 0.0015,
    });
  }

  /** Rising harmonic pitch with combo (1..16+)! Distinct crisp Arkanoid pop */
  brickBreak(kind: BrickKind, combo = 1): void {
    const ctx = this.readyCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    if (this.throttled('brickBreak', 0.015, now)) return;

    const safeCombo = Math.max(1, Math.floor(combo));
    const scaleIdx = Math.min(COMBO_SCALE_OFFSETS.length - 1, safeCombo - 1);
    const extraOctave = safeCombo > 16 ? Math.min(5, safeCombo - 16) : 0;
    const baseMidi = BRICK_BASE_MIDI[kind] ?? 67;
    const targetMidi = clamp(baseMidi + COMBO_SCALE_OFFSETS[scaleIdx] + extraOctave, 55, 98);
    const freq = midiToHz(targetMidi);

    const isMetallic = kind === 'silver' || kind === 'regen' || kind === 'gold';

    // Crisp harmonic pop + bell body
    this.playFM({
      freq: freq * 1.06,
      freqEnd: freq,
      duration: isMetallic ? 0.17 : 0.125,
      startTime: now,
      carrierType: 'triangle',
      modRatio: isMetallic ? 2.5 : 2.0,
      modIndex: isMetallic ? 2.8 : 2.0,
      modIndexEnd: 0.18,
      gain: 0.22,
      attack: 0.002,
    });

    // Transient impact click
    this.playNoise({
      duration: 0.024,
      startTime: now,
      gain: 0.09,
      filterType: 'bandpass',
      filterFreq: 3200,
      q: 1.6,
    });

    // High-combo crystalline fifth/octave sparkle!
    if (safeCombo >= 4) {
      this.playFM({
        freq: freq * (safeCombo >= 8 ? 2.0 : 1.5),
        duration: 0.15,
        startTime: now + 0.018,
        modRatio: 3.0,
        modIndex: 1.6,
        modIndexEnd: 0.1,
        gain: safeCombo >= 8 ? 0.12 : 0.08,
        attack: 0.003,
      });
    }
  }

  /** Metallic FM clang for Silver/Regen non-lethal hit */
  brickChip(kind: BrickKind): void {
    const ctx = this.readyCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    if (this.throttled('brickChip', 0.018, now)) return;

    const isRegen = kind === 'regen';
    const baseFreq = isRegen ? 920 : 810;

    // Classic inharmonic YM2151 metallic steel clang
    this.playFM({
      freq: baseFreq,
      freqEnd: isRegen ? baseFreq * 1.06 : baseFreq * 0.97,
      duration: 0.13,
      startTime: now,
      modRatio: isRegen ? 3.14 : 2.76,
      modIndex: 3.8,
      modIndexEnd: 0.25,
      gain: 0.22,
      attack: 0.0015,
    });
  }

  /** Eerie ascending crystalline synth shimmer when Notched Silver brick regenerates */
  brickRegen(): void {
    const ctx = this.readyCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    if (this.throttled('brickRegen', 0.06, now)) return;

    const freqs = [698.46, 932.33, 1244.51, 1567.98]; // F5 Bb5 Eb6 G6 glassy quartal shimmer
    freqs.forEach((f, i) => {
      this.playFM({
        freq: f,
        duration: 0.16,
        startTime: now + i * 0.042,
        modRatio: 3.5,
        modIndex: 2.3,
        modIndexEnd: 0.12,
        gain: 0.11,
        attack: 0.005,
        pan: (i - 1.5) * 0.22,
      });
    });
  }

  /** Heavy high-pitched FM bell/anvil ping when ball hits indestructible Gold brick */
  goldClang(): void {
    const ctx = this.readyCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    if (this.throttled('goldClang', 0.018, now)) return;

    // Anvil strike transient + dual inharmonic FM bell overtones
    this.playFM({
      freq: 1318.5,
      duration: 0.22,
      startTime: now,
      modRatio: 2.414, // Classic √2 + 1 metallic bell ratio
      modIndex: 4.5,
      modIndexEnd: 0.35,
      gain: 0.23,
      attack: 0.0015,
    });
    this.playFM({
      freq: 2217.46,
      duration: 0.16,
      startTime: now,
      modRatio: 1.732,
      modIndex: 3.2,
      modIndexEnd: 0.2,
      gain: 0.13,
      attack: 0.0015,
    });
  }

  /** Twin plasma pew (heavier/deeper beam when hyper=true) */
  laserShoot(hyper = false): void {
    const ctx = this.readyCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    if (this.throttled('laserShoot', 0.032, now)) return;

    if (hyper) {
      // Hyper-Pierce Twin Cannon: heavy plasma roar + deep sub punch
      this.playFM({
        freq: 1750,
        freqEnd: 135,
        duration: 0.15,
        startTime: now,
        carrierType: 'sawtooth',
        modRatio: 1.5,
        modIndex: 3.6,
        modIndexEnd: 0.5,
        gain: 0.21,
        attack: 0.002,
        pan: -0.2,
      });
      this.playFM({
        freq: 1220,
        freqEnd: 92,
        duration: 0.17,
        startTime: now + 0.008,
        carrierType: 'square',
        modRatio: 2.0,
        modIndex: 2.8,
        modIndexEnd: 0.4,
        gain: 0.17,
        attack: 0.002,
        pan: 0.2,
      });
      this.playNoise({
        duration: 0.08,
        startTime: now,
        gain: 0.11,
        filterType: 'bandpass',
        filterFreq: 2600,
        filterFreqEnd: 600,
        q: 2.0,
      });
    } else {
      // Crisp Twin Laser Pew
      this.playFM({
        freq: 1480,
        freqEnd: 250,
        duration: 0.095,
        startTime: now,
        carrierType: 'sawtooth',
        modRatio: 2.0,
        modIndex: 2.2,
        modIndexEnd: 0.3,
        gain: 0.16,
        attack: 0.002,
        pan: -0.18,
      });
      this.playFM({
        freq: 1515,
        freqEnd: 265,
        duration: 0.095,
        startTime: now + 0.009,
        carrierType: 'triangle',
        modRatio: 2.0,
        modIndex: 2.0,
        modIndexEnd: 0.2,
        gain: 0.14,
        attack: 0.002,
        pan: 0.18,
      });
    }
  }

  /** Subtle synth chirp when capsule drops */
  capsuleDrop(): void {
    const ctx = this.readyCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    if (this.throttled('capsuleDrop', 0.04, now)) return;

    this.playFM({
      freq: 880,
      freqEnd: 1320,
      duration: 0.075,
      startTime: now,
      modRatio: 3.0,
      modIndex: 1.6,
      modIndexEnd: 0.15,
      gain: 0.11,
      attack: 0.003,
    });
  }

  /** Power-up arpeggio (warning low buzz-chime if 'R', jackpot fanfare if '?' or 'G') */
  capsuleCatch(type: CapsuleType): void {
    const ctx = this.readyCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    if (type === 'R') {
      // Hazard Reduce (2X): gritty warning buzz + tense octave chime
      const hazardNotes = [311.13, 277.18, 220.0]; // Eb4 -> Db4 -> A3
      hazardNotes.forEach((f, i) => {
        this.playFM({
          freq: f,
          duration: 0.11,
          startTime: now + i * 0.07,
          carrierType: 'sawtooth',
          modType: 'square',
          modRatio: 1.5,
          modIndex: 3.8,
          modIndexEnd: 0.9,
          gain: 0.19,
          attack: 0.003,
        });
      });
      // High 2X risk-reward ping tail
      this.playFM({
        freq: 880,
        duration: 0.18,
        startTime: now + 0.22,
        modRatio: 3.5,
        modIndex: 2.4,
        gain: 0.12,
        attack: 0.003,
      });
      return;
    }

    if (type === '?' || type === 'G') {
      // Mystery / Gold Jackpot Fanfare!
      this.duckMusic(0.65, 0.35);
      const baseShift = type === 'G' ? 2 : 0;
      const midiSeq = [72, 76, 79, 83, 84, 88, 91].map((m) => m + baseShift);
      midiSeq.forEach((m, i) => {
        const isFinal = i === midiSeq.length - 1;
        this.playFM({
          freq: midiToHz(m),
          duration: isFinal ? 0.36 : 0.085,
          startTime: now + i * 0.048,
          carrierType: 'triangle',
          modRatio: type === 'G' ? 3.0 : 2.5,
          modIndex: 2.8,
          modIndexEnd: 0.2,
          gain: isFinal ? 0.22 : 0.17,
          attack: 0.003,
          pan: ((i % 3) - 1) * 0.25,
        });
      });
      return;
    }

    // Classic bright Taito power-up arpeggio (subtly transposed by capsule family)
    const pitchOffset =
      type === 'M' || type === 'N'
        ? 4
        : type === 'B' || type === 'P'
          ? 5
          : type === 'L' || type === 'T'
            ? 2
            : 0;
    const arp = [64, 68, 71, 76].map((m) => midiToHz(m + pitchOffset));
    arp.forEach((f, i) => {
      this.playFM({
        freq: f,
        duration: i === 3 ? 0.2 : 0.075,
        startTime: now + i * 0.052,
        carrierType: 'triangle',
        modRatio: 2.0,
        modIndex: 2.2,
        modIndexEnd: 0.2,
        gain: 0.19,
        attack: 0.003,
      });
    });
  }

  /** Celebratory 1UP melody */
  extraLife(): void {
    const ctx = this.readyCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    this.duckMusic(0.85, 0.28);

    const melody = [
      { m: 76, t: 0.00, d: 0.09 }, // E5
      { m: 79, t: 0.09, d: 0.09 }, // G5
      { m: 88, t: 0.18, d: 0.11 }, // E6
      { m: 84, t: 0.29, d: 0.09 }, // C6
      { m: 86, t: 0.38, d: 0.10 }, // D6
      { m: 91, t: 0.48, d: 0.34 }, // G6
    ];

    for (const n of melody) {
      this.playFM({
        freq: midiToHz(n.m),
        duration: n.d,
        startTime: now + n.t,
        carrierType: 'triangle',
        modRatio: 3.0,
        modIndex: 2.4,
        modIndexEnd: 0.2,
        gain: 0.22,
        attack: 0.003,
      });
      this.playFM({
        freq: midiToHz(n.m - 12),
        duration: n.d,
        startTime: now + n.t,
        modRatio: 2.0,
        modIndex: 1.4,
        gain: 0.1,
        attack: 0.004,
      });
    }
  }

  /** Mechanical iris slide + harmonic portal hum */
  warpOpen(): void {
    const ctx = this.readyCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Mechanical iris pneumatic slide
    this.playNoise({
      duration: 0.28,
      startTime: now,
      gain: 0.14,
      attack: 0.02,
      filterType: 'bandpass',
      filterFreq: 500,
      filterFreqEnd: 2600,
      q: 3.5,
    });

    // Harmonic dimensional portal hum (fifth interval swell)
    this.playFM({
      freq: 220,
      freqEnd: 330,
      duration: 0.55,
      startTime: now + 0.05,
      modRatio: 2.0,
      modIndex: 1.8,
      modIndexEnd: 3.0,
      gain: 0.16,
      attack: 0.08,
      pan: -0.25,
    });
    this.playFM({
      freq: 330,
      freqEnd: 495,
      duration: 0.55,
      startTime: now + 0.08,
      modRatio: 3.0,
      modIndex: 1.5,
      modIndexEnd: 2.4,
      gain: 0.13,
      attack: 0.09,
      pan: 0.25,
    });
  }

  /** Ascending dimensional warp whoosh */
  warpEnter(): void {
    const ctx = this.readyCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    this.duckMusic(0.95, 0.25);

    // Filtered warp tunnel whoosh
    this.playNoise({
      duration: 0.72,
      startTime: now,
      gain: 0.18,
      attack: 0.06,
      filterType: 'bandpass',
      filterFreq: 280,
      filterFreqEnd: 5400,
      q: 4.0,
    });

    // Ascending 10-step dimensional FM spiral
    for (let i = 0; i < 10; i++) {
      const f = 260 * Math.pow(1.18, i);
      this.playFM({
        freq: f,
        freqEnd: f * 1.15,
        duration: 0.13,
        startTime: now + i * 0.058,
        modRatio: 2.5,
        modIndex: 2.6,
        modIndexEnd: 0.3,
        gain: 0.16,
        attack: 0.005,
        pan: Math.sin(i * 1.1) * 0.45,
      });
    }
  }

  /** Deep EMP shockwave sweep */
  repulsor(): void {
    const ctx = this.readyCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Deep kinetic bass drop
    this.playFM({
      freq: 175,
      freqEnd: 34,
      duration: 0.34,
      startTime: now,
      modRatio: 1.5,
      modIndex: 4.0,
      modIndexEnd: 0.4,
      gain: 0.28,
      attack: 0.002,
    });

    // Electric EMP ring burst
    this.playFM({
      freq: 520,
      freqEnd: 1380,
      duration: 0.22,
      startTime: now,
      carrierType: 'triangle',
      modRatio: 3.5,
      modIndex: 3.0,
      modIndexEnd: 0.2,
      gain: 0.15,
      attack: 0.004,
    });

    this.playNoise({
      duration: 0.16,
      startTime: now,
      gain: 0.12,
      filterType: 'bandpass',
      filterFreq: 1900,
      filterFreqEnd: 320,
      q: 2.4,
    });
  }

  /** Subtle short sci-fi magnetic beam pulse (safe if called continuously per-frame) */
  magneticHum(): void {
    const ctx = this.readyCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    if (this.throttled('magneticHum', 0.095, now)) return;

    this.playFM({
      freq: 196,
      freqEnd: 232,
      duration: 0.11,
      startTime: now,
      modRatio: 2.02,
      modIndex: 1.6,
      modIndexEnd: 0.7,
      gain: 0.085,
      attack: 0.018,
    });
  }

  /** Crunch noise + downward FM pitch drop */
  enemyDestroy(): void {
    const ctx = this.readyCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    if (this.throttled('enemyDestroy', 0.025, now)) return;

    // Arcade LFSR crunch burst
    this.playNoise({
      duration: 0.24,
      startTime: now,
      gain: 0.22,
      filterType: 'bandpass',
      filterFreq: 1600,
      filterFreqEnd: 240,
      q: 1.3,
      metallic: true,
    });

    // Downward FM explosion pitch drop
    this.playFM({
      freq: 430,
      freqEnd: 58,
      duration: 0.23,
      startTime: now,
      carrierType: 'sawtooth',
      modRatio: 1.75,
      modIndex: 4.2,
      modIndexEnd: 0.5,
      gain: 0.21,
      attack: 0.002,
    });
  }

  /** Punchy FM impact crunch */
  bossHit(heavy = false): void {
    const ctx = this.readyCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    if (this.throttled('bossHit', 0.025, now)) return;

    const dur = heavy ? 0.26 : 0.15;
    this.playFM({
      freq: heavy ? 210 : 280,
      freqEnd: heavy ? 42 : 68,
      duration: dur,
      startTime: now,
      carrierType: 'triangle',
      modType: 'sawtooth',
      modRatio: 1.414,
      modIndex: heavy ? 5.2 : 3.6,
      modIndexEnd: 0.4,
      gain: heavy ? 0.28 : 0.21,
      attack: 0.002,
    });

    this.playNoise({
      duration: dur * 0.8,
      startTime: now,
      gain: heavy ? 0.2 : 0.13,
      filterType: 'lowpass',
      filterFreq: heavy ? 2200 : 1700,
      filterFreqEnd: 260,
      q: 1.8,
      metallic: true,
    });
  }

  /** Menacing low FM growl / DOH roar */
  bossRoar(): void {
    const ctx = this.readyCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    if (this.throttled('bossRoar', 0.25, now)) return;
    this.duckMusic(0.9, 0.3);

    // Monolithic YM2151 vocal-formant monster growl
    this.playFM({
      freq: 86,
      freqEnd: 46,
      duration: 0.78,
      startTime: now,
      carrierType: 'sawtooth',
      modType: 'sawtooth',
      modRatio: 1.51,
      modIndex: 6.5,
      modIndexEnd: 2.2,
      gain: 0.27,
      attack: 0.04,
    });

    // Upper throat harmonic snarl
    this.playFM({
      freq: 174,
      freqEnd: 92,
      duration: 0.68,
      startTime: now + 0.03,
      carrierType: 'square',
      modRatio: 2.33,
      modIndex: 4.5,
      modIndexEnd: 1.1,
      gain: 0.15,
      attack: 0.05,
    });

    // Swept formant breath roar
    this.playNoise({
      duration: 0.72,
      startTime: now + 0.02,
      gain: 0.19,
      attack: 0.05,
      filterType: 'bandpass',
      filterFreq: 780,
      filterFreqEnd: 210,
      q: 3.2,
      metallic: true,
    });
  }

  /** Classic Arkanoid Vaus shatter/dissolve descending FM sweep */
  playerLoseLife(): void {
    const ctx = this.readyCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    this.duckMusic(1.0, 0.2);

    // Initial hull rupture blast
    this.playNoise({
      duration: 0.48,
      startTime: now,
      gain: 0.25,
      filterType: 'lowpass',
      filterFreq: 2800,
      filterFreqEnd: 180,
      q: 1.4,
      metallic: true,
    });

    // Iconic warbling stepped descending Vaus dissolve
    const steps = 11;
    for (let i = 0; i < steps; i++) {
      const f = 680 * Math.pow(0.84, i);
      this.playFM({
        freq: f,
        freqEnd: f * 0.78,
        duration: 0.11,
        startTime: now + i * 0.068,
        carrierType: 'sawtooth',
        modRatio: 2.5,
        modIndex: 3.6,
        modIndexEnd: 0.8,
        gain: 0.21 * (1 - i * 0.055),
        attack: 0.004,
        pan: (i % 2 === 0 ? -1 : 1) * 0.25,
      });
    }
  }

  /** Somber arcade Game Over cadence */
  gameOver(): void {
    const ctx = this.readyCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    this.stopMusic();

    const chords: Array<{ t: number; d: number; notes: number[] }> = [
      { t: 0.00, d: 0.34, notes: [50, 62, 65, 69] }, // Dm
      { t: 0.36, d: 0.34, notes: [48, 60, 64, 67] }, // C
      { t: 0.72, d: 0.34, notes: [46, 58, 62, 65] }, // Bb
      { t: 1.08, d: 0.95, notes: [45, 57, 61, 64] }, // A major somber resolve
    ];

    for (const ch of chords) {
      ch.notes.forEach((m, idx) => {
        this.playFM({
          freq: midiToHz(m),
          duration: ch.d,
          startTime: now + ch.t,
          carrierType: idx === 0 ? 'triangle' : 'sawtooth',
          modRatio: idx === 0 ? 2.0 : 1.0,
          modIndex: 2.1,
          modIndexEnd: 0.35,
          gain: idx === 0 ? 0.16 : 0.1,
          attack: 0.015,
          pan: (idx - 1.5) * 0.18,
        });
      });
    }
  }

  /** Tape-rewind reverse sweep */
  rewind(): void {
    const ctx = this.readyCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    if (this.throttled('rewind', 0.15, now)) return;

    // Rapid upward reverse-tape warble
    const grains = 8;
    for (let i = 0; i < grains; i++) {
      const f = 240 * Math.pow(1.24, i);
      this.playFM({
        freq: f * 0.85,
        freqEnd: f * 1.28,
        duration: 0.065,
        startTime: now + i * 0.038,
        carrierType: 'triangle',
        modRatio: 2.0,
        modIndex: 2.2,
        gain: 0.15,
        attack: 0.015,
      });
    }

    this.playNoise({
      duration: 0.34,
      startTime: now,
      gain: 0.13,
      attack: 0.18,
      filterType: 'bandpass',
      filterFreq: 450,
      filterFreqEnd: 4800,
      q: 2.8,
    });
  }

  /** Crisp menu blip */
  uiClick(): void {
    const ctx = this.readyCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    if (this.throttled('uiClick', 0.025, now)) return;

    this.playFM({
      freq: 1046.5, // C6
      freqEnd: 1318.5, // E6
      duration: 0.042,
      startTime: now,
      carrierType: 'triangle',
      modRatio: 2.0,
      modIndex: 1.5,
      modIndexEnd: 0.1,
      gain: 0.14,
      attack: 0.002,
    });
  }

  /** Orbital target-lock beep + laser strike boom */
  stalemateStrike(): void {
    const ctx = this.readyCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    // 3 rapid high-tech target lock pips
    for (let i = 0; i < 3; i++) {
      this.playFM({
        freq: i === 2 ? 1975.5 : 1480,
        duration: 0.048,
        startTime: now + i * 0.065,
        modRatio: 3.0,
        modIndex: 2.0,
        gain: 0.16,
        attack: 0.002,
      });
    }

    // Orbital beam drop + impact boom
    const strikeTime = now + 0.21;
    this.playFM({
      freq: 2200,
      freqEnd: 48,
      duration: 0.38,
      startTime: strikeTime,
      carrierType: 'sawtooth',
      modRatio: 1.5,
      modIndex: 5.0,
      modIndexEnd: 0.6,
      gain: 0.27,
      attack: 0.003,
    });

    this.playNoise({
      duration: 0.36,
      startTime: strikeTime + 0.02,
      gain: 0.22,
      filterType: 'lowpass',
      filterFreq: 3400,
      filterFreqEnd: 190,
      q: 1.6,
      metallic: true,
    });
  }
}

export const sound = new SoundEngine();
