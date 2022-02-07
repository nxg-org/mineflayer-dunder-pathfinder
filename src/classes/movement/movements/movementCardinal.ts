import { BetterBlockPos } from "../../blocks/betterBlockPos";
import { PathNode } from "../../nodes/node";
import { CostInfo } from "../../player/costCalculator";
import { PathContext } from "../../path/PathContext";
import { Direction, MAX_COST, MovementEnum } from "../../utils/constants";
import { BaseMovement, Movement } from "../movement";
import { MovementInfo } from "../movementsInfo";
import { MovementData } from "../movementData";
import { Block } from "prismarine-block";
import { BlockCheck } from "../../blocks/blockInfo";
import { Vec3 } from "vec3";
import { BlockInteraction, IBlockType } from "../../blocks/blockInteraction";
import { MathUtils } from "@nxg-org/mineflayer-util-plugin";

type BBP = BetterBlockPos;
export class MovementCardinal extends BaseMovement {
    public static fromNodeAndDir(ctx: PathContext, node: PathNode, dir: Direction) {
        const src = node.toBBP(ctx.world);
        const dest = new BetterBlockPos(ctx.world, node.x + dir.x, node.y, node.z + dir.z);
        return new MovementCardinal(ctx, node, dest, [dest, dest.up()], [src.down()]);
    }

    public static fromNodeAndCoords(ctx: PathContext, node: PathNode, x: number, z: number) {
        const src = node.toBBP(ctx.world);
        const dest = new BetterBlockPos(ctx.world, node.x + x, node.y, node.z + z);
        return new MovementCardinal(ctx, node, dest, [dest, dest.up()], [src.down()]);
    }
    public static fromNodeToNode(ctx: PathContext, node: PathNode, endNode: PathNode) {
        const src = node.toBBP(ctx.world);
        const dest = endNode.toBBP(ctx.world);
        return new MovementCardinal(ctx, node, dest, [dest, dest.up()], [src.down()]);
    }

    calculateInfo(): MovementData {
        const bl0 = this.toBreak[0].dest.getBlock();
        const bl1 = this.toBreak[1].dest.getBlock();
        const bl2 = this.toPlace[0].dest.getBlock();
        if (!bl0 || !bl1 || !bl2) throw "Can't get move."; //TODO
        const data = MovementData.DEFAULT(this.ctx.currentTick);
        let i = 0;
        data.setTargetDest(this.ctx.currentTick, this.ctx.state.position, this.dest as unknown as Vec3, true)
        while (!this.ctx.bbpAtFeet().equals(this.dest)) {
         
          
            data.setInputs
            // data.targetsByTicks[this.ctx.currentTick + i].yaw = Math.atan2(-(this.dest.x - this.ctx.state.position.x), -(this.dest.z - this.ctx.state.position.z));
            const cardBLiquid = this.ctx.blockInfo.isLiquid(bl0);
            if (!this.ctx.blockInfo.canWalkOnBlock(bl1) && !cardBLiquid) {
                if (this.ctx.moveInfo.scaffoldBlockCount === 0) return;

                if (this.ctx.blockInfo.shouldBreakBeforePlaceBlock(bl1)) {
                    if (!this.ctx.blockInfo.isBlockDiggable(bl1)) return; //TODO: add safety check. Definitely not stealing from mineflayer rn.
                    this.toBreak.push(new BlockInteraction(IBlockType.BREAK, bl1.position as BetterBlockPos)); //TODO: add face placement? Also not stolen?
                }
                this.toPlace.push(new BlockInteraction(IBlockType.PLACE, bl0.position, bl2.position));
                this.cost += this.ctx.costInfo.getPlacementCost(this.ctx.moveInfo.scaffoldBlockCount, this.toPlace);
            }

            this.cost += this.maybeBreakCost(this.src, bl1, MovementEnum.Cardinal);
            if (this.cost === MAX_COST) return;
            
        }
    }
    calculateValidPositions(): Set<BetterBlockPos> {
        throw new Error("Method not implemented.");
    }
}
