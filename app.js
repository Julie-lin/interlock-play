// 简体还是繁体，由 index.html 里的加载器决定。必须在最前面：
// EXAMPLE 就在下一行用到它，const 有暂时性死区，声明晚了整个文件都跑不起来。
const traditionalMode=window.SCRIPT_MODE==="trad";
// 混着两字词和三字词，最后「化学」的学回到「学校」的学，正好演示通关
const EXAMPLE=traditionalMode
  ?["學校","消息","系統","通過","國家","家裡","例如","如果說","說實話","化學"]
  :["学校","消息","系统","通过","国家","家里","例如","如果说","说实话","化学"];
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
const BEGINNER_MAX_HSK=4,LEVEL_KEY="endless.level.v1",SCRIPT_KEY="endless.script.v1";
// 切字体要换掉整套词表，运行时替换 2MB 数据不值当，直接重载页面；
// 棋面另存一份，简繁各玩各的，不会串。
function setScript(mode){
  const want=mode==="trad"?"trad":"simp";
  if((window.SCRIPT_MODE||"simp")===want)return;
  try{localStorage.setItem(SCRIPT_KEY,want)}catch{}
  location.reload();
}
let levelMode="intermediate";
function withinLevel(word){
  if(levelMode!=="beginner")return true;
  if(personalWords.has(word))return true;
  const level=hskLevel.get(word);
  return level!==undefined&&level<=BEGINNER_MAX_HSK;
}
function setLevel(mode){
  levelMode=mode==="beginner"?"beginner":"intermediate";
  try{localStorage.setItem(LEVEL_KEY,levelMode)}catch{}
  for(const [id,value] of [["#levelBeginner","beginner"],["#levelIntermediate","intermediate"]]){
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
  setLevel(saved==="beginner"?"beginner":"intermediate");
} // 不在 HSK 里的词往后压，但不排除——生僻不等于不能接

// 三字词只占词表的一成，词频又普遍偏低，纯按分数排几乎永远进不了前六——
// 实测：96% 的位置其实有三字词可接（平均 18 个），却只有 9% 的位置能在前六里
// 看到一个。玩家于是根本遇不到它们，混合长度的意义也就没了。
// 所以给三字词留固定席位，仍从得分最高的里面挑。
function reserveLongWords(list,limit){
  const slots=Math.floor(limit/3);
  // 席位只给排得上号的三字词。留席位是因为三字词得分普遍偏低、几乎进不了前六，
  // 但不该为此把远处的冷僻词拽进来：「照片」后面要到第 26 位才出现三字词
  // 「片麻岩」，硬留席位就把第 5、6 位的「骗人」「骗子」挤了出去。
  // 实测三千个位置，首个三字词的中位位置是 17，超过 24 的占三成——
  // 窗口取 limit 的四倍，七成位置照样有席位，也不会再捞到底下的生僻词。
  const long=list.slice(0,limit*4).filter(word=>word.length>2).slice(0,slots);
  if(!long.length)return list.slice(0,limit);
  const rest=list.filter(word=>!long.includes(word)).slice(0,limit-long.length);
  const keep=new Set([...long,...rest]);
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

const MAX_WORD=3;
function cleanWord(value){return Array.from(value.trim().replace(/[\s，。！？、]/g,"")).slice(0,MAX_WORD).join("")}
function isWord(word){return /^\p{Script=Han}{2,3}$/u.test(word)}
function connectionLabel(a,b){return a===b?a:`${a}/${b}`}

function buildPath(list){
  if(!list.length)return {cells:new Map(),end:{row:0,col:0},maxRow:0,maxCol:0,wordCells:[]};
  const cells=new Map(),wordCells=[],put=(row,col,char,join=false)=>{const key=`${row}-${col}`;if(!cells.has(key))cells.set(key,{chars:[],join:false});const cell=cells.get(key);if(!cell.chars.includes(char))cell.chars.push(char);if(join)cell.join=true};
  let row=0,col=0,maxRow=0,maxCol=0;
  // 每个词从上一个词的末字那一格起步，朝当前方向铺开 length-1 格；
  // 方向逐词横竖交替，所以三字词一次走两格，两字词走一格。
  for(let i=0;i<list.length;i++){
    const word=list[i],down=i%2===1,here=[{row,col}];
    put(row,col,word[0],i>0);
    for(let k=1;k<word.length;k++){
      if(down)row++;else col++;
      put(row,col,word[k]);
      here.push({row,col});
    }
    maxRow=Math.max(maxRow,row);maxCol=Math.max(maxCol,col);
    wordCells.push(here);
  }
  return {cells,end:{row,col},maxRow,maxCol,wordCells};
}

/* ---------- 鱼眼排版 ----------
   链条长了以后整块棋盘会撑破视野。首词和当前词永远保持满格——
   一个是通关要回到的字，一个是接下去的字——中间的格子按剩余空间等比缩小。 */
// 极长的链条上，中间格子会缩成没有字的小方块——路径形状还在，
// 词本身在下面的「接词记录」里照样读得到，首尾两词则始终满格。
const MIN_CELL=12,DOT_BELOW=20;
function fullCell(){return window.innerWidth<=390?54:window.innerWidth<=760?64:78}
function focusTracks(wordCells){
  const rows=new Set(),cols=new Set();
  if(!wordCells.length)return {rows,cols};
  for(const index of new Set([0,wordCells.length-1]))
    for(const cell of wordCells[index]){rows.add(cell.row);cols.add(cell.col)}
  return {rows,cols};
}
// 横竖各算一次能塞下的尺寸，取小的那个当统一边长，缩小的格子才仍是正方形。
function shrunkSize(count,bigCount,available,gap){
  const full=fullCell(),smallCount=count-bigCount;
  if(smallCount<=0)return full;
  const room=available-(count-1)*gap-bigCount*full;
  return Math.max(MIN_CELL,Math.min(full,Math.floor(room/smallCount)));
}
function trackSizes(count,big,small){
  const full=fullCell();
  return Array.from({length:count},(_,i)=>big.has(i)?full:small);
}
function boardSpace(){
  const viewport=$("#boardViewport"),style=getComputedStyle(viewport);
  return {
    width:viewport.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight),
    height:viewport.clientHeight-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom),
  };
}

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
  if(goal&&!shown.some(word=>word[1]===goal)){
    const closer=list.find(word=>word[1]===goal);
    if(closer)shown=[...shown.slice(0,limit-1),closer];
  }
  const chips=shown.map(word=>`<button type="button" class="hint-chip${goal&&word[1]===goal?" closes":""}" data-word="${word}" title="${escapeHtml(tipFor(word))}">${word}</button>`).join("");
  const more=list.length>shown.length||hintsExpanded
    ?zh`<button type="button" id="moreHints" class="more-hints">${hintsExpanded?toTraditional("收起"):`更多（还有 ${list.length-shown.length} 个）`}</button>`:"";
  panel.innerHTML=zh`${chips}${more}<p class="hint-note">点一下填进输入框，再按“接上去”。${goal?`带 ★ 的词能收尾，回到「${goal}」。`:""}</p>`;
}

function render(){
  const {cells,end,maxRow,maxCol,wordCells}=buildPath(words),board=$("#board");board.innerHTML="";
  $("#emptyBoard").hidden=words.length>0;board.hidden=!words.length;
  if(words.length){
    const big=focusTracks(wordCells),space=boardSpace(),gap=maxCol>6?4:6;
    const small=Math.min(
      shrunkSize(maxCol+1,big.cols.size,space.width,gap),
      shrunkSize(maxRow+1,big.rows.size,space.height,gap),
    );
    const colSizes=trackSizes(maxCol+1,big.cols,small),rowSizes=trackSizes(maxRow+1,big.rows,small);
    board.style.gap=`${gap}px`;
    board.style.gridTemplateColumns=colSizes.map(size=>`${size}px`).join(" ");
    board.style.gridTemplateRows=rowSizes.map(size=>`${size}px`).join(" ");
    cells.forEach((data,key)=>{
      const [row,col]=key.split("-").map(Number),cell=document.createElement("div"),size=Math.min(rowSizes[row],colSizes[col]);
      const dot=size<DOT_BELOW;
      cell.className=`cell${data.join?" join":""}${data.chars.length>1?" dual":""}${row===0&&col===0?" start":""}${row===end.row&&col===end.col?" end":""}${size<34?" tiny":""}${dot?" dot":""}`;
      cell.style.gridRow=row+1;cell.style.gridColumn=col+1;
      if(size<46)cell.style.borderWidth=size<26?"1px":"2px";
      if(dot){cell.textContent=""}
      else{cell.style.fontSize=`${Math.round(size*(data.chars.length>1?.34:.46))}px`;cell.textContent=data.chars.join("/")}
      cell.setAttribute("role","gridcell");
      cell.setAttribute("aria-label",data.chars.length>1?zh`${data.chars.join("或")}，同音共格`:data.chars[0]);
      board.appendChild(cell);
    });
  }
  $("#wordCount").textContent=words.length;$("#undoButton").disabled=!words.length;$("#historySection").hidden=!words.length;
  $("#historyCount").textContent=words.length?zh` · 接龙已有 ${words.length} 词`:"";
  $("#history").innerHTML=words.map((word,i)=>`<span class="history-chip${inDict(word)?"":" coined"}"><b data-word="${word}" title="${escapeHtml(tipFor(word))}">${word}<em>${escapeHtml(pinyinOf(word))}</em></b>${i<words.length-1?"<i>→</i>":""}</span>`).join("");
  if(!words.length){
    $("#joinPrompt").innerHTML=zh`<strong>从任意词开始</strong><span>例如：前途、图书馆</span>`;
    $("#turnHint").textContent=toTraditional("先说一个词（两字或三字）");
  }else{
    const last=words.at(-1).at(-1),goal=words[0][0],direction=words.length%2===1?toTraditional("向下"):toTraditional("向右");
    const remaining=nextChoices(words.at(-1),new Set(words)).length;
    $("#joinPrompt").innerHTML=zh`<strong>请用“${last}”或它的同音字开头</strong><span>目标：末字回到「${goal}」 · 下一词将${direction}延伸</span>`;
    $("#turnHint").textContent=remaining?zh`下一步：${direction}（从词表里选择一个可接词）`:zh`下一步：${direction}（常用词表已接不下去）`;
    requestAnimationFrame(()=>{$("#boardViewport").scrollTo({left:$("#boardViewport").scrollWidth,top:$("#boardViewport").scrollHeight,behavior:"smooth"})});
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
  if(!isWord(word)){setMessage(toTraditional("请输入两个或三个汉字。"),"error");return false}
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
  const first=words[0][0],last=word[1];
  if(words.length>1&&last===first){
    $("#turnHint").textContent=toTraditional("首尾相逢，已通关");
    $("#joinPrompt").innerHTML=zh`<strong>末字“${last}”已回到首字</strong><span>这一轮圆满结束，也可以继续接下去</span>`;
    setMessage(zh`末字“${last}”回到了首字，通关！`,"success");
    $("#winSummary").textContent=zh`你用 ${words.length} 个词，从“${first}”出发，又回到了“${last}”。`;
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
const PRONOUNCE_TIMES=3,PRONOUNCE_GAP=900,PRONOUNCE_TIMEOUT=2500,PRONOUNCE_STALL=1500,PRONOUNCE_DELAY=280;
let pronounceOn=true,pronouncing="",pronounceTimer=0,hoverTimer=0;

const synth=("speechSynthesis" in window)?window.speechSynthesis:null;
let zhVoice=null;

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
  if(!synth){setSpeechState("unsupported");$("#speakToggle").disabled=true;return}
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
  const mandarin=voices.filter(v=>/^zh[-_]?CN/i.test(v.lang));
  const pool=mandarin.length?mandarin:voices.filter(v=>/^zh/i.test(v.lang));
  for(const pattern of VOICE_PREFERENCE){
    const hit=pool.find(v=>pattern.test(v.name));
    if(hit){zhVoice=hit;return}
  }
  zhVoice=pool.find(v=>v.localService)||pool[0]||null;
}
if(synth){
  pickVoice();
  synth.addEventListener("voiceschanged",()=>{pickVoice();checkSpeech()});
  // 上一次会话可能把队列留在卡住的状态，开局先清一次
  if(synth.speaking||synth.pending)synth.cancel();
  if(synth.paused)synth.resume();
}

function stopPronounce(){
  clearTimeout(hoverTimer);hoverTimer=0;
  clearTimeout(pronounceTimer);pronounceTimer=0;pronouncing="";
  if(synth&&(synth.speaking||synth.pending))synth.cancel();
}
function startPronounce(word){
  if(!pronounceOn||!synth||!word)return;
  stopPronounce();
  pronouncing=word;
  let said=0;
  const say=()=>{
    if(pronouncing!==word)return; // 鼠标已经移开
    said++;
    if(synth.paused)synth.resume();
    const utterance=new SpeechSynthesisUtterance(word);
    utterance.lang="zh-CN";utterance.rate=.8;
    if(zhVoice)utterance.voice=zhVoice;
    let started=false,moved=false;
    const advance=()=>{
      if(moved)return;
      moved=true;
      clearTimeout(pronounceTimer);
      if(pronouncing===word&&said<PRONOUNCE_TIMES)pronounceTimer=setTimeout(say,PRONOUNCE_GAP);
    };
    utterance.onstart=()=>{started=true;if(speechState==="blocked")setSpeechState("");checkSpeech()};
    utterance.onend=advance;
    utterance.onerror=()=>{moved=true;clearTimeout(pronounceTimer)};
    pronounceTimer=setTimeout(advance,PRONOUNCE_TIMEOUT); // onend 没来也能接着走
    synth.speak(utterance);
    // 万一还是碰上哑掉的语音：1.5 秒没开口就取消，别让它把队列堵死
    setTimeout(()=>{
      if(started)return;
      if(synth.speaking||synth.pending)synth.cancel();
      moved=true;clearTimeout(pronounceTimer);
      setSpeechState("blocked"); // 接受了但没开口 = 被挡住了
    },PRONOUNCE_STALL);
  };
  say();
}

function wireHoverPreview(selector){
  const root=$(selector);
  root.addEventListener("mouseover",event=>{
    const el=event.target.closest("[data-word]");if(!el)return;
    if(el.dataset.word===pronouncing)return; // 同一个词上移动，不要重头念
    const word=el.dataset.word;
    setPreview(word);
    clearTimeout(hoverTimer);
    hoverTimer=setTimeout(()=>startPronounce(word),PRONOUNCE_DELAY);
  });
  root.addEventListener("mouseout",event=>{
    const el=event.target.closest("[data-word]");if(!el)return;
    if(event.relatedTarget&&el.contains(event.relatedTarget))return; // 还在同一个词里面
    setPreview("");stopPronounce();
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
$("#exampleButton").addEventListener("click",()=>{words=[];EXAMPLE.forEach(word=>addWord(word,{silent:true}));setMessage(toTraditional("已加载完整示例：途/徒、型/形、态/太会在共格中显示。"),"success")});
$("#closeWinButton").addEventListener("click",()=>$("#winDialog").close());
$("#scriptSimplified").addEventListener("click",()=>setScript("simp"));
$("#scriptTraditional").addEventListener("click",()=>setScript("trad"));
$("#levelBeginner").addEventListener("click",()=>setLevel("beginner"));
$("#levelIntermediate").addEventListener("click",()=>setLevel("intermediate"));
$("#personalNote").addEventListener("click",event=>{
  if(!event.target.closest("#clearPersonal"))return;
  forgetPersonal();render();setMessage(toTraditional("已清空你自己加的词。"));
});
$("#micButton").addEventListener("click",()=>{listening?stopListening():startListening()});
$("#speakToggle").addEventListener("click",event=>{
  pronounceOn=!pronounceOn;
  event.currentTarget.setAttribute("aria-pressed",String(pronounceOn));
  event.currentTarget.classList.toggle("on",pronounceOn);
  event.currentTarget.textContent=pronounceOn?toTraditional("🔊 发音"):toTraditional("🔇 静音");
  if(!pronounceOn)stopPronounce();
});
$("#voicePanel").addEventListener("click",event=>{
  const chip=event.target.closest(".voice-chip");if(!chip)return;
  addWord(chip.dataset.word);
});

let resizeTimer=0;
window.addEventListener("resize",()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(render,150)});

for(const selector of ["#hintPanel","#voicePanel","#history"])wireHoverPreview(selector);

localiseStaticText();markScriptButtons();initVoice();checkSpeech();restorePersonal();restore();restoreLevel();syncInput();
if(words.length)setMessage(zh`接着上次继续——已有 ${words.length} 个词。`,"success");
