import { Vec3 } from "vec3";
import { AABB } from "@nxg-org/mineflayer-util-plugin";
import md, { Effects, Enchantments } from "minecraft-data";
import * as math from "../lib/math";
import * as attributes from "../lib/attributes";
import * as features from "../lib/features.json";
import { Effect, Entity } from "prismarine-entity";
import { Bot, Enchantment } from "mineflayer";
import { PlayerControls } from "../../player/playerControls";
import { Block } from "prismarine-block";
import { NormalizedEnchant } from "prismarine-item";
import { makeSupportFeature } from "../extras/physicsUtils";
import { PlayerState } from "../extras/playerState";
import { Physics } from "./physics";
import { IPhysicsAdditions, PhysicsAdditions } from "../extras/physicsAdditions";


export class PerStatePhysics extends Physics {
    protected extras: PhysicsAdditions;

    constructor(mcData: md.IndexedData, world: any /* prismarine-world */, extras?: IPhysicsAdditions) {
        super(mcData, world);
        this.extras = PhysicsAdditions.fromOptions(extras);
    }

    getPlayerBB(pos: { x: number; y: number; z: number }): AABB {
        const w = this.settings.playerHalfWidth;
        return new AABB(-w, 0, -w, w, this.settings.playerHeight, w).offset(pos.x, pos.y, pos.z);
    }

    setPositionToBB(bb: AABB, pos: { x: number; y: number; z: number }) {
        pos.x = bb.minX + this.settings.playerHalfWidth;
        pos.y = bb.minY;
        pos.z = bb.minZ + this.settings.playerHalfWidth;
    }

    getSurroundingBBs(queryBB: AABB): AABB[] {
        const surroundingBBs = [];
        const cursor = new Vec3(0, 0, 0);
        for (cursor.y = Math.floor(queryBB.minY) - 1; cursor.y <= Math.floor(queryBB.maxY); cursor.y++) {
            for (cursor.z = Math.floor(queryBB.minZ); cursor.z <= Math.floor(queryBB.maxZ); cursor.z++) {
                for (cursor.x = Math.floor(queryBB.minX); cursor.x <= Math.floor(queryBB.maxX); cursor.x++) {
                    if (this.extras.doCollisions && !this.extras.customCollisionsOnly) {
                        const block = this.world.getBlock(cursor);
                        if (block) {
                            const blockPos = block.position;
                            for (const shape of block.shapes) {
                                const blockBB = new AABB(shape[0], shape[1], shape[2], shape[3], shape[4], shape[5]);
                                blockBB.offset(blockPos.x, blockPos.y, blockPos.z);
                                surroundingBBs.push(blockBB);
                            }
                        }
                    } else if (this.extras.doCollisions && this.extras.customCollisionsOnly) {
                        const block = this.extras.getBlock(cursor);
                        if (block) {
                            surroundingBBs.push(block);
                        }
                    }
                }
            }
        }
        return surroundingBBs;
    }

    adjustPositionHeight(pos: Vec3) {
        const playerBB = this.getPlayerBB(pos);
        const queryBB = playerBB.clone().extend(0, -1, 0);
        const surroundingBBs = this.getSurroundingBBs(queryBB);

        let dy = -1;
        for (const blockBB of surroundingBBs) {
            dy = blockBB.computeOffsetY(playerBB, dy);
        }
        pos.y += dy;
    }

    movestate(state: PlayerState, dx: number, dy: number, dz: number) {
        const vel = state.velocity;
        const pos = state.position;

        if (state.isInWeb && this.extras.doCollisions) {
            dx *= 0.25;
            dy *= 0.05;
            dz *= 0.25;
            vel.x = 0;
            vel.y = 0;
            vel.z = 0;
            state.isInWeb = false;
        }

        const oldOldVelX = dx;
        let oldVelX = dx;
        const oldVelY = dy;
        let oldVelZ = dz;
        const oldOldVelZ = dz;

        //stepping until collision occurs.
        if (state.controlState.sneak && state.onGround && this.extras.doCollisions && !this.extras.ignoreVerticalCollisions) {
            const step = 0.05;

            // In the 3 loops below, y offset should be -1, but that doesnt reproduce vanilla behavior.
            for (; dx !== 0 && this.getSurroundingBBs(this.getPlayerBB(pos).offset(dx, 0, 0)).length === 0; oldVelX = dx) {
                if (dx < step && dx >= -step) dx = 0;
                else if (dx > 0) dx -= step;
                else dx += step;
            }

            for (; dz !== 0 && this.getSurroundingBBs(this.getPlayerBB(pos).offset(0, 0, dz)).length === 0; oldVelZ = dz) {
                if (dz < step && dz >= -step) dz = 0;
                else if (dz > 0) dz -= step;
                else dz += step;
            }

            while (dx !== 0 && dz !== 0 && this.getSurroundingBBs(this.getPlayerBB(pos).offset(dx, 0, dz)).length === 0) {
                if (dx < step && dx >= -step) dx = 0;
                else if (dx > 0) dx -= step;
                else dx += step;

                if (dz < step && dz >= -step) dz = 0;
                else if (dz > 0) dz -= step;
                else dz += step;

                oldVelX = dx;
                oldVelZ = dz;
            }
        }

        let playerBB = this.getPlayerBB(pos);
        const queryBB = playerBB.clone().extend(dx, dy, dz);
        const surroundingBBs = this.getSurroundingBBs(queryBB);
        const oldBB = playerBB.clone();

        for (const blockBB of surroundingBBs) {
            dy = blockBB.computeOffsetY(playerBB, dy);
        }
        playerBB.offset(0, dy, 0);

        for (const blockBB of surroundingBBs) {
            dx = blockBB.computeOffsetX(playerBB, dx);
        }
        playerBB.offset(dx, 0, 0);

        for (const blockBB of surroundingBBs) {
            dz = blockBB.computeOffsetZ(playerBB, dz);
        }
        playerBB.offset(0, 0, dz);

        // Step on block if height < stepHeight
        if (
            this.settings.stepHeight > 0 &&
            (state.onGround || (dy !== oldVelY && oldVelY < 0)) &&
            (dx !== oldVelX || dz !== oldVelZ) &&
            this.extras.doCollisions &&
            !this.extras.ignoreVerticalCollisions
        ) {
            const oldVelXCol = dx;
            const oldVelYCol = dy;
            const oldVelZCol = dz;
            const oldBBCol = playerBB.clone();

            dy = this.settings.stepHeight;
            const queryBB = oldBB.clone().extend(oldVelX, dy, oldVelZ);
            const surroundingBBs = this.getSurroundingBBs(queryBB);

            const BB1 = oldBB.clone();
            const BB2 = oldBB.clone();
            const BB_XZ = BB1.clone().extend(dx, 0, dz);

            let dy1 = dy;
            let dy2 = dy;
            for (const blockBB of surroundingBBs) {
                dy1 = blockBB.computeOffsetY(BB_XZ, dy1);
                dy2 = blockBB.computeOffsetY(BB2, dy2);
            }
            BB1.offset(0, dy1, 0);
            BB2.offset(0, dy2, 0);

            let dx1 = oldVelX;
            let dx2 = oldVelX;
            for (const blockBB of surroundingBBs) {
                dx1 = blockBB.computeOffsetX(BB1, dx1);
                dx2 = blockBB.computeOffsetX(BB2, dx2);
            }
            BB1.offset(dx1, 0, 0);
            BB2.offset(dx2, 0, 0);

            let dz1 = oldVelZ;
            let dz2 = oldVelZ;
            for (const blockBB of surroundingBBs) {
                dz1 = blockBB.computeOffsetZ(BB1, dz1);
                dz2 = blockBB.computeOffsetZ(BB2, dz2);
            }
            BB1.offset(0, 0, dz1);
            BB2.offset(0, 0, dz2);

            const norm1 = dx1 * dx1 + dz1 * dz1;
            const norm2 = dx2 * dx2 + dz2 * dz2;

            if (norm1 > norm2) {
                dx = dx1;
                dy = -dy1;
                dz = dz1;
                playerBB = BB1;
            } else {
                dx = dx2;
                dy = -dy2;
                dz = dz2;
                playerBB = BB2;
            }

            for (const blockBB of surroundingBBs) {
                dy = blockBB.computeOffsetY(playerBB, dy);
            }
            playerBB.offset(0, dy, 0);

            if (oldVelXCol * oldVelXCol + oldVelZCol * oldVelZCol >= dx * dx + dz * dz) {
                dx = oldVelXCol;
                dy = oldVelYCol;
                dz = oldVelZCol;
                playerBB = oldBBCol;
            }
        }

        // Update flags
        this.setPositionToBB(playerBB, pos);
        state.sneakCollision = dx !== oldOldVelX || dz !== oldOldVelZ
        state.isCollidedHorizontally = dx !== oldVelX || dz !== oldVelZ;
        state.isCollidedVertically = dy !== oldVelY;
        state.onGround = state.isCollidedVertically && oldVelY < 0;

        if (
            this.extras.doCollisions &&
            !this.extras.ignoreHoriztonalCollisions &&
            !this.extras.customCollisionsOnly &&
            this.extras.doBlockInfoUpdates
        ) {
            const blockAtFeet = this.world.getBlock(pos.offset(0, -0.2, 0));

            if (dx !== oldVelX) vel.x = 0;
            if (dz !== oldVelZ) vel.z = 0;
            if (dy !== oldVelY) {
                if (blockAtFeet && blockAtFeet.type === this.slimeBlockId && !state.controlState.sneak) {
                    vel.y = -vel.y;
                } else {
                    vel.y = 0;
                }
            }
        } else if (this.extras.doCollisions && this.extras.customCollisionsOnly && !this.extras.ignoreHoriztonalCollisions) {
            const blockAtFeet = this.extras.getBlock(pos.offset(0, -0.2, 0));

            if (dx !== oldVelX) vel.x = 0;
            if (dz !== oldVelZ) vel.z = 0;
            if (dy !== oldVelY && blockAtFeet) {
                vel.y = 0;
            }
        }

        if (this.extras.doCollisions && this.extras.doBlockInfoUpdates) {
            // Finally, apply block collisions (web, soulsand...)
            playerBB.contract(0.001, 0.001, 0.001);
            const cursor = new Vec3(0, 0, 0);
            for (cursor.y = Math.floor(playerBB.minY); cursor.y <= Math.floor(playerBB.maxY); cursor.y++) {
                for (cursor.z = Math.floor(playerBB.minZ); cursor.z <= Math.floor(playerBB.maxZ); cursor.z++) {
                    for (cursor.x = Math.floor(playerBB.minX); cursor.x <= Math.floor(playerBB.maxX); cursor.x++) {
                        const block = this.world.getBlock(cursor);
                        if (block) {
                            if (this.supportFeature("velocityBlocksOnCollision")) {
                                if (block.type === this.soulsandId) {
                                    vel.x *= this.settings.soulsandSpeed;
                                    vel.z *= this.settings.soulsandSpeed;
                                } else if (block.type === this.honeyblockId) {
                                    vel.x *= this.settings.honeyblockSpeed;
                                    vel.z *= this.settings.honeyblockSpeed;
                                }
                            }
                            if (block.type === this.webId) {
                                state.isInWeb = true;
                            } else if (block.type === this.bubblecolumnId) {
                                const down = !block.metadata;
                                const aboveBlock = this.world.getBlock(cursor.offset(0, 1, 0));
                                const bubbleDrag =
                                    aboveBlock && aboveBlock.type === 0 /* air */
                                        ? this.settings.bubbleColumnSurfaceDrag
                                        : this.settings.bubbleColumnDrag;
                                if (down) {
                                    vel.y = Math.max(bubbleDrag.maxDown, vel.y - bubbleDrag.down);
                                } else {
                                    vel.y = Math.min(bubbleDrag.maxUp, vel.y + bubbleDrag.up);
                                }
                            }
                        }
                    }
                }
            }
            if (this.supportFeature("velocityBlocksOnTop")) {
                const blockBelow = this.world.getBlock(state.position.floored().offset(0, -0.5, 0));
                if (blockBelow) {
                    if (blockBelow.type === this.soulsandId) {
                        vel.x *= this.settings.soulsandSpeed;
                        vel.z *= this.settings.soulsandSpeed;
                    } else if (blockBelow.type === this.honeyblockId) {
                        vel.x *= this.settings.honeyblockSpeed;
                        vel.z *= this.settings.honeyblockSpeed;
                    }
                }
            }
        }
    }

    applyHeading(state: PlayerState, strafe: number, forward: number, multiplier: number) {
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

    getEffectLevel(effectName: string, effects: Effect[]) {
        const effectDescriptor = this.data.effectsByName[effectName];
        if (!effectDescriptor) {
            return 0;
        }
        const effectInfo = effects[effectDescriptor.id];
        if (!effectInfo) {
            return 0;
        }
        return effectInfo.amplifier + 1;
    }

    /**
     * Slightly modified since I cannot find the typing.
     */
    getEnchantmentLevelTest(enchantmentName: string, enchantments: NormalizedEnchant[]) {
        const enchantmentDescriptor = this.data.enchantmentsByName[enchantmentName];
        if (!enchantmentDescriptor) {
            return 0;
        }

        for (const enchInfo of enchantments) {
            if (typeof enchInfo.name === "string") {
                if (enchInfo.name.includes(enchantmentName)) {
                    return enchInfo.lvl;
                }
            } else if (enchInfo.name === enchantmentDescriptor.id) {
                return enchInfo.lvl;
            }
        }
        return 0;
    }

    getEnchantmentLevel(enchantmentName: string, enchantments: any[]) {
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

    isOnLadder(pos: { x: number; y: number; z: number }) {
        const block = this.world.getBlock(pos);
        return block && (block.type === this.ladderId || block.type === this.vineId);
    }

    doesNotCollide(pos: { x: number; y: number; z: number }) {
        const pBB = this.getPlayerBB(pos);
        return !this.getSurroundingBBs(pBB).some((x) => pBB.intersects(x)) && this.getWaterInBB(pBB).length === 0;
    }

    isMaterialInBB(queryBB: AABB, type: number) {
        if (!this.extras.doBlockInfoUpdates || this.extras.customCollisionsOnly) return false; //custom collisions has no block type knowledge.

        const cursor = new Vec3(0, 0, 0);
        for (cursor.y = Math.floor(queryBB.minY); cursor.y <= Math.floor(queryBB.maxY); cursor.y++) {
            for (cursor.z = Math.floor(queryBB.minZ); cursor.z <= Math.floor(queryBB.maxZ); cursor.z++) {
                for (cursor.x = Math.floor(queryBB.minX); cursor.x <= Math.floor(queryBB.maxX); cursor.x++) {
                    const block = this.world.getBlock(cursor);
                    if (block && block.type === type) return true;
                }
            }
        }
        return false;
    }

    getWaterInBB(bb: AABB) {
        if (!this.extras.doBlockInfoUpdates || this.extras.customCollisionsOnly) return []; //see line 451 comment.
        const waterBlocks = [];
        const cursor = new Vec3(0, 0, 0);
        for (cursor.y = Math.floor(bb.minY); cursor.y <= Math.floor(bb.maxY); cursor.y++) {
            for (cursor.z = Math.floor(bb.minZ); cursor.z <= Math.floor(bb.maxZ); cursor.z++) {
                for (cursor.x = Math.floor(bb.minX); cursor.x <= Math.floor(bb.maxX); cursor.x++) {
                    const block = this.world.getBlock(cursor);
                    if (block && (block.type === this.waterId || this.waterLike.has(block.type) || block.getProperties().waterlogged)) {
                        const waterLevel = cursor.y + 1 - this.getLiquidHeightPcent(block);
                        if (Math.ceil(bb.maxY) >= waterLevel) waterBlocks.push(block);
                    }
                }
            }
        }
        return waterBlocks;
    }

    getLiquidHeightPcent(block: Block) {
        return (this.getRenderedDepth(block) + 1) / 9;
    }

    getRenderedDepth(block: Block) {
        if (!block) return -1;
        if (this.waterLike.has(block.type)) return 0;
        if (block.getProperties().waterlogged) return 0;
        if (block.type !== this.waterId) return -1;
        const meta = block.metadata;
        return meta >= 8 ? 0 : meta;
    }

    getFlow(block: Block) {
        const flow = new Vec3(0, 0, 0);
        if (!this.extras.doBlockInfoUpdates || this.extras.customCollisionsOnly) return flow; // see line 451 comment.
        const curlevel = this.getRenderedDepth(block);

        for (const [dx, dz] of [
            [0, 1],
            [-1, 0],
            [0, -1],
            [1, 0],
        ]) {
            const adjBlock = this.world.getBlock(block.position.offset(dx, 0, dz));
            const adjLevel = this.getRenderedDepth(adjBlock);
            if (adjLevel < 0) {
                if (adjBlock && adjBlock.boundingBox !== "empty") {
                    const adjLevel = this.getRenderedDepth(this.world.getBlock(block.position.offset(dx, -1, dz)));
                    if (adjLevel >= 0) {
                        const f = adjLevel - (curlevel - 8);
                        flow.x += dx * f;
                        flow.z += dz * f;
                    }
                }
            } else {
                const f = adjLevel - curlevel;
                flow.x += dx * f;
                flow.z += dz * f;
            }
        }

        if (block.metadata >= 8) {
            for (const [dx, dz] of [
                [0, 1],
                [-1, 0],
                [0, -1],
                [1, 0],
            ]) {
                const adjBlock = this.world.getBlock(block.position.offset(dx, 0, dz));
                const adjUpBlock = this.world.getBlock(block.position.offset(dx, 1, dz));
                if ((adjBlock && adjBlock.boundingBox !== "empty") || (adjUpBlock && adjUpBlock.boundingBox !== "empty")) {
                    flow.normalize().translate(0, -6, 0);
                }
            }
        }

        return flow.normalize();
    }

    //edit velocity vector internally, not a return value.
    isInWaterApplyCurrent(bb: AABB, vel: { x: number; y: number; z: number }) {
        if (!this.extras.doBlockInfoUpdates || this.extras.customCollisionsOnly) return false; //see line 451 comment.
        const acceleration = new Vec3(0, 0, 0);
        const waterBlocks = this.getWaterInBB(bb);
        const isInWater = waterBlocks.length > 0;
        for (const block of waterBlocks) {
            const flow = this.getFlow(block);
            acceleration.add(flow);
        }

        const len = acceleration.norm();
        if (len > 0) {
            vel.x += (acceleration.x / len) * 0.014;
            vel.y += (acceleration.y / len) * 0.014;
            vel.z += (acceleration.z / len) * 0.014;
        }
        return isInWater;
    }

    movestateWithHeading(state: PlayerState, strafe: number, forward: number) {
        const vel = state.velocity;
        const pos = state.position;

        const gravityMultiplier = vel.y <= 0 && state.slowFalling > 0 ? this.settings.slowFalling : 1;

        if (!state.isInWater && !state.isInLava) {
            // Normal movement
            let acceleration = this.settings.airborneAcceleration;
            let inertia = this.settings.airborneInertia;

            let blockUnder;
            if (this.extras.doCollisions && !this.extras.customCollisionsOnly) {
                blockUnder = this.world.getBlock(pos.offset(0, -1, 0));
            } else if (this.extras.doCollisions) {
                blockUnder = this.extras.getBlock(pos.offset(0, -1, 0));
            } else {
                blockUnder = false;
            }
            if (state.onGround && blockUnder) {
                let playerSpeedAttribute;
                if (state.attributes && state.attributes[this.settings.movementSpeedAttribute]) {
                    // Use server-side player attributes
                    playerSpeedAttribute = state.attributes[this.settings.movementSpeedAttribute];
                } else {
                    // Create an attribute if the player does not have it
                    playerSpeedAttribute = attributes.createAttributeValue(this.settings.playerSpeed);
                }
                // Client-side sprinting (don't rely on server-side sprinting)
                // setSprinting in Livingstate.java
                playerSpeedAttribute = attributes.deleteAttributeModifier(playerSpeedAttribute, this.settings.sprintingUUID); // always delete sprinting (if it exists)
                if (state.controlState.sprint) {
                    if (!attributes.checkAttributeModifier(playerSpeedAttribute, this.settings.sprintingUUID)) {
                        playerSpeedAttribute = attributes.addAttributeModifier(playerSpeedAttribute, {
                            uuid: this.settings.sprintingUUID,
                            amount: this.settings.sprintSpeed,
                            operation: 2,
                        });
                    }
                }
                // Calculate what the speed is (0.1 if no modification)
                const attributeSpeed = attributes.getAttributeValue(playerSpeedAttribute);
                inertia = (this.blockSlipperiness[blockUnder.type] || this.settings.defaultSlipperiness) * 0.91;
                acceleration = attributeSpeed * (0.1627714 / (inertia * inertia * inertia));
                if (acceleration < 0) acceleration = 0; // acceleration should not be negative
            }

            this.applyHeading(state, strafe, forward, acceleration);

            if (this.extras.doCollisions && !this.extras.customCollisionsOnly) {
                if (this.isOnLadder(pos)) {
                    vel.x = math.clamp(-this.settings.ladderMaxSpeed, vel.x, this.settings.ladderMaxSpeed);
                    vel.z = math.clamp(-this.settings.ladderMaxSpeed, vel.z, this.settings.ladderMaxSpeed);
                    vel.y = Math.max(vel.y, state.controlState.sneak ? 0 : -this.settings.ladderMaxSpeed);
                }
            }

            this.movestate(state, vel.x, vel.y, vel.z);

            if (this.extras.doCollisions && !this.extras.customCollisionsOnly) {
                if (
                    this.isOnLadder(pos) &&
                    (state.isCollidedHorizontally || (this.supportFeature("climbUsingJump") && state.controlState.jump))
                ) {
                    vel.y = this.settings.ladderClimbSpeed; // climb ladder
                }
            }

            // Apply friction and gravity
            if (state.levitation > 0) {
                vel.y += (0.05 * state.levitation - vel.y) * 0.2;
            } else {
                vel.y -= this.settings.gravity * gravityMultiplier;
            }
            vel.y *= this.settings.airdrag;
            vel.x *= inertia;
            vel.z *= inertia;
        } else {
            // Water / Lava movement
            const lastY = pos.y;
            let acceleration = this.settings.liquidAcceleration;
            const inertia = state.isInWater ? this.settings.waterInertia : this.settings.lavaInertia;
            let horizontalInertia = inertia;

            if (state.isInWater) {
                let strider = Math.min(state.depthStrider, 3);
                if (!state.onGround) {
                    strider *= 0.5;
                }
                if (strider > 0) {
                    horizontalInertia += ((0.546 - horizontalInertia) * strider) / 3;
                    acceleration += ((0.7 - acceleration) * strider) / 3;
                }

                if (state.dolphinsGrace > 0) horizontalInertia = 0.96;
            }

            this.applyHeading(state, strafe, forward, acceleration);
            this.movestate(state, vel.x, vel.y, vel.z);
            vel.y *= inertia;
            vel.y -= (state.isInWater ? this.settings.waterGravity : this.settings.lavaGravity) * gravityMultiplier;
            vel.x *= horizontalInertia;
            vel.z *= horizontalInertia;

            if (state.isCollidedHorizontally && this.doesNotCollide(pos.offset(vel.x, vel.y + 0.6 - pos.y + lastY, vel.z))) {
                vel.y = this.settings.outOfLiquidImpulse; // jump out of liquid
            }
        }
    }

    simulatePlayer(state: PlayerState) {
        const vel = state.velocity;
        const pos = state.position;

        const waterBB = this.getPlayerBB(pos).contract(0.001, 0.401, 0.001);
        const lavaBB = this.getPlayerBB(pos).contract(0.1, 0.4, 0.1);

        state.isInWater = this.isInWaterApplyCurrent(waterBB, vel);
        state.isInLava = this.isMaterialInBB(lavaBB, this.lavaId);

        // Reset velocity component if it falls under the threshold
        if (Math.abs(vel.x) < this.settings.negligeableVelocity) vel.x = 0;
        if (Math.abs(vel.y) < this.settings.negligeableVelocity) vel.y = 0;
        if (Math.abs(vel.z) < this.settings.negligeableVelocity) vel.z = 0;

        // Handle inputs
        if (state.controlState.jump || state.jumpQueued) {
            if (state.jumpTicks > 0) state.jumpTicks--;
            if (state.isInWater || state.isInLava) {
                vel.y += 0.04;
            } else if (state.onGround && state.jumpTicks === 0) {
                let blockUnder;
                if (this.extras.doCollisions && !this.extras.customCollisionsOnly) {
                    blockUnder = this.world.getBlock(pos.offset(0, -1, 0));
                    vel.y =
                        Math.fround(0.42) * (blockUnder && blockUnder.type === this.honeyblockId ? this.settings.honeyblockJumpSpeed : 1);
                } else if (this.extras.doCollisions) {
                    blockUnder = this.extras.getBlock(pos.offset(0, -1, 0));
                    if (blockUnder) vel.y = Math.fround(0.42);
                } else {
                    blockUnder = false;
                }
                // const blockUnder = this.world.getBlock(state.pos.floored().offset(0, -0.5, 0));
                if (state.jumpBoost > 0) {
                    vel.y += 0.1 * state.jumpBoost;
                }
                if (state.controlState.sprint) {
                    const yaw = Math.PI - state.yaw;
                    vel.x -= Math.sin(yaw) * 0.2;
                    vel.z += Math.cos(yaw) * 0.2;
                }
                state.jumpTicks = this.settings.autojumpCooldown;
            }
        } else {
            state.jumpTicks = 0; // reset autojump cooldown
        }
        state.jumpQueued = false;

        let strafe = Number(state.controlState.left) - Number(state.controlState.right) * 0.98;
        let forward = Number(state.controlState.forward) - Number(state.controlState.back) * 0.98;

        if (state.controlState.sneak) {
            // console.log("sneakin")
            // strafe *= this.physics.sneakSpeed;
            // forward *= this.physics.sneakSpeed;
        }

        if (state.isUsingItem) {
            console.log("before:", strafe, forward);
            strafe *= this.settings.usingItemSpeed;
            forward *= this.settings.usingItemSpeed;
            console.log("after:", strafe, forward);
        }

        this.movestateWithHeading(state, strafe, forward);

        return state;
    }
}
