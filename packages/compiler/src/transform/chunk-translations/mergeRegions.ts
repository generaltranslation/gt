/** What mergeRegions reads. The order of the regions decides ties. */
export type RegionMergeInput = {
  /**
   * The loads that pay for each region: `words` 32-bit words per region,
   * one bit per load
   */
  loads: Uint32Array;
  words: number;
  /**
   * The loads that demand each region and hold it by the time they run, in
   * the shape of `loads`. No load both pays for a region and holds it.
   */
  holders?: Uint32Array;
  /** The weight of each load */
  weights: Float64Array;
  /** The raw bytes of each region */
  bytes: Float64Array;
  /** Two regions merge only when they have the same class */
  classes: Int32Array;
  /** The block each region was in before, -1 for none, see mergeRegions */
  groups?: Int32Array;
  /** λ: what one more request costs a load, in bytes of `estimateSize` */
  requestCost: number;
  /** The size a file of so many raw bytes downloads as; never decreasing */
  estimateSize: (bytes: number) => number;
};

// Above every gain a block can have, also after rounding
const BOUND_SLACK = 1 + 1e-9;

/**
 * Merges regions into blocks, best pair first.
 *
 * A load downloads every block it pays for, whole. What the blocks cost is
 * the sum over blocks of `weight(loads) * (requestCost + estimateSize(bytes))`,
 * so merging two blocks gains
 *
 *   λ·p(S) + p(A)·ê(A) + p(B)·ê(B) − (p(A) + p(B) − p(S))·ê(A∪B)
 *
 * where S is the loads that pay for both, and so pay for one block less, and
 * the loads that pay for one and hold the other, which hold the merged block
 * and stop paying. The gain is only positive when there is such a load. The
 * pair with the largest gain merges, the first in region order on a tie,
 * until no pair gains.
 *
 * Each block keeps its best partner. A merged block is compared with the
 * others when it reaches the top, and a block whose partner merged away keeps
 * its old gain as an upper bound until it does, so the order is exactly best
 * pair first without a queue of all pairs.
 *
 * With `groups`, the regions of each group merge among themselves first and
 * every block after that. A group that came out of this function as one
 * block is put together again by the same merges, in the same order, so an
 * unchanged input gives its previous blocks back.
 *
 * Returns the block of each region, as the first region in it, and how many
 * pairs of blocks were compared.
 */
export function mergeRegions({
  loads,
  words,
  holders,
  weights,
  bytes,
  classes,
  groups,
  requestCost,
  estimateSize,
}: RegionMergeInput): { blocks: Int32Array; comparisons: number } {
  const count = bytes.length;
  // A row of payers for each block, then a row of holders for each
  const bits = new Uint32Array(2 * count * words);
  bits.set(loads);
  if (holders) bits.set(holders, count * words);
  const size = bytes.slice();
  const { intersect, index } = createIntersection(bits, words, weights);

  const weight = new Float64Array(count);
  const heldWeight = new Float64Array(count);
  const cost = new Float64Array(count);
  const bound = new Float64Array(count);
  const parent = new Int32Array(count);
  const partner = new Int32Array(count).fill(-1);
  // A block's partner is still its best while the partner's version is the same
  const partnerVersion = new Int32Array(count);
  const version = new Int32Array(count);
  const compared = new Uint8Array(count);
  const live = new Int32Array(count);
  const position = new Int32Array(count);
  let liveCount = count;
  let comparisons = 0;

  // A block gains at most what it costs its payers, and what its partner
  // costs its holders, which is no more than the largest block costs them
  let largest = 0;
  const getBound = (row: number) =>
    (weight[row] * (requestCost + cost[row]) +
      heldWeight[row] * (requestCost + largest)) *
    BOUND_SLACK;
  // The blocks each load pays for, and those it holds; a block that merged
  // away or stopped paying stays listed until the list is read
  const paying: number[][] = Array.from(weights, () => []);
  const holding: number[][] = Array.from(weights, () => []);
  const list = (lists: number[][], row: number, block: number) => {
    for (let word = 0; word < words; word++) {
      for (let rest = bits[row * words + word]; rest !== 0; rest &= rest - 1) {
        lists[word * 32 + 31 - Math.clz32(rest & -rest)].push(block);
      }
    }
  };
  for (let row = 0; row < count; row++) {
    index(row);
    index(count + row);
    list(paying, row, row);
    list(holding, count + row, row);
    weight[row] = intersect(row, row);
    heldWeight[row] = intersect(count + row, count + row);
    cost[row] = estimateSize(size[row]);
    if (cost[row] > largest) largest = cost[row];
    parent[row] = row;
    live[row] = row;
    position[row] = row;
  }

  /** Finds the best partner of a block among `candidates`. */
  const compare = (
    row: number,
    candidates: ArrayLike<number>,
    length: number
  ) => {
    const rowWeight = weight[row];
    const rowHeld = heldWeight[row];
    const rowCost = cost[row];
    const rowSize = size[row];
    const rowClass = classes[row];
    const paid = rowWeight * rowCost;
    let best = 0;
    let bestPartner = -1;
    const cannotWin = (gain: number, other: number) =>
      gain < best || (gain === best && (best === 0 || other > bestPartner));
    for (let at = 0; at < length; at++) {
      const other = candidates[at];
      if (other === row || parent[other] !== other) continue;
      if (classes[other] !== rowClass) continue;
      const otherWeight = weight[other];
      const otherHeld = heldWeight[other];
      const otherCost = cost[other];
      const total = paid + otherWeight * otherCost;
      const united = rowWeight + otherWeight;
      // The gain grows with the shared weight and shrinks with the merged
      // size, which is at least the larger of the two: both gains below are
      // upper bounds of the real one
      const least = rowCost > otherCost ? rowCost : otherCost;
      let shared =
        rowHeld === 0 && otherHeld === 0
          ? Math.min(rowWeight, otherWeight)
          : Math.min(rowWeight, otherWeight + otherHeld) +
            Math.min(otherWeight, rowHeld);
      let gain = total + requestCost * shared - (united - shared) * least;
      if (cannotWin(gain, other)) continue;
      comparisons++;
      // Added up in the order of the two blocks, whichever is compared
      const low = row < other ? row : other;
      const high = row < other ? other : row;
      shared = intersect(low, high);
      if (heldWeight[high] > 0) shared += intersect(low, count + high);
      if (heldWeight[low] > 0) shared += intersect(high, count + low);
      if (shared === 0) continue;
      gain = total + requestCost * shared - (united - shared) * least;
      if (cannotWin(gain, other)) continue;
      gain =
        total +
        requestCost * shared -
        (united - shared) * estimateSize(rowSize + size[other]);
      if (
        gain > best ||
        (gain === best && bestPartner !== -1 && other < bestPartner)
      ) {
        best = gain;
        bestPartner = other;
      }
    }
    bound[row] = best;
    partner[row] = bestPartner;
    partnerVersion[row] = bestPartner === -1 ? 0 : version[bestPartner];
    compared[row] = 1;
  };

  const merge = (low: number, high: number) => {
    const payers = low * words;
    const held = (count + low) * words;
    for (let word = 0; word < words; word++) {
      const before = bits[payers + word];
      const holds = bits[held + word] | bits[(count + high) * words + word];
      const pays = (before | bits[high * words + word]) & ~holds;
      for (let rest = pays & ~before; rest !== 0; rest &= rest - 1) {
        paying[word * 32 + 31 - Math.clz32(rest & -rest)].push(low);
      }
      for (
        let rest = holds & ~bits[held + word];
        rest !== 0;
        rest &= rest - 1
      ) {
        holding[word * 32 + 31 - Math.clz32(rest & -rest)].push(low);
      }
      bits[payers + word] = pays;
      bits[held + word] = holds;
    }
    index(low);
    index(count + low);
    weight[low] = intersect(low, low);
    heldWeight[low] = intersect(count + low, count + low);
    size[low] += size[high];
    cost[low] = estimateSize(size[low]);
    if (cost[low] > largest) largest = cost[low];
    version[low]++;
    compared[low] = 0;
    bound[low] = getBound(low);
    parent[high] = low;
    const last = live[--liveCount];
    live[position[high]] = last;
    position[last] = position[high];
  };

  const sharing = new Int32Array(count);
  const seenFor = new Int32Array(count).fill(-1);
  let reads = 0;
  /**
   * Compares a block with those it shares a load with, which are the only
   * ones it can gain from: read from the loads' lists when that is fewer
   * blocks than all of them.
   */
  const compareWithSharing = (row: number) => {
    // The lists to read: for a load that pays for the block, the blocks it
    // pays for or holds; for one that holds it, the blocks it pays for
    const lists: number[][] = [];
    let listed = 0;
    for (const [from, kinds] of [
      [row, [paying, holding]],
      [count + row, [paying]],
    ] as const) {
      for (let word = 0; word < words && listed < liveCount; word++) {
        for (
          let rest = bits[from * words + word];
          rest !== 0;
          rest &= rest - 1
        ) {
          const load = word * 32 + 31 - Math.clz32(rest & -rest);
          for (const kind of kinds) {
            lists.push(kind[load]);
            listed += kind[load].length;
          }
        }
      }
    }
    if (listed >= liveCount) {
      compare(row, live, liveCount);
      return;
    }
    const read = reads++;
    let found = 0;
    for (const blocks of lists) {
      let kept = 0;
      for (const block of blocks) {
        if (parent[block] !== block) continue;
        blocks[kept++] = block;
        if (seenFor[block] === read) continue;
        seenFor[block] = read;
        sharing[found++] = block;
      }
      blocks.length = kept;
    }
    compare(row, sharing, found);
  };

  const run = (compareRow: (row: number) => void) => {
    for (let at = 0; at < liveCount; at++) {
      const row = live[at];
      compared[row] = 0;
      bound[row] = getBound(row);
    }
    for (;;) {
      let top = 0;
      let stale = -1;
      let low = -1;
      let high = -1;
      for (let at = 0; at < liveCount; at++) {
        const row = live[at];
        const value = bound[row];
        if (value <= 0 || value < top) continue;
        if (value > top) {
          top = value;
          stale = -1;
          low = -1;
        }
        const other = partner[row];
        if (
          !compared[row] ||
          parent[other] !== other ||
          version[other] !== partnerVersion[row]
        ) {
          if (stale === -1 || row < stale) stale = row;
          continue;
        }
        const first = row < other ? row : other;
        const second = row < other ? other : row;
        if (low === -1 || first < low || (first === low && second < high)) {
          low = first;
          high = second;
        }
      }
      if (stale !== -1) compareRow(stale);
      else if (low !== -1) merge(low, high);
      else return;
    }
  };

  if (groups) {
    const members = new Map<number, number[]>();
    for (let row = 0; row < count; row++) {
      if (groups[row] === -1) continue;
      const group = members.get(groups[row]);
      if (group) group.push(row);
      else members.set(groups[row], [row]);
    }
    const none: number[] = [];
    run((row) => {
      const group = members.get(groups[row]) ?? none;
      compare(row, group, group.length);
    });
  }
  run(compareWithSharing);

  const blocks = new Int32Array(count);
  for (let row = 0; row < count; row++) {
    // A block keeps the index of its first region, so parents come first
    blocks[row] = parent[row] === row ? row : blocks[parent[row]];
  }
  return { blocks, comparisons };
}

// A row with loads in at most this many words lists those words
const LISTED_WORDS = 4;

/**
 * The weight of the loads two rows share. With one weight for every load
 * that is a count of bits; otherwise the weights of each byte's bits are
 * summed once, in a table. Most rows have loads in a few words only, and say
 * which, so that only those are read: call `index` when a row changes.
 */
function createIntersection(
  bits: Uint32Array,
  words: number,
  weights: Float64Array
): {
  intersect: (first: number, second: number) => number;
  index: (row: number) => void;
} {
  const rows = bits.length / words;
  const listed = new Int32Array(rows * LISTED_WORDS);
  // LISTED_WORDS + 1 for a row with loads in more words than it lists
  const listedCount = new Uint8Array(rows);
  const index = (row: number) => {
    let count = 0;
    for (let word = 0; word < words && count <= LISTED_WORDS; word++) {
      if (bits[row * words + word] === 0) continue;
      if (count < LISTED_WORDS) listed[row * LISTED_WORDS + count] = word;
      count++;
    }
    listedCount[row] = count;
  };
  const unit = weights.length ? weights[0] : 1;
  const isUniform = weights.every((weight) => weight === unit);
  const counts = new Uint8Array(isUniform ? 1 << 16 : 0);
  for (let value = 1; value < counts.length; value++) {
    counts[value] = counts[value >> 1] + (value & 1);
  }
  const sums = new Float64Array(isUniform ? 0 : words * 4 * 256);
  for (let offset = 0; offset < sums.length; offset += 256) {
    for (let value = 1; value < 256; value++) {
      const lowest = 31 - Math.clz32(value & -value);
      sums[offset + value] =
        (weights[(offset >> 8) * 8 + lowest] ?? 0) +
        sums[offset + (value & (value - 1))];
    }
  }
  /** The weight of the loads in one word of two rows. */
  const weigh = isUniform
    ? (both: number) => (counts[both & 0xffff] + counts[both >>> 16]) * unit
    : (both: number, word: number) =>
        sums[word * 1024 + (both & 0xff)] +
        sums[word * 1024 + 256 + ((both >>> 8) & 0xff)] +
        sums[word * 1024 + 512 + ((both >>> 16) & 0xff)] +
        sums[word * 1024 + 768 + (both >>> 24)];
  const intersect = (first: number, second: number) => {
    const firstOffset = first * words;
    const secondOffset = second * words;
    const sparse = listedCount[first] <= listedCount[second] ? first : second;
    let sum = 0;
    if (listedCount[sparse] <= LISTED_WORDS) {
      const end = sparse * LISTED_WORDS + listedCount[sparse];
      for (let at = sparse * LISTED_WORDS; at < end; at++) {
        const word = listed[at];
        const both = bits[firstOffset + word] & bits[secondOffset + word];
        if (both !== 0) sum += weigh(both, word);
      }
      return sum;
    }
    for (let word = 0; word < words; word++) {
      const both = bits[firstOffset + word] & bits[secondOffset + word];
      if (both !== 0) sum += weigh(both, word);
    }
    return sum;
  };
  return { intersect, index };
}
