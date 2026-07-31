/** Shared, calm motion presets — gentle fades and lifts, no bounce, nothing alarmist. */
import type { Transition, Variants } from "framer-motion";

export const easeOut: Transition = { duration: 0.35, ease: [0.16, 1, 0.3, 1] };

export const fadeSlideUp: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: easeOut },
  exit: { opacity: 0, y: -6, transition: { duration: 0.15, ease: "easeIn" } },
};

export const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.06, delayChildren: 0.02 },
  },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: easeOut },
};

export const cardHover = {
  whileHover: { y: -2, transition: { duration: 0.2, ease: "easeOut" } },
} as const;
