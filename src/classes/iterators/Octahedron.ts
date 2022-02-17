import { Vec3 } from "vec3";

export class OctahedronIterator {
    public start: Vec3;
    public maxDistance: number;
    public apothem: number;
    public x: number;
    public y: number;
    public z: number;
    public L: number;
    public R: number;

    constructor(start: Vec3, maxDistance: number) {
        this.start = start.floored();
        this.maxDistance = maxDistance;
        this.apothem = 1;
        this.x = -1;
        this.y = -1;
        this.z = -1;
        this.L = this.apothem;
        this.R = this.L + 1;
    }

    next() {
        if (this.apothem > this.maxDistance) return null;
        this.R -= 1;
        if (this.R < 0) {
            this.L -= 1;
            if (this.L < 0) {
                this.z += 2;
                if (this.z > 1) {
                    this.y += 2;
                    if (this.y > 1) {
                        this.x += 2;
                        if (this.x > 1) {
                            this.apothem += 1;
                            this.x = -1;
                        }
                        this.y = -1;
                    }
                    this.z = -1;
                }
                this.L = this.apothem;
            }
            this.R = this.L;
        }
        const X = this.x * this.R;
        const Y = this.y * (this.apothem - this.L);
        const Z = this.z * (this.apothem - (Math.abs(X) + Math.abs(Y)));
        return this.start.offset(X, Y, Z);
    }


    [Symbol.iterator]() {
        return {
            next: () => ({
                value: this.next()!,
                done: this.apothem > this.maxDistance,
            }),
        };
    }
}

// let i = 0;
// for (const val of new OctahedronIterator(new Vec3(0, 0, 0), 16)) {
//     console.log(val, i++);
// }
