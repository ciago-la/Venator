// === Altervenator v13s7b — diaria 1x/día + urgentes 10% programadas + tienda + Focus + usos inventario ===
(function(){
  const VER='v13s7b';

  // ---------- Error banner ----------
  window.addEventListener('error', e=>{
    const d=document.createElement('div');
    d.style.cssText='position:fixed;top:0;left:0;right:0;background:#300;color:#fff;padding:6px 10px;z-index:99999;font:12px monospace';
    d.textContent='JS ERROR: '+(e.message||e.filename||'');
    document.body.appendChild(d);
  });

  // ---------- Estado (misma clave para no perder progreso) ----------
  var LS='alter_v13s5';
  var CLASSES=['Guerrero','Asesino','Mago','Arquero','Espía','Maratón','Amigo del dragón','Saltamontes'];

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
    while(state.classXP >= cxpNeedFor(state.classLevel)){ state.classXP -= cxpNeedFor(state.classLevel); state.classLevel++; }
  }
  function applyNerf(){ state.expNerfCount = Math.min(9,(state.expNerfCount||0)+3); }
  function decayNerf(){ if (state.expNerfCount>0) state.expNerfCount--; }

  // ---------- Datos ----------
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
  function scaleTextForLevel(text, lvl){
    const factor = Math.pow(1.1, Math.max(0,lvl-1));
    let out = text.replace(/(\d+)\s*\/\s*(\d+)/g, (_,a,b)=>{
      const A=Math.max(1, Math.round(parseInt(a,10)*factor));
      const B=Math.max(1, Math.round(parseInt(b,10)*factor));
      return A+'/'+B;
    });
    out = out.replace(/(\d+)\s*(?=(?![^x]*×))/g, (m,p)=> String(Math.max(1, Math.round(parseInt(p,10)*factor))));
    out = out.replace(/(\d+)\s*s\b/g, (m,p)=> String(Math.max(1, Math.round(parseInt(p,10)*factor)))+' s');
    const extraRounds = Math.floor(state.level/3);
    out = out.replace(/×\s*(\d+)/g, (_,n)=> '× '+ (parseInt(n,10)+extraRounds));
    return out;
  }

  var URGENT_TPL=[
    {name:'Domador de Dragones', reqs:['Sprint 200 m × 5','Flexiones 40','Plancha 60 s','Prueba de clase (aleatoria)'], loot:['aliento_dragón','escamas_dragón','huevo_dragón','amigo_dragón','sangre_dragón']},
    {name:'Asesino de reyes', reqs:['Burpees 30','Sentadillas salto 30','Hollow hold 30 s','Prueba de clase (aleatoria)'], loot:['corona_maldita','cetro_poder','espada_triple','proteccion_princesa','colgante_reina']},
    {name:'Ciervo de mil ojos avistado', reqs:['Sprints 50 m × 10','Zancadas 20/20','Plancha lateral 30 s/lado','Prueba de clase (aleatoria)'], loot:['ojos_azules_3','cuerno_arbol_rojo','armadura_piel_magica','frasco_aliento_bosque','semilla_antigua']},
    {name:'Robo en la torre de maná', reqs:['Jumping jacks 80','Flexiones inclinadas 25','Planchas escaladas 40','Prueba de clase (aleatoria)'], loot:['pocion_mana_potente','libro_conjuros','daga_oscuridad','diente_fuego','llave_celda_oscura']},
    {name:'Asalto al coloso de hierro', reqs:['Sentadilla isométrica 60 s','Flexiones pike 20','Mountain climbers 60','Prueba de clase (aleatoria)'], loot:['armadura_voladora','botas_viento','maza_terremoto','latigo_azul','tunica_albores_alvaros']}
  ];

  // Tienda
  var SHOP={
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

  // Iconos mínimos
  var ICONS={
    time_potion:'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2NCIgaGVpZ2h0PSI2NCI+PGNpcmNsZSBjeD0iMzIiIGN5PSIzMiIgcj0iMzAiIGZpbGw9IiMwYzExMjAiIHN0cm9rZT0iIzZlYThmZiIgc3Ryb2tlLXdpZHRoPSIzIi8+PHRleHQgeD0iMzIiIHk9IjM4IiBmb250LXNpemU9IjI4IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjNmVhOGZmIj7wn5CRPC90ZXh0Pjwvc3ZnPg==',
    str_potion:'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2NCIgaGVpZ2h0PSI2NCI+PHJlY3QgeD0iNiIgeT0iNiIgd2lkdGg9IjUyIiBoZWlnaHQ9IjUyIiByeD0iMTAiIGZpbGw9IiMwYzExMjAiIHN0cm9rZT0iI2E2NmJmZiIgc3Ryb2tlLXdpZHRoPSIzIi8+PHRleHQgeD0iMzIiIHk9IjQwIiBmb250LXNpemU9IjI4IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjYTY2YmZmIj7ilqU8L3RleHQ+PC9zdmc+',
    exp_potion:'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2NCIgaGVpZ2h0PSI2NCI+PGNpcmNsZSBjeD0iMzIiIGN5PSIzMiIgcj0iMzAiIGZpbGw9IiMwYzExMjAiIHN0cm9rZT0iIzZlYThmZiIgc3Ryb2tlLXdpZHRoPSIzIi8+PHRleHQgeD0iMzIiIHk9IjM4IiBmb250LXNpemU9IjI0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjNmVhOGZmIj5YUDwvdGV4dD48L3N2Zz4=',
    cure:'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2NCIgaGVpZ2h0PSI2NCI+PHJlY3QgeD0iNiIgeT0iNiIgd2lkdGg9IjUyIiBoZWlnaHQ9IjUyIiByeD0iMTAiIGZpbGw9IiMwYzExMjAiIHN0cm9rZT0iIzVjZmZjMCIgc3Ryb2tlLXdpZHRoPSIzIi8+PHRleHQgeD0iMzIiIHk9IjQwIiBmb250LXNpemU9IjI2IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjNWNmZmMwIj7imJg8L3RleHQ+PC9zdmc+',
    equip_dagas:'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTIwIDYwIEw0MCA0MCBMIDM1IDM1IEwgMTUgNTUgWiIgZmlsbD0iIzZlYThmZiIvPjxwYXRoIGQ9Ik02MCAyMCBMNDAgNDAgTDQ1IDQ1IEw2NSAyNSBaIiBmaWxsPSIjYTY2YmZmIi8+PC9zdmc+',
    equip_arco_rojo:'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iOTAiIGhlaWdodD0iOTAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTIwIDgwIFE3MCA0NSAyMCAxMCIgZmlsbD0ibm9uZSIgc3Rya2U9IiNmZjVjN2EiIHN0cm9rZS13aWR0aD0iNiIvPjxsaW5lIHgxPSIyMCIgeTE9IjgwIiB4Mj0iMjAiIHkyPSIxMCIgc3Rya2U9IiNmZjVjN2EiIHN0cm9rZS13aWR0aD0iMiIvPjwvc3ZnPg==',
    equip_gafas:'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3QgeD0iNSIgeT0iOCIgd2lkdGg9IjI4IiBoZWlnaHQ9IjE2IiByeD0iNCIgZmlsbD0iIzZlYThmZiIvPjxyZWN0IHg9IjQ3IiB5PSI4IiB3aWR0aD0iMjgiIGhlaWdodD0iMTYiIHJ4PSI0IiBmaWxsPSIjNmVhOGZmIi8+PHJlY3QgeD0iMzMiIHk9IjE0IiB3aWR0aD0iMTQiIGhlaWdodD0iNCIgZmlsbD0iI2E2NmJmZiIvPjwvc3ZnPg==',
    equip_ropa_negra:'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTEwIDIwIEwzMCAxMCBMNTAgMjAgTDQ1IDU1IEwxNSA1NSBaIiBmaWxsPSIjMTIxODIyIiBzdHJva2U9IiM2ZWE4ZmYiIHN0cm9rZS13aWR0aD0iMiIvPjwvc3ZnPg=='
  };

  // ---------- Creadores ----------
  function mkDaily(){
    const now=new Date();
    const due=(now < today10()) ? new Date(Math.min(now.getTime()+14*3600*1000, endOfDay().getTime())) : endOfDay();
    const baseReqs = DAILY_ROTATION[now.getDay()];
    const reqs = baseReqs.map(s=>({label: scaleTextForLevel(s, state.level)}));
    return { id:uid(), type:TYPE.DAILY, title:'Misión diaria', desc:'Obligatoria de hoy.',
      createdAt: now.toISOString(), dueAt: due.toISOString(), status:'pending', accepted:true,
      baseXP:40, baseCoins:6, requirements:reqs, penalty:{coins:6, nerf:true} };
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
    return { id:uid(), type:TYPE.FOCUS, title:'Focus — '+zone, desc:'Sesión focalizada en '+zone,
      createdAt: now.toISOString(), dueAt: new Date(now.getTime()+8*3600*1000).toISOString(),
      status:'pending', accepted:false, baseXP:80, baseCoins:10, requirements:reqs,
      penalty:{coins:8, nerf:true, nextHarder:true, harderFactor:1.5} };
  }
  function mkUrgent(){
    const now=new Date(); const t=URGENT_TPL[Math.floor(Math.random()*URGENT_TPL.length)];
    return { id:uid(), type:TYPE.URGENT, title:'Misión urgente: '+t.name, desc:'Alta prioridad (no se puede rechazar).',
      createdAt: now.toISOString(), dueAt: new Date(now.getTime()+5*3600*1000).toISOString(),
      status:'pending', accepted:true, baseXP:120, baseCoins:15,
      requirements:t.reqs.map(x=>({label:x})),
      penalty:{coins:10, nerf:true, nextHarder:true, harderFactor:1.25}, loot:t.loot };
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

  // ---------- Overlays ----------
  var overlay=document.getElementById('overlay'), card=document.getElementById('overlayCard');
  var ovTitle=document.getElementById('ovTitle'), ovBody=document.getElementById('ovBody'), ovButtons=document.getElementById('ovButtons');
  function showInfo(title, body, color){
    if (!overlay) return;
    card.className='overlay-card '+(color||'blue');
    ovTitle.textContent=title; ovBody.textContent=body; ovButtons.innerHTML='';
    const ok=document.createElement('button'); ok.textContent='Aceptar'; ok.onclick=()=>overlay.classList.add('hidden'); ovButtons.appendChild(ok);
    overlay.classList.remove('hidden');
  }
  function showPromptAcceptReject(m, color){
    if (!overlay) return;
    card.className='overlay-card '+(color||'blue');
    ovTitle.textContent='Nueva misión';
    ovBody.textContent='Tienes una misión: '+m.title+' — ¿Aceptas?';
    ovButtons.innerHTML='';
    const ok=document.createElement('button'); ok.textContent='Aceptar';
    ok.onclick=function(){ m.accepted=true; save(); renderAll(); overlay.classList.add('hidden'); };
    const ko=document.createElement('button'); ko.textContent='Rechazar'; ko.className='ghost';
    ko.onclick=function(){ m.status='rejected'; save(); renderAll(); overlay.classList.add('hidden'); };
    ovButtons.appendChild(ok); ovButtons.appendChild(ko);
    overlay.classList.remove('hidden');
  }
  function showPromptUrgentActivated(){ showInfo('¡Misión urgente!','Se ha activado una misión urgente para hoy.','red'); }

  // ---------- Reglas diaria 1x/día ----------
  function rolloverDailyIfNeeded(){
    const t=todayStr();
    if (state.lastSeenDay!==t){
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

  // ---------- Urgentes 10% programadas (sin spoilers) ----------
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

  // ---------- Inventario helpers ----------
  function add2h(m){ if (!m.dueAt) return; m.dueAt=new Date(new Date(m.dueAt).getTime()+2*3600*1000).toISOString(); }
  function halfRequirements(m){
    if (!m.requirements) return;
    m.requirements=m.requirements.map(r=>({label:r.label.replace(/(\d+)/g, x=>String(Math.max(1, Math.floor(parseInt(x,10)/2))))}));
  }

  // ---------- Render ----------
  var missionsList=document.getElementById('missionsList');
  var shopConsumibles=document.getElementById('shopConsumibles');
  var shopEsteticos=document.getElementById('shopEsteticos');
  var inventoryList=document.getElementById('inventoryList');
  var heroName=document.getElementById('heroName');
  var heroClass=document.getElementById('heroClass');
  var heroGoal=document.getElementById('heroGoal');

  function setHeader(){
    const need=xpNeedFor(state.level);
    const li=document.getElementById('levelInfo');
    if (li) li.textContent='Lvl '+state.level+' · '+state.xp+' / '+need+' XP · '+state.coins+'🪙 · '+VER;
    const fill=document.getElementById('xpFill');
    if (fill){ const pct=Math.max(0,Math.min(1,state.xp/need)); fill.style.width=(pct*100)+'%'; }
    document.title='Venator · '+VER;
  }
  function renderHeader(){
    setHeader();
    const set=(id,val)=>{ const el=document.getElementById(id); if(el) el.textContent=val; };
    set('pLvl',state.level); set('pXP',state.xp); set('pXPNeed',xpNeedFor(state.level));
    set('pCoins',state.coins); set('pNerf',state.expNerfCount||0);
    set('cLvl',state.classLevel); set('cXP',state.classXP); set('cXPNeed',cxpNeedFor(state.classLevel));
  }
  function icon(id){ const src=ICONS[id]||ICONS.time_potion; return '<img class="icon" alt="" src="'+src+'"/>'; }

  function urgentCounterUI(){
    const wk=weekKey(); const used=state.weeklyUrgents[wk]||0;
    return '<div class="small">⚡ Urgentes semana: <strong>'+used+'/3</strong></div>';
  }

  function missionCard(m){
    const li=document.createElement('li'); li.className='card'; li.setAttribute('data-id',m.id);
    const typeLabel = m.type===TYPE.DAILY ? 'Diaria' : (m.type===TYPE.CLASS?'Clase': (m.type===TYPE.URGENT?'Urgente':'Focus'));
    const dueTxt = m.dueAt? '<div class="small">⏳ <span class="timer">'+fmt(new Date(m.dueAt).getTime()-Date.now())+'</span></div>' : '';
    const reqHtml = (m.requirements||[]).map(r=>'<div class="small">• '+r.label+'</div>').join('');
    let potions='';
    if (m.status==='pending'){
      if (state.inventory.time_potion>0 && m.dueAt) potions+='<button class="ghost" data-act="use_time" data-id="'+m.id+'">'+icon('time_potion')+'+2h</button> ';
      if (state.inventory.str_potion>0 && m.requirements && m.requirements.length) potions+='<button class="ghost" data-act="use_str" data-id="'+m.id+'">'+icon('str_potion')+'½ req</button> ';
    }
    let actions='';
    if ((m.type===TYPE.CLASS || m.type===TYPE.FOCUS) && !m.accepted){
      actions+='<button data-act="accept" data-id="'+m.id+'">Aceptar</button> ';
      actions+='<button class="ghost" data-act="reject" data-id="'+m.id+'">Rechazar</button> ';
    }
    actions+='<button data-act="done" data-id="'+m.id+'">Marcar completada</button> ';
    actions+='<button class="ghost" data-act="fail" data-id="'+m.id+'">Fallar</button>';
    li.innerHTML =
      '<h4>'+m.title+' <span class="small">['+typeLabel+']</span></h4>'+
      '<div class="small">'+(m.desc||'')+'</div>'+ dueTxt+
      '<div class="small">Recompensa: '+(m.baseXP||0)+' XP, '+(m.baseCoins||0)+'🪙'+(m.classXP?' · '+m.classXP+' XP clase':'')+'</div>'+
      reqHtml+
      (potions?('<div class="btnrow">'+potions+'</div>'):'')+
      '<div class="btnrow">'+actions+'</div>';
    return li;
  }

  function renderMissions(){
    if (!missionsList) return;
    missionsList.innerHTML='';
    const head=document.createElement('li');
    head.className='card';
    head.innerHTML='<div class="btnrow"><button id="newFocusBtnSmall">+ Nueva misión Focus</button></div>'+urgentCounterUI();
    missionsList.appendChild(head);
    const pend=state.missions.filter(x=>x.status==='pending');
    const hist=state.missions.filter(x=>x.status!=='pending').slice(0,8);
    pend.forEach(m=>missionsList.appendChild(missionCard(m)));
    if (hist.length){
      const sep=document.createElement('li'); sep.className='card'; sep.innerHTML='<div class="small">Histórico reciente</div>'; missionsList.appendChild(sep);
      hist.forEach(m=>missionsList.appendChild(missionCard(m)));
    }
  }

  function renderShop(){
    if (!shopConsumibles || !shopEsteticos || !inventoryList) return;
    shopConsumibles.innerHTML=''; shopEsteticos.innerHTML=''; inventoryList.innerHTML='';
    SHOP.consumibles.forEach(function(it){
      const li=document.createElement('li'); li.className='card';
      li.innerHTML='<div class="itemrow">'+icon(it.id)+'<h4>'+it.name+' <span class="badge">🪙 '+it.price+'</span></h4></div><div class="small">'+it.desc+'</div><div class="btnrow"><button data-buy="'+it.id+'">Comprar</button></div>';
      shopConsumibles.appendChild(li);
    });
    SHOP.esteticos.forEach(function(it){
      const li=document.createElement('li'); li.className='card';
      li.innerHTML='<div class="itemrow">'+icon(it.id)+'<h4>'+it.name+' <span class="badge">🪙 '+it.price+'</span></h4></div><div class="small">'+it.desc+'</div><div class="btnrow"><button data-buy="'+it.id+'">Comprar</button></div>';
      shopEsteticos.appendChild(li);
    });
    // Inventario (con usos globales)
    Object.keys(state.inventory).forEach(function(k){
      const count=state.inventory[k]; if(!count) return;
      const pretty = k==='time_potion'?'Poción de tiempo':k==='str_potion'?'Poción de fuerza':k==='exp_potion'?'Poción de EXP':k==='cure'?'Curas':k;
      const li=document.createElement('li'); li.className='card';
      let actions='';
      if (k==='exp_potion') actions+='<button data-use-global="exp_potion">Usar (+20% 30min)</button>';
      else if (k==='cure') actions+='<button data-use-global="cure">Usar (quitar nerf)</button>';
      else actions+='<div class="small">Úsala desde la tarjeta de misión</div>';
      li.innerHTML='<div class="itemrow">'+icon(k)+'<h4>'+pretty+' × '+count+'</h4></div><div class="btnrow">'+actions+'</div>';
      inventoryList.appendChild(li);
    });
  }

  function renderProfile(){
    if (heroName) heroName.value=state.hero.name||'';
    if (heroClass){
      heroClass.innerHTML=''; CLASSES.forEach(c=>{ const o=document.createElement('option'); o.value=c; o.textContent=c; heroClass.appendChild(o); });
      if (state.hero.cls) heroClass.value=state.hero.cls;
    }
    if (heroGoal) heroGoal.value=state.hero.goal||'';
  }

  function renderAll(){ renderHeader(); renderMissions(); renderShop(); renderProfile(); }

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

  // ---------- Delegación de clicks ----------
  document.addEventListener('click', function(e){
    const t=e.target.closest('button'); if(!t) return;

    // Crear Focus
    if (t.id==='newFocusBtnSmall' || t.id==='newFocusBtn'){
      const zone=state.hero.goal||'abdomen';
      const f=mkFocus(zone); state.missions.unshift(f); save(); renderAll(); showPromptAcceptReject(f,'blue'); return;
    }

    // Comprar en tienda
    const buy=t.getAttribute('data-buy');
    if (buy){
      const all=[].concat(SHOP.consumibles, SHOP.esteticos);
      const it=all.find(x=>x.id===buy); if(!it) return;
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
  });

  // ---------- Tick ----------
  function tick(){
    const now=Date.now(); let dirty=false;
    // Timers y expiraciones
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
    // Activación de urgente programada si toca
    triggerScheduledUrgentIfTime();
    if (dirty){ save(); renderAll(); }
  }

  // ---------- Inicio ----------
  rolloverDailyIfNeeded();
  ensureDailyUniqueForToday();
  planUrgentForTodayIfNeeded();
  triggerScheduledUrgentIfTime();
  renderAll();
  setInterval(tick, 1000);

  // Perfil inputs (mínimos)
  if (heroName)  heroName.addEventListener('change', function(){ state.hero.name=this.value||'Amo'; save(); setHeader(); });
  if (heroClass) heroClass.addEventListener('change', function(){ state.hero.cls=this.value; save(); });
  if (heroGoal)  heroGoal.addEventListener('change', function(){ state.hero.goal=this.value; save(); });

})();
