import './style.css';
import { isInsideOneGpPlayer, OneGpLeaderboard, type BoardRun } from './leaderboard';

type Point = { x: number; y: number };
type Theme = { name: string; note: string; icon: string; color: string; easy: string[]; words: string[] };
type Level = { name: string; detail: string; size: number; count: number; directions: Point[] };

const themes: Theme[] = [
  { name: 'Garden stroll', note: 'petals & daydreams', icon: 'flower', color: '#237e70', easy: ['LEAF', 'RIVER', 'BLOOM', 'FERN', 'OCEAN', 'CEDAR', 'RAIN', 'MOSS'], words: ['WILDERNESS', 'MOUNTAIN', 'WILDFLOWER', 'EVERGREEN', 'WATERFALL', 'HORIZON', 'MEADOW', 'SEASONS', 'CANYON', 'MIGRATION', 'TIDELINE', 'MOONLIGHT'] },
  { name: 'Coffee break', note: 'a sip of happiness', icon: 'coffee', color: '#b45b32', easy: ['OLIVE', 'BASIL', 'BREAD', 'COFFEE', 'HONEY', 'LEMON', 'SPICE', 'PEAR'], words: ['SOURDOUGH', 'ROSEMARY', 'ESPRESSO', 'OLIVE', 'CITRUS', 'BASIL', 'CARAMEL', 'SAFFRON', 'BRUNCH', 'TRUFFLE', 'MARINADE', 'CINNAMON'] },
  { name: 'Creative corner', note: 'make a little magic', icon: 'palette', color: '#8750a3', easy: ['ART', 'MUSIC', 'POET', 'INK', 'NOVEL', 'DANCE', 'PAINT', 'FILM'], words: ['IMAGINATION', 'PERSPECTIVE', 'COMPOSITION', 'SYMPHONY', 'GALLERY', 'NOVELIST', 'CERAMIC', 'ARCHIVE', 'RHYTHM', 'PORTRAIT', 'INKWELL', 'MUSEUM'] },
  { name: 'Tiny wonders', note: 'curious little things', icon: 'robot', color: '#306eaf', easy: ['PIXEL', 'CODE', 'DATA', 'ROBOT', 'RADIO', 'LASER', 'SOLAR', 'CHIP'], words: ['ALGORITHM', 'SATELLITE', 'BANDWIDTH', 'ENCRYPTION', 'INTERFACE', 'QUANTUM', 'NETWORK', 'ROBOTICS', 'DATABASE', 'INNOVATION', 'WIRELESS', 'PROTOCOL'] },
  { name: 'Daydream trips', note: 'off we wander', icon: 'plane', color: '#ad4868', easy: ['KYOTO', 'PARIS', 'ROME', 'COAST', 'TRAIL', 'PLAZA', 'ISLAND', 'ATLAS'], words: ['LISBON', 'KYOTO', 'COPENHAGEN', 'MARRAKECH', 'HIGHLANDS', 'ARCHIPELAGO', 'PASSPORT', 'LANTERN', 'COASTLINE', 'TRAVERSE', 'TERRACE', 'MARKET'] },
  { name: 'Happy thoughts', note: 'words to keep', icon: 'heart', color: '#9471c6', easy: ['WONDER', 'CALM', 'GLOW', 'DREAM', 'HOPE', 'JOY', 'PEACE', 'GRACE'], words: ['SERENDIPITY', 'LUMINOUS', 'ELOQUENCE', 'WANDERLUST', 'EPHEMERAL', 'RESILIENT', 'MELLIFLUOUS', 'NOSTALGIA', 'AFTERGLOW', 'CURIOSITY', 'SOLITUDE', 'TRANQUIL'] },
];
const levels: Level[] = [
  { name: 'Easy peasy', detail: '4 short words', size: 8, count: 4, directions: [{ x: 1, y: 0 }, { x: 0, y: 1 }] },
  { name: 'A little twist', detail: '6 hidden words', size: 10, count: 6, directions: [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }] },
  { name: 'Feeling brave', detail: '8 tricky words', size: 10, count: 8, directions: [-1, 0, 1].flatMap(y => [-1, 0, 1].filter(x => x || y).map(x => ({ x, y }))) },
];
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const app = document.querySelector<HTMLDivElement>('#app')!;
let themeIndex = 0, levelIndex = 0;
let grid: string[][] = [], targets: string[] = [];
let placements = new Map<string, Point[]>(), found = new Map<string, Point[]>();
let activePath: Point[] = [], anchor: Point | null = null, hintPoint: Point | null = null;
let hintTimer = 0, feedbackTimer = 0;
let startedAt = 0, hintsUsed = 0;
const onlineBoard = isInsideOneGpPlayer() ? new OneGpLeaderboard() : null;
const leaderboardUrl = 'https://www.ai-made.games/games/word-find-6b0682c6/leaderboard?board=f8de4541-68e7-48ee-af68-ac37d6df6834';
let activeRound: BoardRun | null = null;

type ScoreCycle = { scores: number[]; total: number };
const cycleKey = 'word-find-score-cycle-v1';
const bestKey = 'word-find-best-cycle-v1';
function readCycle(): ScoreCycle {
  try {
    const value = JSON.parse(localStorage.getItem(cycleKey) || '{}') as { scores?: unknown[]; total?: unknown };
    const scores = value.scores ?? [];
    const normalized = Array.from({ length: levels.length }, (_, i) => Number.isSafeInteger(scores[i]) ? Math.max(0, Number(scores[i])) : 0);
    const total = Number.isSafeInteger(value.total) ? Math.max(0, Number(value.total)) : normalized.reduce((sum, score) => sum + score, 0);
    return { scores: normalized, total };
  } catch { return { scores: Array(levels.length).fill(0) as number[], total: 0 }; }
}
function writeCycle(cycle: ScoreCycle): void {
  try { localStorage.setItem(cycleKey, JSON.stringify(cycle)); } catch { /* Private browsing can disable storage. */ }
}
function saveBest(score: number): number {
  let best = score;
  try {
    best = Math.max(Number(localStorage.getItem(bestKey)) || 0, score);
    localStorage.setItem(bestKey, String(best));
  } catch { /* Private browsing can disable storage. */ }
  return best;
}
function readBest(): number {
  try { return Math.max(0, Number(localStorage.getItem(bestKey)) || 0); }
  catch { return 0; }
}
function roundScore(): number {
  const seconds = Math.floor((Date.now() - startedAt) / 1000);
  return Math.max(0, [400, 600, 800][levelIndex] + Math.max(0, 300 - seconds) - hintsUsed * 100);
}

const random = (max: number) => Math.floor(Math.random() * max);
const same = (a: Point, b: Point) => a.x === b.x && a.y === b.y;
function pathBetween(start: Point, end: Point): Point[] {
  const dx = end.x - start.x, dy = end.y - start.y;
  if (dx && dy && Math.abs(dx) !== Math.abs(dy)) return [];
  return Array.from({ length: Math.max(Math.abs(dx), Math.abs(dy)) + 1 }, (_, i) => ({ x: start.x + Math.sign(dx) * i, y: start.y + Math.sign(dy) * i }));
}
function buildGrid(): void {
  const level = levels[levelIndex], theme = themes[themeIndex];
  const source = (levelIndex ? theme.words : theme.easy).filter(word => word.length <= level.size);
  const previousKey = `word-find-last-puzzle-v1-${themeIndex}-${levelIndex}`;
  let previous: string[] = [];
  try { previous = JSON.parse(localStorage.getItem(previousKey) || '[]') as string[]; } catch { /* Ignore invalid saved puzzle state. */ }
  let shuffled = [...source];
  let signature = '';
  for (let retry = 0; retry < 20; retry++) {
    shuffled = [...source];
    for (let i = shuffled.length - 1; i > 0; i--) { const j = random(i + 1); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; }
    targets = shuffled.slice(0, level.count);
    signature = [...targets].sort().join('|');
    if (signature !== [...previous].sort().join('|')) break;
  }
  try { localStorage.setItem(previousKey, JSON.stringify(targets)); } catch { /* Private browsing can disable storage. */ }
  const ordered = [...targets].sort((a, b) => b.length - a.length);
  let complete = false;
  for (let retry = 0; retry < 30 && !complete; retry++) {
    grid = Array.from({ length: level.size }, () => Array(level.size).fill('') as string[]);
    placements = new Map();
    complete = ordered.every(word => {
      for (let attempt = 0; attempt < 800; attempt++) {
        const direction = level.directions[random(level.directions.length)];
        const start = { x: random(level.size), y: random(level.size) };
        const end = { x: start.x + direction.x * (word.length - 1), y: start.y + direction.y * (word.length - 1) };
        if (end.x < 0 || end.y < 0 || end.x >= level.size || end.y >= level.size) continue;
        const path = pathBetween(start, end);
        if (!path.every((point, i) => !grid[point.y][point.x] || grid[point.y][point.x] === word[i])) continue;
        path.forEach((point, i) => { grid[point.y][point.x] = word[i]; });
        placements.set(word, path);
        return true;
      }
      return false;
    });
  }
  if (!complete) {
    grid = Array.from({ length: level.size }, () => Array(level.size).fill('') as string[]);
    placements = new Map();
    targets.forEach((word, y) => {
      const path = pathBetween({ x: 0, y }, { x: word.length - 1, y });
      path.forEach((point, i) => { grid[point.y][point.x] = word[i]; });
      placements.set(word, path);
    });
  }
  grid = grid.map(row => row.map(letter => letter || alphabet[random(alphabet.length)]));
}
function icon(name: string): string {
  const icons: Record<string, string> = {
    flower: '<g fill="#f4a9c2"><circle cx="24" cy="9" r="9"/><circle cx="39" cy="20" r="9"/><circle cx="34" cy="38" r="9"/><circle cx="14" cy="38" r="9"/><circle cx="9" cy="20" r="9"/></g><circle cx="24" cy="24" r="9" fill="#ffd778"/>',
    coffee: '<path d="M8 14h29v19a12 12 0 0 1-12 12h-5A12 12 0 0 1 8 33z" fill="#f0b684"/><path d="M36 19h5a7 7 0 0 1 0 14h-5" fill="none" stroke="#b45b32" stroke-width="4"/><path d="M17 4l-2 6M29 3l-2 7" stroke="#b45b32" stroke-width="3" stroke-linecap="round"/>',
    palette: '<circle cx="24" cy="24" r="21" fill="#c8b5e9"/><circle cx="14" cy="15" r="4" fill="#f5a5bc"/><circle cx="29" cy="12" r="4" fill="#8dcabf"/><circle cx="37" cy="25" r="4" fill="#f5ca75"/><circle cx="17" cy="33" r="4" fill="#8fb9e2"/><circle cx="27" cy="29" r="5" fill="#f9f2fc"/>',
    robot: '<rect x="6" y="14" width="36" height="30" rx="10" fill="#92cbe0"/><circle cx="17" cy="28" r="3" fill="#554663"/><circle cx="31" cy="28" r="3" fill="#554663"/><path d="M24 14V6" stroke="#306eaf" stroke-width="3"/><circle cx="24" cy="5" r="4" fill="#f5c565"/>',
    plane: '<path d="M2 19L47 5 31 45 23 28 2 19Z" fill="#f0a0a7"/><path d="M23 28L47 5" stroke="#ad4868" stroke-width="2"/>',
    heart: '<path d="M24 44 5 25C-5 13 8-1 21 9l3 3 3-3C40-1 53 13 43 25L24 44Z" fill="#eea6bb"/>',
  };
  return `<svg viewBox="0 0 48 48" aria-hidden="true">${icons[name]}</svg>`;
}
function buddy(happy = false): string {
  return `<svg class="buddy ${happy ? 'buddy-happy' : ''}" viewBox="0 0 120 126" role="img" aria-label="Smiling peach word buddy"><ellipse cx="61" cy="108" rx="40" ry="8" fill="#e9ddeb"/><ellipse cx="42" cy="96" rx="13" ry="12" fill="#efb278"/><ellipse cx="81" cy="96" rx="13" ry="12" fill="#efb278"/><circle cx="24" cy="77" r="12" fill="#ffc98e"/><circle cx="99" cy="77" r="12" fill="#ffc98e"/><ellipse cx="61" cy="69" rx="43" ry="42" fill="#ffd5a2"/><ellipse cx="48" cy="43" rx="18" ry="7" fill="#ffe7c5"/><path d="M61 29 65 13" stroke="#5caa91" stroke-width="4" stroke-linecap="round"/><ellipse cx="55" cy="13" rx="13" ry="7" fill="#82ceb2" transform="rotate(18 55 13)"/><ellipse cx="76" cy="9" rx="14" ry="7" fill="#a4ddba" transform="rotate(-17 76 9)"/><ellipse cx="35" cy="79" rx="8" ry="5" fill="#f3a19b"/><ellipse cx="87" cy="79" rx="8" ry="5" fill="#f3a19b"/><g class="buddy-eyes"><ellipse cx="46" cy="68" rx="3" ry="5" fill="#554663"/><ellipse cx="76" cy="68" rx="3" ry="5" fill="#554663"/></g><path class="happy-eyes" d="M41 69q5-7 10 0m20 0q5-7 10 0" fill="none" stroke="#554663" stroke-width="3" stroke-linecap="round"/><path d="M55 78q6 9 12 0" fill="none" stroke="#554663" stroke-width="3" stroke-linecap="round"/></svg>`;
}
const header = () => '<header class="topbar"><button class="wordmark" id="wordmark">word find<span class="sparkle">✦</span></button><span class="top-note">a cozy little break</span></header>';
function renderHome(): void {
  clearTimeout(hintTimer); clearTimeout(feedbackTimer);
  const cycle = readCycle();
  const cycleTotal = cycle.total;
  const levelsPlayed = cycle.scores.filter(score => score > 0).length;
  app.innerHTML = `<main class="app-shell home-screen">${header()}<section class="hero"><div><h1>Little words.<br><span>Big smiles.</span></h1><p>Find a few words. Feel a little lighter.</p></div><div class="hero-buddy">${buddy()}<span class="hero-sparkle">✦</span></div></section><section class="home-themes"><h2>Where shall we wander?</h2><div class="theme-grid">${themes.map((theme, i) => `<button class="theme-card ${i === themeIndex ? 'selected' : ''}" data-theme="${i}" style="--accent:${theme.color}" aria-pressed="${i === themeIndex}"><span class="theme-icon">${icon(theme.icon)}</span><span class="theme-copy"><strong>${theme.name}</strong><small>${theme.note}</small></span>${i === themeIndex ? '<span class="theme-check">✓</span>' : ''}</button>`).join('')}</div></section><section class="home-levels"><h2>A little easy, or a little brave?</h2><div class="level-grid">${levels.map((level, i) => `<button class="level-card ${i === levelIndex ? 'selected' : ''}" data-level="${i}" aria-pressed="${i === levelIndex}"><strong>${level.name}</strong><small>${level.detail}</small></button>`).join('')}</div></section><p class="cycle-score">Current cycle: <strong>${cycleTotal}</strong> points · ${levelsPlayed}/${levels.length} difficulties scored</p><div class="home-action"><p>No rush. Your little word buddy is here.</p><button class="primary-button" id="start">Let's find some words! <span>→</span></button><small>a pocketful of words, a moment just for you</small></div></main>`;
  app.querySelectorAll<HTMLButtonElement>('[data-theme]').forEach(button => button.addEventListener('click', () => { themeIndex = Number(button.dataset.theme); renderHome(); }));
  app.querySelectorAll<HTMLButtonElement>('[data-level]').forEach(button => button.addEventListener('click', () => { levelIndex = Number(button.dataset.level); renderHome(); }));
  app.querySelector('#start')?.addEventListener('click', startPuzzle);
  app.querySelector('#wordmark')?.addEventListener('click', renderHome);
}
function startPuzzle(): void {
  buildGrid(); found = new Map(); activePath = []; anchor = null; hintPoint = null; hintsUsed = 0; startedAt = Date.now();
  activeRound = onlineBoard ? onlineBoard.beginRound(levelIndex) : null;
  renderGame();
}
function boardSvg(): string {
  const size = grid.length;
  const bubbles = grid.flatMap((row, y) => row.map((_, x) => `<circle cx="${x + .5}" cy="${y + .53}" r=".43" fill="#e9e1ef"/><circle cx="${x + .5}" cy="${y + .5}" r=".43" fill="${['#f4effa', '#fdf3eb', '#eef5f4'][(x + y) % 3]}"/>`)).join('');
  const ribbon = (path: Point[], color: string) => `<path d="M${path[0].x + .5} ${path[0].y + .5}L${path[path.length - 1].x + .5} ${path[path.length - 1].y + .5}" stroke="${color}" stroke-width=".82" stroke-linecap="round"/>`;
  const ribbons = targets.map((word, i) => found.has(word) ? ribbon(found.get(word)!, themes[i % themes.length].color) : '').join('');
  const hint = hintPoint ? `<circle cx="${hintPoint.x + .5}" cy="${hintPoint.y + .5}" r=".43" fill="#ffcf78" class="hint-glow"/>` : '';
  const active = activePath.length > 1 ? ribbon(activePath, '#bfa0ea') : '';
  return `<svg class="board-art" viewBox="0 0 ${size} ${size}" preserveAspectRatio="none" aria-hidden="true">${bubbles}${ribbons}${hint}${active}</svg>`;
}
function renderBoard(): void {
  const art = document.querySelector('.board-art'); if (art) art.outerHTML = boardSvg();
  document.querySelectorAll<HTMLButtonElement>('.cell').forEach(cell => {
    const point = { x: Number(cell.dataset.x), y: Number(cell.dataset.y) };
    cell.classList.toggle('found', [...found.values()].some(path => path.some(step => same(step, point))));
    cell.classList.toggle('active', activePath.some(step => same(step, point)));
  });
}
function renderGame(): void {
  const theme = themes[themeIndex], size = grid.length;
  const cycle = readCycle();
  const cycleTotal = cycle.total;
  const levelsPlayed = cycle.scores.filter(score => score > 0).length;
  app.innerHTML = `<main class="app-shell game-screen">${header()}<div class="game-head"><button class="back-button" id="back">← &nbsp;Wander back</button><div class="game-title"><div><h1>${theme.name}</h1><p id="feedback">${levelIndex === 0 ? "Across or down. You've got this!" : 'Follow the letters. Find a little joy.'}</p></div><div class="game-buddy">${buddy()}</div></div><div class="progress-row"><div class="progress-stars" id="stars">${targets.map(() => '<span>●</span>').join('')}</div><span id="found-count">0 / ${targets.length} little discoveries</span></div><p class="cycle-score">Current cycle: <strong>${cycleTotal}</strong> points · ${levelsPlayed}/${levels.length} difficulties scored</p></div><section class="board-wrap" aria-label="Word search puzzle"><div class="letter-grid" id="letter-grid" style="--size:${size}">${boardSvg()}${grid.flatMap((row, y) => row.map((letter, x) => `<button type="button" class="cell" data-x="${x}" data-y="${y}" aria-label="Row ${y + 1}, column ${x + 1}, ${letter}"><span>${letter}</span></button>`)).join('')}</div></section><section class="words-section"><h2>A pocketful of words</h2><div class="word-list" style="--word-rows:${Math.ceil(targets.length / 2)}">${targets.map((word, i) => `<span class="word-pill" data-word="${word}" style="--pill:${themes[i % themes.length].color}">${word}</span>`).join('')}</div></section><div class="game-foot"><button class="hint-button" id="hint">A tiny hint, please</button><span>Take your time ♡</span></div><div class="completion" id="completion" hidden></div></main>`;
  app.querySelector('#wordmark')?.addEventListener('click', renderHome);
  app.querySelector('#back')?.addEventListener('click', renderHome);
  app.querySelector('#hint')?.addEventListener('click', showHint);
  bindGrid();
}
function showHint(): void {
  const word = targets.find(item => !found.has(item)); if (!word) return;
  hintsUsed++;
  hintPoint = placements.get(word)![0];
  setFeedback(`Try ${word} — follow the golden glow!`, 4000);
  renderBoard(); clearTimeout(hintTimer);
  hintTimer = window.setTimeout(() => { hintPoint = null; renderBoard(); }, 4000);
}
function setFeedback(message: string, duration: number): void {
  const label = document.querySelector('#feedback'); if (label) label.textContent = message;
  clearTimeout(feedbackTimer);
  feedbackTimer = window.setTimeout(() => {
    const current = document.querySelector('#feedback');
    if (current) current.textContent = levelIndex === 0 ? "Across or down. You've got this!" : 'Follow the letters. Find a little joy.';
  }, duration);
}
function bindGrid(): void {
  const board = document.querySelector<HTMLElement>('#letter-grid')!;
  const pointAt = (clientX: number, clientY: number): Point | null => {
    const rect = board.getBoundingClientRect();
    if (clientX < rect.left || clientY < rect.top || clientX >= rect.right || clientY >= rect.bottom) return null;
    return { x: Math.min(grid.length - 1, Math.floor((clientX - rect.left) / rect.width * grid.length)), y: Math.min(grid.length - 1, Math.floor((clientY - rect.top) / rect.height * grid.length)) };
  };
  board.addEventListener('pointerdown', event => {
    const point = pointAt(event.clientX, event.clientY); if (!point) return;
    event.preventDefault(); board.setPointerCapture(event.pointerId);
    anchor = point; activePath = [point]; renderBoard();
  });
  board.addEventListener('pointermove', event => {
    if (!anchor) return; const point = pointAt(event.clientX, event.clientY); if (!point) return;
    const path = pathBetween(anchor, point); if (path.length) { activePath = path; renderBoard(); }
  });
  board.addEventListener('pointerup', event => {
    if (!anchor) return; const point = pointAt(event.clientX, event.clientY);
    if (point) { const path = pathBetween(anchor, point); if (path.length) activePath = path; }
    finishSelection();
  });
  board.addEventListener('pointercancel', () => { anchor = null; activePath = []; renderBoard(); });
}
function finishSelection(): void {
  if (!anchor) return;
  const candidate = activePath.map(point => grid[point.y][point.x]).join('');
  const word = targets.find(item => !found.has(item) && (item === candidate || item === [...candidate].reverse().join('')));
  if (word) {
    found.set(word, word === candidate ? [...activePath] : [...activePath].reverse());
    hintPoint = null; clearTimeout(hintTimer);
    const pill = Array.from(document.querySelectorAll<HTMLElement>('.word-pill')).find(item => item.dataset.word === word);
    if (pill) { pill.classList.add('done'); pill.textContent = `✓  ${word}`; }
    document.querySelector('#found-count')!.textContent = `${found.size} / ${targets.length} little discoveries`;
    document.querySelectorAll('#stars span').forEach((star, i) => { if (i < found.size) { star.textContent = '✦'; star.classList.add('lit'); } });
    setFeedback(['Lovely find!', 'You spotted it!', 'A little bit of magic!', 'Look at you go!'][found.size % 4], 2500);
    document.querySelector('.game-buddy .buddy')?.classList.add('buddy-happy');
    window.setTimeout(() => document.querySelector('.game-buddy .buddy')?.classList.remove('buddy-happy'), 2500);
  }
  anchor = null; activePath = []; renderBoard();
  if (word && found.size === targets.length) showCompletion();
}
function showCompletion(): void {
  const panel = document.querySelector<HTMLElement>('#completion')!;
  panel.hidden = false;
  const score = roundScore();
  const cycle = readCycle();
  cycle.scores[levelIndex] = Math.max(cycle.scores[levelIndex]!, score);
  cycle.total += score;
  const completeCycle = cycle.scores.every(value => value > 0);
  const total = cycle.total;
  const best = completeCycle ? saveBest(total) : readBest();
  // Keep even a completed cycle until the leaderboard accepts it. If submission
  // fails, the saved score remains available for another attempt.
  if (!completeCycle || onlineBoard) writeCycle(cycle);
  else writeCycle({ scores: Array(levels.length).fill(0) as number[], total: 0 });
  const remaining = levels.map((item, index) => cycle.scores[index] ? '' : item.name).filter(Boolean);
  const displayScore = total;
  const totalLabel = completeCycle ? `cycle points · best ${best}` : `cycle total · ${remaining.length} difficulty${remaining.length === 1 ? '' : 'ies'} left`;
  panel.innerHTML = `<div class="complete-card"><span class="complete-sparkle left">✦</span>${buddy(true)}<span class="complete-sparkle right">✦</span><h2>You found them all!</h2><p>A little victory for your day.</p><div class="score-card"><strong>${displayScore}</strong><span>${totalLabel}</span></div><p class="online-status" id="online-status" role="status">${onlineBoard ? 'Saving your accumulated points to the leaderboard…' : (completeCycle ? 'Your best cycle is saved on this device.' : `Level score ${score}. Best per difficulty is kept for your current cycle.`)}</p><button class="retry-score" id="retry-score" hidden>Try saving again</button>${onlineBoard ? `<a class="leaderboard-link" href="${leaderboardUrl}" target="_blank" rel="noopener">See the leaderboard ↗</a>` : ''}<button class="primary-button" id="again">One more little adventure <span>→</span></button><button class="complete-home" id="complete-home">Back to the collections</button></div>`;
  panel.querySelector('#again')?.addEventListener('click', startPuzzle);
  panel.querySelector('#complete-home')?.addEventListener('click', renderHome);
  if (onlineBoard && activeRound) {
    const round = activeRound;
    const status = panel.querySelector<HTMLElement>('#online-status')!;
    const retry = panel.querySelector<HTMLButtonElement>('#retry-score')!;
    const submit = async () => {
      retry.hidden = true;
      status.textContent = 'Saving to the leaderboard…';
      try {
        const receipt = await onlineBoard.settleRound(round, total);
        if (completeCycle) {
          const current = readCycle();
          if (current.total === total && current.scores.every((value, index) => value === cycle.scores[index])) {
            writeCycle({ scores: Array(levels.length).fill(0) as number[], total: 0 });
          }
        }
        status.textContent = receipt.rank ? `Saved! Your rank: #${receipt.rank}` : `Accumulated ${total} points saved to the leaderboard.`;
      } catch {
        status.textContent = 'Could not connect. Your best is saved on this device.';
        retry.hidden = false;
      }
    };
    retry.addEventListener('click', () => { void submit(); });
    void submit();
  }
}
renderHome();
