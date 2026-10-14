# Tableau de bord et bilan du LIVE

Le tableau de bord affiche cinq cartes : audience présente/pic, likes du LIVE/likes
reçus depuis la connexion, cadeaux/valeur, diamants et followers/partages. Sous le
simulateur conservé : activité en temps réel, top cinq donateurs, chat et événements.
Les premiers rangs sont soulignés en or, argent et bronze. Les deux graphiques sont
des SVG légers ; aucune bibliothèque ni animation continue n'est ajoutée.

## Source des chiffres

`statistics.liveSession` est le bilan réel courant ou précédent. Les compteurs
historiques existants restent inchangés pour les contrats antérieurs, mais ne sont
pas utilisés par les cinq cartes. Les événements du simulateur, des tests de règles,
des aperçus et des sources Démo sont exclus du nouveau bilan. Ils continuent à
déclencher les actions prévues : le simulateur avertit donc explicitement que des
actions réelles peuvent être exécutées.

L'audience est celle transmise par TikTok/Kick, jamais le nombre de personnes ayant
interagi. Une donnée absente est affichée `—` ; un zéro transmis reste zéro. Le pic
est calculé à partir des audiences observées. Le total des likes du LIVE est employé
quand la plateforme le fournit, avec les likes reçus depuis la connexion en sous-ligne.
La valeur des cadeaux est celle fournie par les événements, multipliée par leur
quantité. Ce n'est pas un solde de rémunération : aucun taux en euros ou revenu net
n'est inventé, et l'interface indique que l'EUR n'est pas fourni.

## Rétention et reprise

Le bilan, les participants et les traces sont sauvegardés dans l'espace local du
compte. Un arrêt ou redémarrage ferme l'état LIVE mais conserve le dernier bilan.
La reconnexion à la même salle TikTok conserve les chiffres ; une autre salle
démarre un nouveau bilan. Les sessions mixtes continuent quand une source reste
en direct. Pour Kick, aucune identité de salle stable n'est fournie par le contrat
actuel : une nouvelle connexion repart donc sur un nouveau bilan.

Les participants sont limités à 1 000 lignes par bilan et indexés en mémoire par
plateforme/identifiant. Un classement distinct conserve les 100 premiers donateurs :
le départ d'un ancien participant du buffer ne supprime pas sa contribution du
classement. Le runtime envoyé à la fenêtre ne contient que les cinq premiers
donateurs et les totaux, pas les 1 000 participants ni l'annuaire privé. Les courbes
contiennent au plus 120 points, agrégés par
tranches de 30 secondes. Les anciennes traces sont retirées à mesure. Les flux
de chat/événements utilisent les buffers existants (100 événements en fenêtre,
40 persistés pour les overlays), filtrés selon les dates et la source, sans double
comptage. Ce n'est pas un export exhaustif de tout le chat.

## Maintenance et vérification

- Contrat commun : `src/shared/live-statistics.js`.
- Comptage/transitions : `src/main/core/event-statistics.js` et `session-state.js`.
- Vue et styles : `app/features/dashboard.js` et `styles/creator-dashboard.css`.
- Tests : `live-statistics.test.js`, `dashboard-live-layout.test.js`.

Les actualisations ne remplacent ni les champs ni le focus du simulateur. Les sept
types d'événements et les aperçus du timer, de la roue et d'un son sont conservés.
Les graphiques ne changent que leur bloc de contenu lors du passage Viewers/Engagement.
