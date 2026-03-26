// --- Hiragana to Romaji (client-side for live preview) ---
const HIRAGANA_MAP = [
  ['きゃ','kya'],['きゅ','kyu'],['きょ','kyo'],
  ['しゃ','sha'],['しゅ','shu'],['しょ','sho'],
  ['ちゃ','cha'],['ちゅ','chu'],['ちょ','cho'],
  ['にゃ','nya'],['にゅ','nyu'],['にょ','nyo'],
  ['ひゃ','hya'],['ひゅ','hyu'],['ひょ','hyo'],
  ['みゃ','mya'],['みゅ','myu'],['みょ','myo'],
  ['りゃ','rya'],['りゅ','ryu'],['りょ','ryo'],
  ['ぎゃ','gya'],['ぎゅ','gyu'],['ぎょ','gyo'],
  ['じゃ','ja'],['じゅ','ju'],['じょ','jo'],
  ['びゃ','bya'],['びゅ','byu'],['びょ','byo'],
  ['ぴゃ','pya'],['ぴゅ','pyu'],['ぴょ','pyo'],
  ['が','ga'],['ぎ','gi'],['ぐ','gu'],['げ','ge'],['ご','go'],
  ['ざ','za'],['じ','ji'],['ず','zu'],['ぜ','ze'],['ぞ','zo'],
  ['だ','da'],['ぢ','di'],['づ','du'],['で','de'],['ど','do'],
  ['ば','ba'],['び','bi'],['ぶ','bu'],['べ','be'],['ぼ','bo'],
  ['ぱ','pa'],['ぴ','pi'],['ぷ','pu'],['ぺ','pe'],['ぽ','po'],
  ['か','ka'],['き','ki'],['く','ku'],['け','ke'],['こ','ko'],
  ['さ','sa'],['し','shi'],['す','su'],['せ','se'],['そ','so'],
  ['た','ta'],['ち','chi'],['つ','tsu'],['て','te'],['と','to'],
  ['な','na'],['に','ni'],['ぬ','nu'],['ね','ne'],['の','no'],
  ['は','ha'],['ひ','hi'],['ふ','fu'],['へ','he'],['ほ','ho'],
  ['ま','ma'],['み','mi'],['む','mu'],['め','me'],['も','mo'],
  ['や','ya'],['ゆ','yu'],['よ','yo'],
  ['ら','ra'],['り','ri'],['る','ru'],['れ','re'],['ろ','ro'],
  ['わ','wa'],['を','wo'],['ん','n'],
  ['あ','a'],['い','i'],['う','u'],['え','e'],['お','o'],
  ['ー','-'],['っ','Q'],
];

function toRomaji(hiragana) {
  let result = '', i = 0;
  while (i < hiragana.length) {
    let matched = false;
    if (i + 1 < hiragana.length) {
      const two = hiragana.substring(i, i + 2);
      for (const [k, r] of HIRAGANA_MAP) {
        if (k === two) { result += r; i += 2; matched = true; break; }
      }
    }
    if (!matched) {
      const one = hiragana[i];
      let found = false;
      for (const [k, r] of HIRAGANA_MAP) {
        if (k === one) { result += r; found = true; break; }
      }
      if (!found) result += one;
      i++;
    }
  }
  return result;
}

function extractVowels(romaji) {
  return romaji.replace(/[^aiueo]/g, '');
}

// --- Toast ---
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2000);
}

// --- API helpers ---
async function api(url, opts = {}) {
  if (opts.body) {
    opts.headers = { 'Content-Type': 'application/json', ...opts.headers };
    opts.body = JSON.stringify(opts.body);
  }
  const res = await fetch(url, opts);
  return res.json();
}

// --- State ---
let allTags = [];
let selectedTagIds = new Set();

// --- Tab navigation ---
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('panel-' + btn.dataset.tab).classList.add('active');
    if (btn.dataset.tab === 'dictionary') loadDictionary();
    if (btn.dataset.tab === 'favorites') loadFavorites();
  });
});

// --- Live Preview ---
const inputReading = document.getElementById('input-reading');
const previewBox = document.getElementById('live-preview');
const previewRomaji = document.getElementById('preview-romaji');
const previewVowels = document.getElementById('preview-vowels');

inputReading.addEventListener('input', () => {
  const val = inputReading.value.trim();
  if (val) {
    const r = toRomaji(val);
    const v = extractVowels(r);
    previewRomaji.textContent = r;
    previewVowels.textContent = v.split('').join(' - ');
    previewBox.style.display = 'block';
  } else {
    previewBox.style.display = 'none';
  }
});

// --- Tags ---
async function loadTags() {
  allTags = await api('/api/tags');
  renderTags();
  renderTagFilter();
}

function renderTags() {
  const list = document.getElementById('tag-list');
  list.innerHTML = allTags.map(t => `
    <label class="tag-chip ${selectedTagIds.has(t.id) ? 'selected' : ''}" data-id="${t.id}">
      <input type="checkbox" ${selectedTagIds.has(t.id) ? 'checked' : ''}>
      ${t.name}
    </label>
  `).join('');

  list.querySelectorAll('.tag-chip').forEach(chip => {
    chip.addEventListener('click', (e) => {
      e.preventDefault();
      const id = Number(chip.dataset.id);
      if (selectedTagIds.has(id)) {
        selectedTagIds.delete(id);
        chip.classList.remove('selected');
      } else {
        selectedTagIds.add(id);
        chip.classList.add('selected');
      }
    });
  });
}

function renderTagFilter() {
  const select = document.getElementById('dict-tag-filter');
  select.innerHTML = '<option value="">全タグ</option>' +
    allTags.map(t => `<option value="${t.name}">${t.name}</option>`).join('');
}

// --- Register ---
document.getElementById('btn-register').addEventListener('click', async () => {
  const kanji = document.getElementById('input-kanji').value.trim();
  const reading = inputReading.value.trim();
  if (!kanji || !reading) {
    showToast('漢字と読みを入力してください');
    return;
  }
  if (!/^[\u3040-\u309Fー]+$/.test(reading)) {
    showToast('読みはひらがなで入力してください');
    return;
  }

  const result = await api('/api/words', {
    method: 'POST',
    body: { kanji, reading, tagIds: [...selectedTagIds] },
  });

  if (result.error) {
    showToast(result.error);
    return;
  }

  showToast(`「${kanji}」を登録しました！`);
  document.getElementById('input-kanji').value = '';
  inputReading.value = '';
  previewBox.style.display = 'none';
  selectedTagIds.clear();
  renderTags();
});

// --- Dictionary ---
async function loadDictionary() {
  const search = document.getElementById('dict-search').value.trim();
  const tag = document.getElementById('dict-tag-filter').value;
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (tag) params.set('tag', tag);

  const words = await api('/api/words?' + params.toString());
  const list = document.getElementById('word-list');
  const countEl = document.getElementById('dict-count');
  countEl.textContent = `${words.length}語 登録済み`;

  if (words.length === 0) {
    list.innerHTML = '<div class="empty">まだ単語が登録されていません。<br>「登録」タブから韻を育てよう！</div>';
    return;
  }

  // Group by vowel pattern
  const groups = {};
  for (const w of words) {
    if (!groups[w.vowel_pattern]) groups[w.vowel_pattern] = [];
    groups[w.vowel_pattern].push(w);
  }

  let html = '';
  for (const [pattern, groupWords] of Object.entries(groups)) {
    html += `<div class="vowel-group-header">${pattern.split('').join(' - ')}</div>`;
    for (const w of groupWords) {
      const tags = w.tags ? w.tags.split(',').map(t => `<span class="tag-badge">${t}</span>`).join('') : '';
      html += `
        <div class="word-card">
          <div class="word-info">
            <span class="word-kanji">${w.kanji}</span>
            <span class="word-reading">${w.reading}</span>
            <div class="word-meta">
              <span class="vowel-badge">${w.vowel_pattern}</span>
              ${tags}
            </div>
          </div>
          <div class="word-actions">
            <button class="btn btn-small btn-ghost" onclick="findRhymes(${w.id})">韻を探す</button>
            <button class="btn btn-small btn-danger" onclick="deleteWord(${w.id})">削除</button>
          </div>
        </div>`;
    }
  }
  list.innerHTML = html;
}

document.getElementById('dict-search').addEventListener('input', debounce(loadDictionary, 300));
document.getElementById('dict-tag-filter').addEventListener('change', loadDictionary);

async function deleteWord(id) {
  if (!confirm('この単語を削除しますか？')) return;
  await api(`/api/words/${id}`, { method: 'DELETE' });
  showToast('削除しました');
  loadDictionary();
}

// --- Find rhymes for a registered word ---
async function findRhymes(id) {
  // Switch to search tab and show results
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelector('[data-tab="search"]').classList.add('active');
  document.getElementById('panel-search').classList.add('active');

  const data = await api(`/api/words/${id}/rhymes`);
  const infoEl = document.getElementById('search-info');
  const resultsEl = document.getElementById('search-results');

  document.getElementById('search-reading').value = data.word.reading;
  infoEl.innerHTML = `
    <div class="preview-box">
      <strong>${data.word.kanji}</strong>（${data.word.reading}）の韻
      <div class="vowels" style="margin-top:0.3rem">${data.word.vowel_pattern.split('').join(' - ')}</div>
    </div>
  `;

  renderRhymeResults(resultsEl, data.rhymes, data.word.id);
}

// --- Reverse Lookup ---
document.getElementById('btn-search').addEventListener('click', async () => {
  const reading = document.getElementById('search-reading').value.trim();
  if (!reading) { showToast('読みを入力してください'); return; }

  const data = await api('/api/rhyme-search?reading=' + encodeURIComponent(reading));
  const infoEl = document.getElementById('search-info');
  const resultsEl = document.getElementById('search-results');

  infoEl.innerHTML = `
    <div class="preview-box">
      <div>ローマ字: <span class="romaji">${data.input.romaji}</span></div>
      <div>母音: <span class="vowels">${data.input.vowelPattern.split('').join(' - ')}</span></div>
    </div>
  `;

  renderRhymeResults(resultsEl, data.rhymes, null);
});

function renderRhymeResults(container, rhymes, sourceWordId) {
  if (rhymes.length === 0) {
    container.innerHTML = '<div class="empty">韻が見つかりませんでした。<br>もっと言葉を登録して辞書を育てよう！</div>';
    return;
  }

  container.innerHTML = rhymes.map(r => {
    const hClass = hardnessClass(r.rhyme.label);
    const tags = r.tags ? r.tags.split(',').map(t => `<span class="tag-badge">${t}</span>`).join('') : '';
    const favBtn = sourceWordId
      ? `<button class="btn btn-small btn-ghost" onclick="saveFavorite(${sourceWordId},${r.id})">&#9825;</button>`
      : '';
    return `
      <div class="rhyme-card">
        <div>
          <span class="word-kanji">${r.kanji}</span>
          <span class="word-reading">${r.reading}</span>
          <div class="word-meta">
            <span class="vowel-badge">${r.vowel_pattern}</span>
            ${tags}
          </div>
        </div>
        <div style="text-align:right;display:flex;gap:0.4rem;align-items:center">
          <div>
            <span class="hardness-badge ${hClass}">${r.rhyme.label}</span>
            <div class="rhyme-match-info">${r.rhyme.matchCount}母音一致 (${r.rhyme.hardness}%)</div>
          </div>
          ${favBtn}
        </div>
      </div>`;
  }).join('');
}

function hardnessClass(label) {
  switch (label) {
    case 'ガチガチ': return 'hardness-gachigachi';
    case '硬い': return 'hardness-katai';
    case 'まあまあ': return 'hardness-maamaa';
    case '柔らかい': return 'hardness-yawarakai';
    default: return '';
  }
}

// --- Favorites ---
async function saveFavorite(w1, w2) {
  const result = await api('/api/favorites', {
    method: 'POST',
    body: { word1Id: w1, word2Id: w2 },
  });
  if (result.error) {
    showToast(result.error);
  } else {
    showToast('お気に入りに追加しました！');
  }
}

async function loadFavorites() {
  const favs = await api('/api/favorites');
  const container = document.getElementById('fav-list');

  if (favs.length === 0) {
    container.innerHTML = '<div class="empty">お気に入りの韻ペアはまだありません。<br>韻を検索して &#9825; で保存しよう！</div>';
    return;
  }

  container.innerHTML = favs.map(f => {
    const hClass = hardnessClass(f.rhyme.label);
    return `
      <div class="fav-card">
        <div class="fav-pair">
          <span class="word-kanji">${f.word1_kanji}</span>
          <span class="fav-vs">x</span>
          <span class="word-kanji">${f.word2_kanji}</span>
          <span class="hardness-badge ${hClass}">${f.rhyme.label}</span>
        </div>
        <button class="btn btn-small btn-danger" onclick="deleteFavorite(${f.id})">削除</button>
      </div>`;
  }).join('');
}

async function deleteFavorite(id) {
  await api(`/api/favorites/${id}`, { method: 'DELETE' });
  showToast('お気に入りを削除しました');
  loadFavorites();
}

// --- Utils ---
function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

// --- Init ---
loadTags();
