import {$,$$,TYPE,todayStr,fmt} from './utils.js';
import {state,save,gainXP,gainClassXP,applyNerf,decayNerf} from './state.js';
import {showInfo,showWarn,showSuccess,showPunisher} from './notify.js';
import {mkDaily} from './missions/daily.js';
import {mkFocus} from './missions/focus.js';
import {mkClassMission,normClassName} from './missions/class.js';
import {mkUrgent,planUrgentForTodayIfNeeded} from './missions/urgent.js';
import {mkDungeon} from './missions/dungeon.js';
import {renderShop,renderMissions,renderHeaderAndProfile,setHeader} from './ui.js';

// ------------ Ciclos de día / generación única --------------
function rolloverDaily(){
  const t=todayStr();
  if (!state.dailyCounters || state.dailyCounters.date!==t){
    state.dailyCounters={date:t, focusMade:0, classMade:0};
    state.daysWithoutUrgent=(state.daysWithoutUrgent||0)+1;
  }
  if (state.lastSeenDay!==t){
    // cerrar diarias pendientes de ayer
    state.missions.forEach(m=>{
      if(m.type===TYPE.DAILY && m.status==='pending' && m.createdAt.slice(0,10)!==t){
        if(Date.now()>new Date(m.dueAt).getTime()){
          m.status='failed'; if(m.penalty){ if(m.penalty.coins) state.coins=Math.max(0,state.coins-m.penalty.coins); if(m.penalty.nerf) applyNerf(); }
        }
      }
    });
    state.lastSeenDay=t; state.urgentPlan={date:null,decided:false,willHave:false,fireAt:null,spawned:false};
    save();
  }
}
function ensureDaily(){
  const t=todayStr();
  if (state.lastDailyDateCreated===t) return;
  const exists=state.missions.some(m=>m.type===TYPE.DAILY && m.status==='pending' && m.createdAt.slice(0,10)===t);
  if (!exists){ state.missions.unshift(mkDaily()); }
  state.lastDailyDateCreated=t; save();
}
function ensureClassIfNone(){
  const has=state.missions.some(m=>m.type===TYPE.CLASS && m.status==='pending');
  if(!has){ state.missions.unshift(mkClassMission(normClassName(state.hero.cls))); save(); }
}

function triggerScheduledUrgentIfTime(){
  const p=state.urgentPlan; if(!p||!p.decided||!p.willHave||p.spawned||!p.fireAt) return;
  const now=Date.now(), fireAt=new Date(p.fireAt).getTime();
  if(now<fireAt) return;
  const u=mkUrgent(); const due=fireAt+5*3600*1000;
  if(now>due){
    u.createdAt=new Date(fireAt).toISOString(); u.dueAt=new Date(due).toISOString(); u.status='failed';
    if(u.penalty){ if(u.penalty.coins) state.coins=Math.max(0,state.coins-u.penalty.coins); if(u.penalty.nerf) applyNerf(); if(u.penalty.nextHarder){ state.missions.unshift(harder(u)); showPunisher('Has fallado fuera de tiempo. Versión dura activada.'); } }
  }else{
    // activa en tiempo
  }
  state.missions.unshift(u); state.weeklyUrgents = state.weeklyUrgents||{}; const wkKey=(new Date()).getWeekKey?new Date().getWeekKey():''; // opcional
  p.spawned=true; save(); renderAll();
}
function harder(m){
  const n=JSON.parse(JSON.stringify(m));
  n.id=crypto.randomUUID?crypto.randomUUID():String(Math.random());
  n.status='pending'; n.accepted=true;
  n.title=m.title+' — Versión dura'; n.dueAt=new Date(Date.now()+6*3600*1000).toISOString(); n.penalty=null;
  const f=(m.penalty&&m.penalty.harderFactor)?m.penalty.harderFactor:1.25;
  n.requirements=(m.requirements||[]).map(r=>({label:String(r.label||'').replace(/(\d+)/g,x=>String(Math.ceil(parseInt(x,10)*f)))}));
  return n;
}

// ------------------------ Acciones --------------------------
function complete(m){
  if(!m || m.status!=='pending') return;
  if((m.type===TYPE.CLASS||m.type===TYPE.FOCUS) && !m.accepted) return showInfo('Acepta primero','Debes aceptar la misión.');
  m.status='completed';
  gainXP(m.baseXP||0); if(m.classXP) gainClassXP(m.classXP);
  state.coins+=(m.baseCoins||0); decayNerf(); save(); renderAll();
  const extra=m.classXP?(' · +'+m.classXP+' XP clase'):'';
  showInfo('Misión completada','+'+(m.baseXP||0)+' XP y +'+(m.baseCoins||0)+'🪙'+extra);
}
function fail(m){
  if(!m || m.status!=='pending') return;
  m.status='failed';
  let fired=false;
  if(m.penalty){ if(m.penalty.coins) state.coins=Math.max(0,state.coins-m.penalty.coins); if(m.penalty.nerf) applyNerf(); if(m.penalty.nextHarder){ state.missions.unshift(harder(m)); fired=true; } }
  save(); renderAll();
  if (fired) showPunisher('Has fallado '+m.title+'. Se activa la Versión dura 6h.');
  else showWarn('Misión fallida: '+m.title);
}

// ------------------------ Render ----------------------------
function renderAll(){
  renderHeaderAndProfile();

  const list=$('#missionsList');
  const pend=state.missions.filter(x=>x.status==='pending');
  const hist=state.missions.filter(x=>x.status!=='pending').slice(0,8);
  renderMissions(list, pend, {
    accept:(m)=>{ m.accepted=true; save(); renderAll(); showSuccess('Has aceptado: '+m.title); },
    reject:(m)=>{ m.status='rejected'; save(); renderAll(); showWarn('Has rechazado: '+m.title); },
    done:  (m)=>complete(m),
    fail:  (m)=>fail(m)
  });
  if(hist.length){
    const sep=document.createElement('li'); sep.className='card'; sep.appendChild(document.createElement('div')).className='small';
    sep.firstChild.textContent='Histórico reciente'; list.appendChild(sep);
    hist.forEach(m=> list.appendChild( (await import('./ui.js')).missionCard(m,{accept(){},reject(){},done(){},fail(){}} )); // simple
  }

  renderShop();
  setHeader();
}

// ------------------------- UI -------------------------------
document.addEventListener('click', e=>{
  const b=e.target.closest('button'); if(!b) return;
  if (b.id==='newFocusBtnSmall' || b.id==='newFocusBtn'){
    if(!(state.dailyCounters&&state.dailyCounters.focusMade<2)) return showWarn('Solo puedes crear 2 Focus al día.');
    const zone=state.hero.goal||'abdomen'; const f=mkFocus(zone); state.missions.unshift(f); state.dailyCounters.focusMade++; save(); renderAll(); return;
  }
  if (b.id==='newClassBtnSmall' || b.id==='newClassBtn'){
    if(!(state.dailyCounters&&state.dailyCounters.classMade<2)) return showWarn('Solo puedes crear 2 misiones de clase al día.');
    const c=normClassName(state.hero.cls||'Asesino'); const m=mkClassMission(c); state.missions.unshift(m); state.dailyCounters.classMade++; save(); renderAll(); return;
  }
  if (b.id==='dungeonBtn'){
    const keys=state.dungeonKeys||0; if(keys<=0) return showWarn('No tienes llaves suficientes.');
    state.dungeonKeys=keys-1; state.missions.unshift(mkDungeon()); save(); renderAll(); showInfo('¡Asalto iniciado!','Has consumido 1 llave. Tienes 5 horas.'); return;
  }
});

// ------------------------ Tick ------------------------------
function tick(){
  const now=Date.now(); let dirty=false;
  document.querySelectorAll('#missionsList .card').forEach(card=>{
    const id=card.getAttribute('data-id'); if(!id) return;
    const m=state.missions.find(x=>x.id===id);
    const tmr=card.querySelector('.timer'); if(m&&tmr&&m.dueAt) tmr.textContent=fmt(new Date(m.dueAt).getTime()-now);
    if (m && m.status==='pending' && m.dueAt && now>new Date(m.dueAt).getTime()){ fail(m); dirty=false; } // fail() ya guarda y renderiza
  });
  if (dirty) { save(); renderAll(); }
}

// ------------------------ Boot ------------------------------
rolloverDaily();
ensureDaily();
ensureClassIfNone();
planUrgentForTodayIfNeeded(todayStr());
renderAll();
setInterval(tick,1000);

// Tabs
const tabbar=document.querySelector('.tabbar');
if (tabbar){
  tabbar.addEventListener('click', e=>{
    const btn=e.target.closest('button'); if(!btn) return;
    const v=btn.getAttribute('data-view'); if(!v) return;
    document.querySelectorAll('.tabbar button').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.view').forEach(s=>s.classList.remove('active'));
    const sec=document.getElementById('view-'+v); if(sec) sec.classList.add('active');
  });
  const first=tabbar.querySelector('button[data-view]'); if(first) first.click();
}
