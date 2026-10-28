#!/usr/bin/env python3
"""Deploy project source to Vercel via REST API (vcp_ tokens)."""

from __future__ import annotations

import hashlib
import json
import os
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

TOKEN = os.environ["VERCEL_TOKEN"]
TEAM_ID = os.environ.get("VERCEL_TEAM_ID", "team_XvdeejTJMqlLFFaRhoG1E13Y")
PROJECT_NAME = os.environ.get("VERCEL_PROJECT", "brand-wars")
ROOT = Path(os.environ.get("VERCEL_ROOT", Path(__file__).resolve().parents[1])).resolve()

SKIP_DIRS = {
    ".git",
    ".next",
    "node_modules",
    ".vercel",
    "test-results",
    "playwright-report",
    ".jules",
    "ai slop",
    "book-1-guidebook",
    "book-2-ai-team",
    "output",
    "tmp",
}
SKIP_FILES = {".env", ".env.local"}


def collect_files() -> list[tuple[str, Path]]:
    out: list[tuple[str, Path]] = []
    for path in ROOT.rglob("*"):
        if not path.is_file():
            continue
        rel = path.relative_to(ROOT).as_posix()
        if os.environ.get("VERCEL_SKIP_CONFIG") == "1" and rel == "vercel.json":
            continue
        if any(part in SKIP_DIRS for part in rel.split("/")):
            continue
        if path.name in SKIP_FILES or path.name.startswith(".env."):
            continue
        out.append((rel, path))
    return out


def upload_file(path: Path) -> str:
    url = f"https://api.vercel.com/v2/files?teamId={TEAM_ID}"
    data = path.read_bytes()
    digest = hashlib.sha1(data).hexdigest()
    for attempt in range(5):
        req = urllib.request.Request(
            url,
            data=data,
            method="POST",
            headers={
                "Authorization": f"Bearer {TOKEN}",
                "Content-Type": "application/octet-stream",
                "x-vercel-digest": digest,
                "Content-Length": str(len(data)),
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=120):
                return digest
        except urllib.error.HTTPError as e:
            if e.code in (409, 200):
                return digest
            if e.code in (400, 408, 429, 500, 502, 503, 504) and attempt < 4:
                time.sleep((8 if e.code == 429 else 1.5) * (attempt + 1))
                continue
            raise


def api(method: str, path: str, data: dict | None = None) -> dict:
    url = f"https://api.vercel.com{path}"
    body = json.dumps(data).encode() if data is not None else None
    req = urllib.request.Request(
        url,
        data=body,
        method=method,
        headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            return json.load(resp)
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        exc.vercel_detail = detail
        print(f"Vercel API {exc.code}: {detail[:4000]}", file=sys.stderr)
        raise


def main() -> None:
    files = collect_files()
    print(f"Files: {len(files)}")

    print("Uploading source blobs...")
    uploaded = 0
    uploaded_files: list[tuple[str, str]] = []
    if os.environ.get("VERCEL_REUSE_BLOBS") == "1":
        uploaded_files = [
            (rel, hashlib.sha1(path.read_bytes()).hexdigest()) for rel, path in files
        ]
        print("  reusing content-addressed blobs")
    else:
        with ThreadPoolExecutor(
            max_workers=int(os.environ.get("VERCEL_UPLOAD_WORKERS", "8"))
        ) as pool:
            pending = {
                pool.submit(upload_file, path): rel
                for rel, path in files
            }
            for future in as_completed(pending):
                rel = pending[future]
                try:
                    digest = future.result()
                    uploaded_files.append((rel, digest))
                    uploaded += 1
                    if uploaded % 50 == 0:
                        print(f"  uploaded {uploaded}/{len(files)}")
                except FileNotFoundError:
                    print(f"  skipped transient file: {rel}")
                except Exception as exc:
                    print(f"FAIL upload {rel}: {exc}", file=sys.stderr)
                    for task in pending:
                        task.cancel()
                    sys.exit(1)

    deployment_payload = {
        "name": PROJECT_NAME,
        "files": [{"file": rel, "sha": digest} for rel, digest in uploaded_files],
        "projectSettings": {
            "framework": "nextjs",
            "buildCommand": os.environ.get(
                "VERCEL_BUILD_COMMAND", "prisma generate && next build"
            ),
            "installCommand": os.environ.get(
                "VERCEL_INSTALL_COMMAND", "pnpm install"
            ),
            "nodeVersion": os.environ.get("VERCEL_NODE_VERSION", "22.x"),
            **(
                {"serverlessFunctionRegion": os.environ["VERCEL_FUNCTION_REGION"]}
                if os.environ.get("VERCEL_FUNCTION_REGION")
                else {}
            ),
        },
    }
    target = os.environ.get("VERCEL_TARGET", "production")
    if target in {"preview", ""}:
        pass
    elif target:
        deployment_payload["target"] = target

    try:
        deployment = api(
            "POST",
            f"/v13/deployments?teamId={TEAM_ID}",
            deployment_payload,
        )
    except urllib.error.HTTPError as exc:
        if os.environ.get("VERCEL_REUSE_BLOBS") != "1":
            raise
        detail = json.loads(getattr(exc, "vercel_detail", "{}"))
        missing = set(detail.get("error", {}).get("missing", []))
        if not missing:
            raise
        print(f"Uploading {len(missing)} missing blobs...")
        for rel, path in files:
            digest = hashlib.sha1(path.read_bytes()).hexdigest()
            if digest in missing:
                upload_file(path)
        deployment = api(
            "POST",
            f"/v13/deployments?teamId={TEAM_ID}",
            deployment_payload,
        )

    dep_id = deployment["id"]
    print(f"Deployment created: {dep_id}")
    print(f"Preview: https://{deployment.get('url')}")

    for i in range(90):
        time.sleep(15)
        status = api("GET", f"/v13/deployments/{dep_id}?teamId={TEAM_ID}")
        state = status.get("readyState")
        print(f"[{i+1}] {state}")
        if state == "READY":
            alias = (status.get("alias") or [status.get("url")])[0]
            print(f"\nProduction: https://{alias}")
            return
        if state in ("ERROR", "CANCELED"):
            print(json.dumps(status, indent=2)[:4000])
            sys.exit(1)

    sys.exit(1)


if __name__ == "__main__":
    main()
