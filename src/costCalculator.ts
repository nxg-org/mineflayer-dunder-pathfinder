import { Bot } from "mineflayer";
import { Vec3 } from "vec3";
import { BlockInfo } from "./blockInfo";
import { toolsForMaterials } from "./constants";
import { Movement } from "./movement";
import { cantGetBlockError, getTool } from "./util";
const { PlayerState } = require("prismarine-physics");


interface SimulationControl {
    forward: boolean,
    back: boolean,
    left: boolean,
    right: boolean,
    jump: boolean,
    sneak: boolean,
}
export class CostCalculator {

    constructor(private bot: Bot, private blockInfo: BlockInfo) {

    }

    getDigTime(x: number, y: number, z: number, inWater: boolean, useTools: boolean = true): number {
        const block = this.bot.blockAt(new Vec3(x, y, z));
        if (!block) throw cantGetBlockError("getDigTime", x, y, z);
        let item;
        if (useTools && block.material) item = getTool(this.bot, block.material);
        if (this.blockInfo.isWater(x, y, z) || this.blockInfo.isLava(x, y, z)) return 0;
        if (block.hardness >= 100 || block.hardness == null) return 9999999;
        return block.digTime(item?.type ?? null, this.bot.player.gamemode == 1, inWater, false, item?.enchants, {} as any);
    }


    getMovementCost(org: Vec3, dest: Vec3, controls: SimulationControl, maxTicks: number) {
        const state = new PlayerState(this.bot, controls)
        for (let i = 0; i < maxTicks; i++) {
            (this.bot.physics as any).simulatePlayer(state, this.bot.world)
            if (state.isInLava) return state
            if (goal(state)) return state
          }


    }
    simulateUntil (goal: Function, controller: Function, controls: SimulationControl, ticks = 1) {
      }
    
}
