# AUDIT_FROM_GLM — VISUAL-COMBAT-FX-01

**Task:** VISUAL-COMBAT-FX-01 — minimal procedural light_tank shot and hit effects
**Lane:** Audit only
**Date:** 2026-05-12

---

## 1. Root cause / цель аудита

Light_tank combat currently has zero visual feedback. When a tank fires, the only observable change is the target's HP bar shrinking. There is no shot/tracer, no muzzle flash, no impact/hit effect. This makes combat feel lifeless and makes it hard for the player to notice that a tank is actually shooting.

The root cause is that `updateLightTankCombat()` (L1441) applies damage purely logically — it decrements HP via `damageUnit()` / `FE_PATCH_06BDamageBuilding()` and resets the cooldown timer. No visual event is emitted at the point of fire or impact. The rendering pipeline in `render()` (L12390) only draws static sprites, HP bars, dust particles, and click markers — nothing related to combat.

---

## 2. Существующая particle/effect система

The game already has a mature procedural particle system for **builder dust** (FE_BUILDER_DUST_PATCH, L12133–12336). This system provides a proven pattern we can replicate for combat FX:

| Компонент | Dust аналог | Combat FX аналог |
|-----------|-------------|-----------------|
| Storage | `game.dustParticles[]` | `game.combatFxParticles[]` |
| Spawn function | `spawnBuilderDust(unit, mode, dx, dy)` (L12163) | `spawnShotFx(attacker, target)` + `spawnHitFx(target)` |
| Update function | `updateDustParticles(dt)` (L12294) | `updateCombatFxParticles(dt)` |
| Draw function | `drawDustParticles()` (L12309) | `drawCombatFxParticles()` |
| Max particles cap | `FE_BUILDER_DUST_MAX_PARTICLES = 80` | `FE_COMBAT_FX_MAX_PARTICLES = 60` |
| Particle lifetime | 0.32–0.56 sec | Shot tracer: ~0.18 sec, Hit flash: ~0.25 sec |
| Draw order | After terrain, before z-sorted objects (L12414) | Same — or after units for overlay effect |

The dust system demonstrates:
- Position in **tile coordinates** with `tileToScreen()` conversion at draw time
- `baseOffsetX/baseOffsetY` for screen-space offsets relative to sprite anchor
- Velocity (`vx/vy`) in screen-space pixels per second
- Fade via `life/maxLife` ratio
- `ctx.globalAlpha` for transparency
- `ctx.ellipse()` for particle shapes
- Particle cap with splice to prevent memory growth

---

## 3. Где в combat pipeline вставлять FX

**Critical point: `updateLightTankCombat()` line 1475**

```javascript
if (unit.attackCooldown <= 0) {
  const killed = isBuildingTarget
    ? FE_PATCH_06BDamageBuilding(target, stats.damage)
    : damageUnit(target, stats.damage);
  unit.attackCooldown = stats.cooldown;
  // << FX SPAWN POINT — right here, after damage application
```

This is the exact frame where a shot is fired. At this point we know:
- `unit` — the attacker (has `unit.x`, `unit.y`, `unit.type`, direction via `unit._renderDir`)
- `target` — the target (has position, kind)
- `isBuildingTarget` — whether target is a building or unit

We need to spawn two effects here:
1. **Shot/tracer**: a short bright line or elongated glow from attacker toward target
2. **Hit/impact**: a small burst at the target position

---

## 4. Какой эффект нужен

### Effect A: Shot/tracer (дульная вспышка + трассер)

**Visual:** A short bright line from the tank's turret toward the target, lasting ~0.15–0.20 seconds. It should fade quickly. Color: bright yellow/white for player, reddish for enemy.

**Implementation approach:**
- Spawn 2–3 small elongated particles along the line from attacker to target
- Each particle: position along the line, velocity toward target, short life
- Use `ctx.ellipse()` with horizontal stretch for tracer shape
- Alternative (simpler): a single short-lived particle at the attacker's position that moves toward the target position over ~0.15 sec

**Simpler approach (recommended):** Instead of a true tracer line, spawn a **muzzle flash** at the attacker position — a bright expanding circle that fades in ~0.15 sec. This is visually clear and trivially simple:
- Position: attacker's tile coordinates
- Size: starts small (~3px), grows to ~8px over life
- Alpha: starts at 0.8, fades to 0
- Color: yellow-white (#ffe060) for player, red-orange (#ff6630) for enemy

### Effect B: Hit/impact (вспышка попадания)

**Visual:** A small bright burst at the target position, lasting ~0.20–0.25 seconds. Expanding then fading.

**Implementation approach:**
- Spawn 3–5 small particles at the target position
- Each particle: random offset, slight outward velocity, short life
- Use `ctx.ellipse()` with decreasing alpha
- Color: orange/yellow for unit hit, gray/orange for building hit

**Simpler approach (recommended):** A single expanding ring/flash at the target's center:
- Position: target center (`FE_PATCH_06BTargetCenter()` for buildings, `{x: target.x, y: target.y}` for units)
- Size: starts at ~4px, expands to ~12px over life
- Alpha: starts at 0.7, fades to 0
- Color: bright orange (#ff8c30) fading to dark

### Effect C (optional): Smoke puff at impact

A secondary delayed particle (~2 particles, dark gray, rising slowly) after the hit flash. This adds "weight" to the impact. Can be added in the same system — just different color/velocity/longer life.

---

## 5. Точные функции/файлы для изменения

**Единственный файл:** `src/main.js`

| # | Функция / блок | Линия | Изменение |
|---|---------|-------|-----------|
| 1 | Constants near combat/dust constants | ~L12133 | Add `FE_COMBAT_FX_MAX_PARTICLES`, `FE_COMBAT_FX_SHOT_LIFE`, `FE_COMBAT_FX_HIT_LIFE`, color constants |
| 2 | New: `spawnShotFx(attacker, targetPos)` | After dust system | Spawn muzzle flash particles at attacker position |
| 3 | New: `spawnHitFx(target, isBuilding)` | After dust system | Spawn hit burst particles at target position |
| 4 | New: `updateCombatFxParticles(dt)` | After `updateDustParticles` | Update life, position, velocity of combat FX particles |
| 5 | New: `drawCombatFxParticles()` | After `drawDustParticles` | Render combat FX particles using canvas 2D |
| 6 | `updateLightTankCombat()` | L1475–1479 | After damage application, call `spawnShotFx(unit, targetCenter)` and `spawnHitFx(target, isBuildingTarget)` |
| 7 | `update()` | L14347 (after `updateDustParticles(dt)`) | Add `updateCombatFxParticles(dt)` |
| 8 | `render()` | L12414 (after `drawDustParticles()`) | Add `drawCombatFxParticles()` |
| 9 | Game init | L187 (near `clickMarkers:[]`) | Add `combatFxParticles:[]` to game object init |

---

## 6. Как рисовать трассер без asset dependency

The task requires **no asset dependencies** — no sprite sheets, no images. Everything must be procedural via Canvas 2D API.

### Shot/tracer rendering:

```javascript
// Short bright line from attacker toward target
function drawCombatFxParticles() {
  if (!game?.combatFxParticles?.length) return;
  const z = game.camera.zoom;
  ctx.save();
  for (const p of game.combatFxParticles) {
    const pos = tileToScreen(p.x, p.y);
    const t = clamp(p.life / p.maxLife, 0, 1);
    ctx.globalAlpha = p.alpha * t;
    if (p.fxType === 'shot') {
      // Muzzle flash: expanding bright circle at attacker position
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.ellipse(
        pos.x + (p.baseOffsetX || 0) * z,
        pos.y + (p.baseOffsetY || 0) * z,
        p.r * z,
        p.r * 0.6 * z,
        0, 0, Math.PI * 2
      );
      ctx.fill();
    } else if (p.fxType === 'tracer') {
      // Short line from attacker toward target
      ctx.strokeStyle = p.color;
      ctx.lineWidth = Math.max(1.5, p.width * z * t);
      ctx.lineCap = 'round';
      ctx.beginPath();
      const sx = pos.x + (p.ox || 0) * z;
      const sy = pos.y + (p.oy || 0) * z;
      const ex = sx + p.dx * z * t;
      const ey = sy + p.dy * z * t;
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
    } else if (p.fxType === 'hit') {
      // Expanding ring/burst at target position
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.ellipse(
        pos.x + (p.ox || 0) * z,
        pos.y + (p.oy || 0) * z,
        p.r * z,
        p.r * 0.65 * z,
        0, 0, Math.PI * 2
      );
      ctx.fill();
    }
  }
  ctx.restore();
}
```

This uses only `ctx.ellipse()`, `ctx.fillStyle`, `ctx.strokeStyle`, `ctx.beginPath()`, `ctx.moveTo()`, `ctx.lineTo()`, `ctx.stroke()`, `ctx.fill()` — all standard Canvas 2D with no images.

---

## 7. Visibility check

Combat FX must respect fog of war. A player should not see enemy-on-enemy combat FX in fog, and enemy-on-player combat FX should only show if the attacker/target is visible.

**Existing helper:** `isVisible(x, y)` (L11534) checks `game.fogVisible[y][x]`.

**Rule:**
- Player tank shooting: always show FX (player sees their own units)
- Enemy tank shooting player unit: show if attacker OR target tile is visible to player
- Enemy-on-enemy: only show if the area is visible to player

Simple implementation: before spawning FX, check if at least one of (attacker position, target position) is `isVisible()`. For player-initiated shots, skip the check entirely.

---

## 8. Что НЕ трогать

- Combat damage/range/cooldown values and formulas
- `damageUnit()` / `FE_PATCH_06BDamageBuilding()` logic
- Pathfinding / `findPath` / `passable`
- Scout lifecycle (`FE_SCOUT01*`, `FE_INTEL01*`)
- BOT-ATTACK-11/12 attack gate logic
- BOT-COMBAT-AWARENESS-01
- BOT-DEFENSE-RETREAT-01
- BOT-PROGRESSION-01
- ATTACK-04 hq_push protection
- ATTACK-08 invariant repair
- ATTACK-10 wave lock
- Enemy production / economy / BRAIN-01
- Builder dust system (separate system, do not merge)
- Save/load
- Fog rendering logic
- Map generation
- Building construction logic
- Unit state machine (idle/moving/attacking states)
- HP bar rendering
- Unit sprite rendering

---

## 9. Риск

**Low.**

Обоснование:

- **Purely additive rendering:** Adding a new particle system that is drawn after existing content. It does not modify any existing draw calls or render state.
- **No gameplay changes:** Combat FX are visual-only. They do not affect damage, targeting, pathfinding, or any game logic. The `updateLightTankCombat()` change is a single-line call to `spawnShotFx/spawnHitFx` after the existing damage application — it does not change the combat flow.
- **Proven pattern:** The dust particle system has been stable for multiple patches. Combat FX use the same pattern: `game.combatFxParticles[]`, spawn/update/draw lifecycle, particle cap.
- **No asset dependency:** All FX are procedural Canvas 2D. No image loading, no sprite sheets.
- **Visibility-gated:** FX only render when visible to player. No information leak through fog.
- **Worst case:** Too many particles could cause a minor frame rate dip in large battles. Mitigated by `FE_COMBAT_FX_MAX_PARTICLES` cap (default 60) and short particle lifetimes (~0.2 sec). With cooldown of 0.75 sec per tank, even 10 tanks firing simultaneously produce only ~30 particles per second, decaying quickly.

---

## 10. Telemetry / debug plan

Minimal telemetry. Existing systems already provide enough debug info. Add one debug object:

```javascript
game._combatFx01 = {
  shotCount: 0,        // total shot FX spawned
  hitCount: 0,         // total hit FX spawned
  activeParticles: 0   // current live particle count
}
```

This is populated by the spawn functions and updated by the update function. Accessible via browser console: `game._combatFx01`.

No per-frame noisy telemetry. The debug object is only for development tuning.

---

## 11. Targeted smoke test plan

**Сценарий 1 — Player tank fires at enemy:**
1. Start skirmish, produce a player light_tank.
2. Move tank near enemy, observe attack engagement.
3. Verify: bright yellow muzzle flash appears at player tank position when it fires.
4. Verify: orange hit burst appears at the enemy target position on impact.
5. Verify: effects are short-lived (~0.2 sec), do not linger.
6. Verify: HP bar of target still decreases normally (combat unchanged).

**Сценарий 2 — Enemy tank fires at player:**
1. Let enemy tanks engage player tanks/buildings.
2. Verify: red-orange muzzle flash appears at enemy tank position.
3. Verify: orange hit burst appears at player target position.
4. Verify: effects only visible when area is not in fog.

**Сценарий 3 — Multiple tanks fighting:**
1. Create a large engagement (3+ tanks per side).
2. Verify: FX do not cause noticeable frame rate drop.
3. Verify: FX do not overlap excessively or obscure units.
4. Verify: particle count stays within cap (`game._combatFx01.activeParticles`).

**Сценарий 4 — Tank attacks building:**
1. Player tank attacks enemy building.
2. Verify: hit effect appears at building center (not at corner).
3. Verify: building HP decreases normally.

**Сценарий 5 — Fog of war:**
1. Player has no vision of enemy area.
2. Enemy tanks fight each other (if possible in current AI).
3. Verify: no combat FX visible in fogged area.
4. Verify: when player gains vision, FX appear correctly.

**Сценарий 6 — Regression:**
1. Normal game flow — bot should build, attack, defend normally.
2. Combat damage/range/cooldown unchanged.
3. Dust particles still work normally.
4. Click markers still work normally.
5. Save/load works correctly (combatFxParticles are visual-only, no need to persist).

Жду «Делай».
