import { describe, it, expect, vi, afterEach } from "vitest";
import { mount, config } from "@vue/test-utils";
import { defineComponent } from "vue";
import { useKeyboard } from "./useKeyboard";

// Helper: create a wrapper component that calls useKeyboard with given callbacks,
// then mount it so lifecycle hooks (onMounted/onUnmounted) fire.
function mountWithKeyboard(options: {
  onSelectAll?: () => void;
  onDeselect?: () => void;
  onDelete?: () => void;
}) {
  const Comp = defineComponent({
    setup() {
      useKeyboard(options);
      return () => null;
    },
  });
  return mount(Comp, { attachTo: document.body });
}

function fireKey(key: string, extra: Partial<KeyboardEvent> = {}) {
  document.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, ...extra }));
}

describe("useKeyboard", () => {
  afterEach(() => {
    // Ensure cleanup — unmounting removes the listener
    config.global.renderStubDefaultSlot = false;
  });

  it("calls onSelectAll on Ctrl+A", () => {
    const onSelectAll = vi.fn();
    const wrapper = mountWithKeyboard({ onSelectAll });

    fireKey("a", { ctrlKey: true });
    expect(onSelectAll).toHaveBeenCalledOnce();

    wrapper.unmount();
  });

  it("calls onSelectAll on Meta+A (macOS Cmd)", () => {
    const onSelectAll = vi.fn();
    const wrapper = mountWithKeyboard({ onSelectAll });

    fireKey("a", { metaKey: true });
    expect(onSelectAll).toHaveBeenCalledOnce();

    wrapper.unmount();
  });

  it("calls onDeselect on Escape", () => {
    const onDeselect = vi.fn();
    const wrapper = mountWithKeyboard({ onDeselect });

    fireKey("Escape");
    expect(onDeselect).toHaveBeenCalledOnce();

    wrapper.unmount();
  });

  it("calls onDelete on Delete key", () => {
    const onDelete = vi.fn();
    const wrapper = mountWithKeyboard({ onDelete });

    fireKey("Delete");
    expect(onDelete).toHaveBeenCalledOnce();

    wrapper.unmount();
  });

  it("does not call handlers for unrelated keys", () => {
    const onSelectAll = vi.fn();
    const onDeselect = vi.fn();
    const onDelete = vi.fn();
    const wrapper = mountWithKeyboard({ onSelectAll, onDeselect, onDelete });

    fireKey("b");
    fireKey("Enter");
    fireKey("Tab");

    expect(onSelectAll).not.toHaveBeenCalled();
    expect(onDeselect).not.toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();

    wrapper.unmount();
  });

  it("ignores keystrokes when target is INPUT", () => {
    const onSelectAll = vi.fn();
    const wrapper = mountWithKeyboard({ onSelectAll });

    const input = document.createElement("input");
    document.body.appendChild(input);
    input.dispatchEvent(new KeyboardEvent("keydown", {
      key: "a",
      ctrlKey: true,
      bubbles: true,
    }));

    expect(onSelectAll).not.toHaveBeenCalled();

    document.body.removeChild(input);
    wrapper.unmount();
  });

  it("ignores keystrokes when target is TEXTAREA", () => {
    const onSelectAll = vi.fn();
    const wrapper = mountWithKeyboard({ onSelectAll });

    const textarea = document.createElement("textarea");
    document.body.appendChild(textarea);
    textarea.dispatchEvent(new KeyboardEvent("keydown", {
      key: "a",
      ctrlKey: true,
      bubbles: true,
    }));

    expect(onSelectAll).not.toHaveBeenCalled();

    document.body.removeChild(textarea);
    wrapper.unmount();
  });

  it("ignores keystrokes when target is SELECT", () => {
    const onDeselect = vi.fn();
    const wrapper = mountWithKeyboard({ onDeselect });

    const select = document.createElement("select");
    document.body.appendChild(select);
    select.dispatchEvent(new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
    }));

    expect(onDeselect).not.toHaveBeenCalled();

    document.body.removeChild(select);
    wrapper.unmount();
  });

  it("removes event listener on unmount", () => {
    const onSelectAll = vi.fn();
    const wrapper = mountWithKeyboard({ onSelectAll });

    wrapper.unmount();

    fireKey("a", { ctrlKey: true });
    expect(onSelectAll).not.toHaveBeenCalled();
  });

  it("works with partial options (only onSelectAll)", () => {
    const onSelectAll = vi.fn();
    const wrapper = mountWithKeyboard({ onSelectAll });

    // These should not throw
    fireKey("Escape");
    fireKey("Delete");

    // Only Ctrl+A should call the callback
    fireKey("a", { ctrlKey: true });
    expect(onSelectAll).toHaveBeenCalledOnce();

    wrapper.unmount();
  });
});
