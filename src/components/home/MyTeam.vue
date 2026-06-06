<script setup lang="ts">
import { computed, watch } from "vue";
import { TableDataType } from "../../types/types";
import { useStore } from "../../store/store";
import { useMembershipStore } from "../../store/membership";
import { Card } from "../ui/card";

const props = defineProps<{
  tableData: TableDataType[];
}>();

const store = useStore();
const membership = useMembershipStore();

const teamName = (team: TableDataType) =>
  store.showUsernames
    ? team.username || "Ghost Roster"
    : team.name || team.username || "Ghost Roster";

const myTeam = computed(() =>
  membership.hasTeam
    ? props.tableData.find((team) => team.rosterId === membership.rosterId)
    : undefined
);

// Has a team but the league data hasn't loaded yet.
const resolving = computed(() => membership.hasTeam && !myTeam.value);

// Cache the resolved team name so the Account page can show it instantly.
watch(
  myTeam,
  (team) => {
    if (team) localStorage.setItem("myTeamName", teamName(team));
  },
  { immediate: true }
);

const round = (n: number, digits = 1) =>
  Number.isFinite(n) ? n.toFixed(digits) : "—";

const record = computed(() => {
  const t = myTeam.value;
  if (!t) return "";
  return t.ties ? `${t.wins}-${t.losses}-${t.ties}` : `${t.wins}-${t.losses}`;
});

const efficiency = computed(() =>
  myTeam.value ? `${(myTeam.value.managerEfficiency * 100).toFixed(1)}%` : "—"
);

type WeekResult = {
  week: number;
  myScore: number;
  oppScore: number;
  oppName: string;
  margin: number;
  result: "W" | "L" | "T";
};

const regularSeasonLength = computed(
  () => store.leagueInfo[store.currentLeagueIndex]?.regularSeasonLength ?? 0
);

// Per-week regular-season result for my team (opponent paired by matchup id).
const weeklyResults = computed<WeekResult[]>(() => {
  const t = myTeam.value;
  if (!t) return [];
  const results: WeekResult[] = [];
  const regWeeks = regularSeasonLength.value;
  t.points.forEach((myScore, w) => {
    if (regWeeks && w >= regWeeks) return;
    const matchupId = t.matchups[w];
    if (!matchupId || myScore <= 0) return;
    const opp = props.tableData.find(
      (o) => o.rosterId !== t.rosterId && o.matchups[w] === matchupId
    );
    if (!opp) return;
    const oppScore = opp.points[w] ?? 0;
    const margin = myScore - oppScore;
    results.push({
      week: w + 1,
      myScore,
      oppScore,
      oppName: teamName(opp),
      margin,
      result: margin > 0 ? "W" : margin < 0 ? "L" : "T",
    });
  });
  return results;
});

const leagueAvgForWeek = (week: number) => {
  const w = week - 1;
  const scores = props.tableData
    .map((t) => t.points[w] ?? 0)
    .filter((s) => s > 0);
  return scores.length
    ? scores.reduce((a, b) => a + b, 0) / scores.length
    : 0;
};

const highlights = computed(() => {
  const r = weeklyResults.value;
  const t = myTeam.value;
  if (!t || r.length === 0) return [];
  const best = r.reduce((a, b) => (b.myScore > a.myScore ? b : a));
  const worst = r.reduce((a, b) => (b.myScore < a.myScore ? b : a));
  const wins = r.filter((x) => x.result === "W");
  const losses = r.filter((x) => x.result === "L");
  const biggestWin = wins.length
    ? wins.reduce((a, b) => (b.margin > a.margin ? b : a))
    : null;
  const worstLoss = losses.length
    ? losses.reduce((a, b) => (b.margin < a.margin ? b : a))
    : null;
  let longestWin = 0;
  let longestLoss = 0;
  let curW = 0;
  let curL = 0;
  for (const x of r) {
    curW = x.result === "W" ? curW + 1 : 0;
    curL = x.result === "L" ? curL + 1 : 0;
    longestWin = Math.max(longestWin, curW);
    longestLoss = Math.max(longestLoss, curL);
  }
  const benchPoints = Math.max(0, (t.potentialPoints ?? 0) - (t.pointsFor ?? 0));

  return [
    { label: "Best week", value: round(best.myScore), sub: `Week ${best.week}` },
    {
      label: "Worst week",
      value: round(worst.myScore),
      sub: `Week ${worst.week}`,
    },
    {
      label: "Biggest win",
      value: biggestWin ? `+${round(biggestWin.margin)}` : "—",
      sub: biggestWin ? `vs ${biggestWin.oppName} · Wk ${biggestWin.week}` : "",
    },
    {
      label: "Worst loss",
      value: worstLoss ? round(worstLoss.margin) : "—",
      sub: worstLoss ? `vs ${worstLoss.oppName} · Wk ${worstLoss.week}` : "",
    },
    {
      label: "Longest win streak",
      value: `${longestWin}`,
      sub: longestWin === 1 ? "game" : "games",
    },
    {
      label: "Longest losing streak",
      value: `${longestLoss}`,
      sub: longestLoss === 1 ? "game" : "games",
    },
    { label: "Points left on bench", value: round(benchPoints), sub: "season" },
  ];
});

const WIN_COLOR = "#22c55e";
const LOSS_COLOR = "#ef4444";
const TIE_COLOR = "#9ca3af";

const chartSeries = computed(() => [
  {
    name: "My points",
    type: "column",
    data: weeklyResults.value.map((r) => ({
      x: `Wk ${r.week}`,
      y: Number(r.myScore.toFixed(1)),
      fillColor:
        r.result === "W" ? WIN_COLOR : r.result === "L" ? LOSS_COLOR : TIE_COLOR,
    })),
  },
  {
    name: "League avg",
    type: "line",
    data: weeklyResults.value.map((r) => ({
      x: `Wk ${r.week}`,
      y: Number(leagueAvgForWeek(r.week).toFixed(1)),
    })),
  },
]);

const chartOptions = computed(() => ({
  chart: {
    type: "line",
    foreColor: store.darkMode ? "#ffffff" : "#111827",
    toolbar: { show: false },
    zoom: { enabled: false },
    animations: { enabled: false },
  },
  plotOptions: { bar: { columnWidth: "55%", borderRadius: 3 } },
  stroke: { width: [0, 3], curve: "smooth", dashArray: [0, 5] },
  colors: [WIN_COLOR, "#9ca3af"],
  markers: { size: [0, 4] },
  dataLabels: { enabled: false },
  legend: { show: false },
  tooltip: {
    theme: store.darkMode ? "dark" : "light",
    shared: true,
    intersect: false,
  },
  xaxis: { type: "category" },
  yaxis: { labels: { formatter: (x: number) => `${Math.round(x)}` } },
}));

const stats = computed(() => {
  const t = myTeam.value;
  if (!t) return [];
  return [
    { label: "Record", value: record.value },
    { label: "Points For", value: round(t.pointsFor) },
    { label: "Points Against", value: round(t.pointsAgainst) },
    { label: "Power Rating", value: round(t.rating) },
    { label: "Manager Efficiency", value: efficiency.value },
    { label: "Expected Wins", value: round(t.winsAgainstAll, 0) },
  ];
});
</script>

<template>
  <div class="max-w-3xl px-4 mx-auto mt-4 mb-16">
    <Card
      v-if="resolving"
      class="flex flex-col items-center gap-4 px-6 py-10 text-center"
    >
      <p class="text-muted-foreground">Loading your team…</p>
    </Card>

    <!-- Only reachable by the admin without a team assigned. -->
    <Card
      v-else-if="!myTeam"
      class="flex flex-col items-center gap-4 px-6 py-10 text-center"
    >
      <img
        src="/engine_line_ffl_transparent.png"
        class="object-contain w-16 h-16"
        alt="Engine Line logo"
      />
      <div>
        <h2 class="text-2xl font-bold">No team assigned</h2>
        <p class="max-w-md mt-1 text-muted-foreground">
          Assign yourself a team on the Admin page to see your dashboard here.
        </p>
      </div>
    </Card>

    <div v-else>
      <Card class="flex items-center gap-4 p-5">
        <img
          v-if="myTeam.avatarImg"
          :src="myTeam.avatarImg"
          class="object-cover w-16 h-16 rounded-full"
          :alt="`${teamName(myTeam)} avatar`"
        />
        <div class="min-w-0">
          <h2 class="text-2xl font-bold truncate">{{ teamName(myTeam) }}</h2>
          <p class="text-muted-foreground">
            Rank #{{ myTeam.regularSeasonRank }} of {{ tableData.length }}
            <span v-if="!store.showUsernames && myTeam.username">
              · {{ myTeam.username }}</span
            >
          </p>
        </div>
      </Card>

      <div class="grid grid-cols-2 gap-3 mt-4 sm:grid-cols-3">
        <Card v-for="stat in stats" :key="stat.label" class="p-4">
          <p class="text-sm text-muted-foreground">{{ stat.label }}</p>
          <p class="text-xl font-semibold">{{ stat.value }}</p>
        </Card>
      </div>

      <Card v-if="highlights.length" class="p-5 mt-4">
        <p class="mb-3 font-semibold">Season highlights</p>
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div
            v-for="h in highlights"
            :key="h.label"
            class="px-3 py-2 rounded-md bg-muted"
          >
            <p class="text-xs text-muted-foreground">{{ h.label }}</p>
            <p class="font-semibold">{{ h.value }}</p>
            <p v-if="h.sub" class="text-xs truncate text-muted-foreground">
              {{ h.sub }}
            </p>
          </div>
        </div>
      </Card>

      <Card v-if="weeklyResults.length" class="p-5 mt-4">
        <p class="font-semibold">Weekly scoring</p>
        <p class="mb-2 text-xs text-muted-foreground">
          Green = win, red = loss · dashed line is the league average
        </p>
        <apexchart
          width="100%"
          height="320"
          type="line"
          :options="chartOptions"
          :series="chartSeries"
        ></apexchart>
      </Card>
    </div>
  </div>
</template>
