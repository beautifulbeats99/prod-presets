import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CREDITS_BY_PRICE: Record<string, { credits: number; plan: "monthly" | "annual" }> = {
  [process.env.STRIPE_PRICE_MONTHLY || ""]: { credits: 100, plan: "monthly" },
  [process.env.STRIPE_PRICE_ANNUAL || ""]: { credits: 1200, plan: "annual" },
};

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    if (event.type === "invoice.paid") {
      const invoice = event.data.object as Stripe.Invoice;
      const lineItem = invoice.lines.data[0];
      const priceId =
        (lineItem?.pricing?.price_details?.price as string | undefined) ||
        (lineItem as unknown as { price?: { id?: string } })?.price?.id;

      const grantInfo = priceId ? CREDITS_BY_PRICE[priceId] : undefined;
      const customerId =
        typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id || null;

      const subRef =
        (invoice.parent?.subscription_details?.subscription as string | undefined) ||
        (invoice as unknown as { subscription?: string }).subscription;

      let userId: string | undefined;
      let periodEndIso: string | null = null;

      if (subRef) {
        const sub = await stripe.subscriptions.retrieve(subRef);
        userId = sub.metadata?.user_id;
        const periodEndSec = sub.items.data[0]?.current_period_end;
        if (periodEndSec) {
          periodEndIso = new Date(periodEndSec * 1000).toISOString();
        }
      }

      if (userId && grantInfo && invoice.id) {
        const { error } = await supabaseAdmin.rpc("grant_subscription_credits", {
          p_invoice_id: invoice.id,
          p_user_id: userId,
          p_credits: grantInfo.credits,
          p_plan: grantInfo.plan,
          p_customer_id: customerId,
          p_period_end: periodEndIso,
        });
        if (error) {
          console.error("Failed to grant subscription credits:", error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
      }
    }

    if (
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata?.user_id;
      const periodEndSec = sub.items.data[0]?.current_period_end;

      if (userId) {
        await supabaseAdmin
          .from("profiles")
          .update({
            subscription_status: sub.status,
            current_period_end: periodEndSec ? new Date(periodEndSec * 1000).toISOString() : null,
          })
          .eq("id", userId);
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Webhook handler error:", err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
