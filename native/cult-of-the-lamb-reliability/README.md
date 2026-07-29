# Correctifs Cult of the Lamb

Ce module BepInEx complète le bridge ShenPulse existant sans modifier
`CrowdControl.dll`. Il remplace uniquement les interactions dont le chemin
historique n'est plus fiable dans les versions actuelles du jeu.

Compilation :

```powershell
.\native\cult-of-the-lamb-reliability\build.ps1
```

Le DLL produit doit être installé dans `BepInEx\plugins` à côté de
`ShenPulseCultBridge.dll`.
