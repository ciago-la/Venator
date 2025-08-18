import {$,$$,el,fmt,TYPE,VER,xpNeedFor,cxpNeedFor,weekKey,BASE_CLASSES,EXTRA_CLASSES} from './utils.js';
import {state,save,getProfiles,setProfiles,classObj, isClassUnlocked} from './state.js';
import {showInfo,showWarn,showSuccess,showPunisher} from './notify.js';
import {SHOP,buy,toggleEquip,icons} from './shop.js';

export function setHeader(){
  const need=xpNeedFor(state.level);
  const li=$('#levelInfo'); if(li) li.textContent='Lvl '+state.level+' · '+state.xp+' / '+need+' XP · '+state.coins+'🪙 · Llaves:'+(state.dungeonKeys||0)+' · '+VER;
  const fill=$('#xpFill'); if(fill){ const pct=Math.max(0,Math.min(1,state.xp/need)); fill.style.width=(pct*100)+'%'; }
  document.title='Venator · '+VER;
}

export function renderShop(){
  const shopConsumibles=$('#shopConsumibles'), shopEsteticos=$('#shopEsteticos'), inventoryList=$('#inventoryList');
  if(!shopConsumibles || !shopEsteticos || !inventoryList) return;
  shopConsumibles.textContent=''; shopEsteticos.textContent=''; inventoryList.textContent='';

  // consumibles
  SHOP.consumibles.forEach(it=>{
    const li=el('li','card'), row=el('div','itemrow');
    const icon = it.id==='time_potion'? icons.consum_time : it.id==='str_potion'?icons.consum_str : it.id==='exp_potion'?icons.consum_exp : icons.consum_cure;
    row.appendChild(Object.assign(document.createElement('img'),{src:icon,alt:'',className:'icon'}));
    const h=el('h4'); h.append(it.name+' '); h.appendChild(el('span','badge','🪙 '+it.price)); row.appendChild(h);
    li.appendChild(row); li.appendChild(el('div','small',it.desc));
    const b=el('button',null,'Comprar'); b.onclick=()=>{buy(it.id); renderShop(); setHeader();};
    const btns=el('div','btnrow'); btns.appendChild(b); li.appendChild(btns); shopConsumibles.appendChild(li);
  });

  // estéticos
  SHOP.esteticos.forEach(it=>{
    const li=el('li','card'), row=el('div','itemrow');
    row.appendChild(Object.assign(document.createElement('img'),{src:it.img,alt:'',className:'icon'}));
    const h=el('h4'); h.append(it.name+' '); h.appendChild(el('span','badge','🪙 '+it.price)); row.appendChild(h);
    li.appendChild(row); li.appendChild(el('div','small',it.desc));
    const btns=el('div','btnrow');
    const owned=state.cosmeticsOwned.includes(it.id);
    if(!owned){ const b=el('button',null,'Comprar'); b.onclick=()=>{buy(it.id); renderShop(); setHeader();}; btns.appendChild(b); }
    else{ const tag=el('span','badge', state.equipment.includes(it.id)?'Equipado':'En inventario'); btns.appendChild(tag); const be=el('button',null,state.equipment.includes(it.id)?'Quitar':'Equipar'); be.onclick=()=>{toggleEquip(it.id); renderShop();}; btns.appendChild(be); }
    li.appendChild(btns); shopEsteticos.appendChild(li);
  });

  // inventario simple (solo ejemplo)
  Object.entries(state.inventory).forEach(([k,v])=>{
    if(!v) return;
    const pretty = k==='time_potion'?'Poción de tiempo':k==='str_potion'?'Poción de fuerza':k==='exp_potion'?'Poción de EXP':k==='cure'?'Curas':k;
    const li=el('li','card'), row=el('div','itemrow');
    row.appendChild(Object.assign(document.createElement('img'),{src: k==='time_potion'? icons.consum_time : k==='str_potion'?icons.consum_str : k==='exp_potion'?icons.consum_exp : icons.consum_cure, alt:'', className:'icon'}));
    row.appendChild(el('h4',null, pretty+' × '+v));
    li.appendChild(row); inventoryList.appendChild(li);
  });

  refreshProfileList();
}

export function missionCard(m, handlers){
  const li=el('li','card'); li.dataset.id=m.id;
  const typeTag=(m.type===TYPE.DAILY?'Diaria': m.type===TYPE.CLASS?'Clase': m.type===TYPE.URGENT?'Urgente': m.type===TYPE.DUNGEON?'Mazmorra':'Focus');
  const h4=el('h4'); h4.append(el('span','',m.title), el('span','small',' ['+typeTag+']')); li.appendChild(h4);
  if (m.desc) li.appendChild(el('div','small',m.desc));
  if (m.dueAt){ const tdiv=el('div','small'); const timer=el('span','timer',fmt(new Date(m.dueAt).getTime()-Date.now())); tdiv.append('⏳ ', timer); li.appendChild(tdiv); }
  li.appendChild(el('div','small','Recompensa: '+(m.baseXP||0)+' XP, '+(m.baseCoins||0)+'🪙'+(m.classXP?' · '+m.classXP+' XP clase':'')));
  (m.requirements||[]).forEach(r=>li.appendChild(el('div','small','• '+String((r&&r.label)||''))));

  const btns=el('div','btnrow');
  const add=(txt,fn)=>{ const b=el('button',null,txt); b.onclick=fn; btns.appendChild(b); };

  if ((m.type===TYPE.CLASS||m.type===TYPE.FOCUS) && !m.accepted){
    add('Aceptar',()=>handlers.accept(m));
    add('Rechazar',()=>handlers.reject(m));
  }
  add('Marcar completada',()=>handlers.done(m));
  add('Fallar',()=>handlers.fail(m));
  li.appendChild(btns);
  return li;
}

export function renderMissions(list, items, handlers){
  list.textContent='';
  const head=el('li','card'); head.appendChild(el('div','small','⚡ Urgentes semana: '+((state.weeklyUrgents[weekKey()]||0))+'/3')); list.appendChild(head);
  items.forEach(m=> list.appendChild(missionCard(m,handlers)));
}

export function renderHeaderAndProfile(){
  setHeader();
  const set=(id,val)=>{ const e=$('#'+id); if(e) e.textContent=val; };
  const cp=classObj();
  set('pLvl',state.level); set('pXP',state.xp); set('pXPNeed',xpNeedFor(state.level));
  set('pCoins',state.coins); set('pNerf',state.expNerfCount||0);
  set('cLvl',cp.level); set('cXP',cp.xp); set('cXPNeed',cxpNeedFor(cp.level));

  const heroName=$('#heroName'), heroClass=$('#heroClass'), heroGoal=$('#heroGoal');
  if (heroName) heroName.value=state.hero.name||'';
 if (heroClass && !heroClass.childElementCount){
  // limpiamos
  heroClass.innerHTML = '';

  // 1) Clases base (siempre visibles)
  BASE_CLASSES.forEach(c=>{
    const o=document.createElement('option');
    o.value=c; o.textContent=c;
    heroClass.appendChild(o);
  });

  // 2) Clases extra: solo si están desbloqueadas
  EXTRA_CLASSES.forEach(c=>{
    const o=document.createElement('option');
    o.value=c; o.textContent = isClassUnlocked(c) ? c : (c + ' (bloqueada)');
    // si NO está desbloqueada, la dejamos deshabilitada
    if (!isClassUnlocked(c)) o.disabled = true;
    heroClass.appendChild(o);
  });

  // valor actual (si estaba en una bloqueada, volverá a una base)
  heroClass.value = isClassUnlocked(state.hero.cls) ? state.hero.cls : 'Asesino';
}

  if (heroGoal) heroGoal.value=state.hero.goal||'';

  if (heroName) heroName.onchange=()=>{ state.hero.name=heroName.value||'Amo'; save(); setHeader(); };
  if (heroClass) heroClass.onchange=()=>{ state.hero.cls=heroClass.value; save(); setHeader(); };
  if (heroGoal)  heroGoal.onchange =()=>{ state.hero.goal=heroGoal.value; save(); };
}

export function refreshProfileList(){
  const span=document.getElementById('profileList'); if(!span) return;
  const ps=getProfiles(); const names=Object.keys(ps);
  span.textContent=names.length?names.join(', '):'(vacío)';
}
