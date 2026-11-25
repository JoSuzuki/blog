# Email with Resend

The site sends email through [Resend](https://resend.com) (it used SendGrid before). Today that is
the comment notification to the owner; anything else that needs email (password reset, ...) uses
the same module.

## How the code sends email

`src/lib/mail/mailer.server.ts` (server only):

```ts
import { sendEmail } from '~/lib/mail/mailer.server'

const result = await sendEmail({
  to: 'someone@example.com', // or an array
  subject: 'Assunto',
  text: 'Plain text version',
  html: '<p>HTML version</p>', // at least one of text / html
  // from: overrides MAIL_FROM; replyTo: optional
})
// { ok: true, id } | { ok: false, reason: 'not-configured' | 'failed', error? }
```

It calls Resend's REST API with `fetch` (no SDK), never throws, and logs failures, so a caller that
does not care about the outcome can `void sendEmail(...)`. Without configuration it sends nothing;
under `npm run dev` it prints the email to the console instead.

| Variable            | Meaning                                                                          |
| ------------------- | -------------------------------------------------------------------------------- |
| `RESEND_API_KEY`    | Resend API key (`re_...`). Without it no email is sent.                          |
| `MAIL_FROM`         | Default sender, e.g. `JoSuzuki <blog@josuzuki.me>`. Domain verified in Resend.   |
| `COMMENT_NOTIFY_TO` | Where comment notifications go (unchanged). Without it no comment email is sent. |

## Moving from SendGrid to Resend, step by step

The order below keeps email working the whole time: Resend is set up and its secrets are staged
before the new code deploys, and SendGrid is only removed once Resend has been seen to work.

### 1. Create the Resend account

1. Sign up at https://resend.com/signup (GitHub sign-in works).
2. The free plan (3,000 emails a month, 100 a day, one domain) is far more than the blog needs.

### 2. Add and verify the domain

1. In the dashboard, **Domains → Add Domain**. Enter `josuzuki.me` and pick the region closest to
   the server: **São Paulo (sa-east-1)**, since the Fly app runs in `gru`.

   (Resend suggests a subdomain such as `mail.josuzuki.me` to keep the sending reputation apart
   from the root domain. Either works; with a subdomain, `MAIL_FROM` must use it, e.g.
   `blog@mail.josuzuki.me`.)

2. Resend shows the DNS records to create. Copy them exactly from that page; they look like this:

   | Type | Name                | Value                                                 | Purpose                           |
   | ---- | ------------------- | ----------------------------------------------------- | --------------------------------- |
   | TXT  | `resend._domainkey` | `p=MIGfMA0GCSq...` (long key)                         | DKIM                              |
   | MX   | `send`              | `feedback-smtp.sa-east-1.amazonses.com` (priority 10) | bounces (SPF for the return path) |
   | TXT  | `send`              | `v=spf1 include:amazonses.com ~all`                   | SPF                               |

   These live on `send.` and `resend._domainkey.`, so they do not touch the site's own A/AAAA
   records (Fly) or any MX record that receives mail for the domain.

3. Add them at the DNS provider of `josuzuki.me`. Some providers append the domain to the name
   themselves: enter `send`, not `send.josuzuki.me`, in that case.
4. Recommended, if the domain has no DMARC record yet: add
   `TXT _dmarc  v=DMARC1; p=none;` (Gmail and Yahoo want one for good delivery). If one exists,
   leave it.
5. Back in Resend, click **Verify DNS Records**. Propagation usually takes minutes, sometimes a
   few hours; the domain shows **Verified** when done. Check from a terminal if it hangs:
   `dig +short TXT resend._domainkey.josuzuki.me` and `dig +short MX send.josuzuki.me`.

### 3. Create an API key

1. **API Keys → Create API Key**. Name it `blog-production`, permission **Sending access**, domain
   `josuzuki.me`.
2. Copy the key (`re_...`); Resend shows it once.
3. Optional, for local testing: a second key `blog-dev` the same way.

### 4. Test locally (optional but quick)

In `.env` (git-ignored):

```sh
RESEND_API_KEY=re_...
MAIL_FROM="JoSuzuki <blog@josuzuki.me>"
```

Then:

```sh
npm run mail:test -- delivered@resend.dev   # Resend's test inbox, always accepts
npm run mail:test -- you@your-real-address  # check it arrives, and not in spam
```

It prints `Sent, Resend id ...`; the email also appears under **Emails** in the dashboard. An error
like `403 ... domain is not verified` means step 2 is not finished.

### 5. Set the production secrets (staged, before merging)

```sh
fly secrets set -a josuzuki-blog --stage \
  RESEND_API_KEY='re_...' \
  MAIL_FROM='JoSuzuki <blog@josuzuki.me>'
```

`--stage` stores them without restarting the machine; the next deploy picks them up.
`COMMENT_NOTIFY_TO` stays as it is.

If `COMMENT_NOTIFY_FROM` (the old sender) was an address on a verified domain, its value can be
reused as `MAIL_FROM`.

### 6. Deploy

Merge the pull request. The GitHub workflow deploys `main` to Fly (or run
`fly deploy -a josuzuki-blog --ha=false` by hand). Then check it end to end:

1. Post a comment on any post on https://josuzuki.me.
2. The notification arrives at `COMMENT_NOTIFY_TO`, and shows as **Delivered** in Resend → Emails.
3. If nothing arrives: `fly logs -a josuzuki-blog` shows `Email not sent: ...` with Resend's answer.

### 7. Remove SendGrid

Only once step 6 worked:

1. Remove the old secrets (this restarts the machine, which takes about a second):
   ```sh
   fly secrets unset -a josuzuki-blog SENDGRID_API_KEY COMMENT_NOTIFY_FROM
   ```
   `fly secrets list -a josuzuki-blog` should now show `RESEND_API_KEY`, `MAIL_FROM` and
   `COMMENT_NOTIFY_TO`, and no `SENDGRID_*`.
2. Remove `SENDGRID_API_KEY` and `COMMENT_NOTIFY_FROM` from your local `.env` too.
3. In SendGrid, **Settings → API Keys**: delete the blog's key.
4. **Settings → Sender Authentication**: delete the authenticated domain, then delete its DNS
   records at the DNS provider. They are CNAMEs named like `em1234`, `s1._domainkey`,
   `s2._domainkey`, and `url1234`/`1234` if link branding was on, all pointing at `sendgrid.net`.
   Do not delete the Resend records from step 2, and keep the SPF TXT on the root domain unless it
   only contains `include:sendgrid.net` (if it lists other services, just remove that include).
   A single sender verification instead of a domain has no DNS records; just delete it.
5. Optionally close the SendGrid account (**Settings → Account Details**) once nothing else uses it.

## Troubleshooting

- **Nothing sent, nothing logged**: one of `RESEND_API_KEY`, `MAIL_FROM` or (for comments)
  `COMMENT_NOTIFY_TO` is missing in that environment.
- **`Resend answered 403`**: the `MAIL_FROM` domain is not verified, or the key is restricted to
  another domain.
- **`Resend answered 422`**: a malformed address; `MAIL_FROM` must be `address` or
  `Name <address>`.
- **`Resend answered 429`**: rate or daily quota reached (free plan: 100 a day).
- **Lands in spam**: check that DKIM and SPF show as verified in Resend and add the DMARC record.
