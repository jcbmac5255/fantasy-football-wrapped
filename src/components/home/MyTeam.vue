<script setup lang="ts">
import { computed } from "vue";
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

const recentScores = computed(() => {
  const points = myTeam.value?.points ?? [];
  return points
    .map((score, index) => ({ week: index + 1, score }))
    .filter((entry) => entry.score > 0)
    .slice(-6)
    .reverse();
});

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

      <Card v-if="recentScores.length" class="p-5 mt-4">
        <p class="mb-3 font-semibold">Recent scores</p>
        <div class="flex flex-wrap gap-2">
          <div
            v-for="entry in recentScores"
            :key="entry.week"
            class="px-3 py-2 text-center rounded-md bg-muted"
          >
            <p class="text-xs text-muted-foreground">Wk {{ entry.week }}</p>
            <p class="font-semibold">{{ round(entry.score) }}</p>
          </div>
        </div>
      </Card>
    </div>
  </div>
</template>
