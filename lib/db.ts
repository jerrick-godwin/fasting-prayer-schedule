import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let sqlClient: NeonQueryFunction<false, false> | null = null;

export function getSql() {
  if (sqlClient) return sqlClient;
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not configured");
  sqlClient = neon(databaseUrl);
  return sqlClient;
}

export function getReservationsTable(sql = getSql()) {
  const schema = process.env.DATABASE_SCHEMA || "public";
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(schema)) throw new Error("DATABASE_SCHEMA is invalid");
  return sql.unsafe(`"${schema}".reservations`);
}

export function isUniqueViolation(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "23505");
}
