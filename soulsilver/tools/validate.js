/* Node validator: loads game data, normalises maps, prints them with column
 * rulers, and flags warp/entry problems (blocked entry, warp-loop, OOB). */
global.window = {};
require('../js/data.js');
var SS = global.window.SS;

var BLOCKED = '#WHFspC-';
function norm() {
  for (var id in SS.MAPS) {
    var g = SS.MAPS[id].grid, w = 0, i;
    for (i = 0; i < g.length; i++) w = Math.max(w, g[i].length);
    for (i = 0; i < g.length; i++) while (g[i].length < w) g[i] += '#';
  }
}
norm();

function tile(mp, x, y) {
  if (y < 0 || y >= mp.grid.length) return '#';
  var r = mp.grid[y]; if (x < 0 || x >= r.length) return '#'; return r[x];
}
function walkable(mp, x, y) { return BLOCKED.indexOf(tile(mp, x, y)) === -1; }

var problems = [];
for (var id in SS.MAPS) {
  var mp = SS.MAPS[id];
  console.log('\n=== ' + id + '  (' + mp.grid[0].length + 'x' + mp.grid.length + ') ' + mp.name);
  var ruler = '    ';
  for (var c = 0; c < mp.grid[0].length; c++) ruler += (c % 10);
  console.log(ruler);
  for (var y = 0; y < mp.grid.length; y++) console.log((' ' + y).slice(-3) + ' ' + mp.grid[y]);

  (mp.warps || []).forEach(function (w) {
    if (!walkable(mp, w.x, w.y)) {} // warp tile itself can be a door 'D' (walkable) — fine
    var dest = SS.MAPS[w.to];
    if (!dest) { problems.push(id + ': warp -> unknown map ' + w.to); return; }
    if (!walkable(dest, w.tx, w.ty))
      problems.push(id + ' -> ' + w.to + ': ENTRY (' + w.tx + ',' + w.ty + ')="' + tile(dest, w.tx, w.ty) + '" is BLOCKED');
    var onWarp = (dest.warps || []).some(function (dw) { return dw.x === w.tx && dw.y === w.ty; });
    if (onWarp) problems.push(id + ' -> ' + w.to + ': entry lands ON another warp (loop risk, guarded by justEntered)');
  });

  ['signs', 'healTiles', 'starterTiles'].forEach(function (k) {
    if (!mp[k]) return;
    Object.keys(mp[k]).forEach(function (key) {
      var xy = key.split(',').map(Number);
      // must be reachable: at least one orthogonally-adjacent walkable tile
      var adj = [[1,0],[-1,0],[0,1],[0,-1]].some(function (d) { return walkable(mp, xy[0]+d[0], xy[1]+d[1]); });
      if (!adj) problems.push(id + ': ' + k + ' ' + key + ' has no adjacent walkable tile');
    });
  });
}

console.log('\n--- PROBLEMS ---');
if (!problems.length) console.log('none 🎉');
else problems.forEach(function (p) { console.log('• ' + p); });
