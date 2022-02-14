import { Vec3 } from "vec3";
import { MovementStatus } from "./movementStatus";
import { MathUtils } from "@nxg-org/mineflayer-util-plugin";
import { Bot, ControlState } from "mineflayer";
import { ControlStateHandler, PlayerControls } from "../player/playerControls";
import { MAX_COST } from "../../utils/constants";
import { PlayerState } from "../physics/playerState";

type ControlsIndexedByTick = { [tick: number]: ControlStateHandler };
type TargetsIndexedByTick = { [tick: number]: MovementTarget };

export class MovementTarget {
    public yaw: number;
    public pitch: number;
    public forceRotations: boolean;

    constructor(yaw: number, pitch: number, forceRotations: boolean) {
        this.yaw = yaw;
        this.pitch = pitch;
        this.forceRotations = forceRotations;
    }

    public static fromDest(src: Vec3, dest: Vec3, forceRotations: boolean) {
        const dir = dest.minus(src);
        const yaw = Math.atan2(-dir.x, -dir.z);
        const groundDistance = Math.sqrt(dir.x * dir.x + dir.z * dir.z);
        const pitch = Math.atan2(dir.y, groundDistance);
        return new MovementTarget(yaw, pitch, forceRotations);
    }

    public static fromDir(vec: Vec3, forceRotations: boolean) {
        const info = MathUtils.dirToYawAndPitch(vec);
        return new MovementTarget(info.yaw, info.pitch, forceRotations);
    }

    public static DEFAULT() {
        return new MovementTarget(NaN, NaN, false);
    }
}

export class MovementData {
    public readonly heuristicCost: number;
    public readonly targetsByTicks: TargetsIndexedByTick;
    public readonly inputStatesAndTimes: ControlsIndexedByTick;

    //May remove this.
    public maxInputTime: number;
    public maxInputOffset: number;
    public readonly minInputTime: number;

    constructor(
        heuristicCost: number,
        minInputTime: number,
        targetsByTicks: TargetsIndexedByTick,
        inputStatesAndTimes: ControlsIndexedByTick
    ) {
        this.heuristicCost = heuristicCost;
        this.targetsByTicks = targetsByTicks;
        this.inputStatesAndTimes = inputStatesAndTimes;
        this.minInputTime = minInputTime;
        this.maxInputTime = minInputTime;
        this.maxInputOffset = 0;
    }

    public static DEFAULT(startTick: number) {
        return new MovementData(MAX_COST, startTick, {}, {});
    }

    public static DEFAULT_FROM_STATE(state: PlayerState, startTick: number) {
        const tmp: ControlsIndexedByTick = {};
        tmp[startTick] = state.controlState;
        return new MovementData(MAX_COST, startTick, {}, tmp);
    }

    public length() {
        return this.maxInputTime - this.minInputTime
    }

    /**
     * May be more efficient with a different configuration, look into this later.
     * @param tickCount
     * @param controlState
     * @param state
     */
    setInput(tickCountOffset: number, controlState: ControlState, state: boolean) {
        const tickCount = tickCountOffset + this.minInputTime;
        if (tickCount > this.maxInputTime) {
            this.maxInputTime = tickCount;
            this.maxInputOffset = tickCountOffset
        }
        this.inputStatesAndTimes[tickCount] ??= ControlStateHandler.DEFAULT();
        this.inputStatesAndTimes[tickCount][controlState] = state;
    }

    setInputRaw(tickCount: number, controlState: ControlState, state: boolean) {
        if (tickCount > this.maxInputTime) {
            this.maxInputTime = tickCount;
            this.maxInputOffset = tickCount - this.maxInputTime;
        }
        this.inputStatesAndTimes[tickCount] ??= ControlStateHandler.DEFAULT();
        this.inputStatesAndTimes[tickCount][controlState] = state;
    }

    setInputs(tickCountOffset: number, controls: ControlStateHandler) {
        const tickCount = tickCountOffset + this.minInputTime;
        if (tickCount > this.maxInputTime) {
            this.maxInputTime = tickCount;
            this.maxInputOffset = tickCountOffset
        }
        this.inputStatesAndTimes[tickCount] = controls;

    }

    setInputsRaw(tickCount: number, controls: ControlStateHandler) {
        if (tickCount > this.maxInputTime) {
            this.maxInputTime = tickCount;
            this.maxInputOffset = tickCount - this.maxInputTime;
        }
        this.inputStatesAndTimes[tickCount] = controls;

    }


    /**
     * The ticks for set are OFFSETS, not a raw value.
     * @param tickCountOffset
     * @param sets
     */
    setInputsMultipleTicks(sets: ControlsIndexedByTick) {
        for (const key in sets) {
            const tmp = Number(key)
            const tickCount = tmp + this.minInputTime;
            if (tickCount > this.maxInputTime) {
                this.maxInputTime = tickCount;
                this.maxInputOffset = tmp
            }
            this.inputStatesAndTimes[tickCount] = sets[key];
        }
    }

    setInputsMultipleTicksRaw(sets: ControlsIndexedByTick) {
        for (const key in sets) {
            const tickCount = Number(key);
            if (tickCount > this.maxInputTime) {
                this.maxInputTime = tickCount;
                this.maxInputOffset = tickCount - this.maxInputTime;
            }
            this.inputStatesAndTimes[tickCount] = sets[key];
        }
    }

    clearInput(tickCountOffset: number, controlState: ControlState) {
        const tickCount = tickCountOffset + this.minInputTime;
        this.inputStatesAndTimes[tickCount][controlState] = false
    }

    clearInputRaw(tickCount: number, controlState: ControlState) {
        this.inputStatesAndTimes[tickCount][controlState] = false
    }

    clearInputs(tickOffsets: number[]) {
        for (const tickOffset of tickOffsets) {
            const tickCount = tickOffset + this.minInputTime;
            delete this.inputStatesAndTimes[tickCount];
        }
    }

    clearInputsRaw(tickCounts: number[]) {
        for (const tickCount of tickCounts) {
            delete this.inputStatesAndTimes[tickCount];
        }
    }

    setTarget(tickCountOffset: number, yaw: number, pitch: number, forceRotations: boolean) {
        const tickCount = tickCountOffset + this.minInputTime;
        if (tickCount > this.maxInputTime) {
            this.maxInputTime = tickCount;
            this.maxInputOffset = tickCountOffset
        }
        this.targetsByTicks[tickCount] = new MovementTarget(yaw, pitch, forceRotations);
    }

    setTargetDest(tickCountOffset: number, src: Vec3, dest: Vec3, forceRotations: boolean) {
        const tickCount = tickCountOffset + this.minInputTime;
        if (tickCount > this.maxInputTime) {
            this.maxInputTime = tickCount;
            this.maxInputOffset = tickCountOffset
        }
        this.targetsByTicks[tickCount] = MovementTarget.fromDest(src, dest, forceRotations);
    }
    /**
     * May be more efficient with a different configuration, look into this later.
     * @param tickCount
     * @param controlState
     * @param state
     */
    setTargetDir(tickCountOffset: number, dir: Vec3, forceRotations: boolean) {
        const tickCount = tickCountOffset + this.minInputTime;
        if (tickCount > this.maxInputTime) {
            this.maxInputTime = tickCount;
            this.maxInputOffset = tickCountOffset
        }
        this.targetsByTicks[tickCount] = MovementTarget.fromDir(dir, forceRotations);
    }

    setTargetRaw(tickCount: number, yaw: number, pitch: number, forceRotations: boolean) {
        if (tickCount > this.maxInputTime) {
            this.maxInputTime = tickCount;
            this.maxInputOffset = tickCount - this.maxInputTime;
        }
        this.targetsByTicks[tickCount] = new MovementTarget(yaw, pitch, forceRotations);
    }

    /**
     * The ticks for set are OFFSETS, not a raw value.
     * @param tickCountOffset
     * @param sets
     */
    setTargets(sets: TargetsIndexedByTick) {
        for (const key in sets) {
            const tmp = Number(key)
            const tickCount = tmp + this.minInputTime;
            if (tickCount > this.maxInputTime) {
                this.maxInputTime = tickCount;
                this.maxInputOffset = tmp
            }
            this.targetsByTicks[tickCount] = sets[key];
        }
    }

    setTargetsRaw(sets: TargetsIndexedByTick) {
        for (const key in sets) {
            const tickCount = Number(key);
            if (tickCount > this.maxInputTime) {
                this.maxInputTime = tickCount;
                this.maxInputOffset = tickCount - this.maxInputTime;
            }
            this.targetsByTicks[tickCount] = sets[key];
        }
    }

    clearTarget(tickCountOffset: number) {
        const tickCount = tickCountOffset + this.minInputTime;
        delete this.targetsByTicks[tickCount];
    }

    clearTargetRaw(tickCount: number) {
        delete this.targetsByTicks[tickCount];
    }

    clearTargets(tickOffsets: number[]) {
        for (const tickOffset of tickOffsets) {
            const tickCount = tickOffset + this.minInputTime;
            delete this.targetsByTicks[tickCount];
        }
    }

    clearTargetsRaw(tickCounts: number[]) {
        for (const tickCount of tickCounts) {
            delete this.targetsByTicks[tickCount];
        }
    }
}
