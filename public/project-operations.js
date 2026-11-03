(() => {
  "use strict";
  const $ = (id) => document.getElementById(id),
    el = (tag, text) => {
      const n = document.createElement(tag);
      if (text !== undefined) n.textContent = String(text);
      return n;
    };
  let identity;
  async function api(path, body) {
    const r = await fetch(path, {
      credentials: "same-origin",
      cache: "no-store",
      ...(body
        ? {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        : {}),
    });
    const d = await r.json();
    if (!r.ok) throw Error(d.message || "Operations request failed.");
    return d;
  }
  function button(label, fn) {
    const b = el("button", label);
    b.type = "button";
    b.onclick = async () => {
      b.disabled = true;
      try {
        await fn();
      } catch (e) {
        $("operationsMessage").textContent = e.message;
      } finally {
        b.disabled = false;
      }
    };
    return b;
  }
  async function inbox() {
    const data = await api("/api/notifications"),
      box = $("notificationList");
    box.replaceChildren();
    $("notificationDelivery").textContent =
      data.queued +
      " queued · " +
      data.attention +
      " require retry. In-app delivery only.";
    for (const n of data.notifications) {
      const item = el("li"),
        a = el(
          "a",
          n.project_name +
            " · " +
            n.event_type +
            " · " +
            (n.title || "Project event"),
        );
      a.href = "/projects/" + n.project_id;
      item.append(
        a,
        el(
          "small",
          new Date(n.created_at).toLocaleString() +
            (n.read_at ? " · Read" : " · Unread"),
        ),
      );
      if (!n.read_at)
        item.append(
          button("Mark read", async () => {
            await api("/api/notifications/" + n.id + "/read", {});
            await inbox();
          }),
        );
      box.append(item);
    }
    if (!data.notifications.length)
      box.append(el("li", "No project notifications."));
  }
  async function reports(initial = false) {
    const f = $("reportFilters"),
      qs = new URLSearchParams();
    for (const [key, value] of new FormData(f)) if (value) qs.set(key, value);
    const d = await api("/api/project-reports?" + qs);
    $("exportProjectReport").href="/api/project-reports/export.csv?"+qs;
    $("reportFreshness").textContent =
      "Generated " +
      new Date(d.generatedAt).toLocaleString() +
      ". Up to 100 authorized projects; date filters use project creation date. Build counts cover retained observations, not uptime. Deployment status: " +
      d.deploymentStatus;
    if (initial) {
      for (const [name, key, label] of [
        ["ownerId", "owner_id", "owner_name"],
        ["organizationId", "customer_organization_id", "organization_name"],
      ]) {
        const select = f.elements[name];
        const seen = new Set();
        for (const p of d.projects)
          if (p[key] && !seen.has(p[key])) {
            seen.add(p[key]);
            const option = el("option", p[label] || p[key]);
            option.value = p[key];
            select.append(option);
          }
      }
    }
    const box = $("projectReport"),
      table = el("table"),
      head = el("tr");
    for (const s of [
      "Project",
      "State",
      "Tasks done / total",
      "Assigned to me",
      "Overdue tasks",
      "Milestones done / pending",
      "Open PRs",
      "PRs requesting review",
      "Failed build records",
      "Last sync",
    ])
      head.append(el("th", s));
    const thead = el("thead");
    thead.append(head);
    table.append(thead);
    const body = el("tbody");
    for (const p of d.projects) {
      const row = el("tr"),
        cell = el("td"),
        a = el("a", p.key + " · " + p.name);
      a.href = "/projects/" + p.id;
      cell.append(a);
      row.append(cell);
      for (const v of [
        p.status,
        p.completed_tasks + " / " + p.total_tasks,
        p.assigned_to_me,
        p.overdue_tasks,
        p.completed_milestones + " / " + p.pending_milestones,
        p.open_prs,
        p.prs_awaiting_requested_review,
        p.failed_build_records,
        p.last_sync_at
          ? new Date(p.last_sync_at).toLocaleString()
          : "Never synchronized",
      ])
        row.append(el("td", v));
      body.append(row);
    }
    table.append(body);
    box.replaceChildren(table);
    if (!d.projects.length)
      box.append(el("p", "No authorized projects match these filters."));
  }
  document.addEventListener("vsph:identity-loaded", async (e) => {
    identity = e.detail;
    $("projectOperations").hidden = false;
    try {
      await inbox();
      const prefs = await api("/api/notifications/preferences"),
        f = $("notificationPreferences");
      for (const [name, value] of Object.entries(prefs))
        if (f.elements[name]) f.elements[name].checked = value;
      f.onsubmit = async (event) => {
        event.preventDefault();
        const d = {};
        for (const name of ["assignments", "delivery", "overdue"])
          d[name] = f.elements[name].checked;
        try {
          await api("/api/notifications/preferences", d);
          $("operationsMessage").textContent =
            "Notification preferences saved.";
        } catch (e) {
          $("operationsMessage").textContent = e.message;
        }
      };
      $("refreshNotifications").onclick = () =>
        inbox().catch((e) => {
          $("operationsMessage").textContent = e.message;
        });
      $("retryNotifications").onclick = async () => {
        try {
          await api("/api/notifications/retry", {});
          await inbox();
        } catch (e) {
          $("operationsMessage").textContent = e.message;
        }
      };
      $("reportFilters").onsubmit = (e) => {
        e.preventDefault();
        reports().catch((e) => {
          $("operationsMessage").textContent = e.message;
        });
      };
      await reports(true);
    } catch (error) {
      $("operationsMessage").textContent = error.message;
    }
  });
})();
