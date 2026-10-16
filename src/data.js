// Original educational characters and mechanics, based on GDD 15.10.2026.
// All legal explanations are provisional until approved by the authority's lawyers.
export const TYPES={forgery:{name:"Підробка",icon:"📄"},cyber:{name:"Кібер",icon:"💻"},corruption:{name:"Корупція",icon:"✉️"},debt:{name:"Борг",icon:"💸"},bureaucracy:{name:"Бюрократія",icon:"📚"}};
export const TOOLS={registry:{name:"Реєстраційний",icon:"🏛️",multipliers:[2,.5,1,1,1]},notary:{name:"Нотаріальний",icon:"🖋️",multipliers:[2,.5,1,.5,1]},enforcement:{name:"Виконавчий",icon:"⚖️",multipliers:[.5,.5,1,2,1]},digital:{name:"Цифровий",icon:"🔐",multipliers:[1,2,.5,1,1.5]},integrity:{name:"Антикорупційний",icon:"🔦",multipliers:[.5,.5,2,1,1]},expert:{name:"Експертний",icon:"🔬",multipliers:[1.5,1,1,1,2]}};
export const SCHEMES=["forgery","cyber","corruption","debt","bureaucracy"];
const U=(id,name,icon,cost,cooldown,hp,kind,tool,damage,interval,unlock,desc)=>({id,name,icon,cost,cooldown,hp,kind,tool,damage,interval,unlock,desc});
export const UNITS=[
U("registrar","Державний реєстратор","🏛️",100,7,300,"shooter","registry",20,1.4,"start","Печатки перевірки проти підробок."),
U("cnap","ЦНАП","🏠",50,7,300,"income",null,25,24,"1-1","Виробляє печатки довіри."),
U("notary","Нотаріус","🖋️",50,35,4000,"wall","notary",10,1,"1-2","Міцно тримає оборону."),
U("mine","Арешт майна","🔒",25,35,300,"mine","enforcement",1800,14,"1-3","Спрацьовує після підготовки."),
U("notification","Сповіщення","📱",75,20,300,"reveal","digital",0,0,"1-3","Розкриває замаскованих шахраїв."),
U("commission","Комісія зі скарг","⚖️",100,35,1,"restore","registry",0,0,"1-6","Прибирає фальшивий запис."),
U("archive","Архів БТІ","🗄️",50,35,300,"healer",null,200,20,"1-7","Відновлює сусідніх захисників."),
U("senior","Старший реєстратор","👩‍💼",200,20,300,"shooter","registry",40,1.4,"1-8","Подвійна перевірка документів."),
U("executor","Державний виконавець","📜",125,20,300,"lobber","enforcement",40,3,"2-1","Постанови перелітають через щити."),
U("limitation","Обмеження боржника","⛓️",175,20,300,"slow","enforcement",15,2,"2-1","Сповільнює та зупиняє боржників."),
U("trustee","Арбітражний керуючий","🧮",125,20,300,"air","enforcement",30,1.5,"2-2","Помічає фіктивних банкрутів."),
U("station","Зарядна станція","🔋",75,20,400,"power",null,0,0,"2-3","Підтримує захист під час блекауту."),
U("private_executor","Приватний виконавець","💼",300,35,300,"splash","enforcement",80,3,"2-5","Постанова впливає на сусідні клітинки."),
U("notary_office","Нотаріальна контора","🏢",125,50,8000,"wall","notary",0,0,"2-7","Її не можна перестрибнути."),
U("whistleblower","Викривач","📣",150,50,1,"blast","integrity",1500,0,"3-1","Викриває корупцію навколо."),
U("integrity","Спецперевірка","🔦",125,20,300,"integrity","integrity",0,0,"3-1","Захищає від підкупу."),
U("order","Зареєстрований наказ","📋",75,20,200,"boost","registry",0,0,"3-2","Посилює оборону свого ряду."),
U("expert","Судовий експерт","🔬",225,35,300,"sniper","expert",60,2.5,"3-3","Виявляє приховані підробки."),
U("intern","Стажер","🎒",0,35,150,"intern","registry",10,2,"3-5","Через хвилину підвищує кваліфікацію."),
U("legal_aid","Безоплатна правнича допомога","📘",125,50,1,"sweep",null,1800,0,"3-7","Поширює правовий захист на весь ряд."),
U("twofactor","Двофакторна автентифікація","🔐",100,20,300,"trap","digital",20,1,"4-1","Захист від кіберзагроз у клітинці."),
U("shield","КЕП-щит","🛡️",125,35,3000,"shield","digital",0,0,"4-1","Захищає іншого юніта від перехоплення."),
U("apostille","Апостиль","🕊️",150,35,300,"global","expert",50,8,"4-2","Працює по всьому полю."),
U("digital_office","Цифровий офіс","🏙️",150,20,300,"upgrade",null,50,24,"4-5","Покращує виробництво ЦНАП.")
];
export const UNIT_BY_ID=Object.fromEntries(UNITS.map(x=>[x.id,x]));
const E=(id,name,icon,scheme,hp,speed,trait,shield=0,threat=1,tip="Обирайте відповідний правовий інструмент.")=>({id,name,icon,scheme,hp,speed,trait,shield,threat,tip});
export const ENEMIES=[
E("schemer","Схемник","🕵️","forgery",200,1,"basic",0,1,"Перевіряйте документи й інформацію в офіційних реєстрах."),
E("poa","Фальшива довіреність","📑","forgery",200,1,"shield",370,2,"Увага до довіреностей: справжність необхідно перевіряти."),
E("raider","Рейдер-переоформлювач","🧑‍💼","forgery",500,.8,"seize",0,4,"Незаконну реєстраційну дію можна оскаржувати."),
E("broker","Чорний маклер","🪧","forgery",350,1.2,"disguised_jump",0,3,"Не сплачуйте завдаток без перевірки прав на майно."),
E("heir","Самозваний спадкоємець","🎩","forgery",300,1,"disguised_split",0,5,"Спадкові права підтверджують документально."),
E("phisher","Фішер","🎣","cyber",250,1,"phish",0,2,"Не переходьте за підозрілими посиланнями."),
E("hacker","Хакер реєстру","💻","cyber",400,.9,"hack",0,4,"Захищайте облікові дані та ключі доступу."),
E("caller","Фейковий дзвонар","☎️","cyber",220,1.3,"call",0,2,"Перевіряйте вимоги через офіційні канали."),
E("usb","Шкідлива флешка","💾","cyber",80,1.6,"suicide",0,1,"Не підключайте невідомі носії."),
E("briber","Корупціонер з конвертом","💌","corruption",300,.9,"bribe",0,4,"Конфлікт інтересів потребує врегулювання."),
E("conflict","Конфлікт інтересів","🎭","corruption",500,1,"split",0,6,"Повідомляйте про реальний або потенційний конфлікт."),
E("lustrated","Люстрований","🧥","corruption",450,.7,"revive",0,5,"Обмеження для посадовців визначає закон."),
E("alimony","Аліментник-втікач","🧳","debt",340,1.8,"jump",0,3,"Виконавець має законні інструменти впливу на боржника."),
E("burrower","Боржник-невидимка","🕳️","debt",300,1,"burrow",0,3,"Виконавці перевіряють відомості про майно боржника."),
E("bankrupt","Фіктивний банкрут","🎈","debt",200,1,"flying",0,3,"Банкрутство регулює Кодекс з процедур банкрутства."),
E("nonpayer","Боржник за комуналку","🧾","debt",150,.6,"neutral",0,1,"Не кожен боржник є шахраєм: правнича допомога важлива."),
E("golem","Паперовий голем","🗃️","bureaucracy",3000,.5,"giant",0,10,"Цифрові процеси допомагають зменшувати паперову тяганину."),
E("unregistered","Незареєстрований наказ","📃","bureaucracy",250,.8,"haste",0,3,"Перевіряйте, чи потрібна реєстрація нормативного акта."),
E("queue","Черга-змія","🐍","bureaucracy",600,.4,"split",0,5,"Чимало адміністративних послуг доступні онлайн.")
];
export const ENEMY_BY_ID=Object.fromEntries(ENEMIES.map(x=>[x.id,x]));
export const BOSSES=[
{id:"baron",name:"Барон Рейдерон",icon:"🎩",scheme:"forgery",hp:12000,tip:"Захист майна починається з перевірки прав і документів."},
{id:"count",name:"Граф Борговій",icon:"💰",scheme:"debt",hp:15000,tip:"Виконання рішення проводять уповноважені виконавці."},
{id:"octopus",name:"Спрут Конверт",icon:"🐙",scheme:"corruption",hp:12000,tip:"Виявлення та запобігання корупції — важлива частина правопорядку."},
{id:"hydra",name:"Гідра Фішингу",icon:"🐉",scheme:"cyber",hp:23000,tip:"Другий фактор та захист електронного підпису посилюють безпеку."}
];
export const WORLDS=[
{id:"dnipro",name:"Дніпро",subtitle:"Мій дім — моя фортеця",emoji:"🏙️",summary:"Реєстрація, нотаріат, спадщина",enemyIds:["schemer","poa","broker","raider","heir"],titles:["Перший ключ","Черга в ЦНАП","Довіреність із сюрпризом","Дешевий варіант","Знайди підробку","Туман над набережною","Чужа печатка","Шість місяців","Усі разом","Барон Рейдерон"]},
{id:"zaporizhzhia",name:"Запоріжжя",subtitle:"Борг платежем червоний",emoji:"🏭",summary:"Виконання рішень і банкрутство",enemyIds:["schemer","alimony","burrower","bankrupt","nonpayer","golem","queue"],titles:["Заборгованість","Утікач із валізою","Приховане майно","Блекаут","Знайди майно","Виконавча справа","Нічний реєстр","Пошук активів","Велике провадження","Граф Борговій"]},
{id:"kropyvnytskyi",name:"Кропивницький",subtitle:"Чесна служба",emoji:"🏛️",summary:"Запобігання корупції, експертиза",enemyIds:["schemer","briber","conflict","lustrated","unregistered","golem"],titles:["Чесний вибір","Без конвертів","Новий наказ","Експертиза","Липовий експерт","Стажування","Конфлікт інтересів","Нормативний чи індивідуальний?","Прозора служба","Спрут Конверт"]},
{id:"digital",name:"Цифровий фронт",subtitle:"Реєстри під захистом",emoji:"💠",summary:"Фішинг, КЕП, кібергігієна",enemyIds:["schemer","phisher","hacker","caller","usb","queue","unregistered"],titles:["Другий фактор","Збережи ключ","Небезпечний лист","Нічні реєстри","Справжнє чи фейк?","Цифровий офіс","Фішингова атака","Серверна зміна","Зламати схему","Гідра Фішингу"]}
];
// Must match UNITS[].unlock: the result screen announces exactly these cards.
export const UNLOCK_REWARDS={
"1-1":"cnap","1-2":"notary","1-3":"notification","1-4":"mine","1-6":"commission","1-7":"archive","1-8":"senior",
"2-1":"limitation","2-2":"trustee","2-3":"station","2-5":"private_executor","2-7":"notary_office",
"3-1":"integrity","3-2":"order","3-3":"expert","3-5":"intern","3-7":"legal_aid",
"4-1":"shield","4-2":"apostille","4-5":"digital_office"
};
export const MINI_LEVELS={"1-5":"forgery","2-5":"assets","3-8":"acts","4-5":"phishing"};
export const STORY=[
"Родина Коваленків оформила квартиру в Дніпрі, але мережа «СХЕМА» зазіхає на її документи. Сова Юся навчає захищати права.",
"Підприємство родини потребує виконання рішень та чесної процедури стягнення.",
"Оля проходить стажування і допомагає зупинити підозрілі рішення.",
"Шахраї атакують цифрові сервіси. Підготуйте багатошаровий захист!"
];
export const FACTS={
registry:"У реальному житті право власності та відомості про майно перевіряють через встановлені законом процедури й державні реєстри.",
notary:"Нотаріус перевіряє документи та повноваження сторін у межах нотаріальної дії.",
cyber:"Не відкривайте підозрілі посилання. Перевіряйте інформацію лише через офіційний сервіс.",
debt:"Примусове виконання рішень здійснюється у встановленому законом порядку.",
corruption:"Про можливе корупційне порушення можна повідомити через визначені законом канали.",
expert:"Для окремих питань передбачено судову експертизу, яку проводять уповноважені експерти.",
inheritance:"Строки прийняття спадщини та винятки встановлює Цивільний кодекс України.",
aid:"Якщо потрібна правнича допомога, дізнайтеся про право на безоплатну правничу допомогу.",
general:"Це навчальна модель. За юридично значущими рішеннями звертайтеся до офіційних джерел та фахівців."
};
export function levelId(world,stage){return `${world+1}-${stage}`;}
export function getLevel(world,stage){
  const w=WORLDS[world],id=levelId(world,stage),mini=MINI_LEVELS[id]||null,boss=stage===10;
  const special={blackout:((world===1&&[4,7].includes(stage))||(world===3&&stage===4)),fog:((world===0&&stage===6)||(world===3&&stage===8)),deadline:world===0&&stage===8,restricted:world===2&&stage===7};
  const count=stage<5?3:4;
  return {id,world,stage,name:w.titles[stage-1],mini,boss,bossData:boss?BOSSES[world]:null,
  activeLanes:world===0&&stage===1?[2]:world===0&&stage===2?[1,2,3]:special.restricted?[1,2,3]:[0,1,2,3,4],
  enemies:w.enemyIds.slice(0,Math.max(1,Math.min(w.enemyIds.length,Math.ceil(stage/2)+1))),
  waves:count, special,startingSeals:stage===1?225:boss?350:175,
  tutorial:world===0&&stage<=4?["Обери картку захисника, а потім клітинку на полі.","Збирай золоті печатки, щоб ставити більше захисників.","Проти підробок особливо корисні реєстратори й нотаріуси.","Замаскованого маклера виявляє «Сповіщення»."][stage-1]:null};
}
export function unlockedUnits(completed){
 const available=UNITS.filter(u=>u.unlock==="start"||completed[u.unlock]!==undefined);
 // Each next world's signature unit is awarded when the preceding boss is cleared.
 if(completed["1-10"]!==undefined&&!available.some(u=>u.id==="executor"))available.push(UNIT_BY_ID.executor);
 if(completed["2-10"]!==undefined&&!available.some(u=>u.id==="whistleblower"))available.push(UNIT_BY_ID.whistleblower);
 if(completed["3-10"]!==undefined&&!available.some(u=>u.id==="twofactor"))available.push(UNIT_BY_ID.twofactor);
 return available;
}
export function levelUnlocked(world,stage,completed){
 if(world===0&&stage===1)return true;
 if(stage>1)return completed[levelId(world,stage-1)]!==undefined;
 return completed[levelId(world-1,10)]!==undefined;
}
