"use client";

import { useCallback, useEffect, useRef } from "react";

const discardMessage = "入力中の内容を破棄してグループ画面へ戻りますか？";
const historyGuardKey = "__waritabiUnsavedGuard";

interface NavigationDestinationLike {
  sameDocument?: boolean;
}

interface NavigateEventLike extends Event {
  destination?: NavigationDestinationLike;
  downloadRequest?: string | null;
  hashChange?: boolean;
  navigationType?: "push" | "reload" | "replace" | "traverse";
}

interface NavigationLike {
  addEventListener: (type: "navigate", listener: EventListener) => void;
  removeEventListener: (type: "navigate", listener: EventListener) => void;
}

export const confirmDiscardChanges = (isDirty: boolean) =>
  !isDirty || window.confirm(discardMessage);

export const useUnsavedChanges = (isDirty: boolean) => {
  const allowNextNavigationRef = useRef(false);

  const allowNextNavigation = useCallback(() => {
    allowNextNavigationRef.current = true;
    window.queueMicrotask(() => {
      allowNextNavigationRef.current = false;
    });
  }, []);

  useEffect(() => {
    if (!isDirty) return;

    const guardId = `${Date.now()}:${Math.random().toString(36).slice(2)}`;
    const guardUrl = window.location.href;
    const currentHistoryState = window.history.state;
    const historyState =
      currentHistoryState && typeof currentHistoryState === "object"
        ? currentHistoryState
        : {};
    const guardedHistoryState = {
      ...historyState,
      [historyGuardKey]: guardId,
    };
    window.history.replaceState(guardedHistoryState, "", guardUrl);

    const navigation = (
      window as Window & { navigation?: NavigationLike }
    ).navigation;
    let allowNextPopState = false;
    let restoreOnNextPopState = false;
    let restoringHistory = false;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (allowNextNavigationRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };

    const restoreCanceledTraversal = () => {
      restoringHistory = true;
      window.history.pushState(guardedHistoryState, "", guardUrl);
      window.queueMicrotask(() => {
        restoringHistory = false;
      });
    };

    const handleNavigate: EventListener = (event) => {
      const navigateEvent = event as NavigateEventLike;
      if (
        navigateEvent.destination?.sameDocument !== true ||
        navigateEvent.hashChange ||
        navigateEvent.downloadRequest
      ) {
        return;
      }
      if (restoringHistory) return;
      if (allowNextNavigationRef.current) {
        allowNextNavigationRef.current = false;
        return;
      }

      if (window.confirm(discardMessage)) {
        allowNextPopState = navigateEvent.navigationType === "traverse";
        return;
      }
      if (event.cancelable) {
        event.preventDefault();
      } else {
        restoreOnNextPopState = true;
      }
    };

    const handlePopState = (event: PopStateEvent) => {
      if (restoreOnNextPopState) {
        event.stopImmediatePropagation();
        restoreOnNextPopState = false;
        restoreCanceledTraversal();
        return;
      }
      if (allowNextPopState) {
        allowNextPopState = false;
        return;
      }
      if (allowNextNavigationRef.current) {
        allowNextNavigationRef.current = false;
        return;
      }
      if (!window.confirm(discardMessage)) {
        event.stopImmediatePropagation();
        restoreCanceledTraversal();
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    if (navigation) {
      navigation.addEventListener("navigate", handleNavigate);
    }
    window.addEventListener("popstate", handlePopState, true);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (navigation) {
        navigation.removeEventListener("navigate", handleNavigate);
      }
      window.removeEventListener("popstate", handlePopState, true);

      const latestHistoryState = window.history.state;
      if (
        latestHistoryState &&
        typeof latestHistoryState === "object" &&
        (latestHistoryState as Record<string, unknown>)[historyGuardKey] ===
          guardId
      ) {
        const nextHistoryState = {
          ...(latestHistoryState as Record<string, unknown>),
        };
        delete nextHistoryState[historyGuardKey];
        window.history.replaceState(nextHistoryState, "", window.location.href);
      }
    };
  }, [isDirty]);

  return allowNextNavigation;
};
