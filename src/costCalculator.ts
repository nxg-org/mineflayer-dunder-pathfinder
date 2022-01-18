import { Bot } from "mineflayer";
import { Block } from "prismarine-block";
import { Vec3 } from "vec3";
import { BlockInfo } from "./blockInfoNew";
import { MovementEnum, SimulationControl, toolsForMaterials } from "./constants";
import { BlockInteraction, Movement } from "./classes";
import { cantGetBlockError, getTool, MAX_COST } from "./util";
import md from "minecraft-data";
const { PlayerState } = require("prismarine-physics");

export interface CostCalculatorOptions {
    digCostCalculation: (bot: Bot, totalTicks: number) => number;
    placementCostCalculation: (bot: Bot, totalBlocks: number, toPlaceAmount: number) => number;
    movementCostCalculation: (bot: Bot, totalTicks: number) => number;
}

export class CostCalculator {
    //Too lazy to implement myself here.
    private predictWorld: typeof this.bot.util.predict.world;

    constructor(
        private bot: Bot,
        private blockInfo: BlockInfo,
        private data: md.IndexedData,
        private customCalcs: CostCalculatorOptions = {
            digCostCalculation: (bot: Bot, totalTicks: number) => totalTicks,
            placementCostCalculation: (bot: Bot, totalCost: number) => totalCost,
            movementCostCalculation: (bot: Bot, totalTicks: number) => totalTicks,
        }
    ) {
        this.predictWorld = this.bot.util.predict.world;
    }

    /**
     * Get dig time (ms)
     * @param block
     * @param inWater
     * @param useTools
     * @returns
     */
    getDigTime(block: Block, inWater: boolean, useTools: boolean = true): number {
        // const block = this.bot.blockAt(new Vec3(x, y, z));
        // if (!block) throw cantGetBlockError("getDigTime", x, y, z);
        let item;
        if (useTools && block.material) item = getTool(this.bot, block.material);
        if (this.blockInfo.isWater(block) || this.blockInfo.isLava(block)) return 0;
        if (block.hardness >= 100 || block.hardness == null) return MAX_COST;
        return block.digTime(item?.type ?? null, this.bot.player.gamemode == 1, inWater, false, item?.enchants, {} as any);
    }

    /**
     * Get dig cost (ticks)
     * @param block
     * @param inWater
     * @param useTools
     * @returns
     */
    getDigCost(block: Block, inWater: boolean, useTools: boolean = true) {
        return this.customCalcs.digCostCalculation(this.bot, this.getDigTime(block, inWater, useTools));
    }

    getController(movementType: MovementEnum): SimulationControl {
        switch (movementType) {
            case MovementEnum.Cardinal:
            case MovementEnum.Diagonal:
            case MovementEnum.SwimCardinal:
            case MovementEnum.SwimDiagonal:
                return {
                    forward: true,
                    back: false,
                    right: false,
                    left: false,
                    sneak: false,
                    sprint: false,
                    jump: false,
                };
            case MovementEnum.JumpCardinal:
            case MovementEnum.JumpDiagonal:
                return {
                    forward: true,
                    back: false,
                    right: false,
                    left: false,
                    sneak: false,
                    sprint: false,
                    jump: true,
                };
            case MovementEnum.SprintCardinal:
            case MovementEnum.SprintDiagonal:
            case MovementEnum.SprintSwimCardinal:
            case MovementEnum.SprintSwimDiagonal:
                return {
                    forward: true,
                    back: false,
                    right: false,
                    left: false,
                    sneak: false,
                    sprint: true,
                    jump: false,
                };
            case MovementEnum.SprintJumpCardinal:
            case MovementEnum.SprintJumpDiagonal:
                return {
                    forward: true,
                    back: false,
                    right: false,
                    left: false,
                    sneak: false,
                    sprint: true,
                    jump: true,
                };
            case MovementEnum.Init:
                return {
                    forward: false,
                    back: false,
                    right: false,
                    left: false,
                    sneak: false,
                    sprint: false,
                    jump: false,
                };
        }
    }

    /**
     * Convert digTime (ms) to ticks.
     * @param dest
     * @param controls
     * @param ticks
     * @returns
     */
    getMovementCost(dest: Vec3, move: MovementEnum, setBlocks: BlockInteraction[] = [], ticks: number = 5): number {
        if (setBlocks[0]) this.predictPlace(setBlocks);
        const cost = this.getMovementTime(dest, this.getController(move), ticks);
        if (setBlocks[0]) this.removePredict(setBlocks);
        return cost === MAX_COST ? cost : this.customCalcs.movementCostCalculation(this.bot, Math.floor(cost / 50));
    }

    private predictPlace(blocks: BlockInteraction[]) {
        const converted = blocks.map((b) => {
            const block = new Block(this.data.blocksByName.stone.id, 0, 0);
            block.position = b.destination;
            return block;
        });
        const obj: { [blockPos: string]: Block } = {};
        for (const b of converted) obj[b.position.toString()] = b;
        this.predictWorld.setBlocks(obj);
    }

    private removePredict(blocks: BlockInteraction[]) {
        this.predictWorld.removeBlocks(
            blocks.map((b) => b.destination),
            false
        );
    }

    /**
     *  wait until y is leveled and we are near goal on XZ and we are on block/water.
     * @param dest
     * @param controls
     * @param ticks
     * @returns
     */
    getMovementTime(dest: Vec3, controls: SimulationControl, ticks: number = 5): number {
        const state = new PlayerState(this.bot, controls);
        for (let i = 0; i < ticks; i++) {
            (this.bot.physics as any).simulatePlayer(state, this.predictWorld);
            if (state.isInLava) return MAX_COST;
            if (this.reachedPosition(state, dest)) return ticks;
        }
        return MAX_COST;
    }

    /**
     * Helper function.
     * @param state
     * @param dest
     * @returns
     */
    private reachedPosition(state: typeof PlayerState, dest: Vec3) {
        const delta = dest.minus(state.pos);
        const r2 = 0.15 * 0.15;
        return delta.x * delta.x + delta.z * delta.z <= r2 && Math.abs(delta.y) < 0.001 && (state.onGround || state.isInWater);
    }

    getPlacementCost(currentBlocks: number, toPlace: BlockInteraction[]) {
        return currentBlocks / (currentBlocks - toPlace.length);
    }
}
