import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Journey, makeWorld, canLand, clampX, WIDTH, LEVELS, JUMP, GRAVITY, STEP } from '../src/world';
import { STAGES, DIFFICULTY_PATTERN, getStage, nextStage, readCampaign, completeStage } from '../src/stages';
const idle = { direction: 0, jump: false, attack: false };
test('tutorial has wide safe islands, reachable jumps, and optional crystals', () => {
  const { platforms } = makeWorld();
  assert.ok(JUMP ** 2 / (2 * GRAVITY) > STEP + 20);
  for (let row = 1; row <= LEVELS; row++) {
    const island = platforms.find(p => p.row === row && !p.breakable)!;
    assert.ok(island.w >= 260);
    if (row < 4) assert.ok(!platforms.some(p => p.row === row && p.breakable));
  }
  assert.ok(new Journey().enemies.every(e => e.row >= 7));
});
test('landing ignores broken platforms and upward travel', () => {
  const p = { x: 100, y: 200, w: 260, breakable: true, alive: true, row: 1 };
  assert.ok(canLand(190, 210, 120, 19, p));
  assert.ok(!canLand(210, 190, 120, 19, p));
  assert.ok(!canLand(190, 210, 400, 19, p));
  assert.ok(!canLand(190, 210, 120, 19, { ...p, alive: false }));
});
test('first jump reaches the first island without horizontal movement', () => {
  const w = new Journey();
  w.step({ ...idle, jump: true }, 1 / 60);
  for (let i = 0; i < 65; i++) w.step(idle, 1 / 60);
  assert.equal(w.highest, 1);
  assert.equal(w.checkpoint.row, 1);
  assert.ok(w.grounded);
});
test('a fall returns to the checkpoint and preserves collected sunlight', () => {
  const w = new Journey();
  w.step({ ...idle, jump: true }, 1 / 60);
  for (let i = 0; i < 65; i++) w.step(idle, 1 / 60);
  const score = w.score, collected = w.collected;
  w.x = 25; w.y = w.cameraY + 700; w.grounded = false;
  w.step(idle, 1 / 60);
  assert.equal(w.rescues, 1);
  assert.equal(w.x, w.checkpoint.x);
  assert.equal(w.y, w.checkpoint.y);
  assert.equal(w.score, score); assert.equal(w.collected, collected);
  assert.ok(w.y - w.cameraY < 600);
});
test('leaf attack destroys optional crystal without removing the safe island', () => {
  const w = new Journey(), rock = w.platforms.find(p => p.breakable)!;
  w.x = rock.x + 23; w.y = rock.y + 35;
  w.step({ ...idle, attack: true }, 1 / 60);
  assert.equal(rock.alive, false);
  assert.ok(w.platforms.find(p => p.row === rock.row && !p.breakable)?.alive);
});
test('one complete journey can be played through using normal input at 60fps', () => {
  const w = new Journey();
  for (let frame = 0; frame < 12000 && !w.won; frame++) {
    const current = w.platforms.find(p => !p.breakable && p.row === w.highest)!;
    const next = w.platforms.find(p => !p.breakable && p.row === w.highest + 1)!;
    const aim = next.x + next.w / 2;
    const takeoff = Math.max(current.x + 35, Math.min(current.x + current.w - 35, aim));
    const target = w.grounded ? takeoff : aim;
    const direction = Math.abs(target - w.x) > 5 ? Math.sign(target - w.x) : 0;
    w.step({ direction, jump: w.grounded && Math.abs(w.x - takeoff) < 10 && frame % 2 === 0, attack: frame % 24 === 0 }, 1 / 60);
  }
  assert.ok(w.won, 'journey stuck on island ' + w.highest);
  assert.equal(w.highest, LEVELS);
  assert.ok(w.collected >= LEVELS);
});
test('world edges gently constrain movement', () => {
  assert.equal(clampX(-10), 25); assert.equal(clampX(WIDTH + 10), WIDTH - 25); assert.equal(clampX(240), 240);
});

test('campaign preserves all 21 requested difficulties and has 21 distinct routes', () => {
  assert.equal(STAGES.length, 21);
  assert.equal(DIFFICULTY_PATTERN, 'EEMMEMHEMMEHEMMHEHMEM');
  assert.equal(STAGES.map(s => s.difficulty).join(''), DIFFICULTY_PATTERN);
  const layouts = new Set(STAGES.map(s => JSON.stringify(makeWorld(s).platforms.map(p => [p.x, p.y, p.w]))));
  assert.equal(layouts.size, 21);
  assert.ok(getStage(1).width > getStage(3).width && getStage(3).width > getStage(7).width);
  assert.ok(getStage(1).step < getStage(3).step && getStage(3).step < getStage(7).step);
  assert.ok(getStage(7).wind > 0 && getStage(3).wind === 0);
});

test('checkpoint flower blooms once per newly reached island', () => {
  const w = new Journey();
  let blooms = 0;
  for (let i = 0; i < 100; i++) {
    w.step({ ...idle, jump: i === 0 }, 1 / 60);
    blooms += w.events.filter(e => e.type === 'checkpoint').length;
  }
  assert.equal(w.checkpoint.row, 1);
  assert.equal(blooms, 1);
});

for (const fps of [60, 30]) for (const stage of STAGES) {
  test('stage ' + stage.number + ' (' + stage.difficulty + ') is completable at ' + fps + 'fps', () => {
    const w = new Journey(stage.number);
    const maxFrames = fps * 150;
    for (let frame = 0; frame < maxFrames && !w.won; frame++) {
      const current = w.platforms.find(p => !p.breakable && p.row === w.highest)!;
      const next = w.platforms.find(p => !p.breakable && p.row === w.highest + 1)!;
      const aim = next.x + next.w / 2;
      const takeoff = Math.max(current.x + 35, Math.min(current.x + current.w - 35, aim));
      const target = w.grounded ? takeoff : aim;
      const direction = Math.abs(target - w.x) > 5 ? Math.sign(target - w.x) : 0;
      w.step({ direction, jump: w.grounded && Math.abs(w.x - takeoff) < 10 && frame % 2 === 0, attack: frame % Math.round(fps * .4) === 0 }, 1 / fps);
    }
    assert.ok(w.won, 'stuck at island ' + w.highest + ' with ' + w.rescues + ' rescues');
    assert.equal(w.highest, stage.islands);
    assert.ok(w.checkpoint.row === stage.islands);
    const score = w.score;
    w.step(idle, 1 / fps);
    assert.equal(w.score, score, 'win reward is awarded only once');
  });
}

test('campaign advances through all stages, supports replay and restores saved progress', () => {
  let progress = readCampaign(null);
  for (const stage of STAGES) progress = completeStage(progress, stage.number, 1000 + stage.number);
  assert.equal(Object.keys(progress.scores).length, 21);
  assert.equal(progress.selected, 21);
  assert.equal(nextStage(21), null);
  assert.equal(nextStage(20), 21);
  progress = completeStage(progress, 3, 100);
  assert.equal(progress.scores[3], 1003, 'replay does not lower the best score');
  assert.deepEqual(readCampaign(JSON.stringify(progress)), progress);
  assert.deepEqual(readCampaign('broken json'), { selected: 1, scores: {} });
  assert.deepEqual(readCampaign('{"selected":99,"scores":{"1":-4,"2":"oops","3":900,"22":300}}'), { selected: 21, scores: { 3: 900 } });
});
