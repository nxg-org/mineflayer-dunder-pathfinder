import { AABB } from "@nxg-org/mineflayer-util-plugin";
import { Block } from "prismarine-block";
import { Vec3 } from "vec3";
import stuff, {iterators} from "prismarine-world"
export interface BaseWorld {
    getBlock(block: Vec3): Block | AABB | null;


}