import { ref } from "vue";

// Reactive flag: true when a new app version has been deployed and is waiting.
export const needRefresh = ref(false);

// The updateSW function from vite-plugin-pwa; calling it (with true) activates
// the new service worker and reloads the page.
let updateSW: ((reloadPage?: boolean) => Promise<void>) | null = null;

export const setUpdateSW = (fn: (reloadPage?: boolean) => Promise<void>) => {
  updateSW = fn;
};

export const applyUpdate = () => {
  if (updateSW) {
    updateSW(true);
  } else {
    window.location.reload();
  }
};
