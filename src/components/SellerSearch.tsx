import { useState } from "react";
import { sellerApi } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";

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

interface SellerSearchProps {
  onSearch: (results: Seller[], query?: string) => void;
}

export const SellerSearch = ({ onSearch }: SellerSearchProps) => {
  const [serialNumber, setSerialNumber] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serialNumber.trim()) {
      toast.error("Please enter a serial number");
      return;
    }

    setLoading(true);
    try {
      const data = await sellerApi.search(serialNumber.trim());

      if (!data || data.length === 0) {
        toast.error(`Serial number "${serialNumber.trim()}" not found in database`, {
          description: "Please check the serial number and try again",
          duration: 4000,
        });
        onSearch([], "");
      } else {
        toast.success(`Found ${data.length} record(s)`);
        onSearch(data, serialNumber.trim());
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="surface-card max-w-3xl mx-auto">
      <CardContent className="pt-6">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Search by serial number..."
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              className="h-12 rounded-full pl-12 pr-4 text-[15px] border-border"
            />
          </div>
          <Button type="submit" disabled={loading} variant="gradient" className="h-12 rounded-full px-6 shrink-0">
            {loading ? "Searching..." : "Search"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
