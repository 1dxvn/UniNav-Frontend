# UniNav Frontend

Interfaz de UniNav en TypeScript y Three.js. Permite explorar el campus en 3D, buscar lugares, seleccionar
pisos, consultar rutas y utilizar las funciones de usuario y administración del servidor FastAPI.
Incluye los modelos C20 finales y las fuentes locales; no utiliza un CDN ni requiere herramientas de modelado.

## Clonar ambos repositorios y ejecutar la aplicación completa

Necesitas este frontend y el [backend UniNav](https://github.com/1dxvn/UniNav). Son repositorios independientes,
pero el frontend debe estar **dentro de la carpeta del backend**, con el nombre `UniNav-Frontend`.
No necesitas iniciar dos servidores para utilizar la aplicación completa.

### 1. Preparar el equipo

Instala Git, Python 3.11 o posterior y Node.js 22.12 o posterior con npm. Necesitas Internet durante la primera
instalación y un navegador con WebGL 2. En Windows, vuelve a abrir PowerShell después de instalar los programas.

Comprueba las versiones en Windows:

```powershell
git --version
py -3 --version
node --version
npm --version
```

En Linux/macOS, sustituye `py -3 --version` por `python3 --version`.

### 2. Descargar el backend y entrar en su carpeta

Abre una terminal en la carpeta donde guardarás el proyecto, por ejemplo Documentos. Allí no debe existir
otra carpeta llamada `UniNav`. Ejecuta:

```bash
git clone --depth 1 https://github.com/1dxvn/UniNav.git UniNav
cd UniNav
```

Ahora la terminal está dentro del backend. `--depth 1` descarga la versión actual sin el historial anterior;
no necesitas el historial para compilar ni ejecutar la aplicación.

### 3. Descargar el frontend dentro del backend

Desde esa misma terminal, situada en `UniNav`, ejecuta:

```bash
git clone --depth 1 https://github.com/1dxvn/UniNav-Frontend.git UniNav-Frontend
```

La ubicación correcta es `UniNav/UniNav-Frontend/`, no dos carpetas hermanas. Debes tener estos archivos:

```text
UniNav/                        # terminal situada aquí para iniciar la app
  start.py
  main.py
  requirements.txt
  UniNav-Frontend/
    README.md
    package.json
    package-lock.json
    src/
    public/models/
```

En PowerShell puedes comprobarlo con `Test-Path .\start.py` y
`Test-Path .\UniNav-Frontend\package.json`: ambos deben devolver `True`.
En Linux/macOS, ejecuta `ls start.py UniNav-Frontend/package.json`.

### 4. Instalar e iniciar desde el backend

**Mantente en `UniNav`, donde está `start.py`**. No entres en `UniNav-Frontend` para ejecutar este paso.

```powershell
# Windows
py -3 start.py
```

```bash
# Linux / macOS
python3 start.py
```

El instalador utiliza el frontend que acabas de clonar, crea el entorno de Python, instala las dependencias,
verifica los modelos y ejecuta el build de npm. Después crea la base de datos e inicia el servidor.
No necesitas ejecutar `npm ci` ni `npm run build` manualmente si utilizas este arranque; el instalador
lo hace por ti. Espera a que la terminal indique que el servidor inició.

Abre **http://127.0.0.1:8001/app/**. Acceso de demostración: `student` / `demo1234`;
administración: `admin` / `demo1234`. Mantén la terminal abierta y detén el servidor con `Ctrl+C`.
Para volver a iniciar, entra en `UniNav` y repite el comando de arranque; no vuelvas a clonar los repositorios.

Si omites el paso 3, `start.py` puede descargar este frontend automáticamente en la ubicación correcta.
Si la carpeta ya existe, utiliza ese clon y no crea otra copia. Las opciones de configuración y la solución
de errores de clonación están en el [README del backend](https://github.com/1dxvn/UniNav#readme).

## Compilar este repositorio

Para compilar manualmente, sitúate en la carpeta `UniNav-Frontend`. Si la terminal está en el backend,
entra con `cd UniNav-Frontend`. Con Node.js 22.12 o posterior, ejecuta:

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

Deja el backend ejecutándose en el puerto 8001. Abre otra terminal dentro de `UniNav-Frontend` y ejecuta:

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
