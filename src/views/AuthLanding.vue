<script setup lang="ts">
import { ref } from "vue";
import { useAuthStore } from "@/store/auth";
import { useMembershipStore } from "@/store/membership";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "vue-sonner";

const authStore = useAuthStore();
const membership = useMembershipStore();

const mode = ref<"signin" | "signup">("signin");
const email = ref("");
const password = ref("");
const loading = ref(false);

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

const submit = async () => {
  if (!email.value || !password.value) {
    toast.error("Enter your email and password.");
    return;
  }
  loading.value = true;
  try {
    if (mode.value === "signin") {
      await authStore.signInWithPassword(email.value, password.value);
    } else {
      const { needsVerification } = await authStore.signUpWithPassword(
        email.value,
        password.value
      );
      if (needsVerification) {
        toast.success("Account created. Check your email to confirm, then sign in.");
        mode.value = "signin";
        return;
      }
      toast.success("Account created!");
    }
    // Re-evaluate access (admin / assigned team) after auth succeeds.
    await membership.refresh();
  } catch (error) {
    toast.error(getErrorMessage(error, "Something went wrong. Please try again."));
  } finally {
    loading.value = false;
  }
};

const signOut = async () => {
  await authStore.signOut();
  await membership.refresh();
};
</script>

<template>
  <div class="flex items-center justify-center min-h-screen px-4 bg-background">
    <div class="w-full max-w-sm">
      <div class="flex flex-col items-center mb-4 text-center">
        <img
          src="/engine_line_ffl_transparent.png"
          class="object-contain w-64 h-64 sm:w-72 sm:h-72"
          alt="Engine Line logo"
        />
      </div>

      <!-- Signed in but not yet provisioned -->
      <Card v-if="authStore.isAuthenticated" class="p-6 text-center">
        <h2 class="text-lg font-semibold">Almost there</h2>
        <p class="mt-2 text-sm text-muted-foreground">
          You're signed in. An admin needs to activate your account and assign
          your team before you can get in. Check back soon.
        </p>
        <Button variant="outline" class="mt-4" @click="signOut">Sign out</Button>
      </Card>

      <!-- Sign in / sign up -->
      <Card v-else class="p-6">
        <h2 class="text-lg font-semibold text-center">
          {{ mode === "signin" ? "Sign in" : "Create your account" }}
        </h2>
        <form class="mt-4 space-y-3" @submit.prevent="submit">
          <div>
            <label class="text-sm" for="auth-email">Email</label>
            <input
              id="auth-email"
              v-model="email"
              type="email"
              autocomplete="email"
              class="w-full px-3 py-2 mt-1 text-sm border rounded-md bg-background"
            />
          </div>
          <div>
            <label class="text-sm" for="auth-password">Password</label>
            <input
              id="auth-password"
              v-model="password"
              type="password"
              :autocomplete="mode === 'signin' ? 'current-password' : 'new-password'"
              class="w-full px-3 py-2 mt-1 text-sm border rounded-md bg-background"
            />
          </div>
          <Button type="submit" class="w-full" :disabled="loading">
            {{
              loading
                ? "Please wait…"
                : mode === "signin"
                  ? "Sign in"
                  : "Create account"
            }}
          </Button>
        </form>
        <p class="mt-4 text-sm text-center text-muted-foreground">
          <template v-if="mode === 'signin'">
            New here?
            <button
              type="button"
              class="font-medium text-primary hover:underline"
              @click="mode = 'signup'"
            >
              Create an account
            </button>
          </template>
          <template v-else>
            Already have an account?
            <button
              type="button"
              class="font-medium text-primary hover:underline"
              @click="mode = 'signin'"
            >
              Sign in
            </button>
          </template>
        </p>
      </Card>
    </div>
  </div>
</template>
