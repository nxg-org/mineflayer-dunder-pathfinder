import { AABB } from "@nxg-org/mineflayer-util-plugin";
import md from "minecraft-data";
import { Entity } from "prismarine-entity";
import { Vec3 } from "vec3";
import features from "./lib/features.json";

export function makeSupportFeature(mcData: md.IndexedData) {
    return (feature: string) => features.some(({ name, versions }) => name === feature && versions.includes(mcData.version.majorVersion!));
}

// hashes are as such:
// bits      | value
// 0 - 25    | x0
// 26 - 51   | z0
// 52 - 63   | y0
// 64 - 89   | x1
// 90 - 115  | z1
// 116 - 128 | y1
export function hash(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) {
    return x0 + "," + y0 + "," + z0 + "," + x1 + "," + y1 + "," + z1;
    //BigInt(x0) + (BigInt(z0) << 26n) + (BigInt(y0) << 52n) + (BigInt(x1) << 64n) + (BigInt(z1) << 90n) + (BigInt(y1) << 116n);
}
export function hashAABB(aabb: AABB) {
    return aabb.minX + "," + aabb.minY + "," + aabb.minZ + "," + aabb.maxX + "," + aabb.maxY + "," + aabb.maxZ;
    // return (
    //     BigInt(aabb.minX) +
    //     (BigInt(aabb.minZ) << 26n) +
    //     (BigInt(aabb.minY) << 52n) +
    //     (BigInt(aabb.maxX) << 64n) +
    //     (BigInt(aabb.maxZ) << 90n) +
    //     (BigInt(aabb.maxY) << 116n)
    // );
}

export function isEntityUsingItem(entity: Entity): boolean {
    return ((entity.metadata[8] as any) & 1) > 0;
}

export function whichHandIsEntityUsing(entity: Entity): "hand" | "off-hand" {
    return ((entity.metadata[8] as any) & 2) > 0 ? "off-hand" : "hand";
}

export function whichHandIsEntityUsingBoolean(entity: Entity): boolean {
    return ((entity.metadata[8] as any) & 2) > 0; // true = offhand, false = hand
}

export function getStatusEffectNamesForVersion(supportFeature: ReturnType<typeof makeSupportFeature>) {
    if (supportFeature("effectNamesAreRegistryNames")) {
        return {
            jumpBoostEffectName: "jump_boost",
            speedEffectName: "speed",
            slownessEffectName: "slowness",
            dolphinsGraceEffectName: "dolphins_grace",
            slowFallingEffectName: "slow_falling",
            levitationEffectName: "levitation",
        };
    } else {
        return {
            jumpBoostEffectName: "JumpBoost",
            speedEffectName: "Speed",
            slownessEffectName: "Slowness",
            dolphinsGraceEffectName: "DolphinsGrace",
            slowFallingEffectName: "SlowFalling",
            levitationEffectName: "Levitation",
        };
    }
}

export function getBetweenRectangle(src: AABB, dest: AABB) {
    const outerAABB = new AABB(
        Math.min(src.minX, dest.minX),
        Math.min(src.minY, dest.minY),
        Math.min(src.minZ, dest.minZ),
        Math.max(src.maxX, dest.maxX),
        Math.max(src.maxY, dest.maxY),
        Math.max(src.maxZ, dest.maxZ)
    );


    //Math.max() only good for length, otherwise leave because we want good shit.
    const innerAABBWidth = (outerAABB.maxX - outerAABB.minX) - (src.maxX - src.minX) - (dest.maxX - dest.minX);
    const innerAABBLength = (outerAABB.maxZ - outerAABB.minZ) - (src.maxZ - src.minZ) - (dest.maxZ - dest.minZ);
    const innerAABBHeight = (outerAABB.maxY - outerAABB.minY) - (src.maxY - src.minY) - (dest.maxY - dest.minY);

    //hm... could make a new AABB representing inner here.
    const outerCenter = outerAABB.getCenter();
    const wFlip = Math.sign(innerAABBWidth)
    const hFlip = Math.sign(innerAABBHeight)
    const lFlip = Math.sign(innerAABBLength)
    const innerAABB = new AABB(
        outerCenter.x - wFlip * innerAABBWidth / 2,
        outerCenter.y - hFlip * innerAABBHeight / 2,
        outerCenter.z - lFlip * innerAABBLength / 2,
        outerCenter.x + wFlip * innerAABBWidth / 2,
        outerCenter.y + hFlip * innerAABBHeight / 2,
        outerCenter.z + lFlip * innerAABBLength / 2,
    );
    // const length = Math.sqrt(Math.max(0, innerAABBHeight) ** 2 + Math.max(0, innerAABBLength) ** 2 + Math.max(0, innerAABBWidth) ** 2);
   
    return innerAABB
}
