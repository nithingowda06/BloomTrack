import React, { useMemo, useState } from "react";
import { profileApi } from "@/lib/api";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { sellerApi } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Seller {
  id: string;
  name: string;
  serial_number: string;
}

const Payments: React.FC = () => {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    seller?: Seller;
    totalKg: number;
    totalAmount: number;
    txns: any[];
  } | null>(null);
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentWeight, setPaymentWeight] = useState<string>("");
  const [lastEdited, setLastEdited] = useState<"amount" | "weight" | null>(null);
  const [justPaid, setJustPaid] = useState(false);
  const [paying, setPaying] = useState(false);
  const [paymentsBump, setPaymentsBump] = useState(0);
  // Thermal receipt mode (80mm)
  const [thermalMode, setThermalMode] = useState<boolean>(() => {
    try { return localStorage.getItem('thermal_mode') === '1'; } catch { return false; }
  });
  const persistThermal = (v: boolean) => { try { localStorage.setItem('thermal_mode', v ? '1' : '0'); } catch {} };
  const [lastSaved, setLastSaved] = useState<{ amount: number; kg: number; from?: string; to?: string } | null>(null);
  const [paidOverride, setPaidOverride] = useState<{ amount: number; kg: number; from?: string; to?: string } | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receipt, setReceipt] = useState<{ amount: number; kg: number; from?: string; to?: string } | null>(null);

  // Persist and restore last receipt to survive refreshes
  const saveReceiptToCache = (sellerId: string, data: { amount: number; kg: number; from?: string; to?: string }) => {
    try {
      const key = `${sellerId}|${normDate(data.from)}|${normDate(data.to)}`;
      const raw = localStorage.getItem('payments_receipt_cache');
      const cache = raw ? JSON.parse(raw) : {};
      cache[key] = { ...data, ts: Date.now() };
      localStorage.setItem('payments_receipt_cache', JSON.stringify(cache));
    } catch {}
  };

  // Print a simple receipt for a specific history payment row
  const handlePrintHistory = async (h: { id: string; paid_at: string; from_date?: string; to_date?: string; amount: number; cleared_kg: number }) => {
    if (!histSeller) return;
    // Load shop profile (non-fatal)
    let profile: any = null;
    try { profile = await profileApi.get(); } catch {}
    const shopName = (profile && (profile.shop_name || profile.shopName)) || '';
    const ownerName = (profile && (profile.owner_name || profile.ownerName)) || '';
    const ownerMobile = (profile && profile.mobile) || '';

    const when = new Date(h.paid_at).toLocaleString();
    const range = `${fmtDMY(h.from_date) || 'Start'} → ${fmtDMY(h.to_date) || 'End'}`;
    const html = `
      <html>
        <head>
          <meta charset="UTF-8" />
          <title>Payment Receipt - ${histSeller.serial_number} ${histSeller.name}</title>
          <style>
            ${thermalMode ? `
            @page { size: 80mm auto; margin: 0; }
            body { width: 80mm; margin: 0; font-family: -apple-system, Segoe UI, Roboto, Arial; padding: 6px 8px; }
            h1 { font-size: 14px; margin: 0 0 6px 0; text-align:center; }
            .muted { color: #444; font-size: 10px; margin: 0 0 6px 0; text-align:center; }
            table { width: 100%; border-collapse: collapse; margin-top: 6px; }
            th, td { border-top: 1px dashed #999; padding: 6px 0; font-size: 11px; }
            th { text-align: left; }
            .shop { text-align:center; margin-bottom:6px; }
            .shop h2 { margin:0 0 4px 0; font-size:12px; }
            .shop div { font-size:11px; line-height:1.4; }
            .hr { border-top: 1px dashed #999; margin: 6px 0; }
            ` : `
            body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica, Arial; padding: 20px; }
            h1 { font-size: 20px; margin-bottom: 6px; }
            .muted { color: #6b7280; font-size: 12px; margin-bottom: 14px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #ddd; padding: 8px; font-size: 12px; }
            th { background: #f3f4f6; text-align: left; }
            .shop { border:1px solid #e5e7eb; border-radius:8px; padding:12px; margin-bottom:12px; }
            .shop h2 { margin:0 0 8px 0; font-size:16px; }
            .shop div { font-size:13px; line-height:1.6; }
            `}
          </style>
        </head>
        <body>
          <div class="shop">
            ${thermalMode ? `
              <h2>${shopName || '-'}</h2>
              <div>${ownerName || '-'}</div>
              <div>${ownerMobile || '-'}</div>
              <div class="hr"></div>
            ` : `
              <h2>Shop Details</h2>
              <div><strong>Shop Name</strong>: ${shopName || '-'}</div>
              <div><strong>Owner name</strong>: ${ownerName || '-'}</div>
              <div><strong>Mobile number</strong>: ${ownerMobile || '-'}</div>
            `}
          </div>
          <h1>Payment Receipt</h1>
          <div class="muted">${histSeller.serial_number} · ${histSeller.name}</div>
          <div class="muted">When: ${when}</div>
          <div class="muted">Range: ${range}</div>

          <table>
            <tbody>
              <tr><th>Cleared Amount</th><td>₹${Number(h.amount||0).toFixed(2)}</td></tr>
              <tr><th>Cleared Weight</th><td>${Number(h.cleared_kg||0).toFixed(2)} kg</td></tr>
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
  };

  // Format YYYY-MM-DD (or ISO-like starting with YYYY-MM-DD) to DD/MM/YYYY without timezone shifts
  const fmtDMY = (val?: string | null) => {
    const s = String(val || '').trim();
    if (!s) return '';
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) {
      const [, yy, mm, dd] = m;
      return `${dd}/${mm}/${yy}`;
    }
    // Fallback: try Date but still output only local calendar day
    const d = new Date(s);
    if (isNaN(d.getTime())) return s;
    const yy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${dd}/${mm}/${yy}`;
  };
  const loadReceiptFromCache = (sellerId: string, from?: string, to?: string) => {
    try {
      const key = `${sellerId}|${normDate(from)}|${normDate(to)}`;
      const raw = localStorage.getItem('payments_receipt_cache');
      if (!raw) return null;
      const cache = JSON.parse(raw) || {};
      const item = cache[key];
      if (!item) return null;
      // Expire after 24h to avoid stale force-zeros
      if (Date.now() - (item.ts || 0) > 24*60*60*1000) return null;
      return item as { amount: number; kg: number; from?: string; to?: string };
    } catch { return null; }
  };

  // Normalize date strings to YYYY-MM-DD for reliable equality checks
  const normDate = (s?: string | null) => {
    if (!s) return '';
    const str = String(s);
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
    const d = new Date(str);
    return isNaN(d.getTime()) ? str : d.toISOString().slice(0, 10);
  };

  // History (modal at top-right): search by serial, show payments only
  const [histOpen, setHistOpen] = useState(false);
  const [histQuery, setHistQuery] = useState("");
  const [histLoading, setHistLoading] = useState(false);
  const [histSeller, setHistSeller] = useState<Seller | null>(null);
  const [histPayments, setHistPayments] = useState<Array<{ id: string; paid_at: string; from_date?: string; to_date?: string; amount: number; cleared_kg: number }>>([]);
  const [payments, setPayments] = useState<Array<{ id: string; paid_at: string; from_date?: string; to_date?: string; amount: number; cleared_kg: number }>>([]);
  const handleHistorySearch = async () => {
    const q = histQuery.trim();
    if (!q) { toast.error("Enter a Serial No."); return; }
    setHistLoading(true);
    setHistSeller(null);
    setHistPayments([]);
    try {
      const sellers = await sellerApi.getAll();
      const seller = sellers.find((s: any) => String(s.serial_number) === q);
      if (!seller) { toast.error(`No seller found for Serial ${q}`); return; }
      setHistSeller(seller);
      const arr = await sellerApi.getPayments(seller.id);
      setHistPayments(arr || []);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load history");
    } finally {
      setHistLoading(false);
    }
  };

  const handleSearch = async () => {
    const serial = query.trim();
    if (!serial) {
      return;
    }
    setLoading(true);
    setResult(null);
    try {
    // Find seller by serial number
    const sellers = await sellerApi.getAll();
    const seller = sellers.find((s: any) => String(s.serial_number) === serial);
    if (!seller) {
      toast.error(`No seller found for Serial ${serial}`);
      return;
    }
    // Fetch purchases first so UI renders even if payments API fails
    const txns = await sellerApi.getTransactions(seller.id);
    setResult({ seller, totalKg: 0, totalAmount: 0, txns: txns || [] });
    // Fetch payments separately (non-fatal)
    try {
      const pays = await sellerApi.getPayments(seller.id);
      setPayments(pays || []);
    } catch (pe: any) {
      console.warn('Payments fetch failed:', pe?.message);
    }
    // Restore last receipt (for this seller+range) to ensure Remaining reflects cleared even after refresh
    try {
      const selFromKey = normDate(fromDate);
      const selToKey = normDate(toDate);
      const cached = loadReceiptFromCache(seller.id, selFromKey, selToKey);
      if (cached) {
        setPaidOverride({ amount: Number(cached.amount||0), kg: Number(cached.kg||0), from: selFromKey, to: selToKey });
      } else {
        setPaidOverride(null);
      }
    } catch {}
    toast.success("Loaded totals");
  } catch (e: any) {
    toast.error(e?.message || "Failed to load payments data");
  } finally {
    setLoading(false);
  }
};
  

  const handlePaid = async () => {
    if (!result?.seller) { toast.error("Search a seller first"); return; }
    // Determine effective clear values from inputs or remaining
    const amtNum = Number(paymentAmount || 0);
    const kgNum = Number(paymentWeight || 0);
    const remainingAmt = Number((cleared.remainAmount || 0).toFixed(2));
    const remainingKg = Number((cleared.remainKg || 0).toFixed(2));

    let effectiveAmount = 0;
    let effectiveKg = 0;
    if (amtNum > 0 && kgNum > 0) {
      // Both provided: cap to remaining
      effectiveAmount = Math.min(remainingAmt, amtNum);
      effectiveKg = Math.min(remainingKg, kgNum);
    } else if (amtNum > 0) {
      // Amount provided: derive kg by avgRate, cap to remaining
      effectiveAmount = Math.min(remainingAmt, amtNum);
      effectiveKg = avgRate > 0 ? Math.min(remainingKg, Number((effectiveAmount / avgRate).toFixed(2))) : Math.min(remainingKg, kgNum || remainingKg);
    } else if (kgNum > 0) {
      // Kg provided: derive amount by avgRate, cap to remaining
      effectiveKg = Math.min(remainingKg, kgNum);
      effectiveAmount = avgRate > 0 ? Math.min(remainingAmt, Number((effectiveKg * avgRate).toFixed(2))) : Math.min(remainingAmt, amtNum || remainingAmt);
    } else {
      // Neither provided: treat as Clear Full of remaining
      effectiveAmount = remainingAmt;
      effectiveKg = remainingKg;
    }

    if (!(effectiveAmount > 0) && !(effectiveKg > 0)) { toast.error('Nothing to clear'); return; }
    if (paying) return; // one-click guard
    try {
      setPaying(true);
      const saved = await sellerApi.addPayment(result.seller.id, {
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
        amount: effectiveAmount,
        cleared_kg: effectiveKg,
      });
      setPayments((prev) => [saved, ...(prev || [])]);
      // Refresh from server to avoid any local mismatch
      try {
        const fresh = await sellerApi.getPayments(result.seller.id);
        setPayments(fresh || []);
      } catch {}
      // Use normalized current selection for instant UI match
      const selFromKeyNow = normDate(fromDate);
      const selToKeyNow = normDate(toDate);
      setLastSaved({ amount: Number(saved.amount||0), kg: Number(saved.cleared_kg||0), from: selFromKeyNow, to: selToKeyNow });
      setPaidOverride({ amount: Number(effectiveAmount||0), kg: Number(effectiveKg||0), from: selFromKeyNow, to: selToKeyNow });
      toast.success("Payment saved in history");
      // Open receipt dialog with payment details
      setReceipt({ amount: Number(effectiveAmount||0), kg: Number(effectiveKg||0), from: selFromKeyNow, to: selToKeyNow });
      setReceiptOpen(true);
      if (result?.seller?.id) {
        saveReceiptToCache(result.seller.id, { amount: Number(effectiveAmount||0), kg: Number(effectiveKg||0), from: selFromKeyNow, to: selToKeyNow });
      }
      try { window.dispatchEvent(new Event('payments:updated')); } catch {}
      // Clear inputs and recompute remaining by bumping state
      setPaymentAmount("");
      setPaymentWeight("");
      setLastEdited(null);
      setPaymentsBump((v) => v + 1);
      setJustPaid(true);
      window.setTimeout(() => setJustPaid(false), 1500);
    } catch {
      toast.error("Failed to save payment");
    } finally { setPaying(false); }
  };

  // Derive totals from transactions for the selected date range (no payment subtraction here)
  const filtered = useMemo(() => {
    if (!result?.txns) return { kg: 0, amount: 0, count: 0 };

    const toLocalStart = (ymd: string) => {
      const [y, m, d] = ymd.split('-').map(Number);
      return new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
    };
    const toLocalEnd = (ymd: string) => {
      const [y, m, d] = ymd.split('-').map(Number);
      return new Date(y, (m || 1) - 1, d || 1, 23, 59, 59, 999);
    };
    const parseTxnDate = (val: any) => {
      if (!val) return new Date(NaN);
      const s = String(val);
      // If it's plain YYYY-MM-DD, treat as local day start
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return toLocalStart(s);
      return new Date(s);
    };

    const from = fromDate ? toLocalStart(fromDate) : null;
    const to = toDate ? toLocalEnd(toDate) : null;

    let kg = 0;
    let amount = 0;
    let count = 0;
    for (const t of result.txns) {
      const dStr = (t as any).transaction_date || (t as any).created_at;
      const d = parseTxnDate(dStr);
      if (from && d < from) continue;        // inclusive start
      if (to && d > to) continue;            // inclusive end
      kg += Number(t.kg_added || 0);
      amount += Number(t.amount_added || 0);
      count++;
    }
    return { kg, amount, count };
  }, [result, fromDate, toDate, paymentsBump, payments]);

  const avgRate = useMemo(() => {
    return filtered.kg > 0 ? filtered.amount / filtered.kg : 0;
  }, [filtered]);

  // Sum of payments within/overlapping the selected range
  const paidForRange = useMemo(() => {
    if (!result?.seller?.id) return { kg: 0, amount: 0 };
    const selFrom = normDate(fromDate) || '';
    const selTo = normDate(toDate) || '';
    const uiHasNoDates = !selFrom && !selTo;

    const uiStart = selFrom || '0000-00-00';
    const uiEnd = selTo || '9999-99-99';

    const overlaps = (p: any) => {
      if (uiHasNoDates) return true;
      const pFrom = normDate(p.from_date) || '';
      const pTo = normDate(p.to_date) || '';
      const pStart = pFrom || '0000-00-00';
      const pEnd = pTo || '9999-99-99';
      // overlap if pEnd >= uiStart AND pStart <= uiEnd (lexicographic ok for YYYY-MM-DD)
      return !(pEnd < uiStart || pStart > uiEnd);
    };

    const paid = (payments || []).filter(overlaps);
    const amount = paid.reduce((s, p) => s + Number(p.amount || 0), 0);
    const kg = paid.reduce((s, p) => s + Number(p.cleared_kg || 0), 0);
    return { kg, amount };
  }, [payments, result, fromDate, toDate]);

  const cleared = useMemo(() => {
    // Allow user to type any values; we compute effective cleared capped to totals
    const rawAmt = Number(paymentAmount || 0);
    const rawKg = Number(paymentWeight || 0);
    let useAmt = 0;
    let useKg = 0;
    if (lastEdited === 'weight') {
      useKg = Math.max(rawKg, 0);
      useAmt = avgRate > 0 ? useKg * avgRate : 0;
    } else if (lastEdited === 'amount') {
      useAmt = Math.max(rawAmt, 0);
      useKg = avgRate > 0 ? useAmt / avgRate : 0;
    } else {
      // default: prefer amount if present, else weight
      if (rawAmt > 0) {
        useAmt = rawAmt; useKg = avgRate > 0 ? useAmt / avgRate : 0;
      } else {
        useKg = rawKg; useAmt = avgRate > 0 ? useKg * avgRate : 0;
      }
    }
    // Cap to available totals
    let clearedAmount = Math.min(useAmt, filtered.amount);
    let clearedKg = Math.min(useKg, filtered.kg);

    // If inputs are empty/zero, prefer last saved or matching payment for this range
    if ((rawAmt <= 0 && rawKg <= 0) && result?.seller?.id) {
      const selFromKey = normDate(fromDate);
      const selToKey = normDate(toDate);
      const match = (payments || []).find((p) => normDate(p.from_date) === selFromKey && normDate(p.to_date) === selToKey);
      if (match) {
        clearedAmount = Number(match.amount || 0);
        clearedKg = Number(match.cleared_kg || 0);
      } else if (lastSaved && (lastSaved.from || '') === selFromKey && (lastSaved.to || '') === selToKey) {
        clearedAmount = Number(lastSaved.amount || 0);
        clearedKg = Number(lastSaved.kg || 0);
      }
    }

    // If we already have saved payments for this range, show them as cleared
    if (paidForRange.amount > 0 || paidForRange.kg > 0) {
      clearedAmount = paidForRange.amount;
      clearedKg = paidForRange.kg;
    }

    // Use an immediate override right after a successful payment before
    // the async refetch of payments completes, so Remaining updates instantly.
    const selFromKey = normDate(fromDate);
    const selToKey = normDate(toDate);
    const overrideMatches = !!paidOverride && (
      // if no date filters selected, allow override unconditionally
      (selFromKey === '' && selToKey === '') ||
      (normDate(paidOverride.from) === selFromKey && normDate(paidOverride.to) === selToKey)
    );
    const lastSavedMatches = !!lastSaved && (normDate(lastSaved.from) === selFromKey) && (normDate(lastSaved.to) === selToKey);
    const effectivePaidAmount = (paidForRange.amount > 0)
      ? paidForRange.amount
      : (overrideMatches ? Number(paidOverride!.amount || 0)
         : (lastSavedMatches ? Number(lastSaved!.amount || 0) : 0));
    const effectivePaidKg = (paidForRange.kg > 0)
      ? paidForRange.kg
      : (overrideMatches ? Number(paidOverride!.kg || 0)
         : (lastSavedMatches ? Number(lastSaved!.kg || 0) : 0));

    // Force Cleared cards to show the paid amounts immediately
    clearedAmount = Math.min(filtered.amount, effectivePaidAmount);
    clearedKg = Math.min(filtered.kg, effectivePaidKg);

    // Remaining should reflect saved payments (or lastSaved fallback)
    const remainAmount = Math.max(0, filtered.amount - effectivePaidAmount);
    const remainKg = Math.max(0, filtered.kg - effectivePaidKg);
    return { clearedAmount, clearedKg, remainAmount, remainKg };
  }, [paymentAmount, paymentWeight, lastEdited, filtered, avgRate, payments, result, fromDate, toDate, lastSaved, paidOverride, paidForRange]);

  // Display totals for the top cards: when no date range is selected,
  // match the Purchases page semantics (net outstanding = purchases - payments)
  const displayTotals = useMemo(() => {
    const uiHasNoDates = !normDate(fromDate) && !normDate(toDate);
    if (uiHasNoDates) {
      const kg = Math.max(0, Number(filtered.kg || 0) - Number(paidForRange.kg || 0));
      const amount = Math.max(0, Number(filtered.amount || 0) - Number(paidForRange.amount || 0));
      return { kg, amount };
    }
    return { kg: Number(filtered.kg || 0), amount: Number(filtered.amount || 0) };
  }, [fromDate, toDate, filtered, paidForRange]);

  const handleDownloadPdf = async () => {
    if (!result?.seller) return;
    // Prefer the receipt context if available (just-paid values)
    const useFrom = receipt?.from ?? fromDate;
    const useTo = receipt?.to ?? toDate;
    const paidAmt = receipt ? Number(receipt.amount || 0) : Number(cleared.clearedAmount || 0);
    const paidKg = receipt ? Number(receipt.kg || 0) : Number(cleared.clearedKg || 0);
    const remainingAmt = Math.max(0, Number(filtered.amount || 0) - paidAmt);
    const remainingKg = Math.max(0, Number(filtered.kg || 0) - paidKg);
    const titleRange = `${useFrom || 'Start'} → ${useTo || 'End'}`;
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
          <title>Payment Receipt - ${result.seller.serial_number} ${result.seller.name}</title>
          <style>
            ${thermalMode ? `
            @page { size: 80mm auto; margin: 0; }
            body { width: 80mm; margin: 0; font-family: -apple-system, Segoe UI, Roboto, Arial; padding: 6px 8px; }
            h1 { font-size: 14px; margin: 0 0 6px 0; text-align:center; }
            .muted { color: #444; font-size: 10px; margin: 0 0 6px 0; text-align:center; }
            table { width: 100%; border-collapse: collapse; margin-top: 6px; }
            th, td { border-top: 1px dashed #999; padding: 6px 0; font-size: 11px; }
            th { text-align: left; }
            .shop { text-align:center; margin-bottom:6px; }
            .shop h2 { margin:0 0 4px 0; font-size:12px; }
            .shop div { font-size:11px; line-height:1.4; }
            .hr { border-top: 1px dashed #999; margin: 6px 0; }
            ` : `
            body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica, Arial; padding: 20px; }
            h1 { font-size: 20px; margin-bottom: 6px; }
            .muted { color: #6b7280; font-size: 12px; margin-bottom: 14px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #ddd; padding: 8px; font-size: 12px; }
            th { background: #f3f4f6; text-align: left; }
            .shop { border:1px solid #e5e7eb; border-radius:8px; padding:12px; margin-bottom:12px; }
            .shop h2 { margin:0 0 8px 0; font-size:16px; }
            .shop div { font-size:13px; line-height:1.6; }
            `}
          </style>
        </head>
        <body>
          <div class="shop">
            ${thermalMode ? `
              <h2>${shopName || '-'}</h2>
              <div>${ownerName || '-'}</div>
              <div>${ownerMobile || '-'}</div>
              <div class="hr"></div>
            ` : `
              <h2>Shop Details</h2>
              <div><strong>Shop Name</strong>: ${shopName || '-'}</div>
              <div><strong>Owner name</strong>: ${ownerName || '-'}</div>
              <div><strong>Mobile number</strong>: ${ownerMobile || '-'}</div>
            `}
          </div>
          <h1>Payment Receipt</h1>
          <div class="muted">${result.seller.serial_number} · ${result.seller.name}</div>
          <div class="muted">Range: ${titleRange}</div>

          <table>
            <thead>
              ${thermalMode ? '' : `<tr><th>Metric</th><th>Value</th></tr>`}
            </thead>
            <tbody>
              <tr><${thermalMode ? 'th' : 'td'}>Total Weight</${thermalMode ? 'th' : 'td'}><td>${filtered.kg.toFixed(2)} kg</td></tr>
              <tr><${thermalMode ? 'th' : 'td'}>Total Amount</${thermalMode ? 'th' : 'td'}><td>₹${filtered.amount.toFixed(2)}</td></tr>
              <tr><${thermalMode ? 'th' : 'td'}>Cleared Amount</${thermalMode ? 'th' : 'td'}><td>₹${paidAmt.toFixed(2)}</td></tr>
              <tr><${thermalMode ? 'th' : 'td'}>Cleared Weight</${thermalMode ? 'th' : 'td'}><td>${paidKg.toFixed(2)} kg</td></tr>
              <tr><${thermalMode ? 'th' : 'td'}>Remaining Weight</${thermalMode ? 'th' : 'td'}><td>${remainingKg.toFixed(2)} kg</td></tr>
              <tr><${thermalMode ? 'th' : 'td'}>Remaining Amount</${thermalMode ? 'th' : 'td'}><td>₹${remainingAmt.toFixed(2)}</td></tr>
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
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-accent/10 to-background">
      <Header />
      <div className="container mx-auto p-4 md:p-6 lg:p-8 max-w-3xl">
        <div className="mb-6 flex items-start md:items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground">Payments</h1>
            <p className="text-muted-foreground mt-1">Search a seller by Serial No., select a date range, and optionally clear an amount. PDF receipt supported.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 border rounded px-2 py-1">
              <input id="thermal-mode" type="checkbox" checked={thermalMode} onChange={(e) => { setThermalMode(e.target.checked); persistThermal(e.target.checked); }} />
              <label htmlFor="thermal-mode" className="text-sm">Thermal mode</label>
            </div>
            <Button variant="outline" onClick={() => setHistOpen(true)}>History</Button>
          </div>
        </div>

        <Card className="mb-6">
          <CardContent className="p-4 md:p-6">
            <div className="flex flex-col gap-3">
              <div className="flex-1">
                <label className="block text-sm text-muted-foreground mb-1">Serial No.</label>
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Enter serial number"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-muted-foreground mb-1">From</label>
                  <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm text-muted-foreground mb-1">To</label>
                  <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
                </div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <Button onClick={handleSearch} disabled={loading} className="h-10">
                  {loading ? "Searching..." : "Search"}
                </Button>
                <div className="text-xs text-muted-foreground">Filtered entries: {filtered.count}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {result && result.seller && (
          <Card>
            <CardContent className="p-4 md:p-6">
              <div className="flex flex-col gap-2 mb-4">
                <div className="text-sm text-muted-foreground">Seller</div>
                <div className="text-lg font-semibold">{result.seller.serial_number} · {result.seller.name}</div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-lg p-4 bg-blue-50 dark:bg-blue-950 shadow-sm text-center">
                  <div className="text-sm text-muted-foreground mb-1">Total Weight</div>
                  <div className="text-2xl font-bold text-blue-700">{displayTotals.kg.toFixed(2)} kg</div>
                </div>
                <div className="rounded-lg p-4 bg-emerald-50 dark:bg-emerald-950 shadow-sm text-center">
                  <div className="text-sm text-muted-foreground mb-1">Total Amount</div>
                  <div className="text-2xl font-bold text-emerald-700">₹{displayTotals.amount.toFixed(2)}</div>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-muted-foreground mb-1">Payment Weight (kg)</label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder={`Enter weight (kg)`}
                      value={paymentWeight}
                      onChange={(e) => { setLastEdited('weight'); setPaymentWeight(e.target.value); }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-muted-foreground mb-1">Payment Amount (to clear)</label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder={`Enter amount (₹)`}
                      value={paymentAmount}
                      onChange={(e) => { setLastEdited('amount'); setPaymentAmount(e.target.value); }}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      // Populate inputs with full remaining values; user confirms by clicking Paid
                      setLastEdited('amount');
                      const amt = Math.max(0, Number((cleared.remainAmount || 0).toFixed(2)));
                      setPaymentAmount(amt > 0 ? amt.toFixed(2) : '');
                      const kg = Math.max(0, Number((cleared.remainKg || 0).toFixed(2)));
                      setPaymentWeight(kg > 0 ? kg.toFixed(2) : '');
                    }}
                    disabled={ paying || (cleared.remainAmount <= 0 && cleared.remainKg <= 0) }
                  >
                    Clear Full
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className={`flex-1 transition-colors ${justPaid ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-white text-foreground hover:bg-accent/20'}`}
                    onClick={handlePaid}
                    disabled={ paying || (paidForRange.amount >= filtered.amount && paidForRange.kg >= filtered.kg) }
                  >
                    {paying ? 'Paying…' : 'Paid'}
                  </Button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-lg p-4 bg-amber-50 dark:bg-amber-950 shadow-sm text-center">
                  <div className="text-sm text-muted-foreground mb-1">Cleared Weight (avg)</div>
                  <div className="text-xl font-bold text-amber-700">{cleared.clearedKg.toFixed(2)} kg</div>
                </div>
                <div className="rounded-lg p-4 bg-amber-50 dark:bg-amber-950 shadow-sm text-center">
                  <div className="text-sm text-muted-foreground mb-1">Cleared Amount</div>
                  <div className="text-xl font-bold text-amber-700">₹{cleared.clearedAmount.toFixed(2)}</div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-lg p-4 bg-gray-50 dark:bg-gray-900 shadow-sm text-center">
                  <div className="text-sm text-muted-foreground mb-1">Remaining Weight</div>
                  <div className="text-xl font-bold">{cleared.remainKg.toFixed(2)} kg</div>
                </div>
                <div className="rounded-lg p-4 bg-gray-50 dark:bg-gray-900 shadow-sm text-center">
                  <div className="text-sm text-muted-foreground mb-1">Remaining Amount</div>
                  <div className="text-xl font-bold">₹{cleared.remainAmount.toFixed(2)}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* History dialog (top-right) */}
        <Dialog open={histOpen} onOpenChange={setHistOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Payment History</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input placeholder="Enter Serial No." value={histQuery} onChange={(e) => setHistQuery(e.target.value)} />
                <Button onClick={handleHistorySearch} disabled={histLoading}>{histLoading ? 'Searching...' : 'Search'}</Button>
              </div>
              {histSeller && (
                <div className="text-sm text-muted-foreground">Seller: <span className="font-semibold">{histSeller.serial_number} · {histSeller.name}</span></div>
              )}
              <div className="overflow-x-auto">
                {histPayments.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No payments.</div>
                ) : (
                  <table className="min-w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-2">When</th>
                        <th className="text-left p-2">Range</th>
                        <th className="text-right p-2">Amount</th>
                        <th className="text-right p-2">Cleared Kg</th>
                        <th className="text-right p-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {histPayments.map((h) => (
                        <tr key={h.id} className="border-t">
                          <td className="p-2">{new Date(h.paid_at).toLocaleString()}</td>
                          <td className="p-2">{fmtDMY(h.from_date) || 'Start'} → {fmtDMY(h.to_date) || 'End'}</td>
                          <td className="p-2 text-right">₹{Number(h.amount||0).toFixed(2)}</td>
                          <td className="p-2 text-right">{Number(h.cleared_kg||0).toFixed(2)} kg</td>
                          <td className="p-2 text-right"><Button size="sm" variant="outline" onClick={() => handlePrintHistory(h)}>Print</Button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Receipt dialog after Paid */}
        <Dialog open={receiptOpen} onOpenChange={setReceiptOpen}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Payment Receipt</DialogTitle>
            </DialogHeader>
            {result?.seller && receipt && (
              <div className="space-y-3">
                <div className="text-sm text-muted-foreground">
                  <div><span className="font-semibold">Seller:</span> {result.seller.serial_number} · {result.seller.name}</div>
                  <div><span className="font-semibold">Range:</span> {(receipt.from||'Start')} → {(receipt.to||'End')}</div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-lg p-3 bg-blue-50 dark:bg-blue-950 text-center">
                    <div className="text-xs text-muted-foreground">Cleared Weight</div>
                    <div className="text-lg font-bold">{Number(receipt.kg||0).toFixed(2)} kg</div>
                  </div>
                  <div className="rounded-lg p-3 bg-amber-50 dark:bg-amber-950 text-center">
                    <div className="text-xs text-muted-foreground">Cleared Amount</div>
                    <div className="text-lg font-bold">₹{Number(receipt.amount||0).toFixed(2)}</div>
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setReceiptOpen(false)}>Close</Button>
                  <Button onClick={handleDownloadPdf}>Print Receipt</Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
;

export default Payments;
