import {UNITS,ENEMY_BY_ID,TOOLS,SCHEMES} from "./data.js";
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
 if(u.kind==="mine")return 95*m;
 if(u.kind==="blast")return e.scheme==="corruption"?150*m:8;
 if(u.kind==="sweep")return e.trait==="neutral"?200:42*m;
 return Math.max(1,u.damage||0)/Math.max(.8,u.interval||2)*m;
}
const SPECIAL={
 poa:"Є захисний шар. Виконавчий інструмент обходить його; реєстратор ефективний після зняття захисту.",
 broker:"Маскується та перестрибує звичайні бар'єри. «Сповіщення» виявляє; нотаріальна контора блокує стрибок.",
 heir:"Маскується та породжує схемників після викриття. Стане у пригоді «Сповіщення».",
 raider:"За 2,5 с біля захисника захоплює клітинку фальшивим записом. Нотаріуса та захищених КЕП не захопить. «Комісія зі скарг» відновлює захисника.",
 phisher:"Тимчасово вимикає захисників. Цифровий захист і відстань допоможуть.",
 hacker:"Плутає незахищених. Нотаріальний інструмент не влучає; потрібен цифровий захист.",
 caller:"Блокує захисників. Цифрові інструменти ефективніші.",
 usb:"Вибухає при контакті. Знищуйте здалеку або використовуйте 2FA поряд.",
 briber:"Підкуповує незахищених. «Спецперевірка» захищає, «Викривач» атакує.",
 lustrated:"Відроджується, якщо смертельний удар завдано не антикорупційним інструментом.",
 alimony:"Швидкий боржник-стрибун. Уповільнюйте «Обмеженням боржника» або блокуйте конторою.",
 burrower:"Підземного боржника вражають лише навісна атака Виконавця або «Арешт майна».",
 bankrupt:"Летить поверх стін. Потрібен «Арбітражний керуючий», «Судовий експерт» або «Апостиль».",
 nonpayer:"Нейтральний персонаж: не називайте боржника шахраєм. Допомога дозволяє пройти без шкоди.",
 golem:"Великий запас здоров'я і повільний замах (ГУП!): поки він замахується, концентруйте атаку. Потрібні економіка й укріплення.",
 queue:"Після знищення ділиться. Тримайте оборону кількох доріжок.",
 mini_boss:"Експертна перевірка ефективніша. Решта інструментів завдають зменшеної шкоди.",
 offshore_safe:"Граф невразливий, доки є сейфи. «Державний виконавець» виявляє активи, після чого їх атакують.",
 tentacle:"П'ять щупалець захищають голову Спрута. Антикорупційні інструменти ефективніші.",
 hydra_phish:"Звичайна зброя лише виснажує голову до 1 HP. Добити її може тільки 2FA — поставте її будь-де в ряду голови.",
 hydra_call:"Звичайна зброя лише виснажує голову до 1 HP. Добити її може тільки 2FA — поставте її будь-де в ряду голови.",
 hydra_malware:"Звичайна зброя лише виснажує голову до 1 HP. Добити її може тільки 2FA — поставте її будь-де в ряду голови."
};
const BOSS_NOTES=[
 "Барон: у третій фазі застосуйте ручну Заборону 🛑 на його доріжці.",
 "Граф: виявіть та знищіть чотири сейфи, лише тоді голова вразлива.",
 "Спрут: стоїть, доки живі щупальця. Викривач біля щупалець знищує кілька одразу; далі голову б'ють усі.",
 "Гідра: виснажте три голови будь-якою зброєю, добийте їх 2FA у їхніх рядах, потім протримайтесь 30 секунд."
];
export function getCounterAdvice(id,{level=null,deck=[],owned=UNITS}={}){
 const threat=getThreat(id,level);if(!threat)return null;
 const ownedIds=new Set(owned.map(u=>typeof u==="string"?u:u.id)),deckIds=new Set(deck);
 const priority=u=>deckIds.has(u.id)?2:ownedIds.has(u.id)?1:0;
 const recommended=UNITS.map(unit=>({...unit,score:score(unit,threat)}))
  .filter(u=>u.score>0).sort((a,b)=>priority(b)-priority(a)||b.score-a.score||a.cost-b.cost)
  .slice(0,6).map(u=>({id:u.id,name:u.name,cost:u.cost,tool:u.tool,score:Math.round(u.score),
   state:deckIds.has(u.id)?"deck":ownedIds.has(u.id)?"owned":"locked",
   multiplier:TOOLS[u.tool]?.multipliers[SCHEMES.indexOf(threat.scheme)]??1}));
 const note=id==="boss"?BOSS_NOTES[level?.world||0]:
  SPECIAL[id]||("Тип загрози: "+threat.scheme+". Підбирайте інструмент за ефективністю.");
 const support=[];
 if(["disguised_jump","disguised_split"].includes(threat.trait))support.push("notification");
 if(["bribe","hack"].includes(threat.trait))support.push("integrity");
 if(threat.trait==="seize")support.push("commission","notary");
 if(threat.trait==="hydra_head")support.push("twofactor");
 if(id==="offshore_safe")support.push("executor");
 if(threat.trait==="neutral")support.push("legal_aid");
 return {threat,note,recommended,support};
}
