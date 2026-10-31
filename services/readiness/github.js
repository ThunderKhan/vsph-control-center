const crypto = require("node:crypto");
const { isDeepStrictEqual } = require("node:util");
const jsonDetails = (value) => JSON.parse(JSON.stringify(value || {}));
const { uuid } = require("../rpc");
const categories = [
  "commit",
  "contributor",
  "pull",
  "workflow",
  "check",
  "release",
  "tag",
];
function approvedTarget(env) {
  const number = (value) =>
    Number.isSafeInteger(Number(value)) && Number(value) > 0;
  if (
    env.GITHUB_ACCEPTANCE_APPROVED !== "true" ||
    !number(env.GITHUB_ACCEPTANCE_INSTALLATION_ID) ||
    !number(env.GITHUB_ACCEPTANCE_ACCOUNT_ID) ||
    !number(env.GITHUB_ACCEPTANCE_REPOSITORY_ID) ||
    !/^[-\w.]+\/[-\w.]+$/.test(env.GITHUB_ACCEPTANCE_EXPECTED_REPOSITORY || "")
  )
    throw Error("Approved GitHub acceptance target required.");
  const target = {
    installation_id: Number(env.GITHUB_ACCEPTANCE_INSTALLATION_ID),
    account_id: Number(env.GITHUB_ACCEPTANCE_ACCOUNT_ID),
    repository_id: Number(env.GITHUB_ACCEPTANCE_REPOSITORY_ID),
    expected: env.GITHUB_ACCEPTANCE_EXPECTED_REPOSITORY,
  };
  if (
    Boolean(env.STAGING_APPLICATION_ORIGIN) !==
    Boolean(env.STAGING_PORTAL_SESSION)
  )
    throw Error("Staging origin and session must be supplied together.");
  if (env.STAGING_APPLICATION_ORIGIN) {
    const u = new URL(env.STAGING_APPLICATION_ORIGIN);
    if (
      (u.protocol !== "https:" &&
        !(
          u.protocol === "http:" &&
          ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname)
        )) ||
      u.username ||
      u.password ||
      u.pathname !== "/" ||
      u.search ||
      u.hash ||
      !uuid(env.GITHUB_ACCEPTANCE_PROJECT_ID) ||
      !uuid(env.GITHUB_ACCEPTANCE_DENIED_PROJECT_ID) ||
      env.GITHUB_ACCEPTANCE_PROJECT_ID ===
        env.GITHUB_ACCEPTANCE_DENIED_PROJECT_ID ||
      !/^[A-Za-z0-9_-]{32,128}$/.test(env.STAGING_PORTAL_SESSION)
    )
      throw Error("Invalid approved staging acceptance context.");
    target.origin = u.origin;
    target.projectId = env.GITHUB_ACCEPTANCE_PROJECT_ID;
    target.deniedProjectId = env.GITHUB_ACCEPTANCE_DENIED_PROJECT_ID;
    target.session = env.STAGING_PORTAL_SESSION;
  }
  return target;
}
async function verifyGithub({ provider, target, readApplication }) {
  const meta = await provider.verifyRepository(target, target.repository_id);
  if (
    meta.fullName.toLowerCase() !== target.expected.toLowerCase() ||
    meta.repositoryId !== target.repository_id ||
    meta.accountId !== target.account_id
  )
    throw Error("Canonical GitHub acceptance target mismatch.");
  const records = [],
    summaries = [];
  for (let kind = 0; kind < categories.length; kind++) {
    const result = await provider.page({
      ...target,
      checkpoint: { kind, page: 1 },
    });
    if (result.fullName.toLowerCase() !== target.expected.toLowerCase())
      throw Error("Repository changed during acceptance.");
    records.push(...result.records);
    const states = {};
    for (const r of result.records)
      states[r.state] = (states[r.state] || 0) + 1;
    summaries.push({
      kind: categories[kind],
      records: result.records.length,
      states,
      observationsDigest: crypto
        .createHash("sha256")
        .update(JSON.stringify(result.records))
        .digest("hex"),
    });
  }
  const report = {
    providerReadsVerified: true,
    persistedReadComparisonVerified: false,
    authorizationDenialVerified: false,
    fullApplicationAcceptanceVerified: false,
    targetFingerprint: crypto
      .createHash("sha256")
      .update(
        target.installation_id +
          ":" +
          target.account_id +
          ":" +
          target.repository_id,
      )
      .digest("hex"),
    categories: summaries,
    limits: [
      "One page per category; this is a bounded live observation, not a complete archive.",
      "This command does not create connections, synchronize data, send email or deploy.",
    ],
  };
  if (readApplication) {
    const visible = await readApplication(target.projectId),
      denied = await readApplication(target.deniedProjectId);
    if (visible.status !== 200 || ![403, 404].includes(denied.status))
      throw Error("Staging authorization acceptance failed.");
    const connection = visible.data?.connections?.find(
      (c) =>
        Number(c.repository_id) === target.repository_id &&
        Number(c.installation_id) === target.installation_id &&
        c.status === "active",
    );
    if (!connection) throw Error("Active staged connection required.");
    const live = new Map(records.map((r) => [r.kind + ":" + r.sourceId, r]));
    let matched = 0,
      mismatch = 0;
    for (const stored of visible.data.records || []) {
      if (stored.connection_id !== connection.id) continue;
      const original = live.get(stored.kind + ":" + stored.source_id);
      if (!original) continue;
      if (
        original.state !== stored.state ||
        original.title !== stored.title ||
        original.url !== stored.url ||
        !isDeepStrictEqual(
          jsonDetails(original.details),
          jsonDetails(stored.details),
        ) ||
        new Date(original.sourceAt).getTime() !==
          new Date(stored.source_at).getTime()
      )
        mismatch++;
      else matched++;
    }
    if (!matched || mismatch)
      throw Error(
        "Persisted provider observations are absent or stale; synchronize and reconcile.",
      );
    report.persistedReadComparisonVerified = true;
    report.authorizationDenialVerified = true;
    report.matchedRecords = matched;
  }
  return report;
}
function applicationReader(target, fetchImpl = fetch) {
  return async (projectId) => {
    const response = await fetchImpl(
      target.origin + "/api/projects/" + projectId + "/delivery",
      {
        redirect: "error",
        signal: AbortSignal.timeout(15000),
        headers: {
          Cookie: "vsph.portal.sid=" + target.session,
          Accept: "application/json",
        },
      },
    );
    let bytes = 0;
    const parts = [];
    for await (const chunk of response.body) {
      bytes += chunk.length;
      if (bytes > 4 * 1024 * 1024)
        throw Error("Application response exceeds acceptance budget.");
      parts.push(Buffer.from(chunk));
    }
    let data;
    try {
      data = JSON.parse(Buffer.concat(parts).toString());
    } catch {
      throw Error("Invalid staging application response.");
    }
    return { status: response.status, data };
  };
}
module.exports = { approvedTarget, verifyGithub, applicationReader };
