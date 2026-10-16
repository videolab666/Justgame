/**
 * Zero-dependency visual smoke test using GitHub runner's installed Chrome and CDP.
 * Run from the repository root: node scripts/browser-smoke.mjs
 * Captures home, battle, first shot, and mobile-landscape screenshots.
 */
import {createServer} from "node:http";
import {readFile,writeFile,mkdir,mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve,sep,extname} from "node:path";
import {spawn,execFileSync} from "node:child_process";
import {pathToFileURL} from "node:url";

const root=resolve(process.cwd());
const delay=ms=>new Promise(ok=>setTimeout(ok,ms));
const mime={".html":"text/html;charset=utf-8",".css":"text/css;charset=utf-8",
 ".js":"text/javascript;charset=utf-8",".json":"application/json;charset=utf-8",".svg":"image/svg+xml"};
function chromePath(){
 if(process.env.CHROME_BIN)return process.env.CHROME_BIN;
 for(const bin of ["google-chrome","google-chrome-stable","chromium","chromium-browser"])
  try{return execFileSync("which",[bin],{encoding:"utf8"}).trim();}catch{}
 throw Error("Chrome is required on the runner; check the Ubuntu image");
}
const server=createServer(async(req,res)=>{
 try{
  let url=decodeURIComponent(new URL(req.url,"http://localhost").pathname);
  if(url==="/")url="/index.html";
  const path=resolve(root+"", "."+url);
  if(!(path===root||path.startsWith(root+sep)))throw Error("Disallowed path");
  const body=await readFile(path);
  res.writeHead(200,{"Content-Type":mime[extname(path)]||"application/octet-stream","Cache-Control":"no-store"});
  res.end(body);
 }catch{res.writeHead(404);res.end("Not found");}
});
await new Promise(ok=>server.listen(0,"127.0.0.1",ok));
const address=server.address();
const origin="http://127.0.0.1:"+address.port;
const profile=await mkdtemp(join(tmpdir(),"justgame-cdp-"));
const output=join(root,"screenshots");
let browser=null,socket=null;
const failures=[];
try{
 // Browser startup may be delayed on a GitHub runner busy with three jobs.
 // Capture stderr and allow up to 40s instead of reporting a false game failure.
 let chromeErrors="";
 browser=spawn(chromePath(),["--headless=new","--no-sandbox","--disable-dev-shm-usage",
  "--disable-background-timer-throttling","--disable-gpu","--disable-extensions",
  "--no-first-run","--no-default-browser-check","--remote-debugging-port=0",
  "--user-data-dir="+profile,"--window-size=1440,900",origin+"/"],
  {stdio:["ignore","ignore","pipe"]});
 browser.stderr.on("data",chunk=>{chromeErrors=(chromeErrors+String(chunk)).slice(-4500);});
 let port=null;
 for(let i=0;i<200;i++){
  try{
   const raw=await readFile(join(profile,"DevToolsActivePort"),"utf8");
   port=Number(raw.split("\n")[0]);break;
  }catch{await delay(200);}
  if(browser.exitCode!==null)break;
 }
 if(!port)throw Error("Chrome DevTools never started (exit="+browser.exitCode+"): "+chromeErrors);
 let page=null;
 for(let i=0;i<55;i++){
  try{const tabs=await (await fetch("http://127.0.0.1:"+port+"/json/list")).json();
   page=tabs.find(t=>t.type==="page"&&t.url.startsWith(origin));
   if(page)break;
  }catch{}
  await delay(180);
 }
 if(!page)throw Error("No Chrome tab for the game");
 socket=new WebSocket(page.webSocketDebuggerUrl);
 await new Promise((ok,no)=>{
  socket.addEventListener("open",ok,{once:true});
  socket.addEventListener("error",no,{once:true});
 });
 const pending=new Map();let next=1;
 socket.addEventListener("message",ev=>{
  const response=JSON.parse(ev.data);
  if(response.id&&pending.has(response.id)){
   const item=pending.get(response.id);pending.delete(response.id);
   if(response.error)item.no(Error(response.error.message));
   else item.ok(response.result);
  }
  if(response.method==="Runtime.exceptionThrown"){
   const details=response.params.exceptionDetails;
   failures.push("Browser exception: "+(details.text||"")+" "+(details.exception?.description||""));
  }
 });
 function cmd(method,params={}){
  return new Promise((ok,no)=>{
   const id=next++;pending.set(id,{ok,no});
   socket.send(JSON.stringify({id,method,params}));
  });
 }
 async function js(code){
  const out=await cmd("Runtime.evaluate",{expression:code,awaitPromise:true,returnByValue:true});
  if(out.exceptionDetails)throw Error("Page expression: "+(out.exceptionDetails.exception?.description||out.exceptionDetails.text));
  return out.result.value;
 }
 async function waitFor(code,ms=12000){
  const started=Date.now();
  while(Date.now()-started<ms){
   try{if(await js(code))return;}catch{}
   await delay(140);
  }
  throw Error("Browser did not satisfy: "+code);
 }
 async function screenshot(name){
  await mkdir(output,{recursive:true});
  const response=await cmd("Page.captureScreenshot",{format:"png",captureBeyondViewport:false,fromSurface:true});
  await writeFile(join(output,name+".png"),Buffer.from(response.data,"base64"));
  console.log("Screenshot:",name);
 }
 await cmd("Page.enable");
 await cmd("Runtime.enable");
 await waitFor("!!document.querySelector('.hero .hero-copy')");
 await screenshot("01-home-desktop");
 await js('document.querySelector("[data-act=worlds]").click()');
 await waitFor('!!document.querySelector(".world-grid")');
 await js('document.querySelector("[data-act=world][data-world=\\"0\\"]").click()');
 await waitFor('!!document.querySelector(".level-grid")');
 await js('document.querySelector("[data-act=level][data-stage=\\"1\\"]").click()');
 await waitFor('!!document.querySelector(".deck-grid")');
 await js('document.querySelector("[data-act=start]").click()');
 await waitFor('!!document.querySelector(".board > .cell")');
 const boardSize=await js('({w:document.querySelector(".board").clientWidth,h:document.querySelector(".board").clientHeight})');
 if(boardSize.w<400||boardSize.h<250)throw Error("Desktop board collapsed: "+JSON.stringify(boardSize));
 await js('document.querySelector(".board > .cell[data-lane=\\"2\\"][data-col=\\"2\\"]").click()');
 await waitFor('!!document.querySelector(".board .defender")');
 await screenshot("02-board-with-defender");

 const musicButton=await js('!!document.querySelector("[data-act=music-toggle]")');
 if(!musicButton)throw Error("Music toggle missing from battle controls");
 const musicInitially=await js('document.querySelector("[data-act=music-toggle]").getAttribute("aria-pressed")');
 if(musicInitially!=="true")throw Error("Music should be enabled for new games");
 await js('document.querySelector("[data-act=music-toggle]").click()');
 const muted=await js('document.querySelector("[data-act=music-toggle]").getAttribute("aria-pressed")');
 if(muted!=="false")throw Error("Music toggle cannot mute");
 await js('document.querySelector("[data-act=music-toggle]").click()');
 const unmuted=await js('document.querySelector("[data-act=music-toggle]").getAttribute("aria-pressed")');
 if(unmuted!=="true")throw Error("Music toggle cannot unmute");

 await waitFor('document.querySelectorAll(".enemy").length>0',28000);
 await waitFor('document.querySelectorAll(".projectile").length>0',11000);
 await screenshot("03-shots-and-enemies");

 // Original character identity: confirm redesigned files load, differ, and render
 // visibly at small thumbnail sizes. This is a review screenshot, not marketing art.
 const artworkIds=["registrar","senior","notary","executor","private_executor","expert","intern","trustee","whistleblower","integrity","limitation","schemer","raider","broker","heir","phisher","hacker","caller","briber","conflict","lustrated","alimony","burrower","nonpayer","poa","unregistered","mini_boss"];
 const artCheck=await js('(async()=>{const ids='+JSON.stringify(artworkIds)+';const images=await Promise.all(ids.map(async id=>{const r=await fetch("./assets/sprites/"+id+".svg");return {id,ok:r.ok,body:await r.text()}}));return {count:images.length,unique:new Set(images.map(x=>x.body)).size,missing:images.filter(x=>!x.ok).map(x=>x.id),named:images.every(x=>x.body.includes("<title"))}})()');
 if(artCheck.missing.length||artCheck.unique!==artworkIds.length||!artCheck.named)
  throw Error("Redesigned SVG identity failure "+JSON.stringify(artCheck));
 await js('(()=>{const ids='+JSON.stringify(artworkIds)+';const layer=document.createElement("section");layer.id="art-review";layer.style.cssText="position:fixed;z-index:9999;inset:8px;background:#f7f0e2;display:grid;grid-template-columns:repeat(9,minmax(0,1fr));grid-template-rows:repeat(3,minmax(0,1fr));gap:4px;padding:12px;border:4px solid #194d68;overflow:hidden";for(const id of ids){const tile=document.createElement("div");tile.style.cssText="border:1px solid #93b2b9;border-radius:9px;background:#fff;display:flex;align-items:center;justify-content:center;flex-direction:column;overflow:hidden";const img=document.createElement("img");img.src="./assets/sprites/"+id+".svg";img.style.cssText="height:72%;max-width:96%;object-fit:contain";const title=document.createElement("small");title.textContent=id;title.style.cssText="font:700 10px sans-serif;color:#22506b;max-width:100%;overflow:hidden";tile.append(img,title);layer.append(tile)}document.body.append(layer)})()');
 await waitFor('document.querySelectorAll("#art-review img").length===27');
 await delay(450);
 await screenshot("07-character-identity-gallery");
 await js('document.querySelector("#art-review").remove()');
 console.log("All original character sprites loaded and unique",JSON.stringify(artCheck));


 const measure='(()=>{const r=document.querySelector(".board").getBoundingClientRect();return {w:r.width,h:r.height,top:r.top,ratio:r.width/r.height}})()';
 const baseline=await js(measure);
 const stable=(before,after,stage)=>{
  if(Math.abs(before.w-after.w)>.8||Math.abs(before.h-after.h)>.8||Math.abs(before.top-after.top)>.8)
   throw Error("FIELD JUMP "+stage+" "+JSON.stringify({before,after}));
 };
 if(Math.abs(baseline.ratio-2)>.06)throw Error("Field ratio should remain 2:1 "+JSON.stringify(baseline));
 await js('document.querySelector(".cardbar [data-act=unit]").click()');
 stable(baseline,await js(measure),"select-card");
 await js('document.querySelector(".board > .cell[data-lane=\\"2\\"][data-col=\\"3\\"]").click()');
 stable(baseline,await js(measure),"place");
 await js('document.querySelector(".game-top [data-act=speed]").click()');
 stable(baseline,await js(measure),"speed");
 await js('document.querySelector(".threat-legend [data-act=hint]").click()');
 await waitFor('!!document.querySelector(".counter-list .counter-row")');
 await screenshot("05-enemy-counter-advice");
 stable(baseline,await js(measure),"help-open");
 await js('document.querySelector(".dialog [data-act=close-modal]").click()');
 stable(baseline,await js(measure),"help-close");
 await js('document.querySelector(".threat-chip[data-enemy=schemer]").click()');
 await waitFor('!!document.querySelector(".counter-list")');
 await js('document.querySelector(".dialog [data-act=close-modal]").click()');
 stable(baseline,await js(measure),"enemy-legend");
 await delay(1700);
 stable(baseline,await js(measure),"live-wave");
 console.log("Field geometry stable during battle interactions",JSON.stringify(baseline));

 await cmd("Emulation.setDeviceMetricsOverride",{width:812,height:420,deviceScaleFactor:1.5,mobile:true,screenWidth:812,screenHeight:420});
 await delay(500);
 const mobile=await js('({w:document.querySelector(".board").clientWidth,cells:document.querySelectorAll(".board > .cell").length})');
 if(mobile.w<300||mobile.cells!==45)throw Error("Mobile board invalid: "+JSON.stringify(mobile));
 await screenshot("04-mobile-landscape");

 const landscape=await js(measure);
 if(Math.abs(landscape.ratio-2)>.06)throw Error("Mobile landscape grid warped: "+JSON.stringify(landscape));
 await js('document.querySelector(".threat-legend [data-act=hint]").click()');
 await waitFor('!!document.querySelector(".counter-list")');
 await js('document.querySelector(".dialog [data-act=close-modal]").click()');
 stable(landscape,await js(measure),"mobile-help");
 await cmd("Emulation.setDeviceMetricsOverride",{width:390,height:844,deviceScaleFactor:2.5,mobile:true,screenWidth:390,screenHeight:844});
 await delay(400);
 const portrait=await js('(()=>{const b=document.querySelector(".board"),f=document.querySelector(".field-wrap");return {w:b.clientWidth,h:b.clientHeight,scrollable:f.scrollWidth>f.clientWidth,cells:document.querySelectorAll(".board > .cell").length}})()');
 if(portrait.w<500||portrait.cells!==45||!portrait.scrollable)
  throw Error("Portrait field must scroll horizontally rather than collapse: "+JSON.stringify(portrait));
 await screenshot("06-mobile-portrait-scroll");
 console.log("Portrait grid geometry",JSON.stringify(portrait));

 if(failures.length)throw Error(failures.join("\n"));
 console.log("Browser UI + projectile smoke test passed",JSON.stringify({boardSize,mobile}));
}finally{
 socket?.close();
 if(browser){
  const stopped=new Promise(ok=>{
   if(browser.exitCode!==null)ok();
   else browser.once("exit",ok);
  });
  browser.kill("SIGTERM");
  await Promise.race([stopped,delay(3000)]);
 }
 await new Promise(ok=>server.close(ok));
 await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:180});
}
