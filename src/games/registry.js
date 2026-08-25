import { PunchGame } from './PunchGame.js';
import { SeekGame } from './SeekGame.js';
import { ShardGame } from './ShardGame.js';
import { CompactionGame } from './CompactionGame.js';
import { StreamGame } from './StreamGame.js';
import { ResolveGame } from './ResolveGame.js';

/**
 * The six disciplines.
 *
 * There is deliberately not a game per era. Nine of the thirteen chapters have
 * nothing a person can meaningfully *do* — you cannot play "the invention of
 * the filing cabinet" without inventing a mechanic that has nothing to do with
 * the era, and a mediocre game attached to a chapter is worse than no game at
 * all because it teaches the visitor that the buttons are decorative.
 *
 * These six were kept because each one has a real operational decision at its
 * centre that a person can get better at inside ninety seconds:
 *
 *   ENCODE     a character is a pattern, and the machine reads the pattern
 *   SEEK       on sequential media, distance is time
 *   REPLICATE  a copy is only a copy if it fails separately
 *   COMPACT    small files tax every read; commits are not free either
 *   STREAM     the bottleneck moves, and the watermark is a trade
 *   GOVERN     matching is a precision/recall problem with a legal edge
 *
 * Together they are close to the actual shape of the job.
 */
export const GAMES = {
  punch: PunchGame,
  seek: SeekGame,
  shard: ShardGame,
  compact: CompactionGame,
  stream: StreamGame,
  resolve: ResolveGame,
};

export const GAME_ORDER = ['punch', 'seek', 'shard', 'compact', 'stream', 'resolve'];

/** Short discipline names, used by the operator record in the finale. */
export const DISCIPLINE = {
  punch: 'ENCODE',
  seek: 'SEEK',
  shard: 'REPLICATE',
  compact: 'COMPACT',
  stream: 'STREAM',
  resolve: 'GOVERN',
};

/** chapter id → game id, so a chapter can offer its own game and nothing else. */
export const GAME_FOR_CHAPTER = Object.fromEntries(
  GAME_ORDER.map((id) => [GAMES[id].chapter, id])
);

export function gameMeta(id) {
  const G = GAMES[id];
  if (!G) return null;
  return {
    id,
    title: G.title,
    chapter: G.chapter,
    objective: G.objective,
    hint: G.hint,
    duration: G.duration,
    discipline: DISCIPLINE[id],
  };
}
