"use client"
import { useState, useEffect, useCallback } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

type Category = "Lumber" | "Hardware" | "Finishing" | "Tools" | "Joinery" | "Other";
type PayMethod = "cash" | "mpesa" | "credit";
type CustomerType = "regular" | "trade";
type DiscountType = "pct" | "flat";
type Tab = "pos" | "inventory" | "customers" | "history" | "reports";

interface Item {
  id: string;
  name: string;
  cat: Category;
  unit: string;
  cost: number;
  sell: number;
  qty: number;
  thresh: number;
  supplier: string;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
  type: CustomerType;
  disc: number;
  note: string;
  spent: number;
  purchases: number;
  balance: number;
}

interface CartLine {
  itemId: string;
  name: string;
  qty: number;
  unitPrice: number;
  cost: number;
}

interface HeldOrder {
  id: string;
  time: string;
  items: CartLine[];
}

interface Transaction {
  id: string;
  receiptNo: string;
  date: string;
  time: string;
  customerId: string;
  customerName: string;
  items: CartLine[];
  subtotal: number;
  discount: number;
  vat: number;
  total: number;
  profit: number;
  payMethod: PayMethod;
  taxRate: number;
}

interface DB {
  items: Item[];
  transactions: Transaction[];
  customers: Customer[];
  heldOrders: HeldOrder[];
  shiftStart: string;
}

// ── Default seed data ─────────────────────────────────────────────────────────

const DEFAULT_DB: DB = {
  items: [
    { id: "i1", name: "Pine Plank 2×4", cat: "Lumber", unit: "pcs", cost: 350, sell: 600, qty: 40, thresh: 10, supplier: "Nairobi Timber" },
    { id: "i1", name: "Blue gum 2×4", cat: "Lumber", unit: "pcs", cost: 26, sell: 32, qty: 100, thresh: 10, supplier: "Blue gum timber suplliers" },
  ],
  transactions: [],
  customers: [
    { id: "c1", name: "Timothy Mutwiri", phone: "0790337192", type: "regular", disc: 10, note: "Regular customer", spent: 0, purchases: 0, balance: 0 },
  ],
  heldOrders: [],
  shiftStart: new Date().toISOString(),
};

const STORAGE_KEY = "cw_pos_v1";
const CATS: Category[] = ["Lumber", "Hardware", "Finishing", "Tools", "Joinery", "Other"];

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) => "KES " + Math.round(n).toLocaleString();
const todayStr = () => new Date().toISOString().split("T")[0];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

function loadDB(): DB {
  // 1. Immediately return default database if we are running on the server
  if (typeof window === "undefined") {
    return JSON.parse(JSON.stringify(DEFAULT_DB)) as DB;
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as DB;
  } catch { /* ignore */ }

  // 2. We are in the browser, but no data exists yet. Seed it.
  const seed = JSON.parse(JSON.stringify(DEFAULT_DB)) as DB;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
  } catch { /* ignore */ }
  
  return seed;
}

function saveDB(db: DB) {
  // 3. Prevent running on the server entirely
  if (typeof window === "undefined") return;

  try { 
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); 
  } catch { /* ignore */ }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Badge({ children, variant = "blue" }: { children: React.ReactNode; variant?: "blue" | "green" | "amber" | "red" | "wood" | "gray" }) {
  const styles: Record<string, React.CSSProperties> = {
    blue:  { background: "#E6F1FB", color: "#185FA5" },
    green: { background: "#EAF3DE", color: "#3B6D11" },
    amber: { background: "#FAEEDA", color: "#854F0B" },
    red:   { background: "#FCEBEB", color: "#A32D2D" },
    wood:  { background: "#A0522D", color: "#fff" },
    gray:  { background: "#F1EFE8", color: "#5F5E5A" },
  };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontFamily: "'DM Mono', monospace", padding: "3px 8px", borderRadius: 4, fontWeight: 500, ...styles[variant] }}>
      {children}
    </span>
  );
}

function Btn({ children, onClick, variant = "ghost", sm, full, style }: {
  children: React.ReactNode; onClick?: () => void;
  variant?: "primary" | "ghost" | "danger" | "green"; sm?: boolean; full?: boolean; style?: React.CSSProperties;
}) {
  const base: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 5, fontFamily: "'Syne', sans-serif", fontWeight: 500, cursor: "pointer", borderRadius: 8, border: "0.5px solid rgba(160,82,45,0.18)", transition: "all .15s", width: full ? "100%" : undefined, justifyContent: full ? "center" : undefined, padding: sm ? "4px 9px" : "7px 13px", fontSize: sm ? 12 : 13 };
  const variants: Record<string, React.CSSProperties> = {
    primary: { background: "#A0522D", color: "#fff", borderColor: "#A0522D" },
    ghost:   { background: "none", color: "#5C4A30" },
    danger:  { background: "#FCEBEB", color: "#A32D2D", borderColor: "rgba(163,45,45,.2)" },
    green:   { background: "#EAF3DE", color: "#3B6D11", borderColor: "rgba(59,109,17,.2)" },
  };
  return <button onClick={onClick} style={{ ...base, ...variants[variant], ...style }}>{children}</button>;
}

function Section({ title, icon, action, children }: { title: string; icon: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--color-background-primary,#fff)", border: "0.5px solid rgba(160,82,45,.18)", borderRadius: 12, overflow: "hidden", marginBottom: 14 }}>
      <div style={{ padding: "11px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "0.5px solid rgba(160,82,45,.18)", background: "#202940" }}>
        <span style={{ fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 7 }}>
          <i className={`ti ti-${icon}`} style={{ color: "#fff", fontSize: 17 }} aria-hidden="true" />
          <p style={{ color: "#fff"}}>{title}</p>
        </span>
        {action}
      </div>
      {children}
    </div>
  );
}

function Modal({ open, title, onClose, children, maxWidth = 480 }: { open: boolean; title: string; onClose: () => void; children: React.ReactNode; maxWidth?: number }) {
  if (!open) return null;
  return (
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, minHeight: "100%", background: "rgba(28,18,9,.55)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 100, padding: "24px 14px" }}>
      <div style={{ background: "var(--color-background-primary,#fff)", borderRadius: 12, border: "0.5px solid rgba(160,82,45,.18)", width: "100%", maxWidth, marginTop: 10 }}>
        <div style={{ padding: 14, borderBottom: "0.5px solid rgba(160,82,45,.18)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 style={{ fontSize: 15, fontWeight: 700 }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#9C8A70", fontSize: 20, lineHeight: 1 }}><i className="ti ti-x" aria-hidden="true" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: "#5C4A30", letterSpacing: .3 }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = { padding: "7px 9px", border: "0.5px solid rgba(160,82,45,.3)", borderRadius: 8, fontFamily: "'Syne', sans-serif", fontSize: 13, background: "#FAF3E3", color: "#1C1209", outline: "none", width: "100%" };
const selectStyle: React.CSSProperties = { ...inputStyle };

// ── Receipt text generator ────────────────────────────────────────────────────

function buildReceipt(txn: Transaction): string {
  const lines = txn.items.map(c => {
    const n = c.name.substring(0, 18).padEnd(18);
    return `${n} x${c.qty}  ${fmt(c.unitPrice * c.qty)}`;
  }).join("\n");
  return [
    "                                ",
    "   RuRII WORKSHOP POS       ",
    "   Ruiru, Kiambu County         ",
    "                                ",
    `Receipt : ${txn.receiptNo}`,
    `Date    : ${txn.date}  ${txn.time}`,
    `Customer: ${txn.customerName}`,
    lines,
    "──────────────────────────────",
    `Subtotal :  ${fmt(txn.subtotal)}`,
    `Discount : -${fmt(txn.discount)}`,
    `VAT(${txn.taxRate}%):   ${fmt(txn.vat)}`,
    "══════════════════════════════",
    `TOTAL    :  ${fmt(txn.total)}`,
    "──────────────────────────────",
    `Payment  : ${txn.payMethod.toUpperCase()}`,
    "──────────────────────────────",
    "  Thank you for your business!",
  ].join("\n");
}

// ── POS Tab ───────────────────────────────────────────────────────────────────

function POSTab({ db, setDb, onCheckout }: { db: DB; setDb: (db: DB) => void; onCheckout: (txn: Transaction) => void }) {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [posSearch, setPosSearch] = useState("");
  const [posFilter, setPosFilter] = useState("");
  const [custId, setCustId] = useState("");
  const [discVal, setDiscVal] = useState("");
  const [discType, setDiscType] = useState<DiscountType>("pct");
  const [taxRate, setTaxRate] = useState(16);
  const [payMethod, setPayMethod] = useState<PayMethod>("cash");
  const [tendered, setTendered] = useState("");
  const [toast, setToast] = useState("");

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2500); };

  const filteredItems = db.items.filter(i =>
    (!posSearch || i.name.toLowerCase().includes(posSearch.toLowerCase())) &&
    (!posFilter || i.cat === posFilter)
  );

  const addToCart = (item: Item) => {
    if (item.qty <= 0) return;
    setCart(prev => {
      const ex = prev.find(c => c.itemId === item.id);
      if (ex) {
        if (ex.qty >= item.qty) { showToast("Max stock reached"); return prev; }
        return prev.map(c => c.itemId === item.id ? { ...c, qty: c.qty + 1 } : c);
      }
      return [...prev, { itemId: item.id, name: item.name, qty: 1, unitPrice: item.sell, cost: item.cost }];
    });
  };

  const changeQty = (idx: number, delta: number) => {
    const item = db.items.find(i => i.id === cart[idx].itemId);
    setCart(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], qty: updated[idx].qty + delta };
      if (updated[idx].qty <= 0) { updated.splice(idx, 1); return updated; }
      if (item && updated[idx].qty > item.qty) { updated[idx].qty = item.qty; showToast("Stock limit"); }
      return updated;
    });
  };

  const sub = cart.reduce((a, c) => a + c.unitPrice * c.qty, 0);
  const custDisc = custId ? (db.customers.find(c => c.id === custId)?.disc ?? 0) : 0;
  const dv = parseFloat(discVal) || 0;
  const disc = Math.round(dv > 0 ? (discType === "pct" ? sub * (dv / 100) : dv) : sub * (custDisc / 100));
  const afterDisc = sub - disc;
  const vat = Math.round(afterDisc * (taxRate / 100));
  const total = afterDisc + vat;
  const change = (parseFloat(tendered) || 0) - total;

  const checkout = () => {
    if (!cart.length) { showToast("Cart is empty"); return; }
    if (payMethod === "cash" && (parseFloat(tendered) || 0) < total) { showToast("Amount tendered too low"); return; }
    const profit = cart.reduce((a, c) => a + (c.unitPrice - c.cost) * c.qty, 0) - disc;
    const custName = custId ? (db.customers.find(c => c.id === custId)?.name ?? "Walk-in") : "Walk-in";
    const txn: Transaction = {
      id: uid(), receiptNo: "RCP-" + (db.transactions.length + 1).toString().padStart(4, "0"),
      date: todayStr(), time: new Date().toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" }),
      customerId: custId, customerName: custName, items: cart.map(c => ({ ...c })),
      subtotal: sub, discount: disc, vat, total, profit, payMethod, taxRate,
    };
    const newItems = db.items.map(item => {
      const line = cart.find(c => c.itemId === item.id);
      return line ? { ...item, qty: item.qty - line.qty } : item;
    });
    const newCusts = db.customers.map(c => c.id === custId ? { ...c, spent: c.spent + total, purchases: c.purchases + 1 } : c);
    const newDb = { ...db, items: newItems, customers: newCusts, transactions: [...db.transactions, txn] };
    setDb(newDb);
    onCheckout(txn);
    setCart([]); setCustId(""); setDiscVal(""); setTendered(""); showToast("Sale complete — " + txn.receiptNo);
  };

  const holdOrder = () => {
    if (!cart.length) return;
    const held: HeldOrder = { id: uid(), time: new Date().toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" }), items: [...cart] };
    setDb({ ...db, heldOrders: [...(db.heldOrders || []), held] });
    setCart([]); showToast("Order held");
  };

  const recallOrder = (idx: number) => {
    setCart(db.heldOrders[idx].items);
    setDb({ ...db, heldOrders: db.heldOrders.filter((_, i) => i !== idx) });
    showToast("Order recalled");
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 14, alignItems: "start" }}>
      {/* Product grid */}
      <div>
        <Section title="Products" icon="layout-grid">
          <div style={{ padding: "12px 12px", borderBottom: "0.5px solid rgba(160,82,45,.18)", display: "flex", alignItems: "center", gap: 6, background: "#fff" }}>
            <i className="ti ti-search" style={{ color: "#202940", fontSize: 18 }} aria-hidden="true" />
            <input value={posSearch} onChange={e => setPosSearch(e.target.value)} placeholder="Search products..." style={{ border: "none", background: "none", fontFamily: "'Syne',sans-serif", fontSize: 18, color: "#1C1209", outline: "none", flex: 1 }} />
          </div>
          <div style={{ padding: "6px 10px", borderBottom: "0.5px solid rgba(160,82,45,.18)", display: "flex", gap: 5, flexWrap: "wrap" }}>
            {["", ...CATS].map(c => (
              <button key={c} onClick={() => setPosFilter(c)} style={{ padding: "4px 10px", borderRadius: 20, fontSize: 11, fontFamily: "'DM Mono',monospace", border: "0.5px solid rgba(160,82,45,.18)", cursor: "pointer", background: posFilter === c ? "#202940" : "none", color: posFilter === c ? "#fff" : "#5C4A30" }}>{c || "All"}</button>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 15 }}>
            {filteredItems.length === 0 && <div style={{ gridColumn: "1/-1", textAlign: "center", padding: 24, color: "#9C8A70", fontSize: 13 }}>No items found</div>}
            {filteredItems.map(item => (
              <div key={item.id} onClick={() => addToCart(item)} style={{ border: "0.5px solid rgba(160,82,45,.18)", borderRadius: 8, padding: 10, cursor: item.qty === 0 ? "not-allowed" : "pointer", opacity: item.qty === 0 ? 0.5 : 1, background: "#202940", transition: "all .12s" }}>
                <div style={{ fontSize: 18, fontWeight: 500, lineHeight: 1.3, marginBottom: 4, color: "#fff" }}>{item.name}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", fontFamily: "'DM Mono',monospace" }}>{fmt(item.sell)}</div>
                <div style={{ fontSize: 14, color: item.qty === 0 ? "#ff0000" : "#fff", marginTop: 2 }}>{item.qty === 0 ? "Out of stock" : `${item.qty} ${item.unit} left`}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* Held orders */}
        {(db.heldOrders?.length ?? 0) > 0 && (
          <Section title="Held orders" icon="pause">
            {db.heldOrders.map((h, i) => (
              <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: "0.5px solid rgba(160,82,45,.07)" }}>
                <Badge variant="amber">HELD</Badge>
                <span style={{ flex: 1, fontSize: 13 }}>{h.items.length} item(s) · {h.time}</span>
                <Btn sm variant="green" onClick={() => recallOrder(i)}><i className="ti ti-player-play" aria-hidden="true" />Recall</Btn>
                <Btn sm variant="danger" onClick={() => setDb({ ...db, heldOrders: db.heldOrders.filter((_, j) => j !== i) })}><i className="ti ti-trash" aria-hidden="true" /></Btn>
              </div>
            ))}
          </Section>
        )}
      </div>

      {/* Cart panel */}
      <div style={{ background: "var(--color-background-primary,#fff)", border: "0.5px solid rgba(160,82,45,.18)", borderRadius: 12, overflow: "hidden", position: "sticky", top: 10 }}>
        <div style={{ padding: "11px 14px", background: "#202940", borderBottom: "0.5px solid rgba(160,82,45,.18)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6, color: "#fff" }}><i className="ti ti-shopping-cart" style={{ color: "#fff" }} aria-hidden="true" />Cart {cart.length > 0 && <Badge variant="wood">{cart.reduce((a, c) => a + c.qty, 0)} items</Badge>}</span>
          <div style={{ display: "flex", gap: 5 }}>
            <Btn sm onClick={holdOrder}><i className="ti ti-pause" aria-hidden="true" /></Btn>
            <Btn sm variant="danger" onClick={() => setCart([])}><i className="ti ti-trash" aria-hidden="true" /></Btn>
          </div>
        </div>

        {/* Customer */}
        {/* <div style={{ padding: "8px 12px", borderBottom: "0.5px solid rgba(160,82,45,.18)", display: "flex", alignItems: "center", gap: 8 }}>
          <i className="ti ti-user" style={{ color: "#9C8A70", fontSize: 15 }} aria-hidden="true" />
          <select value={custId} onChange={e => setCustId(e.target.value)} style={{ flex: 1, ...selectStyle, padding: "4px 7px" }}>
            <option value="">Walk-in customer</option>
            {db.customers.map(c => <option key={c.id} value={c.id}>{c.name}{c.disc > 0 ? ` (${c.disc}% disc)` : ""}</option>)}
          </select>
        </div> */}

        {/* Discount + Tax */}
        <div style={{ padding: "7px 12px", borderBottom: "0.5px solid rgba(160,82,45,.18)", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <i className="ti ti-tag" style={{ color: "#9C8A70", fontSize: 15 }} aria-hidden="true" />
          <input type="number" value={discVal} onChange={e => setDiscVal(e.target.value)} placeholder="Disc" min={0} style={{ width: 70, ...inputStyle, padding: "4px 7px" }} />
          <select value={discType} onChange={e => setDiscType(e.target.value as DiscountType)} style={{ ...selectStyle, padding: "4px 6px", width: "auto" }}>
            <option value="pct">% off</option>
            <option value="flat">KES off</option>
          </select>
          <input type="number" value={taxRate} onChange={e => setTaxRate(parseFloat(e.target.value) || 0)} min={0} max={100} style={{ width: 48, ...inputStyle, padding: "4px 7px" }} />
          <span style={{ fontSize: 11, color: "#9C8A70" }}>% VAT</span>
        </div>

        {/* Cart items */}
        <div style={{ minHeight: 120 }}>
          {cart.length === 0
            ? <div style={{ padding: 24, textAlign: "center", color: "#202940 ", fontSize: 13 }}><i className="ti ti-shopping-cart-off" style={{ fontSize: 28, display: "block", marginBottom: 8 }} aria-hidden="true" />Cart is empty</div>
            : cart.map((line, i) => (
              <div key={line.itemId} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderBottom: "0.5px solid rgba(160,82,45,.07)" }}>
                <div style={{ flex: 1, fontSize: 12, fontWeight: 500, lineHeight: 1.3 }}>{line.name}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <button onClick={() => changeQty(i, -1)} style={{ width: 22, height: 22, borderRadius: 4, border: "0.5px solid rgba(160,82,45,.18)", background: "none", cursor: "pointer", fontSize: 14, fontWeight: 700, color: "#5C4A30" }}>−</button>
                  <span style={{ fontSize: 12, fontFamily: "'DM Mono',monospace", minWidth: 18, textAlign: "center" }}>{line.qty}</span>
                  <button onClick={() => changeQty(i, 1)} style={{ width: 22, height: 22, borderRadius: 4, border: "0.5px solid rgba(160,82,45,.18)", background: "none", cursor: "pointer", fontSize: 14, fontWeight: 700, color: "#5C4A30" }}>+</button>
                </div>
                <div style={{ fontSize: 12, fontFamily: "'DM Mono',monospace", color: "#3B6D11", minWidth: 72, textAlign: "right" }}>{fmt(line.unitPrice * line.qty)}</div>
                <button onClick={() => setCart(prev => prev.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: "#9C8A70", fontSize: 15 }}>×</button>
              </div>
            ))
          }
        </div>

        {/* Totals */}
        <div style={{ padding: "10px 14px", background: "#F5ECD7", borderTop: "0.5px solid rgba(160,82,45,.18)" }}>
          {[["Subtotal", fmt(sub)], ["Discount", "− " + fmt(disc)], [`VAT (${taxRate}%)`, fmt(vat)]].map(([l, v]) => (
            <div key={l} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#5C4A30", marginBottom: 5 }}>
              <span>{l}</span><span style={{ fontFamily: "'DM Mono',monospace", color: l === "Discount" ? "#A32D2D" : undefined }}>{v}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 700, borderTop: "0.5px solid rgba(160,82,45,.18)", paddingTop: 7, marginTop: 6 }}>
            <span>TOTAL</span><span style={{ fontFamily: "'DM Mono',monospace" }}>{fmt(total)}</span>
          </div>
        </div>

        {/* Payment */}
        <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 7 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
            {(["cash", "mpesa", "credit"] as PayMethod[]).map(m => (
              <button key={m} onClick={() => setPayMethod(m)} style={{ padding: "9px 4px", border: "0.5px solid rgba(160,82,45,.18)", borderRadius: 8, fontFamily: "'Syne',sans-serif", fontSize: 12, fontWeight: 500, cursor: "pointer", background: payMethod === m ? "#202940" : "none", color: payMethod === m ? "#fff" : "#5C4A30", textAlign: "center" }}>
                <i className={`ti ti-${m === "cash" ? "cash" : m === "mpesa" ? "device-mobile" : "credit-card"}`} aria-hidden="true" /><br />{m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>
          {payMethod === "cash" && (
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "#5C4A30", whiteSpace: "nowrap" }}>Amount:</span>
              <input type="number" value={tendered} onChange={e => setTendered(e.target.value)} placeholder="0" style={{ flex: 1, ...inputStyle, padding: "5px 8px" }} />
            </div>
          )}
          {payMethod === "cash" && change >= 0 && parseFloat(tendered) > 0 && (
            <div style={{ background: "#EAF3DE", border: "0.5px solid rgba(59,109,17,.2)", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#3B6D11", fontFamily: "'DM Mono',monospace" }}>
              Change: {fmt(change)}
            </div>
          )}
          <Btn full variant="primary" onClick={checkout} style={{ fontSize: 16, padding: 11, background: "#202940" }}>
            <i className="ti ti-check" aria-hidden="true" />Charge — {fmt(total)}
          </Btn>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", bottom: 18, right: 18, background: "#A0522D", color: "#fff", padding: "9px 14px", borderRadius: 8, fontSize: 13, display: "flex", alignItems: "center", gap: 7, zIndex: 9999, fontFamily: "'Syne',sans-serif" }}>
          <i className="ti ti-check" aria-hidden="true" />{toast}
        </div>
      )}
    </div>
  );
}

// ── Inventory Tab ─────────────────────────────────────────────────────────────

function InventoryTab({ db, setDb }: { db: DB; setDb: (db: DB) => void }) {
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("");
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", cat: "Lumber" as Category, unit: "pcs", cost: "", sell: "", qty: "", thresh: "5", supplier: "" });

  const filtered = db.items.filter(i => (!search || i.name.toLowerCase().includes(search.toLowerCase())) && (!cat || i.cat === cat));

  const openAdd = () => { setEditId(null); setForm({ name: "", cat: "Lumber", unit: "pcs", cost: "", sell: "", qty: "", thresh: "5", supplier: "" }); setModal(true); };
  const openEdit = (item: Item) => { setEditId(item.id); setForm({ name: item.name, cat: item.cat, unit: item.unit, cost: String(item.cost), sell: String(item.sell), qty: String(item.qty), thresh: String(item.thresh), supplier: item.supplier }); setModal(true); };

  const save = () => {
    if (!form.name.trim()) return;
    const item: Item = { id: editId || uid(), name: form.name, cat: form.cat, unit: form.unit || "pcs", cost: parseFloat(form.cost) || 0, sell: parseFloat(form.sell) || 0, qty: parseInt(form.qty) || 0, thresh: parseInt(form.thresh) || 5, supplier: form.supplier };
    setDb({ ...db, items: editId ? db.items.map(i => i.id === editId ? item : i) : [...db.items, item] });
    setModal(false);
  };

  const restock = (item: Item) => {
    const q = parseInt(prompt(`Restock "${item.name}"\nCurrent: ${item.qty}\nAdd qty:`, "10") || "");
    if (isNaN(q) || q <= 0) return;
    setDb({ ...db, items: db.items.map(i => i.id === item.id ? { ...i, qty: i.qty + q } : i) });
  };

  const del = (id: string) => { if (confirm("Delete item?")) setDb({ ...db, items: db.items.filter(i => i.id !== id) }); };

  const f = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }));

  return (
    <>
      <Section title="Stock" icon="package" action={<Btn sm variant="primary" onClick={openAdd}><i className="ti ti-plus" aria-hidden="true" />Add item</Btn>}>
        <div style={{ padding: "8px 12px", borderBottom: "0.5px solid rgba(160,82,45,.18)", display: "flex", alignItems: "center", gap: 6, background: "#F5ECD7" }}>
          <i className="ti ti-search" style={{ color: "#9C8A70", fontSize: 15 }} aria-hidden="true" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." style={{ border: "none", background: "none", fontFamily: "'Syne',sans-serif", fontSize: 13, color: "#1C1209", outline: "none", flex: 1 }} />
          <select value={cat} onChange={e => setCat(e.target.value)} style={{ border: "none", background: "none", fontSize: 12, color: "#5C4A30", outline: "none", fontFamily: "'DM Mono',monospace", cursor: "pointer" }}>
            <option value="">All</option>
            {CATS.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
            <colgroup><col style={{ width: 170 }} /><col style={{ width: 80 }} /><col style={{ width: 90 }} /><col style={{ width: 90 }} /><col style={{ width: 55 }} /><col style={{ width: 90 }} /><col style={{ width: 110 }} /></colgroup>
            <thead>
              <tr>{["Item", "Cat", "Cost", "Price", "Qty", "Status", "Actions"].map(h => <th key={h} style={{ fontSize: 11, fontFamily: "'DM Mono',monospace", color: "#9C8A70", textTransform: "uppercase", letterSpacing: .5, padding: "9px 13px", textAlign: "left", borderBottom: "0.5px solid rgba(160,82,45,.18)" }}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {filtered.length === 0
                ? <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: "#9C8A70", fontSize: 13 }}>No items</td></tr>
                : filtered.map(item => {
                  const status = item.qty === 0 ? <Badge variant="red">Out</Badge> : item.qty <= item.thresh ? <Badge variant="amber">Low</Badge> : <Badge variant="green">OK</Badge>;
                  return (
                    <tr key={item.id} style={{ borderBottom: "0.5px solid rgba(160,82,45,.07)" }}>
                      <td style={{ padding: "10px 13px", fontSize: 12, fontWeight: 500, lineHeight: 1.4 }}>{item.name}<br /><span style={{ fontSize: 11, color: "#9C8A70", fontWeight: 400 }}>{item.supplier}</span></td>
                      <td style={{ padding: "10px 13px" }}><Badge variant="blue">{item.cat}</Badge></td>
                      <td style={{ padding: "10px 13px", fontSize: 12, fontFamily: "'DM Mono',monospace" }}>{fmt(item.cost)}</td>
                      <td style={{ padding: "10px 13px", fontSize: 12, fontFamily: "'DM Mono',monospace" }}>{fmt(item.sell)}</td>
                      <td style={{ padding: "10px 13px", fontWeight: 500 }}>{item.qty}</td>
                      <td style={{ padding: "10px 13px" }}>{status}</td>
                      <td style={{ padding: "10px 13px" }}>
                        <div style={{ display: "flex", gap: 4 }}>
                          <Btn sm onClick={() => openEdit(item)}><i className="ti ti-edit" aria-hidden="true" /></Btn>
                          <Btn sm onClick={() => restock(item)}><i className="ti ti-package-import" aria-hidden="true" /></Btn>
                          <Btn sm variant="danger" onClick={() => del(item.id)}><i className="ti ti-trash" aria-hidden="true" /></Btn>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </Section>

      <Modal open={modal} title={editId ? "Edit item" : "Add item"} onClose={() => setModal(false)}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, padding: 14 }}>
          <Field label="Item name"><input value={form.name} onChange={e => f("name", e.target.value)} style={{ ...inputStyle, gridColumn: "1/-1" }} /></Field>
          <Field label="Category"><select value={form.cat} onChange={e => f("cat", e.target.value as Category)} style={selectStyle}>{CATS.map(c => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Unit"><input value={form.unit} onChange={e => f("unit", e.target.value)} placeholder="pcs / kg / m" style={inputStyle} /></Field>
          <Field label="Cost price (KES)"><input type="number" value={form.cost} onChange={e => f("cost", e.target.value)} style={inputStyle} /></Field>
          <Field label="Sell price (KES)"><input type="number" value={form.sell} onChange={e => f("sell", e.target.value)} style={inputStyle} /></Field>
          <Field label="Qty in stock"><input type="number" value={form.qty} onChange={e => f("qty", e.target.value)} style={inputStyle} /></Field>
          <Field label="Low stock threshold"><input type="number" value={form.thresh} onChange={e => f("thresh", e.target.value)} style={inputStyle} /></Field>
          <div style={{ gridColumn: "1/-1" }}><Field label="Supplier"><input value={form.supplier} onChange={e => f("supplier", e.target.value)} style={inputStyle} /></Field></div>
        </div>
        <div style={{ padding: "0 14px 14px", display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Btn onClick={() => setModal(false)}>Cancel</Btn>
          <Btn variant="primary" onClick={save}><i className="ti ti-device-floppy" aria-hidden="true" />Save</Btn>
        </div>
      </Modal>
    </>
  );
}

// ── Customers Tab ─────────────────────────────────────────────────────────────

function CustomersTab({ db, setDb }: { db: DB; setDb: (db: DB) => void }) {
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", type: "regular" as CustomerType, disc: "0", note: "" });

  const openAdd = () => { setEditId(null); setForm({ name: "", phone: "", type: "regular", disc: "0", note: "" }); setModal(true); };
  const openEdit = (c: Customer) => { setEditId(c.id); setForm({ name: c.name, phone: c.phone, type: c.type, disc: String(c.disc), note: c.note }); setModal(true); };

  const save = () => {
    if (!form.name.trim()) return;
    const ex = editId ? db.customers.find(c => c.id === editId) : null;
    const cust: Customer = { id: editId || uid(), name: form.name, phone: form.phone, type: form.type, disc: parseFloat(form.disc) || 0, note: form.note, spent: ex?.spent ?? 0, purchases: ex?.purchases ?? 0, balance: ex?.balance ?? 0 };
    setDb({ ...db, customers: editId ? db.customers.map(c => c.id === editId ? cust : c) : [...db.customers, cust] });
    setModal(false);
  };
  const del = (id: string) => { if (confirm("Delete customer?")) setDb({ ...db, customers: db.customers.filter(c => c.id !== id) }); };
  const f = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }));

  const typeBadge: Record<CustomerType, "blue" | "wood" | "green"> = { regular: "blue", trade: "green" };

  return (
    <>
      <Section title="Customers" icon="users" action={<Btn sm variant="primary" onClick={openAdd}><i className="ti ti-plus" aria-hidden="true" />Add customer</Btn>}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>{["Name", "Phone", "Type", "Purchases", "Total spent", "Actions"].map(h => <th key={h} style={{ fontSize: 11, fontFamily: "'DM Mono',monospace", color: "#9C8A70", textTransform: "uppercase", letterSpacing: .5, padding: "9px 13px", textAlign: "left", borderBottom: "0.5px solid rgba(160,82,45,.18)" }}>{h}</th>)}</tr></thead>
          <tbody>
            {db.customers.length === 0
              ? <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: "#9C8A70", fontSize: 13 }}>No customers yet</td></tr>
              : db.customers.map(c => (
                <tr key={c.id} style={{ borderBottom: "0.5px solid rgba(160,82,45,.07)" }}>
                  <td style={{ padding: "10px 13px", fontWeight: 500 }}>{c.name}</td>
                  <td style={{ padding: "10px 13px", fontSize: 12, fontFamily: "'DM Mono',monospace" }}>{c.phone || "—"}</td>
                  <td style={{ padding: "10px 13px" }}><Badge variant={typeBadge[c.type]}>{c.type}</Badge></td>
                  <td style={{ padding: "10px 13px", fontSize: 13 }}>{c.purchases}</td>
                  <td style={{ padding: "10px 13px", fontSize: 12, fontFamily: "'DM Mono',monospace", color: "#3B6D11", fontWeight: 500 }}>{fmt(c.spent)}</td>
                  <td style={{ padding: "10px 13px" }}>
                    <div style={{ display: "flex", gap: 4 }}>
                      <Btn sm onClick={() => openEdit(c)}><i className="ti ti-edit" aria-hidden="true" /></Btn>
                      <Btn sm variant="danger" onClick={() => del(c.id)}><i className="ti ti-trash" aria-hidden="true" /></Btn>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </Section>

      <Modal open={modal} title={editId ? "Edit customer" : "Add customer"} onClose={() => setModal(false)}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, padding: 14 }}>
          <div style={{ gridColumn: "1/-1" }}><Field label="Full name"><input value={form.name} onChange={e => f("name", e.target.value)} style={inputStyle} /></Field></div>
          <Field label="Phone"><input value={form.phone} onChange={e => f("phone", e.target.value)} placeholder="07xx xxx xxx" style={inputStyle} /></Field>
          <Field label="Type"><select value={form.type} onChange={e => f("type", e.target.value as CustomerType)} style={selectStyle}><option value="regular">Regular</option><option value="vip">VIP</option><option value="trade">Trade account</option></select></Field>
          <Field label="Default discount %"><input type="number" value={form.disc} onChange={e => f("disc", e.target.value)} min={0} max={100} style={inputStyle} /></Field>
          <div style={{ gridColumn: "1/-1" }}><Field label="Notes"><input value={form.note} onChange={e => f("note", e.target.value)} placeholder="Address, project notes..." style={inputStyle} /></Field></div>
        </div>
        <div style={{ padding: "0 14px 14px", display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Btn onClick={() => setModal(false)}>Cancel</Btn>
          <Btn variant="primary" onClick={save}><i className="ti ti-device-floppy" aria-hidden="true" />Save</Btn>
        </div>
      </Modal>
    </>
  );
}

// ── History Tab ───────────────────────────────────────────────────────────────

function HistoryTab({ db }: { db: DB }) {
  const [filter, setFilter] = useState("");
  const [receipt, setReceipt] = useState<Transaction | null>(null);

  const txns = [...db.transactions].filter(t => {
    if (filter === "today") return t.date === todayStr();
    if (filter === "week") { const w = new Date(); w.setDate(w.getDate() - 7); return new Date(t.date) >= w; }
    return true;
  }).sort((a, b) => b.id.localeCompare(a.id));

  const pmIcon: Record<PayMethod, string> = { cash: "cash", mpesa: "device-mobile", credit: "credit-card" };

  return (
    <>
      <Section title="Transaction history" icon="receipt" action={
        <select value={filter} onChange={e => setFilter(e.target.value)} style={{ padding: "4px 8px", border: "0.5px solid rgba(160,82,45,.18)", borderRadius: 6, fontSize: 12, background: "#FAF3E3", color: "#1C1209", outline: "none", fontFamily: "'DM Mono',monospace" }}>
          <option value="">All time</option><option value="today">Today</option><option value="week">This week</option>
        </select>
      }>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>{["Receipt #", "Date/Time", "Customer", "Items", "Payment", "Total", "Profit", ""].map(h => <th key={h} style={{ fontSize: 11, fontFamily: "'DM Mono',monospace", color: "#9C8A70", textTransform: "uppercase", letterSpacing: .5, padding: "9px 13px", textAlign: "left", borderBottom: "0.5px solid rgba(160,82,45,.18)" }}>{h}</th>)}</tr></thead>
          <tbody>
            {txns.length === 0
              ? <tr><td colSpan={8} style={{ padding: 24, textAlign: "center", color: "#9C8A70", fontSize: 13 }}>No transactions</td></tr>
              : txns.map(t => (
                <tr key={t.id} style={{ borderBottom: "0.5px solid rgba(160,82,45,.07)" }}>
                  <td style={{ padding: "10px 13px", fontSize: 12, fontFamily: "'DM Mono',monospace" }}>{t.receiptNo}</td>
                  <td style={{ padding: "10px 13px", fontSize: 12, color: "#5C4A30" }}>{t.date} {t.time}</td>
                  <td style={{ padding: "10px 13px", fontSize: 13 }}>{t.customerName}</td>
                  <td style={{ padding: "10px 13px", fontSize: 12 }}>{t.items.length} item(s)</td>
                  <td style={{ padding: "10px 13px" }}><Badge variant="blue"><i className={`ti ti-${pmIcon[t.payMethod]}`} aria-hidden="true" />{t.payMethod}</Badge></td>
                  <td style={{ padding: "10px 13px", fontSize: 12, fontFamily: "'DM Mono',monospace", fontWeight: 500 }}>{fmt(t.total)}</td>
                  <td style={{ padding: "10px 13px", fontSize: 12, fontFamily: "'DM Mono',monospace", color: "#3B6D11", fontWeight: 500 }}>{fmt(t.profit)}</td>
                  <td style={{ padding: "10px 13px" }}><Btn sm onClick={() => setReceipt(t)}><i className="ti ti-receipt" aria-hidden="true" /></Btn></td>
                </tr>
              ))}
          </tbody>
        </table>
      </Section>

      <Modal open={!!receipt} title="Receipt" onClose={() => setReceipt(null)} maxWidth={380}>
        {receipt && (
          <>
            <div style={{ padding: 14 }}>
              <pre style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, lineHeight: 1.7, background: "var(--color-background-primary,#fff)", border: "0.5px solid rgba(160,82,45,.18)", borderRadius: 8, padding: 16, whiteSpace: "pre-wrap" }}>{buildReceipt(receipt)}</pre>
            </div>
            <div style={{ padding: "0 14px 14px", display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Btn onClick={() => window.print()}><i className="ti ti-printer" aria-hidden="true" />Print</Btn>
              <Btn variant="primary" onClick={() => setReceipt(null)}><i className="ti ti-check" aria-hidden="true" />Done</Btn>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}

// ── Reports Tab ───────────────────────────────────────────────────────────────

function ReportsTab({ db, onReset }: { db: DB; onReset: () => void }) {
  const txns = db.transactions;
  const rev = txns.reduce((a, t) => a + t.total, 0);
  const prof = txns.reduce((a, t) => a + t.profit, 0);
  const avg = txns.length ? Math.round(rev / txns.length) : 0;

  const profMap: Record<string, number> = {}, qtyMap: Record<string, number> = {}, revMap: Record<string, number> = {};
  txns.forEach(t => t.items.forEach(c => {
    profMap[c.name] = (profMap[c.name] || 0) + (c.unitPrice - c.cost) * c.qty;
    qtyMap[c.name] = (qtyMap[c.name] || 0) + c.qty;
    revMap[c.name] = (revMap[c.name] || 0) + c.unitPrice * c.qty;
  }));
  const entries = Object.entries(profMap).sort((a, b) => b[1] - a[1]);
  const maxP = entries.length ? Math.max(...entries.map(e => e[1])) : 1;
  const tops = Object.keys(qtyMap).sort((a, b) => qtyMap[b] - qtyMap[a]).slice(0, 5);

  const cards = [["Total revenue", fmt(rev), "#3B6D11"], ["Total profit", fmt(prof), "#3B6D11"], ["Transactions", String(txns.length), "#1C1209"], ["Avg basket", fmt(avg), "#1C1209"]];

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
        {cards.map(([label, val, color]) => (
          <div key={label} style={{ background: "#F5ECD7", borderRadius: 8, padding: 12, border: "0.5px solid rgba(160,82,45,.18)" }}>
            <div style={{ fontSize: 11, fontFamily: "'DM Mono',monospace", color: "#9C8A70", textTransform: "uppercase", letterSpacing: .5, marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color }}>{val}</div>
          </div>
        ))}
      </div>

      <Section title="Profit by item" icon="chart-bar">
        <div style={{ padding: 14 }}>
          {entries.length === 0
            ? <div style={{ textAlign: "center", padding: 24, color: "#9C8A70", fontSize: 13 }}>No sales data yet</div>
            : entries.slice(0, 8).map(([name, profit]) => {
              const pct = Math.max(4, Math.round((profit / maxP) * 100));
              return (
                <div key={name} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 9 }}>
                  <div style={{ fontSize: 12, fontFamily: "'DM Mono',monospace", color: "#5C4A30", width: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flexShrink: 0 }}>{name}</div>
                  <div style={{ flex: 1, height: 20, background: "#F5ECD7", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ width: pct + "%", height: "100%", background: "#4B4038", display: "flex", alignItems: "center", paddingLeft: 7 }}>
                      <span style={{ fontSize: 11, fontFamily: "'DM Mono',monospace", color: "#fff", whiteSpace: "nowrap" }}>{fmt(profit)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      </Section>

      <Section title="Top sellers" icon="trending-up">
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>{["Item", "Units sold", "Revenue", "Profit"].map(h => <th key={h} style={{ fontSize: 11, fontFamily: "'DM Mono',monospace", color: "#9C8A70", textTransform: "uppercase", letterSpacing: .5, padding: "9px 13px", textAlign: "left", borderBottom: "0.5px solid rgba(160,82,45,.18)" }}>{h}</th>)}</tr></thead>
          <tbody>
            {tops.length === 0
              ? <tr><td colSpan={4} style={{ padding: 20, textAlign: "center", color: "#9C8A70", fontSize: 13 }}>No data yet</td></tr>
              : tops.map(n => (
                <tr key={n} style={{ borderBottom: "0.5px solid rgba(160,82,45,.07)" }}>
                  <td style={{ padding: "10px 13px", fontSize: 13 }}>{n}</td>
                  <td style={{ padding: "10px 13px", fontSize: 12, fontFamily: "'DM Mono',monospace" }}>{qtyMap[n]}</td>
                  <td style={{ padding: "10px 13px", fontSize: 12, fontFamily: "'DM Mono',monospace" }}>{fmt(revMap[n])}</td>
                  <td style={{ padding: "10px 13px", fontSize: 12, fontFamily: "'DM Mono',monospace", color: "#3B6D11", fontWeight: 500 }}>{fmt(profMap[n])}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </Section>

      <div style={{ textAlign: "center", padding: "8px 0 0" }}>
        <Btn variant="danger" sm onClick={() => { if (confirm("Reset all data?")) onReset(); }}>
          <i className="ti ti-trash" aria-hidden="true" />Reset all demo data
        </Btn>
      </div>
    </>
  );
}

// ── Root App ──────────────────────────────────────────────────────────────────

export default function WorkshopPOS() {
  const [db, setDbRaw] = useState<DB>(() => loadDB());
  const [tab, setTab] = useState<Tab>("pos");
  const [clock, setClock] = useState("");
  const [receipt, setReceipt] = useState<Transaction | null>(null);
  const [shiftModal, setShiftModal] = useState(false);

  const setDb = useCallback((d: DB) => { setDbRaw(d); saveDB(d); }, []);

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleDateString("en-KE", { weekday: "short", day: "numeric", month: "short" }) + " · " + new Date().toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" }));
    tick(); const id = setInterval(tick, 30000); return () => clearInterval(id);
  }, []);

  const todayTxns = db.transactions.filter(t => t.date === todayStr());
  const todayRev = todayTxns.reduce((a, t) => a + t.total, 0);
  const todayProfit = todayTxns.reduce((a, t) => a + t.profit, 0);
  const lowStock = db.items.filter(i => i.qty <= i.thresh).length;

  const metrics = [
    { label: "Today's sales", value: fmt(todayRev), color: "#3B6D11" },
    { label: "Today's profit", value: fmt(todayProfit), color: "#3B6D11" },
    { label: "Transactions", value: String(todayTxns.length), color: "#1C1209" },
    { label: "Low stock", value: String(lowStock), color: lowStock > 0 ? "#854F0B" : "#3B6D11" },
  ];

  const navTabs: { id: Tab; icon: string; label: string }[] = [
    { id: "pos", icon: "cash-register", label: "POS" },
    { id: "inventory", icon: "package", label: "Inventory" },
    { id: "customers", icon: "users", label: "Customers" },
    { id: "history", icon: "receipt", label: "History" },
    { id: "reports", icon: "chart-bar", label: "Reports" },
  ];

  // Shift summary
  const cashTotal = todayTxns.filter(t => t.payMethod === "cash").reduce((a, t) => a + t.total, 0);
  const mpesaTotal = todayTxns.filter(t => t.payMethod === "mpesa").reduce((a, t) => a + t.total, 0);
  const creditTotal = todayTxns.filter(t => t.payMethod === "credit").reduce((a, t) => a + t.total, 0);

  return (
    <div style={{ position: "relative", maxWidth: "100%", background: "#fff" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Syne:wght@400;500;700&display=swap" rel="stylesheet" />
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css" />
      <div style={{ maxWidth: "90%", margin: "0 auto", padding: "16px 14px 40px", fontFamily: "'Syne', sans-serif", background: "#fff", minHeight: "100vh", color: "#1C1209" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", maxWidth: "80%", justifyContent: "space-between", marginBottom: 18, paddingBottom: 14, borderBottom: "2px solid #A0522D" }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: -.5, display: "flex", alignItems: "center", gap: 8, color: "#4B4038" }}>
              Rurii Workshop POS
            </h1>
            <p style={{ fontSize: 18, color: "#4B4038", marginTop: 2, fontFamily: "'DM Mono', monospace" }}>{clock}</p>
          </div>
        </div>

        {/* Metrics */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 9, marginBottom: 16 }}>
          {metrics.map(m => (
            <div key={m.label} style={{ background: "var(--color-background-primary,#fff)", border: "0.5px solid rgba(160,82,45,.18)", borderRadius: 12, padding: "12px 14px" }}>
              <div style={{ fontSize: 11, fontFamily: "'sans-serif',monospace", color: "#4B4038", textTransform: "uppercase", letterSpacing: .6, marginBottom: 3 }}>{m.label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: m.color }}>{m.value}</div>
            </div>
          ))}
        </div>

        {/* Nav */}
        <div style={{ display: "flex", gap: 4, marginBottom: 18, background: "#4B4038", borderRadius: 8, padding: 4, border: "0.5px solid rgba(160,82,45,.18)" }}>
          {navTabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, padding: "7px 4px", border: "none", background: tab === t.id ? "#CAAA98" : "none", color: tab === t.id ? "#fff" : "#fff", fontFamily: "'Syne',sans-serif", fontSize: 18, fontWeight: 500, borderRadius: 6, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, transition: "all .15s" }}>
              <i className={`ti ti-${t.icon}`} style={{ fontSize: 15 }} aria-hidden="true" />{t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === "pos" && <POSTab db={db} setDb={setDb} onCheckout={txn => setReceipt(txn)} />}
        {tab === "inventory" && <InventoryTab db={db} setDb={setDb} />}
        {tab === "customers" && <CustomersTab db={db} setDb={setDb} />}
        {tab === "history" && <HistoryTab db={db} />}
        {tab === "reports" && <ReportsTab db={db} onReset={() => { const d = JSON.parse(JSON.stringify(DEFAULT_DB)) as DB; setDb(d); }} />}

        {/* Receipt modal */}
        <Modal open={!!receipt} title="Receipt" onClose={() => setReceipt(null)} maxWidth={380}>
          {receipt && (
            <>
              <div style={{ padding: 14 }}>
                <pre style={{ fontFamily: "'DM Mono',monospace", fontSize: 16, lineHeight: 1.7, background: "#fff", border: "0.5px solid rgba(160,82,45,.18)", borderRadius: 8, padding: 16, whiteSpace: "pre-wrap" }}>{buildReceipt(receipt)}</pre>
              </div>
              <div style={{ padding: "0 14px 14px", display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <Btn onClick={() => window.print()}><i className="ti ti-printer" aria-hidden="true" />Print</Btn>
                <Btn variant="primary" onClick={() => setReceipt(null)}><i className="ti ti-check" aria-hidden="true" />Done</Btn>
              </div>
            </>
          )}
        </Modal>

        {/* Shift modal */}
        <Modal open={shiftModal} title="Shift summary" onClose={() => setShiftModal(false)}>
          <div style={{ padding: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
              {[["Shift revenue", fmt(todayRev), "#3B6D11"], ["Shift profit", fmt(todayProfit), "#3B6D11"], ["Transactions", String(todayTxns.length), "#1C1209"], ["Avg basket", fmt(todayTxns.length ? Math.round(todayRev / todayTxns.length) : 0), "#1C1209"]].map(([l, v, c]) => (
                <div key={l as string} style={{ background: "#F5ECD7", borderRadius: 8, padding: 12, border: "0.5px solid rgba(160,82,45,.18)" }}>
                  <div style={{ fontSize: 11, fontFamily: "'DM Mono',monospace", color: "#9C8A70", textTransform: "uppercase", letterSpacing: .5, marginBottom: 4 }}>{l as string}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: c as string }}>{v as string}</div>
                </div>
              ))}
            </div>
            <div style={{ background: "#F5ECD7", borderRadius: 8, padding: 12, border: "0.5px solid rgba(160,82,45,.18)" }}>
              {[["Cash", cashTotal, "ti-cash"], ["M-Pesa", mpesaTotal, "ti-device-mobile"], ["Credit", creditTotal, "ti-credit-card"]].map(([l, v, ic]) => (
                <div key={l as string} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "0.5px solid rgba(160,82,45,.07)" }}>
                  <span style={{ fontSize: 12, color: "#5C4A30", display: "flex", alignItems: "center", gap: 6 }}><i className={`ti ${ic as string}`} aria-hidden="true" />{l as string}</span>
                  <span style={{ fontSize: 13, fontWeight: 500, fontFamily: "'DM Mono',monospace" }}>{fmt(v as number)}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, marginTop: 4, borderTop: "0.5px solid rgba(160,82,45,.18)" }}>
                <span style={{ fontWeight: 700 }}>Total</span>
                <span style={{ fontSize: 14, fontWeight: 700, fontFamily: "'DM Mono',monospace", color: "#3B6D11" }}>{fmt(todayRev)}</span>
              </div>
            </div>
          </div>
          <div style={{ padding: "0 14px 14px", display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Btn onClick={() => setShiftModal(false)}>Close</Btn>
            <Btn variant="primary" onClick={() => window.print()}><i className="ti ti-printer" aria-hidden="true" />Print summary</Btn>
          </div>
        </Modal>

      </div>
    </div>
  );
}