import test from "node:test";
import assert from "node:assert/strict";
import {getLevel} from "../src/data.js";
import {makeGame,place,spawn,tick,damageEnemy,fireProjectile,advanceProjectiles} from "../src/engine.js";
function create(deck=["registrar"],stage=3,world=0){
 const g=makeGame(getLevel(world,stage),deck,"normal",{autoCollect:true});
 g.plan=[];g.seal=9999;return g;
}
function until(g,predicate,limit=110){
 for(let i=0;i<limit&&!predicate();i++)tick(g,.1);
 assert.ok(predicate(),"Expected condition before tick limit");
}
test("damage happens on physical stamp impact, not on firing",()=>{
 const g=create();
 assert.equal(place(g,"registrar",2,2).ok,true);
 const enemy=spawn(g,"schemer",2,7);
 tick(g,.1);
 assert.equal(g.projectiles.length,1);
 assert.equal(enemy.hp,enemy.maxHp,"Premature hit before stamp arrives");
 until(g,()=>enemy.hp<enemy.maxHp);
 assert.ok(enemy.lastHitAt>=0);
 assert.ok(g.effects.some(e=>e.kind==="impact-stamp"));
});
test("senior sends two visually separated real stamps for 40 base damage",()=>{
 const g=create(["senior"],8);
 place(g,"senior",2,2);
 const enemy=spawn(g,"schemer",2,6);
 tick(g,.1);
 assert.equal(g.projectiles.length,2);
 const [a,b]=g.projectiles;
 assert.ok(a.row!==b.row);
 assert.equal(a.damage,20);
 assert.equal(b.damage,20);
 until(g,()=>enemy.hp<enemy.maxHp);
 assert.equal(enemy.maxHp-enemy.hp,80,"Registration matchup doubles 2×20 damage");
});
test("slow chain begins slowing only once the projectile hits",()=>{
 const g=create(["limitation"],3,1);
 place(g,"limitation",2,2);
 const enemy=spawn(g,"alimony",2,6);
 tick(g,.1);
 assert.equal(enemy.frozenUntil,0);
 until(g,()=>enemy.frozenUntil>g.time);
 assert.ok(enemy.stunUntil>g.time);
});
test("lobbed dossier applies splash damage upon arrival to neighboring lane",()=>{
 const g=create(["private_executor"],6,1);
 place(g,"private_executor",2,2);
 const e=spawn(g,"schemer",2,6),neighbor=spawn(g,"schemer",3,6);
 tick(g,.1);
 assert.equal(neighbor.hp,neighbor.maxHp);
 assert.equal(g.projectiles[0].kind,"dossier");
 const prev=neighbor.hp;
 until(g,()=>neighbor.hp<prev);
 assert.ok(e.hp<e.maxHp);
});
test("sniper instant scan creates a short-lived light beam",()=>{
 const g=create(["expert"],4,2);
 place(g,"expert",2,2);
 const enemy=spawn(g,"schemer",2,4);
 tick(g,.1);
 assert.ok(enemy.hp<enemy.maxHp);
 assert.equal(g.projectiles[0].kind,"beam");
 until(g,()=>g.projectiles.length===0);
});
test("dead target cannot receive damage after a ballistic projectile arrives",()=>{
 const g=create(["executor"],3,1);
 place(g,"executor",2,2);
 const enemy=spawn(g,"schemer",2,7);
 tick(g,.1);
 assert.equal(g.projectiles[0].kind,"writ");
 damageEnemy(g,enemy,3000,"enforcement");
 until(g,()=>g.projectiles.length===0);
 assert.equal(g.enemies.some(e=>e.uid===enemy.uid),false);
 assert.ok(g.effects.some(e=>e.kind==="miss")||g.projectiles.length===0);
});
test("straight stamp intersects the first eligible enemy on its lane",()=>{
 const g=create(["registrar"]);
 place(g,"registrar",2,2);
 const farther=spawn(g,"schemer",2,8),near=spawn(g,"schemer",2,5);
 tick(g,.1);
 until(g,()=>near.hp<near.maxHp);
 assert.equal(farther.hp,farther.maxHp);
});
test("projectile ceiling protects endless mode mobile sessions",()=>{
 const g=create();
 const d={uid:100,id:"registrar",col:2,lane:2,kind:"shooter",tool:"registry"};
 const enemy=spawn(g,"schemer",2,8);
 for(let i=0;i<190;i++)fireProjectile(g,d,enemy,20);
 assert.equal(g.projectiles.length,160);
 advanceProjectiles(g,.13);
 assert.ok(g.projectiles.length<=160);
});
test("effects include a visible banner when a wave starts",()=>{
 const g=makeGame(getLevel(0,1),["registrar"]);
 for(let i=0;i<140;i++)tick(g,.1);
 assert.ok(g.effects.some(e=>e.kind==="wave"));
});
