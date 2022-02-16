/**
 * this stores info that may not be required by the Physics engine itself.
 */

import { AABB } from "@nxg-org/mineflayer-util-plugin";
import { Vec3 } from "vec3";
import { hash, hashAABB } from "../extras/physicsUtils";
import { BaseWorld } from "./baseWorld";


export class MapWorld implements BaseWorld {
    public internal: Map<string, AABB>;

    constructor(detectAnywayMap?: Map<string, AABB>) {
        this.internal = detectAnywayMap ?? new Map();
    }

    public getBlock(vec: Vec3): AABB | null {
        return this.getAABBBlockPos(vec);
    }

    // AABB
    public shouldAABB(aabb: AABB): boolean {
        return this.internal.has(hashAABB(aabb));
    }
    public detectAABB(aabb: AABB): void {
        this.internal.set(hashAABB(aabb), aabb);
    }
    public removeAABB(aabb: AABB): void {
        this.internal.delete(hashAABB(aabb));
    }
    // AABBBlockPos
    public shouldAABBBlockPos(min: Vec3): boolean {
        return this.internal.has(hash(min.x, min.y, min.z, min.x + 1, min.y + 1, min.z + 1));
    }
    public detectAABBBlockPos(min: Vec3): void {
        const aabb = new AABB(min.x, min.y, min.z, min.x + 1, min.y + 1, min.z + 1);
        this.internal.set(hash(min.x, min.y, min.z, min.x + 1, min.y + 1, min.z + 1), aabb);
    }
    public removeAABBBlockPos(min: Vec3): void {
        this.internal.delete(hash(min.x, min.y, min.z, min.x + 1, min.y + 1, min.z + 1));
    }
    public getAABBBlockPos(min: Vec3): AABB | null {
        return this.internal.get(hash(min.x, min.y, min.z, min.x + 1, min.y + 1, min.z + 1)) ?? null;
    }
    // AABBVecs
    public shouldAABBVecs(min: Vec3, max: Vec3): boolean {
        return this.internal.has(hash(min.x, min.y, min.z, max.x, max.y, max.z));
    }
    public detectAABBVecs(min: Vec3, max: Vec3): void {
        const aabb = new AABB(min.x, min.y, min.z, max.x, max.y, max.z);
        this.internal.set(hash(min.x, min.y, min.z, max.x, max.y, max.z), aabb);
    }
    public removeAABBVecs(min: Vec3, max: Vec3): void {
        this.internal.delete(hash(min.x, min.y, min.z, max.x, max.y, max.z));
    }
    public getAABBVecs(min: Vec3, max: Vec3): AABB | null {
        return this.internal.get(hash(min.x, min.y, min.z, max.x, max.y, max.z)) ?? null;
    }
    // AABBBlockCoords
    public shouldAABBBlockCoords(x: number, y: number, z: number): boolean {
        x = Math.floor(x);
        y = Math.floor(y);
        z = Math.floor(z);
        return this.internal.has(hash(x, y, z, x + 1, y + 1, z + 1));
    }
    public detectAABBBlockCoords(x: number, y: number, z: number): void {
        x = Math.floor(x);
        y = Math.floor(y);
        z = Math.floor(z);
        let aabb = new AABB(x, y, z, x + 1, y + 1, z + 1);
        this.internal.set(hash(x, y, z, x + 1, y + 1, z + 1), aabb);
    }
    public removeAABBBlockCoords(x: number, y: number, z: number): void {
        x = Math.floor(x);
        y = Math.floor(y);
        z = Math.floor(z);
        this.internal.delete(hash(x, y, z, x + 1, y + 1, z + 1));
    }
    public getAABBBlockCoords(x: number, y: number, z: number): AABB | null {
        x = Math.floor(x);
        y = Math.floor(y);
        z = Math.floor(z);
        return this.internal.get(hash(x, y, z, x + 1, y + 1, z + 1)) ?? null;
    }
    // AABBCoords
    public shouldAABBCoords(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): boolean {
        return this.internal.has(hash(x0, y0, z0, x1, y1, z1));
    }
    public detectAABBCoords(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): void {
        let aabb = new AABB(x0, y0, z0, x1, y1, z1);
        this.internal.set(hash(x0, y0, z0, x1, y1, z1), aabb);
    }
    public removeAABBCoords(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): void {
        this.internal.delete(hash(x0, y0, z0, x1, y1, z1));
    }
    public getAABBCoords(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): AABB | null {
        return this.internal.get(hash(x0, y0, z0, x1, y1, z1)) ?? null;
    }

    /**
     * Push to provided array.
     * @param other 
     * @param results 
     */
    public getIntersectingAABB(other: AABB, results: AABB[] = []): AABB[] {
        for (const aabb of this.internal.values()) {
            if (aabb.intersects(other)) {
                results.push(aabb)
            }
        }
        return results;
    }

    public hasAABBThatIntesects(other: AABB): boolean {
        for (const aabb of this.internal.values()) {
            if (aabb.intersects(other)) {
                return true;
            }
        }
        return false;
    }

    // [Symbol.iterator]() {
    //     let index = -1;
    //     let data  = this.internal.values();
    
    //     return {
    //       next: () => ({ value: data[++index], done: !(index in data) })
    //     };
    //   };
}
