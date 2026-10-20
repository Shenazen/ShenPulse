using SDG.Unturned;
using UnityEngine;

namespace ShenPulse.Unturned
{
    // Use Unturned's regular pathfinding in towns and its collision-aware controller elsewhere.
    public sealed class RoamingMovement : IUnturnedPathfindingMovementComponentInterface
    {
        public IUnturnedPathfindingMovementComponentInterface Original { get; private set; }
        private readonly Zombie zombie;
        private readonly NonPathfindingZombieMovementComponent roaming;
        private bool canSearch;

        public RoamingMovement(Zombie owner, IUnturnedPathfindingMovementComponentInterface original)
        {
            zombie = owner;
            Original = original;
            roaming = owner.gameObject.AddComponent<NonPathfindingZombieMovementComponent>();
            CanMove = original.CanMove; CanTurn = original.CanTurn; CanSearch = original.CanSearch;
            Speed = original.Speed; TargetTransform = original.TargetTransform; TargetDirection = original.TargetDirection;
        }

        public bool CanMove { get { return roaming.CanMove; } set { Original.CanMove = roaming.CanMove = value; } }
        public bool CanTurn { get { return roaming.CanTurn; } set { Original.CanTurn = roaming.CanTurn = value; } }
        public bool CanSearch { get { return canSearch; } set { canSearch = value; roaming.CanSearch = value; } }
        public float Speed { get { return roaming.Speed; } set { Original.Speed = roaming.Speed = value; } }
        public Transform TargetTransform { get { return roaming.TargetTransform; } set { Original.TargetTransform = roaming.TargetTransform = value; } }
        public Vector3 TargetDirection { get { return roaming.TargetDirection; } set { Original.TargetDirection = roaming.TargetDirection = value; } }

        public void Move(float deltaTime)
        {
            byte from, to;
            bool useNavigation = TargetTransform != null && LevelNavigation.tryGetNavigation(zombie.transform.position, out from)
                && LevelNavigation.tryGetNavigation(TargetTransform.position, out to) && from == to;
            Original.CanSearch = useNavigation && canSearch;
            if (useNavigation) Original.Move(deltaTime);
            else if (TargetTransform != null) roaming.Move(Mathf.Min(deltaTime, 0.1f));
        }

        public void Dispose()
        {
            Original.CanSearch = canSearch;
            if (roaming != null) Object.Destroy(roaming);
        }
    }
}
