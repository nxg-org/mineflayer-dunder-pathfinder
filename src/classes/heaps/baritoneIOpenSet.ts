/*
 * This file is part of Baritone.
 *
 * Baritone is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Baritone is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with Baritone.  If not, see <https://www.gnu.org/licenses/>.
 */

import { PathNode } from "../nodes/node";

/**
 * An open set for A* or similar graph search algorithm
 *
 * @author leijurv
 */
export interface IOpenSet {

    /**
     * Inserts the specified node into the heap
     *
     * @param node The node
     */
    insert(node: PathNode): void;

    /**
     * @return {@code true} if the heap has no elements; {@code false} otherwise.
     */
    isEmpty(): boolean;

    /**
     * Removes and returns the minimum element in the heap.
     *
     * @return The minimum element in the heap
     */
    removeLowest(): PathNode;

    /**
     * A faster path has been found to this node, decreasing its cost. Perform a decrease-key operation.
     *
     * @param node The node
     */
    update(node: PathNode): void;
}
