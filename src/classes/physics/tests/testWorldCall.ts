import { Vec3 } from "vec3";
import register from "prismarine-registry"
import { fasterGetBlocks, getMatchingFunction, isBlockInSection } from "../../../utils/blockUtils";
import { Block } from "prismarine-block";
import { createBot } from "mineflayer";
const data = register("1.17.1");


const bot = createBot({
    username: "physics_test",
    host: "localhost",
    version: "1.17.1",
});


bot.once("spawn", () => {
    testTimes();
})

bot.on("chat", (username, message) => {
    const msg = message.split(' ')
    switch (msg[0]) {
        case "test":
            testTimes();
            break
    }
})

function testTimes() {
    console.time("normal findblock");
    const blocks = findBlocks(bot.entity.position, bot.entity.position.offset(1, 0, 1))
    console.timeEnd("normal findblock")
    console.time("faster findblocks")
    const blocks1 = findBlocksNew(bot.entity.position, bot.entity.position.offset(1, 0, 1))
    console.timeEnd("faster findblocks")
}


function customImplFindBlocks(source: Vec3, goal: Vec3) {
    const src = source.floored().translate(0, -1, 0);
    const options = {
        matching: data.blocksByName.air.id, 
        maxDistance: 100,
        point: src,
        count: 100000,
        exclude: true,
    }
    const matcher = getMatchingFunction(options.matching, options.exclude);
    const cursor = new Vec3(0, 0, 0);
    const visitedSections = new Set();
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

}

function findBlocksNew(source: Vec3, goal: Vec3) {
    const src = source.floored().offset(0, -1, 0);
    let blocks = fasterGetBlocks(bot, data.blocksByName.air.id, {
        maxDistance: 100,
        point: src,
        count: 100000,
        exclude: true,
    });

    // const blockSet = new Set(blocks.map((b) => b.toString()));

    // blocks = blocks.filter((b) => !blockSet.has(b.offset(0, 1, 0).toString()) && !blockSet.has(b.offset(0, 2, 0).toString()));
    // blocks = blocks.filter((b) => b.xzDistanceTo(src) <= 16 && b.y - src.y <= 1);
    // blocks = blocks.sort((a, b) => a.distanceTo(goal) - b.distanceTo(goal));
    return blocks;
}

function findBlocks(source: Vec3, goal: Vec3): Vec3[] {
    const src = source.floored().offset(0, -1, 0);
    let blocks = bot.findBlocks({
        matching: (b: Block) => b.type != data.blocksByName.air.id,
        maxDistance: 100,
        count: 100000,
        point: src,
    });

    // const blockSet = new Set(blocks.map((b) => b.toString()));
    // blocks = blocks.filter((b) => !blockSet.has(b.offset(0, 1, 0).toString()) && !blockSet.has(b.offset(0, 2, 0).toString()));
    // blocks = blocks.filter((b) => b.xzDistanceTo(src) <= 16 && b.y - src.y <= 1);
    // if (blocks.length === 0) {
    //     blocks = bot.findBlocks({
    //         matching: (b: Block) => b.type != data.blocksByName.air.id,
    //         maxDistance: 16,
    //         count: 1000,
    //         point: goal,
    //     });
    // }
    // const blockSet1 = new Set(blocks.map((b) => b.toString()));
    // blocks = blocks.filter((b) => !blockSet1.has(b.offset(0, 1, 0).toString()) && !blockSet1.has(b.offset(0, 2, 0).toString()));
    // blocks = blocks.filter((b) => b.xzDistanceTo(src) <= 16 && b.y - src.y <= 1);
    // blocks = blocks.sort((a, b) => a.distanceTo(goal) - b.distanceTo(goal));
    return blocks;
}
