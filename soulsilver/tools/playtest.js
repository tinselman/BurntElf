/* Headless browser playtest: boots the game, drives input, catches JS errors,
 * and screenshots key scenes. Run: node tools/playtest.js */
const { chromium } = require(process.env.PW || 'playwright-core');
const path = require('path');

// Override with CHROME=/path/to/chrome (or headless_shell) for your environment.
const EXE = process.env.CHROME || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const URL = 'file://' + path.resolve(__dirname, '../index.html');
const OUT = process.env.OUT || '/tmp/ss-shots';

const KEY = { up:'ArrowUp', down:'ArrowDown', left:'ArrowLeft', right:'ArrowRight', a:'z', b:'x' };

(async () => {
  require('fs').mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 400, height: 780 } });

  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));

  await page.goto(URL);
  await page.waitForTimeout(300);

  const tap = async (k, hold = 60) => {
    await page.keyboard.down(KEY[k]); await page.waitForTimeout(hold);
    await page.keyboard.up(KEY[k]); await page.waitForTimeout(90);
  };
  const walk = async (k, n) => { for (let i = 0; i < n; i++) await tap(k, 160); };
  const state = () => page.evaluate(() => {
    const g = window.SS.Game.ref;
    return { scene: g.scene, overlay: g.overlay,
             pos: g.player ? [g.player.map, g.player.x, g.player.y] : null,
             party: g.player ? g.player.party.map(m => m.name + ' L' + m.level + ' ' + m.hp + '/' + m.maxHP) : [] };
  });

  await page.screenshot({ path: OUT + '/01-title.png' });
  console.log('title:', await state());

  // NEW GAME
  await tap('a');                         // confirm NEW GAME
  await tap('a'); await tap('a'); await tap('a');  // clear Mom's dialog
  console.log('after intro:', await state());
  await page.screenshot({ path: OUT + '/02-town.png' });

  // Walk to Elm's lab: from (5,6) go to door (9,3). Right x4, up x3, enter.
  await walk('right', 4);                 // x 5->9
  await walk('up', 3);                    // y 6->3 (onto door -> warp to lab)
  await page.waitForTimeout(200);
  await tap('a');                         // clear "... Elm's Lab ..."
  console.log('entered lab?:', await state());
  await page.screenshot({ path: OUT + '/03-lab.png' });

  // In lab spawn (4,5). Walk up to face machine at (4,3): up to (4,4), face up.
  await walk('up', 1);                    // (4,5)->(4,4)
  await tap('up', 80);                    // face up (blocked by machine, sets dir)
  await tap('a');                         // trigger starter choice
  await page.waitForTimeout(150);
  console.log('starter menu:', await state());
  await page.screenshot({ path: OUT + '/04-starter.png' });
  await tap('a');                         // pick Chikorita (index 0)
  await tap('a'); await tap('a');         // clear "received / head west"
  console.log('after starter:', await state());

  // Leave lab: go down to door (4,6).
  await walk('down', 2);
  await page.waitForTimeout(150);
  await tap('a');                         // clear warp msg
  console.log('back in town:', await state());
  await page.screenshot({ path: OUT + '/05-back-town.png' });

  // Head to Route 29: south exit at (5/6,11). From lab door we re-enter town at (9,4).
  await walk('down', 6);                  // move toward bottom
  await walk('left', 3);
  await walk('down', 4);
  await page.waitForTimeout(150);
  await tap('a');                         // clear route warp msg if any
  console.log('route try:', await state());
  await page.screenshot({ path: OUT + '/06-route.png' });

  // Wander tall grass to trigger an encounter.
  let battled = false;
  for (let i = 0; i < 40 && !battled; i++) {
    await tap(i % 2 ? 'left' : 'down', 150);
    const s = await state();
    if (s.scene === 'battle') { battled = true; console.log('BATTLE at step', i, s); }
  }
  await page.screenshot({ path: OUT + '/07-battle.png' });

  if (battled) {
    // Fight: A to advance intro, then FIGHT -> first move a few times.
    for (let i = 0; i < 30; i++) {
      await tap('a', 60);
      const s = await state();
      if (s.scene !== 'battle') { console.log('battle ended -> ', s); break; }
    }
    await page.screenshot({ path: OUT + '/08-after-battle.png' });
  }

  console.log('final:', await state());
  console.log('\nERRORS:', errors.length ? errors : 'none');
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error('DRIVER CRASH', e); process.exit(2); });
