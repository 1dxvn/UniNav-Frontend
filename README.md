# UniNav Frontend

Web client for [UniNav](https://github.com/1dxvn/UniNav): a Three.js campus scene written in
TypeScript that signs in against the FastAPI backend and draws the routes it calculates.

## Run

The backend serves this app under `/app/`, so the normal setup is to clone this repository
inside the backend folder and build it:

```bash
npm install
npm run build          # type-checks and writes dist/
cd .. && python main.py   # open http://localhost:8000/
```

For live reload while editing, keep FastAPI running on port 8000 and start Vite:

```bash
npm run dev            # http://localhost:5173/app/
```

Vite forwards API calls to `http://127.0.0.1:8000` (change it with `UNINAV_BACKEND_URL`).

## API base URL

The client calls the API on the same origin it was loaded from. Set `VITE_API_BASE_URL` at
build time only if the API is hosted elsewhere.

## Coordinates

Plan coordinates from the API `(x, y)` are metres and map to the Three.js XZ plane as
`(x, -y)`. Height is Y, with 3.5 m per floor, the backend convention.

## Layout

```
src/api/      typed client and response types for the FastAPI endpoints
src/scene/    Three.js scene: places, paths, route line and avatar
src/main.ts   panel: sign in, choose origin and destination, show the route
```
