import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/server-clients";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${(err as Error).message}` },
      { status: 400 }
    );
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId || session.client_reference_id;
    const creditsToAdd = Number(session.metadata?.credits || 0);

    if (userId && creditsToAdd > 0) {
      const { error: txError } = await supabaseAdmin
        .from("credit_transactions")
        .insert({
          user_id: userId,
          label: `Purchased ${creditsToAdd} Credits via Stripe`,
          delta: creditsToAdd,
          stripe_event_id: event.id,
        });

      if (!txError) {
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("credits")
          .eq("id", userId)
          .single();

        if (profile) {
          await supabaseAdmin
            .from("profiles")
            .update({
              credits: profile.credits + creditsToAdd,
              stripe_customer_id: (session.customer as string) ?? null,
            })
            .eq("id", userId);
        }
      }
    }
  }

  return NextResponse.json({ received: true });
}
