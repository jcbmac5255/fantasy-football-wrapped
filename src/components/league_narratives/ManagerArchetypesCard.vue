<script setup lang="ts">
import { computed, ref, watch } from "vue";
import Card from "../ui/card/Card.vue";
import { generateManagerArchetype, type ManagerBlurbsPayload } from "@/api/api";
import type { ManagerArchetype } from "@/lib/narratives";
import { toast } from "vue-sonner";
import { getLeagueKey, useStore } from "@/store/store";
import { useMembershipStore } from "@/store/membership";
import { LeagueInfoType } from "@/types/types";
import Separator from "../ui/separator/Separator.vue";
import { Button } from "@/components/ui/button";
import { handleImageFallback as handleImageError } from "@/lib/imageFallback";
import { fakeProfileText } from "@/api/fakeLeague";

const store = useStore();
const membership = useMembershipStore();
const props = defineProps<{
  archetypes: ManagerArchetype[];
  payload: ManagerBlurbsPayload;
  preparePayload?: () => Promise<ManagerBlurbsPayload>;
}>();

const isLoading = ref(false);
const blurbsByUserId = ref<Record<string, string>>({});
const autoTried = ref(false);

const currentLeague = computed(
  () => store.leagueInfo[store.currentLeagueIndex]
);
const season = computed(() => currentLeague.value?.season ?? "");
const seasonComplete = computed(
  () => currentLeague.value?.status === "complete"
);
const isAdmin = computed(() => membership.isAdmin);
const hasBlurbs = computed(
  () => Object.keys(blurbsByUserId.value).length > 0
);

const getManagerArchetypes = async (force = false) => {
  if (!props.payload.managers.length || !currentLeague.value) {
    return;
  }
  try {
    isLoading.value = true;
    const payload = props.preparePayload
      ? await props.preparePayload()
      : props.payload;
    const result = await generateManagerArchetype(payload, season.value, force);
    blurbsByUserId.value = result.blurbs.reduce(
      (accumulator, entry) => {
        accumulator[entry.userId] = entry.blurb;
        return accumulator;
      },
      {} as Record<string, string>
    );
    store.addManagerProfiles(
      getLeagueKey(currentLeague.value),
      blurbsByUserId.value
    );
    localStorage.setItem(
      "leagueInfo",
      JSON.stringify(store.leagueInfo as LeagueInfoType[])
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to generate manager blurbs.";
    toast.error(message);
  } finally {
    isLoading.value = false;
  }
};

const storedManagerProfiles = computed(
  () => currentLeague.value?.managerProfiles ?? {}
);

watch(
  storedManagerProfiles,
  (profiles) => {
    blurbsByUserId.value = Object.keys(profiles).length > 0 ? profiles : {};
  },
  { immediate: true }
);

// Auto-generate once the season is over (generated once and shared via the
// backend cache, so most visitors just read the stored copy).
watch(
  [() => props.payload.managers.length, seasonComplete, storedManagerProfiles],
  () => {
    if (
      seasonComplete.value &&
      props.payload.managers.length > 0 &&
      !hasBlurbs.value &&
      !isLoading.value &&
      !autoTried.value
    ) {
      autoTried.value = true;
      getManagerArchetypes();
    }
  },
  { immediate: true }
);
</script>

<template>
  <Card class="p-4 md:p-6">
    <div class="flex flex-wrap justify-between gap-4 sm:flex-nowrap">
      <div>
        <p class="text-3xl font-bold leading-none">Manager Profiles</p>
        <p class="mt-4 sm:max-w-2xl text-muted-foreground">
          Long-term records, trends, and custom profiles that capture each
          manager’s tendencies, strengths, and overall identity.
        </p>
        <p
          v-if="isLoading"
          class="mt-2 text-sm text-muted-foreground"
        >
          Generating profiles…
        </p>
        <p
          v-else-if="!seasonComplete && !hasBlurbs && store.leagueInfo.length > 0"
          class="mt-2 text-sm text-muted-foreground"
        >
          Profile write-ups are generated automatically at the end of the season.
        </p>
      </div>
      <Button
        v-if="isAdmin && seasonComplete"
        variant="outline"
        :disabled="isLoading"
        @click="getManagerArchetypes(true)"
      >
        {{ isLoading ? "Generating…" : "Regenerate" }}
      </Button>
    </div>

    <p
      v-if="archetypes.length === 0 && store.leagueInfo.length > 0"
      class="mt-6 text-muted-foreground"
    >
      No active members to show yet. Assign active members their teams on the
      Admin page.
    </p>

    <div v-else class="grid gap-4 mt-4 sm:grid-cols-2 md:grid-cols-3">
      <div
        v-for="archetype in archetypes"
        :key="archetype.userId"
        class="p-4 border rounded-lg"
      >
        <div class="flex items-center gap-3">
          <img
            v-if="archetype.avatarImg"
            :src="archetype.avatarImg"
            :alt="`${archetype.displayName} avatar`"
            @error="handleImageError"
            class="w-10 h-10 rounded-full"
          />
          <div>
            <p class="font-semibold">{{ archetype.displayName }}</p>
            <p class="text-sm text-muted-foreground">
              {{ archetype.seasons }} seasons
            </p>
          </div>
        </div>
        <Separator class="mt-2" />
        <p
          v-if="blurbsByUserId[archetype.userId]"
          class="mt-2 text-sm leading-relaxed"
        >
          {{ blurbsByUserId[archetype.userId] }}
        </p>
        <p
          class="my-4 text-sm leading-relaxed text-muted-foreground"
          v-else-if="isLoading"
        >
          Loading manager description...
        </p>
        <p
          v-else-if="store.leagueInfo.length === 0"
          class="mt-2 text-sm leading-relaxed"
        >
          {{ fakeProfileText }}
        </p>
        <div
          class="grid gap-3 mt-4 text-sm sm:grid-cols-2 text-muted-foreground"
        >
          <div class="px-3 py-2 rounded-md bg-secondary">
            <p class="text-xs uppercase">Record</p>
            <p class="mt-1 font-medium text-foreground">
              {{ archetype.totalWins }}-{{ archetype.totalLosses
              }}<span v-if="archetype.totalTies"
                >-{{ archetype.totalTies }}</span
              >
            </p>
          </div>
          <div class="px-3 py-2 rounded-md bg-secondary">
            <p class="text-xs uppercase">Win Rate</p>
            <p class="mt-1 font-medium text-foreground">
              {{ (archetype.winRate * 100).toFixed(1) }}%
            </p>
          </div>
          <div class="px-3 py-2 rounded-md bg-secondary">
            <p class="text-xs uppercase">Points For</p>
            <p class="mt-1 font-medium text-foreground">
              {{ archetype.totalPointsFor.toFixed(1) }}
            </p>
          </div>
          <div class="px-3 py-2 rounded-md bg-secondary">
            <p class="text-xs uppercase">Points Against</p>
            <p class="mt-1 font-medium text-foreground">
              {{ archetype.totalPointsAgainst.toFixed(1) }}
            </p>
          </div>
          <div class="px-3 py-2 rounded-md bg-secondary">
            <p class="text-xs uppercase">Avg Points / Season</p>
            <p class="mt-1 font-medium text-foreground">
              {{ archetype.averagePointsPerSeason.toFixed(1) }}
            </p>
          </div>
          <div class="px-3 py-2 rounded-md bg-secondary">
            <p class="text-xs uppercase">Avg Efficiency</p>
            <p class="mt-1 font-medium text-foreground">
              {{ (archetype.averageEfficiency * 100).toFixed(1) }}%
            </p>
          </div>
          <div class="px-3 py-2 rounded-md bg-secondary">
            <p class="text-xs uppercase">Trades</p>
            <p class="mt-1 font-medium text-foreground">
              {{ archetype.totalTrades }}
            </p>
          </div>
          <div class="px-3 py-2 rounded-md bg-secondary">
            <p class="text-xs uppercase">Waivers</p>
            <p class="mt-1 font-medium text-foreground">
              {{ archetype.totalWaivers }}
            </p>
          </div>
          <div class="px-3 py-2 rounded-md bg-secondary">
            <p class="text-xs uppercase">Titles</p>
            <p class="mt-1 font-medium text-foreground">
              {{ archetype.titles }}
            </p>
          </div>
          <div class="px-3 py-2 rounded-md bg-secondary">
            <p class="text-xs uppercase">Playoff Appearances</p>
            <p class="mt-1 font-medium text-foreground">
              {{ archetype.playoffAppearances }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </Card>
</template>
