import posthog from "posthog-js";
import type { App, Plugin } from "vue";

const posthogPlugin: Plugin = {
  install(app: App) {
    const apiKey = import.meta.env.VITE_POSTHOG_KEY;
    // PostHog analytics is optional; skip init when no key is configured.
    if (!apiKey) {
      app.config.globalProperties.$posthog = posthog;
      return;
    }
    app.config.globalProperties.$posthog = posthog.init(apiKey, {
      api_host: "https://us.i.posthog.com",
      persistence: "localStorage",
    });
  },
};

export default posthogPlugin;
