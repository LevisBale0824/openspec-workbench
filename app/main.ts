import { createApp } from "vue";
import { createRouter, createWebHashHistory } from "vue-router";
import { i18n } from "./i18n";
import App from "./App.vue";
import { routes } from "./router";

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

const app = createApp(App);
app.use(i18n);
app.use(router);
app.mount("#app");
