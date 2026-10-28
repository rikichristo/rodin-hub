/* Rodin Hub · driver's own pages: My notes, Checklist, Add event, and weather */

/* ---------- weather (Open-Meteo, no key) ---------- */
const WXC={0:["☀️","Clear"],1:["🌤","Mostly clear"],2:["⛅","Partly cloudy"],3:["☁️","Overcast"],45:["🌫","Fog"],48:["🌫","Fog"],51:["🌦","Light drizzle"],53:["🌦","Drizzle"],55:["🌦","Heavy drizzle"],56:["🌧","Freezing drizzle"],57:["🌧","Freezing drizzle"],61:["🌧","Light rain"],63:["🌧","Rain"],65:["🌧","Heavy rain"],66:["🌧","Freezing rain"],67:["🌧","Freezing rain"],71:["🌨","Light snow"],73:["🌨","Snow"],75:["🌨","Heavy snow"],77:["🌨","Snow grains"],80:["🌦","Showers"],81:["🌦","Showers"],82:["⛈","Heavy showers"],85:["🌨","Snow showers"],86:["🌨","Snow showers"],95:["⛈","Thunderstorm"],96:["⛈","Thunderstorm"],99:["⛈","Thunderstorm"]};
const wxTxt=c=>WXC[c]||["",""];
const WXCACHE={};
const addDays=(d,n)=>{const x=new Date(d+"T12:00:00");x.setDate(x.getDate()+n);return x.toISOString().slice(0,10)};
async function wxRange(lat,lon,from,to){
  const k=[lat,lon,from,to].join("|"); if(WXCACHE[k]) return WXCACHE[k];
  const old=to<addDays(today(),-80), base=old?"https://archive-api.open-meteo.com/v1/archive":"https://api.open-meteo.com/v1/forecast";
  const q=new URLSearchParams({latitude:lat,longitude:lon,timezone:"auto",start_date:from,end_date:to,
    hourly:"temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m",
    daily:"weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max"+(old?"":",precipitation_probability_max")});
  WXCACHE[k]=fetch(base+"?"+q).then(r=>r.ok?r.json():null).catch(()=>null);
  const v=await WXCACHE[k]; if(!v) delete WXCACHE[k]; return v;
}
function sessHour(s){ const m=String(s&&s.time||"").match(/(\d{1,2})[:.](\d{2})\D+(\d{1,2})[:.](\d{2})/); if(m) return Math.round(((+m[1]*60+ +m[2])+(+m[3]*60+ +m[4]))/120);
  const l=String(s&&(s.label||s.key)||"").toLowerCase(); return /pm/.test(l)?15:/am/.test(l)?11:12; }
/* weather at a place, date and hour → small object we log with the notes */
async function wxAt(lat,lon,date,hour){
  if(lat==null||lon==null||!date||date>addDays(today(),14)) return null;
  const v=await wxRange(lat,lon,date,date); if(!v||!v.hourly) return null;
  const i=Math.max(0,Math.min(23,hour||12)), H=v.hourly;
  if(H.temperature_2m[i]==null) return null;
  return {t:Math.round(H.temperature_2m[i]),rh:H.relative_humidity_2m[i],wind:Math.round(H.wind_speed_10m[i]),rain:H.precipitation[i],code:H.weather_code[i],txt:wxTxt(H.weather_code[i])[1],at:pad(i)+":00",fc:date>today()};
}
function wxLine(w){ if(!w) return ""; const [ic,tx]=wxTxt(w.code); return `${ic} ${esc(tx||w.txt||"")} · ${w.t}°C air · wind ${w.wind} km/h · ${w.rh}% humidity${w.rain?` · ${w.rain} mm rain`:""}`; }
/* event weather card: one line per day */
function wxCardHolder(e){ return e&&e.lat!=null&&e.kind!=="sim"?`<div class="card wx" id="wxcard" data-ev="${e.id}"><div class="card-h"><h2>Weather</h2><span class="eyebrow">${esc((e.location||"").split(",")[0])}</span></div><div class="muted" style="font-size:.86rem">Loading…</div></div>`:""; }
async function fillWxCard(){
  const el=$("#wxcard"); if(!el) return; const e=S.events.find(x=>x.id===el.dataset.ev); if(!e) return;
  const to=e.date_to||e.date_from; if(e.date_from>addDays(today(),14)){ el.querySelector(".muted").textContent="The forecast appears here two weeks before the event."; return; }
  const v=await wxRange(e.lat,e.lon,e.date_from,to); if(!$("#wxcard")) return;
  if(!v||!v.daily){ el.querySelector(".muted").textContent="Weather isn't available right now."; return; }
  const D=v.daily, t=today();
  el.innerHTML=`<div class="card-h"><h2>Weather</h2><span class="eyebrow">${esc((e.location||"").split(",")[0])} · ${to<t?"recorded":"forecast"}</span></div><div class="wxdays">${D.time.map((d,i)=>{const [ic,tx]=wxTxt(D.weather_code[i]);return `<div class="wxd"><b>${esc(fmtDay(d))}</b><span class="ic">${ic}</span><span>${esc(tx)}</span><span class="mono">${Math.round(D.temperature_2m_max[i])}° / ${Math.round(D.temperature_2m_min[i])}°</span><small>${D.precipitation_probability_max?`Rain ${D.precipitation_probability_max[i]??"–"}%`:`Rain ${D.precipitation_sum[i]??0} mm`} · wind ${Math.round(D.wind_speed_10m_max[i])} km/h</small></div>`}).join("")}</div><small class="muted" style="font-size:.72rem">Each session page logs the weather at that session's time.</small>`;
}
/* auto-log weather into a session entry of the Event Brief */
function autoWxEntry(e,key,one){
  if(isEng()||!one||one.f.wx||e.lat==null) return; const ss=(e.sessions||[]).find(x=>x.key===one.sk); const date=(ss&&ss.date)||null; if(!date||date>today()) return;
  wxAt(e.lat,e.lon,date,sessHour(ss)).then(w=>{ if(!w) return; const B=S.briefs[key]; if(!B) return; const tgt=getP(B.data,`s.${one.k}`); if(!tgt||tgt.wx) return; tgt.wx=w; queueSave(key,200);
    const el=document.querySelector(`[data-wx="${CSS.escape(one.k)}"]`); if(el) el.innerHTML=wxLine(w)+(w.fc?" <small>(forecast)</small>":""); });
}

/* ---------- tracks for Add event ---------- */
const TRACKS=[
 ["Red Bull Ring","Spielberg, Austria","4.318 km · 10 turns",47.2197,14.7647],
 ["Circuit de Barcelona-Catalunya","Barcelona, Spain","4.657 km · 14 turns",41.57,2.2611],
 ["Circuito de Jerez – Ángel Nieto","Jerez de la Frontera, Spain","4.428 km · 13 turns",36.7083,-6.0342],
 ["Circuit Ricardo Tormo","Valencia, Spain","4.005 km · 14 turns",39.4889,-0.6281],
 ["MotorLand Aragón","Alcañiz, Spain","5.345 km · 17 turns",41.0786,-0.2042],
 ["Circuito de Navarra","Los Arcos, Spain","3.933 km · 15 turns",42.5594,-2.1683],
 ["Algarve International Circuit","Portimão, Portugal","4.653 km · 15 turns",37.227,-8.6267],
 ["Monza","Monza, Italy","5.793 km · 11 turns",45.6156,9.2811],
 ["Imola","Imola, Italy","4.909 km · 19 turns",44.3439,11.7167],
 ["Mugello","Scarperia, Italy","5.245 km · 15 turns",43.9975,11.3719],
 ["Hungaroring","Budapest, Hungary","4.381 km · 14 turns",47.5789,19.2486],
 ["Silverstone","Silverstone, UK","5.891 km · 18 turns",52.0786,-1.0169],
 ["Spa-Francorchamps","Spa, Belgium","7.004 km · 19 turns",50.4372,5.9714],
 ["Zandvoort","Zandvoort, Netherlands","4.259 km · 14 turns",52.3888,4.5409],
 ["Paul Ricard","Le Castellet, France","5.842 km · 15 turns",43.2506,5.7917],
 ["Magny-Cours","Magny-Cours, France","4.411 km · 17 turns",46.8642,3.1636],
 ["Hockenheimring","Hockenheim, Germany","4.574 km · 17 turns",49.3278,8.5656],
 ["Monaco","Monte Carlo, Monaco","3.337 km · 19 turns",43.7347,7.4206],
 ["Bahrain International Circuit","Sakhir, Bahrain","5.412 km · 15 turns",26.0325,50.5106],
 ["Albert Park","Melbourne, Australia","5.278 km · 14 turns",-37.8497,144.968]];

/* ---------- shared bits ---------- */
function navHTML(on){ return `<nav class="tabs noprint">${[["ev","#/","Events"],["notes","#/notes","My notes"],["lists","#/lists","Checklist"]].map(([k,h,l])=>`<a href="${h}" ${on===k?'aria-current="page"':""}>${l}</a>`).join("")}</nav>`; }
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const X={notes:null,list:null,saveT:{},open:{}};
function xsync(t,st){ if(typeof sync==="function") sync(t,st); }
function myEvents(){ const d=myDriver(); return d?eventsFor(d):[]; }
function evShort(e){ return e?`${(e.location||e.track||e.name).split(",")[0]} · ${fmtDay(e.date_from)}`:""; }
function noEv(){ return `<div class="notice"><b>Your account isn't linked to a driver yet.</b><span>Ask Riki.</span></div>`; }

/* ---------- My notes ---------- */
async function loadNotes(force){
  if(X.notes&&!force) return X.notes;
  const q=sb.from("rh_dnotes").select("*").order("created_at",{ascending:false});
  const {data,error}=isCoach()?await q.eq("shared",true):await q.eq("user_id",S.user.id);
  X.notes=error?[]:(data||[]); return X.notes;
}
function noteTitle(n){ const d=n.data||{}; return d.title||(d.body||"").split("\n")[0].slice(0,60)||"Untitled note"; }
async function renderNotes(){
  if(!isCoach()&&!myDriver()){ $("#main").innerHTML=noEv(); return; }
  $("#main").innerHTML=(isCoach()?"":navHTML("notes"))+`<div class="notice">Loading…</div>`;
  const L=await loadNotes(); if(S.route[0]!=="notes"||S.route[1]) return;
  if(isCoach()){ $("#main").innerHTML=`<div class="noprint"><a class="link" href="#/">← All drivers</a></div><h1 class="ph">Shared notes</h1>${L.length?`<div class="nlist">${L.map(n=>noteRow(n,true)).join("")}</div>`:`<div class="notice"><b>No shared notes yet.</b><span>Drivers' notes stay private until they tick "Share with Riki".</span></div>`}`; return; }
  $("#main").innerHTML=`${navHTML("notes")}<div class="phead"><h1 class="ph">My notes</h1><button class="btn primary" data-xact="note-new">+ New note</button></div>
    <p class="muted" style="margin:0;font-size:.88rem">Your own notes to look back on. Private unless you tick "Share with Riki".</p>
    ${L.length?`<div class="nlist">${L.map(n=>noteRow(n)).join("")}</div>`:`<div class="notice"><b>No notes yet.</b><span>Tap <b>+ New note</b> after a session, a sim day or any time something's worth remembering.</span></div>`}`;
}
function noteRow(n,coach){
  const d=n.data||{}, e=S.events.find(x=>x.id===n.event_id), dr=coach?S.drivers.find(x=>x.id===n.driver_id):null;
  const meta=[dr&&("#"+dr.car_no+" "+dr.full_name.split(" ").slice(-1)[0]),e&&evShort(e),d.sk_label,fmtWhen(n.created_at)].filter(Boolean).join(" · ");
  const chips=[...(d.tyres||[]),d.lap&&("⏱ "+d.lap),d.wt_pre!=null&&d.wt_post!=null&&(`${(+d.wt_pre).toFixed(1)}→${(+d.wt_post).toFixed(1)} kg`)].filter(Boolean);
  return `<a class="nrow" href="#/notes/${n.id}"><b>${esc(noteTitle(n))}</b><small>${esc(meta)}${!coach&&n.shared?" · shared":""}</small>${chips.length?`<span class="nchips">${chips.map(c=>`<span class="tag" data-v="${esc(c)}">${esc(c)}</span>`).join("")}</span>`:""}${d.body?`<span class="nbody">${esc(d.body.slice(0,140))}${d.body.length>140?"…":""}</span>`:""}</a>`;
}
async function newNote(){
  const d=myDriver(); if(!d) return; const evs=myEvents(), t=today();
  const cur=evs.find(e=>e.date_from<=t&&(e.date_to||e.date_from)>=t)||evs.find(e=>e.id===S.evSel);
  const {data,error}=await sb.from("rh_dnotes").insert({driver_id:d.id,user_id:S.user.id,event_id:cur?cur.id:null,data:{}}).select().single();
  if(error){ toast("Couldn't create the note. Check signal and try again."); return; }
  X.notes=[data,...(X.notes||[])]; location.hash="#/notes/"+data.id;
}
function noteById(id){ return (X.notes||[]).find(n=>n.id===id); }
async function renderNote(id){
  await loadNotes(); const n=noteById(id);
  if(!n){ $("#main").innerHTML=`<div class="notice"><b>Note not found.</b><a href="#/notes">Back to notes</a></div>`; return; }
  const mine=n.user_id===S.user.id, d=n.data||(n.data={}), evs=myEvents(), e=S.events.find(x=>x.id===n.event_id), ses=e?(e.sessions||[]):[];
  const ro=!mine?"disabled":"";
  const T=["New","Fresh","Used","Soft","Medium","Hard"], base=d.wt_pre??d.wt_post??70;
  const wbox=(k,l,v)=>`<label class="wbox ${v!=null?"set":""}"><span>${l}</span><b>${v!=null?(+v).toFixed(1)+" kg":"– kg"}</b><select data-nf="${k}" data-num aria-label="${l} weight" ${ro}>${WOPTS(v??base)}</select></label>`;
  const diff=d.wt_pre!=null&&d.wt_post!=null?d.wt_post-d.wt_pre:null;
  const tr=e&&d.sk?tRow(e.id,d.sk,myDriver()||S.drivers.find(x=>x.id===n.driver_id)):null;
  $("#main").innerHTML=`${mine?navHTML("notes"):""}<div class="noprint"><a class="link" href="#/notes">← ${mine?"My notes":"Shared notes"}</a></div>
  <div class="card note" id="nform" data-id="${n.id}"><fieldset class="ro" ${ro}>
    <div class="q"><label class="lbl" for="n-title">Title</label><input type="text" id="n-title" data-nf="title" value="${esc(d.title||"")}" placeholder="e.g. Day 1 PM · long run"></div>
    <div class="q"><div class="lbl">Event &amp; session</div><div class="two">
      <select data-nf="event_id" aria-label="Event"><option value="">No event</option>${evs.map(x=>`<option value="${x.id}" ${x.id===n.event_id?"selected":""}>${esc(evShort(x))}</option>`).join("")}</select>
      <select data-nf="sk" aria-label="Session" ${e?"":"disabled"}><option value="">${e?"Any / not a session":"–"}</option>${ses.map(s=>`<option value="${esc(s.key)}" ${s.key===d.sk?"selected":""}>${esc(s.label)}</option>`).join("")}</select></div>
      <div class="wxline" id="n-wx">${d.wx?wxLine(d.wx)+(d.wx.fc?" <small>(forecast)</small>":""):e&&e.lat!=null?`<span class="muted">Weather logs itself once the date's here.</span>`:""}</div></div>
    <div class="q"><div class="lbl">Tyres</div><div class="chips">${T.map(t=>`<button type="button" data-xact="n-tyre" data-v="${t}" data-v2="${esc(t)}" aria-pressed="${(d.tyres||[]).includes(t)}">${t}</button>`).join("")}</div></div>
    <div class="q"><label class="lbl" for="n-run">Run plan</label><textarea id="n-run" data-nf="run" rows="2" placeholder="e.g. 3 push laps, cool, 6-lap long run">${esc(d.run||"")}</textarea></div>
    <div class="q"><div class="lbl">Weight</div><div class="wrow">${wbox("wt_pre","Before",d.wt_pre)}${wbox("wt_post","After",d.wt_post)}<div class="wdiff ${diff==null?"":diff<0?"down":"up"}"><span>Change</span><b>${diff==null?"–":(diff>0?"+":diff<0?"−":"±")+Math.abs(diff).toFixed(1)+" kg"}</b></div></div></div>
    <div class="q"><label class="lbl" for="n-lap">Best lap</label>${tr&&lapMs(tr.best)?`<small class="tsrc">Official: ${esc(tr.best)} · P${tr.pos}</small>`:""}<input type="text" id="n-lap" data-nf="lap" value="${esc(d.lap||"")}" placeholder="${tr&&tr.best?esc(tr.best):"1:24.512"}" inputmode="decimal"></div>
    <div class="q"><label class="lbl" for="n-body">Notes</label><textarea id="n-body" data-nf="body" rows="8" placeholder="Anything you want to remember: feel, set-up, what worked, what to try next.">${esc(d.body||"")}</textarea></div>
  </fieldset>
  ${mine?`<div class="nfoot"><label class="share"><input type="checkbox" data-nf="shared" ${n.shared?"checked":""}> Share with Riki</label>${X.open.del===n.id?`<span><button class="btn sm danger" data-xact="n-del">Delete note</button> <button class="btn sm" data-xact="n-keep">Keep</button></span>`:`<button class="btn sm" data-xact="n-ask">Delete</button>`}</div>`:""}
  </div>`;
  document.querySelectorAll("#nform textarea").forEach(autosize);
  if(mine&&!d.wx&&e&&e.lat!=null){ const ss=ses.find(s=>s.key===d.sk); const date=(ss&&ss.date)||(n.created_at||"").slice(0,10); const hr=ss?sessHour(ss):new Date(n.created_at).getHours();
    if(date>=e.date_from&&date<=(e.date_to||e.date_from)&&date<=today()) wxAt(e.lat,e.lon,date,hr).then(w=>{ if(!w||noteById(n.id)!==n||n.data.wx) return; n.data.wx=w; saveNote(n,0); const el=$("#n-wx"); if(el) el.innerHTML=wxLine(w); }); }
}
function saveNote(n,delay=700){
  clearTimeout(X.saveT[n.id]); xsync("Saving…");
  X.saveT[n.id]=setTimeout(async()=>{ const {error}=await sb.from("rh_dnotes").update({data:n.data,event_id:n.event_id||null,shared:!!n.shared,updated_at:new Date().toISOString()}).eq("id",n.id); xsync(error?"Not saved · try again":"Saved",error?"bad":"ok"); },delay);
}

/* ---------- Checklist ---------- */
async function loadList(){
  if(X.list) return X.list;
  const {data}=await sb.from("rh_lists").select("*").eq("user_id",S.user.id).maybeSingle();
  X.list=(data&&data.data&&data.data.groups)?data.data:{groups:[{id:uid(),name:"To do",items:[]}]}; return X.list;
}
function saveList(){ clearTimeout(X.saveT.list); xsync("Saving…"); X.saveT.list=setTimeout(async()=>{ const {error}=await sb.from("rh_lists").upsert({user_id:S.user.id,data:X.list,updated_at:new Date().toISOString()}); xsync(error?"Not saved · try again":"Saved",error?"bad":"ok"); },500); }
async function renderLists(){
  $("#main").innerHTML=navHTML("lists")+`<div class="notice">Loading…</div>`;
  const L=await loadList(); if(S.route[0]!=="lists") return;
  const G=L.groups;
  $("#main").innerHTML=`${navHTML("lists")}<div class="phead"><h1 class="ph">Checklist</h1></div>
    <p class="muted" style="margin:0;font-size:.88rem">Your own lists: kit, prep, things to try, questions for the team. Only you see them.</p>
    ${G.map(g=>{const open=g.items.filter(i=>!i.done), done=g.items.filter(i=>i.done);return `<div class="card lgrp" data-g="${g.id}">
      <div class="card-h">${X.open.ren===g.id?`<input type="text" class="gname" id="gn-${g.id}" value="${esc(g.name)}" aria-label="List name"><div class="r"><button class="btn sm primary" data-xact="g-ren-save" data-g="${g.id}">Save</button></div>`
        :`<h2>${esc(g.name)}</h2><span class="eyebrow">${open.length} to do</span><div class="r">${X.open.gdel===g.id?`<button class="btn sm danger" data-xact="g-del" data-g="${g.id}">Delete list</button><button class="btn sm" data-xact="x-cancel">Keep</button>`:`<button class="btn sm" data-xact="g-ren" data-g="${g.id}" aria-label="Rename">Rename</button><button class="btn sm" data-xact="g-ask" data-g="${g.id}" aria-label="Delete list">×</button>`}</div>`}</div>
      <div class="litems">${[...open,...done].map(i=>`<div class="li ${i.done?"done":""}"><button class="tick" data-xact="i-tick" data-g="${g.id}" data-i="${i.id}" aria-pressed="${!!i.done}" aria-label="${i.done?"Not done":"Done"}">${i.done?"✓":""}</button><span>${esc(i.t)}</span><button class="link" data-xact="i-del" data-g="${g.id}" data-i="${i.id}" aria-label="Remove">×</button></div>`).join("")||`<div class="muted" style="font-size:.86rem;padding:4px 0">Nothing here yet.</div>`}</div>
      <form class="ladd" data-g="${g.id}"><input type="text" placeholder="Add to ${esc(g.name)}…" aria-label="New item"><button class="btn" type="submit">Add</button></form></div>`}).join("")}
    <form class="ladd newg" id="newg"><input type="text" placeholder="New list, e.g. Kit bag, Sim prep, Questions" aria-label="New list name"><button class="btn primary" type="submit">+ New list</button></form>`;
}

/* ---------- Add / edit event ---------- */
function evFormState(id){
  if(X.ef&&X.ef.id===(id||null)) return X.ef;
  const e=id?S.events.find(x=>x.id===id):null, t=today();
  const ti=e?TRACKS.findIndex(x=>x[0]===e.track):0;
  const perDay=e?Math.max(1,Math.round((e.sessions||[]).length/Math.max(1,dayCount(e.date_from,e.date_to)))):2;
  return X.ef={id:id||null,name:e?e.name:"",kind:e?e.kind:"test",car:e?e.car||"":"",track:ti<0?"other":String(ti),otrack:ti<0&&e?e.track:"",oloc:ti<0&&e?e.location:"",from:e?e.date_from:t,to:e?(e.date_to||e.date_from):t,per:perDay};
}
function dayCount(a,b){ if(!a) return 1; return Math.max(1,Math.min(7,Math.round((new Date((b||a)+"T12:00:00")-new Date(a+"T12:00:00"))/864e5)+1)); }
function buildSessions(from,to,per,kind){
  const n=dayCount(from,to), out=[]; for(let i=0;i<n;i++){ const date=addDays(from,i), D=n>1?`Day ${i+1}`:(kind==="race"?"Weekend":"Day 1");
    if(per===2){ out.push({key:`d${i+1}am`,date,time:"",label:`${D} · AM`},{key:`d${i+1}pm`,date,time:"",label:`${D} · PM`}); }
    else if(per===1){ out.push({key:`d${i+1}`,date,time:"",label:D}); }
    else for(let s=1;s<=per;s++) out.push({key:`d${i+1}s${s}`,date,time:"",label:`${D} · S${s}`}); }
  return out;
}
function renderEvForm(id){
  const d=myDriver(); if(!d&&!isCoach()){ $("#main").innerHTML=noEv(); return; }
  const e=id?S.events.find(x=>x.id===id):null;
  if(id&&(!e||!(isCoach()||e.owner_driver_id===(d&&d.id)))){ $("#main").innerHTML=`<div class="notice"><b>You can only edit events you added.</b><a href="#/">Back</a></div>`; return; }
  const f=evFormState(id);
  $("#main").innerHTML=`${navHTML("ev")}<div class="noprint"><a class="link" href="#/">← Events</a></div>
  <div class="card" id="evform"><div class="card-h"><h2>${id?"Edit event":"Add an event"}</h2></div>
    <p class="muted" style="margin:0;font-size:.88rem">${id?"":"Your own test, race or sim day. It gets the same Pre-Event, Event and Post-Event briefs, and only you, Riki and your engineer see it."}</p>
    <div class="q"><div class="lbl">Type</div><div class="chips">${[["test","Test"],["race","Race"],["sim","Simulator"]].map(([k,l])=>`<button type="button" data-xact="ef-kind" data-v="${k}" aria-pressed="${f.kind===k}">${l}</button>`).join("")}</div></div>
    <div class="q"><label class="lbl" for="ef-name">Name</label><input type="text" id="ef-name" data-ef="name" value="${esc(f.name)}" placeholder="${f.kind==="sim"?"e.g. Sim prep · Macau":"e.g. F3H test, Private test"}"></div>
    <div class="q"><label class="lbl" for="ef-car">Car</label><input type="text" id="ef-car" data-ef="car" value="${esc(f.car)}" placeholder="e.g. F3H test car, F3 2026, sim rig"></div>
    ${f.kind==="sim"?"":`<div class="q"><label class="lbl" for="ef-track">Track</label><select id="ef-track" data-ef="track">${TRACKS.map((t,i)=>`<option value="${i}" ${f.track===String(i)?"selected":""}>${esc(t[0])} · ${esc(t[1].split(",").slice(-1)[0].trim())}</option>`).join("")}<option value="other" ${f.track==="other"?"selected":""}>Other track…</option></select>
      ${f.track==="other"?`<div class="two" style="margin-top:8px"><input type="text" data-ef="otrack" value="${esc(f.otrack)}" placeholder="Track name" aria-label="Track name"><input type="text" data-ef="oloc" value="${esc(f.oloc)}" placeholder="Town, Country" aria-label="Town and country"></div><small>The town is used to fill in the weather.</small>`:""}</div>`}
    <div class="q"><div class="lbl">Dates</div><div class="two"><label class="dl"><span>From</span><input type="date" data-ef="from" value="${esc(f.from)}"></label><label class="dl"><span>To</span><input type="date" data-ef="to" value="${esc(f.to)}"></label></div></div>
    <div class="q"><div class="lbl">Sessions per day</div><div class="chips">${[[1,"1"],[2,"2 · AM & PM"],[3,"3"],[4,"4"]].map(([k,l])=>`<button type="button" data-xact="ef-per" data-v="${k}" aria-pressed="${f.per===k}">${l}</button>`).join("")}</div><small>${esc(buildSessions(f.from,f.to,f.per,f.kind).map(s=>s.label).join(", "))}</small></div>
    <div class="sendbox"><button class="btn primary big" data-xact="ef-save" ${X.efBusy?"disabled":""}>${X.efBusy?"Saving…":id?"Save changes":"Add event"}</button>
      ${id?(X.open.edel?`<button class="btn danger" data-xact="ef-del">Delete event and its briefs</button><button class="btn" data-xact="x-cancel">Keep</button>`:`<button class="btn" data-xact="ef-ask">Delete event</button>`):""}</div>
  </div>`;
}
async function geocode(name){ try{ const r=await fetch("https://geocoding-api.open-meteo.com/v1/search?"+new URLSearchParams({name:name.split(",")[0].trim(),count:1,language:"en"})); const j=await r.json(); const g=j&&j.results&&j.results[0]; return g?[g.latitude,g.longitude]:[null,null]; }catch(e){ return [null,null]; } }
async function saveEvForm(){
  const f=X.ef, d=myDriver(); if(!f) return;
  if(!f.name.trim()){ toast("Give the event a name."); return; }
  if(!f.from){ toast("Add the dates."); return; } if(f.to&&f.to<f.from) f.to=f.from;
  X.efBusy=true; renderEvForm(f.id);
  let track="",loc="",info="",lat=null,lon=null;
  if(f.kind!=="sim"){ if(f.track==="other"){ track=f.otrack.trim(); loc=f.oloc.trim(); if(loc) [lat,lon]=await geocode(loc); } else { const T=TRACKS[+f.track]; [track,loc,info,lat,lon]=T; } }
  const old=f.id?S.events.find(x=>x.id===f.id):null;
  let ses=buildSessions(f.from,f.to||f.from,f.per,f.kind);
  if(old){ const keep={}; (old.sessions||[]).forEach(s=>keep[s.key]=s); ses=ses.map(s=>keep[s.key]?{...s,time:keep[s.key].time||""}:s); }
  const row={kind:f.kind,name:f.name.trim(),car:f.car.trim(),location:loc,track,track_info:info,date_from:f.from,date_to:f.to||f.from,sessions:ses,lat,lon};
  let res;
  if(old) res=await sb.from("rh_events").update(row).eq("id",old.id).select().single();
  else { const mine=myEvents().filter(x=>(x.date_to||x.date_from)<f.from).sort((a,b)=>(a.date_from<b.date_from?1:-1));
    res=await sb.from("rh_events").insert({...row,series_id:d?d.series_id:null,owner_driver_id:d?d.id:null,driver_ids:d?[d.id]:null,prev_event_id:mine[0]?mine[0].id:null}).select().single(); }
  X.efBusy=false;
  if(res.error){ console.warn(res.error); toast("Couldn't save the event: "+res.error.message); renderEvForm(f.id); return; }
  const i=S.events.findIndex(x=>x.id===res.data.id); if(i>=0) S.events[i]=res.data; else S.events.push(res.data);
  S.events.sort((a,b)=>(a.date_from||"")<(b.date_from||"")?-1:1);
  S.evSel=res.data.id; ls.set("ev",S.evSel); X.ef=null; toast(old?"Event saved.":"Event added. Start with your Pre-Event Brief."); location.hash="#/";
}

/* ---------- events (own listeners, so the brief handlers stay untouched) ---------- */
document.addEventListener("click",async ev=>{
  const b=ev.target.closest("[data-xact]"); if(!b) return; const a=b.dataset.xact;
  if(a==="note-new"){ newNote(); return; }
  if(a==="x-cancel"){ X.open={}; route(); return; }
  const nf=b.closest("#nform"), n=nf&&noteById(nf.dataset.id);
  if(n&&n.user_id===S.user.id){
    if(a==="n-tyre"){ const L=n.data.tyres||[]; n.data.tyres=L.includes(b.dataset.v)?L.filter(x=>x!==b.dataset.v):[...L,b.dataset.v]; b.setAttribute("aria-pressed",n.data.tyres.includes(b.dataset.v)); saveNote(n); return; }
    if(a==="n-ask"){ X.open.del=n.id; renderNote(n.id); return; }
    if(a==="n-keep"){ X.open.del=null; renderNote(n.id); return; }
    if(a==="n-del"){ const {error}=await sb.from("rh_dnotes").delete().eq("id",n.id); if(error){ toast("Couldn't delete."); return; } X.notes=X.notes.filter(x=>x.id!==n.id); X.open.del=null; location.hash="#/notes"; return; }
  }
  const g=b.dataset.g&&X.list&&X.list.groups.find(x=>x.id===b.dataset.g);
  if(a==="i-tick"&&g){ const it=g.items.find(x=>x.id===b.dataset.i); if(it){ it.done=!it.done; saveList(); renderLists(); } return; }
  if(a==="i-del"&&g){ g.items=g.items.filter(x=>x.id!==b.dataset.i); saveList(); renderLists(); return; }
  if(a==="g-ren"&&g){ X.open={ren:g.id}; renderLists(); setTimeout(()=>{ const i=$("#gn-"+g.id); if(i){ i.focus(); i.select(); } },0); return; }
  if(a==="g-ren-save"&&g){ const v=($("#gn-"+g.id).value||"").trim(); if(v) g.name=v; X.open={}; saveList(); renderLists(); return; }
  if(a==="g-ask"&&g){ if(!g.items.length){ X.list.groups=X.list.groups.filter(x=>x!==g); saveList(); renderLists(); return; } X.open={gdel:g.id}; renderLists(); return; }
  if(a==="g-del"&&g){ X.list.groups=X.list.groups.filter(x=>x!==g); X.open={}; saveList(); renderLists(); return; }
  if(a==="ef-kind"){ X.ef.kind=b.dataset.v; renderEvForm(X.ef.id); return; }
  if(a==="ef-per"){ X.ef.per=+b.dataset.v; renderEvForm(X.ef.id); return; }
  if(a==="ef-save"){ saveEvForm(); return; }
  if(a==="ef-ask"){ X.open={edel:true}; renderEvForm(X.ef.id); return; }
  if(a==="ef-del"){ const id=X.ef.id; const {error}=await sb.from("rh_events").delete().eq("id",id); if(error){ toast("Couldn't delete: "+error.message); return; } S.events=S.events.filter(x=>x.id!==id); X.ef=null; X.open={}; S.evSel=null; toast("Event deleted."); location.hash="#/"; return; }
});
document.addEventListener("input",ev=>{
  const t=ev.target;
  if(t.dataset.ef!=null&&X.ef){ X.ef[t.dataset.ef]=t.value; if(t.dataset.ef==="track"||t.dataset.ef==="from"||t.dataset.ef==="to") renderEvForm(X.ef.id); return; }
  const nf=t.closest&&t.closest("#nform"); if(!nf||t.dataset.nf==null) return; const n=noteById(nf.dataset.id); if(!n||n.user_id!==S.user.id) return;
  const k=t.dataset.nf;
  if(t.matches("textarea")) autosize(t);
  if(k==="shared"){ n.shared=t.checked; saveNote(n,0); toast(t.checked?"Shared with Riki.":"Private again."); return; }
  if(k==="event_id"){ n.event_id=t.value||null; n.data.sk=""; n.data.sk_label=""; n.data.wx=null; saveNote(n,0); renderNote(n.id); return; }
  if(k==="sk"){ const e=S.events.find(x=>x.id===n.event_id), s=e&&(e.sessions||[]).find(x=>x.key===t.value); n.data.sk=t.value; n.data.sk_label=s?s.label:""; n.data.wx=null; saveNote(n,0); renderNote(n.id); return; }
  if(t.matches("select[data-num]")){ n.data[k]=t.value===""?null:+t.value; saveNote(n,0); renderNote(n.id); return; }
  n.data[k]=t.value; saveNote(n);
});
document.addEventListener("focusout",ev=>{ const t=ev.target; if(!t.matches||!t.matches("#nform select[data-num]")) return; const n=noteById(t.closest("#nform").dataset.id); if(n&&n.user_id===S.user.id&&n.data[t.dataset.nf]==null) t.dispatchEvent(new Event("input",{bubbles:true})); });
document.addEventListener("submit",ev=>{
  const f=ev.target; if(!f.classList||!f.classList.contains("ladd")) return; ev.preventDefault();
  const inp=f.querySelector("input"), v=(inp.value||"").trim(); if(!v||!X.list) return;
  if(f.id==="newg") X.list.groups.push({id:uid(),name:v,items:[]});
  else { const g=X.list.groups.find(x=>x.id===f.dataset.g); if(g) g.items.push({id:uid(),t:v,done:false}); }
  saveList(); renderLists(); const again=f.id==="newg"?null:document.querySelector(`form.ladd[data-g="${f.dataset.g}"] input`); if(again) again.focus({preventScroll:true});
});
