import { Bot } from "mineflayer";
import { BlockInfo } from "./classes/blocks/blockInfo";
import { BotActions } from "./classes/player/botActions";
import { CostCalculator } from "./classes/player/costCalculator";
import { Pathfinder } from "./pathfinder";
import md from "minecraft-data"
export class PathfinderBuilder {


    public data: md.IndexedData
    private blockInfo: BlockInfo;
    private costInfo: CostCalculator;
    private botActions: BotActions
    public pathfinder: Pathfinder

    constructor(private bot: Bot) {
        this.data = md(bot.version)
        this.blockInfo = new BlockInfo(this.bot, this.data)
        this.costInfo = new CostCalculator(this.bot, this.blockInfo, this.data)
        this.botActions = new BotActions(this.bot, this.costInfo);
        this.pathfinder = new Pathfinder(this.bot, this.botActions, this.costInfo, this.blockInfo);
    }
}