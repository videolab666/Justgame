// Heuristic player bot for balance analysis (docs/BALANCE.md).
// Usage: node scripts/balance-sim.mjs [good|novice] [seeds=3] [all|1-1,1-2]
// Env: TRACE=1 (placements/spawns/breaches), BOSSLOG=1 (boss HP every 15 s),
//      SCALE=k (multiply STAGE_BUDGET), ROOT=<url of another src/ folder>.
// It is a rough model of a player, not an oracle: compare runs, not absolutes.
const ROOT = process.env.ROOT || new URL("../src/", import.meta.url).href;
const D = await import(ROOT + "data.js");
const EN = await import(ROOT + "engine.js");
const {UNIT_BY_ID, getLevel, unlockedUnits, levelId, TOOLS, SCHEMES} = D;
const {makeGame, tick, place, collectToken, useGuard, makeWavePlan} = EN;

const SKILL = {
  good:   {collectDelay: 1.0, think: 0.4, ecoCols: 2, miss: 0},
  novice: {collectDelay: 3.5, think: 1.5, ecoCols: 1, miss: .3},
};
const args = process.argv.slice(2);
const skillName = args[0] || "good";
const SEEDS = Number(args[1] || 3);
const only = args[2] && args[2] !== "all" ? new Set(args[2].split(",")) : null;
const sk = SKILL[skillName];
if (process.env.SCALE) { const k = Number(process.env.SCALE); for (let i = 0; i < EN.STAGE_BUDGET.length; i++) EN.STAGE_BUDGET[i] *= k; }

const RECOMMEND = [
  ["registrar","cnap","notary","notification","senior","mine","commission","archive"],
  ["executor","cnap","limitation","trustee","private_executor","station","notary","registrar"],
  ["whistleblower","cnap","integrity","order","expert","intern","legal_aid","registrar","notary","mine"],
  ["twofactor","cnap","shield","notification","expert","apostille","digital_office","registrar","notary","mine"],
];
function deckFor(world, stage) {
  const completed = {};
  for (let w = 0; w <= world; w++)
    for (let s = 1; s <= 10; s++) {
      if (w === world && s >= stage) break;
      completed[levelId(w, s)] = 2;
    }
  const owned = new Set(unlockedUnits(completed).map(u => u.id));
  const stars = Object.values(completed).reduce((a, b) => a + b, 0);
  const max = 8 + (stars >= 15) + (stars >= 60);
  const deck = RECOMMEND[world].filter(x => owned.has(x)).slice(0, max);
  if (getLevel(world, stage).special.blackout && owned.has("station") && !deck.includes("station")) {
    if (deck.length >= max) deck.pop();
    deck.push("station");
  }
  return {deck: deck.length ? deck : ["registrar"], careerBonus: stars >= 35 ? 25 : 0};
}

const RANGED = ["shooter","intern","lobber","splash","air","slow","sniper","global"];
const mult = (u, e) => TOOLS[u.tool]?.multipliers[SCHEMES.indexOf(e.scheme)] ?? 1;
// Can unit kind u ever hurt enemy e (ignoring reveal/fog)?
function canHurt(u, e) {
  if (e.trait === "neutral") return false;
  if (u.kind === "trap") return e.scheme === "cyber" && e.trait !== "hydra_head";
  if ((e.trait === "flying" || e.air && e.id !== "boss") && !["air","sniper","global"].includes(u.kind)) return false;
  if (e.trait === "burrow" && !["lobber"].includes(u.kind)) return false;
  if (e.id === "hacker" && u.tool === "notary") return false;
  return RANGED.includes(u.kind);
}
function dps(u, e) {
  let m = mult(u, e);
  if (u.kind === "intern") return 10 / 2 * m;
  if (u.kind === "trap") return 35;
  return (u.damage || 0) / (u.interval || 2) * m;
}

function freeCell(g, lane, cols) {
  for (const c of cols)
    if (!g.defenders.some(d => d.lane === lane && d.col === c && d.hp > 0) &&
        !g.locks.some(l => l.lane === lane && l.col === c)) return c;
  return null;
}
function tryPlace(g, id, lane, cols) {
  const u = UNIT_BY_ID[id];
  if (!g.deck.includes(id) || g.seal < u.cost || (g.cooldowns[id] || 0) > 0) return false;
  const c = freeCell(g, lane, cols);
  if (c == null) return false;
  const ok=place(g, id, lane, c).ok; if(ok&&process.env.TRACE)console.log(`t=${g.time.toFixed(1)} place ${id} L${lane} c${c} seal=${g.seal}`); return ok;
}

function bossImmuneLike(g, e) {
  return e.id === "boss" && g.enemies.some(x => ["offshore_safe","tentacle","hydra_head"].includes(x.trait) && x.hp > 0);
}
function botStep(g, st) {
  const lanes = g.level.activeLanes;
  const live = g.enemies.filter(e => e.hp > 0);
  // Boss mechanics a player is told about explicitly.
  const boss = live.find(e => e.id === "boss");
  if (boss && g.level.world === 0 && boss.phase >= 3 && !g.bossGuardUsed) useGuard(g, boss.lane);
  // Wall big walkers (boss, golem) with notaries in front of the guns.
  for (const e of live) if ((e.id === "boss" || e.trait === "giant") && e.x < 7.5 && !bossImmuneLike(g, e)) {
    const wallCol = Math.max(1, Math.min(7, Math.floor(e.x) - 1));
    const hasWall = g.defenders.some(d => d.lane === e.lane && d.kind === "wall" && d.col <= wallCol + 1 && d.col >= wallCol - 1);
    if (!hasWall && (tryPlace(g, "notary_office", e.lane, [wallCol, wallCol - 1]) || tryPlace(g, "notary", e.lane, [wallCol, wallCol - 1]))) return;
  }
  // Commission restores seized cells.
  for (const l of g.locks) if (tryPlace(g, "commission", l.lane, [l.col])) return;
  // 2FA on hydra heads / cyber lanes.
  for (const e of live) if (e.trait === "hydra_head" && e.exhausted)
    if (tryPlace(g, "twofactor", e.lane, [Math.floor(e.x), 6, 5, 4, 3, 2, 1, 8])) return;
  // Legal aid sweep on a crowded lane.
  for (const lane of lanes) {
    const inLane = live.filter(e => e.lane === lane && e.x < 6);
    const hp = inLane.reduce((a, e) => a + e.hp, 0);
    if (hp > 1500 && tryPlace(g, "legal_aid", lane, [0,1,2,3,4,5,6,7,8])) return;
  }
  // Whistleblower on corruption cluster.
  for (const e of live) if (e.scheme === "corruption" && e.x < 8.5) {
    const near = live.filter(o => o.scheme === "corruption" && Math.abs(o.lane - e.lane) <= 2 && Math.abs(o.x - e.x) <= 2.5);
    if (near.length >= 2 || e.trait === "tentacle" || e.id === "boss")
      if (tryPlace(g, "whistleblower", e.lane, [Math.max(0, Math.min(8, Math.floor(e.x)))])) return;
  }
  // Blackout: two stations cover lanes 0-4 around column 1-2.
  if (g.level.special.blackout && g.spawned > 0)
    for (const lane of [1, 3]) if (!g.defenders.some(d => d.kind === "power" && d.lane === lane))
      if (tryPlace(g, "station", lane, [1])) return;
  // Per-lane assessment.
  const laneInfo = lanes.map(lane => {
    const enemies = live.filter(e => e.lane === lane && e.trait !== "neutral" && !(e.trait === "offshore_safe" && !e.reveal));
    const defs = g.defenders.filter(d => d.lane === lane && d.hp > 0);
    const attackers = defs.filter(d => RANGED.includes(d.kind) || d.kind === "trap");
    let need = 0, have = 0, uncovered = null;
    for (const e of enemies) {
      const myDps = attackers.reduce((a, d) => a + (canHurt(UNIT_BY_ID[d.id], e) ? dps(UNIT_BY_ID[d.id], e) : 0), 0);
      if (myDps === 0) uncovered = uncovered || e;
      const v = Math.max(.03, e.speed / 4.5);
      const timeLeft = e.id === "boss" ? 45 : Math.max(2, (e.x - 1) / v);
      need += (e.hp + e.shield) / timeLeft;
      have = Math.max(have, myDps);
    }
    const closest = enemies.reduce((m, e) => Math.min(m, e.x), 99);
    return {lane, enemies, defs, attackers, need: need * 1.35, have, uncovered, closest};
  }).sort((a, b) => a.closest - b.closest);

  const attackerIds = g.deck.filter(id => RANGED.includes(UNIT_BY_ID[id].kind) || id === "twofactor");
  const bestFor = (e) => attackerIds.filter(id => e ? canHurt(UNIT_BY_ID[id], e) : id !== "twofactor")
    .sort((a, b) => (e ? dps(UNIT_BY_ID[b], e) / UNIT_BY_ID[b].cost - dps(UNIT_BY_ID[a], e) / UNIT_BY_ID[a].cost : UNIT_BY_ID[a].cost - UNIT_BY_ID[b].cost));
  const shooterCols = [1,2,3,0,4,5,6];
  const deficient = laneInfo.filter(L => L.enemies.length && (L.uncovered || L.need > L.have));

  // 1) Arm the most urgent deficient lane; if broke and enemy close, stall it.
  for (const L of deficient) {
    const target = L.uncovered || L.enemies[0];
    const cols = L.enemies.some(e => e.id === "boss") ? [...shooterCols, 7] : shooterCols;
    for (const id of bestFor(target)) if (tryPlace(g, id, L.lane, id === "twofactor" ? [5,4,6,3] : cols)) return;
    if (L.closest < 4) {
      const wallCol = Math.max(0, Math.floor(L.closest) - 1);
      if (tryPlace(g, "notary", L.lane, [wallCol, wallCol - 1].filter(c => c >= 0))) return;
      if (tryPlace(g, "mine", L.lane, [wallCol])) return;
    }
    if (L.closest < 6) return; // save money for this lane
  }
  // 2) Support units for specific threats in already armed lanes.
  for (const L of laneInfo) if (L.attackers.length) for (const e of L.enemies) {
    if (!e.reveal && e.x < 8.5 && !L.defs.some(d => d.kind === "reveal"))
      if (tryPlace(g, "notification", L.lane, [4,3,5,2])) return;
    if (["bribe","hack"].includes(e.trait) && !L.defs.some(d => d.kind === "integrity"))
      if (tryPlace(g, "integrity", L.lane, [2,3,1])) return;
    if (e.scheme === "cyber" && e.trait !== "hydra_head" && !L.defs.some(d => d.kind === "trap") && e.x < 8)
      if (tryPlace(g, "twofactor", L.lane, [5,4,6])) return;
    if (e.trait === "jump" && !L.defs.some(d => d.kind === "slow"))
      if (tryPlace(g, "limitation", L.lane, [2,3,1])) return;
    if (["jump","disguised_jump","giant"].includes(e.trait) && e.x < 7)
      if (tryPlace(g, "notary_office", L.lane, [5,4])) return;
  }
  // 3) Economy when nothing urgent.
  const cnaps = g.defenders.filter(d => d.kind === "income" || d.kind === "upgrade").length;
  const ecoTarget = Math.min(lanes.length * sk.ecoCols, 3 + Math.floor(g.time / 12));
  if (!deficient.some(L => L.closest < 7.5) && cnaps < ecoTarget) {
    for (const lane of lanes) if (tryPlace(g, "cnap", lane, [0])) return;
    if (sk.ecoCols > 1) for (const lane of lanes) if (tryPlace(g, "cnap", lane, [1])) return;
  }
  for (const d of g.defenders) if (d.kind === "income" && g.seal > 300)
    if (tryPlace(g, "digital_office", d.lane, [d.col])) return;
  // 4) Pre-arm empty lanes after the first enemies appear.
  if (g.spawned > 0 && cnaps >= Math.min(ecoTarget, lanes.length)) for (const L of laneInfo)
    if (!L.attackers.length) for (const id of bestFor(null)) if (tryPlace(g, id, L.lane, shooterCols)) return;
  // 5) Surplus: second gun in the busiest lane, then a wall.
  if (g.seal > 300 && g.spawned > 0) {
    const L = [...laneInfo].sort((a, b) => b.need - a.need)[0];
    for (const id of bestFor(L.enemies[0])) if (tryPlace(g, id, L.lane, shooterCols)) return;
    if (tryPlace(g, "notary", L.lane, [6, 5])) return;
  }
}

function run(world, stage, seed) {
  const level = getLevel(world, stage);
  const {deck, careerBonus} = deckFor(world, stage);
  const g = makeGame(level, deck, "normal", {careerBonus}, null);
  if (seed) g.plan = makeWavePlan(level, seed);
  const origRandom = Math.random;
  let rs = seed * 7 + 13;
  Math.random = () => { rs = (Math.imul(rs, 1664525) + 1013904223) >>> 0; return rs / 4294967296; };
  const dt = 1 / 30;
  let nextThink = 0, idle = 0, longestIdle = 0, curIdle = 0, firstContact = null;
  let bankSum = 0, bankN = 0, minX = 99, peakEnemies = 0;
  while (g.phase === "playing" && g.time < 900) {
    const ne=g.spawned, nb=g.breaches; tick(g, dt); if(process.env.TRACE&&g.spawned>ne)for(let q=ne;q<g.spawned;q++)console.log(`t=${g.time.toFixed(1)} SPAWN ${g.plan[q].id} L${g.plan[q].lane}`); if(process.env.TRACE&&g.breaches>nb)console.log(`t=${g.time.toFixed(1)} BREACH ${g.lastThreat.id} L${g.lastThreat.lane}`);
    for (const t of [...g.tokens]) if (11 - t.ttl >= sk.collectDelay) { if ((t.uid * 2654435761 % 1000) / 1000 >= sk.miss) collectToken(g, t.uid); else t.skip = 1; }
    if (g.time >= nextThink) { botStep(g, {}); nextThink = g.time + sk.think; }
    const alive = g.enemies.filter(e => e.hp > 0);
    peakEnemies = Math.max(peakEnemies, alive.length);
    for (const e of alive) if (e.trait !== "neutral" && !["offshore_safe","tentacle","hydra_head"].includes(e.trait)) minX = Math.min(minX, e.x);
    // "Dead air": no enemy visible on the field.
    if (alive.length === 0) { curIdle += dt; idle += dt; longestIdle = Math.max(longestIdle, curIdle); }
    else curIdle = 0;
    if (firstContact == null && alive.length) firstContact = g.time;
    bankSum += g.seal; bankN++;
    if (process.env.BOSSLOG && Math.floor(g.time / 15) !== Math.floor((g.time - dt) / 15)) { const b = g.enemies.find(e => e.id === "boss"); if (b) console.log(`t=${g.time.toFixed(0)} boss hp=${b.hp.toFixed(0)}/${b.maxHp} x=${b.x.toFixed(2)} ph=${b.phase} laneDefs=${g.defenders.filter(d => d.lane === b.lane).map(d => d.id + "@" + d.col + (g.time < d.confusedUntil ? "?" : "") + (g.time < d.disabledUntil ? "!" : "")).join(",")} heads=${g.enemies.filter(e=>e.trait==="hydra_head").map(e=>e.id.slice(6)+"L"+e.lane+":"+e.hp.toFixed(0)+(e.exhausted?"x":"")).join(",")} enemiesInLane=${g.enemies.filter(e => e.lane === b.lane && e !== b).map(e=>e.id+"@"+e.x.toFixed(1)).join(",")}`); }
  }
  Math.random = origRandom;
  return {id: level.id, phase: g.phase, time: g.time, breaches: g.breaches, losses: g.defenderLosses,
    idle, longestIdle, avgBank: bankSum / bankN, minX, peakEnemies, hint: g.lastHint,
    guards: g.usedGuards.filter(Boolean).length};
}

const rows = [];
for (let w = 0; w < 4; w++) for (let s = 1; s <= 10; s++) {
  const id = `${w + 1}-${s}`;
  if (only && !only.has(id)) continue;
  const res = [];
  for (let k = 0; k < SEEDS; k++) res.push(run(w, s, k === 0 ? 0 : 1000 + k * 37));
  const wins = res.filter(r => r.phase === "won").length;
  const avg = f => (res.reduce((a, r) => a + f(r), 0) / res.length);
  rows.push(id);
  console.log(`${id.padEnd(5)} win ${wins}/${SEEDS}  guards ${avg(r => r.guards).toFixed(1)}  minX ${avg(r => r.minX).toFixed(2)}  ` +
    `bank ${avg(r => r.avgBank).toFixed(0).padStart(4)}  idle ${avg(r => r.idle).toFixed(0).padStart(3)}s  maxGap ${avg(r => r.longestIdle).toFixed(0).padStart(3)}s  ` +
    `peak ${avg(r => r.peakEnemies).toFixed(0).padStart(2)}  dur ${avg(r => r.time).toFixed(0)}s` +
    (wins < SEEDS ? `  | ${res.find(r => r.phase !== "won").hint.slice(0, 70)}` : ""));
}
