(() => {
  "use strict";
  const $ = (id) => document.getElementById(id),
    el = (tag, text) => {
      const e = document.createElement(tag);
      e.textContent = text;
      return e;
    };
  async function api(path = "", body) {
    const r = await fetch("/api/account/sessions" + path, {
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
    const data = await r.json();
    if (!r.ok) throw Error(data.message || "Session request failed.");
    return data;
  }
  async function load() {
    const data = await api(),
      list = $("sessionList");
    list.replaceChildren();
    for (const s of data.sessions) {
      const row = el(
        "li",
        (s.current_session ? "Current session" : "Other session") +
          " · Created " +
          new Date(s.created_at).toLocaleString() +
          " · Expires " +
          new Date(s.expires_at).toLocaleString(),
      );
      if (!s.current_session) {
        const b = el("button", "Revoke this session");
        b.type = "button";
        b.onclick = () => act("/" + s.id + "/revoke");
        row.append(b);
      }
      list.append(row);
    }
  }
  async function act(path) {
    try {
      await api(path, {});
      await load();
      $("sessionMessage").textContent =
        "Other session access revoked. The current session remains active.";
    } catch (e) {
      $("sessionMessage").textContent = e.message;
    }
  }
  async function initializeSessions() {
    if (!$("accountSessions")) return;
    $("accountSessions").hidden = false;
    $("revokeOtherSessions").onclick = async () => {
      const approved=await VSPHUI.confirm("Sign out your other portal and product sessions?",{
        title:"End other sessions?",confirmLabel:"Sign out others",danger:true
      });
      if(approved) await act("/revoke-others");
    };
    try {
      await load();
    } catch (e) {
      $("sessionMessage").textContent = e.message;
    }
  }
  document.addEventListener("vsph:identity-loaded",initializeSessions);
  if (location.pathname==="/account/security") {
    if (document.readyState==="loading") document.addEventListener("DOMContentLoaded",initializeSessions,{once:true});
    else void initializeSessions();
  }
})();
