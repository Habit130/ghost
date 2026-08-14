# Deterministic Game Core with a Thin Phaser Renderer

Boo Dash separates all game logic into a pure TypeScript core (`src/core/`, zero Phaser
imports: state + `step(state, events, dt)` + injected RNG) and keeps Phaser (`src/game/`)
as a thin renderer that reads the core's state each frame and translates keyboard/touch
input into semantic events. We chose full separation over embedding logic in Phaser scenes
or delegating movement/collisions to Phaser's physics, because a deterministic, fully
unit-testable core is the only way a 1–2 week arcade game ships with CI catching logic bugs
and seed-based replay reproducing them.

## Status

accepted

## Considered Options

- **Full separation (chosen)** — core owns all rules; renderer only draws state.
- **Hybrid** — rules in core, movement/collisions in Phaser Arcade Physics. Rejected: two
  clocks (core step vs physics step) fight, determinism is lost, replay is impossible.
- **No separation** — logic inside Phaser scenes, pure helpers extracted. Rejected:
  fastest to start, but logic grows entangled in scenes and becomes untestable; highest
  risk for the deadline.

## Consequences

- Fixed 60 Hz timestep with an accumulator in the render layer; the core only ever sees
  `dt = 1/60s`.
- All randomness flows through an injected seedable RNG (no `Math.random` in the core), so
  tests and bug replays are reproducible.
- Input reaches the core as semantic events (`dash(direction)`, `tapHost(hostId)`,
  `pause`, `restart`); keyboard/touch mapping and snap-assist live in the render layer.
- The core is fully covered by vitest under Node; the render layer has no unit tests and is
  verified by typecheck/build in CI plus manual playtesting.
- Gameplay must not use Phaser's physics or collision systems; the render layer syncs
  sprites to core state each frame.
