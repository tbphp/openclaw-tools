#!/usr/bin/env python3
import argparse
import json
import os
import shlex
import subprocess
import sys
from pathlib import Path
from typing import Any, Dict, List, Tuple

BASE_DIR = Path(__file__).resolve().parents[1]
CONFIG_PATH = BASE_DIR / "data" / "services.json"

DOCKER_COMPOSE_DEFAULTS = {
    "update": "docker compose pull && docker compose up -d --remove-orphans",
    "restart": "docker compose restart",
    "status": "docker compose ps",
    "health": "docker compose ps",
}

DEFAULT_SHELL = "/bin/sh"
DEFAULT_MINIMAL_PATH = "/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"


def _load_config() -> Dict:
    if not CONFIG_PATH.exists():
        return {"services": {}}
    with CONFIG_PATH.open("r", encoding="utf-8") as f:
        data = json.load(f)
    if "services" not in data or not isinstance(data["services"], dict):
        data["services"] = {}
    return data


def _save_config(data: Dict) -> None:
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = CONFIG_PATH.with_suffix(".json.tmp")
    with tmp_path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2, sort_keys=True)
        f.write("\n")
    tmp_path.replace(CONFIG_PATH)


def _normalize_service_token(text: str) -> str:
    s = (text or "").strip().lower()
    for token in ["服务", "服务器", "项目", "更新", "重启", "一下", "下", "的"]:
        s = s.replace(token, "")
    s = "".join(ch for ch in s if ch.isalnum())
    return s


def _resolve_service(services: Dict, name_or_alias: str) -> Tuple[str, Dict]:
    needle_raw = (name_or_alias or "").strip().lower()
    needle_norm = _normalize_service_token(needle_raw)
    if not needle_raw:
        raise KeyError("service name is empty")

    if needle_raw in services:
        return needle_raw, services[needle_raw]

    for key, entry in services.items():
        aliases = entry.get("aliases", [])
        if any(str(a).strip().lower() == needle_raw for a in aliases):
            return key, entry

    candidates = []
    for key, entry in services.items():
        tokens = {key.lower()}
        display = str(entry.get("display_name", "")).strip().lower()
        if display:
            tokens.add(display)
        for a in entry.get("aliases", []):
            t = str(a).strip().lower()
            if t:
                tokens.add(t)

        norm_tokens = {_normalize_service_token(t) for t in tokens if t}

        if needle_norm and needle_norm in norm_tokens:
            return key, entry

        if needle_norm and any((nt.startswith(needle_norm) or needle_norm in nt) for nt in norm_tokens if nt):
            candidates.append((key, entry))

    if len(candidates) == 1:
        return candidates[0]

    if len(candidates) > 1:
        names = ", ".join(k for k, _ in candidates)
        raise KeyError(f"service is ambiguous: {name_or_alias} -> {names}")

    raise KeyError(f"service not found: {name_or_alias}")


def _shell_bin(entry: Dict) -> str:
    return str(entry.get("shell") or DEFAULT_SHELL)


def _shell_init(entry: Dict) -> str:
    return (str(entry.get("shell_init") or ":").strip() or ":")


def _service_env(entry: Dict) -> Dict[str, str]:
    merged = dict(os.environ)
    user_env = entry.get("env", {})
    if isinstance(user_env, dict):
        for k, v in user_env.items():
            key = str(k).strip()
            if key:
                merged[key] = str(v)

    current_path = str(merged.get("PATH", "")).strip()
    if not current_path:
        merged["PATH"] = DEFAULT_MINIMAL_PATH
    else:
        path_parts = [p for p in current_path.split(":") if p]
        for p in DEFAULT_MINIMAL_PATH.split(":"):
            if p and p not in path_parts:
                path_parts.append(p)
        merged["PATH"] = ":".join(path_parts)

    return merged


def _service_workdir(entry: Dict) -> str:
    workdir = os.path.expanduser(str(entry.get("path", "")).strip())
    if not workdir:
        raise ValueError("service path is empty")
    return workdir


def _build_runner(entry: Dict, cmd: str) -> List[str]:
    workdir = _service_workdir(entry)
    shell_init = _shell_init(entry)
    if shell_init and shell_init != ":":
        full_cmd = f"{shell_init}; cd {shlex.quote(workdir)} && {cmd}"
    else:
        full_cmd = f"cd {shlex.quote(workdir)} && {cmd}"
    return [_shell_bin(entry), "-c", full_cmd]


def _run_shell(entry: Dict, cmd: str, capture: bool = False) -> subprocess.CompletedProcess:
    runner = _build_runner(entry, cmd)
    return subprocess.run(runner, capture_output=capture, text=True, env=_service_env(entry))


def _precheck(entry: Dict, action: str) -> int:
    if action != "update":
        return 0

    runtime = str(entry.get("runtime", "custom")).strip().lower()
    if runtime != "docker_compose":
        return 0

    cp_docker = _run_shell(entry, "command -v docker >/dev/null 2>&1", capture=True)
    if cp_docker.returncode != 0:
        print("[PRECHECK] docker command not found in PATH", file=sys.stderr)
        print(f"[PRECHECK] PATH={_service_env(entry).get('PATH', '')}", file=sys.stderr)
        return 2

    cp_info = _run_shell(entry, "docker info >/dev/null 2>&1", capture=True)
    if cp_info.returncode != 0:
        detail = (cp_info.stderr or cp_info.stdout or "").strip()
        print("[PRECHECK] docker daemon is not reachable (start Docker Desktop / Docker daemon first)", file=sys.stderr)
        if detail:
            print(f"[PRECHECK_DETAIL] {detail}", file=sys.stderr)
        return 2

    return 0


def _run_action(entry: Dict, action: str, dry_run: bool = False) -> int:
    actions = entry.get("actions", {})
    if action not in actions or not str(actions[action]).strip():
        print(f"[ERROR] action '{action}' is not configured", file=sys.stderr)
        return 2

    try:
        _service_workdir(entry)
    except ValueError as e:
        print(f"[ERROR] {e}", file=sys.stderr)
        return 2

    cmd = str(actions[action]).strip()
    runner = _build_runner(entry, cmd)

    if dry_run:
        print("[DRY-RUN]", " ".join(shlex.quote(x) for x in runner), flush=True)
        return 0

    precheck_rc = _precheck(entry, action)
    if precheck_rc != 0:
        return precheck_rc

    print("[RUN]", " ".join(shlex.quote(x) for x in runner), flush=True)
    proc = subprocess.run(runner, env=_service_env(entry))
    return proc.returncode


def _short(s: str, n: int = 12) -> str:
    if not s:
        return "-"
    return s[:n]


def _safe_json_loads(text: str, fallback: Any) -> Any:
    try:
        return json.loads(text)
    except Exception:
        return fallback


def _docker_compose_version_snapshot(entry: Dict) -> Dict[str, Any]:
    cp_ids = _run_shell(entry, "docker compose ps -q", capture=True)
    if cp_ids.returncode != 0:
        return {
            "mode": "docker_compose",
            "ok": False,
            "error": (cp_ids.stderr or cp_ids.stdout or "docker compose ps -q failed").strip(),
            "components": {},
        }

    ids = [line.strip() for line in (cp_ids.stdout or "").splitlines() if line.strip()]
    if not ids:
        return {"mode": "docker_compose", "ok": True, "components": {}}

    inspect_cmd = "docker inspect " + " ".join(shlex.quote(x) for x in ids)
    cp_inspect = _run_shell(entry, inspect_cmd, capture=True)
    if cp_inspect.returncode != 0:
        return {
            "mode": "docker_compose",
            "ok": False,
            "error": (cp_inspect.stderr or cp_inspect.stdout or "docker inspect failed").strip(),
            "components": {},
        }

    containers = _safe_json_loads(cp_inspect.stdout or "", [])
    if not isinstance(containers, list):
        containers = []

    image_ids = sorted({str(item.get("Image", "")).strip() for item in containers if str(item.get("Image", "")).strip()})
    image_meta_by_id: Dict[str, Dict[str, Any]] = {}
    if image_ids:
        img_cmd = "docker image inspect " + " ".join(shlex.quote(x) for x in image_ids)
        cp_img = _run_shell(entry, img_cmd, capture=True)
        if cp_img.returncode == 0:
            images = _safe_json_loads(cp_img.stdout or "", [])
            if isinstance(images, list):
                for img in images:
                    img_id = str(img.get("Id", "")).strip()
                    if img_id:
                        image_meta_by_id[img_id] = img

    components: Dict[str, Dict[str, Any]] = {}
    for c in containers:
        labels = c.get("Config", {}).get("Labels", {}) or {}
        compose_service = str(labels.get("com.docker.compose.service", "")).strip()
        service_name = compose_service or str(c.get("Name", "")).lstrip("/") or "unknown"
        image_ref = str(c.get("Config", {}).get("Image", "")).strip()
        image_id = str(c.get("Image", "")).strip()

        img_meta = image_meta_by_id.get(image_id, {})
        img_labels = img_meta.get("Config", {}).get("Labels", {}) or {}
        repo_digests = img_meta.get("RepoDigests", []) or []
        repo_digest = ""
        if repo_digests and isinstance(repo_digests, list):
            first = str(repo_digests[0])
            repo_digest = first.split("@", 1)[1] if "@" in first else first

        version = (
            str(img_labels.get("org.opencontainers.image.version", "")).strip()
            or str(img_labels.get("org.label-schema.version", "")).strip()
        )
        revision = str(img_labels.get("org.opencontainers.image.revision", "")).strip()

        components[service_name] = {
            "container": str(c.get("Name", "")).lstrip("/"),
            "image_ref": image_ref,
            "image_id": image_id,
            "version": version,
            "digest": repo_digest,
            "revision": revision,
        }

    return {"mode": "docker_compose", "ok": True, "components": components}


def _custom_version_snapshot(entry: Dict) -> Dict[str, Any]:
    version_cmd = str(entry.get("version_cmd", "")).strip()
    if not version_cmd:
        return {"ok": False, "output": "", "error": "version_cmd not configured"}

    cp = _run_shell(entry, version_cmd, capture=True)
    out = (cp.stdout or "").strip()
    err = (cp.stderr or "").strip()
    return {
        "ok": cp.returncode == 0,
        "output": out,
        "error": "" if cp.returncode == 0 else (err or out or f"exit {cp.returncode}"),
    }


def _capture_version(entry: Dict) -> Dict[str, Any]:
    runtime = str(entry.get("runtime", "custom"))
    snap: Dict[str, Any] = {"runtime": runtime}

    if runtime == "docker_compose":
        snap["runtime_snapshot"] = _docker_compose_version_snapshot(entry)

    if str(entry.get("version_cmd", "")).strip():
        snap["custom_snapshot"] = _custom_version_snapshot(entry)

    return snap


def _component_version_text(comp: Dict[str, Any]) -> str:
    version = str(comp.get("version", "")).strip()
    if version:
        return version
    digest = str(comp.get("digest", "")).strip()
    if digest:
        return f"digest:{_short(digest)}"
    image_id = str(comp.get("image_id", "")).strip()
    if image_id:
        return f"image:{_short(image_id)}"
    return "unknown"


def _print_version_report(service_key: str, before: Dict[str, Any], after: Dict[str, Any], action: str, rc: int) -> None:
    print("[VERSION_REPORT]", flush=True)
    print(f"- target: {service_key}", flush=True)
    print(f"- action: {action}", flush=True)
    print(f"- result: {'success' if rc == 0 else f'failed (exit {rc})'}", flush=True)

    before_runtime = before.get("runtime_snapshot") if isinstance(before, dict) else None
    after_runtime = after.get("runtime_snapshot") if isinstance(after, dict) else None

    if isinstance(before_runtime, dict) and isinstance(after_runtime, dict):
        bcomps = before_runtime.get("components", {}) or {}
        acomps = after_runtime.get("components", {}) or {}
        all_names = sorted(set(bcomps.keys()) | set(acomps.keys()))
        if all_names:
            print("- components:", flush=True)
            for name in all_names:
                b = bcomps.get(name)
                a = acomps.get(name)
                if b and a:
                    btxt = _component_version_text(b)
                    atxt = _component_version_text(a)
                    changed = btxt != atxt or b.get("image_id") != a.get("image_id")
                    status = "changed" if changed else "same"
                    print(f"  - {name}: {btxt} -> {atxt} ({status})", flush=True)
                elif (not b) and a:
                    atxt = _component_version_text(a)
                    print(f"  - {name}: (new) -> {atxt}", flush=True)
                elif b and (not a):
                    btxt = _component_version_text(b)
                    print(f"  - {name}: {btxt} -> (removed)", flush=True)

    b_custom = before.get("custom_snapshot") if isinstance(before, dict) else None
    a_custom = after.get("custom_snapshot") if isinstance(after, dict) else None
    if isinstance(b_custom, dict) or isinstance(a_custom, dict):
        b_text = (b_custom or {}).get("output", "") if isinstance(b_custom, dict) else ""
        a_text = (a_custom or {}).get("output", "") if isinstance(a_custom, dict) else ""
        if b_text or a_text:
            print("- custom_version:", flush=True)
            print(f"  - before: {b_text or '-'}", flush=True)
            print(f"  - after: {a_text or '-'}", flush=True)


def _ensure_service(data: Dict, name: str) -> Tuple[str, Dict]:
    key = name.strip().lower()
    if not key:
        raise ValueError("service name cannot be empty")

    services = data.setdefault("services", {})
    if key not in services:
        services[key] = {
            "display_name": name.strip(),
            "path": "",
            "runtime": "custom",
            "aliases": [],
            "shell": DEFAULT_SHELL,
            "shell_init": ":",
            "env": {},
            "actions": {},
        }
    return key, services[key]


def cmd_list(_: argparse.Namespace) -> int:
    data = _load_config()
    services = data.get("services", {})
    if not services:
        print("(no services configured)")
        return 0

    for key in sorted(services.keys()):
        entry = services[key]
        display = entry.get("display_name") or key
        runtime = entry.get("runtime", "custom")
        path = entry.get("path", "")
        aliases = ",".join(entry.get("aliases", []))
        print(f"- {key} ({display})")
        print(f"  runtime: {runtime}")
        print(f"  path: {path}")
        if aliases:
            print(f"  aliases: {aliases}")
    return 0


def cmd_show(args: argparse.Namespace) -> int:
    data = _load_config()
    services = data.get("services", {})
    try:
        key, entry = _resolve_service(services, args.service)
    except KeyError as e:
        print(f"[ERROR] {e}", file=sys.stderr)
        return 1

    print(json.dumps({"id": key, **entry}, ensure_ascii=False, indent=2, sort_keys=True))
    return 0


def _run_named_action(service: str, action: str, dry_run: bool) -> int:
    data = _load_config()
    services = data.get("services", {})
    try:
        key, entry = _resolve_service(services, service)
    except KeyError as e:
        print(f"[ERROR] {e}", file=sys.stderr)
        return 1

    print(f"[SERVICE] {key}", flush=True)

    need_version_report = (action in {"update", "restart"}) and (not dry_run)
    before_snap: Dict[str, Any] = {}
    if need_version_report:
        before_snap = _capture_version(entry)

    rc = _run_action(entry, action, dry_run=dry_run)

    if need_version_report:
        after_snap = _capture_version(entry)
        _print_version_report(service_key=key, before=before_snap, after=after_snap, action=action, rc=rc)

        if rc == 0:
            actions = entry.get("actions", {}) or {}
            if "status" in actions and str(actions.get("status", "")).strip():
                print("[POST_CHECK] status", flush=True)
                _run_action(entry, "status", dry_run=False)

    return rc


def cmd_update(args: argparse.Namespace) -> int:
    return _run_named_action(args.service, "update", args.dry_run)


def cmd_restart(args: argparse.Namespace) -> int:
    return _run_named_action(args.service, "restart", args.dry_run)


def cmd_status(args: argparse.Namespace) -> int:
    return _run_named_action(args.service, "status", args.dry_run)


def cmd_health(args: argparse.Namespace) -> int:
    return _run_named_action(args.service, "health", args.dry_run)


def cmd_run(args: argparse.Namespace) -> int:
    return _run_named_action(args.service, args.action, args.dry_run)


def cmd_set(args: argparse.Namespace) -> int:
    data = _load_config()
    key, entry = _ensure_service(data, args.service)

    if args.display_name is not None:
        entry["display_name"] = args.display_name
    if args.path is not None:
        entry["path"] = args.path
    if args.runtime is not None:
        entry["runtime"] = args.runtime

    if args.alias:
        existing = {str(a).strip().lower(): a for a in entry.get("aliases", []) if str(a).strip()}
        for alias in args.alias:
            k = alias.strip().lower()
            if k:
                existing[k] = alias.strip()
        entry["aliases"] = sorted(existing.values(), key=lambda x: x.lower())

    if args.shell is not None:
        entry["shell"] = args.shell

    if args.shell_init is not None:
        entry["shell_init"] = args.shell_init

    if args.env:
        existing_env = entry.get("env", {})
        if not isinstance(existing_env, dict):
            existing_env = {}
        for pair in args.env:
            if "=" not in pair:
                print(f"[ERROR] invalid --env '{pair}', expected KEY=VALUE", file=sys.stderr)
                return 2
            key, value = pair.split("=", 1)
            key = key.strip()
            if not key:
                print(f"[ERROR] invalid --env '{pair}', key is empty", file=sys.stderr)
                return 2
            existing_env[key] = value
        entry["env"] = existing_env

    if args.version_cmd is not None:
        entry["version_cmd"] = args.version_cmd

    actions = entry.setdefault("actions", {})

    if (args.runtime == "docker_compose") or (entry.get("runtime") == "docker_compose"):
        for k, v in DOCKER_COMPOSE_DEFAULTS.items():
            actions.setdefault(k, v)

    if args.update_cmd is not None:
        actions["update"] = args.update_cmd
    if args.restart_cmd is not None:
        actions["restart"] = args.restart_cmd
    if args.status_cmd is not None:
        actions["status"] = args.status_cmd
    if args.health_cmd is not None:
        actions["health"] = args.health_cmd

    _save_config(data)
    print(f"[OK] service saved: {key}")
    return 0


def cmd_remove(args: argparse.Namespace) -> int:
    data = _load_config()
    services = data.get("services", {})
    key = args.service.strip().lower()
    if key not in services:
        print(f"[ERROR] service not found: {args.service}", file=sys.stderr)
        return 1
    services.pop(key)
    _save_config(data)
    print(f"[OK] service removed: {key}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Service registry runner")
    sub = p.add_subparsers(dest="cmd", required=True)

    sp = sub.add_parser("list", help="list services")
    sp.set_defaults(func=cmd_list)

    sp = sub.add_parser("show", help="show service json")
    sp.add_argument("service")
    sp.set_defaults(func=cmd_show)

    for name, fn in [("update", cmd_update), ("restart", cmd_restart), ("status", cmd_status), ("health", cmd_health)]:
        sp = sub.add_parser(name, help=f"run {name} action")
        sp.add_argument("service")
        sp.add_argument("--dry-run", action="store_true")
        sp.set_defaults(func=fn)

    sp = sub.add_parser("run", help="run custom action")
    sp.add_argument("service")
    sp.add_argument("action")
    sp.add_argument("--dry-run", action="store_true")
    sp.set_defaults(func=cmd_run)

    sp = sub.add_parser("set", help="create/update a service")
    sp.add_argument("service")
    sp.add_argument("--display-name")
    sp.add_argument("--path")
    sp.add_argument("--runtime", choices=["docker_compose", "systemd", "pm2", "custom"])
    sp.add_argument("--alias", action="append", default=[])
    sp.add_argument("--shell")
    sp.add_argument("--shell-init")
    sp.add_argument("--env", action="append", default=[])
    sp.add_argument("--version-cmd")
    sp.add_argument("--update-cmd")
    sp.add_argument("--restart-cmd")
    sp.add_argument("--status-cmd")
    sp.add_argument("--health-cmd")
    sp.set_defaults(func=cmd_set)

    sp = sub.add_parser("remove", help="remove a service")
    sp.add_argument("service")
    sp.set_defaults(func=cmd_remove)

    return p


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())
