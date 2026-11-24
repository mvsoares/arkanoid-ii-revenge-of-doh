# Master Build Prompt — *ARKANOID II: REVENGE OF DOH (Browser Arcade & Evolved Edition)*

> Copy everything below (or point an AI coding agent directly to this file) to build the complete game.

---

## Role & Objective

You are a Senior Arcade Game Architect, Graphics Programmer, and Retro Audio Designer. Build a complete, production-grade, locally playable browser recreation and modern evolution of Taito's 1987 arcade masterpiece ***Arkanoid: Revenge of DOH* (*Arkanoid II*)**.

The game must run locally in any modern desktop/mobile browser (`HTML5 Canvas 2D` + optional `WebGL2` post-processing shader pipeline) with **zero external asset dependencies**—all pixel-art/HD sprites, animations, particle effects, CRT shaders, and YM2151-inspired FM synth / PSG arcade sound effects & music must be generated procedurally in code so the game works immediately out of the box offline.

---

## 1. Technical Architecture, Scope & Project Setup

- **Complete Scope Mandate (No Placeholders)**: Deliver the **entire feature set** in full—all 64 branching stages, all 14 capsules, all classic + regenerating/moving bricks, autonomous enemies, Round 17 & Round 34 multi-phase bosses, the Construction Set level editor with URL sharing, 2P Co-Op, Boss Rush, Roguelite Breach mode, CRT/HD shaders, and procedural FM audio. Do not leave stubbed menus or `TODO` placeholders.
- **Default Ruleset**: Boot into **Evolved Arcade+** by default when starting a game (Reserve Capsule, slot-based upgrade synergy/stacking, Repulsor Pulse, Magnetic Curve, and Stalemate Breaker active out of the box), while keeping **Classic 1987 Purist** selectable with a single toggle on the Title/Mode Select screen and DIP-Switch settings.
- **Stack (Best of Both Worlds — Modular Dev + Standalone Single-File Build)**:
  - Use **TypeScript + Vite** (`HTML5 Canvas 2D` + `WebGL2` post-processing + `Web Audio API`) so a large codebase stays strictly typed, modular, and easy to maintain.
  - Configure `vite-plugin-singlefile` (or inline bundling) so `npm run dev` provides instant hot-reload development **and** `npm run build` compiles everything into a **single standalone `dist/index.html`** that can also be opened directly via `file://` in any browser without a server.
- **Deterministic Fixed-Timestep Physics**:
  - Render at native display refresh rate (`60Hz–240Hz` via `requestAnimationFrame`) with interpolated visuals.
  - Run physics simulation at a fixed `240Hz` (`dt = 1 / 240s`) with **swept circle-vs-AABB sub-stepping** so high-speed or Mega balls never tunnel through thin bricks, moving blocks, or paddle edges.
- **Playfield Proportions**:
  - Classic vertical 3:4 arcade playfield (`224 × 256` logical arcade units upscaled cleanly, e.g., `672 × 768` or responsive full-viewport letterboxed layout) flanked by sculpted metallic XORG border walls (with animated enemy hatches at the top and dual Warp Gates at the bottom left/right walls) plus a dedicated HUD panel for `1UP`, `HIGH SCORE`, `2UP`, `ROUND / SECTOR`, active upgrades, Reserve Capsule, and Lives icons.
- **Persistence**: Save high scores (with classic 3-character arcade initials), unlocked 64-stage sector nodes, custom editor levels, and settings in `localStorage`.

---

## 2. Story, Attract Mode & Arcade Presentation

Recreate the authentic 1987 arcade atmosphere:
1. **Boot & Coin-Up Screen**: Classic arcade boot sequence, `"INSERT COIN"` (`C` / `5` key) with authentic Taito coin-chime audio and credit counter, `"PRESS 1P OR 2P START"`.
2. **Animated Intro Sequence (Skippable)**:
   - *Lore*: Long after the defeat of DOH, the massive dimension-controlling fortress **XORG** warps into our galaxy housing a resurrected, vengeful **DOH**. Command ship **MIXTEC** launches the upgraded **VAUS II** interceptor into XORG's hull.
   - Show MIXTEC deploying VAUS II into XORG's docking breach with starfield parallax and FM synth fanfare.
3. **Attract Cycle**: Rotates between Title Logo -> Story Crawl -> Animated Capsule & Brick Showcase (showing point values and capsule icons) -> Automated AI Demo Play -> Top 10 High Score Table.

---

## 3. Controls & Authentic "Arcade Spinner" Feel

*Arkanoid II* lives and dies by paddle responsiveness:
- **Mouse / Trackpad (Primary — Optical Spinner Emulation)**:
  - Use the **Pointer Lock API** on click during gameplay for raw, 1:1 zero-latency horizontal delta tracking (adjustable sensitivity slider), instantly replicating the crisp precision of the original arcade rotary knob.
  - Fallback unlocked cursor tracking option for casual play.
  - Left-Click: Launch Caught Ball / Fire Lasers. Right-Click (in *Evolved Mode*): Deploy Reserve Capsule or trigger Repulsor Pulse.
- **Keyboard**: `Left/Right` or `A/D` with tuned acceleration curve, instant turnaround, plus `Shift` precision/boost modifier; `Space/Z` for Launch/Laser; `X` for Secondary Action; `P/Esc` Pause.
- **Gamepad & Touch**: Full `Gamepad API` analog stick + trigger support, and responsive mobile touch-drag offset zone below the Vaus so fingers don't obscure the paddle.

---

## 4. Ball & Vaus II Physics Rules

- **Position-Based Vaus Deflection**:
  - Striking the center of Vaus II returns steep vertical angles (`~70°–75°`); striking toward the outer red tips returns sharp, aggressive low angles (`~20°–30°`), smoothly interpolated across the paddle surface (with toggleable 7-segment discrete arcade mode vs. continuous curve).
  - Optional *Evolved Mode* **Kinetic English**: Fast paddle velocity at the moment of impact subtly bends or accelerates the rebound vector, giving skilled players active shot-shaping control.
- **Speed Escalation & Anti-Softlock Safeguards**:
  - Ball speed gradually ramps up based on total bounce count and base stage speed, resetting partially when a life is lost or dropping a tier on catching **Slow (S)**.
  - **Anti-Infinite Loop Detection**: If the ball bounces horizontally between walls or indestructible Gold/Moving bricks for more than 8 consecutive hits without hitting a destructible brick or Vaus, nudge its vertical angle by `±2.5°` and display a subtle spark so the game never soft-locks.

---

## 5. Complete *Revenge of DOH* Brick Roster & Scoring

Implement a **13 columns × 18+ rows** playfield grid supporting every classic *Arkanoid II* brick behavior:

| Brick Type | Hits to Break | Points | Special Behavior |
| :--- | :---: | :---: | :--- |
| **White** | 1 | 50 | Standard colored brick |
| **Orange** | 1 | 60 | Standard colored brick |
| **Cyan** | 1 | 70 | Standard colored brick |
| **Green** | 1 | 80 | Standard colored brick |
| **Red** | 1 | 90 | Standard colored brick |
| **Blue** | 1 | 100 | Standard colored brick |
| **Magenta / Pink** | 1 | 110 | Standard colored brick |
| **Yellow** | 1 | 120 | Standard colored brick |
| **Silver Brick** | 2 to 5 (scales by sector) | `50 × Round #` | Flashes metallic specular highlight on hit; awards points only on final break |
| **Regenerating (Notched) Silver Brick** | 2 | `100 × Round #` | Marked with dark notches/rivets. **Regenerates back onto the board ~6 seconds after being damaged or destroyed** (unless Vaus/ball currently occupies its cell). **Does NOT need to be cleared to finish the round!** |
| **Gold Brick** | Indestructible | 0 | Immune to normal balls and standard lasers; flashes gold on hit. **Can only be destroyed by Mega Ball (M)** (or Overcharged Laser in *Evolved Mode*). Does NOT count toward stage clear |
| **Moving Brick** | Matches base brick type | Matches base (`+50` bonus) | Slides horizontally across unoccupied grid cells at steady speed, reversing cleanly upon touching walls or neighboring bricks |

---

## 6. Complete 14-Capsule Power-Up Arsenal

Capsules drop from destroyed colored bricks as 3D-rotating cylindrical pills with distinct colors and animated letters (`1,000 pts` awarded on catch). Include **every** capsule from *Arkanoid: Revenge of DOH*:

1. **`E` — Enlarge (Blue)**: Smoothly animates Vaus II expanding to `1.5×` width (up to `2.0×` if stacking is enabled in *Evolved Mode*).
2. **`L` — Laser (Red)**: Transforms Vaus II with twin forward-facing blasters; fires twin plasma bolts (`max 2–4 pairs on screen`) capable of destroying Colored bricks, chipping Silver bricks, and destroying roaming enemies.
3. **`C` — Catch (Green)**: Energy magnetizes Vaus II; ball sticks where it lands and launches from that exact offset on button press (or auto-releases after 4 seconds).
4. **`S` — Slow (Orange)**: Reduces active ball velocity by 35% and resets speed-escalation counters.
5. **`B` — Break (Violet/Pink)**: Immediately slides open the glowing **Bonus Warp Exit** on the bottom-right wall; driving Vaus II through the exit clears the round instantly and grants a **10,000-point bonus**.
6. **`D` — Disruption (Cyan)**: Splits the Energy Ball into **3 simultaneous active balls** at `±15°` spread. *(Arcade rule: new capsules pause dropping while multiple balls are active in Classic Mode).*
7. **`P` — Player (Silver/Gray)**: Rare drop; grants **1 Extra Vaus Life** with celebratory arcade jingle (also grant extra lives at `20,000`, `60,000`, and every `60,000` points).
8. **`M` — Mega Ball (Purple / Gold Core)**: Supercharges the ball into a blazing plasma orb that **plows straight through Colored, Silver, Regenerating, AND Gold bricks without bouncing back**, bouncing only off walls and Vaus!
9. **`T` — Twin (Dark Blue / Teal)**: Clones a second full-sized **Twin Vaus** locked beside the primary Vaus with a small gap between them, effectively doubling horizontal coverage.
10. **`I` — Illusion (Emerald / White Glow)**: Moving Vaus II leaves shimmering **holographic after-image trails** for ~350ms that have real physical collision and can bounce balls saved at the last split-second!
11. **`N` — New Disruption / Infinite Multi-Ball (White / Cyan)**: Splits the ball into 3 balls, and **whenever 1 or 2 balls drain down the pit, new balls automatically split off the survivor(s)** back up to 3—lasting until all 3 drain simultaneously or another exclusive capsule is caught!
12. **`R` — Reduce (Charcoal / Black)**: Hazard/Risk-Reward capsule! Shrinks Vaus II to `0.6×` width, **but activates a `2×` Double Score Multiplier** on all bricks and enemies until lost or replaced.
13. **`?` / Flashing Mystery Capsule (Rainbow / Strobe)** & **Solid Gold Capsule**: Triggers a dramatic randomized jackpot event:
    - *Eight-Ball Chaos*: Splits into 8 simultaneous balls!
    - *Auto-Vulcan Laser*: Continuous rapid-fire lasers for 12 seconds.
    - *Thunder Clear*: Vaporizes the lowest 2 rows of destructible bricks.
    - *Barrier Floor*: Generates an energy shield across the bottom pit that saves 1–3 missed balls.
    - *Bonus Swarm*: Spawns harmless high-value golden critters worth `2,000 pts` each.

---

## 7. 64-Stage Branching Campaign & Left/Right Warp Gates

Recreate *Revenge of DOH*'s signature non-linear progression:
- **34 Rounds per Playthrough across 64 Total Stage Designs**:
  - Round 1 starts at the entrance of XORG.
  - Whenever all required bricks in a stage are cleared, **TWO Warp Gates slide open** at the bottom-left and bottom-right walls (`LEFT WARP` and `RIGHT WARP`).
  - Guiding Vaus II into the **Left Gate** routes the player to the *Left Branch* layout of the next round; entering the **Right Gate** routes to the *Right Branch* layout (forming a interconnected binary lattice/DAG of 64 unique stages!).
- **Interactive XORG Tactical Sector Map**:
  - Between stages (and viewable from the Pause/Menu screen), render a sleek retro vector diagram of XORG showing your current path, Left/Right upcoming branches, Boss sectors (Round 17 & Round 34), and which of the 64 stages you have previously discovered across playthroughs.
- **Stage Design Variety**:
  - Craft 64 distinct, thoughtfully designed layouts organized into escalating thematic sectors (Entry Hull, Moving Gateways, Regenerating Vaults, Ricochet Chambers, Gold Labyrinths, XORG Core):
    - Iconic pixel-art tributes (Space Invader, Taito emblem, XORG skull, helix spirals, twin towers).
    - Puzzles where **Moving Gold Bricks** guard narrow choke points into dense high-value brick pockets.
    - **Notched Regenerating Brick shields** protecting 1-hit colored targets behind them.
    - Pinball-style diamond clusters and high-speed vertical "chimney" tunnels for gratifying top-wall trapping.

---

## 8. Enemy Hatches & Multi-Phase Boss Battles

### Top-Wall Autonomous Enemies
Top-border iris hatches open periodically (max 3–5 enemies onscreen) to release animated geometric/biomechanical foes:
- **Harmonies / Pyramids / Tri-Spheres**: Drift downward, tracing brick contours and weaving through gaps.
- **Splitters**: Split into two faster mini-drones if clipped by a single laser bolt.
- **Builders / Regenerators** *(late sectors)*: Occasionally repair or drop a colored block if left alive too long.
- *Interaction*: Touching Vaus II destroys the enemy harmlessly (`150–500 pts`); striking an enemy with the ball destroys it in a pixel explosion **and randomly deflects the ball's trajectory**—preserving the tense arcade hazard!

### Round 17 Mid-Bosses (Branch-Specific!)
- **Left Sector Boss — *SUIREI* (Giant Cybernetic Brain)**:
  - Suspended in the upper center of the chamber, surrounded by orbiting protective nodes and regenerating cellular blocks.
  - Periodically pulses psychic waves and spawns amoeba drones; player must bank the ball or fire lasers into its exposed central cortex (`24 HP`) with visible damage states and screen shake.
- **Right Sector Boss — *ARK-SENTINEL* (Armored Mechanical Core)**:
  - Sweeps horizontally behind a rotating shield of Moving Gold plates, firing telegraphed downward ion rings (which temporarily stun/freeze Vaus movement for `0.6s` if not dodged) while opening its central eye to attack.

### Round 34 Final Showdown — *THE REVENGE OF DOH* (2 Phases)
- **Phase 1 — Monument Form**:
  - DOH materializes as the towering, scowling Moai monolith from the original *Arkanoid*, shifting color palettes as he absorbs damage (`32 HP`) and spitting volleys of aimed plasma fireballs toward Vaus II. *(In Classic Mode, fireballs destroy Vaus; in Evolved Mode, option to make fireballs shrink/stun Vaus instead of instant death).*
- **Phase 2 — Mutated Leviathan Form**:
  - Upon shattering his stone shell, DOH erupts into a grotesque biomechanical core with **articulated, regenerating multi-segment tentacles** reaching into the playfield!
  - Ball hits sever tentacle segments (which slowly regrow like Notched Silver bricks), clearing lanes to strike DOH's pulsing heart (`40 HP`) while dodging spore projectiles.
- **Victory Ending & Loop 2+**:
  - Explosive chain-reaction destruction of DOH, emergency escape sequence as XORG collapses, triumphant credits roll, Route Completion Badge (`X / 64 Stages Discovered`), and optional **Arcade Loop 2 (Hard Mode)** carrying your score forward!

---

## 9. Decades of Player-Requested Modernizations ("Purist 1987" vs. "Evolved Arcade+")

Include a top-level mode selector—**Classic 1987 Purist** (100% faithful arcade rules) vs. **Evolved Arcade+** (modernized QoL, fair recovery, and deep skill mechanics)—plus granular toggles in a **Custom Arcade DIP-Switch Menu**:

1. **Reserve Capsule Bay & Anti-"Death Spiral" Recovery**:
   - *Historical pain point*: Dying on Round 29 in 1987 stripped all upgrades at max ball speed, causing an instant Game Over chain.
   - *Evolved solution*: Add a **1-Slot Reserve Capsule Hold** (catching a duplicate or pressing `Hold` banks a backup capsule deployable on demand with Right-Click / `X`), plus a brief **3-second Recovery Shield + Mercy Capsule Drop** on your first brick break after losing a life in Rounds 15+.
2. **Power-Up Synergy & Upgrade Stacking (Instead of Blind Overwrites)**:
   - *Historical pain point*: Accidentally touching `Slow` or `Enlarge` immediately deleted your hard-earned `Laser` or `Twin` paddle.
   - *Evolved solution*: Categorize upgrades into **Chassis (`Enlarge`, `Twin`, `Illusion`)**, **Weapon (`Laser`, `Catch`)**, and **Ball (`Mega`, `Disruption`, `Slow`)** slots so **Enlarged Laser Vaus** or **Twin Catch Vaus** can coexist! Stacking `Laser ×2` upgrades to **Hyper-Pierce Laser** (damages Silver bricks in 1 hit); stacking `Mega + Disruption` creates **Triple Blazing Mega Balls**.
3. **Hazardous Capsule Telegraphing & Repulsor Pulse**:
   - Distinct warning border/sound on `Reduce (R)` and `Disruption (D)` capsules so players never misread colors in chaos.
   - **Repulsor Wave** (`10s` cooldown): Emit a short EMP ring from Vaus II that vaporizes unwanted falling capsules (turning them into `500` bonus points instead of ruining your build) and nudges nearby enemy drones away.
4. **"Last-Brick Stalemate" Eliminator & Gravity Curve (*Shatter* Tribute)**:
   - *Historical pain point*: Waiting 3 minutes for the ball to randomly hit 1 remaining brick tucked behind Gold blocks.
   - *Evolved solution*: Give Vaus II a subtle rechargeable **Magnetic Curve Gauge** (hold Secondary button to gently bend the ball's flight path toward or away from Vaus), AND if `≤ 2` required bricks remain untouched for `20 seconds`, trigger **MIXTEC Orbital Lock-On** (revealing a weak spot or calling a precision orbital strike / opening Warp Gates).
5. **Combo Chain Multiplier & Style Scoring**:
   - Consecutive brick breaks *before the ball touches Vaus again* build a live **Ricochet Combo (`1.1×` up to `5.0×`)** with rising musical pitch chimes and floating pixel pop-ups—rewarding daring top-corridor traps!
6. **The Legendary *Arkanoid II Construction Set* (Full In-Browser Level & Campaign Editor)**:
   - *Tribute*: The 1988 Amiga/PC ports of *Revenge of DOH* pioneered one of gaming's earliest built-in level editors.
   - Build a sleek **Construction Set Studio** right in the browser:
     - Paint/erase/mirror/fill any of the brick types on the grid, define **Moving Brick patrol ranges**, set **Capsule Drop Probability Sliders**, pick background synth themes & enemy types, and **Instant Playtest** with 1 click.
     - Save custom multi-stage packs locally, export/import `.json` files, and generate **compressed Base64 URL share codes** (`?level=...`) so players can share levels via a single link!
7. **Local 2-Player Modes**:
   - **Arcade Alternating 2P**: Classic turn-based 1UP / 2UP high-score rivalry.
   - **Simultaneous Couch Co-Op**: Player 1 (Mouse) and Player 2 (Keyboard/Gamepad) pilot two color-coded Vaus crafts simultaneously (with Ghost Pass-Through so paddles never block each other, shared combo meter, and co-op laser crossfire!).
   - **Boss Rush & Endless "XORG Breach" Roguelike Mode**: Procedural sector climb where clearing each stage lets you draft 1 of 3 permanent Vaus Tech Augments (e.g., *Corner Thrusters*, *Pinball Side-Bumpers*, *Crit-Strike Ball*, *Drone Turret*).
8. **Display, Audio & Accessibility Polish**:
   - **Visual Presets**: Toggle live (`F2`) between **1987 Arcade CRT** (authentic pixel grid, scanlines, phosphor bloom, shadow mask, curved bezel) and **HD Neon Vector/Cyber** (crisp gradients, dynamic point lighting, shattering brick physics shards, ball ribbon trails, reactive background grid).
   - **Procedural Web Audio Synthesizer**: Authentic FM-synth metallic clinks for Silver/Gold hits (distinct pitches so you can hear what the ball hit without looking!), ascending harmonic arpeggios on brick chains, classic *Arkanoid* stage-start fanfare, tense boss synthwave/FM tracks, and independent Master / SFX / Music volume sliders.
   - **Cabinet QoL**: Colorblind high-contrast brick/capsule pattern symbols, adjustable Screen Shake & Hit-Stop sliders, Game Speed (`75%–125%`), Sector Practice Select (jump to any unlocked stage of the 64-stage map), and 3-charge **Tactical Rewind** (`Backspace` rewinds 3 seconds of gameplay in Practice/Casual mode).

---

## 10. Suggested Implementation Structure & Milestones

Organize the codebase cleanly so every subsystem is maintainable and testable:

```text
src/
  core/          # Fixed-timestep loop, input manager (PointerLock/Keyboard/Gamepad/Touch), event bus, RNG
  physics/       # Swept circle-AABB collision, Vaus bounce curve, anti-loop detector, moving brick solver
  entities/      # Vaus (modes: normal, laser, catch, twin, illusion), Ball, Brick (standard, silver, regen, gold, moving), Capsule (14 types), Enemy, Bosses (Suirei, Sentinel, DOH Phase 1 & 2)
  stages/        # 64-stage definitions & procedural/handcrafted layouts, binary Left/Right Warp DAG, XORG sector map
  modes/         # Classic 1987 Purist ruleset, Evolved Arcade+ synergies, Co-Op, Boss Rush, Roguelite Breach
  editor/        # Arkanoid II Construction Set UI, brush tools, playtester, JSON + URL Base64 codec
  rendering/     # Pixel/HD Canvas renderer, particle shatter system, WebGL CRT/Bloom post-process pass, HUD
  audio/         # Zero-dependency Web Audio API FM/PSG synthesizer, SFX bank, procedural stage/boss music
  ui/            # Attract sequence, DIP-switch settings modal, XORG node map, High Score entry
```

### Definition of Done / Verification Checklist
1. Game boots cleanly via `npm run dev` with zero console errors, zero missing external assets, and locked 60+ FPS performance.
2. Pointer-lock mouse control feels razor-sharp and instant; ball never tunnels through bricks or gets stuck in infinite horizontal loops.
3. All **14 *Revenge of DOH* capsules**, **Regenerating Notched Silver bricks**, **Moving bricks**, **Gold bricks**, **Left/Right Warp Gates**, **64 branching stages**, **Round 17 Mid-Bosses**, and **2-Phase DOH Final Boss** are fully playable.
4. Switching between **Classic 1987 Purist** and **Evolved Arcade+** cleanly toggles Reserve Capsule, Power-Up Stacking, Repulsor/Curve mechanics, and CRT vs. HD Neon visuals.
5. The **Construction Set Level Editor** can create, playtest, save, and export/import a level via shareable URL hash/query parameter.
