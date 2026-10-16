import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as data from '../src/data.js';
import * as tactics from '../src/tactics.js';
import {Soundtrack} from '../src/music.js';
import * as engine from '../src/engine.js';
import * as life from '../src/life.js';

function createUI(source){
 const root={innerHTML:'',addEventListener(){}};
 const document={
  getElementById:()=>root,
  addEventListener(){},
  body:{classList:{toggle(){}}},
 };
 const window={matchMedia:()=>({matches:false}),print(){}};
 const localStorage={getItem:()=>null,setItem(){}};
 const requestAnimationFrame=()=>{};
 const fetch=async()=>{throw Error('No external fetch in UI smoke test')};
 const noImports=source.replace(/^import .*?;\s*$/gm,'');
 const symbols={...data,...engine,...tactics,...life,Soundtrack,document,window,localStorage,requestAnimationFrame,fetch};
 const load=new Function(...Object.keys(symbols),
  noImports+';return {action,goLevel,startGame,setView,finish,advanceCinematic,cine:()=>cine,html:()=>root.innerHTML,game:()=>game,mode:()=>view};');
 return load(...Object.values(symbols));
}
const source=await readFile(new URL('../src/app.js',import.meta.url),'utf8');
test('landing page and campaign selection render original artwork and Ukrainian UX',()=>{
 const game=createUI(source);
 assert.match(game.html(),/ЮСТ-ОБОРОНА/);
 assert.match(game.html(),/assets\/yusya\.svg/);
 assert.match(game.html(),/Справа дня/);
 game.setView('worlds');
 assert.match(game.html(),/Оберіть світ/);
 game.goLevel(0,1);
 assert.equal(game.mode(),'deck');
 assert.match(game.html(),/assets\/sprites\/registrar\.svg/);
 game.startGame();
 assert.equal(game.mode(),'play');
 assert.match(game.html(),/assets\/worlds\/world-1\.svg/);
});
test('daily and endless can start without unlocking all campaign worlds',()=>{
 const game=createUI(source);
 game.action('daily',{});
 assert.equal(game.mode(),'deck');
 assert.match(game.html(),/Особливий режим/);
 game.startGame();
 assert.equal(game.game().challenge.kind,'daily');
 game.action('home',{});
 game.action('endless',{});
 game.startGame();
 assert.equal(game.game().challenge.kind,'endless');
 assert.equal(game.game().maxWave,1);
});
test('pause, settings and almanac can render',()=>{
 const game=createUI(source);
 game.goLevel(0,1);
 game.startGame();
 game.action('pause',{});
 assert.match(game.html(),/Продовжити/);
 game.action('close-modal',{});
 game.action('almanac',{});
 assert.match(game.html(),/Альманах Юсі/);
 game.action('settings',{});
 assert.match(game.html(),/Автоматично збирати печатки/);
});

test("ending cinematic precedes statistics, player can skip",()=>{
 const ui=createUI(source);
 ui.goLevel(0,1);ui.startGame();
 assert.match(source,/setView\("outro"\)/);
 assert.match(source,/skip-outro/);
 assert.match(source,/outroElapsed/);
 assert.match(source,/result:renderResult,outro:renderOutro/);
});
test("music volume and mute are separate from hit sounds",()=>{
 const ui=createUI(source);
 ui.setView("settings");
 assert.match(ui.html(),/Фонова музика/);
 assert.match(ui.html(),/Гучність музики/);
 assert.match(ui.html(),/Звукові ефекти/);
});

test("completed level shows victory animation BEFORE results and allows skip",()=>{
 const ui=createUI(source);
 ui.goLevel(0,1);ui.startGame();
 ui.game().phase="won";
 ui.finish();
 assert.equal(ui.mode(),"outro");
 assert.match(ui.html(),/СХЕМУ ЗУПИНЕНО/);
 assert.match(ui.html(),/outro-stars/);
 assert.match(ui.html(),/assets\/yusya.svg/);
 assert.doesNotMatch(ui.html(),/class="stat-row"/);
 ui.action("skip-outro",{});
 assert.equal(ui.mode(),"result");
 assert.match(ui.html(),/Права захищено/);
});
test("lost level shows distinct defeat animation BEFORE score screen",()=>{
 const ui=createUI(source);
 ui.goLevel(0,1);ui.startGame();
 ui.game().phase="lost";
 ui.finish();
 assert.equal(ui.mode(),"outro");
 assert.match(ui.html(),/ОБОРОНУ ПРОРВАНО/);
 assert.match(ui.html(),/outro-defeat/);
 ui.action("skip-outro",{});
 assert.equal(ui.mode(),"result");
 assert.match(ui.html(),/Схема прорвалася/);
});
test('a new card pauses the battle with a spotlight coach card after the intro',()=>{
 const game=createUI(source);
 game.goLevel(0,2);game.startGame();
 assert.ok(game.cine(),'the battle opens with the cinematic');
 assert.doesNotMatch(game.html(),/coach-card/,'no coach card over the cinematic');
 game.advanceCinematic(30);
 assert.equal(game.cine(),null);
 assert.match(game.html(),/coach-card/);
 assert.match(game.html(),/Нова картка/);
 assert.match(game.html(),/coach-spot/);
 game.action('intro-next');
 assert.doesNotMatch(game.html(),/coach-card/);
 game.startGame();game.advanceCinematic(30);
 assert.doesNotMatch(game.html(),/coach-card/,'a seen card is not explained twice');
});
test('the very first battle is a guided tutorial instead of a coach card',()=>{
 const game=createUI(source);
 game.goLevel(0,1);game.startGame();game.advanceCinematic(30);
 assert.ok(game.game().tutorial,'guided flow is on');
 assert.equal(game.game().tutorial.step,'pick');
 assert.doesNotMatch(game.html(),/coach-card/);
 assert.match(game.html(),/street-scene/);
 assert.match(game.html(),/tutor-bar/);
});
