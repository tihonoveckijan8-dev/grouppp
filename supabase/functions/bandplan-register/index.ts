import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: cors });

const normalizeUsername = (v: unknown) => String(v ?? "").trim().toLowerCase();
const validUsername = (v: string) => /^[a-zа-яё0-9_.-]{3,24}$/i.test(v);
const validPassword = (v: unknown) => typeof v === "string" && v.length >= 8 && v.length <= 128;
const usernameEmail = (username: string) => {
  if (/^[a-z0-9_.-]+$/.test(username)) return username + "@users.bandplan.local";
  const bytes = new TextEncoder().encode(username);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return "bp-" + hex + "@users.bandplan.local";
};
function makeFriendCode() {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}
function secretKey() {
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      const values = parsed && typeof parsed === "object" ? Object.values(parsed) : [];
      const key = values.find((v) => typeof v === "string" && /^sb_secret_/.test(v));
      if (typeof key === "string") return key;
      const legacy = values.find((v) => typeof v === "string" && v.startsWith("eyJ"));
      if (typeof legacy === "string") return legacy;
    } catch (_) { /* try the legacy environment variable */ }
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
}
function oauthUsername(user: any) {
  const metadata = user?.user_metadata || {};
  const raw = metadata.preferred_username || metadata.user_name || metadata.name ||
    metadata.full_name || (typeof user?.email === "string" ? user.email.split("@")[0] : "") ||
    ("user" + String(user?.id || "").slice(0, 8));
  const value = String(raw).trim().toLowerCase()
    .replace(/[^a-zа-яё0-9_.-]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 24);
  return value.length >= 3 ? value : ("user" + String(user?.id || "").replace(/-/g, "").slice(0, 12)).slice(0, 24);
}
async function profileByUsername(db: any, username: string) {
  const { data, error } = await db.from("bandplan_profiles")
    .select("id,username,friend_code,created_at").eq("username", username).maybeSingle();
  if (error) throw error;
  return data;
}
async function createProfileAndState(db: any, userId: string, username: string, displayName: string) {
  const code = makeFriendCode();
  const { error: profileError } = await db.from("bandplan_profiles")
    .insert({ id: userId, username, friend_code: code });
  if (profileError) throw profileError;
  const { error: stateError } = await db.from("bandplan_user_state").insert({
    user_id: userId,
    state: { profile: { name: displayName }, onboardingDone: false, members: [], events: [], songs: [], setlists: [] },
  });
  if (stateError) {
    await db.from("bandplan_profiles").delete().eq("id", userId);
    throw stateError;
  }
  return code;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Метод не поддерживается" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const key = secretKey();
    const url = Deno.env.get("SUPABASE_URL");
    if (!url || !key) return json({ error: "Сервер авторизации не настроен: отсутствует серверный ключ Supabase" }, 500);
    const db = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    if (body.mode === "check_username") {
      const username = normalizeUsername(body.username);
      if (!validUsername(username)) return json({ error: "Ник: 3–24 символа, только буквы, цифры, _, ., -" }, 400);
      const existing = await profileByUsername(db, username);
      return json({ available: !existing, username });
    }

    const authorization = req.headers.get("Authorization") || "";
    if (body.mode === "oauth" && /^Bearer\s+/i.test(authorization)) {
      const token = authorization.replace(/^Bearer\s+/i, "");
      const { data, error } = await db.auth.getUser(token);
      if (error || !data.user) return json({ error: "Сессия OAuth недействительна" }, 401);
      const user = data.user;
      const { data: existing, error: lookupError } = await db.from("bandplan_profiles")
        .select("id,username,friend_code,created_at").eq("id", user.id).maybeSingle();
      if (lookupError) return json({ error: lookupError.message }, 500);
      if (existing) return json({ ok: true, profile: existing, existing: true });
      const base = oauthUsername(user);
      let username = base;
      const occupied = await profileByUsername(db, username);
      if (occupied) username = (base.slice(0, 17) + "-" + user.id.replace(/-/g, "").slice(0, 6)).slice(0, 24);
      try {
        const code = await createProfileAndState(db, user.id, username, user.user_metadata?.full_name || user.user_metadata?.name || username);
        return json({ ok: true, userId: user.id, username, friendCode: code, existing: false });
      } catch (error) {
        return json({ error: "Не удалось создать профиль: " + (error?.message || "ошибка базы данных") }, 500);
      }
    }

    const username = normalizeUsername(body.username);
    const password = body.password;
    if (!validUsername(username)) return json({ error: "Ник: 3–24 символа, только буквы, цифры, _, ., -" }, 400);
    if (!validPassword(password)) return json({ error: "Пароль должен содержать минимум 8 символов" }, 400);

    const existing = await profileByUsername(db, username);
    if (existing) return json({ error: "Этот ник уже занят", code: "USERNAME_TAKEN" }, 409);

    const { data: created, error: createError } = await db.auth.admin.createUser({
      email: usernameEmail(username),
      password,
      email_confirm: true,
      user_metadata: { username },
    });
    if (createError || !created.user) {
      const message = createError?.message || "Не удалось создать аккаунт";
      if (/already.*registered|already.*exists|duplicate/i.test(message)) {
        return json({ error: "Этот ник уже занят", code: "USERNAME_TAKEN" }, 409);
      }
      return json({ error: message }, 400);
    }

    try {
      const code = await createProfileAndState(db, created.user.id, username, username);
      return json({ ok: true, userId: created.user.id, username, friendCode: code });
    } catch (error) {
      await db.auth.admin.deleteUser(created.user.id);
      const message = String(error?.message || "");
      if (/duplicate key|unique constraint|already exists/i.test(message)) {
        return json({ error: "Этот ник уже занят", code: "USERNAME_TAKEN" }, 409);
      }
      return json({ error: "Не удалось создать профиль или хранилище: " + (message || "ошибка базы данных") }, 500);
    }
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Внутренняя ошибка регистрации" }, 500);
  }
});