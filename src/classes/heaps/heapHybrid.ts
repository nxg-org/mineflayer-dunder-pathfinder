import { PathNode } from "..";
import { IOpenSet } from "./baritoneIOpenSet";

class BinaryHeapOpenSet implements IOpenSet {
    private heap: PathNode[] = [];
    constructor() {
        // Initialing the array heap and adding a dummy element at index 0
        this.heap = [PathNode.EMPTY()];
    }

    size() {
        return this.heap.length - 1;
    }

    isEmpty() {
        return this.heap.length === 1;
    }

    insert(val: PathNode) {
        // Inserting the new node at the end of the heap array
        this.heap.push(val);
        val.heapPosition = this.heap.length - 1;
        // Finding the correct position for the new node
        this.update(val);
    }

    update(val: PathNode) {
        let index = val.heapPosition;
        let parentIndex = index >>> 1;
        const cost = val.combinedCost;
        let parentNode = this.heap[parentIndex];

        // Traversing up the parent node until the current node is greater than the parent
        while (index > 1 && parentNode.combinedCost > cost) {
            this.heap[index] = parentNode;
            this.heap[parentIndex] = val;
            val.heapPosition = parentIndex;
            parentNode.heapPosition = index;
            index = parentIndex;
            parentIndex = index >>> 1;
            parentNode = this.heap[parentIndex];
        }
    }

    removeLowest(): PathNode {
        // Smallest element is at the index 1 in the heap array
        const smallest = this.heap[1];

        this.heap[1] = this.heap[this.heap.length - 1];
        this.heap[1].heapPosition = 1;
        this.heap.splice(this.heap.length - 1);

        smallest.heapPosition = -1;
        const size = this.heap.length - 1;
        if (size < 2) return smallest;

        const val = this.heap[1];
        let index = 1;
        let smallerChild = 2;
        const cost = val.combinedCost;
        do {
            let smallerChildNode = this.heap[smallerChild];
            if (smallerChild < size - 1) {
                const rightChildNode = this.heap[smallerChild + 1];
                if (smallerChildNode.combinedCost > rightChildNode.combinedCost) {
                    smallerChild++;
                    smallerChildNode = rightChildNode;
                }
            }
            if (cost <= smallerChildNode.combinedCost) {
                break;
            }
            this.heap[index] = smallerChildNode;
            this.heap[smallerChild] = val;
            val.heapPosition = smallerChild;
            smallerChildNode.heapPosition = index;
            index = smallerChild;
        } while ((smallerChild <<= 1) <= size);

        return smallest;
    }
}
