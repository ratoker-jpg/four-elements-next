# DOCS-SYNC-BOT-ATTACK-06-10 — attack-chain checkpoint

**Дата:** 2026-05-10  
**Тип:** docs-only checkpoint  
**Lane:** Fast  
**Ветка:** sandbox/main  
**Основание:** ручной smoke после серии `BOT-ATTACK-06..10`

---

## 1. Краткий статус

Attack-chain enemy bot MVP считается стабилизированной на уровне playable smoke:

```text
enemy economy -> units_factory -> produced light_tank -> attack order -> movement -> target switch -> attack/damage
```

Подтверждено вручную:

- enemy производит `light_tank` через `units_factory`;
- enemy tanks получают attack/hq_push order;
- tanks двигаются к player HQ;
- новая production queue больше не сбрасывает текущую атаку;
- tanks могут доехать до базы игрока и начать атаку;
- при появлении player tank в зоне видимости enemy tank может переключиться и атаковать его;
- `BAD = manual_move + attack + attackApproachTargetId` больше не висит как стабильный баг после ATTACK-08/10.

---

## 2. Принятые патчи

| PR | Патч | Статус | Что закрыл |
|---:|---|---|---|
| #29 | `BOT-ATTACK-06` | ✅ merged | Movement stall / `recoverUnitPath` для enemy attack tanks |
| #30 | `BOT-ATTACK-07` | ✅ merged | Guard/sync для `manual_move + command=attack + attackApproachTargetId` |
| #31 | `BOT-ATTACK-08` | ✅ merged | Global per-tick invariant repair вне attack phase |
| #32 | `BOT-ATTACK-09` | ✅ merged | Experimental enemy `light_tank` production cap, подтвердил гипотезу про production/wave reset |
| #33 | `BOT-ATTACK-10` | ✅ merged | Lock active attack wave composition, новые танки не сбрасывают текущую волну |

---

## 3. Главное решение после smoke

Текущая атака теперь работает как MVP. Не продолжать бесконечно чинить attack-state без новых фактов.

Правильный следующий фокус:

```text
1. bot scouting / dedicated scout
2. enemy knowledge / memory
3. attack readiness / strength estimate
4. wave minimum / not one-by-one suicide
```

Наблюдение после `BOT-ATTACK-10`:

```text
enemy может ехать в атаку даже одним танком.
```

Это не баг текущего movement/attack chain. Это следующий уровень AI-decision:

```text
бот должен понимать свою силу, разведданные и риск перед атакой.
```

---

## 4. Что НЕ чинить прямо сейчас

Не делать следующий `BOT-ATTACK-11`, если нет нового конкретного regression-факта.

Не трогать без отдельного аудита:

- `findPath`;
- `passable`;
- combat damage/range/cooldown;
- ATTACK-08 invariant repair;
- ATTACK-09 cap, кроме тестового изменения значения из консоли;
- production manager rewrite;
- full bot AI rewrite.

---

## 5. Рекомендуемая следующая очередь

### Шаг 1 — scout MVP

```text
BOT-SCOUT-01 / PATCH-SCOUT-04 style route
```

Цель:

```text
бот получает разведку не через omniscient state, а через scout/knowledge loop.
```

Минимальный состав:

- scout cap = 2;
- scout быстрее tank;
- enemy может произвести scout;
- scout едет к center / likely player area / known player area;
- scout обновляет enemy knowledge.

### Шаг 2 — attack readiness / strength gate

```text
BOT-BRAIN-02A — attack readiness / wave minimum
```

Цель:

```text
бот не отправляет одиночный танк в слепую атаку, если нет разведки или уверенности.
```

Правила MVP:

- без разведки — ждать минимум 2-3 tanks;
- если player слабый/видимый — можно атаковать раньше;
- новые произведённые tanks не сбрасывают locked active wave;
- wave-lock из ATTACK-10 остаётся.

---

## 6. Telemetry для ручной проверки

### Проверка ATTACK-10

```js
window.FE_CORE.game._attack10ActiveWave
window.FE_CORE.game._attack10LastWaveLock
```

### Проверка ATTACK-09 cap

```js
window.FE_CORE.game._attack09EnemyTankCap
window.FE_ENEMY_LIGHT_TANK_CAP = 3
window.FE_ENEMY_LIGHT_TANK_CAP = 5
window.FE_ENEMY_LIGHT_TANK_CAP = null
```

### Проверка BAD state

```js
window.FE_CORE.game.units
  .filter(u => u.owner === 'enemy' && u.type === 'light_tank')
  .map(u => ({
    id: u.id,
    state: u.state,
    command: u.command,
    attackApproachTargetId: u.attackApproachTargetId || '',
    waveId: u._attack10WaveId || '',
    locked: !!u._attack10WaveLocked,
    BAD: u.state === 'manual_move' && u.command === 'attack' && !!u.attackApproachTargetId
  }))
```

---

## 7. Roadmap correction

Старые roadmap-документы могут ещё ссылаться на маршруты `PATCH-10D1..10I1` или `BOT-ATTACK-06` как текущий блокер.

Актуальная поправка:

```text
BOT-ATTACK-06..10 уже пройдены.
Attack-chain MVP стабилизирован.
Следующий gameplay focus — scout / knowledge / strength readiness.
```

Этот checkpoint читать вместе с:

```text
PATCH_REPORT.txt
docs/project/four_elements_bot_roadmap_merged_glm.md
docs/project/scout_unit_roadmap_20260509.md
```
