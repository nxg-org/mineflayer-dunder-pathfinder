import { AABB } from "@nxg-org/mineflayer-util-plugin";
import { Bot } from "mineflayer";
import { Block } from "prismarine-block";
import { Vec3 } from "vec3";
import { MovementData } from "../../movement/movementData";
import { ControlStateHandler, PlayerControls } from "../../player/playerControls";
import { Physics } from "../physics";
import { getBetweenRectangle } from "../physicsUtils";
import { PlayerState } from "../playerState";
import { Simulations } from "../simulations";
import { NewSimulations } from "../simulationsNew";



export class JumpMovement {
    private bot: Bot;
    private readonly simulator: Simulations;

    public readonly state: PlayerState;
    public readonly goalBlock:Vec3;
    public readonly srcAABBs: AABB[];
    public readonly closeToSrc: Vec3;
    public readonly closeToDest: Vec3;

    constructor(physics: Physics, simulator: Simulations, bot: Bot, goalBlock: Vec3, state?: PlayerState) {
        this.bot = bot;
        this.simulator = simulator
        this.state = state ?? new PlayerState(physics, bot, ControlStateHandler.COPY_BOT(bot));
        this.goalBlock = goalBlock;
        this.srcAABBs = this.state.getUnderlyingBlockAABBs();
        const dest = AABB.fromBlock(this.goalBlock);

        //might as well calculate backup position since calc for ideal jump target requires this knowledge anyway.
        // actually, this is a lie. Could get points. Let's try that out.
        // update, not bothering.

        const destPoints = dest.toArray();
        [this.closeToSrc, this.closeToDest] = this.srcAABBs
            .map((aabb) => {
                const destTmp = [0, 0, 0];
                const srcTmp = [0, 0, 0];
                const betweenPoints = getBetweenRectangle(aabb, dest).toArray();
                for (let i = 0; i < 3; i++) {
                    if (
                        betweenPoints[i] == destPoints[i] &&
                        (betweenPoints[i + 3] == destPoints[i] || betweenPoints[i + 3] == destPoints[i + 3])
                    ) {
                        srcTmp[i] = (betweenPoints[i] + betweenPoints[i + 3]) / 2;
                        destTmp[i] = (betweenPoints[i] + betweenPoints[i + 3]) / 2;
                    } else if (betweenPoints[i] == destPoints[i] || betweenPoints[i + 3] == destPoints[i]) {
                        srcTmp[i] = betweenPoints[i];
                        destTmp[i] = betweenPoints[i + 3];
                    } else {
                        srcTmp[i] = betweenPoints[i + 3];
                        destTmp[i] = betweenPoints[i];
                    }
                }

                const closeToDest = new Vec3(destTmp[0], destTmp[1], destTmp[2]);
                const closeToSrc = new Vec3(srcTmp[0], srcTmp[1], srcTmp[2]);
                let tryIt;
                if (destTmp[0] == srcTmp[0] && destTmp[1] == srcTmp[1] && destTmp[2] == srcTmp[2]) {
                    tryIt = closeToDest.offset(0, 1, 0);
                } else {
                    const dir = closeToDest.minus(closeToSrc).normalize();
                    tryIt = aabb.intersectsRay(closeToSrc, dir);
                    tryIt = tryIt!.plus(tryIt!.minus(closeToSrc).normalize().scale(0.3));
                }
                return [tryIt, closeToDest.offset(0, 1, 0)]; //
            })
            .filter((i) => !!i[0])
            .sort((a, b) => dest.distanceToVec(b[0]!) - dest.distanceToVec(a[0]!))[0];
    }

    public static async checkValidity(simulator: Simulations, bot: Bot, goalBlock: Vec3, state?: PlayerState, particles: boolean = false) {
        state ??= new PlayerState(simulator.physics, bot, ControlStateHandler.COPY_BOT(bot));
        const dest = AABB.fromBlock(goalBlock.clone());
        const srcAABBs = state.getUnderlyingBlockAABBs();
        const destPoints = dest.toArray();
        let closeToSrc;
        let closeToDest;
        const res = srcAABBs
            .map((aabb) => {
                const destTmp = [0, 0, 0];
                const srcTmp = [0, 0, 0];
                const betweenPoints = getBetweenRectangle(aabb, dest).toArray();
                for (let i = 0; i < 3; i++) {
                    if (
                        betweenPoints[i] == destPoints[i] &&
                        (betweenPoints[i + 3] == destPoints[i] || betweenPoints[i + 3] == destPoints[i + 3])
                    ) {
                        srcTmp[i] = (betweenPoints[i] + betweenPoints[i + 3]) / 2;
                        destTmp[i] = (betweenPoints[i] + betweenPoints[i + 3]) / 2;
                    } else if (betweenPoints[i] == destPoints[i] || betweenPoints[i + 3] == destPoints[i]) {
                        srcTmp[i] = betweenPoints[i];
                        destTmp[i] = betweenPoints[i + 3];
                    } else {
                        srcTmp[i] = betweenPoints[i + 3];
                        destTmp[i] = betweenPoints[i];
                    }
                }
                const closeToDest = new Vec3(destTmp[0], destTmp[1], destTmp[2]);
                const closeToSrc = new Vec3(srcTmp[0], srcTmp[1], srcTmp[2]);
                let tryIt;
                if (destTmp[0] == srcTmp[0] && destTmp[1] == srcTmp[1] && destTmp[2] == srcTmp[2]) {
                    tryIt = closeToDest.offset(0, 1, 0);
                } else {
                    const dir = closeToDest.minus(closeToSrc).normalize();
                    tryIt = aabb.intersectsRay(closeToSrc, dir);
                    tryIt = tryIt!.plus(tryIt!.minus(closeToSrc).normalize().scale(0.3));
                }
                return [tryIt, closeToDest.offset(0, 1, 0)]; //
            })
            .filter((i) => !!i[0])
            .sort((a, b) => dest.distanceToVec(b[0]!) - dest.distanceToVec(a[0]!));

        if (res.length === 0) return false;
        [closeToSrc, closeToDest] = res[0];

        // await simulator.simulateBackUpBeforeJump(srcAABBs, closeToSrc, true, true, 20, state, undefined);
        // const shiftGoal = closeToDest.clone();
        // await simulator.simulateJumpFromEdgeOfBlock(srcAABBs, shiftGoal, goalBlock, true, 30, state, undefined);

        const tmp = await JumpMovement.canMakeImmediateJump(simulator, closeToDest, state, false, particles) 
        if (tmp) return tmp;
        const tmp2 = await JumpMovement.noWindup(simulator, srcAABBs, closeToDest, goalBlock, state, false, particles)
        if (tmp2) return tmp2;
        const tmp3 = await JumpMovement.jumpTechnicallyPossible(simulator, srcAABBs, closeToSrc, closeToDest, goalBlock, state, false, particles)
        if (tmp3) return tmp3;
        return false;
    }

    static async canMakeImmediateJump(simulator: Simulations, closeToDest: Vec3, state: PlayerState, shift: boolean = false, particles: boolean = false) {
        const testState = shift ?  state: state.clone();
        await simulator.simulateSmartAim(closeToDest, true, true, 0, 30, testState, undefined, particles); // re-assignment unnecessary since changing org. state.
        return simulator.getReached(closeToDest)(testState);
    }

    async canMakeImmediateJump(): Promise<boolean> {
        const testState = this.state.clone();
        await this.simulator.simulateSmartAim(this.closeToDest, true, true, 0, 30, testState); // re-assignment unnecessary since changing org. state.
        return this.simulator.getReached(this.closeToDest)(testState);
    }

    static async noWindup(
        simulator: Simulations,
        srcAABBs: AABB[],
        closeToDest: Vec3,
        goalBlock: Vec3,
        state: PlayerState,
        shift: boolean = false, 
        particles: boolean = false
    ): Promise<boolean> {
        const testState = shift ?  state: state.clone();
        const tmp = closeToDest.clone();
        await simulator.simulateJumpFromEdgeOfBlock(srcAABBs, tmp, goalBlock, true, 30, testState, undefined, particles); // re-assignment unnecessary since changing org. state.
        return simulator.getReached(tmp)(testState);
    }

    async noWindup(): Promise<boolean> {
        const testState = this.state.clone();
        const tmp = this.closeToDest.clone();
        await this.simulator.simulateJumpFromEdgeOfBlock(this.srcAABBs, tmp, this.goalBlock, true, 30, testState); // re-assignment unnecessary since changing org. state.
        return this.simulator.getReached(tmp)(testState);
    }

    static async jumpTechnicallyPossible(
        simulator: Simulations,
        srcAABBs: AABB[],
        closeToSrc: Vec3,
        closeToDest: Vec3,
        goalBlock: Vec3,
        state: PlayerState,
        shift: boolean = false, 
        particles: boolean = false
    ): Promise<boolean> {
        const testState = shift ?  state: state.clone();
        const tmp = closeToDest.clone();
        simulator.getControllerStraightAim(closeToDest)(testState);
        await simulator.simulateBackUpBeforeJump(srcAABBs, closeToSrc, true, true, 20, testState, undefined, particles);
        await simulator.simulateJumpFromEdgeOfBlock(srcAABBs, tmp, goalBlock, true, 30, testState, undefined, particles);
        return simulator.getReached(tmp)(testState);
    }

    async jumpTechnicallyPossible(): Promise<boolean> {
        const testState = this.state.clone();
        const tmp = this.closeToDest.clone();
        this.simulator.getControllerStraightAim(this.closeToDest)(testState);
        await this.simulator.simulateBackUpBeforeJump(this.srcAABBs, this.closeToSrc, true, true, 20, testState);
        await this.simulator.simulateJumpFromEdgeOfBlock(this.srcAABBs, tmp, this.goalBlock, true, 30, testState);
        return this.simulator.getReached(tmp)(testState);
    }

    /**
     * Wasteful, instead re-use data from calc'd jumps.
     */
    async commitJump(): Promise<PlayerState> {
        // console.log(this.closeToSrc, this.closeToDest)
        this.bot.chat(
            "/particle flame " +
                this.closeToSrc.x.toFixed(4) +
                " " +
                this.closeToSrc.y.toFixed(4) +
                " " +
                this.closeToSrc.z.toFixed(4) +
                " 0 0 0 0 1"
        );
        this.bot.chat(
            "/particle flame " +
                this.closeToDest.x.toFixed(4) +
                " " +
                this.closeToDest.y.toFixed(4) +
                " " +
                this.closeToDest.z.toFixed(4) +
                " 0 0 0 0 1"
        );

        if (await this.canMakeImmediateJump()) {
            return await this.simulator.simulateSmartAim(this.closeToDest, true, true, 0, 30, this.state, this.bot);
        } else if (await this.noWindup()) {
            return await this.simulator.simulateJumpFromEdgeOfBlock(
                this.srcAABBs,
                this.closeToDest.clone(),
                this.goalBlock,
                true,
                30,
                this.state,
                this.bot
            );
        } else {
            this.simulator.getControllerStraightAim(this.closeToDest)(this.state);
            await this.simulator.simulateBackUpBeforeJump(this.srcAABBs, this.closeToSrc, true, true, 20, this.state, this.bot);
            return await this.simulator.simulateJumpFromEdgeOfBlock(
                this.srcAABBs,
                this.closeToDest.clone(),
                this.goalBlock,
                true,
                30,
                this.state,
                this.bot
            );
        }
    }
}
