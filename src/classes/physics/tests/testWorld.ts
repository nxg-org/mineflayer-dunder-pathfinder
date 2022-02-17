

import stuff, { iterators} from "prismarine-world";
import chunky from "prismarine-chunk"
import other from "prismarine-chunk"
import { Vec3 } from "vec3";
const flatMap = require('flatmap')
const range = require('range').range
console.log(flatMap);

const Chunk = (chunky as any)("1.17.1")
console.log(Chunk)

function generateRandomChunk (chunkX: number, chunkZ: number) {
    const chunk = new Chunk(null)

    for (let x = 0; x < 16; x++) {
      for (let z = 0; z < 16; z++) {
        chunk.setBlockType(new Vec3(x, 50, z), Math.floor(Math.random() * 50))
        for (let y = 0; y < 256; y++) {
          chunk.setSkyLight(new Vec3(x, y, z), 15)
        }
      }
    }

    return chunk
  }

(async() => {
    const World = stuff("1.17.1")
    const originalWorld = new World(generateRandomChunk)
    await Promise.all(
        //@ts-expect-error
        flatMap(range(0, 10), (chunkX: number) => range(0, 10).map(chunkZ => ({ chunkX, chunkZ })))
        //@ts-expect-error
          .map(({ chunkX, chunkZ }) => originalWorld.getColumn(chunkX, chunkZ))
      )
    console.log(originalWorld)
})();
