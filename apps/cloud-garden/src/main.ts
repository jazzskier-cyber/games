import Phaser from 'phaser';
import './style.css';
import './map.css';
import { WIDTH, HEIGHT, Journey, type Platform, type Event } from './world';
import { STAGES, DIFFICULTY_NAMES, getStage, nextStage, readCampaign, completeStage } from './stages';

const el = (id: string) => document.getElementById(id)!;
const button = (id: string) => el(id) as HTMLButtonElement;
const touch = { left: false, right: false, jump: false, attack: false };
// Vite's relative base keeps the same build deployable under a subdirectory.
const assetBase = new URL('./assets/', document.baseURI);
let sound = false;
let audio: AudioContext | undefined;
let campaign = readCampaign(null);
try {
  const raw = localStorage.getItem('cloud-garden-campaign');
  campaign = readCampaign(raw);
  const legacy = Number(localStorage.getItem('cloud-garden-best'));
  if (!raw && Number.isFinite(legacy) && legacy > 0) campaign.scores[1] = legacy;
} catch { /* Session-only progress if storage is restricted. */ }
function tone(freq: number, duration = .12) {
  if (!sound) return;
  audio ??= new AudioContext();
  if (audio.state === 'suspended') void audio.resume();
  const oscillator = audio.createOscillator(), gain = audio.createGain();
  oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(freq, audio.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(freq * .8, audio.currentTime + duration);
  gain.gain.setValueAtTime(.065, audio.currentTime); gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + duration);
  oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(); oscillator.stop(audio.currentTime + duration);
}
type Mode = 'ready' | 'playing' | 'paused' | 'won';
type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: number };
const lessons = [
  ['出发', '先试一个轻轻的跳跃', '空格 / W / ↑ 跳跃，← → / A、D 移动。'],
  ['发现', '下一座云岛，在右边等你', '一边向右移动，一边跳跃；宽宽的草地都可以落脚。'],
  ['收集', '把阳光收进口袋', '靠近金色光点就能收集，不必全部找到也能过关。'],
  ['新本领', '试着挥一挥大叶子', '按 J 击碎附近的晶石，里面藏着额外的阳光。'],
  ['慢慢来', '小花会记住你来过', '花苞绽放后，跌落会回到这朵花身边，阳光不会丢失。'],
  ['小伙伴', '前面有调皮的绒球', '按 J 用叶子轻轻赶走它，也可以跳过去。'],
  ['快到了', '花园就在上面，继续向着光', '抵达最后的花台，让背上的小花园盛开。'],
];
class Garden extends Phaser.Scene {
  private world = new Journey(campaign.selected);
  private mode: Mode = 'ready';
  private background!: Phaser.GameObjects.Image;
  private root!: Phaser.GameObjects.Container;
  private art!: Phaser.GameObjects.Graphics;
  private traveler!: Phaser.GameObjects.Image;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private platformSprites: Phaser.GameObjects.Image[] = [];
  private particles: Particle[] = [];
  private toastLeft = 0;
  private squash = 0;
  private offsetX = 0;
  private lesson = -1;
  private hudStamp = '';
  private clock = 0;
  private labels: Phaser.GameObjects.Text[] = [];
  private reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  preload() {
    this.load.image('garden', new URL('cloud-garden.png', assetBase).href);
    this.load.image('traveler', new URL('garden-traveler.png', assetBase).href);
    this.load.on('loaderror', () => { el('loading').textContent = '图片没能加载，刷新页面再试一次。'; });
  }
  create() {
    if (!this.textures.exists('garden') || !this.textures.exists('traveler')) return;
    this.background = this.add.image(0, 0, 'garden').setOrigin(.5);
    this.root = this.add.container(0, 0);
    this.makeIslandTexture();
    this.art = this.add.graphics(); this.root.add(this.art);
    this.traveler = this.add.image(285, 0, 'traveler').setOrigin(.5, .96).setDisplaySize(104, 104);
    this.root.add(this.traveler);
    this.keys = this.input.keyboard!.addKeys('LEFT,RIGHT,UP,SPACE,A,D,W,J,P,ESC') as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.keyboard!.addCapture(['SPACE', 'UP', 'LEFT', 'RIGHT']);
    this.keys.P.on('down', () => this.pause()); this.keys.ESC.on('down', () => this.pause());
    button('start').disabled = false; button('start').textContent = '开始这段旅程  ↗';
    button('start').onclick = () => {
      button('start').blur();
      if (this.mode === 'paused') this.pause();
      else if (this.mode === 'won') { const next = nextStage(this.world.stage.number); if (next) this.start(next); else this.openMap(); }
      else this.start();
    };
    button('restart').onclick = () => { button('restart').blur(); this.start(); };
    button('pause').onclick = () => { button('pause').blur(); this.pause(); };
    button('map-open').disabled = false;
    button('map-open').onclick = () => { button('map-open').blur(); this.openMap(); };
    const map = el('stage-map') as HTMLDialogElement;
    button('map-close').onclick = () => map.close();
    map.addEventListener('close', () => {
      this.input.keyboard!.enabled = true; this.clearInput();
      if (this.mode === 'playing' && document.activeElement instanceof HTMLElement) document.activeElement.blur();
    });
    map.addEventListener('click', event => { if (event.target === map) { const rect = map.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) map.close(); } });
    button('sound').onclick = () => { button('sound').blur(); sound = !sound; button('sound').textContent = sound ? '♫ 声音开启' : '♫ 声音关闭'; button('sound').setAttribute('aria-pressed', String(sound)); tone(660); };
    document.querySelectorAll<HTMLButtonElement>('[data-control]').forEach(control => {
      const key = control.dataset.control as keyof typeof touch;
      control.addEventListener('pointerdown', event => { event.preventDefault(); control.setPointerCapture(event.pointerId); touch[key] = true; });
      for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) control.addEventListener(name, () => { touch[key] = false; });
    });
    window.addEventListener('blur', () => { this.clearInput(); if (this.mode === 'playing') this.pause(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.mode === 'playing') this.pause(); });
    el('loading').classList.add('hidden');
    this.resetVisuals(); this.showIntro(); this.updateHUD();
  }
  private saveCampaign() {
    try { localStorage.setItem('cloud-garden-campaign', JSON.stringify(campaign)); } catch { /* Gameplay remains available without storage. */ }
  }
  private openMap() {
    if (this.mode === 'playing') this.pause();
    this.clearInput(); this.input.keyboard!.enabled = false;
    const grid = el('stage-grid'); grid.replaceChildren();
    el('map-summary').textContent = '已让 ' + Object.keys(campaign.scores).length + ' / ' + STAGES.length + ' 座花园盛开 · 随时自由选关';
    for (const stage of STAGES) {
      const entry = document.createElement('button'); entry.type = 'button'; entry.className = 'stage-choice difficulty-' + stage.difficulty;
      const cleared = campaign.scores[stage.number] !== undefined;
      entry.classList.toggle('cleared', cleared);
      if (stage.number === this.world.stage.number) entry.setAttribute('aria-current', 'true');
      entry.innerHTML = '<span class="stage-choice-top"><b>' + String(stage.number).padStart(2, '0') + '</b><span>' + (cleared ? '❀' : '♧') + '</span></span><strong>' + stage.name + '</strong><small>' + DIFFICULTY_NAMES[stage.difficulty] + ' · ' + stage.islands + ' 座云岛</small><em>' + (cleared ? '已盛开 · ' + campaign.scores[stage.number] + ' 分' : stage.biome.name) + '</em>';
      entry.setAttribute('aria-label', '第 ' + stage.number + ' 关，' + stage.name + '，' + DIFFICULTY_NAMES[stage.difficulty] + (cleared ? '，已通关' : ''));
      entry.onclick = () => { (el('stage-map') as HTMLDialogElement).close(); this.start(stage.number); };
      grid.append(entry);
    }
    (el('stage-map') as HTMLDialogElement).showModal();
  }
  private showIntro() {
    const stage = this.world.stage;
    if (stage.number !== 1) this.showOverlay(stage.name, '第 ' + stage.number + ' 关 · ' + DIFFICULTY_NAMES[stage.difficulty] + '。' + (stage.wind ? '高空会有侧风，留意飘动的风线。' : '循着阳光出发，让沿途的小花记住你。'), '出发去这一关  ↗');
    el('best').textContent = '第 ' + stage.number + ' / ' + STAGES.length + ' 关 · ' + DIFFICULTY_NAMES[stage.difficulty] + ' · 小花自动记忆';
  }
  private clearInput() { for (const key of Object.keys(touch) as (keyof typeof touch)[]) touch[key] = false; this.input.keyboard?.resetKeys(); this.world.releaseInput(); }
  private resetVisuals() {
    this.platformSprites.forEach(sprite => sprite.destroy()); this.platformSprites = [];
    this.labels.forEach(label => label.destroy()); this.labels = [];
    for (const p of this.world.platforms) if (!p.breakable) {
      const sprite = this.add.image(p.x, p.y, 'island').setOrigin(0, 0).setDisplaySize(p.w, p.row === 0 ? 110 : 62);
      sprite.setData('platform', p); this.platformSprites.push(sprite); this.root.addAt(sprite, 0);
      if (p.row === 0) {
        const label = this.add.text(p.x + p.w - 25, p.y, '从这里出发', { fontFamily: 'PingFang SC, Microsoft YaHei, sans-serif', fontSize: '10px', color: '#73815e', backgroundColor: '#faf5de', padding: { x: 7, y: 4 } }).setOrigin(1, 1);
        label.setData('platform', p); this.root.add(label); this.labels.push(label);
      }
    }
    this.root.bringToTop(this.art); this.root.bringToTop(this.traveler);
    this.offsetX = 0; this.hudStamp = ''; this.lesson = -1;
  }
  private start(stageNumber = this.world.stage.number) {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    this.world = new Journey(stageNumber); campaign.selected = this.world.stage.number; this.saveCampaign();
    this.mode = 'playing'; this.particles = []; this.squash = 0; this.toastLeft = 0;
    el('toast').classList.remove('show'); this.clearInput(); this.resetVisuals();
    el('overlay').classList.add('hidden'); el('tutorial').classList.remove('hidden');
    button('pause').disabled = false; this.updateHUD();
  }
  private pause() {
    if ((el('stage-map') as HTMLDialogElement).open) return;
    if (this.mode === 'playing') {
      this.mode = 'paused'; this.clearInput();
      this.showOverlay('歇一会儿，闻闻花香。', '小花记得你，准备好再继续。', '继续这段旅程  ↗');
      el('tutorial').classList.add('hidden');
    } else if (this.mode === 'paused') {
      this.mode = 'playing'; el('overlay').classList.add('hidden'); el('tutorial').classList.remove('hidden');
    }
    this.updateHUD();
  }
  private showOverlay(title: string, copy: string, cta: string) {
    el('overlay-title').textContent = title; el('overlay-copy').textContent = copy; button('start').textContent = cta;
    el('overlay-label').textContent = '第 ' + this.world.stage.number + ' / ' + STAGES.length + ' 关 · ' + (this.mode === 'won' ? '花园已盛开' : this.world.stage.name);
    el('best').textContent = '本关最佳：' + (campaign.scores[this.world.stage.number] ?? 0) + ' 分'; el('overlay').classList.remove('hidden');
  }
  private win() {
    this.mode = 'won'; this.clearInput();
    campaign = completeStage(campaign, this.world.stage.number, this.world.score); this.saveCampaign();
    const next = nextStage(this.world.stage.number);
    const allCleared = Object.keys(campaign.scores).length === STAGES.length;
    this.showOverlay(allCleared ? '整片云海，都开花了。' : '又一座花园，盛开了。',
      '收集了 ' + this.world.collected + ' 缕阳光，获得 ' + this.world.score + ' 分。' + (next ? '下一站：' + getStage(next).name + ' · ' + DIFFICULTY_NAMES[getStage(next).difficulty] + '。' : allCleared ? '21 座花园都记住了你的足迹！' : '已到旅程终点，也可以回地图补完其他花园。'),
      next ? '出发去第 ' + next + ' 关  ↗' : '打开旅程地图  ❀');
    el('tutorial').classList.add('hidden'); button('pause').disabled = true;
    this.burst(this.world.x, this.world.y - 30, 0xe7b26d, 35); tone(880, .5);
  }
  private toast(message: string) { el('toast').textContent = message; el('toast').classList.add('show'); this.toastLeft = 3.5; }
  private burst(x: number, y: number, color: number, count = 12) {
    for (let i = 0; i < count; i++) this.particles.push({ x, y, vx: Math.cos(i * 2.4) * (35 + i * 4), vy: Math.sin(i * 2.4) * 70 - 35, life: .8, color });
  }
  private event(event: Event) {
    if (event.type === 'jump') { this.squash = -.13; tone(480); }
    if (event.type === 'land') { this.squash = .15; this.burst(event.x, event.y + 22, 0xc0c7a2, 5); }
    if (event.type === 'checkpoint') { this.burst(event.x, event.y, 0xefc99e, 8); if (this.world.highest === 1) this.toast('小花记住这里啦！跌落后会回到花朵身边。'); }
    if (event.type === 'collect') { this.burst(event.x, event.y, 0xeac778); tone(760, .18); }
    if (event.type === 'break') { this.burst(event.x, event.y, 0x9cbdad); tone(360); this.toast('晶石碎开了！发现一小缕阳光。'); }
    if (event.type === 'enemy') { this.burst(event.x, event.y, 0xc6bbd0); tone(620); this.toast('绒球让开了，继续向上吧。'); }
    if (event.type === 'rescue') { this.burst(event.x, event.y, 0xa9bf87, 18); this.toast('叶子接住你啦！小花在这里等你。'); tone(420, .25); }
    if (event.type === 'win') this.win();
  }
  private updateHUD() {
    const w = this.world, stage = w.stage, stamp = [stage.number, w.highest, w.collected, w.score, this.mode].join(':');
    if (stamp === this.hudStamp) return; this.hudStamp = stamp;
    el('score').textContent = String(w.collected); el('height').textContent = w.highest + ' / ' + stage.islands; el('record').textContent = String(campaign.scores[stage.number] ?? 0);
    el('chapter-number').textContent = String(stage.number).padStart(2, '0'); el('chapter-name').textContent = stage.name;
    el('chapter-tag').textContent = '第 ' + stage.number + ' / ' + STAGES.length + ' 关 · ' + DIFFICULTY_NAMES[stage.difficulty];
    el('biome-name').textContent = stage.biome.name + (stage.wind ? ' · 有风' : ' · 晴');
    el('progress-fill').style.width = w.highest / stage.islands * 100 + '%';
    el('state-label').textContent = ({ ready: DIFFICULTY_NAMES[stage.difficulty] + ' · 小花陪你慢慢走', playing: DIFFICULTY_NAMES[stage.difficulty] + ' · 已唤醒 ' + w.highest + ' 朵小花', paused: '休息一下 · 小花在等你', won: '本关完成 · 花园已盛开' })[this.mode];
    button('pause').textContent = this.mode === 'paused' ? '▶' : 'Ⅱ'; button('pause').setAttribute('aria-label', this.mode === 'paused' ? '继续游戏' : '暂停游戏');
    const n = w.highest === 0 ? 0 : w.highest === 1 ? 1 : w.highest === 2 ? 2 : w.highest === 3 ? 3 : w.highest < 6 ? 4 : w.highest < 9 ? 5 : 6;
    if (n !== this.lesson) {
      this.lesson = n; el('tutorial-step').textContent = lessons[n][0]; el('tutorial-title').textContent = lessons[n][1];
      el('tutorial-copy').textContent = matchMedia('(pointer: coarse)').matches ? lessons[n][2].replace('空格 / W / ↑', '右下角「跳跃」').replace('← → / A、D', '左下角箭头').replace('按 J', '按「挥叶」') : lessons[n][2];
      if (stage.number > 1) {
        el('tutorial-step').textContent = DIFFICULTY_NAMES[stage.difficulty];
        el('tutorial-title').textContent = stage.wind ? '风在推着叶子，稳稳跳过去' : stage.difficulty === 'M' ? '云岛更小了，看准再起跳' : '跟着阳光，让小花一路盛开';
        el('tutorial-copy').textContent = stage.wind ? '空中有左右侧风；花朵依然会记住每座新云岛。' : stage.difficulty === 'M' ? '绒球走得更快；用叶子挥击，也可以从上方跳过。' : '没有时间限制，跌落也不会丢失阳光。';
      }
    }
  }
  update(_time: number, delta: number) {
    if (!this.art) return;
    const dt = Math.min(delta / 1000, 1 / 30);
    if (this.mode !== 'paused') this.clock += dt;
    if (this.mode === 'playing') {
      this.world.step({
        direction: Number(this.keys.RIGHT.isDown || this.keys.D.isDown || touch.right) - Number(this.keys.LEFT.isDown || this.keys.A.isDown || touch.left),
        jump: this.keys.SPACE.isDown || this.keys.UP.isDown || this.keys.W.isDown || touch.jump,
        attack: this.keys.J.isDown || touch.attack,
      }, dt);
      for (const event of this.world.events) this.event(event);
      this.updateHUD();
    }
    if (this.mode !== 'paused') {
      this.squash *= Math.max(0, 1 - dt * 10);
      for (const p of this.particles) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 160 * dt; }
      this.particles = this.particles.filter(p => p.life > 0);
      this.toastLeft -= dt; if (this.toastLeft <= 0) el('toast').classList.remove('show');
    }
    this.draw(dt);
  }
  private makeIslandTexture() {
    const g = this.make.graphics({ x: 0, y: 0 });
    g.fillStyle(0x7c775c, .1); g.fillEllipse(150, 64, 250, 26);
    g.fillStyle(0xb8aa88); g.fillPoints([{x:5,y:13},{x:292,y:13},{x:281,y:40},{x:246,y:50},{x:228,y:68},{x:194,y:57},{x:148,y:75},{x:110,y:59},{x:61,y:68},{x:28,y:47}], true);
    g.fillStyle(0xd1c09a); g.fillPoints([{x:5,y:13},{x:292,y:13},{x:262,y:39},{x:205,y:45},{x:169,y:61},{x:105,y:49},{x:61,y:55},{x:22,y:32}], true);
    for (let i = 0; i < 90; i++) { const x = 18 + i * 47 % 261, y = 20 + i * 31 % 30; g.fillStyle(i % 3 ? 0x8e846a : 0xf5e7bd, .14); g.fillEllipse(x, y, 3 + i % 7, 1 + i % 3); }
    g.fillStyle(0x718a56); g.fillRoundedRect(0, 3, 300, 17, 8);
    g.fillStyle(0x9db177); g.fillRoundedRect(0, 0, 300, 12, 6);
    g.fillStyle(0xc0c99a); g.fillRoundedRect(4, 0, 292, 5, 2);
    for (let i = 0; i < 70; i++) { const x = i * 37 % 295, y = 4 + i * 11 % 9; g.fillStyle(i % 2 ? 0xdde0ac : 0x6d8951, .5); g.fillEllipse(x, y, 4 + i % 4, 2); }
    for (let i = 0; i < 7; i++) { const x = 18 + i * 43; g.lineStyle(1, 0x7a945d, .7); g.lineBetween(x, 0, x - 2, -3); g.fillStyle(i % 2 ? 0xf2dfad : 0xe4b7a3); g.fillCircle(x, 4, 2); }
    g.generateTexture('island', 300, 82); g.destroy();
  }
  private flower(g: Phaser.GameObjects.Graphics, x: number, y: number, radius: number, color: number) {
    g.fillStyle(color); for (let i = 0; i < 5; i++) g.fillCircle(x + Math.cos(i * Math.PI * .4) * radius * .6, y + Math.sin(i * Math.PI * .4) * radius * .6, radius * .5);
    g.fillStyle(0xe4bc65); g.fillCircle(x, y, radius * .3);
  }
  private draw(dt: number) {
    const w = this.world, g = this.art, width = this.scale.width, height = this.scale.height, unit = height / HEIGHT;
    const visibleWidth = width / unit;
    const targetOffset = Math.max(0, Math.min(WIDTH - visibleWidth, w.x - visibleWidth * .44));
    this.offsetX += (targetOffset - this.offsetX) * Math.min(1, dt * 5);
    this.root.setScale(unit).setPosition(-this.offsetX * unit, 0);
    const bgScale = Math.max(width / 1536, height / 1024) * 1.05;
    this.background.setDisplaySize(1536 * bgScale, 1024 * bgScale).setPosition(width / 2, height / 2 + Math.sin(w.cameraY / 1400) * 8);
    this.background.setTint(w.stage.biome.color);
    g.clear();
    for (const sprite of this.platformSprites) {
      const p = sprite.getData('platform') as Platform;
      sprite.y = p.y - w.cameraY; sprite.setVisible(sprite.y > -100 && sprite.y < HEIGHT + 100);
    }
    for (const label of this.labels) { const p = label.getData('platform') as Platform; label.y = p.y - w.cameraY - 12; }
    for (let i = 0; i < 25; i++) {
      const x = (i * 173 + Math.sin(this.clock * .3 + i) * 14) % WIDTH, y = ((i * 113 - w.cameraY * .17 + this.clock * 5) % HEIGHT + HEIGHT) % HEIGHT;
      g.fillStyle(0xfffbde, .7); g.fillCircle(x, y, i % 3 ? 1.5 : 2.5);
    }
    for (const p of w.platforms) {
      const y = p.y - w.cameraY; if (!p.alive || y < -100 || y > HEIGHT + 100) continue;
      if (p.breakable) {
        g.fillStyle(0x718c85, .12); g.fillEllipse(p.x + 23, y + 30, 54, 12);
        g.fillStyle(0x8eb2a2); g.fillPoints([{x:p.x,y:y+19},{x:p.x+9,y:y+2},{x:p.x+31,y:y-2},{x:p.x+46,y:y+13},{x:p.x+38,y:y+27},{x:p.x+10,y:y+27}],true);
        g.fillStyle(0xc1d8bd); g.fillTriangle(p.x+9,y+2,p.x+31,y-2,p.x+23,y+16);
        g.lineStyle(2,0x688f80,.8); g.lineBetween(p.x+27,y+5,p.x+20,y+13); g.lineBetween(p.x+20,y+13,p.x+27,y+21);
      } else {
        for (let i = 0; i < Math.floor(p.w / 65); i++) {
          const x = p.x + 17 + i * 64;
          g.lineStyle(1,0x789553,.75); g.lineBetween(x,y+1,x-2,y-9); g.lineBetween(x-1,y-3,x-6,y-7);
          if (i % 2 === 0) this.flower(g,x-2,y-9,3.5,p.row%2?0xf7eccb:0xe9c1a4);
        }
        if (p.row > 0) {
          const fx = p.x + p.w - 24, fy = y - 20;
          const saved = p.row <= w.checkpoint.row, current = p.row === w.checkpoint.row;
          if (current) { g.fillStyle(0xffe9a2,.2 + Math.sin(this.clock * 3) * .05); g.fillCircle(fx,fy,19); }
          g.lineStyle(2,0x8fa96a); g.lineBetween(fx,y,fx,fy+4);
          g.fillStyle(0xb0c288); g.fillEllipse(fx-5,fy+10,10,5); g.fillEllipse(fx+5,fy+7,10,5);
          if (saved) {
            this.flower(g,fx,fy,current?10:8,current?w.stage.biome.flower:0xe2c4a8);
            g.fillStyle(0x8c7658); g.fillCircle(fx-2,fy-1,1); g.fillCircle(fx+2,fy-1,1);
            g.lineStyle(1,0x8c7658); g.beginPath(); g.arc(fx,fy+1,2,0,Math.PI); g.strokePath();
          } else { g.fillStyle(0xbaca9c); g.fillEllipse(fx,fy+1,10,14); g.lineStyle(1,0x91aa72); g.lineBetween(fx,fy-4,fx,fy+6); }
        }
      }
    }
    // A readable shimmer points toward the next safe island.
    const next = w.platforms.find(p => !p.breakable && p.row === Math.min(w.stage.islands, w.highest + 1));
    if (next && this.mode === 'playing') {
      const y = next.y - w.cameraY - 20, x = Math.max(next.x + 30, Math.min(next.x + next.w - 30, w.x));
      g.lineStyle(2,0xfffae0,.6); g.beginPath(); g.moveTo(x-5,y-5); g.lineTo(x,y); g.lineTo(x+5,y-5); g.strokePath();
    }
    for (const c of w.crystals) {
      const y = c.y - w.cameraY + Math.sin(this.clock * 2.5 + c.x) * 3;
      if (c.taken || y < -30 || y > HEIGHT + 30) continue;
      g.fillStyle(0xf7d88d,.14); g.fillCircle(c.x,y,24); g.fillStyle(0xfbe6a5,.35); g.fillCircle(c.x,y,15);
      g.lineStyle(1,0xd4ac62); g.strokeCircle(c.x,y,8); g.fillStyle(0xffedb5); g.fillCircle(c.x,y,7);
      g.fillStyle(0xd9b069); g.fillPoints([{x:c.x,y:y-6},{x:c.x+2,y:y-2},{x:c.x+6,y},{x:c.x+2,y:y+2},{x:c.x,y:y+6},{x:c.x-2,y:y+2},{x:c.x-6,y},{x:c.x-2,y:y-2}],true);
    }
    for (const e of w.enemies) {
      const y = e.y - w.cameraY + Math.sin(this.clock * 3 + e.phase) * 4; if (!e.alive || y < -40 || y > HEIGHT+40) continue;
      g.fillStyle(0x8e8274,.13); g.fillEllipse(e.x,y+25,37,8); g.fillStyle(0xb5a6b7); g.fillEllipse(e.x,y,34,29);
      for (let i=0;i<8;i++) { g.fillStyle(i%2?0xc3b8c3:0xd0c4cd); g.fillCircle(e.x+Math.cos(i*.78)*12,y+Math.sin(i*.78)*10,6); }
      g.fillStyle(0x655c65); g.fillCircle(e.x-6,y-1,2); g.fillCircle(e.x+6,y-1,2); g.fillStyle(0xe6b9ad); g.fillEllipse(e.x-10,y+5,5,3); g.fillEllipse(e.x+10,y+5,5,3);
      g.lineStyle(1,0x6e6470); g.beginPath(); g.arc(e.x,y+3,3,0,Math.PI); g.strokePath();
    }
    if (w.stage.wind) for (let i = 0; i < 9; i++) {
      const x = ((i * 139 + this.clock * w.wind * 2) % WIDTH + WIDTH) % WIDTH;
      const y = i * 67 % HEIGHT;
      g.lineStyle(1.5, 0xfffdf0, .45); g.lineBetween(x, y, x + Math.sign(w.wind) * 32, y - 3);
    }
    const top = w.platforms.find(p=>p.row===w.stage.islands && !p.breakable)!;
    const gx = top.x+top.w/2, gy = top.y-w.cameraY;
    g.fillStyle(0xc6a781); g.fillRoundedRect(gx-25,gy-19,50,19,6); g.fillStyle(0x9fac77); g.fillEllipse(gx,gy-19,52,10);
    g.lineStyle(4,0x869e60); g.lineBetween(gx,gy-20,gx,gy-58); g.fillStyle(0xadc18c); g.fillEllipse(gx-12,gy-40,23,11); g.fillEllipse(gx+12,gy-49,23,11);
    if (w.won) this.flower(g,gx,gy-67,22,0xf2c3a0); else { g.fillStyle(0xeac39a); g.fillEllipse(gx,gy-65,22,30); g.lineStyle(1,0xf9e8bd); g.lineBetween(gx,gy-75,gx,gy-54); }
    const py = w.y - w.cameraY, bob = w.grounded ? Math.sin(this.clock * 17) * Math.abs(w.vx) / 150 : 0;
    g.fillStyle(0x718357,.12); g.fillEllipse(w.x,py+24,66,10);
    this.traveler.setPosition(w.x,py+27+bob).setFlipX(w.facing<0).setVisible(this.mode!=='ready');
    this.traveler.setDisplaySize(104*(1+this.squash),104*(1-this.squash)).setAngle(this.reduceMotion?0:w.grounded?Math.sin(this.clock*12)*Math.abs(w.vx)/120:w.vx*.025);
    this.traveler.setAlpha(w.invincible>0?.6+Math.sin(this.clock*14)*.25:1);
    if (w.invincible>0) { g.lineStyle(2,0xb9cd8f,.5); g.strokeEllipse(w.x,py-10,88,103); }
    if (w.attackTime>0) {
      const a = 1-w.attackTime/.25; g.lineStyle(6,0xacc888,.65); g.beginPath(); g.arc(w.x,py-15,66,Math.PI*(1+a*.3),Math.PI*(1.9+a*.3)); g.strokePath();
      g.fillStyle(0xc0d496,.8); g.fillEllipse(w.x+w.facing*49,py-45,28,12);
    }
    if (w.collected>=3 && this.mode!=='ready') {
      const fx=w.x+(w.facing>0?16:-16), fy=py-60;
      this.flower(g,fx,fy,Math.min(9,4+w.collected*.4),0xf2c49b);
    }
    for (const p of this.particles) { g.fillStyle(p.color,p.life/.8); g.fillEllipse(p.x,p.y-w.cameraY,5,3); }
  }
}
new Phaser.Game({
  type: Phaser.AUTO, parent: 'game', backgroundColor: '#edf0df', scene: Garden,
  scale: { mode: Phaser.Scale.RESIZE, width: WIDTH, height: HEIGHT },
  render: { antialias: true }, input: { activePointers: 4 },
});
