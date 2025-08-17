import {TYPE} from '../utils.js';
import {mkUrgent} from './urgent.js';

export function mkDungeon(){
  const u=mkUrgent();
  u.type=TYPE.DUNGEON;
  u.title=u.title.replace('Misión urgente:','Asalto a mazmorra:');
  u.desc='Asalto forzado con llave (no se puede rechazar).';
  return u;
}
