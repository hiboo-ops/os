import twilio from 'twilio'

let client: ReturnType<typeof twilio> | null = null

// Lazy zodat de build niet faalt zonder env vars.
export function getTwilioClient() {
  if (!client) {
    client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!)
  }
  return client
}

export function twilioCallerId(): string {
  return process.env.TWILIO_CALLER_ID!
}

export function appUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_APP_URL}${path}`
}

// Valideert X-Twilio-Signature. De URL wordt uit NEXT_PUBLIC_APP_URL opgebouwd
// (niet uit req.url) omdat de Vercel-proxy host/proto herschrijft. Webhook-URLs
// moeten daarom query-vrij blijven; context gaat via POST-params.
export async function validateTwilioRequest(
  req: Request,
  path: string
): Promise<URLSearchParams | null> {
  const signature = req.headers.get('x-twilio-signature') ?? ''
  const body = new URLSearchParams(await req.text())
  const params: Record<string, string> = {}
  body.forEach((value, key) => { params[key] = value })
  const valid = twilio.validateRequest(
    process.env.TWILIO_AUTH_TOKEN!,
    signature,
    appUrl(path),
    params
  )
  return valid ? body : null
}

export function twimlResponse(xml: string): Response {
  return new Response(xml, { headers: { 'Content-Type': 'text/xml' } })
}

export const emptyTwiml = '<?xml version="1.0" encoding="UTF-8"?><Response/>'
