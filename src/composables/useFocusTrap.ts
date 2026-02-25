import { watch, onBeforeUnmount, type Ref } from "vue";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(", ");

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

/**
 * Traps focus within a container element while active.
 *
 * - Tab / Shift+Tab cycle through focusable elements inside the container
 * - On activation: saves current focus, moves focus to first focusable element
 * - On deactivation: restores focus to the previously focused element
 */
export function useFocusTrap(
  containerRef: Ref<HTMLElement | null>,
  active: () => boolean,
) {
  let previouslyFocused: HTMLElement | null = null;

  function handleKeydown(e: KeyboardEvent) {
    if (e.key !== "Tab") return;

    const container = containerRef.value;
    if (!container) return;

    // If focus is outside our container, don't interfere — another trap may own it
    if (!container.contains(document.activeElement)) return;

    const focusable = getFocusableElements(container);
    if (focusable.length === 0) {
      e.preventDefault();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  function activate() {
    previouslyFocused = document.activeElement as HTMLElement | null;
    document.addEventListener("keydown", handleKeydown);

    // Focus first focusable element on next frame (after DOM update)
    requestAnimationFrame(() => {
      const container = containerRef.value;
      if (!container) return;
      const focusable = getFocusableElements(container);
      if (focusable.length > 0) {
        focusable[0].focus();
      }
    });
  }

  function deactivate() {
    document.removeEventListener("keydown", handleKeydown);
    if (previouslyFocused && typeof previouslyFocused.focus === "function") {
      previouslyFocused.focus();
      previouslyFocused = null;
    }
  }

  watch(active, (isActive) => {
    if (isActive) {
      activate();
    } else {
      deactivate();
    }
  });

  onBeforeUnmount(() => {
    document.removeEventListener("keydown", handleKeydown);
  });
}
