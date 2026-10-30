"use strict";
// Keep existing effect IDs stable while correcting the actual engine arguments.
const AMMO = Object.freeze({"001429E1":"0006B53C","00129A44":"00121133"});
const LIMBS = Object.freeze({larm:"leftattackcondition",rarm:"rightattackcondition",lleg:"leftmobilitycondition",rleg:"rightmobilitycondition"});
function commandMap(catalog) {
  const effects = {}, forms = new Set(["0000000F"]);
  const form = value => {if(!/^[\dA-F]{8}$/i.test(value || ""))throw Error("Identifiant d’objet invalide.");return value.toUpperCase();};
  const count = value => {if(!/^\d{1,5}$/.test(value || "")||Number(value)<1||Number(value)>10000)throw Error("Quantité invalide.");return Number(value);};
  for(const effect of catalog.filter(e=>e.available!==false)) {
    const [kind,a,b,c]=effect.code.split("_");let lines;
    if(kind==="playeradditem"){lines=["player.additem "+form(a)+" "+count(b)];forms.add(form(a));}
    else if(kind==="giveweapon") {
      const weapon=form(a),ammo=AMMO[weapon]||form(b);lines=["player.additem "+weapon+" 1"];forms.add(weapon);
      if(ammo!=="00000000"){lines.push("player.additem "+ammo+" "+count(c));forms.add(ammo);}
    } else if(kind==="placeatme")lines=["player.placeatme "+form(a)+" "+count(b)];
    else if(kind==="cripple"&&LIMBS[a])lines=["player.damageav "+LIMBS[a]+" 10000"];
    else if(kind==="rewardxp")lines=["rewardxp "+count(a)];
    else if(kind==="playsound")lines=["playsound "+form(a)];
    else if(kind==="fw")lines=["fw "+form(a)];
    else if(kind==="playerkill")lines=["player.kill"];
    else if(["godmode","slowmo"].includes(kind))continue;
    else throw Error("Effet sans implémentation : "+effect.code);
    effects[effect.code]=lines;
  }
  return {effects,forms:[...forms]};
}
module.exports={commandMap};
