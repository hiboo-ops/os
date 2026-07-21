/**
 * Pay-link generation.
 * Stripe/Whop sessies zijn gated op env — zonder keys krijg je een pending-status.
 * De echte SDK-integratie komt via de Integrations-tab (andere terminal).
 */

export type PayProvider = 'STRIPE' | 'WHOP' | 'MANUAL'

export interface PayLinkResult {
  url: string | null
  provider: PayProvider | 'PENDING'
}

/**
 * Genereer een betaallink voor een incoming_payment.
 * Probeert Stripe of Whop (gated op env) — valt terug op PENDING.
 */
export async function generatePayLink(
  provider: PayProvider,
  incomingPaymentId: string,
  payToken: string,
  amount: number,
  email?: string | null,
): Promise<PayLinkResult> {
  if (provider === 'MANUAL') {
    return { url: null, provider: 'MANUAL' }
  }

  if (provider === 'STRIPE') {
    const result = await generateStripePayLink(incomingPaymentId, payToken, amount, email || undefined)
    if (result) return result
  }

  if (provider === 'WHOP') {
    const result = await generateWhopPayLink(incomingPaymentId, payToken, amount)
    if (result) return result
  }

  // Geen keys beschikbaar → pending
  return { url: null, provider: 'PENDING' }
}

/**
 * Genereer een Stripe Checkout link.
 * Gated op STRIPE_SECRET_KEY env var.
 */
async function generateStripePayLink(
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
async function generateWhopPayLink(
  _incomingPaymentId: string,
  _payToken: string,
  _amount: number,
): Promise<PayLinkResult | null> {
  if (!process.env.WHOP_API_KEY) return null
  // TODO: implementeer Whop Payment Link aanmaken
  // metadata: { incoming_payment_id: _incomingPaymentId, pay_token: _payToken }
  return null
}
