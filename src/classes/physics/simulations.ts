import { stat } from "fs/promises";
import { Bot } from "mineflayer";
import { Vec3 } from "vec3";
import { MovementData } from "../movement/movementData";
import { PathNode } from "../nodes/node";
import { PlayerControls } from "../player/playerControls";
import { Physics } from "./physics";
import { PlayerState } from "./playerState";

type SimulationGoal = (state: PlayerState) => boolean;
type Controller = (...any: any[]) => void;

export class Simulations {
    public world: any; /*prismarine-world*/
    public predictiveWorld;

    constructor(public bot: Bot, public physics: Physics) {
        this.predictiveWorld = this.bot.util.predict.world;
    }

    simulateUntil(goal: SimulationGoal, controller: Controller, ticks = 1, state?: PlayerState): PlayerState {
        if (!state) {
            state = new PlayerState(this.physics, this.bot, PlayerControls.DEFAULT());
        }

        for (let i = 0; i < ticks; i++) {
            controller(state, i);
            this.physics.simulatePlayer(state);
            if (state.isInLava) return state;
            if (goal(state)) return state;
        }

        return state;
    }

    simulateUntilNextTick(): PlayerState {
        return this.simulateUntil(
            () => false,
            () => {},
            1
        );
    }

    simulateUntilOnGround(ticks = 5): PlayerState {
        return this.simulateUntil(
            (state) => state.onGround,
            () => {},
            ticks
        );
    }

    simulateAdvancedJump(data: MovementData, ticks = 20) {
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

    getReached(path: Vec3[]) {
        return (state: PlayerState) => {
            const delta = path[0].minus(state.position);
            return Math.abs(delta.x) <= 0.35 && Math.abs(delta.z) <= 0.35 && Math.abs(delta.y) < 1;
        };
    }

    getController(nextPoint: Vec3, jump: boolean, sprint: boolean, jumpAfter = 0) {
        return (state: PlayerState, tick: number) => {
            const dx = nextPoint.x - state.position.x;
            const dz = nextPoint.z - state.position.z;
            state.yaw = Math.atan2(-dx, -dz);

            state.control.movements.forward = true;
            state.control.movements.jump = jump && tick >= jumpAfter;
            state.control.movements.sprint = sprint;
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
