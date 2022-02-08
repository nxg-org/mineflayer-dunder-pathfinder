import EventEmitter from "events";
import { Bot } from "mineflayer";
import { Entity } from "prismarine-entity";
import { Vec3 } from "vec3";
import { PredictiveFunction } from "./goalTypes";
import {  PathNode } from "../nodes/node";
import { distanceXZ } from "../utils/util";


export interface BaseGoalOptions {
    dynamic: boolean;
    predictive: boolean;
}

export abstract class BaseGoal extends EventEmitter implements BaseGoalOptions {
    constructor(public readonly bot: Bot, public readonly dynamic: boolean, public readonly predictive: boolean) {
        super();
    }

    abstract get goalPos(): Vec3;
    abstract get goalPosRaw(): Vec3;

    abstract cost(node: PathNode): number;
    abstract goalReached(node: {x: number, y: number, z: number}): boolean;
    

    predictiveFunction?: PredictiveFunction;
}

export class StaticGoal extends BaseGoal {
 
    constructor(bot: Bot, public target: Vec3) {
        super(bot, false, false);
    }

    get goalPos(): Vec3 {
        return this.target;
    }
    get goalPosRaw(): Vec3 {
       return this.target
    }

    cost(node: PathNode) {
        const {x, y, z} = this.goalPos
        const dx = x - node.x
        const dy = y - node.y
        const dz = z - node.z
        return distanceXZ(dx, dz) + Math.abs(dy)
    }

    goalReached(node: PathNode) {
        const {x, y, z} = this.goalPos
        return node.x === x && node.y === y && node.z === z
    }

}

export class EntityGoalDynamic extends BaseGoal {

    constructor(bot: Bot, public target: Entity, readonly wantedDistance: number = 1) {
        super(bot,  false, false);
    }

    public get goalPos(): Vec3 {
        return this.target.position
    }

    public get goalPosRaw(): Vec3 {
        return this.target.position
    }

    cost(node: PathNode) {
        const {x, y, z} = this.goalPos
        const dx = x - node.x
        const dy = y - node.y
        const dz = z - node.z
        return distanceXZ(dx, dz) + Math.abs(dy)
    }

    goalReached(node: PathNode) {
        const {x, y, z} = this.goalPos
        const dx =  x - node.x
        const dy = y - node.y
        const dz = z - node.z
        return (dx * dx + dy * dy + dz * dz) <= this.wantedDistance
    }
}


export class EntityGoalPredictive extends BaseGoal {
 
    constructor(
        bot: Bot,
        public target: Entity,
        readonly wantedDistance: number = 1,
        public predictiveFunction: PredictiveFunction = (delta, pos, vel) => {
            const base = Math.round(Math.sqrt(delta.x ** 2 + delta.y ** 2 + delta.z ** 2));
            const tickCount = Math.round((base * 8) / Math.sqrt(base));
            return pos.plus(vel.scaled(isNaN(tickCount) ? 0 : tickCount));
        }
    ) {
        super(bot, true, true);
        this.bot.tracker.trackEntity(target);
    }

    public get goalPos(): Vec3 {
        return this.predictiveFunction(
            this.target.position.minus(this.bot.entity.position),
            this.target.position,
            this.bot.tracker.getEntitySpeed(this.target)
        );
    }

    public get goalPosRaw(): Vec3 {
        return this.target.position;
    }

    cost(node: PathNode) {
        const {x, y, z} = this.goalPos
        const dx = x - node.x
        const dy = y - node.y
        const dz = z - node.z
        return distanceXZ(dx, dz) + Math.abs(dy)
    }

    goalReached(node: PathNode) {
        const {x, y, z} = this.goalPos
        const dx =  x - node.x
        const dy = y - node.y
        const dz = z - node.z
        return (dx * dx + dy * dy + dz * dz) <= this.wantedDistance
    }
}


export class InverseGoal extends BaseGoal {

    constructor( protected goal: BaseGoal){
        super(goal.bot, goal.dynamic, goal.predictive)
    }
    
    public get goalPos(): Vec3 {
        return this.goal.goalPos
    }

    public get goalPosRaw(): Vec3 {
        return this.goal.goalPosRaw
    }


    cost(node: PathNode) {
        return -this.goal.cost(node);
    }
    
    goalReached(node: PathNode): boolean {
        return !this.goal.goalReached(node)
    }


}