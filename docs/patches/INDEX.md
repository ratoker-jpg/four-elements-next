# Patch Index

Автоматический индекс всех патчей проекта.
Источник: PR merge history + docs/patches/{TASK_ID}.md

| TASK_ID | Date | PR | Description |
|---------|------|-----|-------------|
| WORKFLOW-02 | 2026-05-09 | — | Упростить процесс: Fast lane без PR для низкорисковых задач |
| PATCH-SCOUT-01 | 2026-05-09 | — | Подключить scout unit shell |
| PATCH-SCOUT-01B | 2026-05-09 | — | Исправить способ dev-теста scout |
| PATCH-SCOUT-01C | 2026-05-09 | — | Исправить визуальную посадку scout и управление движением |
| PATCH-SCOUT-01D | 2026-05-09 | — | Исправить orientation / dir mapping scout |
| PATCH-SCOUT-01E | 2026-05-09 | — | Final visual tuning scout |
| PATCH-SCOUT-01F | 2026-05-09 | — | Точная центровка scout по фото |
| PATCH-SCOUT-01G | 2026-05-09 | — | Поправить selection ring и убрать меню scout |
| PATCH-SCOUT-02 | 2026-05-09 | — | Добавить scout в производство units_factory |
| GLM-UI-01 | 2026-05-09 | — | Обновить текст демо-сборки в главном меню |
| GLM-STRATEGY-01 | 2026-05-09 | — | Полный стратегический аудит проекта |
| REF-MAIN-GLM-02 | 2026-05-10 | — | Dead code cleanup из audited main.js candidates |
| REF-MAIN-GLM-03 | 2026-05-10 | — | Extract combat debug overlay from src/main.js |
| REF-MAIN-GLM-04 | 2026-05-10 | — | Extract enemy economy debug panel from src/main.js |
| REF-MAIN-GLM-05 | 2026-05-10 | — | Extract snapshot/export system from src/main.js |
| REF-MAIN-GLM-06 | 2026-05-10 | — | Extract standalone constants from src/main.js |
| REF-MAIN-GLM-07 | 2026-05-10 | — | Docs checkpoint после main.js micro-refactor sprint |
| DOCS-AUDIT-01 | 2026-05-10 | — | Аудит source-of-truth и устаревших документов |
| DOCS-CLEANUP-01 | 2026-05-10 | — | Реорганизация документов: AI_READ_FIRST + архивация |
| BOT-MVP-01 | 2026-05-10 | — | Аудит текущего enemy bot / skirmish для playable 1v1 |
| BOT-BASELINE-01 | 2026-05-10 | — | Enemy bot стартует и выживает |
| BOT-PRIORITY-01 | 2026-05-10 | — | Priority decision loop — первый слой мышления enemy bot |
| BOT-PROD-FIX-01 | 2026-05-10 | — | Починить накопление light_tank без атаки |
| BOT-ATTACK-FIX-01 | 2026-05-10 | — | Починить решение атаковать через патч-08B |
| BOT-ATTACK-03 | 2026-05-10 | — | Enemy wave group attack order assignment fix |
| BOT-ATTACK-04 | 2026-05-10 | — | hq_push order persistence / prevent regroup overwrite |
| BOT-ATTACK-05 | 2026-05-10 | — | Sync hq_push attack target with movement command |
| BOT-ATTACK-06 | 2026-05-10 | — | Enemy attack movement stall fix |
| BOT-ATTACK-07 | 2026-05-10 | — | Fix enemy attack_approach/manual_move desync |
| BOT-ATTACK-08 | 2026-05-10 | — | Global repair for enemy attack-order invariant |
| BOT-ATTACK-09 | 2026-05-10 | — | Экспериментальный production cap для enemy light_tank |
| BOT-ATTACK-10 | 2026-05-10 | — | Lock active attack wave composition (MVP) |
| BOT-SCOUT-01 | 2026-05-10 | — | Enemy produces and uses scout MVP |
| BOT-SCOUT-01B | 2026-05-10 | — | Исправить назначение пути движения вражеского скаута |
| BOT-SCOUT-01C | 2026-05-10 | — | Исправить зависание скаута с метаданными цели, но без пути |
| BOT-SCOUT-02A | 2026-05-11 | #37 | Scout combat targetability + early scout production policy |
| BOT-SCOUT-02B | 2026-05-11 | #38 | Scout observe-return-cooldown lifecycle |
| BOT-SCOUT-02B1 | 2026-05-11 | #39 | Fix scout cooldown far from home + timer base mismatch |
| BOT-SCOUT-02C1 | 2026-05-11 | #41 | Fix scouting completeness telemetry |
| BOT-SCOUT-02D | 2026-05-11 | #42 | Base perimeter sweep for enemy scout |
| BOT-SCOUT-02D1 | 2026-05-11 | — | Исправления BOT-SCOUT-02D (sweep center, usable move) |
| BOT-SCOUT-02D2 | 2026-05-11 | — | Cleanup sweep telemetry при threat/damage abort |
| BOT-SCOUT-02E | 2026-05-11 | #43 | Fix scout outbound target selection |
| BOT-SCOUT-02D3 | 2026-05-11 | #44 | Edge-aware base perimeter sweep |
| BOT-SCOUT-02D4 | 2026-05-11 | — | Sweep timing completion tuning |
| BOT-INTEL-01 | 2026-05-11 | #46 | Persist scout intel snapshot |
| BOT-ATTACK-11 | 2026-05-11 | #47 | Enemy tanks use scout intel target point as attack rally |
| BOT-ATTACK-11C | 2026-05-11 | #48 | Honest dispatch telemetry and skip reasons |
| BOT-ATTACK-12 | 2026-05-11 | #49 | Intel-based attack/no-attack decision gate |
| BOT-ATTACK-12A | 2026-05-11 | #50 | Align ready tank counting with assignable tank eligibility |
| DOCS-ARCH-00 | 2026-05-12 | TBD | Architecture Migration Workflow — переход от patch accumulation к системной разработке |
| ARCH-LAB-00 | 2026-05-12 | #68 | Большой архитектурный roadmap-аудит — hybrid lab strategy, 7-step roadmap |
| ARCH-LAB-00B | 2026-05-12 | TBD | Roadmap corrections: LAB-05 split, E2E smoke baseline, unit_controller decision, line count tracking, wiring budget |
| ARCH-LAB-00C | 2026-05-12 | TBD | Roadmap risk clarifications: LAB-05C pre-design required, review load update, LAB-05A fallback split, FE_TANK_DECIDER_ENABLED criteria |
| ARCH-LAB-01A | 2026-05-12 | TBD | Playwright E2E smoke baseline — Node static server + full playable flow test |
| ARCH-LAB-01 | 2026-05-13 | TBD | Skeleton contracts & unit_controller archive — 6 ownership READMEs, module boundaries, FE_CORE bridge, archive deprecated module |
| ARCH-LAB-02 | 2026-05-13 | #73 | Extract blankGame data factory into src/game/game_state.js |
| ARCH-LAB-03 | 2026-05-13 | #74 | Extract pure geometry/math helpers into src/core/geometry.js |
| ARCH-LAB-04A | 2026-05-13 | #75 | Command boundary — pure data command API (COMMAND_TYPES, factories, predicates) |
| ARCH-LAB-04B1 | 2026-05-13 | #76 | Movement boundary — pure data movement API (MOVEMENT_STATES, RESULTS, REASONS, RECOVERY_REQUESTS, factories, predicates) |
| ARCH-LAB-04B2 | 2026-05-13 | TBD | Movement ATTACK-06 decision delegation (shouldRequestAttackApproachRecovery, classifyBlocker, createAttackApproachRecoveryDecision) |
| ARCH-LAB-04C1 | 2026-05-13 | #78 | Combat boundary — pure data contract (COMBAT_RESULTS, TARGET_KINDS, DAMAGE_REASONS, ATTACK_STATES, factories, predicates) |
