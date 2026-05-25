import { useState, useEffect, useRef } from "react";

function load(key, fb) {
  try { const v=localStorage.getItem(key); return v?JSON.parse(v):fb; } catch(e) { return fb; }
}
function save(key, v) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch(e) {}
}

function playChime(){
  try{
    const ac=new(window.AudioContext||window.webkitAudioContext)();
    const freqs=[523.25,659.25,783.99,1046.5]; // C5 E5 G5 C6
    freqs.forEach((f,i)=>{
      const o=ac.createOscillator();
      const g=ac.createGain();
      o.connect(g);g.connect(ac.destination);
      o.type='sine';o.frequency.value=f;
      const start=ac.currentTime+i*0.10;
      g.gain.setValueAtTime(0,start);
      g.gain.linearRampToValueAtTime(0.18,start+0.02);
      g.gain.exponentialRampToValueAtTime(0.001,start+0.45);
      o.start(start);o.stop(start+0.5);
    });
  }catch(e){}
}

function requestDailyReminder(){
  if(!('Notification' in window))return;
  if(Notification.permission==='default'){
    Notification.requestPermission().then(perm=>{
      if(perm==='granted') scheduleDailyCheck();
    });
  } else if(Notification.permission==='granted'){
    scheduleDailyCheck();
  }
}

function scheduleDailyCheck(){
  const today=new Date().toISOString().slice(0,10);
  const hist=JSON.parse(localStorage.getItem('tint_hist3')||'[]');
  const todayLogged=hist.some(h=>h.date===today&&h.allDone);
  if(!todayLogged){
    const now=new Date();
    const evening=new Date(now);
    evening.setHours(21,0,0,0);
    const ms=evening-now;
    if(ms>0&&ms<86400000){
      setTimeout(()=>{
        new Notification('TINT — Log your tasks!',{
          body:"Don't break your streak. Log today's tasks now.",
          icon:'/favicon.ico',
        });
      },ms);
    }
  }
}

function projectedRank(streak, missedDays) {
  if (missedDays>=14) return 3500; if (missedDays>=7) return 2500;
  if (missedDays>=5)  return 2000; if (missedDays>=3) return 1500;
  if (missedDays>=2)  return 1000; if (missedDays>=1) return 750;
  if (streak>=14) return 51; if (streak>=10) return 51;
  if (streak>=7)  return 65; if (streak>=3)  return 80;
  return 300;
}

function flameStyle(streak) {
  if (streak>=30) return {c1:"#22C55E",c2:"#4ADE80",glow:"rgba(34,197,94,0.75)",label:"green"};
  if (streak>=22) return {c1:"#A855F7",c2:"#C084FC",glow:"rgba(168,85,247,0.75)",label:"purple"};
  if (streak>=15) return {c1:"#3B82F6",c2:"#60A5FA",glow:"rgba(59,130,246,0.75)",label:"blue"};
  if (streak>=8)  return {c1:"#EF4444",c2:"#F87171",glow:"rgba(239,68,68,0.75)", label:"red"};
  if (streak>=4)  return {c1:"#F97316",c2:"#FB923C",glow:"rgba(249,115,22,0.75)",label:"orange"};
  return           {c1:"#FBBF24",c2:"#FDE68A",glow:"rgba(251,191,36,0.65)", label:"yellow"};
}
// flameStyle kept for AllDonePopup ambient glow usage

const EXAM_TASKS = {
  UCEED:[
    {emoji:"✏️",title:"Sketching practice",        cat:"drawing", dur:45,repeat:"daily"},
    {emoji:"🎨",title:"Colour theory exercise",    cat:"drawing", dur:30,repeat:"daily"},
    {emoji:"🧩",title:"Visual reasoning MCQs",     cat:"aptitude",dur:40,repeat:"daily"},
    {emoji:"📐",title:"Perspective drawing",       cat:"drawing", dur:30,repeat:"daily"},
    {emoji:"📓",title:"Design observation journal",cat:"theory",  dur:20,repeat:"daily"},
    {emoji:"📷",title:"Photography / composition", cat:"theory",  dur:20,repeat:"weekday"},
    {emoji:"🔢",title:"Math & logical reasoning",  cat:"aptitude",dur:40,repeat:"daily"},
    {emoji:"🚶",title:"Morning walk / movement",   cat:"health",  dur:30,repeat:"daily"},
  ],
  NID:[
    {emoji:"✏️",title:"Sketching & rendering",     cat:"drawing", dur:60,repeat:"daily"},
    {emoji:"🎨",title:"Color & composition study", cat:"drawing", dur:30,repeat:"daily"},
    {emoji:"🧩",title:"Design aptitude MCQs",      cat:"aptitude",dur:45,repeat:"daily"},
    {emoji:"📐",title:"3D form & perspective",     cat:"drawing", dur:40,repeat:"daily"},
    {emoji:"📓",title:"Product design journal",    cat:"theory",  dur:20,repeat:"daily"},
    {emoji:"🔍",title:"Material & texture study",  cat:"theory",  dur:20,repeat:"weekday"},
    {emoji:"💡",title:"Creative thinking exercises",cat:"aptitude",dur:30,repeat:"daily"},
    {emoji:"🚶",title:"Morning walk / movement",   cat:"health",  dur:30,repeat:"daily"},
  ],
  NIFT:[
    {emoji:"✏️",title:"Fashion illustration",            cat:"drawing", dur:60,repeat:"daily"},
    {emoji:"🎨",title:"Fabric & texture rendering",      cat:"drawing", dur:30,repeat:"daily"},
    {emoji:"🧩",title:"Situation test practice",         cat:"aptitude",dur:45,repeat:"daily"},
    {emoji:"📐",title:"Garment construction sketching",  cat:"drawing", dur:40,repeat:"daily"},
    {emoji:"📓",title:"Fashion trend research",          cat:"theory",  dur:25,repeat:"daily"},
    {emoji:"📷",title:"Visual merchandising study",      cat:"theory",  dur:20,repeat:"weekday"},
    {emoji:"🔢",title:"General ability practice",        cat:"aptitude",dur:35,repeat:"daily"},
    {emoji:"🚶",title:"Morning walk / movement",         cat:"health",  dur:30,repeat:"daily"},
  ],
  JEE:[
    {emoji:"⚛️",title:"Physics — mechanics",        cat:"aptitude",dur:60,repeat:"daily"},
    {emoji:"🧪",title:"Chemistry — organic",        cat:"aptitude",dur:50,repeat:"daily"},
    {emoji:"📐",title:"Mathematics — calculus",     cat:"aptitude",dur:60,repeat:"daily"},
    {emoji:"🔬",title:"Physics — electrostatics",   cat:"aptitude",dur:45,repeat:"daily"},
    {emoji:"⚗️",title:"Chemistry — inorganic",      cat:"aptitude",dur:40,repeat:"daily"},
    {emoji:"🔢",title:"Mathematics — algebra",      cat:"aptitude",dur:50,repeat:"daily"},
    {emoji:"📓",title:"Revision & formula notes",   cat:"theory",  dur:30,repeat:"daily"},
    {emoji:"🚶",title:"Morning walk / movement",    cat:"health",  dur:30,repeat:"daily"},
  ],
};

const AVATARS = [
  "🦁","🐯","🦊","🐺","🦅","🐉","⚡","🌟","🎭","🎨",
  "🏆","💎","🌙","☀️","🌊","🔥","🌿","🎯","🚀","👁️",
  "🦋","🌺","🎸","🔮","⚔️","🦄","🌈","🎠","🧠","⭐",
];

const CAT_COLORS = {
  drawing: {bg:"rgba(139,92,246,0.15)",border:"rgba(139,92,246,0.35)",text:"#A78BFA"},
  aptitude:{bg:"rgba(56,189,248,0.12)", border:"rgba(56,189,248,0.3)", text:"#38BDF8"},
  theory:  {bg:"rgba(251,191,36,0.12)", border:"rgba(251,191,36,0.3)", text:"#FBBF24"},
  health:  {bg:"rgba(34,197,94,0.12)",  border:"rgba(34,197,94,0.3)",  text:"#4ADE80"},
};

const LB_DATA = [
  {name:"Ananya R.", streak:24,rank:42, done:95,avatar:"🎯"},
  {name:"Priya M.",  streak:15,rank:78, done:82,avatar:"🖌️"},
  {name:"Arjun K.",  streak:12,rank:103,done:76,avatar:"📐"},
  {name:"Rhea T.",   streak:10,rank:127,done:71,avatar:"🎨"},
  {name:"Dev P.",    streak:8, rank:189,done:65,avatar:"🌿"},
  {name:"Ishaan C.", streak:6, rank:234,done:58,avatar:"🔢"},
  {name:"Meera V.",  streak:5, rank:312,done:52,avatar:"📷"},
];

const CSS = `
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Inter',system-ui,-apple-system,sans-serif;overflow:hidden;}
.app-screen{height:100vh;height:100dvh;}
.nav-safe{padding-bottom:max(16px,env(safe-area-inset-bottom));}

@keyframes orbDrift{
  0%,100%{transform:translate(0,0);}
  33%{transform:translate(20px,-15px);}
  66%{transform:translate(-15px,20px);}
}
.cover-orb1{position:absolute;width:600px;height:600px;border-radius:50%;
  background:radial-gradient(circle,rgba(99,102,241,0.15),transparent 70%);
  top:-200px;left:-200px;animation:orbDrift 8s ease-in-out infinite;}
.cover-orb2{position:absolute;width:500px;height:500px;border-radius:50%;
  background:radial-gradient(circle,rgba(139,92,246,0.1),transparent 70%);
  bottom:-150px;right:-150px;animation:orbDrift 12s ease-in-out infinite reverse;}
.cover-orb3{position:absolute;width:300px;height:300px;border-radius:50%;
  background:radial-gradient(circle,rgba(34,197,94,0.08),transparent 70%);
  top:40%;left:40%;animation:orbDrift 10s ease-in-out infinite 2s;}
.grid{position:absolute;inset:0;pointer-events:none;
  background-image:linear-gradient(rgba(255,255,255,0.02) 1px,transparent 1px),
    linear-gradient(90deg,rgba(255,255,255,0.02) 1px,transparent 1px);
  background-size:40px 40px;}
.scanlines{position:absolute;inset:0;pointer-events:none;
  background:repeating-linear-gradient(0deg,transparent,transparent 2px,
    rgba(0,0,0,0.03) 2px,rgba(0,0,0,0.03) 4px);}
.star{position:absolute;border-radius:50%;background:white;pointer-events:none;}
@keyframes twinkle{0%,100%{opacity:0.06;transform:scale(1);}50%{opacity:0.5;transform:scale(1.4);}}
.s1{animation:twinkle 3.2s ease-in-out infinite;}
.s2{animation:twinkle 4.1s ease-in-out infinite 1.2s;}
.s3{animation:twinkle 2.7s ease-in-out infinite 0.5s;}
.s4{animation:twinkle 3.8s ease-in-out infinite 2s;}
@keyframes spinOrbit{from{transform:rotate(0deg);}to{transform:rotate(360deg);}}
.orbit{animation:spinOrbit 30s linear infinite;}
.glow-bar{height:2px;border-radius:2px;
  background:linear-gradient(90deg,transparent,rgba(99,102,241,0.8),rgba(139,92,246,0.6),transparent);}

@keyframes containerSpin{
  0%  {transform:rotate(0deg)   scale(1);}
  25% {transform:rotate(90deg)  scale(0.92);}
  50% {transform:rotate(180deg) scale(1);}
  75% {transform:rotate(270deg) scale(0.92);}
  100%{transform:rotate(360deg) scale(1);}
}
@keyframes quoteIn{from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:translateY(0);}}
@keyframes dotWave{
  0%,80%,100%{transform:translateY(0);opacity:0.5;}
  40%         {transform:translateY(-9px);opacity:1;}
}
@keyframes slideUp{from{opacity:0;transform:translateY(14px);}to{opacity:1;transform:translateY(0);}}
@keyframes checkBounce{0%{transform:scale(0);}60%{transform:scale(1.3);}80%{transform:scale(0.9);}100%{transform:scale(1);}}
@keyframes flashRed{0%{opacity:0;}30%{opacity:1;}100%{opacity:0;}}
@keyframes rankIn{from{opacity:0;transform:translateX(-12px);}to{opacity:1;transform:translateX(0);}}
.rank-row{animation:rankIn 0.4s ease both;}
.task-card{transition:transform 0.15s ease,box-shadow 0.15s ease;}
.task-card:hover{transform:scale(0.99);}

/* ── Flame — canvas-based (see FlameIcon component) ── */

/* ── Water fill ── */
@keyframes waterRise{
  0%,100%{transform:translateY(0)    scaleX(1);}
  33%    {transform:translateY(-3px) scaleX(1.03);}
  66%    {transform:translateY(-1px) scaleX(0.98);}
}

/* ── WeekBar scroll ── */
.weekbar-scroll::-webkit-scrollbar{display:none;}
.weekbar-scroll{-ms-overflow-style:none;scrollbar-width:none;}

/* ── Flame trail / all-done cinematic ── */
@keyframes trailSweep{
  0%  {transform:translateX(-110%);opacity:0;}
  8%  {opacity:1;}
  92% {opacity:1;}
  100%{transform:translateX(110%);opacity:0;}
}
@keyframes trailSweepBack{
  0%  {transform:translateX(110%);opacity:0;}
  8%  {opacity:1;}
  92% {opacity:1;}
  100%{transform:translateX(-110%);opacity:0;}
}
@keyframes flameFormIn{
  0%  {transform:scale(0.05) rotate(-15deg);opacity:0;filter:blur(28px);}
  45% {transform:scale(1.55) rotate(4deg); opacity:1; filter:blur(6px);}
  72% {transform:scale(0.92) rotate(-2deg);filter:blur(1px);}
  100%{transform:scale(1)    rotate(0deg); opacity:1; filter:blur(0);}
}
@keyframes glowRing{
  0%  {transform:scale(0.4);opacity:0.9;}
  100%{transform:scale(4);  opacity:0;}
}
@keyframes contentReveal{
  from{opacity:0;transform:translateY(22px);}
  to  {opacity:1;transform:translateY(0);}
}

@keyframes breatheCircle{
  0%,100%{transform:scale(1);opacity:0.6;}
  40%    {transform:scale(1.35);opacity:1;}
  60%    {transform:scale(1.35);opacity:1;}
}
@keyframes flamePlay{
  0%{opacity:1;}
  16.66%{opacity:0;}
  100%{opacity:0;}
}
.fl-f1{animation:flamePlay 0.6s steps(1) infinite;animation-delay:0.0s;}
.fl-f2{animation:flamePlay 0.6s steps(1) infinite;animation-delay:0.1s;}
.fl-f3{animation:flamePlay 0.6s steps(1) infinite;animation-delay:0.2s;}
.fl-f4{animation:flamePlay 0.6s steps(1) infinite;animation-delay:0.3s;}
.fl-f5{animation:flamePlay 0.6s steps(1) infinite;animation-delay:0.4s;}
.fl-f6{animation:flamePlay 0.6s steps(1) infinite;animation-delay:0.5s;}
@keyframes breatheText{
  0%,100%{opacity:0.5;}
  20%    {opacity:1;content:'Breathe in...';}
  50%    {opacity:0.8;}
}

@keyframes shake{
  0%,100%{transform:translateX(0);}
  20%    {transform:translateX(-4px);}
  40%    {transform:translateX(4px);}
  60%    {transform:translateX(-3px);}
  80%    {transform:translateX(3px);}
}
.shaking{animation:shake 0.4s ease both;}

@keyframes revealUp{from{opacity:0;transform:translateY(20px);}to{opacity:1;transform:translateY(0);}}
@keyframes fadeIn{from{opacity:0;}to{opacity:1;}}
@keyframes fadeInUp{from{opacity:0;transform:translateY(30px);}to{opacity:1;transform:translateY(0);}}

@keyframes floatUp{
  0%{transform:translateY(0) scale(1);opacity:0.85;}
  100%{transform:translateY(-110vh) scale(0.2);opacity:0;}
}
@keyframes pulseGlow{
  0%,100%{transform:scale(1);opacity:0.4;}
  50%{transform:scale(1.2);opacity:0.85;}
}
@keyframes flamePop{
  0%,100%{transform:scale(1);}
  50%{transform:scale(1.08);}
}
@keyframes btnPress{
  0%{transform:scale(1);}
  40%{transform:scale(0.94);}
  100%{transform:scale(1);}
}
.btn-pressed{animation:btnPress 0.2s ease forwards;}

.avatar-scroll::-webkit-scrollbar{display:none;}
.avatar-scroll{-ms-overflow-style:none;scrollbar-width:none;}

::-webkit-scrollbar{width:3px;}
::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:4px;}
input:focus{outline:none;border-color:rgba(99,102,241,0.6)!important;}
`;

function useCSS() {
  useEffect(()=>{
    const el=document.createElement("style");
    el.textContent=CSS;
    document.head.appendChild(el);
    return ()=>document.head.removeChild(el);
  },[]);
}

function Confetti({x,y}){
  const SHAPES=['circle','square','star','ribbon'];
  const CC2=["#FF6B6B","#FFE66D","#4ECDC4","#A29BFE","#FD79A8","#FDCB6E","#6C5CE7","#00CEC9","#55EFC4","#FFF"];
  const [pieces]=useState(()=>Array.from({length:40},(_,i)=>({
    id:i,
    color:CC2[i%CC2.length],
    shape:SHAPES[i%SHAPES.length],
    angle:(i/40)*360+Math.random()*20,
    speed:Math.random()*6+4,
    size:Math.random()*8+4,
    rot:Math.random()*360,
    rotSpeed:(Math.random()-0.5)*15,
    wobble:Math.random()*Math.PI*2,
  })));
  const [tick,setTick]=useState(0);
  useEffect(()=>{
    let raf,t=0;
    const go=()=>{t++;setTick(t);if(t<55)raf=requestAnimationFrame(go);};
    raf=requestAnimationFrame(go);
    return()=>cancelAnimationFrame(raf);
  },[]);
  const prog=Math.min(tick/55,1);
  return(
    <div style={{position:"fixed",left:x,top:y,pointerEvents:"none",zIndex:999}}>
      {pieces.map(p=>{
        const rad=p.angle*Math.PI/180;
        const dist=p.speed*prog*22;
        const px=Math.cos(rad)*dist+Math.sin(p.wobble+tick*0.1)*prog*8;
        const py=Math.sin(rad)*dist-prog*42+prog*prog*30;
        const alpha=Math.max(0,1-prog*1.2);
        if(p.shape==='ribbon'){
          return <div key={p.id} style={{
            position:"absolute",width:p.size*0.5,height:p.size*2,
            background:p.color,left:px,top:py,opacity:alpha,
            transform:`rotate(${p.rot+tick*p.rotSpeed}deg) skewX(${Math.sin(tick*0.15)*20}deg)`,
            borderRadius:2,boxShadow:`0 0 4px ${p.color}`,
          }}/>;
        }
        if(p.shape==='star'){
          return <div key={p.id} style={{
            position:"absolute",left:px,top:py,opacity:alpha,
            fontSize:p.size+4,lineHeight:1,
            transform:`rotate(${p.rot+tick*p.rotSpeed*0.5}deg)`,
            filter:`drop-shadow(0 0 3px ${p.color})`,
          }}>⭐</div>;
        }
        return <div key={p.id} style={{
          position:"absolute",width:p.size,height:p.size,
          background:p.color,left:px,top:py,opacity:alpha,
          borderRadius:p.shape==='circle'?'50%':'3px',
          transform:`rotate(${p.rot+tick*p.rotSpeed}deg)`,
          boxShadow:`0 0 6px ${p.color}`,
        }}/>;
      })}
    </div>
  );
}

// ── FLAME ICON — SVG frame-by-frame cartoon flame ────────────────────────────
function FlameIcon({streak,size=28}){
  const tier=Math.min(Math.floor((streak||0)/3),8);
  const TIERS=[
    {oc:'#FF6600',ic:'#FFCC00'},
    {oc:'#FF4A00',ic:'#FFA500'},
    {oc:'#CC2200',ic:'#FF5500'},
    {oc:'#CC0055',ic:'#FF44AA'},
    {oc:'#8800BB',ic:'#DD66FF'},
    {oc:'#007722',ic:'#44FF88'},
    {oc:'#0044CC',ic:'#55BBFF'},
    {oc:'#110077',ic:'#3355CC'},
    {oc:'#555555',ic:'#FFFFFF'},
  ];
  const {oc,ic}=TIERS[tier];
  const h=Math.round(size*1.4);
  const svgStyle={position:'absolute',top:0,left:0,width:'100%',height:'100%',opacity:0};
  return(
    <div style={{position:'relative',width:size,height:h,flexShrink:0}}>
      <svg className="fl-f1" style={svgStyle} viewBox="0 0 400 400">
        <path d="M160,280 C130,260 120,210 140,180 C130,170 125,155 135,145 C145,135 155,145 155,155 C165,200 200,200 190,160 C230,100 210,130 250,160 C260,190 230,220 260,250 C290,270 240,310 190,320 C170,310 165,295 160,280 Z" fill={oc}/>
        <path d="M175,270 C160,250 160,220 175,205 C185,190 200,195 210,210 C225,230 220,260 210,280 C190,295 185,285 175,270 Z" fill={ic}/>
      </svg>
      <svg className="fl-f2" style={svgStyle} viewBox="0 0 400 400">
        <path d="M155,275 C125,250 125,200 145,175 C140,150 155,130 165,140 C170,165 185,185 200,170 C220,120 240,110 245,150 C250,180 235,200 250,230 C275,265 245,305 195,315 C170,305 160,290 155,275 Z" fill={oc}/>
        <path d="M170,265 C155,245 165,210 180,200 C195,190 210,210 215,225 C220,250 210,275 195,285 C180,285 175,275 170,265 Z" fill={ic}/>
      </svg>
      <svg className="fl-f3" style={svgStyle} viewBox="0 0 400 400">
        <path d="M135,160 C130,150 135,140 145,140 C155,145 150,155 140,165 Z" fill={oc}/>
        <path d="M185,130 C190,100 215,90 220,120 C225,145 250,155 240,185 C230,215 255,245 235,275 C215,305 165,310 155,280 C145,245 175,215 170,190 Z" fill={oc}/>
        <path d="M180,260 C165,235 175,205 190,195 C205,185 220,210 220,235 C220,260 200,280 190,275 Z" fill={ic}/>
      </svg>
      <svg className="fl-f4" style={svgStyle} viewBox="0 0 400 400">
        <path d="M140,150 C135,140 140,130 150,135 C155,145 150,155 142,158 Z" fill={ic}/>
        <path d="M190,140 C195,110 210,95 225,115 C230,140 240,160 250,195 C260,225 240,255 220,280 C190,305 155,290 160,260 C165,230 180,210 180,180 Z" fill={oc}/>
        <path d="M185,250 C175,230 180,200 195,195 C210,190 215,220 210,245 C205,265 195,265 185,250 Z" fill={ic}/>
      </svg>
      <svg className="fl-f5" style={svgStyle} viewBox="0 0 400 400">
        <path d="M195,150 C190,120 215,105 230,125 C235,145 225,175 245,205 C255,235 245,265 215,285 C185,305 150,285 165,255 C175,235 170,215 185,190 Z" fill={oc}/>
        <path d="M185,250 C175,235 185,210 195,205 C205,200 215,225 215,245 C210,265 195,265 185,250 Z" fill={ic}/>
      </svg>
      <svg className="fl-f6" style={svgStyle} viewBox="0 0 400 400">
        <path d="M165,270 C145,250 145,215 160,190 C165,170 160,150 175,155 C185,175 195,195 210,185 C225,140 240,130 245,170 C250,195 235,215 250,245 C265,275 230,305 185,310 C170,300 170,285 165,270 Z" fill={oc}/>
        <path d="M175,265 C165,250 170,220 185,210 C200,200 210,225 215,240 C215,260 195,275 185,275 Z" fill={ic}/>
      </svg>
    </div>
  );
}

// ── COVER SCREEN ──────────────────────────────────────────────────────────────
const QUOTES=[
  "The only way to do great work is to love what you do.",
  "You don't rise to the level of your goals. You fall to the level of your systems.",
  "Discipline is choosing between what you want now and what you want most.",
  "Every sketch you make is a vote for the designer you are becoming.",
  "Your rank is a reflection of your daily 1%. Start today.",
];
const STARS=[
  {t:"9%", l:"8%", sz:2,  c:"s1"},{t:"14%",l:"85%",sz:1.5,c:"s2"},
  {t:"70%",l:"92%",sz:2,  c:"s3"},{t:"80%",l:"4%", sz:1.5,c:"s1"},
  {t:"45%",l:"96%",sz:1,  c:"s4"},{t:"30%",l:"50%",sz:1,  c:"s2"},
  {t:"88%",l:"58%",sz:1.5,c:"s3"},{t:"55%",l:"2%", sz:1,  c:"s4"},
];

function CoverScreen({onDone}){
  const [phase,setPhase]=useState("tint");
  const [quote]=useState(QUOTES[Math.floor(Math.random()*QUOTES.length)]);
  useEffect(()=>{
    const t1=setTimeout(()=>setPhase("spin"), 120);
    const t2=setTimeout(()=>setPhase("done"), 2500);
    const t3=setTimeout(()=>setPhase("quote"),2900);
    const t4=setTimeout(()=>onDone(),         5400);
    return()=>[t1,t2,t3,t4].forEach(clearTimeout);
  },[]);
  const LETTERS=["T","I","N","T"];
  const RESTS  =["here","s","o","omorrow"];
  const spinning=phase==="spin";
  const settled =phase==="done"||phase==="quote";
  const showQ   =phase==="quote";
  return(
    <div style={{position:"fixed",inset:0,background:"#05070F",display:"flex",
      flexDirection:"column",alignItems:"center",justifyContent:"center",overflow:"hidden"}}>
      <div className="cover-orb1"/><div className="cover-orb2"/><div className="cover-orb3"/>
      <div className="grid"/><div className="scanlines"/>
      {STARS.map((s,i)=>(
        <div key={i} className={"star "+s.c} style={{top:s.t,left:s.l,width:s.sz+"px",height:s.sz+"px"}}/>
      ))}
      <svg className="orbit" style={{position:"absolute",width:"520px",height:"520px",top:"50%",left:"50%",marginTop:"-260px",marginLeft:"-260px"}}>
        <circle cx="260" cy="260" r="240" fill="none" stroke="white" strokeWidth="0.3" strokeOpacity="0.06"/>
        <circle cx="260" cy="260" r="195" fill="none" stroke="white" strokeWidth="0.3" strokeOpacity="0.04"/>
      </svg>
      <div style={{position:"relative",zIndex:10,textAlign:"center",padding:"0 24px"}}>
        <div style={{perspective:"900px",perspectiveOrigin:"center center",marginBottom:"22px"}}>
          <div style={{
            display:"inline-flex",alignItems:"baseline",
            gap:settled?"10px":spinning?"8px":"3px",
            transition:"gap 1.6s cubic-bezier(0.4,0,0.2,1)",
            animation:spinning?"containerSpin 1.6s cubic-bezier(0.25,0.46,0.45,0.94) forwards":"none",
          }}>
            {LETTERS.map((l,i)=>(
              <div key={i} style={{display:"inline-flex",alignItems:"baseline"}}>
                <span style={{fontFamily:"'Syne',sans-serif",fontWeight:800,color:"#fff",display:"inline-block",
                  fontSize:(spinning||settled)?"26px":"68px",
                  transition:"font-size 1.5s cubic-bezier(0.4,0,0.2,1)",lineHeight:1}}>{l}</span>
                <span style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:"26px",
                  color:"#F1F5F9",display:"inline-block",overflow:"hidden",whiteSpace:"nowrap",
                  maxWidth:(spinning||settled)?"200px":"0px",opacity:(spinning||settled)?1:0,
                  transition:`max-width 1.4s cubic-bezier(0.22,1,0.36,1) ${i*0.1}s,
                              opacity   1.0s ease                         ${0.1+i*0.1}s`,
                  lineHeight:1}}>{RESTS[i]}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{display:"flex",justifyContent:"center",marginBottom:"26px"}}>
          <div className="glow-bar" style={{width:settled?"260px":"70px",transition:"width 0.7s ease 0.4s"}}/>
        </div>
        <div style={{height:"58px",display:"flex",alignItems:"center",justifyContent:"center"}}>
          {showQ&&(
            <p style={{color:"rgba(255,255,255,0.38)",fontSize:"13px",fontWeight:400,
              lineHeight:1.75,maxWidth:"270px",fontStyle:"italic",textAlign:"center",
              animation:"quoteIn 0.6s ease forwards",fontFamily:"Inter,sans-serif"}}>"{quote}"</p>
          )}
        </div>
        {showQ&&(
          <div style={{display:"flex",gap:"10px",justifyContent:"center",alignItems:"center",marginTop:"4px",
            animation:"quoteIn 0.35s ease forwards"}}>
            {[
              {bg:"#A855F7",glow:"rgba(168,85,247,0.7)",size:"7px", delay:"0s"},
              {bg:"#6366F1",glow:"rgba(99,102,241,0.7)", size:"10px",delay:"0.18s"},
              {bg:"#3B5BDB",glow:"rgba(59,91,219,0.8)",  size:"13px",delay:"0.36s"},
            ].map((d,i)=>(
              <div key={i} style={{width:d.size,height:d.size,borderRadius:"50%",background:d.bg,flexShrink:0,
                boxShadow:`0 0 10px ${d.glow},0 0 22px ${d.glow}`,
                animation:`dotWave 1.3s ease-in-out infinite`,animationDelay:d.delay}}/>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── ONBOARDING SCREEN ─────────────────────────────────────────────────────────
const EXAMS=["UCEED","NID","NIFT","JEE"];

function OnboardingScreen({onDone}){
  const [name,setName]=useState("");
  const [avatar,setAvatar]=useState("🦁");
  const [email,setEmail]=useState("");
  const [exams,setExams]=useState([]);
  const [step,setStep]=useState(0);
  const [nextPressed,setNextPressed]=useState(false);
  const toggleExam=e=>setExams(p=>p.includes(e)?p.filter(x=>x!==e):[...p,e]);
  const buildTasks=()=>{
    const seen=new Set();const out=[];
    const selected=exams.length?exams:["UCEED"];
    for(const ex of selected)
      for(const t of (EXAM_TASKS[ex]||[]))
        if(!seen.has(t.title)){seen.add(t.title);out.push({...t,id:Date.now()+Math.random(),status:"upcoming"});}
    return out;
  };
  const submit=()=>{
    if(!name.trim()||exams.length===0) return;
    onDone({name:name.trim(),avatar,email:email.trim(),exams,tasks:buildTasks()});
  };
  const handleNext=()=>{
    if(!name.trim()) return;
    setNextPressed(true);
    setTimeout(()=>{setNextPressed(false);setStep(1);},200);
  };
  const inp={
    width:"100%",background:"rgba(255,255,255,0.05)",
    border:"1px solid rgba(255,255,255,0.12)",borderRadius:"14px",
    padding:"13px 16px",color:"#F1F5F9",fontSize:"15px",
    fontFamily:"Inter,sans-serif",transition:"border-color 0.2s",
  };
  const canGo=exams.length>0;
  return(
    <div style={{position:"fixed",inset:0,background:"#05070F",display:"flex",
      flexDirection:"column",alignItems:"center",justifyContent:"center",overflow:"hidden",padding:"0 0 32px"}}>
      <div className="cover-orb1" style={{opacity:0.5}}/><div className="cover-orb2" style={{opacity:0.4}}/>
      <div className="grid"/>
      <div style={{position:"relative",zIndex:10,width:"100%",maxWidth:"420px",
        padding:"0 24px",animation:"fadeIn 0.5s ease forwards"}}>
        <div style={{textAlign:"center",marginBottom:"28px"}}>
          <div style={{display:"flex",justifyContent:"center",gap:"2px",marginBottom:"8px"}}>
            {["T","I","N","T"].map((l,i)=>(
              <span key={i} style={{fontFamily:"'Syne',sans-serif",fontWeight:800,
                fontSize:"32px",color:"#fff",textShadow:"0 0 20px rgba(99,102,241,0.5)"}}>{l}</span>
            ))}
          </div>
          <p style={{color:"rgba(255,255,255,0.45)",fontSize:"12px",letterSpacing:"0.2em",textTransform:"uppercase"}}>
            Let's set you up
          </p>
        </div>
        {step===0?(
          <div style={{display:"flex",flexDirection:"column",gap:"18px"}}>
            <div>
              <p style={{color:"rgba(255,255,255,0.55)",fontSize:"11px",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:"8px"}}>Your name</p>
              <input value={name} onChange={e=>setName(e.target.value)}
                placeholder="Enter your name…" style={inp}
                onKeyDown={e=>e.key==="Enter"&&name.trim()&&handleNext()}/>
            </div>
            <div>
              <p style={{color:"rgba(255,255,255,0.55)",fontSize:"11px",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:"8px"}}>Pick your avatar</p>
              <div className="avatar-scroll" style={{display:"flex",gap:"8px",overflowX:"auto",paddingBottom:"6px"}}>
                {AVATARS.map(a=>(
                  <button key={a} onClick={()=>setAvatar(a)} style={{
                    width:"46px",height:"46px",borderRadius:"14px",flexShrink:0,fontSize:"22px",cursor:"pointer",
                    background:avatar===a?"rgba(99,102,241,0.3)":"rgba(255,255,255,0.05)",
                    border:avatar===a?"2px solid rgba(99,102,241,0.7)":"2px solid transparent",
                    transition:"all 0.15s ease",transform:avatar===a?"scale(1.1)":"scale(1)",
                    boxShadow:avatar===a?"0 0 14px rgba(99,102,241,0.4)":"none"}}>{a}</button>
                ))}
              </div>
            </div>
            <button onClick={handleNext} className={nextPressed?"btn-pressed":""} style={{
              width:"100%",
              background:name.trim()?"linear-gradient(135deg,rgba(99,102,241,0.6),rgba(139,92,246,0.5))":"rgba(255,255,255,0.05)",
              border:"1px solid "+(name.trim()?"rgba(99,102,241,0.6)":"rgba(255,255,255,0.1)"),
              borderRadius:"14px",padding:"14px",
              color:name.trim()?"#E0E7FF":"rgba(255,255,255,0.25)",
              fontSize:"14px",fontWeight:800,fontFamily:"'Syne',sans-serif",
              letterSpacing:"0.08em",cursor:name.trim()?"pointer":"not-allowed",
              transition:"all 0.2s",
              boxShadow:name.trim()?"0 4px 20px rgba(99,102,241,0.35)":"none",
            }}>NEXT →</button>
          </div>
        ):(
          <div style={{display:"flex",flexDirection:"column",gap:"18px"}}>
            <div>
              <p style={{color:"rgba(255,255,255,0.55)",fontSize:"11px",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:"4px"}}>Email</p>
              <p style={{color:"rgba(99,102,241,0.65)",fontSize:"10px",marginBottom:"8px"}}>Optional — saves your progress across devices</p>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
                placeholder="your@email.com" style={inp}/>
            </div>
            <div>
              <p style={{color:"rgba(255,255,255,0.55)",fontSize:"11px",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:"6px"}}>
                Exams you're preparing for
              </p>
              <p style={{color:"rgba(255,120,120,0.7)",fontSize:"10px",marginBottom:"10px"}}>Select at least one to continue</p>
              <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
                {EXAMS.map(ex=>{
                  const sel=exams.includes(ex);
                  return(
                    <button key={ex} onClick={()=>toggleExam(ex)} style={{
                      padding:"10px 20px",borderRadius:"12px",
                      background:sel?"rgba(99,102,241,0.25)":"rgba(255,255,255,0.05)",
                      border:"1.5px solid "+(sel?"rgba(99,102,241,0.6)":"rgba(255,255,255,0.12)"),
                      color:sel?"#C7D2FE":"rgba(255,255,255,0.55)",
                      fontSize:"13px",fontWeight:700,cursor:"pointer",
                      fontFamily:"'Syne',sans-serif",letterSpacing:"0.05em",
                      transform:sel?"scale(1.05)":"scale(1)",transition:"all 0.18s ease",
                      boxShadow:sel?"0 0 16px rgba(99,102,241,0.35)":"none"}}>{ex}</button>
                  );
                })}
              </div>
              {exams.length>0&&(
                <p style={{color:"rgba(99,102,241,0.65)",fontSize:"11px",marginTop:"8px"}}>
                  Tasks will be loaded for: {exams.join(", ")}
                </p>
              )}
            </div>
            <div style={{display:"flex",gap:"10px"}}>
              <button onClick={()=>setStep(0)} style={{flex:1,background:"rgba(255,255,255,0.05)",
                border:"1px solid rgba(255,255,255,0.1)",borderRadius:"14px",padding:"13px",
                color:"rgba(255,255,255,0.55)",fontSize:"13px",fontWeight:700,cursor:"pointer",
                fontFamily:"Inter,sans-serif"}}>← Back</button>
              <button onClick={submit} style={{flex:2,
                background:canGo?"linear-gradient(135deg,rgba(99,102,241,0.6),rgba(139,92,246,0.5))":"rgba(255,255,255,0.05)",
                border:"1px solid "+(canGo?"rgba(99,102,241,0.6)":"rgba(255,255,255,0.1)"),
                borderRadius:"14px",padding:"13px",
                color:canGo?"#E0E7FF":"rgba(255,255,255,0.25)",
                fontSize:"14px",fontWeight:800,fontFamily:"'Syne',sans-serif",
                letterSpacing:"0.08em",cursor:canGo?"pointer":"not-allowed",
                transition:"all 0.2s",
                boxShadow:canGo?"0 4px 20px rgba(99,102,241,0.35)":"none",
              }}>LET'S GO →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── WEEK BAR — sliding multi-week ────────────────────────────────────────────
function WeekBar({history,selectedDate,onSelectDate}){
  const today=new Date();
  const todayStr=today.toISOString().slice(0,10);
  const DAY_COLORS=["#C084FC","#60A5FA","#34D399","#4ADE80","#FBBF24","#FB923C","#F87171"];
  const labels=["M","T","W","T","F","S","S"];
  const scrollRef=useRef(null);
  const dow=today.getDay();
  const mondayOff=(dow+6)%7;
  const currentMonday=new Date(today);
  currentMonday.setDate(today.getDate()-mondayOff);
  const weeks=Array.from({length:5},(_,wi)=>{
    const wm=new Date(currentMonday);
    wm.setDate(currentMonday.getDate()-(4-wi)*7);
    return Array.from({length:7},(_,di)=>{
      const d=new Date(wm);d.setDate(wm.getDate()+di);return d;
    });
  });
  const statusColor={green:"#22C55E",yellow:"#FBBF24",red:"#EF4444",none:"rgba(255,255,255,0.1)"};
  const getStatus=d=>{
    const ds=d.toISOString().slice(0,10);
    const snap=history.find(h=>h.date===ds);
    if(!snap) return "none";
    if(snap.allDone) return "green";
    if((snap.pct||0)>=50) return "yellow";
    return "red";
  };
  useEffect(()=>{
    if(scrollRef.current){
      const el=scrollRef.current;
      el.scrollLeft=el.scrollWidth-el.clientWidth;
    }
  },[]);
  return(
    <div style={{margin:"6px -4px 0",overflow:"hidden"}}>
      <div ref={scrollRef} className="weekbar-scroll" style={{
        display:"flex",overflowX:"auto",
        scrollSnapType:"x mandatory",
        WebkitOverflowScrolling:"touch",
      }}>
        {weeks.map((week,wi)=>(
          <div key={wi} style={{
            minWidth:"100%",display:"flex",
            padding:"4px 4px 6px",scrollSnapAlign:"start",
          }}>
            {week.map((d,di)=>{
              const ds=d.toISOString().slice(0,10);
              const isToday=ds===todayStr;
              const isFuture=d>today&&ds!==todayStr;
              const isSel=ds===selectedDate;
              const st=isFuture?"none":getStatus(d);
              return(
                <div key={di}
                  onClick={()=>!isFuture&&onSelectDate(isSel&&!isToday?todayStr:ds)}
                  style={{flex:1,display:"flex",flexDirection:"column",
                    alignItems:"center",gap:"3px",cursor:isFuture?"default":"pointer",padding:"3px 0"}}>
                  <span style={{
                    color:DAY_COLORS[di],fontSize:"10px",
                    fontWeight:isToday||isSel?800:600,
                    letterSpacing:"0.04em",opacity:isFuture?0.3:1,
                  }}>{labels[di]}</span>
                  <div style={{
                    width:"8px",height:"8px",borderRadius:"50%",
                    background:isFuture?"rgba(255,255,255,0.07)":statusColor[st],
                    outline:isSel?"2px solid rgba(255,255,255,0.75)":
                            isToday?"2px solid rgba(129,140,248,0.75)":"none",
                    outlineOffset:"2px",
                    boxShadow:!isFuture&&st==="green"?"0 0 7px rgba(34,197,94,0.7)":
                              !isFuture&&st==="yellow"?"0 0 7px rgba(251,191,36,0.6)":"none",
                    transition:"all 0.25s",
                  }}/>
                  <span style={{
                    color:isSel?"rgba(255,255,255,0.9)":isToday?"rgba(129,140,248,0.85)":"rgba(255,255,255,0.2)",
                    fontSize:"8px",fontWeight:isToday||isSel?700:400,
                  }}>{d.getDate()}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── ALL-DONE POPUP — cinematic flame buildup ──────────────────────────────────
function AllDonePopup({streak,userName,onClose}){
  const fs=flameStyle(streak);
  const [phase,setPhase]=useState("trails"); // trails → form → show
  useEffect(()=>{
    const t1=setTimeout(()=>setPhase("form"),1300);
    const t2=setTimeout(()=>setPhase("show"),2500);
    return()=>{clearTimeout(t1);clearTimeout(t2);};
  },[]);

  const cvRef=useRef(null);
  useEffect(()=>{
    if(phase!=='trails'&&phase!=='form')return;
    const cv=cvRef.current;
    if(!cv)return;
    const ctx=cv.getContext('2d');
    const W=320,H=320;
    cv.width=W;cv.height=H;
    let t2=0,raf;
    const cx=W/2,cy=H/2;
    const NUM=6;

    function drawTeardrop(x,y,r,angle,alpha,col){
      ctx.save();
      ctx.globalAlpha=alpha;
      ctx.translate(x,y);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.arc(0,r*0.15,r,0,Math.PI*2);
      ctx.moveTo(-r*0.5,r*0.1);
      ctx.bezierCurveTo(-r*0.25,-r*0.85,r*0.25,-r*0.85,r*0.5,r*0.1);
      ctx.fillStyle=col;
      ctx.fill();
      ctx.restore();
    }

    function drawCartoonFlame(fcx,fby,fw,fh,col1,col2,col3){
      function layer(lfw,lfh,lc1,lc2){
        ctx.beginPath();
        ctx.moveTo(fcx-lfw*0.46,fby);
        ctx.bezierCurveTo(fcx-lfw*0.70,fby-lfh*0.12,fcx-lfw*0.76,fby-lfh*0.35,fcx-lfw*0.65,fby-lfh*0.46);
        ctx.bezierCurveTo(fcx-lfw*0.50,fby-lfh*0.54,fcx-lfw*0.18,fby-lfh*0.56,fcx-lfw*0.28,fby-lfh*0.63);
        ctx.bezierCurveTo(fcx-lfw*0.40,fby-lfh*0.72,fcx-lfw*0.22,fby-lfh*0.88,fcx,fby-lfh);
        ctx.bezierCurveTo(fcx+lfw*0.22,fby-lfh*0.86,fcx+lfw*0.52,fby-lfh*0.58,fcx+lfw*0.58,fby-lfh*0.38);
        ctx.bezierCurveTo(fcx+lfw*0.62,fby-lfh*0.20,fcx+lfw*0.56,fby-lfh*0.05,fcx+lfw*0.46,fby);
        ctx.arc(fcx,fby,lfw*0.46,0,Math.PI);
        const g=ctx.createLinearGradient(fcx,fby,fcx,fby-lfh);
        g.addColorStop(0,lc1);g.addColorStop(0.5,lc2);g.addColorStop(1,'rgba(255,255,220,0.9)');
        ctx.fillStyle=g;ctx.fill();
      }
      layer(fw,fh,col1,col2);
      layer(fw*0.68,fh*0.78,col2,col3);
      layer(fw*0.40,fh*0.52,col3,'rgba(255,255,200,0.95)');
    }

    function frame(){
      ctx.clearRect(0,0,W,H);
      const dur=phase==='trails'?1.3:2.5;
      const progress=Math.min(t2/dur,1);

      if(phase==='trails'){
        for(let i=0;i<NUM;i++){
          const baseAngle=(i/NUM)*Math.PI*2;
          const spiralAngle=baseAngle+progress*Math.PI*1.5;
          const radius=130*(1-progress*0.9);
          const x=cx+Math.cos(spiralAngle)*radius;
          const y=cy+Math.sin(spiralAngle)*radius;
          const alpha=progress<0.1?progress/0.1:1;
          const r=8+progress*6;
          const hue=i%2===0?'#FF5C00':'#FFD100';
          drawTeardrop(x,y,r,spiralAngle+Math.PI/2,alpha,hue);
        }
      } else {
        const p2=Math.min((t2-0)/1.2,1);
        const scale=0.3+p2*0.7;
        ctx.save();
        ctx.translate(cx,cy+30);
        ctx.scale(scale,scale);
        ctx.globalAlpha=p2;
        drawCartoonFlame(0,60,80,120,'#CC2200','#FF5500','#FFAA00');
        ctx.restore();
      }

      t2+=0.016;
      raf=requestAnimationFrame(frame);
    }
    raf=requestAnimationFrame(frame);
    return()=>cancelAnimationFrame(raf);
  },[phase]);

  const [particles]=useState(()=>Array.from({length:22},(_,i)=>({
    id:i,x:Math.random()*100,delay:Math.random()*2.5,
    dur:2.5+Math.random()*4,size:3+Math.random()*8,
    color:[fs.c1,fs.c2,"#FFF9C4","rgba(255,220,120,0.9)"][i%4],
  })));

  const displayStreak=Math.max(1,streak);
  const msg=displayStreak>=14
    ?`${displayStreak} days straight. Elite territory, ${userName}.`
    :displayStreak>=7
    ?`${displayStreak}-day streak! Momentum compounds.`
    :displayStreak>=3
    ?`${displayStreak} days strong. The habit is forming.`
    :`First day done! Come back tomorrow to start your streak.`;

  return(
    <div style={{position:"fixed",inset:0,zIndex:300,background:"rgba(4,6,14,0.98)",
      display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
      overflow:"hidden",animation:"fadeIn 0.25s ease forwards"}}>

      {/* Phase 1 & 2: canvas spiral animation */}
      {(phase==='trails'||phase==='form')&&(
        <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <canvas ref={cvRef} style={{width:320,height:320}}/>
        </div>
      )}

      {/* Phase 2+3: flame forms then content reveals */}
      {phase!=="trails"&&(
        <>
          {/* Glow ring on formation */}
          {phase==="form"&&(
            <div style={{position:"absolute",width:"180px",height:"180px",borderRadius:"50%",
              border:`2px solid ${fs.c2}`,
              boxShadow:`0 0 40px 10px ${fs.glow},inset 0 0 30px ${fs.glow}`,
              animation:"glowRing 0.75s ease forwards",pointerEvents:"none"}}/>
          )}
          {/* Ambient pulse */}
          <div style={{position:"absolute",width:"360px",height:"360px",borderRadius:"50%",
            background:`radial-gradient(circle,${fs.glow.replace(/[\d.]+\)$/,"0.22)")},transparent 70%)`,
            animation:"pulseGlow 2s ease-in-out infinite",pointerEvents:"none"}}/>

          <div style={{position:"relative",textAlign:"center",padding:"0 32px",maxWidth:"360px",width:"100%"}}>
            {/* Flame — forms on entry, then loops */}
            {phase==="form"&&(
              <div style={{marginBottom:"22px",
                animation:"flameFormIn 0.85s cubic-bezier(0.34,1.56,0.64,1) forwards"}}>
                <FlameIcon streak={streak} size={96}/>
              </div>
            )}
            {phase==="show"&&(
              <div style={{marginBottom:"22px",
                animation:"flamePop 1.1s ease-in-out infinite"}}>
                <FlameIcon streak={streak} size={96}/>
              </div>
            )}

            {/* Content — only after show phase */}
            {phase==="show"&&(
              <>
                {particles.map(p=>(
                  <div key={p.id} style={{position:"fixed",left:p.x+"%",bottom:"-20px",
                    width:p.size,height:p.size,borderRadius:"50%",
                    background:p.color,boxShadow:`0 0 8px ${p.color}`,
                    animation:`floatUp ${p.dur}s ease-in ${p.delay}s infinite`,opacity:0.85}}/>
                ))}
                <div style={{animation:"contentReveal 0.55s cubic-bezier(0.34,1.56,0.64,1) forwards"}}>
                  <div style={{display:"inline-flex",alignItems:"center",gap:"8px",
                    background:`${fs.c1}28`,border:`1px solid ${fs.c1}60`,
                    borderRadius:"100px",padding:"8px 22px",marginBottom:"20px"}}>
                    <span style={{color:fs.c2,fontSize:"28px",fontWeight:800,fontFamily:"'Syne',sans-serif"}}>{displayStreak}</span>
                    <span style={{color:fs.c2,fontSize:"13px",fontWeight:600}}>day streak 🔥</span>
                  </div>
                  <h1 style={{color:"#F1F5F9",fontSize:"26px",fontWeight:800,
                    fontFamily:"'Syne',system-ui,sans-serif",
                    marginBottom:"12px",textShadow:`0 0 30px ${fs.glow}`}}>All Done for Today!</h1>
                  <p style={{color:"rgba(255,255,255,0.5)",fontSize:"14px",lineHeight:1.75,marginBottom:"30px"}}>{msg}</p>
                  <button onClick={onClose} style={{width:"100%",
                    background:`linear-gradient(135deg,${fs.c1},${fs.c2})`,
                    border:"none",borderRadius:"16px",padding:"16px",
                    color:"#fff",fontSize:"14px",fontWeight:800,
                    fontFamily:"'Syne',system-ui,sans-serif",letterSpacing:"0.08em",cursor:"pointer",
                    boxShadow:`0 8px 28px ${fs.glow}`}}>SEE YOU TOMORROW →</button>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── EDIT PROFILE SHEET ────────────────────────────────────────────────────────
function EditProfileSheet({name,avatar,exams,onSave,onClose}){
  const [n,setN]=useState(name);
  const [a,setA]=useState(avatar);
  const [selExams,setSelExams]=useState(exams||[]);
  const toggleExam=ex=>setSelExams(p=>p.includes(ex)?p.filter(x=>x!==ex):[...p,ex]);
  return(
    <div style={{position:"fixed",inset:0,zIndex:200,background:"rgba(0,0,0,0.7)",
      display:"flex",alignItems:"flex-end",justifyContent:"center"}}
      onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{background:"#0F172A",borderRadius:"24px 24px 0 0",width:"100%",
        maxWidth:"500px",padding:"24px 20px 44px",border:"1px solid rgba(255,255,255,0.08)",
        animation:"fadeInUp 0.3s ease forwards",maxHeight:"80vh",overflowY:"auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"20px"}}>
          <h3 style={{color:"#F1F5F9",fontSize:"17px",fontWeight:700,fontFamily:"'Syne',sans-serif"}}>Edit Profile</h3>
          <button onClick={onClose} style={{background:"rgba(255,255,255,0.07)",border:"none",
            borderRadius:"50%",width:"30px",height:"30px",color:"#94A3B8",cursor:"pointer",fontSize:"18px"}}>×</button>
        </div>
        <p style={{color:"rgba(255,255,255,0.5)",fontSize:"11px",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:"8px"}}>Name</p>
        <input value={n} onChange={e=>setN(e.target.value)}
          style={{width:"100%",background:"rgba(255,255,255,0.05)",
            border:"1px solid rgba(255,255,255,0.12)",borderRadius:"12px",
            padding:"12px 14px",color:"#F1F5F9",fontSize:"14px",
            fontFamily:"Inter,sans-serif",marginBottom:"18px"}}/>
        <p style={{color:"rgba(255,255,255,0.5)",fontSize:"11px",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:"8px"}}>Avatar</p>
        <div className="avatar-scroll" style={{display:"flex",gap:"8px",overflowX:"auto",paddingBottom:"8px",marginBottom:"20px"}}>
          {AVATARS.map(av=>(
            <button key={av} onClick={()=>setA(av)} style={{
              width:"46px",height:"46px",borderRadius:"14px",flexShrink:0,fontSize:"22px",cursor:"pointer",
              background:a===av?"rgba(99,102,241,0.3)":"rgba(255,255,255,0.05)",
              border:a===av?"2px solid rgba(99,102,241,0.7)":"2px solid transparent",
              transition:"all 0.15s ease",transform:a===av?"scale(1.1)":"scale(1)"}}>{av}</button>
          ))}
        </div>
        <p style={{color:"rgba(255,255,255,0.5)",fontSize:"11px",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:"8px"}}>Exams</p>
        <div style={{display:"flex",gap:"8px",flexWrap:"wrap",marginBottom:"22px"}}>
          {EXAMS.map(ex=>{
            const sel=selExams.includes(ex);
            return(
              <button key={ex} onClick={()=>toggleExam(ex)} style={{
                padding:"10px 20px",borderRadius:"12px",
                background:sel?"rgba(99,102,241,0.25)":"rgba(255,255,255,0.05)",
                border:"1.5px solid "+(sel?"rgba(99,102,241,0.6)":"rgba(255,255,255,0.12)"),
                color:sel?"#C7D2FE":"rgba(255,255,255,0.55)",
                fontSize:"13px",fontWeight:700,cursor:"pointer",
                fontFamily:"'Syne',sans-serif",letterSpacing:"0.05em",
                transform:sel?"scale(1.05)":"scale(1)",transition:"all 0.18s ease",
                boxShadow:sel?"0 0 16px rgba(99,102,241,0.35)":"none"}}>{ex}</button>
            );
          })}
        </div>
        <button onClick={()=>{if(n.trim())onSave(n.trim(),a,selExams.length?selExams:exams);}} style={{width:"100%",
          background:"linear-gradient(135deg,rgba(99,102,241,0.6),rgba(139,92,246,0.5))",
          border:"1px solid rgba(99,102,241,0.5)",borderRadius:"14px",padding:"14px",
          color:"#E0E7FF",fontSize:"14px",fontWeight:800,fontFamily:"'Syne',sans-serif",
          letterSpacing:"0.08em",cursor:"pointer"}}>SAVE CHANGES</button>
      </div>
    </div>
  );
}

// ── FOCUS SCREEN ──────────────────────────────────────────────────────────────
const FOCUS_APPS=[
  {id:'whatsapp',name:'WhatsApp',icon:'💬'},
  {id:'instagram',name:'Instagram',icon:'📸'},
  {id:'youtube',name:'YouTube',icon:'▶️'},
  {id:'twitter',name:'X / Twitter',icon:'🐦'},
  {id:'tiktok',name:'TikTok',icon:'🎵'},
  {id:'snapchat',name:'Snapchat',icon:'👻'},
  {id:'games',name:'Games',icon:'🎮'},
  {id:'netflix',name:'Netflix',icon:'🎬'},
];

function FocusScreen({onBack,onTasks,onProgress,onLeaderboard}){
  const [phase,setPhase]=useState('setup'); // 'setup'|'breathe'|'active'|'done'
  const [duration,setDuration]=useState(25);
  const [blocked,setBlocked]=useState(['instagram','youtube','tiktok']);
  const [timeLeft,setTimeLeft]=useState(0);
  const timerRef=useRef(null);

  const toggle=(id)=>setBlocked(b=>b.includes(id)?b.filter(x=>x!==id):[...b,id]);

  const startFocus=()=>{ setPhase('breathe'); };

  useEffect(()=>{
    if(phase!=='breathe')return;
    const timer=setTimeout(()=>{
      setTimeLeft(duration*60);
      setPhase('active');
      timerRef.current=setInterval(()=>{
        setTimeLeft(p=>{
          if(p<=1){clearInterval(timerRef.current);setPhase('done');return 0;}
          return p-1;
        });
      },1000);
    },20000);
    return()=>clearTimeout(timer);
  },[phase,duration]);

  const endFocus=()=>{clearInterval(timerRef.current);setPhase('setup');};

  useEffect(()=>()=>clearInterval(timerRef.current),[]);

  const mins=String(Math.floor(timeLeft/60)).padStart(2,'0');
  const secs=String(timeLeft%60).padStart(2,'0');
  const pct=phase==='active'?(duration*60-timeLeft)/(duration*60)*100:0;

  const DURATIONS=[15,25,45,60,90];

  return(
    <div className="app-screen" style={{background:'#05070F',display:'flex',flexDirection:'column',overflow:'hidden'}}>
      {/* Header */}
      <div style={{padding:'16px 20px 12px',display:'flex',alignItems:'center',gap:12,borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
        <button onClick={onBack} style={{background:'none',border:'none',color:'rgba(255,255,255,0.5)',fontSize:20,cursor:'pointer',padding:4}}>←</button>
        <div style={{fontSize:18,fontWeight:700,color:'#fff',letterSpacing:-0.3}}>Focus Mode</div>
        <div style={{marginLeft:'auto',fontSize:11,color:'rgba(255,255,255,0.35)',letterSpacing:0.5}}>DEEP WORK</div>
      </div>

      <div style={{flex:1,overflowY:'auto',padding:'0 20px 20px'}}>

      {phase==='setup'&&<>
        {/* Timer picker */}
        <div style={{marginTop:24,marginBottom:8,fontSize:12,color:'rgba(255,255,255,0.4)',letterSpacing:1,textTransform:'uppercase'}}>Session length</div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:28}}>
          {DURATIONS.map(d=>(
            <button key={d} onClick={()=>setDuration(d)} style={{
              padding:'10px 18px',borderRadius:12,border:'none',cursor:'pointer',fontSize:14,fontWeight:600,
              background:duration===d?'#6366F1':'rgba(255,255,255,0.07)',
              color:duration===d?'#fff':'rgba(255,255,255,0.55)',
              transition:'all 0.15s',
            }}>{d} min</button>
          ))}
        </div>

        {/* App toggles */}
        <div style={{fontSize:12,color:'rgba(255,255,255,0.4)',letterSpacing:1,textTransform:'uppercase',marginBottom:12}}>Apps to avoid</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:32}}>
          {FOCUS_APPS.map(app=>{
            const on=blocked.includes(app.id);
            return(
              <button key={app.id} onClick={()=>toggle(app.id)} style={{
                display:'flex',alignItems:'center',gap:10,padding:'12px 14px',
                borderRadius:14,border:`1.5px solid ${on?'rgba(239,68,68,0.5)':'rgba(255,255,255,0.1)'}`,
                background:on?'rgba(239,68,68,0.08)':'rgba(255,255,255,0.04)',
                cursor:'pointer',textAlign:'left',transition:'all 0.15s',
              }}>
                <span style={{fontSize:22}}>{app.icon}</span>
                <div>
                  <div style={{fontSize:13,fontWeight:600,color:on?'#FCA5A5':'rgba(255,255,255,0.7)'}}>{app.name}</div>
                  <div style={{fontSize:10,color:on?'rgba(239,68,68,0.7)':'rgba(255,255,255,0.3)'}}>{on?'blocked':'allowed'}</div>
                </div>
                <div style={{marginLeft:'auto',width:8,height:8,borderRadius:'50%',background:on?'#EF4444':'rgba(255,255,255,0.15)'}}/>
              </button>
            );
          })}
        </div>

        {/* Note */}
        <div style={{background:'rgba(99,102,241,0.1)',border:'1px solid rgba(99,102,241,0.25)',borderRadius:12,padding:'12px 14px',marginBottom:28,fontSize:12,color:'rgba(255,255,255,0.5)',lineHeight:1.6}}>
          💡 For real app blocking, use <strong style={{color:'rgba(255,255,255,0.7)'}}>Screen Time</strong> (iPhone) or <strong style={{color:'rgba(255,255,255,0.7)'}}>Digital Wellbeing</strong> (Android). This focus screen keeps you accountable in TINT.
        </div>

        <button onClick={startFocus} style={{
          width:'100%',padding:'16px',borderRadius:16,border:'none',cursor:'pointer',
          background:'linear-gradient(135deg,#6366F1,#8B5CF6)',
          color:'#fff',fontSize:16,fontWeight:700,letterSpacing:0.3,
          boxShadow:'0 8px 24px rgba(99,102,241,0.4)',
        }}>Start Focus Session ⚡</button>
      </>}

      {phase==='breathe'&&(()=>{
        return(
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',paddingTop:32,textAlign:'center'}}>
            <div style={{fontSize:13,color:'rgba(255,255,255,0.4)',letterSpacing:1,textTransform:'uppercase',marginBottom:32}}>Before you begin</div>

            <div style={{position:'relative',width:180,height:180,marginBottom:32}}>
              <div style={{
                position:'absolute',inset:0,borderRadius:'50%',
                background:'radial-gradient(circle,rgba(99,102,241,0.3),rgba(99,102,241,0.05))',
                border:'2px solid rgba(99,102,241,0.4)',
                animation:'breatheCircle 7s ease-in-out infinite',
              }}/>
              <div style={{
                position:'absolute',inset:'20%',borderRadius:'50%',
                background:'radial-gradient(circle,rgba(139,92,246,0.4),rgba(99,102,241,0.1))',
                animation:'breatheCircle 7s ease-in-out infinite 0.3s',
              }}/>
              <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:4}}>
                <span style={{fontSize:28}}>🧘</span>
                <div style={{fontSize:11,color:'rgba(255,255,255,0.5)',letterSpacing:1}}>BREATHE</div>
              </div>
            </div>

            <div style={{fontSize:16,fontWeight:600,color:'rgba(255,255,255,0.8)',marginBottom:8,animation:'breatheText 7s ease-in-out infinite'}}>
              Breathe in... hold... breathe out
            </div>
            <div style={{fontSize:12,color:'rgba(255,255,255,0.35)',marginBottom:32}}>Session starts in 20 seconds</div>

            <button onClick={()=>{
              setTimeLeft(duration*60);
              setPhase('active');
              timerRef.current=setInterval(()=>{
                setTimeLeft(p=>{
                  if(p<=1){clearInterval(timerRef.current);setPhase('done');return 0;}
                  return p-1;
                });
              },1000);
            }} style={{
              padding:'10px 24px',borderRadius:12,border:'1px solid rgba(99,102,241,0.3)',
              background:'none',color:'rgba(255,255,255,0.5)',fontSize:13,cursor:'pointer',
            }}>Skip breathing</button>
          </div>
        );
      })()}

      {phase==='active'&&(
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',paddingTop:32}}>
          {/* Big timer */}
          <div style={{position:'relative',width:200,height:200,marginBottom:32}}>
            <svg viewBox="0 0 200 200" style={{position:'absolute',inset:0,transform:'rotate(-90deg)'}}>
              <circle cx="100" cy="100" r="90" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8"/>
              <circle cx="100" cy="100" r="90" fill="none" stroke="#6366F1" strokeWidth="8"
                strokeDasharray={`${2*Math.PI*90}`}
                strokeDashoffset={`${2*Math.PI*90*(1-pct/100)}`}
                strokeLinecap="round" style={{transition:'stroke-dashoffset 1s linear'}}/>
            </svg>
            <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
              <div style={{fontSize:48,fontWeight:800,color:'#fff',letterSpacing:-2,fontVariantNumeric:'tabular-nums'}}>{mins}:{secs}</div>
              <div style={{fontSize:12,color:'rgba(255,255,255,0.4)',marginTop:4,letterSpacing:1}}>REMAINING</div>
            </div>
          </div>

          <div style={{fontSize:16,color:'rgba(255,255,255,0.7)',marginBottom:8,fontWeight:500}}>Stay locked in 🔒</div>
          <div style={{fontSize:13,color:'rgba(255,255,255,0.35)',marginBottom:32,textAlign:'center',lineHeight:1.5}}>
            {blocked.length>0?`Avoiding: ${blocked.map(id=>FOCUS_APPS.find(a=>a.id===id)?.name).filter(Boolean).join(', ')}`:'No apps blocked'}
          </div>

          <button onClick={endFocus} style={{
            padding:'12px 32px',borderRadius:14,border:'1.5px solid rgba(239,68,68,0.4)',
            background:'rgba(239,68,68,0.08)',color:'#FCA5A5',fontSize:14,fontWeight:600,cursor:'pointer',
          }}>End Session</button>
        </div>
      )}

      {phase==='done'&&(
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',paddingTop:48,textAlign:'center'}}>
          <div style={{fontSize:64,marginBottom:16}}>🔥</div>
          <div style={{fontSize:26,fontWeight:800,color:'#fff',marginBottom:8}}>Session Complete!</div>
          <div style={{fontSize:15,color:'rgba(255,255,255,0.5)',marginBottom:32}}>{duration} minutes of pure focus</div>
          <button onClick={()=>setPhase('setup')} style={{
            padding:'14px 32px',borderRadius:16,border:'none',cursor:'pointer',
            background:'linear-gradient(135deg,#6366F1,#8B5CF6)',color:'#fff',fontSize:15,fontWeight:700,
          }}>Start Another</button>
        </div>
      )}

      </div>

      <BottomNav active="focus" onTasks={onTasks} onFocus={()=>{}} onProgress={onProgress} onLeaderboard={onLeaderboard}/>
    </div>
  );
}

// ── MISSED TASK ALERT ─────────────────────────────────────────────────────────
function MissedTaskAlert({history,tasks,onDismiss}){
  const [dismissed,setDismissed]=useState(false);
  if(dismissed)return null;

  const today=new Date().toISOString().slice(0,10);
  const recent=[...history]
    .filter(h=>h.date!==today)
    .sort((a,b)=>b.date.localeCompare(a.date))
    .slice(0,5);

  if(recent.length<3)return null;

  const taskMissCount={};
  for(const entry of recent){
    const missed=entry.missedTasks||[];
    for(const t of missed){
      taskMissCount[t]=(taskMissCount[t]||0)+1;
    }
  }

  const chronic=Object.entries(taskMissCount)
    .filter(([,count])=>count>=3)
    .sort((a,b)=>b[1]-a[1]);

  if(chronic.length===0)return null;

  const [topTask,topCount]=chronic[0];

  return(
    <div style={{
      margin:'10px 16px 0',padding:'12px 14px',
      background:'rgba(239,68,68,0.10)',
      border:'1px solid rgba(239,68,68,0.30)',
      borderRadius:14,display:'flex',alignItems:'flex-start',gap:10,
    }}>
      <span style={{fontSize:18,flexShrink:0}}>⚠️</span>
      <div style={{flex:1}}>
        <div style={{fontSize:13,fontWeight:700,color:'#FCA5A5',marginBottom:3}}>
          Missed {topCount} days in a row
        </div>
        <div style={{fontSize:12,color:'rgba(255,255,255,0.55)',lineHeight:1.5}}>
          <strong style={{color:'rgba(255,255,255,0.8)'}}>{topTask}</strong> hasn't been done recently. This is hurting your consistency score.
        </div>
        <div style={{display:'flex',gap:8,marginTop:8}}>
          <button onClick={()=>setDismissed(true)} style={{
            fontSize:11,padding:'5px 12px',borderRadius:8,border:'1px solid rgba(239,68,68,0.35)',
            background:'rgba(239,68,68,0.15)',color:'#FCA5A5',cursor:'pointer',fontWeight:600,
          }}>Got it, I'll do it now</button>
          <button onClick={()=>setDismissed(true)} style={{
            fontSize:11,padding:'5px 12px',borderRadius:8,border:'1px solid rgba(255,255,255,0.12)',
            background:'none',color:'rgba(255,255,255,0.4)',cursor:'pointer',
          }}>Dismiss</button>
        </div>
      </div>
    </div>
  );
}

// ── BOTTOM NAV ────────────────────────────────────────────────────────────────
function BottomNav({active,onTasks,onFocus,onProgress,onLeaderboard}){
  const btn=(label,icon,key,cb)=>(
    <button key={key} onClick={cb} style={{
      flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
      gap:3,background:'none',border:'none',cursor:'pointer',padding:'8px 0',
      color:active===key?'#fff':'rgba(255,255,255,0.38)',
    }}>
      <div style={{
        width:active===key?40:28,height:28,display:'flex',alignItems:'center',justifyContent:'center',
        borderRadius:14,background:active===key?'rgba(99,102,241,0.35)':'none',
        transition:'all 0.2s',
      }}><span style={{fontSize:18}}>{icon}</span></div>
      <span style={{fontSize:10,fontWeight:active===key?700:500,letterSpacing:0.3}}>{label}</span>
    </button>
  );
  return(
    <div className="nav-safe" style={{
      display:'flex',borderTop:'1px solid rgba(255,255,255,0.07)',
      background:'rgba(5,7,15,0.97)',backdropFilter:'blur(20px)',
    }}>
      {btn('Tasks','📋','tasks',onTasks)}
      {btn('Focus','⚡','focus',onFocus)}
      {btn('Progress','📈','progress',onProgress)}
      {btn('Board','🏆','board',onLeaderboard)}
    </div>
  );
}

// ── HOME SCREEN ───────────────────────────────────────────────────────────────
function HomeScreen({tasks,setTasks,streak,rank,isCarrot,userName,userAvatar,history,
  onFocus,onProgress,onLeaderboard,onEditProfile,onOpenDev,onLogPastDay}){
  const [confettis,setConfettis]=useState([]);
  const [redFlash,setRedFlash]=useState(false);
  const [filter,setFilter]=useState("all");
  const [showAdd,setShowAdd]=useState(false);
  const [deletingId,setDeletingId]=useState(null);
  const [showAllDone,setShowAllDone]=useState(false);
  const [flameTaps,setFlameTaps]=useState(0);
  const flameTapTimer=useRef(null);

  const todayStr=new Date().toISOString().slice(0,10);
  const [selectedDate,setSelectedDate]=useState(todayStr);
  const [allDoneShownDate,setAllDoneShownDate]=useState(()=>load("tint_alldone_date",""));

  const done=tasks.filter(t=>t.status==="done").length;
  const total=tasks.length;
  const pct=total>0?Math.round((done/total)*100):0;
  const fs=flameStyle(streak);

  // Only show all-done popup once per day
  useEffect(()=>{
    if(done===total&&total>0&&allDoneShownDate!==todayStr){
      setAllDoneShownDate(todayStr);
      save("tint_alldone_date",todayStr);
      setTimeout(()=>setShowAllDone(true),600);
    }
  },[done,total]);

  const tap=(task,e)=>{
    if(task.id===deletingId){setDeletingId(null);return;}
    if(task.status==="missed"){setRedFlash(true);setTimeout(()=>setRedFlash(false),500);return;}
    const rect=e.currentTarget.getBoundingClientRect();
    const cx=rect.left+rect.width/2,cy=rect.top+rect.height/2;
    if(task.status!=="done"){
      const id=Date.now();
      setConfettis(p=>[...p,{id,x:cx,y:cy}]);
      setTimeout(()=>setConfettis(p=>p.filter(c=>c.id!==id)),1200);
      playChime();
    }
    setTasks(prev=>prev.map(t=>t.id===task.id?{...t,status:t.status==="done"?"upcoming":"done"}:t));
  };

  const deleteTask=id=>setTasks(prev=>prev.filter(t=>t.id!==id));
  const filtered=filter==="all"?tasks:filter==="done"?tasks.filter(t=>t.status==="done"):tasks.filter(t=>t.status==="upcoming");
  const today=new Date().toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long"});

  // 5 quick taps on flame opens dev mode
  const handleFlameTap=()=>{
    clearTimeout(flameTapTimer.current);
    const n=flameTaps+1;
    if(n>=5){setFlameTaps(0);onOpenDev();return;}
    setFlameTaps(n);
    flameTapTimer.current=setTimeout(()=>setFlameTaps(0),1500);
  };

  return(
    <div className="app-screen" style={{display:"flex",flexDirection:"column",background:"#080C14",
      fontFamily:"Inter,sans-serif",overflow:"hidden"}}>
      {confettis.map(c=><Confetti key={c.id} x={c.x} y={c.y}/>)}
      {redFlash&&<div style={{position:"fixed",inset:0,background:"rgba(239,68,68,0.18)",
        zIndex:998,animation:"flashRed 0.5s ease forwards",pointerEvents:"none"}}/>}
      {showAllDone&&<AllDonePopup streak={streak} userName={userName} onClose={()=>setShowAllDone(false)}/>}

      {/* SCROLLABLE CONTENT */}
      <div style={{flex:1,overflowY:"auto",WebkitOverflowScrolling:"touch"}}>
        {/* HEADER */}
        <div style={{background:"linear-gradient(180deg,#0D1321 0%,#080C14 100%)",
          padding:"20px 20px 10px",borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
          <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"2px"}}>
            {/* Left: avatar + edit */}
            <button onClick={onEditProfile} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"3px",
              flexShrink:0,background:"rgba(99,102,241,0.1)",border:"1px solid rgba(99,102,241,0.25)",
              borderRadius:"14px",padding:"6px 8px",cursor:"pointer"}}>
              <span style={{fontSize:"22px",lineHeight:1}}>{userAvatar}</span>
              <span style={{color:"rgba(255,255,255,0.45)",fontSize:"8px",fontWeight:600,letterSpacing:"0.05em"}}>EDIT</span>
            </button>
            {/* Center: title + date */}
            <div style={{flex:1,textAlign:"center"}}>
              <h1 style={{color:"#F1F5F9",fontSize:"22px",fontWeight:800,
                fontFamily:"'Syne',system-ui,sans-serif",lineHeight:1.1,userSelect:"none"}}>
                Today's Tasks
              </h1>
              <p style={{color:"rgba(255,255,255,0.45)",fontSize:"12px",marginTop:"3px",fontWeight:500}}>
                {today}
              </p>
            </div>
            {/* Right: flame */}
            <button onClick={handleFlameTap} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"2px",
              flexShrink:0,background:"transparent",border:"none",cursor:"pointer",padding:"2px 4px"}}>
              <FlameIcon streak={streak} size={30}/>
              <span style={{color:fs.c2,fontSize:"10px",fontWeight:700,
                textShadow:`0 0 8px ${fs.glow}`}}>{streak}d</span>
            </button>
          </div>
          <WeekBar history={history} selectedDate={selectedDate} onSelectDate={setSelectedDate}/>
          {/* Progress bar */}
          <div style={{marginTop:"8px",marginBottom:"12px"}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:"6px"}}>
              <span style={{color:"rgba(255,255,255,0.5)",fontSize:"11px"}}>Daily progress</span>
              <span style={{color:pct===100?"#4ADE80":"rgba(255,255,255,0.6)",fontSize:"11px",fontWeight:600}}>{pct}%</span>
            </div>
            <div style={{height:"5px",background:"rgba(255,255,255,0.06)",borderRadius:"100px"}}>
              <div style={{height:"100%",width:pct+"%",
                background:pct===100?"linear-gradient(90deg,#22C55E,#4ADE80)":"linear-gradient(90deg,#6366F1,#818CF8)",
                borderRadius:"100px",transition:"width 0.6s cubic-bezier(0.4,0,0.2,1)",
                boxShadow:pct===100?"0 0 12px rgba(34,197,94,0.6)":"0 0 10px rgba(99,102,241,0.4)"}}/>
            </div>
          </div>
          {/* Stats row */}
          <div style={{display:"flex",gap:"8px"}}>
            {[
              {l:"Done",  v:done,       c:"#4ADE80",bg:"rgba(34,197,94,0.1)"},
              {l:"Left",  v:total-done, c:"#818CF8",bg:"rgba(99,102,241,0.1)"},
              {l:"Streak",v:streak+"d", c:fs.c2,    bg:"rgba(0,0,0,0.2)"},
            ].map(s=>(
              <div key={s.l} style={{flex:1,textAlign:"center",background:s.bg,borderRadius:"10px",padding:"8px 4px"}}>
                <p style={{color:s.c,fontSize:"15px",fontWeight:800,fontFamily:"'Syne',sans-serif"}}>{s.v}</p>
                <p style={{color:s.c,fontSize:"9px",fontWeight:600,opacity:0.7,marginTop:"2px",
                  textTransform:"uppercase",letterSpacing:"0.05em"}}>{s.l}</p>
              </div>
            ))}
            {/* Water-fill % card */}
            <div style={{flex:1,textAlign:"center",background:"rgba(0,0,0,0.25)",borderRadius:"10px",
              padding:"8px 4px",position:"relative",overflow:"hidden",minHeight:"52px"}}>
              <div style={{
                position:"absolute",bottom:0,left:0,right:0,
                height:pct+"%",
                background:pct===100?"rgba(34,197,94,0.28)":"rgba(99,102,241,0.22)",
                transition:"height 0.9s cubic-bezier(0.4,0,0.2,1)",
                borderRadius:pct>95?"10px":"0 0 10px 10px",
                animation:"waterRise 2.2s ease-in-out infinite",
              }}/>
              <p style={{position:"relative",zIndex:1,color:pct===100?"#4ADE80":"#818CF8",
                fontSize:"15px",fontWeight:800,fontFamily:"'Syne',sans-serif"}}>{pct}%</p>
              <p style={{position:"relative",zIndex:1,color:pct===100?"#4ADE80":"#818CF8",
                fontSize:"9px",fontWeight:600,opacity:0.7,marginTop:"2px",
                textTransform:"uppercase",letterSpacing:"0.05em"}}>Today</p>
            </div>
          </div>
        </div>

        {/* Past-day banner */}
        {selectedDate!==todayStr&&(
          <div style={{margin:"10px 16px 0",padding:"12px 14px",
            background:"rgba(99,102,241,0.08)",border:"1px solid rgba(99,102,241,0.22)",
            borderRadius:"12px",display:"flex",flexDirection:"column",gap:"10px"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"8px"}}>
              <div style={{minWidth:0}}>
                <p style={{color:"#A5B4FC",fontSize:"12px",fontWeight:700}}>
                  📅 {new Date(selectedDate+"T00:00:00").toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"short"})}
                </p>
                {(()=>{const snap=history.find(h=>h.date===selectedDate);
                  return snap
                    ?<p style={{color:"rgba(255,255,255,0.45)",fontSize:"11px",marginTop:"2px"}}>
                        {snap.allDone?"✅ All done":snap.pct>=50?`⚡ ${snap.pct}% complete`:"❌ Missed"}
                      </p>
                    :<p style={{color:"rgba(255,255,255,0.3)",fontSize:"11px",marginTop:"2px"}}>No data — log it below</p>;
                })()}
              </div>
              <button onClick={()=>setSelectedDate(todayStr)} style={{
                flexShrink:0,background:"rgba(99,102,241,0.15)",border:"1px solid rgba(99,102,241,0.3)",
                borderRadius:"8px",padding:"5px 10px",color:"#A5B4FC",fontSize:"11px",
                cursor:"pointer",fontFamily:"Inter,sans-serif",fontWeight:600,whiteSpace:"nowrap"}}>
                Today →
              </button>
            </div>
            {/* Manual log buttons */}
            <div style={{display:"flex",gap:"8px"}}>
              <button onClick={()=>onLogPastDay(selectedDate,true)} style={{
                flex:1,padding:"8px",borderRadius:"10px",cursor:"pointer",
                background:"rgba(34,197,94,0.15)",border:"1px solid rgba(34,197,94,0.35)",
                color:"#4ADE80",fontSize:"12px",fontWeight:700,fontFamily:"Inter,sans-serif"}}>
                ✅ Mark Done
              </button>
              <button onClick={()=>onLogPastDay(selectedDate,false)} style={{
                flex:1,padding:"8px",borderRadius:"10px",cursor:"pointer",
                background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",
                color:"#F87171",fontSize:"12px",fontWeight:700,fontFamily:"Inter,sans-serif"}}>
                ❌ Mark Missed
              </button>
            </div>
          </div>
        )}

        <MissedTaskAlert history={history} tasks={tasks} onDismiss={()=>{}}/>

        {/* Filter + Add */}
        <div style={{padding:"12px 16px 0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{display:"flex",gap:"6px"}}>
            {[{f:"all",l:"All"},{f:"todo",l:"To do"},{f:"done",l:"Done"}].map(({f,l})=>(
              <button key={f} onClick={()=>setFilter(f)} style={{
                padding:"6px 14px",borderRadius:"100px",border:"none",cursor:"pointer",
                fontSize:"11px",fontWeight:700,letterSpacing:"0.04em",
                background:filter===f?"#6366F1":"rgba(255,255,255,0.07)",
                color:filter===f?"#fff":"rgba(255,255,255,0.55)",
                boxShadow:filter===f?"0 0 14px rgba(99,102,241,0.4)":"none",
                transition:"all 0.2s",fontFamily:"Inter,sans-serif"}}>{l}</button>
            ))}
          </div>
          <button onClick={()=>setShowAdd(true)} style={{padding:"6px 14px",borderRadius:"100px",
            border:"1px solid rgba(99,102,241,0.35)",cursor:"pointer",
            fontSize:"11px",fontWeight:700,background:"rgba(99,102,241,0.12)",
            color:"#A5B4FC",fontFamily:"Inter,sans-serif"}}>+ Add</button>
        </div>

        <p style={{color:"rgba(255,255,255,0.2)",fontSize:"10px",paddingLeft:"18px",paddingTop:"6px",paddingBottom:"2px"}}>
          Hold a task to remove it
        </p>

        {/* Task list */}
        <div style={{padding:"4px 16px 24px",display:"flex",flexDirection:"column",gap:"8px"}}>
          {filtered.map((task,i)=>(
            <TaskRow key={task.id} task={task} i={i}
              onTap={tap} onDelete={deleteTask}
              isDeleting={deletingId===task.id}
              onStartDelete={id=>setDeletingId(id)}
              onCancelDelete={()=>setDeletingId(null)}/>
          ))}
        </div>
      </div>

      <BottomNav active="tasks" onTasks={()=>{}} onFocus={onFocus} onProgress={onProgress} onLeaderboard={onLeaderboard}/>

      {showAdd&&<AddTaskSheet onAdd={t=>{setTasks(p=>[...p,t]);setShowAdd(false);}} onClose={()=>setShowAdd(false)}/>}
    </div>
  );
}

// ── TASK ROW ──────────────────────────────────────────────────────────────────
function TaskRow({task,i,onTap,onDelete,isDeleting,onStartDelete,onCancelDelete}){
  const done=task.status==="done";
  const cc=CAT_COLORS[task.cat]||CAT_COLORS.theory;
  const pressTimer=useRef(null);
  const startPress=()=>{pressTimer.current=setTimeout(()=>onStartDelete(task.id),600);};
  const endPress=()=>clearTimeout(pressTimer.current);
  return(
    <div className={"task-card"+(isDeleting?" shaking":"")}
      onClick={e=>onTap(task,e)}
      onMouseDown={startPress} onMouseUp={endPress} onMouseLeave={endPress}
      onTouchStart={startPress} onTouchEnd={endPress}
      style={{position:"relative",overflow:"visible",
        background:isDeleting?"rgba(239,68,68,0.1)":done?"rgba(34,197,94,0.06)":"rgba(255,255,255,0.035)",
        border:"1px solid "+(isDeleting?"rgba(239,68,68,0.4)":done?"rgba(34,197,94,0.2)":"rgba(255,255,255,0.07)"),
        borderRadius:"16px",padding:"14px 16px",display:"flex",alignItems:"center",gap:"14px",cursor:"pointer",
        animation:`slideUp 0.4s cubic-bezier(0.4,0,0.2,1) ${i*0.04}s both`,
        userSelect:"none",WebkitUserSelect:"none"}}>
      {done&&!isDeleting&&<div style={{position:"absolute",inset:0,borderRadius:"16px",
        background:"rgba(34,197,94,0.08)",pointerEvents:"none"}}/>}
      <div style={{width:"42px",height:"42px",borderRadius:"13px",flexShrink:0,
        background:isDeleting?"rgba(239,68,68,0.15)":cc.bg,
        border:"1px solid "+(isDeleting?"rgba(239,68,68,0.4)":cc.border),
        display:"flex",alignItems:"center",justifyContent:"center",fontSize:"20px"}}>{task.emoji}</div>
      <div style={{flex:1,minWidth:0}}>
        <p style={{fontSize:"14px",fontWeight:600,
          color:isDeleting?"#F87171":done?"rgba(74,222,128,0.7)":"#E2E8F0",
          fontFamily:"Inter,sans-serif",
          textDecoration:done?"line-through":"none",textDecorationColor:"rgba(74,222,128,0.5)"}}>
          {isDeleting?"Hold to delete…":task.title}
        </p>
        {!isDeleting&&(
          <div style={{display:"flex",alignItems:"center",gap:"8px",marginTop:"4px"}}>
            <span style={{background:cc.bg,color:cc.text,fontSize:"9px",fontWeight:700,
              padding:"2px 7px",borderRadius:"100px",textTransform:"uppercase",
              letterSpacing:"0.05em",border:"1px solid "+cc.border}}>{task.cat}</span>
            <span style={{color:"rgba(255,255,255,0.35)",fontSize:"11px"}}>⏱ {task.dur}m</span>
            {task.repeat&&task.repeat!=="none"&&(
              <span style={{color:"rgba(255,255,255,0.25)",fontSize:"10px"}}>🔁 {task.repeat}</span>
            )}
          </div>
        )}
      </div>
      {isDeleting?(
        <button onClick={e=>{e.stopPropagation();onDelete(task.id);}}
          onMouseDown={e=>e.stopPropagation()} onTouchStart={e=>e.stopPropagation()}
          style={{width:"32px",height:"32px",borderRadius:"50%",flexShrink:0,
            background:"rgba(239,68,68,0.25)",border:"1.5px solid rgba(239,68,68,0.5)",
            color:"#F87171",fontSize:"18px",cursor:"pointer",fontWeight:700,
            display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
      ):(
        <div style={{width:"26px",height:"26px",borderRadius:"50%",flexShrink:0,
          background:done?"#22C55E":"transparent",
          border:"2px solid "+(done?"#22C55E":"rgba(255,255,255,0.18)"),
          display:"flex",alignItems:"center",justifyContent:"center",
          transition:"all 0.25s ease",boxShadow:done?"0 0 10px rgba(34,197,94,0.5)":"none"}}>
          {done&&<span style={{color:"#fff",fontSize:"13px",fontWeight:800,
            animation:"checkBounce 0.35s cubic-bezier(0.34,1.56,0.64,1) both"}}>✓</span>}
        </div>
      )}
    </div>
  );
}

// ── ADD TASK SHEET ────────────────────────────────────────────────────────────
const EMOJIS=["✏️","🎨","📐","📏","🖌️","📷","🔢","📓","🧩","💡","🎭","🌿","⚡","🔬","🎯","⚛️","🧪","⚗️"];
const CATS=["drawing","aptitude","theory","health"];
function AddTaskSheet({onAdd,onClose}){
  const [title,setTitle]=useState("");
  const [emoji,setEmoji]=useState("✏️");
  const [cat,setCat]=useState("drawing");
  const [dur,setDur]=useState(30);
  const [repeat,setRepeat]=useState("daily");
  const submit=()=>{if(!title.trim())return;onAdd({id:Date.now(),emoji,title:title.trim(),cat,dur,repeat,status:"upcoming"});};
  return(
    <div style={{position:"fixed",inset:0,zIndex:100,background:"rgba(0,0,0,0.65)",
      display:"flex",alignItems:"flex-end",justifyContent:"center"}}
      onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{background:"#0F172A",borderRadius:"24px 24px 0 0",width:"100%",
        maxWidth:"500px",padding:"24px 20px 40px",border:"1px solid rgba(255,255,255,0.08)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"20px"}}>
          <h3 style={{color:"#F1F5F9",fontSize:"17px",fontWeight:700,fontFamily:"'Syne',sans-serif"}}>New Task</h3>
          <button onClick={onClose} style={{background:"rgba(255,255,255,0.07)",border:"none",borderRadius:"50%",width:"30px",height:"30px",color:"#94A3B8",cursor:"pointer",fontSize:"18px"}}>×</button>
        </div>
        <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Task name…"
          style={{width:"100%",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",
            borderRadius:"12px",padding:"12px 14px",color:"#F1F5F9",fontSize:"14px",
            fontFamily:"Inter,sans-serif",marginBottom:"16px"}}/>
        <p style={{color:"rgba(255,255,255,0.4)",fontSize:"10px",letterSpacing:"0.1em",marginBottom:"8px",textTransform:"uppercase"}}>Emoji</p>
        <div style={{display:"flex",flexWrap:"wrap",gap:"6px",marginBottom:"16px"}}>
          {EMOJIS.map(e=>(
            <button key={e} onClick={()=>setEmoji(e)} style={{width:"36px",height:"36px",borderRadius:"10px",fontSize:"18px",cursor:"pointer",
              background:emoji===e?"rgba(99,102,241,0.3)":"rgba(255,255,255,0.04)",
              border:emoji===e?"1px solid rgba(99,102,241,0.5)":"1px solid transparent"}}>{e}</button>
          ))}
        </div>
        <p style={{color:"rgba(255,255,255,0.4)",fontSize:"10px",letterSpacing:"0.1em",marginBottom:"8px",textTransform:"uppercase"}}>Category</p>
        <div style={{display:"flex",gap:"6px",marginBottom:"16px"}}>
          {CATS.map(c=>{const cc=CAT_COLORS[c];return(
            <button key={c} onClick={()=>setCat(c)} style={{flex:1,padding:"7px 4px",
              background:cat===c?cc.bg:"rgba(255,255,255,0.04)",
              border:"1px solid "+(cat===c?cc.border:"rgba(255,255,255,0.07)"),
              color:cat===c?cc.text:"rgba(255,255,255,0.4)",
              fontSize:"10px",fontWeight:700,textTransform:"uppercase",
              letterSpacing:"0.05em",borderRadius:"8px",cursor:"pointer"}}>{c}</button>
          );})}
        </div>
        <p style={{color:"rgba(255,255,255,0.4)",fontSize:"10px",letterSpacing:"0.1em",marginBottom:"4px",textTransform:"uppercase"}}>Duration: {dur}m</p>
        <input type="range" min="10" max="120" step="5" value={dur} onChange={e=>setDur(+e.target.value)}
          style={{width:"100%",accentColor:"#6366F1",marginBottom:"4px"}}/>
        <div style={{display:"flex",gap:"6px",marginBottom:"16px",flexWrap:"wrap"}}>
          {[15,25,30,45,60].map(v=>(
            <button key={v} onClick={()=>setDur(v)} style={{padding:"4px 10px",borderRadius:"8px",cursor:"pointer",
              background:dur===v?"rgba(99,102,241,0.25)":"rgba(255,255,255,0.05)",
              border:dur===v?"1px solid rgba(99,102,241,0.4)":"1px solid transparent",
              color:dur===v?"#A5B4FC":"rgba(255,255,255,0.35)",fontSize:"11px",fontWeight:600}}>{v}m</button>
          ))}
        </div>
        <p style={{color:"rgba(255,255,255,0.4)",fontSize:"10px",letterSpacing:"0.1em",marginBottom:"8px",textTransform:"uppercase"}}>Repeat</p>
        <div style={{display:"flex",gap:"6px",marginBottom:"22px",flexWrap:"wrap"}}>
          {["daily","weekday","weekly","none"].map(r=>(
            <button key={r} onClick={()=>setRepeat(r)} style={{padding:"6px 12px",borderRadius:"8px",cursor:"pointer",
              background:repeat===r?"rgba(99,102,241,0.2)":"rgba(255,255,255,0.04)",
              border:repeat===r?"1px solid rgba(99,102,241,0.4)":"1px solid rgba(255,255,255,0.07)",
              color:repeat===r?"#A5B4FC":"rgba(255,255,255,0.35)",
              fontSize:"11px",fontWeight:700,textTransform:"capitalize"}}>{r}</button>
          ))}
        </div>
        <button onClick={submit} style={{width:"100%",
          background:"linear-gradient(135deg,rgba(99,102,241,0.4),rgba(139,92,246,0.4))",
          border:"1px solid rgba(99,102,241,0.4)",borderRadius:"14px",padding:"14px",
          color:"#C7D2FE",fontSize:"14px",fontWeight:800,fontFamily:"'Syne',sans-serif",
          cursor:"pointer",letterSpacing:"0.08em"}}>ADD TO TODAY →</button>
      </div>
    </div>
  );
}

// ── CONSISTENCY SCREEN ────────────────────────────────────────────────────────
function ConsistencyScreen({history,tasks,streak,onBack,onTasks,onFocus,onLeaderboard}){
  const now=new Date();
  const todayStr=now.toISOString().slice(0,10);
  const year=now.getFullYear();
  const month=now.getMonth();
  const daysInMonth=new Date(year,month+1,0).getDate();
  const firstDow=new Date(year,month,1).getDay();
  const monthOffset=(firstDow+6)%7;
  const monthName=now.toLocaleDateString("en-IN",{month:"long",year:"numeric"});
  const days=Array.from({length:30},(_,i)=>{
    const d=new Date(now);d.setDate(now.getDate()-(29-i));return d.toISOString().slice(0,10);
  });
  const dayStatus=date=>{
    const snap=history.find(h=>h.date===date);
    if(!snap) return "none";
    if(snap.allDone) return "green";
    if((snap.pct||0)>=50) return "yellow";
    return "red";
  };
  const chartDays=days.slice(-14);
  const chartData=chartDays.map(date=>{
    const snap=history.find(h=>h.date===date);
    return {date,pct:snap?(snap.pct||0):null};
  });
  const W=320,H=130,PAD_X=28,PAD_Y=16;
  const plotW=W-PAD_X*2,plotH=H-PAD_Y*2;
  const valid=chartData.filter(d=>d.pct!==null);
  const pts=valid.map(d=>{
    const idx=chartDays.indexOf(d.date);
    const x=PAD_X+(idx/(chartDays.length-1))*plotW;
    const y=PAD_Y+plotH-(d.pct/100)*plotH;
    return {x,y,pct:d.pct,date:d.date};
  });
  const linePath=pts.map((p,i)=>`${i===0?"M":"L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaPath=pts.length>0
    ?`${linePath} L${pts[pts.length-1].x.toFixed(1)},${(PAD_Y+plotH).toFixed(1)} L${pts[0].x.toFixed(1)},${(PAD_Y+plotH).toFixed(1)} Z`:"";
  const y100=PAD_Y;
  const statusColor={green:"#22C55E",yellow:"#FBBF24",red:"#EF4444",none:"rgba(255,255,255,0.07)"};
  const statusLabel={green:"All done",yellow:"Partial",red:"Missed",none:"No data"};
  const totalDays=history.length;
  const perfectDays=history.filter(h=>h.allDone).length;
  const consistency=totalDays>0?Math.round((perfectDays/totalDays)*100):0;

  return(
    <div className="app-screen" style={{display:"flex",flexDirection:"column",background:"#080C14",
      fontFamily:"Inter,sans-serif",overflow:"hidden"}}>
      {/* Sticky header */}
      <div style={{background:"linear-gradient(180deg,#0D1321,#080C14)",
        padding:"20px 16px 16px",borderBottom:"1px solid rgba(255,255,255,0.05)",flexShrink:0}}>
        <button onClick={onBack} style={{background:"none",border:"none",color:"rgba(255,255,255,0.6)",
          fontSize:"13px",cursor:"pointer",fontFamily:"Inter,sans-serif",
          padding:"0 0 12px",display:"flex",alignItems:"center",gap:"4px"}}>← Back</button>
        <h1 style={{color:"#F1F5F9",fontSize:"22px",fontWeight:800,fontFamily:"'Syne',sans-serif"}}>Your Progress</h1>
        <p style={{color:"rgba(255,255,255,0.4)",fontSize:"12px",marginTop:"2px"}}>You vs 100% consistency</p>
      </div>
      {/* Scrollable content */}
      <div style={{flex:1,overflowY:"auto",WebkitOverflowScrolling:"touch",padding:"16px 16px 32px",
        display:"flex",flexDirection:"column",gap:"16px"}}>
        <div style={{display:"flex",gap:"8px"}}>
          {[
            {l:"Current Streak",v:streak+"d",   c:"#FB923C",bg:"rgba(249,115,22,0.1)"},
            {l:"Perfect Days",  v:perfectDays,   c:"#4ADE80",bg:"rgba(34,197,94,0.1)"},
            {l:"Consistency",   v:consistency+"%",c:consistency>=70?"#4ADE80":consistency>=40?"#FBBF24":"#F87171",bg:"rgba(99,102,241,0.08)"},
          ].map(s=>(
            <div key={s.l} style={{flex:1,textAlign:"center",background:s.bg,borderRadius:"12px",padding:"12px 6px",animation:"revealUp 0.5s ease both"}}>
              <p style={{color:s.c,fontSize:"18px",fontWeight:800,fontFamily:"'Syne',sans-serif"}}>{s.v}</p>
              <p style={{color:"rgba(255,255,255,0.4)",fontSize:"9px",fontWeight:600,marginTop:"3px",textTransform:"uppercase",letterSpacing:"0.05em",lineHeight:1.3}}>{s.l}</p>
            </div>
          ))}
        </div>
        {/* Chart */}
        <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",
          borderRadius:"18px",padding:"16px",animation:"revealUp 0.5s ease 0.1s both"}}>
          <p style={{color:"rgba(255,255,255,0.6)",fontSize:"11px",fontWeight:600,marginBottom:"10px",letterSpacing:"0.06em",textTransform:"uppercase"}}>
            Last 14 days
          </p>
          {pts.length>=2?(
            <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{overflow:"visible"}}>
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366F1" stopOpacity="0.3"/>
                  <stop offset="100%" stopColor="#6366F1" stopOpacity="0"/>
                </linearGradient>
              </defs>
              {[0,25,50,75,100].map(pct=>{
                const y=PAD_Y+plotH-(pct/100)*plotH;
                return(<g key={pct}>
                  <line x1={PAD_X} y1={y} x2={W-PAD_X} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="1"/>
                  <text x={PAD_X-4} y={y+4} textAnchor="end" fill="rgba(255,255,255,0.25)" fontSize="8">{pct}%</text>
                </g>);
              })}
              <line x1={PAD_X} y1={y100} x2={W-PAD_X} y2={y100}
                stroke="#22C55E" strokeWidth="1.5" strokeDasharray="6,4"/>
              <text x={W-PAD_X+4} y={y100+4} fill="#22C55E" fontSize="8">Target</text>
              <path d={areaPath} fill="url(#areaGrad)"/>
              <path d={linePath} fill="none" stroke="#6366F1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              {pts.map((p,i)=>(
                <circle key={i} cx={p.x} cy={p.y} r="5"
                  fill={p.pct>=100?"#22C55E":p.pct>=50?"#FBBF24":"#EF4444"}
                  stroke="#080C14" strokeWidth="2"/>
              ))}
            </svg>
          ):(
            <div style={{height:"130px",display:"flex",alignItems:"center",justifyContent:"center"}}>
              <p style={{color:"rgba(255,255,255,0.25)",fontSize:"13px",fontStyle:"italic"}}>Complete some tasks to see your graph</p>
            </div>
          )}
        </div>
        {/* Month calendar */}
        <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",
          borderRadius:"18px",padding:"16px",animation:"revealUp 0.5s ease 0.2s both"}}>
          <p style={{color:"rgba(255,255,255,0.6)",fontSize:"11px",fontWeight:600,marginBottom:"12px",letterSpacing:"0.06em",textTransform:"uppercase"}}>
            {monthName}
          </p>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:"4px",marginBottom:"4px"}}>
            {["M","T","W","T","F","S","S"].map((d,i)=>(
              <div key={i} style={{textAlign:"center",color:"rgba(255,255,255,0.35)",fontSize:"9px",fontWeight:600,padding:"4px 0"}}>{d}</div>
            ))}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:"4px"}}>
            {Array.from({length:monthOffset},(_,i)=><div key={"e"+i}/>)}
            {Array.from({length:daysInMonth},(_,i)=>{
              const dayNum=i+1;
              const dateStr=`${year}-${String(month+1).padStart(2,"0")}-${String(dayNum).padStart(2,"0")}`;
              const st=dayStatus(dateStr);
              const isToday=dateStr===todayStr;
              const isFuture=new Date(dateStr)>now&&dateStr!==todayStr;
              return(
                <div key={dayNum} title={`${dateStr}: ${statusLabel[st]}`} style={{
                  aspectRatio:"1",borderRadius:"8px",
                  background:isFuture?"rgba(255,255,255,0.03)":statusColor[st],
                  border:isToday?"2px solid #818CF8":"1px solid rgba(255,255,255,0.05)",
                  display:"flex",alignItems:"center",justifyContent:"center",
                  boxShadow:st==="green"&&!isFuture?"0 0 8px rgba(34,197,94,0.4)":
                            st==="yellow"&&!isFuture?"0 0 8px rgba(251,191,36,0.3)":
                            st==="red"&&!isFuture?"0 0 6px rgba(239,68,68,0.3)":"none"}}>
                  <span style={{fontSize:"9px",
                    color:isFuture?"rgba(255,255,255,0.12)":st==="none"?"rgba(255,255,255,0.3)":"rgba(0,0,0,0.75)",
                    fontWeight:700}}>{dayNum}</span>
                </div>
              );
            })}
          </div>
          <div style={{display:"flex",gap:"12px",marginTop:"12px",flexWrap:"wrap"}}>
            {[{c:"#22C55E",l:"All done"},{c:"#FBBF24",l:"Partial"},{c:"#EF4444",l:"Missed"},{c:"rgba(255,255,255,0.07)",l:"No data"}].map(({c,l})=>(
              <div key={l} style={{display:"flex",alignItems:"center",gap:"5px"}}>
                <div style={{width:"10px",height:"10px",borderRadius:"3px",background:c}}/>
                <span style={{color:"rgba(255,255,255,0.45)",fontSize:"10px"}}>{l}</span>
              </div>
            ))}
          </div>
        </div>
        {/* Motivational note */}
        <div style={{background:consistency>=70?"rgba(34,197,94,0.07)":"rgba(99,102,241,0.07)",
          border:"1px solid "+(consistency>=70?"rgba(34,197,94,0.2)":"rgba(99,102,241,0.2)"),
          borderRadius:"14px",padding:"14px 16px",animation:"revealUp 0.5s ease 0.3s both"}}>
          <p style={{color:consistency>=70?"#4ADE80":"#A5B4FC",fontSize:"13px",fontWeight:600,fontFamily:"'Syne',sans-serif"}}>
            {consistency>=70?"You're in the top tier of consistency 🔥 Keep it up."
              :consistency>=40?"You're building momentum. Every green day compounds."
              :"Start small — even one task a day builds the habit."}
          </p>
        </div>
      </div>
      <BottomNav active="progress" onTasks={onTasks} onFocus={onFocus} onProgress={()=>{}} onLeaderboard={onLeaderboard}/>
    </div>
  );
}

// ── LEADERBOARD SCREEN ────────────────────────────────────────────────────────
function LeaderboardScreen({streak,rank,userAvatar,userName,onBack,onTasks,onFocus,onProgress}){
  const data=[
    ...LB_DATA,
    {name:userName||"You",streak,rank,done:Math.round(60+streak*2.5),avatar:userAvatar||"⭐",isYou:true},
  ].sort((a,b)=>a.rank-b.rank);
  const medals=["🥇","🥈","🥉"];
  return(
    <div className="app-screen" style={{display:"flex",flexDirection:"column",background:"#080C14",
      fontFamily:"Inter,sans-serif",overflow:"hidden"}}>
      <div style={{background:"linear-gradient(180deg,#0D1321,#080C14)",padding:"20px 16px 16px",
        borderBottom:"1px solid rgba(255,255,255,0.05)",flexShrink:0}}>
        <button onClick={onBack} style={{background:"none",border:"none",color:"rgba(255,255,255,0.6)",
          fontSize:"13px",cursor:"pointer",fontFamily:"Inter,sans-serif",
          padding:"0 0 12px",display:"flex",alignItems:"center",gap:"4px"}}>← Back</button>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div>
            <h1 style={{color:"#F1F5F9",fontSize:"22px",fontWeight:800,fontFamily:"'Syne',sans-serif"}}>Leaderboard</h1>
            <p style={{color:"rgba(255,255,255,0.4)",fontSize:"12px",marginTop:"3px"}}>Ranked by Consistency Score</p>
          </div>
          <div style={{background:"rgba(251,191,36,0.1)",border:"1px solid rgba(251,191,36,0.25)",
            borderRadius:"12px",padding:"8px 14px",textAlign:"center"}}>
            <p style={{color:"#FBBF24",fontSize:"18px",fontWeight:800,fontFamily:"'Syne',sans-serif"}}>#{rank}</p>
            <p style={{color:"rgba(251,191,36,0.5)",fontSize:"9px",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.05em"}}>Consistency Score</p>
          </div>
        </div>
      </div>
      <div style={{flex:1,overflowY:"auto",WebkitOverflowScrolling:"touch",padding:"12px 16px 32px",
        display:"flex",flexDirection:"column",gap:"8px"}}>
        {data.map((u,i)=>{
          const isTop=i<3,isYou=u.isYou;
          return(
            <div key={u.name} className="rank-row" style={{animationDelay:`${i*0.045}s`,
              background:isYou?"rgba(99,102,241,0.1)":isTop?"rgba(251,191,36,0.05)":"rgba(255,255,255,0.03)",
              border:"1px solid "+(isYou?"rgba(99,102,241,0.3)":isTop?"rgba(251,191,36,0.15)":"rgba(255,255,255,0.06)"),
              borderRadius:"16px",padding:"14px 16px",display:"flex",alignItems:"center",gap:"12px"}}>
              <div style={{width:"28px",textAlign:"center",flexShrink:0}}>
                {isTop?<span style={{fontSize:"18px"}}>{medals[i]}</span>
                      :<span style={{color:"rgba(255,255,255,0.4)",fontSize:"13px",fontWeight:600}}>#{i+1}</span>}
              </div>
              <div style={{width:"38px",height:"38px",borderRadius:"12px",flexShrink:0,
                background:isYou?"rgba(99,102,241,0.2)":"rgba(255,255,255,0.06)",
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:"20px"}}>{u.avatar}</div>
              <div style={{flex:1,minWidth:0}}>
                <p style={{color:isYou?"#A5B4FC":"#E2E8F0",fontSize:"14px",
                  fontWeight:isYou?700:500,fontFamily:isYou?"'Syne',sans-serif":"Inter,sans-serif"}}>
                  {u.name}{isYou?" (you)":""}
                </p>
                <div style={{display:"flex",gap:"8px",marginTop:"3px",alignItems:"center"}}>
                  <span style={{color:"#FB923C",fontSize:"11px"}}>🔥 {u.streak}d</span>
                  <span style={{color:"rgba(255,255,255,0.25)",fontSize:"10px"}}>·</span>
                  <span style={{color:"rgba(255,255,255,0.4)",fontSize:"11px"}}>{u.done}% done</span>
                </div>
              </div>
              <div style={{textAlign:"right",flexShrink:0}}>
                <p style={{color:u.rank<100?"#4ADE80":u.rank<500?"#FBBF24":"#F87171",
                  fontSize:"14px",fontWeight:800,fontFamily:"'Syne',sans-serif"}}>#{u.rank}</p>
                <p style={{color:"rgba(255,255,255,0.3)",fontSize:"9px",marginTop:"2px",textTransform:"uppercase",letterSpacing:"0.05em"}}>Score</p>
              </div>
            </div>
          );
        })}
        <p style={{textAlign:"center",color:"rgba(255,255,255,0.15)",fontSize:"11px",paddingTop:"8px"}}>
          Rankings update daily based on task completion
        </p>
      </div>
      <BottomNav active="board" onTasks={onTasks} onFocus={onFocus} onProgress={onProgress} onLeaderboard={()=>{}}/>
    </div>
  );
}

// ── DEV PANEL ─────────────────────────────────────────────────────────────────
function DevPanel({onClose,tasks,setTasks,history,setHistory,streak,setStreak}){
  const [day,setDay]=useState(()=>load("tint_devday",0));
  const advanceDay=()=>{
    // Mark today complete, then reset tasks as if a new day started
    const today=new Date().toISOString().slice(0,10);
    const study=tasks.filter(t=>t.cat!=="health");
    const doneCount=study.filter(t=>t.status==="done").length||Math.floor(study.length*(0.6+Math.random()*0.4));
    const allDone=doneCount===study.length;
    const pct=study.length?Math.round((doneCount/study.length)*100):0;
    const snap={date:today,allDone,pct,missedCount:study.length-doneCount,skippedTask:null,missedTasks:tasks.filter(tk=>tk.status!=='done').map(tk=>tk.title)};
    setHistory(prev=>{
      const upd=[...prev.filter(h=>h.date!==today),snap];
      save("tint_hist3",upd);
      const sorted=[...upd].sort((a,b)=>b.date.localeCompare(a.date));
      let s=0;
      for(const e of sorted){if(e.allDone){s++;}else{break;}}
      setStreak(s);
      return upd;
    });
    setTasks(prev=>prev.map(t=>({...t,status:"upcoming"})));
    save("tint_alldone_date",""); // reset all-done guard so popup can show again
    const nd=day+1;setDay(nd);save("tint_devday",nd);
  };
  const resetAll=()=>{localStorage.clear();window.location.reload();};
  return(
    <div style={{position:"fixed",inset:0,zIndex:400,background:"rgba(0,0,0,0.7)",
      display:"flex",alignItems:"center",justifyContent:"center"}}
      onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{background:"#0F172A",border:"1px solid rgba(99,102,241,0.5)",
        borderRadius:"20px",padding:"24px",width:"280px",
        boxShadow:"0 20px 60px rgba(0,0,0,0.8)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"16px"}}>
          <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
            <span style={{fontSize:"18px"}}>⚙️</span>
            <span style={{color:"#818CF8",fontSize:"14px",fontWeight:700,letterSpacing:"0.05em",fontFamily:"'Syne',sans-serif"}}>DEV MODE</span>
          </div>
          <button onClick={onClose} style={{background:"rgba(255,255,255,0.07)",border:"none",
            borderRadius:"50%",width:"28px",height:"28px",color:"rgba(255,255,255,0.6)",cursor:"pointer",fontSize:"16px"}}>×</button>
        </div>
        <div style={{background:"rgba(99,102,241,0.1)",border:"1px solid rgba(99,102,241,0.2)",
          borderRadius:"12px",padding:"12px",marginBottom:"14px",textAlign:"center"}}>
          <p style={{color:"rgba(255,255,255,0.45)",fontSize:"10px",marginBottom:"4px",textTransform:"uppercase",letterSpacing:"0.08em"}}>Simulated days</p>
          <p style={{color:"#A5B4FC",fontSize:"28px",fontWeight:800,fontFamily:"'Syne',sans-serif"}}>{day}</p>
        </div>
        <p style={{color:"rgba(255,255,255,0.35)",fontSize:"11px",marginBottom:"14px",lineHeight:1.6,textAlign:"center"}}>
          Skip Day simulates a completed day with random task completion, updates streak + calendar.
        </p>
        <button onClick={advanceDay} style={{width:"100%",
          background:"linear-gradient(135deg,rgba(99,102,241,0.5),rgba(139,92,246,0.4))",
          border:"1px solid rgba(99,102,241,0.5)",borderRadius:"12px",padding:"12px",
          color:"#C7D2FE",fontSize:"13px",fontWeight:800,cursor:"pointer",
          fontFamily:"'Syne',sans-serif",marginBottom:"10px",
          boxShadow:"0 4px 16px rgba(99,102,241,0.3)"}}>
          Next Day →
        </button>
        <button onClick={resetAll} style={{width:"100%",
          background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.3)",
          borderRadius:"12px",padding:"12px",color:"#F87171",fontSize:"13px",
          fontWeight:700,cursor:"pointer",fontFamily:"'Syne',sans-serif"}}>
          Reset All Data
        </button>
      </div>
    </div>
  );
}

// ── ROOT ──────────────────────────────────────────────────────────────────────
export default function TINT(){
  useCSS();
  useEffect(()=>{ requestDailyReminder(); },[]);
  const [screen,setScreen]        = useState("cover");
  const [userName,setUserName]    = useState(()=>load("tint_name",""));
  const [userAvatar,setUserAvatar]= useState(()=>load("tint_avatar","⭐"));
  const [userEmail,setUserEmail]  = useState(()=>load("tint_email",""));
  const [userExams,setUserExams]  = useState(()=>load("tint_exams",[]));
  const [tasks,setTasksRaw]       = useState(()=>load("tint_tasks3",null));
  const [history,setHistoryRaw]   = useState(()=>load("tint_hist3",[]));
  const [streak,setStreak]        = useState(0);
  const [missed,setMissed]        = useState(0);
  const [showEdit,setShowEdit]    = useState(false);
  const [showDev,setShowDev]      = useState(false);

  const setTasks=upd=>{
    setTasksRaw(prev=>{const next=typeof upd==="function"?upd(prev):upd;save("tint_tasks3",next);return next;});
  };
  const setHistory=upd=>{
    setHistoryRaw(prev=>{const next=typeof upd==="function"?upd(prev):upd;save("tint_hist3",next);return next;});
  };

  useEffect(()=>{
    if(!tasks) return;
    const last=load("tint_date","");
    const today=new Date().toISOString().slice(0,10);
    if(last!==today){
      save("tint_date",today);
      setTasksRaw(prev=>{if(!prev)return prev;const next=prev.map(t=>({...t,status:"upcoming"}));save("tint_tasks3",next);return next;});
    }
  },[]);

  useEffect(()=>{
    if(!tasks||tasks.length===0) return;
    const today=new Date().toISOString().slice(0,10);
    const study=tasks.filter(t=>t.cat!=="health");
    if(!study.length) return;
    const doneStudy=study.filter(t=>t.status==="done");
    const allDone=doneStudy.length===study.length;
    const pct=Math.round((doneStudy.length/study.length)*100);
    const skipped=study.filter(t=>t.status==="missed");
    const snap={date:today,allDone,missedCount:skipped.length,pct,skippedTask:skipped[0]?.title||null,missedTasks:tasks.filter(tk=>tk.status!=='done').map(tk=>tk.title)};
    setHistoryRaw(prev=>{
      const upd=[...prev.filter(h=>h.date!==today),snap];
      save("tint_hist3",upd);
      const sorted=[...upd].sort((a,b)=>b.date.localeCompare(a.date));
      let s=0,m=0;
      for(const e of sorted){
        if(e.date===today) continue;
        if(e.allDone){s++;m=0;}else{m++;s=0;break;}
      }
      setStreak(s);setMissed(m);
      return upd;
    });
  },[tasks]);

  const rank=projectedRank(streak,missed);
  const isCarrot=rank<100;

  const handleCoverDone=()=>{
    if(load("tint_onboarded",false)){setScreen("home");}else{setScreen("onboard");}
  };
  const handleOnboardDone=({name,avatar,email,exams,tasks:newTasks})=>{
    setUserName(name);save("tint_name",name);
    setUserAvatar(avatar);save("tint_avatar",avatar);
    setUserEmail(email);save("tint_email",email);
    setUserExams(exams);save("tint_exams",exams);
    setTasks(newTasks);save("tint_onboarded",true);
    setScreen("home");
  };
  const handleSaveProfile=(name,avatar,newExams)=>{
    setUserName(name);save("tint_name",name);
    setUserAvatar(avatar);save("tint_avatar",avatar);
    if(newExams&&newExams.length){
      const changed=JSON.stringify(newExams)!==JSON.stringify(userExams);
      setUserExams(newExams);save("tint_exams",newExams);
      if(changed){
        const seen=new Set();const out=[];
        for(const ex of newExams)
          for(const t of (EXAM_TASKS[ex]||[]))
            if(!seen.has(t.title)){seen.add(t.title);out.push({...t,id:Date.now()+Math.random(),status:"upcoming"});}
        setTasks(out);
      }
    }
    setShowEdit(false);
  };

  const handlePastDayLog=(date,allDone)=>{
    let snap;
    if(allDone){
      const done=tasks.filter(tk=>tk.status==='done').length;
      const total=tasks.length||1;
      const pct=Math.round((done/total)*100);
      const missedCount=total-done;
      snap={date,allDone:missedCount===0,pct,missedCount,skippedTask:null,missedTasks:tasks.filter(tk=>tk.status!=='done').map(tk=>tk.title)};
    }else{
      snap={date,allDone:false,pct:0,missedCount:tasks.length,skippedTask:null,missedTasks:tasks.map(tk=>tk.title)};
    }
    const updHistory=[...history.filter(h=>h.date!==date),snap];
    save("tint_hist3",updHistory);
    setHistoryRaw(updHistory);
    const today=new Date().toISOString().slice(0,10);
    const sorted=[...updHistory].sort((a,b)=>b.date.localeCompare(a.date));
    let s=0,m=0;
    for(const e of sorted){
      if(e.date===today)continue;
      if(e.allDone){s++;m=0;}else{m++;s=0;break;}
    }
    setStreak(s);setMissed(m);
  };

  const activeTasks=tasks||EXAM_TASKS.UCEED.map((t,i)=>({...t,id:i+1,status:"upcoming"}));

  return(
    <div style={{position:"relative",width:"100%",minHeight:"100vh",minHeight:"100dvh",background:"#05070F"}}>
      {screen==="cover"      &&<CoverScreen onDone={handleCoverDone}/>}
      {screen==="onboard"    &&<OnboardingScreen onDone={handleOnboardDone}/>}
      {screen==="home"       &&<HomeScreen
        tasks={activeTasks} setTasks={setTasks}
        streak={streak} missed={missed} rank={rank} isCarrot={isCarrot}
        userName={userName||"Friend"} userAvatar={userAvatar}
        history={history}
        onFocus={()=>setScreen("focus")}
        onProgress={()=>setScreen("progress")}
        onLeaderboard={()=>setScreen("leaderboard")}
        onEditProfile={()=>setShowEdit(true)}
        onOpenDev={()=>setShowDev(true)}
        onLogPastDay={handlePastDayLog}
      />}
      {screen==="focus"      &&<FocusScreen
        onBack={()=>setScreen("home")}
        onTasks={()=>setScreen("home")}
        onFocus={()=>{}}
        onProgress={()=>setScreen("progress")}
        onLeaderboard={()=>setScreen("leaderboard")}
      />}
      {screen==="progress"   &&<ConsistencyScreen
        history={history} tasks={activeTasks} streak={streak}
        onBack={()=>setScreen("home")}
        onTasks={()=>setScreen("home")}
        onFocus={()=>setScreen("focus")}
        onLeaderboard={()=>setScreen("leaderboard")}
      />}
      {screen==="leaderboard"&&<LeaderboardScreen
        streak={streak} rank={rank}
        userAvatar={userAvatar} userName={userName||"You"}
        onBack={()=>setScreen("home")}
        onTasks={()=>setScreen("home")}
        onFocus={()=>setScreen("focus")}
        onProgress={()=>setScreen("progress")}
      />}
      {showEdit&&<EditProfileSheet
        name={userName} avatar={userAvatar} exams={userExams}
        onSave={handleSaveProfile} onClose={()=>setShowEdit(false)}
      />}
      {showDev&&<DevPanel
        onClose={()=>setShowDev(false)}
        tasks={activeTasks} setTasks={setTasks}
        history={history} setHistory={setHistory}
        streak={streak} setStreak={setStreak}
      />}
    </div>
  );
}
