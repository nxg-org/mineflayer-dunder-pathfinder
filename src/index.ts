import { Bot } from "mineflayer";
import { BlockInfo } from "./classes/blocks/blockInfo";
import { Pathfinder } from "./tests/pathfinder";
import { PathfinderBuilder } from "./wrapper";
import tracker from "@nxg-org/mineflayer-tracker"
import { PlayerPoses } from "./classes/physics/playerState";
import { Entity } from "prismarine-entity";


declare module "prismarine-entity" {


    interface Entity {
        isInWater: boolean
        isInLava: boolean
    }
}


// Yet another desync from standard stuff. Temp fix.
declare module "mineflayer" {
    interface Bot {
        newPather: Pathfinder
        pose: PlayerPoses
    }

    interface BotEvents {
        entityPoseChange: (entity: Entity, pose: PlayerPoses) => void;
    }
}

export default function inject(bot: Bot) {
    if (!bot.tracker) bot.loadPlugin(tracker)
    const all = new PathfinderBuilder(bot)
    bot.newPather = all.pathfinder
}