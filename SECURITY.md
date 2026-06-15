# Security Policy

## Supported versions

StickerDex is pre-1.0; security fixes are applied to the latest `main`.

## Reporting a vulnerability

Please **do not** open a public issue for security problems. Instead, use GitHub's
[private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability)
("Report a vulnerability" under the repository's *Security* tab), or email the maintainer listed on
the GitHub profile.

Please include reproduction steps and the affected version/commit. We aim to acknowledge reports
within a few days.

## Self-hosting notes

- StickerDex is designed for **personal / trusted-network** use.
- If you expose it to the internet, **set `STICKERDEX_PASSWORD` and a strong `STICKERDEX_SECRET`**,
  and put it behind HTTPS (e.g. a reverse proxy such as Caddy, Traefik, or nginx).
- The password gates **write** operations only; read endpoints (your catalog and collection
  counts) remain publicly readable even when a password is set. Don't expose an instance you'd
  consider sensitive without putting your own auth in front of it.
- The SQLite database contains only your collection data — no credentials are stored.
