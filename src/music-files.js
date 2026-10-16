// Background music from recorded tracks (assets/music). The synthesized
// Soundtrack in music.js now only plays the short win/lose jingles.
export const TRACKS={
 menu:"./assets/music/menu.mp3",
 battle:["./assets/music/battle-1.mp3","./assets/music/battle-2.mp3","./assets/music/battle-3.mp3","./assets/music/battle-4.mp3"],
 boss:"./assets/music/boss.mp3"
};
const FADE=.7;          // seconds for a full fade in or out
const PAUSE_DUCK=.35;   // share of the volume kept while a battle is paused

// Without HTMLAudioElement (tests, very old browsers) music is a silent no-op.
const defaultAudio=()=>typeof Audio==="function"?new Audio():
 {paused:true,volume:0,src:"",play(){this.paused=false;},pause(){this.paused=true;},getAttribute(){return this.src;}};

/** Which file a scene plays; null means silence. */
export function trackFor(scene,world=0,boss=false){
 if(scene==="menu")return TRACKS.menu;
 if(scene==="battle"||scene==="pause")return boss?TRACKS.boss:TRACKS.battle[Math.max(0,Math.min(3,world|0))];
 return null;
}

/** Two audio elements cross-fade between scenes. Browsers allow playback
 * only after a user gesture, so nothing sounds until unlock(). */
export class MusicPlayer{
 constructor(factory=defaultAudio){
  this.factory=factory;this.enabled=true;this.volume=.4;this.unlocked=false;
  this.scene="silent";this.src=null;this.duck=1;
  this.decks=[];this.current=null;this.last=0;
 }
 configure(music=true,musicVolume=40){
  this.enabled=!!music;
  this.volume=Math.max(0,Math.min(100,Number(musicVolume)||0))/100;
  // Off fades everything out; on again restores the current track.
  for(const d of this.decks)d.target=this.enabled&&d===this.current?1:0;
 }
 unlock(){
  if(!this.enabled)return false;
  this.unlocked=true;
  if(this.current&&this.current.el.paused)this.play(this.current);
  else if(!this.current&&this.src)this.switchTo(this.src);
  return true;
 }
 setScene(scene,world=0,intensity=0,{boss=false}={}){
  this.scene=scene;this.duck=scene==="pause"?PAUSE_DUCK:1;
  const src=trackFor(scene,world,boss);
  if(src!==this.src){this.src=src;this.switchTo(src);}
 }
 deck(){
  // Reuse an idle element instead of creating one per scene change.
  let d=this.decks.find(x=>x!==this.current&&x.gain<=.001);
  if(!d){d={el:this.factory(),gain:0,target:0};d.el.loop=true;d.el.preload="auto";this.decks.push(d);}
  return d;
 }
 switchTo(src){
  for(const d of this.decks)d.target=0;
  if(!src){this.current=null;return;}
  const d=this.deck();
  if(d.el.getAttribute?.("src")!==src&&d.el.src!==src){d.el.src=src;try{d.el.currentTime=0;}catch{}}
  d.target=1;this.current=d;
  if(this.unlocked&&this.enabled)this.play(d);
 }
 play(d){
  try{const p=d.el.play();p?.catch?.(()=>{});}catch{}
 }
 /** Call every animation frame: moves volumes toward their targets. */
 tick(now=(globalThis.performance?.now?.()??Date.now())){
  const dt=this.last?Math.min(.1,(now-this.last)/1000):0;this.last=now;
  const step=dt/FADE;
  for(const d of this.decks){
   const target=this.enabled?d.target:0;
   d.gain=d.gain<target?Math.min(target,d.gain+step):Math.max(target,d.gain-step);
   d.el.volume=Math.max(0,Math.min(1,d.gain*this.volume*this.duck));
   if(d.gain<=.001&&!d.el.paused&&d!==this.current){try{d.el.pause();}catch{}}
  }
 }
}
