# GLM Sandbox Repository

This folder is a safe Git/GitHub sandbox copy of the browser RTS project for GLM browser and GitHub agent work.

Sandbox path:

```text
C:\Users\Den\Desktop\GLM_test\glm_game_sandbox
```

Production path that must not be touched:

```text
C:\Users\Den\Desktop\four elements\four_elements_core_base
```

Purpose:

- prepare a private, isolated repository for GLM experiments;
- keep production and Google Drive mirror workflows out of the sandbox;
- allow safe branch-based infrastructure and code review work later.

Basic run command:

```bat
00_START_GAME_WORK_8010.bat
```

Local URL:

```text
http://localhost:8010/index.html
```

Basic checks:

```bat
node --check src/main.js
```

If more checks are needed later, prefer safe static or syntax checks first.

GitHub workflow:

1. Base branch is `sandbox/main`.
2. Create a feature branch for each task.
3. Make minimal diffs.
4. Review changed files and checks in `PATCH_REPORT.txt`.
5. Never push directly to `main`.

What GLM is allowed to do:

- inspect and edit files only inside this sandbox folder;
- make minimal, reversible changes;
- update docs, tooling, tests, and safe infrastructure;
- prepare feature branches and commits;
- report changed files, checks, risks, and next steps.

What GLM is forbidden to do:

- touch the production folder;
- sync anything to `FourElements_WORK_MIRROR`;
- run Google Drive sync from this sandbox;
- rewrite architecture without an explicit request;
- modify assets without an explicit request;
- make broad gameplay changes when the task is infra-only;
- push directly to `main`.
