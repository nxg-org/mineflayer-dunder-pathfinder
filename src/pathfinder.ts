import { Bot } from "mineflayer";
import { Vec3 } from "vec3";
import { BlockInfo } from "./blockInfo";
import { BotActions } from "./botActions";

export class Pathfinder {


    private lastPos: {move: number, x: number, y: number, z: number}
    constructor(private bot: Bot, private botActions: BotActions, private blockInfo: BlockInfo) {
        this.lastPos = { move: 0, ...this.bot.entity.position.floored() };
    }

}