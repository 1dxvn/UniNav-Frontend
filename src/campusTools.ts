// "Your campus" panel (Plan 1 §11): assistant, history and statistics, back/forward, guided tours, queues and rankings,
// and administration. Every action calls an existing FastAPI endpoint; state kept in server memory (navigation trail,
// tour sessions, queues) behaves as the backend documents and does not survive a server restart.
import { api, ApiError } from "./api/client.ts";
import type { Building, NavigationState, TourSession } from "./api/types.ts";
import { askCampus } from "./assistant.ts";

export interface CampusToolsHost {
  places(): Building[];
  destination(): Building | undefined;
  floorName(level: number): string;
  select(place: Building): void;
  routeTo(place: Building): Promise<void>;
  signedIn(): boolean;
  admin(): boolean;
  openLogin(): void;
}
type Tab = "assistant" | "history" | "tours" | "queues" | "admin";

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> & { dataset?: Record<string, string> } = {}, ...children: (Node | string)[]): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag); const { dataset, ...rest } = props;
  Object.assign(node, rest); if (dataset) Object.assign(node.dataset, dataset); node.append(...children); return node;
}
function message(error: unknown): string {
  if (error instanceof ApiError && error.status === 401) return "Sign in to use this.";
  return error instanceof Error ? error.message : String(error);
}

export class CampusTools {
  private tab: Tab = "assistant";
  private readonly body: HTMLElement;
  private readonly tabs = new Map<Tab, HTMLButtonElement>();
  private navigation: NavigationState = { current: null, can_go_back: false, can_go_forward: false };
  private draft: Building[] = [];
  private readonly root: HTMLElement;
  private readonly back: HTMLButtonElement;
  private readonly forward: HTMLButtonElement;
  private readonly host: CampusToolsHost;

  constructor(root: HTMLElement, back: HTMLButtonElement, forward: HTMLButtonElement, host: CampusToolsHost) {
    this.root = root; this.back = back; this.forward = forward; this.host = host;
    const bar = root.querySelector<HTMLElement>(".tool-tabs")!; this.body = root.querySelector<HTMLElement>(".tool-body")!;
    for (const [tab, label] of [["assistant", "Assistant"], ["history", "History"], ["tours", "Tours"], ["queues", "Queues"], ["admin", "Admin"]] as [Tab, string][]) {
      const button = el("button", { type: "button", className: "tool-tab", textContent: label, id: `tool-${tab}` });
      button.setAttribute("role", "tab"); button.addEventListener("click", () => void this.show(tab)); bar.append(button); this.tabs.set(tab, button);
    }
    back.addEventListener("click", () => void this.step("back"));
    forward.addEventListener("click", () => void this.step("forward"));
    void this.show("assistant");
  }

  // Session or role changes refresh the visible tab and the back/forward state.
  async refresh(): Promise<void> {
    this.tabs.get("admin")!.hidden = !this.host.admin();
    if (this.tab === "admin" && !this.host.admin()) this.tab = "assistant";
    await this.loadNavigation();
    await this.show(this.tab);
  }
  // Called when the avatar arrives at a destination: records the visit for back/forward.
  async arrived(place: Building): Promise<void> {
    if (!this.host.signedIn()) return;
    try { this.navigation = await api.visit(place.id); } catch { /* the route itself already succeeded */ }
    this.syncNavigation();
    if (this.tab === "history") await this.show("history");
  }
  private async loadNavigation(): Promise<void> {
    if (!this.host.signedIn()) { this.navigation = { current: null, can_go_back: false, can_go_forward: false }; this.syncNavigation(); return; }
    try { this.navigation = await api.trail(); } catch { this.navigation = { current: null, can_go_back: false, can_go_forward: false }; }
    this.syncNavigation();
  }
  private syncNavigation(): void {
    this.back.disabled = !this.navigation.can_go_back; this.forward.disabled = !this.navigation.can_go_forward;
    this.back.title = this.navigation.can_go_back ? "Previous visited place" : "No previous visited place";
    this.forward.title = this.navigation.can_go_forward ? "Next visited place" : "No next visited place";
  }
  private async step(direction: "back" | "forward"): Promise<void> {
    try {
      this.navigation = await (direction === "back" ? api.back() : api.forward());
      const place = this.navigation.current && this.host.places().find((p) => p.id === this.navigation.current!.building_id);
      if (place) this.host.select(place);
    } catch (error) { this.notice(message(error)); }
    this.syncNavigation();
  }

  private notice(text: string, kind: "info" | "error" = "error"): void {
    const note = el("p", { className: kind === "error" ? "error tool-note" : "field-hint tool-note", textContent: text });
    note.setAttribute("role", kind === "error" ? "alert" : "status");
    this.body.querySelector(".tool-note")?.remove(); this.body.prepend(note);
  }
  private placeButton(place: Building, detail: string): HTMLElement {
    const go = el("button", { type: "button", className: "text-button", textContent: "Go ↗" });
    go.addEventListener("click", () => void this.host.routeTo(place));
    const pick = el("button", { type: "button", className: "tool-link", textContent: place.display_name ?? place.name });
    pick.addEventListener("click", () => this.host.select(place));
    return el("li", { className: "tool-item" }, el("span", {}, pick, el("small", { textContent: detail })), go);
  }
  private requireSession(): boolean {
    if (this.host.signedIn()) return true;
    const button = el("button", { type: "button", className: "button button-outline", textContent: "Sign in to continue" });
    button.addEventListener("click", () => this.host.openLogin());
    this.body.replaceChildren(el("p", { className: "field-hint", textContent: "This needs your account." }), button);
    return false;
  }

  async show(tab: Tab): Promise<void> {
    this.tab = tab;
    for (const [name, button] of this.tabs) { button.classList.toggle("active", name === tab); button.setAttribute("aria-selected", String(name === tab)); }
    this.root.dataset.tab = tab;
    try {
      if (tab === "assistant") this.renderAssistant();
      else if (tab === "history") await this.renderHistory();
      else if (tab === "tours") await this.renderTours();
      else if (tab === "queues") await this.renderQueues();
      else await this.renderAdmin();
    } catch (error) { this.body.replaceChildren(); this.notice(message(error)); }
  }

  private renderAssistant(): void {
    const input = el("input", { type: "search", placeholder: "e.g. computer lab on floor 3, baño, sala de espera", id: "assistant-question" });
    input.setAttribute("aria-label", "Ask the campus assistant");
    const ask = el("button", { type: "button", className: "button button-dark", textContent: "Ask →", id: "assistant-ask" });
    const answers = el("ol", { className: "tool-list", id: "assistant-answers" });
    const run = () => {
      const answer = askCampus(input.value, this.host.places());
      answers.replaceChildren(...answer.matches.map((m) => this.placeButton(m.place, `${m.place.block_code ? `Block ${m.place.block_code} · ` : ""}${this.host.floorName(m.place.floor)} · ${m.reason}`)));
      if (!answer.matches.length) answers.replaceChildren(el("li", { className: "field-hint", textContent: input.value.trim() ? "No confirmed place matches that need. Try a room number, service or floor." : "Describe what you need." }));
      this.root.dataset.answers = String(answer.matches.length);
    };
    ask.addEventListener("click", run); input.addEventListener("keydown", (e) => { if (e.key === "Enter") run(); });
    this.body.replaceChildren(el("p", { className: "field-hint", textContent: "Answers come only from confirmed campus places." }), el("div", { className: "tool-row" }, input, ask), answers);
  }

  private async renderHistory(): Promise<void> {
    if (!this.requireSession()) return;
    const [stats, visits] = await Promise.all([api.stats(), api.history(8)]);
    const tiles = el("div", { className: "tool-stats", id: "history-stats" },
      ...[["Routes", String(stats.total_routes)], ["Distance", `${stats.total_distance.toFixed(0)} m`], ["Average", `${stats.average_distance.toFixed(0)} m`]]
        .map(([k, v]) => el("div", {}, el("strong", { textContent: v }), el("small", { textContent: k }))));
    const list = el("ol", { className: "tool-list", id: "history-list" }, ...visits.map((v) => {
      const place = this.host.places().find((p) => p.name === v.destination_name || p.display_name === v.destination_name);
      const detail = `${new Date(v.visited_at).toLocaleString()} · ${v.distance.toFixed(0)} m from ${v.origin_name}`;
      return place ? this.placeButton(place, detail) : el("li", { className: "tool-item" }, el("span", {}, el("strong", { textContent: v.destination_name }), el("small", { textContent: detail })));
    }));
    if (!visits.length) list.append(el("li", { className: "field-hint", textContent: "No routes yet. Your calculated routes appear here." }));
    const clear = el("button", { type: "button", className: "text-button", textContent: "Clear history", disabled: !visits.length });
    clear.addEventListener("click", async () => { try { await api.clearHistory(); await this.show("history"); } catch (error) { this.notice(message(error)); } });
    this.body.replaceChildren(tiles, stats.most_visited_destination ? el("p", { className: "field-hint", textContent: `Most visited: ${stats.most_visited_destination}` }) : "", list, clear);
  }

  private async renderTours(): Promise<void> {
    const tours = await api.tours();
    let session: TourSession | null = null;
    if (this.host.signedIn()) { try { session = await api.tourSession(); } catch { session = null; } }
    const parts: (Node | string)[] = [];
    if (session) {
      const stop = this.host.places().find((p) => p.id === session!.current_stop.building_id);
      const prev = el("button", { type: "button", className: "button button-outline", textContent: "← Previous", disabled: session.current_stop.position <= 1 });
      const next = el("button", { type: "button", className: "button button-outline", textContent: "Next →", disabled: session.current_stop.position >= session.total_stops });
      const go = el("button", { type: "button", className: "button button-dark", textContent: "Walk to this stop →", disabled: !stop, id: "tour-go" });
      const end = el("button", { type: "button", className: "text-button", textContent: "End tour" });
      prev.addEventListener("click", async () => { await api.previousStop().catch((e) => this.notice(message(e))); await this.show("tours"); });
      next.addEventListener("click", async () => { await api.nextStop().catch((e) => this.notice(message(e))); await this.show("tours"); });
      go.addEventListener("click", () => { if (stop) void this.host.routeTo(stop); });
      end.addEventListener("click", async () => { await api.endTour().catch(() => undefined); await this.show("tours"); });
      parts.push(el("div", { className: "tool-session", id: "tour-session" }, el("span", { className: "eyebrow", textContent: `TOUR · STOP ${session.current_stop.position} OF ${session.total_stops}` }),
        el("strong", { textContent: session.current_stop.building_name }), el("small", { className: "field-hint", textContent: `${session.tour_name} · ${this.host.floorName(session.current_stop.floor)}` }),
        el("div", { className: "tool-row" }, prev, next), go, end));
    }
    const list = el("ol", { className: "tool-list", id: "tour-list" }, ...tours.map((t) => {
      const start = el("button", { type: "button", className: "text-button", textContent: "Start ↗" });
      start.addEventListener("click", async () => {
        if (!this.host.signedIn()) { this.host.openLogin(); return; }
        try { await api.startTour(t.id); await this.show("tours"); } catch (error) { this.notice(message(error)); }
      });
      return el("li", { className: "tool-item" }, el("span", {}, el("strong", { textContent: t.name }), el("small", { textContent: `${t.stop_count} stops${t.description ? ` · ${t.description}` : ""}` })), start);
    }));
    if (!tours.length) list.append(el("li", { className: "field-hint", textContent: "No guided tours yet. An administrator can create one in Admin." }));
    this.body.replaceChildren(...parts, list);
  }

  private async renderQueues(): Promise<void> {
    const target = this.host.destination();
    const [ranking, popular] = await Promise.all([api.rankings(8), api.popularRoutes().catch(() => [])]);
    const parts: (Node | string)[] = [];
    if (target) {
      const status = await api.queue(target.id);
      let position: number | null = null;
      if (this.host.signedIn()) { try { position = (await api.queuePosition(target.id)).position; } catch { position = null; } }
      const join = el("button", { type: "button", className: "button button-dark", textContent: position ? "Leave the queue" : "Join the queue", id: "queue-toggle" });
      join.addEventListener("click", async () => {
        if (!this.host.signedIn()) { this.host.openLogin(); return; }
        try { if (position) await api.leaveQueue(target.id); else await api.joinQueue(target.id); await this.show("queues"); } catch (error) { this.notice(message(error)); }
      });
      parts.push(el("div", { className: "tool-session", id: "queue-status" }, el("span", { className: "eyebrow", textContent: "QUEUE AT YOUR DESTINATION" }), el("strong", { textContent: target.display_name ?? target.name }),
        el("small", { className: "field-hint", textContent: `${status.length} waiting${position ? ` · you are number ${position}` : ""}` }), join));
    } else parts.push(el("p", { className: "field-hint", textContent: "Choose a destination to see or join its queue." }));
    const ranks = el("ol", { className: "tool-list", id: "ranking-list" }, ...ranking.map((r) => {
      const place = this.host.places().find((p) => p.id === r.building_id);
      const detail = `#${r.rank} · ${r.visits} ${r.visits === 1 ? "visit" : "visits"} · ${this.host.floorName(r.floor)}`;
      return place ? this.placeButton(place, detail) : el("li", { className: "tool-item" }, el("span", {}, el("strong", { textContent: r.building_name }), el("small", { textContent: detail })));
    }));
    if (!ranking.length) ranks.append(el("li", { className: "field-hint", textContent: "No visits recorded yet." }));
    parts.push(el("span", { className: "eyebrow tool-heading", textContent: "MOST VISITED PLACES" }), ranks);
    if (popular.length) parts.push(el("span", { className: "eyebrow tool-heading", textContent: "POPULAR ROUTES" }),
      el("ol", { className: "tool-list" }, ...popular.slice(0, 5).map((r) => el("li", { className: "tool-item" }, el("span", {}, el("strong", { textContent: `${r.origin_name} → ${r.destination_name}` }), el("small", { textContent: `${r.frequency} ${r.frequency === 1 ? "time" : "times"}` }))))));
    this.body.replaceChildren(...parts);
  }

  private async renderAdmin(): Promise<void> {
    if (!this.requireSession()) return;
    if (!this.host.admin()) { this.body.replaceChildren(el("p", { className: "field-hint", textContent: "Administration needs an admin account." })); return; }
    const target = this.host.destination(), parts: (Node | string)[] = [el("p", { className: "field-hint", textContent: "Changes apply to the live API immediately." })];
    if (target) {
      const name = el("input", { value: target.display_name ?? target.name, id: "admin-display-name" }), type = el("input", { value: target.building_type ?? "", id: "admin-type" });
      name.setAttribute("aria-label", "Display name"); type.setAttribute("aria-label", "Place type");
      const save = el("button", { type: "button", className: "button button-dark", textContent: "Save place", id: "admin-save" });
      save.addEventListener("click", async () => {
        try { const updated = await api.updateBuilding(target.id, { display_name: name.value.trim() || null, building_type: type.value.trim() || null }); Object.assign(target, updated); this.notice(`Saved ${updated.display_name ?? updated.name}.`, "info"); }
        catch (error) { this.notice(message(error)); }
      });
      const serve = el("button", { type: "button", className: "button button-outline", textContent: "Serve next in queue" });
      serve.addEventListener("click", async () => { try { await api.serveQueue(target.id); this.notice("Served the next person.", "info"); } catch (error) { this.notice(message(error)); } });
      parts.push(el("span", { className: "eyebrow tool-heading", textContent: `EDIT · ${(target.display_name ?? target.name).toUpperCase()}` }), el("label", { className: "field-label", textContent: "DISPLAY NAME" }), name,
        el("label", { className: "field-label", textContent: "TYPE" }), type, el("div", { className: "tool-row" }, save, serve));
    } else parts.push(el("p", { className: "field-hint", textContent: "Choose a destination to edit it." }));
    // Tour builder: add the current destination as the next stop
    const tourName = el("input", { placeholder: "Tour name", id: "admin-tour-name" }); tourName.setAttribute("aria-label", "Tour name");
    const stops = el("ol", { className: "tool-list", id: "admin-tour-stops" }, ...this.draft.map((p) => el("li", { className: "tool-item", textContent: p.display_name ?? p.name })));
    const add = el("button", { type: "button", className: "button button-outline", textContent: "Add destination as stop", disabled: !target, id: "admin-add-stop" });
    add.addEventListener("click", () => { if (target && !this.draft.some((p) => p.id === target.id)) this.draft.push(target); void this.show("admin"); });
    const create = el("button", { type: "button", className: "button button-dark", textContent: "Create tour", disabled: this.draft.length < 2, id: "admin-create-tour" });
    create.addEventListener("click", async () => {
      try { const tour = await api.createTour(tourName.value.trim() || "Campus tour", null, this.draft.map((p) => p.id)); this.draft = []; await this.show("admin"); this.notice(`Created “${tour.name}” with ${tour.stops.length} stops.`, "info"); }
      catch (error) { this.notice(message(error)); }
    });
    const reload = el("button", { type: "button", className: "text-button", textContent: "Reload route graph" });
    reload.addEventListener("click", async () => { try { await api.reloadGraph(); this.notice("Route graph reloaded.", "info"); } catch (error) { this.notice(message(error)); } });
    const tours = await api.tours();
    const existing = el("ol", { className: "tool-list" }, ...tours.map((t) => {
      const remove = el("button", { type: "button", className: "text-button", textContent: "Delete" });
      remove.addEventListener("click", async () => { try { await api.deleteTour(t.id); await this.show("admin"); } catch (error) { this.notice(message(error)); } });
      return el("li", { className: "tool-item" }, el("span", {}, el("strong", { textContent: t.name }), el("small", { textContent: `${t.stop_count} stops` })), remove);
    }));
    parts.push(el("span", { className: "eyebrow tool-heading", textContent: "NEW GUIDED TOUR" }), tourName, stops, el("div", { className: "tool-row" }, add, create),
      el("span", { className: "eyebrow tool-heading", textContent: "TOURS" }), existing, reload);
    this.body.replaceChildren(...parts);
  }
}
