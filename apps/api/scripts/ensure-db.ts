/**
 * Starts embedded PostgreSQL for local development when Docker is unavailable.
 * Writes DATABASE_URL into apps/api/.env if missing.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import EmbeddedPostgres from "embedded-postgres";

const dataDir = join(__dirname, "..", ".data", "pg");
const envPath = join(__dirname, "..", ".env");
const port = Number(process.env.EMBEDDED_PG_PORT ?? 54329);

async function main() {
  mkdirSync(dataDir, { recursive: true });

  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: "sr",
    password: "sr_dev_password",
    port,
    persistent: true,
  });

  const alreadyInit = existsSync(join(dataDir, "PG_VERSION"));
  if (!alreadyInit) {
    await pg.initialise();
  }

  await pg.start();
  try {
    await pg.createDatabase("sr_social_hub");
  } catch {
    // database may already exist
  }

  const databaseUrl = `postgresql://sr:sr_dev_password@127.0.0.1:${port}/sr_social_hub?schema=public`;
  upsertEnv(databaseUrl);
  // Keep process alive so Postgres stays up for migrate/dev
  // eslint-disable-next-line no-console
  console.log(`Embedded PostgreSQL ready on port ${port}`);
  // eslint-disable-next-line no-console
  console.log(`DATABASE_URL=${databaseUrl}`);

  const stop = async () => {
    await pg.stop();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

function upsertEnv(databaseUrl: string) {
  const defaults = `DATABASE_URL=${databaseUrl}
API_PORT=4000
API_URL=http://localhost:4000
WEB_URL=http://localhost:3000
JWT_ACCESS_SECRET=dev-access-secret-change-me-32chars
JWT_REFRESH_SECRET=dev-refresh-secret-change-me-32chars
JWT_ACCESS_TTL=7d
JWT_REFRESH_TTL=30d
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef
COOKIE_SECURE=false
SUPER_ADMIN_EMAIL=admin@srsocialhub.local
SUPER_ADMIN_PASSWORD=ChangeMeAdmin!123
DEMO_COMPANY_EMAIL=agency@srsocialhub.local
DEMO_COMPANY_PASSWORD=ChangeMeAgency!123
DEMO_CLIENT_EMAIL=client@srsocialhub.local
DEMO_CLIENT_PASSWORD=ChangeMeClient!123
REDIS_URL=redis://localhost:6379
`;

  if (!existsSync(envPath)) {
    writeFileSync(envPath, defaults, "utf8");
    return;
  }

  const current = readFileSync(envPath, "utf8");
  if (current.includes("DATABASE_URL=")) {
    writeFileSync(
      envPath,
      current.replace(/DATABASE_URL=.*/g, `DATABASE_URL=${databaseUrl}`),
      "utf8",
    );
  } else {
    writeFileSync(envPath, `${current.trim()}\nDATABASE_URL=${databaseUrl}\n`, "utf8");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
