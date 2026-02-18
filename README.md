# Office Library Frontend (User App)

## Architecture
- Feature-Sliced Design structure: `app`, `pages`, `widgets`, `features`, `entities`, `shared`.
- Pages compose widgets, widgets compose features, features depend on entities.
- Entities contain only models and API contracts.
- Shared contains pure utilities, API client, config, and UI primitives.

## Routing
- `/login`
- `/catalog`
- `/books/:id`
- `/profile`

## Data Flow
- `shared/api/apiClient.ts` configures Axios with env-based base URL and JWT interceptors.
- React Query is configured in `shared/api/queryClient.ts` and provided in `app/providers/QueryProvider.tsx`.

## Auth
- Token storage helpers in `shared/lib/auth/token.ts`.
- `features/auth/model/AuthGuard.tsx` protects user routes.
- Auth API contracts in `features/auth/api/authApi.ts`.

## Env
- `VITE_API_BASE_URL` for backend base URL (Spring Boot ready).

## Scripts
- `npm run dev`
- `npm run build`
- `npm run lint`
- `npm run preview`
