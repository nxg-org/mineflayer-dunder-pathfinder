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

    digBlock(x: number, y: number, z: number) {
        const block = this.bot.blockAt(new Vec3(x, y, z));
        if (!block) throw cantGetBlockError("digBlock", x, y, z);
        let canMine = true;
        for (const packet of equipPackets) if (packet.destination == "hand") canMine = false;
        // botLookAtY = y; // this is a differential, to make it more "humanistic" -Vak
        if (canMine && !this.bot.targetDigBlock) {
            this.bot.dig(block);
            // botDestinationTimer = 30 + this.costInfo.getDigTime( x, y, z, this.bot.entity.isInWater, true);
        }
    }

    async equipTool(x: number, y: number, z: number) {
        const block = this.bot.blockAt(new Vec3(x, y, z));
        if (!block) throw cantGetBlockError("equipTool", x, y, z);
        if (block.material && toolsForMaterials[block.material]) {
            const item = getTool(this.bot, block.material);
            this.equipItem(item);
        }
    }



    shouldPlaceBlock(x: number, y: number, z: number) {
        return this.blockPackets.findIndex((packet) => packet.x == x && packet.y == y && packet.z == z) > -1;
    }

    async placeBlock(x: number, y: number, z: number) {
        this.bot.stopDigging();
        let placeOffset = new Vec3(0, 0, 0);
        if (this.bot.targetDigBlock) return;
        const block = this.bot.blockAt(new Vec3(x, y, z));
        if (!block) throw cantGetBlockError("placeBlock", x, y, z, "main block error");
        if (block.shapes.length > 0) return;

        for (const packet of this.blockPackets) {
            if (packet.x === x && packet.y === y && packet.z === z) return;
        }

        for (const offset of placeBlockOffsets) {
            const { x, y, z } = placeOffset.offset(offset[0], offset[1], offset[2]);
            const offsetBlock = this.bot.blockAt(placeOffset.offset(offset[0], offset[1], offset[2]));
            if (!offsetBlock) throw cantGetBlockError("placeBlock", x, y, z, "offset block");
            if (this.shouldPlaceBlock(x, y, z) || offsetBlock.shapes.length > 0) placeOffset = new Vec3(x, y, z);
        }

        if (placeOffset.equals(emptyVec)) return;

        await this.equipAnyOfItems(scaffoldBlocks, "hand");
        const pos = { x, y, z };
        this.blockPackets.push(pos);
        // this.bot.lookAt(new Vec3(x + 0.5, y + 0.5, z + 0.5), true);
        await this.bot.placeBlock(block, placeOffset);
        const index = this.blockPackets.indexOf(pos);
        if (index > -1) this.blockPackets.splice(index);
        this.bot.swingArm(undefined);
    }
}
