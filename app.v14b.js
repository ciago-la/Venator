// === Altervenator · app.v14b.js ===
// Fix principal: "Invalid array length" -> helpers defensivos y normalización de clase.
// Incluye: llaves + mazmorra, diaria única, focus/clase límite 2/día, pity urgentes,
// perfiles, tienda+inventario+equipo con PNGs, overlays, Castigador, notificaciones.

(function(){
  const VER='v14b';
  const LS='alter_v13s5';
  const LS_PROFILES='alter_profiles_v1';
  const TYPE={DAILY:'daily', CLASS:'class', URGENT:'urgent', FOCUS:'focus', DUNGEON:'dungeon'};
  const CLASSES=['Guerrero','Asesino','Mago','Arquero','Espía','Maratón','Amigo del dragón','Saltamontes'];

  // Banner de error + stack
  function showErrorBanner(msg, stack){
    const d=document.createElement('div');
    d.style.cssText='position:fixed;top:0;left:0;right:0;background:#300;color:#fff;padding:6px 10px;z-index:99999;font:12px/1.3 monospace;white-space:pre-wrap';
    d.textContent='JS ERROR: '+(msg||'')+(stack?('\n'+stack):'');
    document.body.appendChild(d);
  }
  window.addEventListener('error', e=> showErrorBanner(e.message, e.error && e.error.stack));
  window.addEventListener('unhandledrejection', e=> showErrorBanner('Promise rejection', (e.reason && e.reason.stack)||String(e.reason)));

  // Utils
  const $  =(s)=>document.querySelector(s);
  const $$ =(s)=>Array.from(document.querySelectorAll(s));
  const el =(t,c,txt)=>{const e=document.createElement(t); if(c) e.className=c; if(txt!=null) e.textContent=txt; return e;};
  const uid=()=>Math.random().toString(36).slice(2)+Date.now().toString(36);
  const todayStr =()=> new Date().toISOString().slice(0,10);
  function endOfDay(){ const x=new Date(); x.setHours(23,59,59,999); return x; }
  function today10(){ const x=new Date(); x.setHours(10,0,0,0); return x; }
  function fmt(ms){ ms=(ms|0); if(ms<0) ms=0; const s=(ms/1000|0); const h=('0'+(s/3600|0)).slice(-2); const m=('0'+((s%3600)/60|0)).slice(-2); const sc=('0'+(s%60)).slice(-2); return h+':'+m+':'+sc; }
  const xpNeedFor =(L)=>Math.round(200*Math.pow(1.1,Math.max(0,(L|0)-1)));
  const cxpNeedFor=(L)=>Math.round(200*Math.pow(1.1,Math.max(0,(L|0)-1)));
  function weekKey(){ const d=new Date(); const a=new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); a.setUTCDate(a.getUTCDate()+4-(a.getUTCDay()||7)); const y=new Date(Date.UTC(a.getUTCFullYear(),0,1)); const w=Math.ceil((((a-y)/86400000)+1)/7); return a.getUTCFullYear()+'-W'+('0'+w).slice(-2); }

  // Rutas imágenes
  const PNG={
    equip_arco_rojo:'assets/equip_arco_rojo.png',
    equip_dagas:'assets/equip_dagas.png',
    equip_gafas:'assets/equip_gafas.png',
    equip_ropa_negra:'assets/equip_ropa_negra.png',
    consum_time:'assets/consum_time.png',
    consum_str:'assets/consum_str.png',
    consum_exp:'assets/consum_exp.png',
    consum_cure:'assets/consum_cure.png',
    castigador:'assets/castigador.png'
  };

  // Estado
  function load(){ try{return JSON.parse(localStorage.getItem(LS));}catch(_){return null;} }
  function save(){ localStorage.setItem(LS, JSON.stringify(state)); }
  function migrateShape(s){
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
    if(typeof s.lastSeenDay!=='string' && s.lastSeenDay!==null) s.lastSeenDay=null;
    if(typeof s.lastDailyDateCreated!=='string' && s.lastDailyDateCreated!==null) s.lastDailyDateCreated=null;
    if(!s.urgentPlan) s.urgentPlan={date:null,decided:false,willHave:false,fireAt:null,spawned:false};
    if(typeof s.daysWithoutUrgent!=='number') s.daysWithoutUrgent=0;
    if(!s.dailyCounters) s.dailyCounters={date:null, focusMade:0, classMade:0};
    if(!s.classProgress){ s.classProgress={}; CLASSES.forEach(c=> s.classProgress[c]={level:1,xp:0}); }
    if(typeof s.classLevel==='number' || typeof s.classXP==='number'){
      const cur=s.hero?.cls||'Asesino';
      s.classProgress[cur]={level:Math.max(1,s.classLevel||1), xp:Math.max(0,s.classXP||0)};
      delete s.classLevel; delete s.classXP;
    }
    if(typeof s.dungeonKeys!=='number') s.dungeonKeys=0;
    if(typeof s.lastLevelChecked!=='number') s.lastLevelChecked=s.level;
    (s.equipment||[]).forEach(id=>{ if(!s.cosmeticsOwned.includes(id)) s.cosmeticsOwned.push(id); });
    return s;
  }
  let state=migrateShape(load());

  // Economía
  function gainXP(base){
    let g=base|0;
    const prevLevel=state.level;
    if(Date.now()<state.expBuffUntil) g=Math.round(g*1.2);
    if(state.expNerfCount>0) g=Math.round(g*0.8);
    state.xp+=(g|0);
    while(state.xp>=xpNeedFor(state.level)){ state.xp-=xpNeedFor(state.level); state.level++; }
    const beforeTier=Math.floor((state.lastLevelChecked||prevLevel)/3);
    const afterTier =Math.floor(state.level/3);
    const toAward   =Math.max(0, afterTier-beforeTier);
    if(toAward>0){ state.dungeonKeys+=toAward; state.lastLevelChecked=state.level; showInfo('Llave obtenida','Has ganado '+toAward+' llave(s) por progreso de nivel.','green'); }
  }
  function classObj(){ const c=state.hero.cls||'Asesino'; if(!state.classProgress[c]) state.classProgress[c]={level:1,xp:0}; return state.classProgress[c]; }
  function gainClassXP(base){ const cp=classObj(); cp.xp+=(base|0); while(cp.xp>=cxpNeedFor(cp.level)){ cp.xp-=cxpNeedFor(cp.level); cp.level++; } }
  function applyNerf(){ state.expNerfCount=Math.min(9,(state.expNerfCount||0)+3); }
  function decayNerf(){ if(state.expNerfCount>0) state.expNerfCount--; }

  // Pools
  const DAILY_ROTATION={
    1:['Flexiones 5 × 2','Sentadillas 10 × 2','Abdominales 20 × 2'],
    2:['Dominadas 5/3','Zancadas 4/4','Puente de glúteo 7'],
    3:['Fondos de tríceps 5','Patada lateral 3 × 2','Plancha 10 s'],
    4:['Flexiones 5 × 2','Sentadillas 10 × 2','Abdominales 20 × 2'],
    5:['Dominadas 5/3','Zancadas 4/4','Puente de glúteo 7'],
    6:['Fondos de tríceps 5','Patada lateral 3 × 2','Plancha 10 s'],
    0:['Elevación de piernas 5 × 2','Saco/sombra (combo)','Sombra intensa 30 s']
  };
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

  // Normalizador de nombre de clase (acentos/espacios/casing)
  function normClassName(cls) {
    if (!cls) return 'Asesino';
    const s = cls.toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    if (s.includes('guerrero')) return 'Guerrero';
    if (s.includes('asesin'))   return 'Asesino';
    if (s.includes('mago'))     return 'Mago';
    if (s.includes('arquero'))  return 'Arquero';
    if (s.includes('espia'))    return 'Espía';
    if (s.includes('maraton'))  return 'Maratón';
    if (s.includes('dragon'))   return 'Amigo del dragón';
    if (s.includes('saltam'))   return 'Saltamontes';
    return 'Asesino';
  }

  // Helpers defensivos
  function scaleTextForLevel(txt,lvl){
    try{
      const f=Math.pow(1.1,Math.max(0,(lvl|0)-1));
      let out=String(txt||'').replace(/(\d+)\s*\/\s*(\d+)/g,(_,a,b)=>Math.max(1,Math.round(a*f))+'/'+Math.max(1,Math.round(b*f)));
      out=out.replace(/(\d+)\s*s\b/g,(m,p)=>Math.max(1,Math.round(p*f))+' s');
      out=out.replace(/(\d+)(?![^\(]*\))/g,(m,p)=>String(Math.max(1,Math.round(p*f))));
      return out;
    }catch(_){ return String(txt||''); }
  }
  function pickN(arr,n){
    if(!Array.isArray(arr)) return [];
    n = (n|0);
    if (n<=0) return [];
    if (n>arr.length) n=arr.length;
    const a=arr.slice(); // copia segura
    for(let i=a.length-1;i>0;i--){
      const j=(Math.random()*(i+1))|0;
      const tmp=a[i]; a[i]=a[j]; a[j]=tmp;
    }
    return a.slice(0,n);
  }

  // Generadores
  function mkDaily(){
    const now=new Date();
    const due=(now<today10())? new Date(Math.min(now.getTime()+14*3600*1000,endOfDay().getTime())): endOfDay();
    const base=DAILY_ROTATION[now.getDay()]||['Flexiones 5 × 2','Sentadillas 10 × 2','Abdominales 20 × 2'];
    const reqs=base.map(s=>({label:scaleTextForLevel(s,state.level)}));
    return {id:uid(),type:TYPE.DAILY,title:'Misión diaria',desc:'Obligatoria de hoy.',createdAt:now.toISOString(),dueAt:due.toISOString(),status:'pending',accepted:true,baseXP:40,baseCoins:6,requirements:reqs,penalty:{coins:6,nerf:true}};
  }
  function focusBaseByLevel(l){ const L=(l|0); return L>=21?30:L>=10?25:L>=5?18:10; }
  function mkFocus(zone){
    const now=new Date();
    const base=focusBaseByLevel(state.level);
    const tpl={
      abdomen:['Crunches','Elevación de piernas','Criss cross','Plancha (s)'],
      brazos:['Fondos tríceps','Curl bíceps (peso)','Flexiones tríceps','Dominadas supinas'],
      piernas:['Sentadillas','Lunges','Puente glúteos','Sentadillas salto'],
      pecho:['Flexiones','Press pecho (peso)','Aperturas','Rebotes flexión/press'],
      espalda:['Dominadas','Remo en plancha','Remo en banco','Cargadas'],
      hombros:['Elevaciones laterales','Flexiones pica','Press militar','Elevaciones frontales']
    }[zone]||['Crunches','Plancha (s)','Flexiones','Sentadillas'];
    const reqs=tpl.slice(0,4).map(n=>({label:n+(/\(s\)/.test(n)?(' '+base+' s'):(' '+base))}));
    return {id:uid(),type:TYPE.FOCUS,title:'Focus — '+(zone||'core'),desc:'Sesión focalizada en '+(zone||'core'),createdAt:now.toISOString(),dueAt:new Date(now.getTime()+8*3600*1000).toISOString(),status:'pending',accepted:false,baseXP:80,baseCoins:10,requirements:reqs,penalty:{coins:8,nerf:true,nextHarder:true,harderFactor:1.5}};
  }

  function mkClassMission(cls){
    const now=new Date();
    const clean=normClassName(cls);
    let pool=CLASS_POOL_STRINGS[clean];
    if(!Array.isArray(pool)) pool=[];
    pool=pool.filter(Boolean);
    if(pool.length<2) pool=pool.concat(['Técnica básica A','Técnica básica B','Técnica básica C']).filter(Boolean);
    const cp=classObj();
    const chosen=pickN(pool,2);
    if(chosen.length<2){ while(chosen.length<2) chosen.push('Ejercicio complementario'); }
    return {
      id:uid(),
      type:TYPE.CLASS,
      title:'Misión de clase — '+clean,
      desc:'Entrenamiento específico de tu clase.',
      createdAt:now.toISOString(),
      dueAt:new Date(now.getTime()+12*3600*1000).toISOString(),
      status:'pending',
      accepted:false,
      baseXP:0,
      baseCoins:9,
      classXP:70,
      requirements:chosen.map(s=>({label:scaleTextForLevel(s,cp.level)})),
      penalty:null
    };
  }
  window.mkClassMission = mkClassMission; // por si el HTML la llama

  function mkUrgent(){
    const T=[
      {name:'Domador de Dragones', reqs:['Sprint 200 m × 5','Flexiones 40','Plancha 60 s','Prueba de clase (aleatoria)'], loot:['aliento_dragón','escamas_dragón','huevo_dragón','amigo_dragón','sangre_dragón']},
      {name:'Asesino de reyes', reqs:['Burpees 30','Sentadillas salto 30','Hollow hold 30 s','Prueba de clase (aleatoria)'], loot:['corona_maldita','cetro_poder','espada_triple','proteccion_princesa','colgante_reina']},
      {name:'Ciervo de mil ojos avistado', reqs:['Sprints 50 m × 10','Zancadas 20/20','Plancha lateral 30 s/lado','Prueba de clase (aleatoria)'], loot:['ojos_azules_3','cuerno_arbol_rojo','armadura_piel_magica','frasco_aliento_bosque','semilla_antigua']},
      {name:'Robo en la torre de maná', reqs:['Jumping jacks 80','Flexiones inclinadas 25','Planchas escaladas 40','Prueba de clase (aleatoria)'], loot:['pocion_mana_potente','libro_conjuros','daga_oscuridad','diente_fuego','llave_celda_oscura']},
      {name:'Asalto al coloso de hierro', reqs:['Sentadilla isométrica 60 s','Flexiones pike 20','Mountain climbers 60','Prueba de clase (aleatoria)'], loot:['armadura_voladora','botas_viento','maza_terremoto','latigo_azul','tunica_albores_alvaros']}
    ];
    const now=new Date(); const t=T[(Math.random()*T.length)|0];
    return {id:uid(),type:TYPE.URGENT,title:'Misión urgente: '+t.name,desc:'Alta prioridad (no se puede rechazar).',createdAt:now.toISOString(),dueAt:new Date(now.getTime()+5*3600*1000).toISOString(),status:'pending',accepted:true,baseXP:120,baseCoins:15,requirements:t.reqs.map(x=>({label:x})),penalty:{coins:10,nerf:true,nextHarder:true,harderFactor:1.25},loot:t.loot};
  }
  function mkDungeon(){ const u=mkUrgent(); u.type=TYPE.DUNGEON; u.title=u.title.replace('Misión urgente:','Asalto a mazmorra:'); u.desc='Asalto forzado con llave (no se puede rechazar).'; return u; }

  // Overlays
  const overlay=$('#overlay'), card=$('#overlayCard'), ovTitle=$('#ovTitle'), ovBody=$('#ovBody'), ovButtons=$('#ovButtons');
  function showOverlay(colorClass, title, body, imgSrc){
    if(!overlay||!card){ alert(title+'\n'+body); return; }
    card.className='overlay-card '+(colorClass||'blue');
    if (ovTitle) ovTitle.textContent=title||'';
    if (ovBody){
      ovBody.textContent='';
      if (imgSrc){ const img=document.createElement('img'); img.src=imgSrc; img.alt=''; img.style.maxWidth='120px'; img.style.display='block'; img.style.margin='0 auto 10px'; ovBody.appendChild(img); }
      const p=document.createElement('div'); p.textContent=body||''; ovBody.appendChild(p);
    }
    if (ovButtons){
      ovButtons.innerHTML='';
      const ok=el('button',null,'Aceptar'); ok.onclick=()=>overlay.classList.add('hidden'); ovButtons.appendChild(ok);
    }
    overlay.classList.remove('hidden');
  }
  function showInfo(title, body, color){ showOverlay(color||'blue', title, body, null); }
  function showSuccess(body){ showOverlay('green',  '✔ Hecho', body, null); }
  function showWarn(body){ showOverlay('yellow', '⚠ Aviso', body, null); }
  function showPunisher(body){ showOverlay('red',   '☠ Versión dura activada', body, PNG.castigador); }

  // Notificaciones
  function notifSupported(){ return 'Notification' in window; }
  function askNotifPermission(){
    if(!notifSupported()) return showInfo('Notificaciones','Tu navegador no soporta notificaciones.','blue');
    if(Notification.permission==='granted') return showInfo('Notificaciones','Ya estaban activadas.','green');
    Notification.requestPermission().then(p=>{
      if(p==='granted') showInfo('Notificaciones','Activadas correctamente.','green');
      else showWarn('Permiso denegado o ignorado.');
    });
  }
  function notifyNow(title,body){ try{ if('Notification' in window && Notification.permission==='granted') new Notification(title,{body}); }catch(_){ } }
  function scheduleDueSoonNotification(m){
    if(!('Notification'in window) || Notification.permission!=='granted' || !m.dueAt) return;
    const due=new Date(m.dueAt).getTime(), trigger=due-30*60*1000, delay=trigger-Date.now();
    if(!(delay>0)) return;
    setTimeout(()=>{ const live=state.missions.find(x=>x.id===m.id); if(live && live.status==='pending') notifyNow('⏳ Quedan 30 min', m.title+' está a punto de vencer.'); }, Math.min(delay,2147000000));
  }
  document.addEventListener('click', e=>{ const t=e.target.closest('button'); if(!t) return; if(t.id==='enableNotifBtn') askNotifPermission(); });

  // Pity + límites + rollover
  function rolloverDailyIfNeeded(){
    const t=todayStr();
    if (!state.dailyCounters || state.dailyCounters.date!==t){
      state.dailyCounters={date:t, focusMade:0, classMade:0};
      state.daysWithoutUrgent=(state.daysWithoutUrgent||0)+1;
    }
    if (state.lastSeenDay!==t){
      state.missions.forEach(m=>{
        if(m.type===TYPE.DAILY && m.status==='pending' && m.createdAt.slice(0,10)!==t){
          if(Date.now()>new Date(m.dueAt).getTime()){
            m.status='failed';
            if(m.penalty){ if(m.penalty.coins) state.coins=Math.max(0,state.coins-m.penalty.coins); if(m.penalty.nerf) applyNerf(); }
          }
        }
      });
      state.lastSeenDay=t;
      state.urgentPlan={date:null,decided:false,willHave:false,fireAt:null,spawned:false};
      save();
    }
  }
  function urgentChanceToday(){
    const d=Math.max(0,state.daysWithoutUrgent||0);
    if(d<7) return 0.10;
    const extra=Math.min(0.05*(d-6),0.20);
    return Math.min(0.10+extra,0.30);
  }
  function planUrgentForTodayIfNeeded(){
    const t=todayStr(); const wk=weekKey(); const used=state.weeklyUrgents[wk]||0;
    if(state.urgentPlan && state.urgentPlan.date===t && state.urgentPlan.decided) return;
    const plan={date:t,decided:true,willHave:false,fireAt:null,spawned:false};
    if(used<3){
      const chance=urgentChanceToday();
      const will=(chance>=0.30)?true:(Math.random()<chance);
      if(will){
        const h=3+((Math.random()*17)|0), m=((Math.random()*60)|0);
        const fire=new Date(); fire.setHours(h,m,0,0);
        plan.willHave=true; plan.fireAt=fire.toISOString();
      }
    }
    state.urgentPlan=plan; save();
  }
  function onUrgentSpawned(){ state.daysWithoutUrgent=0; save(); }
  function triggerScheduledUrgentIfTime(){
    const p=state.urgentPlan; if(!p||!p.decided||!p.willHave||p.spawned||!p.fireAt) return;
    const now=Date.now(), fireAt=new Date(p.fireAt).getTime();
    if(now<fireAt) return;
    const wk=weekKey(); const used=state.weeklyUrgents[wk]||0;
    if(used>=3){ p.spawned=true; save(); return; }
    const u=mkUrgent(); const due=fireAt+5*3600*1000;
    if(now>due){
      u.createdAt=new Date(fireAt).toISOString(); u.dueAt=new Date(due).toISOString(); u.status='failed';
      if(u.penalty){
        if(u.penalty.coins) state.coins=Math.max(0,state.coins-u.penalty.coins);
        if(u.penalty.nerf) applyNerf();
        if(u.penalty.nextHarder){ state.missions.unshift(harderClone(u)); showPunisher('Has fallado fuera de tiempo. El Castigador te impone la Versión dura.'); }
      }
      state.missions.unshift(u);
      state.weeklyUrgents[wk]=(state.weeklyUrgents[wk]||0)+1; p.spawned=true; save(); renderAll(); onUrgentSpawned();
      notifyNow('⚠️ Urgente perdida','La misión urgente de hoy venció antes de entrar.');
      return;
    }
    state.missions.unshift(u);
    state.weeklyUrgents[wk]=(state.weeklyUrgents[wk]||0)+1; p.spawned=true; save(); renderAll(); onUrgentSpawned();
    notifyNow('⚡ ¡Misión urgente!','Tienes 5 horas.');
    scheduleDueSoonNotification(u);
  }

  // Acciones misión
  function harderClone(m){
    const n=JSON.parse(JSON.stringify(m));
    n.id=uid(); n.status='pending'; n.accepted=true;
    n.title=m.title+' — Versión dura'; n.dueAt=new Date(Date.now()+6*3600*1000).toISOString(); n.penalty=null;
    const f=(m.penalty&&m.penalty.harderFactor)?m.penalty.harderFactor:1.25;
    n.requirements=(m.requirements||[]).map(r=>({label:String(r.label||'').replace(/(\d+)/g,x=>String(Math.ceil(parseInt(x,10)*f)))}));
    return n;
  }
  function completeMission(m){
    if(!m || m.status!=='pending') return;
    if((m.type===TYPE.CLASS||m.type===TYPE.FOCUS) && !m.accepted) return showInfo('Acepta primero','Debes aceptar la misión.','blue');
    m.status='completed';
    gainXP(m.baseXP||0); if(m.classXP) gainClassXP(m.classXP);
    state.coins+=(m.baseCoins||0);
    decayNerf();
    if((m.type===TYPE.URGENT||m.type===TYPE.DUNGEON) && Math.random()<0.20 && m.loot && m.loot.length){
      const item=m.loot[(Math.random()*m.loot.length)|0];
      state.inventory[item]=(state.inventory[item]||0)+1;
      showInfo('Objeto raro recibido','Has obtenido: '+item,'blue');
    }
    if (m.type===TYPE.URGENT){ state.dungeonKeys=(state.dungeonKeys||0)+1; showSuccess('¡Has obtenido 1 llave por completar la urgente!'); }
    save(); renderAll();
    const extra=m.classXP?(' · +'+m.classXP+' XP clase'):'';
    const col=m.type===TYPE.CLASS?'purple':((m.type===TYPE.URGENT||m.type===TYPE.DUNGEON)?'red':(m.type===TYPE.FOCUS?'blue':'blue'));
    showInfo('Misión completada','Has ganado +'+(m.baseXP||0)+' XP y +'+(m.baseCoins||0)+'🪙'+extra, col);
  }
  function failMission(m){
    if(!m || m.status!=='pending') return;
    m.status='failed';
    let fired=false;
    if(m.penalty){
      if(m.penalty.coins) state.coins=Math.max(0,state.coins-m.penalty.coins);
      if(m.penalty.nerf) applyNerf();
      if(m.penalty.nextHarder){ state.missions.unshift(harderClone(m)); fired=true; }
    }
    save(); renderAll();
    if (fired) showPunisher('Has fallado '+m.title+'. Se activa la Versión dura durante 6 horas.');
    else showInfo('Misión fallida','Se aplicó la penalización.', (m.type===TYPE.CLASS?'purple':((m.type===TYPE.URGENT||m.type===TYPE.DUNGEON)?'red':'blue')));
  }
  function add2h(m){ if(!m.dueAt) return; m.dueAt=new Date(new Date(m.dueAt).getTime()+2*3600*1000).toISOString(); }
  function halfRequirements(m){ if(!m.requirements) return; m.requirements=m.requirements.map(r=>({label:String(r.label||'').replace(/(\d+)/g,x=>String(Math.max(1,Math.floor(parseInt(x,10)/2))))})); }

  // Tienda / Equipo
  const SHOP={consumibles:[
    {id:'time_potion', name:'Poción de tiempo (+2h)',  desc:'Amplía el tiempo de una misión activa.', price:30},
    {id:'str_potion',  name:'Poción de fuerza (1/2)',   desc:'Reduce a la mitad los números de la misión.', price:40},
    {id:'exp_potion',  name:'Poción de EXP (+20% 30m)',desc:'Ganas +20% EXP durante 30 min.', price:50},
    {id:'cure',        name:'Curas (quita nerf)',      desc:'Elimina el -20% de EXP acumulado.', price:20}
  ], esteticos:[
    {id:'equip_dagas', name:'Dagas dobles',    desc:'Cosmético', price:60, img: PNG.equip_dagas},
    {id:'equip_arco_rojo', name:'Arco rojo',   desc:'Cosmético', price:80, img: PNG.equip_arco_rojo},
    {id:'equip_gafas', name:'Gafas de combate',desc:'Cosmético', price:40, img: PNG.equip_gafas},
    {id:'equip_ropa_negra', name:'Ropa negra', desc:'Cosmético', price:70, img: PNG.equip_ropa_negra}
  ]};
  const ownCosmetic=(id)=>state.cosmeticsOwned.includes(id);
  const isEquipped =(id)=>state.equipment.includes(id);
  const iconImgSmall=(src)=>{ const img=document.createElement('img'); img.className='icon'; img.alt=''; img.src=src; return img; };

  // Render
  function setHeader(){
    const need=xpNeedFor(state.level);
    const li=$('#levelInfo'); if(li) li.textContent='Lvl '+state.level+' · '+state.xp+' / '+need+' XP · '+state.coins+'🪙 · Llaves:'+(state.dungeonKeys||0)+' · '+VER;
    const fill=$('#xpFill'); if(fill){ const pct=Math.max(0,Math.min(1,state.xp/need)); fill.style.width=(pct*100)+'%'; }
    document.title='Venator · '+VER;
  }
  function renderHeader(){
    setHeader();
    const set=(id,val)=>{ const e=$('#'+id); if(e) e.textContent=val; };
    const cp=classObj();
    set('pLvl',state.level); set('pXP',state.xp); set('pXPNeed',xpNeedFor(state.level));
    set('pCoins',state.coins); set('pNerf',state.expNerfCount||0);
    set('cLvl',cp.level); set('cXP',cp.xp); set('cXPNeed',cxpNeedFor(cp.level));
  }

  function renderShop(){
    const shopConsumibles=$('#shopConsumibles'), shopEsteticos=$('#shopEsteticos'), inventoryList=$('#inventoryList');
    if(!shopConsumibles || !shopEsteticos || !inventoryList) return;
    shopConsumibles.textContent=''; shopEsteticos.textContent=''; inventoryList.textContent='';

    SHOP.consumibles.forEach(it=>{
      const li=el('li','card'); const row=el('div','itemrow');
      const icon = it.id==='time_potion' ? PNG.consum_time
                 : it.id==='str_potion'  ? PNG.consum_str
                 : it.id==='exp_potion'  ? PNG.consum_exp
                 : it.id==='cure'        ? PNG.consum_cure
                 : PNG.equip_gafas;
      row.appendChild(iconImgSmall(icon));
      const h=el('h4'); h.append(it.name+' '); h.appendChild(el('span','badge','🪙 '+it.price)); row.appendChild(h);
      li.appendChild(row); li.appendChild(el('div','small',it.desc));
      const btns=el('div','btnrow'); const b=el('button',null,'Comprar'); b.dataset.buy=it.id; btns.appendChild(b); li.appendChild(btns);
      shopConsumibles.appendChild(li);
    });

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

    Object.keys(state.inventory).forEach(k=>{
      const count=state.inventory[k]; if(!count) return;
      const pretty = k==='time_potion'?'Poción de tiempo':k==='str_potion'?'Poción de fuerza':k==='exp_potion'?'Poción de EXP':k==='cure'?'Curas':k;
      const li=el('li','card'); const row=el('div','itemrow');
      const icon = k==='time_potion' ? PNG.consum_time
                 : k==='str_potion'  ? PNG.consum_str
                 : k==='exp_potion'  ? PNG.consum_exp
                 : k==='cure'        ? PNG.consum_cure
                 : PNG.equip_gafas;
      row.appendChild(iconImgSmall(icon));
      row.appendChild(el('h4',null, pretty+' × '+count)); li.appendChild(row);
      const btns=el('div','btnrow');
      if (k==='exp_potion'){ const b=el('button',null,'Usar (+20% 30min)'); b.dataset.useGlobal='exp_potion'; btns.appendChild(b); }
      else if (k==='cure'){ const b=el('button',null,'Usar (quitar nerf)'); b.dataset.useGlobal='cure'; btns.appendChild(b); }
      else btns.appendChild(el('div','small','Úsala desde la tarjeta de misión'));
      li.appendChild(btns); inventoryList.appendChild(li);
    });

    if (state.cosmeticsOwned.length){
      const sep=el('li','card'); sep.appendChild(el('div','small','Equipo disponible')); inventoryList.appendChild(sep);
      state.cosmeticsOwned.forEach(id=>{
        const meta=SHOP.esteticos.find(x=>x.id===id); if(!meta) return;
        const li=el('li','card'); const row=el('div','itemrow'); row.appendChild(iconImgSmall(meta.img));
        row.appendChild(el('h4',null, meta.name)); li.appendChild(row);
        const btns=el('div','btnrow'); const be=el('button',null, isEquipped(id)?'Quitar':'Equipar'); be.dataset.cosm=id; be.dataset.toggle='1'; btns.appendChild(be); li.appendChild(btns);
        inventoryList.appendChild(li);
      });
    }
    refreshProfileList();
  }

  function missionCard(m){
    const li=el('li','card'); li.setAttribute('data-id',m.id);
    const typeTag=(m.type===TYPE.DAILY?'Diaria': m.type===TYPE.CLASS?'Clase': m.type===TYPE.URGENT?'Urgente': m.type===TYPE.DUNGEON?'Mazmorra':'Focus');
    const h4=el('h4'); h4.append(el('span','',m.title), el('span','small',' ['+typeTag+']')); li.appendChild(h4);
    if (m.desc) li.appendChild(el('div','small',m.desc));
    if (m.dueAt){ const tdiv=el('div','small'); const timer=el('span','timer',fmt(new Date(m.dueAt).getTime()-Date.now())); tdiv.append(el('span','', '⏳ '), timer); li.appendChild(tdiv); }
    li.appendChild(el('div','small','Recompensa: '+(m.baseXP||0)+' XP, '+(m.baseCoins||0)+'🪙'+(m.classXP?' · '+m.classXP+' XP clase':'')));
    (m.requirements||[]).forEach(r=> li.appendChild(el('div','small','• '+String((r&&r.label)||''))));
    if (m.status==='pending'){
      const pot=el('div','btnrow'); let any=false;
      if ((state.inventory.time_potion||0)>0 && m.dueAt){ const b=el('button','ghost','+2h'); b.dataset.act='use_time'; b.dataset.id=m.id; pot.appendChild(b); any=true; }
      if ((state.inventory.str_potion||0)>0 && m.requirements && m.requirements.length){ const b=el('button','ghost','½ req'); b.dataset.act='use_str'; b.dataset.id=m.id; pot.appendChild(b); any=true; }
      if (any) li.appendChild(pot);
    }
    const btns=el('div','btnrow');
    if ((m.type===TYPE.CLASS||m.type===TYPE.FOCUS) && !m.accepted){
      const a=el('button',null,'Aceptar'); a.dataset.act='accept'; a.dataset.id=m.id; btns.appendChild(a);
      const r=el('button','ghost','Rechazar'); r.dataset.act='reject'; r.dataset.id=m.id; btns.appendChild(r);
    }
    const done=el('button',null,'Marcar completada'); done.dataset.act='done'; btns.appendChild(done).dataset.id=m.id;
    const fail=el('button','ghost','Fallar'); fail.dataset.act='fail'; btns.appendChild(fail).dataset.id=m.id;
    li.appendChild(btns);
    return li;
  }

  function renderMissions(){
    const list=$('#missionsList'); if(!list) return;
    list.textContent='';
    const head=el('li','card');
    const top=el('div','btnrow');
    const bFocus=el('button',null,'+ Nueva misión Focus'); bFocus.id='newFocusBtnSmall';
    const bClass=el('button',null,'+ Misión de Clase');   bClass.id='newClassBtnSmall';
    const bDungeon=el('button',null,'⚔️ Asalto a mazmorra (Llaves: '+(state.dungeonKeys||0)+')'); bDungeon.id='dungeonBtn';
    top.appendChild(bFocus); top.appendChild(bClass); top.appendChild(bDungeon);
    head.appendChild(top);
    head.appendChild(el('div','small','⚡ Urgentes semana: '+((state.weeklyUrgents[weekKey()]||0))+'/3'));
    list.appendChild(head);
    const pend=(state.missions||[]).filter(x=>x.status==='pending');
    const hist=(state.missions||[]).filter(x=>x.status!=='pending').slice(0,8);
    pend.forEach(m=>list.appendChild(missionCard(m)));
    if (hist.length){ const sep=el('li','card'); sep.appendChild(el('div','small','Histórico reciente')); list.appendChild(sep); hist.forEach(m=>list.appendChild(missionCard(m))); }
  }

  function renderProfile(){
    const heroName=$('#heroName'), heroClass=$('#heroClass'), heroGoal=$('#heroGoal');
    if (heroName) heroName.value=state.hero.name||'';
    if (heroClass){ heroClass.innerHTML=''; CLASSES.forEach(c=>{ const o=document.createElement('option'); o.value=c; o.textContent=c; heroClass.appendChild(o); }); heroClass.value=normClassName(state.hero.cls||'Asesino'); }
    if (heroGoal) heroGoal.value=state.hero.goal||'';
  }
  function renderAll(){ renderHeader(); renderMissions(); renderShop(); renderProfile(); }

  // Tabs
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
    const first=tabbar.querySelector('button[data-view]'); if(first) first.click();
  }

  // Clicks
  document.addEventListener('click', function(e){
    const t=e.target.closest('button'); if(!t) return;

    if (t.id==='newFocusBtnSmall' || t.id==='newFocusBtn'){
      if(!(state.dailyCounters&&state.dailyCounters.focusMade<2)) return showWarn('Solo puedes crear 2 Focus al día.');
      const zone=state.hero.goal||'abdomen'; const f=mkFocus(zone); state.missions.unshift(f); state.dailyCounters.focusMade++; save(); renderAll(); showOverlay('blue','Nueva misión','Tienes una misión: '+f.title+' — ¿Aceptas?',null); return;
    }
    if (t.id==='newClassBtnSmall' || t.id==='newClassBtn'){
      if(!(state.dailyCounters&&state.dailyCounters.classMade<2)) return showWarn('Solo puedes crear 2 misiones de clase al día.');
      const c=normClassName(state.hero.cls||'Asesino'); const m=mkClassMission(c); state.missions.unshift(m); state.dailyCounters.classMade++; save(); renderAll(); showOverlay('purple','Nueva misión de clase','Tienes una misión: '+m.title+' — ¿Aceptas?',null); return;
    }
    if (t.id==='dungeonBtn'){
      const keys=state.dungeonKeys||0;
      if(keys<=0) return showWarn('No tienes llaves suficientes.');
      state.dungeonKeys = keys-1;
      const d=mkDungeon(); state.missions.unshift(d); save(); renderAll();
      showInfo('¡Asalto iniciado!','Has consumido 1 llave. Tienes 5 horas para completar la mazmorra.','red');
      scheduleDueSoonNotification(d);
      return;
    }

    if (t.dataset.buy){
      const id=t.dataset.buy;
      const PRICE={time_potion:30,str_potion:40,exp_potion:50,cure:20,equip_dagas:60,equip_arco_rojo:80,equip_gafas:40,equip_ropa_negra:70};
      const price=PRICE[id]; if(price==null) return;
      if ((state.coins|0)<price) return showWarn('No tienes monedas suficientes.');
      state.coins-=price;
      if (id.startsWith('equip_')){
        if (!state.cosmeticsOwned.includes(id)) state.cosmeticsOwned.push(id);
        showSuccess((id.replace('equip_','').replaceAll('_',' '))+' comprado. Puedes verlo en Inventario.');
      }else{
        state.inventory[id]=(state.inventory[id]||0)+1;
        const pretty = id==='time_potion'?'Poción de tiempo':id==='str_potion'?'Poción de fuerza':id==='exp_potion'?'Poción de EXP':id==='cure'?'Curas':id;
        showSuccess(pretty+' comprada. Puedes verla en Inventario.');
      }
      save(); renderShop(); renderHeader(); return;
    }

    if (t.dataset.toggle==='1' && t.dataset.cosm){
      const id=t.dataset.cosm; if (!state.cosmeticsOwned.includes(id)) return;
      if (state.equipment.includes(id)) { const i=state.equipment.indexOf(id); state.equipment.splice(i,1); showInfo('Equipo','Has quitado '+id.replace('equip_','').replaceAll('_',' ') + '.', 'blue'); }
      else { state.equipment.push(id); showSuccess('Has equipado '+id.replace('equip_','').replaceAll('_',' ')+'.'); }
      save(); renderShop(); return;
    }

    const g=t.dataset.useGlobal;
    if (g==='exp_potion'){ if ((state.inventory.exp_potion||0)>0){ state.expBuffUntil=Date.now()+30*60*1000; state.inventory.exp_potion--; save(); renderAll(); showSuccess('Poción de EXP activa (+20% 30 min).'); } else showWarn('No tienes Poción de EXP'); return;}
    if (g==='cure'){ if ((state.inventory.cure||0)>0){ state.expNerfCount=0; state.inventory.cure--; save(); renderAll(); showSuccess('Curas usadas. Nerf eliminado.'); } else showWarn('No tienes Curas'); return;}

    const idm=t.dataset.id; const act=t.dataset.act;
    if (idm&&act){
      const m=(state.missions||[]).find(x=>x.id===idm); if(!m) return;
      if (act==='accept'){ if(m.type!==TYPE.URGENT && m.type!==TYPE.DUNGEON){ m.accepted=true; save(); renderAll(); showSuccess('Has aceptado: '+m.title); } return; }
      if (act==='reject'){ if(m.type!==TYPE.URGENT && m.type!==TYPE.DUNGEON){ m.status='rejected'; save(); renderAll(); showWarn('Has rechazado: '+m.title); } return; }
      if (act==='done'){ completeMission(m); return; }
      if (act==='fail'){ failMission(m); return; }
      if (act==='use_time'){ if ((state.inventory.time_potion||0)>0){ add2h(m); state.inventory.time_potion--; save(); renderAll(); showSuccess('Poción de tiempo: +2h en '+m.title); } else showWarn('No tienes Poción de tiempo'); return; }
      if (act==='use_str'){ if ((state.inventory.str_potion||0)>0){ halfRequirements(m); state.inventory.str_potion--; save(); renderAll(); showSuccess('Poción de fuerza: requisitos a la mitad en '+m.title); } else showWarn('No tienes Poción de fuerza'); return; }
    }

    if (t.id==='saveProfileBtn'){ const name=($('#profileName')?.value||'').trim(); if(!name) return showWarn('Pon un nombre de perfil'); const snap=JSON.parse(JSON.stringify(state)); const ps=getProfiles(); ps[name]=snap; setProfiles(ps); refreshProfileList(); showSuccess('Perfil guardado: '+name); return; }
    if (t.id==='loadProfileBtn'){ const name=($('#profileName')?.value||'').trim(); if(!name) return showWarn('Pon un nombre de perfil'); const ps=getProfiles(); if(!ps[name]) return showWarn('No existe el perfil: '+name); state=migrateShape(JSON.parse(JSON.stringify(ps[name]))); save(); renderAll(); showSuccess('Perfil cargado: '+name); return; }
    if (t.id==='exportProfileBtn'){ const name=($('#profileName')?.value.trim())||'perfil'; const blob=new Blob([JSON.stringify({name,state},null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name+'.json'; a.click(); return; }
    if (t.id==='importProfileBtn'){ const input=$('#importProfileInput'); if (input) input.click(); return; }
  });

  // Perfiles helpers
  function getProfiles(){ try{ return JSON.parse(localStorage.getItem(LS_PROFILES))||{}; }catch(_){ return {}; } }
  function setProfiles(p){ localStorage.setItem(LS_PROFILES, JSON.stringify(p)); }
  function refreshProfileList(){ const span=document.getElementById('profileList'); if(!span) return; const names=Object.keys(getProfiles()); span.textContent=names.length?names.join(', '):'(vacío)'; }
  const importProfileInput=$('#importProfileInput'); if (importProfileInput) importProfileInput.addEventListener('change', e=>{ const f=e.target.files[0]; if(!f) return; const r=new FileReader(); r.onload=function(){ try{ const data=JSON.parse(r.result); if(data && data.state){ state=migrateShape(data.state); save(); renderAll(); showSuccess('Perfil importado: '+(data.name||'perfil')); } else showWarn('Archivo inválido'); }catch(_){ showWarn('No se pudo leer el archivo'); } }; r.readAsText(f); });

  // Render misiones/listas/perfil
  function renderAll(){ renderHeader(); renderMissions(); renderShop(); renderProfile(); }

  // Auto generación
  function ensureDailyUniqueForToday(){
    const t=todayStr();
    if (state.lastDailyDateCreated===t) return;
    if ((state.missions||[]).some(m=>m.type===TYPE.DAILY && m.status==='pending' && m.createdAt.slice(0,10)===t)){
      state.lastDailyDateCreated=t; save(); return;
    }
    state.missions.unshift(mkDaily());
    state.lastDailyDateCreated=t; save(); renderAll();
  }
  function ensureClassMissionIfNone(){
    const has=(state.missions||[]).some(m=>m.type===TYPE.CLASS && m.status==='pending');
    if(!has){ const c=normClassName(state.hero.cls||'Asesino'); const m=mkClassMission(c); state.missions.unshift(m); save(); }
  }

  // Tick
  function tick(){
    const now=Date.now(); let dirty=false;
    $$('#missionsList .card').forEach(card=>{
      const id=card.getAttribute('data-id'); if(!id) return;
      const m=(state.missions||[]).find(x=>x.id===id);
      const tmr=card.querySelector('.timer');
      if (m&&tmr&&m.dueAt) tmr.textContent=fmt(new Date(m.dueAt).getTime()-now);
      if (m && m.status==='pending' && m.dueAt && now>new Date(m.dueAt).getTime()){
        m.status='failed'; let fired=false;
        if (m.penalty){
          if(m.penalty.coins) state.coins=Math.max(0,state.coins-m.penalty.coins);
          if(m.penalty.nerf) applyNerf();
          if(m.penalty.nextHarder){ state.missions.unshift(harderClone(m)); fired=true; }
        }
        dirty=true;
        if (fired) showPunisher('Has dejado vencer '+m.title+'. Se activa la Versión dura.');
        else showWarn('Misión vencida: '+m.title);
      }
    });
    triggerScheduledUrgentIfTime();
    if (dirty){ save(); renderAll(); }
  }

  // Inicio
  rolloverDailyIfNeeded();
  ensureDailyUniqueForToday();
  ensureClassMissionIfNone();
  planUrgentForTodayIfNeeded();
  triggerScheduledUrgentIfTime();
  renderAll();
  setInterval(tick,1000);

  // Inputs perfil
  const heroName=$('#heroName'), heroClass=$('#heroClass'), heroGoal=$('#heroGoal');
  if (heroName) heroName.addEventListener('change', function(){ state.hero.name=this.value||'Amo'; save(); renderHeader(); });
  if (heroClass) heroClass.addEventListener('change', function(){ state.hero.cls=this.value; save(); renderHeader(); });
  if (heroGoal)  heroGoal.addEventListener('change', function(){ state.hero.goal=this.value; save(); });

})();
