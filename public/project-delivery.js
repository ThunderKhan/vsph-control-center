(() => {
  "use strict";
  const $ = (id) => document.getElementById(id),
    el = (tag, text) => {
      const n = document.createElement(tag);
      if (text !== undefined) n.textContent = String(text);
      return n;
    };
  let project,
    identity,
    engineering,
    page = 1;
  const base = () => "/api/projects/" + project.project.id + "/delivery";
  async function api(path, body) {
    const response = await fetch(path, {
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
    const data = await response.json();
    if (!response.ok) throw Error(data.message || "Delivery request failed.");
    return data;
  }
  const message = (text) => {
    $("engineeringMessage").textContent = text;
  };
  const action = (label, fn) => {
    const b = el("button", label);
    b.type = "button";
    b.onclick = async () => {
      b.disabled = true;
      try {
        await fn();
      } catch (e) {
        message(e.message);
      } finally {
        b.disabled = false;
      }
    };
    return b;
  };
  const link = (text, url) => {
    const a = el("a", text);
    if (typeof url === "string" && url.startsWith("https://github.com/")) {
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
    }
    return a;
  };
  const date = (value) =>
    !value || new Date(value).getTime() === 0
      ? "Source time unavailable"
      : new Date(value).toLocaleString();
  const field = (form, label, name, type = "text") => {
    const l = el("label", label),
      input = el(type === "select" ? "select" : "input");
    input.name = name;
    if (type !== "select") input.type = type;
    input.setAttribute("aria-label", label);
    l.append(input);
    form.append(l);
    return input;
  };
  const option = (select, label, value) => {
    const o = el("option", label);
    o.value = value;
    select.append(o);
  };
  async function load() {
    $("engineeringContent").replaceChildren();
    engineering = await api(base());
    render();
  }
  async function mutate(path, body) {
    const result = await api(base() + path, body);
    await load();
    message(
      result.processed === false
        ? "No page is due. Check retry time and connection state."
        : result.error
          ? "Synchronization paused: " + result.error
          : "Saved. Provider observations persist across reloads.",
    );
  }
  function render() {
    const box = $("engineeringContent"),
      manager =
        project.role === "manager" &&
        !["completed", "archived"].includes(project.project.status);
    box.replaceChildren();
    box.append(
      el(
        "p",
        engineering.providerMode === "isolated-fixture"
          ? "Isolated provider fixture. No live GitHub verification."
          : engineering.configured
            ? "GitHub App configured. Live provider acceptance must be verified in staging."
            : "GitHub connector disabled. An operator must configure the server-owned App and approve its installation.",
      ),
    );
    box.append(el("p", "Vercel: disabled — " + engineering.vercel.reason));
    if (identity.platformRole === "super_admin" && manager) {
      const f = el("form");
      f.className = "delivery-controls";
      const id = field(f, "GitHub installation ID", "installation", "number");
      id.min = "1";
      id.required = true;
      const save = el("button", "Verify and approve installation");
      save.type = "submit";
      save.disabled = !engineering.configured;
      f.append(save);
      f.onsubmit = async (e) => {
        e.preventDefault();
        save.disabled = true;
        try {
          await mutate("/installations", { installationId: Number(id.value) });
        } catch (error) {
          message(error.message);
        } finally {
          save.disabled = !engineering.configured;
        }
      };
      box.append(f);
    }
    if (manager && engineering.configured) {
      const active = engineering.installations.filter(
        (g) => g.status === "active",
      );
      if (active.length) {
        const f = el("form");
        f.className = "delivery-controls";
        const select = field(
          f,
          "Approved installation",
          "installation",
          "select",
        );
        for (const g of active)
          option(
            select,
            g.account_login + " · " + g.installation_id,
            g.installation_id,
          );
        const discover = el("button", "Discover repositories");
        discover.type = "submit";
        f.append(discover);
        f.onsubmit = async (e) => {
          e.preventDefault();
          page = 1;
          await discoverRepositories(select.value).catch((e) =>
            message(e.message),
          );
        };
        box.append(f);
        if (identity.platformRole === "super_admin")
          box.append(
            action("Revoke selected installation", async () => {
              if (
                confirm(
                  "Revoke this installation for this project and hide its repository data?",
                )
              )
                await mutate("/installations/revoke", {
                  installationId: Number(select.value),
                });
            }),
          );
      } else
        box.append(
          el(
            "p",
            "No installation is approved for this project. Request approval from a platform administrator.",
          ),
        );
    }
    const discovery = el("div");
    discovery.id = "repositoryDiscovery";
    box.append(discovery);
    const connections = el("div");
    connections.className = "delivery-connections";
    for (const c of engineering.connections) {
      const card = el("article");
      card.append(
        el("h3", c.full_name),
        el(
          "p",
          c.status +
            " · " +
            c.default_branch +
            " · " +
            (c.private ? "Private" : "Public"),
        ),
        el("p", "Last successful page: " + date(c.last_success_at)),
        el("p", "Next eligible poll: " + date(c.next_sync_at)),
        el(
          "p",
          "Checkpoint category " +
            c.checkpoint.kind +
            ", page " +
            c.checkpoint.page +
            (c.last_error ? " · " + c.last_error : ""),
        ),
      );
      if (manager) {
        if (c.status !== "disconnected") {
          const sync = action("Synchronize next page", () =>
            mutate("/connections/" + c.id + "/sync", { version: c.version }),
          );
          sync.disabled = !engineering.configured;
          card.append(sync);
          card.append(
            action("Disconnect " + c.full_name, async () => {
              if (
                confirm(
                  "Disconnect repository and hide retained delivery observations?",
                )
              )
                await mutate("/connections/" + c.id + "/disconnect", {
                  version: c.version,
                });
            }),
          );
        } else
          card.append(
            el("p", "Rediscover and connect to verify access again."),
          );
      }
      connections.append(card);
    }
    box.append(connections);
    if (!engineering.connections.length)
      box.append(
        el(
          "p",
          "No repository connections. No development activity is fabricated.",
        ),
      );
    const filter = el("select");
    filter.setAttribute("aria-label", "Delivery record type");
    option(filter, "All engineering records", "");
    for (const kind of [
      "commit",
      "contributor",
      "pull",
      "workflow",
      "check",
      "release",
      "tag",
    ])
      option(filter, kind, kind);
    box.append(filter);
    const records = el("div");
    records.id = "engineeringRecords";
    records.className = "project-table-wrap";
    box.append(records);
    const draw = () => {
      records.replaceChildren();
      const table = el("table"),
        thead = el("thead"),
        head = el("tr");
      for (const title of [
        "Source",
        "Type",
        "State",
        "Source time",
        "Observed",
        "Linked work",
      ])
        head.append(el("th", title));
      thead.append(head);
      table.append(thead);
      const tbody = el("tbody");
      for (const r of engineering.records.filter(
        (r) => !filter.value || r.kind === filter.value,
      )) {
        const tr = el("tr"),
          source = el("td");
        source.append(link(r.title, r.url));
        tr.append(
          source,
          el("td", r.kind),
          el("td", r.state),
          el("td", date(r.source_at)),
          el("td", date(r.observed_at)),
        );
        const cell = el("td"),
          l = engineering.links.find((l) => l.record_id === r.id);
        cell.append(
          el(
            "span",
            l
              ? project.tasks.find((t) => t.id === l.task_id)?.title ||
                  project.milestones.find((m) => m.id === l.milestone_id)
                    ?.title ||
                  "Linked work"
              : "Unlinked",
          ),
        );
        if (manager && ["pull", "release"].includes(r.kind)) {
          const f = el("form"),
            s = el("select");
          s.setAttribute("aria-label", "Link work for " + r.title);
          option(s, "Choose task or milestone", "");
          for (const t of project.tasks)
            option(s, "Task: " + t.title, "task:" + t.id);
          for (const m of project.milestones)
            option(s, "Milestone: " + m.title, "milestone:" + m.id);
          const b = el("button", "Link");
          b.type = "submit";
          f.append(s, b);
          f.onsubmit = async (e) => {
            e.preventDefault();
            if (!s.value) return;
            const [kind, id] = s.value.split(":");
            await mutate("/links", {
              recordId: r.id,
              ...(kind === "task" ? { taskId: id } : { milestoneId: id }),
            }).catch((e) => message(e.message));
          };
          cell.append(f);
        }
        tr.append(cell);
        tbody.append(tr);
      }
      table.append(tbody);
      records.append(table);
      if (!tbody.children.length)
        records.append(el("p", "No ingested records match this view."));
    };
    filter.onchange = draw;
    draw();
    box.append(
      el("h3", "Engineering timeline"),
      el(
        "p",
        "Latest 200 observed changes. Provider source state and observation time are distinct; this is a bounded recent activity view.",
      ),
    );
    const timeline = el("ol");
    timeline.id = "engineeringTimeline";
    for (const event of engineering.events) {
      const li = el(
        "li",
        date(event.observed_at) +
          " · " +
          event.snapshot.kind +
          " · " +
          event.snapshot.state +
          " · ",
      );
      li.append(link(event.snapshot.title, event.snapshot.url));
      timeline.append(li);
    }
    box.append(timeline);
  }
  async function discoverRepositories(installationId) {
    const data = await api(
      base() + "/repositories?" + new URLSearchParams({ installationId, page }),
    );
    const box = $("repositoryDiscovery");
    box.replaceChildren(
      el("p", "Repositories authorized by the approved App installation:"),
    );
    for (const r of data.repositories)
      box.append(
        action("Connect " + r.fullName, () =>
          mutate("/connections", {
            installationId: Number(installationId),
            repositoryId: r.repositoryId,
          }),
        ),
      );
    if (data.nextPage)
      box.append(
        action("Next repository page", async () => {
          page = data.nextPage;
          await discoverRepositories(installationId);
        }),
      );
    if (!data.repositories.length)
      box.append(el("p", "No authorized repositories on this page."));
    if (data.truncated)
      box.append(
        el(
          "p",
          "Discovery budget reached. Narrow the App installation repository selection.",
        ),
      );
  }
  document.addEventListener("vsph:project-loaded", async (e) => {
    project = e.detail.project;
    identity = e.detail.user;
    const section = $("engineering");
    section.hidden = project.role === "client";
    if (section.hidden) return;
    message("");
    try {
      await load();
    } catch (error) {
      message(error.message);
    }
  });
})();
