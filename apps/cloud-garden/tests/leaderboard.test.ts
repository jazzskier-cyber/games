import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OneGpLeaderboard, LEADERBOARD_CONFIG, type PlayerSession } from '../src/leaderboard';

const session: PlayerSession = { token: 'short-lived-test-token', expiresAt: '2999-01-01T00:00:00Z', gameId: LEADERBOARD_CONFIG.gameId, player: { displayName: '花园旅人', isGuest: true } };
const ok = (data: unknown) => new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
function harness(fetcher: typeof fetch, sessions: (force: boolean) => Promise<PlayerSession> = async () => session) {
  const waits: number[] = [];
  const client = new OneGpLeaderboard({ fetcher, sessionProvider: sessions, delay: async ms => { waits.push(ms); } });
  return { client, waits };
}

test('actual stage start creates one run; winning submits frozen score with separate idempotency keys', async () => {
  let releaseRun!: (response: Response) => void;
  const runResponse = new Promise<Response>(resolve => { releaseRun = resolve; });
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const { client } = harness(async (input, init) => {
    calls.push({ url: String(input), init });
    return calls.length === 1 ? runResponse : ok({ accepted: true, submittedScore: 1250, personalBest: 1250, isPersonalBest: true, rank: 4, participants: 20 });
  });
  const round = client.beginRound(3);
  const first = client.settleRound(round, 1250);
  const duplicate = client.settleRound(round, 1250);
  assert.equal(first, duplicate);
  releaseRun(ok({ runId: 'run-123' }));
  const receipt = await first;
  assert.equal(receipt.rank, 4);
  assert.equal(receipt.personalBest, 1250);
  assert.equal(receipt.isPersonalBest, true);
  assert.match(calls[0]!.url, new RegExp(`/leaderboards/${LEADERBOARD_CONFIG.boardId}/runs$`));
  assert.match(calls[1]!.url, /\/runs\/run-123\/score$/);
  const startKey = new Headers(calls[0]!.init?.headers).get('Idempotency-Key');
  const scoreKey = new Headers(calls[1]!.init?.headers).get('Idempotency-Key');
  assert.ok(startKey && scoreKey && startKey !== scoreKey);
  assert.equal((calls[1]!.init?.body as string), JSON.stringify({ score: 1250 }));
  for (const call of calls) assert.equal(call.init?.credentials, 'omit');
  assert.equal(round.finalScore, 1250);
});

test('score is not clamped, and a round cannot be settled later with a different score', async () => {
  const { client } = harness(async () => ok({ runId: 'run' }));
  const round = client.beginRound(1);
  assert.equal(await client.settleRound(round, -1).catch(() => 'rejected'), 'rejected');
  assert.equal(await client.settleRound(round, 10_000_000_001).catch(() => 'rejected'), 'rejected');
  round.finalScore = 900;
  assert.equal(await client.settleRound(round, 901).catch(() => 'rejected'), 'rejected');
});

test('transient run failure retries with the original idempotency key', async () => {
  let firstKey = '';
  const seenKeys: string[] = [];
  let attempt = 0;
  const { client, waits } = harness(async (_input, init) => {
    const key = new Headers(init?.headers).get('Idempotency-Key')!;
    seenKeys.push(key);
    if (!firstKey) firstKey = key;
    attempt++;
    return attempt === 1 ? new Response(JSON.stringify({ error: { code: 'BUSY', message: 'try later' } }), { status: 503 }) : ok({ runId: 'run-retried' });
  });
  const round = client.beginRound(8);
  assert.equal(await client.ensureRun(round), 'run-retried');
  assert.equal(seenKeys.length, 2);
  assert.equal(seenKeys[0], seenKeys[1]);
  assert.deepEqual(waits, [700]);
});

test('failed score settlement retries the same run, final score and score key', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  let scoreAttempt = 0;
  const { client } = harness(async (input, init) => {
    const url = String(input); calls.push({ url, init });
    if (url.endsWith('/runs')) return ok({ runId: 'persistent-run' });
    scoreAttempt++;
    if (scoreAttempt <= 3) throw new TypeError('offline');
    return ok({ accepted: true, submittedScore: 3400, personalBest: 3400, isPersonalBest: true, rank: 1, participants: 1 });
  });
  const round = client.beginRound(11);
  await assert.rejects(client.settleRound(round, 3400), /offline/);
  const receipt = await client.retryRound(round);
  assert.equal(receipt?.isPersonalBest, true);
  const scoreCalls = calls.filter(call => call.url.endsWith('/score'));
  assert.equal(scoreCalls.length, 4);
  assert.ok(scoreCalls.every(call => call.url.endsWith('/runs/persistent-run/score')));
  assert.equal(new Set(scoreCalls.map(call => new Headers(call.init?.headers).get('Idempotency-Key'))).size, 1);
  assert.ok(scoreCalls.every(call => call.init?.body === JSON.stringify({ score: 3400 })));
});

test('429 honors Retry-After, then standings and personal rank use exact read endpoints', async () => {
  const urls: string[] = [];
  let entriesTry = 0;
  const { client, waits } = harness(async input => {
    const url = String(input); urls.push(url);
    if (url.includes('/entries?') && entriesTry++ === 0) return new Response(JSON.stringify({ error: { code: 'RATE_LIMIT', message: 'slow down' } }), { status: 429, headers: { 'Retry-After': '2' } });
    if (url.includes('/entries?')) return ok({ entries: [{ score: 123 }] });
    return ok({ entry: { score: 123 }, neighbors: [] });
  });
  assert.equal((await client.getStandings()).length, 1);
  assert.equal((await client.getPersonalRank()).entry?.score, 123);
  assert.deepEqual(waits, [2000]);
  assert.ok(urls.some(url => url.endsWith(`/leaderboards/${LEADERBOARD_CONFIG.boardId}/entries?limit=10`)));
  assert.ok(urls.some(url => url.endsWith(`/leaderboards/${LEADERBOARD_CONFIG.boardId}/me?around=2`)));
});

test('expired token refresh does not transfer a round to a different player', async () => {
  let sessionCalls = 0;
  let scoreCalls = 0;
  const differentPlayer = { ...session, player: { displayName: '另一位玩家', isGuest: true } };
  const { client } = harness(async (_input, init) => {
    const auth = new Headers(init?.headers).get('Authorization');
    if (String(_input).endsWith('/runs')) return ok({ runId: 'run-owner' });
    scoreCalls++;
    return auth === `Bearer ${session.token}` ? new Response(JSON.stringify({ error: { code: 'TOKEN_EXPIRED', message: 'expired' } }), { status: 401 }) : ok({});
  }, async force => { sessionCalls++; return force ? differentPlayer : session; });
  const round = client.beginRound(2);
  await client.ensureRun(round);
  await assert.rejects(client.settleRound(round, 500), /Player changed/);
  assert.equal(sessionCalls, 2);
  assert.equal(scoreCalls, 1);
});

test('already-settled API response is treated idempotently', async () => {
  const { client } = harness(async (_input, init) => String(_input).endsWith('/runs') ? ok({ runId: 'done' }) : new Response(JSON.stringify({ error: { code: 'ALREADY_SUBMITTED', message: 'already done' } }), { status: 409 }));
  const round = client.beginRound(7);
  const receipt = await client.settleRound(round, 777);
  assert.equal(receipt.accepted, true);
  assert.equal(receipt.submittedScore, 777);
});
