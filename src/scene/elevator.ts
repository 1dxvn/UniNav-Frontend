import { CanvasTexture, Group, Mesh, MeshBasicMaterial, PlaneGeometry } from "three";

export class ElevatorAssembly {
  private elapsed = 0;
  private segment = -1;
  private closing = 0;
  private activeDoor = "";
  private readonly closed = new Map<string, number>();

  private readonly screens = new Map<string, Mesh<PlaneGeometry,MeshBasicMaterial>[]>();
  private readonly digits: CanvasTexture[] = [];

  constructor(readonly root: Group) {
    for (let floor=0;floor<6;floor++) {
      const canvas=document.createElement("canvas");
      canvas.width=128; canvas.height=48;
      const ctx=canvas.getContext("2d")!;
      ctx.fillStyle="#101615";ctx.fillRect(0,0,128,48);
      ctx.font="bold 42px monospace";ctx.textAlign="center";ctx.fillStyle="#a2ffd8";
      ctx.fillText("P"+floor,64,40);
      this.digits.push(new CanvasTexture(canvas));
    }
    root.position.y = 3.5;
    for (const number of ["1","2"]) {
      const screens: Mesh<PlaneGeometry,MeshBasicMaterial>[]=[];
      for(let floor=0;floor<6;floor++) {
        const frame=root.getObjectByName(`ELEV_A${number}_P${floor}_Indicador`);
        if (!frame) continue;
        const screen=new Mesh(new PlaneGeometry(.98,.94),new MeshBasicMaterial({map:this.digits[1]}));
        screen.position.z=.51;
        frame.add(screen);screens.push(screen);
      }
      this.screens.set(number,screens);
    }
    root.traverse(node => {
      if (node.name.includes("_Hoja_")) this.closed.set(node.name, node.position.x);
    });
  }

  updateIndicators(number:string,floor:number) {
    for (const panel of this.screens.get(number) ?? []) panel.material.map=this.digits[floor];
  }

  reset() {
    for (const [name, x] of this.closed) this.root.getObjectByName(name)!.position.x = x;
    this.segment = -1;
    this.closing = 0;
    this.activeDoor = "";
  }

  showFloor(floor:number) {
    for (const obj of this.root.children) {
      const landing=obj.name.match(/^ELEV_A[12]_P([0-5])_/);
      if (landing) obj.visible=Number(landing[1])===floor;
    }
  }

  closeAfterExit(number:string,delta:number) {
    this.closing+=delta;
    this.slide("ELEV_A"+number,Math.max(0,1-this.closing/.8));
    return this.closing>=.8;
  }

  skipWait() { this.elapsed = Math.max(this.elapsed,2); }
  get waiting() { return this.elapsed < 2; }

  move(number: string, elevation: number) {
    const car = this.root.getObjectByName("ELEV_A"+number+"_Cabina");
    if (car) car.position.y = elevation - this.root.position.y;
  }

  beforeStep(index: number, delta: number, number: string, floor: number, boarding: boolean, leaving: boolean) {
    if (this.segment !== index) {
      this.segment = index;
      this.elapsed = 0;
    }
    this.elapsed += delta;
    const prefix = "ELEV_A"+number;
    if (boarding || leaving) this.activeDoor = prefix+"_P"+floor;
    if (!this.activeDoor) return true;
    const opening = boarding || leaving;
    const wait = boarding ? 2 : 0;
    const t = Math.min(1, Math.max(0, (this.elapsed-wait)/.8));
    if (!this.closing) this.slide(prefix,opening ? t : 1-t);
    if (!opening && t===1) this.activeDoor = "";
    return t===1;
  }

  private slide(prefix:string,fraction:number) {
    for (const side of ["I","D"]) {
      for (const parent of [this.activeDoor, prefix+"_Cabina"]) {
        const name = parent+"_Hoja_"+side;
        const door = this.root.getObjectByName(name);
        if (door) door.position.x = this.closed.get(name)! + (side==="D" ? .45 : -.45)*fraction;
      }
    }
  }
}
