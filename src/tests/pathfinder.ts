import { Bot, EquipmentDestination } from "mineflayer";
import { Block } from "prismarine-block";
import { Entity } from "prismarine-entity";
import { Vec3 } from "vec3";
import { BlockInfo, TypeCheck } from "./classes/blocks/blockInfo";
import { BotActions } from "./classes/player/botActions";
import { AdvancedPlayerControls, PlayerControls } from "./classes/player/playerControls";
import { scaffoldBlocks } from "./utils/constants";
import { CostCalculator } from "./classes/player/costCalculator";

const AABB = require("prismarine-physics/lib/aabb");
const { PlayerState } = require("prismarine-physics");

function dist3d(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number) {
    return Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1) + (z2 - z1) * (z2 - z1));
}

function isSwim(swimme: string) {
    let isTitle = false;
    if (
        swimme == "start" ||
        swimme == "swimFast" ||
        swimme == "swimSlow" ||
        swimme == "lava" ||
        swimme == "fallWater" ||
        swimme == "fallLava"
    ) {
        isTitle = true;
    }
    return isTitle;
}

// parent, fcost, hcost, x, y, z, moveType, brokenBlocks, brokeBlocks, placedBlocks, elBlockActions

type DunderNode = {
    parent?: DunderNode;
    fCost: number;
    hCost: number;
    x: number;
    y: number;
    z: number;
    open: boolean;
    moveType: string;
    brokenBlocks: any[];
    brokeBlocks: boolean;
    placedBlocks: boolean;
    blockActions: any[]; // fuck off vak lmfao
};

type DunderMove = { mType: string; x: number; y: number; z: number; blockActions: any[]; blockDestructions: any[] };

export class Pathfinder {
    // public lastPos: { move: number; x: number; y: number; z: number };

    public botIsDigging = -2;
    // public botMove: any = null;
    public movesToGo: DunderMove[] = [];
    public lastPos: { currentMove: number, x: number, y: number, z: number } = {currentMove: 0, x: 0, y: 0, z: 0}

    public botGoal: { x: number; y: string | number; z?: string | number; reached: boolean } = { x: 0, y: 0, z: 0, reached: true };
    public swimmingFast = false;
    public shouldSwimFast = true;

    public botSearchingPath = 10;

    public huntMode = 0;
    public huntTarget: Entity | any = null;
    public huntTrackTimer: number = 0;

    public jumpTarget: Vec3 | any = null;
    public jumpTargets: Vec3[] | any[] = [];
    public myStates: any[] = [];

    public simControl: PlayerControls;
    public botMove: AdvancedPlayerControls;

    public pathfinderOptions = {
        maxFall: 3,
        maxFallClutch: 256,
        canClutch: true,
        sprint: true,
        parkour: true,
        place: true,
        break: true,
    };

    public botGrounded: number = 0;
    botDigCTimer: number = 0;
    jumpTimer: number = 0;
    botDigDelay: number = 0;
    lookAtNextDelay: number = 0;
    attackTimer: number = 0;
    botPathfindTimer: number = 0;
    onPath: boolean = false;
    lastHuntTargetPos: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 };
    debugTimer: number = 0;;
    botDestinationTimer: number = 0;
    busyBuilding: boolean = false;
    botLookAtY: number = 0;
    blockPackets: any[] = [];
    botEquipDefault: boolean = false;
    botObstructed: number = 0;
    botRange: number = 3;
    nodes: any[] = [];
    openNodes: any[] = [];
    nodes3d: any[] = [];
    chunkColumns: any[] = [];
    bestNodeIndex: number = 0;
    moveTimer: number = 0;

    constructor(public bot: Bot, public botActions: BotActions, public costInfo: CostCalculator, public blockInfo: BlockInfo) {
        this.simControl = new PlayerControls(true, false, false, false, true, true, false);
        this.botMove = new AdvancedPlayerControls();
        // this.lastPos = { move: 0, ...this.bot.entity.position.floored() };

        bot.once("spawn", async () => {
            console.log("Success! Say goto <player, me, coords> to pathfind");
            console.log(bot.heldItem);
            // if (bot.heldItem && bot.heldItem.nbt && bot.heldItem.nbt.value && bot.heldItem.nbt.value.LodestonePos) {
            //     console.log(JSON.stringify(bot.heldItem.nbt.value.LodestonePos));
            // }
            //console.log(bot.physics.playerHeight);//playerHalfWidth
            (bot.physics as any).playerHalfWidth = 0.3001;
            //bot.physics.stepHeight = 0.15;
            //console.log(bot.physics.playerHalfWidth);
            bot.chat("Success! Say goto <player, me, coords> to pathfind");
            while (bot.entity.isValid) {
                this.run();
                await bot.waitForTicks(1);
            }
            //let lastPosition = {"x":0, "y":0, "time":Date.now()};
        });

        // bot.on("chat", (username, message) => {
        //     if (username != bot.username) {
        //         let myMessage = message.split(" ");
        //         let findPathX: number;
        //         let findPathY: string | number;
        //         let findPathZ: string | number | undefined;
        //         let validSyntax = false;
        //         switch (myMessage[0]) {
        //             case "bug":
        //                 console.log(this.movesToGo[this.lastPos.currentMove]);
        //                 bot.chat("/gc");
        //                 break;
        //             case "goto":
        //                 findPathX = 0;
        //                 findPathY = 0;
        //                 findPathZ = 0;
        //                 if (myMessage[1] == "me") {
        //                     console.log("Finding you...");
        //                     let playerTo = bot.players[username];
        //                     if (playerTo && playerTo.entity) {
        //                         findPathX = Math.floor(playerTo.entity.position.x);
        //                         findPathY = Math.round(playerTo.entity.position.y);
        //                         findPathZ = Math.floor(playerTo.entity.position.z);
        //                         validSyntax = true;
        //                     }
        //                 } else if (myMessage[1] == "*") {
        //                     let inven = bot.inventory.slots;
        //                     console.log("Searching for compass...");
        //                     for (let i = 0; i < inven.length; i++) {
        //                         if (inven[i] == null) {
        //                             continue;
        //                         } else if (inven[i].name == "compass") {
        //                             console.log(JSON.stringify(inven[i].name));
        //                             if (inven[i].nbt && inven[i]?.nbt?.value && (inven[i]?.nbt?.value as any)?.LodestonePos) {
        //                                 console.log(JSON.stringify((inven[i]?.nbt?.value as any)?.LodestonePos));
        //                                 findPathX = (inven[i]?.nbt?.value as any)?.LodestonePos?.value?.X?.value;
        //                                 //findPathY = inven[i].nbt.value.LodestonePos.value.Y.value +
        //                                 findPathY = "no";
        //                                 findPathZ = (inven[i]?.nbt?.value as any)?.LodestonePos?.value?.Z?.value;
        //                                 validSyntax = true;
        //                                 i = inven.length;
        //                             }
        //                         } else {
        //                             //console.log(inven[i].name);
        //                         }
        //                     }
        //                 } else if (myMessage.length == 2) {
        //                     console.log("Finding " + myMessage[1] + "...");
        //                     let playerTo = bot.players[myMessage[1]];
        //                     if (playerTo && playerTo.entity) {
        //                         findPathX = Math.floor(playerTo.entity.position.x);
        //                         findPathY = Math.round(playerTo.entity.position.y);
        //                         findPathZ = Math.floor(playerTo.entity.position.z);
        //                         validSyntax = true;
        //                     }
        //                 } else if (myMessage.length >= 3) {
        //                     findPathX = Math.floor(Number(myMessage[1]));
        //                     findPathY = Math.round(Number(myMessage[2]));
        //                     if (myMessage.length == 4) {
        //                         findPathZ = Math.floor(Number(myMessage[3]));
        //                     } else {
        //                         findPathY = "no";
        //                         findPathZ = Math.round(Number(myMessage[2]));
        //                         this.botGoal = { x: findPathX, y: "no", z: findPathZ, reached: false };
        //                     }

        //                     if (findPathX != NaN && findPathY != NaN /* && findPathZ != NaN*/) {
        //                         validSyntax = true;
        //                     }
        //                 }
        //                 if (validSyntax) {
        //                     bot.chat(
        //                         "Finding path. My current position is X: " +
        //                             Math.floor(bot.entity.position.x) +
        //                             ", Y: " +
        //                             Math.floor(bot.entity.position.y) +
        //                             ", Z: " +
        //                             Math.floor(bot.entity.position.z)
        //                     );
        //                     if (findPathY != "no") {
        //                         this.botGoal = { x: findPathX, y: findPathY, z: findPathZ, reached: false };
        //                         this.findPath(findPathX, findPathY, findPathZ);
        //                     } else {
        //                         this.botGoal = { x: findPathX, y: "no", z: findPathZ, reached: false };
        //                         this.findPath(findPathX, findPathZ!);
        //                     }
        //                     //bot.entity.position.x = Math.floor(bot.entity.position.x) + 0.5;
        //                     //bot.entity.position.z = Math.floor(bot.entity.position.z) + 0.5;
        //                 }
        //                 break;
        //             case "standingIn":
        //                 console.log(
        //                     JSON.stringify(
        //                         bot.blockAt(
        //                             new Vec3(
        //                                 Math.floor(bot.entity.position.x),
        //                                 Math.floor(bot.entity.position.y),
        //                                 Math.floor(bot.entity.position.z)
        //                             )
        //                         )
        //                     )
        //                 );
        //                 console.log(
        //                     "is it standable? " +
        //                         this.blockInfo.getBlockInfo(
        //                             bot.blockAt(
        //                                 new Vec3(
        //                                     Math.floor(bot.entity.position.x),
        //                                     Math.floor(bot.entity.position.y),
        //                                     Math.floor(bot.entity.position.z)
        //                                 )
        //                             )!,
        //                             TypeCheck.WATER
        //                         )
        //                 );
        //                 break;
        //             case "openYourEyes":
        //                 //mineflayerViewer(bot, {port: 3000, viewDistance: 4});
        //                 break;
        //             case "tpa":
        //                 //bot.chat("/tpa");
        //                 break;
        //             case "breakBlock":
        //                 if (bot.canDigBlock(bot.blockAtCursor(5)!)) {
        //                     bot.chat("Digging block");
        //                     bot.dig(bot.blockAtCursor(5)!);
        //                 } else {
        //                     bot.chat("Undiggable");
        //                 }
        //                 break;
        //             case "placeBlock":
        //                 this.botActions.placeBlock(
        //                     bot.blockAt(
        //                         new Vec3(
        //                             Math.floor(Number(myMessage[1])),
        //                             Math.floor(Number(myMessage[2])),
        //                             Math.floor(Number(myMessage[3]))
        //                         )
        //                     )!
        //                 );
        //                 break;
        //             case "inventory":
        //                 this.botActions.equipAnyOfItems([myMessage[1]], myMessage[2] as EquipmentDestination);
        //                 break;
        //             case "trimPath":
        //                 /*let bestOne = [0, 100000];
        //                     for (let i = 0; i < movesToGo.length; i++) {
        //                         if (dist3d(movesToGo[i].x, movesToGo[i].y, movesToGo[i].z, endX, endY, endZ) < bestOne[1]) {
        //                             bestOne = [i, dist3d(movesToGo[i].x, movesToGo[i].y, movesToGo[i].z, endX, endY, endZ)];
        //                         }
        //                     }*/
        //                 let bestOne = [0, 100];
        //                 bestOne[0] += 10;
        //                 if (bestOne[0] > this.movesToGo.length - 6) {
        //                     bestOne[0] = this.movesToGo.length - 6;
        //                 }
        //                 if (bestOne[0] >= 0) {
        //                     this.lastPos.currentMove -= bestOne[0] + 1;
        //                     this.movesToGo.splice(0, bestOne[0] + 1);
        //                 }
        //                 bot.chat("/particle spit " + this.movesToGo[0].x + " " + this.movesToGo[0].y + " " + this.movesToGo[0].z);
        //                 break;
        //             case "fixPath":
        //                 this.findPath(this.movesToGo[0].x, this.movesToGo[0].y, this.movesToGo[0].z, true);
        //                 break;
        //             case "extendPath":
        //                 this.botSearchingPath = 10;
        //                 findPathX = 0;
        //                 findPathY = 0;
        //                 findPathZ = 0;
        //                 if (myMessage[1] == "me") {
        //                     console.log("Finding you...");
        //                     let playerTo = bot.players[username];
        //                     if (playerTo && playerTo.entity) {
        //                         findPathX = Math.floor(playerTo.entity.position.x);
        //                         findPathY = Math.round(playerTo.entity.position.y);
        //                         findPathZ = Math.floor(playerTo.entity.position.z);
        //                         validSyntax = true;
        //                     }
        //                 } else if (myMessage.length == 2) {
        //                     console.log("Finding " + myMessage[1] + "...");
        //                     let playerTo = bot.players[myMessage[1]];
        //                     if (playerTo && playerTo.entity) {
        //                         findPathX = Math.floor(playerTo.entity.position.x);
        //                         findPathY = Math.round(playerTo.entity.position.y);
        //                         findPathZ = Math.floor(playerTo.entity.position.z);
        //                         validSyntax = true;
        //                     }
        //                 } else if (myMessage.length >= 3) {
        //                     findPathX = Math.floor(Number(myMessage[1]));
        //                     findPathY = Math.round(Number(myMessage[2]));
        //                     if (myMessage.length == 4) {
        //                         findPathZ = Math.floor(Number(myMessage[3]));
        //                     } else {
        //                         findPathZ = undefined;
        //                     }

        //                     if (findPathX != NaN && findPathY != NaN /* && findPathZ != NaN*/) {
        //                         validSyntax = true;
        //                     }
        //                 }

        //                 if (validSyntax) {
        //                     bot.chat(
        //                         "Finding path. My current position is X: " +
        //                             Math.floor(bot.entity.position.x) +
        //                             ", Y: " +
        //                             Math.floor(bot.entity.position.y) +
        //                             ", Z: " +
        //                             Math.floor(bot.entity.position.z)
        //                     );
        //                     this.botGoal = { x: findPathX, y: findPathY, z: findPathZ, reached: false };
        //                     this.findPath(findPathX, findPathY, findPathZ, false, true);
        //                     //bot.entity.position.x = Math.floor(bot.entity.position.x) + 0.5;
        //                     //bot.entity.position.z = Math.floor(bot.entity.position.z) + 0.5;
        //                 }
        //                 break;
        //             case "hunt":
        //                 if (myMessage[1] == "all") {
        //                     this.huntMode = 0;
        //                 } else {
        //                     this.huntMode = 1;
        //                     console.log(this.huntMode);
        //                     this.huntTarget = bot.players[myMessage[1]];
        //                     this.huntTrackTimer = 10;
        //                     if (this.huntTarget && this.huntTarget.entity) {
        //                         findPathX = Math.floor(this.huntTarget.entity.position.x);
        //                         findPathY = Math.round(this.huntTarget.entity.position.y);
        //                         findPathZ = Math.floor(this.huntTarget.entity.position.z);
        //                         this.findPath(findPathX, findPathY, findPathZ);
        //                     }
        //                 }
        //                 console.log("hunting");
        //                 break;
        //             case "activate":
        //                 bot.activateItem(false);
        //                 break;
        //             case "deactivate":
        //                 bot.deactivateItem(); //(false)
        //                 break;
        //             case "stop":
        //                 this.jumpTarget = false;
        //                 this.jumpTargets = [];
        //                 bot.clearControlStates();
        //                 //console.log(JSON.stringify(botPvpRandoms));
        //                 //console.log(JSON.stringify(botPvpRandomsDamages));
        //                 break;
        //             case "simulateJump":
        //                 this.jumpTarget = false;
        //                 this.jumpTargets = [];
        //                 this.myStates = [];
        //                 let mySimCount = 2;
        //                 if (parseInt(myMessage[1])) {
        //                     mySimCount = parseInt(myMessage[1]);
        //                     console.log("mySimCount is " + myMessage[1]);
        //                 }
        //                 this.jumpSprintOnMoves(new PlayerState(bot, this.simControl), mySimCount);
        //                 break;
        //         }
        //         /*bot.chat(message);
        //             switch (message) {
        //                 case "f":bot.setControlState("forward", true);break;
        //                 case "b":bot.setControlState("back", true);break;
        //                 case "l":bot.setControlState("left", true);break;
        //                 case "r":bot.setControlState("right", true);break;
        //                 case "sprint":bot.setControlState("sprint", true);break;
        //                 case "j":bot.setControlState("jump", true);bot.setControlState("jump", false);break;
        //                 case "jLots":bot.setControlState("jump", true);break;
        //                 case "attack":
        //                     let nearest = bot.nearestEntity();
        //                     if (nearest) {
        //                         bot.attack(nearest, true);
        //                     }
        //                 break;
        //                 case "stop":
        //                     bot.setControlState("jump", false);
        //                     bot.setControlState("forward", false);
        //                     bot.setControlState("back", false);
        //                     bot.setControlState("left", false);
        //                     bot.setControlState("right", false);
        //                     bot.setControlState("sprint", false);
        //                 break;
        //             }*/
        //     }
        // });

        bot.on("physicsTick", () => {
            let target = bot.nearestEntity();
            if (this.jumpTarget) {
                //console.log(jumpTargets);
                if (
                    /*dist3d(bot.entity.position.x, bot.entity.position.y, bot.entity.position.z, jumpTarget.x, jumpTarget.y, jumpTarget.z) < 0.5 || */ bot
                        .entity.onGround
                ) {
                    /*jumpTargets.splice(jumpTargets.length - 1, 1);
                        if (jumpTargets.length > 0) {
                            jumpTarget = jumpTargets[jumpTargets.length - 1];
                        } else {
                            jumpTarget = false;
                            bot.setControlState("forward", false);
                            bot.setControlState("sprint", false);
                            bot.setControlState("jump", false);
                        }*/
                    if (this.movesToGo[this.lastPos.currentMove]) {
                        for (let i = 0; i < this.movesToGo.length; i++) {
                            if (
                                dist3d(
                                    bot.entity.position.x,
                                    bot.entity.position.y,
                                    bot.entity.position.z,
                                    this.movesToGo[i].x,
                                    this.movesToGo[i].y,
                                    this.movesToGo[i].z
                                ) <
                                dist3d(
                                    bot.entity.position.x,
                                    bot.entity.position.y,
                                    bot.entity.position.z,
                                    this.movesToGo[this.lastPos.currentMove].x,
                                    this.movesToGo[this.lastPos.currentMove].y,
                                    this.movesToGo[this.lastPos.currentMove].z
                                )
                            ) {
                                this.lastPos.currentMove = i;
                            }
                        }
                        this.movesToGo.splice(this.lastPos.currentMove + 1, this.movesToGo.length);
                    }
                    console.log(this.lastPos.currentMove);
                    this.jumpTarget = false;
                    this.jumpTargets = [];
                    this.myStates = [];
                    let shouldJumpSprintOnPath = true;
                    if (this.lastPos.currentMove > -1 && this.movesToGo.length > 0 && this.movesToGo[this.lastPos.currentMove]) {
                        for (let i = this.lastPos.currentMove + 1 - 1; i > this.lastPos.currentMove - 6 && i > 0; i--) {
                            //console.log(movesToGo[i].blockActions + ", " + movesToGo[i].blockDestructions);
                            if (this.movesToGo[i].blockActions.length > 0 || this.movesToGo[i].blockDestructions.length > 0) {
                                shouldJumpSprintOnPath = false;
                            }
                        }
                        if (shouldJumpSprintOnPath && this.lastPos.currentMove > -1) {
                            this.jumpSprintOnMoves(new PlayerState(bot, this.simControl), 2);
                        }
                    }
                }
                if (this.jumpTarget && target) {
                    bot.setControlState("forward", true);
                    bot.setControlState("sprint", true);
                    bot.setControlState("jump", true);
                    bot.lookAt(new Vec3(this.jumpTarget.x, /*jumpTarget.y*/ target.position.y + 1.6, this.jumpTarget.z), true);
                }
            }
        });
    }

    run() {
        if (this.botIsDigging > 0) {
            this.botIsDigging--;
        }
        if (this.botMove.lastTimer > -10) {
            this.botMove.lastTimer--;
        }
        this.bot.updateHeldItem();
        /*botShiftTimer--;
        if (botShiftTimer > 0) {
            bot.physics.playerHalfWidth = 0.300;
        } else if (botShiftTimer <= 0) {
            bot.physics.playerHalfWidth = 0.302;
        }
        if (botShiftTimer <= -1) {
            botShiftTimer = 2;
        }*/
        for (let i = 0; i < this.botActions.equipPackets.length; i++) {
            this.botActions.equipPackets[i].time--;
            if (this.botActions.equipPackets[i].time < 0) {
                this.botActions.equipPackets.splice(i, 1);
                continue;
            }
        }
        // this.holdWeapon = true;
        (this.bot.physics as any).waterInertia = 0.8;
        (this.bot.physics as any).waterGravity = 0.005;
        const block = this.bot.blockAt(
            new Vec3(Math.floor(this.bot.entity.position.x), Math.floor(this.bot.entity.position.y), Math.floor(this.bot.entity.position.z))
        );
        const blockPlusOneY = this.bot.blockAt(
            new Vec3(
                Math.floor(this.bot.entity.position.x),
                Math.floor(this.bot.entity.position.y + 1),
                Math.floor(this.bot.entity.position.z)
            )
        );
        if (
            (this.blockInfo.getBlockInfo(block!, TypeCheck.WATER) && this.blockInfo.getBlockInfo(blockPlusOneY!, TypeCheck.WATER)) ||
            (this.swimmingFast && this.pathfinderOptions.sprint && this.shouldSwimFast)
        ) {
            this.swimmingFast = true;
            (this.bot.physics as any).waterInertia = 0.9;
            (this.bot.physics as any).waterGravity = 0.001;
        }
        this.shouldSwimFast = true;
        if (!this.bot.entity.onGround) {
            this.botGrounded = 1;
        }
        if (this.bot.entity.onGround) {
            this.botGrounded--;
        }
        if (this.botDigCTimer > -10) {
            this.botDigCTimer--;
        }
        if (this.jumpTimer > -10) {
            this.jumpTimer--;
        }
        if (this.botDigDelay > 0) {
            this.botDigDelay--;
        }
        if (this.bot.targetDigBlock) {
            this.botDigDelay = 2;
        }
        if (this.lookAtNextDelay > 0) {
            this.lookAtNextDelay--;
        }
        this.attackTimer += 0.05;
        //console.log(huntMode);
        if (this.botSearchingPath > -100) {
            this.botSearchingPath--;
        }
        if (this.botPathfindTimer < 1000 && this.botSearchingPath > 0) {
            this.botPathfindTimer++;
        } else if (this.botSearchingPath > 0) {
            this.botPathfindTimer = 0;
        }

        //Follow the target by extending the path if in hunt mode.
        if (((this.huntTrackTimer >= 0 && this.onPath) || this.movesToGo.length == 0) && this.huntTarget) {
            //console.log("TWEET TWEET TWEET");
            this.huntTrackTimer--;
            if (
                this.huntTrackTimer < 0 &&
                this.botSearchingPath < 0 /*&&
                dist3d(lastHuntTargetPos.x, lastHuntTargetPos.y, lastHuntTargetPos.z,
                Math.floor(this.huntTarget.entity.position.x), Math.round(this.huntTarget.entity.position.y), Math.floor(this.huntTarget.entity.position.z)) >= Math.sqrt(30) |
                dist3d(bot.entity.position.x, bot.entity.position.y, bot.entity.position.z,
                       huntTarget.entity.position.x, huntTarget.entity.position.y, huntTarget.entity.position.z) <= Math.sqrt(100)*/
            ) {
                this.huntTrackTimer = 20;
                if (
                    dist3d(
                        this.bot.entity.position.x,
                        this.bot.entity.position.y,
                        this.bot.entity.position.z,
                        this.huntTarget.entity.position.x,
                        this.huntTarget.entity.position.y,
                        this.huntTarget.entity.position.z
                    ) <= Math.sqrt(30)
                ) {
                    this.huntTrackTimer = 5;
                    console.log("turbo");
                }
                this.lastHuntTargetPos = {
                    x: Math.floor(this.huntTarget.entity.position.x),
                    y: Math.round(this.huntTarget.entity.position.y),
                    z: Math.floor(this.huntTarget.entity.position.z),
                };
                this.botGoal = {
                    x: Math.floor(this.huntTarget.entity.position.x),
                    y: Math.round(this.huntTarget.entity.position.y),
                    z: Math.floor(this.huntTarget.entity.position.z),
                    reached: this.botGoal.reached,
                };
                this.findPath(
                    Math.floor(this.huntTarget.entity.position.x),
                    Math.round(this.huntTarget.entity.position.y),
                    Math.floor(this.huntTarget.entity.position.z),
                    false,
                    true
                );
            }
        }

        //extend the path when near the end of a path that hasn't reached the goal yet due to chunk borders
  
        if (!this.movesToGo[0]) {
        } else if (this.movesToGo[0] &&
            (!this.huntTarget &&
                this.botSearchingPath <= 0 &&
                !this.botGoal.reached &&
                this.movesToGo.length > 0 &&
                this.movesToGo.length <= 10 &&
               
                this.movesToGo[0].x != this.botGoal.x) ||
            (this.movesToGo[0].y != this.botGoal.y && this.botGoal.y != "no") ||
            this.movesToGo[0].z != this.botGoal.z
        ) {
            console.log("Extending path through chunks...");
            if (this.botGoal.y != "no") {
                this.findPath(
                    Math.floor(this.botGoal.x),
                    Math.round(this.botGoal.y as number),
                    Math.floor(this.botGoal.z as number),
                    false,
                    true
                ); //Extending path here. "moveType" is not defined, line 1471
            } else {
                this.findPath(Math.floor(this.botGoal.x), "no", Math.floor(this.botGoal.z as number), false, true); //Extending path here. "moveType" is not defined, line 1471
            }
        } else if (this.movesToGo.length > 0 && this.movesToGo.length <= 10) {
            //console.log("searching: " + botSearchingPath + ", botGoal: " + JSON.stringify(botGoal) + ", movesToGo: " + movesToGo.length + ", movesToGo[0]: " + JSON.stringify(movesToGo[0]));
        }
        /*
        bb = new AABB(-0.4, 0, -0.4, 0.4, 1.8, 0.4).offset(bot.entity.position.x, bot.entity.position.y, bot.entity.position.z);
        bb.expand(5, 5, 5);
        bb.minY = bot.entity.position.y - 5;
        bb.maxY = bot.entity.position.y + 5;
        if (bb.minY < 0) {bb.minY = 0;}
        if (bb.maxY < 0) {bb.maxY = 0;}
        console.log(bb);
        //surroundingBlocks = getSurroundingBBs(bot, bb);
        if (surroundingBlocks[Math.floor(bot.entity.position.y)][Math.floor(bot.entity.position.z + 1)][Math.floor(bot.entity.position.x)].block != 0) {
            bot.setControlState("jump", true);
            bot.setControlState("jump", false);
            console.log(surroundingBlocks[Math.floor(bot.entity.position.y)][Math.floor(bot.entity.position.z + 1)][Math.floor(bot.entity.position.x)]);
        }*/
        // let target = this.bot.nearestEntity();
        // if (target) {
        //     //bot.setControlState("forward", true);
        //     //bot.lookAt(target.position.offset(0, 1.6, 0));
        // }

        //bot.setControlState("forward", false);
        //bot.setControlState("back", false);
        //bot.setControlState("sprint", false);
        //bot.setControlState("left", false);
        //bot.setControlState("right", false);
        (this.botMove.isGrounded = this.botMove.isGrounded), (this.botMove.faceBackwards = this.botMove.faceBackwards - 1);
        this.botMove.mlg = this.botMove.mlg - 1;
        this.botMove.bucketTimer = this.botMove.bucketTimer - 1;
        this.botMove.bucketTarget = this.botMove.bucketTarget;
        this.botMove.lastTimer = this.botMove.lastTimer;

        if (this.botMove.mlg < -100) {
            this.botMove.mlg = -100;
        }
        if (this.botMove.bucketTimer < -100) {
            this.botMove.bucketTimer = -100;
        }
        if (this.botMove.faceBackwards < -100) {
            this.botMove.faceBackwards = -100;
        }
        let botSpeed = Math.sqrt(
            this.bot.entity.velocity.x * this.bot.entity.velocity.x + this.bot.entity.velocity.z * this.bot.entity.velocity.z
        );
        if (this.bot.entity.velocity.y < -0.3518) {
            //console.log("uh oh! " + bot.entity.velocity.y);
            let clutchCanidates: any[] = [false, false, false, false];
            let safeBlockCount = 0;
            let myClutchCanidate: any = false;
            for (let i = 0; i < 21; i++) {
                if (Math.floor(this.bot.entity.position.y) - i <= 0) {
                    i = 21;
                    break;
                }

                for (let j = 0; j < 4; j++) {
                    const flip = 0 < j && j < 3;
                    const tempBlock = this.bot.blockAt(
                        new Vec3(
                            Math.floor(this.bot.entity.position.x + (flip ? 0.3001 : -0.3001)),
                            Math.floor(this.bot.entity.position.y) - i,
                            Math.floor(this.bot.entity.position.z + (flip ? -0.3001 : +0.3001))
                        )
                    );

                    if (!clutchCanidates[j] && !this.blockInfo.getBlockInfo(tempBlock!, TypeCheck.AIR)) {
                    }
                    clutchCanidates[j] = tempBlock;
                }
            }
            for (let i = 0; i < clutchCanidates.length; i++) {
                if (!clutchCanidates[i]) {
                    continue;
                } else {
                    if (this.blockInfo.getBlockInfo(clutchCanidates[i], TypeCheck.WATER)) {
                        safeBlockCount++;
                    }
                    if (
                        !myClutchCanidate ||
                        (myClutchCanidate && clutchCanidates[i].position.y > myClutchCanidate.position.y) ||
                        (myClutchCanidate &&
                            myClutchCanidate == myClutchCanidate?.position?.y &&
                            this.blockInfo.getBlockInfo(clutchCanidates[i], TypeCheck.WATER))
                    ) {
                        myClutchCanidate = clutchCanidates[i];
                    }
                }
            }
            if (
                !myClutchCanidate &&
                (!this.onPath ||
                    (this.movesToGo[this.lastPos.currentMove] && Math.abs(this.movesToGo[this.lastPos.currentMove].y - this.lastPos.y) > 3))
            ) {
                this.bot.look(this.bot.entity.yaw, 0, true);
            } else if (
                this.bot.entity.velocity.y <= -0.5518 &&
                myClutchCanidate &&
                safeBlockCount < 4 &&
                this.blockInfo.getBlockInfo(myClutchCanidate as Block, TypeCheck.WATER) &&
                // !blockWater(bot, myClutchCanidate.position.x, myClutchCanidate.position.y, myClutchCanidate.position.z) &&
                (!this.onPath ||
                    (this.movesToGo[this.lastPos.currentMove] && Math.abs(this.movesToGo[this.lastPos.currentMove].y - this.lastPos.y) > 3))
            ) {
                this.botMove.mlg = 4;
                console.log("saving myself...");
                this.botActions.equipItemByName("water_bucket", "hand");
                //console.log(bot.heldItem);
                this.botMove.bucketTarget = {
                    x: myClutchCanidate.position.x + 0.5,
                    y: myClutchCanidate.position.y,
                    z: myClutchCanidate.position.z + 0.5,
                };
                let canLookStraightDown = true;
                for (let i = 0; i < clutchCanidates.length; i++) {
                    if (clutchCanidates[i].y != this.botMove.bucketTarget.y) {
                        canLookStraightDown = false;
                    }
                }
                if (canLookStraightDown) {
                    this.botMove.bucketTarget.x = this.bot.entity.position.x;
                    this.botMove.bucketTarget.z = this.bot.entity.position.z;
                }
                this.bot.lookAt(
                    new Vec3(this.botMove.bucketTarget.x, this.botMove.bucketTarget.y, this.botMove.bucketTarget.z),
                    true,
                    () => {
                        let leBlockAtCursor = this.bot.blockAtCursor(5);
                        if (
                            this.bot.entity.velocity.y <= -0.6518 &&
                            this.botMove.bucketTimer <= 0 &&
                            leBlockAtCursor &&
                            leBlockAtCursor.position.x == myClutchCanidate.position.x &&
                            leBlockAtCursor.position.y == myClutchCanidate.position.y &&
                            leBlockAtCursor.position.z == myClutchCanidate.position.z &&
                            Math.abs(myClutchCanidate.position.y - this.bot.entity.position.y) <= 5 &&
                            this.botMove.bucketTimer <= 0 &&
                            this.bot.heldItem &&
                            this.bot.heldItem.name == "water_bucket"
                        ) {
                            this.botMove.bucketTimer = 5;
                            this.bot.activateItem(false);
                        }
                    }
                );
            } else {
                //console.log("AHHHHHH!!!! " + JSON.stringify(clutchCanidates) + ", " + myClutchCanidate);
            }
        }
        if (
            this.bot.entity.velocity.y <= -0.5518 &&
            (this.botMove.mlg > 0 || this.botMove.bucketTimer > 0) &&
            (!this.onPath ||
                (this.movesToGo[this.lastPos.currentMove] && Math.abs(this.movesToGo[this.lastPos.currentMove].y - this.lastPos.y) > 3))
        ) {
            this.bot.lookAt(new Vec3(this.botMove.bucketTarget.x, this.botMove.bucketTarget.y, this.botMove.bucketTarget.z), true);
        }
        if (this.botMove.mlg <= 0 && this.botMove.bucketTimer <= 0 && this.bot.heldItem && this.bot.heldItem.name == "bucket") {
            let waterBlock = this.bot.findBlock({
                matching: (block) => block.stateId === 34, //thank you u9g
                maxDistance: 5,
            });
            if (waterBlock) {
                console.log(JSON.stringify(waterBlock));
                this.botMove.bucketTimer = 5;
                this.botMove.bucketTarget.x = waterBlock.position.x + 0.5;
                this.botMove.bucketTarget.y = waterBlock.position.y + 0.5;
                this.botMove.bucketTarget.z = waterBlock.position.z + 0.5;
                this.bot.lookAt(new Vec3(this.botMove.bucketTarget.x, this.botMove.bucketTarget.y, this.botMove.bucketTarget.z), true);
                this.bot.activateItem(false);
                console.log("Getting the water bucket back");
            }
        }
        if (this.movesToGo.length > 0 && this.lastPos.currentMove >= 0) {
            let myMove = this.movesToGo[this.lastPos.currentMove];
            this.debugTimer++;
            if (this.debugTimer > 30) {
                //if (!onPath) {
                //console.log("ERROR: Off the path!");
                //bot.chat("/tp @s " + lastPos.x + " " + lastPos.y + " " + lastPos.z);
                //}
                this.debugTimer = 0;
                //console.log(JSON.stringify(lastPos) + "\n" + "\n" + JSON.stringify(movesToGo));
                for (let i = 0; i < this.movesToGo.length; i++) {
                    //bot.chat("/particle flame " + movesToGo[i].x + " " + movesToGo[i].y + " " + movesToGo[i].z);
                }
            }
            //console.log("e" + movesToGo.length + ", " + lastPos.currentMove);
            //bot.chat("/particle damage_indicator " + movesToGo[lastPos.currentMove].x + " " + movesToGo[lastPos.currentMove].y + " " + movesToGo[lastPos.currentMove].z);
            //bot.chat("/particle heart " + lastPos.x + " " + lastPos.y + " " + lastPos.z);
            let goalBox = { x: myMove.x, y: myMove.y, z: myMove.z, w: 1, h: 2, d: 1 };
            let onPathBoxes: any[] = [];
            if (Math.floor(this.lastPos.y) == myMove.y) {
                onPathBoxes = [{ x: this.lastPos.x, y: this.lastPos.y, z: this.lastPos.z, w: 1, h: 2, d: 1 }];
                let myX = Math.floor(this.lastPos.x);
                let myZ = Math.floor(this.lastPos.z);
                let checkerCount = 0;
                while ((myX != myMove.x || myZ != myMove.z) && checkerCount < 5) {
                    checkerCount++;
                    if (myX < myMove.x) {
                        myX++;
                    } else if (myX > myMove.x) {
                        myX--;
                    }
                    if (myZ < myMove.z) {
                        myZ++;
                    } else if (myZ > myMove.z) {
                        myZ--;
                    }
                    onPathBoxes.push({ x: myX, y: myMove.y, z: myZ, w: 1, h: 2, d: 1 });
                }
            } else if (myMove.y < this.lastPos.y) {
                if (myMove.x == this.lastPos.x && myMove.z == this.lastPos.z) {
                    goalBox = { x: myMove.x, y: myMove.y - 1, z: myMove.z, w: 1, h: 2, d: 1 };
                }
                onPathBoxes = [
                    { x: this.lastPos.x, y: this.lastPos.y, z: this.lastPos.z, w: 1, h: 2, d: 1 },
                    { x: myMove.x, y: myMove.y, z: myMove.z, w: 1, h: this.lastPos.y - myMove.y + 2, d: 1 },
                ];
                let myX = Math.floor(this.lastPos.x);
                let myZ = Math.floor(this.lastPos.z);
                let checkerCount = 0;
                while ((myX != myMove.x || myZ != myMove.z) && checkerCount < 5) {
                    checkerCount++;
                    if (myX < myMove.x) {
                        myX++;
                    } else if (myX > myMove.x) {
                        myX--;
                    }
                    if (myZ < myMove.z) {
                        myZ++;
                    } else if (myZ > myMove.z) {
                        myZ--;
                    }
                    onPathBoxes.push({ x: myX, y: myMove.y - 0.5, z: myZ, w: 1, h: 3, d: 1 });
                }
            } else if (myMove.y > this.lastPos.y) {
                onPathBoxes = [
                    { x: Math.floor(this.lastPos.x), y: Math.floor(this.lastPos.y), z: Math.floor(this.lastPos.z), w: 1, h: 3, d: 1 },
                    //{"x":myMove.x, "y":myMove.y, "z":myMove.z, "w":1, "h":2,"d":1},
                ];
                let myX = Math.floor(this.lastPos.x);
                let myZ = Math.floor(this.lastPos.z);
                let checkerCount = 0;
                while ((myX != myMove.x || myZ != myMove.z) && checkerCount < 5) {
                    checkerCount++;
                    if (myX < myMove.x) {
                        myX++;
                    } else if (myX > myMove.x) {
                        myX--;
                    }
                    if (myZ < myMove.z) {
                        myZ++;
                    } else if (myZ > myMove.z) {
                        myZ--;
                    }
                    onPathBoxes.push({ x: myX, y: myMove.y - 0.0, z: myZ, w: 1, h: 2.0, d: 1 });
                }
            }
            if (isSwim(myMove.mType)) {
                for (let i = 0; i < onPathBoxes.length; i++) {
                    onPathBoxes[i].y -= 0.5;
                    onPathBoxes[i].h += 1;
                }
                goalBox.y -= 0.5;
                goalBox.h += 1;
            }
            //onPathBoxes.push({"x":movesToGo[movesToGo.length - 1].x - 0.5, "y":movesToGo[movesToGo.length - 1].y - 0.5, "z":movesToGo[movesToGo.length - 1].z - 0.5, "w":2, "h":3, "d":2});

            this.onPath = false;
            for (let i = 0; i < onPathBoxes.length; i++) {
                let e = onPathBoxes[i];
                if (
                    this.bot.entity.position.x + 0.52 > e.x &&
                    this.bot.entity.position.x - 0.52 < e.x + e.w &&
                    this.bot.entity.position.y - 1 < e.y + e.h + 0.2 &&
                    this.bot.entity.position.y + 1 >= e.y &&
                    this.bot.entity.position.z + 0.52 > e.z &&
                    this.bot.entity.position.z - 0.52 < e.z + e.d
                ) {
                    this.onPath = true;
                    //console.log(JSON.stringify(onPathBoxes[i]));
                }
            }
            if (this.jumpTarget) {
                this.botDestinationTimer++;
                this.onPath = true;
            }
            this.botDestinationTimer--;
            if (this.botDestinationTimer < 0) {
                this.onPath = false;
            }
            if (!this.onPath) {
                console.log("GET BACK IN FORMATION SOLDIER");
                if (
                    this.bot.entity.onGround ||
                    this.bot.entity.isInWater ||
                    (this.bot.entity.isInLava && this.movesToGo.length > 0 && this.botSearchingPath < 0)
                ) {
                    this.findPath(this.movesToGo[0].x, this.movesToGo[0].y, this.movesToGo[0].z, true);
                }
            }

            let myAngle = Math.atan2(myMove.x - this.lastPos.x, this.lastPos.z - myMove.z);
            let myWalkAngle = Math.atan2(myMove.x - this.bot.entity.position.x + 0.5, this.bot.entity.position.z - 0.5 - myMove.z);
            if (myWalkAngle < myAngle - Math.PI) {
                myWalkAngle += Math.PI * 2;
                //console.log("fixed positive");
            } else if (myWalkAngle > myAngle + Math.PI) {
                myWalkAngle -= Math.PI * 2;
                //console.log("fixed negative");
            }

            //Executing the path
            if (true) {
                this.botMove.forward = true;
                this.botMove.sprint = this.pathfinderOptions.sprint;
                if (this.bot.targetDigBlock) {
                    this.botMove.forward = false;
                }
            }

            let jumpDir = { x: Math.floor(this.lastPos.x) > myMove.x ? -1 : 1, z: Math.floor(this.lastPos.z) > myMove.z ? -1 : 1 };
            if (this.lastPos.x == myMove.x) {
                jumpDir.x = 0;
            }
            if (this.lastPos.z == myMove.z) {
                jumpDir.z = 0;
            }
            //console.log(myMove);
            //console.log(bot.blockAt(new Vec3(Math.floor(myMove.x), Math.floor(myMove.y), Math.floor(myMove.z))).type);
            //console.log(blockWater(bot, Math.floor(myMove.x), Math.floor(myMove.y), Math.floor(myMove.z)));
            //stuff here(!!!)
            this.busyBuilding = false;
            this.takeCareOfBlock(myMove);
            /*if (!busyBuilding && movesToGo[lastPos.currentMove - 1]) {
                console.log("WE DOING IT");
                takeCareOfBlock(movesToGo[lastPos.currentMove - 1]);
                if (!busyBuilding && movesToGo[lastPos.currentMove - 2]) {
                    console.log("WE DOING IT AGAIN");
                    takeCareOfBlock(movesToGo[lastPos.currentMove - 2]);
                }
            }*/
            if (myMove.mType == "goUp") {
                //bruh bruh

                const lavaCheckY0 = this.blockInfo.getBlockInfo(
                    this.bot.blockAt(new Vec3(this.lastPos.x, this.lastPos.y, this.lastPos.z))!,
                    TypeCheck.LAVA
                );
                const waterCheckY0 = this.blockInfo.getBlockInfo(
                    this.bot.blockAt(new Vec3(this.lastPos.x, this.lastPos.y, this.lastPos.z))!,
                    TypeCheck.WATER
                );
                const lavaCheckY1 = this.blockInfo.getBlockInfo(
                    this.bot.blockAt(new Vec3(this.lastPos.x, this.lastPos.y + 1, this.lastPos.z))!,
                    TypeCheck.LAVA
                );
                const waterCheckY1 = this.blockInfo.getBlockInfo(
                    this.bot.blockAt(new Vec3(this.lastPos.x, this.lastPos.y + 1, this.lastPos.z))!,
                    TypeCheck.WATER
                );
                if (this.bot.entity.position.y <= myMove.y - 0.25 || lavaCheckY0 || lavaCheckY1 || waterCheckY0 || waterCheckY1) {
                    if (!lavaCheckY0 && !lavaCheckY1) {
                        this.botMove.jump = true;
                    } else if (
                        this.bot.entity.velocity.y < 1.0 &&
                        Math.floor(this.bot.entity.position.x) == this.lastPos.x &&
                        Math.floor(this.bot.entity.position.z) == this.lastPos.z &&
                        ((Math.floor(this.bot.entity.position.y) == this.lastPos.y && lavaCheckY0) ||
                            (Math.floor(this.bot.entity.position.y) == this.lastPos.y + 1 && lavaCheckY1))
                    ) {
                        this.bot.entity.velocity.y += 0.1;
                        console.log("EEEEEEE");
                        this.botMove.jump = true;
                    }
                }
                this.botMove.sprint = false;
                //if (dist3d(bot.entity.position.x, 0, bot.entity.position.z, myMove.x + 0.5, 0, myMove.z + 0.5) <= Math.sqrt(0.25)) {botMove.forward = false;}
            } else if (
                ((myMove.mType == "walk" && dist3d(this.lastPos.x, 0, this.lastPos.z, myMove.x, 0, myMove.z) > Math.sqrt(3)) ||
                    (myMove.mType == "walkDiag" && dist3d(this.lastPos.x, 0, this.lastPos.z, myMove.x, 0, myMove.z) > Math.sqrt(3)) ||
                    myMove.mType == "walkJump" ||
                    myMove.mType == "walkDiagJump") &&
                /*dist3d(lastPos.x, 0, lastPos.z, myMove.x, 0, myMove.z) > Math.sqrt(3) &&*/ dist3d(
                    this.lastPos.x,
                    0,
                    this.lastPos.z,
                    myMove.x,
                    0,
                    myMove.z
                ) < Math.sqrt(32)
            ) {
                if (myMove.mType == "walk" || myMove.mType == "walkDiag") {
                    console.log("you sure you should be jumping right now?");
                }
                //console.log("maybe" + (myMove.y >= lastPos.y & (Math.abs(myMove.x - lastPos.x) || Math.abs(myMove.z - lastPos.z))));
                if (
                    Math.abs(myMove.x - this.lastPos.x) == 1 ||
                    (Math.abs(myMove.z - this.lastPos.z) == 1 && myMove.y > this.lastPos.y) ||
                    (dist3d(this.bot.entity.position.x, 0, this.bot.entity.position.z, myMove.x + 0.5, 0, myMove.z + 0.5) > Math.sqrt(2) &&
                        jumpDir.x == 0) ||
                    (jumpDir.x > 0 && this.bot.entity.position.x >= this.lastPos.x + 0.5 + jumpDir.x * 0.2) ||
                    (jumpDir.x < 0 && this.bot.entity.position.x <= this.lastPos.x + 0.5 + jumpDir.x * 0.2 && jumpDir.z == 0) ||
                    (jumpDir.z > 0 && this.bot.entity.position.z >= this.lastPos.z + 0.5 + jumpDir.z * 0.2) ||
                    (jumpDir.z < 0 && this.bot.entity.position.z <= this.lastPos.z + 0.5 + jumpDir.z * 0.2)
                ) {
                    //console.log("parkour jump " + (myWalkAngle - myAngle));
                    let shouldStrafeCorrect = true;
                    for (let i = this.lastPos.currentMove; i > this.lastPos.currentMove - 5 && i > 0; i--) {
                        if (!this.movesToGo[i + 1] || (this.movesToGo[i + 1] && this.movesToGo[i].y <= this.movesToGo[i + 1].y)) {
                            shouldStrafeCorrect = false;
                        }
                    }
                    if (
                        shouldStrafeCorrect &&
                        (myMove.y <= this.lastPos.y ||
                            Math.abs(myWalkAngle - myAngle) < 0.45 ||
                            Math.abs(myMove.x - this.lastPos.x) >= 2 ||
                            Math.abs(myMove.z - this.lastPos.z) >= 2) &&
                        this.bot.entity.position.y < myMove.y - 0.2
                    ) {
                        //qwerty
                        if (myMove.y > this.lastPos.y && myWalkAngle - myAngle > 0.25) {
                            console.log("R");
                            this.botMove.right = true;
                        } else if (myMove.y > this.lastPos.y && myWalkAngle - myAngle < -0.25) {
                            console.log("L");
                            this.botMove.left = true;
                        }
                    }
                    if (this.botMove.lastTimer < 0 && this.botMove.isGrounded) {
                        // >= 0
                        this.botMove.jump = true;
                    }
                    if (
                        myMove.y > this.lastPos.y ||
                        (dist3d(this.lastPos.x, 0, this.lastPos.z, myMove.x, 0, myMove.z) >= Math.sqrt(16) &&
                            this.bot.entity.position.y <= this.lastPos.y + 1.05)
                    ) {
                        //bot.entity.velocity.x = Math.sin(myWalkAngle) * 0.22;
                        //bot.entity.velocity.z = -Math.cos(myWalkAngle) * 0.22;
                        //if (myMove.y > lastPos.y) {bot.entity.velocity.y = 0.35;}
                    }
                    botSpeed = Math.sqrt(
                        this.bot.entity.velocity.x * this.bot.entity.velocity.x + this.bot.entity.velocity.z * this.bot.entity.velocity.z
                    );
                } else if (
                    dist3d(this.bot.entity.position.x, 0, this.bot.entity.position.z, myMove.x + 0.5, 0, myMove.z + 0.5) < Math.sqrt(6) &&
                    dist3d(this.lastPos.x, 0, this.lastPos.z, myMove.x, 0, myMove.z) <= Math.sqrt(9) &&
                    this.blockInfo.getBlockInfo(this.bot.blockAt(new Vec3(myMove.x, myMove.y, myMove.z))!, TypeCheck.AIR) &&
                    myMove.y <= this.lastPos.y &&
                    (Math.abs(myMove.x - this.lastPos.x) >= 3 || Math.abs(myMove.z - this.lastPos.z) >= 3 || myMove.y == this.lastPos.y)
                ) {
                    //This is a fall
                    this.botMove.sprint = false;
                } else if (
                    (myMove.y <= this.lastPos.y &&
                        dist3d(this.bot.entity.position.x, 0, this.bot.entity.position.z, myMove.x + 0.5, 0, myMove.z + 0.5) <=
                            Math.sqrt(0.5) &&
                        myMove.x == this.lastPos.z &&
                        myMove.z == this.lastPos.z) ||
                    myMove.y <
                        this.lastPos
                            .y /*&& dist3d(bot.entity.position.x, 0, bot.entity.position.z, myMove.x + 0.5, 0, myMove.z + 0.5) <= Math.sqrt(0.5)*/
                ) {
                    //straight up or straight down
                    this.botMove.sprint = false;
                }
                let lastPosIsLegit = false;
                let lastPosSameDir = true;
                if (this.movesToGo[this.lastPos.currentMove - 1]) {
                    lastPosIsLegit = true;
                    if (
                        this.movesToGo[this.lastPos.currentMove - 1].x - myMove.x != jumpDir.x ||
                        this.movesToGo[this.lastPos.currentMove - 1].z - myMove.z != jumpDir.z
                    ) {
                        lastPosSameDir = false;
                    }
                }
                if (
                    Math.abs(myMove.x - this.lastPos.x) == 2 ||
                    Math.abs(myMove.z - this.lastPos.z) == 2 /* && !lastPosIsLegit | !lastPosSameDir*/
                ) {
                    //don't sprint on 1 block gaps
                    this.botMove.sprint = false;
                    //console.log("Slow down!");
                }
            } else if (myMove.mType == "swimSlow") {
                this.shouldSwimFast = false;
                this.botMove.forward = true;
                if (
                    this.bot.entity.position.y <
                        myMove.y + this.blockInfo.slabSwimTarget(this.bot.blockAt(new Vec3(myMove.x, myMove.y, myMove.z))!) ||
                    (this.bot.entity.position.y < myMove.y + 1.5 &&
                        !this.blockInfo.getBlockInfo(this.bot.blockAt(new Vec3(myMove.x, myMove.y + 1, myMove.z))!, TypeCheck.WATER))
                ) {
                    this.botMove.jump = true;
                } else if (
                    this.bot.entity.position.y >
                        myMove.y + 0.2 + this.blockInfo.slabSwimTarget(this.bot.blockAt(new Vec3(myMove.x, myMove.y, myMove.z))!) &&
                    this.blockInfo.getBlockInfo(this.bot.blockAt(new Vec3(myMove.x, myMove.y + 1, myMove.z))!, TypeCheck.WATER)
                ) {
                    this.botMove.sneak = true;
                    if (this.bot.entity.velocity.y > -1.0) {
                        this.bot.entity.velocity.y -= 0.01;
                    }
                }
            } else if (myMove.mType == "swimFast" || myMove.mType == "fallWater") {
                let block = this.bot.blockAt(new Vec3(myMove.x, myMove.y, myMove.z));
                if (
                    this.bot.entity.position.y > myMove.y + 0.3 + this.blockInfo.slabSwimTarget(block!) &&
                    this.bot.entity.velocity.y >
                        -1.0 /*&& bot.entity.velocity.y < (bot.entity.position.y - (movesToGo[lastPos.currentMove].y + 0.2)) / 2*/
                ) {
                    this.bot.entity.velocity.y -= 0.05;
                    //console.log("swimDown");
                } else if (
                    this.bot.entity.position.y < myMove.y + 0.1 + this.blockInfo.slabSwimTarget(block!) &&
                    this.bot.entity.velocity.y < 1.0
                ) {
                    this.bot.entity.velocity.y += 0.05;
                    //console.log("swimUp");
                }
                let myMoveDir = { x: myMove.x - this.lastPos.x, z: myMove.z - this.lastPos.z };

                block = this.bot.blockAt(new Vec3(myMove.x, myMove.y + 2, myMove.z));
                if (this.blockInfo.getBlockInfo(block!, TypeCheck.LILYPAD)) {
                    this.botActions.digBlock(block!);
                } else if (
                    this.blockInfo.getBlockInfo(
                        (block = this.bot.blockAt(new Vec3(myMove.x - myMoveDir.x, myMove.y + 2, myMove.z))!),
                        TypeCheck.LILYPAD
                    )
                ) {
                    this.botActions.digBlock(block!);
                } else if (
                    this.blockInfo.getBlockInfo(
                        (block = this.bot.blockAt(new Vec3(myMove.x, myMove.y + 2, myMove.z - myMoveDir.z))!),
                        TypeCheck.LILYPAD
                    )
                ) {
                    this.botActions.digBlock(block!);
                }
            } else if (
                myMove.mType == "lava" &&
                this.bot.entity.position.y <
                    this.movesToGo[this.lastPos.currentMove].y +
                        this.blockInfo.slabSwimTarget(this.bot.blockAt(new Vec3(myMove.x, myMove.y, myMove.z))!)
            ) {
                this.botMove.jump = true;
            }
            if (this.bot.targetDigBlock) {
                this.botIsDigging = 2;
            }
            if (this.botIsDigging > 0 && !isSwim(myMove.mType)) {
                this.botMove.jump = false;
            }

            //if (lookAtNextDelay <= 0) {
            if (this.botMove.jump) {
                this.botMove.faceBackwards = -2;
            }
            if (this.botMove.mlg <= 0 && this.botMove.bucketTimer <= 0 && !this.jumpTarget) {
                if (this.botMove.faceBackwards <= 0) {
                    this.bot.lookAt(new Vec3(myMove.x + 0.5, this.botLookAtY, myMove.z + 0.5), true);
                } else {
                    this.botMove.forward = !this.botMove.forward;
                    this.botMove.back = !this.botMove.back;
                    this.bot.lookAt(
                        new Vec3(
                            this.bot.entity.position.x + (this.bot.entity.position.x - (this.movesToGo[this.lastPos.currentMove].x + 0.5)),
                            this.botLookAtY,
                            this.bot.entity.position.z + (this.bot.entity.position.z - (this.movesToGo[this.lastPos.currentMove].z + 0.5))
                        ),
                        true
                    );
                }
            }
            let lastPosSameAmount = true;
            if (this.movesToGo[this.lastPos.currentMove - 1]) {
                if (
                    Math.abs(this.movesToGo[this.lastPos.currentMove - 1].x - myMove.x) > 1 ||
                    Math.abs(this.movesToGo[this.lastPos.currentMove - 1].z - myMove.z) > 1 ||
                    this.movesToGo[this.lastPos.currentMove - 1].x - myMove.x > 0 != myMove.x - this.lastPos.x > 0 ||
                    this.movesToGo[this.lastPos.currentMove - 1].z - myMove.z > 0 != myMove.z - this.lastPos.z > 0 ||
                    this.movesToGo[this.lastPos.currentMove - 1].x - myMove.x < 0 != myMove.x - this.lastPos.x < 0 ||
                    this.movesToGo[this.lastPos.currentMove - 1].z - myMove.z < 0 != myMove.z - this.lastPos.z < 0
                ) {
                    lastPosSameAmount = false;
                }
            }
            if (
                /*Math.abs(myMove.x - lastPos.x) == 1 | Math.abs(myMove.x - lastPos.x) == 2 |
                    Math.abs(myMove.z - lastPos.z) == 1 | Math.abs(myMove.z - lastPos.z) == 2 &&*/
                lastPosSameAmount
            ) {
                //console.log("Speed up!");
            } else {
                lastPosSameAmount = false;
            }

            //path stuff
            if (
                myMove.mType == "start" ||
                (((this.blockInfo.getBlockInfo(this.bot.blockAt(new Vec3(myMove.x, myMove.y - 1, myMove.z))!) &&
                    this.bot.entity.onGround &&
                    myMove.mType != "goUp") ||
                    isSwim(myMove.mType) ||
                    (lastPosSameAmount && myMove.mType != "goUp") ||
                    (myMove.mType == "goUp" && this.bot.entity.onGround && this.bot.entity.position.y >= myMove.y - 0.25)) &&
                    this.bot.entity.position.x + 0.2 < goalBox.x + 1 &&
                    this.bot.entity.position.x - 0.2 > goalBox.x &&
                    this.bot.entity.position.y < goalBox.y + 2 &&
                    this.bot.entity.position.y + 2 >= goalBox.y &&
                    this.bot.entity.position.z + 0.2 < goalBox.z + 1 &&
                    this.bot.entity.position.z - 0.2 > goalBox.z)
            ) {
                this.lastPos = { currentMove: this.lastPos.currentMove - 1, x: myMove.x, y: myMove.y, z: myMove.z };
                this.botMove.jump = false;
                this.botMove.lastTimer = 1;
                if (this.lastPos.currentMove < this.movesToGo.length - 2) {
                    this.movesToGo.splice(this.lastPos.currentMove + 1, this.movesToGo.length);
                }
                this.botDestinationTimer = 30;
                //movesToGo.splice(movesToGo.length - 1, 1);
            }
        } else {
            this.onPath = false;
        }
        let target = this.bot.nearestEntity();
        if (
            this.botActions.equipPackets.length == 0 &&
            this.botActions.blockPackets.length == 0 &&
            !this.bot.targetDigBlock &&
            this.botObstructed <= 0 &&
            this.botEquipDefault &&
            !this.botIsDigging
        ) {
            this.botActions.equipAnyOfItems(["diamond_sword"]);
            //console.log("equip default " + onPath);
        }
        if (!this.bot.targetDigBlock) {
            this.botLookAtY = this.bot.entity.position.y + 1.6;
        }
        let shouldJumpSprintOnPath = true;
        for (let i = this.lastPos.currentMove + 1 - 1; i > this.lastPos.currentMove - 6 && i > 0; i--) {
            //console.log(movesToGo[i].blockActions + ", " + movesToGo[i].blockDestructions);
            if (this.movesToGo[i].blockActions.length > 0 || this.movesToGo[i].blockDestructions.length > 0) {
                shouldJumpSprintOnPath = false;
            }
        }
        if (shouldJumpSprintOnPath) {
            this.jumpSprintOnMoves(new PlayerState(this.bot, this.simControl), 2);
        }
        if ((this.botSearchingPath <= 0 || (this.onPath && this.movesToGo.length > 4)) && !this.jumpTarget) {
            this.bot.setControlState("jump", this.botMove.jump);
            this.bot.setControlState("forward", this.botMove.forward);
            this.bot.setControlState("back", this.botMove.back);
            this.bot.setControlState("left", this.botMove.left);
            this.bot.setControlState("right", this.botMove.right);
            this.bot.setControlState("sprint", this.botMove.sprint);
            this.bot.setControlState("sneak", this.botMove.sneak);
        } else if (!this.jumpTarget) {
            this.bot.clearControlStates();
        }
        //console.log(JSON.stringify(botMove) + ", " + botDestinationTimer);
        if (
            target &&
            this.attackTimer >= 0.5 &&
            !this.bot.targetDigBlock &&
            JSON.stringify(target.type) == '"player"' &&
            dist3d(
                this.bot.entity.position.x,
                this.bot.entity.position.y + 1.6,
                this.bot.entity.position.z,
                target.position.x,
                target.position.y + 1.6,
                target.position.z
            ) <= this.botRange
        ) {
            this.bot.attack(target);
            //console.log(target.position.y);
            //console.log(bot.entity.position.y);
            //bot.stopDigging();
            this.attackTimer = 0;
            this.botLookAtY = target.position.y + 1.6;
        }
    }

    blockAir(x: number, y: number, z: number) {
        return this.blockInfo.getBlockInfo(this.bot.blockAt(new Vec3(x, y, z))!, TypeCheck.AIR);
    }

    blockWater(x: number, y: number, z: number) {
        return this.blockInfo.getBlockInfo(this.bot.blockAt(new Vec3(x, y, z))!, TypeCheck.WATER);
    }

    blockCobweb(x: number, y: number, z: number) {
        return this.blockInfo.getBlockInfo(this.bot.blockAt(new Vec3(x, y, z))!, TypeCheck.COBWEB);
    }

    blockLava(x: number, y: number, z: number) {
        return this.blockInfo.getBlockInfo(this.bot.blockAt(new Vec3(x, y, z))!, TypeCheck.LAVA);
    }

    blockSolid(x: number, y: number, z: number) {
        return this.blockInfo.isBlockSolid(this.bot.blockAt(new Vec3(x, y, z))!);
    }

    blockWalk(x: number, y: number, z: number, parentNode?: DunderNode, waterAllowed?: boolean, lavaAllowed?: boolean) {
        return this.blockInfo.canWalkOnBlock(this.bot.blockAt(new Vec3(x, y, z))!, parentNode as any, [
            waterAllowed as any,
            lavaAllowed as any,
        ]);
    }

    blockStand(x: number, y: number, z: number) {
        return this.blockInfo.canStandOnBlock(this.bot.blockAt(new Vec3(x, y, z))!);
    }

    getDigTime(x: number, y: number, z: number, inWater: boolean, useTools: boolean) {
        return this.costInfo.getDigTime(this.bot.blockAt(new Vec3(x, y, z))!, inWater, useTools);
    }

    canDigBlock(x: number, y: number, z: number) {
        return this.blockInfo.canDigBlock(this.bot.blockAt(new Vec3(x, y, z))!);
    }

    equipTool(x: number, y: number, z: number) {
        return this.botActions.equipTool(this.bot.blockAt(new Vec3(x, y, z))!);
    }

    digBlock(x: number, y: number, z: number) {
        const tmp = this.bot.blockAt(new Vec3(x, y, z))
        this.botDestinationTimer = 30 + this.costInfo.getDigTime(tmp!, this.bot.entity.isInWater, true);
        return this.botActions.digBlock(tmp!);
    }

     breakAndPlaceBlock(x: number, y: number, z: number, checkStand?: boolean) {
        let myBlock = this.bot.blockAt(new Vec3(x, y, z));
        let shouldItBreak = false;
        if (myBlock && (myBlock.shapes.length == 0 || checkStand && myBlock.shapes.length != 0 && !this.blockInfo.canStandOnBlock(myBlock)) && myBlock.name != "air" && myBlock.name != "cave_air" && myBlock.name != "void_air" &&
            myBlock.name != "lava" && myBlock.name != "flowing_lava" && myBlock.name != "water" && myBlock.name != "flowing_water") {
            shouldItBreak = true;
        }
        return shouldItBreak;
    };


    // still have no clue what this does.
    isBlock(x: number, y: number, z: number, zeNode: DunderNode) {
        let myBlock = this.bot.blockAt(new Vec3(x, y, z))!;
        let walkThrough = 1;
        if (myBlock == undefined) {
            console.log(x + ", " + y + ", " + z + ", " + myBlock);
        }
        if (myBlock.type == 0) {
            walkThrough = 0;
        } else if (myBlock.displayName == "Lava" || myBlock.displayName == "Flowing_Lava") {
            walkThrough = 2;
        } else if (myBlock.displayName == "Water") {
            walkThrough = 3;
        } else if (myBlock.shapes.length == 0) {
            walkThrough = 0;
        }
        if (zeNode) {
            while (zeNode.parent) {
                for (let i = 0; i < zeNode.brokenBlocks.length; i++) {
                    if (zeNode.brokenBlocks[i][0] == x && zeNode.brokenBlocks[i][1] == y && zeNode.brokenBlocks[i][2] == z) {
                        walkThrough = 0;
                        i = zeNode.brokenBlocks.length;
                    } else {
                        continue;
                    }
                }
                zeNode = zeNode.parent;
            }
        }
        return walkThrough;
    }

    checkChunk(x: number, z: number) {
        var isTitle = false;
        if (this.chunkColumns[Math.floor(z / 16)] && this.chunkColumns[Math.floor(z / 16)][Math.floor(x / 16)]) {
            isTitle = true;
        }
        return isTitle;
    }

    pushHeap(obj: DunderNode) {
        //console.log(JSON.stringify(obj.blockActions));
        //if (bestNodeIndex != 0) {window.helpMeFixErrorPlease();}
        this.nodes.push(obj);
        //openNodes.push(0);
        //openNodes[openNodes.length - 1] = nodes[nodes.length - 1];
        this.openNodes.push(this.nodes[this.nodes.length - 1]);
        if (this.openNodes.length > 1) {
            let current = this.openNodes.length - 1;
            let parent = Math.floor((current - 1) / 2);
            while (
                current > 0 &&
                this.openNodes[parent].fCost + this.openNodes[parent].hCost > this.openNodes[current].fCost + this.openNodes[current].hCost
            ) {
                let storer = this.openNodes[current];
                this.openNodes[current] = this.openNodes[parent];
                this.openNodes[parent] = storer;
                //[openNodes[parent], openNodes[current]] = [openNodes[current], openNodes[parent]];
                //console.log("before: " + bestNodeIndex);
                //bestNodeIndex = parent;//This might cause issues if it is wrong
                //console.log("after: " + bestNodeIndex);
                current = parent;
                parent = Math.floor((current - 1) / 2);
            }
        }
        /*let leBestNode = openNodes[0];
        let leBestNodey = 0;
        for (let i = 0; i < openNodes.length; i++) {
            if (openNodes[i].fCost == undefined || i > 1 && (openNodes[i].fCost + openNodes[i].hCost) < (openNodes[Math.floor((i - 1) / 2)].fCost + openNodes[Math.floor((i - 1) / 2)].hCost)) {console.log("well, this is a problem: " + i);}
            if (openNodes[i].fCost + openNodes[i].hCost < leBestNode.fCost + leBestNode.hCost || !leBestNode.open) {
                leBestNode = openNodes[0];
                leBestNodey = i;
                bestNodeIndex = i;
            }
        }
        if (leBestNodey != 0) {
            console.log("PUSH: openNode length: " + openNodes.length + ", bestNodeIndex: " + leBestNodey);
        } else {
            console.log("BOOM: openNode length: " + openNodes.length + ", bestNodeIndex: " + leBestNodey);
        }
        if (bestNodeIndex != 0) {
            for (let i = 0; i < openNodes.length; i++) {console.log(i + " " + JSON.stringify(openNodes[i]) + "\n\n");}
        window.prettyPlease();}*/
    }

    popHeap(obj: any) {
        //openNodes[bestNodeIndex] = openNodes[openNodes.length - 1];
        this.openNodes.splice(0, 1);
        if (this.openNodes.length > 1) {
            this.openNodes.unshift(this.openNodes[this.openNodes.length - 1]);
            this.openNodes.splice(this.openNodes.length - 1, 1);
        }
        if (this.openNodes.length > 0) {
            let current = 0;
            let childLeft = current * 2 + 1;
            let childRight = current * 2 + 2;
            let keepGoing = true;
            while (keepGoing) {
                let currentScore = this.openNodes[current].fCost + this.openNodes[current].hCost;
                let childLeftScore = 9999999999;
                let childRightScore = 9999999999;
                if (this.openNodes.length - 1 >= childLeft) {
                    childLeftScore = this.openNodes[childLeft].fCost + this.openNodes[childLeft].hCost;
                }
                if (this.openNodes.length - 1 >= childRight) {
                    childRightScore = this.openNodes[childRight].fCost + this.openNodes[childRight].hCost;
                }
                if (childLeftScore < currentScore || childRightScore < currentScore) {
                    let swapMeWith = childLeft;
                    if (childLeftScore > childRightScore) {
                        swapMeWith = childRight;
                    }
                    let storer = this.openNodes[swapMeWith];
                    this.openNodes[swapMeWith] = this.openNodes[current];
                    this.openNodes[current] = storer;
                    current = swapMeWith;
                    childLeft = current * 2 + 1;
                    childRight = current * 2 + 2;
                } else {
                    keepGoing = false;
                }
            }
        }
        /*let leBestNode = openNodes[0];
        let leBestNodey = 0;
        for (let i = 0; i < openNodes.length; i++) {
            if (openNodes[i].fCost == undefined || i > 1 && (openNodes[i].fCost + openNodes[i].hCost) < (openNodes[Math.floor((i - 1) / 2)].fCost + openNodes[Math.floor((i - 1) / 2)].hCost)) {console.log("uh-oh spaghetti-o: " + i);}
            if (openNodes[i].fCost + openNodes[i].hCost < leBestNode.fCost + leBestNode.hCost) {
                leBestNode = openNodes[0];
                leBestNodey = i;
                bestNodeIndex = i;
            }
        }
        if (leBestNodey != 0) {
            console.log("POP: openNode length: " + openNodes.length + ", bestNodeIndex: " + leBestNodey);
        } else {
            console.log("yum: openNode length: " + openNodes.length + ", bestNodeIndex: " + leBestNodey);
        }
        if (JSON.stringify(obj) != JSON.stringify(oldBestNode)) {console.log("well thats a problem");}
        if (bestNodeIndex != 0) {window.prettyPlease();}*/
    }
    //END OF CODE BASED ON MINEFLAYER-PATHFINDER

    addNode(
        parent: DunderNode | undefined,
        fcost: number,
        hcost: number,
        x: number,
        y: number,
        z: number,
        moveType: string,
        brokenBlocks: any[],
        brokeBlocks: boolean,
        placedBlocks: boolean,
        elBlockActions: any[]
    ) {
        let parentFCost = fcost;
        if (parent) {
            parentFCost += parent.fCost;
        }
        //if (elBlockActions.length > 0) {console.log("Something is definitely not right");}
        this.pushHeap({
            parent: parent,
            fCost: parentFCost,
            hCost: hcost,
            x: x,
            y: y,
            z: z,
            open: true,
            moveType: moveType,
            brokenBlocks: brokenBlocks,
            brokeBlocks: brokeBlocks,
            placedBlocks: placedBlocks,
            blockActions: elBlockActions,
        });
        if (this.nodes3d[y] == undefined) {
            this.nodes3d[y] = [];
        }
        if (this.nodes3d[y][z] == undefined) {
            this.nodes3d[y][z] = [];
        }
        this.nodes3d[y][z][x] = this.nodes[this.nodes.length - 1];
        //bot.chat("/setblock " + x + " 10 " + z + " cobblestone");
        //bot.chat("fCost " + parentFCost);
    }
    validNode(node: DunderNode, x: number, y: number, z: number, endX: number, endY: number, endZ: number, type?: string) {
        let waterSwimCost = 4;
        let placeBlockCost = 20; //30
        let breakBlockCost = 0; //0.045
        breakBlockCost = 5 / 1000;
        //breakBlockCost = 0;
        let breakBlockCost2 = 10; //0.045
        if (this.botPathfindTimer > 20 * 4) {
            breakBlockCost = 1 / 1000;
            breakBlockCost2 = 0;
            placeBlockCost = 14;
            //console.log("way too long");
        } else if (this.botPathfindTimer > 20 * 2) {
            breakBlockCost = 3 / 1000;
            breakBlockCost2 = 0;
            placeBlockCost = 17;
            // console.log("too long");
        }
        if (y <= 60) {
            //breakBlockCost = 0.00035;
            //placeBlockCost = 20;
        } else if (y >= 90) {
            placeBlockCost = 3;
            //breakBlockCost = 20;
        }
        let ownerNodeUndefined = false;
        let myFCost = 0;
        let legalMove = false;
        let ughType = 0;
        let brokenBlocks = [];
        let brokeBlocks = false;
        let placedBlocks = false;
        let myBlockActions = [];
        let moveType = "walk";

        let myExplorer = node;
        let brokenBlocksInPast = 0;
        let placedBlocksInPast = 0;
        let exploreCount = 0;
        let pastConforms: { [name: string]: any } = {
            conforms: false,
            x0: 0,
            x1: 0,
            y0: 0,
            y1: 0,
            z0: 0,
            z1: 0,
        };

        let failed = false;

        if (Math.abs(node.x - x) == 1 && Math.abs(node.z - z) == 1 && node.y == y) {
            //DIAGNOL WALK
            moveType = "walkDiag";
            ughType = 1;
            myFCost = 14;
            if (
                (this.blockWalk(node.x, y, z) && this.blockAir(node.x, y + 1, z)) ||
                (this.blockWalk(x, y, node.z) &&
                    this.blockAir(x, y + 1, node.z) &&
                    this.blockWalk(x, y, z) &&
                    this.blockAir(x, y + 1, z) &&
                    this.blockStand(x, y - 1, z))
            ) {
                legalMove = true;
            }
            if (
                (legalMove && this.blockCobweb(node.x, y, z)) ||
                this.blockCobweb(node.x, y + 1, z) ||
                this.blockCobweb(x, y, node.z) ||
                this.blockCobweb(x, y + 1, node.z)
            ) {
                myFCost += 45;
                //console.log("Semi-Blocked move: " + x + ", " + y + ", " + z);
            }
            /*if (legalMove &&
            blockSolid(bot, node.x, y, z) | blockSolid(bot, node.x, y + 1, z) |
            blockSolid(bot, x, y, node.z) | blockSolid(bot, x, y + 1, node.z)) {
                //myFCost += 35;
                //console.log("Semi-Blocked move: " + x + ", " + y + ", " + z);
            }*/
            if (
                (legalMove && this.blockLava(node.x, y, z)) ||
                this.blockLava(node.x, y + 1, z) ||
                this.blockLava(x, y, node.z) ||
                this.blockLava(x, y + 1, node.z)
            ) {
                legalMove = false;
            }
            if (!legalMove) {
                //validNode(node, x, y + 1, z, endX, endY, endZ);
                let blockWaterCount = Number(this.blockWater(x, y, z)) + Number(this.blockWater(x, y + 1, z));
                let blockAirCount = Number(this.blockAir(x, y, z)) + Number(this.blockAir(x, y + 1, z));
                //console.log(blockWaterCount + " : " + blockAirCount);
                if (blockWaterCount == 2 || (blockWaterCount == 1 && blockAirCount == 1)) {
                    legalMove = true;
                    if (
                        /*!blockWater(bot, node.x, y, z) && !blockAir(bot, node.x, y, z) ||
                    !blockWater(bot, node.x, y + 1, z) && !blockAir(bot, node.x, y + 1, z) ||
                    !blockWater(bot, x, y, node.z) && !blockAir(bot, x, y, node.z) ||
                    !blockWater(bot, x, y + 1, node.z) && !blockAir(bot, x, y + 1, node.z)*/
                        this.blockSolid(x, y, node.z) ||
                        this.blockSolid(x, y + 1, node.z) ||
                        this.blockSolid(node.x, y, z) ||
                        this.blockSolid(node.x, y + 1, z)
                    ) {
                        legalMove = false;
                    } else if (
                        this.pathfinderOptions.sprint &&
                        (node.moveType == "swimFast" || (this.blockWater(x, y, z) && this.blockWater(x, y + 1, z)))
                    ) {
                        moveType = "swimFast";
                    } else {
                        moveType = "swimSlow";
                        myFCost += 5;
                        if (
                            this.blockSolid(x, y + 2, z) ||
                            this.blockSolid(node.x, y + 2, node.z) ||
                            this.blockSolid(node.x, y + 2, z) ||
                            this.blockSolid(x, y + 2, node.z)
                        ) {
                            myFCost += 35;
                        }
                        if (this.blockWater(x, y + 1, z)) {
                            myFCost *= 2;
                        }
                    }
                }
                if (!legalMove) {
                    let blockLavaCount = Number(this.blockLava(x, y, z)) + Number(this.blockLava(x, y + 1, z));
                    if (blockLavaCount == 2 || (blockLavaCount == 1 && blockAirCount == 1)) {
                        legalMove = true;
                        if (
                            (!this.blockLava(node.x, y, z) && !this.blockWalk(node.x, y, z)) ||
                            (!this.blockLava(node.x, y + 1, z) && !this.blockAir(node.x, y + 1, z)) ||
                            (!this.blockLava(x, y, node.z) && !this.blockWalk(x, y, node.z)) ||
                            (!this.blockLava(x, y + 1, node.z) && !this.blockAir(x, y + 1, node.z))
                        ) {
                            legalMove = false;
                        } else {
                            moveType = "lava";
                            if (node.moveType != "lava") {
                                myFCost += 1000;
                            } else {
                                myFCost += 20;
                            }
                        }
                    }
                }
                if (!this.blockSolid(x, y - 1, z) && !this.blockSolid(x, y, z)) {
                    this.validNode(node, x, y - 1, z, endX, endY, endZ);
                }
                if (this.pathfinderOptions.parkour && !legalMove && !this.blockStand(x, y - 1, z) && this.blockAir(x, y, z)) {
                    //JUMP DIAGNOL
                    moveType = "walkDiagJump";
                    //parkour move
                    let stepDir = { x: x - node.x, z: z - node.z };
                    if (this.blockAir(x, y + 1, z) && this.blockAir(x, y + 2, z)) {
                        //x += stepDir.x;
                        //z += stepDir.z;
                        let checkCount = 0;
                        if (
                            /*!blockStand(bot, x, y - 1, z) ||*/
                            !this.blockAir(node.x, y + 2, node.z) ||
                            !this.blockWalk(x, y, z) ||
                            !this.blockAir(x, y + 1, z) ||
                            !this.blockAir(x, y + 2, z) ||
                            !this.blockWalk(x - stepDir.x, y, z) ||
                            !this.blockAir(x - stepDir.x, y + 1, z) ||
                            !this.blockAir(x - stepDir.x, y + 2, z) ||
                            !this.blockWalk(x, y, z - stepDir.z) ||
                            !this.blockAir(x, y + 1, z - stepDir.z) ||
                            !this.blockAir(x, y + 2, z - stepDir.z)
                        ) {
                            checkCount = 3;
                        }
                        while (!legalMove && checkCount < 2) {
                            checkCount++;
                            x += stepDir.x;
                            z += stepDir.z;
                            if (
                                /*!blockStand(bot, x, y - 1, z) ||*/
                                !this.blockWalk(x, y, z) ||
                                !this.blockAir(x, y + 1, z) ||
                                !this.blockAir(x, y + 2, z) ||
                                !this.blockWalk(x - stepDir.x, y, z) ||
                                !this.blockAir(x - stepDir.x, y + 1, z) ||
                                !this.blockAir(x - stepDir.x, y + 2, z) ||
                                !this.blockWalk(x, y, z - stepDir.z) ||
                                !this.blockAir(x, y + 1, z - stepDir.z) ||
                                !this.blockAir(x, y + 2, z - stepDir.z)
                            ) {
                                checkCount += 3;
                                //console.log("boo " + x + ", " + y + ", " + z);
                            } else if (this.blockStand(x, y - 1, z)) {
                                legalMove = true;
                                //console.log("e " + x + ", " + y + ", " + z);
                            }
                            if (checkCount == 1 && !this.pathfinderOptions.sprint) {
                                checkCount = 3;
                            }
                        }
                    }
                }
            }
        } else if ((Math.abs(node.x - x) == 1 || Math.abs(node.z - z) == 1) && node.y == y) {
            //STRAIGHT WALK
            moveType = "walk";
            ughType = 2;
            myFCost = 10;
            if (this.blockWalk(x, y, z) && this.blockAir(x, y + 1, z) && this.blockStand(x, y - 1, z)) {
                legalMove = true;
            }
            let oldX = x;
            let oldZ = z;
            if (!legalMove) {
                this.validNode(node, x, y + 1, z, endX, endY, endZ);
                moveType = "walkJump";
                //Parkour move
                let stepDir = { x: x - node.x, z: z - node.z };
                let blockWaterCount = Number(this.blockWater(x, y, z)) + Number(this.blockWater(x, y + 1, z));
                let blockAirCount = Number(this.blockAir(x, y, z)) + Number(this.blockAir(x, y + 1, z));
                if (blockWaterCount == 2 || (blockWaterCount == 1 && blockAirCount == 1)) {
                    legalMove = true;
                    if (
                        this.pathfinderOptions.sprint &&
                        (node.moveType == "swimFast" || (this.blockWater(x, y, z) && this.blockWater(x, y + 1, z)))
                    ) {
                        moveType = "swimFast";
                    } else {
                        moveType = "swimSlow";
                        if (this.blockWater(x, y + 1, z)) {
                            myFCost *= 2;
                        }
                    }
                }
                if (!legalMove) {
                    let blockLavaCount = Number(this.blockLava(x, y, z)) + Number(this.blockLava(x, y + 1, z));
                    if (blockLavaCount == 2 || (blockLavaCount == 1 && blockAirCount == 1)) {
                        legalMove = true;
                        moveType = "lava";
                        if (node.moveType != "lava") {
                            myFCost += 1000;
                        } else {
                            myFCost += 20;
                        }
                    }
                }
                if (!this.blockSolid(x, y - 1, z) && !this.blockSolid(x, y, z)) {
                    this.validNode(node, x, y - 1, z, endX, endY, endZ);
                }
                if (this.pathfinderOptions.parkour && !legalMove && this.blockAir(x, y - 1, z) && this.blockAir(x, y, z)) {
                    //validNode(node, x, y - 1, z, endX, endY, endZ);
                    let checkCount = 0;
                    if (
                        !this.blockAir(node.x, node.y + 2, node.z) ||
                        (!this.blockAir(x, y, z) && (!this.blockWalk(x, y, z) || !this.blockAir(x, y + 2, z))) ||
                        !this.blockAir(x, y + 1, z)
                    ) {
                        checkCount = 3;
                        //console.log("fail");
                    }
                    while (!legalMove && checkCount < 3) {
                        checkCount++;
                        x += stepDir.x;
                        z += stepDir.z;
                        if (
                            (!this.blockAir(x, y, z) && (!this.blockWalk(x, y, z) || !this.blockAir(x, y + 2, z))) ||
                            !this.blockAir(x, y + 1, z) ||
                            !this.blockAir(x - stepDir.x, y + 2, z - stepDir.z)
                        ) {
                            checkCount += 3;
                        } else if (this.blockStand(x, y - 1, z)) {
                            legalMove = true;
                            //myFCost += checkCount * 8;
                        }
                        if (checkCount == 1 && !this.pathfinderOptions.sprint) {
                            checkCount = 3;
                        }
                    }
                }
            }
            if (!legalMove /* && blockAir(bot, x, y, z) && blockAir(bot, x, y + 1, z)*/) {
                let myExplorer = node;
                let brokenBlocksInPast = 0;
                let placedBlocksInPast = 0;
                let exploreCount = 0;
                // let pastConforms: { [name: string]: any } = {
                //     conforms: false,
                //     x0: 0,
                //     x1: 0,
                //     y0: 0,
                //     y1: 0,
                //     z0: 0,
                //     z1: 0,
                // };
                if (myExplorer && myExplorer.parent && myExplorer.parent.parent) {
                    //originally myExplorer.parent again, perhaps because def to 0?
                    pastConforms = {
                        conforms: true,
                        x0: x - myExplorer.parent.x,
                        x1: node.x - myExplorer.parent.parent.x,
                        y0: y - myExplorer.parent.y,
                        y1: node.y - myExplorer.parent.parent.y,
                        z0: z - myExplorer.parent.z,
                        z1: node.z - myExplorer.parent.parent.z,
                    };
                }
                while (myExplorer.parent != undefined && exploreCount < 7) {
                    if (myExplorer.placedBlocks) {
                        placedBlocksInPast++;
                    }
                    if (pastConforms.conforms && myExplorer.parent.parent) {
                        if (
                            (myExplorer.x - myExplorer.parent.parent.x !=
                                pastConforms["x" + (Math.floor(exploreCount) == Math.floor(exploreCount / 2) * 2 ? 1 : 0)] ||
                                myExplorer.y - myExplorer.parent.parent.y !=
                                    pastConforms["y" + (Math.floor(exploreCount) == Math.floor(exploreCount / 2) * 2 ? 1 : 0)] ||
                                myExplorer.z - myExplorer.parent.parent.z !=
                                    pastConforms["z" + (Math.floor(exploreCount) == Math.floor(exploreCount / 2) * 2 ? 1 : 0)]) &&
                            (myExplorer.x - myExplorer.parent.parent.x !=
                                pastConforms["x" + (Math.floor(exploreCount) == Math.floor(exploreCount / 2) * 2 ? 0 : 1)] ||
                                myExplorer.y - myExplorer.parent.parent.y !=
                                    pastConforms["y" + (Math.floor(exploreCount) == Math.floor(exploreCount / 2) * 2 ? 0 : 1)] ||
                                myExplorer.z - myExplorer.parent.parent.z !=
                                    pastConforms["z" + (Math.floor(exploreCount) == Math.floor(exploreCount / 2) * 2 ? 0 : 1)])
                        ) {
                            pastConforms.conforms = false;
                            //console.log((((Math.floor(exploreCount) == Math.floor(exploreCount / 2) * 2) ? 1 : 0)) + ": " + (myExplorer.x - myExplorer.parent.parent.x) + ", " + (myExplorer.y - myExplorer.parent.parent.y) + ", " + (myExplorer.z - myExplorer.parent.parent.z) + ", " + JSON.stringify(pastConforms) + ", doesn't conform");
                        }
                    }
                    myExplorer = myExplorer.parent;
                    exploreCount++;
                }
                //if (placedBlocksInPast >= 5) {placeBlockCost = 4;}
                if (pastConforms.conforms) {
                    placeBlockCost /= 4;
                }
                x = oldX;
                z = oldZ;
                let inWater = false;
                if (node.moveType == "swimSlow" || node.moveType == "swimFast") {
                    inWater = true;
                }
                //if (blockSolid(bot, x, y, z)) {console.log(bot.blockAt(new Vec3(x, y, z)).displayName);console.log(bot.blockAt(new Vec3(x, y, z)).digTime(null, false, inWater, inWater, [], {}) * breakBlockCost);}
                //if (blockSolid(bot, x, y + 1, z)) {console.log(bot.blockAt(new Vec3(x, y + 1, z)).displayName);console.log(bot.blockAt(new Vec3(x, y + 1, z)).digTime(null, false, inWater, inWater, [], {}) * breakBlockCost);}
                myExplorer = node;
                brokenBlocksInPast = 0;
                exploreCount = 0;
                pastConforms = {
                    conforms: false,
                    x0: 0,
                    x1: 0,
                    y0: 0,
                    y1: 0,
                    z0: 0,
                    z1: 0,
                };
                if (myExplorer && myExplorer.parent) {
                    pastConforms = {
                        conforms: true,
                        x0: x - myExplorer.parent.x,
                        x1: node.x - (myExplorer.parent.parent?.x ?? 0),
                        y0: y - myExplorer.parent.y,
                        y1: node.y - (myExplorer.parent.parent?.y ?? 0),
                        z0: z - myExplorer.parent.z,
                        z1: node.z - (myExplorer.parent.parent?.z ?? 0),
                    };
                }
                while (myExplorer.parent != undefined && exploreCount < 6) {
                    if (myExplorer.brokenBlocks) {
                        brokenBlocksInPast++;
                    }
                    if (pastConforms.conforms && myExplorer.parent.parent) {
                        if (
                            (myExplorer.x - myExplorer.parent.parent.x !=
                                pastConforms["x" + (Math.floor(exploreCount) == Math.floor(exploreCount / 2) * 2 ? 1 : 0)] ||
                                myExplorer.y - myExplorer.parent.parent.y !=
                                    pastConforms["y" + (Math.floor(exploreCount) == Math.floor(exploreCount / 2) * 2 ? 1 : 0)] ||
                                myExplorer.z - myExplorer.parent.parent.z !=
                                    pastConforms["z" + (Math.floor(exploreCount) == Math.floor(exploreCount / 2) * 2 ? 1 : 0)]) &&
                            (myExplorer.x - myExplorer.parent.parent.x !=
                                pastConforms["x" + (Math.floor(exploreCount) == Math.floor(exploreCount / 2) * 2 ? 0 : 1)] ||
                                myExplorer.y - myExplorer.parent.parent.y !=
                                    pastConforms["y" + (Math.floor(exploreCount) == Math.floor(exploreCount / 2) * 2 ? 0 : 1)] ||
                                myExplorer.z - myExplorer.parent.parent.z !=
                                    pastConforms["z" + (Math.floor(exploreCount) == Math.floor(exploreCount / 2) * 2 ? 0 : 1)])
                        ) {
                            pastConforms.conforms = false;
                        }
                    }
                    myExplorer = myExplorer.parent;
                    exploreCount++;
                }
                //if (brokenBlocksInPast >= 5) {breakBlockCost /= 2;}
                if (pastConforms.conforms) {
                    breakBlockCost /= 4;
                }
                myFCost +=
                    Number(this.blockSolid(x, y, z) && !this.blockWalk(x, y, z)) * breakBlockCost * this.getDigTime(x, y, z, false, false);
                myFCost += Number(this.blockSolid(x, y + 1, z)) * breakBlockCost * this.getDigTime(x, y + 1, z, false, false);
                myFCost += Number(this.blockSolid(x, y, z) && !this.blockWalk(x, y, z)) * breakBlockCost2;
                myFCost += Number(this.blockSolid(x, y + 1, z)) * breakBlockCost2;
                if (
                    !this.blockWater(x, y, z) &&
                    !this.blockWater(x, y + 1, z) &&
                    !this.blockLava(x, y, z) &&
                    !this.blockLava(x, y + 1, z)
                ) {
                    let placeBlockNeeded = this.blockStand(x, y - 1, z) != true;
                    if (placeBlockNeeded) {
                        myFCost += Number(placeBlockNeeded) * placeBlockCost;
                        myBlockActions.push([x, y - 1, z]);
                    }
                }
                if (this.blockSolid(x, y, z) && !this.blockWalk(x, y, z)) {
                    brokenBlocks.push([x, y, z]);
                    brokeBlocks = true;
                }
                if (this.blockSolid(x, y + 1, z)) {
                    brokenBlocks.push([x, y + 1, z]);
                    brokeBlocks = true;
                }
                legalMove = true;
                if (this.getDigTime(x, y, z, false, false) == 9999999 || this.getDigTime(x, y + 1, z, false, false) == 9999999) {
                    legalMove = false;
                }
                moveType = "walk";
                if (this.pathfinderOptions.sprint && this.blockWater(x, y, z) && this.blockWater(x, y + 1, z)) {
                    moveType = "swimFast";
                } else if (this.blockWater(x, y, z) || this.blockWater(x, y + 1, z)) {
                    moveType = "swimSlow";
                    if (this.blockWater(x, y + 1, z)) {
                        myFCost += 35;
                    }
                } else if (this.blockLava(x, y, z) || this.blockLava(x, y + 1, z)) {
                    //console.log("THIS IS LAVA YEAH " + myFCost);
                    if (node.moveType != "lava" && node.moveType != "fallLava") {
                        myFCost += 1000;
                    } else {
                        myFCost += 20;
                    }
                    moveType = "lava";
                }
            }
            if (legalMove && (x == 57 || x == 58) && z == -90) {
                console.log(x + ", " + y + ", " + z + ", " + moveType + ", " + myFCost);
            }
        } else if (false && Math.abs(node.x - x) == 1 && Math.abs(node.z - z) == 1 && node.y + 1 == y) {
            //JUMP DIAGNOL
            // ughType = 3;
            // myFCost = 14;
            // if (
            //     this.isBlock(x, y, z) == 0 &&
            //     this.isBlock(x, y + 1, z) == 0 &&
            //     this.isBlock(x, y - 1, z, node) == 1 &&
            //     this.isBlock(node.x, y, node.z) == 0 &&
            //     this.isBlock(node.x, y + 1, node.z) == 0 &&
            //     this.isBlock(node.x, y, z) == 0 &&
            //     this.isBlock(node.x, y + 1, z) == 0 /*| used for allowing jumps diagnol blocks in the way*/ &&
            //     this.isBlock(x, y, node.z) == 0 &&
            //     this.isBlock(x, y + 1, node.z) == 0
            // ) {
            //     legalMove = true;
            // }
            /*if (!legalMove) {
            if (isBlock(bot, x, y - 1, z) != 1 && isBlock(bot, x, y, z) != 1) {//JUMP DIAGNOL
                //parkour move
                let stepDir = {"x":x - node.x, "z":z - node.z};
                if (isBlock(bot, x, y - 1, z) != 1 && isBlock(bot, x, y, z) != 1) {
                    //x += stepDir.x;
                    //z += stepDir.z;
                    let checkCount = 0;
                    if (isBlock(bot, node.x, node.y + 2, node.z) != 0 ||
                        isBlock(bot, x, y, z) != 0 ||
                        isBlock(bot, x, y + 1, z) != 0 ||
                        isBlock(bot, x - stepDir.x, y, z) != 0 ||
                        isBlock(bot, x - stepDir.x, y + 1, z) != 0 ||
                        isBlock(bot, x - stepDir.x, y + 2, z) != 0 ||
                        isBlock(bot, x, y, z - stepDir.z) != 0 ||
                        isBlock(bot, x, y + 1, z - stepDir.z) != 0 ||
                        isBlock(bot, x, y + 2, z - stepDir.z) != 0) {
                        checkCount = 3;
                    }
                    while (!legalMove && checkCount < 1) {
                        checkCount++;
                        x += stepDir.x;
                        z += stepDir.z;
                        if (isBlock(bot, x, y, z) != 0 || isBlock(bot, x, y + 1, z) != 0 ||
                            isBlock(bot, x - stepDir.x, y + 2, z - stepDir.z) != 0 ||
                            isBlock(bot, x - stepDir.x, y, z) != 0 ||
                            isBlock(bot, x - stepDir.x, y + 1, z) != 0 ||
                            isBlock(bot, x - stepDir.x, y + 2, z) != 0 ||
                            isBlock(bot, x, y, z - stepDir.z) != 0 ||
                            isBlock(bot, x, y + 1, z - stepDir.z) != 0 ||
                            isBlock(bot, x, y + 2, z - stepDir.z) != 0) {
                            checkCount += 3;
                            //console.log("boo " + x + ", " + y + ", " + z);
                        } else if (isBlock(bot, x, y - 1, z) == 1) {
                            legalMove = true;
                            //console.log("e " + x + ", " + y + ", " + z);
                        }
                    }
                }
            }
        }*/
        } else if ((Math.abs(node.x - x) == 1 || Math.abs(node.z - z) == 1) && node.y + 1 == y) {
            //JUMP STRAIGHT
            moveType = "walkJump";
            ughType = 4;
            myFCost = 10;
            if (
                this.blockWalk(x, y, z) &&
                this.blockAir(x, y + 1, z) &&
                this.blockStand(x, y - 1, z) &&
                this.blockAir(node.x, node.y + 1, node.z) &&
                this.blockAir(node.x, node.y + 2, node.z)
            ) {
                legalMove = true;
            }
            //Parkour move
            let stepDir = { x: x - node.x, z: z - node.z };

            let blockWaterCount = Number(this.blockWater(x, y, z)) + Number(this.blockWater(x, y + 1, z));
            let blockAirCount = Number(this.blockAir(x, y, z)) + Number(this.blockAir(x, y + 1, z));

            if (
                (blockWaterCount == 2 || (blockWaterCount == 1 && blockAirCount == 1)) &&
                !this.blockSolid(node.x, y, node.z) &&
                !this.blockSolid(node.x, y + 1, node.z)
            ) {
                if (this.blockSolid(x, y, z) || this.blockSolid(x, y, z)) {
                    legalMove = false;
                } else {
                    legalMove = true;
                    if (
                        this.pathfinderOptions.sprint &&
                        (node.moveType == "swimFast" || (this.blockWater(x, y, z) && this.blockWater(x, y + 1, z)))
                    ) {
                        moveType = "swimFast";
                    } else {
                        moveType = "swimSlow";
                        if (this.blockWater(x, y + 1, z)) {
                            myFCost *= 2;
                        }
                    }
                }
            }
            let blockLavaCount = 0;
            if (!legalMove) {
                blockLavaCount = Number(this.blockLava(x, y, z)) + Number(this.blockLava(x, y + 1, z));
                if (blockLavaCount == 2 || (blockLavaCount == 1 && blockAirCount == 1)) {
                    if (!this.blockSolid(node.x, y, node.z) && !this.blockSolid(node.x, y + 1, node.z)) {
                        legalMove = true;
                    }
                    moveType = "lava";
                    if (node.moveType != "lava") {
                        myFCost += 1000;
                    } else {
                        myFCost += 20;
                    }
                }
            }
            //if (blockSolid(bot, node.x, y, node.z) || blockSolid(bot, node.x, y + 1, node.z)) {
            //legalMove = false;
            //}

            if (this.pathfinderOptions.parkour && !legalMove && this.blockAir(x, y - 1, z) && this.blockAir(x, y, z)) {
                //parkour move
                let stepDir = { x: x - node.x, z: z - node.z };
                let oldX = x;
                let oldZ = z;
                let checkCount = 0;
                /*if (blockStand(bot, x, y - 1, z, node)) {
                    myFCost += (blockSolid(bot, x, y, z)) * breakBlockCost;
                    myFCost += (blockSolid(bot, x, y + 1, z)) * breakBlockCost;
                    myFCost += (blockAir(bot, node.x, node.y + 2, node.z)) * breakBlockCost;
                    if (blockSolid(bot, x, y, z)) {brokenBlocks.push([x, y, z]);}
                    if (blockSolid(bot, x, y + 1, z)) {brokenBlocks.push([x, y + 1, z]);}
                    if (blockSolid(bot, node.x, node.y + 2, node.z)) {brokenBlocks.push([node.x, node.y + 2, node.z]);}
                    legalMove = true;
                    moveType = "walkJump";
                } else */ if (this.blockSolid(node.x, node.y + 2, node.z) || this.blockSolid(x, y, z) || this.blockSolid(x, y + 1, z)) {
                    checkCount = 3;
                }
                while (!legalMove && checkCount < 2) {
                    checkCount++;
                    x += stepDir.x;
                    z += stepDir.z;
                    if (this.blockSolid(x, y, z) || this.blockSolid(x, y + 1, z) || this.blockSolid(x - stepDir.x, y + 2, z - stepDir.z)) {
                        checkCount += 3;
                        //console.log("boo " + x + ", " + y + ", " + z);
                    } else if (this.blockStand(x, y - 1, z)) {
                        legalMove = true;
                        moveType = "walkJump";
                    }
                }
                if (!legalMove) {
                    x = oldX;
                    z = oldZ;
                }
            }
            if (!legalMove && (this.blockStand(x, y - 1, z) || blockLavaCount > 0 || blockWaterCount > 0)) {
                let inWater = false;
                if (node.moveType == "swimSlow" || node.moveType == "swimFast") {
                    inWater = true;
                }
                //if (blockSolid(bot, x, y, z)) {console.log(bot.blockAt(new Vec3(x, y, z)).displayName);console.log(bot.blockAt(new Vec3(x, y, z)).digTime(null, false, inWater, inWater, [], {}) * breakBlockCost);}
                //if (blockSolid(bot, x, y + 1, z)) {console.log(bot.blockAt(new Vec3(x, y + 1, z)).displayName);console.log(bot.blockAt(new Vec3(x, y + 1, z)).digTime(null, false, inWater, inWater, [], {}) * breakBlockCost);}
                // let myExplorer = node;
                // let brokenBlocksInPast = 0;
                // let exploreCount = 0;
                // let pastConforms = {
                //     conforms: false,
                //     x0: 0,
                //     x1: 0,
                //     y0: 0,
                //     y1: 0,
                //     z0: 0,
                //     z1: 0,
                // };
                if (myExplorer && myExplorer.parent) {
                    pastConforms = {
                        conforms: true,
                        x0: x - myExplorer.parent.x,
                        x1: node.x - (myExplorer.parent.parent?.x ?? 0),
                        y0: y - myExplorer.parent.y,
                        y1: node.y - (myExplorer.parent.parent?.y ?? 0),
                        z0: z - myExplorer.parent.z,
                        z1: node.z - (myExplorer.parent.parent?.z ?? 0),
                    };
                }
                while (myExplorer.parent != undefined && exploreCount < 6) {
                    if (myExplorer.brokenBlocks) {
                        brokenBlocksInPast++;
                    }
                    if (pastConforms.conforms && myExplorer.parent.parent) {
                        if (
                            (myExplorer.x - myExplorer.parent.parent.x !=
                                pastConforms["x" + (Math.floor(exploreCount) == Math.floor(exploreCount / 2) * 2 ? 1 : 0)] ||
                                myExplorer.y - myExplorer.parent.parent.y !=
                                    pastConforms["y" + (Math.floor(exploreCount) == Math.floor(exploreCount / 2) * 2 ? 1 : 0)] ||
                                myExplorer.z - myExplorer.parent.parent.z !=
                                    pastConforms["z" + (Math.floor(exploreCount) == Math.floor(exploreCount / 2) * 2 ? 1 : 0)]) &&
                            (myExplorer.x - myExplorer.parent.parent.x !=
                                pastConforms["x" + (Math.floor(exploreCount) == Math.floor(exploreCount / 2) * 2 ? 0 : 1)] ||
                                myExplorer.y - myExplorer.parent.parent.y !=
                                    pastConforms["y" + (Math.floor(exploreCount) == Math.floor(exploreCount / 2) * 2 ? 0 : 1)] ||
                                myExplorer.z - myExplorer.parent.parent.z !=
                                    pastConforms["z" + (Math.floor(exploreCount) == Math.floor(exploreCount / 2) * 2 ? 0 : 1)])
                        ) {
                            pastConforms.conforms = false;
                        }
                    }
                    myExplorer = myExplorer.parent;
                    exploreCount++;
                }
                //if (brokenBlocksInPast >= 5) {breakBlockCost /= 2;}
                if (pastConforms.conforms) {
                    breakBlockCost /= 4;
                }
                myFCost +=
                    Number(this.blockSolid(x, y, z) && !this.blockWalk(x, y, z)) * breakBlockCost * this.getDigTime(x, y, z, false, false);
                myFCost += Number(this.blockSolid(x, y + 1, z)) * breakBlockCost * this.getDigTime(x, y + 1, z, false, false);
                myFCost +=
                    Number(this.blockSolid(node.x, node.y + 2, node.z)) *
                    breakBlockCost *
                    this.getDigTime(node.x, node.y + 2, node.z, false, false);

                myFCost += Number(this.blockSolid(x, y, z) && !this.blockWalk(x, y, z)) * breakBlockCost2;
                myFCost += Number(this.blockSolid(x, y + 1, z)) * breakBlockCost2;
                myFCost += Number(this.blockSolid(node.x, node.y + 2, node.z)) * breakBlockCost2;
                if (
                    !this.blockWater(x, y, z) &&
                    !this.blockWater(x, y + 1, z) &&
                    !this.blockLava(x, y, z) &&
                    !this.blockLava(x, y + 1, z)
                ) {
                    let placeBlockNeeded = this.blockStand(x, y - 1, z) != true;
                    if (placeBlockNeeded) {
                        myFCost += Number(placeBlockNeeded) * placeBlockCost;
                        myBlockActions.push([x, y - 1, z]);
                    }
                }
                if (this.blockSolid(x, y, z) && !this.blockWalk(x, y, z)) {
                    brokenBlocks.push([x, y, z]);
                    brokeBlocks = true;
                }
                if (this.blockSolid(x, y + 1, z)) {
                    brokenBlocks.push([x, y + 1, z]);
                    brokeBlocks = true;
                }
                if (this.blockSolid(node.x, node.y + 2, node.z)) {
                    brokenBlocks.push([node.x, node.y + 2, node.z]);
                    brokeBlocks = true;
                }
                legalMove = true;
                if (
                    this.getDigTime(node.x, node.y + 2, node.z, false, false) == 9999999 ||
                    this.getDigTime(x, y, z, false, false) == 9999999 ||
                    this.getDigTime(x, y + 1, z, false, false) == 9999999
                ) {
                    legalMove = false;
                }
                moveType = "walkJump";
                if (this.pathfinderOptions.sprint && this.blockWater(x, y, z) && this.blockWater(x, y + 1, z)) {
                    moveType = "swimFast";
                } else if (this.blockWater(x, y, z) || this.blockWater(x, y + 1, z)) {
                    moveType = "swimSlow";
                    if (this.blockWater(x, y + 1, z)) {
                        myFCost += 35;
                    }
                } else if (this.blockLava(x, y, z) || this.blockLava(x, y + 1, z)) {
                    //console.log("THIS IS LAVA YEAH " + myFCost);
                    if (node.moveType != "lava" && node.moveType != "fallLava") {
                        myFCost += 1000;
                    } else {
                        myFCost += 20;
                    }
                    moveType = "lava";
                }
            }
            if (legalMove && (x == 57 || x == 58) && z == -90) {
                console.log(x + ", " + y + ", " + z + ", " + moveType + ", " + myFCost);
            }
        } else if (Math.abs(node.x - x) == 1 && Math.abs(node.z - z) == 1 && node.y - 1 == y) {
            //FALL DIAGNOL
            //console.log("fall diagnol " + x + ", " + y + ", " + z);
            ughType = 5;
            myFCost = 14;
            moveType = "fall";
            if (
                (!this.blockSolid(x, y, z) &&
                    !this.blockSolid(x, y + 1, z) &&
                    !this.blockSolid(x, y + 2, z) &&
                    !this.blockSolid(node.x, y + 2, z) &&
                    this.blockWalk(node.x, y + 1, z, undefined, true, true)) ||
                (!this.blockSolid(x, y + 2, node.z) && this.blockWalk(x, y + 1, node.z, undefined, true, true))
            ) {
                let oldY = y;
                let failed = false;
                let attempts = 0;
                while (
                    (y > -1 && y > oldY - this.pathfinderOptions.maxFall && !this.pathfinderOptions.canClutch) ||
                    (y > oldY - this.pathfinderOptions.maxFallClutch && this.pathfinderOptions.canClutch && !legalMove && !failed)
                ) {
                    attempts++;
                    if (this.blockStand(x, y - 1, z) || this.blockWater(x, y, z) || this.blockLava(x, y, z)) {
                        legalMove = true;
                        if (this.blockWater(x, y, z)) {
                            myFCost += waterSwimCost + 0.1;
                            if (node.moveType != "swimSlow" && node.moveType != "swimFast" && node.moveType != "fallWater") {
                                moveType = "fallWater";
                            } else if (this.blockWater(x, y + 1, z)) {
                                moveType = "swimFast";
                            } else {
                                moveType = "swimSlow";
                            }
                        } else if (this.blockLava(x, y, z)) {
                            if (node.moveType != "lava" && node.moveType != "fallLava") {
                                myFCost += 1000;
                                moveType = "fallLava";
                            } else {
                                myFCost += 24;
                                moveType = "lava";
                            }
                        }
                    } else if (!this.blockSolid(x, y - 1, z)) {
                        y--;
                    } else {
                        failed = true;
                    }
                }
                if (
                    moveType != "fallLava" &&
                    moveType != "lava" &&
                    (this.blockLava(x, y, z) ||
                        this.blockLava(x, y + 1, z) ||
                        this.blockLava(x, y + 2, z) ||
                        this.blockLava(node.x, y + 2, z) ||
                        this.blockLava(node.x, y + 1, z) ||
                        this.blockLava(x, y + 2, node.z) ||
                        this.blockLava(x, y + 1, node.z))
                ) {
                    legalMove = false;
                }
                //console.log("legal fall " + isBlock(bot, x, y - 1, z)).displayName);
            }
        } else if ((Math.abs(node.x - x) == 1 || Math.abs(node.z - z) == 1) && node.y - 1 == y) {
            //FALL STRAIGHT
            let inWater = false;
            ughType = 6;
            myFCost = 10;
            moveType = "fall";
            if (!this.blockSolid(x, y, z) && !this.blockSolid(x, y + 1, z) && !this.blockSolid(x, y + 2, z)) {
                let oldY = y;
                let failed = false;
                let attempts = 0;
                while (
                    y > -1 &&
                    ((y > oldY - this.pathfinderOptions.maxFall && !this.pathfinderOptions.canClutch) ||
                        (y > oldY - this.pathfinderOptions.maxFallClutch && this.pathfinderOptions.canClutch)) &&
                    !legalMove &&
                    !failed
                ) {
                    attempts++;
                    if (
                        this.blockStand(x, y - 1, z) ||
                        this.blockWater(x, y, z) ||
                        this.blockWater(x, y + 1, z) ||
                        this.blockLava(x, y, z)
                    ) {
                        legalMove = true;
                        if (this.blockWater(x, y, z)) {
                            myFCost += waterSwimCost + 0.1;
                            if (node.moveType != "swimSlow" && node.moveType != "swimFast" && node.moveType != "fallWater") {
                                moveType = "fallWater";
                            } else if (this.blockWater(x, y + 1, z)) {
                                moveType = "swimFast";
                            } else {
                                moveType = "swimSlow";
                            }
                            inWater = true;
                        } else if (this.blockLava(x, y, z)) {
                            if (node.moveType != "lava" && node.moveType != "fallLava") {
                                myFCost += 1000;
                                moveType = "fallLava";
                            } else {
                                myFCost += 24;
                                moveType = "lava";
                            }
                        }
                    } else if (!this.blockSolid(x, y - 1, z)) {
                        y--;
                    } else {
                        failed = true;
                    }
                }
                if (
                    moveType != "fallLava" &&
                    moveType != "lava" &&
                    (this.blockLava(x, y, z) || this.blockLava(x, y + 1, z) || this.blockLava(x, y + 2, z))
                ) {
                    legalMove = false;
                }
                if (y != oldY && this.pathfinderOptions.parkour) {
                    this.validNode(node, x, oldY - 1, z, endX, endY, endZ);
                }
                if (!legalMove) {
                    y = oldY;
                }
                if (this.blockSolid(x, oldY, z)) {
                    // blocksBroken = true;
                    myFCost += this.getDigTime(x, oldY, z, false, false) * breakBlockCost;
                    myFCost += breakBlockCost2;
                    brokenBlocks.push([x, oldY, z]);
                }
                //console.log("legal fall " + isBlock(bot, x, y - 1, z)).displayName);
            }
        } else if ((Math.abs(node.x - x) == 1 || Math.abs(node.z - z) == 1) && node.y - 2 == y) {
            //FALL STRAIGHT JUMP
            ughType = 6;
            myFCost = 11;
            moveType = "walkJump";
            y++;
            let stepDir = { x: x - node.x, z: z - node.z };
            x += x - node.x;
            z += z - node.z;
            if (this.blockStand(x, y - 1, z) || this.blockWater(x, y, z) || this.blockLava(x, y, z)) {
                legalMove = true;
                if (this.blockLava(x, y, z)) {
                    if (node.moveType != "lava" && node.moveType != "fallLava") {
                        myFCost += 1000;
                        moveType = "fallLava";
                    } else {
                        legalMove = false;
                    }
                }
            } else {
                failed = true;
            }
            if (
                moveType != "fallLava" &&
                moveType != "lava" &&
                (this.blockLava(x, y, z) || this.blockLava(x, y + 1, z) || this.blockLava(x, y + 2, z))
            ) {
                legalMove = false;
            }
            if (!legalMove && this.blockAir(x, y - 1, z) && this.blockAir(x, y, z)) {
                //parkour move
                let oldX = x;
                let oldZ = z;
                let checkCount = 0;
                if (this.blockSolid(node.x, node.y + 2, node.z) || this.blockSolid(x, y, z) || this.blockSolid(x, y + 1, z)) {
                    checkCount = 3;
                }
                while (!legalMove && checkCount < 2) {
                    checkCount++;
                    x += stepDir.x;
                    z += stepDir.z;
                    if (
                        this.blockSolid(x, y, z) ||
                        this.blockSolid(x, y + 1, z) ||
                        this.blockSolid(x - stepDir.x, y + 2, z - stepDir.z) ||
                        this.blockSolid(x - stepDir.x, y + 3, z - stepDir.z)
                    ) {
                        checkCount += 3;
                        //console.log("boo " + x + ", " + y + ", " + z);
                    } else if (this.blockStand(x, y - 1, z)) {
                        legalMove = true;
                        moveType = "walkJump";
                    }
                }
                if (!legalMove) {
                    x = oldX;
                    z = oldZ;
                }
            }
            //console.log(legalMove + " oppertune " + x + ", " + y + ", " + z);
        } else if (Math.abs(node.x - x) == 0 && Math.abs(node.z - z) == 0 && node.y - 1 == y) {
            //JUST FALL
            ughType = 7;
            myFCost = 10;
            let inWater = false;
            moveType = "fall";
            //console.log("straight fall");
            if (node.moveType == "swimFast") {
                inWater = true;
            }
            // let myExplorer = node;
            // let brokenBlocksInPast = 0;
            // let exploreCount = 0;
            // let pastConforms = {
            //     conforms: false,
            //     x0: 0,
            //     x1: 0,
            //     y0: 0,
            //     y1: 0,
            //     z0: 0,
            //     z1: 0,
            // };
            if (myExplorer && myExplorer.parent) {
                pastConforms = {
                    conforms: true,
                    x0: x - myExplorer.parent.x,
                    x1: node.x - (myExplorer.parent.parent?.x ?? 0),
                    y0: y - myExplorer.parent.y,
                    y1: node.y - (myExplorer.parent.parent?.y ?? 0),
                    z0: z - myExplorer.parent.z,
                    z1: node.z - (myExplorer.parent.parent?.z ?? 0),
                };
            }
            while (myExplorer.parent != undefined && exploreCount < 7) {
                if (myExplorer.brokenBlocks) {
                    brokenBlocksInPast++;
                }
                if (pastConforms.conforms && myExplorer.parent.parent) {
                    if (
                        (myExplorer.x - myExplorer.parent.parent.x !=
                            pastConforms["x" + (Math.floor(exploreCount) == Math.floor(exploreCount / 2) * 2 ? 1 : 0)] ||
                            myExplorer.y - myExplorer.parent.parent.y !=
                                pastConforms["y" + (Math.floor(exploreCount) == Math.floor(exploreCount / 2) * 2 ? 1 : 0)] ||
                            myExplorer.z - myExplorer.parent.parent.z !=
                                pastConforms["z" + (Math.floor(exploreCount) == Math.floor(exploreCount / 2) * 2 ? 1 : 0)]) &&
                        (myExplorer.x - myExplorer.parent.parent.x !=
                            pastConforms["x" + (Math.floor(exploreCount) == Math.floor(exploreCount / 2) * 2 ? 0 : 1)] ||
                            myExplorer.y - myExplorer.parent.parent.y !=
                                pastConforms["y" + (Math.floor(exploreCount) == Math.floor(exploreCount / 2) * 2 ? 0 : 1)] ||
                            myExplorer.z - myExplorer.parent.parent.z !=
                                pastConforms["z" + (Math.floor(exploreCount) == Math.floor(exploreCount / 2) * 2 ? 0 : 1)])
                    ) {
                        pastConforms.conforms = false;
                    }
                }
                myExplorer = myExplorer.parent;
                exploreCount++;
            }
            //if (brokenBlocksInPast >= 5) {breakBlockCost /= 2;}
            if (pastConforms.conforms) {
                breakBlockCost /= 4;
            }
            if (this.blockSolid(x, y, z)) {
                brokeBlocks = true;
                myFCost += this.getDigTime(x, y, z, false, false) * breakBlockCost;
                myFCost += breakBlockCost2;
            }
            //if (true) {
            let oldY = y;
            let failed = false;
            let attempts = 0;
            if (myFCost == 9999999) {
                legalMove = false;
                failed = true;
                console.log("e");
            } else {
                //myFCost += 3;
            }
            while (
                (y > -1 && y > oldY - this.pathfinderOptions.maxFall && !this.pathfinderOptions.canClutch) ||
                (y > oldY - this.pathfinderOptions.maxFallClutch && this.pathfinderOptions.canClutch && !legalMove && !failed)
            ) {
                attempts++;
                if (this.blockStand(x, y - 1, z) || this.blockWater(x, y, z) || this.blockLava(x, y, z)) {
                    legalMove = true;
                    if (this.blockWater(x, y, z)) {
                        myFCost += waterSwimCost + 0.1;
                        if (node.moveType != "swimSlow" && node.moveType != "swimFast" && node.moveType != "fallWater") {
                            moveType = "fallWater";
                        } else if (this.blockWater(x, y + 1, z)) {
                            moveType = "swimFast";
                        } else {
                            moveType = "swimSlow";
                        }
                    } else if (this.blockLava(x, y, z)) {
                        if (node.moveType != "lava" && node.moveType != "fallLava") {
                            myFCost += 1200;
                            moveType = "fallLava";
                        } else {
                            myFCost += 20;
                            moveType = "lava";
                        }
                    }
                } else if (!this.blockSolid(x, y - 1, z)) {
                    y--;
                } else {
                    failed = true;
                }
            }
            //}
            if (legalMove && (x == 57 || x == 58) && z == -90) {
                console.log(x + ", " + y + ", " + z + ", " + moveType + ", " + myFCost);
            }
        } else if (node.x - x == 0 && node.z - z == 0 && node.y + 1 == y) {
            //Just Jump
            // let myExplorer = node;
            // let placedBlocksInPast = 0;
            // let exploreCount = 0;
            // let pastConforms = {
            //     conforms: false,
            //     x0: 0,
            //     x1: 0,
            //     y0: 0,
            //     y1: 0,
            //     z0: 0,
            //     z1: 0,
            // };
            if (myExplorer && myExplorer.parent) {
                pastConforms = {
                    conforms: true,
                    x0: x - myExplorer.parent.x,
                    x1: node.x - (myExplorer.parent.parent?.x ?? 0),
                    y0: y - myExplorer.parent.y,
                    y1: node.y - (myExplorer.parent.parent?.y ?? 0),
                    z0: z - myExplorer.parent.z,
                    z1: node.z - (myExplorer.parent.parent?.z ?? 0),
                };
            }
            while (myExplorer.parent != undefined && exploreCount < 7) {
                if (myExplorer.placedBlocks) {
                    placedBlocksInPast++;
                }
                if (pastConforms.conforms && myExplorer.parent.parent) {
                    if (
                        ((myExplorer.x - myExplorer.parent.parent.x !=
                            pastConforms["x" + (Math.floor(exploreCount) == Math.floor(exploreCount / 2) * 2 ? 1 : 0)] ||
                            myExplorer.y - myExplorer.parent.parent.y !=
                                pastConforms["y" + (Math.floor(exploreCount) == Math.floor(exploreCount / 2) * 2 ? 1 : 0)] ||
                            myExplorer.z - myExplorer.parent.parent.z !=
                                pastConforms["z" + (Math.floor(exploreCount) == Math.floor(exploreCount / 2) * 2 ? 1 : 0)]) &&
                            myExplorer.x - myExplorer.parent.parent.x !=
                                pastConforms["x" + (Math.floor(exploreCount) == Math.floor(exploreCount / 2) * 2 ? 0 : 1)]) ||
                        myExplorer.y - myExplorer.parent.parent.y !=
                            pastConforms["y" + (Math.floor(exploreCount) == Math.floor(exploreCount / 2) * 2 ? 0 : 1)] ||
                        myExplorer.z - myExplorer.parent.parent.z !=
                            pastConforms["z" + (Math.floor(exploreCount) == Math.floor(exploreCount / 2) * 2 ? 0 : 1)]
                    ) {
                        pastConforms.conforms = false;
                    }
                }
                myExplorer = myExplorer.parent;
                exploreCount++;
            }
            //if (placedBlocksInPast >= 5) {placeBlockCost = 4;}
            if (pastConforms.conforms) {
                placeBlockCost /= 4;
            }
            myFCost = 5;
            moveType = "goUp";
            let inWater = false;
            if (this.blockLava(x, y, z) || this.blockLava(x, y + 1, z)) {
                if (node.moveType != "lava" && node.moveType != "fallLava") {
                    myFCost += 1000;
                    moveType = "fallLava";
                } else {
                    myFCost += 20;
                    moveType = "lava";
                }
            } else if (this.blockWater(x, y, z) || this.blockWater(x, y + 1, z)) {
                myFCost += waterSwimCost;
                if (this.blockWater(x, y + 1, z)) {
                    moveType = "swimFast";
                } else {
                    moveType = "swimSlow";
                }
                inWater = true;
            } else {
                myFCost += placeBlockCost;
                myBlockActions.push([x, y - 1, z]);
            }
            if (this.blockSolid(x, y + 1, z)) {
                // blocksBroken = true;
                myFCost += this.getDigTime(x, y, z, false, false) * breakBlockCost;
                myFCost += breakBlockCost2;
                brokenBlocks.push([x, y + 1, z]);
            }
            legalMove = true;
            //console.log("goUp " + myFCost);
        }
        let distToGoal = 0;
        if (endZ != undefined) {
            //distToGoal = dist3d(x, y, z, endX, endY, endZ) * (3);
            //distToGoal = dist3d(x, y, z, endX, endY, endZ) * (25);//DEFAULT
            //distToGoal = dist3d(x, 0, z, endX, 0, endZ) * (25) + dist3d(0, y, 0, 0, endY, 0) * (10);
            distToGoal = dist3d(x, 0, z, endX, 0, endZ) * 25; //Optimized?
            if (distToGoal / 25 < 100) {
                distToGoal += dist3d(0, y, 0, 0, endY, 0) * 18;
            } else {
                distToGoal += 4608;
            }
            //distToGoal = dist3d(x, 0, z, endX, 0, endZ) * (10);
            //distToGoal += Math.abs(y - endY) * 10;
            //distToGoal += dist3d(0, y, 0, 0, endY, 0) * (10);
        } else {
            distToGoal = dist3d(x, 0, z, endX, 0, endY) * 25;
        }
        if (this.nodes3d[y] == undefined || this.nodes3d[y][z] == undefined || this.nodes3d[y][z][x] == undefined) {
            ownerNodeUndefined = true;
        } else if (node.fCost + myFCost + distToGoal < this.nodes3d[y][z][x].fCost + this.nodes3d[y][z][x].hCost) {
            ownerNodeUndefined = true;
        }
        if (legalMove && ownerNodeUndefined) {
            this.addNode(node, myFCost, distToGoal, x, y, z, moveType, brokenBlocks, brokeBlocks, placedBlocks, myBlockActions);
            //console.log("D: " + Math.floor(distToGoal) + ", F: " + myFCost + ", M: " + moveType + ", XYZ: " + x + " " + y + " " + z);
        } else {
            //console.log("X: " + x + ", Y: " + y + ", Z: " + z + ", D: " + dist3d(x, y, z, endX, endY, endZ) * 10);
        }
    }

    jumpSprintOnMoves(stateBase: any, searchCount: number, theParent?: DunderNode) {
        //bot.chat("/particle minecraft:flame ~ ~ ~");
        //bot.entity.yaw
        let target = this.bot.nearestEntity();
        let minimumMove = this.lastPos.currentMove - 20;
        if (minimumMove < 0) {
            minimumMove = 0;
        }
        //console.log("minimumMove: " + minimumMove);
        if (!this.movesToGo[minimumMove]) {
            return;
        }
        //bot.lookAt(new Vec3(target.position.x, bot.entity.position.y + 1.6, target.position.z), 360);
        this.bot.lookAt(new Vec3(this.movesToGo[minimumMove].x, this.movesToGo[minimumMove].y + 1.6, this.movesToGo[minimumMove].z), true);
        let myStateBase = stateBase;
        let myDelta = new Vec3(
            this.movesToGo[minimumMove].x - myStateBase.pos.x,
            this.movesToGo[minimumMove].y - myStateBase.pos.y,
            this.movesToGo[minimumMove].z - myStateBase.pos.z
        );
        myStateBase.yaw = Math.atan2(-myDelta.x, -myDelta.z);
        for (let j = myStateBase.yaw - Math.PI / 2 + Math.PI / 8; j < myStateBase.yaw + Math.PI / 2; j += Math.PI / 8) {
            //let myState = new PlayerState(bot, simControl);//Clone stuff here
            let myState = JSON.parse(JSON.stringify(myStateBase));
            myState.pos = new Vec3(myState.pos.x, myState.pos.y, myState.pos.z);
            //myState.vel = new Vec3(myState.vel.x, myState.vel.y, myState.vel.z);
            //console.log(JSON.stringify(myState));
            myState.yaw = j;
            for (let i = 0; i < 30; i++) {
                (this.bot.physics as any).simulatePlayer(myState, this.bot.world);
                if (myState.onGround | myState.isInWater | myState.isInLava) {
                    i = 30;
                }
                //bot.chat("/particle minecraft:flame " + myState.pos.x + " " + myState.pos.y + " " + myState.pos.z);
                //console.log(JSON.stringify(myState.pos));
            }
            if (myState.onGround) {
                let myScore = 25;
                for (let i = this.lastPos.currentMove; i >= 0 && i > this.movesToGo.length - 20; i--) {
                    if (
                        dist3d(
                            myState.pos.x,
                            myState.pos.y,
                            myState.pos.z,
                            this.movesToGo[i].x,
                            this.movesToGo[i].y,
                            this.movesToGo[i].z
                        ) <= 5
                    ) {
                        //myScore += dist3d(myState.pos.x, myState.pos.y, myState.pos.z,
                        //                  movesToGo[i].x, movesToGo[i].y, movesToGo[i].z);
                        myScore -= 25;
                    }
                }
                myScore +=
                    dist3d(
                        myState.pos.x,
                        myState.pos.y,
                        myState.pos.z,
                        this.movesToGo[minimumMove].x,
                        this.movesToGo[minimumMove].y,
                        this.movesToGo[minimumMove].z
                    ) * this.movesToGo.length;
                this.myStates.push({ state: myState, parent: theParent, open: true, score: myScore });
            }
        }
        if (this.myStates.length > 0) {
            let myBestState = 0;
            for (let i = 0; i < this.myStates.length; i++) {
                if (this.myStates[i].open == true && this.myStates[i].score < this.myStates[myBestState].score) {
                    myBestState = i;
                }
                /*if (myStates[i].open == true && dist3d(myStates[i].state.pos.x, myStates[i].state.pos.y, myStates[i].state.pos.z,
                             target.position.x, target.position.y, target.position.z) <
                      dist3d(myStates[myBestState].state.pos.x, myStates[myBestState].state.pos.y, myStates[myBestState].state.pos.z,
                             target.position.x, target.position.y, target.position.z)) {
                      //console.log(myStates[i].open);
                      myBestState = i;
                  }*/
            }
            //bot.chat("/particle minecraft:spit " + myStates[myBestState].state.pos.x + " " + myStates[myBestState].state.pos.y + " " + myStates[myBestState].state.pos.z);
            if (
                (target?.isValid &&
                    dist3d(
                        this.myStates[myBestState].state.pos.x,
                        this.myStates[myBestState].state.pos.y,
                        this.myStates[myBestState].state.pos.z,
                        target.position.x,
                        target.position.y,
                        target.position.z
                    ) < 1.5) ||
                searchCount <= 0
            ) {
                // console.log("decent jumps found");
                let mySearcher = this.myStates[myBestState];
                while (mySearcher.parent) {
                    this.jumpTargets.push(mySearcher.state.pos);
                    mySearcher = mySearcher.parent;
                }
                this.jumpTargets.push(mySearcher.state.pos);
                this.bot.lookAt(
                    new Vec3(mySearcher.state.pos.x,  (target?.position?.y) ?? mySearcher.state.pos.y + 1.6, mySearcher.state.pos.z),
                    true
                );
                this.jumpTarget = mySearcher.state.pos;
            } else if (searchCount > 0) {
                console.log(JSON.stringify(this.myStates[myBestState].open));
                this.myStates[myBestState].open = false;
                this.jumpSprintOnMoves(this.myStates[myBestState].state, searchCount - 1, this.myStates[myBestState]);
            }
        } else {
            //bot.chat("nothing to jump on...");
        }
    }

    findPath(endX: number, endY: string | number, endZ?: any, correction?: any, extension?: any) {
        if (this.movesToGo.length == 0) {
            extension = false;
        }
        if (endY == "no") {
            endY = endZ;
            endZ = undefined;
        }
        let leColumns = this.bot.world.getColumns();
        this.chunkColumns = [];
        for (let i = 0; i < leColumns.length; i++) {
            if (!this.chunkColumns[leColumns[i].chunkZ]) {
                this.chunkColumns[leColumns[i].chunkZ] = [];
            }
            this.chunkColumns[leColumns[i].chunkZ][leColumns[i].chunkX] = true;
        }
        console.log(
            "BEFORE: " +
                this.lastPos +
                ", " +
                this.movesToGo[this.lastPos.currentMove] +
                ", length: " +
                this.movesToGo.length
        );
        this.bot.clearControlStates();
        //let currentMovePos = {"x":movesToGo[lastPos.currentMove].x,"y":movesToGo[lastPos.currentMove].y,"z":movesToGo[lastPos.currentMove].z};
        let movesToGoLength = this.movesToGo.length;
        if (!extension) {
            this.lastPos = {
                currentMove: 0,
                x: Math.floor(this.bot.entity.position.x),
                y: Math.floor(this.bot.entity.position.y),
                z: Math.floor(this.bot.entity.position.z),
            };
        }
        if (!correction && !extension) {
            this.nodes = [];
            this.nodes3d = [];
            this.openNodes = [];
            this.movesToGo = [];
        } else if (correction) {
            this.nodes = [];
            this.nodes3d = [];
            this.openNodes = [];
            let bestOne = [0, 10000];
            for (let i = 0; i < this.movesToGo.length; i++) {
                if (
                    dist3d(
                        this.movesToGo[i].x,
                        this.movesToGo[i].y,
                        this.movesToGo[i].z,
                        Math.round(this.bot.entity.position.x),
                        Math.floor(this.bot.entity.position.y - 1),
                        Math.round(this.bot.entity.position.z)
                    ) < bestOne[1]
                ) {
                    bestOne = [
                        i,
                        dist3d(
                            this.movesToGo[i].x,
                            this.movesToGo[i].y,
                            this.movesToGo[i].z,
                            Math.round(this.bot.entity.position.x),
                            Math.floor(this.bot.entity.position.y),
                            Math.round(this.bot.entity.position.z)
                        ),
                    ];
                }
            }
            if (bestOne[0] + 1 < this.movesToGo.length) {
                this.movesToGo.splice(bestOne[0] + 1, this.movesToGo.length);
            }
            endX = this.movesToGo[bestOne[0]].x;
            endY = this.movesToGo[bestOne[0]].y;
            endZ = this.movesToGo[bestOne[0]].z;
            // console.log(this.movesToGo[bestOne[0]]);
        } else if (extension) {
            this.nodes = [];
            this.openNodes = [];
            this.nodes3d = [];
            let bestOne = [0, 100000];
            for (let i = 0; i < this.movesToGo.length; i++) {
                if (dist3d(this.movesToGo[i].x, this.movesToGo[i].y, this.movesToGo[i].z, endX, endY as number, endZ) < bestOne[1]) {
                    bestOne = [i, dist3d(this.movesToGo[i].x, this.movesToGo[i].y, this.movesToGo[i].z, endX, endY as number, endZ)];
                }
            }
            //let bestOne = [0, dist3d(movesToGo[movesToGo.length - 1].x, movesToGo[movesToGo.length - 1].y, movesToGo[movesToGo.length - 1].z, endX, endY, endZ)];
            bestOne[0] += 10;
            if (bestOne[0] > this.movesToGo.length - 6) {
                bestOne[0] = this.movesToGo.length - 6;
            }
            if (bestOne[0] >= 0) {
                this.lastPos.currentMove -= bestOne[0] + 1;
                this.movesToGo.splice(0, bestOne[0] + 1);
            }
            /*if (movesToGo.length < 10) {
                movesToGo = [];
                console.log(movesToGo.length);
                lastPos = {"currentMove":0,"x":Math.floor(bot.entity.position.x), "y":Math.floor(bot.entity.position.y), "z":Math.floor(bot.entity.position.z),};
                extension = false;
            }*/
        } /*else if (extension) {
            nodes = [];
            openNodes = [];
            nodes3d = [];
            let bestOne = [0, 10000];
            for (let i = 0; i < movesToGo.length; i++) {
                if (dist3d(movesToGo[i].x, movesToGo[i].y, movesToGo[i].z, endX, endY, endZ) < bestOne[1]) {
                    bestOne = [i, dist3d(movesToGo[i].x, movesToGo[i].y, movesToGo[i].z, endX, endY, endZ)];
                }
            }
            if (bestOne[0] += 7) {
                if (bestOne[0] > movesToGo.length - 1) {bestOne[0] = movesToGo.length - 1;}
            }
            movesToGo.splice(0, bestOne[0] + 1);
            let foundCurrentMove = false;
            if (movesToGo.length - 1 < lastPos.currentMove && lastPos.currentMove) {
                console.log(lastPos.currentMove);
                for (let i = 0; i < movesToGo.length; i++) {
                    if (movesToGo[lastPos.currentMove] &&
                        movesToGo[i].x == movesToGo[lastPos.currentMove].x &&
                        movesToGo[i].y == movesToGo[lastPos.currentMove].y &&
                        movesToGo[i].z == movesToGo[lastPos.currentMove].z) {
                        lastPos.currentMove = i;
                        foundCurrentMove = true;
                    }
                }
            }
            if (!foundCurrentMove) {
                //lastPos.currentMove -= Math.abs(movesToGo.length - movesToGoLength);
                lastPos.currentMove = movesToGo.length - 1;
                if (lastPos.currentMove < 0) {lastPos.currentMove = 0;}
            }
            console.log("lastPos found: " + foundCurrentMove + ", " + lastPos.currentMove);
            //endX = movesToGo[bestOne[0]].x;
            //endY = movesToGo[bestOne[0]].y;
            //endZ = movesToGo[bestOne[0]].z;
            //console.log(movesToGo[bestOne[0]]);
        }*/

        let foundPath = false;
        if (!extension || this.movesToGo.length == 0) {
            this.addNode(
                undefined,
                0,
                0,
                Math.floor(this.bot.entity.position.x),
                Math.floor(this.bot.entity.position.y),
                Math.floor(this.bot.entity.position.z),
                "start",
                [],
                false,
                false,
                []
            );
        } else if (this.movesToGo.length > 0) {
            console.log(
                "x: " + this.movesToGo[0].x + ", y: " + this.movesToGo[0].y + ", z: " + this.movesToGo[0].z + " " + this.movesToGo.length
            );
            this.addNode(undefined, 0, 0, this.movesToGo[0].x, this.movesToGo[0].y, this.movesToGo[0].z, "start", [], false, false, []);
        }
        let attempts = 0;
        let maxAttempts = 0;
        let bestNode = this.nodes[0];
        //console.log(bestNode.blockActions);
        let findingPath = setInterval(() => {
            this.bestNodeIndex = 0;
            //console.log("searching...");
            this.botSearchingPath = 10;
            if (!extension) {
                this.botDestinationTimer = 30;
            }
            this.moveTimer = 10;
            let performanceStop = process.hrtime();
            while (
                !foundPath &&
                attempts < 7500 &&
                (process.hrtime(performanceStop)[0] * 1000000000 + process.hrtime(performanceStop)[1]) / 1000000 < 40
            ) {
                attempts++;
                /*for (let i = 0; i < nodes.length; i++) {
                if (!nodes[i].open) {continue;}
                if (nodes[i].fCost + nodes[i].hCost < bestNode.fCost + bestNode.hCost || !bestNode.open) {
                    bestNode = nodes[i];
                }
            }*/
                this.bestNodeIndex = 0;
                bestNode = this.openNodes[0];
                //console.log(bestNode.blockActions);
                /*for (let i = 0; i < openNodes.length; i++) {
                if (i > 0 && !bestNode.open) {console.log(JSON.stringify(bestNode) + ", :/ " + i);}
                if (openNodes[i].fCost == undefined || i > 1 && (openNodes[i].fCost + openNodes[i].hCost) < (openNodes[Math.floor((i - 1) / 2)].fCost + openNodes[Math.floor((i - 1) / 2)].hCost)) {console.log("Time for debugging: " + i);}
                if (openNodes[i].fCost + openNodes[i].hCost < bestNode.fCost + bestNode.hCost || !bestNode.open) {
                    bestNode = openNodes[i];
                    bestNodeIndex = i;
                }
            }*/
                if (this.bestNodeIndex != 0) {
                    console.log("OOF: openNode length: " + this.openNodes.length + ", bestNodeIndex: " + this.bestNodeIndex);
                }
                //bestNodeIndex = 0;
                //openNodes.splice(bestNodeIndex, 1);
                this.popHeap(bestNode);
                //console.log(bestNode.blockActions);
                let bestNodeWasOpen = bestNode.open;
                bestNode.open = false;
                let chunkAvailible = false;
                if (this.checkChunk(bestNode.x, bestNode.z)) {
                    chunkAvailible = true;
                }
                if (
                    (endZ != undefined && bestNode.x == endX && bestNode.y == endY && bestNode.z == endZ) ||
                    (endZ == undefined && bestNode.x == endX && bestNode.z == endY) ||
                    !chunkAvailible
                ) {
                    this.botPathfindTimer = 0;
                    foundPath = true;
                    console.log("Found path in " + attempts + " attempts.");
                    let atHome = false;
                    let steps = 0;
                    let ogreSection = this.movesToGo.length - 1; //original reference erray(thats how you spell array :P) section
                    let extender = [];
                    while ((!atHome || steps < 1000) && bestNode.parent != undefined) {
                        //console.log(bestNode.blockActions);
                        //console.log(steps);
                        //console.log(JSON.stringify(bestNode));
                        if (!extension) {
                            this.movesToGo.push({
                                mType: bestNode.moveType,
                                x: bestNode.x,
                                y: bestNode.y,
                                z: bestNode.z,
                                blockActions: bestNode.blockActions,
                                blockDestructions: bestNode.brokenBlocks,
                            });
                            console.log(JSON.stringify(this.movesToGo[this.movesToGo.length - 1]));
                        } else {
                            extender.push({
                                mType: bestNode.moveType,
                                x: bestNode.x,
                                y: bestNode.y,
                                z: bestNode.z,
                                blockActions: bestNode.blockActions,
                                blockDestructions: bestNode.brokenBlocks,
                            });
                            //movesToGo.unshift({"x":bestNode.x, "y":bestNode.y, "z":bestNode.z});
                        }
                        if (correction) {
                            for (let i = 0; i < ogreSection; i++) {
                                if (this.movesToGo[i] == bestNode.x && this.movesToGo[i] == bestNode.x && this.movesToGo[i] == bestNode.x) {
                                    while (
                                        this.movesToGo[ogreSection].x != bestNode.x &&
                                        this.movesToGo[ogreSection].y != bestNode.y &&
                                        this.movesToGo[ogreSection].z != bestNode.z
                                    ) {
                                        this.movesToGo.splice(ogreSection, 1);
                                        ogreSection--;
                                    }
                                    i = ogreSection;
                                } else {
                                    continue;
                                }
                            }
                        } else if (extension) {
                            for (let i = 0; i < this.movesToGo.length; i++) {
                                if (
                                    this.movesToGo[i].x == extender[extender.length - 1].x &&
                                    this.movesToGo[i].y == extender[extender.length - 1].y &&
                                    this.movesToGo[i].z == extender[extender.length - 1].z
                                ) {
                                    extender.splice(extender.length - 1, 1);
                                    i = this.movesToGo.length;
                                    //continue;
                                }
                            }
                        }
                        console.log("x: " + bestNode.x + " y: " + bestNode.y + "z: " + bestNode.z);
                        bestNode = bestNode.parent;
                        steps++;
                    }
                    if (extension) {
                        this.lastPos.currentMove += extender.length;
                        this.movesToGo = extender.concat(this.movesToGo);
                    }
                    this.bot.chat("I can be there in " + steps + " steps.");
                } else if (bestNodeWasOpen) {
                    //bot.chat("/particle flame " + bestNode.x + " " + bestNode.y + " " + bestNode.z);
                    /*if (bestNode.parent) {
                    console.log("bestNode.parent fCost vs this node fCost: " + (bestNode.fCost - bestNode.parent.fCost));
                }*/
                    //bot.chat("/setblock " + bestNode.x + " " + bestNode.y + " " + bestNode.z + " dirt");
                    if (chunkAvailible) {
                        //walking
                        this.validNode(bestNode, bestNode.x - 1, bestNode.y, bestNode.z, endX, endY as number, endZ);
                        this.validNode(bestNode, bestNode.x + 1, bestNode.y, bestNode.z, endX, endY as number, endZ);
                        this.validNode(bestNode, bestNode.x, bestNode.y, bestNode.z - 1, endX, endY as number, endZ);
                        this.validNode(bestNode, bestNode.x, bestNode.y, bestNode.z + 1, endX, endY as number, endZ);
                        //walking(diagnol)
                        this.validNode(bestNode, bestNode.x - 1, bestNode.y, bestNode.z - 1, endX, endY as number, endZ);
                        this.validNode(bestNode, bestNode.x + 1, bestNode.y, bestNode.z - 1, endX, endY as number, endZ);
                        this.validNode(bestNode, bestNode.x - 1, bestNode.y, bestNode.z + 1, endX, endY as number, endZ);
                        this.validNode(bestNode, bestNode.x + 1, bestNode.y, bestNode.z + 1, endX, endY as number, endZ);

                        //Falling
                        this.validNode(bestNode, bestNode.x, bestNode.y - 1, bestNode.z, endX, endY as number, endZ);
                        //Jumping
                        this.validNode(bestNode, bestNode.x, bestNode.y + 1, bestNode.z, endX, endY as number, endZ);
                    } else {
                        foundPath = true;
                        console.log("chunk border!");
                    }
                    /*validNode(bestNode, bestNode.x - 1, bestNode.y - 1, bestNode.z, endX, endY, endZ);
                validNode(bestNode, bestNode.x + 1, bestNode.y - 1, bestNode.z, endX, endY, endZ);
                validNode(bestNode, bestNode.x, bestNode.y - 1, bestNode.z - 1, endX, endY, endZ);
                validNode(bestNode, bestNode.x, bestNode.y - 1, bestNode.z + 1, endX, endY, endZ);
                //Falling(diagnol)
                validNode(bestNode, bestNode.x - 1, bestNode.y - 1, bestNode.z + 1, endX, endY, endZ);
                validNode(bestNode, bestNode.x + 1, bestNode.y - 1, bestNode.z + 1, endX, endY, endZ);
                validNode(bestNode, bestNode.x - 1, bestNode.y - 1, bestNode.z - 1, endX, endY, endZ);
                validNode(bestNode, bestNode.x + 1, bestNode.y - 1, bestNode.z - 1, endX, endY, endZ);*/
                }
                //openNodes.splice(bestNodeIndex, 1);
            }
            if (foundPath || maxAttempts >= 7500 /*|| botPathfindTimer > 20 * 3*/) {
                this.botSearchingPath = 0;
                this.botPathfindTimer = 0;
                clearInterval(findingPath);
                if (!extension) {
                    this.lastPos.currentMove = this.movesToGo.length - 1;
                }
                console.log(
                    "AFTER: " +
                        JSON.stringify(this.lastPos) +
                        ", " +
                        JSON.stringify(this.movesToGo[this.lastPos.currentMove]) +
                        ", length: " +
                        this.movesToGo.length
                );
            }
        }, 50);
    }

    takeCareOfBlock = (myMove: DunderMove) => {
        //console.log(bot.entity.isInWater);
        if (
            (this.bot.entity.onGround || this.bot.entity.isInWater || this.bot.entity.isInLava || isSwim(myMove.mType)) &&
            myMove.y + 0.2 < this.bot.entity.position.y &&
            this.blockSolid(myMove.x, myMove.y, myMove.z) &&
            dist3d(this.bot.entity.position.x, 0, this.bot.entity.position.z, myMove.x + 0.5, 0, myMove.z + 0.5) <= Math.sqrt(0.5) &&
            this.canDigBlock(myMove.x, myMove.y, myMove.z) &&
            !this.bot.targetDigBlock &&
            this.botDigDelay <= 0
        ) {
            this.equipTool( myMove.x, myMove.y, myMove.z);
            this.digBlock( myMove.x, myMove.y, myMove.z);
            this.botIsDigging = 2;
            console.log("DigDown Strict");
        } else if (
            (this.bot.entity.onGround || this.bot.entity.isInWater || this.bot.entity.isInLava || isSwim(myMove.mType)) &&
            myMove.y + 1.2 < this.bot.entity.position.y &&
            this.blockSolid(myMove.x, Math.floor(this.bot.entity.position.y - 0.2), myMove.z) &&
            dist3d(this.bot.entity.position.x, 0, this.bot.entity.position.z, myMove.x + 0.5, 0, myMove.z + 0.5) <= Math.sqrt(0.5) &&
            this.canDigBlock(myMove.x, Math.floor(this.bot.entity.position.y - 0.2), myMove.z) &&
            !this.bot.targetDigBlock &&
            this.botDigDelay <= 0
        ) {
            this.equipTool( myMove.x, Math.floor(this.bot.entity.position.y - 0.2), myMove.z);
            this.digBlock( myMove.x, Math.floor(this.bot.entity.position.y - 0.2), myMove.z);
            this.botIsDigging = 2;
            console.log("DigDown FreeStyle");
        } else if (
            (((this.bot.entity.onGround || this.bot.entity.isInWater || this.bot.entity.isInLava) &&
                (this.bot.entity.position.y >= myMove.y - 0.25) &&
                (this.bot.entity.position.y <= myMove.y + 0.25)) ||
                isSwim(myMove.mType)) &&
            !this.bot.targetDigBlock /*&& botDigDelay <= 0*/
        ) {
            //console.log("DigForward?");
            if (this.blockSolid(myMove.x, myMove.y + 1, myMove.z) && this.canDigBlock(myMove.x, myMove.y + 1, myMove.z)) {
                console.log("DigForward A");
                this.equipTool( myMove.x, myMove.y + 1, myMove.z);
                //console.log(bot.blockAt(new Vec3(myMove.x, myMove.y + 1, myMove.z)));
                this.digBlock( myMove.x, myMove.y + 1, myMove.z);
                this.botMove.forward = false;
                this.botMove.sprint = false;
                this.botIsDigging = 2;
                this.busyBuilding = true;
            } else if (
                !this.blockWalk(myMove.x, myMove.y, myMove.z) &&
                this.blockSolid(myMove.x, myMove.y, myMove.z) &&
                this.canDigBlock(myMove.x, myMove.y, myMove.z)
            ) {
                console.log("DigForward B");
                this.equipTool( myMove.x, myMove.y, myMove.z);
                this.digBlock( myMove.x, myMove.y, myMove.z);
                this.botMove.forward = false;
                this.botMove.sprint = false;
                this.botIsDigging = 2;
                this.busyBuilding = true;
            }
        } else if (
            (((this.bot.entity.onGround || this.bot.entity.isInWater || this.bot.entity.isInLava) &&
                (this.bot.entity.position.y >= myMove.y - 1.25) &&
                (this.bot.entity.position.y <= myMove.y + 0.25)) ||
                isSwim(myMove.mType)) &&
            !this.bot.targetDigBlock /*&& botDigDelay <= 0*/
        ) {
            //console.log("DigForward?");
            if (
                this.blockSolid(Math.floor(this.lastPos.x), myMove.y + 1, Math.floor(this.lastPos.z)) &&
                this.canDigBlock(Math.floor(this.lastPos.x), myMove.y + 1, Math.floor(this.lastPos.z))
            ) {
                console.log("Dig Up A");
                this.equipTool( Math.floor(this.lastPos.x), myMove.y + 1, Math.floor(this.lastPos.z));
                //console.log(bot.blockAt(new Vec3(myMove.x, myMove.y + 1, myMove.z)));
                this.digBlock( Math.floor(this.lastPos.x), myMove.y + 1, Math.floor(this.lastPos.z));
                this.botMove.forward = false;
                this.botMove.sprint = false;
                this.botMove.jump = false;
                this.botIsDigging = 2;
                this.busyBuilding = true;
            } else if (this.blockSolid( myMove.x, myMove.y + 1, myMove.z) && this.canDigBlock(myMove.x, myMove.y + 1, myMove.z)) {
                console.log("Dig Up B");
                this.equipTool( myMove.x, myMove.y + 1, myMove.z);
                //console.log(bot.blockAt(new Vec3(myMove.x, myMove.y + 1, myMove.z)));
                this.digBlock( myMove.x, myMove.y + 1, myMove.z);
                this.botMove.forward = false;
                this.botMove.sprint = false;
                this.botMove.jump = false;
                this.botIsDigging = 2;
                this.busyBuilding = true;
            } else if (
                !this.blockWalk( myMove.x, myMove.y, myMove.z) &&
                this.blockSolid( myMove.x, myMove.y, myMove.z) &&
                this.canDigBlock(myMove.x, myMove.y, myMove.z)
            ) {
                console.log("Dig Up C");
                this.equipTool( myMove.x, myMove.y, myMove.z);
                this.digBlock( myMove.x, myMove.y, myMove.z);
                this.botMove.forward = false;
                this.botMove.sprint = false;
                this.botMove.jump = false;
                this.botIsDigging = 2;
                this.busyBuilding = true;
            }
        } else if (myMove.mType == "goUp") {
            if (
                (this.bot.entity.onGround || this.bot.entity.isInWater || this.bot.entity.isInLava) &&
                this.blockSolid( myMove.x, myMove.y + 1, myMove.z) &&
                this.canDigBlock(myMove.x, myMove.y + 1, myMove.z)
            ) {
                console.log("Dig UP UP");
                this.equipTool( myMove.x, myMove.y + 1, myMove.z);
                //console.log(bot.blockAt(new Vec3(myMove.x, myMove.y + 1, myMove.z)));
                this.digBlock( myMove.x, myMove.y + 1, myMove.z);
                this.botMove.forward = false;
                this.botMove.sprint = false;
                this.botMove.jump = false;
                this.botIsDigging = 2;
                this.busyBuilding = true;
            } else if (this.breakAndPlaceBlock(myMove.x, myMove.y - 1, myMove.z, true)) {
                this.equipTool( myMove.x, myMove.y - 1, myMove.z);
                this.digBlock( myMove.x, myMove.y - 1, myMove.z);
                console.log("just a sec before pillaring...");
                this.busyBuilding = true;
            } else if (
                this.bot.entity.position.y > myMove.y - 1 &&
                (this.blockAir(myMove.x, myMove.y - 1, myMove.z) || this.blockAir(myMove.x, myMove.y, myMove.z))
            ) {
                this.botActions.equipAnyOfItems(scaffoldBlocks, "hand");
                //holdWeapon = false;
                this.botActions.placeBlock(
                    this.bot.blockAt(new Vec3(   myMove.x,
                        myMove.y - 1,
                        myMove.z,))!
                );
            }
        }
        if (
            /*!botIsDigging &&*/ !isSwim(myMove.mType) &&
            !this.bot.targetDigBlock &&
            !this.blockStand(myMove.x, myMove.y - 1, myMove.z) &&
            ((myMove.y == this.lastPos.y) &&
                (dist3d(this.bot.entity.position.x, 0, this.bot.entity.position.z, myMove.x + 0.5, 0, myMove.z + 0.5) <= Math.sqrt(0.5))) /*|
            myMove.y != lastPos.y & dist3d(bot.entity.position.x, 0, bot.entity.position.z, myMove.x + 0.5, 0, myMove.z + 0.5) <= dist3d(0, 0, 0, 3, 3, 3)*/
        ) {
            this.botMove.forward = false;
            this.botMove.sprint = false;
            this.botMove.sneak = true;
            if (
                dist3d(this.bot.entity.position.x, 0, this.bot.entity.position.z, this.lastPos.x + 0.5, 0, this.lastPos.z + 0.5) >=
                Math.sqrt(0.35)
            ) {
                this.botMove.back = true;
            }
            if (this.breakAndPlaceBlock(myMove.x, myMove.y - 1, myMove.z, true)) {
                this.equipTool( myMove.x, myMove.y - 1, myMove.z);
                this.digBlock( myMove.x, myMove.y - 1, myMove.z);
                console.log("just a sec before bridging...");
                this.busyBuilding = true;
            } else if (!this.bot.targetDigBlock && myMove.mType != "fall") {
                this.botActions.equipAnyOfItems(scaffoldBlocks, "hand");
                //holdWeapon = false;
                this.botActions.placeBlock(
                    this.bot.blockAt(new Vec3(myMove.x,
                        myMove.y - 1,
                        myMove.z))!
                );
                /*if (botSpeed <= 0.1 && lastPos.y <= myMove.y) {
                    bot.entity.position.x = lastPos.x + 0.5;
                    bot.entity.position.z = lastPos.z + 0.5;
                }*/
                console.log("placeblock");
                this.busyBuilding = true;
                this.botMove.faceBackwards = 4;
            }
        }
        if (!this.bot.targetDigBlock && this.botDestinationTimer > 30 && !this.busyBuilding && this.botIsDigging < 0) {
            this.botDestinationTimer = 30;
            console.log("not busy");
        }
    };
}
