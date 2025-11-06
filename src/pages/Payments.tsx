import React, { useMemo, useState, useEffect } from "react";
import { profileApi } from "@/lib/api";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { sellerApi } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

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
  const [lastEdited, setLastEdited] = useState<"amount" | "weight" | "advance" | null>(null);
  const [printing, setPrinting] = useState(false);
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
  // Receipt adjustments
  const [commissionInput, setCommissionInput] = useState<string>("");
  const [advanceInput, setAdvanceInput] = useState<string>("0");

  // Persist and restore last receipt to survive refreshes
  const saveReceiptToCache = (sellerId: string, data: { amount: number; kg: number; from?: string; to?: string; commission?: number; advance?: number }) => {
    try {
      const key = `${sellerId}|${normDate(data.from)}|${normDate(data.to)}`;
      const raw = localStorage.getItem('payments_receipt_cache');
      const cache = raw ? JSON.parse(raw) : {};
      cache[key] = { ...data, ts: Date.now() };
      localStorage.setItem('payments_receipt_cache', JSON.stringify(cache));
    } catch {}
  };
  const getReceiptFromCache = (sellerId: string, from?: string, to?: string) => {
    try {
      const key = `${sellerId}|${normDate(from)}|${normDate(to)}`;
      const raw = localStorage.getItem('payments_receipt_cache');
      const cache = raw ? JSON.parse(raw) : {};
      return cache[key] || null;
    } catch { return null; }
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
    const dispFrom = (h as any).display_from || h.from_date;
    const dispTo = (h as any).display_to || h.to_date;
    const range = `${fmtDMY(dispFrom) || 'Start'} → ${fmtDMY(dispTo) || 'End'}`;

    // Build detailed rows from transactions within this payment's exact range
    const toLocalStart = (ymd: string) => { const [y,m,d] = ymd.split('-').map(Number); return new Date(y, (m||1)-1, d||1, 0,0,0,0); };
    const toLocalEnd = (ymd: string) => { const [y,m,d] = ymd.split('-').map(Number); return new Date(y, (m||1)-1, d||1, 23,59,59,999); };
    const parseTxnDateLocal = (val: any) => { const s = String(val||''); if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return toLocalStart(s); return new Date(s); };
    // Local-normalize YYYY-MM-DD to avoid timezone shifts
    const normLocal = (s?: string | null) => {
      if (!s) return '';
      const str = String(s);
      if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0,10);
      const d = new Date(str);
      if (isNaN(d.getTime())) return '';
      const yy = d.getFullYear();
      const mm = String(d.getMonth()+1).padStart(2,'0');
      const dd = String(d.getDate()).padStart(2,'0');
      return `${yy}-${mm}-${dd}`;
    };
    const fromKey = normLocal(dispFrom) || '';
    const toKey = normLocal(dispTo) || '';
    const inRange = (d: Date) => {
      const fromD = fromKey ? toLocalStart(fromKey) : null;
      const toD = toKey ? toLocalEnd(toKey) : null;
      if (fromD && d < fromD) return false; if (toD && d > toD) return false; return true;
    };
    let txnsArr: any[] = [];
    let paysArr: any[] = [];
    try { txnsArr = await sellerApi.getTransactions(histSeller.id); } catch {}
    try { paysArr = await sellerApi.getPayments(histSeller.id); } catch {}
    const rows = (txnsArr || [])
      .map((t: any) => ({
        dateStr: (t.transaction_date || t.created_at),
        d: parseTxnDateLocal(t.transaction_date || t.created_at),
        kg: Number(t.kg_added || 0),
        less: Number(t.less_weight || 0),
        amount: Number(t.amount_added || 0),
      }))
      .filter(r => inRange(r.d))
      .sort((a,b) => a.d.getTime() - b.d.getTime());
    const computedRows = rows.map(r => {
      const effKg = Math.max(0, Number((r.kg - r.less).toFixed(2)));
      const rate = effKg > 0 ? Number((r.amount / effKg).toFixed(2)) : 0;
      return { ...r, effKg, rate };
    });
    // Fall back to payment row when no transactions matched the range
    const displayRows = (computedRows.length > 0)
      ? computedRows
      : [{
          dateStr: h.paid_at,
          kg: Number(h.cleared_kg || 0),
          less: 0,
          effKg: Number(h.cleared_kg || 0),
          rate: (Number(h.cleared_kg || 0) > 0 ? Number(h.amount || 0) / Number(h.cleared_kg || 0) : 0),
          amount: Number(h.amount || 0),
        } as any];
    const totalAmt = displayRows.reduce((s: number, r: any) => s + Number(r.amount||0), 0);
    // Try cache first for commission/advance used at pay time
    let commission = 0;
    let advancePrev = 0;
    const cached = getReceiptFromCache(histSeller.id, fromKey, toKey);
    if (cached) {
      commission = Math.max(0, Number(cached.commission || 0));
      advancePrev = Math.max(0, Number(cached.advance || 0));
    } else {
      // Fallback: compute advance as sum of OTHER payments that OVERLAP the same range
      const overlaps = (p: any) => {
        const pf = normLocal(p.from_date) || '';
        const pt = normLocal(p.to_date) || '';
        const start = fromKey || '0000-00-00';
        const end = toKey || '9999-99-99';
        const pStart = pf || '0000-00-00';
        const pEnd = pt || '9999-99-99';
        return !(pEnd < start || pStart > end);
      };
      const others = (paysArr || []).filter((p: any) => p.id !== h.id && overlaps(p));
      advancePrev = Math.max(0, others.reduce((s: number, p: any) => s + Number(p.amount||0), 0));
      // Reconstruct commission so that Grand Total equals saved payment amount
      commission = Math.max(0, Number((totalAmt - (Number(h.amount||0) + advancePrev)).toFixed(2)));
    }
    const afterCommission = Math.max(0, totalAmt - commission);
    const grandTotal = Math.max(0, Number(h.amount || 0));

    const html = `
      <html>
        <head>
          <meta charset="UTF-8" />
          <title>Payment Receipt - ${histSeller.serial_number} ${histSeller.name}</title>
          <style>
            ${thermalMode ? `
            @page { size: 80mm auto; margin: 0; }
            body { width: 80mm; margin: 0; font-family: -apple-system, Segoe UI, Roboto, Arial; padding: 6px 8px; font-weight: 600; }
            h1 { font-size: 16px; margin: 0 0 6px 0; text-align:center; font-weight: 900; }
            .muted { color: #000; font-size: 11px; margin: 0 0 6px 0; text-align:center; font-weight: 700; }
            table { width: 100%; border-collapse: collapse; margin-top: 6px; }
            th, td { border-top: 2px dashed #000; padding: 7px 0; font-size: 12px; }
            th { text-align: left; font-weight: 900; text-transform: uppercase; letter-spacing: .3px; }
            td { font-weight: 800; }
            .shop { text-align:center; margin-bottom:6px; }
            .shop h2 { margin:0 0 4px 0; font-size:13px; font-weight: 900; }
            .shop div { font-size:12px; line-height:1.4; font-weight: 800; }
            .hr { border-top: 2px dashed #000; margin: 6px 0; }
            ` : `
            body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica, Arial; padding: 24px; }
            h1 { font-size: 26px; margin-bottom: 8px; font-weight: 900; }
            .muted { color: #000; font-size: 13px; margin-bottom: 16px; font-weight: 700; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            th, td { border: 2px solid #000; padding: 10px; font-size: 14px; }
            th { background: #fff; text-align: left; font-weight: 900; text-transform: uppercase; letter-spacing: .3px; }
            td { font-weight: 800; }
            .shop { border:2px solid #000; border-radius:8px; padding:12px; margin-bottom:12px; }
            .shop h2 { margin:0 0 8px 0; font-size:18px; font-weight: 900; }
            .shop div { font-size:14px; line-height:1.6; font-weight: 800; }
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
            <thead>
              <tr>
                <th>Date</th>
                <th style="text-align:right">Net W (kg)</th>
                <th style="text-align:right">LW (kg)</th>
                <th style="text-align:right">Calc</th>
                <th style="text-align:right">Total</th>
              </tr>
            </thead>
            <tbody>
              ${displayRows.map((r: any) => `
                <tr>
                  <td>${(new Date(r.dateStr)).toLocaleDateString()}</td>
                  <td style="text-align:right">${Number(r.kg||0).toFixed(2)}</td>
                  <td style="text-align:right">${Number(r.less||0).toFixed(2)}</td>
                  <td style="text-align:right">${r.effKg.toFixed(2)} × ${r.rate.toFixed(2)}</td>
                  <td style="text-align:right">₹${Number(r.amount||0).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <table style="width:100%; margin-top:8px; border-collapse:collapse;">
            <tbody>
              <tr>
                <th style="text-align:left; padding:6px 4px;">Total</th>
                <td style="text-align:right; padding:6px 4px;">₹${totalAmt.toFixed(2)}</td>
              </tr>
              <tr>
                <th style="text-align:left; padding:6px 4px;">Commission</th>
                <td style="text-align:right; padding:6px 4px;">₹${commission.toFixed(2)}</td>
              </tr>
              <tr>
                <th style="text-align:left; padding:6px 4px;">After Commission</th>
                <td style="text-align:right; padding:6px 4px;">₹${afterCommission.toFixed(2)}</td>
              </tr>
              <tr>
                <th style="text-align:left; padding:6px 4px;">Advance (already paid)</th>
                <td style="text-align:right; padding:6px 4px;">₹${advancePrev.toFixed(2)}</td>
              </tr>
              <tr>
                <th style="text-align:left; padding:6px 4px;">Grand Total</th>
                <td style="text-align:right; padding:6px 4px; font-weight:800;">₹${grandTotal.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>

          <script>window.onload = function() { window.print(); };</script>
        </body>
      </html>
    `;
    let win: Window | null = null;
    try { win = window.open('', '_blank'); } catch {}
    if (win) {
      win.document.open();
      win.document.write(html);
      win.document.close();
      // Try to auto-focus and print in the new window as a backup
      try {
        setTimeout(() => { try { win!.focus(); win!.print(); } catch {} }, 200);
      } catch {}
    } else {
      // Fallback: hidden iframe print (works when popups are blocked)
      try {
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);
        const doc = iframe.contentWindow?.document || iframe.contentDocument;
        if (!doc) throw new Error('No iframe document');
        doc.open();
        doc.write(html);
        doc.close();
        const tryPrint = () => {
          try { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); } catch {}
          setTimeout(() => { try { document.body.removeChild(iframe); } catch {} }, 800);
        };
        if ((iframe.contentWindow?.document?.readyState || '') === 'complete') {
          tryPrint();
        } else {
          iframe.onload = tryPrint;
          // Backup timer in case onload doesn't fire
          setTimeout(tryPrint, 500);
        }
      } catch (e) {
        try { toast.error('Unable to open print window. Please allow pop-ups and try again.'); } catch {}
      }
    }
    try { toast.success('Receipt opened for printing'); } catch {}
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
  // Client-side fallback: txn IDs that were just cleared in this session (until backend returns links)
  const [clientClearedTxnIds, setClientClearedTxnIds] = useState<Set<string>>(new Set());
  // Group history rows into a single entry per print action using a time bucket.
  // This preserves the exact From→To you cleared (e.g., 01/11→06/11) and
  // prevents older previous ranges from altering it.
  const groupedHist = useMemo(() => {
    const BUCKET_MS = 2 * 60 * 1000; // 2 minutes per action window (tighter grouping)
    type Row = { id: string; paid_at: string; from_date?: string; to_date?: string; amount: number; cleared_kg: number };
    type Bucket = Row & { display_from?: string; display_to?: string };
    const buckets = new Map<number, Bucket>();
    for (const h of (histPayments || [])) {
      const t = new Date(h.paid_at).getTime();
      const key = Math.floor(t / BUCKET_MS);
      const curFrom = normDate(h.from_date) || undefined;
      const curTo = normDate(h.to_date) || undefined;
      const amt = Number(h.amount || 0);
      const kg = Number(h.cleared_kg || 0);
      const prev = buckets.get(key);
      if (prev) {
        // Always sum amount/kg
        prev.amount = Number((prev.amount || 0) + amt);
        prev.cleared_kg = Number((prev.cleared_kg || 0) + kg);
        // Raw union (for fallback)
        const minFrom = (!prev.from_date ? curFrom : !curFrom ? prev.from_date : (prev.from_date! <= curFrom! ? prev.from_date : curFrom));
        const maxTo = (!prev.to_date ? curTo : !curTo ? prev.to_date : (prev.to_date! >= curTo! ? prev.to_date : curTo));
        prev.from_date = minFrom || undefined;
        prev.to_date = maxTo || undefined;
        // Display range only expands with rows that have cleared_kg > 0
        if (kg > 0) {
          const dMin = (!prev.display_from ? curFrom : !curFrom ? prev.display_from : (prev.display_from! <= curFrom! ? prev.display_from : curFrom));
          const dMax = (!prev.display_to ? curTo : !curTo ? prev.display_to : (prev.display_to! >= curTo! ? prev.display_to : curTo));
          prev.display_from = dMin || undefined;
          prev.display_to = dMax || undefined;
        }
        if (t > new Date(prev.paid_at).getTime()) prev.paid_at = h.paid_at;
      } else {
        buckets.set(key, {
          id: h.id,
          paid_at: h.paid_at,
          from_date: curFrom,
          to_date: curTo,
          amount: amt,
          cleared_kg: kg,
          display_from: kg > 0 ? curFrom : undefined,
          display_to: kg > 0 ? curTo : undefined,
        });
      }
    }
    // Align visible range with what was actually printed, using local receipt cache timestamps
    try {
      const raw = localStorage.getItem('payments_receipt_cache');
      if (raw && histSeller?.id) {
        const cache = JSON.parse(raw) || {};
        for (const [bucketKey, bucket] of buckets.entries()) {
          const startTs = bucketKey * BUCKET_MS;
          const endTs = startTs + BUCKET_MS - 1;
          const centerTs = new Date(bucket.paid_at).getTime();
          let bestKey: string | null = null;
          let bestDelta = Number.POSITIVE_INFINITY;
          for (const k of Object.keys(cache)) {
            const [sid] = k.split('|');
            if (String(sid) !== String(histSeller.id)) continue;
            const ts = Number(cache[k]?.ts || 0);
            if ((ts >= startTs && ts <= endTs) || (centerTs > 0 && Math.abs(ts - centerTs) <= 10*60*1000)) {
              const delta = centerTs > 0 ? Math.abs(ts - centerTs) : 0;
              if (delta < bestDelta) { bestDelta = delta; bestKey = k; }
            }
          }
          if (bestKey) {
            const [, fromK, toK] = bestKey.split('|');
            const b = buckets.get(bucketKey)!;
            b.display_from = normDate(fromK) || b.display_from || b.from_date;
            b.display_to = normDate(toK) || b.display_to || b.to_date;
            buckets.set(bucketKey, b);
          }
        }
      }
    } catch {}

    // If cache didn't resolve it, and the user currently has a range selected that exactly matches
    // the cleared kg of a recent bucket, force the visible range to the current selection.
    try {
      const selFrom = normDate(fromDate) || '';
      const selTo = normDate(toDate) || '';
      if (selFrom && selTo && (dailyRows as any[])?.length) {
        const toLocalStart = (ymd: string) => { const [y,m,d] = ymd.split('-').map(Number); return new Date(y,(m||1)-1,(d||1),0,0,0,0); };
        const toLocalEnd = (ymd: string) => { const [y,m,d] = ymd.split('-').map(Number); return new Date(y,(m||1)-1,(d||1),23,59,59,999); };
        const fD = toLocalStart(selFrom);
        const tD = toLocalEnd(selTo);
        const effSelKg = (dailyRows as any[])
          .filter(r => { const d = toLocalStart(String(r.ymd)); return d >= fD && d <= tD; })
          .reduce((s, r) => s + Number(r.effKg || 0), 0);
        for (const [bucketKey, bucket] of buckets.entries()) {
          const paidTs = new Date(bucket.paid_at).getTime();
          const recent = !isNaN(paidTs) && (Date.now() - paidTs < 2*60*60*1000); // last 2 hours
          if (recent && Math.abs(Number(bucket.cleared_kg||0) - effSelKg) < 0.001) {
            const b = buckets.get(bucketKey)!;
            b.display_from = selFrom;
            b.display_to = selTo;
            buckets.set(bucketKey, b);
          }
        }
      }
    } catch {}

    let out = Array.from(buckets.values())
      .filter(r => Number(r.cleared_kg || 0) > 0);
    // If a page From/To is selected, show only the bucket whose display range matches it
    const selFrom = normDate(fromDate) || '';
    const selTo = normDate(toDate) || '';
    if (selFrom && selTo) {
      const exact = out.filter(r => ((r.display_from || r.from_date || '') === selFrom) && ((r.display_to || r.to_date || '') === selTo));
      if (exact.length > 0) out = exact;
    }
    return out.sort((a,b) => new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime());
  }, [histPayments, fromDate, toDate]);
  const [payments, setPayments] = useState<Array<{ id: string; paid_at: string; from_date?: string; to_date?: string; amount: number; cleared_kg: number }>>([]);
  const [showClearUI, setShowClearUI] = useState(false);
  // Build per-day rows for the selected range (placed after payments state to avoid TDZ)
  const dailyRows = useMemo(() => {
    if (!result?.txns) return [] as Array<{ ymd: string; dateLabel: string; netKg: number; lwKg: number; effKg: number; rate: number; amount: number; advance: number }>;
    // Use SAME helpers as `filtered`
    const toLocalStart = (ymd: string) => { const [y,m,d] = ymd.split('-').map(Number); return new Date(y, (m||1)-1, d||1, 0,0,0,0); };
    const toLocalEnd = (ymd: string) => { const [y,m,d] = ymd.split('-').map(Number); return new Date(y, (m||1)-1, d||1, 23,59,59,999); };
    const parseTxnDate = (val: any) => {
      if (!val) return new Date(NaN);
      const s = String(val);
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return toLocalStart(s);
      // Also support dd/mm/yyyy
      const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (m) return toLocalStart(`${m[3]}-${m[2]}-${m[1]}`);
      return new Date(s);
    };
    // Normalize to YYYY-MM-DD (local day)
    const toYMD = (v: any) => {
      const s = String(v || '').trim();
      if (!s) return '';
      const m1 = s.match(/(\d{4})-(\d{2})-(\d{2})/);
      if (m1) return `${m1[1]}-${m1[2]}-${m1[3]}`;
      const m2 = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (m2) return `${m2[3]}-${m2[2]}-${m2[1]}`;
      const d = new Date(s);
      if (isNaN(d.getTime())) return '';
      const yy = d.getFullYear();
      const mm = String(d.getMonth()+1).padStart(2,'0');
      const dd = String(d.getDate()).padStart(2,'0');
      return `${yy}-${mm}-${dd}`;
    };
    const from = fromDate ? toLocalStart(fromDate) : null;
    const to = toDate ? toLocalEnd(toDate) : null;

    const byDay = new Map<string, { netKg: number; lwKg: number; amount: number; effKg: number }>();
    const idsByDay = new Map<string, Set<string>>();
    for (const t of result.txns) {
      const d = parseTxnDate((t as any).transaction_date || (t as any).created_at);
      if (from && d < from) continue;
      if (to && d > to) continue;
      const yyyy = d.getFullYear(); const mm = String(d.getMonth()+1).padStart(2,'0'); const dd = String(d.getDate()).padStart(2,'0');
      const ymd = `${yyyy}-${mm}-${dd}`;
      // Collect both possible identifiers to match payment links reliably
      const tidPrimary = (t as any).id ? String((t as any).id) : '';
      const tidAlt = (t as any).transaction_id ? String((t as any).transaction_id) : '';
      const netKg = Number((t as any).kg_added || 0);
      const lw = Number((t as any).less_weight || 0);
      const amt = Number((t as any).amount_added || 0);
      const cur = byDay.get(ymd) || { netKg: 0, lwKg: 0, amount: 0, effKg: 0 };
      cur.netKg += netKg;
      cur.lwKg += lw;
      cur.amount += amt;
      cur.effKg += Math.max(0, netKg - lw);
      byDay.set(ymd, cur);
      const setIds = idsByDay.get(ymd) || new Set<string>();
      if (tidPrimary) setIds.add(tidPrimary);
      if (tidAlt) setIds.add(tidAlt);
      idsByDay.set(ymd, setIds);
    }

    // Helper: local cleared days cache (sellerId -> ymd -> ts)
    const readLocalClearedDays = (sellerId?: string) => {
      try {
        const raw = localStorage.getItem('payments_cleared_days');
        if (!raw) return new Set<string>();
        const obj = JSON.parse(raw) || {};
        const map = obj && sellerId ? obj[String(sellerId)] : null;
        if (!map) return new Set<string>();
        const out = new Set<string>();
        const now = Date.now();
        for (const [ymd, ts] of Object.entries(map)) {
          if (now - Number(ts) <= 24*60*60*1000) out.add(ymd);
        }
        return out;
      } catch { return new Set<string>(); }
    };

    // Determine which days are cleared (per-day only):
    // A day is cleared if ANY saved payment in the DB references ANY txn on that day (cleared_kg > 0).
    const clearedByDay = new Map<string, boolean>();
    const localClearedDaySet = readLocalClearedDays(result?.seller?.id);
    for (const [ymd, setIds] of idsByDay.entries()) {
      let cleared = false;
      for (const p of (payments || [])) {
        // Support two shapes:
        // 1) Single-linked payment: { transaction_id, cleared_kg }
        // 2) Payment with transactions: { transactions: [{ transaction_id, cleared_kg }] }
        const pClearedKg = Number((p as any).cleared_kg || 0);
        const singleTid = (p as any).transaction_id ? String((p as any).transaction_id) : '';

        // Case 1: single transaction link
        if (singleTid && setIds.has(singleTid) && pClearedKg > 0) { cleared = true; break; }

        // Case 2: nested transactions array
        const txns = (p as any).transactions as Array<any> | undefined;
        if (Array.isArray(txns)) {
          const hit = txns.some((t: any) => {
            const tid = t?.transaction_id ? String(t.transaction_id) : '';
            const tCleared = Number(t?.cleared_kg || 0) > 0;
            return !!tid && setIds.has(tid) && tCleared;
          });
          if (hit) { cleared = true; break; }
        }
        // Range fallback (safe): ONLY when there are no per-transaction links provided
        // for this payment. This prevents new transactions added later inside the old
        // paid range from being mistakenly shown as cleared.
        if (!Array.isArray(txns) || txns.length === 0) {
          const fRaw = (p as any).from_date;
          const tRaw = (p as any).to_date;
          const paidAt = new Date((p as any).paid_at || (p as any).created_at || 0);
          if (fRaw && tRaw && pClearedKg > 0 && !isNaN(paidAt.getTime())) {
            const f = toYMD(fRaw);
            const t = toYMD(tRaw);
            const y = ymd;
            if (f && t && y >= f && y <= t) {
              // Only treat as cleared if there was at least one txn for this day created on/before payment time
              let hasTxnBefore = false;
              for (const tt of (result?.txns || [])) {
                const dY = toYMD((tt as any).transaction_date || (tt as any).created_at);
                if (dY !== y) continue;
                const cAt = new Date((tt as any).created_at || (tt as any).transaction_date);
                if (!isNaN(cAt.getTime()) && cAt.getTime() <= paidAt.getTime()) { hasTxnBefore = true; break; }
              }
              if (hasTxnBefore) { cleared = true; break; }
            }
          }
        }
      }
      // Client-side immediate feedback: if current session has cleared any txn on this day
      if (!cleared && clientClearedTxnIds.size > 0) {
        for (const tid of setIds) { if (clientClearedTxnIds.has(tid)) { cleared = true; break; } }
      }
      // Client-side persistence across refresh (24h): if this day was cleared recently, mark cleared
      // BUT only if no transactions for this day were created AFTER the cached timestamp
      if (!cleared && localClearedDaySet.has(ymd)) {
        try {
          const sellerId = result?.seller?.id ? String(result.seller.id) : '';
          if (sellerId) {
            const raw = localStorage.getItem('payments_cleared_days');
            if (raw) {
              const obj = JSON.parse(raw) || {};
              const bucket = obj[sellerId] || {};
              const ts = Number(bucket[ymd] || 0);
              if (ts > 0) {
                let hasAfter = false;
                for (const tt of (result?.txns || [])) {
                  const dY = toYMD((tt as any).transaction_date || (tt as any).created_at);
                  if (dY !== ymd) continue;
                  const cAt = new Date((tt as any).created_at || (tt as any).transaction_date);
                  if (!isNaN(cAt.getTime()) && cAt.getTime() > ts) { hasAfter = true; break; }
                }
                if (!hasAfter) cleared = true;
              }
            }
          }
        } catch {}
      }
      clearedByDay.set(ymd, cleared);
    }

    const advByDay = new Map<string, number>();
    for (const p of (payments || [])) {
      const tid = String((p as any).transaction_id || '');
      if (!tid) continue;
      for (const [ymd, setIds] of idsByDay.entries()) {
        if (setIds.has(tid)) {
          advByDay.set(ymd, (advByDay.get(ymd) || 0) + Number((p as any).amount || 0));
        }
      }
    }

    const rows = Array.from(byDay.entries())
      .map(([ymd, v]) => {
        const rate = v.effKg > 0 ? Number((v.amount / v.effKg).toFixed(2)) : 0;
        const adv = Number((advByDay.get(ymd) || 0).toFixed(2));
        const parts = ymd.split('-');
        const dateLabel = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : ymd;
        return { ymd, dateLabel, netKg: Number(v.netKg.toFixed(2)), lwKg: Number(v.lwKg.toFixed(2)), effKg: Number(v.effKg.toFixed(2)), rate, amount: Number(v.amount.toFixed(2)), advance: adv, cleared: !!clearedByDay.get(ymd) } as any;
      })
      .sort((a,b) => a.ymd.localeCompare(b.ymd));
    return rows;
  }, [result, payments, fromDate, toDate]);

  // Keep Advance (already paid) input in sync with the unpaid Advance total by default.
  // If the user manually edits the advance input we won't override it (tracked via lastEdited).
  useEffect(() => {
    try {
      const unpaid = (dailyRows as any[]).filter((r) => !r.cleared);
      const advSum = unpaid.reduce((s, r: any) => s + Number(r.advance || 0), 0);
      const desired = Math.max(0, Number(advSum.toFixed(2))).toFixed(2);
      if (lastEdited !== 'advance') {
        setAdvanceInput(desired);
      }
    } catch {}
  }, [dailyRows, lastEdited]);
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
      const cached = getReceiptFromCache(seller.id, selFromKey, selToKey);
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
                    <div className="mt-2">
                      <Button
                        type="button"
                        variant="default"
                        className="w-full sm:w-auto"
                        onClick={handleClearAndPrint}
                        disabled={paying}
                      >
                        Clear Payment & Print
                      </Button>
                    </div>
      effectiveKg = remainingKg;
    }

    if (!(effectiveAmount > 0) && !(effectiveKg > 0)) { toast.error('Nothing to clear'); return; }
    // Apply commission and advance to the amount we actually save to history
    const commissionNum = Math.max(0, Number(commissionInput || 0));
    const advanceNum = Math.max(0, Number(advanceInput || 0));
    const effectiveAmountNet = Math.max(0, Number((effectiveAmount - commissionNum - advanceNum).toFixed(2)));
    if (paying) return; // one-click guard
    try {
      setPaying(true);
      // Gather transaction IDs and build per-transaction cleared_kg allocation for current selection
      const selFromY = normDate(fromDate) || '';
      const selToY = normDate(toDate) || '';
      const txnIdSet = new Set<string>();
      const txnAlloc: Array<{ transaction_id: string; cleared_kg: number }> = [];
      if (result?.txns && (selFromY || selToY)) {
        // Collect txns within range and compute each txn effKg (net - less)
        const inRange = (result.txns as any[])
          .map((t) => ({
            raw: t,
            ymd: normDate((t as any).transaction_date || (t as any).created_at),
            idPrimary: (t as any).id ? String((t as any).id) : '',
            idAlt: (t as any).transaction_id ? String((t as any).transaction_id) : '',
            netKg: Number((t as any).kg_added || 0),
            lwKg: Number((t as any).less_weight || 0),
          }))
          .filter((x) => !!x.ymd && (!selFromY || x.ymd! >= selFromY) && (!selToY || x.ymd! <= selToY))
          .map((x) => ({
            ...x,
            effKg: Math.max(0, Number((x.netKg - x.lwKg).toFixed(2))),
            txnId: x.idAlt || x.idPrimary,
          }))
          .filter((x) => !!x.txnId);

        // Add IDs to legacy set
        for (const x of inRange) txnIdSet.add(x.txnId!);

        // Greedy allocate cleared kg across txns in date order
        let remainingKgToClear = Number(effectiveKg || 0);
        for (const x of inRange.sort((a,b) => (a.ymd! < b.ymd! ? -1 : a.ymd! > b.ymd! ? 1 : 0))) {
          if (!(remainingKgToClear > 0)) break;
          const take = Math.min(remainingKgToClear, x.effKg);
          if (take > 0) {
            txnAlloc.push({ transaction_id: x.txnId!, cleared_kg: Number(take.toFixed(2)) });
            remainingKgToClear = Number((remainingKgToClear - take).toFixed(2));
          }
        }
        // If no weight provided but amount-only clear happened, still link all txns with a nominal cleared_kg = 0.01 for traceability
        if (txnAlloc.length === 0 && effectiveKg <= 0) {
          for (const x of inRange) txnAlloc.push({ transaction_id: x.txnId!, cleared_kg: 0.01 });
        }
      }
      // Build payload with base fields + extended linkage (cast to any to satisfy TS where API type is strict)
      const payload: any = {
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
        amount: effectiveAmountNet,
        cleared_kg: effectiveKg,
      };
      payload.transaction_ids = Array.from(txnIdSet);
      payload.transactions = txnAlloc;
      const saved = await sellerApi.addPayment(result.seller.id, payload as any);
      // Client-side immediate cleared marking:
      // Prefer ONLY the transaction_ids actually linked in the saved payload to avoid false positives.
      // Additionally, if allocation sum matches the selected effective kg (within epsilon),
      // mark ALL selected txnIds as cleared for immediate UX.
      try {
        const savedIds = new Set<string>((payload.transactions || []).map((x: any) => String(x.transaction_id)));
        const sumAlloc = Array.isArray(payload.transactions)
          ? (payload.transactions as any[]).reduce((s, it) => s + Number(it?.cleared_kg || 0), 0)
          : 0;
        const selEffKg = Number(effectiveKg || 0);
        const coversAll = Math.abs(sumAlloc - selEffKg) <= 0.1; // relaxed epsilon for rounding

        setClientClearedTxnIds((prev) => {
          const next = new Set<string>(prev);
          // always add explicit links
          savedIds.forEach((id) => { if (id) next.add(id); });
          // if allocation covers full selection, add all selected ids for instant visual clear
          if (coversAll && txnIdSet && txnIdSet.size > 0) {
            Array.from(txnIdSet).forEach((id) => { if (id) next.add(String(id)); });
          }
          return next;
        });
      } catch {}
      setPayments((prev) => [saved, ...(prev || [])]);

      // Persist cleared day keys locally for 24h so they survive refresh
      try {
        const sellerId = result?.seller?.id ? String(result.seller.id) : '';
        if (sellerId) {
          // derive ymds covered by this payment from the allocation list or the current in-range selection
          const ymdSet = new Set<string>();
          // Prefer transactions actually linked in payload
          if (Array.isArray(payload.transactions)) {
            // We need a map from txnId to ymd; rebuild from current result.txns
            const map = new Map<string, string>();
            for (const t of (result?.txns || [])) {
              const ymd = normDate((t as any).transaction_date || (t as any).created_at);
              const idPrimary = (t as any).id ? String((t as any).id) : '';
              const idAlt = (t as any).transaction_id ? String((t as any).transaction_id) : '';
              if (idPrimary) map.set(idPrimary, ymd || '');
              if (idAlt) map.set(idAlt, ymd || '');
            }
            for (const it of payload.transactions as any[]) {
              const tid = String((it as any)?.transaction_id || '');
              const y = map.get(tid);
              if (y) ymdSet.add(y);
            }
          }
          // Preferred: if we can infer the unpaid days from the current table, persist exactly those
          try {
            const fY = normDate(fromDate) || '';
            const tY = normDate(toDate) || '';
            const unpaidDays = (dailyRows as any[])
              .filter(r => !r.cleared)
              .map(r => String(r.ymd))
              .filter(d => !!d && (!fY || d >= fY) && (!tY || d <= tY));
            if (unpaidDays.length > 0) {
              unpaidDays.forEach(d => ymdSet.add(d));
            }
          } catch {}
          // Fallback: if no links present OR allocation fully covers selection, add all days in current selection
          if (ymdSet.size === 0 || Math.abs((payload.transactions||[]).reduce((s:any,it:any)=>s+Number(it?.cleared_kg||0),0) - Number(effectiveKg||0)) <= 0.1) {
            const fY = normDate(fromDate) || '';
            const tY = normDate(toDate) || '';
            for (const t of (result?.txns || [])) {
              const y = normDate((t as any).transaction_date || (t as any).created_at) || '';
              if (y && (!fY || y >= fY) && (!tY || y <= tY)) ymdSet.add(y);
            }
          }
          if (ymdSet.size > 0) {
            const raw = localStorage.getItem('payments_cleared_days');
            const obj = raw ? JSON.parse(raw) : {};
            const bucket = obj[sellerId] || {};
            const now = Date.now();
            for (const y of Array.from(ymdSet)) bucket[y] = now;
            obj[sellerId] = bucket;
            localStorage.setItem('payments_cleared_days', JSON.stringify(obj));
          }
        }
      } catch {}
      // Refresh seller + payments so dailyRows recompute and cleared flags update immediately
      await handleSearch();
      toast.success("Payment saved in history");
      // Prepare receipt details for printing (no dialog)
      const selFromKeyNow = normDate(fromDate);
      const selToKeyNow = normDate(toDate);
      setReceipt({ amount: Number(effectiveAmountNet||0), kg: Number(effectiveKg||0), from: selFromKeyNow, to: selToKeyNow });
      if (result?.seller?.id) {
        const commission = Math.max(0, Number(commissionInput || 0));
        const advancePrev = Math.max(0, Number(advanceInput || 0));
        saveReceiptToCache(result.seller.id, { amount: Number(effectiveAmountNet||0), kg: Number(effectiveKg||0), from: selFromKeyNow, to: selToKeyNow, commission, advance: advancePrev });
      }
      try { window.dispatchEvent(new Event('payments:updated')); } catch {}
      // Also notify other tabs/pages
      try { localStorage.setItem('payments_updated_ts', String(Date.now())); } catch {}
      try { const bc = new BroadcastChannel('payments'); bc.postMessage({ type: 'updated', ts: Date.now() }); bc.close(); } catch {}
      // Clear inputs and recompute remaining by bumping state
      setPaymentAmount("");
      setPaymentWeight("");
      setLastEdited(null);
      setPaymentsBump((v) => v + 1);
      setJustPaid(true);
      window.setTimeout(() => setJustPaid(false), 1500);
      // Close the Clear UI so the table is fully visible with updated '(cleared)' flags
      setShowClearUI(false);
      // If History is open (or previously searched) for this same seller, refresh it so the new row appears
      try {
        if ((histSeller && result?.seller && histSeller.id === result.seller.id) || histOpen) {
          const latest = await sellerApi.getPayments(result!.seller!.id);
          setHistPayments(latest || []);
        }
      } catch {}
      try { toast.success('Updated. Cleared days are now reflected above.'); } catch {}
    } catch {
      toast.error("Failed to save payment");
    } finally { setPaying(false); }
  };

  const handleClearAndPrint = async () => {
    await handlePaid();
    try {
      await handleDownloadPdf();
    } catch {}
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

  // Payments linked to transactions within the selected range (by transaction_id)
  const linkedPaidForRange = useMemo(() => {
    if (!result?.txns) return { kg: 0, amount: 0 };
    // Build set of txn ids that fall inside the current range
    const toLocalStart = (ymd: string) => { const [y,m,d] = ymd.split('-').map(Number); return new Date(y, (m||1)-1, d||1, 0,0,0,0); };
    const toLocalEnd = (ymd: string) => { const [y,m,d] = ymd.split('-').map(Number); return new Date(y, (m||1)-1, d||1, 23,59,59,999); };
    const parseTxnDate = (val: any) => { const s = String(val||''); if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return toLocalStart(s); return new Date(s); };
    const from = fromDate ? toLocalStart(fromDate) : null;
    const to = toDate ? toLocalEnd(toDate) : null;
    const ids = new Set<string>();
    for (const t of result.txns) {
      const dStr = (t as any).transaction_date || (t as any).created_at;
      const d = parseTxnDate(dStr);
      if (from && d < from) continue;
      if (to && d > to) continue;
      const id = String((t as any).id || '');
      if (id) ids.add(id);
    }
    let amount = 0, kg = 0;
    for (const p of payments || []) {
      const tid = String((p as any).transaction_id || '');
      if (tid && ids.has(tid)) {
        amount += Number((p as any).amount || 0);
        kg += Number((p as any).cleared_kg || 0);
      }
    }
    return { kg, amount };
  }, [result, payments, fromDate, toDate]);

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

  // Only payments that exactly match the selected From/To
  const exactPaidForRange = useMemo(() => {
    if (!result?.seller?.id) return { kg: 0, amount: 0 };
    const selFrom = normDate(fromDate) || '';
    const selTo = normDate(toDate) || '';
    const exact = (payments || []).filter(p => (normDate(p.from_date) || '') === selFrom && (normDate(p.to_date) || '') === selTo);
    const amount = exact.reduce((s, p) => s + Number(p.amount || 0), 0);
    const kg = exact.reduce((s, p) => s + Number(p.cleared_kg || 0), 0);
    return { kg, amount };
  }, [payments, result, fromDate, toDate]);

  // Disable actions only when ALL days in current selection are already cleared
  const hasClearedForRange = React.useMemo(() => {
    return dailyRows.length > 0 && dailyRows.every(r => (r as any).cleared === true);
  }, [dailyRows]);

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

    // Cleared cards should reflect only actual saved payments for the range
    const effectivePaidAmount = Math.max(0, Number(paidForRange.amount || 0));
    const effectivePaidKg = Math.max(0, Number(paidForRange.kg || 0));

    clearedAmount = Math.min(filtered.amount, effectivePaidAmount);
    clearedKg = Math.min(filtered.kg, effectivePaidKg);

    // Remaining reflects saved payments only
    const remainAmount = Math.max(0, filtered.amount - effectivePaidAmount);
    const remainKg = Math.max(0, filtered.kg - effectivePaidKg);
    return { clearedAmount, clearedKg, remainAmount, remainKg };
  }, [paymentAmount, paymentWeight, lastEdited, filtered, avgRate, payments, result, fromDate, toDate, lastSaved, paidOverride, paidForRange]);

  // Prefill inputs to match Purchases Total view:
  // - Payment Weight (kg): total kg in range
  // - Payment Amount (to clear): total amount in range
  // - Advance: total paid in range (can be edited)
  React.useEffect(() => {
    if (!result?.seller) return;
    // Only prefill when fields are empty (avoid overwriting user edits)
    if ((paymentAmount === '' && paymentWeight === '')) {
      const amt = Number(filtered.amount || 0);
      const kg = Number(filtered.kg || 0);
      setPaymentAmount(amt > 0 ? amt.toFixed(2) : '');
      setPaymentWeight(kg > 0 ? kg.toFixed(2) : '');
      setLastEdited(null);
    }
    // Prefill advance when not set by user (empty or zero string)
    if (advanceInput === '' || /^0+(\.0+)?$/.test(String(advanceInput))) {
      const advLinked = Number(linkedPaidForRange.amount || 0);
      const advOverlap = Number(paidForRange.amount || 0);
      const adv = advLinked > 0 ? advLinked : advOverlap;
      setAdvanceInput(adv.toFixed(2));
    }
  }, [result, filtered.amount, filtered.kg, fromDate, toDate, paidForRange.amount, linkedPaidForRange.amount]);

  // Display totals for the top cards: show REMAINING (unpaid) within the selected range
  // Remaining = sum of transactions that are NOT cleared by a payment (exact range or linked txn_id)
  const displayTotals = useMemo(() => {
    if (!result?.txns) return { kg: 0, amount: 0 };
    const toYMD = (v: any) => {
      const s = String(v || '').trim();
      if (!s) return '';
      const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (m) return s.slice(0, 10);
      const d = new Date(s);
      return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
    };
    const uiFrom = normDate(fromDate) || '';
    const uiTo = normDate(toDate) || '';
    const inSelectedRange = (ymd: string) => {
      const y = ymd || '';
      // Normalize order: if both are set and out of order, swap
      const both = uiFrom && uiTo;
      const start = both ? (uiFrom <= uiTo ? uiFrom : uiTo) : (uiFrom || '0000-00-00');
      const end = both ? (uiFrom <= uiTo ? uiTo : uiFrom) : (uiTo || '9999-99-99');
      return !(y < start || y > end);
    };
    const isTxnCleared = (ymd: string, txnId: string) => {
      const pays = payments || [];
      const y = ymd || '';
      for (const p of pays) {
        const linkedTid = String((p as any).transaction_id || '');
        const clearedKg = Number((p as any).cleared_kg || 0);
        if (linkedTid && txnId && linkedTid === txnId && clearedKg > 0) return true;
        const fRaw = (p as any).from_date;
        const tRaw = (p as any).to_date;
        if (!fRaw || !tRaw) continue;
        const f = toYMD(fRaw);
        const t = toYMD(tRaw);
        if (!f || !t) continue;
        if (y >= f && y <= t) return true;
      }
      return false;
    };
    let kg = 0, amount = 0;
    const remainingTxnIds = new Set<string>();
    for (const t of result.txns) {
      const ymd = toYMD((t as any).transaction_date || (t as any).created_at);
      if (!inSelectedRange(ymd)) continue;
      const tid = String((t as any).id || '');
      if (isTxnCleared(ymd, tid)) continue; // skip cleared
      kg += Number((t as any).kg_added || 0);
      amount += Number((t as any).amount_added || 0);
      if (tid) remainingTxnIds.add(tid);
    }
    // Advance linked ONLY to remaining (unpaid) transactions
    let advance = 0;
    for (const p of (payments || [])) {
      const tid = String((p as any).transaction_id || '');
      if (tid && remainingTxnIds.has(tid)) {
        advance += Number((p as any).amount || 0);
      }
    }
    return { kg, amount, advance };
  }, [result, fromDate, toDate, payments]);

  const handleDownloadPdf = async () => {
    if (printing) return;
    setPrinting(true);
    if (!result?.seller) { try { toast.error('Search a seller first'); } catch {} return; }
    try { toast.message?.('Generating receipt…'); } catch {}
    // Prefer the receipt context if available (just-paid values)
    const useFrom = receipt?.from ?? fromDate;
    const useTo = receipt?.to ?? toDate;
    const paidAmt = receipt ? Number(receipt.amount || 0) : Number(cleared.clearedAmount || 0);
    const paidKg = receipt ? Number(receipt.kg || 0) : Number(cleared.clearedKg || 0);
    // Build detailed rows from transactions within selected range
    const selFrom = useFrom ? new Date(useFrom) : null;
    const selTo = useTo ? new Date(useTo) : null;
    const toLocalStart = (ymd: string) => { const [y,m,d] = ymd.split('-').map(Number); return new Date(y, (m||1)-1, d||1, 0,0,0,0); };
    const toLocalEnd = (ymd: string) => { const [y,m,d] = ymd.split('-').map(Number); return new Date(y, (m||1)-1, d||1, 23,59,59,999); };
    const parseTxnDate = (val: any) => { const s = String(val||''); if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return toLocalStart(s); return new Date(s); };
    const inRange = (d: Date) => {
      const fromD = useFrom ? toLocalStart(String(useFrom)) : null;
      const toD = useTo ? toLocalEnd(String(useTo)) : null;
      if (fromD && d < fromD) return false; if (toD && d > toD) return false; return true;
    };
    // Prefer printing ONLY unpaid days using precomputed dailyRows (which already marks cleared days)
    let computedRows: Array<{ dateStr: string; d: Date; kg: number; less: number; effKg: number; rate: number; amount: number }>; 
    try {
      const unpaid = (dailyRows as any[])
        .filter(r => !r.cleared)
        .map(r => ({
          dateStr: r.ymd,
          d: toLocalStart(r.ymd),
          kg: Number(r.netKg || 0),
          less: Number(r.lwKg || 0),
          effKg: Number(r.effKg || 0),
          amount: Number(r.amount || 0),
        }))
        .filter(r => inRange(r.d))
        .sort((a,b) => a.d.getTime() - b.d.getTime())
        .map(r => ({ ...r, rate: r.effKg > 0 ? Number((r.amount / r.effKg).toFixed(2)) : 0 }));
      if (unpaid.length > 0) {
        computedRows = unpaid as any;
      } else {
        // Fallback: original behavior (all rows in selected range)
        const rows = (result.txns || [])
          .map((t: any) => ({
            dateStr: (t.transaction_date || t.created_at),
            d: parseTxnDate(t.transaction_date || t.created_at),
            kg: Number(t.kg_added || 0),
            less: Number(t.less_weight || 0),
            amount: Number(t.amount_added || 0),
          }))
          .filter(r => inRange(r.d))
          .sort((a,b) => a.d.getTime() - b.d.getTime());
        computedRows = rows.map(r => {
          const effKg = Math.max(0, Number((r.kg - r.less).toFixed(2)));
          const rate = effKg > 0 ? Number((r.amount / effKg).toFixed(2)) : 0;
          return { ...r, effKg, rate };
        });
      }
    } catch {
      // Safe fallback
      const rows = (result.txns || [])
        .map((t: any) => ({
          dateStr: (t.transaction_date || t.created_at),
          d: parseTxnDate(t.transaction_date || t.created_at),
          kg: Number(t.kg_added || 0),
          less: Number(t.less_weight || 0),
          amount: Number(t.amount_added || 0),
        }))
        .filter(r => inRange(r.d))
        .sort((a,b) => a.d.getTime() - b.d.getTime());
      computedRows = rows.map(r => {
        const effKg = Math.max(0, Number((r.kg - r.less).toFixed(2)));
        const rate = effKg > 0 ? Number((r.amount / effKg).toFixed(2)) : 0;
        return { ...r, effKg, rate };
      });
    }
    const totalAmt = computedRows.reduce((s,r) => s + Number(r.amount||0), 0);
    const totalKg = computedRows.reduce((s,r) => s + Number(r.effKg||0), 0);

    // Commission and previous advances (user adjustable)
    const commission = Math.max(0, Number(commissionInput || 0));
    // Suggested advance: all payments overlapping the selected range MINUS the current payment
    const suggestedAdvanceBase = Math.max(0, Number(paidForRange.amount || 0));
    const suggestedAdvance = Math.max(0, Number(suggestedAdvanceBase - paidAmt));
    const advancePrev = Math.max(0, Number((advanceInput || "").trim() === "" ? suggestedAdvance : advanceInput));
    const afterCommission = Math.max(0, totalAmt - commission);
    const grandTotal = Math.max(0, afterCommission - advancePrev);
    const titleRange = `${fmtDMY(useFrom) || 'Start'} → ${fmtDMY(useTo) || 'End'}`;
    // Load shop profile
    let profile: any = null;
    try { profile = await profileApi.get(); } catch {}
    const shopName = (profile && (profile.shop_name || profile.shopName)) || '';
    const ownerName = (profile && (profile.owner_name || profile.ownerName)) || '';
    const ownerMobile = (profile && profile.mobile) || '';
    const whenNow = new Date().toLocaleString();

    const html = `
      <html>
        <head>
          <meta charset="UTF-8" />
          <title>Payment Receipt - ${result.seller.serial_number} ${result.seller.name}</title>
          <style>
            ${thermalMode ? `
            @page { size: 80mm auto; margin: 0; }
            body { width: 80mm; margin: 0; font-family: -apple-system, Segoe UI, Roboto, Arial; padding: 6px 8px; font-weight: 500; }
            h1 { font-size: 14px; margin: 0 0 6px 0; text-align:center; font-weight: 800; }
            .muted { color: #222; font-size: 10px; margin: 0 0 6px 0; text-align:center; font-weight: 600; }
            table { width: 100%; border-collapse: collapse; margin-top: 6px; }
            th, td { border-top: 1px dashed #000; padding: 6px 0; font-size: 11px; }
            th { text-align: left; font-weight: 800; }
            td { font-weight: 700; }
            .shop { text-align:center; margin-bottom:6px; }
            .shop h2 { margin:0 0 4px 0; font-size:12px; font-weight: 800; }
            .shop div { font-size:11px; line-height:1.4; font-weight: 700; }
            .hr { border-top: 1px dashed #000; margin: 6px 0; }
            ` : `
            body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica, Arial; padding: 20px; }
            h1 { font-size: 22px; margin-bottom: 6px; font-weight: 900; }
            .muted { color: #111827; font-size: 12px; margin-bottom: 14px; font-weight: 600; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #111827; padding: 8px; font-size: 13px; }
            th { background: #f3f4f6; text-align: left; font-weight: 800; }
            td { font-weight: 700; }
            .shop { border:1px solid #111827; border-radius:8px; padding:12px; margin-bottom:12px; }
            .shop h2 { margin:0 0 8px 0; font-size:16px; font-weight: 900; }
            .shop div { font-size:13px; line-height:1.6; font-weight: 700; }
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
          <div class="muted">When: ${whenNow}</div>
          <div class="muted">Range: ${titleRange}</div>

          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th style="text-align:right">Net W (kg)</th>
                <th style="text-align:right">Less W (kg)</th>
                <th style="text-align:right">Calc</th>
                <th style="text-align:right">Total</th>
              </tr>
            </thead>
            <tbody>
              ${computedRows.map(r => `
                <tr>
                  <td>${(new Date(r.dateStr)).toLocaleDateString()}</td>
                  <td style="text-align:right">${Number(r.kg||0).toFixed(2)}</td>
                  <td style="text-align:right">${Number(r.less||0).toFixed(2)}</td>
                  <td style="text-align:right">${r.effKg.toFixed(2)} × ${r.rate.toFixed(2)}</td>
                  <td style="text-align:right">₹${Number(r.amount||0).toFixed(2)}</td>
                </tr>
              `).join('')}
              <tr>
                <th colspan="4" style="text-align:right">Total</th>
                <td style="text-align:right">₹${totalAmt.toFixed(2)}</td>
              </tr>
              <tr>
                <th colspan="4" style="text-align:right">Commission</th>
                <td style="text-align:right">₹${commission.toFixed(2)}</td>
              </tr>
              <tr>
                <th colspan="4" style="text-align:right">After Commission</th>
                <td style="text-align:right">₹${afterCommission.toFixed(2)}</td>
              </tr>
              <tr>
                <th colspan="4" style="text-align:right">Advance (already paid)</th>
                <td style="text-align:right">₹${advancePrev.toFixed(2)}</td>
              </tr>
              <tr>
                <th colspan="4" style="text-align:right">Grand Total</th>
                <td style="text-align:right">₹${grandTotal.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>

          <script>window.onload = function() { window.print(); };</script>
        </body>
      </html>
    `;
    let win: Window | null = null;
    try { win = window.open('', '_blank'); } catch {}
    if (win) {
      win.document.open();
      win.document.write(html);
      win.document.close();
      try { setTimeout(() => { try { win!.focus(); win!.print(); } catch {} }, 200); } catch {}
    } else {
      try {
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);
        const doc = iframe.contentWindow?.document || iframe.contentDocument;
        if (!doc) throw new Error('No iframe document');
        doc.open();
        doc.write(html);
        doc.close();
        const tryPrint = () => {
          try { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); } catch {}
          setTimeout(() => { try { document.body.removeChild(iframe); } catch {} }, 800);
        };
        if ((iframe.contentWindow?.document?.readyState || '') === 'complete') {
          tryPrint();
        } else {
          iframe.onload = tryPrint;
          setTimeout(tryPrint, 500);
        }
      } catch (e) {
        try { toast.error('Unable to open print window. Please allow pop-ups and try again.'); } catch {}
      }
    }
    // Block UI briefly then close the dialog
    setTimeout(() => { setPrinting(false); setReceiptOpen(false); }, 400);
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
              {/* summary tiles removed per request */}

              {/* Per-day details table */}
              <div className="mt-2 overflow-x-auto">
                {dailyRows.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No entries in this range.</div>
                ) : (
                  <table className="min-w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-2">Date</th>
                        <th className="text-right p-2">Net W (kg)</th>
                        <th className="text-right p-2">LW (kg)</th>
                        <th className="text-right p-2">Calc</th>
                        <th className="text-right p-2">Amount</th>
                        <th className="text-right p-2">Advance Paid</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailyRows.map(r => (
                        <tr key={r.ymd} className="border-t">
                          <td className="p-2">
                            {r.dateLabel}
                            {r.cleared && (
                              <span className="ml-1 text-green-600">(cleared)</span>
                            )}
                          </td>
                          <td className="p-2 text-right">{r.netKg.toFixed(2)}</td>
                          <td className="p-2 text-right">{r.lwKg.toFixed(2)}</td>
                          <td className="p-2 text-right">{r.effKg.toFixed(2)} × {r.rate.toFixed(2)}</td>
                          <td className="p-2 text-right">₹{r.amount.toFixed(2)}</td>
                          <td className="p-2 text-right">₹{r.advance.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t font-semibold">
                        <td className="p-2 text-right">Total</td>
                        {/* Unpaid sums from visible rows */}
                        <td className="p-2 text-right">{dailyRows.filter(r=>!r.cleared).reduce((s,r)=>s+r.netKg,0).toFixed(2)}</td>
                        {/* LW (kg) total for UNPAID rows only */}
                        <td className="p-2 text-right">{dailyRows.filter(r=>!r.cleared).reduce((s,r)=>s+r.lwKg,0).toFixed(2)}</td>
                        <td className="p-2 text-right">{/* empty calc total */}</td>
                        <td className="p-2 text-right">₹{dailyRows.filter(r=>!r.cleared).reduce((s,r)=>s+r.amount,0).toFixed(2)}</td>
                        <td className="p-2 text-right">₹{dailyRows.filter(r=>!r.cleared).reduce((s,r)=>s+Number(r.advance||0),0).toFixed(2)}</td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>

              {/* Bottom action: Clear under totals */}
                  <div className="mt-3 flex justify-start">
                    <Button onClick={() => setShowClearUI(v => !v)} disabled={dailyRows.length === 0}>
                      Clear
                    </Button>
                  </div>

              {showClearUI && (
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
                        disabled={paying || hasClearedForRange}
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
                        disabled={paying || hasClearedForRange}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        const unpaid = (dailyRows as any[]).filter(r => !r.cleared);
                        const amtSum = unpaid.reduce((s, r: any) => s + Number(r.amount || 0), 0);
                        const kgSum = unpaid.reduce((s, r: any) => s + Number(r.effKg || 0), 0);
                        const advSum = unpaid.reduce((s, r: any) => s + Number(r.advance || 0), 0);
                        setLastEdited('amount');
                        const amt = Math.max(0, Number(amtSum.toFixed(2)));
                        setPaymentAmount(amt.toFixed(2));
                        const kg = Math.max(0, Number(kgSum.toFixed(2)));
                        setPaymentWeight(kg.toFixed(2));
                        // Prefill remaining advance (unpaid) into the Advance input; if fully cleared this becomes 0.00
                        const adv = Math.max(0, Number(advSum.toFixed(2)));
                        setAdvanceInput(adv.toFixed(2));
                        // Do not force a default commission; leave empty by default
                        setCommissionInput('');
                      }}
                      disabled={paying || hasClearedForRange || ((dailyRows as any[]).filter(r => !r.cleared).length === 0)}
                      title={hasClearedForRange ? 'Already cleared for this range' : undefined}
                    >
                      Clear Full
                    </Button>
                  </div>
                  <div className="sm:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                    <div>
                      <label className="block text-sm text-muted-foreground mb-1">Commission (₹)</label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="Enter commission"
                        value={commissionInput}
                        onChange={(e) => setCommissionInput(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-muted-foreground mb-1">Advance (already paid) (₹)</label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="Enter previous advance"
                        value={advanceInput}
                        onChange={(e) => { setLastEdited('advance'); setAdvanceInput(e.target.value); }}
                      />
                    </div>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <Button
                      type="button"
                      variant="default"
                      className="w-full sm:w-auto"
                      onClick={handleClearAndPrint}
                      disabled={paying || printing || hasClearedForRange}
                      title={hasClearedForRange ? 'Already cleared for this range' : undefined}
                    >
                      Print
                    </Button>
                  </div>

                </div>
              )}

              {/* Cleared/Remaining summary cards removed per request */}
            </CardContent>
          </Card>
        )}

        {/* History dialog (top-right) */}
        <Dialog open={histOpen} onOpenChange={setHistOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Payment History</DialogTitle>
              <DialogDescription>View and print previous payments for this seller.</DialogDescription>
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
                {groupedHist.length === 0 ? (
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
                      {groupedHist.map((h) => (
                        <tr key={h.id} className="border-t">
                          <td className="p-2">{new Date(h.paid_at).toLocaleString()}</td>
                          <td className="p-2">{fmtDMY((h as any).display_from || h.from_date) || 'Start'} → {fmtDMY((h as any).display_to || h.to_date) || 'End'}</td>
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
              <DialogDescription>Adjust commission and advance, then print a detailed receipt.</DialogDescription>
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
                    <div className="text-lg font-bold">{Number(filtered.kg||0).toFixed(2)} kg</div>
                  </div>
                  <div className="rounded-lg p-3 bg-amber-50 dark:bg-amber-950 text-center">
                    <div className="text-xs text-muted-foreground">Cleared Amount</div>
                    <div className="text-lg font-bold">₹{Number(filtered.amount||0).toFixed(2)}</div>
                  </div>
                </div>
                {/* Adjustments before printing */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-muted-foreground mb-1">Commission (₹)</label>
                    <Input type="number" min={0} step="0.01" value={commissionInput}
                      disabled={printing}
                      onChange={(e) => setCommissionInput(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm text-muted-foreground mb-1">Advance (already paid) (₹)</label>
                    <Input type="number" min={0} step="0.01" value={advanceInput}
                      disabled={printing}
                      onChange={(e) => setAdvanceInput(e.target.value)} />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setReceiptOpen(false)} disabled={printing}>Close</Button>
                  <Button variant="default" onClick={handleClearAndPrint} disabled={printing}>{printing ? 'Printing…' : 'Print Receipt'}</Button>
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
