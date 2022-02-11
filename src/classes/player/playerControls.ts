import { Bot, ControlState } from "mineflayer";
import { Vec3 } from "vec3";
import { IContext } from "../path/PathContext";
import { MathUtils } from "@nxg-org/mineflayer-util-plugin";
import { PlayerState } from "../physics/playerState";

export class PlayerControls {
    public movements: { [key in ControlState]: boolean };
    public rotations: { yaw: number; pitch: number };
    public leftClick: boolean;
    public rightClick: boolean;

    constructor(
        forward: boolean,
        back: boolean,
        left: boolean,
        right: boolean,
        jump: boolean,
        sprint: boolean,
        sneak: boolean,
        leftClick: boolean,
        rightClick: boolean,
        yaw: number,
        pitch: number
    ) {
        this.movements = {
            forward,
            back,
            left,
            right,
            jump,
            sprint,
            sneak,
        };
        this.rotations = {
            yaw,
            pitch,
        };
        this.leftClick = leftClick;
        this.rightClick = rightClick;
    }

    public static DEFAULT(): PlayerControls {
        return new PlayerControls(false, false, false, false, false, false, false, false, false, NaN, NaN);
    }

    public static LOOK(yaw: number, pitch: number) {
        return new PlayerControls(false, false, false, false, false, false, false, false, false, yaw, pitch);
    }

    public static LOOKAT(pos: Vec3) {
        const info = MathUtils.dirToYawAndPitch(pos);
        return new PlayerControls(false, false, false, false, false, false, false, false, false, info.yaw, info.pitch);
    }

    public static COPY_BOT(bot: Bot) {
        return new PlayerControls(bot.controlState.forward, bot.controlState.back, bot.controlState.left, bot.controlState.right, bot.controlState.jump, bot.controlState.sprint, bot.controlState.sneak, bot.util.entity.isMainHandActive(), bot.util.entity.isOffHandActive(), bot.entity.yaw, bot.entity.pitch)
    }

    public static COPY_STATE(state: PlayerState) {
        return new PlayerControls(state.control.movements.forward, state.control.movements.back, state.control.movements.left, state.control.movements.right, state.control.movements.jump, state.control.movements.sprint, state.control.movements.sneak, state.isUsingMainHand, state.isUsingOffHand, state.control.rotations.yaw, state.control.rotations.pitch)
    }

    public set(state: ControlState, wanted: boolean) {
        this.movements[state] = wanted;
    }

    public get(state: ControlState): boolean {
        return this.movements[state];
    }

    public clear(state: ControlState) {
        this.movements[state] = false;
    }

    public clone(): PlayerControls {
        return new PlayerControls(this.movements.forward, this.movements.back, this.movements.left, this.movements.right, this.movements.jump, this.movements.sprint, this.movements.sneak, this.leftClick, this.rightClick, this.rotations.yaw, this.rotations.pitch)
    }

    public setRot(dir: Vec3) {
        const tmp = MathUtils.dirToYawAndPitch(dir);
        this.rotations.yaw = tmp.yaw;
        this.rotations.pitch = tmp.pitch;
    }

    public setRotRaw(yaw: number, pitch: number) {
        this.rotations.yaw = yaw;
        this.rotations.pitch = pitch;
    }

    public apply(ctx: IContext, forceRotations: boolean = false) {
        for (const move in this.movements) {
            ctx.bot.setControlState(move as ControlState, this.movements[move as ControlState]);
        }

        // I feel like this is stupid, so I may not bother. lol
        if (this.leftClick) {
            const block = ctx.bot.blockAtCursor(ctx.blockReach);
            if (block) {
                ctx.bot.dig(block);
            } else {
                const entity = ctx.bot.util.raytrace.entityAtCursor(ctx.entityReach);
                if (entity) {
                    ctx.bot.attack(entity as any); // TODO: update typings for util-plugin to 2.0.0+;
                }
            }
        }

        if (this.rightClick) {
            if (!ctx.bot.util.entity.isMainHandActive()) {
                ctx.bot.activateItem(true);
            }
        }
        if (!isNaN(this.rotations.pitch) && !isNaN(this.rotations.yaw)) {
            if (this.rotations.pitch !== ctx.bot.entity.pitch || this.rotations.yaw !== ctx.bot.entity.yaw) {
                ctx.bot.look(this.rotations.yaw, this.rotations.pitch, forceRotations);
            }
        }
    }
}

export class AdvancedPlayerControls extends PlayerControls {
    public isGrounded: boolean;
    public faceBackwards: number;
    public mlg: number;
    public bucketTimer: number;
    public bucketTarget: { x: number; y: number; z: number };
    public lastTimer: number;

    constructor(
        forward: boolean,
        back: boolean,
        left: boolean,
        right: boolean,
        jump: boolean,
        sprint: boolean,
        sneak: boolean,
        leftClick: boolean,
        rightClick: boolean,
        yaw: number,
        pitch: number
    ) {
        super(forward, back, left, right, jump, sprint, sneak, leftClick, rightClick, yaw, pitch);

        this.isGrounded = true;
        this.faceBackwards = 0; //4
        this.mlg = 0;
        this.bucketTimer = 0;
        this.bucketTarget = { x: 0, y: 0, z: 0 };
        this.lastTimer = 0; //-10
    }

    public static DEFAULT(): AdvancedPlayerControls {
        return new AdvancedPlayerControls(false, false, false, false, false, false, false, false, false, NaN, NaN);
    }

    public static LOOK(yaw: number, pitch: number) {
        return new PlayerControls(false, false, false, false, false, false, false, false, false, yaw, pitch);
    }

    public static LOOKAT(pos: Vec3) {
        const info = MathUtils.dirToYawAndPitch(pos);
        return new AdvancedPlayerControls(false, false, false, false, false, false, false, false, false, info.yaw, info.pitch);
    }
}
