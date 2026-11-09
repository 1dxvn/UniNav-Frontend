# UniNav Frontend

Interfaz de UniNav en TypeScript y Three.js. Permite explorar el campus en 3D, buscar lugares, seleccionar
pisos, consultar rutas y utilizar las funciones de usuario y administración del servidor FastAPI.
Incluye los modelos C20 finales y las fuentes locales; no utiliza un CDN ni requiere herramientas de modelado.

## Ejecutar la aplicación completa

La forma recomendada es utilizar el instalador del [servidor UniNav](https://github.com/1dxvn/UniNav).
Este descarga el frontend, instala las dependencias y compila los modelos automáticamente:

```bash
git clone --depth 1 https://github.com/1dxvn/UniNav.git
cd UniNav
```

```powershell
# Windows: Python 3.11+, Node.js 22.12+ y Git instalados
py -3 start.py
```

```bash
# Linux / macOS
python3 start.py
```

Abre **http://127.0.0.1:8001/app/**. Acceso de demostración: `student` / `demo1234`;
administración: `admin` / `demo1234`. El servidor crea su base de datos en el primer arranque.

## Compilar este repositorio

Con Node.js 22.12 o posterior:

```bash
npm ci
npm run build
```

El resultado queda en `dist/`. El build comprueba los SHA-256 de todos los modelos y referencias locales.
Funciona desde un clon superficial o una descarga ZIP; no recupera archivos del historial Git.
El servidor espera esta estructura, que el instalador crea automáticamente:

```text
UniNav/
  start.py
  main.py
  UniNav-Frontend/
    package.json
    public/models/
    src/
    dist/             # generado por npm run build
```

## Desarrollo

Inicia el backend en el puerto 8001 y ejecuta:

```bash
npm run dev
```

Abre http://localhost:5173/app/. Para usar otro backend:

```powershell
$env:UNINAV_BACKEND_URL = 'http://127.0.0.1:8002'
npm run dev
```

```bash
UNINAV_BACKEND_URL=http://127.0.0.1:8002 npm run dev
```

`npm run typecheck` comprueba TypeScript. `npm run preview` sirve únicamente la interfaz compilada;
para utilizar autenticación, datos y rutas necesitas el backend.

## Modelos incluidos

Vista Campus, pisos 0–5 y terraza como piso 6. La terraza solo tiene vista previa.
Algunos recorridos pueden bloquearse al encontrarse con muros o diferencias de apoyo de los modelos C20.
Las comprobaciones de hashes, referencias y colisiones permanecen activas.
