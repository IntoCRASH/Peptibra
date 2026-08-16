import postgres from "postgres";

const sql = postgres(process.env.POSTGRES_URL, { ssl: "require", max: 1, prepare: false });
const rows = await sql`
  select table_name, column_name
  from information_schema.columns
  where table_schema = 'public'
  order by table_name, ordinal_position
`;
const schema = {};
for (const row of rows) (schema[row.table_name] ??= []).push(row.column_name);
console.log(JSON.stringify(schema, null, 2));
await sql.end();
