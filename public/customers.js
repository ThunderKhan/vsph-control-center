(() => {
  "use strict";
  const $ = (id) => document.getElementById(id),
    message = $("message"),
    choice = $("customer");
  let current,
    key = crypto.randomUUID(),
    busy = false;
  const node = (tag, text) => {
    const n = document.createElement(tag);
    if (text !== undefined) n.textContent = text;
    return n;
  };
  async function api(path, options = {}) {
    const r = await fetch("/api/admin-management/" + path, {
      ...options,
      headers: { "Content-Type": "application/json", ...options.headers },
    });
    const d = await r.json();
    if (!r.ok) throw Error(d.message || "Request failed.");
    return d;
  }
  function setBusy(value) {
    busy = value;
    $("detail").setAttribute("aria-busy", String(value));
    for (const e of document.querySelectorAll("main button, main input, main select"))
      e.disabled = value;
  }
  async function execute(fn) {
    if (busy) return;
    setBusy(true);
    message.textContent = "";
    try {
      await fn();
    } catch (e) {
      message.textContent = e.message;
    } finally {
      setBusy(false);
    }
  }
  function options(values, selected) {
    const s = node("select");
    for (const [value, label] of values) {
      const o = node("option", label);
      o.value = value;
      s.append(o);
    }
    s.value = selected;
    return s;
  }
  function labeled(text, control) {
    const l = node("label", text);
    control.setAttribute("aria-label", text);
    l.append(control);
    return l;
  }
  function action(label, fn) {
    const b = node("button", label);
    b.type = "button";
    b.onclick = () => execute(fn);
    return b;
  }
  async function mutate(action, data) {
    await api("customers/" + choice.value + "/" + action, {
      method: "POST",
      body: JSON.stringify(data),
    });
    await load();
    message.textContent = "Saved. Access is checked on subsequent requests.";
  }
  async function load() {
    const id = choice.value;
    if (!id) {
      $("detail").hidden = true;
      return;
    }
    current = await api("customers/" + id);
    const impact = await api("customers/" + id + "/impact");
    $("impact").textContent =
      `Current impact: ${impact.impact.activeMembers} active members, ${impact.impact.productSessions} product sessions, ${impact.impact.pendingInvitations} pending invitations.`;
    $("orgStatus").value = current.organization.status;
    const catalog = await api("product-registry");
    const appSelect = $("entitlement").elements.applicationId;
    const selectedProduct = appSelect.value;
    appSelect.replaceChildren(
      ...catalog.map((p) => {
        const o = node("option", p.name + " · " + p.status);
        o.value = p.id;
        return o;
      }),
    );
    if (selectedProduct && catalog.some((p) => p.id === selectedProduct))
      appSelect.value = selectedProduct;
    $("detail").hidden = false;
    $("name").textContent = current.organization.name;
    $("newCustomerProject").href = "/projects?organizationId=" + encodeURIComponent(current.organization.id);
    $("newCustomerProject").hidden = current.organization.status !== "active";
    $("state").textContent = "Organization: " + current.organization.status;
    $("products").replaceChildren();
    $("inviteProducts").replaceChildren();
    for (const p of current.products) {
      $("products").append(
        node(
          "p",
          `${p.name} · product ${p.status} · access ${p.access_status} · ${p.subscription_status || "No subscription"} · ${p.plan_code || "No plan"} · ends ${p.ends_at || "No end date"}`,
        ),
      );
      if (p.access_status === "enabled" && p.status === "active") {
        const s = options(
          [["", "No product role"], ...(p.roles || []).map((r) => [r, r])],
          "",
        );
        s.dataset.app = p.id;
        $("inviteProducts").append(labeled(p.name, s));
      }
    }
    $("members").replaceChildren();
    for (const m of current.members) {
      const box = node("article");
      box.className = "panel";
      box.append(
        node("h3", m.full_name),
        node("p", `${m.email} · ${m.status} · account ${m.account_status}`),
      );
      const role = options(
          ["owner", "admin", "member", "viewer"].map((r) => [r, r]),
          m.role,
        ),
        status = options(
          [
            ["active", "Active"],
            ["suspended", "Suspended"],
          ],
          m.status,
        );
      box.append(
        labeled("Organization role for " + m.email, role),
        labeled("Membership status for " + m.email, status),
      );
      if (m.status !== "invited")
        box.append(
          action("Save membership for " + m.email, async () => {
            if (
              !await VSPHUI.confirm(
                "Confirm membership change. Suspension revokes customer product access and sessions.",
              )
            )
              return;
            await mutate("member", {
              userId: m.user_id,
              version: m.version,
              role: role.value,
              status: status.value,
            });
          }),
        );
      for (const p of current.products) {
        const assigned = current.roles.find(
          (r) => r.user_id === m.user_id && r.application_id === p.id,
        );
        const r = options(
          [["", "No product access"], ...(p.roles || []).map((x) => [x, x])],
          assigned?.role_code || "",
        );
        box.append(labeled(p.name + " role for " + m.email, r));
        if (m.status === "active")
          box.append(
            action("Save " + p.code + " role for " + m.email, async () => {
              if (
                !await VSPHUI.confirm(
                  "Confirm explicit product role change. Existing customer product sessions will be revoked.",
                )
              )
                return;
              await mutate("role", {
                userId: m.user_id,
                version: m.version,
                applicationId: p.id,
                role: r.value,
              });
            }),
          );
      }
      $("members").append(box);
    }
    $("invitations").replaceChildren();
    for (const i of current.invitations) {
      const p = node("article");
      p.className = "panel";
      p.append(
        node(
          "p",
          `${i.email} · ${i.state}${i.expired ? " (expired)" : ""} · delivery ${i.delivery_state} · attempts ${i.attempts} · ${i.failure_code || "No delivery error"}`,
        ),
      );
      for (const a of ["reissue", "revoke"])
        if (!["accepted", "accepting", "requires_attention"].includes(i.state))
          p.append(
            action(
              a === "reissue" ? "Reissue " + i.email : "Cancel " + i.email,
              async () => {
                if (
                  !await VSPHUI.confirm(
                    a === "reissue"
                      ? "Invalidate the old link and queue a new invitation?"
                      : "Cancel this invitation?",
                  )
                )
                  return;
                await api("onboardings/" + i.id + "/" + a, {
                  method: "POST",
                  body: JSON.stringify({ generation: i.generation }),
                });
                await load();
                message.textContent =
                  "Invitation updated; delivery is not assumed.";
              },
            ),
          );
      $("invitations").append(p);
    }
    showTerms();
    $("activity").replaceChildren(
      ...current.activity.map((a) =>
        node("p", a.created_at + " · " + a.action),
      ),
    );
  }
  async function lifecycle(action, data) {
    await api("customers/" + choice.value + "/lifecycle/" + action, {
      method: "POST",
      body: JSON.stringify({
        ...data,
        version: current.organization.version,
        confirmed: true,
      }),
    });
    await load();
    message.textContent =
      "Lifecycle/entitlement saved atomically. Affected product sessions were revoked.";
  }
  $("saveStatus").onclick = async () => {
    if (
      !await VSPHUI.confirm(
        "Apply this organization lifecycle? Suspension/closure revokes product sessions, Music codes and pending invitations. Reactivation does not restore revoked access sessions.",
      )
    )
      return;
    execute(() => lifecycle("status", { status: $("orgStatus").value }));
  };
  function showTerms() {
    const f = $("entitlement"),
      p = current?.products.find(
        (p) => p.id === f.elements.applicationId.value,
      );
    f.elements.planCode.value = p?.plan_code || "standard";
    f.elements.subscriptionStatus.value = p?.subscription_status || "active";
    f.elements.accessStatus.value = p?.access_status || "enabled";
    for (const k of ["startsAt", "endsAt"]) {
      const raw = p?.[k === "startsAt" ? "starts_at" : "ends_at"];
      const date = raw ? new Date(raw) : null;
      f.elements[k].value = date
        ? new Date(date.getTime() - date.getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 16)
        : "";
    }
  }
  $("entitlement").elements.applicationId.onchange = showTerms;
  $("entitlement").onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target,
      data = {
        applicationId: f.elements.applicationId.value,
        planCode: f.elements.planCode.value,
        subscriptionStatus: f.elements.subscriptionStatus.value,
        accessStatus: f.elements.accessStatus.value,
        startsAt: f.elements.startsAt.value
          ? new Date(f.elements.startsAt.value).toISOString()
          : null,
        endsAt: f.elements.endsAt.value
          ? new Date(f.elements.endsAt.value).toISOString()
          : null,
      };
    if (
      !await VSPHUI.confirm(
        "Save grant and terms together? Existing product sessions will be revoked. Payment is not processed.",
      )
    )
      return;
    execute(() => lifecycle("entitlement", data));
  };
  choice.onchange = () =>
    execute(async () => {
      key = crypto.randomUUID();
      await load();
    });
  $("refresh").onclick = () => execute(load);
  $("invite").oninput = () => {
    key = crypto.randomUUID();
  };
  $("invite").onsubmit = (e) => {
    e.preventDefault();
    const data = new FormData(e.target),
      products = [...$("inviteProducts").querySelectorAll("select")]
        .filter((s) => s.value)
        .map((s) => ({ applicationId: s.dataset.app, role: s.value }));
    const payload = {
      name: data.get("name"),
      email: data.get("email"),
      memberRole: data.get("memberRole"),
      products,
    };
    execute(async () => {
      await api("customers/" + choice.value + "/invitations", {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(payload),
      });
      e.target.reset();
      key = crypto.randomUUID();
      await load();
      message.textContent =
        "Invitation queued. No email delivery has been confirmed.";
    });
  };
  let customerCursor;
  async function directory(afterId, requested) {
    const rows = await api(
      "customers" + (afterId ? "?afterId=" + encodeURIComponent(afterId) : ""),
    );
    customerCursor = rows.at(-1)?.id;
    $("nextCustomers").hidden = rows.length < 100;
    choice.replaceChildren();
    const blank = node("option", "Select an organization");
    blank.value = "";
    choice.append(blank);
    if (requested && !rows.some((o) => o.id === requested)) {
      const d = await api("customers/" + requested);
      rows.push(d.organization);
    }
    for (const c of rows) {
      const o = node("option", c.name + " · " + c.status);
      o.value = c.id;
      choice.append(o);
    }
    if (requested) {
      choice.value = requested;
      await load();
    } else {
      $("detail").hidden = true;
    }
    if (!rows.length)
      message.textContent =
        "No organizations. Create one through customer onboarding.";
  }
  $("firstCustomers").onclick = () => execute(() => directory());
  $("nextCustomers").onclick = () => execute(() => directory(customerCursor));
  execute(() =>
    directory(null, new URLSearchParams(location.search).get("organization")),
  );
})();
