<script setup lang="ts">
import { watch } from "vue";
import { useStore } from "@/store/store";
import Switch from "@/components/ui/switch/Switch.vue";
import Separator from "@/components/ui/separator/Separator.vue";

const store = useStore();

watch(
  () => store.showUsernames,
  (newValue) => {
    localStorage.setItem("showUsernames", JSON.stringify(newValue));
  }
);
</script>
<template>
  <div class="container w-11/12 h-auto max-w-screen-xl pb-20 mx-auto sm:ml-8">
    <div class="container mx-auto mt-4">
      <h1 class="mb-4 text-3xl font-semibold">About</h1>

      <div class="max-w-4xl text-base leading-relaxed">
        <div class="space-y-4">
          <p class="text-base leading-relaxed">
            Engine Line is the private dashboard for our fantasy football league,
            powered by
            <a
              aria-label="Link to sleeper website"
              class="font-medium text-primary hover:underline"
              href="https://sleeper.com"
              target="_blank"
              rel="noopener noreferrer"
              >Sleeper</a
            >. It turns our league's data into standings, power rankings, playoff
            odds, weekly reports, draft grades, and more.
          </p>
          <p class="text-base leading-relaxed">
            Questions or suggestions? Send an
            <a
              href="mailto:jcbmac5255@gmail.com?subject=Engine Line"
              class="font-medium text-primary hover:underline"
              >email</a
            >.
          </p>
        </div>
        <div class="flex items-center justify-between mt-6">
          <h3 class="text-3xl font-semibold">Settings</h3>
        </div>
        <div class="flex items-center mt-4 space-x-2">
          <Switch
            v-model="store.showUsernames"
            :disabled="store.leagueInfo.length == 0"
          />
          <label>Show usernames instead of team names</label>
        </div>
        <Separator class="mt-6" />
        <p class="mt-2 text-sm text-muted-foreground">
          &copy; 2024-2026 Engine Line
        </p>
      </div>
    </div>
  </div>
</template>
