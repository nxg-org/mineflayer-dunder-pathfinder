import { AABB, MathUtils } from "@nxg-org/mineflayer-util-plugin";
import { stat } from "fs/promises";
import { Bot } from "mineflayer";
import { Block } from "prismarine-block";
import { promisify } from "util";
import { Vec3 } from "vec3";
import { wrapDegrees } from "../../../utils/util";
import { MovementData, MovementTarget } from "../../movement/movementData";
import { PathNode } from "../../nodes/node";
import { ControlStateHandler, PlayerControls } from "../../player/playerControls";
import { Physics } from "../engines/physics";
import { getBetweenRectangle } from "../extras/physicsUtils";
import { PlayerState } from "../states/playerState";

type SimulationGoal = (state: PlayerState) => boolean;
type OnGoalReachFunction = (state: PlayerState) => void;
type Controller = (...any: any[]) => void;

const ZERO = (0 * Math.PI) / 12;
const PI_OVER_TWELVE = (1 * Math.PI) / 12;
const TWO_PI_OVER_TWELVE = (2 * Math.PI) / 12;
const THREE_PI_OVER_TWELVE = (3 * Math.PI) / 12;
const FOUR_PI_OVER_TWELVE = (4 * Math.PI) / 12;
const FIVE_PI_OVER_TWELVE = (5 * Math.PI) / 12;
const SIX_PI_OVER_TWELVE = (6 * Math.PI) / 12;
const SEVEN_PI_OVER_TWELVE = (7 * Math.PI) / 12;
const EIGHT_PI_OVER_TWELVE = (8 * Math.PI) / 12;
const NINE_PI_OVER_TWELVE = (9 * Math.PI) / 12;
const TEN_PI_OVER_TWELVE = (10 * Math.PI) / 12;
const ELEVEN_PI_OVER_TWELVE = (11 * Math.PI) / 12;
const TWELVE_PI_OVER_TWELVE = (12 * Math.PI) / 12;
const THIRTEEN_PI_OVER_TWELVE = (13 * Math.PI) / 12;
const FOURTEEN_PI_OVER_TWELVE = (14 * Math.PI) / 12;
const FIFTEEN_PI_OVER_TWELVE = (15 * Math.PI) / 12;
const SIXTEEN_PI_OVER_TWELVE = (16 * Math.PI) / 12;
const SEVENTEEN_PI_OVER_TWELVE = (17 * Math.PI) / 12;
const EIGHTEEN_PI_OVER_TWELVE = (18 * Math.PI) / 12;
const NINETEEN_PI_OVER_TWELVE = (19 * Math.PI) / 12;
const TWENTY_PI_OVER_TWELVE = (20 * Math.PI) / 12;
const TWENTY_ONE_PI_OVER_TWELVE = (21 * Math.PI) / 12;
const TWENTY_TWO_PI_OVER_TWELVE = (22 * Math.PI) / 12;
const TWENTY_THREE_PI_OVER_TWELVE = (23 * Math.PI) / 12;
const TWENTY_FOUR_PI_OVER_TWELVE = (24 * Math.PI) / 12;

export type SimulationData = { state: PlayerState; movements: MovementData };

/**
 * To be used once per movement.
 *
 * Provide state that will serve as a base. The state itself will not be modified/consumed unless called for.
 */
export class NewSims {
    public world: any; /*prismarine-world*/

    public readonly orgState: PlayerState;
    public readonly orgData: MovementData;
    public readonly state: PlayerState;
    public data: MovementData;

    constructor(public readonly physics: Physics, state: PlayerState, wanted: MovementData | number = 0) {
        this.state = state;
        this.orgState = this.state.clone();
        this.data = wanted instanceof MovementData ? wanted : MovementData.DEFAULT(wanted);
        this.orgData = this.data.clone();
    }

    public clone(): NewSims {
        return new NewSims(this.physics, this.state.clone(), this.data.clone());
    }

    public cloneNoData(startTick: number): NewSims {
        return new NewSims(this.physics, this.state.clone(), startTick);
    }

    public update(state: PlayerState, data?: MovementData) {
        this.state.merge(state);
    }

    public revert() {
        this.state.merge(this.orgState);
        this.data = this.orgData.clone();
    }

    async simulateUntil(
        goal: SimulationGoal,
        onGoalReach: OnGoalReachFunction,
        controller: Controller,
        ticks = 1
    ): Promise<SimulationData> {
        const offset = this.data.maxInputTime;
        let lastInput = this.data.inputsByTicks[offset]
        let lastTarget = this.data.targetsByTicks[offset];
        for (let i = offset; i <= ticks + offset; i++) {


            if (goal(this.state)) {
                // onGoalReach(this.state);
                // this.data.maxInputOffset = i + 1;
                // this.data.maxInputTime = this.data.minInputTime + i + 1
                this.data.setInputs(i , this.state.controlState.clone());
                this.data.setTargetObj(i , new MovementTarget(this.state.yaw, this.state.pitch, true))
                this.physics.simulatePlayer(this.state);
                break;
            }

        

            controller(this.state, i, offset);

            // console.log(state.controlState, i)
            // if (this.data.inputsByTicks[i - 1] && !this.data.inputsByTicks[i - 1].equals(this.state.controlState)) {
            if (!lastInput || !lastInput.equals(this.state.controlState)) {
                lastInput = this.state.controlState.clone();
                this.data.setInputs(i, lastInput);
            }

            if (!lastTarget || lastTarget.yaw != this.state.yaw || lastTarget.pitch != this.state.pitch) {
                lastTarget = new MovementTarget(this.state.yaw, this.state.pitch, true);
                this.data.setTargetObj(i, lastTarget);
            }


            // if (i % 10 == 0)
            // const msg =
            //     "/particle " +
            //     "flame" +
            //     " " +
            //     this.state.position.x.toFixed(4) +
            //     " " +
            //     this.state.position.y.toFixed(4) +
            //     " " +
            //     this.state.position.z.toFixed(4) +
            //     " 0 0 0 0 1";
            // // // console.log(msg);
            // this.state.bot.chat(msg);

            if (this.state.isInLava) break;
            this.physics.simulatePlayer(this.state);

          
     

       

          
        }
        return { state: this.state, movements: this.data };
    }

    async applyToState(state: PlayerState, controls: MovementData): Promise<PlayerState> {
        const maxTime = controls.maxInputTime;
        // console.log(controls, "controls")
        // console.log(maxTime, this.data.length(), this.data.length() == 0 ? this.data.inputStatesAndTimes : "has stuff");
        for (let i = this.data.minInputTime; i <= maxTime; i++) {
            const tmp = controls.inputsByTicks[i];
            if (tmp) state.controlState = tmp.clone();
            const tmp1 = this.data.targetsByTicks[i];
            if (tmp1) {
                state.yaw = tmp1.yaw;
                state.pitch = tmp1.pitch;
            }
            // console.log("moving state on tick:", i, "with", this.data.maxInputTime - i, "moves left.", this.data.inputStatesAndTimes[i])
            this.physics.simulatePlayer(state);
            if (state.isInLava) return state;
        }

        return state;
    }

    static async applyToBot(bot: Bot, physics: Physics, controls: MovementData) {
        // bot.physicsEnabled = false
        const state = new PlayerState(physics, bot);
        const maxTime = controls.maxInputTime;
        for (let i = controls.minInputTime; i <= maxTime; i++) {
            const tmp = controls.inputsByTicks[i];
            if (tmp) state.controlState = tmp.clone();
            const tmp1 = controls.targetsByTicks[i];
            if (tmp1) {
                state.yaw = tmp1.yaw;
                state.pitch = tmp1.pitch;
            }
            // if (state.controlState.jump) {
            //     bot.chat("want jump on " + i)
            // }

            physics.simulatePlayer(state)
            state.apply(bot)

            // console.log(bot.entity.position)
            if (state.isInLava) break;
            await bot.waitForTicks(1);
            // await bot.waitForTicks(1)
        }
        // bot.physicsEnabled = true
        console.log("state:", state.position, "bot:", bot.entity.position)
    }

    async applyToBot(bot: Bot, controls: MovementData): Promise<PlayerState> {
        const state = new PlayerState(this.physics, bot);

        const maxTime = controls.maxInputTime;
        for (let i = controls.minInputTime; i <= maxTime; i++) {
            const tmp = controls.inputsByTicks[i];
            if (tmp) state.controlState = tmp.clone();
            const tmp1 = controls.targetsByTicks[i];
            if (tmp1) {
                state.yaw = tmp1.yaw;
                state.pitch = tmp1.pitch;
            }

            this.physics.simulatePlayer(state).apply(bot);

            // console.log(bot.entity.position)
            if (state.isInLava) return state;
            await bot.waitForTicks(1);
        }
        return state;
    }

    async simulateUntilNextTick(): Promise<SimulationData> {
        return await this.simulateUntil(
            () => false,
            () => {},
            () => {},
            1
        );
    }

    async simulateUntilOnGround(ticks = 5): Promise<SimulationData> {
        return await this.simulateUntil(
            (state) => state.onGround,
            () => {},
            () => {},
            ticks
        );
    }

    simulateLookAtTarget(goal: Vec3) {
        NewSims.getControllerStraightAim(goal)(this.state);
    }

    async simulateSmartAim(goal: Vec3, sprint: boolean, jump: boolean, jumpAfter = 0, ticks = 20): Promise<SimulationData> {
        return await this.simulateUntil(
            NewSims.getReached(goal),
            NewSims.getCleanupPosition(goal),
            NewSims.buildFullController(
                NewSims.getControllerStraightAim(goal),
                NewSims.getControllerStrafeAim(goal),
                NewSims.getControllerSmartMovement(goal, sprint),
                NewSims.getControllerJumpSprint(jump, sprint, jumpAfter)
            ),
            ticks
        );
    }

    /**
     * Assume we know the correct back-up position.
     */
    async simulateBackUpBeforeJump(goal: Vec3, sprint: boolean, strafe = true, ticks = 20): Promise<SimulationData> {
        const aim = strafe ? NewSims.getControllerStrafeAim(goal) : NewSims.getControllerStraightAim(goal);
        return await this.simulateUntil(
            (state) => state.position.xzDistanceTo(goal) < 0.1,
            NewSims.getCleanupPosition(goal),
            NewSims.buildFullController(
                aim,
                NewSims.getControllerSmartMovement(goal, sprint),
                (state: PlayerState, ticks: number) => {
                    state.controlState.sprint = false;
                    state.controlState.sneak = true;
                }
            ),
            ticks
        );
    }

    simulateJumpFromEdgeOfBlock(srcAABBs: AABB[], goalCorner: Vec3, goalBlock: Vec3, sprint: boolean, ticks = 20): Promise<SimulationData> {
        let jump = false;
        let changed = false;
        return this.simulateUntil(
            NewSims.getReached(goalCorner),
            NewSims.getCleanupPosition(goalCorner),
            NewSims.buildFullController(
                NewSims.getControllerStraightAim(goalCorner),
                NewSims.getControllerStrafeAim(goalCorner),
                NewSims.getControllerSmartMovement(goalCorner, sprint),
                (state: PlayerState, ticks: number, offset: number) => {
                    state.controlState.sneak = false;
                    // check if player is leaving src block collision
                    const playerBB = state.getAABB();
                    playerBB.expand(0, 1e-1, 0);
                    if (jump && state.position.xzDistanceTo(goalCorner) < 0.5 && !changed) {
                        goalCorner.set(goalBlock.x + 0.5, goalBlock.y + 1, goalBlock.z + 0.5);
                        changed = true;
                    }
                    if (ticks > offset && srcAABBs.every((src) => !src.intersects(playerBB)) && !jump) {
                        state.controlState.jump = true;
                        jump = true;
                    } else {
                        state.controlState.jump = false;
                    }
                }
            ),
            ticks
        );
    }

    static getReached(...path: Vec3[]): SimulationGoal {
        return (state: PlayerState) => {
            const delta = path[0].minus(state.position);
            return Math.abs(delta.x) <= 0.35 && Math.abs(delta.z) <= 0.35 && Math.abs(delta.y) < 1 && (state.onGround || state.isInWater);
        };
    }

    static getCleanupPosition(...path: Vec3[]): OnGoalReachFunction {
        return (state: PlayerState) => {
            state.clearControlStates();
        };
    }

    static getControllerStraightAim(nextPoint: Vec3): Controller {
        return (state: PlayerState, ticks: number) => {
            const dx = nextPoint.x - state.position.x;
            const dz = nextPoint.z - state.position.z;
            state.yaw = Math.atan2(-dx, -dz);
        };
    }

    // right should be positiive,
    // left should be negative.
    static getControllerStrafeAim(nextPoint: Vec3): Controller {
        return (state: PlayerState, ticks: number) => {
            const offset = state.position.plus(state.onGround ? state.velocity : state.velocity.scaled(1));
            const dx = nextPoint.x - offset.x;
            const dz = nextPoint.z - offset.z;
            const wantedYaw = wrapDegrees(Math.atan2(-dx, -dz));
            const diff = wrapDegrees(wantedYaw - state.yaw);
            if (PI_OVER_TWELVE < diff && diff < ELEVEN_PI_OVER_TWELVE) {
                state.controlState.left = true; // are these reversed? tf
                state.controlState.right = false;
                // console.log("left");
            } else if (THIRTEEN_PI_OVER_TWELVE < diff && diff < TWENTY_THREE_PI_OVER_TWELVE) {
                state.controlState.left = false;
                state.controlState.right = true;
                // console.log("right");
            } else {
                state.controlState.left = false;
                state.controlState.right = false;
                // console.log("rotate neither, left:", state.control.movements.left, "right:", state.control.movements.right);
            }
        };
    }

    static getControllerJumpSprint(jump: boolean, sprint: boolean, jumpAfter = 0): Controller {
        return (state: PlayerState, ticks: number) => {
            state.controlState.jump = state.onGround && jump && ticks >= jumpAfter;
            state.controlState.sprint = sprint;
        };
    }

    // forward should be any value that abs. val to below pi / 2
    // backward is any value that abs. val to above pi / 2
    static getControllerSmartMovement(goal: Vec3, sprint: boolean): Controller {
        return (state: PlayerState, ticks: number) => {
            const offset = state.position.plus(state.onGround ? state.velocity : state.velocity.scaled(1));
            const dx = goal.x - offset.x;
            const dz = goal.z - offset.z;
            const wantedYaw = wrapDegrees(Math.atan2(-dx, -dz));
            const diff = wrapDegrees(wantedYaw - state.yaw);
            // console.log(diff / Math.PI * 12)
            if (SEVEN_PI_OVER_TWELVE < diff && diff < SEVENTEEN_PI_OVER_TWELVE) {
                state.controlState.forward = false;
                state.controlState.sprint = false;
                state.controlState.back = true;
                // console.log("back");
            } else if (NINETEEN_PI_OVER_TWELVE < diff || diff < FIVE_PI_OVER_TWELVE) {
                state.controlState.forward = true;
                state.controlState.sprint = sprint;
                state.controlState.back = false;
            } else {
                state.controlState.forward = false;
                state.controlState.back = false;
                state.controlState.sprint = false;
            }
        };
    }

    static buildFullController(...controllers: Controller[]): Controller {
        return (state: PlayerState, ticks: number, offset: number) => {
            controllers.forEach((control) => control(state, ticks, offset));
        };
    }
}
