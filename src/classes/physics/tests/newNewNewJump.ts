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

export type JumpNames = "immediate" | "noWindup" | "windup";
export type fuk = { success: boolean; data: SimulationData; type?: JumpNames } | { success: false };

export type JumpInfo = { checked: false } | { checked: true; result: fuk };
export type JumpData = { [name in JumpNames]: JumpInfo };

export class NewJump {
    private state: PlayerState;
    public readonly sim: NewSims;
    public readonly srcAABBs: AABB[];
    public readonly goalBlock: Vec3;
    public readonly closeToSrc: Vec3;
    public readonly closeToDest: Vec3;

    public jumpData: JumpData;

    constructor(physics: Physics, state: PlayerState, goalBlock: Vec3) {
        this.state = state;
        this.sim = new NewSims(physics, state);
        this.goalBlock = goalBlock;
        this.srcAABBs = this.sim.orgState.getUnderlyingBlockAABBs();
        const dest = AABB.fromBlock(this.goalBlock.clone());
        this.jumpData = {
            immediate: { checked: false },
            noWindup: { checked: false },
            windup: { checked: false },
        };

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

    public async checkValidity(shift: boolean = true): Promise<fuk> {
        const tmp = await this.canMakeImmediateJump(shift);
        if (tmp.success) return tmp;
        else this.sim.revert();
        const tmp2 = await this.noWindup(shift);
        if (tmp2.success) return tmp2;
        else this.sim.revert();
        const tmp3 = await this.jumpTechnicallyPossible(shift);
        if (tmp3.success) return tmp3;
        else this.sim.revert();
        return { success: false };
    }

    async canMakeImmediateJump(shift: boolean = false): Promise<fuk> {
        const data = await this.sim.simulateSmartAim(this.closeToDest, true, true, 0, 30); // re-assignment unnecessary since changing org. state.\
        const success = NewSims.getReached(this.closeToDest)(this.sim.state);
        const result = { success, type: "immediate" as JumpNames, data };
        this.jumpData.immediate = { checked: true, result };
        if (!shift) this.sim.revert();
        return result;
    }

    async noWindup(shift: boolean = false): Promise<fuk> {
        const dest = this.closeToDest.clone();
        const data = await this.sim.simulateJumpFromEdgeOfBlock(this.srcAABBs, dest, this.goalBlock, true, 30); // re-assignment unnecessary since changing org. state.
        const success = NewSims.getReached(dest)(this.sim.state);
        const result = { success, type: "noWindup" as JumpNames, data };
        this.jumpData.noWindup = { checked: true, result };
        if (!shift) this.sim.revert();
        return result;
    }

    async jumpTechnicallyPossible(shift: boolean = false): Promise<fuk> {
        const dest = this.closeToDest.clone();
        NewSims.getControllerStraightAim(this.closeToDest)(this.sim.state);
        await this.sim.simulateBackUpBeforeJump(this.closeToSrc, true, true, 20);
        const data = await this.sim.simulateJumpFromEdgeOfBlock(this.srcAABBs, dest, this.goalBlock, true, 30);
        const success = NewSims.getReached(dest)(this.sim.state);
        const result = { success, type: "windup" as JumpNames, data };
        this.jumpData.windup = { checked: true, result };
        if (!shift) this.sim.revert();
        return result;
    }

    /**
     * Wasteful, instead re-use data from calc'd jumps.
     */
    async commitJump(bot: Bot) {
        // console.log(this.closeToSrc, this.closeToDest)
        if (this.jumpData.immediate.checked) {
            if (this.jumpData.immediate.result.success) {
                return await this.sim.applyToBot(bot, this.jumpData.immediate.result.data.movements);
            }
        } else {
            const res = await this.canMakeImmediateJump();
            if (res.success) {
                return await this.sim.applyToBot(bot, res.data.movements);
            }
        }

        if (this.jumpData.noWindup.checked) {
            if (this.jumpData.noWindup.result.success) {
                return await this.sim.applyToBot(bot, this.jumpData.noWindup.result.data.movements);
            }
        } else {
            const res = await this.noWindup();
            if (res.success) {
                return await this.sim.applyToBot(bot, res.data.movements);
            }
        }

        if (this.jumpData.windup.checked) {
            if (this.jumpData.windup.result.success) {
                return await this.sim.applyToBot(bot, this.jumpData.windup.result.data.movements);
            }
        } else {
            const res = await this.jumpTechnicallyPossible();
            if (res.success) {
                return await this.sim.applyToBot(bot, res.data.movements);
            }
        }

        console.log("not possible?", this.sim.state.position, this.closeToDest);
        return this.sim.state;
    }
}
