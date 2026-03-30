// ============================================================
// INTERN TEST — QUESTION 1  (~22-28 min)
// Domain: Shopping Cart
//
// TASK A — Bug Hunt
//   Find and fix ALL bugs in this file.
//   For every bug write a short comment above the fix:
//     // BUG: <what was wrong>
//     // FIX: <what you changed and why>
//
// TASK B — Refactor
//   After fixing, refactor into clean, well-structured React.
//   Split into sensible components, remove duplication, clean naming.
//   You may NOT change visible behaviour or features.
//
// Hint: there are exactly 11 bugs. Some are silent — the UI won't
// crash, but the behaviour will be wrong. Think carefully.
// ============================================================

import React, { useState, useEffect, useRef, useCallback } from "react";

const SHIPPING_THRESHOLD = 50;
const SHIPPING_COST = 5.99;
const TAX_RATE = 0.08;

const PRODUCTS = [
  { id: 1, name: "Mechanical Keyboard", price: 129.99, stock: 3 },
  { id: 2, name: "USB-C Hub",           price:  49.99, stock: 2 },
  { id: 3, name: "Webcam HD",           price:  89.99, stock: 0 },
  { id: 4, name: "Monitor Stand",       price:  39.99, stock: 8 },
  { id: 5, name: "Desk Mat XL",         price:  24.99, stock: 5 },
];

const PROMO_CODES = { SAVE10: 10, HALF: 50, VIP20: 20 };

function formatPrice(n) {
  return "$" + n.toFixed(2);
}

export default function ShoppingCart() {
  const [cart, setCart]                 = useState([]);
  const [promoCode, setPromoCode]       = useState("");
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [notification, setNotification] = useState(null);
  const [orderStatus, setOrderStatus]   = useState("idle");
  const [savedCarts, setSavedCarts]     = useState([]);

  const notifTimerRef = useRef(null);

  // --- Notification ---------------------------------------------------
  const showNotification = (msg) => {
    // BUG 1: Missing clearTimeout before setting a new timer.
    // Rapid successive calls stack timers; the first one fires and wipes
    // a notification that belongs to the second call.
    // FIX: Clear any existing timer before scheduling a new one so only
    // the latest notification's timer is active at any given time.
    clearTimeout(notifTimerRef.current);
    notifTimerRef.current = setTimeout(() => setNotification(null), 2500);
    setNotification(msg);
  };

  useEffect(() => {
    return () => clearTimeout(notifTimerRef.current);
  }, []);

  // --- Add to cart ----------------------------------------------------
  const addToCart = (product) => {
    if (product.stock === 0) return;

    setCart((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (existing) {
        // BUG 2: Direct mutation of an object that lives inside React state.
        // React state must be treated as immutable. Mutating then spreading
        // fools React's shallow-equal bail-out — memoised children won't re-render.
        // FIX: Use map() to return a new array with a new item object instead
        // of mutating the existing reference.
        return prev.map((i) => i.id === product.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { ...product, qty: 1 }];
    });

    showNotification(`${product.name} added!`);
  };

  // --- Update quantity -------------------------------------------------
  const updateQty = (id, qty) => {
    if (qty < 1) { removeFromCart(id); return; }

    setCart((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        // BUG 3: Checks qty > item.qty (current cart amount) instead of
        // qty > item.stock. You can set qty to 999 without triggering the warning.
        // FIX: Compare the requested qty against item.stock (the actual inventory
        // limit) so the guard fires correctly.
        if (qty > item.stock) {
          showNotification("Not enough stock!");
          return item;
        }
        return { ...item, qty };
      })
    );
  };

  const removeFromCart = (id) =>
    setCart((prev) => prev.filter((i) => i.id !== id));

  // --- Promo codes ----------------------------------------------------
  const applyPromo = () => {
    // BUG 4: Case-sensitive lookup. "save10" or "Save10" silently fail.
    // FIX: Normalise the input to uppercase before the lookup so codes
    // are accepted regardless of the capitalisation the user types.
    const pct = PROMO_CODES[promoCode.toUpperCase()];
    if (pct !== undefined) {
      setAppliedPromo({ code: promoCode, pct });
      showNotification(`${pct}% discount applied!`);
    } else {
      showNotification("Invalid promo code");
    }
  };

  // --- Totals ---------------------------------------------------------
  const calcTotals = () => {
    const subtotal  = cart.reduce((s, i) => s + i.price * i.qty, 0);
    // BUG 5: discount is a percentage number (e.g. 10) but is subtracted
    // as if it were a dollar amount. $129.99 cart with SAVE10 becomes $119.99
    // instead of $116.99.
    // FIX: Convert the percentage to a fractional dollar amount by multiplying
    // subtotal by (pct / 100) before subtracting.
    const discount  = appliedPromo ? subtotal * (appliedPromo.pct / 100) : 0;
    const afterDisc = subtotal - discount;
    const shipping  = afterDisc >= SHIPPING_THRESHOLD ? 0 : SHIPPING_COST;
    const tax       = afterDisc * TAX_RATE;
    return { subtotal, discount, afterDisc, shipping, tax, total: afterDisc + shipping + tax };
  };

  // --- Save / restore cart --------------------------------------------
  // BUG 6 (stale closure): useCallback with [] deps captures `cart` at
  // mount time (empty []). Every saved snapshot will contain 0 items.
  // FIX: Add `cart` to the dependency array so the callback always closes
  // over the current cart value when it is called.
  const saveCartSnapshot = useCallback(() => {
    if (cart.length === 0) return;
    setSavedCarts((prev) => [...prev, { id: Date.now(), items: [...cart] }]);
    showNotification("Cart saved!");
  }, [cart]);

  const restoreCart = (snapshot) => {
    // BUG 7: Restores by reference — the saved snapshot shares object
    // references with the live cart. Mutating cart items later (BUG 2
    // style) will corrupt the saved snapshot too.
    // FIX: Shallow-copy each item so the live cart and the snapshot hold
    // independent objects that cannot alias each other.
    setCart(snapshot.items.map((i) => ({ ...i })));
    showNotification("Cart restored!");
  };

  // --- Place order ----------------------------------------------------
  const placeOrder = () => {
    if (cart.length === 0) return;
    // BUG 8: No guard against double-submit. Clicking twice while
    // orderStatus === "placing" triggers two timeouts and two state resets.
    // FIX: Return early if an order is already in flight so subsequent
    // clicks are ignored until the first one completes.
    if (orderStatus === "placing") return;
    setOrderStatus("placing");
    setTimeout(() => {
      setCart([]);
      setAppliedPromo(null);
      setOrderStatus("done");
    }, 1200);
  };

  // --- Auto-remove out-of-stock (runs every 5 s) ----------------------
  useEffect(() => {
    const id = setInterval(() => {
      // BUG 9 (stale closure in interval): `cart` is captured at effect
      // creation time and is always []. The filter never runs against the
      // live cart. Fix: use the functional updater setCart(prev => ...).
      // FIX: Pass a function to setCart so it always receives the current
      // cart state rather than the stale closure value.
      setCart((prev) => prev.filter((i) => i.stock > 0));
    }, 5000);
    return () => clearInterval(id);
  }, []);

  // --- Render ---------------------------------------------------------
  const totals = calcTotals();

  if (orderStatus === "done") {
    return (
      <div style={styles.centered}>
        <h2>✅ Order placed!</h2>
        {/* BUG 10: Calls placeOrder() instead of resetting to "idle".
            Clicking "Continue Shopping" triggers another order flow.
            FIX: Reset orderStatus back to "idle" so the main cart UI
            is shown again without triggering another order submission. */}
        <button style={styles.btn} onClick={() => setOrderStatus("idle")}>
          Continue Shopping
        </button>
      </div>
    );
  }

  return (
    <div style={styles.shell}>

      {/* Product list */}
      <section style={styles.products}>
        <h2>Products</h2>
        {PRODUCTS.map((p) => (
          <div key={p.id} style={{ ...styles.card, opacity: p.stock === 0 ? 0.45 : 1 }}>
            <div>
              <strong>{p.name}</strong>
              <div style={styles.meta}>
                {formatPrice(p.price)} · {p.stock === 0 ? "Out of stock" : `${p.stock} left`}
              </div>
            </div>
            <button onClick={() => addToCart(p)} disabled={p.stock === 0} style={styles.btn}>
              Add
            </button>
          </div>
        ))}

        {savedCarts.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <h3>Saved Carts</h3>
            {savedCarts.map((snap) => (
              <div key={snap.id} style={styles.card}>
                <span>{snap.items.length} item(s) · {new Date(snap.id).toLocaleTimeString()}</span>
                <button style={styles.btn} onClick={() => restoreCart(snap)}>Restore</button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Cart panel */}
      <aside style={styles.cartPanel}>
        <h2>Cart {cart.length > 0 && `(${cart.length})`}</h2>

        {notification && <div style={styles.notif}>{notification}</div>}

        {cart.length === 0 ? (
          <p style={{ color: "#9ca3af" }}>Your cart is empty.</p>
        ) : (
          <>
            {cart.map((item) => (
              <div key={item.id} style={styles.cartRow}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{item.name}</div>
                  <div style={styles.meta}>{formatPrice(item.price)} each</div>
                </div>
                <input
                  type="number" min={0} value={item.qty}
                  style={styles.qtyInput}
                  onChange={(e) => updateQty(item.id, parseInt(e.target.value, 10))}
                />
                <button onClick={() => removeFromCart(item.id)}>✕</button>
              </div>
            ))}

            {/* Promo */}
            <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
              <input
                placeholder="Promo code" value={promoCode}
                onChange={(e) => setPromoCode(e.target.value)}
                style={{ flex: 1, padding: "6px 10px" }}
              />
              <button style={styles.btn} onClick={applyPromo}>Apply</button>
            </div>

            {/* Totals */}
            <div style={styles.totals}>
              {[
                ["Subtotal",  formatPrice(totals.subtotal)],
                ["Discount",  appliedPromo ? `-${appliedPromo.pct}%` : "—"],
                ["Shipping",  totals.shipping === 0 ? "FREE" : formatPrice(totals.shipping)],
                ["Tax (8%)",  formatPrice(totals.tax)],
              ].map(([label, val]) => (
                // BUG 11: Missing `key` prop on list items. React will log a
                // warning and may reuse wrong DOM nodes when the list changes.
                // FIX: Add key={label} — labels are unique strings in this list
                // so they make a stable, meaningful key.
                <div key={label} style={styles.totalRow}>
                  <span>{label}</span><span>{val}</span>
                </div>
              ))}
              <div style={{ ...styles.totalRow, fontWeight: 700, fontSize: 18 }}>
                <span>Total</span><span>{formatPrice(totals.total)}</span>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button style={{ ...styles.btn, flex: 1 }} onClick={saveCartSnapshot}>
                Save Cart
              </button>
              <button
                style={{ ...styles.btn, flex: 2, background: "#111", color: "#fff" }}
                onClick={placeOrder}
                disabled={orderStatus === "placing"}
              >
                {orderStatus === "placing" ? "Placing…" : "Place Order"}
              </button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

const styles = {
  shell:     { display: "flex", gap: 32, padding: 32, fontFamily: "system-ui, sans-serif", maxWidth: 900, margin: "0 auto" },
  products:  { flex: 1 },
  cartPanel: { width: 340, flexShrink: 0 },
  card:      { display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid #e5e7eb", borderRadius: 8, padding: 14, marginBottom: 10 },
  cartRow:   { display: "flex", alignItems: "center", gap: 8, marginBottom: 10, padding: 10, border: "1px solid #eee", borderRadius: 6 },
  btn:       { padding: "7px 14px", background: "#f3f4f6", border: "1px solid #d1d5db", borderRadius: 6, cursor: "pointer" },
  meta:      { fontSize: 13, color: "#6b7280", marginTop: 2 },
  notif:     { background: "#d1fae5", color: "#065f46", padding: "8px 12px", borderRadius: 6, marginBottom: 12, fontSize: 14 },
  qtyInput:  { width: 52, padding: "4px 6px", textAlign: "center" },
  totals:    { marginTop: 16, borderTop: "1px solid #e5e7eb", paddingTop: 12 },
  totalRow:  { display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 14 },
  centered:  { textAlign: "center", padding: 60, fontFamily: "system-ui, sans-serif" },
};