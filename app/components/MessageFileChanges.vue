<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import CodeContent from "./CodeContent.vue";
import type { MessageDiffEntry } from "../types/message";
import {
  RenderCancelledError,
  startRenderWorkerHtml,
} from "../utils/workerRenderer";

const props = defineProps<{
  diffs?: MessageDiffEntry[];
  patchFiles?: string[];
}>();

type RenderedDiff = MessageDiffEntry & {
  html?: string;
  loading?: boolean;
  error?: string;
};

const rendered = ref<RenderedDiff[]>([]);
let cancelRenderTasks: Array<() => void> = [];

const patchOnlyFiles = computed(() => {
  const diffFiles = new Set((props.diffs ?? []).map((diff) => diff.file));
  return (props.patchFiles ?? []).filter((file) => !diffFiles.has(file));
});

const hasChanges = computed(
  () => rendered.value.length > 0 || patchOnlyFiles.value.length > 0,
);

function fileStats(diff: MessageDiffEntry) {
  const source = diff.diff || "";
  let additions = 0;
  let deletions = 0;
  for (const line of source.split("\n")) {
    if (line.startsWith("+") && !line.startsWith("+++")) additions += 1;
    if (line.startsWith("-") && !line.startsWith("---")) deletions += 1;
  }
  return { additions, deletions };
}

function languageFromFile(file: string): string {
  const ext = file.split(".").pop()?.toLowerCase();
  if (!ext) return "text";
  if (["ts", "tsx", "js", "jsx", "vue", "json", "css", "html", "md"].includes(ext)) {
    return ext;
  }
  return "text";
}

function cancelRendering() {
  for (const cancel of cancelRenderTasks) cancel();
  cancelRenderTasks = [];
}

watch(
  () => props.diffs,
  (diffs) => {
    cancelRendering();
    rendered.value = (diffs ?? []).map((diff) => ({ ...diff, loading: true }));

    rendered.value.forEach((diff, index) => {
      if (!diff.diff && diff.before === undefined && diff.after === undefined) {
        rendered.value[index] = { ...diff, loading: false };
        return;
      }

      const task = startRenderWorkerHtml({
        id: `message-diff:${diff.file}:${index}:${Date.now()}`,
        code: diff.before ?? "",
        patch: diff.diff || undefined,
        after: diff.after,
        lang: languageFromFile(diff.file),
        variant: "diff",
        gutterMode: "double",
      });
      cancelRenderTasks.push(task.cancel);
      task.promise
        .then((html) => {
          rendered.value[index] = { ...rendered.value[index], html, loading: false };
        })
        .catch((error: unknown) => {
          if (error instanceof RenderCancelledError) return;
          rendered.value[index] = {
            ...rendered.value[index],
            loading: false,
            error: error instanceof Error ? error.message : String(error),
          };
        });
    });
  },
  { immediate: true, deep: true },
);

onBeforeUnmount(cancelRendering);
</script>

<template>
  <div v-if="hasChanges" class="file-changes">
    <div class="file-changes-title">文件变更</div>

    <details
      v-for="diff in rendered"
      :key="diff.file"
      class="file-change"
      open
    >
      <summary class="file-change-summary">
        <span class="file-name">{{ diff.file }}</span>
        <span class="file-stat added">+{{ fileStats(diff).additions }}</span>
        <span class="file-stat removed">-{{ fileStats(diff).deletions }}</span>
      </summary>

      <div v-if="diff.loading" class="file-change-empty">正在渲染 diff...</div>
      <div v-else-if="diff.error" class="file-change-empty">{{ diff.error }}</div>
      <CodeContent
        v-else-if="diff.html"
        class="file-change-code"
        :html="diff.html"
        variant="diff"
      />
      <div v-else class="file-change-empty">此文件有变更，但后端未提供 diff 内容。</div>
    </details>

    <div
      v-for="file in patchOnlyFiles"
      :key="file"
      class="file-change patch-only"
    >
      <span class="file-name">{{ file }}</span>
      <span class="file-change-empty">已修改，等待后端 diff 内容。</span>
    </div>
  </div>
</template>

<style scoped>
.file-changes {
  margin-top: 0.85rem;
  border-top: 1px solid color-mix(in srgb, var(--color-surface-700) 65%, transparent);
  padding-top: 0.75rem;
}

.file-changes-title {
  margin-bottom: 0.45rem;
  font-size: 11px;
  font-weight: 650;
  letter-spacing: 0.02em;
  color: var(--color-surface-300);
}

.file-change {
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--color-surface-700) 70%, transparent);
  border-radius: 7px;
  background: color-mix(in srgb, var(--color-surface-950) 45%, transparent);
}

.file-change + .file-change {
  margin-top: 0.5rem;
}

.file-change-summary,
.patch-only {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
  padding: 0.45rem 0.6rem;
  font-size: 12px;
}

.file-change-summary {
  cursor: pointer;
  background: color-mix(in srgb, var(--color-surface-900) 72%, transparent);
}

.file-name {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--font-mono);
  color: var(--color-surface-200);
}

.file-stat {
  flex: 0 0 auto;
  font-family: var(--font-mono);
  font-size: 11px;
}

.file-stat.added {
  color: var(--color-accent-emerald);
}

.file-stat.removed {
  color: var(--color-accent-rose);
}

.file-change-code {
  max-height: 360px;
  overflow: auto;
  padding: 0.5rem 0;
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.55;
}

.file-change-empty {
  padding: 0.55rem 0.65rem;
  font-size: 12px;
  color: var(--color-surface-500);
}
</style>
