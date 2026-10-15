(() => {
  "use strict";

  const DATA_KEY = "quiet-pages-data-v1";
  const THEME_KEY = "quiet-pages-theme-v1";
  const DATA_VERSION = 1;
  const UNDO_MS = 8000;
  const $ = (id) => document.getElementById(id);
  const elements = {
    body: document.body,
    themeToggle: $("theme-toggle"),
    randomButton: $("random-button"),
    featuredContent: $("featured-content"),
    storageWarning: $("storage-warning"),
    form: $("quote-form"),
    formHeading: $("form-heading"),
    formHint: $("form-hint"),
    text: $("quote-text"),
    author: $("quote-author"),
    category: $("quote-category"),
    submit: $("submit-quote"),
    cancelEdit: $("cancel-edit"),
    search: $("search-input"),
    favoritesFilter: $("favorites-filter"),
    categoryFilter: $("category-filter"),
    count: $("quote-count"),
    list: $("quote-list"),
    exportButton: $("export-button"),
    importFile: $("import-file"),
    importLabel: $("import-label"),
    status: $("status")
  };

  let quotes = [];
  let editingId = null;
  let favoritesOnly = false;
  let categoryFilter = "";
  let persistence = "ready";
  let featuredId = null;
  let undoQuote = null;
  let undoTimer = null;

  function announce(message, isError = false, withUndo = false) {
    elements.status.replaceChildren();
    elements.status.classList.toggle("status-error", isError);
    elements.status.append(document.createTextNode(message));
    if (withUndo) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "undo-button";
      button.textContent = "Undo";
      button.addEventListener("click", undoDelete, { once: true });
      elements.status.append(button);
    }
  }

  function normalizedKey(text, author, category = "") {
    return `${text.trim().replace(/\s+/g, " ").toLowerCase()}\u0000${author.trim().replace(/\s+/g, " ").toLowerCase()}\u0000${category.trim().replace(/\s+/g, " ").toLowerCase()}`;
  }

  function validTimestamp(value) {
    return typeof value === "string" && value.length > 0 && Number.isFinite(Date.parse(value));
  }

  function validateQuote(record) {
    if (!record || typeof record !== "object" || Array.isArray(record)) throw new Error("Each quote must be an object.");
    const { id, text, author, category, favorite, createdAt, updatedAt } = record;
    if (typeof id !== "string" || !id.trim() || id.length > 200) throw new Error("A quote has an invalid ID.");
    if (typeof text !== "string" || !text.trim() || text.length > 10000) throw new Error("Each quote needs text of 1–10,000 characters.");
    if (typeof author !== "string" || author.length > 200) throw new Error("An author must be text of no more than 200 characters.");
    if (typeof category !== "string" || category.length > 100) throw new Error("A category must be text of no more than 100 characters.");
    if (typeof favorite !== "boolean") throw new Error("A quote has an invalid favorite value.");
    if (!validTimestamp(createdAt) || !validTimestamp(updatedAt)) throw new Error("A quote has an invalid timestamp.");
    return { id, text, author, category: category || "", favorite, createdAt, updatedAt };
  }

  function validateEnvelope(value) {
    if (!value || typeof value !== "object" || Array.isArray(value) || value.version !== DATA_VERSION || !Array.isArray(value.quotes)) {
      throw new Error("This file is not a supported Quiet Pages backup.");
    }
    return value.quotes.map(validateQuote);
  }

  function loadQuotes() {
    try {
      const saved = window.localStorage.getItem(DATA_KEY);
      if (saved === null) return;
      quotes = validateEnvelope(JSON.parse(saved));
    } catch (error) {
      if (error instanceof SyntaxError || error instanceof TypeError || error instanceof RangeError || (error && error.message && error.message !== "Failed to read localStorage")) {
        persistence = "read-only";
        elements.storageWarning.hidden = false;
        elements.storageWarning.textContent = "Saved quote data could not be read safely. This journal is read-only so the original browser data is not overwritten. Export and editing are disabled.";
        return;
      }
      persistence = "session";
      elements.storageWarning.hidden = false;
      elements.storageWarning.textContent = "Browser storage is unavailable. Changes can be used for this session only and will not survive closing this page.";
    }
  }

  function loadTheme() {
    try {
      const savedTheme = window.localStorage.getItem(THEME_KEY);
      if (savedTheme === "dark") setTheme("dark", false);
    } catch {
      // Keep the fresh-visit light theme when browser storage cannot be read.
    }
  }

  function setTheme(theme, save = true) {
    const dark = theme === "dark";
    elements.body.dataset.theme = dark ? "dark" : "light";
    elements.themeToggle.setAttribute("aria-pressed", String(dark));
    elements.themeToggle.innerHTML = dark ? "☀ <span>Light mode</span>" : "☾ <span>Dark mode</span>";
    document.querySelector('meta[name="theme-color"]').content = dark ? "#171d19" : "#f6f3ec";
    if (!save) return;
    try {
      window.localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
      announce(`${dark ? "Dark" : "Light"} theme selected.`);
    } catch {
      announce(`${dark ? "Dark" : "Light"} theme selected for this session only; browser storage is unavailable.`, true);
    }
  }

  function setStorageControls() {
    const readOnly = persistence === "read-only";
    for (const control of [elements.text, elements.author, elements.submit, elements.cancelEdit, elements.exportButton, elements.importFile, elements.importLabel]) {
      control.disabled = readOnly;
    }
    elements.randomButton.disabled = readOnly || quotes.length === 0;
  }

  function saveQuotes(nextQuotes) {
    if (persistence === "read-only") {
      announce("The saved data is read-only to protect the original browser data.", true);
      return false;
    }
    if (persistence === "session") {
      quotes = nextQuotes;
      render();
      announce("Updated for this session only; browser storage is unavailable.", true);
      return true;
    }
    try {
      window.localStorage.setItem(DATA_KEY, JSON.stringify({ version: DATA_VERSION, quotes: nextQuotes }));
      quotes = nextQuotes;
      render();
      return true;
    } catch {
      announce("Could not save to browser storage. Your previous saved collection is unchanged.", true);
      return false;
    }
  }

  function makeId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }

  function renderFeatured() {
    elements.featuredContent.replaceChildren();
    const quote = quotes.find((item) => item.id === featuredId);
    if (!quote) {
      const empty = document.createElement("p");
      empty.className = "featured-empty";
      empty.textContent = quotes.length ? "Choose “Surprise me” to revisit a saved line." : "Your first favorite line is waiting to be found.";
      elements.featuredContent.append(empty);
      return;
    }
    const text = document.createElement("blockquote");
    text.className = "featured-quote";
    text.textContent = `“${quote.text}”`;
    elements.featuredContent.append(text);
    if (quote.author) {
      const author = document.createElement("p");
      author.className = "featured-author";
      author.textContent = quote.author;
      elements.featuredContent.append(author);
    }
  }

  function makeEmptyState(title, message) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    const heading = document.createElement("strong");
    heading.textContent = title;
    const copy = document.createElement("span");
    copy.textContent = message;
    empty.append(heading, copy);
    return empty;
  }

  function renderQuote(quote) {
    const card = document.createElement("article");
    card.className = "quote-card";
    const text = document.createElement("p");
    text.className = "quote-card-text";
    text.textContent = `“${quote.text}”`;
    const author = document.createElement("p");
    author.className = "quote-card-author";
    author.textContent = quote.author;

    if (quote.category) {
      const category = document.createElement("span");
      category.className = "quote-card-category";
      category.textContent = quote.category;
      card.append(category);
    }

    const actions = document.createElement("div");
    actions.className = "quote-actions";
    const favorite = document.createElement("button");
    favorite.className = "button button-small button-quiet favorite-button";
    favorite.type = "button";
    favorite.setAttribute("aria-pressed", String(quote.favorite));
    favorite.setAttribute("aria-label", `${quote.favorite ? "Remove from" : "Add to"} favorites: ${quote.text.slice(0, 70)}`);
    favorite.textContent = quote.favorite ? "♥  Favorite" : "♡  Favorite";
    favorite.disabled = persistence === "read-only";
    favorite.addEventListener("click", () => toggleFavorite(quote.id));

    const group = document.createElement("div");
    group.className = "quote-actions-group";
    const edit = document.createElement("button");
    edit.className = "button button-small button-quiet";
    edit.type = "button";
    edit.textContent = "Edit";
    edit.disabled = persistence === "read-only";
    edit.addEventListener("click", () => startEdit(quote.id));
    const remove = document.createElement("button");
    remove.className = "button button-small button-quiet button-danger";
    remove.type = "button";
    remove.textContent = "Delete";
    remove.disabled = persistence === "read-only";
    remove.addEventListener("click", () => deleteQuote(quote.id));
    group.append(edit, remove);
    actions.append(favorite, group);
    card.append(text, author, actions);
    return card;
  }

  function render() {
    const search = elements.search.value.trim().toLowerCase();
    const catFilter = categoryFilter.toLowerCase();
    const visibleQuotes = quotes
      .filter((quote) => {
        const matchesFavorite = !favoritesOnly || quote.favorite;
        const matchesCategory = !catFilter || (quote.category || "").toLowerCase() === catFilter;
        const matchesSearch = !search || `${quote.text}\n${quote.author}\n${quote.category || ""}`.toLowerCase().includes(search);
        return matchesFavorite && matchesCategory && matchesSearch;
      })
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id.localeCompare(a.id));

    // Populate category filter options
    if (elements.categoryFilter) {
      const categories = [...new Set(quotes.map(q => q.category).filter(c => c))].sort();
      const currentValue = elements.categoryFilter.value;
      elements.categoryFilter.innerHTML = '<option value="">All categories</option>';
      for (const cat of categories) {
        const opt = document.createElement("option");
        opt.value = cat;
        opt.textContent = cat;
        elements.categoryFilter.append(opt);
      }
      elements.categoryFilter.value = currentValue;
      elements.categoryFilter.value = categoryFilter;
    }

    elements.count.textContent = `${quotes.length} ${quotes.length === 1 ? "quote" : "quotes"}`;
    elements.favoritesFilter.setAttribute("aria-pressed", String(favoritesOnly));
    elements.list.replaceChildren();
    if (!visibleQuotes.length) {
      if (!quotes.length) elements.list.append(makeEmptyState("A fresh page", "Add a quote to start your collection."));
      else if (favoritesOnly && !search && !catFilter) elements.list.append(makeEmptyState("No favorites yet", "Mark a quote as a favorite and it will appear here."));
      else if (catFilter && !favoritesOnly && !search) elements.list.append(makeEmptyState(`No quotes in “${categoryFilter}”`, "Add a quote with this category or change your filters."));
      else elements.list.append(makeEmptyState("Nothing found", "Try another search or change your filters."));
    } else {
      for (const quote of visibleQuotes) elements.list.append(renderQuote(quote));
    }
    renderFeatured();
    setStorageControls();
  }

  function clearEdit() {
    editingId = null;
    elements.form.reset();
    elements.formHeading.textContent = "Add a quote";
    elements.formHint.textContent = "Save a line worth keeping.";
    elements.submit.textContent = "Save quote";
    elements.cancelEdit.hidden = true;
  }

  function startEdit(id) {
    const quote = quotes.find((item) => item.id === id);
    if (!quote || persistence === "read-only") return;
    editingId = id;
    elements.text.value = quote.text;
    elements.author.value = quote.author;
    if (elements.category) elements.category.value = quote.category || "";
    elements.formHeading.textContent = "Edit quote";
    elements.formHint.textContent = "Make your changes, then save.";
    elements.submit.textContent = "Save changes";
    elements.cancelEdit.hidden = false;
    elements.text.focus();
    announce("Editing quote.");
  }

  function onSubmit(event) {
    event.preventDefault();
    const text = elements.text.value.trim();
    const author = elements.author.value.trim();
    const category = elements.category ? elements.category.value.trim() : "";
    if (!text) {
      elements.text.focus();
      announce("Please enter the quote text before saving.", true);
      return;
    }
    const duplicate = quotes.find((quote) => quote.id !== editingId && normalizedKey(quote.text, quote.author, quote.category || "") === normalizedKey(text, author, category));
    if (duplicate) {
      announce("That quote, author, and category are already in your collection.", true);
      return;
    }
    const now = new Date().toISOString();
    let next;
    if (editingId) {
      next = quotes.map((quote) => quote.id === editingId ? { ...quote, text, author, category, updatedAt: now } : quote);
    } else {
      next = [{ id: makeId(), text, author, category, favorite: false, createdAt: now, updatedAt: now }, ...quotes];
    }
    if (saveQuotes(next)) {
      const wasEditing = Boolean(editingId);
      clearEdit();
      elements.text.focus();
      announce(wasEditing ? "Quote updated." : "Quote saved.");
    }
  }

  function toggleFavorite(id) {
    const next = quotes.map((quote) => quote.id === id ? { ...quote, favorite: !quote.favorite, updatedAt: new Date().toISOString() } : quote);
    if (saveQuotes(next)) announce(next.find((quote) => quote.id === id).favorite ? "Added to favorites." : "Removed from favorites.");
  }

  function deleteQuote(id) {
    const quote = quotes.find((item) => item.id === id);
    if (!quote || !saveQuotes(quotes.filter((item) => item.id !== id))) return;
    if (undoTimer) window.clearTimeout(undoTimer);
    undoQuote = quote;
    announce("Quote deleted. You can undo for 8 seconds.", false, true);
    undoTimer = window.setTimeout(() => {
      undoQuote = null;
      undoTimer = null;
      announce("Undo period ended.");
    }, UNDO_MS);
  }

  function undoDelete() {
    if (!undoQuote) return;
    const quote = undoQuote;
    if (undoTimer) window.clearTimeout(undoTimer);
    undoQuote = null;
    undoTimer = null;
    if (saveQuotes([...quotes, quote])) announce("Quote restored.");
    else undoQuote = quote;
  }

  function pickRandom() {
    if (!quotes.length) {
      announce("Add a quote before choosing a random one.");
      return;
    }
    const choices = quotes.filter((quote) => quote.id !== featuredId);
    const pool = choices.length ? choices : quotes;
    featuredId = pool[Math.floor(Math.random() * pool.length)].id;
    renderFeatured();
    announce("A quote from your collection is featured above.");
  }

  function exportQuotes() {
    if (persistence === "read-only") return;
    const backup = { version: DATA_VERSION, quotes };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `quiet-pages-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    announce(`Exported ${quotes.length} ${quotes.length === 1 ? "quote" : "quotes"} as JSON.`);
  }

  function importQuotes(records) {
    const merged = [...quotes];
    const byKey = new Map(merged.map((quote) => [normalizedKey(quote.text, quote.author, quote.category || ""), quote]));
    const usedIds = new Set(merged.map((quote) => quote.id));
    for (const incoming of records) {
      const key = normalizedKey(incoming.text, incoming.author, incoming.category || "");
      const existing = byKey.get(key);
      if (existing) {
        if (incoming.favorite && !existing.favorite) {
          const updated = { ...existing, favorite: true };
          const index = merged.findIndex((quote) => quote.id === existing.id);
          merged[index] = updated;
          byKey.set(key, updated);
        }
        continue;
      }
      let imported = incoming;
      if (usedIds.has(imported.id)) imported = { ...incoming, id: makeId() };
      usedIds.add(imported.id);
      merged.push(imported);
      byKey.set(key, imported);
    }
    const added = merged.length - quotes.length;
    if (saveQuotes(merged)) {
      clearEdit();
      announce(`Import complete. Added ${added} ${added === 1 ? "quote" : "quotes"}; matching favorites were preserved.`);
    }
  }

  async function handleImport(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const records = validateEnvelope(parsed);
      importQuotes(records);
    } catch (error) {
      announce(`Import rejected: ${error && error.message ? error.message : "the file could not be read."} No quotes were changed.`, true);
    } finally {
      event.target.value = "";
    }
  }

  elements.form.addEventListener("submit", onSubmit);
  elements.cancelEdit.addEventListener("click", () => { clearEdit(); elements.text.focus(); announce("Edit canceled."); });
  elements.search.addEventListener("input", render);
  elements.favoritesFilter.addEventListener("click", () => { favoritesOnly = !favoritesOnly; render(); });
  if (elements.categoryFilter) {
    elements.categoryFilter.addEventListener("change", () => { categoryFilter = elements.categoryFilter.value; render(); });
  }
  elements.randomButton.addEventListener("click", pickRandom);
  elements.themeToggle.addEventListener("click", () => setTheme(elements.body.dataset.theme === "dark" ? "light" : "dark"));
  elements.exportButton.addEventListener("click", exportQuotes);
  elements.importFile.addEventListener("change", handleImport);

  loadQuotes();
  loadTheme();
  render();
})();