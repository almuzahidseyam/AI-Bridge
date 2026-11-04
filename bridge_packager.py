"""Create a reviewable local context archive. No uploads and no third-party dependencies."""
from __future__ import annotations

import argparse
from dataclasses import dataclass
from fnmatch import fnmatchcase
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import stat
import sys
import tempfile
import zipfile

MAX_FILE = 1024 * 1024
MAX_TOTAL = 10 * 1024 * 1024
MAX_FILES = 1000
IGNORED = {"node_modules", "dist", "build", "venv", "__pycache__", "coverage", "target", "vendor", "ai_bridge_staging"}
TEXT_SUFFIXES = {".py", ".js", ".ts", ".jsx", ".tsx", ".mjs", ".cjs", ".html", ".css", ".scss", ".md", ".txt", ".json", ".yaml", ".yml", ".toml", ".ini", ".cfg", ".c", ".h", ".cpp", ".hpp", ".java", ".cs", ".rs", ".go", ".php", ".sql", ".sh", ".ps1", ".xml", ".vue", ".svelte", ".dart"}
TEXT_NAMES = {"dockerfile", "makefile", "license", "requirements.txt"}
SENSITIVE_NAME = re.compile(r"(^|[._-])(credentials?|secrets?|tokens?|passwords?|id_rsa|id_ed25519)([._-]|$)", re.I)
# Deliberately limited indicators, not a promise to detect all secrets.
SECRET = re.compile(rb"-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----|\bAKIA[0-9A-Z]{16}\b|\bgh[pousr]_[A-Za-z0-9]{20,}\b|\bAIza[A-Za-z0-9_-]{30,}\b")


@dataclass(frozen=True)
class Entry:
    name: str
    data: bytes


@dataclass
class Plan:
    root: Path
    entries: list[Entry]
    skipped: list[dict[str, str]]

    def manifest(self):
        return {"format": 1, "notice": "Review every included file before sharing. Filters do not guarantee secret removal.",
                "files": [{"path": e.name, "bytes": len(e.data), "sha256": hashlib.sha256(e.data).hexdigest()} for e in self.entries],
                "total_bytes": sum(len(e.data) for e in self.entries)}


def blocked_name(path: Path) -> bool:
    return any(p.startswith(".") or p.lower() in IGNORED or bool(SENSITIVE_NAME.search(p)) for p in path.parts)


def linked(path: Path) -> bool:
    return path.is_symlink() or (hasattr(path, "is_junction") and path.is_junction())


def read_snapshot(path: Path, root: Path) -> bytes:
    """Reject links and obvious concurrent replacements before taking a bounded snapshot."""
    if linked(path) or not path.resolve().is_relative_to(root):
        raise ValueError("Linked or external path")
    for parent in path.parents:
        if linked(parent):
            raise ValueError("Linked parent")
        # Windows TEMP may use an 8.3 alias (RUNNER~1); compare canonical paths.
        if parent.resolve() == root:
            break
    else:
        raise ValueError("No matching workspace boundary")
    before = path.lstat()
    if not stat.S_ISREG(before.st_mode) or before.st_nlink != 1:
        raise ValueError("Not a regular single-link file")
    if before.st_size > MAX_FILE:
        raise ValueError("File exceeds 1 MiB")
    flags = os.O_RDONLY | getattr(os, "O_BINARY", 0) | getattr(os, "O_NOFOLLOW", 0)
    with os.fdopen(os.open(path, flags), "rb") as handle:
        opened = os.fstat(handle.fileno())
        if (before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns) != (opened.st_dev, opened.st_ino, opened.st_size, opened.st_mtime_ns):
            raise ValueError("File changed while reading")
        data = handle.read(MAX_FILE + 1)
        after = os.fstat(handle.fileno())
        if len(data) > MAX_FILE or (opened.st_size, opened.st_mtime_ns) != (after.st_size, after.st_mtime_ns):
            raise ValueError("File changed or exceeded size limit")
    try:
        data.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise ValueError("Not UTF-8 text") from exc
    if b"\0" in data or SECRET.search(data):
        raise ValueError("Binary data or a recognized credential pattern")
    return data


def plan_package(workspace_dir=".", history_file="", memory_file="", exclude=()) -> Plan:
    raw_root = Path(workspace_dir).absolute()
    if linked(raw_root):
        raise ValueError("Workspace itself must not be a symlink or junction")
    root = raw_root.resolve(strict=True)
    if not root.is_dir():
        raise ValueError("Workspace must be a directory")
    entries: list[Entry] = []
    skipped: list[dict[str, str]] = []
    total = 0

    def add(path: Path, relative: Path, archive_name: str, boundary: Path, explicit=False):
        nonlocal total
        reason = None
        if blocked_name(relative):
            reason = "Excluded name"
        elif not (path.suffix.lower() in TEXT_SUFFIXES or path.name.lower() in TEXT_NAMES):
            reason = "Not an allowed text format"
        if reason:
            if explicit:
                raise ValueError(f"Explicit context file rejected: {reason}")
            skipped.append({"path": relative.as_posix(), "reason": reason})
            return
        try:
            data = read_snapshot(path, boundary)
        except (OSError, ValueError) as exc:
            if explicit:
                raise ValueError("Explicit context file is unreadable, linked, oversized, binary or contains a recognized credential") from exc
            skipped.append({"path": relative.as_posix(), "reason": "Unreadable, linked, changed, oversized, binary or recognized credential"})
            return
        if len(entries) >= MAX_FILES or total + len(data) > MAX_TOTAL:
            raise ValueError("Package exceeds 1000 files or 10 MiB. Narrow the workspace or add --exclude patterns.")
        entries.append(Entry(archive_name, data))
        total += len(data)

    def walk_error(error):
        raise ValueError("A workspace directory could not be read; no package was created") from error

    for current, dirs, files in os.walk(root, followlinks=False, onerror=walk_error):
        parent = Path(current)
        for name in sorted(dirs[:]):
            path = parent / name
            rel = path.relative_to(root)
            if linked(path) or blocked_name(rel) or any(fnmatchcase(rel.as_posix(), pattern) for pattern in exclude):
                dirs.remove(name)
                skipped.append({"path": rel.as_posix() + "/", "reason": "Excluded or linked directory"})
        dirs.sort()
        for name in sorted(files):
            path = parent / name
            rel = path.relative_to(root)
            if any(fnmatchcase(rel.as_posix(), pattern) for pattern in exclude):
                skipped.append({"path": rel.as_posix(), "reason": "User exclusion"})
                continue
            add(path, rel, "workspace/" + rel.as_posix(), root)
    for source, destination in [(history_file, "context/chat_history.txt"), (memory_file, "context/memory.md")]:
        if source:
            path = Path(source).absolute()
            # Context is explicitly selected but still subject to the same limits and filters.
            add(path, Path(path.name), destination, path.parent.resolve(), explicit=True)
    return Plan(root, entries, skipped)


def write_package(plan: Plan, output_zip) -> Path:
    output = Path(output_zip).absolute()
    if output.exists() or output.is_symlink():
        raise ValueError("Output already exists; choose a new filename")
    if not output.parent.is_dir():
        raise ValueError("Output parent directory does not exist")
    # Never stage inside the workspace, even if the OS temp directory is inside it.
    temporary_parent = Path(tempfile.gettempdir()).resolve()
    if temporary_parent.is_relative_to(plan.root):
        temporary_parent = output.parent.resolve()
    if temporary_parent.is_relative_to(plan.root):
        raise ValueError("Choose an output directory outside the workspace so staging can remain outside it")
    with tempfile.TemporaryDirectory(prefix="ai-bridge-", dir=temporary_parent) as stage:
        archive = Path(stage) / "package.zip"
        with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as zipped:
            for entry in plan.entries:
                zipped.writestr(entry.name, entry.data)
            zipped.writestr("manifest.json", json.dumps(plan.manifest(), indent=2))
            zipped.writestr("00_READ_ME_FIRST.md", (Path(__file__).parent / "bootstrap_prompt.md").read_bytes())
        created = False
        try:
            with output.open("xb") as dest, archive.open("rb") as source:
                created = True
                shutil.copyfileobj(source, dest)
        except BaseException:
            if created:
                output.unlink(missing_ok=True)
            raise
    return output


def create_bridge_package(workspace_dir, history_file, memory_file, output_zip):
    """Programmatic explicit creation; CLI defaults to preview only."""
    return write_package(plan_package(workspace_dir, history_file, memory_file), output_zip)


def main(argv=None):
    parser = argparse.ArgumentParser(description="Preview a local context package. Nothing is uploaded.")
    parser.add_argument("--workspace", default=".")
    parser.add_argument("--history", default="")
    parser.add_argument("--memory", default="")
    parser.add_argument("--output", default="AI_Bridge_Export.zip")
    parser.add_argument("--exclude", action="append", default=[], help="Workspace-relative glob; repeat as needed")
    parser.add_argument("--create", action="store_true", help="Create after printing the included-file preview")
    args = parser.parse_args(argv)
    try:
        plan = plan_package(args.workspace, args.history, args.memory, args.exclude)
        print(json.dumps({**plan.manifest(), "skipped": plan.skipped}, indent=2, ensure_ascii=True))
        if args.create:
            print(f"Created locally: {write_package(plan, args.output)}")
        else:
            print("Preview only. Review the listed files, then rerun with --create. No filter can guarantee secret removal.")
        return 0
    except (OSError, ValueError, zipfile.BadZipFile) as exc:
        print(f"Package not created: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
