import { createClient } from "@supabase/supabase-js";

const email = process.env.MOBILE_USER_EMAIL;
const password = process.env.MOBILE_USER_PASSWORD;
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY || !email || !password) {
  throw new Error("Faltan variables para crear el usuario móvil.");
}

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const { data, error: listError } = await admin.auth.admin.listUsers();
if (listError) throw listError;
const user = data.users.find((item) => item.email?.toLowerCase() === email.toLowerCase());
const result = user
  ? await admin.auth.admin.updateUserById(user.id, { password, email_confirm: true })
  : await admin.auth.admin.createUser({ email, password, email_confirm: true });
if (result.error) throw result.error;
console.log("Usuario móvil configurado correctamente.");
