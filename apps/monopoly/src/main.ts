import './style.css';
import { TILES, GROUPS, createGame, roll, buy, endTurn, upgrade, sell, trade, tradePrice, owned, hasSet, rentAt, upgradeCost, saleValue, netWorth, money, ranking, aiManage, aiBuy, validSave, type Game } from './game';
import { icon, cityArt, tileArt } from './art';

const app = document.querySelector<HTMLDivElement>('#app')!;
const SAVE = 'pocket-borough-v1';
const RECORDS = 'pocket-borough-records-v1';
const dialog = document.createElement('dialog');
dialog.id = 'modal';
document.body.append(dialog);
let game: Game = createGame();
let resumed = false;
try { const data = JSON.parse(localStorage.getItem(SAVE) || 'null'); if (validSave(data)) { game = data; resumed = true; } } catch { /* Storage is optional. */ }
game.players.forEach((p, i) => { p.color = ['#ffb800', '#27c4ff', '#ff4d9a'][i]; });
let busy = false, moving: number | null = null, inspected: number | null = null;
let panel: 'properties' | 'activity' = 'properties';
let sound = false;
let audio: AudioContext | undefined;
const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
type MatchRecord = { id: string; rounds: 12 | 20; date: number; scores: [number, number, number]; names: [string, string, string] };
function loadRecords(): MatchRecord[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(RECORDS) || '[]');
    return Array.isArray(value) ? value.filter((r): r is MatchRecord => r && typeof r.id === 'string' && [12, 20].includes(r.rounds) && Number.isFinite(r.date) && Array.isArray(r.scores) && r.scores.length === 3 && r.scores.every(Number.isFinite) && Array.isArray(r.names) && r.names.length === 3 && r.names.every((n: unknown) => typeof n === 'string')) : [];
  } catch { return []; }
}
function recordCompletedMatch() {
  if (game.phase !== 'over') return;
  const id = game.id || `${game.seed.toString(36)}-${game.turns}`;
  const records = loadRecords();
  if (records.some(r => r.id === id)) return;
  records.push({ id, rounds: game.limit === 20 ? 20 : 12, date: Date.now(), scores: [0, 1, 2].map(i => netWorth(game, i)) as [number, number, number], names: game.players.map(p => p.name) as [string, string, string] });
  try { localStorage.setItem(RECORDS, JSON.stringify(records)); } catch { /* The final standings remain available. */ }
}
function save() { recordCompletedMatch(); try { localStorage.setItem(SAVE, JSON.stringify(game)); } catch { /* Private browsing still supports a full session. */ } }
function tone(freq = 440) {
  if (!sound) return;
  try { audio ??= new AudioContext(); void audio.resume(); const o = audio.createOscillator(), gain = audio.createGain(); o.connect(gain); gain.connect(audio.destination); o.frequency.value = freq; o.type = 'sine'; gain.gain.setValueAtTime(.04, audio.currentTime); gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + .15); o.start(); o.stop(audio.currentTime + .15); } catch { /* Audio is optional. */ }
}
function coords(i: number) {
  if (i <= 6) return [7, 7 - i];
  if (i <= 12) return [13 - i, 1];
  if (i <= 18) return [1, i - 11];
  return [i - 17, 7];
}
function die(value: number) {
  const dots: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  return `<span class="die" role="img" aria-label="${value}">${Array.from({ length: 9 }, (_, i) => `<i class="${dots[value].includes(i) ? 'pip' : ''}"></i>`).join('')}</span>`;
}
function tileHTML(i: number) {
  const t = TILES[i], d = game.deeds[i], [row, col] = coords(i);
  const tokens = game.players.flatMap((p, n) => !p.out && (n === game.current && moving !== null ? moving : p.pos) === i ? [`<span class="token token-${n}" style="--player:${p.color}" title="${escape(p.name)}">${p.mark}</span>`] : []).join('');
  return `<button class="tile ${t.kind} ${game.players[game.current].pos === i && moving === null ? 'landed' : ''} ${d.owner !== null ? 'claimed' : ''}" data-tile="${i}" style="grid-row:${row};grid-column:${col};--district:${t.group !== undefined ? GROUPS[t.group].color : '#d9ddca'};--owner:${d.owner !== null ? game.players[d.owner].color : 'transparent'}" aria-label="${escape(t.name)}, ${t.price ? money(t.price) : t.kind}${d.owner !== null ? ', owned by ' + game.players[d.owner].name : ''}">
    ${t.kind === 'property' ? '<span class="district-band"></span>' : ''}${tileArt(i, 'tile-picture')}<span class="tile-name">${t.name}</span><span class="tile-price">${t.price ? money(t.price) : t.kind === 'start' ? '+$200 / lap' : t.kind === 'tax' ? '−$80' : t.kind === 'bonus' ? '+$80' : t.kind === 'event' ? 'Surprise!' : 'Take a breath'}</span>
    ${d.level ? `<span class="levels" aria-label="${d.level} upgrades">${'▪'.repeat(d.level)}</span>` : ''}<span class="tokens">${tokens}</span>${d.owner !== null ? `<span class="owner-dot" style="background:${game.players[d.owner].color}"></span>` : ''}</button>`;
}
function playerHTML(n: number) {
  const p = game.players[n], active = game.current === n && game.phase !== 'over';
  return `<div class="player-card ${active ? 'active' : ''} ${p.out ? 'bankrupt' : ''}" style="--player:${p.color}"><span class="avatar">${p.mark}<span class="avatar-roof"></span></span><div class="player-info"><div class="player-name">${p.name}<span>${p.out ? 'OUT' : n === 0 ? 'THAT’S YOU' : 'COMPUTER'}</span></div><div class="player-cash">${money(p.cash)}</div><div class="player-assets">${owned(game,n).length} properties <span>·</span> ${money(netWorth(game,n))} total</div></div>${active ? '<span class="turn-dot" title="Current turn"></span>' : ''}</div>`;
}
function actionHTML() {
  const human = game.current === 0, p = game.players[game.current], tile = TILES[p.pos];
  if (game.phase === 'over') return `<div class="eyebrow">THE FINAL CHAPTER</div><h2>${game.headline}</h2><p>${game.detail}</p><div class="standings">${ranking(game).map((n, i) => `<div><span>${i+1}. ${game.players[n].name}${game.players[n].out ? ' · bankrupt' : ''}</span><strong>${money(netWorth(game,n))}</strong></div>`).join('')}</div><button class="primary" data-action="scores">View local leaderboard ${icon('arrow')}</button><button class="text-button full" data-action="new">Another little empire</button>`;
  return `<div class="eyebrow"><span class="status-dot ${busy ? 'pulse' : ''}"></span>${human ? 'YOUR TURN' : `${p.name.toUpperCase()}’S TURN`}</div><h2>${escape(busy && human ? 'Let the dice decide.' : game.headline)}</h2><p>${escape(busy && human ? 'Your next big deal is one roll away.' : game.detail)}</p><div class="action-buttons">${busy || !human ? '<button class="primary" disabled>Exploring the neighborhood<span class="loading-dots">…</span></button>' : game.phase === 'roll' ? `<button class="primary" data-action="roll">Roll the dice ${icon('arrow')}</button><span class="keyboard-hint">or press your space bar</span>` : game.phase === 'buy' ? `<button class="primary" data-action="buy" ${p.cash < tile.price! ? 'disabled' : ''}>${p.cash < tile.price! ? 'Not enough cash' : `Buy for ${money(tile.price!)}`} ${icon('house')}</button><button class="text-button" data-action="end">Pass & end turn →</button>` : `<button class="primary" data-action="end">End turn ${icon('arrow')}</button>`}</div>`;
}
function portfolioHTML() {
  if (panel === 'activity') return `<ol class="activity">${game.logs.slice(0, 12).map(l => `<li>${escape(l)}</li>`).join('')}</ol>`;
  const properties = owned(game, 0);
  if (!properties.length) return `<div class="empty-portfolio">${icon('house')}<strong>Your empire starts here.</strong><p>Your properties will appear here.<br>Land on an open lot to buy it.</p></div>`;
  return `<div class="deed-list">${properties.map(i => `<button class="deed" data-tile="${i}" style="--district:${GROUPS[TILES[i].group!].color}"><span class="deed-color"></span>${tileArt(i, 'deed-picture')}<span><strong>${TILES[i].name}</strong><small>${hasSet(game, 0, TILES[i].group!) ? 'Full set' : GROUPS[TILES[i].group!].name} · ${game.deeds[i].level ? `Level ${game.deeds[i].level}` : 'Undeveloped'}</small></span><span class="deed-rent">${money(rentAt(game,i))}<small>rent</small></span></button>`).join('')}</div>`;
}
function render() {
  const focus = (document.activeElement as HTMLElement | null)?.dataset;
  app.innerHTML = `<div class="shell"><header><a class="brand" href="./" aria-label="Pocket Borough home"><span class="brand-icon">${icon('house')}</span><span>Pocket<span class="brand-second">Borough</span><small>BIG DEALS. BIGGER RIVALS.</small></span></a><div class="header-actions"><span class="local-label"><i></i> LOCAL PLAY</span><button class="small-button sound-button" data-action="sound" aria-label="${sound ? 'Mute' : 'Enable'} sound">${sound ? 'Sound on' : 'Sound off'}</button><button class="small-button" data-action="scores">Scores</button><button class="small-button" data-action="help">How to play <span>?</span></button><button class="small-button new-button" data-action="new" ${busy ? 'disabled' : ''}>New game ↗</button></div></header>
    <main><div class="game-topline"><div><span class="eyebrow">BUILD YOUR EMPIRE · OUTPLAY YOUR RIVALS</span><h1>This city is up for grabs.</h1></div><div class="round-badge"><span>ROUND</span><strong>${game.round}<em> / ${game.limit}</em></strong></div></div>
    <section class="players" aria-label="Players">${[0,1,2].map(playerHTML).join('')}</section>
    <div class="game-layout"><section class="board-wrap" aria-label="Game board"><div class="board">${TILES.map((_,i)=>tileHTML(i)).join('')}<div class="board-center"><span class="center-kicker">THE RACE TO GET RICH</span><div class="city-title">BUY. BUILD.<br><span>TAKE OVER.</span></div>${cityArt()}<div class="dice-tray ${busy ? 'rolling' : ''}">${die(game.dice[0])}${die(game.dice[1])}</div><div class="dice-caption">${moving !== null ? 'Big moves. Bigger stakes.' : game.turns === 0 && game.phase === 'roll' ? 'Roll the dice. Make your move.' : `${game.phase === 'roll' ? 'Last roll' : escape(game.players[game.current].name)} · ${game.dice[0] + game.dice[1]} steps`}</div><div class="board-rule">BUY <span>·</span> BUILD <span>·</span> DOMINATE</div></div></div><div class="board-caption"><span><i class="legend-dot"></i> Colored dots show ownership</span><span>Tap any space to explore ${icon('arrow')}</span></div></section>
    <aside><section class="action-card" aria-live="polite" aria-atomic="true">${actionHTML()}</section><section class="portfolio"><div class="tabs"><button class="${panel === 'properties' ? 'selected' : ''}" data-panel="properties">Your properties <span>${owned(game,0).length}</span></button><button class="${panel === 'activity' ? 'selected' : ''}" data-panel="activity">City journal</button></div>${portfolioHTML()}</section><div class="tip"><span>✦</span><p><strong>Power move</strong>Own both properties in a color to double their rent and unlock upgrades.</p></div></aside></div>
    <footer><span>ONE CITY. ONE WINNER.</span><span>${game.limit} rounds · highest total wealth wins · auto-saved on this browser</span></footer></main></div>`;
  if (dialog.open && inspected !== null) inspect(inspected);
  if (focus?.panel) app.querySelector<HTMLElement>(`[data-panel="${focus.panel}"]`)?.focus({preventScroll:true});
}
function modal(content: string) {
  const d = document.querySelector<HTMLDialogElement>('#modal')!;
  d.innerHTML = `<button class="close-modal" data-action="close" aria-label="Close dialog">×</button>${content}`;
  if (!d.open) d.showModal();
  d.onclick = e => { if (e.target === d && e.offsetX >= 0 && e.offsetY >= 0) { const r = d.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) d.close(); } };
}
function welcome(restart = false) {
  inspected = null;
  modal(`<div class="modal-emblem">${icon('house')}</div><div class="eyebrow">BIG DEALS. BIGGER RIVALS.</div><h2>${restart ? 'A fresh start?' : 'Ready to own this city?'}</h2><p>${restart ? 'Starting a new game replaces your current saved match.' : 'Three rivals. Twelve properties. One city to conquer. Buy the best blocks and make everyone else pay rent.'}</p><div class="welcome-rules"><div><b>01</b><span><strong>Find your place</strong>Roll, explore, and buy the properties you land on.</span></div><div><b>02</b><span><strong>Build something bigger</strong>Complete color pairs, upgrade, and collect rent.</span></div><div><b>03</b><span><strong>Make your fortune</strong>Finish with the most cash + property value.</span></div></div><button class="primary" data-start="12">${restart ? 'Start fresh' : 'Let’s get rich'} · 12 rounds ${icon('arrow')}</button><button class="text-button full" data-start="20">Go for total domination · 20 rounds</button><p class="modal-footnote">You + 2 computer rivals · no account needed</p>`);
}
function help() {
  inspected = null;
  modal(`<div class="eyebrow">THE BOROUGH HANDBOOK</div><h2>A little local knowledge.</h2><div class="rules-copy"><p><strong>Your goal.</strong>Have the most wealth after ${game.limit} rounds. Each round gives every player one turn. Wealth is cash + original property prices + upgrade costs.</p><p><strong>Move & buy.</strong>Roll two dice and move clockwise. You may buy an unowned property you land on, or pass. Doubles do not give extra turns. Each lap earns $200.</p><p><strong>Build a neighborhood.</strong>Each color has two properties. Own both to double rent and unlock up to three upgrades per property. Each upgrade costs half the purchase price. Rent = base rent × set bonus × (1 + upgrades).</p><p><strong>Make a deal.</strong>Tap a rival’s property on your turn to see their asking price. Tap your own to upgrade or sell back to the city for 75% of its value, including upgrades.</p><p><strong>Life happens.</strong>City Post brings surprises; taxes cost $80; community spaces give $80. If you can’t pay a bill, your cheapest assets are automatically sold. If you still can’t pay, you’re bankrupt. The game ends if you go bankrupt or only one player remains.</p><p><strong>Play at your pace.</strong>Your match saves automatically on this browser. Sound is optional. Tap any board space to inspect it.</p></div><button class="primary" data-action="close">Got it ${icon('arrow')}</button><button class="text-button full" data-action="new" ${busy ? 'disabled' : ''}>Start a new game</button>`);
}
function showLeaderboard(rounds = game.limit) {
  inspected = null;
  const records = loadRecords().filter(r => r.rounds === rounds).sort((a, b) => b.scores[0] - a.scores[0] || b.date - a.date).slice(0, 10);
  const wins = records.filter(r => r.scores[0] > r.scores[1] && r.scores[0] > r.scores[2]).length;
  const draws = records.filter(r => r.scores[0] === Math.max(r.scores[1], r.scores[2])).length - wins;
  modal(`<div class="eyebrow">YOUR LOCAL RECORDS</div><h2>🏆 The borough’s best.</h2><p>Your top finishes against Cleo and Otto. Only completed matches count; cash and unsold properties are valued at their full price.</p><div class="leaderboard-tabs"><button class="${rounds === 12 ? 'selected' : ''}" data-leaderboard="12">12 rounds</button><button class="${rounds === 20 ? 'selected' : ''}" data-leaderboard="20">20 rounds</button></div><div class="leaderboard-summary"><strong>${records.length}</strong> ${records.length === 1 ? 'match' : 'matches'} saved <span>·</span> <strong>${wins}</strong> ${wins === 1 ? 'win' : 'wins'} <span>·</span> <strong>${draws}</strong> ${draws === 1 ? 'draw' : 'draws'}</div>${records.length ? `<div class="leaderboard-list">${records.map((r, i) => { const rivals = [r.scores[1], r.scores[2]]; const won = r.scores[0] > Math.max(...rivals); const tied = r.scores[0] === Math.max(...rivals); return `<div class="leaderboard-row"><span class="leaderboard-rank">${String(i+1).padStart(2,'0')}</span><span class="leaderboard-result"><strong>${won ? '🏆 You won' : tied ? '🤝 Shared first' : 'Match complete'}</strong><small>${new Date(r.date).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})} · ${escape(r.names[1])} ${money(r.scores[1])} · ${escape(r.names[2])} ${money(r.scores[2])}</small></span><strong class="leaderboard-score">${money(r.scores[0])}</strong></div>`; }).join('')}</div>` : `<div class="leaderboard-empty"><span>🎲</span><strong>Your first score is waiting.</strong><p>Finish a ${rounds}-round match to claim a spot on the board.</p></div>`}<p class="leaderboard-note">Separate boards keep short and long matches fair. Scores are saved on this browser only.</p><button class="primary" data-action="close">Back to the game ${icon('arrow')}</button>`);
}
function inspect(i: number) {
  inspected = i; const t = TILES[i], d = game.deeds[i], quote = tradePrice(game,i);
  const yourTurn = game.current === 0 && !busy && game.phase !== 'over';
  const set = t.group !== undefined && d.owner !== null && hasSet(game,d.owner,t.group);
  modal(`<div class="property-modal-band" style="background:${t.group !== undefined ? GROUPS[t.group].color : '#a7b99b'}"></div><div class="eyebrow">${t.group !== undefined ? GROUPS[t.group].name : 'AROUND THE BOROUGH'}</div><div class="property-art-showcase">${tileArt(i, 'property-picture')}</div><h2>${t.name}</h2>${t.kind === 'property' ? `<p>${d.owner === null ? 'An open lot, full of possibilities.' : `Owned by ${game.players[d.owner].name}. ${set ? 'Complete color set — double rent.' : 'Collect its color partner to double rent.'}`}</p><div class="property-numbers"><div><span>PROPERTY VALUE</span><strong>${money(t.price!)}</strong></div><div><span>CURRENT RENT</span><strong>${money(rentAt(game,i))}</strong></div><div><span>UPGRADES</span><strong>${d.level} / 3</strong></div></div><div class="rent-ladder">${[0,1,2,3].map(level=>`<div class="${d.level === level ? 'current' : ''}"><span>${level ? 'Level ' + level : 'Base'}</span><strong>${money(t.rent! * (set ? 2 : 1) * (level+1))}</strong></div>`).join('')}</div><p class="small-copy">${set ? 'Rent includes your full color set bonus.' : 'Upgrade rents shown with current set ownership. A full set is required to build.'}</p>${d.owner === 0 ? `<button class="primary" data-upgrade="${i}" ${!yourTurn || !set || d.level >= 3 || game.players[0].cash < upgradeCost(i) ? 'disabled' : ''}>${d.level >= 3 ? 'Fully upgraded' : !set ? 'Complete this color pair to upgrade' : `Upgrade · ${money(upgradeCost(i))}`}</button><button class="text-button full" data-sell="${i}" ${!yourTurn ? 'disabled' : ''}>Sell to city · ${money(saleValue(game,i))}</button>` : quote !== null ? `<button class="primary" data-trade="${i}" ${!yourTurn || game.players[0].cash < quote ? 'disabled' : ''}>Buy from ${game.players[d.owner!].name} · ${money(quote)}</button><p class="small-copy">A firm asking price. Rivals charge more for a completed color set.</p>` : `<p class="info-note">${game.players[0].pos === i && game.current === 0 && game.phase === 'buy' ? 'Close this card to buy this property.' : 'Land here to buy this property from the city.'}</p>`}${!yourTurn && game.phase !== 'over' ? '<p class="small-copy">You can manage and trade properties on your turn.</p>' : ''}` : `<p>${t.kind === 'start' ? 'Collect $200 each time you pass or land on Town Square.' : t.kind === 'event' ? 'A letter from the city: it might bring a grant, a repair bill, or a happy surprise.' : t.kind === 'tax' ? 'Pay $80 toward keeping the city running.' : t.kind === 'park' ? 'Take a breath. Nothing to pay, nothing to collect.' : 'Celebrate the neighborhood and collect an $80 bonus.'}</p><button class="primary" data-action="close">Back to the borough ${icon('arrow')}</button>`}`);
}
async function animateRoll() {
  const start = game.players[game.current].pos;
  roll(game); const steps = game.dice[0] + game.dice[1];
  moving = start; render(); await wait(220);
  for (let step = 1; step <= steps; step++) { moving = (start + step) % 24; render(); tone(250 + step * 28); await wait(90); }
  moving = null; save(); render();
}
async function runAI() {
  busy = true;
  while (game.current !== 0 && game.phase !== 'over') {
    if (game.phase === 'roll') { aiManage(game); render(); await wait(500); await animateRoll(); }
    await wait(650);
    if (game.phase === 'buy') { aiBuy(game); save(); render(); await wait(650); }
    if ((game as Game).phase === 'over') break;
    aiManage(game); endTurn(game); save(); render();
  }
  busy = false; save(); render();
}
document.addEventListener('click', async e => {
  const el = (e.target as HTMLElement).closest<HTMLElement>('button'); if (!el || el.hasAttribute('disabled')) return;
  const data = el.dataset;
  if (data.action === 'close') { document.querySelector<HTMLDialogElement>('#modal')?.close(); return; }
  if (data.action === 'sound') { sound = !sound; tone(); render(); return; }
  if (data.action === 'help') { help(); return; }
  if (data.action === 'scores') { showLeaderboard(); return; }
  if (data.leaderboard) { showLeaderboard(Number(data.leaderboard) as 12 | 20); return; }
  if (data.action === 'new' && !busy) { welcome(true); return; }
  if (data.start && !busy) { game = createGame(Number(data.start)); inspected = null; dialog.close(); save(); render(); tone(600); return; }
  if (data.tile !== undefined) { inspect(Number(data.tile)); return; }
  if (data.panel) { panel = data.panel as typeof panel; render(); return; }
  if (busy || game.current !== 0 || game.phase === 'over') return;
  if (data.upgrade !== undefined || data.sell !== undefined || data.trade !== undefined) {
    const i = Number(data.upgrade ?? data.sell ?? data.trade);
    const ok = data.upgrade !== undefined ? upgrade(game,i) : data.sell !== undefined ? sell(game,i) : trade(game,i);
    if (ok) { tone(620); save(); render(); if (data.sell === undefined) inspect(i); else dialog.close(); } return;
  }
  if (data.action === 'roll' && game.phase === 'roll') { busy = true; await animateRoll(); busy = false; render(); }
  if (data.action === 'buy' && buy(game)) { tone(660); save(); render(); }
  if (data.action === 'end' && endTurn(game)) { save(); render(); await runAI(); }
});
document.addEventListener('keydown', e => {
  if (e.code === 'Space' && !e.repeat && !busy && game.current === 0 && game.phase === 'roll' && !document.querySelector('dialog[open]') && !['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
    e.preventDefault(); app.querySelector<HTMLButtonElement>('[data-action="roll"]')?.click();
  }
});
render();
if (!resumed) welcome();
else if (game.current !== 0 && game.phase !== 'over') void runAI();
