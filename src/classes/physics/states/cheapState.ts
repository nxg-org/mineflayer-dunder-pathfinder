import { AABB } from "@nxg-org/mineflayer-util-plugin";
import { Bot, Effect } from "mineflayer";
import { Entity } from "prismarine-entity";
import { Vec3 } from "vec3";
import { ControlStateHandler } from "../../player/playerControls";
import { CheapEffects, CheapEnchantments, CheapPhysics } from "../engines/cheapPhysics";
import { isEntityUsingItem } from "../extras/physicsUtils";
import * as nbt from "prismarine-nbt";
import { PlayerPoses } from "../extras/entityDimensions";
import { PlayerState } from "./playerState";

export interface CheapPhysicsBuilder {
    position: Vec3;
    velocity: Vec3;
    pitch: number;
    yaw: number;
    controlState: ControlStateHandler;
    isUsingItem?: boolean;
    onGround?: boolean;
    isInWater?: boolean;
    isInLava?: boolean;
    isInWeb?: boolean;
    sneakCollision?: boolean;
    isCollidedHorizontally?: boolean;
    isCollidedVertically?: boolean;

    effects?: Effect[];
    jumpBoost?: number;
    speed?: number;
    slowness?: number;
    dolphinsGrace?: number;
    slowFalling?: number;
    levitation?: number;
    depthStrider?: number;
}

export class CheapPlayerState implements CheapPhysicsBuilder {
    // public isInWater: boolean;
    // public isInLava: boolean;
    // public isInWeb: boolean;
    public onGround: boolean;
    // public isCollidedVertically: boolean;
    // public isCollidedHorizontally: boolean;
    // public jumpTicks: number;
    // public jumpQueued: boolean;

    public sneakCollision: boolean;

    public attributes: any /* dunno yet */;

    public isUsingItem: boolean;
    // public isUsingMainHand: boolean;
    // public isUsingOffHand: boolean;

    public effects: Effect[];
    public jumpBoost: number;
    public speed: number;
    public slowness: number;
    public dolphinsGrace: number;
    public slowFalling: number;
    public levitation: number;
    public depthStrider: number;

    public pose: PlayerPoses;

    // public effects: Effect[];
    // public statusEffectNames;

    constructor(
        public ctx: CheapPhysics,
        public position: Vec3,
        public velocity: Vec3,
        public controlState: ControlStateHandler,
        public yaw: number,
        public pitch: number
    ) {
        this.onGround = false;
        this.sneakCollision = false;
        this.isUsingItem = false;
        this.jumpBoost = 0;
        this.speed = 0;
        this.slowness = 0;
        this.dolphinsGrace = 0;
        this.slowFalling = 0;
        this.levitation = 0;
        this.depthStrider = 0;
        this.effects = [];
        this.pose = PlayerPoses.STANDING;
    }

    public static CREATE_FROM_BOT(ctx: CheapPhysics, bot: Bot): CheapPlayerState {
        return new CheapPlayerState(
            ctx,
            bot.entity.position.clone(),
            bot.entity.velocity.clone(),
            ControlStateHandler.COPY_BOT(bot),
            bot.entity.yaw,
            bot.entity.pitch
        ).updateFromBot(bot);
    }

    public static CREATE_FROM_ENTITY(ctx: CheapPhysics, entity: Entity): CheapPlayerState {
        return new CheapPlayerState(
            ctx,
            entity.position.clone(),
            entity.velocity.clone(),
            ControlStateHandler.DEFAULT(),
            entity.yaw,
            entity.pitch
        ).updateFromEntity(entity);
    }

    public static CREATE_FROM_PLAYER_STATE(ctx: CheapPhysics, state: PlayerState): CheapPlayerState {
        return new CheapPlayerState(
            ctx,
            state.position.clone(),
            state.velocity.clone(),
            state.controlState.clone(),
            state.yaw,
            state.pitch
        ).updateFromRaw(state)
    }

    /**
     * Slightly different from the other two, use a pre-built object (assuming cloned) material.
     * @param ctx CheapPhysics instance.
     * @param raw CONSUMEABLE, build this with clones.
     * @returns CheapPhysicsState
     */
    public static CREATE_RAW(ctx: CheapPhysics, raw: CheapPhysicsBuilder) {
        return new CheapPlayerState(ctx, raw.position, raw.velocity, raw.controlState, raw.yaw, raw.pitch);
    }

    public updateFromBot(bot: Bot): CheapPlayerState {
        this.controlState = ControlStateHandler.COPY_BOT(bot);
        this.onGround = this.onGround;
        this.isUsingItem = isEntityUsingItem(bot.entity);
        this.attributes = (bot.entity as any).attributes;
        this.effects = bot.entity.effects;

        this.jumpBoost = this.ctx.getEffectLevel(CheapEffects.JUMP_BOOST, bot.entity.effects);
        this.speed = this.ctx.getEffectLevel(CheapEffects.SPEED, this.effects);
        this.slowness = this.ctx.getEffectLevel(CheapEffects.SLOWNESS, this.effects);

        this.dolphinsGrace = this.ctx.getEffectLevel(CheapEffects.DOLPHINS_GRACE, this.effects);
        this.slowFalling = this.ctx.getEffectLevel(CheapEffects.SLOW_FALLING, this.effects);
        this.levitation = this.ctx.getEffectLevel(CheapEffects.LEVITATION, this.effects);

        const boots = bot.entity.equipment[5];
        if (boots && boots.nbt) {
            const simplifiedNbt = nbt.simplify(boots.nbt);
            const enchantments = simplifiedNbt.Enchantments ?? simplifiedNbt.ench ?? [];
            this.depthStrider = this.ctx.getEnchantmentLevel(CheapEnchantments.DEPTH_STRIDER, enchantments);
        } else {
            this.depthStrider = 0;
        }
        return this;
    }

    public updateFromEntity(entity: Entity) {
        this.onGround = entity.onGround;
        this.isUsingItem = isEntityUsingItem(entity);
        this.controlState = ControlStateHandler.DEFAULT();
        this.attributes = (entity as any).attributes;
        this.effects = entity.effects;

        this.jumpBoost = this.ctx.getEffectLevel(CheapEffects.JUMP_BOOST, this.effects);
        this.speed = this.ctx.getEffectLevel(CheapEffects.SPEED, this.effects);
        this.slowness = this.ctx.getEffectLevel(CheapEffects.SLOWNESS, this.effects);

        this.dolphinsGrace = this.ctx.getEffectLevel(CheapEffects.DOLPHINS_GRACE, this.effects);
        this.slowFalling = this.ctx.getEffectLevel(CheapEffects.SLOW_FALLING, this.effects);
        this.levitation = this.ctx.getEffectLevel(CheapEffects.LEVITATION, this.effects);

        const boots = entity.equipment[5];
        if (boots && boots.nbt) {
            const simplifiedNbt = nbt.simplify(boots.nbt);
            const enchantments = simplifiedNbt.Enchantments ?? simplifiedNbt.ench ?? [];
            this.depthStrider = this.ctx.getEnchantmentLevel(CheapEnchantments.DEPTH_STRIDER, enchantments);
        } else {
            this.depthStrider = 0;
        }
        return this;
    }

    public updateFromRaw(other: CheapPhysicsBuilder) {
        this.onGround = other.onGround ?? this.onGround;
        this.sneakCollision = other.sneakCollision ?? this.sneakCollision;
        this.isUsingItem = other.isUsingItem ?? this.isUsingItem;
        this.jumpBoost = other.jumpBoost ?? this.jumpBoost;
        this.speed = other.speed ?? this.speed;
        this.slowness = other.slowness ?? this.slowness;
        this.dolphinsGrace = other.dolphinsGrace ?? this.dolphinsGrace;
        this.slowFalling = other.slowFalling ?? this.slowFalling;
        this.levitation = other.levitation ?? this.levitation;
        this.depthStrider = other.depthStrider ?? this.depthStrider;
        this.effects = other.effects ?? this.effects;
        return this;
    }

    public applyToBot(bot: Bot) {
        bot.entity.position = this.position;
        bot.entity.velocity = this.velocity;
        bot.entity.onGround = this.onGround;
        bot.entity.yaw = this.yaw;
        bot.entity.pitch = this.pitch;
        bot.controlState = this.controlState;
        return this;
    }

    /**
     * No idea when you'd use this.
     */
    public applyToEntity(entity: Entity) {
        entity.position = this.position;
        entity.velocity = this.velocity;
        entity.onGround = this.onGround;
        entity.yaw = this.yaw;
        entity.pitch = this.pitch;
        return this;
    }

    public clone(): CheapPlayerState {
        const other = new CheapPlayerState(
            this.ctx,
            this.position.clone(),
            this.velocity.clone(),
            this.controlState.clone(),
            this.yaw,
            this.pitch
        );
        other.onGround = this.onGround;
        other.sneakCollision = this.sneakCollision;
        other.attributes = this.attributes;
        other.isUsingItem = this.isUsingItem;
        other.effects = this.effects;
        other.jumpBoost = this.jumpBoost;
        other.speed = this.speed;
        other.slowness = this.slowness;
        other.dolphinsGrace = this.dolphinsGrace;
        other.slowFalling = this.slowFalling;
        other.levitation = this.levitation;
        other.depthStrider = this.depthStrider;
        return other;
    }

    public merge(other: CheapPlayerState) {
        this.position = other.position.clone();
        this.velocity = other.velocity.clone();
        this.onGround = other.onGround;
        this.sneakCollision = other.sneakCollision;
        this.attributes = other.attributes;
        this.isUsingItem = other.isUsingItem;
        this.effects = other.effects;
        this.jumpBoost = other.jumpBoost;
        this.speed = other.speed;
        this.slowness = other.slowness;
        this.dolphinsGrace = other.dolphinsGrace;
        this.slowFalling = other.slowFalling;
        this.levitation = other.levitation;
        this.depthStrider = other.depthStrider;
        return this;
    }

    public clearControlStates(): CheapPlayerState {
        this.controlState = ControlStateHandler.DEFAULT();
        return this;
    }

    /**
     * needs to be updated.
     * @returns AABB
     */
    public getAABB(): AABB {
        const w = CheapPhysics.settings.playerHalfWidth;
        return new AABB(
            this.position.x - w,
            this.position.y,
            this.position.z - w,
            this.position.x + w,
            this.position.y + CheapPhysics.settings.playerHeight,
            this.position.z + w
        );
    }

    public getUnderlyingBlockBBs() {
        const queryBB = this.getAABB();
        const surroundingBBs = [];
        const cursor = new Vec3(0, Math.floor(queryBB.minY) - 0.251, 0);
        for (cursor.z = Math.floor(queryBB.minZ); cursor.z <= Math.floor(queryBB.maxZ); cursor.z++) {
            for (cursor.x = Math.floor(queryBB.minX); cursor.x <= Math.floor(queryBB.maxX); cursor.x++) {
                const block = this.ctx.world.getBlock(cursor);
                if (block) {
                    if (block instanceof AABB) {
                        surroundingBBs.push(block);
                    } else {
                        const blockPos = block.position;
                        for (const shape of block.shapes) {
                            const blockBB = new AABB(shape[0], shape[1], shape[2], shape[3], shape[4], shape[5]);
                            blockBB.offset(blockPos.x, blockPos.y, blockPos.z);
                            surroundingBBs.push(blockBB);
                        }
                    }
                }
            }
        }
        return surroundingBBs;
    }

    public getSurroundingBBs(): AABB[] {
        const queryBB = this.getAABB();
        const surroundingBBs = [];
        const cursor = new Vec3(0, 0, 0);
        for (cursor.y = Math.floor(queryBB.minY) - 1; cursor.y <= Math.floor(queryBB.maxY); cursor.y++) {
            for (cursor.z = Math.floor(queryBB.minZ); cursor.z <= Math.floor(queryBB.maxZ); cursor.z++) {
                for (cursor.x = Math.floor(queryBB.minX); cursor.x <= Math.floor(queryBB.maxX); cursor.x++) {
                    const block = this.ctx.world.getBlock(cursor);
                    if (block) {
                        if (block instanceof AABB) {
                            surroundingBBs.push(block);
                        } else {
                            const blockPos = block.position;
                            for (const shape of block.shapes) {
                                const blockBB = new AABB(shape[0], shape[1], shape[2], shape[3], shape[4], shape[5]);
                                blockBB.offset(blockPos.x, blockPos.y, blockPos.z);
                                surroundingBBs.push(blockBB);
                            }
                        }
                    }
                }
            }
        }
        return surroundingBBs;
    }

    // public getPose() {
    //       // may leave this out.
    //       //nvm, leaving this out.
    //       if (this.onGround && !this.isInWater && !this.isInLava) {
    //         this.pose = this.controlState.sneak
    //             ? this.controlState.sprint && this.controlState.jump
    //                 ? PlayerPoses.LONG_JUMPING
    //                 : PlayerPoses.STANDING
    //             : PlayerPoses.SNEAKING;
    //     } else if (this.isInWater) {
    //         this.pose = this.controlState.sprint ? PlayerPoses.SWIMMING : PlayerPoses.STANDING
    //     } else {
    //         this.pose = PlayerPoses.STANDING
    //     }

    // }
}
