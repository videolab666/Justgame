import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {UNITS,UNIT_HOW,ENEMIES,getLevel} from "../src/data.js";
import {threatNote} from "../src/tactics.js";

test("every defender has a full 'how it plays' text",()=>{
 for(const u of UNITS){
  assert.ok(UNIT_HOW[u.id]?.length>30,u.id);
  assert.ok(!/undefined|NaN/.test(UNIT_HOW[u.id]),u.id);
 }
});
test("every enemy, boss part and boss has a tactic note without raw ids",()=>{
 const ids=[...ENEMIES.map(e=>e.id),"mini_boss","offshore_safe","tentacle","hydra_phish","hydra_call","hydra_malware"];
 for(const id of ids){
  const note=threatNote(id,getLevel(3,10));
  assert.ok(note.length>40,id);
  assert.ok(!/forgery|cyber|corruption|debt|bureaucracy|Тип загрози/.test(note),id+": "+note);
 }
 for(let w=0;w<4;w++)assert.ok(threatNote("boss",getLevel(w,10)).length>60);
});
test("boss notes describe the current roller guard, not the old stop button",()=>{
 assert.ok(!threatNote("boss",getLevel(0,10)).includes("🛑"));
 const src=["src/engine.js","src/app.js","src/tactics.js"].map(f=>readFileSync(new URL("../"+f,import.meta.url),"utf8")).join("\n");
 assert.ok(!src.includes("Натисніть 🛑"));
 assert.ok(!src.includes("@@@"),"no leftover placeholders");
});
test("every enemy and defender has real-life tips and a sourced fact",async()=>{
 const {ENEMY_LIFE,UNIT_LIFE}=await import("../src/life.js");
 for(const e of ENEMIES){const l=ENEMY_LIFE[e.id];assert.ok(l?.tips?.length>=2&&l.fact&&l.source,e.id);}
 for(const u of UNITS){const l=UNIT_LIFE[u.id];assert.ok(l?.tips?.length>=1&&l.fact&&l.source,u.id);}
});
