import { Bot, Effect } from "mineflayer";
import { AABB } from "@nxg-org/mineflayer-util-plugin";
import { PlayerControls } from "../player/playerControls";
import { Physics } from "./physics";
import * as nbt from "prismarine-nbt";
import { Vec3 } from "vec3";
import { getStatusEffectNamesForVersion, hash, hashAABB, isEntityUsingItem, makeSupportFeature, whichHandIsEntityUsing, whichHandIsEntityUsingBoolean } from "./physicsUtils";
// import { bot.entity } from "prismarine-entity";


/**
 * Looking at this code, it's too specified towards players.
 *
 * I will eventually split this code into PlayerState and bot.entityState, where bot.entityState contains fewer controls.
 */
export class PlayerState {
    public position: Vec3;
    public velocity: Vec3;
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

    public isUsingItem: boolean;
    public isUsingMainHand: boolean;
    public isUsingOffHand: boolean;

    public jumpBoost: number;
    public speed: number;
    public slowness: number;
    public dolphinsGrace: number;
    public slowFalling: number;
    public levitation: number;
    public depthStrider: number;

    public effects: Effect[];
    public statusEffectNames;

    public readonly ctx: Physics;
    private readonly supportFeature: ReturnType<typeof makeSupportFeature>;

    constructor(ctx: Physics, bot: Bot, control: PlayerControls) {
        this.supportFeature = makeSupportFeature(ctx.data);
        this.ctx = ctx;
        this.position = bot.entity.position.clone();
        this.velocity = bot.entity.velocity.clone();
        this.onGround = bot.entity.onGround;
        this.isInWater = bot.entity.isInWater;
        this.isInLava = bot.entity.isInLava;
        this.isInWeb = (bot.entity as any).isInWeb;
        this.isCollidedHorizontally = (bot.entity as any).isCollidedHorizontally;
        this.isCollidedVertically = (bot.entity as any).isCollidedVertically;

        //not sure what to do here, ngl.
        this.jumpTicks = (bot as any).jumpTicks ?? 0;
        this.jumpQueued = (bot as any).jumpQueued ?? false;

        // Input only (not modified)
        this.attributes = (bot.entity as any).attributes;
        this.yaw = bot.entity.yaw;
        this.control = control;


        console.log("the fuck?")
        this.isUsingItem = isEntityUsingItem(bot.entity);
        this.isUsingMainHand = !whichHandIsEntityUsingBoolean(bot.entity) && this.isUsingItem
        this.isUsingOffHand = whichHandIsEntityUsingBoolean(bot.entity) && this.isUsingItem

        // effects
        this.effects = bot.entity.effects;
        this.statusEffectNames = getStatusEffectNamesForVersion(this.supportFeature);

        this.jumpBoost = ctx.getEffectLevel(this.statusEffectNames.jumpBoostEffectName, this.effects);
        this.speed = ctx.getEffectLevel(this.statusEffectNames.speedEffectName, this.effects);
        this.slowness = ctx.getEffectLevel(this.statusEffectNames.slownessEffectName, this.effects);

        this.dolphinsGrace = ctx.getEffectLevel(this.statusEffectNames.dolphinsGraceEffectName, this.effects);
        this.slowFalling = ctx.getEffectLevel(this.statusEffectNames.slowFallingEffectName, this.effects);
        this.levitation = ctx.getEffectLevel(this.statusEffectNames.levitationEffectName, this.effects);

        // armour enchantments
        //const boots = bot.inventory.slots[8];
        const boots = bot.entity.equipment[5];
        if (boots && boots.nbt) {
            const simplifiedNbt = nbt.simplify(boots.nbt);
            const enchantments = simplifiedNbt.Enchantments ?? simplifiedNbt.ench ?? [];
            this.depthStrider = ctx.getEnchantmentLevel("depth_strider", enchantments);
        } else {
            this.depthStrider = 0;
        }
    }

    public update(bot: Bot, control?: PlayerControls): void {
        // const bot.entity = bot instanceof bot.entity ? bot : bot.entity;
        // Input / Outputs
        this.position = bot.entity.position.clone();
        this.velocity = bot.entity.velocity.clone();
        this.onGround = bot.entity.onGround;
        this.isInWater = bot.entity.isInWater;
        this.isInLava = bot.entity.isInLava;
        this.isInWeb = (bot.entity as any).isInWeb;
        this.isCollidedHorizontally = (bot.entity as any).isCollidedHorizontally;
        this.isCollidedVertically = (bot.entity as any).isCollidedVertically;

        // dunno what to do about these, ngl.
        this.jumpTicks = (bot as any).jumpTicks ?? 0;
        this.jumpQueued = (bot as any).jumpQueued ?? false;

        // Input only (not modified)
        this.attributes = (bot.entity as any).attributes;
        this.yaw = bot.entity.yaw;
        this.control = control ?? this.control;

        this.isUsingItem = isEntityUsingItem(bot.entity);
        this.isUsingMainHand = !whichHandIsEntityUsingBoolean(bot.entity) && this.isUsingItem
        this.isUsingOffHand = whichHandIsEntityUsingBoolean(bot.entity) && this.isUsingItem

        // effects
        this.effects = bot.entity.effects;

        this.jumpBoost = this.ctx.getEffectLevel(this.statusEffectNames.jumpBoostEffectName, this.effects);
        this.speed = this.ctx.getEffectLevel(this.statusEffectNames.speedEffectName, this.effects);
        this.slowness = this.ctx.getEffectLevel(this.statusEffectNames.slownessEffectName, this.effects);

        this.dolphinsGrace = this.ctx.getEffectLevel(this.statusEffectNames.dolphinsGraceEffectName, this.effects);
        this.slowFalling = this.ctx.getEffectLevel(this.statusEffectNames.slowFallingEffectName, this.effects);
        this.levitation = this.ctx.getEffectLevel(this.statusEffectNames.levitationEffectName, this.effects);

        // armour enchantments
        //const boots = bot.inventory.slots[8];
        const boots = bot.entity.equipment[5];
        if (boots && boots.nbt) {
            const simplifiedNbt = nbt.simplify(boots.nbt);
            const enchantments = simplifiedNbt.Enchantments ?? simplifiedNbt.ench ?? [];
            this.depthStrider = this.ctx.getEnchantmentLevel("depth_strider", enchantments);
        } else {
            this.depthStrider = 0;
        }
    }

    public apply(bot: Bot): void {
        // const bot.entity = bot instanceof bot.entity ? bot : bot.entity;
        bot.entity.position = this.position;
        bot.entity.velocity = this.velocity;
        bot.entity.onGround = this.onGround;
        bot.entity.isInWater = this.isInWater;
        bot.entity.isInLava = this.isInLava;
        (bot.entity as any).isInWeb = this.isInWeb;
        (bot.entity as any).isCollidedHorizontally = this.isCollidedHorizontally;
        (bot.entity as any).isCollidedVertically = this.isCollidedVertically;

        // dunno what to do about these, ngl.
        (bot as any).jumpTicks = this.jumpTicks;
        (bot as any).jumpQueued = this.jumpQueued;
    }
}
