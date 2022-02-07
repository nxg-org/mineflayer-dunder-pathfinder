import { AABB } from "@nxg-org/mineflayer-util-plugin";
import md from "minecraft-data"
import { Entity } from "prismarine-entity";
import features from "./lib/features.json"



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
export function hash(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number){
    return x0+ "," + y0 + "," + z0+ "," + x1 + "," + y1 + "," + z1;
    //BigInt(x0) + (BigInt(z0) << 26n) + (BigInt(y0) << 52n) + (BigInt(x1) << 64n) + (BigInt(z1) << 90n) + (BigInt(y1) << 116n);
}
export function hashAABB(aabb: AABB) {
    return aabb.minX + "," + aabb.minY + "," + aabb.minZ + "," + aabb.maxX + "," + aabb.maxY + "," + aabb.maxZ
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
    return (((entity.metadata[8] as any) & 1) > 0);
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