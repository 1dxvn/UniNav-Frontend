// Presentation only: opening a panel never moves the avatar, changes a route or reloads a model.
export type ExplorerPanel = "places" | "directions" | "tools";

function get<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing explorer element #${id}`);
  return node as T;
}

export class ExplorerShell {
  private panel: ExplorerPanel | null = null;
  private returnFocus: HTMLElement | null = null;
  private restoringFocus = false;
  private readonly abort = new AbortController();
  private readonly host = get("campus-panel");
  private readonly search = get<HTMLInputElement>("search");
  private readonly mobile = window.matchMedia("(max-width: 760px)");

  constructor(private readonly redrawMinimap: () => void) {
    const options = { signal: this.abort.signal };
    for (const [id, panel] of [["open-places", "places"], ["open-directions", "directions"], ["open-tools", "tools"]] as const) {
      get(id).addEventListener("click", () => {
        if (this.panel === panel) this.close();
        else { this.open(panel, true); if (panel === "places") this.search.focus({ preventScroll: true }); }
      }, options);
    }
    this.search.addEventListener("focus", () => { if (!this.restoringFocus) this.open("places"); }, options);
    this.search.addEventListener("input", () => { this.open("places"); get("search-clear").hidden = !this.search.value; }, options);
    get("search-clear").addEventListener("click", () => {
      this.search.value = ""; this.search.dispatchEvent(new Event("input")); this.search.focus({ preventScroll: true });
    }, options);
    get("panel-close").addEventListener("click", () => this.close(), options);
    get("active-route-return").addEventListener("click", () => this.close(false), options);
    get("panel-expand").addEventListener("click", () => this.expand(!this.host.classList.contains("is-expanded")), options);
    get("journey-collapse").addEventListener("click", () => this.compactJourney(!get("route-card").classList.contains("is-compact")), options);
    get("minimap-toggle").addEventListener("click", () => this.showMinimap(get("minimap-wrap").hidden), options);
    get("minimap-close").addEventListener("click", () => { this.showMinimap(false); get("minimap-toggle").focus(); }, options);
    get("focus-toggle").addEventListener("click", () => this.focusMode(true), options);
    get("exit-focus").addEventListener("click", () => this.focusMode(false), options);
    get("panel-title").tabIndex = -1;
    window.addEventListener("keydown", event => {
      if (document.querySelector("dialog[open]")) return;
      if (event.key === "Escape" && (this.panel || document.body.classList.contains("is-focus"))) {
        event.preventDefault(); event.stopImmediatePropagation();
        if (document.body.classList.contains("is-focus")) this.focusMode(false); else this.close();
      } else if (event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey &&
        !(event.target instanceof HTMLElement && event.target.closest("input,textarea,select,[contenteditable='true']"))) {
        event.preventDefault(); this.search.focus();
      }
    }, options);
    const viewport = () => {
      const vv = window.visualViewport;
      document.documentElement.style.setProperty("--app-height", `${vv?.height ?? window.innerHeight}px`);
      document.documentElement.style.setProperty("--app-top", `${vv?.offsetTop ?? 0}px`);
      document.body.classList.toggle("keyboard-open", this.mobile.matches && window.innerHeight - (vv?.height ?? window.innerHeight) > 140);
      if (!get("minimap-wrap").hidden) this.redrawMinimap();
      if (document.body.classList.contains('keyboard-open')) window.requestAnimationFrame(() => {
        if (this.abort.signal.aborted || !(document.activeElement instanceof HTMLElement)) return;
        const field = document.activeElement;
        const scroll = field.closest<HTMLElement>('.panel-scroll,dialog[open]');
        if (!scroll) return;
        const outer = scroll.getBoundingClientRect(), inner = field.getBoundingClientRect();
        const top = outer.top + 8, bottom = Math.min(outer.bottom, window.visualViewport?.height ?? window.innerHeight) - 8;
        if (inner.bottom > bottom) scroll.scrollTop += inner.bottom - bottom;
        else if (inner.top < top) scroll.scrollTop -= top - inner.top;
      });
    };
    window.visualViewport?.addEventListener("resize", viewport, options);
    window.visualViewport?.addEventListener("scroll", viewport, options);
    window.addEventListener("resize", viewport, options);
    window.addEventListener('focusin', () => { if (document.body.classList.contains('keyboard-open')) viewport(); }, options);
    viewport();
  }

  open(panel: ExplorerPanel, moveFocus = false): void {
    if (!this.panel) this.returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.panel = panel;
    this.host.hidden = false;
    document.body.dataset.panel = panel;
    get("planner").hidden = panel === "tools";
    get("places-content").hidden = panel !== "places";
    get("route-options").hidden = panel !== "directions";
    get("panel-route-actions").hidden = panel !== "directions";
    get("campus-tools").hidden = panel !== "tools";
    const labels = { places: ["DESCUBRE UNINAV", "Encuentra tu lugar"], directions: ["DE AQUÍ, A DONDE QUIERAS", "Tu próximo destino"], tools: ["TU UNIVERSIDAD, CONECTADA", "Más de tu campus"] };
    get("panel-kicker").textContent = labels[panel][0];
    get("panel-title").textContent = labels[panel][1];
    for (const [id, own] of [["open-places", "places"], ["open-directions", "directions"], ["open-tools", "tools"]]) get(id).setAttribute("aria-expanded", String(own === panel));
    if (moveFocus) get("panel-title").focus({ preventScroll: true });
  }

  close(restoreFocus = true): void {
    this.panel = null; this.host.hidden = true; document.body.dataset.panel = "none";
    for (const id of ["open-places", "open-directions", "open-tools"]) get(id).setAttribute("aria-expanded", "false");
    this.expand(false);
    if (restoreFocus && this.returnFocus?.isConnected) {
      this.restoringFocus = true; this.returnFocus.focus({ preventScroll: true }); this.restoringFocus = false;
    }
  }

  selected(): void {
    this.search.blur(); this.open("directions", true);
    this.expand(false);
  }

  routeActive(active: boolean): void {
    get("active-route-return").hidden = !active;
    get("route-dot").hidden = !active;
    if (!active) this.compactJourney(false);
  }

  routeReady(): void {
    this.routeActive(true); this.close(false); this.compactJourney(false);
    get("follow").focus({ preventScroll: true });
  }

  walking(): void { this.close(false); this.compactJourney(true); }

  private expand(expanded: boolean): void {
    this.host.classList.toggle("is-expanded", expanded);
    const button = get("panel-expand"); button.setAttribute("aria-expanded", String(expanded));
    button.setAttribute("aria-label", expanded ? "Reducir panel" : "Expandir panel");
  }

  private compactJourney(compact: boolean): void {
    get("route-card").classList.toggle("is-compact", compact);
    get("journey-collapse").setAttribute("aria-expanded", String(!compact));
    get("journey-collapse").setAttribute("aria-label", compact ? "Ampliar tarjeta de recorrido" : "Reducir tarjeta de recorrido");
    get("journey-collapse").textContent = compact ? "⌃" : "⌄";
  }

  private showMinimap(show: boolean): void {
    get("minimap-wrap").hidden = !show;
    get("minimap-toggle").setAttribute("aria-expanded", String(show));
    get("minimap-toggle").setAttribute("aria-label", show ? "Ocultar minimapa" : "Mostrar minimapa");
    if (show) this.redrawMinimap();
  }

  private focusMode(focus: boolean): void {
    document.body.classList.toggle("is-focus", focus); get("exit-focus").hidden = !focus;
    if (focus) { this.close(false); get("exit-focus").focus(); }
    else get("scene").querySelector("canvas")?.focus({ preventScroll: true });
    const more = document.querySelector<HTMLDetailsElement>(".more-tools"); if (more) more.open = false;
  }

  dispose(): void { this.abort.abort(); }
}
