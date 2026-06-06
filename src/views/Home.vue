<script setup lang="ts">
import { defineAsyncComponent, onMounted, ref } from "vue";

import SkeletonLoading from "../components/util/SkeletonLoading.vue";
import { useStore } from "../store/store";
import { getData, inputLeague } from "../api/api";
import { LeagueInfoType } from "../types/types";
import { toast } from "vue-sonner";
import { getParsedStorageItem, isBoolean } from "@/lib/storage";
import { LEAGUE_ID, BRAND_NAME } from "@/lib/config";
import { getSettings } from "@/lib/admin";

const Table = defineAsyncComponent(
  () => import("../components/standings/Table.vue")
);

const store = useStore();

const isInitialLoading = ref(true);

const systemDarkMode = window.matchMedia(
  "(prefers-color-scheme: dark)"
).matches;
const clicked = ref(systemDarkMode);

const checkSystemTheme = () => {
  const savedDarkMode = localStorage.getItem("darkMode");
  if (systemDarkMode && savedDarkMode === null) {
    clicked.value = true;
    store.updateDarkMode(true);
  } else if (savedDarkMode !== null) {
    clicked.value = getParsedStorageItem("darkMode", systemDarkMode, {
      isValid: isBoolean,
    });
    store.updateDarkMode(clicked.value);
  }
};

// This instance is locked to a single Sleeper league (see src/lib/config.ts).
// Load it from cache when fresh (<24h), otherwise pull the latest from Sleeper.
const loadLeague = async (leagueId: string) => {
  const savedLeagues = getParsedStorageItem<LeagueInfoType[]>(
    "leagueInfo",
    [],
    { isValid: Array.isArray }
  );
  const cached = savedLeagues.find((league) => league.leagueId === leagueId);

  if (cached && Date.now() - cached.lastUpdated < 86400000) {
    store.updateLeagueInfo(cached);
  } else {
    store.updateLoadingLeague(BRAND_NAME);
    const league = await getData(leagueId);
    store.updateLeagueInfo(league);
    await inputLeague(
      leagueId,
      league.name,
      league.totalRosters,
      league.seasonType,
      league.season,
      "sleeper"
    );
    store.updateLoadingLeague("");
  }
  store.updateCurrentLeagueId(leagueId);
};

onMounted(async () => {
  try {
    checkSystemTheme();
    // The live league id comes from the Admin page (Supabase); fall back to the
    // compiled-in default if settings aren't available.
    const settings = await getSettings();
    const leagueId = settings.leagueId || LEAGUE_ID;
    if (!store.leagueIds.includes(leagueId)) {
      await loadLeague(leagueId);
    } else {
      store.updateCurrentLeagueId(leagueId);
    }
  } catch {
    store.updateLoadingLeague("");
    toast.error("Error loading the league. Please try refreshing the page.");
  } finally {
    isInitialLoading.value = false;
  }
});
</script>

<template>
  <div>
    <SkeletonLoading v-if="isInitialLoading || store.loadingLeague" />
    <div
      v-else-if="store.currentLeagueId"
      :class="store.currentTab === 'Home' ? '' : 'container mx-auto'"
    >
      <div
        v-if="
          store.leagueUsers[store.currentLeagueIndex] &&
          !store.loadingUserLeagues
        "
      >
        <Table
          :users="store.leagueUsers[store.currentLeagueIndex]"
          :rosters="store.leagueRosters[store.currentLeagueIndex]"
          :points="store.weeklyPoints[store.currentLeagueIndex]"
        />
      </div>
      <SkeletonLoading v-else />
    </div>
    <SkeletonLoading v-else />
  </div>
</template>
