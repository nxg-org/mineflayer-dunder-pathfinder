import { CostCalculator } from "./costCalculator";
import { MovementEnum, Node, FakeVec3 } from "./constants";
import { Bot } from "mineflayer";
import { BotActions } from "./botActions";
// import { Block } from "prismarine-block";

export class Pathfinder {
    private nodes: Node[] = [];
    private destination: FakeVec3 = [0, 0, 0];
    private nodes3d: Node[][][] = [];
    private openNodes: Node[] = [];

    constructor(private bot: Bot, private botActions: BotActions) {}

    //todo explain fcost and hcost
    addNode(
        parent: Node | undefined,
        fcost: number,
        hcost: number,
        x: number,
        y: number,
        z: number,
        moveType: MovementEnum,
        brokenBlocks: FakeVec3[],
        brokeBlocks: boolean,
        placedBlocks: boolean
    ) {
        let parentFCost = parent ? fcost + parent.fcost : fcost;

        this.pushHeap(new Node(parent, fcost, hcost, x, y, z, true, moveType, brokenBlocks, brokeBlocks, placedBlocks));

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
            const node_ccost = node.ccost;
            while (current > 0 && parent_obj.ccost > node_ccost) {
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
                let currentScore = this.openNodes[current].ccost;
                let childLeftScore = Infinity;
                if (this.openNodes.length - 1 >= childLeft) {
                    childLeftScore = this.openNodes[childLeft].ccost;
                }
                let childRightScore = Infinity;
                if (this.openNodes.length - 1 >= childRight) {
                    childRightScore = this.openNodes[childRight].ccost;
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
}
