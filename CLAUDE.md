# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ClipMD is a Chrome extension that converts webpage elements to Markdown or captures them as screenshots via keyboard shortcuts (Ctrl+Shift+M for Markdown, Ctrl+Shift+S for screenshots).

## Build

```bash
./scripts/build.py
```

The build script bumps the version (patch by default), creates `dist/clipmd.zip`, and optionally generates a `.crx` file if Chrome is available. Use `BUMP=minor` or `BUMP=major` environment variables to control version bumps.

## Architecture

Chrome Extension Manifest V3 with three main components:

- **background.js** - Service worker that attaches Chrome debugger to tabs, shows the inspection overlay, handles element selection events, and writes results to clipboard
- **offscreen.js** + **offscreen.html** - Isolated context that runs Turndown for HTML-to-Markdown conversion (required because service workers can't access DOM APIs)
- **turndown.js** - Bundled Turndown library for HTML-to-Markdown conversion

Flow: background.js attaches debugger → user clicks element → gets outerHTML via DevTools Protocol → sends to offscreen document for Turndown conversion → writes to clipboard.
