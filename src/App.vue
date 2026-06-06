<script setup lang="ts">
import { onMounted, onBeforeUnmount, watch, ref, computed } from "vue";
import AppSidebar from "@/components/layout/AppSidebar.vue";
import CardContainer from "./components/util/CardContainer.vue";
import { useStore } from "./store/store";
import { useAuthStore } from "./store/auth";
import { useMembershipStore } from "./store/membership";
import { sendHeartbeat } from "./lib/admin";
import AuthLanding from "./views/AuthLanding.vue";
import { LeagueInfoType } from "./types/types";
import { inject } from "@vercel/analytics";
import { useRoute, useRouter } from "vue-router";

import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Sun, MoonStar } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import "vue-sonner/style.css";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "vue-sonner";

const router = useRouter();
const route = useRoute();
const store = useStore();
const authStore = useAuthStore();
const membership = useMembershipStore();

// Re-evaluate app access whenever auth state changes. refresh() registers the
// member (idempotent) and reads their team/active status.
watch(
  () => authStore.isAuthenticated,
  () => membership.refresh(),
  { immediate: true }
);

// True while we don't yet know enough to decide what to render.
const booting = computed(
  () =>
    !authStore.initialized ||
    (authStore.isAuthenticated && !membership.loaded)
);

// Presence heartbeat: mark the signed-in user as currently online (updates
// last_seen) every 45s while the tab is visible. Powers the Admin online list.
let heartbeatTimer: ReturnType<typeof setInterval> | undefined;
const beat = () => {
  if (authStore.isAuthenticated && document.visibilityState === "visible") {
    sendHeartbeat();
  }
};
onMounted(() => {
  beat();
  heartbeatTimer = setInterval(beat, 45000);
});
onBeforeUnmount(() => {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
});

const systemDarkMode = window.matchMedia(
  "(prefers-color-scheme: dark)"
).matches;
const savedDarkMode = localStorage.getItem("darkMode");
// if savedDarkMode is null, use system preference
// otherwise check if it is explicitly "true"
const initialDarkMode =
  savedDarkMode !== null ? savedDarkMode === "true" : systemDarkMode;

const clicked = ref(initialDarkMode);
// sync store immediately
store.updateDarkMode(initialDarkMode);

const darkMode = computed(() => {
  return store.darkMode;
});

watch(clicked, () => {
  localStorage.setItem("darkMode", String(clicked.value));
  store.updateDarkMode(clicked.value);
});

const setColorMode = () => {
  clicked.value = !clicked.value;
};

onMounted(async () => {
  inject();
  setHtmlBackground();
});

watch(
  () => store.darkMode,
  () => setHtmlBackground()
);

watch(
  () => store.currentLeagueId,
  () => {
    if (store.currentLeagueId === "") {
      localStorage.removeItem("currentLeagueId");
      localStorage.removeItem("leagueInfo");
    } else {
      localStorage.setItem("currentLeagueId", store.currentLeagueId);
      if (
        store.currentTab === "Wrapped" &&
        store.leagueInfo[store.currentLeagueIndex]?.season !== "2025"
      ) {
        store.currentTab = "Standings";
      }
      if (store.currentLeagueId !== "undefined") {
        const currentLeague = store.leagueInfo[store.currentLeagueIndex];
        if (currentLeague?.platform === "espn") {
          router.replace({
            query: {
              ...route.query,
              espn: null,
              leagueId: currentLeague.leagueId,
              season: currentLeague.season,
            },
          });
        } else {
          router.replace({
            query: {
              ...route.query,
              espn: undefined,
              leagueId: store.currentLeagueId,
              season: undefined,
            },
          });
        }
      } else {
        localStorage.removeItem("currentLeagueId");
        localStorage.removeItem("leagueInfo");
        toast.error("Error fetching data. Please try refreshing the page.");
      }
    }
  }
);

watch(
  () => store.leagueInfo.length,
  () => {
    if (store.leagueInfo.length > 0 && store.leagueSubmitted) {
      toast.success("League added!");
      store.leagueSubmitted = false;
    }
    localStorage.setItem(
      "leagueInfo",
      JSON.stringify(store.leagueInfo as LeagueInfoType[])
    );
  }
);

watch(
  () => store.darkMode,
  (isDark) => {
    document.documentElement.classList.toggle("dark", isDark);
  },
  { immediate: true }
);

const setHtmlBackground = () => {
  const html = document.querySelector("html");
  if (html) {
    if (store.darkMode) {
      html.style.backgroundColor = "#030712";
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute("content", "#030712");
    } else {
      html.style.backgroundColor = "#F9FAFB";
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute("content", "#F9FAFB");
    }
  }
};
</script>

<template>
  <div>
    <!-- Booting: deciding whether the user can access the app -->
    <div
      v-if="booting"
      class="flex items-center justify-center min-h-screen bg-background"
    />
    <!-- Gate: must be signed in + active + assigned a team (admin always in) -->
    <AuthLanding v-else-if="!membership.canAccess" />
    <div v-else>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset class="flex flex-col h-screen">
          <header class="flex items-center h-16 gap-2 px-4 border-b shrink-0">
            <SidebarTrigger
              class="-ml-1 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            />
            <Separator
              orientation="vertical"
              class="data-[orientation=vertical]:h-4"
            />
            <CardContainer />
            <Button
              @click="setColorMode()"
              class="ml-auto transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              variant="ghost"
              size="icon-sm"
            >
              <component :is="darkMode ? Sun : MoonStar" class="w-4 h-4" />
              <span class="sr-only">
                {{ darkMode ? "Switch to light mode" : "Switch to dark mode" }}
              </span>
            </Button>
          </header>
          <main
            id="mainScrollSection"
            class="flex-1 min-w-0 overflow-x-hidden overflow-y-auto overscroll-none"
          >
            <RouterView />
          </main>
        </SidebarInset>
      </SidebarProvider>
    </div>
    <Toaster />
  </div>
</template>
