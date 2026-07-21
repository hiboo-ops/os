/**
 * Pay-link generation stubs.
 * De echte Stripe/Whop-integratie komt via de Integrations-tab (andere terminal).
 * Dit bestand zet alvast de structuur klaar met metadata.incoming_payment_id.
 */

export interface PayLinkResult {
  url: string
  provider: 'stripe' | 'whop' | 'stub'
}

/**
 * Genereer een betaallink voor een incoming_payment.
 * Nu: stub die een placeholder-URL teruggeeft met pay_token.
 * Later: Stripe Checkout Session of Whop Payment Link met metadata.incoming_payment_id.
 */
export function generatePayLink(incomingPaymentId: string, payToken: string, amount: number): PayLinkResult {
  // Stub — wordt vervangen zodra Stripe/Whop keys beschikbaar zijn
  return {
    url: `[PLACEHOLDER]/pay/${payToken}?ip=${incomingPaymentId}&amount=${amount}`,
    provider: 'stub',
  }
}

/**
 * Genereer een Stripe Checkout link.
 * Gated op STRIPE_SECRET_KEY env var.
 */
export async function generateStripePayLink(
  _incomingPaymentId: string,
  _payToken: string,
  _amount: number,
  _email?: string,
): Promise<PayLinkResult | null> {
  if (!process.env.STRIPE_SECRET_KEY) return null
  // TODO: implementeer Stripe Checkout Session aanmaken
  // metadata: { incoming_payment_id: _incomingPaymentId, pay_token: _payToken }
  return null
}

/**
 * Genereer een Whop betaallink.
 * Gated op WHOP_API_KEY env var.
 */
export async function generateWhopPayLink(
  _incomingPaymentId: string,
  _payToken: string,
  _amount: number,
): Promise<PayLinkResult | null> {
  if (!process.env.WHOP_API_KEY) return null
  // TODO: implementeer Whop Payment Link aanmaken
  // metadata: { incoming_payment_id: _incomingPaymentId, pay_token: _payToken }
  return null
}
