<script setup lang="ts">
import { useI18n } from "vue-i18n";

const { t } = useI18n();
</script>

<template>
  <footer class="h-6 flex items-center justify-between px-3 bg-surface-900 border-t border-surface-800 text-[10px] text-surface-500 select-none">
    <span>{{ t("status.disconnected") }}</span>
    <span class="text-surface-600">{{ t("app.title") }}</span>
  </footer>
</template>
