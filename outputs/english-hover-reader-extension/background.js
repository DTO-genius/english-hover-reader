const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 30;

const LOCAL_ZH = {
  abandon: "放弃；抛弃",
  ability: "能力；才能",
  able: "能够的；有能力的",
  accept: "接受；同意",
  access: "入口；使用权；访问",
  achieve: "实现；达到",
  across: "穿过；在对面",
  active: "积极的；活跃的",
  actual: "实际的；真实的",
  adapt: "适应；改编",
  add: "增加；补充",
  address: "地址；处理；演说",
  affect: "影响",
  agree: "同意",
  allow: "允许",
  almost: "几乎",
  alone: "独自的；单独地",
  already: "已经",
  although: "虽然；尽管",
  always: "总是",
  among: "在……之中",
  analysis: "分析",
  answer: "回答；答案",
  appear: "出现；显得",
  apply: "申请；应用",
  argue: "争论；主张",
  arrive: "到达",
  article: "文章；物品；冠词",
  assume: "假定；承担",
  avoid: "避免",
  benefit: "好处；受益",
  cause: "原因；导致",
  change: "改变；变化",
  clear: "清楚的；清除",
  compare: "比较",
  complete: "完成；完整的",
  consider: "考虑；认为",
  create: "创造；创建",
  decide: "决定",
  develop: "发展；开发",
  different: "不同的",
  difficult: "困难的",
  discover: "发现",
  effect: "影响；效果",
  enough: "足够的；足够地",
  example: "例子",
  explain: "解释",
  focus: "焦点；集中",
  follow: "跟随；遵循",
  however: "然而",
  improve: "提高；改善",
  include: "包括",
  important: "重要的",
  increase: "增加",
  issue: "问题；发布",
  learn: "学习；得知",
  likely: "可能的；很可能",
  meaning: "意思；意义",
  method: "方法",
  notice: "注意到；通知",
  process: "过程；处理",
  provide: "提供",
  question: "问题；询问",
  reason: "原因；理由",
  require: "需要；要求",
  result: "结果",
  simple: "简单的",
  source: "来源",
  standard: "标准；标准的",
  suggest: "建议；暗示",
  support: "支持",
  through: "通过；穿过",
  understand: "理解",
  useful: "有用的",
  value: "价值；重视"
};

const CONFUSABLE_GROUPS = [
  ["affect", "effect"],
  ["accept", "except"],
  ["advice", "advise"],
  ["adapt", "adopt"],
  ["access", "excess"],
  ["already", "all ready"],
  ["allusion", "illusion"],
  ["among", "between"],
  ["assure", "ensure", "insure"],
  ["beside", "besides"],
  ["capital", "capitol"],
  ["cite", "site", "sight"],
  ["complement", "compliment"],
  ["continuous", "continual"],
  ["desert", "dessert"],
  ["emigrate", "immigrate"],
  ["farther", "further"],
  ["fewer", "less"],
  ["formally", "formerly"],
  ["hear", "here"],
  ["its", "it's"],
  ["later", "latter"],
  ["lead", "led"],
  ["loose", "lose"],
  ["moral", "morale"],
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
  const { wordStats } = await chrome.storage.local.get({ wordStats: {} });
  await chrome.storage.local.set({ wordStats });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "LOOKUP_WORD") {
    handleLookup(message.word)
      .then(sendResponse)
      .catch((error) => sendResponse({ ok: false, error: error.message || "Lookup failed." }));
    return true;
  }

  if (message?.type === "GET_WORD_BOOK") {
    getWordBook().then(sendResponse);
    return true;
  }

  if (message?.type === "CLEAR_WORD_BOOK") {
    chrome.storage.local.set({ wordStats: {}, lookupCache: {} }).then(() => sendResponse({ ok: true }));
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
      confusables: getConfusables(word)
    }
  };
}

function normalizeWord(rawWord) {
  return String(rawWord || "")
    .trim()
    .replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, "")
    .toLowerCase();
}

async function getLookup(word) {
  const { lookupCache = {} } = await chrome.storage.local.get({ lookupCache: {} });
  const cached = lookupCache[word];
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) return cached.data;

  const [dictionary, chinese] = await Promise.all([
    fetchDictionaryApi(word),
    fetchChineseMeaning(word)
  ]);

  const data = {
    word,
    phonetic: dictionary.phonetic || "",
    audio: dictionary.audio || "",
    chinese: chinese || LOCAL_ZH[word] || "暂无中文释义，可在联网后重试。",
    englishDefinition: dictionary.englishDefinition || "A word found in the current English page.",
    partOfSpeech: dictionary.partOfSpeech || "",
    example: dictionary.example || makeSimpleSentence(word, dictionary.partOfSpeech),
    source: dictionary.source || "fallback"
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
      source: "dictionaryapi.dev"
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

function simplifyDefinition(definition) {
  if (!definition) return "";
  const cleaned = definition.replace(/\s+/g, " ").trim();
  if (cleaned.length <= 150) return cleaned;
  return `${cleaned.slice(0, 147).trim()}...`;
}

function cleanChineseText(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .replace(/网络释义|专业释义|英英释义/g, "")
    .trim();
}

function makeSimpleSentence(word, partOfSpeech) {
  const article = /^[aeiou]/i.test(word) ? "an" : "a";
  if (partOfSpeech === "verb") return `I can ${word} this idea in a simple way.`;
  if (partOfSpeech === "adjective") return `This is a ${word} example.`;
  if (partOfSpeech === "adverb") return `She spoke ${word} and everyone understood.`;
  return `I found ${article} ${word} in the article.`;
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

async function getWordBook() {
  const { wordStats = {} } = await chrome.storage.local.get({ wordStats: {} });
  const words = Object.values(wordStats)
    .map((item) => ({
      ...item,
      confusables: getConfusables(item.word)
    }))
    .sort((a, b) => (b.count || 0) - (a.count || 0) || a.word.localeCompare(b.word));

  return {
    ok: true,
    words,
    frequencyGroups: groupByFrequency(words),
    confusableGroups: groupByConfusables(words)
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
    .filter((group) => group.length > 0)
    .map((group) => ({
      title: group.join(" / "),
      words: group.map((word) => words.find((item) => item.word === word))
    }));

  const fuzzy = [];
  for (const item of words) {
    const matches = words.filter((candidate) => {
      if (candidate.word === item.word) return false;
      return areSimilarWords(item.word, candidate.word);
    });
    if (matches.length > 0 && !fuzzy.some((group) => group.words.some((word) => word.word === item.word))) {
      fuzzy.push({
        title: [item.word, ...matches.map((match) => match.word)].join(" / "),
        words: [item, ...matches]
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
