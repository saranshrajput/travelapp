---
name: OpenAPI codegen quirks
description: Pitfalls when editing the shared OpenAPI spec and using the generated react-query hooks
---

- Use `type: number` in the OpenAPI spec, not `integer` — the zod version in the codegen pipeline (3.25) lacks `z.int`, so `integer` breaks generation.
- Avoid optional query parameters whose names collide across operations — they merge badly in the generated `*Params` types (a `sinceId` param had to be removed for this reason).
- The generated react-query hooks type `options.query` as full `UseQueryOptions`, so passing any option (e.g. `refetchInterval`, `enabled`) requires also passing `queryKey: getXxxQueryKey(...)` (key getters are exported alongside the hooks).

**How to apply:** whenever editing `lib/api-spec/openapi.yaml` or writing client code with per-call query options.
