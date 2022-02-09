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
        bot?: Bot
    ): Promise<PlayerState> {
        if (!state) {
            state = new PlayerState(this.physics, this.bot, PlayerControls.DEFAULT());
        }

        for (let i = 0; i < ticks; i++) {
            controller(state, i);
            this.physics.simulatePlayer(state);
            if (bot) {
                state.apply(bot)
                await bot.waitForTicks(1);
            }
            if (state.isInLava) return state;
            if (goal(state)) {
                onGoalReach(state);
                return state;
            }
            
        
            
        }

        return state;
    }

    async simulateUntilNextTick(state?: PlayerState): Promise<PlayerState> {
        return await this.simulateUntil(
            () => false,
            () => {},
            () => {},
            1,
            state
        );
    }

    async simulateUntilOnGround(ticks = 5): Promise<PlayerState> {
        return await this.simulateUntil(
            (state) => state.onGround,
            () => {},
            () => {},
            ticks
        );
    }

    simulateData(data: MovementData, ticks = 20) {
        return this.simulateUntil(
            (state) => state.onGround,
            () => {},
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
            () => {},
            this.buildFullController(this.getControllerStrafeAim(goal), this.getControllerSmartMovement(goal, sprint)),
            ticks,
            undefined,
            bot
        );
    }

    async simulateBackUpBeforeJump(
        bot: Bot,
        srcAABBs: AABB[],
        goal: Vec3,
        sprint: boolean,
        strafe = true,
        ticks = 20,
        state?: PlayerState
    ) {
        const aim = strafe ? this.getControllerStrafeAim(goal) : this.getControllerStraightAim(goal);
        state ??= new PlayerState(this.physics, this.bot, PlayerControls.DEFAULT());
        const goalAABB = AABB.fromBlock(goal);

        const realGoalDir = goalAABB.getCenter().minus(state.position).normalize(); //playerState.position.minus(goalAABB.getCenter()).normalize();
        realGoalDir.y = 0; // want only x and z, get best 2D direction away from goal.
        let realGoal = srcAABBs
            .map((aabb) => aabb.intersectsRay(state!.position.offset(0, -0.5, 0), realGoalDir))
            .filter((i) => !!i)
            .sort((a, b) => goalAABB.distanceToVec(b!) - goalAABB.distanceToVec(a!))[0];

        if (!realGoal) realGoal = srcAABBs.sort((a, b) => b.distanceToVec(goal) - a.distanceToVec(goal))[0].getCenter();
        let lastVelocity = state.velocity.clone();
        let still = 0;

        return await this.simulateUntil(
            (state) => {
                const playerBB = state.getAABB();

                // playerBB.contract(1e-3, -1e-3, 1e-3);
                //srcAABBs.every(src => !AABB.fromBlock(state.position.floored().offset(0, -1, 0)).equals(src))

                return still > 1 || srcAABBs.every((src) => !src.intersects(playerBB.offset(state.velocity.x, state.velocity.y, state.velocity.z)));
            },
            this.getCleanupPosition(realGoal),
            this.buildFullController(aim, (state: PlayerState, ticks: number) => {
                // move(state, ticks);
                state.control.movements.forward = false;
                state.control.movements.sprint = false;
                state.control.movements.back = true;
                state.control.movements.sneak = true;


                if (state.sneakCollision) {
                    still++
                }
                // const test = lastVelocity.subtract(state.velocity).abs();
                // lastVelocity = state.velocity.clone();
                // if (test.x < 0.001 && test.z < 0.001) {
                //     still++;
                // }

                // check if player is leaving src block collision
            }),
            ticks,
            state,
            bot
        );
    }

    async simulateJumpFromEdgeOfBlock(
        bot: Bot,
        srcAABBs: AABB[],
        goal: Vec3,
        sprint: boolean,
        strafe = false,
        ticks = 20,
        state?: PlayerState
    ) {
        const aim = strafe ? this.getControllerStrafeAim(goal) : this.getControllerStraightAim(goal);
        state ??= new PlayerState(this.physics, this.bot, PlayerControls.DEFAULT());
        const move = this.getControllerSmartMovement(goal, sprint);
        console.log(srcAABBs.length)
        let jump = false;
        await this.simulateUntil(
            this.getReached(goal),
            this.getCleanupPosition(goal),
            this.buildFullController(aim, (state: PlayerState, ticks: number) => {
                move(state, ticks);
                // check if player is leaving src block collision
                const playerBB = state.getAABB();
                if (ticks > 1 && srcAABBs.every((src) => !src.intersects(playerBB.offset(0, state.velocity.y, 0))) && !jump) {
                    state.control.movements.jump = true;
                    jump = true;
                } else {
                    state.control.movements.jump = false;
                }
            }),
            ticks,
            state,
            bot
        );
    }

    getReached(...path: Vec3[]) {
        return (state: PlayerState) => {
            const delta = path[0].minus(state.position);
            // console.log(path[0], state.position, Math.abs(delta.x) <= 0.35, Math.abs(delta.z) <= 0.35, Math.abs(delta.y) < 1)
            return Math.abs(delta.x) <= 0.35 && Math.abs(delta.z) <= 0.35 && Math.abs(delta.y) < 1;
        };
    }

    getCleanupPosition(...path: Vec3[]) {
        return (state: PlayerState) => {
            state.clearControlStates();
            // console.log("sup")
            // state.position = path[0];
            // state.velocity.x = 0
            // state.velocity.z = 0
        };
    }

    getControllerStraightAim(nextPoint: Vec3) {
        return (state: PlayerState, ticks: number) => {
            const dx = nextPoint.x - state.position.x;
            const dz = nextPoint.z - state.position.z;
            state.yaw = Math.atan2(-dx, -dz);
        };
    }

    // right should be positiive,
    // left should be negative.
    getControllerStrafeAim(nextPoint: Vec3) {
        return (state: PlayerState, ticks: number) => {
            const offset = state.position.plus(state.onGround ? state.velocity : state.velocity.scaled(3))
            const dx = nextPoint.x - offset.x;
            const dz = nextPoint.z - offset.z;
            let wantedYaw = Math.atan2(-dx, -dz);
            if (wantedYaw < 0) wantedYaw = wantedYaw + 2 * Math.PI;
            let diff = state.yaw - wantedYaw;
            if (diff < 0) diff = diff + 2 * Math.PI;
            const goalDist = state.position.xzDistanceTo(nextPoint);
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
                state.control.movements.left = false;
                state.control.movements.right = false;
                // console.log("rotate neither");
            }
            // } else {
            //     state.control.movements.left = false;
            //     state.control.movements.right = false;
            //     // console.log("rotate neither");
            // }
        };
    }

    getControllerMovement(jump: boolean, sprint: boolean, jumpAfter = 0) {
        return (state: PlayerState, ticks: number) => {
            state.control.movements.forward = true;
            state.control.movements.jump = jump && ticks >= jumpAfter;
            state.control.movements.sprint = sprint;
        };
    }

    // forward should be any value that abs. val to below pi / 2
    // backward is any value that abs. val to above pi / 2
    getControllerSmartMovement(goal: Vec3, sprint: boolean) {
        return (state: PlayerState, ticks: number) => {
            const offset = state.position.plus(state.onGround ? state.velocity : state.velocity.scaled(4))
            const dx = goal.x - offset.x;
            const dz = goal.z - offset.z;
            let wantedYaw = Math.atan2(-dx, -dz);
            if (wantedYaw < 0) wantedYaw = wantedYaw + 2 * Math.PI;
            let diff = wantedYaw - state.yaw;
            if (diff < 0) diff = diff + 2 * Math.PI;
            const goalDist = state.position.xzDistanceTo(goal);
            // console.log("diff:", diff, wantedYaw, state.yaw);
            // if (goalDist > 0.4) {
            if ((5 * Math.PI) / 12 < diff && diff < (17 * Math.PI) / 12) {
                state.control.movements.forward = false;
                state.control.movements.sprint = false;
                state.control.movements.back = true;
                console.log("back");
                //if (((6 * Math.PI) / 12 < diff && diff < (16 * Math.PI) / 12 ))
            } else if ((19 * Math.PI) / 12 < diff || diff < (6 * Math.PI) / 12) {
                state.control.movements.forward = true;
                state.control.movements.sprint = sprint;
                state.control.movements.back = false;
                console.log("forward");
            } else {
                console.log("neither")
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
