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

- Data is scoped per company: products/customers/sales carry `company_id` (default `current_company_id()`), RLS uses `can_access_company()`; sale_items via its sale. Why: several users of one company share the same stock and sales.
- Company roles (`admin`/`operator`) live in `company_members`; the platform Master lives in `user_roles`; a Master's active company lives in `master_context`. Why: roles never sit on user-editable data, and Master can operate any company.
- Creating/removing users goes through server functions in `src/lib/team.functions.ts` that check `is_company_admin` as the caller before using the admin client. Why: account creation needs privileged access.
- Sales are created only through the `create_sale` database function. Why: sale, items and stock decrement happen atomically and stock can never go negative.
- Signed-in pages live under `src/routes/_authenticated/`. Why: single client-side auth gate.
- Password changes go through `supabase.auth.updateUser`: the signed-in screen (`/perfil`) sends `current_password`, the public recovery page (`/reset-password`) never does. Why: the backend requires the current password for signed-in changes but exempts recovery sessions, so mixing the two breaks one flow.
- Profile data (name, avatar) lives in `auth.users.user_metadata` (`full_name`, `avatar_path`); avatar files go to the private `avatars` storage bucket under `<user_id>/`. Why: no extra table needed and RLS on storage.objects already scopes files to the owner.
