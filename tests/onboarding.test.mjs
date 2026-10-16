import test from "node:test";
import assert from "node:assert/strict";
import {getLevel} from "../src/data.js";
import {makeGame,tick,place,collectToken,tutorialEvent,tutorialText,collectReward,TUTORIAL_TEXT,TUTORIAL_START_SEALS} from "../src/engine.js";

const lane=getLevel(0,1).activeLanes[0];
function run(g,sec){for(let i=0;i<sec*10;i++)tick(g,.1);}

test("guided 1-1: no enemy appears until the player has done every step",()=>{
 const g=makeGame(getLevel(0,1),["registrar"],"normal",{tutorialFlow:true});
 assert.equal(g.seal,TUTORIAL_START_SEALS);
 assert.equal(tutorialText(g),TUTORIAL_TEXT.pick);
 run(g,60);
 assert.equal(g.enemies.length,0,"waves are held");
 tutorialEvent(g,"pick","registrar");
 assert.equal(tutorialText(g),TUTORIAL_TEXT.place);
 assert.equal(place(g,"registrar",lane,0).ok,true);
 assert.equal(g.tutorial.step,"collect");
 assert.equal(tutorialText(g),TUTORIAL_TEXT.praise);
 assert.ok(g.tokens.length>=1,"a seal falls right away");
 run(g,4);
 assert.equal(tutorialText(g),TUTORIAL_TEXT.collect);
 while(g.seal<100){collectToken(g,g.tokens[0]?.uid);run(g,1);}
 assert.equal(g.tutorial.step,"afford");
 assert.equal(tutorialText(g),TUTORIAL_TEXT.afford);
 run(g,30);
 assert.equal(g.enemies.length,0,"still held while the second defender is missing");
 assert.equal(tutorialText(g),TUTORIAL_TEXT.place2);
 g.cooldowns.registrar=0;
 assert.equal(place(g,"registrar",lane,1).ok,true);
 assert.equal(tutorialText(g),TUTORIAL_TEXT.go);
 run(g,10);
 assert.ok(g.stageWave>=1,"waves start after the second defender");
 run(g,5);
 assert.equal(tutorialText(g),"");
});

test("without the flag the battle runs exactly as before",()=>{
 const g=makeGame(getLevel(0,1),["registrar"]);
 assert.equal(g.tutorial,undefined);
 run(g,12);
 assert.ok(g.stageWave>=1);
});

test("the last defeated enemy drops the reward card; the level is won once it is taken",()=>{
 const g=makeGame(getLevel(0,2),["registrar"],"normal",{rewardCard:"notary"});
 g.plan=[{time:0,id:"schemer",lane:2,wave:1}];g.seal=1e4;g.nextSky=1e9;
 place(g,"registrar",2,0);place(g,"registrar",1,0);
 for(let i=0;i<900&&!g.rewardDrop;i++)tick(g,.1);
 assert.ok(g.rewardDrop,"card dropped");
 assert.equal(g.rewardDrop.id,"notary");
 assert.equal(g.rewardDrop.lane,2);
 run(g,3);
 assert.equal(g.phase,"playing","waits for the player");
 assert.equal(collectReward(g),true);
 tick(g,.1);
 assert.equal(g.phase,"won");
});

test("an untouched reward is taken automatically so nobody gets stuck",()=>{
 const g=makeGame(getLevel(0,2),["registrar"],"normal",{rewardCard:"notary"});
 g.plan=[{time:0,id:"schemer",lane:2,wave:1}];g.seal=1e4;g.nextSky=1e9;
 place(g,"registrar",2,0);
 for(let i=0;i<1200&&g.phase==="playing";i++)tick(g,.1);
 assert.equal(g.phase,"won");
});

test("the final wave has its own big banner",()=>{
 const g=makeGame(getLevel(0,3),["registrar"]);g.nextSky=1e9;
 const kinds=new Set();
 for(let i=0;i<3000&&g.spawned<g.plan.length;i++){tick(g,.1);for(const fx of g.effects)kinds.add(fx.kind);g.enemies=[];}
 assert.ok(kinds.has("final-wave"));
 assert.ok(kinds.has("wave"));
});
