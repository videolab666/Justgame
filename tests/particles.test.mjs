import test from "node:test";
import assert from "node:assert/strict";
import {getLevel} from "../src/data.js";
import {makeGame,spawn,place,tick,emitBurst,advanceParticles} from "../src/engine.js";
test("visual impact fragments are bounded and expire",()=>{
 const g=makeGame(getLevel(0,2),["registrar"]);
 emitBurst(g,"stamp",2,4,300);
 assert.equal(g.particles.length,14);
 assert.ok(g.particles.every(p=>p.ttl>0&&Number.isFinite(p.vx)));
 advanceParticles(g,.11);
 assert.ok(g.particles.some(p=>p.age>0&&p.x!==4));
 advanceParticles(g,.9);
 assert.equal(g.particles.length,0);
});
test("reduced-motion never creates optional particles",()=>{
 const g=makeGame(getLevel(0,2),["registrar"],"normal",{reducedMotion:true});
 emitBurst(g,"dossier",2,4,12);
 assert.equal(g.particles.length,0);
});
test("a real impact creates particle fragments; no random gameplay damage from particles",()=>{
 const g=makeGame(getLevel(0,3),["registrar"],"normal",{autoCollect:true});
 g.plan=[];g.seal=1000;
 place(g,"registrar",2,2);
 const e=spawn(g,"schemer",2,6);
 let firstShot=false;
 for(let i=0;i<15;i++){
  tick(g,.1);
  if(g.projectiles.length)firstShot=true;
  if(e.lastHitAt!==undefined)break;
 }
 assert.ok(firstShot);
 assert.ok(e.lastHitAt>=0);
 assert.ok(g.particles.length>0);
 const hp=e.hp;
 advanceParticles(g,.1);
 assert.equal(e.hp,hp);
});
test("many animation bursts cannot grow particle list without limit",()=>{
 const g=makeGame(getLevel(0,2),["registrar"]);
 for(let i=0;i<30;i++)emitBurst(g,"writ",2,4,14);
 assert.equal(g.particles.length,115);
});
