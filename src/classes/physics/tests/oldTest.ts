import { Bot, createBot } from "mineflayer";
import { goals, Move, Movements, pathfinder } from "mineflayer-pathfinder";
import utilPlugin, { AABB, MathUtils } from "@nxg-org/mineflayer-util-plugin";
import tracker from "@nxg-org/mineflayer-tracker";
import { PerStatePhysics } from "../engines/PerStatePhysics";
import md from "minecraft-data";
import { Physics } from "../engines/physics";
import { Entity } from "prismarine-entity";
import { Vec3 } from "vec3";
import { Simulations } from "../sims/simulations";
import { Block } from "prismarine-block";
import { PlayerState } from "../extras/playerState";
import { ControlStateHandler, PlayerControls } from "../../player/playerControls";
import { getBetweenRectangle } from "../extras/physicsUtils";
import { JumpMovement } from "./oldJumpMovement";

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

bot.loadPlugin(pathfinder);
bot.loadPlugin(utilPlugin);
bot.loadPlugin(tracker);

let moves: Movements;
let simulator: Simulations;
let physics: PerStatePhysics;
let data: md.IndexedData;
bot.once("spawn", () => {
    data = md(bot.version);
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

    // bot.physics.yawSpeed = 20;
});


let pathing = false;
let debuggin = false;
async function testSimAlongPath(username: string) {
    if (pathing) return;
    pathing = true;

    const ttarget = bot.nearestEntity((e) => e.username === username);
    if (!ttarget) {
        bot.chat("cant see target " + username);
        pathing = false;
        return;
    }
    const state = new PlayerState(physics, bot, ControlStateHandler.COPY_BOT(bot));
    const pathGoal = ttarget.position.clone();

    const moves = [];
    const goalReached = simulator.getReached(pathGoal);
    while (!goalReached(state) && pathing) {
        const src = state.position.floored().offset(0, -1, 0);
        const srcAABBs = state.getUnderlyingBlockAABBs();
        let blocks = bot
            .findBlocks({
                matching: (b: Block) => {
                    const ydist = b.position.minus(src).y;
                    const xzdist = b.position.xzDistanceTo(src);
                    return (
                        xzdist <= 8 &&
                        xzdist >= 2 &&
                        ydist <= 1 &&
                        // ydist > -8 &&
                        !b.name.includes("air") &&
                        pathGoal.distanceTo(b.position) < pathGoal.distanceTo(src)
                    );
                },
                // maxDistance: 10,
                useExtraInfo: true,
                count: 1000,
                point: state.position,
            })
            .filter((b) => bot.blockAt(b.offset(0, 1, 0))?.name === "air" && bot.blockAt(b.offset(0, 2, 0))?.name === "air");
        console.log(blocks.length);
        const time = performance.now();
        const results = await Promise.all(
            blocks.map(async (b) => {
               return await JumpMovement.checkValidity(simulator, bot, { position: b } as any, state, debuggin)
            })
        );


        console.log(state.position);
        blocks = blocks.filter((_b, index) => results[index]).sort((a, b) => a.distanceTo(pathGoal) - b.distanceTo(pathGoal));
        console.log("finished checking.", performance.now() - time, "ms.", blocks.length);
        const block = blocks[0];
        if (!block) {
            bot.chat("couldn't find block.");
            // pathing = false;
            break;
        } else {
            moves.push(bot.blockAt(block)!);
            state.position.set(block.x + 0.5, block.y + 1, block.z + 0.5)
        }
    }
    bot.chat(`found a good path: ${pathGoal}`);

    
    const res = (bot: Bot) => {
        const delta = bot.entity.position.minus(pathGoal);
        return Math.abs(delta.x) <= 0.35 && Math.abs(delta.z) <= 0.35 && Math.abs(delta.y) < 1 && (state.onGround || state.isInWater);
    };

    while (!res(bot)) {
        const wantedMove = moves.shift();
        if (wantedMove) {
            const move = new JumpMovement(physics, simulator, bot, wantedMove.position);
            await move.commitJump();
        } else {
            bot.chat("No more moves.");
            break;
        }
    }
    bot.chat(`should have made it: ${pathGoal}`);
    pathing = false;
}

let pastGoals = new Set<String>();
bot.on("chat", async (username, message) => {
    if (username === bot.entity.username) return;
    const msg = message.split(" ");
    let target;
    let pos;
    switch (msg[0]) {
        case "reset":
            pastGoals = new Set<String>();
            pathing = false;
            break;

        case "debug":
            debuggin = !debuggin;
            bot.chat("debug set to " + debuggin);
            break;
        case "simpath":
            await testSimAlongPath(username);
            break;
        case "newsim":
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
                    const ydist = b.position.clone().subtract(src).y;
                    return (
                        b.position.xzDistanceTo(src) <= 8 &&
                        b.position.xzDistanceTo(src) >= 2 &&
                        ydist <= 1 &&
                        ydist > -4 &&
                        !pastGoals.has(b.position.toString()) &&
                        !b.name.includes("air") // && 0.9 < tmp && tmp < 1.1
                    );
                },
                maxDistance: 10,
                useExtraInfo: true,
            });
            if (!block) {
                bot.chat("couldn't find block.");
                return;
            }
            pastGoals.add(block.position.toString());

            const move = new JumpMovement(physics, simulator, bot, block.position);
            await move.commitJump();

            break;

        case "sim":
            const src1 = bot.entity.position.clone().floored().offset(0, -1, 0);
            const block1 = bot.findBlock({
                matching: (b: Block) => {
                    // let tmp = 10;
                    // if (b.position.xzDistanceTo(bot.entity.position) < 3) {
                    //     tmp = MathUtils.yawPitchAndSpeedToDir(bot.entity.yaw, bot.entity.pitch, 1)
                    //         .normalize()
                    //         .dot(b.position.clone().subtract(bot.entity.position).normalize());
                    //     // console.log(tmp, b.position.xzDistanceTo(bot.entity.position), b.name)
                    // }
                    const ydist = b.position.clone().subtract(src1).y;
                    return (
                        b.position.xzDistanceTo(src1) <= 8 &&
                        b.position.xzDistanceTo(src1) >= 2 &&
                        ydist <= 1 &&
                        ydist > -4 &&
                        !pastGoals.has(b.position.toString()) &&
                        !b.name.includes("air") // && 0.9 < tmp && tmp < 1.1
                    );
                },
                maxDistance: 10,
                useExtraInfo: true,
            });
            if (!block1) {
                bot.chat("couldn't find block.");
                return;
            }

            pastGoals.add(block1.position.toString());

            // const dir = MathUtils.yawPitchAndSpeedToDir(bot.entity.yaw, bot.entity.pitch, 1).scale(5);
            // const offset = blockPos.offset(dir.x, 0, dir.z)

            // /particle flame 2006.17 65.81 1920.36

            // await bot.waitForTicks(1);
            const state = new PlayerState(physics, bot, ControlStateHandler.COPY_BOT(bot));
            const srcAABBs = state.getUnderlyingBlockAABBs();
            srcAABBs.forEach((src) => pastGoals.add("(" + src.minX + ", " + src.minY + ", " + src.minZ + ")"));
            const dest = AABB.fromBlock(block1.position);

            // const realGoalDir = dest.getCenter().minus(state.position).normalize(); //playerState.position.minus(goalAABB.getCenter()).normalize();
            // realGoalDir.y = 0; // want only x and z, get best 2D direction away from goal.
            let realGoals = srcAABBs
                .map((aabb) => {
                    // ! mm yes, good code.

                    // ! temporary arrays to store found x, y, z
                    const destTmp = [0, 0, 0];
                    const srcTmp = [0, 0, 0];

                    // ! grab the rectangle bounding between the two blocks (below expanded to three dimensions)
                    // ! Referring to this as "between" rectangle.
                    // * https://gamedev.stackexchange.com/questions/154036/efficient-minimum-distance-between-two-axis-aligned-squares
                    const betweenPoints = getBetweenRectangle(aabb, dest).toArray();

                    // ! get points of target block.
                    const destPoints = dest.toArray();

                    // ! loop over X, Y, Z (0, 1, 2, respectively)
                    for (let i = 0; i < 3; i++) {
                        // ! check if boxes are sharing a coordinate. I came up w/ this on the spot, can't explain it besides it working.
                        if (
                            betweenPoints[i] == destPoints[i] &&
                            (betweenPoints[i + 3] == destPoints[i] || betweenPoints[i + 3] == destPoints[i + 3])
                        ) {
                            srcTmp[i] = (betweenPoints[i] + betweenPoints[i + 3]) / 2;
                            destTmp[i] = (betweenPoints[i] + betweenPoints[i + 3]) / 2;
                        }

                        // ! check if min(x, y, z) of between rect. equals
                        else if (betweenPoints[i] == destPoints[i] || betweenPoints[i + 3] == destPoints[i]) {
                            srcTmp[i] = betweenPoints[i];
                            destTmp[i] = betweenPoints[i + 3];
                        } else {
                            srcTmp[i] = betweenPoints[i + 3];
                            destTmp[i] = betweenPoints[i];
                        }
                    }
                    const closeToDest = new Vec3(destTmp[0], destTmp[1], destTmp[2]);
                    const closeToSrc = new Vec3(srcTmp[0], srcTmp[1], srcTmp[2]);
                    const dir = closeToDest.minus(closeToSrc).normalize();
                    let tryIt = aabb.intersectsRay(closeToSrc, dir);
                    tryIt = tryIt!.plus(tryIt!.minus(closeToSrc).normalize().scale(0.3));
                    return [tryIt, closeToDest.y > closeToSrc.y ? closeToDest : closeToDest.offset(0, 1, 0)]; //
                })
                .filter((i) => !!i[0])
                .sort((a, b) => dest.distanceToVec(b[0]!) - dest.distanceToVec(a[0]!))[0];

            // console.log(block.position, realGoals[0], realGoals[1]);
            bot.chat(
                "/particle flame " +
                    realGoals[0]!.x.toFixed(4) +
                    " " +
                    realGoals[0]!.y.toFixed(4) +
                    " " +
                    realGoals[0]!.z.toFixed(4) +
                    " 0 0.5 0 0 10"
            );
            bot.chat(
                "/particle flame " +
                    realGoals[1]!.x.toFixed(4) +
                    " " +
                    realGoals[1]!.y.toFixed(4) +
                    " " +
                    realGoals[1]!.z.toFixed(4) +
                    " 0 0.5 0 0 10"
            );
            // bot.lookAt(realGoals[1], false);
            // await bot.util.sleep(150);

            if (state.position.xzDistanceTo(realGoals[0]) > 0.1) {
                await simulator.simulateBackUpBeforeJump(srcAABBs, realGoals[0], true, true, 20, state, bot);
            }

            // await bot.lookAt(realGoals[1]!, false);
            // await bot.util.sleep(150);
            await simulator.simulateJumpFromEdgeOfBlock(srcAABBs, realGoals[1], block1.position, true, 30, state, bot);

            // await simulator.simulateJumpFromEdgeOfBlock(bot, srcAABBs, realGoalPair[1]!, true, true, 30, state);
            bot.physicsEnabled = true;
            break;
        case "simto":
            target = bot.nearestEntity((e) => e.username === username)!;
            pos = target.position;

            const src2 = bot.entity.position.clone().floored().offset(0, -1, 0);
            await simulator.simulateSmartAim( pos, true, false, 0, 500, undefined, bot);
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
