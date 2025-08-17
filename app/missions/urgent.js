import {TYPE,uid,weekKey} from '../utils.js';
import {state,applyNerf} from '../state.js';

const TEMPLATES=[
  {name:'Domador de Dragones', reqs:['Sprint 200 m × 5','Flexiones 40','Plancha 60 s','Prueba de clase (aleatoria)'], loot:['aliento_dragón','escamas_dragón','huevo_dragón','amigo_dragón','sangre_dragón']},
  {name:'Asesino de reyes', reqs:['Burpees 30','Sentadillas salto 30','Hollow hold 30 s','Prueba de clase (aleatoria)'], loot:['corona_maldita','cetro_poder','espada_triple','proteccion_princesa','colgante_reina']},
  {name:'Ciervo de mil ojos avistado', reqs:['Sprints 50 m × 10','Zancadas 20/20','Plancha lateral 30 s/lado','Prueba de clase (aleatoria)'], loot:['ojos_azules_3','cuerno_arbol_rojo','armadura_piel_magica','frasco_aliento_bosque','semilla_antigua']},
  {name:'Robo en la torre de maná', reqs:['Jumping jacks 80','Flexiones inclinadas 25','Planchas escaladas 40','Prueba de clase (aleatoria)'], loot:['pocion_mana_potente','libro_conjuros','daga_oscuridad','diente_fuego','llave_celda_oscura']},
  {name:'Asalto al coloso de hierro', reqs:['Sentadilla isométrica 60 s','Flexiones pike 20','Mountain climbers 60','Prueba de clase (aleatoria)'], loot:['armadura_voladora','botas_viento','maza_terremoto','latigo_azul','tunica_albores_alvaros']}
];

export function mkUrgent(){
  const now=new Date(); const t=TEMPLATES[(Math.random()*TEMPLATES.length)|0];
  return {id:uid(),type:TYPE.URGENT,title:'Misión urgente: '+t.name,desc:'Alta prioridad (no se puede rechazar).',createdAt:now.toISOString(),dueAt:new Date(now.getTime()+5*3600*1000).toISOString(),status:'pending',accepted:true,baseXP:120,baseCoins:15,requirements:t.reqs.map(x=>({label:x})),penalty:{coins:10,nerf:true,nextHarder:true,harderFactor:1.25},loot:t.loot};
}

// pity + planificación diaria (igual que tenías)
export function urgentChanceToday(){
  const d=Math.max(0,state.daysWithoutUrgent||0);
  if(d<7) return 0.10;
  const extra=Math.min(0.05*(d-6),0.20);
  return Math.min(0.10+extra,0.30);
}

export function planUrgentForTodayIfNeeded(todayStr){
  const wk=weekKey(); const used=state.weeklyUrgents[wk]||0;
  if(state.urgentPlan && state.urgentPlan.date===todayStr && state.urgentPlan.decided) return;
  const plan={date:todayStr,decided:true,willHave:false,fireAt:null,spawned:false};
  if(used<3){
    const chance=urgentChanceToday();
    const will=(chance>=0.30)?true:(Math.random()<chance);
    if(will){
      const h=3+((Math.random()*17)|0), m=((Math.random()*60)|0);
      const fire=new Date(); fire.setHours(h,m,0,0);
      plan.willHave=true; plan.fireAt=fire.toISOString();
    }
  }
  state.urgentPlan=plan;
}
