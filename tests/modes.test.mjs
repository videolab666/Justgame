import test from 'node:test';
import assert from 'node:assert/strict';
import {getLevel} from '../src/data.js';
import {makeGame,makeWavePlan,queueEndlessWave,tick} from '../src/engine.js';

test('daily mission is deterministic for the same date seed',()=>{
 const lvl=getLevel(3,6);
 const settings={autoCollect:true};
 const a=makeGame(lvl,['registrar'],'normal',settings,{kind:'daily',seed:20261015});
 const b=makeGame(lvl,['registrar'],'normal',settings,{kind:'daily',seed:20261015});
 assert.deepEqual(a.plan,b.plan);
 assert.notDeepEqual(a.plan,makeWavePlan(lvl,20261016));
});
test('endless mission schedules increasingly dense waves with a safe per-wave cap',()=>{
 const lvl=getLevel(0,6);
 const g=makeGame(lvl,['registrar'],'normal',{}, {kind:'endless',seed:20261015});
 assert.equal(g.maxWave,1);
 assert.equal(g.plan.length,7);
 const second=queueEndlessWave(g,2);
 assert.equal(second,12);
 assert.equal(g.maxWave,2);
 const fifth=queueEndlessWave(g,5);
 assert.equal(fifth,34);
 assert.ok(g.plan.every(x=>x.lane>=0&&x.lane<=4));
 assert.ok(g.plan.every((x,i,arr)=>i===0||x.time>=arr[i-1].time));
});
test('endless mode does not declare victory when all scheduled attackers fall',()=>{
 const level=getLevel(0,6);
 const g=makeGame(level,['registrar'],'young',{autoCollect:true},{kind:'endless',seed:20261015});
 g.spawned=g.plan.length;g.enemies=[];g.time=g.plan[g.plan.length-1].time+4;g.stageWave=1;
 tick(g,.1);
 assert.equal(g.phase,'playing');
 assert.equal(g.maxWave,2);
});
test('career reward increases starting seals without affecting ordinary base balance',()=>{
 const level=getLevel(0,3);
 const a=makeGame(level,['registrar'],'normal',{});
 const b=makeGame(level,['registrar'],'normal',{careerBonus:25});
 assert.equal(b.seal-a.seal,25);
});
