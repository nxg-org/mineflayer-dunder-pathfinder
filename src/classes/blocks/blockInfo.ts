import { Bot } from "mineflayer";
import { Vec3 } from "vec3";
import md from "minecraft-data";
import { MovementEnum } from "../../utils/constants";
import { cantGetBlockError, parentBrokeInPast, parentBrokeInPastBlock } from "../../utils/util";
import { PathNode } from "../nodes/node";
import brokenImport, { loader, Block } from "prismarine-block"
import interactable from "./interactable.json"

const noNeedToBreakNames = new Set(["air", "cave_air", "void_air", "lava", "flowing_lava", "water", "flowing_water"]);

export enum BlockCheck {
    AIR,
    LIQUID,
    WATER,
    LAVA,
    COBWEB,
    LILYPAD,
    REPLACEABLE,
    DIGGABLE,
    SOLID,
    STANDABLE,
    WALKABLE,
    BREAKANDREPLACE
}

export class BlockInfo {
    // private data: md.IndexedData;

    public readonly autoReplaceIDs: Set<number> = new Set();
    public readonly airIDs: Set<number> = new Set();
    public readonly treatAsLiquidIDs: Set<number> = new Set();
    public readonly treatAsWaterIDs: Set<number> = new Set();
    public readonly lavaIDs: Set<number> = new Set();
    public readonly cantBreakIDs: Set<number> = new Set();
    public readonly avoidIDs: Set<number> = new Set();
    public readonly gravityBlockIDs: Set<number> = new Set();
    public readonly climbableIDs: Set<number> = new Set();
    public readonly replaceableIDs: Set<number> = new Set();
    public readonly fenceIDs: Set<number> = new Set();
    public readonly carpetIDs: Set<number> = new Set();
    public readonly openableIDs: Set<number> = new Set();
    public readonly slabIDs: Set<number> = new Set();

    public readonly blockData: typeof Block; // wtf are these imports lmfao

    public readonly cobwebIDs: Set<number> = new Set();
    public readonly lilypadID?: number;

    constructor(private bot: Bot, private data: md.IndexedData) {
    
        this.blockData = (brokenImport as any)(data)
        console.log(loader, brokenImport, this.blockData)
        // console.log(this.blockData)
   
        this.autoReplaceIDs = new Set();
        this.treatAsWaterIDs = new Set();
        this.lavaIDs = new Set();
        this.airIDs = new Set();
        this.cobwebIDs = new Set();
        if (this.data.blocksByName.cobweb) this.cobwebIDs.add(this.data.blocksByName.cobweb.id);
        if (this.data.blocksByName.web) this.cobwebIDs.add(this.data.blocksByName.web.id);
        this.lilypadID = this.data.blocksByName.lilypad?.id;

        for (const blockName in this.data.blocksByName) {
            if (noNeedToBreakNames.has(blockName)) this.autoReplaceIDs.add(this.data.blocksByName[blockName].id);
            if (blockName.includes("lava")) this.lavaIDs.add(this.data.blocksByName[blockName].id);
            if (blockName.includes("water")) this.treatAsWaterIDs.add(this.data.blocksByName[blockName].id);
            if (blockName.includes("air")) this.airIDs.add(this.data.blocksByName[blockName].id);
            if (blockName.includes("slab")) this.slabIDs.add(this.data.blocksByName[blockName].id);
        }



        // this.canDig = true
        // this.digCost = 1
        // this.placeCost = 1
        // this.liquidCost = 1
    
        // this.dontCreateFlow = true
        // this.allow1by1towers = true
        // this.allowFreeMotion = false
        // this.allowParkour = true
        // this.allowSprinting = true
        // this.dontMineUnderFallingBlock = true
    
        this.cantBreakIDs = new Set()
        this.cantBreakIDs.add(this.data.blocksByName.chest.id)
        this.cantBreakIDs.add(this.data.blocksByName.wheat.id)
    
        this.data.blocksArray.forEach(block => {
          if (block.diggable) return
          this.cantBreakIDs.add(block.id)
        })
    
        this.avoidIDs = new Set()
        this.avoidIDs.add(this.data.blocksByName.fire.id)
        this.avoidIDs.add(this.data.blocksByName.wheat.id)
        if (this.data.blocksByName.cobweb) this.avoidIDs.add(this.data.blocksByName.cobweb.id)
        if (this.data.blocksByName.web) this.avoidIDs.add(this.data.blocksByName.web.id)
        this.avoidIDs.add(this.data.blocksByName.lava.id)
    
        this.treatAsLiquidIDs = new Set()
        this.treatAsLiquidIDs.add(this.data.blocksByName.water.id)
        this.treatAsLiquidIDs.add(this.data.blocksByName.lava.id)
    
        this.gravityBlockIDs = new Set()
        this.gravityBlockIDs.add(this.data.blocksByName.sand.id)
        this.gravityBlockIDs.add(this.data.blocksByName.gravel.id)
    
        this.climbableIDs = new Set()
        this.climbableIDs.add(this.data.blocksByName.ladder.id)
        // this.climbableIDs.add(this.data.blocksByName.vine.id)
    
        this.replaceableIDs = new Set()
        this.replaceableIDs.add(this.data.blocksByName.air.id)
        if (this.data.blocksByName.cave_air) this.replaceableIDs.add(this.data.blocksByName.cave_air.id)
        if (this.data.blocksByName.void_air) this.replaceableIDs.add(this.data.blocksByName.void_air.id)
        this.replaceableIDs.add(this.data.blocksByName.water.id)
        this.replaceableIDs.add(this.data.blocksByName.lava.id)
    
        // this.scafoldingBlocks = []
        // this.scafoldingBlocks.push(this.data.blocksByName.dirt.id)
        // this.scafoldingBlocks.push(this.data.blocksByName.cobblestone.id)
    
        this.fenceIDs = new Set()
        this.carpetIDs = new Set()
        this.openableIDs = new Set()
        this.data.blocksArray.map(x => this.blockData.fromStateId(x.minStateId ?? 0, 0)).forEach(block => {
          if (block.shapes.length > 0) {
            // Fences or any block taller than 1, they will be considered as non-physical to avoid
            // trying to walk on them
            if (block.shapes[0][4] > 1) this.fenceIDs.add(block.type)
            // Carpets or any blocks smaller than 0.1, they will be considered as safe to walk in
            if (block.shapes[0][4] < 0.1) this.carpetIDs.add(block.type)
          }
        })
        this.data.blocksArray.forEach(block => {
          if (interactable.includes(block.name) && block.name.toLowerCase().includes('gate') && !block.name.toLowerCase().includes('iron')) {
            // console.info(block)
            this.openableIDs.add(block.id)
          }
        })
    
        // this.canOpenDoors = true
    
        // this.maxDropDown = 4
        // this.infiniteLiquidDropdownDistance = true
      }

    getBetterBlock(block: Block | null, mergeInfo?: boolean) {
        
    }


    //TODO: Perhaps convert to Object, Object.values().every() would also work.
    getBlockInfo(block: Block | null, ...wantedInfo: BlockCheck[]) {
        if (!block) {
            return false;
        }
        const checks = [];
        for (const wanted of wantedInfo) {
            switch (wanted) {
                case BlockCheck.AIR:
                    checks.push(this.airIDs.has(block.type) && block.shapes.length === 0);
                    break;
                case BlockCheck.WATER:
                    checks.push(this.treatAsWaterIDs.has(block.type));
                    break;
                case BlockCheck.LAVA:
                    checks.push(this.lavaIDs.has(block.type));
                    break;
                case BlockCheck.LIQUID:
                    checks.push(this.treatAsWaterIDs.has(block.type) || this.lavaIDs.has(block.type));
                    break;
                case BlockCheck.COBWEB:
                    checks.push(this.cobwebIDs.has(block.type));
                    break;
                case BlockCheck.LILYPAD:
                    checks.push(block.type === this.lilypadID);
                    break;
                case BlockCheck.REPLACEABLE:
                    checks.push(block.shapes.length === 0 || (!this.canStandOnBlock(block) && this.autoReplaceIDs.has(block.type)));
                    break;
                case BlockCheck.DIGGABLE:
                    checks.push(block.hardness && this.bot.canDigBlock(block));
                    break;
                case BlockCheck.SOLID:
                    checks.push(this.isBlockSolid(block));
                    break;
                case BlockCheck.WALKABLE:
                    checks.push(this.canWalkOnBlock(block));
                    break;
                case BlockCheck.STANDABLE:
                    checks.push(this.canStandOnBlock(block));
                    break;
                case BlockCheck.BREAKANDREPLACE:
                    checks.push(this.shouldBreakBeforePlaceBlock(block))
                    break;
            }
        }
        return checks.every((e) => e === true);
    }

    shouldBreakBeforePlaceBlock(block: Block): boolean {
        // const block = this.bot.blockAt(new Vec3(x, y, z));
        // if (!block) throw cantGetBlockError("shouldBreakBeforePlaceBlock", x, y, z);
        if (block.shapes.length === 0) return false;
        else if (!this.canStandOnBlock(block) && !this.autoReplaceIDs.has(block.type)) return true;
        return false;
    }

    isBlockDiggable(block: Block): boolean {
        // const block = this.bot.blockAt(new Vec3(x, y, z));
        // if (!block) throw cantGetBlockError("isBlockDiggable", x, y, z);
        return !!(block && block.hardness);
    }

    canStandOnBlock(block: Block, parentNode?: PathNode): boolean {
        // const block = this.bot.blockAt(new Vec3(x, y, z));
        // if (!block) throw cantGetBlockError("canStandOnBlock", x, y, z);
        if (
            block.shapes.length == 1 &&
            block.shapes[0][0] <= 0.126 &&
            block.shapes[0][2] <= 0.126 &&
            block.shapes[0][3] >= 1 - 0.126 &&
            block.shapes[0][4] >= 1 - 0.126 &&
            block.shapes[0][4] <= 1 + 0.126 &&
            block.shapes[0][5] >= 1 - 0.126
        ) {
            return this.isBlockSolid(block) || (!!parentNode && !parentBrokeInPastBlock(block.position, parentNode));
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
    canWalkOnBlock(block: Block, parentNode?: PathNode, extras: [waterAllowed: boolean, lavaAllowed: boolean] = [false, false]): boolean {
        if (this.isCobweb(block)) return false;
        if (!extras[0] && this.isWater(block)) return false;
        if (!extras[1] && this.isLava(block)) return false;
        return this.isBlockSolid(block) || (!!parentNode && !parentBrokeInPastBlock(block.position, parentNode));
    }

    isBlockSolid(block: Block, parentNode?: PathNode): boolean {
        if (block && block.shapes.length > 0 && this.isCobweb(block)) return false;
        return !this.isAir(block) || (!!parentNode && !parentBrokeInPastBlock(block.position, parentNode));
    }

    isWater(block: Block): boolean {
        return !!(block && this.treatAsWaterIDs.has(block.type));
    }

    isAir(block: Block): boolean {
        return !!(block && this.airIDs.has(block.type) && block.shapes.length === 0);
    }

    isCobweb(block: Block): boolean {
        return !!(block && this.cobwebIDs.has(block.type)); // will auto assume false if not is not found from import.
    }

    isLilypad(block: Block): boolean {
        return !!(block && block.type === this.lilypadID); // will auto assume false if not is not found from import.
    }

    isLava(block: Block): boolean {
        return !!(block && this.lavaIDs.has(block.type)); // will auto assume false if not is not found from import.
    }

    isLiquid(block: Block): boolean {
        return this.isWater(block) || this.isLava(block);
    }

    slabSwimTarget(block: Block): number {
        if (block && block.shapes.length == 1 && block.shapes[0].length == 6 && block.shapes[0][4]) return block.shapes[0][4];
        return 0;
    }

    canDigBlock(block: Block) {
        return this.bot.canDigBlock(block);
    }
}
