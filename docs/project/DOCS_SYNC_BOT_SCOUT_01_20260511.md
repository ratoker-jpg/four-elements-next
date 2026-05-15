# DOCS-SYNC-BOT-SCOUT-01 — scout checkpoint

**Дата:** 2026-05-11  
**Тип:** docs-only checkpoint  
**Lane:** Fast  
**Ветка:** sandbox/main  
**Основание:** ручной smoke после `BOT-SCOUT-01`, `BOT-SCOUT-01B`, `BOT-SCOUT-01C`

---

## 1. Краткий статус

Scout MVP для enemy bot в целом запущен:

```text
enemy units_factory -> scout production -> scout cap -> scout movement -> scout telemetry
```

Подтверждено вручную:

- enemy производит scout;
- enemy scout cap работает: одновременно максимум 2 scout;
- player scout cap работает: максимум 2 scout alive/queued/producing;
- scout стал быстрее: `0.72 -> 1.08`;
- scout стал чуть крупнее: `[84,84] -> [92,92]`;
- после `BOT-SCOUT-01B/01C` enemy scouts реально двигаются;
- `game._botScout01` обновляется;
- `game._botScout01MoveFix` обновляется;
- scouts не входят в `light_tank` attack wave;
- танковая attack-chain после появления scout не сломалась.

---

## 2. Принятые патчи

| PR | Патч | Статус | Что закрыл |
|---:|---|---|---|
| #34 | `BOT-SCOUT-01` | ✅ merged | Scout production/cap/tuning/telemetry MVP |
| #35 | `BOT-SCOUT-01B` | ✅ merged | Исправлен неправильный вызов `findPath` для scout movement |
| #36 | `BOT-SCOUT-01C` | ✅ merged | Исправлен stuck-case: target metadata есть, path пустой, scout считался en route |

---

## 3. Что работает сейчас

### Scout production / cap

```text
player scout cap = 2
enemy scout cap = 2
count = alive + queued + producing
если scout уничтожен, можно построить нового
```

### Scout movement

После `BOT-SCOUT-01C` оба enemy scouts могут получить path и ехать:

```text
state = manual_move
command = move
pathLen > 0
role = scout
```

Пример ручного smoke:

```text
scout_127 -> manual_move, pathLen 20 -> 13
scout_129 -> manual_move, pathLen 30 -> 24
оба идут к scouting target 40,40
```

### Telemetry

```js
FE_CORE.game._botScout01
FE_CORE.game._botScout01MoveFix
```

Ожидаемый movement fix:

```js
{
  ok: true,
  reason: 'ok' || 'repath_empty_path',
  afterState: 'manual_move',
  pathLen: > 0
}
```

---

## 4. Что НЕ ок / следующий слой

### 4.1. Scout нельзя атаковать игроком

Наблюдение:

```text
enemy scouts доезжают до player base area,
стоят рядом с базой,
player не может атаковать scout.
```

Это неправильно.

Правильная логика:

```text
canAttack:false = scout сам не наносит урон
но scout должен быть targetable / killable для player combat units
```

Следующий патч:

```text
BOT-SCOUT-02A — scout targetable / killable
```

Требования:

- player light_tank должен уметь атаковать enemy scout;
- enemy scout должен получать урон и умирать как обычный unit;
- scout сам не должен атаковать;
- scout не должен входить в attack wave;
- не трогать tank attack-chain без необходимости.

---

### 4.2. Scouts стоят у player base после разведки

Сейчас scout доезжает до scouting area и может остаться рядом с базой игрока.

Нужен scout lifecycle:

```text
outbound -> observing -> returning -> cooldown -> outbound
```

Желаемое поведение:

1. Scout выезжает из enemy base.
2. Доезжает до scouting area / player area.
3. Наблюдает 3–5 секунд.
4. Записывает enemy knowledge / telemetry.
5. Возвращается к enemy HQ / safe rally.
6. После cooldown может снова выйти в разведку.

Если встретил угрозу:

```text
threat spotted -> evade / обход -> если не смог -> retreat -> shorter retry cooldown
```

Следующий патч после targetability:

```text
BOT-SCOUT-02B — scout observe-return-cooldown lifecycle
```

---

### 4.3. Два early scouts для 1v1 избыточны

Наблюдение:

```text
в 1v1 боту достаточно одного early scout.
второй scout может быть нужен позже, но не сразу.
```

Текущая логика допускает 2 scouts, и оба могут одновременно ехать на разведку.

Желаемая логика:

```text
enemy scout hard cap = 2
enemy early soft target = 1
second scout allowed later
```

Варианты условия второго scout:

- `game.time >= 600 sec`;
- или large map;
- или first scout destroyed / unavailable;
- или enemy economy стабилизировалась;
- или enemy уже имеет достаточно combat units.

Следующий маленький патч:

```text
BOT-SCOUT-02C — enemy second scout late-game gate
```

Приоритет ниже, чем targetability.

---

## 5. Рекомендуемая очередь после сна

### Шаг 1 — самый важный

```text
BOT-SCOUT-02A — enemy scout targetable / killable by player combat units
```

Почему первым:

```text
если scout приехал к базе, игрок обязан иметь возможность его убить.
это базовая gameplay-интеракция.
```

---

### Шаг 2

```text
BOT-SCOUT-02B — scout observe-return-cooldown lifecycle
```

Почему вторым:

```text
скаут не должен кемпить у базы игрока бесконечно.
```

---

### Шаг 3

```text
BOT-SCOUT-02C — second scout late-game gate
```

Почему третьим:

```text
два ранних scout не ломают игру критически,
но стратегически для 1v1 это лишнее.
```

---

## 6. Чего не делать следующим

Не делать большой `BOT-BRAIN` до закрытия базового scout gameplay.

Не трогать без отдельного факта:

- `findPath` internals;
- `passable`;
- ATTACK-08/09/10;
- tank attack-chain;
- production economy;
- full AI rewrite;
- save/load.

---

## 7. Быстрые проверки

### Scout movement

```js
FE_CORE.game._botScout01
FE_CORE.game._botScout01MoveFix
```

### Enemy scout table

```js
console.table(
  FE_CORE.game.units
    .filter(u => u.owner === 'enemy' && u.type === 'scout')
    .map(u => ({
      id: u.id,
      x: Math.round(u.x * 10) / 10,
      y: Math.round(u.y * 10) / 10,
      state: u.state,
      command: u.command,
      targetX: u.targetX,
      targetY: u.targetY,
      pathLen: u.path?.length || 0,
      role: u._fe10c1Role || '',
      scoutTargetX: u._fe10c1ScoutTarget?.x ?? '',
      scoutTargetY: u._fe10c1ScoutTarget?.y ?? '',
      waveId: u._attack10WaveId || '',
      locked: !!u._attack10WaveLocked
    }))
)
```

### Expected current PASS

```text
scout moves
pathLen > 0 during movement
state = manual_move
waveId empty
locked = false
```

### Known current FAIL

```text
player cannot attack enemy scout
scout may stay near player base after arrival
2 early scouts may be excessive for 1v1
```
