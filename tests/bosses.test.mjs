import test from 'node:test';
import assert from 'node:assert/strict';
import {getLevel} from '../src/data.js';
import {makeGame,spawn,place,tick,damageEnemy} from '../src/engine.js';

test('Graph debt boss is invulnerable until offshore safes are discovered and destroyed',()=>{
 const g=makeGame(getLevel(1,10),['executor']);
 g.plan=[];g.seal=3000;
 const boss=spawn(g,'boss',2,8);
 const safes=g.enemies.filter(x=>x.id==='offshore_safe');
 assert.equal(safes.length,4);
 assert.ok(safes.every(x=>!x.reveal));
 const before=boss.hp;
 damageEnemy(g,boss,2000,'enforcement');assert.equal(boss.hp,before);
 place(g,'executor',0,2);
 tick(g,.13);
 assert.ok(safes.every(x=>x.reveal));
 for(const s of safes)damageEnemy(g,s,900,'enforcement');
 assert.equal(g.enemies.some(x=>x.id==='offshore_safe'),false);
 damageEnemy(g,boss,2000,'enforcement');
 assert.ok(boss.hp<before);
});
test('five corrupt tentacles protect the boss head',()=>{
 const g=makeGame(getLevel(2,10),['whistleblower']);
 g.plan=[];
 const boss=spawn(g,'boss',2,8);
 const parts=g.enemies.filter(x=>x.id==='tentacle');
 assert.equal(parts.length,5);
 damageEnemy(g,boss,400,'integrity');
 const withParts=boss.maxHp-boss.hp;
 for(const part of parts)damageEnemy(g,part,2000,'integrity');
 assert.equal(g.enemies.some(x=>x.id==='tentacle'),false);
 const old=boss.hp;
 damageEnemy(g,boss,400,'integrity');
 assert.ok(old-boss.hp>withParts);
});
test('Hydra heads are only exhausted by ordinary tools and finished by 2FA',()=>{
 const g=makeGame(getLevel(3,10),['twofactor']);
 g.plan=[];
 const boss=spawn(g,'boss',2,8);
 assert.equal(boss.maxHp,6000);
 assert.equal(g.enemies.filter(x=>x.trait==='hydra_head').length,3);
 const head=g.enemies.find(x=>x.id==='hydra_phish');
 const old=boss.hp;
 damageEnemy(g,boss,500,'digital');
 assert.equal(boss.hp,old);
 damageEnemy(g,head,20000,'registry');
 assert.equal(head.hp,1,'non-digital damage stops at 1 HP');
 assert.equal(g.enemies.includes(head),true);
 assert.equal(g.enemies.filter(x=>x.trait==='hydra_head').length,3,'no regrowth');
 damageEnemy(g,head,20000,'registry');
 assert.equal(head.hp,1);
 damageEnemy(g,head,20,'digital');
 assert.equal(g.enemies.includes(head),false);
 assert.equal(g.enemies.filter(x=>x.trait==='hydra_head').length,2);
});
test('2FA placed on a head cell finishes an exhausted head',()=>{
 const g=makeGame(getLevel(3,10),['twofactor']);
 g.plan=[];g.seal=1000;g.nextSky=1e9;
 spawn(g,'boss',2,8);
 const head=g.enemies.find(x=>x.id==='hydra_call');
 damageEnemy(g,head,1e6,'registry');
 assert.equal(place(g,'twofactor',head.lane,Math.floor(head.x)).ok,true);
 // The call head cannot jam 2FA (same rule as phishers and callers).
 for(let i=0;i<300&&g.enemies.includes(head);i++)tick(g,1/30);
 assert.equal(g.enemies.includes(head),false);
});
test('Hydra body death initiates final survival timer rather than instant campaign victory',()=>{
 const g=makeGame(getLevel(3,10),['twofactor']);
 g.plan=[];
 const boss=spawn(g,'boss',2,7);
 for(const part of [...g.enemies].filter(x=>x.trait==='hydra_head'))damageEnemy(g,part,20000,'digital');
 damageEnemy(g,boss,20000,'digital');
 assert.ok(g.finalSurvivalUntil>=g.time+29);
 assert.ok(g.lastHint.includes('30 секунд'));
});
test('an immune boss waits behind its parts instead of walking to the house',()=>{
 for(const world of [1,3]){
  const g=makeGame(getLevel(world,10),['registrar']);
  g.plan=[];g.nextSky=1e9;
  const boss=spawn(g,'boss',2,8);
  for(let i=0;i<300;i++)tick(g,1/30);
  assert.equal(boss.x,8,'world '+(world+1));
 }
});
test('bosses walk the centre lane',async()=>{
 const {makeWavePlan}=await import('../src/engine.js');
 for(let w=0;w<4;w++)assert.equal(makeWavePlan(getLevel(w,10)).find(a=>a.id==='boss').lane,2);
});
test('flying Count hovers in phase 2 and every shooter can still hit him',async()=>{
 const {canTarget}=await import('../src/engine.js');
 const g=makeGame(getLevel(1,10),['registrar']);
 g.plan=[];g.nextSky=1e9;
 const boss=spawn(g,'boss',2,6);
 g.enemies=g.enemies.filter(e=>e.id==='boss');
 damageEnemy(g,boss,boss.maxHp*.2,'enforcement'); // x2 vs debt -> 60 % HP
 assert.equal(boss.phase,2);assert.equal(boss.air,true);
 const x=boss.x;
 for(let i=0;i<50;i++)tick(g,.1);
 assert.equal(boss.x,x,'hovers in place');
 assert.equal(canTarget(g,{kind:'shooter',tool:'registry'},boss),true);
 const hp=boss.hp;damageEnemy(g,boss,100,'registry');
 assert.ok(Math.abs(hp-boss.hp-20)<1e-6,'non-enforcement x0.2');
});
test('Octopus waits behind its tentacles, then takes full damage',()=>{
 const g=makeGame(getLevel(2,10),['registrar']);
 g.plan=[];g.nextSky=1e9;
 const boss=spawn(g,'boss',2,8.5);
 for(let i=0;i<50;i++)tick(g,.1);
 assert.equal(boss.x,8.5,'anchored while tentacles live');
 for(const t of g.enemies.filter(e=>e.id==='tentacle'))damageEnemy(g,t,1e5,'integrity');
 const hp=boss.hp;damageEnemy(g,boss,100,'registry');
 assert.equal(hp-boss.hp,100,'no permanent x0.5 for non-integrity tools');
 for(let i=0;i<20;i++)tick(g,.1);
 assert.ok(boss.x<8.5,'walks once free');
});
test('2FA anywhere in the row finishes an exhausted head (its cell may be taken)',()=>{
 const g=makeGame(getLevel(3,10),['twofactor','registrar']);
 g.plan=[];g.seal=1000;g.nextSky=1e9;
 spawn(g,'boss',2,8);
 const head=g.enemies.find(x=>x.id==='hydra_phish');
 assert.equal(place(g,'registrar',head.lane,Math.floor(head.x)).ok,true);
 damageEnemy(g,head,1e6,'registry');
 assert.equal(head.exhausted,true);
 assert.equal(place(g,'twofactor',head.lane,2).ok,true);
 for(let i=0;i<120&&g.enemies.includes(head);i++)tick(g,1/30);
 assert.equal(g.enemies.includes(head),false);
});
test('hidden safes reveal themselves after a while, so the Count cannot stall forever',()=>{
 const g=makeGame(getLevel(1,10),['registrar']);
 g.plan=[];g.nextSky=1e9;
 spawn(g,'boss',2,9);
 const safes=g.enemies.filter(e=>e.trait==='offshore_safe');
 assert.ok(safes.every(s=>!s.reveal));
 for(let i=0;i<220;i++)tick(g,.1);
 assert.ok(safes.every(s=>s.reveal));
});
