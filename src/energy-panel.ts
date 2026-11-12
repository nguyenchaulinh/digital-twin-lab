import { createLineChart, type LineChart } from "./chart";
import type { EnergySeries } from "./history";
import { fmt, t } from "./i18n";

// "AC energy since opened": two figures and the chart. The simulator's own number (actual) next to
// the part of it the advisor says could have been avoided, an estimate that is never above the actual.
export interface EnergyPanel {
  update: (series: EnergySeries | null) => void;
}

function element<K extends keyof HTMLElementTagNameMap>(name: K, cls: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(name);
  node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

function tile(): { root: HTMLElement; label: HTMLElement; value: HTMLElement; sub: HTMLElement } {
  const root = element("div", "tile");
  const label = element("span", "tile-label");
  const value = element("span", "tile-value");
  const sub = element("span", "tile-sub");
  root.append(label, value, sub);
  return { root, label, value, sub };
}

export function createEnergyPanel(host: HTMLElement): EnergyPanel {
  host.replaceChildren();
  const title = element("h3", "energy-title");
  const tiles = element("div", "tiles");
  const actual = tile();
  const avoidable = tile();
  tiles.append(actual.root, avoidable.root);
  const chartHost = element("div", "");
  const chart: LineChart = createLineChart(chartHost);
  const note = element("p", "energy-note");
  const changed = element("p", "energy-note energy-changed");
  host.append(title, tiles, chartHost, note, changed);

  return {
    update(series) {
      title.textContent = t("energy.title");
      actual.label.textContent = t("energy.actual");
      avoidable.label.textContent = t("energy.avoidable");
      note.textContent = t("energy.note");
      changed.textContent = t("energy.changed");
      changed.hidden = !series?.tainted;

      const totalActual = series?.totalActual ?? 0;
      const totalAvoidable = series?.totalAvoidable ?? 0;
      actual.value.textContent = series ? `${fmt(totalActual, 1)} kWh` : "–";
      avoidable.value.textContent = series ? `${fmt(totalAvoidable, 1)} kWh` : "–";
      avoidable.sub.textContent = series && totalActual > 0 ? t("energy.share", { p: fmt((totalAvoidable / totalActual) * 100, 0) }) : "";

      chart.update({
        title: t("energy.title"),
        xs: series?.hours ?? [],
        series: [
          { label: t("energy.legendActual"), cls: "s1", values: series?.actual ?? [] },
          { label: t("energy.legendAvoidable"), cls: "s2", values: series?.avoidable ?? [] },
        ],
        unit: "kWh",
        xTitle: t("energy.xAxis"),
        xHeader: t("energy.colHours"),
        tableLabel: t("energy.table"),
        emptyText: t("energy.waiting"),
        tooltipHead: (x) => t("energy.at", { h: fmt(x, 1) }),
      });
    },
  };
}
