(function () {
  let activeBackdrop = null;

  function open(entry, options = {}) {
    close();

    activeBackdrop = document.createElement("div");
    activeBackdrop.className = "ehr-preview-backdrop";
    activeBackdrop.innerHTML = `
      <section class="ehr-preview-dialog" role="dialog" aria-modal="true" aria-label="word preview">
        <header class="ehr-preview-head">
          <div>
            <h2 class="ehr-preview-word">${escapeHtml(entry.word)}</h2>
            <span class="ehr-preview-ipa">${escapeHtml(entry.phonetic || "IPA unavailable")}</span>
          </div>
          <button class="ehr-preview-close" type="button" aria-label="Close">X</button>
        </header>
        <div class="ehr-preview-body">
          <span class="ehr-preview-badge ${entry.isEnglishWord ? "" : "warning"}">
            ${entry.isEnglishWord ? "\u82f1\u8bed\u8bcd\u5e93\u5df2\u786e\u8ba4" : "\u672a\u786e\u8ba4\u4e3a\u82f1\u8bed\u8bcd"}
          </span>
          <p class="ehr-preview-meaning">${escapeHtml(entry.chinese || "\u6682\u65e0\u4e2d\u6587\u91ca\u4e49")}</p>
          <div class="ehr-preview-section">
            <span>English</span>
            <p>${escapeHtml(entry.englishDefinition || "")}</p>
          </div>
          <div class="ehr-preview-section">
            <span>Example</span>
            <p>${escapeHtml(entry.example || "")}</p>
          </div>
          <div class="ehr-preview-section">
            <span>Status</span>
            <p>${escapeHtml(entry.languageNote || "")}</p>
          </div>
          <div class="ehr-preview-section">
            <span>Source</span>
            <p>${escapeHtml(entry.source || "")}</p>
          </div>
        </div>
        <footer class="ehr-preview-foot">
          <button class="ehr-preview-audio" type="button">\u53d1\u97f3</button>
          <button class="ehr-preview-save" type="button">\u6536\u85cf\u5230\u5355\u8bcd\u672c</button>
        </footer>
      </section>
    `;

    activeBackdrop.addEventListener("click", (event) => {
      if (event.target === activeBackdrop || event.target.closest(".ehr-preview-close")) close();
    });

    activeBackdrop.querySelector(".ehr-preview-audio").addEventListener("click", () => playAudio(entry));
    activeBackdrop.querySelector(".ehr-preview-save").addEventListener("click", async (event) => {
      const button = event.currentTarget;
      button.disabled = true;
      button.textContent = "\u6536\u85cf\u4e2d...";
      const response = await chrome.runtime.sendMessage({ type: "SAVE_WORD", entry });
      if (response?.ok) {
        button.textContent = "\u5df2\u6536\u85cf";
        options.onSaved?.(response.entry);
        return;
      }
      button.disabled = false;
      button.textContent = "\u6536\u85cf\u5931\u8d25";
    });

    document.body.appendChild(activeBackdrop);
  }

  function close() {
    activeBackdrop?.remove();
    activeBackdrop = null;
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

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  window.EHRWordPreview = {
    open,
    close
  };
})();
