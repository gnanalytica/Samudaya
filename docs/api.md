# API reference

Two doors into the same data, both at `https://<your-host>`:

- **`/api/v1/*`** — a plain REST surface
- **`/api/mcp`** — the same operations as MCP tools, for AI assistants

Both accept either an **API key** or a **user token**, and neither is a way
around row-level security for a signed-in user.

---

## Authentication

### API keys

Created under **Admin → API & AI access**. Send as a bearer token:

```
Authorization: Bearer sam_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

A key is bound to one society and cannot reach another, whatever it asks for.
Its **scopes** decide what it can do. A `:write` scope implies the matching
`:read`, so granting `events:write` alone is enough to both read and create
events.

| Scope                 | Grants                                                           |
| --------------------- | ---------------------------------------------------------------- |
| `events:read`         | Read events, their checklists and their derived figures          |
| `events:write`        | Create draft events, add and update tasks, record a contribution |
| `expenses:read`       | Read an event's ledger                                           |
| `expenses:write`      | File an expense — it arrives pending                             |
| `activities:read`     | Read cultural activities and volunteer roles                     |
| `activities:write`    | Create an activity, send a suggestion to the committee           |
| `announcements:read`  | Read notices                                                     |
| `announcements:write` | Post notices — residents see them immediately                    |
| `members:read`        | Read the member list                                             |
| `polls:read`          | Read polls and their tallies                                     |

The plaintext key is shown once at creation and never stored. What is kept is a
SHA-256 digest in `public.api_key_secrets` — a table with RLS enabled and no
policies at all, so no client role can read a row, and comparison happens inside
the database in constant time.

Revoking a key takes effect on the next request.

### User tokens

A Supabase access token works too — this is what the mobile app sends:

```
Authorization: Bearer <supabase-access-token>
```

Requests authenticated this way run **as that user**, so RLS applies exactly as
it does in the web app and scopes are not consulted. If the user belongs to more
than one society, add `?community=<slug>`; without it the request is refused
rather than guessing which one you meant.

### What a key cannot do

Three things are deliberately out of reach of any key, at any scope, because
they are the points where the app's guarantees to residents live:

- **Publishing an event.** `POST /api/v1/events` always creates a draft.
  Residents cannot see it and it cannot take money until a human admin
  publishes it in the app.
- **Approving an expense.** Filed expenses arrive `pending`. Approval runs
  through `review_expense()`, which refuses self-approval — so an integration
  cannot both file and clear a payment.
- **Changing the surplus rule once money has arrived.** The rule is fixed at
  collection time; moving a surplus takes a resident vote.

---

## Response shape

Success:

```json
{ "data": … }
```

Failure:

```json
{
  "error": {
    "code": "forbidden",
    "message": "This key is missing the “expenses:write” scope."
  }
}
```

| `code`            | HTTP | Meaning                                                        |
| ----------------- | ---- | -------------------------------------------------------------- |
| `unauthorized`    | 401  | No credentials, or they are not valid                          |
| `forbidden`       | 403  | Authenticated, but not allowed — missing scope, or RLS said no |
| `not_found`       | 404  | No such record _in this society_                               |
| `conflict`        | 409  | Already exists                                                 |
| `invalid_request` | 422  | Validation failed; `details` carries the field errors          |
| `rate_limited`    | 429  | Too many attempts                                              |
| `server_error`    | 500  | Something broke on our side                                    |

A 404 and "exists but you may not see it" are deliberately indistinguishable.

Anywhere an endpoint takes `{event}` in its path, that is either the event's
**slug** (`ganesh-2026`) or its UUID. Slugs are the friendlier choice and are
unique within a society.

---

## Endpoints

### `GET /api/v1/me`

_Scope: `members:read`_ — the society this credential belongs to, plus the
caller's role and scopes. Worth calling first.

### `GET /api/v1/events`

_Scope: `events:read`_ — events, newest first, each with a `stats` object:
`fund_target`, `fund_raised`, `contributors`, `spent`, `available`,
`tasks_total`, `tasks_done`, `readiness`, `participants`, `volunteers`.

Query: `status` (comma-separated: `draft`, `published`, `completed`,
`cancelled`), `limit` (default 25, max 100).

### `POST /api/v1/events`

_Scope: `events:write`_ — **always creates a draft.**

```json
{
  "slug": "diwali-2026",
  "name": "Diwali Mela 2026",
  "starts_on": "2026-11-08",
  "ends_on": null,
  "emoji": "🪔",
  "venue": "Central lawn",
  "organizer": "Cultural committee",
  "description": "Two evenings of food stalls, rangoli and fireworks.",
  "expected_attendance": 400,
  "fund_target": 250000,
  "fund_rule": "carry_next_edition",
  "fund_rule_note": "Anything left over funds next year's Diwali."
}
```

`fund_rule` is one of `carry_next_edition`, `carry_related`, `general_fund`,
`refund`, `donate`. It decides what happens to a surplus and is shown to
residents **before** they contribute.

### `GET /api/v1/events/{event}`

_Scope: `events:read`_ — one event with the same `stats` block.

### `GET /api/v1/events/{event}/tasks`

_Scope: `events:read`_ — the checklist that drives `readiness`, in display
order, each with its status, assignee and due date.

### `POST /api/v1/events/{event}/tasks`

_Scope: `events:write`_

```json
{
  "name": "Book the sound system",
  "notes": "Two speakers and a cordless mic.",
  "due_on": "2026-10-28",
  "assignee_id": null
}
```

### `PATCH /api/v1/tasks/{id}`

_Scope: `events:write`_ — accepts `status` (`todo`, `in_progress`, `done`,
`blocked`), `assignee_id`, `due_on`. Marking a task `done` stamps
`completed_at` in the database, not in the client.

### `GET /api/v1/events/{event}/ledger`

_Scope: `expenses:read`_ — the money in one place: the event, its `stats`, and
every expense the caller may see, with `vendor`, `paid_by`, `method`,
`bill_url`, and the names of who requested and who approved it.

RLS decides that last part. A key acting as a resident sees **approved**
expenses only; a committee key also sees pending and rejected ones.

### `POST /api/v1/expenses`

_Scope: `expenses:write`_ — files an expense as `pending`.

```json
{
  "event_id": "ganesh-2026",
  "name": "Sound system",
  "category": "sound",
  "amount": 18000,
  "vendor": "Shree Audio",
  "paid_by": "A-402",
  "method": "upi",
  "bill_url": "bills/ganesh-2026/shree-audio.pdf",
  "spent_on": "2026-09-10"
}
```

`method` is one of `upi`, `card`, `netbanking`, `bank_transfer`, `cash`,
`cheque`, `other`.

### `POST /api/v1/contributions`

_Scope: `events:write`_ — records a contribution to an event's fund from the
member the credential belongs to.

```json
{ "event_id": "ganesh-2026", "amount": 2500, "method": "upi" }
```

The response carries `receipt_no`. The amount is **private**: it is visible to
the contributor and to admins, while the public figures are the total and the
number of contributors.

### `GET /api/v1/events/{event}/activities`

_Scope: `activities:read`_ — what residents can sign up to perform in, each with
its `interested` count, `capacity` and `practice_dates`.

### `POST /api/v1/events/{event}/activities`

_Scope: `activities:write`_

```json
{
  "name": "Children's dance",
  "emoji": "💃",
  "description": "Group performance, ages 5–12.",
  "capacity": 30,
  "practice_dates": ["2026-09-01", "2026-09-05"]
}
```

### `GET /api/v1/events/{event}/volunteers`

_Scope: `activities:read`_ — volunteer roles with `target_count`, `signed_up`
and `still_needed`.

### `POST /api/v1/suggestions`

_Scope: `activities:write`_ — sends an idea to the committee's queue. Unlike a
notice, this does **not** broadcast to residents.

```json
{
  "name": "Street food stall",
  "description": "Six stalls run by residents, profits to the fund.",
  "expected_participants": 40,
  "event_id": null
}
```

### `GET /api/v1/announcements`

_Scope: `announcements:read`_ — currently visible notices, pinned first.
Query: `limit` (default 25, max 100).

### `POST /api/v1/announcements`

_Scope: `announcements:write`_

```json
{
  "title": "Ganesh Chaturthi timings",
  "body": "Aarti at 7pm each evening, visarjan on Sunday at 4pm.",
  "audience": "all",
  "is_pinned": false,
  "event_id": null,
  "expires_at": "2026-09-20T12:00:00Z"
}
```

`audience` is one of `all`, `residents`, `committee`.

### `GET /api/v1/polls`

_Scope: `polls:read`_ — polls with their running tallies, newest first. Each
option carries `votes` and `total_votes`; **individual votes are never
returned**, by anyone, at any role. Query: `limit`.

### `GET /api/v1/members`

_Scope: `members:read`_ — active members and their roles. Query: `limit`.

### `GET /api/health`

No authentication. Liveness only; says nothing about configuration.

---

## MCP

`POST /api/mcp` speaks JSON-RPC 2.0 over the Streamable HTTP transport, in its
stateless form — one request, one response, no session to resume. Supported
methods: `initialize`, `ping`, `tools/list`, `tools/call`.

```bash
curl -X POST https://<your-host>/api/mcp \
  -H "Authorization: Bearer sam_live_…" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Sixteen tools, mapping onto the endpoints above:

| Tool                   | Scope                 |
| ---------------------- | --------------------- |
| `get_community`        | `members:read`        |
| `list_events`          | `events:read`         |
| `get_event`            | `events:read`         |
| `create_event`         | `events:write`        |
| `list_tasks`           | `events:read`         |
| `add_task`             | `events:write`        |
| `update_task`          | `events:write`        |
| `get_ledger`           | `expenses:read`       |
| `file_expense`         | `expenses:write`      |
| `list_activities`      | `activities:read`     |
| `list_volunteer_roles` | `activities:read`     |
| `list_announcements`   | `announcements:read`  |
| `post_announcement`    | `announcements:write` |
| `suggest_activity`     | `activities:write`    |
| `list_polls`           | `polls:read`          |
| `list_members`         | `members:read`        |

Tools that take an event accept its slug or its UUID, the same as the REST
paths.

`tools/list` returns only what the key's scopes allow, so an assistant is never
shown a tool that will then fail. A tool that errors reports it inside the
result (`isError: true`) rather than as a protocol error, so the model can read
the message and correct itself — validation failures come back field by field
(`starts_on: Expected a date like 2026-09-14`) so it can retry correctly.

**The write tools reach real people and real money.** `post_announcement`
notifies every resident. `file_expense` puts a claim in front of the committee.
The server's `initialize` response says so in its instructions, but scope keys
to what the integration actually needs: the read-only set is enough for
"how much have we raised and what's still unticked?", which is what most
assistants are actually asked.
