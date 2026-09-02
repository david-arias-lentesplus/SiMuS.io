import { useMemo } from 'react';
import { useSmsCampaigns } from '../../demeter/hooks/useSmsCampaigns.js';
import { useCampaignStore } from '../store/useCampaignStore.js';

const RANGE_TO_DAYS = { today: 1, '7d': 7, '30d': 30, '90d': 90, all: null };

/**
 * Hook de "organización" de Minerva: combina los datos crudos de Deméter
 * con el estado de filtros/orden de Minerva. Es lo único que Hefesto debe
 * consumir para pintar el dashboard/histórico — nunca useSmsCampaigns()
 * directamente, para que la UI no tenga que conocer cómo se filtra/ordena.
 */
export function useFilteredCampaigns() {
  const { campaigns, loading, error, reload, save, remove, removeAll } =
    useSmsCampaigns();
  const filters = useCampaignStore((s) => s.filters);
  const sort = useCampaignStore((s) => s.sort);

  const filtered = useMemo(() => {
    const days = RANGE_TO_DAYS[filters.dateRange];
    const cutoff = days ? Date.now() - days * 24 * 60 * 60 * 1000 : null;
    const q = filters.search.trim().toLowerCase();

    let rows = campaigns.filter((c) => {
      if (cutoff && new Date(c.created_at).getTime() < cutoff) return false;
      if (filters.country !== 'all' && c.country !== filters.country) return false;
      if (q && !(`${c.campaign_name} ${c.country}`.toLowerCase().includes(q))) {
        return false;
      }
      return true;
    });

    rows = [...rows].sort((a, b) => {
      let va = a[sort.col];
      let vb = b[sort.col];
      if (va == null) va = '';
      if (vb == null) vb = '';
      if (typeof va === 'string') {
        va = va.toLowerCase();
        vb = vb.toLowerCase();
      }
      if (va < vb) return sort.asc ? -1 : 1;
      if (va > vb) return sort.asc ? 1 : -1;
      return 0;
    });

    return rows;
  }, [campaigns, filters, sort]);

  const stats = useMemo(() => {
    const n = filtered.length;
    if (n === 0) return { total: 0, roiAvg: null, roiBest: null, countries: 0 };
    const rois = filtered.map((r) => r.roi_real * 100);
    const roiAvg = rois.reduce((a, b) => a + b, 0) / n;
    const roiBest = Math.max(...rois);
    const countries = new Set(filtered.map((r) => r.country)).size;
    return { total: n, roiAvg, roiBest, countries };
  }, [filtered]);

  return { campaigns: filtered, stats, loading, error, reload, save, remove, removeAll };
}
