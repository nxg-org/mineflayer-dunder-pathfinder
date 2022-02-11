import { BetterBlockPos } from "../../blocks/betterBlockPos";
import { BaseGoal } from "../../goals";
import { BaseMovement } from "../../movement/movement";
import { hash } from "../../physics/physicsUtils";

export abstract class IPath {

    /**
     * Ordered list of movements to carry out.
     * movements.get(i).getSrc() should equal positions.get(i)
     * movements.get(i).getDest() should equal positions.get(i+1)
     * movements.size() should equal positions.size()-1
     *
     * @return All of the movements to carry out
     */
    abstract movements: Array<BaseMovement>;



    /**
     * All positions along the way.
     * Should begin with the same as getSrc and end with the same as getDest
     *
     * @return All of the positions along this path
     */
    abstract positions: Array<BetterBlockPos> 


    /**
     * @return The goal that this path was calculated towards
     */
    abstract getGoal(): BaseGoal;

    /**
     * This path is actually going to be executed in the world. Do whatever additional processing is required.
     * (as opposed to Path objects that are just constructed every frame for rendering)
     *
     * @return The result of path post processing
     */
    postProcess(): IPath {
        throw "UnsupportedOperationException";
    }

    /**
     * Returns the number of positions in this path. Equivalent to {@code positions().size()}.
     *
     * @return Number of positions in this path
     */
    length(): number {
        return this.positions.length;
    }

 

    /**
     * Returns the number of nodes that were considered during calculation before
     * this path was found.
     *
     * @return The number of nodes that were considered before finding this path
     */
    abstract getNumNodesConsidered(): number;

    /**
     * Returns the start position of this path. This is the first element in the
     * {@link List} that is returned by {@link IPath#positions()}.
     *
     * @return The start position of this path
     */
    getSrc(): BetterBlockPos {
        return this.positions[0];
    }

    /**
     * Returns the end position of this path. This is the last element in the
     * {@link List} that is returned by {@link IPath#positions()}.
     *
     * @return The end position of this path.
     */
    getDest() {
        return this.positions[this.positions.length - 1];
    }

    /**
     * Returns the estimated number of ticks to complete the path from the given node index.
     *
     * @param pathPosition The index of the node we're calculating from
     * @return The estimated number of ticks remaining frm the given position
     */
    ticksRemainingFrom(pathPosition: number) {
        let sum = 0;
        //this is fast because we aren't requesting recalculation, it's just cached
        for (let i = pathPosition; i < this.movements.length; i++) {
            sum += this.movements[i].cost;
        }
        return sum;
    }

    /**
     * Cuts off this path at the loaded chunk border, and returns the resulting path. Default
     * implementation just returns this path, without the intended functionality.
     * <p>
     * The argument is supposed to be a BlockStateInterface LOL LOL LOL LOL LOL
     *
     * @param bsi The block state lookup, highly cursed
     * @return The result of this cut-off operation
     */
    cutoffAtLoadedChunks(bsi: any): IPath {
        throw "UnsupportedOperationException";
    }

    /**
     * Cuts off this path using the min length and cutoff factor settings, and returns the resulting path.
     * Default implementation just returns this path, without the intended functionality.
     *
     * @param destination The end goal of this path
     * @return The result of this cut-off operation
     * @see Settings#pathCutoffMinimumLength
     * @see Settings#pathCutoffFactor
     */
    staticCutoff(destination: BaseGoal): IPath  {
        throw "UnsupportedOperationException";
    }


    /**
     * Performs a series of checks to ensure that the assembly of the path went as expected.
     */
    sanityCheck(): void {
        const path = this.positions
        const movements = this.movements
        if (!this.getSrc().equals(path[0])) {
            throw "Start node does not equal first path element";
        }
        if (!this.getDest().equals(path[path.length - 1])) {
            throw "End node does not equal last path element";
        }
        if (path.length != this.movements.length + 1) {
            throw "Size of path array is unexpected";
        }
        let seenSoFar: Map<String, BetterBlockPos> = new Map();
        // HashSet<BetterBlockPos> seenSoFar = new HashSet<>();
        for (let i = 0; i < path.length - 1; i++) {
            const src = path[i];
            const dest = path[i + 1];
            const movement = movements[i];
            if (!src.equals(movement.src)) {
                throw "Path source is not equal to the movement source";
            }
            if (!dest.equals(movement.dest)) {
                throw "Path destination is not equal to the movement destination";
            }
            if (seenSoFar.has(src.toString())) {
                throw "Path doubles back on itself, making a loop";
            }
            seenSoFar.set(src.toString(), src);
        }
    }
}