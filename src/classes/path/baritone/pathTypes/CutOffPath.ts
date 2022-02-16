import { BetterBlockPos } from "../../../blocks/betterBlockPos";
import { BaseGoal } from "../../../goals";
import { BaseMovement } from "../../../movement/movement";
import { IPath } from "./IPath";
import { PathBase } from "./PathBase";

export class CutoffPath extends PathBase {


    public readonly positions: Array<BetterBlockPos>;

    public readonly movements: Array<BaseMovement>
    public readonly numNodes: number;

    public readonly goal: BaseGoal;

    constructor(prev: IPath, firstPositionToInclude: number, lastPositionToInclude: number) {
        super();
        this.positions = prev.positions.slice(firstPositionToInclude, lastPositionToInclude + 1)
        this.movements = prev.movements.slice(firstPositionToInclude, lastPositionToInclude);
        this.numNodes = prev.getNumNodesConsidered();
        this.goal = prev.getGoal();
        this.sanityCheck();
    }

    public static TO_END(prev: IPath, lastPositionToInclude: number) {
        return new CutoffPath(prev, 0, lastPositionToInclude);
    }

    getGoal(): BaseGoal {
        return this.goal;
    }
    getNumNodesConsidered(): number {
        return this.numNodes
    }
}