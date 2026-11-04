import contextlib
import io
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import zipfile

import bridge_packager as bridge


class PackageTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="bridge-tests-")
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.root = self.base / "workspace"
        self.root.mkdir()
        (self.root / "app.py").write_text("print('hello')", encoding="utf-8")

    def write(self, name, data=b"private"):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return path

    def test_nested_hidden_sensitive_names_binary_and_generated_files_excluded(self):
        for name in [".env", ".git/config", "nested/.env.local", "nested/.git/config", "node_modules/module.js", "ai_bridge_staging/a.py", "credentials.json", "nested/private-key.pem", "photo.png", "bad.txt"]:
            self.write(name, b"\0binary" if name == "bad.txt" else b"hidden")
        plan = bridge.plan_package(self.root)
        self.assertEqual([e.name for e in plan.entries], ["workspace/app.py"])
        self.assertEqual(len(plan.skipped), 10)

    def test_recognized_secret_content_excluded_without_echoing_value(self):
        self.write("configuration.py", b"key = 'ghp_" + b"a" * 36 + b"'")
        plan = bridge.plan_package(self.root)
        self.assertEqual(len(plan.entries), 1)
        self.assertNotIn("ghp_", json.dumps(plan.skipped))

    def test_default_dot_does_not_recurse_or_delete_existing_staging(self):
        marker = self.write("ai_bridge_staging/keep.txt")
        old = Path.cwd()
        try:
            os.chdir(self.root)
            output = bridge.create_bridge_package(".", "", "", "result.zip")
        finally:
            os.chdir(old)
        self.assertTrue(marker.exists())
        with zipfile.ZipFile(output) as archive:
            self.assertEqual(set(archive.namelist()), {"workspace/app.py", "manifest.json", "00_READ_ME_FIRST.md"})
        self.assertEqual(len(bridge.plan_package(self.root).entries), 1)

    def test_preview_creates_no_output_and_create_is_explicit(self):
        output = self.base / "export.zip"
        with contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(bridge.main(["--workspace", str(self.root), "--output", str(output)]), 0)
            self.assertFalse(output.exists())
            self.assertEqual(bridge.main(["--workspace", str(self.root), "--output", str(output), "--create"]), 0)
        self.assertTrue(output.exists())

    def test_existing_output_never_overwritten(self):
        output = self.base / "result.zip"
        output.write_bytes(b"original")
        with self.assertRaises(ValueError):
            bridge.write_package(bridge.plan_package(self.root), output)
        self.assertEqual(output.read_bytes(), b"original")

    def test_plan_snapshots_are_immutable_and_manifest_matches(self):
        plan = bridge.plan_package(self.root)
        (self.root / "app.py").write_text("changed", encoding="utf-8")
        output = bridge.write_package(plan, self.base / "result.zip")
        with zipfile.ZipFile(output) as archive:
            self.assertEqual(archive.read("workspace/app.py"), b"print('hello')")
            manifest = json.loads(archive.read("manifest.json"))
            self.assertEqual(manifest["files"][0]["sha256"], bridge.hashlib.sha256(b"print('hello')").hexdigest())

    def test_explicit_context_must_exist_and_pass_same_filters(self):
        for path in [self.base / "missing.txt", self.write(".env"), self.write("private.txt", b"-----BEGIN PRIVATE KEY-----")]:
            with self.assertRaises((ValueError, OSError)):
                bridge.plan_package(self.root, history_file=path)
        history = self.base / "history.txt"
        history.write_text("review me", encoding="utf-8")
        plan = bridge.plan_package(self.root, history_file=history)
        self.assertIn("context/chat_history.txt", [e.name for e in plan.entries])

    def test_user_excludes_and_total_budget(self):
        self.write("nested/skip.py", b"hello")
        self.assertEqual(len(bridge.plan_package(self.root, exclude=["nested"]).entries), 1)
        with patch.object(bridge, "MAX_TOTAL", 2), self.assertRaises(ValueError):
            bridge.plan_package(self.root)
        with patch.object(bridge, "MAX_FILES", 1), self.assertRaises(ValueError):
            bridge.plan_package(self.root)

    def test_per_file_budget_and_utf8_only(self):
        self.write("big.txt", b"a" * (bridge.MAX_FILE + 1))
        self.write("utf16.txt", "hello".encode("utf-16"))
        self.assertEqual(len(bridge.plan_package(self.root).entries), 1)

    def test_symlinks_and_hardlinks_not_exported(self):
        outside = self.base / "private.txt"
        outside.write_text("external", encoding="utf-8")
        os.link(outside, self.root / "hardlink.txt")
        try:
            (self.root / "link.txt").symlink_to(outside)
            (self.root / "linked-dir").symlink_to(self.base, target_is_directory=True)
        except OSError:
            pass  # Windows without symlink privilege still verifies hardlink rejection.
        self.assertEqual([e.name for e in bridge.plan_package(self.root).entries], ["workspace/app.py"])

    def test_temp_inside_workspace_uses_external_output_parent(self):
        with patch.object(bridge.tempfile, "gettempdir", return_value=str(self.root)):
            plan = bridge.plan_package(self.root)
            with self.assertRaises(ValueError):
                bridge.write_package(plan, self.root / "bad.zip")
            self.assertTrue(bridge.write_package(plan, self.base / "good.zip").exists())

    def test_bootstrap_is_resolved_relative_to_script(self):
        output = bridge.write_package(bridge.plan_package(self.root), self.base / "result.zip")
        with zipfile.ZipFile(output) as archive:
            self.assertIn(b"reference material", archive.read("00_READ_ME_FIRST.md"))


if __name__ == "__main__":
    unittest.main()
