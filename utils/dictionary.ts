import type { DictionaryEntry, DuplicatePair, LegacyDictionaryEntry, SourceRecord } from '~/types/dictionary';

const uid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 9)}-${Date.now().toString(36)}`;

export const normalizeWord = (value: string) => value
  .normalize('NFKC')
  .toLowerCase()
  .replace(/[\s·.'’\-_()[\]{}，。！？、]/g, '');

const bigrams = (value: string) => {
  const text = normalizeWord(value);
  if (text.length < 2) return text ? [text] : [];
  return Array.from({ length: text.length - 1 }, (_, index) => text.slice(index, index + 2));
};

export const similarity = (left: string, right: string) => {
  const a = bigrams(left);
  const b = bigrams(right);
  if (!a.length || !b.length) return 0;
  const remaining = [...b];
  let hits = 0;
  a.forEach((token) => {
    const index = remaining.indexOf(token);
    if (index >= 0) {
      hits += 1;
      remaining.splice(index, 1);
    }
  });
  return (2 * hits) / (a.length + b.length);
};

export const findDuplicates = (entries: DictionaryEntry[]): DuplicatePair[] => {
  const pairs: DuplicatePair[] = [];
  entries.forEach((left, index) => {
    entries.slice(index + 1).forEach((right) => {
      const headwordScore = similarity(left.headword, right.headword);
      const synonymScore = Math.max(0, ...left.synonyms.map((word) => similarity(word, right.headword)), ...right.synonyms.map((word) => similarity(word, left.headword)));
      const meaningScore = similarity(left.definition, right.definition) * .35;
      const score = Math.max(headwordScore, synonymScore * .92, meaningScore);
      if (score < .62) return;
      const reasons: string[] = [];
      if (headwordScore === score) reasons.push('词形高度相似');
      if (synonymScore * .92 === score) reasons.push('同义词交叉命中');
      if (meaningScore === score) reasons.push('释义相近');
      if (left.pronunciation && right.pronunciation && similarity(left.pronunciation, right.pronunciation) > .72) reasons.push('发音相近');
      pairs.push({ leftId: left.id, rightId: right.id, score: Math.min(1, score), reasons });
    });
  });
  return pairs.sort((a, b) => b.score - a.score);
};

export const referencesToEntry = (entries: DictionaryEntry[], target: DictionaryEntry) => {
  const names = new Set([target.headword, ...target.synonyms].map(normalizeWord));
  return entries.filter((entry) => entry.id !== target.id && (
    entry.synonyms.some((synonym) => names.has(normalizeWord(synonym)))
    || entry.definition.includes(target.headword)
    || entry.examples.some((example) => names.has(normalizeWord(example.source)))
  ));
};

/** 来源内容指纹：标题、引用信息和链接完全一致时视为同一份来源 */
export const sourceKey = (source: Pick<SourceRecord, 'title' | 'citation' | 'url'>) =>
  [source.title, source.citation, source.url].map(normalizeWord).join('|');

export interface SourceNormalizationResult {
  entries: DictionaryEntry[];
  sources: SourceRecord[];
  mergedCount: number;
}

/**
 * 把词条内联的旧版来源整理进来源册：
 * 内容相同的来源只保留一条，各词条改为按 id 引用同一条记录。
 * 对已迁移的数据重复执行是安全的（幂等）。
 */
export const normalizeEntrySources = (
  rawEntries: LegacyDictionaryEntry[],
  library: SourceRecord[] = [],
  now: () => string = () => new Date().toISOString()
): SourceNormalizationResult => {
  const sources = library.map((source) => ({ ...source }));
  const byKey = new Map(sources.map((source) => [sourceKey(source), source]));
  const byId = new Map(sources.map((source) => [source.id, source]));
  let mergedCount = 0;

  const entries = rawEntries.map((raw) => {
    const { sources: legacySources, sourceIds, ...rest } = raw;
    const ids: string[] = [];
    const pushId = (id: string) => { if (!ids.includes(id)) ids.push(id); };

    (sourceIds ?? []).forEach((id) => { if (byId.has(id)) pushId(id); });
    (legacySources ?? []).forEach((legacy) => {
      const key = sourceKey(legacy);
      const existing = byKey.get(key);
      if (existing) {
        if (existing.id !== legacy.id) mergedCount += 1;
        pushId(existing.id);
        return;
      }
      const record: SourceRecord = {
        id: legacy.id || uid('source'),
        title: legacy.title,
        citation: legacy.citation,
        url: legacy.url,
        createdAt: now(),
        updatedAt: now()
      };
      sources.push(record);
      byKey.set(key, record);
      byId.set(record.id, record);
      pushId(record.id);
    });

    return { ...rest, sourceIds: ids } as DictionaryEntry;
  });

  return { entries, sources, mergedCount };
};
