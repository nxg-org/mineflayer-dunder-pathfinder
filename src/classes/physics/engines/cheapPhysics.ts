// import { Physics } from "./physics";

import { Effect } from "mineflayer";
import { getEnchantmentNamesForVersion, getStatusEffectNamesForVersion, makeSupportFeature } from "../extras/physicsUtils";
import md from "minecraft-data";
import { CheapPhysicsSettings } from "../extras/cheapSettings";
import { Vec3 } from "vec3";
import { AABB } from "@nxg-org/mineflayer-util-plugin";
import { CheapPlayerState } from "../states/cheapState";
import { BaseWorld } from "../worlds/baseWorld";
import { Physics } from "./physics";

type CheapEffectNames = keyof ReturnType<typeof getStatusEffectNamesForVersion>;
type CheapEnchantmentNames = keyof ReturnType<typeof getEnchantmentNamesForVersion>;

/**
 * Looking at this code, it's too specified towards players.
 *
 * I will eventually split this code into PlayerState and bot.entityState, where bot.entityState contains fewer controls.
 */

export enum CheapEffects {
    SPEED,
    JUMP_BOOST,
    SLOWNESS,
    DOLPHINS_GRACE,
    SLOW_FALLING,
    LEVITATION,
}

export enum CheapEnchantments {
    DEPTH_STRIDER,
}

/**
 * The point of this class is to simulate a player's inputs w/ MINIMAL block collision.
 *
 * Change of plans, NO block collision. Which means all of the velocity info should be handled BEFORE simulating.
 *
 * This can be used to determine which jumps are potentially possible, and which are not.
 */
export class CheapPhysics {
    public static settings = CheapPhysicsSettings;
    public data: md.IndexedData;
    public world: BaseWorld /* prismarine-world */;
    public movementSpeedAttribute: any;
    public readonly statusEffectNames: { [type in CheapEffects]: string };
    public readonly enchantmentNames: { [type in CheapEnchantments]: string };

    public readonly honeyblockId: number;

    constructor(data: md.IndexedData, world: any) {
        this.data = data;
        this.world = world;
        this.movementSpeedAttribute = (this.data.attributesByName.movementSpeed as any).resource;
        this.honeyblockId = this.data.blocksByName.honey_block ? this.data.blocksByName.honey_block.id : -1; // 1.15+
        this.statusEffectNames = {} as any; // mmm, speed.
        this.enchantmentNames = {} as any; //mmm, double speed.

        let ind = 0;
        const tmp = getStatusEffectNamesForVersion(makeSupportFeature(this.data));
        for (const key in tmp) {
            this.statusEffectNames[ind as CheapEffects] = tmp[key as CheapEffectNames];
            ind++;
        }
        ind = 0;
        const tmp1 = getEnchantmentNamesForVersion(makeSupportFeature(this.data));
        for (const key in tmp1) {
            this.enchantmentNames[ind as CheapEnchantments] = tmp1[key as CheapEnchantmentNames];
        }
    }


    public static FROM_PHYSICS(physics: Physics) {
        return new CheapPhysics(physics.data, physics.world);
    }
    

    getEffectLevel(wantedEffect: CheapEffects, effects: Effect[]) {
        const effectDescriptor = this.data.effectsByName[this.statusEffectNames[wantedEffect]];
        if (!effectDescriptor) {
            return 0;
        }
        const effectInfo = effects[effectDescriptor.id];
        if (!effectInfo) {
            return 0;
        }
        return effectInfo.amplifier + 1;
    }

    getEnchantmentLevel(wantedEnchantment: CheapEnchantments, enchantments: any[]) {
        const enchantmentName = this.enchantmentNames[wantedEnchantment];
        const enchantmentDescriptor = this.data.enchantmentsByName[enchantmentName];
        if (!enchantmentDescriptor) {
            return 0;
        }

        for (const enchInfo of enchantments) {
            if (typeof enchInfo.id === "string") {
                if (enchInfo.id.includes(enchantmentName)) {
                    return enchInfo.lvl;
                }
            } else if (enchInfo.id === enchantmentDescriptor.id) {
                return enchInfo.lvl;
            }
        }
        return 0;
    }

    public getSurroundingBBs(queryBB: AABB): AABB[] {
        const surroundingBBs = [];
        const cursor = new Vec3(0, 0, 0);
        for (cursor.y = Math.floor(queryBB.minY) - 1; cursor.y <= Math.floor(queryBB.maxY); cursor.y++) {
            for (cursor.z = Math.floor(queryBB.minZ); cursor.z <= Math.floor(queryBB.maxZ); cursor.z++) {
                for (cursor.x = Math.floor(queryBB.minX); cursor.x <= Math.floor(queryBB.maxX); cursor.x++) {
                    const block = this.world.getBlock(cursor);
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

    setPositionToBB(bb: AABB, pos: { x: number; y: number; z: number }) {
        pos.x = bb.minX + CheapPhysicsSettings.playerHalfWidth;
        pos.y = bb.minY;
        pos.z = bb.minZ + CheapPhysicsSettings.playerHalfWidth;
    }

    moveEntity(state: CheapPlayerState, dx: number, dy: number, dz: number) {
        const vel = state.velocity;
        const pos = state.position;

        // let playerBB = state.getAABB();
        // const queryBB = playerBB.clone().extend(dx, dy, dz);
        // const surroundingBBs = this.getSurroundingBBs(playerBB);
        // const oldBB = playerBB.clone();

        // // Update flags
        // this.setPositionToBB(playerBB, pos);

        pos.translate(dx, dy, dz);
        state.sneakCollision = false;
        state.onGround = false;
    }

    applyHeading(state: CheapPlayerState, strafe: number, forward: number, multiplier: number) {
        let speed = Math.sqrt(strafe * strafe + forward * forward);
        if (speed < 0.01) return new Vec3(0, 0, 0);

        speed = multiplier / Math.max(speed, 1);

        strafe *= speed;
        forward *= speed;

        const yaw = Math.PI - state.yaw;
        const sin = Math.sin(yaw);
        const cos = Math.cos(yaw);

        const vel = state.velocity;
        vel.x += strafe * cos - forward * sin;
        vel.z += forward * cos + strafe * sin;
    }

    moveEntityWithHeading(entity: CheapPlayerState, strafe: number, forward: number) {
        const vel = entity.velocity;

        const gravityMultiplier = vel.y <= 0 && entity.slowFalling > 0 ? CheapPhysicsSettings.slowFalling : 1;

        // Normal movement
        let acceleration = CheapPhysicsSettings.airborneAcceleration;
        let inertia = CheapPhysicsSettings.airborneInertia;
        this.applyHeading(entity, strafe, forward, acceleration);
        this.moveEntity(entity, vel.x, vel.y, vel.z);

        // Apply friction and gravity
        if (entity.levitation > 0) {
            vel.y += (0.05 * entity.levitation - vel.y) * 0.2;
        } else {
            vel.y -= CheapPhysicsSettings.gravity * gravityMultiplier;
        }
        vel.y *= CheapPhysicsSettings.airdrag;
        vel.x *= inertia;
        vel.z *= inertia;
    }

    simulatePlayer(state: CheapPlayerState) {
        const vel = state.velocity;
        const pos = state.position;
        // Reset velocity component if it falls under the threshold
        if (Math.abs(vel.x) < CheapPhysicsSettings.negligeableVelocity) vel.x = 0;
        if (Math.abs(vel.y) < CheapPhysicsSettings.negligeableVelocity) vel.y = 0;
        if (Math.abs(vel.z) < CheapPhysicsSettings.negligeableVelocity) vel.z = 0;

        // Handle inputs
        if (state.controlState.jump) {
            // this will only possibly occur on first tick of simulation, so can ignore all jump tick checks.
            // they're also invalid anyway since players can override it w/ key presses, lol. Nice job. They got it from LivingEntity.java
            if (state.onGround) {
                // should I leave this in? I guess, why not.
                const blockBelow = this.world.getBlock(state.position.floored().offset(0, -0.5, 0));
                if (blockBelow) {
                    if (blockBelow instanceof AABB) {
                        vel.y = CheapPhysicsSettings.jumpHeight;
                    } else {
                        vel.y =
                            CheapPhysicsSettings.jumpHeight *
                            (blockBelow && blockBelow.type === this.honeyblockId ? CheapPhysicsSettings.honeyblockJumpSpeed : 1);
                    }

                    if (state.jumpBoost > 0) {
                        vel.y += 0.1 * state.jumpBoost;
                    }
                }

                if (state.controlState.sprint) {
                    const yaw = Math.PI - state.yaw;
                    vel.x -= Math.sin(yaw) * 0.2;
                    vel.z += Math.cos(yaw) * 0.2;
                }
            }
        }

        let strafe = ((state.controlState.right as unknown as number) - (state.controlState.left as unknown as number)) * 0.98;
        let forward = ((state.controlState.forward as unknown as number) - (state.controlState.back as unknown as number)) * 0.98;

        if (state.controlState.sneak) {
            strafe *= CheapPhysicsSettings.sneakSpeed;
            forward *= CheapPhysicsSettings.sneakSpeed;
        }

        if (state.isUsingItem) {
            strafe *= CheapPhysicsSettings.usingItemSpeed;
            forward *= CheapPhysicsSettings.usingItemSpeed;
        }

        this.moveEntityWithHeading(state, strafe, forward);

        return state;
    }
}
