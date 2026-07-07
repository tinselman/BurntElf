/* =============================================================================
 * battle.js  —  The turn-based battle scene.
 *
 * Implements the classic FIGHT / BAG / POKEMON / RUN loop with Gen-IV damage,
 * catching and EXP.  State changes are applied immediately and described through
 * a message queue the player advances with the A button.
 * =========================================================================== */

var SS = window.SS || {};

SS.Battle = (function () {
  var G, B;

  function start(game, wild) {
    G = game;
    B = {
      wild: wild,
      active: firstHealthy(),
      state: 'msg',
      menuIndex: 0,
      moveIndex: 0,
      subIndex: 0,
      msgs: [],
      after: null,
      outcome: null,          // 'caught' | 'win' | 'lose' | 'flee'
      caughtShakes: 0
    };
    G.scene = 'battle';
    pushMsgs(['A wild ' + wild.name + ' (Lv.' + wild.level + ') appeared!',
              'Go! ' + B.active.name + '!'], toMenu);
  }

  function firstHealthy() {
    return G.player.party.find(function (m) { return m.hp > 0; }) || G.player.party[0];
  }

  function pushMsgs(list, after) {
    B.msgs = B.msgs.concat(list);
    B.after = after || B.after;
    B.state = 'msg';
  }

  function toMenu() {
    if (B.outcome) return finalize();
    B.state = 'menu'; B.menuIndex = 0;
  }

  /* ---- turn resolution --------------------------------------------- */
  function chooseMove(idx) {
    var moveEntry = B.active.moves[idx];
    if (!moveEntry || moveEntry.pp <= 0) { pushMsgs(['No PP left for that move!'], toMenu); return; }
    resolveTurn({ type: 'move', moveEntry: moveEntry });
  }

  function wildAction() {
    var usable = B.wild.moves.filter(function (m) { return m.pp > 0; });
    var pick = usable.length ? usable[Math.floor(Math.random() * usable.length)] : null;
    return pick ? { type: 'move', moveEntry: pick } : { type: 'struggle' };
  }

  function resolveTurn(playerAction) {
    var msgs = [];
    B.state = 'anim';

    // Player-first actions: item / switch / run resolve before the wild moves.
    if (playerAction.type !== 'move') {
      handleNonMove(playerAction, msgs);
      if (!B.outcome) { doWild(msgs); afterTurn(msgs); }
      pushMsgs(msgs, doneTurn);
      return;
    }

    var wa = wildAction();
    var pMove = SS.MOVES[playerAction.moveEntry.id];
    var wMove = wa.moveEntry ? SS.MOVES[wa.moveEntry.id] : { priority: 0 };

    var pFirst = order(pMove, wMove, B.active, B.wild);
    if (pFirst) {
      doMove(B.active, B.wild, playerAction.moveEntry, msgs);
      if (!B.wild.fainted && !B.outcome) doWild(msgs, wa);
    } else {
      doWild(msgs, wa);
      if (B.active.hp > 0 && !B.outcome) doMove(B.active, B.wild, playerAction.moveEntry, msgs);
    }
    afterTurn(msgs);
    pushMsgs(msgs, doneTurn);
  }

  // true if the player's move goes first.
  function order(pMove, wMove, pMon, wMon) {
    var pp = pMove.priority || 0, wp = wMove.priority || 0;
    if (pp !== wp) return pp > wp;
    var ps = SS.effectiveStat(pMon, 'spe'), ws = SS.effectiveStat(wMon, 'spe');
    if (ps !== ws) return ps > ws;
    return Math.random() < 0.5;
  }

  function doWild(msgs, wa) {
    wa = wa || wildAction();
    if (wa.type === 'struggle') { msgs.push('The wild ' + B.wild.name + ' has no moves left!'); return; }
    doMove(B.wild, B.active, wa.moveEntry, msgs);
  }

  /* Execute one move from attacker to defender, appending messages. */
  function doMove(attacker, defender, moveEntry, msgs) {
    var move = SS.MOVES[moveEntry.id];
    moveEntry.pp = Math.max(0, moveEntry.pp - 1);
    msgs.push(label(attacker) + ' used ' + move.name + '!');

    var res = SS.calcDamage(attacker, defender, move);
    if (res.missed) { msgs.push('But it missed!'); return; }

    if (move.category !== 'status' && move.power > 0) {
      defender.hp = Math.max(0, defender.hp - res.dmg);
      if (res.crit) msgs.push('A critical hit!');
      if (res.eff === 0) msgs.push("It doesn't affect " + defender.name + '...');
      else if (res.eff > 1) msgs.push("It's super effective!");
      else if (res.eff < 1) msgs.push("It's not very effective...");
    }

    // Secondary / status-move effects.
    if (move.effect) applyEffect(move.effect, attacker, defender, msgs);

    if (defender.hp <= 0) { defender.fainted = true; onFaint(defender, attacker, msgs); }
  }

  function applyEffect(eff, attacker, defender, msgs) {
    if (eff.chance && Math.random() * 100 >= eff.chance) return;
    if (eff.stat) {
      var target = eff.target === 'self' ? attacker : defender;
      var cur = target.stages[eff.stat];
      var next = Math.max(-6, Math.min(6, cur + eff.stages));
      if (next === cur) { msgs.push(label(target) + "'s " + eff.stat.toUpperCase() + " won't go " + (eff.stages > 0 ? 'higher' : 'lower') + '!'); return; }
      target.stages[eff.stat] = next;
      msgs.push(label(target) + "'s " + eff.stat.toUpperCase() + (eff.stages > 0 ? ' rose!' : ' fell!'));
    }
    if (eff.status && !defender.status) {
      defender.status = eff.status;
      msgs.push(label(defender) + ' was ' + statusVerb(eff.status) + '!');
    }
  }

  function statusVerb(s) { return s === 'burn' ? 'burned' : s === 'poison' ? 'poisoned' : s === 'paralysis' ? 'paralyzed' : 'afflicted'; }

  /* End-of-turn: burn/poison chip damage. */
  function afterTurn(msgs) {
    [B.active, B.wild].forEach(function (m) {
      if (m.fainted || m.hp <= 0) return;
      if (m.status === 'burn' || m.status === 'poison') {
        var chip = Math.max(1, Math.floor(m.maxHP / 8));
        m.hp = Math.max(0, m.hp - chip);
        msgs.push(label(m) + ' is hurt by its ' + m.status + '!');
        if (m.hp <= 0) { m.fainted = true; onFaint(m, null, msgs); }
      }
    });
  }

  function onFaint(fainted, victor, msgs) {
    msgs.push(label(fainted) + ' fainted!');
    if (fainted === B.wild) {
      var gain = SS.expGain(B.wild);
      if (B.active.hp > 0) {
        msgs.push(B.active.name + ' gained ' + gain + ' EXP!');
        var events = SS.addExp(B.active, gain);
        events.forEach(function (ev) {
          msgs.push(B.active.name + ' grew to Lv.' + ev.level + '!');
          ev.learned.forEach(function (id) { msgs.push(B.active.name + ' learned ' + SS.MOVES[id].name + '!'); });
        });
      }
      B.outcome = 'win';
    } else if (fainted === B.active) {
      var next = G.player.party.find(function (m) { return m.hp > 0; });
      if (!next) B.outcome = 'lose';
      // else: player must pick a replacement (handled after messages drain).
    }
  }

  /* ---- non-move actions -------------------------------------------- */
  function handleNonMove(action, msgs) {
    if (action.type === 'run') {
      var pSpe = SS.effectiveStat(B.active, 'spe'), wSpe = SS.effectiveStat(B.wild, 'spe');
      var odds = pSpe >= wSpe ? 1 : (pSpe * 128 / wSpe + 30) / 256;
      if (Math.random() < odds) { msgs.push('Got away safely!'); B.outcome = 'flee'; }
      else msgs.push("Can't escape!");
    } else if (action.type === 'ball') {
      throwBall(msgs);
    } else if (action.type === 'potion') {
      var heal = Math.min(20, B.active.maxHP - B.active.hp);
      if (heal <= 0) { msgs.push('HP is already full!'); return; }
      B.active.hp += heal; G.player.bag.potion--;
      msgs.push('Used Potion. ' + B.active.name + ' recovered ' + heal + ' HP!');
    } else if (action.type === 'switch') {
      var mon = G.player.party[action.index];
      msgs.push(B.active.name + ', come back!');
      B.active = mon;
      msgs.push('Go! ' + mon.name + '!');
    }
  }

  function throwBall(msgs) {
    G.player.bag.ball--;
    msgs.push('You threw a Poke Ball!');
    var r = SS.catchAttempt(B.wild, 1);
    B.caughtShakes = r.shakes;
    msgs.push(shakeText(r.shakes));
    if (r.caught) {
      msgs.push('Gotcha! ' + B.wild.name + ' was caught!');
      if (G.player.party.length < 6) G.player.party.push(cleanCaught(B.wild));
      else { G.player.box.push(cleanCaught(B.wild)); msgs.push(B.wild.name + ' was sent to the PC Box.'); }
      B.outcome = 'caught';
    } else {
      msgs.push('Oh no! It broke free!');
    }
  }

  function cleanCaught(w) { w.fainted = false; w.stages = { atk:0,def:0,spa:0,spd:0,spe:0,acc:0,eva:0 }; return w; }
  function shakeText(n) { return n >= 3 ? 'Wobble... wobble... wobble...' : n === 2 ? 'Wobble... wobble...' : n === 1 ? 'Wobble...' : 'It broke free instantly!'; }

  /* Called when a turn's messages have all been shown. */
  function doneTurn() {
    if (B.outcome) return finalize();
    if (B.active.hp <= 0) {           // active fainted, replacements exist
      openPartySwitch(true);
      return;
    }
    toMenu();
  }

  function finalize() {
    if (B.outcome === 'lose') {
      G.player.party.forEach(function (m) { m.hp = m.maxHP; m.status = null; });
      G.say(['You have no more Pokemon that can fight!',
             'You scurried back to New Bark Town...'], function () {
        SS.World.enter(G, 'newbark', 4, 4, 'down');
      });
    } else {
      // win / caught / flee: clean battle stat stages, return to overworld.
      G.player.party.forEach(function (m) {
        m.fainted = false;
        m.stages = { atk:0,def:0,spa:0,spd:0,spe:0,acc:0,eva:0 };
      });
      G.scene = 'world';
    }
    G.save();
  }

  /* ---- input -------------------------------------------------------- */
  function openPartySwitch(forced) {
    B.state = 'party'; B.subIndex = 0; B.forcedSwitch = !!forced;
  }

  function handleInput() {
    var jp = G.justPressed;
    if (B.state === 'msg') {
      if (jp.a || jp.b) advanceMsg();
      return;
    }
    if (B.state === 'menu') return menuInput(jp);
    if (B.state === 'move') return moveInput(jp);
    if (B.state === 'bag') return bagInput(jp);
    if (B.state === 'party') return partyInput(jp);
  }

  function advanceMsg() {
    if (B.msgs.length > 1) { B.msgs.shift(); return; }
    B.msgs = [];
    var cb = B.after; B.after = null;
    if (cb) cb(); else toMenu();
  }

  function menuInput(jp) {
    if (jp.up || jp.down) B.menuIndex ^= 2;             // toggle row
    if (jp.left || jp.right) B.menuIndex ^= 1;          // toggle column
    B.menuIndex = (B.menuIndex + 4) % 4;
    if (jp.a) {
      if (B.menuIndex === 0) { B.state = 'move'; B.moveIndex = 0; }
      if (B.menuIndex === 1) { B.state = 'bag'; B.subIndex = 0; }
      if (B.menuIndex === 2) openPartySwitch(false);
      if (B.menuIndex === 3) resolveTurn({ type: 'run' });
    }
  }

  function moveInput(jp) {
    var n = B.active.moves.length;
    if (jp.up) B.moveIndex = (B.moveIndex - 1 + n) % n;
    if (jp.down) B.moveIndex = (B.moveIndex + 1) % n;
    if (jp.b) { B.state = 'menu'; return; }
    if (jp.a) chooseMove(B.moveIndex);
  }

  function bagInput(jp) {
    var items = bagItems();
    if (jp.up) B.subIndex = (B.subIndex - 1 + items.length) % items.length;
    if (jp.down) B.subIndex = (B.subIndex + 1) % items.length;
    if (jp.b) { B.state = 'menu'; return; }
    if (jp.a) {
      var it = items[B.subIndex];
      if (it.count <= 0) return;
      resolveTurn({ type: it.action });
    }
  }

  function bagItems() {
    return [
      { name: 'Poke Ball', action: 'ball',   count: G.player.bag.ball },
      { name: 'Potion',    action: 'potion', count: G.player.bag.potion }
    ];
  }

  function partyInput(jp) {
    var party = G.player.party;
    if (jp.up) B.subIndex = (B.subIndex - 1 + party.length) % party.length;
    if (jp.down) B.subIndex = (B.subIndex + 1) % party.length;
    if (jp.b && !B.forcedSwitch) { B.state = 'menu'; return; }
    if (jp.a) {
      var mon = party[B.subIndex];
      if (mon.hp <= 0) return;
      if (mon === B.active) { if (!B.forcedSwitch) B.state = 'menu'; return; }
      if (B.forcedSwitch) {
        B.active = mon; B.forcedSwitch = false;
        pushMsgs(['Go! ' + mon.name + '!'], toMenu);
      } else {
        resolveTurn({ type: 'switch', index: B.subIndex });
      }
    }
  }

  /* ---- helpers & drawing ------------------------------------------- */
  function label(m) { return m === B.wild ? 'The wild ' + m.name : m.name; }

  function draw() {
    var R = SS.Render, W = SS.VIEW_W * SS.TILE, H = SS.VIEW_H * SS.TILE;
    R.clear('#9fd8e8');
    R.ctx().fillStyle = '#c8e8b0'; R.ctx().fillRect(0, H * 0.55, W, H * 0.45); // ground

    // Foe (top-right) and player mon (bottom-left) info + emoji.
    drawMonPanel(B.wild, W - 128, 12, true);
    R.drawEmoji(SS.EMOJI[B.wild.key], W - 44, 78, 46);

    if (B.active) {
      drawMonPanel(B.active, 8, H - 96, false);
      R.drawEmoji(SS.EMOJI[B.active.key], 44, H - 108, 52);
    }

    // Bottom text / menu box.
    var by = H - 62;
    R.box(0, by, W, 62, '#fff', '#303030');
    if (B.state === 'msg') R.text(B.msgs[0] || '', 10, by + 16, W - 20, 13, '#202020', 10);
    else if (B.state === 'menu') drawMainMenu(by);
    else if (B.state === 'move') drawMoveList(by);
    else if (B.state === 'bag') drawBag(by);
    else if (B.state === 'party') drawParty(by);
  }

  function drawMonPanel(m, x, y, foe) {
    var R = SS.Render;
    R.box(x, y, 120, 34, 'rgba(255,255,255,.92)', '#303030');
    R.text(m.name + ' Lv.' + m.level, x + 6, y + 11, 110, 11, '#202020', 9);
    R.hpBar(x + 6, y + 20, 90, 6, m.hp, m.maxHP);
    if (!foe) R.text(m.hp + '/' + m.maxHP, x + 6, y + 30, 110, 10, '#404040', 8);
    if (m.status) R.text(m.status.slice(0, 3).toUpperCase(), x + 100, y + 22, 20, 10, '#c03028', 8);
  }

  function drawMainMenu(by) {
    var R = SS.Render, opts = ['FIGHT', 'BAG', 'POKEMON', 'RUN'], W = SS.VIEW_W * SS.TILE;
    for (var i = 0; i < 4; i++) {
      var cx = (i % 2) * (W / 2) + 12, cy = by + 20 + Math.floor(i / 2) * 22;
      R.text((B.menuIndex === i ? '▶ ' : '  ') + opts[i], cx, cy, W / 2, 12,
             B.menuIndex === i ? '#e03030' : '#202020', 11);
    }
  }

  function drawMoveList(by) {
    var R = SS.Render, W = SS.VIEW_W * SS.TILE;
    for (var i = 0; i < B.active.moves.length; i++) {
      var me = B.active.moves[i], mv = SS.MOVES[me.id];
      var y = by + 14 + i * 12;
      R.text((B.moveIndex === i ? '▶ ' : '  ') + mv.name, 10, y, W - 90, 11,
             B.moveIndex === i ? '#e03030' : '#202020', 9);
    }
    var sel = SS.MOVES[B.active.moves[B.moveIndex].id];
    R.text(sel.type.toUpperCase() + '  PP ' + B.active.moves[B.moveIndex].pp + '/' + B.active.moves[B.moveIndex].maxpp,
           W - 88, by + 16, 84, 11, '#404040', 8);
    R.text('B: back', W - 88, by + 46, 84, 11, '#808080', 8);
  }

  function drawBag(by) {
    var R = SS.Render, items = bagItems(), W = SS.VIEW_W * SS.TILE;
    for (var i = 0; i < items.length; i++) {
      var y = by + 16 + i * 14;
      R.text((B.subIndex === i ? '▶ ' : '  ') + items[i].name + '  x' + items[i].count, 10, y, W - 20, 12,
             B.subIndex === i ? '#e03030' : '#202020', 10);
    }
    R.text('B: back', W - 70, by + 46, 64, 11, '#808080', 8);
  }

  function drawParty(by) {
    var R = SS.Render, party = G.player.party, W = SS.VIEW_W * SS.TILE;
    for (var i = 0; i < party.length; i++) {
      var m = party[i], y = by + 12 + i * 9;
      var txt = (B.subIndex === i ? '▶ ' : '  ') + m.name + ' Lv.' + m.level + '  ' + m.hp + '/' + m.maxHP + (m.hp <= 0 ? ' (FNT)' : '');
      R.text(txt, 10, y, W - 20, 9, m.hp <= 0 ? '#a04040' : (B.subIndex === i ? '#e03030' : '#202020'), 8);
    }
    if (!B.forcedSwitch) R.text('B: back', W - 70, by + 52, 64, 11, '#808080', 8);
  }

  return { start: start, handleInput: handleInput, draw: draw };
})();

window.SS = SS;
