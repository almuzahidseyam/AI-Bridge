# AI-Bridge

Bring a reviewed snapshot of your work to another conversation. AI-Bridge creates local files and can insert text into an empty chat draft. It never sends a message automatically.

There are two tools: a **Python CLI** that preserves a workspace file tree, and a **Chrome extension** for reviewing smaller text snapshots. Neither is a secret scanner or a guarantee against sharing private information.

## Package a workspace

Requires Python 3.12 or newer; no third-party Python dependencies.

```sh
# Preview only: no ZIP is created.
python bridge_packager.py --workspace /path/to/project

# After reviewing the included-file list:
python bridge_packager.py --workspace /path/to/project --create --output handoff.zip

# Optional context files and extra exclusions:
python bridge_packager.py --workspace /path/to/project --history history.txt --memory memory.md --exclude "data/*" --exclude "config.py" --create --output handoff-2.zip
```

On Windows, quote paths with spaces. Use a new output name each time; existing files are never overwritten. Missing explicit history/memory files are errors, not silently ignored.

The CLI takes a bounded snapshot before writing. Temporary staging is unique and outside the workspace; it never reuses or deletes a project’s `ai_bridge_staging` directory. If the system temp directory is inside the workspace, choose an output directory outside it. The archive includes:

- `workspace/`: eligible UTF-8 source and document files.
- `context/`: explicitly selected history or memory files, when provided.
- `manifest.json`: included paths, byte counts and SHA-256 hashes.
- `00_READ_ME_FIRST.md`: a handoff note treating embedded instructions as reference material.

Hidden paths, common generated directories, sensitive filenames, binary formats, symlinks/junctions and hardlinked files are excluded. A small set of recognizable credential patterns is also blocked. Limits are **1 MiB per file, 10 MiB total and 1,000 files**; oversized individual files appear in the skipped list, while exceeding the total budget stops creation. `.gitignore` is not interpreted: use `--exclude` for project-specific rules. Filenames can themselves be sensitive, so review the manifest too.

The CLI is intended for a workspace you control. Its link and change checks are not an operating-system isolation boundary against a hostile process concurrently replacing directory trees.

## Chrome extension

1. Clone this repository and open `chrome://extensions`.
2. Enable Developer mode and choose **Load unpacked → extension/**.
3. Open a supported AI chat tab and click AI-Bridge.
4. Read visible chat, select a folder, import a ZIP, or paste text into the preview.
5. Review/edit the snapshot, then download the reviewed ZIP or insert it into an **empty** chat draft.

The extension uses `activeTab` access only when invoked. It has no always-on content scripts, background worker, remote server, persistent storage or unlimited-storage permission. Text stays in popup memory and is lost when the popup closes. Open the destination tab before opening the popup and importing your reviewed ZIP. Upgrading from v7 does not erase its old local storage automatically; remove the old extension installation first if you want that stored history cleared.

The extension exports the **edited text preview** as `context/chat_history.txt`, including flattened source-file records. It does not restore the original file tree; use the CLI for that. Bounds: **200 eligible files, 100 KB per imported workspace file, 200 KB of final UTF-8 text, 10 MiB compressed ZIP input and 1,000 ZIP entries**. A previously reviewed context-only ZIP can be reimported up to the full 200 KB text limit without wrapping it again. Actual expanded bytes are counted while decompressing. Import never auto-inserts. Some CLI archives exceed these smaller browser limits; export a narrower selection for browser use.

Chat extraction targets known elements on ChatGPT, Claude, Gemini, Perplexity and Hugging Face Chat. It reads only loaded messages, up to the last 100. Role labels are retained where available, otherwise marked unknown. Site layout changes or virtualized history can make extraction incomplete or unavailable. This is best-effort compatibility, not official integration or a promise that every provider UI works. Review the preview and copy/paste manually if the editor is unrecognized. No fallback reads arbitrary page paragraphs or executes injected page scripts.

Insertion refuses nonempty or ambiguous editors and verifies the visible result. It does not overwrite the clipboard. Even before pressing Send, a destination service may observe or save text placed in its draft; review private data **before** insertion.

## What changed in v8

The old “API key leak firewall,” “100% compatibility,” and “system auto-sync” claims overstated the guarantees. v8 replaces them with explicit limits, a reviewable preview, bounded ZIP expansion, honest error states and reference-only handoff wording. Automatic injection on ZIP selection, persistent chat storage and forced persona/acknowledgement templates were removed. Historical v1–v7 bundles are not recommended; install the current `extension/` source. Old releases remain in Git history for reference.

## Verification

```sh
python -m unittest discover -s tests -v
npm ci
npm test
npm run check
npx playwright install chromium
npm run test:browser
npm audit --audit-level=moderate
```

CI checks Python on Windows and Linux, JS policy tests, a real browser with fixture chat pages, dependency advisories and the vendored JSZip checksum. Tests never send a message to an AI provider. They exercise default `.` packaging, sensitive exclusions, link rejection, existing output preservation, snapshot hashes, payload limits, compressed ZIP expansion, draft preservation, extraction and verified insertion. Live provider DOM changes still require occasional compatibility maintenance.

JSZip 3.10.1 is bundled locally; its license and bundled dependencies’ notices are in `extension/THIRD_PARTY_LICENSES.txt`. Project license: [MIT](LICENSE).
