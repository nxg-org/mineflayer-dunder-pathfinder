import { Bot } from "mineflayer";
import { Vec3 } from "vec3";
import { BlockInfo } from "./blockInfoNew";
import { Direction, MovementEnum, SwimmingMovements, XYZ } from "./constants";
import { Node } from "./node";
import { Movement } from "./movement";

export interface MovementCostOptions {
    placeCost: number;
    breakCost: number;
    movementCost: number;
}

export class MovementInfo {
    constructor(
        private bot: Bot,
        private blockInfo: BlockInfo,
        public options: MovementCostOptions = { placeCost: 1, breakCost: 1, movementCost: 1 } //TODO: Calculate movement cost based on ticks required to move. Same with digging.
    ) {} 

    getBlock(node: Node, x: number, y: number, z: number) {
        return this.bot.blockAt(new Vec3(node.x + x, node.y + y, node.z + z));
    }

    //Similar logic to
    getMove(wanted: MovementEnum, node: Node, dir: Direction, movementsStore: Movement[]) {
        let cost = 0;
        const breakPlanned: { x: number; y: number; z: number }[] = [];
        const placePlanned: { x: number; y: number; z: number }[] = [];
        switch (wanted) {
            case MovementEnum.Cardinal:
            case MovementEnum.SprintCardinal:
                const cardA = this.getBlock(node, dir.x, 0, dir.z);
                if (cardA && this.blockInfo.canWalkOnBlock(cardA)) {
                    if (node.availableBlocks === 0) return;
                }
        }
    }
}
