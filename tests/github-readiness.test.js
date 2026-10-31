const test = require("node:test"),
  assert = require("node:assert/strict");
const {
  approvedTarget,
  verifyGithub,
  applicationReader,
} = require("../services/readiness/github");
const env = {
  GITHUB_ACCEPTANCE_APPROVED: "true",
  GITHUB_ACCEPTANCE_INSTALLATION_ID: "7",
  GITHUB_ACCEPTANCE_ACCOUNT_ID: "8",
  GITHUB_ACCEPTANCE_REPOSITORY_ID: "9",
  GITHUB_ACCEPTANCE_EXPECTED_REPOSITORY: "fixture/private",
};
const records = [
  {
    kind: "pull",
    sourceId: "1",
    title: "Private title",
    state: "open",
    url: "https://github.com/fixture/private/pull/1",
    sourceAt: "2026-10-01T00:00:00Z",
  },
];
const provider = {
  verifyRepository: async () => ({
    repositoryId: 9,
    accountId: 8,
    fullName: "fixture/private",
  }),
  page: async (c) => ({
    fullName: "fixture/private",
    records: c.checkpoint.kind === 2 ? records : [],
  }),
};
test("live acceptance requires explicit target and safe paired staging context", () => {
  assert.throws(() => approvedTarget({}));
  assert.throws(() =>
    approvedTarget({
      ...env,
      STAGING_APPLICATION_ORIGIN: "https://stage.example.test",
    }),
  );
  assert.throws(() =>
    approvedTarget({
      ...env,
      STAGING_APPLICATION_ORIGIN: "http://remote.example.test",
      STAGING_PORTAL_SESSION: "a".repeat(43),
      GITHUB_ACCEPTANCE_PROJECT_ID: "11111111-1111-4111-8111-111111111111",
      GITHUB_ACCEPTANCE_DENIED_PROJECT_ID:
        "22222222-2222-4222-8222-222222222222",
    }),
  );
  assert.equal(approvedTarget(env).repository_id, 9);
});
test("provider-only proof is bounded and does not print private source titles or claim application acceptance", async () => {
  const r = await verifyGithub({ provider, target: approvedTarget(env) });
  assert.equal(r.categories.length, 7);
  assert.equal(r.providerReadsVerified, true);
  assert.equal(r.persistedReadComparisonVerified, false);
  assert.equal(r.fullApplicationAcceptanceVerified, false);
  assert.doesNotMatch(JSON.stringify(r), /Private title|fixture\/private/);
});
test("staged comparison checks original records and a denied project without mutating either", async () => {
  const target = {
    ...approvedTarget(env),
    projectId: "allowed",
    deniedProjectId: "denied",
  };
  const readApplication = async (id) =>
    id === "denied"
      ? { status: 403, data: { message: "Denied" } }
      : {
          status: 200,
          data: {
            connections: [
              {
                id: "connection",
                repository_id: 9,
                installation_id: 7,
                status: "active",
              },
            ],
            records: [
              {
                connection_id: "connection",
                kind: "pull",
                source_id: "1",
                title: records[0].title,
                state: "open",
                url: records[0].url,
                source_at: records[0].sourceAt,
              },
            ],
          },
        };
  const r = await verifyGithub({ provider, target, readApplication });
  assert.equal(r.matchedRecords, 1);
  assert.equal(r.authorizationDenialVerified, true);
  assert.equal(r.fullApplicationAcceptanceVerified, false);
  await assert.rejects(
    verifyGithub({
      provider,
      target,
      readApplication: async () => ({ status: 200, data: {} }),
    }),
  );
});
test("mismatched repository identity and stale stored state fail rather than report success", async () => {
  await assert.rejects(
    verifyGithub({
      target: approvedTarget(env),
      provider: {
        ...provider,
        verifyRepository: async () => ({
          repositoryId: 99,
          accountId: 8,
          fullName: "wrong/repo",
        }),
      },
    }),
  );
});
test("staging reader pins origin, rejects redirects and keeps cookie out of results", async () => {
  const target = {
    origin: "https://stage.example.test",
    session: "test-secret",
  };
  let options;
  const read = applicationReader(target, async (url, opt) => {
    assert.equal(url, "https://stage.example.test/api/projects/id/delivery");
    options = opt;
    return new Response('{"records":[]}', { status: 200 });
  });
  const result = await read("id");
  assert.equal(options.redirect, "error");
  assert.equal(options.headers.Cookie, "vsph.portal.sid=test-secret");
  assert.doesNotMatch(JSON.stringify(result), /test-secret/);
});

test("stale persisted facts cannot pass a live comparison", async () => {
  const target = {
    ...approvedTarget(env),
    projectId: "allowed",
    deniedProjectId: "denied",
  };
  await assert.rejects(
    verifyGithub({
      provider,
      target,
      readApplication: async (id) =>
        id === "denied"
          ? { status: 403, data: {} }
          : {
              status: 200,
              data: {
                connections: [
                  {
                    id: "c",
                    repository_id: 9,
                    installation_id: 7,
                    status: "active",
                  },
                ],
                records: [
                  {
                    connection_id: "c",
                    kind: "pull",
                    source_id: "1",
                    title: records[0].title,
                    state: "merged",
                    url: records[0].url,
                    source_at: records[0].sourceAt,
                  },
                ],
              },
            },
    }),
    /stale/,
  );
});

test("detail-only provider changes fail and JSONB object key ordering is irrelevant", async () => {
  const target = {
    ...approvedTarget(env),
    projectId: "allowed",
    deniedProjectId: "denied",
  };
  const live = {
    ...records[0],
    kind: "contributor",
    sourceId: "7",
    details: { contributions: 100, login: "dev", optional: undefined },
  };
  const providerWithDetails = {
    ...provider,
    page: async (c) => ({
      fullName: "fixture/private",
      records: c.checkpoint.kind === 1 ? [live] : [],
    }),
  };
  let details = { login: "dev", contributions: 1 };
  const readApplication = async (id) =>
    id === "denied"
      ? { status: 403, data: {} }
      : {
          status: 200,
          data: {
            connections: [
              {
                id: "c",
                repository_id: 9,
                installation_id: 7,
                status: "active",
              },
            ],
            records: [
              {
                connection_id: "c",
                kind: "contributor",
                source_id: "7",
                title: live.title,
                state: live.state,
                url: live.url,
                source_at: live.sourceAt,
                details,
              },
            ],
          },
        };
  await assert.rejects(
    verifyGithub({ provider: providerWithDetails, target, readApplication }),
    /stale/,
  );
  details = { login: "dev", contributions: 100 };
  assert.equal(
    (
      await verifyGithub({
        provider: providerWithDetails,
        target,
        readApplication,
      })
    ).persistedReadComparisonVerified,
    true,
  );
});
