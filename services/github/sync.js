const { client, ProviderError } = require("./provider");
async function tick({ command, provider = client(), connectionId = null }) {
  const lease = await command(null, "claim", connectionId, {});
  if (!lease) return { processed: false };
  try {
    const page = await provider.page(lease);
    await command(null, "ingest", lease.id, {
      ...page,
      leaseToken: lease.lease_token,
    });
    return {
      processed: true,
      connectionId: lease.id,
      records: page.records.length,
    };
  } catch (error) {
    const code = error instanceof ProviderError ? error.code : "sync_failed";
    try {
      await command(null, "failed", lease.id, {
        leaseToken: lease.lease_token,
        code,
        ...(error.retryAfter ? { retryAfter: error.retryAfter } : {}),
      });
    } catch {
      /* Revoked/disconnected lease cannot change state. */
    }
    return { processed: true, connectionId: lease.id, error: code };
  }
}
module.exports = { tick };
