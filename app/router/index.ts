import type { RouteRecordRaw } from "vue-router";

export const routes: RouteRecordRaw[] = [
  {
    path: "/",
    name: "home",
    component: () => import("../components/Welcome.vue"),
  },
  {
    path: "/chat/:sessionId?",
    name: "chat",
    component: () => import("../components/MessageViewer.vue"),
    props: true,
  },
];
