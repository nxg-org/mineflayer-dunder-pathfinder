import { Bot } from "mineflayer";
import { AABBUtils, AABB } from "@nxg-org/mineflayer-util-plugin";
const {getPlayerAABB} = AABBUtils;



export class PlayerUtils {



    constructor(private readonly bot: Bot) {}



    insideOpaqueBlock(): boolean {
        const flooredPos = this.bot.entity.position.floored();
        const playerAABB = getPlayerAABB(this.bot.entity)
        return AABB.fromBlock(flooredPos).collidesAABB(playerAABB) || AABB.fromBlock(flooredPos.offset(0, 1, 0)).collidesAABB(playerAABB);
    }
}