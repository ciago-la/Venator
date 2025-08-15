// === Altervenator v13s6 — Diaria escalada + Clase extendida (bono lvl10) + Urgentes UI ===
(function(){
  const VER='v13s6';

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
    lastSeenDay:null
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
    let leveled=false;
    while(state.classXP >= cxpNeedFor(state.classLevel)){
      state.classXP -= cxpNeedFor(state.classLevel);
      state.classLevel++;
      leveled=true;
    }
    if (leveled) checkClassBonusUnlock();
  }
  function applyNerf(){ state.expNerfCount = Math.min(9,(state.expNerfCount||0)+3); }
  function decayNerf(){ if (state.expNerfCount>0) state.expNerfCount--; }

  // ---------- Datos base ----------
  var TYPE={DAILY:'daily', CLASS:'class', URGENT:'urgent', FOCUS:'focus'};

  // Rotación diaria (texto base; se escalará)
  var DAILY_ROTATION={
    1:['Flexiones 5 × 2','Sentadillas 10 × 2','Abdominales 20 × 2'],
    2:['Dominadas 5/3','Zancadas 4/4','Puente de glúteo 7'],
    3:['Fondos de tríceps 5','Patada lateral 3 × 2','Plancha 10 s'],
    4:['Flexiones 5 × 2','Sentadillas 10 × 2','Abdominales 20 × 2'],
    5:['Dominadas 5/3','Zancadas 4/4','Puente de glúteo 7'],
    6:['Fondos de tríceps 5','Patada lateral 3 × 2','Plancha 10 s'],
    0:['Elevación de piernas 5 × 2','Saco/sombra (combo)','Sombra intensa 30 s']
  };

  // Clase: pools básicas y avanzadas (resumen compacto de tu lista)
  var CLASS_POOLS={
    'Asesino':{
      basic:['Pliometría: saltos x10/lado ×2','Salto reactivo 20','Burpees 8','Saltos estrella 20'],
      adv:['Burpees a pino 9','Spidermans 30','Seguir a alguien 10 min','Escuchar conversación 2 min']
    },
    'Guerrero':{
      basic:['Repite la misión diaria','Repite la misión Focus','Golpes rectos x100'],
      adv:['Repite Focus duplicada','Combo espada pesada 1 min','Combo 5 golpes espada']
    },
    'Mago':{
      basic:['Patadas con reacción (rápidas) 20','Punching ball 1 min ×2','Reflejos con tenis 5 min'],
      adv:['Aprende uso de callado (básico)','3 golpes con callado x20','Dar un consejo útil a alguien']
    },
    'Arquero':{
      basic:['Side kicks x10/lado + front x10/lado','Pasos de rana 20 + mono 20','Tiro: 50 flechas'],
      adv:['Dispara 20 flechas saltando','Dianas recorrido (dominar)','Tiro estilo mongol x10']
    },
    'Espía':{
      basic:['Estira caderas 3×30s','Equilibrio 30s por pierna','Flexibilidad piernas 3×30s'],
      adv:['Pistol squat 5/5','Dragon squat 5/5','Lanza 50 cuchillos','Lanza 20 cuchillos saltando']
    },
    'Maratón':{
      basic:['Corre 5 km en 30 min','4 sprints de 100 m','Corre 10 km en 1 h'],
      adv:['Corre 15 km total','Corre 20 km total','Método eficiente chino (práctica)']
    },
    'Amigo del dragón':{
      basic:['Derrota a 1 contrincante','Recorrido 3 obstáculos','Aprende un derribo x10'],
      adv:['Recorrido 10 obstáculos','Arma marcial: base','Derrota a 5 contrincantes']
    },
    'Saltamontes':{
      basic:['Agarre 20 s (10 rep)','Bloque ×3','Vía ×3'],
      adv:['Escala algo no diseñado','Saltos en escalada','Rapel no convencional']
    }
  };

  // Recompensas cosméticas al nivel 10 de clase
  var CLASS_BONUS_EQUIP={
    'Asesino':      {id:'equip_botas_sombra', name:'Botas sombra'},
    'Guerrero':     {id:'equip_guanteletes_coloso', name:'Guanteletes del coloso'},
    'Mago':         {id:'equip_anillo_mana', name:'Anillo de maná'},
    'Amigo del dragón': {id:'equip_simbolo_espiritu', name:'Símbolo del espíritu'},
    'Arquero':      {id:'equip_talisman_ojo', name:'Talismán del ojo agudo'},
    'Saltamontes':  {id:'equip_magnesio_lava', name:'Magnesio de lava'},
    'Maratón':      {id:'equip_estela_alba', name:'Estela del alba'},
    'Espía':        {id:'equip_pendiente_fantasma', name:'Pendiente del fantasma'}
  };

  // Iconos mínimos (SVG embebido; añadimos algunos nuevos cosméticos)
  var ICONS={
    // pociones
    time_potion:'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMzIiIGN5PSIzMiIgcj0iMzAiIGZpbGw9IiMwYzExMjAiIHN0cm9rZT0iIzZlYThmZiIgc3Ryb2tlLXdpZHRoPSIzIi8+PHRleHQgeD0iMzIiIHk9IjM4IiBmb250LXNpemU9IjI4IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjNmVhOGZmIj7wn5CRPC90ZXh0Pjwvc3ZnPg==',
    str_potion:'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3QgeD0iNiIgeT0iNiIgd2lkdGg9IjUyIiBoZWlnaHQ9IjUyIiByeD0iMTAiIGZpbGw9IiMwYzExMjAiIHN0cm9rZT0iI2E2NmJmZiIgc3Ryb2tlLXdpZHRoPSIzIi8+PHRleHQgeD0iMzIiIHk9IjQwIiBmb250LXNpemU9IjI4IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjYTY2YmZmIj7ilqU8L3RleHQ+PC9zdmc+',
    exp_potion:'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMzIiIGN5PSIzMiIgcj0iMzAiIGZpbGw9IiMwYzExMjAiIHN0cm9rZT0iIzZlYThmZiIgc3Ryb2tlLXdpZHRoPSIzIi8+PHRleHQgeD0iMzIiIHk9IjM4IiBmb250LXNpemU9IjI0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjNmVhOGZmIj5YUDwvdGV4dD48L3N2Zz4=',
    cure:'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3QgeD0iNiIgeT0iNiIgd2lkdGg9IjUyIiBoZWlnaHQ9IjUyIiByeD0iMTAiIGZpbGw9IiMwYzExMjAiIHN0cm9rZT0iIzVjZmZjMCIgc3Ryb2tlLXdpZHRoPSIzIi8+PHRleHQgeD0iMzIiIHk9IjQwIiBmb250LXNpemU9IjI2IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjNWNmZmMwIj7imJg8L3RleHQ+PC9zdmc+',
    // equipo tienda
    equip_dagas:'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTIwIDYwIEw0MCA0MCBMIDM1IDM1IEwgMTUgNTUgWiIgZmlsbD0iIzZlYThmZiIvPjxwYXRoIGQ9Ik02MCAyMCBMNDAgNDAgTDQ1IDQ1IEw2NSAyNSBaIiBmaWxsPSIjYTY2YmZmIi8+PC9zdmc+',
    equip_arco_rojo:'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iOTAiIGhlaWdodD0iOTAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTIwIDgwIFE3MCA0NSAyMCAxMCIgZmlsbD0ibm9uZSIgc3Rya2U9IiNmZjVjN2EiIHN0cm9rZS13aWR0aD0iNiIvPjxsaW5lIHgxPSIyMCIgeTE9IjgwIiB4Mj0iMjAiIHkyPSIxMCIgc3Rya2U9IiNmZjVjN2EiIHN0cm9rZS13aWR0aD0iMiIvPjwvc3ZnPg==',
    equip_gafas:'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3QgeD0iNSIgeT0iOCIgd2lkdGg9IjI4IiBoZWlnaHQ9IjE2IiByeD0iNCIgZmlsbD0iIzZlYThmZiIvPjxyZWN0IHg9IjQ3IiB5PSI4IiB3aWR0aD0iMjgiIGhlaWdodD0iMTYiIHJ4PSI0IiBmaWxsPSIjNmVhOGZmIi8+PHJlY3QgeD0iMzMiIHk9IjE0IiB3aWR0aD0iMTQiIGhlaWdodD0iNCIgZmlsbD0iI2E2NmJmZiIvPjwvc3ZnPg==',
    equip_ropa_negra:'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTEwIDIwIEwzMCAxMCBMNTAgMjAgTDQ1IDU1IEwxNSA1NSBaIiBmaWxsPSIjMTIxODIyIiBzdHJva2U9IiM2ZWE4ZmYiIHN0cm9rZS13aWR0aD0iMiIvPjwvc3ZnPg==',
    // nuevos cosméticos por clase (placeholders)
    equip_botas_sombra:'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNDQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTEwIDMwIEwyMCAyMCBMNDAgMjAgTDQ4IDI4IEw0MCAzNiBMMjAgMzYgWiIgZmlsbD0iIzE0MTkxZiIgc3Ryb2tlPSIjNmVhOGZmIi8+PC9zdmc+',
    equip_guanteletes_coloso:'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNDQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3QgeD0iOCIgeT0iMTIiIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgZmlsbD0iI2MzYzNjMyIvPjxyZWN0IHg9IjM2IiB5PSIxMiIgd2lkdGg9IjIwIiBoZWlnaHQ9IjIwIiBmaWxsPSIjOTk5OTk5Ii8+PC9zdmc+',
    equip_anillo_mana:'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDQiIGhlaWdodD0iNDQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMjIiIGN5PSIyMiIgcj0iMTIiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2FlZGZlZiIgc3Ryb2tlLXdpZHRoPSIzIi8+PC9zdmc+',
    equip_simbolo_espiritu:'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDQiIGhlaWdodD0iNDQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTIyIDQgTDM0IDIyIEwyMiA0MCBMMTAgMjIgWiIgZmlsbD0iI2EwZDhmZiIvPjwvc3ZnPg==',
    equip_talisman_ojo:'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDQiIGhlaWdodD0iNDQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMjIiIGN5PSIyMiIgcj0iMTQiIGZpbGw9IiM2ZWE4ZmYiLz48Y2lyY2xlIGN4PSIyMiIgY3k9IjIyIiByPSI2IiBmaWxsPSIjMTQxOTFmIi8+PC9zdmc+',
    equip_magnesio_lava:'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDQiIGhlaWdodD0iNDQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3QgeD0iMTAiIHk9IjEwIiB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIGZpbGw9IiNmNDYyMzAiLz48L3N2Zz4=',
    equip_estela_alba:'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGxpbmUgeDE9IjEyIiB5MT0iMTIiIHgyPSI1MiIgeTI9IjEyIiBzdHJva2U9IiNmZmYiIHN0cm9rZS13aWR0aD0iNCIvPjwvc3ZnPg==',
    equip_pendiente_fantasma:'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzQiIGhlaWdodD0iNDQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMTciIGN5PSIxMCIgcj0iNCIgZmlsbD0iI2EwZDhmZiIvPjxsaW5lIHgxPSIxNyIgeTE9IjE0IiB4Mj0iMTciIHkyPSIzNiIgc3Ryb2tlPSIjNmVhOGZmIiBzdHJva2Utd2lkdGg9IjMiLz48L3N2Zz4='
  };

  // Urgentes
  var URGENT_TPL=[
    {name:'Domador de Dragones', reqs:['Sprint 200 m × 5','Flexiones 40','Plancha 60 s','Prueba de clase (aleatoria)'], loot:['aliento_dragón','escamas_dragón','huevo_dragón','amigo_dragón','sangre_dragón']},
    {name:'Asesino de reyes', reqs:['Burpees 30','Sentadillas salto 30','Hollow hold 30 s','Prueba de clase (aleatoria)'], loot:['corona_maldita','cetro_poder','espada_triple','proteccion_princesa','colgante_reina']},
    {name:'Ciervo de mil ojos avistado', reqs:['Sprints 50 m × 10','Zancadas 20/20','Plancha lateral 30 s/lado','Prueba de clase (aleatoria)'], loot:['ojos_azules_3','cuerno_arbol_rojo','armadura_piel_magica','frasco_aliento_bosque','semilla_antigua']},
    {name:'Robo en la torre de maná', reqs:['Jumping jacks 80','Flexiones inclinadas 25','Planchas escaladas 40','Prueba de clase (aleatoria)'], loot:['pocion_mana_potente','libro_conjuros','daga_oscuridad','diente_fuego','llave_celda_oscura']},
    {name:'Asalto al coloso de hierro', reqs:['Sentadilla isométrica 60 s','Flexiones pike 20','Mountain climbers 60','Prueba de clase (aleatoria)'], loot:['armadura_voladora','botas_viento','maza_terremoto','latigo_azul','tunica_albores_alvaros']}
  };

  // ---------- Escalado de Diaria ----------
  function scaleTextForLevel(text, lvl){
    // factor +10% por nivel (acumulado)
    const factor = Math.pow(1.1, Math.max(0,lvl-1));
    // 1) escalar números (5, 10, 60) y patrones 5/3
    let out = text.replace(/(\d+)\s*\/\s*(\d+)/g, (_,a,b)=>{
      const A=Math.max(1, Math.round(parseInt(a,10)*factor));
      const B=Math.max(1, Math.round(parseInt(b,10)*factor));
      return A+'/'+B;
    });
    out = out.replace(/(\d+)\s*(?=(?![^x]*×))/g, (m,p)=>{ // escalar números no seguidos por '×' inmediata (dejamos rondas aparte)
      return String(Math.max(1, Math.round(parseInt(p,10)*factor)));
    });
    out = out.replace(/(\d+)\s*s\b/g, (m,p)=> String(Math.max(1, Math.round(parseInt(p,10)*factor)))+' s');

    // 2) +1 ronda cada 3 niveles → detectar × N
    const extraRounds = Math.floor(lvl/3);
    out = out.replace(/×\s*(\d+)/g, (_,n)=> '× '+ (parseInt(n,10)+extraRounds));
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

  function classPresetExpanded(){
    const cls = state.hero.cls;
    const pools = CLASS_POOLS[cls] || CLASS_POOLS['Asesino'];
    const advUnlocked = state.classLevel>10;
    // toma 2 básicas + (si >10 de clase) 1 avanzada
    const pick = (arr,n)=>arr.slice().sort(()=>Math.random()-0.5).slice(0,n);
    const tasks = pick(pools.basic,2).concat( advUnlocked ? pick(pools.adv,1) : [] );
    return tasks.map(t=>({label:t}));
  }
  function mkClassMission(){
    const now=new Date();
    const reqs=classPresetExpanded();
    return {
      id:uid(), type:TYPE.CLASS, title:'Misión de clase — '+state.hero.cls, desc:'Entrenamiento de '+state.hero.cls,
      createdAt: now.toISOString(), dueAt: new Date(now.getTime()+12*3600*1000).toISOString(),
      status:'pending', accepted:false,
      baseXP:70, classXP:70, baseCoins:9, requirements:reqs,
      penalty:null
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

  // ---------- Bonos de clase ----------
  function checkClassBonusUnlock(){
    const cls = state.hero.cls;
    const bonus = CLASS_BONUS_EQUIP[cls];
    if (!bonus) return;
    if (state.classLevel===10 && state.equipment.indexOf(bonus.id)===-1){
      state.equipment.push(bonus.id);
      save();
      showInfo('Recompensa de clase','¡Has alcanzado el nivel 10 de '+cls+'! Recompensa: '+bonus.name,'purple');
      renderProfile(); // para que se vea el avatar equipado si existe el slot
    }
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
  function showPromptAcceptReject(m, color){
    card.className='overlay-card '+(color||'blue');
    ovTitle.textContent='Nueva misión';
    ovBody.textContent='Tienes una misión: '+m.title+' — ¿Aceptas?';
    ovButtons.innerHTML='';
    const ok=document.createElement('button'); ok.textContent='Aceptar';
    ok.onclick=function(){ m.accepted=true; save(); renderAll(); hideOverlay(); };
    const ko=document.createElement('button'); ko.textContent='Rechazar'; ko.className='ghost';
    ko.onclick=function(){ m.status='rejected'; save(); renderAll(); hideOverlay(); };
    ovButtons.appendChild(ok); ovButtons.appendChild(ko);
    overlay.classList.remove('hidden');
  }
  function showPromptUrgent(m){
    card.className='overlay-card red';
    ovTitle.textContent='¡Misión urgente!';
    ovBody.textContent='Ha aparecido: '+m.title+'. Debes aceptarla.';
    ovButtons.innerHTML='';
    const ok=document.createElement('button'); ok.textContent='Aceptar'; ok.onclick=hideOverlay; ovButtons.appendChild(ok);
    overlay.classList.remove('hidden');
  }
  function hideOverlay(){ overlay.classList.add('hidden'); }

  // ---------- Generación al abrir ----------
  function rolloverDailyIfNeeded(){
    const t=todayStr();
    if (state.lastSeenDay!==t){
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
      state.lastSeenDay=t; save();
    }
  }
  function ensureDailyToday(){
    const t=todayStr(); let has=false;
    for (let i=0;i<state.missions.length;i++){
      const m=state.missions[i];
      if (m.type===TYPE.DAILY && m.status==='pending' && m.createdAt.slice(0,10)===t){ has=true; break; }
    }
    if (!has){
      const d=mkDaily(); state.missions.unshift(d); save(); renderAll();
      showInfo('Misión diaria','Se ha generado tu misión diaria de hoy.','blue');
    }
  }
  function ensureOneClassPending(){
    for (let i=0;i<state.missions.length;i++){
      const m=state.missions[i];
      if (m.type===TYPE.CLASS && m.status==='pending') return;
    }
    const c=mkClassMission(); state.missions.unshift(c); save(); renderAll();
    showPromptAcceptReject(c,'purple');
  }
  var urgentCapNoticeShown=false;
  function maybeUrgent(){
    const wk=weekKey(); const used=state.weeklyUrgents[wk]||0;
    if (used>=3){ if(!urgentCapNoticeShown){ urgentCapNoticeShown=true; showInfo('Urgentes','Ya has alcanzado 3 urgentes esta semana.','red'); } return; }
    if (Math.random()<0.25){
      const u=mkUrgent(); state.missions.unshift(u); state.weeklyUrgents[wk]=used+1; save(); renderAll(); showPromptUrgent(u);
    }
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

  // ---------- Consumibles (se mantienen) ----------
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

  var profileName=document.getElementById('profileName');
  var saveProfileBtn=document.getElementById('saveProfileBtn');
  var loadProfileBtn=document.getElementById('loadProfileBtn');
  var exportProfileBtn=document.getElementById('exportProfileBtn');
  var importProfileBtn=document.getElementById('importProfileBtn');
  var importProfileInput=document.getElementById('importProfileInput');

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
    // Cabecera con botón Focus y contador urgentes
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
    // NO cambiamos nada aquí respecto a v13s5
  }

  function renderProfile(){
    if (heroName) heroName.value=state.hero.name;
    if (heroClass){
      heroClass.innerHTML=''; CLASSES.forEach(c=>{ const o=document.createElement('option'); o.value=c; o.textContent=c; heroClass.appendChild(o); });
      heroClass.value=state.hero.cls;
    }
    if (heroGoal) heroGoal.value=state.hero.goal;
    // Pinta equipamiento (incluye bonus de clase si existe nodo img)
    function setEq(id,key){ const el=document.getElementById(id); if(!el) return;
      if (state.equipment.indexOf(key)>-1){ el.src = ICONS[key]||''; el.style.display='block'; } else { el.src=''; el.style.display='none'; } }
    // slots existentes de versiones previas
    setEq('eq_dagas','equip_dagas');
    setEq('eq_arco','equip_arco_rojo');
    setEq('eq_gafas','equip_gafas');
    setEq('eq_ropa','equip_ropa_negra');
    // bonus de clase: no tenemos slots dedicados en HTML; se muestran al equiparse si creas <img id="eq_bonus" ...>
    const bonusEl=document.getElementById('eq_bonus');
    if (bonusEl){
      // muestra el primer bonus que tengas
      const bonusKeys=Object.values(CLASS_BONUS_EQUIP).map(b=>b.id);
      const owned=bonusKeys.find(k=>state.equipment.indexOf(k)>-1);
      if (owned){ bonusEl.src=ICONS[owned]||''; bonusEl.style.display='block'; } else { bonusEl.src=''; bonusEl.style.display='none'; }
    }

    refreshProfileList();
  }

  function renderAll(){ renderHeader(); renderMissions(); renderProfile(); }

  // ---------- Perfiles ----------
  function getProfiles(){ try{ return JSON.parse(localStorage.getItem(LS_PROFILES)) || {}; }catch(_){ return {}; } }
  function setProfiles(p){ localStorage.setItem(LS_PROFILES, JSON.stringify(p)); }
  function refreshProfileList(){
    const span=document.getElementById('profileList'); if(!span) return;
    const names=Object.keys(getProfiles());
    span.textContent = names.length? names.join(', ') : '(vacío)';
  }

  // ---------- Eventos ----------
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

    // Focus
    if (t.id==='newFocusBtnSmall' || t.id==='newFocusBtn'){
      const zone=state.hero.goal||'abdomen';
      const f={ id:uid(), type:TYPE.FOCUS, title:'Focus — '+zone, desc:'Sesión focalizada en '+zone,
        createdAt: new Date().toISOString(), dueAt: new Date(Date.now()+8*3600*1000).toISOString(),
        status:'pending', accepted:false, baseXP:80, baseCoins:10,
        requirements:(function(){
          const base=(state.level>=21?30: state.level>=10?25: state.level>=5?18:10);
          const tpl={
            abdomen:['Crunches','Elevación de piernas','Criss cross','Plancha (s)'],
            brazos:['Fondos tríceps','Curl bíceps (peso)','Flexiones tríceps','Dominadas supinas'],
            piernas:['Sentadillas','Lunges','Puente glúteos','Sentadillas salto'],
            pecho:['Flexiones','Press pecho (peso)','Aperturas','Rebotes flexión/press'],
            espalda:['Dominadas','Remo en plancha','Remo en banco','Cargadas'],
            hombros:['Elevaciones laterales','Flexiones pica','Press militar','Elevaciones frontales']
          }[zone]||['Crunches','Plancha (s)','Flexiones','Sentadillas'];
          return tpl.slice(0,4).map(n=>({label: n + (/\(s\)/.test(n)?(' '+base+' s'):(' '+base))}));
        })(),
        penalty:{coins:8, nerf:true, nextHarder:true, harderFactor:1.5}
      };
      state.missions.unshift(f); save(); renderAll(); showPromptAcceptReject(f,'blue'); return;
    }

    // Compras (dejamos como antes si tienes tienda activa)
    const buy=t.getAttribute('data-buy');
    if (buy){
      // No modificamos: tu versión anterior gestiona tienda en otro bloque
      return;
    }

    // Acciones misión
    const id=t.getAttribute('data-id'); const act=t.getAttribute('data-act');
    if (id&&act){
      const m=state.missions.find(x=>x.id===id); if(!m) return;
      if (act==='accept'){ if (m.type!=='urgent'){ m.accepted=true; save(); renderAll(); } return; }
      if (act==='reject'){ if (m.type!=='urgent'){ m.status='rejected'; save(); renderAll(); } return; }
      if (act==='done'){ completeMission(m); return; }
      if (act==='fail'){ failMission(m); return; }
      if (act==='use_time'){ if ((state.inventory.time_potion||0)>0){ add2h(m); state.inventory.time_potion--; save(); renderAll(); showInfo('Poción de tiempo','+2h aplicadas a '+m.title); } else alert('No tienes Poción de tiempo'); return; }
      if (act==='use_str'){ if ((state.inventory.str_potion||0)>0){ halfRequirements(m); state.inventory.str_potion--; save(); renderAll(); showInfo('Poción de fuerza','Requisitos a la mitad en '+m.title); } else alert('No tienes Poción de fuerza'); return; }
    }

    // Perfiles
    if (t.id==='saveProfileBtn'){
      const name=(profileName&&profileName.value||'').trim(); if(!name) return alert('Pon un nombre de perfil');
      const profiles=getProfiles(); profiles[name]=state; setProfiles(profiles); refreshProfileList(); alert('Perfil guardado: '+name); return;
    }
    if (t.id==='loadProfileBtn'){
      const name=(profileName&&profileName.value||'').trim(); if(!name) return alert('Pon un nombre de perfil');
      const profiles=getProfiles(); if(!profiles[name]) return alert('No existe el perfil: '+name);
      state=JSON.parse(JSON.stringify(profiles[name])); save(); renderAll(); alert('Perfil cargado: '+name); return;
    }
    if (t.id==='exportProfileBtn'){
      const name=(profileName&&profileName.value.trim())||'perfil';
      const blob=new Blob([JSON.stringify({name,state},null,2)],{type:'application/json'});
      const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name+'.json'; a.click(); return;
    }
    if (t.id==='importProfileBtn'){ if (importProfileInput) importProfileInput.click(); return; }
  });

  if (importProfileInput) importProfileInput.addEventListener('change', e=>{
    const f=e.target.files[0]; if(!f) return;
    const r=new FileReader();
    r.onload=function(){
      try{
        const data=JSON.parse(r.result);
        if(data && data.state){ state=data.state; save(); renderAll(); alert('Perfil importado: '+(data.name||'perfil')); }
        else alert('Archivo inválido');
      }catch(_){ alert('No se pudo leer el archivo'); }
    };
    r.readAsText(f);
  });

  // Inputs de perfil
  if (heroName)  heroName.addEventListener('change', function(){ state.hero.name=this.value||'Amo'; save(); setHeader(); });
  if (heroClass) heroClass.addEventListener('change', function(){ state.hero.cls=this.value; save(); });
  if (heroGoal)  heroGoal.addEventListener('change', function(){ state.hero.goal=this.value; save(); });

  // ---------- Tick ----------
  function tick(){
    const now=Date.now(); let dirty=false;
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
