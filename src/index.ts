import { Bot } from "mineflayer";
import { BlockInfo } from "./classes/blocks/blockInfo";
import { Pathfinder } from "./pathfinder";
import { PathfinderBuilder } from "./wrapper";
import tracker from "@nxg-org/mineflayer-tracker"


declare module "prismarine-entity" {


    interface Entity {
        isInWater: boolean
        isInLava: boolean
    }
}



declare module "mineflayer" {
    interface Bot {
        newPather: Pathfinder
    }
}

export default function inject(bot: Bot) {
    if (!bot.tracker) bot.loadPlugin(tracker)
    const all = new PathfinderBuilder(bot)
    bot.newPather = all.pathfinder
}