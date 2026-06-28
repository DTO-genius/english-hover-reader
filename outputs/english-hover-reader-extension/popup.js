let state = {
  mode: "frequency",
  words: [],
  sentences: [],
  frequencyGroups: {},
  confusableGroups: []
};

document.addEventListener("DOMContentLoaded", async () => {
  document.querySelectorAll(".tabs button").forEach((button) => {
    button.addEventListener("click", () => {
      state.mode = button.dataset.mode;
      document.querySelectorAll(".tabs button").forEach((item) => item.classList.toggle("active", item === button));
      render();
    });
  });

  document.getElementById("lookupForm").addEventListener("submit", handleManualLookup);
  document.getElementById("libraryButton").addEventListener("click", openLibraryPage);
  document.getElementById("exportButton").addEventListener("click", () => {
    window.EHRExport.downloadLibraryWord(state.words, state.sentences);
  });
  document.getElementById("clearButton").addEventListener("click", clearAllData);
  document.getElementById("wordBook").addEventListener("click", handleListClick);

  await loadLibrary();
});

async function loadLibrary() {
  const response = await chrome.runtime.sendMessage({ type: "GET_LIBRARY" });
  state = {
    ...state,
    words: response.words || [],
    sentences: response.sentences || [],
    frequencyGroups: response.frequencyGroups || {},
    confusableGroups: response.confusableGroups || []
  };
  render();
}

async function handleManualLookup(event) {
  event.preventDefault();
  const input = document.getElementById("lookupInput");
  const word = input.value.trim();
  if (!word) return;

  input.disabled = true;
  await chrome.runtime.sendMessage({ type: "LOOKUP_WORD", word });
  input.value = "";
  input.disabled = false;
  await loadLibrary();
}

async function handleListClick(event) {
  const button = event.target.closest("[data-delete-word], [data-delete-sentence]");
  if (!button) return;

  if (button.dataset.deleteWord) {
    await chrome.runtime.sendMessage({ type: "DELETE_WORD", word: button.dataset.deleteWord });
  }

  if (button.dataset.deleteSentence) {
    await chrome.runtime.sendMessage({ type: "DELETE_SENTENCE", id: button.dataset.deleteSentence });
  }

  await loadLibrary();
}

function openLibraryPage() {
  chrome.tabs.create({ url: chrome.runtime.getURL("library.html") });
}

async function clearAllData() {
  const confirmed = confirm("\u786e\u5b9a\u6e05\u7a7a\u6240\u6709\u5355\u8bcd\u548c\u6458\u6284\u53e5\u5b50\u5417\uff1f");
  if (!confirmed) return;
  await chrome.runtime.sendMessage({ type: "CLEAR_ALL_DATA" });
  await loadLibrary();
}

function render() {
  const summary = document.getElementById("summary");
  summary.textContent = `${state.words.length} \u4e2a\u5355\u8bcd\uff0c${state.sentences.length} \u6761\u6458\u6284`;

  if (state.mode === "confusable") {
    renderConfusable();
    return;
  }

  if (state.mode === "sentences") {
    renderSentences();
    return;
  }

  renderFrequency();
}

function renderFrequency() {
  const groups = [
    ["high", "\u9ad8\u9891", state.frequencyGroups.high || []],
    ["medium", "\u4e2d\u9891", state.frequencyGroups.medium || []],
    ["low", "\u4f4e\u9891", state.frequencyGroups.low || []]
  ];

  const html = groups
    .filter(([, , words]) => words.length > 0)
    .map(([, title, words]) => renderWordGroup(title, words))
    .join("");

  document.getElementById("wordBook").innerHTML =
    html || `<div class="empty">\u9009\u4e2d\u82f1\u6587\u5355\u8bcd\u540e\u53f3\u952e\u67e5\u8bcd\uff0c\u6216\u5728\u4e0a\u65b9\u624b\u52a8\u8f93\u5165\u5355\u8bcd\u3002</div>`;
}

function renderConfusable() {
  if (!state.confusableGroups.length) {
    document.getElementById("wordBook").innerHTML =
      `<div class="empty">\u6682\u65e0\u6613\u6df7\u7ec4\u5408\u3002\u53ea\u6709\u6536\u5f55\u5230\u81f3\u5c11\u4e24\u4e2a\u76f8\u8fd1\u8bcd\u65f6\u624d\u751f\u6210\u7ec4\u5408\u3002</div>`;
    return;
  }

  document.getElementById("wordBook").innerHTML = state.confusableGroups
    .map((group) => renderWordGroup(group.title, group.words || []))
    .join("");
}

function renderSentences() {
  if (!state.sentences.length) {
    document.getElementById("wordBook").innerHTML =
      `<div class="empty">\u9009\u4e2d\u82f1\u6587\u53e5\u5b50\u540e\u53f3\u952e\u7ffb\u8bd1\uff0c\u518d\u70b9\u51fb\u6d6e\u7a97\u91cc\u7684\u6536\u85cf\u6309\u94ae\u3002</div>`;
    return;
  }

  document.getElementById("wordBook").innerHTML = `
    <section class="group">
      <div class="group-title">
        <span>\u6458\u6284\u53e5\u5b50</span>
        <span>${state.sentences.length}</span>
      </div>
      <div class="item-list">
        ${state.sentences.map(renderSentence).join("")}
      </div>
    </section>
  `;
}

function renderWordGroup(title, words) {
  return `
    <section class="group">
      <div class="group-title">
        <span>${escapeHtml(title)}</span>
        <span>${words.length}</span>
      </div>
      <div class="item-list">
        ${words.map(renderWord).join("")}
      </div>
    </section>
  `;
}

function renderWord(item) {
  return `
    <article class="item-card">
      <div class="item-top">
        <div>
          <span class="word">${escapeHtml(item.word)}</span>
          <span class="ipa">${escapeHtml(item.phonetic || "")}</span>
        </div>
        <button class="delete-button" type="button" data-delete-word="${escapeHtml(item.word)}">\u5220\u9664</button>
      </div>
      <p class="zh">${escapeHtml(item.chinese || "\u6682\u65e0\u4e2d\u6587\u91ca\u4e49")}</p>
      <p class="definition">${escapeHtml(item.englishDefinition || "")}</p>
      <p class="example">${escapeHtml(item.example || "")}</p>
      ${item.confusables?.length ? `<p class="confusable">\u53ef\u6ce8\u610f\uff1a${escapeHtml(item.confusables.join(", "))}</p>` : ""}
      <p class="meta">\u67e5\u8fc7 ${Number(item.count || 0)} \u6b21 \u00b7 ${formatDate(item.lastSeen)}</p>
      <p class="source">${escapeHtml(item.source || "")}</p>
    </article>
  `;
}

function renderSentence(item) {
  return `
    <article class="item-card">
      <div class="item-top">
        <p class="sentence">${escapeHtml(item.text)}</p>
        <button class="delete-button" type="button" data-delete-sentence="${escapeHtml(item.id)}">\u5220\u9664</button>
      </div>
      <p class="translation">${escapeHtml(item.translation || "")}</p>
      <p class="meta">${formatDate(item.savedAt || item.createdAt)}</p>
    </article>
  `;
}

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
