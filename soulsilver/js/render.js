/* =============================================================================
 * render.js  —  All canvas drawing lives here.
 *
 * This is deliberately the ONLY file that touches the 2-D canvas.  The rest of
 * the game works in an abstract grid/entity model (tile coordinates, Pokemon
 * objects, menu state).  To move to 3-D later, you replace these draw functions
 * with a WebGL/Three.js renderer that consumes the same model — the game logic
 * in world.js / battle.js does not change.
 * =========================================================================== */

var SS = window.SS || {};

SS.TILE = 24;         // logical pixels per tile
SS.VIEW_W = 13;       // visible tiles across
SS.VIEW_H = 11;       // visible tiles down

// Recognisable stand-ins for sprites (swap for real art / 3-D models later).
SS.EMOJI = {
  chikorita:'🌿', cyndaquil:'🔥', totodile:'🐊', pidgey:'🐦', rattata:'🐀',
  sentret:'🐿️', hoothoot:'🦉', caterpie:'🐛', weedle:'🐛'
};

// Flat colour of each single/first type (used for HP bars, badges, fallbacks).
SS.TYPE_COLOR = {
  normal:'#a8a878', fire:'#f08030', water:'#6890f0', electric:'#f8d030',
  grass:'#78c850', ice:'#98d8d8', fighting:'#c03028', poison:'#a040a0',
  ground:'#e0c068', flying:'#a890f0', psychic:'#f85888', bug:'#a8b820',
  rock:'#b8a038', ghost:'#705898', dragon:'#7038f8', dark:'#705848', steel:'#b8b8d0'
};

SS.Render = (function () {
  var cv, cx;

  function init(canvas) {
    cv = canvas;
    cx = canvas.getContext('2d');
    canvas.width = SS.VIEW_W * SS.TILE;
    canvas.height = SS.VIEW_H * SS.TILE;
    cx.imageSmoothingEnabled = false;
    cx.textBaseline = 'middle';
    cx.textAlign = 'center';
  }

  function clear(color) {
    cx.fillStyle = color || '#000';
    cx.fillRect(0, 0, cv.width, cv.height);
  }

  /* ---- overworld tile drawing --------------------------------------- */
  function drawTile(ch, px, py) {
    var T = SS.TILE;
    switch (ch) {
      case '.': paint('#8ecf6f', px, py); break;                 // short grass
      case ' ': paint('#e8dcb5', px, py); break;                 // interior floor
      case '~':                                                  // tall grass
        paint('#4e9d4e', px, py);
        cx.fillStyle = '#3c7d3c';
        for (var i = 0; i < 3; i++) cx.fillRect(px + 4 + i * 6, py + T - 9, 3, 8);
        break;
      case '#':                                                  // tree
        paint('#6a9f5a', px, py);
        cx.fillStyle = '#2f6b34'; circle(px + T / 2, py + T / 2 - 1, T / 2 - 2);
        cx.fillStyle = '#7a4a24'; cx.fillRect(px + T / 2 - 2, py + T - 6, 4, 5);
        break;
      case 'W':                                                  // water
        paint('#4a80d0', px, py);
        cx.fillStyle = '#6a9ee8'; cx.fillRect(px + 3, py + 6, 8, 2);
        cx.fillRect(px + 12, py + 14, 8, 2);
        break;
      case 'H':                                                  // building wall
        paint('#c98a5a', px, py);
        cx.strokeStyle = '#8a5a34'; cx.strokeRect(px + .5, py + .5, T - 1, T - 1);
        break;
      case 'D':                                                  // door
        paint('#c98a5a', px, py);
        cx.fillStyle = '#402a18'; cx.fillRect(px + 5, py + 4, T - 10, T - 4);
        break;
      case 'C':                                                  // heal counter
        paint('#e8dcb5', px, py);
        cx.fillStyle = '#e04040'; cx.fillRect(px + 3, py + 8, T - 6, T - 12);
        cx.fillStyle = '#fff'; circle(px + T / 2, py + T / 2 + 1, 3);
        break;
      case 'F':                                                  // flowers
        paint('#8ecf6f', px, py);
        cx.fillStyle = '#f070a0'; circle(px + 8, py + 9, 3); circle(px + 16, py + 15, 3);
        break;
      case 's':                                                  // sign
        paint('#8ecf6f', px, py);
        cx.fillStyle = '#8a5a34'; cx.fillRect(px + 6, py + 4, T - 12, T - 10);
        cx.fillStyle = '#c98a5a'; cx.fillRect(px + 9, py + T - 8, 4, 6);
        break;
      case 'p':                                                  // starter machine
        paint('#e8dcb5', px, py);
        cx.fillStyle = '#c0c0c0'; cx.fillRect(px + 4, py + 6, T - 8, T - 8);
        cx.fillStyle = '#e04040'; circle(px + T / 2, py + T / 2 + 1, 4);
        cx.fillStyle = '#fff'; cx.fillRect(px + T / 2 - 4, py + T / 2, 8, 1);
        break;
      default: paint('#8ecf6f', px, py);
    }
  }

  function paint(color, px, py) { cx.fillStyle = color; cx.fillRect(px, py, SS.TILE, SS.TILE); }
  function circle(x, y, r) { cx.beginPath(); cx.arc(x, y, r, 0, 7); cx.fill(); }

  /* Draw the player character at pixel (px,py) facing `dir`. */
  function drawPlayer(px, py, dir) {
    var T = SS.TILE, cxp = px + T / 2;
    cx.fillStyle = '#e03030';                        // cap / body
    cx.fillRect(px + 6, py + 4, T - 12, 6);
    cx.fillStyle = '#f0c090';                        // face
    cx.fillRect(px + 7, py + 9, T - 14, 5);
    cx.fillStyle = '#3050c0';                        // torso
    cx.fillRect(px + 6, py + 13, T - 12, 8);
    cx.fillStyle = '#000';                            // facing marker (eyes/direction)
    if (dir === 'down')  { cx.fillRect(cxp - 3, py + 11, 2, 2); cx.fillRect(cxp + 1, py + 11, 2, 2); }
    if (dir === 'up')    { cx.fillRect(cxp - 3, py + 9, 2, 1); cx.fillRect(cxp + 1, py + 9, 2, 1); }
    if (dir === 'left')  { cx.fillRect(px + 7, py + 11, 2, 2); }
    if (dir === 'right') { cx.fillRect(px + T - 9, py + 11, 2, 2); }
  }

  function drawEmoji(emoji, x, y, size) {
    cx.font = size + 'px serif';
    cx.fillText(emoji, x, y);
  }

  /* ---- text + boxes -------------------------------------------------- */
  function box(x, y, w, h, fill, border) {
    cx.fillStyle = fill || '#fff';
    cx.fillRect(x, y, w, h);
    cx.strokeStyle = border || '#303030';
    cx.lineWidth = 2;
    cx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  }

  // Word-wrapped left-aligned text. Returns number of lines drawn.
  function text(str, x, y, maxW, lineH, color, size) {
    cx.fillStyle = color || '#202020';
    cx.font = (size || 10) + 'px monospace';
    cx.textAlign = 'left';
    var words = String(str).split(' '), line = '', ly = y, lines = 0;
    for (var i = 0; i < words.length; i++) {
      var test = line ? line + ' ' + words[i] : words[i];
      if (cx.measureText(test).width > maxW && line) {
        cx.fillText(line, x, ly); ly += lineH; lines++; line = words[i];
      } else line = test;
    }
    if (line) { cx.fillText(line, x, ly); lines++; }
    cx.textAlign = 'center';
    return lines;
  }

  function textCentered(str, x, y, color, size) {
    cx.fillStyle = color || '#202020';
    cx.font = (size || 12) + 'px monospace';
    cx.textAlign = 'center';
    cx.fillText(str, x, y);
  }

  // Big bold centered title text.
  function textBig(str, x, y, color, size) {
    cx.fillStyle = color || '#fff';
    cx.font = 'bold ' + (size || 20) + 'px "Trebuchet MS", Verdana, sans-serif';
    cx.textAlign = 'center';
    cx.fillText(str, x, y);
  }

  /* HP bar with green/amber/red fill. */
  function hpBar(x, y, w, h, cur, max) {
    var frac = Math.max(0, cur / max);
    cx.fillStyle = '#404040'; cx.fillRect(x - 1, y - 1, w + 2, h + 2);
    cx.fillStyle = '#101820'; cx.fillRect(x, y, w, h);
    cx.fillStyle = frac > .5 ? '#48d048' : frac > .2 ? '#f0c020' : '#e04040';
    cx.fillRect(x, y, Math.round(w * frac), h);
  }

  function ctx() { return cx; }
  function canvas() { return cv; }

  return { init: init, clear: clear, drawTile: drawTile, drawPlayer: drawPlayer,
           drawEmoji: drawEmoji, box: box, text: text, textCentered: textCentered,
           textBig: textBig, hpBar: hpBar, ctx: ctx, canvas: canvas };
})();

window.SS = SS;
