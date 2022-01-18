import { Bot } from "mineflayer";
import { Vec3 } from "vec3";
import md from "minecraft-data";
import { MovementEnum } from "./constants";
import { cantGetBlockError, parentBrokeInPast, parentBrokeInPastBlock } from "./util";
import { Node } from "./node";
import { Block } from "prismarine-block";

const noNeedToBreakNames = new Set(["air", "cave_air", "void_air", "lava", "flowing_lava", "water", "flowing_water"]);

export enum TypeCheck {
    water,
    lava,
    air,

}


export class BlockInfo {
    private data: md.IndexedData;

    private autoReplaceBlockIDs: Set<number> = new Set();
    private airBlockIDs: Set<number> = new Set();
    private treatAsWaterIDs: Set<number> = new Set();
    private lavaBlockIDs: Set<number> = new Set();

    private cobwebID?: number;
    private lilypadID?: number;

    constructor(private bot: Bot) {
        this.data = md(bot.version);
        this.cobwebID = this.data.blocksByName["cobweb"]?.id;
        this.lilypadID = this.data.blocksByName["lilypad"]?.id;

        for (const blockName in this.data.blocksByName) {
            if (noNeedToBreakNames.has(blockName)) this.autoReplaceBlockIDs.add(this.data.blocksByName[blockName].id);
            if (blockName.includes("lava")) this.lavaBlockIDs.add(this.data.blocksByName[blockName].id);
            if (blockName.includes("water")) this.lavaBlockIDs.add(this.data.blocksByName[blockName].id);
            if (blockName.includes("air")) this.lavaBlockIDs.add(this.data.blocksByName[blockName].id);
        }
    }

    shouldBreakBeforePlaceBlock(x: number, y: number, z: number): boolean {
        const block = this.bot.blockAt(new Vec3(x, y, z));
        if (!block) throw cantGetBlockError("shouldBreakBeforePlaceBlock", x, y, z);
        if (block.shapes.length === 0) return false;
        else if (!this.canStandOnBlock(x, y, z) && !this.autoReplaceBlockIDs.has(block.type)) return true;
        return false;
    }

    isBlockDiggable(x: number, y: number, z: number): boolean {
        const block = this.bot.blockAt(new Vec3(x, y, z));
        if (!block) throw cantGetBlockError("isBlockDiggable", x, y, z);
        return !!(block && block.hardness);
    }

    canStandOnBlock(x: number, y: number, z: number, parentNode?: Node): boolean {
        const block = this.bot.blockAt(new Vec3(x, y, z));
        if (!block) throw cantGetBlockError("canStandOnBlock", x, y, z);
        if (
            block.shapes.length == 1 &&
            block.shapes[0][0] <= 0.126 &&
            block.shapes[0][2] <= 0.126 &&
            block.shapes[0][3] >= 1 - 0.126 &&
            block.shapes[0][4] >= 1 - 0.126 &&
            block.shapes[0][4] <= 1 + 0.126 &&
            block.shapes[0][5] >= 1 - 0.126
        ) {
            return !parentNode || !parentBrokeInPastBlock(block.position, parentNode);
        }
        return false;
    }


    /**
     * DOES NOT CHECK FOR ABOVE BLOCKS.
     * @param block 
     * @param parentNode 
     * @param extras 
     * @returns 
     */
    canWalkOnBlock(
        block: Block,
        parentNode?: Node,
        extras: [waterAllowed: boolean, lavaAllowed: boolean] = [false, false]
    ): boolean {
        // const block = this.bot.blockAt(new Vec3(x, y, z));
        // if (!block) throw cantGetBlockError("canWalkOnBlock", x, y, z);
        if (block.type === this.cobwebID) return false;
        if (!extras[0] && this.isWater(block)) return false;
        if (!extras[1] && this.isLava(block)) return false;
        return !parentNode || !parentBrokeInPastBlock(block.position, parentNode);
    }


    isBlockSolid(block: Block, parentNode?: Node): boolean {
        // const block = this.bot.blockAt(new Vec3(x, y, z));
        // if (!block) throw cantGetBlockError("isBlockSolid", x, y, z);
        if (block && block.shapes.length > 0 && block.type != this.cobwebID) return false;
        return !parentNode || !parentBrokeInPastBlock(block.position, parentNode);
    }

    isWater(block: Block): boolean {
        // const block = this.bot.blockAt(new Vec3(x, y, z));
        // if (!block) throw cantGetBlockError("isWater", x, y, z);
        return !!(block && this.treatAsWaterIDs.has(block.type));
    }

    isAir(block: Block): boolean {
        // const block = this.bot.blockAt(new Vec3(x, y, z));
        // if (!block) throw cantGetBlockError("isAir", x, y, z);
        return !!(block && this.airBlockIDs.has(block.type) && block.shapes.length === 0);
    }

    isCobweb(block: Block): boolean {
        // const block = this.bot.blockAt(new Vec3(x, y, z));
        // if (!block) throw cantGetBlockError("isCobweb", x, y, z);
        return !!(block && block.type === this.cobwebID); // will auto assume false if not is not found from import.
    }

    isLilypad(block: Block): boolean {
        // const block = this.bot.blockAt(new Vec3(x, y, z));
        // if (!block) throw cantGetBlockError("isLilypad", x, y, z);
        return !!(block && block.type === this.lilypadID); // will auto assume false if not is not found from import.
    }

    isLava(block: Block): boolean {
        // const block = this.bot.blockAt(new Vec3(x, y, z));
        // if (!block) throw cantGetBlockError("isLava", x, y, z);
        return !!(block && this.lavaBlockIDs.has(block.type)); // will auto assume false if not is not found from import.
    }

    slabSwimTarget(block: Block): number {
        // const block = this.bot.blockAt(new Vec3(x, y, z));
        // if (!block) throw cantGetBlockError("slabSwimTarget", x, y, z);
        if (block && block.shapes.length == 1 && block.shapes[0].length == 6 && block.shapes[0][4]) return block.shapes[0][4];
        return 0;
    }

    canDigBlock(x: number, y: number, z: number) {
        const myBlock = this.bot.blockAt(new Vec3(x, y, z));
        if (!myBlock) throw cantGetBlockError("canDigBlock", x, y, z)
        return this.bot.canDigBlock(myBlock);
    }
    
}
