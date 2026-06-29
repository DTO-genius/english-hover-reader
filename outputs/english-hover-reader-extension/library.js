let libraryState = {
  words: [],
  sentences: [],
  frequencyGroups: {},
  confusableGroups: [],
  filter: ""
};

document.addEventListener("DOMContentLoaded", async () => {
  document.getElementById("refreshButton").addEventListener("click", loadLibrary);
  document.getElementById("exportButton").addEventListener("click", () => {
    window.EHRExport.downloadLibraryWord(libraryState.words, libraryState.sentences);
  });
  document.getElementById("lookupForm").addEventListener("submit", handleLookup);
  document.getElementById("filterInput").addEventListener("input", (event) => {
    libraryState.filter = event.target.value.trim().toLowerCase();
    render();
  });
  document.body.addEventListener("click", handleDeleteClick);

  await loadLibrary();
});

async function loadLibrary() {
  const response = await chrome.runtime.sendMessage({ type: "GET_LIBRARY" });
  libraryState = {
    ...libraryState,
    words: response.words || [],
    sentences: response.sentences || [],
    frequencyGroups: response.frequencyGroups || {},
    confusableGroups: response.confusableGroups || []
  };
  render();
}

async function handleLookup(event) {
  event.preventDefault();
  const input = document.getElementById("lookupInput");
  const submitButton = event.currentTarget.querySelector("button[type='submit']");
  const word = input.value.trim();
  if (!word) return;

  try {
    input.disabled = true;
    submitButton.disabled = true;
    setLookupStatus("\u67e5\u8bcd\u4e2d...");
    const response = await chrome.runtime.sendMessage({ type: "LOOKUP_WORD", word });
    if (!response?.ok) throw new Error(response?.error || "\u67e5\u8bcd\u5931\u8d25");
    input.value = "";
    setLookupStatus(`\u5df2\u6536\u5f55 ${response.entry.word}`);
    await loadLibrary();
  } catch (error) {
    setLookupStatus(error.message || "\u67e5\u8bcd\u5931\u8d25", true);
  } finally {
    input.disabled = false;
    submitButton.disabled = false;
    input.focus();
  }
}

async function handleDeleteClick(event) {
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

function render() {
  const words = filterWords(libraryState.words);
  const sentences = filterSentences(libraryState.sentences);
  const confusableGroups = libraryState.confusableGroups
    .map((group) => ({ ...group, words: filterWords(group.words || []) }))
    .filter((group) => group.words.length >= 2);

  document.getElementById("summary").textContent =
    `${libraryState.words.length} \u4e2a\u5355\u8bcd\uff0c${libraryState.sentences.length} \u6761\u6458\u6284`;
  document.getElementById("wordsCount").textContent = words.length;
  document.getElementById("sentencesCount").textContent = sentences.length;
  document.getElementById("confusableCount").textContent = confusableGroups.length;

  renderWords(words);
  renderConfusables(confusableGroups);
  renderSentences(sentences);
}

function renderWords(words) {
  document.getElementById("wordsList").innerHTML = words.length
    ? `<div class="list">${words.map(renderWord).join("")}</div>`
    : `<div class="empty">\u8fd8\u6ca1\u6709\u5355\u8bcd\u8bb0\u5f55\u3002</div>`;
}

function renderConfusables(groups) {
  document.getElementById("confusableList").innerHTML = groups.length
    ? `<div class="list">${groups.map(renderConfusableGroup).join("")}</div>`
    : `<div class="empty">\u81f3\u5c11\u6536\u5f55\u5230\u4e24\u4e2a\u76f8\u8fd1\u8bcd\u65f6\u624d\u4f1a\u751f\u6210\u6613\u6df7\u7ec4\u5408\u3002</div>`;
}

function renderSentences(sentences) {
  document.getElementById("sentencesList").innerHTML = sentences.length
    ? `<div class="list">${sentences.map(renderSentence).join("")}</div>`
    : `<div class="empty">\u8fd8\u6ca1\u6709\u6536\u85cf\u7684\u53e5\u5b50\u3002</div>`;
}

function renderConfusableGroup(group) {
  return `
    <section class="confusable-group">
      <div class="card-top">
        <strong>${escapeHtml(group.title)}</strong>
      </div>
      <div class="mini-list">
        ${(group.words || []).map(renderMiniWord).join("")}
      </div>
    </section>
  `;
}

function renderMiniWord(item) {
  return `
    <div class="mini-word">
      <strong>${escapeHtml(item.word)}</strong>
      <span>${escapeHtml(item.chinese || item.englishDefinition || "")}</span>
      <button class="delete-button" type="button" data-delete-word="${escapeHtml(item.word)}">\u5220\u9664</button>
    </div>
  `;
}

function renderWord(item) {
  return `
    <article class="card">
      <div class="card-top">
        <div>
          <span class="word">${escapeHtml(item.word)}</span>
          <span class="ipa">${escapeHtml(item.phonetic || "")}</span>
        </div>
        <button class="delete-button" type="button" data-delete-word="${escapeHtml(item.word)}">\u5220\u9664</button>
      </div>
      <p class="zh">${escapeHtml(item.chinese || "")}</p>
      <p class="definition">${escapeHtml(item.englishDefinition || "")}</p>
      <p class="example">${escapeHtml(item.example || "")}</p>
      <p class="meta">\u67e5\u8fc7 ${Number(item.count || 0)} \u6b21 \u00b7 ${formatDate(item.lastSeen)}</p>
      <p class="source">${escapeHtml(item.source || "")}</p>
    </article>
  `;
}

function renderSentence(item) {
  return `
    <article class="card">
      <div class="card-top">
        <p class="sentence">${escapeHtml(item.text)}</p>
        <button class="delete-button" type="button" data-delete-sentence="${escapeHtml(item.id)}">\u5220\u9664</button>
      </div>
      <p class="translation">${escapeHtml(item.translation || "")}</p>
      <p class="meta">${formatDate(item.savedAt || item.createdAt)} ${escapeHtml(item.pageTitle || "")}</p>
    </article>
  `;
}

function filterWords(words) {
  if (!libraryState.filter) return words;
  return words.filter((item) => {
    return [item.word, item.chinese, item.englishDefinition, item.example].some((value) => {
      return String(value || "").toLowerCase().includes(libraryState.filter);
    });
  });
}

function filterSentences(sentences) {
  if (!libraryState.filter) return sentences;
  return sentences.filter((item) => {
    return [item.text, item.translation, item.pageTitle].some((value) => {
      return String(value || "").toLowerCase().includes(libraryState.filter);
    });
  });
}

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
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

function setLookupStatus(message, isError = false) {
  const node = document.getElementById("lookupStatus");
  node.textContent = message;
  node.classList.toggle("error", isError);
}
