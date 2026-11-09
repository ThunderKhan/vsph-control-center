(() => {
  "use strict";
  // Standalone utility views use the portal shell and the same authorized API.
  document.addEventListener("DOMContentLoaded",()=>{
    if (!["notifications","reports"].includes(document.body.dataset.operationsMode)) return;
    document.dispatchEvent(new CustomEvent("vsph:identity-loaded",{detail:{}}));
  });
})();
