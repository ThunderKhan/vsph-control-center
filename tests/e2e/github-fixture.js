// Synthetic provider transport installed ONLY by the isolated browser server.
// This module is never imported by production routes/server.
const { normalize } = require("../../services/github/provider");
module.exports = function install() {
  const file = require.resolve("../../services/github/provider"),
    original = require(file);
  const repo = {
    repositoryId: 99,
    fullName: "fixture/sandbox",
    defaultBranch: "main",
    private: true,
    accountId: 88,
  };
  const records = [
    {
      sha: "a".repeat(40),
      commit: {
        message: "Fixture implementation",
        committer: { date: "2026-10-01" },
      },
      html_url: "https://github.com/fixture/sandbox/commit/" + "a".repeat(40),
    },
    { id: 12, login: "fixture-developer", contributions: 3 },
    {
      id: 13,
      number: 1,
      title: "Fixture pull request",
      state: "open",
      updated_at: "2026-10-02",
      html_url: "https://github.com/fixture/sandbox/pull/1",
    },
    {
      id: 14,
      name: "Fixture build",
      conclusion: "failure",
      updated_at: "2026-10-03",
      html_url: "https://github.com/fixture/sandbox/actions/runs/14",
    },
    {
      id: 15,
      name: "Fixture checks",
      conclusion: "success",
      completed_at: "2026-10-04",
      html_url: "https://github.com/fixture/sandbox/actions/runs/15",
    },
    {
      id: 16,
      name: "Fixture release",
      tag_name: "v1.0.0",
      published_at: "2026-10-05",
      html_url: "https://github.com/fixture/sandbox/releases/tag/v1.0.0",
    },
    { name: "v1.0.0", commit: { sha: "a".repeat(40) } },
  ];
  const provider = {
    async installation(id) {
      if (id !== 77) throw new original.ProviderError("permission_denied");
      return { id: 77, accountId: 88, accountLogin: "fixture" };
    },
    async discover() {
      return { repositories: [repo], nextPage: null };
    },
    async verifyRepository(g, id) {
      if (id !== 99 || Number(g.installation_id) !== 77)
        throw new original.ProviderError("permission_denied");
      return repo;
    },
    async page(c) {
      const k = c.checkpoint.kind;
      return {
        ...repo,
        records: [normalize(k, records[k], repo.fullName, Date.now())],
        checkpoint: { kind: k === 6 ? 0 : k + 1, page: 1 },
        cycleComplete: k === 6,
      };
    },
  };
  require.cache[file].exports = {
    ...original,
    configuration: () => ({ mode: "isolated-fixture" }),
    client: () => provider,
  };
};
