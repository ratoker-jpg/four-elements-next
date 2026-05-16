# Architecture Rules

## Core rule

Architecture first. Implementation follows approved scope.

## Composition root

`src/main.ts` is wiring only.

Allowed in `main.ts`:

- create app root
- create managers
- register screens or systems
- start the app

Forbidden in `main.ts`:

- gameplay rules
- rendering details
- map generation
- economy logic
- combat logic

Hard limit: `main.ts < 200 lines`.

## Renderer

`src/render/renderer.ts` is orchestrator only.

Target: under 100 lines.
Hard stop: 150 lines.

Rendering details live in separate files:

- terrain
- buildings
- units
- environment
- overlays
- effects

Render reads state and draws. Render does not mutate gameplay state.

## Systems ownership

Each system owns one area.

- Movement owns position, paths, speed.
- Economy owns resources and conversion.
- Power owns power supply, demand, priority.
- Control owns unit cap.
- Construction owns building creation and construction progress.
- Production owns unit queues and spawning.
- Input translates user actions into commands.
- Screens own DOM subtree and screen transitions only.

No hidden cross-system mutation.

## No legacy patterns

Forbidden:

- `window.FE_*` globals
- script-tag module architecture
- `FE_PATCH_*`
- copying legacy `src/main.js`
- old bot runtime
- debug hacks as product features

## Tests

Every system needs tests before it is accepted.

- Pure logic: Vitest unit tests.
- System interaction: integration tests.
- User flow: Playwright E2E tests.
