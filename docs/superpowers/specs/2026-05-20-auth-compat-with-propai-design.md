# Image UI Auth Compatibility With PropAI Design

## Goal

Make `image-ui` reuse the same Supabase-backed user model and account experience as `propai`, while keeping `image-ui` on its current React + TanStack Router stack.

This change replaces the current "login form inside settings" pattern with a standard auth flow:

- public `/$locale/login`
- public `/$locale/register`
- protected app routes
- redirect back to the original destination after successful auth
- shared use of the existing `user_profiles` table from the same database

## Current Problems

1. `image-ui` has no dedicated login route.
2. Authentication UI is embedded inside `/$locale/settings`, which makes routing and access control unclear.
3. Protected pages depend on API `401` responses as a secondary signal instead of having a consistent user session layer.
4. `propai` already defines the expected account model and route structure, but `image-ui` does not align with it yet.

## Scope

This design covers:

- dedicated login and register routes
- route guards for protected app pages
- redirect-after-login flow
- shared client-side auth/session/profile layer
- reading `user_profiles` from the shared Supabase database
- converting settings into an authenticated account/settings page

This design does not include:

- billing checkout flows
- subscription management UI
- full usage/quota enforcement parity with `propai`
- migrating `image-ui` to Next.js or changing backend architecture

## Reference Alignment With PropAI

`propai` establishes the target model:

- `/login` and `/register` are public auth entry points
- protected dashboard routes redirect unauthenticated users to `/login`
- Supabase Auth is the identity source
- `user_profiles` is the shared user extension table

`image-ui` should match those behaviors conceptually, while adapting them to its locale-prefixed router and existing frontend stack.

## Route Design

### Public routes

- `/$locale/login`
- `/$locale/register`

### Protected routes

- `/$locale/gallery`
- `/$locale/editor/$id`
- `/$locale/generate`
- `/$locale/resources`
- `/$locale/video-generate`
- `/$locale/workflow`
- `/$locale/settings`

### Redirect behavior

When an unauthenticated user opens a protected route:

- redirect to `/$locale/login?redirect=<encoded-original-path>`

Examples:

- `/zh/gallery` -> `/zh/login?redirect=%2Fzh%2Fgallery`
- `/en/settings` -> `/en/login?redirect=%2Fen%2Fsettings`

After successful login:

- if `redirect` exists, navigate there
- otherwise navigate to `/$locale/gallery`

After logout:

- navigate to `/$locale/login`

## Auth Session Layer

Add a dedicated auth module for `image-ui` with three responsibilities:

1. **Auth client helpers**
   - `signInWithPassword`
   - `signUp`
   - `signOut`
   - `getSession`

2. **Auth state store**
   - `session`
   - `user`
   - `profile`
   - `loading`
   - `initialized`

3. **Profile loading**
   - after session is available, fetch the current row from `user_profiles`
   - store it alongside the current Supabase user

This gives `image-ui` a single source of truth for authenticated UI instead of spreading auth checks across pages and stores.

## `user_profiles` Reuse

`image-ui` will reuse the same `user_profiles` table and access pattern as `propai`.

Expected behavior:

- user identity comes from Supabase Auth
- profile data is fetched by `id = user.id`
- account-oriented UI reads from `profile` when available

Initial use in `image-ui`:

- current email display
- current plan summary if present
- future account-based feature flags can be added without reshaping the auth foundation

The implementation should tolerate missing optional profile fields without blocking sign-in.

## Login And Register UX

### Login page

Fields:

- email
- password

Actions:

- submit login
- link to register page

Behavior:

- show inline error message for auth failures
- keep toast optional as secondary feedback
- on success, follow redirect logic

### Register page

Fields:

- email
- password

Actions:

- submit registration
- link to login page

Behavior:

- if Supabase returns an active session immediately, follow redirect logic
- if email confirmation is required, show a completion state telling the user to check email, then direct them to login

## Settings Page Changes

`/$locale/settings` becomes a protected account/settings page.

Remove:

- embedded login form

Keep:

- current user email
- profile/plan summary when present
- sign-out action
- existing tool/application settings

This clarifies page responsibilities:

- `login/register` handle authentication entry
- `settings` handles authenticated account and app preferences

## Guarding Strategy

Use two layers:

1. **Primary route guard**
   - before entering protected routes, check session
   - redirect unauthenticated users to localized login with redirect target

2. **401 fallback**
   - if a protected in-app request returns `401`, redirect to localized login with the current path

The route guard is the main flow. The `401` redirect remains only as a recovery path for expired sessions or desynced client state.

## Error Handling

User-facing auth errors should be readable and localized where practical:

- invalid email or password
- email already registered
- password too short
- network failure

Technical errors should still be logged for debugging, but the page should present understandable feedback.

## Testing Strategy

Add focused regression coverage for:

1. protected-path detection and localized redirect path building
2. redirect query preservation
3. login success with redirect fallback behavior
4. settings no longer acting as a public login surface

Manual verification should include:

- opening protected routes while logged out
- logging in from redirected state
- registering a new account
- logging out from settings
- refreshing while logged in and confirming profile rehydrates

## Implementation Notes

Recommended implementation order:

1. extract auth routing helpers
2. add dedicated auth store/session bootstrap
3. add `/$locale/login`
4. add `/$locale/register`
5. protect `/$locale/settings`
6. remove login form from settings and replace with account summary
7. wire redirect query handling
8. keep `401` redirect fallback aligned with new login route

## Risks And Mitigations

### Risk: profile row shape differs across environments

Mitigation:

- only require stable fields used by `propai`
- guard optional fields defensively

### Risk: route guard and `401` fallback disagree

Mitigation:

- centralize redirect target building in one auth routing helper

### Risk: auth flicker on initial load

Mitigation:

- use an initialized/loading state before deciding whether protected pages can render

## Success Criteria

This change is successful when:

- `image-ui` has dedicated localized login and register routes
- all app pages requiring auth redirect to login rather than settings
- login returns the user to their intended page
- settings requires authentication
- Supabase session and `user_profiles` are loaded from a shared auth layer
- account behavior matches `propai` conceptually without changing `image-ui`'s app architecture
