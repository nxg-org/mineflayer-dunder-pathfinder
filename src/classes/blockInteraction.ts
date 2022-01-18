import type { Vec3 } from "vec3";

export enum IBlockType {
    PLACE,
    BREAK
}
export class BlockInteraction {
    public hash: string;
    constructor(public type: IBlockType, public destination: Vec3, public reference?: Vec3, public blockType?: string) {
        this.hash =
            type +
            ":" +
            destination.x +
            "," +
            destination.y +
            "," +
            destination.z +
            ":" +
            (reference ? reference.x + "," + reference.y + "," + reference.z : "none");
    }
}
