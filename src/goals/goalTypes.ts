import type { Vec3 } from "vec3";

export type PredictiveFunction = (distanceToGoal: Vec3, currentPos: Vec3, vel: Vec3) => Vec3;
