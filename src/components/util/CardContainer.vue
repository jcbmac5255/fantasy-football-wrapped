<script setup lang="ts">
import { computed } from "vue";
import { useStore } from "../../store/store";

const store = useStore();

const leagueName = computed(
  () => store.leagueInfo[store.currentLeagueIndex]?.name ?? ""
);
</script>
<template>
  <div class="flex flex-1 min-w-0">
    <div class="flex items-center w-full overflow-auto no-scrollbar">
      <p class="font-medium truncate ml-1.5">{{ leagueName }}</p>
    </div>
  </div>
</template>
<style>
/* Hide scrollbar for Chrome, Safari and Opera */
.no-scrollbar::-webkit-scrollbar {
  display: none;
}

/* Hide scrollbar for IE, Edge and Firefox */
.no-scrollbar {
  -ms-overflow-style: none; /* IE and Edge */
  scrollbar-width: none; /* Firefox */
}
</style>
