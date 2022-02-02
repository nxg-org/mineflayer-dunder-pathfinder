import { FakeVec3, MAX_COST, MovementEnum } from "../../utils/constants";
import { BaseGoal } from "../../goals";
import { BetterBlockPos } from "../blocks/betterBlockPos";

/**
 * A node in the path, containing the cost and steps to get to it.
 *
 * @author leijurv
 */
export class PathNode {
    /**
     * The position of this node
     */
    public x: number;
    public y: number;
    public z: number;

    /**
     * Cached, should always be equal to goal.heuristic(pos)
     */
    public readonly estimatedCostToGoal: number;

    /**
     * Total cost of getting from start to here
     * Mutable and changed by PathFinder
     */
    public cost: number;

    /**
     * Should always be equal to estimatedCosttoGoal + cost
     * Mutable and changed by PathFinder
     */
    public combinedCost: number;

    /**
     * In the graph search, what previous node contributed to the cost
     * Mutable and changed by PathFinder
     */
    public parent: PathNode | undefined;

    /**
     * Where is this node in the array flattenization of the binary heap? Needed for decrease-key operations.
     */
    public heapPosition: number;

    constructor(x: number, y: number, z: number, public inLiquid: boolean, goal?: BaseGoal, previous?: PathNode) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.cost = MAX_COST;
        this.estimatedCostToGoal = goal ? goal.cost(this) : MAX_COST;
        if (isNaN(this.estimatedCostToGoal)) {
            throw goal + " calculated implausible heuristic";
        }
        this.combinedCost = this.cost + this.estimatedCostToGoal;
        this.heapPosition = -1;
        this.parent = previous;
    }

    public static EMPTY(): PathNode {
        return new PathNode(0, 0, 0, false);
    }

    public isOpen(): boolean {
        return this.heapPosition !== -1;
    }

    /**
     * TODO: Possibly reimplement hashCode and equals. They are necessary for this class to function but they could be done better
     *
     * @return The hash code value for this {@link PathNode}
     */
    public hashCode(): number {
        return BetterBlockPos.longHash(this.x, this.y, this.z);
    }

    public equals(other: any): boolean {
        // GOTTA GO FAST
        // ALL THESE CHECKS ARE FOR PEOPLE WHO WANT SLOW CODE
        // SKRT SKRT
        //if (obj == null || !(obj instanceof PathNode)) {
        //    return false;
        //}
        //return Objects.equals(this.pos, other.pos) && Objects.equals(this.goal, other.goal);

        return this.x == other.x && this.y == other.y && this.z == other.z;
    }
}
