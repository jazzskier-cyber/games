import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, TILES, roll, buy, endTurn, rentAt, upgrade, sell, trade, tradePrice, owned, netWorth, aiManage, aiBuy, validSave } from '../src/game';

test('a color pair doubles rent and upgrades add value', () => {
  const g = createGame(); g.deeds[1].owner = 0;
  assert.equal(rentAt(g, 1), 24);
  assert.equal(upgrade(g, 1), false);
  g.deeds[2].owner = 0;
  assert.equal(rentAt(g, 1), 48);
  const worth = netWorth(g, 0);
  for (let n = 0; n < 3; n++) assert.equal(upgrade(g, 1), true);
  assert.equal(rentAt(g, 1), 192);
  assert.equal(netWorth(g, 0), worth);
  assert.equal(upgrade(g, 1), false);
});
test('trading pays the owner and transfers the upgraded property', () => {
  const g = createGame(); g.deeds[1] = { owner: 1, level: 2 }; g.deeds[2].owner = 0;
  const quote = tradePrice(g,1)!;
  assert.equal(trade(g,1), true);
  assert.equal(g.players[0].cash, 1200 - quote);
  assert.equal(g.players[1].cash, 1200 + quote);
  assert.deepEqual(g.deeds[1], { owner: 0, level: 2 });
  assert.equal(trade(g,1), false);
  g.current = 1; assert.equal(sell(g,1), false);
});
test('selling returns 75% including improvements and removes the set bonus', () => {
  const g = createGame(); g.deeds[1] = { owner: 0, level: 1 }; g.deeds[2].owner = 0;
  assert.equal(sell(g,1), true);
  assert.equal(g.players[0].cash, 1335);
  assert.deepEqual(g.deeds[1], { owner: null, level: 0 });
  assert.equal(rentAt(g,2), 28);
});
test('rent liquidates assets and pays only available money on bankruptcy', () => {
  const g = createGame(12, 1); g.players[0].cash = 1;
  // Seed 1 rolls 2 + 3, landing on Studio Alley.
  g.deeds[4] = { owner: 1, level: 3 }; g.deeds[5] = { owner: 1, level: 3 };
  g.deeds[1] = { owner: 0, level: 0 };
  roll(g);
  assert.equal(g.players[0].pos, 5);
  assert.equal(g.players[0].cash, 0);
  assert.equal(g.players[0].out, true);
  assert.equal(g.players[1].cash, 1291);
  assert.equal(g.deeds[1].owner, null);
  assert.equal(g.phase, 'over');
});
test('buy actions are affordable, phase guarded, and cannot be repeated', () => {
  const g = createGame(12,1); roll(g);
  g.players[0].cash = 0; assert.equal(buy(g), false);
  g.players[0].cash = 180; assert.equal(buy(g), true);
  assert.equal(g.players[0].cash,0); assert.equal(buy(g),false);
  assert.equal(roll(g),false);
});
test('100 complete matches finish, preserve valid saves, and never create negative cash', () => {
  for (let seed = 1; seed <= 100; seed++) {
    let g = createGame(seed % 2 ? 12 : 20, seed);
    for (let step = 0; g.phase !== 'over' && step < 200; step++) {
      if (g.phase === 'roll') roll(g);
      if (g.phase === 'buy') { if (g.current === 0) buy(g); else aiBuy(g); }
      if (g.current !== 0) aiManage(g);
      if (g.current === 0) for (const i of owned(g, 0)) if (g.players[0].cash > 250) upgrade(g,i);
      if (g.phase !== 'over') endTurn(g);
      assert.ok(validSave(g), `Invalid save at seed ${seed}`);
      assert.ok(g.players.every(p => p.cash >= 0));
      g = JSON.parse(JSON.stringify(g));
    }
    assert.equal(g.phase,'over');
    assert.ok(g.turns <= g.limit * 3);
    assert.ok(g.deeds.every((d,i) => d.owner === null || TILES[i].kind === 'property'));
  }
});
test('invalid saved games are rejected', () => {
  assert.equal(validSave(null),false); assert.equal(validSave({}),false);
  const g = createGame(); g.players[0].pos = 30; assert.equal(validSave(g),false);
  const h = createGame(); h.phase = 'buy'; assert.equal(validSave(h),false);
});
