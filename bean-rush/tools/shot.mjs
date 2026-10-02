// Browser smoke test: node tools/shot.mjs [scenario] [outdir]
import { createRequire } from 'node:module';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium, devices } = require('playwright');
import { pathToFileURL } from 'node:url';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const url = pathToFileURL(join(here, '..', 'index.html')).href;
const pos = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const scenario = pos[0] || 'lobby';
const out = pos[1] || '/tmp/claude-0/shots';
const mobile = process.argv.includes('--mobile');
const portrait = process.argv.includes('--portrait');

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const ctx = mobile
  ? await browser.newContext({ ...devices['iPhone 13'], viewport: portrait ? { width: 390, height: 844 } : { width: 844, height: 390 }, isMobile: true, hasTouch: true })
  : await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
await page.goto(url + (process.argv.includes('--seed') ? '?seed=1' : ''));
await page.waitForTimeout(2500);
const tag = (mobile ? (portrait ? 'mp-' : 'ml-') : 'd-') + scenario;
const shot = async (name) => { await page.screenshot({ path: join(out, `${tag}-${name}.png`) }); };

async function practice(id, wait = 6000) {
  await page.click('#btnPractice');
  await page.waitForTimeout(400);
  await page.evaluate((id) => { window.__game.startPractice(id); document.getElementById('practice').hidden = true; }, id);
  await page.waitForTimeout(1800);
  await shot('flyover');
  await page.evaluate(() => window.__game.skipIntro());
  await page.waitForTimeout(3600);
  await shot('start');
  if (mobile) {
    // drive with real touch-type pointer events: left-thumb joystick forward, tap jump
    const vp = page.viewportSize();
    const sx = 120, sy = vp.height - 110;
    await page.evaluate(([sx, sy]) => {
      const L = document.getElementById('touchLayer');
      const o = { pointerId: 7, pointerType: 'touch', bubbles: true, clientX: sx, clientY: sy };
      L.dispatchEvent(new PointerEvent('pointerdown', o));
      window.dispatchEvent(new PointerEvent('pointermove', { ...o, clientY: sy - 60 }));
    }, [sx, sy]);
    await page.waitForTimeout(wait);
    await shot('run');
    await page.evaluate(() => {
      const b = document.getElementById('btnJump');
      b.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 8, pointerType: 'touch', bubbles: true }));
      setTimeout(() => b.dispatchEvent(new PointerEvent('pointerup', { pointerId: 8, pointerType: 'touch', bubbles: true })), 120);
    });
    await page.waitForTimeout(250);
    await shot('jump');
  } else {
    // hold forward for a while
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(wait);
    await shot('run');
    await page.keyboard.press('Space');
    await page.waitForTimeout(300);
    await shot('jump');
    await page.keyboard.up('KeyW');
  }
}

if (scenario === 'lobby') {
  await shot('lobby');
  await page.click('#btnCustom');
  await page.waitForTimeout(800);
  await shot('custom');
  await page.click('#cuTabs button:nth-child(4)');
  await page.waitForTimeout(300);
  await shot('custom-hats');
  await page.click('#custom [data-close]');
  await page.click('#btnSettings');
  await page.waitForTimeout(500);
  await shot('settings');
} else if (scenario === 'flow') {
  // whole show, fast-forwarded through game internals; waits on game state, not wall time
  const until = (fn, t = 60000) => page.waitForFunction(fn, null, { timeout: t, polling: 200 });
  await page.click('#btnPlay');
  await until(() => window.__game.state === 'round' && window.__game.sub === 'intro');
  await page.waitForTimeout(800);
  await shot('1-intro');
  await page.evaluate(() => window.__game.skipIntro());
  await until(() => window.__game.sub === 'play');
  await shot('2-play');
  await page.evaluate(() => { const g = window.__game, s = g.sim; s.finishBean(s.player); s.emit('finish', s.player, s.player.place); g.handleEvents(); });
  await page.waitForTimeout(500);
  await shot('3-qualified');
  await page.evaluate(() => { const s = window.__game.sim; for (const b of s.beans) if (!b.finished && s.qualified.length < s.quota) s.finishBean(b); });
  await until(() => window.__game.sub === 'results');
  await page.waitForTimeout(600);
  await shot('4-results');
  await page.evaluate(() => window.__game.nextRound());
  await until(() => window.__game.sub === 'intro');
  await page.evaluate(() => window.__game.skipIntro());
  await until(() => window.__game.sub === 'play');
  await page.evaluate(() => { const s = window.__game.sim; if (s.type === 'race') { for (const b of s.beans) if (!b.isPlayer && s.qualified.length < s.quota) s.finishBean(b); } else { s.eliminate(s.player, 'fall'); } });
  await until(() => !document.getElementById('elim').hidden);
  await page.waitForTimeout(600);
  await shot('5-elim');
  await page.click('#eWatch');
  await page.waitForTimeout(2500);
  await shot('6-spectate');
} else if (scenario === 'win') {
  const until = (fn, t = 60000) => page.waitForFunction(fn, null, { timeout: t, polling: 200 });
  await page.evaluate(() => window.__game.startShow());
  await until(() => window.__game.state === 'round');
  await page.evaluate(() => { const g = window.__game; g.show.idx = 3; g.show.alive = g.show.contestants.slice(0, 8); if (!g.show.alive.some((c) => c.isPlayer)) g.show.alive[0] = g.show.contestants.find((c) => c.isPlayer); g.beginRound(); });
  await until(() => window.__game.sub === 'intro');
  await page.waitForTimeout(1500);
  await shot('1-final-intro');
  await page.evaluate(() => window.__game.skipIntro());
  await until(() => window.__game.sub === 'play');
  await page.evaluate(() => { const s = window.__game.sim; for (const b of s.beans) if (!b.isPlayer) s.eliminate(b, 'fall'); });
  await page.waitForTimeout(1200);
  await shot('2-champion');
  await until(() => window.__game.state === 'end');
  await page.waitForTimeout(1200);
  await shot('3-victory');
} else if (scenario === 'show') {
  await page.click('#btnPlay');
  await page.waitForTimeout(1500);
  await shot('match');
  await page.waitForTimeout(3500);
  await shot('intro');
} else {
  await practice(scenario, +(process.argv.find((a) => a.startsWith('--wait='))?.slice(7) || 6000));
}
const info = await page.evaluate(() => {
  const g = window.__game;
  const r = g.view.renderer.info;
  return { calls: r.render.calls, tris: r.render.triangles, fps: g.fps.v.toFixed(1), state: g.state, sub: g.sub, pos: g.sim && g.sim.player ? g.sim.player.pos.toArray().map((v) => v.toFixed(1)) : null };
});
console.log(JSON.stringify(info));
console.log(errors.length ? errors.slice(0, 15).join('\n') : 'no console errors');
await browser.close();
