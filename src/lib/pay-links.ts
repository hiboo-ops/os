/**
 * Pay-link generation.
 * Whop-checkout wordt gated op env (WHOP_API_KEY + WHOP_COMPANY_ID + WHOP_PRODUCT_ID).
 * Zonder keys → PENDING (closer valt terug op handmatige link). MANUAL = handmatig
 * geplakte link (afgehandeld in de payment-links route, niet hier).
 */

export type PayProvider = 'WHOP' | 'MANUAL'

export interface PayLinkResult {
  url: string | null
  provider: PayProvider | 'PENDING'
}

/**
 * Genereer een betaallink voor een incoming_payment.
 * Alleen WHOP genereert hier echt; MANUAL/onbekend → geen url.
 */
export async function generatePayLink(
  provider: PayProvider,
  incomingPaymentId: string,
  payToken: string,
  amount: number,
  email?: string | null,
): Promise<PayLinkResult> {
  if (provider === 'WHOP') {
    const result = await generateWhopPayLink(incomingPaymentId, payToken, amount, email)
    if (result) return result
    return { url: null, provider: 'PENDING' }
  }
  // MANUAL of onbekend → geen gegenereerde url
  return { url: null, provider: 'MANUAL' }
}

/**
 * Whop one-time checkout met dynamisch bedrag.
 * Maakt een plan op basis van het (ene) Whop-product met initial_price = bedrag,
 * hangt metadata.incoming_payment_id eraan (voor webhook-matching) en geeft de
 * gehoste purchase_url terug. Gated op env; retourneert null bij ontbrekende
 * config of API-fout (dan valt de route terug op PENDING).
 */
async function generateWhopPayLink(
  incomingPaymentId: string,
  payToken: string,
  amount: number,
  _email?: string | null,
): Promise<PayLinkResult | null> {
  const apiKey = process.env.WHOP_API_KEY
  const companyId = process.env.WHOP_COMPANY_ID
  const productId = process.env.WHOP_PRODUCT_ID
  if (!apiKey || !companyId || !productId) return null

  try {
    const res = await fetch('https://api.whop.com/api/v2/plans', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        company_id: companyId,
        product_id: productId,
        plan_type: 'one_time',
        base_currency: 'eur',
        currency: 'eur',
        initial_price: amount,
        visibility: 'quick_link',
        unlimited_stock: true,
        metadata: {
          incoming_payment_id: incomingPaymentId,
          pay_token: payToken,
        },
      }),
    })

    const data = await res.json().catch(() => ({} as Record<string, unknown>))
    if (!res.ok) {
      console.error('Whop plan-creatie mislukt:', res.status, data)
      return null
    }
    console.log('[whop] plan aangemaakt:', {
      id: (data as { id?: string }).id,
      base_currency: (data as { base_currency?: string }).base_currency,
      initial_price: (data as { initial_price?: unknown }).initial_price,
    })

    const url =
      (data as { purchase_url?: string }).purchase_url ||
      ((data as { id?: string }).id ? `https://whop.com/checkout/${(data as { id: string }).id}` : null)

    if (!url) {
      console.error('Whop: geen purchase_url in response', data)
      return null
    }

    return { url, provider: 'WHOP' }
  } catch (err) {
    console.error('Whop link-generatie error:', err)
    return null
  }
}
