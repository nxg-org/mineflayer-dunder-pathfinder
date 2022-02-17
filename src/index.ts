import { Bot } from "mineflayer";
import { BlockInfo } from "./classes/blocks/blockInfo";
import { Pathfinder } from "./tests/pathfinder";
import { PathfinderBuilder } from "./wrapper";
import tracker from "@nxg-org/mineflayer-tracker"
import { PlayerPoses } from "./classes/physics/states/playerState";
import { Entity } from "prismarine-entity";
import { Vec3 } from "vec3";
import { Block } from "prismarine-block";

/** Makes each property optional and turns each leaf property into any, allowing for type overrides by narrowing any. */
type DeepPartialAny<T> = {
    [P in keyof T]?: T[P] extends AnyObject ? DeepPartialAny<T[P]> : any
  }
  
  type AnyObject = Record<string, any>
type ModifyDeep<A extends AnyObject, B extends DeepPartialAny<A>> = {
    [K in keyof A]: B[K] extends never
      ? A[K]
      : B[K] extends AnyObject
        ? ModifyDeep<A[K], B[K]>
        : B[K]
  } & (A extends AnyObject ? Omit<B, keyof A> : A)

  interface BotOverrides {
    newPather: Pathfinder
    pose: PlayerPoses,
    blockAt(point: Vec3, useExtraInfo: boolean): Block | null
  }
  
  type ModifiedType<Bot> = ModifyDeep<Bot, BotOverrides>
  interface ModifiedInterface extends ModifyDeep<Bot, BotOverrides> {}

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
        pose: PlayerPoses,
        // blockAt(point: Vec3, useExtraInfo: boolean): Block | null
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