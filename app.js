// === Altervenator Missions ===
const LS_KEY = 'altervenator_missions_v1';

const defaultState = {
  hero: { name:'Amo', cls:'Asesino', goal:'adelgazar' },
  xp: 0, level: 1, coins: 0,
  expBuffUntil: 0,             // timestamp ms (+% XP)
  expNerfCount: 0,             // próximas N misiones -20% XP
  inventory: { time_potion: 1, str_potion: 1, exp_potion: 0, cure: 0 },
  equipment: [],
  missions: [],
  weeklyUrgents: {},
  lastSeenDay: null,
};

let state = loadState();
const now = () => new Date();
function saveState(){ localStorage.setItem(LS_KEY, JSON.stringify(state)); }
function loadState(){
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || structuredClone(defaultState); }
  catch(e){ return structuredClone(defaultState); }
}
function uid(){ return Math.random().toString(36).slice(2)+Date.now().toString(36); }
function todayStr(d=new Date()){ return d.toISOString().slice(0,10); }
function endOfDay(d=new Date()){ const x=new Date(d); x.setHours(23,59,59,999); return x; }
function today10am(d=new Date()){ const x=new Date(d); x.setHours(10,0,0,0); return x; }
function fmtTimeLeft(ms){ ms=Math.max(0,ms|0); const s=Math.floor(ms/1000); const h=String(Math.floor(s/3600)).padStart(2,'0'); const m=String(Math.floor((s%3600)/60)).padStart(2,'0'); const sc=String(s%60).padStart(2,'0'); return `${h}:${m}:${sc}`; }

// Nivel
function recalcLevel(){ state.level = 1 + Math.floor(state.xp/200); }
function xpGain(base){
  let g = base;
  if (Date.now() < state.expBuffUntil) g = Math.round(g * 1.2);
  if (state.expNerfCount > 0) g = Math.round(g * 0.8);
  state.xp = Math.max(0, state.xp + g);
  recalcLevel();
}
function applyNerf(){ state.expNerfCount = Math.min(9, (state.expNerfCount||0) + 3); }
function decayNerfOnMissionComplete(){ if (state.expNerfCount > 0) state.expNerfCount--; }

// Notificaciones
async function enableNotif(){
  try{
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return alert('Notificaciones denegadas');
    new Notification('Notificaciones activadas',{body:'Te avisaré de urgentes y vencimientos.'});
  }catch(e){ alert('No se pudo activar notificaciones'); }
}
function notify(t,b){ try{ if (Notification.permission==='granted') new Notification(t,{body:b}); }catch{} }

// Misiones
const TYPE = { DAILY:'daily', FOCUS:'focus', CLASS:'class', URGENT:'urgent' };

const BASIC_POOL = [
  {name:'Flexiones', base:12}, {name:'Sentadillas', base:20}, {name:'Abdominales', base:15},
  {name:'Puente glúteo', base:20}, {name:'Zancadas', base:12}, {name:'Plancha (seg)', base:30}
];
function scaleCount(base,intensity){ return Math.max(5, Math.round(base*intensity)); }

function makeDaily(){
  const intensity = 1 + Math.floor(state.xp/4000)*0.15; // sube muy lento con tu progreso
  const picks = pick(BASIC_POOL, 3);
  const reqs = picks.map(p=>({name:p.name, count:scaleCount(p.base,intensity), progress:0, unit: p.name.includes('(seg)')?'seg':'reps'}));
  const nowd = now();
  const ten = today10am(nowd);
  const due = (nowd < ten) ? new Date(Math.min(nowd.getTime()+14*3600*1000, endOfDay(nowd).getTime())) : endOfDay(nowd);
  return {
    id: uid(), type: TYPE.DAILY, title:'Misión diaria', desc:'Completa el básico de hoy.',
    createdAt: nowd.toISOString(), dueAt: due.toISOString(), accepted:true, status:'pending',
    baseXP: 40, baseCoins: 6,
    requirements: reqs,
    penalty:{ coins:6, nerf:true, nextHarder:true }
  };
}

const FOCUS_POOL = {
  abdomen: ['Crunch', 'Plancha (seg)', 'Dead bug', 'Elevaciones de piernas'],
  brazos: ['Flexiones diamante', 'Fondos en banco', 'Curl isométrico (seg)', 'Flexiones pike'],
  pecho: ['Flexiones', 'Flexiones inclinadas', 'Flexiones declinadas', 'Isométrico pared (seg)'],
  piernas: ['Sentadillas', 'Zancadas', 'Puente glúteo', 'Sentadilla isométrica (seg)']
};
function makeFocus(zone){
  const nowd = now();
  const due = new Date(nowd.getTime() + 8*3600*1000);
  const base = 18;
  const reqs = pick(FOCUS_POOL[zone], 4).map(n=>({name:n, count: base, progress:0, unit: n.includes('(seg)')?'seg':'reps'}));
  return {
    id: uid(), type: TYPE.FOCUS, title:`Focus ${zone}`, desc:`Sesión focalizada en ${zone}.`,
    createdAt: nowd.toISOString(), dueAt: due.toISOString(), accepted:false, status:'pending',
    baseXP: 80, baseCoins: 10,
    requirements: reqs,
    penalty:{ coins:8, nerf:true, nextHarder:true }
  };
}

function makeClass(cls){
  const nowd = now(); const due = new Date(nowd.getTime()+12*3600*1000);
  let reqs;
  if (cls==='Asesino'){
    reqs = [{name:'Burpees', count:20, progress:0, unit:'reps'}, {name:'Saltos laterales', count:60, progress:0, unit:'reps'}];
  } else if (cls==='Guerrero'){
    reqs = [{name:'Puñetazos rectos', count:100, progress:0, unit:'reps'}, {name:'Uppercuts', count:100, progress:0, unit:'reps'}];
  } else if (cls==='Mago'){
    reqs = [{name:'Flexiones', count:25, progress:0, unit:'reps'}, {name:'Sprints 20m', count:10, progress:0, unit:'reps'}];
  } else if (cls==='Invocador'){
    reqs = [{name:'Farmer walk (seg)', count:120, progress:0, unit:'seg'}, {name:'Sentadillas', count:30, progress:0, unit:'reps'}];
  } else {
    reqs = [{name:'Dispara flechas', count:100, progress:0, unit:'reps'}, {name:'Flechas en salto', count:20, progress:0, unit:'reps'}];
  }
  return {
    id: uid(), type: TYPE.CLASS, title:`Misión de clase — ${cls}`, desc:'Demuestra tu especialidad.',
    createdAt: nowd.toISOString(), dueAt: due.toISOString(), accepted:false, status:'pending',
    baseXP: 70, baseCoins: 9, requirements: reqs,
    bonusObj: { id:'rare_gem', name:'Gema rara', desc:'Objeto único (no está en la tienda)' },
    penalty:null
  };
}

const URGENT_THEMES = ['Domador de Dragones','Asesino de reyes','Ciervo de mil ojos avistado','Robo en la torre de mana','Asalto al coloso de hierro'];
function makeUrgent(){
  const nowd = now(); const due = new Date(nowd.getTime()+5*3600*1000);
  const theme = URGENT_THEMES[Math.floor(Math.random()*URGENT_THEMES.length)];
  const reqs = [{name:'Sprint 200m', count:5, progress:0, unit:'reps'}, {name:'Flexiones', count:40, progress:0, unit:'reps'}, {name:'Plancha (seg)', count:60, progress:0, unit:'seg'}];
  return {
    id: uid(), type: TYPE.URGENT, title:`Misión urgente: ${theme}`, desc:'Aviso de alta prioridad.',
    createdAt: nowd.toISOString(), dueAt: due.toISOString(), accepted:true, status:'pending',
    baseXP: 120, baseCoins: 15, requirements: reqs,
    penalty:{ coins:10, nerf:true, nextHarder:true }
  };
}

// Generación diaria/semana
function isoWeekKey(d=new Date()){
  const a = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  a.setUTCDate(a.getUTCDate() + 4 - (a.getUTCDay()||7));
  const yearStart = new Date(Date.UTC(a.getUTCFullYear(),0,1));
  const weekNo = Math.ceil((((a - yearStart) / 86400000) + 1)/7);
  return a.getUTCFullYear() + '-W' + String(weekNo).padStart(2,'0');
}
function maybeGenerateDaily(){
  const today = todayStr();
  const exists = state.missions.some(m=>m.type===TYPE.DAILY && m.status==='pending' && m.createdAt.slice(0,10)===today);
  if (!exists) state.missions.unshift(makeDaily());
}
function maybeGenerateClass(){
  const hasActive = state.missions.some(m=>m.type===TYPE.CLASS && m.status==='pending');
  if (!hasActive) state.missions.unshift(makeClass(state.hero.cls));
}
function maybeGenerateUrgent(){
  const wk = isoWeekKey(); const used = state.weeklyUrgents[wk]||0;
  if (used >= 3) return;
  if (Math.random() < 0.25){
    const m = makeUrgent(); state.missions.unshift(m);
    state.weeklyUrgents[wk] = used+1; notify('Misión urgente', m.title); saveState();
  }
}
function onAppOpen(){
  const tStr = todayStr(); const last = state.lastSeenDay;
  if (last !== tStr){
    state.missions.forEach(m=>{
      if (m.type===TYPE.DAILY && m.status==='pending' && m.createdAt.slice(0,10)!==tStr){
        if (Date.now() > new Date(m.dueAt).getTime()) failMission(m, true);
      }
    });
    state.lastSeenDay = tStr;
  }
  maybeGenerateDaily(); maybeGenerateClass(); maybeGenerateUrgent(); saveState();
}

// Acciones
function acceptMission(m){
  if (m.accepted) return; m.accepted = true;
  if (m.type===TYPE.FOCUS || m.type===TYPE.CLASS){
    const h = (m.type===TYPE.FOCUS) ? 8 : 12;
    m.dueAt = new Date(Date.now() + h*3600*1000).toISOString();
  }
  toast('Misión aceptada'); saveState(); renderAll();
}
function completeMission(m){
  if (m.status!=='pending') return;
  m.status='completed'; xpGain(m.baseXP); state.coins += m.baseCoins; decayNerfOnMissionComplete();
  if (m.type===TYPE.CLASS && Date.now() <= new Date(m.dueAt).getTime() && m.bonusObj){
    state.inventory[m.bonusObj.id] = (state.inventory[m.bonusObj.id]||0) + 1;
    toast('¡Bonus: '+m.bonusObj.name+'!');
  }
  saveState(); renderAll(); toast(`✅ +${m.baseXP} XP, +${m.baseCoins}🪙`);
}
function failMission(m, silent=false){
  if (m.status!=='pending') return;
  m.status='failed';
  if (m.penalty){
    if (m.penalty.coins) state.coins = Math.max(0, state.coins - m.penalty.coins);
    if (m.penalty.nerf) applyNerf();
    if (m.penalty.nextHarder){ const h = makeHarderClone(m); state.missions.unshift(h); }
  }
  saveState(); renderAll(); if (!silent) toast('⛔ Penalización aplicada');
}
function makeHarderClone(m){
  const n = structuredClone(m); n.id=uid(); n.status='pending'; n.accepted=true;
  n.title = (m.title+' — Versión dura'); n.dueAt = new Date(Date.now()+6*3600*1000).toISOString(); n.penalty=null;
  n.requirements.forEach(r=> r.count = Math.ceil(r.count*1.25)); return n;
}
function tickTimers(){
  const nowt = Date.now(); let dirty=false;
  for (const m of state.missions){
    if (m.status==='pending' && m.dueAt && nowt > new Date(m.dueAt).getTime()){
      if (m.type===TYPE.CLASS){ m.status='failed'; dirty=true; }
      else { failMission(m, true); dirty=true; }
    }
  }
  if (dirty){ saveState(); renderAll(); }
}

// Progreso
function adjustReq(m, idx, delta){
  const r = m.requirements[idx]; if (!r) return;
  r.progress = Math.min(r.count, r.progress + delta);
  if (m.requirements.every(x=>x.progress>=x.count)) completeMission(m);
  saveState(); renderAll();
}

// Tienda
const SHOP = {
  consumibles: [
    {id:'time_potion', name:'Poción de tiempo (+2h)', desc:'Amplía el tiempo de una misión activa.', price:30},
    {id:'str_potion', name:'Poción de fuerza (1/2 reps hoy)', desc:'Halvea requisitos en una misión hoy.', price:40},
    {id:'exp_potion', name:'Poción de EXP (+20% 30 min)', desc:'Ganas +20% EXP durante 30 min.', price:50},
    {id:'cure', name:'Curas (quita nerfeo EXP)', desc:'Elimina penalización -20% EXP.', price:20},
  ],
  esteticos: [
    {id:'equip_dagas', name:'Dagas dobles', desc:'Cosmético', price:60},
    {id:'equip_arco_rojo', name:'Arco rojo', desc:'Cosmético', price:80},
    {id:'equip_gafas', name:'Gafas de combate', desc:'Cosmético', price:40},
    {id:'equip_ropa_negra', name:'Ropa negra', desc:'Cosmético', price:70},
  ]
};
function buyItem(item){
  if (state.coins < item.price) return alert('No tienes monedas suficientes.');
  state.coins -= item.price;
  if (item.id.startsWith('equip_')){ if (!state.equipment.includes(item.id)) state.equipment.push(item.id); }
  else { state.inventory[item.id] = (state.inventory[item.id]||0) + 1; }
  saveState(); renderAll();
}
function useOnMission(m, kind){
  if (!state.inventory[kind] || state.inventory[kind]<=0) return alert('No tienes ese objeto.');
  if (kind==='time_potion'){
    if (!m.dueAt) return alert('Esta misión no tiene tiempo.');
    m.dueAt = new Date(new Date(m.dueAt).getTime() + 2*3600*1000).toISOString();
    state.inventory[kind]--; toast('⏱️ +2h añadidas');
  } else if (kind==='str_potion'){
    m.requirements.forEach(r=> r.count = Math.ceil(r.count/2));
    state.inventory[kind]--; toast('💪 Requisitos a la mitad (hoy)');
  }
  saveState(); renderAll();
}
function useGlobal(kind){
  if (!state.inventory[kind] || state.inventory[kind]<=0) return alert('No tienes ese objeto.');
  if (kind==='exp_potion'){ state.expBuffUntil = Date.now() + 30*60*1000; toast('📈 +20% EXP 30 min'); }
  if (kind==='cure'){ state.expNerfCount = 0; toast('✨ Nerfeo eliminado'); }
  state.inventory[kind]--; saveState(); renderAll();
}

// UI refs
const missionsList = document.getElementById('missionsList');
const shopConsumibles = document.getElementById('shopConsumibles');
const shopEsteticos = document.getElementById('shopEsteticos');
const inventoryList = document.getElementById('inventoryList');
const heroName = document.getElementById('heroName');
const heroClass = document.getElementById('heroClass');
const heroGoal = document.getElementById('heroGoal');
const pLvl = document.getElementById('pLvl');
const pXP = document.getElementById('pXP');
const pCoins = document.getElementById('pCoins');
const pNerf = document.getElementById('pNerf');
const newFocusBtn = document.getElementById('newFocusBtn');
const notifBtn = document.getElementById('notifBtn');

document.querySelectorAll('.tabbar button').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('.tabbar button').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
    document.getElementById(`view-${btn.dataset.view}`).classList.add('active');
    renderAll();
  });
});

function missionCard(m){
  const li = document.createElement('li'); li.className='card';
  const dueIn = m.dueAt ? Math.max(0, new Date(m.dueAt).getTime()-Date.now()) : 0;
  const typeLabel = (m.type===TYPE.DAILY?'Diaria': m.type===TYPE.FOCUS?'Focus': m.type===TYPE.CLASS?'Clase':'Urgente');
  li.innerHTML = `
    <h4>${m.title} <span class="badge">${typeLabel}</span></h4>
    <div class="small">${m.desc||''}</div>
    <div class="small">Recompensa: ${m.baseXP} XP, ${m.baseCoins}🪙 ${m.bonusObj? ' · Bonus: '+m.bonusObj.name:''}</div>
    ${m.dueAt? `<div class="topright timer">⏳ ${fmtTimeLeft(dueIn)}</div>`:''}
    <div class="reqs"></div>
    <div class="btnrow">
      ${m.accepted? '' : `<button data-act="accept" data-id="${m.id}">Aceptar</button>`}
      <button data-act="progress" data-id="${m.id}">+ Progreso</button>
      <button data-act="fail" data-id="${m.id}" class="ghost">Fallar</button>
      ${state.inventory.time_potion? `<button data-act="use_time" data-id="${m.id}" class="ghost">Usar ⏱️</button>`:''}
      ${state.inventory.str_potion? `<button data-act="use_str" data-id="${m.id}" class="ghost">Usar 💪</button>`:''}
    </div>
    <div class="small">Estado: ${m.status}${m.tougher?' · (Versión dura)':''}</div>
  `;
  const reqDiv = li.querySelector('.reqs');
  m.requirements.forEach((r,idx)=>{
    const p = document.createElement('div'); p.className='small';
    p.textContent = `${r.name}: ${r.progress}/${r.count} ${r.unit||''}`;
    const bar = document.createElement('progress'); bar.max=r.count; bar.value=r.progress;
    p.appendChild(document.createElement('br')); p.appendChild(bar); reqDiv.appendChild(p);
  });
  return li;
}

function renderHeader(){ document.getElementById('levelInfo').textContent = `Lvl ${state.level} · ${state.xp} XP · ${state.coins}🪙`; }
function renderProfile(){
  heroName.value = state.hero.name; heroClass.value = state.hero.cls; heroGoal.value = state.hero.goal;
  pLvl.textContent = state.level; pXP.textContent = state.xp; pCoins.textContent = state.coins; pNerf.textContent = state.expNerfCount||0;
  const equip = document.getElementById('equipList'); equip.innerHTML=''; (state.equipment||[]).forEach(id=>{ const li=document.createElement('li'); li.textContent=id.replace('equip_',''); equip.appendChild(li); });
}
function renderMissions(){
  missionsList.innerHTML='';
  const pending = state.missions.filter(m=>m.status==='pending');
  const done = state.missions.filter(m=>m.status!=='pending').slice(0,10);
  pending.forEach(m=> missionsList.appendChild(missionCard(m)));
  if (done.length){ const sep=document.createElement('li'); sep.className='card'; sep.innerHTML='<div class="small">Histórico reciente</div>'; missionsList.appendChild(sep); done.forEach(m=> missionsList.appendChild(missionCard(m))); }
}
function renderShop(){
  shopConsumibles.innerHTML=''; SHOP.consumibles.forEach(it=>{ const li=document.createElement('li'); li.className='card'; li.innerHTML=`<h4>${it.name} <span class="badge">🪙 ${it.price}</span></h4><div class="small">${it.desc}</div><div class="btnrow"><button data-buy="${it.id}">Comprar</button></div>`; shopConsumibles.appendChild(li); });
  shopEsteticos.innerHTML=''; SHOP.esteticos.forEach(it=>{ const li=document.createElement('li'); li.className='card'; li.innerHTML=`<h4>${it.name} <span class="badge">🪙 ${it.price}</span></h4><div class="small">${it.desc}</div><div class="btnrow"><button data-buy="${it.id}">Comprar</button></div>`; shopEsteticos.appendChild(li); });
  inventoryList.innerHTML=''; const inv=state.inventory||{}; const keys=Object.keys(inv); if(!keys.length){ const li=document.createElement('li'); li.className='card'; li.innerHTML='<div class="small">Inventario vacío</div>'; inventoryList.appendChild(li);} keys.forEach(k=>{ const li=document.createElement('li'); li.className='card'; const label=k==='time_potion'?'Poción de tiempo':k==='str_potion'?'Poción de fuerza':k==='exp_potion'?'Poción de EXP':k==='cure'?'Curas':k; li.innerHTML=`<h4>${label} × ${inv[k]}</h4>`; const row=document.createElement('div'); row.className='btnrow'; if(k==='exp_potion'){ row.innerHTML=`<button data-use-global="${k}">Activar (+20% 30 min)</button>`; } else if(k==='cure'){ row.innerHTML=`<button data-use-global="${k}">Usar (quitar nerfeo)</button>`; } else { row.innerHTML=`<div class="small">Úsala desde la tarjeta de una misión</div>`; } li.appendChild(row); inventoryList.appendChild(li); });
}
function renderAll(){ renderHeader(); renderMissions(); renderShop(); renderProfile(); }

document.addEventListener('click', (e)=>{
  const id = e.target?.dataset?.id;
  const act = e.target?.dataset?.act;
  const buy = e.target?.dataset?.buy;
  const useG = e.target?.dataset?.useGlobal;
  if (buy){ const all=[...SHOP.consumibles,...SHOP.esteticos]; const it=all.find(x=>x.id===buy); if(it) buyItem(it); }
  if (useG){ useGlobal(useG); }
  if (!id || !act) return;
  const m = state.missions.find(x=>x.id===id); if (!m) return;
  if (act==='accept') acceptMission(m);
  if (act==='progress') adjustReq(m, 0, 1);
  if (act==='fail') failMission(m);
  if (act==='use_time') useOnMission(m, 'time_potion');
  if (act==='use_str') useOnMission(m, 'str_potion');
});

heroName.addEventListener('change', ()=>{ state.hero.name = heroName.value||'Amo'; saveState(); renderHeader(); });
heroClass.addEventListener('change', ()=>{ state.hero.cls = heroClass.value; saveState(); });
heroGoal.addEventListener('change', ()=>{ state.hero.goal = heroGoal.value; saveState(); });
document.getElementById('resetBtn').addEventListener('click', ()=>{ if (confirm('Reiniciar todo el progreso?')){ state = structuredClone(defaultState); saveState(); renderAll(); } });
document.getElementById('notifBtn').addEventListener('click', enableNotif);
document.getElementById('newFocusBtn').addEventListener('click', ()=>{ document.getElementById('focusDialog').showModal(); });
document.getElementById('focusForm').addEventListener('submit', (e)=>{ e.preventDefault(); const zone=new FormData(e.target).get('zona'); const m=makeFocus(zone); state.missions.unshift(m); saveState(); renderAll(); document.getElementById('focusDialog').close(); });

function pick(arr,n){ const a=[...arr]; const out=[]; while(n-->0 && a.length){ out.push(a.splice(Math.floor(Math.random()*a.length),1)[0]); } return out; }
let toastEl; function toast(msg){ if(!toastEl){ toastEl=document.createElement('div'); Object.assign(toastEl.style,{position:'fixed',left:'50%',bottom:'80px',transform:'translateX(-50%)',background:'rgba(15,20,34,.95)',border:'1px solid rgba(110,168,255,.35)',borderRadius:'10px',padding:'10px 14px',zIndex:9999,color:'#e8ecff'}); document.body.appendChild(toastEl);} toastEl.textContent=msg; toastEl.style.opacity='1'; setTimeout(()=>toastEl.style.opacity='0',2200); }

onAppOpen(); renderAll(); setInterval(tickTimers, 1000);
