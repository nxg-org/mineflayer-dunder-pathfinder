import md from "minecraft-data"
import { Entity } from "prismarine-entity";
import * as features from "./lib/features.json"

export function makeSupportFeature(mcData: md.IndexedData) {
    return (feature: string) => features.some(({ name, versions }) => name === feature && versions.includes(mcData.version.majorVersion!));
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