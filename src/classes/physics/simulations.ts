import { AABB, MathUtils } from "@nxg-org/mineflayer-util-plugin";
import { stat } from "fs/promises";
import { Bot } from "mineflayer";
import { Block } from "prismarine-block";
import { promisify } from "util";
import { Vec3 } from "vec3";
import { MovementData } from "../movement/movementData";
import { PathNode } from "../nodes/node";
import { PlayerControls } from "../player/playerControls";
import { Physics } from "./physics";
import { getBetweenRectangle } from "./physicsUtils";
import { PlayerState } from "./playerState";

type SimulationGoal = (state: PlayerState) => boolean;
type OnGoalReachFunction = (state: PlayerState) => void;
type Controller = (...any: any[]) => void;

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
            state = new PlayerState(this.physics, this.bot, PlayerControls.COPY_BOT(this.bot));
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
            if (particles) {
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

    simulateData(data: MovementData, ticks = 20, state?: PlayerState): Promise<PlayerState> {
        return this.simulateUntil(
            (state) => state.onGround,
            () => {},
            (state: PlayerState, ticks: number) => {
                const tmp = data.inputStatesAndTimes[ticks + data.minInputTime];
                if (tmp) {
                    state.control.movements = tmp.movements;
                }
            },
            ticks,
            state
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
            this.getCleanupPosition(goal),
            this.buildFullController(
                this.getControllerStraightAim(goal),
                this.getControllerStrafeAim(goal),
                this.getControllerSmartMovement(goal, sprint),
                this.getControllerJumpSprint(jump, sprint, jumpAfter),
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
        particles: boolean = true
    ): Promise<PlayerState> {
        const aim = strafe ? this.getControllerStrafeAim(goal) : this.getControllerStraightAim(goal);
        state ??= new PlayerState(this.physics, this.bot, PlayerControls.COPY_BOT(this.bot));

        return this.simulateUntil(
            (state) => {
                const playerBB = state.getAABB();
                playerBB.expand(0, 1e-1, 0);
                return (
                    (state.sneakCollision || srcAABBs.every((src) => !src.intersects(playerBB))) && state.position.xzDistanceTo(goal) < 0.1
                );
            },
            this.getCleanupPosition(goal),
            this.buildFullController(aim, this.getControllerSmartMovement(goal, sprint), (state: PlayerState, ticks: number) => {
                state.control.movements.sneak = true;
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
        goalBlock: Block,
        sprint: boolean,
        ticks = 20,
        state?: PlayerState,
        bot?: Bot,
        particles: boolean = false
    ): Promise<PlayerState> {
        state ??= new PlayerState(this.physics, this.bot, PlayerControls.COPY_BOT(this.bot));
        let jump = false;
        let changed = false;
        return this.simulateUntil(
            this.getReached(goalCorner),
            this.getCleanupPosition(goalCorner),
            this.buildFullController(
                this.getControllerStraightAim(goalCorner),
                this.getControllerStrafeAim(goalCorner),
                this.getControllerSmartMovement(goalCorner, sprint),
                (state: PlayerState, ticks: number) => {
                    state.control.movements.sneak = false;
                    // check if player is leaving src block collision
                    const playerBB = state.getAABB();
                    playerBB.expand(0, 1e-1, 0);

                    if (jump && state.position.xzDistanceTo(goalCorner) < 0.5 && !changed) {
                        changed = true;
                        goalCorner.set(goalBlock.position.x + 0.5, goalBlock.position.y + 1, goalBlock.position.z + 0.5);
                        // console.log(goalCorner);
                    }

                    if (ticks > 1 && srcAABBs.every((src) => !src.intersects(playerBB)) && !jump) {
                        state.control.movements.jump = true;
                        jump = true;
                    } else {
                        state.control.movements.jump = false;
                    }
                },
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
        };
    }

    getCleanupPosition(...path: Vec3[]): OnGoalReachFunction {
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
            let wantedYaw = Math.atan2(-dx, -dz);
            if (wantedYaw < 0) wantedYaw = wantedYaw + 2 * Math.PI;
            let diff = state.yaw - wantedYaw;
            if (diff < 0) diff = diff + 2 * Math.PI;
            // console.log("wantedYaw:", wantedYaw);
            // console.log("diff:", diff);
            // if (goalDist > 0.4) {
            if ((1 * Math.PI) / 12 < diff && diff < (11 * Math.PI) / 12) {
                state.control.movements.left = false;
                state.control.movements.right = true;
                // console.log("right");
            } else if ((13 * Math.PI) / 12 < diff && diff < (23 * Math.PI) / 12) {
                state.control.movements.left = true; // are these reversed? tf
                state.control.movements.right = false;
                // console.log("left");
            } else {
                // console.log("rotate neither, left:", state.control.movements.left, "right:", state.control.movements.right);
                state.control.movements.left = false;
                state.control.movements.right = false;
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
            state.control.movements.jump = jump && ticks >= jumpAfter;
            state.control.movements.sprint = sprint;
        };
    }

    // forward should be any value that abs. val to below pi / 2
    // backward is any value that abs. val to above pi / 2
    getControllerSmartMovement(goal: Vec3, sprint: boolean): Controller {
        return (state: PlayerState, ticks: number) => {
            const offset = state.position.plus(state.onGround ? state.velocity : state.velocity.scaled(2));
            const dx = goal.x - offset.x;
            const dz = goal.z - offset.z;
            let wantedYaw = Math.atan2(-dx, -dz);
            if (wantedYaw < 0) wantedYaw = wantedYaw + 2 * Math.PI;
            let diff = wantedYaw - state.yaw;
            if (diff < 0) diff = diff + 2 * Math.PI;
            // console.log("diff:", diff, wantedYaw, state.yaw);
            // if (goalDist > 0.4) {
            if ((5 * Math.PI) / 12 < diff && diff < (17 * Math.PI) / 12) {
                state.control.movements.forward = false;
                state.control.movements.sprint = false;
                state.control.movements.back = true;
                // console.log("back");
                //if (((6 * Math.PI) / 12 < diff && diff < (16 * Math.PI) / 12 ))
            } else if ((19 * Math.PI) / 12 < diff || diff < (6 * Math.PI) / 12) {
                state.control.movements.forward = true;
                state.control.movements.sprint = sprint;
                state.control.movements.back = false;
                // console.log("forward");
            } else {
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
