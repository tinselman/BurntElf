/* =============================================================================
 * pokemon.js  —  The battle model: Pokemon instances, stat/EXP/damage/catch maths.
 *
 * All formulas follow Generation IV (HeartGold/SoulSilver) as documented on
 * Bulbapedia.  IVs/EVs/natures are held at neutral defaults to keep the model
 * approachable; the hooks are here if you want to add them later.
 * =========================================================================== */

var SS = window.SS || {};

SS.STAT_NAMES = ['hp','atk','def','spa','spd','spe'];

/* Experience needed to *reach* a given level, by growth group. */
SS.expForLevel = function (level, growth) {
  var n = level;
  if (growth === 'mediumSlow') {
    var v = Math.floor(1.2 * n * n * n - 15 * n * n + 100 * n - 140);
    return Math.max(0, v);
  }
  return n * n * n; // mediumFast
};

/* Build a full stat block for a species at a level (IV/EV = 0, neutral nature). */
SS.computeStats = function (species, level) {
  var b = species.base, s = {};
  // HP has its own formula.
  s.hp = Math.floor((2 * b[0]) * level / 100) + level + 10;
  var keys = ['atk', 'def', 'spa', 'spd', 'spe'];
  for (var i = 0; i < 5; i++) {
    s[keys[i]] = Math.floor((2 * b[i + 1]) * level / 100) + 5;
  }
  return s;
};

/* Pick the (up to) 4 most-recent moves a species knows by a given level. */
SS.movesUpToLevel = function (species, level) {
  var learned = [];
  for (var lv in species.learnset) {
    if (Number(lv) <= level) learned.push({ lv: Number(lv), id: species.learnset[lv] });
  }
  learned.sort(function (a, b) { return a.lv - b.lv; });
  var ids = [];
  for (var i = 0; i < learned.length; i++) {
    if (ids.indexOf(learned[i].id) === -1) ids.push(learned[i].id);
  }
  return ids.slice(-4);
};

/* Create a live Pokemon instance from a species key + level. */
SS.createPokemon = function (speciesKey, level) {
  var species = SS.DEX[speciesKey];
  var stats = SS.computeStats(species, level);
  var moveIds = SS.movesUpToLevel(species, level);
  var moves = moveIds.map(function (id) {
    return { id: id, pp: SS.MOVES[id].pp, maxpp: SS.MOVES[id].pp };
  });
  return {
    key: speciesKey,
    species: species,
    name: species.name,
    level: level,
    exp: SS.expForLevel(level, species.growth),
    stats: stats,
    hp: stats.hp,
    maxHP: stats.hp,
    moves: moves,
    status: null,          // 'burn' | 'poison' | 'paralysis' | ...
    stages: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, acc: 0, eva: 0 }
  };
};

/* Stat-stage multiplier (Gen IV). Used for atk/def/spa/spd/spe. */
SS.stageMul = function (stage) {
  return stage >= 0 ? (2 + stage) / 2 : 2 / (2 - stage);
};

/* Accuracy/evasion stage multiplier (Gen IV uses 3/(3+n)). */
SS.accStageMul = function (stage) {
  return stage >= 0 ? (3 + stage) / 3 : 3 / (3 - stage);
};

SS.effectiveStat = function (mon, key) {
  return Math.floor(mon.stats[key] * SS.stageMul(mon.stages[key]));
};

/* Combined type effectiveness of a move type against a defender's type(s). */
SS.typeEffectiveness = function (moveType, defTypes) {
  var mult = 1, row = SS.TYPE_CHART[moveType] || {};
  for (var i = 0; i < defTypes.length; i++) {
    if (row[defTypes[i]] !== undefined) mult *= row[defTypes[i]];
  }
  return mult;
};

/* Gen-IV damage calculation. Returns {dmg, crit, eff, missed}. */
SS.calcDamage = function (attacker, defender, move) {
  // Accuracy check (with acc/eva stages).
  var accMul = SS.accStageMul(attacker.stages.acc) / SS.accStageMul(defender.stages.eva);
  var hitChance = (move.acc / 100) * accMul;
  if (move.acc !== null && Math.random() > hitChance) {
    return { dmg: 0, crit: false, eff: 1, missed: true };
  }
  if (move.category === 'status' || move.power === 0) {
    return { dmg: 0, crit: false, eff: 1, missed: false };
  }

  var level = attacker.level;
  var phys = move.category === 'physical';
  var A = phys ? SS.effectiveStat(attacker, 'atk') : SS.effectiveStat(attacker, 'spa');
  var D = phys ? SS.effectiveStat(defender, 'def') : SS.effectiveStat(defender, 'spd');

  var base = Math.floor(Math.floor(Math.floor(2 * level / 5 + 2) * move.power * A / D) / 50) + 2;

  // Critical hit (Gen IV: 1/16 base, 2x damage; high-crit moves 1/8).
  var critChance = move.highCrit ? 0.125 : 0.0625;
  var crit = Math.random() < critChance;
  if (crit) base = Math.floor(base * 2);

  // Random spread 0.85 – 1.00.
  base = Math.floor(base * (Math.floor(Math.random() * 16) + 85) / 100);

  // STAB.
  if (attacker.species.types.indexOf(move.type) !== -1) base = Math.floor(base * 1.5);

  // Type effectiveness.
  var eff = SS.typeEffectiveness(move.type, defender.species.types);
  base = Math.floor(base * eff);

  if (eff > 0 && base < 1) base = 1;
  return { dmg: base, crit: crit, eff: eff, missed: false };
};

/* Gen-III/IV capture algorithm. ballBonus e.g. 1 (Poke), 1.5 (Great), 2 (Ultra).
 * Returns {caught, shakes} where shakes is 0-4. */
SS.catchAttempt = function (target, ballBonus) {
  var rate = target.species.catchRate;
  var statusBonus = (target.status === 'sleep' || target.status === 'freeze') ? 2
                  : (target.status ? 1.5 : 1);
  var a = Math.floor(((3 * target.maxHP - 2 * target.hp) * rate * ballBonus) / (3 * target.maxHP));
  a = Math.floor(a * statusBonus);
  if (a >= 255) return { caught: true, shakes: 4 };

  var b = Math.floor(1048560 / Math.floor(Math.sqrt(Math.floor(Math.sqrt(Math.floor(16711680 / a))))));
  var shakes = 0;
  for (var i = 0; i < 4; i++) {
    if (Math.floor(Math.random() * 65536) < b) shakes++;
    else break;
  }
  return { caught: shakes === 4, shakes: shakes };
};

/* EXP awarded to the victor for defeating `fainted` (simplified Gen-IV yield). */
SS.expGain = function (fainted) {
  return Math.floor(fainted.species.baseExp * fainted.level / 7);
};

/* Add EXP, leveling up as thresholds are crossed. Returns an array of level-up
 * events: [{level, learned:[moveId,...], statGain:{...}}]. */
SS.addExp = function (mon, amount) {
  mon.exp += amount;
  var events = [];
  while (mon.level < 100 &&
         mon.exp >= SS.expForLevel(mon.level + 1, mon.species.growth)) {
    mon.level++;
    var before = mon.stats;
    var after = SS.computeStats(mon.species, mon.level);
    var hpDelta = after.hp - before.hp;
    mon.stats = after;
    mon.maxHP = after.hp;
    mon.hp = Math.min(mon.maxHP, mon.hp + hpDelta); // keep damage, grow max HP

    // Learn any move taught exactly at this level (if space or replace oldest).
    var learned = [];
    var newMoveId = mon.species.learnset[mon.level];
    if (newMoveId && !mon.moves.some(function (m) { return m.id === newMoveId; })) {
      var entry = { id: newMoveId, pp: SS.MOVES[newMoveId].pp, maxpp: SS.MOVES[newMoveId].pp };
      if (mon.moves.length < 4) mon.moves.push(entry);
      else mon.moves.shift(), mon.moves.push(entry);
      learned.push(newMoveId);
    }
    events.push({ level: mon.level, learned: learned });
  }
  return events;
};

window.SS = SS;
