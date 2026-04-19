import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import OnboardingTakeoverDialog from "./OnboardingTakeoverDialog.vue";
import type { ManagerAutostartInfo } from "../types/boinc";

vi.mock("@vueuse/integrations/useFocusTrap", () => ({
  useFocusTrap: () => ({
    activate: vi.fn(),
    deactivate: vi.fn(),
  }),
}));

const macInfo: ManagerAutostartInfo = {
  kind: "MacLaunchAgent",
  data: { plist_path: "/Library/LaunchAgents/edu.berkeley.boinc.Manager.plist" },
};

function clearBody() {
  document.body.replaceChildren();
}

function mountDialog(
  open: boolean,
  info: ManagerAutostartInfo | null = macInfo,
) {
  return mount(OnboardingTakeoverDialog, {
    props: { open, info },
    global: {
      mocks: {
        $t: (key: string) => key,
      },
    },
  });
}

describe("OnboardingTakeoverDialog", () => {
  beforeEach(() => {
    clearBody();
  });

  it("does not render when closed", () => {
    mountDialog(false);
    expect(document.body.querySelector(".dialog-overlay")).toBeNull();
  });

  it("renders title and buttons when open", () => {
    mountDialog(true);
    const overlay = document.body.querySelector(".dialog-overlay");
    expect(overlay).not.toBeNull();
    expect(
      document.body.querySelector('[data-testid="takeover-btn"]'),
    ).not.toBeNull();
    expect(
      document.body.querySelector('[data-testid="keep-both-btn"]'),
    ).not.toBeNull();
  });

  it("emits takeover when the primary button is clicked", async () => {
    const wrapper = mountDialog(true);
    const btn = document.body.querySelector(
      '[data-testid="takeover-btn"]',
    ) as HTMLElement;
    btn.click();
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted("takeover")).toBeTruthy();
    expect(wrapper.emitted("keepBoth")).toBeFalsy();
  });

  it("emits keepBoth when the secondary button is clicked", async () => {
    const wrapper = mountDialog(true);
    const btn = document.body.querySelector(
      '[data-testid="keep-both-btn"]',
    ) as HTMLElement;
    btn.click();
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted("keepBoth")).toBeTruthy();
    expect(wrapper.emitted("takeover")).toBeFalsy();
  });

  it("emits keepBoth on Escape", async () => {
    const wrapper = mountDialog(false);
    await wrapper.setProps({ open: true });
    await wrapper.vm.$nextTick();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted("keepBoth")).toBeTruthy();
  });

  it("emits keepBoth when the overlay backdrop is clicked", async () => {
    const wrapper = mountDialog(true);
    const overlay = document.body.querySelector(
      ".dialog-overlay",
    ) as HTMLElement;
    overlay.click();
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted("keepBoth")).toBeTruthy();
  });

  it("shows the manual note only for MacLoginItem", () => {
    mountDialog(true, macInfo);
    expect(
      document.body.querySelector('[data-testid="manual-note"]'),
    ).toBeNull();
    clearBody();

    mountDialog(true, { kind: "MacLoginItem" });
    expect(
      document.body.querySelector('[data-testid="manual-note"]'),
    ).not.toBeNull();
  });

  it("has correct ARIA attributes when open", () => {
    mountDialog(true);
    const dialog = document.body.querySelector("[role='dialog']");
    expect(dialog).not.toBeNull();
    expect(dialog!.getAttribute("aria-modal")).toBe("true");
    expect(dialog!.getAttribute("aria-labelledby")).toBe(
      "onboarding-takeover-title",
    );
    expect(dialog!.getAttribute("aria-describedby")).toBe(
      "onboarding-takeover-body",
    );
  });
});
