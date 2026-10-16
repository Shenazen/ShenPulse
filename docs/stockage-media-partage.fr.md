# Stockage média partagé

## Principe depuis la version 2.0.1

Le client distribué n’exige plus de clés Backblaze sur chaque PC. Le processus
principal demande une autorisation temporaire au serveur ShenPulse existant,
avec le jeton Firebase du compte connecté. Le serveur vérifie l’identité et
choisit une clé d’objet dans l’espace `mediauploads/<UID vérifié>/`.

L’application envoie ensuite le fichier directement vers Backblaze en HTTPS,
sans transmettre le jeton Firebase à Backblaze. Elle enregistre uniquement
l’URL permanente du média dans la bibliothèque, jamais l’URL signée temporaire.
Les actions, sons et automatisations de Matchs réutilisent cette même URL.

## Composants

- `account/media-uploads.js` : appel authentifié de
  `/api/media/uploads/create`, propriétaire issu de la session, délai de
  préparation et messages d’erreur publics.
- `BackblazeMediaService` : validation du fichier et de l’autorisation reçue,
  envoi PUT direct, délai de transfert et descripteur compatible avec les
  bibliothèques existantes.
- `ipc/media.js` : capture du compte avant le choix du fichier et vérification
  après chaque opération asynchrone, avant l’enregistrement.
- `visibility-catalog.js` : imports B2 disponibles pour tous les comptes
  connectés, y compris après d’anciens réglages d’administration. Les invités
  restent interdits ; les autres droits Pro et administrateur sont conservés.

Les scripts d’administration historiques peuvent toujours utiliser la
signature locale en construisant le service sans courtier. Le processus
principal de l’application utilise exclusivement le service partagé : aucun
repli sur les clés locales après une erreur du serveur.

## Formats et limites

Audio : MP3, WAV, OGG, M4A, MP4 et WebM. Visuel : PNG, JPEG, WebP, GIF, MP4 et
WebM. La catégorie d’origine reste conservée, notamment MP4 audio contre MP4
vidéo. Le serveur peut choisir une extension canonique différente (`m4a` pour
`audio/mp4`, `jpg` pour `image/jpeg`).

Limite applicative : 200 Mio par fichier, non vide. Le fichier est actuellement
lu en mémoire pendant son transfert. Aucun nouveau service payant n’est ajouté,
mais l’usage demeure facturé selon le compte Backblaze existant.

Le courtier historique valide le type et la taille déclarés ; sa signature PUT
ne contraint pas cryptographiquement la taille réelle. Il n’ajoute pas de quota
cumulé ni de limitation par utilisateur. Ne pas présenter ces protections comme
existantes. Un durcissement serveur pourra être traité séparément.

## Qualification

### Suppression des sons importés

Chaque ligne de « Mes sons importés » comporte un bouton « Supprimer » avec
confirmation. Le retrait concerne la bibliothèque du compte connecté et se
conserve après redémarrage ou reconnexion. Les actions et les réglages des
profils ne sont pas modifiés : un son déjà affecté reste utilisable par son URL.
Le fichier Backblaze n’est donc pas effacé ; le courtier n’expose pas de
suppression distante. Ce bouton ne libère pas d’espace dans le bucket.

Le canal dédié `sound:remove` n’accepte qu’un identifiant de la bibliothèque
active, jamais une URL ou une clé Backblaze fournie par l’interface. Le compte
est capturé avant confirmation et revérifié côté interface et processus
principal. Les sons publics et les bibliothèques des autres comptes sont exclus.
La suppression annule la sélection en attente et arrête uniquement l’aperçu
du son concerné, sans supprimer les champs déjà choisis dans l’éditeur.

Les tests couvrent un compte gratuit sans clés B2, les formats, les erreurs,
les réponses et destinations invalides, les changements de compte, les droits
hérités et la conservation des anciennes bibliothèques.

Le smoke réel optionnel nécessite une session locale existante et une
autorisation explicite d’import en production :

```powershell
node_modules\electron\dist\electron.exe scripts\smoke-media-upload.js --allow-production-upload
```

Il lit la session en mémoire, copie uniquement le fichier de chiffrement local
dans un profil temporaire isolé, puis compare les fichiers réels avant/après.
Il n’ajoute rien aux bibliothèques et ne déclenche aucun lecteur ou effet LIVE.
Deux minuscules objets QA restent dans B2 (WAV silencieux et GIF). Le courtier
ne propose pas leur suppression ; aucune clé administrateur n’est utilisée.
Le profil temporaire doit ensuite être nettoyé avec l’option contrôlée
`--cleanup-profile`, après l’arrêt du processus. Aucune URL protégée ni clé
n’est affichée dans les résultats.
