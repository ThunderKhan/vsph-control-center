const test = require("node:test"),
  assert = require("node:assert/strict"),
  crypto = require("node:crypto");
const {
  client,
  configuration,
  appJwt,
  ProviderError,
  normalize,
} = require("../services/github/provider");
const { tick } = require("../services/github/sync");
const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
});
const config = {
  appId: "42",
  key: privateKey.export({ type: "pkcs8", format: "pem" }),
};
const response = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers });
const installation = {
  id: 7,
  app_id: 42,
  account: { id: 8, login: "fixture" },
  permissions: {
    contents: "read",
    pull_requests: "read",
    checks: "read",
    actions: "read",
  },
};
test("App defaults off and JWT is short-lived with a valid RSA signature", () => {
  assert.equal(configuration({}), null);
  assert.equal(
    configuration({ GITHUB_APP_ID: "42", GITHUB_APP_PRIVATE_KEY: "key" }),
    null,
  );
  const jwt = appJwt(config, 1000000),
    parts = jwt.split("."),
    claims = JSON.parse(Buffer.from(parts[1], "base64url"));
  assert.equal(claims.exp - claims.iat, 600);
  assert.equal(claims.iss, "42");
  assert.ok(
    crypto.verify(
      "RSA-SHA256",
      Buffer.from(parts[0] + "." + parts[1]),
      publicKey,
      Buffer.from(parts[2], "base64url"),
    ),
  );
});
test("installation account and permission mismatch deny before minting a token", async () => {
  for (const data of [
    { ...installation, account: { id: 99 } },
    { ...installation, app_id: 99 },
    { ...installation, suspended_at: "2026-01-01" },
    { ...installation, permissions: { contents: "read" } },
  ]) {
    let calls = 0;
    const p = client({
      config,
      fetchImpl: async () => {
        calls++;
        return response(data);
      },
    });
    await assert.rejects(
      p.verifyRepository({ installation_id: 7, account_id: 8 }, 9),
      { code: "permission_denied" },
    );
    assert.equal(calls, 1);
  }
});
test("discovery is paginated, account scoped and never returns credentials", async () => {
  const requests = [];
  const p = client({
    config,
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      if (url.endsWith("/access_tokens"))
        return response({ token: "secret-test-token" });
      if (url.includes("/repositories?"))
        return response({
          repositories: [
            {
              id: 9,
              owner: { id: 8 },
              full_name: "fixture/private",
              default_branch: "main",
              private: true,
            },
            {
              id: 10,
              owner: { id: 99 },
              full_name: "foreign/private",
              default_branch: "main",
            },
          ],
        });
      return response(installation);
    },
  });
  const result = await p.discover({ installation_id: 7, account_id: 8 }, 2);
  assert.equal(result.repositories.length, 1);
  assert.ok(requests[2].url.endsWith("page=2"));
  assert.ok(!JSON.stringify(result).includes("secret-test-token"));
  assert.equal(requests[0].options.redirect, "error");
  await assert.rejects(p.discover({ installation_id: 7, account_id: 8 }, 51), {
    code: "invalid_page",
  });
});
test("repository verification scopes tokens and rejects owner mismatch", async () => {
  let body;
  const p = client({
    config,
    fetchImpl: async (url, opts) => {
      if (url.endsWith("/access_tokens")) {
        body = JSON.parse(opts.body);
        return response({ token: "test" });
      }
      if (url.endsWith("/repositories/9"))
        return response({
          id: 9,
          owner: { id: 99 },
          full_name: "foreign/private",
          default_branch: "main",
        });
      return response(installation);
    },
  });
  await assert.rejects(
    p.verifyRepository({ installation_id: 7, account_id: 8 }, 9),
    { code: "permission_denied" },
  );
  assert.deepEqual(body.repository_ids, [9]);
  assert.ok(Object.values(body.permissions).every((x) => x === "read"));
});
test("rate limits persist explicit retry time; unauthorized responses expose no provider body", async () => {
  const p = client({
    config,
    fetchImpl: async () =>
      response({ token: "never-print-this" }, 429, { "retry-after": "3600" }),
  });
  await assert.rejects(
    p.installation(7),
    (e) =>
      e.code === "rate_limited" &&
      e.retryAfter === 3600 &&
      !e.message.includes("never-print"),
  );
  const denied = client({
    config,
    fetchImpl: async () => response({ secret: "hidden" }, 401),
  });
  await assert.rejects(denied.installation(7), { code: "permission_denied" });
});
test("provider page normalizes PRs, advances checkpoints and bounds synchronization", async () => {
  const repo = {
    id: 9,
    owner: { id: 8 },
    full_name: "fixture/private",
    default_branch: "main",
    private: true,
  };
  const p = client({
    config,
    fetchImpl: async (url) =>
      url.endsWith("/access_tokens")
        ? response({ token: "test" })
        : url.endsWith("/repositories/9")
          ? response(repo)
          : url.includes("/pulls?")
            ? response([
                {
                  id: 1,
                  number: 1,
                  title: "Ship",
                  state: "closed",
                  merged_at: "2026-10-01",
                  updated_at: "2026-10-01",
                  html_url: "https://github.com/fixture/private/pull/1",
                  user: { login: "dev" },
                  body: "Do not retain this",
                  requested_reviewers: [],
                },
              ])
            : response(installation),
  });
  const result = await p.page({
    installation_id: 7,
    account_id: 8,
    repository_id: 9,
    checkpoint: { kind: 2, page: 1 },
  });
  assert.equal(result.records[0].state, "merged");
  assert.deepEqual(result.checkpoint, { kind: 3, page: 1 });
  assert.ok(!JSON.stringify(result).includes("Do not retain this"));
  const commit = normalize(
    0,
    {
      sha: "a".repeat(40),
      commit: {
        message: "Subject\nSecret body",
        committer: { date: "2026-10-01", email: "private@example.test" },
      },
    },
    "fixture/private",
    Date.now(),
  );
  assert.ok(!JSON.stringify(commit).includes("private@example"));
  assert.equal(commit.title, "Subject");
});
test("sync failure is sanitized, persisted and uses the claimed fencing token", async () => {
  const calls = [];
  const command = async (...args) => {
    calls.push(args);
    return args[1] === "claim"
      ? { id: "connection", lease_token: "lease" }
      : {};
  };
  const result = await tick({
    command,
    provider: {
      page: async () => {
        throw new ProviderError("rate_limited", 3600);
      },
    },
  });
  assert.equal(result.error, "rate_limited");
  assert.equal(calls[1][1], "failed");
  assert.equal(calls[1][3].leaseToken, "lease");
  assert.equal(calls[1][3].retryAfter, 3600);
});

test("unchanged checks retain source time and transient failures delegate exponential backoff", async () => {
  const a = normalize(
    4,
    {
      id: 1,
      name: "CI",
      status: "completed",
      conclusion: "success",
      completed_at: "2026-10-01T01:02:03Z",
    },
    "fixture/private",
    1000,
  );
  const b = normalize(
    4,
    {
      id: 1,
      name: "CI",
      status: "completed",
      conclusion: "success",
      completed_at: "2026-10-01T01:02:03Z",
    },
    "fixture/private",
    2000,
  );
  assert.equal(a.sourceAt, b.sourceAt);
  assert.equal(a.sourceAt, "2026-10-01T01:02:03.000Z");
  const calls = [];
  await tick({
    command: async (...args) => {
      calls.push(args);
      return args[1] === "claim" ? { id: "c", lease_token: "l" } : {};
    },
    provider: {
      page: async () => {
        throw new ProviderError("provider_unavailable");
      },
    },
  });
  assert.equal(calls[1][3].retryAfter, undefined);
});

test("empty contributor responses advance the durable page without fabricating records", async () => {
  const repo = {
    id: 9,
    owner: { id: 8 },
    full_name: "fixture/private",
    default_branch: "main",
    private: true,
  };
  const provider = client({
    config,
    fetchImpl: async (url) =>
      url.endsWith("/access_tokens")
        ? response({ token: "test" })
        : url.endsWith("/repositories/9")
          ? response(repo)
          : url.includes("/contributors?")
            ? new Response(null, { status: 204 })
            : response(installation),
  });
  const result = await provider.page({
    installation_id: 7,
    account_id: 8,
    repository_id: 9,
    checkpoint: { kind: 1, page: 1 },
  });
  assert.deepEqual(result.records, []);
  assert.deepEqual(result.checkpoint, { kind: 2, page: 1 });
});
