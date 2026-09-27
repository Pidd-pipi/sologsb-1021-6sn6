<script setup lang="ts">
import { nextTick, reactive, ref, watch } from 'vue';
import { useDictionaryStore } from '~/store/dictionary';

const visible = defineModel<boolean>({ required: true });
const props = defineProps<{ focusId?: string }>();
const store = useDictionaryStore();

const createOpen = ref(false);
const draft = reactive({ title: '', citation: '', url: '' });

const eventValue = (event: any) => typeof event === 'string' || typeof event === 'number' ? String(event) : event?.target?.value ?? event?.e?.target?.value ?? event?.value ?? '';
const usageOf = (sourceId: string) => store.sourceUsage.get(sourceId) ?? [];

watch(visible, async (open) => {
  if (!open) return;
  await nextTick();
  window.setTimeout(() => {
    if (props.focusId) document.getElementById(`library-source-${props.focusId}`)?.scrollIntoView({ block: 'center' });
  }, 280);
});

const saveNewSource = () => {
  if (!draft.title.trim()) return;
  store.createSource(null, draft);
  draft.title = '';
  draft.citation = '';
  draft.url = '';
  createOpen.value = false;
};

const jumpToEntry = (entryId: string) => {
  store.selectedId = entryId;
  visible.value = false;
};
</script>

<template>
  <t-drawer v-model:visible="visible" header="来源册 · 共享文献与录音" size="600px" :footer="false">
    <div class="version-drawer">
      <div class="version-intro">
        <strong>{{ store.sourceLibrary.length }}</strong><span>条共享来源</span>
        <p>词条按引用关系共享来源：修改来源信息会同步到所有引用词条；仍被引用的来源不能移除。</p>
      </div>

      <div class="library-toolbar">
        <t-button size="small" theme="primary" variant="outline" @click="createOpen = !createOpen">＋ 新增来源</t-button>
      </div>
      <div v-if="createOpen" class="subcard source-create">
        <div class="field-grid two">
          <label class="field-block"><span>来源名称</span><t-input v-model="draft.title" placeholder="如：嘎木村发音人访谈" /></label>
          <label class="field-block"><span>链接（可选）</span><t-input v-model="draft.url" placeholder="https://…" /></label>
        </div>
        <label class="field-block"><span>引用信息</span><t-input v-model="draft.citation" placeholder="记录人、年份、页码或录音时间点" /></label>
        <div class="dialog-actions">
          <t-button size="small" variant="outline" @click="createOpen = false">取消</t-button>
          <t-button size="small" theme="primary" :disabled="!draft.title.trim()" @click="saveNewSource">保存到来源册</t-button>
        </div>
      </div>

      <article
        v-for="source in store.sourceLibrary"
        :id="`library-source-${source.id}`"
        :key="source.id"
        class="library-item"
        :class="{ highlight: source.id === focusId }"
      >
        <div class="library-item-head">
          <t-tag size="small" variant="light" :theme="usageOf(source.id).length > 1 ? 'warning' : usageOf(source.id).length === 1 ? 'default' : 'success'">
            {{ usageOf(source.id).length }} 个词条引用
          </t-tag>
          <t-button
            size="small"
            variant="text"
            theme="danger"
            :disabled="usageOf(source.id).length > 0"
            :title="usageOf(source.id).length ? '仍被词条引用的来源不能移除' : '从来源册移除'"
            @click="store.removeLibrarySource(source.id)"
          >移除</t-button>
        </div>
        <label class="field-block"><span>来源名称</span><t-input :default-value="source.title" placeholder="文献、档案或录音名称" @blur="store.updateLibrarySource(source.id, 'title', eventValue($event))" /></label>
        <label class="field-block"><span>引用信息</span><t-input :default-value="source.citation" placeholder="记录人、年份、页码或录音时间点" @blur="store.updateLibrarySource(source.id, 'citation', eventValue($event))" /></label>
        <label class="field-block"><span>链接（可选）</span><t-input :default-value="source.url" placeholder="https://…" @blur="store.updateLibrarySource(source.id, 'url', eventValue($event))" /></label>
        <div class="usage-list">
          <span>使用此来源的词条：</span>
          <template v-if="usageOf(source.id).length">
            <button v-for="entry in usageOf(source.id)" :key="entry.id" class="usage-chip" @click="jumpToEntry(entry.id)">{{ entry.headword || '未命名词条' }}</button>
          </template>
          <em v-else>暂无词条引用，可安全移除</em>
        </div>
        <p v-if="usageOf(source.id).length > 1" class="sync-hint">修改会同步到以上 {{ usageOf(source.id).length }} 个词条，引用关系保持不变。</p>
      </article>
      <t-empty v-if="!store.sourceLibrary.length" description="来源册为空，可在词条中新建来源" />
    </div>
  </t-drawer>
</template>
