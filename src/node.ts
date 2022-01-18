import { FakeVec3, MovementEnum } from "./constants";

export class Node {
    constructor(
        public parent: Node | undefined,
        public gcost: number, //distance from start
        public hcost: number, //distance from target/goal
        public x: number,
        public y: number,
        public z: number,
        public open: boolean,
        public move: MovementEnum,
        public availableBlocks: number,
        public brokenBlocks: FakeVec3[],
    ) {}
    
    get fcost(): number{
        return this.gcost + this.hcost;
    }
}
