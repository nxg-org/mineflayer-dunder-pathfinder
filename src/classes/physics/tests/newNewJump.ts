import { AABB } from "@nxg-org/mineflayer-util-plugin";
import { Bot } from "mineflayer";
import { Block } from "prismarine-block";
import { Vec3 } from "vec3";
import { MovementData } from "../../movement/movementData";
import { ControlStateHandler, PlayerControls } from "../../player/playerControls";
import { Physics } from "../engines/physics";
import { getBetweenRectangle } from "../extras/physicsUtils";
import { PlayerState } from "../extras/playerState";
import { NewSims } from "../sims/nextSim";
import { Simulations } from "../sims/simulations";
import { SimulationData } from "../sims/simulationsNew";

export type fuk = { success: true; data: SimulationData; type?: string } | { success: false; type?: string };
export class NewJump {
    private state: PlayerState;
    public readonly sim: NewSims;
    public readonly srcAABBs: AABB[];
    public readonly goalBlock: Vec3;
    public readonly closeToSrc: Vec3;
    public readonly closeToDest: Vec3;

    public jumpData: { immediate?: fuk; noWindup?: fuk; windup?: fuk };

    constructor(physics: Physics, state: PlayerState, goalBlock: Vec3) {
        this.state = state;
        this.sim = new NewSims(physics, state);
        this.goalBlock = goalBlock;
        this.srcAABBs = this.sim.orgState.getUnderlyingBlockAABBs();
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

    public async checkValidity(shift: boolean = false): Promise<fuk> {
        const tmp = await this.canMakeImmediateJump(shift);
        if (tmp.success) return tmp;
        else this.sim.revert();
        const tmp2 = await this.noWindup(shift);
        if (tmp2.success) return tmp2;
        else this.sim.revert();
        const tmp3 = await this.jumpTechnicallyPossible(shift);
        if (tmp3.success) return tmp3;
        else {
            // console.log(this.sim.data)
            this.sim.revert();
        }
        return { success: false };
    }

    public static async checkValidity(goalBlock: Vec3, sim: NewSims): Promise<fuk> {
        const dest = AABB.fromBlock(goalBlock);
        const srcAABBs = sim.state.getUnderlyingBlockAABBs();
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

        // await sim.simulateBackUpBeforeJump(srcAABBs, closeToSrc, true, true, 20, state, undefined);
        // const shiftGoal = closeToDest.clone();
        // await sim.simulateJumpFromEdgeOfBlock(srcAABBs, shiftGoal, goalBlock, true, 30, state, undefined);

        const tmp = await NewJump.canMakeImmediateJump(sim, closeToDest, false);
        if (tmp.success) return tmp;
        const tmp2 = await NewJump.noWindup(sim, srcAABBs, closeToDest, goalBlock, false);
        if (tmp2.success) return tmp2;
        const tmp3 = await NewJump.jumpTechnicallyPossible(sim, srcAABBs, closeToSrc, closeToDest, goalBlock, false);
        if (tmp3.success) return tmp3;
        return { success: false };
    }

    static async canMakeImmediateJump(sim: NewSims, closeToDest: Vec3, shift: boolean = false): Promise<fuk> {
        await sim.simulateSmartAim(closeToDest, true, true, 0, 30); // re-assignment unnecessary since changing org. state.
        const returnObj = {
            success: NewSims.getReached(closeToDest)(sim.state),
            type: "immediate",
            data: { state: sim.state, movements: sim.data },
        };
        if (!shift) sim.revert();
        return returnObj;
    }

    async canMakeImmediateJump(shift: boolean = false): Promise<fuk> {
        const data = await this.sim.simulateSmartAim(this.closeToDest, true, true, 0, 30); // re-assignment unnecessary since changing org. state.\
        const success = NewSims.getReached(this.closeToDest)(this.sim.state);
        this.jumpData.immediate = { success, type: "immediate", data };
        if (!shift) this.sim.revert();
        return { success, type: "immediate", data };
    }

    static async noWindup(sim: NewSims, srcAABBs: AABB[], closeToDest: Vec3, goalBlock: Vec3, shift: boolean = false) {
        const dest = closeToDest.clone();
        await sim.simulateJumpFromEdgeOfBlock(srcAABBs, dest, goalBlock, true, 30); // re-assignment unnecessary since changing org. state.
        const returnObj = {
            success: NewSims.getReached(dest)(sim.state),
            type: "no windup",
            data: { state: sim.state, movements: sim.data },
        };
        if (!shift) sim.revert();
        return returnObj;
    }

    async noWindup(shift: boolean = false): Promise<fuk> {
        const dest = this.closeToDest.clone();
        const data = await this.sim.simulateJumpFromEdgeOfBlock(this.srcAABBs, dest, this.goalBlock, true, 30); // re-assignment unnecessary since changing org. state.
        const success = NewSims.getReached(dest)(this.sim.state);
        this.jumpData.noWindup = { success, type: "no windup", data };
        if (!shift) this.sim.revert();
        return { success, type: "no windup", data };
    }

    static async jumpTechnicallyPossible(
        sim: NewSims,
        srcAABBs: AABB[],
        closeToSrc: Vec3,
        closeToDest: Vec3,
        goalBlock: Vec3,
        shift: boolean = false
    ): Promise<fuk> {
        const dest = closeToDest.clone();
        NewSims.getControllerStraightAim(closeToDest)(sim.state);
        await sim.simulateBackUpBeforeJump(closeToSrc, true, true, 20);
        await sim.simulateJumpFromEdgeOfBlock(srcAABBs, dest, goalBlock, true, 30);
        const returnObj = { success: NewSims.getReached(dest)(sim.state), type: "windup", data: { state: sim.state, movements: sim.data } };
        if (!shift) sim.revert();
        return returnObj;
    }

    async jumpTechnicallyPossible(shift: boolean = false): Promise<fuk> {
        const dest = this.closeToDest.clone();
        NewSims.getControllerStraightAim(this.closeToDest)(this.sim.state);
        await this.sim.simulateBackUpBeforeJump(this.closeToSrc, true, true, 20);
        await this.sim.simulateJumpFromEdgeOfBlock(this.srcAABBs, dest, this.goalBlock, true, 30);
        const success = NewSims.getReached(dest)(this.sim.state);
        this.jumpData.windup = { success, type: "windup", data: { state: this.sim.state, movements: this.sim.data } };
        if (!shift) this.sim.revert();
        return { success, type: "windup", data: { state: this.sim.state, movements: this.sim.data } };
    }

    /**
     * Wasteful, instead re-use data from calc'd jumps.
     */
    async commitJump(bot: Bot) {
        // console.log(this.closeToSrc, this.closeToDest)
        if (bot) {
            bot.chat(
                "/particle flame " +
                    this.closeToSrc.x.toFixed(4) +
                    " " +
                    this.closeToSrc.y.toFixed(4) +
                    " " +
                    this.closeToSrc.z.toFixed(4) +
                    " 0 0 0 0 1"
            );
            bot.chat(
                "/particle flame " +
                    this.closeToDest.x.toFixed(4) +
                    " " +
                    this.closeToDest.y.toFixed(4) +
                    " " +
                    this.closeToDest.z.toFixed(4) +
                    " 0 0 0 0 1"
            );
        }

        if ((await this.canMakeImmediateJump()).success) {
            if (this.jumpData.immediate?.success) {
                return await this.sim.applyToBot(bot, this.jumpData.immediate.data.movements);
            }
            // console.log("shit?")
            // else {
            // return await this.sim.simulateSmartAim(this.closeToDest, true, true, 0, 30, this.state, this.bot);
            // }
        } else if ((await this.noWindup()).success) {
            if (this.jumpData.noWindup?.success) {
                // console.log("applying")
                return await this.sim.applyToBot(bot, this.jumpData.noWindup.data.movements);
                // return await this.applier.simulateData(this.closeToDest.clone(), this.jumpData.noWindup.movements, 30, this.state, this.bot);
            }
            
        // // else {
        // // return await this.applier.sim readonly ulateJumpFromEdgeOfBlock(
        // //     this.srcAABBs,
        // //     this.closeToDest.clone(),
        // //     this.goalBlock,
        // //     true,
        // //     30,
        // //     this.state,
        // //     this.bot
        // // );
        // // }
        } else
        if ((await this.jumpTechnicallyPossible()).success) {
            if (this.jumpData.windup?.success) {
                // NewSims.getControllerStraightAim(this.closeToDest)(this.sim.state);
                // const dest = this.closeToDest.clone();
                // NewSims.getControllerStraightAim(this.closeToDest)(this.sim.state);
                
                // return (await this.sim.simulateBackUpBeforeJump(this.closeToSrc, true, true, 20)).state
                return await this.sim.applyToBot(bot, this.jumpData.windup.data.movements);
                // return await this.applier.simulateData(this.closeToDest.clone(), this.jumpData.windup.movements, 30, this.state, this.bot);
            }
            // else {
            // await this.applier.simulateBackUpBeforeJump(this.srcAABBs, this.closeToSrc, true, true, 20, this.state, this.bot);
            // return await this.applier.simulateJumpFromEdgeOfBlock(
            //     this.srcAABBs,
            //     this.closeToDest.clone(),
            //     this.goalBlock,
            //     true,
            //     30,
            //     this.state,
            //     this.bot
            // );
            // }
        } else {
            console.log("not possible?", this.sim.state.position, this.closeToDest);
            return this.sim.state;
        }
    }
}
