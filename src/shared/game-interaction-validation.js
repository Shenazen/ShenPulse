"use strict";
/** Validate activation without affecting manual tests or explicit free events. */
function activationError(rule) {
 if(rule?.enabled===false)return '';
 const trigger=rule?.trigger||{};
 if(trigger.type==='gift'&&(!rule.conditions?.some(condition=>
  ['data.giftName','data.giftId'].includes(condition.field)&&
  ['equals','in'].includes(condition.operator)&&
  (String(condition.value??'').trim()||String(condition.giftId||'').trim()||condition.giftIds?.length))||trigger.enabled===false))
  return 'Activation impossible : choisissez obligatoirement un cadeau pour cette interaction avant de l’activer.';
 for(const action of rule?.actions||[]){
  if(action.type!=='overlay.win-counter')continue;
  const config=action.config||{},operation=config.operation||'adjust';
  if(['adjust','set','multiplier','random'].includes(operation)){
   const raw=config.amount,amount=Number(raw);
   if(raw==null||String(raw).trim()===''||!Number.isSafeInteger(amount)||Math.abs(amount)<1||Math.abs(amount)>100000||operation==='multiplier'&&amount<1)
    return 'Activation impossible : saisissez un nombre entier de wins entre 1 et 100 000 pour chaque montant positif et négatif.';
  }
 }
 return '';
}
function assertGameInteractionActivation(rule){const message=activationError(rule);if(message)throw Error(message);}
module.exports={activationError,assertGameInteractionActivation};
