const canvas = document.querySelector("#confetti");
const ctx = canvas.getContext("2d");
let pieces = [];
function resize(){canvas.width=innerWidth;canvas.height=innerHeight}
addEventListener("resize",resize);resize();
function burst(){pieces=Array.from({length:180},()=>({x:innerWidth/2,y:innerHeight*.45,vx:(Math.random()-.5)*18,vy:-Math.random()*15-5,g:.25+Math.random()*.15,r:3+Math.random()*7,c:["#ff2bd6","#22dcff","#97ff45","#ff9b28","#fff"][Math.floor(Math.random()*5)],a:1}));requestAnimationFrame(draw)}
function draw(){ctx.clearRect(0,0,canvas.width,canvas.height);pieces.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=p.g;p.a-=.006;ctx.globalAlpha=Math.max(0,p.a);ctx.fillStyle=p.c;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.y*.02);ctx.fillRect(-p.r,-p.r,p.r*2,p.r);ctx.restore()});pieces=pieces.filter(p=>p.a>0&&p.y<innerHeight+30);if(pieces.length)requestAnimationFrame(draw)}
document.querySelectorAll("#partyButton,#finalButton").forEach(b=>b.addEventListener("click",burst));
document.querySelector("#partyButton").addEventListener("click",()=>document.querySelector(".games").scrollIntoView({behavior:"smooth"}));

const gameGrid=document.querySelector(".games .cards");
const cipherCard=[...gameGrid.querySelectorAll("article")].find(card=>card.querySelector("h3")?.textContent==="כתב סתרים");
const bingoCard=document.createElement("article");
bingoCard.innerHTML='<i>07</i><div class="icon">🎱</div><h3>בינגו סקווישי</h3><p>לוח אישי בטלפון והגרלה חיה של מספרים מ־1 עד 100.</p>';
gameGrid.append(bingoCard);
[[cipherCard,"/cipher"],[bingoCard,"/bingo"]].forEach(([card,url])=>{
  card.classList.add("game-link");card.tabIndex=0;card.setAttribute("role","link");
  card.addEventListener("click",()=>location.href=url);
  card.addEventListener("keydown",event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();location.href=url}});
});

const gamePath=location.pathname.replace(/\/$/,"");
const isCipherPage=gamePath==="/cipher";
if(!isCipherPage)document.querySelector("#cipher").hidden=true;
if(isCipherPage){
  document.body.classList.add("game-route");
  document.querySelectorAll("header,.flow,.games,.rules,.finale,footer").forEach(element=>element.hidden=true);
  document.querySelector("#cipher").insertAdjacentHTML("afterbegin",'<a class="game-back" href="/">← חזרה לכל המשחקים</a>');
}

const panels={join:document.querySelector("#joinPanel"),puzzle:document.querySelector("#puzzlePanel"),winner:document.querySelector("#winnerPanel")};
const joinForm=document.querySelector("#joinForm");
const answerForm=document.querySelector("#answerForm");
const joinMessage=document.querySelector("#joinMessage");
const answerMessage=document.querySelector("#answerMessage");
document.querySelector("#joinPanel>p").textContent="הכניסו שם ופתרו את כתב החידה. הראשונ/ה לפתור יזכו בסקווישי הנכסף!";
let player=JSON.parse(localStorage.getItem("squishyPlayer")||"null");
const isAdmin=new URLSearchParams(location.search).has("admin");
if(isAdmin){
  document.body.classList.add("admin-mode");
  document.querySelector(".game-shell").insertAdjacentHTML("afterbegin",'<aside class="admin-console"><div><span>מצב מארחת</span><strong>לוח ניהול המשחק</strong><small id="adminStatus">המשחק פעיל</small></div></aside>');
}
function showPanel(name){Object.entries(panels).forEach(([key,panel])=>panel.classList.toggle("active",key===name))}
function showPlayer(data){player=data;localStorage.setItem("squishyPlayer",JSON.stringify(data));document.querySelector("#cardNumber").textContent=`כרטיס ${String(data.card).padStart(2,"0")}`;document.querySelector("#playerGreeting").textContent=`בהצלחה, ${data.name}!`;document.querySelector("#cipherText").textContent=data.cipher;document.querySelector("#symbolKey").innerHTML=data.key.map(item=>`<span><b>${item.symbol}</b><i>=</i><strong>${item.letter}</strong></span>`).join("");showPanel("puzzle")}
function showWinner(winner){document.querySelector("#winnerName").textContent=winner.name;showPanel("winner");burst()}
async function api(body){const response=await fetch("/api/game",{method:body?"POST":"GET",headers:body?{"Content-Type":"application/json"}:{},body:body?JSON.stringify(body):undefined});const data=await response.json();if(!response.ok)throw new Error(data.error||"משהו השתבש");return data}
joinForm.addEventListener("submit",async event=>{event.preventDefault();joinMessage.textContent="מגרילים לך כרטיס...";const button=joinForm.querySelector("button");button.disabled=true;try{showPlayer(await api({action:"join",name:document.querySelector("#playerName").value}))}catch(error){joinMessage.textContent=error.message}finally{button.disabled=false}});
answerForm.addEventListener("submit",async event=>{event.preventDefault();answerMessage.textContent="בודקים...";try{const result=await api({action:"submit",name:player.name,round:player.round,answer:document.querySelector("#answerInput").value});if(result.winner)showWinner(result.winner)}catch(error){answerMessage.textContent=error.message}});
const resetButton=document.querySelector("#resetGame");
if(isAdmin){resetButton.hidden=false;resetButton.textContent="איפוס המשחק ופתיחת סבב חדש";document.querySelector(".admin-console").append(resetButton)}
resetButton.addEventListener("click",async()=>{const code=prompt("הכניסי את קוד המארחת");if(!code)return;try{await api({action:"reset",code});localStorage.removeItem("squishyPlayer");player=null;document.querySelector("#playerName").value="";joinMessage.textContent="המשחק אופס. כולם יכולים להגריל כרטיס חדש.";showPanel("join");const status=document.querySelector("#adminStatus");if(status)status.textContent="סבב חדש נפתח ✓"}catch(error){alert(error.message)}});
async function checkWinner(){try{const state=await api();if(player&&state.round!==player.round){localStorage.removeItem("squishyPlayer");player=null;document.querySelector("#answerInput").value="";joinMessage.textContent="נפתח סבב חדש — הגרילו כרטיס מחדש.";showPanel("join")}else if(state.winner&&!panels.winner.classList.contains("active"))showWinner(state.winner)}catch{}}
if(player?.name&&player?.cipher&&player?.key)showPlayer(player);
checkWinner();setInterval(checkWinner,2000);
