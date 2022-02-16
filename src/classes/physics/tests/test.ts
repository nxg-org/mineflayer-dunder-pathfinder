import { Bot, createBot } from "mineflayer";
import { goals, Move, Movements, pathfinder } from "mineflayer-pathfinder";
import utilPlugin, { AABB, MathUtils } from "@nxg-org/mineflayer-util-plugin";
import tracker from "@nxg-org/mineflayer-tracker";
import { PerStatePhysics } from "../engines/PerStatePhysics";
import md from "minecraft-data";
import { Entity } from "prismarine-entity";
import { Vec3 } from "vec3";
import { PathContext } from "../../path/tests/firstPath";
import commonSense  from "@nxg-org/mineflayer-common-sense";




class PredictiveGoal extends goals.GoalFollow {
    public readonly bot: Bot;
    constructor(bot: Bot, entity: Entity, range: number) {
        super(entity, range);
        this.bot = bot;
        this.bot.tracker.trackEntity(entity);
    }

    heuristic(node: { x: number; y: number; z: number }) {
        const dx = this.x - node.x;
        const dy = this.y - node.y;
        const dz = this.z - node.z;
        return this.distanceXZ(dx, dz) + Math.abs(dy);
    }

    isEnd(node: { x: number; y: number; z: number }) {
        const dx = this.x - node.x;
        const dy = this.y - node.y;
        const dz = this.z - node.z;
        return dx * dx + dy * dy + dz * dz <= this.rangeSq;
    }

    hasChanged() {
        const pos = this.entity.position.floored();
        const p = this.predictiveFunction(
            this.entity.position.minus(this.bot.entity.position),
            this.entity.position,
            this.bot.tracker.getEntitySpeed(this.entity)
        );
        const dx = this.x - p.x;
        const dy = this.y - p.y;
        const dz = this.z - p.z;
        if (dx * dx + dy * dy + dz * dz > this.rangeSq) {
            this.x = p.x;
            this.y = p.y;
            this.z = p.z;
            return true;
        }
        return false;
    }

    public predictiveFunction(delta: Vec3, pos: Vec3, vel: Vec3) {
        const base = Math.round(Math.sqrt(delta.x ** 2 + delta.y ** 2 + delta.z ** 2));
        const tickCount = Math.round((base * 8) / Math.sqrt(base));
        return pos.plus(vel.scaled(isNaN(tickCount) ? 0 : tickCount));
    }

    distanceXZ(dx: number, dz: number) {
        dx = Math.abs(dx);
        dz = Math.abs(dz);
        return Math.abs(dx - dz) + Math.min(dx, dz) * Math.SQRT2;
    }
}

const bot = createBot({
    username: "physics_test",
    host: "localhost",
    version: "1.17.1",
});
console.log("shit")

bot.loadPlugin(pathfinder);
bot.loadPlugin(utilPlugin);
bot.loadPlugin(tracker);
bot.loadPlugin(commonSense)

// bot.commonSense.autoRespond = true

let physics: PerStatePhysics;
let data: md.IndexedData;
let settings = {
    pathing: false,
};
bot.once("spawn", () => {
    data = md(bot.version);
    physics = new PerStatePhysics(data, bot.world, {
        doBlockInfoUpdates: true,
        ignoreHoriztonalCollisions: false,
        ignoreVerticalCollisions: false,
        doCollisions: true,
        customCollisionsOnly: false,
    });
    bot.physics.yawSpeed = 20
    // (bot.physics as any) = physics
    // (bot.pathfinder as any).enablePathShortcut = true

    // bot.physics.yawSpeed = 20;
});

let pathContext: PathContext;
let target;
let pos;
bot.on("chat", async (username, message) => {
    if (username === bot.entity.username) return;
    const msg = message.split(" ");

    switch (msg[0]) {
        case "simpath":
            target = bot.nearestEntity((e) => e.username === username);
            if (!target) {
                bot.chat("cant see target " + username);
                settings.pathing = false;
                return;
            }
            pathContext = new PathContext(bot, physics, 0)
            const goal = target.position.clone()
            const moves = await pathContext.findPath(goal);
            await pathContext.doPath(goal, ...moves)
          
            // await testSimAlongPath(sim, target.position.clone())
            break;
        case "test":
            target = bot.nearestEntity((e) => e.username === username);
            if (!target) {
                bot.chat("cant see target " + username);
                settings.pathing = false;
                return;
            }
            pathContext = new PathContext(bot, physics, 0)
            await pathContext.noCalcPath(target.position.clone());
            break;
        case "reset":
            if (pathContext) pathContext.reset()
            else bot.chat("shit")
            break;
    }
});
