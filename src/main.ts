import { createApp, defineAsyncComponent } from "vue";
import { createPinia } from "pinia";
import { createRouter, createWebHistory } from "vue-router";
import { registerSW } from "virtual:pwa-register";
import "./index.css";
import App from "./App.vue";
import { needRefresh, setUpdateSW } from "./lib/pwaUpdate";
import posthogPlugin from "./plugins/posthog";
import { useAuthStore } from "./store/auth";
import { useSubscriptionStore } from "./store/subscription";

const Home = () => import("./views/Home.vue");
const About = () => import("./views/About.vue");
const ChangelogPage = () => import("./views/Changelog.vue");
const Account = () => import("./views/Account.vue");
const Admin = () => import("./views/Admin.vue");
const NotFound = () => import("./views/404.vue");

const siteUrl = "https://enginelineffl.com";
const defaultMeta = {
  title: "Engine Line",
  description:
    "Analyze your fantasy football league with power rankings, roster insights, custom weekly reports, playoff odds, and much more.",
};

const routes = [
  {
    path: "/",
    component: Home,
    meta: defaultMeta,
  },
  {
    path: "/about",
    component: About,
    meta: {
      title: "About | Engine Line",
      description:
        "Learn about Engine Line, a tool for analyzing fantasy football leagues.",
    },
  },
  {
    path: "/changelog",
    component: ChangelogPage,
    meta: {
      title: "Changelog | Engine Line",
      description: "See the latest Engine Line updates, features, and bug fixes",
    },
  },
  {
    path: "/account",
    component: Account,
    meta: {
      title: "Account | Engine Line",
      description: "Manage your Engine Line account and subscription settings.",
    },
  },
  {
    path: "/admin",
    component: Admin,
    meta: {
      title: "Admin | Engine Line",
      description: "Engine Line league administration.",
      requiresAuth: true,
    },
  },
  {
    path: "/:pathMatch(.*)*",
    name: "NotFound",
    component: NotFound,
    meta: {
      title: "Page Not Found | Engine Line",
      description:
        "The page you are looking for could not be found on Engine Line.",
    },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 };
  },
});

const staleChunkReloadKey = "stale-chunk-reload-attempted";
const isDynamicImportError = (reason: unknown) => {
  const message = reason instanceof Error ? reason.message : String(reason);

  return (
    message.includes("Failed to fetch dynamically imported module") ||
    message.includes("Importing a module script failed") ||
    message.includes("error loading dynamically imported module")
  );
};

window.addEventListener("unhandledrejection", (event) => {
  if (!isDynamicImportError(event.reason)) {
    return;
  }

  if (sessionStorage.getItem(staleChunkReloadKey)) {
    return;
  }

  sessionStorage.setItem(staleChunkReloadKey, "true");
  window.location.reload();
});

router.afterEach(() => {
  sessionStorage.removeItem(staleChunkReloadKey);
});

const pinia = createPinia();
const app = createApp(App);
const ApexChart = defineAsyncComponent(() => import("vue3-apexcharts"));

app.use(pinia);
const authStore = useAuthStore(pinia);
authStore.initialize();
const subscriptionStore = useSubscriptionStore(pinia);
subscriptionStore.initialize();

router.beforeEach(async (to) => {
  if (!authStore.initialized) {
    await authStore.initialize();
  }
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return { path: "/" };
  }
  return true;
});

router.afterEach((to) => {
  const title = String(to.meta.title ?? defaultMeta.title);
  const description = String(to.meta.description ?? defaultMeta.description);
  const canonicalUrl = `${siteUrl}${to.path === "/" ? "/" : to.path}`;

  document.title = title;

  const setMetaContent = (selector: string, content: string) => {
    document.querySelector(selector)?.setAttribute("content", content);
  };

  setMetaContent('meta[name="description"]', description);
  setMetaContent('meta[itemprop="name"]', title);
  setMetaContent('meta[itemprop="description"]', description);
  setMetaContent('meta[property="og:title"]', title);
  setMetaContent('meta[property="og:description"]', description);
  setMetaContent('meta[property="og:url"]', canonicalUrl);
  setMetaContent('meta[name="twitter:title"]', title);
  setMetaContent('meta[name="twitter:description"]', description);

  document
    .querySelector('link[rel="canonical"]')
    ?.setAttribute("href", canonicalUrl);
});

app.component("apexchart", ApexChart);
app.use(router);
app.use(posthogPlugin);
// Prompt mode: when a new version is deployed, surface a blocking refresh modal
// (handled in App.vue) instead of silently reloading.
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    needRefresh.value = true;
  },
});
setUpdateSW(updateSW);
app.mount("#app");
