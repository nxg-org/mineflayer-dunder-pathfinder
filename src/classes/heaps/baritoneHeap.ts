import { PathNode } from "../nodes/node";
import { IOpenSet } from "./baritoneIOpenSet";

export class BinaryHeapOpenSet implements IOpenSet {

    /**
     * The initial capacity of the heap (2^10)
     */
    private static readonly INITIAL_CAPACITY: number = 1024;

    /**
     * The array backing the heap
     */
    private array: PathNode[];

    /**
     * The size of the heap
     */
    private size: number;



    public static EMPTY(): BinaryHeapOpenSet {
        return new BinaryHeapOpenSet(BinaryHeapOpenSet.INITIAL_CAPACITY);
    }

    constructor(size: number) {
        this.size = 0;
        this.array = Object.seal(Array<PathNode>(size));
    }

    public insert(value: PathNode): void {
        if (this.size >= this.array.length - 1) {
            const tmp = Object.seal(Array<PathNode>(this.array.length << 1));
            tmp.push.apply(this.array);
            this.array = tmp;
        }
        this.size++;
        value.heapPosition = this.size;
        this.array[this.size] = value;
        this.update(value);
    }

    public update(val: PathNode): void {
        let index = val.heapPosition;
        let parentInd = index >>> 1;
        let cost = val.combinedCost;
        let parentNode = this.array[parentInd];
        while (index > 1 && parentNode.combinedCost > cost) {
            this.array[index] = parentNode;
            this.array[parentInd] = val;
            val.heapPosition = parentInd;
            parentNode.heapPosition = index;
            index = parentInd;
            parentInd = index >>> 1;
            parentNode = this.array[parentInd];
        }
    }

    public isEmpty(): boolean {
        return this.size == 0;
    }



    /**
     * WARNING: THIS MAY BE INACCURATE.
     * NEEDS TESTING.
     * @returns PathNode
     */
    public removeLowest(): PathNode {
        if (this.size == 0) {
            throw "Illegal state."
        }
        let result= this.array[1];
        let val= this.array[this.size];
        this.array[1] = val;
        val.heapPosition = 1;
        this.array[this.size] = PathNode.EMPTY();
        this.size--;
        result.heapPosition = -1;
        if (this.size < 2) {
            return result;
        }
        let index = 1;
        let smallerChild = 2;
        const cost = val.combinedCost;
        do {
            let smallerChildNode = this.array[smallerChild];
            let smallerChildCost = smallerChildNode.combinedCost;
            if (smallerChild < this.size) {
                const rightChildNode = this.array[smallerChild + 1];
                const rightChildCost = rightChildNode.combinedCost;
                if (smallerChildCost > rightChildCost) {
                    smallerChild++;
                    smallerChildCost = rightChildCost;
                    smallerChildNode = rightChildNode;
                }
            }
            if (cost <= smallerChildCost) {
                break;
            }
            this.array[index] = smallerChildNode;
            this.array[smallerChild] = val;
            val.heapPosition = smallerChild;
            smallerChildNode.heapPosition = index;
            index = smallerChild;
        } while ((smallerChild <<= 1) <= this.size);
        return result;
    }
}