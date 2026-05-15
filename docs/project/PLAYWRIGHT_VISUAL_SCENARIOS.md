# Playwright visual scenarios — актуальный процесс

## Команды

```bat
05_RUN_VISUAL_SCENARIOS.bat hud
05_RUN_VISUAL_SCENARIOS.bat victory
05_RUN_VISUAL_SCENARIOS.bat defeat
05_RUN_VISUAL_SCENARIOS.bat all
```

После этого:

```bat
04_SYNC_WORK_MIRROR_TO_GOOGLE_DRIVE.bat
```

## Где смотреть результат

Локально:

```text
_reports/screenshots/latest/
```

В Google Drive mirror:

```text
FourElements_WORK_MIRROR/visual_screenshots/latest/
```

Файлы:

```text
hud.png
victory.png
defeat.png
```

## Назначение

Это инструмент для UI/visual review:

- HUD;
- панели;
- help-block;
- result overlays;
- toast;
- шрифты;
- отступы;
- visual polish.

Это не полноценный gameplay-test. Поведение танков, pathfinding, attack-move и bot всё ещё проверяются вручную или отдельными gameplay-сценариями позже.
