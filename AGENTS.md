<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Project rules

- Data access uses the browser Lovable Cloud client with RLS scoped to `auth.uid()`; every table row is owned by `user_id` (sale_items via its sale). Why: each shopkeeper sees only their own data.
- Sales are created only through the `create_sale` database function. Why: sale, items and stock decrement happen atomically and stock can never go negative.
- Signed-in pages live under `src/routes/_authenticated/`. Why: single client-side auth gate.
- Password changes go through `supabase.auth.updateUser`: the signed-in screen (`/senha`) sends `current_password`, the public recovery page (`/reset-password`) never does. Why: the backend requires the current password for signed-in changes but exempts recovery sessions, so mixing the two breaks one flow.
