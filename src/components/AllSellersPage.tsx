import { useEffect, useMemo, useState } from "react";
import { sellerApi, profileApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Header } from "./Header";
import { ArrowLeft, Users, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";

  interface Seller {
  id: string;
  name: string;
  mobile: string;
  serial_number: string;
  address: string;
  date: string;
  amount: number;
  kg: number;
}
export const AllSellersPage = () => {
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [dailyPurchases, setDailyPurchases] = useState<Array<{seller: Seller; kg: number; lw?: number; amount: number; date: string; flower?: string; salesman_name?: string; txn_id?: string; latest_contact?: string}>>([]);
  const [dailySales, setDailySales] = useState<Array<{seller: Seller; kg: number; amount: number; date: string; customer?: string}>>([]);
  const [showResults, setShowResults] = useState(false);
  const [debugView, setDebugView] = useState(false);
  const navigate = useNavigate();

  // Load all sellers on mount
  useEffect(() => {
    fetchAllSellers();
  }, []);

  // Helper: normalize any input date string/value to local YYYY-MM-DD (calendar day, no TZ shifts)
  const toLocalYMD = (v: any) => {
    const s = String(v || '').trim();
    if (!s) return '';
    // If ISO with time: YYYY-MM-DDT... -> parse as Date and take LOCAL calendar day
    if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
      const d = new Date(s);
      if (!isNaN(d.getTime())) {
        const yy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yy}-${mm}-${dd}`;
      }
    }
    // Plain ISO date without time -> keep literal
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    // DMY -> convert
    const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) { const [, dd, mm, yyyy] = m; return `${yyyy}-${mm}-${dd}`; }
    // Fallback Date parse, output local calendar day
    const d = new Date(s);
    if (isNaN(d.getTime())) return '';
    const yy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
  };

  // Load per-date transactions when a date is chosen
  useEffect(() => {
    const loadDaily = async () => {
      if (!selectedDate) { setDailyPurchases([]); setDailySales([]); return; }
      const targetYMD = toLocalYMD(selectedDate);
      const isSameDay = (d: string) => toLocalYMD(d) === targetYMD;
      const purchases: Array<{seller: Seller; kg: number; lw?: number; amount: number; date: string; flower?: string; salesman_name?: string; txn_id?: string; latest_contact?: string}> = [];
      const sales: Array<{seller: Seller; kg: number; amount: number; date: string; customer?: string}> = [];
      try {
        await Promise.all(sellers.map(async (s) => {
          try {
            const txns = await sellerApi.getTransactions(s.id);
            txns
              .filter(t => isSameDay((t as any).transaction_date || (t as any).created_at))
              .forEach(t => purchases.push({ seller: s, kg: Number(t.kg_added||0), lw: Number(t.less_weight||0), amount: Number(t.amount_added||0), date: (t as any).transaction_date || (t as any).created_at, flower: (t as any).flower_name || '', salesman_name: (t as any).salesman_name || '', txn_id: (t as any).id }));
          } catch {}
          try {
            const so = await sellerApi.getSoldToTransactions(s.id);
            so
              .filter(t => isSameDay((t as any).sale_date || (t as any).created_at))
              .forEach(t => sales.push({ seller: s, kg: Number(t.kg_sold||0), amount: Number(t.amount_sold||0), date: (t as any).sale_date || (t as any).created_at, customer: (t as any).customer_name }));
          } catch {}
          // Fetch latest sale_to contact as an additional fallback for Sold To
          try {
            const contacts = await sellerApi.getSaleToContacts(s.id);
            const latest = (contacts || [])[0];
            if (latest) {
              // attach to all purchases for this seller for quick fallback
              for (let i = 0; i < purchases.length; i++) {
                if (purchases[i].seller.id === s.id) {
                  purchases[i] = { ...purchases[i], latest_contact: String(latest.name || latest.customer_name || '').trim() } as any;
                }
              }
            }
          } catch {}
        }));
      } finally {
        purchases.sort((a,b) => (a.seller.serial_number||'').localeCompare(b.seller.serial_number||''));
        sales.sort((a,b) => (a.seller.serial_number||'').localeCompare(b.seller.serial_number||''));
        setDailyPurchases(purchases);
        setDailySales(sales);
      }
    };
    loadDaily();
  }, [selectedDate, sellers]);

  const fetchAllSellers = async () => {
    setLoading(true);
    try {
      const data = await sellerApi.getAll();
      setSellers(data);
      toast.success(`Loaded ${data.length} seller(s)`);
    } catch (error: any) {
      toast.error(error.message || "Failed to load sellers");
    } finally {
      setLoading(false);
    }
  };

  const handleAnalytics = () => {
    if (sellers.length === 0) {
      toast.info("No sellers to analyze");
      return;
    }
    setIsAnalyticsOpen(true);
  };

  const handleSearchDate = () => {
    if (!selectedDate) {
      toast.error('Select a date to view data');
      return;
    }
    setShowResults(true);
  };

  const totalAmount = sellers.reduce((sum, seller) => sum + Number(seller.amount), 0);
  const totalKg = sellers.reduce((sum, seller) => sum + Number(seller.kg), 0);

  // Totals shown in Summary Cards
  const shownTotals = useMemo(() => {
    if (selectedDate && showResults) {
      const amt = dailyPurchases.reduce((s, p) => s + Number(p.amount || 0), 0);
      const kg = dailyPurchases.reduce((s, p) => s + Number(p.kg || 0), 0);
      return { amount: amt, kg };
    }
    return { amount: totalAmount, kg: totalKg };
  }, [selectedDate, showResults, dailyPurchases, totalAmount, totalKg]);

  const filteredSellers = selectedDate
    ? sellers.filter((s) => {
        const hasPurchase = dailyPurchases.some((p) => p.seller.id === s.id);
        const hasSale = dailySales.some((d) => d.seller.id === s.id);
        return hasPurchase || hasSale;
      })
    : sellers;

  const handleDownloadPdf = async () => {
    const titleDate = selectedDate ? new Date(selectedDate).toLocaleDateString() : 'All Dates';

    // If a date is selected, export only those day's transactions (not cumulative totals)
    let content = '';
    if (selectedDate) {
      const purchaseRows = dailyPurchases.map((p, i) => {
        const soldTo = (() => {
          const assigned = (p.salesman_name || '').trim();
          if (assigned) return assigned;
          const ds = dailySales.filter(d => d.seller.id === p.seller.id);
          if (ds.length > 0) {
            const latest = ds.slice().sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).pop();
            const name = (latest?.customer || '').trim();
            if (name) return name;
          }
          return (p.latest_contact || '').trim();
        })();
        return `
        <tr>
          <td style=\"padding:6px;border:1px solid #ddd;\">${i + 1}</td>
          <td style=\"padding:6px;border:1px solid #ddd;\">${p.seller.serial_number}</td>
          <td style=\"padding:6px;border:1px solid #ddd;\">${p.seller.name}</td>
          <td style=\"padding:6px;border:1px solid #ddd;\">${p.flower||''}</td>
          <td style=\"padding:6px;border:1px solid #ddd; text-align:right;\">${p.kg.toFixed(2)} kg</td>
          <td style=\"padding:6px;border:1px solid #ddd; text-align:right;\">₹${p.amount.toFixed(2)}</td>
          <td style=\"padding:6px;border:1px solid #ddd;\">${soldTo}</td>
        </tr>`;
      }).join('');
      content = `
        <h2 style=\"margin:12px 0 6px;font-size:16px;\">Purchases</h2>
        <table style=\"width:100%;border-collapse:collapse;\">
          <thead>
            <tr>
              <th style=\"background:#f3f4f6;padding:8px;border:1px solid #ddd;font-size:12px;\">#</th>
              <th style=\"background:#f3f4f6;padding:8px;border:1px solid #ddd;font-size:12px;\">Serial No.</th>
              <th style=\"background:#f3f4f6;padding:8px;border:1px solid #ddd;font-size:12px;\">Seller</th>
              <th style=\"background:#f3f4f6;padding:8px;border:1px solid #ddd;font-size:12px;\">Flower</th>
              <th style=\"background:#f3f4f6;padding:8px;border:1px solid #ddd;font-size:12px;text-align:right;\">Weight (kg)</th>
              <th style=\"background:#f3f4f6;padding:8px;border:1px solid #ddd;font-size:12px;text-align:right;\">Amount (₹)</th>
              <th style=\"background:#f3f4f6;padding:8px;border:1px solid #ddd;font-size:12px;\">Sold To</th>
            </tr>
          </thead>
          <tbody>
            ${purchaseRows || '<tr><td colspan="7" style="padding:10px;text-align:center;color:#6b7280;">No purchases</td></tr>'}
          </tbody>
        </table>`;
    } else {
      const rows = filteredSellers
        .map((s, i) => `
          <tr>
            <td style=\"padding:6px;border:1px solid #ddd;\">${i + 1}</td>
            <td style=\"padding:6px;border:1px solid #ddd;\">${s.serial_number}</td>
            <td style=\"padding:6px;border:1px solid #ddd;\">${s.name}</td>
            <td style=\"padding:6px;border:1px solid #ddd;\">${s.mobile || ''}</td>
            <td style=\"padding:6px;border:1px solid #ddd;\">${s.address || ''}</td>
            <td style=\"padding:6px;border:1px solid #ddd;\">${new Date(s.date).toLocaleDateString()}</td>
            <td style=\"padding:6px;border:1px solid #ddd; text-align:right;\">${Number(s.kg).toFixed(2)} kg</td>
            <td style=\"padding:6px;border:1px solid #ddd; text-align:right;\">₹${Number(s.amount).toFixed(2)}</td>
          </tr>`)
        .join('');
      content = `
        <table style=\"width:100%;border-collapse:collapse;\">
          <thead>
            <tr>
              <th style=\"background:#f3f4f6;padding:8px;border:1px solid #ddd;font-size:12px;\">#</th>
              <th style=\"background:#f3f4f6;padding:8px;border:1px solid #ddd;font-size:12px;\">Serial No.</th>
              <th style=\"background:#f3f4f6;padding:8px;border:1px solid #ddd;font-size:12px;\">Name</th>
              <th style=\"background:#f3f4f6;padding:8px;border:1px solid #ddd;font-size:12px;\">Mobile</th>
              <th style=\"background:#f3f4f6;padding:8px;border:1px solid #ddd;font-size:12px;\">Address</th>
              <th style=\"background:#f3f4f6;padding:8px;border:1px solid #ddd;font-size:12px;\">Date</th>
              <th style=\"background:#f3f4f6;padding:8px;border:1px solid #ddd;font-size:12px;text-align:right;\">Weight (kg)</th>
              <th style=\"background:#f3f4f6;padding:8px;border:1px solid #ddd;font-size:12px;text-align:right;\">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${rows || '<tr><td colspan="8" style="padding:10px;text-align:center;color:#6b7280;">No data</td></tr>'}
          </tbody>
        </table>`;
    }

    // Load shop profile
    let profile: any = null;
    try { profile = await profileApi.get(); } catch {}
    const shopName = (profile && (profile.shop_name || profile.shopName)) || '';
    const ownerName = (profile && (profile.owner_name || profile.ownerName)) || '';
    const ownerMobile = (profile && profile.mobile) || '';

    const html = `
      <html>
        <head>
          <meta charset="UTF-8" />
          <title>All Sellers - ${titleDate}</title>
          <style>
            body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"; padding: 20px; }
            h1 { font-size: 20px; margin: 0 0 12px 0; }
            .muted { color: #6b7280; font-size: 12px; margin-bottom: 16px; }
            table { width: 100%; border-collapse: collapse; }
            th { background: #f3f4f6; text-align: left; padding: 8px; border: 1px solid #ddd; font-size: 12px; }
            td { font-size: 12px; }
            .shop { border:1px solid #e5e7eb; border-radius:8px; padding:12px; margin-bottom:12px; }
            .shop h2 { margin:0 0 8px 0; font-size:16px; }
            .shop div { font-size:13px; line-height:1.6; }
          </style>
        </head>
        <body>
          <div class="shop">
            <h2>Shop Details</h2>
            <div><strong>Shop Name</strong>: ${shopName || '-'}</div>
            <div><strong>Owner name</strong>: ${ownerName || '-'}</div>
            <div><strong>Mobile number</strong>: ${ownerMobile || '-'}</div>
          </div>
          <h1>All Sellers - ${titleDate}</h1>
          <div class="muted">${selectedDate ? '' : `Records: ${filteredSellers.length}`}</div>
          ${content}
          <script>
            window.onload = function() { window.print(); };
          </script>
        </body>
      </html>
    `;

    const win = window.open('', '_blank');
    if (!win) return;
    win.document.open();
    win.document.write(html);
    win.document.close();
  };

  // CSV helpers (purchases-only)
  const downloadCSV = (filename: string, rows: any[], headers: string[]) => {
    const esc = (v: any) => {
      const s = (v ?? '').toString();
      if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    };
    const csv = [headers.join(',') , ...rows.map(r => headers.map(h => esc(r[h])).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadCsv = () => {
    if (!selectedDate) {
      toast.error('Select a date first');
      return;
    }
    const rows = dailyPurchases.map((p, i) => {
      const soldTo = (() => {
        const assigned = (p.salesman_name || '').trim();
        if (assigned) return assigned;
        const ds = dailySales.filter(d => d.seller.id === p.seller.id);
        if (ds.length > 0) {
          const latest = ds.slice().sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).pop();
          const name = (latest?.customer || '').trim();
          if (name) return name;
        }
        return (p.latest_contact || '').trim();
      })();
      return {
        index: i + 1,
        serial_number: p.seller.serial_number,
        seller: p.seller.name,
        total_kg: p.kg.toFixed(2),
        total_amount: p.amount.toFixed(2),
        sold_to: soldTo,
      };
    });
    const headers = ['index', 'serial_number', 'seller', 'total_kg', 'total_amount', 'sold_to'];
    downloadCSV(`eod_${selectedDate}.csv`, rows, headers);
    toast.success('CSV downloaded');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-accent/10 to-background">
      <Header />
      <div className="container mx-auto p-4 md:p-6 lg:p-8 max-w-7xl">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              onClick={() => navigate('/')}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
            <Users className="w-7 h-7 text-primary" />
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-foreground">All Sellers</h1>
              <p className="text-muted-foreground mt-1">Complete list of all seller records</p>
            </div>
          </div>
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2">
            <div className="flex items-center gap-2 surface-card px-3 py-2 rounded-md">
              <span className="text-sm text-muted-foreground">Date</span>
              <input
                type="date"
                className="bg-transparent outline-none text-sm"
                aria-label="Filter by date"
                title="Filter by date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
            <Button 
              variant="secondary" 
              onClick={handleSearchDate}
              className="gap-2 rounded-md"
            >
              Search
            </Button>
            <label className="flex items-center gap-2 text-sm px-2 py-1 border rounded-md">
              <input type="checkbox" checked={debugView} onChange={(e) => setDebugView(e.target.checked)} />
              Debug
            </label>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={handleDownloadPdf}
                className="gap-2 rounded-md"
              >
                Print
              </Button>
              <Button 
                variant="outline" 
                onClick={handleDownloadCsv}
                className="gap-2 rounded-md"
              >
                Download CSV
              </Button>
            </div>
            <Button 
              variant="gradient" 
              onClick={handleAnalytics} 
              className="gap-2 rounded-full shadow-md px-5"
            >
              <BarChart3 className="w-4 h-4" />
              Analytics
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="surface-card p-6">
            <div className="text-sm text-muted-foreground mb-1">Total Sellers</div>
            <div className="text-3xl font-bold text-primary">{sellers.length}</div>
          </div>
          <div className="surface-card p-6">
            <div className="text-sm text-muted-foreground mb-1">Total Amount</div>
            <div className="text-3xl font-bold text-green-600">₹{shownTotals.amount.toFixed(2)}</div>
          </div>
          <div className="surface-card p-6">
            <div className="text-sm text-muted-foreground mb-1">Total Weight</div>
            <div className="text-3xl font-bold text-blue-600">{shownTotals.kg.toFixed(2)} kg</div>
          </div>
        </div>

        {/* Date Results (on-page view) */}
        {selectedDate && showResults && (
          <div className="surface-card p-4 mb-6">
            <div className="mb-4 text-sm text-muted-foreground">
              Showing data for <span className="font-semibold">{new Date(selectedDate).toLocaleDateString()}</span>
              {` — Purchases: ${dailyPurchases.length}`}
            </div>
            {debugView && (
              <div className="mb-4 p-3 rounded border text-xs bg-muted/20">
                <div><strong>Selected (YMD)</strong>: {toLocalYMD(selectedDate)}</div>
                <div className="mt-2"><strong>dailyPurchases ({dailyPurchases.length})</strong>:</div>
                <ul className="list-disc pl-5">
                  {dailyPurchases.map((p, idx) => (
                    <li key={`dbg-${p.txn_id || idx}`}>
                      #{idx+1} · Serial {p.seller.serial_number} · {p.seller.name} · kg {p.kg} · amt {p.amount} · date raw {(p as any).date} · ymd {toLocalYMD((p as any).date)} · assigned {(p.salesman_name||'').trim()}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="border rounded-md overflow-hidden">
                <div className="px-3 py-2 font-semibold bg-muted">Purchases</div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-2">#</th>
                        <th className="text-left p-2">Serial</th>
                        <th className="text-left p-2">Seller</th>
                        <th className="text-right p-2">Weight (kg)</th>
                        <th className="text-right p-2">LW (kg)</th>
                        <th className="text-right p-2">Amount (₹)</th>
                        <th className="text-left p-2">Sold To</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailyPurchases.length === 0 ? (
                        <tr><td colSpan={6} className="p-3 text-center text-muted-foreground">No purchases</td></tr>
                      ) : (
                        dailyPurchases.map((p, i) => (
                          <tr key={`p-${p.txn_id || i}`} className="border-t">
                            <td className="p-2">{i + 1}</td>
                            <td className="p-2">{p.seller.serial_number}</td>
                            <td className="p-2">{p.seller.name}</td>
                            <td className="p-2 text-right">{p.kg.toFixed(2)}</td>
                            <td className="p-2 text-right">{Number(p.lw||0).toFixed(2)}</td>
                            <td className="p-2 text-right">₹{p.amount.toFixed(2)}</td>
                            <td className="p-2 text-left">{
                              (() => {
                                const assigned = (p.salesman_name || '').trim();
                                if (assigned) return assigned;
                                const ds = dailySales.filter(d => d.seller.id === p.seller.id);
                                if (ds.length > 0) {
                                  const latest = ds.slice().sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).pop();
                                  const name = (latest?.customer || '').trim();
                                  if (name) return name;
                                }
                                return (p.latest_contact || '').trim();
                              })()
                            }</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              {/* Sales panel removed as requested */}
            </div>
          </div>
        )}

        {/* Sellers Table removed for All Sellers (home) interface as requested */}

        {/* Analytics Dialog */}
        <Dialog open={isAnalyticsOpen} onOpenChange={setIsAnalyticsOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Analytics Dashboard - All Sellers
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-6 mt-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="surface-card p-4">
                  <div className="text-sm text-muted-foreground mb-1">Total Records</div>
                  <div className="text-2xl font-bold text-primary">{sellers.length}</div>
                </div>
                <div className="surface-card p-4">
                  <div className="text-sm text-muted-foreground mb-1">Total Amount</div>
                  <div className="text-2xl font-bold text-green-600">₹{totalAmount.toFixed(2)}</div>
                </div>
                <div className="surface-card p-4">
                  <div className="text-sm text-muted-foreground mb-1">Total Weight</div>
                  <div className="text-2xl font-bold text-blue-600">{totalKg.toFixed(2)} kg</div>
                </div>
              </div>

              {/* Average Values */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="surface-card p-4">
                  <div className="text-sm text-muted-foreground mb-1">Average Amount per Seller</div>
                  <div className="text-xl font-bold text-primary">₹{(totalAmount / sellers.length).toFixed(2)}</div>
                </div>
                <div className="surface-card p-4">
                  <div className="text-sm text-muted-foreground mb-1">Average Weight per Seller</div>
                  <div className="text-xl font-bold text-primary">{(totalKg / sellers.length).toFixed(2)} kg</div>
                </div>
              </div>

              {/* Simple Bar Graph - Amount Top 10 */}
              <div className="surface-card p-6">
                <h3 className="text-lg font-semibold mb-4">Amount (Top 10)</h3>
                <div className="p-4 border rounded-lg bg-white dark:bg-gray-950">
                  <div className="flex items-end gap-3 h-64 overflow-x-auto">
                    {sellers
                      .slice()
                      .sort((a, b) => Number(b.amount) - Number(a.amount))
                      .slice(0, 10)
                      .map((s) => {
                        const max = Math.max(...sellers.map(x => Number(x.amount)));
                        const h = max > 0 ? (Number(s.amount) / max) * 100 : 0;
                        return (
                          <div key={s.id} className="flex flex-col items-center min-w-[48px] flex-1">
                            <div className="w-full bg-green-500 rounded-t" style={{ height: `${Math.max(h, 5)}%` }} title={`${s.name}: ₹${Number(s.amount).toFixed(2)}`}></div>
                            <div className="text-[11px] mt-2 truncate w-full text-center" title={s.name}>
                              {s.name.length > 8 ? s.name.substring(0, 8) + '.' : s.name}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};
