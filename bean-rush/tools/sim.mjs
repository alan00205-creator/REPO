// Headless balance runner: node tools/sim.mjs [levelId] [runs] [count]
// Plays rounds with bots only and prints timing / fall statistics.

import { Sim, STEP } from '../src/sim.js';
import { LEVELS } from '../src/levels/index.js';

const id = process.argv[2] || 'gate';
const runs = +(process.argv[3] || 3);
const count = +(process.argv[4] || 30);
const def = LEVELS[id];
if (!def) { console.error('unknown level', id, Object.keys(LEVELS)); process.exit(1); }

for (let r = 0; r < runs; r++) {
  const contestants = [];
  for (let i = 0; i < count; i++) contestants.push({ id: i, name: 'bot' + i, isPlayer: false, skill: (i % 10) / 9 });
  const quota = def.type === 'race' ? Math.round(count * 0.66) : 1;
  const targetAlive = def.type === 'survival' ? Math.ceil(count / 2) : 1;
  const t0 = performance.now();
  const sim = new Sim({ def, contestants, seed: 1000 + r * 7, quota, targetAlive });
  sim.startCountdown();
  sim.phaseT = 3;
  let steps = 0;
  const maxSteps = 60 * 400;
  while (sim.phase !== 'done' && steps < maxSteps) {
    sim.step(STEP);
    steps++;
    sim.events.length = 0;
  }
  const ms = performance.now() - t0;
  const fin = sim.beans.filter((b) => b.finished).map((b) => b.finishT);
  const falls = sim.beans.reduce((a, b) => a + b.stats.falls, 0);
  const hits = sim.beans.reduce((a, b) => a + b.stats.hits, 0);
  console.log(`[${id} #${r}] end=${sim.endReason} t=${sim.t.toFixed(1)}s qualified=${sim.qualified.length} alive=${sim.aliveCount} falls=${falls} hits=${hits} sim=${(ms).toFixed(0)}ms (${(ms / (steps / 60)).toFixed(2)} ms per sim-second)`);
  if (fin.length) console.log('   finish times:', fin.map((t) => t.toFixed(1)).join(' '));
  if (def.type === 'race') {
    const unf = sim.beans.filter((b) => !b.finished);
    const where = unf.map((b) => `${b.id}(s${b.contestant.skill.toFixed(1)}) z=${b.pos.z.toFixed(0)} y=${b.pos.y.toFixed(1)} cp${b.checkpoint} f${b.stats.falls}`);
    console.log('   not finished:', where.join(' | '));
  } else {
    console.log('   eliminations at:', sim.eliminated.map((b) => (b.outT ?? 0).toFixed(0)).join(' '));
    if (sim.winner) console.log('   winner', sim.winner.id, 'skill', sim.winner.contestant.skill.toFixed(2));
  }
}
