<script setup lang="ts">
import { computed, ref } from "vue";
import { TableDataType } from "../../types/types";
import { useStore } from "../../store/store";
import { Card } from "../ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

const props = defineProps<{
  tableData: TableDataType[];
}>();

const store = useStore();

const STORAGE_KEY = "myTeamId";
const selectedId = ref<string>(localStorage.getItem(STORAGE_KEY) ?? "");
const picking = ref(false);

const teamName = (team: TableDataType) =>
  store.showUsernames
    ? team.username || "Ghost Roster"
    : team.name || team.username || "Ghost Roster";

// Teams ordered by standing for the picker + rank display.
const teams = computed(() =>
  [...props.tableData].sort(
    (a, b) => a.regularSeasonRank - b.regularSeasonRank
  )
);

const myTeam = computed(() =>
  props.tableData.find((team) => team.id === selectedId.value)
);

const onSelect = (id: unknown) => {
  const value = String(id ?? "");
  if (!value) return;
  selectedId.value = value;
  localStorage.setItem(STORAGE_KEY, value);
  picking.value = false;
};

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

// Most recent non-zero weekly scores (latest first), up to 6.
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
    <!-- Team picker (first visit, or when changing) -->
    <Card
      v-if="!myTeam || picking"
      class="flex flex-col items-center gap-4 px-6 py-10 text-center"
    >
      <img
        src="/engine_line_ffl_transparent.png"
        class="object-contain w-16 h-16"
        alt="Engine Line logo"
      />
      <div>
        <h2 class="text-2xl font-bold">Welcome to Engine Line</h2>
        <p class="mt-1 text-muted-foreground">
          Pick your team to see your dashboard.
        </p>
      </div>
      <Select :model-value="selectedId" @update:model-value="onSelect">
        <SelectTrigger class="w-64">
          <SelectValue placeholder="Select your team" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="team in teams" :key="team.id" :value="team.id">
            {{ teamName(team) }}
          </SelectItem>
        </SelectContent>
      </Select>
    </Card>

    <!-- Team dashboard -->
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
        <button
          class="ml-auto text-sm underline text-muted-foreground hover:text-primary"
          @click="picking = true"
        >
          Change team
        </button>
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
