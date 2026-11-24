import type { Building } from './api/types.ts';
import { locationQuery, normalize, searchPlaces } from './search.ts';
import { icon as svgIcon, placeIcon } from './icons.ts';

const get = <T extends HTMLElement>(id:string) => document.getElementById(id) as T;
const name = (place:Building) => place.display_name ?? place.name;

export class LocationPicker {
  private readonly trigger=get<HTMLButtonElement>('choose-location');
  private readonly dialog=get<HTMLDialogElement>('location-dialog');
  private readonly search=get<HTMLInputElement>('location-search');
  private readonly floor=get<HTMLSelectElement>('location-floor');
  private readonly results=get<HTMLElement>('location-results');
  private readonly error=get<HTMLElement>('location-error');
  private readonly abort=new AbortController();
  private places:Building[]=[];
  private current:Building|null=null;
  private busy=false;

  constructor(private readonly onChoose:(place:Building)=>Promise<void>) {
    const options={signal:this.abort.signal};
    this.trigger.addEventListener('click',()=>{
      this.search.value='';this.floor.value='all';this.error.hidden=true;this.render();
      this.dialog.showModal();this.search.focus();
    },options);
    get('close-location').addEventListener('click',()=>this.dialog.close(),options);
    this.dialog.addEventListener('keydown',event=>{
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();this.dialog.close();}
    },options);
    this.search.addEventListener('input',()=>this.render(),options);
    this.floor.addEventListener('change',()=>this.render(),options);
    this.search.addEventListener('keydown',event=>{
      if(event.isComposing)return;
      const first=this.results.querySelector<HTMLButtonElement>('button:not(:disabled)');
      if(event.key==='ArrowDown' && first){event.preventDefault();first.focus();}
      if(event.key==='Enter' && first && this.search.value.trim()){event.preventDefault();first.click();}
    },options);
    this.results.addEventListener('keydown',event=>{
      const buttons=[...this.results.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
      const i=buttons.indexOf(document.activeElement as HTMLButtonElement);
      if(i<0)return;
      if(event.key==='ArrowDown'){event.preventDefault();buttons[Math.min(i+1,buttons.length-1)]?.focus();}
      if(event.key==='ArrowUp'){event.preventDefault();if(i===0)this.search.focus();else buttons[i-1]?.focus();}
    },options);
  }

  setPlaces(places:Building[]):void {
    this.places=[...places].sort((a,b)=>name(a).localeCompare(name(b),'es') || a.floor-b.floor);
    this.trigger.disabled=!this.places.length;
    this.floor.replaceChildren(new Option('Todos los pisos','all'),...[...new Set(places.map(p=>p.floor))].sort((a,b)=>a-b).map(f=>new Option(`Piso ${f}`,String(f))));
    if(this.dialog.open)this.render();
  }

  // Places where the avatar can be placed (connected and navigable), for the assistant's «estoy en…».
  getPlaces():Building[] { return this.places; }

  setCurrent(place:Building):void {
    this.current=place;
    const label=`${name(place)} · Piso ${place.floor}`;
    const status=get('location-current');status.textContent=label;status.hidden=false;
    this.trigger.title=`Tu ubicación: ${label}`;
  }

  // Same search as the search bar and the assistant: typos, plurals, English, categories («un baño»),
  // «estoy en…» phrasing and places the map lacks; plain text matches are kept after the ranked ones.
  private matches():{places:Building[];details:Map<number,string>;note:string;suggestion:string|null} {
    const inFloor=(p:Building)=>this.floor.value==='all' || p.floor===Number(this.floor.value);
    const raw=this.search.value.trim(),details=new Map<number,string>();
    if(!raw)return {places:this.places.filter(inFloor),details,note:'',suggestion:null};
    const query=locationQuery(raw);
    const answer=searchPlaces(query,this.places,{limit:this.places.length,origin:this.current});
    const ranked=answer.matches.filter(m=>inFloor(m.place));
    for(const m of ranked)if(m.via!=='name')details.set(m.place.id,m.reason);
    const tokens=normalize(query).split(' ').filter(Boolean);
    const literal=this.places.filter(p=>inFloor(p) && !ranked.some(m=>m.place.id===p.id) &&
      tokens.every(t=>normalize(`${name(p)} ${p.name} ${p.block_code ?? ''} Piso ${p.floor}`).includes(t)));
    const places=[...ranked.map(m=>m.place),...literal];
    if(!places.length && answer.missing){
      const ask=answer.missing.ask.filter(inFloor);
      return {places:ask,details,note:`${answer.missing.message}${ask.length ? ' Elige un lugar que veas cerca:':''}`,suggestion:null};
    }
    return {places,details,note:'',suggestion:places.length ? null:answer.suggestion};
  }

  private render():void {
    const {places,details,note,suggestion}=this.matches();
    get('location-count').textContent=`${places.length} ${places.length===1 ? 'lugar':'lugares'}`;
    this.results.replaceChildren();
    if(note){const hint=document.createElement('p');hint.className='field-hint location-note';hint.textContent=note;this.results.append(hint);}
    for(const place of places) {
      const button=document.createElement('button');button.type='button';button.className='place-option';button.disabled=this.busy;
      button.dataset.placeCode=place.code ?? String(place.id);button.setAttribute('aria-pressed',String(this.current?.id===place.id));
      const icon=document.createElement('span');icon.className='place-icon';icon.replaceChildren(svgIcon(placeIcon(place)));icon.setAttribute('aria-hidden','true');
      const text=document.createElement('span'),title=document.createElement('strong'),meta=document.createElement('small');
      const detail=details.get(place.id);
      title.textContent=name(place);meta.textContent=`Piso ${place.floor}${place.block_code ? ` · Bloque ${place.block_code}`:''}${detail ? ` · ${detail}`:''}`;
      text.append(title,meta);button.append(icon,text);
      button.addEventListener('click',()=>void this.choose(place));this.results.append(button);
    }
    if(!places.length){
      const empty=document.createElement('p');empty.className='empty-state';
      if(suggestion){
        const retry=document.createElement('button');retry.type='button';retry.className='text-button';retry.textContent=`Buscar «${suggestion}»`;
        retry.addEventListener('click',()=>{this.search.value=suggestion;this.render();this.search.focus();});
        empty.append('No encontramos ese lugar. ¿Quisiste decir ',retry,'?');
      } else empty.textContent='No encontramos ese lugar. Escribe lo que ves cerca: un aula, un baño, la cafetería o un hall.';
      this.results.append(empty);
    }
  }

  private async choose(place:Building):Promise<void> {
    if(this.busy)return;
    this.busy=true;this.error.hidden=true;this.dialog.setAttribute('aria-busy','true');
    for(const button of this.results.querySelectorAll<HTMLButtonElement>('button'))button.disabled=true;
    try {
      await this.onChoose(place);this.setCurrent(place);this.dialog.close();
      requestAnimationFrame(()=>document.querySelector<HTMLCanvasElement>('#scene canvas')?.focus({preventScroll:true}));
    } catch(error) {
      this.error.textContent=error instanceof Error ? error.message:'No pudimos ubicarte. Inténtalo de nuevo.';this.error.hidden=false;
    } finally {this.busy=false;this.dialog.removeAttribute('aria-busy');this.render();}
  }

  dispose():void {this.abort.abort();}
}
