import {CLASSES,xpNeedFor,cxpNeedFor} from './utils.js';

const LS='alter_v13s5';
const LS_PROFILES='alter_profiles_v1';

export let state = migrate(load());

export function save(){ localStorage.setItem(LS, JSON.stringify(state)); }
export function load(){ try{return JSON.parse(localStorage.getItem(LS));}catch(_){return null;} }

function migrate(s){
  if(!s) s={};
  if(!s.hero) s.hero={name:'Amo', cls:'Asesino', goal:'abdomen'};
  if(typeof s.level!=='number') s.level=1;
  if(typeof s.xp!=='number') s.xp=0;
  if(typeof s.coins!=='number') s.coins=0;
  if(typeof s.expBuffUntil!=='number') s.expBuffUntil=0;
  if(typeof s.expNerfCount!=='number') s.expNerfCount=0;
  if(!Array.isArray(s.missions)) s.missions=[];
  if(!s.weeklyUrgents) s.weeklyUrgents={};
  if(!s.inventory) s.inventory={ time_potion:1, str_potion:0, exp_potion:0, cure:0 };
  if(!Array.isArray(s.equipment)) s.equipment=[];
  if(!Array.isArray(s.cosmeticsOwned)) s.cosmeticsOwned=[];
  if(!s.urgentPlan) s.urgentPlan={date:null,decided:false,willHave:false,fireAt:null,spawned:false};
  if(typeof s.daysWithoutUrgent!=='number') s.daysWithoutUrgent=0;
  if(!s.dailyCounters) s.dailyCounters={date:null, focusMade:0, classMade:0};
  if(!s.classProgress){ s.classProgress={}; CLASSES.forEach(c=> s.classProgress[c]={level:1,xp:0}); }
  if(typeof s.dungeonKeys!=='number') s.dungeonKeys=0;
  if(typeof s.lastLevelChecked!=='number') s.lastLevelChecked=s.level;
  return s;
}

// getters
export function classObj(){ const c=state.hero.cls||'Asesino'; if(!state.classProgress[c]) state.classProgress[c]={level:1,xp:0}; return state.classProgress[c]; }

// economía
export function gainXP(base){
  let g=base|0;
  if(Date.now()<state.expBuffUntil) g=Math.round(g*1.2);
  if(state.expNerfCount>0) g=Math.round(g*0.8);
  const needBefore=xpNeedFor(state.level);
  state.xp+=g;
  while(state.xp>=xpNeedFor(state.level)){ state.xp-=xpNeedFor(state.level); state.level++; }
  // llaves por niveles (cada 3)
  const beforeTier=Math.floor((state.lastLevelChecked||1)/3);
  const afterTier =Math.floor(state.level/3);
  const toAward=Math.max(0,afterTier-beforeTier);
  if(toAward>0){ state.dungeonKeys+=toAward; state.lastLevelChecked=state.level; }
}

export function gainClassXP(base){
  const cp=classObj(); cp.xp+=(base|0); 
  while(cp.xp>=cxpNeedFor(cp.level)){ cp.xp-=cxpNeedFor(cp.level); cp.level++; }
}

export const applyNerf=()=>{ state.expNerfCount=Math.min(9,(state.expNerfCount||0)+3); };
export const decayNerf =()=>{ if(state.expNerfCount>0) state.expNerfCount--; };

// perfiles
export function getProfiles(){ try{ return JSON.parse(localStorage.getItem(LS_PROFILES))||{}; }catch(_){ return {}; } }
export function setProfiles(p){ localStorage.setItem(LS_PROFILES, JSON.stringify(p)); }
