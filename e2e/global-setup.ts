// The preview server is started separately (./stack.sh) so its PID is known and killed by PID
// afterwards. Fail loudly if it isn't up instead of testing nothing.
export const BASE = 'http://127.0.0.1:4180/hackathon-hq/';

export default async function globalSetup() {
  const r = await fetch(BASE).catch((e) => {
    throw new Error(`Hackathon HQ preview not running (${BASE}: ${e.cause?.code || e.message}). Start it with: npm run stack`);
  });
  if (!r.ok) throw new Error(`${BASE} answered ${r.status}; restart it (npm run stack:stop && npm run stack)`);
}
