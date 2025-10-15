import { useEffect, useState } from "react";
import { sellerApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Header } from "./Header";
import { SellerTable } from "./SellerTable";
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
  const [dailyPurchases, setDailyPurchases] = useState<Array<{seller: Seller; kg: number; amount: number; date: string}>>([]);
  const [dailySales, setDailySales] = useState<Array<{seller: Seller; kg: number; amount: number; date: string; customer?: string}>>([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetchAllSellers();
  }, []);

  // Load per-date transactions when a date is chosen
  useEffect(() => {
    const loadDaily = async () => {
      if (!selectedDate) { setDailyPurchases([]); setDailySales([]); return; }
      const target = new Date(selectedDate);
      const isSameDay = (d: string) => {
        const dt = new Date(d);
        return dt.getFullYear() === target.getFullYear() && dt.getMonth() === target.getMonth() && dt.getDate() === target.getDate();
      };
      const purchases: Array<{seller: Seller; kg: number; amount: number; date: string}> = [];
      const sales: Array<{seller: Seller; kg: number; amount: number; date: string; customer?: string}> = [];
      try {
        // Fetch transactions for each seller and filter to the selected day
        await Promise.all(sellers.map(async (s) => {
          try {
            const txns = await sellerApi.getTransactions(s.id);
            txns
              .filter(t => isSameDay((t as any).created_at || t.transaction_date))
              .forEach(t => purchases.push({ seller: s, kg: Number(t.kg_added||0), amount: Number(t.amount_added||0), date: (t as any).created_at || t.transaction_date }));
          } catch {}
          try {
            const so = await sellerApi.getSoldToTransactions(s.id);
            so
              .filter(t => isSameDay((t as any).created_at || t.sale_date))
              .forEach(t => sales.push({ seller: s, kg: Number(t.kg_sold||0), amount: Number(t.amount_sold||0), date: (t as any).created_at || t.sale_date, customer: t.customer_name }));
          } catch {}
        }));
      } finally {
        // sort by seller serial number then name
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

  const totalAmount = sellers.reduce((sum, seller) => sum + Number(seller.amount), 0);
  const totalKg = sellers.reduce((sum, seller) => sum + Number(seller.kg), 0);

  const filteredSellers = selectedDate
    ? sellers.filter((s) => {
        const hasPurchase = dailyPurchases.some((p) => p.seller.id === s.id);
        const hasSale = dailySales.some((d) => d.seller.id === s.id);
        return hasPurchase || hasSale;
      })
    : sellers;

  const handleDownloadPdf = () => {
    const titleDate = selectedDate ? new Date(selectedDate).toLocaleDateString() : 'All Dates';

    // If a date is selected, export only those day's transactions (not cumulative totals)
    let content = '';
    if (selectedDate) {
      // Compute day totals
      const purchaseTotals = dailyPurchases.reduce((acc, p) => ({ kg: acc.kg + p.kg, amt: acc.amt + p.amount }), { kg: 0, amt: 0 });
      const salesTotals = dailySales.reduce((acc, s) => ({ kg: acc.kg + s.kg, amt: acc.amt + s.amount }), { kg: 0, amt: 0 });
      const purchaseRows = dailyPurchases.map((p, i) => `
        <tr>
          <td style=\"padding:6px;border:1px solid #ddd;\">${i + 1}</td>
          <td style=\"padding:6px;border:1px solid #ddd;\">${p.seller.serial_number}</td>
          <td style=\"padding:6px;border:1px solid #ddd;\">${p.seller.name}</td>
          <td style=\"padding:6px;border:1px solid #ddd; text-align:right;\">${p.kg.toFixed(2)} kg</td>
          <td style=\"padding:6px;border:1px solid #ddd; text-align:right;\">₹${p.amount.toFixed(2)}</td>
        </tr>`).join('');
      const salesRows = dailySales.map((s, i) => `
        <tr>
          <td style=\"padding:6px;border:1px solid #ddd;\">${i + 1}</td>
          <td style=\"padding:6px;border:1px solid #ddd;\">${s.seller.serial_number}</td>
          <td style=\"padding:6px;border:1px solid #ddd;\">${s.seller.name}</td>
          <td style=\"padding:6px;border:1px solid #ddd;\">${s.customer || ''}</td>
          <td style=\"padding:6px;border:1px solid #ddd; text-align:right;\">${s.kg.toFixed(2)} kg</td>
          <td style=\"padding:6px;border:1px solid #ddd; text-align:right;\">₹${s.amount.toFixed(2)}</td>
        </tr>`).join('');
      content = `
        <div style=\"margin:0 0 12px;\">
          <div style=\"display:flex;gap:12px;\">
            <div style=\"flex:1;border:1px solid #ddd;border-radius:8px;padding:10px;background:#eef2ff;\">
              <div style=\"font-size:12px;color:#6b7280;margin-bottom:4px;\">Purchases Total</div>
              <div style=\"display:flex;justify-content:space-between;font-weight:700;\">
                <div>${purchaseTotals.kg.toFixed(2)} kg</div>
                <div>₹${purchaseTotals.amt.toFixed(2)}</div>
              </div>
            </div>
            <div style=\"flex:1;border:1px solid #ddd;border-radius:8px;padding:10px;background:#fffbeb;\">
              <div style=\"font-size:12px;color:#6b7280;margin-bottom:4px;\">Sales Total</div>
              <div style=\"display:flex;justify-content:space-between;font-weight:700;\">
                <div>${salesTotals.kg.toFixed(2)} kg</div>
                <div>₹${salesTotals.amt.toFixed(2)}</div>
              </div>
            </div>
          </div>
        </div>
        <h2 style=\"margin:12px 0 6px;font-size:16px;\">Purchases</h2>
        <table style=\"width:100%;border-collapse:collapse;\">
          <thead>
            <tr>
              <th style=\"background:#f3f4f6;padding:8px;border:1px solid #ddd;font-size:12px;\">#</th>
              <th style=\"background:#f3f4f6;padding:8px;border:1px solid #ddd;font-size:12px;\">Serial No.</th>
              <th style=\"background:#f3f4f6;padding:8px;border:1px solid #ddd;font-size:12px;\">Seller</th>
              <th style=\"background:#f3f4f6;padding:8px;border:1px solid #ddd;font-size:12px;text-align:right;\">Weight (kg)</th>
              <th style=\"background:#f3f4f6;padding:8px;border:1px solid #ddd;font-size:12px;text-align:right;\">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${purchaseRows || '<tr><td colspan="5" style="padding:10px;text-align:center;color:#6b7280;">No purchases</td></tr>'}
          </tbody>
        </table>
        <h2 style=\"margin:16px 0 6px;font-size:16px;\">Sales</h2>
        <table style=\"width:100%;border-collapse:collapse;\">
          <thead>
            <tr>
              <th style=\"background:#f3f4f6;padding:8px;border:1px solid #ddd;font-size:12px;\">#</th>
              <th style=\"background:#f3f4f6;padding:8px;border:1px solid #ddd;font-size:12px;\">Serial No.</th>
              <th style=\"background:#f3f4f6;padding:8px;border:1px solid #ddd;font-size:12px;\">Seller</th>
              <th style=\"background:#f3f4f6;padding:8px;border:1px solid #ddd;font-size:12px;\">Customer</th>
              <th style=\"background:#f3f4f6;padding:8px;border:1px solid #ddd;font-size:12px;text-align:right;\">Weight (kg)</th>
              <th style=\"background:#f3f4f6;padding:8px;border:1px solid #ddd;font-size:12px;text-align:right;\">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${salesRows || '<tr><td colspan="6" style="padding:10px;text-align:center;color:#6b7280;">No sales</td></tr>'}
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
          </style>
        </head>
        <body>
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
              variant="outline" 
              onClick={handleDownloadPdf}
              className="gap-2 rounded-md"
            >
              Download PDF
            </Button>
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
            <div className="text-3xl font-bold text-green-600">₹{totalAmount.toFixed(2)}</div>
          </div>
          <div className="surface-card p-6">
            <div className="text-sm text-muted-foreground mb-1">Total Weight</div>
            <div className="text-3xl font-bold text-blue-600">{totalKg.toFixed(2)} kg</div>
          </div>
        </div>

        {/* Sellers Table */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Loading sellers...</p>
          </div>
        ) : sellers.length === 0 ? (
          <div className="text-center py-12 surface-card">
            <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-xl font-semibold text-muted-foreground">No sellers found</p>
            <p className="text-sm text-muted-foreground mt-2">Add your first seller to get started</p>
          </div>
        ) : (
          <>
            {selectedDate && (
              <div className="surface-card p-3 mb-3 text-sm text-muted-foreground">
                Showing records for <span className="font-semibold">{new Date(selectedDate).toLocaleDateString()}</span> — {filteredSellers.length} result(s)
              </div>
            )}
            <SellerTable sellers={filteredSellers} onUpdate={fetchAllSellers} />
          </>
        )}

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

              {/* Amount Distribution - Vertical Bar Graph */}
              <div className="surface-card p-6">
                <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                  <span className="text-2xl">📊</span>
                  Amount Distribution (Top 10)
                </h3>
                <div className="relative bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 rounded-lg p-6">
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 -rotate-90 text-xs font-semibold text-muted-foreground">
                    Amount (₹)
                  </div>
                  <div className="ml-8 flex items-end justify-around gap-3 h-80 border-b-4 border-l-4 border-gray-400 dark:border-gray-600 p-4 bg-white dark:bg-gray-950 rounded-lg">
                    {sellers
                      .sort((a, b) => Number(b.amount) - Number(a.amount))
                      .slice(0, 10)
                      .map((seller) => {
                        const maxAmount = Math.max(...sellers.map(s => Number(s.amount)));
                        const heightPercentage = (Number(seller.amount) / maxAmount) * 100;
                        return (
                          <div key={seller.id} className="flex flex-col items-center gap-2 flex-1 group relative">
                            <div className="text-xs font-bold text-green-700 dark:text-green-400 mb-1 absolute -top-6">
                              ₹{(Number(seller.amount) / 1000).toFixed(0)}K
                            </div>
                            <div 
                              className="w-full max-w-[60px] bg-gradient-to-t from-green-600 via-green-500 to-green-400 rounded-t-xl hover:from-green-700 hover:via-green-600 hover:to-green-500 transition-all cursor-pointer shadow-xl border-2 border-green-700 dark:border-green-500"
                              style={{ height: `${heightPercentage}%`, minHeight: '30px' }}
                              title={`${seller.name}: ₹${Number(seller.amount).toFixed(2)}`}
                            />
                            <div className="text-xs font-semibold text-center truncate w-full mt-2" title={seller.name}>
                              {seller.name.length > 6 ? seller.name.substring(0, 6) + '.' : seller.name}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                  <div className="text-center mt-2 text-xs font-semibold text-muted-foreground">
                    Sellers
                  </div>
                </div>
              </div>

              {/* Weight Distribution - Vertical Bar Graph */}
              <div className="surface-card p-6">
                <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                  <span className="text-2xl">⚖️</span>
                  Weight Distribution (Top 10)
                </h3>
                <div className="relative bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 rounded-lg p-6">
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 -rotate-90 text-xs font-semibold text-muted-foreground">
                    Weight (kg)
                  </div>
                  <div className="ml-8 flex items-end justify-around gap-3 h-80 border-b-4 border-l-4 border-gray-400 dark:border-gray-600 p-4 bg-white dark:bg-gray-950 rounded-lg">
                    {sellers
                      .sort((a, b) => Number(b.kg) - Number(a.kg))
                      .slice(0, 10)
                      .map((seller) => {
                        const maxKg = Math.max(...sellers.map(s => Number(s.kg)));
                        const heightPercentage = (Number(seller.kg) / maxKg) * 100;
                        return (
                          <div key={seller.id} className="flex flex-col items-center gap-2 flex-1 group relative">
                            <div className="text-xs font-bold text-blue-700 dark:text-blue-400 mb-1 absolute -top-6">
                              {Number(seller.kg).toFixed(1)} kg
                            </div>
                            <div 
                              className="w-full max-w-[60px] bg-gradient-to-t from-blue-600 via-blue-500 to-blue-400 rounded-t-xl hover:from-blue-700 hover:via-blue-600 hover:to-blue-500 transition-all cursor-pointer shadow-xl border-2 border-blue-700 dark:border-blue-500"
                              style={{ height: `${heightPercentage}%`, minHeight: '30px' }}
                              title={`${seller.name}: ${Number(seller.kg).toFixed(2)} kg`}
                            />
                            <div className="text-xs font-semibold text-center truncate w-full mt-2" title={seller.name}>
                              {seller.name.length > 6 ? seller.name.substring(0, 6) + '.' : seller.name}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                  <div className="text-center mt-2 text-xs font-semibold text-muted-foreground">
                    Sellers
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
