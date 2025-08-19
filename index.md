# 索引

<h1>全ページ索引</h1>
<p id="count" style="opacity:.8"></p>
<input id="filter" placeholder="フィルタ（タイトルに含まれる文字）" style="padding:.5rem; width:100%; max-width:420px;">

<ul id="list"></ul>

<script type="module">
  const listEl   = document.getElementById('list');
  const countEl  = document.getElementById('count');
  const filterEl = document.getElementById('filter');

  const idx = await fetch('/contentIndex.json').then(r => r.json());

  // contentIndex.json の形に合わせてタイトルとURLを抽出
  // （Quartz v4の既定: each page has { slug, title, date, tags, ... }）
  let items = idx.pages
    .filter(p => !p.draft)               // draftを除外（必要なら）
    .map(p => ({
      title: p.title || p.slug,
      url:   '/' + p.slug,
      date:  p.date || null,
      tags:  p.tags || []
    }))
    .sort((a,b) => a.title.localeCompare(b.title, 'ja'));

  const render = (rows) => {
    listEl.innerHTML = '';
    for (const p of rows) {
      const li = document.createElement('li');
      const a  = document.createElement('a');
      a.href = p.url;
      a.textContent = p.title;
      li.appendChild(a);

      // 追記: タグや日付を薄字で
      const meta = [];
      if (p.date) meta.push(new Date(p.date).toLocaleDateString('ja-JP'));
      if (p.tags.length) meta.push('#' + p.tags.join(' #'));
      if (meta.length) {
        const span = document.createElement('span');
        span.style.opacity = '.6';
        span.style.marginLeft = '.5rem';
        span.textContent = '— ' + meta.join(' · ');
        li.appendChild(span);
      }

      listEl.appendChild(li);
    }
    countEl.textContent = `全 ${rows.length} ページ`;
  };

  filterEl.addEventListener('input', () => {
    const q = filterEl.value.trim();
    if (!q) return render(items);
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    render(items.filter(p => re.test(p.title)));
  });

  render(items);
</script>
