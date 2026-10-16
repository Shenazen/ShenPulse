# Animation d’ouverture de ShenPulse

L’ouverture normale affiche une fenêtre locale dédiée pendant environ cinq
secondes. L’interface principale se prépare en parallèle, sans être montrée
avant son premier rendu. Les catalogues distants, la vérification des mises à
jour et la reprise des installations ne retardent plus ce premier affichage.

## Présentation

`src/renderer/splash.html` réutilise le logo officiel transparent, à ses
proportions d’origine. `styles/startup-splash.css` anime son apparition, deux
orbites discrètes et un signal cyan/rouge. Les animations sont finies, sans
vidéo, audio, police distante, canvas ni boucle permanente. La préférence
système de réduction des animations affiche une composition statique, avec
la même durée d’ouverture.

La ligne décorative n’est pas une mesure de progression des services.

## Passage à l’application

Le processus principal gère la durée et la fermeture dans
`bootstrap/startup-window.js`. Le signal `startup:ready` vient uniquement du
document principal autorisé ; il ne transmet aucune identité et ne remplace
aucune vérification d’accès.

Après le premier rendu, une session locale reconnue ouvre directement le
studio. Sans compte connecté, le formulaire de connexion existant est préparé
avant l’affichage. La validation distante poursuit son fonctionnement en
arrière-plan, y compris la conservation des sessions autorisées hors ligne.
Le formulaire ne doit pas remplacer une connexion ou inscription déjà saisie.

La fenêtre d’introduction n’a ni JavaScript, ni preload, ni session persistante,
ni accès aux messages applicatifs, comptes, médias ou réseau. Fermer cette
fenêtre annule l’ouverture ; ses timers sont libérés. Une seconde instance ne
peut pas contourner l’introduction. Les lancements de qualification historiques
peuvent omettre la fenêtre décorative pour conserver leurs contrats de test.

## Vérification

Les tests couvrent le minimum de cinq secondes, le premier rendu caché, la
connexion, les erreurs, l’arrêt et le contrôle de l’expéditeur IPC. La commande
`electron scripts/verify-startup-splash.js` qualifie séparément les vrais pixels
dans un profil temporaire : plusieurs instants, petit format, proportions du
logo, fin des animations et préférence de réduction des animations. Elle ne
démarre aucun compte ni effet LIVE et conserve ses captures en TEMP.
