export type EntryStatus = 'draft' | 'review' | 'disputed' | 'confirmed';

export interface DialectVariant {
  id: string;
  dialect: string;
  form: string;
  pronunciation: string;
  note: string;
}

export interface ExampleSentence {
  id: string;
  text: string;
  translation: string;
  source: string;
}

/** 旧版词条内联来源（迁移前的数据形状，仅用于首次打开时的自动合并） */
export interface DictionarySource {
  id: string;
  title: string;
  citation: string;
  url: string;
}

/** 来源册中的可复用来源，被多个词条按 id 引用 */
export interface SourceRecord {
  id: string;
  title: string;
  citation: string;
  url: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewComment {
  id: string;
  field: string;
  author: string;
  message: string;
  status: 'open' | 'resolved';
  createdAt: string;
  replies: Array<{ id: string; author: string; message: string; createdAt: string }>;
}

export interface DictionaryEntry {
  id: string;
  headword: string;
  pronunciation: string;
  partOfSpeech: string;
  definition: string;
  dialectVariants: DialectVariant[];
  examples: ExampleSentence[];
  sourceIds: string[];
  synonyms: string[];
  status: EntryStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
  reviewerComments: ReviewComment[];
}

/** 首次打开时可能遇到的旧版词条：来源仍内联在词条里 */
export type LegacyDictionaryEntry = Omit<DictionaryEntry, 'sourceIds'> & {
  sourceIds?: string[];
  sources?: DictionarySource[];
};

export interface VersionRecord {
  id: string;
  at: string;
  action: string;
  detail: string;
  entryId?: string;
  before: DictionaryEntry[];
  beforeSources?: SourceRecord[];
}

export interface AuditRecord {
  id: string;
  at: string;
  action: string;
  detail: string;
  entryIds: string[];
}

export interface DictionarySnapshot {
  revision: number;
  entries: DictionaryEntry[];
  sources: SourceRecord[];
  versions: VersionRecord[];
  audit: AuditRecord[];
}

export interface DuplicatePair {
  leftId: string;
  rightId: string;
  score: number;
  reasons: string[];
}
