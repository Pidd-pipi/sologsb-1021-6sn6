<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useDictionaryStore } from '~/store/dictionary';
import type { DictionarySource } from '~/types/dictionary';

const store = useDictionaryStore();
const emit = defineEmits<{ 'open-library': [sourceId?: string] }>();
const activeTab = ref('basic');
const entry = computed(() => store.selectedEntry);
const synonymsText = computed(() => entry.value?.synonyms.join('、') ?? '');

const eventValue = (event: any) => typeof event === 'string' || typeof event === 'number' ? String(event) : event?.target?.value ?? event?.e?.target?.value ?? event?.value ?? '';

const commitInput = (event: any, field: 'headword' | 'pronunciation' | 'partOfSpeech' | 'definition' | 'notes') => {
  if (!entry.value) return;
  store.updateField(entry.value.id, field, eventValue(event), field);
};

const pickId = ref('');
const createOpen = ref(false);
const draft = reactive({ title: '', citation: '', url: '' });

const linkedSources = computed(() => (entry.value?.sourceIds ?? [])
  .map((id) => store.sourcesById.get(id))
  .filter((source): source is DictionarySource => Boolean(source)));
const availableSources = computed(() => store.sourceLibrary.filter((source) => !(entry.value?.sourceIds ?? []).includes(source.id)));
const usageCount = (sourceId: string) => store.sourceUsage.get(sourceId)?.length ?? 0;

watch(() => entry.value?.id, () => {
  pickId.value = '';
  createOpen.value = false;
  draft.title = '';
  draft.citation = '';
  draft.url = '';
});

const attachPicked = () => {
  if (!entry.value || !pickId.value) return;
  store.attachSource(entry.value.id, pickId.value);
  pickId.value = '';
};

const saveNewSource = () => {
  if (!entry.value || !draft.title.trim()) return;
  store.createSource(entry.value.id, draft);
  draft.title = '';
  draft.citation = '';
  draft.url = '';
  createOpen.value = false;
};
</script>

<template>
  <section v-if="entry" :key="entry.id" class="panel entry-editor">
    <div class="editor-head">
      <div>
        <span class="eyebrow">02 / ENTRY EDITOR</span>
        <div class="lexeme-line"><h2>{{ entry.headword || '未命名词条' }}</h2><span>[{{ entry.pronunciation || '音标待补' }}]</span></div>
      </div>
      <div class="editor-actions">
        <t-tag :theme="entry.status === 'confirmed' ? 'success' : entry.status === 'disputed' ? 'danger' : entry.status === 'review' ? 'warning' : 'default'" variant="light">{{ entry.status }}</t-tag>
        <t-button size="small" variant="outline" @click="store.setStatus(entry.id, 'review')">提交待审</t-button>
        <t-button size="small" theme="success" @click="store.setStatus(entry.id, 'confirmed')">确认词条</t-button>
      </div>
    </div>

    <t-tabs v-model="activeTab" class="entry-tabs">
      <t-tab-panel value="basic" label="核心信息">
        <div class="editor-scroll">
          <div class="field-grid two">
            <label class="field-block"><span>词形 / 主条</span><t-input :default-value="entry.headword" @blur="commitInput($event, 'headword')" placeholder="输入民族文字、国际音标或拼音" /></label>
            <label class="field-block"><span>发音说明</span><t-input :default-value="entry.pronunciation" @blur="commitInput($event, 'pronunciation')" placeholder="声调、重音或发音人说明" /></label>
          </div>
          <div class="field-grid two compact-grid">
            <label class="field-block"><span>词性</span><t-select :model-value="entry.partOfSpeech" @change="(value: any) => store.updateField(entry.id, 'partOfSpeech', String(value || ''))" clearable>
              <t-option value="名词" label="名词" /><t-option value="动词" label="动词" /><t-option value="形容词" label="形容词" /><t-option value="副词" label="副词" /><t-option value="方向词" label="方向词" /><t-option value="量词" label="量词" /><t-option value="短语" label="短语" />
            </t-select></label>
            <label class="field-block"><span>同义词（用顿号分隔）</span><t-input :default-value="synonymsText" @blur="store.setSynonyms(entry.id, eventValue($event).split(/[、,，]/).map((item: string) => item.trim()).filter(Boolean))" placeholder="水潭、泉眼" /></label>
          </div>
          <label class="field-block"><span>释义</span><t-textarea :default-value="entry.definition" :autosize="{ minRows: 3, maxRows: 7 }" @blur="commitInput($event, 'definition')" placeholder="用简洁语言描述词义、语用限制和引申关系" /></label>
          <label class="field-block"><span>编者备注</span><t-textarea :default-value="entry.notes" :autosize="{ minRows: 2, maxRows: 5 }" @blur="commitInput($event, 'notes')" placeholder="记录不确定项、调查问题或整理说明" /></label>
        </div>
      </t-tab-panel>

      <t-tab-panel value="variants" label="方言变体">
        <div class="editor-scroll">
          <div class="section-title"><div><h3>方言与地域变体</h3><p>同一词条在不同方言点的形式、读音和限制。</p></div><t-button size="small" @click="store.addVariant(entry.id)">＋ 添加变体</t-button></div>
          <div v-for="variant in entry.dialectVariants" :key="variant.id" class="subcard">
            <button class="remove-button" title="删除变体" @click="store.removeVariant(entry.id, variant.id)">×</button>
            <div class="field-grid three">
              <label class="field-block"><span>方言点</span><t-input :default-value="variant.dialect" @blur="store.updateVariant(entry.id, variant.id, 'dialect', eventValue($event))" /></label>
              <label class="field-block"><span>词形</span><t-input :default-value="variant.form" @blur="store.updateVariant(entry.id, variant.id, 'form', eventValue($event))" /></label>
              <label class="field-block"><span>读音</span><t-input :default-value="variant.pronunciation" @blur="store.updateVariant(entry.id, variant.id, 'pronunciation', eventValue($event))" /></label>
            </div>
            <label class="field-block"><span>使用说明</span><t-input :default-value="variant.note" @blur="store.updateVariant(entry.id, variant.id, 'note', eventValue($event))" /></label>
          </div>
          <t-empty v-if="!entry.dialectVariants.length" description="暂未记录方言变体" />
        </div>
      </t-tab-panel>

      <t-tab-panel value="examples" label="例句">
        <div class="editor-scroll">
          <div class="section-title"><div><h3>自然语料例句</h3><p>保留原文、译文和出处，便于核对词语的真实用法。</p></div><t-button size="small" @click="store.addExample(entry.id)">＋ 添加例句</t-button></div>
          <div v-for="(example, index) in entry.examples" :key="example.id" class="subcard example-card">
            <button class="remove-button" @click="store.removeExample(entry.id, example.id)">×</button>
            <span class="card-index">EX {{ String(index + 1).padStart(2, '0') }}</span>
            <label class="field-block"><span>原文</span><t-textarea :default-value="example.text" :autosize="{ minRows: 2, maxRows: 4 }" @blur="store.updateExample(entry.id, example.id, 'text', eventValue($event))" /></label>
            <div class="field-grid two"><label class="field-block"><span>译文</span><t-input :default-value="example.translation" @blur="store.updateExample(entry.id, example.id, 'translation', eventValue($event))" /></label><label class="field-block"><span>出处</span><t-input :default-value="example.source" @blur="store.updateExample(entry.id, example.id, 'source', eventValue($event))" /></label></div>
          </div>
          <t-empty v-if="!entry.examples.length" description="暂未记录例句" />
        </div>
      </t-tab-panel>

      <t-tab-panel value="sources" label="来源">
        <div class="editor-scroll">
          <div class="section-title">
            <div><h3>文献、录音与调查来源</h3><p>来源集中保存在共享来源册，修改一处，所有引用词条同步更新。</p></div>
            <t-button size="small" @click="createOpen = !createOpen">＋ 新建来源</t-button>
          </div>

          <div v-if="createOpen" class="subcard source-create">
            <div class="field-grid two">
              <label class="field-block"><span>来源名称</span><t-input v-model="draft.title" placeholder="如：嘎木村发音人访谈" /></label>
              <label class="field-block"><span>链接（可选）</span><t-input v-model="draft.url" placeholder="https://…" /></label>
            </div>
            <label class="field-block"><span>引用信息</span><t-input v-model="draft.citation" placeholder="记录人、年份、页码或录音时间点" /></label>
            <div class="dialog-actions">
              <t-button size="small" variant="outline" @click="createOpen = false">取消</t-button>
              <t-button size="small" theme="primary" :disabled="!draft.title.trim()" @click="saveNewSource">保存到来源册并引用</t-button>
            </div>
          </div>

          <div v-for="source in linkedSources" :key="source.id" class="subcard source-card">
            <button class="remove-button" title="取消引用（来源仍保留在来源册）" @click="store.detachSource(entry.id, source.id)">×</button>
            <div class="source-head">
              <strong>{{ source.title || '未命名来源' }}</strong>
              <t-tag size="small" variant="light" :theme="usageCount(source.id) > 1 ? 'warning' : 'default'">{{ usageCount(source.id) }} 个词条引用</t-tag>
            </div>
            <p class="source-citation">{{ source.citation || '引用信息待补充' }}</p>
            <a v-if="source.url" class="source-link" :href="source.url" target="_blank" rel="noreferrer">{{ source.url }}</a>
            <div class="source-actions">
              <span class="source-sync-hint">{{ usageCount(source.id) > 1 ? '与其他词条共享，改动会同步到全部引用词条' : '仅当前词条引用' }}</span>
              <t-button size="small" variant="text" @click="emit('open-library', source.id)">在来源册中编辑</t-button>
            </div>
          </div>
          <t-empty v-if="!linkedSources.length" description="暂未引用来源，可从来源册选择或新建" />

          <div class="attach-box">
            <span>从来源册选择已有来源</span>
            <t-select
              v-model="pickId"
              filterable
              :placeholder="availableSources.length ? '搜索标题或引用信息…' : '来源册中没有更多可选来源'"
              :disabled="!availableSources.length"
              :popup-props="{ attach: 'body' }"
              @change="attachPicked"
            >
              <t-option v-for="source in availableSources" :key="source.id" :value="source.id" :label="`${source.title || '未命名来源'} · ${usageCount(source.id)} 个词条引用`" />
            </t-select>
          </div>
        </div>
      </t-tab-panel>
    </t-tabs>
  </section>
</template>
