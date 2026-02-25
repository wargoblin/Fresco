import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ref, nextTick, defineComponent } from "vue";
import { mount } from "@vue/test-utils";
import { useFocusTrap } from "./useFocusTrap";

// Helper component that uses the composable
function createTestComponent(template: string) {
  return defineComponent({
    props: { active: { type: Boolean, default: false } },
    setup(props) {
      const containerRef = ref<HTMLElement | null>(null);
      useFocusTrap(containerRef, () => props.active);
      return { containerRef };
    },
    template,
  });
}

const DialogWithButtons = createTestComponent(`
  <div v-if="active" ref="containerRef">
    <button class="first">First</button>
    <button class="second">Second</button>
    <button class="third">Third</button>
  </div>
`);

const DialogWithInputs = createTestComponent(`
  <div v-if="active" ref="containerRef">
    <input class="name" type="text" />
    <button class="save" disabled>Save</button>
    <button class="cancel">Cancel</button>
  </div>
`);

const EmptyDialog = createTestComponent(`
  <div v-if="active" ref="containerRef">
    <p>No focusable elements here</p>
  </div>
`);

describe("useFocusTrap", () => {
  let triggerButton: HTMLButtonElement;

  beforeEach(() => {
    document.body.innerHTML = "";
    triggerButton = document.createElement("button");
    triggerButton.textContent = "Trigger";
    document.body.appendChild(triggerButton);
    triggerButton.focus();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("focuses first focusable element on activation", async () => {
    const wrapper = mount(DialogWithButtons, {
      props: { active: false },
      attachTo: document.body,
    });

    await wrapper.setProps({ active: true });
    await nextTick();
    await vi.waitFor(() => {
      const first = document.querySelector(".first") as HTMLElement;
      expect(document.activeElement).toBe(first);
    });

    wrapper.unmount();
  });

  it("restores focus on deactivation", async () => {
    const wrapper = mount(DialogWithButtons, {
      props: { active: false },
      attachTo: document.body,
    });

    triggerButton.focus();
    expect(document.activeElement).toBe(triggerButton);

    await wrapper.setProps({ active: true });
    await nextTick();
    await vi.waitFor(() => {
      expect(document.activeElement).not.toBe(triggerButton);
    });

    await wrapper.setProps({ active: false });
    await nextTick();

    expect(document.activeElement).toBe(triggerButton);

    wrapper.unmount();
  });

  it("wraps Tab from last to first element", async () => {
    const wrapper = mount(DialogWithButtons, {
      props: { active: false },
      attachTo: document.body,
    });

    await wrapper.setProps({ active: true });
    await nextTick();
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(document.querySelector(".first"));
    });

    // Focus the last button
    (document.querySelector(".third") as HTMLElement).focus();
    expect(document.activeElement).toBe(document.querySelector(".third"));

    // Tab should wrap to first
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    expect(document.activeElement).toBe(document.querySelector(".first"));

    wrapper.unmount();
  });

  it("wraps Shift+Tab from first to last element", async () => {
    const wrapper = mount(DialogWithButtons, {
      props: { active: false },
      attachTo: document.body,
    });

    await wrapper.setProps({ active: true });
    await nextTick();
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(document.querySelector(".first"));
    });

    // Shift+Tab from first should wrap to last
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true }),
    );
    expect(document.activeElement).toBe(document.querySelector(".third"));

    wrapper.unmount();
  });

  it("skips disabled buttons", async () => {
    const wrapper = mount(DialogWithInputs, {
      props: { active: false },
      attachTo: document.body,
    });

    await wrapper.setProps({ active: true });
    await nextTick();
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(document.querySelector(".name"));
    });

    // Focus Cancel (last focusable, since Save is disabled)
    (document.querySelector(".cancel") as HTMLElement).focus();

    // Tab should wrap to input (skipping disabled Save)
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    expect(document.activeElement).toBe(document.querySelector(".name"));

    wrapper.unmount();
  });

  it("handles container with no focusable elements", async () => {
    const wrapper = mount(EmptyDialog, {
      props: { active: false },
      attachTo: document.body,
    });

    await wrapper.setProps({ active: true });
    await nextTick();

    // Tab should be prevented, no error thrown
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    // No crash = success

    wrapper.unmount();
  });

  it("does not steal focus from a nested trap", async () => {
    // Outer dialog
    const outer = mount(DialogWithButtons, {
      props: { active: false },
      attachTo: document.body,
    });

    // Inner dialog (simulates ProxySettings opening over Preferences)
    const InnerDialog = createTestComponent(`
      <div v-if="active" ref="containerRef">
        <input class="inner-input" type="text" />
        <button class="inner-btn">OK</button>
      </div>
    `);
    const inner = mount(InnerDialog, {
      props: { active: false },
      attachTo: document.body,
    });

    // Activate outer, then inner
    await outer.setProps({ active: true });
    await nextTick();
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(document.querySelector(".first"));
    });

    await inner.setProps({ active: true });
    await nextTick();
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(document.querySelector(".inner-input"));
    });

    // Tab from inner input — should wrap within inner dialog, not jump to outer
    (document.querySelector(".inner-btn") as HTMLElement).focus();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    expect(document.activeElement).toBe(document.querySelector(".inner-input"));

    // Outer dialog should NOT have stolen focus
    expect(document.activeElement).not.toBe(document.querySelector(".first"));

    inner.unmount();
    outer.unmount();
  });

  it("does not interfere when inactive", async () => {
    const wrapper = mount(DialogWithButtons, {
      props: { active: false },
      attachTo: document.body,
    });

    triggerButton.focus();

    // Tab on document should not be intercepted
    const event = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
    document.dispatchEvent(event);

    // Focus should stay where it was (no trap active)
    expect(document.activeElement).toBe(triggerButton);

    wrapper.unmount();
  });
});
