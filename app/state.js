// app/state.js · v15.2 — XP por clase, con nombres normalizados
import {CLASSES, BASE_CLASSES, EXTRA_CLASSES, xpNeedFor, cxpNeedFor} from './utils.js';

import {normClassName} from './missions/class.js';

const LS='alter_v13s5';
const LS_PROFILES='alter_profiles_v1';

export let state = migrate(load());

// ------------------- almacenamiento -------------------
export function save(){ localStorage.setItem(LS, JSON.stringify(state)); }
export function load(){ try{return JSON.parse(localStorage.getItem(LS));}catch(_){return null;} }

// ------------------- migración/forma de datos -------------------
function emptyClassProgress(){
  const obj={};
  CLASSES.forEach(c=>{
    const canon = normClassName(c);
    obj[canon] = { level: 1, xp: 0 };
  });
  return obj;
}

function migrate(s){
  if(!s) s={};
  // héroe básico
  if(!s.hero) s.hero={name:'Amo', cls:'Asesino', goal:'abdomen'};

  // numéricos base
  if(typeof s.level!=='number') s.level=1;
  if(typeof s.xp!=='number') s.xp=0;
  if(typeof s.coins!=='number') s.coins=0;
  if(typeof s.expBuffUntil!=='number') s.expBuffUntil=0;
  if(typeof s.expNerfCount!=='number') s.expNerfCount=0;

  // listas/objetos
  if(!Array.isArray(s.missions)) s.missions=[];
  if(!s.weeklyUrgents) s.weeklyUrgents={};
  if(!s.inventory) s.inventory={ time_potion:1, str_potion:0, exp_potion:0, cure:0 };
  if(!Array.isArray(s.equipment)) s.equipment=[];
  if(!Array.isArray(s.cosmeticsOwned)) s.cosmeticsOwned=[];
  if(!s.urgentPlan) s.urgentPlan={date:null,decided:false,willHave:false,fireAt:null,spawned:false};
  if(typeof s.daysWithoutUrgent!=='number') s.daysWithoutUrgent=0;
  if(!s.dailyCounters) s.dailyCounters={date:null, focusMade:0, classMade:0};
  if(typeof s.dungeonKeys!=='number') s.dungeonKeys=0;
  if(typeof s.lastLevelChecked!=='number') s.lastLevelChecked=s.level;

  // --- AQUÍ EL CAMBIO IMPORTANTE: progreso por clase, con nombres normalizados ---
  // 1) Si viene el formato viejo (classLevel / classXP), lo volcamos en su clase actual.
  if(typeof s.classLevel==='number' || typeof s.classXP==='number'){
    const canon = normClassName(s.hero?.cls || 'Asesino');
    s.classProgress = s.classProgress || emptyClassProgress();
    s.classProgress[canon] = {
      level: Math.max(1, s.classLevel || 1),
      xp: Math.max(0, s.classXP || 0)
    };
    delete s.classLevel;
    delete s.classXP;
  }
s.classProgress = fixed;// --- Clases desbloqueadas ---
// Si no existe, empezamos desbloqueando SOLO las base.
if (!Array.isArray(s.unlockedClasses)) {
  s.unlockedClasses = BASE_CLASSES.slice(); // copia
} else {
  // normaliza nombres y quita duplicados
  const set = new Set();
  s.unlockedClasses.forEach(name=>{
    // usa la misma normalización de nombres que class.js
    const canon = (name||'').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    // mapeo mínimo para normalizar (igual que en normClassName)
    if (canon.includes('guerrero')) set.add('Guerrero');
    else if (canon.includes('asesin')) set.add('Asesino');
    else if (canon.includes('mago')) set.add('Mago');
    else if (canon.includes('arquero')) set.add('Arquero');
    else if (canon.includes('espia')) set.add('Espía');
    else if (canon.includes('maraton')) set.add('Maratón');
    else if (canon.includes('dragon')) set.add('Amigo del dragón');
    else if (canon.includes('saltam')) set.add('Saltamontes');
    else if (canon.includes('palad')) set.add('Paladín');
    else if (canon.includes('nigrom')) set.add('Nigromante');
    else if (canon.includes('berserk')) set.add('Berserker');
  });
  // asegura que al menos las base están
  BASE_CLASSES.forEach(c=> set.add(c));
  s.unlockedClasses = Array.from(set);
}

  // 2) Si no hay classProgress, lo creamos vacío para todas las clases (independientes).
  if(!s.classProgress) s.classProgress = emptyClassProgress();

  // 3) Si hay claves raras por acentos o mayúsculas, las normalizamos ahora.
  const fixed={};
  Object.keys(s.classProgress).forEach(k=>{
    const canon = normClassName(k);
    const cur = s.classProgress[k] || {level:1,xp:0};
    if(!fixed[canon]) fixed[canon] = {level:1,xp:0};
    // si había duplicados (p.ej. “Espía” y “espia”), nos quedamos con el mejor nivel/xp
    fixed[canon].level = Math.max(fixed[canon].level, cur.level|0 || 1);
    fixed[canon].xp    = Math.max(fixed[canon].xp,    cur.xp|0    || 0);
  });
  // asegura que existen todas
  CLASSES.forEach(c=>{
    const canon = normClassName(c);
    if(!fixed[canon]) fixed[canon]={level:1,xp:0};
  });
  s.classProgress = fixed;

  return s;
}

// ------------------- helpers de clase -------------------
export function activeClassName(){
  return normClassName(state.hero?.cls || 'Asesino');
}

export function classObj(){
  const cls = activeClassName();
  if(!state.classProgress) state.classProgress = {};
  if(!state.classProgress[cls]) state.classProgress[cls] = {level:1, xp:0};
  return state.classProgress[cls];
}
export function isClassUnlocked(name){
  return (state.unlockedClasses||[]).includes(name);
}

// Desbloquea todas las EXTRA_CLASSES si el jugador alcanza nivel 10 en cualquier clase
function unlockExtrasIfEligible(){
  try{
    const anyLvl10 = Object.values(state.classProgress||{}).some(p => (p?.level||1) >= 10);
    if (!anyLvl10) return;
    state.unlockedClasses = state.unlockedClasses || BASE_CLASSES.slice();
    EXTRA_CLASSES.forEach(c=>{
      if (!state.unlockedClasses.includes(c)) state.unlockedClasses.push(c);
    });
  }catch(_){}
}

// ------------------- economía general -------------------
export function gainXP(base){
  let g=base|0;
  if(Date.now()<state.expBuffUntil) g=Math.round(g*1.2);
  if(state.expNerfCount>0) g=Math.round(g*0.8);

  state.xp+=g;
  while(state.xp>=xpNeedFor(state.level)){
    state.xp -= xpNeedFor(state.level);
    state.level++;
  }

  // llaves cada 3 niveles
  const beforeTier=Math.floor((state.lastLevelChecked||1)/3);
  const afterTier =Math.floor(state.level/3);
  const toAward=Math.max(0,afterTier-beforeTier);
  if(toAward>0){
    state.dungeonKeys += toAward;
    state.lastLevelChecked = state.level;
  }
}

// ------------------- economía de clase (por clase) -------------------
export function gainClassXP(base){
  const add = base|0;
  const prog = classObj(); // SIEMPRE usa la clase ACTIVA normalizada
  prog.xp += add;
  while(prog.xp >= cxpNeedFor(prog.level)){
    prog.xp -= cxpNeedFor(prog.level);
    prog.level++;
  }
    // tras subir xp/levels de clase, verifica desbloqueos
  unlockExtrasIfEligible();

}

// ------------------- otros utilitarios -------------------
export const applyNerf =()=>{ state.expNerfCount=Math.min(9,(state.expNerfCount||0)+3); };
export const decayNerf  =()=>{ if(state.expNerfCount>0) state.expNerfCount--; };

// ------------------- perfiles (guardar/cargar/exportar) -------------------
export function getProfiles(){ try{ return JSON.parse(localStorage.getItem(LS_PROFILES))||{}; }catch(_){ return {}; } }
export function setProfiles(p){ localStorage.setItem(LS_PROFILES, JSON.stringify(p)); }
