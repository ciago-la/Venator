function showTab(tab) {
  const content = document.getElementById('tab-content');
  if (tab === 'misiones') content.innerHTML = '<h2>Misiones</h2><p>Aquí aparecerán tus misiones.</p>';
  if (tab === 'tienda') content.innerHTML = '<h2>Tienda</h2><p>Objetos próximamente.</p>';
  if (tab === 'perfil') content.innerHTML = '<h2>Perfil</h2><p>Datos de usuario.</p>';
}

// Mostrar la pestaña inicial
showTab('misiones');