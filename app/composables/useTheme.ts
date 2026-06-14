import { ref } from "vue";
import { DEFAULT_THEME_ID, getThemeById, themes, type Theme } from "../themes";
import { StorageKeys, storageGet, storageSet } from "../utils/storageKeys";

// Module-level singleton — theme must persist across the app and survive HMR.
const currentThemeId = ref<string>(resolveInitialTheme());

function resolveInitialTheme(): string {
  const stored = storageGet(StorageKeys.ui.theme);
  if (stored && getThemeById(stored)) return stored;
  return DEFAULT_THEME_ID;
}

function writeThemeToDom(theme: Theme): void {
  const root = document.documentElement;
  const entries = Object.entries(theme.colors) as [string, string][];
  for (const [key, value] of entries) {
    root.style.setProperty(key, value);
  }
  root.style.colorScheme = theme.mode;
}

/**
 * Apply a theme by id. Falls back to the default theme if the id is unknown.
 * Updates the DOM + persists to localStorage.
 */
export function applyTheme(themeId: string): void {
  const theme = getThemeById(themeId) ?? getThemeById(DEFAULT_THEME_ID);
  if (!theme) return;
  writeThemeToDom(theme);
  storageSet(StorageKeys.ui.theme, theme.id);
  currentThemeId.value = theme.id;
}

/** Apply the persisted theme at app startup (before mount) to avoid flicker. */
export function initTheme(): void {
  const theme = getThemeById(currentThemeId.value) ?? getThemeById(DEFAULT_THEME_ID);
  if (theme) writeThemeToDom(theme);
}

export function useTheme() {
  return {
    currentThemeId,
    themes,
    applyTheme,
  };
}
