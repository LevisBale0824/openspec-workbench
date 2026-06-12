import { createI18n } from "vue-i18n";
import en from "../locales/en";
import zhCN from "../locales/zh-CN";

export type Locale = "en" | "zh-CN";

function getStoredLocale(): Locale {
  const stored = localStorage.getItem("openspec-locale");
  if (stored === "en" || stored === "zh-CN") return stored;
  return navigator.language.startsWith("zh") ? "zh-CN" : "en";
}

export const i18n = createI18n({
  legacy: false,
  locale: getStoredLocale(),
  fallbackLocale: "en",
  messages: {
    en,
    "zh-CN": zhCN,
  },
});
