const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const MAX_SENTENCE_LENGTH = 800;

const SOURCE_NOTE =
  "Oxford/Longman are preferred authoritative sources, but this build does not include licensed API keys. It uses the configured source when available and a free fallback otherwise.";

const LOCAL_ZH = {
  abandon: "\u653e\u5f03\uff1b\u629b\u5f03",
  ability: "\u80fd\u529b\uff1b\u624d\u80fd",
  able: "\u80fd\u591f\u7684\uff1b\u6709\u80fd\u529b\u7684",
  accept: "\u63a5\u53d7\uff1b\u540c\u610f",
  access: "\u5165\u53e3\uff1b\u4f7f\u7528\u6743\uff1b\u8bbf\u95ee",
  achieve: "\u5b9e\u73b0\uff1b\u8fbe\u5230",
  active: "\u79ef\u6781\u7684\uff1b\u6d3b\u8dc3\u7684",
  adapt: "\u9002\u5e94\uff1b\u6539\u7f16",
  affect: "\u5f71\u54cd",
  analysis: "\u5206\u6790",
  appear: "\u51fa\u73b0\uff1b\u663e\u5f97",
  apply: "\u7533\u8bf7\uff1b\u5e94\u7528",
  assume: "\u5047\u5b9a\uff1b\u627f\u62c5",
  avoid: "\u907f\u514d",
  benefit: "\u597d\u5904\uff1b\u53d7\u76ca",
  cause: "\u539f\u56e0\uff1b\u5bfc\u81f4",
  compare: "\u6bd4\u8f83",
  complete: "\u5b8c\u6210\uff1b\u5b8c\u6574\u7684",
  consider: "\u8003\u8651\uff1b\u8ba4\u4e3a",
  create: "\u521b\u9020\uff1b\u521b\u5efa",
  develop: "\u53d1\u5c55\uff1b\u5f00\u53d1",
  discover: "\u53d1\u73b0",
  effect: "\u5f71\u54cd\uff1b\u6548\u679c",
  example: "\u4f8b\u5b50",
  explain: "\u89e3\u91ca",
  improve: "\u63d0\u9ad8\uff1b\u6539\u5584",
  include: "\u5305\u62ec",
  important: "\u91cd\u8981\u7684",
  issue: "\u95ee\u9898\uff1b\u53d1\u5e03",
  likely: "\u53ef\u80fd\u7684\uff1b\u5f88\u53ef\u80fd",
  method: "\u65b9\u6cd5",
  principle: "\u539f\u5219\uff1b\u51c6\u5219",
  principal: "\u4e3b\u8981\u7684\uff1b\u6821\u957f\uff1b\u672c\u91d1",
  process: "\u8fc7\u7a0b\uff1b\u5904\u7406",
  provide: "\u63d0\u4f9b",
  require: "\u9700\u8981\uff1b\u8981\u6c42",
  result: "\u7ed3\u679c",
  source: "\u6765\u6e90",
  standard: "\u6807\u51c6\uff1b\u6807\u51c6\u7684",
  suggest: "\u5efa\u8bae\uff1b\u6697\u793a",
  support: "\u652f\u6301",
  understand: "\u7406\u89e3",
  useful: "\u6709\u7528\u7684",
  value: "\u4ef7\u503c\uff1b\u91cd\u89c6"
};

const CONFUSABLE_GROUPS = [
  ["affect", "effect"],
  ["accept", "except"],
  ["advice", "advise"],
  ["adapt", "adopt"],
  ["access", "excess"],
  ["allusion", "illusion"],
  ["assure", "ensure", "insure"],
  ["capital", "capitol"],
  ["cite", "site", "sight"],
  ["complement", "compliment"],
  ["desert", "dessert"],
  ["farther", "further"],
  ["formally", "formerly"],
  ["hear", "here"],
  ["its", "it's"],
  ["lead", "led"],
  ["loose", "lose"],
  ["passed", "past"],
  ["personal", "personnel"],
  ["principal", "principle"],
  ["quiet", "quite"],
  ["stationary", "stationery"],
  ["than", "then"],
  ["their", "there", "they're"],
  ["to", "too", "two"],
  ["weather", "whether"],
  ["whose", "who's"],
  ["your", "you're"]
];

chrome.runtime.onInstalled.addListener(async () => {
  const { wordStats = {}, sentenceNotes = {}, lookupCache = {}, translationCache = {} } =
    await chrome.storage.local.get({
      wordStats: {},
      sentenceNotes: {},
      lookupCache: {},
      translationCache: {}
    });
  await chrome.storage.local.set({ wordStats, sentenceNotes, lookupCache, translationCache });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "LOOKUP_WORD") {
    handleLookup(message.word)
      .then(sendResponse)
      .catch((error) => sendResponse({ ok: false, error: error.message || "Lookup failed." }));
    return true;
  }

  if (message?.type === "TRANSLATE_SENTENCE") {
    handleTranslateSentence(message.text)
      .then(sendResponse)
      .catch((error) => sendResponse({ ok: false, error: error.message || "Translation failed." }));
    return true;
  }

  if (message?.type === "SAVE_SENTENCE") {
    saveSentence(message.entry)
      .then(sendResponse)
      .catch((error) => sendResponse({ ok: false, error: error.message || "Save failed." }));
    return true;
  }

  if (message?.type === "DELETE_WORD") {
    deleteWord(message.word).then(sendResponse);
    return true;
  }

  if (message?.type === "DELETE_SENTENCE") {
    deleteSentence(message.id).then(sendResponse);
    return true;
  }

  if (message?.type === "GET_WORD_BOOK" || message?.type === "GET_LIBRARY") {
    getLibrary().then(sendResponse);
    return true;
  }

  if (message?.type === "CLEAR_WORD_BOOK") {
    chrome.storage.local.set({ wordStats: {}, lookupCache: {} }).then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message?.type === "CLEAR_ALL_DATA") {
    chrome.storage.local
      .set({ wordStats: {}, sentenceNotes: {}, lookupCache: {}, translationCache: {} })
      .then(() => sendResponse({ ok: true }));
    return true;
  }

  return false;
});

async function handleLookup(rawWord) {
  const word = normalizeWord(rawWord);
  if (!word) return { ok: false, error: "No valid English word found." };

  const lookup = await getLookup(word);
  const stats = await recordLookup(word, lookup);

  return {
    ok: true,
    entry: {
      ...lookup,
      count: stats.count,
      firstSeen: stats.firstSeen,
      lastSeen: stats.lastSeen,
      confusables: getConfusables(word),
      sourceNote: SOURCE_NOTE
    }
  };
}

async function handleTranslateSentence(rawText) {
  const text = normalizeSentence(rawText);
  if (!text) return { ok: false, error: "No valid sentence selected." };

  const translation = await getTranslation(text);
  return {
    ok: true,
    entry: {
      id: makeSentenceId(text),
      text,
      translation: translation.text,
      source: translation.source,
      createdAt: new Date().toISOString()
    }
  };
}

function normalizeWord(rawWord) {
  return String(rawWord || "")
    .trim()
    .replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, "")
    .toLowerCase();
}

function normalizeSentence(rawText) {
  return String(rawText || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_SENTENCE_LENGTH);
}

async function getLookup(word) {
  const { lookupCache = {} } = await chrome.storage.local.get({ lookupCache: {} });
  const cached = lookupCache[word];
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) return cached.data;

  const [dictionary, chinese] = await Promise.all([fetchDictionaryApi(word), fetchChineseMeaning(word)]);

  const data = {
    word,
    phonetic: dictionary.phonetic || "",
    audio: dictionary.audio || "",
    chinese: chinese || LOCAL_ZH[word] || "\u6682\u65e0\u4e2d\u6587\u91ca\u4e49\uff0c\u53ef\u5728\u8054\u7f51\u540e\u91cd\u8bd5\u3002",
    englishDefinition: dictionary.englishDefinition || "A word found in the current English page.",
    partOfSpeech: dictionary.partOfSpeech || "",
    example: dictionary.example || makeSimpleSentence(word, dictionary.partOfSpeech),
    source: dictionary.source || "free fallback",
    sourceNote: SOURCE_NOTE
  };

  lookupCache[word] = { cachedAt: Date.now(), data };
  await chrome.storage.local.set({ lookupCache });
  return data;
}

async function fetchDictionaryApi(word) {
  try {
    const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
    if (!response.ok) throw new Error("Dictionary request failed.");
    const payload = await response.json();
    const entry = payload?.[0] || {};
    const meanings = entry.meanings || [];
    const firstMeaning = meanings[0] || {};
    const firstDefinition = firstMeaning.definitions?.[0] || {};
    const phonetic = entry.phonetic || entry.phonetics?.find((item) => item.text)?.text || "";
    const audio = entry.phonetics?.find((item) => item.audio)?.audio || "";

    return {
      phonetic,
      audio,
      englishDefinition: simplifyDefinition(firstDefinition.definition),
      partOfSpeech: firstMeaning.partOfSpeech || "",
      example: firstDefinition.example || "",
      source: "dictionaryapi.dev fallback"
    };
  } catch (_error) {
    return {};
  }
}

async function fetchChineseMeaning(word) {
  if (LOCAL_ZH[word]) return LOCAL_ZH[word];

  try {
    const response = await fetch(`https://dict.youdao.com/suggest?num=5&doctype=json&q=${encodeURIComponent(word)}`);
    if (!response.ok) throw new Error("Chinese meaning request failed.");
    const payload = await response.json();
    const entries = payload?.data?.entries || [];
    const exact = entries.find((entry) => entry.entry?.toLowerCase() === word) || entries[0];
    return cleanChineseText(exact?.explain);
  } catch (_error) {
    return "";
  }
}

async function getTranslation(text) {
  const { translationCache = {} } = await chrome.storage.local.get({ translationCache: {} });
  const id = makeSentenceId(text);
  const cached = translationCache[id];
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) return cached.data;

  const data = await fetchMyMemoryTranslation(text);
  translationCache[id] = { cachedAt: Date.now(), data };
  await chrome.storage.local.set({ translationCache });
  return data;
}

async function fetchMyMemoryTranslation(text) {
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|zh-CN`;
    const response = await fetch(url);
    if (!response.ok) throw new Error("Translation request failed.");
    const payload = await response.json();
    const translated = payload?.responseData?.translatedText;
    if (translated) return { text: cleanTranslatedText(translated), source: "MyMemory fallback" };
  } catch (_error) {
    // Keep the extension usable offline or when the free endpoint throttles.
  }

  return {
    text: "\u6682\u65e0\u53ef\u7528\u7ffb\u8bd1\uff0c\u8bf7\u8054\u7f51\u540e\u91cd\u8bd5\u3002",
    source: "offline fallback"
  };
}

async function recordLookup(word, lookup) {
  const { wordStats = {} } = await chrome.storage.local.get({ wordStats: {} });
  const now = new Date().toISOString();
  const current = wordStats[word] || {
    word,
    count: 0,
    firstSeen: now,
    lastSeen: now
  };

  wordStats[word] = {
    ...current,
    ...lookup,
    word,
    count: (current.count || 0) + 1,
    firstSeen: current.firstSeen || now,
    lastSeen: now
  };

  await chrome.storage.local.set({ wordStats });
  return wordStats[word];
}

async function saveSentence(entry) {
  const text = normalizeSentence(entry?.text);
  if (!text) return { ok: false, error: "No sentence to save." };

  const { sentenceNotes = {} } = await chrome.storage.local.get({ sentenceNotes: {} });
  const id = entry?.id || makeSentenceId(text);
  const now = new Date().toISOString();
  const current = sentenceNotes[id] || {};

  sentenceNotes[id] = {
    ...current,
    id,
    text,
    translation: normalizeSentence(entry?.translation) || current.translation || "",
    source: entry?.source || current.source || "manual",
    pageTitle: entry?.pageTitle || current.pageTitle || "",
    pageUrl: entry?.pageUrl || current.pageUrl || "",
    createdAt: current.createdAt || now,
    savedAt: now
  };

  await chrome.storage.local.set({ sentenceNotes });
  return { ok: true, entry: sentenceNotes[id] };
}

async function deleteWord(rawWord) {
  const word = normalizeWord(rawWord);
  const { wordStats = {} } = await chrome.storage.local.get({ wordStats: {} });
  delete wordStats[word];
  await chrome.storage.local.set({ wordStats });
  return { ok: true };
}

async function deleteSentence(id) {
  const { sentenceNotes = {} } = await chrome.storage.local.get({ sentenceNotes: {} });
  delete sentenceNotes[id];
  await chrome.storage.local.set({ sentenceNotes });
  return { ok: true };
}

async function getLibrary() {
  const { wordStats = {}, sentenceNotes = {} } = await chrome.storage.local.get({
    wordStats: {},
    sentenceNotes: {}
  });

  const words = Object.values(wordStats)
    .map((item) => ({
      ...item,
      confusables: getConfusables(item.word)
    }))
    .sort((a, b) => (b.count || 0) - (a.count || 0) || a.word.localeCompare(b.word));

  const sentences = Object.values(sentenceNotes).sort((a, b) => {
    return new Date(b.savedAt || b.createdAt || 0) - new Date(a.savedAt || a.createdAt || 0);
  });

  return {
    ok: true,
    words,
    sentences,
    frequencyGroups: groupByFrequency(words),
    confusableGroups: groupByConfusables(words),
    sourceNote: SOURCE_NOTE
  };
}

function groupByFrequency(words) {
  return {
    high: words.filter((item) => item.count >= 8),
    medium: words.filter((item) => item.count >= 3 && item.count < 8),
    low: words.filter((item) => item.count < 3)
  };
}

function groupByConfusables(words) {
  const seenWords = new Set(words.map((item) => item.word));
  const known = CONFUSABLE_GROUPS.map((group) => group.filter((word) => seenWords.has(word)))
    .filter((group) => group.length >= 2)
    .map((group) => ({
      title: group.join(" / "),
      words: group.map((word) => words.find((item) => item.word === word)).filter(Boolean)
    }));

  const fuzzy = [];
  for (const item of words) {
    const matches = words.filter((candidate) => {
      if (candidate.word === item.word) return false;
      return areSimilarWords(item.word, candidate.word);
    });

    const groupWords = [item, ...matches];
    if (groupWords.length >= 2 && !fuzzy.some((group) => group.words.some((word) => word.word === item.word))) {
      fuzzy.push({
        title: groupWords.map((word) => word.word).join(" / "),
        words: groupWords
      });
    }
  }

  return [...known, ...fuzzy];
}

function getConfusables(word) {
  const known = CONFUSABLE_GROUPS.find((group) => group.includes(word));
  return known ? known.filter((item) => item !== word) : [];
}

function areSimilarWords(left, right) {
  if (Math.abs(left.length - right.length) > 2) return false;
  if (left[0] !== right[0]) return false;
  return levenshtein(left, right) <= 2;
}

function levenshtein(left, right) {
  const matrix = Array.from({ length: left.length + 1 }, () => []);
  for (let i = 0; i <= left.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= right.length; j += 1) matrix[0][j] = j;

  for (let i = 1; i <= left.length; i += 1) {
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[left.length][right.length];
}

function simplifyDefinition(definition) {
  if (!definition) return "";
  const cleaned = definition.replace(/\s+/g, " ").trim();
  if (cleaned.length <= 170) return cleaned;
  return `${cleaned.slice(0, 167).trim()}...`;
}

function cleanChineseText(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .replace(/\u7f51\u7edc\u91ca\u4e49|\u4e13\u4e1a\u91ca\u4e49|\u82f1\u82f1\u91ca\u4e49/g, "")
    .trim();
}

function cleanTranslatedText(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .trim();
}

function makeSimpleSentence(word, partOfSpeech) {
  const article = /^[aeiou]/i.test(word) ? "an" : "a";
  if (partOfSpeech === "verb") return `I can ${word} this idea in a simple way.`;
  if (partOfSpeech === "adjective") return `This is a ${word} example.`;
  if (partOfSpeech === "adverb") return `She spoke ${word} and everyone understood.`;
  return `I found ${article} ${word} in the article.`;
}

function makeSentenceId(text) {
  return `sentence-${hashText(text).toString(36)}`;
}

function hashText(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}
