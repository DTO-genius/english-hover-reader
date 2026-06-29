const LOOKUP_DELAY_MS = 260;
const WORD_PATTERN = /^[A-Za-z][A-Za-z'-]{1,34}$/;
const SELECTION_CACHE_MS = 8000;

let actionTimer = 0;
let activeKey = "";
let card = null;
let lastSelectionHit = null;
let pendingContextHit = null;

document.addEventListener("mousedown", handleMouseDown, true);
document.addEventListener("contextmenu", handleContextMenu, true);
document.addEventListener("selectionchange", cacheCurrentSelection);
document.addEventListener("mouseup", cacheCurrentSelection, true);
document.addEventListener("keyup", cacheCurrentSelection, true);
document.addEventListener("scroll", hideCard, { passive: true });
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") hideCard();
});

function handleContextMenu(event) {
  if (card?.contains(event.target) || isIgnoredElement(event.target)) return;

  const hit = getBestSelectedTextHit(event.clientX, event.clientY);
  if (!hit) {
    hideCard();
    return;
  }

  const selectionType = classifySelection(hit.text);
  if (selectionType.kind === "invalid") {
    hideCard();
    return;
  }
  const key = selectionType.kind === "word" ? `word:${selectionType.word}` : `sentence:${hit.text}`;

  event.preventDefault();
  window.clearTimeout(actionTimer);
  activeKey = key;

  if (selectionType.kind === "word") {
    showLoadingCard(hit.rect, selectionType.word, "\u67e5\u8bcd\u4e2d...");
    actionTimer = window.setTimeout(() => lookupWord(selectionType.word, hit.rect), LOOKUP_DELAY_MS);
    return;
  }

  showLoadingCard(hit.rect, "\u53e5\u5b50\u7ffb\u8bd1", "\u7ffb\u8bd1\u4e2d...");
  actionTimer = window.setTimeout(() => translateSentence(hit.text, hit.rect), LOOKUP_DELAY_MS);
}

function handleMouseDown(event) {
  if (event.button !== 2) return;
  pendingContextHit = null;
  const hit = getBestSelectedTextHit(event.clientX, event.clientY);
  if (!hit || classifySelection(hit.text).kind === "invalid") return;
  pendingContextHit = {
    ...hit,
    cachedAt: Date.now()
  };
}

function cacheCurrentSelection() {
  const hit = getSelectedTextHit();
  if (!hit) return;
  const hitType = classifySelection(hit.text);
  if (hitType.kind === "invalid") return;

  const currentType = classifySelection(lastSelectionHit?.text || "");
  if (
    isFreshSelectionHit(lastSelectionHit) &&
    currentType.kind === "sentence" &&
    hitType.kind === "word" &&
    hit.text.length < lastSelectionHit.text.length
  ) {
    return;
  }

  lastSelectionHit = {
    ...hit,
    cachedAt: Date.now()
  };
}

function getBestSelectedTextHit(clientX, clientY) {
  if (isFreshSelectionHit(pendingContextHit) && pointInsideAnyRect(clientX, clientY, pendingContextHit.rects)) {
    return pendingContextHit;
  }

  const liveHit = getSelectedTextHit();
  const cachedHit = isFreshSelectionHit(lastSelectionHit) ? lastSelectionHit : null;
  if (!cachedHit) return liveHit;
  if (!liveHit) return cachedHit;

  const liveType = classifySelection(liveHit.text);
  const cachedType = classifySelection(cachedHit.text);
  const clickedCachedSelection = pointInsideAnyRect(clientX, clientY, cachedHit.rects);

  if (clickedCachedSelection && cachedType.kind === "sentence" && liveType.kind !== "sentence") {
    return cachedHit;
  }

  if (clickedCachedSelection && cachedHit.text.length > liveHit.text.length) {
    return cachedHit;
  }

  return liveHit;
}

function getSelectedTextHit() {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;

  const text = selection.toString().replace(/\s+/g, " ").trim();
  if (!text || !/[A-Za-z]/.test(text)) return null;

  const range = selection.getRangeAt(0);
  const rects = getSelectionRects(range);
  const rect = rects[0] || range.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;

  return { text, rect, rects };
}

function classifySelection(text) {
  const normalized = String(text || "")
    .trim()
    .replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, "");
  const words = normalized.match(/[A-Za-z][A-Za-z'-]*/g) || [];
  const hasSentencePunctuation = /[.!?;:]/.test(normalized);
  const hasInternalWhitespace = /\s/.test(normalized);

  if (!normalized || words.length === 0) return { kind: "invalid" };

  if (words.length === 1 && !hasInternalWhitespace && !hasSentencePunctuation && WORD_PATTERN.test(normalized)) {
    return { kind: "word", word: normalized.toLowerCase() };
  }

  if (words.length === 1 && !hasInternalWhitespace) return { kind: "invalid" };

  return { kind: "sentence" };
}

function getSelectionRects(range) {
  const rects = Array.from(range.getClientRects()).filter((rect) => rect.width && rect.height);
  if (rects.length) return rects;
  const rect = range.getBoundingClientRect();
  return rect.width && rect.height ? [rect] : [];
}

function isFreshSelectionHit(hit) {
  return Boolean(hit && Date.now() - hit.cachedAt < SELECTION_CACHE_MS);
}

function pointInsideAnyRect(x, y, rects = []) {
  return rects.some((rect) => {
    const padding = 3;
    return x >= rect.left - padding && x <= rect.right + padding && y >= rect.top - padding && y <= rect.bottom + padding;
  });
}

async function lookupWord(word, rect) {
  try {
    const response = await chrome.runtime.sendMessage({ type: "LOOKUP_WORD", word });
    if (activeKey !== `word:${word}`) return;
    if (!response?.ok) {
      renderError(rect, word, response?.error || "Lookup failed.");
      return;
    }
    renderWordEntry(rect, response.entry);
  } catch (error) {
    renderError(rect, word, error.message || "Lookup failed.");
  }
}

async function translateSentence(text, rect) {
  try {
    const response = await chrome.runtime.sendMessage({ type: "TRANSLATE_SENTENCE", text });
    if (activeKey !== `sentence:${text}`) return;
    if (!response?.ok) {
      renderError(rect, "\u53e5\u5b50\u7ffb\u8bd1", response?.error || "Translation failed.");
      return;
    }
    renderSentenceEntry(rect, response.entry);
  } catch (error) {
    renderError(rect, "\u53e5\u5b50\u7ffb\u8bd1", error.message || "Translation failed.");
  }
}

function ensureCard() {
  if (card) return card;

  card = document.createElement("section");
  card.className = "ehr-card";
  card.addEventListener("mouseenter", () => window.clearTimeout(actionTimer));
  card.addEventListener("mouseleave", scheduleHide);
  document.documentElement.appendChild(card);
  return card;
}

function showLoadingCard(rect, title, subtitle) {
  const node = ensureCard();
  node.innerHTML = `
    <div class="ehr-head">
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(subtitle)}</span>
    </div>
    <div class="ehr-loading"></div>
  `;
  positionCard(node, rect);
}

function renderWordEntry(rect, entry) {
  const node = ensureCard();
  node.innerHTML = `
    <div class="ehr-head">
      <div>
        <strong>${escapeHtml(entry.word)}</strong>
        <span>${escapeHtml(entry.phonetic || "IPA unavailable")}</span>
      </div>
      <button class="ehr-audio" type="button" title="\u64ad\u653e\u6807\u51c6\u53d1\u97f3" aria-label="\u64ad\u653e\u6807\u51c6\u53d1\u97f3">▶</button>
    </div>
    <div class="ehr-meaning">${escapeHtml(entry.chinese)}</div>
    <div class="ehr-word-status ${entry.isEnglishWord ? "" : "warning"}">
      ${escapeHtml(entry.languageNote || "")}
    </div>
    <div class="ehr-section">
      <span>English</span>
      <p>${escapeHtml(entry.englishDefinition)}</p>
    </div>
    <div class="ehr-section">
      <span>Example</span>
      <p>${escapeHtml(entry.example)}</p>
    </div>
    <div class="ehr-foot">
      <span>\u6765\u6e90: ${escapeHtml(entry.source || "fallback")}</span>
      <span>${entry.isEnglishWord ? `\u67e5\u8fc7 ${Number(entry.count || 1)} \u6b21` : "\u672a\u81ea\u52a8\u6536\u5f55"}</span>
    </div>
  `;

  node.querySelector(".ehr-audio")?.addEventListener("click", () => playAudio(entry));
  positionCard(node, rect);
}

function renderSentenceEntry(rect, entry) {
  const node = ensureCard();
  node.innerHTML = `
    <div class="ehr-head">
      <div>
        <strong>\u53e5\u5b50\u7ffb\u8bd1</strong>
        <span>${escapeHtml(entry.source || "translation fallback")}</span>
      </div>
    </div>
    <div class="ehr-section">
      <span>Original</span>
      <p class="ehr-sentence">${escapeHtml(entry.text)}</p>
    </div>
    <div class="ehr-meaning ehr-translation">${escapeHtml(entry.translation)}</div>
    <div class="ehr-actions">
      <button class="ehr-save" type="button">\u6536\u85cf\u53e5\u5b50</button>
    </div>
  `;

  node.querySelector(".ehr-save")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = "\u4fdd\u5b58\u4e2d...";
    const response = await chrome.runtime.sendMessage({
      type: "SAVE_SENTENCE",
      entry: {
        ...entry,
        pageTitle: document.title,
        pageUrl: location.href
      }
    });
    button.textContent = response?.ok ? "\u5df2\u6536\u85cf" : "\u6536\u85cf\u5931\u8d25";
    if (!response?.ok) button.disabled = false;
  });

  positionCard(node, rect);
}

function renderError(rect, title, message) {
  const node = ensureCard();
  node.innerHTML = `
    <div class="ehr-head">
      <strong>${escapeHtml(title)}</strong>
      <span>\u5931\u8d25</span>
    </div>
    <div class="ehr-error">${escapeHtml(message)}</div>
  `;
  positionCard(node, rect);
}

function positionCard(node, rect) {
  const margin = 10;
  const width = Math.min(360, window.innerWidth - margin * 2);
  node.style.width = `${width}px`;
  node.style.display = "block";

  const measured = node.getBoundingClientRect();
  let left = rect.left + rect.width / 2 - width / 2;
  let top = rect.bottom + margin;

  if (left < margin) left = margin;
  if (left + width > window.innerWidth - margin) left = window.innerWidth - width - margin;
  if (top + measured.height > window.innerHeight - margin) top = rect.top - measured.height - margin;
  if (top < margin) top = margin;

  node.style.left = `${Math.round(left)}px`;
  node.style.top = `${Math.round(top)}px`;
}

function playAudio(entry) {
  if (entry.audio) {
    const audio = new Audio(entry.audio);
    audio.play().catch(() => speak(entry.word));
    return;
  }
  speak(entry.word);
}

function speak(word) {
  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = "en-US";
  utterance.rate = 0.9;
  speechSynthesis.cancel();
  speechSynthesis.speak(utterance);
}

function scheduleHide() {
  window.clearTimeout(actionTimer);
  actionTimer = window.setTimeout(hideCard, 180);
}

function hideCard() {
  activeKey = "";
  if (card) card.style.display = "none";
}

function isIgnoredElement(target) {
  const element = target?.nodeType === Node.ELEMENT_NODE ? target : target?.parentElement;
  if (!element) return false;
  return Boolean(element.closest("input, textarea, select, button, code, pre, [contenteditable='true'], .ehr-card"));
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
