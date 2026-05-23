import { useState, useEffect, useRef } from "react";

// ── STORAGE ───────────────────────────────────────────────────────────────────
function load(key, fb) {
  try { const v=localStorage.getItem(key); return v?JSON.parse(v):fb; } catch(e) { return fb; }
}
function save(key, v) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch(e) {}
}

// ── RANK PROJECTION ───────────────────────────────────────────────────────────
function projectedRank(streak, missedDays) {
  if (missedDays>=14) return 3500; if (missedDays>=7) return 2500;
  if (missedDays>=5)  return 2000; if (missedDays>=3) return 1500;
  if (missedDays>=2)  return 1000; if (missedDays>=1) return 750;
  if (streak>=14) return 51; if (streak>=10) return 51;
  if (streak>=7)  return 65; if (streak>=3)  return 80;
  return 300;
}

// ── FLAME COLOR BY STREAK ─────────────────────────────────────────────────────
function flameStyle(streak) {
  if (streak>=30) return {c1:"#22C55E",c2:"#4ADE80",glow:"rgba(34,197,94,0.6)",label:"green"};
  if (streak>=22) return {c1:"#A855F7",c2:"#C084FC",glow:"rgba(168,85,247,0.6)",label:"purple"};
  if (streak>=15) return {c1:"#3B82F6",c2:"#60A5FA",glow:"rgba(59,130,246,0.6)",label:"blue"};
  if (streak>=8)  return {c1:"#EF4444",c2:"#F87171",glow:"rgba(239,68,68,0.6)", label:"red"};
  if (streak>=4)  return {c1:"#F97316",c2:"#FB923C",glow:"rgba(249,115,22,0.6)",label:"orange"};
  return           {c1:"#FBBF24",c2:"#FDE68A",glow:"rgba(251,191,36,0.5)", label:"yellow"};
}

// ── EXAM TASK PRESETS ─────────────────────────────────────────────────────────
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

// ── CSS ───────────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Inter:wght@400;500;600&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Inter',sans-serif;}

/* ── Cover screen ── */
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

/* ── Cover: whole TINT block spins + expands into full words ── */
@keyframes containerSpin{
  from{transform:rotateY(0deg);}
  to  {transform:rotateY(360deg);}
}
/* ── Quote ── */
@keyframes quoteIn{from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:translateY(0);}}

/* ── Dots ── */
@keyframes dotWave{
  0%,80%,100%{transform:translateY(0);opacity:0.5;}
  40%         {transform:translateY(-9px);opacity:1;}
}

/* ── General ── */
@keyframes slideUp{from{opacity:0;transform:translateY(14px);}to{opacity:1;transform:translateY(0);}}
@keyframes checkBounce{0%{transform:scale(0);}60%{transform:scale(1.3);}80%{transform:scale(0.9);}100%{transform:scale(1);}}
@keyframes flashRed{0%{opacity:0;}30%{opacity:1;}100%{opacity:0;}}
@keyframes rankIn{from{opacity:0;transform:translateX(-12px);}to{opacity:1;transform:translateX(0);}}
.rank-row{animation:rankIn 0.4s ease both;}
.task-card{transition:transform 0.15s ease,box-shadow 0.15s ease;}
.task-card:hover{transform:scale(0.99);}

/* ── Flame flicker ── */
@keyframes flameFlicker{
  0%  {transform:scaleY(1)    rotate(-1deg);}
  20% {transform:scaleY(1.07) rotate(1.5deg);}
  40% {transform:scaleY(0.94) rotate(-2deg);}
  60% {transform:scaleY(1.09) rotate(1deg);}
  80% {transform:scaleY(0.97) rotate(-0.5deg);}
  100%{transform:scaleY(1)    rotate(-1deg);}
}
.flame-anim{animation:flameFlicker 0.85s ease-in-out infinite;transform-origin:bottom center;}

/* ── Shake (long-press feedback) ── */
@keyframes shake{
  0%,100%{transform:translateX(0);}
  20%    {transform:translateX(-4px);}
  40%    {transform:translateX(4px);}
  60%    {transform:translateX(-3px);}
  80%    {transform:translateX(3px);}
}
.shaking{animation:shake 0.4s ease both;}

/* ── Consistency graph ── */
@keyframes revealUp{from{opacity:0;transform:translateY(20px);}to{opacity:1;transform:translateY(0);}}

/* ── Onboarding ── */
@keyframes fadeIn{from{opacity:0;}to{opacity:1;}}

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

// ── CONFETTI ──────────────────────────────────────────────────────────────────
const CC=["#22C55E","#38BDF8","#A78BFA","#FBBF24","#F97316","#EC4899","#84CC16"];
function Confetti({x,y}){
  const [pieces]=useState(()=>Array.from({length:28},(_,i)=>({
    id:i,color:CC[i%CC.length],angle:(i/28)*360,
    speed:Math.random()*5+3,size:Math.random()*6+4,
    rot:Math.random()*360,circ:Math.random()>0.5,
  })));
  const [t,setT]=useState(0);
  useEffect(()=>{
    let raf,tick=0;
    const go=()=>{tick++;setT(tick);if(tick<35)raf=requestAnimationFrame(go);};
    raf=requestAnimationFrame(go);
    return ()=>cancelAnimationFrame(raf);
  },[]);
  const prog=Math.min(t/35,1);
  return(
    <div style={{position:"fixed",left:x,top:y,pointerEvents:"none",zIndex:999}}>
      {pieces.map(p=>{
        const rad=p.angle*Math.PI/180;
        const dist=p.speed*prog*18;
        return <div key={p.id} style={{
          position:"absolute",width:p.size,height:p.size,background:p.color,
          borderRadius:p.circ?"50%":"3px",
          left:Math.cos(rad)*dist,top:Math.sin(rad)*dist-prog*30,
          opacity:Math.max(0,1-prog*1.4),
          transform:`rotate(${p.rot+prog*3}deg)`,
          boxShadow:"0 0 4px "+p.color,
        }}/>;
      })}
    </div>
  );
}

// ── FLAME ICON ────────────────────────────────────────────────────────────────
function FlameIcon({streak,size=28}){
  const fs=flameStyle(streak);
  const uid="fg"+streak;
  return(
    <svg width={size} height={size*1.15} viewBox="0 0 24 28"
      className="flame-anim"
      style={{filter:`drop-shadow(0 0 7px ${fs.glow})`}}>
      <defs>
        <linearGradient id={uid} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor={fs.c1}/>
          <stop offset="100%" stopColor={fs.c2}/>
        </linearGradient>
      </defs>
      <path d="M12 2 C14 5 19 9 19 15.5 C19 20.5 16 25.5 12 27 C8 25.5 5 20.5 5 15.5 C5 9 10 5 12 2Z"
        fill={`url(#${uid})`} opacity="0.9"/>
      <path d="M12 10 C13 12 15 15 15 18 C15 20.5 13.5 22.5 12 23.5 C10.5 22.5 9 20.5 9 18 C9 15 11 12 12 10Z"
        fill="rgba(255,255,255,0.42)"/>
    </svg>
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
const WORDS=[{l:"T",r:"here"},{l:"I",r:"s"},{l:"N",r:"o"},{l:"T",r:"omorrow"}];
const STARS=[
  {t:"9%", l:"8%", sz:2,  c:"s1"},{t:"14%",l:"85%",sz:1.5,c:"s2"},
  {t:"70%",l:"92%",sz:2,  c:"s3"},{t:"80%",l:"4%", sz:1.5,c:"s1"},
  {t:"45%",l:"96%",sz:1,  c:"s4"},{t:"30%",l:"50%",sz:1,  c:"s2"},
  {t:"88%",l:"58%",sz:1.5,c:"s3"},{t:"55%",l:"2%", sz:1,  c:"s4"},
];

function CoverScreen({onDone}){
  // phases: "tint" → "spin" → "done" → "quote"
  const [phase,setPhase]=useState("tint");
  const [quote]=useState(QUOTES[Math.floor(Math.random()*QUOTES.length)]);

  // spin lasts 1.6s; expansion happens during that same window
  useEffect(()=>{
    const t1=setTimeout(()=>setPhase("spin"), 800);   // start spin + expansion
    const t2=setTimeout(()=>setPhase("done"), 2500);  // spin done, words fully visible
    const t3=setTimeout(()=>setPhase("quote"),2900);  // quote + dots — tight after done
    const t4=setTimeout(()=>onDone(),         5400);
    return()=>[t1,t2,t3,t4].forEach(clearTimeout);
  },[]);

  const LETTERS=["T","I","N","T"];
  const RESTS  =["here","s","o","omorrow"];

  const spinning = phase==="spin";
  const settled  = phase==="done"||phase==="quote";
  const showQ    = phase==="quote";

  return(
    <div style={{
      position:"fixed",inset:0,background:"#05070F",display:"flex",
      flexDirection:"column",alignItems:"center",justifyContent:"center",overflow:"hidden",
    }}>
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

        {/* ── Perspective wrapper ── */}
        <div style={{perspective:"900px",perspectiveOrigin:"center center",marginBottom:"22px"}}>

          {/* ── This whole block rotates as one unit ── */}
          <div style={{
            display:"inline-flex",
            alignItems:"baseline",
            // gap grows during spin so words have room as they expand
            gap: settled?"10px":spinning?"8px":"3px",
            transition:"gap 1.6s cubic-bezier(0.4,0,0.2,1)",
            // spin animation fires when phase = "spin"
            animation: spinning
              ?"containerSpin 1.6s cubic-bezier(0.25,0.46,0.45,0.94) forwards"
              :"none",
          }}>
            {LETTERS.map((l,i)=>(
              <div key={i} style={{display:"inline-flex",alignItems:"baseline"}}>

                {/* Key letter — large before spin, shrinks during spin via font-size transition */}
                <span style={{
                  fontFamily:"'Syne',sans-serif",fontWeight:800,
                  color:"#fff",display:"inline-block",
                  // starts at 68px, transitions to 26px when spin begins
                  fontSize: (spinning||settled)?"26px":"68px",
                  transition:"font-size 1.5s cubic-bezier(0.4,0,0.2,1)",
                  lineHeight:1,
                }}>{l}</span>

                {/* Rest of word — expands outward during spin */}
                <span style={{
                  fontFamily:"'Syne',sans-serif",fontWeight:700,
                  fontSize:"26px",color:"rgba(255,255,255,0.8)",
                  display:"inline-block",overflow:"hidden",whiteSpace:"nowrap",
                  // starts expanding as soon as spin begins, staggered per word
                  maxWidth: (spinning||settled)?"200px":"0px",
                  opacity:  (spinning||settled)?1:0,
                  transition:`max-width 1.4s cubic-bezier(0.22,1,0.36,1) ${i*0.1}s,
                              opacity   1.0s ease                         ${0.1+i*0.1}s`,
                  lineHeight:1,
                }}>{RESTS[i]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Glow bar */}
        <div style={{display:"flex",justifyContent:"center",marginBottom:"26px"}}>
          <div className="glow-bar" style={{
            width:settled?"260px":"70px",
            transition:"width 0.7s ease 0.4s",
          }}/>
        </div>

        {/* Quote */}
        <div style={{height:"58px",display:"flex",alignItems:"center",justifyContent:"center"}}>
          {showQ&&(
            <p style={{
              color:"rgba(255,255,255,0.38)",fontSize:"13px",fontWeight:400,
              lineHeight:1.75,maxWidth:"270px",fontStyle:"italic",textAlign:"center",
              animation:"quoteIn 0.6s ease forwards",fontFamily:"Inter,sans-serif",
            }}>"{quote}"</p>
          )}
        </div>

        {/* Dots — purple → indigo → deep blue, increasing size + glow */}
        {showQ&&(
          <div style={{
            display:"flex",gap:"10px",justifyContent:"center",alignItems:"center",marginTop:"4px",
            animation:"quoteIn 0.35s ease forwards", // quick fade-in so they don't lag
          }}>
            {[
              {bg:"#A855F7",glow:"rgba(168,85,247,0.7)",size:"7px", delay:"0s"},
              {bg:"#6366F1",glow:"rgba(99,102,241,0.7)", size:"10px",delay:"0.18s"},
              {bg:"#3B5BDB",glow:"rgba(59,91,219,0.8)",  size:"13px",delay:"0.36s"},
            ].map((d,i)=>(
              <div key={i} style={{
                width:d.size,height:d.size,borderRadius:"50%",
                background:d.bg,flexShrink:0,
                boxShadow:`0 0 10px ${d.glow},0 0 22px ${d.glow}`,
                animation:`dotWave 1.3s ease-in-out infinite`,
                animationDelay:d.delay,
              }}/>
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
  const [step,setStep]=useState(0); // 0=name+avatar, 1=email+exams
  const avatarRef=useRef(null);

  const toggleExam=e=>setExams(p=>p.includes(e)?p.filter(x=>x!==e):[...p,e]);

  const buildTasks=()=>{
    const seen=new Set();
    const out=[];
    const selected=exams.length?exams:["UCEED"];
    for(const ex of selected){
      for(const t of (EXAM_TASKS[ex]||[])){
        if(!seen.has(t.title)){
          seen.add(t.title);
          out.push({...t,id:Date.now()+Math.random(),status:"upcoming"});
        }
      }
    }
    return out;
  };

  const submit=()=>{
    if(!name.trim()) return;
    const tasks=buildTasks();
    onDone({name:name.trim(),avatar,email:email.trim(),exams,tasks});
  };

  const inp={
    width:"100%",background:"rgba(255,255,255,0.05)",
    border:"1px solid rgba(255,255,255,0.12)",borderRadius:"14px",
    padding:"13px 16px",color:"#F1F5F9",fontSize:"15px",
    fontFamily:"Inter,sans-serif",transition:"border-color 0.2s",
  };

  return(
    <div style={{
      position:"fixed",inset:0,background:"#05070F",
      display:"flex",flexDirection:"column",alignItems:"center",
      justifyContent:"center",overflow:"hidden",padding:"0 0 32px",
    }}>
      {/* Background orbs */}
      <div className="cover-orb1" style={{opacity:0.5}}/>
      <div className="cover-orb2" style={{opacity:0.4}}/>
      <div className="grid"/>

      <div style={{
        position:"relative",zIndex:10,width:"100%",maxWidth:"420px",
        padding:"0 24px",animation:"fadeIn 0.5s ease forwards",
      }}>
        {/* Logo */}
        <div style={{textAlign:"center",marginBottom:"28px"}}>
          <div style={{display:"flex",justifyContent:"center",gap:"2px",marginBottom:"8px"}}>
            {["T","I","N","T"].map((l,i)=>(
              <span key={i} style={{
                fontFamily:"'Syne',sans-serif",fontWeight:800,
                fontSize:"32px",color:"#fff",
                textShadow:"0 0 20px rgba(99,102,241,0.5)",
              }}>{l}</span>
            ))}
          </div>
          <p style={{color:"rgba(255,255,255,0.3)",fontSize:"12px",letterSpacing:"0.2em",textTransform:"uppercase"}}>
            Let's set you up
          </p>
        </div>

        {step===0?(
          <div style={{display:"flex",flexDirection:"column",gap:"18px"}}>
            <div>
              <p style={{color:"rgba(255,255,255,0.4)",fontSize:"11px",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:"8px"}}>
                Your name
              </p>
              <input
                value={name} onChange={e=>setName(e.target.value)}
                placeholder="Enter your name…"
                style={inp}
                onKeyDown={e=>e.key==="Enter"&&name.trim()&&setStep(1)}
              />
            </div>

            <div>
              <p style={{color:"rgba(255,255,255,0.4)",fontSize:"11px",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:"8px"}}>
                Pick your avatar
              </p>
              <div ref={avatarRef} style={{
                display:"flex",gap:"8px",overflowX:"auto",paddingBottom:"6px",
                scrollbarWidth:"thin",
              }}>
                {AVATARS.map(a=>(
                  <button key={a} onClick={()=>setAvatar(a)} style={{
                    width:"46px",height:"46px",borderRadius:"14px",flexShrink:0,
                    fontSize:"22px",cursor:"pointer",
                    background:avatar===a?"rgba(99,102,241,0.3)":"rgba(255,255,255,0.05)",
                    border:avatar===a?"2px solid rgba(99,102,241,0.7)":"2px solid transparent",
                    transition:"all 0.15s ease",
                    transform:avatar===a?"scale(1.1)":"scale(1)",
                    boxShadow:avatar===a?"0 0 14px rgba(99,102,241,0.4)":"none",
                  }}>{a}</button>
                ))}
              </div>
            </div>

            <button onClick={()=>name.trim()&&setStep(1)} style={{
              width:"100%",
              background:name.trim()
                ?"linear-gradient(135deg,rgba(99,102,241,0.5),rgba(139,92,246,0.4))"
                :"rgba(255,255,255,0.05)",
              border:"1px solid "+(name.trim()?"rgba(99,102,241,0.5)":"rgba(255,255,255,0.1)"),
              borderRadius:"14px",padding:"14px",
              color:name.trim()?"#C7D2FE":"rgba(255,255,255,0.2)",
              fontSize:"14px",fontWeight:800,fontFamily:"'Syne',sans-serif",
              letterSpacing:"0.08em",cursor:name.trim()?"pointer":"not-allowed",
              transition:"all 0.2s",
            }}>NEXT →</button>
          </div>
        ):(
          <div style={{display:"flex",flexDirection:"column",gap:"18px"}}>
            <div>
              <p style={{color:"rgba(255,255,255,0.4)",fontSize:"11px",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:"8px"}}>
                Email (optional)
              </p>
              <input
                type="email" value={email} onChange={e=>setEmail(e.target.value)}
                placeholder="your@email.com"
                style={inp}
              />
            </div>

            <div>
              <p style={{color:"rgba(255,255,255,0.4)",fontSize:"11px",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:"10px"}}>
                Exams you're preparing for
              </p>
              <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
                {EXAMS.map(ex=>{
                  const sel=exams.includes(ex);
                  return(
                    <button key={ex} onClick={()=>toggleExam(ex)} style={{
                      padding:"10px 20px",borderRadius:"12px",
                      background:sel?"rgba(99,102,241,0.25)":"rgba(255,255,255,0.05)",
                      border:"1.5px solid "+(sel?"rgba(99,102,241,0.6)":"rgba(255,255,255,0.1)"),
                      color:sel?"#A5B4FC":"rgba(255,255,255,0.4)",
                      fontSize:"13px",fontWeight:700,cursor:"pointer",
                      fontFamily:"'Syne',sans-serif",letterSpacing:"0.05em",
                      transform:sel?"scale(1.04)":"scale(1)",
                      transition:"all 0.18s ease",
                      boxShadow:sel?"0 0 16px rgba(99,102,241,0.3)":"none",
                    }}>{ex}</button>
                  );
                })}
              </div>
              {exams.length>0&&(
                <p style={{color:"rgba(99,102,241,0.6)",fontSize:"11px",marginTop:"8px"}}>
                  Tasks will be loaded for: {exams.join(", ")}
                </p>
              )}
            </div>

            <div style={{display:"flex",gap:"10px"}}>
              <button onClick={()=>setStep(0)} style={{
                flex:1,background:"rgba(255,255,255,0.05)",
                border:"1px solid rgba(255,255,255,0.1)",borderRadius:"14px",
                padding:"13px",color:"rgba(255,255,255,0.4)",
                fontSize:"13px",fontWeight:700,cursor:"pointer",
                fontFamily:"Inter,sans-serif",
              }}>← Back</button>
              <button onClick={submit} style={{
                flex:2,
                background:"linear-gradient(135deg,rgba(99,102,241,0.5),rgba(139,92,246,0.4))",
                border:"1px solid rgba(99,102,241,0.5)",borderRadius:"14px",
                padding:"13px",color:"#C7D2FE",
                fontSize:"14px",fontWeight:800,
                fontFamily:"'Syne',sans-serif",letterSpacing:"0.08em",cursor:"pointer",
              }}>LET'S GO →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── HOME SCREEN ───────────────────────────────────────────────────────────────
function HomeScreen({tasks,setTasks,streak,rank,isCarrot,userName,userAvatar,onProgress,onLeaderboard}){
  const [confettis,setConfettis]=useState([]);
  const [redFlash,setRedFlash]=useState(false);
  const [filter,setFilter]=useState("all");
  const [showAdd,setShowAdd]=useState(false);
  const [deletingId,setDeletingId]=useState(null);

  const done=tasks.filter(t=>t.status==="done").length;
  const total=tasks.length;
  const pct=total>0?Math.round((done/total)*100):0;
  const fs=flameStyle(streak);

  const tap=(task,e)=>{
    if(task.id===deletingId){setDeletingId(null);return;}
    if(task.status==="missed"){
      setRedFlash(true);setTimeout(()=>setRedFlash(false),500);return;
    }
    const rect=e.currentTarget.getBoundingClientRect();
    const cx=rect.left+rect.width/2,cy=rect.top+rect.height/2;
    if(task.status!=="done"){
      const id=Date.now();
      setConfettis(p=>[...p,{id,x:cx,y:cy}]);
      setTimeout(()=>setConfettis(p=>p.filter(c=>c.id!==id)),1200);
    }
    setTasks(prev=>prev.map(t=>t.id===task.id?{...t,status:t.status==="done"?"upcoming":"done"}:t));
  };

  const deleteTask=id=>setTasks(prev=>prev.filter(t=>t.id!==id));

  const filtered=filter==="all"?tasks
    :filter==="done"?tasks.filter(t=>t.status==="done")
    :tasks.filter(t=>t.status==="upcoming");

  const today=new Date().toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long"});

  return(
    <div style={{background:"#080C14",minHeight:"100vh",fontFamily:"Inter,sans-serif"}}>
      {confettis.map(c=><Confetti key={c.id} x={c.x} y={c.y}/>)}
      {redFlash&&<div style={{
        position:"fixed",inset:0,background:"rgba(239,68,68,0.18)",
        zIndex:998,animation:"flashRed 0.5s ease forwards",pointerEvents:"none",
      }}/>}
      {done===total&&total>0&&<div style={{
        position:"fixed",inset:0,pointerEvents:"none",zIndex:0,
        background:"radial-gradient(ellipse at 50% 0%,rgba(34,197,94,0.07),transparent 60%)",
      }}/>}

      {/* HEADER */}
      <div style={{
        background:"linear-gradient(180deg,#0D1321 0%,#080C14 100%)",
        padding:"24px 20px 16px",
        borderBottom:"1px solid rgba(255,255,255,0.05)",
      }}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          {/* Left: avatar + name + date + title */}
          <div>
            <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"4px"}}>
              <div style={{
                width:"38px",height:"38px",borderRadius:"12px",fontSize:"20px",
                background:"rgba(99,102,241,0.15)",border:"1.5px solid rgba(99,102,241,0.3)",
                display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,
              }}>{userAvatar}</div>
              <div>
                <p style={{color:"rgba(255,255,255,0.45)",fontSize:"11px",fontWeight:500,lineHeight:1.2}}>
                  Hey, {userName} 👋
                </p>
                <p style={{color:"rgba(255,255,255,0.28)",fontSize:"11px",fontWeight:400}}>
                  {today}
                </p>
              </div>
            </div>
            <h1 style={{
              color:"#F1F5F9",fontSize:"22px",fontWeight:800,
              fontFamily:"'Syne',sans-serif",marginTop:"6px",
            }}>Today's Tasks</h1>
          </div>

          {/* Right: animated flame streak */}
          <button onClick={onProgress} style={{
            display:"flex",flexDirection:"column",alignItems:"center",gap:"4px",
            background:"rgba(0,0,0,0)",border:"none",cursor:"pointer",padding:"4px 8px",
          }}>
            <FlameIcon streak={streak} size={32}/>
            <span style={{
              color:fs.c2,fontSize:"11px",fontWeight:700,
              textShadow:`0 0 8px ${fs.glow}`,
            }}>{streak}d</span>
          </button>
        </div>

        {/* Progress bar */}
        <div style={{marginTop:"14px",marginBottom:"12px"}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:"6px"}}>
            <span style={{color:"rgba(255,255,255,0.4)",fontSize:"11px"}}>Daily progress</span>
            <span style={{color:pct===100?"#4ADE80":"rgba(255,255,255,0.5)",fontSize:"11px",fontWeight:600}}>{pct}%</span>
          </div>
          <div style={{height:"5px",background:"rgba(255,255,255,0.06)",borderRadius:"100px"}}>
            <div style={{
              height:"100%",width:pct+"%",
              background:pct===100?"linear-gradient(90deg,#22C55E,#4ADE80)":"linear-gradient(90deg,#6366F1,#818CF8)",
              borderRadius:"100px",transition:"width 0.6s cubic-bezier(0.4,0,0.2,1)",
              boxShadow:pct===100?"0 0 12px rgba(34,197,94,0.6)":"0 0 10px rgba(99,102,241,0.4)",
            }}/>
          </div>
        </div>

        {/* Stats row */}
        <div style={{display:"flex",gap:"8px"}}>
          {[
            {l:"Done",  v:done,       c:"#4ADE80",bg:"rgba(34,197,94,0.1)"},
            {l:"Left",  v:total-done, c:"#818CF8",bg:"rgba(99,102,241,0.1)"},
            {l:"Streak",v:streak+"d", c:fs.c2,    bg:"rgba(0,0,0,0.2)"},
            {l:"Rank",  v:"#"+rank,   c:isCarrot?"#4ADE80":"#F87171",bg:isCarrot?"rgba(34,197,94,0.08)":"rgba(239,68,68,0.08)"},
          ].map(s=>(
            <div key={s.l} style={{flex:1,textAlign:"center",background:s.bg,borderRadius:"10px",padding:"8px 4px"}}>
              <p style={{color:s.c,fontSize:"15px",fontWeight:800,fontFamily:"'Syne',sans-serif"}}>{s.v}</p>
              <p style={{color:s.c,fontSize:"9px",fontWeight:600,opacity:0.7,marginTop:"2px",textTransform:"uppercase",letterSpacing:"0.05em"}}>{s.l}</p>
            </div>
          ))}
        </div>
      </div>

      {/* All-done banner */}
      {done===total&&total>0&&(
        <div style={{
          margin:"12px 16px 0",background:"rgba(34,197,94,0.08)",
          border:"1px solid rgba(34,197,94,0.25)",borderRadius:"14px",
          padding:"12px 16px",display:"flex",alignItems:"center",gap:"10px",
        }}>
          <span style={{fontSize:"22px"}}>🎉</span>
          <div>
            <p style={{color:"#4ADE80",fontSize:"13px",fontWeight:700,fontFamily:"'Syne',sans-serif"}}>All done for today!</p>
            <p style={{color:"rgba(74,222,128,0.5)",fontSize:"11px",marginTop:"1px"}}>Your streak is safe. See you tomorrow.</p>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div style={{display:"flex",gap:"6px",padding:"14px 16px 8px",alignItems:"center"}}>
        {[{f:"all",l:"All"},{f:"todo",l:"To do"},{f:"done",l:"Done"}].map(({f,l})=>(
          <button key={f} onClick={()=>setFilter(f)} style={{
            padding:"6px 14px",borderRadius:"100px",border:"none",cursor:"pointer",
            fontSize:"11px",fontWeight:700,letterSpacing:"0.04em",
            background:filter===f?"#6366F1":"rgba(255,255,255,0.05)",
            color:filter===f?"#fff":"rgba(255,255,255,0.4)",
            boxShadow:filter===f?"0 0 14px rgba(99,102,241,0.4)":"none",
            transition:"all 0.2s",fontFamily:"Inter,sans-serif",
          }}>{l}</button>
        ))}
        <button onClick={()=>setShowAdd(true)} style={{
          marginLeft:"auto",padding:"6px 14px",borderRadius:"100px",
          border:"1px solid rgba(99,102,241,0.35)",cursor:"pointer",
          fontSize:"11px",fontWeight:700,background:"rgba(99,102,241,0.12)",
          color:"#818CF8",fontFamily:"Inter,sans-serif",
        }}>+ Add</button>
      </div>

      {/* Hint */}
      <p style={{color:"rgba(255,255,255,0.15)",fontSize:"10px",paddingLeft:"18px",paddingBottom:"4px"}}>
        Hold a task to remove it
      </p>

      {/* Task list */}
      <div style={{padding:"4px 16px 100px",display:"flex",flexDirection:"column",gap:"8px"}}>
        {filtered.map((task,i)=>(
          <TaskRow key={task.id} task={task} i={i}
            onTap={tap}
            onDelete={deleteTask}
            isDeleting={deletingId===task.id}
            onStartDelete={id=>setDeletingId(id)}
            onCancelDelete={()=>setDeletingId(null)}
          />
        ))}
      </div>

      {/* Bottom nav */}
      <div style={{
        position:"fixed",bottom:0,left:0,right:0,
        background:"rgba(8,12,20,0.95)",backdropFilter:"blur(12px)",
        borderTop:"1px solid rgba(255,255,255,0.06)",padding:"10px 24px 20px",
        display:"flex",justifyContent:"space-around",
      }}>
        {[
          {icon:"📋",label:"Tasks",   active:true,  fn:()=>{}},
          {icon:"📊",label:"Progress",active:false, fn:onProgress},
          {icon:"👥",label:"Board",   active:false, fn:onLeaderboard},
        ].map(n=>(
          <button key={n.label} onClick={n.fn} style={{
            display:"flex",flexDirection:"column",alignItems:"center",gap:"3px",
            background:"none",border:"none",cursor:"pointer",padding:"4px 16px",
          }}>
            <span style={{fontSize:"20px"}}>{n.icon}</span>
            <span style={{fontSize:"10px",fontWeight:700,letterSpacing:"0.04em",
              color:n.active?"#818CF8":"rgba(255,255,255,0.3)"}}>{n.label}</span>
          </button>
        ))}
      </div>

      {showAdd&&<AddTaskSheet
        onAdd={t=>{setTasks(p=>[...p,t]);setShowAdd(false);}}
        onClose={()=>setShowAdd(false)}
      />}
    </div>
  );
}

// ── TASK ROW ──────────────────────────────────────────────────────────────────
function TaskRow({task,i,onTap,onDelete,isDeleting,onStartDelete,onCancelDelete}){
  const done=task.status==="done";
  const cc=CAT_COLORS[task.cat]||CAT_COLORS.theory;
  const pressTimer=useRef(null);

  const startPress=()=>{
    pressTimer.current=setTimeout(()=>{
      onStartDelete(task.id);
    },600);
  };
  const endPress=()=>clearTimeout(pressTimer.current);

  return(
    <div
      className={"task-card"+(isDeleting?" shaking":"")}
      onClick={e=>onTap(task,e)}
      onMouseDown={startPress} onMouseUp={endPress} onMouseLeave={endPress}
      onTouchStart={startPress} onTouchEnd={endPress}
      style={{
        position:"relative",overflow:"visible",
        background:isDeleting?"rgba(239,68,68,0.1)":done?"rgba(34,197,94,0.06)":"rgba(255,255,255,0.035)",
        border:"1px solid "+(isDeleting?"rgba(239,68,68,0.4)":done?"rgba(34,197,94,0.2)":"rgba(255,255,255,0.07)"),
        borderRadius:"16px",padding:"14px 16px",
        display:"flex",alignItems:"center",gap:"14px",cursor:"pointer",
        animation:`slideUp 0.4s cubic-bezier(0.4,0,0.2,1) ${i*0.04}s both`,
        userSelect:"none",WebkitUserSelect:"none",
      }}>
      {done&&!isDeleting&&<div style={{position:"absolute",inset:0,borderRadius:"16px",background:"rgba(34,197,94,0.08)",pointerEvents:"none"}}/>}

      <div style={{
        width:"42px",height:"42px",borderRadius:"13px",flexShrink:0,
        background:isDeleting?"rgba(239,68,68,0.15)":cc.bg,
        border:"1px solid "+(isDeleting?"rgba(239,68,68,0.4)":cc.border),
        display:"flex",alignItems:"center",justifyContent:"center",fontSize:"20px",
      }}>{task.emoji}</div>

      <div style={{flex:1,minWidth:0}}>
        <p style={{
          fontSize:"14px",fontWeight:600,
          color:isDeleting?"#F87171":done?"rgba(74,222,128,0.7)":"#E2E8F0",
          fontFamily:"Inter,sans-serif",
          textDecoration:done?"line-through":"none",
          textDecorationColor:"rgba(74,222,128,0.5)",
        }}>{isDeleting?"Hold to delete…":task.title}</p>
        {!isDeleting&&(
          <div style={{display:"flex",alignItems:"center",gap:"8px",marginTop:"4px"}}>
            <span style={{
              background:cc.bg,color:cc.text,fontSize:"9px",fontWeight:700,
              padding:"2px 7px",borderRadius:"100px",textTransform:"uppercase",
              letterSpacing:"0.05em",border:"1px solid "+cc.border,
            }}>{task.cat}</span>
            <span style={{color:"rgba(255,255,255,0.25)",fontSize:"11px"}}>⏱ {task.dur}m</span>
            {task.repeat&&task.repeat!=="none"&&(
              <span style={{color:"rgba(255,255,255,0.2)",fontSize:"10px"}}>🔁 {task.repeat}</span>
            )}
          </div>
        )}
      </div>

      {isDeleting?(
        <button
          onClick={e=>{e.stopPropagation();onDelete(task.id);}}
          style={{
            width:"32px",height:"32px",borderRadius:"50%",flexShrink:0,
            background:"rgba(239,68,68,0.25)",border:"1.5px solid rgba(239,68,68,0.5)",
            color:"#F87171",fontSize:"18px",cursor:"pointer",fontWeight:700,
            display:"flex",alignItems:"center",justifyContent:"center",
          }}
          onMouseDown={e=>e.stopPropagation()}
          onTouchStart={e=>e.stopPropagation()}
        >✕</button>
      ):(
        <div style={{
          width:"26px",height:"26px",borderRadius:"50%",flexShrink:0,
          background:done?"#22C55E":"transparent",
          border:"2px solid "+(done?"#22C55E":"rgba(255,255,255,0.18)"),
          display:"flex",alignItems:"center",justifyContent:"center",
          transition:"all 0.25s ease",
          boxShadow:done?"0 0 10px rgba(34,197,94,0.5)":"none",
        }}>
          {done&&<span style={{color:"#fff",fontSize:"13px",fontWeight:800,animation:"checkBounce 0.35s cubic-bezier(0.34,1.56,0.64,1) both"}}>✓</span>}
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
  const submit=()=>{
    if(!title.trim()) return;
    onAdd({id:Date.now(),emoji,title:title.trim(),cat,dur,repeat,status:"upcoming"});
  };
  return(
    <div style={{
      position:"fixed",inset:0,zIndex:100,background:"rgba(0,0,0,0.65)",
      display:"flex",alignItems:"flex-end",justifyContent:"center",
    }} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{
        background:"#0F172A",borderRadius:"24px 24px 0 0",width:"100%",
        maxWidth:"500px",padding:"24px 20px 40px",border:"1px solid rgba(255,255,255,0.08)",
      }}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"20px"}}>
          <h3 style={{color:"#F1F5F9",fontSize:"17px",fontWeight:700,fontFamily:"'Syne',sans-serif"}}>New Task</h3>
          <button onClick={onClose} style={{background:"rgba(255,255,255,0.07)",border:"none",borderRadius:"50%",width:"30px",height:"30px",color:"#94A3B8",cursor:"pointer",fontSize:"18px"}}>×</button>
        </div>
        <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Task name…"
          style={{width:"100%",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",
            borderRadius:"12px",padding:"12px 14px",color:"#F1F5F9",fontSize:"14px",
            fontFamily:"Inter,sans-serif",marginBottom:"16px"}}/>
        <p style={{color:"rgba(255,255,255,0.3)",fontSize:"10px",letterSpacing:"0.1em",marginBottom:"8px",textTransform:"uppercase"}}>Emoji</p>
        <div style={{display:"flex",flexWrap:"wrap",gap:"6px",marginBottom:"16px"}}>
          {EMOJIS.map(e=>(
            <button key={e} onClick={()=>setEmoji(e)} style={{
              width:"36px",height:"36px",borderRadius:"10px",fontSize:"18px",cursor:"pointer",
              background:emoji===e?"rgba(99,102,241,0.3)":"rgba(255,255,255,0.04)",
              border:emoji===e?"1px solid rgba(99,102,241,0.5)":"1px solid transparent",
            }}>{e}</button>
          ))}
        </div>
        <p style={{color:"rgba(255,255,255,0.3)",fontSize:"10px",letterSpacing:"0.1em",marginBottom:"8px",textTransform:"uppercase"}}>Category</p>
        <div style={{display:"flex",gap:"6px",marginBottom:"16px"}}>
          {CATS.map(c=>{const cc=CAT_COLORS[c];return(
            <button key={c} onClick={()=>setCat(c)} style={{
              flex:1,padding:"7px 4px",
              background:cat===c?cc.bg:"rgba(255,255,255,0.04)",
              border:"1px solid "+(cat===c?cc.border:"rgba(255,255,255,0.07)"),
              color:cat===c?cc.text:"rgba(255,255,255,0.4)",
              fontSize:"10px",fontWeight:700,textTransform:"uppercase",
              letterSpacing:"0.05em",borderRadius:"8px",cursor:"pointer",
            }}>{c}</button>
          );})}
        </div>
        <p style={{color:"rgba(255,255,255,0.3)",fontSize:"10px",letterSpacing:"0.1em",marginBottom:"4px",textTransform:"uppercase"}}>Duration: {dur}m</p>
        <input type="range" min="10" max="120" step="5" value={dur} onChange={e=>setDur(+e.target.value)}
          style={{width:"100%",accentColor:"#6366F1",marginBottom:"4px"}}/>
        <div style={{display:"flex",gap:"6px",marginBottom:"16px",flexWrap:"wrap"}}>
          {[15,25,30,45,60].map(v=>(
            <button key={v} onClick={()=>setDur(v)} style={{
              padding:"4px 10px",borderRadius:"8px",cursor:"pointer",
              background:dur===v?"rgba(99,102,241,0.25)":"rgba(255,255,255,0.05)",
              border:dur===v?"1px solid rgba(99,102,241,0.4)":"1px solid transparent",
              color:dur===v?"#A5B4FC":"rgba(255,255,255,0.35)",fontSize:"11px",fontWeight:600,
            }}>{v}m</button>
          ))}
        </div>
        <p style={{color:"rgba(255,255,255,0.3)",fontSize:"10px",letterSpacing:"0.1em",marginBottom:"8px",textTransform:"uppercase"}}>Repeat</p>
        <div style={{display:"flex",gap:"6px",marginBottom:"22px",flexWrap:"wrap"}}>
          {["daily","weekday","weekly","none"].map(r=>(
            <button key={r} onClick={()=>setRepeat(r)} style={{
              padding:"6px 12px",borderRadius:"8px",cursor:"pointer",
              background:repeat===r?"rgba(99,102,241,0.2)":"rgba(255,255,255,0.04)",
              border:repeat===r?"1px solid rgba(99,102,241,0.4)":"1px solid rgba(255,255,255,0.07)",
              color:repeat===r?"#A5B4FC":"rgba(255,255,255,0.35)",
              fontSize:"11px",fontWeight:700,textTransform:"capitalize",
            }}>{r}</button>
          ))}
        </div>
        <button onClick={submit} style={{
          width:"100%",
          background:"linear-gradient(135deg,rgba(99,102,241,0.4),rgba(139,92,246,0.4))",
          border:"1px solid rgba(99,102,241,0.4)",borderRadius:"14px",padding:"14px",
          color:"#C7D2FE",fontSize:"14px",fontWeight:800,fontFamily:"'Syne',sans-serif",
          cursor:"pointer",letterSpacing:"0.08em",
        }}>ADD TO TODAY →</button>
      </div>
    </div>
  );
}

// ── CONSISTENCY SCREEN (Progress / You vs You) ────────────────────────────────
function ConsistencyScreen({history,tasks,streak,onBack}){
  const today=new Date().toISOString().slice(0,10);

  // Build last 30 days
  const days=Array.from({length:30},(_,i)=>{
    const d=new Date();
    d.setDate(d.getDate()-(29-i));
    return d.toISOString().slice(0,10);
  });

  const dayStatus=date=>{
    const snap=history.find(h=>h.date===date);
    if(!snap) return "none";
    if(snap.allDone) return "green";
    if((snap.pct||0)>=50) return "yellow";
    return "red";
  };

  // Chart data: last 14 days
  const chartDays=days.slice(-14);
  const chartData=chartDays.map(date=>{
    const snap=history.find(h=>h.date===date);
    return {date, pct: snap?(snap.pct||0):null};
  });

  // SVG line chart
  const W=320,H=130,PAD_X=28,PAD_Y=16;
  const plotW=W-PAD_X*2, plotH=H-PAD_Y*2;
  const valid=chartData.filter(d=>d.pct!==null);
  const pts=valid.map((d,i)=>{
    const idx=chartDays.indexOf(d.date);
    const x=PAD_X+(idx/(chartDays.length-1))*plotW;
    const y=PAD_Y+plotH-(d.pct/100)*plotH;
    return {x,y,pct:d.pct,date:d.date};
  });
  const linePath=pts.map((p,i)=>`${i===0?"M":"L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaPath=pts.length>0
    ?`${linePath} L${pts[pts.length-1].x.toFixed(1)},${(PAD_Y+plotH).toFixed(1)} L${pts[0].x.toFixed(1)},${(PAD_Y+plotH).toFixed(1)} Z`
    :"";
  const y100=PAD_Y; // 100% line at top

  const statusColor={green:"#22C55E",yellow:"#FBBF24",red:"#EF4444",none:"rgba(255,255,255,0.07)"};
  const statusLabel={green:"All done",yellow:"Partial",red:"Missed",none:"No data"};

  // Streak summary
  const totalDays=history.length;
  const perfectDays=history.filter(h=>h.allDone).length;
  const consistency=totalDays>0?Math.round((perfectDays/totalDays)*100):0;

  return(
    <div style={{background:"#080C14",minHeight:"100vh",fontFamily:"Inter,sans-serif",paddingBottom:"80px"}}>
      {/* Header */}
      <div style={{
        background:"linear-gradient(180deg,#0D1321,#080C14)",
        padding:"20px 16px 16px",borderBottom:"1px solid rgba(255,255,255,0.05)",
        position:"sticky",top:0,zIndex:10,
      }}>
        <button onClick={onBack} style={{
          background:"none",border:"none",color:"rgba(255,255,255,0.5)",
          fontSize:"13px",cursor:"pointer",fontFamily:"Inter,sans-serif",
          padding:"0 0 12px",display:"flex",alignItems:"center",gap:"4px",
        }}>← Back</button>
        <h1 style={{color:"#F1F5F9",fontSize:"22px",fontWeight:800,fontFamily:"'Syne',sans-serif"}}>Your Progress</h1>
        <p style={{color:"rgba(255,255,255,0.3)",fontSize:"12px",marginTop:"2px"}}>You vs 100% consistency</p>
      </div>

      <div style={{padding:"16px 16px 0",display:"flex",flexDirection:"column",gap:"16px"}}>
        {/* Summary cards */}
        <div style={{display:"flex",gap:"8px"}}>
          {[
            {l:"Current Streak",v:streak+"d",   c:"#FB923C",bg:"rgba(249,115,22,0.1)"},
            {l:"Perfect Days",  v:perfectDays,   c:"#4ADE80",bg:"rgba(34,197,94,0.1)"},
            {l:"Consistency",   v:consistency+"%",c:consistency>=70?"#4ADE80":consistency>=40?"#FBBF24":"#F87171",bg:"rgba(99,102,241,0.08)"},
          ].map(s=>(
            <div key={s.l} style={{flex:1,textAlign:"center",background:s.bg,borderRadius:"12px",padding:"12px 6px",animation:"revealUp 0.5s ease both"}}>
              <p style={{color:s.c,fontSize:"18px",fontWeight:800,fontFamily:"'Syne',sans-serif"}}>{s.v}</p>
              <p style={{color:"rgba(255,255,255,0.35)",fontSize:"9px",fontWeight:600,marginTop:"3px",textTransform:"uppercase",letterSpacing:"0.05em",lineHeight:1.3}}>{s.l}</p>
            </div>
          ))}
        </div>

        {/* Line chart */}
        <div style={{
          background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",
          borderRadius:"18px",padding:"16px",
          animation:"revealUp 0.5s ease 0.1s both",
        }}>
          <p style={{color:"rgba(255,255,255,0.5)",fontSize:"11px",fontWeight:600,marginBottom:"10px",letterSpacing:"0.06em",textTransform:"uppercase"}}>
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
              {/* Grid lines */}
              {[0,25,50,75,100].map(pct=>{
                const y=PAD_Y+plotH-(pct/100)*plotH;
                return(
                  <g key={pct}>
                    <line x1={PAD_X} y1={y} x2={W-PAD_X} y2={y}
                      stroke="rgba(255,255,255,0.06)" strokeWidth="1"/>
                    <text x={PAD_X-4} y={y+4} textAnchor="end"
                      fill="rgba(255,255,255,0.2)" fontSize="8">{pct}%</text>
                  </g>
                );
              })}
              {/* 100% reference dashed */}
              <line x1={PAD_X} y1={y100} x2={W-PAD_X} y2={y100}
                stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeDasharray="5,4"/>
              <text x={W-PAD_X+4} y={y100+4} fill="rgba(255,255,255,0.3)" fontSize="8">Target</text>
              {/* Area fill */}
              <path d={areaPath} fill="url(#areaGrad)"/>
              {/* Actual line */}
              <path d={linePath} fill="none" stroke="#6366F1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              {/* Points */}
              {pts.map((p,i)=>(
                <circle key={i} cx={p.x} cy={p.y} r="5"
                  fill={p.pct>=100?"#22C55E":p.pct>=50?"#FBBF24":"#EF4444"}
                  stroke="#080C14" strokeWidth="2"/>
              ))}
            </svg>
          ):(
            <div style={{height:"130px",display:"flex",alignItems:"center",justifyContent:"center"}}>
              <p style={{color:"rgba(255,255,255,0.2)",fontSize:"13px",fontStyle:"italic"}}>
                Complete some tasks to see your graph
              </p>
            </div>
          )}
        </div>

        {/* 30-day calendar */}
        <div style={{
          background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",
          borderRadius:"18px",padding:"16px",
          animation:"revealUp 0.5s ease 0.2s both",
        }}>
          <p style={{color:"rgba(255,255,255,0.5)",fontSize:"11px",fontWeight:600,marginBottom:"12px",letterSpacing:"0.06em",textTransform:"uppercase"}}>
            30-day calendar
          </p>
          <div style={{display:"flex",flexWrap:"wrap",gap:"5px"}}>
            {days.map(date=>{
              const st=dayStatus(date);
              const isToday=date===today;
              const dayNum=new Date(date).getDate();
              return(
                <div key={date} title={`${date}: ${statusLabel[st]}`} style={{
                  width:"30px",height:"30px",borderRadius:"8px",flexShrink:0,
                  background:statusColor[st],
                  border:isToday?"2px solid #818CF8":"1px solid rgba(255,255,255,0.06)",
                  display:"flex",alignItems:"center",justifyContent:"center",
                  boxShadow:st==="green"?"0 0 8px rgba(34,197,94,0.4)":st==="yellow"?"0 0 8px rgba(251,191,36,0.3)":st==="red"?"0 0 6px rgba(239,68,68,0.3)":"none",
                }}>
                  <span style={{fontSize:"9px",color:st==="none"?"rgba(255,255,255,0.25)":"rgba(0,0,0,0.7)",fontWeight:700}}>
                    {dayNum}
                  </span>
                </div>
              );
            })}
          </div>
          {/* Legend */}
          <div style={{display:"flex",gap:"12px",marginTop:"12px",flexWrap:"wrap"}}>
            {[{c:"#22C55E",l:"All done"},{c:"#FBBF24",l:"Partial"},{c:"#EF4444",l:"Missed"},{c:"rgba(255,255,255,0.07)",l:"No data"}].map(({c,l})=>(
              <div key={l} style={{display:"flex",alignItems:"center",gap:"5px"}}>
                <div style={{width:"10px",height:"10px",borderRadius:"3px",background:c}}/>
                <span style={{color:"rgba(255,255,255,0.35)",fontSize:"10px"}}>{l}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Motivational note */}
        <div style={{
          background:consistency>=70?"rgba(34,197,94,0.07)":"rgba(99,102,241,0.07)",
          border:"1px solid "+(consistency>=70?"rgba(34,197,94,0.2)":"rgba(99,102,241,0.2)"),
          borderRadius:"14px",padding:"14px 16px",
          animation:"revealUp 0.5s ease 0.3s both",
        }}>
          <p style={{color:consistency>=70?"#4ADE80":"#A5B4FC",fontSize:"13px",fontWeight:600,fontFamily:"'Syne',sans-serif"}}>
            {consistency>=70
              ?"You're in the top tier of consistency 🔥 Keep it up."
              :consistency>=40
              ?"You're building momentum. Every green day compounds."
              :"Start small — even one task a day builds the habit."}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── LEADERBOARD SCREEN ────────────────────────────────────────────────────────
function LeaderboardScreen({streak,rank,userAvatar,userName,onBack}){
  const data=[
    ...LB_DATA,
    {name:userName||"You",streak,rank,done:Math.round(60+streak*2.5),avatar:userAvatar||"⭐",isYou:true},
  ].sort((a,b)=>a.rank-b.rank);
  const medals=["🥇","🥈","🥉"];

  return(
    <div style={{background:"#080C14",minHeight:"100vh",fontFamily:"Inter,sans-serif"}}>
      <div style={{
        background:"linear-gradient(180deg,#0D1321,#080C14)",padding:"20px 16px 16px",
        borderBottom:"1px solid rgba(255,255,255,0.05)",position:"sticky",top:0,zIndex:10,
      }}>
        <button onClick={onBack} style={{
          background:"none",border:"none",color:"rgba(255,255,255,0.5)",
          fontSize:"13px",cursor:"pointer",fontFamily:"Inter,sans-serif",
          padding:"0 0 12px",display:"flex",alignItems:"center",gap:"4px",
        }}>← Back</button>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div>
            <h1 style={{color:"#F1F5F9",fontSize:"22px",fontWeight:800,fontFamily:"'Syne',sans-serif"}}>Leaderboard</h1>
            <p style={{color:"rgba(255,255,255,0.3)",fontSize:"12px",marginTop:"3px"}}>Ranked by projected AIR</p>
          </div>
          <div style={{
            background:"rgba(251,191,36,0.1)",border:"1px solid rgba(251,191,36,0.25)",
            borderRadius:"12px",padding:"8px 14px",textAlign:"center",
          }}>
            <p style={{color:"#FBBF24",fontSize:"18px",fontWeight:800,fontFamily:"'Syne',sans-serif"}}>#{rank}</p>
            <p style={{color:"rgba(251,191,36,0.5)",fontSize:"9px",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.05em"}}>your rank</p>
          </div>
        </div>
      </div>

      <div style={{padding:"12px 16px",display:"flex",flexDirection:"column",gap:"8px"}}>
        {data.map((u,i)=>{
          const isTop=i<3,isYou=u.isYou;
          return(
            <div key={u.name} className="rank-row" style={{
              animationDelay:`${i*0.045}s`,
              background:isYou?"rgba(99,102,241,0.1)":isTop?"rgba(251,191,36,0.05)":"rgba(255,255,255,0.03)",
              border:"1px solid "+(isYou?"rgba(99,102,241,0.3)":isTop?"rgba(251,191,36,0.15)":"rgba(255,255,255,0.06)"),
              borderRadius:"16px",padding:"14px 16px",display:"flex",alignItems:"center",gap:"12px",
            }}>
              <div style={{width:"28px",textAlign:"center",flexShrink:0}}>
                {isTop
                  ?<span style={{fontSize:"18px"}}>{medals[i]}</span>
                  :<span style={{color:"rgba(255,255,255,0.3)",fontSize:"13px",fontWeight:600}}>#{i+1}</span>}
              </div>
              <div style={{
                width:"38px",height:"38px",borderRadius:"12px",flexShrink:0,
                background:isYou?"rgba(99,102,241,0.2)":"rgba(255,255,255,0.06)",
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:"20px",
              }}>{u.avatar}</div>
              <div style={{flex:1,minWidth:0}}>
                <p style={{
                  color:isYou?"#A5B4FC":"#E2E8F0",fontSize:"14px",
                  fontWeight:isYou?700:500,
                  fontFamily:isYou?"'Syne',sans-serif":"Inter,sans-serif",
                }}>{u.name}{isYou?" (you)":""}</p>
                <div style={{display:"flex",gap:"8px",marginTop:"3px",alignItems:"center"}}>
                  <span style={{color:"#FB923C",fontSize:"11px"}}>🔥 {u.streak}d</span>
                  <span style={{color:"rgba(255,255,255,0.25)",fontSize:"10px"}}>·</span>
                  <span style={{color:"rgba(255,255,255,0.35)",fontSize:"11px"}}>{u.done}% done</span>
                </div>
              </div>
              <div style={{textAlign:"right",flexShrink:0}}>
                <p style={{
                  color:u.rank<100?"#4ADE80":u.rank<500?"#FBBF24":"#F87171",
                  fontSize:"14px",fontWeight:800,fontFamily:"'Syne',sans-serif",
                }}>#{u.rank}</p>
                <p style={{color:"rgba(255,255,255,0.25)",fontSize:"9px",marginTop:"2px",textTransform:"uppercase",letterSpacing:"0.05em"}}>AIR</p>
              </div>
            </div>
          );
        })}
      </div>
      <p style={{textAlign:"center",color:"rgba(255,255,255,0.12)",fontSize:"11px",padding:"8px 0 100px"}}>
        Rankings update daily based on task completion
      </p>
    </div>
  );
}

// ── ROOT ──────────────────────────────────────────────────────────────────────
export default function TINT(){
  useCSS();

  const [screen,setScreen]       = useState("cover");
  const [onboarded]              = useState(()=>load("tint_onboarded",false));
  const [userName,setUserName]   = useState(()=>load("tint_name",""));
  const [userAvatar,setUserAvatar]= useState(()=>load("tint_avatar","⭐"));
  const [userEmail,setUserEmail] = useState(()=>load("tint_email",""));
  const [userExams,setUserExams] = useState(()=>load("tint_exams",[]));
  const [tasks,setTasksRaw]      = useState(()=>load("tint_tasks3",null));
  const [history,setHistoryRaw]  = useState(()=>load("tint_hist3",[]));
  const [streak,setStreak]       = useState(0);
  const [missed,setMissed]       = useState(0);

  const setTasks=upd=>{
    setTasksRaw(prev=>{
      const next=typeof upd==="function"?upd(prev):upd;
      save("tint_tasks3",next);
      return next;
    });
  };

  // Day reset
  useEffect(()=>{
    if(!tasks) return;
    const last=load("tint_date","");
    const today=new Date().toISOString().slice(0,10);
    if(last!==today){
      save("tint_date",today);
      setTasksRaw(prev=>{
        if(!prev) return prev;
        const next=prev.map(t=>({...t,status:"upcoming"}));
        save("tint_tasks3",next);
        return next;
      });
    }
  },[]);

  // Snapshot + streak
  useEffect(()=>{
    if(!tasks||tasks.length===0) return;
    const today=new Date().toISOString().slice(0,10);
    const study=tasks.filter(t=>t.cat!=="health");
    if(!study.length) return;
    const doneStudy=study.filter(t=>t.status==="done");
    const allDone=doneStudy.length===study.length;
    const pct=Math.round((doneStudy.length/study.length)*100);
    const skipped=study.filter(t=>t.status==="missed");
    const snap={date:today,allDone,missedCount:skipped.length,pct,skippedTask:skipped[0]?.title||null};

    setHistoryRaw(prev=>{
      const upd=[...prev.filter(h=>h.date!==today),snap];
      save("tint_hist3",upd);
      const sorted=[...upd].sort((a,b)=>b.date.localeCompare(a.date));
      let s=0,m=0;
      for(const e of sorted){
        if(e.date===today) continue;
        if(e.allDone){s++;m=0;}
        else{m++;s=0;break;}
      }
      setStreak(s);setMissed(m);
      return upd;
    });
  },[tasks]);

  const rank=projectedRank(streak,missed);
  const isCarrot=rank<100;

  const handleCoverDone=()=>{
    if(load("tint_onboarded",false)){
      setScreen("home");
    } else {
      setScreen("onboard");
    }
  };

  const handleOnboardDone=({name,avatar,email,exams,tasks:newTasks})=>{
    setUserName(name); save("tint_name",name);
    setUserAvatar(avatar); save("tint_avatar",avatar);
    setUserEmail(email); save("tint_email",email);
    setUserExams(exams); save("tint_exams",exams);
    setTasks(newTasks);
    save("tint_onboarded",true);
    setScreen("home");
  };

  // If tasks haven't been set yet (fresh install, no onboarding done), default to UCEED
  const activeTasks = tasks || EXAM_TASKS.UCEED.map((t,i)=>({...t,id:i+1,status:"upcoming"}));

  return(
    <div style={{position:"relative",width:"100%",minHeight:"100vh",background:"#05070F"}}>
      {screen==="cover"       && <CoverScreen onDone={handleCoverDone}/>}
      {screen==="onboard"     && <OnboardingScreen onDone={handleOnboardDone}/>}
      {screen==="home"        && <HomeScreen
        tasks={activeTasks} setTasks={setTasks}
        streak={streak} missed={missed} rank={rank} isCarrot={isCarrot}
        userName={userName||"Friend"} userAvatar={userAvatar}
        onProgress={()=>setScreen("progress")}
        onLeaderboard={()=>setScreen("leaderboard")}
      />}
      {screen==="progress"    && <ConsistencyScreen
        history={history} tasks={activeTasks} streak={streak}
        onBack={()=>setScreen("home")}
      />}
      {screen==="leaderboard" && <LeaderboardScreen
        streak={streak} rank={rank}
        userAvatar={userAvatar} userName={userName||"You"}
        onBack={()=>setScreen("home")}
      />}
    </div>
  );
}
