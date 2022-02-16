import { BetterBlockPos } from "../../../blocks/betterBlockPos";
import { BaseGoal } from "../../../goals";
import { BaseMovement } from "../../../movement/movement";
import { PathNode } from "../../../nodes/node";
import { PathBase } from "./PathBase";
import Denque from "denque"
import { IPath } from "./IPath";
import { CutoffPath } from "./CutOffPath";

export class Path extends PathBase implements IPath {

    /**
     * The start position of this path
     */
    public readonly start: BetterBlockPos;

    /**
     * The end position of this path
     */
    public readonly  end: BetterBlockPos;

    /**
     * The blocks on the path. Guaranteed that path.get(0) equals start and
     * path.get(path.size()-1) equals end
     */
    public readonly positions: Array<BetterBlockPos>;

    public readonly movements: Array<BaseMovement>;

    private readonly nodes: Array<PathNode>;

    private readonly goal: BaseGoal;

    private readonly numNodes: number;

    private readonly context: /*CalculationContext */ any;

    private /* volitale */  verified: boolean; 


   constructor (world: any, start: PathNode, end: PathNode, numNodes: number, goal: BaseGoal, context: any) {
       super();
        this.start = new BetterBlockPos(world, start.x, start.y, start.z);
        this.end = new BetterBlockPos(world, end.x, end.y, end.z);
        this.numNodes = numNodes;
        this.movements = new Array<BaseMovement>();
        this.goal = goal;
        this.context = context;
        let current: PathNode | undefined = end;
        const tempPath = new Denque();
        const tempNodes = new Denque();
        // Repeatedly inserting to the beginning of an arraylist is O(n^2)
        // Instead, do it into a linked list, then convert at the end
        while (current != undefined) {
            tempNodes.push(current);
            tempPath.push(new BetterBlockPos(world, current.x, current.y, current.z));
            current = current.parent;
        }
        // Can't directly convert from the PathNode pseudo linked list to an array because we don't know how long it is
        // inserting into a LinkedList<E> keeps track of length, then when we addall (which calls .toArray) it's able
        // to performantly do that conversion since it knows the length.
        this.positions = tempPath.toArray();
        this.nodes = tempNodes.toArray();
        this.verified = false;
    }

    public getGoal(): BaseGoal {
        return this.goal;
    }

    private assembleMovements() {
        if (this.positions.length == 0 || this.movements.length != 0) {
            throw "IllegalStateException";
        }
        for (let i = 0; i < this.positions.length - 1; i++) {
            let cost = this.nodes[i + 1].cost - this.nodes[i].cost;
            let move = this.runBackwards(this.positions[i], this.positions[i + 1], cost);
            if (move == null) {
                return true;
            } else {
                this.movements.push(move);
            }
        }
        return false;
    }

    private runBackwards( src: BetterBlockPos,  dest: BetterBlockPos, cost: number) {
        for (const moves of Moves.values()) {
            const move = moves.apply0(this.context, src);
            if (move.getDest().equals(dest)) {
                // have to calculate the cost at calculation time so we can accurately judge whether a cost increase happened between cached calculation and real execution
                // however, taking into account possible favoring that could skew the node cost, we really want the stricter limit of the two
                // so we take the minimum of the path node cost difference, and the calculated cost
                move.override(Math.min(move.calculateCost(this.context), cost));
                return move;
            }
        }
        // this is no longer called from bestPathSoFar, now it's in postprocessing
        // Helper.HELPER.logDebug("Movement became impossible during calculation " + src + " " + dest + " " + dest.subtract(src));
        return null;
    }

    public postProcess(): IPath {
        if (this.verified) {
            throw "IllegalStateException";
        }
        this.verified = true;
        let failed = this.assembleMovements();
        this.movements.forEach(m => m.checkLoadedChunk(this.context));

        if (failed) { // at least one movement became impossible during calculation
            const res = CutoffPath.TO_END(this, this.movements.length);
            if (res.movements.length != this.movements.length) {
                throw "IllegalStateException";
            }
            return res;
        }
        // more post processing here
        this.sanityCheck();
        return this;
    }

    // @Override
    // public List<IMovement> movements() {
    //     if (!verified) {
    //         throw new IllegalStateException();
    //     }
    //     return Collections.unmodifiableList(movements);
    // }

    // @Override
    // public List<BetterBlockPos> positions() {
    //     return Collections.unmodifiableList(path);
    // }


    public getNumNodesConsidered() {
        return this.numNodes;
    }

  
    public getSrc(): BetterBlockPos {
        return this.start;
    }


    public getDest(): BetterBlockPos  {
        return this.end;
    }
}