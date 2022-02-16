import { Bot } from "mineflayer";
import { Block } from "prismarine-block";
import { Vec3 } from "vec3";
import { RaycastIterator } from "./Raycast";

type Iteration = { x: number; y: number; z: number; face: number };
type BlockAndIterations = { block: Block | null; iterations: Iteration[] };


export class InterceptFunctions {
    constructor(private bot: Bot) {}

    //Old ver grabs range between the two + direction from... from to... to.
    //calls raycast.
    check(from: Vec3, to: Vec3): BlockAndIterations {
        //old code:
        const range = from.distanceTo(to);
        const direction = to.minus(from).normalize();
        if (isNaN(range)) return { block: null, iterations: [] };
        return this.raycast(from, direction, range);
    }
    raycast(from: Vec3, direction: Vec3, range: number): BlockAndIterations {
        const iterations: Iteration[] = [];
        const iter = new RaycastIterator(from, direction, range);
        let pos = iter.next();
        while (pos) {
            iterations.push(pos);
            const position = new Vec3(pos.x, pos.y, pos.z);
            const block = this.bot.blockAt(position);
            if (block) {
                const intersect = iter.intersect(block.shapes as any, position);
                if (intersect) {
                    return {
                        block,
                        iterations,
                    };
                }
            }
            pos = iter.next();
            if (range > 20 || (iterations.length >= 1000 && iterations.length % 1000 === 0)) {
                // console.trace("too much");
                console.log(from, direction, range, iterations, block, position, pos);
            }
            // console.log(range, iterations.length);
        }

        return {
            block: null,
            iterations,
        };
    }
}
