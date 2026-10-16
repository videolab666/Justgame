/* Original soundtrack for Юст-Оборона: composed for this game, not sampled
 * or adapted from other games. Fully synthesised with Web Audio (no files).
 *
 * Each world has its own style, 8-bar form (64 eighth-note steps), chord
 * progression, bass line, drum groove and lead melody:
 *   1 Дніпро        — swing (walking bass, brushes, clarinet lead)
 *   2 Запоріжжя     — funk (syncopated bass, brass stabs)
 *   3 Кропивницький — bossa nova (rim clicks, vibraphone)
 *   4 Цифровий фронт — synthwave (four-on-the-floor, 16th arpeggio)
 * Intensity (wave progress 0..1) adds layers: drums, then arpeggio, open
 * hats and fills. The lead melody never changes with intensity.
 * Oscillators only start after a user gesture (Web Audio autoplay rules).
 */
export const STEPS=64;
const Q={m7:[0,3,7,10],dom7:[0,4,7,10],maj7:[0,4,7,11],min:[0,3,7,12],maj:[0,4,7,12]};
// Melodies: one MIDI note per eighth step, 0 = rest (previous note rings on).
export const SONGS=[
 {name:"Набережний свінг",style:"swing",bpm:112,swing:.34,lead:"clarinet",
  chords:[[43,"m7"],[36,"dom7"],[41,"maj7"],[38,"m7"],[46,"maj7"],[45,"m7"],[43,"m7"],[36,"dom7"]],
  melody:[70,0,74,0,77,76,74,0, 72,0,70,0,67,0,64,0, 65,69,72,76,0,74,72,0, 74,0,0,72,69,0,65,0,
          70,0,74,77,81,0,79,77, 76,0,72,0,69,72,76,0, 79,0,77,74,70,0,72,74, 76,0,72,0,67,0,0,0]},
 {name:"Заводський фанк",style:"funk",bpm:104,swing:.08,lead:"brass",
  chords:[[40,"m7"],[45,"dom7"],[40,"m7"],[45,"dom7"],[48,"maj7"],[47,"dom7"],[40,"m7"],[47,"dom7"]],
  melody:[76,0,76,74,0,71,0,74, 0,76,0,79,78,76,0,0, 76,0,76,74,0,71,0,67, 69,0,71,0,74,0,73,0,
          72,0,0,76,79,0,76,72, 75,0,78,0,81,0,78,75, 76,79,0,76,74,0,71,0, 75,0,0,71,0,66,0,0]},
 {name:"Прозорі рішення",style:"bossa",bpm:96,swing:0,lead:"vibes",
  chords:[[48,"maj7"],[45,"m7"],[50,"m7"],[43,"dom7"],[40,"m7"],[45,"dom7"],[50,"m7"],[43,"dom7"]],
  melody:[76,0,0,79,0,76,74,0, 72,0,0,0,76,0,74,72, 74,0,77,0,81,0,77,0, 79,0,0,77,74,0,71,0,
          79,0,0,83,0,79,76,0, 73,0,76,0,79,0,81,79, 77,0,74,0,81,0,77,74, 71,0,74,0,77,0,79,0]},
 {name:"Цифрова ніч",style:"synthwave",bpm:124,swing:0,lead:"synth",
  chords:[[45,"min"],[41,"maj"],[48,"maj"],[43,"maj"],[45,"min"],[41,"maj"],[43,"maj"],[40,"maj"]],
  melody:[81,0,0,79,76,0,0,0, 77,0,76,0,72,0,0,0, 76,0,79,0,84,0,83,79, 79,0,0,0,74,0,71,0,
          81,0,84,0,83,0,81,79, 77,0,81,0,84,0,81,77, 79,0,83,0,86,0,83,79, 80,0,0,76,0,71,0,68]}
];
export const hz=m=>440*2**((m-69)/12);
const chordAt=(song,step)=>song.chords[Math.floor(step/8)%8];
const toneSet=(root,q)=>Q[q].map(i=>root+i);
/** Length (in steps) a melody note rings until the next note, capped. */
function leadLength(song,step){
 let n=1;while(n<4&&!song.melody[(step+n)%STEPS])n++;
 return n*.92;
}
// Drum grooves per 8-step bar: k=kick s=snare r=rim h=hat o=open hat.
const GROOVES={
 swing:    {k:"x...x...",s:"..x...x.",h:"x.xxx.xx",o:"........"},
 funk:     {k:"x..x..x.",s:"..x...x.",h:"xxxxxxxx",o:".......x"},
 bossa:    {k:"x..xx..x",r:"..x..x..",h:"xxxxxxxx",o:"........"},
 synthwave:{k:"x.x.x.x.",s:"..x...x.",h:".x.x.x.x",o:"...x...x"}
};
const hit=(pattern,i)=>pattern&&pattern[i]==="x";
/** Deterministic score for one eighth step. Events: {instrument, note?,
 * vol, len (in steps), offset (fraction of a step, for 16ths and swing)}. */
export function scoreAt(world,n,intensity=0){
 const song=SONGS[world]||SONGS[0],step=((n%STEPS)+STEPS)%STEPS,beat=step%8;
 const [root,q]=chordAt(song,step),next=chordAt(song,step+8)[0],tones=toneSet(root,q);
 const events=[],groove=GROOVES[song.style];
 const drums=intensity>=.2,busy=intensity>=.55,peak=intensity>=.85;
 const note=song.melody[step];
 if(note)events.push({instrument:"lead",note,vol:.2,len:leadLength(song,step)});
 // Chords (comping style differs per world).
 if(song.style==="swing"&&(beat===0||beat===3||beat===6))
  for(const t of tones)events.push({instrument:"keys",note:t+12,vol:.035,len:beat===3?.8:1.6});
 if(song.style==="funk"&&(beat===1||beat===4||beat===7))
  for(const t of tones)events.push({instrument:"stab",note:t+12,vol:.04,len:.45});
 if(song.style==="bossa"&&(beat===0||beat===3||beat===5))
  for(const t of tones)events.push({instrument:"keys",note:t+12,vol:.03,len:1.4});
 if(song.style==="synthwave"&&beat===0)
  for(const t of tones)events.push({instrument:"pad",note:t+12,vol:.028,len:8});
 // Bass line.
 if(song.style==="swing"&&beat%2===0){
  const walk=[root,root+7,root+12-(q==="dom7"?2:0),next+(next>root?-1:1)][beat/2];
  events.push({instrument:"bass",note:walk,vol:.2,len:1.8});
 }
 if(song.style==="funk"){
  const line={0:root,3:root+12,4:root,6:root+10,7:root+7};
  if(line[beat]!==undefined)events.push({instrument:"bass",note:line[beat],vol:.21,len:beat===0?1.4:.7});
 }
 if(song.style==="bossa"&&(beat===0||beat===3||beat===4||beat===7))
  events.push({instrument:"bass",note:beat===3||beat===7?root+7:root,vol:.19,len:beat%4===0?2.6:.9});
 if(song.style==="synthwave")
  events.push({instrument:"bass",note:root-12+(beat%2?12:0),vol:.17,len:.85});
 // Drums (enter once the wave gets going).
 if(drums){
  if(hit(groove.k,beat))events.push({instrument:"kick",vol:.2,len:.4});
  if(hit(groove.s,beat))events.push({instrument:"snare",vol:.12,len:.3});
  if(hit(groove.r,beat))events.push({instrument:"rim",vol:.1,len:.15});
 }
 if(hit(groove.h,beat))events.push({instrument:"hat",vol:drums?.055:.035,len:.12});
 if(busy&&hit(groove.o,beat))events.push({instrument:"openhat",vol:.05,len:.6});
 if(peak&&song.style!=="swing")events.push({instrument:"hat",vol:.035,len:.08,offset:.5});
 // Busy waves: sixteenth-note arpeggio over the chord (synth / vibes colour).
 if(busy){
  const arp=[...tones,tones[1]+12];
  for(const half of [0,.5])
   events.push({instrument:"arp",note:arp[(step*2+half*2)%arp.length]+24,vol:.045,len:.42,offset:half});
 }
 // Peak: snare fill on the last bar of the form.
 if(peak&&drums&&step>=60)events.push({instrument:"snare",vol:.08,len:.2,offset:.5});
 return events;
}
export const END_NOTES={
 won:[74,77,81,86,81,86],
 lost:[65,64,60,57]
};
const LEADS={
 clarinet:{type:"square",filter:1900,vibrato:4.5,attack:.025},
 brass:{type:"sawtooth",filter:2400,vibrato:0,attack:.02,bend:true},
 vibes:{type:"sine",filter:5000,attack:.004,bell:true},
 synth:{type:"sawtooth",filter:3200,vibrato:5.5,attack:.01,detune:9}
};
export class Soundtrack{
 constructor(factory=()=>new (window.AudioContext||window.webkitAudioContext)()){
  this.factory=factory;this.ctx=null;this.bus=null;this.noise=null;this.fx=null;
  this.enabled=true;this.volume=.4;this.active=false;this.scene="silent";
  this.world=0;this.intensity=0;this.next=0;this.step=0;
 }
 configure(music=true,musicVolume=40){
  this.enabled=!!music;this.volume=Math.max(0,Math.min(100,Number(musicVolume)||0))/100;
  if(this.bus)this.bus.gain.setTargetAtTime(this.enabled?this.volume*.5:0,this.ctx.currentTime,.06);
  if(!this.enabled)this.active=false;
 }
 unlock(){
  if(!this.enabled)return false;
  try{
   if(!this.ctx){this.ctx=this.factory();this.build();}
   if(this.ctx.state==="suspended")this.ctx.resume()?.catch?.(()=>{});
   if(!this.active){this.active=true;this.next=this.ctx.currentTime+.05;}
   this.bus.gain.setTargetAtTime(this.volume*.5,this.ctx.currentTime,.1);
   return true;
  }catch{return false;}
 }
 /** Master bus -> compressor -> speakers, plus echo and room sends. */
 build(){
  const c=this.ctx;
  this.bus=c.createGain();this.bus.gain.value=0;
  const comp=c.createDynamicsCompressor();
  comp.threshold.value=-18;comp.ratio.value=3.5;comp.attack.value=.01;comp.release.value=.2;
  this.bus.connect(comp).connect(c.destination);
  // Tempo-free slap echo for leads.
  const echo=c.createDelay(1),fb=c.createGain(),tone=c.createBiquadFilter(),echoSend=c.createGain();
  echo.delayTime.value=.27;fb.gain.value=.28;tone.type="lowpass";tone.frequency.value=2600;echoSend.gain.value=.22;
  echoSend.connect(echo);echo.connect(tone).connect(fb).connect(echo);tone.connect(this.bus);
  // Small generated room (noise impulse), shared by everything.
  const room=c.createConvolver(),roomSend=c.createGain();roomSend.gain.value=.16;
  const len=Math.floor(c.sampleRate*1.4),ir=c.createBuffer(2,len,c.sampleRate);
  let seed=1337;
  for(let ch=0;ch<2;ch++){const d=ir.getChannelData(ch);
   for(let i=0;i<len;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;d[i]=(seed/2147483648-1)*Math.pow(1-i/len,2.6);}}
  room.buffer=ir;roomSend.connect(room).connect(this.bus);
  this.fx={echoSend,roomSend};
 }
 setScene(scene,world=this.world,intensity=0){
  const w=Math.max(0,Math.min(3,world|0));
  if(scene!==this.scene||w!==this.world){this.scene=scene;this.world=w;this.step=0;this.next=(this.ctx?.currentTime||0)+.06;
   if(this.bus)this.bus.gain.setTargetAtTime(scene==="silent"?0:this.enabled?this.volume*.5:0,this.ctx.currentTime,.07);}
  this.intensity=intensity;
 }
 tick(){
  const c=this.ctx;
  if(!this.enabled||!this.active||!c||c.state!=="running"||this.scene!=="battle")return;
  const song=SONGS[this.world],unit=30/song.bpm;
  if(this.next<c.currentTime-.2)this.next=c.currentTime+.05;
  for(let i=0;this.next<c.currentTime+.2&&i<4;i++){
   // Swing delays every off-beat eighth.
   const swing=this.step%2?song.swing*unit:0;
   for(const ev of scoreAt(this.world,this.step,this.intensity))
    this.play(ev,this.next+swing+(ev.offset||0)*unit,unit);
   this.step=(this.step+1)%STEPS;this.next+=unit;
  }
 }
 jingle(win){
  if(!this.active||!this.ctx||!this.enabled)return;
  this.scene="outro";
  const notes=END_NOTES[win?"won":"lost"],start=this.ctx.currentTime+.07;
  notes.forEach((note,i)=>this.play({instrument:win?"lead":"keys",note,vol:win?.3:.09,len:i===notes.length-1?5:2},start+i*(win?.19:.29),.3));
  if(win)for(const t of [62,66,69,74])this.play({instrument:"pad",note:t,vol:.04,len:9},start+notes.length*.19,.3);
 }
 quiet(){
  this.active=false;
  if(this.bus)this.bus.gain.setTargetAtTime(0,this.ctx.currentTime,.06);
 }
 noiseBuffer(){
  if(this.noise)return this.noise;
  const ctx=this.ctx,buf=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*.6),ctx.sampleRate),array=buf.getChannelData(0);
  let seed=7828;for(let i=0;i<array.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;array[i]=seed/2147483648-1;}
  return this.noise=buf;
 }
 out(gain,echo=0,room=0){
  gain.connect(this.bus);
  if(echo&&this.fx)gain.connect(this.fx.echoSend);
  if(room&&this.fx)gain.connect(this.fx.roomSend);
 }
 env(gain,t,peak,attack,len){
  gain.gain.setValueAtTime(.0001,t);
  gain.gain.exponentialRampToValueAtTime(Math.max(.0002,peak),t+attack);
  gain.gain.exponentialRampToValueAtTime(.0001,t+Math.max(attack+.02,len));
 }
 noiseHit(t,vol,len,type,freq,q=.7){
  const ctx=this.ctx,src=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();
  src.buffer=this.noiseBuffer();filter.type=type;filter.frequency.value=freq;filter.Q.value=q;
  src.connect(filter).connect(gain);this.out(gain,0,1);this.env(gain,t,vol,.003,len);
  src.start(t);src.stop(t+len+.02);
  src.onended=()=>{src.disconnect();filter.disconnect();gain.disconnect();};
 }
 tone(t,{type="sine",freq,vol,attack=.006,len,filter=0,q=.8,detune=0,vibrato=0,echo=0,room=0,bendFrom=0}){
  const ctx=this.ctx,gain=ctx.createGain(),nodes=[gain];
  let dest=gain;
  if(filter){const f=ctx.createBiquadFilter();f.type="lowpass";f.Q.value=q;
   f.frequency.setValueAtTime(filter*1.6,t);f.frequency.exponentialRampToValueAtTime(Math.max(200,filter*.7),t+len);
   f.connect(gain);dest=f;nodes.push(f);}
  const voices=detune?[-detune,detune]:[0];
  for(const cents of voices){
   const o=ctx.createOscillator();o.type=type;o.detune.value=cents;
   if(bendFrom){o.frequency.setValueAtTime(freq*bendFrom,t);o.frequency.exponentialRampToValueAtTime(freq,t+.06);}
   else o.frequency.setValueAtTime(freq,t);
   if(vibrato){const lfo=ctx.createOscillator(),depth=ctx.createGain();lfo.frequency.value=vibrato;depth.gain.setValueAtTime(0,t);
    depth.gain.linearRampToValueAtTime(freq*.006,t+Math.min(.25,len));lfo.connect(depth).connect(o.frequency);
    lfo.start(t);lfo.stop(t+len+.05);nodes.push(lfo,depth);}
   o.connect(dest);o.start(t);o.stop(t+len+.05);nodes.push(o);
   o.onended=()=>{for(const n of nodes)n.disconnect();};
  }
  this.out(gain,echo,room);
  this.env(gain,t,vol/voices.length**.5,attack,len);
 }
 play(ev,t,unit){
  const len=Math.max(.04,ev.len*unit),vol=ev.vol,freq=hz(ev.note||38);
  switch(ev.instrument){
   case "kick":{
    const ctx=this.ctx,o=ctx.createOscillator(),g=ctx.createGain();
    o.frequency.setValueAtTime(150,t);o.frequency.exponentialRampToValueAtTime(42,t+.13);
    o.connect(g);this.out(g);this.env(g,t,vol,.002,.3);o.start(t);o.stop(t+.32);
    o.onended=()=>{o.disconnect();g.disconnect();};return;}
   case "snare":this.noiseHit(t,vol,.18,"bandpass",1800,.6);this.tone(t,{type:"triangle",freq:185,vol:vol*.6,len:.08});return;
   case "rim":this.tone(t,{type:"square",freq:1650,vol:vol*.5,len:.03,filter:2600});this.noiseHit(t,vol*.5,.03,"highpass",4000);return;
   case "hat":this.noiseHit(t,vol,Math.min(.06,len),"highpass",7800);return;
   case "openhat":this.noiseHit(t,vol,Math.min(.35,len),"highpass",6800);return;
   case "bass":
    this.tone(t,{type:this.world===3?"sawtooth":"triangle",freq,vol,len,filter:this.world===1?900:650,q:this.world===1?6:1,attack:.008});
    if(this.world===1)this.tone(t,{type:"sine",freq,vol:vol*.6,len});return;
   case "keys":
    this.tone(t,{type:"triangle",freq,vol,len,attack:.005,room:1});
    this.tone(t,{type:"sine",freq:freq*2,vol:vol*.35,len:len*.5,attack:.003});return;
   case "stab":this.tone(t,{type:"sawtooth",freq,vol,len,filter:1800,attack:.01,detune:6,room:1});return;
   case "pad":this.tone(t,{type:"sawtooth",freq,vol,len,filter:1100,attack:Math.min(.5,len*.3),detune:12,room:1});return;
   case "arp":this.tone(t,{type:this.world===2?"sine":"square",freq,vol,len,filter:this.world===2?0:2600,attack:.003,echo:1});return;
   default:{ // lead
    const v=LEADS[SONGS[this.world].lead];
    this.tone(t,{type:v.type,freq,vol,len,filter:v.filter,attack:v.attack,vibrato:v.vibrato,detune:v.detune||0,
     echo:1,room:1,bendFrom:v.bend?.94:0});
    if(v.bell)this.tone(t,{type:"sine",freq:freq*4,vol:vol*.18,len:len*.35,attack:.002});
   }
  }
 }
}
