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
          const key = calendarYMD((s as any).sale_date);
          const name = String((s as any).customer_name || '').trim();
          if (!name) return;
          salesByDate2.set(key, name);
        });

      const purchasesRows = (txns || []).map((t, i) => {
        const dateKey = calendarYMD((t as any).transaction_date);
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
          map[s.id] = txns;
          // collect any persisted salesman_name to restore badges
          for (const t of txns || []) {
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
        await sellerApi.addTransaction(addDataSeller.id, {
          transaction_date: addDataSeller.date,
          amount_added: Number(addDataSeller.amount),
          kg_added: Number(addDataSeller.kg),
          previous_amount: Number(originalSeller.amount),
          previous_kg: Number(originalSeller.kg),
          new_total_amount: newAmount,
          new_total_kg: newKg,
          flower_name: (flowerChoice === 'Others' ? flowerOther.trim() : flowerChoice) || undefined,
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
      // Merge server-assigned salesman names into badges so they persist after reload
      try {
        const fromServer: Record<string, string> = {};
        for (const t of data || []) {
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
                    {/* Child rows for each purchase update (newest first) */}
                    {(tableTransactions[seller.id] || []).length > 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="bg-muted/50 text-sm tracking-wide text-muted-foreground">Updates (Purchases History)</TableCell>
                      </TableRow>
                    )}
                    {([...((tableTransactions[seller.id] || []))]
                      .filter((t) => Number(t.kg_added) !== 0 || Number(t.amount_added) !== 0)
                      .sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime())
                    ).map((txn, idx) => (
                      <TableRow key={txn.id} className={`${idx % 2 === 0 ? 'bg-accent/20' : 'bg-accent/40'} hover:bg-accent/50 cursor-pointer`} onClick={() => { setSelectedTxnSeller(seller); setSelectedTxn(txn); }}>
                        <TableCell colSpan={6} className="py-2">
                          <div className="flex items-center justify-between gap-3 px-2">
                            <div className="flex items-center gap-3">
                              <span className="inline-flex items-center justify-center w-6 h-6 text-xs font-semibold rounded-full bg-primary/10 text-primary">
                                {idx + 1}
                              </span>
                              <span className="text-sm text-muted-foreground">Update</span>
                              <span className="text-sm font-medium">{new Date(txn.transaction_date).toLocaleDateString()}</span>
                            </div>
                            <div className="flex items-center gap-5">
                              {soldBadges[(txn as any).id] ? (
                                <div className="flex flex-col items-center gap-0.5">
                                  <span className="text-xs text-muted-foreground">Status</span>
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-sm bg-amber-100 text-amber-700 border border-amber-200">
                                    Sold to {soldBadges[(txn as any).id]}
                                  </span>
                                </div>
                              ) : null}
                              {(txn as any).flower_name ? (
                                <div className="flex flex-col items-center gap-0.5">
                                  <span className="text-xs text-muted-foreground">Flower</span>
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-sm bg-violet-100 text-violet-700 border border-violet-200">
                                    {(txn as any).flower_name}
                                  </span>
                                </div>
                              ) : null}
                              <div className="flex flex-col items-center gap-0.5">
                                <span className="text-xs text-muted-foreground">Weight</span>
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-sm bg-blue-100 text-blue-700 border border-blue-200">+{Number(txn.kg_added).toFixed(2)} kg</span>
                              </div>
                              <div className="flex flex-col items-center gap-0.5">
                                <span className="text-xs text-muted-foreground">Amount</span>
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-sm bg-emerald-100 text-emerald-700 border border-emerald-200">+₹{Number(txn.amount_added).toFixed(2)}</span>
                              </div>
                              <div className="inline-flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="text-sm h-8"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const d = new Date((txn as any).transaction_date);
                                    const yyyy = d.getFullYear();
                                    const mm = String(d.getMonth() + 1).padStart(2, '0');
                                    const dd = String(d.getDate()).padStart(2, '0');
                                    const norm = `${yyyy}-${mm}-${dd}`;
                                    setEditingTxnSeller(seller);
                                    setEditingTxn({ ...(txn as any), transaction_date: norm } as any);
                                    try { toast.message?.('Opening edit…'); } catch {}
                                  }}
                                >
                                  Edit
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="text-sm h-8 text-red-600 border-red-200 hover:text-red-700"
                                  onClick={(e) => { e.stopPropagation(); setDeletingTxnSeller(seller); setDeletingTxn(txn); try { toast.message?.('Confirm delete…'); } catch {} }}
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
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
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
              const kgVal = parseFloat(String((salesPromptData as any).weight || '0')) || 0;
              const amtVal = parseFloat(String((salesPromptData as any).amount || '0')) || 0;
              if (!(kgVal > 0) || !(amtVal > 0)) {
                toast.error('Enter sell weight and amount greater than 0');
                return;
              }
              try {
                setSalesSaving(true);
                // Save to sale_to contacts table
                await sellerApi.addSaleToContact(salesSeller.id, {
                  name: salesPromptData.name.trim(),
                  mobile: (salesPromptData.number || '').trim() || undefined,
                  address: (salesPromptData.address || '').trim() || undefined,
                });
                // Create a Sold-To transaction to block the specified kg/amount
                await sellerApi.addSoldToTransaction(salesSeller.id, {
                  customer_name: salesPromptData.name.trim(),
                  customer_mobile: (salesPromptData.number || '').trim() || undefined,
                  sale_date: new Date().toISOString().slice(0, 10),
                  kg_sold: kgVal,
                  amount_sold: amtVal,
                  notes: (salesPromptData.address || '').trim() ? `Address: ${salesPromptData.address?.trim()}` : undefined,
                });
                toast.success('Sale recorded and stock blocked');
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
                // refresh sale_to and sold-to transactions for this seller
                try { const contacts = await sellerApi.getSaleToContacts(salesSeller.id); setSaleToForView(contacts || []); } catch {}
                try { const so = await sellerApi.getSoldToTransactions(salesSeller.id); setTableSoldTo((prev) => ({ ...prev, [salesSeller.id]: so })); } catch {}
              } catch (err: any) {
                toast.error(err?.message || 'Failed to save');
              } finally {
                setSalesSaving(false);
              }
            }}
            className="space-y-3"
          >
            {salesTxn && (
              <div className="space-y-1 rounded border p-2 bg-muted/30">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!!(salesPromptData as any).full}
                    onChange={(e) => {
                      const full = e.target.checked;
                      if (full) {
                        setSalesPromptData({ ...salesPromptData, full: true, weight: Number((salesTxn as any).kg_added || 0), amount: Number((salesTxn as any).amount_added || 0) });
                      } else {
                        setSalesPromptData({ ...salesPromptData, full: false });
                      }
                    }}
                  />
                  <span>Sell entire update ({Number((salesTxn as any).kg_added || 0).toFixed(2)} kg · ₹{Number((salesTxn as any).amount_added || 0).toFixed(2)})</span>
                </label>
              </div>
            )}
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
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Sell Weight (kg)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={(salesPromptData as any).weight ?? ''}
                  onChange={(e) => setSalesPromptData({ ...salesPromptData, weight: parseFloat(e.target.value || '0') })}
                  disabled={!!(salesPromptData as any).full}
                  placeholder="e.g., 5"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Sell Amount (₹)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={(salesPromptData as any).amount ?? ''}
                  onChange={(e) => setSalesPromptData({ ...salesPromptData, amount: parseFloat(e.target.value || '0') })}
                  disabled={!!(salesPromptData as any).full}
                  placeholder="e.g., 500"
                  required
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setSalesPromptOpen(false)} disabled={salesSaving}>Cancel</Button>
              <Button type="submit" disabled={salesSaving}>{salesSaving ? 'Saving...' : 'Save'}</Button>
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

        // Sum payments across all sellers since clear (subtract from purchases total)
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

        const netPurchases = {
          kg: Math.max(0, recv.kg - paid.kg),
          amt: Math.max(0, recv.amt - paid.amt),
        };

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
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-blue-50 dark:bg-blue-950 rounded p-3 shadow-sm">
                  <p className="text-sm text-muted-foreground mb-1">Weight</p>
                  <p className="text-2xl font-bold text-blue-600">{netPurchases.kg.toFixed(2)} kg</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-950 rounded p-3 shadow-sm">
                  <p className="text-sm text-muted-foreground mb-1">Amount</p>
                  <p className="text-2xl font-bold text-blue-600">₹{netPurchases.amt.toFixed(2)}</p>
                </div>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">Paid since clear: -{paid.kg.toFixed(2)} kg · -₹{paid.amt.toFixed(2)}</p>
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
                {(selectedTxn as any).flower_name ? (
                  <div className="mt-1 text-xs">
                    <span className="font-semibold text-foreground">Flower:</span> <span className="font-semibold text-foreground">{ (selectedTxn as any).flower_name }</span>
                  </div>
                ) : null}
              </div>

              {/* Sale (Sold To) for this purchase date only */}
              <div className="border rounded p-3">
                <h4 className="text-sm font-semibold mb-2">Sale (Sold To) for this date</h4>
                {(() => {
                  const sid = (selectedTxnSeller as any)?.id;
                  // Prefer the most up-to-date list fetched for the viewing seller
                  const all = (sid && viewingSeller && viewingSeller.id === sid
                    ? (viewingSoldTo || [])
                    : (tableSoldTo[sid] || [])
                  ).slice();
                  const toYMD = (v: any) => {
                    const s = String(v || '').trim();
                    if (!s) return '';
                    // ISO YYYY-MM-DD
                    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
                    // DMY DD/MM/YYYY
                    const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
                    if (m) { const [_, dd, mm, yyyy] = m; return `${yyyy}-${mm}-${dd}`; }
                    const d = new Date(s);
                    return isNaN(d.getTime()) ? s : d.toISOString().slice(0, 10);
                  };
                  const purchaseDateKey = toYMD((selectedTxn as any).transaction_date || (selectedTxn as any).created_at);
                  // Create local day window [start, end] for robust matching
                  const [y, m, d] = purchaseDateKey.split('-').map(Number);
                  const dayStart = y && m && d ? new Date(y, m - 1, d, 0, 0, 0, 0) : null;
                  const dayEnd = y && m && d ? new Date(y, m - 1, d, 23, 59, 59, 999) : null;
                  const parseToDate = (val: any) => {
                    const key = toYMD(val);
                    const [yy, mm, dd] = key.split('-').map(Number);
                    return yy && mm && dd ? new Date(yy, mm - 1, dd, 12, 0, 0, 0) : new Date(NaN);
                  };
                  const daySales = all
                    .filter((s: any) => {
                      if (!dayStart || !dayEnd) return false;
                      const sd = parseToDate((s as any).sale_date || (s as any).created_at);
                      return sd >= dayStart && sd <= dayEnd;
                    })
                    .sort((a: any, b: any) => new Date(b.created_at || b.sale_date).getTime() - new Date(a.created_at || a.sale_date).getTime());

                  // Prefer assigned person from badge or txn.salesman_name
                  const txnId = (selectedTxn as any)?.id as string;
                  const assignedNameRaw = (txnId ? String((soldBadges as any)[txnId] || '').trim() : '')
                    || String((selectedTxn as any).salesman_name || '').trim();
                  const assignedName = assignedNameRaw.toLowerCase();

                  if (assignedName) {
                    const matchByName = daySales.find((s: any) => String((s as any).customer_name || '').trim().toLowerCase() === assignedName);
                    if (matchByName) {
                      const sale = matchByName;
                      return (
                        <div className="space-y-2">
                          <div className="border rounded p-2 bg-muted/30">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="text-xs font-medium">{sale.customer_name}</p>
                                <p className="text-[11px] text-muted-foreground">{new Date(sale.sale_date).toLocaleDateString()}</p>
                              </div>
                              <div className="text-right text-xs">
                                <p className="font-semibold text-emerald-600">{Number(sale.kg_sold).toFixed(2)} kg</p>
                                <p className="font-semibold text-emerald-600">₹{Number(sale.amount_sold).toFixed(2)}</p>
                              </div>
                            </div>
                            <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                              <span>Had: {Number(sale.previous_kg).toFixed(2)} kg, ₹{Number(sale.previous_amount).toFixed(2)}</span>
                              <span className="text-foreground">Remaining: {Number(sale.remaining_kg).toFixed(2)} kg, ₹{Number(sale.remaining_amount).toFixed(2)}</span>
                            </div>
                            {sale.notes && <p className="mt-1 text-[11px] italic text-muted-foreground">Note: {sale.notes}</p>}
                          </div>
                        </div>
                      );
                    }
                    // Nothing recorded for that person on this date: still show assigned name
                    const dateLabel = new Date(purchaseDateKey).toLocaleDateString();
                    return (
                      <div className="space-y-2">
                        <div className="border rounded p-2 bg-muted/30">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-xs font-medium">{assignedNameRaw}</p>
                              <p className="text-[11px] text-muted-foreground">{dateLabel}</p>
                            </div>
                            <div className="text-right text-xs">
                              <p className="text-muted-foreground">No recorded sale on this date</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  if (daySales.length === 0) {
                    return <p className="text-xs text-muted-foreground">No sales for this date</p>;
                  }

                  // Fallback: show latest sale on this date
                  const sale = daySales[0];
                  return (
                    <div className="space-y-2">
                      <div className="border rounded p-2 bg-muted/30">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-xs font-medium">{sale.customer_name || 'Unknown customer'}</p>
                            <p className="text-[11px] text-muted-foreground">{new Date(sale.sale_date).toLocaleDateString()}</p>
                          </div>
                          <div className="text-right text-xs">
                            <p className="font-semibold text-emerald-600">{Number(sale.kg_sold).toFixed(2)} kg</p>
                            <p className="font-semibold text-emerald-600">₹{Number(sale.amount_sold).toFixed(2)}</p>
                          </div>
                        </div>
                        <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                          <span>Had: {Number(sale.previous_kg).toFixed(2)} kg, ₹{Number(sale.previous_amount).toFixed(2)}</span>
                          <span className="text-foreground">Remaining: {Number(sale.remaining_kg).toFixed(2)} kg, ₹{Number(sale.remaining_amount).toFixed(2)}</span>
                        </div>
                        {sale.notes && <p className="mt-1 text-[11px] italic text-muted-foreground">Note: {sale.notes}</p>}
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="flex justify-end">
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
                    }
                  );
                  const sid = (editingTxnSeller as any).id;
                  const data = await sellerApi.getTransactions(sid);
                  setTableTransactions((prev) => ({ ...prev, [sid]: data }));
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
      <AlertDialog open={!!deletingTxn} onOpenChange={() => { setDeletingTxn(null); setDeletingTxnSeller(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this update?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the selected update and restore totals accordingly.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setDeletingTxn(null); setDeletingTxnSeller(null); }}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                try {
                  await sellerApi.deleteTransaction((deletingTxnSeller as any).id, (deletingTxn as any).id);
                  const sid = (deletingTxnSeller as any).id;
                  const data = await sellerApi.getTransactions(sid);
                  setTableTransactions((prev) => ({ ...prev, [sid]: data }));
                  setDeletingTxn(null);
                  setDeletingTxnSeller(null);
                  onUpdate();
                  toast.success('Update deleted successfully');
                } catch (err: any) {
                  toast.error(err?.message || 'Failed to delete update');
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
        <DialogContent className="max-w-xl">
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
                      <Label>Mobile *</Label>
                      <Input
                        value={addDataSeller.mobile}
                        onChange={(e) => setAddDataSeller({ ...addDataSeller, mobile: e.target.value })}
                        required
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
                      <Label>Address *</Label>
                      <Textarea
                        value={addDataSeller.address}
                        onChange={(e) => setAddDataSeller({ ...addDataSeller, address: e.target.value })}
                        rows={3}
                        required
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
                      <Label>Weight (kg) *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={addDataSeller.kg === 0 ? '' : addDataSeller.kg}
                        onChange={(e) => setAddDataSeller({ ...addDataSeller, kg: parseFloat(e.target.value) || 0 })}
                        required
                        placeholder="Enter weight to add"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Amount (₹) *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={addDataSeller.amount === 0 ? '' : addDataSeller.amount}
                        onChange={(e) => setAddDataSeller({ ...addDataSeller, amount: parseFloat(e.target.value) || 0 })}
                        required
                        placeholder="Enter amount to add"
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
                        <option value="Sent yellow">Sent yellow</option>
                        <option value="Sent white">Sent white</option>
                        <option value="Chocolate">Chocolate</option>
                        <option value="Ishwarya">Ishwarya</option>
                        <option value="Others">Others</option>
                      </select>
                    </div>
                    {flowerChoice === 'Others' && (
                      <div className="space-y-2">
                        <Label>Other flower</Label>
                        <Input
                          placeholder="Type flower name"
                          value={flowerOther}
                          onChange={(e) => setFlowerOther(e.target.value)}
                        />
                      </div>
                    )}
                  </>
                }

                {/* Sold To form removed from Add Data dialog */}
              </div>
              
              {/* Summary Card - Only show when adding data, not creating new */}
              {(!isCreatingNew && originalSeller && addMode === 'receive') && (
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
                    <span className="ml-2 font-medium text-blue-600">{addDataSeller.kg ? `+${Number(addDataSeller.kg).toFixed(2)} kg` : '—'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Adding:</span>
                    <span className="ml-2 font-medium text-blue-600">{addDataSeller.amount ? `+₹${Number(addDataSeller.amount).toFixed(2)}` : '—'}</span>
                  </div>
                  <div className="font-semibold text-green-600">
                    <span>New Total:</span>
                    <span className="ml-2">{addDataSeller.kg ? (Number(originalSeller.kg) + Number(addDataSeller.kg)).toFixed(2) + ' kg' : '—'}</span>
                  </div>
                  <div className="font-semibold text-green-600">
                    <span>New Total:</span>
                    <span className="ml-2">{addDataSeller.amount ? `₹${(Number(originalSeller.amount) + Number(addDataSeller.amount)).toFixed(2)}` : '—'}</span>
                  </div>
                </div>
              </div>
              )}

              <div className="flex gap-2">
                <Button type="submit" disabled={loading}>
                  {loading ? (isCreatingNew ? "Creating..." : (addMode === 'receive' ? "Adding..." : "Saving...")) : (isCreatingNew ? "Create Seller" : (addMode === 'receive' ? "Add Data" : "Save Sale"))}
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
