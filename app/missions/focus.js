import {TYPE,uid} from '../utils.js';
import {state} from '../state.js';

function baseByLevel(l){ return l>=21?30:l>=10?25:l>=5?18:10; }

export function mkFocus(zone){
  const now=new Date(); const base=baseByLevel(state.level);
  const tpl={
    abdomen:['Crunches','Elevación de piernas','Criss cross','Plancha (s)'],
    brazos:['Fondos tríceps','Curl bíceps (peso)','Flexiones tríceps','Dominadas supinas'],
    piernas:['Sentadillas','Lunges','Puente glúteos','Sentadillas salto'],
    pecho:['Flexiones','Press pecho (peso)','Aperturas','Rebotes flexión/press'],
    espalda:['Dominadas','Remo en plancha','Remo en banco','Cargadas'],
    hombros:['Elevaciones laterales','Flexiones pica','Press militar','Elevaciones frontales']
  }[zone]||['Crunches','Plancha (s)','Flexiones','Sentadillas'];
  const reqs=tpl.map(n=>({label:n+(/\(s\)/.test(n)?(' '+base+' s'):(' '+base))}));
  return {id:uid(),type:TYPE.FOCUS,title:'Focus — '+zone,desc:'Sesión focalizada en '+zone,createdAt:now.toISOString(),dueAt:new Date(now.getTime()+8*3600*1000).toISOString(),status:'pending',accepted:false,baseXP:80,baseCoins:10,requirements:reqs,penalty:{coins:8,nerf:true,nextHarder:true,harderFactor:1.5}};
}
