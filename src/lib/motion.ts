export const motionDurations = {
  fast: 0.15,
  base: 0.25,
  slow: 0.4,
} as const;

export const motionEase = [0.4, 0, 0.2, 1] as const;

export const fadeIn = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: motionDurations.base, ease: motionEase },
};