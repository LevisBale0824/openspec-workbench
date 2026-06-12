import type { RouteRecordRaw } from "vue-router";

export const routes: RouteRecordRaw[] = [
  {
    path: "/",
    name: "home",
    component: () => import("./components/Welcome.vue"),
  },
  {
    path: "/chat",
    name: "chat",
    component: () => import("./components/ChatView.vue"),
  },
];
