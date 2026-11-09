const types:Record<string,string> = {
  classroom:'Aula',laboratory:'Laboratorio',service:'Servicio',office:'Oficina',hall:'Vestíbulo',
  entrance:'Acceso',clinic:'Clínica',restroom:'Baño',elevator:'Ascensor',stairs:'Escalera',
  cafeteria:'Cafetería',library:'Biblioteca',auditorium:'Auditorio',faculty:'Facultad',
};
export function placeTypeLabel(type:string|null|undefined):string {
  return type ? types[type] ?? type.replaceAll('_',' ') : 'Lugar';
}
