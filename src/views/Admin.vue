<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useStore } from "@/store/store";
import { useAuthStore } from "@/store/auth";
import { ADMIN_EMAIL, LEAGUE_ID } from "@/lib/config";
import {
  getSettings,
  setLeagueId,
  listMembers,
  setMember,
  type LeagueMember,
} from "@/lib/admin";
import { getData } from "@/api/api";
import { createTableData } from "@/api/helper";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Switch from "@/components/ui/switch/Switch.vue";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "vue-sonner";

const store = useStore();
const authStore = useAuthStore();

const isAdmin = computed(
  () =>
    (authStore.user?.email ?? "").toLowerCase() === ADMIN_EMAIL.toLowerCase()
);

const leagueIdInput = ref("");
const savingLeagueId = ref(false);
const members = ref<LeagueMember[]>([]);
const loadingMembers = ref(false);
const savingMemberId = ref<string | null>(null);

// League teams (for the assignment dropdown), derived from loaded league data.
const teams = computed(() => {
  const idx = store.currentLeagueIndex;
  const users = store.leagueUsers[idx];
  const rosters = store.leagueRosters[idx];
  const points = store.weeklyPoints[idx];
  if (!users || !rosters || !points) return [];
  const median = store.leagueInfo[idx]?.medianScoring === 1;
  return createTableData(users, rosters, points, median)
    .map((t) => ({
      rosterId: t.rosterId,
      label: t.name || t.username || `Roster ${t.rosterId}`,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
});

const teamLabel = (rosterId: number | null) =>
  rosterId === null
    ? "Unassigned"
    : (teams.value.find((t) => t.rosterId === rosterId)?.label ??
      `Roster ${rosterId}`);

const loadMembers = async () => {
  loadingMembers.value = true;
  try {
    members.value = await listMembers();
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Failed to load.");
  }
  loadingMembers.value = false;
};

onMounted(async () => {
  if (!isAdmin.value) return;
  // Make sure the league is loaded so we have team names.
  if (store.leagueInfo.length === 0) {
    try {
      const settings = await getSettings();
      const id = settings.leagueId || LEAGUE_ID;
      const league = await getData(id);
      store.updateLeagueInfo(league);
      store.updateCurrentLeagueId(id);
    } catch {
      // teams dropdown will just be empty
    }
  }
  const settings = await getSettings();
  leagueIdInput.value = settings.leagueId || LEAGUE_ID;
  await loadMembers();
});

const saveLeagueId = async () => {
  savingLeagueId.value = true;
  try {
    await setLeagueId(leagueIdInput.value.trim());
    toast.success("League id saved. Reload the app to load the new league.");
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Failed to save.");
  }
  savingLeagueId.value = false;
};

const saveMember = async (
  member: LeagueMember,
  changes: { rosterId?: number | null; active?: boolean }
) => {
  const rosterId =
    changes.rosterId !== undefined ? changes.rosterId : member.roster_id;
  const active =
    changes.active !== undefined ? changes.active : (member.active ?? true);
  savingMemberId.value = member.user_id;
  try {
    await setMember(member.user_id, rosterId, active);
    member.roster_id = rosterId;
    member.active = active;
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Failed to save.");
  }
  savingMemberId.value = null;
};

const onTeamChange = (member: LeagueMember, value: unknown) => {
  const str = String(value ?? "");
  saveMember(member, { rosterId: str === "" ? null : Number(str) });
};
</script>

<template>
  <div class="container w-11/12 h-auto max-w-screen-xl pb-20 mx-auto sm:ml-8">
    <div class="container mx-auto mt-4">
      <h1 class="mb-4 text-3xl font-semibold">Admin</h1>

      <p v-if="!isAdmin" class="text-muted-foreground">
        Admin access is required to view this page.
      </p>

      <div v-else class="space-y-8">
        <!-- League id -->
        <Card class="max-w-xl p-5">
          <h2 class="text-xl font-semibold">Sleeper League</h2>
          <p class="mt-1 text-sm text-muted-foreground">
            Paste the new league id when the season changes, then reload the app.
          </p>
          <div class="flex items-end gap-2 mt-3">
            <div class="flex-1">
              <label class="text-sm">League ID</label>
              <input
                v-model="leagueIdInput"
                inputmode="numeric"
                class="w-full px-3 py-2 mt-1 text-sm border rounded-md bg-background"
                placeholder="e.g. 1253512178368004096"
              />
            </div>
            <Button :disabled="savingLeagueId" @click="saveLeagueId">
              {{ savingLeagueId ? "Saving…" : "Save" }}
            </Button>
          </div>
        </Card>

        <!-- Members -->
        <Card class="p-5">
          <div class="flex items-center justify-between">
            <h2 class="text-xl font-semibold">League Members</h2>
            <Button variant="outline" size="sm" @click="loadMembers">
              Refresh
            </Button>
          </div>
          <p class="mt-1 text-sm text-muted-foreground">
            Assign each signed-in member a team and toggle whether they're active.
          </p>

          <p v-if="loadingMembers" class="mt-4 text-muted-foreground">
            Loading…
          </p>
          <p
            v-else-if="members.length === 0"
            class="mt-4 text-muted-foreground"
          >
            No one has signed in yet. Members appear here after they create an
            account.
          </p>

          <div v-else class="mt-4 overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="text-left text-muted-foreground">
                <tr class="border-b">
                  <th class="py-2 pr-4 font-medium">Email</th>
                  <th class="py-2 pr-4 font-medium">Team</th>
                  <th class="py-2 font-medium">Active</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="member in members"
                  :key="member.user_id"
                  class="border-b last:border-0"
                >
                  <td class="py-3 pr-4 align-middle">{{ member.email }}</td>
                  <td class="py-3 pr-4 align-middle">
                    <Select
                      :model-value="
                        member.roster_id === null
                          ? ''
                          : String(member.roster_id)
                      "
                      @update:model-value="
                        (value) => onTeamChange(member, value)
                      "
                    >
                      <SelectTrigger class="w-48">
                        <SelectValue :placeholder="teamLabel(member.roster_id)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Unassigned</SelectItem>
                        <SelectItem
                          v-for="team in teams"
                          :key="team.rosterId"
                          :value="String(team.rosterId)"
                        >
                          {{ team.label }}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td class="py-3 align-middle">
                    <Switch
                      :model-value="member.active ?? true"
                      :disabled="savingMemberId === member.user_id"
                      @update:model-value="
                        (value) => saveMember(member, { active: value })
                      "
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  </div>
</template>
