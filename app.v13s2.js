// === Altervenator v13s2 — STEP1 (Diaria) + STEP2 (Clase) ===
// - Diaria (auto-aceptada)
// - Clase: se genera 1 pendiente, requiere Aceptar/Rechazar, sin penalización al fallar
// - Temporizadores + auto-fail
// - XP normal y XP de clase + barra XP
(function(){
  // ---------- Panel visible si hay error ----------
  window.addEventListener('error', function(e){
    var b=document.body; var d=document.createElement('div');
    d.style.cssText='position:fixed;top:0;left:0;right:0;background:#300;padding:8px;color:#fff;z-index:99999;font:14px monospace';
    d.textContent='JS ERROR: '+(e.message||e.filename||'desconocido');
    b.appendChild(d);
  });

  // ---------- Estado ----------
  var LS='alter_v13s2';
  var CLASSES=['Guerrero','Asesino','Mago','Arquero','Espía','Maratón','Amigo del dragón','Saltamontes'];
  var state = load() || {
    hero:{name:'Amo', cls:'Asesino', goal:'abdomen'},
    xp:0, level:1, coins:0,
    classXP:0, classLevel:1,
    expBuffUntil:0, expNerfCount:0,
    missions:[],                 // {id,type,title,desc,createdAt,dueAt,status,accepted,requirements[],baseXP,baseCoins,classXP?,penalty?}
    lastSeenDay:null
  };

  // ---------- Utils ----------
  function save(){ localStorage.setItem(LS, JSON.stringify(state)); }
  function load(){ try{return JSON.parse(localStorage.getItem(LS));}catch(e){return null;} }
  function uid(){ return Math.random().toString(36).slice(2)+Date.now().toString(36); }
  function todayStr(){ return new Date().toISOString().slice(0,10); }
  function endOfDay(){ var x=new Date(); x.setHours(23,59,59,999); return x; }
  function today10(){ var x=new Date(); x.setHours(10,0,0,0); return x; }
  function fmt(ms){ ms=Math.max(0,ms|0); var s=Math.floor(ms/1000); var h=('0'+Math.floor(s/3600)).slice(-2); var m=('0'+Math.floor((s%3600)/60)).slice(-2); var sc=('0'+(s%60)).slice(-2); return h+':'+m+':'+sc; }
  function xpNeedFor(level){ return Math.round(200 * Math.pow(1.1, level-1)); }
  function cxpNeedFor(clevel){ return Math.round(200 * Math.pow(1.1, clevel-1)); }

  function gainXP(base){
    var g=base;
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

  // ---------- Datos ----------
  var TYPE={DAILY:'daily', CLASS:'class'};

  var DAILY_ROTATION={
    1:['Flexiones 5×2','Sentadillas 10×2','Abdominales 20×2'],
    2:['Dominadas 5/3','Zancadas 4/4','Puente glúteo 7'],
    3:['Fondos tríceps 5','Patada lateral 3×2','Plancha 10s'],
    4:['Flexiones 5×2','Sentadillas 10×2','Abdominales 20×2'],
    5:['Dominadas 5/3','Zancadas 4/4','Puente glúteo 7'],
    6:['Fondos tríceps 5','Patada lateral 3×2','Plancha 10s'],
    0:['Elevación piernas 5×2','Combo saco/sombra (detalle)','Sombra intensa 30s']
  };

  function classPreset(cls){
    var R={};
    R['Asesino']=['Saltos pliometría x10/lado ×2','Salto reactivo 20'];
    R['Guerrero']=['Repite misión diaria','Repite misión focus'];
    R['Mago']=['Patadas con reacción','Punching ball 1min ×2'];
    R['Arquero']=['Side/front kicks + scorpions','Combo nuevo ×6'];
    R['Espía']=['Caderas 3×30s','Equilibrios 30s/pierna'];
    R['Maratón']=['5 km en 30 min','4 sprints de 100 m'];
    R['Amigo del dragón']=['Derrota a 1 contrincante','Recorrido ≥3 obstáculos'];
    R['Saltamontes']=['Agarre 20s ×10','Bloque ×3'];
    return (R[cls]||R['Asesino']).slice(0,2);
  }

  // ---------- Creadores ----------
  function mkDaily(){
    var now=new Date();
    var due = (now < today10()) ? new Date(Math.min(now.getTime()+14*3600*1000, endOfDay().getTime())) : endOfDay();
    var reqText = DAILY_ROTATION[now.getDay()];
    return {
      id:uid(), type:TYPE.DAILY, title:'Misión diaria', desc:'Obligatoria de hoy.',
      createdAt: now.toISOString(), dueAt: due.toISOString(),
      status:'pending', accepted:true,
      baseXP:40, baseCoins:6,
      requirements: reqText.map(function(s){ return {label:s}; }),
      penalty:{coins:6, nerf:true}
    };
  }

  function mkClassMission(){
    var now=new Date(); var cls=state.hero.cls;
    var reqs=classPreset(cls).map(function(t){ return {label:t}; });
    return {
      id:uid(), type:TYPE.CLASS, title:'Misión de clase — '+cls, desc:'Entrenamiento de '+cls,
      createdAt: now.toISOString(), dueAt: new Date(now.getTime()+12*3600*1000).toISOString(),
      status:'pending', accepted:false,
      baseXP:70, classXP:70, baseCoins:9, requirements:reqs,
      penalty:null // sin penalización en fallo
    };
  }

  // ---------- Overlay ----------
  var overlay=document.getElementById('overlay'), card=document.getElementById('overlayCard');
  var ovTitle=document.getElementById('ovTitle'), ovBody=document.getElementById('ovBody'), ovButtons=document.getElementById('ovButtons');
  function showInfo(title, body, color){
    card.className='overlay-card '+(color||'blue');
    ovTitle.textContent=title; ovBody.textContent=body; ovButtons.innerHTML='';
    var ok=document.createElement('button'); ok.textContent='Aceptar'; ok.onclick=hideOverlay; ovButtons.appendChild(ok);
    overlay.classList.remove('hidden');
  }
  function showPromptAcceptReject(m, color){
    card.className='overlay-card '+(color||'purple');
    ovTitle.textContent='Nueva misión';
    ovBody.textContent='Tienes una misión: '+m.title+' — ¿Aceptas?';
    ovButtons.innerHTML='';
    var ok=document.createElement('button'); ok.textContent='Aceptar';
    ok.onclick=function(){ m.accepted=true; save(); renderAll(); hideOverlay(); };
    var ko=document.createElement('button'); ko.textContent='Rechazar'; ko.className='ghost';
    ko.onclick=function(){ m.status='rejected'; save(); renderAll(); hideOverlay(); };
    ovButtons.appendChild(ok); ovButtons.appendChild(ko);
    overlay.classList.remove('hidden');
  }
  function hideOverlay(){ overlay.classList.add('hidden'); }

  // ---------- Generación al abrir ----------
  function rolloverDailyIfNeeded(){
    var t=todayStr();
    if (state.lastSeenDay!==t){
      // Si quedó diaria pendiente de ayer y venció → fallar + penalización
      for (var i=0;i<state.missions.length;i++){
        var m=state.missions[i];
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
      state.lastSeenDay=t; save();
    }
  }
  function ensureDailyToday(){
    var t=todayStr(); var has=false;
    for (var i=0;i<state.missions.length;i++){
      var m=state.missions[i];
      if (m.type===TYPE.DAILY && m.status==='pending' && m.createdAt.slice(0,10)===t){ has=true; break; }
    }
    if (!has){
      var d=mkDaily(); state.missions.unshift(d); save(); renderAll();
      showInfo('Misión diaria', 'Se ha generado tu misión diaria de hoy.'); // auto-aceptada
    }
  }
  function ensureOneClassPending(){
    for (var i=0;i<state.missions.length;i++){
      var m=state.missions[i];
      if (m.type===TYPE.CLASS && m.status==='pending') return;
    }
    var c=mkClassMission(); state.missions.unshift(c); save(); renderAll();
    showPromptAcceptReject(c,'purple');
  }

  // ---------- Acciones ----------
  function completeMission(m){
    if (!m || m.status!=='pending') return;
    if (m.type===TYPE.CLASS && !m.accepted) return showInfo('Acepta primero','Debes aceptar la misión de clase.','purple');
    m.status='completed';
    gainXP(m.baseXP||0);
    if (m.classXP) gainClassXP(m.classXP);
    state.coins += (m.baseCoins||0);
    decayNerf();
    save(); renderAll();
    var extra = m.classXP ? (' · +'+m.classXP+' XP clase') : '';
    showInfo('Misión completada','Has ganado +'+(m.baseXP||0)+' XP y +'+(m.baseCoins||0)+'🪙'+extra, m.type===TYPE.CLASS?'purple':'blue');
  }
  function failMission(m){
    if (!m || m.status!=='pending') return;
    m.status='failed';
    if (m.type===TYPE.DAILY && m.penalty){
      if (m.penalty.coins) state.coins=Math.max(0,state.coins-m.penalty.coins);
      if (m.penalty.nerf) applyNerf();
    }
    save(); renderAll();
    showInfo('Misión fallida', (m.type===TYPE.CLASS?'Sin penalización.':'Se aplicó la penalización.'), m.type===TYPE.CLASS?'purple':'red');
  }

  // ---------- Render ----------
  var missionsList=document.getElementById('missionsList');
  var heroName=document.getElementById('heroName');
  var heroClass=document.getElementById('heroClass');
  var heroGoal=document.getElementById('heroGoal');

  function setHeader(){
    var need = xpNeedFor(state.level);
    var li=document.getElementById('levelInfo');
    if (li) li.textContent='Lvl '+state.level+' · '+state.xp+' / '+need+' XP · '+state.coins+'🪙';
    var fill=document.getElementById('xpFill');
    if (fill){ var pct=Math.max(0,Math.min(1,state.xp/need)); fill.style.width=(pct*100)+'%'; }
  }
  function renderHeader(){
    setHeader();
    var p=document.getElementById('pLvl'); if (p) p.textContent=state.level;
    p=document.getElementById('pXP'); if (p) p.textContent=state.xp;
    p=document.getElementById('pXPNeed'); if (p) p.textContent=xpNeedFor(state.level);
    p=document.getElementById('pCoins'); if (p) p.textContent=state.coins;
    p=document.getElementById('pNerf'); if (p) p.textContent=state.expNerfCount||0;

    p=document.getElementById('cLvl'); if (p) p.textContent=state.classLevel;
    p=document.getElementById('cXP'); if (p) p.textContent=state.classXP;
    p=document.getElementById('cXPNeed'); if (p) p.textContent=cxpNeedFor(state.classLevel);
  }

  function missionCard(m){
    var li=document.createElement('li'); li.className='card'; li.setAttribute('data-id',m.id);
    var typeLabel = m.type===TYPE.DAILY ? 'Diaria' : 'Clase';
    var dueTxt = m.dueAt? '<div class="small">⏳ <span class="timer">'+fmt(new Date(m.dueAt).getTime()-Date.now())+'</span></div>' : '';
    var reqHtml = (m.requirements||[]).map(function(r){ return '<div class="small">• '+r.label+'</div>'; }).join('');
    var actions = '';
    if (m.type===TYPE.CLASS && !m.accepted){
      actions += '<button data-act="accept" data-id="'+m.id+'">Aceptar</button> ';
      actions += '<button class="ghost" data-act="reject" data-id="'+m.id+'">Rechazar</button> ';
    }
    actions += '<button data-act="done" data-id="'+m.id+'">Marcar completada</button> ';
    actions += '<button class="ghost" data-act="fail" data-id="'+m.id+'">Fallar</button>';
    li.innerHTML = '<h4>'+m.title+' <span class="small">['+typeLabel+']</span></h4>'
      + '<div class="small">'+(m.desc||'')+'</div>'+ dueTxt
      + '<div class="small">Recompensa: '+(m.baseXP||0)+' XP, '+(m.baseCoins||0)+'🪙'+(m.classXP?' · '+m.classXP+' XP clase':'')+'</div>'
      + reqHtml
      + '<div class="btnrow">'+actions+'</div>';
    return li;
  }

  function renderMissions(){
    missionsList.innerHTML='';
    var pend=state.missions.filter(function(x){return x.status==='pending' && (x.type===TYPE.DAILY||x.type===TYPE.CLASS);});
    var hist=state.missions.filter(function(x){return x.status!=='pending' && (x.type===TYPE.DAILY||x.type===TYPE.CLASS);}).slice(0,8);
    pend.forEach(function(m){ missionsList.appendChild(missionCard(m)); });
    if (hist.length){
      var sep=document.createElement('li'); sep.className='card'; sep.innerHTML='<div class="small">Histórico reciente</div>'; missionsList.appendChild(sep);
      hist.forEach(function(m){ missionsList.appendChild(missionCard(m)); });
    }
  }

  function renderProfile(){
    if (heroName) heroName.value=state.hero.name;
    if (heroClass){
      heroClass.innerHTML='';
      CLASSES.forEach(function(c){ var o=document.createElement('option'); o.value=c; o.textContent=c; heroClass.appendChild(o); });
      heroClass.value=state.hero.cls;
    }
    if (heroGoal) heroGoal.value=state.hero.goal;
  }

  function renderAll(){ renderHeader(); renderMissions(); renderProfile(); }

  // ---------- Eventos UI ----------
  // Tabs
  var tabbar=document.querySelector('.tabbar');
  if (tabbar){
    tabbar.addEventListener('click', function(e){
      var v=e.target.getAttribute('data-view'); if(!v) return;
      document.querySelectorAll('.tabbar button').forEach(b=>b.classList.remove('active'));
      e.target.classList.add('active');
      document.querySelectorAll('.view').forEach(s=>s.classList.remove('active'));
      var sec=document.getElementById('view-'+v); if (sec) sec.classList.add('active');
    });
  }

  // Botonera Misiones
  document.body.addEventListener('click', function(e){
    var t=e.target; if (!t) return;
    var id=t.getAttribute('data-id'); var act=t.getAttribute('data-act');
    if (id&&act){
      var m=state.missions.find(function(x){return x.id===id;});
      if (!m) return;
      if (act==='accept'){ m.accepted=true; save(); renderAll(); return; }
      if (act==='reject'){ m.status='rejected'; save(); renderAll(); return; }
      if (act==='done'){ completeMission(m); return; }
      if (act==='fail'){ failMission(m); return; }
    }
  });

  // Perfil inputs
  if (heroName)  heroName.addEventListener('change', function(){ state.hero.name=this.value||'Amo'; save(); setHeader(); });
  if (heroClass) heroClass.addEventListener('change', function(){ state.hero.cls=this.value; save(); });
  if (heroGoal)  heroGoal.addEventListener('change', function(){ state.hero.goal=this.value; save(); });

  // ---------- Tick ----------
  function tick(){
    var now=Date.now(), dirty=false;
    var cards=document.querySelectorAll('#missionsList .card');
    for (var j=0;j<cards.length;j++){
      var id=cards[j].getAttribute('data-id'); if(!id) continue;
      var m=state.missions.find(function(x){return x.id===id;});
      var el=cards[j].querySelector('.timer');
      if (m&&el&&m.dueAt){ el.textContent=fmt(new Date(m.dueAt).getTime()-now); }
      if (m && m.status==='pending' && m.dueAt && now>new Date(m.dueAt).getTime()){
        m.status='failed';
        if (m.type===TYPE.DAILY && m.penalty){
          if (m.penalty.coins) state.coins=Math.max(0,state.coins-m.penalty.coins);
          if (m.penalty.nerf) applyNerf();
        }
        dirty=true;
      }
    }
    if (dirty){ save(); renderAll(); }
  }

  // ---------- Inicio ----------
  rolloverDailyIfNeeded();
  ensureDailyToday();
  ensureOneClassPending();
  renderAll();
  setInterval(tick, 1000);
})();
