/**
 * Configuration constants for the Planner
 * Now loaded from config.yaml via config-loader
 */
import { getPlannerConfig } from '../config/config-loader.js';

const config = getPlannerConfig();

export const PLANNER_CONFIG = {
  MAX_CLICKS: config.maxClicks,
  MAX_CONSECUTIVE_FAILURES: config.maxConsecutiveFailures,
  ELEMENT_WAIT_TIMEOUT: config.elementWaitTimeout,
  CLICK_TIMEOUT: config.clickTimeout,
  NAVIGATION_WAIT_TIMEOUT: config.navigationWaitTimeout,
  PAGE_SETTLE_TIMEOUT: config.pageSettleTimeout,
  RECENT_INTERACTION_HISTORY_SIZE: config.recentInteractionHistorySize,
  MAX_ELEMENTS_TO_SHOW_AI: config.maxElementsToShowAI,
  // Tags to ignore when detecting interactive elements
  // Elements within these tags will be excluded from interaction
  IGNORED_TAGS: config.ignoredTags,
} as const;

