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
from pathlib import Path

TOKEN = os.environ["VERCEL_TOKEN"]
TEAM_ID = os.environ.get("VERCEL_TEAM_ID", "team_XvdeejTJMqlLFFaRhoG1E13Y")
PROJECT_NAME = os.environ.get("VERCEL_PROJECT", "brand-wars")
ROOT = Path(__file__).resolve().parents[1]

SKIP_DIRS = {".git", ".next", "node_modules", ".vercel", "test-results", "playwright-report", ".jules"}
SKIP_FILES = {".env", ".env.local"}


def sha1_file(path: Path) -> str:
    h = hashlib.sha1()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def collect_files() -> list[tuple[str, Path, str]]:
    out: list[tuple[str, Path, str]] = []
    for path in ROOT.rglob("*"):
        if not path.is_file():
            continue
        rel = path.relative_to(ROOT).as_posix()
        if any(part in SKIP_DIRS for part in rel.split("/")):
            continue
        if path.name in SKIP_FILES:
            continue
        out.append((rel, path, sha1_file(path)))
    return out


def upload_file(digest: str, path: Path) -> None:
    url = f"https://api.vercel.com/v2/files?teamId={TEAM_ID}"
    data = path.read_bytes()
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
            pass
    except urllib.error.HTTPError as e:
        if e.code in (409, 200):
            return
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
    with urllib.request.urlopen(req, timeout=120) as resp:
        return json.load(resp)


def main() -> None:
    files = collect_files()
    print(f"Files: {len(files)}")

    digests = {digest for _, _, digest in files}
    print(f"Uploading {len(digests)} unique blobs...")
    uploaded = 0
    for rel, path, digest in files:
        try:
            upload_file(digest, path)
            uploaded += 1
            if uploaded % 50 == 0:
                print(f"  uploaded {uploaded}/{len(files)}")
        except Exception as exc:
            print(f"FAIL upload {rel}: {exc}", file=sys.stderr)
            sys.exit(1)

    deployment = api(
        "POST",
        f"/v13/deployments?teamId={TEAM_ID}",
        {
            "name": PROJECT_NAME,
            "target": "production",
            "files": [{"file": rel, "sha": digest} for rel, _, digest in files],
            "projectSettings": {
                "framework": "nextjs",
                "buildCommand": "prisma generate && next build",
                "installCommand": "pnpm install",
                "nodeVersion": "22.x",
            },
        },
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
