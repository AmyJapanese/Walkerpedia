---
aliases:
---
#item #database
```dataviewjs
/***** 設定 *****/
// 必ず末尾スラッシュ（例: "org/gov/"）
const TAG_PREFIX = "item";

// 親タグ（"org/gov" 単体）を見出しとして出したいなら true
const INCLUDE_PARENT_BUCKET = true;

// 親子重複を避け、最も具体的（= 文字列が最長）のタグだけに入れる
const LEAF_ONLY = true;

/* 並び順: "name" | "ctime" | "mtime" | "chars"（charsは計測時のみ有効） */
const SORT_BY = "name";
const SORT_DIR = "asc";

/* ここが軽量化ポイント */
const COUNT_CHARS = true;      // 文字数を本当に計測する？（重い） falseならスキップ
const CHAR_LOAD_LIMIT = 150;   // 本文読み込みの上限件数（HITがこれ超えたら chars計測しない）
const FALLBACK_LINES = true;   // charsを測らない場合、行数を出す（速い）

/***** ユーティリティ *****/
const norm = t => t.replace(/^#/, "").replace(/\/+$/,"");
const prefixNoSlash = TAG_PREFIX.replace(/\/+$/,"");
const prefixWithSlash = prefixNoSlash + "/";

/***** 収集（早期フィルタ＆除外を最小限に） *****/
let pages = dv.pages()
  .where(p => p.file.ext === "md")
  .where(p => p.file.path !== dv.current().file.path)
  // タグ接頭辞で早期に絞る（ここが効く）
  .where(p => {
    const tags = (p.file.tags ?? []).map(norm);
    return tags.some(t => t === prefixNoSlash || t.startsWith(prefixWithSlash));
  });

/***** メタ付与（必要なときだけ本文読む） *****/
const metas = [];
// 文字数を計測するかどうかを決定（HIT数が多すぎたら切る）
const willCountChars = COUNT_CHARS && pages.length <= CHAR_LOAD_LIMIT;

for (const p of pages) {
  const tags = (p.file.tags ?? []).map(norm);

  // 該当タグ抽出
  let hits = [];
  for (const t of tags) {
    if (t === prefixNoSlash) { if (INCLUDE_PARENT_BUCKET) hits.push(t); }
    else if (t.startsWith(prefixWithSlash)) hits.push(t);
  }
  if (hits.length === 0) continue;

  // 最深のみ
  const useTags = LEAF_ONLY ? [hits.sort((a,b)=>b.length-a.length)[0]] : hits;

  // 軽量化：必要な場合のみ本文を読む
  let chars = null;
  let lines = null;
  if (willCountChars) {
    try {
      const text = await dv.io.load(p.file.path) ?? "";
      chars = text.length;
      if (FALLBACK_LINES) lines = text.split("\n").length;
    } catch {}
  } else if (FALLBACK_LINES) {
    // 本文を読まない代わりに Dataview側のキャッシュから行数を推定（safe: 読み込み不要）
    // Dataviewは file.content を直接持たないことが多いので、linesは null のままでもOK
    // ここでの lines は willCountChars=false の時は出せない場合もある点に注意
  }

  metas.push({
    page: p,
    c: p.file.ctime,
    m: p.file.mtime,
    tags: useTags,
    chars,      // null なら未計測
    lines       // null なら未計測
  });
}

/***** 並び替え *****/
const cmp = {
  name : (a,b)=> a.page.file.name.localeCompare(b.page.file.name),
  ctime: (a,b)=> a.c - b.c,
  mtime: (a,b)=> a.m - b.m,
  chars: (a,b)=> (a.chars ?? -1) - (b.chars ?? -1) // 未計測は後ろに寄る
}[SORT_BY] ?? ((a,b)=>0);

/***** グルーピング *****/
const groups = new Map();
for (const meta of metas) {
  for (const t of meta.tags) {
    const key = (t === prefixNoSlash) ? prefixNoSlash : t.slice(prefixWithSlash.length);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(meta);
  }
}

/***** 出力 *****/
const headers = willCountChars
  ? ["タイトル", "文字数", "作成日", "更新日"]
  : (FALLBACK_LINES ? ["タイトル", "行数(概算)", "作成日", "更新日"]
                    : ["タイトル", "作成日", "更新日"]);

let totalChars = 0, totalCount = 0, maxItem = null;

for (const key of [...groups.keys()].sort((a,b)=>a.localeCompare(b))) {
  const label = (key === prefixNoSlash)
    ? `${prefixNoSlash} (root)`
    : `${prefixWithSlash}${key}`;
  dv.header(2, label);

  const arr = groups.get(key).slice().sort(cmp);
  if (SORT_DIR === "desc") arr.reverse();

  const rows = arr.map(meta => {
    const base = [
      meta.page.file.link,
    ];
    if (willCountChars) {
      const c = meta.chars ?? 0;
      totalChars += c; totalCount += 1;
      if (!maxItem || c > (maxItem.chars ?? 0)) maxItem = meta;
      base.push(c.toLocaleString());
    } else if (FALLBACK_LINES) {
      base.push(meta.lines != null ? meta.lines.toLocaleString() : "—");
    }
    base.push(meta.c.toFormat("yyyy-MM-dd"), meta.m.toFormat("yyyy-MM-dd"));
    return base;
  });

  dv.table(headers, rows);
}

/***** フッター統計 *****/
if (willCountChars && totalCount) {
  const avg = Math.round(totalChars / totalCount);
  dv.paragraph(
    `最大：**${maxItem.page.file.link}**（${(maxItem.chars ?? 0).toLocaleString()} 文字） / ` +
    `平均：約${avg.toLocaleString()} 文字 / 合計：${totalChars.toLocaleString()} 文字`
  );
} else if (!willCountChars && COUNT_CHARS) {
  dv.paragraph(`※ 該当件数が ${CHAR_LOAD_LIMIT} 件を超えたため、パフォーマンス優先で文字数計測をスキップしました。`);
}

```