---
name: service-updater
description: Manage self-hosted service deployments from a registry (update, restart, status, list, and config edits). Use when the user asks to update/restart deployed services (Docker Compose/systemd/PM2/custom shell), including short alias commands like “更新 cpa / 更新 cliproxyapi / 重启 xxx”, or when they want to add/modify service definitions so future updates run with short commands.
---

# Service Updater

Use this skill to run consistent service operations from a central registry.

## Quick commands

- List services:
  - `python3 {baseDir}/scripts/servicectl.py list`
- Show one service config:
  - `python3 {baseDir}/scripts/servicectl.py show <service>`
- Update service:
  - `python3 {baseDir}/scripts/servicectl.py update <service> --dry-run`
  - `python3 {baseDir}/scripts/servicectl.py update <service>`
  - After real update/restart, tool prints a standard `[VERSION_REPORT]` with before/after versions.
- Restart service:
  - `python3 {baseDir}/scripts/servicectl.py restart <service> --dry-run`
  - `python3 {baseDir}/scripts/servicectl.py restart <service>`
- Status service:
  - `python3 {baseDir}/scripts/servicectl.py status <service>`

## Config management (no manual file editing)

Use `set` to create/update a service entry:

- Docker Compose template:
  - `python3 {baseDir}/scripts/servicectl.py set <service> --runtime docker_compose --path <dir> --alias <alias>`
- Override any action command:
  - `--update-cmd "..."`
  - `--restart-cmd "..."`
  - `--status-cmd "..."`
  - `--health-cmd "..."`
- Optional custom version probe command (for non-standard apps):
  - `--version-cmd "..."`

Delete a service:

- `python3 {baseDir}/scripts/servicectl.py remove <service>`

## Execution rules

1. Default runner is non-interactive shell with minimal environment:
   - Uses `/bin/sh -c 'cd <path> && ...'`
   - Does **not** depend on `~/.zshrc`
   - Service-level `env` can inject required variables when needed
2. Resolve service by id or alias.
3. For update/restart, prefer `--dry-run` first unless user explicitly asks immediate execution.
4. For Docker Compose updates, prefer low-downtime default:
   - `docker compose pull && docker compose up -d --remove-orphans`
   - Avoid `down` unless user asks for hard reset.
5. After update/restart, run `status` and report result.

## Registry location

- `{baseDir}/data/services.json`

The registry is the source of truth for service operations.