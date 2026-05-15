# Four Elements — Workflow Reglament



Актуальный рабочий регламент проекта. Каноническая версия без даты в имени.



## 0. Статус



| Параметр | Значение |

|---|---|

| Основная WORK-папка | `C:\Users\Den\Desktop\four elements\four_elements_core_base` |

| Старый fallback | `C:\Users\Den\Desktop\four elements\four_elements_core_base_v03` |

| Запуск | `00_START_GAME_WORK_8010.bat` |

| Адрес игры | `http://localhost:8010/index.html` |

| Патч-раннер | `02_RUN_PATCH_AND_CHECK.bat patch.py` |

| Google Drive mirror | `FourElements_WORK_MIRROR` |

| Синк mirror | `04_SYNC_WORK_MIRROR_TO_GOOGLE_DRIVE.bat` |

| Visual scenarios | `05_RUN_VISUAL_SCENARIOS.bat hud/all/victory/defeat` |

| Регламент | `docs/project/four_elements_workflow_reglament.md` |

| Roadmap | `docs/project/four_elements_patch_roadmap_actual.md` |

| New chat prompt | `docs/project/AI_READ_FIRST.md` (NEW_CHAT_START_PROMPT.md архивирован: `docs/archive/dangerous_old/`) |

| Codex Gate | Codex только с `CODEX_APPROVED_*` |

| Stable checkpoint | `PATCH-09E2-DOCS-ENEMY-FACTORY-PRODUCTION-CHECKPOINT` |



---



## 1. Главный принцип



Не патчить по памяти.



Перед любой кодовой правкой нужен актуальный контекст:



1. предпочтительно — Google Drive mirror `FourElements_WORK_MIRROR`;

2. fallback — свежий `_exports\GPT_WORK_SEND_THIS_CONTEXT.zip`.



После анализа выбирается маршрут:



```text

GPT patch.py / Codex audit / Codex patch / rollback

```



Codex не является вариантом по умолчанию, даже если пользователь сам предложил “отдать в Codex”. Сейчас Codex нужно беречь до рискованных задач.

<!-- FE_CONTEXT_FRESHNESS_GUARD_START -->
### 1.1. Context Freshness Guard

Перед каждой задачей по проекту GPT обязан заново сверить актуальные источники, а не опираться на память чата или старые handoff-тексты.

Обязательный порядок:

1. Сначала читать свежий Google Drive mirror `FourElements_WORK_MIRROR`:
   - `README_SYNC.txt`;
   - `project_docs/AGENTS.md`;
   - `project_docs/docs/project/four_elements_workflow_reglament.md`;
   - `project_docs/docs/project/NEW_CHAT_START_PROMPT.md` (АРХИВИРОВАН — см. `docs/archive/dangerous_old/`);
   - `project_docs/docs/project/four_elements_patch_roadmap_actual.md`;
   - `gpt_state/LAST_SYNC.txt`;
   - `gpt_state/LAST_PATCH_REPORT.txt`;
   - `patch_reports/ROOT_PATCH_REPORT.txt`.
2. Если mirror недоступен, неполный, stale или конфликтует с загруженным архивом — не додумывать.
3. Сделать повторную попытку чтения/поиска актуального mirror/context в текущем проходе.
4. Если уверенности всё ещё нет — запросить у пользователя свежий архив:

```text
_exports\GPT_WORK_SEND_THIS_CONTEXT.zip
```

5. Если ZIP неполный, например не содержит ожидаемые `AGENTS.md`, `AI_READ_FIRST.md` (замена архивированного `NEW_CHAT_START_PROMPT.md`), регламент, roadmap или актуальный `PATCH_REPORT.txt`, это считается предупреждением. Для рискованных задач по коду нужно остановиться и попросить пересобрать/прислать корректный контекст.
6. При конфликте источников явно назвать конфликт и выбрать более свежий источник только по фактам: timestamp, `PATCH_REPORT.txt`, `LAST_SYNC.txt`, содержимое файлов.
7. Запрещено подставлять старые пути, старые patch names или старый статус из памяти, если они не подтверждены свежим mirror/context.

Короткое правило:

```text
Факт из актуального mirror/context > пользовательский свежий архив > загруженный audit/report > память GPT.
```

<!-- FE_CONTEXT_FRESHNESS_GUARD_END -->

<!-- FE_DOCS_CADENCE_RULE_START -->
### 1.2. Documentation cadence

После каждых **двух принятых успешных патчей** следующей задачей должен быть docs-sync patch, а не новая фича.

Что считается принятым успешным патчем:

- патч применён через `02_RUN_PATCH_AND_CHECK.bat`;
- обязательные проверки прошли;
- если патч затрагивал поведение/UI — ручной или visual smoke check прошёл;
- пользователь подтвердил, что работает, или явно принял результат;
- после этого был выполнен `04_SYNC_WORK_MIRROR_TO_GOOGLE_DRIVE.bat`.

Правило:

1. Считать только принятые успешные патчи.
2. Не считать failed/partial/superseded попытки, пока нет принятого replacement-патча.
3. После двух принятых патчей GPT обязан сам остановить следующий feature/code step и предложить docs patch.
4. Docs patch обновляет актуальный статус в `AGENTS.md`, регламенте, `AI_READ_FIRST.md` (замена `NEW_CHAT_START_PROMPT.md`), roadmap, `PATCH_REPORT.txt` и `_inbox/session_summary_...txt`, если эти файлы релевантны.
5. После синка docs patch счётчик обнуляется.
6. Пользователь не должен отдельно напоминать об обновлении документации.

Текущая точка обнуления:

```text
PATCH-09E2-DOCS-ENEMY-FACTORY-PRODUCTION-CHECKPOINT
```

<!-- FE_DOCS_CADENCE_RULE_END -->



---



## 2. Source of truth



Источник истины:



```text

C:\Users\Den\Desktop\four elements\four_elements_core_base

```



Google Drive mirror — только зеркало для чтения GPT/Codex.



Запрещено напрямую патчить:



```text

G:\Мой диск\FourElements_WORK_MIRROR

```



Старый `four_elements_core_base_v03` — только fallback/архив.



---



## 3. Google Drive mirror workflow



После любого патча или ручного изменения запускать:



```bat

04_SYNC_WORK_MIRROR_TO_GOOGLE_DRIVE.bat

```



Этот батник делает:



```text

03_PREPARE_GPT_STATE

01_BUILD_GPT_CONTEXT_WORK

sync lightweight mirror to Google Drive

sync visual screenshots

```



Ожидаемая структура mirror:



```text

FourElements_WORK_MIRROR/

├─ README_SYNC.txt

├─ code_snapshot/

├─ project_docs/

├─ gpt_exports/

├─ patch_reports/

├─ gpt_state/

└─ visual_screenshots/

```



Для нового чата GPT должен читать:



```text

README_SYNC.txt

project_docs/AGENTS.md

project_docs/docs/project/four_elements_workflow_reglament.md

project_docs/docs/project/NEW_CHAT_START_PROMPT.md  (АРХИВИРОВАН — см. docs/archive/dangerous_old/)

project_docs/docs/project/four_elements_patch_roadmap_actual.md

gpt_state/LAST_SYNC.txt

gpt_state/HASHES.txt

gpt_state/LAST_PATCH_REPORT.txt

patch_reports/ROOT_PATCH_REPORT.txt

visual_screenshots/latest/*.png

```



---



## 4. Стандартный цикл патча



```text

1. Пользователь даёт задачу.

2. GPT читает актуальный context/mirror.

3. GPT оценивает риск.

4. Если задача локальная — GPT делает patch.py.

5. Пользователь запускает:

   02_RUN_PATCH_AND_CHECK.bat patch.py

6. Если нужен визуальный контроль:

   05_RUN_VISUAL_SCENARIOS.bat hud/all/victory/defeat

7. Пользователь запускает:

   04_SYNC_WORK_MIRROR_TO_GOOGLE_DRIVE.bat

8. Следующая задача идёт уже от свежего mirror.

```



Для JS-патчей `node --check` обязателен.



---



## 5. Актуальные батники



В корне должны быть только основные entrypoint-батники:



```text

00_START_GAME_WORK_8010.bat

01_BUILD_GPT_CONTEXT_WORK.bat

02_RUN_PATCH_AND_CHECK.bat

03_PREPARE_GPT_STATE.bat

04_SYNC_WORK_MIRROR_TO_GOOGLE_DRIVE.bat

05_RUN_VISUAL_SCENARIOS.bat

```



Dev/helper-батники — в:



```text

tools/dev_bat/

tools/dev_ps1/

```



Старые alias-файлы — в `_archive`, не в корне.



---



## 6. GPT context



Единственный правильный архив:



```text

_exports\GPT_WORK_SEND_THIS_CONTEXT.zip

```



Запрещено использовать старое имя:



```text

_exports\gpt_context_latest.zip

```



Контекст должен быть лёгким. Включать:



- `src/` без assets-бинарей;

- `index.html`;

- `AGENTS.md`;

- `docs/project/four_elements_workflow_reglament.md`;

- `docs/project/NEW_CHAT_START_PROMPT.md` (АРХИВИРОВАН — см. `docs/archive/dangerous_old/`);

- `docs/project/four_elements_patch_roadmap_actual.md`;

- `PATCH_REPORT.txt`;

- `_gpt_state`;

- selected latest patch reports;

- основные BAT-файлы 00–05.



Не включать:



- `.git/`;

- `node_modules/`;

- `test-results/`;

- binary assets;

- large generated assets;

- legacy aliases;

- QWEN/repo artifacts.



---



## 7. Visual UI workflow



В проекте есть визуальный контур через Playwright:



```bat

05_RUN_VISUAL_SCENARIOS.bat hud

05_RUN_VISUAL_SCENARIOS.bat victory

05_RUN_VISUAL_SCENARIOS.bat defeat

05_RUN_VISUAL_SCENARIOS.bat all

04_SYNC_WORK_MIRROR_TO_GOOGLE_DRIVE.bat

```



После синка GPT смотрит:



```text

FourElements_WORK_MIRROR/visual_screenshots/latest/

├─ hud.png

├─ victory.png

└─ defeat.png

```



Использовать для HUD, меню, result overlay, toast и визуальной читаемости. Не использовать как замену ручной проверке для pathfinding, attack-move, bot AI и поведения юнитов.



---



## 8. Codex Gate



Codex может работать только если GPT дал один из маркеров:



```text

CODEX_APPROVED_FOR_PATCH

CODEX_APPROVED_FOR_AUDIT

CODEX_APPROVED_FOR_ROLLBACK

```



Сейчас Codex нужно экономить.



GPT делает сам через `patch.py`, если задача:



- docs/config;

- локальная UI-state правка;

- маленький anchored patch;

- не трогает combat/movement/pathfinding/bot AI;

- проверяется через `node --check` + ручной smoke test.



Codex разрешён для:



- `PATCH-08A-BOT-BEHAVIOR-MVP` audit/patch;

- экономики врага;

- производства врага;

- нелокального combat/movement/pathfinding refactor;

- rollback/recovery.



---



## 9. Запрещено



Запрещено без явного отдельного решения:



- `git checkout/reset/pull/push`;

- патчить Google Drive mirror напрямую;

- использовать старый v03 как основной проект;

- править assets массово;

- патчить `src/main.js` для документационной задачи;

- использовать старый `PATCH-LT-04C-3`;

- копировать код из `src/main_broken_04c3.js` или `src/main_broken_04c5.js`;

- использовать QWEN/GitHub папки как source of truth.



---



## 10. Current checkpoint: phase-bot playable skirmish MVP

Актуальный gameplay checkpoint:

```text
PATCH-08B3-RIGHT-CLICK-CANCEL-CLEARS-ATTACK
```

Ручная проверка пройдена:

- старт новой игры работает;
- player start: `2 harvester`, `1 builder`, `1 light_tank`;
- enemy start: `2 purple harvester`, `1 purple builder`, `1 purple light_tank`, `purple HQ`;
- enemy starter minerals есть рядом с enemy HQ;
- enemy units не раскрывают fog;
- enemy phase bot MVP работает: `defend / prepare_attack / attack / regroup`;
- enemy tank защищает HQ и может атаковать после opening delay;
- player selection и player tank move/attack работают;
- клик по земле после приказа атаки отменяет старую цель;
- ПКМ после приказа атаки тоже отменяет старую цель;
- повторный приказ атаки по enemy HQ снова работает;
- victory overlay работает;
- `Esc` на result screen ведёт в главное меню;
- debug-toast `Enemy HQ spawned` убран.

Текущий enemy bot — MVP phase controller, не полноценная стратегия.

## 11. Текущий боевой/skirmish контур



Ключевые подтверждённые блоки:



- `PATCH-06A` — enemy base setup;

- `PATCH-06B` — attack enemy HQ/buildings MVP;

- `PATCH-06C` — building death/disappear;

- `PATCH-06D` — victory/defeat state;

- `PATCH-06D-F` — visible result overlay;

- `PATCH-07A` — skirmish setup;

- `PATCH-07A1` — enemy units не дают player vision;

- `PATCH-07A3` — enemy visual faction = purple;

- `PATCH-07B` — start composition + enemy minerals + minimal enemy tank threat;

- `PATCH-07B1` — fix skirmish start flow;

- `PATCH-07C` — remove `Enemy HQ spawned` debug toast;

- `PATCH-07C3` — result `Esc` to main menu.



Не использовать:



- старый `PATCH-LT-04C-3`;

- старый `PATCH-LT-04C-5 Enemy Faction Visuals`;

- код из broken-файлов.



---



## 12. Следующие шаги

Сначала соблюдать documentation cadence: после двух принятых успешных патчей делать docs patch.

Текущий docs checkpoint:

```text
PATCH-08D-DOCS-CADENCE-AND-08B3-CHECKPOINT
```

Ближайшие кандидаты:

```text
PATCH-08C-BOT-ROUTE-STABILITY
PATCH-UI-04-PAUSE-MENU-POLISH
PATCH-UI-05-RESULT-BUTTONS-POLISH
PATCH-07C5-PLAYABLE-SKIRMISH-SMOKE-CHECKLIST
```

08C делать только если enemy tank около базы реально выглядит дёрганым. Scope 08C должен быть узким: стабилизировать переотдачу defend/home commands без переписывания bot phases, combat, pathfinding, selection, fog или victory flow.

Enemy economy, harvesting and production move to 09A+ after current playable bot loop is stable.

<!-- FE_PATCH_08A0_ASHEN_CROWN_AI_AUDIT_DOCS_START -->
## Ashen Crown AI audit workflow

Audit document:

```text
docs/project/ashen_crown_ai_audit_for_four_elements.md
```

This audit defines the intended bot-design direction after the playable skirmish checkpoint. It must be used before any Codex bot patch.

Recommended route:

```text
1. Keep 07C4 as stable docs checkpoint.
2. Use Ashen Crown audit as architecture reference, not code-copy source.
3. Give Codex only a read-only 08A audit first.
4. 08A audit has identified safe anchors; implement 08B only with a narrow `src/main.js` scope.
5. Keep 08B limited to phase-based tank behavior: defend → prepare_attack → attack → regroup.
6. Move enemy economy/harvesters/production to 09A+.
```

Codex must not copy Phaser/TypeScript systems directly into this canvas/main.js project. The useful layer is behavior architecture: phases, army score, base defense, regroup, and throttled decision ticks.
<!-- FE_PATCH_08A0_ASHEN_CROWN_AI_AUDIT_DOCS_END -->

<!-- FE_PATCH_09B0_ECONOMY_ROADMAP_DOCS_START -->
## PATCH-09B0 — Economy roadmap checkpoint

Current economy direction is now fixed before any enemy production patch.

### Important rejected route

The earlier generated file below must not be used:

```text
PATCH-09B-ENEMY-PRODUCTION-MVP.py
```

Reason: it attempted hidden HQ-based / direct enemy tank production. That is technically convenient but product-wrong for this RTS loop. Tanks must be produced through a production building, not spawned magically from HQ.

### Target economy model

```text
raw minerals -> separator -> energy + faction element
energy -> buildings
faction elements -> units through units_factory
```

### Separator formula

```text
15 raw minerals -> 10 energy + 1 faction element
```

### Building energy costs — test baseline

```text
separator        = 30 energy
power_plant      = 35 energy
energy_reactor   = 45 energy
minerals_storage = 35 energy
energy_storage   = 45 energy
elements_storage = 50 energy
units_factory    = 55 energy
```

Other buildings are not balanced in this checkpoint and should remain disabled/deferred unless a later patch explicitly enables them.

### Unit costs — unchanged

```text
builder     = 1 faction element, 20 sec
harvester   = 1 faction element, 25 sec
light_tank  = 2 faction elements, 35 sec
heavy_tank  = 4 faction elements, 60 sec
bomber      = 6 faction elements, 55 sec
```

### Starting resources

Keep current starting energy/minerals unchanged for the first economy baseline test. Current observed start energy around `160` is allowed for now.

Reason: the early game must stay testable, and unit production is still gated by faction elements from separators. If the opening becomes too fast, adjust starting resources later before inflating building costs.

### Enemy build order target

Enemy should not produce combat units until it has the required production chain.

Future enemy route:

```text
enemy harvesters gather raw minerals
-> enemy builds/has separator
-> enemy converts raw minerals to energy + faction elements
-> enemy builds/has units_factory
-> enemy units_factory produces light_tank using faction elements
-> enemy bot controls produced tanks
```

### Next patch sequence

```text
PATCH-09B1-ECONOMY-BASELINE-AUDIT
PATCH-09B2-ECONOMY-BASELINE-FIX
PATCH-09C-ENEMY-BUILD-ORDER-MVP-AUDIT
PATCH-09D-ENEMY-FACTORY-PRODUCTION-MVP
```

Scope rule:
- do not implement enemy tank production before economy baseline is fixed;
- do not spawn enemy tanks directly from HQ;
- do not bypass units_factory for combat unit production.
<!-- FE_PATCH_09B0_ECONOMY_ROADMAP_DOCS_END -->

<!-- FE_PATCH_09B5_DOCS_ECONOMY_CHECKPOINT_START -->
## PATCH-09B5 — Economy checkpoint after 09B2/09B4

Current accepted gameplay/economy checkpoint:

```text
PATCH-09B4-DISABLE-TEST-BUILDING-COST-DIVIDER
```

### Accepted economy chain

```text
PATCH-09B0-ECONOMY-ROADMAP-DOCS
PATCH-09B1-ECONOMY-BASELINE-AUDIT
PATCH-09B2-ECONOMY-BASELINE-FIX-V2
PATCH-09B3-BUILD-MENU-PRICE-DISPLAY-FIX
PATCH-09B4-DISABLE-TEST-BUILDING-COST-DIVIDER
PATCH-09B5-DOCS-ECONOMY-CHECKPOINT
```

### Current status

- `PATCH-09B2` successfully aligned real economy values:
  - building costs were lowered to the approved baseline;
  - separator formula changed to `15 raw minerals -> 10 energy + 1 faction element`.
- `PATCH-09B3` was only a partial/insufficient attempt:
  - it tried to fix displayed prices;
  - it did not fully solve the old runtime test divider.
- `PATCH-09B4` is the accepted fix:
  - old `applyTestBuildingCostsX10()` runtime divider is disabled;
  - build menu now shows real prices;
  - real costs are no longer divided by 10 at runtime.

### Current building energy costs

```text
separator        = 30 energy
power_plant      = 35 energy
energy_reactor   = 45 energy
minerals_storage = 35 energy
energy_storage   = 45 energy
elements_storage = 50 energy
units_factory    = 55 energy
```

### Current separator formula

```text
15 raw minerals -> 10 energy + 1 faction element
```

### Unit costs remain unchanged

```text
builder     = 1 faction element, 20 sec
harvester   = 1 faction element, 25 sec
light_tank  = 2 faction elements, 35 sec
heavy_tank  = 4 faction elements, 60 sec
bomber      = 6 faction elements, 55 sec
```

### Important rule still active

Do not use the rejected file:

```text
PATCH-09B-ENEMY-PRODUCTION-MVP.py
```

Combat units must not spawn directly from HQ. Enemy combat production must go through `units_factory`.

### Next planned route

```text
PATCH-09C-ENEMY-BUILD-ORDER-MVP-AUDIT
PATCH-09D-ENEMY-FACTORY-PRODUCTION-MVP
```

The next enemy route must respect the economy chain:

```text
enemy harvesters gather raw minerals
-> enemy separator converts raw minerals to energy + faction elements
-> enemy gets/builds units_factory
-> enemy units_factory produces light_tank using faction elements
-> enemy bot controls produced tanks
```

### Documentation cadence counter

Docs were updated after two accepted successful patches since the previous docs checkpoint:

```text
1. PATCH-09B2-ECONOMY-BASELINE-FIX-V2
2. PATCH-09B4-DISABLE-TEST-BUILDING-COST-DIVIDER
```

The counter is reset after `PATCH-09B5`.
<!-- FE_PATCH_09B5_DOCS_ECONOMY_CHECKPOINT_END -->

<!-- FE_PATCH_09C0_NO_ARTIFICIAL_GAMEPLAY_SHORTCUTS_START -->
## PATCH-09C0 — No artificial gameplay shortcuts / no patches for patch's sake

Hard rule for all future gameplay patches:

```text
Do not create patches just to move a task forward.
Every gameplay patch must preserve the intended RTS logic chain.
```

### What is forbidden

Do not add temporary gameplay shortcuts if they contradict the product logic and will obviously need to be replaced later.

Forbidden examples:

```text
enemy tank appears directly from HQ
enemy separator appears from air near HQ
enemy factory appears from air near HQ
enemy resources are granted without a gameplay source
enemy units are produced without units_factory when the design requires units_factory
```

The only exception is the initial/base map setup where starting HQ/start units/resources are part of the scenario definition.

### Product logic has priority over technical convenience

If the target mechanic is:

```text
builder builds separator
separator converts raw minerals
factory produces units
bot uses produced units
```

then the implementation must follow that chain instead of creating artificial MVP shortcuts.

A smaller patch is acceptable only if it is still logically connected.

Good small slices:

```text
enemy builder exists as a starter worker
enemy builder receives a build-separator task
enemy builder moves to a valid place
enemy builder constructs separator
enemy separator processes enemy resources
enemy factory production starts only after factory exists
```

Bad small slices:

```text
spawn completed separator because it is easier
spawn light_tank directly from HQ because production is not ready
grant enemy energy/elements without a visible economy source
```

### Dev/debug tools are allowed, but must be explicit

Debug and observability tools are allowed if they do not change gameplay rules.

Allowed examples:

```text
debug enemy economy panel
debug hotkey to show enemy resources
console/state overlay for enemy minerals/energy/elements/production queue
read-only telemetry: gathered, processed, spent, blocked by caps
```

Rules for debug tools:
- must be clearly marked as dev-only;
- must not grant resources;
- must not spawn buildings/units;
- must not bypass build order;
- must not change player/enemy balance;
- must not be used as a replacement for the real mechanic.

### Current rejected route

The following generated patch must not be applied:

```text
PATCH-09C1-ENEMY-STARTER-SEPARATOR-MVP.py
```

Reason:
- it would create a completed enemy separator from air near enemy HQ;
- this repeats the same product mistake as rejected direct/HQ tank production;
- the next implementation must route through enemy builder/build command logic instead.

### Correct next route

Next route must be:

```text
PATCH-09C1-ENEMY-BUILDER-BUILD-SEPARATOR-AUDIT
PATCH-09C2-ENEMY-BUILDER-BUILD-SEPARATOR-MVP
PATCH-09C3-ENEMY-SEPARATOR-PROCESSING-MVP
PATCH-09D-ENEMY-BUILDER-BUILD-FACTORY-MVP
PATCH-09E-ENEMY-FACTORY-PRODUCTION-MVP
```

Recommended optional support route:

```text
PATCH-09C-DEBUG-ENEMY-ECONOMY-PANEL-AUDIT
PATCH-09C-DEBUG-ENEMY-ECONOMY-PANEL-MVP
```

This debug panel is acceptable because it observes enemy economy; it must not create or change economy.
<!-- FE_PATCH_09C0_NO_ARTIFICIAL_GAMEPLAY_SHORTCUTS_END -->

<!-- FE_PATCH_09C2A_BUILDER_SEPARATOR_AUDIT_CHECKPOINT_START -->
## PATCH-09C2A — Builder-separator audit checkpoint + Codex model rule

This is a docs-only checkpoint after comparing the 5.4 mini audit and the stronger 5.4 audit for the enemy-builder separator route.

### Current accepted context

Accepted gameplay/economy state:

```text
PATCH-09B4-DISABLE-TEST-BUILDING-COST-DIVIDER
PATCH-09B5-DOCS-ECONOMY-CHECKPOINT
PATCH-09C0-DOCS-NO-ARTIFICIAL-GAMEPLAY-SHORTCUTS
PATCH-09C1-DEBUG-ENEMY-ECONOMY-PANEL-MVP-V2
```

Runtime-observed state:
- enemy economy debug panel works on `F2`;
- enemy harvesters unload raw minerals;
- enemy raw minerals grow in the debug panel;
- enemy currently has:
  - enemy HQ;
  - 2 harvesters;
  - 1 builder;
  - 1 light tank.

### Codex model-selection rule

Use Codex models based on task risk:

```text
5.4 mini:
- simple read-only audits;
- file/anchor search;
- docs-only checks;
- low-risk summaries;
- never use as the only basis for architecture-heavy gameplay decisions.

5.4:
- read-only audits before gameplay code patches;
- owner-aware economy logic;
- builder/factory/production logic;
- medium-risk code planning;
- checking or challenging 5.4 mini output.

5.5:
- high-risk multi-system work;
- pathfinding/combat/save-load;
- major AI/build-order architecture;
- cases where 5.4 and GPT disagree or the risk is unclear.
```

Default rule:
- if the task can break economy, ownership, pathing, combat, save/load, or build order, use at least `5.4`;
- if the task is only navigation/search/docs, `5.4 mini` is allowed.

### 09C2 audit decision

For `PATCH-09C2-ENEMY-BUILDER-BUILD-SEPARATOR-MVP`, trust the 5.4 audit over the 5.4 mini audit.

Reason:
- 5.4 highlighted key owner/resource risks more clearly;
- 5.4 noted that current builder construction path defaults buildings to player ownership unless owner is passed explicitly;
- 5.4 noted that build cost/refund logic is still player-resource based;
- 5.4 noted that build speed currently risks using `game.faction` instead of the builder owner's faction;
- 5.4 confirmed that separator processing should stay out of 09C2.

### Correct 09C2 route

Next gameplay patch should be:

```text
PATCH-09C2-ENEMY-BUILDER-BUILD-SEPARATOR-MVP
```

Required product logic:

```text
enemy starts with a small hidden scenario energy reserve
-> enemy builder receives build-separator task
-> valid site is found near enemy HQ
-> enemy builder moves to site
-> incomplete enemy-owned separator is created
-> enemy builder completes construction
```

### 09C2 hard requirements

The future 09C2 code patch must:

```text
1. Add/ensure hidden enemy energy only as scenario setup.
2. Use 30 hidden enemy energy for the first separator build.
3. Deduct separator cost from enemyResources.energy.
4. Use the existing enemy builder, not spawn a completed separator.
5. Create separator with owner='enemy'.
6. Avoid player-facing toasts for enemy construction.
7. Avoid player build menu changes.
8. Avoid fog/combat/pathfinding refactors.
9. Avoid save/load changes in this MVP.
10. Defer enemy separator processing to PATCH-09C3.
```

### What 09C2 must not do

Forbidden in 09C2:

```text
spawn completed separator from air
spawn tanks from HQ
build separator for free
grant resources during gameplay without an explicit scenario rule
touch enemy factory production
touch combat
touch fog/reveal
touch save/load
rewrite pathfinding
show enemy toasts to the player
```

### Planned sequence after this checkpoint

```text
PATCH-09C2-ENEMY-BUILDER-BUILD-SEPARATOR-MVP
PATCH-09C3-ENEMY-SEPARATOR-PROCESSING-MVP
PATCH-09D-ENEMY-BUILDER-BUILD-FACTORY-MVP
PATCH-09E-ENEMY-FACTORY-PRODUCTION-MVP
```

### Known metadata cleanup item

`_gpt_state/LAST_SYNC.txt` may still mention the old fallback/source path:

```text
four_elements_core_base_v03
```

Current source of truth remains:

```text
C:\Users\Den\Desktop\four elements\four_elements_core_base
```

Do not treat `four_elements_core_base_v03` as active project source.
A later state/sync cleanup patch should fix the generated metadata or the script that writes `LAST_SYNC.txt`.
<!-- FE_PATCH_09C2A_BUILDER_SEPARATOR_AUDIT_CHECKPOINT_END -->


<!-- FE_PATCH_09C4_ENEMY_SEPARATOR_CHECKPOINT_START -->
## PATCH-09C4-DOCS-ENEMY-SEPARATOR-CHECKPOINT

Accepted checkpoint after two successful gameplay patches:

```text
1. PATCH-09C2-ENEMY-BUILDER-BUILD-SEPARATOR-MVP
2. PATCH-09C3-ENEMY-SEPARATOR-PROCESSING-MVP
```

### Accepted current enemy economy chain

```text
enemy harvesters -> hidden enemy raw minerals
enemy builder -> enemy-owned separator
enemy separator -> 15 raw minerals -> 10 energy + 1 purple element
```

Manual confirmation:
- enemy builder successfully builds `separator`;
- completed enemy separator processes hidden enemy resources;
- F2 enemy economy debug panel shows real separator state;
- no player-facing toast is emitted by enemy construction/processing;
- sync to `FourElements_WORK_MIRROR` was run after acceptance.

### Scope boundary

`09C2/09C3` are still MVP economy steps. They do not implement:
- enemy `units_factory`;
- enemy combat unit production;
- full enemy power grid;
- save/load serialization for deeper enemy build-order state;
- large pathfinding or construction refactor.

### Next gameplay route

Next product-correct route:

```text
PATCH-09D-ENEMY-FACTORY-BUILD-MVP
PATCH-09E-ENEMY-FACTORY-LIGHT-TANK-PRODUCTION-MVP
PATCH-10A-ENEMY-VISION-MEMORY-AUDIT
```

### Enemy start energy decision

Do not use starting resources as a difficulty model.

Enemy may later receive the same baseline starting energy as the player:

```text
enemy hidden starting energy = 160
```

But only as shared skirmish baseline/parity for testing the build order, not as difficulty scaling.

Implementation rule:
- do not make `easy/normal/hard` differ by starting energy;
- do not treat `160 energy` as the next automatic difficulty patch;
- if implemented later, keep it as hidden enemy baseline resource and document it as scenario parity;
- future difficulty must be behavior-based: scouting, memory, prediction, economy discipline, production discipline, attack/retreat logic.
<!-- FE_PATCH_09C4_ENEMY_SEPARATOR_CHECKPOINT_END -->

<!-- FE_PATCH_09C5_BOT_DIFFICULTY_VISION_POLICY_START -->
## PATCH-09C5 — Bot difficulty + vision policy

This docs-only checkpoint locks the AI design rule before the next enemy factory/production work.

### Difficulty policy

Bot difficulty must change behavior quality, not starting resources or hidden cheats.

Forbidden as difficulty design:

```text
easy   = fewer starting resources
normal = baseline starting resources
hard   = more starting resources
```

Accepted difficulty model:

```text
easy   = simple, readable, mostly linear behavior
normal = basic RTS awareness and limited adaptation
hard   = strong economy + production + defense + attack management
```

Starting resources may still be used as a shared skirmish baseline if both sides need a playable opening, but that is not a difficulty knob. If enemy gets `160` starting energy, it must be documented as baseline scenario parity/testing, not as hard-mode advantage.

### Easy bot

Easy bot should be intentionally readable:
- follows a mostly linear build order;
- reacts slowly;
- scouts rarely or poorly;
- attacks in predictable windows;
- can idle or make inefficient choices;
- does not manage storage caps well;
- does not multitask economy and combat effectively.

### Normal bot

Normal bot should understand the basic RTS loop:
- remembers last seen enemy positions for a limited time;
- scouts before some attacks;
- estimates rough army strength;
- defends HQ when threatened;
- builds storage when already close to caps;
- maintains simple production when resources allow;
- can choose between attack, defend, and wait.

### Hard bot

Hard bot should play the systems well without cheating:
- uses vision, memory, scouting, and prediction;
- builds storage before hitting caps;
- keeps economy and production active;
- manages build order and military actions in parallel;
- evaluates whether it is stronger before attacking;
- retreats/regroups when the estimate turns bad;
- prioritizes targets such as army, economy, production, and HQ;
- still does not see through fog and does not get hidden bonus resources as difficulty scaling.

### Vision / knowledge policy

Bot gameplay logic must not use omniscient full-map knowledge as final design.

Correct model:

```text
enemy vision -> enemy memory -> enemy assumptions -> scouting -> strength estimate -> decision
```

Required future knowledge concepts:
- `visibleNow`: what enemy units/buildings can currently see;
- `lastSeenPosition`: where a player object was last seen;
- `lastSeenTime`: how stale that information is;
- `confidence`: how reliable the memory still is;
- `scoutingTargets`: places the bot should check;
- `threatEstimate`: likely danger near enemy base or army;
- `armyEstimate`: known/probable player combat strength;
- `economyEstimate`: inferred player economy from observed harvesters/factory/storage.

Allowed:
- debug overlays may inspect full state for the developer;
- visual/debug panels may show enemy knowledge internals;
- temporary MVP code may be audited while transitioning away from omniscience.

Forbidden for final bot behavior:
- selecting attack targets that were never seen or inferred;
- knowing player army count through fog;
- knowing player resources through fog;
- reacting perfectly to hidden player movement;
- using full game state as combat intelligence outside explicit debug/test code.

### Updated route

Do not treat `PATCH-09C5-ENEMY-START-ENERGY-160` as the next difficulty step.

Next gameplay route should stay product-correct:

```text
PATCH-09D-ENEMY-FACTORY-BUILD-MVP
PATCH-09E-ENEMY-FACTORY-LIGHT-TANK-PRODUCTION-MVP
PATCH-10A-ENEMY-VISION-MEMORY-AUDIT
PATCH-10B-ENEMY-NO-OMNISCIENCE-MVP
PATCH-10C-ENEMY-SCOUTING-MVP
PATCH-10D-ENEMY-STRENGTH-ESTIMATION-BEFORE-ATTACK
```

Implementation note:
- if `160` enemy start energy is added later, name it as baseline/parity, not difficulty;
- difficulty configs should expose behavior knobs: reaction interval, scouting frequency, memory duration, confidence decay, attack threshold, storage planning, production discipline, retreat/regroup logic.
<!-- FE_PATCH_09C5_BOT_DIFFICULTY_VISION_POLICY_END -->

<!-- FE_PATCH_09E2_ENEMY_FACTORY_PRODUCTION_CHECKPOINT_START -->
## PATCH-09E2 — Enemy factory production checkpoint

Accepted checkpoint after the enemy economy/build-order chain reached combat-unit production.

### Accepted patches since the previous docs checkpoint

```text
1. PATCH-09D-ENEMY-FACTORY-BUILD-MVP
2. PATCH-09E-ENEMY-FACTORY-LIGHT-TANK-PRODUCTION-MVP
3. PATCH-09E1-ENEMY-BOT-SILENT-MOVE-TOAST-FIX
```

### Accepted current enemy production chain

```text
enemy harvesters -> hidden enemy raw minerals
enemy builder -> enemy-owned separator
enemy separator -> 15 raw minerals -> 10 energy + 1 purple element
enemy builder -> enemy-owned units_factory
enemy units_factory -> enemy light_tank for 2 purple elements / 35 sec
enemy phase bot -> controls produced tanks
```

Manual confirmation:
- enemy builder successfully builds `units_factory` after separator economy is running;
- enemy-owned completed `units_factory` produces enemy `light_tank`;
- production spends `2 purple element` and uses the configured `35 sec` light-tank production time;
- produced tanks are enemy-owned/purple and receive bot orders;
- player-facing movement toasts from enemy bot commands are suppressed by `09E1`;
- sync to `FourElements_WORK_MIRROR` was run after acceptance.

### Scope boundary

`09D/09E/09E1` are still MVP build-order/production steps. They do not implement:
- fair full start-cost accounting for enemy starting HQ/units;
- enemy save/load serialization for deep production queues;
- no-omniscience AI;
- scouting;
- enemy memory model;
- strength estimation before attack;
- difficulty behavior profiles;
- storage-cap planning;
- multi-factory production strategy;
- combat/pathfinding/fog refactors.

### Current product state

The enemy no longer depends only on a pre-spawned test threat. It can now bootstrap a minimal production chain:

```text
starting enemy workers + HQ
-> gathered raw minerals
-> separator
-> energy + purple elements
-> units_factory
-> produced light_tank
```

This is still not a full RTS AI. It is a working production loop that future AI can use.

### Next route

Next work should not add resource cheats or more direct spawns. The next major AI route is information quality and decision-making:

```text
PATCH-10A-ENEMY-VISION-MEMORY-AUDIT
PATCH-10B-ENEMY-NO-OMNISCIENCE-MVP
PATCH-10C-ENEMY-SCOUTING-MVP
PATCH-10D-ENEMY-STRENGTH-ESTIMATION-BEFORE-ATTACK
```

Optional small cleanup before 10A is allowed only if it is clearly local and does not alter the product direction:

```text
PATCH-09E3-ENEMY-PRODUCTION-SMOKE-CHECKLIST
PATCH-09E4-ENEMY-ECONOMY-PANEL-POLISH
```

### AI policy reminders

The policy from `PATCH-09C5-DOCS-BOT-DIFFICULTY-VISION-POLICY` remains active:
- difficulty must change behavior quality, not starting resources;
- bot must not be omniscient in final gameplay logic;
- debug tools may inspect full state, but combat decisions should move toward enemy vision + memory + scouting + estimates;
- produced units may be controlled by the current phase bot for MVP, but future attack decisions must stop using perfect map knowledge.
<!-- FE_PATCH_09E2_ENEMY_FACTORY_PRODUCTION_CHECKPOINT_END -->



<!-- PATCH-MAP-02-DOCS-LITE-MAP-EDITOR-BACKLOG_START -->
## PATCH-MAP-02-DOCS-LITE-MAP-EDITOR-BACKLOG — Lite map editor backlog + map/bot checkpoint

This is a docs-only checkpoint after the accepted gameplay/dev patches:

```text
1. PATCH-10B-ENEMY-VISION-MEMORY-SHELL
2. PATCH-MAP-01-DIAGONAL-BASE-SPAWNS
```

### Accepted current state

Current skirmish chain remains accepted:

```text
enemy harvesters -> raw minerals
enemy builder -> separator
enemy separator -> energy + purple element
enemy builder -> units_factory
enemy units_factory -> light_tank
enemy bot -> controls produced tanks
```

Additional accepted state:

```text
PATCH-10B-ENEMY-VISION-MEMORY-SHELL
```

adds the runtime-only enemy vision/memory shell and F2 telemetry. It does not yet change bot decisions.

```text
PATCH-MAP-01-DIAGONAL-BASE-SPAWNS
```

moves player/enemy starting bases to diagonal opposite corners for new games.

### Deferred lite map editor backlog

Do not build a full Heroes-style map editor now. Keep it as a later dev/editor feature.

Accepted future backlog:

```text
PATCH-EDITOR-01-LITE-MAP-EDITOR-ROADMAP-DOCS
PATCH-EDITOR-02-DECOR-PRESET-LOADER
PATCH-EDITOR-03-TILE-COORDINATE-DEBUG
PATCH-EDITOR-04-DECOR-EDITOR-PLACE-REMOVE-MVP
PATCH-EDITOR-05-DECOR-EDITOR-EXPORT-IMPORT-JSON
PATCH-EDITOR-06-STANDARD-LARGE-MAP-PRESETS
PATCH-EDITOR-07-MAP-VALIDATION-BASE-PATHS
```

Target editor scope:
- in-game dev mode, not a separate full product;
- place/remove/move decoration and obstacle objects;
- export/import JSON preset;
- preserve automatic resource generation;
- preserve fixed diagonal starting positions unless a later map preset explicitly overrides them;
- validate that bases, early resources, harvesters, builders and attack routes are not blocked.

Out of scope for the first editor branch:
- terrain painting;
- resource hand-placement;
- full unit placement;
- campaign scripting;
- save/load UI for user maps;
- advanced object rotation/variant tooling beyond simple variant switching.

### Immediate pre-bot polish queue

Before continuing deeper bot behavior patches, the next small local patch candidates are:

```text
PATCH-MAP-03-ENVIRONMENT-DISTRIBUTION-BANDS
PATCH-MAP-04-ENVIRONMENT-COLLISION-BLOCKERS
PATCH-VIS-01-TANK-SELECTION-RING-POLISH
```

Purpose:
- make environment generation less chaotic;
- move large mountains/large rocks toward map edges;
- form medium mountain/rock chains near edges;
- keep smaller volcano/rock accents closer to the center/transition area;
- mark rocks/mountains/volcanoes as blocking while keeping grass/bush/sand bumps passable;
- replace the current pink debug-like tank selection fill with a smaller, softer RTS selection ring/glow under the unit.

### Bot route after map/visual polish

After the short map/visual polish queue, return to:

```text
PATCH-10C-ENEMY-NO-OMNISCIENCE-DEFEND-THREAT-FIRST
PATCH-10D-ENEMY-KNOWN-TARGET-ATTACK-FALLBACK
PATCH-10E-ENEMY-SCOUTING-MVP
PATCH-10F-EASY-BOT-LINEAR-BEHAVIOR-PROFILE
PATCH-10G-PLAYABLE-EASY-BOT-SMOKE-BALANCE
PATCH-10H-DOCS-EASY-BOT-PLAYABLE-CHECKPOINT
```

Important:
- difficulty must remain behavior-based, not resource-based;
- enemy bot should not become omniscient;
- 10C should switch only the defend/threat reaction first, not the entire attack system.
<!-- PATCH-MAP-02-DOCS-LITE-MAP-EDITOR-BACKLOG_END -->

<!-- FE_PATCH_MAP05_MAP_COLLISION_AND_MULTIBOT_BACKLOG_START -->
## PATCH-MAP-05-DOCS-MAP-COLLISION-AND-MULTIBOT-BACKLOG

Docs-only checkpoint after accepted map/environment patches:

```text
1. PATCH-MAP-03-ENVIRONMENT-DISTRIBUTION-BANDS
2. PATCH-MAP-04-ENVIRONMENT-COLLISION-BLOCKERS
```

### Accepted map/environment state

`PATCH-MAP-03` changed environment distribution:
- large mountains / major rocks are biased toward map edges;
- medium mountains form more edge-side chains;
- small volcanos / small rocks are biased closer to the center;
- large center landmarks are rare;
- bases and resources are not moved by this patch.

`PATCH-MAP-04` changed environment collision behavior:
- blocking: `mountain_*`, `volcano_*`, `rock_cluster_small_01`;
- passable visual decor: `dry_bush_01`, `sand_bump_01`;
- pathfinding algorithm itself was not refactored;
- player confirmed the tank avoids blocked stones/obstacles and can still move normally.

### Deferred lite map editor backlog

A lite in-game map editor is accepted as a later direction, but it is not part of the current bot completion pass.

Backlog sequence:

```text
PATCH-EDITOR-01-LITE-MAP-EDITOR-ROADMAP-DOCS
PATCH-EDITOR-02-DECOR-PRESET-LOADER
PATCH-EDITOR-03-TILE-COORDINATE-DEBUG
PATCH-EDITOR-04-DECOR-EDITOR-PLACE-REMOVE-MVP
PATCH-EDITOR-05-DECOR-EDITOR-EXPORT-IMPORT-JSON
PATCH-EDITOR-06-STANDARD-LARGE-MAP-PRESETS
PATCH-EDITOR-07-MAP-VALIDATION-BASE-PATHS
```

Scope for the lite editor:
- edit decor/obstacles only;
- place / remove / switch object type;
- export/import JSON presets;
- do not edit resources in the first editor pass;
- do not edit base spawn points in the first editor pass;
- keep automatic resource generation separate.

### Deferred multi-bot / 4P FFA backlog

Multi-bot free-for-all is accepted as a later major direction after the playable 1v1 easy bot is complete.

Do not copy-paste the current purple enemy bot into two more enemies without refactoring. The current code is still heavily shaped around `player` vs `enemy`; multi-bot needs owner-indexed state/resources/knowledge.

Recommended normal route:

```text
PATCH-MULTI-01-BOT-CONTROLLER-BY-OWNER-AUDIT
PATCH-MULTI-02-RESOURCES-BY-OWNER
PATCH-MULTI-03-BOT-STATE-BY-OWNER
PATCH-MULTI-04-BOT-KNOWLEDGE-BY-OWNER
PATCH-MULTI-05-FOUR-CORNER-SPAWN-POINTS
PATCH-MULTI-06-SECOND-BOT-SPAWN-MVP
PATCH-MULTI-07-THIRD-BOT-SPAWN-MVP
PATCH-MULTI-08-FFA-TARGET-SELECTION
PATCH-MULTI-09-FFA-VICTORY-DEFEAT
PATCH-MULTI-10-MULTI-BOT-DEBUG-PANEL
PATCH-MULTI-11-4P-SMOKE-BALANCE
PATCH-MULTI-12-DOCS-4P-FFA-CHECKPOINT
PATCH-MULTI-13-FACTION-PERSONALITY-KNOBS
PATCH-MULTI-14-4P-PERFORMANCE-STRESS-CHECK
PATCH-MULTI-15-4P-FFA-BALANCE-PASS
```

Codex routing for multi-bot:
- start with `PATCH-MULTI-01-BOT-CONTROLLER-BY-OWNER-AUDIT` as Codex/read-only audit;
- do not start with a direct patch;
- only patch after ownership/resource/state/knowledge risks are mapped.

### Current active route before returning to bot

Finish the short visual/map cleanup before resuming enemy AI behavior:

```text
PATCH-VIS-01-TANK-SELECTION-RING-POLISH
```

After that, return to playable easy bot route:

```text
PATCH-10C-ENEMY-NO-OMNISCIENCE-DEFEND-THREAT-FIRST
PATCH-10D-ENEMY-KNOWN-TARGET-ATTACK-FALLBACK
PATCH-10E-ENEMY-SCOUTING-MVP
PATCH-10F-EASY-BOT-LINEAR-BEHAVIOR-PROFILE
PATCH-10G-PLAYABLE-EASY-BOT-SMOKE-BALANCE
PATCH-10H-DOCS-EASY-BOT-PLAYABLE-CHECKPOINT
```

Documentation cadence counter is reset by this docs checkpoint.
<!-- FE_PATCH_MAP05_MAP_COLLISION_AND_MULTIBOT_BACKLOG_END -->

<!-- FE_PATCH_VIS_05_DOCS_SELECTION_RING_CHECKPOINT_START -->
## PATCH-VIS-05 — Selection ring checkpoint after VIS-01..VIS-04C

Date: 2026-05-09  
Type: docs-sync checkpoint  
Status: accepted docs checkpoint after visual selection ring tuning.

### Accepted visual chain

```text
PATCH-VIS-01-TANK-SELECTION-RING-POLISH
PATCH-VIS-02-SELECTION-RING-UNIT-GROUND-OFFSETS
PATCH-VIS-03-SELECTION-RING-BRIGHTNESS-AND-ALIGNMENT
PATCH-VIS-04B-ROBUST-FACTION-RING-COLOR-BUILDER-FIX
PATCH-VIS-04C-BUILDER-RING-MICRO-ALIGN  // manual doc patch
```

### Manual VIS-04C change

`PATCH-VIS-04C` was applied manually, not through generated `patch.py`.

Changed in `src/main.js`:

```js
builder: { x: 0, y: -16, rx: 0.92, ry: 0.88 }
```

became:

```js
builder: { x: 0, y: -12, rx: 0.92, ry: 0.88 }
```

Reason: after VIS-04B the builder selection ring still sat slightly too high compared to harvester and light_tank.

### Current accepted selection ring state

```text
light_tank: y -30, rx 0.98, ry 0.92
harvester:  y -28, rx 1.00, ry 0.94
builder:    y -12, rx 0.92, ry 0.88
```

Accepted visual behavior:

- ring/glow color matches faction;
- green faction uses green glow/ring, not universal cyan;
- under-unit glow is strong enough;
- ring size is not inflated;
- harvester and light_tank positions are acceptable;
- builder position is manually corrected and accepted unless a new screenshot shows regression.

### Decision

Stop polishing the selection ring unless there is an obvious regression.  
Do not spend Codex or large patch effort on further pixel-level ring tuning.

### Documentation cadence

This docs checkpoint records the accepted manual visual change and resets the docs cadence counter.

### Next recommended gameplay route

Return to enemy AI/gameplay progress:

```text
PATCH-10C-ENEMY-SCOUTING-MVP
PATCH-10D-ENEMY-STRENGTH-ESTIMATION-BEFORE-ATTACK
```

Before a risky AI patch, use the fresh mirror/context and prefer local GPT patch only if the change is small and well-anchored.
<!-- FE_PATCH_VIS_05_DOCS_SELECTION_RING_CHECKPOINT_END -->

<!-- FE_PATCH_10C2_DOCS_MERGED_GLM_BOT_ROADMAP_START -->
## PATCH-10C2 — Merged GLM bot roadmap

`PATCH-10C2-DOCS-MERGED-GLM-BOT-ROADMAP` creates the canonical merged enemy-bot roadmap:

```text
docs/project/four_elements_bot_roadmap_merged_glm.md
```

Decision:

```text
GLM roadmap is reused as a product-behavior layer, not as a full replacement for the current Four Elements roadmap/regламент.
```

Accepted from GLM:
- `UNIT AUTOPILOT` -> next patch `PATCH-10D1-ENEMY-UNIT-AUTOPILOT-GUARD-PATROL`;
- `STRENGTH ESTIMATE` -> `PATCH-10E1-STRENGTH-ESTIMATE-BEFORE-ATTACK`;
- `VISION-DRIVEN DECISIONS` -> `PATCH-10F1-VISION-DRIVEN-TARGET-SELECTION`;
- `SCOUTING` -> upgrade current `PATCH-10C1` via `PATCH-10G1-SCOUTING-KNOWLEDGE-UPGRADE`;
- `RETREAT + DEFENSE` -> `PATCH-10H1-RETREAT-AND-DEFENSE-UPGRADE`;
- `DIFFICULTY PROFILES` -> `PATCH-10I1-EASY-BOT-BEHAVIOR-PROFILE`.

Rejected/modified:
- no hard ban on docs/audit patches;
- no literal "make bot smart first, remove omniscience later";
- no immediate production-manager rewrite;
- no formation/group combat before attack/retreat basics are stable;
- no resource-based difficulty.

Current route:

```text
PATCH-10D1-ENEMY-UNIT-AUTOPILOT-GUARD-PATROL
PATCH-10E1-STRENGTH-ESTIMATE-BEFORE-ATTACK
PATCH-10F1-VISION-DRIVEN-TARGET-SELECTION
PATCH-10G1-SCOUTING-KNOWLEDGE-UPGRADE
PATCH-10H1-RETREAT-AND-DEFENSE-UPGRADE
PATCH-10I1-EASY-BOT-BEHAVIOR-PROFILE
```

`PATCH-10C1-ENEMY-SCOUTING-MVP-LIGHT` remains installed and should be smoke-tested before treating it as fully accepted.
<!-- FE_PATCH_10C2_DOCS_MERGED_GLM_BOT_ROADMAP_END -->

<!-- FE_PATCH_10E2_DOCS_BOT_AUTOPILOT_AND_STRENGTH_CHECKPOINT_START -->
## PATCH-10E2 — Bot autopilot + strength checkpoint

Accepted checkpoint after:

```text
PATCH-10D1-ENEMY-UNIT-AUTOPILOT-GUARD-PATROL
PATCH-10E1-STRENGTH-ESTIMATE-BEFORE-ATTACK
PATCH-10E1B-STRENGTH-GATE-EARLY-HOOK
PATCH-10E1C2-CACHEBUST-AND-CONSOLE-TELEMETRY-HELPER
```

Accepted:
- free enemy tanks now patrol/guard/return around enemy HQ;
- scout tanks from `10C1` are not overridden;
- weak blind attacks are gated by strength estimate;
- with 1 enemy tank and unknown player army, expected telemetry is `requiredStrength: 2`, `attackAllowed: false`;
- correct runtime check is `FE_BOT_TELEMETRY()` or `window.FE_CORE.game.*`;
- do **not** use `game.enemyStrengthEstimateMvp` because global `game` may be `<canvas id="game">`.

Failed but safely restored:
- `PATCH-10E1C-CACHEBUST-AND-STRENGTH-TELEMETRY-PANEL` failed at `node --check`; runner restored files.
- Accepted replacement: `PATCH-10E1C2`, index-only helper/cache-bust patch.

New checkpoint doc:

```text
docs/project/four_elements_bot_checkpoint_10E2.md  (АРХИВИРОВАН — см. docs/archive/old_checkpoints/)
```

Next route:

```text
PATCH-10F1-VISION-DRIVEN-TARGET-SELECTION
PATCH-10G1-SCOUTING-KNOWLEDGE-UPGRADE
PATCH-10H1-RETREAT-AND-DEFENSE-UPGRADE
PATCH-10I1-EASY-BOT-BEHAVIOR-PROFILE
```

Docs cadence reset here.
<!-- FE_PATCH_10E2_DOCS_BOT_AUTOPILOT_AND_STRENGTH_CHECKPOINT_END -->

<!-- FE_PATCH_10E3_DOCS_GLM_PARALLEL_BRANCH_PLAN_START -->
## PATCH-10E3 — GLM parallel branch plan

Reviewed uploaded GLM planning/context files and recorded how to use them safely.

Decision:

```text
GLM_TESTS is a parallel experimental branch.
WORK folder remains canonical stable branch.
GLM output is roadmap/algorithm reference until commit diffs are inspected.
```

Useful GLM references:
- `GLM-04 Vision-Driven Decisions` -> next `PATCH-10F1`;
- `GLM-05 Scouting` -> future `PATCH-10G1`;
- `GLM-06 Retreat + Defense` -> future `PATCH-10H1`.

Already covered in WORK:
- `GLM-01 Unit Autopilot` ~= `PATCH-10D1`;
- `GLM-03 Strength Estimate` ~= `PATCH-10E1/10E1B/10E1C2`.

Deferred:
- `GLM-02 Production Manager` — high risk, audit-only for now;
- `GLM-07 Economy Brain` — later;
- `GLM-08/09 Difficulty/Group Combat` — later.

New reference doc:

```text
docs/project/four_elements_glm_parallel_branch_plan.md
```

Need before code transfer:

```text
GLM-04-VISION-DRIVEN.patch
GLM-05-SCOUTING.patch
GLM-06-RETREAT-DEFENSE.patch
```

Immediate next canonical route remains:

```text
PATCH-10F1-VISION-DRIVEN-TARGET-SELECTION
```
<!-- FE_PATCH_10E3_DOCS_GLM_PARALLEL_BRANCH_PLAN_END -->

<!-- FE_PATCH_10E4_DOCS_CODEX_LIMIT_SPRINT_WINDOW_START -->
## PATCH-10E4 — Temporary Codex limit sprint window

Temporary workflow exception:

```text
2026-05-09 -> 2026-05-10 inclusive
```

During this window, Codex may be used more actively because user limits will refresh/expire and unused capacity would be wasted.

This does **not** remove safety rules.

Allowed during sprint:
- read-only audits;
- multi-file code reviews;
- risky bot logic analysis;
- GLM diff audits;
- bounded code patches if explicitly routed to Codex;
- Playwright/test planning;
- anchor discovery.

Still forbidden:
- blind full `src/main.js` replacement;
- unbounded refactors;
- direct GLM -> WORK merge;
- patches without reports;
- resource cheats;
- hidden omniscient targeting as final behavior.

Every Codex task must produce:

```text
_inbox/session_summary_<date>_codex_<topic>.txt
```

or a patch report with:
- files changed;
- functions added/modified;
- hook points;
- risk;
- node --check;
- smoke test;
- rollback;
- GPT recommendation.

Sprint doc:

```text
docs/project/codex_limit_sprint_20260509_20260510.md  (АРХИВИРОВАН — см. docs/archive/old_codex_refactor/)
```

Suggested priority:
1. `PATCH-10F1` target-selection audit/patch;
2. GLM-04 diff audit;
3. GLM HOTFIX split audit;
4. `PATCH-10G1`;
5. `PATCH-10H1`.

After sprint:
- restore normal Codex-sparing policy;
- optionally create `PATCH-10E5-DOCS-CODEX-SPRINT-CLOSEOUT`.
<!-- FE_PATCH_10E4_DOCS_CODEX_LIMIT_SPRINT_WINDOW_END -->

<!-- FE_PATCH_10H2B_DOCS_BOT_VISION_SCOUTING_RETREAT_CHECKPOINT_START -->
## PATCH-10H2B — Bot vision/scouting/retreat checkpoint

Safer replacement for failed `PATCH-10H2`.

Reason for previous failure:

```text
10H2 expected exact marker PATCH-10G1-SCOUTING-KNOWLEDGE-UPGRADE,
but current 10G1 is present through FE_10G1_* helpers and telemetry fields.
```

Docs checkpoint after Codex sprint bot AI chain:

```text
PATCH-10F1-VISION-DRIVEN-TARGET-SELECTION
PATCH-10G1-SCOUTING-KNOWLEDGE-UPGRADE
PATCH-10H1-RETREAT-AND-DEFENSE-UPGRADE
```

Status:
- patches are applied;
- final acceptance depends on manual smoke results.

Runtime checks:

```js
FE_BOT_TELEMETRY()
window.FE_CORE.game.enemyScoutingMvp
window.FE_CORE.game.enemyAutopilotMvp
window.FE_CORE.game.enemyStrengthEstimateMvp
window.FE_CORE.game.enemyTargetingMvp
window.FE_CORE.game.enemyRetreatMvp
```

New checkpoint doc:

```text
docs/project/four_elements_bot_checkpoint_10H2.md  (АРХИВИРОВАН — см. docs/archive/old_checkpoints/)
```

Next route depends on smoke:
- if OK -> `PATCH-10I1-EASY-BOT-BEHAVIOR-PROFILE`;
- if safety coverage needed -> `PATCH-TEST-01-BOT-AI-SMOKE-PLAYWRIGHT`;
- if GLM reuse needed -> `PATCH-GLM-HOTFIX-SPLIT-AUDIT`;
- if bugs found -> `PATCH-10F1B` / `10G1B` / `10H1B`.

Docs cadence reset here.
<!-- FE_PATCH_10H2B_DOCS_BOT_VISION_SCOUTING_RETREAT_CHECKPOINT_END -->

<!-- FE_PATCH_10I2_DOCS_BOT_DIFFICULTY_AND_CODEX_SPRINT_CHECKPOINT_START -->
## PATCH-10I2 — Bot difficulty + Codex sprint checkpoint

Docs checkpoint after sprint chain:

```text
PATCH-10F1-VISION-DRIVEN-TARGET-SELECTION
PATCH-10G1-SCOUTING-KNOWLEDGE-UPGRADE
PATCH-10H1-RETREAT-AND-DEFENSE-UPGRADE
PATCH-TEST-01C-FIX-BOT-AI-SMOKE-RUNTIME-GAME-WAIT
PATCH-10I1-EASY-BOT-BEHAVIOR-PROFILE
```

Current runtime checks:

```js
FE_BOT_TELEMETRY()
window.FE_CORE.game.enemyScoutingMvp
window.FE_CORE.game.enemyAutopilotMvp
window.FE_CORE.game.enemyStrengthEstimateMvp
window.FE_CORE.game.enemyTargetingMvp
window.FE_CORE.game.enemyRetreatMvp
window.FE_CORE.game.enemyDifficultyMvp
```

Playwright smoke command:

```bat
cmd /c npx playwright test "tests/bot-ai-smoke.spec.js"
```

`10I1` adds behavior-based profiles:
- `normal` = baseline;
- `easy` = slower/softer/more conservative;
- no resource cheats;
- `affectsProduction = false`.

New checkpoint doc:

```text
docs/project/four_elements_bot_checkpoint_10I2_codex_sprint.md
```

Next route depends on smoke:
- if clean -> test scenarios or tuning;
- if Easy feels off -> `PATCH-10I1B`;
- if sprint ends -> `PATCH-10E5-DOCS-CODEX-SPRINT-CLOSEOUT`;
- if GLM reuse needed -> `PATCH-GLM-HOTFIX-SPLIT-AUDIT`.
<!-- FE_PATCH_10I2_DOCS_BOT_DIFFICULTY_AND_CODEX_SPRINT_CHECKPOINT_END -->

<!-- FE_PATCH_10E5_DOCS_CODEX_SPRINT_CLOSEOUT_START -->
## PATCH-10E5 — Codex sprint closeout

Closed / checkpointed the 2026-05-09 Codex sprint.

Recorded completed sprint chain:

```text
PATCH-10F1-VISION-DRIVEN-TARGET-SELECTION
PATCH-10G1-SCOUTING-KNOWLEDGE-UPGRADE
PATCH-10H1-RETREAT-AND-DEFENSE-UPGRADE
PATCH-TEST-01C-FIX-BOT-AI-SMOKE-RUNTIME-GAME-WAIT
PATCH-TEST-02-BOT-BEHAVIOR-SCENARIO-SMOKE
PATCH-10I1-EASY-BOT-BEHAVIOR-PROFILE
PATCH-10I2-DOCS-BOT-DIFFICULTY-AND-CODEX-SPRINT-CHECKPOINT
```

Current stage:

```text
Bot AI MVP Layering -> Bot AI Stabilization
```

Current runtime checks:

```js
FE_BOT_TELEMETRY()
window.FE_CORE.game.enemyScoutingMvp
window.FE_CORE.game.enemyAutopilotMvp
window.FE_CORE.game.enemyStrengthEstimateMvp
window.FE_CORE.game.enemyTargetingMvp
window.FE_CORE.game.enemyRetreatMvp
window.FE_CORE.game.enemyDifficultyMvp
```

Current bot tests:

```bat
cmd /c npx playwright test "tests/bot-ai-smoke.spec.js"
cmd /c npx playwright test "tests/bot-ai-behavior-scenario.spec.js"
cmd /c npx playwright test "tests/bot-ai-smoke.spec.js" "tests/bot-ai-behavior-scenario.spec.js"
```

After sprint window:
- return to normal Codex-sparing policy;
- local GPT patch first by default;
- Codex only for high-risk / multi-file / audit-heavy tasks.

New closeout doc:

```text
docs/project/codex_sprint_closeout_20260509.md
```
<!-- FE_PATCH_10E5_DOCS_CODEX_SPRINT_CLOSEOUT_END -->

<!-- FE_PATCH_10E6_DOCS_GLM_USEFUL_FINDINGS_AND_NEXT_PATCH_QUEUE_START -->
## PATCH-10E6 — GLM useful findings + next patch queue

Reviewed latest GLM context / roadmap / GLM-08 Scout Unit MVP report.

Decision:

```text
GLM_TESTS remains experimental.
WORK remains canonical.
GLM ideas can be reused only as small audited extraction patches.
No direct GLM -> WORK transfer.
```

Useful GLM candidates:
- dedicated scout unit shell;
- spawn units in front of factory;
- factoryMaxQueue knob;
- territory under fog audit;
- production regression audit;
- scenario tests.

Do NOT transfer as-is:
- GLM-08 Scout Unit MVP;
- GLM08_RunScoutAI;
- GLM08_TryProduceScout;
- GLM07 economy brain hooks;
- large multi-subsystem main.js changes.

Reason:
- GLM-08 is high risk;
- scout movement is broken in GLM;
- enemy territory is visible under fog in GLM;
- user observed production/economy regression in GLM branch.

New reference doc:

```text
docs/project/glm_useful_findings_for_work_20260509.md
```

Next safe WORK queue:
1. run bot tests + manual playtest;
2. if stable, `PATCH-GLM-01-HOTFIX-SPLIT-AUDIT`;
3. then maybe `PATCH-SCOUT-01-UNIT-SHELL`;
4. factory spawn / queue as separate patches;
5. economy brain stays deferred.
<!-- FE_PATCH_10E6_DOCS_GLM_USEFUL_FINDINGS_AND_NEXT_PATCH_QUEUE_END -->

<!-- FE_PATCH_10E7_DOCS_SCOUT_UNIT_ROADMAP_PRIORITY_START -->
## PATCH-10E7 — Scout unit roadmap priority

User manually confirmed: GLM scout movement currently works. Earlier GLM audit uncertainty about stuck scout is now corrected.

Decision:

```text
Dedicated scout unit is now an active WORK priority.
```

Why:
- using a slow light_tank as scout is visually/mechanically weak;
- scout gives clear recon role: fast, fragile, wide vision, no combat value;
- bot should scout with scout, gather knowledge, then decide whether to attack.

GLM scout remains MVP/reference only:
- uses builder visual;
- boosted speed;
- bigger vision;
- useful mechanic, not final asset/code for WORK.

New staged WORK plan:

```text
ASSET-SCOUT-00 — concept/model/render pipeline
PATCH-SCOUT-01 — unit shell
PATCH-SCOUT-02 — player factory production
PATCH-SCOUT-03 — manual movement + vision smoke
PATCH-SCOUT-04 — bot uses scout instead of tank for scouting
PATCH-SCOUT-05 — bot scout production
PATCH-SCOUT-06 — bot intel loop
```

Do not import GLM08 scout AI / GLM07 economy hooks / direct queue manipulation as-is.

New reference doc:

```text
docs/project/scout_unit_roadmap_20260509.md
```
<!-- FE_PATCH_10E7_DOCS_SCOUT_UNIT_ROADMAP_PRIORITY_END -->
