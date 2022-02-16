import { CheapPhysics } from "../engines/cheapPhysics";
import md from "minecraft-data";
import { Vec3 } from "vec3";
import { ControlStateStatus } from "mineflayer";
import { ControlsIndexedByTick, MovementData } from "../../movement/movementData";
import { CheapPlayerStateBuilder, CheapPlayerState } from "../states/cheapState";
import { Block } from "prismarine-block";
import { CheapSim } from "./cheapSim";
import { BaseWorld } from "../worlds/baseWorld";
import { MapWorld } from "../worlds/mapWorld";
import { hash, hashAABB } from "../extras/physicsUtils";
import { AABB } from "@nxg-org/mineflayer-util-plugin";

export class JumpIterator {
    public ctx: CheapPhysics;
    public world: MapWorld;

    constructor(data: md.IndexedData, world: any) {
        this.ctx = new CheapPhysics(data, world);
        this.world = world;
    }

    async getJumpPath(obj: CheapPlayerStateBuilder, controls: MovementData) {
        const state = CheapPlayerState.CREATE_RAW(this.ctx, obj);
        const sim = new CheapSim(this.ctx, state);
        const blockAABBs: Map<String, AABB> = new Map();
        const positions: Vec3[] = [];
        const simGen = sim.simulateGenerator((state) => {
            const tmp = this.world.getIntersectingAABB(state.getAABB(), []);
            tmp.forEach(b => blockAABBs.set(hashAABB(b), b));
            return tmp.length !== 0;
        }, controls);

        for await (const pos of simGen) {
            positions.push(pos);
        }

        return {positions, blockAABBs}
    }
}
