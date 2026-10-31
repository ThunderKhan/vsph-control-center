// GitHub App only. Credentials never leave this server-side module.
const crypto = require("node:crypto");
class ProviderError extends Error {
  constructor(code, retryAfter) {
    super("GitHub connection unavailable.");
    this.code = code;
    this.retryAfter = retryAfter;
  }
}
const positive = (n) => Number.isSafeInteger(Number(n)) && Number(n) > 0;
function configuration(env = process.env) {
  if (
    env.GITHUB_INTEGRATION_ENABLED !== "true" ||
    !positive(env.GITHUB_APP_ID) ||
    !env.GITHUB_APP_PRIVATE_KEY
  )
    return null;
  return {
    appId: String(env.GITHUB_APP_ID),
    key: env.GITHUB_APP_PRIVATE_KEY.replace(/\\n/g, "\n"),
  };
}
function appJwt(config, now = Date.now()) {
  const enc = (x) => Buffer.from(JSON.stringify(x)).toString("base64url");
  const data =
    enc({ alg: "RS256", typ: "JWT" }) +
    "." +
    enc({
      iat: Math.floor(now / 1000) - 60,
      exp: Math.floor(now / 1000) + 540,
      iss: config.appId,
    });
  return (
    data +
    "." +
    crypto
      .sign("RSA-SHA256", Buffer.from(data), config.key)
      .toString("base64url")
  );
}
function client({
  config = configuration(),
  fetchImpl = global.fetch,
  now = () => Date.now(),
} = {}) {
  async function request(path, token, method = "GET", body) {
    if (!config) throw new ProviderError("not_configured", 3600);
    if (
      typeof path !== "string" ||
      !path.startsWith("/") ||
      path.startsWith("//") ||
      path.includes("://")
    )
      throw new ProviderError("invalid_provider_path");
    let response;
    try {
      response = await fetchImpl("https://api.github.com" + path, {
        method,
        redirect: "error",
        signal: AbortSignal.timeout(15000),
        headers: {
          Authorization: "Bearer " + token,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "VSPH-Control-Center",
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    } catch {
      throw new ProviderError("provider_unavailable");
    }
    if (!response.ok) {
      const reset = Math.ceil(
        Number(response.headers.get("x-ratelimit-reset")) - now() / 1000,
      );
      const retry = Number(response.headers.get("retry-after"));
      if (
        response.status === 429 ||
        (response.status === 403 &&
          (response.headers.get("x-ratelimit-remaining") === "0" || retry > 0))
      )
        throw new ProviderError(
          "rate_limited",
          Math.max(60, Math.min(86400, retry || reset || 300)),
        );
      if (response.status === 401 || response.status === 403)
        throw new ProviderError("permission_denied", 3600);
      if (response.status === 404)
        throw new ProviderError("repository_unavailable", 3600);
      throw new ProviderError("provider_unavailable");
    }
    if (response.status === 204) return null;
    // Bound actual streamed bytes, including a response without Content-Length.
    let bytes = 0;
    const chunks = [];
    for await (const chunk of response.body) {
      bytes += chunk.length;
      if (bytes > 4 * 1024 * 1024) {
        await response.body.cancel?.().catch(() => {});
        throw new ProviderError("provider_response_too_large");
      }
      chunks.push(Buffer.from(chunk));
    }
    try {
      return JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      throw new ProviderError("invalid_provider_response");
    }
  }
  async function installation(id, accountId) {
    if (!config) throw new ProviderError("not_configured", 3600);
    if (!positive(id)) throw new ProviderError("invalid_installation");
    const data = await request(
      "/app/installations/" + Number(id),
      appJwt(config),
    );
    if (
      String(data.id) !== String(id) ||
      String(data.app_id) !== config.appId ||
      data.suspended_at ||
      !positive(data.account?.id) ||
      (accountId && String(data.account.id) !== String(accountId))
    )
      throw new ProviderError("permission_denied");
    for (const p of ["contents", "pull_requests", "actions", "checks"])
      if (!["read", "write"].includes(data.permissions?.[p]))
        throw new ProviderError("permission_denied");
    return {
      id: Number(data.id),
      accountId: Number(data.account.id),
      accountLogin: data.account.login,
    };
  }
  async function token(id, accountId, repositoryId) {
    await installation(id, accountId);
    const data = await request(
      "/app/installations/" + Number(id) + "/access_tokens",
      appJwt(config),
      "POST",
      {
        permissions: {
          contents: "read",
          pull_requests: "read",
          actions: "read",
          checks: "read",
          metadata: "read",
        },
        ...(repositoryId ? { repository_ids: [Number(repositoryId)] } : {}),
      },
    );
    if (!data.token) throw new ProviderError("invalid_provider_response");
    return data.token;
  }
  async function discover(grant, page = 1) {
    if (!Number.isInteger(page) || page < 1 || page > 50)
      throw new ProviderError("invalid_page");
    const access = await token(grant.installation_id, grant.account_id);
    const data = await request(
      "/installation/repositories?per_page=50&page=" + page,
      access,
    );
    if (!Array.isArray(data.repositories))
      throw new ProviderError("invalid_provider_response");
    return {
      repositories: data.repositories
        .filter((r) => String(r.owner?.id) === String(grant.account_id))
        .map(repository),
      page,
      nextPage: data.repositories.length === 50 && page < 50 ? page + 1 : null,
      truncated: page === 50 && data.repositories.length === 50,
    };
  }
  function repository(r) {
    if (
      !positive(r.id) ||
      !/^[-\w.]+\/[-\w.]+$/.test(r.full_name) ||
      typeof r.default_branch !== "string"
    )
      throw new ProviderError("invalid_provider_response");
    return {
      repositoryId: Number(r.id),
      fullName: r.full_name,
      defaultBranch: r.default_branch,
      private: Boolean(r.private),
      accountId: Number(r.owner.id),
    };
  }
  async function verifyRepository(grant, repositoryId) {
    if (!positive(repositoryId)) throw new ProviderError("invalid_repository");
    const access = await token(
      grant.installation_id,
      grant.account_id,
      repositoryId,
    );
    const r = await request("/repositories/" + Number(repositoryId), access);
    if (
      String(r.owner?.id) !== String(grant.account_id) ||
      String(r.id) !== String(repositoryId)
    )
      throw new ProviderError("permission_denied");
    return repository(r);
  }
  async function page(connection) {
    const access = await token(
      connection.installation_id,
      connection.account_id,
      connection.repository_id,
    );
    const meta = await request(
      "/repositories/" + Number(connection.repository_id),
      access,
    );
    if (String(meta.owner?.id) !== String(connection.account_id))
      throw new ProviderError("permission_denied");
    const repo = repository(meta),
      base =
        "/repos/" + repo.fullName.split("/").map(encodeURIComponent).join("/");
    const kind = Number(connection.checkpoint.kind),
      page = Number(connection.checkpoint.page);
    if (
      !Number.isInteger(kind) ||
      kind < 0 ||
      kind > 6 ||
      !Number.isInteger(page) ||
      page < 1 ||
      page > 10
    )
      throw new ProviderError("invalid_checkpoint");
    const paths = [
      base + "/commits",
      base + "/contributors",
      base + "/pulls?state=all&sort=updated&direction=desc",
      base + "/actions/runs",
      base +
        "/commits/" +
        encodeURIComponent(repo.defaultBranch) +
        "/check-runs",
      base + "/releases",
      base + "/tags",
    ];
    const path =
      paths[kind] +
      (paths[kind].includes("?") ? "&" : "?") +
      "per_page=100&page=" +
      page;
    const data = await request(path, access),
      list =
        data === null
          ? []
          : Array.isArray(data)
            ? data
            : data.workflow_runs || data.check_runs;
    if (!Array.isArray(list) || list.length > 100)
      throw new ProviderError("invalid_provider_response");
    const records = list.map((x) => normalize(kind, x, repo.fullName, now()));
    const more = list.length === 100 && page < 10;
    const nextKind = more ? kind : kind + 1;
    return {
      ...repo,
      records,
      checkpoint: {
        kind: nextKind > 6 ? 0 : nextKind,
        page: more ? page + 1 : 1,
      },
      cycleComplete: nextKind > 6,
      truncated: list.length === 100 && page === 10,
    };
  }
  return { installation, discover, verifyRepository, page };
}
function normalize(kind, x, fullName, now) {
  const kinds = [
    "commit",
    "contributor",
    "pull",
    "workflow",
    "check",
    "release",
    "tag",
  ];
  const gh = "https://github.com/" + fullName;
  const fallback = "1970-01-01T00:00:00.000Z";
  const title =
    kind === 0
      ? x.commit?.message?.split("\n")[0]
      : kind === 1
        ? x.login
        : kind === 2
          ? x.title
          : kind === 3
            ? x.display_title || x.name
            : x.name;
  let url = x.html_url;
  if (kind === 1) url = "https://github.com/" + encodeURIComponent(x.login);
  if (kind === 6) url = gh + "/tree/" + encodeURIComponent(x.name);
  const safeUrl =
    typeof url === "string" && url.startsWith("https://github.com/") ? url : gh;
  const date =
    x.completed_at ||
    x.started_at ||
    x.updated_at ||
    x.published_at ||
    x.created_at ||
    x.commit?.committer?.date;
  const sourceAt =
    date && !Number.isNaN(Date.parse(date))
      ? new Date(date).toISOString()
      : kind === 1 || kind === 6
        ? "1970-01-01T00:00:00.000Z"
        : fallback;
  const state =
    kind === 2
      ? x.merged_at
        ? "merged"
        : x.state
      : [3, 4].includes(kind)
        ? x.conclusion || x.status
        : kind === 5
          ? x.draft
            ? "draft"
            : x.prerelease
              ? "prerelease"
              : "published"
          : "observed";
  return {
    kind: kinds[kind],
    sourceId: String(kind === 0 ? x.sha : kind === 6 ? x.name : x.id).slice(
      0,
      200,
    ),
    title: String(title || kinds[kind]).slice(0, 500),
    url: safeUrl,
    state: String(state || "unknown").slice(0, 100),
    sourceAt,
    details:
      kind === 0
        ? { sha: x.sha, author: x.author?.login || null }
        : kind === 1
          ? { login: x.login, contributions: x.contributions }
          : kind === 2
            ? {
                number: x.number,
                draft: Boolean(x.draft),
                author: x.user?.login || null,
                reviewRequested: (x.requested_reviewers || []).length,
                headSha: x.head?.sha || null,
              }
            : kind === 5
              ? { tag: x.tag_name, target: x.target_commitish }
              : kind === 6
                ? { sha: x.commit?.sha }
                : {
                    sha: x.head_sha,
                    branch: x.head_branch || null,
                    runNumber: x.run_number || null,
                  },
  };
}
module.exports = { client, configuration, appJwt, ProviderError, normalize };
