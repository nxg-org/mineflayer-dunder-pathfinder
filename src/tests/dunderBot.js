/**
List is slightly outdated but whatever

BUGS:
Standing on soul sand, grass path, or any other non full blocks will cause the bot to think that it must mine below it when starting a path

TODO:
Bot path correction:
    splice begging of path
    stop movement when searching for a fix

BUGS:
    One block two block up and down off path (FIXED BY botDestination)
    Escape liquid
    Y level dependency (STILL WIP BUT PROGRESS MADE)
    Surface and dig/place costs (Look for same direction when digging or placing)
    Swim costs(almost fixed, just need to add biases for being at air)

POTENTIALLY FIXED:
    Sea grass
    Kelp
    Lilypads(Hacky solution)
*/

const mineflayer = require("mineflayer");
//const myPhysics = require("prismarine-physics");
const AABB = require("prismarine-physics/lib/aabb");
var Vec3 = require('vec3').Vec3;
const mineflayerViewer = require("prismarine-viewer").mineflayer;

function dist3d(x1, y1, z1, x2, y2, z2) {
    return Math.sqrt((x2 - x1)*(x2 - x1) + (y2 - y1)*(y2 - y1) + (z2 - z1)*(z2 - z1));
};

const bot = mineflayer.createBot({
    host: "localhost",
    host: "minecraft.next-gen.dev",
    port: 25565,
    // port: 62192,//25565 is the default
    username: "dunderBot",
    version: "1.16.5",
});
var chunkColumns = [];
function checkChunk(x, z) {
    var isTitle = false;
    if (chunkColumns[Math.floor(z / 16)] && chunkColumns[Math.floor(z / 16)][Math.floor(x / 16)]) {
        isTitle = true;
    }
    return isTitle;
};

var botRange = 3;
var attackTimer = 0;
var strafeDir = 0;
var strafeTimer = 0;
var moveTimer = 0;
var jumpTimer = 0;
var blockPackets = [];
var botDestinationTimer = 30;
var botSearchingPath = 10;
var botPathfindTimer = 0;
var botLookAtY = 0;
var botGoal = {x:0,y:0,z:0,reached:true};
var pathfinderOptions = {
    "maxFall":3,
    "maxFallClutch":256,
    "canClutch":true,
    "sprint":true,
    "parkour":true,
    "place":true,
    "break":true,
};

var digStrengths = {
    "rock":["netherite_pickaxe","diamond_pickaxe","iron_pickaxe","stone_pickaxe","golden_pickaxe","wooden_pickaxe"],
    "wood":["netherite_axe","diamond_axe","iron_axe","stone_axe","golden_axe","wooden_axe"],
    "dirt":["netherite_shovel","diamond_shovel","iron_shovel","stone_shovel","golden_shovel","wooden_shovel"],
    "plant":["netherite_hoe","diamond_hoe","iron_hoe","stone_hoe","golden_hoe","wooden_hoe","shears"],
    "web":["netherite_sword","diamond_sword","iron_sword","stone_sword","golden_sword","wooden_sword","shears"],
    "mineable/pickaxe":["netherite_pickaxe","diamond_pickaxe","iron_pickaxe","stone_pickaxe","golden_pickaxe","wooden_pickaxe"],
};

var garbageBlocks = ["diorite","granite","andesite","basalt","netherrack","dirt","stone","cobblestone",
                     "warped_planks","crimson_planks","jungle_planks","dark_oak_planks","acacia_planks","birch_planks","spruce_planks","oak_planks"];
//Nether brick
function breakAndPlaceBlock(bot, x, y, z, checkStand) {
    var myBlock = bot.blockAt(new Vec3(x, y, z));
    var shouldItBreak = false;
    if ((myBlock.shapes.length == 0 || checkStand && myBlock.shapes.length != 0 && !blockStand(bot, x, y, z)) && myBlock.name != "air" && myBlock.name != "cave_air" && myBlock.type != "void_air" &&
        myBlock.name != "lava" && myBlock.name != "flowing_lava" && myBlock.name != "water" && myBlock.name != "flowing_water") {
        shouldItBreak = true;
    }
    return shouldItBreak;
};

function isSwim(swimme) {
    var isTitle = false;
    if (swimme == "start" || swimme == "swimFast" || swimme == "swimSlow" || swimme == "lava" ||
        swimme == "fallWater" || swimme == "fallLava") {
        isTitle = true;
    }
    return isTitle;
};

function isBlock(bot, x, y, z, zeNode) {
    var myBlock = bot.blockAt(new Vec3(x, y, z));
    var walkThrough = 1;
    if (myBlock == undefined) {console.log(x + ", " + y + ", " + z + ", " + myBlock);}
    if (myBlock.type == 0) {
        walkThrough = 0;
    } else if (myBlock.displayName == "Lava" || myBlock.displayName == "Flowing_Lava") {
        walkThrough = 2;
    } else if (myBlock.displayName == "Water") {
        walkThrough = 3;
    } else if (myBlock.shapes.length == 0) {
        walkThrough = 0;
    }
    if (zeNode) {while (zeNode.parent) {
        for (var i = 0; i < zeNode.brokenBlocks.length; i++) {
            if (zeNode.brokenBlocks[i][0] == x && zeNode.brokenBlocks[i][1] == y && zeNode.brokenBlocks[i][2] == z) {
                walkThrough = 0;
                i = zeNode.brokenBlocks.length;
            } else {
                continue;
            }
        }
        zeNode = zeNode.parent;
    }}
    return walkThrough;
};

function blockDiggable(bot, x, y, z) {
    var myBlock = bot.blockAt(new Vec3(x, y, z));
    var isTitle = true;
    if (!myBlock || !myBlock.hardness) {isTitle = false;}
    return isTitle;
};

function blockStand(bot, x, y, z, zeNode) {
    var myBlock = bot.blockAt(new Vec3(x, y, z));
    //console.log("blockStand: " + myBlock.shapes.length);
    var isTitle = false;
    if (myBlock && myBlock.shapes.length == 1 && myBlock.shapes[0][0] <= 0.126 && myBlock.shapes[0][2] <= 0.126 &&
        myBlock.shapes[0][3] >= 1 - 0.126 && myBlock.shapes[0][4] >= 1 - 0.126 && myBlock.shapes[0][4] <= 1 + 0.126 && myBlock.shapes[0][5] >= 1 - 0.126) {
        isTitle = true;
    }
    if (zeNode) {
        while (zeNode.parent) {
            for (var i = 0; i < zeNode.brokenBlocks.length; i++) {
                if (zeNode.brokenBlocks[i][0] == x && zeNode.brokenBlocks[i][1] == y && zeNode.brokenBlocks[i][2] == z) {
                    isTitle = false;
                    i = zeNode.brokenBlocks.length;
                } else {
                    continue;
                }
            }
            zeNode = zeNode.parent;
        }
    }
    return isTitle;
};

function blockWalk(bot, x, y, z, zeNode, waterAllowed, lavaAllowed) {
    var myBlock = bot.blockAt(new Vec3(x, y, z));
    //console.log("blockStand: " + myBlock.shapes.length);
    var isTitle = false;
    if (myBlock && myBlock.type != 94 && !blockWater(bot, x, y, z) | waterAllowed && !blockLava(bot, x, y, z) | lavaAllowed) {
        if (myBlock && myBlock.shapes.length == 0 || myBlock && myBlock.shapes.length == 1 && myBlock.shapes[0].length == 6 && myBlock.shapes[0][4] <= 0.2) {
            isTitle = true;
            //console.log(myBlock.shapes.length);
            //if (myBlock.shapes.length == 1) {console.log(myBlock.shapes[0].length);}
        }
    }
    if (zeNode) {
        while (zeNode.parent) {
            for (var i = 0; i < zeNode.brokenBlocks.length; i++) {
                if (zeNode.brokenBlocks[i][0] == x && zeNode.brokenBlocks[i][1] == y && zeNode.brokenBlocks[i][2] == z) {
                    isTitle = false;
                    i = zeNode.brokenBlocks.length;
                } else {
                    continue;
                }
            }
            zeNode = zeNode.parent;
        }
    }
    return isTitle;
};

function slabSwimTarget(bot, x, y, z) {
    var myBlock = bot.blockAt(new Vec3(x, y, z));
    var myValue = 0;
    if (myBlock && myBlock.shapes.length == 1 && myBlock.shapes[0].length == 6 && myBlock.shapes[0][4]) {
        myValue = myBlock.shapes[0][4];
    }
    return myValue;
};

function blockSolid(bot, x, y, z, zeNode) {
    var myBlock = bot.blockAt(new Vec3(x, y, z));
    //console.log("blockSolid: " + myBlock.shapes.length);
    var isTitle = false;
    if (myBlock && myBlock.shapes.length > 0 | myBlock.type == 94) {
        isTitle = true;
    }
    if (zeNode) {
        while (zeNode.parent) {
            for (var i = 0; i < zeNode.brokenBlocks.length; i++) {
                if (zeNode.brokenBlocks[i][0] == x && zeNode.brokenBlocks[i][1] == y && zeNode.brokenBlocks[i][2] == z) {
                    isTitle = false;
                    i = zeNode.brokenBlocks.length;
                } else {
                    continue;
                }
            }
            zeNode = zeNode.parent;
        }
    }
    return isTitle;
    
};
function blockAir(bot, x, y, z) {
    var myBlock = bot.blockAt(new Vec3(x, y, z));
    //console.log("blockAir: " + myBlock.shapes.length);
    var isTitle = false;
    //water, lava, and seagrass, are all not air.
    if (myBlock && myBlock.type == 27 | myBlock.type == 26 | myBlock.type == 94 | myBlock.type == 98 | myBlock.type == 99 | myBlock.type == 574 | myBlock.type == 575) {
        isTitle = false;
    } else if (myBlock && myBlock.shapes.length == 0) {
        isTitle = true;
    }
    return isTitle;
};
function blockCobweb(bot, x, y, z) {
    var myBlock = bot.blockAt(new Vec3(x, y, z));
    //console.log("blockAir: " + myBlock.shapes.length);
    var isTitle = false;
    if (myBlock && myBlock.type == 94) {
        isTitle = true;
    }
    return isTitle;
};

function blockLilypad(bot, x, y, z) {
    var myBlock = bot.blockAt(new Vec3(x, y, z));
    var isTitle = false;
    if (myBlock && myBlock.type == 254) {
        isTitle = true;
    }
    return isTitle;
};

function blockWater(bot, x, y, z) {
    var myBlock = bot.blockAt(new Vec3(x, y, z));
    var isTitle = false;
    if (myBlock && myBlock.type == 26 | myBlock.type == 98 | myBlock.type == 99 | myBlock.type == 574 | myBlock.type == 575) {
        isTitle = true;
    }
    return isTitle;
};
function blockLava(bot, x, y, z) {
    var myBlock = bot.blockAt(new Vec3(x, y, z));
    var isTitle = false;
    if (myBlock && myBlock.type == 27) {
        isTitle = true;
    }
    return isTitle;
};

function getDigTime(bot, x, y, z, inWater, useTools) {
    var myBlock = bot.blockAt(new Vec3(x, y, z));
    var myDigTime = 0;
    var myItem = null;
    var equipTries = 0;
    if (useTools && myBlock && myBlock.material) {
        var inven = bot.inventory.slots;
        var itemNames = digStrengths[myBlock.material];
        if (itemNames) {
            while (myItem == null && equipTries < itemNames.length) {
                //console.log(itemNames[equipTries]);
                for (var i = 0; i < inven.length; i++) {
                    if (inven[i] == null) {
                        continue;
                   } else if (inven[i].name == itemNames[equipTries]) {
                        myItem = inven[i].type;
                        i = inven.length;
                    } else {
                        //console.log(inven[i].name);
                    }
                }
                equipTries++;
            }
        }
    }

    if (myBlock) {
        //if (myItem) {console.log(myItem);}
        myDigTime = myBlock.digTime(myItem, false, inWater, false, [], {});
        if (blockWater(bot, x, y, z) || blockLava(bot, x, y, z)) {
            myDigTime = 0;
        } else if (myBlock.hardness >= 100 || myBlock.hardness == null) {
            myDigTime = 9999999;
        }
    }
    return myDigTime;
};

var equipPackets = [];
function equipItem(bot, itemNames, dest) {
    //console.log(bot.inventory);
    var inven = bot.inventory.slots;
    var equippedItem = -1;
    var equipTries = 0;
    if (dest == undefined) {dest = "hand";}
    while (equippedItem < 0 && equipTries < itemNames.length) {
        //console.log(itemNames[equipTries]);
        for (var i = 0; i < inven.length; i++) {
            if (inven[i] == null) {
                continue;
            } else if (inven[i].name == itemNames[equipTries]) {
                equippedItem = i;
                i = inven.length;
            } else {
                //console.log(inven[i].name);
            }
        }
        equipTries++;
    }
    if (equippedItem == bot.quickBarSlot + 36 && dest == "hand") {
        equippedItem = -1;
        //console.log("no need");
    }
    for (var i = 0; i < equipPackets.length; i++) {
        if (equipPackets[i].slot == equippedItem && equipPackets[i].destination == dest) {
            equippedItem = -1;
        }
    }
    if (equippedItem > 0) {
        var needsToGo = true;
        for (var i = 36; i < 43; i++) {
            if (inven[i] == null) {
                needsToGo = false;
            }
        }
        equipPackets.push({"slot":equippedItem, "destination":dest, "time":70});
        //attackTimer = 0;
        bot.equip(inven[equippedItem], dest, function(e) {
            //console.log("canEquip: " + e);
            for (var i = 0; i < equipPackets.length; i++) {
                if (equipPackets[i].slot == equippedItem && equipPackets[i].destination == dest) {
                    equipPackets.splice(i, 1);
                }
            }
            console.log(bot.quickBarSlot + ", " + equippedItem);
            //attackTimer = 0;
        });
    }
    //console.log(itemNames + ", " + equippedItem);
};

function equipTool(bot, x, y, z) {
    var material = bot.blockAt(new Vec3(x, y, z));
    console.log(JSON.stringify(material.material));
    if (material && material.material != undefined && digStrengths[material.material] != undefined) {
        equipItem(bot, digStrengths[material.material]);
        //console.log(material);
    }
};

function getPlacedBlock(x, y, z) {
    var returnTrue = false;
    for (var i = 0; i < blockPackets.length; i++) {
        if (blockPackets[i].x == x && blockPackets[i].y == y && blockPackets[i].z == z) {
            returnTrue = true;
            i = blockPackets.length;
        }
    }
    return returnTrue;
};

function canDigBlock(bot, x, y, z) {
    var myBlock = bot.blockAt(new Vec3(x, y, z));
    var isTitle = false;
    if (myBlock) {
        isTitle = bot.canDigBlock(myBlock);
    }
    return isTitle;
};

function placeBlock(bot, x, y, z, placeBackwards) {
    bot.stopDigging();
    var canPlace = false;
    var placeOffSet = new Vec3(0, 0, 0);
    equipItem(bot, garbageBlocks, "hand");
    //(!!!) might need to make them negative
    if (bot.blockAt(new Vec3(x, y, z)).shapes.length > 0) {
        canPlace = false;
    } else if (getPlacedBlock(x, y + 1, z) || bot.blockAt(new Vec3(x, y + 1, z))) {
        canPlace = true;
        placeOffSet = new Vec3(0, 1, 0);
    } else if (getPlacedBlock(x, y - 1, z) ||bot.blockAt(new Vec3(x, y - 1, z)).shapes.length > 0) {
        canPlace = true;
        placeOffSet = new Vec3(0, -1, 0);
    } else if (getPlacedBlock(x + 1, y, z) || bot.blockAt(new Vec3(x + 1, y, z)).shapes.length > 0) {
        canPlace = true;
        placeOffSet = new Vec3(1, 0, 0);
    } else if (getPlacedBlock(x - 1, y, z) || bot.blockAt(new Vec3(x - 1, y, z)).shapes.length > 0) {
        canPlace = true;
        placeOffSet = new Vec3(-1, 0, 0);
    } else if (getPlacedBlock(x, y, z + 1) || bot.blockAt(new Vec3(x, y, z + 1)).shapes.length > 0) {
        canPlace = true;
        placeOffSet = new Vec3(0, 0, 1);
    } else if (getPlacedBlock(x, y, z - 1) || bot.blockAt(new Vec3(x, y, z - 1)).shapes.length > 0) {
        canPlace = true;
        placeOffSet = new Vec3(0, 0, -1);
    }
    for (var i = 0; i < blockPackets.length; i++) {
        if (blockPackets[i].x == x && blockPackets[i].y == y && blockPackets[i].z == z) {
            canPlace = false;
            i = blockPackets.length;
        }
    }
    if (bot.targetDigBlock) {canPlace = false;}
    if (canPlace) {
        blockPackets.push({"x":x,"y":y,"z":z});
        bot.lookAt(new Vec3(x, y, z), 100);
        //attackTimer = 0;
        bot.placeBlock(bot.blockAt(new Vec3(x, y, z)), placeOffSet, function(e) {
            //attackTimer = 0;
            console.log("alerted " + e);
            for (var i = 0; i < blockPackets.length; i++) {
                if (blockPackets[i].x == x && blockPackets[i].y == y && blockPackets[i].z == z) {
                    blockPackets.splice(i, 1);
                    i = blockPackets.length;
                }
            }
        });
        var swingArmPls = true;
        for (var i = 0; i < blockPackets.length; i++) {
            if (blockPackets[i].x == x && blockPackets[i].y == y && blockPackets[i].z == z) {
                swingArmPls = false;
            }
        }
       if (swingArmPls) {
           bot.swingArm();
       }
       bot.swingArm();
    }
    //console.log("placed block: " + canPlace);
};

function digBlock(bot, x, y, z) {
    var canMine = true;
    for (var i = 0; i < equipPackets.length; i++) {
        if (equipPackets[i].destination == "hand") {
            canMine = false;
        }
    }
    botLookAtY = y;
    if (canMine && !bot.targetDigBlock) {
        botDestinationTimer = 30 + getDigTime(bot, x, y, z, bot.entity.isInWater, true);
        //console.log(getDigTime(bot, x, y, z, false, !inWater) + ", " + botDestinationTimer);
        bot.dig(bot.blockAt(new Vec3(x, y, z)));
    }
};

var surroundingBlocks = [];

var destination = [0, 0, 0];
var nodes = [];
var openNodes = [];
var nodes3d = [];
var lastPos = {"currentMove":0,x:0,y:0,z:0};
var saveBlock = {"x":0,"y":0,"z":0,"dist":1000,"works":false};
function addNode(parent, fcost, hcost, x, y, z, moveType, brokenBlocks, brokeBlocks, placedBlocks) {
    var parentFCost = fcost;
    if (parent) {
        parentFCost += parent.fCost;
    }
    pushHeap({"parent":parent, "fCost":parentFCost, "hCost":hcost, "x":x, "y":y, "z":z, "open":true, "moveType":moveType, "brokenBlocks":brokenBlocks, "brokeBlocks":brokeBlocks, "placedBlocks":placedBlocks});
    if (nodes3d[y] == undefined) {nodes3d[y] = [];}
    if (nodes3d[y][z] == undefined) {nodes3d[y][z] = [];}
    nodes3d[y][z][x] = nodes[nodes.length - 1];
    //bot.chat("/setblock " + x + " 10 " + z + " cobblestone");
    //bot.chat("fCost " + parentFCost);
};

function validNode(node, x, y, z, endX, endY, endZ, type) {
    var waterSwimCost = 4;
    var placeBlockCost = 10;//30
    var breakBlockCost = 0;//0.045
    //breakBlockCost = 3 / 1000;
    //breakBlockCost = 0;
    var breakBlockCost2 = 10;//0.045
    if (botPathfindTimer > 20 * 4) {
        breakBlockCost2 = 2;
        console.log("way too long");
    } else if (botPathfindTimer > 20 * 2) {
        breakBlockCost2 = 5;
        console.log("too long");
    }
    if (y <= 60) {
        //breakBlockCost = 0.00035;
        //placeBlockCost = 20;
    } else if (y >= 90) {
        placeBlockCost = 3;
        //breakBlockCost = 20;
    }
    var ownerNodeUndefined = false;
    var myFCost = 0;
    var legalMove = false;
    var ughType = 0;
    var brokenBlocks = [];
    var brokeBlocks = false;
    var placedBlocks = false;
    var moveType = "walk";

    if (Math.abs(node.x - x) == 1 && Math.abs(node.z - z) == 1 && node.y == y) {//DIAGNOL WALK
        moveType = "walkDiag";
        ughType = 1;
        myFCost = 14;
        if (blockWalk(bot, node.x, y, z) & blockAir(bot, node.x, y + 1, z) |
            blockWalk(bot, x, y, node.z) & blockAir(bot, x, y + 1, node.z) && 
            blockWalk(bot, x, y, z) && blockAir(bot, x, y + 1, z) && 
            blockStand(bot, x, y - 1, z, node)) {legalMove = true;}
        if (legalMove &&
            blockCobweb(bot, node.x, y, z) | blockCobweb(bot, node.x, y + 1, z) |
            blockCobweb(bot, x, y, node.z) | blockCobweb(bot, x, y + 1, node.z)) {
                myFCost += 45;
                //console.log("Semi-Blocked move: " + x + ", " + y + ", " + z);
            }
        /*if (legalMove &&
            blockSolid(bot, node.x, y, z) | blockSolid(bot, node.x, y + 1, z) |
            blockSolid(bot, x, y, node.z) | blockSolid(bot, x, y + 1, node.z)) {
                //myFCost += 35;
                //console.log("Semi-Blocked move: " + x + ", " + y + ", " + z);
            }*/
        if (legalMove && blockLava(bot, node.x, y, z) || blockLava(bot, node.x, y + 1, z) ||
            blockLava(bot, x, y, node.z) || blockLava(bot, x, y + 1, node.z)) {
            legalMove = false;
        }
        if (!legalMove) {
            //validNode(node, x, y + 1, z, endX, endY, endZ);
            var blockWaterCount = blockWater(bot, x, y, z) + blockWater(bot, x, y + 1, z);
            var blockAirCount = blockAir(bot, x, y, z) + blockAir(bot, x, y + 1, z);
            //console.log(blockWaterCount + " : " + blockAirCount);
            if (blockWaterCount == 2 || blockWaterCount == 1 && blockAirCount == 1) {
                legalMove = true;
                if (/*!blockWater(bot, node.x, y, z) && !blockAir(bot, node.x, y, z) ||
                    !blockWater(bot, node.x, y + 1, z) && !blockAir(bot, node.x, y + 1, z) ||
                    !blockWater(bot, x, y, node.z) && !blockAir(bot, x, y, node.z) ||
                    !blockWater(bot, x, y + 1, node.z) && !blockAir(bot, x, y + 1, node.z)*/
                    blockSolid(bot, x, y, node.z) || blockSolid(bot, x, y + 1, node.z) ||
                    blockSolid(bot, node.x, y, z) || blockSolid(bot, node.x, y + 1, z)) {
                    legalMove = false;         
                } else if (pathfinderOptions.sprint && node.moveType == "swimFast" | blockWater(bot, x, y, z) & blockWater(bot, x, y + 1, z)) {
                    moveType = "swimFast";
                } else {
                    moveType = "swimSlow";
                    myFCost += 5;
                    if (blockSolid(bot, x, y + 2, z) || blockSolid(bot, node.x, y + 2, node.z) ||
                        blockSolid(bot, node.x, y + 2, z) || blockSolid(bot, x, y + 2, node.z)) {
                        myFCost += 35;
                    }
                    if (blockWater(bot, x, y + 1, z)) {myFCost *= 2;}
                }
            }
            if (!legalMove) {
                var blockLavaCount = blockLava(bot, x, y, z) + blockLava(bot, x, y + 1, z);
                if (blockLavaCount == 2 || blockLavaCount == 1 && blockAirCount == 1) {
                    legalMove = true;
                    if (!blockLava(bot, node.x, y, z) && !blockWalk(bot, node.x, y, z) ||
                        !blockLava(bot, node.x, y + 1, z) && !blockAir(bot, node.x, y + 1, z) ||
                        !blockLava(bot, x, y, node.z) && !blockWalk(bot, x, y, node.z) ||
                        !blockLava(bot, x, y + 1, node.z) && !blockAir(bot, x, y + 1, node.z)) {
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
            if (!blockSolid(bot, x, y - 1, z) && !blockSolid(bot, x, y, z)) {
                validNode(node, x, y - 1, z, endX, endY, endZ);
            }
            if (pathfinderOptions.parkour && !legalMove && !blockStand(bot, x, y - 1, z, node) && blockAir(bot, x, y, z)) {//JUMP DIAGNOL
                moveType = "walkDiagJump";
                //parkour move
                var stepDir = {"x":x - node.x, "z":z - node.z};
                if (blockAir(bot, x, y + 1, z) && blockAir(bot, x, y + 2, z)) {
                    //x += stepDir.x;
                    //z += stepDir.z;
                    var checkCount = 0;
                    if (/*!blockStand(bot, x, y - 1, z) ||*/
                        !blockAir(bot, node.x, y + 2, node.z) ||
                        !blockWalk(bot, x, y, z) ||
                        !blockAir(bot, x, y + 1, z) ||
                        !blockAir(bot, x, y + 2, z) ||
                        !blockWalk(bot, x - stepDir.x, y, z) ||
                        !blockAir(bot, x - stepDir.x, y + 1, z) ||
                        !blockAir(bot, x - stepDir.x, y + 2, z) ||
                        !blockWalk(bot, x, y, z - stepDir.z) ||
                        !blockAir(bot, x, y + 1, z - stepDir.z) ||
                        !blockAir(bot, x, y + 2, z - stepDir.z)) {
                        checkCount = 3;
                    }
                    while (!legalMove && checkCount < 2) {
                        checkCount++;
                        x += stepDir.x;
                        z += stepDir.z;
                        if (/*!blockStand(bot, x, y - 1, z) ||*/
                            !blockWalk(bot, x, y, z) ||
                            !blockAir(bot, x, y + 1, z) ||
                            !blockAir(bot, x, y + 2, z) ||
                            !blockWalk(bot, x - stepDir.x, y, z) ||
                            !blockAir(bot, x - stepDir.x, y + 1, z) ||
                            !blockAir(bot, x - stepDir.x, y + 2, z) ||
                            !blockWalk(bot, x, y, z - stepDir.z) ||
                            !blockAir(bot, x, y + 1, z - stepDir.z) ||
                            !blockAir(bot, x, y + 2, z - stepDir.z)) {
                            checkCount += 3;
                            //console.log("boo " + x + ", " + y + ", " + z);
                        } else if (blockStand(bot, x, y - 1, z, node)) {
                            legalMove = true;
                            //console.log("e " + x + ", " + y + ", " + z);
                        }
                        if (checkCount == 1 && !pathfinderOptions.sprint) {checkCount = 3;}
                    }
                }
            }
        }
    } else if (Math.abs(node.x - x) == 1 | Math.abs(node.z - z) == 1 && node.y == y) {//STRAIGHT WALK
        moveType = "walk";
        ughType = 2;
        myFCost = 10;
        if (blockWalk(bot, x, y, z) && blockAir(bot, x, y + 1, z) && blockStand(bot, x, y - 1, z, node)) {legalMove = true;}
        var oldX = x;
        var oldZ = z;
        if (!legalMove) {
            validNode(node, x, y + 1, z, endX, endY, endZ);
            moveType = "walkJump";
            //Parkour move
            var stepDir = {"x":x - node.x, "z":z - node.z};
            var blockWaterCount = blockWater(bot, x, y, z) + blockWater(bot, x, y + 1, z);
            var blockAirCount = blockAir(bot, x, y, z) + blockAir(bot, x, y + 1, z);
            if (blockWaterCount == 2 || blockWaterCount == 1 && blockAirCount == 1) {
                legalMove = true;
                if (pathfinderOptions.sprint && node.moveType == "swimFast" | blockWater(bot, x, y, z) & blockWater(bot, x, y + 1, z)) {
                    moveType = "swimFast";
                } else {
                    moveType = "swimSlow";
                    if (blockWater(bot, x, y + 1, z)) {myFCost *= 2;}
                }
            }
            if (!legalMove) {
                var blockLavaCount = blockLava(bot, x, y, z) + blockLava(bot, x, y + 1, z);
                if (blockLavaCount == 2 || blockLavaCount == 1 && blockAirCount == 1) {
                    legalMove = true;
                    moveType = "lava";
                    if (node.moveType != "lava") {
                        myFCost += 1000;
                    } else {
                        myFCost += 20;
                    }
                }
            }
            if (!blockSolid(bot, x, y - 1, z) && !blockSolid(bot, x, y, z)) {
                validNode(node, x, y - 1, z, endX, endY, endZ);
            }
            if (pathfinderOptions.parkour && !legalMove && blockAir(bot, x, y - 1, z) && blockAir(bot, x, y, z)) {
                //validNode(node, x, y - 1, z, endX, endY, endZ);
                var checkCount = 0;
                if (!blockAir(bot, node.x, node.y + 2, node.z) ||
                    !blockAir(bot, x, y, z) && !blockWalk(bot, x, y, z) | !blockAir(bot, x, y + 2, z) ||
                    !blockAir(bot, x, y + 1, z)) {
                    checkCount = 3;
                    //console.log("fail");
                }
                while (!legalMove && checkCount < 3) {
                    checkCount++;
                    x += stepDir.x;
                    z += stepDir.z;
                    if (!blockAir(bot, x, y, z) && !blockWalk(bot, x, y, z) | !blockAir(bot, x, y + 2, z) || !blockAir(bot, x, y + 1, z) || !blockAir(bot, x - stepDir.x, y + 2, z - stepDir.z)) {
                        checkCount += 3;
                    } else if (blockStand(bot, x, y - 1, z, node)) {
                        legalMove = true;
                        //myFCost += checkCount * 8;
                    }
                    if (checkCount == 1 && !pathfinderOptions.sprint) {checkCount = 3;}
                }
            }
        }
        if (!legalMove/* && blockAir(bot, x, y, z) && blockAir(bot, x, y + 1, z)*/) {
            var myExplorer = node;
            var placedBlocksInPast = 0; 
            var exploreCount = 0;
            var pastConforms = {
                "conforms":false,
                "x0":0,
                "x1":0,
                "y0":0,
                "y1":0,
                "z0":0,
                "z1":0,
            };
            if (myExplorer && myExplorer.parent&& myExplorer.parent) {
                pastConforms = {
                    "conforms":true,
                    "x0":x - myExplorer.parent.x,
                    "x1":node.x - myExplorer.parent.parent.x,
                    "y0":y - myExplorer.parent.y,
                    "y1":node.y - myExplorer.parent.parent.y,
                    "z0":z - myExplorer.parent.z,
                    "z1":node.z - myExplorer.parent.parent.z,
                };
            }
            while (myExplorer.parent != undefined && exploreCount < 7) {
                if (myExplorer.placedBlocks) {placedBlocksInPast++;}
                if (pastConforms.conforms && myExplorer.parent.parent) {
                    if (myExplorer.x - myExplorer.parent.parent.x != pastConforms[("x" + ((Math.floor(exploreCount) == Math.floor(exploreCount / 2) * 2) ? 1 : 0))] |
                        myExplorer.y - myExplorer.parent.parent.y != pastConforms[("y" + ((Math.floor(exploreCount) == Math.floor(exploreCount / 2) * 2) ? 1 : 0))] |
                        myExplorer.z - myExplorer.parent.parent.z != pastConforms[("z" + ((Math.floor(exploreCount) == Math.floor(exploreCount / 2) * 2) ? 1 : 0))] &&
                        myExplorer.x - myExplorer.parent.parent.x != pastConforms[("x" + ((Math.floor(exploreCount) == Math.floor(exploreCount / 2) * 2) ? 0 : 1))] |
                        myExplorer.y - myExplorer.parent.parent.y != pastConforms[("y" + ((Math.floor(exploreCount) == Math.floor(exploreCount / 2) * 2) ? 0 : 1))] |
                        myExplorer.z - myExplorer.parent.parent.z != pastConforms[("z" + ((Math.floor(exploreCount) == Math.floor(exploreCount / 2) * 2) ? 0 : 1))]) {
                        pastConforms.conforms = false;
                        //console.log((((Math.floor(exploreCount) == Math.floor(exploreCount / 2) * 2) ? 1 : 0)) + ": " + (myExplorer.x - myExplorer.parent.parent.x) + ", " + (myExplorer.y - myExplorer.parent.parent.y) + ", " + (myExplorer.z - myExplorer.parent.parent.z) + ", " + JSON.stringify(pastConforms) + ", doesn't conform");
                    }
                }
                myExplorer = myExplorer.parent;
                exploreCount++;
            }
            //if (placedBlocksInPast >= 5) {placeBlockCost = 4;}
            if (pastConforms.conforms) {placeBlockCost /= 4;}
            x = oldX;
            z = oldZ;
            var inWater = false;
            if (node.moveType == "swimSlow" || node.moveType == "swimFast") {inWater = true;}
            //if (blockSolid(bot, x, y, z)) {console.log(bot.blockAt(new Vec3(x, y, z)).displayName);console.log(bot.blockAt(new Vec3(x, y, z)).digTime(null, false, inWater, inWater, [], {}) * breakBlockCost);}
            //if (blockSolid(bot, x, y + 1, z)) {console.log(bot.blockAt(new Vec3(x, y + 1, z)).displayName);console.log(bot.blockAt(new Vec3(x, y + 1, z)).digTime(null, false, inWater, inWater, [], {}) * breakBlockCost);}
            var myExplorer = node;
            var brokenBlocksInPast = 0; 
            var exploreCount = 0;
            var pastConforms = {
                "conforms":false,
                "x0":0,
                "x1":0,
                "y0":0,
                "y1":0,
                "z0":0,
                "z1":0,
            };
            if (myExplorer && myExplorer.parent) {
                pastConforms = {
                    "conforms":true,
                    "x0":x - myExplorer.parent.x,
                    "x1":node.x - myExplorer.parent.parent.x,
                    "y0":y - myExplorer.parent.y,
                    "y1":node.y - myExplorer.parent.parent.y,
                    "z0":z - myExplorer.parent.z,
                    "z1":node.z - myExplorer.parent.parent.z,
                };
            }
            while (myExplorer.parent != undefined && exploreCount < 6) {
                if (myExplorer.brokenBlocks) {brokenBlocksInPast++;}
                if (pastConforms.conforms && myExplorer.parent.parent) {
                    if (myExplorer.x - myExplorer.parent.parent.x != pastConforms[("x" + ((Math.floor(exploreCount) == Math.floor(exploreCount / 2) * 2) ? 1 : 0))] |
                        myExplorer.y - myExplorer.parent.parent.y != pastConforms[("y" + ((Math.floor(exploreCount) == Math.floor(exploreCount / 2) * 2) ? 1 : 0))] |
                        myExplorer.z - myExplorer.parent.parent.z != pastConforms[("z" + ((Math.floor(exploreCount) == Math.floor(exploreCount / 2) * 2) ? 1 : 0))] &&
                        myExplorer.x - myExplorer.parent.parent.x != pastConforms[("x" + ((Math.floor(exploreCount) == Math.floor(exploreCount / 2) * 2) ? 0 : 1))] |
                        myExplorer.y - myExplorer.parent.parent.y != pastConforms[("y" + ((Math.floor(exploreCount) == Math.floor(exploreCount / 2) * 2) ? 0 : 1))] |
                        myExplorer.z - myExplorer.parent.parent.z != pastConforms[("z" + ((Math.floor(exploreCount) == Math.floor(exploreCount / 2) * 2) ? 0 : 1))]) {
                        pastConforms.conforms = false;
                    }
                }
                myExplorer = myExplorer.parent;
                exploreCount++;
            }
            //if (brokenBlocksInPast >= 5) {breakBlockCost /= 2;}
            if (pastConforms.conforms) {breakBlockCost /= 4;}
            myFCost += (blockSolid(bot, x, y, z) && !blockWalk(bot, x, y, z)) * breakBlockCost * getDigTime(bot, x, y, z, false, false);
            myFCost += (blockSolid(bot, x, y + 1, z)) * breakBlockCost * getDigTime(bot, x, y + 1, z, false, false);
            myFCost += (blockSolid(bot, x, y, z) && !blockWalk(bot, x, y, z)) * breakBlockCost2;
            myFCost += (blockSolid(bot, x, y + 1, z)) * breakBlockCost2;
            if (!blockWater(bot, x, y, z) && !blockWater(bot, x, y + 1, z) && !blockLava(bot, x, y, z) && !blockLava(bot, x, y + 1, z)) {
                myFCost += (blockStand(bot, x, y - 1, z, node) != true) * placeBlockCost;
            }
            if (blockSolid(bot, x, y, z) && !blockWalk(bot, x, y, z)) {brokenBlocks.push([x, y, z]);brokeBlocks = true;}
            if (blockSolid(bot, x, y + 1, z)) {brokenBlocks.push([x, y + 1, z]);brokeBlocks = true;}
            legalMove = true;
            if (getDigTime(bot, x, y, z, false, false) == 9999999 || getDigTime(bot, x, y + 1, z, false, false) == 9999999) {legalMove = false;}
            moveType = "walk";
            if (pathfinderOptions.sprint && blockWater(bot, x, y, z) && blockWater(bot, x, y + 1, z)) {
                moveType = "swimFast";
            } else if (blockWater(bot, x, y, z) || blockWater(bot, x, y + 1, z)) {
                moveType = "swimSlow";
                if (blockWater(bot, x, y + 1, z)) {myFCost += 35;}
            } else if (blockLava(bot, x, y, z) || blockLava(bot, x, y + 1, z)) {
                //console.log("THIS IS LAVA YEAH " + myFCost);
                if (node.moveType != "lava" && node.moveType != "fallLava") {
                    myFCost += 1000;
                } else {
                    myFCost += 20;
                }
                moveType = "lava";
            }
        }
        if (legalMove && x == 57 | x == 58 && z == -90) {console.log(x + ", " + y + ", " + z + ", " + moveType + ", " + myFCost);}
    } else if (false && Math.abs(node.x - x) == 1 && Math.abs(node.z - z) == 1 && node.y + 1 == y) {//JUMP DIAGNOL
        ughType = 3;
        myFCost = 14;
        if (isBlock(bot, x, y, z) == 0 &&
            isBlock(bot, x, y + 1, z) == 0 &&
            isBlock(bot, x, y - 1, z, node) == 1 &&
            isBlock(bot, node.x, y, node.z) == 0 &&
            isBlock(bot, node.x, y + 1, node.z) == 0 &&
            isBlock(bot, node.x, y, z) == 0 && isBlock(bot, node.x, y + 1, z) == 0 &&/*| used for allowing jumps diagnol blocks in the way*/
            isBlock(bot, x, y, node.z) == 0 && isBlock(bot, x, y + 1, node.z) == 0) {legalMove = true;}
        /*if (!legalMove) {
            if (isBlock(bot, x, y - 1, z) != 1 && isBlock(bot, x, y, z) != 1) {//JUMP DIAGNOL
                //parkour move
                var stepDir = {"x":x - node.x, "z":z - node.z};
                if (isBlock(bot, x, y - 1, z) != 1 && isBlock(bot, x, y, z) != 1) {
                    //x += stepDir.x;
                    //z += stepDir.z;
                    var checkCount = 0;
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
    } else if (Math.abs(node.x - x) == 1 | Math.abs(node.z - z) == 1 && node.y + 1 == y) {//JUMP STRAIGHT
        moveType = "walkJump";
        ughType = 4;  
        myFCost = 10;
        if (blockWalk(bot, x, y, z) &&
            blockAir(bot, x, y + 1, z) &&
            blockStand(bot, x, y - 1, z, node) &&
            blockAir(bot, node.x, node.y + 1, node.z) &&
            blockAir(bot, node.x, node.y + 2, node.z)) {legalMove = true;}
            //Parkour move
            var stepDir = {"x":x - node.x, "z":z - node.z};

            var blockWaterCount = blockWater(bot, x, y, z) + blockWater(bot, x, y + 1, z);
            var blockAirCount = blockAir(bot, x, y, z) + blockAir(bot, x, y + 1, z);

            if (blockWaterCount == 2 | blockWaterCount == 1 & blockAirCount == 1 &&
                !blockSolid(bot, node.x, y, node.z) &&
                !blockSolid(bot, node.x, y + 1, node.z)) {
                if (blockSolid(bot, x, y, z) || blockSolid(bot, x, y, z)) {
                    legalMove = false;
                } else {
                    legalMove = true;
                    if (pathfinderOptions.sprint && node.moveType == "swimFast" | blockWater(bot, x, y, z) & blockWater(bot, x, y + 1, z)) {
                        moveType = "swimFast";
                    } else {
                        moveType = "swimSlow";
                        if (blockWater(bot, x, y + 1, z)) {myFCost *= 2;}
                    }
                }
            }
            var blockLavaCount = 0;
            if (!legalMove) {
                blockLavaCount = blockLava(bot, x, y, z) + blockLava(bot, x, y + 1, z);
                if (blockLavaCount == 2 || blockLavaCount == 1 && blockAirCount == 1) {
                    if (!blockSolid(bot, node.x, y, node.z) &&
                        !blockSolid(bot, node.x, y + 1, node.z)) {
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

            if (pathfinderOptions.parkour && !legalMove && blockAir(bot, x, y - 1, z) && blockAir(bot, x, y, z)) {
                //parkour move
                var stepDir = {"x":x - node.x, "z":z - node.z};
                var oldX = x;
                var oldZ = z;
                var checkCount = 0;
                /*if (blockStand(bot, x, y - 1, z, node)) {
                    myFCost += (blockSolid(bot, x, y, z)) * breakBlockCost;
                    myFCost += (blockSolid(bot, x, y + 1, z)) * breakBlockCost;
                    myFCost += (blockAir(bot, node.x, node.y + 2, node.z)) * breakBlockCost;
                    if (blockSolid(bot, x, y, z)) {brokenBlocks.push([x, y, z]);}
                    if (blockSolid(bot, x, y + 1, z)) {brokenBlocks.push([x, y + 1, z]);}
                    if (blockSolid(bot, node.x, node.y + 2, node.z)) {brokenBlocks.push([node.x, node.y + 2, node.z]);}
                    legalMove = true;
                    moveType = "walkJump";
                } else */if (blockSolid(bot, node.x, node.y + 2, node.z) ||
                    blockSolid(bot, x, y, z) ||
                    blockSolid(bot, x, y + 1, z)) {
                    checkCount = 3;
                }
                while (!legalMove && checkCount < 2) {
                    checkCount++;
                    x += stepDir.x;
                    z += stepDir.z;
                    if (blockSolid(bot, x, y, z) || blockSolid(bot, x, y + 1, z) ||
                        blockSolid(bot, x - stepDir.x, y + 2, z - stepDir.z)) {
                        checkCount += 3;
                        //console.log("boo " + x + ", " + y + ", " + z);
                    } else if (blockStand(bot, x, y - 1, z, node)) {
                        legalMove = true;
                        moveType = "walkJump";
                    }
                }
                if (!legalMove) {
                    x = oldX;
                    z = oldZ;
                }
            }
        if (!legalMove && blockStand(bot, x, y - 1, z, node) | blockLavaCount > 0 | blockWaterCount > 0) {
            var inWater = false;
            if (node.moveType == "swimSlow" || node.moveType == "swimFast") {inWater = true;}
            //if (blockSolid(bot, x, y, z)) {console.log(bot.blockAt(new Vec3(x, y, z)).displayName);console.log(bot.blockAt(new Vec3(x, y, z)).digTime(null, false, inWater, inWater, [], {}) * breakBlockCost);}
            //if (blockSolid(bot, x, y + 1, z)) {console.log(bot.blockAt(new Vec3(x, y + 1, z)).displayName);console.log(bot.blockAt(new Vec3(x, y + 1, z)).digTime(null, false, inWater, inWater, [], {}) * breakBlockCost);}
            var myExplorer = node;
            var brokenBlocksInPast = 0; 
            var exploreCount = 0;
                        var pastConforms = {
                "conforms":false,
                "x0":0,
                "x1":0,
                "y0":0,
                "y1":0,
                "z0":0,
                "z1":0,
            };
            if (myExplorer && myExplorer.parent) {
                pastConforms = {
                    "conforms":true,
                    "x0":x - myExplorer.parent.x,
                    "x1":node.x - myExplorer.parent.parent.x,
                    "y0":y - myExplorer.parent.y,
                    "y1":node.y - myExplorer.parent.parent.y,
                    "z0":z - myExplorer.parent.z,
                    "z1":node.z - myExplorer.parent.parent.z,
                };
            }
            while (myExplorer.parent != undefined && exploreCount < 6) {
                if (myExplorer.brokenBlocks) {brokenBlocksInPast++;}
                if (pastConforms.conforms && myExplorer.parent.parent) {
                    if (myExplorer.x - myExplorer.parent.parent.x != pastConforms[("x" + ((Math.floor(exploreCount) == Math.floor(exploreCount / 2) * 2) ? 1 : 0))] |
                        myExplorer.y - myExplorer.parent.parent.y != pastConforms[("y" + ((Math.floor(exploreCount) == Math.floor(exploreCount / 2) * 2) ? 1 : 0))] |
                        myExplorer.z - myExplorer.parent.parent.z != pastConforms[("z" + ((Math.floor(exploreCount) == Math.floor(exploreCount / 2) * 2) ? 1 : 0))] &&
                        myExplorer.x - myExplorer.parent.parent.x != pastConforms[("x" + ((Math.floor(exploreCount) == Math.floor(exploreCount / 2) * 2) ? 0 : 1))] |
                        myExplorer.y - myExplorer.parent.parent.y != pastConforms[("y" + ((Math.floor(exploreCount) == Math.floor(exploreCount / 2) * 2) ? 0 : 1))] |
                        myExplorer.z - myExplorer.parent.parent.z != pastConforms[("z" + ((Math.floor(exploreCount) == Math.floor(exploreCount / 2) * 2) ? 0 : 1))]) {
                        pastConforms.conforms = false;
                    }
                }
                myExplorer = myExplorer.parent;
                exploreCount++;
            }
            //if (brokenBlocksInPast >= 5) {breakBlockCost /= 2;}
            if (pastConforms.conforms) {breakBlockCost /= 4;}
            myFCost += (blockSolid(bot, x, y, z) && !blockWalk(bot, x, y, z)) * breakBlockCost * getDigTime(bot, x, y, z, false, false);
            myFCost += (blockSolid(bot, x, y + 1, z)) * breakBlockCost * getDigTime(bot, x, y + 1, z, false, false);
            myFCost += (blockSolid(bot, node.x, node.y + 2, node.z)) * breakBlockCost * getDigTime(bot, node.x, node.y + 2, node.z, false, false);

            myFCost += (blockSolid(bot, x, y, z) && !blockWalk(bot, x, y, z)) * breakBlockCost2;
            myFCost += (blockSolid(bot, x, y + 1, z)) * breakBlockCost2;
            myFCost += (blockSolid(bot, node.x, node.y + 2, node.z)) * breakBlockCost2;
            if (!blockWater(bot, x, y, z) && !blockWater(bot, x, y + 1, z) && !blockLava(bot, x, y, z) && !blockLava(bot, x, y + 1, z)) {
                myFCost += (blockStand(bot, x, y - 1, z, node) != true) * placeBlockCost;
            }
            if (blockSolid(bot, x, y, z) && !blockWalk(bot, x, y, z)) {brokenBlocks.push([x, y, z]);brokeBlocks = true;}
            if (blockSolid(bot, x, y + 1, z)) {brokenBlocks.push([x, y + 1, z]);brokeBlocks = true;}
            if (blockSolid(bot, node.x, node.y + 2, node.z)) {brokenBlocks.push([node.x, node.y + 2, node.z]);brokeBlocks = true;}
            legalMove = true;
            if (getDigTime(bot, node.x, node.y + 2, node.z, false, false) == 9999999 || getDigTime(bot, x, y, z, false, false) == 9999999 || getDigTime(bot, x, y + 1, z, false, false) == 9999999) {legalMove = false;}
            moveType = "walkJump";
            if (pathfinderOptions.sprint && blockWater(bot, x, y, z) && blockWater(bot, x, y + 1, z)) {
                moveType = "swimFast";
            } else if (blockWater(bot, x, y, z) || blockWater(bot, x, y + 1, z)) {
                moveType = "swimSlow";
                if (blockWater(bot, x, y + 1, z)) {myFCost += 35;}
            } else if (blockLava(bot, x, y, z) || blockLava(bot, x, y + 1, z)) {
                //console.log("THIS IS LAVA YEAH " + myFCost);
                if (node.moveType != "lava" && node.moveType != "fallLava") {
                    myFCost += 1000;
                } else {
                    myFCost += 20;
                }
                moveType = "lava";
            }
        }
        if (legalMove && x == 57 | x == 58 && z == -90) {console.log(x + ", " + y + ", " + z + ", " + moveType + ", " + myFCost);}
    } else if (Math.abs(node.x - x) == 1 && Math.abs(node.z - z) == 1 && node.y - 1 == y) {//FALL DIAGNOL
        //console.log("fall diagnol " + x + ", " + y + ", " + z);
        ughType = 5;
        myFCost = 14;
        moveType = "fall";
        if (!blockSolid(bot, x, y, z) &&
            !blockSolid(bot, x, y + 1, z) &&
            !blockSolid(bot, x, y + 2, z) &&
            !blockSolid(bot, node.x, y + 2, z) & blockWalk(bot, node.x, y + 1, z, false, true, true) |
            !blockSolid(bot, x, y + 2, node.z) & blockWalk(bot, x, y + 1, node.z, false, true, true)) {
            var oldY = y;
            var failed = false;
            var attempts = 0;
            while (y > -1 && y > oldY - pathfinderOptions.maxFall & !pathfinderOptions.canClutch | y > oldY - pathfinderOptions.maxFallClutch & pathfinderOptions.canClutch && !legalMove && !failed) {
                attempts++;
                if (blockStand(bot, x, y - 1, z, node) || blockWater(bot, x, y, z) || blockLava(bot, x, y, z)) {
                    legalMove = true;
                    if (blockWater(bot, x, y, z)) {
                        myFCost += waterSwimCost + 0.1;
                        if (node.moveType != "swimSlow" && node.moveType != "swimFast" && node.moveType != "fallWater") {
                            moveType = "fallWater";
                        } else if (blockWater(bot, x, y + 1, z)) {
                            moveType = "swimFast";
                        } else {
                            moveType = "swimSlow";
                        }
                    } else if (blockLava(bot, x, y, z)) {
                        if (node.moveType != "lava" && node.moveType != "fallLava") {
                            myFCost += 1000;
                            moveType = "fallLava";
                        } else {
                            myFCost += 24;
                            moveType = "lava";
                        }
                    }
                } else if (!blockSolid(bot, x, y - 1, z)) {
                    y--;
                } else {
                    failed = true;
                }
            }
            if (moveType != "fallLava" && moveType != "lava" &&
                blockLava(bot, x, y, z) |
                blockLava(bot, x, y + 1, z) |
                blockLava(bot, x, y + 2, z) |
                blockLava(bot, node.x, y + 2, z) | blockLava(bot, node.x, y + 1, z) |
                blockLava(bot, x, y + 2, node.z) | blockLava(bot, x, y + 1, node.z)) {
                legalMove = false;
            }
            //console.log("legal fall " + isBlock(bot, x, y - 1, z)).displayName);
        }
    } else if (Math.abs(node.x - x) == 1 | Math.abs(node.z - z) == 1 && node.y - 1 == y) {//FALL STRAIGHT
        var inWater = false;
        ughType = 6;
        myFCost = 10;
        moveType = "fall";
        if (!blockSolid(bot, x, y, z) &&
            !blockSolid(bot, x, y + 1, z) &&
            !blockSolid(bot, x, y + 2, z)) {
            var oldY = y;
            var failed = false;
            var attempts = 0;
            while (y > -1 && y > oldY - pathfinderOptions.maxFall & !pathfinderOptions.canClutch | y > oldY - pathfinderOptions.maxFallClutch & pathfinderOptions.canClutch && !legalMove && !failed) {
                attempts++;
                if (blockStand(bot, x, y - 1, z, node) || blockWater(bot, x, y, z) || blockWater(bot, x, y + 1, z) || blockLava(bot, x, y, z)) {
                    legalMove = true;
                    if (blockWater(bot, x, y, z)) {
                        myFCost += waterSwimCost + 0.1;
                        if (node.moveType != "swimSlow" && node.moveType != "swimFast" && node.moveType != "fallWater") {
                            moveType = "fallWater";
                        } else if (blockWater(bot, x, y + 1, z)) {
                            moveType = "swimFast";
                        } else {
                            moveType = "swimSlow";
                        }
                        inWater = true;
                    } else if (blockLava(bot, x, y, z)) {
                        if (node.moveType != "lava" && node.moveType != "fallLava") {
                            myFCost += 1000;
                            moveType = "fallLava";
                        } else {
                            myFCost += 24;
                            moveType = "lava";
                        }
                    }
                } else if (!blockSolid(bot, x, y - 1, z)) {
                    y--;
                } else {
                    failed = true;
                }
            }
            if (moveType != "fallLava" && moveType != "lava" &&
                blockLava(bot, x, y, z) |
                blockLava(bot, x, y + 1, z) |
                blockLava(bot, x, y + 2, z)) {
                legalMove = false;
            }
            if (y != oldY && pathfinderOptions.parkour) {
                validNode(node, x, oldY - 1, z, endX, endY, endZ);
            } 
            if (!legalMove) {
                y = oldY;
            }
            if (blockSolid(bot, x, oldY, z)) {
                blocksBroken = true;
                myFCost += getDigTime(bot, x, oldY, z, false, false) * breakBlockCost;
                myFCost += breakBlockCost2;
                brokenBlocks.push([x, oldY, z]);
            }
            //console.log("legal fall " + isBlock(bot, x, y - 1, z)).displayName);
        }
    } else if (Math.abs(node.x - x) == 1 | Math.abs(node.z - z) == 1 && node.y - 2 == y) {//FALL STRAIGHT JUMP
        ughType = 6;
        myFCost = 11;
        moveType = "walkJump";
        y++;
        var stepDir = {"x":x - node.x, "z":z - node.z};
        x += (x - node.x);
        z += (z - node.z);
            if (blockStand(bot, x, y - 1, z, node) || blockWater(bot, x, y, z) || blockLava(bot, x, y, z)) {
                legalMove = true;
                if (blockLava(bot, x, y, z)) {
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
            if (moveType != "fallLava" && moveType != "lava" &&
                blockLava(bot, x, y, z) |
                blockLava(bot, x, y + 1, z) |
                blockLava(bot, x, y + 2, z)) {
                legalMove = false;
            }
            if (!legalMove && blockAir(bot, x, y - 1, z) && blockAir(bot, x, y, z)) {
                //parkour move
                var oldX = x;
                var oldZ = z;
                var checkCount = 0;
                if (blockSolid(bot, node.x, node.y + 2, node.z) ||
                    blockSolid(bot, x, y, z) ||
                    blockSolid(bot, x, y + 1, z)) {
                    checkCount = 3;
                }
                while (!legalMove && checkCount < 2) {
                    checkCount++;
                    x += stepDir.x;
                    z += stepDir.z;
                    if (blockSolid(bot, x, y, z) || blockSolid(bot, x, y + 1, z) ||
                        blockSolid(bot, x - stepDir.x, y + 2, z - stepDir.z) ||
                        blockSolid(bot, x - stepDir.x, y + 3, z - stepDir.z)) {
                        checkCount += 3;
                        //console.log("boo " + x + ", " + y + ", " + z);
                    } else if (blockStand(bot, x, y - 1, z, node)) {
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
    } else if (Math.abs(node.x - x) == 0 && Math.abs(node.z - z) == 0 && node.y - 1 == y) {//JUST FALL
        ughType = 7;
        myFCost = 10;
        var inWater = false;
        moveType = "fall";
        //console.log("straight fall");
        if (node.moveType == "swimFast") {inWater = true;}
            var myExplorer = node;
            var brokenBlocksInPast = 0; 
            var exploreCount = 0;
                        var pastConforms = {
                "conforms":false,
                "x0":0,
                "x1":0,
                "y0":0,
                "y1":0,
                "z0":0,
                "z1":0,
            };
            if (myExplorer && myExplorer.parent) {
                pastConforms = {
                    "conforms":true,
                    "x0":x - myExplorer.parent.x,
                    "x1":node.x - myExplorer.parent.parent.x,
                    "y0":y - myExplorer.parent.y,
                    "y1":node.y - myExplorer.parent.parent.y,
                    "z0":z - myExplorer.parent.z,
                    "z1":node.z - myExplorer.parent.parent.z,
                };
            }
            while (myExplorer.parent != undefined && exploreCount < 7) {
                if (myExplorer.brokenBlocks) {brokenBlocksInPast++;}
                if (pastConforms.conforms && myExplorer.parent.parent) {
                    if (myExplorer.x - myExplorer.parent.parent.x != pastConforms[("x" + ((Math.floor(exploreCount) == Math.floor(exploreCount / 2) * 2) ? 1 : 0))] |
                        myExplorer.y - myExplorer.parent.parent.y != pastConforms[("y" + ((Math.floor(exploreCount) == Math.floor(exploreCount / 2) * 2) ? 1 : 0))] |
                        myExplorer.z - myExplorer.parent.parent.z != pastConforms[("z" + ((Math.floor(exploreCount) == Math.floor(exploreCount / 2) * 2) ? 1 : 0))] &&
                        myExplorer.x - myExplorer.parent.parent.x != pastConforms[("x" + ((Math.floor(exploreCount) == Math.floor(exploreCount / 2) * 2) ? 0 : 1))] |
                        myExplorer.y - myExplorer.parent.parent.y != pastConforms[("y" + ((Math.floor(exploreCount) == Math.floor(exploreCount / 2) * 2) ? 0 : 1))] |
                        myExplorer.z - myExplorer.parent.parent.z != pastConforms[("z" + ((Math.floor(exploreCount) == Math.floor(exploreCount / 2) * 2) ? 0 : 1))]) {
                        pastConforms.conforms = false;
                    }
                }
                myExplorer = myExplorer.parent;
                exploreCount++;
            }
            //if (brokenBlocksInPast >= 5) {breakBlockCost /= 2;}
            if (pastConforms.conforms) {breakBlockCost /= 4;}
        if (blockSolid(bot, x, y, z)) {
            brokeBlocks = true;
            myFCost += getDigTime(bot, x, y, z, false, false) * breakBlockCost;
            myFCost += breakBlockCost2;
        }
        //if (true) {
            var oldY = y;
            var failed = false;
            var attempts = 0;
            if (myFCost == 9999999) {
                legalMove = false;
                failed = true;
                console.log("e");
            } else {
                //myFCost += 3;
            }
            while (y > -1 && y > oldY - pathfinderOptions.maxFall & !pathfinderOptions.canClutch | y > oldY - pathfinderOptions.maxFallClutch & pathfinderOptions.canClutch && !legalMove && !failed) {
                attempts++;
                if (blockStand(bot, x, y - 1, z, node) || blockWater(bot, x, y, z) || blockLava(bot, x, y, z)) {
                    legalMove = true;
                    if (blockWater(bot, x, y, z)) {
                        myFCost += waterSwimCost + 0.1;
                        if (node.moveType != "swimSlow" && node.moveType != "swimFast" && node.moveType != "fallWater") {
                            moveType = "fallWater";
                        } else if (blockWater(bot, x, y + 1, z)) {
                            moveType = "swimFast";
                        } else {
                            moveType = "swimSlow";
                        }
                    } else if (blockLava(bot, x, y, z)) {
                        if (node.moveType != "lava" && node.moveType != "fallLava") {
                            myFCost += 1200;
                            moveType = "fallLava";
                        } else {
                            myFCost += 20;
                            moveType = "lava";
                        }
                    }
                } else if (!blockSolid(bot, x, y - 1, z)) {
                    y--;
                } else {
                    failed = true;
                }
            }
        //}
        if (legalMove && x == 57 | x == 58 && z == -90) {console.log(x + ", " + y + ", " + z + ", " + moveType + ", " + myFCost);}
    } else if (node.x - x == 0 && node.z - z == 0 && node.y + 1 == y) {//Just Jump
            var myExplorer = node;
            var placedBlocksInPast = 0; 
            var exploreCount = 0;
            var pastConforms = {
                "conforms":false,
                "x0":0,
                "x1":0,
                "y0":0,
                "y1":0,
                "z0":0,
                "z1":0,
            };
            if (myExplorer && myExplorer.parent) {
                pastConforms = {
                    "conforms":true,
                    "x0":x - myExplorer.parent.x,
                    "x1":node.x - myExplorer.parent.parent.x,
                    "y0":y - myExplorer.parent.y,
                    "y1":node.y - myExplorer.parent.parent.y,
                    "z0":z - myExplorer.parent.z,
                    "z1":node.z - myExplorer.parent.parent.z,
                };
            }
            while (myExplorer.parent != undefined && exploreCount < 7) {
                if (myExplorer.placedBlocks) {placedBlocksInPast++;}
                if (pastConforms.conforms && myExplorer.parent.parent) {
                    if (myExplorer.x - myExplorer.parent.parent.x != pastConforms[("x" + ((Math.floor(exploreCount) == Math.floor(exploreCount / 2) * 2) ? 1 : 0))] |
                        myExplorer.y - myExplorer.parent.parent.y != pastConforms[("y" + ((Math.floor(exploreCount) == Math.floor(exploreCount / 2) * 2) ? 1 : 0))] |
                        myExplorer.z - myExplorer.parent.parent.z != pastConforms[("z" + ((Math.floor(exploreCount) == Math.floor(exploreCount / 2) * 2) ? 1 : 0))] &&
                        myExplorer.x - myExplorer.parent.parent.x != pastConforms[("x" + ((Math.floor(exploreCount) == Math.floor(exploreCount / 2) * 2) ? 0 : 1))] |
                        myExplorer.y - myExplorer.parent.parent.y != pastConforms[("y" + ((Math.floor(exploreCount) == Math.floor(exploreCount / 2) * 2) ? 0 : 1))] |
                        myExplorer.z - myExplorer.parent.parent.z != pastConforms[("z" + ((Math.floor(exploreCount) == Math.floor(exploreCount / 2) * 2) ? 0 : 1))]) {
                        pastConforms.conforms = false;
                    }
                }
                myExplorer = myExplorer.parent;
                exploreCount++;
            }
            //if (placedBlocksInPast >= 5) {placeBlockCost = 4;}
            if (pastConforms.conforms) {placeBlockCost /= 4;}
        myFCost = 5;
        moveType = "goUp";
        var inWater = false;
        if (blockLava(bot, x, y, z) | blockLava(bot, x, y + 1, z)) {
            if (node.moveType != "lava" && node.moveType != "fallLava") {
                myFCost += 1000;
                moveType = "fallLava";
            } else {
                myFCost += 20;
                moveType = "lava";
            }
        } else if (blockWater(bot, x, y, z) | blockWater(bot, x, y + 1, z)) {
            myFCost += waterSwimCost;
            if (blockWater(bot, x, y + 1, z)) {
                moveType = "swimFast";
            } else {
                moveType = "swimSlow";
            }
            inWater = true;
        } else {
            myFCost += placeBlockCost;
        }
        if (blockSolid(bot, x, y + 1, z)) {
            blocksBroken = true;
            myFCost += getDigTime(bot, x, y, z, false, false) * breakBlockCost;
            myFCost += breakBlockCost2;
            brokenBlocks.push([x, y + 1, z]);
        }
        legalMove = true;
        //console.log("goUp " + myFCost);
    }
    var distToGoal = 0;
    if (endZ != undefined) {
        //distToGoal = dist3d(x, y, z, endX, endY, endZ) * (3);
        distToGoal = dist3d(x, y, z, endX, endY, endZ) * (25);
        //distToGoal = dist3d(x, 0, z, endX, 0, endZ) * (10);
        //distToGoal += Math.abs(y - endY) * 10;
        //distToGoal += dist3d(0, y, 0, 0, endY, 0) * (10);
    } else {
        distToGoal = dist3d(x, 0, z, endX, 0, endY) * (25);
    }
    if (nodes3d[y] == undefined || nodes3d[y][z] == undefined || nodes3d[y][z][x] == undefined) {
        ownerNodeUndefined = true;
    } else if (node.fCost + myFCost + distToGoal < nodes3d[y][z][x].fCost + nodes3d[y][z][x].hCost) {
        ownerNodeUndefined = true;
    }
    if (legalMove && ownerNodeUndefined) {
        addNode(node, myFCost, distToGoal, x, y, z, moveType, brokenBlocks, brokeBlocks, placedBlocks);
        //console.log("D: " + Math.floor(distToGoal) + ", F: " + myFCost + ", M: " + moveType + ", XYZ: " + x + " " + y + " " + z);
    } else {
        //console.log("X: " + x + ", Y: " + y + ", Z: " + z + ", D: " + dist3d(x, y, z, endX, endY, endZ) * 10);
    }
    
};
var movesToGo = [];

//BASED ON MINEFLAYER-PATHFINDER CODE FOR THE HEAP SORT
/*function pushHeap(obj) {
    nodes.push(obj);
    openNodes.push(0);
    openNodes[openNodes.length - 1] = nodes[nodes.length - 1];
    openNodes.unshift(0);
    let current = openNodes.length - 1;
    let parent = current >>> 1;

    // Traversing up the parent node until the current node is greater than the parent
    while (current > 1 && (openNodes[parent].fCost + openNodes[parent].hCost) > (openNodes[current].fCost + openNodes[current].hCost)) {
      [openNodes[parent], openNodes[current]] = [openNodes[current], openNodes[parent]];
      current = parent;
      parent = current >>> 1;
    }
    openNodes.splice(0, 1);

    var leBestNode = openNodes[0];
    var leBestNodey = 0;
    for (var i = 0; i < openNodes.length; i++) {
        if (i > 2 && (openNodes[i].fCost + openNodes[i].hCost) < (openNodes[Math.floor(i / 2)].fCost + openNodes[Math.floor(i / 2)].hCost)) {console.log("oh come on!: " + i);}
        if (openNodes[i].fCost + openNodes[i].hCost < leBestNode.fCost + leBestNode.hCost || !leBestNode.open) {
            leBestNode = openNodes[0];
            leBestNodey = i;
        }
    }
    if (leBestNodey != 0) {
        console.log("PUSH: openNode length: " + openNodes.length + ", bestNodeIndex: " + leBestNodey);
    } else {
        console.log("BOOM: openNode length: " + openNodes.length + ", bestNodeIndex: " + leBestNodey);
    }
};*/

function pushHeap(obj) {
    //if (bestNodeIndex != 0) {window.helpMeFixErrorPlease();}
    nodes.push(obj);
    //openNodes.push(0);
    //openNodes[openNodes.length - 1] = nodes[nodes.length - 1];
    openNodes.push(nodes[nodes.length - 1]);
    if (openNodes.length > 1) {
        var current = openNodes.length - 1;
        var parent = Math.floor((current - 1) / 2);
        while (current > 0 && (openNodes[parent].fCost + openNodes[parent].hCost) > (openNodes[current].fCost + openNodes[current].hCost)) {
            var storer = openNodes[current];
            openNodes[current] = openNodes[parent];
            openNodes[parent] = storer;
            //[openNodes[parent], openNodes[current]] = [openNodes[current], openNodes[parent]];
            //console.log("before: " + bestNodeIndex);
            //bestNodeIndex = parent;//This might cause issues if it is wrong
            //console.log("after: " + bestNodeIndex);
            current = parent;
            parent = Math.floor((current - 1) / 2);
        }
    }
    /*var leBestNode = openNodes[0];
    var leBestNodey = 0;
    for (var i = 0; i < openNodes.length; i++) {
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
        for (var i = 0; i < openNodes.length; i++) {console.log(i + " " + JSON.stringify(openNodes[i]) + "\n\n");}
    window.prettyPlease();}*/
};

function popHeap(obj) {
    //openNodes[bestNodeIndex] = openNodes[openNodes.length - 1];
    openNodes.splice(0, 1);
    if (openNodes.length > 1) {
        openNodes.unshift(openNodes[openNodes.length - 1]);
        openNodes.splice(openNodes.length - 1, 1);
    }
  if (openNodes.length > 0) {
    var current = 0;
    var childLeft = (current * 2) + 1;
    var childRight = (current * 2) + 2;
    var keepGoing = true;
    while (keepGoing) {
        var currentScore = openNodes[current].fCost + openNodes[current].hCost;
        var childLeftScore = 9999999999;
        var childRightScore = 9999999999;
        if (openNodes.length - 1 >= childLeft) {childLeftScore = openNodes[childLeft].fCost + openNodes[childLeft].hCost;}
        if (openNodes.length - 1 >= childRight) {childRightScore = openNodes[childRight].fCost + openNodes[childRight].hCost;}
        if (childLeftScore < currentScore || childRightScore < currentScore) {
            var swapMeWith = childLeft;
            if (childLeftScore > childRightScore) {
                swapMeWith = childRight;
            }
            var storer = openNodes[swapMeWith];
            openNodes[swapMeWith] = openNodes[current];
            openNodes[current] = storer;
            current = swapMeWith;
            childLeft = (current * 2) + 1;
            childRight = (current * 2) + 2;
        } else {
            keepGoing = false;
        }
    }
  }
    /*var leBestNode = openNodes[0];
    var leBestNodey = 0;
    for (var i = 0; i < openNodes.length; i++) {
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
};
//END OF CODE BASED ON MINEFLAYER-PATHFINDER

var bestNodeIndex = 0;
function findPath(bot, endX, endY, endZ, correction, extension) {
    if (movesToGo.length == 0) {extension = false;}
    if (endY == "no") {
        endY = endZ;
        endZ = undefined;
    }
    var leColumns = bot.world.getColumns();
    chunkColumns = [];
    for (var i = 0; i < leColumns.length; i++) {
        if (!chunkColumns[leColumns[i].chunkZ]) {
            chunkColumns[leColumns[i].chunkZ] = [];
        }
        chunkColumns[leColumns[i].chunkZ][leColumns[i].chunkX] = true;
    }
    console.log("BEFORE: " + JSON.stringify(lastPos) + ", " + JSON.stringify(movesToGo[lastPos.currentMove]) + ", length: " + movesToGo.length);
    bot.clearControlStates();
    //var currentMovePos = {"x":movesToGo[lastPos.currentMove].x,"y":movesToGo[lastPos.currentMove].y,"z":movesToGo[lastPos.currentMove].z};
    var movesToGoLength = movesToGo.length;
    if (!extension) {
        lastPos = {"currentMove":0,"x":Math.floor(bot.entity.position.x), "y":Math.floor(bot.entity.position.y), "z":Math.floor(bot.entity.position.z),};
    }
    if (!correction && !extension) {
        nodes = [];
        nodes3d = [];
        openNodes = [];
        movesToGo = [];
    } else if (correction) {
        nodes = [];
        nodes3d = [];
        openNodes = [];
        var bestOne = [0, 10000];
        for (var i = 0; i < movesToGo.length; i++) {
            if (dist3d(movesToGo[i].x, movesToGo[i].y, movesToGo[i].z, Math.round(bot.entity.position.x), Math.floor(bot.entity.position.y - 1), Math.round(bot.entity.position.z)) < bestOne[1]) {
                bestOne = [i, dist3d(movesToGo[i].x, movesToGo[i].y, movesToGo[i].z, Math.round(bot.entity.position.x), Math.floor(bot.entity.position.y), Math.round(bot.entity.position.z))];
            }
        }
        if (bestOne[0] + 1 < movesToGo.length) {
            movesToGo.splice(bestOne[0] + 1, movesToGo.length);
        }
        endX = movesToGo[bestOne[0]].x;
        endY = movesToGo[bestOne[0]].y;
        endZ = movesToGo[bestOne[0]].z;
        console.log(movesToGo[bestOne[0]]);
    } else if (extension) {
        nodes = [];
        openNodes = [];
        nodes3d = [];
        var bestOne = [0, 100000];
        for (var i = 0; i < movesToGo.length; i++) {
            if (dist3d(movesToGo[i].x, movesToGo[i].y, movesToGo[i].z, endX, endY, endZ) < bestOne[1]) {
                bestOne = [i, dist3d(movesToGo[i].x, movesToGo[i].y, movesToGo[i].z, endX, endY, endZ)];
            }
        }
        //var bestOne = [0, dist3d(movesToGo[movesToGo.length - 1].x, movesToGo[movesToGo.length - 1].y, movesToGo[movesToGo.length - 1].z, endX, endY, endZ)];
        bestOne[0] += 10;
        if (bestOne[0] > movesToGo.length - 6) {bestOne[0] = movesToGo.length - 6;}
        if (bestOne[0] >= 0) {
            lastPos.currentMove -= (bestOne[0] + 1);
            movesToGo.splice(0, bestOne[0] + 1);
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
        var bestOne = [0, 10000];
        for (var i = 0; i < movesToGo.length; i++) {
            if (dist3d(movesToGo[i].x, movesToGo[i].y, movesToGo[i].z, endX, endY, endZ) < bestOne[1]) {
                bestOne = [i, dist3d(movesToGo[i].x, movesToGo[i].y, movesToGo[i].z, endX, endY, endZ)];
            }
        }
        if (bestOne[0] += 7) {
            if (bestOne[0] > movesToGo.length - 1) {bestOne[0] = movesToGo.length - 1;}
        }
        movesToGo.splice(0, bestOne[0] + 1);
        var foundCurrentMove = false;
        if (movesToGo.length - 1 < lastPos.currentMove && lastPos.currentMove) {
            console.log(lastPos.currentMove);
            for (var i = 0; i < movesToGo.length; i++) {
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

    var foundPath = false;
    if (!extension || movesToGo.length == 0) {
        addNode(false, 0, 0, Math.floor(bot.entity.position.x), Math.floor(bot.entity.position.y), Math.floor(bot.entity.position.z), "start", [], false);
    } else if (movesToGo.length > 0) {
        console.log("x: " + movesToGo[0].x + ", y: " + movesToGo[0].y + ", z: " + movesToGo[0].z + " " + movesToGo.length)
        addNode(false, 0, 0, movesToGo[0].x, movesToGo[0].y, movesToGo[0].z, "start", [], false);
    }
    var attempts = 0;
    var maxAttempts = 0;
    var bestNode = nodes[0];
    var findingPath = setInterval(function() {
    bestNodeIndex = 0;
    //console.log("searching...");
    botSearchingPath = 10;
    if (!extension) {
        botDestinationTimer = 30;
    }
    moveTimer = 10;
    var performanceStop = process.hrtime();
    while (!foundPath && attempts < 7500 && (process.hrtime(performanceStop)[0] * 1000000000 + process.hrtime(performanceStop)[1]) / 1000000 < 40) {
        attempts++;
        /*for (var i = 0; i < nodes.length; i++) {
            if (!nodes[i].open) {continue;}
            if (nodes[i].fCost + nodes[i].hCost < bestNode.fCost + bestNode.hCost || !bestNode.open) {
                bestNode = nodes[i];
            }
        }*/
        bestNodeIndex = 0;
        bestNode = openNodes[0];
        /*for (var i = 0; i < openNodes.length; i++) {
            if (i > 0 && !bestNode.open) {console.log(JSON.stringify(bestNode) + ", :/ " + i);}
            if (openNodes[i].fCost == undefined || i > 1 && (openNodes[i].fCost + openNodes[i].hCost) < (openNodes[Math.floor((i - 1) / 2)].fCost + openNodes[Math.floor((i - 1) / 2)].hCost)) {console.log("Time for debugging: " + i);}
            if (openNodes[i].fCost + openNodes[i].hCost < bestNode.fCost + bestNode.hCost || !bestNode.open) {
                bestNode = openNodes[i];
                bestNodeIndex = i;
            }
        }*/
        if (bestNodeIndex != 0) {
            console.log("OOF: openNode length: " + openNodes.length + ", bestNodeIndex: " + bestNodeIndex);
        }
        //bestNodeIndex = 0;
        //openNodes.splice(bestNodeIndex, 1);
        popHeap(bestNode);
        var bestNodeWasOpen = bestNode.open;
        bestNode.open = false;
        var chunkAvailible = false;
        if (checkChunk(bestNode.x, bestNode.z)) {
            chunkAvailible = true;
        }
        if (endZ != undefined && bestNode.x == endX && bestNode.y == endY && bestNode.z == endZ ||
            endZ == undefined && bestNode.x == endX && bestNode.z == endY || !chunkAvailible) {
            botPathfindTimer = 0;
            foundPath = true;
            console.log("Found path in " + attempts + " attempts.");
            var atHome = false;
            var steps = 0;
            var ogreSection = movesToGo.length - 1;//original reference erray(thats how you spell array :P) section
            var extender = [];
            while (!atHome | steps < 1000 && bestNode.parent != undefined) {
                //console.log(steps);
                if (!extension) {
                    movesToGo.push({"mType":bestNode.moveType,"x":bestNode.x, "y":bestNode.y, "z":bestNode.z});
                } else {
                    extender.push({"mType":bestNode.moveType,"x":bestNode.x, "y":bestNode.y, "z":bestNode.z});
                    //movesToGo.unshift({"x":bestNode.x, "y":bestNode.y, "z":bestNode.z});
                }
              if (correction) {
                for (var i = 0; i < ogreSection; i++) {
                    if (movesToGo[i] == bestNode.x && movesToGo[i] == bestNode.x && movesToGo[i] == bestNode.x) {
                        while (movesToGo[ogreSection].x != bestNode.x && movesToGo[ogreSection].y != bestNode.y && movesToGo[ogreSection].z != bestNode.z) {
                            movesToGo.splice(ogreSection, 1);
                            ogreSection--;
                        }
                        i = ogreSection;
                    } else {
                        continue;
                    }
                }
              } else if (extension) {
                  for (var i = 0; i < movesToGo.length; i++) {
                      if (movesToGo[i].x == extender[extender.length - 1].x &&
                          movesToGo[i].y == extender[extender.length - 1].y &&
                          movesToGo[i].z == extender[extender.length - 1].z) {
                          extender.splice(extender.length - 1, 1);
                          i = movesToGo.length;
                          //continue;
                      }
                  }
              }
                console.log("x: " + bestNode.x + " y: " + bestNode.y + "z: " + bestNode.z);
                bestNode = bestNode.parent;
                steps++;
            }
            if (extension) {
                lastPos.currentMove += extender.length;
                movesToGo = extender.concat(movesToGo);
            }
            bot.chat("I can be there in " + steps + " steps.");
        } else if (bestNodeWasOpen) {
            bot.chat("/particle flame " + bestNode.x + " " + bestNode.y + " " + bestNode.z);
            /*if (bestNode.parent) {
                console.log("bestNode.parent fCost vs this node fCost: " + (bestNode.fCost - bestNode.parent.fCost));
            }*/
            //bot.chat("/setblock " + bestNode.x + " " + bestNode.y + " " + bestNode.z + " dirt");
            if (chunkAvailible) {
                //walking
                validNode(bestNode, bestNode.x - 1, bestNode.y, bestNode.z, endX, endY, endZ);
                validNode(bestNode, bestNode.x + 1, bestNode.y, bestNode.z, endX, endY, endZ);
                validNode(bestNode, bestNode.x, bestNode.y, bestNode.z - 1, endX, endY, endZ);
                validNode(bestNode, bestNode.x, bestNode.y, bestNode.z + 1, endX, endY, endZ);
                //walking(diagnol)
                validNode(bestNode, bestNode.x - 1, bestNode.y, bestNode.z - 1, endX, endY, endZ);
                validNode(bestNode, bestNode.x + 1, bestNode.y, bestNode.z - 1, endX, endY, endZ);
                validNode(bestNode, bestNode.x - 1, bestNode.y, bestNode.z + 1, endX, endY, endZ);
                validNode(bestNode, bestNode.x + 1, bestNode.y, bestNode.z + 1, endX, endY, endZ);

                //Falling
                validNode(bestNode, bestNode.x, bestNode.y - 1, bestNode.z, endX, endY, endZ);
                //Jumping
                validNode(bestNode, bestNode.x, bestNode.y + 1, bestNode.z, endX, endY, endZ);
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
        botSearchingPath = 0;
        botPathfindTimer = 0;
        clearInterval(findingPath);
        if (!extension) {
            lastPos.currentMove = movesToGo.length - 1;
        }
        console.log("AFTER: " + JSON.stringify(lastPos) + ", " + JSON.stringify(movesToGo[lastPos.currentMove]) + ", length: " + movesToGo.length);
    }
    }, 50);
};
    var debugTimer = 0;
    var botDigDelay = 0;
    var botGrounded = 0;
    var botObstructed = 0;
    var botEquipDefault = false;
    var botDigCTimer = 0;
    var holdWeapon = true;
    var lookAtNextDelay = 0;

    var huntTarget = 0;
    var huntMode = -1;
    var huntTrackTimer = 0;
    var onPath = false;
    var lastHuntTargetPos = {"x":0,"y":0,"z":0};
    var busyBuilding = false;
    var botMove = {
        "forward":false,
        "back":false,
        "left":false,
        "right":false,
        "sneak":false,
        "sprint":false,
        "jump":false,
        "isGrounded":0,
        "faceBackwards":4,
        "mlg":0,
        "bucketTimer":0,
        "bucketTarget":{x:0,y:0,z:0},
        "lastTimer":-10,
    };
    var botIsDigging = -2;
    var takeCareOfBlock = function(myMove) {
            //console.log(bot.entity.isInWater);
            if (bot.entity.onGround |
                bot.entity.isInWater |
                bot.entity.isInLava |
                isSwim(myMove.mType)  &&
                myMove.y + 0.2 < bot.entity.position.y &&
                blockSolid(bot, myMove.x, myMove.y, myMove.z) &&
                dist3d(bot.entity.position.x, 0, bot.entity.position.z, myMove.x + 0.5, 0, myMove.z + 0.5) <= Math.sqrt(0.5) &&
                canDigBlock(bot, myMove.x, myMove.y, myMove.z) &&
                !bot.targetDigBlock && botDigDelay <= 0) {
                equipTool(bot, myMove.x, myMove.y, myMove.z);
                digBlock(bot, myMove.x, myMove.y, myMove.z);
                botIsDigging = 2;
                console.log("DigDown Strict");
            } else if (bot.entity.onGround |
                bot.entity.isInWater |
                bot.entity.isInLava |
                isSwim(myMove.mType) &&
                myMove.y + 1.2 < bot.entity.position.y &&
                blockSolid(bot, myMove.x, Math.floor(bot.entity.position.y - 0.2), myMove.z) &&
                dist3d(bot.entity.position.x, 0, bot.entity.position.z, myMove.x + 0.5, 0, myMove.z + 0.5) <= Math.sqrt(0.5) &&
                canDigBlock(bot, myMove.x, Math.floor(bot.entity.position.y - 0.2), myMove.z) &&
                !bot.targetDigBlock && botDigDelay <= 0) {
                equipTool(bot, myMove.x, Math.floor(bot.entity.position.y - 0.2), myMove.z);
                digBlock(bot, myMove.x, Math.floor(bot.entity.position.y - 0.2), myMove.z);
                botIsDigging = 2;
                console.log("DigDown FreeStyle");
            } else if ((bot.entity.onGround || bot.entity.isInWater || bot.entity.isInLava) & bot.entity.position.y >= myMove.y - 0.25 & bot.entity.position.y <= myMove.y + 0.25 | isSwim(myMove.mType) && !bot.targetDigBlock /*&& botDigDelay <= 0*/) {
                //console.log("DigForward?");
                if (blockSolid(bot, myMove.x, myMove.y + 1, myMove.z) &&
                    canDigBlock(bot, myMove.x, myMove.y + 1, myMove.z) ) {
                    console.log("DigForward A");
                    equipTool(bot, myMove.x, myMove.y + 1, myMove.z);
                    //console.log(bot.blockAt(new Vec3(myMove.x, myMove.y + 1, myMove.z)));
                    digBlock(bot, myMove.x, myMove.y + 1, myMove.z);
                    botMove.forward = false;
                    botMove.sprint = false;
                    botIsDigging = 2;
                    busyBuilding = true;
                } else if (!blockWalk(bot, myMove.x, myMove.y, myMove.z) && blockSolid(bot, myMove.x, myMove.y, myMove.z) &&
                    canDigBlock(bot, myMove.x, myMove.y, myMove.z)) {
                    console.log("DigForward B");
                    equipTool(bot, myMove.x, myMove.y, myMove.z);
                    digBlock(bot, myMove.x, myMove.y, myMove.z);
                    botMove.forward = false;
                    botMove.sprint = false;
                    botIsDigging = 2;
                    busyBuilding = true;
                }
            } else if ((bot.entity.onGround || bot.entity.isInWater || bot.entity.isInLava) & bot.entity.position.y >= myMove.y - 1.25 & bot.entity.position.y <= myMove.y + 0.25 | isSwim(myMove.mType) && !bot.targetDigBlock /*&& botDigDelay <= 0*/) {
                //console.log("DigForward?");
                if (blockSolid(bot, Math.floor(lastPos.x), myMove.y + 1, Math.floor(lastPos.z)) &&
                    canDigBlock(bot, Math.floor(lastPos.x), myMove.y + 1, Math.floor(lastPos.z)) ) {
                    console.log("Dig Up A");
                    equipTool(bot, Math.floor(lastPos.x), myMove.y + 1, Math.floor(lastPos.z));
                    //console.log(bot.blockAt(new Vec3(myMove.x, myMove.y + 1, myMove.z)));
                    digBlock(bot, Math.floor(lastPos.x), myMove.y + 1, Math.floor(lastPos.z));
                    botMove.forward = false;
                    botMove.sprint = false;
                    botMove.jump = false;
                    botIsDigging = 2;
                    busyBuilding = true;
                } else if (blockSolid(bot, myMove.x, myMove.y + 1, myMove.z) &&
                    canDigBlock(bot, myMove.x, myMove.y + 1, myMove.z) ) {
                    console.log("Dig Up B");
                    equipTool(bot, myMove.x, myMove.y + 1, myMove.z);
                    //console.log(bot.blockAt(new Vec3(myMove.x, myMove.y + 1, myMove.z)));
                    digBlock(bot, myMove.x, myMove.y + 1, myMove.z);
                    botMove.forward = false;
                    botMove.sprint = false;
                    botMove.jump = false;
                    botIsDigging = 2;
                    busyBuilding = true;
                } else if (!blockWalk(bot, myMove.x, myMove.y, myMove.z) && blockSolid(bot, myMove.x, myMove.y, myMove.z) &&
                    canDigBlock(bot, myMove.x, myMove.y, myMove.z)) {
                    console.log("Dig Up C");
                    equipTool(bot, myMove.x, myMove.y, myMove.z);
                    digBlock(bot, myMove.x, myMove.y, myMove.z);
                    botMove.forward = false;
                    botMove.sprint = false;
                    botMove.jump = false;
                    botIsDigging = 2;
                    busyBuilding = true;
                }
            } else if (myMove.mType == "goUp") {
                if ((bot.entity.onGround || bot.entity.isInWater || bot.entity.isInLava) && blockSolid(bot, myMove.x, myMove.y + 1, myMove.z) &&
                    canDigBlock(bot, myMove.x, myMove.y + 1, myMove.z)) {
                    console.log("Dig UP UP");
                    equipTool(bot, myMove.x, myMove.y + 1, myMove.z);
                    //console.log(bot.blockAt(new Vec3(myMove.x, myMove.y + 1, myMove.z)));
                    digBlock(bot, myMove.x, myMove.y + 1, myMove.z);
                    botMove.forward = false;
                    botMove.sprint = false;
                    botMove.jump = false;
                    botIsDigging = 2;
                    busyBuilding = true;
                } else if (breakAndPlaceBlock(bot, myMove.x, myMove.y - 1, myMove.z, true)) {
                    equipTool(bot, myMove.x, myMove.y - 1, myMove.z);
                    digBlock(bot, myMove.x, myMove.y - 1, myMove.z);
                    console.log("just a sec before pillaring...");
                    busyBuilding = true;
                }  else if (bot.entity.position.y > myMove.y - 1 && blockAir(bot, myMove.x, myMove.y - 1, myMove.z) | blockAir(bot, myMove.x, myMove.y, myMove.z)) {
                    equipItem(bot, garbageBlocks, "hand");
                    //holdWeapon = false;
                    placeBlock(bot, myMove.x, myMove.y - 1, myMove.z, false/*(myMove.y != lastPos.y) ? Math.atan2(myMove.x - lastPos.x, lastPos.z - myMove.z) : undefined*/);
                }
            }
            if (/*!botIsDigging &&*/!isSwim(myMove.mType) && !bot.targetDigBlock && !blockStand(bot, myMove.x, myMove.y - 1, myMove.z) &&
                myMove.y == lastPos.y & dist3d(bot.entity.position.x, 0, bot.entity.position.z, myMove.x + 0.5, 0, myMove.z + 0.5) <= Math.sqrt(0.5) /*|
                myMove.y != lastPos.y & dist3d(bot.entity.position.x, 0, bot.entity.position.z, myMove.x + 0.5, 0, myMove.z + 0.5) <= dist3d(0, 0, 0, 3, 3, 3)*/) {
                botMove.forward = false;
                botMove.sprint = false;
                botMove.sneak = true;
                if (dist3d(bot.entity.position.x, 0, bot.entity.position.z, lastPos.x + 0.5, 0, lastPos.z + 0.5) >= Math.sqrt(0.35)) {botMove.back = true;}
                if (breakAndPlaceBlock(bot, myMove.x, myMove.y - 1, myMove.z, true)) {
                    equipTool(bot, myMove.x, myMove.y - 1, myMove.z);
                    digBlock(bot, myMove.x, myMove.y - 1, myMove.z);
                    console.log("just a sec before bridging...");
                    busyBuilding = true;
                } else if (!bot.targetDigBlock && myMove.mType != "fall") {
                    equipItem(bot, garbageBlocks, "hand");
                    //holdWeapon = false;
                    placeBlock(bot, myMove.x, myMove.y - 1, myMove.z, false/*(myMove.y != lastPos.y) ? Math.atan2(myMove.x - lastPos.x, lastPos.z - myMove.z) : undefined*/);
                    /*if (botSpeed <= 0.1 && lastPos.y <= myMove.y) {
                        bot.entity.position.x = lastPos.x + 0.5;
                        bot.entity.position.z = lastPos.z + 0.5;
                    }*/
                    console.log("placeblock");
                    busyBuilding = true;
                    botMove.faceBackwards = 4;
                }
            }
        if (!bot.targetDigBlock && botDestinationTimer > 30 && !busyBuilding && botIsDigging < 0) {
            botDestinationTimer = 30;
            console.log("not busy");
        }
    };
var botShiftTimer = 2;
bot.once("spawn", () => {
    console.log("Success! Say goto <player, me, coords> to pathfind");
    console.log(bot.heldItem);
    if (bot.heldItem && bot.heldItem.nbt && bot.heldItem.nbt.value && bot.heldItem.nbt.value.LodestonePos) {
        console.log(JSON.stringify(bot.heldItem.nbt.value.LodestonePos));
    }
    //console.log(bot.physics.playerHeight);//playerHalfWidth
    bot.physics.playerHalfWidth = 0.3001;
    //bot.physics.stepHeight = 0.15;
    //console.log(bot.physics.playerHalfWidth);
    bot.chat("Success! Say goto <player, me, coords> to pathfind");
    setInterval(run, 50);
    //var lastPosition = {"x":0, "y":0, "time":Date.now()};
    var swimmingFast = false;
    var shouldSwimFast = true;
    function run() {
        if (botIsDigging > 0) {botIsDigging--;}
        if (botMove.lastTimer > -10) {botMove.lastTimer--;}
        bot.updateHeldItem();
        /*botShiftTimer--;
        if (botShiftTimer > 0) {
            bot.physics.playerHalfWidth = 0.300;
        } else if (botShiftTimer <= 0) {
            bot.physics.playerHalfWidth = 0.302;
        }
        if (botShiftTimer <= -1) {
            botShiftTimer = 2;
        }*/
        for (var i = 0; i < equipPackets.length; i++) {
            equipPackets[i].time--;
            if (equipPackets[i].time < 0) {
                equipPackets.splice(i, 1);
                continue;
            }
        }
        holdWeapon = true;
        bot.physics.waterInertia = 0.8;
        bot.physics.waterGravity = 0.005;
        if (blockWater(bot, Math.floor(bot.entity.position.x), Math.floor(bot.entity.position.y), Math.floor(bot.entity.position.z)) &&
            blockWater(bot, Math.floor(bot.entity.position.x), Math.floor(bot.entity.position.y + 1), Math.floor(bot.entity.position.z)) | swimmingFast &&
            pathfinderOptions.sprint && shouldSwimFast) {
            swimmingFast = true;
            bot.physics.waterInertia = 0.9;
            bot.physics.waterGravity = 0.001;
        }
        shouldSwimFast = true;
        if (!bot.entity.onGround) {botGrounded = 1;}
        if (bot.entity.onGround) {
            botGrounded--;
        }
        if (botDigCTimer > -10) {botDigCTimer--;}
        if (jumpTimer > -10) {jumpTimer--;}
        if (botDigDelay > 0) {botDigDelay--;}
        if (bot.targetDigBlock) {botDigDelay = 2;}
        if (lookAtNextDelay > 0) {lookAtNextDelay--;}
        attackTimer += 0.05;
        //console.log(huntMode);
        if (botSearchingPath > -100) {
            botSearchingPath--;
        }
        if (botPathfindTimer < 1000 && botSearchingPath > 0) {
            botPathfindTimer++;
        } else if (botSearchingPath > 0) {
            botPathfindTimer = 0;
        }

        //Follow the target by extending the path if in hunt mode.
        if (huntTrackTimer >= 0 && onPath | movesToGo.length == 0 && huntTarget) {
            //console.log("TWEET TWEET TWEET");
            huntTrackTimer--;
            if (huntTrackTimer < 0 && botSearchingPath < 0 /*&&
                dist3d(lastHuntTargetPos.x, lastHuntTargetPos.y, lastHuntTargetPos.z,
                Math.floor(huntTarget.entity.position.x), Math.round(huntTarget.entity.position.y), Math.floor(huntTarget.entity.position.z)) >= Math.sqrt(30) |
                dist3d(bot.entity.position.x, bot.entity.position.y, bot.entity.position.z,
                       huntTarget.entity.position.x, huntTarget.entity.position.y, huntTarget.entity.position.z) <= Math.sqrt(100)*/) {
                huntTrackTimer = 20; 
                if (dist3d(bot.entity.position.x, bot.entity.position.y, bot.entity.position.z,
                       huntTarget.entity.position.x, huntTarget.entity.position.y, huntTarget.entity.position.z) <= Math.sqrt(30)) {
                    huntTrackTimer = 5;
                    console.log("turbo");
                }
                lastHuntTargetPos = {"x":Math.floor(huntTarget.entity.position.x), "y":Math.round(huntTarget.entity.position.y), "z":Math.floor(huntTarget.entity.position.z)};
                botGoal = {"x":Math.floor(huntTarget.entity.position.x), "y":Math.round(huntTarget.entity.position.y), "z":Math.floor(huntTarget.entity.position.z), "reached":botGoal.reached};
                findPath(bot, Math.floor(huntTarget.entity.position.x), Math.round(huntTarget.entity.position.y), Math.floor(huntTarget.entity.position.z), false, true);
            }
        }

        //extend the path when near the end of a path that hasn't reached the goal yet due to chunk borders
        if (!huntTarget && botSearchingPath <= 0 && !botGoal.reached && movesToGo.length > 0 && movesToGo.length <= 10 && movesToGo[0].x != botGoal.x | movesToGo[0].y != botGoal.y & botGoal.y != "no" | movesToGo[0].z != botGoal.z) {
                console.log("Extending path through chunks...");
                if (botGoal.y != "no") {
                    findPath(bot, Math.floor(botGoal.x), Math.round(botGoal.y), Math.floor(botGoal.z), false, true);//Extending path here. "moveType" is not defined, line 1471
                } else {
                    findPath(bot, Math.floor(botGoal.x), "no", Math.floor(botGoal.z), false, true);//Extending path here. "moveType" is not defined, line 1471
                }
        } else if (movesToGo.length > 0 && movesToGo.length <= 10) {
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
        var target = bot.nearestEntity();
        if (target) {
            //bot.setControlState("forward", true);
            //bot.lookAt(target.position.offset(0, 1.6, 0));
        }

        //bot.setControlState("forward", false);
        //bot.setControlState("back", false);
        //bot.setControlState("sprint", false);
        //bot.setControlState("left", false);
        //bot.setControlState("right", false);
        botMove = {
            "forward":false,
            "back":false,
            "left":false,
            "right":false,
            "sneak":false,
            "sprint":false,
            "jump":false,
            "isGrounded":botMove.isGrounded,
            "faceBackwards":botMove.faceBackwards - 1,
            "mlg":botMove.mlg - 1,
            "bucketTimer":botMove.bucketTimer - 1,
            "bucketTarget":{x:botMove.bucketTarget.x,y:botMove.bucketTarget.y,z:botMove.bucketTarget.z},
            "lastTimer":botMove.lastTimer,
        };
        if (botMove.mlg < -100) {botMove.mlg = -100;}
        if (botMove.bucketTimer < -100) {botMove.bucketTimer = -100;}
        if (botMove.faceBackwards < -100) {botMove.faceBackwards = -100;}
        var botSpeed = Math.sqrt(bot.entity.velocity.x * bot.entity.velocity.x + bot.entity.velocity.z * bot.entity.velocity.z);
        if (bot.entity.velocity.y < -0.3518) {
            //console.log("uh oh! " + bot.entity.velocity.y);
            var clutchCanidates = [false, false, false, false];
            var safeBlockCount = 0;
            var myClutchCanidate = false;
            for (var i = 0; i < 21; i++) {
                if (Math.floor(bot.entity.position.y) - i <= 0) {
                    i = 21;
                    break;
                }
                if (!clutchCanidates[0] && !blockAir(bot, Math.floor(bot.entity.position.x - 0.3001),
                             Math.floor(bot.entity.position.y) - i,
                             Math.floor(bot.entity.position.z - 0.3001))) {
                    clutchCanidates[0] = bot.blockAt(new Vec3(Math.floor(bot.entity.position.x - 0.3001),
                             Math.floor(bot.entity.position.y) - i,
                             Math.floor(bot.entity.position.z - 0.3001)));
                }
                if (!clutchCanidates[1] && !blockAir(bot, Math.floor(bot.entity.position.x + 0.3001),
                             Math.floor(bot.entity.position.y) - i,
                             Math.floor(bot.entity.position.z - 0.3001))) {
                    clutchCanidates[1] = bot.blockAt(new Vec3(Math.floor(bot.entity.position.x + 0.3001),
                             Math.floor(bot.entity.position.y) - i,
                             Math.floor(bot.entity.position.z - 0.3001)));
                }
                if (!clutchCanidates[2] && !blockAir(bot, Math.floor(bot.entity.position.x - 0.3001),
                             Math.floor(bot.entity.position.y) - i,
                             Math.floor(bot.entity.position.z + 0.3001))) {
                    clutchCanidates[2] = bot.blockAt(new Vec3(Math.floor(bot.entity.position.x - 0.3001),
                             Math.floor(bot.entity.position.y) - i,
                             Math.floor(bot.entity.position.z + 0.3001)));
                }
                if (!clutchCanidates[3] && !blockAir(bot, Math.floor(bot.entity.position.x + 0.3001),
                             Math.floor(bot.entity.position.y) - i,
                             Math.floor(bot.entity.position.z + 0.3001))) {//(!!!)Probably need to account for negatives or something
                    clutchCanidates[3] = bot.blockAt(new Vec3(Math.floor(bot.entity.position.x + 0.3001),
                             Math.floor(bot.entity.position.y) - i,
                             Math.floor(bot.entity.position.z + 0.3001)));
                }
            }
            for (var i = 0; i < clutchCanidates.length; i++) {
                if (!clutchCanidates[i]) {
                    continue;
                } else {
                    if (blockWater(bot, clutchCanidates[i].position.x, clutchCanidates[i].position.y, clutchCanidates[i].position.z)) {
                        safeBlockCount++;
                    }
                    if (!myClutchCanidate || myClutchCanidate && clutchCanidates[i].position.y > myClutchCanidate.position.y ||
                        myClutchCanidate && myClutchCanidate == myClutchCanidate.position.y &&
                        !blockWater(bot, clutchCanidates[i].position.x, clutchCanidates[i].position.y, clutchCanidates[i].position.z)) {
                        myClutchCanidate = clutchCanidates[i];
                    }
                }
            }
            if (!myClutchCanidate && !onPath | (movesToGo[lastPos.currentMove] && Math.abs(movesToGo[lastPos.currentMove].y - lastPos.y) > 3)) {
                bot.look(bot.entity.yaw, 0, 100);
            } else if (bot.entity.velocity.y <= -0.5518 && myClutchCanidate && safeBlockCount < 4 &&
                !blockWater(bot, myClutchCanidate.position.x, myClutchCanidate.position.y, myClutchCanidate.position.z) &&
                !onPath | (movesToGo[lastPos.currentMove] && Math.abs(movesToGo[lastPos.currentMove].y - lastPos.y) > 3)) {
                botMove.mlg = 4;
                console.log("saving myself...");
                equipItem(bot, ["water_bucket"], "hand");
                //console.log(bot.heldItem);
                botMove.bucketTarget = {
                    x:myClutchCanidate.position.x + 0.5,
                    y:myClutchCanidate.position.y,
                    z:myClutchCanidate.position.z + 0.5
                };
                var canLookStraightDown = true;
                for (var i = 0; i < clutchCanidates.length; i++) {
                    if (clutchCanidates[i].y != botMove.bucketTarget.y) {
                        canLookStraightDown = false;
                    }
                }
                if (canLookStraightDown) {
                    botMove.bucketTarget.x = bot.entity.position.x;
                    botMove.bucketTarget.z = bot.entity.position.z;
                }
                bot.lookAt(new Vec3(botMove.bucketTarget.x, botMove.bucketTarget.y, botMove.bucketTarget.z), true, function() {
                    var leBlockAtCursor = bot.blockAtCursor(5);
                    if (bot.entity.velocity.y <= -0.6518 && botMove.bucketTimer <= 0 && leBlockAtCursor &&
                        leBlockAtCursor.position.x == myClutchCanidate.position.x &&
                        leBlockAtCursor.position.y == myClutchCanidate.position.y &&
                        leBlockAtCursor.position.z == myClutchCanidate.position.z &&
                        Math.abs(myClutchCanidate.position.y - bot.entity.position.y) <= 5 && botMove.bucketTimer <= 0 && bot.heldItem && bot.heldItem.name == "water_bucket") {
                        botMove.bucketTimer = 5;
                        bot.activateItem(false);
                    }
                });
            } else {
                //console.log("AHHHHHH!!!! " + JSON.stringify(clutchCanidates) + ", " + myClutchCanidate);
            }
        }
        if (bot.entity.velocity.y <= -0.5518 && botMove.mlg > 0 | botMove.bucketTimer > 0 && !onPath | (movesToGo[lastPos.currentMove] && Math.abs(movesToGo[lastPos.currentMove].y - lastPos.y) > 3)) {
            bot.lookAt(new Vec3(botMove.bucketTarget.x, botMove.bucketTarget.y, botMove.bucketTarget.z), true);
        }
        if (botMove.mlg <= 0 && botMove.bucketTimer <= 0 && bot.heldItem && bot.heldItem.name == "bucket") {
            var waterBlock = bot.findBlock({
                matching: (block) => (block.stateId === 34),//thank you u9g
                maxDistance: 5,
            });
            if (waterBlock) {
                console.log(JSON.stringify(waterBlock));
                botMove.bucketTimer = 5;
                botMove.bucketTarget.x = waterBlock.position.x + 0.5;
                botMove.bucketTarget.y = waterBlock.position.y + 0.5;
                botMove.bucketTarget.z = waterBlock.position.z + 0.5;
                bot.lookAt(new Vec3(botMove.bucketTarget.x, botMove.bucketTarget.y, botMove.bucketTarget.z), true);
                bot.activateItem(false);
                console.log("Getting the water bucket back");
            }
        }
        if (movesToGo.length > 0 && lastPos.currentMove >= 0) {
            var myMove = movesToGo[lastPos.currentMove];
            debugTimer++;
            if (debugTimer > 30) {
                //if (!onPath) {
                    //console.log("ERROR: Off the path!");
                    //bot.chat("/tp @s " + lastPos.x + " " + lastPos.y + " " + lastPos.z);
                //}
                debugTimer = 0;
                //console.log(JSON.stringify(lastPos) + "\n" + "\n" + JSON.stringify(movesToGo));
                for (var i = 0; i < movesToGo.length; i++) {
                    // bot.chat("/particle flame " + movesToGo[i].x + " " + movesToGo[i].y + " " + movesToGo[i].z);
                }
            }
            //console.log("e" + movesToGo.length + ", " + lastPos.currentMove);
            //bot.chat("/particle damage_indicator " + movesToGo[lastPos.currentMove].x + " " + movesToGo[lastPos.currentMove].y + " " + movesToGo[lastPos.currentMove].z);
            //bot.chat("/particle heart " + lastPos.x + " " + lastPos.y + " " + lastPos.z);
            var goalBox = {"x":myMove.x, "y":myMove.y, "z":myMove.z, "w":1, "h":2, "d":1};
            var onPathBoxes = [];
            if (Math.floor(lastPos.y) == myMove.y) {
                onPathBoxes = [
                    {"x":lastPos.x, "y":lastPos.y, "z":lastPos.z, "w":1, "h":2, "d":1},
                ];
                var myX = Math.floor(lastPos.x);
                var myZ = Math.floor(lastPos.z);
                var checkerCount = 0;
                while (myX != myMove.x | myZ != myMove.z && checkerCount < 5) {
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
                    onPathBoxes.push({"x":myX, "y":myMove.y, "z":myZ, "w":1, "h":2, "d":1});
                }
            } else if (myMove.y < lastPos.y) {
                if (myMove.x == lastPos.x && myMove.z == lastPos.z) {goalBox = {"x":myMove.x, "y":myMove.y - 1, "z":myMove.z, "w":1, "h":2, "d":1};}
                onPathBoxes = [
                    {"x":lastPos.x, "y":lastPos.y, "z":lastPos.z, "w":1, "h":2, "d":1},
                    {"x":myMove.x, "y":myMove.y, "z":myMove.z, "w":1, "h":lastPos.y - myMove.y + 2, "d":1},
                ];
                var myX = Math.floor(lastPos.x);
                var myZ = Math.floor(lastPos.z);
                var checkerCount = 0;
                while (myX != myMove.x | myZ != myMove.z && checkerCount < 5) {
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
                    onPathBoxes.push({"x":myX, "y":myMove.y - 0.5, "z":myZ, "w":1, "h":3, "d":1});
                }
            } else if (myMove.y > lastPos.y) {
                onPathBoxes = [
                    {"x":Math.floor(lastPos.x), "y":Math.floor(lastPos.y), "z":Math.floor(lastPos.z), "w":1, "h":3, "d":1},
                    //{"x":myMove.x, "y":myMove.y, "z":myMove.z, "w":1, "h":2,"d":1},
                ];
                var myX = Math.floor(lastPos.x);
                var myZ = Math.floor(lastPos.z);
                var checkerCount = 0;
                while (myX != myMove.x | myZ != myMove.z && checkerCount < 5) {
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
                    onPathBoxes.push({"x":myX, "y":myMove.y - 0.0, "z":myZ, "w":1, "h":2.0, "d":1});
                }
            }
            if (isSwim(myMove.mType)) {
                for (var i = 0; i < onPathBoxes.length; i++) {
                    onPathBoxes[i].y -= 0.5;
                    onPathBoxes[i].h += 1;
                }
                goalBox.y -= 0.5;
                goalBox.h += 1;
            }
            //onPathBoxes.push({"x":movesToGo[movesToGo.length - 1].x - 0.5, "y":movesToGo[movesToGo.length - 1].y - 0.5, "z":movesToGo[movesToGo.length - 1].z - 0.5, "w":2, "h":3, "d":2});

            onPath = false;
            for (var i = 0; i < onPathBoxes.length; i++) {
                var e = onPathBoxes[i];
                if (bot.entity.position.x + 0.52 > e.x && bot.entity.position.x - 0.52 < e.x + e.w &&
                    bot.entity.position.y - 1 < e.y + e.h + 0.2 && bot.entity.position.y + 1 >= e.y &&
                    bot.entity.position.z + 0.52 > e.z && bot.entity.position.z - 0.52 < e.z + e.d) {
                    onPath = true;
                    //console.log(JSON.stringify(onPathBoxes[i]));
                }
            }
            botDestinationTimer--;
            if (botDestinationTimer < 0) {
                onPath = false;
            }
            if (!onPath) {
                console.log("GET BACK IN FORMATION SOLDIER");
                if (bot.entity.onGround | bot.entity.isInWater | bot.entity.isInLava && movesToGo.length > 0 && botSearchingPath < 0) {
                    findPath(bot, movesToGo[0].x, movesToGo[0].y, movesToGo[0].z, true);
                }
            }

            var myAngle = Math.atan2(myMove.x - lastPos.x, lastPos.z - myMove.z);
            var myWalkAngle = Math.atan2(myMove.x - bot.entity.position.x + 0.5, bot.entity.position.z - 0.5 - myMove.z);
            if (myWalkAngle < myAngle - Math.PI) {
                myWalkAngle += Math.PI * 2;
                //console.log("fixed positive");
            } else if (myWalkAngle > myAngle + Math.PI) {
                myWalkAngle -= Math.PI * 2;
                //console.log("fixed negative");
            }

            //Executing the path
            if (true) {
                botMove.forward = true;
                botMove.sprint = pathfinderOptions.sprint;
                if (bot.targetDigBlock) {botMove.forward = false;}
            }

            var jumpDir = {"x":(Math.floor(lastPos.x) > myMove.x) ? -1 : 1, "z": (Math.floor(lastPos.z) > myMove.z) ? -1 : 1};
            if (lastPos.x == myMove.x) {jumpDir.x = 0;}
            if (lastPos.z == myMove.z) {jumpDir.z = 0;}
            //console.log(myMove);
            console.log(bot.blockAt(new Vec3(Math.floor(myMove.x), Math.floor(myMove.y), Math.floor(myMove.z))).type);
            //console.log(blockWater(bot, Math.floor(myMove.x), Math.floor(myMove.y), Math.floor(myMove.z)));
            //stuff here(!!!)
            busyBuilding = false;
            takeCareOfBlock(myMove);
            /*if (!busyBuilding && movesToGo[lastPos.currentMove - 1]) {
                console.log("WE DOING IT");
                takeCareOfBlock(movesToGo[lastPos.currentMove - 1]);
                if (!busyBuilding && movesToGo[lastPos.currentMove - 2]) {
                    console.log("WE DOING IT AGAIN");
                    takeCareOfBlock(movesToGo[lastPos.currentMove - 2]);
                }
            }*/
            if (myMove.mType == "goUp") {//bruh bruh
                if (bot.entity.position.y <= myMove.y - 0.25 ||
                    blockLava(bot, lastPos.x, lastPos.y, lastPos.z) || blockWater(bot, lastPos.x, lastPos.y, lastPos.z) || 
                    blockLava(bot, lastPos.x, lastPos.y + 1, lastPos.z) || blockWater(bot, lastPos.x, lastPos.y + 1, lastPos.z)) {
                    if (!blockLava(bot, lastPos.x, lastPos.y, lastPos.z) && !blockLava(bot, lastPos.x, lastPos.y + 1, lastPos.z)) {
                        botMove.jump = true;
                    } else if (bot.entity.velocity.y < 1.0 && Math.floor(bot.entity.position.x) == lastPos.x && Math.floor(bot.entity.position.z) == lastPos.z &&
                               Math.floor(bot.entity.position.y) == lastPos.y & blockLava(bot, lastPos.x, lastPos.y, lastPos.z) |
                               Math.floor(bot.entity.position.y) == lastPos.y + 1 & blockLava(bot, lastPos.x, lastPos.y + 1, lastPos.z)) {
                        bot.entity.velocity.y += 0.1;
                        console.log("EEEEEEE");
                        botMove.jump = true;
                    }
                }
                botMove.sprint = false;
                //if (dist3d(bot.entity.position.x, 0, bot.entity.position.z, myMove.x + 0.5, 0, myMove.z + 0.5) <= Math.sqrt(0.25)) {botMove.forward = false;}
            } else if (myMove.mType == "walk" & dist3d(lastPos.x, 0, lastPos.z, myMove.x, 0, myMove.z) > Math.sqrt(3) | myMove.mType == "walkDiag" & dist3d(lastPos.x, 0, lastPos.z, myMove.x, 0, myMove.z) > Math.sqrt(3) |
                myMove.mType == "walkJump" | myMove.mType == "walkDiagJump" &&
                /*dist3d(lastPos.x, 0, lastPos.z, myMove.x, 0, myMove.z) > Math.sqrt(3) &&*/ dist3d(lastPos.x, 0, lastPos.z, myMove.x, 0, myMove.z) < Math.sqrt(32)) {
                if (myMove.mType == "walk" | myMove.mType == "walkDiag") {console.log("you sure you should be jumping right now?");}
                //console.log("maybe" + (myMove.y >= lastPos.y & (Math.abs(myMove.x - lastPos.x) || Math.abs(myMove.z - lastPos.z))));
                if (Math.abs(myMove.x - lastPos.x) == 1 | Math.abs(myMove.z - lastPos.z) == 1 && myMove.y > lastPos.y ||
                    dist3d(bot.entity.position.x, 0, bot.entity.position.z, myMove.x + 0.5, 0, myMove.z + 0.5) > Math.sqrt(2) &&
                    jumpDir.x == 0 |
                    jumpDir.x > 0 & bot.entity.position.x >= lastPos.x + 0.5 + jumpDir.x * 0.2 |
                    jumpDir.x < 0 & bot.entity.position.x <= lastPos.x + 0.5 + jumpDir.x * 0.2 &&
                    jumpDir.z == 0 |
                    jumpDir.z > 0 & bot.entity.position.z >= lastPos.z + 0.5 + jumpDir.z * 0.2 |
                    jumpDir.z < 0 & bot.entity.position.z <= lastPos.z + 0.5 + jumpDir.z * 0.2) {
                    //console.log("parkour jump " + (myWalkAngle - myAngle));
                    var shouldStrafeCorrect = true;
                    for (var i = lastPos.currentMove; i > lastPos.currentMove - 5 && i > 0; i--) {
                        if (!movesToGo[i + 1] || movesToGo[i + 1] && movesToGo[i].y <= movesToGo[i + 1].y) {
                            shouldStrafeCorrect = false;
                        }
                    }
                    if (shouldStrafeCorrect && myMove.y <= lastPos.y | Math.abs(myWalkAngle - myAngle) < 0.45 |
                        Math.abs(myMove.x - lastPos.x) >= 2 | Math.abs(myMove.z - lastPos.z) >= 2 && bot.entity.position.y < myMove.y - 0.2) {//qwerty
                        if (myMove.y > lastPos.y && myWalkAngle - myAngle > 0.25) {
                            console.log("R");
                            botMove.right = true;
                        } else if (myMove.y > lastPos.y && myWalkAngle - myAngle < -0.25) {
                            console.log("L");
                            botMove.left = true;
                        }
                    }
                    if (botMove.lastTimer < 0 && botMove.isGrounded >= 0) {
                        botMove.jump = true;
                    }
                    if (myMove.y > lastPos.y | dist3d(lastPos.x, 0, lastPos.z, myMove.x, 0, myMove.z) >= Math.sqrt(16) && bot.entity.position.y <= lastPos.y + 1.05) {
                        //bot.entity.velocity.x = Math.sin(myWalkAngle) * 0.22;
                        //bot.entity.velocity.z = -Math.cos(myWalkAngle) * 0.22;
                        //if (myMove.y > lastPos.y) {bot.entity.velocity.y = 0.35;}
                    }
                    botSpeed = Math.sqrt(bot.entity.velocity.x * bot.entity.velocity.x + bot.entity.velocity.z * bot.entity.velocity.z);
                } else if (dist3d(bot.entity.position.x, 0, bot.entity.position.z, myMove.x + 0.5, 0, myMove.z + 0.5) < Math.sqrt(6) &&
                           dist3d(lastPos.x, 0, lastPos.z, myMove.x, 0, myMove.z) <= Math.sqrt(9) &&
                           blockAir(bot, myMove.x, myMove.y, myMove.z) && myMove.y <= lastPos.y &&
                           Math.abs(myMove.x - lastPos.x) >= 3 | Math.abs(myMove.z - lastPos.z) >= 3 | myMove.y == lastPos.y) {
                    //This is a fall
                    botMove.sprint = false;
                } else if (myMove.y <= lastPos.y && dist3d(bot.entity.position.x, 0, bot.entity.position.z, myMove.x + 0.5, 0, myMove.z + 0.5) <= Math.sqrt(0.5) &&
                           myMove.x == lastPos.z && myMove.z == lastPos.z ||
                           myMove.y < lastPos.y /*&& dist3d(bot.entity.position.x, 0, bot.entity.position.z, myMove.x + 0.5, 0, myMove.z + 0.5) <= Math.sqrt(0.5)*/) {
                    //straight up or straight down
                    botMove.sprint = false;
                }
                var lastPosIsLegit = false;
                var lastPosSameDir = true;
                if (movesToGo[lastPos.currentMove - 1]) {
                    lastPosIsLegit = true;
                    if (movesToGo[lastPos.currentMove - 1].x - myMove.x != jumpDir.x ||
                        movesToGo[lastPos.currentMove - 1].z - myMove.z != jumpDir.z) {
                        lastPosSameDir = false;
                    }
                }
                if (Math.abs(myMove.x - lastPos.x) == 2 | Math.abs(myMove.z - lastPos.z) == 2/* && !lastPosIsLegit | !lastPosSameDir*/) {
                    //don't sprint on 1 block gaps
                    botMove.sprint = false;
                    //console.log("Slow down!");
                }
            } else if (myMove.mType == "swimSlow") {
                shouldSwimFast = false;
                botMove.forward = true;
                if (bot.entity.position.y < myMove.y + slabSwimTarget(bot, myMove.x, myMove.y, myMove.z) || bot.entity.position.y < myMove.y + 1.5 && !blockWater(bot, myMove.x, myMove.y + 1, myMove.z)) {
                    botMove.jump = true;
                } else if (bot.entity.position.y > myMove.y + 0.2 + slabSwimTarget(bot, myMove.x, myMove.y, myMove.z) && blockWater(bot, myMove.x, myMove.y + 1, myMove.z)) {
                    botMove.sneak = true;
                    if (bot.entity.velocity.y > -1.0) {bot.entity.velocity.y -= 0.01;}
                }
            } else if (myMove.mType == "swimFast" || myMove.mType == "fallWater") {
                if (bot.entity.position.y > myMove.y + 0.3 + slabSwimTarget(bot, myMove.x, myMove.y, myMove.z) &&
                    bot.entity.velocity.y > -1.0 /*&& bot.entity.velocity.y < (bot.entity.position.y - (movesToGo[lastPos.currentMove].y + 0.2)) / 2*/) {
                    bot.entity.velocity.y -= 0.05;
                    //console.log("swimDown");
                } else if (bot.entity.position.y < myMove.y + 0.1 + slabSwimTarget(bot, myMove.x, myMove.y, myMove.z) && bot.entity.velocity.y < 1.0) {
                    bot.entity.velocity.y += 0.05;
                    //console.log("swimUp");
                }
                var myMoveDir = {x:myMove.x - lastPos.x, z:myMove.z - lastPos.z};
                if (blockLilypad(bot, myMove.x, myMove.y + 2, myMove.z)) {
                    digBlock(bot, myMove.x, myMove.y + 2, myMove.z);
                } else if (blockLilypad(bot, myMove.x - myMoveDir.x, myMove.y + 2, myMove.z)) {
                    digBlock(bot, myMove.x - myMoveDir.x, myMove.y + 2, myMove.z);
                } else if (blockLilypad(bot, myMove.x, myMove.y + 2, myMove.z - myMoveDir.z)) {
                    digBlock(bot, myMove.x, myMove.y + 2, myMove.z - myMoveDir.z);
                }
            } else if (myMove.mType == "lava" && bot.entity.position.y < movesToGo[lastPos.currentMove].y + slabSwimTarget(bot, myMove.x, myMove.y, myMove.z)) {
                botMove.jump = true;
            }
            if (bot.targetDigBlock) {botIsDigging = 2;}
            if (botIsDigging > 0 && !isSwim(myMove.mType)) {
                botMove.jump = false;
            }

            //if (lookAtNextDelay <= 0) {
            if (botMove.jump) {botMove.faceBackwards = -2;}
            if (botMove.mlg <= 0 && botMove.bucketTimer <= 0) {
                if (botMove.faceBackwards <= 0) {
                    bot.lookAt(new Vec3(myMove.x + 0.5, botLookAtY, myMove.z + 0.5), true);
                } else {
                    botMove.forward = !botMove.forward;
                    botMove.back = !botMove.back;
                    bot.lookAt(new Vec3(
                               bot.entity.position.x + (bot.entity.position.x - (movesToGo[lastPos.currentMove].x + 0.5)),
                               botLookAtY,
                               bot.entity.position.z + (bot.entity.position.z - (movesToGo[lastPos.currentMove].z + 0.5))),
                    25);
                }
            }
                var lastPosSameAmount = true;
                if (movesToGo[lastPos.currentMove - 1]) {
                    if (Math.abs(movesToGo[lastPos.currentMove - 1].x - myMove.x) > 1 |
                        Math.abs(movesToGo[lastPos.currentMove - 1].z - myMove.z) > 1 |
                        ((movesToGo[lastPos.currentMove - 1].x - myMove.x) > 0) != ((myMove.x - lastPos.x) > 0) |
                        ((movesToGo[lastPos.currentMove - 1].z - myMove.z) > 0) != ((myMove.z - lastPos.z) > 0) |
                        ((movesToGo[lastPos.currentMove - 1].x - myMove.x) < 0) != ((myMove.x - lastPos.x) < 0) |
                        ((movesToGo[lastPos.currentMove - 1].z - myMove.z) < 0) != ((myMove.z - lastPos.z) < 0)) {
                        lastPosSameAmount = false;
                    }
                }
                if (/*Math.abs(myMove.x - lastPos.x) == 1 | Math.abs(myMove.x - lastPos.x) == 2 |
                    Math.abs(myMove.z - lastPos.z) == 1 | Math.abs(myMove.z - lastPos.z) == 2 &&*/
                    lastPosSameAmount) {
                    //console.log("Speed up!");
                } else {
                    lastPosSameAmount = false;
                }

            //path stuff
            if (myMove.mType == "start" || blockStand(bot, myMove.x, myMove.y - 1, myMove.z) & bot.entity.onGround & myMove.mType != "goUp" | isSwim(myMove.mType) | lastPosSameAmount & myMove.mType != "goUp" |
                myMove.mType == "goUp" & bot.entity.onGround & bot.entity.position.y >= myMove.y - 0.25 &&
                bot.entity.position.x + 0.2 < goalBox.x + 1 && bot.entity.position.x - 0.2 > goalBox.x &&
                bot.entity.position.y < goalBox.y + 2 && bot.entity.position.y + 2 >= goalBox.y &&
                bot.entity.position.z + 0.2 < goalBox.z + 1 && bot.entity.position.z - 0.2 > goalBox.z) {
                lastPos = {"currentMove":lastPos.currentMove - 1, "x":myMove.x, "y":myMove.y, "z":myMove.z};
                botMove.jump = false;
                botMove.lastTimer = 1;
                if (lastPos.currentMove < movesToGo.length - 2) {movesToGo.splice(lastPos.currentMove + 1, movesToGo.length);}
                botDestinationTimer = 30;
                //movesToGo.splice(movesToGo.length - 1, 1);
            }
        } else {
            onPath = false;
        }
        var target = bot.nearestEntity();
        if (equipPackets.length == 0 && blockPackets.length == 0 && !bot.targetDigBlock && botObstructed <= 0 && botEquipDefault && !botIsDigging) {
            equipItem(bot, ["diamond_sword"]);
            //console.log("equip default " + onPath);
        }
        if (!bot.targetDigBlock) {botLookAtY = bot.entity.position.y + 1.6;}
        if (botSearchingPath <= 0 || onPath && movesToGo.length > 4) {
            bot.setControlState("jump", botMove.jump);
            bot.setControlState("forward", botMove.forward);
            bot.setControlState("back", botMove.back);
            bot.setControlState("left", botMove.left);
            bot.setControlState("right", botMove.right);
            bot.setControlState("sprint", botMove.sprint);
            bot.setControlState("sneak", botMove.sneak);
        } else {
            bot.clearControlStates();
        }
        //console.log(JSON.stringify(botMove) + ", " + botDestinationTimer);
        if (target && attackTimer >= 0.5 && !bot.targetDigBlock && JSON.stringify(target.type) == '"player"' && dist3d(bot.entity.position.x, bot.entity.position.y + 1.6, bot.entity.position.z, target.position.x, target.position.y + 1.6, target.position.z) <= botRange) {
            bot.attack(target, true);
            //console.log(target.position.y);
            //console.log(bot.entity.position.y);
            //bot.stopDigging();
            attackTimer = 0;
            botLookAtY = target.position.y + 1.6;
        }
    };


    /*function run() {
        attackTimer += 0.1;
        var target = bot.nearestEntity();
        if (target) {
            if (strafeTimer < 0) {
                strafeDir = Math.floor(Math.random() * 4 - 0.001) - 1;
                strafeTimer = Math.floor(Math.random() * 200);
            }
            bot.setControlState("left", false);
            bot.setControlState("right", false);
            if (strafeDir < 0 && dist3d(bot.entity.position.x, bot.entity.position.y + 1.6, bot.entity.position.z, target.position.x, target.position.y + 1.6, target.position.z) <= Math.sqrt(30)) {
                bot.setControlState("left", true);
                bot.setControlState("jump", false);
            } else if (strafeDir > 0 && dist3d(bot.entity.position.x, bot.entity.position.y + 1.6, bot.entity.position.z, target.position.x, target.position.y + 1.6, target.position.z) <= Math.sqrt(30)) {
                bot.setControlState("right", true);
                bot.setControlState("jump", false);
            }
            strafeTimer--;
            if (JSON.stringify(target.type) == '"player"' && JSON.stringify(target.username) != '"Generel_Schwerz"') {bot.lookAt(target.position.offset(0, 1.6, 0));}
            if (JSON.stringify(target.type) == '"player"' && JSON.stringify(target.username) != '"Generel_Schwerz"' && attackTimer < 0.85 | dist3d(bot.entity.position.x, bot.entity.position.y + 1.6, bot.entity.position.z, target.position.x, target.position.y + 1.6, target.position.z) <= botRange) {
                strafeTimer--;
                //bot.setControlState("sprint", false);
                if (attackTimer >= 1) {
                    bot.attack(target, true);
                    //console.log(JSON.stringify(target.username));
                    attackTimer = 0;
                }
                bot.setControlState("jump", false);
                bot.setControlState("forward", false);
                bot.setControlState("back", true);
            } else {
                if (dist3d(bot.entity.position.x, bot.entity.position.y + 1.6, bot.entity.position.z, target.position.x, target.position.y + 1.6, target.position.z) >= Math.sqrt(30)) {
                    bot.setControlState("jump", true);
                }
                bot.setControlState("forward", true);
                bot.setControlState("back", false);
                bot.setControlState("sprint", true);
            }
        }
    };*/
});


bot.on("physicsTick", () => {
});

bot.on("chat", function (username, message) {
    if (username != bot.username && username == 'Generel_Schwerz' | username == '"Generel_Schwerz"' | username == "'Generel_Schwerz'") {
        var myMessage = message.split(" ");
        switch (myMessage[0]) {
            case "bug":
                console.log(movesToGo[lastPos.currentMove]);
                bot.chat("/gc");
            break;
            case "goto":
                var validSyntax = false;
                var findPathX = 0, findPathY = 0, findPathZ = 0;
                    if (myMessage[1] == "me") {
                        console.log("Finding you...");
                        var playerTo = bot.players[username];
                        if (playerTo && playerTo.entity) {
                            findPathX = Math.floor(playerTo.entity.position.x);
                            findPathY = Math.round(playerTo.entity.position.y);
                            findPathZ = Math.floor(playerTo.entity.position.z);
                            validSyntax = true;
                        }
                    } else if (myMessage[1] == "*") {
                        var inven = bot.inventory.slots;
                        console.log("Searching for compass...");
                        for (var i = 0; i < inven.length; i++) {
                            if (inven[i] == null) {
                                continue;
                            } else if (inven[i].name == "compass") {
                                    console.log(JSON.stringify(inven[i].name));
                                if (inven[i].nbt && inven[i].nbt.value && inven[i].nbt.value.LodestonePos) {
                                    console.log(JSON.stringify(inven[i].nbt.value.LodestonePos));
                                    findPathX = inven[i].nbt.value.LodestonePos.value.X.value;
                                    //findPathY = inven[i].nbt.value.LodestonePos.value.Y.value + 
                                    findPathY = "no";
                                    findPathZ = inven[i].nbt.value.LodestonePos.value.Z.value;
                                    validSyntax = true;
                                    i = inven.length;
                                }
                            } else {
                                //console.log(inven[i].name);
                            }
                        }
                    } else if (myMessage.length == 2) {
                        console.log("Finding " + myMessage[1] + "...");
                        var playerTo = bot.players[myMessage[1]];
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
                            botGoal = {x:findPathX,y:"no",z:findPathZ,reached:false};
                        }
                        
                        if (findPathX != NaN && findPathY != NaN/* && findPathZ != NaN*/) {
                            validSyntax = true;
                        }
                    }
                if (validSyntax) {
                    bot.chat("Finding path. My current position is X: " + Math.floor(bot.entity.position.x) + 
                         ", Y: " + Math.floor(bot.entity.position.y) +
                         ", Z: " + Math.floor(bot.entity.position.z));
                    if (findPathY != "no") {
                        botGoal = {x:findPathX,y:findPathY,z:findPathZ,reached:false};
                        findPath(bot, findPathX, findPathY, findPathZ);
                    } else {
                        botGoal = {x:findPathX,y:"no",z:findPathZ,reached:false};
                        findPath(bot, findPathX, findPathZ);
                    }
                    //bot.entity.position.x = Math.floor(bot.entity.position.x) + 0.5;
                    //bot.entity.position.z = Math.floor(bot.entity.position.z) + 0.5;
                }
            break;
            case "standingIn":
                console.log(JSON.stringify(bot.blockAt(
                            new Vec3(Math.floor(bot.entity.position.x), Math.floor(bot.entity.position.y), Math.floor(bot.entity.position.z))
                )));
                console.log("is it standable? " + blockStand(bot, Math.floor(bot.entity.position.x), Math.floor(bot.entity.position.y), Math.floor(bot.entity.position.z)));
            break;
            case "openYourEyes":
                mineflayerViewer(bot, {port: 3000, viewDistance: 4});
            break;
            case "tpa":
                //bot.chat("/tpa");
            break;
            case "breakBlock":
                if (bot.canDigBlock(bot.blockAtCursor(5))) {
                    bot.chat("Digging block");
                    bot.dig(bot.blockAtCursor(5));
                } else {
                    bot.chat("Undiggable");
                }
            break;
            case "placeBlock":
                placeBlock(bot, Math.floor(Number(myMessage[1])), Math.floor(Number(myMessage[2])), Math.floor(Number(myMessage[3])));
            break;
            case "inventory":
                equipItem(bot, [myMessage[1]], myMessage[2]);
            break;
            case "trimPath":
                /*var bestOne = [0, 100000];
                for (var i = 0; i < movesToGo.length; i++) {
                    if (dist3d(movesToGo[i].x, movesToGo[i].y, movesToGo[i].z, endX, endY, endZ) < bestOne[1]) {
                        bestOne = [i, dist3d(movesToGo[i].x, movesToGo[i].y, movesToGo[i].z, endX, endY, endZ)];
                    }
                }*/
                var bestOne = [0, 100];
                bestOne[0] += 10;
                if (bestOne[0] > movesToGo.length - 6) {bestOne[0] = movesToGo.length - 6;}
                if (bestOne[0] >= 0) {
                    lastPos.currentMove -= (bestOne[0] + 1);
                    movesToGo.splice(0, bestOne[0] + 1);
                }
                // bot.chat("/particle spit " + movesToGo[0].x + " " + movesToGo[0].y + " " + movesToGo[0].z);
            break;
            case "fixPath":
                findPath(bot, movesToGo[0].x, movesToGo[0].y, movesToGo[0].z, true);
            break;
            case "extendPath":
                botSearchingPath = 10;
                var validSyntax = false;
                var findPathX = 0, findPathY = 0, findPathZ = 0;
                    if (myMessage[1] == "me") {
                        console.log("Finding you...");
                        var playerTo = bot.players[username];
                        if (playerTo && playerTo.entity) {
                            findPathX = Math.floor(playerTo.entity.position.x);
                            findPathY = Math.round(playerTo.entity.position.y);
                            findPathZ = Math.floor(playerTo.entity.position.z);
                            validSyntax = true;
                        }
                    } else if (myMessage.length == 2) {
                        console.log("Finding " + myMessage[1] + "...");
                        var playerTo = bot.players[myMessage[1]];
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
                        
                        if (findPathX != NaN && findPathY != NaN/* && findPathZ != NaN*/) {
                            validSyntax = true;
                        }
                    }

                if (validSyntax) {
                    bot.chat("Finding path. My current position is X: " + Math.floor(bot.entity.position.x) + 
                         ", Y: " + Math.floor(bot.entity.position.y) +
                         ", Z: " + Math.floor(bot.entity.position.z));
                    botGoal = {x:findPathX,y:findPathY,z:findPathZ,reached:false};
                    findPath(bot, findPathX, findPathY, findPathZ, false, true);
                    //bot.entity.position.x = Math.floor(bot.entity.position.x) + 0.5;
                    //bot.entity.position.z = Math.floor(bot.entity.position.z) + 0.5;
                }
            break;
            case "hunt":
                if (myMessage[1] == "all") {
                    huntMode = 0;
                } else {
                    huntMode = 1;
                    console.log(huntMode);
                    huntTarget = bot.players[myMessage[1]];
                    huntTrackTimer = 10;
                    if (huntTarget && huntTarget.entity) {
                        findPathX = Math.floor(huntTarget.entity.position.x);
                        findPathY = Math.round(huntTarget.entity.position.y);
                        findPathZ = Math.floor(huntTarget.entity.position.z);
                        findPath(bot, findPathX, findPathY, findPathZ);
                    }
                }
                console.log("hunting");
            break;
            case "activate":bot.activateItem(false);break;
            case "deactivate":bot.deactivateItem(false);break;
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
                var nearest = bot.nearestEntity();
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
    //Thanks to Ezcha#7675 for this code!
    const shieldListener = (packet) => {
        if (!packet.entityId || !packet.metadata || packet.metadata.length === 0) return;
        if (!packet.metadata[0].key || packet.metadata[0].key !== 7) return;
        if (!bot.entities[packet.entityId]) return;
        const entity = bot.entities[packet.entityId];
        if (entity.type === 'player') {
            const state = (packet.metadata[0].value === 3);
            //console.log("Block this you filthy casual! " + state);
        }
    }
    bot._client.on('entity_metadata', shieldListener);
    //End of Ezcha#7675's code

bot.on("kicked", (reason, loggedIn) => console.log(reason, loggedIn));
bot.on("error", err => console.log(err));

/*
add to digging.js to prevent arm swing bug
    swingInterval = setInterval(() => {
      if (bot.targetDigBlock) {
        bot.swingArm()
      } else {
        clearInterval(swingInterval);
      }
    }, 350)

prismarine physics around line 200 fix for two block gap slab stepup
      var myIdeaArray = [];
      const oldVelXCol = dx
      const oldVelYCol = dy
      const oldVelZCol = dz
      const oldBBCol = playerBB.clone()

      dy = physics.stepHeight
      const queryBB = oldBB.clone().extend(oldVelX, dy, oldVelZ)
      const surroundingBBs = getSurroundingBBs(world, queryBB)

      let BB1 = oldBB.clone()
      let BB2 = oldBB.clone()
      let BB_XZ = BB1.clone().extend(dx, 0, dz)

      let dy1 = dy
      let dy2 = dy
      for (const blockBB of surroundingBBs) {
        dy1 = blockBB.computeOffsetY(BB_XZ, dy1)
        //dy2 = blockBB.computeOffsetY(BB2, dy2)
      }
      BB1.offset(0, dy1, 0)
      //BB2.offset(0, dy2, 0)

      let dx1 = oldVelX
      let dx2 = oldVelX
      for (const blockBB of surroundingBBs) {
        dx1 = blockBB.computeOffsetX(BB1, dx1)
        //dx2 = blockBB.computeOffsetX(BB2, dx2)
      }
      BB1.offset(dx1, 0, 0)
      //BB2.offset(dx2, 0, 0)

      let dz1 = oldVelZ
      let dz2 = oldVelZ
      for (const blockBB of surroundingBBs) {
        dz1 = blockBB.computeOffsetZ(BB1, dz1)
        //dz2 = blockBB.computeOffsetZ(BB2, dz2)
      }
      BB1.offset(0, 0, dz1)
      //BB2.offset(0, 0, dz2)
      for (var mydy2 = physics.stepHeight; mydy2 > 0; mydy2 -= (1/16)) {
          BB2 = oldBB.clone()
          //BB_XZ = BB1.clone().extend(dx, 0, dz)
          dx2 = oldVelX
          dy2 = mydy2;
          dz2 = oldVelZ
          for (const blockBB of surroundingBBs) {
              dy2 = blockBB.computeOffsetY(BB2, dy2)
          }
          BB2.offset(0, dy2, 0)

          for (const blockBB of surroundingBBs) {
              dx2 = blockBB.computeOffsetX(BB2, dx2)
          }
          BB2.offset(dx2, 0, 0)
          for (const blockBB of surroundingBBs) {
              dz2 = blockBB.computeOffsetZ(BB2, dz2)
          }
          BB2.offset(0, 0, dz2)
          myIdeaArray.push([dx2, dy2, dz2, BB2.clone()]);
      }
      var myBestDist = 0;
      for (var i = 0; i < myIdeaArray.length; i++) {
          if (Math.abs(myBestDist) < Math.abs(myIdeaArray[i][0] * myIdeaArray[i][0] + myIdeaArray[i][2] * myIdeaArray[i][2])) {
              myBestDist = myIdeaArray[i][0] * myIdeaArray[i][0] + myIdeaArray[i][2] * myIdeaArray[i][2];
              dx2 = myIdeaArray[i][0];
              dy2 = myIdeaArray[i][1];
              dz2 = myIdeaArray[i][2];
              BB2 = myIdeaArray[i][3];
          }
      }



add to prismarine-physics index.js to fix the bot falling through kelp
*/