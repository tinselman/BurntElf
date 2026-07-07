/* =============================================================================
 * data.js  —  Static game data for the SoulSilver (Johto) recreation.
 *
 * Everything here is pure data: the Pokedex, move list, the Generation-IV type
 * chart, and the tile maps for the early game (New Bark Town -> Elm's Lab ->
 * Route 29 -> Cherrygrove City).
 *
 * Data is grounded in Bulbapedia / StrategyWiki (base stats, catch rates, Gen-IV
 * move data) so the battle maths behave like the real games.  See README.md.
 * =========================================================================== */

var SS = window.SS || {};

/* ------------------------------------------------------------------ types --- */
// The 17 Generation-IV types (Fairy did not exist yet).
SS.TYPES = ['normal','fire','water','electric','grass','ice','fighting','poison',
            'ground','flying','psychic','bug','rock','ghost','dragon','dark','steel'];

// Type chart: CHART[attacking][defending] = multiplier (0, 0.5, 1, 2).
// Only non-1 entries are listed; everything else defaults to 1.
SS.TYPE_CHART = {
  normal:   {rock:.5, ghost:0, steel:.5},
  fire:     {fire:.5, water:.5, grass:2, ice:2, bug:2, rock:.5, dragon:.5, steel:2},
  water:    {fire:2, water:.5, grass:.5, ground:2, rock:2, dragon:.5},
  electric: {water:2, electric:.5, grass:.5, ground:0, flying:2, dragon:.5},
  grass:    {fire:.5, water:2, grass:.5, poison:.5, ground:2, flying:.5, bug:.5, rock:2, dragon:.5, steel:.5},
  ice:      {fire:.5, water:.5, grass:2, ice:.5, ground:2, flying:2, dragon:2, steel:.5},
  fighting: {normal:2, ice:2, poison:.5, flying:.5, psychic:.5, bug:.5, rock:2, ghost:0, dark:2, steel:2},
  poison:   {grass:2, poison:.5, ground:.5, rock:.5, ghost:.5, steel:0},
  ground:   {fire:2, electric:2, grass:.5, poison:2, flying:0, bug:.5, rock:2, steel:2},
  flying:   {electric:.5, grass:2, fighting:2, bug:2, rock:.5, steel:.5},
  psychic:  {fighting:2, poison:2, psychic:.5, dark:0, steel:.5},
  bug:      {fire:.5, grass:2, fighting:.5, poison:.5, flying:.5, psychic:2, ghost:.5, dark:2, steel:.5},
  rock:     {fire:2, ice:2, fighting:.5, ground:.5, flying:2, bug:2, steel:.5},
  ghost:    {normal:0, psychic:2, ghost:2, dark:.5},
  dragon:   {dragon:2, steel:.5},
  dark:     {fighting:.5, psychic:2, ghost:2, dark:.5},
  steel:    {fire:.5, water:.5, electric:.5, ice:2, rock:2, steel:.5}
};

/* ------------------------------------------------------------------ moves --- */
// category: 'physical' | 'special' | 'status'
// effect (optional): {stat, stages, target} for stat changes, or {status} to inflict.
SS.MOVES = {
  tackle:     {name:'Tackle',      type:'normal',  category:'physical', power:35, acc:95, pp:35},
  scratch:    {name:'Scratch',     type:'normal',  category:'physical', power:40, acc:100, pp:35},
  pound:      {name:'Pound',       type:'normal',  category:'physical', power:40, acc:100, pp:35},
  quickattack:{name:'Quick Attack',type:'normal',  category:'physical', power:40, acc:100, pp:30, priority:1},
  growl:      {name:'Growl',       type:'normal',  category:'status',   power:0,  acc:100, pp:40, effect:{stat:'atk', stages:-1, target:'foe'}},
  tailwhip:   {name:'Tail Whip',   type:'normal',  category:'status',   power:0,  acc:100, pp:30, effect:{stat:'def', stages:-1, target:'foe'}},
  leer:       {name:'Leer',        type:'normal',  category:'status',   power:0,  acc:100, pp:30, effect:{stat:'def', stages:-1, target:'foe'}},
  ember:      {name:'Ember',       type:'fire',    category:'special',  power:40, acc:100, pp:25, effect:{status:'burn', chance:10}},
  watergun:   {name:'Water Gun',   type:'water',   category:'special',  power:40, acc:100, pp:25},
  vinewhip:   {name:'Vine Whip',   type:'grass',   category:'physical', power:35, acc:100, pp:15},
  razorleaf:  {name:'Razor Leaf',  type:'grass',   category:'physical', power:55, acc:95,  pp:25, highCrit:true},
  gust:       {name:'Gust',        type:'flying',  category:'special',  power:40, acc:100, pp:35},
  peck:       {name:'Peck',        type:'flying',  category:'physical', power:35, acc:100, pp:35},
  sandattack: {name:'Sand-Attack', type:'ground',  category:'status',   power:0,  acc:100, pp:15, effect:{stat:'acc', stages:-1, target:'foe'}},
  stringshot: {name:'String Shot', type:'bug',     category:'status',   power:0,  acc:95,  pp:40, effect:{stat:'spe', stages:-1, target:'foe'}},
  poisonsting:{name:'Poison Sting',type:'poison',  category:'physical', power:15, acc:100, pp:35, effect:{status:'poison', chance:30}},
  bugbite:    {name:'Bug Bite',    type:'bug',     category:'physical', power:60, acc:100, pp:20},
  bite:       {name:'Bite',        type:'dark',    category:'physical', power:60, acc:100, pp:25},
  defensecurl:{name:'Defense Curl',type:'normal',  category:'status',   power:0,  acc:100, pp:40, effect:{stat:'def', stages:1, target:'self'}}
};

/* --------------------------------------------------------------- pokedex --- */
// stats order everywhere: hp, atk, def, spa, spd, spe
// growth: 'mediumFast' (n^3) or 'mediumSlow'. learnset: {level: moveId}.
SS.DEX = {
  chikorita: {id:152, name:'Chikorita', types:['grass'], base:[45,49,65,49,65,45],
    catchRate:45, baseExp:64, growth:'mediumSlow',
    learnset:{1:'tackle', 3:'growl', 6:'razorleaf'}},
  cyndaquil: {id:155, name:'Cyndaquil', types:['fire'], base:[39,52,43,60,50,65],
    catchRate:45, baseExp:65, growth:'mediumSlow',
    learnset:{1:'tackle', 6:'leer', 10:'ember'}},
  totodile:  {id:158, name:'Totodile', types:['water'], base:[50,65,64,44,48,43],
    catchRate:45, baseExp:66, growth:'mediumSlow',
    learnset:{1:'scratch', 6:'leer', 10:'watergun'}},

  pidgey:    {id:16,  name:'Pidgey',   types:['normal','flying'], base:[40,45,40,35,35,56],
    catchRate:255, baseExp:50, growth:'mediumSlow',
    learnset:{1:'tackle', 5:'sandattack', 9:'gust', 13:'quickattack'}},
  rattata:   {id:19,  name:'Rattata',  types:['normal'], base:[30,56,35,25,35,72],
    catchRate:255, baseExp:51, growth:'mediumFast',
    learnset:{1:'tackle', 1:'tailwhip', 7:'quickattack', 13:'bite'}},
  sentret:   {id:161, name:'Sentret',  types:['normal'], base:[35,46,34,35,45,20],
    catchRate:255, baseExp:57, growth:'mediumFast',
    learnset:{1:'scratch', 1:'tailwhip', 6:'defensecurl', 12:'quickattack'}},
  hoothoot:  {id:163, name:'Hoothoot', types:['normal','flying'], base:[60,30,30,36,56,50],
    catchRate:255, baseExp:58, growth:'mediumFast',
    learnset:{1:'tackle', 6:'growl', 11:'peck'}},
  caterpie:  {id:10,  name:'Caterpie', types:['bug'], base:[45,30,35,20,20,45],
    catchRate:255, baseExp:39, growth:'mediumFast',
    learnset:{1:'tackle', 1:'stringshot'}},
  weedle:    {id:13,  name:'Weedle',   types:['bug','poison'], base:[40,35,30,20,20,50],
    catchRate:255, baseExp:39, growth:'mediumFast',
    learnset:{1:'poisonsting', 1:'stringshot'}}
};

/* --------------------------------------------------------- encounter data --- */
// Wild tables for tall-grass tiles, per map id. weight = relative chance.
SS.ENCOUNTERS = {
  route29: [
    {species:'pidgey',  min:2, max:4, weight:30},
    {species:'rattata', min:2, max:4, weight:30},
    {species:'sentret', min:2, max:4, weight:25},
    {species:'hoothoot',min:2, max:4, weight:10},
    {species:'caterpie',min:2, max:3, weight:3},
    {species:'weedle',  min:2, max:3, weight:2}
  ]
};

/* ------------------------------------------------------------------- maps --- */
// Tile legend:
//   #  tree / wall (blocked)      .  path / short grass (walk)
//   ~  tall grass (encounters)    W  water (blocked)
//   H  house/lab wall (blocked)   D  door / warp (see warps)
//   C  Poke-Center heal counter   F  flowers (blocked deco)
//   -  ledge / fence (blocked)    space = interior floor (walk)
//   s  sign (blocked, readable)
//
// Each map lists its grid (rows of equal length), warps, signs and any
// heal tile.  Warp: {x,y,to,tx,ty}. Player enters `to` map at (tx,ty).
SS.MAPS = {
  newbark: {
    name:'New Bark Town',
    grid:[
      '############',
      '#....s.....#',
      '#..HHH..HHH#',
      '#..HDH..HDH#',
      '#..........#',
      '#....s.....#',
      '#..........#',
      '#.WW......F#',
      '#.WW.....FF#',
      '#..........#',
      '#####..#####',
      '     ..     '
    ],
    warps:[
      {x:4, y:3, to:'playerhouse', tx:3, ty:4},   // left building = your house
      {x:9, y:3, to:'elmlab', tx:4, ty:5},        // right building = Elm's Lab
      {x:6, y:11, to:'route29', tx:17, ty:1},     // south exit -> east end of Route 29
      {x:5, y:11, to:'route29', tx:17, ty:1}
    ],
    signs:{
      '5,1':'NEW BARK TOWN — "The town where the winds of a new beginning blow."',
      '5,5':"PROF. ELM'S POKEMON LAB"
    }
  },

  playerhouse: {
    name:'Your House',
    grid:[
      'HHHHHHHH',
      'H  ss  H',
      'H      H',
      'H  ..  H',
      'H  ..  H',
      'HHHDHHHH'
    ],
    warps:[ {x:3, y:5, to:'newbark', tx:4, ty:4} ],
    signs:{ '3,1':'A cozy room. Your Mom watches the news downstairs.',
            '4,1':'A game console sits in the corner.' }
  },

  elmlab: {
    name:"Elm's Lab",
    grid:[
      'HHHHHHHHH',
      'H  sss  H',
      'H       H',
      'H  ppp  H',   // p = starter machine (handled specially)
      'H       H',
      'H       H',
      'HHHHDHHHH'
    ],
    warps:[ {x:4, y:6, to:'newbark', tx:9, ty:4} ],
    signs:{ '3,1':'Bookshelves crammed with research on Pokemon.' },
    // Three Poke Balls on the table; stepping onto them (row 3) triggers choice.
    starterTiles:{ '3,3':'chikorita', '4,3':'cyndaquil', '5,3':'totodile' }
  },

  route29: {
    name:'Route 29',
    grid:[
      '####################',
      '#........~~~~......D#',
      '#..~~~...~~~~...~~..#',
      '#..~~~.........~~..#',
      '#......###.........#',
      '#..~~..###..~~~~...#',
      '#..~~.......~~~~..s#',
      '#...........~~~~...#',
      'D..................#',
      '####################'
    ],
    warps:[
      {x:19, y:1, to:'newbark', tx:6, ty:10},        // east -> back to New Bark
      {x:0,  y:8, to:'cherrygrove', tx:10, ty:5}     // west -> Cherrygrove City
    ],
    signs:{ '18,6':'ROUTE 29 — "Many a young trainer takes their first steps here."' }
  },

  cherrygrove: {
    name:'Cherrygrove City',
    grid:[
      '################',
      '#..HHH...HHH...#',
      '#..HCH...HDH..s#',
      '#..H.H...H.H...#',
      '#.............WW#',
      '#..........D..WW#',   // east warp back to route 29
      '#.....s.......WW#',
      '#..HHH........WW#',
      '#..HDH........WW#',
      '################'
    ],
    warps:[
      {x:11, y:5, to:'route29', tx:1, ty:8},   // east path back to Route 29
    ],
    signs:{
      '14,2':'CHERRYGROVE CITY — "The City of Cute, Fragrant Flowers."',
      '6,6':'POKEMON CENTER: Heal your team for free!',
    },
    healTiles:{ '4,2':true }   // C tile: step here to fully heal party
  }
};

window.SS = SS;
