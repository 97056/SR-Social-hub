# Deployment

Use two environments, staging and production, on a VPS with Nginx and HTTPS. Do not point staging at production provider apps or live Razorpay keys.

## Process

1. Install Java 21 and PostgreSQL 16.
2. Create a database role and database. Store `DATABASE_URL`, `DATABASE_USERNAME`, and `DATABASE_PASSWORD` outside git.
3. Generate `SESSION_SECRET` and a 32-byte `TOKEN_ENCRYPTION_KEY`. The `prod` profile refuses the development values.
4. Run the API with `SPRING_PROFILES_ACTIVE=prod`. Flyway applies `apps/api/src/main/resources/db/migration`.
5. Build the web app with `pnpm build` and serve it behind Nginx. Set `API_PROXY_TARGET` to the API, or proxy `/api` in Nginx to the API and serve the Next.js app for every other path.
6. Put TLS in front of both hosts. Production cookies are `Secure`.
7. Schedule `pg_dump` at least daily and test a restore. Keep the dump off the same disk as the database.
8. Expose only `/actuator/health` to the uptime checker. Application logs are structured single lines and must not include cookies, tokens, or webhook bodies.
9. Run one API process with `app.worker.enabled=true` until queue volume justifies a second process. Do not run two workers against different code versions.

## Bootstrap

Set `INITIAL_SUPER_ADMIN_EMAIL` and `INITIAL_SUPER_ADMIN_PASSWORD` for the first boot only. After the account exists, remove them. Sign in, enroll an authenticator, and confirm admin routes answer. Public signup cannot create another super admin.

## Embedded profile

`mvn spring-boot:run -Pembedded-db -Dspring-boot.run.profiles=embedded` starts a disposable Postgres for a demo. Do not use that profile as production.

## Backups and recovery

- Dump PostgreSQL on a schedule and copy it off the VPS.
- Restore the dump into a clean server and start the API against it as a drill before launch.
- Object storage, once configured, needs its own lifecycle and restore test. The API currently reports storage as `not_configured` until all four object-storage variables are set.
- `SENTRY_DSN` is reserved. Wire a Sentry SDK in the launch-hardening phase; do not invent events.

## Nginx sketch

```nginx
server {
  listen 443 ssl;
  server_name app.example.com;
  location /api/ {
    proxy_pass http://127.0.0.1:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto https;
  }
  location / {
    proxy_pass http://127.0.0.1:3000;
  }
}
```
