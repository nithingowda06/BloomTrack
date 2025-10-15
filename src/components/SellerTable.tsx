import { useEffect, useState } from "react";
import { sellerApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Edit, Trash2, Plus, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

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

interface SellerTableProps {
  sellers: Seller[];
  onUpdate: () => void;
}

interface Transaction {
  id: string;
  seller_id: string;
  transaction_date: string;
  amount_added: number;
  kg_added: number;
  previous_amount: number;
  previous_kg: number;
  new_total_amount: number;
  new_total_kg: number;
  created_at: string;
}

interface SoldToTransaction {
  id: string;
  seller_id: string;
  customer_name: string;
  customer_mobile: string;
  sale_date: string;
  kg_sold: number;
  amount_sold: number;
  previous_kg: number;
  previous_amount: number;
  remaining_kg: number;
  remaining_amount: number;
  notes: string;
  created_at: string;
}

export const SellerTable = ({ sellers, onUpdate }: SellerTableProps) => {
  const [editingSeller, setEditingSeller] = useState<Seller | null>(null);
  const [addDataSeller, setAddDataSeller] = useState<Seller | null>(null);
  const [originalSeller, setOriginalSeller] = useState<Seller | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [viewingSeller, setViewingSeller] = useState<Seller | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [viewingSoldTo, setSoldToTransactionsForView] = useState<SoldToTransaction[]>([]);
  const [loadingSoldToView, setLoadingSoldToView] = useState(false);
  const [deletingSeller, setDeletingSeller] = useState<Seller | null>(null);
  const [loading, setLoading] = useState(false);
  const [soldToSeller, setSoldToSeller] = useState<Seller | null>(null);
  const [soldToData, setSoldToData] = useState({
    customer_name: '',
    customer_mobile: '',
    sale_date: new Date().toISOString().slice(0, 10),
    kg_sold: '' as any,
    amount_sold: '' as any,
    notes: '',
  });
  const [soldToTransactions, setSoldToTransactions] = useState<SoldToTransaction[]>([]);
  const [loadingSoldTo, setLoadingSoldTo] = useState(false);
  const [editingSale, setEditingSale] = useState<SoldToTransaction | null>(null);
  const [deletingSale, setDeletingSale] = useState<SoldToTransaction | null>(null);
  // Expanded updates per seller (inline rows)
  const [expandedSellerId, setExpandedSellerId] = useState<string | null>(null);
  const [expandedTransactions, setExpandedTransactions] = useState<Record<string, Transaction[]>>({});
  const [loadingExpanded, setLoadingExpanded] = useState(false);
  // History-only dialog (no basic info, only purchases & sales)
  const [historySeller, setHistorySeller] = useState<Seller | null>(null);
  const [historyTxns, setHistoryTxns] = useState<Transaction[]>([]);
  const [historySoldTo, setHistorySoldTo] = useState<SoldToTransaction[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  // Per-seller PDF export state (header UI removed; kept for potential future use)
  const [pdfSerial, setPdfSerial] = useState<string>('');
  const [pdfLoading, setPdfLoading] = useState<boolean>(false);
  // Single-update dialog state
  const [selectedTxn, setSelectedTxn] = useState<Transaction | null>(null);
  const [selectedTxnSeller, setSelectedTxnSeller] = useState<Seller | null>(null);
  // Table-level transactions map for always-visible child rows
  const [tableTransactions, setTableTransactions] = useState<Record<string, Transaction[]>>({});
  // Table-level sold-to map for totals at bottom
  const [tableSoldTo, setTableSoldTo] = useState<Record<string, SoldToTransaction[]>>({});
  // Period clear (local-only) UI state
  const [clearConfirm, setClearConfirm] = useState(false);

  // Helpers for local clear timestamps (per-seller for dialogs)
  const getClearKey = (sellerId: string) => `seller_clear_${sellerId}`;
  const getLastClearedAt = (sellerId: string): string | null => {
    try {
      return localStorage.getItem(getClearKey(sellerId));
    } catch {
      return null;
    }
  };

  // Generate PDF for a specific seller (helper used by row action)
  const handleDownloadSellerPdfForSeller = async (seller: Seller) => {
    try {
      const [txns, soldTo] = await Promise.all([
        sellerApi.getTransactions(seller.id),
        sellerApi.getSoldToTransactions(seller.id),
      ]);

      const purchasesRows = (txns || []).map((t, i) => `
        <tr>
          <td style="padding:6px;border:1px solid #ddd;">${i + 1}</td>
          <td style="padding:6px;border:1px solid #ddd;">${new Date((t as any).created_at || t.transaction_date).toLocaleDateString()}</td>
          <td style="padding:6px;border:1px solid #ddd;text-align:right;">${Number(t.kg_added||0).toFixed(2)} kg</td>
          <td style="padding:6px;border:1px solid #ddd;text-align:right;">₹${Number(t.amount_added||0).toFixed(2)}</td>
        </tr>`).join('');

      const salesRows = (soldTo || []).map((t, i) => `
        <tr>
          <td style="padding:6px;border:1px solid #ddd;">${i + 1}</td>
          <td style="padding:6px;border:1px solid #ddd;">${t.customer_name || ''}</td>
          <td style="padding:6px;border:1px solid #ddd;">${new Date((t as any).created_at || t.sale_date).toLocaleDateString()}</td>
          <td style="padding:6px;border:1px solid #ddd;text-align:right;">${Number(t.kg_sold||0).toFixed(2)} kg</td>
          <td style="padding:6px;border:1px solid #ddd;text-align:right;">₹${Number(t.amount_sold||0).toFixed(2)}</td>
        </tr>`).join('');

      const html = `
        <html>
          <head>
            <meta charset="UTF-8" />
            <title>Seller Report - ${seller.serial_number} ${seller.name}</title>
            <style>
              body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"; padding: 20px; }
              h1 { font-size: 18px; margin: 0 0 12px 0; }
              h2 { font-size: 16px; margin: 16px 0 6px 0; }
              .muted { color: #6b7280; font-size: 12px; margin-bottom: 8px; }
              table { width: 100%; border-collapse: collapse; }
              th { background: #f3f4f6; text-align: left; padding: 8px; border: 1px solid #ddd; font-size: 12px; }
              td { font-size: 12px; }
              .grid { display: grid; grid-template-columns: repeat(2,1fr); gap: 12px; }
              .card { border: 1px solid #ddd; border-radius: 8px; padding: 10px; }
            </style>
          </head>
          <body>
            <h1>Seller Report - ${seller.serial_number} · ${seller.name}</h1>
            <div class="muted">Mobile: ${seller.mobile || ''} · Date: ${new Date(seller.date).toLocaleDateString()}</div>
            <div class="grid">
              <div class="card">
                <div class="muted">Weight</div>
                <div style="font-weight:700;">${Number(seller.kg).toFixed(2)} kg</div>
              </div>
              <div class="card">
                <div class="muted">Amount</div>
                <div style="font-weight:700;">₹${Number(seller.amount).toFixed(2)}</div>
              </div>
            </div>

            <h2>Purchases</h2>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Date</th>
                  <th style="text-align:right;">Weight (kg)</th>
                  <th style="text-align:right;">Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                ${purchasesRows || '<tr><td colspan="4" style="padding:10px;text-align:center;color:#6b7280;">No purchases</td></tr>'}
              </tbody>
            </table>

            <h2>Sales</h2>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Customer</th>
                  <th>Date</th>
                  <th style="text-align:right;">Weight (kg)</th>
                  <th style="text-align:right;">Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                ${salesRows || '<tr><td colspan="5" style="padding:10px;text-align:center;color:#6b7280;">No sales</td></tr>'}
              </tbody>
            </table>

            <script>window.onload = function() { window.print(); };</script>
          </body>
        </html>
      `;

      const win = window.open('', '_blank');
      if (!win) return;
      win.document.open();
      win.document.write(html);
      win.document.close();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to generate PDF');
    }
  };

  // Generate PDF for a single seller by serial number
  const handleDownloadSellerPdf = async () => {
    const serial = (pdfSerial || '').trim();
    if (!serial) {
      toast.error('Enter a Serial No.');
      return;
    }
    const seller = sellers.find(s => (s.serial_number || '').toString() === serial);
    if (!seller) {
      toast.error(`No seller found with Serial No. ${serial}`);
      return;
    }
    setPdfLoading(true);
    try {
      const [txns, soldTo] = await Promise.all([
        sellerApi.getTransactions(seller.id),
        sellerApi.getSoldToTransactions(seller.id),
      ]);

      const purchasesRows = (txns || []).map((t, i) => `
        <tr>
          <td style="padding:6px;border:1px solid #ddd;">${i + 1}</td>
          <td style="padding:6px;border:1px solid #ddd;">${new Date((t as any).created_at || t.transaction_date).toLocaleDateString()}</td>
          <td style="padding:6px;border:1px solid #ddd;text-align:right;">${Number(t.kg_added||0).toFixed(2)} kg</td>
          <td style="padding:6px;border:1px solid #ddd;text-align:right;">₹${Number(t.amount_added||0).toFixed(2)}</td>
        </tr>`).join('');

      const salesRows = (soldTo || []).map((t, i) => `
        <tr>
          <td style="padding:6px;border:1px solid #ddd;">${i + 1}</td>
          <td style="padding:6px;border:1px solid #ddd;">${t.customer_name || ''}</td>
          <td style="padding:6px;border:1px solid #ddd;">${new Date((t as any).created_at || t.sale_date).toLocaleDateString()}</td>
          <td style="padding:6px;border:1px solid #ddd;text-align:right;">${Number(t.kg_sold||0).toFixed(2)} kg</td>
          <td style="padding:6px;border:1px solid #ddd;text-align:right;">₹${Number(t.amount_sold||0).toFixed(2)}</td>
        </tr>`).join('');

      const html = `
        <html>
          <head>
            <meta charset="UTF-8" />
            <title>Seller Report - ${seller.serial_number} ${seller.name}</title>
            <style>
              body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"; padding: 20px; }
              h1 { font-size: 18px; margin: 0 0 12px 0; }
              h2 { font-size: 16px; margin: 16px 0 6px 0; }
              .muted { color: #6b7280; font-size: 12px; margin-bottom: 8px; }
              table { width: 100%; border-collapse: collapse; }
              th { background: #f3f4f6; text-align: left; padding: 8px; border: 1px solid #ddd; font-size: 12px; }
              td { font-size: 12px; }
              .grid { display: grid; grid-template-columns: repeat(2,1fr); gap: 12px; }
              .card { border: 1px solid #ddd; border-radius: 8px; padding: 10px; }
            </style>
          </head>
          <body>
            <h1>Seller Report - ${seller.serial_number} · ${seller.name}</h1>
            <div class="muted">Mobile: ${seller.mobile || ''} · Date: ${new Date(seller.date).toLocaleDateString()}</div>
            <div class="grid">
              <div class="card">
                <div class="muted">Weight</div>
                <div style="font-weight:700;">${Number(seller.kg).toFixed(2)} kg</div>
              </div>
              <div class="card">
                <div class="muted">Amount</div>
                <div style="font-weight:700;">₹${Number(seller.amount).toFixed(2)}</div>
              </div>
            </div>

            <h2>Purchases</h2>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Date</th>
                  <th style="text-align:right;">Weight (kg)</th>
                  <th style="text-align:right;">Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                ${purchasesRows || '<tr><td colspan="4" style="padding:10px;text-align:center;color:#6b7280;">No purchases</td></tr>'}
              </tbody>
            </table>

            <h2>Sales</h2>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Customer</th>
                  <th>Date</th>
                  <th style="text-align:right;">Weight (kg)</th>
                  <th style="text-align:right;">Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                ${salesRows || '<tr><td colspan="5" style="padding:10px;text-align:center;color:#6b7280;">No sales</td></tr>'}
              </tbody>
            </table>

            <script>window.onload = function() { window.print(); };</script>
          </body>
        </html>
      `;

      const win = window.open('', '_blank');
      if (!win) return;
      win.document.open();
      win.document.write(html);
      win.document.close();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to generate PDF');
    } finally {
      setPdfLoading(false);
    }
  };
  const setLastClearedNow = (sellerId: string) => {
    try {
      localStorage.setItem(getClearKey(sellerId), new Date().toISOString());
    } catch {}
  };

  // Load transactions for all sellers shown in Search Results
  useEffect(() => {
    let ignore = false;
    const loadAll = async () => {
      const map: Record<string, Transaction[]> = {};
      for (const s of sellers) {
        try {
          const txns = await sellerApi.getTransactions(s.id);
          map[s.id] = txns;
        } catch {
          map[s.id] = [];
        }
      }
      if (!ignore) setTableTransactions(map);
    };
    if (sellers && sellers.length > 0) loadAll();
    return () => { ignore = true; };
  }, [sellers]);

  // Load sold-to transactions for all sellers shown in Search Results
  useEffect(() => {
    let ignore = false;
    const loadAllSoldTo = async () => {
      const map: Record<string, SoldToTransaction[]> = {};
      for (const s of sellers) {
        try {
          const txns = await sellerApi.getSoldToTransactions(s.id);
          map[s.id] = txns;
        } catch {
          map[s.id] = [];
        }
      }
      if (!ignore) setTableSoldTo(map);
    };
    if (sellers && sellers.length > 0) loadAllSoldTo();
    return () => { ignore = true; };
  }, [sellers]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSeller) return;

    setLoading(true);
    try {
      await sellerApi.update(editingSeller.id, {
        name: editingSeller.name,
        mobile: editingSeller.mobile,
        serial_number: editingSeller.serial_number,
        address: editingSeller.address,
        date: editingSeller.date,
        amount: editingSeller.amount,
        kg: editingSeller.kg,
      });

      toast.success("Seller updated successfully");
      setEditingSeller(null);
      onUpdate();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddDataUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addDataSeller) return;

    setLoading(true);
    try {
      if (isCreatingNew) {
        // Creating a new seller
        await sellerApi.create({
          name: addDataSeller.name,
          mobile: addDataSeller.mobile,
          serial_number: addDataSeller.serial_number,
          address: addDataSeller.address,
          date: addDataSeller.date,
          amount: addDataSeller.amount,
          kg: addDataSeller.kg,
        });
        toast.success("New seller added successfully!");
      } else if (originalSeller) {
        // Adding data to existing seller
        const newAmount = Number(originalSeller.amount) + Number(addDataSeller.amount);
        const newKg = Number(originalSeller.kg) + Number(addDataSeller.kg);

        // Update seller totals
        await sellerApi.update(addDataSeller.id, {
          name: addDataSeller.name,
          mobile: addDataSeller.mobile,
          serial_number: addDataSeller.serial_number,
          address: addDataSeller.address,
          date: addDataSeller.date,
          amount: newAmount,
          kg: newKg,
        });

        // Record transaction history
        await sellerApi.addTransaction(addDataSeller.id, {
          transaction_date: addDataSeller.date,
          amount_added: Number(addDataSeller.amount),
          kg_added: Number(addDataSeller.kg),
          previous_amount: Number(originalSeller.amount),
          previous_kg: Number(originalSeller.kg),
          new_total_amount: newAmount,
          new_total_kg: newKg,
        });

        toast.success(`Data added successfully! New Total: ₹${newAmount.toFixed(2)} | ${newKg.toFixed(2)} kg`);
      }
      
      setAddDataSeller(null);
      setOriginalSeller(null);
      setIsCreatingNew(false);
      onUpdate();
      // Refresh the table child rows for this seller so new row appears
      try {
        const targetId = (isCreatingNew ? '' : addDataSeller?.id) || originalSeller?.id;
        if (targetId) {
          const data = await sellerApi.getTransactions(targetId);
          setTableTransactions((prev) => ({ ...prev, [targetId]: data }));
        }
      } catch {}
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async (sellerId: string) => {
    setLoadingTransactions(true);
    try {
      const data = await sellerApi.getTransactions(sellerId);
      setTransactions(data);
    } catch (error: any) {
      toast.error("Failed to load transaction history");
      setTransactions([]);
    } finally {
      setLoadingTransactions(false);
    }
  };

  const fetchSoldToTransactions = async (sellerId: string) => {
    setLoadingSoldToView(true);
    try {
      const data = await sellerApi.getSoldToTransactions(sellerId);
      setSoldToTransactionsForView(data);
    } catch (error: any) {
      toast.error("Failed to load sales history");
      setSoldToTransactionsForView([]);
    } finally {
      setLoadingSoldToView(false);
    }
  };

  const handleViewSeller = async (seller: Seller) => {
    setViewingSeller(seller);
    await fetchTransactions(seller.id);
    await fetchSoldToTransactions(seller.id);
  };

  // Expand/collapse inline updates under a seller row
  const toggleExpand = async (seller: Seller) => {
    if (expandedSellerId === seller.id) {
      setExpandedSellerId(null);
      return;
    }
    setExpandedSellerId(seller.id);
    if (!expandedTransactions[seller.id]) {
      setLoadingExpanded(true);
      try {
        const data = await sellerApi.getTransactions(seller.id);
        setExpandedTransactions((prev) => ({ ...prev, [seller.id]: data }));
      } catch (e) {
        toast.error('Failed to load updates');
      } finally {
        setLoadingExpanded(false);
      }
    }
  };

  // Open history-only dialog
  const openHistoryOnly = async (seller: Seller) => {
    setHistorySeller(seller);
    setLoadingHistory(true);
    try {
      const [txns, soldTo] = await Promise.all([
        sellerApi.getTransactions(seller.id),
        sellerApi.getSoldToTransactions(seller.id),
      ]);
      setHistoryTxns(txns);
      setHistorySoldTo(soldTo);
    } catch (e) {
      toast.error('Failed to load history');
      setHistoryTxns([]);
      setHistorySoldTo([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingSeller) return;

    setLoading(true);
    try {
      await sellerApi.delete(deletingSeller.id);

      toast.success("Seller deleted successfully");
      setDeletingSeller(null);
      onUpdate();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSoldTo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!soldToSeller) return;

    setLoading(true);
    try {
      await sellerApi.addSoldToTransaction(soldToSeller.id, {
        customer_name: soldToData.customer_name,
        customer_mobile: soldToData.customer_mobile,
        sale_date: soldToData.sale_date,
        kg_sold: Number(soldToData.kg_sold),
        amount_sold: Number(soldToData.amount_sold),
        notes: soldToData.notes,
      });

      toast.success("✅ Sale recorded successfully! Stock updated.");
      
      // Close dialog
      setSoldToSeller(null);
      
      // Reset form
      setSoldToData({
        customer_name: '',
        customer_mobile: '',
        sale_date: new Date().toISOString().slice(0, 10),
        kg_sold: '' as any,
        amount_sold: '' as any,
        notes: '',
      });
      
      // Refresh main table
      onUpdate();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSale || !viewingSeller) return;

    setLoading(true);
    try {
      await sellerApi.updateSoldToTransaction(viewingSeller.id, editingSale.id, {
        customer_name: editingSale.customer_name,
        customer_mobile: editingSale.customer_mobile,
        sale_date: editingSale.sale_date,
        notes: editingSale.notes,
      });

      toast.success("✅ Sale updated successfully!");
      
      // Close edit dialog
      setEditingSale(null);
      
      // Refresh sold-to transactions
      await fetchSoldToTransactions(viewingSeller.id);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSale = async () => {
    if (!deletingSale || !viewingSeller) return;

    setLoading(true);
    try {
      await sellerApi.deleteSoldToTransaction(viewingSeller.id, deletingSale.id);

      toast.success("✅ Sale deleted successfully! Stock restored.");
      
      // Close delete dialog
      setDeletingSale(null);
      
      // Refresh sold-to transactions and main table
      await fetchSoldToTransactions(viewingSeller.id);
      onUpdate();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Card className="surface-card">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>Search Results</CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="gradient"
                className="rounded-full shadow-md px-4 py-2 gap-2"
                onClick={() => {
                if (!sellers || sellers.length === 0) {
                  toast.error("Search a seller first");
                  return;
                }
                const base = sellers[0];
                setIsCreatingNew(true);
                setOriginalSeller(null);
                setAddDataSeller({
                  id: '',
                  name: base.name,
                  mobile: base.mobile,
                  serial_number: '',
                  address: base.address,
                  amount: 0,
                  kg: 0,
                  date: new Date().toISOString().slice(0, 10),
                });
              }}
              >
                <Plus className="w-4 h-4" />
                Add New Data
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Serial No.</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Mobile</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Weight (kg)</TableHead>
                  <TableHead className="text-right">Amount (₹)</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sellers.map((seller) => (
                  <>
                    <TableRow 
                      key={seller.id}
                      className="hover:bg-accent/50 transition-colors cursor-pointer"
                      onClick={() => handleViewSeller(seller)}
                    >
                      <TableCell className="font-medium">
                        <span className="text-primary font-semibold">
                          {seller.serial_number}
                        </span>
                      </TableCell>
                      <TableCell>{seller.name}</TableCell>
                      <TableCell>{seller.mobile}</TableCell>
                      <TableCell className="max-w-xs truncate">{seller.address}</TableCell>
                      <TableCell>{new Date(seller.date).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">{Number(seller.kg).toFixed(2)}</TableCell>
                      <TableCell className="text-right">₹{Number(seller.amount).toFixed(2)}</TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingSeller(seller)}
                            className="gap-1"
                          >
                            <Edit className="w-3 h-3" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setOriginalSeller(seller);
                              setAddDataSeller({
                                ...seller,
                                amount: '' as any,
                                kg: '' as any,
                                date: new Date().toISOString().slice(0, 10),
                              });
                            }}
                            className="gap-1 text-blue-600 hover:text-blue-700 border-blue-200"
                          >
                            <Plus className="w-3 h-3" />
                            Add Data
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownloadSellerPdfForSeller(seller)}
                            className="gap-1"
                          >
                            {/* simple download indicator */}
                            <span className="w-3 h-3">⬇️</span>
                            Download
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            // Removed "Sold To" button per request
                            onClick={() => {}}
                            className="hidden"
                          >
                            {/* Sold To removed */}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDeletingSeller(seller)}
                            className="gap-1 text-red-600 hover:text-red-700 border-red-200"
                          >
                            <Trash2 className="w-3 h-3" />
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {/* Child rows for each purchase update (newest first) */}
                    {(tableTransactions[seller.id] || []).length > 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="bg-muted/40 text-xs text-muted-foreground">Updates</TableCell>
                      </TableRow>
                    )}
                    {([...((tableTransactions[seller.id] || []))]
                      .sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime())
                    ).map((txn, idx) => (
                      <TableRow key={txn.id} className={`${idx % 2 === 0 ? 'bg-accent/20' : 'bg-accent/40'} hover:bg-accent/50 cursor-pointer`} onClick={() => { setSelectedTxnSeller(seller); setSelectedTxn(txn); }}>
                        <TableCell>
                          <span className="inline-flex items-center justify-center w-6 h-6 text-xs font-semibold rounded-full bg-primary/10 text-primary">
                            {idx + 1}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">Update</TableCell>
                        <TableCell className="text-xs text-muted-foreground">—</TableCell>
                        <TableCell className="max-w-xs truncate text-xs text-muted-foreground">—</TableCell>
                        <TableCell className="text-xs">{new Date(txn.transaction_date).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right text-xs text-blue-600">+{Number(txn.kg_added).toFixed(2)} kg</TableCell>
                        <TableCell className="text-right text-xs text-green-600">+₹{Number(txn.amount_added).toFixed(2)}</TableCell>
            <TableCell className="text-right">
              <div className="inline-flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-7 gap-1 text-green-600 hover:text-green-700 border-green-200"
                  onClick={async (e) => {
                    e.stopPropagation();
                    setSoldToSeller(seller);
                    setSoldToData({
                      customer_name: '',
                      customer_mobile: '',
                      sale_date: new Date().toISOString().slice(0, 10),
                      kg_sold: '' as any,
                      amount_sold: '' as any,
                      notes: '',
                    });
                    setLoadingSoldTo(true);
                    try {
                      const data = await sellerApi.getSoldToTransactions(seller.id);
                      setSoldToTransactions(data);
                    } catch (error) {
                      console.error('Failed to fetch sold-to transactions:', error);
                    } finally {
                      setLoadingSoldTo(false);
                    }
                  }}
                >
                  Sold To
                </Button>
                <Button variant="outline" size="sm" className="text-xs h-7" onClick={(e) => { e.stopPropagation(); setSelectedTxnSeller(seller); setSelectedTxn(txn); }}>View</Button>
              </div>
            </TableCell>
                      </TableRow>
                    ))}
                  </>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      {/* Bottom-of-interface Period Totals (outside dialog) */}
      {(() => {
        // Global clear across all sellers in current Search Results
        const GLOBAL_CLEAR_KEY = 'seller_clear_global';
        const getGlobalClear = (): number => {
          try {
            const v = localStorage.getItem(GLOBAL_CLEAR_KEY);
            return v ? new Date(v).getTime() : 0;
          } catch {
            return 0;
          }
        };
        const setGlobalClear = () => {
          try {
            localStorage.setItem(GLOBAL_CLEAR_KEY, new Date().toISOString());
          } catch {}
        };

        const clearedAt = getGlobalClear();
        // Sum purchases across all sellers since clear
        const recv = sellers.reduce(
          (acc, s) => {
            const txns = tableTransactions[s.id] || [];
            for (const t of txns) {
              const ts = new Date((t as any).created_at || t.transaction_date).getTime();
              if (!clearedAt || ts > clearedAt) {
                acc.kg += Number(t.kg_added || 0);
                acc.amt += Number(t.amount_added || 0);
              }
            }
            return acc;
          },
          { kg: 0, amt: 0 }
        );

        // Sum sales across all sellers since clear
        const sales = sellers.reduce(
          (acc, s) => {
            const txns = tableSoldTo[s.id] || [];
            for (const t of txns) {
              const ts = new Date((t as any).created_at || t.sale_date).getTime();
              if (!clearedAt || ts > clearedAt) {
                acc.kg += Number(t.kg_sold || 0);
                acc.amt += Number(t.amount_sold || 0);
              }
            }
            return acc;
          },
          { kg: 0, amt: 0 }
        );

        if (recv.kg === 0 && recv.amt === 0 && sales.kg === 0 && sales.amt === 0) {
          return null;
        }
        return (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold">Receiver Total (Purchases)</p>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input type="checkbox" checked={clearConfirm} onChange={(e) => setClearConfirm(e.target.checked)} />
                    Clear period
                  </label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!clearConfirm}
                    onClick={() => { setGlobalClear(); setClearConfirm(false); }}
                    className="h-7 text-xs"
                  >
                    Clear Now
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-blue-50 dark:bg-blue-950 rounded p-3">
                  <p className="text-xs text-muted-foreground mb-1">Weight</p>
                  <p className="text-xl font-bold text-blue-600">{recv.kg.toFixed(2)} kg</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-950 rounded p-3">
                  <p className="text-xs text-muted-foreground mb-1">Amount</p>
                  <p className="text-xl font-bold text-blue-600">₹{recv.amt.toFixed(2)}</p>
                </div>
              </div>
              {clearedAt ? (
                <p className="mt-2 text-[11px] text-muted-foreground">Since {new Date(clearedAt).toLocaleDateString()}</p>
              ) : null}
            </div>

            <div className="border rounded-lg p-4">
              <p className="text-sm font-semibold mb-2">Sales Total</p>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-amber-50 dark:bg-amber-950 rounded p-3">
                  <p className="text-xs text-muted-foreground mb-1">Weight</p>
                  <p className="text-xl font-bold text-amber-600">{sales.kg.toFixed(2)} kg</p>
                </div>
                <div className="bg-amber-50 dark:bg-amber-950 rounded p-3">
                  <p className="text-xs text-muted-foreground mb-1">Amount</p>
                  <p className="text-xl font-bold text-amber-600">₹{sales.amt.toFixed(2)}</p>
                </div>
              </div>
              {clearedAt ? (
                <p className="mt-2 text-[11px] text-muted-foreground">Since {new Date(clearedAt).toLocaleDateString()}</p>
              ) : null}
            </div>
          </div>
        );
      })()}

      <Dialog open={!!editingSeller} onOpenChange={() => setEditingSeller(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Seller</DialogTitle>
          </DialogHeader>
          {editingSeller && (
            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Seller Name</Label>
                  <Input
                    value={editingSeller.name}
                    onChange={(e) => setEditingSeller({ ...editingSeller, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Mobile</Label>
                  <Input
                    value={editingSeller.mobile}
                    onChange={(e) => setEditingSeller({ ...editingSeller, mobile: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={editingSeller.date}
                    onChange={(e) => setEditingSeller({ ...editingSeller, date: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Weight (kg)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editingSeller.kg}
                    onChange={(e) => setEditingSeller({ ...editingSeller, kg: parseFloat(e.target.value) })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Amount (₹)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editingSeller.amount}
                    onChange={(e) => setEditingSeller({ ...editingSeller, amount: parseFloat(e.target.value) })}
                    required
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Address</Label>
                  <Textarea
                    value={editingSeller.address}
                    onChange={(e) => setEditingSeller({ ...editingSeller, address: e.target.value })}
                    required
                    rows={3}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={loading}>
                  {loading ? "Updating..." : "Update"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setEditingSeller(null)}>
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Single update dialog (only this purchase entry) */}
      <Dialog open={!!selectedTxn} onOpenChange={() => { setSelectedTxn(null); setSelectedTxnSeller(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Update Details - {selectedTxnSeller?.name}</DialogTitle>
          </DialogHeader>
          {selectedTxn && (
            <div className="space-y-3">
              <div className="border rounded p-3">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Date</p>
                    <p className="text-sm font-semibold">{new Date(selectedTxn.transaction_date).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Added</p>
                    <p className="text-sm font-semibold text-blue-600">+{Number(selectedTxn.kg_added).toFixed(2)} kg</p>
                    <p className="text-sm font-semibold text-green-600">+₹{Number(selectedTxn.amount_added).toFixed(2)}</p>
                  </div>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Previous: {Number(selectedTxn.previous_kg).toFixed(2)} kg, ₹{Number(selectedTxn.previous_amount).toFixed(2)}</span>
                  <span className="font-semibold text-foreground">Total: {Number(selectedTxn.new_total_kg).toFixed(2)} kg, ₹{Number(selectedTxn.new_total_amount).toFixed(2)}</span>
                </div>
              </div>
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => { setSelectedTxn(null); setSelectedTxnSeller(null); }}>Close</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* History-only dialog: shows only Purchase and Sales history for a seller */}
      <Dialog open={!!historySeller} onOpenChange={() => { setHistorySeller(null); setHistoryTxns([]); setHistorySoldTo([]); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">History - {historySeller?.name}</DialogTitle>
          </DialogHeader>
          {loadingHistory ? (
            <p className="text-center text-muted-foreground py-4 text-sm">Loading...</p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Purchase History */}
              <div className="border rounded-lg p-4">
                <h3 className="text-sm font-semibold mb-3">Purchase History ({historyTxns.length})</h3>
                {historyTxns.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4 text-sm">No purchases yet</p>
                ) : (
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {historyTxns.map((txn, index) => (
                      <div key={txn.id} className="border rounded p-3 hover:bg-accent/50 transition-colors">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="text-xs font-semibold text-primary">#{historyTxns.length - index}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(txn.transaction_date).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-semibold text-blue-600">+{Number(txn.kg_added).toFixed(2)} kg</p>
                            <p className="text-xs font-semibold text-green-600">+₹{Number(txn.amount_added).toFixed(2)}</p>
                          </div>
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Previous: {Number(txn.previous_kg).toFixed(2)} kg, ₹{Number(txn.previous_amount).toFixed(2)}</span>
                          <span className="font-semibold text-foreground">Total: {Number(txn.new_total_kg).toFixed(2)} kg, ₹{Number(txn.new_total_amount).toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Sales History */}
              <div className="border rounded-lg p-4">
                <h3 className="text-sm font-semibold mb-3">Sales History ({historySoldTo.length})</h3>
                {historySoldTo.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4 text-sm">No sales yet</p>
                ) : (
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {historySoldTo.map((sale) => (
                      <div key={sale.id} className="border rounded p-3 hover:bg-accent/50 transition-colors">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="text-sm font-semibold">{sale.customer_name}</p>
                            <p className="text-xs text-muted-foreground">{sale.customer_mobile || 'No mobile'}</p>
                          </div>
                          <p className="text-xs text-muted-foreground">{new Date(sale.sale_date).toLocaleDateString()}</p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-900 rounded p-2 mb-2">
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-muted-foreground">Had:</span>
                              <span className="ml-1 font-medium">{Number(sale.previous_kg).toFixed(2)} kg</span>
                              <span className="ml-1 text-muted-foreground">₹{Number(sale.previous_amount).toFixed(2)}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-muted-foreground">Sold:</span>
                              <span className="ml-1 font-semibold text-green-600">{Number(sale.kg_sold).toFixed(2)} kg</span>
                              <span className="ml-1 font-semibold text-green-600">₹{Number(sale.amount_sold).toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Remaining: {Number(sale.remaining_kg).toFixed(2)} kg, ₹{Number(sale.remaining_amount).toFixed(2)}
                        </div>
                        {sale.notes && (
                          <p className="text-xs text-muted-foreground italic mt-1">Note: {sale.notes}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Data: only Amount and Weight, others blocked */}
      <Dialog open={!!addDataSeller} onOpenChange={() => { setAddDataSeller(null); setOriginalSeller(null); setIsCreatingNew(false); }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{isCreatingNew ? "Add New Seller" : "Add Data to Seller"}</DialogTitle>
          </DialogHeader>
          {addDataSeller && (
            <form onSubmit={handleAddDataUpdate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Read-only or editable based on mode */}
                <div className="space-y-2">
                  <Label>Seller Name {isCreatingNew && '*'}</Label>
                  <Input 
                    value={addDataSeller.name} 
                    onChange={isCreatingNew ? (e) => setAddDataSeller({ ...addDataSeller, name: e.target.value }) : undefined}
                    readOnly={!isCreatingNew} 
                    disabled={!isCreatingNew}
                    required={isCreatingNew}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Mobile {isCreatingNew && '*'}</Label>
                  <Input 
                    value={addDataSeller.mobile} 
                    onChange={isCreatingNew ? (e) => setAddDataSeller({ ...addDataSeller, mobile: e.target.value }) : undefined}
                    readOnly={!isCreatingNew} 
                    disabled={!isCreatingNew}
                    required={isCreatingNew}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Serial Number {isCreatingNew && '*'}</Label>
                  <Input 
                    value={addDataSeller.serial_number} 
                    onChange={isCreatingNew ? (e) => setAddDataSeller({ ...addDataSeller, serial_number: e.target.value }) : undefined}
                    readOnly={!isCreatingNew} 
                    disabled={!isCreatingNew}
                    required={isCreatingNew}
                    placeholder={isCreatingNew ? "Enter unique serial number" : ""}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Address {isCreatingNew && '*'}</Label>
                  <Textarea 
                    value={addDataSeller.address} 
                    onChange={isCreatingNew ? (e) => setAddDataSeller({ ...addDataSeller, address: e.target.value }) : undefined}
                    readOnly={!isCreatingNew} 
                    disabled={!isCreatingNew}
                    rows={3}
                    required={isCreatingNew}
                  />
                </div>
                {/* Editable fields at the end */}
                <div className="space-y-2">
                  <Label>Date *</Label>
                  <Input
                    type="date"
                    value={addDataSeller.date}
                    onChange={(e) => setAddDataSeller({ ...addDataSeller, date: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>{isCreatingNew ? 'Weight (kg)' : 'Add Weight (kg)'} *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={addDataSeller.kg === 0 ? '' : addDataSeller.kg}
                    onChange={(e) => setAddDataSeller({ ...addDataSeller, kg: parseFloat(e.target.value) || 0 })}
                    required
                    placeholder={isCreatingNew ? "Enter weight" : "Enter weight to add"}
                  />
                  {!isCreatingNew && originalSeller && (
                    <p className="text-xs text-muted-foreground">
                      Current: {Number(originalSeller.kg).toFixed(2)} kg → New Total: {(Number(originalSeller.kg) + Number(addDataSeller.kg || 0)).toFixed(2)} kg
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>{isCreatingNew ? 'Amount (₹)' : 'Add Amount (₹)'} *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={addDataSeller.amount === 0 ? '' : addDataSeller.amount}
                    onChange={(e) => setAddDataSeller({ ...addDataSeller, amount: parseFloat(e.target.value) || 0 })}
                    required
                    placeholder={isCreatingNew ? "Enter amount" : "Enter amount to add"}
                  />
                  {!isCreatingNew && originalSeller && (
                    <p className="text-xs text-muted-foreground">
                      Current: ₹{Number(originalSeller.amount).toFixed(2)} → New Total: ₹{(Number(originalSeller.amount) + Number(addDataSeller.amount || 0)).toFixed(2)}
                    </p>
                  )}
                </div>
              </div>
              
              {/* Summary Card - Only show when adding data, not creating new */}
              {!isCreatingNew && originalSeller && (
                <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                <h4 className="font-semibold text-sm mb-2">Summary</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Previous Weight:</span>
                    <span className="ml-2 font-medium">{Number(originalSeller.kg).toFixed(2)} kg</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Previous Amount:</span>
                    <span className="ml-2 font-medium">₹{Number(originalSeller.amount).toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Adding:</span>
                    <span className="ml-2 font-medium text-blue-600">+{Number(addDataSeller.kg).toFixed(2)} kg</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Adding:</span>
                    <span className="ml-2 font-medium text-blue-600">+₹{Number(addDataSeller.amount).toFixed(2)}</span>
                  </div>
                  <div className="font-semibold text-green-600">
                    <span>New Total:</span>
                    <span className="ml-2">{(Number(originalSeller.kg) + Number(addDataSeller.kg)).toFixed(2)} kg</span>
                  </div>
                  <div className="font-semibold text-green-600">
                    <span>New Total:</span>
                    <span className="ml-2">₹{(Number(originalSeller.amount) + Number(addDataSeller.amount)).toFixed(2)}</span>
                  </div>
                </div>
              </div>
              )}

              <div className="flex gap-2">
                <Button type="submit" disabled={loading}>
                  {loading ? (isCreatingNew ? "Creating..." : "Adding...") : (isCreatingNew ? "Create Seller" : "Add Data")}
                </Button>
                <Button type="button" variant="outline" onClick={() => { setAddDataSeller(null); setOriginalSeller(null); setIsCreatingNew(false); }}>
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Seller Details/Summary Dialog */}
      <Dialog open={!!viewingSeller} onOpenChange={() => { setViewingSeller(null); setTransactions([]); setSoldToTransactionsForView([]); }}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Seller Summary</DialogTitle>
          </DialogHeader>
          {viewingSeller && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Side - Seller Info & Purchase History */}
              <div className="space-y-4">
                {/* Basic Info - Simple Table */}
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <tbody className="divide-y">
                      <tr className="hover:bg-accent/50">
                        <td className="px-4 py-3 text-sm font-medium text-muted-foreground w-1/3">Serial Number</td>
                        <td className="px-4 py-3 text-sm font-semibold">{viewingSeller.serial_number}</td>
                      </tr>
                      <tr className="hover:bg-accent/50">
                        <td className="px-4 py-3 text-sm font-medium text-muted-foreground">Name</td>
                        <td className="px-4 py-3 text-sm font-semibold">{viewingSeller.name}</td>
                      </tr>
                      <tr className="hover:bg-accent/50">
                        <td className="px-4 py-3 text-sm font-medium text-muted-foreground">Mobile</td>
                        <td className="px-4 py-3 text-sm font-semibold">{viewingSeller.mobile}</td>
                      </tr>
                      <tr className="hover:bg-accent/50">
                        <td className="px-4 py-3 text-sm font-medium text-muted-foreground">Address</td>
                        <td className="px-4 py-3 text-sm">{viewingSeller.address}</td>
                      </tr>
                      <tr className="hover:bg-accent/50">
                        <td className="px-4 py-3 text-sm font-medium text-muted-foreground">Last Updated</td>
                        <td className="px-4 py-3 text-sm">{new Date(viewingSeller.date).toLocaleDateString()}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Current Totals - Simple Cards */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="border rounded-lg p-4 text-center bg-blue-50 dark:bg-blue-950">
                    <p className="text-xs text-muted-foreground mb-1">Total Weight</p>
                    <p className="text-2xl font-bold text-blue-600">{Number(viewingSeller.kg).toFixed(2)} kg</p>
                  </div>
                  <div className="border rounded-lg p-4 text-center bg-green-50 dark:bg-green-950">
                    <p className="text-xs text-muted-foreground mb-1">Total Amount</p>
                    <p className="text-2xl font-bold text-green-600">₹{Number(viewingSeller.amount).toFixed(2)}</p>
                  </div>
                </div>

                {(() => {
                  const sellerId = viewingSeller.id;
                  const clearedAtStr = getLastClearedAt(sellerId);
                  const clearedAt = clearedAtStr ? new Date(clearedAtStr).getTime() : 0;
                  const recv = (transactions || [])
                    .filter(t => !clearedAt || new Date((t as any).created_at || t.transaction_date).getTime() > clearedAt)
                    .reduce(
                      (acc, t) => ({ kg: acc.kg + Number(t.kg_added || 0), amt: acc.amt + Number(t.amount_added || 0) }),
                      { kg: 0, amt: 0 }
                    );
                  const sales = (viewingSoldTo || [])
                    .filter(s => !clearedAt || new Date((s as any).created_at || s.sale_date).getTime() > clearedAt)
                    .reduce(
                      (acc, s) => ({ kg: acc.kg + Number(s.kg_sold || 0), amt: acc.amt + Number(s.amount_sold || 0) }),
                      { kg: 0, amt: 0 }
                    );
                  return (
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold text-muted-foreground">Period Totals {clearedAt ? `(since ${new Date(clearedAt).toLocaleDateString()})` : ''}</p>
                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-2 text-xs text-muted-foreground">
                            <input type="checkbox" checked={clearConfirm} onChange={(e) => setClearConfirm(e.target.checked)} />
                            Clear period
                          </label>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={!clearConfirm}
                            onClick={() => {
                              setLastClearedNow(sellerId);
                              setClearConfirm(false);
                              setViewingSeller({ ...viewingSeller });
                            }}
                            className="h-7 text-xs"
                          >
                            Clear Now
                          </Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="border rounded-lg p-4 text-center bg-blue-50 dark:bg-blue-950">
                          <p className="text-xs text-muted-foreground mb-1">Receiver Total (Purchases)</p>
                          <p className="text-sm font-semibold text-blue-700">{recv.kg.toFixed(2)} kg</p>
                          <p className="text-lg font-bold text-blue-600">₹{recv.amt.toFixed(2)}</p>
                        </div>
                        <div className="border rounded-lg p-4 text-center bg-amber-50 dark:bg-amber-950">
                          <p className="text-xs text-muted-foreground mb-1">Sales Total</p>
                          <p className="text-sm font-semibold text-amber-700">{sales.kg.toFixed(2)} kg</p>
                          <p className="text-lg font-bold text-amber-600">₹{sales.amt.toFixed(2)}</p>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Purchase History (Brought From) */}
                <div className="border rounded-lg p-4">
                  <h3 className="text-sm font-semibold mb-3">Purchase History ({transactions.length})</h3>
                  <p className="text-xs text-muted-foreground mb-2">Brought from seller</p>
                  {loadingTransactions ? (
                    <p className="text-center text-muted-foreground py-4 text-sm">Loading...</p>
                  ) : transactions.length === 0 ? (
                    <p className="text-center text-muted-foreground py-4 text-sm">No purchases yet</p>
                  ) : (
                    <div className="max-h-64 overflow-y-auto space-y-2">
                      {transactions.map((txn, index) => (
                        <div key={txn.id} className="border rounded p-3 hover:bg-accent/50 transition-colors">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <p className="text-xs font-semibold text-primary">#{transactions.length - index}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(txn.transaction_date).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-semibold text-blue-600">+{Number(txn.kg_added).toFixed(2)} kg</p>
                              <p className="text-xs font-semibold text-green-600">+₹{Number(txn.amount_added).toFixed(2)}</p>
                            </div>
                          </div>
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Previous: {Number(txn.previous_kg).toFixed(2)} kg, ₹{Number(txn.previous_amount).toFixed(2)}</span>
                            <span className="font-semibold text-foreground">Total: {Number(txn.new_total_kg).toFixed(2)} kg, ₹{Number(txn.new_total_amount).toFixed(2)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Side - Sales History (Sold To) */}
              <div className="border rounded-lg p-4">
                <div className="flex justify-between items-center mb-3">
                  <div>
                    <h3 className="text-sm font-semibold">Sales History ({viewingSoldTo.length})</h3>
                    <p className="text-xs text-muted-foreground">Sold to customers</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSoldToSeller(viewingSeller);
                      setSoldToData({
                        customer_name: '',
                        customer_mobile: '',
                        sale_date: new Date().toISOString().slice(0, 10),
                        kg_sold: '' as any,
                        amount_sold: '' as any,
                        notes: '',
                      });
                      setViewingSeller(null);
                    }}
                    className="gap-1 text-green-600 hover:text-green-700 border-green-200"
                  >
                    <Plus className="w-3 h-3" />
                    Add Sale
                  </Button>
                </div>

                {/* Sales Summary */}
                {viewingSoldTo.length > 0 && (
                  <div className="mb-3">
                    {(() => {
                      // Get the first sale's previous values (original stock)
                      const firstSale = viewingSoldTo[viewingSoldTo.length - 1];
                      const originalKg = Number(firstSale?.previous_kg || 0);
                      const originalAmount = Number(firstSale?.previous_amount || 0);
                      const totalKgSold = viewingSoldTo.reduce((sum, sale) => sum + Number(sale.kg_sold), 0);
                      const totalAmountSold = viewingSoldTo.reduce((sum, sale) => sum + Number(sale.amount_sold), 0);
                      
                      return (
                        <>
                          {/* Original Total */}
                          <p className="text-xs font-semibold text-muted-foreground mb-2">Original Total</p>
                          <div className="grid grid-cols-2 gap-3 mb-4">
                            <div className="border rounded-lg p-4 text-center bg-blue-50 dark:bg-blue-950">
                              <p className="text-xs text-muted-foreground mb-1">Total Weight</p>
                              <p className="text-2xl font-bold text-blue-600">{originalKg.toFixed(2)} kg</p>
                            </div>
                            <div className="border rounded-lg p-4 text-center bg-green-50 dark:bg-green-950">
                              <p className="text-xs text-muted-foreground mb-1">Total Amount</p>
                              <p className="text-2xl font-bold text-green-600">₹{originalAmount.toFixed(2)}</p>
                            </div>
                          </div>

                          {/* Total Sold */}
                          <p className="text-xs font-semibold text-muted-foreground mb-2">Total Sold</p>
                          <div className="grid grid-cols-2 gap-3 mb-3">
                            <div className="border rounded-lg p-4 text-center bg-blue-50 dark:bg-blue-950">
                              <p className="text-xs text-muted-foreground mb-1">Total Weight</p>
                              <p className="text-2xl font-bold text-blue-600">{totalKgSold.toFixed(2)} kg</p>
                            </div>
                            <div className="border rounded-lg p-4 text-center bg-green-50 dark:bg-green-950">
                              <p className="text-xs text-muted-foreground mb-1">Total Amount</p>
                              <p className="text-2xl font-bold text-green-600">₹{totalAmountSold.toFixed(2)}</p>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}

                {loadingSoldToView ? (
                  <p className="text-center text-muted-foreground py-4 text-sm">Loading...</p>
                ) : viewingSoldTo.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4 text-sm">No sales yet</p>
                ) : (
                  <div className="max-h-[500px] overflow-y-auto space-y-2">
                    {viewingSoldTo.map((sale, index) => (
                      <div key={sale.id} className="border rounded p-3 hover:bg-accent/50 transition-colors">
                        {/* Header with Customer & Date */}
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="text-sm font-semibold">{sale.customer_name}</p>
                            <p className="text-xs text-muted-foreground">{sale.customer_mobile || 'No mobile'}</p>
                          </div>
                          <p className="text-xs text-muted-foreground">{new Date(sale.sale_date).toLocaleDateString()}</p>
                        </div>

                        {/* Stock Info: Previous → Sold */}
                        <div className="bg-gray-50 dark:bg-gray-900 rounded p-2 mb-2">
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-muted-foreground">Had:</span>
                              <span className="ml-1 font-medium">{Number(sale.previous_kg).toFixed(2)} kg</span>
                              <span className="ml-1 text-muted-foreground">₹{Number(sale.previous_amount).toFixed(2)}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-muted-foreground">Sold:</span>
                              <span className="ml-1 font-semibold text-green-600">{Number(sale.kg_sold).toFixed(2)} kg</span>
                              <span className="ml-1 font-semibold text-green-600">₹{Number(sale.amount_sold).toFixed(2)}</span>
                            </div>
                          </div>
                        </div>

                        {/* Remaining Stock */}
                        <div className="mb-2">
                          <span className="text-xs text-muted-foreground">
                            Remaining: {Number(sale.remaining_kg).toFixed(2)} kg, ₹{Number(sale.remaining_amount).toFixed(2)}
                          </span>
                        </div>

                        {sale.notes && (
                          <p className="text-xs text-muted-foreground italic mb-2">Note: {sale.notes}</p>
                        )}

                        {/* Action Buttons */}
                        <div className="flex gap-2 mt-2 pt-2 border-t">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingSale(sale)}
                            className="flex-1 gap-1"
                          >
                            <Edit className="w-3 h-3" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDeletingSale(sale)}
                            className="flex-1 gap-1 text-red-600 hover:text-red-700 border-red-200"
                          >
                            <Trash2 className="w-3 h-3" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          
          {viewingSeller && (
            <div className="flex gap-2 pt-4 border-t mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setViewingSeller(null);
                    setEditingSeller(viewingSeller);
                  }}
                >
                  <Edit className="w-3 h-3 mr-1" />
                  Edit
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => {
                    setOriginalSeller(viewingSeller);
                    setAddDataSeller({
                      ...viewingSeller,
                      amount: '' as any,
                      kg: '' as any,
                      date: new Date().toISOString().slice(0, 10),
                    });
                    setViewingSeller(null);
                  }}
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add Data
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setViewingSeller(null)}
                >
                  Close
                </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Sold To Dialog */}
      <Dialog open={!!soldToSeller} onOpenChange={() => setSoldToSeller(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Sale - {soldToSeller?.name}</DialogTitle>
          </DialogHeader>
          {soldToSeller && (
            <form onSubmit={handleSoldTo} className="space-y-3">
                  {/* Current Stock Info */}
                  <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg border">
                    <p className="text-xs text-muted-foreground mb-1">Available Stock</p>
                    <div className="flex justify-between text-sm font-semibold">
                      <span>{Number(soldToSeller.kg).toFixed(2)} kg</span>
                      <span>₹{Number(soldToSeller.amount).toFixed(2)}</span>
                    </div>
                  </div>

              <div className="space-y-2">
                <Label>Customer Name *</Label>
                <Input
                  value={soldToData.customer_name}
                  onChange={(e) => setSoldToData({ ...soldToData, customer_name: e.target.value })}
                  placeholder="Enter customer name"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Customer Mobile</Label>
                <Input
                  value={soldToData.customer_mobile}
                  onChange={(e) => setSoldToData({ ...soldToData, customer_mobile: e.target.value })}
                  placeholder="Enter mobile number (optional)"
                />
              </div>

              <div className="space-y-2">
                <Label>Sale Date *</Label>
                <Input
                  type="date"
                  value={soldToData.sale_date}
                  onChange={(e) => setSoldToData({ ...soldToData, sale_date: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center gap-2">
                  <Label>Weight Sold (kg) *</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const f = 1;
                      setSoldToData({
                        ...soldToData,
                        kg_sold: Number((soldToSeller.kg * f).toFixed(2)),
                        amount_sold: Number((soldToSeller.amount * f).toFixed(2))
                      });
                    }}
                    className="text-xs h-6"
                  >
                    Max
                  </Button>
                </div>
                <Input
                  type="number"
                  step="0.01"
                  value={soldToData.kg_sold === 0 ? '' : soldToData.kg_sold}
                  onChange={(e) => setSoldToData({ ...soldToData, kg_sold: parseFloat(e.target.value) || 0 })}
                  placeholder="Enter weight sold"
                  required
                  max={soldToSeller.kg}
                />
                {(() => {
                  const remaining = Number(soldToSeller.kg) - Number(soldToData.kg_sold || 0);
                  const over = remaining < 0;
                  return (
                    <p className={`text-xs ${over ? 'text-red-600' : 'text-muted-foreground'}`}>
                      {over ? 'Exceeds available stock' : `Remaining: ${remaining.toFixed(2)} kg`}
                    </p>
                  );
                })()}
              </div>

              <div className="space-y-2">
                <Label>Amount Sold (₹) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={soldToData.amount_sold === 0 ? '' : soldToData.amount_sold}
                  onChange={(e) => setSoldToData({ ...soldToData, amount_sold: parseFloat(e.target.value) || 0 })}
                  placeholder="Enter amount sold"
                  required
                  max={soldToSeller.amount}
                />
                {(() => {
                  const remaining = Number(soldToSeller.amount) - Number(soldToData.amount_sold || 0);
                  const over = remaining < 0;
                  return (
                    <p className={`text-xs ${over ? 'text-red-600' : 'text-muted-foreground'}`}>
                      {over ? 'Exceeds available amount' : `Remaining: ₹${remaining.toFixed(2)}`}
                    </p>
                  );
                })()}
              </div>

              <div className="space-y-2">
                <Label>Notes (Optional)</Label>
                <Textarea
                  value={soldToData.notes}
                  onChange={(e) => setSoldToData({ ...soldToData, notes: e.target.value })}
                  placeholder="Add any notes about this sale"
                  rows={2}
                />
              </div>

              {(() => {
                const kg = Number(soldToData.kg_sold || 0);
                const amt = Number(soldToData.amount_sold || 0);
                const overKg = kg > Number(soldToSeller.kg);
                const overAmt = amt > Number(soldToSeller.amount);
                const disabled = loading || overKg || overAmt || kg <= 0 || amt <= 0;
                return (
                  <div className="flex flex-col gap-2 pt-2">
                    {(overKg || overAmt) && (
                      <div className="text-xs text-red-600">
                        {overKg && <p>Weight sold exceeds available stock.</p>}
                        {overAmt && <p>Amount sold exceeds available amount.</p>}
                      </div>
                    )}
                    <Button type="submit" disabled={disabled} className="flex-1">
                      {loading ? "Recording..." : "Record Sale"}
                    </Button>
                  </div>
                );
              })()}
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Sale Dialog */}
      <Dialog open={!!editingSale} onOpenChange={() => setEditingSale(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Sale</DialogTitle>
          </DialogHeader>
          {editingSale && (
            <form onSubmit={handleEditSale} className="space-y-3">
              <div className="space-y-2">
                <Label>Customer Name *</Label>
                <Input
                  value={editingSale.customer_name}
                  onChange={(e) => setEditingSale({ ...editingSale, customer_name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Customer Mobile</Label>
                <Input
                  value={editingSale.customer_mobile}
                  onChange={(e) => setEditingSale({ ...editingSale, customer_mobile: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Sale Date *</Label>
                <Input
                  type="date"
                  value={editingSale.sale_date}
                  onChange={(e) => setEditingSale({ ...editingSale, sale_date: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={editingSale.notes}
                  onChange={(e) => setEditingSale({ ...editingSale, notes: e.target.value })}
                  rows={2}
                />
              </div>
              <div className="bg-yellow-50 dark:bg-yellow-950 p-3 rounded border border-yellow-200">
                <p className="text-xs text-muted-foreground">
                  Note: You can only edit customer details and notes. Sale amounts cannot be changed.
                </p>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={loading} className="flex-1">
                  {loading ? "Updating..." : "Update Sale"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setEditingSale(null)}>
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Sale Confirmation */}
      <AlertDialog open={!!deletingSale} onOpenChange={() => setDeletingSale(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Sale?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the sale to{" "}
              <span className="font-medium">{deletingSale?.customer_name}</span>?
              <br /><br />
              This will restore <span className="font-semibold">{Number(deletingSale?.kg_sold).toFixed(2)} kg</span> and{" "}
              <span className="font-semibold">₹{Number(deletingSale?.amount_sold).toFixed(2)}</span> back to the seller's stock.
              <br /><br />
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSale} disabled={loading} className="bg-red-600 hover:bg-red-700">
              {loading ? "Deleting..." : "Delete Sale"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Seller Confirmation */}
      <AlertDialog open={!!deletingSeller} onOpenChange={() => setDeletingSeller(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the seller record for{" "}
              <span className="font-medium">{deletingSeller?.name}</span> (Serial: {deletingSeller?.serial_number}).
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={loading}>
              {loading ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
