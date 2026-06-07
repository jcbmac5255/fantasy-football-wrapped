<script setup lang="ts">
import { computed } from "vue";
import { APP_VERSION } from "@/lib/config";

type Change = { type: "Feature" | "Update" | "Fix"; text: string[] };
type Release = { version: string; date: string; content: Change[] };

// Newest first. Add a new release object at the top when you ship changes
// (and bump APP_VERSION in src/lib/config.ts).
const releases: Release[] = [
  {
    version: "1.3.1",
    date: "June 7, 2026",
    content: [
      {
        type: "Update",
        text: [
          "Filtering Rivalries by a manager now flips every card to that manager's perspective — their avatar, win count, and points show first.",
        ],
      },
    ],
  },
  {
    version: "1.3.0",
    date: "June 6, 2026",
    content: [
      {
        type: "Feature",
        text: [
          "New Rivalries tab: all-time head-to-head records, scoring edges, streaks, closest games and blowouts, and a 'heat' rating for every manager matchup across league history.",
        ],
      },
    ],
  },
  {
    version: "1.2.1",
    date: "June 6, 2026",
    content: [
      {
        type: "Fix",
        text: [
          "Auction drafts now show each player's winning bid amount on the Draft Recap (instead of a snake-style round/pick number).",
          "Hid the Grades tab for auction drafts — its grades are based on snake-draft pick position vs ADP, which doesn't apply to auctions.",
        ],
      },
    ],
  },
  {
    version: "1.2.0",
    date: "June 6, 2026",
    content: [
      {
        type: "Feature",
        text: [
          "The My Team page now has season highlights (best/worst week, biggest win, worst loss, longest streaks, points left on the bench) and a weekly scoring chart with win/loss coloring vs the league average.",
        ],
      },
    ],
  },
  {
    version: "1.1.2",
    date: "June 6, 2026",
    content: [
      {
        type: "Fix",
        text: [
          "Player names now display correctly everywhere (trades, waivers, weekly reports, start/sit) instead of showing as a team defense.",
        ],
      },
    ],
  },
  {
    version: "1.1.1",
    date: "June 6, 2026",
    content: [
      {
        type: "Update",
        text: [
          "Avatars now show each manager's custom league team avatar (set in Sleeper) instead of their profile picture.",
        ],
      },
    ],
  },
  {
    version: "1.1.0",
    date: "June 6, 2026",
    content: [
      {
        type: "Feature",
        text: [
          "Manager Profiles now generate automatically at the end of each season and are shared with the whole league.",
        ],
      },
      {
        type: "Update",
        text: [
          "The Manager Profiles page now shows only active league members.",
        ],
      },
    ],
  },
  {
    version: "1.0.0",
    date: "June 6, 2026",
    content: [
      {
        type: "Feature",
        text: [
          "Sign in to see your team's dashboard on the Home tab — record, rank, points for/against, power rating, and recent scores.",
          "AI weekly reports are generated once per week and shared with the whole league.",
        ],
      },
      {
        type: "Update",
        text: [
          "Accounts are admin-managed: once you're assigned a team, the full app unlocks.",
          "Refreshed sign-in screen and Engine Line branding throughout.",
        ],
      },
    ],
  },
  {
    version: "0.9.0",
    date: "June 2026",
    content: [
      {
        type: "Feature",
        text: [
          "Engine Line launched: standings, power rankings, expected wins, playoff odds, draft grades, the schedule simulator, trade lab, league history, and more.",
        ],
      },
    ],
  },
];

// Show only the most recent releases.
const recent = computed(() => releases.slice(0, 5));

// Combine releases that share a date into a single dated group, merging their
// changes by type (Feature / Update / Fix).
const TYPE_ORDER: Change["type"][] = ["Feature", "Update", "Fix"];
const groupedByDate = computed(() => {
  const order: string[] = [];
  const byDate = new Map<string, Map<Change["type"], string[]>>();
  for (const release of recent.value) {
    if (!byDate.has(release.date)) {
      byDate.set(release.date, new Map());
      order.push(release.date);
    }
    const byType = byDate.get(release.date)!;
    for (const change of release.content) {
      if (!byType.has(change.type)) byType.set(change.type, []);
      byType.get(change.type)!.push(...change.text);
    }
  }
  return order.map((date) => {
    const byType = byDate.get(date)!;
    const content = TYPE_ORDER.filter((type) => byType.has(type)).map(
      (type) => ({ type, text: byType.get(type)! })
    );
    return { date, content };
  });
});

const badgeClass = (type: Change["type"]) => {
  switch (type) {
    case "Feature":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
    case "Update":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
    case "Fix":
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
  }
};
</script>
<template>
  <div class="container w-11/12 h-auto max-w-screen-xl pb-20 mx-auto sm:ml-8">
    <div class="container mx-auto mt-4">
      <div class="flex items-baseline gap-3 mb-6">
        <h1 class="text-3xl font-semibold">Changelog</h1>
        <span class="text-sm text-muted-foreground">v{{ APP_VERSION }}</span>
      </div>

      <div v-for="group in groupedByDate" :key="group.date" class="mb-8">
        <div class="mb-2">
          <span class="text-xl font-semibold">{{ group.date }}</span>
        </div>
        <div
          v-for="(change, i) in group.content"
          :key="i"
          class="mt-3 max-w-4xl"
        >
          <span
            class="text-sm font-medium px-2.5 py-0.5 rounded"
            :class="badgeClass(change.type)"
            >{{ change.type }}</span
          >
          <ul class="mt-2 space-y-1 list-disc list-inside">
            <li
              v-for="text in change.text"
              :key="text"
              class="text-base"
            >
              {{ text }}
            </li>
          </ul>
        </div>
        <hr class="h-px mt-4 bg-gray-200 border-0 dark:bg-gray-700" />
      </div>
    </div>
  </div>
</template>
