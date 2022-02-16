import { Bot } from "mineflayer";
import { Block } from "prismarine-block";
import { promisify } from "util";
import { Vec3 } from "vec3";
import { MovementData } from "../../movement/movementData";
import { Physics } from "../engines/physics";
import { PlayerState } from "../playerState";
import { fuk, NewJump } from "../tests/newNewJump";
import { NewSims } from "./nextSim";
import { SimulationData } from "./simulationsNew";

// We are going to store wanted movements by movement objects themselves, NOT just the inputs for them.
// Reasoning? Deep cloning is homo + I want to encapsulate all of the simulations since right now I'm breaking everything.
//

const sleep = promisify(setTimeout);
export class PathContext {
    public readonly physics: Physics;
    public readonly bot: Bot;
    // public readonly state: PlayerState
    public readonly movementData: MovementData;
    public moves: NewJump[];
    // public readonly sim: NewSims

    public pathing = false;

    constructor(bot: Bot, physics: Physics, startTick: number = 0) {
        this.bot = bot;
        this.physics = physics;
        this.movementData = MovementData.DEFAULT(startTick);
        this.moves = [];
    }

    public reset() {
        this.pathing = false;
        this.moves = [];
    }

    private findBlocks(source: Vec3, goal: Vec3): Vec3[] {
        const src = source.floored().offset(0, -1, 0);
        const blocks = this.bot
            .findBlocks({
                matching: (b: Block) => {
                    const ydist = b.position.minus(src).y;
                    const xzdist = b.position.xzDistanceTo(src);
                    return (
                        xzdist <= 8 &&
                        xzdist >= 2 &&
                        ydist <= 1 &&
                        // ydist > -8 &&
                        !b.name.includes("air") &&
                        goal.distanceTo(b.position) < goal.distanceTo(src)
                    );
                },
                // maxDistance: 10,
                useExtraInfo: true,
                count: 1000,
                point: source,
            })
            .filter((b) => this.bot.blockAt(b.offset(0, 1, 0))?.name === "air" && this.bot.blockAt(b.offset(0, 2, 0))?.name === "air")
            .sort((a, b) => a.distanceTo(goal) - b.distanceTo(goal)); //.slice(0, 10);

        return blocks;
    }

    async evaluate(shit: [goal: Vec3, jump: NewJump]): Promise<[jump: NewJump, data: fuk]> {
        return [shit[1], await shit[1].checkValidity(true)];
    }

    async noCalcPath(goal: Vec3) {
        if (this.pathing) return;
        this.pathing = true;

        const state = new PlayerState(this.physics, this.bot);
        const goalReached = NewSims.getReached(goal);

        //!goalReached(state) &&
        while (this.pathing) {
            const time = performance.now();
            const blocks = this.findBlocks(state.position, goal);
            const jumps = blocks.map((b) => [b, new NewJump(this.physics, state.clone(), b)] as [goal: Vec3, jump: NewJump]);
            let results = await Promise.all(jumps.map(this.evaluate));
            results = results
                .filter((sim) => sim[1].success)
                .sort((a, b) => a[0].closeToDest.distanceTo(goal) - b[0].closeToDest.distanceTo(goal));
            console.log("finished checking.", performance.now() - time, "ms.", results.length);

            if (results[0] && results[0][1].success) {
                console.log(results[0][1].type); //, results[0][1].data.movements)
                await results[0][0].commitJump(this.bot);
                state.update(this.bot);
            } else {
                this.bot.chat("Invalid result: " + results[0]?.toString());
                break;
            }
            await sleep(0);
        }
    }

    async findPath(goal: Vec3) {
        if (this.pathing) return [];
        this.pathing = true;
        // const pathGoal = ttarget.position.clone();

        const state = new PlayerState(this.physics, this.bot);
        const moves: [jump: NewJump, data: fuk][] = [];
        let tickCount = 0;

        const goalReached = NewSims.getReached(goal);
        while (!goalReached(state) && this.pathing) {
            const blocks = this.findBlocks(state.position, goal);

            const time = performance.now();
            const jumps: [goal: Vec3, jump: NewJump][] = blocks.map((b) => [b, new NewJump(this.physics, state.clone(), b)]);
            let results = await Promise.all(jumps.map(this.evaluate));
            results = results.filter((sim) => sim[1].success) as [
                jump: NewJump,
                data: { success: true; type?: string; data: SimulationData }
            ][];
            results = results.sort((a, b) => a[0].closeToDest.distanceTo(goal) - b[0].closeToDest.distanceTo(goal));

            console.log("finished checking.", performance.now() - time, "ms.", results.length);

            const res = results[0];
            if (!res) {
                this.bot.chat("couldn't find block.");
                break;
            }
            if (!res[1].success) {
                this.bot.chat("No valid jump to block.");
                break;
            }
            moves.push(res);
            state.merge(res[1].data.state);
            // await sleep(0)
        }

        return moves;
    }

    async doPath(goal: Vec3, ...moves: [jump: NewJump, data: fuk][]) {
        const res = (bot: Bot) => {
            const delta = bot.entity.position.minus(goal);
            return (
                Math.abs(delta.x) <= 0.35 &&
                Math.abs(delta.z) <= 0.35 &&
                Math.abs(delta.y) < 1 &&
                (bot.entity.onGround || (bot.entity as any).isInWater)
            );
        };
        while (!res(this.bot)) {
            const move = moves.shift();
            if (move && move[1].success) {
                console.log(move[1].type);
                await NewSims.applyToBot(this.bot, this.physics, move[1].data.movements);
                // await move[0].commitJump(this.bot);
                console.log("now outside: state:", move[0].sim.state.position, "bot:", this.bot.entity.position)
            } else {
                this.bot.chat("No more moves.");
                break;
            }
        }
        this.bot.chat(`should have made it: ${goal}`);
        this.pathing = false;
    }
}
