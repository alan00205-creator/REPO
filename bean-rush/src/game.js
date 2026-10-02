// Game flow: lobby → matchmaking → 4-round show (or practice) → results, plus menus.

import { Vector3 } from 'three';
import { Sim, STEP } from './sim.js';
import { LEVELS } from './levels/index.js';
import lobbyDef from './levels/lobby.js';
import { makeRng, clamp, formatTime, damp, lerpAngle } from './util.js';
import { BOT_NAMES, randomLook, COLORS, PATTERNS, HATS, REQS, isOwned, colorOf } from './cosmetics.js';
import { writeSave } from './save.js';
import { fruitDataURL } from './art.js';
import * as UI from './ui.js';

const $ = UI.$;
const TYPE_LABEL = { race: '競速', survival: '生存', final: '決賽' };
const SHOW_SIZE = 30;
const ROUND_COINS = [10, 15, 20];
const TIPS = [
  '跳起來之後再按飛撲，可以飛得更遠。',
  '被旋轉棒打到會暈一下，看準時機再跳。',
  '大門關卡：撞不開的是假門，快換一扇！',
  '水果配對：先記住離你最近的幾塊地板。',
  '蜂巢崩落：一直移動，但別亂跑；跳躍可以少踩幾塊地板。',
  '珍奶大滾坡：珍珠滾下來時往旁邊閃。',
  '在造型裡用豆豆幣換帽子和花紋。',
];
const PRACTICE_N = { race: 20, survival: 16, final: 10 };

const tmpV = { x: 0, z: 0 };
const V3 = new Vector3();

export class Game {
  constructor(view, input, sound, save) {
    this.view = view;
    this.input = input;
    this.sound = sound;
    this.save = save;
    this.sim = null;
    this.mode = 'lobby';
    this.state = 'boot';
    this.sub = '';
    this.paused = false;
    this.acc = 0;
    this.rng = makeRng((Date.now() ^ (Math.random() * 1e9)) >>> 0);
    this.show = null;
    this.spectate = null;
    this.timers = [];
    this.fps = { n: 0, t: 0, v: 60, adaptT: 0 };
    this.fruitImgs = [];
    this.lastHud = {};
    this.tutorialT = 0;
    this.bindUI();
    input.onMode = () => this.refreshTouch();
  }

  // ------------------------------------------------------------------------------
  // helpers
  later(sec, fn) {
    const t = { at: sec, fn };
    this.timers.push(t);
    return t;
  }

  clearTimers() {
    this.timers.length = 0;
  }

  persist() {
    writeSave(this.save);
  }

  playerName() {
    return this.save.name || '你';
  }

  vibrate(ms) {
    if (this.save.settings.vibrate && navigator.vibrate) {
      try { navigator.vibrate(ms); } catch (_) { /* ignore */ }
    }
  }

  refreshTouch() {
    const inRound = this.state === 'round' && (this.sub === 'count' || this.sub === 'play' || this.sub === 'over') && !this.spectate;
    $('touch').hidden = !(inRound && this.input.mode === 'touch');
  }

  // ------------------------------------------------------------------------------
  // sim lifecycle
  endSim() {
    this.sim = null;
    this.view.endLevel();
    this.acc = 0;
    this.spectate = null;
    this.clearTimers();
  }

  makeSim(def, contestants, o = {}) {
    this.endSim();
    const gfx = this.view.beginLevel();
    const sim = new Sim({ def, contestants, seed: this.rng.int(1, 1e9), quota: o.quota, targetAlive: o.targetAlive, gfx, practice: o.practice });
    this.sim = sim;
    this.view.setSky(def.sky || 'day');
    this.view.setGooLevel((sim.level.killY ?? -8) + 1.6);
    return sim;
  }

  // ------------------------------------------------------------------------------
  // lobby
  enterLobby() {
    this.state = 'lobby';
    this.mode = 'lobby';
    this.show = null;
    this.paused = false;
    const cs = [{ id: 0, name: this.playerName(), isPlayer: true, look: this.save.look, skill: 1 }];
    const rng = this.rng;
    for (let i = 1; i < 9; i++) cs.push({ id: i, name: rng.pick(BOT_NAMES), look: randomLook(rng), skill: 0.5 });
    const sim = this.makeSim(lobbyDef, cs, {});
    sim.startPlay();
    sim.player.frozen = true;
    $('hud').hidden = true;
    $('touch').hidden = true;
    UI.big('');
    UI.only('title');
    this.updateTitle();
    this.sound.music('lobby');
    this.camYaw = 0;
  }

  updateTitle() {
    UI.setText('stCrowns', this.save.crowns);
    UI.setText('stCoins', this.save.coins);
    const s = this.save;
    const hello = s.shows
      ? `${s.name ? s.name + '，' : ''}已參加 ${s.shows} 場・最佳：${s.crowns ? '奪冠 ' + s.crowns + ' 次' : s.bestRound >= 4 ? '進入決賽' : '第 ' + Math.max(1, s.bestRound) + ' 回合'}`
      : '30 位豆豆、4 個回合，最後站著的拿皇冠！';
    UI.setText('hello', hello);
    $('btnFull').hidden = !(document.fullscreenEnabled || document.webkitFullscreenEnabled);
  }

  // ------------------------------------------------------------------------------
  // show
  startShow() {
    this.sound.play('click');
    const rng = this.rng;
    const easy = this.save.shows < 2 ? 0.82 : 1;
    const names = rng.shuffle(BOT_NAMES.slice());
    const cs = [{ id: 0, name: this.playerName(), isPlayer: true, look: { ...this.save.look }, skill: 1 }];
    for (let i = 1; i < SHOW_SIZE; i++) {
      cs.push({ id: i, name: names[i % names.length], look: randomLook(rng), skill: clamp((0.12 + rng() * 0.88) * easy, 0.05, 1) });
    }
    rng.shuffle(cs);
    const r1 = rng.pick(['gate', 'boba']);
    const r2 = rng.pick([r1 === 'gate' ? 'boba' : 'gate', 'fruit']);
    const r3 = r2 === 'fruit' ? 'ring' : rng.pick(['ring', 'fruit']);
    const fin = rng.pick(['hex', 'ringFinal']);
    this.show = { contestants: cs, alive: cs.slice(), rounds: [r1, r2, r3, fin], idx: 0, coins: 0, playerOut: false, outRound: -1, rewarded: false };
    this.mode = 'show';
    this.state = 'match';
    UI.only('match');
    this.matchmaking(() => this.beginRound());
  }

  matchmaking(done) {
    const box = $('mBeans');
    box.innerHTML = '';
    $('mMax').textContent = SHOW_SIZE;
    UI.setText('mTip', '小撇步：' + this.rng.pick(TIPS));
    const cs = this.show.contestants;
    let n = 0;
    const tick = () => {
      if (this.state !== 'match') return;
      const add = Math.min(cs.length - n, 1 + Math.floor(this.rng() * 3));
      for (let i = 0; i < add; i++) {
        const c = cs[n++];
        box.appendChild(UI.miniBean(c.look, c.isPlayer ? 'me pop' : 'pop'));
      }
      UI.setText('mCount', n);
      this.sound.play('tick');
      if (n < cs.length) this.later(0.06 + this.rng() * 0.12, tick);
      else this.later(0.7, done);
    };
    this.later(0.3, tick);
  }

  roundPlan() {
    const s = this.show;
    const id = s.rounds[s.idx];
    const def = LEVELS[id];
    const n = s.alive.length;
    let quota = 0, targetAlive = 1;
    if (def.type === 'race') quota = s.idx === 0 ? Math.round(n * 0.67) : Math.max(2, Math.round(n * 0.6));
    else if (def.type === 'survival') targetAlive = Math.max(2, Math.ceil(n * (s.idx === 1 ? 0.6 : 0.5)));
    return { def, quota, targetAlive };
  }

  beginRound() {
    const s = this.show;
    const { def, quota, targetAlive } = this.roundPlan();
    this.startLevel(def, s.alive, { quota, targetAlive });
  }

  startPractice(id) {
    const def = LEVELS[id];
    const rng = this.rng;
    const n = PRACTICE_N[def.type];
    const names = rng.shuffle(BOT_NAMES.slice());
    const cs = [{ id: 0, name: this.playerName(), isPlayer: true, look: { ...this.save.look }, skill: 1 }];
    for (let i = 1; i < n; i++) cs.push({ id: i, name: names[i], look: randomLook(rng), skill: 0.15 + rng() * 0.8 });
    rng.shuffle(cs);
    this.mode = 'practice';
    this.practiceId = id;
    this.show = null;
    this.startLevel(def, cs, { quota: def.type === 'race' ? n : 0, targetAlive: def.type === 'survival' ? 1 : 1, practice: true });
  }

  startLevel(def, contestants, o) {
    UI.only();
    $('hud').hidden = true;
    this.state = 'round';
    this.sub = 'intro';
    this.paused = false;
    const sim = this.makeSim(def, contestants, o);
    this.def = def;
    this.playerOutShown = false;
    this.finishedShown = false;
    this.lastCount = -1;
    // intro card
    const s = this.show;
    UI.setText('iRound', s ? (s.idx === 3 ? '決賽' : `第 ${s.idx + 1} 回合`) : '練習');
    this.renderProgress($('iProg'));
    UI.setText('iName', def.name);
    const tag = $('iTag');
    tag.textContent = TYPE_LABEL[def.type];
    tag.className = 'tag ' + def.type;
    UI.setText('iDesc', def.desc);
    let goal = '';
    if (def.type === 'race') goal = s ? `前 ${o.quota} 名晉級` : '衝到終點！';
    else if (def.type === 'survival') goal = s ? `淘汰到剩 ${o.targetAlive} 人為止` : '撐越久越好！';
    else goal = '最後一個站著的贏得皇冠！';
    UI.setText('iGoal', goal);
    UI.screen('intro');
    this.sound.music(def.type === 'final' ? 'final' : 'race');
    this.sound.play('whoosh');
    if (sim.level.flyover) this.view.rig.startFlyover(sim.level.flyover, def.type === 'race' ? 6.5 : 5);
    else this.view.rig.mode = 'follow';
    this.introT = 0;
    this.refreshTouch();
  }

  skipIntro() {
    if (this.state !== 'round' || this.sub !== 'intro') return;
    this.sub = 'count';
    $('intro').hidden = true;
    this.sim.startCountdown();
    const p = this.sim.player;
    const rig = this.view.rig;
    rig.mode = 'follow';
    const hint = this.sim.level.camYaw ? this.sim.level.camYaw(p.pos) : null;
    rig.snapTo(V3.set(p.pos.x, p.pos.y + 1.25, p.pos.z), hint ?? p.yaw + Math.PI, this.sim.level.camPitch ?? 0.32);
    rig.basePitch = this.sim.level.camPitch ?? 0.32;
    rig.baseDist = this.sim.level.camDist ?? 8.6;
    rig.dist = rig.baseDist;
    rig.idle = 9;
    $('hud').hidden = false;
    this.renderHud(true);
    this.refreshTouch();
    // first-time hints
    if (!this.save.tutorial) this.tutorialT = 7;
    $('stickHint').style.opacity = !this.save.tutorial ? '1' : '0';
    if (innerHeight > innerWidth && this.input.mode === 'touch' && !this.rotateTipShown) {
      this.rotateTipShown = true;
      UI.toast('把手機轉成橫向，視野更大喔！', 3200);
    }
  }

  renderProgress(el) {
    el.innerHTML = '';
    if (!this.show) return;
    for (let i = 0; i < 4; i++) {
      const d = document.createElement('i');
      if (i < this.show.idx) d.className = 'done';
      else if (i === this.show.idx) d.className = 'now';
      el.appendChild(d);
    }
  }

  // ------------------------------------------------------------------------------
  // events from the simulation
  handleEvents() {
    const sim = this.sim;
    const sound = this.sound;
    const fx = this.view.fx;
    const me = sim.player;
    const focus = this.view.rig.look;
    for (const e of sim.events) {
      const b = e.bean;
      this.view.beans.onEvent(e);
      let vol = 1;
      if (b && b !== me) {
        const d = Math.hypot(b.pos.x - focus.x, b.pos.y - focus.y, b.pos.z - focus.z);
        vol = clamp(1 - d / 30, 0, 1) * 0.45;
      }
      switch (e.type) {
        case 'jump':
          if (vol > 0.05) sound.play('jump', { vol, pitch: b === me ? 1 : 0.9 + Math.random() * 0.25 });
          break;
        case 'land':
          if (vol > 0.05) sound.play('land', { vol: vol * clamp((e.extra || 4) / 10, 0.3, 1) });
          if ((e.extra || 0) > 7) fx.dust(b.pos.x, b.pos.y, b.pos.z, 6, clamp(e.extra / 14, 0.6, 1.4));
          break;
        case 'dive':
          if (vol > 0.05) sound.play('dive', { vol });
          fx.dust(b.pos.x, b.pos.y, b.pos.z, 4, 0.8);
          break;
        case 'bonk':
          if (vol > 0.05) sound.play('bonk', { vol: Math.max(vol, 0.25), pitch: 0.9 + Math.random() * 0.2 });
          fx.bonk(b);
          if (b === me) { this.view.rig.shake(0.35); this.vibrate(35); }
          break;
        case 'boing':
          if (vol > 0.05) sound.play('boing', { vol });
          break;
        case 'splash': {
          const gy = this.view.goo.position.y;
          fx.splash(b.pos.x, gy + 0.2, b.pos.z);
          if (vol > 0.05 || b === me) sound.play('splash', { vol: b === me ? 1 : vol });
          if (b === me && sim.type === 'race' && !b.finished) UI.feed('掉下去了！回到存檔點');
          break;
        }
        case 'respawn':
          fx.dust(b.pos.x, b.pos.y, b.pos.z, 8, 0.7);
          break;
        case 'doorBreak':
          if (vol > 0.03) sound.play('doorBreak', { vol: Math.max(vol, 0.3) });
          fx.dust(e.extra.x, 1, e.extra.z, 10, 1.2);
          break;
        case 'thud':
          if (vol > 0.05) sound.play('thud', { vol });
          break;
        case 'checkpoint':
          if (b === me) { UI.feed('抵達存檔點！'); sound.play('chime', { vol: 0.6 }); }
          break;
        case 'finish':
          fx.burstConfetti(b.pos.x, b.pos.y + 1, b.pos.z, b === me ? 90 : 14, b === me ? 4 : 2, 7);
          if (b === me) this.onPlayerFinish(e.extra);
          else if (vol > 0.1) sound.play('coin', { vol: vol * 0.6 });
          break;
        case 'out':
          if (b === me) this.onPlayerOut();
          break;
        case 'go':
          sound.play('go');
          UI.big('開始！', 'go anim', '', 900);
          break;
        case 'roundEnd':
          this.onRoundEnd(e.extra);
          break;
        case 'tile':
          if (vol > 0.1) sound.play('tile', { vol: vol * 0.7, pitch: 0.9 + Math.random() * 0.3 });
          break;
        case 'crack':
          sound.play('crack', { vol: 0.6 });
          break;
        case 'fall':
          sound.play('fall', { vol: 0.5 });
          break;
        case 'drop':
          if (e.extra) {
            const d = Math.hypot(e.extra.x - focus.x, e.extra.z - focus.z);
            if (d < 30) sound.play('drop', { vol: 1 - d / 30 });
          }
          break;
        case 'thump':
          if (e.extra) {
            const d = Math.hypot(e.extra.x - focus.x, e.extra.z - focus.z);
            if (d < 22) sound.play('thump', { vol: (1 - d / 22) * 0.6 });
          }
          break;
        case 'fruitShow':
          sound.play('chime');
          if (!this.spectate && this.sim.player && !this.sim.player.out) UI.feed('記住每塊地板上的水果！');
          break;
        case 'fruitHide':
          sound.play('whoosh');
          break;
        case 'fruitDrop':
          sound.play('fall', { vol: 0.7 });
          break;
      }
    }
    sim.events.length = 0;
  }

  onPlayerFinish(place) {
    if (this.mode === 'practice') {
      this.sound.play('qualify');
      UI.big('完成！', 'good anim', `第 ${place} 名・${formatTime(this.sim.t)}`, 2400);
      this.later(2.2, () => this.sim && !this.sim.ended && this.sim.endRound('practice'));
      return;
    }
    const qualified = place <= this.sim.quota;
    if (qualified) {
      this.sound.play('qualify');
      UI.big('晉級！', 'good anim', `第 ${place} 名過線`, 2200);
      this.vibrate(60);
    }
    this.finishedShown = true;
  }

  onPlayerOut() {
    if (this.playerOutShown) return;
    this.playerOutShown = true;
    this.sound.play('eliminated');
    UI.big('淘汰', 'bad anim', '', 2000);
    this.vibrate([80, 60, 120]);
    if (this.mode === 'practice') {
      this.later(1.8, () => this.sim && !this.sim.ended && this.sim.endRound('practice'));
      return;
    }
    this.markPlayerOut();
    this.later(2.0, () => this.showElim());
  }

  markPlayerOut() {
    const s = this.show;
    if (!s || s.playerOut) return;
    s.playerOut = true;
    s.outRound = s.idx;
    this.award();
  }

  // Pay out coins for the rounds survived (once per show).
  award(won = false) {
    const s = this.show;
    if (!s || s.rewarded) return;
    s.rewarded = true;
    let coins = 5;
    const survived = won ? 3 : s.playerOut ? s.outRound : s.idx;
    for (let i = 0; i < survived; i++) coins += ROUND_COINS[i] || 0;
    if (won) coins += 100;
    s.coins = coins;
    const sv = this.save;
    sv.coins += coins;
    sv.shows += 1;
    sv.bestRound = Math.max(sv.bestRound, (won ? 4 : survived + 1));
    if (survived >= 3) sv.finals += 1;
    if (won) sv.crowns += 1;
    sv.tutorial = true;
    this.persist();
  }

  showElim() {
    if (!this.show || this.state !== 'round') return;
    const s = this.show;
    const r = s.outRound;
    UI.setText('eSub', r === 3 ? '在決賽中落敗，差一點點！' : `你撐到了第 ${r + 1} 回合`);
    $('eRewards').innerHTML = `<span class="chip">${UI.COIN_SVG}+${s.coins} 豆幣</span>`;
    UI.screen('elim');
    $('hud').hidden = true;
    $('touch').hidden = true;
  }

  watch() {
    $('elim').hidden = true;
    this.sound.play('click');
    this.spectate = { idx: 0 };
    this.pickSpectate(0);
    $('hud').hidden = false;
    $('spec').hidden = false;
    this.refreshTouch();
    if (this.sub === 'results') this.nextRound();
  }

  pickSpectate(dir) {
    const sim = this.sim;
    if (!sim) return;
    let cands = sim.beans.filter((b) => b.active && !b.out && !b.isPlayer);
    if (sim.type === 'race') {
      const run = cands.filter((b) => !b.finished);
      if (run.length) cands = run;
    }
    if (!cands.length) cands = sim.beans.filter((b) => b.active);
    if (!cands.length) return;
    const cur = this.spectate.bean;
    let i = cands.indexOf(cur);
    i = i < 0 ? 0 : (i + dir + cands.length) % cands.length;
    this.spectate.bean = cands[i];
    UI.setText('specName', '觀戰中：' + cands[i].name);
  }

  onRoundEnd(reason) {
    const sim = this.sim;
    this.sound.play('whistle');
    const me = sim.player;
    if (this.mode === 'practice') return;
    if (sim.type === 'final') {
      if (sim.winner === me) {
        UI.big('冠軍！', 'gold anim', '', 3000);
        this.sound.play('crown');
        this.view.fx.rainConfetti(me.pos.x, me.pos.y + 8, me.pos.z, 260, 16);
      } else {
        UI.big('決賽結束！', 'en anim', sim.winner ? `冠軍：${sim.winner.name}` : '', 2600);
      }
      return;
    }
    if (me && !this.spectate && !this.show.playerOut) {
      const ok = sim.qualified.includes(me);
      if (!ok) {
        // race: time ran out / quota filled before we crossed
        UI.big('淘汰', 'bad anim', '晉級名額已滿', 2200);
        this.sound.play('eliminated');
        this.markPlayerOut();
        this.playerOutShown = true;
        this.vibrate([80, 60, 120]);
        return;
      }
      if (sim.type === 'survival') {
        UI.big('晉級！', 'good anim', reason === 'time' ? '撐到最後了！' : '', 2200);
        this.sound.play('qualify');
        return;
      }
    }
    UI.big('回合結束！', 'anim', '', 2000);
  }

  // ------------------------------------------------------------------------------
  // results between rounds
  showResults() {
    const sim = this.sim;
    const me = sim.player;
    this.sub = 'results';
    $('hud').hidden = true;
    $('touch').hidden = true;
    $('spec').hidden = true;

    if (this.mode === 'practice') {
      const fin = me && me.finished;
      let title = '練習結束', sub = '';
      if (sim.type === 'race') { title = fin ? '完成！' : '時間到'; sub = fin ? `第 ${me.place} 名・用時 ${formatTime(me.finishT)}` : '再試一次吧！'; }
      else if (sim.type === 'final') { title = sim.winner === me ? '你贏了！' : '練習結束'; sub = sim.winner ? `冠軍：${sim.winner.name}` : ''; }
      else { title = me && !me.out ? '撐過了！' : '練習結束'; sub = me && me.out ? `撐了 ${formatTime(me.outT ?? sim.t)}` : `存活 ${sim.aliveCount} 人`; }
      UI.setText('rTitle', title);
      UI.setText('rSub', sub);
      $('rCrowd').innerHTML = '';
      $('rProg').innerHTML = '';
      const act = $('rActions');
      act.innerHTML = '';
      const again = btn('再玩一次', 'pink', () => { this.sound.play('click'); this.startPractice(this.practiceId); });
      const menu = btn('回到大廳', 'white', () => { this.sound.play('back'); this.enterLobby(); });
      act.append(again, menu);
      UI.screen('results');
      return;
    }

    const s = this.show;
    // who goes through
    const qual = sim.qualified.map((b) => b.contestant);
    if (sim.type === 'final') {
      if (sim.winner === me) return this.victory();
      return this.showEndScreen(sim.winner);
    }
    if (s.playerOut && !this.spectate) {
      // eliminated this round and hasn't picked watch/leave yet
      this.showElim();
      this.pendingNext = qual;
      return;
    }
    s.alive = qual;
    const mine = me && qual.includes(me.contestant);
    UI.setText('rTitle', this.spectate ? '回合結果' : mine ? '晉級下一回合！' : '回合結果');
    $('rTitle').style.color = mine ? 'var(--mint)' : '';
    UI.setText('rSub', `${qual.length} 位豆豆晉級，${sim.beans.length - qual.length} 位淘汰`);
    const crowd = $('rCrowd');
    crowd.innerHTML = '';
    for (const b of sim.beans) {
      const q = qual.includes(b.contestant);
      crowd.appendChild(UI.miniBean(b.look, (b.isPlayer ? 'me ' : '') + (q ? '' : 'out')));
    }
    const next = s.idx + 1;
    const prog = $('rProg');
    s.idx = next;
    this.renderProgress(prog);
    s.idx = next - 1;
    const act = $('rActions');
    act.innerHTML = '';
    const go = btn(next === 3 ? '前往決賽' : '下一回合', 'pink', () => this.nextRound());
    act.append(go);
    if (this.spectate) act.append(btn('回到大廳', 'white', () => this.leaveShow()));
    UI.screen('results');
    this.sound.play(mine ? 'cheer' : 'chime', { vol: 0.6 });
    let left = 7;
    const tick = () => {
      if (this.sub !== 'results' || this.state !== 'round') return;
      left--;
      go.textContent = (next === 3 ? '前往決賽' : '下一回合') + `（${left}）`;
      if (left <= 0) this.nextRound();
      else this.later(1, tick);
    };
    this.later(1, tick);
  }

  nextRound() {
    if (this.sub !== 'results' && !this.pendingNext) return;
    const s = this.show;
    if (this.pendingNext) { s.alive = this.pendingNext; this.pendingNext = null; }
    this.sound.play('click');
    $('results').hidden = true;
    s.idx++;
    if (s.idx >= s.rounds.length || s.alive.length < 2) {
      if (s.alive.length === 1 && s.alive[0].isPlayer && !s.playerOut) { this.victory(); return; }
      this.showEndScreen(s.alive[0] ? { name: s.alive[0].name } : null);
      return;
    }
    this.beginRound();
  }

  victory() {
    this.award(true);
    this.state = 'end';
    UI.setText('vSub', `${this.playerName()}在 ${SHOW_SIZE} 位豆豆中脫穎而出！`);
    $('vRewards').innerHTML = `<span class="chip">${UI.CROWN_SVG}+1 皇冠</span><span class="chip">${UI.COIN_SVG}+${this.show.coins} 豆幣</span>`;
    UI.only('victory');
    this.sound.music('lobby');
    if (this.save.crowns === 1) UI.toast('解鎖：冠軍皇冠、金牌色！', 3500);
  }

  showEndScreen(winner) {
    this.award();
    this.state = 'end';
    UI.setText('sTitle', '本場結束');
    UI.setText('sSub', winner ? `本場冠軍：${winner.name}` : '這場沒有人留到最後！');
    UI.only('showEnd');
  }

  async leaveShow() {
    if (this.mode === 'show' && this.show && !this.show.rewarded) {
      const ok = await UI.ask('離開比賽？', '現在離開會被算成淘汰，只拿得到目前的豆幣。', '離開', '繼續玩');
      if (!ok) return;
      this.markPlayerOut();
    }
    this.sound.play('back');
    this.paused = false;
    $('pause').hidden = true;
    $('elim').hidden = true;
    this.enterLobby();
  }

  // ------------------------------------------------------------------------------
  togglePause(force) {
    const can = this.state === 'round' && this.sub !== 'results';
    const want = force !== undefined ? force : !this.paused;
    if (want && !can) return;
    if (want && (!$('elim').hidden)) return;
    this.paused = want;
    if (want) { UI.screen('pause'); this.sound.play('click'); }
    else { $('pause').hidden = true; $('settings').hidden = true; $('help').hidden = true; }
    this.input.reset();
  }

  // ------------------------------------------------------------------------------
  // per-frame
  update(dt) {
    const inp = this.input.poll();
    // timers
    for (let i = this.timers.length - 1; i >= 0; i--) {
      const t = this.timers[i];
      t.at -= dt;
      if (t.at <= 0) { this.timers.splice(i, 1); t.fn(); }
    }
    if (inp.pause) {
      if (!$('settings').hidden || !$('help').hidden) { $('settings').hidden = true; $('help').hidden = true; }
      else if (this.state === 'round') this.togglePause();
    }
    const sim = this.sim;
    const rig = this.view.rig;
    const playing = this.state === 'round' && !this.paused;

    if (playing && this.sub === 'intro') {
      this.introT += dt;
      if ((inp.jump || inp.any) && this.introT > 0.4) this.skipIntro();
    }
    if (playing && (inp.camDX || inp.camDY) && rig.mode === 'follow') rig.rotate(inp.camDX, inp.camDY);

    if (sim && !this.paused) {
      const me = sim.player;
      if (me && this.state === 'round' && !this.spectate && (this.sub === 'count' || this.sub === 'play' || this.sub === 'over')) {
        rig.toWorld(inp.sx, inp.sy, tmpV);
        me.mx = tmpV.x;
        me.mz = tmpV.z;
        if (inp.jump) me.jumpPressed = true;
        if (inp.dive) me.divePressed = true;
        if ((inp.sx || inp.sy) && this.tutorialT > 0) { $('stickHint').style.opacity = '0'; }
      }
      if (this.state === 'lobby' || this.state === 'custom' || this.state === 'match' || this.state === 'end') this.lobbyPlayer(dt);
      this.acc += dt * sim.timeScale;
      let n = 0;
      while (this.acc >= STEP && n < 6) {
        sim.step(STEP);
        this.acc -= STEP;
        n++;
        this.handleEvents();
      }
      if (n >= 6) this.acc = 0;
    }

    // round sub-phases
    if (this.state === 'round' && sim) {
      if (this.sub === 'count') {
        const left = 3 - Math.floor(sim.phaseT);
        if (sim.phase === 'countdown' && left !== this.lastCount && left > 0) {
          this.lastCount = left;
          UI.big(String(left), 'en count', '', 900);
          this.sound.play('beep');
        }
        if (sim.phase === 'play') this.sub = 'play';
      }
      if (this.sub === 'play' && sim.phase === 'over') this.sub = 'over';
      if (this.sub === 'over' && sim.phase === 'done') this.showResults();
      if (this.sub === 'play' || this.sub === 'over' || this.sub === 'count') this.renderHud();
      if (this.spectate && this.spectate.bean && (!this.spectate.bean.active || this.spectate.bean.out)) this.pickSpectate(1);
    }

    // camera
    if (sim) this.updateCamera(dt);

    // fps
    const f = this.fps;
    f.n++; f.t += dt;
    if (f.t >= 0.5) {
      f.v = f.n / f.t;
      f.n = 0; f.t = 0;
      if (this.save.settings.fps) UI.setText('fps', `${f.v.toFixed(0)} fps · ${this.view.renderer.info.render.calls} dc`);
      if (playing && this.sub === 'play') { f.adaptT += 0.5; if (f.adaptT >= 2) { f.adaptT = 0; this.view.adapt(f.v); } }
    }

    const alpha = sim ? clamp(this.acc / STEP, 0, 1) : 0;
    const me = sim ? sim.player : null;
    this.view.frame(dt, alpha, sim ? sim.beans : [], {
      marker: this.state === 'round' && !this.spectate ? me : null,
      showMarker: this.state === 'round' && this.sub !== 'intro',
      happy: this.state === 'end' || (sim && sim.winner === me) ? me : null,
    });
  }

  // Idle antics for your bean in the menus
  lobbyPlayer(dt) {
    const me = this.sim.player;
    if (!me) return;
    this.lobbyHop = (this.lobbyHop ?? 3) - dt;
    if (this.lobbyHop <= 0) {
      this.lobbyHop = 3 + Math.random() * 4;
      me.frozen = false;
      me.jumpPressed = true;
      this.later(0.05, () => { if (this.sim && this.sim.player === me) me.frozen = true; });
    }
  }

  updateCamera(dt) {
    const rig = this.view.rig;
    const sim = this.sim;
    const cam = this.view.camera;
    if (this.state === 'lobby' || this.state === 'custom' || this.state === 'match' || (this.state === 'end' && this.mode === 'lobby')) {
      rig.mode = 'manual';
      const me = sim.player;
      const portrait = this.view.h > this.view.w;
      const close = this.state === 'custom';
      const d = close ? (portrait ? 5.4 : 4.4) : portrait ? 9 : 6.6;
      this.camYaw = damp(this.camYaw || 0, Math.sin(this.view.time * 0.25) * 0.22, 2, dt);
      const tx = me.pos.x, ty = me.pos.y + (close ? 0.9 : 1.2), tz = me.pos.z;
      // shift where we look so the bean sits beside (landscape) or above (portrait) the menu
      const sideX = portrait ? 0 : close ? -1.25 : -2.3;
      const lookY = portrait ? (close ? -1.7 : -0.55) : 0;
      V3.set(tx - sideX, ty + lookY, tz);
      cam.position.set(tx - sideX + Math.sin(this.camYaw) * d, ty + d * 0.2, tz + Math.cos(this.camYaw) * d);
      cam.lookAt(V3);
      rig.look.copy(V3);
      return;
    }
    if (this.state === 'end') {
      // slow orbit around the winner / last scene
      const w = sim.winner || sim.player;
      if (!w) return;
      rig.mode = 'manual';
      this.camYaw = (this.camYaw || 0) + dt * 0.25;
      const d = 7.5;
      V3.set(w.pos.x, w.pos.y + 1.1, w.pos.z);
      cam.position.set(w.pos.x + Math.sin(this.camYaw) * d, w.pos.y + 4.4, w.pos.z + Math.cos(this.camYaw) * d);
      cam.lookAt(V3);
      rig.look.copy(V3);
      return;
    }
    if (rig.mode === 'fly') {
      if (rig.update(dt, {}) && this.sub === 'intro') this.skipIntro();
      return;
    }
    const focusBean = this.spectate ? this.spectate.bean : sim.player;
    if (!focusBean) return;
    const L = sim.level;
    let hint = L.camYaw ? L.camYaw(focusBean.pos) : null;
    if (focusBean.respawnT > 0) hint = null;
    if (this.spectate && hint === null) hint = focusBean.yaw + Math.PI;
    const moving = Math.hypot(focusBean.vel.x, focusBean.vel.z) > 1.5;
    rig.mode = 'follow';
    // don't dive into the goo after a bean that fell
    const sunk = focusBean.respawnT > 0 || focusBean.out || focusBean.pos.y < (L.killY ?? -8) + 3;
    if (sunk) {
      this.sunkFocus = this.sunkFocus || focusBean.pos.clone();
      this.sunkFocus.y = Math.max(this.sunkFocus.y, (L.killY ?? -8) + 3);
    } else this.sunkFocus = null;
    rig.update(dt, { focus: sunk ? this.sunkFocus : focusBean.pos, hintYaw: hint, moving });
  }

  renderHud(force) {
    const sim = this.sim;
    if (!sim) return;
    const s = this.show;
    const me = sim.player;
    let main = '';
    const alive = sim.aliveCount;
    if (sim.type === 'race') {
      main = this.mode === 'practice' ? `練習中 <span class="n">${formatTime(sim.t)}</span>` : `晉級 <span class="n">${sim.qualified.length} / ${sim.quota}</span>`;
    } else if (sim.type === 'survival') {
      const left = sim.duration ? sim.duration - sim.t : 0;
      main = `存活 <span class="n">${alive}</span>` + (s ? `<span style="opacity:.6">／目標 ${sim.targetAlive}</span>` : '') + (sim.duration ? `　⏱ <span class="n">${formatTime(sim.phase === 'countdown' ? sim.duration : left)}</span>` : '');
    } else {
      main = `剩下 <span class="n">${alive}</span> 人`;
    }
    UI.setHTML('hudMain', main);
    UI.setText('hudRound', s ? (s.idx === 3 ? '決賽・' + this.def.name : `第 ${s.idx + 1} 回合・${this.def.name}`) : '練習・' + this.def.name);

    // fruit panel
    const h = sim.level.hud ? sim.level.hud() : null;
    const fp = $('hudFruit');
    if (h && (h.fruit !== undefined || h.memo)) {
      fp.hidden = false;
      if (h.fruit !== undefined) {
        if (!this.fruitImgs[h.fruit]) this.fruitImgs[h.fruit] = fruitDataURL(h.fruit, 96);
        const img = fp.querySelector('img');
        if (img.dataset.f !== String(h.fruit)) { img.src = this.fruitImgs[h.fruit]; img.dataset.f = String(h.fruit); img.hidden = false; }
        UI.setText('hudFruitTxt', h.left > 0 ? `站到「${sim.level.fruits[h.fruit]}」上！` : '看結果！');
      } else {
        fp.querySelector('img').hidden = true;
        UI.setText('hudFruitTxt', '記住水果的位置！');
      }
      const bar = fp.querySelector('.bar i');
      const full = h.fruit !== undefined ? 3.6 : 5.5;
      bar.style.transform = `scaleX(${clamp((h.left || 0) / full, 0, 1)})`;
    } else fp.hidden = true;

    // centre message
    let msg = '';
    if (this.tutorialT > 0 && sim.phase === 'play') {
      this.tutorialT -= 1 / 60;
      msg = this.input.mode === 'touch' ? '左邊拖曳移動・右邊滑動轉鏡頭' : this.input.mode === 'pad' ? '左搖桿移動・A 跳・B 飛撲' : 'WASD 移動・空白鍵跳・Shift 飛撲・拖曳滑鼠轉鏡頭';
      if (this.tutorialT <= 0) $('stickHint').style.opacity = '0';
    } else if (me && me.finished && this.mode === 'show' && !this.spectate) msg = '你晉級了！等其他豆豆過線…';
    else if (this.spectate) msg = '';
    UI.setText('hudMsg', msg);
    $('fps').hidden = !this.save.settings.fps;
    void force;
  }

  // ------------------------------------------------------------------------------
  // menus
  bindUI() {
    const click = (id, fn) => $(id).addEventListener('click', (e) => { e.preventDefault(); this.sound.unlock(); fn(e); });
    click('btnPlay', () => this.startShow());
    click('btnPractice', () => { this.sound.play('click'); this.openPractice(); });
    click('btnCustom', () => { this.sound.play('click'); this.openCustom(); });
    click('btnSettings', () => { this.sound.play('click'); this.openSettings(); });
    click('btnHelp', () => { this.sound.play('click'); UI.screen('help'); });
    click('btnFull', () => this.toggleFullscreen());
    click('btnPause', () => this.togglePause(true));
    click('pResume', () => this.togglePause(false));
    click('pSettings', () => this.openSettings());
    click('pHelp', () => UI.screen('help'));
    click('pQuit', () => this.mode === 'practice' ? this.enterLobbyFromPause() : this.leaveShow());
    click('eWatch', () => this.watch());
    click('eLeave', () => { this.sound.play('back'); $('elim').hidden = true; this.enterLobby(); });
    click('vDone', () => { this.sound.play('click'); this.enterLobby(); });
    click('sDone', () => { this.sound.play('click'); this.enterLobby(); });
    click('specPrev', () => this.pickSpectate(-1));
    click('specNext', () => this.pickSpectate(1));
    click('specLeave', () => { this.sound.play('back'); this.enterLobby(); });
    $('intro').addEventListener('pointerdown', () => { this.sound.unlock(); if (this.introT > 0.3) this.skipIntro(); });
    document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => {
      this.sound.play('back');
      const sec = b.closest('section');
      sec.hidden = true;
      if (sec.id === 'custom') this.closeCustom();
    }));
    // settings controls
    const st = this.save.settings;
    const rng = (id, key, fn) => {
      const el = $(id);
      el.value = st[key];
      el.addEventListener('input', () => { st[key] = parseFloat(el.value); fn && fn(); this.persist(); });
    };
    rng('sMusic', 'music', () => this.sound.setVolumes(st.music, st.sfx));
    rng('sSfx', 'sfx', () => { this.sound.setVolumes(st.music, st.sfx); this.sound.play('jump'); });
    rng('sSens', 'sens', () => { this.view.rig.sens = st.sens; });
    const tog = (id, key, fn) => {
      const el = $(id);
      const sync = () => el.classList.toggle('on', !!st[key]);
      sync();
      el.addEventListener('click', () => { st[key] = !st[key]; sync(); fn && fn(); this.persist(); this.sound.play('click'); });
    };
    tog('sInvert', 'invertY', () => { this.view.rig.invertY = st.invertY; });
    tog('sVibrate', 'vibrate', () => this.vibrate(30));
    tog('sFps', 'fps', () => { $('fps').hidden = !st.fps; });
    $('sQuality').addEventListener('click', (e) => {
      const v = e.target.dataset && e.target.dataset.v;
      if (!v) return;
      st.quality = v;
      this.persist();
      this.syncQuality();
      this.view.applyQuality(v);
      this.sound.play('click');
    });
    click('sReset', async () => {
      const ok = await UI.ask('清除所有進度？', '皇冠、豆幣、買過的造型和設定都會清掉，無法復原。', '清除', '取消');
      if (!ok) return;
      try { localStorage.removeItem('beanrush.v1'); } catch (_) { /* ignore */ }
      location.reload();
    });
    this.view.rig.sens = st.sens;
    this.view.rig.invertY = st.invertY;
    this.syncQuality();

    // customise name
    const nm = $('cuName');
    nm.addEventListener('input', () => { this.save.name = nm.value.trim().slice(0, 8); this.persist(); });
    nm.addEventListener('keydown', (e) => { if (e.key === 'Enter') nm.blur(); e.stopPropagation(); });
    nm.addEventListener('keyup', (e) => e.stopPropagation());

    // visibility: pause rounds and silence audio when the tab hides
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.sound.suspend(true);
        if (this.state === 'round' && (this.sub === 'play' || this.sub === 'count')) this.togglePause(true);
      } else this.sound.suspend(false);
    });
  }

  enterLobbyFromPause() {
    this.sound.play('back');
    this.paused = false;
    $('pause').hidden = true;
    this.enterLobby();
  }

  syncQuality() {
    const q = this.save.settings.quality;
    $('sQuality').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === q));
  }

  openSettings() {
    const st = this.save.settings;
    $('sMusic').value = st.music;
    $('sSfx').value = st.sfx;
    $('sSens').value = st.sens;
    this.syncQuality();
    UI.screen('settings');
  }

  toggleFullscreen() {
    const d = document;
    const el = d.documentElement;
    try {
      if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
      else (el.requestFullscreen || el.webkitRequestFullscreen).call(el, { navigationUI: 'hide' });
    } catch (_) { /* ignore */ }
  }

  openPractice() {
    const list = $('lvlList');
    list.innerHTML = '';
    for (const id of ['gate', 'boba', 'fruit', 'ring', 'hex', 'ringFinal']) {
      const d = LEVELS[id];
      const b = document.createElement('button');
      b.className = 'lvl';
      b.innerHTML = `<span class="tag ${d.type}">${TYPE_LABEL[d.type]}</span><b></b><small></small>`;
      b.querySelector('b').textContent = d.name;
      b.querySelector('small').textContent = d.tip;
      b.addEventListener('click', () => { this.sound.unlock(); this.sound.play('click'); $('practice').hidden = true; this.startPractice(id); });
      list.appendChild(b);
    }
    UI.screen('practice');
  }

  // ------------------------------------------------------------------------------
  // customisation
  openCustom() {
    this.state = 'custom';
    UI.only('custom');
    $('cuName').value = this.save.name;
    this.cuTab = this.cuTab || 'color';
    this.renderTabs();
    this.renderGrid();
  }

  closeCustom() {
    this.state = 'lobby';
    UI.only('title');
    this.updateTitle();
    if (this.sim && this.sim.player) this.sim.player.name = this.playerName();
  }

  renderTabs() {
    const tabs = $('cuTabs');
    tabs.innerHTML = '';
    for (const [k, label] of [['color', '顏色'], ['pattern', '花紋'], ['color2', '花紋色'], ['hat', '帽子']]) {
      const b = document.createElement('button');
      b.textContent = label;
      b.className = this.cuTab === k ? 'on' : '';
      b.addEventListener('click', () => { this.cuTab = k; this.sound.play('click'); this.renderTabs(); this.renderGrid(); });
      tabs.appendChild(b);
    }
    UI.setText('cuCoins', this.save.coins);
  }

  renderGrid() {
    const grid = $('cuGrid');
    grid.innerHTML = '';
    const k = this.cuTab;
    const look = this.save.look;
    const kind = k === 'color2' ? 'color' : k;
    const list = kind === 'color' ? COLORS : kind === 'pattern' ? PATTERNS : HATS;
    for (const it of list) {
      const owned = isOwned(this.save, kind, it.id);
      const on = look[k] === it.id;
      const el = document.createElement('button');
      el.className = 'item' + (on ? ' on' : '') + (owned ? '' : ' locked');
      if (kind === 'color') {
        el.innerHTML = `<span class="sw" style="background:${it.c}"></span>`;
      } else if (kind === 'pattern') {
        el.innerHTML = `<span class="sw" style="${patternCss(it.id, colorOf(look.color), colorOf(look.color2))}"></span>`;
      } else {
        el.innerHTML = `<span class="sw" style="background:#fff;display:flex;align-items:center;justify-content:center">${hatIcon(it.id)}</span>`;
      }
      const name = document.createElement('span');
      name.textContent = it.name;
      el.appendChild(name);
      if (!owned) {
        if (it.req) {
          const l = document.createElement('span');
          l.className = 'lock';
          l.textContent = '🔒';
          el.appendChild(l);
        } else {
          const p = document.createElement('span');
          p.className = 'price';
          p.innerHTML = UI.COIN_SVG + it.price;
          el.appendChild(p);
        }
      }
      el.addEventListener('click', () => this.pick(k, kind, it, owned));
      grid.appendChild(el);
    }
  }

  async pick(slot, kind, it, owned) {
    if (!owned) {
      if (it.req) { UI.toast(REQS[it.req].text); this.sound.play('deny'); return; }
      if (this.save.coins < it.price) { UI.toast(`豆幣不夠：還差 ${it.price - this.save.coins}`); this.sound.play('deny'); return; }
      const ok = await UI.ask('購買造型', `花 ${it.price} 豆幣購買「${it.name}」？`, '購買', '再想想');
      if (!ok) return;
      this.save.coins -= it.price;
      this.save.owned.push(kind + ':' + it.id);
      this.sound.play('buy');
    } else this.sound.play('click');
    this.save.look[slot] = it.id;
    this.persist();
    const me = this.sim && this.sim.player;
    if (me) {
      me.look = this.save.look;
      me.frozen = false;
      me.jumpPressed = true;
      this.later(0.05, () => { if (this.sim && this.sim.player === me) me.frozen = true; });
    }
    this.renderTabs();
    this.renderGrid();
  }
}

function btn(text, cls, fn) {
  const b = document.createElement('button');
  b.className = 'btn ' + cls;
  b.textContent = text;
  b.addEventListener('click', fn);
  return b;
}

function patternCss(id, a, b) {
  switch (id) {
    case 1: return `background:repeating-linear-gradient(0deg,${a} 0 6px,${b} 6px 12px)`;
    case 2: return `background:radial-gradient(circle,${b} 0 3.5px,transparent 4px) 0 0/11px 11px,${a}`;
    case 3: return `background:linear-gradient(${a} 0 55%,${b} 55%)`;
    case 4: return `background:radial-gradient(ellipse 45% 40% at 50% 70%,${b} 0 98%,transparent 100%),${a}`;
    case 5: return `background:conic-gradient(${a} 0 25%,${b} 0 50%,${a} 0 75%,${b} 0) 0 0/14px 14px`;
    case 6: return `background:repeating-linear-gradient(-30deg,${a} 0 6px,${b} 6px 12px)`;
    case 7: return `background:linear-gradient(90deg,${b} 0 50%,${a} 50%)`;
    default: return `background:${a}`;
  }
}

function hatIcon(id) {
  const I = {
    none: '<svg viewBox="0 0 24 24" width="26"><circle cx="12" cy="12" r="8" fill="none" stroke="#b9b7d6" stroke-width="2.5"/><path d="M6 18L18 6" stroke="#b9b7d6" stroke-width="2.5"/></svg>',
    cap: '<svg viewBox="0 0 24 24" width="28"><path d="M4 15a8 8 0 0 1 16 0z" fill="#ff4f5e" stroke="#2b2d5c" stroke-width="1.6"/><path d="M14 15h8v2h-8z" fill="#e23a4a" stroke="#2b2d5c" stroke-width="1.4"/></svg>',
    party: '<svg viewBox="0 0 24 24" width="28"><path d="M12 3l6 17H6z" fill="#ff5fa2" stroke="#2b2d5c" stroke-width="1.6" stroke-linejoin="round"/><circle cx="12" cy="3.5" r="2.2" fill="#fff" stroke="#2b2d5c" stroke-width="1.2"/></svg>',
    cat: '<svg viewBox="0 0 24 24" width="28"><path d="M3 18l3-12 5 7zM21 18l-3-12-5 7z" fill="#ff9a3c" stroke="#2b2d5c" stroke-width="1.6" stroke-linejoin="round"/></svg>',
    bunny: '<svg viewBox="0 0 24 24" width="28"><ellipse cx="8" cy="10" rx="3" ry="8" fill="#fff" stroke="#2b2d5c" stroke-width="1.6"/><ellipse cx="16" cy="10" rx="3" ry="8" fill="#fff" stroke="#2b2d5c" stroke-width="1.6"/><ellipse cx="8" cy="10" rx="1.4" ry="5" fill="#ffb3cf"/><ellipse cx="16" cy="10" rx="1.4" ry="5" fill="#ffb3cf"/></svg>',
    douli: '<svg viewBox="0 0 24 24" width="30"><path d="M12 5l10 10H2z" fill="#e9c46a" stroke="#2b2d5c" stroke-width="1.6" stroke-linejoin="round"/><rect x="7" y="15" width="10" height="2.4" fill="#d6453d" stroke="#2b2d5c" stroke-width="1.2"/></svg>',
    miner: '<svg viewBox="0 0 24 24" width="28"><path d="M4 16a8 8 0 0 1 16 0z" fill="#ffd23f" stroke="#2b2d5c" stroke-width="1.6"/><circle cx="12" cy="11" r="2.6" fill="#fff6a8" stroke="#2b2d5c" stroke-width="1.4"/><rect x="2" y="16" width="20" height="2" fill="#f2b51a" stroke="#2b2d5c" stroke-width="1.2"/></svg>',
    helmet: '<svg viewBox="0 0 24 24" width="28"><path d="M4 16a8 8 0 0 1 16 0z" fill="#56c2ff" stroke="#2b2d5c" stroke-width="1.6"/><rect x="11" y="7" width="2" height="9" fill="#fff"/><rect x="13" y="15" width="7" height="2.4" fill="#2b2d5c"/></svg>',
    boba: '<svg viewBox="0 0 24 24" width="28"><path d="M6 6h12l-2 15H8z" fill="#e9c9a0" stroke="#2b2d5c" stroke-width="1.6" stroke-linejoin="round"/><path d="M14 6l3-5" stroke="#ff5fa2" stroke-width="2"/><circle cx="10" cy="18" r="1.3" fill="#3a2216"/><circle cx="13" cy="17" r="1.3" fill="#3a2216"/><circle cx="12" cy="19.5" r="1.3" fill="#3a2216"/></svg>',
    pineapple: '<svg viewBox="0 0 24 24" width="28"><ellipse cx="12" cy="15" rx="6" ry="7" fill="#ffb627" stroke="#2b2d5c" stroke-width="1.6"/><path d="M12 8L9 1M12 8l3-7M12 8V1" stroke="#3fae4f" stroke-width="2.2" stroke-linecap="round"/></svg>',
    chef: '<svg viewBox="0 0 24 24" width="28"><rect x="7" y="13" width="10" height="7" fill="#fff" stroke="#2b2d5c" stroke-width="1.6"/><circle cx="8" cy="10" r="4" fill="#fff" stroke="#2b2d5c" stroke-width="1.6"/><circle cx="16" cy="10" r="4" fill="#fff" stroke="#2b2d5c" stroke-width="1.6"/><circle cx="12" cy="8" r="4.5" fill="#fff" stroke="#2b2d5c" stroke-width="1.6"/></svg>',
    flower: '<svg viewBox="0 0 24 24" width="28"><path d="M12 13v9" stroke="#3fae4f" stroke-width="2"/><g fill="#ff86c8" stroke="#2b2d5c" stroke-width="1.2"><circle cx="12" cy="5" r="3"/><circle cx="17" cy="9" r="3"/><circle cx="15" cy="14" r="3"/><circle cx="9" cy="14" r="3"/><circle cx="7" cy="9" r="3"/></g><circle cx="12" cy="10" r="2.4" fill="#ffd23f" stroke="#2b2d5c" stroke-width="1.2"/></svg>',
    chick: '<svg viewBox="0 0 24 24" width="28"><ellipse cx="12" cy="16" rx="7" ry="5.5" fill="#ffe14d" stroke="#2b2d5c" stroke-width="1.6"/><circle cx="14" cy="8" r="4.2" fill="#ffe14d" stroke="#2b2d5c" stroke-width="1.6"/><path d="M18 8l3 1-3 1z" fill="#ff9a3c"/><circle cx="15.2" cy="7.2" r="0.9" fill="#2b2d5c"/></svg>',
    propeller: '<svg viewBox="0 0 24 24" width="28"><path d="M5 18a7 7 0 0 1 14 0z" fill="#5fd3ff" stroke="#2b2d5c" stroke-width="1.6"/><path d="M12 11V6" stroke="#2b2d5c" stroke-width="1.6"/><path d="M3 5h9M12 6h9" stroke="#ff5468" stroke-width="2.6" stroke-linecap="round"/></svg>',
    crown: '<svg viewBox="0 0 24 24" width="28"><path d="M3 8l4 3 5-6 5 6 4-3-2 11H5z" fill="#ffd23f" stroke="#2b2d5c" stroke-width="1.6" stroke-linejoin="round"/></svg>',
  };
  return I[id] || I.none;
}

export { lerpAngle };
