import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import ColumnCustomizationDialog from "./ColumnCustomizationDialog.vue";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@vueuse/integrations/useFocusTrap", () => ({
  useFocusTrap: () => ({ activate: vi.fn(), deactivate: vi.fn() }),
}));

function createMockTable() {
  return {
    getAllLeafColumns: () => [
      {
        id: "col1",
        getIsVisible: () => true,
        columnDef: { header: "Column 1" },
      },
      {
        id: "col2",
        getIsVisible: () => true,
        columnDef: { header: "Column 2" },
      },
    ],
    getState: () => ({ columnOrder: ["col1", "col2"] }),
  };
}

describe("ColumnCustomizationDialog", () => {
  beforeEach(() => {
    document.body
      .querySelectorAll(".dialog-overlay")
      .forEach((el) => el.remove());
  });

  it("does not render when closed", () => {
    mount(ColumnCustomizationDialog, {
      props: { open: false, table: createMockTable() as never },
      global: { mocks: { $t: (key: string) => key } },
    });
    expect(document.body.querySelector(".dialog-overlay")).toBeNull();
  });

  it("renders when open", async () => {
    const wrapper = mount(ColumnCustomizationDialog, {
      props: { open: false, table: createMockTable() as never },
      global: { mocks: { $t: (key: string) => key } },
    });
    await wrapper.setProps({ open: true });
    await wrapper.vm.$nextTick();
    expect(document.body.querySelector(".dialog-overlay")).not.toBeNull();
  });

  it("has correct ARIA attributes", async () => {
    const wrapper = mount(ColumnCustomizationDialog, {
      props: { open: false, table: createMockTable() as never },
      global: { mocks: { $t: (key: string) => key } },
    });
    await wrapper.setProps({ open: true });
    await wrapper.vm.$nextTick();
    const dialog = document.body.querySelector("[role='dialog']");
    expect(dialog).not.toBeNull();
    expect(dialog!.getAttribute("aria-modal")).toBe("true");
    expect(dialog!.getAttribute("aria-labelledby")).toBe(
      "column-dialog-title",
    );
  });

  it("renders column checkboxes", async () => {
    const wrapper = mount(ColumnCustomizationDialog, {
      props: { open: false, table: createMockTable() as never },
      global: { mocks: { $t: (key: string) => key } },
    });
    await wrapper.setProps({ open: true });
    await wrapper.vm.$nextTick();
    const checkboxes = document.body.querySelectorAll(
      'input[type="checkbox"]',
    );
    expect(checkboxes).toHaveLength(2);
  });

  it("emits close on Escape", async () => {
    const wrapper = mount(ColumnCustomizationDialog, {
      props: { open: false, table: createMockTable() as never },
      global: { mocks: { $t: (key: string) => key } },
    });
    await wrapper.setProps({ open: true });
    await wrapper.vm.$nextTick();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted("close")).toBeTruthy();
  });

  it("emits close on cancel button", async () => {
    const wrapper = mount(ColumnCustomizationDialog, {
      props: { open: false, table: createMockTable() as never },
      global: { mocks: { $t: (key: string) => key } },
    });
    await wrapper.setProps({ open: true });
    await wrapper.vm.$nextTick();
    const cancelBtn = document.body.querySelector(
      ".dialog-footer .btn:not(.btn-primary)",
    ) as HTMLElement;
    cancelBtn.click();
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted("close")).toBeTruthy();
  });
});
