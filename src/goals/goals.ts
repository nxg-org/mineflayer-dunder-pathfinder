import EventEmitter from "events";
import { Bot } from "mineflayer";
import { Entity } from "prismarine-entity";
import { Vec3 } from "vec3";
import { PredictiveFunction } from "./goalTypes";


export interface BaseGoalOptions {
    dynamic: boolean;
    predictive: boolean;
}

export abstract class BaseGoal extends EventEmitter implements BaseGoalOptions {
    constructor(public readonly bot: Bot, public readonly wantedDistance: number, public readonly dynamic: boolean, public readonly predictive: boolean) {
        super();
    }

    abstract get goalPos(): Vec3;
    abstract get goalPosRaw(): Vec3;
    
    goalReached(): boolean {
        return this.bot.entity.position.distanceTo(this.goalPos) <= this.wantedDistance
    }

    predictiveFunction?: PredictiveFunction;
}

export class StaticGoal extends BaseGoal {
 
    constructor(bot: Bot, public target: Vec3, wantedDistance: number = 1) {
        super(bot, wantedDistance, false, false);
    }

    get goalPos(): Vec3 {
        return this.target;
    }
    get goalPosRaw(): Vec3 {
       return this.target
    }

}

export class EntityGoalDynamic extends BaseGoal {

    private initialGoal: Vec3;
    constructor(bot: Bot, public target: Entity, wantedDistance: number = 1 ) {
        super(bot, wantedDistance, false, false);
        this.initialGoal = this.target.position
    }

    public get goalPos(): Vec3 {
        return  this.initialGoal
    }

    public get goalPosRaw(): Vec3 {
        return this.initialGoal
    }
}


export class EntityGoalPredictive extends BaseGoal {
 
    constructor(
        bot: Bot,
        public target: Entity,
        wantedDistance: number = 1,
        public predictiveFunction: PredictiveFunction = (delta, pos, vel) => {
            const base = Math.round(Math.sqrt(delta.x ** 2 + delta.y ** 2 + delta.z ** 2));
            const tickCount = Math.round((base * 8) / Math.sqrt(base));
            return pos.plus(vel.scaled(isNaN(tickCount) ? 0 : tickCount));
        }
    ) {
        super(bot, wantedDistance, true, true);
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
}


export class InverseGoal extends BaseGoal {

    constructor( protected goal: BaseGoal){
        super(goal.bot, goal.wantedDistance, goal.dynamic, goal.predictive)
    }
    
    public get goalPos(): Vec3 {
        return this.goal.goalPos
    }

    public get goalPosRaw(): Vec3 {
        return this.goal.goalPosRaw
    }

    goalReached(): boolean {
        return !this.goal.goalReached()
    }
}