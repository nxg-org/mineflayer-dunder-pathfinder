import type { Vec3 } from "vec3";
import { BetterBlockPos } from "./betterBlockPos";

export enum IBlockType {
    PLACE,
    BREAK,
}
export class BlockInteraction {
    public hash: string;
    constructor(public type: IBlockType, public dest: Vec3, public reference?: Vec3, public blockType?: string) {
        this.hash =
            type +
            ":" +
            dest.x +
            "," +
            dest.y +
            "," +
            dest.z +
            ":" +
            (reference ? reference.x + "," + reference.y + "," + reference.z : "none");
    }
}
