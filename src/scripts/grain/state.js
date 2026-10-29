// Shared, mutable state between the page's interactions and the grain renderer.
export const grainState = {
  heat: 0, // 0..1, section 04
  cook: 0, // 0..1, section 06
  cookUser: false, // true once the visitor has scrubbed the pot timeline
  glow: 1, // section 05
  focus: [0, 0, 0], // world position of the cluster behind the active card, section 10
  focusCard: false,
  spin: [0, 0], // user-applied rotation (x, y) for the single grain, section 01
  spinVel: [0, 0],
  progress: 0, // continuous keyframe index 0..14
  reduced: false,
};
