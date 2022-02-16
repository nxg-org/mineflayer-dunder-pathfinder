import { AABB } from "@nxg-org/mineflayer-util-plugin";
import { Bot } from "mineflayer";
import { Block } from "prismarine-block";
import { Vec3 } from "vec3";
import { MovementData } from "../../movement/movementData";
import { ControlStateHandler, PlayerControls } from "../../player/playerControls";
import { Physics } from "../engines/physics";
import { getBetweenRectangle } from "../extras/physicsUtils";
import { PlayerState } from "../extras/playerState";
import { Simulations } from "../sims/simulations";
import { NewSimulations, SimulationData } from "../sims/simulationsNew";

export type fuk = { success: boolean; type?: string; data?: SimulationData };
export class NewJumpMovement {
    private bot: Bot;
    public readonly simulator: NewSimulations;
    public readonly applier: Simulations;

    public readonly state: PlayerState;
    public readonly srcAABBs: AABB[];
    public readonly goalBlock: Vec3;
    public readonly closeToSrc: Vec3;
    public readonly closeToDest: Vec3;

    public jumpData: { immediate?: fuk; noWindup?: fuk; windup?: fuk };

    constructor(physics: Physics, simulator: NewSimulations, applier: Simulations, bot: Bot, goalBlock: Vec3, state?: PlayerState) {
        this.bot = bot;
        this.simulator = simulator;
        this.applier = applier;
        this.state = state ?? new PlayerState(physics, bot, ControlStateHandler.COPY_BOT(bot));
        this.goalBlock = goalBlock;
        this.srcAABBs = this.state.getUnderlyingBlockAABBs();
        const dest = AABB.fromBlock(this.goalBlock.clone());

        this.jumpData = {};

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

    public static async checkValidity(goalBlock: Vec3, simulator: NewSimulations, bot: Bot, state?: PlayerState, data?: MovementData): Promise<fuk> {
        state ??= new PlayerState(simulator.physics, bot, ControlStateHandler.COPY_BOT(bot));
        data ??= MovementData.DEFAULT_FROM_STATE(state, 0);
        const dest = AABB.fromBlock(goalBlock);
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

        if (res.length === 0) return { success: false };
        [closeToSrc, closeToDest] = res[0];

        // await simulator.simulateBackUpBeforeJump(srcAABBs, closeToSrc, true, true, 20, state, undefined);
        // const shiftGoal = closeToDest.clone();
        // await simulator.simulateJumpFromEdgeOfBlock(srcAABBs, shiftGoal, goalBlock, true, 30, state, undefined);

        const tmp = await NewJumpMovement.canMakeImmediateJump(simulator, closeToDest, state, data, false);
        if (tmp.success) return tmp;
        const tmp2 = await NewJumpMovement.noWindup(simulator, srcAABBs, closeToDest, goalBlock, state, data, false);
        if (tmp2.success) return tmp2;
        const tmp3 = await  NewJumpMovement.jumpTechnicallyPossible(simulator, srcAABBs, closeToSrc, closeToDest, goalBlock, state, data, false);
        if (tmp3.success) return tmp3;
        return { success: false };
    }

    static async canMakeImmediateJump(simulator: NewSimulations, closeToDest: Vec3, state: PlayerState, data: MovementData, shift: boolean = false) {
        const testState = shift ? state : state.clone();
        const testData = shift ? data : data.clone();
        await simulator.simulateSmartAim(closeToDest, true, true, 0, 30, testState, testData); // re-assignment unnecessary since changing org. state.
        return { success: simulator.getReached(closeToDest)(testState), type: "immediate",  data: {state: testState, movements: testData} };
    }

    async canMakeImmediateJump(): Promise<boolean> {
        const testState = this.state.clone();
        const data = await this.simulator.simulateSmartAim(this.closeToDest, true, true, 0, 30, testState); // re-assignment unnecessary since changing org. state.
        const success = this.simulator.getReached(this.closeToDest)(testState);
        this.jumpData.immediate = { success, data: data };
        return success;
    }

    static async noWindup(
        simulator: NewSimulations,
        srcAABBs: AABB[],
        closeToDest: Vec3,
        goalBlock: Vec3,
        state: PlayerState,
        data: MovementData,
        shift: boolean = false
    ) {
        const testState = shift ? state : state.clone();
        const testData = shift ? data : data.clone();
        const tmp = closeToDest.clone();
        await simulator.simulateJumpFromEdgeOfBlock(srcAABBs, tmp, goalBlock, true, 30, testState, testData); // re-assignment unnecessary since changing org. state.
        return { success: simulator.getReached(tmp)(testState), type: "no windup",  data: {state: testState, movements: testData}};
    }

    async noWindup(): Promise<boolean> {
        const testState = this.state.clone();
        const dest = this.closeToDest.clone();
        const data = await this.simulator.simulateJumpFromEdgeOfBlock(this.srcAABBs, dest, this.goalBlock, true, 30, testState); // re-assignment unnecessary since changing org. state.
        const success = this.simulator.getReached(dest)(testState);
        this.jumpData.noWindup = { success, data };
        return success;
    }

    static async jumpTechnicallyPossible(
        simulator: NewSimulations,
        srcAABBs: AABB[],
        closeToSrc: Vec3,
        closeToDest: Vec3,
        goalBlock: Vec3,
        state: PlayerState,
        data: MovementData,
        shift: boolean = false
    ) {
        const testState = shift ? state : state.clone();
        const testData = shift ? data : data.clone();
        const tmp = closeToDest.clone();
        simulator.getControllerStraightAim(closeToDest)(testState);
        await simulator.simulateBackUpBeforeJump(srcAABBs, closeToSrc, true, true, 20, testState, testData);
        await simulator.simulateJumpFromEdgeOfBlock(srcAABBs, tmp, goalBlock, true, 30, testState, testData);
        return { success: simulator.getReached(tmp)(testState), type: "windup", data: {state: testState, movements: testData}};
    }

    async jumpTechnicallyPossible(): Promise<boolean> {
        const testState = this.state.clone();
        const dest = this.closeToDest.clone();
        this.simulator.getControllerStraightAim(this.closeToDest)(testState);
        const data = await this.simulator.simulateBackUpBeforeJump(this.srcAABBs, this.closeToSrc, true, true, 20, testState);
        await this.simulator.simulateJumpFromEdgeOfBlock(this.srcAABBs, dest, this.goalBlock, true, 30, data.state, data.movements);
        const success = this.simulator.getReached(dest)(data.state);
        this.jumpData.windup = { success, data };
        return success;
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
            // if (this.jumpData.immediate) {
            //     return await this.applier.simulateData(this.closeToDest, this.jumpData.immediate.movements, 30, this.state, this.bot);
            // } else {
            return await this.applier.simulateSmartAim(this.closeToDest, true, true, 0, 30, this.state, this.bot);
            // }
        } else if (await this.noWindup()) {
            // if (this.jumpData.noWindup) {
            //     return await this.applier.simulateData(this.closeToDest.clone(), this.jumpData.noWindup.movements, 30, this.state, this.bot);
            // } else {
            return await this.applier.simulateJumpFromEdgeOfBlock(
                this.srcAABBs,
                this.closeToDest.clone(),
                this.goalBlock,
                true,
                30,
                this.state,
                this.bot
            );
            // }
        } else if (await this.jumpTechnicallyPossible()) {
            this.applier.getControllerStraightAim(this.closeToDest)(this.state);
            // if (this.jumpData.windup) {
            //     return await this.applier.simulateData(this.closeToDest.clone(), this.jumpData.windup.movements, 30, this.state, this.bot);
            // } else {
            await this.applier.simulateBackUpBeforeJump(this.srcAABBs, this.closeToSrc, true, true, 20, this.state, this.bot);
            return await this.applier.simulateJumpFromEdgeOfBlock(
                this.srcAABBs,
                this.closeToDest.clone(),
                this.goalBlock,
                true,
                30,
                this.state,
                this.bot
            );
            // }
        } else {
            console.log("not possible?", this.state.position, this.closeToDest);
            return this.state;
        }
    }
}
