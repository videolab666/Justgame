import {UNITS,ENEMY_BY_ID,TOOLS,SCHEMES,TYPES} from "./data.js";
const PARTS={
 offshore_safe:["Сейф-офшор","debt","offshore_safe","🔒"],
 tentacle:["Щупальце підкупу","corruption","tentacle","🐙"],
 hydra_phish:["Голова фішингу","cyber","hydra_head","🎣"],
 hydra_call:["Голова дзвінків","cyber","hydra_head","☎️"],
 hydra_malware:["Голова шкідливого ПЗ","cyber","hydra_head","💾"],
 mini_boss:["Липовий експерт","bureaucracy","mini_boss","🥼"]
};
export function getThreat(id,level){
 if(id==="boss")return level?.bossData?{...level.bossData,id:"boss",trait:"boss"}:null;
 const e=ENEMY_BY_ID[id];if(e)return e;
 const x=PARTS[id];return x?{id,name:x[0],scheme:x[1],trait:x[2],icon:x[3]}:null;
}
export function getEncounterThreats(level,game){
 const ids=new Set(game?.plan?game.plan.map(a=>a.id):level?.enemies||[]);
 if(level?.boss)ids.add("boss");
 if(game?.enemies)for(const e of game.enemies)ids.add(e.id);
 if(level?.boss&&level.world===1)ids.add("offshore_safe");
 if(level?.boss&&level.world===2)ids.add("tentacle");
 if(level?.boss&&level.world===3)for(const id of ["hydra_phish","hydra_call","hydra_malware"])ids.add(id);
 return [...ids].filter(id=>getThreat(id,level));
}
const ATTACKERS=new Set(["shooter","intern","lobber","splash","air","slow","sniper","global","trap","mine","blast","sweep"]);
function eligible(u,e){
 if(!ATTACKERS.has(u.kind))return false;
 if(e.trait==="neutral")return u.kind==="sweep";
 if(e.id==="hacker"&&u.tool==="notary")return false;
 if(e.trait==="flying"&&!["air","sniper","global"].includes(u.kind))return false;
 if(e.trait==="burrow"&&!["lobber","mine"].includes(u.kind))return false;
 // Jumpers leap over the first thing in their path, a mine included.
 if(u.kind==="mine"&&["jump","disguised_jump"].includes(e.trait))return false;
 if(u.kind==="trap"&&e.scheme!=="cyber")return false;
 if(e.trait==="hydra_head"&&u.tool!=="digital")return false;
 if(e.id==="offshore_safe"&&u.kind!=="lobber"&&u.tool!=="enforcement")return false;
 return true;
}
function score(u,e){
 if(!eligible(u,e))return 0;
 let m=TOOLS[u.tool]?.multipliers[SCHEMES.indexOf(e.scheme)]??1;
 if(e.id==="mini_boss"&&u.tool!=="expert")m=Math.min(m,.5);
 if(e.trait==="tentacle"&&u.tool!=="integrity")m*=.5;
 if(e.id==="boss"){
  if(e.scheme==="cyber"&&u.tool!=="digital")m*=.25;
 }
 if(u.kind==="trap")return 115*m;
 // One-shot cards rank below sustained shooters, so "Чим зупинити" does not
 // open with a single-use mine or sweep against an ordinary walker.
 if(u.kind==="mine")return e.trait==="burrow"?95*m:20*m;
 if(u.kind==="blast")return e.scheme==="corruption"?150*m:8;
 if(u.kind==="sweep")return e.trait==="neutral"?200:16*m;
 return Math.max(1,u.damage||0)/Math.max(.8,u.interval||2)*m;
}
const SPECIAL={
 schemer:"Звичайний виконавець схеми: 200 міцності, іде прямо й гризе першого захисника на шляху. Реєстратор (×2 проти підробок) зупиняє його за кілька пострілів.",
 poa:"Несе щит-довіреність на 370: спершу постріли б'ють по щиту. Виконавчі інструменти (Державний виконавець, Арешт майна) проходять крізь щит; Реєстратор добре працює, коли щит знято.",
 broker:"У масці: звичайні стрільці його не бачать. «Сповіщення» поруч або Судовий експерт зривають маску. Перестрибує першого захисника на шляху — стрибок зупиняє лише Нотаріальна контора.",
 heir:"У масці, як маклер. Коли маску зірвано (або він гине в масці), кличе ще двох Схемників. Тримайте в цьому ряду стрільців, щоб одразу їх зустріти.",
 raider:"Повільний, але, постоявши 2,5 с біля захисника, захоплює його клітинку фальшивим записом. Нотаріуса й захищених (КЕП-щит, Спецперевірка поруч) захопити не може. «Комісія зі скарг» повертає захисника.",
 phisher:"Кожні 10 с на 5 с вимикає найближчого захисника попереду себе (до 3 клітинок). 2FA і захисників під КЕП-щитом вимкнути не може. Найкраще — 2FA на його шляху.",
 hacker:"Біля захисника за 4 с «зламує» його — той 8 с плутається й не стріляє. Нотаріальні інструменти по ньому не влучають. Захищають КЕП-щит і Спецперевірка; б'є 2FA.",
 caller:"Швидкий. Кожні 8 с на 3 с вимикає найближчого захисника попереду (до 3 клітинок); 2FA і КЕП-щит не вимикає. Найкраще — 2FA на його шляху.",
 usb:"Дуже швидка, 80 міцності. Біля захисника вибухає на 150 шкоди (КЕП-щит поглинає). Збивайте здалеку або ставте 2FA на шляху. На пізніх рівнях летять зграйкою по п'ять.",
 briber:"Біля захисника за 3 с «підкуповує» його — той 8 с не стріляє. «Спецперевірка» поруч захищає, «Викривач» знищує.",
 conflict:"Міцний (500). Коли гине, у сусідніх рядах з'являються два Схемники — тримайте оборону й там. «Викривач» б'є його ×2.",
 lustrated:"Повільний і міцний. Якщо добити його не «Викривачем», він один раз повертається з половиною міцності. Добийте Викривачем — і він не повернеться.",
 alimony:"Найшвидший боржник і перестрибує першого захисника. «Обмеження боржника» майже зупиняє його, Державний виконавець б'є ×2; стрибок зупиняє лише Нотаріальна контора.",
 burrower:"Іде під землею: звичайні стрільці не влучають. Бийте навісом «Державного виконавця» або ставте «Арешт майна» на його шляху.",
 bankrupt:"Летить над полем і стінами. Збивають Арбітражний керуючий, Судовий експерт або Апостиль. Збитий — залишає бонусну печатку.",
 nonpayer:"Нейтральний персонаж, не шахрай: ніхто по ньому не стріляє. Дійде до будинку — це не прорив, ще й +50 печаток. «Безоплатна правнича допомога» в його ряду теж дає +50.",
 golem:"3000 міцності, дуже повільний. Біля захисника 1,2 с замахується й б'є на 2500 (ГУП! раз на 1,8 с) — ставте міцні стіни й зосередьте стрільців. На половині міцності випускає Схемника.",
 unregistered:"Поки він у ряду, усі інші вороги цього ряду йдуть на 30 % швидше. Знищуйте його першим. Експертні інструменти б'ють ×2.",
 queue:"Дуже повільна, але міцна (600). Коли гине, у сусідніх рядах з'являються два Схемники. Експертні інструменти б'ють ×2.",
 mini_boss:"Кожні 8 с лікує на 300 ворогів поруч «липовим висновком». Судовий експерт б'є на повну, решта інструментів — лише половину.",
 offshore_safe:"Поки цілий хоч один сейф, Граф невразливий і спить. Залп «Державного виконавця» одразу виявляє сейфи, а за 20 с вони знайдуться й самі. Потім розбийте їх.",
 tentacle:"П'ять щупалець тримають Спрута на місці, а його голова отримує лише чверть шкоди. Кожні 12 с щупальце вимикає незахищеного захисника свого ряду. «Викривач» поруч знищує кілька одразу; інші інструменти б'ють ×0,5.",
 hydra_phish:"Кожні 12 с краде з поля несобрану печатку — збирайте швидше. Звичайна зброя лише виснажує голову до 1 HP; добиває її 2FA будь-де в її ряду (2FA на клітинці з головою б'є її й одразу).",
 hydra_call:"Кожні 12 с на 4 с вимикає захисника свого ряду (крім 2FA і захищених КЕП-щитом). Звичайна зброя лише виснажує голову до 1 HP; добиває 2FA будь-де в її ряду.",
 hydra_malware:"Кожні 12 с випускає Шкідливу флешку у свій ряд. Звичайна зброя лише виснажує голову до 1 HP; добиває 2FA будь-де в її ряду."
};
const BOSS_NOTES=[
 "Барон: у 1-й фазі кличе Фальшиві довіреності, у 2-й — Рейдерів. Коли він ослабне до третини (фаза 3), натисніть каток-Заборону «ЗАБОРОНЕНО» на початку його доріжки — це фінальний удар.",
 "Граф: поки цілі чотири сейфи — невразливий і спить. Державний виконавець знаходить сейфи (за 20 с вони знайдуться й самі) — розбийте їх. Фаза 2: Граф зависає в повітрі, виконавчі інструменти б'ють на повну, решта ×0,2, а банкрутів збиває Арбітражний керуючий. Фаза 3: тікає — «Обмеження боржника» його зупиняє.",
 "Спрут: поки живі п'ять щупалець, стоїть, не кличе підмоги й отримує лише чверть шкоди. «Викривач» біля щупалець знищує кілька одразу. Потім Спрут іде вперед, а корупціонери приходять із флангів.",
 "Гідра: тіло спить і невразливе, поки живі три голови. Виснажте голови будь-якою зброєю, добийте їх 2FA у їхніх рядах. Потім розбийте тіло й протримайтесь 30 секунд."
];
/** Plain-language "how it acts and how to stop it" for any threat. */
export function threatNote(id,level=null){
 if(id==="boss")return BOSS_NOTES[level?.world||0];
 const t=getThreat(id,level);
 if(SPECIAL[id])return SPECIAL[id];
 return t?"Тип загрози: "+(TYPES[t.scheme]?.name||t.scheme).toLowerCase()+". Підбирайте інструмент, сильний проти цього типу.":"";
}
export function getCounterAdvice(id,{level=null,deck=[],owned=UNITS}={}){
 const threat=getThreat(id,level);if(!threat)return null;
 const ownedIds=new Set(owned.map(u=>typeof u==="string"?u:u.id)),deckIds=new Set(deck);
 const priority=u=>deckIds.has(u.id)?2:ownedIds.has(u.id)?1:0;
 const recommended=UNITS.map(unit=>({...unit,score:score(unit,threat)}))
  .filter(u=>u.score>0).sort((a,b)=>priority(b)-priority(a)||b.score-a.score||a.cost-b.cost)
  .slice(0,6).map(u=>({id:u.id,name:u.name,cost:u.cost,tool:u.tool,score:Math.round(u.score),
   state:deckIds.has(u.id)?"deck":ownedIds.has(u.id)?"owned":"locked",
   multiplier:TOOLS[u.tool]?.multipliers[SCHEMES.indexOf(threat.scheme)]??1}));
 const note=threatNote(id,level);
 const support=[];
 if(["disguised_jump","disguised_split"].includes(threat.trait))support.push("notification");
 if(threat.trait==="jump")support.push("limitation","notary_office");
 if(threat.trait==="disguised_jump")support.push("notary_office");
 if(["bribe","hack"].includes(threat.trait))support.push("integrity");
 if(threat.trait==="seize")support.push("commission","notary");
 if(threat.trait==="hydra_head")support.push("twofactor");
 if(id==="offshore_safe")support.push("executor");
 if(threat.trait==="neutral")support.push("legal_aid");
 return {threat,note,recommended,support};
}
