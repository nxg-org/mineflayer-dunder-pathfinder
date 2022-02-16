import { AABB } from "@nxg-org/mineflayer-util-plugin";
import { Vec3 } from "vec3";
import { ControlStateHandler } from "../../player/playerControls";

//0: STANDING, 1: FALL_FLYING, 2: SLEEPING, 3: SWIMMING, 4: SPIN_ATTACK, 5: SNEAKING, 6: LONG_JUMPING, 7: DYING
export enum PlayerPoses {
    STANDING,
    FALL_FLYING,
    SLEEPING,
    SWIMMING,
    SPIN_ATTACK, // dunno
    SNEAKING,
    LONG_JUMPING,
    DYING,
}

const defaultMoves: ControlStateHandler = ControlStateHandler.DEFAULT();

//Utility class that wraps PlayerPoses.
export class EntityDimensions {
    public readonly width: number;
    public readonly height: number;
    public readonly fixed: boolean;

    constructor(width: number, height: number, fixed: boolean) {
        this.width = width;
        this.height = height;
        this.fixed = fixed;
    }

    public static scalable(f: number, f2: number): EntityDimensions {
        return new EntityDimensions(f, f2, false);
    }

    public static fixed(f: number, f2: number): EntityDimensions {
        return new EntityDimensions(f, f2, true);
    }

    makeBoundingBox(vec3: Vec3): AABB {
        return this.makeBoundingBoxCoords(vec3.x, vec3.y, vec3.z);
    }

    public makeBoundingBoxCoords(d: number, d2: number, d3: number): AABB {
        const f = this.width / 2.0;
        const f2 = this.height;
        return new AABB(d - f, d2, d3 - f, d + f, d2 + f2, d3 + f);
    }

    public scale(f: number): EntityDimensions {
        return this.scaleRaw(f, f);
    }

    public scaleRaw(f: number, f2: number): EntityDimensions {
        if (this.fixed || (f == 1.0 && f2 == 1.0)) {
            return this;
        }
        return EntityDimensions.scalable(this.width * f, this.height * f2);
    }

    public toString(): String {
        return "EntityDimensions w=" + this.width + ", h=" + this.height + ", fixed=" + this.fixed;
    }
}