import { Bot } from "mineflayer";
import { Block } from "prismarine-block";
import { promisify } from "util";
import { Vec3 } from "vec3";
import { MovementData } from "../../movement/movementData";
import { Physics } from "../../physics/engines/physics";
import { PlayerState } from "../../physics/states/playerState";
import { JumpData, NewJump, SuccessfulJumpData } from "../../physics/tests/jumpMovement";
import { NewSims } from "../../physics/sims/nextSim";
import { SimulationData } from "../../physics/sims/nextSim";
import { fasterGetBlocks } from "../../../utils/blockUtils";

const sleep = promisify(setTimeout);

// We are going to store wanted movements by movement objects themselves, NOT just the inputs for them.
// Reasoning? Deep cloning is homo + I want to encapsulate all of the simulations since right now I'm breaking everything.
export class PathContext {
    public readonly physics: Physics;
    public readonly bot: Bot;
    public readonly movementData: MovementData;
    public moves: NewJump[];

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

    // private findBlocks(source: Vec3, goal: Vec3) {
    //     const src = source.floored().offset(0, -1, 0);
    //     let blocks = fasterGetBlocks(this.bot, this.physics.data.blocksByName.air.id, {
    //         maxDistance: 16,
    //         point: src,
    //         count: 1000,
    //         exclude: true,
    //     });

    //     const blockSet = new Set(blocks.map((b) => b.toString()));

    //     blocks = blocks.filter((b) => !blockSet.has(b.offset(0, 1, 0).toString()) && !blockSet.has(b.offset(0, 2, 0).toString()));
    //     blocks = blocks.filter((b) => b.xzDistanceTo(src) <= 16 && b.y - src.y <= 1);
    //     blocks = blocks.sort((a, b) => a.distanceTo(goal) - b.distanceTo(goal));
    //     return blocks;
    // }

    private findBlocks(source: Vec3, goal: Vec3): Vec3[] {
        const src = source.floored().offset(0, -1, 0);
        let blocks = this.bot
            .findBlocks({
                matching: (b: Block) => b.type != this.physics.data.blocksByName.air.id,
                maxDistance: 16,
                count: 1000,
                point: source,
            });

        const blockSet = new Set(blocks.map((b) => b.toString()));
        blocks = blocks.filter((b) => !blockSet.has(b.offset(0, 1, 0).toString()) && !blockSet.has(b.offset(0, 2, 0).toString()));
        blocks = blocks.filter((b) => b.xzDistanceTo(src) <= 16 && b.y - src.y <= 1);
        if (blocks.length === 0) {
            blocks = this.bot
            .findBlocks({
                matching: (b: Block) => b.type != this.physics.data.blocksByName.air.id,
                maxDistance: 16,
                count: 1000,
                point: goal,
            });
        }
        const blockSet1 = new Set(blocks.map((b) => b.toString()));
        blocks = blocks.filter((b) => !blockSet1.has(b.offset(0, 1, 0).toString()) && !blockSet1.has(b.offset(0, 2, 0).toString()));
        blocks = blocks.filter((b) => b.xzDistanceTo(src) <= 16 && b.y - src.y <= 1);
        blocks = blocks.sort((a, b) => a.distanceTo(goal) - b.distanceTo(goal));
        return blocks;
    }

    async evaluate(shit: [goal: Vec3, jump: NewJump]): Promise<[jump: NewJump, data: JumpData]> {
        return [shit[1], await shit[1].checkValidity(true)];
    }

    async noCalcPath(goal: Vec3) {
        if (this.pathing) return;
        this.pathing = true;

        const state = new PlayerState(this.physics, this.bot);
        const goalReached = NewSims.getReached(goal);

        while (!goalReached(state) && this.pathing) {
            const time = performance.now();
            const blocks = this.findBlocks(state.position, goal);
            const jumps = blocks.map((b) => [b, new NewJump(this.physics, state.clone(), b)] as [goal: Vec3, jump: NewJump]);
            const res = await Promise.all(jumps.map(this.evaluate));
            let results = res.filter((sim) => sim[1].success) as [jump: NewJump, data: SuccessfulJumpData][];

            //(NewJump.maxJumpTicks / a[1].data.movements.length()) *
            //(NewJump.maxJumpTicks / b[1].data.movements.length()) *
            results = results.sort((a, b) => {
                const atmp = a[0].closeToDest.distanceTo(goal);
                const btmp = b[0].closeToDest.distanceTo(goal);
                return atmp - btmp;
            });

            const final = results[0];
            console.log("finished checking.", performance.now() - time, "ms.", results.length);
            if (final && final[1].success) {
                console.log(final[1].type); //, results[0][1].data.movements)
                await final[0].commitJump(this.bot);
                // state.update(this.bot);
            } else {
                this.bot.chat("Invalid result: " + final[0]?.closeToDest.toString());
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
        const moves: [jump: NewJump, data: JumpData][] = [];

        const goalReached = (state: PlayerState) => {
            const delta = state.position.minus(goal);
            return Math.abs(delta.x) <= 0.35 && Math.abs(delta.z) <= 0.35 && Math.abs(delta.y) < 1;
        };

        // const goalReached = NewSims.getReached(goal);
        while (!goalReached(state) && this.pathing) {
            const blocks = this.findBlocks(state.position, goal);

            const time = performance.now();
            const jumps: [goal: Vec3, jump: NewJump][] = blocks.map((b) => [b, new NewJump(this.physics, state.clone(), b)]);
            const res = await Promise.all(jumps.map(this.evaluate));

            let results = res.filter((sim) => sim[1].success) as [jump: NewJump, data: SuccessfulJumpData][];
            //(NewJump.maxJumpTicks / a[1].data.movements.length()) *
            //(NewJump.maxJumpTicks / b[1].data.movements.length()) *
            results = results.sort((a, b) => {
                const atmp = a[0].closeToDest.distanceTo(goal);
                const btmp = b[0].closeToDest.distanceTo(goal);
                return atmp - btmp;
            });

            console.log("finished checking.", performance.now() - time, "ms.", results.length);

            const final = results[0];
            if (!final) {
                this.bot.chat("couldn't find block.");
                break;
            }
            if (!final[1].success) {
                this.bot.chat("No valid jump to block.");
                break;
            }
            console.log("wanted jump:", final[0].goalBlock, "from:", final[0].closeToSrc);
            moves.push(final);
            state.merge(final[1].data.state);
            await sleep(0);
        }

        return moves;
    }

    async doPath(goal: Vec3, ...moves: [jump: NewJump, data: JumpData][]) {
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
                console.log("now outside: state:", move[0].sim.state.position, "bot:", this.bot.entity.position);
            } else {
                this.bot.chat("No more moves.");
                break;
            }
        }
        this.bot.chat(`should have made it: ${goal}`);
        this.pathing = false;
    }
}
