/** Comparison-only normalization. Never use this value to persist/display a name. */
export function normalizeArabic(text: string): string {
  return text
    .normalize('NFKC')
    .replace(
      /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7-\u06E8\u06EA-\u06ED\u0898-\u089F\u08CA-\u08E1\u08E3-\u08FF\u0640]/g,
      ''
    )
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim();
}

// Explicit compound-name vocabulary: do not collapse arbitrary word boundaries.
const abdEndings = new Set(
  normalizeArabic(
    'الله الرحمن الرحيم الملك القدوس السلام المؤمن المهيمن العزيز الجبار المتكبر الخالق البارئ المصور الغفار القهار الوهاب الرزاق الفتاح العليم القابض الباسط الخافض الرافع المعز المذل السميع البصير الحكم العدل اللطيف الخبير الحليم العظيم الغفور الشكور العلي الكبير الحفيظ المقيت الحسيب الجليل الكريم الرقيب المجيب الواسع الحكيم الودود المجيد الباعث الشهيد الحق الوكيل القوي المتين الولي الحميد المحصي المبدئ المعيد المحيي المميت الحي القيوم الواجد الماجد الواحد الاحد الصمد القادر المقتدر المقدم المؤخر الاول الاخر الظاهر الباطن الوالي المتعالي البر التواب المنتقم العفو الرؤوف المقسط الجامع الغني المغني المانع الضار النافع النور الهادي البديع الباقي الوارث الرشيد الصبور المحسن الستار'
  ).split(' ')
);
const dinPrefixes = new Set([
  'نور',
  'صلاح',
  'سيف',
  'علاء',
  'بهاء',
  'ضياء',
  'جمال',
  'كمال',
  'شمس',
  'بدر',
  'زين',
  'عز',
  'نجم',
  'تقي',
  'محيي',
]);

/** Receives normalizeArabic output; joins only recognized, complete compounds. */
export function normalizeCompoundNames(normalized: string): string {
  const words = normalized.split(' ');
  const result: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const next = words[i + 1];
    if ((word === 'عبد' && abdEndings.has(next)) || (dinPrefixes.has(word) && next === 'الدين')) {
      result.push(word + next);
      i++;
    } else {
      result.push(word);
    }
  }
  return result.join(' ');
}

type NamedPerson = { id: string; name: string };
export type NameSearchEntry = Readonly<{
  original: string;
  normalized: string;
  canonical: string;
  words: readonly string[];
}>;
export type NameSearchIndex = ReadonlyMap<string, NameSearchEntry>;

/** Reuse unchanged names, remove deleted ids, and preserve input order for ties. */
export function buildNameIndex(
  persons: readonly NamedPerson[],
  previous?: NameSearchIndex
): NameSearchIndex {
  const index = new Map<string, NameSearchEntry>();
  for (const person of persons) {
    if (index.has(person.id)) continue;
    const cached = previous?.get(person.id);
    if (cached?.original === person.name) {
      index.set(person.id, cached);
    } else {
      const normalized = normalizeArabic(person.name);
      const canonical = normalizeCompoundNames(normalized);
      index.set(person.id, {
        original: person.name,
        normalized,
        canonical,
        words: canonical.split(' ').filter(Boolean),
      });
    }
  }
  if (previous && previous.size === index.size) {
    const oldEntries = previous.entries();
    if (
      [...index].every(([id, entry]) => {
        const old = oldEntries.next().value;
        return old?.[0] === id && old[1] === entry;
      })
    )
      return previous;
  }
  return index;
}

export function searchPersons(
  query: string,
  _persons: readonly NamedPerson[],
  index: NameSearchIndex
): string[] {
  const original = query.trim();
  const normalized = normalizeArabic(query);
  if (!normalized) return [];
  const canonical = normalizeCompoundNames(normalized);
  const terms = canonical.split(' ');
  const termSet = new Set(terms);
  // Buckets keep ranking linear and retain the existing data order within a tier.
  const buckets: string[][] = Array.from({ length: 7 }, () => []);
  for (const [id, entry] of index) {
    if (!entry.normalized) continue;
    if (entry.original === original) buckets[0].push(id);
    else if (entry.canonical === canonical) buckets[1].push(id);
    else if (entry.canonical.startsWith(canonical)) buckets[2].push(id);
    else if (entry.canonical.includes(` ${canonical}`)) buckets[3].push(id);
    else if (entry.canonical.includes(canonical)) buckets[4].push(id);
    else if (terms.every((term) => entry.canonical.includes(term))) buckets[5].push(id);
    // Preserve the old extra matches from a query containing an indexed word,
    // but only at word boundaries (عبد must not match inside عبدالرحمان).
    else if (entry.words.some((word) => termSet.has(word))) buckets[6].push(id);
  }
  return buckets.flat();
}
