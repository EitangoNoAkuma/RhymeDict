const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const { hiraganaToRomaji, getVowelPattern, calcRhymeHardness } = require('./utils/romaji');

const app = express();
app.use(express.json());
app.use(express.static('public'));

// --- Database Setup ---
const db = new Database(path.join(__dirname, 'rhyme.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS words (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kanji TEXT NOT NULL,
    reading TEXT NOT NULL,
    romaji TEXT NOT NULL,
    vowel_pattern TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS word_tags (
    word_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    PRIMARY KEY (word_id, tag_id),
    FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS favorite_pairs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    word1_id INTEGER NOT NULL,
    word2_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (word1_id) REFERENCES words(id) ON DELETE CASCADE,
    FOREIGN KEY (word2_id) REFERENCES words(id) ON DELETE CASCADE,
    UNIQUE(word1_id, word2_id)
  );

  CREATE INDEX IF NOT EXISTS idx_vowel_pattern ON words(vowel_pattern);
`);

// Seed default tags
const defaultTags = ['ポジティブ', 'ネガティブ', '自然', '感情', '日常', '抽象', 'スラング'];
const insertTag = db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)');
for (const tag of defaultTags) {
  insertTag.run(tag);
}

// --- API Routes ---

// Register a word
app.post('/api/words', (req, res) => {
  const { kanji, reading, tagIds } = req.body;
  if (!kanji || !reading) {
    return res.status(400).json({ error: '漢字と読みは必須です' });
  }

  // Validate hiragana
  if (!/^[\u3040-\u309Fー]+$/.test(reading)) {
    return res.status(400).json({ error: '読みはひらがなで入力してください' });
  }

  const romaji = hiraganaToRomaji(reading);
  const vowelPattern = getVowelPattern(reading);

  const stmt = db.prepare('INSERT INTO words (kanji, reading, romaji, vowel_pattern) VALUES (?, ?, ?, ?)');
  const result = stmt.run(kanji, reading, romaji, vowelPattern);

  // Add tags
  if (tagIds && tagIds.length > 0) {
    const tagStmt = db.prepare('INSERT OR IGNORE INTO word_tags (word_id, tag_id) VALUES (?, ?)');
    for (const tagId of tagIds) {
      tagStmt.run(result.lastInsertRowid, tagId);
    }
  }

  const word = db.prepare(`
    SELECT w.*, GROUP_CONCAT(t.name) as tags
    FROM words w
    LEFT JOIN word_tags wt ON w.id = wt.word_id
    LEFT JOIN tags t ON wt.tag_id = t.id
    WHERE w.id = ?
    GROUP BY w.id
  `).get(result.lastInsertRowid);

  res.json(word);
});

// List all words sorted by vowel pattern
app.get('/api/words', (req, res) => {
  const { tag, search } = req.query;
  let query = `
    SELECT w.*, GROUP_CONCAT(DISTINCT t.name) as tags
    FROM words w
    LEFT JOIN word_tags wt ON w.id = wt.word_id
    LEFT JOIN tags t ON wt.tag_id = t.id
  `;
  const conditions = [];
  const params = [];

  if (tag) {
    conditions.push('t.name = ?');
    params.push(tag);
  }
  if (search) {
    conditions.push('(w.kanji LIKE ? OR w.reading LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' GROUP BY w.id ORDER BY w.vowel_pattern, w.reading';
  const words = db.prepare(query).all(...params);
  res.json(words);
});

// Find rhymes for a word
app.get('/api/words/:id/rhymes', (req, res) => {
  const word = db.prepare('SELECT * FROM words WHERE id = ?').get(req.params.id);
  if (!word) return res.status(404).json({ error: '単語が見つかりません' });

  const allWords = db.prepare('SELECT * FROM words WHERE id != ?').all(word.id);

  const rhymes = allWords
    .map(w => ({
      ...w,
      rhyme: calcRhymeHardness(word.vowel_pattern, w.vowel_pattern),
    }))
    .filter(w => w.rhyme.matchCount > 0)
    .sort((a, b) => b.rhyme.matchCount - a.rhyme.matchCount);

  res.json({ word, rhymes });
});

// Reverse lookup: find rhymes by reading input (doesn't need to be registered)
app.get('/api/rhyme-search', (req, res) => {
  const { reading } = req.query;
  if (!reading) return res.status(400).json({ error: '読みを入力してください' });

  const vowelPattern = getVowelPattern(reading);
  const romaji = hiraganaToRomaji(reading);
  const allWords = db.prepare(`
    SELECT w.*, GROUP_CONCAT(DISTINCT t.name) as tags
    FROM words w
    LEFT JOIN word_tags wt ON w.id = wt.word_id
    LEFT JOIN tags t ON wt.tag_id = t.id
    GROUP BY w.id
  `).all();

  const rhymes = allWords
    .map(w => ({
      ...w,
      rhyme: calcRhymeHardness(vowelPattern, w.vowel_pattern),
    }))
    .filter(w => w.rhyme.matchCount > 0)
    .sort((a, b) => b.rhyme.matchCount - a.rhyme.matchCount);

  res.json({
    input: { reading, romaji, vowelPattern },
    rhymes,
  });
});

// Delete a word
app.delete('/api/words/:id', (req, res) => {
  db.prepare('DELETE FROM words WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Tags
app.get('/api/tags', (_req, res) => {
  res.json(db.prepare('SELECT * FROM tags ORDER BY name').all());
});

app.post('/api/tags', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'タグ名は必須です' });
  try {
    const result = db.prepare('INSERT INTO tags (name) VALUES (?)').run(name);
    res.json({ id: result.lastInsertRowid, name });
  } catch {
    res.status(409).json({ error: 'そのタグは既に存在します' });
  }
});

// Favorite pairs
app.get('/api/favorites', (_req, res) => {
  const favorites = db.prepare(`
    SELECT fp.id, fp.created_at,
           w1.kanji as word1_kanji, w1.reading as word1_reading, w1.vowel_pattern as word1_vowels, w1.id as word1_id,
           w2.kanji as word2_kanji, w2.reading as word2_reading, w2.vowel_pattern as word2_vowels, w2.id as word2_id
    FROM favorite_pairs fp
    JOIN words w1 ON fp.word1_id = w1.id
    JOIN words w2 ON fp.word2_id = w2.id
    ORDER BY fp.created_at DESC
  `).all();

  res.json(favorites.map(f => ({
    ...f,
    rhyme: calcRhymeHardness(f.word1_vowels, f.word2_vowels),
  })));
});

app.post('/api/favorites', (req, res) => {
  const { word1Id, word2Id } = req.body;
  const minId = Math.min(word1Id, word2Id);
  const maxId = Math.max(word1Id, word2Id);
  try {
    db.prepare('INSERT INTO favorite_pairs (word1_id, word2_id) VALUES (?, ?)').run(minId, maxId);
    res.json({ success: true });
  } catch {
    res.status(409).json({ error: '既にお気に入りに登録済みです' });
  }
});

app.delete('/api/favorites/:id', (req, res) => {
  db.prepare('DELETE FROM favorite_pairs WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`韻辞書サーバー起動: http://localhost:${PORT}`);
});
