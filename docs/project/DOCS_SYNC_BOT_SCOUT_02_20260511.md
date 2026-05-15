# DOCS_SYNC_BOT_SCOUT_02_20260511

## Scope

Checkpoint after BOT-SCOUT-02B2 / 02C / 02D / 02D3 / 02D4 / 02E scout work.

This checkpoint marks current enemy scout behavior as good enough to build the next bot layer on top of it: enemy tank decisions using scout intel.

## Current merged state

Repository: `ratoker-jpg/glm-game-sandbox`

Main branch: `sandbox/main`

Relevant merged PRs:

- PR #40 — BOT-SCOUT-02B2: return fallback home/rally target
- PR #41 — BOT-SCOUT-02C: tiered scout threat reaction
- PR #42 — BOT-SCOUT-02D: base perimeter sweep
- PR #43 — BOT-SCOUT-02E: fix scout outbound target selection
- PR #44 — BOT-SCOUT-02D3: edge-aware base perimeter sweep
- PR #45 — BOT-SCOUT-02D4: sweep timing completion tuning

## Manual status

Manual test after 02D4 showed PASS behavior:

- enemy scout moves toward player HQ/base area instead of empty map corner;
- scout enters `outbound`;
- scout reaches player base rally zone;
- scout enters `observing`;
- scout enters `sweeping`;
- scout moves around the accessible player-base perimeter;
- scout completes sweep with `reason='sweep_done'` instead of `reason='sweep_timeout'`;
- scout returns home after sweep;
- enemy tank cap workaround was used during manual tests, so tank pressure did not interfere.

Example observed lifecycle:

```text
outbound -> observing -> sweeping -> returning(reason='sweep_done')
```

Example observed sweep route around player base area:

```text
13,39 -> 10,41 -> 7,41 -> 12,39 -> returning
```

## What is considered working now

### 1. Return lifecycle

BOT-SCOUT-02B2 fixed the return target problem.

Scout no longer gets stuck forever in `returning` when exact `homeX/homeY` is blocked or unsuitable. Return fallback can pick a reachable return/rally target around enemy home/base.

### 2. Threat behavior

BOT-SCOUT-02C changed threat reaction from immediate retreat on distant tank sight to tiered behavior:

- damage -> immediate return;
- player light_tank within danger radius <= 2 -> immediate return;
- player light_tank within awareness radius 3..5 -> telemetry only, no immediate retreat.

This makes scout less cowardly while still preventing obvious suicide.

### 3. Base sweep

BOT-SCOUT-02D added `sweeping` lifecycle state.

The intended lifecycle is:

```text
outbound -> observing -> sweeping -> returning -> cooldown -> outbound
```

Scout can now perform a small base perimeter sweep after seeing player HQ/buildings.

### 4. Outbound target selection

BOT-SCOUT-02E fixed wrong scout outbound target selection.

Before 02E, scout could target an empty map corner like `x=40,y=40` while player HQ was around `x=9,y=40`.

Now scout target priority is:

1. player HQ rally point near player base;
2. knowledge target;
3. map_probe fallback.

Expected telemetry:

```text
outboundTargetSource = 'player_hq_rally'
```

### 5. Edge-aware sweep

BOT-SCOUT-02D3 improved sweep candidate generation for bases near map edges:

- 24 angular samples;
- radius range 5, 7, 9;
- edge margin filtering;
- danger filtering;
- dry-run reachability filtering;
- angular spread selection up to 3 points.

This prevents scout from only moving along one side when bottom/lower candidates are out-of-bounds.

### 6. Sweep timing

BOT-SCOUT-02D4 tuned constants so scout can usually finish sweep:

- `FE_SCOUT02D_SWEEP_TIMEOUT_SEC`: 22 -> 30
- `FE_SCOUT02D_SWEEP_OBSERVE_SEC`: 2 -> 1.5
- `FE_SCOUT02D_SWEEP_ARRIVE_DIST`: 2 -> 3

Expected result after 02D4:

```text
reason = 'sweep_done'
```

not normally:

```text
reason = 'sweep_timeout'
```

## Current telemetry fields to use

Use `game._botScout02B` for debugging. Important fields:

```text
state
reason
x/y
homeX/homeY
returnX/returnY
distToHome
distToReturn
pathLen

threatSeen
nearestThreatDist
threatReturnReason
seenPlayerUnitsCount
seenPlayerBuildingsCount
seenPlayerHq

sweepActive
sweepCenterX/sweepCenterY
sweepTargetX/sweepTargetY
sweepCompletedCount
sweepCandidatesCount
sweepRawCandidatesCount
sweepSelectedCandidatesCount
sweepSkippedOutOfBoundsCount
sweepSkippedDangerAtGenCount
sweepSkippedUnreachableCount
sweepCandidateMode
sweepSelectionReason
sweepReason
sweepStartedAt

outboundTargetSource
outboundTargetReason
outboundTargetX/outboundTargetY
playerHqX/playerHqY
playerHqCenterX/playerHqCenterY
targetDistToPlayerHq
fallbackUsed
```

## Future design notes

Current scout behavior is acceptable as a foundation, but not final AI.

Future desired direction:

### BOT-SCOUT-03A — scout intel completion model

Scout mission should eventually complete because enough useful information was gathered, not because a fixed timer expired.

Possible intel completion signals:

- player HQ seen / confirmed;
- player buildings counted;
- player harvesters / economy activity observed;
- player unit count/types observed;
- factories / military production observed;
- defenses/tanks around base observed;
- enough perimeter angles covered.

Timeout should remain only as a safety fallback against stuck states.

### BOT-SCOUT-03B — fast next-point decision

Scout should not pause for a long fixed delay after each sweep point.

Desired feel:

```text
arrive -> very short tactical pause (~300 ms) -> choose next point -> move
```

Scout should look active, not like it waits on a timer.

### BOT-ATTACK follow-up

After scout intel is reliable enough, enemy light_tank attack decisions can start using scout intel.

Do not combine large scout-intel model changes and tank attack-chain rewrites in one patch unless explicitly planned.

## Scope guard for next patches

When starting the next GLM task, do not reopen already-closed scout issues unless manual tests show a clear regression.

Avoid touching unless the task explicitly requires it:

- BOT-SCOUT-02B2 return fallback internals;
- BOT-SCOUT-02C threat thresholds;
- BOT-SCOUT-02D/02D3/02D4 sweep lifecycle and timing;
- BOT-SCOUT-02E outbound target selection;
- ATTACK-08/09/10;
- enemy light_tank attack-chain;
- findPath/passable internals;
- combat damage;
- map generation;
- render/fog;
- save/load;
- scout production/cap.
