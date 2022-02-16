import { AABB, MathUtils } from "@nxg-org/mineflayer-util-plugin";
import { stat } from "fs/promises";
import { Bot } from "mineflayer";
import { Block } from "prismarine-block";
import { promisify } from "util";
import { Vec3 } from "vec3";
import { wrapDegrees } from "../../../utils/util";
import { MovementData } from "../../movement/movementData";
import { PathNode } from "../../nodes/node";
import { ControlStateHandler, PlayerControls } from "../../player/playerControls";
import { Physics } from "../engines/physics";
import { getBetweenRectangle } from "../extras/physicsUtils";
import { PlayerState } from "../extras/playerState";

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

const sleep = promisify(setTimeout);
export class Simulations {
    public world: any; /*prismarine-world*/
    public predictiveWorld;

    constructor(public bot: Bot, public physics: Physics) {
        this.predictiveWorld = this.bot.util.predict.world;
    }

    async simulateUntil(
        goal: SimulationGoal,
        onGoalReach: OnGoalReachFunction,
        controller: Controller,
        ticks = 1,
        state?: PlayerState,
        bot?: Bot,
        particles: boolean = false,
        particleName: string = "flame"
    ): Promise<PlayerState> {
        if (!state) {
            state = new PlayerState(this.physics, this.bot, ControlStateHandler.COPY_BOT(this.bot));
        }
        let returnTime = false;
        for (let i = 0; i < ticks; i++) {
            controller(state, i);
            this.physics.simulatePlayer(state);
            if (state.isInLava) returnTime = true;
            if (goal(state)) {
                onGoalReach(state);
                returnTime = true;
            }
            if (bot) {
                state.apply(bot);
                await bot.waitForTicks(1);
            }
            if (true) {
                // if (ticks % 10 === 0) {
                    this.bot.chat(
                        "/particle " +
                            particleName +
                            " " +
                            state.position.x.toFixed(4) +
                            " " +
                            state.position.y.toFixed(4) +
                            " " +
                            state.position.z.toFixed(4) +
                            " 0 0 0 0 1"
                    );
                // }
            }
            if (returnTime) return state;
        }

        return state;
    }

    simulateUntilNextTick(state?: PlayerState): Promise<PlayerState> {
        return this.simulateUntil(
            () => false,
            () => {},
            () => {},
            1,
            state
        );
    }

    simulateUntilOnGround(ticks = 5, state?: PlayerState): Promise<PlayerState> {
        return this.simulateUntil(
            (state) => state.onGround,
            () => {},
            () => {},
            ticks,
            state
        );
    }

    simulateData(goal: Vec3, data: MovementData, state?: PlayerState, bot?: Bot): Promise<PlayerState> {

        // console.log("SIMULATING INPUTS FOR:", data.maxInputOffset);
        return this.simulateUntil(
            this.getReached(goal),
            this.getCleanupPosition(),
            (state: PlayerState, ticks: number) => {
                const tmp = data.inputsByTicks[ticks + data.minInputTime];

                if (tmp) {
                    state.controlState = tmp;
                }

                const tmp1 = data.targetsByTicks[ticks + data.minInputTime];
                if (tmp1) {
                    state.yaw = tmp1.yaw;
                    state.pitch = tmp1.pitch;
                }

                this.bot.chat(
                    "/particle " +
                        "flame" +
                        " " +
            
                        state.position.x.toFixed(4) +
                        " " +
                        state.position.y.toFixed(4) +
                        " " +
                        state.position.z.toFixed(4) +
                        " 0 0 0 0 1"
                );

                // console.log("input?", tmp.sprint, "rotation?:", tmp1, "ticks:", ticks);
            },
            data.maxInputOffset,
            state,
            bot,
        );
    }

    simulateSmartAim(
        goal: Vec3,
        sprint: boolean,
        jump: boolean,
        jumpAfter = 0,
        ticks = 20,
        state?: PlayerState,
        bot?: Bot,
        particles: boolean = false
    ): Promise<PlayerState> {
        return this.simulateUntil(
            this.getReached(goal),
            this.getCleanupPosition(),
            this.buildFullController(
                this.getControllerJumpSprint(jump, sprint, jumpAfter),
                this.getControllerStraightAim(goal),
                this.getControllerStrafeAim(goal),
                this.getControllerSmartMovement(goal, sprint)
            ),
            ticks,
            state,
            bot,
            particles
        );
    }

    simulateBackUpBeforeJump(
        srcAABBs: AABB[],
        goal: Vec3,
        sprint: boolean,
        strafe = true,
        ticks = 20,
        state?: PlayerState,
        bot?: Bot,
        particles: boolean = false
    ): Promise<PlayerState> {
        const aim = strafe ? this.getControllerStrafeAim(goal) : this.getControllerStraightAim(goal);
        state ??= new PlayerState(this.physics, this.bot, ControlStateHandler.COPY_BOT(this.bot));

        return this.simulateUntil(
            (state) => state.position.xzDistanceTo(goal) < 0.1,
            this.getCleanupPosition(),
            this.buildFullController(aim, this.getControllerSmartMovement(goal, sprint), (state: PlayerState, ticks: number) => {
                state.controlState.sprint = false;
                state.controlState.sneak = true;
            }),
            ticks,
            state,
            bot,
            particles
        );
    }

    simulateJumpFromEdgeOfBlock(
        srcAABBs: AABB[],
        goalCorner: Vec3,
        goalBlock: Vec3,
        sprint: boolean,
        ticks = 20,
        state?: PlayerState,
        bot?: Bot,
        particles: boolean = false
    ): Promise<PlayerState> {
        state ??= new PlayerState(this.physics, this.bot, ControlStateHandler.COPY_BOT(this.bot));
        let jump = false;
        let changed = false;
        return this.simulateUntil(
            this.getReached(goalCorner),
            this.getCleanupPosition(),
            this.buildFullController(
                this.getControllerStraightAim(goalCorner),
                this.getControllerStrafeAim(goalCorner),
                this.getControllerSmartMovement(goalCorner, sprint),
                (state: PlayerState, ticks: number) => {
                    state.controlState.sneak = false;
                    // check if player is leaving src block collision
                    const playerBB = state.getAABB();
                    playerBB.expand(0, 1e-1, 0);
                    if (jump && state.position.xzDistanceTo(goalCorner) < 0.5 && !changed) {
                        goalCorner.set(goalBlock.x + 0.5, goalBlock.y + 1, goalBlock.z + 0.5);
                        changed = true;
                    }

                    if (ticks > 1 && srcAABBs.every((src) => !src.intersects(playerBB)) && !jump) {
                        state.controlState.set("jump", true, ticks)
                        jump = true;
                    } else {
                        state.controlState.set("jump", false, ticks)
                    }
                }
            ),
            ticks,
            state,
            bot,
            particles
        );
    }

    getReached(...path: Vec3[]): SimulationGoal {
        return (state: PlayerState) => {
            const delta = path[0].minus(state.position);
            // console.log(path[0], state.position, Math.abs(delta.x) <= 0.35, Math.abs(delta.z) <= 0.35, Math.abs(delta.y) < 1)
            return Math.abs(delta.x) <= 0.35 && Math.abs(delta.z) <= 0.35 && Math.abs(delta.y) < 1 && (state.onGround || state.isInWater);
            // return (delta.x >= -0.35 && delta.x <= 0.35) && (delta.z >= -0.35 && delta.z <= 0.35)&& (delta.y >= -1 && delta.y <= 1) && (state.onGround || state.isInWater);
        };
    }

    getCleanupPosition(): OnGoalReachFunction {
        return (state: PlayerState) => {
            state.clearControlStates();
            // console.log("made it");
            // state.position = path[0];
            // state.velocity.x = 0
            // state.velocity.z = 0
        };
    }

    getControllerStraightAim(nextPoint: Vec3): Controller {
        return (state: PlayerState, ticks: number) => {
            const dx = nextPoint.x - state.position.x;
            const dz = nextPoint.z - state.position.z;
            state.yaw = Math.atan2(-dx, -dz);
        };
    }

    // right should be positiive,
    // left should be negative.
    getControllerStrafeAim(nextPoint: Vec3): Controller {
        return (state: PlayerState, ticks: number) => {
            const offset = state.position.plus(state.onGround ? state.velocity : state.velocity.scaled(2));
            const dx = nextPoint.x - offset.x;
            const dz = nextPoint.z - offset.z;
            const wantedYaw = wrapDegrees(Math.atan2(-dx, -dz));
            const diff = wrapDegrees(wantedYaw - state.yaw);
            // console.log("wantedYaw:", wantedYaw);
            // console.log("diff:", diff);
            // if (goalDist > 0.4) {
            if (PI_OVER_TWELVE < diff && diff < ELEVEN_PI_OVER_TWELVE) {
                state.controlState.left = true; // are these reversed? tf
                state.controlState.right = false;
                // console.log("right");
            } else if (THIRTEEN_PI_OVER_TWELVE < diff && diff < TWENTY_THREE_PI_OVER_TWELVE) {
                state.controlState.left = false;
                state.controlState.right = true;

                // console.log("left");
            } else {
                // console.log("rotate neither, left:", state.control.movements.left, "right:", state.control.movements.right);
                state.controlState.left = false;
                state.controlState.right = false;
            }
            // } else {
            //     state.control.movements.left = false;
            //     state.control.movements.right = false;
            //     // console.log("rotate neither");
            // }
        };
    }

    getControllerJumpSprint(jump: boolean, sprint: boolean, jumpAfter = 0): Controller {
        return (state: PlayerState, ticks: number) => {
            state.controlState.jump = jump && ticks >= jumpAfter;
            state.controlState.sprint = sprint;
        };
    }

    // forward should be any value that abs. val to below pi / 2
    // backward is any value that abs. val to above pi / 2
    getControllerSmartMovement(goal: Vec3, sprint: boolean): Controller {
        return (state: PlayerState, ticks: number) => {
            const offset = state.position.plus(state.onGround ? state.velocity : state.velocity.scaled(2));
            const dx = goal.x - offset.x;
            const dz = goal.z - offset.z;
            const wantedYaw = wrapDegrees(Math.atan2(-dx, -dz));
            const diff = wrapDegrees(wantedYaw - state.yaw);
            // console.log("diff:", diff, wantedYaw, state.yaw);
            // if (goalDist > 0.4) {
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
                // console.log("forward");
            } else {
                state.controlState.forward = false;
                state.controlState.back = false;
                state.controlState.sprint = false;
                // console.log("neither");
            }
            // else {
            //     state.control.movements.forward = false;
            //     state.control.movements.sprint = false;
            //     state.control.movements.back = false;
            //     console.log("movement neither");
            // }
            // } else {
            //     state.control.movements.forward = false;
            //     state.control.movements.sprint = false;
            //     state.control.movements.back = false;
            //     // console.log("movement neither");
            // }
        };
    }

    buildFullController(...controllers: Controller[]): Controller {
        return (state: PlayerState, ticks: number) => {
            controllers.forEach((control) => control(state, ticks));
        };
    }
}

// canStraightLine (path: Vec3[], sprint = false) {
//   const reached = this.getReached(path)
//   const state = this.simulateUntil(reached, this.getController(path[0], false, sprint), 200)
//   if (reached(state)) return true

//   if (sprint) {
//     if (this.canSprintJump(path, 0)) return false
//   } else {
//     if (this.canWalkJump(path, 0)) return false
//   }

//   for (let i = 1; i < 7; i++) {
//     if (sprint) {
//       if (this.canSprintJump(path, i)) return true
//     } else {
//       if (this.canWalkJump(path, i)) return true
//     }
//   }
//   return false
// }

// canStraightLineBetween (n1: Vec3, n2: Vec3) {
//   const reached = (state: PlayerState) => {
//     const delta = n2.minus(state.position)
//     const r2 = 0.15 * 0.15
//     return (delta.x * delta.x + delta.z * delta.z) <= r2 && Math.abs(delta.y) < 0.001 && (state.onGround || state.isInWater)
//   }

//   const state = new PlayerState(this.physics, this.bot, PlayerControls.COPY(this.bot))
//   state.position.update(n1)
//   this.simulateUntil(reached, this.getController(n2, false, true), Math.floor(5 * n1.distanceTo(n2)), state)
//   return reached(state)
// }

// canSprintJump (path: Vec3[], jumpAfter = 0) {
//   const reached = this.getReached(path)
//   const state = this.simulateUntil(reached, this.getController(path[0], true, true, jumpAfter), 20)
//   return reached(state)
// }

// canWalkJump (path: Vec3[], jumpAfter = 0) {
//   const reached = this.getReached(path)
//   const state = this.simulateUntil(reached, this.getController(path[0], true, false, jumpAfter), 20)
//   return reached(state)
// }
