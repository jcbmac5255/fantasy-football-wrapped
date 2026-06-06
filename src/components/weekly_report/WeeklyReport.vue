<script setup lang="ts">
import { TableDataType, LeagueInfoType } from "../../types/types.ts";
import { Player } from "../../types/apiTypes.ts";
import { computed, ref, watch, onMounted, nextTick } from "vue";
import { getLeagueKey, useStore } from "../../store/store";
import {
  generateReport,
  generatePremiumReport,
  getPlayersByIdsMap,
} from "../../api/api.ts";
import Card from "../ui/card/Card.vue";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectTrigger,
  SelectItem,
  SelectValue,
} from "../ui/select";
import {
  fakeTopPerformers,
  fakeBottomPerformers,
  fakeBenchPerformers,
} from "../../api/fakeLeague.ts";
import WeeklyPreview from "./WeeklyPreview.vue";
import WeeklyShareCard from "./WeeklyShareCard.vue";
import WeeklyPerformers from "./WeeklyPerformers.vue";
import WeeklyReportSummary from "./WeeklyReportSummary.vue";
import WeeklyMatchups from "./WeeklyMatchups.vue";
import WeeklyPointsChart from "./WeeklyPointsChart.vue";
import Separator from "../ui/separator/Separator.vue";
import { toast } from "vue-sonner";
import { toPng } from "html-to-image";
import {
  buildPremiumReportPrompt,
  buildReportPrompt,
  getBenchPerformers,
  getBracketRosterIds,
  getExportPlayers,
  getExportTopTeams,
  getMatchupNumbers,
  getSortedTableData,
  getWeeklyPerformers,
} from "./weeklyReportTransforms";

const store = useStore();
const props = defineProps<{
  tableData: TableDataType[];
  regularSeasonLength: number;
}>();

const rawWeeklyReport = ref<string>("");
const playerNames = ref<Player[][]>([]);
const benchPlayerNames = ref<Player[][]>([]);
const loading = ref(false);
const tier = ref("Standard");
const premiumLoading = ref(false);
const fetchingPlayers = ref(false);

const activeTab = ref("Report");
const premiumCommentaryStyle = ref("roast");
const rawPremiumWeeklyReport = ref<string>("");

const weeks = computed(() => {
  if (
    store.leagueInfo.length == 0 ||
    !store.leagueInfo[store.currentLeagueIndex]
  ) {
    return [...Array(15).keys()].slice(1).reverse();
  }
  if (
    props.tableData[0].matchups &&
    store.leagueInfo[store.currentLeagueIndex].lastScoredWeek
  ) {
    const recordLength = props.tableData[0].matchups.length + 1;
    const weeksList = [
      ...Array(
        store.leagueInfo[store.currentLeagueIndex].lastScoredWeek + 1
      ).keys(),
    ]
      .slice(1)
      .reverse();

    const result =
      recordLength < weeksList.length
        ? [...Array(recordLength).keys()].slice(1).reverse()
        : weeksList;
    return activeTab.value === "Report"
      ? result
      : result.length === 17 ||
          result.length === 18 ||
          store.leagueInfo.length === 0
        ? result
        : (result.unshift(result[result.length - 1] + result.length), result);
  }
  return [1];
});

const playoffWeeks = computed(() => {
  if (
    store.leagueInfo.length > 0 &&
    store.leagueInfo[store.currentLeagueIndex]
  ) {
    const currentLeague = store.leagueInfo[store.currentLeagueIndex];
    const result: number[] = [];
    for (let i = currentLeague.regularSeasonLength + 1; i <= 18; i++) {
      result.push(i);
    }
    return result;
  }
  return [15, 16, 17];
});

// A week is "final" (eligible for a report) once the NFL week has rolled past
// it — Sleeper advances its week counter early Tuesday, after Monday Night
// Football. league.currentWeek is 0 for completed/historical seasons, so all
// of their weeks count as final. Demo mode (no leagues) is always final.
const isWeekFinal = (week: number): boolean => {
  if (store.leagueInfo.length === 0) return true;
  const league = store.leagueInfo[store.currentLeagueIndex];
  if (!league) return false;
  if (!league.currentWeek) return true;
  return week < league.currentWeek;
};

// The most recent finished week — what the Report tab should open on.
const latestFinalWeek = computed(
  () => weeks.value.find((week) => isWeekFinal(week)) ?? weeks.value[0]
);

// Per-week report cache for this session so flipping weeks is instant; the
// backend additionally caches one shared copy per league/season/week.
const reportsByWeek = ref<Record<number, string>>({});
// Weeks currently being fetched, to dedupe overlapping requests.
const reportsInFlight = new Set<number>();

const currentWeek = ref(latestFinalWeek.value);

const fetchPlayerNames = async () => {
  if (
    store.leagueIds.length > 0 &&
    store.leagueInfo[store.currentLeagueIndex]?.lastScoredWeek &&
    weeks.value.length > 0
  ) {
    fetchingPlayers.value = true;
    const allPlayerIds = props.tableData
      .map((user) => [user.starters[currentWeek.value - 1]])
      .flat();
    let playerLookupMap = new Map<string, Player>();
    if (allPlayerIds.length > 0) {
      playerLookupMap = await getPlayersByIdsMap(allPlayerIds);
    }
    const result = props.tableData.map((user) => {
      const starterIds = user.starters[currentWeek.value - 1];
      const starterNames = starterIds
        ?.map((id: string) => playerLookupMap.get(id))
        .filter((player) => player !== undefined);
      return starterNames;
    });
    playerNames.value = result;

    const benchPlayerIds = props.tableData
      .map((user) => [user.benchPlayers[currentWeek.value - 1]])
      .flat();
    let benchPlayerLookupMap = new Map<string, Player>();
    if (benchPlayerIds.length > 0) {
      benchPlayerLookupMap = await getPlayersByIdsMap(benchPlayerIds);
    }
    const benchResult: Player[][] = props.tableData.map((user) => {
      const benchIds = user.benchPlayers[currentWeek.value - 1] ?? [];
      return benchIds
        .map((id: string) => benchPlayerLookupMap.get(id))
        .filter((player): player is Player => player !== undefined);
    });
    benchPlayerNames.value = benchResult;
    fetchingPlayers.value = false;
  }
};

const getPremiumReport = async () => {
  if (store.leagueIds.length > 0) {
    rawPremiumWeeklyReport.value = "";
    const currentLeague = store.leagueInfo[store.currentLeagueIndex];
    let leagueMetadata: Record<string, string | number>;
    if (isPlayoffs.value) {
      const roundNames: { [key: number]: string } = {
        1: "Quarterfinal round",
        2: "Semifinal round",
        3: "Final Championship round",
        4: "Final Championship round",
      };
      leagueMetadata = {
        playoffRound:
          roundNames[currentWeek.value - currentLeague.regularSeasonLength],
      };
      if (currentWeek.value - currentLeague.regularSeasonLength > 2) {
        leagueMetadata["ChampionshipMatchup"] = 1;
      }
    } else {
      leagueMetadata = {
        leagueName: currentLeague.name,
        numberOfPlayoffTeams: currentLeague.playoffTeams,
        numberRegularSeasonWeeks: currentLeague.regularSeasonLength,
        currentWeek: currentWeek.value,
      };
    }
    premiumLoading.value = true;
    const response = await generatePremiumReport(
      premiumReportPrompt.value,
      leagueMetadata,
      premiumCommentaryStyle.value
    );
    premiumLoading.value = false;
    rawPremiumWeeklyReport.value = response.text;
    store.addPremiumWeeklyReport(
      getLeagueKey(currentLeague),
      rawPremiumWeeklyReport.value
    );
    localStorage.setItem(
      "leagueInfo",
      JSON.stringify(store.leagueInfo as LeagueInfoType[])
    );
  }
};

const getReport = async () => {
  if (store.leagueIds.length === 0) return;
  const week = currentWeek.value;

  // Only finished weeks get a report; the in-progress week shows a "pending"
  // message in the template instead.
  if (!isWeekFinal(week)) {
    rawWeeklyReport.value = "";
    return;
  }

  // Serve the session cache instantly when we already have this week.
  if (reportsByWeek.value[week]) {
    rawWeeklyReport.value = reportsByWeek.value[week];
    return;
  }

  // Don't fire a second request for a week that's already generating.
  if (reportsInFlight.has(week)) return;
  reportsInFlight.add(week);

  const currentLeague = store.leagueInfo[store.currentLeagueIndex];
  let leagueMetadata: Record<string, string | number>;
  if (isPlayoffs.value) {
    const roundNames: { [key: number]: string } = {
      1: "Quarterfinal round",
      2: "Semifinal round",
      3: "Final Championship round",
      4: "Final Championship round",
    };
    leagueMetadata = {
      playoffRound:
        roundNames[week - currentLeague.regularSeasonLength],
    };
    if (week - currentLeague.regularSeasonLength > 2) {
      leagueMetadata["ChampionshipMatchup"] = 1;
    }
  } else {
    leagueMetadata = {
      numberOfPlayoffTeams: currentLeague.playoffTeams,
      numberRegularSeasonWeeks: currentLeague.regularSeasonLength,
      currentWeek: week,
    };
  }
  try {
    const response = await generateReport(
      reportPrompt.value,
      leagueMetadata,
      currentLeague.leagueId,
      week,
      currentLeague.season
    );
    reportsByWeek.value[week] = response.text;
    // Guard against a stale response if the user switched weeks mid-request.
    if (currentWeek.value === week) {
      rawWeeklyReport.value = response.text;
    }
  } finally {
    reportsInFlight.delete(week);
  }
};

// Fetch player names + the report for the selected week. The report is only
// generated for finished weeks; getReport() no-ops otherwise.
const loadWeek = async () => {
  if (
    store.leagueInfo.length === 0 ||
    !store.leagueInfo[store.currentLeagueIndex] ||
    weeks.value.length === 0
  ) {
    return;
  }
  loading.value = true;
  await fetchPlayerNames();
  await getReport();
  loading.value = false;
};

onMounted(async () => {
  if (
    store.leagueInfo.length > 0 &&
    store.leagueInfo[store.currentLeagueIndex] &&
    store.leagueInfo[store.currentLeagueIndex].seasonType !== "Guillotine"
  ) {
    currentWeek.value = latestFinalWeek.value;
    rawPremiumWeeklyReport.value =
      store.leagueInfo[store.currentLeagueIndex].premiumWeeklyReport ?? "";
    await loadWeek();
  }
});

const isPlayoffs = computed(() => {
  const currentLeague = store.leagueInfo[store.currentLeagueIndex];
  if (currentWeek.value > currentLeague?.regularSeasonLength) {
    return true;
  }
  return false;
});

const losersBracketIDs = computed(() => {
  return getBracketRosterIds(
    store.leagueInfo[store.currentLeagueIndex].losersBracket
  );
});

const winnersBracketIDs = computed(() => {
  return getBracketRosterIds(
    store.leagueInfo[store.currentLeagueIndex].winnersBracket
  );
});

const bestPerformers = computed(() => {
  if (
    playerNames.value.length > 0 &&
    store.leagueInfo[store.currentLeagueIndex]?.lastScoredWeek
  ) {
    return getWeeklyPerformers({
      tableData: props.tableData,
      playerNames: playerNames.value,
      weekIndex: currentWeek.value - 1,
      showUsernames: store.showUsernames,
      sortDirection: "desc",
    });
  } else if (store.leagueInfo.length === 0) {
    return fakeTopPerformers;
  }
  return [];
});

const worstPerformers = computed(() => {
  if (
    playerNames.value.length > 0 &&
    store.leagueInfo[store.currentLeagueIndex]?.lastScoredWeek
  ) {
    return getWeeklyPerformers({
      tableData: props.tableData,
      playerNames: playerNames.value,
      weekIndex: currentWeek.value - 1,
      showUsernames: store.showUsernames,
      sortDirection: "asc",
    });
  } else if (store.leagueInfo.length === 0) {
    return fakeBottomPerformers;
  }
  return [];
});

const benchPerformers = computed(() => {
  if (
    playerNames.value.length > 0 &&
    benchPlayerNames.value.length > 0 &&
    store.leagueInfo[store.currentLeagueIndex]?.lastScoredWeek
  ) {
    return getBenchPerformers({
      tableData: props.tableData,
      benchPlayerNames: benchPlayerNames.value,
      weekIndex: currentWeek.value - 1,
      showUsernames: store.showUsernames,
    });
  } else if (store.leagueInfo.length === 0) {
    return fakeBenchPerformers;
  }
  return [];
});

const reportPrompt = computed(() => {
  return buildReportPrompt({
    tableData: props.tableData,
    sortedTableData: sortedTableData.value,
    playerNames: playerNames.value,
    weekIndex: currentWeek.value - 1,
    showUsernames: store.showUsernames,
    isPlayoffs: isPlayoffs.value,
    losersBracketIds: losersBracketIDs.value,
    winnersBracketIds: winnersBracketIDs.value,
  });
});

const premiumReportPrompt = computed(() => {
  return buildPremiumReportPrompt({
    tableData: props.tableData,
    sortedTableData: sortedTableData.value,
    playerNames: playerNames.value,
    benchPlayerNames: benchPlayerNames.value,
    weekIndex: currentWeek.value - 1,
    showUsernames: store.showUsernames,
    isPlayoffs: isPlayoffs.value,
    losersBracketIds: losersBracketIDs.value,
    winnersBracketIds: winnersBracketIDs.value,
  });
});

const numOfMatchups = computed(() => {
  return getMatchupNumbers(sortedTableData.value, currentWeek.value - 1);
});

const medianScoring = computed(() => {
  return Boolean(
    store.leagueInfo.length > 0 &&
      store.leagueInfo[store.currentLeagueIndex] &&
      store.leagueInfo[store.currentLeagueIndex].medianScoring === 1
  );
});

const sortedTableData = computed(() => {
  return getSortedTableData(props.tableData, currentWeek.value - 1);
});

watch(
  () => store.currentLeagueId,
  async () => {
    // New league: drop the per-week cache and reload the latest finished week.
    reportsByWeek.value = {};
    rawWeeklyReport.value = "";
    if (store.leagueInfo[store.currentLeagueIndex]?.seasonType === "Guillotine") {
      return;
    }
    rawPremiumWeeklyReport.value =
      store.leagueInfo[store.currentLeagueIndex]?.premiumWeeklyReport ?? "";
    currentWeek.value = latestFinalWeek.value;
    await loadWeek();
  }
);

const copyReport = () => {
  navigator.clipboard.writeText(
    (tier.value === "Standard"
      ? rawWeeklyReport.value
      : rawPremiumWeeklyReport.value) + "\n\nCreated with https://enginelineffl.com"
  );
  toast.success("Summary copied to clipboard!");
};

const isGeneratingImage = ref(false);
const shareCardRef = ref<HTMLElement | null>(null);

const exportTopTeams = computed(() => {
  return getExportTopTeams(
    sortedTableData.value,
    currentWeek.value - 1,
    store.showUsernames
  );
});

const exportHotPlayers = computed(() => {
  return getExportPlayers(bestPerformers.value);
});

const exportColdPlayers = computed(() => {
  return getExportPlayers(worstPerformers.value);
});

const exportBenchPlayers = computed(() => {
  return getExportPlayers(benchPerformers.value);
});

const exportSummary = computed(() => {
  const sourceText =
    tier.value === "Premium" && rawPremiumWeeklyReport.value
      ? rawPremiumWeeklyReport.value
      : rawWeeklyReport.value;
  if (!sourceText) {
    return "";
  }
  return sourceText;
});

const downloadReportImage = async () => {
  if (isGeneratingImage.value) {
    return;
  }
  if (!shareCardRef.value || exportTopTeams.value.length === 0) {
    toast.error("No weekly data available yet");
    return;
  }

  isGeneratingImage.value = true;
  try {
    await nextTick();
    const exportWidth = shareCardRef.value.scrollWidth;
    const exportHeight = shareCardRef.value.scrollHeight;
    const dataUrl = await toPng(shareCardRef.value, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: "#ffffff",
      width: exportWidth,
      height: exportHeight,
      canvasWidth: exportWidth * 2,
      canvasHeight: exportHeight * 2,
    });
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `engine-line-week-${currentWeek.value}.png`;
    link.click();
    toast.success("Weekly report image downloaded");
  } catch (error) {
    console.error(error);
    toast.error("Unable to generate image");
  } finally {
    isGeneratingImage.value = false;
  }
};

watch([() => props.regularSeasonLength, () => activeTab.value], () => {
  // Report tab opens on the latest finished week; Preview tab on the upcoming week.
  currentWeek.value =
    activeTab.value === "Report" ? latestFinalWeek.value : weeks.value[0];
});
// Changing the selected week reloads that week's players + report (cached).
watch(() => currentWeek.value, loadWeek);
</script>
<template>
  <Card class="h-full px-6 pt-4 my-4 custom-width">
    <Tabs default-value="Report" v-model="activeTab">
      <div class="flex justify-between w-full mb-3">
        <h5 class="mr-4 text-2xl font-bold sm:text-3xl">
          Weekly {{ activeTab }}
        </h5>
        <div class="flex flex-wrap justify-end">
          <div class="inline-flex pb-1 rounded-lg sm:mr-2" role="tablist">
            <TabsList>
              <TabsTrigger value="Report"> Report </TabsTrigger>
              <TabsTrigger value="Preview"> Preview </TabsTrigger>
            </TabsList>
          </div>
          <Select v-model="currentWeek">
            <SelectTrigger
              :class="playoffWeeks.includes(currentWeek) ? 'w-44' : 'w-28'"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-if="weeks.length > 0"
                v-for="week in weeks"
                :key="week"
                :value="week"
              >
                Week {{ week }}
                {{ playoffWeeks.includes(week) ? "(playoffs)" : "" }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <Separator class="h-px my-2" />
      <TabsContent value="Report">
        <WeeklyReportSummary
          v-if="
            isWeekFinal(currentWeek) &&
            (store.leagueInfo[store.currentLeagueIndex]?.lastScoredWeek ||
              store.leagueInfo.length == 0)
          "
          v-model:tier="tier"
          v-model:premium-commentary-style="premiumCommentaryStyle"
          :weeks-length="weeks.length"
          :current-week="currentWeek"
          :has-leagues="store.leagueIds.length !== 0"
          :has-last-scored-week="
            Boolean(store.leagueInfo[store.currentLeagueIndex]?.lastScoredWeek)
          "
          :raw-weekly-report="rawWeeklyReport"
          :raw-premium-weekly-report="rawPremiumWeeklyReport"
          :loading="loading"
          :premium-loading="premiumLoading"
          :is-generating-image="isGeneratingImage"
          @download-image="downloadReportImage"
          @copy-report="copyReport"
          @generate-premium="getPremiumReport"
        />
        <p
          v-else-if="
            !isWeekFinal(currentWeek) &&
            store.leagueInfo[store.currentLeagueIndex]?.lastScoredWeek
          "
          class="mb-24 text-gray-600 dark:text-gray-300"
        >
          This week's report will be available Tuesday, once the Monday night
          game is final.
        </p>
        <p
          v-else-if="
            currentWeek == 1 &&
            !store.leagueInfo[store.currentLeagueIndex]?.lastScoredWeek
          "
          class="mb-24"
        >
          Please come back after week 1!
        </p>
        <WeeklyMatchups
          :sorted-table-data="sortedTableData"
          :matchup-numbers="numOfMatchups"
          :current-week="currentWeek"
          :show-usernames="store.showUsernames"
          :median-scoring="medianScoring"
        />
        <Separator class="h-px mt-4 mb-2.5" />

        <WeeklyPerformers
          title="Top Performers"
          :performers="bestPerformers"
          :loading="fetchingPlayers"
          score-class="mt-2 font-semibold"
        />
        <WeeklyPerformers
          title="Bottom Performers"
          :performers="worstPerformers"
          :loading="fetchingPlayers"
          score-class="mt-3.5 font-semibold"
        />
        <WeeklyPerformers
          title="Top Benchwarmers"
          :performers="benchPerformers"
          :loading="fetchingPlayers"
          score-class="mt-3 font-semibold"
        />
        <Separator class="h-px mt-4 mb-2" />
        <WeeklyPointsChart
          :sorted-table-data="sortedTableData"
          :current-week="currentWeek"
          :dark-mode="store.darkMode"
          :show-usernames="store.showUsernames"
        />
      </TabsContent>
      <TabsContent
        value="Preview"
        v-if="
          store.leagueInfo[store.currentLeagueIndex]?.seasonType !==
          'Guillotine'
        "
      >
        <WeeklyPreview
          :table-data="sortedTableData"
          :current-week="currentWeek ? currentWeek : 0"
          :is-playoffs="isPlayoffs"
        />
      </TabsContent>
    </Tabs>
  </Card>
  <div class="fixed top-0 left-[-10000px] pointer-events-none">
    <div ref="shareCardRef">
      <WeeklyShareCard
        :league-name="store.leagueInfo[store.currentLeagueIndex]?.name"
        :week="currentWeek"
        :top-teams="exportTopTeams"
        :hot-players="exportHotPlayers"
        :cold-players="exportColdPlayers"
        :bench-players="exportBenchPlayers"
        :summary="exportSummary"
      />
    </div>
  </div>
</template>
