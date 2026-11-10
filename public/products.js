(() => {
  "use strict";
  const $ = (x) => document.getElementById(x),
    form = $("form"),
    select = $("product");
  let rows = [],
    current = null,
    key = crypto.randomUUID(),
    busy = false;
  async function api(path, options = {}) {
    const r = await fetch("/api/admin-management/product-registry" + path, {
      ...options,
      headers: { "Content-Type": "application/json" },
    });
    const d = await r.json();
    if (!r.ok) throw Error(d.message || "Request denied.");
    return d;
  }
  function busyState(value) {
    busy = value;
    document.querySelector("main").setAttribute("aria-busy", String(value));
    for (const el of document.querySelectorAll("main input, main select, main textarea, main button"))
      el.disabled = value;
    form.elements.code.disabled = value || Boolean(current);
  }
  async function run(fn) {
    if (busy) return;
    busyState(true);
    $("message").textContent = "";
    try {
      await fn();
    } catch (e) {
      $("message").textContent = e.message;
    } finally {
      busyState(false);
    }
  }
  function show(product) {
    current = product || null;
    key = crypto.randomUUID();
    form.reset();
    $("editor").hidden = false;
    $("health").hidden = !current;
    $("heading").textContent = current
      ? "Edit " + current.name
      : "Register product";
    if (current) {
      for (const [field, key] of Object.entries({
        code: "code",
        name: "name",
        status: "status",
        visibility: "visibility",
        integrationMode: "integration_mode",
        ownerId: "owner_id",
        supportEmail: "support_email",
        docsUrl: "docs_url",
        description: "description",
      }))
        form.elements[field].value = current[key] || "";
      $("readiness").textContent =
        current.readiness.state + " · " + current.readiness.reason;
      $("observation").textContent = current.latest_health
        ? "Last local observation " +
          current.health_observed_at +
          " · " +
          current.latest_health.state +
          " · " +
          current.latest_health.scope
        : "No persisted local check. External acceptance unverified.";
    }
    form.elements.code.disabled = Boolean(current);
  }
  let nextCursor;
  async function load(id, afterCode) {
    rows = await api(
      afterCode ? "?afterCode=" + encodeURIComponent(afterCode) : "",
    );
    $("nextPage").hidden = rows.length < 100;
    nextCursor = rows.at(-1)?.code;
    if (id && !rows.some((p) => p.id === id))
      rows.push(await api("/item/" + id));
    select.replaceChildren();
    const blank = document.createElement("option");
    blank.value = "";
    blank.textContent = "Select a registered product";
    select.append(blank);
    for (const p of rows) {
      const o = document.createElement("option");
      o.value = p.id;
      o.textContent = p.code + " · " + p.name + " · " + String(p.status || "").replace(/\b[a-z]/g, letter => letter.toUpperCase());
      select.append(o);
    }
    if (id) {
      select.value = id;
      show(rows.find((p) => p.id === id));
    }
  }
  $("nextPage").onclick = () => run(() => load(null, nextCursor));
  $("firstPage").onclick = () => run(() => load(null));
  select.onchange = () => {
    if (select.value) show(rows.find((p) => p.id === select.value));
  };
  $("new").onclick = () => {
    select.value = "";
    show(null);
  };
  form.oninput = () => {
    if (!current) key = crypto.randomUUID();
  };
  form.onsubmit = async (e) => {
    e.preventDefault();
    const value = (n) => form.elements[n].value.trim(),
      code = value("code");
    const data = {
      code,
      name: value("name"),
      loginPath: "/apps/" + code.toLowerCase() + "/login",
      status: value("status"),
      visibility: value("visibility"),
      integrationMode: value("integrationMode"),
      ownerId: value("ownerId"),
      supportEmail: value("supportEmail"),
      docsUrl: value("docsUrl"),
      description: value("description"),
    };
    if (current) data.version = current.version;
    if (
      current &&
      data.status !== "active" &&
      !await VSPHUI.confirm(
        "This lifecycle change blocks product access and revokes existing product sessions. Continue?",
      )
    )
      return;
    run(async () => {
      const id = current?.id || key;
      await api("/" + (current ? "update" : "create") + "/" + id, {
        method: "POST",
        body: JSON.stringify(data),
      });
      await load(id);
      $("message").textContent =
        "Product saved with an atomic audit event. No integration has been enabled or verified by this metadata change.";
    });
  };
  $("check").onclick = () =>
    run(async () => {
      await api("/" + current.id + "/check", { method: "POST", body: "{}" });
      await load(current.id);
      $("message").textContent =
        "Local observation saved. External provider acceptance remains unverified.";
    });
  run(() => load(new URLSearchParams(location.search).get("product")));
})();
