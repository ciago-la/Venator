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
    createdAt: nowd.toISOStri
