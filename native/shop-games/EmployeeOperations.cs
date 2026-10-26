using System;
using System.Collections.Generic;
using System.Linq;
namespace ShenPulse.ShopGames {
 internal static class EmployeeOperations {
  // Les identifiants du jeu peuvent être non contigus et les listes changent
  // pendant un renvoi : copier avant de parcourir évite de sauter un contrat.
  public static int Dismiss(IEnumerable<int> ids, Action<int> dismiss, Func<int,bool> hired) {
   int count=0;foreach(int id in ids.Distinct().ToArray())if(hired(id)){dismiss(id);if(!hired(id))count++;}return count;
  }
 }
}
