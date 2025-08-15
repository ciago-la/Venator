// === Altervenator v13s5 — Diaria + Clase + Urgentes + Tienda + Focus + Perfiles ===
(function(){
  // ---------- Panel visible si hay error ----------
  window.addEventListener('error', function(e){
    var b=document.body; var d=document.createElement('div');
    d.style.cssText='position:fixed;top:0;left:0;right:0;background:#300;padding:8px;color:#fff;z-index:99999;font:14px monospace';
    d.textContent='JS ERROR: '+(e.message||e.filename||'desconocido');
    b.appendChild(d);
  });

  // ---------- Estado ----------
  var LS='alter_v13s5';
  var LS_PROFILES='alter_profiles_v1';
  var CLASSES=['Guerrero','Asesino','Mago','Arquero','Espía','Maratón','Amigo del dragón','Saltamontes'];

  var state = load() || {
    hero:{name:'Amo', cls:'Asesino', goal:'abdomen'},
    xp:0, level:1, coins:0,
    classXP:0, classLevel:1,
    expBuffUntil:0, expNerfCount:0,
    missions:[],                 // {id,type,title,desc,createdAt,dueAt,status,accepted,requirements[],baseXP,baseCoins,classXP?,penalty?,loot?}
    weeklyUrgents:{},
    inventory:{ time_potion:1, str_potion:0, exp_potion:0, cure:0 },
    equipment:[],
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
  function weekKey(){
    var d=new Date();
    var a=new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    a.setUTCDate(a.getUTCDate()+4-(a.getUTCDay()||7));
    var y=new Date(Date.UTC(a.getUTCFullYear(),0,1));
    var w=Math.ceil((((a-y)/86400000)+1)/7);
    return a.getUTCFullYear()+'-W'+('0'+w).slice(-2);
  }

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
  var TYPE={DAILY:'daily', CLASS:'class', URGENT:'urgent', FOCUS:'focus'};

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

  // Plantillas Focus por objetivo
  var FOCUS_TPL={
    abdomen:['Crunches','Elevación de piernas','Criss cross','Plancha (s)'],
    brazos:['Fondos tríceps','Curl bíceps (peso)','Flexiones tríceps','Dominadas supinas'],
    piernas:['Sentadillas','Lunges','Puente glúteos','Sentadillas salto'],
    pecho:['Flexiones','Press pecho (peso)','Aperturas','Rebotes flexión/press'],
    espalda:['Dominadas','Remo en plancha','Remo en banco','Cargadas'],
    hombros:['Elevaciones laterales','Flexiones pica','Press militar','Elevaciones frontales']
  };

  var URGENT_TPL=[
    {name:'Domador de Dragones', reqs:['Sprint 200 m ×5','Flexiones 40','Plancha 60 s','Prueba de clase (aleatoria)'], loot:['aliento_dragón','escamas_dragón','huevo_dragón','amigo_dragón','sangre_dragón']},
    {name:'Asesino de reyes', reqs:['Burpees 30','Sentadillas salto 30','Hollow hold 30 s','Prueba de clase (aleatoria)'], loot:['corona_maldita','cetro_poder','espada_triple','proteccion_princesa','colgante_reina']},
    {name:'Ciervo de mil ojos avistado', reqs:['Sprints 50 m ×10','Zancadas 20/20','Plancha lateral 30 s/lado','Prueba de clase (aleatoria)'], loot:['ojos_azules_3','cuerno_arbol_rojo','armadura_piel_magica','frasco_aliento_bosque','semilla_antigua']},
    {name:'Robo en la torre de maná', reqs:['Jumping jacks 80','Flexiones inclinadas 25','Planchas escaladas 40','Prueba de clase (aleatoria)'], loot:['pocion_mana_potente','libro_conjuros','daga_oscuridad','diente_fuego','llave_celda_oscura']},
    {name:'Asalto al coloso de hierro', reqs:['Sentadilla isométrica 60 s','Flexiones pike 20','Mountain climbers 60','Prueba de clase (aleatoria)'], loot:['armadura_voladora','botas_viento','maza_terremoto','latigo_azul','tunica_albores_alvaros']}
  ];

  // ---------- Tienda ----------
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

  // ---------- Iconos base64 ----------
  var ICONS = {
    time_potion:'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2NCIgaGVpZ2h0PSI2NCI+PGNpcmNsZSBjeD0iMzIiIGN5PSIzMiIgcj0iMzAiIGZpbGw9IiMwYzExMjAiIHN0cm9rZT0iIzZlYThmZiIgc3Ryb2tlLXdpZHRoPSIzIi8+PHRleHQgeD0iMzIiIHk9IjM4IiBmb250LXNpemU9IjI4IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjNmVhOGZmIj7wn5CRPC90ZXh0Pjwvc3ZnPg==',
    str_potion:'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2NCIgaGVpZ2h0PSI2NCI+PHJlY3QgeD0iNiIgeT0iNiIgd2lkdGg9IjUyIiBoZWlnaHQ9IjUyIiByeD0iMTAiIGZpbGw9IiMwYzExMjAiIHN0cm9rZT0iI2E2NmJmZiIgc3Ryb2tlLXdpZHRoPSIzIi8+PHRleHQgeD0iMzIiIHk9IjQwIiBmb250LXNpemU9IjI4IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjYTY2YmZmIj7ilqU8L3RleHQ+PC9zdmc+',
    exp_potion:'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2NCIgaGVpZ2h0PSI2NCI+PGNpcmNsZSBjeD0iMzIiIGN5PSIzMiIgcj0iMzAiIGZpbGw9IiMwYzExMjAiIHN0cm9rZT0iIzZlYThmZiIgc3Ryb2tlLXdpZHRoPSIzIi8+PHRleHQgeD0iMzIiIHk9IjM4IiBmb250LXNpemU9IjI0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjNmVhOGZmIj5YUDwvdGV4dD48L3N2Zz4=',
    cure:'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2NCIgaGVpZ2h0PSI2NCI+PHJlY3QgeD0iNiIgeT0iNiIgd2lkdGg9IjUyIiBoZWlnaHQ9IjUyIiByeD0iMTAiIGZpbGw9IiMwYzExMjAiIHN0cm9rZT0iIzVjZmZjMCIgc3Ryb2tlLXdpZHRoPSIzIi8+PHRleHQgeD0iMzIiIHk9IjQwIiBmb250LXNpemU9IjI2IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjNWNmZmMwIj7imJg8L3RleHQ+PC9zdmc+',
    equip_dagas:'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTIwIDYwIEw0MCA0MCBMIDM1IDM1IEwgMTUgNTUgWiIgZmlsbD0iIzZlYThmZiIvPjxwYXRoIGQ9Ik02MCAyMCBMNDAgNDAgTDQ1IDQ1IEw2NSAyNSBaIiBmaWxsPSIjYTY2YmZmIi8+PC9zdmc+',
    equip_arco_rojo:'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iOTAiIGhlaWdodD0iOTAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTIwIDgwIFE3MCA0NSAyMCAxMCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZmY1YzdhIiBzdHJva2Utd2lkdGg9IjYiLz48bGluZSB4MT0iMjAiIHkxPSI4MCIgeDI9IjIwIiB5Mj0iMTAiIHN0cm9rZT0iI2ZmNWM3YSIgc3Rva2Utd2lkdGg9IjIiLz48L3N2Zz4=',
    equip_gafas:'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3QgeD0iNSIgeT0iOCIgd2lkdGg9IjI4IiBoZWlnaHQ9IjE2IiByeD0iNCIgZmlsbD0iIzZlYThmZiIvPjxyZWN0IHg9IjQ3IiB5PSI4IiB3aWR0aD0iMjgiIGhlaWdodD0iMTYiIHJ4PSI0IiBmaWxsPSIjNmVhOGZmIi8+PHJlY3QgeD0iMzMiIHk9IjE0IiB3aWR0aD0iMTQiIGhlaWdodD0iNCIgZmlsbD0iI2E2NmJmZiIvPjwvc3ZnPg==',
    equip_ropa_negra:'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTEwIDIwIEwzMCAxMCBMNTAgMjAgTDQ1IDU1IEwxNSA1NSBaIiBmaWxsPSIjMTIxODIyIiBzdHJva2U9IiM2ZWE4ZmYiIHN0cm9rZS13aWR0aD0iMiIvPjwvc3ZnPg=='
  };

  // ---------- Focus: generador ----------
  function focusBaseByLevel(lvl){
    if (lvl>=21) return 30;
    if (lvl>=10) return 25;
    if (lvl>=5)  return 18;
    return 10;
  }
  function mkFocus(zone){
    var now=new Date();
    var base=focusBaseByLevel(state.level);
    var tpl=FOCUS_TPL[zone]||FOCUS_TPL.abdomen;
    var reqs=tpl.slice(0,4).map(function(n){
      return {label: n + (/\(s\)/.test(n)?(' '+base+'s'):(' '+base))};
    });
    return {
      id:uid(), type:TYPE.FOCUS, title:'Focus — '+zone, desc:'Sesión focalizada en '+zone,
      createdAt: now.toISOString(), dueAt: new Date(now.getTime()+8*3600*1000).toISOString(),
      status:'pending', accepted:false,
      baseXP:80, baseCoins:10, requirements:reqs,
      penalty:{coins:8, nerf:true, nextHarder:true, harderFactor:1.5}
    };
  }
  function mkUrgent(){
    var now=new Date(); var t=URGENT_TPL[Math.floor(Math.random()*URGENT_TPL.length)];
    return {
      id:uid(), type:TYPE.URGENT, title:'Misión urgente: '+t.name, desc:'Alta prioridad (no se puede rechazar).',
      createdAt: now.toISOString(), dueAt: new Date(now.getTime()+5*3600*1000).toISOString(),
      status:'pending', accepted:true,
      baseXP:120, baseCoins:15, requirements:t.reqs.map(function(x){return {label:x};}),
      penalty:{coins:10, nerf:true, nextHarder:true, harderFactor:1.25},
      loot:t.loot
    };
  }
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
      penalty:null
    };
  }
  function harderClone(m){
    var n=JSON.parse(JSON.stringify(m)); n.id=uid(); n.status='pending'; n.accepted=true;
    n.title=m.title+' — Versión dura'; n.dueAt=new Date(Date.now()+6*3600*1000).toISOString();
    n.penalty=null;
    var f=(m.penalty&&m.penalty.harderFactor)?m.penalty.harderFactor:1.25;
    n.requirements=n.requirements.map(function(r){
      return {label:r.label.replace(/(\d+)/g,function(x){return String(Math.ceil(parseInt(x,10)*f));})};
    });
    return n;
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
    card.className='overlay-card '+(color||'blue');
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
  function showPromptUrgent(m){
    card.className='overlay-card red';
    ovTitle.textContent='¡Misión urgente!';
    ovBody.textContent='Ha aparecido: '+m.title+'. Debes aceptarla.';
    ovButtons.innerHTML='';
    var ok=document.createElement('button'); ok.textContent='Aceptar'; ok.onclick=hideOverlay; ovButtons.appendChild(ok);
    overlay.classList.remove('hidden');
  }
  function hideOverlay(){ overlay.classList.add('hidden'); }

  // ---------- Perfiles ----------
  function getProfiles(){ try{ return JSON.parse(localStorage.getItem(LS_PROFILES)) || {}; }catch(e){ return {}; } }
  function setProfiles(p){ localStorage.setItem(LS_PROFILES, JSON.stringify(p)); }
  function refreshProfileList(){
    var span=document.getElementById('profileList'); if(!span) return;
    var names=Object.keys(getProfiles());
    span.textContent = names.length? names.join(', ') : '(vacío)';
  }

  // ---------- Generación al abrir ----------
  function rolloverDailyIfNeeded(){
    var t=todayStr();
    if (state.lastSeenDay!==t){
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
      showInfo('Misión diaria', 'Se ha generado tu misión diaria de hoy.');
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
  function maybeUrgent(){
    var wk=weekKey(); var used=state.weeklyUrgents[wk]||0; if (used>=3) return;
    if (Math.random()<0.25){
      var u=mkUrgent(); state.missions.unshift(u); state.weeklyUrgents[wk]=used+1; save(); renderAll(); showPromptUrgent(u);
    }
  }

  // ---------- Acciones de misión ----------
  function completeMission(m){
    if (!m || m.status!=='pending') return;
    if ((m.type===TYPE.CLASS || m.type===TYPE.FOCUS) && !m.accepted) return showInfo('Acepta primero','Debes aceptar la misión.','blue');
    m.status='completed';
    gainXP(m.baseXP||0);
    if (m.classXP) gainClassXP(m.classXP);
    state.coins += (m.baseCoins||0);
    decayNerf();
    if (m.type===TYPE.URGENT && Math.random()<0.20 && m.loot && m.loot.length){
      var item=m.loot[Math.floor(Math.random()*m.loot.length)];
      state.inventory[item]=(state.inventory[item]||0)+1;
      showInfo('Objeto raro recibido','Has obtenido: '+item,'blue');
    }
    save(); renderAll();
    var extra = m.classXP ? (' · +'+m.classXP+' XP clase') : '';
    var col = m.type===TYPE.CLASS?'purple': (m.type===TYPE.URGENT?'red': (m.type===TYPE.FOCUS?'blue':'blue'));
    showInfo('Misión completada','Has ganado +'+(m.baseXP||0)+' XP y +'+(m.baseCoins||0)+'🪙'+extra, col);
  }
  function failMission(m){
    if (!m || m.status!=='pending') return;
    m.status='failed';
    if (m.penalty){
      if (m.penalty.coins) state.coins=Math.max(0,state.coins-m.penalty.coins);
      if (m.penalty.nerf) applyNerf();
      if (m.penalty.nextHarder){ state.missions.unshift(harderClone(m)); }
    }
    save(); renderAll();
    var col = m.type===TYPE.CLASS?'purple': (m.type===TYPE.URGENT?'red':'blue');
    showInfo('Misión fallida', (m.type===TYPE.CLASS?'Sin penalización.':'Se aplicó la penalización.'), col);
  }

  // ---------- Consumibles a misión ----------
  function add2h(m){
    if (!m.dueAt) return;
    m.dueAt = new Date(new Date(m.dueAt).getTime() + 2*3600*1000).toISOString();
  }
  function halfRequirements(m){
    if (!m.requirements) return;
    m.requirements = m.requirements.map(function(r){
      return {label: r.label.replace(/(\d+)/g, function(x){
        var v=Math.max(1, Math.floor(parseInt(x,10)/2));
        return String(v);
      })};
    });
  }

  // ---------- Render ----------
  var missionsList=document.getElementById('missionsList');
  var shopConsumibles=document.getElementById('shopConsumibles');
  var shopEsteticos=document.getElementById('shopEsteticos');
  var inventoryList=document.getElementById('inventoryList');

  var heroName=document.getElementById('heroName');
  var heroClass=document.getElementById('heroClass');
  var heroGoal=document.getElementById('heroGoal');

  // Perfiles UI
  var profileName=document.getElementById('profileName');
  var saveProfileBtn=document.getElementById('saveProfileBtn');
  var loadProfileBtn=document.getElementById('loadProfileBtn');
  var exportProfileBtn=document.getElementById('exportProfileBtn');
  var importProfileBtn=document.getElementById('importProfileBtn');
  var importProfileInput=document.getElementById('importProfileInput');

  function setHeader(){
    var need = xpNeedFor(state.level);
    var li=document.getElementById('levelInfo');
    if (li) li.textContent='Lvl '+state.level+' · '+state.xp+' / '+need+' XP · '+state.coins+'🪙';
    var fill=document.getElementById('xpFill');
    if (fill){ var pct=Math.max(0,Math.min(1,state.xp/need)); fill.style.width=(pct*100)+'%'; }
  }
  function renderHeader(){
    setHeader();
    var el;
    el=document.getElementById('pLvl'); if (el) el.textContent=state.level;
    el=document.getElementById('pXP'); if (el) el.textContent=state.xp;
    el=document.getElementById('pXPNeed'); if (el) el.textContent=xpNeedFor(state.level);
    el=document.getElementById('pCoins'); if (el) el.textContent=state.coins;
    el=document.getElementById('pNerf'); if (el) el.textContent=state.expNerfCount||0;
    el=document.getElementById('cLvl'); if (el) el.textContent=state.classLevel;
    el=document.getElementById('cXP'); if (el) el.textContent=state.classXP;
    el=document.getElementById('cXPNeed'); if (el) el.textContent=cxpNeedFor(state.classLevel);
  }
  function iconImg(id){ var src=ICONS[id]||ICONS.time_potion; return '<img class="icon" alt="" src="'+src+'"/>'; }

  function missionCard(m){
    var li=document.createElement('li'); li.className='card'; li.setAttribute('data-id',m.id);
    var typeLabel = m.type===TYPE.DAILY ? 'Diaria' : (m.type===TYPE.CLASS?'Clase': (m.type===TYPE.URGENT?'Urgente':'Focus'));
    var dueTxt = m.dueAt? '<div class="small">⏳ <span class="timer">'+fmt(new Date(m.dueAt).getTime()-Date.now())+'</span></div>' : '';
    var reqHtml = (m.requirements||[]).map(function(r){ return '<div class="small">• '+r.label+'</div>'; }).join('');
    var potions='';
    if (m.status==='pending'){
      if (state.inventory.time_potion>0 && m.dueAt) potions+='<button class="ghost" data-act="use_time" data-id="'+m.id+'">'+iconImg('time_potion')+'+2h</button> ';
      if (state.inventory.str_potion>0 && m.requirements && m.requirements.length) potions+='<button class="ghost" data-act="use_str" data-id="'+m.id+'">'+iconImg('str_potion')+'½ req</button> ';
    }
    var actions = '';
    if ((m.type===TYPE.CLASS || m.type===TYPE.FOCUS) && !m.accepted){
      actions += '<button data-act="accept" data-id="'+m.id+'">Aceptar</button> ';
      actions += '<button class="ghost" data-act="reject" data-id="'+m.id+'">Rechazar</button> ';
    }
    actions += '<button data-act="done" data-id="'+m.id+'">Marcar completada</button> ';
    actions += '<button class="ghost" data-act="fail" data-id="'+m.id+'">Fallar</button>';
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
    var pend=state.missions.filter(function(x){return x.status==='pending';});
    var hist=state.missions.filter(function(x){return x.status!=='pending';}).slice(0,8);
    // Botón para crear Focus (si existe newFocusBtn fuera, no hace falta)
    var headerCard=document.createElement('li');
    headerCard.className='card';
    headerCard.innerHTML='<div class="btnrow"><button id="newFocusBtnSmall">+ Nueva misión Focus</button></div>';
    missionsList.appendChild(headerCard);

    pend.forEach(function(m){ missionsList.appendChild(missionCard(m)); });
    if (hist.length){
      var sep=document.createElement('li'); sep.className='card'; sep.innerHTML='<div class="small">Histórico reciente</div>'; missionsList.appendChild(sep);
      hist.forEach(function(m){ missionsList.appendChild(missionCard(m)); });
    }
  }

  function renderShop(){
    if (!shopConsumibles || !shopEsteticos || !inventoryList) return;
    shopConsumibles.innerHTML=''; shopEsteticos.innerHTML=''; inventoryList.innerHTML='';
    SHOP.consumibles.forEach(function(it){
      var li=document.createElement('li'); li.className='card';
      li.innerHTML='<div class="itemrow">'+iconImg(it.id)+'<h4>'+it.name+' <span class="badge">🪙 '+it.price+'</span></h4></div><div class="small">'+it.desc+'</div><div class="btnrow"><button data-buy="'+it.id+'">Comprar</button></div>';
      shopConsumibles.appendChild(li);
    });
    SHOP.esteticos.forEach(function(it){
      var li=document.createElement('li'); li.className='card';
      li.innerHTML='<div class="itemrow">'+iconImg(it.id)+'<h4>'+it.name+' <span class="badge">🪙 '+it.price+'</span></h4></div><div class="small">'+it.desc+'</div><div class="btnrow"><button data-buy="'+it.id+'">Comprar</button></div>';
      shopEsteticos.appendChild(li);
    });
    Object.keys(state.inventory).forEach(function(k){
      var count=state.inventory[k]; if(!count) return;
      var pretty = k==='time_potion'?'Poción de tiempo':k==='str_potion'?'Poción de fuerza':k==='exp_potion'?'Poción de EXP':k==='cure'?'Curas':k;
      var li=document.createElement('li'); li.className='card';
      var actions='';
      if (k==='exp_potion') actions+='<button data-use-global="exp_potion">Usar (+20% 30min)</button>';
      else if (k==='cure') actions+='<button data-use-global="cure">Usar (quitar nerf)</button>';
      else actions+='<div class="small">Úsala desde la tarjeta de misión</div>';
      li.innerHTML='<div class="itemrow">'+iconImg(k)+'<h4>'+pretty+' × '+count+'</h4></div><div class="btnrow">'+actions+'</div>';
      inventoryList.appendChild(li);
    });
  }

  function renderProfile(){
    if (heroName) heroName.value=state.hero.name;
    if (heroClass){
      heroClass.innerHTML='';
      CLASSES.forEach(function(c){ var o=document.createElement('option'); o.value=c; o.textContent=c; heroClass.appendChild(o); });
      heroClass.value=state.hero.cls;
    }
    if (heroGoal) heroGoal.value=state.hero.goal;
    // Avatar
    function setEq(id,key){ var el=document.getElementById(id); if(!el) return;
      if (state.equipment.indexOf(key)>-1){ el.src = ICONS[key]; el.style.display='block'; }
      else{ el.src=''; el.style.display='none'; }
    }
    setEq('eq_dagas','equip_dagas');
    setEq('eq_arco','equip_arco_rojo');
    setEq('eq_gafas','equip_gafas');
    setEq('eq_ropa','equip_ropa_negra');
    // Perfiles: pintar lista
    refreshProfileList();
  }

  function renderAll(){ renderHeader(); renderMissions(); renderShop(); renderProfile(); }

  // ---------- Eventos UI ----------
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

  // Clicks globales
  document.body.addEventListener('click', function(e){
    var t=e.target; if (!t) return;

    // Crear Focus (botón en cabecera de misiones)
    if (t.id==='newFocusBtnSmall' || t.id==='newFocusBtn'){
      var zone=state.hero.goal||'abdomen';
      var f=mkFocus(zone); state.missions.unshift(f); save(); renderAll(); showPromptAcceptReject(f,'blue'); return;
    }

    // Comprar en tienda
    var buy=t.getAttribute('data-buy');
    if (buy){
      var all=[].concat(SHOP.consumibles, SHOP.esteticos); var it=all.find(function(x){return x.id===buy;});
      if (!it) return;
      if (state.coins < it.price) return alert('No tienes monedas suficientes');
      state.coins -= it.price;
      if (buy.indexOf('equip_')===0){
        if (state.equipment.indexOf(buy)===-1) state.equipment.push(buy);
      } else {
        state.inventory[buy]=(state.inventory[buy]||0)+1;
      }
      save(); renderAll(); return;
    }

    // Acciones sobre misión
    var id=t.getAttribute('data-id'); var act=t.getAttribute('data-act');
    if (id&&act){
      var m=state.missions.find(function(x){return x.id===id;}); if (!m) return;
      if (act==='accept'){ if (m.type!=='urgent'){ m.accepted=true; save(); renderAll(); } return; }
      if (act==='reject'){ if (m.type!=='urgent'){ m.status='rejected'; save(); renderAll(); } return; }
      if (act==='done'){ completeMission(m); return; }
      if (act==='fail'){ failMission(m); return; }
      if (act==='use_time'){
        if (state.inventory.time_potion>0){ add2h(m); state.inventory.time_potion--; save(); renderAll(); showInfo('Poción de tiempo','+2h aplicadas a '+m.title); }
        else alert('No tienes Poción de tiempo');
        return;
      }
      if (act==='use_str'){
        if (state.inventory.str_potion>0){ halfRequirements(m); state.inventory.str_potion--; save(); renderAll(); showInfo('Poción de fuerza','Requisitos a la mitad en '+m.title); }
        else alert('No tienes Poción de fuerza');
        return;
      }
    }

    // Usos globales desde inventario
    var glob=t.getAttribute('data-use-global');
    if (glob==='exp_potion'){
      if ((state.inventory.exp_potion||0)>0){
        state.expBuffUntil = Date.now() + 30*60*1000;
        state.inventory.exp_potion--; save(); renderAll();
        showInfo('Poción de EXP','Durante 30 min ganas +20% EXP.','blue');
      } else alert('No tienes Poción de EXP');
      return;
    }
    if (glob==='cure'){
      if ((state.inventory.cure||0)>0){
        state.expNerfCount = 0;
        state.inventory.cure--; save(); renderAll();
        showInfo('Curas','Nerf de EXP eliminado.','blue');
      } else alert('No tienes Curas');
      return;
    }
  });

  // Perfil inputs
  if (heroName)  heroName.addEventListener('change', function(){ state.hero.name=this.value||'Amo'; save(); setHeader(); });
  if (heroClass) heroClass.addEventListener('change', function(){ state.hero.cls=this.value; save(); });
  if (heroGoal)  heroGoal.addEventListener('change', function(){ state.hero.goal=this.value; save(); });

  // Perfiles listeners
  if (saveProfileBtn) saveProfileBtn.addEventListener('click', function(){
    var name=(profileName&&profileName.value||'').trim(); if(!name) return alert('Pon un nombre de perfil');
    var profiles=getProfiles(); profiles[name]=state; setProfiles(profiles);
    refreshProfileList(); alert('Perfil guardado: '+name);
  });
  if (loadProfileBtn) loadProfileBtn.addEventListener('click', function(){
    var name=(profileName&&profileName.value||'').trim(); if(!name) return alert('Pon un nombre de perfil');
    var profiles=getProfiles(); if(!profiles[name]) return alert('No existe el perfil: '+name);
    state=JSON.parse(JSON.stringify(profiles[name])); save(); renderAll(); alert('Perfil cargado: '+name);
  });
  if (exportProfileBtn) exportProfileBtn.addEventListener('click', function(){
    var name=(profileName&&profileName.value.trim())||'perfil';
    var data={name:name,state:state};
    var blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
    var a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name+'.json'; a.click();
  });
  if (importProfileBtn) importProfileBtn.addEventListener('click', function(){
    if (importProfileInput) importProfileInput.click();
  });
  if (importProfileInput) importProfileInput.addEventListener('change', function(e){
    var f=e.target.files[0]; if(!f) return;
    var r=new FileReader();
    r.onload=function(){
      try{
        var data=JSON.parse(r.result);
        if(data && data.state){ state=data.state; save(); renderAll(); alert('Perfil importado: '+(data.name||'perfil')); }
        else alert('Archivo inválido');
      }catch(err){ alert('No se pudo leer el archivo'); }
    };
    r.readAsText(f);
  });

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
        if (m.penalty){
          if (m.penalty.coins) state.coins=Math.max(0,state.coins-m.penalty.coins);
          if (m.penalty.nerf) applyNerf();
          if (m.penalty.nextHarder){ state.missions.unshift(harderClone(m)); }
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
  maybeUrgent();
  renderAll();
  setInterval(tick, 1000);
})();
