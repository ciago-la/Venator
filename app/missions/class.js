import {TYPE,uid,CLASSES,scaleTextForLevel,pickN} from '../utils.js';
import {classObj} from '../state.js';

export function normClassName(cls){
  if (!cls) return 'Asesino';
  const s = cls.toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  if (s.includes('guerrero')) return 'Guerrero';
  if (s.includes('asesin'))   return 'Asesino';
  if (s.includes('mago'))     return 'Mago';
  if (s.includes('arquero'))  return 'Arquero';
  if (s.includes('espia'))    return 'Espía';
  if (s.includes('maraton'))  return 'Maratón';
  if (s.includes('dragon'))   return 'Amigo del dragón';
  if (s.includes('saltam'))   return 'Saltamontes';
  return 'Asesino';
}

export const CLASS_POOL = {
  'Asesino': ['Saltos pliométricos 10/lado ×2','Saltos reactivos 20','Burpees 8','Cangrejo 33 pasos','Burpees en pino 9','Saltos estrella 33','Spidermans 30','Seguir a alguien 10 min','Escuchar conversación 2 min'],
  'Mago': ['Patada reacción rápida 20','Asalto punching ball 1 min ×2','Reflejos con pelotas 10','Usar callado (básico)','3 golpes con callado ×20','Aconseja a alguien'],
  'Arquero': ['Side 10/lado + Front 10/lado','Scorpions 5/lado','Rana 20 + mono 20','Cocodrilo 20','100 flechas','20 flechas saltando','Paso del pino','Recorrido dianas','10 sin culatín','10 estilo mongol','+10m distancia'],
  'Espía': ['Cadera 3×30s','Piernas 3×30s','Equilibrio 30s c/u','Pistol 5 intentos','Dragon 5 intentos','50 cuchillos','20 cuchillos saltando','4 direcciones ×10','2 cuchillos <1s ×10','3 cuchillos <1s ×10','+5m distancia','Sin giro ×10','Con giro ×10','Golpes con cuchillo','Ligero5/Med7/Pes5'],
  'Maratón': ['1 km en 2 min','5 km en 30 min','10 km en 60 min','15 km total','20 km total','4×100 m','Correr 30 min a tope','Técnica china','Técnica nueva'],
  'Amigo del dragón': ['Derrota a 1','Recorrido 3 obs','Movimiento volador ×10','Derribo ×10','Patada ×10','Puñetazo ×10','Recorrido 10 obs','Derrota a 5','Arma marcial'],
  'Saltamontes': ['Agarre 20s×10','Agarre con peso 30rep/lado','Bloque ×3','Vía ×3','Escala no diseñado','Saltos en escalada','Rápel impro'],
  'Guerrero': ['Repite diaria','Repite focus','Golpes arma pesada 3×10','Combo arma pesada 1 min','Duplica diaria','Duplica focus','3 golpes “Guts” ×10','Combo 5 “Guts”','Combo 1 min “Guts”','Inventa golpe','Fabrica arma pesada']
};

export function mkClassMission(cls){
  const now=new Date();
  const clean=normClassName(cls);
  let pool=CLASS_POOL[clean]||[];
  if(pool.length<2) pool=pool.concat(['Técnica básica A','Técnica básica B','Técnica básica C']);
  const chosen = pickN(pool,2);
  const cp=classObj();
  return {
    id:uid(),
    type:TYPE.CLASS,
    title:'Misión de clase — '+clean,
    desc:'Entrenamiento específico de tu clase.',
    createdAt:now.toISOString(),
    dueAt:new Date(now.getTime()+12*3600*1000).toISOString(),
    status:'pending',
    accepted:false,
    baseXP:0,
    baseCoins:9,
    classXP:70,
    requirements:chosen.map(s=>({label:scaleTextForLevel(s,cp.level)})),
    penalty:null
  };
}
