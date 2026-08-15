import Stripe from "stripe";
const stripe = new Stripe(process.env.NODE_ENV === "production" ? process.env.STRIPE_SECRET_KEY : process.env.STRIPE_SECRET_TEST_KEY, {
  typescript: true
});
export {
  stripe
};
