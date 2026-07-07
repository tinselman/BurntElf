/* Headless logic tests: Pokemon maths + a scripted battle through battle.js. */
global.window = {};
require('../js/data.js');
require('../js/pokemon.js');
var SS = global.window.SS;

function assert(c, m) { if (!c) { console.error('FAIL: ' + m); process.exitCode = 1; } else console.log('ok  ' + m); }

/* ---- stat / model sanity ---- */
var cynda = SS.createPokemon('cyndaquil', 5);
assert(cynda.maxHP > 0 && cynda.hp === cynda.maxHP, 'cyndaquil has full HP at L5 (' + cynda.maxHP + ')');
assert(cynda.moves.length >= 1 && cynda.moves.length <= 4, 'has 1-4 moves (' + cynda.moves.map(m=>m.id) + ')');
assert(cynda.stats.spe === Math.floor(2*65*5/100)+5, 'speed stat formula');

/* ---- type effectiveness ---- */
assert(SS.typeEffectiveness('water', ['fire']) === 2, 'water>fire = 2x');
assert(SS.typeEffectiveness('electric', ['ground']) === 0, 'electric>ground = 0x');
assert(SS.typeEffectiveness('grass', ['water']) === 2, 'grass>water = 2x');
assert(SS.typeEffectiveness('normal', ['normal']) === 1, 'normal>normal = 1x');
assert(SS.typeEffectiveness('fire', ['grass']) === 2, 'fire>grass = 2x');

/* ---- damage in range ---- */
var totodile = SS.createPokemon('totodile', 5);
var minD = Infinity, maxD = 0;
for (var i = 0; i < 400; i++) {
  var r = SS.calcDamage(cynda, totodile, SS.MOVES.ember); // fire vs water = 0.5x
  if (!r.missed) { minD = Math.min(minD, r.dmg); maxD = Math.max(maxD, r.dmg); }
}
assert(minD >= 1 && maxD < totodile.maxHP * 2, 'ember dmg in sane range (' + minD + '-' + maxD + ')');

/* ---- exp / level up ---- */
var rat = SS.createPokemon('rattata', 3);
var before = rat.level;
var ev = SS.addExp(rat, 100000);
assert(rat.level > before, 'rattata leveled up with big EXP (L' + before + ' -> L' + rat.level + ')');
assert(rat.maxHP >= 1, 'maxHP recomputed after level');

/* ---- catch: guaranteed on weak high-catch-rate mon ---- */
var caught = 0;
for (var j = 0; j < 200; j++) {
  var wp = SS.createPokemon('pidgey', 2); wp.hp = 1;   // 1 HP, catchRate 255
  if (SS.catchAttempt(wp, 1).caught) caught++;
}
assert(caught > 150, 'weak pidgey caught most of the time (' + caught + '/200)');

/* ============ scripted battle via battle.js (stub the UI deps) ============ */
global.document = null;
SS.Render = {}; // battle.draw is never called in this test
require('../js/battle.js');

// Minimal Game stub.
var log = [];
var Game = {
  scene: null, player: { party: [SS.createPokemon('cyndaquil', 8)], box: [], bag: { ball: 5, potion: 3 }, money: 0 },
  justPressed: {},
  say: function (lines, cb) { log.push('SAY:' + lines.join(' / ')); if (cb) cb(); },
  save: function () {}
};

var wild = SS.createPokemon('rattata', 3);
SS.Battle.start(Game, wild);
assert(Game.scene === 'battle', 'battle started');

// Drive the battle: mash A (advance messages / pick FIGHT -> first move) until it ends.
var guard = 0;
function press(k) { Game.justPressed = {}; Game.justPressed[k] = true; SS.Battle.handleInput(); }
while (Game.scene === 'battle' && guard++ < 500) {
  // Always try to advance messages or confirm the top-left option / first move.
  press('a');
}
assert(guard < 500, 'battle terminated (turns=' + guard + ')');
assert(Game.scene === 'world' || log.some(l=>l.indexOf('New Bark')>=0), 'returned to overworld or whited out');
console.log('\nbattle ended, scene=' + Game.scene + ', cynda HP=' + Game.player.party[0].hp + '/' + Game.player.party[0].maxHP);

console.log('\n' + (process.exitCode ? 'SOME TESTS FAILED' : 'ALL TESTS PASSED'));
