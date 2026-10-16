
import test from "node:test";
import assert from "node:assert/strict";
import {getLevel} from "../src/data.js";
import {makeGame,place,spawn,tick,explainFiring,fireProjectile} from "../src/engine.js";

function setup(unit="registrar",stage=4){
 const game=makeGame(getLevel(0,stage),[unit]);
 game.plan=[];game.seal=3000;
 assert.equal(place(game,unit,2,3).ok,true);
 return game;
}
test("registrar shoots point-blank attackers that stand in front of its center",()=>{
 for(const x of [3.03,3.11,3.24,3.38,3.48,3.8]){
  const g=setup(),e=spawn(g,"schemer",2,x);e.speed=0;
  e.hp=e.maxHp=900;
  let hit=false;
  for(let k=0;k<45;k++){tick(g,.08);if(e.hp<900){hit=true;break;}}
  assert.equal(hit,true,"registrar should hit schemer at x="+x);
  assert.ok(g.defenders[0].shotsFired>0,"shot count at x="+x);
 }
});
test("all straight-line attackers handle near contact without vanishing shots",()=>{
 for(const id of ["registrar","senior","intern","limitation","trustee"]){
  const g=setup(id);const e=spawn(g,"schemer",2,3.10);e.speed=0;
  e.hp=e.maxHp=1800;
  for(let k=0;k<65;k++){tick(g,.08);if(e.hp<1800)break;}
  assert.ok(e.hp<1800,id+" did not deal contact damage");
 }
});
test("close-range shooting leaves enemies genuinely behind the defender untargeted",()=>{
 const g=setup(),e=spawn(g,"schemer",2,2.98);e.speed=0;
 for(let k=0;k<8;k++)tick(g,.08); // Enemy contact deals damage; check before it destroys the defender.
 assert.equal(e.hp,e.maxHp);
 assert.equal(g.defenders[0].shotsFired||0,0);
 assert.match(explainFiring(g,g.defenders[0]),/позаду/);
});
test("projectile never originates to the right of its assigned enemy",()=>{
 const g=setup(),e=spawn(g,"schemer",2,3.10);e.speed=0;
 const shot=fireProjectile(g,g.defenders[0],e,20);
 assert.ok(shot.startX<e.x);
 assert.ok(shot.startX<=3.4);
});
test("fog, air, underground, disguise and disable are gameplay restrictions",()=>{
 const g=setup("registrar",6);
 const foe=spawn(g,"schemer",2,8.5);foe.speed=0;
 for(let k=0;k<20;k++)tick(g,.08);
 assert.equal(g.defenders[0].shotsFired||0,0);
 assert.match(explainFiring(g,g.defenders[0]),/Туман/);
 foe.x=5;
 for(let k=0;k<20;k++){tick(g,.08);if(foe.hp<foe.maxHp)break;}
 assert.ok(foe.hp<foe.maxHp);
});
