const LOOKUP_DELAY_MS = 320;
const WORD_PATTERN = /^[A-Za-z][A-Za-z'-]{1,34}$/;

let hoverTimer = 0;
let activeWord = "";
let activeRangeKey = "";
let card = null;
let lastLookupAt = 0;

document.addEventListener("contextmenu", handleContextMenu, true);
document.addEventListener("scroll", hideCard, { passive: true });
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") hideCard();
});

function handleContextMenu(event) {
  if (card?.contains(event.target) || isIgnoredElement(event.target)) return;

  const hit = getSelectedWordHit();
  if (!hit || !WORD_PATTERN.test(hit.word)) {
    hideCard();
    return;
  }

  const word = hit.word.toLowerCase();
  const rangeKey = `${word}:${Math.round(hit.rect.left)}:${Math.round(hit.rect.top)}`;
  const now = Date.now();
  if (word === activeWord && rangeKey === activeRangeKey && now - lastLookupAt < 800) {
    event.preventDefault();
    return;
  }

  event.preventDefault();
  window.clearTimeout(hoverTimer);
  activeWord = word;
  activeRangeKey = rangeKey;
  lastLookupAt = now;
  showLoadingCard(hit.rect, word);
  hoverTimer = window.setTimeout(() => lookupWord(word, hit.rect), LOOKUP_DELAY_MS);
}

function getSelectedWordHit() {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;

  const selectedText = selection.toString().trim();
  const wordMatch = selectedText.match(/[A-Za-z][A-Za-z'-]{1,34}/);
  if (!wordMatch) return null;

  const word = wordMatch[0].replace(/^'+|'+$/g, "");
  if (!word) return null;

  const range = selection.getRangeAt(0);
  const rect = getSelectionRect(range);
  if (!rect.width || !rect.height) return null;

  return { word, rect };
}

function getSelectionRect(range) {
  const rects = Array.from(range.getClientRects()).filter((rect) => rect.width && rect.height);
  return rects[0] || range.getBoundingClientRect();
}

function getWordAtPoint(x, y) {
  const range = getCaretRangeFromPoint(x, y);
  const caretHit = getWordFromRange(range, x, y);
  if (caretHit) return caretHit;

  return getWordFromElementAtPoint(x, y);
}

function getWordFromRange(range, x, y) {
  if (!range?.startContainer || range.startContainer.nodeType !== Node.TEXT_NODE) return null;

  const textNode = range.startContainer;
  const text = textNode.textContent || "";
  const offset = Math.min(range.startOffset, Math.max(text.length - 1, 0));
  const bounds = expandWordBounds(text, offset);
  if (!bounds) return null;

  const rect = getRangeRect(textNode, bounds.start, bounds.end, x, y);
  const word = text.slice(bounds.start, bounds.end);

  if (!rect.width || !rect.height) return null;
  return { word, rect };
}

function getWordFromElementAtPoint(x, y) {
  const element = document.elementFromPoint(x, y);
  if (!element || isIgnoredElement(element)) return null;

  const root = element.shadowRoot || element;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.textContent || !/[A-Za-z]/.test(node.textContent)) return NodeFilter.FILTER_REJECT;
      const parent = node.parentElement;
      if (!parent || isIgnoredElement(parent)) return NodeFilter.FILTER_REJECT;
      const style = window.getComputedStyle(parent);
      if (style.visibility === "hidden" || style.display === "none") return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });

  let node = walker.nextNode();
  let scanned = 0;
  while (node && scanned < 120) {
    const hit = findWordInTextNode(node, x, y);
    if (hit) return hit;
    node = walker.nextNode();
    scanned += 1;
  }

  return null;
}

function findWordInTextNode(textNode, x, y) {
  const text = textNode.textContent || "";
  const matcher = /[A-Za-z][A-Za-z'-]{1,34}/g;
  let match = matcher.exec(text);

  while (match) {
    const start = match.index;
    const end = start + match[0].length;
    const rect = getRangeRect(textNode, start, end, x, y);
    if (pointInsideRect(x, y, rect)) {
      return { word: match[0], rect };
    }
    match = matcher.exec(text);
  }

  return null;
}

function getRangeRect(textNode, start, end, x, y) {
  const wordRange = document.createRange();
  wordRange.setStart(textNode, start);
  wordRange.setEnd(textNode, end);

  const rects = Array.from(wordRange.getClientRects());
  const rect = rects.find((item) => pointInsideRect(x, y, item)) || wordRange.getBoundingClientRect();
  wordRange.detach();
  return rect;
}

function pointInsideRect(x, y, rect) {
  if (!rect || !rect.width || !rect.height) return false;
  const padding = 2;
  return x >= rect.left - padding && x <= rect.right + padding && y >= rect.top - padding && y <= rect.bottom + padding;
}

function isIgnoredElement(target) {
  const element = target?.nodeType === Node.ELEMENT_NODE ? target : target?.parentElement;
  if (!element) return false;
  return Boolean(element.closest("input, textarea, select, button, code, pre, [contenteditable='true'], .ehr-card"));
}

function getCaretRangeFromPoint(x, y) {
  if (document.caretRangeFromPoint) return document.caretRangeFromPoint(x, y);
  const position = document.caretPositionFromPoint?.(x, y);
  if (!position) return null;
  const range = document.createRange();
  range.setStart(position.offsetNode, position.offset);
  range.collapse(true);
  return range;
}

function expandWordBounds(text, offset) {
  if (!text) return null;

  let index = offset;
  if (!/[A-Za-z'-]/.test(text[index] || "") && /[A-Za-z'-]/.test(text[index - 1] || "")) {
    index -= 1;
  }
  if (!/[A-Za-z'-]/.test(text[index] || "")) return null;

  let start = index;
  let end = index + 1;
  while (start > 0 && /[A-Za-z'-]/.test(text[start - 1])) start -= 1;
  while (end < text.length && /[A-Za-z'-]/.test(text[end])) end += 1;

  const rawWord = text.slice(start, end).replace(/^'+|'+$/g, "");
  if (!rawWord || rawWord.length < 2) return null;
  return { start, end };
}

async function lookupWord(word, rect) {
  try {
    const response = await chrome.runtime.sendMessage({ type: "LOOKUP_WORD", word });
    if (!response?.ok) {
      renderError(rect, word, response?.error || "Lookup failed.");
      return;
    }
    renderEntry(rect, response.entry);
  } catch (error) {
    renderError(rect, word, error.message || "Lookup failed.");
  }
}

function ensureCard() {
  if (card) return card;

  card = document.createElement("section");
  card.className = "ehr-card";
  card.addEventListener("mouseenter", () => window.clearTimeout(hoverTimer));
  card.addEventListener("mouseleave", scheduleHide);
  document.documentElement.appendChild(card);
  return card;
}

function showLoadingCard(rect, word) {
  const node = ensureCard();
  node.innerHTML = `
    <div class="ehr-head">
      <strong>${escapeHtml(word)}</strong>
      <span>查词中...</span>
    </div>
    <div class="ehr-loading"></div>
  `;
  positionCard(node, rect);
}

function renderEntry(rect, entry) {
  const node = ensureCard();
  node.innerHTML = `
    <div class="ehr-head">
      <div>
        <strong>${escapeHtml(entry.word)}</strong>
        <span>${escapeHtml(entry.phonetic || "IPA 暂无")}</span>
      </div>
      <button class="ehr-audio" type="button" title="播放标准发音" aria-label="播放标准发音">▶</button>
    </div>
    <div class="ehr-meaning">${escapeHtml(entry.chinese)}</div>
    <div class="ehr-section">
      <span>English</span>
      <p>${escapeHtml(entry.englishDefinition)}</p>
    </div>
    <div class="ehr-section">
      <span>Example</span>
      <p>${escapeHtml(entry.example)}</p>
    </div>
    <div class="ehr-foot">
      <span>已查 ${Number(entry.count || 1)} 次</span>
      ${entry.confusables?.length ? `<span>易混: ${escapeHtml(entry.confusables.join(", "))}</span>` : ""}
    </div>
  `;

  node.querySelector(".ehr-audio").addEventListener("click", () => playAudio(entry));
  positionCard(node, rect);
}

function renderError(rect, word, message) {
  const node = ensureCard();
  node.innerHTML = `
    <div class="ehr-head">
      <strong>${escapeHtml(word)}</strong>
      <span>查词失败</span>
    </div>
    <div class="ehr-error">${escapeHtml(message)}</div>
  `;
  positionCard(node, rect);
}

function positionCard(node, rect) {
  const margin = 10;
  const width = Math.min(340, window.innerWidth - margin * 2);
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
  window.clearTimeout(hoverTimer);
  hoverTimer = window.setTimeout(hideCard, 180);
}

function hideCard() {
  activeWord = "";
  activeRangeKey = "";
  if (card) card.style.display = "none";
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
