import { Bot } from "mineflayer";
import { BlockInfo } from "./blockInfo";
import { BotActions } from "./botActions";
import { CostCalculator } from "./costCalculator";
import { Pathfinder } from "./pathfinder";

export class PathfinderBuilder {


    private blockInfo: BlockInfo;
    private calcInfo: CostCalculator;
    private botActions: BotActions
    public pathfinder: Pathfinder

    constructor(private bot: Bot) {
        this.blockInfo = new BlockInfo(this.bot)
        this.calcInfo = new CostCalculator(this.bot, this.blockInfo)
        this.botActions = new BotActions(this.bot, this.calcInfo);
        this.pathfinder = new Pathfinder(this.bot, this.botActions);
    }
}