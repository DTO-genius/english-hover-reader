# English Hover Reader

Chrome Manifest V3 English reading assistant. Select an English word or sentence, then right-click the selected text to trigger the extension.

## Features

- Select one English word and right-click to show IPA, Chinese meaning, English definition, example, source note, and audio.
- Select an English sentence or paragraph and right-click to translate it.
- Sentence translation is not saved automatically. Use the save button in the floating card to add it to the excerpt book.
- Manual word lookup is available in the popup and the full library page. Manual lookup is recorded in the word book.
- Manual word lookup now opens a preview dialog first. It is saved only after pressing the collect button.
- Words not confirmed by the English dictionary source are marked as possible non-English words, misspellings, or missing free-dictionary entries.
- Word book supports frequency grouping and confusable-word grouping.
- Confusable groups are generated only when at least two related words have been collected.
- Words and collected sentences can be deleted one by one.
- A full library page shows all words, confusable groups, and collected sentences.
- Export the word book and excerpt book as a Word-compatible `.doc` file.

## Install

1. Open `chrome://extensions/`.
2. Turn on Developer mode.
3. Click "Load unpacked".
4. Select this folder: `english-hover-reader-extension`.

## Use

- Word lookup: select a single English word, then right-click it.
- Sentence translation: select an English sentence, then right-click it.
- If Chrome narrows the selection during right-click, the extension uses the most recent full selection captured on mouseup/right-mousedown.
- Save sentence: click the save button in the translation card.
- Manual lookup: click the extension icon and type a word into the search box.
- Manual lookup preview: check the dictionary status, then click collect if you want it in the word book.
- Full library: click "全部" in the popup, or open the extension options page.
- Export: click "导出 Word" in the popup or full library page.

## Source Notes

Oxford and Longman are preferred authoritative dictionary sources, but this build does not include licensed API keys. It avoids scraping their pages. The current runnable version uses `api.dictionaryapi.dev`, Youdao suggest, and MyMemory translation as free fallbacks. The background data model keeps source fields so an authorized Oxford/Longman API connector can be added later.

## Troubleshooting

- Refresh existing pages after reloading or updating the extension.
- Do not test on `chrome://` pages, the Chrome Web Store, or the extension management page; Chrome blocks normal content-script injection there.
- To test on local `file://` pages, enable "Allow access to file URLs" on the extension details page.
- Use `test-page.html` for a quick local test.
