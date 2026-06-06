import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { useAuthStore } from "./auth";
import { getMyTeam, registerMember } from "@/lib/admin";
import { ADMIN_EMAIL } from "@/lib/config";

// Drives the whole-app access gate. A user only gets into the app once they're
// signed in, active, and have a team assigned — except the admin, who always
// has access (so they can activate + assign everyone else).
export const useMembershipStore = defineStore("membership", () => {
  const authStore = useAuthStore();

  const rosterId = ref<number | null>(null);
  const active = ref<boolean | null>(null);
  const loaded = ref(false);
  const loading = ref(false);

  const isAdmin = computed(
    () =>
      (authStore.user?.email ?? "").toLowerCase() === ADMIN_EMAIL.toLowerCase()
  );

  const hasTeam = computed(
    () => active.value === true && rosterId.value !== null
  );

  const canAccess = computed(() => isAdmin.value || hasTeam.value);

  const refresh = async () => {
    // Mark undecided up front (synchronously) so the gate shows the splash, not
    // the sign-in page, while we re-check access after an auth change.
    loaded.value = false;
    if (!authStore.isAuthenticated) {
      rosterId.value = null;
      active.value = null;
      loaded.value = true;
      return;
    }
    loading.value = true;
    try {
      // Make sure a member row exists, then read this user's assignment.
      await registerMember();
      const me = await getMyTeam();
      rosterId.value = me.rosterId;
      active.value = me.active;
    } finally {
      loaded.value = true;
      loading.value = false;
    }
  };

  return {
    rosterId,
    active,
    loaded,
    loading,
    isAdmin,
    hasTeam,
    canAccess,
    refresh,
  };
});
