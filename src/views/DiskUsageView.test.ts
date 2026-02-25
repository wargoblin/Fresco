import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import DiskUsageView from "./DiskUsageView.vue";
import { useDiskUsageStore } from "../stores/diskUsage";
import { useProjectsStore } from "../stores/projects";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

// Mock RPC to prevent real fetch in onMounted
vi.mock("../composables/useRpc", () => ({
  getDiskUsage: vi.fn().mockResolvedValue({
    projects: [],
    d_total: 0,
    d_free: 0,
    d_boinc: 0,
    d_allowed: 0,
  }),
}));

vi.mock("../components/PageHeader.vue", () => ({
  default: { template: '<div class="page-header">Disk Usage</div>' },
}));

vi.mock("../components/EmptyState.vue", () => ({
  default: { template: '<div class="empty-state">No data</div>' },
}));

// ── Pure function tests ─────────────────────────────────────────
// DiskUsageView defines these as local functions inside <script setup>.
// We can't import them directly, so we replicate them for testing.
// These tests ensure the formatting logic is correct.

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function formatPercent(fraction: number): string {
  return `${(fraction * 100).toFixed(1)}%`;
}

describe("DiskUsageView utility functions", () => {
  describe("formatBytes", () => {
    it("returns '0 B' for zero", () => {
      expect(formatBytes(0)).toBe("0 B");
    });

    it("returns '0 B' for negative values", () => {
      expect(formatBytes(-100)).toBe("0 B");
    });

    it("formats bytes", () => {
      expect(formatBytes(512)).toBe("512.0 B");
    });

    it("formats kilobytes", () => {
      expect(formatBytes(1024)).toBe("1.0 KB");
      expect(formatBytes(1536)).toBe("1.5 KB");
    });

    it("formats megabytes", () => {
      expect(formatBytes(1048576)).toBe("1.0 MB");
    });

    it("formats gigabytes", () => {
      expect(formatBytes(1073741824)).toBe("1.0 GB");
    });

    it("formats terabytes", () => {
      expect(formatBytes(1099511627776)).toBe("1.0 TB");
    });

    it("caps at TB for very large values", () => {
      // 1024 TB = should still show as TB (no PB unit)
      const petabyte = 1099511627776 * 1024;
      expect(formatBytes(petabyte)).toBe("1024.0 TB");
    });
  });

  describe("formatPercent", () => {
    it("formats zero", () => {
      expect(formatPercent(0)).toBe("0.0%");
    });

    it("formats 50%", () => {
      expect(formatPercent(0.5)).toBe("50.0%");
    });

    it("formats 100%", () => {
      expect(formatPercent(1)).toBe("100.0%");
    });

    it("formats fractional percentage", () => {
      expect(formatPercent(0.333)).toBe("33.3%");
    });
  });
});

describe("DiskUsageView component", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("shows loading state when data is not yet available", () => {
    const store = useDiskUsageStore();
    store.loading = true;

    const wrapper = mount(DiskUsageView);
    expect(wrapper.text()).toContain("Loading disk usage");
  });

  it("shows empty state when d_total is 0 and not loading", () => {
    const store = useDiskUsageStore();
    store.loading = false;
    store.usage = { projects: [], d_total: 0, d_free: 0, d_boinc: 0, d_allowed: 0 };

    const wrapper = mount(DiskUsageView);
    expect(wrapper.find(".empty-state").exists()).toBe(true);
  });

  it("shows error message when error is set", () => {
    const store = useDiskUsageStore();
    store.error = "Connection failed";

    const wrapper = mount(DiskUsageView);
    expect(wrapper.text()).toContain("Connection failed");
  });

  it("renders summary cards with formatted values", () => {
    const store = useDiskUsageStore();
    store.loading = false;
    store.usage = {
      projects: [],
      d_total: 500 * 1073741824,  // 500 GB
      d_free: 200 * 1073741824,   // 200 GB
      d_boinc: 50 * 1073741824,   // 50 GB
      d_allowed: 100 * 1073741824, // 100 GB
    };

    const wrapper = mount(DiskUsageView);
    const text = wrapper.text();
    expect(text).toContain("500.0 GB");
    expect(text).toContain("200.0 GB");
    expect(text).toContain("50.0 GB");
    expect(text).toContain("100.0 GB");
  });

  it("renders project legend when projects exist", () => {
    const diskStore = useDiskUsageStore();
    const projStore = useProjectsStore();

    projStore.projects = [
      { master_url: "https://example.com/proj1", project_name: "Project Alpha" },
    ] as never[];

    diskStore.loading = false;
    diskStore.usage = {
      projects: [{ master_url: "https://example.com/proj1", disk_usage: 1073741824 }],
      d_total: 500 * 1073741824,
      d_free: 200 * 1073741824,
      d_boinc: 1073741824,
      d_allowed: 100 * 1073741824,
    };

    const wrapper = mount(DiskUsageView);
    expect(wrapper.text()).toContain("Project Alpha");
    expect(wrapper.text()).toContain("1.0 GB");
  });

  it("falls back to URL when project name is not found", () => {
    const diskStore = useDiskUsageStore();
    diskStore.loading = false;
    diskStore.usage = {
      projects: [{ master_url: "https://unknown.org/", disk_usage: 1048576 }],
      d_total: 500 * 1073741824,
      d_free: 200 * 1073741824,
      d_boinc: 1048576,
      d_allowed: 100 * 1073741824,
    };

    const wrapper = mount(DiskUsageView);
    expect(wrapper.text()).toContain("https://unknown.org/");
  });

  it("renders SVG doughnut chart paths for projects", () => {
    const diskStore = useDiskUsageStore();
    diskStore.loading = false;
    diskStore.usage = {
      projects: [
        { master_url: "https://a.org/", disk_usage: 500 },
        { master_url: "https://b.org/", disk_usage: 500 },
      ],
      d_total: 1000,
      d_free: 0,
      d_boinc: 1000,
      d_allowed: 1000,
    };

    const wrapper = mount(DiskUsageView);
    const paths = wrapper.findAll("svg path");
    expect(paths.length).toBe(2);
  });
});
