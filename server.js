import express from "express";
import cors from "cors";
import Stripe from "stripe";

const app = express();
app.use(cors({ origin: "*" }));

// Webhook route must be raw
app.post("/stripe-webhook", express.raw({ type: "application/json" }), (req, res) => {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const sig = req.headers["stripe-signature"];

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const orderId = session.metadata?.orderId;
    if (orderId && orders.has(orderId)) {
      const order = orders.get(orderId);
      order.status = "PAID";
      orders.set(orderId, order);
    }
  }

  res.json({ received: true });
});

app.use(express.json());

// TEMP storage for testing
const orders = new Map();

function makeOrderId() {
  return "order_" + Math.random().toString(36).slice(2, 10);
}

// Replace with your Stripe PRICE ID later
const PRICE_MAP = {
  coins_500: "REPLACE_WITH_PRICE_ID"
};

app.get("/ping", (req, res) => res.send("pong"));

app.post("/create-checkout", async (req, res) => {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const { userId, productId } = req.body;

  const price = PRICE_MAP[productId];
  if (!price) return res.status(400).json({ error: "Invalid productId" });

  const orderId = makeOrderId();
  orders.set(orderId, { status: "PENDING", userId, productId });

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{ price, quantity: 1 }],
    success_url: "https://example.com/success",
    cancel_url: "https://example.com/cancel",
    metadata: { orderId }
  });

  res.json({ orderId, checkoutUrl: session.url });
});

app.get("/order-status", (req, res) => {
  const order = orders.get(String(req.query.orderId || ""));
  if (!order) return res.json({ status: "UNKNOWN" });
  res.json({ status: order.status });
});

app.listen(process.env.PORT || 3000, () => console.log("Server running"));