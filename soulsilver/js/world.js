/* =============================================================================
 * world.js  —  The overworld scene.
 *
 * Pure grid/entity logic (tile coordinates, walkability, warps, encounters).
 * It reads the shared input from Game and renders through SS.Render.  Nothing
 * here assumes a 2-D screen beyond the render calls, so a 3-D renderer can drop
 * in unchanged.
 * =========================================================================== */

var SS = window.SS || {};

SS.World = (function () {
  var BLOCKED = '#WHFspC-';        // characters the player cannot stand on
  var STEP_MS = 140;               // time to walk one tile

  var G;                           // reference to Game (set in enter)

  function map() { return SS.MAPS[G.player.map]; }

  function tileAt(mp, x, y) {
    if (y < 0 || y >= mp.grid.length) return '#';
    var row = mp.grid[y];
    if (x < 0 || x >= row.length) return '#';
    return row[x];
  }

  function walkable(mp, x, y) {
    return BLOCKED.indexOf(tileAt(mp, x, y)) === -1;
  }

  /* Place the player into a map (used on new game and on every warp). */
  function enter(game, mapId, x, y, dir) {
    G = game;
    G.player.map = mapId;
    G.player.x = x;
    G.player.y = y;
    G.player.dir = dir || 'down';
    G.player.px = 0;                // pixel offset while stepping
    G.player.py = 0;
    G.player.moving = false;
    G.player.justEntered = true;    // don't fire the warp we spawned on
    G.scene = 'world';
  }

  /* Begin a step in a direction if the target tile is open. */
  function tryStep(dir) {
    var p = G.player, mp = map();
    p.dir = dir;
    var dx = dir === 'left' ? -1 : dir === 'right' ? 1 : 0;
    var dy = dir === 'up' ? -1 : dir === 'down' ? 1 : 0;
    if (walkable(mp, p.x + dx, p.y + dy)) {
      p.moving = true;
      p.justEntered = false;       // any real step re-enables warp triggers
      p.stepDx = dx; p.stepDy = dy; p.stepT = 0;
    }
  }

  function onArrive() {
    var p = G.player, mp = map();
    // Warp?
    for (var i = 0; i < (mp.warps || []).length; i++) {
      var w = mp.warps[i];
      if (w.x === p.x && w.y === p.y && !p.justEntered) {
        enter(G, w.to, w.tx, w.ty, p.dir);
        G.say(['... ' + SS.MAPS[w.to].name + ' ...']);
        return;
      }
    }
    p.justEntered = false;

    // Heal tile (Cherrygrove Poke-Center counter reachable variant).
    var key = p.x + ',' + p.y;
    if (mp.healTiles && mp.healTiles[key]) { healParty(); return; }

    // Wild encounter in tall grass.
    if (tileAt(mp, p.x, p.y) === '~' && SS.ENCOUNTERS[G.player.map]) {
      if (Math.random() < 0.18) startWildEncounter();
    }
  }

  function healParty() {
    for (var i = 0; i < G.player.party.length; i++) {
      var m = G.player.party[i];
      m.hp = m.maxHP; m.status = null;
      for (var j = 0; j < m.moves.length; j++) m.moves[j].pp = m.moves[j].maxpp;
    }
    G.say(['Your Pokemon are fully healed!', 'We hope to see you again!']);
  }

  function startWildEncounter() {
    var table = SS.ENCOUNTERS[G.player.map];
    var total = table.reduce(function (s, e) { return s + e.weight; }, 0);
    var roll = Math.random() * total, pick = table[0];
    for (var i = 0; i < table.length; i++) {
      roll -= table[i].weight;
      if (roll <= 0) { pick = table[i]; break; }
    }
    var lvl = pick.min + Math.floor(Math.random() * (pick.max - pick.min + 1));
    var wild = SS.createPokemon(pick.species, lvl);
    SS.Battle.start(G, wild);
  }

  /* A / interact button: read signs, use starter machine, talk to the counter. */
  function interact() {
    var p = G.player, mp = map();
    var dx = p.dir === 'left' ? -1 : p.dir === 'right' ? 1 : 0;
    var dy = p.dir === 'up' ? -1 : p.dir === 'down' ? 1 : 0;
    var fx = p.x + dx, fy = p.y + dy;
    var ch = tileAt(mp, fx, fy), key = fx + ',' + fy;

    if (mp.starterTiles && mp.starterTiles[key] && G.player.party.length === 0) {
      chooseStarter();
      return;
    }
    if (mp.healTiles && mp.healTiles[key]) { healParty(); return; }
    if (mp.signs && mp.signs[key]) { G.say([mp.signs[key]]); return; }
    if (ch === 'p') { G.say(['The Poke Balls rest quietly.']); return; }
  }

  function chooseStarter() {
    G.choose('PROF. ELM: Choose your first partner!', [
      { label: 'Chikorita 🌿 (Grass)', value: 'chikorita' },
      { label: 'Cyndaquil 🔥 (Fire)',  value: 'cyndaquil' },
      { label: 'Totodile 🐊 (Water)',  value: 'totodile' }
    ], function (key) {
      var mon = SS.createPokemon(key, 5);
      G.player.party.push(mon);
      G.player.starter = key;
      G.say([
        'You received ' + mon.name + '!',
        'ELM: Head west to Route 29 to train. Good luck!'
      ]);
      G.save();
    });
  }

  /* ---- per-frame update -------------------------------------------- */
  function update(dt) {
    var p = G.player;
    if (p.moving) {
      p.stepT += dt;
      var f = Math.min(1, p.stepT / STEP_MS);
      p.px = p.stepDx * f * SS.TILE;
      p.py = p.stepDy * f * SS.TILE;
      if (f >= 1) {
        p.x += p.stepDx; p.y += p.stepDy;
        p.px = 0; p.py = 0; p.moving = false;
        onArrive();
      }
      return;
    }
    // Not moving: accept a held direction.
    var i = G.input;
    if (i.up) tryStep('up');
    else if (i.down) tryStep('down');
    else if (i.left) tryStep('left');
    else if (i.right) tryStep('right');
  }

  /* ---- draw --------------------------------------------------------- */
  function draw() {
    var R = SS.Render, T = SS.TILE, p = G.player, mp = map();
    R.clear('#000');

    // Camera centres on the player (in pixels), clamped to map bounds.
    var camX = p.x * T + p.px - (SS.VIEW_W - 1) / 2 * T;
    var camY = p.y * T + p.py - (SS.VIEW_H - 1) / 2 * T;

    var startX = Math.floor(camX / T) - 1, endX = startX + SS.VIEW_W + 2;
    var startY = Math.floor(camY / T) - 1, endY = startY + SS.VIEW_H + 2;
    for (var y = startY; y <= endY; y++) {
      for (var x = startX; x <= endX; x++) {
        var ch = tileAt(mp, x, y);
        R.drawTile(ch, x * T - camX, y * T - camY);
      }
    }

    // Player is drawn at fixed screen centre.
    R.drawPlayer(p.x * T + p.px - camX, p.y * T + p.py - camY, p.dir);

    // Location banner.
    R.box(4, 4, 128, 18, 'rgba(255,255,255,.85)', '#303030');
    R.text(mp.name, 10, 14, 120, 12, '#202020', 10);
  }

  return { enter: enter, update: update, draw: draw, interact: interact,
           _walkable: walkable };
})();

window.SS = SS;
