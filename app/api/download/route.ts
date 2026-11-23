import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  const { assetId, userId, storagePath, filename } = await req.json();

  if (!assetId || !userId || !storagePath) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 1. Verify the user owns/unlocked this asset in public.unlocks
  const { data: unlock, error: unlockError } = await supabaseAdmin
    .from("unlocks")
    .select("id")
    .eq("user_id", userId)
    .eq("asset_id", assetId)
    .maybeSingle();

  if (unlockError || !unlock) {
    return NextResponse.json({ error: "Asset not unlocked" }, { status: 403 });
  }

  // 2. Generate a 60-second signed download URL from the "Presets" bucket
  const { data, error } = await supabaseAdmin.storage
    .from("Presets")
    .createSignedUrl(storagePath, 60, { download: filename || true });

  if (error || !data?.signedUrl) {
    return NextResponse.json(
      { error: error?.message || "Preset file not found in storage" },
      { status: 404 }
    );
  }

  return NextResponse.json({ url: data.signedUrl });
}
