/** Register the DebtPulse service worker once in the browser. */
export function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // SW registration is best-effort (blocked on some hosts / HTTP).
    });
  });
}
