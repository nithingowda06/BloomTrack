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
              <AnalyticsTotalsRadial sellers={analyticsData} title="Totals (Amount vs Weight)" />
            </div>
          </DialogContent>
        </Dialog>
      </div>
  );
};
