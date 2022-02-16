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
import { calculationConcurrency, getBetweenRectangle } from "../extras/physicsUtils";
import { NewSimulations } from "../sims/simulationsNew";
import { MovementData } from "../../movement/movementData";
import { fuk, NewJumpMovement } from "./newJumpMovement";
import { NewSims } from "../sims/nextSim";
import { NewJump } from "./newNewJump";
import { PathContext } from "../sims/firstTryPath";
import commonSense  from "@nxg-org/mineflayer-common-sense";





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
