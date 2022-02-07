import type { Vec3 } from "vec3";
import { BetterBlockPos } from "./betterBlockPos";

export enum IBlockType {
    PLACE,
    BREAK,
}
export class BlockInteraction {
    public hash: string;
    constructor(public type: IBlockType, public dest: BetterBlockPos, public reference?: BetterBlockPos, public blockType?: string) {
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
