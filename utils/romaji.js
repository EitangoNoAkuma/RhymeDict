// Hiragana → Romaji conversion table
// Combined characters (拗音) must come before single characters
const HIRAGANA_MAP = [
  // 拗音 (combined)
  ['きゃ', 'kya'], ['きゅ', 'kyu'], ['きょ', 'kyo'],
  ['しゃ', 'sha'], ['しゅ', 'shu'], ['しょ', 'sho'],
  ['ちゃ', 'cha'], ['ちゅ', 'chu'], ['ちょ', 'cho'],
  ['にゃ', 'nya'], ['にゅ', 'nyu'], ['にょ', 'nyo'],
  ['ひゃ', 'hya'], ['ひゅ', 'hyu'], ['ひょ', 'hyo'],
  ['みゃ', 'mya'], ['みゅ', 'myu'], ['みょ', 'myo'],
  ['りゃ', 'rya'], ['りゅ', 'ryu'], ['りょ', 'ryo'],
  ['ぎゃ', 'gya'], ['ぎゅ', 'gyu'], ['ぎょ', 'gyo'],
  ['じゃ', 'ja'],  ['じゅ', 'ju'],  ['じょ', 'jo'],
  ['びゃ', 'bya'], ['びゅ', 'byu'], ['びょ', 'byo'],
  ['ぴゃ', 'pya'], ['ぴゅ', 'pyu'], ['ぴょ', 'pyo'],
  // 濁音・半濁音
  ['が', 'ga'], ['ぎ', 'gi'], ['ぐ', 'gu'], ['げ', 'ge'], ['ご', 'go'],
  ['ざ', 'za'], ['じ', 'ji'], ['ず', 'zu'], ['ぜ', 'ze'], ['ぞ', 'zo'],
  ['だ', 'da'], ['ぢ', 'di'], ['づ', 'du'], ['で', 'de'], ['ど', 'do'],
  ['ば', 'ba'], ['び', 'bi'], ['ぶ', 'bu'], ['べ', 'be'], ['ぼ', 'bo'],
  ['ぱ', 'pa'], ['ぴ', 'pi'], ['ぷ', 'pu'], ['ぺ', 'pe'], ['ぽ', 'po'],
  // 清音
  ['か', 'ka'], ['き', 'ki'], ['く', 'ku'], ['け', 'ke'], ['こ', 'ko'],
  ['さ', 'sa'], ['し', 'shi'], ['す', 'su'], ['せ', 'se'], ['そ', 'so'],
  ['た', 'ta'], ['ち', 'chi'], ['つ', 'tsu'], ['て', 'te'], ['と', 'to'],
  ['な', 'na'], ['に', 'ni'], ['ぬ', 'nu'], ['ね', 'ne'], ['の', 'no'],
  ['は', 'ha'], ['ひ', 'hi'], ['ふ', 'fu'], ['へ', 'he'], ['ほ', 'ho'],
  ['ま', 'ma'], ['み', 'mi'], ['む', 'mu'], ['め', 'me'], ['も', 'mo'],
  ['や', 'ya'], ['ゆ', 'yu'], ['よ', 'yo'],
  ['ら', 'ra'], ['り', 'ri'], ['る', 'ru'], ['れ', 're'], ['ろ', 'ro'],
  ['わ', 'wa'], ['を', 'wo'],
  ['ん', 'n'],
  // 母音
  ['あ', 'a'], ['い', 'i'], ['う', 'u'], ['え', 'e'], ['お', 'o'],
  // 特殊
  ['ー', '-'], ['っ', 'Q'],
];

function hiraganaToRomaji(hiragana) {
  let result = '';
  let i = 0;
  while (i < hiragana.length) {
    let matched = false;
    // Try 2-char match first (拗音)
    if (i + 1 < hiragana.length) {
      const two = hiragana.substring(i, i + 2);
      for (const [kana, romaji] of HIRAGANA_MAP) {
        if (kana === two) {
          result += romaji;
          i += 2;
          matched = true;
          break;
        }
      }
    }
    if (!matched) {
      const one = hiragana[i];
      let found = false;
      for (const [kana, romaji] of HIRAGANA_MAP) {
        if (kana === one) {
          result += romaji;
          found = true;
          break;
        }
      }
      if (!found) {
        result += one; // keep unknown chars as-is
      }
      i++;
    }
  }
  return result;
}

function extractVowels(romaji) {
  return romaji.replace(/[^aiueo]/g, '');
}

function getVowelPattern(hiragana) {
  const romaji = hiraganaToRomaji(hiragana);
  const vowels = extractVowels(romaji);
  return vowels;
}

// Calculate rhyme hardness between two vowel patterns
// Returns { matchCount, hardness, label }
function calcRhymeHardness(vowels1, vowels2) {
  const v1 = vowels1.split('');
  const v2 = vowels2.split('');
  let matchCount = 0;

  // Compare from the end
  let i = v1.length - 1;
  let j = v2.length - 1;
  while (i >= 0 && j >= 0) {
    if (v1[i] === v2[j]) {
      matchCount++;
      i--;
      j--;
    } else {
      break;
    }
  }

  const shorter = Math.min(v1.length, v2.length);
  const hardness = shorter > 0 ? matchCount / shorter : 0;

  let label;
  if (matchCount === 0) {
    label = '韻なし';
  } else if (hardness < 0.4) {
    label = '柔らかい';
  } else if (hardness < 0.7) {
    label = 'まあまあ';
  } else if (hardness < 1.0) {
    label = '硬い';
  } else {
    label = 'ガチガチ';
  }

  return { matchCount, hardness: Math.round(hardness * 100), label };
}

module.exports = { hiraganaToRomaji, extractVowels, getVowelPattern, calcRhymeHardness };
