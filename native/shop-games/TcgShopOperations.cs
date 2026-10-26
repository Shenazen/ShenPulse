using System;
using System.Collections.Generic;
using UnityEngine;

namespace ShenPulse.ShopGames {
    internal static class TcgShopOperations {
        private static void Clear(ShelfCompartment compartment) {
            while (compartment.GetItemCount() > 0) {
                Item item = compartment.GetLastItem();
                if (item == null) throw new InvalidOperationException("Un article du rayon est indisponible.");
                compartment.RemoveItem(item);
                ItemSpawnManager.DisableItem(item);
            }
        }
        public static int Fill(IEnumerable<ShelfCompartment> compartments) {
            int added = 0;
            foreach (ShelfCompartment compartment in compartments) {
                if (compartment == null || !compartment.isActiveAndEnabled || !compartment.m_CanPutItem || compartment.m_CanPutBox) continue;
                EItemType type = compartment.GetItemType();
                int previous = compartment.GetItemCount();
                if (type == EItemType.None || previous >= compartment.GetMaxItemCount()) continue;
                // Le jeu prépare lui-même les variantes de textures et les
                // emplacements. SpawnItem attend un stock reconstruit, pas un ajout.
                Clear(compartment);
                compartment.SetCompartmentItemType(type);
                compartment.CalculatePositionList();
                try { compartment.SpawnItem(compartment.GetMaxItemCount(), true); }
                catch {
                    Clear(compartment);
                    compartment.SetCompartmentItemType(type);
                    compartment.CalculatePositionList();
                    compartment.SpawnItem(previous, true);
                    throw;
                }
                added += compartment.GetItemCount() - previous;
            }
            return added;
        }
        public static void Empty(ShelfCompartment compartment) {
            EItemType type = compartment.GetItemType();
            Clear(compartment);
            // Garder l'étiquette permet de remplir à nouveau le rayon vidé.
            compartment.SetCompartmentItemType(type);
            compartment.CalculatePositionList();
        }
        public static void LaunchBox(InteractablePackagingBox box, Vector3 direction, float strength) {
            if (box.m_Rigidbody == null) throw new InvalidOperationException("Le carton n’a pas de corps physique.");
            box.SetPhysicsEnabled(true); // Réveille aussi les cartons stabilisés par le jeu.
            box.m_Rigidbody.WakeUp();
            box.m_Rigidbody.AddForce(direction.normalized * strength, ForceMode.VelocityChange);
            box.m_Rigidbody.AddTorque(UnityEngine.Random.insideUnitSphere * strength, ForceMode.VelocityChange);
        }
    }
}
