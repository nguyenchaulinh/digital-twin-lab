import { nearestIndex, niceTicks, sampleIndices, tickDecimals } from "./chart-scale";
import { fmt } from "./i18n";

// A small line chart in plain SVG: one y axis, 2 px lines, an end dot with a surface ring, a crosshair
// that snaps to the nearest point with one tooltip for every series, the same readout from the
// keyboard, and a table twin of the data. Colours come from CSS (index.html, .viz); every string that
// reaches the DOM goes through textContent.
const SVG_NS = "http://www.w3.org/2000/svg";
const WIDTH = 356;
const HEIGHT = 190;
const MARGIN = { top: 12, right: 76, bottom: 24, left: 40 }; // the right margin holds the direct labels
const END_DOT_RADIUS = 4;
const LABEL_MIN_GAP = 13; // px between two end labels before they would touch
const TABLE_ROWS = 24;
const KEY_STEP = 12; // PageUp / PageDown move this many points

export interface ChartSeries {
  label: string;
  cls: "s1" | "s2"; // which categorical slot (see the CSS variables)
  values: number[]; // one per x
}

export interface ChartSpec {
  title: string; // the accessible name
  xs: number[];
  series: ChartSeries[];
  unit: string; // after the values in the tooltip and the table
  xTitle: string;
  xHeader: string; // first column of the table
  tableLabel: string;
  emptyText: string; // shown until there are two points to draw
  tooltipHead: (x: number) => string;
}

export interface LineChart {
  update: (spec: ChartSpec) => void;
}

function svg<K extends keyof SVGElementTagNameMap>(name: K, attrs: Record<string, string | number> = {}, cls?: string): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  if (cls) node.setAttribute("class", cls);
  return node;
}

function html<K extends keyof HTMLElementTagNameMap>(name: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(name);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function createLineChart(host: HTMLElement): LineChart {
  host.replaceChildren();
  host.classList.add("viz");

  const legend = html("div", "viz-legend");
  const plot = html("div", "viz-plot");
  const surface = svg("svg", { viewBox: `0 0 ${WIDTH} ${HEIGHT}`, tabindex: 0, role: "img" }, "viz-svg");
  const empty = html("div", "viz-empty");
  const tooltip = html("div", "viz-tooltip");
  tooltip.hidden = true;
  plot.append(surface, empty, tooltip);
  const details = html("details", "viz-table");
  const summary = html("summary");
  const tableWrap = html("div");
  details.append(summary, tableWrap);
  host.append(legend, plot, details);

  let spec: ChartSpec | null = null;
  let hover: number | null = null;
  // Set on every draw: how the data maps to the picture
  let scaleX = (_x: number): number => 0;
  let scaleY = (_y: number): number => 0;

  const plotWidth = WIDTH - MARGIN.left - MARGIN.right;
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;

  function drawLegend(s: ChartSpec): void {
    legend.replaceChildren();
    for (const series of s.series) {
      const item = html("span", "viz-legend-item");
      item.append(html("i", `viz-key ${series.cls}`), html("span", undefined, series.label));
      legend.append(item);
    }
    legend.append(html("span", "viz-legend-x", s.xTitle));
  }

  function drawTable(s: ChartSpec): void {
    summary.textContent = s.tableLabel;
    if (!details.open) return; // built when it is opened, so a closed table costs nothing
    const table = html("table");
    const head = html("tr");
    head.append(html("th", undefined, s.xHeader));
    for (const series of s.series) head.append(html("th", undefined, `${series.label} (${s.unit})`));
    const thead = html("thead");
    thead.append(head);
    table.append(thead);
    const body = html("tbody");
    for (const i of sampleIndices(s.xs.length, TABLE_ROWS)) {
      const row = html("tr");
      row.append(html("td", "num", fmt(s.xs[i], 1)));
      for (const series of s.series) row.append(html("td", "num", fmt(series.values[i], 2)));
      body.append(row);
    }
    table.append(body);
    tableWrap.replaceChildren(table);
  }

  function drawPlot(s: ChartSpec): void {
    surface.replaceChildren();
    const x0 = s.xs[0];
    const xMax = s.xs[s.xs.length - 1];
    const yMax = Math.max(...s.series.flatMap((series) => series.values), 0);
    const yTicks = niceTicks(yMax, 4);
    const yTop = yTicks[yTicks.length - 1];
    const decimals = tickDecimals(yTicks);
    scaleX = (x) => MARGIN.left + ((x - x0) / (xMax - x0)) * plotWidth;
    scaleY = (y) => MARGIN.top + plotHeight - (y / yTop) * plotHeight;

    // Hairline grid and baseline; the labels carry the values the lines do not
    for (const tick of yTicks) {
      const y = scaleY(tick);
      surface.append(svg("line", { x1: MARGIN.left, x2: WIDTH - MARGIN.right, y1: y, y2: y }, tick === 0 ? "viz-axis" : "viz-grid"));
      const label = svg("text", { x: MARGIN.left - 6, y: y + 4, "text-anchor": "end" }, "viz-tick");
      label.textContent = fmt(tick, decimals);
      surface.append(label);
    }
    const xStep = niceTicks(xMax - x0, 4);
    const step = xStep.length > 1 ? xStep[1] - xStep[0] : 1;
    const firstTick = Math.ceil(x0 / step - 1e-9) * step || 0; // `|| 0`: ceil of a hair below zero is -0, which would be written "-0"
    for (let v = firstTick; v <= xMax + step * 1e-9; v += step) {
      const label = svg("text", { x: scaleX(v), y: HEIGHT - 6, "text-anchor": "middle" }, "viz-tick");
      label.textContent = fmt(v, tickDecimals(xStep));
      surface.append(label);
    }

    // Lines, then the end dots and (when they do not collide) the direct labels
    const ends: Array<{ series: ChartSeries; x: number; y: number }> = [];
    for (const series of s.series) {
      const d = series.values.map((v, i) => `${i === 0 ? "M" : "L"}${scaleX(s.xs[i]).toFixed(1)} ${scaleY(v).toFixed(1)}`).join("");
      surface.append(svg("path", { d }, `viz-line ${series.cls}`));
      ends.push({ series, x: scaleX(xMax), y: scaleY(series.values[series.values.length - 1]) });
    }
    const apart = ends.every((a, i) => ends.every((b, j) => i === j || Math.abs(a.y - b.y) >= LABEL_MIN_GAP));
    for (const end of ends) {
      surface.append(svg("circle", { cx: end.x, cy: end.y, r: END_DOT_RADIUS }, `viz-dot ${end.series.cls}`));
      if (apart) {
        const label = svg("text", { x: end.x + 9, y: end.y + 4 }, "viz-end-label");
        label.textContent = end.series.label;
        surface.append(label);
      }
    }

    // The crosshair layer is redrawn last so that it sits on top
    // (hidden by attribute, not by CSS: a CSS rule would beat the attribute that showHover sets)
    surface.append(svg("line", { y1: MARGIN.top, y2: MARGIN.top + plotHeight, visibility: "hidden" }, "viz-crosshair"));
    for (const series of s.series) surface.append(svg("circle", { r: END_DOT_RADIUS, visibility: "hidden" }, `viz-dot viz-hover-dot ${series.cls}`));
    const last = s.series.map((series) => `${series.label} ${fmt(series.values[series.values.length - 1], 2)} ${s.unit}`).join(", ");
    surface.setAttribute("aria-label", `${s.title}: ${last}`);
  }

  function showHover(): void {
    const crosshair = surface.querySelector<SVGLineElement>(".viz-crosshair");
    const dots = surface.querySelectorAll<SVGCircleElement>(".viz-hover-dot");
    if (!spec || !crosshair || hover === null || hover < 0 || hover >= spec.xs.length) {
      crosshair?.setAttribute("visibility", "hidden");
      for (const dot of dots) dot.setAttribute("visibility", "hidden");
      tooltip.hidden = true;
      return;
    }
    const x = scaleX(spec.xs[hover]);
    crosshair.setAttribute("x1", String(x));
    crosshair.setAttribute("x2", String(x));
    crosshair.setAttribute("visibility", "visible");
    dots.forEach((dot, i) => {
      dot.setAttribute("cx", String(x));
      dot.setAttribute("cy", String(scaleY(spec!.series[i].values[hover!])));
      dot.setAttribute("visibility", "visible");
    });

    // One tooltip, every series: the value leads, the name follows
    tooltip.replaceChildren(html("div", "viz-tip-head", spec.tooltipHead(spec.xs[hover])));
    for (const series of spec.series) {
      const row = html("div", "viz-tip-row");
      row.append(html("i", `viz-key ${series.cls}`), html("strong", undefined, `${fmt(series.values[hover], 2)} ${spec.unit}`), html("span", undefined, series.label));
      tooltip.append(row);
    }
    tooltip.hidden = false;
    const scale = surface.getBoundingClientRect().width / WIDTH || 1;
    const fitsRight = x * scale + 12 + tooltip.offsetWidth <= plot.clientWidth;
    tooltip.style.left = `${fitsRight ? x * scale + 12 : Math.max(x * scale - 12 - tooltip.offsetWidth, 0)}px`;
    tooltip.style.top = `${MARGIN.top * scale}px`;
  }

  function setHover(index: number | null): void {
    hover = index;
    showHover();
  }

  const length = (): number => spec?.xs.length ?? 0;
  surface.addEventListener("pointermove", (ev) => {
    if (!spec) return;
    const rect = surface.getBoundingClientRect();
    const x = ((ev.clientX - rect.left) / rect.width) * WIDTH;
    const x0 = spec.xs[0];
    const xMax = spec.xs[length() - 1];
    setHover(nearestIndex(spec.xs, x0 + ((x - MARGIN.left) / plotWidth) * (xMax - x0)));
  });
  surface.addEventListener("pointerleave", () => {
    if (document.activeElement !== surface) setHover(null);
  });
  surface.addEventListener("focus", () => setHover(hover ?? length() - 1));
  surface.addEventListener("blur", () => setHover(null));
  surface.addEventListener("keydown", (ev) => {
    const last = length() - 1;
    const at = hover ?? last;
    const moves: Record<string, number> = {
      ArrowLeft: Math.max(at - 1, 0),
      ArrowRight: Math.min(at + 1, last),
      PageUp: Math.max(at - KEY_STEP, 0),
      PageDown: Math.min(at + KEY_STEP, last),
      Home: 0,
      End: last,
    };
    if (ev.key === "Escape") {
      setHover(null);
      surface.blur();
      ev.stopPropagation(); // Esc here only leaves the chart; it must not also close the building
    } else if (ev.key in moves && last >= 0) {
      ev.preventDefault();
      setHover(moves[ev.key]);
    }
  });
  details.addEventListener("toggle", () => spec && drawTable(spec));

  return {
    update(next) {
      spec = next;
      drawLegend(next);
      drawTable(next);
      const ready = next.xs.length >= 2 && next.series.every((s) => s.values.length === next.xs.length);
      surface.style.display = ready ? "" : "none";
      empty.style.display = ready ? "none" : "";
      empty.textContent = next.emptyText;
      if (!ready) {
        tooltip.hidden = true;
        return;
      }
      drawPlot(next);
      showHover();
    },
  };
}
