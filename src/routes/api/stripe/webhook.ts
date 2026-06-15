import { createFileRoute } from "@tanstack/react-router";
import type { SubscriptionStatus } from "~/prisma-generated/enums";

/** Handles both Unix timestamps (old API) and ISO strings (new API). */
function toDate(value: unknown): Date {
  if (typeof value === "number") return new Date(value * 1000);
  if (typeof value === "string") return new Date(value);
  return new Date();
}

export const Route = createFileRoute("/api/stripe/webhook")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const { stripe } = await import("~/utils/stripe/stripe");
        const { prismaClient } = await import("~/utils/db/prisma");

        const body = await request.text();
        const signature = request.headers.get("stripe-signature");

        if (!signature) {
          return new Response(
            JSON.stringify({ error: "Missing signature" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        let event;
        try {
          event = stripe.webhooks.constructEvent(
            body,
            signature,
            process.env.NODE_ENV === "production"
              ? process.env.STRIPE_WEBHOOK_SECRET!
              : process.env.STRIPE_WEBHOOK_TEST_SECRET!
          );
        } catch (err) {
          console.error("Webhook signature verification failed:", err);
          return new Response(
            JSON.stringify({ error: "Invalid signature" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        console.log("[Stripe Webhook] Received event:", event.type);

        try {
          switch (event.type) {
            case "checkout.session.completed": {
              const session = event.data.object;
              const userId = session.metadata?.userId;
              const stripeCustomerId = session.customer as string;
              const stripeSubscriptionId = session.subscription as string;

              console.log("[Stripe Webhook] checkout.session.completed:", {
                userId,
                stripeCustomerId,
                stripeSubscriptionId,
                metadata: session.metadata,
              });

              if (!userId || !stripeSubscriptionId) {
                console.warn("[Stripe Webhook] Missing userId or subscriptionId, skipping");
                break;
              }

              const subscription =
                await stripe.subscriptions.retrieve(stripeSubscriptionId);

              const item = subscription.items.data[0];
              const periodStart = toDate(item?.current_period_start);
              const periodEnd = toDate(item?.current_period_end);

              await prismaClient.subscription.upsert({
                where: { userId },
                create: {
                  userId,
                  stripeCustomerId,
                  stripeSubscriptionId,
                  stripePriceId: item?.price.id,
                  status: "ACTIVE",
                  currentPeriodStart: periodStart,
                  currentPeriodEnd: periodEnd,
                },
                update: {
                  stripeCustomerId,
                  stripeSubscriptionId,
                  stripePriceId: item?.price.id,
                  status: "ACTIVE",
                  currentPeriodStart: periodStart,
                  currentPeriodEnd: periodEnd,
                },
              });

              await prismaClient.user.update({
                where: { id: userId },
                data: { isPremium: true },
              });
              break;
            }

            case "customer.subscription.updated": {
              const subscription = event.data.object;
              const sub = await prismaClient.subscription.findUnique({
                where: { stripeSubscriptionId: subscription.id },
              });
              if (!sub) break;

              const statusMap: Record<string, SubscriptionStatus> = {
                active: "ACTIVE",
                past_due: "PAST_DUE",
                canceled: "CANCELED",
                unpaid: "UNPAID",
                incomplete: "INCOMPLETE",
                incomplete_expired: "INCOMPLETE_EXPIRED",
                paused: "PAUSED",
              };

              const newStatus = statusMap[subscription.status] || "ACTIVE";
              const isActive =
                subscription.status === "active" ||
                subscription.status === "trialing";

              const subItem = subscription.items.data[0];
              await prismaClient.subscription.update({
                where: { stripeSubscriptionId: subscription.id },
                data: {
                  status: newStatus,
                  cancelAtPeriodEnd: subscription.cancel_at_period_end,
                  currentPeriodStart: toDate(subItem?.current_period_start),
                  currentPeriodEnd: toDate(subItem?.current_period_end),
                },
              });

              const user = await prismaClient.user.findUnique({
                where: { id: sub.userId },
                select: { premiumGranted: true, premiumExpiresAt: true },
              });

              // Only update isPremium for users without lifetime grants
              // or unexpired free trials
              if (
                !user?.premiumGranted &&
                (!user?.premiumExpiresAt || user.premiumExpiresAt < new Date())
              ) {
                await prismaClient.user.update({
                  where: { id: sub.userId },
                  data: { isPremium: isActive },
                });
              }
              break;
            }

            case "customer.subscription.deleted": {
              const subscription = event.data.object;
              const sub = await prismaClient.subscription.findUnique({
                where: { stripeSubscriptionId: subscription.id },
              });
              if (!sub) break;

              await prismaClient.subscription.update({
                where: { stripeSubscriptionId: subscription.id },
                data: { status: "CANCELED" },
              });

              const user = await prismaClient.user.findUnique({
                where: { id: sub.userId },
                select: { premiumGranted: true, premiumExpiresAt: true },
              });

              if (
                !user?.premiumGranted &&
                (!user?.premiumExpiresAt || user.premiumExpiresAt < new Date())
              ) {
                await prismaClient.user.update({
                  where: { id: sub.userId },
                  data: { isPremium: false },
                });
              }
              break;
            }

            case "invoice.payment_failed": {
              const invoice = event.data.object;
              console.warn(
                `[Stripe] Payment failed for customer ${invoice.customer}, invoice ${invoice.id}`
              );
              break;
            }
          }
        } catch (err) {
          console.error("Webhook event processing error:", err);
          return new Response(
            JSON.stringify({ error: "Event processing failed" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }

        return new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
