import { Entity } from "prismarine-entity";
import { PredictiveFunction } from "./goalTypes";
import * as goals from "./goals";
import type { Bot } from "mineflayer";
import type { Vec3 } from "vec3";

export namespace GoalFactory {


    export function followEntity(bot: Bot, target: Entity, wantedDistance: number = 1, predictive: boolean = false, predictiveFunction?: PredictiveFunction) {
        if (predictive) return new goals.EntityGoalPredictive(bot, target, wantedDistance, predictiveFunction);
        else return new goals.EntityGoalDynamic(bot, target, wantedDistance);
    }

    export function gotoEntity(bot: Bot, target: Entity, wantedDistance: number = 1) {
        return new goals.StaticGoal(bot, target.position, wantedDistance);
    }

    export function gotoPos(bot: Bot, target: Vec3) {
        return new goals.StaticGoal(bot, target);
    }

    export function inverseGoal(goal: goals.BaseGoal) {
        return new goals.InverseGoal(goal)
    }
}



/**
 * usage:
 * 
 * const nonPredictive = GoalFactory.followEntity(bot, entity, false)
 * 
 * const predictive = GoalFactory.followEntity(bot, entity, true)
 * 
 * const staticEntity = GoalFactory.gotoEntity(bot, entity)
 * 
 * const staticPos = GoalFactory.gotoPos(bot, target)
 * 
 */