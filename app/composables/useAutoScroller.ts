// ---------------------------------------------------------------------------
// Auto Scroller
// ---------------------------------------------------------------------------
// Manages automatic scroll-to-bottom behavior for streaming content.
// Supports 4 modes: follow, force, manual, none.
// Two smooth engines: rAF (1.5px/ms) and native (scrollTo smooth).
// Detects user scroll intent and pauses auto-follow.
// Ported from xenodrive/vis.
// ---------------------------------------------------------------------------

import { ref, computed, watch, onUnmounted, type Ref } from "vue";

export type ScrollMode = "follow" | "force" | "manual" | "none";

const BOTTOM_THRESHOLD_PX = 8;
const SCROLL_SPEED_PX_PER_MS = 1.5;
const INTERVENTION_TOLERANCE_PX = 2;
const MAX_FRAME_DT_MS = 50;
const NATIVE_SMOOTH_TIMEOUT_MS = 1_500;
const USER_SCROLL_INTENT_WINDOW_MS = 240;

type SmoothEngine = "raf" | "native";

type ScrollFollowOptions = {
  bottomThresholdPx?: number;
  observeDelayMs?: number;
  smoothEngine?: SmoothEngine;
  smoothOnInitialFollow?: boolean;
  enabled?: boolean;
};

export function useAutoScroller(
  containerEl: Ref<HTMLElement | undefined>,
  scrollMode: Ref<ScrollMode>,
  options: ScrollFollowOptions = {},
) {
  const bottomThresholdPx = options.bottomThresholdPx ?? BOTTOM_THRESHOLD_PX;
  const smoothEngine = options.smoothEngine ?? "raf";
  const smoothOnInitialFollow = options.smoothOnInitialFollow ?? true;
  const isFollowing = ref(
    scrollMode.value === "follow" || scrollMode.value === "force",
  );
  const isTrackingPaused = ref(options.enabled === false);

  let rafId: number | null = null;
  let popupTimerId: ReturnType<typeof setTimeout> | null = null;
  let animating = false;
  let lastSetScrollTop = -1;
  let lastObservedScrollTop = 0;
  let contentChangeScheduled = false;
  let nativeSmoothMonitorTimeout: ReturnType<typeof setTimeout> | null = null;
  let nativeSmoothCleanup: (() => void) | null = null;
  let lastUserScrollIntentAt = 0;
  let pointerInteracting = false;

  function nowMs() {
    return typeof performance !== "undefined" ? performance.now() : Date.now();
  }

  function markUserScrollIntent(_source: string) {
    lastUserScrollIntentAt = nowMs();
  }

  function hasRecentUserScrollIntent() {
    return (
      pointerInteracting ||
      nowMs() - lastUserScrollIntentAt <= USER_SCROLL_INTENT_WINDOW_MS
    );
  }

  const showResumeButton = computed(() => {
    return scrollMode.value === "follow" && !isFollowing.value;
  });

  function isAtBottom(el: HTMLElement): boolean {
    return (
      el.scrollHeight - el.scrollTop - el.clientHeight <= bottomThresholdPx
    );
  }

  function cancelAnimation() {
    animating = false;
    lastSetScrollTop = -1;
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function pauseTracking() {
    isTrackingPaused.value = true;
  }

  function resumeTracking(options: { syncToBottom?: boolean } = {}) {
    if (!isTrackingPaused.value) {
      if (options.syncToBottom) scrollToBottom(false);
      return;
    }
    isTrackingPaused.value = false;
    if (options.syncToBottom) {
      isFollowing.value = true;
      scrollToBottom(false);
    } else if (scrollMode.value === "follow") {
      const el = containerEl.value;
      if (el) {
        isFollowing.value = isAtBottom(el);
      }
    }
  }

  function runWithoutTracking<T>(fn: () => T): T {
    const wasPaused = isTrackingPaused.value;
    isTrackingPaused.value = true;
    try {
      return fn();
    } finally {
      if (!wasPaused) resumeTracking();
    }
  }

  function clearNativeSmoothMonitor() {
    if (nativeSmoothMonitorTimeout !== null) {
      clearTimeout(nativeSmoothMonitorTimeout);
      nativeSmoothMonitorTimeout = null;
    }
    if (nativeSmoothCleanup) {
      nativeSmoothCleanup();
      nativeSmoothCleanup = null;
    }
  }

  function startNativeSmoothMonitor(el: HTMLElement) {
    clearNativeSmoothMonitor();
    pauseTracking();

    let done = false;
    let cleanupBound = false;

    const finish = () => {
      if (done) return;
      done = true;
      if (cleanupBound) {
        el.removeEventListener(
          "scrollend",
          onNativeSmoothScrollEnd as EventListener,
        );
        cleanupBound = false;
      }
      if (nativeSmoothMonitorTimeout !== null) {
        clearTimeout(nativeSmoothMonitorTimeout);
        nativeSmoothMonitorTimeout = null;
      }
      nativeSmoothCleanup = null;
      resumeTracking();
      isFollowing.value = true;
    };

    const onNativeSmoothScrollEnd = () => {
      finish();
    };

    el.addEventListener(
      "scrollend",
      onNativeSmoothScrollEnd as EventListener,
    );
    cleanupBound = true;
    nativeSmoothMonitorTimeout = setTimeout(() => {
      finish();
    }, NATIVE_SMOOTH_TIMEOUT_MS);
    nativeSmoothCleanup = finish;
  }

  function scrollToBottom(smooth: boolean) {
    const el = containerEl.value;
    if (!el) return;
    const target = el.scrollHeight - el.clientHeight;
    if (target <= 0) return;
    if (Math.abs(el.scrollTop - target) < 1) return;

    if (!smooth) {
      clearNativeSmoothMonitor();
      cancelAnimation();
      el.scrollTop = target;
      lastSetScrollTop = target;
      lastObservedScrollTop = target;
      return;
    }

    if (smoothEngine === "native") {
      cancelAnimation();
      startNativeSmoothMonitor(el);
      el.scrollTo({ top: target, behavior: "smooth" });
      lastSetScrollTop = target;
      return;
    }

    clearNativeSmoothMonitor();

    if (animating) return;

    animating = true;
    let lastTime = performance.now();
    lastSetScrollTop = el.scrollTop;

    function frame(now: number) {
      const el = containerEl.value;
      if (!el || !animating) {
        animating = false;
        return;
      }

      if (
        lastSetScrollTop >= 0 &&
        Math.abs(el.scrollTop - lastSetScrollTop) >
          INTERVENTION_TOLERANCE_PX
      ) {
        animating = false;
        lastSetScrollTop = -1;
        isFollowing.value = false;
        return;
      }

      const dt = Math.min(now - lastTime, MAX_FRAME_DT_MS);
      lastTime = now;
      const frameTarget = el.scrollHeight - el.clientHeight;
      const remaining = frameTarget - el.scrollTop;

      if (remaining <= 0.5) {
        el.scrollTop = frameTarget;
        lastSetScrollTop = frameTarget;
        animating = false;
        return;
      }

      const step = SCROLL_SPEED_PX_PER_MS * dt;
      const newTop = Math.min(el.scrollTop + step, frameTarget);
      el.scrollTop = newTop;
      lastSetScrollTop = newTop;

      rafId = requestAnimationFrame(frame);
    }

    rafId = requestAnimationFrame(frame);
  }

  function scheduleAutoScroll(smooth: boolean) {
    if (isTrackingPaused.value) {
      if (nativeSmoothCleanup) {
        clearNativeSmoothMonitor();
      } else {
        return;
      }
    }
    if (contentChangeScheduled) {
      return;
    }
    contentChangeScheduled = true;
    requestAnimationFrame(() => {
      contentChangeScheduled = false;
      const m = scrollMode.value;
      if (m === "force") {
        scrollToBottom(smooth);
      } else if (m === "follow" && isFollowing.value) {
        scrollToBottom(smooth);
      }
    });
  }

  function onScroll() {
    if (isTrackingPaused.value) return;
    if (animating) return;
    if (scrollMode.value !== "follow") return;
    const el = containerEl.value;
    if (!el) return;
    const delta = el.scrollTop - lastObservedScrollTop;
    const hasUserIntent = hasRecentUserScrollIntent();
    lastObservedScrollTop = el.scrollTop;
    if (!isFollowing.value) {
      return;
    }
    if (
      lastSetScrollTop >= 0 &&
      Math.abs(el.scrollTop - lastSetScrollTop) <=
        INTERVENTION_TOLERANCE_PX
    ) {
      return;
    }
    if (delta < -INTERVENTION_TOLERANCE_PX && hasUserIntent) {
      isFollowing.value = false;
      return;
    }
  }

  function onScrollEnd() {
    if (isTrackingPaused.value) return;
    if (animating) return;
    if (scrollMode.value !== "follow") return;
    const el = containerEl.value;
    if (!el) return;

    if (!isFollowing.value && isAtBottom(el)) {
      isFollowing.value = true;
    }
  }

  function resumeFollow(smooth = true) {
    isFollowing.value = true;
    scrollToBottom(smooth);
  }

  function enableFollow() {
    isFollowing.value = true;
  }

  function resetFollow() {
    clearNativeSmoothMonitor();
    cancelAnimation();
    isTrackingPaused.value = false;
    isFollowing.value = true;
    pointerInteracting = false;
    lastUserScrollIntentAt = 0;
    const el = containerEl.value;
    if (el) {
      lastObservedScrollTop = el.scrollTop;
    }
  }

  function notifyContentChange(smooth = true) {
    scheduleAutoScroll(smooth);
  }

  function setup(el: HTMLElement) {
    lastObservedScrollTop = el.scrollTop;
    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("scrollend", onScrollEnd, { passive: true });
    const wheelIntentHandler = (e: WheelEvent) => {
      markUserScrollIntent("wheel");
      if (
        e.deltaY < 0 &&
        scrollMode.value === "follow" &&
        isFollowing.value
      ) {
        clearNativeSmoothMonitor();
        cancelAnimation();
        isFollowing.value = false;
      }
    };
    const touchIntentHandler = () => markUserScrollIntent("touchmove");
    const pointerDownIntentHandler = () => {
      pointerInteracting = true;
      markUserScrollIntent("pointerdown");
    };
    el.addEventListener("wheel", wheelIntentHandler, { passive: true });
    el.addEventListener("touchmove", touchIntentHandler, { passive: true });
    el.addEventListener("pointerdown", pointerDownIntentHandler);
    const clearPointerInteraction = () => {
      pointerInteracting = false;
    };
    window.addEventListener("pointerup", clearPointerInteraction);
    window.addEventListener("pointercancel", clearPointerInteraction);

    interface ElWithHandlers extends HTMLElement {
      __clearPointerInteraction?: () => void;
      __wheelIntentHandler?: (e: WheelEvent) => void;
      __touchIntentHandler?: () => void;
      __pointerDownIntentHandler?: () => void;
    }
    (el as ElWithHandlers).__clearPointerInteraction =
      clearPointerInteraction;
    (el as ElWithHandlers).__wheelIntentHandler = wheelIntentHandler;
    (el as ElWithHandlers).__touchIntentHandler = touchIntentHandler;
    (el as ElWithHandlers).__pointerDownIntentHandler =
      pointerDownIntentHandler;

    if (scrollMode.value === "follow" || scrollMode.value === "force") {
      scrollToBottom(smoothOnInitialFollow);
    }
  }

  function teardown(el: HTMLElement) {
    el.removeEventListener("scroll", onScroll);
    el.removeEventListener("scrollend", onScrollEnd);

    interface ElWithHandlers extends HTMLElement {
      __clearPointerInteraction?: () => void;
      __wheelIntentHandler?: (e: WheelEvent) => void;
      __touchIntentHandler?: () => void;
      __pointerDownIntentHandler?: () => void;
    }
    const typed = el as ElWithHandlers;
    if (typed.__wheelIntentHandler)
      el.removeEventListener("wheel", typed.__wheelIntentHandler);
    if (typed.__touchIntentHandler)
      el.removeEventListener("touchmove", typed.__touchIntentHandler);
    if (typed.__pointerDownIntentHandler)
      el.removeEventListener("pointerdown", typed.__pointerDownIntentHandler);
    if (typed.__clearPointerInteraction) {
      window.removeEventListener("pointerup", typed.__clearPointerInteraction);
      window.removeEventListener(
        "pointercancel",
        typed.__clearPointerInteraction,
      );
    }
    if (popupTimerId !== null) {
      clearTimeout(popupTimerId);
      popupTimerId = null;
    }
    clearNativeSmoothMonitor();
    cancelAnimation();
  }

  watch(containerEl, (newEl, oldEl) => {
    if (oldEl) teardown(oldEl);
    if (newEl) setup(newEl);
  });

  watch(scrollMode, (m) => {
    isFollowing.value = m === "follow" || m === "force";
  });

  onUnmounted(() => {
    if (containerEl.value) teardown(containerEl.value);
    clearNativeSmoothMonitor();
    cancelAnimation();
  });

  return {
    isTrackingPaused: computed(() => isTrackingPaused.value),
    isFollowing: computed(() => isFollowing.value),
    showResumeButton,
    pauseTracking,
    resumeTracking,
    runWithoutTracking,
    enableFollow,
    resetFollow,
    resumeFollow,
    scrollToBottom,
    notifyContentChange,
  };
}
