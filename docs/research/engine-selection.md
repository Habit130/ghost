# Rendering Technology Selection: Canvas 2D vs Phaser vs PixiJS

> Resolves [#3](https://github.com/Habit130/ghost/issues/3) · 2026-08-13 · Status: resolved (see [Recommendation](#recommendation)).

## TL;DR

**Recommendation: Phaser (current major, v4.x).** For a 2D, possibly touch-controlled, arcade score-attack game that a TypeScript beginner must ship in 1–2 weeks, Phaser is the only option that covers sprite, particle, audio, input, and scene management out of the box; it ships official TypeScript definitions and an official Vite + TypeScript scaffold, is MIT-licensed, and is commercially maintained and actively developed.

Canvas 2D is zero-dependency but forces you to hand-build every one of those subsystems. PixiJS is a fast rendering *engine*, not a game framework — audio, game input, and scene state must still be assembled from separate libraries or written from scratch.

## Project constraints (from #1 / #3)

- Single core mechanic, 2D, arcade score-attack, possibly touch-enabled.
- 1–2 week delivery; no prior TS game-dev experience on the team.
- TypeScript + Vite, web only (browser), GitHub Pages hosting planned.

## Method

Every claim is traced to a **primary source** — official documentation, published package/source metadata, or the project's own README/release notes. URLs are cited inline and collected in [References](#references). No secondary write-ups were used.

## Facts table

| Criterion | Canvas 2D | Phaser (v4) | PixiJS (v8) |
|---|---|---|---|
| Sprite rendering | Manual: immediate-mode `drawImage()` onto a bitmap canvas ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/drawImage)) | Built-in `Sprite` / `Image` game objects ([scenes](https://docs.phaser.io/phaser/concepts/scenes), [README](https://github.com/phaserjs/phaser)) | Built-in `Sprite` on a WebGL/WebGPU scene graph ([README](https://github.com/pixijs/pixijs)) |
| Particles | None built in — hand-rolled on the canvas | Native particle emitter, `Phaser.GameObjects.Particles` ([API](https://docs.phaser.io/api-documentation/namespace/gameobjects-particles)) | Low-level `ParticleContainer` / `Particle`, marked experimental ([guide](https://pixijs.com/8.x/guides/components/scene-objects/particle-container)) |
| Audio | None — separate Web Audio API / HTMLAudioElement ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)) | Built-in sound manager (audio sprites, markers) over Web Audio + HTML5 Audio ([audio](https://docs.phaser.io/phaser/concepts/audio)) | None in core — separate `@pixi/sound` plugin ([PixiJS Sound](https://pixijs.io/sound/)) |
| Input | None — separate Pointer / keyboard events ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events)) | Built-in managers: keyboard, mouse, touch, gamepad, pointer ([input](https://docs.phaser.io/phaser/concepts/input)) | Pointer/touch events on display objects only; no game-input abstraction ([README](https://github.com/pixijs/pixijs)) |
| Scene management | None — hand-rolled state machine | Built-in Scene Manager + scene lifecycle (preload/create/update) ([scenes](https://docs.phaser.io/phaser/concepts/scenes)) | None — display-tree `Container`/`Stage` only, no game-scene lifecycle ([ecosystem](https://pixijs.com/8.x/guides/getting-started/ecosystem)) |
| Bundle size (full, minified) | 0 (browser built-in) | ~1.29 MB raw / ~345 KB gzip ([README](https://github.com/phaserjs/phaser#how-big-is-phaser)) | ~780 KB raw / ~222 KB gzip (full `pixi.js` bundle, measured from jsDelivr `pixi.min.mjs`); modular ESM is tree-shakeable |
| Vite + TypeScript | Native: `dom` lib types, zero config | Ships official `.d.ts`; `create-phaser-game` scaffolds Vite + TS templates ([README](https://github.com/phaserjs/phaser), [installing](https://docs.phaser.io/phaser/getting-started/installation)) | Written in TypeScript, ships `.d.ts`; ESM works with Vite but no official game scaffold ([npm](https://www.npmjs.com/package/pixi.js)) |
| Learning curve (TS beginner) | Low to start, high in total — you build the engine parts | Moderate; framework conventions do the heavy lifting | Moderate–high; you assemble rendering plus your own game logic |
| Touch & mobile | Manual via Pointer events + `touch-action` CSS | Built-in input + scale manager; WebGL/Canvas renderers on mobile ([README](https://github.com/phaserjs/phaser), [input](https://docs.phaser.io/phaser/concepts/input)) | Built-in multi-touch pointer events; WebGL/WebGPU renderers ([README](https://github.com/pixijs/pixijs)) |
| Maintenance / community | Web platform standard (WHATWG/W3C; MDN/BCD) | Commercially maintained by Phaser Studio Inc; active — v4.2.1 (2026-07-09), ~40k★ ([release](https://github.com/phaserjs/phaser/releases/tag/v4.2.1), [repo](https://github.com/phaserjs/phaser)) | Active — v8.19.0 (2026-06-04), ~48k★ ([release](https://github.com/pixijs/pixijs/releases/tag/v8.19.0), [repo](https://github.com/pixijs/pixijs)) |
| License | Web platform — no library license to adopt | MIT, free + commercial OK ([LICENSE](https://github.com/phaserjs/phaser/blob/master/LICENSE.md)) | MIT, free + commercial OK ([LICENSE](https://github.com/pixijs/pixijs/blob/main/LICENSE)) |

## Details

### Canvas 2D

The [Canvas API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API) "provides a means for drawing graphics via JavaScript and the HTML `<canvas>` element" and "largely focuses on 2D graphics." Drawing is immediate-mode: the [`CanvasRenderingContext2D`](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D) interface "is used for drawing shapes, text, images, and other objects," and [`drawImage()`](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/drawImage) covers sprite-style blitting. The canvas "is just a bitmap and does not provide information about any drawn objects" ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API#accessibility_concerns)) — i.e. no retained scene graph, so hit-testing, layering, and scene state are all hand-written.

There is **no audio, input, or scene system** in Canvas itself. Those come from separate specs: the [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) ("a powerful and versatile system for controlling audio… modular routing… audio nodes") and [Pointer events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events) ("a single DOM event model to handle pointing input devices such as a mouse, pen/stylus or touch"). TypeScript types come from the browser's `dom` lib, so Vite + TS integration is zero-config, and the runtime bundle is 0 bytes (everything is built into the browser).

Verdict: maximum freedom, minimum infrastructure — the entire game loop, scene state, particle system, and audio/input glue must be written by hand.

### Phaser (v4)

Phaser is "a fast, free, and fun open source HTML5 game framework that offers WebGL and Canvas rendering across desktop and mobile web browsers," and "You can use JavaScript or TypeScript for development" ([README](https://github.com/phaserjs/phaser)). It is a **complete game framework**: sprites, native particles ([API](https://docs.phaser.io/api-documentation/namespace/gameobjects-particles)), a sound manager ([audio](https://docs.phaser.io/phaser/concepts/audio)), unified input for keyboard/mouse/touch/gamepad/pointer ([input](https://docs.phaser.io/phaser/concepts/input)), a Scene Manager with a preload/create/update lifecycle ([scenes](https://docs.phaser.io/phaser/concepts/scenes)), plus Arcade Physics (collisions) — all of which an arcade score-attack game needs.

Tooling is first-class: the `create-phaser-game` CLI supports "Vue.js, React, Angular, Next.js, SolidJS, Svelte and Remix with Vite, Rollup, Parcel, Webpack, ESBuild, Import Map and Bun. Most come in both JavaScript and TypeScript versions" ([README](https://github.com/phaserjs/phaser)). The package ships official TypeScript definitions (`types` field, [npm](https://www.npmjs.com/package/phaser)).

Bundle size is documented by the project: the full minified build is **1.29 MB raw / 345 KB gzip**, with an arcade-physics build at 1.18 MB / 313 KB gzip ([README — How Big is Phaser?](https://github.com/phaserjs/phaser#how-big-is-phaser)). It is MIT-licensed ([LICENSE](https://github.com/phaserjs/phaser/blob/master/LICENSE.md)) and "commercially developed and maintained by Phaser Studio Inc" ([README](https://github.com/phaserjs/phaser)). The current release is v4.2.1 (2026-07-09) ([release](https://github.com/phaserjs/phaser/releases/tag/v4.2.1)).

### PixiJS (v8)

PixiJS describes itself as "Next-Generation, Fastest HTML5 Creation Engine for the Web" with "WebGL & WebGPU Renderers," "Asset Loader," "Full Mouse & Multi-touch Support," text, drawing, textures, masking, filters, and blend modes ([README](https://github.com/pixijs/pixijs)). Crucially, the official guide states: **"PixiJS itself is just a rendering engine"** ([ecosystem](https://pixijs.com/8.x/guides/getting-started/ecosystem)).

What that means for a game: there is **no audio** in core — sound is the separate [`@pixi/sound`](https://pixijs.io/sound/) "WebAudio API playback library" — **no game-input or scene-state management** (only pointer events on display objects), and particles are a low-level, explicitly **experimental** [`ParticleContainer`](https://pixijs.com/8.x/guides/components/scene-objects/particle-container). A score-attack game built on PixiJS would still need its own game loop, scene/state machine, input mapping, and audio wiring.

PixiJS is written in TypeScript and ships `.d.ts` ([npm](https://www.npmjs.com/package/pixi.js)); it is MIT-licensed ([LICENSE](https://github.com/pixijs/pixijs/blob/main/LICENSE)) and very actively maintained (v8.19.0, 2026-06-04; ~48k★) ([release](https://github.com/pixijs/pixijs/releases/tag/v8.19.0)). The full minified `pixi.js` bundle is ~780 KB raw / ~222 KB gzip (measured from jsDelivr), and its modular ESM packages are tree-shakeable, so a minimal app can be much smaller.

## Recommendation

**Use Phaser (current v4.x).**

- **Coverage**: it is the only candidate where sprites, particles, audio, input, and scene management are all built in — for a 1–2 week arcade game this is the difference between writing game code and writing a game engine first.
- **TS + Vite**: official type definitions plus an official `create-phaser-game` scaffold that generates a Vite + TypeScript project, matching this repo's stack out of the box.
- **Learning curve**: moderate, but it front-loads the game-specific decisions (scenes, input, collisions) instead of requiring a beginner to invent them; the official examples/tutorials and Phaser Studio's commercial maintenance de-risk it.
- **Touch & mobile**: unified touch/pointer input and a scale manager, with WebGL + Canvas fallback on mobile — directly serving the "possibly touch" constraint.
- **License / risk**: MIT (free + commercial OK), commercially maintained, actively released (v4.2.1, 2026-07-09).

Rejected alternatives:

- **Canvas 2D** — zero dependencies and zero bundle are attractive, but with no prior game-dev experience the team would hand-build sprites, particles, audio, input, and scene state; highest total risk to the 1–2 week deadline.
- **PixiJS** — excellent renderer and smaller/tree-shakeable bundle, but it is "just a rendering engine": audio, input mapping, and scene state remain your responsibility, so it saves rendering time but not the engine work. Choose it later only if rendering throughput becomes the bottleneck and a thin game layer is already in place.

## References

- Phaser README / features / bundle-size table — https://github.com/phaserjs/phaser
- Phaser MIT license — https://github.com/phaserjs/phaser/blob/master/LICENSE.md
- Phaser — Installing (bundlers, TypeScript) — https://docs.phaser.io/phaser/getting-started/installation
- Phaser — Input concepts — https://docs.phaser.io/phaser/concepts/input
- Phaser — Audio concepts — https://docs.phaser.io/phaser/concepts/audio
- Phaser — Scenes concepts — https://docs.phaser.io/phaser/concepts/scenes
- Phaser — Particles API — https://docs.phaser.io/api-documentation/namespace/gameobjects-particles
- Phaser npm (latest 4.2.1, `types` field) — https://www.npmjs.com/package/phaser
- Phaser v4.2.1 release — https://github.com/phaserjs/phaser/releases/tag/v4.2.1
- PixiJS README / features — https://github.com/pixijs/pixijs
- PixiJS MIT license — https://github.com/pixijs/pixijs/blob/main/LICENSE
- PixiJS — Ecosystem guide ("just a rendering engine") — https://pixijs.com/8.x/guides/getting-started/ecosystem
- PixiJS — Particle Container guide — https://pixijs.com/8.x/guides/components/scene-objects/particle-container
- PixiJS Sound (separate plugin) — https://pixijs.io/sound/
- PixiJS npm (latest 8.19.0, `types` field) — https://www.npmjs.com/package/pixi.js
- PixiJS v8.19.0 release — https://github.com/pixijs/pixijs/releases/tag/v8.19.0
- MDN — Canvas API — https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API
- MDN — CanvasRenderingContext2D — https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D
- MDN — drawImage() — https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/drawImage
- MDN — Web Audio API — https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API
- MDN — Pointer events — https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events
