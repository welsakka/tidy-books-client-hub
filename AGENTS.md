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

## Architecture rules
- Uploaded files live in `documents.file_bytes` (bytea) with a best-effort disk copy; never use object storage. Why: prototype requirement.
- Uploads go through `/api/upload` and downloads through `/api/files/$id`; both verify the bearer token and use an RLS-scoped client. Why: the server decides access and logs every open.
- All model/document parsing lives in `parseDocument` (`src/lib/parse.functions.ts`), calling Lovable AI (`openai/gpt-6-astra`, streamed Responses) with the server-side LOVABLE_API_KEY. Why: a privacy-safe parser can replace it without touching screens.
- Staff screens live under `src/routes/_staff`, the client portal under `src/routes/_portal`; each layout redirects the other role away. Why: one shell per audience.
- Roles live in `user_roles`; RLS uses the `is_staff`/`is_firm_admin`/`can_work_books`/`my_client_id` helpers. Why: avoids privilege escalation through profiles.
- Business rules (close percent, aging, coverage, parsing) are pure functions in `src/lib` covered by `src/test/rules.test.ts`.

- Canonical bookkeeping money is integer cents; transaction amount is a compatibility mirror, and posting uses database journal RPCs. Why: balanced accounting must hold independently of the screen.
- Company bookkeeping views share client-safe rules in src/lib/bookkeeping.ts and focused controls under src/components/bookkeeping. Why: staff and client reports use one financial model.
- Firm membership and approved client access restrict every company surface; public invitation registration verifies a single-use token before privileged account creation. Why: protected screens alone do not authorize database or public endpoint access.
