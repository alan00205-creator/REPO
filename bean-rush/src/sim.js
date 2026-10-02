// One round of play: world + level + beans + rules. Runs identically in the browser and in
// Node (headless balance tests), so it never touches the DOM or WebGL.

import { World } from './physics.js';
import { Bean, separateBeans } from './bean.js';
import { makeRng } from './util.js';
import { Kit } from './levelkit.js';
import { makeBrain } from './ai.js';

export const STEP = 1 / 60;

export class Sim {
  // o: { def, contestants:[{id,name,isPlayer,look,skill}], seed, quota, gfx, practice }
  constructor(o) {
    this.def = o.def;
    this.seed = o.seed >>> 0;
    this.rng = makeRng(this.seed);
    this.world = new World();
    this.t = 0; // time since play started (negative during intro/countdown)
    this.time = 0; // total sim time
    this.phase = 'intro';
    this.phaseT = 0;
    this.events = [];
    this.beans = [];
    this.quota = o.quota;
    this.practice = !!o.practice;
    this.qualified = [];
    this.eliminated = [];
    this.winner = null;
    this.ended = false;
    this.endReason = '';
    this.timeScale = 1;

    this.kit = new Kit(this.world, o.gfx || null, this.rng);
    this.level = this.def.build({ world: this.world, rng: this.rng, kit: this.kit, sim: this, count: o.contestants.length });
    this.kit.finish();
    this.type = this.def.type;

    const spawns = this.level.spawns(o.contestants.length, this.rng);
    o.contestants.forEach((c, i) => {
      const b = new Bean(c.id, { name: c.name, isPlayer: c.isPlayer, look: c.look, speedMul: c.isPlayer ? 1 : 0.9 + 0.1 * (c.skill ?? 0.5) });
      b.contestant = c;
      const s = spawns[i];
      b.place3(s.x, s.y, s.z, s.yaw);
      b.frozen = true;
      if (!c.isPlayer) b.brain = makeBrain(this, b, c.skill ?? 0.5);
      this.beans.push(b);
    });
    this.player = this.beans.find((b) => b.isPlayer) || null;

    this.duration = this.level.duration || 0; // survival length (0 = none)
    this.timeLimit = this.level.timeLimit || 0; // race hard limit
    this.targetAlive = o.targetAlive ?? 1;
  }

  emit(type, bean, extra) {
    this.events.push({ type, bean, extra });
  }

  aliveBeans() {
    return this.beans.filter((b) => !b.out);
  }

  get aliveCount() {
    let n = 0;
    for (const b of this.beans) if (!b.out) n++;
    return n;
  }

  startCountdown() {
    if (this.phase === 'intro') { this.phase = 'countdown'; this.phaseT = 0; }
  }

  startPlay() {
    this.phase = 'play';
    this.phaseT = 0;
    this.t = 0;
    for (const b of this.beans) b.frozen = false;
    this.emit('go');
  }

  step(dt) {
    this.time += dt;
    this.phaseT += dt;
    if (this.phase === 'countdown' && this.phaseT >= 3) this.startPlay();
    if (this.phase === 'play' || this.phase === 'over') this.t += dt;

    const L = this.level;
    for (const body of this.world.bodies) if (body.kinematic) body.savePrev();
    L.update(this.t, dt, this);
    for (const body of this.world.bodies) if (body.kinematic) body.updateWorld();

    for (const b of this.beans) {
      if (!b.active) continue;
      if (b.respawnT > 0) {
        b.respawnT -= dt;
        if (b.respawnT <= 0) this.respawn(b);
        continue;
      }
      if (b.brain && this.phase !== 'intro') b.brain.think(dt);
      b.step(dt, this);
    }
    separateBeans(this.beans);

    if (this.phase === 'play' || this.phase === 'over') this.rules(dt);
    else this.keepOnStart();
  }

  // Before GO, nobody may fall off or wander.
  keepOnStart() {
    for (const b of this.beans) {
      if (b.pos.y < this.level.killY) {
        const s = this.level.spawns(this.beans.length, this.rng)[this.beans.indexOf(b)];
        b.place3(s.x, s.y, s.z, s.yaw);
      }
    }
  }

  respawn(b) {
    const L = this.level;
    const cp = L.checkpoints[b.checkpoint] || L.checkpoints[0];
    const s = cp.spawn(this.rng);
    b.place3(s.x, s.y, s.z, s.yaw);
    b.respawnT = 0;
    b.knockCd = 0.6;
    this.emit('respawn', b);
    if (b.brain) b.brain.onRespawn();
  }

  rules() {
    const L = this.level;
    const playing = this.phase === 'play';
    for (const b of this.beans) {
      if (!b.active || b.out || b.respawnT > 0) continue;
      // checkpoints
      if (L.checkpoints) {
        for (let i = b.checkpoint + 1; i < L.checkpoints.length; i++) {
          if (L.checkpoints[i].test(b.pos)) { b.checkpoint = i; if (b.isPlayer) this.emit('checkpoint', b); }
        }
      }
      // falling
      if (b.pos.y < L.killY) {
        b.stats.falls++;
        this.emit('splash', b);
        if ((this.type === 'race' || this.type === 'lobby') && !b.finished) {
          b.respawnT = 1.1;
        } else if (!b.finished) {
          this.eliminate(b, 'fall');
        } else {
          b.respawnT = 0.8;
        }
        continue;
      }
      if (this.type === 'race' && !b.finished && playing && L.finish(b.pos)) this.finishBean(b);
    }

    if (!playing) {
      if (this.phase === 'over' && this.phaseT > 3.2) this.phase = 'done';
      return;
    }

    if (L.rule) L.rule(this);

    if (this.type === 'race') {
      const done = this.qualified.length >= this.quota || this.beans.every((b) => b.finished || b.out);
      if (done) this.endRound('quota');
      else if (this.timeLimit && this.t >= this.timeLimit) this.endRound('time');
    } else if (this.type === 'survival') {
      if (this.aliveCount <= this.targetAlive) this.endRound('quota');
      else if (this.duration && this.t >= this.duration) this.endRound('time');
      else if (L.done && L.done(this)) this.endRound('time');
    } else if (this.type === 'final') {
      if (this.aliveCount <= 1) this.endRound('winner');
      else if (this.duration && this.t >= this.duration) this.endRound('time');
    }
  }

  finishBean(b) {
    b.finished = true;
    b.finishT = this.t;
    b.place = this.qualified.length + 1;
    this.qualified.push(b);
    this.emit('finish', b, b.place);
  }

  eliminate(b, why) {
    if (b.out) return;
    b.out = true;
    b.outT = this.t;
    b.respawnT = 0;
    b.active = false;
    this.eliminated.push(b);
    this.emit('out', b, why);
  }

  endRound(reason) {
    if (this.ended) return;
    this.ended = true;
    this.endReason = reason;
    this.phase = 'over';
    this.phaseT = 0;
    if (this.type === 'race') {
      for (const b of this.beans) if (!b.finished && !b.out) { b.out = true; this.eliminated.push(b); }
    } else if (this.type === 'survival') {
      for (const b of this.beans) if (!b.out) this.qualified.push(b);
    } else if (this.type === 'final') {
      const alive = this.beans.filter((b) => !b.out);
      if (alive.length === 1) this.winner = alive[0];
      else if (alive.length > 1) {
        // time ran out: highest bean wins (hex) — otherwise first alive
        alive.sort((a, b) => b.pos.y - a.pos.y);
        this.winner = alive[0];
      } else {
        // everyone fell at once: last to fall wins
        const last = this.eliminated[this.eliminated.length - 1];
        this.winner = last || null;
      }
      if (this.winner) {
        this.winner.out = false;
        for (const b of this.beans) if (b !== this.winner && !b.out) { b.out = true; this.eliminated.push(b); }
        this.qualified = [this.winner];
      }
    }
    this.emit('roundEnd', null, reason);
  }
}
