import test from "node:test";
import assert from "node:assert/strict";
import {getLevel,UNIT_BY_ID} from "../src/data.js";
import {makeGame,place,spawn,tick} from "../src/engine.js";
const newGame=(ids,world=0)=>{
 const g=makeGame(getLevel(world,6),ids,"normal",{autoCollect:true});
 g.plan=[];g.seal=2000;return g;
};
test("regression: registrar stamp hits target pressed against defender at x col+.50",()=>{
 const g=newGame(["registrar"]);
 assert.ok(place(g,"registrar",2,2).ok);
 const enemy=spawn(g,"schemer",2,2.52);enemy.speed=0;
 let hit=false;
 for(let i=0;i<30;i++){tick(g,.08);if(enemy.hp<enemy.maxHp){hit=true;break;}}
 assert.equal(hit,true,"Projectile may not start in front of close target");
 assert.ok(g.defenders[0].shotsFired>=1);
});
test("every ranged attacker actually fires and hits a legal stationary target",()=>{
 const units=["registrar","senior","intern","executor","limitation","trustee","private_executor","expert","apostille"];
 for(const id of units){
  const g=newGame([id]);
  const u=UNIT_BY_ID[id];
  assert.equal(place(g,id,2,2).ok,true,id);
  const enemy=spawn(g,"schemer",2,5.8);
  enemy.speed=0;enemy.hp=1000;enemy.maxHp=1000;
  let hit=false;
  for(let i=0;i<95;i++){
   tick(g,.09);
   if(enemy.hp<enemy.maxHp){hit=true;break;}
  }
  assert.ok(hit,"Expected projectile hit from "+id+" ("+u.kind+")");
  assert.ok(g.defenders[0].shotsFired>=1,"Expected shot from "+id);
 }
});
test("projectile starts behind target rather than beyond its hitbox",()=>{
 const g=newGame(["registrar"]);place(g,"registrar",2,2);
 const e=spawn(g,"schemer",2,2.6);e.speed=0;
 tick(g,.08);
 assert.equal(g.projectiles.length,1);
 assert.ok(g.projectiles[0].startX<e.x);
});
test("no spurious shooting at targets in another lane or behind attacker",()=>{
 const g=newGame(["registrar"]);place(g,"registrar",2,4);
 const behind=spawn(g,"schemer",2,3.9),other=spawn(g,"schemer",1,7);
 behind.speed=0;other.speed=0;
 for(let i=0;i<60;i++)tick(g,.1);
 assert.equal(g.defenders[0].shotsFired||0,0);
 assert.equal(behind.hp,behind.maxHp);
 assert.equal(other.hp,other.maxHp);
});
test("disguised, flying or underground threats obey existing targeting rules",()=>{
 const g=newGame(["registrar"]);place(g,"registrar",2,2);
 const fly=spawn(g,"bankrupt",2,5),burrow=spawn(g,"burrower",2,6);
 fly.speed=0;burrow.speed=0;
 for(let i=0;i<45;i++)tick(g,.1);
 assert.equal(g.defenders[0].shotsFired||0,0);
});
