let state = {
  mode: "frequency",
  words: [],
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

  document.getElementById("clearButton").addEventListener("click", clearWordBook);
  await loadWordBook();
});

async function loadWordBook() {
  const response = await chrome.runtime.sendMessage({ type: "GET_WORD_BOOK" });
  state = {
    ...state,
    words: response.words || [],
    frequencyGroups: response.frequencyGroups || {},
    confusableGroups: response.confusableGroups || []
  };
  render();
}

async function clearWordBook() {
  const confirmed = confirm("确定清空所有查询记录和缓存吗？");
  if (!confirmed) return;
  await chrome.runtime.sendMessage({ type: "CLEAR_WORD_BOOK" });
  await loadWordBook();
}

function render() {
  const summary = document.getElementById("summary");
  const totalLookups = state.words.reduce((sum, item) => sum + Number(item.count || 0), 0);
  summary.textContent = `${state.words.length} 个单词，累计查询 ${totalLookups} 次`;

  if (state.words.length === 0) {
    document.getElementById("wordBook").innerHTML = `<div class="empty">在英文网页上把鼠标滑到单词上方，查询过的词会自动出现在这里。</div>`;
    return;
  }

  if (state.mode === "confusable") {
    renderConfusable();
    return;
  }

  renderFrequency();
}

function renderFrequency() {
  const groups = [
    ["high", "高频", state.frequencyGroups.high || []],
    ["medium", "中频", state.frequencyGroups.medium || []],
    ["low", "低频", state.frequencyGroups.low || []]
  ];

  document.getElementById("wordBook").innerHTML = groups
    .filter(([, , words]) => words.length > 0)
    .map(([, title, words]) => renderGroup(title, words))
    .join("");
}

function renderConfusable() {
  if (!state.confusableGroups.length) {
    document.getElementById("wordBook").innerHTML = `<div class="empty">还没有发现形似或易混词。继续阅读后，这里会自动聚合类似 affect / effect 的词组。</div>`;
    return;
  }

  document.getElementById("wordBook").innerHTML = state.confusableGroups
    .map((group) => renderGroup(group.title, group.words || []))
    .join("");
}

function renderGroup(title, words) {
  return `
    <section class="group">
      <div class="group-title">
        <span>${escapeHtml(title)}</span>
        <span>${words.length}</span>
      </div>
      <div class="word-list">
        ${words.map(renderWord).join("")}
      </div>
    </section>
  `;
}

function renderWord(item) {
  return `
    <article class="word-card">
      <div class="word-top">
        <div>
          <span class="word">${escapeHtml(item.word)}</span>
          <span class="ipa">${escapeHtml(item.phonetic || "")}</span>
        </div>
        <span class="count">${Number(item.count || 0)} 次</span>
      </div>
      <p class="zh">${escapeHtml(item.chinese || "暂无中文释义")}</p>
      <p class="definition">${escapeHtml(item.englishDefinition || "")}</p>
      <p class="example">${escapeHtml(item.example || "")}</p>
      ${item.confusables?.length ? `<p class="confusable">易混：${escapeHtml(item.confusables.join(", "))}</p>` : ""}
      <p class="meta">最近：${formatDate(item.lastSeen)}</p>
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
