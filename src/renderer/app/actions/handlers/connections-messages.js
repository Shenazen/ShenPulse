"use strict";

/** Autorisations d'envoi communes aux Connexions et au chatbot.
 * Les commandes d'actions restent indépendantes des permissions d'envoi.
 */
registerActionHandler(CREATOR_CHATBOT_DELIVERY_ACTIONS, handleCreatorChatbotDeliveryAction);
