import test from "node:test";
import assert from "node:assert/strict";
import {SONGS,STEPS,scoreAt,hz,END_NOTES,Soundtrack} from "../src/music.js";
test("four worlds get original, distinct songs in different styles",()=>{
 assert.equal(SONGS.length,4);
 assert.equal(new Set(SONGS.map(s=>s.melody.join(","))).size,4);
 assert.equal(new Set(SONGS.map(s=>s.bpm)).size,4);
 assert.equal(new Set(SONGS.map(s=>s.style)).size,4);
 for(let w=0;w<4;w++){
  assert.equal(SONGS[w].melody.length,STEPS);
  assert.equal(SONGS[w].chords.length,8);
  for(let step=0;step<STEPS;step++){
   for(const intensity of [0,.5,1]){
    assert.deepEqual(scoreAt(w,step,intensity),scoreAt(w,step+STEPS,intensity));
    for(const e of scoreAt(w,step,intensity)){
     assert.ok(e.vol>0&&e.vol<1,"volume");
     assert.ok(e.len>0,"length");
     assert.ok((e.offset||0)>=0&&(e.offset||0)<1,"offset within the step");
     if(e.note!==undefined)assert.ok(hz(e.note)>20&&hz(e.note)<4000,"audible pitch "+e.note);
    }
   }
  }
 }
});
test("intensity adds layers without rewriting the familiar melody",()=>{
 for(let w=0;w<4;w++)for(let step=0;step<STEPS;step++){
  const calm=scoreAt(w,step,0),mid=scoreAt(w,step,.6),peak=scoreAt(w,step,1);
  const lead=x=>x.filter(e=>e.instrument==="lead");
  assert.deepEqual(lead(calm),lead(peak));
  assert.ok(mid.length>=calm.length&&peak.length>=mid.length);
 }
 const count=(w,i,name)=>Array.from({length:STEPS},(_,s)=>scoreAt(w,s,i)).flat().filter(e=>e.instrument===name).length;
 assert.equal(count(0,0,"kick"),0,"calm opening has no kick drum");
 assert.ok(count(0,.5,"kick")>0);
 assert.equal(count(3,.3,"arp"),0);
 assert.ok(count(3,.8,"arp")>0,"busy waves add the arpeggio");
});
test("every song has bass, chords and a lead in each bar",()=>{
 for(let w=0;w<4;w++)for(let bar=0;bar<8;bar++){
  const ev=Array.from({length:8},(_,i)=>scoreAt(w,bar*8+i,.5)).flat();
  for(const name of ["bass","lead"])assert.ok(ev.some(e=>e.instrument===name),`world ${w} bar ${bar} ${name}`);
  assert.ok(ev.some(e=>["keys","stab","pad"].includes(e.instrument)),`world ${w} bar ${bar} chords`);
 }
});
test("soundtrack does not allocate AudioContext before user activation",()=>{
 let contextCreates=0;
 const player=new Soundtrack(()=>{contextCreates++;throw Error("Not supported in Node");});
 player.tick();player.setScene("battle",3);player.tick();
 assert.equal(contextCreates,0);
 player.configure(false,25);
 assert.equal(player.volume,.25);
 assert.equal(player.unlock(),false);
 assert.equal(contextCreates,0);
 player.quiet();player.configure(true,100);
 assert.equal(player.volume,1);
});
test("victory and defeat have distinct short stingers",()=>{
 assert.notDeepEqual(END_NOTES.won,END_NOTES.lost);
 assert.ok(END_NOTES.won.length>END_NOTES.lost.length);
});
