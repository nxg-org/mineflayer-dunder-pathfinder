import { createBot, EquipmentDestination } from "mineflayer";
import { Vec3 } from "vec3";
import { BlockCheck } from "./classes/blocks/blockInfo";
import pathfinder from "./index"
const { PlayerState } = require("prismarine-physics");



const bot = createBot({
    username: "fuckyeah",
    host: "localhost",
    version: "1.17.1"
})


bot.loadPlugin(pathfinder)


bot.on("chat", (username, message) => {
    if (username != bot.username) {
        let myMessage = message.split(" ");
        let findPathX: number;
        let findPathY: string | number;
        let findPathZ: string | number | undefined;
        let validSyntax = false;
        switch (myMessage[0]) {
            case "bug":
                console.log(bot.newPather.movesToGo[bot.newPather.lastPos.currentMove]);
                bot.chat("/gc");
                break;
            case "goto":
                findPathX = 0;
                findPathY = 0;
                findPathZ = 0;
                if (myMessage[1] == "me") {
                    console.log("Finding you...");
                    let playerTo = bot.players[username];
                    if (playerTo && playerTo.entity) {
                        findPathX = Math.floor(playerTo.entity.position.x);
                        findPathY = Math.round(playerTo.entity.position.y);
                        findPathZ = Math.floor(playerTo.entity.position.z);
                        validSyntax = true;
                    }
                } else if (myMessage[1] == "*") {
                    let inven = bot.inventory.slots;
                    console.log("Searching for compass...");
                    for (let i = 0; i < inven.length; i++) {
                        if (inven[i] == null) {
                            continue;
                        } else if (inven[i].name == "compass") {
                            console.log(JSON.stringify(inven[i].name));
                            if (inven[i].nbt && inven[i]?.nbt?.value && (inven[i]?.nbt?.value as any)?.LodestonePos) {
                                console.log(JSON.stringify((inven[i]?.nbt?.value as any)?.LodestonePos));
                                findPathX = (inven[i]?.nbt?.value as any)?.LodestonePos?.value?.X?.value;
                                //findPathY = inven[i].nbt.value.LodestonePos.value.Y.value +
                                findPathY = "no";
                                findPathZ = (inven[i]?.nbt?.value as any)?.LodestonePos?.value?.Z?.value;
                                validSyntax = true;
                                i = inven.length;
                            }
                        } else {
                            //console.log(inven[i].name);
                        }
                    }
                } else if (myMessage.length == 2) {
                    console.log("Finding " + myMessage[1] + "...");
                    let playerTo = bot.players[myMessage[1]];
                    if (playerTo && playerTo.entity) {
                        findPathX = Math.floor(playerTo.entity.position.x);
                        findPathY = Math.round(playerTo.entity.position.y);
                        findPathZ = Math.floor(playerTo.entity.position.z);
                        validSyntax = true;
                    }
                } else if (myMessage.length >= 3) {
                    findPathX = Math.floor(Number(myMessage[1]));
                    findPathY = Math.round(Number(myMessage[2]));
                    if (myMessage.length == 4) {
                        findPathZ = Math.floor(Number(myMessage[3]));
                    } else {
                        findPathY = "no";
                        findPathZ = Math.round(Number(myMessage[2]));
                        bot.newPather.botGoal = { x: findPathX, y: "no", z: findPathZ, reached: false };
                    }

                    if (findPathX != NaN && findPathY != NaN /* && findPathZ != NaN*/) {
                        validSyntax = true;
                    }
                }
                if (validSyntax) {
                    bot.chat(
                        "Finding path. My current position is X: " +
                            Math.floor(bot.entity.position.x) +
                            ", Y: " +
                            Math.floor(bot.entity.position.y) +
                            ", Z: " +
                            Math.floor(bot.entity.position.z)
                    );
                    if (findPathY != "no") {
                        bot.newPather.botGoal = { x: findPathX, y: findPathY, z: findPathZ, reached: false };
                        bot.newPather.findPath(findPathX, findPathY, findPathZ);
                    } else {
                        bot.newPather.botGoal = { x: findPathX, y: "no", z: findPathZ, reached: false };
                        bot.newPather.findPath(findPathX, findPathZ!);
                    }
                    //bot.entity.position.x = Math.floor(bot.entity.position.x) + 0.5;
                    //bot.entity.position.z = Math.floor(bot.entity.position.z) + 0.5;
                }
                break;
            case "standingIn":
                console.log(
                    JSON.stringify(
                        bot.blockAt(
                            new Vec3(
                                Math.floor(bot.entity.position.x),
                                Math.floor(bot.entity.position.y),
                                Math.floor(bot.entity.position.z)
                            )
                        )
                    )
                );
                console.log(
                    "is it standable? " +
                        bot.newPather.blockInfo.getBlockInfo(
                            bot.blockAt(
                                new Vec3(
                                    Math.floor(bot.entity.position.x),
                                    Math.floor(bot.entity.position.y),
                                    Math.floor(bot.entity.position.z)
                                )
                            )!,
                            BlockCheck.WATER
                        )
                );
                break;
            case "openYourEyes":
                //mineflayerViewer(bot, {port: 3000, viewDistance: 4});
                break;
            case "tpa":
                //bot.chat("/tpa");
                break;
            case "breakBlock":
                if (bot.canDigBlock(bot.blockAtCursor(5)!)) {
                    bot.chat("Digging block");
                    bot.dig(bot.blockAtCursor(5)!);
                } else {
                    bot.chat("Undiggable");
                }
                break;
            case "placeBlock":
                bot.newPather.botActions.placeBlock(
                    bot.blockAt(
                        new Vec3(
                            Math.floor(Number(myMessage[1])),
                            Math.floor(Number(myMessage[2])),
                            Math.floor(Number(myMessage[3]))
                        )
                    )!
                );
                break;
            case "inventory":
                bot.newPather.botActions.equipAnyOfItems([myMessage[1]], myMessage[2] as EquipmentDestination);
                break;
            case "trimPath":
                /*let bestOne = [0, 100000];
                    for (let i = 0; i < movesToGo.length; i++) {
                        if (dist3d(movesToGo[i].x, movesToGo[i].y, movesToGo[i].z, endX, endY, endZ) < bestOne[1]) {
                            bestOne = [i, dist3d(movesToGo[i].x, movesToGo[i].y, movesToGo[i].z, endX, endY, endZ)];
                        }
                    }*/
                let bestOne = [0, 100];
                bestOne[0] += 10;
                if (bestOne[0] > bot.newPather.movesToGo.length - 6) {
                    bestOne[0] = bot.newPather.movesToGo.length - 6;
                }
                if (bestOne[0] >= 0) {
                    bot.newPather.lastPos.currentMove -= bestOne[0] + 1;
                    bot.newPather.movesToGo.splice(0, bestOne[0] + 1);
                }
                bot.chat("/particle spit " + bot.newPather.movesToGo[0].x + " " + bot.newPather.movesToGo[0].y + " " + bot.newPather.movesToGo[0].z);
                break;
            case "fixPath":
                bot.newPather.findPath(bot.newPather.movesToGo[0].x, bot.newPather.movesToGo[0].y, bot.newPather.movesToGo[0].z, true);
                break;
            case "extendPath":
                bot.newPather.botSearchingPath = 10;
                findPathX = 0;
                findPathY = 0;
                findPathZ = 0;
                if (myMessage[1] == "me") {
                    console.log("Finding you...");
                    let playerTo = bot.players[username];
                    if (playerTo && playerTo.entity) {
                        findPathX = Math.floor(playerTo.entity.position.x);
                        findPathY = Math.round(playerTo.entity.position.y);
                        findPathZ = Math.floor(playerTo.entity.position.z);
                        validSyntax = true;
                    }
                } else if (myMessage.length == 2) {
                    console.log("Finding " + myMessage[1] + "...");
                    let playerTo = bot.players[myMessage[1]];
                    if (playerTo && playerTo.entity) {
                        findPathX = Math.floor(playerTo.entity.position.x);
                        findPathY = Math.round(playerTo.entity.position.y);
                        findPathZ = Math.floor(playerTo.entity.position.z);
                        validSyntax = true;
                    }
                } else if (myMessage.length >= 3) {
                    findPathX = Math.floor(Number(myMessage[1]));
                    findPathY = Math.round(Number(myMessage[2]));
                    if (myMessage.length == 4) {
                        findPathZ = Math.floor(Number(myMessage[3]));
                    } else {
                        findPathZ = undefined;
                    }

                    if (findPathX != NaN && findPathY != NaN /* && findPathZ != NaN*/) {
                        validSyntax = true;
                    }
                }

                if (validSyntax) {
                    bot.chat(
                        "Finding path. My current position is X: " +
                            Math.floor(bot.entity.position.x) +
                            ", Y: " +
                            Math.floor(bot.entity.position.y) +
                            ", Z: " +
                            Math.floor(bot.entity.position.z)
                    );
                    bot.newPather.botGoal = { x: findPathX, y: findPathY, z: findPathZ, reached: false };
                    bot.newPather.findPath(findPathX, findPathY, findPathZ, false, true);
                    //bot.entity.position.x = Math.floor(bot.entity.position.x) + 0.5;
                    //bot.entity.position.z = Math.floor(bot.entity.position.z) + 0.5;
                }
                break;
            case "hunt":
                if (myMessage[1] == "all") {
                    bot.newPather.huntMode = 0;
                } else {
                    bot.newPather.huntMode = 1;
                    console.log(bot.newPather.huntMode);
                    bot.newPather.huntTarget = bot.players[myMessage[1]];
                    bot.newPather.huntTrackTimer = 10;
                    if (bot.newPather.huntTarget && bot.newPather.huntTarget.entity) {
                        findPathX = Math.floor(bot.newPather.huntTarget.entity.position.x);
                        findPathY = Math.round(bot.newPather.huntTarget.entity.position.y);
                        findPathZ = Math.floor(bot.newPather.huntTarget.entity.position.z);
                        bot.newPather.findPath(findPathX, findPathY, findPathZ);
                    }
                }
                console.log("hunting");
                break;
            case "activate":
                bot.activateItem(false);
                break;
            case "deactivate":
                bot.deactivateItem(); //(false)
                break;
            case "stop":
                bot.newPather.jumpTarget = false;
                bot.newPather.jumpTargets = [];
                bot.clearControlStates();
                //console.log(JSON.stringify(botPvpRandoms));
                //console.log(JSON.stringify(botPvpRandomsDamages));
                break;
            case "simulateJump":
                bot.newPather.jumpTarget = false;
                bot.newPather.jumpTargets = [];
                bot.newPather.myStates = [];
                let mySimCount = 2;
                if (parseInt(myMessage[1])) {
                    mySimCount = parseInt(myMessage[1]);
                    console.log("mySimCount is " + myMessage[1]);
                }
                bot.newPather.jumpSprintOnMoves(new PlayerState(bot, bot.newPather.simControl), mySimCount);
                break;
        }
        /*bot.chat(message);
            switch (message) {
                case "f":bot.setControlState("forward", true);break;
                case "b":bot.setControlState("back", true);break;
                case "l":bot.setControlState("left", true);break;
                case "r":bot.setControlState("right", true);break;
                case "sprint":bot.setControlState("sprint", true);break;
                case "j":bot.setControlState("jump", true);bot.setControlState("jump", false);break;
                case "jLots":bot.setControlState("jump", true);break;
                case "attack":
                    let nearest = bot.nearestEntity();
                    if (nearest) {
                        bot.attack(nearest, true);
                    }
                break;
                case "stop":
                    bot.setControlState("jump", false);
                    bot.setControlState("forward", false);
                    bot.setControlState("back", false);
                    bot.setControlState("left", false);
                    bot.setControlState("right", false);
                    bot.setControlState("sprint", false);
                break;
            }*/
    }
});