import { Item } from "prismarine-item";

export type FakeVec3 = [x: number, y: number, z: number];
export type XYZ = { x: number; y: number; z: number };
export const MAX_COST = 1000000;

export const ToolPriority: { [itemType: string]: number } = {
    wooden: 0,
    stone: 1,
    gold: 2,
    iron: 3,
    diamond: 4,
    netherite: 5,
};

export const scaffoldBlocks =
[
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
]
export const scaffoldBlocksAsSet = new Set<String>();
scaffoldBlocks.forEach(name => scaffoldBlocksAsSet.add(name));

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

export const MovementConst: { [moveType: string]: number } = {
    Init: -1,
    Cardinal: 0,
    Diagonal: 1,
    JumpCardinal: 2,
    JumpDiagonal: 3,
    SprintCardinal: 4,
    SprintDiagonal: 5,
    SprintJumpCardinal: 6,
    SprintJumpDiagonal: 7,
    SwimCardinal: 8,
    SwimDiagonal: 9,
    SprintSwimCardinal: 10,
    SprintSwimDiagonal: 11,
} as const;

export interface SimulationControl {
    forward: boolean;
    back: boolean;
    left: boolean;
    right: boolean;
    jump: boolean;
    sneak: boolean;
    sprint: boolean;
}

export const SwimmingMovements: Set<MovementEnum> = new Set([-1, 8, 9, 10, 11, 12]);
export const SlowerMovements: Set<MovementEnum> = new Set([0, 1, 8, 9]);
export const SprintMovements: Set<MovementEnum> = new Set([4, 5, 6, 7, 11, 12]);
export const JumpMovements: Set<MovementEnum> = new Set([2, 3, 6, 7]);

export type Direction = { x: number; y: number; z: number };

export const allDirections: { [dir: string]: Direction } = {
    u: { x: 0, y: 1, z: 0 },
    d: { x: 0, y: -1, z: 0 },
    n: { x: 0, y: 0, z: -1 }, // North
    s: { x: 0, y: 0, z: 1 }, // South
    w: { x: -1, y: 0, z: 0 }, // West
    e: { x: 1, y: 0, z: 0 }, // East
    nu: { x: 0, y: 1, z: -1 }, // North-Up
    su: { x: 0, y: 1, z: 1 }, // South-Up
    wu: { x: -1, y: 1, z: 0 }, // West-Up
    eu: { x: 1, y: 1, z: 0 }, // East-Up
    nd: { x: 0, y: -1, z: -1 }, // North-Down
    sd: { x: 0, y: -1, z: 1 }, // South-Down
    wd: { x: -1, y: -1, z: 0 }, // West-Down
    ed: { x: 1, y: -1, z: 0 }, // East-Down
    nw: { x: -1, y: 0, z: -1 },
    sw: { x: -1, y: 0, z: 1 },
    ne: { x: 1, y: 0, z: -1 },
    se: { x: 1, y: 0, z: 1 },
    nwu: { x: -1, y: 1, z: -1 },
    swu: { x: -1, y: 1, z: 1 },
    neu: { x: 1, y: 1, z: -1 },
    seu: { x: 1, y: 1, z: 1 },
    nwd: { x: -1, y: -1, z: -1 },
    swd: { x: -1, y: -1, z: 1 },
    ned: { x: 1, y: -1, z: -1 },
    sed: { x: 1, y: -1, z: 1 },
};
