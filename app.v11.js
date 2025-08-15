// === Altervenator v11 (núcleo estable) ===
// Tabs + Misiones (Diaria/Clase/Focus/Urgente) + Tienda + Overlay + Perfil.
// Sin perfiles import/export (los añadimos luego). Evita errores de pegado.

(function(){
  // ---------- Estado ----------
  var LS='alter_v11';
  var CLASSES=['Guerrero','Asesino','Mago','Arquero','Espía','Maratón','Amigo del dragón','Saltamontes'];
  var state = load() || {
    hero:{name:'Amo', cls:'Asesino', goal:'abdomen'},
    xp:0, level:1, coins:0,
    classXP:0, classLevel:1,
    expBuffUntil:0, expNerfCount:0,
    inventory:{ time_potion:1, str_potion:1, exp_potion:0, cure:0 },
    equipment:[],
    missions:[],
    weeklyUrgents:{},
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
  function cxpNeedFor(clevel){ return Math.round(200 * Math.pow(1.1, clevel-1)); }
  function weekKey(){ var d=new Date(); var a=new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); a.setUTCDate(a.getUTCDate()+4-(a.getUTCDay()||7)); var y=new Date(Date.UTC(a.getUTCFullYear(),0,1)); var w=Math.ceil((((a-y)/86400000)+1)/7); return a.getUTCFullYear()+'-W'+('0'+w).slice(-2); }

  function gainXP(base){
    var g=base;
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
  var TYPE={DAILY:'daily',FOCUS:'focus',CLASS:'class',URGENT:'urgent'};
  var DAILY_ROTATION={
    1:['Flexiones 5×2','Sentadillas 10×2','Abdominales 20×2'],
    2:['Dominadas 5/3','Zancadas 4/4','Puente glúteo 7'],
    3:['Fondos tríceps 5','Patada lateral 3×2','Plancha 10s'],
    4:['Flexiones 5×2','Sentadillas 10×2','Abdominales 20×2'],
    5:['Dominadas 5/3','Zancadas 4/4','Puente glúteo 7'],
    6:['Fondos tríceps 5','Patada lateral 3×2','Plancha 10s'],
    0:['Elevación piernas 5×2','Combo saco/sombra (detalle)','Sombra intensa 30s']
  };
  var FOCUS_TEMPLATES={
    abdomen:['Crunches','Elevación de piernas','Criss cross','Plancha (s)'],
    brazos:['Fondos tríceps','Curl bíceps (peso)','Flexiones tríceps','Dominadas supinas'],
    piernas:['Sentadillas','Lunges','Puente glúteos','Sentadillas salto'],
    pecho:['Flexiones','Press pecho (peso)','Aperturas','Rebotes flexión/press'],
    espalda:['Dominadas','Remo en plancha','Remo en banco','Cargadas'],
    hombros:['Elevaciones laterales','Flexiones pica','Press militar','Elevaciones frontales']
  };
  var URGENT_TPL=[
    {name:'Domador de Dragones', reqs:['Sprint 200m ×5','Flexiones 40','Plancha 60s','Prueba de clase (aleatoria)'], loot:['aliento_dragón','escamas_dragón','huevo_dragón','amigo_dragón','sangre_dragón']},
    {name:'Asesino de reyes', reqs:['Burpees 30','Sentadillas salto 30','Hollow hold 30s','Prueba de clase (aleatoria)'], loot:['corona_maldita','cetro_poder','espada_triple','proteccion_princesa','colgante_reina']},
    {name:'Ciervo de mil ojos avistado', reqs:['Sprints 50m ×10','Zancadas 20/20','Plancha lateral 30s/lado','Prueba de clase (aleatoria)'], loot:['ojos_azules_3','cuerno_arbol_rojo','armadura_piel_magica','frasco_aliento_bosque','semilla_antigua']},
    {name:'Robo en la torre de maná', reqs:['Jumping jacks 80','Flexiones inclinadas 25','Planchas escaladas 40','Prueba de clase (aleatoria)'], loot:['pocion_mana_potente','libro_conjuros','daga_oscuridad','diente_fuego','llave_celda_oscura']},
    {name:'Asalto al coloso de hierro', reqs:['Sentadilla isométrica 60s','Flexiones pike 20','Mountain climbers 60','Prueba de clase (aleatoria)'], loot:['armadura_voladora','botas_viento','maza_terremoto','latigo_azul','tunica_albores_alvaros']}
  ];

  // ---------- Creadores de misiones ----------
  function mkDaily(){
    var now=new Date();
    var due = (now < today10()) ? new Date(Math.min(now.getTime()+14*3600*1000, endOfDay().getTime())) : endOfDay();
    var reqText = DAILY_ROTATION[now.getDay()];
    return {
      id:uid(), type:TYPE.DAILY, title:'Misión diaria', desc:'Obligatoria de hoy.',
      createdAt: now.toISOString(), dueAt: due.toISOString(), accepted:true, status:'pending',
      baseXP:40, baseCoins:6,
      requirements: reqText.map(function(s){ return {label:s}; }),
      penalty:{coins:6, nerf:true, nextHarder:true, harderFactor:2.0}
    };
  }
  function mkFocus(zone){
    var now=new Date(); var base=10, lvl=state.level;
    if (lvl>=5&&lvl<=9) base=18; else if (lvl>=10&&lvl<=20) base=25; else if (lvl>=21) base=30;
    var reqs=(FOCUS_TEMPLATES[zone]||FOCUS_TEMPLATES.abdomen).slice(0,4).map(function(n){
      return {label:n+(n.indexOf('(s)')>-1?(' '+base+'s'):(' '+base))};
    });
    return {
      id:uid(), type:TYPE.FOCUS, title:'Focus '+zone, desc:'Sesión de '+zone+'. (No afecta clase)',
      createdAt: now.toISOString(), dueAt: new Date(now.getTime()+8*3600*1000).toISOString(), accepted:false, status:'pending',
      baseXP:80, baseCoins:10, requirements:reqs,
      penalty:{coins:8, nerf:true, nextHarder:true, harderFactor:1.5}
    };
  }
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
  function mkClassMission(){
    var now=new Date(); var cls=state.hero.cls;
    var reqs=classPreset(cls).map(function(t){ return {label:t}; });
    return {
      id:uid(), type:TYPE.CLASS, title:'Misión de clase — '+cls, desc:'Entrenamiento de '+cls,
      createdAt: now.toISOString(), dueAt: new Date(now.getTime()+12*3600*1000).toISOString(), accepted:false, status:'pending',
      baseXP:70, classXP:70, baseCoins:9, requirements:reqs,
      penalty:null
    };
  }
  function mkUrgent(){
    var now=new Date(); var t=URGENT_TPL[Math.floor(Math.random()*URGENT_TPL.length)];
    return {
      id:uid(), type:TYPE.URGENT, title:'Misión urgente: '+t.name, desc:'Alta prioridad.',
      createdAt: now.toISOString(), dueAt: new Date(now.getTime()+5*3600*1000).toISOString(), accepted:true, status:'pending',
      baseXP:120, baseCoins:15, requirements:t.reqs.map(function(x){return {label:x};}), loot:t.loot,
      penalty:{coins:10, nerf:true, nextHarder:true, harderFactor:1.25}
    };
  }
  function harderClone(m){
    var n=JSON.parse(JSON.stringify(m)); n.id=uid(); n.status='pending'; n.accepted=true;
    n.title=m.title+' — Versión dura'; n.dueAt=new Date(Date.now()+6*3600*1000).toISOString(); n.penalty=null;
    var f=(m.penalty&&m.penalty.harderFactor)?m.penalty.harderFactor:1.25;
    n.requirements=n.requirements.map(function(r){ return {label:r.label.replace(/(\d+)/g,function(x){return String(Math.ceil(parseInt(x,10)*f));})}; });
    return n;
  }

  // ---------- Overlay ----------
  var overlay=document.getElementById('overlay'), card=document.getElementById('overlayCard');
  var ovTitle=document.getElementById('ovTitle'), ovBody=document.getElementById('ovBody'), ovButtons=document.getElementById('ovButtons');
  function colorFor(m){ return m.type===TYPE.URGENT?'red': (m.type===TYPE.CLASS?'purple':'blue'); }
  function showPrompt(m, forceAccept){
    card.className='overlay-card '+colorFor(m);
    ovTitle.textContent='Nueva misión';
    ovBody.textContent='Tienes una misión: '+m.title+' — ¿Aceptas?';
    ovButtons.innerHTML='';
    var ok=document.createElement('button'); ok.textContent='Aceptar'; ok.onclick=function(){ acceptMission(m); hideOverlay(); }; ovButtons.appendChild(ok);
    if (!forceAccept && m.type!==TYPE.URGENT){
      var ko=document.createElement('button'); ko.textContent='Rechazar'; ko.className='ghost'; ko.onclick=function(){ rejectMission(m); hideOverlay(); }; ovButtons.appendChild(ko);
    }
    overlay.classList.remove('hidden');
  }
  function notify(title, body, color){
    card.className='overlay-card '+(color||'blue');
    ovTitle.textContent=title; ovBody.textContent=body; ovButtons.innerHTML='';
    var ok=document.createElement('button'); ok.textContent='Aceptar'; ok.onclick=hideOverlay; ovButtons.appendChild(ok);
    overlay.classList.remove('hidden');
  }
  function hideOverlay(){ overlay.classList.add('hidden'); }

  // ---------- Generación al abrir ----------
  function ensureDaily(){
    var t=todayStr(), has=false;
    for (var i=0;i<state.missions.length;i++){
      var m=state.missions[i];
      if (m.type===TYPE.DAILY && m.status==='pending' && m.createdAt.slice(0,10)===t){ has=true; break; }
    }
    if (!has){ var d=mkDaily(); state.missions.unshift(d); save(); renderAll(); showPrompt(d); }
  }
  function ensureClass(){
    var has=false;
    for (var i=0;i<state.missions.length;i++){ if (state.missions[i].type===TYPE.CLASS && state.missions[i].status==='pending'){ has=true; break; } }
    if (!has){ var c=mkClassMission(); state.missions.unshift(c); save(); renderAll(); showPrompt(c); }
  }
  function maybeUrgent(){
    var wk=weekKey(); var used=state.weeklyUrgents[wk]||0; if (used>=3) return;
    if (Math.random()<0.25){ var u=mkUrgent(); state.missions.unshift(u); state.weeklyUrgents[wk]=used+1; save(); renderAll(); showPrompt(u,true); }
  }
  function onOpen(){
    setHeader();
    var t=todayStr();
    if (state.lastSeenDay!==t){
      for (var i=0;i<state.missions.length;i++){
        var m=state.missions[i];
        if (m.type===TYPE.DAILY && m.status==='pending' && m.createdAt.slice(0,10)!==t){
          if (Date.now()>new Date(m.dueAt).getTime()) failMission(m,true);
        }
      }
      state.lastSeenDay=t;
    }
    ensureDaily(); ensureClass(); maybeUrgent(); save(); renderAll();
  }

  // ---------- Acciones ----------
  function acceptMission(m){ if (m.accepted) return; m.accepted=true; save(); renderAll(); }
  function rejectMission(m){ if (m.type===TYPE.URGENT) return; m.status='rejected'; save(); renderAll(); }
  function completeMission(m){
    if (m.status!=='pending') return;
    m.status='completed';
    gainXP(m.baseXP||0); if (m.classXP) gainClassXP(m.classXP);
    state.coins += (m.baseCoins||0); decayNerf();
    if (m.type===TYPE.URGENT && Math.random()<0.20 && m.loot && m.loot.length){
      var item=m.loot[Math.floor(Math.random()*m.loot.length)];
      state.inventory[item]=(state.inventory[item]||0)+1;
      notify('Objeto raro recibido','Has obtenido: '+item,'blue');
    }
    save(); renderAll();
    notify('Has completado la misión', m.title+' • +'+(m.baseXP||0)+' XP, +'+(m.baseCoins||0)+'🪙', colorFor(m));
  }
  function failMission(m, silent){
    if (m.status!=='pending') return;
    m.status='failed';
    if (m.penalty){
      if (m.penalty.coins) state.coins=Math.max(0,state.coins-m.penalty.coins);
      if (m.penalty.nerf) applyNerf();
      if (m.penalty.nextHarder) state.missions.unshift(harderClone(m));
    }
    save(); renderAll(); if (!silent) notify('Penalización','Se aplicó penalización a '+m.title, 'red');
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
    var need = xpNeedFor(state.level);
    document.getElementById('levelInfo').textContent='Lvl '+state.level+' · '+state.xp+' / '+need+' XP · '+state.coins+'🪙';
    var fill=document.getElementById('xpFill');
    if (fill){ var pct=Math.max(0,Math.min(1,state.xp/need)); fill.style.width=(pct*100)+'%'; }
  }
  function renderHeader(){
    document.getElementById('pLvl').textContent=state.level;
    document.getElementById('pXP').textContent=state.xp;
    document.getElementById('pXPNeed').textContent=xpNeedFor(state.level);
    document.getElementById('pCoins').textContent=state.coins;
    document.getElementById('pNerf').textContent=state.expNerfCount||0;
    document.getElementById('cLvl').textContent=state.classLevel;
    document.getElementById('cXP').textContent=state.classXP;
    document.getElementById('cXPNeed').textContent=cxpNeedFor(state.classLevel);
    setHeader();
  }
  function missionCard(m){
    var li=document.createElement('li'); li.className='card'; li.setAttribute('data-id',m.id);
    var typeLabel = (m.type===TYPE.DAILY?'Diaria': m.type===TYPE.FOCUS?'Focus': m.type===TYPE.CLASS?'Clase':'Urgente');
    var dueTxt = m.dueAt? '<div class="small">⏳ <span class="timer">'+fmt(new Date(m.dueAt).getTime()-Date.now())+'</span></div>' : '';
    var reqHtml = m.requirements.map(function(r){ return '<div class="small">• '+r.label+'</div>'; }).join('');
    var actions = '';
    if (!m.accepted) actions += '<button data-act="accept" data-id="'+m.id+'">Aceptar</button>'+ (m.type!==TYPE.URGENT? ' <button class="ghost" data-act="reject" data-id="'+m.id+'">Rechazar</button>':'');
    actions += ' <button data-act="done" data-id="'+m.id+'">Marcar completada</button>';
    actions += ' <button class="ghost" data-act="fail" data-id="'+m.id+'">Fallar</button>';
    li.innerHTML = '<h4>'+m.title+' <span class="small">['+typeLabel+']</span></h4>'
      + '<div class="small">'+(m.desc||'')+'</div>'+ dueTxt
      + '<div class="small">Recompensa: '+(m.baseXP||0)+' XP, '+(m.baseCoins||0)+'🪙'+(m.classXP?' · '+m.classXP+' XP clase':'')+'</div>'
      + reqHtml
      + '<div class="btnrow">'+actions+'</div>';
    return li;
  }
  function renderMissions(){
    missionsList.innerHTML='';
    var pend=state.missions.filter(function(x){return x.status==='pending';});
    var hist=state.missions.filter(function(x){return x.status!=='pending';}).slice(0,8);
    pend.forEach(function(m){ missionsList.appendChild(missionCard(m)); });
    if (hist.length){
      var sep=document.createElement('li'); sep.className='card'; sep.innerHTML='<div class="small">Histórico reciente</div>'; missionsList.appendChild(sep);
      hist.forEach(function(m){ missionsList.appendChild(missionCard(m)); });
    }
  }
  var SHOP={
    consumibles:[
      {id:'time_potion', name:'Poción de tiempo (+2h)', desc:'Amplía el tiempo de una misión activa.', price:30},
      {id:'str_potion', name:'Poción de fuerza (1/2 requisitos)', desc:'Reduce requisitos.', price:40},
      {id:'exp_potion', name:'Poción de EXP (+20% 30 min)', desc:'Ganas +20% EXP durante 30 min.', price:50},
      {id:'cure', name:'Curas (quita nerfeo EXP)', desc:'Elimina -20% EXP.', price:20}
    ],
    esteticos:[
      {id:'equip_dagas', name:'Dagas dobles', desc:'Cosmético', price:60},
      {id:'equip_arco_rojo', name:'Arco rojo', desc:'Cosmético', price:80},
      {id:'equip_gafas', name:'Gafas de combate', desc:'Cosmético', price:40},
      {id:'equip_ropa_negra', name:'Ropa negra', desc:'Cosmético', price:70}
    ]
  };
  function renderShop(){
    shopConsumibles.innerHTML=''; shopEsteticos.innerHTML=''; inventoryList.innerHTML='';
    SHOP.consumibles.forEach(function(it){
      var li=document.createElement('li'); li.className='card';
      li.innerHTML='<h4>'+it.name+' — 🪙 '+it.price+'</h4><div class="small">'+it.desc+'</div><div class="btnrow"><button data-buy="'+it.id+'">Comprar</button></div>';
      shopConsumibles.appendChild(li);
    });
    SHOP.esteticos.forEach(function(it){
      var li=document.createElement('li'); li.className='card';
      li.innerHTML='<h4>'+it.name+' — 🪙 '+it.price+'</h4><div class="small">'+it.desc+'</div><div class="btnrow"><button data-buy="'+it.id+'">Comprar</button></div>';
      shopEsteticos.appendChild(li);
    });
    Object.keys(state.inventory).forEach(function(k){
      var li=document.createElement('li'); li.className='card';
      var pretty = k==='time_potion'?'Poción de tiempo':k==='str_potion'?'Poción de fuerza':k==='exp_potion'?'Poción de EXP':k==='cure'?'Curas':k;
      li.innerHTML='<h4>'+pretty+' × '+state.inventory[k]+'</h4>';
      inventoryList.appendChild(li);
    });
  }
  function renderProfile(){
    heroClass.innerHTML=''; CLASSES.forEach(function(c){ var o=document.createElement('option'); o.value=c; o.textContent=c; heroClass.appendChild(o); });
    heroName.value=state.hero.name; heroClass.value=state.hero.cls; heroGoal.value=state.hero.goal;
    var equip=document.getElementById('equipList'); if (equip){ equip.innerHTML=''; (state.equipment||[]).forEach(function(e){ var li=document.createElement('li'); li.textContent=e.replace('equip_',''); equip.appendChild(li); }); }
  }
  function renderAll(){ renderHeader(); renderMissions(); renderShop(); renderProfile(); }

  // ---------- Eventos UI ----------
  document.querySelector('.tabbar').addEventListener('click', function(e){
    var v=e.target.getAttribute('data-view'); if (!v) return;
    [].forEach.call(document.querySelectorAll('.tabbar button'), function(b){ b.classList.remove('active'); });
    e.target.classList.add('active');
    [].forEach.call(document.querySelectorAll('.view'), function(sec){ sec.classList.remove('active'); });
    document.getElementById('view-'+v).classList.add('active');
  });
  document.body.addEventListener('click', function(e){
    var t=e.target; if (!t) return;
    var buy=t.getAttribute('data-buy'); if (buy){
      var all=[].concat(SHOP.consumibles, SHOP.esteticos); var it=null;
      for (var i=0;i<all.length;i++){ if (all[i].id===buy){ it=all[i]; break; } }
      if (!it) return; if (state.coins<it.price) return alert('No tienes monedas suficientes');
      state.coins-=it.price;
      if (buy.indexOf('equip_')===0){ if (state.equipment.indexOf(buy)===-1) state.equipment.push(buy); }
      else { state.inventory[buy]=(state.inventory[buy]||0)+1; }
      save(); renderAll(); return;
    }
    var id=t.getAttribute('data-id'); var act=t.getAttribute('data-act');
    if (id&&act){
      var m=null; for (var k=0;k<state.missions.length;k++){ if (state.missions[k].id===id){ m=state.missions[k]; break; } } if (!m) return;
      if (act==='accept') acceptMission(m);
      if (act==='reject') rejectMission(m);
      if (act==='done') completeMission(m);
      if (act==='fail') failMission(m);
      return;
    }
  });
  document.getElementById('newFocusBtn').addEventListener('click', function(){
    var z=state.hero.goal||'abdomen'; var f=mkFocus(z); state.missions.unshift(f); save(); renderAll(); showPrompt(f);
  });
  document.getElementById('forceUrgentBtn').addEventListener('click', function(){
    var u=mkUrgent(); state.missions.unshift(u); save(); renderAll(); showPrompt(u,true);
  });
  document.getElementById('heroName').addEventListener('change', function(){ state.hero.name=this.value||'Amo'; save(); setHeader(); });
  document.getElementById('heroClass').addEventListener('change', function(){ state.hero.cls=this.value; save(); });
  document.getElementById('heroGoal').addEventListener('change', function(){ state.hero.goal=this.value; save(); });
  document.getElementById('resetBtn').addEventListener('click', function(){ if (confirm('¿Reiniciar todo?')){ localStorage.removeItem(LS); location.reload(); } });

  // ---------- Tick ----------
  function tick(){
    var now=Date.now(), dirty=false;
    for (var i=0;i<state.missions.length;i++){
      var m=state.missions[i];
      if (m.status==='pending' && m.dueAt && now>new Date(m.dueAt).getTime()){
        if (m.type===TYPE.CLASS && m.penalty===null){ m.status='failed'; dirty=true; }
        else { m.status='failed'; if (m.penalty){ if (m.penalty.coins) state.coins=Math.max(0,state.coins-m.penalty.coins); if (m.penalty.nerf) applyNerf(); if (m.penalty.nextHarder) state.missions.unshift(harderClone(m)); } dirty=true; }
      }
    }
    var cards=document.querySelectorAll('#missionsList .card');
    for (var j=0;j<cards.length;j++){
      var id=cards[j].getAttribute('data-id'); var mm=null;
      for (var k=0;k<state.missions.length;k++){ if (state.missions[k].id===id){ mm=state.missions[k]; break; } }
      var el=cards[j].querySelector('.timer');
      if (mm&&el&&mm.dueAt){ el.textContent=fmt(new Date(mm.dueAt).getTime()-Date.now()); }
    }
    if (dirty){ save(); renderAll(); }
  }

  // ---------- Inicio ----------
  onOpen();
  setInterval(tick,1000);
})();
