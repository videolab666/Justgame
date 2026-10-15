import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as data from '../src/data.js';
import * as tactics from '../src/tactics.js';
import * as engine from '../src/engine.js';

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
 const symbols={...data,...engine,...tactics,document,window,localStorage,requestAnimationFrame,fetch};
 const load=new Function(...Object.keys(symbols),
  noImports+';return {action,goLevel,startGame,setView,html:()=>root.innerHTML,game:()=>game,mode:()=>view};');
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
