import { getStage, type Stage } from './stages';

export const WIDTH = 960;
export const HEIGHT = 600;
export const FLOOR = 1320;
export const STEP = 90;
export const LEVELS = 10;
export const GRAVITY = 1150;
export const JUMP = -535;
export const SPEED = 240;
export interface Platform { x: number; y: number; w: number; breakable: boolean; alive: boolean; row: number }
export interface Crystal { x: number; y: number; taken: boolean }
export function makeWorld(stage: Stage = getStage(1)) {
  const platforms: Platform[] = [{ x: 75, y: stage.floor, w: 810, breakable: false, alive: true, row: 0 }];
  const crystals: Crystal[] = [];
  let seed = stage.number * 719 + 173;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const positions = stage.number === 1 ? [170, 330, 490, 340, 190, 360, 520, 360, 200, 380] : Array.from({ length: stage.islands }, (_, i) => {
    const center = 480 + Math.sin((i + stage.number * .7) * 1.12) * (stage.difficulty === 'H' ? 140 : 170) + (random() - .5) * 26;
    return Math.round(center - stage.width / 2);
  });
  positions.forEach((x, i) => {
    const row = i + 1, y = stage.floor - row * stage.step, w = row === stage.islands ? 300 : stage.width;
    platforms.push({ x, y, w, breakable: false, alive: true, row });
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
export interface Input { direction: number; jump: boolean; attack: boolean }
export type Event = { type: 'jump' | 'land' | 'checkpoint' | 'collect' | 'break' | 'rescue' | 'enemy' | 'win'; x: number; y: number };
export class Journey {
  stage: Stage;
  platforms: Platform[];
  crystals: Crystal[];
  enemies: { x: number; y: number; row: number; phase: number; alive: boolean }[];
  x = 285; y = FLOOR - 22; vx = 0; vy = 0;
  cameraY = FLOOR - HEIGHT + 95;
  checkpoint = { x: 285, y: FLOOR - 22, row: 0 };
  grounded = true; coyote = .14; jumpBuffer = 0;
  score = 0; collected = 0; highest = 0; rescues = 0;
  elapsed = 0; invincible = 0; attackTime = 0; attackCooldown = 0;
  facing = 1; won = false; events: Event[] = [];
  private wasJump = false; private wasAttack = false;
  constructor(stageNumber = 1) {
    this.stage = getStage(stageNumber);
    const generated = makeWorld(this.stage);
    this.platforms = generated.platforms; this.crystals = generated.crystals;
    const first = this.platforms.find(p => p.row === 1)!;
    this.x = stageNumber === 1 ? 285 : first.x + first.w / 2;
    this.y = this.stage.floor - 22; this.cameraY = this.stage.floor - HEIGHT + 95;
    this.checkpoint = { x: this.x, y: this.y, row: 0 };
    const start = this.stage.difficulty === 'E' ? 7 : this.stage.difficulty === 'M' ? 4 : 3;
    this.enemies = this.platforms.filter(p => !p.breakable && p.row >= start && p.row < this.stage.islands && (p.row - start) % 2 === 0)
      .map((p, i) => ({ x: p.x + p.w / 2, y: p.y - 25, row: p.row, phase: i * 2 + stageNumber, alive: true }));
  }
  get wind() { return this.stage.wind * Math.sin(this.elapsed * .85 + this.stage.number); }
  releaseInput() { this.wasJump = false; this.wasAttack = false; this.jumpBuffer = 0; this.vx = 0; }
  private emit(type: Event['type'], x = this.x, y = this.y) { this.events.push({ type, x, y }); }
  rescue() {
    if (this.invincible > 0 || this.won) return;
    this.rescues++; this.x = this.checkpoint.x; this.y = this.checkpoint.y;
    this.vx = this.vy = 0; this.grounded = true; this.invincible = 2;
    this.cameraY = Math.min(this.stage.floor - HEIGHT + 95, this.y - 390);
    this.emit('rescue');
  }
  step(input: Input, dt: number) {
    this.events = [];
    if (this.won) return;
    dt = Math.min(dt, 1 / 30);
    this.elapsed += dt; this.invincible = Math.max(0, this.invincible - dt);
    this.attackTime = Math.max(0, this.attackTime - dt); this.attackCooldown -= dt;
    this.coyote = this.grounded ? .14 : this.coyote - dt;
    this.jumpBuffer -= dt;
    if (input.jump && !this.wasJump) this.jumpBuffer = .18;
    if (input.attack && !this.wasAttack && this.attackCooldown <= 0) { this.attackTime = .25; this.attackCooldown = .36; }
    this.wasJump = input.jump; this.wasAttack = input.attack;
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
        if (!wasGrounded) this.emit('land');
        if (!p.breakable && p.row > this.checkpoint.row) {
          this.checkpoint = { x: Math.max(p.x + 35, Math.min(p.x + p.w - 35, this.x)), y: this.y, row: p.row };
          this.highest = p.row;
          this.emit('checkpoint', p.x + p.w - 24, p.y - 20);
        }
        if (!p.breakable && p.row === this.stage.islands) { this.won = true; this.score += this.stage.bonus; this.emit('win'); }
      } else if (p.breakable && this.vy < 0 && oldY - 18 >= p.y + 25 && this.y - 18 <= p.y + 25 && this.x + 19 > p.x && this.x - 19 < p.x + p.w) {
        this.y = p.y + 43; this.vy = 20;
      }
    }
    this.cameraY = Math.min(this.cameraY, this.y - 375);
    for (const c of this.crystals) if (!c.taken && Math.abs(c.x - this.x) < 41 && Math.abs(c.y - this.y) < 48) {
      c.taken = true; this.collected++; this.score += 100; this.emit('collect', c.x, c.y);
    }
    for (const e of this.enemies) {
      const p = this.platforms.find(p => !p.breakable && p.row === e.row)!;
      e.x = p.x + p.w / 2 + Math.sin(this.elapsed * this.stage.enemySpeed + e.phase) * Math.min(65, p.w / 2 - 25);
      if (!e.alive) continue;
      if (this.attackTime > 0 && Math.abs(e.x - this.x) < 90 && Math.abs(e.y - this.y) < 75) {
        e.alive = false; this.score += 100; this.emit('enemy', e.x, e.y);
      } else if (Math.abs(e.x - this.x) < 33 && Math.abs(e.y - this.y) < 33) this.rescue();
    }
    if (this.y > this.cameraY + HEIGHT + 55) this.rescue();
  }
}
