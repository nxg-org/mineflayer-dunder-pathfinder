import { Bot } from "mineflayer";
import { Block } from "prismarine-block";
import { Vec3 } from "vec3";
import { BetterBlockPos } from "../../blocks/betterBlockPos";
import { BlockInfo } from "../../blocks/blockInfo";
import { MovementInfo } from "../../movement/movementsInfo";
import { MovementData } from "../../movement/movementData";
import { PathNode } from "../../nodes/node";
import { PlayerState } from "../../physics/states/playerState";
import { CostInfo } from "../../player/costCalculator";
import { PlayerControls } from "../../player/playerControls";

export interface IContext {
    bot: Bot;
    moveInfo: MovementInfo;
    costInfo: CostInfo;
    blockInfo: BlockInfo;
    state: PlayerState;
    currentTick: number;
    blockReach: number;
    entityReach: number;
    world: any /* prismarine-world */;
    bbpAtFeet(): BetterBlockPos;
    getBBP(pos: Vec3): BetterBlockPos;
}

export class PathContext implements IContext {
    public readonly bot: Bot;
    public readonly moveInfo: MovementInfo;
    public readonly costInfo: CostInfo;
    public readonly blockInfo: BlockInfo;
    public state: PlayerState;
    public currentTick: number;
    public blockReach: number;
    public entityReach: number;
    public world: any;
    constructor(bot: Bot, moveInfo: MovementInfo, costInfo: CostInfo, blockInfo: BlockInfo, blockReach: number, entityReach: number) {
        this.bot = bot;
        this.world = this.bot.world;
        this.moveInfo = moveInfo;
        this.costInfo = costInfo;
        this.blockInfo = blockInfo;
        this.currentTick = 0;
        this.blockReach = blockReach;
        this.entityReach = entityReach;
        this.state = new PlayerState(bot.physics as any, bot, PlayerControls.DEFAULT());
    }

    getBBP(pos: Vec3): BetterBlockPos {
        return new BetterBlockPos(this.world, pos.x, pos.y, pos.z);
    }

    getBBPXYZOffset(node: {x: number, y: number, z: number}, x: number, y: number, z: number) {
        return new BetterBlockPos(this.world, node.x + x, node.y + y, node.z + z);
    }

    bbpAtFeet(): BetterBlockPos {
        const tmp = BetterBlockPos.fromCoords(this.world, this.state.position.x, this.state.position.y + 0.1251, this.state.position.z);
        const tmpBlock = tmp.getBlock();
        if (tmpBlock instanceof Block) {
            if (tmpBlock.shapes[0][4] > 0.2 && tmpBlock.shapes[0][4] < (this.bot.physics as any).stepHeight) {
                return tmp.up();
            }
        }
        return tmp;
    }
}
