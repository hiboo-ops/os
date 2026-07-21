'use client'

import { EodFormShell, EodSection, EodField } from '@/components/eod'

export default function SetterEodPage() {
  return (
    <EodFormShell roleType="SETTER" title="Setter EOD">
      {({ answers, onChange }) => (
        <>
          {/* Activiteit */}
          <EodSection title="Activiteit">
            <EodField
              type="number" label="Nieuwe outbounds gestuurd"
              sectionKey="activiteit" fieldKey="nieuwe_outbounds"
              value={answers.activiteit?.nieuwe_outbounds} onChange={onChange}
            />
            <EodField
              type="number" label="Follow-ups gestuurd"
              sectionKey="activiteit" fieldKey="follow_ups"
              value={answers.activiteit?.follow_ups} onChange={onChange}
            />
            <EodField
              type="number" label="Oude leads opnieuw opgepakt"
              sectionKey="activiteit" fieldKey="oude_leads_opgepakt"
              value={answers.activiteit?.oude_leads_opgepakt} onChange={onChange}
            />
            <EodField
              type="number" label="Nieuwe volgers uit Ads vandaag"
              sectionKey="activiteit" fieldKey="nieuwe_volgers_ads"
              value={answers.activiteit?.nieuwe_volgers_ads} onChange={onChange}
            />
            <EodField
              type="number" label="Ads-volgers voor het eerst bericht"
              sectionKey="activiteit" fieldKey="ads_volgers_bericht"
              value={answers.activiteit?.ads_volgers_bericht} onChange={onChange}
            />
          </EodSection>

          {/* Conversies in DM */}
          <EodSection title="Conversies in DM">
            <EodField
              type="number" label="Inbound gesprekken gestart"
              sectionKey="conversies" fieldKey="inbound_gesprekken"
              value={answers.conversies?.inbound_gesprekken} onChange={onChange}
            />
            <EodField
              type="number" label="Replies op outbound"
              sectionKey="conversies" fieldKey="replies_outbound"
              value={answers.conversies?.replies_outbound} onChange={onChange}
            />
            <EodField
              type="number" label="Positieve reacties"
              sectionKey="conversies" fieldKey="positieve_reacties"
              value={answers.conversies?.positieve_reacties} onChange={onChange}
            />
            <EodField
              type="number" label="Leads gekwalificeerd (ICP)"
              sectionKey="conversies" fieldKey="leads_gekwalificeerd"
              value={answers.conversies?.leads_gekwalificeerd} onChange={onChange}
            />
          </EodSection>

          {/* Calls */}
          <EodSection title="Calls">
            <EodField
              type="number" label="Calls voorgesteld"
              sectionKey="calls" fieldKey="calls_voorgesteld"
              value={answers.calls?.calls_voorgesteld} onChange={onChange}
            />
            <EodField
              type="number" label="Calendly links gestuurd"
              sectionKey="calls" fieldKey="calendly_links_gestuurd"
              value={answers.calls?.calendly_links_gestuurd} onChange={onChange}
            />
            <EodField
              type="number" label="Calls geboekt (Inbound)"
              sectionKey="calls" fieldKey="calls_geboekt_inbound"
              value={answers.calls?.calls_geboekt_inbound} onChange={onChange}
            />
            <EodField
              type="number" label="Calls geboekt (Outbound)"
              sectionKey="calls" fieldKey="calls_geboekt_outbound"
              value={answers.calls?.calls_geboekt_outbound} onChange={onChange}
            />
          </EodSection>

          {/* CRM & Taken */}
          <EodSection title="CRM & Taken">
            <EodField
              type="radio" label="CRM volledig bijgewerkt?"
              sectionKey="crm" fieldKey="crm_bijgewerkt"
              value={answers.crm?.crm_bijgewerkt} onChange={onChange}
            />
            <EodField
              type="radio" label="Alle taken afgevinkt?"
              sectionKey="crm" fieldKey="taken_afgevinkt"
              value={answers.crm?.taken_afgevinkt} onChange={onChange}
            />
            <div className="sm:col-span-2">
              <EodField
                type="textarea" label="Zo niet: wat en waarom?"
                sectionKey="crm" fieldKey="toelichting"
                value={answers.crm?.toelichting} onChange={onChange}
                placeholder="Optioneel — licht toe als iets niet af is"
                rows={2}
              />
            </div>
          </EodSection>

          {/* Reflectie */}
          <EodSection title="Reflectie">
            <div className="sm:col-span-2">
              <EodField
                type="textarea" label="Wat ging goed?"
                sectionKey="reflectie" fieldKey="wat_ging_goed"
                value={answers.reflectie?.wat_ging_goed} onChange={onChange}
                rows={2}
              />
            </div>
            <div className="sm:col-span-2">
              <EodField
                type="textarea" label="Waar hulp bij nodig?"
                sectionKey="reflectie" fieldKey="hulp_nodig"
                value={answers.reflectie?.hulp_nodig} onChange={onChange}
                rows={2}
              />
            </div>
            <div className="sm:col-span-2">
              <EodField
                type="text" label="Grootste les in een zin?"
                sectionKey="reflectie" fieldKey="grootste_les"
                value={answers.reflectie?.grootste_les} onChange={onChange}
                placeholder="Bijv. 'Sneller opvolgen = meer conversies'"
              />
            </div>
          </EodSection>
        </>
      )}
    </EodFormShell>
  )
}
