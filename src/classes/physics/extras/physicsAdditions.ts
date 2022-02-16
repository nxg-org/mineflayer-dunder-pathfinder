/**
 * this stores info that may not be required by the Physics engine itself.
 */

import { AABB } from "@nxg-org/mineflayer-util-plugin";
import { Vec3 } from "vec3";
import { hash, hashAABB } from "./physicsUtils";

 export interface IPhysicsAdditions {
    doCollisions: boolean;
    doBlockInfoUpdates: boolean;
    customCollisionsOnly: boolean;
    ignoreHoriztonalCollisions: boolean;
    ignoreVerticalCollisions: boolean;
    detectAnyway?: Map<string, AABB>;
}

export class PhysicsAdditions implements IPhysicsAdditions {
    public detectAnyway: Map<string, AABB>;
    constructor(
        // comment for formatting
        public doCollisions: boolean = true,
        public doBlockInfoUpdates: boolean = true,
        public customCollisionsOnly: boolean = false,
        public ignoreHoriztonalCollisions: boolean = false,
        public ignoreVerticalCollisions: boolean = false,
        detectAnywayMap?: Map<string, AABB>
    ) {
        this.detectAnyway = detectAnywayMap ?? new Map();
    }

    public static fromOptions(
        options: IPhysicsAdditions = { doCollisions: true, doBlockInfoUpdates: true, customCollisionsOnly: false, ignoreHoriztonalCollisions: false, ignoreVerticalCollisions: false }
    ) {
        return new PhysicsAdditions(
            options.doCollisions,
            options.doBlockInfoUpdates,
            options.customCollisionsOnly,
            options.ignoreHoriztonalCollisions,
            options.ignoreVerticalCollisions,
            options.detectAnyway ?? new Map()
        );
    }

    public getBlock(vec: Vec3): AABB | undefined {
        return this.getAABBBlockPos(vec);
    }

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
        const aabb = new AABB(min.x, min.y, min.z, min.x + 1, min.y + 1, min.z + 1);
        this.detectAnyway.set(hash(min.x, min.y, min.z, min.x + 1, min.y + 1, min.z + 1), aabb);
    }
    public removeAABBBlockPos(min: Vec3): void {
        this.detectAnyway.delete(hash(min.x, min.y, min.z, min.x + 1, min.y + 1, min.z + 1));
    }
    public getAABBBlockPos(min: Vec3): AABB | undefined {
        return this.detectAnyway.get(hash(min.x, min.y, min.z, min.x + 1, min.y + 1, min.z + 1));
    }
    // AABBVecs
    public shouldAABBVecs(min: Vec3, max: Vec3): boolean {
        return this.detectAnyway.has(hash(min.x, min.y, min.z, max.x, max.y, max.z));
    }
    public detectAABBVecs(min: Vec3, max: Vec3): void {
        const aabb = new AABB(min.x, min.y, min.z, max.x, max.y, max.z);
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
    public detectAABBCoords(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): void {
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
        return;
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
