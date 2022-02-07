/**
 * There is no equivalent BetterBlockPos in mineflayer since we don't have access to minecraft's native code.
 *
 * Let's implement it anyway based off of x,y,z and a block's position.
 */


import { AABB } from "@nxg-org/mineflayer-util-plugin";
import { Block } from "prismarine-block";
import { Vec3 } from "vec3";
import { BetterBlock } from "./betterBlock";
import { BlockInfo } from "./blockInfo";

/**
 * TODO: Implement manhattan methods later.
 */
export class BetterBlockPos {
    public readonly x: number;
    public readonly y: number;
    public readonly z: number;

    public static fromBlock(world: any, block: Block): BetterBlockPos {
        return new BetterBlockPos(world, block.position.x, block.position.y, block.position.z);
    }

    public static fromCoords(world: any, x: number, y: number, z: number): BetterBlockPos {
        return new BetterBlockPos(world, x, y, z);
    }

    constructor(public readonly world: any, x: number, y: number, z: number) {
        this.x = Math.floor(x);
        this.y = Math.floor(y);
        this.z = Math.floor(z);
    }

    asVec3(): Vec3 {
        return this as unknown as Vec3;
    }

    /**
     * There is no exact conversion to TypeScript here, check this fully later.
     */
    hashCode(): number {
        return ((this.longHash() & 0xffffffff) << 32) >> 32;
    }

    longHash(): number {
        let hash = 3241;
        hash = 3457689 * hash + this.x;
        hash = 8734625 * hash + this.y;
        hash = 2873465 * hash + this.z;
        return hash;
    }

    static longHash(x: number, y: number, z: number): number {
        let hash = 3241;
        hash = 3457689 * hash + x;
        hash = 8734625 * hash + y;
        hash = 2873465 * hash + z;
        return hash;
    }

    /**
     * 
     * @param obj Supports BetterBlockPos or Block
     * @returns boolean
     */
    equals(obj: any): boolean {
        if (obj == null) {
            return false;
        }
        if (obj instanceof BetterBlockPos) {
            return obj.x == this.x && obj.y == this.y && obj.z == this.z;
        }
        if (obj instanceof Block) {
            return obj.position.x == this.x && obj.position.y == this.y && obj.position.z == this.z
        }
        return false;
        // during path execution, like "if (whereShouldIBe.equals(whereAmI)) {"
        // sometimes we compare a BlockPos to a BetterBlockPos
        // return oth.getX() == x && oth.getY() == y && oth.getZ() == z;
    }

    up(): BetterBlockPos {
        return new BetterBlockPos(this.world, this.x, this.y + 1, this.z);
    }

    down(): BetterBlockPos {
        return new BetterBlockPos(this.world, this.x, this.y - 1, this.z);
    }

    north(amt: number = 1): BetterBlockPos {
        return new BetterBlockPos(this.world, this.x, this.y, this.z + amt);
    }

    south(amt: number = 1): BetterBlockPos {
        return new BetterBlockPos(this.world, this.x, this.y, this.z - amt);
    }

    east(amt: number = 1): BetterBlockPos {
        return new BetterBlockPos(this.world, this.x + amt, this.y, this.z);
    }

    west(amt: number = 1): BetterBlockPos {
        return new BetterBlockPos(this.world, this.x - amt, this.y, this.z);
    }

    offset(x: number, y: number, z: number): BetterBlockPos {
        return new BetterBlockPos(this.world, this.x + x, this.y + y, this.z + z);
    }

    subtract(x: number, y: number, z: number): BetterBlockPos {
        return new BetterBlockPos(this.world, this.x - x, this.y - y, this.z - z);
    }
    scale(scale: number) {
        return new BetterBlockPos(this.world, this.x * scale, this.y * scale, this.z * scale);
    }
    multiply(x: number, y: number, z: number): BetterBlockPos {
        return new BetterBlockPos(this.world, this.x * x, this.y * y, this.z * z);
    }
    relative(vec: Vec3): BetterBlockPos {
        const newVec = vec.normalize();
        return new BetterBlockPos(this.world, this.x + newVec.x, this.y + newVec.y, this.z + newVec.z);
    }

    getBlock(): Block | null {
        return this.world.getBlock(this.x, this.y, this.z);
    }

    getBetterBlock(blockInfo: BlockInfo, mergeInfo?: boolean): BetterBlock {
        return new BetterBlock(this.getBlock(), blockInfo, mergeInfo)
    }

    getAABB(): AABB {
        return new AABB(this.x, this.y, this.z, this.x + 1, this.y + 1, this.z + 1);
    }

    /**
     * Perhaps cache hash? it'll never change.
     * @returns String
     */
    toString(): string {
        return `BetterBlockPos{x=${this.x},y=${this.y},z=${this.z}}`
    }
}
