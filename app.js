/* Rodin Hub · Pre-Event Brief, Event Brief, Post-Event Report */
const sb = supabase.createClient(window.RH_CONFIG.url, window.RH_CONFIG.key, {auth:{persistSession:true,autoRefreshToken:true}});
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const pad = n => String(n).padStart(2,"0");
const today = () => { const d=new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; };
const fmtDay = s => s ? new Date(s+"T12:00:00").toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short"}) : "";
const fmtTime = t => { const d=new Date(t); return pad(d.getHours())+":"+pad(d.getMinutes()); };
const fmtWhen = t => t ? `${fmtDay(new Date(t).toISOString().slice(0,10))} ${fmtTime(t)}` : "";
const ls = { get(k){ try{return JSON.parse(localStorage.getItem("rh:"+k));}catch(e){return null;} }, set(k,v){ try{ v==null?localStorage.removeItem("rh:"+k):localStorage.setItem("rh:"+k,JSON.stringify(v)); }catch(e){} } };

const KINDS = {
  pre:  {title:"Pre-Event Brief",  sub:"Before you get to the track", c:"var(--s1)", n:"1"},
  event:{title:"Event Brief",      sub:"After each session · 2 minutes", c:"var(--s2)", n:"2"},
  post: {title:"Post-Event Report",sub:"The evening after the last session", c:"var(--s4)", n:"3"},
};
const FIELDS = {
  pre: [
    {t:"carry", id:"carry", l:"From last time", h:"What you said you'd work on after the last event. Where are you with each one?"},
    {t:"long", id:"expect", l:"What do you expect from this event?", h:"Track, grip, tyres, weather, the car."},
    {t:"long", id:"plan", l:"What are you going to do?", h:"Your priorities and what you want to try."},
    {t:"list3", id:"goals", l:"My 3 goals for this event", c:"var(--s1)"},
    {t:"text", id:"focus", l:"One thing I'll focus on every run"},
    {t:"long", id:"need", l:"What I need from my engineer and the team", h:"Information, set-up direction, run plan, anything."},
    {t:"checks", id:"prep", l:"Preparation done", o:["Sim","Onboards","Last year's data","Track map studied","Engineer briefing"]},
    {t:"scale", id:"ready", l:"How ready do I feel? (1–10)"},
    {t:"scale", id:"energy", l:"Sleep, food and energy this week (1–10)"},
  ],
  event: [
    {t:"result", id:"result", l:"Result"},
    {t:"pickers", id:"pick", l:"Quick tags", h:"Run, tyres, how it felt, corners. Tap, then Done."},
    {t:"long", id:"warm", l:"Tyre warming", h:"Procedure, which axle, in for Sector 1?"},
    {t:"long", id:"balance", l:"Balance / grip / evolution", h:"Tyre drop-off, which axle."},
    {t:"long", id:"braking", l:"Braking", h:"Performance: bias, locking. System: pedal, efficiency, bite."},
    {t:"long", id:"kerbs", l:"Kerb riding / bottoming / aquaplaning", h:"Which area of the circuit?"},
    {t:"long", id:"sequence", l:"Session sequence", h:"Run plan, strategy, execution. e.g. Fresh: OWPPPI"},
    {t:"long", id:"improve", l:"Driving improvements", h:"What could you have done better?"},
    {t:"long", id:"problem", l:"Biggest problem for lap time", h:"Balance, feeling, etc."},
    {t:"long", id:"strong", l:"Strong car points", h:"Balance, feeling, etc."},
    {t:"long", id:"other", l:"Other session comments", h:"Reliability issues."},
  ],
  post: [
    {t:"summary", id:"summary", l:"Sessions"},
    {t:"scale", id:"rating", l:"How did the event go overall? (1–10)"},
    {t:"list3", id:"positives", l:"Positives", c:"var(--s4)"},
    {t:"list3", id:"improve", l:"Improvements required", c:"var(--s2)"},
    {t:"goalrev", id:"goalrev", l:"Goals review", h:"Your goals from the Pre-Event Brief."},
    {t:"list3", id:"lessons", l:"Lessons learned", c:"var(--s5)"},
    {t:"long", id:"tyres", l:"Tyre learning", h:"e.g. what changed from Hard to Medium."},
    {t:"list3", id:"car", l:"My 3 action items for the car", c:"var(--s1)"},
    {t:"list3", id:"sim", l:"My 3 action items for the Sim", c:"var(--s5)"},
    {t:"list3", id:"next", l:"Goals for the next event", c:"var(--ink)", h:"These go into your next Pre-Event Brief."},
    {t:"long", id:"team", l:"For my engineer or Noel", h:"Car, set-up, body, energy, food."},
  ],
};

const TAG_GROUPS=[["Quick verdict",["Good","Bad","Check Data for Answers"]],["Tyre set",["New","Fresh","Used","Soft","Medium","Hard"]],["Corner phase",["Entry","Mid","Exit"]],["Car",["Braking","Lock Up","Traction","Balance","Tyres","Tyre Warm-up"]],["The lap",["Great Lap","Mistake","Traffic","Aborted Lap"]],["Body & energy · for Noel",["Felt Strong","Good Energy","Neck Pain","Leg Pain","Back Pain","Arms / Shoulders","Low Brake Pressure","Grip Strength","Fatigue","Mental Fatigue","Lost Focus","Hot in Car","Thirsty","Hungry","Need More Snacks","Headache","Stomach Issue"]],["Simulator",["Practice on Sim","Sim Correlation","Sim Setup"]],["Me",["Feeling","Mindset","Question for engineer"]]];
const RTYPE={perf:"Performance run",race:"Race run"};
const turnsOf=e=>{const m=String(e.track_info||"").match(/(\d+)\s*turns/);return m?+m[1]:0};
const S = { user:null, open:{}, profile:null, drivers:[], series:[], events:[], briefs:{}, route:null, evSel:ls.get("ev"), sessSel:{} };
const bkey = (e,d,k) => `${e}|${d}|${k}`;
const getP = (o,p) => p.split(".").reduce((a,k)=>a==null?a:a[k], o);
const setP = (o,p,v) => { const ks=p.split("."); let a=o; ks.slice(0,-1).forEach((k,i)=>{ if(a[k]==null||typeof a[k]!=="object") a[k]=/^\d+$/.test(ks[i+1])?[]:{}; a=a[k]; }); a[ks[ks.length-1]]=v; };

/* ---------- sync indicator / toast ---------- */
function sync(t,state){ const el=$("#sync"); el.hidden=!t; $("#syncTxt").textContent=t||""; el.className="sync"+(state?" "+state:""); }
let toastT; function toast(t){ const el=$("#toast"); el.textContent=t; el.hidden=false; clearTimeout(toastT); toastT=setTimeout(()=>el.hidden=true,2800); }

/* ---------- data ---------- */
async function loadAll(){
  const [p,dr,se,ev] = await Promise.all([
    sb.from("rh_profiles").select("*").eq("id",S.user.id).maybeSingle(),
    sb.from("rh_drivers").select("*").eq("active",true).order("car_no"),
    sb.from("rh_series").select("*").order("name"),
    sb.from("rh_events").select("*").order("date_from",{ascending:true}),
  ]);
  if(p.error||!p.data) throw new Error("No profile for this login yet. Ask Riki to finish setting up your account.");
  S.profile=p.data; S.drivers=dr.data||[]; S.series=se.data||[]; S.events=ev.data||[];
  const ids=S.events.map(e=>e.id);
  if(ids.length){ const b=await sb.from("rh_briefs").select("*").in("event_id",ids); (b.data||[]).forEach(x=>S.briefs[bkey(x.event_id,x.driver_id,x.kind)]=x); }
  // restore any unsaved local edits
  Object.keys(localStorage).filter(k=>k.startsWith("rh:pend:")).forEach(k=>{ const p=ls.get(k.slice(3)); if(!p) return;
    const cur=S.briefs[p.key]; if(!cur || new Date(cur.updated_at).getTime() < p.at){ S.briefs[p.key]=Object.assign({},cur||{},p.row); queueSave(p.key,0); } else ls.set(k.slice(3),null); });
}
const isCoach = () => S.profile && S.profile.role==="coach";
const myDriver = () => S.drivers.find(d=>d.id===S.profile.driver_id);
function eventsFor(driver){ return S.events.filter(e=>!driver||!e.series_id||e.series_id===driver.series_id); }
function defaultEvent(list){ const t=today(); return list.find(e=>(e.date_to||e.date_from||"")>=t) || list[list.length-1] || null; }
function brief(evId,drvId,kind){ return S.briefs[bkey(evId,drvId,kind)] || {event_id:evId,driver_id:drvId,kind,data:{},status:"draft"}; }

const timers={}, saving={}, again={};
function queueSave(key,delay=800){ clearTimeout(timers[key]); sync("Saving…"); timers[key]=setTimeout(()=>flush(key),delay); }
async function flush(key){
  if(saving[key]){ again[key]=true; return; } saving[key]=true;
  const b=S.briefs[key]; const row={event_id:b.event_id,driver_id:b.driver_id,kind:b.kind,data:b.data,status:b.status||"draft",sent_at:b.sent_at||null};
  ls.set("pend:"+key,{key,row,at:Date.now()});
  const {data,error}=await sb.from("rh_briefs").upsert(row,{onConflict:"event_id,driver_id,kind"}).select().single();
  saving[key]=false;
  if(error){ sync("Not saved · kept on this phone","bad"); console.warn(error); }
  else { S.briefs[key]=Object.assign(data,{data:S.briefs[key].data,status:S.briefs[key].status,sent_at:S.briefs[key].sent_at}); ls.set("pend:"+key,null); sync("Saved","ok"); }
  if(again[key]){ again[key]=false; flush(key); }
}

/* ---------- auth ---------- */
function loginHTML(msg){
  return `<div class="login"><h1>Driver Hub</h1><p>Sign in with the username and password Riki gave you.</p>
  <form id="loginForm"><label>Username<input type="text" id="lgEmail" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="e.g. reza" required></label>
  <label>Password<input type="password" id="lgPass" autocomplete="current-password" required></label>
  ${msg?`<div class="err">${esc(msg)}</div>`:""}<button class="btn primary big" type="submit">Sign in</button></form>
  <p style="font-size:.8rem">Forgotten your password? Message Riki.</p></div>`;
}
async function boot(){
  const {data:{session}} = await sb.auth.getSession();
  if(!session){ $("#bar").innerHTML=""; $("#main").innerHTML=loginHTML(); return; }
  S.user=session.user;
  try{ await loadAll(); }catch(e){ $("#main").innerHTML=`<div class="notice"><b>Almost there.</b><span>${esc(e.message)}</span><div><button class="btn" data-act="signout">Sign out</button></div></div>`; return; }
  route();
}
sb.auth.onAuthStateChange((ev)=>{ if(ev==="SIGNED_OUT"){ S.user=null; S.profile=null; S.briefs={}; boot(); } });

/* ---------- routing ---------- */
function route(){
  const h=location.hash.replace(/^#\/?/,"").split("/").filter(Boolean);
  S.route=h; renderBar();
  if(h[0]==="b"&&h[1]&&h[2]&&KINDS[h[3]]) return renderBrief(h[1],h[2],h[3]);
  if(h[0]==="account"){ $("#main").innerHTML=`<div class="noprint"><a class="link" href="#/">← Home</a></div>`+accountHTML(); return; }
  return isCoach()?renderCoach():renderDriverHome();
}
window.addEventListener("hashchange",()=>{ if(S.profile) { route(); scrollTo(0,0); } });

function renderBar(){
  const p=S.profile, d=myDriver();
  $("#bar").innerHTML=`<div class="who">${d?`<span class="no">${esc(d.car_no)}</span>`:""}<span><b>${esc(d?d.full_name:p.full_name)}</b><small>${esc(isCoach()?"Head of Coaching Performance":p.role==="driver"?"Driver":p.role)}</small></span></div>
    ${S.route&&S.route[0]?`<a class="btn sm" href="#/">⌂ Home</a>`:""}${S.route&&S.route[0]==="account"?"":`<button class="btn sm" data-act="account">Account</button>`}`;
}

/* ---------- driver home ---------- */
function evPicker(list,sel){
  if(list.length<2) return "";
  return `<div class="evpick" role="tablist">${list.map(e=>`<button data-act="ev" data-id="${e.id}" aria-pressed="${e.id===sel}">${esc((e.location||e.name).split(",")[0])} · ${esc(fmtDay(e.date_from))}</button>`).join("")}</div>`;
}
function evHead(e){
  const ser=S.series.find(s=>s.id===e.series_id);
  return `<div class="evhead"><span class="meta">${esc([ser&&ser.name,e.kind==="test"?"Test":e.kind==="race"?"Race weekend":"Simulator",e.date_from&&(fmtDay(e.date_from)+(e.date_to&&e.date_to!==e.date_from?" – "+fmtDay(e.date_to):""))].filter(Boolean).join(" · "))}</span><h1>${esc(e.location?e.location.split(",")[0]:e.name)} · ${esc(e.name)}</h1>${e.track?`<span class="muted" style="font-size:.86rem">${esc(e.track)}${e.track_info?" · "+esc(e.track_info):""}</span>`:""}</div>`;
}
function statusChip(b,short){ return b.status==="sent"?`<span class="chip sent">${short?"✓ "+esc(fmtTime(b.sent_at)):"Sent "+esc(fmtWhen(b.sent_at))}</span>`:Object.keys(b.data||{}).length?`<span class="chip draft">Draft</span>`:`<span class="chip">${short?"To do":"Not started"}</span>`; }
function renderDriverHome(){
  const d=myDriver();
  if(!d){ $("#main").innerHTML=`<div class="notice"><b>Your account isn't linked to a driver yet.</b><span>Ask Riki.</span></div>`; return; }
  const list=eventsFor(d); let e=list.find(x=>x.id===S.evSel)||defaultEvent(list);
  if(!e){ $("#main").innerHTML=`<div class="notice"><b>No events yet.</b><span>Riki will add the next one.</span></div>`; return; }
  $("#main").innerHTML=`${evPicker(list,e.id)}${evHead(e)}
    <div class="steps">${Object.entries(KINDS).map(([k,K])=>{const b=brief(e.id,d.id,k);return `<a class="step" style="--c:${K.c};text-decoration:none" href="#/b/${e.id}/${d.id}/${k}"><span class="n">${K.n}</span><span><b>${K.title}</b><small>${K.sub}</small></span>${statusChip(b)}</a>`}).join("")}</div>`;
}

/* ---------- coach home ---------- */
function renderCoach(){
  const list=S.events; let e=list.find(x=>x.id===S.evSel)||defaultEvent(list);
  if(!e){ $("#main").innerHTML=`<div class="notice"><b>No events yet.</b></div>`; return; }
  const drs=S.drivers.filter(d=>!e.series_id||d.series_id===e.series_id);
  const sent=k=>drs.filter(d=>brief(e.id,d.id,k).status==="sent").length;
  $("#main").innerHTML=`${evPicker(list,e.id)}${evHead(e)}
    <div class="card"><div class="card-h"><h2>Drivers</h2><span class="eyebrow">Pre ${sent("pre")}/${drs.length} · Event ${sent("event")}/${drs.length} · Post ${sent("post")}/${drs.length}</span></div>
    <div class="grid">${drs.map(d=>`<div class="drow"><div class="h"><span class="no">${esc(d.car_no)}</span><b>${esc(d.full_name)}</b></div>
      <div class="b3">${Object.entries(KINDS).map(([k,K])=>{const b=brief(e.id,d.id,k);return `<button style="--c:${K.c}" data-act="go" data-href="#/b/${e.id}/${d.id}/${k}"><b>${K.title.replace("Post-Event ","Post ").replace("Pre-Event ","Pre ")}</b>${statusChip(b,true)}</button>`}).join("")}</div></div>`).join("")}</div></div>
    <p class="muted" style="font-size:.82rem;margin:0">Tap any brief to read it. You can edit too; drivers see your changes.</p>`;
}

/* ---------- brief page ---------- */
function prevPost(e,drvId){ return e.prev_event_id ? brief(e.prev_event_id,drvId,"post") : null; }
function carryItems(e,drvId){
  const P=prevPost(e,drvId); if(!P||!P.data) return [];
  const pe=S.events.find(x=>x.id===e.prev_event_id), out=[];
  [["car","Car"],["sim","Sim"],["next","Goal"]].forEach(([k,l])=>(P.data[k]||[]).forEach((t,i)=>{ if(t&&t.trim()) out.push({key:k+i,label:l,text:t.trim(),from:pe?(pe.location||pe.name).split(",")[0]:""}); }));
  return out;
}
function fieldHTML(f,data,ctx){
  const v=getP(data,f.id);
  const head=`<${f.t==="scale"||f.t==="chips"||f.t==="checks"||f.t==="carry"||f.t==="goalrev"||f.t==="summary"?"div class=\"lbl\"":`label for="f-${f.id}"`}>${esc(f.l)}</${f.t==="scale"||f.t==="chips"||f.t==="checks"||f.t==="carry"||f.t==="goalrev"||f.t==="summary"?"div":"label"}>${f.h?`<small>${esc(f.h)}</small>`:""}`;
  const P=ctx.prefix||"";
  switch(f.t){
    case "text": return `<div class="q">${head}<input type="text" id="f-${P}${f.id}" data-f="${P}${f.id}" value="${esc(v||"")}"></div>`;
    case "long": return `<div class="q">${head}<textarea id="f-${P}${f.id}" data-f="${P}${f.id}" rows="3">${esc(v||"")}</textarea></div>`;
    case "result": return `<div class="q"><div class="lbl">${esc(f.l)}</div><div class="res3">${[["laptime","Lap time","1:21.456"],["gap","Gap","+0.215"],["pos","Position","P4"]].map(([k,l,ph])=>`<label><span>${l}</span><input type="text" id="f-${P}${k}" data-f="${P}${k}" value="${esc(getP(data,k)||"")}" placeholder="${ph}" inputmode="${k==="pos"?"text":"decimal"}"></label>`).join("")}</div></div>`;
    case "pickers": {
      const key=ctx.key, o=S.open[key+P], run=getP(data,"run"), rt=getP(data,"rtype"), tags=getP(data,"tags")||[], allc=getP(data,"allc"), turns=getP(data,"turns")||[], nT=turnsOf(ctx.e);
      const rv=[run?"Run "+run:"",rt?(rt==="perf"?"Perf":"Race"):""].filter(Boolean).join(" · ");
      const cs=allc?["All corners"]:[...turns].sort((a,b)=>a-b).map(n=>"T"+n);
      const btn=(v,label,count)=>`<button type="button" class="pbtn" data-act="popen" data-p="${P}" data-v="${v}" aria-expanded="${o===v}">${label}${count?`<span class="c">${count}</span>`:""} <span class="car">${o===v?"▴":"▾"}</span></button>`;
      let panel="";
      const done=`<button type="button" class="btn sm primary" data-act="popen" data-p="${P}" data-v="">Done</button>`;
      if(o==="run") panel=`<div class="panel"><div class="g"><h5>Run</h5><div class="w runs">${[1,2,3,4,5,6,7,8].map(n=>`<button type="button" data-act="pset" data-f="${P}run" data-v="${n}" aria-pressed="${run===n}">Run ${n}</button>`).join("")}</div></div><div class="g"><h5>Type of run</h5><div class="w">${Object.entries(RTYPE).map(([k,l])=>`<button type="button" data-act="psetk" data-f="${P}rtype" data-v="${k}" aria-pressed="${rt===k}">${l}</button>`).join("")}</div></div><div class="foot2"><span></span><span style="display:flex;gap:6px"><button type="button" class="btn sm" data-act="popen" data-p="${P}" data-v="tags">Tags →</button>${done}</span></div></div>`;
      if(o==="tags") panel=`<div class="panel">${TAG_GROUPS.map(([h,L])=>`<div class="g"><h5>${esc(h)}</h5><div class="w">${L.map(t=>`<button type="button" data-act="toggle" data-f="${P}tags" data-v="${esc(t)}" aria-pressed="${tags.includes(t)}">${esc(t)}</button>`).join("")}</div></div>`).join("")}<div class="foot2"><span class="muted" style="font-size:.78rem">Pick as many as you like</span><span style="display:flex;gap:6px">${nT?`<button type="button" class="btn sm" data-act="popen" data-p="${P}" data-v="turns">Corners →</button>`:""}<button type="button" class="btn sm primary" data-act="popen" data-p="${P}" data-v="">Done${tags.length?" · "+tags.length:""}</button></span></div></div>`;
      if(o==="turns") panel=`<div class="panel"><div class="w turns"><button type="button" class="all" data-act="pallc" data-f="${P}" aria-pressed="${!!allc}">All corners</button>${Array.from({length:nT},(_,i)=>i+1).map(n=>`<button type="button" data-act="pturn" data-f="${P}" data-v="${n}" aria-pressed="${!allc&&turns.includes(n)}">T${n}</button>`).join("")}</div><div class="foot2"><span></span>${done}</div></div>`;
      const chosen=[rv,...cs,...tags].filter(Boolean);
      return `<div class="q"><div class="lbl">${esc(f.l)}</div>${f.h?`<small>${esc(f.h)}</small>`:""}<div class="pick">${btn("run",rv||"Run",0)}${btn("tags","Tags",tags.length)}${nT?btn("turns","Corners",cs.length):""}</div>${chosen.length?`<div class="chosen">${chosen.map(c=>`<span class="tag" data-v="${esc(c)}">${esc(c)}</span>`).join("")}</div>`:""}${panel}</div>`; }
    case "scale": return `<div class="q">${head}<div class="scale">${[1,2,3,4,5,6,7,8,9,10].map(n=>`<button type="button" data-act="set" data-f="${P}${f.id}" data-v="${n}" aria-pressed="${v===n}">${n}</button>`).join("")}</div></div>`;
    case "list3": return `<div class="q">${head}<div class="list3" style="--qc:${f.c||"var(--s1)"}">${[0,1,2].map(i=>`<div class="n"><i>${"ABC"[i]}</i><textarea rows="1" id="f-${P}${f.id}-${i}" data-f="${P}${f.id}.${i}">${esc((v||[])[i]||"")}</textarea></div>`).join("")}</div></div>`;
    case "chips": case "checks": { const L=v||[]; return `<div class="q">${head}<div class="chips">${f.o.map(o=>`<button type="button" data-act="toggle" data-f="${P}${f.id}" data-v="${esc(o)}" aria-pressed="${L.includes(o)}">${esc(o)}</button>`).join("")}</div></div>`; }
    case "carry": { const L=carryItems(ctx.e,ctx.d.id); if(!L.length) return ""; const st=v||{};
      return `<div class="q">${head}<div class="carry">${L.map(it=>`<div class="ci"><div class="t"><span>${esc(it.label)} · from ${esc(it.from)}</span>${esc(it.text)}</div><div class="opts">${[["done","Worked on it"],["part","Partly"],["not","Not yet"]].map(([k,l])=>`<button type="button" data-act="setkey" data-f="carry.${it.key}" data-v="${k}" aria-pressed="${st[it.key]===k}">${l}</button>`).join("")}</div></div>`).join("")}</div></div>`; }
    case "goalrev": { const pre=brief(ctx.e.id,ctx.d.id,"pre").data||{}, G=(pre.goals||[]).filter(x=>x&&x.trim()); if(!G.length) return ""; const st=v||{};
      return `<div class="q">${head}<div class="carry">${G.map((g,i)=>`<div class="ci"><div class="t">${esc(g)}</div><div class="opts">${[["done","Achieved"],["part","Partly"],["not","Not this time"]].map(([k,l])=>`<button type="button" data-act="setkey" data-f="goalrev.${i}" data-v="${k}" aria-pressed="${st[i]===k}">${l}</button>`).join("")}</div></div>`).join("")}</div></div>`; }
    case "summary": { const EB=brief(ctx.e.id,ctx.d.id,"event").data||{}, ses=ctx.e.sessions||[], rows=ses.map(s=>({s,x:(EB.s||{})[s.key]||{}})).filter(r=>Object.keys(r.x).length);
      if(!rows.length) return ""; return `<div class="q">${head}<small>From your Event Brief.</small><div class="summary"><table><thead><tr><th>Session</th><th>Lap time</th><th>Gap</th><th>Pos</th><th>Tyres</th><th>Biggest problem</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.s.label)}</td><td>${esc(r.x.laptime||r.x.best||"–")}</td><td>${esc(r.x.gap||"")}</td><td>${esc(r.x.pos||"")}</td><td>${esc([...(r.x.tyres||[]),...(r.x.tags||[]).filter(t=>["New","Fresh","Used","Soft","Medium","Hard"].includes(t))].join(" "))}</td><td>${esc(r.x.problem||"")}</td></tr>`).join("")}</tbody></table></div></div>`; }
  }
  return "";
}
function renderBrief(evId,drvId,kind){
  const e=S.events.find(x=>x.id===evId), d=S.drivers.find(x=>x.id===drvId);
  if(!e||!d){ $("#main").innerHTML=`<div class="notice"><b>Not found.</b><a href="#/">Back</a></div>`; return; }
  const K=KINDS[kind], key=bkey(evId,drvId,kind); if(!S.briefs[key]) S.briefs[key]=brief(evId,drvId,kind);
  const b=S.briefs[key], data=b.data||(b.data={}), ctx={e,d};
  let body="";
  if(kind==="event"){
    const ses=e.sessions||[]; const sk=S.sessSel[key]||(ses.find(s=>s.date===today())||ses[0]||{}).key;
    body=ses.length?`<div class="stabs" role="tablist">${ses.map((s,i)=>`<button role="tab" style="--tc:var(--s${(i%5)+1})" data-act="sess" data-k="${esc(key)}" data-v="${esc(s.key)}" aria-selected="${s.key===sk}"><b>${esc(s.label)}${Object.keys((data.s||{})[s.key]||{}).length?'<span class="dot"></span>':""}</b><small>${esc(fmtDay(s.date))}${s.time?" · "+esc(s.time):""}</small></button>`).join("")}</div>
      <div class="sec" style="--qc:var(--s2)">${FIELDS.event.map(f=>fieldHTML(f,(data.s||{})[sk]||{},{...ctx,key,prefix:`s.${sk}.`})).join("")}</div>`
      :`<div class="notice">No sessions set for this event yet.</div>`;
  } else body=FIELDS[kind].map(f=>fieldHTML(f,data,ctx)).join("");
  const sent=b.status==="sent";
  $("#main").innerHTML=`<div class="noprint"><a class="link" href="#/">← ${esc(isCoach()?"All drivers":"My event")}</a></div>
    ${evHead(e)}
    <div class="card" style="border-top:4px solid ${K.c}"><div class="card-h"><h2>${K.title}</h2>${isCoach()?`<span class="eyebrow">#${esc(d.car_no)} ${esc(d.full_name)}</span>`:""}<div class="r noprint">${statusChip(b)}</div></div>
      <p class="muted" style="margin:0;font-size:.9rem">${kind==="pre"?"Short and in your own words. It saves as you type.":kind==="event"?"The same questions as your engineer's debrief sheet, after each session. Pick the session; a line each is fine.":"Simple and clear, in your own words. Your car, sim and next-event items carry into your next Pre-Event Brief."}</p>
      <div class="form" id="form" data-key="${esc(key)}">${body}</div>
      <div class="sendbox noprint">${sent?`<span class="ok">✓ Sent to Riki · ${esc(fmtWhen(b.sent_at))}</span><small class="muted">Change anything and press Send again.</small>`:`<small class="muted">Done? Press Send and Riki has it straight away.</small>`}
        <button class="btn primary big" data-act="send" data-k="${esc(key)}">${sent?"Send again":"Send to Riki"}</button>
        ${kind==="post"?`<button class="btn" data-act="print">Save as PDF</button>`:""}</div>
    </div>`;
  document.querySelectorAll("#form textarea").forEach(autosize);
}
/* re-render without the page jumping: keep the tapped control where it was */
function anchorRoute(el,toPick){
  const sel=["act","f","v","p"].filter(k=>el.dataset[k]!=null).map(k=>`[data-${k}="${CSS.escape(el.dataset[k])}"]`).join(""), inP=!!el.closest(".panel");
  const all=[...document.querySelectorAll(sel)].filter(x=>!!x.closest(".panel")===inP), i=all.indexOf(el), top=el.getBoundingClientRect().top;
  route();
  if(toPick){ const pk=document.querySelector("#form .pick"); if(pk){ const hb=$("header.top").getBoundingClientRect().bottom+10, r=pk.getBoundingClientRect(); if(r.top<hb||r.top>innerHeight*.6) scrollTo({top:scrollY+r.top-hb,behavior:"smooth"}); } return; }
  const nb=[...document.querySelectorAll(sel)].filter(x=>!!x.closest(".panel")===inP)[i]; if(nb){ const d=nb.getBoundingClientRect().top-top; if(Math.abs(d)>1) scrollBy(0,d); }
}
function autosize(t){ t.style.height="auto"; t.style.height=Math.min(t.scrollHeight+2,innerHeight*.5)+"px"; }

/* ---------- account sheet (simple) ---------- */
function accountHTML(){
  return `<div class="card"><div class="card-h"><h2>Account</h2><span class="eyebrow">${esc(S.user.email.replace("@drivers.rikichristo.com",""))}</span></div>
    <form id="pwForm" style="display:grid;gap:8px"><label class="q"><span class="lbl">New password</span><input type="password" id="pw1" minlength="8" autocomplete="new-password" required></label>
    <button class="btn" type="submit">Change password</button></form>
    <div><button class="btn" data-act="signout">Sign out</button></div></div>`;
}

/* ---------- events ---------- */
document.addEventListener("click",async ev=>{
  const b=ev.target.closest("[data-act]"); if(!b) return; const a=b.dataset.act;
  if(a==="signout"){ await sb.auth.signOut(); location.hash=""; return; }
  if(a==="account"){ location.hash="#/account"; return; }
  if(a==="ev"){ S.evSel=b.dataset.id; ls.set("ev",S.evSel); route(); return; }
  if(a==="go"){ location.hash=b.dataset.href; return; }
  if(a==="print"){ window.print(); return; }
  const form=b.closest("#form"), key=form?form.dataset.key:b.dataset.k, B=key&&S.briefs[key];
  if(a==="sess"){ S.sessSel[key]=b.dataset.v; route(); return; }
  if(!B) return;
  if(a==="set"){ const cur=getP(B.data,b.dataset.f); setP(B.data,b.dataset.f,cur===+b.dataset.v?null:+b.dataset.v); queueSave(key); route(); return; }
  if(a==="popen"){ const id=key+b.dataset.p; S.open[id]=S.open[id]===b.dataset.v||!b.dataset.v?null:b.dataset.v; anchorRoute(b,!b.dataset.v||b.closest(".foot2")); return; }
  if(a==="pset"){ const cur=getP(B.data,b.dataset.f); setP(B.data,b.dataset.f,cur===+b.dataset.v?null:+b.dataset.v); queueSave(key); anchorRoute(b); return; }
  if(a==="psetk"){ const cur=getP(B.data,b.dataset.f); setP(B.data,b.dataset.f,cur===b.dataset.v?null:b.dataset.v); queueSave(key); anchorRoute(b); return; }
  if(a==="pallc"){ const P=b.dataset.f; setP(B.data,P+"allc",!getP(B.data,P+"allc")); if(getP(B.data,P+"allc")) setP(B.data,P+"turns",[]); queueSave(key); anchorRoute(b); return; }
  if(a==="pturn"){ const P=b.dataset.f, n=+b.dataset.v, L=getP(B.data,P+"turns")||[]; setP(B.data,P+"allc",false); setP(B.data,P+"turns",L.includes(n)?L.filter(x=>x!==n):[...L,n]); queueSave(key); anchorRoute(b); return; }
  if(a==="toggle"){ const L=getP(B.data,b.dataset.f)||[]; const v=b.dataset.v; setP(B.data,b.dataset.f,L.includes(v)?L.filter(x=>x!==v):[...L,v]); queueSave(key); anchorRoute(b); return; }
  if(a==="setkey"){ const cur=getP(B.data,b.dataset.f); setP(B.data,b.dataset.f,cur===b.dataset.v?null:b.dataset.v); queueSave(key); route(); return; }
  if(a==="send"){ document.querySelectorAll("#form [data-f]").forEach(x=>{ if(x.matches("input,textarea")) setP(B.data,x.dataset.f,x.value); });
    B.status="sent"; B.sent_at=new Date().toISOString(); clearTimeout(timers[key]); await flush(key);
    if($("#sync").classList.contains("bad")) toast("Couldn't send yet. It's kept on this phone; try again with signal."); else { toast("Sent to Riki."); route(); } return; }
});
document.addEventListener("input",ev=>{
  const t=ev.target; if(t.matches("textarea")) autosize(t);
  const form=t.closest("#form"); if(!form||!t.dataset.f) return; const key=form.dataset.key, B=S.briefs[key];
  setP(B.data,t.dataset.f,t.value); ls.set("pend:"+key,{key,row:{event_id:B.event_id,driver_id:B.driver_id,kind:B.kind,data:B.data,status:B.status||"draft",sent_at:B.sent_at||null},at:Date.now()}); queueSave(key);
});
document.addEventListener("submit",async ev=>{
  ev.preventDefault();
  if(ev.target.id==="loginForm"){ const btn=ev.target.querySelector("button"); btn.disabled=true; btn.textContent="Signing in…";
    let u=$("#lgEmail").value.trim().toLowerCase(); if(!u.includes("@")) u+="@drivers.rikichristo.com";
    const {error}=await sb.auth.signInWithPassword({email:u,password:$("#lgPass").value});
    if(error){ $("#main").innerHTML=loginHTML("That username or password didn't match. Try again."); return; } boot(); }
  if(ev.target.id==="pwForm"){ const {error}=await sb.auth.updateUser({password:$("#pw1").value}); toast(error?"Couldn't change it: "+error.message:"Password changed."); if(!error) location.hash="#/"; }
});
window.addEventListener("online",()=>Object.keys(S.briefs).forEach(k=>{ if(ls.get("pend:"+k)) flush(k); }));
boot();
