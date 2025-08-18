import {el} from './utils.js';
import {state,save} from './state.js';
import {showSuccess,showWarn,showInfo} from './notify.js';

const PNG={
  equip_arco_rojo:'assets/equip_arco_rojo.png',
  equip_dagas:'assets/equip_dagas.png',
  equip_gafas:'assets/equip_gafas.png',
  equip_ropa_negra:'assets/equip_ropa_negra.png',
  equip_ojodelvendabal:'assets/ojodelvendabal.png',
  consum_time:'assets/consum_time.png',
  consum_str:'assets/consum_str.png',
  consum_exp:'assets/consum_exp.png',
  consum_cure:'assets/consum_cure.png'
};

export const SHOP={consumibles:[
  {id:'time_potion', name:'Poción de tiempo (+2h)',  desc:'Amplía el tiempo de una misión activa.', price:30},
  {id:'str_potion',  name:'Poción de fuerza (1/2)',   desc:'Reduce a la mitad los números de la misión.', price:40},
  {id:'exp_potion',  name:'Poción de EXP (+20% 30m)',desc:'Ganas +20% EXP durante 30 min.', price:50},
  {id:'cure',        name:'Curas (quita nerf)',      desc:'Elimina el -20% de EXP acumulado.', price:20}
], esteticos:[
  {id:'ojodelvendabal', name:'ojo del vendabal',    desc:'Cosmético', price:10, img: PNG.ojodelvendabal},
  {id:'equip_dagas', name:'Dagas dobles',    desc:'Cosmético', price:60, img: PNG.equip_dagas},
  {id:'equip_arco_rojo', name:'Arco rojo',   desc:'Cosmético', price:80, img: PNG.equip_arco_rojo},
  {id:'equip_gafas', name:'Gafas de combate',desc:'Cosmético', price:40, img: PNG.equip_gafas},
  {id:'equip_ropa_negra', name:'Ropa negra', desc:'Cosmético', price:70, img: PNG.equip_ropa_negra}
]};

export function buy(id){
  const PRICE={time_potion:30,str_potion:40,exp_potion:50,cure:20,equip_dagas:60,equip_arco_rojo:80,equip_gafas:40,equip_ropa_negra:70,ojodelvendabal:10};
  const price=PRICE[id];
  if ((state.coins|0)<price) return showWarn('No tienes monedas suficientes.');
  state.coins-=price;
  if (id.startsWith('equip_')){
    if (!state.cosmeticsOwned.includes(id)) state.cosmeticsOwned.push(id);
    showSuccess((id.replace('equip_','').replaceAll('_',' '))+' comprado. Puedes verlo en Inventario.');
  }else{
    state.inventory[id]=(state.inventory[id]||0)+1;
    const pretty = id==='time_potion'?'Poción de tiempo':id==='str_potion'?'Poción de fuerza':id==='exp_potion'?'Poción de EXP':id==='cure'?'Curas':id;
    showSuccess(pretty+' comprada. Puedes verla en Inventario.');
  }
  save();
}
export function toggleEquip(id){
  if (!state.cosmeticsOwned.includes(id)) return;
  const i=state.equipment.indexOf(id);
  if (i>=0){ state.equipment.splice(i,1); showInfo('Equipo','Has quitado '+id.replace('equip_','').replaceAll('_',' ')); }
  else { state.equipment.push(id); showSuccess('Has equipado '+id.replace('equip_','').replaceAll('_',' ')); }
  save();
}
export const icons=PNG;
