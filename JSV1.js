/* 恢復本經文出處解析器：與 recovery_verses.py 的解析邏輯一致。
 * 瀏覽器：<script src="parser.js"> 之後使用 RV.*
 * Node：const RV = require("./parser.js");
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.RV = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const OUTPUT_SUFFIX = "_經文擷取.txt";
  const NAME_CHARS = 10;
  const MAX_VERSE = 176; // 單章最多 176 節（詩一一九）
  const ERR_SOURCE = "出處來源有誤，請查看";
  const ERR_SCRAPE = "未抓取到經文，請查看";

  // [全名, 簡寫, 章數]
  const BOOKS = [
    ["創世記", "創", 50], ["出埃及記", "出", 40], ["利未記", "利", 27],
    ["民數記", "民", 36], ["申命記", "申", 34], ["約書亞記", "書", 24],
    ["士師記", "士", 21], ["路得記", "得", 4], ["撒母耳記上", "撒上", 31],
    ["撒母耳記下", "撒下", 24], ["列王紀上", "王上", 22], ["列王紀下", "王下", 25],
    ["歷代志上", "代上", 29], ["歷代志下", "代下", 36], ["以斯拉記", "拉", 10],
    ["尼希米記", "尼", 13], ["以斯帖記", "斯", 10], ["約伯記", "伯", 42],
    ["詩篇", "詩", 150], ["箴言", "箴", 31], ["傳道書", "傳", 12],
    ["雅歌", "歌", 8], ["以賽亞書", "賽", 66], ["耶利米書", "耶", 52],
    ["耶利米哀歌", "哀", 5], ["以西結書", "結", 48], ["但以理書", "但", 12],
    ["何西阿書", "何", 14], ["約珥書", "珥", 3], ["阿摩司書", "摩", 9],
    ["俄巴底亞書", "俄", 1], ["約拿書", "拿", 4], ["彌迦書", "彌", 7],
    ["那鴻書", "鴻", 3], ["哈巴谷書", "哈", 3], ["西番雅書", "番", 3],
    ["哈該書", "該", 2], ["撒迦利亞書", "亞", 14], ["瑪拉基書", "瑪", 4],
    ["馬太福音", "太", 28], ["馬可福音", "可", 16], ["路加福音", "路", 24],
    ["約翰福音", "約", 21], ["使徒行傳", "徒", 28], ["羅馬書", "羅", 16],
    ["哥林多前書", "林前", 16], ["哥林多後書", "林後", 13], ["加拉太書", "加", 6],
    ["以弗所書", "弗", 6], ["腓立比書", "腓", 4], ["歌羅西書", "西", 4],
    ["帖撒羅尼迦前書", "帖前", 5], ["帖撒羅尼迦後書", "帖後", 3],
    ["提摩太前書", "提前", 6], ["提摩太後書", "提後", 4], ["提多書", "多", 3],
    ["腓利門書", "門", 1], ["希伯來書", "來", 13], ["雅各書", "雅", 5],
    ["彼得前書", "彼前", 5], ["彼得後書", "彼後", 3], ["約翰一書", "約壹", 5],
    ["約翰二書", "約貳", 1], ["約翰三書", "約參", 1], ["猶大書", "猶", 1],
    ["啟示錄", "啟", 22],
  ];
  if (BOOKS.length !== 66) throw new Error("書卷表應有 66 卷");

  const ALIASES = { "啓": "啟示錄" }; // 異體字

  const BOOK_MAPPING = new Map();
  function register(key, info) {
    if (BOOK_MAPPING.has(key) && BOOK_MAPPING.get(key) !== info) {
      throw new Error("書卷名稱重複：" + key);
    }
    BOOK_MAPPING.set(key, info);
  }
  for (const [full, abbr, max] of BOOKS) {
    const info = { full, abbr, max };
    register(full, info);
    register(abbr, info);
  }
  for (const [alias, full] of Object.entries(ALIASES)) register(alias, BOOK_MAPPING.get(full));

  const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const alt = (keys) =>
    [...keys].sort((a, b) => b.length - a.length).map(escapeRe).join("|");

  const BOOK_ALT = alt(BOOK_MAPPING.keys());
  const SINGLE_ALT = alt([...BOOK_MAPPING].filter(([, v]) => v.max === 1).map(([k]) => k));

  // 章：中文數字（二二、十一）或阿拉伯數字加冒號（22:）；節：阿拉伯數字，「、」列舉、「～」範圍
  const CN = "[〇零一二三四五六七八九十百兩]+";
  const RANGE = "[～~〜\\-–－]";
  const SEG_PAT = `\\d+(?:${RANGE}(?:${CN}[:：]?)?\\d+)?`;
  const VS = `${SEG_PAT}(?:、${SEG_PAT})*`;
  const CHAP = `(?:(?<cn>${CN})[:：章]?|(?<ar>\\d+)[:：章])`;
  const FOOT = "(?<fn>[註注]\\d+(?:[、,]\\d+)*)?";
  const TAIL = `節?${FOOT}`;

  // y 旗標：只從 lastIndex 開始比對
  const FULL_RE = new RegExp(`(?<book>${BOOK_ALT})${CHAP}(?<vs>${VS})${TAIL}`, "y");
  const SINGLE_RE = new RegExp(`(?<book>${SINGLE_ALT})(?<vs>${VS})${TAIL}`, "y");
  const CV_RE = new RegExp(`${CHAP}(?<vs>${VS})${TAIL}`, "y");
  const BARE_RE = new RegExp(`(?<vs>${VS})節${FOOT}`, "y");
  const SEG_RE = new RegExp(`^(?<a>\\d+)(?:${RANGE}(?:(?<ec>${CN})[:：]?)?(?<b>\\d+))?$`);
  const SEP_RE = /\s*[，,；;]\s*/y;
  const DASHES = "—―─";

  const DIGITS = { "〇": 0, "零": 0, "一": 1, "二": 2, "兩": 2, "三": 3, "四": 4,
                   "五": 5, "六": 6, "七": 7, "八": 8, "九": 9 };

  function cnToInt(s) {
    if (/^\d+$/.test(s)) return parseInt(s, 10);
    if (s.includes("百") || s.includes("十")) {
      let total = 0, cur = 0;
      for (const ch of s) {
        if (ch === "百") { total += (cur || 1) * 100; cur = 0; }
        else if (ch === "十") { total += (cur || 1) * 10; cur = 0; }
        else cur = DIGITS[ch];
      }
      return total + cur;
    }
    return parseInt([...s].map((ch) => DIGITS[ch]).join(""), 10);
  }

  function matchAt(rx, line, pos) {
    rx.lastIndex = pos;
    return rx.exec(line);
  }
  const endOf = (m) => m.index + m[0].length;

  // Ref：{book, chapter, verse(null 表示出處有誤), tag}
  function expand(info, chap, vs) {
    const { full, abbr } = info;
    if (!(chap >= 1 && chap <= info.max)) {
      return [{ book: full, abbr, chapter: chap, verse: null, tag: `${abbr}${chap}:${vs}` }];
    }
    const out = [];
    for (const seg of vs.split("、")) {
      const bad = { book: full, abbr, chapter: chap, verse: null, tag: `${abbr}${chap}:${seg}` };
      const sm = SEG_RE.exec(seg);
      if (!sm || sm.groups.ec) { out.push(bad); continue; } // 跨章範圍無法離線展開
      const a = parseInt(sm.groups.a, 10);
      const b = sm.groups.b ? parseInt(sm.groups.b, 10) : a;
      if (!(a >= 1 && a <= b && b <= MAX_VERSE)) { out.push(bad); continue; } // 例如「加二1920」
      for (let v = a; v <= b; v++) {
        out.push({ book: full, abbr, chapter: chap, verse: v, tag: `${abbr}${chap}:${v}` });
      }
    }
    return out;
  }

  // 出處種類：full 書卷＋章＋節；cv 章＋節（沿用書卷）；bare 只有「N節」（沿用最靠近的前一個出處）
  function parseOutline(text) {
    const refs = [];
    let last = null; // [info, chap]

    function match(line, pos, inList) {
      const pats = [["full", FULL_RE], ["single", SINGLE_RE]];
      if (inList) pats.push(["cv", CV_RE], ["bare", BARE_RE]);
      for (const [kind, rx] of pats) {
        const m = matchAt(rx, line, pos);
        if (m) return [kind, m];
      }
      return null;
    }

    function parseList(line, start, hit) {
      let [info, chap] = last || [null, null];
      let end = start;
      while (hit) {
        const [kind, m] = hit;
        const vs = m.groups.vs;
        if (kind === "full" || kind === "single") {
          info = BOOK_MAPPING.get(m.groups.book);
          chap = kind === "single" ? 1 : cnToInt(m.groups.cn || m.groups.ar);
        } else if (kind === "cv") {
          chap = cnToInt(m.groups.cn || m.groups.ar);
        } // bare：沿用目前的 info、chap

        if (info == null || chap == null) {
          refs.push({ book: "", abbr: "", chapter: 0, verse: null, tag: m[0] });
        } else {
          refs.push(...expand(info, chap, vs));
          if (chap >= 1 && chap <= info.max) last = [info, chap];
        }

        end = endOf(m);
        const sep = matchAt(SEP_RE, line, end);
        hit = sep ? match(line, endOf(sep), true) : null;
      }
      return Math.max(end, start + 1);
    }

    function parseLine(line) {
      let i = 0;
      const n = line.length;
      while (i < n) {
        let hit = match(line, i, false);
        if (!hit && DASHES.includes(line[i])) {
          let k = i + 1;
          while (k < n && /\s/.test(line[k])) k++;
          const bm = matchAt(BARE_RE, line, k);
          if (bm) hit = ["bare", bm];
        }
        if (!hit) { i++; continue; }
        i = parseList(line, i, hit);
      }
    }

    for (const raw of text.split(/\r\n|\r|\n/)) {
      const line = raw.trim();
      if (line) parseLine(line);
    }
    return refs;
  }

  function dedupe(refs) {
    const seen = new Set();
    return refs.filter((r) => (seen.has(r.tag) ? false : (seen.add(r.tag), true)));
  }

  // 檔名 = 輸入文字的前 10 個字 + _經文擷取.txt（略過空白與檔名不能用的符號）
  function makeOutputName(text) {
    const chars = Array.from(text).filter((c) => !/\s/.test(c) && !'\\/:*?"<>|\0'.includes(c));
    return (chars.slice(0, NAME_CHARS).join("") || "output") + OUTPUT_SUFFIX;
  }

  // 清理網站上的經文文字（與 Python 的 clean_verse_text 相同）
  function cleanVerseText(raw) {
    return raw
      .replace(/[a-zA-Z]/g, "")
      .replace(/(?<=[^\d])\d+/g, "")
      .replace(/^\d+[:：]?\d*\s*/, "")
      .replace(/(?<=[^\x00-\x7F])\s+(?=[^\x00-\x7F])/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  return {
    BOOK_MAPPING, ERR_SOURCE, ERR_SCRAPE,
    cnToInt, expand, parseOutline, dedupe, makeOutputName, cleanVerseText,
  };
});