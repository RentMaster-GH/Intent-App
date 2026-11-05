// supabase/functions/delete-account/index.ts
// POST /functions/v1/delete-account
// Body: { confirm: "DELETE" }
// Auth: Bearer <user access token> — REQUIRED
// Deletes: chats/messages/dates/likes/matches -> profiles -> storage -> auth.users
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("Missing Supabase secrets");

    // 1. Verify caller — who is asking to be deleted?
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Missing auth" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return new Response(JSON.stringify({ error: "Invalid session" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // 2. Require explicit confirmation — prevents accidental / CSRF deletes
    const body = await req.json().catch(() => ({}));
    if (body.confirm !== "DELETE") {
      return new Response(JSON.stringify({ error: 'Type DELETE to confirm' }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userId = user.id;

    // 3. Service-role client — bypasses RLS, can delete auth.users
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

    // 4. Delete dependent rows FIRST (order matters — FKs)
    // Adjust table / column names to YOUR schema. These cover the INTENT schema:
    // chats: user is sender OR receiver, messages: via chat_id, dates: via chat_id, likes/matches: user_id / liked_user_id
    const { data: myChats } = await admin.from("chats").select("id").or(`user_a.eq.${userId},user_b.eq.${userId},sender_id.eq.${userId},receiver_id.eq.${userId}`);
    const chatIds = (myChats || []).map((c: any) => c.id);

    if (chatIds.length > 0) {
      await admin.from("messages").delete().in("chat_id", chatIds);
      await admin.from("dates").delete().in("chat_id", chatIds);
    }
    await admin.from("chats").delete().or(`user_a.eq.${userId},user_b.eq.${userId},sender_id.eq.${userId},receiver_id.eq.${userId}`);
    await admin.from("likes").delete().or(`user_id.eq.${userId},liked_user_id.eq.${userId},liker_id.eq.${userId},liked_id.eq.${userId}`);
    await admin.from("matches").delete().or(`user_a.eq.${userId},user_b.eq.${userId},user_id.eq.${userId},matched_user_id.eq.${userId}`);

    // 5. Delete profile row + storage photos
    await admin.from("profiles").delete().eq("id", userId);
    await admin.from("profiles").delete().eq("user_id", userId);
    // If you store photos in Storage bucket "avatars" under <userId>/...
    try {
      const { data: files } = await admin.storage.from("avatars").list(userId);
      if (files?.length) {
        await admin.storage.from("avatars").remove(files.map((f: any) => `${userId}/${f.name}`));
      }
    } catch { /* bucket may not exist — ignore */ }

    // 6. Delete auth.users — LAST. This is irreversible.
    const { error: delErr } = await admin.auth.admin.deleteUser(userId);
    if (delErr) throw delErr;

    return new Response(JSON.stringify({ ok: true, deleted_user_id: userId }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("delete-account error:", e);
    return new Response(JSON.stringify({ error: e.message || "Delete failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});