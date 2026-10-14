"use strict";

/** Autorisations d'envoi des actions Réponse chat : uniquement dans Connexions.
 * L'atelier Commandes reste indépendant de ces transports et permissions.
 */
registerActionHandler(CREATOR_CHATBOT_DELIVERY_ACTIONS, handleCreatorChatbotDeliveryAction);
