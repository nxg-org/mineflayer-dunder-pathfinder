import { MovementEnum, SwimmingMovements } from "./constants";




export class MovementInfo {


    constructor() {

    }

    isSwimMovement(movementType: MovementEnum) {
        return SwimmingMovements.includes(movementType);
    }


    
}

