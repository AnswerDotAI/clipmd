# Clipboard to Markdown (Chrome Extension)

Converts HTML in your clipboard to Markdown (fenced code blocks) using [Turndown](https://github.com/mixmark-io/turndown), then copies the result back to the clipboard.

## Install

- Grab the [.zip from `dist/`](https://github.com/AnswerDotAI/clipmd/raw/refs/heads/main/dist/clipmd-1.0.1.zip), and unzip it
- Then in Chrome, open `chrome://extensions`, enable Developer Mode, click **Load unpacked**, and select the unzipped folder.

## Use

- Copy some HTML (e.g., from a web page or rich-text editor).
- Click the extension toolbar icon (or press `Ctrl+Shift+M`); the popup flashes briefly while Markdown replaces your clipboard contents.

## Notes

- Permissions `clipboardRead`/`clipboardWrite` are used to access the clipboard from the popup action.
- Turndown is bundled locally (`turndown.js`) and runs with `codeBlockStyle: "fenced"`. If no HTML flavor is present, it falls back to plain text.

## Packaging

- Run `./scripts/build.sh` to bump the version (default: patch), stage assets in `dist/`, and produce a ZIP. If Chrome/Chromium is available locally, it also creates a CRX (set `KEY_PATH` to reuse a signing key).
- GitHub Actions workflow `Build Release` (`workflow_dispatch`) builds the ZIP and publishes a tagged release; CRX creation is local-only.

## Credits

`turndown.js` is from [Turndown](https://github.com/mixmark-io/turndown) and is Copyright (c) 2017 Dom Christie under the MIT license.
