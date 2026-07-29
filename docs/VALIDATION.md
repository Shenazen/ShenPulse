# Rapport de validation — ShenPulse 1.0.0

Date : 27 juillet 2026  
Environnement : Windows x64, Node.js 24.14.0, Electron 43.2.0,
electron-builder 26.15.3, Windows SDK 10.0.26100.0.

## Résultats

- syntaxe contrôlée sur 27 fichiers JavaScript ;
- 16 tests réussis, 0 échec ;
- test HTTP de l'API/overlay avec contrôle d'authentification réussi ;
- test fumée du renderer en développement réussi ;
- test fumée du binaire `dist/win-unpacked/ShenPulse.exe` réussi ;
- événement cadeau traversant normalisation, règles, alertes et jeu de démo ;
- `npm audit` : 0 vulnérabilité de production ou de développement ;
- création AppX réussie par electron-builder ;
- extraction/validation AppX réussie par MakeAppx ;
- identité, Publisher, version, Windows cible et capacités contrôlés ;
- AppXUpload ouvert et contenu contrôlé par le script de build.

## Artefacts

| Fichier | Taille | SHA-256 |
|---|---:|---|
| `ShenPulse-1.0.0-x64.appx` | 137 122 830 octets | `872137C2FA1BB2E23F2D4364650970025C3D787D1213518761C1E600FD2A043F` |
| `ShenPulse-1.0.0-x64.appxupload` | 136 753 120 octets | `8B50E15C39FAF0F997C3EA15349B5FA2DDAE00D340EE2CBE6E7FFB7CA39E71D1` |

Le package Store est volontairement non signé. Partner Center signe les packages
AppX/MSIX après certification. Une signature de test est uniquement nécessaire
pour le sideload local.

## Contrôle restant dans une session administrateur interactive

Le Windows App Certification Kit installé sur cette machine n'a pas pu terminer
depuis la session d'agent gérée : `appcert.exe reset` reste en attente car le WACK
exige une session utilisateur active avec droits administrateur. Exécuter :

```powershell
appcert.exe reset
appcert.exe test `
  -appxpackagepath "C:\chemin\ShenPulse-1.0.0-x64.appx" `
  -reportoutputpath "C:\chemin\ShenPulse-WACK.xml"
```

Partner Center réexécutera ses propres contrôles lors d'un vol privé ou d'une
soumission.

