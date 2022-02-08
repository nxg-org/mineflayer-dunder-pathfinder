import { Block } from "prismarine-block";
import { Vec3 } from "vec3";
import { BlockInfo, BlockCheck } from "./blockInfo";

//TODO: create static reference to everything.

/**
 * I disagree with how this is implemeneted.
 * TODO: Add cleaner checks in the future.
 */
export class BetterBlock {
    public liquid: boolean;
    public treatAsNoBB: boolean;
    public replaceable: boolean;
    public safe: boolean;
    public physical: boolean;
    public height: number;
    public openable: boolean;
    public climbable: boolean;
    public affectedByGravity: boolean;

    public static fromCoords(world: any, x: number, y: number, z: number, blockInfo: BlockInfo, mergeInfo?: boolean): BetterBlock {
        return new BetterBlock(world.getBlock(x, y, z), blockInfo, mergeInfo);
    }
    public static fromVector(world: any, vec: Vec3, blockInfo: BlockInfo, mergeInfo?: boolean): BetterBlock {
        return new BetterBlock(world.getBlock(vec.x, vec.y, vec.z), blockInfo, mergeInfo);
    }
    public static fromBlockNoInfo(block: Block, blockInfo: BlockInfo): BetterBlock {
        return new BetterBlock(block, blockInfo, false);
    }
    public static fromBlockMergeInfo(block: Block, blockInfo: BlockInfo): BetterBlock {
        return new BetterBlock(block, blockInfo, true);
    }

    constructor(public block: Block | null, blockInfo: BlockInfo, mergeInfo?: boolean) {
        if (!block) {
            this.replaceable = false;
            this.safe = false;
            this.physical = false;
            this.liquid = false;
            this.climbable = false;
            this.height = 0;
            this.openable = false;
            this.affectedByGravity = false;
            this.treatAsNoBB = false;
            this.replaceable = false;
        } else {
            this.climbable = blockInfo.climbableIDs.has(block.type);
            this.safe =
                (block.boundingBox === "empty" || this.climbable || blockInfo.carpetIDs.has(block.type)) &&
                !blockInfo.avoidIDs.has(block.type);
            this.physical = block.boundingBox === "block" && !blockInfo.fenceIDs.has(block.type);
            this.replaceable = blockInfo.replaceableIDs.has(block.type) && !this.physical;
            this.liquid = blockInfo.treatAsLiquidIDs.has(block.type);
            this.height = block.position.y;
            this.affectedByGravity = blockInfo.gravityBlockIDs.has(block.type);
            this.openable = blockInfo.openableIDs.has(block.type);
            this.liquid = blockInfo.getBlockInfo(block, BlockCheck.WATER);
            this.treatAsNoBB = blockInfo.getBlockInfo(block, BlockCheck.SOLID);
            this.replaceable = !blockInfo.getBlockInfo(block, BlockCheck.BREAKANDREPLACE);
            for (const shape of block.shapes) {
                this.height = Math.max(this.height, block.position.y + shape[4]);
            }
            if (block && mergeInfo) {
                Object.assign(this, block);
            }
        }
    }

    // getBlock (pos, dx, dy, dz) {
    //     const b = pos ? this.bot.blockAt(new Vec3(pos.x + dx, pos.y + dy, pos.z + dz), false) : null
    //     if (!b) {
    //       return {
    //         replaceable: false,
    //         canFall: false,
    //         safe: false,
    //         physical: false,
    //         liquid: false,
    //         climbable: false,
    //         height: dy,
    //         openable: false
    //       }
    //     }
    //     block.climbable = this.climbables.has(block.type)
    //     block.safe = (block.boundingBox === 'empty' || block.climbable || this.carpets.has(block.type)) && !this.blocksToAvoid.has(block.type)
    //     block.physical = block.boundingBox === 'block' && !this.fences.has(block.type)
    //     block.replaceable = this.replaceables.has(block.type) && !block.physical
    //     block.liquid = this.liquids.has(block.type)
    //     block.height = pos.y + dy
    //     block.canFall = this.gravityBlocks.has(block.type)
    //     block.openable = this.openable.has(block.type)

    //     for (const shape of block.shapes) {
    //       block.height = Math.max(block.height, pos.y + dy + shape[4])
    //     }
    //     return b
    //   }
}
