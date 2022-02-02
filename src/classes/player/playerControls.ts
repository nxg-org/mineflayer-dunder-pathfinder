

export class PlayerControls {
        public forward: boolean
        public back: boolean
        public left: boolean
        public right: boolean
        public jump: boolean
        public sprint: boolean
        public sneak: boolean



    constructor(forward: boolean = false, back: boolean = false, left: boolean = false, right: boolean = false, jump: boolean = false, sprint: boolean = false, sneak: boolean = false) {
        this.forward = forward
        this.back = back
        this.left = left
        this.right = right
        this.jump = jump
        this.sprint = sprint
        this.sneak = sneak
    }
}


export class AdvancedPlayerControls {
    public forward: boolean
    public back: boolean
    public left: boolean
    public right: boolean
    public jump: boolean
    public sprint: boolean
    public sneak: boolean

    public isGrounded: boolean;
    public faceBackwards: number;
    public mlg: number;
    public bucketTimer: number;
    public bucketTarget: {x: number, y: number, z: number};
    public lastTimer: number;

    constructor(forward: boolean = false, back: boolean = false, left: boolean = false, right: boolean = false, jump: boolean = false, sprint: boolean = false, sneak: boolean = false) {
        this.forward = forward
        this.back = back
        this.left = left
        this.right = right
        this.jump = jump
        this.sprint = sprint
        this.sneak = sneak


        this.isGrounded = true,
        this.faceBackwards = 0; //4
        this.mlg = 0;
        this.bucketTimer = 0;
        this.bucketTarget = {x: 0, y: 0, z: 0};
        this.lastTimer = 0; //-10

    }
}