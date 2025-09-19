// Single module entry for the app
import { init, wireEvents, controller } from "./controller/questController.js";

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", function () {
    init();
    wireEvents();
  });
} else {
  init();
  wireEvents();
}

// Optional: expose minimal debug toggle via URL hash
try {
  if (window && window.location && /debug/.test(window.location.hash)) {
    controller.setDebug && controller.setDebug(true);
  }
} catch (e) {}
