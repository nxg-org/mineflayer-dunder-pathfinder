export class CheapPhysicsSettings {
    public static gravity: number = 0.08;
    public static airdrag: number = Math.fround(1 - 0.02);
    public static yawSpeed: number = 3.0;
    public static pitchSpeed: number = 3.0;
    public static playerSpeed: number = 0.1;
    public static sprintSpeed: number = 0.3;
    public static sneakSpeed: number = 0.3;
    public static usingItemSpeed: number = 0.2;
    public static negligeableVelocity: number = 0.003; // actually 0.005 for 1.8; but seems fine
    public static jumpHeight: number = Math.fround(0.42);
    public static honeyblockSpeed: number = 0.4;
    public static honeyblockJumpSpeed: number = 0.4;

    /**
     * @deprecated shit.
     */
    public static playerHalfWidth: number = 0.3 

      /**
     * @deprecated shit.
     */
    public static playerHeight: number = 1.8;
    public static airborneInertia: number = 0.91
    public static airborneAcceleration: number = 0.02;
    public static slowFalling: number = 0.125;
    public static sprintingUUID: string = "662a6b8d-da3e-4c1c-8813-96ea6097278d"; // SPEED_MODIFIER_SPRINTING_UUID is from LivingEntity.java

}