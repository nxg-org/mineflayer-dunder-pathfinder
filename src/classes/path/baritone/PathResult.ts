import { IPath } from "./pathTypes/IPath";

export enum PathType {
    SUCCESS_TO_GOAL,
    SUCCESS_SEGMENT,
    FAILURE,
    CANCELLATION,
    EXCEPTION,
}



export class PathCalculationResult {

    public readonly path?: IPath;
    public readonly type: PathType;

    constructor(type: PathType, path?: IPath) {
        this.path = path;
        this.type = type;
    }
}