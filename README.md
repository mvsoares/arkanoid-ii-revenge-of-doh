# Arkanoid II: Revenge of DOH — Browser Arcade & Evolved Edition

Zero-dependency TypeScript + HTML5 Canvas 2D + WebGL2 + Web Audio API recreation and evolution of Taito's 1987 arcade classic *Arkanoid: Revenge of DOH*.

## Features
- **64 Branching Campaign Stages** across 34 rounds with Left/Right Warp Gates and an interactive XORG Sector Map.
- **Classic 1987 Purist & Evolved Arcade+** rulesets (Reserve Capsule Bay, slot-based upgrade stacking, Repulsor EMP Wave, Magnetic Curve, Ricochet Combo multiplier, 20s Stalemate Orbital Breaker, and Tactical Rewind).
- **Complete 14-Capsule Arsenal** (`E`, `L`, `C`, `S`, `B`, `D`, `P`, `M`, `T`, `I`, `N`, `R`, `?`, `G`) and all brick types (Colored, Multi-Hit Silver, Regenerating Notched Silver, Gold, and Moving bricks).
- **Multi-Phase Bosses**: Round 17 branch guardians (*Suirei* & *Ark-Sentinel*) and Round 34 two-phase *DOH* showdown.
- **Game Modes**: 1P Campaign, Simultaneous 2P Co-Op, Alternating 2P Arcade, Boss Rush, Endless *XORG Breach* Roguelite (12 augments), and Sector Practice.
- **Arkanoid II Construction Set**: Built-in level editor with Mirror X, moving brick rails, guaranteed capsules, JSON import/export, and `?level=` Base64 URL sharing.
- **WebGL2 Shaders & Procedural FM Audio**: Live `F2` toggle between **HD Neon** and **1987 Trinitron CRT**, plus procedural YM2151-inspired FM/PSG SFX & music.

## Development & Build

```bash
npm install
npm run dev      # Local dev server
npm run build    # Type-checks and outputs standalone single-file dist/index.html
```
