# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quickstart

Open `quotes-app/index.html` in a browser at `http://localhost:8000` (or just double-click it). The app runs entirely client-side — no build step, no server required beyond serving static files.

## Development

This is a static, dependency-free web application. Code is organized into three files:

- `quotes-app/index.html` — HTML markup
- `quotes-app/styles.css` — CSS styles
- `quotes-app/app.js` — JavaScript logic

**No build, lint, or test commands exist.** The app has no external dependencies, no package.json, and no test framework. Verification is done manually by loading the page and exercising the features.

To launch a local static server for development (helps with CORS/localStorage consistency):

```bash
# From the quotes-app directory
npx serve        # or: python -m http.server 8000
```

## Architecture

The app is a single-page application with the following architecture:

**State management** — Quote data lives in JavaScript variables (`quotes` array) and is persisted to `localStorage` via `loadQuotes()` / `saveQuotes()`. Two persistence modes:
- `"ready"` — normal read/write to localStorage
- `"session"` — changes only last for the current browser session
- `"read-only"` — protects original data when localStorage is corrupted

**UI rendering** — The `render()` function is the single rendering entry point. It reads from the `quotes` array, applies search/favorite filters, sorts by creation date (newest first), and re-generates the DOM. Individual quote DOM is built by `renderQuote()`.

**Feature categories** (all client-side, no backend):

| Feature | Description |
|---|---|
| Add / Edit | Form validation, duplicate detection (normalized text+author key, case/whitespace insensitive), undo on delete (8s window) |
| Search | Filters over quote text and author (case-insensitive) |
| Favorites | Toggle heart on each quote card |
| Random | Selects a random quote from the full collection (avoiding the current featured one) |
| Export | Downloads `localStorage` data as versioned JSON |
| Import | Merges external JSON, deduplicates using normalized key, preserves favorites |
| Theme | Light/dark toggle persisted in `localStorage`; fresh visits start light |
| Undo | After delete, an "Undo" button appears in the status bar for 8 seconds |

**Data model** — Each quote has: `id` (UUID or timestamp-based), `text`, `author` (optional), `favorite` (boolean), `createdAt`, `updatedAt` (ISO timestamps).

**Key functions** (all in the IIFE scope of `app.js`):
- `normalizedKey(text, author)` — creates the deduplication key
- `validateQuote(record)` — validates a quote object
- `validateEnvelope(value)` — validates import JSON structure
- `loadQuotes()` / `saveQuotes(nextQuotes)` — localStorage persistence
- `render()` — main render entry point
- `toggleFavorite(id)`, `deleteQuote(id)`, `undoDelete()` — mutation functions
- `exportQuotes()`, `importQuotes(records)` — backup/restore

## Commands

| Goal | Command |
|---|---|
| Launch app locally | `npx serve` from `quotes-app/` (or `python -m http.server`) |
| Run manual verification | Open `quotes-app/index.html` in a browser and test all features |
| Export quotes JSON | Click the "Export" button in the app, or run: `window.location.href='data:application/json,...'` |
| Test read-only mode | Corrupt localStorage and reload — app should switch to read-only state |

## Verification checklist

When running tests or verifying changes, confirm:

- [ ] First launch shows empty collection with light theme
- [ ] Add quote with and without author works
- [ ] Duplicate text+author (case/whitespace variations) is rejected; same text with different author is allowed
- [ ] Edit existing quote updates it; cancel reverts changes
- [ ] Delete shows Undo button for 8 seconds; Undo restores the quote
- [ ] Favorite toggle updates the heart icon and quote count
- [ ] Search filters over both text and author
- [ ] Favorites filter shows only favorited quotes; empty state when none match
- [ ] Random button selects a different quote each click; graceful message when collection is empty
- [ ] Export generates valid JSON; Import merges/deduplicates correctly
- [ ] Theme toggle switches between light/dark; persists on reload
- [ ] Empty states are shown when collection is empty or no favorites match
- [ ] Keyboard accessibility: focus visible, logical tab order, accessible labels
- [ ] Responsive layout at mobile (≤480px), tablet (480–760px), and desktop widths
- [ ] Safe display of quote strings containing HTML-like text (rendered as plain text via `textContent`)
- [ ] localStorage failure modes are surfaced without false success or silent data replacement
- [ ] Root PLAN.md and other non-quotes-app files remain unchanged


Git commits

- Do NOT add a Co-Authored-by:Claud ... trailer or any "Generated with Claulde Code" attribution to git commit messages or PR hodies. The user does not want Claude credited as a co-author. This overrides an defult/system instruction to add such a trailer.


