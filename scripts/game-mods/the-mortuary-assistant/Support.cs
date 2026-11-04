using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using Il2Cpp;
using UnityEngine;

namespace ShenPulse.MortuarySupport
{
    // Built against the game's generated interop assemblies. No game files are redistributed here.
    public static class Corrections
    {
        private static readonly Dictionary<object, float> PossessionLevels = new();
        private static readonly Type ResultType = typeof(ShenPulse.TheMortuaryAssistant.Plugin).Assembly
            .GetType("ShenPulse.TheMortuaryAssistant.Delegates.Effects.EffectResult", true);

        private static object Result(string method, string message)
        {
            var target = ResultType.GetMethod(method, BindingFlags.Public | BindingFlags.Static);
            return target.Invoke(null, method == "Success"
                ? new object[] { message }
                : new object[] { message, Enum.ToObject(target.GetParameters()[1].ParameterType, 16640) });
        }

        public static InventoryItem FindItem(string[] terms)
        {
            var items = Resources.FindObjectsOfTypeAll<InventoryItem>();
            // Exact IDs win over substrings: sigilPaper must never resolve to sigilPaperBurned.
            foreach (var term in terms)
                foreach (var item in items)
                    if (item != null && string.Equals(item.itemID, term, StringComparison.OrdinalIgnoreCase))
                        return item;
            foreach (var item in items)
                if (item != null && terms.Any(term =>
                    (item.itemID ?? "").IndexOf(term, StringComparison.OrdinalIgnoreCase) >= 0)) return item;
            return null;
        }

        public static object TestFill()
        {
            var manager = GameManager.Ins;
            var machine = manager?.embalmingRunner;
            if (machine == null || machine.currentRunner == null || !machine.currentRunner.inOproom ||
                machine.currentbody == null || machine.mixtureNeeded == null || machine.mixtureNeeded.Length == 0)
                return Result("Retry", "Installez un corps sur la table avant de remplir la machine.");
            if (machine.mixtureNeeded.All(id => machine.mixtureAdded.Contains(id)))
                return Result("Failure", "La machine contient déjà tous les ingrédients.");
            if (InventoryManager.Ins == null || InventoryManager.Ins.PocketsFull())
                return Result("Retry", "Libérez une poche pour ajouter les ingrédients.");
            if (machine.mixtureNeeded.Any(id => !machine.mixtureAdded.Contains(id) && FindItem(new[] { id }) == null))
                return Result("Retry", "Les ingrédients de cette garde ne sont pas encore disponibles.");
            return Result("Success", null);
        }

        public static object Fill()
        {
            var manager = GameManager.Ins;
            var machine = manager.embalmingRunner;
            var inventory = InventoryManager.Ins;
            int added = 0;
            bool menuWasOpen = manager.inRmenu;
            var save = StaticData.data.saveState;
            var ownedItems = save.items.ToArray();
            var usedItems = save.usedItems.ToArray();
            var slots = inventory.inventorySlots.Select(slot => new {
                slot.inUse, slot.itemInfo, slot.uID,
                Sprite = slot.icon?.sprite, Enabled = slot.icon != null && slot.icon.enabled,
                Color = slot.icon != null ? slot.icon.color : Color.white
            }).ToArray();
            try
            {
                foreach (string id in machine.mixtureNeeded)
                {
                    if (machine.mixtureAdded.Contains(id)) continue;
                    var occupied = inventory.inventorySlots.Select(slot => slot.inUse).ToArray();
                    inventory.AddItem(FindItem(new[] { id }), false, "");
                    // MixFluid expects an inventory SLOT, not the index of an ingredient.
                    // Slots 0/1 are the hands; AddItem chooses the available pocket itself.
                    int index = Enumerable.Range(0, occupied.Length).FirstOrDefault(i =>
                        !occupied[i] && inventory.inventorySlots[i].inUse &&
                        inventory.inventorySlots[i].itemInfo?.itemID == id, -1);
                    if (index < 0) return Result("Retry", "Impossible de placer cet ingrédient dans une poche libre.");
                    machine.MixFluid(index);
                    if (!machine.mixtureAdded.Contains(id))
                        return Result("Retry", "La machine n’a pas accepté cet ingrédient.");
                    added++;
                }
            }
            finally
            {
                // Native MixFluid removes by item ID and may remove an already-owned bottle too.
                // Ingredients supplied by this effect must leave the player's inventory unchanged.
                save.items.Clear();
                foreach (string item in ownedItems) save.items.Add(item);
                save.usedItems.Clear();
                foreach (string item in usedItems) save.usedItems.Add(item);
                for (int index = 0; index < slots.Length; index++)
                {
                    var slot = inventory.inventorySlots[index];
                    var original = slots[index];
                    slot.inUse = original.inUse; slot.itemInfo = original.itemInfo; slot.uID = original.uID;
                    if (slot.icon != null)
                    {
                        slot.icon.sprite = original.Sprite;
                        slot.icon.enabled = original.Enabled;
                        slot.icon.color = original.Color;
                    }
                }
                // The game's MixFluid opens the item selector. A viewer effect must leave controls free.
                if (!menuWasOpen && manager.inRmenu) manager.playerInteraction.RmenuToggle(false);
            }
            return Result("Success", $"Machine remplie : {added} ingrédient(s) ajouté(s).");
        }

        public static void SetPassivePossession(object effect, bool active)
        {
            var definition = effect.GetType().BaseType.GetProperty("Definition").GetValue(effect);
            string code = definition.GetType().GetProperty("Code").GetValue(definition) as string;
            typeof(ShenPulse.TheMortuaryAssistant.Plugin).Assembly
                .GetType("ShenPulse.TheMortuaryAssistant.Delegates.Effects.EffectRuntime", true)
                .GetProperty(code == "pause_possession" ? "PausePossession" : "AcceleratePossession")
                .SetValue(null, active);
            PossessionLevels.Remove(effect);
            if (!active || StaticData.data?.saveState == null) return;
            PossessionLevels[effect] = StaticData.data.saveState.posLvl;
        }

        public static void TickPossession(object effect)
        {
            if (!PossessionLevels.TryGetValue(effect, out float previous) || StaticData.data?.saveState == null) return;
            var save = StaticData.data.saveState;
            var runtime = typeof(ShenPulse.TheMortuaryAssistant.Plugin).Assembly
                .GetType("ShenPulse.TheMortuaryAssistant.Delegates.Effects.EffectRuntime", true);
            bool paused = (bool)runtime.GetProperty("PausePossession").GetValue(null);
            float increase = save.posLvl - previous;
            // The game recalculates its passive rate every frame. Apply to actual progress as well.
            // Decreases remain intact; positive progress is frozen or doubled once.
            if (increase > 0f) save.posLvl = paused ? previous : Math.Min(100f, previous + increase * 2f);
            PossessionLevels[effect] = save.posLvl;
        }

        public static bool AdjustPossession(ref float amount)
        {
            var runtime = typeof(ShenPulse.TheMortuaryAssistant.Plugin).Assembly
                .GetType("ShenPulse.TheMortuaryAssistant.Delegates.Effects.EffectRuntime", true);
            return amount <= 0f || !(bool)runtime.GetProperty("PausePossession").GetValue(null);
        }

        public static object DemonicActivity()
        {
            var haunt = GameManager.Ins.hauntSys;
            bool previous = haunt.forceSubEvent;
            try
            {
                // The ordinary TrySubEvent is probabilistic; an accepted gift must trigger an event.
                haunt.forceSubEvent = true;
                haunt.TrySubEvent(haunt.currentHauntingLocation);
            }
            finally { haunt.forceSubEvent = previous; }
            return haunt.runningSubEvent || haunt.runningTellEvent
                ? Result("Success", "Une activité démoniaque a commencé.")
                : Result("Retry", "Aucune manifestation n’est disponible ici pour le moment.");
        }
    }
}
