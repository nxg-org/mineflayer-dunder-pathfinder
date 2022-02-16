import { Vec3 } from "vec3";
import { MAX_COST, MovementEnum } from "../../utils/constants";
import { BetterBlockPos } from "../blocks/betterBlockPos";
import { BlockInteraction, IBlockType } from "../blocks/blockInteraction";
import { PathNode } from "../nodes/node";
import { PathContext } from "../path/baritone/PathContext";
import { MovementData } from "./movementData";
import { CostInfo } from "../player/costCalculator";
import { MovementInfo } from "./movementsInfo";

export abstract class BaseMovement {
    public readonly ctx: PathContext;
    private state: MovementData;
    public cost: number;

    public readonly toBreak: BlockInteraction[];
    public readonly toPlace: BlockInteraction[];

    protected validPositionsCached?: Set<BetterBlockPos>;
    protected toBreakCached?: BetterBlockPos[];
    protected toPlaceCached?: BetterBlockPos[];

    constructor(
        ctx: PathContext,
        public readonly src: PathNode,
        public readonly dest: BetterBlockPos,
        toBreak: BetterBlockPos[],
        toPlace: BetterBlockPos[]
    ) {
        this.ctx = ctx;
        this.toBreak = toBreak.map(b => new BlockInteraction(IBlockType.BREAK, b));
        this.toPlace = toBreak.map(b => new BlockInteraction(IBlockType.PLACE, b));
        this.cost = MAX_COST;
        this.state = MovementData.DEFAULT(this.ctx.currentTick);
    }

    abstract calculateInfo(): MovementData;
    abstract calculateValidPositions(): Set<BetterBlockPos>;

    public getValidPositions(): Set<BetterBlockPos> {
        if (!this.validPositionsCached || this.validPositionsCached.size == 0) {
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
    protected playerInValidPosition(): boolean {
        return this.getValidPositions().has(this.ctx.bbpAtFeet()); //|| this.getValidPositions().has(((PathingBehavior) baritone.getPathingBehavior()).pathStart());
    }

    /**
     * Previously known as "update", instead renamed due to applying pre-calc'd data to bot.
     * @returns
     */
    public async applyState() {
        // await this.ctx.bot.look(this.state.target.yaw, this.state.target.pitch, this.state.target.forceRotations);
        for (let ind = this.state.minInputTime; ind <= this.state.maxInputTime; ind++) {
            if (this.state.inputsByTicks[ind]) {
                this.state.inputsByTicks[ind].apply(this.ctx);
            }
            const tmp = this.state.targetsByTicks[ind];
            if (tmp) {
                this.ctx.bot.look(tmp.yaw, tmp.pitch, tmp.forceRotations);
            }
            await this.ctx.bot.waitForTicks(1);
        }
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
