import { Bot } from "mineflayer";
import { AABB } from "@nxg-org/mineflayer-util-plugin";
import { PlayerControls } from "../player/playerControls";
import { Physics } from "./physics";
import * as nbt from "prismarine-nbt";
import { Vec3 } from "vec3";
import { getStatusEffectNamesForVersion, isEntityUsingItem, makeSupportFeature } from "./physicsUtils";

// hashes are as such:
// bits      | value
// 0 - 25    | x0
// 26 - 51   | z0
// 52 - 63   | y0
// 64 - 89   | x1
// 90 - 115  | z1
// 116 - 128 | y1
export function hash(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): BigInt {
    return BigInt(x0) + (BigInt(z0) << 26n) + (BigInt(y0) << 52n) + (BigInt(x1) << 64n) + (BigInt(z1) << 90n) + (BigInt(y1) << 116n);
}
export function hashAABB(aabb: AABB) {
    return (
        BigInt(aabb.minX) +
        (BigInt(aabb.minZ) << 26n) +
        (BigInt(aabb.minY) << 52n) +
        (BigInt(aabb.maxX) << 64n) +
        (BigInt(aabb.maxZ) << 90n) +
        (BigInt(aabb.maxY) << 116n)
    );
}

/**
 * this stores info that may not be required by the Physics engine itself.
 */
export class PlayerStateAdditions {
    public detectAnyway: Map<BigInt, AABB> = new Map();
    // completely forgot that sets only work with primitives here. <:XD:879491603629244436>
    // I'm too "spoiled" by Java.
    //https://stackoverflow.com/questions/36588890/es6-set-allows-duplicate-array-object
    constructor(
        // comment for formatting
        public ignoreHoriztonalCollisions: boolean = false,
        public ignoreVerticalCollisions: boolean = false
    ) {}

    // AABB
    public shouldAABB(aabb: AABB): boolean {
        return this.detectAnyway.has(hashAABB(aabb));
    }
    public detectAABB(aabb: AABB): void {
        this.detectAnyway.set(hashAABB(aabb), aabb);
    }
    public removeAABB(aabb: AABB): void {
        this.detectAnyway.delete(hashAABB(aabb));
    }
    // AABBBlockPos
    public shouldAABBBlockPos(min: Vec3): boolean {
        return this.detectAnyway.has(hash(min.x, min.y, min.z, min.x + 1, min.y + 1, min.z + 1));
    }
    public detectAABBBlockPos(min: Vec3): void {
        let aabb = new AABB(min.x, min.y, min.z, min.x + 1, min.y + 1, min.z + 1);
        this.detectAnyway.set(hash(min.x, min.y, min.z, min.x + 1, min.y + 1, min.z + 1), aabb);
    }
    public removeAABBBlockPos(min: Vec3): void {
        this.detectAnyway.delete(hash(min.x, min.y, min.z, min.x + 1, min.y + 1, min.z + 1));
    }
    public getAABBBlockPos(min: Vec3): AABB | void {
        return this.detectAnyway.get(hash(min.x, min.y, min.z, min.x + 1, min.y + 1, min.z + 1));
    }
    // AABBVecs
    public shouldAABBVecs(min: Vec3, max: Vec3): boolean {
        return this.detectAnyway.has(hash(min.x, min.y, min.z, max.x, max.y, max.z));
    }
    public detectAABBVecs(min: Vec3, max: Vec3): void {
        let aabb = new AABB(min.x, min.y, min.z, max.x, max.y, max.z);
        this.detectAnyway.set(hash(min.x, min.y, min.z, max.x, max.y, max.z), aabb);
    }
    public removeAABBVecs(min: Vec3, max: Vec3): void {
        this.detectAnyway.delete(hash(min.x, min.y, min.z, max.x, max.y, max.z));
    }
    public getAABBVecs(min: Vec3, max: Vec3): AABB | undefined {
        return this.detectAnyway.get(hash(min.x, min.y, min.z, max.x, max.y, max.z));
    }
    // AABBBlockCoords
    public shouldAABBBlockCoords(x: number, y: number, z: number): boolean {
        x = Math.floor(x);
        y = Math.floor(y);
        z = Math.floor(z);
        return this.detectAnyway.has(hash(x, y, z, x + 1, y + 1, z + 1));
    }
    public detectAABBBlockCoords(x: number, y: number, z: number): void {
        x = Math.floor(x);
        y = Math.floor(y);
        z = Math.floor(z);
        let aabb = new AABB(x, y, z, x + 1, y + 1, z + 1);
        this.detectAnyway.set(hash(x, y, z, x + 1, y + 1, z + 1), aabb);
    }
    public removeAABBBlockCoords(x: number, y: number, z: number): void {
        x = Math.floor(x);
        y = Math.floor(y);
        z = Math.floor(z);
        this.detectAnyway.delete(hash(x, y, z, x + 1, y + 1, z + 1));
    }
    public getAABBBlockCoords(x: number, y: number, z: number): AABB | undefined {
        x = Math.floor(x);
        y = Math.floor(y);
        z = Math.floor(z);
        return this.detectAnyway.get(hash(x, y, z, x + 1, y + 1, z + 1));
    }
    // AABBCoords
    public shouldAABBCoords(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): boolean {
        return this.detectAnyway.has(hash(x0, y0, z0, x1, y1, z1));
    }
    public detectAABBCoords(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) {
        let aabb = new AABB(x0, y0, z0, x1, y1, z1);
        this.detectAnyway.set(hash(x0, y0, z0, x1, y1, z1), aabb);
    }
    public removeAABBCoords(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): void {
        this.detectAnyway.delete(hash(x0, y0, z0, x1, y1, z1));
    }
    public getAABBCoords(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): AABB | undefined {
        return this.detectAnyway.get(hash(x0, y0, z0, x1, y1, z1));
    }

    public getIntersectingAABB(other: AABB): AABB | undefined {
        for (const aabb of this.detectAnyway.values()) {
            if (aabb.intersects(other)) {
                return aabb;
            }
        }
    }

    public hasAABBThatIntesects(other: AABB): boolean {
        for (const aabb of this.detectAnyway.values()) {
            if (aabb.intersects(other)) {
                return true;
            }
        }
        return false;
    }
}

export class PlayerState {
    public pos: Vec3;
    public vel: Vec3;
    public onGround: boolean;
    public isInWater: boolean;
    public isInLava: boolean;
    public isInWeb: boolean;
    public isCollidedHorizontally: boolean;
    public isCollidedVertically: boolean;
    public jumpTicks: number;
    public jumpQueued: boolean;

    public attributes: any /* dunno yet */;
    public yaw: number;
    public control: PlayerControls;

    public usingItem: boolean;

    public jumpBoost: number;
    public speed: number;
    public slowness: number;
    public dolphinsGrace: number;
    public slowFalling: number;
    public levitation: number;
    public depthStrider: number;

    constructor(ctx: Physics, bot: Bot, control: PlayerControls) {
        const supportFeature = makeSupportFeature(ctx.data);

        // Input / Outputs
        this.pos = bot.entity.position.clone();
        this.vel = bot.entity.velocity.clone();
        this.onGround = bot.entity.onGround;
        this.isInWater = bot.entity.isInWater;
        this.isInLava = bot.entity.isInLava;
        this.isInWeb = (bot.entity as any).isInWeb;
        this.isCollidedHorizontally = (bot.entity as any).isCollidedHorizontally;
        this.isCollidedVertically = (bot.entity as any).isCollidedVertically;
        this.jumpTicks = (bot as any).jumpTicks;
        this.jumpQueued = (bot as any).jumpQueued;

        // Input only (not modified)
        this.attributes = (bot.entity as any).attributes;
        this.yaw = bot.entity.yaw;
        this.control = control;

        this.usingItem = isEntityUsingItem(bot.entity);

        // effects
        const effects = bot.entity.effects;
        const statusEffectNames = getStatusEffectNamesForVersion(supportFeature);

        this.jumpBoost = ctx.getEffectLevel(statusEffectNames.jumpBoostEffectName, effects);
        this.speed = ctx.getEffectLevel(statusEffectNames.speedEffectName, effects);
        this.slowness = ctx.getEffectLevel(statusEffectNames.slownessEffectName, effects);

        this.dolphinsGrace = ctx.getEffectLevel(statusEffectNames.dolphinsGraceEffectName, effects);
        this.slowFalling = ctx.getEffectLevel(statusEffectNames.slowFallingEffectName, effects);
        this.levitation = ctx.getEffectLevel(statusEffectNames.levitationEffectName, effects);

        // armour enchantments
        const boots = bot.inventory.slots[8];
        if (boots && boots.nbt) {
            const simplifiedNbt = nbt.simplify(boots.nbt);
            const enchantments = simplifiedNbt.Enchantments ?? simplifiedNbt.ench ?? [];
            this.depthStrider = ctx.getEnchantmentLevel("depth_strider", enchantments);
        } else {
            this.depthStrider = 0;
        }
    }

    apply(bot: Bot) {
        bot.entity.position = this.pos;
        bot.entity.velocity = this.vel;
        bot.entity.onGround = this.onGround;
        bot.entity.isInWater = this.isInWater;
        bot.entity.isInLava = this.isInLava;
        (bot.entity as any).isInWeb = this.isInWeb;
        (bot.entity as any).isCollidedHorizontally = this.isCollidedHorizontally;
        (bot.entity as any).isCollidedVertically = this.isCollidedVertically;
        (bot as any).jumpTicks = this.jumpTicks;
        (bot as any).jumpQueued = this.jumpQueued;
    }
}
