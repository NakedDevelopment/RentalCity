// Single source of truth for the tenant-side launch gate — see run notes for
// context. Explicit `true` always wins; otherwise the local Vite dev server
// (not a production build, not `vite preview`) defaults it on so tenant work
// stays testable without setting the env var everywhere.
export const TENANT_SIDE_ENABLED =
  import.meta.env.VITE_TENANT_SIDE_ENABLED === 'true' || import.meta.env.DEV
