<script setup lang="ts">
import { useI18n } from "vue-i18n";

const { t } = useI18n();
</script>

<template>
  <div class="flex-1 flex items-center justify-center">
    <div class="text-center max-w-md">
      <!-- Logo -->
      <div class="mb-6 flex justify-center">
        <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent-cyan via-accent-indigo to-accent-emerald opacity-80" />
      </div>

      <!-- Title -->
      <h1 class="text-xl font-bold text-surface-200 mb-2">
        {{ t("welcome.title") }}
      </h1>
      <p class="text-sm text-surface-500 mb-8">
        {{ t("welcome.subtitle") }}
      </p>

      <!-- Description -->
      <p class="text-xs text-surface-600 mb-6">
        {{ t("welcome.getStarted") }}
      </p>

      <!-- Actions -->
      <div class="flex gap-3 justify-center">
        <button class="px-4 py-2 text-sm font-medium rounded-lg bg-accent-cyan/15 text-accent-cyan hover:bg-accent-cyan/25 transition-colors">
          {{ t("welcome.newSession") }}
        </button>
        <button class="px-4 py-2 text-sm font-medium rounded-lg bg-surface-800 text-surface-300 hover:bg-surface-700 transition-colors">
          {{ t("welcome.openProject") }}
        </button>
      </div>
    </div>
  </div>
</template>
