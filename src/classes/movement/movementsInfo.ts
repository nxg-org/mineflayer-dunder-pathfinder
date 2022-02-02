import { Bot } from "mineflayer";
import { Vec3 } from "vec3";
import { BlockInfo } from "../blocks/blockInfo";
import {
    allDirections,
    Direction,
    JumpMovements,
    MovementConst,
    MovementEnum,
    SlowerMovements,
    SprintMovements,
    SwimmingMovements,
    XYZ,
    MAX_COST,
    scaffoldBlocks,
    scaffoldBlocksAsSet,
} from "../utils/constants";
import { PathNode } from "../nodes/node";
import { BlockInteraction, IBlockType, Movement } from "..";
import { cantGetBlockError } from "../utils/util";
import { CostInfo } from "../player/costCalculator";
import { Block } from "prismarine-block";
import { Item } from "prismarine-item";

export interface MovementCostOptions {
    placeCost: number;
    breakCost: number;
    movementCost: number;
}

export class MovementInfo {
    private scaffoldBlockCache: number;
    public updateRequested: boolean = true;

    constructor(private bot: Bot, private blockInfo: BlockInfo, private costInfo: CostInfo) {
        this.scaffoldBlockCache = 0;
        this.bot.on("playerCollect", async () => {
            await this.bot.waitForTicks(1);
            this.updateRequested = true;
        })
    }

    public get scaffoldBlockCount(): number {
        if (this.updateRequested) {
            this.scaffoldBlockCache = this.getScaffoldBlockTally();
            this.updateRequested = false;
        }
        return this.scaffoldBlockCache;
    }

    maybeBreakCost(node: PathNode, block: Block, move: MovementEnum): number {
        if (this.blockInfo.shouldBreakBeforePlaceBlock(block)) {
            if (!this.blockInfo.canDigBlock(block)) return MAX_COST;
            return this.costInfo.getDigCost(block, node.inLiquid);
        } else return this.costInfo.getMovementCost(block.position, move);
    }

    getBlock(node: PathNode, x: number, y: number, z: number): Block | null {
        return this.bot.blockAt(new Vec3(node.x + x, node.y + y, node.z + z));
    }

    getScaffoldBlockTally(): number {
        return this.bot.util.inv
            .getAllItems()
            .filter((item) => scaffoldBlocksAsSet.has(item.name))
            .map((item) => item.stackSize)
            .reduce((a, b) => a + b);
    }

    areXScaffoldBlocksAvailable(num: number): boolean {
        return this.scaffoldBlockCount >= num;
    }

    getWaterBucket(): Item | undefined {
        return this.bot.util.inv.getAllItems().find((item) => item.name === "water_bucket");
    }

    hasWaterBucket(): boolean {
        return !!this.getWaterBucket();
    }

    //Similar logic to mineflayer-pathfinder
    getMove(wanted: MovementEnum, node: PathNode, dir: Direction, movementsStore: Movement[]) {
        let cost = 0;
        const toBreak: BlockInteraction[] = [];
        const toPlace: BlockInteraction[] = [];
        switch (wanted) {
            case MovementEnum.Cardinal:
            case MovementEnum.SprintCardinal:
                const cardA = this.getBlock(node, dir.x, 1, dir.z); //+1 up
                const cardB = this.getBlock(node, dir.x, 0, dir.z); //wanted
                const cardC = this.getBlock(node, dir.x, -1, dir.z); //-1 down
                if (!cardA || !cardB || !cardC) throw "Can't get move."; //TODO
                const cardBLiquid = this.blockInfo.isLiquid(cardB);
                if (!this.blockInfo.canWalkOnBlock(cardC) && !cardBLiquid) {
                    if (this.scaffoldBlockCount === 0) return;

                    if (this.blockInfo.shouldBreakBeforePlaceBlock(cardC)) {
                        if (!this.blockInfo.isBlockDiggable(cardC)) return; //TODO: add safety check. Definitely not stealing from mineflayer rn.
                        toBreak.push(new BlockInteraction(IBlockType.BREAK, cardC.position)); //TODO: add face placement? Also not stolen?
                    }
                    toPlace.push(new BlockInteraction(IBlockType.PLACE, cardB.position, cardC.position));
                    cost += this.costInfo.getPlacementCost(this.scaffoldBlockCount, toPlace);
                }

                cost += this.maybeBreakCost(node, cardA, wanted);
                if (cost === MAX_COST) return;
                movementsStore.push(
                    new Movement(
                        node,
                        wanted,
                        cardB.position.x,
                        cardB.position.y,
                        cardB.position.z,
                        cardBLiquid,
                        cost,
                        toBreak,
                        toPlace,
                        true
                    )
                );
        }
    }

    getAllMoves(node: PathNode): Movement[] {
        const moves: Movement[] = [];
        for (const d in allDirections) {
            const dir = allDirections[d];
            for (const m in MovementConst) {
                const move = MovementConst[m];
                this.getMove(move, node, dir, moves);
            }
        }
        return moves;
    }
}
