import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createServerSupabase } from "@/lib/server-clients";

const BUNDLES: Record<number, { amountCents: number; name: string }> = {
  50: { amountCents: 999, name: "VirtualPresets 50 Credits Bundle" },
  100: { amountCents: 1799, name: "VirtualPresets 100 Credits Bundle" },
  250: { amountCents: 3999, name: "VirtualPresets 250 Credits Bundle" },
};

export async function POST(req: Request) {
  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
    }

    const body = await req.json();
    const credits = Number(body.credits);
    const bundle = BUNDLES[credits];

    if (!bundle) {
      return NextResponse.json({ error: "Invalid credit bundle." }, { status: 400 });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2026-11-18.endive" as Stripe.LatestApiVersion,
    });
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://prod-presets.vercel.app";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      client_reference_id: user.id,
      customer_email: user.email,
      metadata: {
        user_id: user.id,
        credits: String(credits),
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: bundle.amountCents,
            product_data: {
              name: bundle.name,
              description: `${credits} Studio Credits for samples & synth presets`,
              tax_code: "txcd_10401100",
            },
          },
        },
      ],
      success_url: `${siteUrl}/?checkout=success`,
      cancel_url: `${siteUrl}/?checkout=canceled`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create Stripe session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
