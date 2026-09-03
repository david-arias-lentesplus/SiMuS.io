import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Topbar from '../layout/Topbar.jsx';
import { useProcessedCampaigns } from '../../demeter/hooks/useProcessedCampaigns.js';
import { useCountriesConfig } from '../../demeter/hooks/useCountriesConfig.js';
import { useCampaignStore } from '../../minerva/store/useCampaignStore.js';
import { COUNTRIES as STATIC_COUNTRIES_FALLBACK } from '../../minerva/constants/countries.js';
import { parseCsvDate } from '../../minerva/utils/parseCsvDate.js';
import { fmtN, fmtDateShort } from '../utils/format.js';

// Hefesto — "Campañas Procesadas" (Fase 2.5, VISTA DE GESTIÓN DE
// CAMPAÑAS CARGADAS). Vista de sólo-lectura + acciones sobre
// `sms_processed_campaigns` (las campañas que Éter agrupó de un CSV de
// Workingbits, ANTES de calcular ROI — no confundir con el Histórico de
// `sms_campaigns`, que son campañas YA calculadas y guardadas).
//
// Mismo layout de "tarjeta blanca con borde sutil" que pidió la
// instrucción de Fase 2.5, tomado 1:1 de HistoryPage.jsx: la instrucción
// nombraba las clases como `border-border`/`shadow-shadow`, pero ese no
// es el nombre real de ningún token de tailwind.config.js de este
// proyecto (ver ahí — no hay color `border` ni sombra `shadow`
// definidos, solo `shadow-card`). Se usan las clases REALES que ya
// produce ese mismo look en HistoryPage.jsx: `rounded-card bg-card
// shadow-card`, con un borde sutil `border border-ink-300/40` agregado
// para cubrir literalmente el pedido de "borde sutil" sin inventar un
// token nuevo fuera de tailwind.config.js (regla de Hefesto).
//
// Datos: Deméter (`useProcessedCampaigns`, sin filtro de país — se
// listan todas). País se resuelve a una etiqueta legible puenteando
// contra `countries_config` (Supabase, fuente de verdad desde ADR 0007)
// y, si no matchea ahí, contra el catálogo estático histórico
// (`STATIC_COUNTRIES_FALLBACK`) — mismo puente que ya usa
// useCampaignCalculator.js para esta tabla.
//
// "Calcular ROI": deja el id de la campaña en
// `useCampaignStore.pendingProcessedCampaignId` y navega a /calculadora
// — useCampaignCalculator.js (Minerva) lo recoge al montar y
// preselecciona país + campaña (ver ese hook).
// "Eliminar": usa `deleteCampaign(id)` del hook de Deméter (alias de
// `remove`, agregado en esta misma fase) tras una confirmación, igual
// que HistoryPage.
//
// Fase 2.8 (2026-09-03, "ESTADOS DE CÁLCULO"): cada fila ya trae
// `isCalculated`/`calculatedCampaignId` inyectados por Deméter (ver
// processedCampaignsService.fetchProcessedCampaigns -> attachCalculatedState)
// cruzando por `campaign_name` contra `sms_campaigns`. Si `isCalculated`
// es true se muestra un badge verde "Calculado" junto al nombre y el
// botón "Calcular ROI" se REEMPLAZA por "Ver Cálculo" (navega a
// `/reporte/${calculatedCampaignId}`, la misma vista de detalle
// read-only de Fase 2.6) — evita que alguien vuelva a calcular y
// aprobar el ROI de una campaña que ya está guardada en el histórico.
export default function ProcessedCampaignsPage() {
  const { campaigns, loading, error, deleteCampaign } = useProcessedCampaigns();
  const { countries: countriesConfig } = useCountriesConfig();
  const navigate = useNavigate();
  const setPendingProcessedCampaignId = useCampaignStore((s) => s.setPendingProcessedCampaignId);
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return campaigns;
    return campaigns.filter((c) => (c.campaign_name || '').toLowerCase().includes(term));
  }, [campaigns, search]);

  function countryLabel(countryValue) {
    if (!countryValue) return 'Sin país';
    const configMatch = countriesConfig.find((c) => c.id === countryValue);
    if (configMatch) return configMatch.country_name;
    const staticMatch = STATIC_COUNTRIES_FALLBACK.find((c) => c.value === countryValue);
    if (staticMatch) return staticMatch.label;
    return countryValue;
  }

  function handleCalculateRoi(campaign) {
    setPendingProcessedCampaignId(campaign.id);
    navigate('/calculadora');
  }

  async function handleDelete(campaign) {
    if (
      !window.confirm(
        `¿Eliminar la campaña "${campaign.campaign_name}"? Esta acción no se puede deshacer — úsalo solo si el CSV se cargó por error.`
      )
    ) {
      return;
    }
    setBusyId(campaign.id);
    try {
      await deleteCampaign(campaign.id);
    } catch (e) {
      window.alert('Error al eliminar: ' + e.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <Topbar title="Campañas Procesadas" />
      <div className="mt-6 rounded-card border border-ink-300/40 bg-card p-6 shadow-card">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Buscar por nombre de campaña..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64 rounded-lg border border-ink-300/60 bg-surface px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-teal focus:outline-none"
          />
          <span className="text-xs text-ink-400">
            {campaigns.length} campaña{campaigns.length === 1 ? '' : 's'} cargada
            {campaigns.length === 1 ? '' : 's'} desde CSV
          </span>
        </div>

        {error ? (
          <p className="text-sm text-state-danger">Error al cargar campañas: {error.message}</p>
        ) : loading ? (
          <p className="text-sm text-ink-400">Cargando...</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-ink-400">
            {search
              ? 'Ninguna campaña coincide con tu búsqueda.'
              : campaigns.length === 0
              ? 'Todavía no has cargado ningún CSV — sube uno en /upload para verlo acá.'
              : 'Ninguna campaña coincide con tu búsqueda.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead>
                <tr className="border-b border-ink-300/40 text-xs uppercase tracking-wide text-ink-500">
                  <th className="py-2 pr-3">Fecha de Envío</th>
                  <th className="py-2 pr-3">Nombre de la Campaña</th>
                  <th className="py-2 pr-3">País</th>
                  <th className="py-2 pr-3">Muestra Válida</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="border-b border-ink-300/20 last:border-0">
                    <td className="py-2 pr-3 text-ink-500">
                      {fmtDateShort(parseCsvDate(c.communication_start_date || c.send_date))}
                    </td>
                    <td className="py-2 pr-3">
                      <span className="font-medium text-ink-900">{c.campaign_name}</span>
                      {c.isCalculated ? (
                        <span className="ml-2 rounded-full bg-state-success/10 px-2 py-0.5 text-xs font-medium text-state-success">
                          Calculado
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2 pr-3">
                      <span className="rounded-full bg-blue-deep/10 px-2 py-0.5 text-xs text-blue-deep">
                        {countryLabel(c.country_value)}
                      </span>
                    </td>
                    <td className="py-2 pr-3 tabular-nums">{fmtN(c.muestra_entregados)}</td>
                    <td className="py-2 text-right">
                      <div className="flex justify-end gap-2">
                        {c.isCalculated ? (
                          <button
                            type="button"
                            onClick={() => navigate(`/reporte/${c.calculatedCampaignId}`)}
                            className="rounded-lg border border-brand-teal/40 px-2 py-1 text-xs font-medium text-brand-teal hover:bg-brand-teal/10"
                          >
                            Ver Cálculo
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleCalculateRoi(c)}
                            className="rounded-lg border border-brand-teal/40 px-2 py-1 text-xs font-medium text-brand-teal hover:bg-brand-teal/10"
                          >
                            Calcular ROI
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDelete(c)}
                          disabled={busyId === c.id}
                          title="Eliminar"
                          className="rounded-lg px-2 py-1 text-xs text-state-danger hover:bg-state-danger/10 disabled:opacity-40"
                        >
                          {busyId === c.id ? '...' : <TrashIcon />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}
