const bingoSection=document.createElement("section");
bingoSection.className="section bingo";
bingoSection.id="bingo";
bingoSection.innerHTML=`
  <div class="section-title"><span>04</span><div><p>LIVE BINGO · 1–100</p><h2>בינגו סקווישי</h2></div></div>
  <div class="bingo-shell">
    <div class="bingo-host" id="bingoHost" hidden>
      <div><span>מצב מארחת</span><h3>גלגל הבינגו</h3><p>לחצי כדי להגריל מספר חדש לכל המסכים.</p></div>
      <div class="bingo-wheel" id="bingoWheel"><strong id="wheelNumber">?</strong></div>
      <div class="host-buttons"><button id="drawBingo">הגרלת מספר</button><button class="secondary" id="resetBingo">איפוס בינגו</button></div>
    </div>
    <div class="bingo-latest"><span>המספר האחרון</span><strong id="latestBingo">—</strong><small id="drawCount">טרם הוגרלו מספרים</small></div>
    <div class="bingo-history" id="bingoHistory"></div>
    <div class="bingo-panel active" id="bingoJoin">
      <div class="game-icon">🎱</div><h3>קבלו לוח בינגו</h3>
      <p>הכניסו שם, סמנו בטלפון רק מספרים שהוגרלו והשלימו שורה, טור או אלכסון.</p>
      <form id="bingoJoinForm"><label for="bingoName">השם שלי</label><input id="bingoName" maxlength="30" autocomplete="name" required placeholder="למשל: נועה"><button type="submit">קבלת לוח</button></form>
      <p class="game-message" id="bingoMessage"></p>
    </div>
    <div class="bingo-panel" id="bingoBoardPanel"><div class="bingo-player"><span>הלוח של</span><strong id="bingoPlayerName"></strong></div><div class="bingo-board" id="bingoBoard"></div><p class="bingo-help">מצאו בעצמכם את המספר החדש. מספר קודם שלא סימנתם יתחיל לזהור כתזכורת ✨</p></div>
    <div class="bingo-panel bingo-winner" id="bingoWinner"><p>🎉 בינגו! 🎉</p><h3 id="bingoWinnerName"></h3><strong>יש לנו זוכה בסקווישי!</strong></div>
  </div>`;
document.querySelector("#rules").before(bingoSection);
document.querySelector("#rules .section-title>span").textContent="05";
const isBingoPage=location.pathname.replace(/\/$/,"")==="/bingo";
if(!isBingoPage)bingoSection.hidden=true;
if(isBingoPage){
  document.body.classList.add("game-route");
  document.querySelectorAll("header,.flow,.games,.cipher,.rules,.finale,footer").forEach(element=>element.hidden=true);
  bingoSection.hidden=false;
  bingoSection.insertAdjacentHTML("afterbegin",`<a class="game-back" href="/${new URLSearchParams(location.search).has("admin")?"?admin=1":""}">← חזרה לכל המשחקים</a>`);
}

const bingoAdmin=new URLSearchParams(location.search).has("admin");
const bingoEls={
  host:document.querySelector("#bingoHost"),join:document.querySelector("#bingoJoin"),
  boardPanel:document.querySelector("#bingoBoardPanel"),winner:document.querySelector("#bingoWinner"),
  board:document.querySelector("#bingoBoard"),history:document.querySelector("#bingoHistory"),
  latest:document.querySelector("#latestBingo"),count:document.querySelector("#drawCount"),
  wheel:document.querySelector("#bingoWheel"),wheelNumber:document.querySelector("#wheelNumber"),
  message:document.querySelector("#bingoMessage")
};
let bingoPlayer=JSON.parse(localStorage.getItem("squishyBingoPlayer")||"null");
let bingoDrawn=[];
let announcedBingoWinner=null;

function bingoShow(name){["join","boardPanel","winner"].forEach(key=>bingoEls[key].classList.toggle("active",key===name))}
function renderBingoBoard(){
  if(!bingoPlayer)return;
  document.querySelector("#bingoPlayerName").textContent=bingoPlayer.name;
  bingoEls.board.innerHTML="";
  const newestMissed=[...bingoDrawn.slice(0,-1)].reverse().find(number=>bingoPlayer.card.includes(number)&&!bingoPlayer.marked.includes(number));
  bingoPlayer.card.forEach(number=>{
    const button=document.createElement("button");
    button.type="button";button.textContent=number;
    const isMarked=bingoPlayer.marked.includes(number);
    const isMissed=bingoDrawn.slice(0,-1).includes(number)&&!isMarked;
    button.className=isMarked?"marked":isMissed?`missed${number===newestMissed?" newest-missed":""}`:"";
    button.disabled=bingoPlayer.marked.includes(number);
    button.addEventListener("click",()=>markBingo(number));
    bingoEls.board.append(button);
  });
}
function renderBingoState(state){
  bingoDrawn=state.drawn||[];
  const latest=bingoDrawn.at(-1);
  bingoEls.latest.textContent=latest||"—";
  bingoEls.count.textContent=bingoDrawn.length?`${bingoDrawn.length} מספרים הוגרלו`:"טרם הוגרלו מספרים";
  bingoEls.history.innerHTML=bingoDrawn.slice(-15).reverse().map(number=>`<span>${number}</span>`).join("");
  if(bingoPlayer&&state.round!==bingoPlayer.round){
    localStorage.removeItem("squishyBingoPlayer");bingoPlayer=null;
    bingoEls.message.textContent="נפתח סבב חדש — קבלו לוח חדש.";bingoShow("join");
  }else if(state.winner){
    document.querySelector("#bingoWinnerName").textContent=state.winner.name;bingoShow("winner");
    if(announcedBingoWinner!==state.winner.name){announcedBingoWinner=state.winner.name;if(typeof burst==="function")burst()}
  }else if(bingoPlayer){renderBingoBoard();bingoShow("boardPanel")}
}
async function bingoApi(body){
  const response=await fetch("/api/bingo",{method:body?"POST":"GET",headers:body?{"Content-Type":"application/json"}:{},body:body?JSON.stringify(body):undefined});
  const data=await response.json();if(!response.ok)throw new Error(data.error||"משהו השתבש");return data;
}
function hostCode(){let code=sessionStorage.getItem("squishyHostCode");if(!code){code=prompt("הכניסי את קוד המארחת")||"";if(code)sessionStorage.setItem("squishyHostCode",code)}return code}

document.querySelector("#bingoJoinForm").addEventListener("submit",async event=>{
  event.preventDefault();bingoEls.message.textContent="מכינים לך לוח...";
  try{bingoPlayer=await bingoApi({action:"join",name:document.querySelector("#bingoName").value});localStorage.setItem("squishyBingoPlayer",JSON.stringify(bingoPlayer));renderBingoBoard();bingoShow("boardPanel")}
  catch(error){bingoEls.message.textContent=error.message}
});
async function markBingo(number){
  try{const result=await bingoApi({action:"mark",name:bingoPlayer.name,round:bingoPlayer.round,number});bingoPlayer.marked=result.marked;localStorage.setItem("squishyBingoPlayer",JSON.stringify(bingoPlayer));renderBingoBoard();if(result.winner)renderBingoState({drawn:bingoDrawn,round:bingoPlayer.round,winner:result.winner})}
  catch(error){alert(error.message)}
}
if(bingoAdmin){
  bingoEls.host.hidden=false;
  document.querySelector("#drawBingo").addEventListener("click",async()=>{
    const code=hostCode();if(!code)return;
    const button=document.querySelector("#drawBingo");button.disabled=true;bingoEls.wheel.classList.add("spinning");
    try{const result=await bingoApi({action:"draw",code});await new Promise(resolve=>setTimeout(resolve,900));bingoEls.wheelNumber.textContent=result.number;renderBingoState({drawn:result.drawn,round:bingoPlayer?.round,winner:null})}
    catch(error){sessionStorage.removeItem("squishyHostCode");alert(error.message)}
    finally{bingoEls.wheel.classList.remove("spinning");button.disabled=false}
  });
  document.querySelector("#resetBingo").addEventListener("click",async()=>{
    const code=hostCode();if(!code||!confirm("לאפס את כל לוחות הבינגו ולפתוח סבב חדש?"))return;
    try{await bingoApi({action:"reset",code});localStorage.removeItem("squishyBingoPlayer");bingoPlayer=null;bingoDrawn=[];announcedBingoWinner=null;bingoEls.wheelNumber.textContent="?";renderBingoState({drawn:[],round:-1,winner:null});bingoShow("join")}
    catch(error){sessionStorage.removeItem("squishyHostCode");alert(error.message)}
  });
}
if(bingoPlayer)bingoShow("boardPanel");
async function pollBingo(){try{renderBingoState(await bingoApi())}catch{}}
pollBingo();setInterval(pollBingo,2000);
