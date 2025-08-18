export const VER='v15-mod';
export const TYPE={DAILY:'daily',CLASS:'class',URGENT:'urgent',FOCUS:'focus',DUNGEON:'dungeon'};
// Clases base (siempre disponibles) y clases extra (bloqueadas hasta nivel 10 de clase)
export const BASE_CLASSES = ['Guerrero','Asesino','Mago','Arquero','Espía','Maratón','Amigo del dragón','Saltamontes'];
export const EXTRA_CLASSES = ['cetrero','invocador','forjador','centinela','bestia','domador del fuego','aviador','rompehielos','lanza oscura','titan']; // ← añade aquí las nuevas que quieras
export const CLASSES = [...BASE_CLASSES, ...EXTRA_CLASSES]; // todas, por si las necesitas en otros módulos

export const $=s=>document.querySelector(s);
export const $$=s=>Array.from(document.querySelectorAll(s));
export const el=(t,c,txt)=>{const e=document.createElement(t); if(c) e.className=c; if(txt!=null) e.textContent=txt; return e;};
export const uid=()=>Math.random().toString(36).slice(2)+Date.now().toString(36);
export const todayStr=()=>new Date().toISOString().slice(0,10);
export const endOfDay=()=>{const x=new Date(); x.setHours(23,59,59,999); return x;};
export const today10 =()=>{const x=new Date(); x.setHours(10,0,0,0); return x;};
export const fmt=(ms)=>{ms=Math.max(0,ms|0);const s=(ms/1000|0);const h=('0'+(s/3600|0)).slice(-2);const m=('0'+((s%3600)/60|0)).slice(-2);const sc=('0'+(s%60)).slice(-2);return `${h}:${m}:${sc}`;};

export const xpNeedFor =(L)=>Math.round(200*Math.pow(1.1,Math.max(0,(L|0)-1)));
export const cxpNeedFor=(L)=>Math.round(200*Math.pow(1.1,Math.max(0,(L|0)-1)));

export function weekKey(){
  const d=new Date();
  const a=new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  a.setUTCDate(a.getUTCDate()+4-(a.getUTCDay()||7));
  const y=new Date(Date.UTC(a.getUTCFullYear(),0,1));
  const w=Math.ceil((((a-y)/86400000)+1)/7);
  return a.getUTCFullYear()+'-W'+('0'+w).slice(-2);
}

export function pickN(arr,n){
  if(!Array.isArray(arr)) return [];
  n=(n|0); if(n<=0) return []; if(n>arr.length) n=arr.length;
  const a=arr.slice();
  for(let i=a.length-1;i>0;i--){ const j=(Math.random()*(i+1)|0); [a[i],a[j]]=[a[j],a[i]]; }
  return a.slice(0,n);
}

export function scaleTextForLevel(txt,lvl){
  try{
    const f=Math.pow(1.1,Math.max(0,(lvl|0)-1));
    let out=String(txt||'').replace(/(\d+)\s*\/\s*(\d+)/g,(_,a,b)=>Math.max(1,Math.round(a*f))+'/'+Math.max(1,Math.round(b*f)));
    out=out.replace(/(\d+)\s*s\b/g,(m,p)=>Math.max(1,Math.round(p*f))+' s');
    out=out.replace(/(\d+)(?![^\(]*\))/g,(m,p)=>String(Math.max(1,Math.round(p*f))));
    return out;
  }catch(_){ return String(txt||''); }
}
