import { Bot } from "mineflayer";
import { Vec3 } from "vec3";
import { BlockInfo } from "./blockInfoNew";
import { Direction, JumpMovements, MovementEnum, SlowerMovements, SprintMovements, SwimmingMovements, XYZ } from "./constants";
import { Node } from "./classes/node";
import { BlockInteraction, IBlockType, Movement } from "./classes";
import { cantGetBlockError, MAX_COST } from "./util";
import { CostCalculator } from "./costCalculator";
import { Block } from "prismarine-block";

export interface MovementCostOptions {
    placeCost: number;
    breakCost: number;
    movementCost: number;
}

export class MovementInfo {
    constructor(
        private bot: Bot,
        private blockInfo: BlockInfo,
        private costInfo: CostCalculator
        //public options: MovementCostOptions = { placeCost: 1, breakCost: 1, movementCost: 1 } //TODO: Calculate movement cost based on ticks required to move. Same with digging.
    ) {} 

    // isSwim(movement: MovementEnum) {
    //     return SwimmingMovements.has(movement)
    // }

    // isSprint(movement: MovementEnum) {
    //     return SprintMovements.has(movement)
    // }

    // isJump(movement: MovementEnum) {
    //     return JumpMovements.has(movement)
    // }

    // isSprintSwim(movement: MovementEnum) {
    //     return SwimmingMovements.has(movement) && SprintMovements.has(movement)
    // }

    // isSprintJump(movement: MovementEnum) {
    //     return JumpMovements.has(movement) && SprintMovements.has(movement)
    // }
    // isWalk(movement: MovementEnum) {
    //     return SlowerMovements.has(movement)
    // }


    maybeBreakCost(node: Node, block: Block, move: MovementEnum): number {
        if (this.blockInfo.shouldBreakBeforePlaceBlock(block)) {
            if (!this.blockInfo.canDigBlock(block)) return MAX_COST
            return this.costInfo.getDigCost(block, node.inLiquid)
        } else return this.costInfo.getMovementCost(block.position, move)
    }

    getBlock(node: Node, x: number, y: number, z: number) {
        return this.bot.blockAt(new Vec3(node.x + x, node.y + y, node.z + z));
    }

    //Similar logic to
    getMove(wanted: MovementEnum, node: Node, dir: Direction, movementsStore: Movement[]) {
        let cost = 0;
        const toBreak: BlockInteraction[] = [];
        const toPlace: BlockInteraction[] = [];
        switch (wanted) {
            case MovementEnum.Cardinal:
            case MovementEnum.SprintCardinal:
                const cardA = this.getBlock(node, dir.x, 1, dir.z); //+1 up
                const cardB = this.getBlock(node, dir.x, 0, dir.z); //wanted
                const cardC = this.getBlock(node, dir.x, -1, dir.z); //-1 down
                if (!cardA || !cardB || !cardC) throw "Can't get move." //TODO
                const cardBLiquid = this.blockInfo.isLiquid(cardB)
                if (!this.blockInfo.canWalkOnBlock(cardC) && !cardBLiquid) {
                    if (node.availableBlocks === 0) return;

                    if (this.blockInfo.shouldBreakBeforePlaceBlock(cardC)) {
                        if (!this.blockInfo.isBlockDiggable(cardC)) return //TODO: add safety check. Definitely not stealing from mineflayer rn.
                        toBreak.push(new BlockInteraction(IBlockType.BREAK, cardC.position)) //TODO: add face placement? Also not stolen?
                    }
                    toPlace.push(new BlockInteraction(IBlockType.PLACE, cardB.position, cardC.position))
                    cost += this.costInfo.getPlacementCost(node.availableBlocks, toPlace)

                }

                cost += this.maybeBreakCost(node, cardA, wanted)
                if (cost === MAX_COST) return;
                movementsStore.push(new Movement(node, wanted, cardB.position.x, cardB.position.y, cardB.position.z, cardBLiquid, cost, toBreak, toPlace, true))


        }
    }
}
