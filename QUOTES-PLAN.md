# Plan: Personal Quotes App

## Context
Build a small, private quotes journal for saving and finding quotes in one browser. Requirements were refined with the user before planning: keep it dependency-free and static, avoid accounts or syncing, and include only the agreed capture, retrieval, theme, and backup features. Put the app in `quotes-app/` so the existing root `PLAN.md` and even/odd checker work remain untouched.

## Scope and decisions
- One self-contained `quotes-app/index.html` with embedded HTML, CSS, and JavaScript; no framework, build tools, or external assets.
- Serve from one fixed localhost origin so browser `localStorage` is stable. Data remains tied to that browser profile; JSON export is the backup/migration path. Local storage and exported files are not encrypted.
- Store plain multiline quote text, optional author, favorite status, stable ID, and creation/update timestamps. Start with an empty collection.
- Add, edit, and delete quotes. Deletion has a brief, accessible Undo opportunity. Reject duplicate text+author pairs after trimming, collapsing whitespace, and ignoring case; allow the same wording with a different author.
- Search both quote text and author, filter favorites, show newest first, and select a random quote from the full collection into a featured card. Handle empty search/library states clearly.
- Include a light/dark toggle. Always use light on a fresh first visit; persist a later manual choice.
- Export/import versioned JSON only. Import merges, deduplicates using the same normalized text+author rule, preserves favorite status if either copy is favorited, and rejects an invalid file wholly without changing the collection.
- Exclude accounts, cloud sync, tags, sharing, rich-text formatting, sample data, and extra sort modes.

## Implementation approach
Implement the app in `quotes-app/index.html`:

1. Create a semantic, responsive reading-journal interface: header/theme control, featured-random quote, labeled add/edit form, search and favorites controls, quote list, import/export controls, and polite status/Undo announcements. Use accessible labels, visible focus states, sufficient contrast, and mobile-friendly targets.
2. Keep quote state in a small set of plain JavaScript functions: load/save, validate, normalize duplicate keys, add/update/delete/undo, filter/sort, select random, and import/export. Render user-provided text only as text (for example, `textContent`), never as HTML.
3. Persist quote data and theme separately in `localStorage`. Detect unavailable storage and malformed saved data; report the problem rather than claiming data was saved or silently overwriting potentially recoverable data. Only show success after a write succeeds.
4. Validate all imported JSON records before applying any changes. Build the merged result first, preserve existing records on duplicate matches (except OR-ing favorite state), deduplicate within the imported file, and write the final collection as one storage update so rejected imports cannot partially modify data.
5. Provide a localhost launch instruction (for example, Python’s built-in static server, if available) without adding project dependencies or touching root files.

## Verification
- Launch the app from `quotes-app/` at the same localhost address on each use; verify first launch is empty and light.
- Exercise add/edit/delete/Undo, optional author, multiline text, validation, duplicate checks (case/whitespace variants, different authors), favorite toggling, search over text and author, favorites filtering, newest-first order, random selection from all quotes, and empty states.
- Refresh and reopen at the same origin to confirm quote and theme persistence; confirm the theme toggle works while a fresh profile starts light.
- Export JSON and inspect its contents; re-import it and verify merge behavior, duplicate/favorite preservation, and no data loss. Try malformed JSON and invalid records and verify the collection is unchanged. Test import collisions and duplicate records within the backup.
- Check keyboard-only use, focus visibility and restoration, live announcements, responsive layout at phone and desktop widths, and safe display of quote strings containing HTML-like text. Confirm localStorage failures are surfaced without false success or silent data replacement.
- Leave the root even/odd plan and all non-quotes-app files unchanged.