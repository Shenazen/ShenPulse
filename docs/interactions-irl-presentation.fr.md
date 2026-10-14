# Présentation des interactions IRL

L'espace IRL organise l'installation dans l'ordre où elle est préparée : bannière de page, activation globale, résumé, appareils, interactions, avertissement de sécurité.

La bannière réutilise les visuels locaux de ShenPulse et le composant `renderStudioHero`. Les pictogrammes sont des SVG légers intégrés au rendu : aucune requête distante, animation permanente ou découverte réseau n'est lancée par l'affichage de cette page.

## Appareils

Les cartes affichent le nom, le modèle, la génération, l'adresse locale et l'identifiant de chaque prise PlugPlus compatible. L'état « détectée » décrit la dernière recherche réseau ; ce n'est pas une promesse de connexion permanente. Le bouton « Détecter » reste explicite.

Les cinq opérations existantes sont conservées : allumer, éteindre, basculer, éteindre puis rallumer après trois secondes, allumer puis éteindre après trois secondes. Elles portent les mêmes `data-action`, `data-id` et `data-operation` et restent gérées par les gestionnaires IRL existants. Les appareils de mesure sans relais ne peuvent pas être testés. Les boutons sont désactivés lorsqu'une opération IRL est en cours.

## Interactions et sécurité

Chaque interaction conserve son identifiant de règle, son identifiant d'action, son index dans la règle et son déclencheur. L'édition, la désactivation de règle, le test et la suppression ne changent pas de gestionnaire. Une prise supprimée ou non pilotable empêche le test de l'interaction, sans effacer la règle.

Le commutateur global ne supprime aucune configuration. À l'arrêt, les règles restent éditables. L'avertissement protégeant le PC ShenPulse et le routeur demeure visible ; les commandes manuelles sont identifiées comme des actions immédiates sur la prise.

Les noms, adresses, descriptions et identifiants sont échappés avant insertion HTML. La recherche continue de filtrer sur le nom de règle, le libellé du déclencheur et la description de l'action. Les états vides expliquent le prochain geste, sans simuler d'appareil ou d'interaction.

## Vérification

`tests/irl-visual-layout.test.js` couvre l'ordre des blocs, la bannière partagée, les compteurs, l'activation, les cinq opérations, les références de règles, les appareils sans relais, l'état occupé, la recherche et l'échappement des valeurs. Ces tests n'envoient aucune commande physique.
