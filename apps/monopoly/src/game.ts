export type Tile = { name: string; kind: 'property' | 'start' | 'event' | 'tax' | 'park' | 'bonus'; group?: number; price?: number; rent?: number; icon: string };
export const GROUPS = [
  { name: 'Old Town', color: '#ff8135' }, { name: 'Arts Quarter', color: '#9859ff' },
  { name: 'Garden District', color: '#ffc233' }, { name: 'Waterfront', color: '#27baff' },
  { name: 'Market District', color: '#ff5158' }, { name: 'Uptown', color: '#ff4cab' },
];
const property = (name: string, group: number, price: number, rent: number): Tile => ({ name, group, price, rent, kind: 'property', icon: 'house' });
export const TILES: Tile[] = [
  { name: 'Town Square', kind: 'start', icon: 'flag' },
  property('Maple Lane', 0, 120, 24), property('Baker Street', 0, 140, 28),
  { name: 'City Post', kind: 'event', icon: 'mail' }, property('Pottery Row', 1, 160, 32), property('Studio Alley', 1, 180, 36),
  { name: 'Central Park', kind: 'park', icon: 'tree' },
  property('Clover Court', 2, 200, 40), { name: 'City Tax', kind: 'tax', icon: 'coin' }, property('Willow Walk', 2, 220, 44),
  { name: 'City Post', kind: 'event', icon: 'mail' }, property('Harbor View', 3, 240, 48),
  { name: 'Sunday Market', kind: 'bonus', icon: 'shop' }, property('Marina Way', 3, 260, 52),
  property('Market Mews', 4, 280, 56), { name: 'City Post', kind: 'event', icon: 'mail' },
  property('Golden Arcade', 4, 300, 60), { name: 'City Tax', kind: 'tax', icon: 'coin' },
  { name: 'Lookout Point', kind: 'bonus', icon: 'sun' },
  property('Rose Avenue', 5, 320, 64), { name: 'City Post', kind: 'event', icon: 'mail' },
  property('Grand Terrace', 5, 340, 68), { name: 'City Post', kind: 'event', icon: 'mail' },
  { name: 'Garden Party', kind: 'bonus', icon: 'flower' },
];
export type Player = { name: string; cash: number; pos: number; out: boolean; color: string; mark: string };
export type Deed = { owner: number | null; level: number };
export type Game = {
  version: 1; id?: string; players: Player[]; deeds: Deed[]; current: number; round: number; limit: number;
  phase: 'roll' | 'buy' | 'end' | 'over'; dice: [number, number]; logs: string[];
  headline: string; detail: string; seed: number; turns: number;
};
export const money = (n: number) => '$' + n.toLocaleString('en-US');
export function createGame(limit = 12, seed = Date.now() >>> 0): Game {
  return {
    version: 1, id: `${seed.toString(36)}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`, players: [
      { name: 'You', cash: 1200, pos: 0, out: false, color: '#ffb800', mark: 'Y' },
      { name: 'Cleo', cash: 1200, pos: 0, out: false, color: '#27c4ff', mark: 'C' },
      { name: 'Otto', cash: 1200, pos: 0, out: false, color: '#ff4d9a', mark: 'O' },
    ], deeds: TILES.map(() => ({ owner: null, level: 0 })), current: 0, round: 1, limit,
    phase: 'roll', dice: [1, 1], logs: ['Welcome to the neighborhood. Everyone starts with $1,200.'],
    headline: 'Your empire starts here.', detail: 'Roll the dice to find your first property.', seed, turns: 0,
  };
}
function random(g: Game) { g.seed = (Math.imul(g.seed, 1664525) + 1013904223) >>> 0; return g.seed / 4294967296; }
function log(g: Game, message: string) { g.logs.unshift(message); g.logs = g.logs.slice(0, 30); }
export const owned = (g: Game, player: number) => g.deeds.flatMap((d, i) => d.owner === player ? [i] : []);
export function hasSet(g: Game, player: number, group: number) {
  return TILES.every((t, i) => t.group !== group || g.deeds[i].owner === player);
}
export function rentAt(g: Game, index: number) {
  const t = TILES[index], d = g.deeds[index];
  if (t.kind !== 'property') return 0;
  return t.rent! * (d.owner !== null && hasSet(g, d.owner, t.group!) ? 2 : 1) * (d.level + 1);
}
export const upgradeCost = (i: number) => Math.round(TILES[i].price! / 2);
export const assetValue = (g: Game, i: number) => (TILES[i].price ?? 0) + g.deeds[i].level * upgradeCost(i);
export const netWorth = (g: Game, p: number) => g.players[p].cash + owned(g, p).reduce((n, i) => n + assetValue(g, i), 0);
export const saleValue = (g: Game, i: number) => Math.floor(assetValue(g, i) * .75);
function pay(g: Game, from: number, amount: number, to?: number) {
  const p = g.players[from];
  // Sell the least valuable assets first to settle debt, rather than soft-locking a turn.
  const assets = owned(g, from).sort((a, b) => assetValue(g, a) - assetValue(g, b));
  for (const i of assets) {
    if (p.cash >= amount) break;
    const value = saleValue(g, i); p.cash += value; g.deeds[i] = { owner: null, level: 0 };
    log(g, `${p.name} sold ${TILES[i].name} to cover a payment (+${money(value)}).`);
  }
  const paid = Math.min(p.cash, amount); p.cash -= paid;
  if (to !== undefined) g.players[to].cash += paid;
  if (paid < amount) { p.out = true; log(g, `${p.name} is bankrupt and leaves the game.`); }
}
function finishIfNeeded(g: Game) {
  if (g.players.filter(p => !p.out).length <= 1 || g.players[0].out || g.round > g.limit) {
    g.phase = 'over'; g.round = Math.min(g.round, g.limit);
    const winners = ranking(g); const top = netWorth(g, winners[0]);
    const tied = winners.filter(p => netWorth(g, p) === top && !g.players[p].out);
    g.headline = tied.length > 1 ? 'A shared city crown!' : winners[0] === 0 ? 'The borough is yours!' : `${g.players[winners[0]].name} wins the borough!`;
    g.detail = 'Final standings are based on cash + full property and upgrade value.';
  }
}
export function ranking(g: Game) { return [0, 1, 2].sort((a, b) => Number(g.players[a].out) - Number(g.players[b].out) || netWorth(g, b) - netWorth(g, a)); }
const EVENTS = [
  { title: 'Your café is a hit!', detail: 'A neighborhood food guide sends new customers your way.', amount: 120 },
  { title: 'A little maintenance.', detail: 'The city is fixing the pavement outside your door.', amount: -70 },
  { title: 'Community grant!', detail: 'Good ideas deserve a little backing.', amount: 100 },
  { title: 'A rainy day repair.', detail: 'That leaky roof finally needs attention.', amount: -90 },
  { title: 'Festival weekend!', detail: 'Your neighborhood is buzzing with visitors.', amount: 150 },
  { title: 'Found a forgotten refund.', detail: 'A pleasant surprise in the city post.', amount: 60 },
  { title: 'Street fair contribution.', detail: 'Everyone chips in for a brighter neighborhood.', amount: -50 },
  { title: 'Property dividend!', detail: 'Collect $30 for each property you own.', amount: 0 },
];
export function roll(g: Game) {
  if (g.phase !== 'roll') return false;
  const p = g.players[g.current];
  g.dice = [1 + Math.floor(random(g) * 6), 1 + Math.floor(random(g) * 6)];
  const steps = g.dice[0] + g.dice[1];
  if (p.pos + steps >= TILES.length) { p.cash += 200; log(g, `${p.name} passed Town Square and collected $200.`); }
  p.pos = (p.pos + steps) % TILES.length;
  const tile = TILES[p.pos], deed = g.deeds[p.pos]; g.phase = 'end';
  g.headline = tile.name;
  log(g, `${p.name} rolled ${g.dice.join(' + ')} and landed on ${tile.name}.`);
  if (tile.kind === 'property') {
    if (deed.owner === null) {
      g.phase = 'buy'; g.detail = `${money(tile.price!)} to own it. Base rent ${money(tile.rent!)}. Complete the color pair to double rent.`;
    } else if (deed.owner === g.current) { g.detail = 'Home sweet home. This property belongs to you.'; }
    else {
      const rent = rentAt(g, p.pos), owner = deed.owner;
      pay(g, g.current, rent, owner); g.detail = `${p.name} owes ${money(rent)} in rent to ${g.players[owner].name}.`;
      log(g, `${p.name} owes ${money(rent)} rent to ${g.players[owner].name}.`);
    }
  } else if (tile.kind === 'event') {
    const event = EVENTS[Math.floor(random(g) * EVENTS.length)];
    const amount = event.amount || owned(g, g.current).length * 30;
    if (amount < 0) pay(g, g.current, -amount); else p.cash += amount;
    g.headline = event.title; g.detail = `${event.detail} ${amount < 0 ? 'Pay' : 'Collect'} ${money(Math.abs(amount))}.`;
    log(g, `${p.name}: ${event.title} (${amount < 0 ? '−' : '+'}${money(Math.abs(amount))})`);
  } else if (tile.kind === 'tax') {
    pay(g, g.current, 80); g.detail = 'A contribution to keep the borough beautiful. Pay $80.'; log(g, `${p.name} pays $80 city tax.`);
  } else if (tile.kind === 'bonus') {
    p.cash += 80; g.detail = 'A good day in the neighborhood. Collect an $80 community bonus.'; log(g, `${p.name} collects an $80 community bonus.`);
  } else if (tile.kind === 'park') { g.detail = 'A quiet moment under the trees. No rent, no fees. Just fresh air.'; }
  else { g.detail = 'Welcome home. Your $200 lap bonus is already in the bank.'; }
  finishIfNeeded(g); return true;
}
export function buy(g: Game) {
  const p = g.players[g.current], t = TILES[p.pos];
  if (g.phase !== 'buy' || t.kind !== 'property' || g.deeds[p.pos].owner !== null || p.cash < t.price!) return false;
  p.cash -= t.price!; g.deeds[p.pos].owner = g.current; g.phase = 'end';
  g.headline = `${t.name} is ${g.current === 0 ? 'yours' : g.players[g.current].name + '’s'}!`;
  g.detail = hasSet(g, g.current, t.group!) ? 'Color set complete! Rent is doubled. You can now add upgrades.' : 'One property closer to your own little empire.';
  log(g, `${p.name} bought ${t.name} for ${money(t.price!)}.`); return true;
}
export function endTurn(g: Game) {
  if (g.phase !== 'end' && g.phase !== 'buy') return false;
  g.turns++;
  do { g.current = (g.current + 1) % 3; if (g.current === 0) g.round++; } while (g.players[g.current].out);
  g.phase = 'roll'; g.headline = g.current === 0 ? 'Your next big move.' : `${g.players[g.current].name} is exploring…`;
  g.detail = g.current === 0 ? 'Claim a block. Build a set. Raise the stakes.' : 'Your rivals are building their own corner of the city.';
  finishIfNeeded(g); return true;
}
export function canManage(g: Game, player: number) { return g.phase !== 'over' && g.current === player && !g.players[player].out; }
export function upgrade(g: Game, i: number) {
  const t = TILES[i], d = g.deeds[i];
  if (!t || t.kind !== 'property' || !canManage(g, g.current) || d.owner !== g.current || d.level >= 3 || !hasSet(g, g.current, t.group!) || g.players[g.current].cash < upgradeCost(i)) return false;
  g.players[g.current].cash -= upgradeCost(i); d.level++; log(g, `${g.players[g.current].name} upgraded ${t.name} to level ${d.level}.`); return true;
}
export function sell(g: Game, i: number) {
  if (!TILES[i] || !canManage(g, g.current) || g.deeds[i].owner !== g.current) return false;
  const value = saleValue(g, i); g.players[g.current].cash += value; g.deeds[i] = { owner: null, level: 0 };
  log(g, `${g.players[g.current].name} sold ${TILES[i].name} for ${money(value)}.`); return true;
}
// Rivals charge a premium, especially when selling would break their set or complete yours.
export function tradePrice(g: Game, i: number) {
  const d = g.deeds[i], t = TILES[i];
  if (d.owner === null || d.owner === 0 || t.kind !== 'property') return null;
  const completes = TILES.some((other, j) => j !== i && other.group === t.group && g.deeds[j].owner === 0);
  const multiplier = hasSet(g, d.owner, t.group!) ? 2 : completes ? 1.7 : 1.35;
  return Math.ceil(assetValue(g, i) * multiplier / 10) * 10;
}
export function trade(g: Game, i: number) {
  const price = tradePrice(g, i), seller = g.deeds[i]?.owner;
  if (!canManage(g, 0) || price === null || seller == null || g.players[0].cash < price) return false;
  g.players[0].cash -= price; g.players[seller].cash += price; g.deeds[i].owner = 0;
  log(g, `You bought ${TILES[i].name} from ${g.players[seller].name} for ${money(price)}.`); return true;
}
export function aiManage(g: Game) {
  if (g.current === 0 || !canManage(g, g.current)) return;
  for (const i of owned(g, g.current)) {
    if (g.players[g.current].cash > upgradeCost(i) + 250) upgrade(g, i);
  }
}
export function aiBuy(g: Game) {
  if (g.current === 0 || g.phase !== 'buy') return;
  const p = g.players[g.current], t = TILES[p.pos];
  const hasPartner = TILES.some((other, i) => i !== p.pos && other.group === t.group && g.deeds[i].owner === g.current);
  if (p.cash >= t.price! + (hasPartner ? 0 : 100)) buy(g);
}
export function validSave(data: unknown): data is Game {
  if (!data || typeof data !== 'object') return false;
  const g = data as Game;
  return g.version === 1 && Array.isArray(g.players) && g.players.length === 3 &&
    g.players.every(p => p && typeof p.name === 'string' && Number.isFinite(p.cash) && p.cash >= 0 && Number.isInteger(p.pos) && p.pos >= 0 && p.pos < 24 && typeof p.out === 'boolean') &&
    Array.isArray(g.deeds) && g.deeds.length === 24 && g.deeds.every((d, i) => d && (d.owner === null || [0, 1, 2].includes(d.owner)) && Number.isInteger(d.level) && d.level >= 0 && d.level <= 3 && (TILES[i].kind === 'property' || d.owner === null)) &&
    [0, 1, 2].includes(g.current) && Number.isInteger(g.round) && g.round >= 1 && [12, 20].includes(g.limit) && g.round <= g.limit &&
    ['roll', 'buy', 'end', 'over'].includes(g.phase) && Number.isInteger(g.seed) &&
    Array.isArray(g.dice) && g.dice.length === 2 && g.dice.every(d => Number.isInteger(d) && d >= 1 && d <= 6) &&
    Array.isArray(g.logs) && g.logs.every(l => typeof l === 'string') && typeof g.headline === 'string' && typeof g.detail === 'string' &&
    Number.isInteger(g.turns) && g.turns >= 0 && (g.phase === 'over' || !g.players[g.current].out) &&
    (g.phase !== 'buy' || (TILES[g.players[g.current].pos].kind === 'property' && g.deeds[g.players[g.current].pos].owner === null));
}
