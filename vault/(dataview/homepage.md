---
aliases:
---

```dataviewjs
/***** ランダム1ページ + 冒頭プレビュー
 * 仕様：
 *  - 初回表示時：今日の分が未保存なら自動抽選→保存→表示
 *  - 同じ日：再読込しても変わらない（保存値を表示）
 *  - 「再抽選」ボタン：その日の保存値を上書き
 *  - 日付が変わると自動で別キーになるので翌日は未保存→抽選
 *****/

/*** 設定 ***/
const EXCLUDE_PATTERNS = [
  "(dataview",
  "(guideline",
  "(MOC",
  "(Template",
  "(author's note"
];
const INCLUDE_TAGS = [];      // 例: ["#history"]
const INCLUDE_FOLDERS = [];   // 例: ["history/"]
const MAX_PREVIEW_CHARS = 280;

/*** 候補集め（メタデータのみで軽量） ***/
let candidates = dv.pages()
  .where(p => p.file && p.file.ext === "md")
  .where(p => p.file.path !== dv.current().file.path)
  .where(p => { for (let x of EXCLUDE_PATTERNS) if (p.file.path.includes(x)) return false; return true; })
  .where(p => { if (INCLUDE_TAGS.length === 0) return true; const tags = p.file.tags ?? []; return tags.some(t => INCLUDE_TAGS.includes(t)); })
  .where(p => { if (INCLUDE_FOLDERS.length === 0) return true; return INCLUDE_FOLDERS.some(f => p.file.path.startsWith(f)); });

/*** DataArray → 配列化 ***/
let items = [];
for (let p of candidates) items.push(p);

/*** UI骨組み ***/
dv.header(3, "今日のランダムノート（固定／再抽選可）");
const wrap = dv.el("div", "", { cls: "rnd1-wrap" });
const topbar = wrap.createEl("div", { cls: "rnd1-topbar" });
topbar.createEl("span", { text: `候補：${items.length}件` });

const btn = topbar.createEl("button", { text: "再抽選" });
btn.addClass("mod-cta");
const card = wrap.createEl("div", { cls: "rnd1-card" });

/*** ユーティリティ ***/
const today = dv.date("today").toFormat("yyyy-LL-dd"); // ローカル日付
const vaultName = app.vault.getName?.() ?? "vault";
const notePath = dv.current().file.path;
const LS_KEY = `randnote:${vaultName}:${notePath}:${today}`;

function pickOne(arr) {
  if (arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}
function stripFrontmatter(s) {
  return s.replace(/^---[\s\S]*?---\s*/m, "");
}
function makePreview(s, maxChars) {
  s = stripFrontmatter(s)
    .replace(/\r\n/g, "\n")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "") // 画像除去
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // リンクはテキストだけに
    .replace(/^#.*$/gm, "") // 見出し行除去
    .trim();
  const lines = s.split("\n").filter(l => l.trim().length > 0);
  let t = lines.slice(0, 5).join(" ");
  if (t.length > maxChars) t = t.slice(0, maxChars) + "…";
  return t || "(本文なし)";
}
function fmt(dvdate) { return dvdate?.toFormat?.("yyyy-LL-dd") ?? ""; }

function getStoredPath() {
  try { return window.localStorage.getItem(LS_KEY); } catch { return null; }
}
function setStoredPath(p) {
  try { window.localStorage.setItem(LS_KEY, p); } catch {}
}
function clearCardWith(msg) {
  card.empty();
  card.createEl("p", { text: msg });
}

/*** レンダリング（パス指定版） ***/
async function renderByPath(path) {
  // 今の候補から該当を探す（削除/除外された場合に備える）
  const p = items.find(x => x.file.path === path) ?? pickOne(items);
  if (!p) { clearCardWith("対象ノートがありません（絞り込みを確認してね）"); return; }

  card.empty();
  const head = card.createEl("div", { cls: "rnd1-head" });
  const titleSpan = dv.el("span", p.file.link);
  head.appendChild(titleSpan);
  card.createEl("div", { cls: "rnd1-meta", text: `作成: ${fmt(p.file.ctime)} / 更新: ${fmt(p.file.mtime)} / ${p.file.folder ?? ""}` });

  let text = "";
  try { text = await dv.io.load(p.file.path) ?? ""; } catch {}
  const preview = makePreview(text, MAX_PREVIEW_CHARS);
  card.createEl("div", { cls: "rnd1-preview", text: preview });

  const foot = card.createEl("div", { cls: "rnd1-foot" });
  const openBtn = foot.createEl("button", { text: "このノートを開く" });
  openBtn.onclick = () => app.workspace.openLinkText(p.file.path, p.file.path, true);

  // 表示に使った実パスで保存（存在しない保存値を引いたときの救済）
  setStoredPath(p.file.path);
}

/*** 初期挙動：保存があればそれを表示、なければ抽選→保存 ***/
(async function init() {
  if (items.length === 0) {
    clearCardWith("対象ノートがありません（絞り込みを確認してね）");
    return;
  }
  const saved = getStoredPath();
  if (saved) {
    await renderByPath(saved);
  } else {
    const picked = pickOne(items);
    if (!picked) { clearCardWith("対象ノートがありません"); return; }
    setStoredPath(picked.file.path);
    await renderByPath(picked.file.path);
  }
})();

/*** ボタン：引き直し→保存を上書き ***/
btn.onclick = async () => {
  if (items.length === 0) return;
  const picked = pickOne(items);
  if (!picked) return;
  setStoredPath(picked.file.path);
  await renderByPath(picked.file.path);
};

/*** CSS ***/
const style = document.createElement("style");
style.textContent = `
.rnd1-topbar { display:flex; align-items:center; gap:.5rem; margin-bottom:.5rem; }
.rnd1-card { border:1px solid var(--background-modifier-border); border-radius:8px; padding:.75rem; }
.rnd1-head { font-weight:600; margin-bottom:.25rem; }
.rnd1-meta { font-size:.85em; opacity:.8; margin-bottom:.5rem; }
.rnd1-preview { white-space:pre-wrap; line-height:1.5; }
.rnd1-foot { margin-top:.5rem; display:flex; gap:.5rem; }
`;
document.head.appendChild(style);

```

```dataviewjs
// === 設定 ===
const GRID = 10;          // 10x10 固定
const PER_CELL = 10;      // 1マス=10記事
const CELL_PX = 14;       // セル一辺(px)
const GAP_PX  = 2;        // セル間隔(px)

// 色
const FILLED_BG = '#2ecc71';
const EMPTY_BG  = '#30343b';
const BORDER    = '#555a61';

// カウント対象（必要に応じて調整）
const isCountTarget = (p) => true;

// === 計算 ===
const totalCells = GRID * GRID;           // 100
const perBlock   = PER_CELL * totalCells; // 1000
const count      = dv.pages().where(isCountTarget).length;
const blocks     = Math.floor(count / perBlock);
const remainder  = count % perBlock;
const filled     = Math.min(totalCells, Math.floor(remainder / PER_CELL));
const pct        = (remainder / perBlock * 100).toFixed(1);

// === テキスト ===
dv.paragraph(`達成した1000ブロック：${blocks}`);
dv.paragraph(`現在のブロック進捗：${remainder} / ${perBlock}（${pct}%）`);

// === グリッド（セルの位置を明示指定して左上始まりを強制） ===
const grid = dv.el('div', '', {
  attr: {
    style: [
      'display: grid',
      `grid-template-columns: repeat(${GRID}, ${CELL_PX}px)`,
      `grid-template-rows: repeat(${GRID}, ${CELL_PX}px)`,
      `gap: ${GAP_PX}px`,
      // 左上起点を徹底、親の影響を最小化
      'margin: 4px 0 0',
      'padding: 0',
      'text-indent: 0',
      'direction: ltr',
      'place-content: start',
      'place-items: start',
      'box-sizing: border-box',
      'user-select: none'
    ].join('; ')
  }
});

// 位置を row/col で明示（row 1..10, col 1..10）
for (let i = 0; i < totalCells; i++) {
  const row = Math.floor(i / GRID) + 1;
  const col = (i % GRID) + 1;
  const done = i < filled;

  const cell = document.createElement('div');
  Object.assign(cell.style, {
    gridRow: String(row),
    gridColumn: String(col),
    width: `${CELL_PX}px`,
    height: `${CELL_PX}px`,
    background: done ? FILLED_BG : EMPTY_BG,
    border: `1px solid ${BORDER}`,
    borderRadius: '3px',
    boxSizing: 'border-box',
  });
  grid.appendChild(cell);
}
```

```dataviewjs
const total = 100000;
const current = dv.pages().length;

const percent2 = (current / total) * 100;
dv.paragraph(`🌌 100,000記事への旅: ${percent2}%達成 (${current}/${total})`);

```
```dataview
TABLE file.tags AS Tags, file.mtime AS Updated
FROM #stub OR #wip
SORT file.mtime ASC

```
```dataviewjs
// Show general vault stats
let s = await window.showStats();
dv.paragraph(s);
```
