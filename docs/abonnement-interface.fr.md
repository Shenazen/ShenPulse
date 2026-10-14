# Interface Abonnement

La page Abonnement et la popup d’offres sont deux présentations distinctes d’un même catalogue commercial. Cette refonte change la disposition de la page, pas les prix ni les droits associés au compte.

## Organisation de la page

1. Bannière illustrée locale, rendue par `renderStudioHero("membership", …)`.
2. Carte de l’offre actuelle : Free, essai, accès offert ou abonnement payé. Une échéance n’est affichée que si le compte fournit une date valide.
3. Comparatif des trois offres mensuelles. Les prix, descriptions et avantages proviennent exclusivement de `SUBSCRIPTION_PLANS`.
4. Avantage Premium permettant d’offrir un accès Pro, lorsque les droits existants l’autorisent.
5. Explication de l’accès aux jeux, puis liste des achats uniques dans un accordéon indépendant du comparatif.

La résiliation se trouve dans la carte du compte, plutôt que dans l’offre Free : cela évite de confondre un changement d’offre avec la gestion d’un abonnement existant. L’arrêt reste programmé à échéance ; il ne supprime pas les droits immédiatement.

## Contrats conservés

- `subscription-checkout`, `subscription-checkout-cancel` et `subscription-stop` restent traités par les gestionnaires commerciaux existants.
- L’annulation PayPal reste accessible pendant un paiement, même si une actualisation vient de rendre l’offre active.
- Une opération occupée empêche le lancement d’un deuxième achat ou d’une résiliation concurrente.
- Un essai actif et un accès Pro offert sélectionnent la bonne carte sans proposer une résiliation personnelle. Un essai expiré n’est plus présenté comme un accès actif.
- Le formulaire `premium-seat-form`, son champ `beneficiaryEmail` et ses contraintes de validation sont conservés.
- Les modules achetables restent filtrés par `accessMode === "purchase"`. Leurs prix utilisent toujours `gamePrice(pack)`.
- La popup d’offres et les API de paiement n’ont pas été modifiées.

## Lisibilité et coût de rendu

Les cartes utilisent des tailles de texte lisibles, une hiérarchie cohérente et des pictogrammes SVG locaux réutilisables. La table des chemins SVG n’est créée qu’une fois. Aucun minuteur, appel réseau, filtre flou ou effet animé n’a été ajouté.

Les miniatures des achats uniques utilisent `loading="lazy"`, `decoding="async"` et des dimensions explicites. L’accordéon est fermé initialement afin de ne pas transformer les achats de modules en quatrième offre d’abonnement.

Les règles de présentation sont isolées par `.membership-workspace`, pour ne pas modifier la popup. Les colonnes deviennent une liste sur les petites fenêtres ; le formulaire bénéficiaire reste utilisable sur mobile et conserve un focus clavier visible.

## Vérification

`tests/membership-visual-layout.test.js` exécute le vrai rendu avec les tarifs et fonctions de droits de l’application. Il couvre les états Free, Pro payé, essai actif/expiré, Pro offert, Premium avec bénéficiaire, arrêt programmé, paiement en attente et résiliation occupée, ainsi que les achats uniques et l’échappement des données.

Les tests sont effectués avec des données locales : aucune transaction réelle, attribution d’accès, invitation ou modification de compte n’est déclenchée.
