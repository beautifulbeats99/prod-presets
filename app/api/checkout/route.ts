import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createServerSupabase } from "@/lib/server-clients";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const BUNDLES: Record<number, { name: string; amountCents: number }> = {
  50: { name: "VirtualPresets 50 Credits (Starter)", amountCents: 999 },
  100: { name: "VirtualPresets 100 Credits (Most Popular)", amountCents: 1799 },
  250: { name: "VirtualPresets 250 Credits (Studio Pro)", amountCents: 3999 },
};

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Please sign in first" }, { status: 401 });
  }

  const { credits } = await req.json();
  const bundle = BUNDLES[Number(credits)];
  if (!bundle) {
    return NextResponse.json({ error: "Invalid credit bundle" }, { status: 400 });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: user.email,
    client_reference_id: user.id,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: bundle.name,
            description: "Instant credit top-up • Credits never expire",
          },
          unit_amount: bundle.amountCents,
        },
        quantity: 1,
      },
    ],
    metadata: {
      userId: user.id,
      credits: String(credits),
    },
    success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/?checkout=success`,
    cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/?checkout=canceled`,
  });

  return NextResponse.json({ url: session.url });
}
