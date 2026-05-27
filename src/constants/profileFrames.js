// Profile frame catalog — frames unlocked at certain volunteer levels.
// Frames are rendered as a styled ring around the profile picture.

export const PROFILE_FRAMES = [
  {
    id: "default",
    name: "Default",
    description: "Standard profile ring.",
    minLevel: 1,
    cssClass: "frame-default",
  },
  {
    id: "teal-ring",
    name: "Teal Ring",
    description: "A clean teal ring for committed volunteers.",
    minLevel: 3,
    cssClass: "frame-teal-ring",
  },
  {
    id: "gradient-ring",
    name: "Gradient Ring",
    description: "A vibrant gradient ring for experienced volunteers.",
    minLevel: 5,
    cssClass: "frame-gradient-ring",
  },
  {
    id: "golden-ring",
    name: "Golden Ring",
    description: "A shimmering golden ring for elite volunteers.",
    minLevel: 7,
    cssClass: "frame-golden-ring",
  },
  {
    id: "champion-ring",
    name: "Champion Ring",
    description: "An animated rainbow ring reserved for max-level volunteers.",
    minLevel: 10,
    cssClass: "frame-champion-ring",
  },
];

export const FRAME_BY_ID = Object.fromEntries(
  PROFILE_FRAMES.map((f) => [f.id, f])
);

/** Returns all frames the user is eligible to equip at the given level. */
export function getUnlockedFrames(level) {
  return PROFILE_FRAMES.filter((f) => level >= f.minLevel);
}
