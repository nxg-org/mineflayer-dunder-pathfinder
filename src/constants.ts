import { Item } from "prismarine-item";

export type FakeVec3 = [x: number, y: number, z: number];
export type XYZ = {x: number, y: number, z: number};

export function xyzxyzequal(a: XYZ, b: XYZ) {
    return a.x == b.x && a.y == b.y && a.z == b.z;
}

export function xyzfakev3equal(a: XYZ, b: FakeVec3) {
    return a.x == b[0] && a.y == b[1] && a.z == b[2];
}

export function xyzxyzdist3d(a: XYZ, b: XYZ) {
    return dist3d(a.x, a.y, a.z, b.x, b.y, b.z)
}

export function xyzv3dist3d(a: XYZ, x: number, y: number, z: number) {
    return dist3d(a.x, a.y, a.z, x, y, z);
}

export function dist3d(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number) {
    return Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1) + (z2 - z1) * (z2 - z1));
}

export class Node {
    constructor(
        public parent: Node | undefined,
        public fcost: number,
        public hcost: number,
        public x: number,
        public y: number,
        public z: number,
        public open: boolean,
        public move: MovementEnum,
        public brokenBlocks: FakeVec3[],
        public brokeBlocks: boolean,
        public placedBlocks: boolean
    ) {}
    get ccost(): number{
        return this.fcost + this.hcost;
    }
}

export const ToolPriority: { [itemType: string]: number } = {
    wooden: 0,
    stone: 1,
    gold: 2,
    iron: 3,
    diamond: 4,
    netherite: 5,
};

export const scaffoldBlocks = [
    "diorite",
    "granite",
    "andesite",
    "basalt",
    "netherrack",
    "dirt",
    "stone",
    "cobblestone",
    "warped_planks",
    "crimson_planks",
    "jungle_planks",
    "dark_oak_planks",
    "acacia_planks",
    "birch_planks",
    "spruce_planks",
    "oak_planks",
];

export function getToolPriority(name: string): number {
    return ToolPriority[name.split("_", 1)[0]] ?? -1;
}

type Reducing = [number, Item[]];
function getTool(bot: ReturnType<typeof import("mineflayer").createBot>, mineBlock: string): Item | null {
    const rightTool = toolsForMaterials[mineBlock] ?? toolsForMaterials.default;
    const items = bot.util.inv.getAllItems().filter((i) => i.name.includes(rightTool));
    const wanted = items.reduce(
        ([prio, arr]: Reducing, c) => {
            const currentPrio = getToolPriority(c.name);
            if (currentPrio > prio) return [currentPrio, [c]] as Reducing;
            if (currentPrio == prio) arr.push(c);
            return [prio, arr] as Reducing;
        },
        [-1, []] as Reducing
    )[1];
    return wanted.reduce(
        ([pEff, p]: [number, Item | null], c): [number, Item | null] => {
            let cEff = 0;
            for (const enchant of c.enchants) {
                if (enchant.name == "efficiency") {
                    cEff = enchant.lvl;
                    break;
                }
            }
            if (cEff > pEff) return [cEff, c];
            return [pEff, p];
        },
        [-1, null]
    )[1];
}
//what the fuck

//TODO: Perhaps convert to enum. Not sure, ask Rob.
export const toolsForMaterials: { [name: string]: string } = {
    rock: "_pickaxe",
    wood: "_axe",
    dirt: "_shovel",
    plant: "_hoe",
    web: "_sword",
    "mineable/pickaxe": "_pickaxe",
    default: "hand",
};

export enum MovementEnum {
    Init = -1,
    Cardinal,
    Diagonal,
    JumpCardinal,
    JumpDiagonal,
    SprintCardinal,
    SprintDiagonal,
    SprintJumpCardinal,
    SprintJumpDiagonal,
    SwimCardinal,
    SwimDiagonal,
    SprintSwimCardinal,
    SprintSwimDiagonal,
}

export const SwimmingMovements: MovementEnum[] = [-1, 8, 9, 10, 11, 12];
export const SlowerMovements: MovementEnum[] = [0, 1, 8, 9];
export const SprintMovements: MovementEnum[] = [4, 5, 6, 7, 11, 12];
