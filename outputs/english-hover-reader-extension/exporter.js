(function () {
  function downloadLibraryWord(words, sentences) {
    const html = buildDocumentHtml(words || [], sentences || []);
    const blob = new Blob(["\ufeff", html], { type: "application/msword;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `english-reader-review-${formatFileDate(new Date())}.doc`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function buildDocumentHtml(words, sentences) {
    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <title>English Reader Review</title>
    <style>
      body { font-family: Arial, "Microsoft YaHei", sans-serif; color: #1f2a25; }
      h1 { font-size: 24pt; }
      h2 { margin-top: 22pt; font-size: 16pt; border-bottom: 1px solid #888; }
      table { width: 100%; border-collapse: collapse; margin-top: 10pt; }
      th, td { border: 1px solid #aaa; padding: 6pt; vertical-align: top; }
      th { background: #edf4ef; }
      .small { color: #666; font-size: 9pt; }
      .sentence { margin: 8pt 0 2pt; font-weight: bold; }
      .translation { margin: 0 0 8pt; color: #345044; }
    </style>
  </head>
  <body>
    <h1>English Reader Review</h1>
    <p class="small">Generated at ${escapeHtml(new Date().toLocaleString())}</p>
    <h2>Words</h2>
    ${buildWordsTable(words)}
    <h2>Collected Sentences</h2>
    ${buildSentenceList(sentences)}
  </body>
</html>`;
  }

  function buildWordsTable(words) {
    if (!words.length) return "<p>No words yet.</p>";

    return `<table>
      <thead>
        <tr>
          <th>Word</th>
          <th>IPA</th>
          <th>Chinese</th>
          <th>English Definition</th>
          <th>Example</th>
          <th>Review</th>
        </tr>
      </thead>
      <tbody>
        ${words.map(renderWordRow).join("")}
      </tbody>
    </table>`;
  }

  function renderWordRow(item) {
    return `<tr>
      <td>${escapeHtml(item.word)}</td>
      <td>${escapeHtml(item.phonetic || "")}</td>
      <td>${escapeHtml(item.chinese || "")}</td>
      <td>${escapeHtml(item.englishDefinition || "")}</td>
      <td>${escapeHtml(item.example || "")}</td>
      <td>${Number(item.count || 0)} lookup(s)</td>
    </tr>`;
  }

  function buildSentenceList(sentences) {
    if (!sentences.length) return "<p>No collected sentences yet.</p>";

    return sentences
      .map((item, index) => {
        return `<div>
          <p class="sentence">${index + 1}. ${escapeHtml(item.text)}</p>
          <p class="translation">${escapeHtml(item.translation || "")}</p>
          <p class="small">${escapeHtml(item.pageTitle || "")} ${escapeHtml(item.pageUrl || "")}</p>
        </div>`;
      })
      .join("");
  }

  function formatFileDate(date) {
    const pad = (value) => String(value).padStart(2, "0");
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  window.EHRExport = {
    downloadLibraryWord
  };
})();
