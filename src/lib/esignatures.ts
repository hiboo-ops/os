/**
 * esignatures.io integratie — gated op ESIGNATURES_SECRET_TOKEN.
 * Zonder token wordt de call overgeslagen (contract blijft PENDING_CONFIG).
 */

interface CreateContractInput {
  title: string
  signer: {
    name: string
    email: string
    mobile?: string
  }
  placeholderFields: Record<string, string>
}

interface EsignResponse {
  data: {
    contract: {
      id: string
      status: string
      title: string
    }
  }
}

export async function createEsignContract(input: CreateContractInput): Promise<{
  esign_contract_id: string
  esign_status: string
} | null> {
  const token = process.env.ESIGNATURES_SECRET_TOKEN
  const templateId = process.env.ESIGNATURES_TEMPLATE_ID

  if (!token || !templateId) {
    console.log('[esignatures] Geen token/template_id — overslaan')
    return null
  }

  const placeholderFields = Object.entries(input.placeholderFields).map(
    ([placeholder_key, replace_with_text]) => ({
      api_key: placeholder_key,
      value: replace_with_text,
    }),
  )

  const body = {
    template_id: templateId,
    title: input.title,
    signers: [
      {
        name: input.signer.name,
        email: input.signer.email,
        mobile: input.signer.mobile || '',
      },
    ],
    placeholder_fields: placeholderFields,
  }

  const res = await fetch('https://esignatures.com/api/contracts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(token + ':').toString('base64')}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    console.error('[esignatures] API error:', res.status, text)
    return null
  }

  const json = (await res.json()) as EsignResponse

  return {
    esign_contract_id: json.data.contract.id,
    esign_status: 'SENT',
  }
}
