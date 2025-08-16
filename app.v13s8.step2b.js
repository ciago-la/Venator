// === Altervenator app.v13s8.step2b.js ===
// - Misiones de clase: 2 pruebas aleatorias de un pool amplio por clase.
// - Progresión de CLASE por-clase: cada clase tiene su propio {level,xp}.
// Mantiene: diarias 1/día, Focus 2/día, botón +Clase 2/día, XSS seguro, tienda, perfiles,
//           urgentes con pity timer + notificaciones (versión step2).

(function(){
  const VER='v13s8-step2b';
  const LS='alter_v13s5';
  const LS_PROFILES='alter_profiles_v1';
  const TYPE={DAILY:'daily', CLASS:'class', URGENT:'urgent', FOCUS:'focus'};
  const CLASSES=['Guerrero','Asesino','Mago','Arquero','Espía','Maratón','Amigo del dragón','Saltamontes'];

  // ----- Error banner -----
  window.addEventListener('error', e=>{
    const d=document.createElement('div');
    d.style.cssText='position:fixed;top:0;left:0;right:0;background:#300;color:#fff;padding:6px 10px;z-index:99999;font:12px monospace';
    d.textContent='JS ERROR: '+(e.message||e.filename||''); document.body.appendChild(d);
  });

  // ----- Helpers -----
  const $  =(s)=>document.querySelector(s);
  const $$ =(s)=>Array.from(document.querySelectorAll(s));
  const el =(tag, cls, text)=>{ const e=document.createElement(tag); if(cls) e.className=cls; if(text!=null) e.textContent=text; return e; };
  const uid=()=>Math.random().toString(36).slice(2)+Date.now().toString(36);
  const todayStr=()=> new Date().toISOString().slice(0,10);
  function endOfDay(){ const x=new Date(); x.setHours(23,59,59,999); return x; }
  function today10(){ const x=new Date(); x.setHours(10,0,0,0); return x; }
  function fmt(ms){ ms=Math.max(0,ms|0); const s=(ms/1000)|0; const h=('0'+(s/3600|0)).slice(-2); const m=('0'+((s%3600)/60|0)).slice(-2); const sc=('0'+(s%60)).slice(-2); return h+':'+m+':'+sc; }
  const xpNeedFor=(L)=>Math.round(200*Math.pow(1.1, L-1));
  const cxpNeedFor=(L)=>Math.round(200*Math.pow(1.1, L-1));
  function weekKey(){
    const d=new Date();
    const a=new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    a.setUTCDate(a.getUTCDate()+4-(a.getUTCDay()||7));
    const y=new Date(Date.UTC(a.getUTCFullYear(),0,1));
    const w=Math.ceil((((a-y)/86400000)+1)/7);
    return a.getUTCFullYear()+'-W'+('0'+w).slice(-2);
  }

  // ----- Estado -----
  function load(){ try{return JSON.parse(localStorage.getItem(LS));}catch(_){return null;} }
  function save(){ localStorage.setItem(LS, JSON.stringify(state)); }
  function defaultUrgentPlan(){ return {date:null, decided:false, willHave:false, fireAt:null, spawned:false}; }

  function blankClassProgress(){
    const o={};
    CLASSES.forEach(c=> o[c]={level:1, xp:0});
    return o;
  }

  function migrateShape(s){
    if (!s) s={};
    if (!s.hero) s.hero={name:'Amo', cls:'Asesino', goal:'abdomen'};

    // GLOBAL (se mantienen)
    if (typeof s.level!=='number') s.level=1;
    if (typeof s.xp!=='number') s.xp=0;
    if (typeof s.coins!=='number') s.coins=0;
    if (typeof s.expBuffUntil!=='number') s.expBuffUntil=0;
    if (typeof s.expNerfCount!=='number') s.expNerfCount=0;
    if (!Array.isArray(s.missions)) s.missions=[];
    if (!s.weeklyUrgents || typeof s.weeklyUrgents!=='object') s.weeklyUrgents={};
    if (!s.inventory) s.inventory={ time_potion:1, str_potion:0, exp_potion:0, cure:0 };
    if (!Array.isArray(s.equipment)) s.equipment=[];
    if (typeof s.lastSeenDay!=='string' && s.lastSeenDay!==null) s.lastSeenDay=null;
    if (typeof s.lastDailyDateCreated!=='string' && s.lastDailyDateCreated!==null) s.lastDailyDateCreated=null;

    // Pity timer + plan
    if (!s.urgentPlan || typeof s.urgentPlan!=='object') s.urgentPlan=defaultUrgentPlan();
    s.urgentPlan=Object.assign(defaultUrgentPlan(), s.urgentPlan);
    if (typeof s.daysWithoutUrgent!=='number') s.daysWithoutUrgent=0;

    // Contadores diarios
    if (!s.dailyCounters || typeof s.dailyCounters!=='object'){
      s.dailyCounters={date:null, focusMade:0, classMade:0};
    }

    // NUEVO: progreso por clase (sustituye a classLevel/classXP globales)
    if (!s.classProgress || typeof s.classProgress!=='object') s.classProgress = blankClassProgress();

    // Migración desde classLevel/classXP antiguos (si existían)
    if (typeof s.classLevel==='number' || typeof s.classXP==='number'){
      const cur = s.hero?.cls || 'Asesino';
      const L = Math.max(1, s.classLevel||1);
      const X = Math.max(0, s.classXP||0);
      if (!s.classProgress[cur]) s.classProgress[cur]={level:1,xp:0};
      s.classProgress[cur].level=L;
      s.classProgress[cur].xp=X;
      delete s.classLevel; delete s.classXP;
    }

    if (typeof s.schemaVersion!=='number' || s.schemaVersion<3) s.schemaVersion=3;
    return s;
  }
  let state = migrateShape(load());

  // ----- Economía/XP -----
  function gainXP(base){
    let g=base;
    if (Date.now()<state.expBuffUntil) g=Math.round(g*1.2);
    if (state.expNerfCount>0) g=Math.round(g*0.8);
    state.xp += g;
    while(state.xp >= xpNeedFor(state.level)){ state.xp -= xpNeedFor(state.level); state.level++; }
  }
  function classBonusItem(cls){
    const map={
      'Asesino':'botas_sombra','Guerrero':'guanteletes_coloso','Mago':'anillo_mana',
      'Amigo del dragón':'simbolo_espiritu','Arquero':'talisman_ojo_agudo','Saltamontes':'magnesio_lava',
      'Maratón':'estela_alba','Espía':'pendiente_fantasma'
    };
    return map[cls]||'gema_rara';
  }
  function currentClassObj(){
    const c=state.hero.cls||'Asesino';
    if (!state.classProgress[c]) state.classProgress[c]={level:1,xp:0};
    return state.classProgress[c];
  }
  function gainClassXP(base){
    const cName=state.hero.cls||'Asesino';
    const cp = currentClassObj(); // {level,xp}
    cp.xp += base;
    while (cp.xp >= cxpNeedFor(cp.level)){
      cp.xp -= cxpNeedFor(cp.level);
      cp.level++;
      // premio cada 10 niveles de esa clase
      if (cp.level % 10 === 0){
        const award = classBonusItem(cName);
        if (award) state.inventory[award]=(state.inventory[award]||0)+1;
      }
    }
  }
  function applyNerf(){ state.expNerfCount = Math.min(9,(state.expNerfCount||0)+3); }
  function decayNerf(){ if (state.expNerfCount>0) state.expNerfCount--; }

  // ----- Datos base -----

  // Diaria (como antes)
  const DAILY_ROTATION={
    1:['Flexiones 5 × 2','Sentadillas 10 × 2','Abdominales 20 × 2'],
    2:['Dominadas 5/3','Zancadas 4/4','Puente de glúteo 7'],
    3:['Fondos de tríceps 5','Patada lateral 3 × 2','Plancha 10 s'],
    4:['Flexiones 5 × 2','Sentadillas 10 × 2','Abdominales 20 × 2'],
    5:['Dominadas 5/3','Zancadas 4/4','Puente de glúteo 7'],
    6:['Fondos de tríceps 5','Patada lateral 3 × 2','Plancha 10 s'],
    0:['Elevación de piernas 5 × 2','Saco/sombra (combo)','Sombra intensa 30 s']
  };

  // === POOLS DE CLASE (amplios, en forma de ARRAY DE STRINGS) ===
  // Sacado de tu documento (resumido/adaptado a texto corto). Cada misión elige 2 aleatorias.
  const CLASS_POOL_STRINGS={
    'Asesino': [
      'Saltos pliométricos 10/lado ×2',
      'Saltos reactivos 20',
      'Burpees 8',
      'Cangrejo 33 pasos',
      'Burpees en pino 9',
      'Saltos estrella 33',
      'Spidermans 30',
      'Seguir a alguien 10 min (sigilo)',
      'Escuchar conversación 2 min (sin ser visto)'
    ],
    'Mago': [
      'Patada reacción rápida 20',
      'Asalto punching ball 1 min ×2',
      'Reflejos con pelotas 10',
      'Aprende a usar callado (básico)',
      '3 golpes con callado ×20',
      'Hazte amigo de alguien (pide permiso para aconsejar)'
    ],
    'Arquero': [
      'Side kicks 10/lado + Front 10/lado',
      'Scorpions 5/lado',
      'Pasos de rana 20 + mono 20',
      'Pasos de cocodrilo 20',
      'Dispara 100 flechas',
      'Dispara 20 flechas saltando',
      'Siguiente paso del pino (progreso)',
      'Recorrido de dianas (dominar)',
      '10 flechas sin culatín',
      'Estilo mongol 10 flechas',
      'Tira 10 m más lejos'
    ],
    'Espía': [
      'Estiramientos cadera 3×30s',
      'Flexibilidad piernas 3×30s',
      'Equilibrio 1 pierna 30s c/u',
      'Pistol squat 5 intentos c/pierna',
      'Dragon squat 5 intentos c/pierna',
      'Lanza 50 cuchillos',
      'Lanza 20 cuchillos saltando',
      'Lanza desde 4 direcciones ×10',
      '2 cuchillos en <1s ×10',
      '3 cuchillos en <1s ×10',
      'Lanza +5 m de tu habitual',
      'Lanzamiento sin giro ×10',
      'Lanzamiento con 1 giro ×10',
      'Golpes cuerpo a cuerpo con cuchillo',
      'Secuencia: ligero×5, medio×7, pesado×5'
    ],
    'Maratón': [
      'Corre 1 km en 2 min',
      'Corre 5 km en 30 min',
      'Corre 10 km en 60 min',
      'Corre 15 km (total)',
      'Corre 20 km (total)',
      '4 sprints de 100 m',
      'Correr 30 min “a tope”',
      'Técnica eficiente china (aprende)',
      'Aprende técnica nueva de carrera'
    ],
    'Amigo del dragón': [
      'Derrota a 1 contrincante',
      'Recorrido 3 obstáculos (dominar)',
      'Movimiento volador ×10',
      'Derribo ×10',
      'Patada ×10',
      'Puñetazo ×10',
      'Recorrido 10 obstáculos',
      'Derrota a 5 contrincantes',
      'Aprende arma marcial'
    ],
    'Saltamontes': [
      'Agarre: aguanta 20s y suelta ×10',
      'Agarre con peso 30 rep c/lado (30kg)',
      'Haz un bloque ×3',
      'Haz una vía ×3',
      'Escala algo no diseñado para ello',
      'Saltos en escalada',
      'Rappel en sitio no previsto'
    ],
    'Guerrero': [
      'Repite la diaria (hoy)',
      'Repite la focus (hoy)',
      'Golpes arma pesada 3×10',
      'Combo arma pesada 1 min',
      'Duplica diaria (modo duro)',
      'Duplica focus (modo duro)',
      '3 golpes “Guts” ×10',
      'Combo 5 golpes “Guts”',
      'Combo 1 min “Guts”',
      'Inventa un golpe',
      'Fabrica un arma pesada'
    ]
  };

  function scaleTextForLevel(text, lvl){
    const f=Math.pow(1.1, Math.max(0,lvl-1));
    // A/B
    let out=text.replace(/(\d+)\s*\/\s*(\d+)/g,(_,a,b)=>Math.max(1,Math.round(a*f))+'/'+Math.max(1,Math.round(b*f)));
    // segundos
    out=out.replace(/(\d+)\s*s\b/g,(m,p)=>Math.max(1,Math.round(p*f))+' s');
    // números sueltos
    out=out.replace(/(\d+)(?![^\(]*\))/g,(m,p)=>String(Math.max(1,Math.round(p*f))));
    return out;
  }

  // ----- Creadores -----
  function mkDaily(){
    const now=new Date();
    const due=(now < today10()) ? new Date(Math.min(now.getTime()+14*3600*1000, endOfDay().getTime())) : endOfDay();
    const baseReqs=DAILY_ROTATION[now.getDay()];
    const reqs=baseReqs.map(s=>({label:scaleTextForLevel(s, state.level)}));
    return { id:uid(), type:TYPE.DAILY, title:'Misión diaria', desc:'Obligatoria de hoy.', createdAt:now.toISOString(), dueAt:due.toISOString(),
      status:'pending', accepted:true, baseXP:40, baseCoins:6, requirements:reqs, penalty:{coins:6, nerf:true} };
  }
  function focusBaseByLevel(l){ return l>=21?30:l>=10?25:l>=5?18:10; }
  function mkFocus(zone){
    const now=new Date(); const base=focusBaseByLevel(state.level);
    const tpl={
      abdomen:['Crunches','Elevación de piernas','Criss cross','Plancha (s)'],
      brazos:['Fondos tríceps','Curl bíceps (peso)','Flexiones tríceps','Dominadas supinas'],
      piernas:['Sentadillas','Lunges','Puente glúteos','Sentadillas salto'],
      pecho:['Flexiones','Press pecho (peso)','Aperturas','Rebotes flexión/press'],
      espalda:['Dominadas','Remo en plancha','Remo en banco','Cargadas'],
      hombros:['Elevaciones laterales','Flexiones pica','Press militar','Elevaciones frontales']
    }[zone]||['Crunches','Plancha (s)','Flexiones','Sentadillas'];
    const reqs=tpl.slice(0,4).map(n=>({label:n+(/\(s\)/.test(n)?(' '+base+' s'):(' '+base))}));
    return { id:uid(), type:TYPE.FOCUS, title:'Focus — '+zone, desc:'Sesión focalizada en '+zone, createdAt:now.toISOString(),
      dueAt:new Date(now.getTime()+8*3600*1000).toISOString(), status:'pending', accepted:false, baseXP:80, baseCoins:10,
      requirements:reqs, penalty:{coins:8, nerf:true, nextHarder:true, harderFactor:1.5} };
  }

  // Selecciona N únicos aleatorios del pool
  function pickN(arr, n){
    const a=[...arr]; for (let i=a.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; [a[i],a[j]]=[a[j],a[i]]; }
    return a.slice(0, n);
  }

  function mkClassMission(cls){
    const now=new Date();
    const pool = CLASS_POOL_STRINGS[cls] || ['Técnica 1','Técnica 2','Técnica 3','Técnica 4'];
    const cp = currentClassObj(); // nivel actual de ESA clase
    const chosen = pickN(pool, 2);
    const reqs = chosen.map(s=>({label: scaleTextForLevel(s, cp.level)}));
    return {
      id:uid(), type:TYPE.CLASS, title:'Misión de clase — '+cls,
      desc:'Entrenamiento específico de tu clase.',
      createdAt: now.toISOString(),
      dueAt: new Date(now.getTime()+12*3600*1000).toISOString(), // 12h
      status:'pending', accepted:false,
      baseXP:0, baseCoins:9, classXP:70,
      requirements:reqs,
      penalty:null
    };
  }

  // Urgentes (como step2, con pity + notifs)
  function mkUrgent(){
    const T=[
      {name:'Domador de Dragones', reqs:['Sprint 200 m × 5','Flexiones 40','Plancha 60 s','Prueba de clase (aleatoria)'], loot:['aliento_dragón','escamas_dragón','huevo_dragón','amigo_dragón','sangre_dragón']},
      {name:'Asesino de reyes', reqs:['Burpees 30','Sentadillas salto 30','Hollow hold 30 s','Prueba de clase (aleatoria)'], loot:['corona_maldita','cetro_poder','espada_triple','proteccion_princesa','colgante_reina']},
      {name:'Ciervo de mil ojos avistado', reqs:['Sprints 50 m × 10','Zancadas 20/20','Plancha lateral 30 s/lado','Prueba de clase (aleatoria)'], loot:['ojos_azules_3','cuerno_arbol_rojo','armadura_piel_magica','frasco_aliento_bosque','semilla_antigua']},
      {name:'Robo en la torre de maná', reqs:['Jumping jacks 80','Flexiones inclinadas 25','Planchas escaladas 40','Prueba de clase (aleatoria)'], loot:['pocion_mana_potente','libro_conjuros','daga_oscuridad','diente_fuego','llave_celda_oscura']},
      {name:'Asalto al coloso de hierro', reqs:['Sentadilla isométrica 60 s','Flexiones pike 20','Mountain climbers 60','Prueba de clase (aleatoria)'], loot:['armadura_voladora','botas_viento','maza_terremoto','latigo_azul','tunica_albores_alvaros']}
    ];
    const now=new Date(); const t=T[Math.floor(Math.random()*T.length)];
    return { id:uid(), type:TYPE.URGENT, title:'Misión urgente: '+t.name, desc:'Alta prioridad (no se puede rechazar).',
      createdAt:now.toISOString(), dueAt:new Date(now.getTime()+5*3600*1000).toISOString(), status:'pending', accepted:true,
      baseXP:120, baseCoins:15, requirements:t.reqs.map(x=>({label:x})),
      penalty:{coins:10, nerf:true, nextHarder:true, harderFactor:1.25}, loot:t.loot };
  }

  // ----- Overlay (igual que step2) -----
  const overlay=$('#overlay'), card=$('#overlayCard'), ovTitle=$('#ovTitle'), ovBody=$('#ovBody'), ovButtons=$('#ovButtons');
  function showInfo(title, body, color){
    if (!overlay||!card) { alert(title+'\n'+body); return; }
    card.className='overlay-card '+(color||'blue');
    if (ovTitle) ovTitle.textContent=title; if (ovBody) ovBody.textContent=body;
    if (ovButtons){ ovButtons.innerHTML=''; const ok=el('button',null,'Aceptar'); ok.onclick=()=>overlay.classList.add('hidden'); ovButtons.appendChild(ok); }
    overlay.classList.remove('hidden');
  }
  function showPromptAcceptReject(m, color){
    if (!overlay||!card) return;
    card.className='overlay-card '+(color||'blue');
    if (ovTitle) ovTitle.textContent=(m.type===TYPE.CLASS?'Nueva misión de clase':'Nueva misión');
    if (ovBody) ovBody.textContent='Tienes una misión: '+m.title+' — ¿Aceptas?';
    if (ovButtons){
      ovButtons.innerHTML='';
      const ok=el('button',null,'Aceptar'); ok.onclick=()=>{ m.accepted=true; save(); renderAll(); overlay.classList.add('hidden'); };
      const ko=el('button','ghost','Rechazar'); ko.onclick=()=>{ m.status='rejected'; save(); renderAll(); overlay.classList.add('hidden'); };
      ovButtons.appendChild(ok); ovButtons.appendChild(ko);
    }
    overlay.classList.remove('hidden');
  }

  // ----- Notificaciones (igual que step2) -----
  function notifSupported(){ return 'Notification' in window; }
  function askNotifPermission(){
    if (!notifSupported()) return showInfo('Notificaciones','Tu navegador no soporta notificaciones.', 'blue');
    if (Notification.permission==='granted') return showInfo('Notificaciones','Ya estaban activadas.','blue');
    Notification.requestPermission().then(p=>{
      if (p==='granted') showInfo('Notificaciones','Activadas correctamente.','blue');
      else showInfo('Notificaciones','Permiso denegado o ignorado.','blue');
    });
  }
  function notifyNow(title, body){
    try{ if ('Notification' in window && Notification.permission==='granted'){ new Notification(title, { body }); } }catch(_){}
  }
  function scheduleDueSoonNotification(m){
    if (!('Notification' in window) || Notification.permission!=='granted' || !m.dueAt) return;
    const due = new Date(m.dueAt).getTime();
    const triggerAt = due - 30*60*1000;
    const delay = triggerAt - Date.now();
    if (delay<=0) return;
    setTimeout(()=>{
      const live = state.missions.find(x=>x.id===m.id);
      if (live && live.status==='pending') notifyNow('⏳ Quedan 30 min', m.title+' está a punto de vencer.');
    }, Math.min(delay, 2_147_000_000));
  }
  document.addEventListener('click', (e)=>{
    const t=e.target.closest('button'); if(!t) return;
    if (t.id==='enableNotifBtn') askNotifPermission();
  });

  // ----- Rollover / límites / pity -----
  function rolloverDailyIfNeeded(){
    const t=todayStr();
    if (!state.dailyCounters || state.dailyCounters.date!==t){
      state.dailyCounters = { date:t, focusMade:0, classMade:0 };
      state.daysWithoutUrgent = (state.daysWithoutUrgent||0) + 1;
    }
    if (state.lastSeenDay!==t){
      // penalizar diaria vieja vencida
      state.missions.forEach(m=>{
        if (m.type===TYPE.DAILY && m.status==='pending' && m.createdAt.slice(0,10)!==t){
          if (Date.now()>new Date(m.dueAt).getTime()){
            m.status='failed';
            if (m.penalty){ if (m.penalty.coins) state.coins=Math.max(0,state.coins-m.penalty.coins); if (m.penalty.nerf) applyNerf(); }
          }
        }
      });
      state.lastSeenDay=t;
      state.urgentPlan=defaultUrgentPlan();
      save();
    }
  }
  function urgentChanceToday(){
    const d=Math.max(0,state.daysWithoutUrgent||0);
    if (d<7) return 0.10;
    const extra=Math.min(0.05*(d-6),0.20); // +5%/día desde el 7 hasta +20%
    return Math.min(0.10+extra, 0.30);
  }
  function planUrgentForTodayIfNeeded(){
    const t=todayStr();
    const wk=weekKey(); const used=state.weeklyUrgents[wk]||0;
    if (state.urgentPlan && state.urgentPlan.date===t && state.urgentPlan.decided) return;
    const plan=defaultUrgentPlan(); plan.date=t; plan.decided=true;
    if (used<3){
      const chance=urgentChanceToday();
      const will=(chance>=0.30) ? true : (Math.random()<chance);
      if (will){
        const h=3+Math.floor(Math.random()*17), m=Math.floor(Math.random()*60);
        const fire=new Date(); fire.setHours(h,m,0,0);
        plan.willHave=true; plan.fireAt=fire.toISOString();
      }
    }
    state.urgentPlan=plan; save();
  }
  function onUrgentSpawned(){ state.daysWithoutUrgent=0; save(); }
  function triggerScheduledUrgentIfTime(){
    const p=state.urgentPlan; if (!p||!p.decided||!p.willHave||p.spawned||!p.fireAt) return;
    const now=Date.now(), fireAt=new Date(p.fireAt).getTime(); if (now<fireAt) return;
    const wk=weekKey(); const used=state.weeklyUrgents[wk]||0; if (used>=3){ p.spawned=true; save(); return; }
    const u=mkUrgent(); const due=fireAt+5*3600*1000;
    if (now>due){
      u.createdAt=new Date(fireAt).toISOString(); u.dueAt=new Date(due).toISOString(); u.status='failed';
      if (u.penalty){ if (u.penalty.coins) state.coins=Math.max(0,state.coins-u.penalty.coins); if (u.penalty.nerf) applyNerf(); if (u.penalty.nextHarder) state.missions.unshift(harderClone(u)); }
      state.missions.unshift(u); state.weeklyUrgents[wk]=(state.weeklyUrgents[wk]||0)+1; p.spawned=true; save(); renderAll(); onUrgentSpawned();
      notifyNow('⚠️ Urgente perdida','La misión urgente de hoy venció antes de entrar.');
      return;
    }
    state.missions.unshift(u); state.weeklyUrgents[wk]=(state.weeklyUrgents[wk]||0)+1; p.spawned=true; save(); renderAll(); onUrgentSpawned();
    notifyNow('⚡ ¡Misión urgente!','Se ha activado una misión urgente. Tienes 5 horas.');
    scheduleDueSoonNotification(u);
  }

  // ----- Acciones misión -----
  function harderClone(m){
    const n=JSON.parse(JSON.stringify(m)); n.id=uid(); n.status='pending'; n.accepted=true;
    n.title=m.title+' — Versión dura'; n.dueAt=new Date(Date.now()+6*3600*1000).toISOString(); n.penalty=null;
    const f=(m.penalty&&m.penalty.harderFactor)?m.penalty.harderFactor:1.25;
    n.requirements=n.requirements.map(r=>({label:r.label.replace(/(\d+)/g, x=>String(Math.ceil(parseInt(x,10)*f)))}));
    return n;
  }
  function completeMission(m){
    if (!m || m.status!=='pending') return;
    if ((m.type===TYPE.CLASS || m.type===TYPE.FOCUS) && !m.accepted) return showInfo('Acepta primero','Debes aceptar la misión.','blue');
    m.status='completed';
    gainXP(m.baseXP||0);
    if (m.classXP) gainClassXP(m.classXP); // <<— ahora suma a la clase ACTUAL
    state.coins += (m.baseCoins||0);
    decayNerf();
    if (m.type===TYPE.URGENT && Math.random()<0.20 && m.loot && m.loot.length){
      const item=m.loot[Math.floor(Math.random()*m.loot.length)];
      state.inventory[item]=(state.inventory[item]||0)+1;
      showInfo('Objeto raro recibido','Has obtenido: '+item,'blue');
    }
    save(); renderAll();
    const extra = m.classXP ? (' · +'+m.classXP+' XP clase') : '';
    const col = m.type===TYPE.CLASS?'purple': (m.type===TYPE.URGENT?'red': (m.type===TYPE.FOCUS?'blue':'blue'));
    showInfo('Misión completada','Has ganado +'+(m.baseXP||0)+' XP y +'+(m.baseCoins||0)+'🪙'+extra, col);
  }
  function failMission(m){
    if (!m || m.status!=='pending') return;
    m.status='failed';
    if (m.penalty){
      if (m.penalty.coins) state.coins=Math.max(0,state.coins-m.penalty.coins);
      if (m.penalty.nerf) applyNerf();
      if (m.penalty.nextHarder) state.missions.unshift(harderClone(m));
    }
    save(); renderAll();
    const col = m.type===TYPE.CLASS?'purple': (m.type===TYPE.URGENT?'red':'blue');
    showInfo('Misión fallida', (m.type===TYPE.CLASS?'Sin penalización.':'Se aplicó la penalización.'), col);
  }
  function add2h(m){ if (!m.dueAt) return; m.dueAt=new Date(new Date(m.dueAt).getTime()+2*3600*1000).toISOString(); }
  function halfRequirements(m){ if (!m.requirements) return; m.requirements=m.requirements.map(r=>({label:r.label.replace(/(\d+)/g, x=>String(Math.max(1, Math.floor(parseInt(x,10)/2))))})); }

  // ----- Límites diarios (se mantienen) -----
  const canMakeFocus = ()=> state.dailyCounters && state.dailyCounters.focusMade < 2;
  const incFocus     = ()=> { state.dailyCounters.focusMade++; save(); };
  const canMakeClass = ()=> state.dailyCounters && state.dailyCounters.classMade < 2;
  const incClass     = ()=> { state.dailyCounters.classMade++; save(); };

  // ----- Render -----
  const missionsList=$('#missionsList'), shopConsumibles=$('#shopConsumibles'), shopEsteticos=$('#shopEsteticos'), inventoryList=$('#inventoryList');
  const heroName=$('#heroName'), heroClass=$('#heroClass'), heroGoal=$('#heroGoal');

  function setHeader(){
    const need=xpNeedFor(state.level);
    const li=$('#levelInfo'); if (li) li.textContent='Lvl '+state.level+' · '+state.xp+' / '+need+' XP · '+state.coins+'🪙 · '+VER;
    const fill=$('#xpFill'); if (fill){ const pct=Math.max(0,Math.min(1,state.xp/need)); fill.style.width=(pct*100)+'%'; }
    document.title='Venator · '+VER;
  }
  function renderHeader(){
    setHeader();
    const set=(id,val)=>{ const el=$('#'+id); if(el) el.textContent=val; };
    set('pLvl',state.level);
    set('pXP',state.xp); set('pXPNeed',xpNeedFor(state.level));
    set('pCoins',state.coins); set('pNerf',state.expNerfCount||0);
    // CLASE actual
    const cp=currentClassObj();
    set('cLvl',cp.level);
    set('cXP',cp.xp);
    set('cXPNeed',cxpNeedFor(cp.level));
  }

  function urgentCounterNode(){
    const wk=weekKey(); const used=state.weeklyUrgents[wk]||0;
    const div=el('div','small'); div.textContent='⚡ Urgentes semana: '+used+'/3';
    return div;
  }
  function iconImg(id){
    const ICONS={
      time_potion:'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2NCIgaGVpZ2h0PSI2NCI+PGNpcmNsZSBjeD0iMzIiIGN5PSIzMiIgcj0iMzAiIGZpbGw9IiMwYzExMjAiIHN0cm9rZT0iIzZlYThmZiIgc3Ryb2tlLXdpZHRoPSIzIi8+PHRleHQgeD0iMzIiIHk9IjM4IiBmb250LXNpemU9IjI4IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjNmVhOGZmIj7wn5CRPC90ZXh0Pjwvc3ZnPg==',
      str_potion:'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2NCIgaGVpZ2h0PSI2NCI+PHJlY3QgeD0iNiIgeT0iNiIgd2lkdGg9IjUyIiBoZWlnaHQ9IjUyIiByeD0iMTAiIGZpbGw9IiMwYzExMjAiIHN0cm9rZT0iI2E2NmJmZiIgc3Ryb2tlLXdpZHRoPSIzIi8+PHRleHQgeD0iMzIiIHk9IjQwIiBmb250LXNpemU9IjI4IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjYTY2YmZmIj7ilqU8L3RleHQ+PC9zdmc+'
    };
    const img=document.createElement('img'); img.className='icon'; img.alt=''; img.src=ICONS[id]||ICONS.time_potion; return img;
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
      if (state.inventory.time_potion>0 && m.dueAt){ const b=el('button','ghost','+2h'); b.dataset.act='use_time'; b.dataset.id=m.id; b.prepend(iconImg('time_potion')); pot.appendChild(b); any=true; }
      if (state.inventory.str_potion>0 && m.requirements && m.requirements.length){ const b=el('button','ghost','½ req'); b.dataset.act='use_str'; b.dataset.id=m.id; b.prepend(iconImg('str_potion')); pot.appendChild(b); any=true; }
      if (any) li.appendChild(pot);
    }
    const btns=el('div','btnrow');
    if ((m.type===TYPE.CLASS || m.type===TYPE.FOCUS) && !m.accepted){
      const a=el('button',null,'Aceptar'); a.dataset.act='accept'; a.dataset.id=m.id; btns.appendChild(a);
      const r=el('button','ghost','Rechazar'); r.dataset.act='reject'; r.dataset.id=m.id; btns.appendChild(r);
    }
    const done=el('button',null,'Marcar completada'); done.dataset.act='done'; done.dataset.id=m.id; btns.appendChild(done);
    const fail=el('button','ghost','Fallar'); fail.dataset.act='fail'; fail.dataset.id=m.id; btns.appendChild(fail);
    li.appendChild(btns);
    return li;
  }

  function renderMissions(){
    if (!missionsList) return;
    missionsList.textContent='';
    const head=el('li','card');
    const row=el('div','btnrow');
    const bFocus=document.createElement('button'); bFocus.id='newFocusBtnSmall'; bFocus.textContent='+ Nueva misión Focus';
    const bClass=document.createElement('button'); bClass.id='newClassBtnSmall'; bClass.textContent='+ Misión de Clase';
    row.appendChild(bFocus); row.appendChild(bClass);
    head.appendChild(row); head.appendChild(urgentCounterNode());
    missionsList.appendChild(head);
    const pend=state.missions.filter(x=>x.status==='pending');
    const hist=state.missions.filter(x=>x.status!=='pending').slice(0,8);
    pend.forEach(m=>missionsList.appendChild(missionCard(m)));
    if (hist.length){ const sep=el('li','card'); sep.appendChild(el('div','small','Histórico reciente')); missionsList.appendChild(sep); hist.forEach(m=>missionsList.appendChild(missionCard(m))); }
  }

  function renderShop(){
    const shopConsumibles=$('#shopConsumibles'), shopEsteticos=$('#shopEsteticos'), inventoryList=$('#inventoryList');
    if (!shopConsumibles || !shopEsteticos || !inventoryList) return;
    shopConsumibles.textContent=''; shopEsteticos.textContent=''; inventoryList.textContent='';
    const SHOP={consumibles:[
      {id:'time_potion', name:'Poción de tiempo (+2h)', desc:'Amplía el tiempo de una misión activa.', price:30},
      {id:'str_potion',  name:'Poción de fuerza (1/2 requisitos)', desc:'Reduce a la mitad los números de la misión.', price:40},
      {id:'exp_potion',  name:'Poción de EXP (+20% 30 min)', desc:'Ganas +20% EXP durante 30 min.', price:50},
      {id:'cure',        name:'Curas (quita nerfeo EXP)', desc:'Elimina el -20% de EXP acumulado.', price:20}
    ], esteticos:[
      {id:'equip_dagas', name:'Dagas dobles', desc:'Cosmético', price:60},
      {id:'equip_arco_rojo', name:'Arco rojo', desc:'Cosmético', price:80},
      {id:'equip_gafas', name:'Gafas de combate', desc:'Cosmético', price:40},
      {id:'equip_ropa_negra', name:'Ropa negra', desc:'Cosmético', price:70}
    ]};
    function iconImgShop(id){
      const ICONS={
        time_potion:'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2NCIgaGVpZ2h0PSI2NCI+PGNpcmNsZSBjeD0iMzIiIGN5PSIzMiIgcj0iMzAiIGZpbGw9IiMwYzExMjAiIHN0cm9rZT0iIzZlYThmZiIgc3Ryb2tlLXdpZHRoPSIzIi8+PHRleHQgeD0iMzIiIHk9IjM4IiBmb250LXNpemU9IjI4IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjNmVhOGZmIj7wn5CRPC90ZXh0Pjwvc3ZnPg==',
        str_potion:'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2NCIgaGVpZ2h0PSI2NCI+PHJlY3QgeD0iNiIgeT0iNiIgd2lkdGg9IjUyIiBoZWlnaHQ9IjUyIiByeD0iMTAiIGZpbGw9IiMwYzExMjAiIHN0cm9rZT0iI2E2NmJmZiIgc3Ryb2tlLXdpZHRoPSIzIi8+PHRleHQgeD0iMzIiIHk9IjQwIiBmb250LXNpemU9IjI4IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjYTY2YmZmIj7ilqU8L3RleHQ+PC9zdmc+'
      };
      const img=document.createElement('img'); img.className='icon'; img.alt=''; img.src=ICONS[id]||ICONS.time_potion; return img;
    }
    function shopCard(it){
      const li=el('li','card'); const row=el('div','itemrow');
      row.appendChild(iconImgShop(it.id)); const h=el('h4'); h.append(it.name+' '); const badge=el('span','badge','🪙 '+it.price); h.appendChild(badge); row.appendChild(h);
      li.appendChild(row); li.appendChild(el('div','small',it.desc));
      const btns=el('div','btnrow'); const b=el('button',null,'Comprar'); b.dataset.buy=it.id; btns.appendChild(b); li.appendChild(btns); return li;
    }
    SHOP.consumibles.forEach(it=> shopConsumibles.appendChild(shopCard(it)));
    SHOP.esteticos.forEach(it=> shopEsteticos.appendChild(shopCard(it)));
    Object.keys(state.inventory).forEach(k=>{
      const count=state.inventory[k]; if(!count) return;
      const pretty = k==='time_potion'?'Poción de tiempo':k==='str_potion'?'Poción de fuerza':k==='exp_potion'?'Poción de EXP':k==='cure'?'Curas':k;
      const li=el('li','card'); const row=el('div','itemrow'); row.appendChild(iconImgShop(k)); row.appendChild(el('h4',null, pretty+' × '+count)); li.appendChild(row);
      const btns=el('div','btnrow');
      if (k==='exp_potion'){ const b=el('button',null,'Usar (+20% 30min)'); b.dataset.useGlobal='exp_potion'; btns.appendChild(b); }
      else if (k==='cure'){ const b=el('button',null,'Usar (quitar nerf)'); b.dataset.useGlobal='cure'; btns.appendChild(b); }
      else btns.appendChild(el('div','small','Úsala desde la tarjeta de misión'));
      li.appendChild(btns); inventoryList.appendChild(li);
    });
    refreshProfileList();
  }

  function renderProfile(){
    if (heroName) heroName.value=state.hero.name||'';
    if (heroClass){
      heroClass.innerHTML='';
      CLASSES.forEach(c=>{ const o=document.createElement('option'); o.value=c; o.textContent=c; heroClass.appendChild(o); });
      if (state.hero.cls) heroClass.value=state.hero.cls;
    }
    if (heroGoal) heroGoal.value=state.hero.goal||'';
  }
  function renderAll(){ renderHeader(); renderMissions(); renderShop(); renderProfile(); }

  // ----- Perfiles -----
  function getProfiles(){ try{ return JSON.parse(localStorage.getItem(LS_PROFILES)) || {}; }catch(_){ return {}; } }
  function setProfiles(p){ localStorage.setItem(LS_PROFILES, JSON.stringify(p)); }
  function refreshProfileList(){ const span=document.getElementById('profileList'); if(!span) return; const names=Object.keys(getProfiles()); span.textContent=names.length?names.join(', '):'(vacío)'; }

  // ----- Tabs -----
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
  }

  // ----- Clicks globales -----
  document.addEventListener('click', function(e){
    const t=e.target.closest('button'); if(!t) return;

    // Focus (2/día)
    if (t.id==='newFocusBtnSmall' || t.id==='newFocusBtn'){
      if (!(state.dailyCounters && state.dailyCounters.focusMade<2)) return showInfo('Límite diario','Solo 2 Focus al día.','blue');
      const zone=state.hero.goal||'abdomen'; const f=mkFocus(zone); state.missions.unshift(f); state.dailyCounters.focusMade++; save(); renderAll(); showPromptAcceptReject(f,'blue'); return;
    }
    // Clase (2/día)
    if (t.id==='newClassBtnSmall' || t.id==='newClassBtn'){
      if (!(state.dailyCounters && state.dailyCounters.classMade<2)) return showInfo('Límite diario','Solo 2 misiones de clase al día.','purple');
      const c=state.hero.cls||'Asesino'; const m=mkClassMission(c); state.missions.unshift(m); state.dailyCounters.classMade++; save(); renderAll(); showPromptAcceptReject(m,'purple'); return;
    }

    // Tienda
    const buy=t.dataset.buy;
    if (buy){
      const PRICE={time_potion:30,str_potion:40,exp_potion:50,cure:20,equip_dagas:60,equip_arco_rojo:80,equip_gafas:40,equip_ropa_negra:70};
      const price=PRICE[buy]; if (price==null) return;
      if (state.coins<price) return alert('No tienes monedas suficientes');
      state.coins-=price;
      if (buy.startsWith('equip_')){ if (!state.equipment.includes(buy)) state.equipment.push(buy); }
      else { state.inventory[buy]=(state.inventory[buy]||0)+1; }
      save(); renderAll(); return;
    }

    // Inventario global
    const g=t.dataset.useGlobal;
    if (g==='exp_potion'){ if ((state.inventory.exp_potion||0)>0){ state.expBuffUntil=Date.now()+30*60*1000; state.inventory.exp_potion--; save(); renderAll(); showInfo('Poción de EXP','+20% EXP durante 30 min.','blue'); } else alert('No tienes Poción de EXP'); return;}
    if (g==='cure'){ if ((state.inventory.cure||0)>0){ state.expNerfCount=0; state.inventory.cure--; save(); renderAll(); showInfo('Curas','Nerf de EXP eliminado.','blue'); } else alert('No tienes Curas'); return;}

    // Misiones
    const id=t.dataset.id; const act=t.dataset.act;
    if (id&&act){
      const m=state.missions.find(x=>x.id===id); if(!m) return;
      if (act==='accept'){ if (m.type!=='urgent'){ m.accepted=true; save(); renderAll(); } return; }
      if (act==='reject'){ if (m.type!=='urgent'){ m.status='rejected'; save(); renderAll(); } return; }
      if (act==='done'){ completeMission(m); return; }
      if (act==='fail'){ failMission(m); return; }
      if (act==='use_time'){ if ((state.inventory.time_potion||0)>0){ add2h(m); state.inventory.time_potion--; save(); renderAll(); showInfo('Poción de tiempo','+2h aplicadas a '+m.title,'blue'); } else alert('No tienes Poción de tiempo'); return; }
      if (act==='use_str'){ if ((state.inventory.str_potion||0)>0){ halfRequirements(m); state.inventory.str_potion--; save(); renderAll(); showInfo('Poción de fuerza','Requisitos a la mitad en '+m.title,'blue'); } else alert('No tienes Poción de fuerza'); return; }
    }

    // Perfiles
    if (t.id==='saveProfileBtn'){ const name=($('#profileName')?.value||'').trim(); if(!name) return alert('Pon un nombre de perfil');
      const snap=JSON.parse(JSON.stringify(state)); const profiles=getProfiles(); profiles[name]=snap; setProfiles(profiles); refreshProfileList(); alert('Perfil guardado: '+name); return; }
    if (t.id==='loadProfileBtn'){ const name=($('#profileName')?.value||'').trim(); if(!name) return alert('Pon un nombre de perfil');
      const profiles=getProfiles(); if(!profiles[name]) return alert('No existe el perfil: '+name);
      state=migrateShape(JSON.parse(JSON.stringify(profiles[name]))); save(); renderAll(); alert('Perfil cargado: '+name); return; }
    if (t.id==='exportProfileBtn'){ const name=($('#profileName')?.value.trim())||'perfil'; const blob=new Blob([JSON.stringify({name,state},null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name+'.json'; a.click(); return; }
    if (t.id==='importProfileBtn'){ const input=$('#importProfileInput'); if (input) input.click(); return; }
  });

  // Importar perfil desde archivo
  const importProfileInput=$('#importProfileInput');
  if (importProfileInput) importProfileInput.addEventListener('change', e=>{
    const f=e.target.files[0]; if(!f) return;
    const r=new FileReader();
    r.onload=function(){
      try{
        const data=JSON.parse(r.result);
        if(data && data.state){ state=migrateShape(data.state); save(); renderAll(); alert('Perfil importado: '+(data.name||'perfil')); }
        else alert('Archivo inválido');
      }catch(_){ alert('No se pudo leer el archivo'); }
    };
    r.readAsText(f);
  });

  // ----- Auto: diaria / clase / urgentes -----
  function ensureDailyUniqueForToday(){
    const t=todayStr();
    if (state.lastDailyDateCreated===t) return;
    if (state.missions.some(m=>m.type===TYPE.DAILY && m.status==='pending' && m.createdAt.slice(0,10)===t)){
      state.lastDailyDateCreated=t; save(); return;
    }
    state.missions.unshift(mkDaily()); state.lastDailyDateCreated=t; save(); renderAll();
  }
  function ensureClassMissionIfNone(){
    const hasPendingClass=state.missions.some(m=>m.type===TYPE.CLASS && m.status==='pending');
    if (!hasPendingClass){
      const c=state.hero.cls||'Asesino';
      const m=mkClassMission(c);
      state.missions.unshift(m);
      save();
    }
  }

  // ----- Tick -----
  function tick(){
    const now=Date.now(); let dirty=false;
    $$('#missionsList .card').forEach(card=>{
      const id=card.getAttribute('data-id'); if(!id) return;
      const m=state.missions.find(x=>x.id===id);
      const elTimer=card.querySelector('.timer');
      if (m&&elTimer&&m.dueAt) elTimer.textContent=fmt(new Date(m.dueAt).getTime()-now);
      if (m && m.status==='pending' && m.dueAt && now>new Date(m.dueAt).getTime()){
        m.status='failed';
        if (m.penalty){
          if (m.penalty.coins) state.coins=Math.max(0,state.coins-m.penalty.coins);
          if (m.penalty.nerf) applyNerf();
          if (m.penalty.nextHarder) state.missions.unshift(harderClone(m));
        }
        dirty=true;
      }
    });
    triggerScheduledUrgentIfTime();
    if (dirty){ save(); renderAll(); }
  }

  // ----- Inicio -----
  rolloverDailyIfNeeded();
  ensureDailyUniqueForToday();
  ensureClassMissionIfNone();
  planUrgentForTodayIfNeeded();
  triggerScheduledUrgentIfTime();
  renderAll();
  setInterval(tick, 1000);

  // Perfil inputs (importante para refrescar la barra de clase al cambiar clase)
  if (heroName)  heroName.addEventListener('change', function(){ state.hero.name=this.value||'Amo'; save(); renderHeader(); });
  if (heroClass) heroClass.addEventListener('change', function(){ state.hero.cls=this.value; save(); renderHeader(); });
  if (heroGoal)  heroGoal.addEventListener('change', function(){ state.hero.goal=this.value; save(); });

})();
