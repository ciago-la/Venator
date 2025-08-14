// === Altervenator (compat ES5) ===
(function(){
  var LS_KEY = 'altervenator_missions_v2';

  var defaultState = {
    hero: { name:'Amo', cls:'Asesino', goal:'adelgazar' },
    xp: 0, level: 1, coins: 0,
    expBuffUntil: 0,
    expNerfCount: 0,
    inventory: { time_potion: 1, str_potion: 1, exp_potion: 0, cure: 0 },
    equipment: [],
    missions: [],
    weeklyUrgents: {},
    lastSeenDay: null
  };

  function load(){ try{ return JSON.parse(localStorage.getItem(LS_KEY)) || clone(defaultState); }catch(e){ return clone(defaultState); } }
  function save(){ localStorage.setItem(LS_KEY, JSON.stringify(state)); }
  function clone(o){ return JSON.parse(JSON.stringify(o)); }
  function uid(){ return Math.random().toString(36).slice(2)+Date.now().toString(36); }
  function todayStr(){ return new Date().toISOString().slice(0,10); }
  function endOfDay(){ var x=new Date(); x.setHours(23,59,59,999); return x; }
  function today10am(){ var x=new Date(); x.setHours(10,0,0,0); return x; }
  function fmt(ms){ ms=Math.max(0,ms|0); var s=Math.floor(ms/1000); var h=('0'+Math.floor(s/3600)).slice(-2); var m=('0'+Math.floor((s%3600)/60)).slice(-2); var sc=('0'+(s%60)).slice(-2); return h+':'+m+':'+sc; }

  var TYPE = { DAILY:'daily', FOCUS:'focus', CLASS:'class', URGENT:'urgent' };
  var BASIC_POOL = [
    {name:'Flexiones', base:12}, {name:'Sentadillas', base:20}, {name:'Abdominales', base:15},
    {name:'Puente glúteo', base:20}, {name:'Zancadas', base:12}, {name:'Plancha (seg)', base:30}
  ];
  function pick(arr,n){ var a=arr.slice(); var out=[]; while(n-->0 && a.length){ out.push(a.splice(Math.floor(Math.random()*a.length),1)[0]); } return out; }
  function scale(base,k){ return Math.max(5, Math.round(base*k)); }

  function recalcLevel(){ state.level = 1 + Math.floor(state.xp/200); }
  function gainXP(base){
    var g = base;
    if (Date.now() < state.expBuffUntil) g = Math.round(g*1.2);
    if (state.expNerfCount>0) g = Math.round(g*0.8);
    state.xp = Math.max(0, state.xp + g); recalcLevel();
  }
  function applyNerf(){ state.expNerfCount = Math.min(9,(state.expNerfCount||0)+3); }
  function decayNerf(){ if (state.expNerfCount>0) state.expNerfCount--; }

  function makeDaily(){
    var progK = 1 + Math.floor(state.xp/4000)*0.15;
    var p = pick(BASIC_POOL,3);
    var reqs = p.map(function(it){ return {name:it.name, count:scale(it.base,progK), progress:0, unit: it.name.indexOf('(seg)')>-1?'seg':'reps'}; });
    var now = new Date(); var ten = today10am();
    var due = (now < ten) ? new Date(Math.min(now.getTime()+14*3600*1000, endOfDay().getTime())) : endOfDay();
    return { id:uid(), type:TYPE.DAILY, title:'Misión diaria', desc:'Completa el básico de hoy.',
      createdAt: new Date().toISOString(), dueAt: due.toISOString(), accepted:true, status:'pending',
      baseXP:40, baseCoins:6, requirements:reqs, penalty:{coins:6, nerf:true, nextHarder:true} };
  }
  var FOCUS_POOL = {
    abdomen: ['Crunch','Plancha (seg)','Dead bug','Elevaciones de piernas'],
    brazos: ['Flexiones diamante','Fondos en banco','Curl isométrico (seg)','Flexiones pike'],
    pecho: ['Flexiones','Flexiones inclinadas','Flexiones declinadas','Isométrico pared (seg)'],
    piernas: ['Sentadillas','Zancadas','Puente glúteo','Sentadilla isométrica (seg)']
  };
  function makeFocus(zone){
    var now=new Date(); var due=new Date(now.getTime()+8*3600*1000);
    var reqs = pick(FOCUS_POOL[zone]||FOCUS_POOL.piernas,4).map(function(n){ return {name:n, count:18, progress:0, unit:n.indexOf('(seg)')>-1?'seg':'reps'}; });
    return { id:uid(), type:TYPE.FOCUS, title:'Focus '+zone, desc:'Sesión focalizada en '+zone+'.',
      createdAt: now.toISOString(), dueAt: due.toISOString(), accepted:false, status:'pending',
      baseXP:80, baseCoins:10, requirements:reqs, penalty:{coins:8, nerf:true, nextHarder:true} };
  }
  function makeClass(cls){
    var now=new Date(); var due=new Date(now.getTime()+12*3600*1000); var reqs;
    if (cls==='Asesino') reqs=[{name:'Burpees',count:20,progress:0,unit:'reps'},{name:'Saltos laterales',count:60,progress:0,unit:'reps'}];
    else if (cls==='Guerrero') reqs=[{name:'Puñetazos rectos',count:100,progress:0,unit:'reps'},{name:'Uppercuts',count:100,progress:0,unit:'reps'}];
    else if (cls==='Mago') reqs=[{name:'Flexiones',count:25,progress:0,unit:'reps'},{name:'Sprints 20m',count:10,progress:0,unit:'reps'}];
    else if (cls==='Invocador') reqs=[{name:'Farmer walk (seg)',count:120,progress:0,unit:'seg'},{name:'Sentadillas',count:30,progress:0,unit:'reps'}];
    else reqs=[{name:'Dispara flechas',count:100,progress:0,unit:'reps'},{name:'Flechas en salto',count:20,progress:0,unit:'reps'}];
    return { id:uid(), type:TYPE.CLASS, title:'Misión de clase — '+cls, desc:'Demuestra tu especialidad.',
      createdAt: now.toISOString(), dueAt: due.toISOString(), accepted:false, status:'pending',
      baseXP:70, baseCoins:9, requirements:reqs, bonusObj:{id:'rare_gem',name:'Gema rara',desc:'Objeto único'}, penalty:null };
  }
  function makeUrgent(){
    var themes=['Domador de Dragones','Asesino de reyes','Ciervo de mil ojos avistado','Robo en la torre de mana','Asalto al coloso de hierro'];
    var t=themes[Math.floor(Math.random()*themes.length)];
    var now=new Date(); var due=new Date(now.getTime()+5*3600*1000);
    var reqs=[{name:'Sprint 200m',count:5,progress:0,unit:'reps'},{name:'Flexiones',count:40,progress:0,unit:'reps'},{name:'Plancha (seg)',count:60,progress:0,unit:'seg'}];
    return { id:uid(), type:TYPE.URGENT, title:'Misión urgente: '+t, desc:'Aviso de alta prioridad.',
      createdAt: now.toISOString(), dueAt: due.toISOString(), accepted:true, status:'pending',
      baseXP:120, baseCoins:15, requirements:reqs, penalty:{coins:10, nerf:true, nextHarder:true} };
  }
  function weekKey(){
    var d=new Date();
    var a=new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    a.setUTCDate(a.getUTCDate()+4-(a.getUTCDay()||7));
    var y=new Date(Date.UTC(a.getUTCFullYear(),0,1));
    var w=Math.ceil((((a-y)/86400000)+1)/7);
    return a.getUTCFullYear()+'-W'+('0'+w).slice(-2);
  }

  function harderClone(m){
    var n=clone(m); n.id=uid(); n.status='pending'; n.accepted=true;
    n.title = m.title+' — Versión dura'; n.dueAt=new Date(Date.now()+6*3600*1000).toISOString(); n.penalty=null;
    for (var i=0;i<n.requirements.length;i++) n.requirements[i].count=Math.ceil(n.requirements[i].count*1.25);
    return n;
  }

  function acceptMission(m){
    if (m.accepted) return; m.accepted=true;
    if (m.type===TYPE.FOCUS || m.type===TYPE.CLASS){
      var h=(m.type===TYPE.FOCUS)?8:12; m.dueAt=new Date(Date.now()+h*3600*1000).toISOString();
    }
    save(); renderAll();
  }
  function completeMission(m){
    if (m.status!=='pending') return;
    m.status='completed'; gainXP(m.baseXP); state.coins+=m.baseCoins; decayNerf();
    if (m.type===TYPE.CLASS && Date.now()<=new Date(m.dueAt).getTime() && m.bonusObj){
      state.inventory[m.bonusObj.id]=(state.inventory[m.bonusObj.id]||0)+1;
    }
    save(); renderAll(); toast('✅ +'+m.baseXP+' XP, +'+m.baseCoins+'🪙');
  }
  function failMission(m, silent){
    if (m.status!=='pending') return;
    m.status='failed';
    if (m.penalty){
      if (m.penalty.coins) state.coins=Math.max(0,state.coins-m.penalty.coins);
      if (m.penalty.nerf) applyNerf();
      if (m.penalty.nextHarder) state.missions.unshift(harderClone(m));
    }
    save(); renderAll(); if (!silent) toast('⛔ Penalización aplicada');
  }
  function tick(){
    var now=Date.now(), dirty=false;
    for (var i=0;i<state.missions.length;i++){
      var m=state.missions[i];
      if (m.status==='pending' && m.dueAt && now>new Date(m.dueAt).getTime()){
        if (m.type===TYPE.CLASS){ m.status='failed'; dirty=true; } else { failMission(m,true); dirty=true; }
      }
    }
    if (dirty){ save(); renderAll(); }
    // refrescar timers visibles
    var cards=document.querySelectorAll('#missionsList .card');
    for (var j=0;j<cards.length;j++){
      var el=cards[j].querySelector('.timer');
      var id=cards[j].getAttribute('data-id');
      if (el && id){
        var mission = state.missions.filter(function(x){return x.id===id;})[0];
        if (mission && mission.dueAt){
          el.textContent='⏳ '+fmt(Math.max(0, new Date(mission.dueAt).getTime()-Date.now()));
        }
      }
    }
  }

  function adjustReq(m, idx, delta){
    if (!m.requirements[idx]) return;
    m.requirements[idx].progress = Math.min(m.requirements[idx].count, m.requirements[idx].progress + delta);
    var all=true; for (var i=0;i<m.requirements.length;i++){ if (m.requirements[i].progress<m.requirements[i].count){ all=false; break; } }
    if (all) completeMission(m); else { save(); renderAll(); }
  }

  // Tienda
  var SHOP = {
    consumibles: [
      {id:'time_potion', name:'Poción de tiempo (+2h)', desc:'Amplía el tiempo de una misión activa.', price:30},
      {id:'str_potion', name:'Poción de fuerza (1/2 reps hoy)', desc:'Reduce requisitos a la mitad.', price:40},
      {id:'exp_potion', name:'Poción de EXP (+20% 30 min)', desc:'Ganas +20% EXP durante 30 min.', price:50},
      {id:'cure', name:'Curas (quita nerfeo EXP)', desc:'Elimina penalización -20% EXP.', price:20}
    ],
    esteticos: [
      {id:'equip_dagas', name:'Dagas dobles', desc:'Cosmético', price:60},
      {id:'equip_arco_rojo', name:'Arco rojo', desc:'Cosmético', price:80},
      {id:'equip_gafas', name:'Gafas de combate', desc:'Cosmético', price:40},
      {id:'equip_ropa_negra', name:'Ropa negra', desc:'Cosmético', price:70}
    ]
  };
  function buyItem(it){
    if (state.coins < it.price) { alert('No tienes monedas suficientes.'); return; }
    state.coins -= it.price;
    if (it.id.indexOf('equip_')===0){
      if (state.equipment.indexOf(it.id)===-1) state.equipment.push(it.id);
    } else {
      state.inventory[it.id] = (state.inventory[it.id]||0)+1;
    }
    save(); renderAll();
  }
  function useOnMission(m, kind){
    if (!state.inventory[kind] || state.inventory[kind]<=0) { alert('No tienes ese objeto.'); return; }
    if (kind==='time_potion'){
      if (!m.dueAt) { alert('Esta misión no tiene tiempo.'); return; }
      m.dueAt = new Date(new Date(m.dueAt).getTime()+2*3600*1000).toISOString();
      state.inventory[kind]--; toast('⏱️ +2h añadidas');
    } else if (kind==='str_potion'){
      for (var i=0;i<m.requirements.length;i++) m.requirements[i].count = Math.ceil(m.requirements[i].count/2);
      state.inventory[kind]--; toast('💪 Requisitos a la mitad');
    }
    save(); renderAll();
  }
  function useGlobal(kind){
    if (!state.inventory[kind] || state.inventory[kind]<=0) { alert('No tienes ese objeto.'); return; }
    if (kind==='exp_potion'){ state.expBuffUntil = Date.now()+30*60*1000; toast('📈 +20% EXP 30 min'); }
    if (kind==='cure'){ state.expNerfCount = 0; toast('✨ Nerfeo eliminado'); }
    state.inventory[kind]--; save(); renderAll();
  }

  // ---- UI ----
  var missionsList = document.getElementById('missionsList');
  var shopConsumibles = document.getElementById('shopConsumibles');
  var shopEsteticos = document.getElementById('shopEsteticos');
  var inventoryList = document.getElementById('inventoryList');
  var heroName = document.getElementById('heroName');
  var heroClass = document.getElementById('heroClass');
  var heroGoal = document.getElementById('heroGoal');

  function renderHeader(){ document.getElementById('levelInfo').textContent = 'Lvl '+state.level+' · '+state.xp+' XP · '+state.coins+'🪙'; }
  function missionCard(m){
    var li=document.createElement('li'); li.className='card'; li.setAttribute('data-id', m.id);
    var dueIn = m.dueAt ? Math.max(0, new Date(m.dueAt).getTime()-Date.now()) : 0;
    var typeLabel = (m.type===TYPE.DAILY?'Diaria': m.type===TYPE.FOCUS?'Focus': m.type===TYPE.CLASS?'Clase':'Urgente');
    li.innerHTML = ''
      + '<h4>'+m.title+' <span class="badge">'+typeLabel+'</span></h4>'
      + '<div class="small">'+(m.desc||'')+'</div>'
      + '<div class="small">Recompensa: '+m.baseXP+' XP, '+m.baseCoins+'🪙'+(m.bonusObj? ' · Bonus: '+m.bonusObj.name:'')+'</div>'
      + (m.dueAt? '<div class="topright timer">⏳ '+fmt(dueIn)+'</div>':'')
      + '<div class="reqs"></div>'
      + '<div class="btnrow">'
      +   (m.accepted? '' : '<button data-act="accept" data-id="'+m.id+'">Aceptar</button>')
      +   '<button data-act="progress" data-id="'+m.id+'">+ Progreso</button>'
      +   '<button data-act="fail" class="ghost" data-id="'+m.id+'">Fallar</button>'
      +   (state.inventory.time_potion? '<button data-act="use_time" class="ghost" data-id="'+m.id+'">Usar ⏱️</button>':'')
      +   (state.inventory.str_potion? '<button data-act="use_str" class="ghost" data-id="'+m.id+'">Usar 💪</button>':'')
      + '</div>'
      + '<div class="small">Estado: '+m.status+(m.tougher?' · (Versión dura)':'')+'</div>';
    var reqDiv = li.querySelector('.reqs');
    for (var i=0;i<m.requirements.length;i++){
      var r=m.requirements[i];
      var p=document.createElement('div'); p.className='small';
      p.textContent=r.name+': '+r.progress+'/'+r.count+' '+(r.unit||'');
      var bar=document.createElement('progress'); bar.max=r.count; bar.value=r.progress;
      p.appendChild(document.createElement('br')); p.appendChild(bar); reqDiv.appendChild(p);
    }
    return li;
  }
  function renderMissions(){
    missionsList.innerHTML='';
    var pending=state.missions.filter(function(x){return x.status==='pending';});
    var done=state.missions.filter(function(x){return x.status!=='pending';}).slice(0,10);
    for (var i=0;i<pending.length;i++) missionsList.appendChild(missionCard(pending[i]));
    if (done.length){
      var sep=document.createElement('li'); sep.className='card'; sep.innerHTML='<div class="small">Histórico reciente</div>'; missionsList.appendChild(sep);
      for (var j=0;j<done.length;j++) missionsList.appendChild(missionCard(done[j]));
    }
  }
  function renderShop(){
    shopConsumibles.innerHTML=''; shopEsteticos.innerHTML=''; inventoryList.innerHTML='';
    for (var i=0;i<SHOP.consumibles.length;i++){
      var it=SHOP.consumibles[i]; var li=document.createElement('li'); li.className='card';
      li.innerHTML='<h4>'+it.name+' <span class="badge">🪙 '+it.price+'</span></h4><div class="small">'+it.desc+'</div><div class="btnrow"><button data-buy="'+it.id+'">Comprar</button></div>';
      shopConsumibles.appendChild(li);
    }
    for (var j=0;j<SHOP.esteticos.length;j++){
      var it2=SHOP.esteticos[j]; var li2=document.createElement('li'); li2.className='card';
      li2.innerHTML='<h4>'+it2.name+' <span class="badge">🪙 '+it2.price+'</span></h4><div class="small">'+it2.desc+'</div><div class="btnrow"><button data-buy="'+it2.id+'">Comprar</button></div>';
      shopEsteticos.appendChild(li2);
    }
    var inv=state.inventory; var keys=Object.keys(inv);
    if (!keys.length){ var li3=document.createElement('li'); li3.className='card'; li3.innerHTML='<div class="small">Inventario vacío</div>'; inventoryList.appendChild(li3); }
    for (var k=0;k<keys.length;k++){
      var id=keys[k]; var label=(id==='time_potion'?'Poción de tiempo':id==='str_potion'?'Poción de fuerza':id==='exp_potion'?'Poción de EXP':id==='cure'?'Curas':id);
      var li4=document.createElement('li'); li4.className='card';
      li4.innerHTML='<h4>'+label+' × '+inv[id]+'</h4>';
      var row=document.createElement('div'); row.className='btnrow';
      if (id==='exp_potion'){ row.innerHTML='<button data-use-global="exp_potion">Activar (+20% 30 min)</button>'; }
      else if (id==='cure'){ row.innerHTML='<button data-use-global="cure">Usar (quitar nerfeo)</button>'; }
      else { row.innerHTML='<div class="small">Úsala desde la tarjeta de una misión</div>'; }
      li4.appendChild(row); inventoryList.appendChild(li4);
    }
  }
  function renderProfile(){
    document.getElementById('heroName').value=state.hero.name;
    document.getElementById('heroClass').value=state.hero.cls;
    document.getElementById('heroGoal').value=state.hero.goal;
    document.getElementById('pLvl').textContent=state.level;
    document.getElementById('pXP').textContent=state.xp;
    document.getElementById('pCoins').textContent=state.coins;
    document.getElementById('pNerf').textContent=state.expNerfCount||0;
    var equip=document.getElementById('equipList'); equip.innerHTML='';
    for (var i=0;i<state.equipment.length;i++){ var li=document.createElement('li'); li.textContent=state.equipment[i].replace('equip_',''); equip.appendChild(li); }
  }
  function renderAll(){ renderHeader(); renderMissions(); renderShop(); renderProfile(); }

  // Eventos
  document.querySelector('.tabbar').addEventListener('click', function(e){
    if (!e.target || !e.target.getAttribute) return;
    var v = e.target.getAttribute('data-view'); if (!v) return;
    var btns=document.querySelectorAll('.tabbar button'); for (var i=0;i<btns.length;i++) btns[i].classList.remove('active');
    e.target.classList.add('active');
    var views=document.querySelectorAll('.view'); for (var j=0;j<views.length;j++) views[j].classList.remove('active');
    var sec=document.getElementById('view-'+v); if (sec) sec.classList.add('active');
  });

  document.body.addEventListener('click', function(e){
    var t=e.target; if (!t) return;
    var buy=t.getAttribute('data-buy'); if (buy){ var all=SHOP.consumibles.concat(SHOP.esteticos); for (var i=0;i<all.length;i++){ if (all[i].id===buy){ buyItem(all[i]); break; } } return; }
    var useG=t.getAttribute('data-use-global'); if (useG){ useGlobal(useG); return; }
    var id=t.getAttribute('data-id'); var act=t.getAttribute('data-act'); if (!id||!act) return;
    var m=null; for (var k=0;k<state.missions.length;k++){ if (state.missions[k].id===id){ m=state.missions[k]; break; } }
    if (!m) return;
    if (act==='accept') acceptMission(m);
    if (act==='progress') adjustReq(m, 0, 1);
    if (act==='fail') failMission(m);
    if (act==='use_time') useOnMission(m,'time_potion');
    if (act==='use_str') useOnMission(m,'str_potion');
  });

  document.getElementById('newFocusBtn').addEventListener('click', function(){
    // crea una Focus con la zona elegida en Perfil, rápida
    var zone = state.hero.goal || 'abdomen';
    state.missions.unshift(makeFocus(zone)); save(); renderAll();
  });

  document.getElementById('heroName').addEventListener('change', function(){ state.hero.name=this.value||'Amo'; save(); renderHeader(); });
  document.getElementById('heroClass').addEventListener('change', function(){ state.hero.cls=this.value; save(); });
  document.getElementById('heroGoal').addEventListener('change', function(){ state.hero.goal=this.value; save(); });
  document.getElementById('resetBtn').addEventListener('click', function(){ if (confirm('¿Reiniciar todo?')){ state=clone(defaultState); save(); renderAll(); } });

  // Ciclo de vida
  var state = load();

  function onOpen(){
    var t=todayStr();
    if (state.lastSeenDay !== t){
      // Marcar daily anterior como fallada si caducó
      for (var i=0;i<state.missions.length;i++){
        var m=state.missions[i];
        if (m.type===TYPE.DAILY && m.status==='pending' && m.createdAt.slice(0,10)!==t){
          if (Date.now() > new Date(m.dueAt).getTime()) failMission(m,true);
        }
      }
      state.lastSeenDay = t;
    }
    // Generar si falta
    var hasDaily=false, hasClass=false;
    for (var j=0;j<state.missions.length;j++){
      var mm=state.missions[j];
      if (mm.type===TYPE.DAILY && mm.status==='pending' && mm.createdAt.slice(0,10)===t) hasDaily=true;
      if (mm.type===TYPE.CLASS && mm.status==='pending') hasClass=true;
    }
    if (!hasDaily) state.missions.unshift(makeDaily());
    if (!hasClass) state.missions.unshift(makeClass(state.hero.cls));

    // Urgente aleatoria (máx 3/semana)
    var wk=weekKey(); var used=state.weeklyUrgents[wk]||0;
    if (used<3 && Math.random()<0.25){ state.missions.unshift(makeUrgent()); state.weeklyUrgents[wk]=used+1; }
    save();
  }

  // Toast mínimo
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

  onOpen(); renderAll(); setInterval(tick, 1000);
})();
