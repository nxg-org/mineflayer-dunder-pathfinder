import { AABB } from "@nxg-org/mineflayer-util-plugin";
import { Block } from "prismarine-block";
import { Vec3 } from "vec3";

export interface BaseWorld {
    getBlock(block: Vec3): Block | AABB | null;


}