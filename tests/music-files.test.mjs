import test from "node:test";
import assert from "node:assert/strict";
import {existsSync} from "node:fs";
import {MusicPlayer,TRACKS,trackFor} from "../src/music-files.js";

class FakeAudio{constructor(){this.paused=true;this.volume=1;this.src="";this.plays=0;}
 play(){this.paused=false;this.plays++;return Promise.resolve();}pause(){this.paused=true;}getAttribute(){return this.src;}}

test("every track file exists",()=>{
 for(const src of [TRACKS.menu,TRACKS.boss,...TRACKS.battle])
  assert.ok(existsSync(new URL("../"+src.replace("./",""),import.meta.url)),src);
});
test("scenes map to menu, per-world battle, boss and silence",()=>{
 assert.equal(trackFor("menu"),TRACKS.menu);
 assert.equal(trackFor("battle",2),TRACKS.battle[2]);
 assert.equal(trackFor("battle",0,true),TRACKS.boss);
 assert.equal(trackFor("pause",1),TRACKS.battle[1]);
 assert.equal(trackFor("outro"),null);
 assert.equal(trackFor("silent"),null);
});
test("nothing plays before a user gesture; then it fades in and cross-fades",()=>{
 const els=[];const m=new MusicPlayer(()=>{const a=new FakeAudio();els.push(a);return a;});
 m.configure(true,50);
 m.setScene("menu");
 assert.equal(els[0].plays,0,"no autoplay");
 m.unlock();
 assert.equal(els[0].plays,1);
 let t=0;for(let i=0;i<60;i++)m.tick(t+=33);
 assert.ok(Math.abs(els[0].volume-.5)<1e-6,"menu at full slider volume");
 m.setScene("battle",1);
 assert.equal(els[1].src,TRACKS.battle[1]);
 for(let i=0;i<60;i++)m.tick(t+=33);
 assert.ok(els[0].volume<1e-6&&els[0].paused,"menu faded out and paused");
 assert.ok(els[1].volume>.49);
 m.setScene("pause",1);
 for(let i=0;i<60;i++)m.tick(t+=33);
 assert.ok(els[1].volume<.25&&els[1].volume>0,"paused battle is ducked, not stopped");
 m.configure(false,50);
 for(let i=0;i<60;i++)m.tick(t+=33);
 assert.ok(els.every(e=>e.volume<1e-6),"music off silences everything");
});
