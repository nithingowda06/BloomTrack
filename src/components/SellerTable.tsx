import React, { useEffect, useState } from "react";
import { sellerApi, profileApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Edit, Plus, Trash2, Download } from "lucide-react";
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

interface SaleToContact {
  id: string;
  seller_id: string;
  name: string;
  mobile?: string;
  address?: string;
  created_at: string;
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
  salesman_name?: string;
  salesman_mobile?: string;
  salesman_address?: string;
  less_weight?: number;
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
  // Add Data dialog mode: receive (add to stock) or sale (sold to)
  const [addMode, setAddMode] = useState<'receive' | 'sale'>('receive');
  // Flower selection for Add Data (receive)
  const [flowerChoice, setFlowerChoice] = useState<string>('');
  const [flowerOther, setFlowerOther] = useState<string>('');
  // Inline badges for per-update sales acknowledgement
  const [soldBadges, setSoldBadges] = useState<Record<string, string>>({});
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
  // Edit/Delete a single purchase transaction
  const [editingTxn, setEditingTxn] = useState<Transaction | null>(null);
  const [editingTxnSeller, setEditingTxnSeller] = useState<Seller | null>(null);
  const [deletingTxn, setDeletingTxn] = useState<Transaction | null>(null);
  const [deletingTxnSeller, setDeletingTxnSeller] = useState<Seller | null>(null);
  // Table-level transactions map for always-visible child rows
  const [tableTransactions, setTableTransactions] = useState<Record<string, Transaction[]>>({});
  // Table-level sold-to map for totals at bottom
  const [tableSoldTo, setTableSoldTo] = useState<Record<string, SoldToTransaction[]>>({});
  // Simple Sales prompt (from Updates row action)
  const [salesPromptOpen, setSalesPromptOpen] = useState(false);
  const [salesPromptData, setSalesPromptData] = useState<{ name: string; number?: string; address?: string; weight?: number; amount?: number; full?: boolean }>({ name: '' });
  const [salesTxn, setSalesTxn] = useState<Transaction | null>(null);
  const [salesSeller, setSalesSeller] = useState<Seller | null>(null);
  const [saleToForView, setSaleToForView] = useState<SaleToContact[]>([]);
  const [salesSaving, setSalesSaving] = useState(false);
  // Advance payment dialog state
  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [advanceSeller, setAdvanceSeller] = useState<Seller | null>(null);
  const [advanceAmount, setAdvanceAmount] = useState<string>('');
  const [advanceNotes, setAdvanceNotes] = useState<string>('');
  const [advanceSaving, setAdvanceSaving] = useState(false);
  const [advanceDate, setAdvanceDate] = useState<string>('');
  const [advanceTxnId, setAdvanceTxnId] = useState<string | null>(null);
  const [advanceExistingAmt, setAdvanceExistingAmt] = useState<number>(0);

  // Helper: normalize any input date to YYYY-MM-DD
  const toYMD = (v: any) => {
    const s = String(v || '').trim();
    if (!s) return '';
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const d = new Date(s);
    return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
  };
  // Helper: normalize to local calendar day (avoids UTC shift for ISO timestamps)
  const calendarYMD = (v: any) => {
    const s = String(v || '').trim();
    if (!s) return '';
    if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
      const dt = new Date(s);
      if (isNaN(dt.getTime())) return '';
      const yy = dt.getFullYear();
      const mm = String(dt.getMonth() + 1).padStart(2, '0');
      const dd = String(dt.getDate()).padStart(2, '0');
      return `${yy}-${mm}-${dd}`;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) { const [, dd, mm, yyyy] = m; return `${yyyy}-${mm}-${dd}`; }
    const dt = new Date(s);
    if (isNaN(dt.getTime())) return '';
    const yy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
  };
  // Persist/restore Sold status per update using localStorage
  const SOLD_BADGES_KEY = 'seller_sold_badges_v1';
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SOLD_BADGES_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') setSoldBadges(parsed);
      }
    } catch {}
  }, []);
  const writeSoldBadges = (next: Record<string, string>) => {
    try { localStorage.setItem(SOLD_BADGES_KEY, JSON.stringify(next)); } catch {}
  };
  // Table-level payments map (persisted to Neon)
  const [tablePayments, setTablePayments] = useState<Record<string, Array<{ id: string; paid_at: string; from_date?: string; to_date?: string; amount: number; cleared_kg: number }>>>({});
  // Period clear (local-only) UI state
  const [clearConfirm, setClearConfirm] = useState(false);
  // UI-only field for subtracting weight alongside net weight (no logic wired yet)
  const [minusKg, setMinusKg] = useState<number | ''>('');
  // UI-only rate input for calculation helper (does not affect save)
  const [ratePerKg, setRatePerKg] = useState<number | ''>('');
  // Track if user manually edited Amount to avoid overriding it automatically
  const [amountEdited, setAmountEdited] = useState<boolean>(false);
  // Optional advance amount to record immediately after adding data (form-level)
  const [addAdvanceAmount, setAddAdvanceAmount] = useState<string>('');
  

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
      const [txns, soldTo, profile] = await Promise.all([
        sellerApi.getTransactions(seller.id),
        sellerApi.getSoldToTransactions(seller.id),
        profileApi.get().catch(() => null),
      ]);
      // Compute totals from transactions
      const totalKg = (txns || []).reduce((sum, t: any) => sum + Number(t.kg_added || 0), 0);
      const totalAmount = (txns || []).reduce((sum, t: any) => sum + Number(t.amount_added || 0), 0);

      // Build sales map keyed by YYYY-MM-DD -> single latest customer name
      const toYMD = (v: any) => {
        const s = String(v || '').trim();
        if (!s) return '';
        // ISO: YYYY-MM-DD[...] -> YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
        // DMY: DD/MM/YYYY -> YYYY-MM-DD
        const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (m) {
          const [_, dd, mm, yyyy] = m;
          return `${yyyy}-${mm}-${dd}`;
        }
        // Fallback Date parse
        const d = new Date(s);
        return isNaN(d.getTime()) ? s : d.toISOString().slice(0, 10);
      };
      // Helper: normalize any input date to local YYYY-MM-DD (no timezone shift)
      const localYMD = (v: any) => {
        const s = String(v || '').trim();
        if (!s) return '';
        let y: number, m: number, d: number;
        if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
          const [yy, mm, dd] = s.slice(0,10).split('-');
          y = Number(yy); m = Number(mm); d = Number(dd);
        } else if (/^(\d{2})\/(\d{2})\/(\d{4})$/.test(s)) {
          const [, dd, mm, yyyy] = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)!;
          y = Number(yyyy); m = Number(mm); d = Number(dd);
        } else {
          const dt = new Date(s);
          if (isNaN(dt.getTime())) return '';
          y = dt.getFullYear(); m = dt.getMonth() + 1; d = dt.getDate();
        }
        const dtLocal = new Date(y, (m || 1) - 1, d || 1);
        const yy2 = dtLocal.getFullYear();
        const mm2 = String(dtLocal.getMonth() + 1).padStart(2, '0');
        const dd2 = String(dtLocal.getDate()).padStart(2, '0');
        return `${yy2}-${mm2}-${dd2}`;
      };

      // UI-equivalent calendar-day normalizer: if input has time (ISO with T), use local date; if plain Y-M-D, keep literal; if D/M/Y convert to Y-M-D
      const calendarYMD = (v: any) => {
        const s = String(v || '').trim();
        if (!s) return '';
        if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
          const dt = new Date(s);
          if (isNaN(dt.getTime())) return '';
          const yy = dt.getFullYear();
          const mm = String(dt.getMonth() + 1).padStart(2, '0');
          const dd = String(dt.getDate()).padStart(2, '0');
          return `${yy}-${mm}-${dd}`;
        }
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
        const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (m) { const [, dd, mm, yyyy] = m; return `${yyyy}-${mm}-${dd}`; }
        // Fallback: try Date and take local calendar day
        const dt = new Date(s);
        if (isNaN(dt.getTime())) return '';
        const yy = dt.getFullYear();
        const mm = String(dt.getMonth() + 1).padStart(2, '0');
        const dd = String(dt.getDate()).padStart(2, '0');
        return `${yy}-${mm}-${dd}`;
      };

      const salesByDate = new Map<string, string>();
      (soldTo || [])
        .slice()
        .sort((a: any, b: any) => new Date(a.sale_date).getTime() - new Date(b.sale_date).getTime())
        .forEach((s: any) => {
          const key = calendarYMD((s as any).sale_date);
          const name = String((s as any).customer_name || '').trim();
          if (!name) return;
          // Later entries overwrite, leaving the latest name for that date
          salesByDate.set(key, name);
        });

      const purchasesRows = (txns || []).map((t, i) => {
        const dateKey = calendarYMD((t as any).transaction_date);
        const soldToNamesForDate = (() => {
          const byTxn = String(((t as any).salesman_name || '').trim())
            || String(((soldBadges as any)?.[(t as any).id] || '').trim());
          return byTxn || (salesByDate.get(dateKey) || '');
        })();
        const dateDisplay = (() => { const [yy, mm, dd] = String(dateKey||'').split('-'); return (yy&&mm&&dd) ? `${dd}/${mm}/${yy}` : String(dateKey||''); })();
        return `
        <tr>
          <td style=\"padding:6px;border:1px solid #ddd;\">${i + 1}</td>
          <td style=\"padding:6px;border:1px solid #ddd;\">${dateDisplay}</td>
          <td style=\"padding:6px;border:1px solid #ddd;\">${(t as any).flower_name || ''}</td>
          <td style=\"padding:6px;border:1px solid #ddd;text-align:right;\">${Number(t.kg_added||0).toFixed(2)} kg</td>
          <td style=\"padding:6px;border:1px solid #ddd;text-align:right;\">₹${Number(t.amount_added||0).toFixed(2)}</td>
          <td style=\\\"padding:6px;border:1px solid #ddd;\\\">${soldToNamesForDate}</td>
        </tr>`;
      }).join('');

      const shopName = (profile && ((profile as any).shop_name || (profile as any).shopName)) || '';
      const ownerName = (profile && ((profile as any).owner_name || (profile as any).ownerName)) || '';
      const ownerMobile = (profile && (profile as any).mobile) || '';

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
            <div class="muted">Mobile: ${seller.mobile || ''} · Date: ${(() => { const s = String((seller as any).date||''); const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : s; })()}</div>
            <div class="grid">
              <div class="card">
                <div class="muted">Weight</div>
                <div style="font-weight:700;">${Number(totalKg).toFixed(2)} kg</div>
              </div>
              <div class="card">
                <div class="muted">Amount</div>
                <div style="font-weight:700;">₹${Number(totalAmount).toFixed(2)}</div>
              </div>
            </div>

            <h2>Purchases</h2>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Date</th>
                  <th>Flower</th>
                  <th style="text-align:right;">Weight (kg)</th>
                  <th style="text-align:right;">Amount (₹)</th>
                  <th>Sold To</th>
                </tr>
              </thead>
              <tbody>
                ${purchasesRows || '<tr><td colspan="6" style="padding:10px;text-align:center;color:#6b7280;">No purchases</td></tr>'}
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
      const [txns, soldTo, profile] = await Promise.all([
        sellerApi.getTransactions(seller.id),
        sellerApi.getSoldToTransactions(seller.id),
        profileApi.get().catch(() => null),
      ]);

      const toYMD2 = (v: any) => {
        const s = String(v || '').trim();
        if (!s) return '';
        if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
        const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (m) {
          const [_, dd, mm, yyyy] = m;
          return `${yyyy}-${mm}-${dd}`;
        }
        const d = new Date(s);
        return isNaN(d.getTime()) ? s : d.toISOString().slice(0, 10);
      };
      // Helpers to match UI calendar-day behavior in this generator too
      const localYMD2 = (v: any) => {
        const s = String(v || '').trim();
        if (!s) return '';
        let y: number, m: number, d: number;
        if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
          const [yy, mm, dd] = s.slice(0,10).split('-');
          y = Number(yy); m = Number(mm); d = Number(dd);
        } else if (/^(\d{2})\/(\d{2})\/(\d{4})$/.test(s)) {
          const [, dd, mm, yyyy] = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)!;
          y = Number(yyyy); m = Number(mm); d = Number(dd);
        } else {
          const dt = new Date(s);
          if (isNaN(dt.getTime())) return '';
          y = dt.getFullYear(); m = dt.getMonth() + 1; d = dt.getDate();
        }
        const dtLocal = new Date(y, (m || 1) - 1, d || 1);
        const yy2 = dtLocal.getFullYear();
        const mm2 = String(dtLocal.getMonth() + 1).padStart(2, '0');
        const dd2 = String(dtLocal.getDate()).padStart(2, '0');
        return `${yy2}-${mm2}-${dd2}`;
      };
      const calendarYMD2 = (v: any) => {
        const s = String(v || '').trim();
        if (!s) return '';
        if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
          const dt = new Date(s);
          if (isNaN(dt.getTime())) return '';
          const yy = dt.getFullYear();
          const mm = String(dt.getMonth() + 1).padStart(2, '0');
          const dd = String(dt.getDate()).padStart(2, '0');
          return `${yy}-${mm}-${dd}`;
        }
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
        const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (m) { const [, dd, mm, yyyy] = m; return `${yyyy}-${mm}-${dd}`; }
        const dt = new Date(s);
        if (isNaN(dt.getTime())) return '';
        const yy = dt.getFullYear();
        const mm = String(dt.getMonth() + 1).padStart(2, '0');
        const dd = String(dt.getDate()).padStart(2, '0');
        return `${yy}-${mm}-${dd}`;
      };
      const salesByDate2 = new Map<string, string>();
      (soldTo || [])
        .slice()
        .sort((a: any, b: any) => new Date(a.sale_date).getTime() - new Date(b.sale_date).getTime())
        .forEach((s: any) => {
          const key = toYMD((s as any).sale_date);
          const name = String((s as any).customer_name || '').trim();
          if (!name) return;
          salesByDate2.set(key, name);
        });

      const purchasesRows = (txns || []).map((t, i) => {
        const dateKey = toYMD((t as any).transaction_date);
        const soldToNamesForDate = (() => {
          const byTxn = String(((t as any).salesman_name || '').trim())
            || String(((soldBadges as any)?.[(t as any).id] || '').trim());
          return byTxn || (salesByDate2.get(dateKey) || '');
        })();
        const dateDisplay = (() => { const [yy, mm, dd] = String(dateKey||'').split('-'); return (yy&&mm&&dd) ? `${dd}/${mm}/${yy}` : String(dateKey||'`'); })();
        return `
        <tr>
          <td style=\"padding:6px;border:1px solid #ddd;\">${i + 1}</td>
          <td style=\"padding:6px;border:1px solid #ddd;\">${dateDisplay}</td>
          <td style=\"padding:6px;border:1px solid #ddd;text-align:right;\">${Number(t.kg_added||0).toFixed(2)} kg</td>
          <td style=\"padding:6px;border:1px solid #ddd;text-align:right;\">₹${Number(t.amount_added||0).toFixed(2)}</td>
          <td style=\\\"padding:6px;border:1px solid #ddd;\\\">${soldToNamesForDate}</td>
        </tr>`;
      }).join('');

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
            <div class="muted">Mobile: ${seller.mobile || ''} · Date: ${(() => { const s = String((seller as any).date||''); const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : s; })()}</div>
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
                  <th>Sold To</th>
                </tr>
              </thead>
              <tbody>
                ${purchasesRows || '<tr><td colspan="5" style="padding:10px;text-align:center;color:#6b7280;">No purchases</td></tr>'}
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
      const badgesFromServer: Record<string, string> = {};
      for (const s of sellers) {
        try {
          const txns = await sellerApi.getTransactions(s.id);
          // Normalize dates to local calendar day to avoid timezone shifting
          const norm = (txns || []).map((t: any) => ({
            ...t,
            transaction_date: calendarYMD((t as any).transaction_date),
          }));
          map[s.id] = norm as any;
          // collect any persisted salesman_name to restore badges
          for (const t of norm || []) {
            const name = String((t as any).salesman_name || '').trim();
            if (name) badgesFromServer[(t as any).id] = name;
          }
        } catch {
          map[s.id] = [];
        }
      }
      if (!ignore) setTableTransactions(map);
      if (!ignore && Object.keys(badgesFromServer).length > 0) {
        setSoldBadges((prev) => {
          const next = { ...prev, ...badgesFromServer };
          writeSoldBadges(next);
          return next;
        });
      }
    };
    if (sellers && sellers.length > 0) loadAll();
    return () => { ignore = true; };
  }, [sellers]);

  // Load payments for all sellers shown in Search Results
  useEffect(() => {
    let ignore = false;
    const loadAllPayments = async () => {
      const map: Record<string, Array<{ id: string; paid_at: string; from_date?: string; to_date?: string; amount: number; cleared_kg: number }>> = {};
      for (const s of sellers) {
        try {
          const pays = await sellerApi.getPayments(s.id);
          map[s.id] = pays || [];
        } catch {
          map[s.id] = [];
        }
      }
      if (!ignore) setTablePayments(map);
    };
    if (sellers && sellers.length > 0) loadAllPayments();
    // Refresh on window focus and on payments:updated broadcast
    const onFocus = () => { if (!ignore && sellers && sellers.length > 0) loadAllPayments(); };
    const onPaymentsUpdated = () => { if (!ignore && sellers && sellers.length > 0) loadAllPayments(); };
    window.addEventListener('focus', onFocus);
    window.addEventListener('payments:updated', onPaymentsUpdated as EventListener);
    // Periodic refresh
    const timer = window.setInterval(() => { if (!ignore && sellers && sellers.length > 0) loadAllPayments(); }, 15000);
    return () => { ignore = true; window.removeEventListener('focus', onFocus); window.removeEventListener('payments:updated', onPaymentsUpdated as EventListener); window.clearInterval(timer); };
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
      // Basic validation: require positive numbers when adding
      const amtVal = Number(addDataSeller.amount);
      const kgVal = Number(addDataSeller.kg);
      if (!isCreatingNew) {
        if (!(kgVal > 0) || !(amtVal > 0)) {
          toast.error("Enter weight and amount greater than 0");
          setLoading(false);
          return;
        }
      }
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
        const createdTxn = await sellerApi.addTransaction(addDataSeller.id, {
          transaction_date: addDataSeller.date,
          amount_added: Number(addDataSeller.amount),
          kg_added: Number(addDataSeller.kg),
          previous_amount: Number(originalSeller.amount),
          previous_kg: Number(originalSeller.kg),
          new_total_amount: newAmount,
          new_total_kg: newKg,
          flower_name: (flowerChoice === 'Others' ? flowerOther.trim() : flowerChoice) || undefined,
          less_weight: (minusKg === '' ? undefined : Number(minusKg)),
        });

        // If Advance provided, record a payment for this date
        const adv = parseFloat(addAdvanceAmount || '');
        if (adv > 0) {
          try {
            await sellerApi.addPayment(addDataSeller.id, ({
              amount: adv,
              cleared_kg: 0,
              from_date: addDataSeller.date,
              to_date: addDataSeller.date,
              transaction_id: (createdTxn as any)?.id,
              notes: (flowerChoice ? `Advance for ${flowerChoice}` : undefined),
            } as any));
            // Refresh payments for this seller in table cache
            try {
              const pays = await sellerApi.getPayments(addDataSeller.id);
              setTablePayments((prev) => ({ ...prev, [addDataSeller.id]: pays || [] }));
            } catch {}
          } catch {}
        }

        toast.success(`Data added successfully! New Total: ₹${newAmount.toFixed(2)} | ${newKg.toFixed(2)} kg`);
      }
      
      setAddDataSeller(null);
      setOriginalSeller(null);
      setIsCreatingNew(false);
      setAddAdvanceAmount('');
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
      const norm = (data || []).map((t: any) => ({
        ...t,
        transaction_date: calendarYMD((t as any).transaction_date),
      }));
      setTransactions(norm as any);
      // Merge server-assigned salesman names into badges so they persist after reload
      try {
        const fromServer: Record<string, string> = {};
        for (const t of norm || []) {
          const name = String((t as any).salesman_name || '').trim();
          if (name) fromServer[(t as any).id] = name;
        }
        if (Object.keys(fromServer).length > 0) {
          setSoldBadges((prev) => {
            const next = { ...prev, ...fromServer };
            writeSoldBadges(next);
            return next;
          });
        }
      } catch {}
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
      // Also fetch latest sale_to contacts (sales names)
      try {
        const contacts = await sellerApi.getSaleToContacts(sellerId);
        setSaleToForView(contacts || []);
      } catch {}
    } catch (error: any) {
      toast.error("Failed to load sales history");
      setSoldToTransactionsForView([]);
      setSaleToForView([]);
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
      <Card className="surface-card shadow-md">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-2xl md:text-3xl font-bold tracking-tight">Sellers Data</h3>
              <p className="text-sm text-muted-foreground mt-1">Manage and review seller records and purchase updates</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="gradient"
                className="rounded-full shadow-md px-4 py-2 gap-2"
                onClick={() => {
                  if (!sellers || sellers.length === 0) {
                    toast.error("Search a seller first");
                    return;
                  }
                  const target = sellers[0];
                  setIsCreatingNew(false);
                  setOriginalSeller(target);
                  setAddDataSeller({
                    ...target,
                    amount: '' as any,
                    kg: '' as any,
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
            <Table className="text-base">
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Serial No.</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Mobile</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sellers.map((seller) => (
                  <React.Fragment key={seller.id}>
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
                      <TableCell className="max-w-xs truncate" title={seller.address || ''}>{seller.address}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-muted text-sm">
                          {new Date(seller.date).toLocaleDateString()}
                        </span>
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingSeller(seller)}
                            aria-label="Edit"
                            className="h-10 w-10"
                          >
                            <Edit className="w-5 h-5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownloadSellerPdfForSeller(seller)}
                            aria-label="Download PDF"
                            className="h-10 w-10"
                          >
                            <Download className="w-5 h-5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {/* Grouped by date with totals and per-date advances */}
                    {(() => {
                      const txns = (tableTransactions[seller.id] || [])
                        .filter((t) => Number(t.kg_added) !== 0 || Number(t.amount_added) !== 0);
                      if (txns.length === 0) return null;
                      const groups: Record<string, Transaction[]> = {};
                      for (const t of txns) {
                        const k = calendarYMD((t as any).transaction_date);
                        if (!k) continue;
                        (groups[k] ||= []).push(t);
                      }
                      const dates = Object.keys(groups).sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
                      return (
                        <>
                          {dates.map((dateKey) => {
                            const list = groups[dateKey].sort((a, b) => {
                              const ak = calendarYMD((a as any).transaction_date);
                              const bk = calendarYMD((b as any).transaction_date);
                              return ak < bk ? 1 : ak > bk ? -1 : 0;
                            });
                            const totalAmt = list.reduce((s, t) => s + Number((t as any).amount_added || 0), 0);
                            // Paid for this date: payments where from_date/to_date include this date, or fallback to paid_at date match
                            const pays = (tablePayments[seller.id] || []);
                            const paidAmt = (pays || []).reduce((s, p: any) => {
                              const amtNum = Number(String((p as any).amount ?? 0).toString().replace(/[^0-9.-]/g, '')) || 0;
                              const fdK = calendarYMD((p as any).from_date);
                              const tdK = calendarYMD((p as any).to_date);
                              const paK = calendarYMD((p as any).paid_at);
                              if (fdK && tdK) return (dateKey >= fdK && dateKey <= tdK) ? s + amtNum : s;
                              return (paK && paK === dateKey) ? s + amtNum : s;
                            }, 0);
                            const remaining = Math.max(0, totalAmt - paidAmt);
                            const displayDate = (() => { const [y,m,d] = dateKey.split('-'); return `${d}/${m}/${y}`; })();
                            return (
                              <React.Fragment key={dateKey}>
                                {list.map((txn, idx) => (
                                  <TableRow key={(txn as any).id} className={`${idx % 2 === 0 ? 'bg-accent/20' : 'bg-accent/40'} hover:bg-accent/50 cursor-pointer`} onClick={() => { setSelectedTxnSeller(seller); setSelectedTxn(txn); }}>
                                    <TableCell colSpan={6} className="py-2">
                                      <div className="flex items-center justify-between gap-3 px-2">
                                        <div className="flex items-center gap-3">
                                          <span className="inline-flex items-center justify-center w-6 h-6 text-xs font-semibold rounded-full bg-primary/10 text-primary">
                                            {/* index reset per date */}
                                          </span>
                                          <span className="text-sm text-muted-foreground">Update</span>
                                          {(() => {
                                            const key = calendarYMD((txn as any).transaction_date);
                                            const d = key && key.length >= 10 ? `${key.slice(8,10)}/${key.slice(5,7)}/${key.slice(0,4)}` : '—';
                                            return <span className="text-sm font-medium">{d}</span>;
                                          })()}
                                        </div>
                                        <div className="flex items-center gap-2 md:gap-3 flex-nowrap overflow-x-auto">
                                          {(() => {
                                            // Only show advance tied exactly to this transaction via transaction_id
                                            const paidAmtRow = (pays || []).reduce((s, p: any) => {
                                              const amtNum = Number(String((p as any).amount ?? 0).toString().replace(/[^0-9.-]/g, '')) || 0;
                                              const tid = (p as any).transaction_id;
                                              return (tid && tid === (txn as any).id) ? s + amtNum : s;
                                            }, 0);
                                            return (
                                              <span className="inline-flex flex-col items-center justify-center px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200 whitespace-nowrap h-10 leading-tight">
                                                <span className="opacity-80">Advance ₹</span>
                                                <span className="font-semibold">{paidAmtRow.toFixed(2)}</span>
                                              </span>
                                            );
                                          })()}
                                          <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border whitespace-nowrap h-7 ${soldBadges[(txn as any).id] ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-muted text-foreground border-muted-foreground/20'}`}>
                                            <span className="opacity-80">Status</span>
                                            <span>{soldBadges[(txn as any).id] ? `Sold to ${soldBadges[(txn as any).id]}` : '—'}</span>
                                          </span>
                                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border bg-violet-100 text-violet-700 border-violet-200 whitespace-nowrap h-7">
                                            <span className="opacity-80">Flower</span>
                                            <span>{(txn as any).flower_name || '—'}</span>
                                          </span>
                                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border bg-blue-100 text-blue-700 border-blue-200 whitespace-nowrap h-7">
                                            <span className="opacity-80">Net</span>
                                            <span>+{Number(txn.kg_added).toFixed(2)} kg</span>
                                          </span>
                                          {(() => {
                                            const net = Number((txn as any).kg_added || 0);
                                            const less = Number((txn as any).less_weight || 0);
                                            const eff = Math.max(0, net - less);
                                            const amt = Number((txn as any).amount_added || 0);
                                            const rate = eff > 0 ? amt / eff : 0;
                                            return (
                                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border bg-zinc-100 text-foreground border-zinc-200 whitespace-nowrap h-7">
                                                <span className="opacity-80">Rate</span>
                                                <span>{eff > 0 ? `₹${rate.toFixed(2)}/kg` : '—'}</span>
                                              </span>
                                            );
                                          })()}
                                          {/* Less chip removed from row view (shown in Update Details dialog) */}
                                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border bg-emerald-100 text-emerald-700 border-emerald-200 whitespace-nowrap h-7">
                                            <span className="opacity-80">Amount</span>
                                            <span>+₹{Number(txn.amount_added).toFixed(2)}</span>
                                          </span>
                                        </div>
                                        <div className="inline-flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                            <Button
                                              type="button"
                                              variant="outline"
                                              size="sm"
                                              className="text-sm h-8 text-red-600 border-red-200 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                              onClick={(e) => { 
                                                e.stopPropagation();
                                                if (!seller) {
                                                  console.error('No seller available for deletion');
                                                  toast.error('Cannot delete: Seller information is missing');
                                                  return;
                                                }
                                                setDeletingTxn(txn);
                                                setDeletingTxnSeller(seller);
                                                try { 
                                                  toast.message?.('Confirm delete…'); 
                                                } catch (e) {
                                                  console.error('Toast error:', e);
                                                }
                                              }}
                                              title="Delete this update"
                                            >
                                              Delete
                                            </Button>
                                            <Button
                                              type="button"
                                              variant="outline"
                                              size="sm"
                                              className="text-sm h-8"
                                              onClick={(e) => { e.stopPropagation(); setSelectedTxnSeller(seller); setSelectedTxn(txn); try { toast.message?.('Opening view…'); } catch {} }}
                                            >
                                              View
                                            </Button>
                                            <Button
                                              type="button"
                                              variant="outline"
                                              size="sm"
                                              className="text-sm h-8"
                                              onClick={(e) => { e.stopPropagation(); setSalesSeller(seller); setSalesTxn(txn); setSalesPromptData({ name: '', number: '', address: '', weight: Number((txn as any).kg_added || 0), amount: Number((txn as any).amount_added || 0), full: true }); setSalesPromptOpen(true); }}
                                              disabled={!!soldBadges[(txn as any).id]}
                                            >
                                              Sales
                                            </Button>
                                          </div>
                                        </div>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </React.Fragment>
                            );
                          })}
                        </>
                      );
                    })()}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      {/* Sales Prompt Dialog (from Updates row "Sales" button) */}
      <Dialog open={salesPromptOpen} onOpenChange={setSalesPromptOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Sales Details</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (salesSaving) return;
              if (!salesPromptData.name.trim()) { toast.error('Name is required'); return; }
              if (!salesSeller || !salesTxn) { toast.error('No update selected'); return; }
              try {
                setSalesSaving(true);
                // Save contact (optional convenience)
                await sellerApi.addSaleToContact(salesSeller.id, {
                  name: salesPromptData.name.trim(),
                  mobile: (salesPromptData.number || '').trim() || undefined,
                  address: (salesPromptData.address || '').trim() || undefined,
                });
                // Only set status on this update (no stock movement)
                await sellerApi.updateTransaction(
                  (salesSeller as any).id,
                  (salesTxn as any).id,
                  {
                    transaction_date: (salesTxn as any).transaction_date,
                    amount_added: Number((salesTxn as any).amount_added),
                    kg_added: Number((salesTxn as any).kg_added),
                    flower_name: ((salesTxn as any).flower_name || '').trim() || undefined,
                    salesman_name: salesPromptData.name.trim(),
                  }
                );
                toast.success('Status updated');
                // Mark this update row with a Sold to badge (and persist)
                try {
                  const txnId = (salesTxn as any)?.id as string;
                  if (txnId) {
                    setSoldBadges((prev) => {
                      const next = { ...prev, [txnId]: salesPromptData.name.trim() };
                      writeSoldBadges(next);
                      return next;
                    });
                  }
                } catch {}
                setSalesPromptOpen(false);
                // refresh contacts and transactions
                try { const contacts = await sellerApi.getSaleToContacts(salesSeller.id); setSaleToForView(contacts || []); } catch {}
                try { const txns = await sellerApi.getTransactions((salesSeller as any).id); setTableTransactions((prev) => ({ ...prev, [(salesSeller as any).id]: txns })); } catch {}
                // refresh payments as well to keep Advance totals consistent
                try { const pays = await sellerApi.getPayments((salesSeller as any).id); setTablePayments((prev) => ({ ...prev, [(salesSeller as any).id]: pays || [] })); } catch {}
              } catch (err: any) {
                toast.error(err?.message || 'Failed to save');
              } finally {
                setSalesSaving(false);
              }
            }}
            className="space-y-3"
          >
            {/* Only capture the name (status). No stock checks, no amounts. */}
            <div className="space-y-2">
              <Label>Name<span className="text-red-500">*</span></Label>
              <Input value={salesPromptData.name} onChange={(e) => setSalesPromptData({ ...salesPromptData, name: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Number (optional)</Label>
              <Input value={salesPromptData.number || ''} onChange={(e) => setSalesPromptData({ ...salesPromptData, number: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Address (optional)</Label>
              <Textarea value={salesPromptData.address || ''} onChange={(e) => setSalesPromptData({ ...salesPromptData, address: e.target.value })} rows={3} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setSalesPromptOpen(false)} disabled={salesSaving}>Cancel</Button>
              <Button type="submit" disabled={salesSaving}>{salesSaving ? 'Saving...' : 'Save'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Advance Payment Dialog */}
      <Dialog open={advanceOpen} onOpenChange={(open) => {
        setAdvanceOpen(open);
        if (!open) {
          setAdvanceSeller(null);
          setAdvanceAmount('');
          setAdvanceNotes('');
          setAdvanceDate('');
          setAdvanceTxnId(null);
        } else {
          // Default the date to the latest transaction date for this seller, else today
          try {
            const sid = (advanceSeller as any)?.id as string | undefined;
            const txns = sid ? (tableTransactions[sid] || []) : [];
            const latest = txns.slice().sort((a: any, b: any) => new Date(b.transaction_date || b.created_at).getTime() - new Date(a.transaction_date || a.created_at).getTime())[0];
            const def = latest ? toYMD((latest as any).transaction_date || (latest as any).created_at) : new Date().toISOString().slice(0, 10);
            setAdvanceDate(def);
          } catch {
            setAdvanceDate(new Date().toISOString().slice(0, 10));
          }
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Advance Payment</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (advanceSaving) return;
              const amt = parseFloat(advanceAmount || '');
              if (!(amt >= 0)) { toast.error('Enter advance amount (0 or more)'); return; }
              if (!advanceDate) { toast.error('Select a date for the advance'); return; }
              if (!advanceSeller) { toast.error('No seller selected'); return; }
              try {
                setAdvanceSaving(true);
                // Overwrite behavior: post only the difference so total equals edited amount
                const diff = amt - (advanceExistingAmt || 0);
                if (Math.abs(diff) < 0.000001) {
                  setAdvanceOpen(false);
                  setAdvanceSaving(false);
                  return;
                }
                await sellerApi.addPayment(advanceSeller.id, ({
                  amount: diff,
                  cleared_kg: 0,
                  from_date: advanceDate,
                  to_date: advanceDate,
                  transaction_id: advanceTxnId || undefined,
                  notes: advanceNotes || undefined,
                } as any));
                toast.success('Advance recorded');
                // Refresh table payments for this seller
                try {
                  const pays = await sellerApi.getPayments(advanceSeller.id);
                  setTablePayments((prev) => ({ ...prev, [advanceSeller.id]: pays || [] }));
                } catch {}
                // Notify and close
                setAdvanceOpen(false);
              } catch (err: any) {
                toast.error(err?.message || 'Failed to save advance');
              } finally {
                setAdvanceSaving(false);
              }
            }}
            className="space-y-3"
          >
            {advanceSeller && (
              <div className="text-sm text-muted-foreground">Seller: <span className="font-medium">{advanceSeller.serial_number} · {advanceSeller.name}</span></div>
            )}
            <div className="space-y-1">
              <Label>Date *</Label>
              <Input
                type="date"
                value={advanceDate}
                onChange={(e) => setAdvanceDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label>Advance Amount (₹)</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={advanceAmount}
                onChange={(e) => setAdvanceAmount(e.target.value)}
                placeholder="Enter advance amount"
                required
              />
            </div>
            <div className="space-y-1">
              <Label>Notes (optional)</Label>
              <Textarea
                value={advanceNotes}
                onChange={(e) => setAdvanceNotes(e.target.value)}
                placeholder="Any notes"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="submit" disabled={advanceSaving}>{advanceSaving ? 'Saving…' : 'Save Advance'}</Button>
              <Button type="button" variant="outline" onClick={() => setAdvanceOpen(false)}>Cancel</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
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

        // Sum payments across all sellers since clear (used for Advance tile)
        const paid = sellers.reduce(
          (acc, s) => {
            const pays = tablePayments[s.id] || [];
            for (const p of pays) {
              const ts = new Date((p as any).paid_at).getTime();
              if (!clearedAt || ts > clearedAt) {
                acc.kg += Number((p as any).cleared_kg || 0);
                acc.amt += Number((p as any).amount || 0);
              }
            }
            return acc;
          },
          { kg: 0, amt: 0 }
        );

        // Only show Advance tile for payments linked to visible transactions (transaction_id match)
        const allTxnIds = new Set<string>();
        for (const s2 of sellers) {
          for (const t of (tableTransactions[s2.id] || [])) {
            const id = String((t as any).id || '');
            if (id) allTxnIds.add(id);
          }
        }
        const linkedPaid = sellers.reduce(
          (acc, s) => {
            const pays = tablePayments[s.id] || [];
            for (const p of pays) {
              const tid = String((p as any).transaction_id || '');
              if (tid && allTxnIds.has(tid)) {
                acc.kg += Number((p as any).cleared_kg || 0);
                acc.amt += Number((p as any).amount || 0);
              }
            }
            return acc;
          },
          { kg: 0, amt: 0 }
        );

        // Show ONLY unpaid data: exclude transactions that are truly linked to a payment
        // via explicit transaction_id links. No date-range clearing here.
        const isTxnCleared = (sellerId: string, ymd: string, txnId: string): boolean => {
          const pays = tablePayments[sellerId] || [];
          for (const p of pays) {
            // New shape: payment has a transactions array
            const arr = (p as any)?.transactions;
            if (Array.isArray(arr) && arr.length > 0) {
              const hit = arr.some((it: any) => String(it?.transaction_id || '') === txnId && Number(it?.cleared_kg || 0) > 0);
              if (hit) return true;
            }
            // Legacy shape: single transaction_id on payment
            const linkedTid = String((p as any).transaction_id || '');
            const clearedKg = Number((p as any).cleared_kg || 0);
            if (linkedTid && txnId && linkedTid === txnId && clearedKg > 0) return true;
            // Range fallback: if no explicit links, but From..To includes this txn date and cleared_kg > 0, treat as cleared
            if (!Array.isArray(arr) || (Array.isArray(arr) && arr.length === 0)) {
              const fRaw = (p as any).from_date;
              const tRaw = (p as any).to_date;
              if (fRaw && tRaw && clearedKg > 0) {
                const f = toYMD(fRaw);
                const t = toYMD(tRaw);
                const y = ymd || '';
                if (f && t && y >= f && y <= t) return true;
              }
            }
          }
          return false;
        };

        // Fallback: treat as cleared if there is a local cached receipt OR local cleared-days cache
        // (immediate UI zero-after-pay, persists 24h; no backend change needed)
        const hasLocalCleared = (sellerId: string, ymd: string): boolean => {
          try {
            // New: payments_cleared_days
            const rawDays = localStorage.getItem('payments_cleared_days');
            if (rawDays) {
              const obj = JSON.parse(rawDays) || {};
              const bucket = obj[String(sellerId)] || {};
              const ts = bucket[ymd];
              if (ts && (Date.now() - Number(ts) <= 24*60*60*1000)) return true;
            }
          } catch {}
          try {
            // Legacy: payments_receipt_cache keyed by seller|from|to; we only have day key so we store same day in both from/to
            const raw = localStorage.getItem('payments_receipt_cache');
            if (!raw) return false;
            const cache = JSON.parse(raw) || {};
            const key = `${sellerId}|${ymd}|${ymd}`;
            const item = cache[key];
            if (!item) return false;
            if (item.ts && Date.now() - Number(item.ts) > 24*60*60*1000) return false;
            return true;
          } catch { return false; }
        };
        // If the search shows exactly one seller, compute Purchases Total ONLY for that seller.
        // Otherwise (multiple sellers), keep combined behavior.
        const scope = sellers && sellers.length === 1 ? [sellers[0]] : sellers;

        // Recompute remaining purchases: only include txns not covered by any payment range
        // Also collect the remaining transaction IDs so we only count advances linked to remaining items
        const remainingTxnIds = new Set<string>();
        const remainingTxnYmd = new Map<string, string>();
        const remainingYmdSet = new Set<string>();
        const rem = scope.reduce(
          (acc, s) => {
            const txns = tableTransactions[s.id] || [];
            for (const t of txns) {
              const ymd = toYMD((t as any).transaction_date);
              const tid = String((t as any).id || '');
              if (isTxnCleared(s.id, ymd, tid) || hasLocalCleared(s.id, ymd)) continue; // already cleared by payment or cached receipt
              acc.kg += Number((t as any).kg_added || 0);
              acc.amt += Number((t as any).amount_added || 0);
              if (tid) {
                remainingTxnIds.add(tid);
                remainingTxnYmd.set(tid, ymd);
              }
              if (ymd) remainingYmdSet.add(ymd);
            }
            return acc;
          },
          { kg: 0, amt: 0 }
        );
        const purchasesDisplay = {
          kg: Math.max(0, rem.kg),
          amt: Math.max(0, rem.amt),
        };
        // Advance: payments since clear AND linked to remaining (unpaid) transactions only
        let advanceSinceClearLinked = 0;
        for (const s2 of scope) {
          const pays = tablePayments[s2.id] || [];
          for (const p of pays) {
            const ts = new Date((p as any).paid_at).getTime();
            // New shape: payment has an array of linked transactions
            const arr = (p as any)?.transactions;
            if (Array.isArray(arr) && arr.length > 0) {
              const anyLinked = arr.some((it: any) => remainingTxnIds.has(String(it?.transaction_id || '')));
              if (anyLinked && (!clearedAt || ts > clearedAt)) {
                advanceSinceClearLinked += Number((p as any).amount || 0);
              }
              continue;
            }
            // Legacy: single linked transaction_id
            const tid = String((p as any).transaction_id || '');
            if (tid && remainingTxnIds.has(tid) && (!clearedAt || ts > clearedAt)) {
              advanceSinceClearLinked += Number((p as any).amount || 0);
              continue;
            }
            // Range fallback: if payment has no explicit links, count its advance only when
            // at least one remaining txn date falls within the payment From..To window
            const fRaw = (p as any).from_date;
            const tRaw = (p as any).to_date;
            const clearedKg = Number((p as any).cleared_kg || 0);
            if (fRaw && tRaw && clearedKg >= 0) {
              const f = toYMD(fRaw);
              const t = toYMD(tRaw);
              if (f && t) {
                let overlaps = false;
                for (const ymd of remainingYmdSet) { if (ymd >= f && ymd <= t) { overlaps = true; break; } }
                if (overlaps && (!clearedAt || ts > clearedAt)) {
                  advanceSinceClearLinked += Number((p as any).amount || 0);
                }
              }
            }
          }
        }
        // If nothing remains unpaid, advance display should be 0
        const advanceDisplay = (purchasesDisplay.kg === 0 && purchasesDisplay.amt === 0)
          ? 0
          : Math.max(0, advanceSinceClearLinked);

        if (recv.kg === 0 && recv.amt === 0 && sales.kg === 0 && sales.amt === 0) {
          return null;
        }
        return (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border rounded-lg p-4 bg-card shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="text-base font-semibold">Purchases Total</p>
                <div className="text-xs text-muted-foreground">
                  {sellers && sellers.length > 0 ? (
                    <span className="font-medium text-foreground">{sellers[0].serial_number}({sellers[0].name})</span>
                  ) : null}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-center">
                <div className="bg-blue-50 dark:bg-blue-950 rounded p-3 shadow-sm">
                  <p className="text-sm text-muted-foreground mb-1">Weight</p>
                  <p className="text-2xl font-bold text-blue-600">{purchasesDisplay.kg.toFixed(2)} kg</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-950 rounded p-3 shadow-sm">
                  <p className="text-sm text-muted-foreground mb-1">Amount</p>
                  <p className="text-2xl font-bold text-blue-600">₹{purchasesDisplay.amt.toFixed(2)}</p>
                </div>
                <div className="bg-amber-50 dark:bg-amber-950 rounded p-3 shadow-sm">
                  <p className="text-sm text-muted-foreground mb-1">Advance</p>
                  <p className="text-2xl font-bold text-amber-700">₹{advanceDisplay.toFixed(2)}</p>
                </div>
              </div>
              {/* Advances intentionally not shown in Purchases Total */}
              {viewingSeller ? (
                <div className="mt-3 text-sm text-muted-foreground">
                  <span className="font-medium">Serial:</span> {viewingSeller.serial_number} · <span className="font-medium">Seller:</span> {viewingSeller.name}
                </div>
              ) : null}
              {/* Removed Clear period/Now UI as requested */}
            </div>

            {/* Sales Total panel removed as requested */}
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
                <div className="space-y-2 md:col-span-2">
                  <Label>Address</Label>
                  <Textarea
                    value={editingSeller.address}
                    onChange={(e) => setEditingSeller({ ...editingSeller, address: e.target.value })}
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
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Update Details - {selectedTxnSeller?.name}</DialogTitle>
          </DialogHeader>
          {selectedTxn && (
            <div className="space-y-3">
              {selectedTxnSeller && (
                <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <div>
                      <span className="text-muted-foreground">Seller:</span> <span className="font-semibold">{selectedTxnSeller.name}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Serial:</span> <span className="font-medium">{selectedTxnSeller.serial_number}</span>
                    </div>
                    {selectedTxnSeller.mobile ? (
                      <div>
                        <span className="text-muted-foreground">Mobile:</span> <span className="font-medium">{selectedTxnSeller.mobile}</span>
                      </div>
                    ) : null}
                  </div>
                  {selectedTxnSeller.address ? (
                    <div className="mt-1 text-[12px] text-muted-foreground truncate">{selectedTxnSeller.address}</div>
                  ) : null}
                </div>
              )}
              {(() => {
                const dateKey = toYMD((selectedTxn as any).transaction_date || (selectedTxn as any).created_at);
                const pays = (selectedTxnSeller && tablePayments[(selectedTxnSeller as any).id]) || [];
                const paidAmt = pays.reduce((s: number, p: any) => {
                  const amtNum = Number(String((p as any).amount ?? 0).toString().replace(/[^0-9.-]/g, '')) || 0;
                  const fdK = toYMD((p as any).from_date);
                  const tdK = toYMD((p as any).to_date);
                  const paK = toYMD((p as any).paid_at);
                  if (fdK && tdK) {
                    return (dateKey >= fdK && dateKey <= tdK) ? s + amtNum : s;
                  }
                  return (paK && paK === dateKey) ? s + amtNum : s;
                }, 0);
                const statusName = (() => {
                  const id = (selectedTxn as any)?.id as string;
                  const badge = (soldBadges as any)[id];
                  const serverName = (selectedTxn as any).salesman_name;
                  return String(badge || serverName || '').trim();
                })();
                const displayDate = (() => { const [y,m,d] = dateKey.split('-'); return `${d}/${m}/${y}`; })();
                const less = Number((selectedTxn as any).less_weight || 0);
                const netKg = Number((selectedTxn as any).kg_added || 0);
                const effKg = Math.max(0, netKg - less);
                const amt = Number((selectedTxn as any).amount_added || 0);
                const rate = effKg > 0 ? amt / effKg : 0;
                return (
                  <div className="rounded-xl border bg-card p-4 shadow-sm">
                    <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Date & Flower */}
                      <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2">
                        <span className="text-sm text-muted-foreground">Date</span>
                        <span className="text-sm font-medium">{displayDate}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2">
                        <span className="text-sm text-muted-foreground">Flower</span>
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium border bg-violet-100 text-violet-700 border-violet-200">{(selectedTxn as any).flower_name || '—'}</span>
                      </div>
                      {/* Net & Less */}
                      <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2">
                        <span className="text-sm text-muted-foreground">Net Weight (kg)</span>
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold border bg-blue-100 text-blue-700 border-blue-200">+{netKg.toFixed(2)} kg</span>
                      </div>
                      <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2">
                        <span className="text-sm text-muted-foreground">Less Weight (kg)</span>
                        {less > 0 ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold border bg-blue-50 text-blue-700 border-blue-200">-{less.toFixed(2)} kg</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium border bg-muted text-foreground border-muted-foreground/20">—</span>
                        )}
                      </div>
                      {/* Rate & Amount */}
                      <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2">
                        <span className="text-sm text-muted-foreground">Rate (₹/kg)</span>
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold border bg-zinc-100 text-foreground border-zinc-200">{effKg > 0 ? `₹${rate.toFixed(2)}` : '—'}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2">
                        <span className="text-sm text-muted-foreground">Amount (₹)</span>
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold border bg-emerald-100 text-emerald-700 border-emerald-200">+₹{amt.toFixed(2)}</span>
                      </div>
                    </div>
                    {/* Advance */}
                    <div className="mt-3 flex items-center justify-end gap-2">
                      <span className="text-sm text-muted-foreground">Advance Paid</span>
                      {(() => {
                        const pays = (selectedTxnSeller && tablePayments[(selectedTxnSeller as any).id]) || [];
                        const perRow = (pays || []).reduce((s: number, p: any) => {
                          const amtNum = Number(String((p as any).amount ?? 0).toString().replace(/[^0-9.-]/g, '')) || 0;
                          const tid = (p as any).transaction_id;
                          if (tid && tid === (selectedTxn as any).id) return s + amtNum;
                          const fdK = toYMD((p as any).from_date);
                          const tdK = toYMD((p as any).to_date);
                          const paK = toYMD((p as any).paid_at);
                          const k = toYMD((selectedTxn as any).transaction_date || (selectedTxn as any).created_at);
                          if (fdK && tdK) return (k >= fdK && k <= tdK) ? s + amtNum : s;
                          return (paK && paK === k) ? s + amtNum : s;
                        }, 0);
                        return <span className="px-3 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 shadow-inner">₹{perRow.toFixed(2)}</span>;
                      })()}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          try {
                            if (selectedTxnSeller) setAdvanceSeller(selectedTxnSeller as any);
                            const k = toYMD((selectedTxn as any).transaction_date || (selectedTxn as any).created_at);
                            setAdvanceDate(k);
                            // compute existing per-row advance
                            const pays = (selectedTxnSeller && tablePayments[(selectedTxnSeller as any).id]) || [];
                            const perRow = (pays || []).reduce((s: number, p: any) => {
                              const amtNum = Number(String((p as any).amount ?? 0).toString().replace(/[^0-9.-]/g, '')) || 0;
                              const tid = (p as any).transaction_id;
                              if (tid && tid === (selectedTxn as any).id) return s + amtNum;
                              const fdK = toYMD((p as any).from_date);
                              const tdK = toYMD((p as any).to_date);
                              const paK = toYMD((p as any).paid_at);
                              if (fdK && tdK) return (k >= fdK && k <= tdK) ? s + amtNum : s;
                              return (paK && paK === k) ? s + amtNum : s;
                            }, 0);
                            setAdvanceExistingAmt(perRow);
                            setAdvanceAmount(perRow > 0 ? perRow.toFixed(2) : '');
                            setAdvanceTxnId((selectedTxn as any)?.id || null);
                            setAdvanceOpen(true);
                          } catch {
                            setAdvanceOpen(true);
                          }
                        }}
                      >
                        Edit Advance
                      </Button>
                    </div>
                  </div>
                );
              })()}

              <div className="flex justify-end gap-2">
                <Button
                  onClick={() => {
                    if (selectedTxn && selectedTxnSeller) {
                      setEditingTxnSeller(selectedTxnSeller);
                      setEditingTxn(selectedTxn);
                    }
                    setSelectedTxn(null);
                    setSelectedTxnSeller(null);
                  }}
                >
                  Edit
                </Button>
                <Button variant="outline" onClick={() => { setSelectedTxn(null); setSelectedTxnSeller(null); }}>Close</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit purchase transaction dialog */}
      <Dialog open={!!editingTxn} onOpenChange={() => { setEditingTxn(null); setEditingTxnSeller(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Update - {editingTxnSeller?.name}</DialogTitle>
          </DialogHeader>
          {editingTxn && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await sellerApi.updateTransaction(
                    (editingTxnSeller as any).id,
                    (editingTxn as any).id,
                    {
                      transaction_date: (editingTxn as any).transaction_date,
                      amount_added: Number((editingTxn as any).amount_added),
                      kg_added: Number((editingTxn as any).kg_added),
                      flower_name: ((editingTxn as any).flower_name || '').trim() || undefined,
                      salesman_name: ((editingTxn as any).salesman_name || '').trim() || undefined,
                    }
                  );
                  const sid = (editingTxnSeller as any).id;
                  const data = await sellerApi.getTransactions(sid);
                  setTableTransactions((prev) => ({ ...prev, [sid]: data }));
                  // Update local sold badge cache so the "Sold to" name appears instantly
                  try {
                    const name = String(((editingTxn as any).salesman_name || '').trim());
                    if (name) {
                      setSoldBadges((prev) => { const next = { ...prev, [(editingTxn as any).id]: name }; writeSoldBadges(next); return next; });
                    }
                  } catch {}
                  setEditingTxn(null);
                  setEditingTxnSeller(null);
                  onUpdate();
                  toast.success('Update edited successfully');
                } catch (err: any) {
                  toast.error(err?.message || 'Failed to edit update');
                }
              }}
              className="space-y-3"
            >
              <div className="space-y-1">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={(editingTxn as any).transaction_date}
                  onChange={(e) => setEditingTxn({ ...(editingTxn as any), transaction_date: e.target.value } as any)}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label>Flower</Label>
                {(() => {
                  const known = new Set(['Rose','Sent yellow','Sent white','Chocolate','Ishwarya']);
                  const current = String(((editingTxn as any).flower_name || '')).trim();
                  const selectValue = known.has(current) ? current : 'Others';
                  const showOther = !known.has(current) && selectValue === 'Others';
                  return (
                    <>
                      <select
                        className="w-full h-10 rounded-md border px-3 bg-background"
                        value={selectValue}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === 'Others') {
                            // keep current as-is (may be empty or custom); user can type below
                            setEditingTxn({ ...(editingTxn as any), flower_name: current } as any);
                          } else {
                            setEditingTxn({ ...(editingTxn as any), flower_name: v } as any);
                          }
                        }}
                        aria-label="Flower"
                        title="Flower"
                      >
                        <option value="Rose">Rose</option>
                        <option value="Sent yellow">Sent yellow</option>
                        <option value="Sent white">Sent white</option>
                        <option value="Chocolate">Chocolate</option>
                        <option value="Ishwarya">Ishwarya</option>
                        <option value="Others">Others</option>
                      </select>
                      {selectValue === 'Others' && (
                        <div className="mt-2">
                          <Input
                            placeholder="Type flower name"
                            value={current}
                            onChange={(e) => setEditingTxn({ ...(editingTxn as any), flower_name: e.target.value } as any)}
                          />
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
              <div className="space-y-1">
                <Label>Sold To (Name)</Label>
                <Input
                  placeholder="Enter buyer/customer name"
                  value={String(((editingTxn as any).salesman_name || '')).trim()}
                  onChange={(e) => setEditingTxn({ ...(editingTxn as any), salesman_name: e.target.value } as any)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Weight (kg)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={Number((editingTxn as any).kg_added)}
                    onChange={(e) => setEditingTxn({ ...(editingTxn as any), kg_added: parseFloat(e.target.value || '0') } as any)}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label>Amount (₹)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={Number((editingTxn as any).amount_added)}
                    onChange={(e) => setEditingTxn({ ...(editingTxn as any), amount_added: parseFloat(e.target.value || '0') } as any)}
                    required
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => { setEditingTxn(null); setEditingTxnSeller(null); }}>Cancel</Button>
                <Button type="submit">Save</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete purchase transaction confirm */}
      <AlertDialog 
        open={!!deletingTxn} 
        onOpenChange={(open) => {
          if (!open) {
            setDeletingTxn(null);
            setDeletingTxnSeller(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this update?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the selected update and restore totals accordingly.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!deletingTxn) {
                  toast.error('No transaction selected for deletion');
                  setDeletingTxn(null);
                  setDeletingTxnSeller(null);
                  return;
                }

                const sellerId = deletingTxnSeller?.id || deletingTxn.seller_id;
                if (!sellerId) {
                  toast.error('Cannot determine seller for this transaction');
                  setDeletingTxn(null);
                  setDeletingTxnSeller(null);
                  return;
                }

                try {
                  await sellerApi.deleteTransaction(sellerId, deletingTxn.id);
                  const data = await sellerApi.getTransactions(sellerId);
                  setTableTransactions(prev => ({ ...prev, [sellerId]: data }));
                  toast.success('Transaction deleted successfully');
                } catch (err: any) {
                  console.error('Delete error:', err);
                  toast.error(err?.response?.data?.error || 'Failed to delete transaction');
                } finally {
                  setDeletingTxn(null);
                  setDeletingTxnSeller(null);
                  onUpdate();
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
      <Dialog open={!!addDataSeller} onOpenChange={() => { setAddDataSeller(null); setOriginalSeller(null); setIsCreatingNew(false); setAddMode('receive'); setSoldToSeller(null); }}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isCreatingNew ? "Add New Seller" : "Add Data to Seller"}</DialogTitle>
          </DialogHeader>
          {addDataSeller && (
            <form
              onSubmit={(e) => { handleAddDataUpdate(e); }}
              className="space-y-4"
            >
              {/* Sold To option removed: only Receive mode is available */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Seller identity: inputs for new, compact summary for existing */}
                {isCreatingNew ? (
                  <>
                    <div className="space-y-2">
                      <Label>Seller Name *</Label>
                      <Input
                        value={addDataSeller.name}
                        onChange={(e) => setAddDataSeller({ ...addDataSeller, name: e.target.value })}
                        required
                        placeholder="Enter seller name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Mobile (optional)</Label>
                      <Input
                        value={addDataSeller.mobile}
                        onChange={(e) => setAddDataSeller({ ...addDataSeller, mobile: e.target.value })}
                        placeholder="Enter mobile number"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Serial Number *</Label>
                      <Input
                        value={addDataSeller.serial_number}
                        onChange={(e) => setAddDataSeller({ ...addDataSeller, serial_number: e.target.value })}
                        required
                        placeholder="Enter unique serial number"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Address (optional)</Label>
                      <Textarea
                        value={addDataSeller.address}
                        onChange={(e) => setAddDataSeller({ ...addDataSeller, address: e.target.value })}
                        rows={3}
                        placeholder="Street, City, PIN"
                      />
                    </div>
                  </>
                ) : (
                  <div className="md:col-span-2 rounded-lg border bg-muted/40 p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      <div><span className="text-muted-foreground">Seller:</span> <span className="font-medium">{addDataSeller.name}</span></div>
                      <div><span className="text-muted-foreground">Serial:</span> <span className="font-medium">{addDataSeller.serial_number}</span></div>
                      <div><span className="text-muted-foreground">Mobile:</span> <span className="font-medium">{addDataSeller.mobile}</span></div>
                    </div>
                    {addDataSeller.address ? (
                      <p className="mt-1 text-xs text-muted-foreground truncate">{addDataSeller.address}</p>
                    ) : null}
                  </div>
                )}
                {/* Editable fields */}
                {
                  <>
                    {/* Date + Flower row */}
                    <div className="space-y-2 md:col-span-2">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                          <Label>Flower</Label>
                          <select
                            className="w-full h-10 rounded-md border px-3 bg-background"
                            value={flowerChoice}
                            onChange={(e) => setFlowerChoice(e.target.value)}
                            aria-label="Flower"
                            title="Flower"
                          >
                            <option value="">Select flower</option>
                            <option value="Rose">Rose</option>
                            <option value="Modi">Modi</option>
                            <option value="Mango gold">Mango gold</option>
                            <option value="Gilly yellow">Gilly yellow</option>
                            <option value="Paneer">Paneer</option>
                            <option value="Single orange">Single orange</option>
                            <option value="Battance">Battance</option>
                            <option value="Orange">Orange</option>
                            <option value="Romance">Romance</option>
                            <option value="Priya gold">Priya gold</option>
                            <option value="Savi">Savi</option>
                            <option value="Sent yellow">Sent yellow</option>
                            <option value="Sent white">Sent white</option>
                            <option value="Chocolate">Chocolate</option>
                            <option value="Ishwarya">Ishwarya</option>
                            <option value="Others">Others</option>
                          </select>
                        </div>
                      </div>
                    </div>
                    {flowerChoice === 'Others' && (
                      <div className="space-y-2 md:col-span-2">
                        <Label>Other flower</Label>
                        <Input
                          placeholder="Type flower name"
                          value={flowerOther}
                          onChange={(e) => setFlowerOther(e.target.value)}
                        />
                      </div>
                    )}

                    {/* Net/Less weight row */}
                    <div className="space-y-2 md:col-span-2">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label>Net Weight (kg) *</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={addDataSeller.kg === 0 ? '' : addDataSeller.kg}
                            onChange={(e) => {
                              const kgVal = parseFloat(e.target.value);
                              const newKg = isNaN(kgVal) ? 0 : kgVal;
                              // Compute auto amount if not manually edited
                              let nextAmount = addDataSeller.amount;
                              if (!amountEdited) {
                                const less = Number(minusKg || 0);
                                const eff = Math.max(0, newKg - less);
                                const rate = Number(ratePerKg || 0);
                                if (rate > 0) {
                                  nextAmount = Math.round(eff * rate * 100) / 100;
                                }
                              }
                              setAddDataSeller({ ...addDataSeller, kg: newKg, amount: nextAmount });
                            }}
                            required
                            placeholder="Enter weight to add"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Less Weight (kg)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={minusKg}
                            onChange={(e) => {
                              const v = parseFloat(e.target.value);
                              const nextLess = isNaN(v) ? '' : v;
                              setMinusKg(nextLess);
                              // Auto update amount if not manually edited
                              if (!amountEdited) {
                                const net = Number(addDataSeller.kg || 0);
                                const less = Number(nextLess || 0);
                                const eff = Math.max(0, net - less);
                                const rate = Number(ratePerKg || 0);
                                if (rate > 0) {
                                  const total = Math.round(eff * rate * 100) / 100;
                                  setAddDataSeller({ ...addDataSeller, amount: total });
                                }
                              }
                            }}
                            placeholder="Enter weight to subtract"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Rate and Calculated Amount helper (UI-only) */}
                    <div className="space-y-2 md:col-span-2">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label>Rate (₹/kg)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={ratePerKg === '' ? '' : ratePerKg}
                            onChange={(e) => {
                              const v = parseFloat(e.target.value);
                              const nextRate = isNaN(v) ? '' : v;
                              setRatePerKg(nextRate);
                              // Auto update amount if not manually edited
                              if (!amountEdited) {
                                const net = Number(addDataSeller.kg || 0);
                                const less = Number(minusKg || 0);
                                const eff = Math.max(0, net - less);
                                const rate = Number(nextRate || 0);
                                if (rate > 0) {
                                  const total = Math.round(eff * rate * 100) / 100;
                                  setAddDataSeller({ ...addDataSeller, amount: total });
                                }
                              }
                            }}
                            placeholder="Enter rate per kg"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Calculated Amount (₹)</Label>
                          {(() => {
                            const net = Number(addDataSeller.kg || 0);
                            const less = Number(minusKg || 0);
                            const eff = Math.max(0, net - less);
                            const rate = Number(ratePerKg || 0);
                            const total = eff * rate;
                            return (
                              <Input
                                readOnly
                                value={rate > 0 ? `${eff.toFixed(2)} × ${rate.toFixed(2)} = ₹${total.toFixed(2)}` : `${eff.toFixed(2)} kg`}
                                className="bg-muted"
                              />
                            );
                          })()}
                        </div>
                      </div>
                    </div>

                    {/* Amount and Advance side-by-side */}
                    <div className="space-y-2 md:col-span-2">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label>Amount (₹) *</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={addDataSeller.amount === 0 ? '' : addDataSeller.amount}
                            onChange={(e) => {
                              const v = parseFloat(e.target.value);
                              setAmountEdited(true);
                              setAddDataSeller({ ...addDataSeller, amount: isNaN(v) ? 0 : v });
                            }}
                            required
                            placeholder="Enter amount to add"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Advance (₹) <span className="text-xs text-muted-foreground">(optional)</span></Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={addAdvanceAmount}
                            onChange={(e) => setAddAdvanceAmount(e.target.value)}
                            placeholder="Enter advance to record now"
                          />
                        </div>
                      </div>
                    </div>
                  </>
                }

                {/* Sold To form removed from Add Data dialog */}
              </div>
              
              

              <div className="sticky bottom-0 bg-background pt-3 pb-2">
                <div className="flex gap-2">
                  <Button type="submit" disabled={loading} className="shrink-0">
                    {loading ? (isCreatingNew ? "Creating..." : (addMode === 'receive' ? "Adding..." : "Saving...")) : (isCreatingNew ? "Create Seller" : (addMode === 'receive' ? "Add Data" : "Save Sale"))}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => { setAddDataSeller(null); setOriginalSeller(null); setIsCreatingNew(false); }} className="shrink-0">
                    Cancel
                  </Button>
                </div>
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
                  // Payments subtraction for this seller
                  const pays = (tablePayments[viewingSeller.id] || [])
                    .filter(p => !clearedAt || new Date((p as any).paid_at).getTime() > clearedAt)
                    .reduce((acc, p) => ({ kg: acc.kg + Number((p as any).cleared_kg || 0), amt: acc.amt + Number((p as any).amount || 0) }), { kg: 0, amt: 0 });
                  const net = { kg: Math.max(0, recv.kg - pays.kg), amt: Math.max(0, recv.amt - pays.amt) };
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
                        <div className="border rounded-lg p-4 text-center bg-blue-50 dark:bg-blue-950 shadow-sm">
                          <p className="text-xs text-muted-foreground mb-1">Purchases Total</p>
                          <p className="text-sm font-semibold text-blue-700">{net.kg.toFixed(2)} kg</p>
                          <p className="text-lg font-bold text-blue-600">₹{net.amt.toFixed(2)}</p>
                          <p className="mt-1 text-[11px] text-muted-foreground">Paid: -{pays.kg.toFixed(2)} kg · -₹{pays.amt.toFixed(2)}</p>
                          {viewingSeller ? (
                            <div className="mt-2 text-[11px] text-muted-foreground">
                              <span className="font-medium">Serial:</span> {viewingSeller.serial_number} · <span className="font-medium">Seller:</span> {viewingSeller.name}
                            </div>
                          ) : null}
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
                              {(txn as any).flower_name ? (
                                <p className="text-[11px] font-semibold text-foreground">Flower {(txn as any).flower_name}</p>
                              ) : null}
                              <p className="text-xs font-semibold text-blue-600">+{Number(txn.kg_added).toFixed(2)} kg</p>
                              <p className="text-xs font-semibold text-green-600">+₹{Number(txn.amount_added).toFixed(2)}</p>
                            </div>
                          </div>
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Previous: {Number(txn.previous_kg).toFixed(2)} kg, ₹{Number(txn.previous_amount).toFixed(2)}</span>
                            <span className="font-semibold text-foreground">Total: {Number(txn.new_total_kg).toFixed(2)} kg, ₹{Number(txn.new_total_amount).toFixed(2)}</span>
                          </div>
                          {(txn as any).flower_name ? (
                            <div className="mt-1 text-xs">
                              <span className="font-semibold text-foreground">Flower:</span> <span className="font-semibold text-foreground">{(txn as any).flower_name}</span>
                            </div>
                          ) : null}
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
                    <p className="text-xs text-muted-foreground">Sold to customers · Salesman: <span className="font-medium text-foreground">{viewingSeller.name}</span></p>
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
                  <div className="text-center text-muted-foreground py-4 text-sm">
                    {(() => {
                      // Prefer: latest sale_to contact > latest txn.salesman_name > seller name
                      const latestContact = (saleToForView && saleToForView.length > 0) ? saleToForView[0].name : '';
                      const latestTxnSalesman = (transactions && transactions.length > 0)
                        ? (transactions[0] as any).salesman_name || ''
                        : '';
                      const assigned = latestContact || latestTxnSalesman || viewingSeller.name || '';
                      return (<p className="font-medium text-foreground">{assigned}</p>);
                    })()}
                  </div>
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
