import { SCHEMA } from "./schema";

type Row = Record<string, unknown>;
interface Driver {
  query(text: string, params?: unknown[]): Promise<{ rows: Row[] }>;
  exec(sql: string): Promise<void>;
}

// Dates stay "YYYY-MM-DD" / ISO strings, numerics become numbers — same shape from pg and PGlite.
const asString = (v: string) => v;
const asNumber = (v: string) => (v === null ? null : Number(v));
const PARSERS: Record<number, (v: string) => unknown> = { 1082: asString, 1114: asString, 1184: asString, 1700: asNumber, 20: asNumber };

async function makeDriver(): Promise<Driver> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const pg = (await import("pg")).default;
    for (const [oid, fn] of Object.entries(PARSERS)) pg.types.setTypeParser(Number(oid), fn);
    const pool = new pg.Pool({ connectionString: url, max: 5, idleTimeoutMillis: 30_000 });
    return {
      query: (text, params) => pool.query(text, params as unknown[]),
      exec: async (sql) => { await pool.query(sql); },
    };
  }
  // Local dev / tests: embedded Postgres (PGlite). PGLITE_DIR=memory:// for an in-memory DB.
  const { PGlite } = await import("@electric-sql/pglite");
  const db = new PGlite(process.env.PGLITE_DIR ?? "./data/pglite", { parsers: PARSERS });
  return {
    query: (text, params) => db.query<Row>(text, params as unknown[]),
    exec: async (sql) => { await db.exec(sql); },
  };
}

const g = globalThis as unknown as { __goalsDb?: Promise<Driver> };
function driver(): Promise<Driver> {
  return (g.__goalsDb ??= makeDriver().then(async (d) => { await d.exec(SCHEMA); return d; }).catch((e) => {
    g.__goalsDb = undefined;
    throw e;
  }));
}

export async function q<T = Row>(text: string, params: unknown[] = []): Promise<T[]> {
  return (await (await driver()).query(text, params)).rows as T[];
}
export async function one<T = Row>(text: string, params: unknown[] = []): Promise<T | null> {
  return (await q<T>(text, params))[0] ?? null;
}

/** Postgres error text for raised exceptions (e.g. the year-focus trigger), else a generic message. */
export function dbError(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  if (/[а-яё]/i.test(m)) return m;   // our own messages (data layer, triggers) are Russian and safe to show
  console.error(e);
  return "Ошибка базы данных, попробуйте ещё раз";
}
