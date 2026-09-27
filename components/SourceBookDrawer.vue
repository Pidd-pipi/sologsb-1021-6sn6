<script setup lang="ts">
import { computed } from 'vue';
import { useDictionaryStore } from '~/store/dictionary';

const visible = defineModel<boolean>({ required: true });
const store = useDictionaryStore();

const records = computed(() => store.sources);
const usageOf = (sourceId: string) => store.sourceUsage.get(sourceId) ?? [];

const eventValue = (event: any) => typeof event === 'string' || typeof event === 'number' ? String(event) : event?.target?.value ?? event?.e?.target?.value ?? event?.value ?? '';

const openEntry = (entryId: string) => {
  store.selectedId = entryId;
  visible.value = false;
};

const remove = (sourceId: string) => {
  store.removeSource(sourceId);
};
</script>

<template>
  <t-drawer v-model:visible="visible" header="来源册 · 可复用文献与录音" size="620px" :footer="false">
    <div class="source-book">
      <div class="source-book-intro">
        <strong>{{ records.length }}</strong><span>条可复用来源</span>
        <p>同一份田野录音或文献只维护一份；修改后所有引用词条同步显示最新内容。仍被词条引用的来源不能移除。</p>
        <t-button size="small" theme="primary" @click="store.addSource()">＋ 新建来源</t-button>
      </div>
      <div class="source-book-list">
        <article v-for="record in records" :key="record.id" class="source-book-item">
          <div class="source-book-item-head">
            <t-tag size="small" variant="light" :theme="usageOf(record.id).length ? 'primary' : 'default'">
              {{ usageOf(record.id).length ? `被 ${usageOf(record.id).length} 个词条引用` : '暂未被引用' }}
            </t-tag>
            <t-tooltip v-if="usageOf(record.id).length" content="仍被词条引用，请先在词条中取消引用" placement="left">
              <t-button size="small" variant="outline" theme="danger" disabled>移除</t-button>
            </t-tooltip>
            <t-popconfirm v-else content="确定从来源册移除这条来源？" placement="left" @confirm="remove(record.id)">
              <t-button size="small" variant="outline" theme="danger">移除</t-button>
            </t-popconfirm>
          </div>
          <div class="field-grid two">
            <label class="field-block"><span>来源名称</span><t-input :default-value="record.title" placeholder="文献、档案或录音名称" @blur="store.updateSource(record.id, 'title', eventValue($event))" /></label>
            <label class="field-block"><span>链接（可选）</span><t-input :default-value="record.url" placeholder="https://…" @blur="store.updateSource(record.id, 'url', eventValue($event))" /></label>
          </div>
          <label class="field-block"><span>引用信息</span><t-input :default-value="record.citation" placeholder="记录者、年份、页码或录音时间点" @blur="store.updateSource(record.id, 'citation', eventValue($event))" /></label>
          <div v-if="usageOf(record.id).length" class="source-usage">
            <span>引用词条：</span>
            <button v-for="entry in usageOf(record.id)" :key="entry.id" class="usage-chip" @click="openEntry(entry.id)">{{ entry.headword || '未命名词条' }}</button>
          </div>
        </article>
        <t-empty v-if="!records.length" description="来源册为空，新建来源后可在词条中引用" />
      </div>
    </div>
  </t-drawer>
</template>
