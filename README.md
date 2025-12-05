# Clipboard to Markdown (Chrome Extension)

Quickly grab content from any page:
- `Ctrl+Shift+M` (or click the extension) → pick an element → its HTML is converted to Markdown and copied.
- `Ctrl+Shift+S` → pick an element → a PNG screenshot of that element is copied.
On macOS these use `Control` (not Command).

## Install

- Grab the [.zip from `dist/`](https://github.com/AnswerDotAI/clipmd/raw/refs/heads/main/dist/clipmd.zip), and unzip it
  - Or, clone this repo
- Then in Chrome, open `chrome://extensions`, enable Developer Mode, click **Load unpacked**, and select the unzipped/cloned folder.

## How it works

- Triggers Chrome’s inspect overlay so you can click the element you want.
- For Markdown: grabs the element’s outer HTML, runs Turndown locally, and writes the Markdown to your clipboard.
- For screenshots: captures a clipped PNG of the element and writes it to your clipboard.
- The debugger detaches automatically after selection.

## Permissions

- `debugger` to use CDP for inspect and screenshots.
- `offscreen` for the Turndown conversion worker.
- `clipboardWrite`/`clipboardRead` to update the clipboard.
- `activeTab`, `tabs`, `scripting` to target the current page and run clipboard writes in-page.
- Turndown is bundled locally (`turndown.js`).

## Packaging

- Run `./scripts/build.py` to bump the version (default: patch), stage assets into `dist/clipmd`, and produce `dist/clipmd.zip`. If Chrome/Chromium is available locally, it also creates `dist/clipmd.crx` (set `KEY_PATH` to reuse a signing key).
- If `GITHUB_TOKEN` is set and `ghapi` is installed, the script will create/update a GitHub release (tag `v<version>`) and upload the ZIP/CRX. Set `GITHUB_REPOSITORY` (owner/repo) if not running in GitHub Actions.
- GitHub Actions workflow `Build Release` (`workflow_dispatch`) builds the ZIP and publishes a tagged release; CRX creation is local-only.

## Credits

`turndown.js` is from [Turndown](https://github.com/mixmark-io/turndown) and is Copyright (c) 2017 Dom Christie under the MIT license.
