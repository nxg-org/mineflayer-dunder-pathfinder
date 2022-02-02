import { Vec3 } from "vec3";
import { MAX_COST, MovementEnum } from "../utils/constants";
import { BetterBlockPos } from "../blocks/betterBlockPos";
import { BlockInteraction } from "../blocks/blockInteraction";
import { PathNode } from "../nodes/node";
const {PlayerState} = require("prismarine-physics")



export abstract class BaseMovement {

    public readonly toBreak:  BetterBlockPos[];
    public readonly toPlace: BetterBlockPos[];
    public cost: number;


    protected validPositionsCached?: Set<BetterBlockPos>;
    protected toBreakCached?: BetterBlockPos[];
    protected toPlaceCached?: BetterBlockPos[];

    constructor (public readonly src: BetterBlockPos, public readonly dest: BetterBlockPos) {
        this.toBreak = []
        this.toPlace = []
        this.cost = MAX_COST;
    }



    abstract calculateCost(): number;
    abstract calculateValidPositions(): Set<BetterBlockPos>;
    abstract prepared(playerState: any): boolean;


     public getValidPositions(): Set<BetterBlockPos> {
        if (this.validPositionsCached == null) {
            this.validPositionsCached = this.calculateValidPositions();
            // Objects.requireNonNull(validPositionsCached);
        }
        return this.validPositionsCached;
    }


    /**
     * 
     * @param playerState ACTUALLY PlayerState from prismarine-physics.
     * @returns 
     */
    protected  playerInValidPosition(playerState: any): boolean {
        return this.getValidPositions().has(playerState.position.floored()); //|| this.getValidPositions().has(((PathingBehavior) baritone.getPathingBehavior()).pathStart());
    }


    public update(): boolean {

    }





    public updateState(playerState: any): any {

    }

}

export class Movement extends Vec3 {
    public deltaBlocks: number;
    public readonly hash: string;
    public readonly direction: Vec3;
    constructor(
        public origin: PathNode,
        public type: MovementEnum,
        x: number,
        y: number,
        z: number,
        public inLiquid: boolean,
        public cost: number,
        public toBreak: BlockInteraction[] = [],
        public toPlace: BlockInteraction[] = [],
        public safeToCancel: boolean = false
    ) {
        super(Math.floor(x), Math.floor(y), Math.floor(z));
        this.deltaBlocks = /* toPlace.length */ -toPlace.length; // if uncomment, assume pick up blocks. This is probably really bad, lol.
        this.direction = new Vec3(this.origin.x - this.x, this.origin.y - this.y, this.origin.z - this.z);
        this.hash = this.x + "," + this.y + "," + this.z;
    }
}
