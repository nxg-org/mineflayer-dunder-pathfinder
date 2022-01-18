import { Item } from "prismarine-item";

export type FakeVec3 = [x: number, y: number, z: number];
export type XYZ = {x: number, y: number, z: number};
export const xyzxyzequal = (a: XYZ, b: XYZ) => a.x == b.x && a.y == b.y && a.z == b.z;
export const xyzv3equal = (a: XYZ, b: FakeVec3) => a.x == b[0] && a.y == b[1] && a.z == b[2];
export const xyzxyzdist3d = (a: XYZ, b: XYZ) => dist3d(a.x, a.y, a.z, b.x, b.y, b.z);
export const xyzv3dist3d = (a: XYZ, x: number, y: number, z: number) => dist3d(a.x, a.y, a.z, x, y, z);
export function dist3d(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number) {
    return Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1) + (z2 - z1) * (z2 - z1));
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


export type Direction = {x: number, z: number};

export const allDirections: {[dir: string]: Direction} = {
    n: { x: 0, z: -1 }, // North
    s: { x: 0, z: 1 }, // South
    w: { x: -1, z: 0 }, // West
    e: { x: 1, z: 0 }, // East
    nw: { x: -1, z: -1 },
    sw: { x: -1, z: 1 },
    ne: { x: 1, z: -1 },
    se: { x: 1, z: 1 },
};