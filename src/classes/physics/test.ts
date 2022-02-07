import { Bot, createBot } from "mineflayer";
import { goals, Move, Movements, pathfinder } from "mineflayer-pathfinder";
import utilPlugin from "@nxg-org/mineflayer-util-plugin";
import tracker from "@nxg-org/mineflayer-tracker";
import { PerStatePhysics } from "./freefallPhysics";
import md from "minecraft-data";
import { Physics } from "./physics";
import { Entity } from "prismarine-entity";
import { Vec3 } from "vec3";

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
    username: "physics-test",
    host: "localhost",
    version: "1.17.1",
});

bot.loadPlugin(pathfinder);
bot.loadPlugin(utilPlugin);
bot.loadPlugin(tracker);

let moves: Movements;
bot.once("spawn", () => {
    const data = md(bot.version);
    (bot.physics as any) = new PerStatePhysics(data, bot.world, {
        doBlockInfoUpdates: false,
        ignoreHoriztonalCollisions: false,
        ignoreVerticalCollisions: false,
        doCollisions: true,
        customCollisionsOnly: false
    });

    moves = new Movements(bot, data);
    moves.allowParkour = true;
    moves.maxDropDown = 10000;
    moves.allowFreeMotion = false;
    moves.placeCost = 0.1;
    moves.canDig = true;
    moves.scafoldingBlocks = [data.blocksByName.dirt.id, data.blocksByName.cobblestone.id];
    // moves.countScaffoldingItems = () => 100;
    bot.util.move.movements = moves;
    bot.pathfinder.setMovements(moves);
    // (bot.pathfinder as any).enablePathShortcut = true
});

bot.on("chat", async (username, message) => {
    const msg = message.split(" ");
    let target;
    let pos;
    switch (msg[0]) {

        case "test":
            target = bot.nearestEntity((e) => e.username === username)!;
            pos = target.position;
            bot.on("physicsTick", () => bot.setControlState("sneak", true))
            await bot.pathfinder.goto(new goals.GoalBlock(pos.x, pos.y, pos.z));
            break;
        case "testcome":
            target = bot.nearestEntity((e) => e.username === username)!;
            pos = target.position;
            await bot.pathfinder.goto(new goals.GoalBlock(pos.x, pos.y, pos.z));
            bot.chat("found path.");
            break;
        case "come":
            target = bot.nearestEntity((e) => e.username === username)!;
            pos = target.position;
            await bot.pathfinder.setGoal(new goals.GoalBlock(pos.x, pos.y, pos.z));
            break;
        case "follow":
            target = bot.nearestEntity((e) => e.username === username)!;
            bot.util.move.setOnlyGoal(new goals.GoalFollow(target, 1), true);
            break;
        case "predict":
            target = bot.nearestEntity((e) => e.username === username)!;
            bot.util.move.setOnlyGoal(new PredictiveGoal(bot, target, 1), true);
            break;
        case "goto":
            bot.util.move.setOnlyGoal(new goals.GoalBlock(parseInt(msg[1]), parseInt(msg[2]), parseInt(msg[3])));
            break;
        case "stop":
            bot.util.move.stop();
            break;
        case "equipshield":
            await bot.util.inv.equipItem("shield", "hand", { group: "inventory", priority: 0, returnIfRunning: false, errCancel: false });
            bot.activateItem();
            break;
    }
});
