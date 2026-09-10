// 简体还是繁体，由 index.html 里的加载器决定。放在最前面：
// 下面好些 const 在求值时就要用它，const 有暂时性死区，声明晚了整个文件都跑不起来。
const traditionalMode=window.SCRIPT_MODE==="trad";
const STORAGE_KEY=window.SCRIPT_MODE==="trad"?"endless.chain.t.v1":"endless.chain.v1";
// 候选词默认只给 6 个。这些词本来就故意读音相近（空军 空间 空中 空气……），
// 越像越互相干扰，一次摆十二个反而没人细看，学习者只会扫一眼挑第一个。
// 想要更多的人点「更多」就是了。
const HINT_LIMIT=6,HINT_LIMIT_MORE=12;

/* ---------- 字音表（sounds.js） ---------- */
const soundMap=new Map();
Object.entries(window.SOUND_TABLE||{}).forEach(([syllable,chars])=>{for(const ch of chars){if(!soundMap.has(ch))soundMap.set(ch,new Set());soundMap.get(ch).add(syllable)}});
function readings(char){return soundMap.has(char)?[...soundMap.get(char)]:[]}
function readingLabel(char){const list=readings(char);return list.length?list.join("/"):toTraditional("未知读音")}

/* ---------- 词表（words.js），下标即常用度排名 ---------- */
const rankOf=new Map(),bySound=new Map(),byChar=new Map();
(()=>{const list=(window.WORD_LIST||"").split(" ").filter(Boolean);
list.forEach((word,rank)=>{
  const head=word[0];
  rankOf.set(word,rank);
  if(!byChar.has(head))byChar.set(head,[]);byChar.get(head).push(word);
  for(const syllable of readings(head)){if(!bySound.has(syllable))bySound.set(syllable,[]);bySound.get(syllable).push(word)}
})})();
/* ---------- 界面文字的简繁转换 ----------
   只转界面上的固定文字，不碰词表内容——繁体词表里的字本来就是对的，
   再转一次反而会错（公里 会被转成 公裡）。所以：
     - 静态 HTML 在启动时整体转一遍。那一刻棋盘、候选区、记录区都还是空的，
       扫到的只有界面文字。
     - 动态文字走 zh`` 标签模板：只转字面部分，插进去的词原样保留。
   这张表是按本界面的用法逐字定的。里 一律作「裡」（词表里、这台电脑里），
   后 一律作「後」（接上后），发 一律作「發」（发音）——换了用法就得重新定。 */
const TRAD_UI=(()=>{const packed="万萬与與两兩个個么麼义義书書从從会會体體关關内內几幾别別发發后後听聽图圖圆圓声聲复複头頭将將并並库庫开開异異录錄态態戏戲择擇换換断斷无無显顯权權来來极極标標栏欄横橫汉漢没沒浏瀏游遊满滿点點环環现現电電着著确確简簡约約级級经經结結给給绝絕统統继繼续續脑腦装裝览覽认認记記许許设設识識词詞试試语語误誤说說请請读讀调調轮輪载載输輸过過这這进進连連选選释釋里裡钮鈕银銀错錯阶階难難静靜频頻风風馆館麦麥龙龍",map=new Map();
for(let i=0;i<packed.length;i+=2)map.set(packed[i],packed[i+1]);return map})();
function toTraditional(text){
  if(!traditionalMode)return text;
  let out="";
  for(const ch of text)out+=TRAD_UI.get(ch)??ch;
  return out;
}
// 标签模板：转字面，放过插值
function zh(parts,...values){
  return parts.reduce((out,part,i)=>out+toTraditional(part)+(i<values.length?values[i]:""),"");
}
function localiseStaticText(){
  if(!traditionalMode)return;
  document.title=toTraditional(document.title);
  const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
  const nodes=[];
  for(let node=walker.nextNode();node;node=walker.nextNode())nodes.push(node);
  for(const node of nodes)node.nodeValue=toTraditional(node.nodeValue);
  for(const el of document.querySelectorAll("[placeholder],[title],[aria-label]"))
    for(const attr of ["placeholder","title","aria-label"])
      if(el.hasAttribute(attr))el.setAttribute(attr,toTraditional(el.getAttribute(attr)));
}

/* ---------- 玩家自己的词库 ----------
   词表是词典给的，总有漏网的：「存起来」这种口语里天天用的说法就不在 CC-CEDICT 里。
   玩家确认要用的词，就记进他自己的浏览器，以后不再提示「不在词表里」，
   也会出现在提示候选里。只存在本机，不回传，也不会影响别人的词库。 */
const PERSONAL_KEY="endless.mywords.v1",PERSONAL_RANK=2000;
const personalWords=new Set();
function indexWord(word,rank){
  rankOf.set(word,rank);
  const head=word[0];
  if(!byChar.has(head))byChar.set(head,[]);byChar.get(head).push(word);
  for(const syllable of readings(head)){if(!bySound.has(syllable))bySound.set(syllable,[]);bySound.get(syllable).push(word)}
}
function rememberWord(word){
  if(personalWords.has(word)||rankOf.has(word))return false;
  personalWords.add(word);
  indexWord(word,PERSONAL_RANK);
  try{localStorage.setItem(PERSONAL_KEY,JSON.stringify([...personalWords]))}catch{}
  return true;
}
function restorePersonal(){
  try{
    const raw=localStorage.getItem(PERSONAL_KEY),saved=raw?JSON.parse(raw):null;
    if(!Array.isArray(saved))return;
    for(const word of saved)if(typeof word==="string"&&isWord(word)&&!rankOf.has(word)){
      personalWords.add(word);indexWord(word,PERSONAL_RANK);
    }
  }catch{}
}
function forgetPersonal(){
  for(const word of personalWords){
    rankOf.delete(word);
    const head=word[0];
    if(byChar.has(head))byChar.set(head,byChar.get(head).filter(w=>w!==word));
    for(const syllable of readings(head))
      if(bySound.has(syllable))bySound.set(syllable,bySound.get(syllable).filter(w=>w!==word));
  }
  personalWords.clear();
  try{localStorage.removeItem(PERSONAL_KEY)}catch{}
}
function inDict(word){return rankOf.has(word)}
/* ---------- 候选词的筛选与排序 ----------
   两个坑，都要靠「词的实际读音」来解决，光看单字有几种读音是不够的：

   1. 单字的冷僻读音会放进不相干的词。「合」有 hé 和 gě 两个音，于是
      「合同」被当成能接在「哥哥」后面——可是「合同」里的合念 hé，从来不念 gě。
   2. 不分声调会让高频词淹没真正该出现的词。「同意」的意是 yì，
      而「一个」的一是 yī，同音不同调；一旦按词频排，一个、一般 就把
      意见、意义 全挤出了前十二个。

   所以：用词典给出的整词读音来判断，并按学习顺序分三档——
   先同字，再同音同调，最后同音不同调。 */
// 返回 [[首字读音, 末字读音], ...]——中间的字接词用不到。
// 一个词可能有好几条读音（便宜 bian4 yi2 / pian2 yi5，同行 hang2 / xing2），
// 全都要参与匹配，否则玩家按另一个读音接词会被当成读音不同。
// 音节数跟字数对不上的义项（儿化之类）跳过，它们指不到首末字。
function wordReadings(word){
  const entry=glossOf(word);
  if(!entry)return null;
  const out=[];
  for(const reading of entry.split("|")[0].split(";")){
    const syllables=reading.split(" ").filter(Boolean);
    if(syllables.length===word.length)out.push([syllables[0],syllables.at(-1)]);
  }
  return out.length?out:null;
}
// CC-CEDICT 把 ü 写成 "u:"（nu:3），sounds.js 写成 v（nv）。两边要对得上，
// 否则一边有词典读音、一边只有单字读音时会误判为不同音。
const bareSyllable=syllable=>syllable.replace(/[0-5]$/,"").replace(/u:/g,"v");
// 只要有一边知道整词读音，就用那一边去卡，别退回「两个字各自的所有读音」——
// 那样「呵斥」（hē）会因为「呵」还有个 a 的读音而跟在「啊」后面，
// 「腌制」（yān）同理。自造词没有词典条目，这条路走得最多。
function matchTier(previous,candidate){
  if(candidate[0]===previous.at(-1))return 0; // 同字，最好认
  const before=wordReadings(previous),after=wordReadings(candidate);
  const need=before?before.map(pair=>pair[1]):readings(previous.at(-1));
  const got=after?after.map(pair=>pair[0]):readings(candidate[0]);
  // 多音词逐条试，取最好的一档——玩家按哪条读音接的都算数
  let best=-1;
  for(const left of need)for(const right of got){
    if(bareSyllable(left)!==bareSyllable(right))continue;
    // 两边都查得到整词读音才谈得上分声调；轻声没有调值，按同调算
    const tier=before&&after?(left===right||left.endsWith("5")||right.endsWith("5")?1:2):2;
    if(best<0||tier<best)best=tier;
  }
  return best; // -1 就是在这里根本不同音
}
/* ---------- HSK 词表（hsk.js） ----------
   jieba 的词频来自新闻和书面语料，跟学习者该学的词并不重合：
   「姊妹」在语料里比「姐妹」还高频，「子房」「子嗣」也排得不低。
   HSK 词表正好回答了「这个词值不值得学」，用它给提示排序做一层加权。 */
const hskLevel=new Map();
Object.entries(window.HSK_WORDS||{}).forEach(([level,list])=>{
  for(const word of list.split(" "))if(word)hskLevel.set(word,Number(level));
});
const OFF_SYLLABUS_PENALTY=3000;

/* ---------- 难度 ----------
   初级只从 HSK 1-4 里出候选词（2,400 个，中位数 12 个可接词，够玩）；
   HSK 1-2 试过，中位数只有 3 个，六格的提示区常年填不满，不合适。
   难度只管「提示给什么」，不管「能接什么」——玩家想接更难的词照样接得上，
   自己加的词也一直算数。真要接不下去时会自动放宽，不会把人卡死。 */
const BEGINNER_MAX_HSK=4,LEVEL_KEY="endless.level.v1",SCRIPT_KEY="endless.script.v1",TYPE_KEY="endless.type.v1",RULES_KEY="endless.rules.v1";
// 切字体要换掉整套词表，运行时替换 2MB 数据不值当，直接重载页面；
// 棋面另存一份，简繁各玩各的，不会串。
function setScript(mode){
  const want=mode==="trad"?"trad":"simp";
  if((window.SCRIPT_MODE||"simp")===want)return;
  try{localStorage.setItem(SCRIPT_KEY,want)}catch{}
  location.reload();
}
// 四字词多是成语，词频比三字词还低，摆进初级和中级的提示区只会挤掉真正好接的词。
// 所以单独归到高级档：高级之外不出现在提示里，但任何档位都接得上——
// 难度只管「提示给什么」，不管「能接什么」，这条规则对四字词一视同仁。
const ADVANCED_MIN_LEN=4;
let levelMode="beginner";
function withinLevel(word){
  if(personalWords.has(word))return true; // 自己加的词一直算数，不受档位限制
  if(word.length>=ADVANCED_MIN_LEN&&levelMode!=="advanced")return false;
  if(levelMode!=="beginner")return true;
  const level=hskLevel.get(word);
  return level!==undefined&&level<=BEGINNER_MAX_HSK;
}
/* ---------- 规则是说明书，看完就该收起来 ----------
   六条规则占掉第一屏顶上一大块，可它只在「还不会玩」的那几十秒里有用，
   之后每次打开都在挡路。所以：新玩家进来先摊开，接上第一个词就自动收起——
   接得上就说明已经会了，不用再看。之后每次进来都是收着的，
   想再看点「玩法」两个字随时叫出来。选择记在 localStorage 里。 */
let rulesOpen=true,rulesAuto=false;
function setRulesOpen(open,{persist=true}={}){
  rulesOpen=Boolean(open);
  $("#ruleStrip").hidden=!rulesOpen;
  const toggle=$("#rulesToggle");
  toggle.setAttribute("aria-expanded",String(rulesOpen));
  toggle.textContent=toTraditional(rulesOpen?"收起玩法":"玩法");
  if(persist)try{localStorage.setItem(RULES_KEY,rulesOpen?"1":"0")}catch{}
}
function restoreRules(){
  let saved=null;
  try{saved=localStorage.getItem(RULES_KEY)}catch{}
  // 从没收起过 = 新玩家，留给「接上第一个词」那次自动收起；
  // 但棋面上已经有词了（上次没玩完就关了页面），说明早就会玩，直接收起来。
  rulesAuto=saved===null&&!words.length;
  setRulesOpen(saved!=="0"&&!(saved===null&&words.length),{persist:false});
}

/* ---------- 输入框默认收起 ----------
   第一屏要一眼看懂：给几个词，点一个，接上去。输入框摆在最上面，
   等于先要人想出一个词再动手，比点现成的候选词难得多，
   何况手机上点它还会弹出键盘盖掉半屏。
   但不能真去掉——候选词只给六个（更多十二个），想接表外的词、
   想把自己的词攒进个人词库，都得靠打字。所以收起来，留一个链接随时叫出来。
   叫出来这一下是玩家自己要打字，focus 正是他要的，键盘该弹就弹——
   跟点候选词被动把光标抢走是两回事。 */
let typeOpen=false;
function setTypeOpen(open,{focus=false}={}){
  typeOpen=Boolean(open);
  const input=$("#wordInput"),toggle=$("#typeToggle");
  input.hidden=!typeOpen;
  toggle.setAttribute("aria-expanded",String(typeOpen));
  toggle.textContent=toTraditional(typeOpen?"收起输入框":"自己打一个词");
  try{localStorage.setItem(TYPE_KEY,typeOpen?"1":"0")}catch{}
  if(typeOpen&&focus)input.focus();
  if(!typeOpen){input.value="";syncInput()}
}
function restoreTypeOpen(){
  let saved=null;
  try{saved=localStorage.getItem(TYPE_KEY)}catch{}
  setTypeOpen(saved==="1");
}
const LEVEL_MODES=["beginner","intermediate","advanced"];
function setLevel(mode){
  levelMode=LEVEL_MODES.includes(mode)?mode:"beginner";
  try{localStorage.setItem(LEVEL_KEY,levelMode)}catch{}
  for(const [id,value] of [["#levelBeginner","beginner"],["#levelIntermediate","intermediate"],["#levelAdvanced","advanced"]]){
    const button=$(id);
    button.classList.toggle("on",levelMode===value);
    button.setAttribute("aria-pressed",String(levelMode===value));
  }
  hintsExpanded=false;
  render();
}
function markScriptButtons(){
  for(const [id,value] of [["#scriptSimplified","simp"],["#scriptTraditional","trad"]]){
    const button=$(id),active=(window.SCRIPT_MODE||"simp")===value;
    button.classList.toggle("on",active);
    button.setAttribute("aria-pressed",String(active));
  }
}
function restoreLevel(){
  let saved=null;
  try{saved=localStorage.getItem(LEVEL_KEY)}catch{}
  setLevel(LEVEL_MODES.includes(saved)?saved:"beginner");
} // 不在 HSK 里的词往后压，但不排除——生僻不等于不能接

// 三字词只占词表的一成，词频又普遍偏低，纯按分数排几乎永远进不了前六——
// 实测：96% 的位置其实有三字词可接（平均 18 个），却只有 9% 的位置能在前六里
// 看到一个。玩家于是根本遇不到它们，混合长度的意义也就没了。
// 所以给三字词留固定席位，仍从得分最高的里面挑。
// 四字词得再单独留一个席位，沿用三字词那套会落空。实测三千个位置：
//   可接的位置    三字 97.1%     四字 96.3%（平均 15.6 个）——词是有的
//   裸排进前六    三字 11.0%     四字  2.0%——比三字词还沉，几乎见不到
//   首个的中位位  三字 17        四字 37——limit*4 那个窗口是照着 17 定的
// 所以四字词若跟三字词抢同一批席位，两个席位都会被三字词占走（它们分数更高），
// 高级档等于白选。窗口也得单独放宽：limit*4 只覆盖 27.3% 的位置，
// limit*8 到 59.1%，拽进来的词平均排在第 25 位，还算这一位置上接得上的常用词；
// 再宽（limit*12 → 82.9%，平均第 35 位）就开始捞四十位开外的冷僻成语，不划算。
const LONG_WINDOW=4,FOUR_WINDOW=8;
function reserveLongWords(list,limit){
  const slots=Math.floor(limit/3);
  const picked=[];
  // 高级档先给四字词占一个，不然它永远排不过三字词
  if(levelMode==="advanced"&&slots>0)
    picked.push(...list.slice(0,limit*FOUR_WINDOW).filter(word=>word.length>=4).slice(0,1));
  // 剩下的席位照旧给三字词。初级和中级下 withinLevel 已经把四字词滤掉了，
  // 这里的 length>2 仍然只会挑到三字词，跟原来一模一样。
  const long=list.slice(0,limit*LONG_WINDOW).filter(word=>word.length>2&&!picked.includes(word)).slice(0,slots-picked.length);
  picked.push(...long);
  if(!picked.length)return list.slice(0,limit);
  const rest=list.filter(word=>!picked.includes(word)).slice(0,limit-picked.length);
  const keep=new Set([...picked,...rest]);
  return list.filter(word=>keep.has(word)); // 回到原来的分数顺序，长短混排
}

// 同字优先，但不能盖过常用度。以「子」为例：全表只有十四个子字开头的词，
// 前几个（子女、子弹、子孙）还行，后面就是子房、子嗣、子粒、子代——
// 硬按档次排，这些冷僻词会把自己、自然、资源全挤出候选。
// 所以把档次折成排名上的惩罚：常用的同音词可以反超冷僻的同字词。
const TIER_PENALTY=[0,2500,5000];
function nextChoices(previous,used){
  const char=previous.at(-1),pool=new Set(byChar.get(char)||[]);
  for(const syllable of readings(char))for(const word of bySound.get(syllable)||[])pool.add(word);
  const score=word=>rankOf.get(word)+TIER_PENALTY[matchTier(previous,word)]+
    (hskLevel.has(word)||personalWords.has(word)?0:OFF_SYLLABUS_PENALTY);
  const all=[],atLevel=[];
  for(const word of pool){
    if(used.has(word))continue;
    if(matchTier(previous,word)<0)continue;
    all.push(word);
    if(withinLevel(word))atLevel.push(word);
  }
  // 初级词表接不下去时放宽到全部，宁可给难词也不要给空白。
  // 原来的写法是「一个都没有才放宽」，可真正难受的不是零，是一两个：
  // 「照片」后面初级只有 便宜、片面 两个词，全表其实有 43 个（片刻、骗人、骗子、偏向……），
  // 提示区于是摆两个词空四格。实测三千个位置，完全为零的只有 2.1%，
  // 「有但不够六个」占 22.6%——十倍于前者，却一直没算进这条规则里。
  // 所以不够摆满就从全表往后补，初级词仍然排在最前面。
  atLevel.sort((a,b)=>score(a)-score(b));
  if(atLevel.length>=HINT_LIMIT_MORE)return atLevel;
  const inLevel=new Set(atLevel);
  all.sort((a,b)=>score(a)-score(b));
  return [...atLevel,...all.filter(word=>!inLevel.has(word))];
}
function openers(){
  const source=[...rankOf.keys()].filter(withinLevel);
  const top=(source.length>60?source:[...rankOf.keys()]).slice(0,400),picked=[];
  while(picked.length<HINT_LIMIT&&top.length)picked.push(...top.splice(Math.floor(Math.random()*top.length),1));
  return picked;
}

const $=s=>document.querySelector(s);
let words=[],pendingWord="",hintsOpen=false,hintsExpanded=false;

function save(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(words))}catch{}}
function restore(){try{const raw=localStorage.getItem(STORAGE_KEY),parsed=raw?JSON.parse(raw):null;if(Array.isArray(parsed))words=parsed.filter(word=>typeof word==="string"&&isWord(word))}catch{}}

const MAX_WORD=4;
/* 一轮最多接多少词。收尾（末字回到首字）本来就少见：实测只点提示里的词，
   四十轮内能收尾的不到三成，中位要十七轮——等于这游戏没有一个说得准的结局。
   对学的人来说链子太长，注意力早散了；给长辈玩，接到二十词也该有个交代。
   所以加一个硬上限：接满就收，给一份小结。收尾仍然随时可以提前结束这一轮。 */
const MAX_CHAIN=20;
function cleanWord(value){return Array.from(value.trim().replace(/[\s，。！？、]/g,"")).slice(0,MAX_WORD).join("")}
function isWord(word){return /^\p{Script=Han}{2,4}$/u.test(word)}
function connectionLabel(a,b){return a===b?a:`${a}/${b}`}

/* ---------- 接词记录 ----------
   一度改成按「格」铺开的字链（相接的两个词共用一格，黄底那格就是共用的字）。
   两种都做出来比过之后留下这一种：按词出片，词下面带拼音，中间一个红箭头。
   共格那版把字拆开摆，读起来反而费劲；按词摆，一眼就知道接了哪些词，
   拼音跟着词走，鼠标停上去还能听读音——箭头本身已经把「环环相扣」说清楚了。
   两种写法都会折行，手机上都不用横向滚，这一点上没有取舍。 */

/* 链子上的两个箭头。都用 SVG 画，为的是它们看着像同一支笔画的：
   一样的 stroke-width，一样大的箭头。字符版（→ 和 ↴）做不到这一点——
   ↴ 在多数字体里又细又小，跟 → 摆在一条链子上像是另一个东西。 */
const ARROW='<i class="link" aria-hidden="true"><svg viewBox="0 0 26 16" width="26" height="16"><path d="M2 8h16"/><path d="M12 2l6 6-6 6"/></svg></i>';
const TURN='<i class="turn" aria-hidden="true"><svg viewBox="0 0 26 22" width="26" height="22"><path d="M2 6h16v12"/><path d="M12 12l6 6 6-6"/></svg></i>';

function renderPersonal(){
  const note=$("#personalNote");
  note.hidden=!personalWords.size;
  if(personalWords.size)note.innerHTML=zh`你的词库里有 <b>${personalWords.size}</b> 个自己加的词：${[...personalWords].slice(-8).join("、")}${personalWords.size>8?"…":""}　<button type="button" id="clearPersonal" class="link-button">清空</button>`;
}
/* glosses.js 有 1.5MB，是 async 加载的，开局那一两秒里它还没到。
   没到的时候 wordReadings 一律返回 null，matchTier 只好退回「单字的所有读音」——
   于是「汽车」后面跟出 具有、举行、巨大、俱乐部：「车」除了 chē 还有个 jū 的音
   （象棋里的车），单字匹配就把所有 jù/jū 的词都放了进来。词典到位后会自己变好，
   可玩家看到的第一屏就是错的，比空着还糟。所以要判断读音时先不出提示，
   等 gloss-ready 重新渲染。开局词不用比读音，不受影响。
   万一 glosses.js 根本没加载成功，也不能一直空着——等够久就按单字读音先凑合。 */
let glossGaveUp=false;
const glossesReady=()=>!!window.WORD_GLOSS||glossGaveUp;
setTimeout(()=>{if(!window.WORD_GLOSS){glossGaveUp=true;render()}},8000);

function renderHints(){
  const panel=$("#hintPanel"),button=$("#hintButton"),used=new Set(words);
  const last=words.length?words.at(-1).at(-1):"",goal=words.length?words[0][0]:"";
  const list=words.length?nextChoices(words.at(-1),used):openers();
  button.textContent=words.length?zh`「${last}」能接什么？`:"给我几个开局词";
  button.setAttribute("aria-expanded",String(hintsOpen));
  syncInput();
  if(!hintsOpen){panel.hidden=true;return}
  panel.hidden=false;
  if(words.length&&!glossesReady()){panel.innerHTML=zh`<p class="hint-empty">词表读音还在载入，马上就好。</p>`;return}
  if(!list.length){panel.innerHTML=zh`<p class="hint-empty">常用词表里接不下去了。撤回一步，或自己想一个词硬接。</p>`;return}
  const limit=hintsExpanded?HINT_LIMIT_MORE:HINT_LIMIT;
  let shown=reserveLongWords(list,limit);
  // 能收尾的词一定要看得见——那是这一局的赢法，不该被挤到「更多」里
  if(goal&&!shown.some(word=>word.at(-1)===goal)){
    const closer=list.find(word=>word.at(-1)===goal);
    if(closer)shown=[...shown.slice(0,limit-1),closer];
  }
  const chips=shown.map(word=>`<button type="button" class="hint-chip${goal&&word.at(-1)===goal?" closes":""}" data-word="${word}" title="${escapeHtml(tipFor(word))}">${word}</button>`).join("");
  const more=list.length>shown.length||hintsExpanded
    ?zh`<button type="button" id="moreHints" class="more-hints">${hintsExpanded?toTraditional("收起"):`更多（还有 ${list.length-shown.length} 个）`}</button>`:"";
  panel.innerHTML=zh`${chips}${more}<p class="hint-note">点一下填进输入框，再按“接上去”。${goal?`带 ★ 的词能收尾，回到「${goal}」。`:""}</p>`;
}

/* ---------- 蛇形折行 ----------
   折行以后，一行读到头得把眼睛甩回行首再往下接，链子在视觉上是断的。
   改成蛇形：第一行从左往右，第二行反过来从右往左，第三行又正过来，
   行末拐个弯直接往下接上，线索一路不断。
   做法是量出来的，不是算出来的：先按自然折行摆一遍，用 offsetTop 分行，
   再按行重新包一层，奇数行整行反向（row-reverse）。词片内部也要跟着反，
   否则箭头会指向上一个词那边；箭头本身用 scaleX(-1) 翻个面。
   .board 左右各留了 22px，量的时候就空着，正好给行末那个拐弯箭头，
   包完行不会因为多出个箭头而被挤出去。 */
function snakeRows(board){
  board.classList.remove("snaked");
  const chips=[...board.querySelectorAll(".history-chip")];
  if(chips.length<2)return;
  // 分行看的是 offsetLeft 往回跳，不是 offsetTop 变了。
  // .board 是 align-items:center，同一行里高矮不齐的词片 offsetTop 本来就各不相同，
  // 按 offsetTop 分会把一行拆成好几行；而换行时左边距一定退回行首，这个信号是准的。
  const rows=[];let left=Infinity;
  for(const chip of chips){
    if(chip.offsetLeft<=left){rows.push([])}
    left=chip.offsetLeft;
    rows[rows.length-1].push(chip);
  }
  if(rows.length<2)return; // 一行就摆得下，不用包
  const frag=document.createDocumentFragment();
  rows.forEach((row,i)=>{
    const div=document.createElement("div");
    div.className=`chain-row${i%2?" rtl":""}`;
    for(const chip of row)div.appendChild(chip);
    // 行末那个词的直行箭头去掉——它要接的词在下一行，指向行外没有意义，
    // 换成拐弯箭头来说这件事。两个箭头并排摆着只会让人以为链子分了岔。
    if(i<rows.length-1){
      row.at(-1).querySelector(".link")?.remove();
      div.insertAdjacentHTML("beforeend",TURN);
    }
    frag.appendChild(div);
  });
  board.innerHTML="";board.appendChild(frag);
  board.classList.add("snaked");
}

function render(){
  // 链子一变（接词、撤回、重开、换字体），正在通读的那一遍就不作数了：
  // 念到第几个是按下标记的，词表一换，下标指的已经是另一个词。
  stopReview();
  const board=$("#board");
  $("#emptyBoard").hidden=words.length>0;board.hidden=!words.length;
  const closed=words.length>1&&words.at(-1).at(-1)===words[0][0];
  board.classList.toggle("closed",closed);
  board.innerHTML=words.map((word,i)=>{
    // 收尾了就把第一个词和最后一个词标出来——圆是在这两个词之间合上的
    const ring=closed&&(i===0||i===words.length-1)?" ring-end":"";
    // 同音相接标的是那两个字，不是整个词，也不是箭头。
    // 同字相接一眼就看得出（两个词都写着那个字），同音相接看不出来：
    // 「学校」接「消息」，校和消同音不同字，光看词面只觉得跳了一下。
    // 所以把校和消本身染上颜色——阶梯版里它们本来共用一格，颜色就是那一格。
    const headJoin=i>0&&words[i-1].at(-1)!==word[0];      // 首字是同音接进来的
    const tailJoin=i<words.length-1&&word.at(-1)!==words[i+1][0]; // 末字是同音接出去的
    // 合上圆的那个字要单独标出来。它在链子的两头——第一个词的首字、最后一个词的末字——
    // 前面没有词、后面也没有词，上面那两条只看左右邻居，正好谁都管不到它，
    // 于是整局最该看见的那个字反而一直没颜色。收尾要求末字跟首字是同一个字，
    // 所以它也永远落不进「同音」那一类，得自己占一档。
    const ringHead=closed&&i===0,ringTail=closed&&i===words.length-1;
    const chars=[...word].map((ch,k)=>{
      if((k===0&&ringHead)||(k===word.length-1&&ringTail))return `<span class="ring-char">${escapeHtml(ch)}</span>`;
      const mark=(k===0&&headJoin)||(k===word.length-1&&tailJoin);
      return mark?`<span class="homo-char">${escapeHtml(ch)}</span>`:escapeHtml(ch);
    }).join("");
    // 字面要包成一块。b 是竖排的（字在上、拼音在下），同音字的 <span> 散着放进去
    // 会各占一行，两字词就断成上下两个字——包一层，一个词才是一片。
    const link=i<words.length-1?ARROW:"";
    return `<span class="history-chip${inDict(word)?"":" coined"}${ring}" role="listitem"><b data-word="${word}" title="${escapeHtml(tipFor(word))}"><span class="cs">${chars}</span><em>${escapeHtml(pinyinOf(word))}</em></b>${link}</span>`;
  }).join("");
  snakeRows(board);
  $("#wordCount").textContent=words.length;$("#undoButton").disabled=!words.length;
  syncReviewButton();
  if(!words.length){
    $("#joinPrompt").innerHTML=zh`<strong>从任意词开始</strong><span>例如：前途、图书馆</span>`;
  }else if(closed){
    // 这一句以前只在 addWord 里写，刷新一下就没了：圆明明合上了（首尾两个词都亮着），
    // 提示区却还在催「请用某字开头」。收尾状态是看得出来的，render 自己就能判断。
    $("#joinPrompt").innerHTML=zh`<strong>末字“${words[0][0]}”已回到首字</strong><span>这一轮圆满结束，也可以继续接下去</span>`;
  }else if(words.length>=MAX_CHAIN){
    $("#joinPrompt").innerHTML=zh`<strong>这一轮到此为止</strong><span>接满 ${MAX_CHAIN} 词。按「重新开始」再来一轮</span>`;
  }else{
    // 链条改成折行以后没有「向右/向下」这回事了，方向措辞一并去掉
    const last=words.at(-1).at(-1),goal=words[0][0];
    $("#joinPrompt").innerHTML=zh`<strong>请用“${last}”或它的同音字开头</strong><span>目标：末字回到「${goal}」</span>`;
  }
  renderHints();renderPersonal();save();
}

function setMessage(text,type=""){const el=$("#message");el.textContent=text;el.className=`message ${type}`.trim()}

// 报读音时优先用整词读音：「一个」的「个」念 ge，「合作」的「合」念 hé。
// 直接罗列单字的所有读音会把话说反——「合」的确列着 gě，可那是它单用时的音，
// 不是「合作」里的音，照列出来玩家只会更糊涂。查不到整词才退回单字。
function readingIn(word,head){
  const parts=wordReadings(word);
  if(!parts)return readingLabel(head?word[0]:word.at(-1));
  return [...new Set(parts.map(pair=>head?pair[0]:pair[1]))].map(toneMark).join("/");
}

/* 判断接不接得上，跟出提示用同一条规则（matchTier）：以词典给出的整词读音为准，
   查不到整词才退回单字读音。这里原来用的是 sameSound，只看两个单字的读音集合有没有
   交集——于是「一个」后面接「合作」被悄悄放行：「合」确实有个 gě 音，可「合作」念 hé。
   同一个毛病在提示那边早就修掉了（见上面「候选词的筛选与排序」），接受这边一直没跟上。
   实测三千个位置，74% 都存在这样的词：接得上，却永远不会出现在提示里。
   仍然只是软提醒——玩家点一下就能照接，词典没收全的读音不该由游戏说了算。
   glosses.js 是异步加载的，还没到位时 matchTier 自动退回单字读音，正好等于原来的行为。 */
function problemsFor(word){
  const list=[];
  if(words.includes(word))list.push({hard:true,text:zh`“${word}”这一轮已经用过了，换一个。`});
  if(words.length&&matchTier(words.at(-1),word)<0){
    const previous=words.at(-1);
    list.push({hard:false,kind:"sound",text:zh`“${previous.at(-1)}”（${readingIn(previous,false)}）与“${word[0]}”（${readingIn(word,true)}）读音不同。`});
  }
  if(!inDict(word))list.push({hard:false,kind:"dict",text:zh`“${word}”不在常用词表里。`});
  return list;
}

function addWord(value,{force=false,silent=false}={}){
  const word=cleanWord(value);
  pendingWord="";$("#overrideButton").hidden=true;
  if(!isWord(word)){setMessage(toTraditional("请输入两到四个汉字。"),"error");return false}
  if(words.length>=MAX_CHAIN&&!silent){setMessage(zh`这一轮已经接满 ${MAX_CHAIN} 词，按「重新开始」再来一轮。`,"error");return false}
  if(!silent){
    const problems=problemsFor(word),blocking=problems.filter(problem=>problem.hard);
    if(blocking.length){setMessage(blocking.map(problem=>problem.text).join(""),"error");return false}
    if(problems.length&&!force){
      pendingWord=word;
      const button=$("#overrideButton");
      button.hidden=false;
      button.textContent=problems.length>1?toTraditional("我确定，仍然接上"):problems[0].kind==="sound"?toTraditional("读音相同，仍然接上"):toTraditional("这是个词，仍然接上");
      setMessage(zh`${problems.map(problem=>problem.text).join("")}确认无误就点下面的按钮。`,"error");
      return false;
    }
  }
  const learned=!silent&&!inDict(word)&&rememberWord(word);
  words.push(word);$("#wordInput").value="";clearVoice();hintsExpanded=false;render();syncInput();
  // 接上第一个词就说明已经会玩了，规则条自动收起，之后每次进来都收着
  if(rulesAuto&&words.length===1){rulesAuto=false;setRulesOpen(false)}
  // 收尾看的是「末字」，不是第二个字。word[1] 只有两字词才碰巧是末字——
  // 三字词「图书馆」的末字是馆，四字词更远。用 word[1] 判断，等于三字和四字词
  // 永远收不了尾：★ 不标、不置顶，真接上了也不算通关。
  const first=words[0][0],last=word.at(-1);
  const ringClosed=words.length>1&&last===first;
  if(ringClosed){
    $("#joinPrompt").innerHTML=zh`<strong>末字“${last}”已回到首字</strong><span>这一轮圆满结束，也可以继续接下去</span>`;
    setMessage(zh`末字“${last}”回到了首字，通关！`,"success");
    $("#winKicker").textContent=toTraditional("首尾相逢");
    $("#winTitle").textContent=toTraditional("环环相扣，首尾成圆！");
    $("#winSummary").textContent=zh`你用 ${words.length} 个词，从“${first}”出发，又回到了“${last}”。`;
    $("#winDialog").showModal();
  }else if(words.length>=MAX_CHAIN){
    // 没能成圆，但接满了：也给个了结，不要让它无声无息地一直长下去
    $("#joinPrompt").innerHTML=zh`<strong>这一轮到此为止</strong><span>接满 ${MAX_CHAIN} 词。按「重新开始」再来一轮</span>`;
    setMessage(zh`接满 ${MAX_CHAIN} 词，这一轮结束。`,"success");
    $("#winKicker").textContent=toTraditional("一轮结束");
    $("#winTitle").textContent=zh`接满 ${MAX_CHAIN} 词！`;
    $("#winSummary").textContent=zh`你从“${first}”出发接了 ${words.length} 个词，最后停在“${word}”。这次没能绕回“${first}”，下一轮再试。`;
    $("#winDialog").showModal();
  }else if(!silent){
    const previous=words.length>1?words.at(-2).at(-1):"",join=words.length>1?connectionLabel(previous,word[0]):"";
    setMessage(zh`${words.length===1?`已从“${word}”开始。`:`已接上“${word}”${join.includes("/")?zh`，共格显示“${join}”`:""}。`}${learned?`“${word}”已记进你的词库。`:""}`,"success");
  }
  return true;
}

/* ---------- 语音输入 ---------- */
const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
let recognition=null,listening=false;
function hanziOnly(text){return Array.from(text).filter(ch=>/\p{Script=Han}/u.test(ch)).join("")}

// 语音识别的备选结果本身就多是同音词，正好是这个游戏要的东西：
// 把每条备选切成相邻两字，能接上的、在词表里的排前面。
function voiceCandidates(transcripts){
  const seen=new Set(),used=new Set(words),out=[];
  const need=words.length?words.at(-1):""; // 整个词，matchTier 要靠它查词典读音
  for(const raw of transcripts){
    const text=hanziOnly(raw);
    for(let size=2;size<=MAX_WORD;size++)for(let i=0;i+size<=text.length;i++){
      const word=text.slice(i,i+size);
      if(seen.has(word)||used.has(word))continue;
      seen.add(word);
      // 整句刚好是一个词，说明用户就是在说它；从长句里切出来的只能算候补。
      out.push({word,whole:text.length===size,connects:!need||matchTier(need,word)>=0,known:inDict(word)});
    }
  }
  out.sort((a,b)=>(b.connects-a.connects)||(b.whole-a.whole)||(b.known-a.known)||((rankOf.get(a.word)??1e9)-(rankOf.get(b.word)??1e9)));
  return out.slice(0,6);
}
/* ---------- 英文释义（glosses.js，异步加载） ---------- */
const TONE_MARKS={a:"āáǎà",e:"ēéěè",i:"īíǐì",o:"ōóǒò",u:"ūúǔù",v:"ǖǘǚǜ"};
// CC-CEDICT 用数字标声调（qing2），显示时转成 qíng。
function toneMark(syllable){
  const match=/^([a-zü:]+)([1-5])$/i.exec(syllable);
  if(!match)return syllable;
  const body=match[1].replace(/u:/g,"ü").replace(/v/g,"ü"),tone=Number(match[2]);
  if(tone===5)return body;
  let at=body.indexOf("a");
  if(at<0)at=body.indexOf("o");
  if(at<0)at=body.indexOf("e");
  if(at<0){for(let i=0;i<body.length;i++)if("iouü".includes(body[i]))at=i}
  if(at<0)return body;
  const marks=TONE_MARKS[body[at]==="ü"?"v":body[at]];
  return marks?body.slice(0,at)+marks[tone-1]+body.slice(at+1):body;
}
function glossOf(word){const table=window.WORD_GLOSS;return table&&Object.hasOwn(table,word)?table[word]:null}
const showReading=reading=>reading.split(" ").map(toneMark).join(" ");
// 接词记录里的拼音只给主读音，多音词全列会把那一行撑宽；完整的读音在悬停提示里。
function pinyinOf(word){const entry=glossOf(word);return entry?showReading(entry.split("|")[0].split(";")[0]):""}
function tipFor(word){const entry=glossOf(word);if(!entry)return word;const [pinyin,meaning]=entry.split("|");return `${word}  ${pinyin.split(";").map(showReading).join(" / ")}  ${meaning}`}
/* 念给人听的英文释义。词表里的释义是给眼睛看的，直接丢给语音合成会念出一堆噪音：
   「(idiom)」「CL:个」这种标注、截断留下的省略号、夹在英文里的汉字（英文嗓子念不了）。
   复习时要的是一句干净的意思，所以只取第一个义项，把标注和残渣都去掉。
   有 18 个词整条释义就是一个被截断的括号（「厉害」是其中之一），
   严格清完什么都不剩——那就退一步把括号里的话本身念出来，总好过一声不吭。 */
function speakableSense(sense,keepParens){
  return (keepParens?sense.replace(/[()]/g," "):sense.replace(/\([^)]*\)/g," ").replace(/\([^)]*$/," "))
    .replace(/\bCL:\S*/g," ")      // CC-CEDICT 的量词字段
    .replace(/\u2026/g," ")         // 词表存的是截断过的释义
    .replace(/[\u4e00-\u9fff]/g," ")
    .replace(/\s+([,.;:])/g,"$1")
    .replace(/\s+/g," ").trim()
    .replace(/^[-,:;.]+|[-,:;.]+$/g,"").trim();
}
function spokenGloss(word){
  const entry=glossOf(word);
  if(!entry)return "";
  const senses=(entry.split("|")[1]||"").split(";");
  for(const keepParens of [false,true])
    for(const sense of senses){
      const clean=speakableSense(sense,keepParens);
      if(clean.length>1)return clean; // 长度 1 挡掉清理完只剩一个字母的残渣
    }
  return "";
}
let previewWord="";
function setPreview(word){previewWord=word||"";renderGloss()}
function escapeHtml(text){return text.replace(/[&<>"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[ch]))}
function renderGloss(){
  const box=$("#glossBox"),typed=cleanWord($("#wordInput").value);
  // 鼠标停在哪个词上就先看哪个；否则看输入框；输入框空着就回到刚接上的那个词
  const word=previewWord||(isWord(typed)?typed:words.length?words.at(-1):"");
  const entry=word?glossOf(word):null;
  // 高度是固定的：内容变化不能把下面的按钮顶来顶去
  box.classList.toggle("preview",Boolean(entry&&previewWord));
  if(!entry){
    box.innerHTML=zh`<span class="gloss-idle">指向或选中一个词，这里显示拼音和英文</span>`;
    return;
  }
  const [pinyin,meaning]=entry.split("|");
  box.innerHTML=`<span class="gloss-head"><b>${word}</b><span class="gloss-py">${escapeHtml(pinyin.split(" ").map(toneMark).join(" "))}</span></span>`+
    `<span class="gloss-en">${escapeHtml(meaning)}</span>`;
}
// 释义表是异步来的，到了以后重画一次，chip 上的读音提示才有内容
window.addEventListener("gloss-ready",()=>render());
/* ---------- 悬停发音 ----------
   鼠标停在词上就念出来；不动的话隔一会儿再念，一共三遍，移开立刻停。
   手机上点一下只念一遍，见 TAP_TIMES。

   Chrome 的语音队列很容易卡死，而且是卡在浏览器进程里——刷新页面都救不回来。
   两个已知的坑都要绕开：
     1. 不要 speak 空字符串。空的 utterance 不会触发 onend，整条队列就此堵住。
     2. 不要无条件 cancel()，更不要 cancel() 完马上 speak()。
        只在真的还在说的时候才取消。
   另外 onend 偶尔就是不来，所以每次发音都配一个兜底定时器，
   保证这一轮不会因为等不到 onend 而永远停在那里。 */
// 悬停要先停稳一下再念。鼠标扫过一排候选词时，每经过一个都 cancel() 再 speak()，
// 一秒里十几次——这正是把 Chrome 语音队列搞卡死的那种用法。等 280ms 再开口，
// 路过的词一个都不会触发，真正停下来看的那个才念。
// GLOSS_GAP 是中文和它英文释义之间的停顿。这两句要黏成一句话——
// 隔到 PRONOUNCE_GAP 那么远，听着就是两件不相干的事，而不是同一个词的两面。
// 手指点一下只念一遍：点是「我要听这个词」，听清了就想接着走；
// 三遍会拖住手，还压着后面的操作。鼠标悬停照旧三遍——停着不动本来就是在记读音。
const PRONOUNCE_TIMES=3,TAP_TIMES=1,PRONOUNCE_GAP=900,GLOSS_GAP=260,PRONOUNCE_TIMEOUT=2500,PRONOUNCE_STALL=1500,PRONOUNCE_DELAY=280;
/* pronounceRun 是这一轮朗读的编号。以前队列靠「pronouncing 还是不是这个词」往下走，
   通读一遍时不够用：停下再从同一个词开始，旧队列认不出自己已经作废，会跟新队列抢着念。
   改成每次开口发一个新编号，编号一变，上一轮的定时器和回调全部自己失效。 */
let pronouncing="",pronounceTimer=0,hoverTimer=0,pronounceRun=0;

const synth=("speechSynthesis" in window)?window.speechSynthesis:null;
let zhVoice=null,enVoice=null;

/* ---------- 朗读是否真的能用 ----------
   语音接口「看起来正常」和「真的出声」是两回事：浏览器报告 speaking=true，
   onstart 却永远不来——装了占用语音接口的扩展（密码管理器之类）时就是这样，
   而且它会影响所有网站，不只这个游戏。用户听不到声音又看不到任何提示，
   只会以为游戏坏了。所以这里主动检查，并把原因和出路直接写在界面上。 */
const SPEECH_HELP={
  unsupported:{
    zh:"这个浏览器不能朗读。换成 Chrome、Edge 或 Safari 就可以。",
    en:"This browser can't read words aloud. Chrome, Edge or Safari will.",
  },
  novoice:{
    zh:"这台电脑没有装中文语音，所以读不出来。到系统设置里加一个中文语音就行。",
    en:"No Chinese voice is installed on this computer. Add one in your system settings.",
  },
  blocked:{
    zh:"这个浏览器现在发不出声音。用 Safari 或 Edge 打开通常就好了；如果装过浏览器插件，关掉再试也行。游戏其他部分都能照常玩。",
    en:"No sound is coming from this browser. Opening the page in Safari or Edge usually fixes it, and so does turning off browser add-ons. Everything else still works.",
  },
};
let speechState="";
function setSpeechState(state){
  if(speechState===state)return;
  speechState=state;
  const note=$("#speechNote"),help=SPEECH_HELP[state];
  note.hidden=!help;
  note.innerHTML=help?`${escapeHtml(toTraditional(help.zh))}<em>${escapeHtml(help.en)}</em>`:"";
}
function checkSpeech(){
  if(!synth){setSpeechState("unsupported");return}
  if(speechState==="blocked")return; // 已经确认发不出声，别被语音列表覆盖掉
  const voices=synth.getVoices();
  // 列表是异步来的，空的时候还说不准，等 voiceschanged
  setSpeechState(voices.length&&!voices.some(v=>/^zh/i.test(v.lang))?"novoice":"");
}

// 必须指定发音人：只给 lang="zh-CN" 时 Safari 会拿默认的英文嗓子去念中文，
// onstart/onend 都正常触发，但根本听不到声音。所以要自己挑一个。
// 挑的顺序也有讲究——不能闭着眼睛拿列表里第一个 zh-CN，
// macOS 报给浏览器的两百多个语音里混着不少只有名字、没下载数据的。
// 婷婷是 macOS 上最老牌、最稳的普通话发音人，优先用它。
const VOICE_PREFERENCE=[/ting.?ting|婷婷/i,/li-?mu|yu-?shu|sin-?ji|mei-?jia/i];
function pickVoice(){
  if(!synth)return;
  const voices=synth.getVoices();
  if(!voices.length)return; // Chrome 异步加载，等 voiceschanged 再挑
  pickEnVoice(voices);
  const mandarin=voices.filter(v=>/^zh[-_]?CN/i.test(v.lang));
  const pool=mandarin.length?mandarin:voices.filter(v=>/^zh/i.test(v.lang));
  for(const pattern of VOICE_PREFERENCE){
    const hit=pool.find(v=>pattern.test(v.name));
    if(hit){zhVoice=hit;return}
  }
  zhVoice=pool.find(v=>v.localService)||pool[0]||null;
}
/* 英文发音人。只有接词记录里念释义用得上，挑法比中文松——英文是浏览器的母语，
   默认那把嗓子基本都能用。仍然先挑本机语音：云端语音要联网，慢，断网时是哑的。
   下面几个是 macOS 上装机就有、一直能出声的。 */
const EN_VOICE_PREFERENCE=[/^(samantha|alex|daniel|karen|moira)\b/i];
function pickEnVoice(voices){
  const english=voices.filter(v=>/^en/i.test(v.lang));
  const pool=english.filter(v=>/^en[-_]?(US|GB)/i.test(v.lang));
  const from=pool.length?pool:english;
  for(const pattern of EN_VOICE_PREFERENCE){
    const hit=from.find(v=>pattern.test(v.name));
    if(hit){enVoice=hit;return}
  }
  enVoice=from.find(v=>v.localService)||from[0]||null;
}
if(synth){
  pickVoice();
  synth.addEventListener("voiceschanged",()=>{pickVoice();checkSpeech()});
  // 上一次会话可能把队列留在卡住的状态，开局先清一次
  if(synth.speaking||synth.pending)synth.cancel();
  if(synth.paused)synth.resume();
}

function stopPronounce(){
  pronounceRun++;
  clearTimeout(hoverTimer);hoverTimer=0;
  clearTimeout(pronounceTimer);pronounceTimer=0;pronouncing="";
  if(synth&&(synth.speaking||synth.pending))synth.cancel();
}
function startPronounce(word,english="",times=PRONOUNCE_TIMES,onDone=null){
  if(!synth||!word)return;
  stopPronounce();
  const run=pronounceRun;
  pronouncing=word;
  /* 这一轮要说的话先排成一张单子。中文照旧念 PRONOUNCE_TIMES 遍，
     英文释义只跟在第一遍后面念一次：意思听一遍就懂了，后面那两遍是在记读音——
     多念几遍本来就是为了记读音，每遍都带上释义只会把人听烦。 */
  const plan=[];
  for(let i=0;i<times;i++){
    plan.push({text:word,lang:"zh-CN",rate:.8,gap:english&&!i?GLOSS_GAP:PRONOUNCE_GAP});
    if(english&&!i)plan.push({text:english,lang:"en-US",rate:.95,gap:PRONOUNCE_GAP});
  }
  let step=0;
  const say=()=>{
    if(run!==pronounceRun)return; // 鼠标已经移开，或者这一轮被叫停了
    const item=plan[step++];
    if(!item)return;
    const chinese=item.lang==="zh-CN";
    if(synth.paused)synth.resume();
    // 手机上开局那一下 getVoices() 常常还是空的，voiceschanged 也不一定来过，
    // zhVoice 于是留在 null。上面说过，Safari 拿不到指定发音人就用默认英文嗓子念中文，
    // onstart/onend 全都正常，就是没声音。真要开口之前再挑一次，这时列表通常已经到了。
    if(!zhVoice)pickVoice();
    const utterance=new SpeechSynthesisUtterance(item.text);
    utterance.lang=item.lang;utterance.rate=item.rate;
    const voice=chinese?zhVoice:enVoice;
    if(voice)utterance.voice=voice;
    let started=false,moved=false;
    /* 这一句说完了，接着往下走。三条路都汇到这里——正常的 onend、出错、以及
       onend 迟迟不来时的兜底定时器——moved 保证只走一次：
       停顿检查里那句 cancel() 自己会引出一个 onerror，不挡住就会走两次。
       carryOn 为假表示这一句是出了问题才结束的，那就别再念这个词剩下的遍数了，
       但仍然要叫 onDone：通读一遍全靠它往下走，不叫的话会停在这里不动，
       按钮一直显示「停下」，看着像卡死了。 */
    const finish=carryOn=>{
      if(moved)return;
      moved=true;
      clearTimeout(pronounceTimer);
      if(run!==pronounceRun)return;
      if(carryOn&&step<plan.length)pronounceTimer=setTimeout(say,item.gap);
      else if(onDone)onDone();
    };
    utterance.onstart=()=>{started=true;if(speechState==="blocked")setSpeechState("");checkSpeech()};
    utterance.onend=()=>finish(true);
    utterance.onerror=()=>finish(false);
    // onend 没来也能接着走。兜底时间要跟着话的长短走：一句英文释义比一个词长得多，
    // 按固定的 2.5 秒算，长句子还没说完下一句就压上来了。
    pronounceTimer=setTimeout(()=>finish(true),Math.max(PRONOUNCE_TIMEOUT,900+item.text.length*120));
    synth.speak(utterance);
    // 万一还是碰上哑掉的语音：1.5 秒没开口就取消，别让它把队列堵死
    setTimeout(()=>{
      if(started||run!==pronounceRun)return;
      // 只有中文哑了才算「这个浏览器发不出声」。英文是附带的那一句，
      // 它不出声多半只是挑到了一个没数据的英文发音人，
      // 不该把整个界面变成「发不出声音」的红字——中文明明还念得好好的。
      // 这一句要赶在 finish 之前：通读一遍在 onDone 里看这个状态决定还要不要往下走。
      if(chinese)setSpeechState("blocked"); // 接受了但没开口 = 被挡住了
      if(synth.speaking||synth.pending)synth.cancel();
      finish(false);
    },PRONOUNCE_STALL);
  };
  say();
}

/* ---------- 通读一遍 ----------
   从第一个词走到最后一个，每个词念一遍中文再念一遍英文，念到哪个词就把哪个词圈出来。
   跟悬停不一样，这里每个词只念一遍：悬停是停在一个词上不走，多念几遍是给人记读音的；
   通读是一路往下走，每个词念三遍，一条二十个词的链子要念上两三分钟，没人听得完。

   随时可以停：再点一次按钮、往链子里加词、撤回、重开，都算停。
   停下来靠的是 stopPronounce 里那个编号——已经排在定时器里的下一句会自己作废。 */
const REVIEW_GAP=520; // 两个词之间的停顿，比一个词内部中英文之间的 GLOSS_GAP 长，断句才听得出来
let reviewAt=-1,reviewTimer=0;
const reviewing=()=>reviewAt>=0;

function paintReview(){
  const chips=[...$("#board").querySelectorAll(".history-chip")];
  chips.forEach((chip,i)=>chip.classList.toggle("reading",i===reviewAt));
  // 链子长了会折出好几行，念到的词可能在看不见的地方，带着视线走过去
  if(reviewing()&&chips[reviewAt])chips[reviewAt].scrollIntoView({block:"nearest",behavior:"smooth"});
}
function syncReviewButton(){
  const button=$("#reviewButton");
  // 没有语音就没有「通读」这回事，按钮干脆不出现，省得点了没反应。
  // 工具条里只剩这一个按钮了，它一藏，整条工具条跟着收起来——
  // 手机上那条空边框白占一截，而屏幕上方本来就挤。
  button.hidden=!synth||!words.length;
  $("#boardToolbar").hidden=button.hidden;
  button.classList.toggle("running",reviewing());
  button.textContent=toTraditional(reviewing()?"停下":"通读一遍");
}
function stopReview(){
  if(!reviewing())return;
  reviewAt=-1;
  clearTimeout(reviewTimer);reviewTimer=0;
  stopPronounce();
  setPreview("");
  paintReview();syncReviewButton();
}
function stepReview(){
  if(!reviewing())return;
  if(reviewAt>=words.length){stopReview();return}
  const word=words[reviewAt];
  setPreview(word); // 注释框跟着走，听到的和看到的是同一个词
  paintReview();
  startPronounce(word,spokenGloss(word),1,()=>{
    // 一个词都没能出声，说明这个浏览器根本发不出声音（上面那段停顿检查判的）。
    // 再往下走也只是二十次沉默，不如就此停下，让人看见旁边那条说明。
    if(!reviewing()||speechState==="blocked"){stopReview();return}
    reviewAt++;
    reviewTimer=setTimeout(stepReview,REVIEW_GAP);
  });
}
function toggleReview(){
  if(reviewing()){stopReview();return}
  if(!synth||!words.length)return;
  reviewAt=0;
  syncReviewButton();
  stepReview();
}

function wireHoverPreview(selector,withEnglish=false){
  const root=$(selector);
  const speak=(word,times)=>startPronounce(word,withEnglish?spokenGloss(word):"",times);
  /* 通读进行时，鼠标从链子上扫过不该抢话——正念着的词会被半路掐掉，
     圈出来的词和听到的词也就对不上了。三个入口都让通读优先。 */
  root.addEventListener("mouseover",event=>{
    if(reviewing())return;
    const el=event.target.closest("[data-word]");if(!el)return;
    if(el.dataset.word===pronouncing)return; // 同一个词上移动，不要重头念
    const word=el.dataset.word;
    setPreview(word);
    clearTimeout(hoverTimer);
    hoverTimer=setTimeout(()=>speak(word),PRONOUNCE_DELAY);
  });
  root.addEventListener("mouseout",event=>{
    if(reviewing())return;
    const el=event.target.closest("[data-word]");if(!el)return;
    if(event.relatedTarget&&el.contains(event.relatedTarget))return; // 还在同一个词里面
    setPreview("");stopPronounce();
  });
  /* 手机和平板上一个字也念不出来，原因有两条，缺一条都还是哑的：
     一是上面这套 mouseover/mouseout 触屏根本不触发，没有「悬停」这回事；
     二是就算补个 mouseover，iOS 只认用户手势里同步发出的 speak()，
     而 hover 那条要等 280ms（PRONOUNCE_DELAY），回调跑起来时手势上下文早没了，
     speak() 被静悄悄丢掉——不报错，也不出声，最难查的那种。
     所以触屏单独走一条：手指抬起就念，不延时。延时本来是为了防鼠标扫过一排候选词
     时反复 cancel()+speak() 把 Chrome 的队列搞卡（见 PRONOUNCE_DELAY 那段），
     手指点的是哪个就是哪个，不存在扫过去的问题，不需要等。
     pointerup 里 startPronounce 会先把 pronouncing 设成这个词，
     随后 iOS 补发的那串合成鼠标事件走到 mouseover 时会被那句同词判断挡掉，不会重念。 */
  root.addEventListener("pointerup",event=>{
    if(event.pointerType==="mouse")return; // 鼠标照旧走 hover，那条路更细致
    if(reviewing())return;
    const el=event.target.closest("[data-word]");if(!el)return;
    setPreview(el.dataset.word);
    speak(el.dataset.word,TAP_TIMES);
  });
}

function syncInput(){$("#submitButton").hidden=!hintsOpen&&!$("#wordInput").value.trim();renderGloss()}
function clearVoice(){$("#voicePanel").hidden=true;$("#voicePanel").innerHTML=""}
function showHeard(transcripts){
  const panel=$("#voicePanel"),list=voiceCandidates(transcripts);
  panel.hidden=false;
  const raw=transcripts.map(hanziOnly).filter(Boolean).join("、")||toTraditional("（没听清）");
  if(!list.length){
    panel.innerHTML=zh`<p class="voice-heard">听到：${raw}</p><p class="hint-note">没找到能用的词，再说一次试试。</p>`;
    return;
  }
  panel.innerHTML=zh`<p class="voice-heard">听到：${raw} — 点一个确认</p>`+
    list.map(item=>zh`<button type="button" class="voice-chip${item.connects?"":" offbeat"}" data-word="${item.word}" title="${escapeHtml(tipFor(item.word))}">${item.word}${item.known?"":"<i>生词</i>"}</button>`).join("")+
    zh`<p class="hint-note">接不上的词标成灰色，选它需要再确认一次。</p>`;
}
function startListening(){
  const demo=new URLSearchParams(location.search).get("demo");
  if(demo){showHeard(demo.split("|"));return}
  if(!SpeechRecognition)return;
  recognition?.abort();
  recognition=new SpeechRecognition();
  recognition.lang="zh-CN";recognition.interimResults=false;recognition.maxAlternatives=5;
  listening=true;
  $("#micButton").classList.add("listening");$("#micLabel").textContent=toTraditional("在听……再点一下停");
  setMessage(toTraditional("我在听——说一个词。"));
  recognition.onresult=event=>{
    const transcripts=[];
    for(let i=0;i<event.results.length;i++){
      const result=event.results[i];
      for(let j=0;j<result.length;j++)transcripts.push(result[j].transcript);
    }
    showHeard(transcripts);
  };
  recognition.onerror=event=>{
    setMessage(event.error==="not-allowed"?toTraditional("浏览器没拿到麦克风权限，请在地址栏允许后重试。"):event.error==="no-speech"?toTraditional("没听到声音，再说一次。"):zh`语音识别出错：${event.error}`,"error");
  };
  recognition.onend=()=>{listening=false;$("#micButton").classList.remove("listening");$("#micLabel").textContent=toTraditional("说一个词")};
  recognition.start();
}
function stopListening(){recognition?.stop();listening=false}
function initVoice(){
  const supported=Boolean(SpeechRecognition)||new URLSearchParams(location.search).has("demo");
  $("#micButton").disabled=!supported;
  if(!supported)$("#micLabel").textContent=toTraditional("此浏览器不支持语音");
  $("#voiceNote").hidden=supported;
}

$("#wordForm").addEventListener("submit",event=>{event.preventDefault();addWord($("#wordInput").value)});
$("#wordInput").addEventListener("input",event=>{if(!event.isComposing)event.target.value=cleanWord(event.target.value);syncInput()});
$("#wordInput").addEventListener("compositionend",event=>{event.target.value=cleanWord(event.target.value);syncInput()});
$("#overrideButton").addEventListener("click",()=>{if(pendingWord)addWord(pendingWord,{force:true})});
$("#hintButton").addEventListener("click",()=>{hintsOpen=!hintsOpen;renderHints()});
/* 点候选词不再把光标送进输入框。原来点完就 focus，手指点的时候虚拟键盘会从屏幕下方
   弹起，盖住候选区和它下面的「接上去」——选完词还得先收键盘才能确认，白多一步。
   试过按设备类型区分（媒体查询、pointerdown 的 pointerType），都不对：iPad 接上
   触控板就报 hover:hover + pointer:fine，跟桌面分不开；而且光标跳走这件事本身，
   在鼠标上一样让人措手不及——选词和确认是两步，中间不需要谁抢焦点。
   于是一律不 focus。回车那条捷径由下面的兜底补回来。 */
$("#hintPanel").addEventListener("click",event=>{
  if(event.target.closest("#moreHints")){hintsExpanded=!hintsExpanded;renderHints();return}
  const chip=event.target.closest(".hint-chip");if(!chip)return;
  for(const other of $("#hintPanel").querySelectorAll(".hint-chip.selected"))other.classList.remove("selected");
  chip.classList.add("selected");
  $("#wordInput").value=chip.dataset.word;syncInput();
  setMessage(zh`选了“${chip.dataset.word}”，按下面的“接上去”确认。`);
});
/* 光标不再进输入框，回车就没法提交了——焦点不在表单里，submit 事件根本不触发。
   这里补一条兜底，把这条捷径接回来。
   候选词按钮单独处理：鼠标点过之后焦点多半还留在那颗按钮上（Chrome 如此），
   这时按回车走浏览器默认行为只是把同一个词再选一遍，永远提交不了。
   所以看它选中没有——输入框里已经是这个词，就当「确认」提交；
   还不是（键盘 Tab 过来第一次按），就让默认行为把它选进输入框。
   于是键盘路径是：Tab 到候选词，回车选中，再回车接上去。
   其余输入框、链接、对话框一概不抢，那些地方回车各有各的意思。 */
document.addEventListener("keydown",event=>{
  if(event.key!=="Enter"||event.isComposing||event.metaKey||event.ctrlKey||event.altKey||event.shiftKey)return;
  const target=event.target,chip=target?.closest?.(".hint-chip");
  if(!chip&&target?.closest?.("input,textarea,select,button,a,summary,dialog,[contenteditable]"))return;
  if(chip&&chip.dataset.word!==$("#wordInput").value.trim())return;
  if($("#submitButton").hidden||!$("#wordInput").value.trim())return;
  event.preventDefault();addWord($("#wordInput").value);
});
$("#undoButton").addEventListener("click",()=>{if(!words.length)return;const removed=words.pop();$("#winDialog").close();render();setMessage(zh`已撤回“${removed}”。`)});
$("#restartButton").addEventListener("click",()=>{words=[];pendingWord="";$("#wordInput").value="";syncInput();$("#overrideButton").hidden=true;$("#winDialog").close();render();setMessage(toTraditional("已重新开始。"))});
$("#reviewButton").addEventListener("click",toggleReview);
// 正在念的时候按 Esc 就停——一屋子人听着，总得有个一眼看得见的退路
document.addEventListener("keydown",event=>{if(event.key==="Escape"&&reviewing())stopReview()});
// 切到别的标签页时把话停下。浏览器不会替我们停，回来时它还在自说自话
document.addEventListener("visibilitychange",()=>{if(document.hidden)stopReview()});
$("#closeWinButton").addEventListener("click",()=>$("#winDialog").close());
$("#scriptSimplified").addEventListener("click",()=>setScript("simp"));
$("#scriptTraditional").addEventListener("click",()=>setScript("trad"));
$("#levelBeginner").addEventListener("click",()=>setLevel("beginner"));
$("#levelIntermediate").addEventListener("click",()=>setLevel("intermediate"));
$("#levelAdvanced").addEventListener("click",()=>setLevel("advanced"));
$("#typeToggle").addEventListener("click",()=>setTypeOpen(!typeOpen,{focus:true}));
$("#rulesToggle").addEventListener("click",()=>{rulesAuto=false;setRulesOpen(!rulesOpen)});
$("#personalNote").addEventListener("click",event=>{
  if(!event.target.closest("#clearPersonal"))return;
  forgetPersonal();render();setMessage(toTraditional("已清空你自己加的词。"));
});
$("#micButton").addEventListener("click",()=>{listening?stopListening():startListening()});
$("#voicePanel").addEventListener("click",event=>{
  const chip=event.target.closest(".voice-chip");if(!chip)return;
  addWord(chip.dataset.word);
});

// 蛇形分行是量出来的，窗口一变行就不一样了，得重新摆
let resizeTimer=0;
window.addEventListener("resize",()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(render,150)});

/* 接词记录里念完中文接着念英文：那里是回头复习已经接上的词，读音和意思该一起过一遍，
   而且释义本来就显示在旁边的注释框里，听到的和看到的对得上。
   候选词和语音识别结果只念中文——那两处是在挑下一个词，
   每指一个就多听一句英文，挑的节奏全被拖住了。 */
for(const selector of ["#hintPanel","#voicePanel"])wireHoverPreview(selector);
wireHoverPreview("#board",true);

localiseStaticText();markScriptButtons();initVoice();checkSpeech();restorePersonal();restore();restoreLevel();restoreTypeOpen();restoreRules();syncInput();
if(words.length)setMessage(zh`接着上次继续——已有 ${words.length} 个词。`,"success");
