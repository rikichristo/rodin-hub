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
    {t:"wx", id:"wx", l:"Weather"},
    {t:"weight", id:"wt", l:"Driver weight", h:"Weigh in before the session and again straight after. Tap a box and scroll."},
    {t:"pickers", id:"pick", l:"Quick tags", h:"Run, tyres, how it felt, corners. Tap, then Done."},
    {t:"scale", id:"drive", l:"My driving performance (1–10)"},
    {t:"scale", id:"carperf", l:"Car performance (1–10)"},
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
    {t:"scale", id:"drive", l:"My driving performance (1–10)"},
    {t:"scale", id:"carperf", l:"Car performance (1–10)"},
    {t:"scale", id:"physical", l:"My physical performance (1–10)"},
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
  S.engOf={}; S.engNames="";
  if(isCoach()){ const [ed,pr]=await Promise.all([sb.from("rh_engineer_drivers").select("*"),sb.from("rh_profiles").select("id,full_name,role")]);
    const nm={}; (pr.data||[]).forEach(x=>nm[x.id]=x.full_name); (ed.data||[]).forEach(x=>{(S.engOf[x.driver_id]=S.engOf[x.driver_id]||[]).push(nm[x.engineer_id]||"Engineer")}); }
  else if(p.data.driver_id){ const r=await sb.rpc("rh_driver_engineers",{d:p.data.driver_id}); if(!r.error&&r.data) S.engNames=r.data; }
  const ids=S.events.map(e=>e.id);
  S.timing={}; if(ids.length){ const t=await sb.from("rh_timing").select("*").in("event_id",ids); (t.data||[]).forEach(x=>S.timing[x.event_id+"|"+x.session_key]=x); }
  if(ids.length){ const b=await sb.from("rh_briefs").select("*").in("event_id",ids); (b.data||[]).forEach(x=>S.briefs[bkey(x.event_id,x.driver_id,x.kind)]=x); }
  // restore any unsaved local edits
  if(isEng()) return;
  Object.keys(localStorage).filter(k=>k.startsWith("rh:pend:")).forEach(k=>{ const p=ls.get(k.slice(3)); if(!p) return;
    const cur=S.briefs[p.key]; if(!cur || new Date(cur.updated_at).getTime() < p.at){ S.briefs[p.key]=Object.assign({},cur||{},p.row); queueSave(p.key,0); } else ls.set(k.slice(3),null); });
}
const isCoach = () => S.profile && S.profile.role==="coach";
const isEng = () => S.profile && (S.profile.role==="engineer"||S.profile.role==="trainer");
const isStaff = () => isCoach()||isEng();
const sentTo = () => "Riki"+(S.engNames?" & "+S.engNames:"");
const myDriver = () => S.drivers.find(d=>d.id===S.profile.driver_id);
function eventsFor(driver){ return S.events.filter(e=>!driver||((!e.series_id||e.series_id===driver.series_id)&&(!e.driver_ids||e.driver_ids.includes(driver.id)))); }
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
  pushInit().then(()=>{ if(!S.route||!S.route.length) route(); });
}
/* ---------- push reminders ---------- */
const PUSH={state:null,reg:null,busy:false};
const isIOS=()=>/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
const isStandalone=()=>matchMedia("(display-mode: standalone)").matches||navigator.standalone===true;
function b64u(k){ const p="=".repeat((4-k.length%4)%4), r=atob((k+p).replace(/-/g,"+").replace(/_/g,"/")); return Uint8Array.from([...r].map(c=>c.charCodeAt(0))); }
async function saveSub(sub){ const {error}=await sb.from("rh_push_subs").upsert({user_id:S.user.id,endpoint:sub.endpoint,sub:sub.toJSON(),ua:navigator.userAgent.slice(0,200)},{onConflict:"endpoint"}); if(error) console.warn(error); return !error; }
async function pushInit(){
  if(!("serviceWorker" in navigator)){ PUSH.state="nosupport"; return; }
  try{ PUSH.reg=await navigator.serviceWorker.register("sw.js"); }catch(e){ PUSH.state="nosupport"; return; }
  if(!("PushManager" in window)||!("Notification" in window)){ PUSH.state=isIOS()&&!isStandalone()?"install":"nosupport"; return; }
  if(Notification.permission==="denied"){ PUSH.state="denied"; return; }
  const sub=await PUSH.reg.pushManager.getSubscription().catch(()=>null);
  if(sub&&Notification.permission==="granted"){ PUSH.state="on"; saveSub(sub); } else PUSH.state="off";
}
async function pushOn(){
  if(PUSH.busy) return; PUSH.busy=true; route();
  try{
    const perm=await Notification.requestPermission();
    if(perm!=="granted"){ PUSH.state=perm==="denied"?"denied":"off"; return; }
    const reg=await navigator.serviceWorker.ready;
    const sub=(await reg.pushManager.getSubscription())||await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64u(window.RH_CONFIG.vapid)});
    if(!await saveSub(sub)){ toast("Couldn't save. Check signal and try again."); return; }
    PUSH.state="on"; await sb.functions.invoke("rh-remind",{body:{test:true}}); toast("Reminders on. A test notification is on its way.");
  }catch(e){ console.warn(e); toast("Couldn't turn reminders on: "+(e.message||e)); }
  finally{ PUSH.busy=false; route(); }
}
function pushCard(){
  const st=PUSH.state; if(!st||st==="nosupport") return "";
  const who=isStaff()?"Get the same reminders as the drivers on this phone.":"A nudge 10 minutes after each session and at the end of the day, only if your report isn't sent.";
  if(st==="install") return `<div class="card push"><div class="card-h"><h2>Reminders</h2><span class="eyebrow">This phone</span></div><p class="muted" style="margin:0;font-size:.9rem">${who}</p>
    <ol class="steps2"><li>Tap <b>Share</b> <span class="ico">⬆︎</span> at the bottom of Safari.</li><li>Tap <b>Add to Home Screen</b>, then <b>Add</b>.</li><li>Open <b>Rodin Hub</b> from the new icon and tap <b>Turn on reminders</b>.</li></ol></div>`;
  if(st==="denied") return `<div class="card push"><div class="card-h"><h2>Reminders</h2><span class="eyebrow">Blocked</span></div><p class="muted" style="margin:0;font-size:.9rem">Notifications are switched off for Rodin Hub. Open <b>Settings → Notifications → Rodin Hub</b> and allow them, then come back here.</p></div>`;
  if(st==="on") return `<div class="card push on"><div class="card-h"><h2>Reminders</h2><span class="chip sent">On</span><div class="r"><button class="btn sm" data-act="push-test">Send a test</button></div></div><p class="muted" style="margin:0;font-size:.86rem">${who}</p></div>`;
  return `<div class="card push"><div class="card-h"><h2>Reminders</h2><span class="eyebrow">Off on this phone</span></div><p class="muted" style="margin:0;font-size:.9rem">${who}</p><button class="btn primary big" data-act="push-on" ${PUSH.busy?"disabled":""}>${PUSH.busy?"Turning on…":"Turn on reminders"}</button></div>`;
}
sb.auth.onAuthStateChange((ev)=>{ if(ev==="SIGNED_OUT"){ S.user=null; S.profile=null; S.briefs={}; boot(); } });

/* ---------- routing ---------- */
function route(){
  const h=location.hash.replace(/^#\/?/,"").split("/").filter(Boolean);
  S.route=h; renderBar();
  if(h[0]==="b"&&h[1]&&h[2]&&KINDS[h[3]]) return renderBrief(h[1],h[2],h[3],h[4]);
  if(h[0]==="notes") return h[1]?renderNote(h[1]):renderNotes();
  if(h[0]==="lists") return renderLists();
  if(h[0]==="newev"){ if(!X.ef||X.ef.id) X.ef=null; return renderEvForm(null); }
  if(h[0]==="edev"&&h[1]) return renderEvForm(h[1]);
  if(h[0]==="account"){ $("#main").innerHTML=`<div class="noprint"><a class="link" href="#/">← Home</a></div>`+accountHTML(); return; }
  return isStaff()?renderCoach():renderDriverHome();
}
window.addEventListener("hashchange",()=>{ if(S.profile) { route(); scrollTo(0,0); } });

function renderBar(){
  const p=S.profile, d=myDriver();
  $("#bar").innerHTML=`<div class="who">${d?`<span class="no">${esc(d.car_no)}</span>`:""}<span><b>${esc(d?d.full_name:p.full_name)}</b><small>${esc(isCoach()?"Head of Coaching Performance":p.role==="driver"?"Driver":p.role==="engineer"?"Race engineer":p.role)}</small></span></div>
    <a class="btn sm" href="#/">⌂ Home</a>${S.route&&S.route[0]==="account"?"":`<button class="btn sm" data-act="account">Account</button>`}`;
}

/* ---------- driver home ---------- */
function evPicker(list,sel){
  if(list.length<2) return "";
  return `<div class="evpick" role="tablist">${list.map(e=>`<button data-act="ev" data-id="${e.id}" aria-pressed="${e.id===sel}">${esc((e.location||e.name).split(",")[0])} · ${esc(fmtDay(e.date_from))}</button>`).join("")}</div>`;
}
function evHead(e){
  const ser=S.series.find(s=>s.id===e.series_id);
  return `<div class="evhead"><span class="meta">${esc([ser&&ser.name,e.kind==="test"?"Test":e.kind==="race"?"Race weekend":"Simulator",e.date_from&&(fmtDay(e.date_from)+(e.date_to&&e.date_to!==e.date_from?" – "+fmtDay(e.date_to):""))].filter(Boolean).join(" · "))}</span><h1>${esc(e.location?e.location.split(",")[0]:e.name)} · ${esc(e.name)}</h1>${e.car?`<span class="muted" style="font-size:.86rem">Car · ${esc(e.car)}</span>`:""}${e.track?`<span class="muted" style="font-size:.86rem">${esc(e.track)}${e.track_info?" · "+esc(e.track_info):""}</span>`:""}</div>`;
}
function statusChip(b,short){ if(b.kind==="event"&&b.data&&(b.data.list||b.data.s)){ const e=S.events.find(x=>x.id===b.event_id), L=e?evEntries(b.data,e,b):[], n=L.filter(x=>x.sent).length;
    if(L.length) return n?`<span class="chip sent" title="${n} session${n>1?"s":""} sent">✓ ${n}</span>`:`<span class="chip draft">Draft</span>`; } return b.status==="sent"?`<span class="chip sent">${short?"✓ "+esc(fmtTime(b.sent_at)):"Sent "+esc(fmtWhen(b.sent_at))}</span>`:Object.keys(b.data||{}).length?`<span class="chip draft">Draft</span>`:`<span class="chip">${short?"To do":"Not started"}</span>`; }
function renderDriverHome(){
  const d=myDriver();
  if(!d){ $("#main").innerHTML=`<div class="notice"><b>Your account isn't linked to a driver yet.</b><span>Ask Riki.</span></div>`; return; }
  const list=eventsFor(d); let e=list.find(x=>x.id===S.evSel)||defaultEvent(list);
  if(!e){ $("#main").innerHTML=`${navHTML("ev")}<div class="notice"><b>No events yet.</b><span>Riki will add the next one, or add your own.</span><a class="btn primary" href="#/newev">+ Add event</a></div>`; return; }
  $("#main").innerHTML=`${navHTML("ev")}<div class="evbar">${evPicker(list,e.id)}<a class="btn sm" href="#/newev">+ Add event</a></div>${evHead(e)}${e.owner_driver_id===d.id?`<div class="noprint" style="margin-top:-6px"><a class="link" href="#/edev/${e.id}">Edit this event</a></div>`:""}
    <div class="steps">${Object.entries(KINDS).map(([k,K])=>{const b=brief(e.id,d.id,k);return `<a class="step" style="--c:${K.c};text-decoration:none" href="#/b/${e.id}/${d.id}/${k}"><span class="n">${K.n}</span><span><b>${K.title}</b><small>${K.sub}</small></span>${statusChip(b)}</a>`}).join("")}</div>${wxCardHolder(e)}${pushCard()}${bestLapsCard(e,[d])}`;
  fillWxCard();
}

/* ---------- coach home ---------- */
function renderCoach(){
  const list=S.events; let e=list.find(x=>x.id===S.evSel)||defaultEvent(list);
  if(!e){ $("#main").innerHTML=`<div class="notice"><b>No events yet.</b></div>`; return; }
  const drs=S.drivers.filter(d=>(!e.series_id||d.series_id===e.series_id)&&(!e.driver_ids||e.driver_ids.includes(d.id)));
  const sent=k=>drs.filter(d=>brief(e.id,d.id,k).status==="sent").length;
  $("#main").innerHTML=`${evPicker(list,e.id)}${evHead(e)}
    <div class="card"><div class="card-h"><h2>${isEng()?(drs.length>1?"Your drivers":"Your driver"):"Drivers"}</h2><span class="eyebrow">Pre ${sent("pre")}/${drs.length} · Event ${sent("event")}/${drs.length} · Post ${sent("post")}/${drs.length}</span></div>
    <div class="grid">${drs.map(d=>`<div class="drow"><div class="h"><span class="no">${esc(d.car_no)}</span><b>${esc(d.full_name)}</b>${isCoach()&&S.engOf[d.id]?`<small class="eng">Eng · ${esc(S.engOf[d.id].join(", "))}</small>`:""}</div>
      <div class="b3">${Object.entries(KINDS).map(([k,K])=>{const b=brief(e.id,d.id,k);return `<button style="--c:${K.c}" data-act="go" data-href="#/b/${e.id}/${d.id}/${k}" ${isEng()&&!(S.briefs[bkey(e.id,d.id,k)])?"disabled":""}><b>${K.title.replace("Post-Event ","Post ").replace("Pre-Event ","Pre ")}</b>${statusChip(b,true)}</button>`}).join("")}</div></div>`).join("")}</div></div>
    ${bestLapsCard(e,drs)}${wxCardHolder(e)}${isCoach()?`<div class="sendbox"><a class="btn" href="#/notes">Drivers' shared notes</a><a class="btn" href="#/newev">+ Add event</a>${e.owner_driver_id||e.created_by===S.user.id?`<a class="btn" href="#/edev/${e.id}">Edit event</a>`:""}</div>`:""}${pushCard()}
    <p class="muted" style="font-size:.82rem;margin:0">${isEng()?"Each brief appears here as soon as your driver presses Send. Tap a ✓ to read it.":"Tap any brief to read it. You can edit too; drivers see your changes."}</p>`;
  fillWxCard();
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
    case "result": { const T=ctx.t, tv={laptime:T&&T.best,gap:T&&(T.gap||(T.pos===1?"Fastest":"")),pos:T&&T.pos?"P"+T.pos:""};
      return `<div class="q"><div class="lbl">${esc(f.l)}</div>${T?`<small class="tsrc">Filled from official timing${T.laps?" · "+T.laps+" laps":""}${T.n?" · P"+T.pos+" of "+T.n:""}. Change it if your run differs.</small>`:""}<div class="res3">${[["laptime","Lap time","1:21.456"],["gap","Gap","+0.215"],["pos","Position","P4"]].map(([k,l,ph])=>`<label><span>${l}</span><input type="text" id="f-${P}${k}" data-f="${P}${k}" value="${esc(getP(data,k)||tv[k]||"")}" placeholder="${ph}" inputmode="${k==="pos"?"text":"decimal"}"></label>`).join("")}</div></div>`; }
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
    case "wx": { const w=getP(data,"wx"), k=(P.match(/^s\.([^.]+)\./)||[])[1]||"";
      return `<div class="q"><div class="lbl">${esc(f.l)}</div><div class="wxline" data-wx="${esc(k)}">${w?wxLine(w)+(w.fc?" <small>(forecast)</small>":""):ctx.e&&ctx.e.lat!=null?`<span class="muted">Logs itself on the day of the session.</span>`:`<span class="muted">No location for this event.</span>`}</div><label class="tt"><span>Track temp °C</span><input type="text" id="f-${P}track_t" data-f="${P}track_t" value="${esc(getP(data,"track_t")||"")}" inputmode="decimal" placeholder="e.g. 24"></label></div>`; }
    case "weight": { const pre=getP(data,"wt_pre"), post=getP(data,"wt_post"), base=lastWeight(ctx)||70;
      const box=(k,l,v)=>`<label class="wbox ${v!=null?"set":""}"><span>${l}</span><b>${v!=null?(+v).toFixed(1)+" kg":"– kg"}</b><select data-f="${P}${k}" data-num aria-label="${l} weight in kg">${WOPTS((v??base))}</select></label>`;
      const diff=pre!=null&&post!=null?(post-pre):null;
      return `<div class="q">${head}<div class="wrow">${box("wt_pre","Before",pre)}${box("wt_post","After",post)}<div class="wdiff ${diff==null?"":diff<0?"down":"up"}"><span>Change</span><b>${diff==null?"–":(diff>0?"+":diff<0?"−":"±")+Math.abs(diff).toFixed(1)+" kg"}</b></div></div></div>`; }
    case "scale": return `<div class="q">${head}<div class="scale">${[1,2,3,4,5,6,7,8,9,10].map(n=>`<button type="button" data-act="set" data-f="${P}${f.id}" data-v="${n}" aria-pressed="${v===n}">${n}</button>`).join("")}</div></div>`;
    case "list3": return `<div class="q">${head}<div class="list3" style="--qc:${f.c||"var(--s1)"}">${[0,1,2].map(i=>`<div class="n"><i>${"ABC"[i]}</i><textarea rows="1" id="f-${P}${f.id}-${i}" data-f="${P}${f.id}.${i}">${esc((v||[])[i]||"")}</textarea></div>`).join("")}</div></div>`;
    case "chips": case "checks": { const L=v||[]; return `<div class="q">${head}<div class="chips">${f.o.map(o=>`<button type="button" data-act="toggle" data-f="${P}${f.id}" data-v="${esc(o)}" aria-pressed="${L.includes(o)}">${esc(o)}</button>`).join("")}</div></div>`; }
    case "carry": { const L=carryItems(ctx.e,ctx.d.id); if(!L.length) return ""; const st=v||{};
      return `<div class="q">${head}<div class="carry">${L.map(it=>`<div class="ci"><div class="t"><span>${esc(it.label)} · from ${esc(it.from)}</span>${esc(it.text)}</div><div class="opts">${[["done","Worked on it"],["part","Partly"],["not","Not yet"]].map(([k,l])=>`<button type="button" data-act="setkey" data-f="carry.${it.key}" data-v="${k}" aria-pressed="${st[it.key]===k}">${l}</button>`).join("")}</div></div>`).join("")}</div></div>`; }
    case "goalrev": { const pre=brief(ctx.e.id,ctx.d.id,"pre").data||{}, G=(pre.goals||[]).filter(x=>x&&x.trim()); if(!G.length) return ""; const st=v||{};
      return `<div class="q">${head}<div class="carry">${G.map((g,i)=>`<div class="ci"><div class="t">${esc(g)}</div><div class="opts">${[["done","Achieved"],["part","Partly"],["not","Not this time"]].map(([k,l])=>`<button type="button" data-act="setkey" data-f="goalrev.${i}" data-v="${k}" aria-pressed="${st[i]===k}">${l}</button>`).join("")}</div></div>`).join("")}</div></div>`; }
    case "summary": { const EB=brief(ctx.e.id,ctx.d.id,"event").data||{}, rows=evEntries(EB,ctx.e).map(x=>({s:{label:x.label},x:x.f,t:x.sk?tRow(ctx.e.id,x.sk,ctx.d):null})).filter(r=>Object.keys(r.x).length);
      if(!rows.length) return ""; return `<div class="q">${head}<small>From your Event Brief.</small><div class="summary"><table><thead><tr><th>Session</th><th>Lap time</th><th>Gap</th><th>Pos</th><th>Drive / Car</th><th>Weight</th><th>Tyres</th><th>Biggest problem</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.s.label)}</td><td>${esc(r.x.laptime||r.x.best||(r.t&&r.t.best)||"–")}</td><td>${esc(r.x.gap||"")}</td><td>${esc(r.x.pos||"")}</td><td>${r.x.drive||r.x.carperf?esc((r.x.drive||"–")+" / "+(r.x.carperf||"–")):""}</td><td>${r.x.wt_pre!=null||r.x.wt_post!=null?esc([r.x.wt_pre,r.x.wt_post].map(v=>v!=null?(+v).toFixed(1):"–").join(" → ")):""}</td><td>${esc([...(r.x.tyres||[]),...(r.x.tags||[]).filter(t=>["New","Fresh","Used","Soft","Medium","Hard"].includes(t))].join(" "))}</td><td>${esc(r.x.problem||"")}</td></tr>`).join("")}</tbody></table></div></div>`; }
  }
  return "";
}
/* official timing: match a driver by surname in the session classification */
const NRM=x=>String(x||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
function tRow(evId,sk,d){ const T=S.timing&&S.timing[evId+"|"+sk]; if(!T||!d) return null; const sn=NRM(d.full_name.split(" ").slice(-1)[0]);
  const r=(T.rows||[]).find(x=>(d.car_no&&String(x.no||"")===String(d.car_no))||NRM(x.name).split(/\s+/).includes(sn)); return r?{...r,n:(T.rows||[]).filter(x=>x.best).length}:null; }
const lapMs=t=>{const m=String(t||"").match(/^(\d+):(\d+(?:\.\d+)?)$/);return m?+m[1]*60000+Math.round(+m[2]*1000):null};
function bestLapsCard(e,drs){
  const ses=(e.sessions||[]).filter(x=>S.timing&&S.timing[e.id+"|"+x.key]); if(!ses.length||!drs.length) return "";
  const C=drs.map(d=>{ const c=ses.map(x=>tRow(e.id,x.key,d)); const best=c.filter(r=>r&&lapMs(r.best)).sort((a,b)=>lapMs(a.best)-lapMs(b.best))[0]; return {d,c,best}; });
  const cell=(r,best)=>r&&lapMs(r.best)?`<span class="lt ${best&&r.best===best.best?"pb":""}">${esc(r.best)}</span><small>P${r.pos}${r.gap?" · "+esc(r.gap):" · Fastest"}</small>${r.laps?`<small>${r.laps} laps</small>`:""}`:r?`<small>${esc(r.best||"No time")}</small>`:"–";
  return `<div class="card"><div class="card-h"><h2>Best laps</h2><span class="eyebrow">Official timing</span></div><div class="summary"><table class="laps"><thead><tr><th>Session</th>${C.map(({d})=>`<th>${drs.length>1?"#"+esc(d.car_no)+" "+esc(d.full_name.split(" ").slice(-1)[0]):"Lap · position"}</th>`).join("")}</tr></thead><tbody>
    ${ses.map((x,i)=>`<tr><td>${esc(x.label)}</td>${C.map(({c,best})=>`<td>${cell(c[i],best)}</td>`).join("")}</tr>`).join("")}
    <tr class="tot"><td>Best</td>${C.map(({best})=>`<td>${best?`<span class="lt pb">${esc(best.best)}</span>`:"–"}</td>`).join("")}</tr></tbody></table></div><small class="muted" style="font-size:.72rem">Purple is the best lap of the event.</small></div>`;
}
/* weight picker: 40.0–110.0 kg in 0.1 steps; the wheel opens at the last weight */
function WOPTS(sel){ const v=Math.round(+sel*10); let o=""; for(let i=400;i<=1100;i++) o+=`<option value="${(i/10).toFixed(1)}"${i===v?" selected":""}>${(i/10).toFixed(1)} kg</option>`; return o; }
function lastWeight(ctx){ if(!ctx||!ctx.e||!ctx.d) return null; const EB=brief(ctx.e.id,ctx.d.id,"event").data||{}; let w=null;
  evEntries(EB,ctx.e).forEach(x=>{ if(x.f.wt_pre!=null) w=x.f.wt_pre; if(x.f.wt_post!=null) w=x.f.wt_post; }); return w; }
/* event brief: one entry per session the driver adds */
function evEntries(data,e,b){
  const ses=e.sessions||[], L=(data.list||[]).slice(), have=new Set(L.map(x=>x.k));
  Object.keys(data.s||{}).forEach(k=>{ if(!have.has(k)&&Object.keys(data.s[k]||{}).length){ const ss=ses.find(x=>x.key===k); L.push({k,label:ss?ss.label:k,sk:k,sent:b&&b.status==="sent"?b.sent_at:null}); } });
  return L.map(x=>{ const ss=ses.find(y=>y.key===x.sk); return {...x,date:ss&&ss.date,time:ss&&ss.time,f:(data.s||{})[x.k]||{}}; });
}
function entryChip(x){ return x.sent?`<span class="chip sent">Sent ${esc(fmtTime(x.sent))}</span>`:Object.keys(x.f).length?`<span class="chip draft">Draft</span>`:`<span class="chip">New</span>`; }
function eventListHTML(e,d,key,data){
  const L=evEntries(data,e,S.briefs[key]).filter(x=>!isEng()||x.sent), ses=e.sessions||[], counts={}; L.forEach(x=>counts[x.sk]=(counts[x.sk]||0)+1);
  const add=S.open[key+"add"];
  return `${L.length?`<div class="elist">${L.map((x,i)=>{const f=x.f,info=[f.laptime,f.pos,(f.tags||[]).length?(f.tags.length+" tags"):""].filter(Boolean).join(" · ");
      return `<a class="eitem" href="#/b/${e.id}/${d.id}/event/${encodeURIComponent(x.k)}" style="--c:var(--s${(ses.findIndex(y=>y.key===x.sk)%5+5)%5+1})"><span><b>${esc(x.label)}</b><small>${esc([x.date&&fmtDay(x.date),x.time].filter(Boolean).join(" · "))}${info?" · "+esc(info):""}</small></span>${entryChip(x)}</a>`}).join("")}</div>`
      :isEng()?`<div class="notice" style="border-style:solid"><b>No sessions sent yet.</b><span>Each session appears here when ${esc(d.full_name.split(" ")[0])} presses Send.</span></div>`:`<div class="notice" style="border-style:solid"><b>No sessions yet.</b><span>After each session, tap <b>+ Add session</b>, fill it in and send it.</span></div>`}
    ${isEng()?"":`<div class="noprint">${add?`<div class="panel"><div class="g"><h5>Which session?</h5><div class="w">${ses.map(x=>`<button type="button" data-act="eadd" data-v="${esc(x.key)}">${esc(x.label)}${counts[x.key]?` <span class="muted">(${counts[x.key]+1})</span>`:""}</button>`).join("")}<button type="button" data-act="eadd" data-v="">Other / extra run</button></div></div><div class="foot2"><span></span><button type="button" class="btn sm" data-act="eaddx">Cancel</button></div></div>`
      :`<button class="btn primary big" data-act="eaddo">+ Add session</button>`}</div>`}`;
}
function renderBrief(evId,drvId,kind,entry){
  const e=S.events.find(x=>x.id===evId), d=S.drivers.find(x=>x.id===drvId);
  if(!e||!d){ $("#main").innerHTML=`<div class="notice"><b>Not found.</b><a href="#/">Back</a></div>`; return; }
  const K=KINDS[kind], key=bkey(evId,drvId,kind); if(!S.briefs[key]) S.briefs[key]=brief(evId,drvId,kind);
  const b=S.briefs[key], data=b.data||(b.data={}), ctx={e,d};
  let body="";
  let one=null;
  if(kind==="event"){
    if(entry){ one=evEntries(data,e,b).find(x=>x.k===decodeURIComponent(entry));
      if(!one){ location.hash=`#/b/${evId}/${drvId}/event`; return; }
      const first=evEntries(data,e,b).find(x=>x.sk===one.sk), T=one.sk&&first&&first.k===one.k?tRow(e.id,one.sk,d):null;
      if(T&&!isEng()){ const tgt=(data.s=data.s||{})[one.k]=(data.s[one.k]||{}); let ch=false; [["laptime",T.best],["gap",T.gap||(T.pos===1?"Fastest":"")],["pos",T.pos?"P"+T.pos:""]].forEach(([k,v])=>{ if(v&&lapMs(T.best)&&!tgt[k]){ tgt[k]=v; ch=true; } }); if(ch){ one.f=tgt; queueSave(key,300); } }
      body=`<div class="sec" style="--qc:var(--s2)">${FIELDS.event.map(f=>fieldHTML(f,one.f,{...ctx,key,t:T&&lapMs(T.best)?T:null,prefix:`s.${one.k}.`})).join("")}</div>`;
    } else body=eventListHTML(e,d,key,data);
  } else body=FIELDS[kind].map(f=>fieldHTML(f,data,ctx)).join("");
  const sent=one?!!one.sent:b.status==="sent", sentAt=one?one.sent:b.sent_at;
  $("#main").innerHTML=`<div class="noprint">${one?`<a class="link" href="#/b/${evId}/${drvId}/event">← All sessions</a>`:`<a class="link" href="#/">← ${esc(isStaff()?"All drivers":"My event")}</a>`}</div>
    ${evHead(e)}
    <div class="card" style="border-top:4px solid ${K.c}"><div class="card-h"><h2>${one?esc(one.label):K.title}</h2>${isStaff()?`<span class="eyebrow">#${esc(d.car_no)} ${esc(d.full_name)}</span>`:""}<div class="r noprint">${one?entryChip(one):kind==="event"?"":statusChip(b)}</div></div>
      <p class="muted" style="margin:0;font-size:.9rem">${isEng()?`Read only · written by ${esc(d.full_name.split(" ")[0])}.${kind==="event"&&!one?" Each session appears once it's sent.":""}`:kind==="pre"?"Short and in your own words. It saves as you type.":kind==="event"?(one?"The same questions as your engineer's debrief sheet. A line each is fine.":"One page per session, with the same questions as your engineer's debrief sheet. Add a session after each one, fill it in and send it."):"Simple and clear, in your own words. Your car, sim and next-event items carry into your next Pre-Event Brief."}</p>
      ${isEng()?`<fieldset class="ro" disabled><div class="form" id="form" data-key="${esc(key)}">${body}</div></fieldset>`:`<div class="form" id="form" data-key="${esc(key)}">${body}</div>`}
      ${kind==="event"&&!one||isEng()?"":`<div class="sendbox noprint">${sent?`<span class="ok">✓ Sent to ${esc(sentTo())} · ${esc(fmtWhen(sentAt))}</span><small class="muted">Change anything and press Send again.</small>`:`<small class="muted">Done? Press Send and ${esc(sentTo())} ${S.engNames?"have":"has"} it straight away.</small>`}
        <button class="btn primary big" data-act="send" data-k="${esc(key)}" ${one?`data-entry="${esc(one.k)}"`:""}>${sent?"Send again":"Send to "+esc(sentTo())}</button>
        ${kind==="post"?`<button class="btn" data-act="print">Save as PDF</button>`:""}</div>`}
    </div>`;
  document.querySelectorAll("#form textarea").forEach(autosize);
  if(one) autoWxEntry(e,key,one);
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
  if(a==="push-on"){ pushOn(); return; }
  if(a==="push-test"){ const r=await sb.functions.invoke("rh-remind",{body:{test:true}}); toast(r.error?"Couldn't send the test.":(r.data&&r.data.sent?"Test sent. It should arrive in a few seconds.":"No phone registered. Turn reminders on again.")); if(r.data&&r.data.sent===0){ PUSH.state="off"; route(); } return; }
  const form=b.closest("#form"), key=form?form.dataset.key:b.dataset.k, B=key&&S.briefs[key];
  if(a==="sess"){ S.sessSel[key]=b.dataset.v; route(); return; }
  if(isEng()&&/^(eadd|eaddo|eaddx|sess)$/.test(a)) return;
  if(a==="eaddo"||a==="eaddx"){ const k2=(S.route.slice(1,3).join("|"))+"|event"; S.open[k2+"add"]=a==="eaddo"; route(); return; }
  if(a==="eadd"){ const [,ev,dr]=S.route, k2=bkey(ev,dr,"event"); if(!S.briefs[k2]) S.briefs[k2]=brief(ev,dr,"event"); const B2=S.briefs[k2], e=S.events.find(x=>x.id===ev);
    B2.data.list=evEntries(B2.data,e,B2).map(({k,label,sk,sent})=>({k,label,sk,sent})); const ss=(e.sessions||[]).find(x=>x.key===b.dataset.v);
    const n=B2.data.list.filter(x=>x.sk===b.dataset.v).length, k="e"+Date.now().toString(36);
    const label=ss?(n?`${ss.label} · ${n+1}`:ss.label):`Extra run ${B2.data.list.filter(x=>!x.sk).length+1}`;
    B2.data.list.push({k,label,sk:b.dataset.v||""}); B2.data.s=B2.data.s||{}; B2.data.s[k]={}; S.open[k2+"add"]=false; queueSave(k2,0); location.hash=`#/b/${ev}/${dr}/event/${k}`; return; }
  if(!B||isEng()) return;
  if(a==="set"){ const cur=getP(B.data,b.dataset.f); setP(B.data,b.dataset.f,cur===+b.dataset.v?null:+b.dataset.v); queueSave(key); route(); return; }
  if(a==="popen"){ const id=key+b.dataset.p; S.open[id]=S.open[id]===b.dataset.v||!b.dataset.v?null:b.dataset.v; anchorRoute(b,!b.dataset.v||b.closest(".foot2")); return; }
  if(a==="pset"){ const cur=getP(B.data,b.dataset.f); setP(B.data,b.dataset.f,cur===+b.dataset.v?null:+b.dataset.v); queueSave(key); anchorRoute(b); return; }
  if(a==="psetk"){ const cur=getP(B.data,b.dataset.f); setP(B.data,b.dataset.f,cur===b.dataset.v?null:b.dataset.v); queueSave(key); anchorRoute(b); return; }
  if(a==="pallc"){ const P=b.dataset.f; setP(B.data,P+"allc",!getP(B.data,P+"allc")); if(getP(B.data,P+"allc")) setP(B.data,P+"turns",[]); queueSave(key); anchorRoute(b); return; }
  if(a==="pturn"){ const P=b.dataset.f, n=+b.dataset.v, L=getP(B.data,P+"turns")||[]; setP(B.data,P+"allc",false); setP(B.data,P+"turns",L.includes(n)?L.filter(x=>x!==n):[...L,n]); queueSave(key); anchorRoute(b); return; }
  if(a==="toggle"){ const L=getP(B.data,b.dataset.f)||[]; const v=b.dataset.v; setP(B.data,b.dataset.f,L.includes(v)?L.filter(x=>x!==v):[...L,v]); queueSave(key); anchorRoute(b); return; }
  if(a==="setkey"){ const cur=getP(B.data,b.dataset.f); setP(B.data,b.dataset.f,cur===b.dataset.v?null:b.dataset.v); queueSave(key); route(); return; }
  if(a==="send"){ document.querySelectorAll("#form [data-f]").forEach(x=>{ if(x.matches("input,textarea")) setP(B.data,x.dataset.f,x.value); });
    const now=new Date().toISOString();
    if(b.dataset.entry){ const e=S.events.find(x=>x.id===B.event_id); B.data.list=evEntries(B.data,e,B).map(({k,label,sk,sent})=>({k,label,sk,sent})); const it=B.data.list.find(x=>x.k===b.dataset.entry); if(it) it.sent=now; }
    B.status="sent"; B.sent_at=now; clearTimeout(timers[key]); await flush(key);
    if($("#sync").classList.contains("bad")) toast("Couldn't send yet. It's kept on this phone; try again with signal."); else { toast("Sent to "+sentTo()+"."); route(); } return; }
});
/* weight wheel opens at the last weight; closing it without scrolling still logs that value */
document.addEventListener("focusout",ev=>{ const t=ev.target; if(!t.matches||!t.matches("select[data-num]")||isEng()) return; const form=t.closest("#form"); if(!form) return;
  const B=S.briefs[form.dataset.key]; if(B&&getP(B.data,t.dataset.f)==null){ t.dispatchEvent(new Event("input",{bubbles:true})); } });
document.addEventListener("input",ev=>{
  const t=ev.target; if(t.matches("textarea")) autosize(t);
  const form=t.closest("#form"); if(!form||!t.dataset.f||isEng()) return; const key=form.dataset.key, B=S.briefs[key];
  if(t.matches("select[data-num]")){ setP(B.data,t.dataset.f,t.value===""?null:+t.value); ls.set("pend:"+key,{key,row:{event_id:B.event_id,driver_id:B.driver_id,kind:B.kind,data:B.data,status:B.status||"draft",sent_at:B.sent_at||null},at:Date.now()}); queueSave(key); anchorRoute(t); return; }
  setP(B.data,t.dataset.f,t.value); ls.set("pend:"+key,{key,row:{event_id:B.event_id,driver_id:B.driver_id,kind:B.kind,data:B.data,status:B.status||"draft",sent_at:B.sent_at||null},at:Date.now()}); queueSave(key);
});
document.addEventListener("submit",async ev=>{
  ev.preventDefault();
  if(ev.target.id==="loginForm"){ const btn=ev.target.querySelector("button"); btn.disabled=true; btn.textContent="Signing in…";
    let u=$("#lgEmail").value.trim().toLowerCase(); const ALIAS={riki:"riki@rikichristo.com"}; if(ALIAS[u]) u=ALIAS[u]; else if(!u.includes("@")) u+="@drivers.rikichristo.com";
    const {error}=await sb.auth.signInWithPassword({email:u,password:$("#lgPass").value});
    if(error){ $("#main").innerHTML=loginHTML("That username or password didn't match. Try again."); return; } boot(); }
  if(ev.target.id==="pwForm"){ const {error}=await sb.auth.updateUser({password:$("#pw1").value}); toast(error?"Couldn't change it: "+error.message:"Password changed."); if(!error) location.hash="#/"; }
});
window.addEventListener("online",()=>Object.keys(S.briefs).forEach(k=>{ if(ls.get("pend:"+k)) flush(k); }));
boot();
