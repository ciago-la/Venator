import {TYPE,endOfDay,today10,scaleTextForLevel,uid} from '../utils.js';
import {state} from '../state.js';

const ROT={
  1:['Flexiones 5 × 2','Sentadillas 10 × 2','Abdominales 20 × 2'],
  2:['Dominadas 5/3','Zancadas 4/4','Puente de glúteo 7'],
  3:['Fondos de tríceps 5','Patada lateral 3 × 2','Plancha 10 s'],
  4:['Flexiones 5 × 2','Sentadillas 10 × 2','Abdominales 20 × 2'],
  5:['Dominadas 5/3','Zancadas 4/4','Puente de glúteo 7'],
  6:['Fondos de tríceps 5','Patada lateral 3 × 2','Plancha 10 s'],
  0:['Elevación de piernas 5 × 2','Saco/sombra (combo)','Sombra intensa 30 s']
};

export function mkDaily(){
  const now=new Date();
  const due=(now<today10())? new Date(Math.min(now.getTime()+14*3600*1000,endOfDay().getTime())): endOfDay();
  const base=ROT[now.getDay()]||ROT[1];
  const reqs=base.map(s=>({label:scaleTextForLevel(s,state.level)}));
  return {id:uid(),type:TYPE.DAILY,title:'Misión diaria',desc:'Obligatoria de hoy.',createdAt:now.toISOString(),dueAt:due.toISOString(),status:'pending',accepted:true,baseXP:40,baseCoins:6,requirements:reqs,penalty:{coins:6,nerf:true}};
}
