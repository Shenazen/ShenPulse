# Final Fantasy I à V — Xbox / Game Pass

Les modules Xbox 1.0.1 ont été vérifiés le 2 novembre 2026 : 112, 108, 100,
115 et 103 codes respectivement, soit 538 interactions. Les sauvegardes de
test ont été restaurées et la sonde de diagnostic retirée avant publication.
Les archives Steam 1.0.0 et leurs empreintes restent inchangées.

`Runtime.cs` adapte la boucle principale, les PV hors combat, le nom des
personnages et les emplacements d’équipe absents. `apply-corrections.ps1`
adapte les signatures aux assemblies IL2CPP de l’édition cible et conserve
les identifiants d’effets existants. Les noms et photos des viewers passent
par la connexion locale ShenPulse ; aucune application supplémentaire n’est
requise.

Pour construire un pack, appeler `scripts/build-final-fantasy-gamepass.ps1`
avec `-Number` (1 à 5), `-InteropDirectory` (le dossier BepInEx/interop du jeu
Xbox correspondant), `-Compiler` (Roslyn csc.exe) et `-RuntimeDirectory`
(.NET 6). `-BaseArchive` accepte la copie de l’archive Steam dont le SHA-256
est fixé dans `owner-prepared-modules.json`. Le script ne modifie pas le jeu.

Les ZIP sont publiés sur Backblaze comme assets `xbox-module`. L’installation
sélectionne cet asset uniquement pour Xbox et contrôle le module, le support
ShenPulse et le chargeur avant le lancement. Ne pas inclure les dossiers
interop/cache, les configurations personnelles, les sauvegardes ou les
sondes de diagnostic dans un pack. Les dépendances et notices de licence
nécessaires sont conservées.
