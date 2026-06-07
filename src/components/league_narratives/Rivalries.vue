<script setup lang="ts">
import { computed, defineAsyncComponent, ref, watch } from "vue";
import { useStore } from "../../store/store";
import LeagueRivalriesCard from "./LeagueRivalriesCard.vue";
import { TableDataType } from "@/types/types";
import {
  buildNarrativeBundle,
  type NarrativeBundle,
  normalizeHistoricalSeasons,
} from "@/lib/narratives";

const store = useStore();
// Hidden LeagueHistory loads the multi-season data the rivalries need.
const LeagueHistory = defineAsyncComponent(
  () => import("../league_history/LeagueHistory.vue")
);

const props = defineProps<{
  tableData: TableDataType[];
}>();

const seasons = computed(() =>
  normalizeHistoricalSeasons(store.leagueInfo[store.currentLeagueIndex])
);

const narratives = ref<NarrativeBundle>({ managerArchetypes: [] });
const isLeagueHistoryReady = ref(false);
const ready = computed(
  () =>
    isLeagueHistoryReady.value &&
    narratives.value.managerArchetypes.length > 0
);

const rebuild = async () => {
  narratives.value = await buildNarrativeBundle(
    normalizeHistoricalSeasons(store.leagueInfo[store.currentLeagueIndex])
  );
};

watch(
  [seasons, isLeagueHistoryReady],
  async ([, historyReady]) => {
    if (store.leagueInfo.length > 0 && !historyReady) return;
    await rebuild();
  },
  { immediate: true }
);
</script>

<template>
  <div class="my-4 space-y-4">
    <LeagueHistory
      v-show="false"
      :table-data="props.tableData"
      @ready="isLeagueHistoryReady = true"
    />
    <LeagueRivalriesCard
      v-if="ready"
      :seasons="seasons"
      :archetypes="narratives.managerArchetypes"
    />
    <div v-else class="my-4 text-muted-foreground">Loading rivalries…</div>
  </div>
</template>
