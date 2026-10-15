import test from "node:test";
import assert from "node:assert/strict";
import {SONGS,scoreAt,hz,END_NOTES,Soundtrack} from "../src/music.js";
test("four worlds get original, distinct melodies and rhythmic programs",()=>{
 assert.equal(SONGS.length,4);
 assert.equal(new Set(SONGS.map(s=>s.melody.join(","))).size,4);
 assert.equal(new Set(SONGS.map(s=>s.bpm)).size,4);
 for(let w=0;w<4;w++){
  assert.equal(SONGS[w].melody.length,32);
  assert.equal(SONGS[w].bass.length,4);
  for(let step=0;step<32;step++){
   assert.deepEqual(scoreAt(w,step),scoreAt(w,step+32));
   for(const e of scoreAt(w,step)){
    assert.ok(e.vol>0&&e.vol<1);
    if(e.note!==undefined)assert.ok(hz(e.note)>20&&hz(e.note)<4000);
   }
  }
 }
});
test("intensity adds percussion without rewriting a familiar melody",()=>{
 const a=scoreAt(2,0,.2),b=scoreAt(2,0,.9);
 assert.deepEqual(a.filter(x=>x.instrument==="lead"),b.filter(x=>x.instrument==="lead"));
 assert.ok(b.length>=a.length);
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
