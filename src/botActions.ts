import EventEmitter from "events";
import { Bot, EquipmentDestination } from "mineflayer";
import { Block } from "prismarine-block";
import { Item } from "prismarine-item";
import { Vec3 } from "vec3";
import { BlockInfo } from "./blockInfoNew";
import { getToolPriority, scaffoldBlocks, toolsForMaterials } from "./constants";
import { CostCalculator } from "./costCalculator";
import { cantGetBlockError, cantGetItemError, getTool } from "./util";

let equipPackets: any[] = [];
const emptyVec = new Vec3(0, 0, 0);
const placeBlockOffsets = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
];

export class BotActions extends EventEmitter {
    private blockPackets: { x: number; y: number; z: number }[] = [];
    constructor(private bot: Bot, private costInfo: CostCalculator) {
        super();
    }

    async equipItem(item: Item | null, dest: EquipmentDestination = "hand") {
        if (!item) await this.bot.unequip(dest);
        else return await this.bot.util.inv.customEquip(item, dest);
    }

    async equipItemByName(itemName: string, dest: EquipmentDestination = "hand") {
        const item = this.bot.util.inv.getAllItems().find((i) => i.name.includes(itemName));
        if (!item) throw cantGetItemError("equipItem", itemName, dest);
        return await this.bot.util.inv.customEquip(item, dest);
    }

    async equipAnyOfItems(itemNames: string[], dest: EquipmentDestination = "hand") {
        for (const item of itemNames) {
            try {
                return await this.equipItemByName(item, dest);
            } catch (e) {
                continue;
            }
        }
        return false;
    }

    async digBlock(block: Block) {
        if (this.bot.targetDigBlock) return;
        const tool = getTool(this.bot, block.material ?? undefined);
        await this.equipItem(tool);
        if (this.bot.heldItem?.name === tool?.name) {
            await this.bot.dig(block);
        }
    }

    async equipTool(block: Block) {
        // const block = this.bot.blockAt(new Vec3(x, y, z));
        // if (!block) throw cantGetBlockError("equipTool", x, y, z);
        if (block.material && toolsForMaterials[block.material]) {
            const item = getTool(this.bot, block.material);
            this.equipItem(item);
        }
    }

    shouldPlaceBlock(blockPos: Vec3) {
        return this.blockPackets.findIndex((packet) => packet.x == blockPos.x && packet.y == blockPos.y && packet.z == blockPos.z) > -1;
    }

    async placeBlock(block: Block) {
        // const block = this.bot.blockAt(new Vec3(x, y, z));
        // if (!block) throw cantGetBlockError("placeBlock", x, y, z, "main block error");
        if (block.shapes.length > 0) return;
        this.bot.stopDigging();
        let placeOffset = new Vec3(0, 0, 0);
        if (this.bot.targetDigBlock) return;

        for (const packet of this.blockPackets) {
            if (packet.x === block.position.x && packet.y === block.position.y && packet.z === block.position.z) return;
        }

        for (const offset of placeBlockOffsets) {
            const realOffset = placeOffset.offset(offset[0], offset[1], offset[2]);
            const offsetBlock = this.bot.blockAt(placeOffset.offset(offset[0], offset[1], offset[2]));
            if (!offsetBlock) throw cantGetBlockError("placeBlock", realOffset.x, realOffset.y, realOffset.z, "offset block");
            if (this.shouldPlaceBlock(realOffset) || offsetBlock.shapes.length > 0) placeOffset = realOffset;
        }

        if (placeOffset.equals(emptyVec)) return;

        await this.equipAnyOfItems(scaffoldBlocks, "hand");
        this.blockPackets.push(block.position);
        // this.bot.lookAt(new Vec3(x + 0.5, y + 0.5, z + 0.5), true);
        const refVec = block.position.minus(placeOffset);
        const ref = this.bot.blockAt(refVec);
        if (!ref) throw cantGetBlockError("placeBlock", refVec.x, refVec.y, refVec.z);
        await this.bot.placeBlock(ref, placeOffset);
        const index = this.blockPackets.indexOf(block.position);
        if (index > -1) this.blockPackets.splice(index);
        this.bot.swingArm(undefined);
    }
}
