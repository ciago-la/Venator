// === Altervenator app.v13s8.step3b.js ===
// Fix: gestor de pestañas restaurado + banner de error.
// Mantiene: compras→inventario→equipar/quitar con PNGs en assets/*,
// misiones (diaria única, focus/clase 2/día), pools aleatorios de clase,
// perfiles, pity timer, notificaciones, XSS básico.

(function(){
  const VER='v13s8-step3b';
  const LS='alter_v13s5';
  const LS_PROFILES='alter_profiles_v1';
  const TYPE={DAILY:'daily', CLASS:'class', URGENT:'urgent', FOCUS:'focus'};
  const CLASSES=['Guerrero','Asesino','Mago','Arquero','Espía','Maratón','Amigo del dragón','Saltamontes'];

  // --- Banner de error visible ---
  window.addEventListener('error', e=>{
    const d=document.createElement('div');
    d.style.cssText='position:fixed;top:0;left:0;right:0;background:#300;color:#fff;padding:6px 10px;z-index:99999;font:12px monospace';
    d.textContent='JS ERROR: '+(e.message||''); document.body.appendChild(d);
  });

  // --- util dom ---
  const $  = (s)=>document.querySelector(s);
  const $$ = (s)=>Array.from(document.querySelectorAll(s));
  const el = (tag,cls,txt)=>{ const e=document.createElement(tag); if(cls) e.className=cls; if(txt!=null) e.textContent=txt; return e; };
  const uid=()=>Math.random().toString(36).slice(2)+Date.now().toString(36);
  const todayStr=()=> new Date().toISOString().slice(0,10);
  function endOfDay(){ const x=new Date(); x.setHours(23,59,59,999); return x; }
  function today10(){ const x=new Date(); x.setHours(10,0,0,0); return x; }
  function fmt(ms){ ms=Math.max(0,ms|0); const s=(ms/1000|0); const h=('0'+(s/3600|0)).slice(-2); const m=('0'+((s%3600)/60|0)).slice(-2); const sc=('0'+(s%60)).slice(-2); return h+':'+m+':'+sc; }
  const xpNeedFor=(L)=>Math.round(200*Math.pow(1.1,L-1));
  const cxpNeedFor=(L)=>Math.round(200*Math.pow(1.1,L-1));
  function weekKey(){ const d=new Date(); const a=new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); a.setUTCDate(a.getUTCDate()+4-(a.getUTCDay()||7)); const y=new Date(Date.UTC(a.getUTCFullYear(),0,1)); const w=Math.ceil((((a-y)/86400000)+1)/7); return a.getUTCFullYear()+'-W'+('0'+w).slice(-2); }

  // --- imágenes reales ---
  const PNG={
    equip_arco_rojo:  'assets/equip_arco_rojo.png',
    equip_dagas:      'assets/equip_dagas.png',
    equip_gafas:      'assets/equip_gafas.png',
    equip_ropa_negra: 'assets/equip_ropa_negra.png'
  };

  // --- estado ---
  function load(){ try{return JSON.parse(localStorage.getItem(LS));}catch(_){return null;} }
  function save(){ localStorage.setItem(LS, JSON.stringify(state)); }
  function migrateShape(s){
    if (!s) s={};
    if (!s.hero) s.hero={name:'Amo', cls:'Asesino', goal:'abdomen'};
    if (typeof s.level!=='number') s.level=1;
    if (typeof s.xp!=='number') s.xp=0;
    if (typeof s.coins!=='number') s.coins=0;
    if (typeof s.expBuffUntil!=='number') s.expBuffUntil=0;
    if (typeof s.expNerfCount!=='number') s.expNerfCount=0;
    if (!Array.isArray(s.missions)) s.missions=[];
    if (!s.weeklyUrgents) s.weeklyUrgents={};
    if (!s.inventory) s.inventory={ time_potion:1, str_potion:0, exp_potion:0, cure:0 };
    if (!Array.isArray(s.equipment)) s.equipment=[];
    if (!Array.isArray(s.cosmeticsOwned)) s.cosmeticsOwned=[];
    if (typeof s.lastSeenDay!=='string' && s.lastSeenDay!==null) s.lastSeenDay=null;
    if (typeof s.lastDailyDateCreated!=='string' && s.lastDailyDateCreated!==null) s.lastDailyDateCreated=null;
    if (!s.urgentPlan) s.urgentPlan={date:null,decided:false,willHave:false,fireAt:null,spawned:false};
    if (typeof s.daysWithoutUrgent!=='number') s.daysWithoutUrgent=0;
    if (!s.dailyCounters) s.dailyCounters={date:null, focusMade:0, classMade:0};
    if (!s.classProgress){ s.classProgress={}; CLASSES.forEach(c=> s.classProgress[c]={level:1,xp:0}); }
    if (typeof s.classLevel==='number' || typeof s.classXP==='number'){
      const cur=s.hero?.cls||'Asesino'; s.classProgress[cur]={level:Math.max(1,s.classLevel||1), xp:Math.max(0,s.classXP||0)}; delete s.classLevel; delete s.classXP;
    }
    (s.equipment||[]).forEach(id=>{ if(!s.cosmeticsOwned.includes(id)) s.cosmeticsOwned.push(id); });
    return s;
  }
  let state=migrateShape(load());

  // --- economía ---
  function gainXP(base){ let g=base; if(Date.now()<state.expBuffUntil) g=Math.round(g*1.2); if(state.expNerfCount>0) g=Math.round(g*0.8); state.xp+=g; while(state.xp>=xpNeedFor(state.level)){ state.xp-=xpNeedFor(state.level); state.level++; } }
  function classObj(){ const c=state.hero.cls||'Asesino'; if(!state.classProgress[c]) state.classProgress[c]={level:1,xp:0}; return state.classProgress[c]; }
  function gainClassXP(base){ const cp=classObj(); cp.xp+=base; while(cp.xp>=cxpNeedFor(cp.level)){ cp.xp-=cxpNeedFor(cp.level); cp.level++; } }
  function applyNerf(){ state.expNerfCount=Math.min(9,(state.expNerfCount||0)+3); }
  function decayNerf(){ if(state.expNerfCount>0) state.expNerfCount--; }

  // --- pools (recortados) ---
  const DAILY_ROTATION={1:['Flexiones 5 × 2','Sentadillas 10 × 2','Abdominales 20 × 2'],2:['Dominadas 5/3','Zancadas 4/4','Puente de glúteo 7'],3:['Fondos de tríceps 5','Patada lateral 3 × 2','Plancha 10 s'],4:['Flexiones 5 × 2','Sentadillas 10 × 2','Abdominales 20 × 2'],5:['Dominadas 5/3','Zancadas 4/4','Puente de glúteo 7'],6:['Fondos de tríceps 5','Patada lateral 3 × 2','Plancha 10 s'],0:['Elevación de piernas 5 × 2','Saco/sombra (combo)','Sombra intensa 30 s']};
  const CLASS_POOL_STRINGS={
    'Asesino':['Saltos pliométricos 10/lado ×2','Saltos reactivos 20','Burpees 8','Cangrejo 33 pasos','Burpees en pino 9','Saltos estrella 33','Spidermans 30','Seguir a alguien 10 min','Escuchar conversación 2 min'],
    'Mago':['Patada reacción rápida 20','Asalto punching ball 1 min ×2','Reflejos con pelotas 10','Usar callado (básico)','3 golpes con callado ×20','Aconseja a alguien'],
    'Arquero':['Side 10/lado + Front 10/lado','Scorpions 5/lado','Rana 20 + mono 20','Cocodrilo 20','100 flechas','20 flechas saltando','Paso del pino','Recorrido dianas','10 sin culatín','10 estilo mongol','+10m distancia'],
    'Espía':['Cadera 3×30s','Piernas 3×30s','Equilibrio 30s c/u','Pistol 5 intentos','Dragon 5 intentos','50 cuchillos','20 cuchillos saltando','4 direcciones ×10','2 cuchillos <1s ×10','3 cuchillos <1s ×10','+5m distancia','Sin giro ×10','Con giro ×10','Golpes con cuchillo','Ligero5/Med7/Pes5'],
    'Maratón':['1 km en 2 min','5 km en 30 min','10 km en 60 min','15 km total','20 km total','4×100 m','Correr 30 min a tope','Técnica china','Técnica nueva'],
    'Amigo del dragón':['Derrota a 1','Recorrido 3 obs','Movimiento volador ×10','Derribo ×10','Patada ×10','Puñetazo ×10','Recorrido 10 obs','Derrota a 5','Arma marcial'],
    'Saltamontes':['Agarre 20s×10','Agarre con peso 30rep/lado','Bloque ×3','Vía ×3','Escala no diseñado','Saltos en escalada','Rápel impro'],
    'Guerrero':['Repite diaria','Repite focus','Golpes arma pesada 3×10','Combo arma pesada 1 min','Duplica diaria','Duplica focus','3 golpes “Guts” ×10','Combo 5 “Guts”','Combo 1 min “Guts”','Inventa golpe','Fabrica arma pesada']
  };
  function scaleTextForLevel(txt,lvl){ const f=Math.pow(1.1,Math.max(0,lvl-1)); let out=txt.replace(/(\d+)\s*\/\s*(\d+)/g,(_,a,b)=>Math.max(1,Math.round(a*f))+'/'+Math.max(1,Math.round(b*f))); out=out.replace(/(\d+)\s*s\b/g,(m,p)=>Math.max(1,Math.round(p*f))+' s'); out=out.replace(/(\d+)(?![^\(]*\))/g,(m,p)=>String(Math.max(1,Math.round(p*f)))); return out; }
  function pickN(arr,n){ const a=[...arr]; for(let i=a.length-1;i>0;i--){ const j=(Math.random()*(i+1)|0); [a[i],a[j]]=[a[j],a[i]]; } return a.slice(0,n); }

  // --- creadores misión ---
  function mkDaily(){ const now=new Date(); const due=(now<today10())? new Date(Math.min(now.getTime()+14*3600*1000,endOfDay().getTime())): endOfDay(); const reqs=DAILY_ROTATION[now.getDay()].map(s=>({label:scaleTextForLevel(s,state.level)})); return {id:uid(),type:TYPE.DAILY,title:'Misión diaria',desc:'Obligatoria de hoy.',createdAt:now.toISOString(),dueAt:due.toISOString(),status:'pending',accepted:true,baseXP:40,baseCoins:6,requirements:reqs,penalty:{coins:6,nerf:true}}; }
  function focusBaseByLevel(l){ return l>=21?30:l>=10?25:l>=5?18:10; }
  function mkFocus(zone){ const now=new Date(); const base=focusBaseByLevel(state.level); const tpl={abdomen:['Crunches','Elevación de piernas','Criss cross','Plancha (s)'],brazos:['Fondos tríceps','Curl bíceps (peso)','Flexiones tríceps','Dominadas supinas'],piernas:['Sentadillas','Lunges','Puente glúteos','Sentadillas salto'],pecho:['Flexiones','Press pecho (peso)','Aperturas','Rebotes flexión/press'],espalda:['Dominadas','Remo en plancha','Remo en banco','Cargadas'],hombros:['Elevaciones laterales','Flexiones pica','Press militar','Elevaciones frontales']}[zone]||['Crunches','Plancha (s)','Flexiones','Sentadillas']; const reqs=tpl.slice(0,4).map(n=>({label:n+(/\(s\)/.test(n)?(' '+base+' s'):(' '+base))})); return {id:uid(),type:TYPE.FOCUS,title:'Focus — '+zone,desc:'Sesión focalizada en '+zone,createdAt:now.toISOString(),dueAt:new Date(now.getTime()+8*3600*1000).toISOString(),status:'pending',accepted:false,baseXP:80,baseCoins:10,requirements:reqs,penalty:{coins:8,nerf:true,nextHarder:true,harderFactor:1.5}}; }
  function mkClassMission(cls){ const now=new Date(); const pool=CLASS_POOL_STRINGS[cls]||['Técnica 1','Técnica 2','Técnica 3','Técnica 4']; const cp=classObj(); const chosen=pickN(pool,2); return {id:uid(),type:TYPE.CLASS,title:'Misión de clase — '+cls,desc:'Entrenamiento específico de tu clase.',createdAt:now.toISOString(),dueAt:new Date(now.getTime()+12*3600*1000).toISOString(),status:'pending',accepted:false,baseXP:0,baseCoins:9,classXP:70,requirements:chosen.map(s=>({label:scaleTextForLevel(s,cp.level)})),penalty:null}; }
  function mkUrgent(){ const T=[{name:'Domador de Dragones', reqs:['Sprint 200 m × 5','Flexiones 40','Plancha 60 s','Prueba de clase (aleatoria)'], loot:['aliento_dragón','escamas_dragón','huevo_dragón','amigo_dragón','sangre_dragón']},{name:'Asesino de reyes', reqs:['Burpees 30','Sentadillas salto 30','Hollow hold 30 s','Prueba de clase (aleatoria)'], loot:['corona_maldita','cetro_poder','espada_triple','proteccion_princesa','colgante_reina']},{name:'Ciervo de mil ojos avistado', reqs:['Sprints 50 m × 10','Zancadas 20/20','Plancha lateral 30 s/lado','Prueba de clase (aleatoria)'], loot:['ojos_azules_3','cuerno_arbol_rojo','armadura_piel_magica','frasco_aliento_bosque','semilla_antigua']},{name:'Robo en la torre de maná', reqs:['Jumping jacks 80','Flexiones inclinadas 25','Planchas escaladas 40','Prueba de clase (aleatoria)'], loot:['pocion_mana_potente','libro_conjuros','daga_oscuridad','diente_fuego','llave_celda_oscura']},{name:'Asalto al coloso de hierro', reqs:['Sentadilla isométrica 60 s','Flexiones pike 20','Mountain climbers 60','Prueba de clase (aleatoria)'], loot:['armadura_voladora','botas_viento','maza_terremoto','latigo_azul','tunica_albores_alvaros']}]; const now=new Date(); const t=T[Math.floor(Math.random()*T.length)]; return {id:uid(),type:TYPE.URGENT,title:'Misión urgente: '+t.name,desc:'Alta prioridad (no se puede rechazar).',createdAt:now.toISOString(),dueAt:new Date(now.getTime()+5*3600*1000).toISOString(),status:'pending',accepted:true,baseXP:120,baseCoins:15,requirements:t.reqs.map(x=>({label:x})),penalty:{coins:10,nerf:true,nextHarder:true,harderFactor:1.25},loot:t.loot}; }

  // --- overlay mínimo ---
  const overlay=$('#overlay'), card=$('#overlayCard'), ovTitle=$('#ovTitle'), ovBody=$('#ovBody'), ovButtons=$('#ovButtons');
  function showInfo(title,body,color){ if(!overlay||!card){ alert(title+'\n'+body); return; } card.className='overlay-card '+(color||'blue'); if(ovTitle) ovTitle.textContent=title; if(ovBody) ovBody.textContent=body; if(ovButtons){ ovButtons.innerHTML=''; const ok=el('button',null,'Aceptar'); ok.onclick=()=>overlay.classList.add('hidden'); ovButtons.appendChild(ok); } overlay.classList.remove('hidden'); }
  function showPromptAcceptReject(m,color){ if(!overlay||!card) return; card.className='overlay-card '+(color||'blue'); if(ovTitle) ovTitle.textContent=(m.type===TYPE.CLASS?'Nueva misión de clase':'Nueva misión'); if(ovBody) ovBody.textContent='Tienes una misión: '+m.title+' — ¿Aceptas?'; if(ovButtons){ ovButtons.innerHTML=''; const ok=el('button',null,'Aceptar'); ok.onclick=()=>{ m.accepted=true; save(); renderAll(); overlay.classList.add('hidden'); }; const ko=el('button','ghost','Rechazar'); ko.onclick=()=>{ m.status='rejected'; save(); renderAll(); overlay.classList.add('hidden'); }; ovButtons.appendChild(ok); ovButtons.appendChild(ko);} overlay.classList.remove('hidden'); }

  // --- notificaciones (igual que antes) ---
  function notifSupported(){ return 'Notification' in window; }
  function askNotifPermission(){ if(!notifSupported()) return showInfo('Notificaciones','Tu navegador no soporta notificaciones.','blue'); if(Notification.permission==='granted') return showInfo('Notificaciones','Ya estaban activadas.','blue'); Notification.requestPermission().then(p=>{ if(p==='granted') showInfo('Notificaciones','Activadas correctamente.','blue'); else showInfo('Notificaciones','Permiso denegado o ignorado.','blue'); }); }
  function notifyNow(title,body){ try{ if('Notification' in window && Notification.permission==='granted') new Notification(title,{body}); }catch(_){ } }
  function scheduleDueSoonNotification(m){ if(!('Notification'in window) || Notification.permission!=='granted' || !m.dueAt) return; const due=new Date(m.dueAt).getTime(), trigger=due-30*60*1000, delay=trigger-Date.now(); if(delay<=0) return; setTimeout(()=>{ const live=state.missions.find(x=>x.id===m.id); if(live && live.status==='pending') notifyNow('⏳ Quedan 30 min', m.title+' está a punto de vencer.'); }, Math.min(delay,2147000000)); }
  document.addEventListener('click', e=>{ const t=e.target.closest('button'); if(!t) return; if(t.id==='enableNotifBtn') askNotifPermission(); });

  // --- pity + límites + rollover ---
  function rolloverDailyIfNeeded(){ const t=todayStr(); if (!state.dailyCounters || state.dailyCounters.date!==t){ state.dailyCounters={date:t, focusMade:0, classMade:0}; state.daysWithoutUrgent=(state.daysWithoutUrgent||0)+1; } if (state.lastSeenDay!==t){ state.missions.forEach(m=>{ if(m.type===TYPE.DAILY && m.status==='pending' && m.createdAt.slice(0,10)!==t){ if(Date.now()>new Date(m.dueAt).getTime()){ m.status='failed'; if(m.penalty){ if(m.penalty.coins) state.coins=Math.max(0,state.coins-m.penalty.coins); if(m.penalty.nerf) applyNerf(); } } }}); state.lastSeenDay=t; state.urgentPlan={date:null,decided:false,willHave:false,fireAt:null,spawned:false}; save(); } }
  function urgentChanceToday(){ const d=Math.max(0,state.daysWithoutUrgent||0); if(d<7) return 0.10; const extra=Math.min(0.05*(d-6),0.20); return Math.min(0.10+extra,0.30); }
  function planUrgentForTodayIfNeeded(){ const t=todayStr(); const wk=weekKey(); const used=state.weeklyUrgents[wk]||0; if(state.urgentPlan && state.urgentPlan.date===t && state.urgentPlan.decided) return; const plan={date:t,decided:true,willHave:false,fireAt:null,spawned:false}; if(used<3){ const chance=urgentChanceToday(); const will=(chance>=0.30)?true:(Math.random()<chance); if(will){ const h=3+Math.floor(Math.random()*17), m=Math.floor(Math.random()*60); const fire=new Date(); fire.setHours(h,m,0,0); plan.willHave=true; plan.fireAt=fire.toISOString(); } } state.urgentPlan=plan; save(); }
  function onUrgentSpawned(){ state.daysWithoutUrgent=0; save(); }
  function triggerScheduledUrgentIfTime(){ const p=state.urgentPlan; if(!p||!p.decided||!p.willHave||p.spawned||!p.fireAt) return; const now=Date.now(), fireAt=new Date(p.fireAt).getTime(); if(now<fireAt) return; const wk=weekKey(); const used=state.weeklyUrgents[wk]||0; if(used>=3){ p.spawned=true; save(); return; } const u=mkUrgent(); const due=fireAt+5*3600*1000; if(now>due){ u.createdAt=new Date(fireAt).toISOString(); u.dueAt=new Date(due).toISOString(); u.status='failed'; if(u.penalty){ if(u.penalty.coins) state.coins=Math.max(0,state.coins-u.penalty.coins); if(u.penalty.nerf) applyNerf(); if(u.penalty.nextHarder) state.missions.unshift(harderClone(u)); } state.missions.unshift(u); state.weeklyUrgents[wk]=(state.weeklyUrgents[wk]||0)+1; p.spawned=true; save(); renderAll(); onUrgentSpawned(); notifyNow('⚠️ Urgente perdida','La misión urgente de hoy venció antes de entrar.'); return; } state.missions.unshift(u); state.weeklyUrgents[wk]=(state.weeklyUrgents[wk]||0)+1; p.spawned=true; save(); renderAll(); onUrgentSpawned(); notifyNow('⚡ ¡Misión urgente!','Tienes 5 horas.'); scheduleDueSoonNotification(u); }

  // --- acciones misión ---
  function harderClone(m){ const n=JSON.parse(JSON.stringify(m)); n.id=uid(); n.status='pending'; n.accepted=true; n.title=m.title+' — Versión dura'; n.dueAt=new Date(Date.now()+6*3600*1000).toISOString(); n.penalty=null; const f=(m.penalty&&m.penalty.harderFactor)?m.penalty.harderFactor:1.25; n.requirements=n.requirements.map(r=>({label:r.label.replace(/(\d+)/g,x=>String(Math.ceil(parseInt(x,10)*f)))})); return n; }
  function completeMission(m){ if(!m || m.status!=='pending') return; if((m.type===TYPE.CLASS||m.type===TYPE.FOCUS) && !m.accepted) return showInfo('Acepta primero','Debes aceptar la misión.','blue'); m.status='completed'; gainXP(m.baseXP||0); if(m.classXP) gainClassXP(m.classXP); state.coins+=(m.baseCoins||0); decayNerf(); if(m.type===TYPE.URGENT && Math.random()<0.20 && m.loot && m.loot.length){ const item=m.loot[Math.floor(Math.random()*m.loot.length)]; state.inventory[item]=(state.inventory[item]||0)+1; showInfo('Objeto raro recibido','Has obtenido: '+item,'blue'); } save(); renderAll(); const extra=m.classXP?(' · +'+m.classXP+' XP clase'):''; const col=m.type===TYPE.CLASS?'purple':(m.type===TYPE.URGENT?'red':(m.type===TYPE.FOCUS?'blue':'blue')); showInfo('Misión completada','Has ganado +'+(m.baseXP||0)+' XP y +'+(m.baseCoins||0)+'🪙'+extra, col); }
  function failMission(m){ if(!m || m.status!=='pending') return; m.status='failed'; if(m.penalty){ if(m.penalty.coins) state.coins=Math.max(0,state.coins-m.penalty.coins); if(m.penalty.nerf) applyNerf(); if(m.penalty.nextHarder) state.missions.unshift(harderClone(m)); } save(); renderAll(); const col=m.type===TYPE.CLASS?'purple':(m.type===TYPE.URGENT?'red':'blue'); showInfo('Misión fallida',(m.type===TYPE.CLASS?'Sin penalización.':'Se aplicó la penalización.'),col); }
  function add2h(m){ if(!m.dueAt) return; m.dueAt=new Date(new Date(m.dueAt).getTime()+2*3600*1000).toISOString(); }
  function halfRequirements(m){ if(!m.requirements) return; m.requirements=m.requirements.map(r=>({label:r.label.replace(/(\d+)/g,x=>String(Math.max(1,Math.floor(parseInt(x,10)/2))))})); }

  // --- SHOP / EQUIPO ---
  const SHOP={consumibles:[
    {id:'time_potion', name:'Poción de tiempo (+2h)', desc:'Amplía el tiempo de una misión activa.', price:30},
    {id:'str_potion',  name:'Poción de fuerza (1/2 requisitos)', desc:'Reduce a la mitad los números de la misión.', price:40},
    {id:'exp_potion',  name:'Poción de EXP (+20% 30 min)', desc:'Ganas +20% EXP durante 30 min.', price:50},
    {id:'cure',        name:'Curas (quita nerfeo EXP)', desc:'Elimina el -20% de EXP acumulado.', price:20}
  ], esteticos:[
    {id:'equip_dagas', name:'Dagas dobles', desc:'Cosmético', price:60, img: PNG.equip_dagas},
    {id:'equip_arco_rojo', name:'Arco rojo', desc:'Cosmético', price:80, img: PNG.equip_arco_rojo},
    {id:'equip_gafas', name:'Gafas de combate', desc:'Cosmético', price:40, img: PNG.equip_gafas},
    {id:'equip_ropa_negra', name:'Ropa negra', desc:'Cosmético', price:70, img: PNG.equip_ropa_negra}
  ]};
  function ownCosmetic(id){ return state.cosmeticsOwned.includes(id); }
  function isEquipped(id){ return state.equipment.includes(id); }
  function equip(id){ if(!ownCosmetic(id)) return; if(!isEquipped(id)) state.equipment.push(id); save(); renderShop(); }
  function unequip(id){ const i=state.equipment.indexOf(id); if(i>=0) state.equipment.splice(i,1); save(); renderShop(); }
  function iconImgSmall(src){ const img=document.createElement('img'); img.className='icon'; img.alt=''; img.src=src; return img; }

  // --- Render main ---
  function setHeader(){ const need=xpNeedFor(state.level); const li=$('#levelInfo'); if(li) li.textContent='Lvl '+state.level+' · '+state.xp+' / '+need+' XP · '+state.coins+'🪙 · '+VER; const fill=$('#xpFill'); if(fill){ const pct=Math.max(0,Math.min(1,state.xp/need)); fill.style.width=(pct*100)+'%'; } document.title='Venator · '+VER; }
  function renderHeader(){ setHeader(); const set=(id,val)=>{ const e=$('#'+id); if(e) e.textContent=val; }; const cp=classObj(); set('pLvl',state.level); set('pXP',state.xp); set('pXPNeed',xpNeedFor(state.level)); set('pCoins',state.coins); set('pNerf',state.expNerfCount||0); set('cLvl',cp.level); set('cXP',cp.xp); set('cXPNeed',cxpNeedFor(cp.level)); }

  function renderShop(){
    const shopConsumibles=$('#shopConsumibles'), shopEsteticos=$('#shopEsteticos'), inventoryList=$('#inventoryList');
    if(!shopConsumibles || !shopEsteticos || !inventoryList) return;
    shopConsumibles.textContent=''; shopEsteticos.textContent=''; inventoryList.textContent='';
    // consumibles
    SHOP.consumibles.forEach(it=>{
      const li=el('li','card'); const row=el('div','itemrow'); row.appendChild(iconImgSmall(PNG.equip_gafas));
      const h=el('h4'); h.append(it.name+' '); h.appendChild(el('span','badge','🪙 '+it.price)); row.appendChild(h);
      li.appendChild(row); li.appendChild(el('div','small',it.desc));
      const btns=el('div','btnrow'); const b=el('button',null,'Comprar'); b.dataset.buy=it.id; btns.appendChild(b); li.appendChild(btns);
      shopConsumibles.appendChild(li);
    });
    // estéticos
    SHOP.esteticos.forEach(it=>{
      const li=el('li','card'); const row=el('div','itemrow'); row.appendChild(iconImgSmall(it.img));
      const h=el('h4'); h.append(it.name+' '); const badge=el('span','badge','🪙 '+it.price); h.appendChild(badge); row.appendChild(h);
      li.appendChild(row); li.appendChild(el('div','small',it.desc));
      const btns=el('div','btnrow');
      const owned=ownCosmetic(it.id);
      if (!owned){ const b=el('button',null,'Comprar'); b.dataset.buy=it.id; btns.appendChild(b); }
      else{ const tag=el('span','badge', isEquipped(it.id)?'Equipado':'En inventario'); btns.appendChild(tag); const be=el('button', null, isEquipped(it.id)?'Quitar':'Equipar'); be.dataset.cosm=it.id; be.dataset.toggle='1'; btns.appendChild(be); }
      li.appendChild(btns); shopEsteticos.appendChild(li);
    });
    // inventario
    Object.keys(state.inventory).forEach(k=>{
      const count=state.inventory[k]; if(!count) return;
      const pretty = k==='time_potion'?'Poción de tiempo':k==='str_potion'?'Poción de fuerza':k==='exp_potion'?'Poción de EXP':k==='cure'?'Curas':k;
      const li=el('li','card'); const row=el('div','itemrow'); row.appendChild(iconImgSmall(PNG.equip_gafas)); row.appendChild(el('h4',null, pretty+' × '+count)); li.appendChild(row);
      const btns=el('div','btnrow');
      if (k==='exp_potion'){ const b=el('button',null,'Usar (+20% 30min)'); b.dataset.useGlobal='exp_potion'; btns.appendChild(b); }
      else if (k==='cure'){ const b=el('button',null,'Usar (quitar nerf)'); b.dataset.useGlobal='cure'; btns.appendChild(b); }
      else btns.appendChild(el('div','small','Úsala desde la tarjeta de misión'));
      li.appendChild(btns); inventoryList.appendChild(li);
    });
    // equipo poseído
    if (state.cosmeticsOwned.length){
      const sep=el('li','card'); sep.appendChild(el('div','small','Equipo disponible')); inventoryList.appendChild(sep);
      state.cosmeticsOwned.forEach(id=>{
        const meta=SHOP.esteticos.find(x=>x.id===id); if(!meta) return;
        const li=el('li','card'); const row=el('div','itemrow'); row.appendChild(iconImgSmall(meta.img)); row.appendChild(el('h4',null, meta.name)); li.appendChild(row);
        const btns=el('div','btnrow'); const be=el('button',null, isEquipped(id)?'Quitar':'Equipar'); be.dataset.cosm=id; be.dataset.toggle='1'; btns.appendChild(be); li.appendChild(btns);
        inventoryList.appendChild(li);
      });
    }
    refreshProfileList();
  }

  function missionCard(m){
    const li=el('li','card'); li.setAttribute('data-id',m.id);
    const h4=el('h4'); h4.append(el('span','',m.title), el('span','small',' ['+(m.type===TYPE.DAILY?'Diaria': m.type===TYPE.CLASS?'Clase': m.type===TYPE.URGENT?'Urgente':'Focus')+']')); li.appendChild(h4);
    if (m.desc) li.appendChild(el('div','small',m.desc));
    if (m.dueAt){ const tdiv=el('div','small'); const timer=el('span','timer',fmt(new Date(m.dueAt).getTime()-Date.now())); tdiv.append(el('span','', '⏳ '), timer); li.appendChild(tdiv); }
    li.appendChild(el('div','small','Recompensa: '+(m.baseXP||0)+' XP, '+(m.baseCoins||0)+'🪙'+(m.classXP?' · '+m.classXP+' XP clase':'')));
    (m.requirements||[]).forEach(r=> li.appendChild(el('div','small','• '+r.label)));
    if (m.status==='pending'){
      const pot=el('div','btnrow'); let any=false;
      if (state.inventory.time_potion>0 && m.dueAt){ const b=el('button','ghost','+2h'); b.dataset.act='use_time'; b.dataset.id=m.id; pot.appendChild(b); any=true; }
      if (state.inventory.str_potion>0 && m.requirements && m.requirements.length){ const b=el('button','ghost','½ req'); b.dataset.act='use_str'; b.dataset.id=m.id; pot.appendChild(b); any=true; }
      if (any) li.appendChild(pot);
    }
    const btns=el('div','btnrow');
    if ((m.type===TYPE.CLASS||m.type===TYPE.FOCUS) && !m.accepted){
      const a=el('button',null,'Aceptar'); a.dataset.act='accept'; a.dataset.id=m.id; btns.appendChild(a);
      const r=el('button','ghost','Rechazar'); r.dataset.act='reject'; r.dataset.id=m.id; btns.appendChild(r);
    }
    const done=el('button',null,'Marcar completada'); done.dataset.act='done'; done.dataset.id=m.id; btns.appendChild(done);
    const fail=el('button','ghost','Fallar'); fail.dataset.act='fail'; fail.dataset.id=m.id; btns.appendChild(fail);
    li.appendChild(btns);
    return li;
  }
  function renderMissions(){
    const list=$('#missionsList'); if(!list) return;
    list.textContent='';
    const head=el('li','card');
    const row=el('div','btnrow');
    const bFocus=document.createElement('button'); bFocus.id='newFocusBtnSmall'; bFocus.textContent='+ Nueva misión Focus';
    const bClass=document.createElement('button'); bClass.id='newClassBtnSmall'; bClass.textContent='+ Misión de Clase';
    row.appendChild(bFocus); row.appendChild(bClass);
    head.appendChild(row);
    head.appendChild(el('div','small','⚡ Urgentes semana: '+((state.weeklyUrgents[weekKey()]||0))+'/3'));
    list.appendChild(head);
    const pend=state.missions.filter(x=>x.status==='pending');
    const hist=state.missions.filter(x=>x.status!=='pending').slice(0,8);
    pend.forEach(m=>list.appendChild(missionCard(m)));
    if (hist.length){ const sep=el('li','card'); sep.appendChild(el('div','small','Histórico reciente')); list.appendChild(sep); hist.forEach(m=>list.appendChild(missionCard(m))); }
  }
  function renderProfile(){
    const heroName=$('#heroName'), heroClass=$('#heroClass'), heroGoal=$('#heroGoal');
    if (heroName) heroName.value=state.hero.name||'';
    if (heroClass){ heroClass.innerHTML=''; CLASSES.forEach(c=>{ const o=document.createElement('option'); o.value=c; o.textContent=c; heroClass.appendChild(o); }); heroClass.value=state.hero.cls||'Asesino'; }
    if (heroGoal) heroGoal.value=state.hero.goal||'';
  }
  function renderAll(){ renderHeader(); renderMissions(); renderShop(); renderProfile(); }

  // --- gestor de pestañas (EL FIX) ---
  const tabbar=document.querySelector('.tabbar');
  if (tabbar){
    tabbar.addEventListener('click', e=>{
      const btn=e.target.closest('button'); if(!btn) return;
      const v=btn.getAttribute('data-view'); if(!v) return;
      $$('.tabbar button').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      $$('.view').forEach(s=>s.classList.remove('active'));
      const sec=document.getElementById('view-'+v); if(sec) sec.classList.add('active');
    });
    // Asegura una pestaña activa al cargar
    const first=tabbar.querySelector('button[data-view]'); if(first) first.click();
  }

  // --- clicks globales ---
  document.addEventListener('click', function(e){
    const t=e.target.closest('button'); if(!t) return;

    if (t.id==='newFocusBtnSmall' || t.id==='newFocusBtn'){
      if(!(state.dailyCounters&&state.dailyCounters.focusMade<2)) return showInfo('Límite diario','Solo 2 Focus al día.','blue');
      const zone=state.hero.goal||'abdomen'; const f=mkFocus(zone); state.missions.unshift(f); state.dailyCounters.focusMade++; save(); renderAll(); showPromptAcceptReject(f,'blue'); return;
    }
    if (t.id==='newClassBtnSmall' || t.id==='newClassBtn'){
      if(!(state.dailyCounters&&state.dailyCounters.classMade<2)) return showInfo('Límite diario','Solo 2 misiones de clase al día.','purple');
      const c=state.hero.cls||'Asesino'; const m=mkClassMission(c); state.missions.unshift(m); state.dailyCounters.classMade++; save(); renderAll(); showPromptAcceptReject(m,'purple'); return;
    }

    if (t.dataset.buy){
      const id=t.dataset.buy;
      const PRICE={time_potion:30,str_potion:40,exp_potion:50,cure:20,equip_dagas:60,equip_arco_rojo:80,equip_gafas:40,equip_ropa_negra:70};
      const price=PRICE[id]; if(price==null) return;
      if (state.coins<price) return alert('No tienes monedas suficientes');
      state.coins-=price;
      if (id.startsWith('equip_')){ if (!state.cosmeticsOwned.includes(id)) state.cosmeticsOwned.push(id); showInfo('Adquirido','Se añadió a tu inventario: '+id.replace('equip_','').replace('_',' '),'blue'); }
      else { state.inventory[id]=(state.inventory[id]||0)+1; }
      save(); renderShop(); renderHeader(); return;
    }

    if (t.dataset.toggle==='1' && t.dataset.cosm){ const id=t.dataset.cosm; if (!state.cosmeticsOwned.includes(id)) return; if (state.equipment.includes(id)) { const i=state.equipment.indexOf(id); state.equipment.splice(i,1); } else { state.equipment.push(id); } save(); renderShop(); return; }

    const g=t.dataset.useGlobal;
    if (g==='exp_potion'){ if ((state.inventory.exp_potion||0)>0){ state.expBuffUntil=Date.now()+30*60*1000; state.inventory.exp_potion--; save(); renderAll(); showInfo('Poción de EXP','+20% EXP durante 30 min.','blue'); } else alert('No tienes Poción de EXP'); return;}
    if (g==='cure'){ if ((state.inventory.cure||0)>0){ state.expNerfCount=0; state.inventory.cure--; save(); renderAll(); showInfo('Curas','Nerf de EXP eliminado.','blue'); } else alert('No tienes Curas'); return;}

    const idm=t.dataset.id; const act=t.dataset.act;
    if (idm&&act){
      const m=state.missions.find(x=>x.id===idm); if(!m) return;
      if (act==='accept'){ if(m.type!=='urgent'){ m.accepted=true; save(); renderAll(); } return; }
      if (act==='reject'){ if(m.type!=='urgent'){ m.status='rejected'; save(); renderAll(); } return; }
      if (act==='done'){ completeMission(m); return; }
      if (act==='fail'){ failMission(m); return; }
      if (act==='use_time'){ if ((state.inventory.time_potion||0)>0){ add2h(m); state.inventory.time_potion--; save(); renderAll(); showInfo('Poción de tiempo','+2h aplicadas a '+m.title,'blue'); } else alert('No tienes Poción de tiempo'); return; }
      if (act==='use_str'){ if ((state.inventory.str_potion||0)>0){ halfRequirements(m); state.inventory.str_potion--; save(); renderAll(); showInfo('Poción de fuerza','Requisitos a la mitad en '+m.title,'blue'); } else alert('No tienes Poción de fuerza'); return; }
    }

    if (t.id==='saveProfileBtn'){ const name=($('#profileName')?.value||'').trim(); if(!name) return alert('Pon un nombre de perfil'); const snap=JSON.parse(JSON.stringify(state)); const ps=getProfiles(); ps[name]=snap; setProfiles(ps); refreshProfileList(); alert('Perfil guardado: '+name); return; }
    if (t.id==='loadProfileBtn'){ const name=($('#profileName')?.value||'').trim(); if(!name) return alert('Pon un nombre de perfil'); const ps=getProfiles(); if(!ps[name]) return alert('No existe el perfil: '+name); state=migrateShape(JSON.parse(JSON.stringify(ps[name]))); save(); renderAll(); alert('Perfil cargado: '+name); return; }
    if (t.id==='exportProfileBtn'){ const name=($('#profileName')?.value.trim())||'perfil'; const blob=new Blob([JSON.stringify({name,state},null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name+'.json'; a.click(); return; }
    if (t.id==='importProfileBtn'){ const input=$('#importProfileInput'); if (input) input.click(); return; }
  });

  // perfiles (helpers)
  function getProfiles(){ try{ return JSON.parse(localStorage.getItem(LS_PROFILES))||{}; }catch(_){ return {}; } }
  function setProfiles(p){ localStorage.setItem(LS_PROFILES, JSON.stringify(p)); }
  function refreshProfileList(){ const span=document.getElementById('profileList'); if(!span) return; const names=Object.keys(getProfiles()); span.textContent=names.length?names.join(', '):'(vacío)'; }
  const importProfileInput=$('#importProfileInput'); if (importProfileInput) importProfileInput.addEventListener('change', e=>{ const f=e.target.files[0]; if(!f) return; const r=new FileReader(); r.onload=function(){ try{ const data=JSON.parse(r.result); if(data && data.state){ state=migrateShape(data.state); save(); renderAll(); alert('Perfil importado: '+(data.name||'perfil')); } else alert('Archivo inválido'); }catch(_){ alert('No se pudo leer el archivo'); } }; r.readAsText(f); });

  // --- auto generación ---
  function ensureDailyUniqueForToday(){ const t=todayStr(); if (state.lastDailyDateCreated===t) return; if (state.missions.some(m=>m.type===TYPE.DAILY && m.status==='pending' && m.createdAt.slice(0,10)===t)){ state.lastDailyDateCreated=t; save(); return; } state.missions.unshift(mkDaily()); state.lastDailyDateCreated=t; save(); renderAll(); }
  function ensureClassMissionIfNone(){ const has=state.missions.some(m=>m.type===TYPE.CLASS && m.status==='pending'); if(!has){ const c=state.hero.cls||'Asesino'; const m=mkClassMission(c); state.missions.unshift(m); save(); } }

  // --- tick ---
  function tick(){ const now=Date.now(); let dirty=false; $$('#missionsList .card').forEach(card=>{ const id=card.getAttribute('data-id'); if(!id) return; const m=state.missions.find(x=>x.id===id); const tmr=card.querySelector('.timer'); if (m&&tmr&&m.dueAt) tmr.textContent=fmt(new Date(m.dueAt).getTime()-now); if (m && m.status==='pending' && m.dueAt && now>new Date(m.dueAt).getTime()){ m.status='failed'; if (m.penalty){ if (m.penalty.coins) state.coins=Math.max(0,state.coins-m.penalty.coins); if (m.penalty.nerf) applyNerf(); if (m.penalty.nextHarder) state.missions.unshift(harderClone(m)); } dirty=true; } }); triggerScheduledUrgentIfTime(); if (dirty){ save(); renderAll(); } }

  // --- inicio ---
  rolloverDailyIfNeeded();
  ensureDailyUniqueForToday();
  ensureClassMissionIfNone();
  planUrgentForTodayIfNeeded();
  triggerScheduledUrgentIfTime();
  renderAll();
  setInterval(tick,1000);

  // inputs perfil
  const heroName=$('#heroName'), heroClass=$('#heroClass'), heroGoal=$('#heroGoal');
  if (heroName) heroName.addEventListener('change', function(){ state.hero.name=this.value||'Amo'; save(); renderHeader(); });
  if (heroClass) heroClass.addEventListener('change', function(){ state.hero.cls=this.value; save(); renderHeader(); });
  if (heroGoal)  heroGoal.addEventListener('change', function(){ state.hero.goal=this.value; save(); });

})();
