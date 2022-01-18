import { CostCalculator } from "./costCalculator";
import { MovementEnum, FakeVec3, dist3d, xyzxyzdist3d, xyzv3dist3d, xyzxyzequal, xyzv3equal } from "./constants";
import { Bot } from "mineflayer";
import { BotActions } from "./botActions";
import { Vec3 } from "vec3";
import { BlockInfo } from "./blockInfoNew";
// import { Block } from "prismarine-block";
import {Node} from "./classes/node"

export type Move = {
    x: number;
    y: number;
    z: number;
    move: MovementEnum;
};

export class Pathfinder {
    private nodes: Node[] = [];
    private destination: FakeVec3 = [0, 0, 0];
    private nodes3d: Node[][][] = [];
    private openNodes: Node[] = [];

    private bestNodeIndex: number = -1;

    private moves: Node[] = [];
    private lastPos: { x: number; y: number; z: number; move: number };

    private chunkColumnsLoaded: boolean[][] = [];

    private pathfinderTimer = 10;
    private botSearchingPath = 10;

    constructor(private bot: Bot, private botActions: BotActions, private blockInfo: BlockInfo) {
        this.lastPos = { move: 0, ...this.bot.entity.position.floored() };
    }

    //todo explain fcost and hcost
    addNode(
        parent: Node | undefined,
        gcost: number,
        hcost: number,
        x: number,
        y: number,
        z: number,
        moveType: MovementEnum,
        availableBlocks: number,
        brokenBlocks: FakeVec3[],
    ) {
        let parentFCost = parent ? gcost + parent.gcost : gcost;

        this.pushHeap(new Node(parent, gcost, hcost, x, y, z, true, moveType, availableBlocks, brokenBlocks));

        let a = this.nodes3d[y];
        if (!a) a = this.nodes3d[y] = [];
        let b = a[z];
        if (!b) b = this.nodes3d[z] = [];
        b[x] = this.nodes[this.nodes.length - 1];
    }

    pushHeap(node: Node) {
        this.nodes.push(node);
        this.openNodes.push(node);
        if (this.openNodes.length > 1) {
            let current = this.openNodes.length - 1;
            let parent = Math.floor((current - 1) / 2);
            let parent_obj = this.openNodes[parent];
            const node_ccost = node.fcost;
            while (current > 0 && parent_obj.fcost > node_ccost) {
                this.openNodes[current] = parent_obj;
                this.openNodes[parent] = node;
                current = parent;
                parent = Math.floor((current - 1) / 2);
                parent_obj = this.openNodes[parent];
            }

            // todo remove old code after confirming new one works
            /*
            let current = openNodes.length - 1;
            let parent = Math.floor((current - 1) / 2);
            while (current > 0 && openNodes[parent].fCost + openNodes[parent].hCost > openNodes[current].fCost + openNodes[current].hCost) {
                let storer = openNodes[current];
                openNodes[current] = openNodes[parent];
                openNodes[parent] = storer;
                //[openNodes[parent], openNodes[current]] = [openNodes[current], openNodes[parent]];
                //console.log("before: " + bestNodeIndex);
                //bestNodeIndex = parent;//This might cause issues if it is wrong
                //console.log("after: " + bestNodeIndex);
                current = parent;
                parent = Math.floor((current - 1) / 2);
            }
            */
        }
    }

    popHeap() {
        this.openNodes.splice(0, 1);
        if (this.openNodes.length > 1) {
            this.openNodes.unshift(this.openNodes[this.openNodes.length - 1]);
            this.openNodes.splice(this.openNodes.length - 1, 1);
        }
        if (this.openNodes.length > 0) {
            let current = 0;
            let childLeft = current * 2 + 1;
            let childRight = current * 2 + 2;
            while (true) {
                let currentScore = this.openNodes[current].fcost;
                let childLeftScore = Infinity;
                if (this.openNodes.length - 1 >= childLeft) {
                    childLeftScore = this.openNodes[childLeft].fcost;
                }
                let childRightScore = Infinity;
                if (this.openNodes.length - 1 >= childRight) {
                    childRightScore = this.openNodes[childRight].fcost;
                }
                if (childLeftScore >= currentScore && childRightScore >= currentScore) break;
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
            }
        }
    }

    private refreshLoadedChunkColumns() {
        this.chunkColumnsLoaded = [];
        let leColumns = this.bot.world.getColumns();
        for (const column of leColumns) {
            let a = this.chunkColumnsLoaded[column.chunkZ];
            if (!a) a = this.chunkColumnsLoaded[column.chunkZ] = [];
            a[column.chunkX] = true;
        }
    }
    private chunkAvailable(node: Node) {
        const z = Math.floor(node.z >> 4);
        const x = Math.floor(node.x >> 4);
        let a = this.chunkColumnsLoaded[z];
        return a && a[x];
    }

    findPath(endX: number, endZ: number, endY?: number, correction?: boolean, extension?: boolean) {
        if (this.moves.length == 0) {
            extension = false;
        }
        this.refreshLoadedChunkColumns();
        this.bot.clearControlStates();
        if (!extension) {
            this.lastPos = {
                move: 0,
                x: Math.floor(this.bot.entity.position.x),
                y: Math.floor(this.bot.entity.position.y),
                z: Math.floor(this.bot.entity.position.z),
            };
        }
        if (!correction && !extension) {
            this.nodes = [];
            this.nodes3d = [];
            this.openNodes = [];
            this.moves = [];
        } else if (correction) {
            this.nodes = [];
            this.nodes3d = [];
            this.openNodes = [];
            // find best move
            let bestOne: [index: number, distance: number] = [-1, Infinity];
            for (let i = 0; i < this.moves.length; i++) {
                const current = this.moves[i];
                const x = Math.round(this.bot.entity.position.x);
                const y = Math.floor(this.bot.entity.position.y);
                const z = Math.round(this.bot.entity.position.z);
                if (xyzv3dist3d(current, x, y - 1, z) < bestOne[1]) {
                    bestOne = [i, xyzv3dist3d(current, x, y, z)];
                }
            }
            if (bestOne[0] + 1 < this.moves.length) {
                this.moves.splice(bestOne[0] + 1, this.moves.length);
            }
            ({ x: endX, y: endY, z: endZ } = this.moves[bestOne[0]]);
            // console.log(this.moves[bestOne[0]]);
        } else if (extension) {
            this.nodes = [];
            this.openNodes = [];
            this.nodes3d = [];
            let bestOne = [0, Infinity];
            for (let i = 0; i < this.moves.length; i++) {
                const current = xyzv3dist3d(this.moves[i], endX, endY ?? this.moves[i].y, endZ);
                if (current < bestOne[1]) bestOne = [i, current];
            }
            bestOne[0] += 10;
            if (bestOne[0] > this.moves.length - 6) {
                bestOne[0] = this.moves.length - 6;
            }
            if (bestOne[0] >= 0) {
                this.lastPos.move -= bestOne[0] + 1;
                this.moves.splice(0, bestOne[0] + 1);
            }
            let foundPath = false;
            if (!extension || this.moves.length == 0) {
                this.addNode(
                    undefined,
                    0,
                    0,
                    Math.floor(this.bot.entity.position.x),
                    Math.floor(this.bot.entity.position.y),
                    Math.floor(this.bot.entity.position.z),
                    MovementEnum.Init,
                    [],
                    false,
                    false
                );
            } else if (this.moves.length > 0) {
                this.addNode(undefined, 0, 0, this.moves[0].x, this.moves[0].y, this.moves[0].z, MovementEnum.Init, [], false, false);
            }
            let attempts = 0;
            let maxAttempts = 0;
            let bestNode = this.nodes[0];
            let findingPath = setInterval(() => {
                this.bestNodeIndex = 0;
                this.botSearchingPath = 10;
                // if (!extension) {
                //     botDestinationTimer = 30;
                // }
                let performanceStop = process.hrtime();
                while (
                    // todo understand wtf is going here with the time or whatever
                    !foundPath &&
                    attempts < 7500 &&
                    (process.hrtime(performanceStop)[0] * 1000000000 + process.hrtime(performanceStop)[1]) / 1000000 < 40
                ) {
                    attempts++;
                    this.bestNodeIndex = 0;
                    bestNode = this.openNodes[0];
                    this.popHeap();
                    let bestNodeWasOpen = bestNode.open;
                    bestNode.open = false;
                    const chunkAvailable = this.chunkAvailable(bestNode);
                    if (
                        (bestNode.x == endX && bestNode.y == endY && bestNode.z == endZ) ||
                        (endY === undefined && bestNode.x == endX && bestNode.z == endZ) ||
                        !chunkAvailable
                    ) {
                        this.pathfinderTimer = 0;
                        foundPath = true;
                        // console.log(`Found path in ${attempts} attempts.`);
                        let atHome = false;
                        let steps = 0;
                        let firstMoveIndex = this.moves.length - 1;
                        let extender = [];
                        // /*steps < 1000 && */ why was that here
                        while (!atHome || bestNode.parent != undefined) {
                            if (!extension) {
                                this.moves.push(bestNode);
                            } else {
                                extender.push(bestNode);
                            }
                            if (correction) {
                                // todo: fix
                                // faulty code, gonna have to be commented for now
                                // wasn't working in the original either
                                // for (let i = 0; i < firstMoveIndex; i++) {
                                // if (this.moves[i] == bestNode)
                                // }
                            } else if (extension) {
                                for (let i = 0; i < this.moves.length; i++) {
                                    if (xyzxyzequal(this.moves[i], extender[extender.length - 1])) {
                                        extender.splice(extender.length - 1, 1);
                                        i = this.moves.length;
                                    }
                                }
                            }
                            // console.log(`{x: ${bestNode.x}, y: ${bestNode.y}, z: ${bestNode.z}}`);
                            bestNode = bestNode.parent!;
                            steps++;
                        }
                        if (extension) {
                            this.lastPos.move += extender.length;
                            this.moves = extender.concat(this.moves);
                        }
                        // this.bot.chat(`I can be there in ${steps} steps.`);
                    } else if (bestNodeWasOpen) {
                        this.bot.chat(`/particle flame ${bestNode.x} ${bestNode.y} ${bestNode.z}`);
                        if (chunkAvailable) {
                            //walking
                            this.validNode(bestNode, bestNode.x - 1, bestNode.y, bestNode.z, endX, endY!, endZ);
                            this.validNode(bestNode, bestNode.x + 1, bestNode.y, bestNode.z, endX, endY!, endZ);
                            this.validNode(bestNode, bestNode.x, bestNode.y, bestNode.z - 1, endX, endY!, endZ);
                            this.validNode(bestNode, bestNode.x, bestNode.y, bestNode.z + 1, endX, endY!, endZ);
                            //walking(diagnol)
                            this.validNode(bestNode, bestNode.x - 1, bestNode.y, bestNode.z - 1, endX, endY!, endZ);
                            this.validNode(bestNode, bestNode.x + 1, bestNode.y, bestNode.z - 1, endX, endY!, endZ);
                            this.validNode(bestNode, bestNode.x - 1, bestNode.y, bestNode.z + 1, endX, endY!, endZ);
                            this.validNode(bestNode, bestNode.x + 1, bestNode.y, bestNode.z + 1, endX, endY!, endZ);

                            //Falling
                            this.validNode(bestNode, bestNode.x, bestNode.y - 1, bestNode.z, endX, endY!, endZ);
                            //Jumping
                            this.validNode(bestNode, bestNode.x, bestNode.y + 1, bestNode.z, endX, endY!, endZ);
                        }
                    }
                }
            });
        }
    }

    validNode(
        node: Node,
        x: number,
        y: number,
        z: number,
        endX: number,
        endY: number,
        endZ: number | undefined
        // type?: undefined
    ) {
        let waterSwimCost = 4;
        let placeBlockCost = 10;
        let breakBlockCost = 0;
        let breakBlockCost2 = 10;
        if (this.pathfinderTimer > 20 * 4) {
            breakBlockCost2 = 2;
        } else if (this.pathfinderTimer > 20 * 2) {
            breakBlockCost2 = 5;
        }
        if (y <= 60) {
            // tweaking...
        } else if (y >= 90) {
            placeBlockCost = 3;
        }
        let ownerNodeUndefined = false;
        let fcost = 0;
        let legalMove = false;
        let ughType = 0;
        let brokenBlocks = [];
        let brokeBlocks = false;
        let placedBlocks = false;
        let move;
        let exploreCount, pastConforms, myExplorer;

        if (Math.abs(node.x - x) == 1 && Math.abs(node.z - z) == 1 && node.y == y) {
            // DIAGONAL WALK
            move = MovementEnum.Diagonal;
            ughType = 1;
            fcost = 14;
            if (
                (this.blockInfo.canWalkOnBlock(node.x, y, z) && this.blockInfo.isAir(node.x, y + 1, z)) ||
                (this.blockInfo.canWalkOnBlock(x, y, node.z) &&
                    this.blockInfo.isAir(x, y + 1, node.z) &&
                    this.blockInfo.canWalkOnBlock(x, y, z) &&
                    this.blockInfo.isAir(x, y + 1, z) &&
                    this.blockInfo.canStandOnBlock(x, y - 1, z, node))
            ) {
                legalMove = true;
            }
            if (
                (legalMove && this.blockInfo.isCobweb(node.x, y, z)) ||
                this.blockInfo.isCobweb(node.x, y + 1, z) ||
                this.blockInfo.isCobweb(x, y, node.z) ||
                this.blockInfo.isCobweb(x, y + 1, node.z)
            ) {
                fcost += 45;
                //console.log("Semi-Blocked move: " + x + ", " + y + ", " + z);
            }
            // todo go on
        }
    }
}
