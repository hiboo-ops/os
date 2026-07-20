# Twilio Belsysteem — Setup

Eenmalige setup voor het triage-belsysteem (in-browser dialer + opnames + AI-samenvattingen).

## 1. Twilio Console (eenmalig)

1. **Account + NL nummer**
   - Maak een account op [twilio.com](https://www.twilio.com) (of gebruik bestaand).
   - **Regulatory bundle (verplicht voor NL nummers!)**: Console → Phone Numbers → Regulatory Compliance → nieuwe bundle aanmaken met KvK-uittreksel + NL bedrijfsadres. Goedkeuring duurt enkele dagen — start hier direct mee.
   - Na goedkeuring: Phone Numbers → Buy a Number → Nederland → koop een nummer (~€5/mnd). Dit wordt de caller ID.

2. **API Key**
   - Console → Account → API keys & tokens → Create API key (Standard).
   - Noteer de **SID (SK...)** en **Secret** (wordt maar één keer getoond).

3. **TwiML App**
   - Console → Voice → TwiML Apps → Create new TwiML App.
   - Voice Request URL: `https://<productie-url>/api/twilio/voice` (POST).
   - Noteer de **TwiML App SID (AP...)**.

4. **Geo Permissions**
   - Console → Voice → Settings → Geo Permissions → Nederland aanzetten (en evt. andere landen waar leads zitten).

## 2. Environment variables (Vercel + .env.local)

```
TWILIO_ACCOUNT_SID=ACxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxx            # Console → Account Info (voor webhook-signaturen + opname-download)
TWILIO_API_KEY_SID=SKxxxxxxxx
TWILIO_API_KEY_SECRET=xxxxxxxx
TWILIO_TWIML_APP_SID=APxxxxxxxx
TWILIO_CALLER_ID=+3197xxxxxxxx        # het gekochte NL nummer, E.164-formaat
NEXT_PUBLIC_APP_URL=https://<productie-url>   # exact gelijk aan de URL in de TwiML App, geen trailing slash!
SUPABASE_SERVICE_ROLE_KEY=eyJ...      # Supabase → Settings → API → service_role key
OPENAI_API_KEY=sk-...                 # Whisper transcriptie (Nederlands)
ANTHROPIC_API_KEY=sk-ant-...          # Claude samenvattingen
```

**Let op:** `NEXT_PUBLIC_APP_URL` moet byte-voor-byte gelijk zijn aan de URL die in de Twilio Console staat — de webhook-signature-validatie faalt anders (403 op alle webhooks).

## 3. Hoe het werkt

- **Bel-knop** (Call Queue / Kanban / lead-detail) → belt direct via de browser (headset) of via mobiel (afhankelijk van Belvoorkeuren, tandwiel-icoon rechtsboven op de Leads-pagina).
- **Speed-to-lead** (`first_called_at`, `time_to_call_minutes`, `sla_met`) wordt automatisch server-side gezet op het moment van bellen.
- **Opname** start pas als de lead opneemt (dual-channel). Na afloop: transcriptie via Whisper (NL) → samenvatting via Claude → zichtbaar onder "Gesprekken" in de lead-detail.
- **Mobiel-modus**: Twilio belt eerst de setter op diens mobiele nummer, verbindt daarna de lead. Caller ID richting de lead is altijd het NL-nummer.
- Na ophangen opent automatisch het log-modal om de uitkomst vast te leggen (attempt/stage blijft een handmatige keuze — opgenomen ≠ zinvol gesprek).

## 4. Testen (fasegewijs)

1. Zet alleen de env vars, bel je eigen nummer vanaf het board → check dat je telefoon rinkelt met het NL caller ID en dat `triage_calls` een rij krijgt met status `initiated → ringing → in-progress → completed`.
2. Check dat `first_called_at`/`sla_met` alleen bij de éérste poging worden gezet en dat de SLA-KPI's op het board kloppen.
3. Neem op, praat Nederlands, hang op → opname afspeelbaar in lead-detail, samenvatting binnen ~1 min.
4. Zet Belvoorkeuren op "mobiel" met je 06-nummer → je wordt eerst zelf gebeld, daarna de lead.
5. Security-check: `curl -X POST https://<url>/api/twilio/voice` zonder signature → 403.

## AVG

Gesprekken worden opgenomen. Zorg dat de lead dit weet: laat het team het mondeling melden, of voeg een `<Say language="nl-NL">`-aankondiging toe vóór de `<Dial>` in `src/app/api/twilio/voice/route.ts`.
