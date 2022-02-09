import { Bot, createBot } from "mineflayer";
import { goals, Move, Movements, pathfinder } from "mineflayer-pathfinder";
import utilPlugin, { AABB, MathUtils } from "@nxg-org/mineflayer-util-plugin";
import tracker from "@nxg-org/mineflayer-tracker";
import { PerStatePhysics } from "./PerStatePhysics";
import md from "minecraft-data";
import { Physics } from "./physics";
import { Entity } from "prismarine-entity";
import { Vec3 } from "vec3";
import { Simulations } from "./simulations";
import { Block } from "prismarine-block";
import { PlayerState } from "./playerState";
import { PlayerControls } from "../player/playerControls";
import { getShortestLineBetweenTwoBlocks } from "./physicsUtils";

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

console.log("shit");
const bot = createBot({
    username: "physics-test",
    host: "localhost",
    version: "1.17.1",
});

bot.loadPlugin(pathfinder);
bot.loadPlugin(utilPlugin);
bot.loadPlugin(tracker);

let moves: Movements;
let simulator: Simulations;
let physics: PerStatePhysics;
bot.once("spawn", () => {
    const data = md(bot.version);
    physics = new PerStatePhysics(data, bot.world, {
        doBlockInfoUpdates: true,
        ignoreHoriztonalCollisions: false,
        ignoreVerticalCollisions: false,
        doCollisions: true,
        customCollisionsOnly: false,
    });
    // (bot.physics as any) = physics

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
    simulator = new Simulations(bot, physics);
    // (bot.pathfinder as any).enablePathShortcut = true

    bot.physics.yawSpeed = 20;
});

bot.on("chat", async (username, message) => {
    const msg = message.split(" ");
    let target;
    let pos;
    switch (msg[0]) {
        case "sim":
       
            const src = bot.entity.position.clone().floored().offset(0, -1, 0);
            const block = bot.findBlock({
                matching: (b: Block) => {
                    // let tmp = 10;
                    // if (b.position.xzDistanceTo(bot.entity.position) < 3) {
                    //     tmp = MathUtils.yawPitchAndSpeedToDir(bot.entity.yaw, bot.entity.pitch, 1)
                    //         .normalize()
                    //         .dot(b.position.clone().subtract(bot.entity.position).normalize());
                    //     // console.log(tmp, b.position.xzDistanceTo(bot.entity.position), b.name)
                    // }
                    const ydist = b.position.clone().subtract(src).y
                    return (
                        ((b.position.xzDistanceTo(src) <= 8 && b.position.xzDistanceTo(src) >= 3) &&  (ydist <= 1 && ydist > -4))  && !b.name.includes("air") // && 0.9 < tmp && tmp < 1.1
                    );
                },
                maxDistance: 10,
                useExtraInfo: true,
            });
            if (!block) {
                bot.chat("couldn't find block.");
                return;
            }
            // bot.physicsEnabled = false;
            const offset = block.position.offset(0, 1, 0);
       
            // const dir = MathUtils.yawPitchAndSpeedToDir(bot.entity.yaw, bot.entity.pitch, 1).scale(5);
            // const offset = blockPos.offset(dir.x, 0, dir.z)

            // /particle flame 2006.17 65.81 1920.36

 
       
            // await bot.waitForTicks(1);
            const state = new PlayerState(physics, bot, PlayerControls.DEFAULT())
            const srcAABBs = state.getUnderlyingBlockAABBs();




            const dest = AABB.fromBlock(block.position);

            const realGoalDir = dest.getCenter().minus(state.position).normalize(); //playerState.position.minus(goalAABB.getCenter()).normalize();
            realGoalDir.y = 0; // want only x and z, get best 2D direction away from goal.
            let realGoalPair = srcAABBs
                .map((aabb) => {
                    const vecs = getShortestLineBetweenTwoBlocks(aabb, dest).toVecs()
                    let far;
                    let close;
                    if (dest.distanceToVec(vecs[0]) > dest.distanceToVec(vecs[1])) {
                        console.log("far = 1", dest.distanceToVec(vecs[0]), dest.distanceToVec(vecs[1]))
                        far = vecs[1];
                        close = vecs[0]
                    } else {
                        console.log("far = 0", dest.distanceToVec(vecs[0]), dest.distanceToVec(vecs[1]))
                        far = vecs[0];
                        close = vecs[1];
                    }
                    const dir = far.minus(close).normalize();
                    dir.y = 0
                    console.log(dir)
                    return [aabb.intersectsRay(state!.position.offset(0, -0.5, 0), dir), far]
                })
                .filter((i) => !!i)
                .sort((a, b) => dest.distanceToVec(b[0]!) - dest.distanceToVec(a[0]!))[0];
              
            


            if (!realGoalPair) {
                console.log("shit...")
                realGoalPair = [srcAABBs.sort((a, b) => b.distanceToVec(offset) - a.distanceToVec(offset))[0].getCenter(), dest.getCenter()];
            }


            console.log(block.position, realGoalPair[1])

            bot.chat("/particle flame " + realGoalPair[1]!.x + ".0 " + (realGoalPair[1]!.y + 1) + ".0 " + realGoalPair[1]!.z + ".0 0 0.5 0 0 10");

            bot.lookAt(realGoalPair[1]!, false);
            await bot.util.sleep(150);

            await simulator.simulateBackUpBeforeJump(bot, srcAABBs, realGoalPair[0]!, true, false, 20, state);
            await simulator.simulateJumpFromEdgeOfBlock(bot, srcAABBs, realGoalPair[1]!, true, false, 30, state);
            bot.physicsEnabled = true;
            break;
        case "simto":
            target = bot.nearestEntity((e) => e.username === username)!;
            pos = target.position;
            
            const src1 = bot.entity.position.clone().floored().offset(0, -1, 0);
            // await simulator.simulateJumpFromEdgeOfBlock(bot, pos, true, true, 500);
            break;
        case "test":
            target = bot.nearestEntity((e) => e.username === username)!;
            pos = target.position;
            bot.on("physicsTick", () => bot.setControlState("sneak", true));
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
