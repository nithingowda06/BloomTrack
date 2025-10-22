import { useEffect, useState } from "react";
import { authApi, profileApi, sellerApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Header } from "./Header";
import { AddSellerForm } from "./AddSellerForm";
import { SellerSearch } from "./SellerSearch";
import { SellerTable } from "./SellerTable";
import { ProfileCard } from "./ProfileCard";
import { Plus, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import AnalyticsTotalsRadial from "./AnalyticsTotalsRadial";

interface Profile {
  owner_name: string;
  mobile: string;
  shop_name: string;
}

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

export const Dashboard = () => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [searchResults, setSearchResults] = useState<Seller[]>([]);
  const [analyticsData, setAnalyticsData] = useState<Seller[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
  const [lastSearchQuery, setLastSearchQuery] = useState<string>("");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [rangeAmount, setRangeAmount] = useState<number>(0);
  const [rangeKg, setRangeKg] = useState<number>(0);
  const [rangeLoading, setRangeLoading] = useState<boolean>(false);
  const [rangeApplied, setRangeApplied] = useState<boolean>(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const data = await profileApi.get();
      if (data) setProfile(data);
    } catch (error) {
      console.error('Failed to fetch profile:', error);
    }
  };

  const handleAnalytics = async () => {
    try {
      // Load all sellers for analytics
      const sellers = await sellerApi.getAll();
      if (sellers.length === 0) {
        toast.info("No sellers found");
        return;
      }
      setAnalyticsData(sellers);
      setIsAnalyticsOpen(true);
    } catch (error: any) {
      toast.error(error.message || "Failed to load sellers");
    }
  };

  const handleSearch = (results: Seller[], query?: string) => {
    setSearchResults(results);
    setLastSearchQuery(query || "");
  };

  const handleRefreshResults = async () => {
    if (lastSearchQuery) {
      // If there was a search, re-run the search
      try {
        const data = await sellerApi.search(lastSearchQuery);
        setSearchResults(data);
      } catch (error: any) {
        toast.error(error.message);
      }
    }
  };

  const handleSellerAdded = () => {
    setIsAddDialogOpen(false);
    toast.success("Seller added successfully!");
    // Auto-refresh: Clear search results
    setSearchResults([]);
    fetchProfile();
  };

  const totalAmount = searchResults.reduce((sum, seller) => sum + Number(seller.amount), 0);
  const totalKg = searchResults.reduce((sum, seller) => sum + Number(seller.kg), 0);
  
  const analyticsTotalAmount = analyticsData.reduce((sum, seller) => sum + Number(seller.amount), 0);
  const analyticsTotalKg = analyticsData.reduce((sum, seller) => sum + Number(seller.kg), 0);

  // Helpers
  const toLocalYMD = (v: any) => {
    const s = String(v || '').trim();
    if (!s) return '';
    if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
      const d = new Date(s);
      if (!isNaN(d.getTime())) {
        const yy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yy}-${mm}-${dd}`;
      }
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const d = new Date(s);
    if (isNaN(d.getTime())) return '';
    const yy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
  };

  const isWithinRange = (dstr: string, from: string, to: string) => {
    const ymd = toLocalYMD(dstr);
    if (!ymd) return false;
    if (from && ymd < from) return false;
    if (to && ymd > to) return false;
    return true;
  };

  const handleApplyRange = async () => {
    const f = toLocalYMD(fromDate);
    const t = toLocalYMD(toDate);
    if (!f && !t) {
      setRangeApplied(false);
      setRangeAmount(0);
      setRangeKg(0);
      toast.info('Select From or To date');
      return;
    }
    setRangeLoading(true);
    try {
      let amt = 0;
      let kg = 0;
      await Promise.all(analyticsData.map(async (s) => {
        try {
          const txns = await sellerApi.getTransactions(s.id);
          txns.forEach((t: any) => {
            const dsrc = t.transaction_date || t.created_at || '';
            if (isWithinRange(String(dsrc), f, t)) {
              kg += Number(t.kg_added || 0);
              amt += Number(t.amount_added || 0);
            }
          });
        } catch {}
      }));
      setRangeAmount(amt);
      setRangeKg(kg);
      setRangeApplied(true);
      toast.success('Range applied');
    } finally {
      setRangeLoading(false);
    }
  };

  const handleCopyTotals = async () => {
    const amt = rangeApplied ? rangeAmount : analyticsTotalAmount;
    const kg = rangeApplied ? rangeKg : analyticsTotalKg;
    const text = `Total Sellers: ${analyticsData.length}\nTotal Amount: ₹${amt.toFixed(2)}\nTotal Weight: ${kg.toFixed(2)} kg${rangeApplied ? `\nRange: ${fromDate || '-'} to ${toDate || '-'}` : ''}`;
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Totals copied to clipboard');
    } catch (e) {
      toast.error('Failed to copy totals');
    }
  };

  const handleExportTotalsCsv = () => {
    const amt = rangeApplied ? rangeAmount : analyticsTotalAmount;
    const kg = rangeApplied ? rangeKg : analyticsTotalKg;
    const headers = ['total_sellers','total_amount','total_kg','from','to'];
    const row = [String(analyticsData.length), amt.toFixed(2), kg.toFixed(2), (fromDate||''), (toDate||'')];
    const csv = headers.join(',') + "\n" + row.join(',') + "\n";
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'analytics_totals.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Totals CSV downloaded');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-accent/10 to-background">
      <Header />
      <div className="container mx-auto p-4 md:p-6 lg:p-8 max-w-7xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-7 h-7 text-primary" />
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-foreground">Seller Management</h1>
              <p className="text-muted-foreground mt-1">Search, track and manage seller records</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="gradient" onClick={handleAnalytics} className="gap-2 rounded-full shadow-md px-5">
              <BarChart3 className="w-4 h-4" />
              Analytics
            </Button>
            <Button variant="gradient" onClick={() => setIsAddDialogOpen(true)} className="gap-2 rounded-full shadow-md px-5">
              <Plus className="w-4 h-4" />
              Add Seller
            </Button>
          </div>
        </div>

        {profile && <ProfileCard profile={profile} />}
        <div className="mt-6">
          <SellerSearch onSearch={handleSearch} />
        </div>
      </div>

        {searchResults.length > 0 && (
          <div className="mt-6 space-y-4">
            <SellerTable sellers={searchResults} onUpdate={handleRefreshResults} />
          </div>
        )}

        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Seller</DialogTitle>
            </DialogHeader>
            <AddSellerForm onSuccess={handleSellerAdded} />
          </DialogContent>
        </Dialog>

        <Dialog open={isAnalyticsOpen} onOpenChange={setIsAnalyticsOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Analytics Dashboard
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-6 mt-4">
              {/* Date Range Filter */}
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
                <div className="flex-1">
                  <label className="text-sm text-muted-foreground block mb-1">From</label>
                  <input type="date" className="w-full px-3 py-2 border rounded-md bg-background" value={fromDate} onChange={(e)=>setFromDate(e.target.value)} />
                </div>
                <div className="flex-1">
                  <label className="text-sm text-muted-foreground block mb-1">To</label>
                  <input type="date" className="w-full px-3 py-2 border rounded-md bg-background" value={toDate} onChange={(e)=>setToDate(e.target.value)} />
                </div>
                <Button onClick={handleApplyRange} disabled={rangeLoading} className="rounded-md">
                  {rangeLoading ? 'Calculating…' : 'Apply'}
                </Button>
                {rangeApplied && (
                  <Button variant="ghost" onClick={()=>{ setFromDate(''); setToDate(''); setRangeApplied(false); }} className="rounded-md">
                    Clear
                  </Button>
                )}
              </div>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="surface-card p-4 rounded-md">
                  <div className="text-sm text-muted-foreground mb-1">Total Sellers</div>
                  <div className="text-2xl font-bold text-primary">{analyticsData.length}</div>
                </div>
                <div className="surface-card p-4 rounded-md">
                  <div className="text-sm text-muted-foreground mb-1">Total Amount</div>
                  <div className="text-2xl font-bold text-green-600">₹{(rangeApplied ? rangeAmount : analyticsTotalAmount).toFixed(2)}</div>
                </div>
                <div className="surface-card p-4 rounded-md">
                  <div className="text-sm text-muted-foreground mb-1">Total Weight</div>
                  <div className="text-2xl font-bold text-blue-600">{(rangeApplied ? rangeKg : analyticsTotalKg).toFixed(2)} kg</div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" className="rounded-md" onClick={handleCopyTotals}>Copy Totals</Button>
                <Button variant="outline" className="rounded-md" onClick={handleExportTotalsCsv}>Export Totals (CSV)</Button>
              </div>

              <AnalyticsTotalsRadial
                sellers={rangeApplied ? [{ id: 'range', amount: rangeAmount, kg: rangeKg }] as any : analyticsData as any}
                title={rangeApplied ? `Totals (Amount vs Weight) — ${fromDate || '-'} to ${toDate || '-'}` : 'Totals (Amount vs Weight)'}
              />
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};
