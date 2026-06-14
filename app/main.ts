import { createApp } from "vue";
import { createRouter, createWebHashHistory } from "vue-router";
import { i18n } from "./i18n";
import App from "./App.vue";
import { routes } from "./router";
import { initTheme } from "./composables/useTheme";
import "./styles/tailwind.css";

// Apply persisted theme before mount to avoid the default-theme flash.
initTheme();

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

const app = createApp(App);
app.use(i18n);
app.use(router);

app.config.errorHandler = (err, instance, info) => {
  console.error("[Vue Error]", err, info);
  const el = document.getElementById("app");
  if (el) {
    el.innerHTML = `<pre style="color:#fb7185;padding:20px;font-size:14px;">Vue Error: ${err}\n${info}\n${err instanceof Error ? err.stack : ""}</pre>`;
  }
};

app.mount("#app");
