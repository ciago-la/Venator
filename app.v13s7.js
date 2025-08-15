// === Altervenator v13s7 — Diaria 1x/día + Urgentes 10% programadas 03:00–19:00 ===
(function(){
  const VER='v13s7';

  // ---------- Catch visible ----------
  window.addEventListener('error', e=>{
    const d=document.createElement('div');
    d.style.cssText='position:fixed;top:0;left:0;right:0;background:#300;color:#fff;padding:6px 10px;z-index:99999;font:12px monospace';
    d.textContent='JS ERROR: '+(e.message||e.filename||'');
    document.body.appendChild(d);
  });

  // ---------- Estado ----------
  // Mantengo la misma clave para NO perder progreso
  var LS='alter_v13s5';
  var LS_PROFILES='alter_profiles_v1';
  var CLASSES=['Guerrero','Asesino','Mago','Arquero','Espía','Maratón','Amigo del dragón','Saltamontes'];

  var state = load() || {
    hero:{name:'Amo', cls:'Asesino', goal:'abdomen'},
    xp:0, level:1, coins:0,
    classXP:0, classLevel:1,
    expBuffUntil:0, expNerfCount:0,
    missions:[],
    weeklyUrgents:{},
    inventory:{ time_potion:1, str_potion:0, exp_potion:0, cure:0 },
    equipment:[],
    lastSeenDay:null,
    // NUEVO v13s7:
    lastDailyDateCreated:null,               // 'YYYY-MM-DD' de la última diaria creada
    urgentPlan:{date:null, decided:false, willHave:false, fireAt:null, spawned:false} // plan del día
  };

  // ---------- Utils ----------
  function save(){ localStorage.setItem(LS, JSON.stringify(state)); }
  function load(){ try{return JSON.parse(localStorage.getItem(LS));}catch(_){return null;} }
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
    while(state.xp >= xpNeedFor(state.level)){
      state.xp -= xpNeedFor(state.level);
      state.level++;
    }
  }
  function gainClassXP(base){
    state.classXP += base;
    while(state.classXP >= cxpNeedFor(state.classLevel)){
      state.classXP -= cxpNeedFor(state.classLevel);
      state.classLevel++;
    }
  }
  function applyNerf(){ state.expNerfCount = Math.min(9,(state.expNerfCount||0)+3); }
  function decayNerf(){ if (state.expNerfCount>0) state.expNerfCount--; }

  // ---------- Datos base ----------
  var TYPE={DAILY:'daily', CLASS:'class', URGENT:'urgent', FOCUS:'focus'};

  // Rotación diaria (texto base; se escalará como en v13s6)
  var DAILY_ROTATION={
    1:['Flexiones 5 × 2','Sentadillas 10 × 2','Abdominales 20 × 2'],
    2:['Dominadas 5/3','Zancadas 4/4','Puente de glúteo 7'],
    3:['Fondos de tríceps 5','Patada lateral 3 × 2','Plancha 10 s'],
    4:['Flexiones 5 × 2','Sentadillas 10 × 2','Abdominales 20 × 2'],
    5:['Dominadas 5/3','Zancadas 4/4','Puente de glúteo 7'],
    6:['Fondos de tríceps 5','Patada lateral 3 × 2','Plancha 10 s'],
    0:['Elevación de piernas 5 × 2','Saco/sombra (combo)','Sombra intensa 30 s']
  };

  // Escalado de Diaria (igual que v13s6)
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

  // Urgentes
  var URGENT_TPL=[
    {name:'Domador de Dragones', reqs:['Sprint 200 m × 5','Flexiones 40','Plancha 60 s','Prueba de clase (aleatoria)'], loot:['aliento_dragón','escamas_dragón','huevo_dragón','amigo_dragón','sangre_dragón']},
    {name:'Asesino de reyes', reqs:['Burpees 30','Sentadillas salto 30','Hollow hold 30 s','Prueba de clase (aleatoria)'], loot:['corona_maldita','cetro_poder','espada_triple','proteccion_princesa','colgante_reina']},
    {name:'Ciervo de mil ojos avistado', reqs:['Sprints 50 m × 10','Zancadas 20/20','Plancha lateral 30 s/lado','Prueba de clase (aleatoria)'], loot:['ojos_azules_3','cuerno_arbol_rojo','armadura_piel_magica','frasco_aliento_bosque','semilla_antigua']},
    {name:'Robo en la torre de maná', reqs:['Jumping jacks 80','Flexiones inclinadas 25','Planchas escaladas 40','Prueba de clase (aleatoria)'], loot:['pocion_mana_potente','libro_conjuros','daga_oscuridad','diente_fuego','llave_celda_oscura']},
    {name:'Asalto al coloso de hierro', reqs:['Sentadilla isométrica 60 s','Flexiones pike 20','Mountain climbers 60','Prueba de clase (aleatoria)'], loot:['armadura_voladora','botas_viento','maza_terremoto','latigo_azul','tunica_albores_alvaros']}
  ];

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
  function mkUrgent(){
    const now=new Date(); const t=URGENT_TPL[Math.floor(Math.random()*URGENT_TPL.length)];
    return {
      id:uid(), type:TYPE.URGENT, title:'Misión urgente: '+t.name, desc:'Alta prioridad (no se puede rechazar).',
      createdAt: now.toISOString(), dueAt: new Date(now.getTime()+5*3600*1000).toISOString(),
      status:'pending', accepted:true,
      baseXP:120, baseCoins:15,
      requirements:t.reqs.map(x=>({label:x})),
      penalty:{coins:10, nerf:true, nextHarder:true, harderFactor:1.25},
      loot:t.loot
    };
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

  // ---------- Overlay ----------
  var overlay=document.getElementById('overlay'), card=document.getElementById('overlayCard');
  var ovTitle=document.getElementById('ovTitle'), ovBody=document.getElementById('ovBody'), ovButtons=document.getElementById('ovButtons');
  function showInfo(title, body, color){
    card.className='overlay-card '+(color||'blue');
    ovTitle.textContent=title; ovBody.textContent=body; ovButtons.innerHTML='';
    const ok=document.createElement('button'); ok.textContent='Aceptar'; ok.onclick=hideOverlay; ovButtons.appendChild(ok);
    overlay.classList.remove('hidden');
  }
  function showPromptUrgentActivated(){
    card.className='overlay-card red';
    ovTitle.textContent='¡Misión urgente!';
    ovBody.textContent='Se ha activado una misión urgente programada para hoy.';
    ovButtons.innerHTML='';
    const ok=document.createElement('button'); ok.textContent='Aceptar'; ok.onclick=hideOverlay; ovButtons.appendChild(ok);
    overlay.classList.remove('hidden');
  }
  function hideOverlay(){ overlay.classList.add('hidden'); }

  // ---------- Lógica Diaria: solo 1 por día ----------
  function rolloverDailyIfNeeded(){
    const t=todayStr();
    if (state.lastSeenDay!==t){
      // si quedaba diaria de ayer pendiente y vencida, aplicar penalización (esto ya lo hacía v13s6)
      for (let i=0;i<state.missions.length;i++){
        const m=state.missions[i];
        if (m.type===TYPE.DAILY && m.status==='pending' && m.createdAt.slice(0,10)!==t){
          if (Date.now()>new Date(m.dueAt).getTime()){
            m.status='failed';
            if (m.penalty){
              if (m.penalty.coins) state.coins=Math.max(0,state.coins-m.penalty.coins);
              if (m.penalty.nerf) applyNerf();
            }
          }
        }
      }
      state.lastSeenDay=t;
      // reset plan de urgentes al cambiar de día
      state.urgentPlan={date:null, decided:false, willHave:false, fireAt:null, spawned:false};
      save();
    }
  }
  function ensureDailyUniqueForToday(){
    const t=todayStr();
    // si ya creamos una diaria hoy, no hagas nada
    if (state.lastDailyDateCreated===t) return;
    // si ya existe una daily pending de hoy, marca la fecha y listo
    for (let i=0;i<state.missions.length;i++){
      const m=state.missions[i];
      if (m.type===TYPE.DAILY && m.status==='pending' && m.createdAt.slice(0,10)===t){
        state.lastDailyDateCreated=t; save(); return;
      }
    }
    // no hay diaria de hoy → crea UNA
    const d=mkDaily(); state.missions.unshift(d);
    state.lastDailyDateCreated=t; save(); renderAll();
  }

  // ---------- Lógica Urgentes v13s7 ----------
  // 10% diario decidido "a medianoche". Si no estabas conectado, se decide al abrir (una vez por día).
  // Si willHave=true → programamos hora aleatoria 03:00–19:00 local y se activará sola al llegar.
  function planUrgentForTodayIfNeeded(){
    const t=todayStr();
    const wk=weekKey(); const used=state.weeklyUrgents[wk]||0;
    if (state.urgentPlan.date===t && state.urgentPlan.decided) return; // ya hay plan para hoy

    // crea plan nuevo
    const plan={date:t, decided:true, willHave:false, fireAt:null, spawned:false};
    if (used<3){
      // 10%
      if (Math.random() < 0.10){
        // hora aleatoria 03:00–19:00
        const h = 3 + Math.floor(Math.random()*17); // 3..19
        const m = Math.floor(Math.random()*60);
        const fire = new Date();
        fire.setHours(h,m,0,0);
        plan.willHave=true;
        plan.fireAt=fire.toISOString();
      }
    }
    state.urgentPlan=plan; save();
  }

  // Activa la urgente si es hora; si llega tarde y ya pasaron las 5h → falla y penaliza directa.
  function triggerScheduledUrgentIfTime(){
    const plan=state.urgentPlan;
    if (!plan || !plan.decided || !plan.willHave || plan.spawned || !plan.fireAt) return;

    const now = Date.now();
    const fireAt = new Date(plan.fireAt).getTime();
    if (now < fireAt) return; // aún no toca

    // toca activar
    const wk=weekKey(); const used=state.weeklyUrgents[wk]||0;
    if (used>=3){ // por si el tope cambió por otras vías
      plan.spawned=true; save(); return;
    }

    const u = mkUrgent();
    // si ya pasó el tiempo (fireAt + 5h), falla inmediata y penaliza
    const due = fireAt + 5*3600*1000;
    if (now > due){
      // simular que nació en fireAt y venció
      u.createdAt = new Date(fireAt).toISOString();
      u.dueAt     = new Date(due).toISOString();
      u.status    = 'failed';
      // penalización directa
      if (u.penalty){
        if (u.penalty.coins) state.coins=Math.max(0,state.coins-u.penalty.coins);
        if (u.penalty.nerf) applyNerf();
        if (u.penalty.nextHarder){
          // versión dura al fallar automáticamente
          state.missions.unshift(harderClone(u));
        }
      }
      state.missions.unshift(u);
      state.weeklyUrgents[wk]=(state.weeklyUrgents[wk]||0)+1;
      plan.spawned=true; save(); renderAll();
      showInfo('Urgente fallida (fuera de tiempo)','Llegaste después del vencimiento. Se aplicó la penalización.','red');
      return;
    }

    // activar normalmente (pendiente con 5h desde ahora)
    state.missions.unshift(u);
    state.weeklyUrgents[wk]=(state.weeklyUrgents[wk]||0)+1;
    plan.spawned=true; save(); renderAll();
    showPromptUrgentActivated();
  }

  // ---------- Acciones ----------
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

  // ---------- Render (cabecera y misiones) ----------
  var missionsList=document.getElementById('missionsList');
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

  function urgentCounterUI(){
    const wk=weekKey(); const used=state.weeklyUrgents[wk]||0;
    // También mostramos si hoy hay plan y a qué hora (solo para debug/jugador: lo dejamos discreto)
    let info='';
    if (state.urgentPlan && state.urgentPlan.date===todayStr() && state.urgentPlan.decided){
      if (state.urgentPlan.willHave){
        const t = new Date(state.urgentPlan.fireAt);
        const hh=('0'+t.getHours()).slice(-2), mm=('0'+t.getMinutes()).slice(-2);
        info = ' · hoy a las '+hh+':'+mm;
      } else {
        info = ' · hoy: sin urgente';
      }
    }
    return '<div class="small">⚡ Urgentes semana: <strong>'+used+'/3</strong>'+info+'</div>';
  }

  function missionCard(m){
    const li=document.createElement('li'); li.className='card'; li.setAttribute('data-id',m.id);
    const typeLabel = m.type===TYPE.DAILY ? 'Diaria' : (m.type===TYPE.CLASS?'Clase': (m.type===TYPE.URGENT?'Urgente':'Focus'));
    const dueTxt = m.dueAt? '<div class="small">⏳ <span class="timer">'+fmt(new Date(m.dueAt).getTime()-Date.now())+'</span></div>' : '';
    const reqHtml = (m.requirements||[]).map(r=>'<div class="small">• '+r.label+'</div>').join('');
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
      '<div class="btnrow">'+actions+'</div>';
    return li;
  }

  function renderMissions(){
    if (!missionsList) return;
    missionsList.innerHTML='';
    // Cabecera con contador urgentes
    const head=document.createElement('li'); head.className='card'; head.innerHTML=urgentCounterUI(); missionsList.appendChild(head);
    const pend=state.missions.filter(x=>x.status==='pending');
    const hist=state.missions.filter(x=>x.status!=='pending').slice(0,8);
    pend.forEach(m=>missionsList.appendChild(missionCard(m)));
    if (hist.length){
      const sep=document.createElement('li'); sep.className='card'; sep.innerHTML='<div class="small">Histórico reciente</div>'; missionsList.appendChild(sep);
      hist.forEach(m=>missionsList.appendChild(missionCard(m)));
    }
  }

  function renderAll(){ renderHeader(); renderMissions(); renderProfile(); }

  // Perfil (mínimo necesario para no romper lo que ya tenías)
  function renderProfile(){
    if (heroName) heroName.value=state.hero.name||'';
    if (heroClass){
      heroClass.innerHTML=''; CLASSES.forEach(c=>{ const o=document.createElement('option'); o.value=c; o.textContent=c; heroClass.appendChild(o); });
      if (state.hero.cls) heroClass.value=state.hero.cls;
    }
    if (heroGoal) heroGoal.value=state.hero.goal||'';
  }

  // ---------- Eventos básicos ----------
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
  document.addEventListener('click', e=>{
    const t=e.target.closest('button'); if(!t) return;
    const id=t.getAttribute('data-id'); const act=t.getAttribute('data-act');
    if (id&&act){
      const m=state.missions.find(x=>x.id===id); if(!m) return;
      if (act==='accept'){ if (m.type!=='urgent'){ m.accepted=true; save(); renderAll(); } return; }
      if (act==='reject'){ if (m.type!=='urgent'){ m.status='rejected'; save(); renderAll(); } return; }
      if (act==='done'){ completeMission(m); return; }
      if (act==='fail'){ failMission(m); return; }
    }
  });

  // ---------- Tick ----------
  function tick(){
    const now=Date.now(); let dirty=false;
    // Timers
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
  rolloverDailyIfNeeded();          // cambia día + aplica penalizaciones diarias vencidas
  ensureDailyUniqueForToday();      // crea UNA diaria como máximo
  planUrgentForTodayIfNeeded();     // decide 10% y programa hora 03:00–19:00
  triggerScheduledUrgentIfTime();   // si ya pasó la hora, activar/fallar en el momento
  renderAll();
  setInterval(tick, 1000);

  // Perfil inputs (mantén comportamiento previo)
  if (heroName)  heroName.addEventListener('change', function(){ state.hero.name=this.value||'Amo'; save(); setHeader(); });
  if (heroClass) heroClass.addEventListener('change', function(){ state.hero.cls=this.value; save(); });
  if (heroGoal)  heroGoal.addEventListener('change', function(){ state.hero.goal=this.value; save(); });

})();
