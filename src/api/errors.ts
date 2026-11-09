export function retrySeconds(value: string | null, now = Date.now()): number | null {
  if (!value?.trim()) return null;
  const seconds = /^\d+$/.test(value.trim()) ? Number(value) : (Date.parse(value) - now) / 1000;
  return Number.isFinite(seconds) ? Math.max(0, Math.ceil(seconds)) : null;
}

export function requestErrorMessage(status: number, path: string, fallback: string, retryAfter: number | null = null): string {
  if (status === 0) return 'No podemos conectar con UniNav. Comprueba tu conexión y vuelve a intentar.';
  if (status === 401) return path === '/auth/login' ? 'El usuario o la contraseña no son correctos.' : 'Tu sesión ha vencido. Ingresa de nuevo para continuar.';
  if (status === 403) return 'Tu cuenta no tiene permiso para realizar esta acción.';
  if (status === 429) return `Hay demasiadas solicitudes. ${retryAfter === null ? 'Espera un momento y vuelve a intentar.' : `Vuelve a intentar en ${retryAfter} segundos.`}`;
  if (status >= 500) return 'El servicio del campus no está disponible en este momento. Vuelve a intentar más tarde.';
  if (status === 404 && path === '/routes/calculate') return 'No hay una ruta verificada entre estos lugares con las opciones elegidas.';
  if (status === 409 && path === '/auth/register') return 'Ese nombre de usuario ya está registrado. Elige otro o inicia sesión.';
  if (status === 409 && path.startsWith('/queues/')) return 'Ya formas parte de esta cola. Vuelve a consultar tu posición.';
  if (status === 404 && /^\/queues\/\d+\/serve$/.test(path)) return 'No hay personas esperando en esta cola.';
  if (status === 409 && path.startsWith('/navigation/')) return 'No hay otro lugar en esa dirección.';
  if (status === 409 && path === '/tours') return 'Ya existe un recorrido con ese nombre. Elige otro nombre.';
  if (status === 400 && path === '/tours') return 'Las paradas del recorrido deben ser lugares diferentes.';
  if (status === 422) return 'Revisa los datos del formulario antes de continuar.';
  return fallback;
}
