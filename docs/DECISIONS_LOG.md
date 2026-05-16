# Decisions Log

## 2026-05-16

### D001: Create separate repository

Decision: `four-elements-next` is a separate new project.

Reason: Sandbox accumulated legacy architecture and must remain reference only.

### D002: Use TypeScript and Vite

Decision: Next uses TypeScript strict mode and Vite.

Reason: explicit imports, type contracts, faster development, no script-tag architecture.

### D003: First version is civil sandbox

Decision: no combat units and no enemy AI in first playable version.

Reason: economy, construction, Power, Control, Builder, and Harvester must work first.

### D004: New economy model

Decision: use Raw, Matter, Element, Power, Control.

Reason: old Energy-as-currency model was unclear.

### D005: Control system

Decision: HQ gives +10 Control, Command Relay gives +5 Control and consumes 1 Power.

Reason: unit cap should be separate from Power and resources.

### D006: Sandbox combat assets are not final Next assets

Decision: do not reuse light_tank, heavy_tank, bomber, scout as final product units.

Reason: future combat uses Hull + Weapon with new assets and roles.

### D007: NEXT-02 asset scope

Decision: NEXT-02 may copy only terrain, environment/resource/decor, and faction HQ assets.

Reason: NEXT-02 is visual baseline only, not unit gameplay.
