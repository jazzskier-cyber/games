import { getStage, type RouteStyle, type Stage } from './stages';

export const WIDTH = 960;
export const HEIGHT = 600;
export const FLOOR = 1320;
export const STEP = 90;
export const LEVELS = 10;
export const GRAVITY = 1150;
export const JUMP = -535;
export const SPEED = 240;
export interface Platform { x: number; y: number; w: number; breakable: boolean; alive: boolean; row: number; kind?: 'bounce' | 'drift' | 'crumble'; baseX?: number; phase?: number; crumbleTime?: number; respawnTime?: number }
export interface Crystal { x: number; y: number; taken: boolean }
export interface Meteor { x: number; y: number; age: number; vy: number; state: 'warning' | 'falling'; alive: boolean }
export type ItemKind = 'feather' | 'shield' | 'magnet';
export interface Item { x: number; y: number; kind: ItemKind; taken: boolean }
export function makeWorld(stage: Stage = getStage(1), runSeed = 1) {
  const platforms: Platform[] = [{ x: 75, y: stage.floor, w: 810, breakable: false, alive: true, row: 0 }];
  const crystals: Crystal[] = [];
  let seed = (stage.number * 719 + 173 + runSeed) >>> 0;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const routeOffset = (route: RouteStyle, row: number, phase: number) => {
    const n = row + phase;
    switch (route) {
      case 'zigzag': return (row % 2 ? 1 : -1) * .68 + Math.sin(n * 1.7) * .18;
      case 'crescent': return Math.sin(n * .62) * .82 + Math.sin(n * 1.13) * .12;
      case 'switchback': return Math.sin(n * 1.38) * .64 + Math.sin(n * .43) * .26;
      case 'spiral': return Math.sin(n * .78) * .72 + Math.cos(n * .36) * .24;
      case 'stepping': return ([ -.72, -.28, .30, .74 ][(row + Math.floor(phase)) % 4]) + Math.sin(n) * .1;
      case 'drift': return Math.sin(n * .38) * .78 + Math.sin(n * 1.22) * .16;
      case 'cloud-hop': return Math.cos(n * .92) * .65 + Math.sin(n * .47) * .3;
    }
  };
  let previousCenter = 480;
  const positions = stage.number === 1 ? [170, 330, 490, 340, 190, 360, 520, 360, 200, 380].map((x, i) => i < 2 ? x : Math.round(Math.max(50, Math.min(WIDTH - stage.width - 50, x + (random() - .5) * 110)))) : Array.from({ length: stage.islands }, (_, i) => {
    const amplitude = stage.difficulty === 'H' ? 132 : 185;
    const desired = 480 + routeOffset(stage.route, i + 1, stage.number * .31 + runSeed * .001) * amplitude + (random() - .5) * 52;
    const maxShift = stage.difficulty === 'H' ? 112 : 138;
    const center = Math.max(previousCenter - maxShift, Math.min(previousCenter + maxShift, desired));
    previousCenter = center;
    return Math.round(Math.max(52, Math.min(WIDTH - 52 - stage.width, center - stage.width / 2)));
  });
  positions.forEach((x, i) => {
    const row = i + 1, y = stage.floor - row * stage.step, w = row === stage.islands ? 300 : stage.width;
    const kind = row === stage.islands ? undefined : stage.gimmick === 'bounce' && row % 3 === 0 ? 'bounce'
      : stage.gimmick === 'drift' && row % 2 === 0 ? 'drift'
      : stage.gimmick === 'crumble' && row % 2 === 0 ? 'crumble' : undefined;
    platforms.push({ x, y, w, breakable: false, alive: true, row, ...(kind ? { kind, baseX: x, phase: row * .92 } : {}) });
    crystals.push({ x: x + w / 2, y: y - 33, taken: false });
    if (row >= 4 && row < stage.islands && row % (stage.difficulty === 'E' ? 2 : 3) === 0) {
      // Optional crystal outcrops never remove the main route when smashed.
      platforms.push({ x: x + 40, y: y - 62, w: 46, breakable: true, alive: true, row });
      crystals.push({ x: x + 63, y: y - 94, taken: false });
    }
  });
  return { platforms, crystals };
}
export function canLand(oldBottom: number, newBottom: number, x: number, halfWidth: number, p: Platform) {
  return p.alive && oldBottom <= p.y + .5 && newBottom >= p.y && x + halfWidth > p.x && x - halfWidth < p.x + p.w;
}
export function clampX(x: number) { return Math.max(25, Math.min(WIDTH - 25, x)); }
export interface Input { direction: number; jump: boolean; attack: boolean; item?: boolean }
export type Event = { type: 'jump' | 'land' | 'checkpoint' | 'collect' | 'break' | 'rescue' | 'enemy' | 'meteor-warning' | 'meteor-fall' | 'meteor-land' | 'meteor-hit' | 'item-pickup' | 'item-feather' | 'item-shield' | 'item-magnet' | 'item-block' | 'bounce' | 'crumble-warning' | 'crumble' | 'regrow' | 'win' | 'game-over'; x: number; y: number; cause?: 'fall' | 'meteor' };
export class Journey {
  stage: Stage;
  platforms: Platform[];
  crystals: Crystal[];
  enemies: { x: number; y: number; row: number; phase: number; alive: boolean }[];
  meteors: Meteor[] = [];
  x = 285; y = FLOOR - 22; vx = 0; vy = 0;
  cameraY = FLOOR - HEIGHT + 95;
  checkpoint = { x: 285, y: FLOOR - 22, row: 0 };
  grounded = true; coyote = .14; jumpBuffer = 0;
  score = 0; collected = 0; highest = 0; currentRow = 0; rescues = 0;
  readonly runSeed: number;
  readonly endless: boolean;
  rescueLives = 3;
  elapsed = 0; invincible = 0; attackTime = 0; attackCooldown = 0;
  items: Item[] = []; itemInventory: ItemKind | null = null; shieldTime = 0; magnetTime = 0;
  facing = 1; won = false; events: Event[] = [];
  private wasJump = false; private wasAttack = false; private wasItem = false;
  private nextMeteorAt: number;
  private meteorCount = 0;
  private generatedThrough: number;
  constructor(stageNumber = 1, runSeed = 1, endless = false) {
    this.runSeed = runSeed; this.endless = endless;
    this.stage = getStage(stageNumber);
    this.nextMeteorAt = this.stage.meteorInterval ?? Number.POSITIVE_INFINITY;
    const generated = makeWorld(this.stage, runSeed);
    this.platforms = generated.platforms; this.crystals = generated.crystals;
    this.generatedThrough = this.stage.islands;
    const kinds: ItemKind[] = ['feather', 'shield', 'magnet'];
    this.items = this.platforms.filter(p => !p.breakable && p.row > 1 && p.row < this.stage.islands && p.row % 3 === 0)
      .map((p, i) => ({ x: p.x + p.w / 2, y: p.y - 52, kind: kinds[Math.floor((runSeed + this.stage.number + i) % kinds.length)], taken: false }));
    const first = this.platforms.find(p => p.row === 1)!;
    const last = this.platforms.find(p => p.row === this.stage.islands)!;
    this.x = endless ? last.x + last.w / 2 : stageNumber === 1 ? 285 : first.x + first.w / 2;
    this.y = endless ? last.y - 22 : this.stage.floor - 22; this.cameraY = endless ? last.y - HEIGHT + 95 : this.stage.floor - HEIGHT + 95;
    this.checkpoint = { x: this.x, y: this.y, row: 0 };
    if (endless) { this.highest = last.row; this.currentRow = last.row; this.checkpoint.row = last.row; }
    const start = this.stage.difficulty === 'E' ? 7 : this.stage.difficulty === 'M' ? 4 : 3;
    this.enemies = this.platforms.filter(p => !p.breakable && p.row >= start && p.row < this.stage.islands && (p.row - start) % 2 === 0)
      .map((p, i) => ({ x: p.x + p.w / 2, y: p.y - 25, row: p.row, phase: i * 2 + stageNumber, alive: true }));
  }
  get wind() { return this.stage.wind * Math.sin(this.elapsed * .85 + this.stage.number); }
  get nextRow() { return this.endless ? this.currentRow + 1 : Math.min(this.stage.islands, this.currentRow + 1); }
  releaseInput() { this.wasJump = false; this.wasAttack = false; this.wasItem = false; this.jumpBuffer = 0; this.vx = 0; }
  private emit(type: Event['type'], x = this.x, y = this.y, cause?: Event['cause']) { this.events.push({ type, x, y, ...(cause ? { cause } : {}) }); }
  rescue(cause: Event['cause'] = 'fall') {
    if (this.invincible > 0 || this.won) return;
    if (this.endless && this.rescueLives <= 0) { this.emit('game-over', this.x, this.y, cause); return; }
    if (this.endless) this.rescueLives--;
    this.rescues++; this.x = this.checkpoint.x; this.y = this.checkpoint.y;
    this.currentRow = this.checkpoint.row;
    this.vx = this.vy = 0; this.grounded = true; this.invincible = 2;
    this.cameraY = Math.min(this.stage.floor - HEIGHT + 95, this.y - 390);
    this.emit('rescue', this.x, this.y, cause);
  }
  private stepMeteors(dt: number) {
    const interval = this.stage.meteorInterval;
    if (interval && this.elapsed >= this.nextMeteorAt) {
      const offsets = [160, -160, 230, -230];
      let x = clampX(this.x + offsets[this.meteorCount % offsets.length]);
      for (let attempt = 1; attempt < offsets.length && Math.abs(x - this.x) < 72; attempt++) {
        x = clampX(this.x + offsets[(this.meteorCount + attempt) % offsets.length]);
      }
      this.meteors.push({ x, y: this.cameraY + 38, age: 0, vy: 0, state: 'warning', alive: true });
      this.emit('meteor-warning', x, this.cameraY + 38);
      this.meteorCount++;
      this.nextMeteorAt += interval;
    }
    for (const meteor of this.meteors) {
      if (!meteor.alive) continue;
      if (meteor.state === 'warning') {
        meteor.age += dt;
        if (meteor.age >= 1.4) {
          meteor.state = 'falling'; meteor.y = this.cameraY + 24; meteor.vy = 170;
          this.emit('meteor-fall', meteor.x, meteor.y);
        }
        continue;
      }
      const oldY = meteor.y;
      meteor.vy += 720 * dt; meteor.y += meteor.vy * dt;
      if (this.invincible <= 0 && Math.abs(meteor.x - this.x) < 34 && Math.abs(meteor.y - this.y) < 38) {
        meteor.alive = false; this.emit('meteor-hit', meteor.x, meteor.y);
        if (this.shieldTime > 0) { this.shieldTime = 0; this.emit('item-block', meteor.x, meteor.y); }
        else this.rescue('meteor');
        continue;
      }
      const landed = this.platforms.some(p => p.alive && meteor.x >= p.x - 12 && meteor.x <= p.x + p.w + 12 && oldY < p.y && meteor.y >= p.y);
      if (landed) { meteor.alive = false; this.emit('meteor-land', meteor.x, meteor.y); continue; }
      if (meteor.y > this.cameraY + HEIGHT + 40) meteor.alive = false;
    }
    this.meteors = this.meteors.filter(meteor => meteor.alive);
  }
  step(input: Input, dt: number) {
    this.events = [];
    if (this.won) return;
    dt = Math.min(dt, 1 / 30);
    this.elapsed += dt; this.invincible = Math.max(0, this.invincible - dt);
    this.attackTime = Math.max(0, this.attackTime - dt); this.attackCooldown -= dt;
    const ride = this.grounded ? this.platforms.find(p => p.alive && !p.breakable && Math.abs(p.y - (this.y + 22)) < 1 && this.x + 19 > p.x && this.x - 19 < p.x + p.w) : undefined;
    const rideX = ride?.x;
    for (const p of this.platforms) {
      if (p.kind === 'drift' && p.baseX !== undefined) p.x = Math.max(24, Math.min(WIDTH - p.w - 24, p.baseX + Math.sin(this.elapsed * .85 + (p.phase ?? 0)) * 74));
      if (p.crumbleTime !== undefined && p.alive) {
        p.crumbleTime -= dt;
        if (p.crumbleTime <= 0) { p.alive = false; p.respawnTime = 3; this.emit('crumble', p.x + p.w / 2, p.y); }
      } else if (!p.alive && p.respawnTime !== undefined) {
        p.respawnTime -= dt;
        if (p.respawnTime <= 0) {
          p.alive = true; delete p.respawnTime; delete p.crumbleTime;
          this.emit('regrow', p.x + p.w / 2, p.y);
        }
      }
    }
    if (ride && rideX !== undefined) this.x = clampX(this.x + ride.x - rideX);
    this.coyote = this.grounded ? .14 : this.coyote - dt;
    this.jumpBuffer -= dt;
    if (input.jump && !this.wasJump) this.jumpBuffer = .18;
    if (input.attack && !this.wasAttack && this.attackCooldown <= 0) { this.attackTime = .25; this.attackCooldown = .36; }
    if (input.item && !this.wasItem && this.itemInventory) {
      const used = this.itemInventory; this.itemInventory = null;
      if (used === 'feather') { this.vy = -650; this.grounded = false; this.coyote = 0; this.invincible = Math.max(this.invincible, .55); this.emit('item-feather'); }
      if (used === 'shield') { this.shieldTime = 8; this.emit('item-shield'); }
      if (used === 'magnet') { this.magnetTime = 8; this.emit('item-magnet'); }
    }
    this.wasJump = input.jump; this.wasAttack = input.attack; this.wasItem = !!input.item;
    this.shieldTime = Math.max(0, this.shieldTime - dt); this.magnetTime = Math.max(0, this.magnetTime - dt);
    if (this.jumpBuffer > 0 && this.coyote > 0) {
      this.vy = JUMP; this.grounded = false; this.coyote = this.jumpBuffer = 0; this.emit('jump');
    }
    this.vx += (input.direction * SPEED - this.vx) * Math.min(1, dt * 18);
    if (input.direction) this.facing = input.direction;
    this.x = clampX(this.x + (this.vx + (this.grounded ? 0 : this.wind)) * dt);
    const oldY = this.y;
    this.vy += GRAVITY * dt; this.y += this.vy * dt;
    const wasGrounded = this.grounded; this.grounded = false;
    for (const p of this.platforms) {
      if (!p.alive) continue;
      if (p.breakable && this.attackTime > 0 && Math.abs(p.x + p.w / 2 - this.x) < 82 && Math.abs(p.y - this.y + 25) < 82) {
        p.alive = false; this.score += 50; this.emit('break', p.x + p.w / 2, p.y); continue;
      }
      if (this.vy >= 0 && canLand(oldY + 22, this.y + 22, this.x, 19, p)) {
        this.y = p.y - 22; this.vy = 0; this.grounded = true;
        this.currentRow = p.row;
        if (!wasGrounded) this.emit('land');
        if (p.kind === 'bounce') { this.vy = -710; this.grounded = false; this.emit('bounce', this.x, p.y); }
        if (p.kind === 'crumble' && p.crumbleTime === undefined) { p.crumbleTime = 1.05; this.emit('crumble-warning', this.x, p.y); }
        if (!p.breakable && p.row > this.highest) this.highest = p.row;
        if (!p.breakable && p.kind !== 'crumble' && p.row > this.checkpoint.row) {
          this.checkpoint = { x: Math.max(p.x + 35, Math.min(p.x + p.w - 35, this.x)), y: this.y, row: p.row };
          this.emit('checkpoint', p.x + p.w - 24, p.y - 20);
        }
        if (!this.endless && !p.breakable && p.row === this.stage.islands) { this.won = true; this.score += this.stage.bonus; this.emit('win'); }
      } else if (p.breakable && this.vy < 0 && oldY - 18 >= p.y + 25 && this.y - 18 <= p.y + 25 && this.x + 19 > p.x && this.x - 19 < p.x + p.w) {
        this.y = p.y + 43; this.vy = 20;
      }
    }
    this.cameraY = Math.min(this.cameraY, this.y - 375);
    for (const item of this.items) if (!item.taken && Math.abs(item.x - this.x) < 37 && Math.abs(item.y - this.y) < 45) {
      item.taken = true; this.itemInventory = item.kind; this.emit('item-pickup', item.x, item.y);
    }
    for (const c of this.crystals) if (!c.taken && (Math.abs(c.x - this.x) < 41 && Math.abs(c.y - this.y) < 48 || this.magnetTime > 0 && Math.hypot(c.x - this.x, c.y - this.y) < 175)) {
      c.taken = true; this.collected++; this.score += 100; this.emit('collect', c.x, c.y);
    }
    for (const e of this.enemies) {
      const p = this.platforms.find(p => !p.breakable && p.row === e.row)!;
      e.x = p.x + p.w / 2 + Math.sin(this.elapsed * this.stage.enemySpeed + e.phase) * Math.min(65, p.w / 2 - 25);
      if (!e.alive) continue;
      if (this.attackTime > 0 && Math.abs(e.x - this.x) < 90 && Math.abs(e.y - this.y) < 75) {
        e.alive = false; this.score += 100; this.emit('enemy', e.x, e.y);
      } else if (Math.abs(e.x - this.x) < 33 && Math.abs(e.y - this.y) < 33) {
        if (this.shieldTime > 0) { this.shieldTime = 0; e.alive = false; this.emit('item-block', e.x, e.y); }
        else this.rescue();
      }
    }
    this.stepMeteors(dt);
    if (this.y > this.cameraY + HEIGHT + 55) this.rescue();
    if (this.endless) this.extendEndlessWorld();
  }
  private extendEndlessWorld() {
    const targetRow = this.highest + 9;
    for (let row = this.generatedThrough + 1; row <= targetRow; row++) {
      const difficulty = Math.min(1, .28 + row * .008);
      const width = Math.max(112, 194 - Math.floor(row / 8) * 8);
      const previous = this.platforms.find(p => p.row === row - 1 && !p.breakable)!;
      const seed = (this.runSeed + row * 2654435761) >>> 0;
      const random = (seed % 10000) / 10000;
      const side = random < .5 ? -1 : 1;
      const offset = side * (68 + random * 48);
      const x = Math.round(Math.max(34, Math.min(WIDTH - width - 34, previous.x + previous.w / 2 + offset - width / 2)));
      const kindRoll = (seed >>> 8) % 10;
      const kind: Platform['kind'] = kindRoll < 2 ? 'bounce' : kindRoll < 4 ? 'drift' : kindRoll < 6 ? 'crumble' : undefined;
      const platform: Platform = { x, y: previous.y - (96 + Math.floor(difficulty * 8)), w: width, breakable: false, alive: true, row, ...(kind ? { kind, baseX: x, phase: row * .92 } : {}) };
      this.platforms.push(platform);
      this.crystals.push({ x: x + width / 2, y: platform.y - 33, taken: false });
      if (row % 3 === 0) this.items.push({ x: x + width / 2, y: platform.y - 52, kind: (['feather', 'shield', 'magnet'] as ItemKind[])[(seed >>> 16) % 3]!, taken: false });
      if (random > .66) this.enemies.push({ x: x + width / 2, y: platform.y - 25, row, phase: row * .7, alive: true });
      if ((seed >>> 24) % 12 === 0) {
        const meteorX = clampX(x + width / 2 + side * 120);
        this.meteors.push({ x: meteorX, y: this.cameraY + 38, age: 0, vy: 0, state: 'warning', alive: true });
        this.emit('meteor-warning', meteorX, this.cameraY + 38);
      }
      this.generatedThrough = row;
    }
    const keepFrom = Math.max(0, this.highest - 18);
    if (keepFrom > 0) {
      this.platforms = this.platforms.filter(p => p.row === 0 || p.row >= keepFrom);
      this.crystals = this.crystals.filter(c => c.y >= this.checkpoint.y - 1800);
      this.items = this.items.filter(item => item.y >= this.checkpoint.y - 1800);
      this.enemies = this.enemies.filter(enemy => enemy.row >= keepFrom);
    }
  }
}
