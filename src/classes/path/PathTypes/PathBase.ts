import { BaseGoal } from "../../goals";
import { CutoffPath } from "./CutOffPath";
import { IPath } from "./IPath";

export abstract class PathBase extends IPath {

    public cutoffAtLoadedChunks(bsi: any/* Object bsi0 */): PathBase { // <-- cursed cursed cursed
        // if (!Baritone.settings().cutoffAtLoadBoundary.value) {
        //     return this;
        // }
        // BlockStateInterface bsi = (BlockStateInterface) bsi0;
        for (let i = 0; i < this.positions.length; i++) {
            const pos = this.positions[i];
            if (!bsi.worldContainsLoadedChunk(pos.x, pos.z)) {
                return CutoffPath.TO_END(this, i);
            }
        }
        return this;
    }


    public staticCutoff(destination: BaseGoal): PathBase {
        // int min = BaritoneAPI.getSettings().pathCutoffMinimumLength.value;
        // if (this.length() < min) {
        //     return this;
        // }
        if (destination.goalReached(this.getDest())) {
            return this;
        }
        // let factor = BaritoneAPI.getSettings().pathCutoffFactor.value;
        // let newLength = ((this.length() - min) * factor) + min - 1;
        //return CutoffPath.TO_END(this, newLength);
        throw "fuck, not implemented yet (PathBase:32)"
    }
}