// === Smoke test v12: tabs + 1 misión falsa + barra XP ===
(function(){
  // Panel de errores visible si algo peta
  window.addEventListener('error', function(e){
    var b=document.body; var d=document.createElement('div');
    d.style.cssText='position:fixed;top:0;left:0;right:0;background:#300;padding:8px;color:#fff;z-index:99999;font:14px monospace';
    d.textContent='JS ERROR: '+(e.message||e.filename||'desconocido');
    b.appendChild(d);
  });

  // Hook básico de tabs
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

  // Header visible: “JS cargado”
  var levelInfo=document.getElementById('levelInfo');
  if (levelInfo) levelInfo.textContent='(v12) JS cargado — prueba de humo';

  // Barra XP al 50%
  var fill=document.getElementById('xpFill'); if (fill) fill.style.width='50%';

  // Inserta 1 misión falsa en la lista
  var list=document.getElementById('missionsList');
  if (list){
    var li=document.createElement('li');
    li.className='card';
    li.innerHTML = `
      <h4>Misión de prueba <span class="small">[Diaria]</span></h4>
      <div class="small">Esta misión es solo para comprobar que el JS corre.</div>
      <div class="btnrow">
        <button id="test-ok">Marcar completada</button>
        <button class="ghost" id="test-fail">Fallar</button>
      </div>`;
    list.appendChild(li);
  }

  // Botones de prueba
  document.addEventListener('click', function(e){
    if (e.target && e.target.id==='test-ok') alert('OK: los listeners funcionan');
    if (e.target && e.target.id==='test-fail') alert('OK: el botón también responde');
    if (e.target && e.target.id==='newFocusBtn') alert('CLICK: + Nueva misión Focus');
    if (e.target && e.target.id==='forceUrgentBtn') alert('CLICK: Forzar urgente');
  });

  // Overlay existe?
  var ov=document.getElementById('overlay');
  if (!ov){
    console.warn('No encuentro #overlay. Revisa index.html');
  }
})();
