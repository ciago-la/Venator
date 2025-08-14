document.getElementById('levelInfo').textContent = 'Altervenator v10 — JS cargado';
// === Altervenator (versión completa compatible) ===
(function(){
  var LS='alter_spec_v1';
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

  // Utilidades
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
    while(state.xp >= xpNeedFor(state.level)){
      state.xp -= xpNeedFor(state.level);
      state.level += 1;
    }
  }
  function gainClassXP(base){
    state.classXP += base;
    while(state.classXP >= cxpNeedFor(state.classLevel)){
      state.classXP -= cxpNeedFor(state.classLevel);
      state.classLevel += 1;
      if (state.classLevel % 10 === 0){
        addToInventory('class_key_'+state.hero.cls, 1);
        toast('🔑 Obtuviste una llave de clase');
      }
    }
  }
  function applyNerf(){ state.expNerfCount = Math.min(9, (state.expNerfCount||0)+3); }
  function decayNerf(){ if (state.expNerfCount>0) state.expNerfCount--; }
  function addToInventory(id, n){ state.inventory[id]=(state.inventory[id]||0)+n; }

  // Diaria (calendario)
  var DAILY_ROTATION = {
    1: ['Flexiones 5×2','Sentadillas 10×2','Abdominales 20×2'],
    2: ['Dominadas 5/3','Zancadas 4/4','Puente glúteo 7'],
    3: ['Fondos tríceps 5','Patada lateral 3×2','Plancha 10s'],
    4: ['Flexiones 5×2','Sentadillas 10×2','Abdominales 20×2'],
    5: ['Dominadas 5/3','Zancadas 4/4','Puente glúteo 7'],
    6: ['Fondos tríceps 5','Patada lateral 3×2','Plancha 10s'],
    0: ['Elevación piernas 5×2','Combo saco/sombra (detalle)','Sombra intensa 30s']
  };

  // Focus (zona)
  var FOCUS_TEMPLATES = {
    abdomen:['Crunches','Elevación de piernas','Criss cross','Plancha (s)'],
    brazos:['Fondos tríceps','Curl bíceps (peso)','Flexiones tríceps','Dominadas supinas'],
    piernas:['Sentadillas','Lunges','Puente glúteos','Sentadillas salto'],
    pecho:['Flexiones','Press pecho (peso)','Aperturas','Rebotes flexión/press'],
    espalda:['Dominadas','Remo en plancha','Remo en banco','Cargadas'],
    hombros:['Elevaciones laterales','Flexiones pica','Press militar','Elevaciones frontales']
  };

  var TYPE = { DAILY:'daily', FOCUS:'focus', CLASS:'class', URGENT:'urgent', CUSTOM:'custom' };

  function mkDaily(){
    var now=new Date();
    var due = (now < today10()) ? new Date(Math.min(now.getTime()+14*3600*1000, endOfDay().getTime())) : endOfDay();
    var reqText = DAILY_ROTATION[now.getDay()];
    return {
      id:uid(), type:TYPE.DAILY, title:'Misión diaria', desc:'Obligatoria de hoy.',
      createdAt: now.toISOString(), dueAt: due.toISOString(), accepted:true, status:'pending',
      baseXP:40, baseCoins:6,
      requirements: reqText.map(function(s){ return {label:s, progress:0, count:1, unit:'set'}; }),
      penalty:{coins:6, nerf:true, nextHarder:true, harderFactor:2.0}
    };
  }

  function mkFocus(zone){
    var now=new Date();
    var base=10; var lvl=state.level;
    if (lvl>=5 && lvl<=9) base=18; else if (lvl>=10 && lvl<=20) base=25; else if (lvl>=21) base=30;
    var reqs=(FOCUS_TEMPLATES[zone]||FOCUS_TEMPLATES.abdomen).slice(0,4)
      .map(function(n){ return {label:n, progress:0, count:base, unit: (n.indexOf('(s)')>-1?'s':'reps')}; });
    return {
      id:uid(), type:TYPE.FOCUS, title:'Focus '+zone, desc:'Sesión de '+zone+'. (No afecta clase)',
      createdAt: now.toISOString(), dueAt: new Date(now.getTime()+8*3600*1000).toISOString(), accepted:false, status:'pending',
      baseXP:80, baseCoins:10, requirements:reqs,
      penalty:{coins:8, nerf:true, nextHarder:true, harderFactor:1.5}
    };
  }

  function classPreset(cls){
    var R={};
    R['Asesino']=['Saltos pliometría x10/lado ×2','Salto reactivo 20','Burpees 8','Cangrejo 33 pasos','Burpees con pino 9','Saltos estrella 33','Spidermans 30'];
    R['Guerrero']=['Repite misión diaria','Repite misión focus','3 golpes espada pesada ×10','Combo 5 golpes espada'];
    R['Mago']=['Patadas con reacción (rápidas)','Punching ball 1min ×2','Reflejos con pelotas'];
    R['Arquero']=['10 side/front kicks + 5 scorpions/lado','Combo nuevo ×6','20 pasos rana + 20 mono','20 pasos cocodrilo','Dispara 100 flechas','Dispara 20 flechas saltando'];
    R['Espía']=['Estirar caderas 3×30s','Flexibilidad piernas 3×30s','Equilibrios 30s/pierna','Lanza 50 cuchillos','Lanza 20 cuchillos saltando'];
    R['Maratón']=['Corre 5 km en 30 min','4 sprints de 100 m'];
    R['Amigo del dragón']=['Derrota a 1 contrincante','Recorrido con ≥3 obstáculos','Movimiento volador ×10','Derribo ×10','Patada ×10','Puñetazo ×10'];
    R['Saltamontes']=['Agarre 20s ×10','Agarre 30 reps c/lado 30kg','Haz un bloque ×3','Haz una vía ×3'];
    return (R[cls]||R['Asesino']).slice(0,2);
  }

  function mkClassMission(){
    var now=new Date(); var cls=state.hero.cls;
    var reqs = classPreset(cls).map(function(t){ return {label:t, progress:0, count:1, unit:'set'}; });
    return {
      id:uid(), type:TYPE.CLASS, title:'Misión de clase — '+cls, desc:'Entrenamiento de '+cls,
      createdAt: now.toISOString(), dueAt: new Date(now.getTime()+12*3600*1000).toISOString(), accepted:false, status:'pending',
      baseXP:70, classXP:70, baseCoins:9, requirements:reqs, bonusObjs:['rare_'+cls.replace(/\s/g,'_')], penalty:null
    };
  }

  var URGENT_TPL=[ // 20% loot chance
    {name:'Domador de Dragones', reqs:['Sprint 200m ×5','Flexiones 40','Plancha 60s','Prueba de clase (aleatoria)'], loot:['aliento_dragón','escamas_dragón','huevo_dragón','amigo_dragón','sangre_dragón']},
    {name:'Asesino de reyes', reqs:['Burpees 30','Sentadillas salto 30','Hollow hold 30s','Prueba de clase (aleatoria)'], loot:['corona_maldita','cetro_poder','espada_triple','proteccion_princesa','colgante_reina']},
    {name:'Ciervo de mil ojos avistado', reqs:['Sprints 50m ×10','Zancadas 20/20','Plancha lateral 30s/lado','Prueba de clase (aleatoria)'], loot:['ojos_azules_3','cuerno_arbol_rojo','armadura_piel_magica','frasco_aliento_bosque','semilla_antigua']},
    {name:'Robo en la torre de maná', reqs:['Jumping jacks 80','Flexiones inclinadas 25','Planchas escaladas 40','Prueba de clase (aleatoria)'], loot:['pocion_mana_potente','libro_conjuros','daga_oscuridad','diente_fuego','llave_celda_oscura']},
    {name:'Asalto al coloso de hierro', reqs:['Sentadilla isométrica 60s','Flexiones pike 20','Mountain climbers 60','Prueba de clase (aleatoria)'], loot:['armadura_voladora','botas_viento','maza_terremoto','latigo_azul','tunica_albores_alvaros']}
  ];
  function mkUrgent(){
    var now=new Date(); var t=URGENT_TPL[Math.floor(Math.random()*URGENT_TPL.length)];
    var reqs=t.reqs.map(function(x){ return {label:x, progress:0, count:1, unit:'set'}; });
    return {
      id:uid(), type:TYPE.URGENT, title:'Misión urgente: '+t.name, desc:'Alta prioridad.',
      createdAt: now.toISOString(), dueAt: new Date(now.getTime()+5*3600*1000).toISOString(), accepted:true, status:'pending',
      baseXP:120, baseCoins:15, requirements:reqs, loot:t.loot,
      penalty:{coins:10, nerf:true, nextHarder:true, harderFactor:1.25}
    };
  }

  function harderClone(m){
    var n=JSON.parse(JSON.stringify(m));
    n.id=uid(); n.status='pending'; n.accepted=true;
    n.title = m.title+' — Versión dura';
    n.dueAt = new Date(Date.now()+6*3600*1000).toISOString();
    n.penalty=null;
    var factor=(m.penalty && m.penalty.harderFactor)?m.penalty.harderFactor:1.25;
    for (var i=0;i<n.requirements.length;i++){
      var lab=n.requirements[i].label;
      var match=lab.match(/(\d+)/g);
      if (match){ n.requirements[i].label = lab.replace(/(\d+)/g, function(x){ return String(Math.ceil(parseInt(x,10)*factor)); }); }
      n.requirements[i].count = Math.ceil((n.requirements[i].count||1)*factor);
    }
    return n;
  }

  // Generación
  function ensureDaily(){
    var t=todayStr(); var has=false;
    for (var i=0;i<state.missions.length;i++){
      var m=state.missions[i];
      if (m.type==='daily' && m.status==='pending' && m.createdAt.slice(0,10)===t){ has=true; break; }
    }
    if (!has){ var d=mkDaily(); state.missions.unshift(d); showMissionPrompt(d); }
  }
  function ensureClass(){
    var has=false;
    for (var i=0;i<state.missions.length;i++){ if (state.missions[i].type==='class' && state.missions[i].status==='pending'){ has=true; break; } }
    if (!has){ var c=mkClassMission(); state.missions.unshift(c); showMissionPrompt(c); }
  }
  function maybeUrgent(){
    var wk=weekKey(); var used=state.weeklyUrgents[wk]||0; if (used>=3) return;
    if (Math.random()<0.25){ var u=mkUrgent(); state.missions.unshift(u); state.weeklyUrgents[wk]=used+1; save(); showMissionPrompt(u,true); }
  }
  function onOpen(){
    var t=todayStr();
    if (state.lastSeenDay!==t){
      for (var i=0;i<state.missions.length;i++){
        var m=state.missions[i];
        if (m.type==='daily' && m.status==='pending' && m.createdAt.slice(0,10)!==t){
          if (Date.now()>new Date(m.dueAt).getTime()) failMission(m,true);
        }
      }
      state.lastSeenDay=t;
    }
    ensureDaily(); ensureClass(); maybeUrgent(); save(); renderAll();
  }

  // Acciones
  function acceptMission(m){ if (m.accepted) return; m.accepted=true; save(); renderAll(); }
  function rejectMission(m){ if (m.type==='urgent') return; m.status='rejected'; save(); renderAll(); toast('❌ Misión rechazada'); }
  function completeMission(m){
    if (m.status!=='pending') return;
    m.status='completed';
    gainXP(m.baseXP||0);
    if (m.classXP) gainClassXP(m.classXP);
    state.coins += (m.baseCoins||0);
    decayNerf();
    if (m.type==='urgent' && Math.random()<0.20 && m.loot && m.loot.length){
      var item=m.loot[Math.floor(Math.random()*m.loot.length)];
      addToInventory(item,1);
      showNotif('Objeto raro recibido', 'Has obtenido: '+item, 'blue');
    }
    save(); renderAll();
    showNotif('Has completado la misión', m.title+' • +'+(m.baseXP||0)+' XP, +'+(m.baseCoins||0)+'🪙', colorFor(m));
  }
  function failMission(m, silent){
    if (m.status!=='pending') return;
    m.status='failed';
    if (m.penalty){
      if (m.penalty.coins) state.coins=Math.max(0, state.coins-m.penalty.coins);
      if (m.penalty.nerf) applyNerf();
      if (m.penalty.nextHarder) state.missions.unshift(harderClone(m));
    }
    save(); renderAll(); if(!silent) toast('⛔ Penalización aplicada');
  }

  // UI refs
  var missionsList=document.getElementById('missionsList');
  var shopConsumibles=document.getElementById('shopConsumibles');
  var shopEsteticos=document.getElementById('shopEsteticos');
  var inventoryList=document.getElementById('inventoryList');
  var heroName=document.getElementById('heroName');
  var heroClass=document.getElementById('heroClass');
  var heroGoal=document.getElementById('heroGoal');

  function renderHeader(){
    var need=xpNeedFor(state.level);
    document.getElementById('levelInfo').textContent='Lvl '+state.level+' · '+state.xp+' / '+need+' XP · '+state.coins+'🪙';
    document.getElementById('pLvl').textContent=state.level;
    document.getElementById('pXP').textContent=state.xp;
    document.getElementById('pXPNeed').textContent=need;
    document.getElementById('pCoins').textContent=state.coins;
    document.getElementById('pNerf').textContent=state.expNerfCount||0;
    document.getElementById('cLvl').textContent=state.classLevel;
    document.getElementById('cXP').textContent=state.classXP;
    document.getElementById('cXPNeed').textContent=cxpNeedFor(state.classLevel);
  }

  function missionCard(m){
    var li=document.createElement('li'); li.className='card'; li.setAttribute('data-id',m.id);
    var dueLeft = m.dueAt ? Math.max(0, new Date(m.dueAt).getTime()-Date.now()) : 0;
    var typeLabel = (m.type==='daily'?'Diaria': m.type==='focus'?'Focus': m.type==='class'?'Clase':'Urgente');
    li.innerHTML = '<h4>'+m.title+' <span class="badge">'+typeLabel+'</span></h4>'
      + '<div class="small">'+(m.desc||'')+'</div>'
      + (m.dueAt? '<div class="topright timer">⏳ '+fmt(dueLeft)+'</div>':'' )
      + '<div class="small">Recompensa: '+(m.baseXP||0)+' XP, '+(m.baseCoins||0)+'🪙'+(m.classXP?' · '+m.classXP+' XP de clase':'')+'</div>';
    var reqDiv=document.createElement('div'); reqDiv.className='small';
    for (var i=0;i<m.requirements.length;i++){ var r=m.requirements[i]; var p=document.createElement('div'); p.textContent='• '+r.label; reqDiv.appendChild(p); }
    li.appendChild(reqDiv);
    var row=document.createElement('div'); row.className='btnrow';
    if (!m.accepted) row.innerHTML += '<button data-act="accept" data-id="'+m.id+'">Aceptar</button>'+ (m.type!=='urgent'? '<button data-act="reject" class="ghost" data-id="'+m.id+'">Rechazar</button>':'');
    row.innerHTML += '<button data-act="done" data-id="'+m.id+'">Marcar completada</button>';
    row.innerHTML += '<button data-act="fail" class="ghost" data-id="'+m.id+'">Fallar</button>';
    if (state.inventory.time_potion) row.innerHTML += '<button data-act="use_time" class="ghost" data-id="'+m.id+'">Usar ⏱️</button>';
    if (state.inventory.str_potion) row.innerHTML += '<button data-act="use_str" class="ghost" data-id="'+m.id+'">Usar 💪</button>';
    li.appendChild(row);
    return li;
  }

  var SHOP={
    consumibles:[
      {id:'time_potion', name:'Poción de tiempo (+2h)', desc:'Amplía el tiempo de una misión activa.', price:30},
      {id:'str_potion', name:'Poción de fuerza (1/2 requisitos)', desc:'Reduce requisitos de una misión activa.', price:40},
      {id:'exp_potion', name:'Poción de EXP (+20% 30 min)', desc:'Ganas +20% EXP durante 30 min.', price:50},
      {id:'cure', name:'Curas (quita nerfeo EXP)', desc:'Elimina penalización -20% EXP.', price:20}
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
      li.innerHTML='<h4>'+it.name+' <span class="badge">🪙 '+it.price+'</span></h4><div class="small">'+it.desc+'</div><div class="btnrow"><button data-buy="'+it.id+'">Comprar</button></div>';
      shopConsumibles.appendChild(li);
    });
    SHOP.esteticos.forEach(function(it){
      var li=document.createElement('li'); li.className='card';
      li.innerHTML='<h4>'+it.name+' <span class="badge">🪙 '+it.price+'</span></h4><div class="small">'+it.desc+'</div><div class="btnrow"><button data-buy="'+it.id+'">Comprar</button></div>';
      shopEsteticos.appendChild(li);
    });
    var inv=state.inventory; var keys=Object.keys(inv);
    if (!keys.length){ var li2=document.createElement('li'); li2.className='card'; li2.innerHTML='<div class="small">Inventario vacío</div>'; inventoryList.appendChild(li2); }
    keys.forEach(function(k){
      var label = k==='time_potion'?'Poción de tiempo':k==='str_potion'?'Poción de fuerza':k==='exp_potion'?'Poción de EXP':k==='cure'?'Curas':k;
      var li=document.createElement('li'); li.className='card';
      li.innerHTML='<h4>'+label+' × '+inv[k]+'</h4>';
      var row=document.createElement('div'); row.className='btnrow';
      if (k==='exp_potion') row.innerHTML='<button data-use-global="exp_potion">Activar (+20% 30 min)</button>';
      else if (k==='cure') row.innerHTML='<button data-use-global="cure">Usar (quitar nerfeo)</button>';
      else row.innerHTML='<div class="small">Úsala desde la tarjeta de una misión</div>';
      li.appendChild(row); inventoryList.appendChild(li);
    });
  }

  function renderProfile(){
    heroClass.innerHTML=''; CLASSES.forEach(function(c){ var o=document.createElement('option'); o.value=c; o.textContent=c; heroClass.appendChild(o); });
    heroName.value=state.hero.name; heroClass.value=state.hero.cls; heroGoal.value=state.hero.goal;
    var equip=document.getElementById('equipList'); equip.innerHTML=''; (state.equipment||[]).forEach(function(e){ var li=document.createElement('li'); li.textContent=e.replace('equip_',''); equip.appendChild(li); });
  }

  function renderAll(){ renderHeader(); renderMissions(); renderShop(); renderProfile(); }

  // Overlay (notificaciones)
  var overlay=document.getElementById('overlay'), card=document.getElementById('overlayCard');
  var ovTitle=document.getElementById('ovTitle'), ovBody=document.getElementById('ovBody'), ovButtons=document.getElementById('ovButtons');

  function colorFor(m){ return m.type==='urgent'?'red': (m.type==='class'?'purple':'blue'); }
  function showMissionPrompt(m, forceAccept){
    card.className='overlay-card '+colorFor(m);
    ovTitle.textContent='Nueva misión';
    ovBody.textContent='Tienes una misión: '+m.title+' — ¿Aceptas?';
    ovButtons.innerHTML='';
    var b1=document.createElement('button'); b1.textContent='Aceptar'; b1.onclick=function(){ acceptMission(m); hideOverlay(); };
    ovButtons.appendChild(b1);
    if (!forceAccept && m.type!=='urgent'){
      var b2=document.createElement('button'); b2.textContent='Rechazar'; b2.className='ghost'; b2.onclick=function(){ rejectMission(m); hideOverlay(); };
      ovButtons.appendChild(b2);
    }
    overlay.classList.remove('hidden');
  }
  function showNotif(title, body, color){
    card.className='overlay-card '+(color||'blue'); ovTitle.textContent=title; ovBody.textContent=body; ovButtons.innerHTML='';
    var b=document.createElement('button'); b.textContent='Aceptar'; b.onclick=hideOverlay; ovButtons.appendChild(b);
    overlay.classList.remove('hidden');
  }
  function hideOverlay(){ overlay.classList.add('hidden'); }

  // Navegación y clicks
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
      var all=[].concat(SHOP.consumibles, SHOP.esteticos);
      var it=null; for (var i=0;i<all.length;i++){ if (all[i].id===buy){ it=all[i]; break; } }
      if (!it) return; if (state.coins<it.price) return alert('No tienes monedas suficientes');
      state.coins -= it.price;
      if (buy.indexOf('equip_')===0){ if (state.equipment.indexOf(buy)===-1) state.equipment.push(buy); }
      else { addToInventory(buy,1); }
      save(); renderAll(); return;
    }
    var useG=t.getAttribute('data-use-global'); if (useG){
      if (!state.inventory[useG] || state.inventory[useG]<=0) return alert('No tienes ese objeto');
      if (useG==='exp_potion'){ state.expBuffUntil=Date.now()+30*60*1000; state.inventory[useG]--; toast('📈 +20% EXP 30 min'); }
      if (useG==='cure'){ state.expNerfCount=0; state.inventory[useG]--; toast('✨ Nerfeo eliminado'); }
      save(); renderAll(); return;
    }
    var id=t.getAttribute('data-id'); var act=t.getAttribute('data-act'); if (!id||!act) return;
    var m=null; for (var k=0;k<state.missions.length;k++){ if (state.missions[k].id===id){ m=state.missions[k]; break; } } if (!m) return;
    if (act==='accept') acceptMission(m);
    if (act==='reject') rejectMission(m);
    if (act==='done') completeMission(m);
    if (act==='fail') failMission(m);
    if (act==='use_time'){
      if (!state.inventory.time_potion) return alert('No tienes poción de tiempo');
      if (!m.dueAt) return alert('Esta misión no tiene tiempo');
      m.dueAt=new Date(new Date(m.dueAt).getTime()+2*3600*1000).toISOString(); state.inventory.time_potion--; save(); renderAll(); toast('⏱️ +2h añadidas'); 
    }
    if (act==='use_str'){
      if (!state.inventory.str_potion) return alert('No tienes poción de fuerza');
      m.requirements = m.requirements.map(function(r){ r.label=r.label+' (HALF)'; return r; });
      state.inventory.str_potion--; save(); renderAll(); toast('💪 Requisitos reducidos');
    }
  });

  document.getElementById('newFocusBtn').addEventListener('click', function(){
    var z=state.hero.goal||'abdomen'; var f=mkFocus(z); state.missions.unshift(f); save(); renderAll(); showMissionPrompt(f);
  });
  document.getElementById('forceUrgentBtn') && document.getElementById('forceUrgentBtn').addEventListener('click', function(){
    var u=mkUrgent(); state.missions.unshift(u); save(); renderAll(); showMissionPrompt(u,true);
  });

  heroName.addEventListener('change', function(){ state.hero.name=this.value||'Amo'; save(); renderHeader(); });
  heroClass.addEventListener('change', function(){ state.hero.cls=this.value; save(); });
  heroGoal.addEventListener('change', function(){ state.hero.goal=this.value; save(); });
  document.getElementById('resetBtn').addEventListener('click', function(){ if(confirm('¿Reiniciar todo?')){ localStorage.removeItem(LS); location.reload(); } });

  // Tickers
  function tick(){
    var now=Date.now(), dirty=false;
    for (var i=0;i<state.missions.length;i++){
      var m=state.missions[i];
      if (m.status==='pending' && m.dueAt && now>new Date(m.dueAt).getTime()){
        if (m.type==='class' && m.penalty===null){ m.status='failed'; dirty=true; } else { failMission(m,true); dirty=true; }
      }
    }
    var cards=document.querySelectorAll('#missionsList .card');
    for (var j=0;j<cards.length;j++){
      var el=cards[j].querySelector('.timer'); var id=cards[j].getAttribute('data-id');
      if (!el||!id) continue; var mm=null; for (var k=0;k<state.missions.length;k++){ if (state.missions[k].id===id){ mm=state.missions[k]; break; } }
      if (mm && mm.dueAt){ el.textContent='⏳ '+fmt(Math.max(0,new Date(mm.dueAt).getTime()-Date.now())); }
    }
    if (dirty){ save(); renderAll(); }
  }

  // Toast
  var toastEl;
  function toast(msg){
    if (!toastEl){
      toastEl=document.createElement('div');
      toastEl.style.position='fixed'; toastEl.style.left='50%'; toastEl.style.bottom='80px';
      toastEl.style.transform='translateX(-50%)'; toastEl.style.background='rgba(15,20,34,.95)';
      toastEl.style.border='1px solid rgba(110,168,255,.35)'; toastEl.style.borderRadius='10px';
      toastEl.style.padding='10px 14px'; toastEl.style.color='#e8ecff'; toastEl.style.zIndex=9999;
      document.body.appendChild(toastEl);
    }
    toastEl.textContent=msg; toastEl.style.opacity='1'; setTimeout(function(){ toastEl.style.opacity='0'; }, 2200);
  }

  // Inicio
  onOpen(); renderAll(); setInterval(tick, 1000);
})();
