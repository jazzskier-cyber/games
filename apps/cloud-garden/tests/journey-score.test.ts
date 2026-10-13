import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addJourneyPoints, readJourneyScore, resetJourneyScore } from '../src/journey-score';

test('journey points persist across sessions, preserve pending settlements and reset only for a fresh journey', () => {
  const pending = { startKey: 'start', scoreKey: 'score', stage: 4, runId: 'run', finalScore: 1200 };
  const resumed = readJourneyScore(JSON.stringify({ total: 1200, pendingRounds: [pending] }));
  assert.equal(resumed.total, 1200);
  assert.deepEqual(resumed.pendingRounds, [pending]);
  const continued = addJourneyPoints(resumed, 800);
  assert.equal(continued.total, 2000);
  assert.deepEqual(continued.pendingRounds, [pending]);
  assert.equal(resetJourneyScore(continued).total, 0);
  assert.deepEqual(readJourneyScore('invalid'), { total: 0, pendingRounds: [] });
});

test('journey total rejects negative, fractional and unsafe increments without losing saved score', () => {
  const state = { total: 800, pendingRounds: [] };
  assert.equal(addJourneyPoints(state, -10), state);
  assert.equal(addJourneyPoints(state, 2.5), state);
  assert.equal(addJourneyPoints(state, Number.MAX_SAFE_INTEGER), state);
});
