import { BaseGoal } from "../../goals";
import { BetterBlockPos } from "../blocks/betterBlockPos";
import { PathNode } from "../nodes/node";

/**
 * Any pathfinding algorithm that keeps track of nodes recursively by their cost (e.g. A*, dijkstra)
 *
 * @author leijurv
 */
export abstract class AbstractNodeCostSearch {


    protected readonly worldContext: any;
    protected readonly startX: number;
    protected readonly startY: number;
    protected readonly startZ: number;

    protected readonly goal: BaseGoal;

    private context: any;

    /**
     * @see <a href="https://github.com/cabaletta/baritone/issues/107">Issue #107</a>
     */
    private map: Map<number, PathNode>;

    protected startNode: PathNode;

    protected mostRecentConsidered: PathNode;

    protected bestSoFar: PathNode[] = Array<PathNode>();

    private isFinished: boolean = false;

    protected cancelRequested: boolean = false;

    /**
     * This is really complicated and hard to explain. I wrote a comment in the old version of MineBot but it was so
     * long it was easier as a Google Doc (because I could insert charts).
     *
     * @see <a href="https://docs.google.com/document/d/1WVHHXKXFdCR1Oz__KtK8sFqyvSwJN_H4lftkHFgmzlc/edit">here</a>
     */
    protected static readonly COEFFICIENTS: number[] = [1.5, 2, 2.5, 3, 4, 5, 10];

    /**
     * If a path goes less than 5 blocks and doesn't make it to its goal, it's not worth considering.
     */
    protected static readonly MIN_DIST_PATH: number = 5;

    /**
     * there are floating point errors caused by random combinations of traverse and diagonal over a flat area
     * that means that sometimes there's a cost improvement of like 10 ^ -16
     * it's not worth the time to update the costs, decrease-key the heap, potentially repropagate, etc
     * <p>
     * who cares about a hundredth of a tick? that's half a millisecond for crying out loud!
     */
    protected static readonly MIN_IMPROVEMENT: number = 0.01;

    //CalculationContext context
    constructor(world: any, startX: number,  startY: number, startZ: number, goal: BaseGoal, ) {
        this.worldContext = world;
        this.startX = startX;
        this.startY = startY;
        this.startZ = startZ;
        this.goal = goal;
        // this.context = context;
        this.map = new Map<number, PathNode>(); //new Long2ObjectOpenHashMap<>(Baritone.settings().pathingMapDefaultSize.value, Baritone.settings().pathingMapLoadFactor.value);
    }

    public cancel(): void {
        this.cancelRequested = true;
    }

    public calculate(primaryTimeout: number,  failureTimeout: number): PathCalculationResult {
        if (this.isFinished) {
            //new IllegalStateException()
            throw "Path finder cannot be reused!";
        }
        this.cancelRequested = false;
        try {
            let path: /*IPath */ any = this.calculate0(primaryTimeout, failureTimeout).map(/*IPath::postProcess*/).orElse(null);
            if (this.cancelRequested) {
                return new PathCalculationResult(PathCalculationResult.Type.CANCELLATION);
            }
            if (path == null) {
                return new PathCalculationResult(PathCalculationResult.Type.FAILURE);
            }
            let previousLength: number = path.length();
            path = path.cutoffAtLoadedChunks(context.bsi);
            if (path.length() < previousLength) {
                // Helper.HELPER.logDebug("Cutting off path at edge of loaded chunks");
                // Helper.HELPER.logDebug("Length decreased by " + (previousLength - path.length()));
            } else {
                // Helper.HELPER.logDebug("Path ends within loaded chunks");
            }
            previousLength = path.length();
            path = path.staticCutoff(goal);
            if (path.length() < previousLength) {
                // Helper.HELPER.logDebug("Static cutoff " + previousLength + " to " + path.length());
            }
            if (this.goal.isInGoal(path.getDest())) {
                return //new PathCalculationResult(PathCalculationResult.Type.SUCCESS_TO_GOAL, path);
            } else {
                return //new PathCalculationResult(PathCalculationResult.Type.SUCCESS_SEGMENT, path);
            }
        } catch (e) {
            // Helper.HELPER.logDirect("Pathing exception: " + e);
            console.error(e);
            // e.printStackTrace();
            return //new PathCalculationResult(PathCalculationResult.Type.EXCEPTION);
        } finally {
            // this is run regardless of what exception may or may not be raised by calculate0
            this.isFinished = true;
        }
    }

    protected abstract  calculate0(primaryTimeout: number, failureTimeout: number): any//Optional<IPath>;

    /**
     * Determines the distance squared from the specified node to the start
     * node. Intended for use in distance comparison, rather than anything that
     * considers the real distance value, hence the "sq".
     *
     * @param n A node
     * @return The distance, squared
     */
    protected getDistFromStartSq(n: PathNode): number {
        const xDiff = n.x - this.startX;
        const yDiff = n.y - this.startY;
        const zDiff = n.z - this.startZ;
        return xDiff * xDiff + yDiff * yDiff + zDiff * zDiff;
    }

    /**
     * Attempts to search the block position hashCode long to {@link PathNode} map
     * for the node mapped to the specified pos. If no node is found,
     * a new node is created.
     *
     * @param x        The x position of the node
     * @param y        The y position of the node
     * @param z        The z position of the node
     * @param hashCode The hash code of the node, provided by {@link BetterBlockPos#longHash(int, int, int)}
     * @return The associated node
     * @see <a href="https://github.com/cabaletta/baritone/issues/107">Issue #107</a>
     */

    protected getNodeAtPosition(x: number, y: number, z: number, hashCode: number): PathNode  {
        let node: PathNode | undefined = this.map.get(hashCode);
        if (node == null) {
            node = new PathNode(x, y, z, BetterBlockPos.fromCoords(this.worldContext, x, y, z).getBlock().. this.goal);
            this.map.set(hashCode, node);
        }
        return node;
    }

    @Override
    public Optional<IPath> pathToMostRecentNodeConsidered() {
        return Optional.ofNullable(mostRecentConsidered).map(node -> new Path(startNode, node, 0, goal, context));
    }

    @Override
    public Optional<IPath> bestPathSoFar() {
        return bestSoFar(false, 0);
    }

    protected Optional<IPath> bestSoFar(boolean logInfo, int numNodes) {
        if (startNode == null) {
            return Optional.empty();
        }
        double bestDist = 0;
        for (int i = 0; i < COEFFICIENTS.length; i++) {
            if (bestSoFar[i] == null) {
                continue;
            }
            double dist = getDistFromStartSq(bestSoFar[i]);
            if (dist > bestDist) {
                bestDist = dist;
            }
            if (dist > MIN_DIST_PATH * MIN_DIST_PATH) { // square the comparison since distFromStartSq is squared
                if (logInfo) {
                    if (COEFFICIENTS[i] >= 3) {
                        System.out.println("Warning: cost coefficient is greater than three! Probably means that");
                        System.out.println("the path I found is pretty terrible (like sneak-bridging for dozens of blocks)");
                        System.out.println("But I'm going to do it anyway, because yolo");
                    }
                    System.out.println("Path goes for " + Math.sqrt(dist) + " blocks");
                    logDebug("A* cost coefficient " + COEFFICIENTS[i]);
                }
                return Optional.of(new Path(startNode, bestSoFar[i], numNodes, goal, context));
            }
        }
        // instead of returning bestSoFar[0], be less misleading
        // if it actually won't find any path, don't make them think it will by rendering a dark blue that will never actually happen
        if (logInfo) {
            logDebug("Even with a cost coefficient of " + COEFFICIENTS[COEFFICIENTS.length - 1] + ", I couldn't get more than " + Math.sqrt(bestDist) + " blocks");
            logDebug("No path found =(");
            logNotification("No path found =(", true);
        }
        return Optional.empty();
    }

    @Override
    public final boolean isFinished() {
        return isFinished;
    }

    @Override
    public final Goal getGoal() {
        return goal;
    }

    public BetterBlockPos getStart() {
        return new BetterBlockPos(startX, startY, startZ);
    }

    protected int mapSize() {
        return map.size();
    }
}