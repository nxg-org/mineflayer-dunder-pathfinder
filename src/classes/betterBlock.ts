import { Block } from "prismarine-block";
import { BlockInfo } from "../blockInfoNew";


//TODO: create static reference to everything.
export class BetterBlock {


    liquid: boolean
    treatAsNoBB: boolean
    replaceable: boolean
    

    constructor(public block: Block, blockInfo: BlockInfo) {
        this.liquid = blockInfo.isLiquid(block)
        this.treatAsNoBB = blockInfo.isBlockSolid(block)
        this.replaceable = !blockInfo.shouldBreakBeforePlaceBlock(block)


    }

}