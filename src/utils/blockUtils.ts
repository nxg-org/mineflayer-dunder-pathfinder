import { AABB, AABBUtils } from "@nxg-org/mineflayer-util-plugin";
import { FindBlockOptions } from "mineflayer";
import { Block } from "prismarine-block";
import { Vec3 } from "vec3";


export function getAllBlocksAlongParabolicTrajectory(pos: Vec3, dir: Vec3, strength: number) {
    const playerAABB = new AABB(pos.x - 0.3, pos.y, pos.z - 0.3, pos.x + 0.3, pos.y + 1.8, pos.z + 0.3);
}

export function calculateBlockCenter(world: any, pos: {x: number, y: number, z: number}): Vec3 {
    const b: Block = world.getBlock(pos);
    const bbox = b.shapes[0]
    if (bbox.length === 0) {
        return new Vec3(pos.x + 0.5, pos.y, pos.z + 0.5);
    }
    let yDiff = (bbox[1] + bbox[4]) / 2;
    const xDiff = (bbox[0] + bbox[3]) / 2;
    const zDiff = (bbox[2] + bbox[5]) / 2;
    // if (b.getBlock() instanceof BlockFire) {//look at bottom of fire when putting it out
    //     yDiff = 0;
    // }
    if (b.name.includes("fire")) {
        yDiff = 0;
    }
    return new Vec3(
            pos.x + xDiff,
            pos.y + yDiff,
            pos.z + zDiff
    );
}

export function fasterGetBlocks(options: FindBlockOptions) {
    
}