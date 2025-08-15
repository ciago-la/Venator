// === Altervenator v13-step1 — SOLO Misión Diaria (estable) ===
// - Tabs OK
// - Genera Diaria al abrir (según día de semana) con temporizador
// - Marcar completada / Fallar
// - XP/coins/nerf + barra de XP
// - Overlay simple para avisos
(function(){
  // ---------- Panel visible si hay error ----------
  window.addEventListener('error', function(e){
    var b=document.body; var d=document.createElement('div');
    d.style.cssText='position:fixed;top:0;left:0;right:0;background:#300;padding:8px;color:#fff;z-index:99999;font:14px monospace';
    d.textContent='JS ERROR: '+(e.message||e.filename||'desconocido');
    b.appendChild(d);
  });

  // ---------- Estado ----------
  var LS='alter_v13s1';
  var state = load() || {
    hero:{name:'Amo', cls:'Asesino', goal:'abdomen'},
    xp:0, level:1, coins:0,
    expBuffUntil:0, expNerfCount:0,
    missions:[],                // {id,type,title,desc,createdAt,dueAt,status,requirements[],baseXP,baseCoins,penalty}
    lastSeenDay:null
  };

  // ---------- Utilidades ----------
  function save(){ localStorage.setItem(LS, JSON.stringify(state)); }
  function load(){ try{return JSON.parse(localStorage.getItem(LS));}catch(e){return null;} }
  function uid(){ return Math.random().toString(36).slice(2)+Date.now().toString(36); }
  function todayStr(){ return new Date().toISOString().slice(0,10); }
  function endOfDay(){ var x=new Date(); x.setHours(23,59,59,999); return x; }
  function today10(){ var x=new Date(); x.setHours(10,0,0,0); return x; }
  function fmt(ms){ ms=Math.max(0,ms|0); var s=Math.floor(ms/1000); var h=('0'+Math.floor(s/3600)).slice(-2); var m=('0'+Math.floor((s%3600)/60)).slice(-2); var sc=('0'+(s%60)).slice(-2); return h+':'+m+':'+sc; }
  function xpNeedFor(level){ return Math.round(200 * Math.pow(1.1, level-1)); }

  function gainXP(base){
    var g=base;
    if (Date.now()<state.expBuffUntil) g=Math.round(g*1.2);
    if (state.expNerfCount>0) g=Math.round(g*0.8);
    state.xp += g;
    while(state.xp >= xpNeedFor(state.level)){ state.xp -= xpNeedFor(state.level); state.level++; }
  }
  function applyNerf(){ state.expNerfCount = Math.min(9,(state.expNerfCount||0)+3); }
  function decayNerf(){ if (state.expNerfCount>0) state.expNerfCount--; }

  // ---------- Datos ----------
  var TYPE={DAILY:'daily'};
  var DAILY_ROTATION={
    1:['Flexiones 5×2','Sentadillas 10×2','Abdominales 20×2'],
    2:['Dominadas 5/3','Zancadas 4/4','Puente glúteo 7'],
    3:['Fondos tríceps 5','Patada lateral 3×2','Plancha 10s'],
    4:['Flexiones 5×2','Sentadillas 10×2','Abdominales 20×2'],
    5:['Dominadas 5/3','Zancadas 4/4','Puente glúteo 7'],
    6:['Fondos tríceps 5','Patada lateral 3×2','Plancha 10s'],
    0:['Elevación piernas 5×2','Combo saco/sombra (detalle)','Sombra intensa 30s']
  };

  // ---------- Creación Diaria ----------
  function mkDaily(){
    var now=new Date();
    var due = (now < today10()) ? new Date(Math.min(now.getTime()+14*3600*1000, endOfDay().getTime())) : endOfDay();
    var reqText = DAILY_ROTATION[now.getDay()];
    return {
      id:uid(), type:TYPE.DAILY, title:'Misión diaria', desc:'Obligatoria de hoy.',
      createdAt: now.toISOString(), dueAt: due.toISOString(), status:'pending',
      baseXP:40, baseCoins:6,
      requirements: reqText.map(function(s){ return {label:s}; }),
      penalty:{coins:6, nerf:true, nextHarder:false}
    };
  }

  // ---------- Overlay ----------
  var overlay=document.getElementById('overlay'), card=document.getElementById('overlayCard');
  var ovTitle=document.getElementById('ovTitle'), ovBody=document.getElementById('ovBody'), ovButtons=document.getElementById('ovButtons');
  function showInfo(title, body){
    ovTitle.textContent=title; ovBody.textContent=body; ovButtons.innerHTML='';
    var ok=document.createElement('button'); ok.textContent='Aceptar'; ok.onclick=hideOverlay; ovButtons.appendChild(ok);
    overlay.classList.remove('hidden');
  }
  function hideOverlay(){ overlay.classList.add('hidden'); }

  // ---------- Generación al abrir ----------
  function ensureDailyToday(){
    var t=todayStr(); var has=false;
    for (var i=0;i<state.missions.length;i++){
      var m=state.missions[i];
      if (m.type===TYPE.DAILY && m.status==='pending' && m.createdAt.slice(0,10)===t){ has=true; break; }
    }
    if (!has){
      var d=mkDaily(); state.missions.unshift(d); save(); renderAll();
      showInfo('Nueva misión', 'Se ha generado tu misión diaria de hoy.');
    }
  }
  function rolloverAndPenalizeIfNeeded(){
    var t=todayStr();
    if (state.lastSeenDay!==t){
      for (var i=0;i<state.missions.length;i++){
        var m=state.missions[i];
        if (m.type===TYPE.DAILY && m.status==='pending' && m.createdAt.slice(0,10)!==t){
          if (Date.now()>new Date(m.dueAt).getTime()){
            // Falla automática + penalización
            m.status='failed';
            if (m.penalty){
              if (m.penalty.coins) state.coins=Math.max(0,state.coins-m.penalty.coins);
              if (m.penalty.nerf) applyNerf();
            }
          }
        }
      }
      state.lastSeenDay=t;
      save();
    }
  }

  // ---------- Acciones ----------
  function completeMission(m){
    if (!m || m.status!=='pending') return;
    m.status='completed';
    gainXP(m.baseXP||0);
    state.coins += (m.baseCoins||0);
    decayNerf();
    save(); renderAll();
    showInfo('Misión completada', 'Has ganado +'+(m.baseXP||0)+' XP y +'+(m.baseCoins||0)+'🪙');
  }
  function failMission(m){
    if (!m || m.status!=='pending') return;
    m.status='failed';
    if (m.penalty){
      if (m.penalty.coins) state.coins=Math.max(0,state.coins-m.penalty.coins);
      if (m.penalty.nerf) applyNerf();
    }
    save(); renderAll();
    showInfo('Misión fallida', 'Se ha aplicado la penalización correspondiente.');
  }

  // ---------- Render ----------
  var missionsList=document.getElementById('missionsList');
  var heroName=document.getElementById('heroName');
  var heroClass=document.getElementById('heroClass');
  var heroGoal=document.getElementById('heroGoal');

  function setHeader(){
    var need = xpNeedFor(state.level);
    document.getElementById('levelInfo').textContent='Lvl '+state.level+' · '+state.xp+' / '+need+' XP · '+state.coins+'🪙';
    var fill=document.getElementById('xpFill');
    if (fill){ var pct=Math.max(0,Math.min(1,state.xp/need)); fill.style.width=(pct*100)+'%'; }
  }
  function renderHeader(){
    setHeader();
    // Perfil (si están esos spans)
    var pLvl=document.getElementById('pLvl'); if (pLvl) pLvl.textContent=state.level;
    var pXP=document.getElementById('pXP'); if (pXP) pXP.textContent=state.xp;
    var pNeed=document.getElementById('pXPNeed'); if (pNeed) pNeed.textContent=xpNeedFor(state.level);
    var pCoins=document.getElementById('pCoins'); if (pCoins) pCoins.textContent=state.coins;
    var pNerf=document.getElementById('pNerf'); if (pNerf) pNerf.textContent=state.expNerfCount||0;
  }
  function missionCard(m){
    var li=document.createElement('li'); li.className='card'; li.setAttribute('data-id',m.id);
    var dueTxt = m.dueAt? '<div class="small">⏳ <span class="timer">'+fmt(new Date(m.dueAt).getTime()-Date.now())+'</span></div>' : '';
    var reqHtml = m.requirements.map(function(r){ return '<div class="small">• '+r.label+'</div>'; }).join('');
    var actions = '<button data-act="done" data-id="'+m.id+'">Marcar completada</button> <button class="ghost" data-act="fail" data-id="'+m.id+'">Fallar</button>';
    li.innerHTML = '<h4>'+m.title+' <span class="small">[Diaria]</span></h4>'
      + '<div class="small">'+(m.desc||'')+'</div>'+ dueTxt
      + '<div class="small">Recompensa: '+(m.baseXP||0)+' XP, '+(m.baseCoins||0)+'🪙</div>'
      + reqHtml
      + '<div class="btnrow">'+actions+'</div>';
    return li;
  }
  function renderMissions(){
    missionsList.innerHTML='';
    var pend=state.missions.filter(function(x){return x.type===TYPE.DAILY;});
    if (!pend.length){
      var li=document.createElement('li'); li.className='card';
      li.innerHTML='<div class="small">No hay misiones. Pulsa recargar si no aparece la diaria.</div>';
      missionsList.appendChild(li);
      return;
    }
    pend.forEach(function(m){ missionsList.appendChild(missionCard(m)); });
  }
  function renderProfile(){
    if (heroName) heroName.value=state.hero.name;
    if (heroClass){
      heroClass.innerHTML='';
      ['Guerrero','Asesino','Mago','Arquero','Espía','Maratón','Amigo del dragón','Saltamontes'].forEach(function(c){
        var o=document.createElement('option'); o.value=c; o.textContent=c; heroClass.appendChild(o);
      });
      heroClass.value=state.hero.cls;
    }
    if (heroGoal){
      heroGoal.value=state.hero.goal;
    }
  }
  function renderAll(){ renderHeader(); renderMissions(); renderProfile(); }

  // ---------- Eventos UI ----------
  // Tabs (ya probadas en v12)
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
      if (act==='done') completeMission(m);
      if (act==='fail') failMission(m);
    }
    // Los otros botones (+ Focus / Urgente) de momento no hacen nada en step1
  });

  // Perfil inputs
  if (heroName) heroName.addEventListener('change', function(){ state.hero.name=this.value||'Amo'; save(); setHeader(); });
  if (heroClass) heroClass.addEventListener('change', function(){ state.hero.cls=this.value; save(); });
  if (heroGoal)  heroGoal.addEventListener('change', function(){ state.hero.goal=this.value; save(); });

  // ---------- Tick (temporizador) ----------
  function tick(){
    var cards=document.querySelectorAll('#missionsList .card');
    for (var j=0;j<cards.length;j++){
      var id=cards[j].getAttribute('data-id'); if(!id) continue;
      var m=state.missions.find(function(x){return x.id===id;});
      var el=cards[j].querySelector('.timer');
      if (m&&el&&m.dueAt){ el.textContent=fmt(new Date(m.dueAt).getTime()-Date.now()); }
      // auto-fail al llegar a 0
      if (m && m.status==='pending' && m.dueAt && Date.now()>new Date(m.dueAt).getTime()){
        m.status='failed';
        if (m.penalty){
          if (m.penalty.coins) state.coins=Math.max(0,state.coins-m.penalty.coins);
          if (m.penalty.nerf) applyNerf();
        }
        save(); renderAll();
        showInfo('Tiempo agotado', 'La misión diaria ha fallado por tiempo.');
      }
    }
  }

  // ---------- Inicio ----------
  rolloverAndPenalizeIfNeeded();
  ensureDailyToday();
  renderAll();
  setInterval(tick, 1000);
})();
