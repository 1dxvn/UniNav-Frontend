// "Your campus" panel (Plan 1 §11): assistant, history and statistics, back/forward, guided tours, queues and rankings,
// and administration. Every action calls an existing FastAPI endpoint. The updated
// single-worker backend persists its queue and linked-list state in its own database.
import { api, ApiError } from "./api/client.ts";
import type { Building, NavigationState, TourSession } from "./api/types.ts";
import { CampusAssistant, type AssistantAction, type AssistantPlace, type AssistantRoute } from "./assistant.ts";
import { icon, labelled, placeIcon, type IconName } from "./icons.ts";

export interface CampusToolsHost {
  places(): Building[];
  destination(): Building | undefined;
  floorName(level: number): string;
  select(place: Building): void;
  routeTo(place: Building): Promise<void>;
  signedIn(): boolean;
  admin(): boolean;
  openLogin(): void;
  sessionExpired(): void;
  // Assistant hooks: where the person is, the active route and the route preferences it may change.
  here(): Building | null;
  locatable(): Building[];
  route(): AssistantRoute | null;
  avoidStairs(): boolean;
  setAvoidStairs(value: boolean): void;
  setMode(mode: "comfortable" | "shortest"): void;
  locate(place: Building): Promise<void>;
  showAlternatives(): void;
}
interface ChatEntry { role: "user" | "assistant"; text: string; places?: AssistantPlace[]; suggestions?: string[] }
type Tab = "assistant" | "history" | "tours" | "queues" | "admin";

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> & { dataset?: Record<string, string> } = {}, ...children: (Node | string)[]): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag); const { dataset, ...rest } = props;
  Object.assign(node, rest); if (dataset) Object.assign(node.dataset, dataset); node.append(...children); return node;
}
function message(error: unknown): string {
  if (error instanceof ApiError && error.status === 401) return "Ingresa para utilizar esta función.";
  return error instanceof Error ? error.message : String(error);
}

export class CampusTools {
  private tab: Tab = "assistant";
  private renderRevision = 0;
  private sessionRevision = 0;
  private readonly body: HTMLElement;
  private readonly tabs = new Map<Tab, HTMLButtonElement>();
  private navigation: NavigationState = { current: null, can_go_back: false, can_go_forward: false };
  private draft: Building[] = [];
  private draftName = "";
  private creatingTour = false;
  private readonly root: HTMLElement;
  private readonly back: HTMLButtonElement;
  private readonly forward: HTMLButtonElement;
  private readonly host: CampusToolsHost;
  private readonly assistant = new CampusAssistant();
  private chat: ChatEntry[] = [];

  constructor(root: HTMLElement, back: HTMLButtonElement, forward: HTMLButtonElement, host: CampusToolsHost) {
    this.root = root; this.back = back; this.forward = forward; this.host = host;
    const bar = root.querySelector<HTMLElement>(".tool-tabs")!; this.body = root.querySelector<HTMLElement>(".tool-body")!;
    const tabIcons: Record<Tab, IconName> = { assistant: "sparkle", history: "clock", tours: "flag", queues: "users", admin: "shield" };
    for (const [tab, label] of [["assistant", "Asistente"], ["history", "Historial"], ["tours", "Recorridos"], ["queues", "Colas"], ["admin", "Admin"]] as [Tab, string][]) {
      const button = el("button", { type: "button", className: "tool-tab", id: `tool-${tab}` }, icon(tabIcons[tab]), label);
      button.setAttribute("role", "tab"); button.addEventListener("click", () => void this.show(tab)); bar.append(button); this.tabs.set(tab, button);
    }
    back.addEventListener("click", () => void this.step("back"));
    forward.addEventListener("click", () => void this.step("forward"));
    bar.addEventListener('keydown', event => {
      if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
      const visible = [...this.tabs.entries()].filter(([,button]) => !button.hidden);
      const current = visible.findIndex(([,button]) => button === document.activeElement);
      if (current < 0) return;
      event.preventDefault();
      const index = event.key === 'Home' ? 0 : event.key === 'End' ? visible.length - 1 :
        (current + (event.key === 'ArrowRight' ? 1 : -1) + visible.length) % visible.length;
      const [tab,button] = visible[index]; void this.show(tab); button.focus();
    });
    this.tabs.get('admin')!.hidden = !this.host.admin();
    void this.show("assistant");
  }

  // Invalidate pending private responses immediately when the account changes.
  async refresh(): Promise<void> {
    const session = ++this.sessionRevision;
    this.draft = [];
    this.draftName = "";
    this.creatingTour = false;
    this.chat = [];
    this.navigation = { current: null, can_go_back: false, can_go_forward: false };
    this.syncNavigation();
    this.tabs.get("admin")!.hidden = !this.host.admin();
    if (this.tab === "admin" && !this.host.admin()) this.tab = "assistant";
    await Promise.all([this.show(this.tab), this.loadNavigation(session)]);
  }
  // Called when the avatar arrives at a destination: records the visit for back/forward.
  async arrived(place: Building): Promise<void> {
    if (!this.host.signedIn()) return;
    const session = this.sessionRevision;
    try {
      const navigation = await api.visit(place.id);
      if (session !== this.sessionRevision) return;
      this.navigation = navigation;
    } catch { /* the route itself already succeeded */ }
    if (session !== this.sessionRevision) return;
    this.syncNavigation();
    if (this.tab === "history") await this.show("history");
  }
  private async loadNavigation(session: number): Promise<void> {
    if (!this.host.signedIn()) return;
    let navigation: NavigationState = { current: null, can_go_back: false, can_go_forward: false };
    try { navigation = await api.trail(); } catch { /* retain the empty trail */ }
    if (session !== this.sessionRevision) return;
    this.navigation = navigation;
    this.syncNavigation();
  }
  private syncNavigation(): void {
    this.back.disabled = !this.navigation.can_go_back; this.forward.disabled = !this.navigation.can_go_forward;
    this.back.title = this.navigation.can_go_back ? "Lugar anterior" : "No hay un lugar anterior";
    this.forward.title = this.navigation.can_go_forward ? "Lugar siguiente" : "No hay un lugar siguiente";
  }
  private async step(direction: "back" | "forward"): Promise<void> {
    const session = this.sessionRevision;
    try {
      const navigation = await (direction === "back" ? api.back() : api.forward());
      if (session !== this.sessionRevision) return;
      this.navigation = navigation;
      const place = navigation.current && this.host.places().find((p) => p.id === navigation.current!.building_id);
      if (place) this.host.select(place);
    } catch (error) { if (session === this.sessionRevision) this.notice(message(error)); }
    if (session === this.sessionRevision) this.syncNavigation();
  }

  private isCurrent(revision: number): boolean { return revision === this.renderRevision; }
  destinationChanged(): void {
    if (this.tab === "queues" || this.tab === "admin") void this.show(this.tab);
  }
  // An authorized action may finish after a tab change; its old view must stay closed.
  private async action(revision: number, request: () => Promise<void>, tab?: Tab): Promise<void> {
    try {
      await request();
      if (this.isCurrent(revision) && tab) await this.show(tab);
    } catch (error) { this.handleError(error, revision); }
  }

  private handleError(error: unknown, revision: number): void {
    if (!this.isCurrent(revision)) return;
    if (error instanceof ApiError && error.status === 401) {
      this.host.sessionExpired(); return;
    }
    this.notice(message(error), "error", revision);
    const retry = el("button", { type: "button", className: "button button-outline", textContent: "Volver a intentar", id: "tool-retry" });
    retry.addEventListener("click", () => void this.show(this.tab));
    if (error instanceof ApiError && error.status === 429 && error.retryAfterSeconds) {
      retry.disabled = true; retry.textContent = `Espera ${error.retryAfterSeconds} s`;
      window.setTimeout(() => { if (this.isCurrent(revision)) { retry.disabled = false; retry.textContent = 'Volver a intentar'; } }, error.retryAfterSeconds * 1000);
    }
    this.body.querySelector("#tool-retry")?.remove(); this.body.append(retry);
  }

  private notice(text: string, kind: "info" | "error" = "error", revision = this.renderRevision): void {
    if (!this.isCurrent(revision)) return;
    const note = el("p", { className: kind === "error" ? "error tool-note" : "field-hint tool-note", textContent: text });
    note.setAttribute("role", kind === "error" ? "alert" : "status");
    this.body.querySelector(".tool-note")?.remove(); this.body.prepend(note);
  }
  private placeButton(place: Building, detail: string): HTMLElement {
    const go = el("button", { type: "button", className: "text-button" }, ...labelled("Ir", "arrow-up-right"));
    go.addEventListener("click", () => void this.host.routeTo(place));
    const pick = el("button", { type: "button", className: "tool-link", textContent: place.display_name ?? place.name });
    pick.addEventListener("click", () => this.host.select(place));
    return el("li", { className: "tool-item" }, el("span", { className: "tool-place-icon" }, icon(placeIcon(place))), el("span", {}, pick, el("small", { textContent: detail })), go);
  }
  private requireSession(): boolean {
    if (this.host.signedIn()) return true;
    const button = el("button", { type: "button", className: "button button-outline", textContent: "Ingresar para continuar" });
    button.addEventListener("click", () => this.host.openLogin());
    this.body.replaceChildren(el("p", { className: "field-hint", textContent: "Esta función necesita tu cuenta." }), button);
    return false;
  }

  async show(tab: Tab): Promise<void> {
    const revision = ++this.renderRevision;
    this.tab = tab;
    this.body.replaceChildren(el("p", { className: "field-hint", textContent: "Cargando…" }));
    for (const [name, button] of this.tabs) { button.classList.toggle("active", name === tab); button.setAttribute("aria-selected", String(name === tab)); button.tabIndex = name === tab ? 0 : -1; }
    this.root.dataset.tab = tab;
    try {
      if (tab === "assistant") this.renderAssistant();
      else if (tab === "history") await this.renderHistory(revision);
      else if (tab === "tours") await this.renderTours(revision);
      else if (tab === "queues") await this.renderQueues(revision);
      else await this.renderAdmin(revision);
    } catch (error) { if (this.isCurrent(revision)) { this.body.replaceChildren(); this.handleError(error, revision); } }
  }

  // Free, local conversational assistant (assistant.ts): it answers with verified places only, and its
  // actions (route, locate, preferences) are carried out here with the ids it returns.
  private renderAssistant(): void {
    const input = el("input", { type: "search", placeholder: "Pregúntame: baño más cercano, tengo hambre, aula 512…", id: "assistant-question" });
    input.setAttribute("aria-label", "Escribe tu pregunta para el asistente del campus");
    input.autocomplete = "off";
    const ask = el("button", { type: "button", className: "button button-dark", id: "assistant-ask", title: "Enviar" }, ...labelled("Enviar", "send"));
    const log = el("div", { className: "chat-log", id: "assistant-log" });
    log.setAttribute("aria-live", "polite");
    const draw = () => {
      log.replaceChildren(...this.chat.map((entry, index) => {
        const bubble = el("div", { className: `chat-bubble ${entry.role}` },
          entry.role === "assistant" ? el("p", {}, icon("sparkle", "chat-mark"), ` ${entry.text}`) : el("p", { textContent: entry.text }));
        const latest = index === this.chat.length - 1;
        if (entry.places?.length) bubble.append(el("ol", { className: "tool-list", ...(latest ? { id: "assistant-answers" } : {}) },
          ...entry.places.map((item) => this.placeButton(item.place, item.detail))));
        if (latest && entry.suggestions?.length) bubble.append(el("div", { className: "chat-suggestions" }, ...entry.suggestions.map((text) => {
          const chip = el("button", { type: "button", className: "route-chip", textContent: text });
          chip.addEventListener("click", () => { input.value = text; void send(); });
          return chip;
        })));
        return bubble;
      }));
      if (!this.chat.length || this.chat.at(-1)!.role !== "assistant" || !this.chat.at(-1)!.places?.length)
        log.append(el("ol", { className: "tool-list", id: "assistant-answers", hidden: true }));
      log.scrollTop = log.scrollHeight;
    };
    const context = () => ({
      places: this.host.places(), locatable: this.host.locatable(), here: this.host.here(), destination: this.host.destination() ?? null,
      route: this.host.route(), avoidStairs: this.host.avoidStairs(), floorName: (level: number) => this.host.floorName(level),
    });
    const send = async () => {
      const question = input.value.trim();
      if (!question) return;
      input.value = "";
      const reply = this.assistant.reply(question, context());
      this.chat.push({ role: "user", text: question }, { role: "assistant", text: reply.text, places: reply.places, suggestions: reply.suggestions });
      this.chat = this.chat.slice(-24);
      this.root.dataset.answers = String(reply.places.length);
      draw();
      for (const action of reply.actions) {
        try { await this.perform(action); }
        catch (error) { this.chat.push({ role: "assistant", text: message(error) }); draw(); break; }
      }
    };
    ask.addEventListener("click", () => void send());
    input.addEventListener("keydown", (event) => { if (event.key === "Enter" && !event.isComposing) void send(); });
    if (!this.chat.length) this.chat.push({ role: "assistant", text: "¡Hola! Pregúntame por un lugar, una necesidad («tengo sed», «necesito un baño») o pídeme que te lleve. También entiendo «sin escaleras», «¿cuánto falta?» y «estoy en…».",
      suggestions: this.assistant.examples("es") });
    draw();
    this.body.replaceChildren(log, el("div", { className: "tool-row" }, input, ask),
      el("small", { className: "field-hint", textContent: "Asistente gratuito: funciona en tu navegador y solo usa lugares verificados del campus." }));
  }

  private async perform(action: AssistantAction): Promise<void> {
    if (action.kind === "avoid-stairs") this.host.setAvoidStairs(action.value);
    else if (action.kind === "mode") this.host.setMode(action.mode);
    else if (action.kind === "locate") await this.host.locate(action.place);
    else if (action.kind === "alternatives") this.host.showAlternatives();
    else if (action.kind === "route") await this.host.routeTo(action.place);
  }

  private async renderHistory(revision: number): Promise<void> {
    if (!this.requireSession()) return;
    const [stats, visits] = await Promise.all([api.stats(), api.history(8)]);
    if (!this.isCurrent(revision)) return;
    const tiles = el("div", { className: "tool-stats", id: "history-stats" },
      ...[["Rutas", String(stats.total_routes)], ["Distancia", `${stats.total_distance.toFixed(0)} m`], ["Promedio", `${stats.average_distance.toFixed(0)} m`]]
        .map(([k, v]) => el("div", {}, el("strong", { textContent: v }), el("small", { textContent: k }))));
    const list = el("ol", { className: "tool-list", id: "history-list" }, ...visits.map((v) => {
      const place = this.host.places().find((p) => p.name === v.destination_name || p.display_name === v.destination_name);
      const detail = `${new Date(v.visited_at).toLocaleString()} · ${v.distance.toFixed(0)} m desde ${v.origin_name}`;
      return place ? this.placeButton(place, detail) : el("li", { className: "tool-item" }, el("span", {}, el("strong", { textContent: v.destination_name }), el("small", { textContent: detail })));
    }));
    if (!visits.length) list.append(el("li", { className: "field-hint", textContent: "Tus rutas aparecerán aquí cuando calcules la primera." }));
    const clear = el("button", { type: "button", className: "text-button", textContent: "Borrar historial", disabled: !visits.length });
    clear.addEventListener("click", () => void this.action(revision, () => api.clearHistory(), "history"));
    this.body.replaceChildren(tiles, stats.most_visited_destination ? el("p", { className: "field-hint", textContent: `Más visitado: ${stats.most_visited_destination}` }) : "", list, clear);
  }

  private async renderTours(revision: number): Promise<void> {
    const tours = await api.tours();
    if (!this.isCurrent(revision)) return;
    let session: TourSession | null = null;
    if (this.host.signedIn()) { try { session = await api.tourSession(); } catch (error) { if (!(error instanceof ApiError && error.status === 404)) throw error; } }
    if (!this.isCurrent(revision)) return;
    const parts: (Node | string)[] = [];
    if (session) {
      const stop = this.host.places().find((p) => p.id === session!.current_stop.building_id);
      const prev = el("button", { type: "button", className: "button button-outline", disabled: session.current_stop.position <= 1 }, ...labelled("Anterior", "arrow-left", true));
      const next = el("button", { type: "button", className: "button button-outline", disabled: session.current_stop.position >= session.total_stops }, ...labelled("Siguiente", "arrow-right"));
      const go = el("button", { type: "button", className: "button button-dark", disabled: !stop, id: "tour-go" }, ...labelled("Ir a esta parada", "arrow-right"));
      const end = el("button", { type: "button", className: "text-button", textContent: "Finalizar recorrido" });
      prev.addEventListener("click", () => void this.action(revision, async () => { await api.previousStop(); }, "tours"));
      next.addEventListener("click", () => void this.action(revision, async () => { await api.nextStop(); }, "tours"));
      go.addEventListener("click", () => { if (stop) void this.host.routeTo(stop); });
      end.addEventListener("click", () => void this.action(revision, () => api.endTour(), "tours"));
      parts.push(el("div", { className: "tool-session", id: "tour-session" }, el("span", { className: "eyebrow", textContent: `RECORRIDO · PARADA ${session.current_stop.position} DE ${session.total_stops}` }),
        el("strong", { textContent: session.current_stop.building_name }), el("small", { className: "field-hint", textContent: `${session.tour_name} · ${this.host.floorName(session.current_stop.floor)}` }),
        el("div", { className: "tool-row" }, prev, next), go, end));
    }
    const list = el("ol", { className: "tool-list", id: "tour-list" }, ...tours.map((t) => {
      const start = el("button", { type: "button", className: "text-button" }, ...labelled("Comenzar", "arrow-up-right"));
      start.addEventListener("click", async () => {
        if (!this.host.signedIn()) { this.host.openLogin(); return; }
        await this.action(revision, async () => { await api.startTour(t.id); }, "tours");
      });
      return el("li", { className: "tool-item" }, el("span", {}, el("strong", { textContent: t.name }), el("small", { textContent: `${t.stop_count} paradas${t.description ? ` · ${t.description}` : ""}` })), start);
    }));
    if (!tours.length) list.append(el("li", { className: "field-hint", textContent: "Todavía no hay recorridos. Un administrador puede crear uno." }));
    this.body.replaceChildren(...parts, list);
  }

  private async renderQueues(revision: number): Promise<void> {
    const target = this.host.destination();
    const [ranking, popular] = await Promise.all([api.rankings(8), api.popularRoutes()]);
    if (!this.isCurrent(revision)) return;
    const parts: (Node | string)[] = [];
    if (target) {
      const status = await api.queue(target.id);
      if (!this.isCurrent(revision)) return;
      let position: number | null = null;
      if (this.host.signedIn()) { try { position = (await api.queuePosition(target.id)).position; } catch (error) { if (!(error instanceof ApiError && error.status === 404)) throw error; } }
      if (!this.isCurrent(revision)) return;
      const join = el("button", { type: "button", className: "button button-dark", textContent: position ? "Salir de la cola" : "Unirme a la cola", id: "queue-toggle" });
      join.addEventListener("click", async () => {
        if (!this.host.signedIn()) { this.host.openLogin(); return; }
        if (join.disabled) return;
        join.disabled = true;
        await this.action(revision, async () => { if (position) await api.leaveQueue(target.id); else await api.joinQueue(target.id); }, "queues");
      });
      parts.push(el("div", { className: "tool-session", id: "queue-status" }, el("span", { className: "eyebrow", textContent: "COLA EN TU DESTINO" }), el("strong", { textContent: target.display_name ?? target.name }),
        el("small", { className: "field-hint", textContent: `${status.length} personas esperando${position ? ` · tu posición: ${position}` : ""}` }), join));
    } else parts.push(el("p", { className: "field-hint", textContent: "Elige un destino para consultar su cola." }));
    const ranks = el("ol", { className: "tool-list", id: "ranking-list" }, ...ranking.map((r) => {
      const place = this.host.places().find((p) => p.id === r.building_id);
      const detail = `#${r.rank} · ${r.visits} ${r.visits === 1 ? "visita" : "visitas"} · ${this.host.floorName(r.floor)}`;
      return place ? this.placeButton(place, detail) : el("li", { className: "tool-item" }, el("span", {}, el("strong", { textContent: r.building_name }), el("small", { textContent: detail })));
    }));
    if (!ranking.length) ranks.append(el("li", { className: "field-hint", textContent: "Todavía no hay visitas registradas." }));
    parts.push(el("span", { className: "eyebrow tool-heading", textContent: "LUGARES MÁS VISITADOS" }), ranks);
    if (popular.length) parts.push(el("span", { className: "eyebrow tool-heading", textContent: "RUTAS FRECUENTES" }),
      el("ol", { className: "tool-list" }, ...popular.slice(0, 5).map((r) => el("li", { className: "tool-item" }, el("span", {}, el("strong", {}, r.origin_name, icon("arrow-right", "inline-arrow"), r.destination_name), el("small", { textContent: `${r.frequency} ${r.frequency === 1 ? "vez" : "veces"}` }))))));
    this.body.replaceChildren(...parts);
  }

  private async renderAdmin(revision: number): Promise<void> {
    if (!this.requireSession()) return;
    if (!this.host.admin()) { this.body.replaceChildren(el("p", { className: "field-hint", textContent: "Necesitas una cuenta de administrador." })); return; }
    const target = this.host.destination(), parts: (Node | string)[] = [el("p", { className: "field-hint", textContent: "Los cambios se guardan en el campus al pulsar Guardar." })];
    if (target) {
      const name = el("input", { value: target.display_name ?? target.name, id: "admin-display-name" }), type = el("input", { value: target.building_type ?? "", id: "admin-type" });
      name.setAttribute("aria-label", "Nombre visible"); type.setAttribute("aria-label", "Tipo de lugar");
      const save = el("button", { type: "button", className: "button button-dark", textContent: "Guardar lugar", id: "admin-save" });
      save.addEventListener("click", async () => {
        try { const updated = await api.updateBuilding(target.id, { display_name: name.value.trim() || null, building_type: type.value.trim() || null }); if (!this.isCurrent(revision)) return; Object.assign(target, updated); this.notice(`Guardado: ${updated.display_name ?? updated.name}.`, "info", revision); }
        catch (error) { this.handleError(error, revision); }
      });
      const serve = el("button", { type: "button", className: "button button-outline", textContent: "Atender siguiente" });
      serve.addEventListener("click", async () => { try { await api.serveQueue(target.id); this.notice("Se atendió a la siguiente persona.", "info", revision); } catch (error) { this.handleError(error, revision); } });
      parts.push(el("span", { className: "eyebrow tool-heading", textContent: `EDITAR · ${(target.display_name ?? target.name).toUpperCase()}` }), el("label", { className: "field-label", textContent: "NOMBRE VISIBLE" }), name,
        el("label", { className: "field-label", textContent: "TIPO" }), type, el("div", { className: "tool-row" }, save, serve));
    } else parts.push(el("p", { className: "field-hint", textContent: "Elige un destino para editarlo." }));
    // Tour builder: add the current destination as the next stop
    const tourName = el("input", { placeholder: "Nombre del recorrido", value: this.draftName, id: "admin-tour-name" }); tourName.setAttribute("aria-label", "Nombre del recorrido");
    tourName.addEventListener("input", () => { this.draftName = tourName.value; });
    tourName.disabled = this.creatingTour;
    const stops = el("ol", { className: "tool-list", id: "admin-tour-stops" }, ...this.draft.map((p) => el("li", { className: "tool-item", textContent: p.display_name ?? p.name })));
    const add = el("button", { type: "button", className: "button button-outline", textContent: "Añadir destino como parada", disabled: !target || this.creatingTour, id: "admin-add-stop" });
    add.addEventListener("click", () => { if (target && !this.draft.some((p) => p.id === target.id)) this.draft.push(target); void this.show("admin"); });
    const create = el("button", { type: "button", className: "button button-dark", textContent: "Crear recorrido", disabled: this.draft.length < 2 || this.creatingTour, id: "admin-create-tour" });
    create.addEventListener("click", async () => {
      if (create.disabled || this.creatingTour) return;
      create.disabled = true;
      this.creatingTour = true;
      add.disabled = true; tourName.disabled = true;
      const session = this.sessionRevision;
      try {
        const tour = await api.createTour(tourName.value.trim() || "Recorrido del campus", null, this.draft.map((p) => p.id));
        if (session !== this.sessionRevision) return;
        this.draft = [];
        this.draftName = "";
        this.creatingTour = false;
        if (this.tab !== "admin") return;
        await this.show("admin");
        if (session === this.sessionRevision && this.tab === "admin") this.notice(`Creado: “${tour.name}” con ${tour.stops.length} paradas.`, "info");
      }
      catch (error) { this.handleError(error, revision); }
      finally {
        if (session === this.sessionRevision) {
          this.creatingTour = false;
          if (this.isCurrent(revision)) { create.disabled = this.draft.length < 2; add.disabled = !this.host.destination(); tourName.disabled = false; }
          else if (this.tab === "admin" && this.body.querySelector<HTMLInputElement>('#admin-tour-name')?.disabled) void this.show('admin');
        }
      }
    });
    parts.push(...await this.learningSection(revision));
    if (!this.isCurrent(revision)) return;
    const reload = el("button", { type: "button", className: "text-button", textContent: "Actualizar conexiones" });
    reload.addEventListener("click", async () => { try { await api.reloadGraph(); this.notice("Conexiones actualizadas.", "info", revision); } catch (error) { this.notice(message(error), "error", revision); } });
    const tours = await api.tours();
    if (!this.isCurrent(revision)) return;
    const existing = el("ol", { className: "tool-list" }, ...tours.map((t) => {
      const remove = el("button", { type: "button", className: "text-button", textContent: "Eliminar" });
      remove.addEventListener("click", () => void this.action(revision, () => api.deleteTour(t.id), "admin"));
      return el("li", { className: "tool-item" }, el("span", {}, el("strong", { textContent: t.name }), el("small", { textContent: `${t.stop_count} paradas` })), remove);
    }));
    parts.push(el("span", { className: "eyebrow tool-heading", textContent: "NUEVO RECORRIDO GUIADO" }), tourName, stops, el("div", { className: "tool-row" }, add, create),
      el("span", { className: "eyebrow tool-heading", textContent: "RECORRIDOS" }), existing, reload);
    this.body.replaceChildren(...parts);
  }

  // What the router learned from people's answers, and the connections reported as closed.
  private async learningSection(revision: number): Promise<(Node | string)[]> {
    let learning;
    try { learning = await api.routeLearning(); } catch { return []; }
    const parts: (Node | string)[] = [el("span", { className: "eyebrow tool-heading", textContent: "APRENDIZAJE DE RUTAS" })];
    const negative = Object.entries(learning.feedback).filter(([key]) => key !== "positive").reduce((sum, [, count]) => sum + count, 0);
    parts.push(el("div", { className: "tool-stats", id: "learning-stats" },
      ...([["Rutas", String(learning.observations), "route"], ["Útiles", String(learning.feedback.positive ?? 0), "thumbs-up"], ["Por mejorar", String(negative), "thumbs-down"]] as [string, string, IconName][])
        .map(([k, v, name]) => el("div", {}, el("strong", { textContent: v }), el("small", {}, icon(name), ` ${k}`)))));
    parts.push(el("p", { className: "field-hint", textContent: `Un tramo cambia solo con ${learning.parameters.min_evidence} señales o más, entre ×${learning.parameters.min_multiplier} y ×${learning.parameters.max_multiplier}. La ruta «más corta» no cambia.` }));
    if (learning.learned_paths.length) parts.push(el("ol", { className: "tool-list", id: "learning-paths" }, ...learning.learned_paths.slice(0, 6).map((path) =>
      el("li", { className: "tool-item" }, el("span", {}, el("strong", {}, path.origin_name, icon("arrow-right", "inline-arrow"), path.destination_name),
        el("small", { textContent: `×${path.multiplier} · ${path.evidence} señales · ${path.kind}` }))))));
    const blocked = el("ol", { className: "tool-list", id: "blocked-paths" }, ...learning.blocked_paths.map((path) => {
      const confirm = el("button", { type: "button", className: "text-button", textContent: "Confirmar", disabled: path.confirmed });
      const clear = el("button", { type: "button", className: "text-button", textContent: "Liberar" });
      confirm.addEventListener("click", () => void this.action(revision, () => api.confirmBlocked(path.path_id), "admin"));
      clear.addEventListener("click", () => void this.action(revision, () => api.clearBlocked(path.path_id), "admin"));
      const state = path.active ? `cerrado hasta ${path.expires_at ? new Date(path.expires_at + "Z").toLocaleDateString() : "—"}` : "en revisión";
      return el("li", { className: "tool-item" }, el("span", {}, el("strong", {}, path.origin_name, icon("arrow-right", "inline-arrow"), path.destination_name),
        el("small", { textContent: `${path.reports} ${path.reports === 1 ? "reporte" : "reportes"} · ${state}${path.confirmed ? " · confirmado" : ""}` })), el("span", { className: "tool-row" }, confirm, clear));
    }));
    if (!learning.blocked_paths.length) blocked.append(el("li", { className: "field-hint", textContent: "Ningún paso reportado como cerrado." }));
    if (!this.isCurrent(revision)) return [];
    parts.push(el("span", { className: "eyebrow tool-heading", textContent: "PASOS REPORTADOS" }), blocked);
    return parts;
  }
}
