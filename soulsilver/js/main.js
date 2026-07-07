/* =============================================================================
 * main.js  —  Game controller: input, scene dispatch, dialog/menu overlays,
 * save/load and the requestAnimationFrame loop.
 * =========================================================================== */

var SS = window.SS || {};

SS.Game = (function () {
  var SAVE_KEY = 'ss_save_v1';

  var Game = {
    scene: 'title',          // 'title' | 'world' | 'battle'
    overlay: null,           // null | 'dialog' | 'choice' | 'menu' | 'party'
    input: { up:false, down:false, left:false, right:false, a:false, b:false },
    justPressed: {},
    player: null,
    dialog: null,
    choiceState: null,
    menuIndex: 0
  };

  /* ---- normalise map rows so every row is the same width (avoids OOB) --- */
  function normalizeMaps() {
    for (var id in SS.MAPS) {
      var g = SS.MAPS[id].grid, w = 0, i;
      for (i = 0; i < g.length; i++) w = Math.max(w, g[i].length);
      for (i = 0; i < g.length; i++) {
        while (g[i].length < w) g[i] += '#';
      }
    }
  }

  /* ---- new game / save / load -------------------------------------- */
  function newGame() {
    Game.player = {
      map: 'newbark', x: 5, y: 6, dir: 'down',
      px: 0, py: 0, moving: false,
      party: [], box: [],
      bag: { ball: 5, potion: 3 },
      money: 3000, starter: null, flags: {}
    };
    SS.World.enter(Game, 'newbark', 5, 6, 'down');
    Game.say([
      'MOM: Oh, good morning!',
      'PROF. ELM called — he needs your help. His LAB is the building to the RIGHT.',
      'Walk up to a door or sign and press A to interact.'
    ]);
  }

  function save() {
    if (!Game.player) return;
    var p = Game.player;
    var data = {
      map: p.map, x: p.x, y: p.y, dir: p.dir,
      money: p.money, bag: p.bag, starter: p.starter, flags: p.flags,
      party: p.party.map(serializeMon),
      box: p.box.map(serializeMon)
    };
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) {}
  }

  function serializeMon(m) {
    return { key: m.key, level: m.level, exp: m.exp, hp: m.hp, maxHP: m.maxHP,
             stats: m.stats, status: m.status,
             moves: m.moves.map(function (x) { return { id: x.id, pp: x.pp, maxpp: x.maxpp }; }) };
  }

  function deserializeMon(d) {
    return {
      key: d.key, species: SS.DEX[d.key], name: SS.DEX[d.key].name,
      level: d.level, exp: d.exp, stats: d.stats, hp: d.hp, maxHP: d.maxHP,
      moves: d.moves, status: d.status, fainted: false,
      stages: { atk:0, def:0, spa:0, spd:0, spe:0, acc:0, eva:0 }
    };
  }

  function hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } }

  function loadGame() {
    var raw; try { raw = localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
    if (!raw) return false;
    var d = JSON.parse(raw);
    Game.player = {
      map: d.map, x: d.x, y: d.y, dir: d.dir, px: 0, py: 0, moving: false,
      party: d.party.map(deserializeMon), box: (d.box || []).map(deserializeMon),
      bag: d.bag, money: d.money, starter: d.starter, flags: d.flags || {}
    };
    SS.World.enter(Game, d.map, d.x, d.y, d.dir);
    return true;
  }

  /* ---- dialog + choice overlays ------------------------------------ */
  Game.say = function (lines, onDone) {
    Game.dialog = { lines: lines.slice(), onDone: onDone || null };
    Game.overlay = 'dialog';
  };

  Game.choose = function (prompt, options, onPick) {
    Game.choiceState = { prompt: prompt, options: options, index: 0, onPick: onPick };
    Game.overlay = 'choice';
  };

  Game.save = save;

  /* ---- input plumbing (touch buttons + keyboard) ------------------- */
  Game.press = function (key) {
    if (!Game.input[key]) Game.justPressed[key] = true;
    Game.input[key] = true;
  };
  Game.release = function (key) { Game.input[key] = false; };

  function bindKeyboard() {
    var map = { ArrowUp:'up', ArrowDown:'down', ArrowLeft:'left', ArrowRight:'right',
                w:'up', s:'down', a:'left', d:'right', z:'a', x:'b', Enter:'a',
                ' ':'a', Backspace:'b' };
    document.addEventListener('keydown', function (e) {
      var k = map[e.key]; if (k) { Game.press(k); e.preventDefault(); }
    });
    document.addEventListener('keyup', function (e) {
      var k = map[e.key]; if (k) { Game.release(k); e.preventDefault(); }
    });
  }

  function bindButtons() {
    var ids = { 'btn-up':'up', 'btn-down':'down', 'btn-left':'left', 'btn-right':'right',
                'btn-a':'a', 'btn-b':'b' };
    Object.keys(ids).forEach(function (id) {
      var el = document.getElementById(id); if (!el) return;
      var key = ids[id];
      var down = function (e) { e.preventDefault(); Game.press(key); el.classList.add('held'); };
      var up = function (e) { e.preventDefault(); Game.release(key); el.classList.remove('held'); };
      el.addEventListener('touchstart', down, { passive: false });
      el.addEventListener('touchend', up, { passive: false });
      el.addEventListener('touchcancel', up, { passive: false });
      el.addEventListener('mousedown', down);
      el.addEventListener('mouseup', up);
      el.addEventListener('mouseleave', up);
    });
    var menuBtn = document.getElementById('btn-menu');
    if (menuBtn) menuBtn.addEventListener('click', function () {
      if (Game.scene === 'world' && !Game.overlay) openMenu();
    });
  }

  /* ---- pause / party menu ------------------------------------------ */
  function openMenu() { Game.overlay = 'menu'; Game.menuIndex = 0; }
  var MENU_OPTS = ['POKEMON', 'BAG', 'SAVE', 'CLOSE'];

  function menuInput() {
    var jp = Game.justPressed;
    if (jp.up) Game.menuIndex = (Game.menuIndex + MENU_OPTS.length - 1) % MENU_OPTS.length;
    if (jp.down) Game.menuIndex = (Game.menuIndex + 1) % MENU_OPTS.length;
    if (jp.b) { Game.overlay = null; return; }
    if (jp.a) {
      var opt = MENU_OPTS[Game.menuIndex];
      if (opt === 'CLOSE') Game.overlay = null;
      else if (opt === 'SAVE') { save(); Game.overlay = null; Game.say(['Game saved.']); }
      else if (opt === 'POKEMON') Game.overlay = 'party';
      else if (opt === 'BAG') Game.say(['BAG:  Poke Ball x' + Game.player.bag.ball +
                                        '     Potion x' + Game.player.bag.potion +
                                        '     Money: ' + Game.player.money]);
    }
  }

  function partyInput() {
    var jp = Game.justPressed;
    if (jp.b || jp.a) Game.overlay = 'menu';
  }

  /* ---- title -------------------------------------------------------- */
  function titleInput() {
    var jp = Game.justPressed;
    var n = hasSave() ? 2 : 1;
    if (jp.up) Game.menuIndex = (Game.menuIndex + n - 1) % n;
    if (jp.down) Game.menuIndex = (Game.menuIndex + 1) % n;
    if (jp.a) {
      if (hasSave() && Game.menuIndex === 1) loadGame();
      else newGame();
    }
  }

  /* ---- dialog / choice input --------------------------------------- */
  function dialogInput() {
    var jp = Game.justPressed;
    if (jp.a || jp.b) {
      Game.dialog.lines.shift();
      if (Game.dialog.lines.length === 0) {
        var cb = Game.dialog.onDone; Game.dialog = null; Game.overlay = null;
        if (cb) cb();
      }
    }
  }

  function choiceInput() {
    var jp = Game.justPressed, c = Game.choiceState;
    if (jp.up) c.index = (c.index + c.options.length - 1) % c.options.length;
    if (jp.down) c.index = (c.index + 1) % c.options.length;
    if (jp.a) {
      var picked = c.options[c.index];
      Game.choiceState = null; Game.overlay = null;
      c.onPick(picked.value);
    }
  }

  /* ---- main loop ---------------------------------------------------- */
  var last = 0;
  function loop(ts) {
    var dt = last ? Math.min(50, ts - last) : 16; last = ts;
    update(dt);
    draw();
    Game.justPressed = {};
    requestAnimationFrame(loop);
  }

  function update(dt) {
    if (Game.overlay === 'dialog') return dialogInput();
    if (Game.overlay === 'choice') return choiceInput();
    if (Game.overlay === 'menu') return menuInput();
    if (Game.overlay === 'party') return partyInput();

    if (Game.scene === 'title') return titleInput();
    if (Game.scene === 'world') {
      if (Game.justPressed.a && !Game.player.moving) SS.World.interact();
      if (Game.justPressed.b && !Game.player.moving) openMenu();
      SS.World.update(dt);
    } else if (Game.scene === 'battle') {
      SS.Battle.handleInput();
    }
  }

  function draw() {
    var R = SS.Render;
    if (Game.scene === 'title') drawTitle();
    else if (Game.scene === 'world') SS.World.draw();
    else if (Game.scene === 'battle') SS.Battle.draw();

    if (Game.overlay === 'dialog') drawDialog();
    else if (Game.overlay === 'choice') drawChoice();
    else if (Game.overlay === 'menu') drawMenu();
    else if (Game.overlay === 'party') drawPartyScreen();
  }

  function drawTitle() {
    var R = SS.Render, W = SS.VIEW_W * SS.TILE, H = SS.VIEW_H * SS.TILE;
    R.clear('#204a80');
    R.ctx().fillStyle = '#c0c0c0';
    R.textBig('POKEMON', W / 2, 60, '#e8e8f0', 26);
    R.textBig('SOUL SILVER', W / 2, 92, '#b8c8e8', 20);
    R.drawEmoji('🌿🔥🐊', W / 2, 130, 26);
    var n = hasSave() ? 2 : 1, opts = hasSave() ? ['NEW GAME', 'CONTINUE'] : ['NEW GAME'];
    for (var i = 0; i < n; i++) {
      R.textCentered((Game.menuIndex === i ? '▶ ' : '') + opts[i], W / 2, 175 + i * 24,
                     Game.menuIndex === i ? '#ffe060' : '#ffffff', 13);
    }
    R.textCentered('a fan recreation — phone build', W / 2, H - 14, '#9fb8e0', 8);
  }

  function drawDialog() {
    var R = SS.Render, W = SS.VIEW_W * SS.TILE, H = SS.VIEW_H * SS.TILE;
    R.box(6, H - 60, W - 12, 54, '#fff', '#303030');
    R.text(Game.dialog.lines[0], 14, H - 42, W - 28, 14, '#202020', 10);
    R.text('press A ▶', W - 74, H - 14, 70, 10, '#909090', 8);
  }

  function drawChoice() {
    var R = SS.Render, W = SS.VIEW_W * SS.TILE, H = SS.VIEW_H * SS.TILE, c = Game.choiceState;
    R.box(6, H - 96, W - 12, 90, '#fff', '#303030');
    R.text(c.prompt, 14, H - 80, W - 28, 12, '#202020', 9);
    for (var i = 0; i < c.options.length; i++) {
      R.text((c.index === i ? '▶ ' : '  ') + c.options[i].label, 18, H - 56 + i * 15, W - 30, 13,
             c.index === i ? '#e03030' : '#202020', 10);
    }
  }

  function drawMenu() {
    var R = SS.Render, W = SS.VIEW_W * SS.TILE;
    R.box(W - 96, 6, 90, 90, '#fff', '#303030');
    for (var i = 0; i < MENU_OPTS.length; i++) {
      R.text((Game.menuIndex === i ? '▶ ' : '  ') + MENU_OPTS[i], W - 88, 24 + i * 18, 84, 16,
             Game.menuIndex === i ? '#e03030' : '#202020', 11);
    }
  }

  function drawPartyScreen() {
    var R = SS.Render, W = SS.VIEW_W * SS.TILE, H = SS.VIEW_H * SS.TILE, party = Game.player.party;
    R.box(6, 6, W - 12, H - 12, '#f0f4ff', '#303030');
    R.text('POKEMON', 16, 22, W - 32, 14, '#202020', 12);
    if (party.length === 0) R.text('(no Pokemon yet — visit Elm\'s Lab)', 16, 44, W - 32, 12, '#606060', 9);
    for (var i = 0; i < party.length; i++) {
      var m = party[i], y = 44 + i * 34;
      R.drawEmoji(SS.EMOJI[m.key], 30, y + 12, 26);
      R.text(m.name + '  Lv.' + m.level, 52, y + 4, W - 70, 12, '#202020', 10);
      R.hpBar(52, y + 12, 100, 6, m.hp, m.maxHP);
      R.text(m.hp + '/' + m.maxHP + (m.status ? '  ' + m.status.toUpperCase() : ''), 160, y + 15, W - 170, 10, '#404040', 8);
    }
    R.text('B: close', W - 74, H - 20, 64, 11, '#808080', 8);
  }

  /* ---- boot --------------------------------------------------------- */
  function boot() {
    normalizeMaps();
    var canvas = document.getElementById('game');
    SS.Render.init(canvas);
    bindKeyboard();
    bindButtons();
    requestAnimationFrame(loop);
  }

  return { boot: boot, ref: Game };
})();

window.SS = SS;
