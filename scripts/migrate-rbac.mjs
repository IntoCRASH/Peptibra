import postgres from "postgres";

const sql = postgres(process.env.POSTGRES_URL, { ssl: "require", max: 1, prepare: false });
await sql.begin(async (tx) => {
  await tx.unsafe(`
    create table if not exists user_profiles (
      email text primary key,
      user_id uuid unique,
      team_id bigint references team(id) on delete set null,
      role text not null check (role in ('admin','socio','vendedor')),
      active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
  await tx.unsafe(`create index if not exists user_profiles_team_id_idx on user_profiles(team_id)`);
  await tx.unsafe(`alter table clients add column if not exists owner_team_id bigint references team(id) on delete set null`);
  for (const table of [
    "user_profiles","calculations","products","product_profiles","inventory_balances","inventory_movements",
    "team","clients","invoices","invoice_items","payments","cash_movements","suppliers","purchases",
    "supplier_payments","protocols","internal_withdrawals","internal_withdrawal_payments","legacy_sales","app_settings"
  ]) await tx.unsafe(`alter table "${table}" enable row level security`);
  await tx.unsafe(`
    insert into user_profiles(email,user_id,team_id,role,active)
    select lower(email),id,null,'admin',true from auth.users
    where lower(email)='cruzmonty1983@gmail.com'
    on conflict(email) do update set user_id=excluded.user_id,role='admin',active=true,updated_at=now()
  `);
});
console.log("RBAC schema ready");
await sql.end();
