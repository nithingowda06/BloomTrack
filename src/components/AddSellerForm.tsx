import { useState } from "react";
import { sellerApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface AddSellerFormProps {
  onSuccess: () => void;
}

export const AddSellerForm = ({ onSuccess }: AddSellerFormProps) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    mobile: "",
    serial_number: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await sellerApi.create({
        name: formData.name,
        mobile: formData.mobile,
        serial_number: formData.serial_number,
        // Defaults for initial creation; details can be added later
        address: "",
        date: new Date().toISOString().split('T')[0],
        amount: 0,
        kg: 0,
      });
      
      setFormData({
        name: "",
        mobile: "",
        serial_number: "",
      });
      
      onSuccess();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="serial_number">Serial Number *</Label>
          <Input
            id="serial_number"
            value={formData.serial_number}
            onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="name">Seller Name *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="mobile">Mobile *</Label>
          <Input
            id="mobile"
            type="tel"
            value={formData.mobile}
            onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
            required
          />
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Adding..." : "Add Seller"}
      </Button>
    </form>
  );
}
;
