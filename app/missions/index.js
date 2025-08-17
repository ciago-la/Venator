// utilidades comunes de misiones
export const penaltyHard = (factor)=>({coins:10, nerf:true, nextHarder:true, harderFactor:factor});
export const penaltySoft = (coins)=>({coins, nerf:true});
