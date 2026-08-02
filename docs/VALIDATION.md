# Rapport de validation — ShenPulse 1.0.6

Date : 2 août 2026
Environnement : Windows x64, Node.js 24.14.0, Electron 43.2.0,
electron-builder 26.15.3, Windows SDK 10.0.26100.0.

## Résultats

- syntaxe contrôlée sur 117 fichiers JavaScript ;
- 375 tests réussis, 0 échec ;
- installation silencieuse de l’installeur NSIS dans un dossier isolé réussie ;
- lancement du binaire installé 1.0.6.0 réussi ;
- présence puis exécution du désinstalleur validées ;
- création AppX réussie par electron-builder ;
- identité `ShenPulse.ShenPulse`, version `1.0.6.0` et architecture x64 contrôlées ;
- AppXUpload ouvert et contenu contrôlé par le script de build.

## Artefacts

| Fichier | Taille | SHA-256 |
|---|---:|---|
| `ShenPulseSetup-1.0.6-x64.exe` | 502 696 033 octets | `6363D4349E54B97A8B4845AE15D2FB1EB5D9825851AA3A70D74EE055B9F3DA04` |
| `ShenPulseSetup-1.0.6.exe` | 502 696 033 octets | `6363D4349E54B97A8B4845AE15D2FB1EB5D9825851AA3A70D74EE055B9F3DA04` |
| `ShenPulse-1.0.6-x64.appx` | 553 886 194 octets | `96751CE85FEA61971C7AC175F0291CAF6CCB46F4D9B5EEBF70C55E570185536D` |
| `ShenPulse-1.0.6-x64.appxupload` | 553 730 268 octets | `5A0360B63CD82D9EBBB0534D749A96DA76583DFB6BDF10CAEB8E0BAD1AF45980` |

Le fichier sans suffixe d’architecture est une copie binaire identique destinée
au chemin de téléchargement public du site.

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
  -appxpackagepath "C:\chemin\ShenPulse-1.0.6-x64.appx" `
  -reportoutputpath "C:\chemin\ShenPulse-WACK.xml"
```

Partner Center réexécutera ses propres contrôles lors d'un vol privé ou d'une
soumission.
