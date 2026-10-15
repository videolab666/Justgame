import test from "node:test";
import assert from "node:assert/strict";
import {getLevel} from "../src/data.js";
import {makeGame,place,spawn,explainFiring} from "../src/engine.js";
function scenario(world,stage){
 const g=makeGame(getLevel(world,stage),["registrar"]);
 g.plan=[];g.seal=1000;place(g,"registrar",g.level.activeLanes[0],2);
 return {g,d:g.defenders[0]};
}
test("shooting tooltip explains fog, flying enemies, stealth, and direction",()=>{
 let {g,d}=scenario(0,6);
 const fog=spawn(g,"schemer",d.lane,8);fog.speed=0;
 assert.match(explainFiring(g,d),/Туман/);
 fog.x=5;
 assert.match(explainFiring(g,d),/Ціль є/);
 ({g,d}=scenario(0,4));
 spawn(g,"bankrupt",d.lane,7);
 assert.match(explainFiring(g,d),/повітряні/);
 g.enemies.length=0;
 const hidden=spawn(g,"broker",d.lane,6);hidden.reveal=false;
 assert.match(explainFiring(g,d),/Замаскована/);
 hidden.x=1;
 assert.match(explainFiring(g,d),/позаду/);
});
test("status explains temporary shutdown rather than silently losing shots",()=>{
 const {g,d}=scenario(0,4);
 spawn(g,"schemer",d.lane,5);
 d.disabledUntil=g.time+6;
 assert.match(explainFiring(g,d),/заблоковано/);
 d.disabledUntil=0;
 d.confusedUntil=g.time+3;
 assert.match(explainFiring(g,d),/дезорієнтовано/);
});
