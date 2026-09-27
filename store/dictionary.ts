import { computed, reactive, ref } from 'vue';
import { defineStore } from 'pinia';
import type {
  AuditRecord, DictionaryEntry, DictionarySnapshot, DictionarySource, DuplicatePair, EntryStatus,
  LegacyDictionaryEntry, ReviewComment, VersionRecord
} from '~/types/dictionary';
import { findDuplicates, sourceKey } from '~/utils/dictionary';

const now = () => new Date().toISOString();
const uid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 9)}-${Date.now().toString(36)}`;
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

// 种子数据沿用旧版“词条内嵌来源”的写法，初始化时会被 normalizeEntries 收进共享来源册，
// 其中「嘎木村发音人访谈」被 entry-001 与 entry-006 重复填写，首次打开即自动合并为一条。
const seedEntries = (): LegacyDictionaryEntry[] => [
  {
    id: 'entry-001', headword: 'ŋgɨ³³', pronunciation: 'ŋgɨ˧˧（低平调）', partOfSpeech: '名词', definition: '山间常年不涸的小水潭；也用来比喻安静而可靠的人。',
    dialectVariants: [
      { id: 'v-1', dialect: '北坡话', form: 'ŋgɨ³³ tsha⁵⁵', pronunciation: 'ŋgɨ tsha', note: '强调泉水源头' },
      { id: 'v-2', dialect: '河谷话', form: 'a³³ ŋgɨ³³', pronunciation: 'a ŋgɨ', note: '前缀形式' }
    ],
    examples: [
      { id: 'ex-1', text: 'a³³ ŋgɨ³³ ma³³ ʔmɨ⁵⁵.', translation: '这个小水潭是甜的。', source: '民间故事·寻找水源' },
      { id: 'ex-2', text: 'ŋgɨ³³ tɕi⁵⁵ dza³³.', translation: '山泉到了冬天也不会干。', source: '访谈录音 2018-04' }
    ],
    sources: [
      { id: 'src-1', title: '北坡方言词汇表', citation: '李某某记录，1987，手稿第 42 页', url: '' },
      { id: 'src-2', title: '嘎木村发音人访谈', citation: '录音 A-2018-04-17，00:12:31', url: '' }
    ],
    synonyms: ['水潭', '泉水'], status: 'confirmed', notes: '声调标音经两位发音人复核。', createdAt: '2024-08-11T04:00:00.000Z', updatedAt: '2025-03-09T06:12:00.000Z', reviewerComments: []
  },
  {
    id: 'entry-002', headword: 'dʑa⁵⁵', pronunciation: 'dʑa˥（高平调）', partOfSpeech: '动词', definition: '把谷物摊开晾晒；引申为耐心等待事情成熟。',
    dialectVariants: [{ id: 'v-3', dialect: '东南村话', form: 'dʑa⁵⁵ ka³³', pronunciation: 'dʑa ka', note: '带结果补语 habitual 形式' }],
    examples: [{ id: 'ex-3', text: 'kho⁵⁵ dʑa⁵⁵ tɕhi³³.', translation: '谷子已经摊开晒了。', source: '田野记录 2023-09-12' }],
    sources: [{ id: 'src-3', title: '东南村生产词调查', citation: '王某某，2023，词条 071', url: '' }],
    synonyms: ['晒', '等待'], status: 'review', notes: '“等待”的引申义需由审校人确认。', createdAt: '2024-10-01T06:00:00.000Z', updatedAt: '2025-02-18T02:00:00.000Z',
    reviewerComments: [{ id: 'c-1', field: 'definition', author: '主审·和老师', message: '“等待”是短语层面的临时义还是固定引申义？请补充一条例句。', status: 'open', createdAt: '2025-02-18T02:00:00.000Z', replies: [] }]
  },
  {
    id: 'entry-003', headword: 'dʑa³³', pronunciation: 'dʑa˧（中调）', partOfSpeech: '动词', definition: '摊晒谷物，使水分蒸发。', dialectVariants: [], examples: [{ id: 'ex-4', text: 'dʑa³³ ko⁵⁵ kho⁵⁵.', translation: '把粮食拿去晒。', source: '语音调查 M-12' }], sources: [{ id: 'src-4', title: '方言调查卡片', citation: '1992，卡片 M-12', url: '' }], synonyms: ['晒粮'], status: 'disputed', notes: '与 dʑa⁵⁵ 可能是同一词条的声调变体。', createdAt: '2024-12-01T06:00:00.000Z', updatedAt: '2025-02-20T03:00:00.000Z', reviewerComments: []
  },
  {
    id: 'entry-004', headword: 'ʔma³³', pronunciation: 'ʔma˧', partOfSpeech: '名词', definition: '母亲；也可用于称呼年长女性亲属。', dialectVariants: [{ id: 'v-4', dialect: '河西话', form: 'ma³³', pronunciation: 'ma', note: '喉塞音弱化' }], examples: [{ id: 'ex-5', text: 'ʔma³³, ŋa⁵⁵ tɕi³³ lo³³.', translation: '妈妈，我要回家了。', source: '日常生活会话 01' }], sources: [{ id: 'src-5', title: '亲缘称谓调查', citation: '赵某某，2011，表 3', url: '' }], synonyms: ['妈妈', '母亲'], status: 'draft', notes: '需补充敬称形式。', createdAt: '2025-01-11T04:00:00.000Z', updatedAt: '2025-01-11T04:00:00.000Z', reviewerComments: []
  },
  {
    id: 'entry-005', headword: 'lo³³', pronunciation: 'lo˧', partOfSpeech: '方向词', definition: '表示向说话者所在位置移动，常与位移动词搭配。', dialectVariants: [], examples: [{ id: 'ex-6', text: 'a³³ mɨ⁵⁵ lo³³.', translation: '到这里来。', source: '语法调查句表 03' }], sources: [{ id: 'src-6', title: '动词方向范畴笔记', citation: '陈某某，2005，第 18 页', url: 'https://example.org/field-notes/directional-verbs' }], synonyms: ['来'], status: 'confirmed', notes: '', createdAt: '2024-09-18T02:00:00.000Z', updatedAt: '2025-01-04T02:00:00.000Z', reviewerComments: []
  },
  {
    id: 'entry-006', headword: 'tsha⁵⁵', pronunciation: 'tsha˥', partOfSpeech: '名词', definition: '水源；泉水涌出的地方。', dialectVariants: [], examples: [{ id: 'ex-7', text: 'tsha⁵⁵ ʔmɨ⁵⁵ ma³³.', translation: '泉眼在这个地方。', source: '地名调查 2022-07' }],
    sources: [
      { id: 'src-7', title: '村落地名调查', citation: '录音 C-2022-07，00:22:08', url: '' },
      { id: 'src-8', title: '嘎木村发音人访谈', citation: '录音 A-2018-04-17，00:12:31', url: '' }
    ],
    synonyms: ['泉眼', '水潭'], status: 'review', notes: '', createdAt: '2025-02-01T02:00:00.000Z', updatedAt: '2025-02-25T02:00:00.000Z',
    reviewerComments: [{ id: 'c-2', field: 'sources', author: '审校·罗老师', message: '请把录音中发言人姓名补到资料来源。', status: 'open', createdAt: '2025-02-25T02:00:00.000Z', replies: [{ id: 'r-1', author: '编辑·阿木', message: '已向调查员索取授权信息，暂以录音编号占位。', createdAt: '2025-02-26T01:00:00.000Z' }] }]
  }
];

const seedAudit: AuditRecord[] = [{
  id: 'audit-seed', at: now(), action: '载入工作区', detail: '初始化 6 个词条、7 条共享来源（相同来源已自动合并）、2 条待回复审校意见和 1 组疑似重复词条', entryIds: []
}];

/**
 * 把旧版“词条内嵌来源”的数据整理进共享来源册：
 * 内容相同（标题 + 引用信息 + 链接）的来源合并为一条，词条改为按 id 引用。
 * 对已经迁移过的数据是幂等的，撤销、重做、版本恢复都走同一条路径。
 */
function normalizeEntries(rawEntries: LegacyDictionaryEntry[], library: DictionarySource[]): DictionaryEntry[] {
  const byKey = new Map<string, DictionarySource>();
  const idRemap = new Map<string, string>();
  const deduped: DictionarySource[] = [];
  library.forEach((source) => {
    const key = sourceKey(source);
    const existing = byKey.get(key);
    if (existing) {
      idRemap.set(source.id, existing.id);
      return;
    }
    byKey.set(key, source);
    deduped.push(source);
  });
  library.splice(0, library.length, ...deduped);

  return rawEntries.map((raw) => {
    const entry: LegacyDictionaryEntry = raw;
    const ids: string[] = [];
    (entry.sourceIds ?? []).forEach((id) => {
      const mapped = idRemap.get(id) ?? id;
      if (!ids.includes(mapped) && library.some((source) => source.id === mapped)) ids.push(mapped);
    });
    (entry.sources ?? []).forEach((legacy) => {
      const key = sourceKey(legacy);
      let source = byKey.get(key);
      if (!source) {
        const id = library.some((item) => item.id === legacy.id) ? uid('source') : legacy.id;
        source = { id, title: legacy.title ?? '', citation: legacy.citation ?? '', url: legacy.url ?? '' };
        byKey.set(key, source);
        library.push(source);
      }
      if (!ids.includes(source.id)) ids.push(source.id);
    });
    entry.sourceIds = ids;
    delete entry.sources;
    return entry as DictionaryEntry;
  });
}

export const useDictionaryStore = defineStore('dictionary', () => {
  const revision = ref(1);
  const sourceLibrary = reactive<DictionarySource[]>([]);
  const entries = reactive<DictionaryEntry[]>(normalizeEntries(seedEntries(), sourceLibrary));
  const versions = reactive<VersionRecord[]>([]);
  const audit = reactive<AuditRecord[]>(seedAudit);
  const selectedId = ref(entries[0]?.id ?? '');
  const hydrated = ref(false);
  const undoStack = ref<DictionarySnapshot[]>([]);
  const redoStack = ref<DictionarySnapshot[]>([]);
  const query = ref('');
  const statusFilter = ref<EntryStatus | 'all'>('all');
  const dialectFilter = ref('all');
  const fieldReplyDrafts = reactive<Record<string, string>>({});

  const selectedEntry = computed(() => entries.find((entry) => entry.id === selectedId.value) ?? entries[0]);
  const persistableSnapshot = computed<DictionarySnapshot>(() => ({
    revision: revision.value,
    entries: clone(entries),
    sourceLibrary: clone(sourceLibrary),
    versions: clone(versions),
    audit: clone(audit)
  }));
  const duplicates = computed<DuplicatePair[]>(() => findDuplicates(entries));
  const openComments = computed(() => entries.reduce((sum, entry) => sum + entry.reviewerComments.filter((comment) => comment.status === 'open').length, 0));
  const sourcesById = computed(() => new Map(sourceLibrary.map((source) => [source.id, source])));
  /** 每条来源被哪些词条引用；词条增删、撤销重做、版本恢复后由这里自动重算 */
  const sourceUsage = computed(() => {
    const usage = new Map<string, DictionaryEntry[]>();
    sourceLibrary.forEach((source) => usage.set(source.id, []));
    entries.forEach((entry) => entry.sourceIds.forEach((id) => {
      const list = usage.get(id);
      if (list) list.push(entry);
      else usage.set(id, [entry]);
    }));
    return usage;
  });
  const filteredEntries = computed(() => {
    const term = query.value.trim().toLowerCase();
    return entries.filter((entry) => {
      if (statusFilter.value !== 'all' && entry.status !== statusFilter.value) return false;
      if (dialectFilter.value !== 'all' && !entry.dialectVariants.some((variant) => variant.dialect === dialectFilter.value)) return false;
      if (!term) return true;
      const haystack = [entry.headword, entry.definition, entry.partOfSpeech, entry.pronunciation, ...entry.synonyms, ...entry.sourceIds.map((id) => sourcesById.value.get(id)?.title ?? '')].join(' ').toLowerCase();
      return haystack.includes(term);
    });
  });
  const dialects = computed(() => [...new Set(entries.flatMap((entry) => entry.dialectVariants.map((variant) => variant.dialect)))].sort());

  function snapshot(): DictionarySnapshot {
    return {
      revision: revision.value,
      entries: clone(entries),
      sourceLibrary: clone(sourceLibrary),
      versions: clone(versions),
      audit: clone(audit)
    };
  }

  function restore(value: DictionarySnapshot) {
    revision.value = value.revision ?? 1;
    const library = clone(value.sourceLibrary ?? []);
    const normalized = normalizeEntries(clone(value.entries ?? []), library);
    sourceLibrary.splice(0, sourceLibrary.length, ...library);
    entries.splice(0, entries.length, ...normalized);
    versions.splice(0, versions.length, ...(clone(value.versions ?? [])));
    audit.splice(0, audit.length, ...(clone(value.audit ?? [])));
    if (!entries.some((entry) => entry.id === selectedId.value)) selectedId.value = entries[0]?.id ?? '';
  }

  function commit(action: string, detail: string, entryIds: string[], mutation: () => void) {
    undoStack.value = [...undoStack.value.slice(-49), snapshot()];
    redoStack.value = [];
    const before = clone(entries);
    const beforeSources = clone(sourceLibrary);
    mutation();
    revision.value += 1;
    entries.forEach((entry) => { if (entryIds.includes(entry.id)) entry.updatedAt = now(); });
    versions.unshift({ id: uid('version'), at: now(), action, detail, entryId: entryIds[0], before, beforeSources });
    versions.splice(120);
    audit.unshift({ id: uid('audit'), at: now(), action, detail, entryIds });
    audit.splice(300);
  }

  function createEntry() {
    const entry: DictionaryEntry = {
      id: uid('entry'), headword: '新词条', pronunciation: '', partOfSpeech: '', definition: '', dialectVariants: [], examples: [], sourceIds: [], synonyms: [], status: 'draft', notes: '', createdAt: now(), updatedAt: now(), reviewerComments: []
    };
    commit('新建词条', '创建草稿词条', [entry.id], () => entries.unshift(entry));
    selectedId.value = entry.id;
  }

  function updateField<K extends keyof DictionaryEntry>(entryId: string, field: K, value: DictionaryEntry[K], label = String(field)) {
    const entry = entries.find((item) => item.id === entryId);
    if (!entry || JSON.stringify(entry[field]) === JSON.stringify(value)) return;
    commit('编辑字段', `${label}发生更新`, [entryId], () => { entry[field] = value; });
  }

  function setStatus(entryId: string, status: EntryStatus) {
    const entry = entries.find((item) => item.id === entryId);
    if (!entry || entry.status === status) return;
    const labels: Record<EntryStatus, string> = { draft: '草稿', review: '待审', disputed: '争议', confirmed: '已确认' };
    commit('变更状态', `词条状态改为“${labels[status]}”`, [entryId], () => { entry.status = status; });
  }

  function addVariant(entryId: string) {
    const entry = entries.find((item) => item.id === entryId);
    if (!entry) return;
    const variant = { id: uid('variant'), dialect: '', form: '', pronunciation: '', note: '' };
    commit('新增方言变体', '添加一条方言变体', [entryId], () => entry.dialectVariants.push(variant));
  }

  function updateVariant(entryId: string, variantId: string, field: 'dialect' | 'form' | 'pronunciation' | 'note', value: string) {
    const entry = entries.find((item) => item.id === entryId);
    const variant = entry?.dialectVariants.find((item) => item.id === variantId);
    if (!entry || !variant || variant[field] === value) return;
    commit('编辑方言变体', `${field}发生更新`, [entryId], () => { variant[field] = value; });
  }

  function removeVariant(entryId: string, variantId: string) {
    const entry = entries.find((item) => item.id === entryId);
    if (!entry) return;
    commit('删除方言变体', '移除一条方言变体', [entryId], () => {
      const index = entry.dialectVariants.findIndex((variant) => variant.id === variantId);
      if (index >= 0) entry.dialectVariants.splice(index, 1);
    });
  }

  function addExample(entryId: string) {
    const entry = entries.find((item) => item.id === entryId);
    if (!entry) return;
    commit('新增例句', '添加一条例句', [entryId], () => entry.examples.push({ id: uid('example'), text: '', translation: '', source: '' }));
  }

  function updateExample(entryId: string, exampleId: string, field: 'text' | 'translation' | 'source', value: string) {
    const entry = entries.find((item) => item.id === entryId);
    const example = entry?.examples.find((item) => item.id === exampleId);
    if (!entry || !example || example[field] === value) return;
    commit('编辑例句', `${field}发生更新`, [entryId], () => { example[field] = value; });
  }

  function removeExample(entryId: string, exampleId: string) {
    const entry = entries.find((item) => item.id === entryId);
    if (!entry) return;
    commit('删除例句', '移除一条例句', [entryId], () => {
      const index = entry.examples.findIndex((item) => item.id === exampleId);
      if (index >= 0) entry.examples.splice(index, 1);
    });
  }

  /** 让词条引用来源册中已有的一条来源 */
  function attachSource(entryId: string, sourceId: string) {
    const entry = entries.find((item) => item.id === entryId);
    const source = sourceLibrary.find((item) => item.id === sourceId);
    if (!entry || !source || entry.sourceIds.includes(sourceId)) return;
    commit('引用来源', `“${entry.headword}”引用来源册中的“${source.title || '未命名来源'}”`, [entryId], () => entry.sourceIds.push(sourceId));
  }

  /** 新建来源并（可选）立即引用到词条；内容相同的来源会直接复用，避免重复填写 */
  function createSource(entryId: string | null, draft: Pick<DictionarySource, 'title' | 'citation' | 'url'>) {
    const clean = { title: draft.title.trim(), citation: draft.citation.trim(), url: draft.url.trim() };
    if (!clean.title && !clean.citation && !clean.url) return '';
    const existing = sourceLibrary.find((source) => sourceKey(source) === sourceKey(clean));
    if (existing) {
      if (entryId) attachSource(entryId, existing.id);
      return existing.id;
    }
    const source: DictionarySource = { id: uid('source'), ...clean };
    const entry = entryId ? entries.find((item) => item.id === entryId) : undefined;
    commit('新增来源', `来源册新增“${clean.title || '未命名来源'}”${entry ? `，并引用到“${entry.headword}”` : ''}`, entry ? [entry.id] : [], () => {
      sourceLibrary.unshift(source);
      entry?.sourceIds.push(source.id);
    });
    return source.id;
  }

  /** 修改来源册中的来源；所有引用它的词条同步显示最新内容，引用关系不变 */
  function updateLibrarySource(sourceId: string, field: 'title' | 'citation' | 'url', value: string) {
    const source = sourceLibrary.find((item) => item.id === sourceId);
    if (!source || source[field] === value) return;
    const labels = { title: '标题', citation: '引用信息', url: '链接' } as const;
    const affected = entries.filter((entry) => entry.sourceIds.includes(sourceId)).map((entry) => entry.id);
    commit('编辑来源', `来源“${source.title || '未命名来源'}”的${labels[field]}更新，同步 ${affected.length} 个引用词条`, affected, () => { source[field] = value; });
  }

  /** 取消词条对来源的引用；来源本身保留在来源册中 */
  function detachSource(entryId: string, sourceId: string) {
    const entry = entries.find((item) => item.id === entryId);
    if (!entry) return;
    const index = entry.sourceIds.indexOf(sourceId);
    if (index < 0) return;
    const source = sourcesById.value.get(sourceId);
    commit('取消来源引用', `“${entry.headword}”不再引用“${source?.title || '未命名来源'}”（来源保留在来源册）`, [entryId], () => entry.sourceIds.splice(index, 1));
  }

  /** 从来源册移除来源；仍被词条引用的来源不能移除 */
  function removeLibrarySource(sourceId: string) {
    const source = sourceLibrary.find((item) => item.id === sourceId);
    if (!source) return false;
    if (entries.some((entry) => entry.sourceIds.includes(sourceId))) return false;
    commit('移除来源', `从来源册移除“${source.title || '未命名来源'}”`, [], () => {
      const index = sourceLibrary.findIndex((item) => item.id === sourceId);
      if (index >= 0) sourceLibrary.splice(index, 1);
    });
    return true;
  }

  function setSynonyms(entryId: string, synonyms: string[]) {
    const entry = entries.find((item) => item.id === entryId);
    if (!entry) return;
    commit('编辑同义词', `同义词更新为 ${synonyms.join('、')}`, [entryId], () => { entry.synonyms = synonyms; });
  }

  function addComment(entryId: string, field: string, message: string, author = '主审·和老师') {
    const entry = entries.find((item) => item.id === entryId);
    if (!entry || !message.trim()) return;
    const comment: ReviewComment = { id: uid('comment'), field, author, message: message.trim(), status: 'open', createdAt: now(), replies: [] };
    commit('新增审校意见', `对“${field}”添加审校意见`, [entryId], () => entry.reviewerComments.unshift(comment));
  }

  function replyComment(entryId: string, commentId: string, message: string, author = '编辑·阿木') {
    const entry = entries.find((item) => item.id === entryId);
    const comment = entry?.reviewerComments.find((item) => item.id === commentId);
    if (!entry || !comment || !message.trim()) return;
    commit('回复审校意见', `回复“${comment.field}”字段意见`, [entryId], () => comment.replies.push({ id: uid('reply'), author, message: message.trim(), createdAt: now() }));
  }

  function toggleComment(entryId: string, commentId: string) {
    const entry = entries.find((item) => item.id === entryId);
    const comment = entry?.reviewerComments.find((item) => item.id === commentId);
    if (!entry || !comment) return;
    commit('处理审校意见', comment.status === 'open' ? '标记为已解决' : '重新打开意见', [entryId], () => {
      comment.status = comment.status === 'open' ? 'resolved' : 'open';
    });
  }

  function deleteEntry(entryId: string) {
    const entry = entries.find((item) => item.id === entryId);
    if (!entry) return;
    commit('删除词条', `删除“${entry.headword}”`, [entryId], () => {
      const index = entries.findIndex((item) => item.id === entryId);
      if (index >= 0) entries.splice(index, 1);
      selectedId.value = entries[0]?.id ?? '';
    });
  }

  function mergeEntries(targetId: string, sourceIds: string[], selected: Record<string, 'target' | 'source' | 'combine'>) {
    const target = entries.find((entry) => entry.id === targetId);
    const sources = entries.filter((entry) => sourceIds.includes(entry.id));
    if (!target || !sources.length) return;
    commit('合并重复词条', `将 ${sources.length} 个重复词条合并到“${target.headword}”`, [targetId, ...sourceIds], () => {
      sources.forEach((source) => {
        const layers: Array<keyof DictionaryEntry> = ['dialectVariants', 'examples', 'synonyms', 'reviewerComments'];
        layers.forEach((field) => {
          const targetValue = target[field] as unknown[];
          const sourceValue = source[field] as unknown[];
          targetValue.push(...clone(sourceValue));
        });
      });
      target.sourceIds = [...new Set([...target.sourceIds, ...sources.flatMap((source) => source.sourceIds)])];
      (['headword', 'pronunciation', 'partOfSpeech', 'definition', 'notes'] as const).forEach((field) => {
        const choice = selected[field] ?? 'target';
        if (choice === 'source') target[field] = sources[0]![field];
        if (choice === 'combine' && target[field] !== sources[0]![field]) target[field] = `${target[field]}；${sources[0]![field]}`;
      });
      target.status = 'disputed';
      sourceIds.forEach((id) => {
        const index = entries.findIndex((entry) => entry.id === id);
        if (index >= 0) entries.splice(index, 1);
      });
    });
  }

  function undo() {
    const value = undoStack.value.at(-1);
    if (!value) return;
    redoStack.value = [...redoStack.value, snapshot()];
    undoStack.value = undoStack.value.slice(0, -1);
    restore(value);
  }

  function redo() {
    const value = redoStack.value.at(-1);
    if (!value) return;
    undoStack.value = [...undoStack.value, snapshot()];
    redoStack.value = redoStack.value.slice(0, -1);
    restore(value);
  }

  function restoreVersion(versionId: string) {
    const version = versions.find((item) => item.id === versionId);
    if (!version) return;
    commit('恢复版本', `恢复 ${new Date(version.at).toLocaleString('zh-CN')} 之前的版本`, [], () => {
      const library = clone(version.beforeSources ?? []);
      const normalized = normalizeEntries(clone(version.before), library);
      sourceLibrary.splice(0, sourceLibrary.length, ...library);
      entries.splice(0, entries.length, ...normalized);
    });
  }

  function hydrateFromBrowser() {
    try {
      const raw = localStorage.getItem('sologsb-1021-dictionary-v1');
      if (raw) {
        const parsed = JSON.parse(raw) as DictionarySnapshot;
        const legacyCount = (parsed.entries ?? []).filter((entry) => Array.isArray((entry as LegacyDictionaryEntry).sources)).length;
        restore(parsed);
        if (legacyCount) {
          audit.unshift({
            id: uid('audit'), at: now(), action: '整理来源册',
            detail: `首次打开旧数据：${legacyCount} 个词条的内嵌来源已并入共享来源册，相同来源自动合并`,
            entryIds: []
          });
        }
      }
    } catch {
      localStorage.removeItem('sologsb-1021-dictionary-v1');
    } finally {
      hydrated.value = true;
    }
  }

  function exportPackage() {
    return JSON.stringify({ exportedAt: now(), ...persistableSnapshot.value }, null, 2);
  }

  return {
    revision, entries, sourceLibrary, versions, audit, selectedId, hydrated, query, statusFilter, dialectFilter, fieldReplyDrafts,
    selectedEntry, filteredEntries, dialects, duplicates, openComments, persistableSnapshot, sourcesById, sourceUsage,
    canUndo: computed(() => undoStack.value.length > 0), canRedo: computed(() => redoStack.value.length > 0),
    createEntry, updateField, setStatus, addVariant, updateVariant, removeVariant, addExample, updateExample, removeExample,
    attachSource, createSource, updateLibrarySource, detachSource, removeLibrarySource,
    setSynonyms, addComment, replyComment, toggleComment, deleteEntry, mergeEntries,
    undo, redo, restoreVersion, hydrateFromBrowser, exportPackage
  };
});
