(() => {
"use strict";
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const W=960,H=540, TILE=48, GRAVITY=1900;
const ui = {
  score:document.getElementById("score"), coins:document.getElementById("coins"),
  lives:document.getElementById("lives"), world:document.getElementById("world"),
  overlay:document.getElementById("overlay"), panel:document.getElementById("panel"),
  start:document.getElementById("startBtn"), sound:document.getElementById("soundBtn")
};
let state="menu", last=0, camera=0, score=0, coins=0, lives=3, levelIndex=0, soundOn=true, audioCtx=null;
const keys={left:false,right:false,jump:false};
let jumpQueued=false, jumpBuffer=0, coyoteTime=0, player, platforms=[], coinItems=[], enemies=[], particles=[], goal, levelWidth=0, clouds=[];
const levels=[
 {name:"1-1",width:3300,ground:432, platforms:[[360,340,150],[650,285,145],[940,355,145],[1250,300,145],[1570,345,145],[1900,275,155],[2250,340,150],[2570,285,155],[2860,350,145]], pits:[[780,140],[1740,130],[2400,120]], coins:[[390,300],[438,300],[690,245],[738,245],[980,315],[1028,315],[1290,260],[1338,260],[1610,305],[1658,305],[1940,235],[1988,235],[2290,300],[2338,300],[2610,245],[2658,245],[2900,310]], enemies:[[560,384],[1090,384],[1460,384],[2040,384],[2760,384]]},
 {name:"1-2",width:3900,ground:432, platforms:[[300,340,150],[580,285,150],[900,330,150],[1200,260,150],[1510,320,150],[1810,260,160],[2140,335,150],[2450,280,150],[2760,330,150],[3090,250,160],[3420,320,150]], pits:[[700,120],[1350,130],[1990,120],[2630,120],[3270,120]], coins:[[330,300],[380,300],[620,245],[670,245],[940,290],[990,290],[1240,215],[1290,215],[1550,275],[1600,275],[1850,215],[1900,215],[2180,290],[2230,290],[2490,235],[2540,235],[2800,285],[2850,285],[3130,205],[3180,205],[3460,275]], enemies:[[500,384],[1050,384],[1690,384],[2320,384],[2950,384],[3600,384]]}
];
function resetLevel(){
 const L=levels[levelIndex]; levelWidth=L.width; camera=0;
 platforms=[];
 // Build the floor in separate sections so the marked pits are real gaps.
 let floorCursor=0;
 for(const [pitX,pitW] of [...L.pits].sort((a,b)=>a[0]-b[0])){
  if(pitX>floorCursor) platforms.push({x:floorCursor,y:L.ground,w:pitX-floorCursor,h:108,ground:true});
  floorCursor=pitX+pitW;
 }
 if(floorCursor<L.width) platforms.push({x:floorCursor,y:L.ground,w:L.width-floorCursor,h:108,ground:true});
 for(const [x,y,w] of L.platforms) platforms.push({x,y,w,h:18});
 coinItems=L.coins.map(([x,y])=>({x,y,r:12,taken:false,phase:Math.random()*6}));
 enemies=L.enemies.map(([x,y])=>({x,y,w:34,h:38,vx:-65,alive:true,dir:-1}));
 particles=[]; clouds=Array.from({length:18},(_,i)=>({x:i*240+Math.random()*100,y:45+Math.random()*150,s:.6+Math.random()*.8}));
 player={x:70,y:300,w:34,h:44,vx:0,vy:0,onGround:false,invuln:0,face:1,anim:0};
 goal={x:levelWidth-170,y:L.ground-150};
 ui.world.textContent=L.name;
}
function sound(freq=520,duration=.08,type="square"){
 if(!soundOn)return;
 try{audioCtx=audioCtx||new (window.AudioContext||window.webkitAudioContext)();const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(.07,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+duration);o.connect(g);g.connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+duration);}catch(e){}
}
function rect(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;}
function solidAt(x,y,w,h){return platforms.some(p=>!p.pit&&rect({x,y,w,h},p));}
function burst(x,y,color,n=8){for(let i=0;i<n;i++)particles.push({x,y,vx:(Math.random()-.5)*260,vy:-Math.random()*260,life:.5+Math.random()*.35,color});}
function hurt(){
 if(player.invuln>0)return;
 lives--; ui.lives.textContent=lives; sound(130,.22,"sawtooth"); burst(player.x+16,player.y+20,"#ff704d",14);
 if(lives<=0){endGame(false);return;}
 player.x=Math.max(50,camera+40);player.y=220;player.vx=0;player.vy=0;player.invuln=1.7;
}
function update(dt){
 if(state!=="playing")return;
 const L=levels[levelIndex]; player.anim+=dt*10;
 if(keys.left){player.vx-=1450*dt;player.face=-1;} if(keys.right){player.vx+=1450*dt;player.face=1;}
 if(!keys.left&&!keys.right)player.vx*=Math.pow(.0008,dt);
 player.vx=Math.max(-310,Math.min(310,player.vx));
 // Buffer a touch jump briefly so a tap just before landing is not lost.
 if(jumpQueued) jumpBuffer=0.18;
 jumpQueued=false;
 if(player.onGround) coyoteTime=0.12; else coyoteTime=Math.max(0,coyoteTime-dt);
 jumpBuffer=Math.max(0,jumpBuffer-dt);
 if(jumpBuffer>0 && (player.onGround || coyoteTime>0)){
  player.vy=-690;player.onGround=false;coyoteTime=0;jumpBuffer=0;sound(440,.1);
 }
 player.vy=Math.min(1050,player.vy+GRAVITY*dt);
 let nx=player.x+player.vx*dt;
 if(!solidAt(nx,player.y,player.w,player.h))player.x=nx;else player.vx=0;
 let ny=player.y+player.vy*dt;player.onGround=false;
 if(player.vy>=0){
  const oldBottom=player.y+player.h;
  for(const p of platforms){if(p.pit)continue;if(player.x+player.w>p.x&&player.x<p.x+p.w&&oldBottom<=p.y+8&&ny+player.h>=p.y){ny=p.y-player.h;player.vy=0;player.onGround=true;}}
 } else {
  for(const p of platforms){if(p.pit)continue;if(player.x+player.w>p.x&&player.x<p.x+p.w&&player.y>=p.y+p.h-4&&ny<=p.y+p.h){ny=p.y+p.h;player.vy=80;}}
 }
 player.y=ny;
 // A pit is a gap in the floor, so falling below the world costs a life.
 if(player.y>H+50)hurt();
 player.invuln=Math.max(0,player.invuln-dt);
 for(const c of coinItems){if(!c.taken&&Math.hypot(player.x+player.w/2-c.x,player.y+player.h/2-c.y)<34){c.taken=true;coins++;score+=100;ui.coins.textContent=coins;ui.score.textContent=score;sound(850,.07,"sine");burst(c.x,c.y,"#ffd447",6);}}
 for(const e of enemies){if(!e.alive)continue;e.x+=e.vx*dt;if(e.x<80||e.x>levelWidth-80){e.vx*=-1;}
  if(rect(player,e)){if(player.vy>100&&player.y+player.h-e.y<25){e.alive=false;player.vy=-420;score+=200;ui.score.textContent=score;sound(240,.12);burst(e.x+17,e.y+15,"#a5df58",12);}else hurt();}
 }
 for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=600*dt;p.life-=dt;}particles=particles.filter(p=>p.life>0);
 camera=Math.max(0,Math.min(levelWidth-W,player.x-W*.36));
 if(player.x>goal.x){if(levelIndex<levels.length-1){levelIndex++;score+=500;ui.score.textContent=score;resetLevel();sound(700,.25,"sine");}else endGame(true);}
}
function drawBackground(){
 const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,"#65c8f1");g.addColorStop(1,"#d7f7ff");ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
 for(const c of clouds){let x=(c.x-camera*.25)%(levelWidth+300);if(x<0)x+=levelWidth+300;x-=camera*.0;drawCloud(x-camera*.0,c.y,c.s);}
 // rolling hills
 for(let i=0;i<10;i++){let x=i*390-(camera*.42%390);ctx.fillStyle=i%2?"#78cf72":"#91dc7b";ctx.beginPath();ctx.ellipse(x+120,450,210,110,0,Math.PI,Math.PI*2);ctx.fill();}
}
function drawCloud(x,y,s){ctx.fillStyle="#ffffffdd";ctx.beginPath();ctx.arc(x,y,22*s,0,Math.PI*2);ctx.arc(x+25*s,y-12*s,28*s,0,Math.PI*2);ctx.arc(x+55*s,y,21*s,0,Math.PI*2);ctx.fill();}
function drawPlatform(p){
 let x=p.x-camera;if(x+p.w<0||x>W)return;
 ctx.fillStyle="#9a5b32";ctx.fillRect(x,p.y,p.w,p.h);
 ctx.fillStyle="#64c94f";ctx.fillRect(x,p.y,p.w,9);
 ctx.fillStyle="#b97842";for(let xx=x+8;xx<x+p.w-10;xx+=36){ctx.strokeStyle="#754126";ctx.lineWidth=2;ctx.strokeRect(xx,p.y+16,26,22);}
}
function drawHero(){
 let x=player.x-camera,y=player.y;
 if(player.invuln>0&&Math.floor(performance.now()/90)%2===0)return;
 // boots, body, head, cap; chunky retro sprite
 ctx.fillStyle="#5b3426";ctx.fillRect(x+4,y+34,12,10);ctx.fillRect(x+20,y+34,12,10);
 ctx.fillStyle="#2767bd";ctx.fillRect(x+7,y+23,23,13);ctx.fillRect(x+5,y+17,27,9);
 ctx.fillStyle="#f2b47e";ctx.fillRect(x+8,y+7,23,17);
 ctx.fillStyle="#e34e3d";ctx.fillRect(x+5,y+3,27,8);ctx.fillRect(x+10,y-1,19,6);
 ctx.fillStyle="#fff";ctx.fillRect(x+(player.face>0?23:9),y+11,5,6);
 ctx.fillStyle="#26364c";ctx.fillRect(x+(player.face>0?25:10),y+13,2,3);
 ctx.fillStyle="#6b3828";ctx.fillRect(x+(player.face>0?18:7),y+20,12,4);
}
function drawEnemy(e){let x=e.x-camera;if(x<-50||x>W+50)return;ctx.fillStyle="#7d4a31";ctx.beginPath();ctx.roundRect(x,e.y+8,e.w,e.h-8,9);ctx.fill();ctx.fillStyle="#f4d9a1";ctx.fillRect(x+6,e.y+17,8,9);ctx.fillRect(x+21,e.y+17,8,9);ctx.fillStyle="#26364c";ctx.fillRect(x+9,e.y+20,3,4);ctx.fillRect(x+24,e.y+20,3,4);ctx.fillStyle="#4c2b25";ctx.fillRect(x+3,e.y+e.h-4,12,5);ctx.fillRect(x+21,e.y+e.h-4,12,5);}
function draw(){
 drawBackground();
 ctx.save();ctx.translate(0,0);
 for(const p of platforms)drawPlatform(p);
 // decorative pipes
 for(let x=520;x<levelWidth-200;x+=880){let px=x-camera;if(px>-90&&px<W+90){ctx.fillStyle="#168d54";ctx.fillRect(px,levels[levelIndex].ground-75,58,75);ctx.fillStyle="#32c66e";ctx.fillRect(px-7,levels[levelIndex].ground-80,72,15);ctx.fillStyle="#087244";ctx.fillRect(px+42,levels[levelIndex].ground-70,8,65);}}
 for(const c of coinItems)if(!c.taken){let x=c.x-camera;ctx.save();ctx.translate(x,c.y);ctx.scale(.75+Math.abs(Math.sin(performance.now()/220+c.phase))*.25,1);ctx.fillStyle="#ffd447";ctx.beginPath();ctx.ellipse(0,0,10,14,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle="#d58c1b";ctx.lineWidth=3;ctx.stroke();ctx.fillStyle="#fff2a4";ctx.fillRect(-2,-8,3,7);ctx.restore();}
 for(const e of enemies)if(e.alive)drawEnemy(e);
 // finish flag
 let fx=goal.x-camera;ctx.fillStyle="#71472c";ctx.fillRect(fx,goal.y,8,levels[levelIndex].ground-goal.y);ctx.fillStyle="#ffdb45";ctx.beginPath();ctx.moveTo(fx+8,goal.y+4);ctx.lineTo(fx+78,goal.y+27);ctx.lineTo(fx+8,goal.y+48);ctx.fill();ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(fx+4,goal.y,8,0,Math.PI*2);ctx.fill();
 drawHero();
 for(const p of particles){ctx.globalAlpha=Math.max(0,p.life*2);ctx.fillStyle=p.color;ctx.fillRect(p.x-camera,p.y,6,6);ctx.globalAlpha=1;}
 ctx.restore();
}
function loop(t){let dt=Math.min(.033,(t-last)/1000||0);last=t;update(dt);draw();requestAnimationFrame(loop);}
function start(){if(state==="playing")return;jumpBuffer=0;coyoteTime=0;jumpQueued=false;score=0;coins=0;lives=3;levelIndex=0;ui.score.textContent=score;ui.coins.textContent=coins;ui.lives.textContent=lives;resetLevel();state="playing";ui.overlay.style.display="none";sound(600,.12);}
function endGame(won){state="ended";ui.overlay.style.display="grid";ui.panel.innerHTML=`<h1>${won?"YOU DID IT!":"GAME OVER"}</h1><p>${won?"You cleared every world and reached the star flag!":"Every great adventurer gets another try."}<br><b>Score: ${score}</b><br>Coins collected: ${coins}</p><button class="mainbtn" id="againBtn">PLAY AGAIN</button><p style="font-size:12px;margin-bottom:0">Your best score: ${Math.max(score,Number(localStorage.getItem("starboundBest")||0))}</p>`;let best=Math.max(score,Number(localStorage.getItem("starboundBest")||0));localStorage.setItem("starboundBest",best);document.getElementById("againBtn").onclick=start;}
ui.start.onclick=start;
ui.sound.onclick=()=>{soundOn=!soundOn;ui.sound.textContent=soundOn?"🔊":"🔇";if(soundOn)sound(550,.07);};
function press(k,on){if(k==="jump"&&on)jumpQueued=true;keys[k]=on;document.querySelectorAll(`[data-key="${k}"]`).forEach(b=>b.classList.toggle("down",on));}
document.querySelectorAll("[data-key]").forEach(b=>{
 const k=b.dataset.key;
 const down=e=>{e.preventDefault();if(k==="jump")jumpQueued=true;press(k,true);};
 const up=e=>{if(e)e.preventDefault();press(k,false);};
 b.addEventListener("pointerdown",down,{passive:false});
 b.addEventListener("pointerup",up,{passive:false});
 b.addEventListener("pointercancel",up,{passive:false});
 b.addEventListener("lostpointercapture",up,{passive:false});
 // Touch fallback for mobile Safari.
 b.addEventListener("touchstart",down,{passive:false});
 b.addEventListener("touchend",up,{passive:false});
 b.addEventListener("touchcancel",up,{passive:false});
});
window.addEventListener("keydown",e=>{if(["ArrowLeft","ArrowRight"," ","ArrowUp","w","a","d"].includes(e.key))e.preventDefault();if(e.key==="ArrowLeft"||e.key==="a")press("left",true);if(e.key==="ArrowRight"||e.key==="d")press("right",true);if(e.key===" "||e.key==="ArrowUp"||e.key==="w")press("jump",true);});
window.addEventListener("keyup",e=>{if(e.key==="ArrowLeft"||e.key==="a")press("left",false);if(e.key==="ArrowRight"||e.key==="d")press("right",false);if(e.key===" "||e.key==="ArrowUp"||e.key==="w")press("jump",false);});
document.addEventListener("contextmenu",e=>e.preventDefault());
if("serviceWorker" in navigator && location.protocol.startsWith("http"))window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
resetLevel();requestAnimationFrame(loop);
})();