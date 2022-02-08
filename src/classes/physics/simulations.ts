import { AABB, MathUtils } from "@nxg-org/mineflayer-util-plugin";
import { stat } from "fs/promises";
import { Bot } from "mineflayer";
import { promisify } from "util";
import { Vec3 } from "vec3";
import { MovementData } from "../movement/movementData";
import { PathNode } from "../nodes/node";
import { PlayerControls } from "../player/playerControls";
import { Physics } from "./physics";
import { PlayerState } from "./playerState";

type SimulationGoal = (state: PlayerState) => boolean;
type Controller = (...any: any[]) => void;

const sleep = promisify(setTimeout);
export class Simulations {
    public world: any; /*prismarine-world*/
    public predictiveWorld;

    constructor(public bot: Bot, public physics: Physics) {
        this.predictiveWorld = this.bot.util.predict.world;
    }

    async simulateUntil(goal: SimulationGoal, controller: Controller, ticks = 1, state?: PlayerState, bot?: Bot): Promise<PlayerState> {
        if (!state) {
            state = new PlayerState(this.physics, this.bot, PlayerControls.DEFAULT());
        }

        for (let i = 0; i < ticks; i++) {
            controller(state, i);
            this.physics.simulatePlayer(state);
            if (state.isInLava) return state;
            if (goal(state)) return state;
            await sleep(50);
            if (bot) {
                state.apply(bot);
                console.log(bot.controlState)
            }
        }

        return state;
    }

    async simulateUntilNextTick(state?: PlayerState): Promise<PlayerState> {
        return await this.simulateUntil(
            () => false,
            () => {},
            1,
            state
        );
    }

    async simulateUntilOnGround(ticks = 5): Promise<PlayerState> {
        return await this.simulateUntil(
            (state) => state.onGround,
            () => {},
            ticks
        );
    }

    simulateData(data: MovementData, ticks = 20) {
        return this.simulateUntil(
            (state) => state.onGround,
            (state: PlayerState, ticks: number) => {
                const tmp = data.inputStatesAndTimes[ticks + data.minInputTime];
                if (tmp) {
                    state.control.movements = tmp.movements;
                }
            },
            ticks
        );
    }

    simulateSmartAim(bot: Bot, goal: Vec3, jump: boolean, sprint: boolean, jumpAfter = 0, ticks = 20) {
        return this.simulateUntil(
            this.getReached(goal),
            this.buildFullController(this.getControllerStrafeAim(goal), this.getControllerSmartMovement(goal, jump, sprint, jumpAfter)),
            ticks,
            undefined,
            bot
        );
    }

    async simulateJumpFromEdgeOfBlock(bot: Bot, src: AABB, goal: Vec3, sprint: boolean, strafe = false, ticks = 20) {
        const aim = strafe ? this.getControllerStrafeAim(goal) : this.getControllerStraightAim(goal);
        const move = this.getControllerSmartMovement(goal, false, sprint, 0);
        let jump = false;
        this.simulateUntil(
            (state) => false,
            //this.getReached(goal),
            this.buildFullController(aim, (state: PlayerState, ticks: number) => {
                move(state, ticks);

                // check if player is leaving src block collision
                const playerBB = state.getAABB();
                // playerBB.expand(1e-3, 1e-3, 1e-3);
                if (
                    // state.position.floored().translate(0, -1, 0).equals(new Vec3(src.minX, src.minY, src.minZ)) &&
                    !src.intersects(playerBB.offset(state.velocity.x, state.velocity.y, state.velocity.z)) &&
                    !jump
                ) {
                    state.control.movements.jump = true;
                    jump = true;
                } else {
                    state.control.movements.jump = false;
                }
            }),
            ticks
        );
    }

    getReached(...path: Vec3[]) {
        return (state: PlayerState) => {
            const delta = path[0].minus(state.position);
            return Math.abs(delta.x) <= 0.35 && Math.abs(delta.z) <= 0.35 && Math.abs(delta.y) < 1;
        };
    }

    getControllerStraightAim(nextPoint: Vec3) {
        return (state: PlayerState, ticks: number) => {
            const dx = nextPoint.x - state.position.x;
            const dz = nextPoint.z - state.position.z;
            state.yaw = Math.atan2(-dx, -dz);
        };
    }

    getControllerStrafeAim(nextPoint: Vec3) {
        return (state: PlayerState, ticks: number) => {
            const dx = nextPoint.x - state.position.x;
            const dz = nextPoint.z - state.position.z;
            let wantedYaw = Math.atan2(-dx, -dz);
            if (wantedYaw < 0) wantedYaw = wantedYaw + 2 * Math.PI;
            const diff = wantedYaw - state.yaw 
            const goalDist = state.position.xzDistanceTo(nextPoint);
            console.log("wantedYaw:", wantedYaw);
            console.log("diff:", diff)
            if (goalDist > 0.5) {
                if (diff <= -(1 * Math.PI) / 12) {
                    state.control.movements.left = false;
                    state.control.movements.right = true;
                    console.log("right");
                } else if (diff > (1 * Math.PI) / 12) {
                    state.control.movements.left = true; // are these reversed? tf
                    state.control.movements.right = false;
                    console.log("left");
                } else {
                    state.control.movements.left = false;
                    state.control.movements.right = false;
                    console.log("rotate neither");
                }
            } else {
                state.control.movements.left = false;
                state.control.movements.right = false;
                console.log("rotate neither");
            }
        };
    }

    getControllerMovement(jump: boolean, sprint: boolean, jumpAfter = 0) {
        return (state: PlayerState, ticks: number) => {
            state.control.movements.forward = true;
            state.control.movements.jump = jump && ticks >= jumpAfter;
            state.control.movements.sprint = sprint;
        };
    }

    getControllerSmartMovement(goal: Vec3, jump: boolean, sprint: boolean, jumpAfter = 0) {
        return (state: PlayerState, ticks: number) => {
            const dx = goal.x - state.position.x;
            const dz = goal.z - state.position.z;
            let wantedYaw = Math.atan2(-dx, -dz);
            if (wantedYaw < 0) wantedYaw = wantedYaw + 2 * Math.PI;
            const diff = wantedYaw - state.yaw 
            const goalDist = state.position.xzDistanceTo(goal);
            console.log("diff:", diff, wantedYaw, state.yaw);
            if (goalDist > 0.4) {
                if (Math.abs(diff) <= Math.PI / 2) {
                    state.control.movements.forward = true;
                    state.control.movements.sprint = sprint;
                    state.control.movements.back = false;
                    console.log("forward");
                } else if (Math.abs(diff) > Math.PI / 2) {
                    state.control.movements.forward = false;
                    state.control.movements.sprint = false;
                    state.control.movements.back = true;
                    console.log("back");
                } else {
                    state.control.movements.forward = false;
                    state.control.movements.sprint = false;
                    state.control.movements.back = false;
                    console.log("movement neither");
                }
            } else {
                state.control.movements.forward = false;
                state.control.movements.sprint = false;
                state.control.movements.back = false;
                console.log("movement neither");
            }

            state.control.movements.jump = jump && ticks >= jumpAfter;
        };
    }

    buildFullController(aim: Controller, move: Controller) {
        return (state: PlayerState, ticks: number) => {
            aim(state, ticks);
            move(state, ticks);
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
