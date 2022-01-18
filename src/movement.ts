import { Vec3 } from "vec3";
import {Node} from "./node"

export class Movement extends Vec3 {

    public deltaBlocks: number;
    public readonly hash: string;
    public readonly direction: Vec3;
    constructor(
        public origin: Node,
        x: number,
        y: number,
        z: number,
        public cost: number,
        public toBreak: { x: number; y: number; z: number }[] = [],
        public toPlace: { x: number; y: number; z: number }[] = [],
        public safeToCancel: boolean = false
    ) {
        super(Math.floor(x), Math.floor(y), Math.floor(z));
        this.deltaBlocks = /* toPlace.length */ -toBreak.length; // if uncomment, assume pick up blocks. This is probably really bad, lol.
        this.direction = new Vec3(this.origin.x - this.x, this.origin.y - this.y, this.origin.z - this.z)
        this.hash = this.x + "," + this.y + "," + this.z;
    }
}
