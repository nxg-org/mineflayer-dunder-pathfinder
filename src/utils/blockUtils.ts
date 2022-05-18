import { AABB, AABBUtils } from "@nxg-org/mineflayer-util-plugin";
import { Bot, FindBlockOptions } from "mineflayer";
import BrokenImport, { loader, Block } from "prismarine-block";
import { Vec3 } from "vec3";
import { iterators } from "prismarine-world";
const {OctahedronIterator} = iterators


const IBlock: typeof Block = (BrokenImport as any)("1.17.1")

export function getAllBlocksAlongParabolicTrajectory(pos: Vec3, dir: Vec3, strength: number) {
    const playerAABB = new AABB(pos.x - 0.3, pos.y, pos.z - 0.3, pos.x + 0.3, pos.y + 1.8, pos.z + 0.3);
}

export function calculateBlockCenter(world: any, pos: { x: number; y: number; z: number }): Vec3 {
    const b: Block = world.getBlock(pos);
    const bbox = b.shapes[0];
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
    return new Vec3(pos.x + xDiff, pos.y + yDiff, pos.z + zDiff);
}

export function getMatchingFunction(matching: FindBlockOptions["matching"], exclude: boolean) {
    if (typeof matching !== "function") {
        if (!Array.isArray(matching)) {
            matching = [matching];
        }
        return isMatchingType;
    }
    return matching;

    function isMatchingType(block: Block | null) {
        return block === null ? false : exclude ? (matching as number[]).indexOf(block.type) === -1 : (matching as number[]).indexOf(block.type) >= 0
    }
}

export function isBlockInSection (section: { palette: any; }, matcher: (arg0: Block) => any) {
    if (!section) return false // section is empty, skip it (yay!)
    // If the chunk use a palette we can speed up the search by first
    // checking the palette which usually contains less than 20 ids
    // vs checking the 4096 block of the section. If we don't have a
    // match in the palette, we can skip this section.
    if (section.palette) {
      for (const stateId of section.palette) {
        if (matcher(IBlock.fromStateId(stateId, 0))) {
          return true // the block is in the palette
        }
      }
      return false // skip
    }
    return true // global palette, the block might be in there
  }

export function fasterGetBlocks(
    bot: Bot,
    matching: number | number[] | ((block: Block) => boolean),
    { maxDistance, point, count, exclude }: { maxDistance: number; point: Vec3; count?: number; exclude?: boolean } = {
        maxDistance: 16,
        point: bot.entity.position,
        count: 1,
        exclude: false,
    }
) {
    count ||= 1;
    exclude ||= false;
    const matcher = getMatchingFunction(matching, exclude);
    const start = new Vec3(Math.floor(point.x / 16), Math.floor(point.y / 16), Math.floor(point.z / 16));
    const it = new OctahedronIterator(start, Math.ceil((maxDistance + 8) / 16));
    // the octahedron iterator can sometime go through the same section again
    // we use a set to keep track of visited sections
    const visitedSections = new Set();

    let blocks = [];
    let startedLayer = 0;
    let next: Vec3 | null = start

     while (next) {
        const column = bot.world.getColumn(next.x, next.z);
        const sectionY = next.y + Math.abs((bot.game as any).minY >> 4);
        const totalSections = (bot.game as any).height >> 4;
        if (sectionY >= 0 && sectionY < totalSections && column && !visitedSections.has(next.toString())) {
            const section = column.sections[sectionY];
            if (isBlockInSection(section, matcher)) {
                const begin = new Vec3(next.x * 16, sectionY * 16 + (bot.game as any).minY, next.z * 16);
                const cursor = begin.clone();
                const end = cursor.offset(16, 16, 16);
                for (cursor.x = begin.x; cursor.x < end.x; cursor.x++) {
                    for (cursor.y = begin.y; cursor.y < end.y; cursor.y++) {
                        for (cursor.z = begin.z; cursor.z < end.z; cursor.z++) {
                            if (matcher(IBlock.fromStateId(bot.world.getBlockStateId(cursor), 0)) && cursor.distanceTo(point) <= maxDistance) blocks.push(cursor.clone());
                            // if (fullMatcher(cursor) && cursor.distanceTo(point) <= maxDistance) blocks.push(cursor.clone());
                        }
                    }
                }
            }
            visitedSections.add(next.toString());
        }
        // If we started a layer, we have to finish it otherwise we might miss closer blocks
        if (startedLayer !== it.apothem && blocks.length >= count) {
            break;
        }
        startedLayer = it.apothem;
        next = it.next();
    }
    blocks.sort((a, b) => {
        return a.distanceTo(point) - b.distanceTo(point);
    });
    // We found more blocks than needed, shorten the array to not confuse people
    if (blocks.length > count) {
        blocks = blocks.slice(0, count);
    }
    return blocks;
}
