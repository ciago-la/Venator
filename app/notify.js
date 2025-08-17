import {$} from './utils.js';

const overlay=$('#overlay'), card=$('#overlayCard'), ovTitle=$('#ovTitle'), ovBody=$('#ovBody'), ovButtons=$('#ovButtons');

export function showOverlay(colorClass, title, body, imgSrc){
  if(!overlay||!card){ alert(title+'\n'+body); return; }
  card.className='overlay-card '+(colorClass||'blue');
  if (ovTitle) ovTitle.textContent=title||'';
  if (ovBody){
    ovBody.textContent='';
    if (imgSrc){ const img=document.createElement('img'); img.src=imgSrc; img.alt=''; img.style.maxWidth='120px'; img.style.display='block'; img.style.margin='0 auto 10px'; ovBody.appendChild(img); }
    const p=document.createElement('div'); p.textContent=body||''; ovBody.appendChild(p);
  }
  if (ovButtons){ ovButtons.innerHTML=''; const ok=document.createElement('button'); ok.textContent='Aceptar'; ok.onclick=()=>overlay.classList.add('hidden'); ovButtons.appendChild(ok); }
  overlay.classList.remove('hidden');
}
export const showInfo   =(t,b,c)=>showOverlay(c||'blue',t,b);
export const showSuccess=(b)=>showOverlay('green','✔ Hecho',b);
export const showWarn   =(b)=>showOverlay('yellow','⚠ Aviso',b);
export const showPunisher=(b)=>showOverlay('red','☠ Versión dura activada',b,'assets/castigador.png');

// nativas
export function askNotifPermission(){
  if(!('Notification'in window)) return showInfo('Notificaciones','Tu navegador no soporta notificaciones.');
  if(Notification.permission==='granted') return showInfo('Notificaciones','Ya estaban activadas.','green');
  Notification.requestPermission().then(p=>{
    if(p==='granted') showInfo('Notificaciones','Activadas correctamente.','green');
    else showWarn('Permiso denegado o ignorado.');
  });
}
export function notifyNow(title,body){ try{ if('Notification' in window && Notification.permission==='granted') new Notification(title,{body}); }catch(_){ } }
