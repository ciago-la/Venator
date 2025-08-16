// === Altervenator app.v13s8.step1.js ===
// Paso 1: Misiones de clase + botón (+Clase) con máximo 2/día,
//         límite de +Focus a 2/día,
//         y render seguro (antixss) sin innerHTML en contenidos de usuario.
// Mantiene: diaria 1x/día, urgentes programadas 10% (sin spoilers), tienda, inventario, perfiles.
// NOTA: seguimos usando la misma clave LS para conservar progreso.

(function(){
  const VER='v13s8-step1';

  // ---------- Error banner ----------
  window.addEventListener('error', e=>{
    const d=document.createElement('div');
    d.style.cssText='position:fixed;top:0;left:0;right:0;background:#300;color:#fff;padding:6px 10px;z-index:99999;font:12px monospace';
    d.textContent='JS ERROR: '+(e.message||e.filename||'');
    document.body.appendChild(d);
  });

  // ---------- Estado ----------
  var LS='alter_v13s5';
  var LS_PROFILES='alter_profiles_v1';

  const CLASSES=['Guerrero','Asesino','Mago','Arquero','Espía','Maratón','Amigo del dragón','Saltamontes'];

  function load(){ try{return JSON.parse(localStorage.getItem(LS));}catch(_){return null;} }
  function save(){ localStorage.setItem(LS, JSON.stringify(state)); }

  function defaultUrgentPlan(){ return {date:null, decided:false, willHave:false, fireAt:null, spawned:false}; }
  function migrateShape(s){
    if (!s) s={};
    if (!s.hero) s.hero={name:'Amo', cls:'Asesino', goal:'abdomen'};
    if (typeof s.xp!=='number') s.xp=0;
    if (typeof s.level!=='number') s.level=1;
    if (typeof s.coins!=='number') s.coins=0;
    if (typeof s.classXP!=='number') s.classXP=0;
    if (typeof s.classLevel!=='number') s.classLevel=1;
    if (typeof s.expBuffUntil!=='number') s.expBuffUntil=0;
    if (typeof s.expNerfCount!=='number') s.expNerfCount=0;
    if (!Array.isArray(s.missions)) s.missions=[];
    if (!s.weeklyUrgents || typeof s.weeklyUrgents!=='object') s.weeklyUrgents={};
    if (!s.inventory) s.inventory={ time_potion:1, str_potion:0, exp_potion:0, cure:0 };
    if (!Array.isArray(s.equipment)) s.equipment=[];
    if (typeof s.lastSeenDay!=='string' && s.lastSeenDay!==null) s.lastSeenDay=null;
    if (typeof s.lastDailyDateCreated!=='string' && s.lastDailyDateCreated!==null) s.lastDailyDateCreated=null;
    if (!s.urgentPlan || typeof s.urgentPlan!=='object') s.urgentPlan = defaultUrgentPlan();
    s.urgentPlan = Object.assign(defaultUrgentPlan(), s.urgentPlan);
    // NUEVO: contadores diarios para límites
    if (!s.dailyCounters || typeof s.dailyCounters!=='object'){
      s.dailyCounters = { date:null, focusMade:0, classMade:0 };
    }
    if (typeof s.schemaVersion!=='number') s.schemaVersion=1; // básico para futuras migraciones
    return s;
  }
  var state = migrateShape(load());

  // ---------- Utils ----------
  function uid(){ return Math.random().toString(36).slice(2)+Date.now().toString(36); }
  function todayStr(){ return new Date().toISOString().slice(0,10); }
  function endOfDay(){ const x=new Date(); x.setHours(23,59,59,999); return x; }
  function today10(){ const x=new Date(); x.setHours(10,0,0,0); return x; }
  function fmt(ms){ ms=Math.max(0,ms|0); const s=(ms/1000)|0; const h=('0'+(s/3600|0)).slice(-2); const m=('0'+((s%3600)/60|0)).slice(-2); const sc=('0'+(s%60)).slice(-2); return h+':'+m+':'+sc; }
  function xpNeedFor(level){ return Math.round(200 * Math.pow(1.1, level-1)); }
  function cxpNeedFor(level){ return Math.round(200 * Math.pow(1.1, level-1)); }
  function weekKey(){
    const d=new Date();
    const a=new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    a.setUTCDate(a.getUTCDate()+4-(a.getUTCDay()||7));
    const y=new Date(Date.UTC(a.getUTCFullYear(),0,1));
    const w=Math.ceil((((a-y)/86400000)+1)/7);
    return a.getUTCFullYear()+'-W'+('0'+w).slice(-2);
  }
  function gainXP(base){
    let g=base;
    if (Date.now()<state.expBuffUntil) g=Math.round(g*1.2);
    if (state.expNerfCount>0) g=Math.round(g*0.8);
    state.xp += g;
    while(state.xp >= xpNeedFor(state.level)){ state.xp -= xpNeedFor(state.level); state.level++; }
  }
  function gainClassXP(base){
    state.classXP += base;
    while(state.classXP >= cxpNeedFor(state.classLevel)){
      state.classXP -= cxpNeedFor(state.classLevel);
      state.classLevel++;
      // Bonus cosmético a nivel 10, 20, ...
      if (state.classLevel % 10 === 0){
        const award = classBonusItem(state.hero.cls);
        if (award) state.inventory[award]=(state.inventory[award]||0)+1;
      }
    }
  }
  function classBonusItem(cls){
    // Bonus cosméticos por clase (de tu diseño)
    const map={
      'Asesino':'botas_sombra',
      'Guerrero':'guanteletes_coloso',
      'Mago':'anillo_mana',
      'Amigo del dragón':'simbolo_espiritu',
      'Arquero':'talisman_ojo_agudo',
      'Saltamontes':'magnesio_lava',
      'Maratón':'estela_alba',
      'Espía':'pendiente_fantasma'
    };
    return map[cls]||'gema_rara';
  }
  function applyNerf(){ state.expNerfCount = Math.min(9,(state.expNerfCount||0)+3); }
  function decayNerf(){ if (state.expNerfCount>0) state.expNerfCount--; }

  // ---------- Config datos ----------
  var TYPE={DAILY:'daily', CLASS:'class', URGENT:'urgent', FOCUS:'focus'};

  var DAILY_ROTATION={
    1:['Flexiones 5 × 2','Sentadillas 10 × 2','Abdominales 20 × 2'],
    2:['Dominadas 5/3','Zancadas 4/4','Puente de glúteo 7'],
    3:['Fondos de tríceps 5','Patada lateral 3 × 2','Plancha 10 s'],
    4:['Flexiones 5 × 2','Sentadillas 10 × 2','Abdominales 20 × 2'],
    5:['Dominadas 5/3','Zancadas 4/4','Puente de glúteo 7'],
    6:['Fondos de tríceps 5','Patada lateral 3 × 2','Plancha 10 s'],
    0:['Elevación de piernas 5 × 2','Saco/sombra (combo)','Sombra intensa 30 s']
  };

  // Misiones de Clase: pools por clase (resumen de tu documento)
  const CLASS_POOLS={
    'Asesino': [
      ['Saltos pliométricos x10 por lado ×2','Saltos reactivos 20','Burpees 8 + Cangrejo 33 + Burpees pino 9 + Estrella 33 + Spidermans 30 (×2, 1 min desc)']
    ],
    'Mago': [
      ['Patada reacción (rápida) 20','Asalto punching ball 1 min ×2','Reflejos con pelotas 5']
    ],
    'Arquero': [
      ['Side kicks 10/lado + Front kicks 10/lado','Scorpions 5/lado','Pasos de rana 20 + mono 20']
    ],
    'Espía': [
      ['Estiramientos cadera 3×30s','Flexibilidad piernas 3×30s','Equilibrios a 1 pierna 30s c/u']
    ],
    'Maratón': [
      ['Sprints 4×100 m','Corre 5 km (≤30 min)','Corre 10 km (≤60 min)']
    ],
    'Amigo del dragón': [
      ['Recorrido 3 obstáculos (dominar)','Movimiento volador ×10','Derribo ×10']
    ],
    'Saltamontes': [
      ['Agarre: aguanta 20s y suelta ×10','Agarre con peso 30 rep c/lado (30kg)','Haz un bloque ×3 + una vía ×3']
    ],
    'Guerrero': [
      ['Repite la diaria','Golpes con arma pesada 3×10','Combo pesado 1 min']
    ]
  };

  function scaleTextForLevel(text, lvl){
    // reusamos el escalado de diarias para números (si aparecen)
    const factor = Math.pow(1.1, Math.max(0,lvl-1));
    // a) patrones tipo A/B
    let out = text.replace(/(\d+)\s*\/\s*(\d+)/g, (_,a,b)=> {
      const A=Math.max(1, Math.round(parseInt(a,10)*factor));
      const B=Math.max(1, Math.round(parseInt(b,10)*factor));
      return A+'/'+B;
    });
    // b) números sueltos
    out = out.replace(/(\d+)(?![^\(]*\))/g, (m,p)=> String(Math.max(1, Math.round(parseInt(p,10)*factor))));
    // c) segundos
    out = out.replace(/(\d+)\s*s\b/g, (m,p)=> String(Math.max(1, Math.round(parseInt(p,10)*factor)))+' s');
    return out;
  }

  // ---------- Creadores ----------
  function mkDaily(){
    const now=new Date();
    const due=(now < today10()) ? new Date(Math.min(now.getTime()+14*3600*1000, endOfDay().getTime())) : endOfDay();
    const baseReqs = DAILY_ROTATION[now.getDay()];
    const reqs = baseReqs.map(s=>({label: scaleTextForLevel(s, state.level)}));
    return {
      id:uid(), type:TYPE.DAILY, title:'Misión diaria', desc:'Obligatoria de hoy.',
      createdAt: now.toISOString(), dueAt: due.toISOString(),
      status:'pending', accepted:true,
      baseXP:40, baseCoins:6,
      requirements:reqs,
      penalty:{coins:6, nerf:true}
    };
  }

  function focusBaseByLevel(lvl){ if (lvl>=21) return 30; if (lvl>=10) return 25; if (lvl>=5) return 18; return 10; }
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
    return {
      id:uid(), type:TYPE.FOCUS, title:'Focus — '+zone, desc:'Sesión focalizada en '+zone,
      createdAt: now.toISOString(), dueAt: new Date(now.getTime()+8*3600*1000).toISOString(),
      status:'pending', accepted:false, baseXP:80, baseCoins:10, requirements:reqs,
      penalty:{coins:8, nerf:true, nextHarder:true, harderFactor:1.5}
    };
  }

  function mkClassMission(cls){
    const now=new Date();
    const pool = CLASS_POOLS[cls] || [['Tarea técnica 1','Tarea técnica 2','Tarea técnica 3']];
    const pick = pool[Math.floor(Math.random()*pool.length)];
    const reqs = pick.map(s=>({label: scaleTextForLevel(s, state.classLevel)}));
    return {
      id:uid(), type:TYPE.CLASS, title:'Misión de clase — '+cls,
      desc:'Entrenamiento específico de tu clase.',
      createdAt: now.toISOString(),
      dueAt: new Date(now.getTime()+12*3600*1000).toISOString(), // 12h
      status:'pending', accepted:false,
      baseXP:0, baseCoins:9, classXP:70,
      requirements:reqs,
      penalty:null // sin penalización si falla
    };
  }

  function mkUrgent(){
    // (Se mantiene desde tu versión anterior; no modificamos urgentes en este paso)
    const URGENT_TPL=[
      {name:'Domador de Dragones', reqs:['Sprint 200 m × 5','Flexiones 40','Plancha 60 s','Prueba de clase (aleatoria)'], loot:['aliento_dragón','escamas_dragón','huevo_dragón','amigo_dragón','sangre_dragón']},
      {name:'Asesino de reyes', reqs:['Burpees 30','Sentadillas salto 30','Hollow hold 30 s','Prueba de clase (aleatoria)'], loot:['corona_maldita','cetro_poder','espada_triple','proteccion_princesa','colgante_reina']},
      {name:'Ciervo de mil ojos avistado', reqs:['Sprints 50 m × 10','Zancadas 20/20','Plancha lateral 30 s/lado','Prueba de clase (aleatoria)'], loot:['ojos_azules_3','cuerno_arbol_rojo','armadura_piel_magica','frasco_aliento_bosque','semilla_antigua']},
      {name:'Robo en la torre de maná', reqs:['Jumping jacks 80','Flexiones inclinadas 25','Planchas escaladas 40','Prueba de clase (aleatoria)'], loot:['pocion_mana_potente','libro_conjuros','daga_oscuridad','diente_fuego','llave_celda_oscura']},
      {name:'Asalto al coloso de hierro', reqs:['Sentadilla isométrica 60 s','Flexiones pike 20','Mountain climbers 60','Prueba de clase (aleatoria)'], loot:['armadura_voladora','botas_viento','maza_terremoto','latigo_azul','tunica_albores_alvaros']}
    ];
    const now=new Date(); const t=URGENT_TPL[Math.floor(Math.random()*URGENT_TPL.length)];
    return {
      id:uid(), type:TYPE.URGENT, title:'Misión urgente: '+t.name, desc:'Alta prioridad (no se puede rechazar).',
      createdAt: now.toISOString(), dueAt: new Date(now.getTime()+5*3600*1000).toISOString(),
      status:'pending', accepted:true, baseXP:120, baseCoins:15,
      requirements:t.reqs.map(x=>({label:x})),
      penalty:{coins:10, nerf:true, nextHarder:true, harderFactor:1.25}, loot:t.loot
    };
  }

  // ---------- Overlays (render seguro) ----------
  // Usaremos createEl/helper para no meter innerHTML con datos del jugador
  function $(sel){ return document.querySelector(sel); }
  function el(tag, cls, text){
    const e=document.createElement(tag);
    if (cls) e.className=cls;
    if (text!=null) e.textContent=text;
    return e;
  }

  var overlay=$('#overlay'), card=$('#overlayCard');
  var ovTitle=$('#ovTitle'), ovBody=$('#ovBody'), ovButtons=$('#ovButtons');

  function showInfo(title, body, color){
    if (!overlay) return;
    card.className='overlay-card '+(color||'blue');
    ovTitle.textContent=title;
    ovBody.textContent=body;
    ovButtons.innerHTML='';
    const ok=el('button',null,'Aceptar');
    ok.onclick=()=>overlay.classList.add('hidden');
    ovButtons.appendChild(ok);
    overlay.classList.remove('hidden');
  }
  function showPromptAcceptReject(m, color){
    if (!overlay) return;
    card.className='overlay-card '+(color||'blue');
    ovTitle.textContent=(m.type===TYPE.CLASS?'Nueva misión de clase':'Nueva misión');
    ovBody.textContent='Tienes una misión: '+m.title+' — ¿Aceptas?';
    ovButtons.innerHTML='';
    const ok=el('button',null,'Aceptar');
    ok.onclick=function(){ m.accepted=true; save(); renderAll(); overlay.classList.add('hidden'); };
    const ko=el('button','ghost','Rechazar');
    ko.onclick=function(){ m.status='rejected'; save(); renderAll(); overlay.classList.add('hidden'); };
    ovButtons.appendChild(ok); ovButtons.appendChild(ko);
    overlay.classList.remove('hidden');
  }
  function showPromptUrgentActivated(){ showInfo('¡Misión urgente!','Se ha activado una misión urgente para hoy.','red'); }

  // ---------- Reglas diaria / urgentes (sin cambios funcionales aquí) ----------
  function rolloverDailyIfNeeded(){
    const t=todayStr();
    // reseteo contadores diarios
    if (!state.dailyCounters || state.dailyCounters.date!==t){
      state.dailyCounters = { date:t, focusMade:0, classMade:0 };
    }
    if (state.lastSeenDay!==t){
      // penaliza diarias pendientes vencidas
      for (let i=0;i<state.missions.length;i++){
        const m=state.missions[i];
        if (m.type===TYPE.DAILY && m.status==='pending' && m.createdAt.slice(0,10)!==t){
          if (Date.now()>new Date(m.dueAt).getTime()){
            m.status='failed';
            if (m.penalty){ if (m.penalty.coins) state.coins=Math.max(0,state.coins-m.penalty.coins); if (m.penalty.nerf) applyNerf(); }
          }
        }
      }
      state.lastSeenDay=t;
      state.urgentPlan=defaultUrgentPlan();
      save();
    }
  }
  function ensureDailyUniqueForToday(){
    const t=todayStr();
    if (state.lastDailyDateCreated===t) return;
    for (let i=0;i<state.missions.length;i++){
      const m=state.missions[i];
      if (m.type===TYPE.DAILY && m.status==='pending' && m.createdAt.slice(0,10)===t){
        state.lastDailyDateCreated=t; save(); return;
      }
    }
    const d=mkDaily(); state.missions.unshift(d);
    state.lastDailyDateCreated=t; save(); renderAll();
  }

  // Urgentes: plan del día (con 10%) — mantenemos sin spoilers
  function planUrgentForTodayIfNeeded(){
    const t=todayStr();
    const wk=weekKey(); const used=state.weeklyUrgents[wk]||0;
    if (state.urgentPlan && state.urgentPlan.date===t && state.urgentPlan.decided) return;
    const plan=defaultUrgentPlan(); plan.date=t; plan.decided=true;
    if (used<3 && Math.random()<0.10){
      const h = 3 + Math.floor(Math.random()*17); // 3..19
      const m = Math.floor(Math.random()*60);
      const fire = new Date(); fire.setHours(h,m,0,0);
      plan.willHave=true; plan.fireAt=fire.toISOString();
    }
    state.urgentPlan=plan; save();
  }
  function triggerScheduledUrgentIfTime(){
    const plan=state.urgentPlan;
    if (!plan || !plan.decided || !plan.willHave || plan.spawned || !plan.fireAt) return;
    const now=Date.now(), fireAt=new Date(plan.fireAt).getTime();
    if (now < fireAt) return;

    const wk=weekKey(); const used=state.weeklyUrgents[wk]||0;
    if (used>=3){ plan.spawned=true; save(); return; }

    const u=mkUrgent();
    const due=fireAt+5*3600*1000;
    if (now > due){
      u.createdAt=new Date(fireAt).toISOString();
      u.dueAt=new Date(due).toISOString();
      u.status='failed';
      if (u.penalty){
        if (u.penalty.coins) state.coins=Math.max(0,state.coins-u.penalty.coins);
        if (u.penalty.nerf) applyNerf();
        if (u.penalty.nextHarder) state.missions.unshift(harderClone(u));
      }
      state.missions.unshift(u);
      state.weeklyUrgents[wk]=(state.weeklyUrgents[wk]||0)+1;
      plan.spawned=true; save(); renderAll();
      showInfo('Urgente fallida (fuera de tiempo)','Llegaste después del vencimiento. Se aplicó la penalización.','red');
      return;
    }
    state.missions.unshift(u);
    state.weeklyUrgents[wk]=(state.weeklyUrgents[wk]||0)+1;
    plan.spawned=true; save(); renderAll();
    showPromptUrgentActivated();
  }

  // ---------- Acciones misión ----------
  function completeMission(m){
    if (!m || m.status!=='pending') return;
    if ((m.type===TYPE.CLASS || m.type===TYPE.FOCUS) && !m.accepted) return showInfo('Acepta primero','Debes aceptar la misión.','blue');
    m.status='completed';
    gainXP(m.baseXP||0);
    if (m.classXP) gainClassXP(m.classXP);
    state.coins += (m.baseCoins||0);
    decayNerf();
    // loot urgentes (igual que antes)
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
  function harderClone(m){
    const n=JSON.parse(JSON.stringify(m));
    n.id=uid(); n.status='pending'; n.accepted=true;
    n.title=m.title+' — Versión dura';
    n.dueAt=new Date(Date.now()+6*3600*1000).toISOString();
    n.penalty=null;
    const f=(m.penalty&&m.penalty.harderFactor)?m.penalty.harderFactor:1.25;
    n.requirements=n.requirements.map(r=>({label:r.label.replace(/(\d+)/g, x=>String(Math.ceil(parseInt(x,10)*f)))}));
    return n;
  }

  // ---------- Inventario helpers ----------
  function add2h(m){ if (!m.dueAt) return; m.dueAt=new Date(new Date(m.dueAt).getTime()+2*3600*1000).toISOString(); }
  function halfRequirements(m){
    if (!m.requirements) return;
    m.requirements=m.requirements.map(r=>({label:r.label.replace(/(\d+)/g, x=>String(Math.max(1, Math.floor(parseInt(x,10)/2))))}));
  }

  // ---------- Render seguro ----------
  const missionsList = $('#missionsList');
  const shopConsumibles = $('#shopConsumibles');
  const shopEsteticos = $('#shopEsteticos');
  const inventoryList = $('#inventoryList');

  const heroName = $('#heroName');
  const heroClass = $('#heroClass');
  const heroGoal = $('#heroGoal');

  const profileName = $('#profileName');
  const saveProfileBtn = $('#saveProfileBtn');
  const loadProfileBtn = $('#loadProfileBtn');
  const exportProfileBtn = $('#exportProfileBtn');
  const importProfileBtn = $('#importProfileBtn');
  const importProfileInput = $('#importProfileInput');

  function setHeader(){
    const need=xpNeedFor(state.level);
    const li=$('#levelInfo');
    if (li) li.textContent='Lvl '+state.level+' · '+state.xp+' / '+need+' XP · '+state.coins+'🪙 · '+VER;
    const fill=$('#xpFill');
    if (fill){ const pct=Math.max(0,Math.min(1,state.xp/need)); fill.style.width=(pct*100)+'%'; }
    document.title='Venator · '+VER;
  }
  function renderHeader(){
    setHeader();
    const set=(id,val)=>{ const el=$('#'+id); if(el) el.textContent=val; };
    set('pLvl',state.level); set('pXP',state.xp); set('pXPNeed',xpNeedFor(state.level));
    set('pCoins',state.coins); set('pNerf',state.expNerfCount||0);
    set('cLvl',state.classLevel); set('cXP',state.classXP); set('cXPNeed',cxpNeedFor(state.classLevel));
  }

  function urgentCounterNode(){
    const wk=weekKey(); const used=state.weeklyUrgents[wk]||0;
    const div=el('div','small');
    div.textContent='⚡ Urgentes semana: '+used+'/3';
    return div;
  }

  function iconImg(id){
    // Iconos inline controlados por nosotros — seguros
    const ICONS={
      time_potion:'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2NCIgaGVpZ2h0PSI2NCI+PGNpcmNsZSBjeD0iMzIiIGN5PSIzMiIgcj0iMzAiIGZpbGw9IiMwYzExMjAiIHN0cm9rZT0iIzZlYThmZiIgc3Ryb2tlLXdpZHRoPSIzIi8+PHRleHQgeD0iMzIiIHk9IjM4IiBmb250LXNpemU9IjI4IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjNmVhOGZmIj7wn5CRPC90ZXh0Pjwvc3ZnPg==',
      str_potion:'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2NCIgaGVpZ2h0PSI2NCI+PHJlY3QgeD0iNiIgeT0iNiIgd2lkdGg9IjUyIiBoZWlnaHQ9IjUyIiByeD0iMTAiIGZpbGw9IiMwYzExMjAiIHN0cm9rZT0iI2E2NmJmZiIgc3Ryb2tlLXdpZHRoPSIzIi8+PHRleHQgeD0iMzIiIHk9IjQwIiBmb250LXNpemU9IjI4IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjYTY2YmZmIj7ilqU8L3RleHQ+PC9zdmc+',
      exp_potion:'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2NCIgaGVpZ2h0PSI2NCI+PGNpcmNsZSBjeD0iMzIiIGN5PSIzMiIgcj0iMzAiIGZpbGw9IiMwYzExMjAiIHN0cm9rZT0iIzZlYThmZiIgc3Ryb2tlLXdpZHRoPSIzIi8+PHRleHQgeD0iMzIiIHk9IjM4IiBmb250LXNpemU9IjI0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjNmVhOGZmIj5YUDwvdGV4dD48L3N2Zz4=',
      cure:'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2NCIgaGVpZ2h0PSI2NCI+PHJlY3QgeD0iNiIgeT0iNiIgd2lkdGg9IjUyIiBoZWlnaHQ9IjUyIiByeD0iMTAiIGZpbGw9IiMwYzExMjAiIHN0cm9rZT0iIzVjZmZjMCIgc3Ryb2tlLXdpZHRoPSIzIi8+PHRleHQgeD0iMzIiIHk9IjQwIiBmb250LXNpemU9IjI2IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjNWNmZmMwIj7imJg8L3RleHQ+PC9zdmc+'
    };
    const img=document.createElement('img');
    img.className='icon';
    img.alt='';
    img.src=ICONS[id] || ICONS.time_potion;
    return img;
  }

  function missionCard(m){
    const li=el('li','card'); li.setAttribute('data-id',m.id);

    const h4=el('h4');
    const titleSpan=el('span','',m.title);
    const typeSpan=el('span','small',' ['+(m.type===TYPE.DAILY?'Diaria': m.type===TYPE.CLASS?'Clase': m.type===TYPE.URGENT?'Urgente':'Focus')+']');
    h4.appendChild(titleSpan); h4.appendChild(typeSpan);
    li.appendChild(h4);

    if (m.desc){ const d=el('div','small',m.desc); li.appendChild(d); }

    if (m.dueAt){
      const tdiv=el('div','small');
      const label=el('span','', '⏳ ');
      const timer=el('span','timer', fmt(new Date(m.dueAt).getTime()-Date.now()));
      tdiv.appendChild(label); tdiv.appendChild(timer);
      li.appendChild(tdiv);
    }

    const reward=el('div','small');
    reward.textContent='Recompensa: '+(m.baseXP||0)+' XP, '+(m.baseCoins||0)+'🪙'+(m.classXP?' · '+m.classXP+' XP clase':'');
    li.appendChild(reward);

    // requisitos
    (m.requirements||[]).forEach(r=>{
      const row=el('div','small','• '+r.label); // texto plano
      li.appendChild(row);
    });

    // pociones contexto (seguros)
    if (m.status==='pending'){
      const potRow=el('div','btnrow');
      let added=false;
      if (state.inventory.time_potion>0 && m.dueAt){
        const b=el('button','ghost','+2h'); b.setAttribute('data-act','use_time'); b.setAttribute('data-id',m.id);
        b.prepend(iconImg('time_potion'));
        potRow.appendChild(b); added=true;
      }
      if (state.inventory.str_potion>0 && m.requirements && m.requirements.length){
        const b=el('button','ghost','½ req'); b.setAttribute('data-act','use_str'); b.setAttribute('data-id',m.id);
        b.prepend(iconImg('str_potion'));
        potRow.appendChild(b); added=true;
      }
      if (added) li.appendChild(potRow);
    }

    const btns=el('div','btnrow');
    if ((m.type===TYPE.CLASS || m.type===TYPE.FOCUS) && !m.accepted){
      const a=el('button',null,'Aceptar'); a.setAttribute('data-act','accept'); a.setAttribute('data-id',m.id); btns.appendChild(a);
      const r=el('button','ghost','Rechazar'); r.setAttribute('data-act','reject'); r.setAttribute('data-id',m.id); btns.appendChild(r);
    }
    const done=el('button',null,'Marcar completada'); done.setAttribute('data-act','done'); done.setAttribute('data-id',m.id); btns.appendChild(done);
    const fail=el('button','ghost','Fallar'); fail.setAttribute('data-act','fail'); fail.setAttribute('data-id',m.id); btns.appendChild(fail);
    li.appendChild(btns);

    return li;
  }

  function renderMissions(){
    if (!missionsList) return;
    missionsList.textContent='';
    // Cabecera: botones + contador urgentes
    const head=el('li','card');
    const row=el('div','btnrow');
    const bFocus=el('button'); bFocus.id='newFocusBtnSmall'; bFocus.textContent='+ Nueva misión Focus';
    const bClass=el('button'); bClass.id='newClassBtnSmall'; bClass.textContent='+ Misión de Clase';
    row.appendChild(bFocus); row.appendChild(bClass);
    head.appendChild(row);
    head.appendChild(urgentCounterNode());
    missionsList.appendChild(head);

    const pend=state.missions.filter(x=>x.status==='pending');
    const hist=state.missions.filter(x=>x.status!=='pending').slice(0,8);
    pend.forEach(m=>missionsList.appendChild(missionCard(m)));
    if (hist.length){
      const sep=el('li','card'); sep.appendChild(el('div','small','Histórico reciente')); missionsList.appendChild(sep);
      hist.forEach(m=>missionsList.appendChild(missionCard(m)));
    }
  }

  function renderShop(){
    if (!shopConsumibles || !shopEsteticos || !inventoryList) return;
    shopConsumibles.textContent=''; shopEsteticos.textContent=''; inventoryList.textContent='';

    const SHOP={
      consumibles:[
        {id:'time_potion', name:'Poción de tiempo (+2h)', desc:'Amplía el tiempo de una misión activa.', price:30},
        {id:'str_potion',  name:'Poción de fuerza (1/2 requisitos)', desc:'Reduce a la mitad los números de la misión.', price:40},
        {id:'exp_potion',  name:'Poción de EXP (+20% 30 min)', desc:'Ganas +20% EXP durante 30 min.', price:50},
        {id:'cure',        name:'Curas (quita nerfeo EXP)', desc:'Elimina el -20% de EXP acumulado.', price:20}
      ],
      esteticos:[
        {id:'equip_dagas',       name:'Dagas dobles',     desc:'Cosmético', price:60},
        {id:'equip_arco_rojo',   name:'Arco rojo',        desc:'Cosmético', price:80},
        {id:'equip_gafas',       name:'Gafas de combate', desc:'Cosmético', price:40},
        {id:'equip_ropa_negra',  name:'Ropa negra',       desc:'Cosmético', price:70}
      ]
    };

    // helper tarjeta tienda segura
    function shopCard(it){
      const li=el('li','card');
      const row=el('div','itemrow');
      row.appendChild(iconImg(it.id));
      const h=el('h4',null, it.name+'  ');
      const badge=el('span','badge','🪙 '+it.price);
      h.appendChild(badge);
      row.appendChild(h);
      li.appendChild(row);
      li.appendChild(el('div','small', it.desc));
      const btns=el('div','btnrow');
      const b=el('button',null,'Comprar'); b.setAttribute('data-buy',it.id);
      btns.appendChild(b);
      li.appendChild(btns);
      return li;
    }

    SHOP.consumibles.forEach(it=> shopConsumibles.appendChild(shopCard(it)));
    SHOP.esteticos.forEach(it=> shopEsteticos.appendChild(shopCard(it)));

    // Inventario
    Object.keys(state.inventory).forEach(k=>{
      const count=state.inventory[k]; if(!count) return;
      const pretty = k==='time_potion'?'Poción de tiempo':k==='str_potion'?'Poción de fuerza':k==='exp_potion'?'Poción de EXP':k==='cure'?'Curas':k;
      const li=el('li','card');
      const row=el('div','itemrow'); row.appendChild(iconImg(k));
      row.appendChild(el('h4',null, pretty+' × '+count));
      li.appendChild(row);
      const btns=el('div','btnrow');
      if (k==='exp_potion'){ const b=el('button',null,'Usar (+20% 30min)'); b.setAttribute('data-use-global','exp_potion'); btns.appendChild(b); }
      else if (k==='cure'){ const b=el('button',null,'Usar (quitar nerf)'); b.setAttribute('data-use-global','cure'); btns.appendChild(b); }
      else btns.appendChild(el('div','small','Úsala desde la tarjeta de misión'));
      li.appendChild(btns);
      inventoryList.appendChild(li);
    });

    // lista de perfiles
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

  // ---------- Perfiles ----------
  function getProfiles(){ try{ return JSON.parse(localStorage.getItem(LS_PROFILES)) || {}; }catch(_){ return {}; } }
  function setProfiles(p){ localStorage.setItem(LS_PROFILES, JSON.stringify(p)); }
  function refreshProfileList(){
    const span=document.getElementById('profileList'); if(!span) return;
    const names=Object.keys(getProfiles());
    span.textContent = names.length? names.join(', ') : '(vacío)';
  }

  // ---------- Tabs ----------
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
  }

  // ---------- LÍMITES DIARIOS ----------
  function canMakeFocus(){ return state.dailyCounters && state.dailyCounters.focusMade < 2; }
  function incFocus(){ state.dailyCounters.focusMade++; save(); }
  function canMakeClass(){ return state.dailyCounters && state.dailyCounters.classMade < 2; }
  function incClass(){ state.dailyCounters.classMade++; save(); }

  // ---------- Delegación de clicks ----------
  document.addEventListener('click', function(e){
    const t=e.target.closest('button'); if(!t) return;

    // Crear Focus (limitado a 2/día)
    if (t.id==='newFocusBtnSmall' || t.id==='newFocusBtn'){
      if (!canMakeFocus()) return showInfo('Límite diario','Solo puedes crear 2 Focus al día.','blue');
      const zone=state.hero.goal||'abdomen';
      const f=mkFocus(zone); state.missions.unshift(f); incFocus(); save(); renderAll(); showPromptAcceptReject(f,'blue'); return;
    }

    // Crear Clase manual (limitado a 2/día)
    if (t.id==='newClassBtnSmall' || t.id==='newClassBtn'){
      if (!canMakeClass()) return showInfo('Límite diario','Solo puedes crear 2 misiones de clase al día.','purple');
      const c=state.hero.cls||'Asesino';
      const m=mkClassMission(c); state.missions.unshift(m); incClass(); save(); renderAll(); showPromptAcceptReject(m,'purple'); return;
    }

    // Comprar en tienda
    const buy=t.getAttribute('data-buy');
    if (buy){
      const ALL=[
        {id:'time_potion', price:30},{id:'str_potion', price:40},{id:'exp_potion', price:50},{id:'cure', price:20},
        {id:'equip_dagas', price:60},{id:'equip_arco_rojo', price:80},{id:'equip_gafas', price:40},{id:'equip_ropa_negra', price:70}
      ];
      const it=ALL.find(x=>x.id===buy); if(!it) return;
      if (state.coins < it.price) return alert('No tienes monedas suficientes');
      state.coins -= it.price;
      if (buy.indexOf('equip_')===0){
        if (state.equipment.indexOf(buy)===-1) state.equipment.push(buy);
      } else {
        state.inventory[buy]=(state.inventory[buy]||0)+1;
      }
      save(); renderAll(); return;
    }

    // Usos globales de inventario
    const g=t.getAttribute('data-use-global');
    if (g==='exp_potion'){
      if ((state.inventory.exp_potion||0)>0){
        state.expBuffUntil = Date.now() + 30*60*1000; state.inventory.exp_potion--; save(); renderAll();
        showInfo('Poción de EXP','Durante 30 min ganas +20% EXP.','blue');
      } else alert('No tienes Poción de EXP');
      return;
    }
    if (g==='cure'){
      if ((state.inventory.cure||0)>0){
        state.expNerfCount=0; state.inventory.cure--; save(); renderAll();
        showInfo('Curas','Nerf de EXP eliminado.','blue');
      } else alert('No tienes Curas');
      return;
    }

    // Acciones sobre misión
    const id=t.getAttribute('data-id'); const act=t.getAttribute('data-act');
    if (id&&act){
      const m=state.missions.find(x=>x.id===id); if(!m) return;
      if (act==='accept'){ if (m.type!=='urgent'){ m.accepted=true; save(); renderAll(); } return; }
      if (act==='reject'){ if (m.type!=='urgent'){ m.status='rejected'; save(); renderAll(); } return; }
      if (act==='done'){ completeMission(m); return; }
      if (act==='fail'){ failMission(m); return; }
      if (act==='use_time'){
        if ((state.inventory.time_potion||0)>0){ add2h(m); state.inventory.time_potion--; save(); renderAll(); showInfo('Poción de tiempo','+2h aplicadas a '+m.title); }
        else alert('No tienes Poción de tiempo');
        return;
      }
      if (act==='use_str'){
        if ((state.inventory.str_potion||0)>0){ halfRequirements(m); state.inventory.str_potion--; save(); renderAll(); showInfo('Poción de fuerza','Requisitos a la mitad en '+m.title); }
        else alert('No tienes Poción de fuerza');
        return;
      }
    }

    // Perfiles (igual que tu v13s7c)
    if (t.id==='saveProfileBtn'){
      const name=(profileName&&profileName.value||'').trim();
      if (!name) return alert('Pon un nombre de perfil');
      const snapshot=JSON.parse(JSON.stringify(state));
      const profiles=getProfiles(); profiles[name]=snapshot; setProfiles(profiles);
      refreshProfileList(); alert('Perfil guardado: '+name); return;
    }
    if (t.id==='loadProfileBtn'){
      const name=(profileName&&profileName.value||'').trim();
      if (!name) return alert('Pon un nombre de perfil');
      const profiles=getProfiles(); if(!profiles[name]) return alert('No existe el perfil: '+name);
      state = migrateShape(JSON.parse(JSON.stringify(profiles[name])));
      save(); renderAll(); alert('Perfil cargado: '+name); return;
    }
    if (t.id==='exportProfileBtn'){
      const name=(profileName&&profileName.value.trim())||'perfil';
      const blob=new Blob([JSON.stringify({name,state},null,2)],{type:'application/json'});
      const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name+'.json'; a.click(); return;
    }
    if (t.id==='importProfileBtn'){
      if (importProfileInput) importProfileInput.click();
      return;
    }
  });

  // Importar perfil desde archivo
  if (importProfileInput) importProfileInput.addEventListener('change', e=>{
    const f=e.target.files[0]; if(!f) return;
    const r=new FileReader();
    r.onload=function(){
      try{
        const data=JSON.parse(r.result);
        if(data && data.state){
          state=migrateShape(data.state);
          save(); renderAll(); alert('Perfil importado: '+(data.name||'perfil'));
        } else alert('Archivo inválido');
      }catch(_){ alert('No se pudo leer el archivo'); }
    };
    r.readAsText(f);
  });

  // ---------- Auto-generación de misión de CLASE ----------
  function ensureClassMissionIfNone(){
    const hasPendingClass = state.missions.some(m=>m.type===TYPE.CLASS && m.status==='pending');
    if (!hasPendingClass){
      const c=state.hero.cls||'Asesino';
      const m=mkClassMission(c);
      state.missions.unshift(m);
      save();
      // no forzamos overlay aquí para no molestar en cada carga; el jugador puede aceptarla cuando la vea
    }
  }

  // ---------- Tick ----------
  function tick(){
    const now=Date.now(); let dirty=false;
    // timers
    document.querySelectorAll('#missionsList .card').forEach(card=>{
      const id=card.getAttribute('data-id'); if(!id) return;
      const m=state.missions.find(x=>x.id===id);
      const el=card.querySelector('.timer');
      if (m&&el&&m.dueAt) el.textContent=fmt(new Date(m.dueAt).getTime()-now);
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

  // ---------- Inicio ----------
  rolloverDailyIfNeeded();
  ensureDailyUniqueForToday();
  // urgentes (mantenemos la misma lógica de tu versión anterior)
  planUrgentForTodayIfNeeded();
  triggerScheduledUrgentIfTime();

  // Auto-clase si no hay pendiente
  ensureClassMissionIfNone();

  renderAll();
  setInterval(tick, 1000);

  // Perfil inputs
  if (heroName)  heroName.addEventListener('change', function(){ state.hero.name=this.value||'Amo'; save(); setHeader(); });
  if (heroClass) heroClass.addEventListener('change', function(){ state.hero.cls=this.value; save(); });
  if (heroGoal)  heroGoal.addEventListener('change', function(){ state.hero.goal=this.value; save(); });

})();
