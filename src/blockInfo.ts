import { Bot } from "mineflayer";
import { Vec3 } from "vec3";
import md from "minecraft-data";
import { MovementEnum } from "./constants";
import { cantGetBlockError, parentBrokeInPast } from "./util";
import { Node } from "./classes/node";

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
            return !parentNode || !parentBrokeInPast(x, y, z, parentNode);
        }
        return false;
    }

    canWalkOnBlock(
        x: number,
        y: number,
        z: number,
        parentNode?: Node,
        extras: [waterAllowed: boolean, lavaAllowed: boolean] = [false, false]
    ): boolean {
        const block = this.bot.blockAt(new Vec3(x, y, z));
        if (!block) throw cantGetBlockError("canWalkOnBlock", x, y, z);
        if (block.type === this.cobwebID) return false;
        if (!extras[0] && this.isWater(x, y, z)) return false;
        if (!extras[1] && this.isLava(x, y, z)) return false;
        return !parentNode || !parentBrokeInPast(x, y, z, parentNode);
    }


    isBlockSolid(x: number, y: number, z: number, parentNode?: Node): boolean {
        const block = this.bot.blockAt(new Vec3(x, y, z));
        if (!block) throw cantGetBlockError("isBlockSolid", x, y, z);
        if (block && block.shapes.length > 0 && block.type != this.cobwebID) return false;
        return !parentNode || !parentBrokeInPast(x, y, z, parentNode);
    }

    isWater(x: number, y: number, z: number): boolean {
        const block = this.bot.blockAt(new Vec3(x, y, z));
        if (!block) throw cantGetBlockError("isWater", x, y, z);
        return !!(block && this.treatAsWaterIDs.has(block.type));
    }

    isAir(x: number, y: number, z: number): boolean {
        const block = this.bot.blockAt(new Vec3(x, y, z));
        if (!block) throw cantGetBlockError("isAir", x, y, z);
        return !!(block && this.airBlockIDs.has(block.type) && block.shapes.length === 0);
    }

    isCobweb(x: number, y: number, z: number): boolean {
        const block = this.bot.blockAt(new Vec3(x, y, z));
        if (!block) throw cantGetBlockError("isCobweb", x, y, z);
        return !!(block && block.type === this.cobwebID); // will auto assume false if not is not found from import.
    }

    isLilypad(x: number, y: number, z: number): boolean {
        const block = this.bot.blockAt(new Vec3(x, y, z));
        if (!block) throw cantGetBlockError("isLilypad", x, y, z);
        return !!(block && block.type === this.lilypadID); // will auto assume false if not is not found from import.
    }

    isLava(x: number, y: number, z: number): boolean {
        const block = this.bot.blockAt(new Vec3(x, y, z));
        if (!block) throw cantGetBlockError("isLava", x, y, z);
        return !!(block && this.lavaBlockIDs.has(block.type)); // will auto assume false if not is not found from import.
    }

    slabSwimTarget(x: number, y: number, z: number): number {
        const block = this.bot.blockAt(new Vec3(x, y, z));
        if (!block) throw cantGetBlockError("slabSwimTarget", x, y, z);
        if (block && block.shapes.length == 1 && block.shapes[0].length == 6 && block.shapes[0][4]) return block.shapes[0][4];
        return 0;
    }

    canDigBlock(x: number, y: number, z: number) {
        const myBlock = this.bot.blockAt(new Vec3(x, y, z));
        if (!myBlock) throw cantGetBlockError("canDigBlock", x, y, z)
        return this.bot.canDigBlock(myBlock);
    }
    
}
