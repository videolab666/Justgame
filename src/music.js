/* Original soundtrack for Юст-Оборона: not sampled or adapted from other games.
 * 32-step quirky swing/jazz loops, one composition for each world.
 * Oscillators only start after a user gesture (Web Audio autoplay rules).
 */
export const SONGS=[
 {name:"Дніпровський двір",bpm:112,voice:"triangle",bass:[38,41,43,33],melody:[74,0,77,76,0,74,72,0,69,72,74,0,72,0,69,72,77,0,79,77,74,72,74,0,76,74,72,0,69,72,74,0]},
 {name:"Заводський джаз",bpm:119,voice:"triangle",bass:[43,46,41,38],melody:[79,0,77,74,77,0,82,0,79,77,74,0,72,74,77,0,74,0,77,79,0,81,79,0,77,74,0,72,74,77,79,0]},
 {name:"Прозорі рішення",bpm:105,voice:"sine",bass:[36,39,41,43],melody:[72,0,75,0,79,77,75,0,70,72,0,75,77,0,75,72,79,0,82,79,0,77,75,0,77,75,72,0,70,72,75,0]},
 {name:"Цифрова ніч",bpm:124,voice:"square",bass:[42,38,45,40],melody:[78,0,81,85,0,83,81,0,78,76,0,74,76,78,81,0,85,0,83,81,78,0,81,83,85,88,85,0,83,81,78,0]}
];
export const hz=m=>440*2**((m-69)/12);
export function scoreAt(world,n,intensity=0){
 const song=SONGS[world]||SONGS[0],step=((n%32)+32)%32,bar=step>>3;
 const events=[],note=song.melody[step];
 if(note)events.push({note,instrument:"lead",vol:.23,len:.79});
 if(step%4===0)events.push({note:song.bass[bar],instrument:"bass",vol:.22,len:1.9});
 if(step%8===0)for(const delta of [0,3,7,10])
  events.push({note:song.bass[bar]+12+delta,instrument:"pad",vol:.045,len:5});
 if(step%8===3||step%8===6)
  events.push({note:song.bass[bar]+24+(step%8===3?7:3),instrument:"pluck",vol:.11,len:.6});
 if(step%2===0)events.push({instrument:"kick",vol:.17+(intensity>.6?.05:0),len:.19});
 if(step%4===2)events.push({instrument:"snare",vol:.10,len:.13});
 if(step%2===1||(intensity>.5&&step%2===0))events.push({instrument:"hat",vol:.06,len:.07});
 return events;
}
export const END_NOTES={
 won:[74,77,81,86,81,86],
 lost:[65,64,60,57]
};
export class Soundtrack{
 constructor(factory=()=>new (window.AudioContext||window.webkitAudioContext)()){
  this.factory=factory;this.ctx=null;this.bus=null;this.noise=null;
  this.enabled=true;this.volume=.4;this.active=false;this.scene="silent";
  this.world=0;this.intensity=0;this.next=0;this.step=0;
 }
 configure(music=true,musicVolume=40){
  this.enabled=!!music;this.volume=Math.max(0,Math.min(100,Number(musicVolume)||0))/100;
  if(this.bus)this.bus.gain.setTargetAtTime(this.enabled?this.volume*.42:0,this.ctx.currentTime,.06);
  if(!this.enabled)this.active=false;
 }
 unlock(){
  if(!this.enabled)return false;
  try{
   if(!this.ctx){this.ctx=this.factory();this.bus=this.ctx.createGain();
    this.bus.gain.value=0;this.bus.connect(this.ctx.destination);}
   if(this.ctx.state==="suspended")this.ctx.resume()?.catch?.(()=>{});
   if(!this.active){this.active=true;this.next=this.ctx.currentTime+.05;}
   this.bus.gain.setTargetAtTime(this.volume*.42,this.ctx.currentTime,.1);
   return true;
  }catch{return false;}
 }
 setScene(scene,world=this.world,intensity=0){
  const w=Math.max(0,Math.min(3,world|0));
  if(scene!==this.scene||w!==this.world){this.scene=scene;this.world=w;this.step=0;this.next=(this.ctx?.currentTime||0)+.06;}
  this.intensity=intensity;
 }
 tick(){
  const c=this.ctx;
  if(!this.enabled||!this.active||!c||c.state!=="running"||this.scene!=="battle")return;
  const halfbeat=30/SONGS[this.world].bpm;
  if(this.next<c.currentTime-.2)this.next=c.currentTime+.05;
  for(let i=0;this.next<c.currentTime+.18&&i<3;i++){
   for(const ev of scoreAt(this.world,this.step,this.intensity))this.play(ev,this.next,halfbeat);
   this.step=(this.step+1)%32;this.next+=halfbeat;
  }
 }
 jingle(win){
  if(!this.active||!this.ctx||!this.enabled)return;
  this.scene="outro";
  const notes=END_NOTES[win?"won":"lost"],start=this.ctx.currentTime+.07;
  notes.forEach((note,i)=>this.play({instrument:"lead",note,vol:.39,len:i===notes.length-1?2:.85},start+i*(win?.19:.29),.3));
 }
 quiet(){
  this.active=false;
  if(this.bus)this.bus.gain.setTargetAtTime(0,this.ctx.currentTime,.06);
 }
 noiseBuffer(){
  if(this.noise)return this.noise;
  const ctx=this.ctx,buf=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*.15),ctx.sampleRate),array=buf.getChannelData(0);
  let seed=7828;for(let i=0;i<array.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;array[i]=seed/2147483648-1;}
  return this.noise=buf;
 }
 play(ev,t,unit){
  const ctx=this.ctx,len=Math.max(.04,ev.len*unit),vol=ev.vol;
  const gain=ctx.createGain();gain.gain.setValueAtTime(.0001,t);
  gain.connect(this.bus);
  if(ev.instrument==="hat"||ev.instrument==="snare"){
   const src=ctx.createBufferSource(),filter=ctx.createBiquadFilter();
   src.buffer=this.noiseBuffer();filter.type="highpass";
   filter.frequency.value=ev.instrument==="hat"?6600:1100;
   src.connect(filter).connect(gain);
   gain.gain.exponentialRampToValueAtTime(vol*.5,t+.004);
   gain.gain.exponentialRampToValueAtTime(.0001,t+Math.min(.12,len));
   src.start(t);src.stop(t+Math.min(.13,len)+.005);
   src.onended=()=>{src.disconnect();filter.disconnect();gain.disconnect();};
   return;
  }
  const osc=ctx.createOscillator();
  osc.type=ev.instrument==="bass"?"triangle":ev.instrument==="lead"?SONGS[this.world].voice:"sine";
  const note=ev.note||38;osc.frequency.setValueAtTime(hz(note),t);
  if(ev.instrument==="kick"){osc.type="sine";osc.frequency.setValueAtTime(120,t);osc.frequency.exponentialRampToValueAtTime(48,t+.12);}
  osc.connect(gain);
  const attack=ev.instrument==="pad"?.07:.007;
  gain.gain.exponentialRampToValueAtTime(Math.max(.0002,vol),t+attack);
  gain.gain.exponentialRampToValueAtTime(.0001,t+len);
  osc.start(t);osc.stop(t+len+.02);
  osc.onended=()=>{osc.disconnect();gain.disconnect();};
 }
}
