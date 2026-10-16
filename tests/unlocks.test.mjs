import test from "node:test";
import assert from "node:assert/strict";
import {getLevel,unlockedUnits,UNITS} from "../src/data.js";

// Walk the campaign in order and record which cards are new before each level.
function campaign(){
 const completed={},rows=[];
 let seenAtLastBattle=new Set(unlockedUnits({}).map(u=>u.id));
 for(let w=0;w<4;w++)for(let s=1;s<=10;s++){
  const level=getLevel(w,s),now=new Set(unlockedUnits(completed).map(u=>u.id));
  const fresh=[...now].filter(id=>!seenAtLastBattle.has(id));
  rows.push({id:level.id,mini:!!level.mini,fresh});
  if(!level.mini)seenAtLastBattle=now;
  completed[level.id]=3;
 }
 return rows;
}
test("at most one new card before each main battle",()=>{
 for(const row of campaign())if(!row.mini)assert.ok(row.fresh.length<=1,row.id+": "+row.fresh.join(", "));
});
test("every card is unlocked exactly once over the campaign",()=>{
 const completed={},got=[];let prev=new Set(unlockedUnits({}).map(u=>u.id));
 for(const row of campaign()){
  completed[row.id]=3;
  const now=new Set(unlockedUnits(completed).map(u=>u.id));
  const gained=[...now].filter(id=>!prev.has(id));
  assert.ok(gained.length<=1,row.id+" gives "+gained.join(", "));
  got.push(...gained);prev=now;
 }
 assert.equal(prev.size,UNITS.length,"everything is unlocked by the end");
 assert.equal(new Set(got).size,got.length,"no card is given twice");
});
test("the disguised broker in 1-4 already has its counter",()=>{
 const before14=unlockedUnits({"1-1":3,"1-2":3,"1-3":3}).map(u=>u.id);
 assert.ok(before14.includes("notification"));
 assert.ok(!before14.includes("mine"),"the mine is the reward of 1-4");
});
