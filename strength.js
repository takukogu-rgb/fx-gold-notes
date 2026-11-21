/* 強弱チャート（金・ドル・円・ユーロ・原油）。strength.html とトップページで共通。
   使い方: <div id="st"></div> <script src="strength.js"></script> <script>StrengthChart(document.getElementById("st"), {rank: true})</script>
   値は strength.json（strength.py が6分ごとに作る）。 */
(function () {
  const CSS = `
.stc{--s-USD:#2a78d6;--s-OIL:#eb6834;--s-EUR:#1baf7a;--s-GOLD:#eda100;--s-JPY:#e87ba4;--st-grid:#ECEEF2;--st-faint:#8A919C}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]) .stc{--s-USD:#3987e5;--s-OIL:#d95926;--s-EUR:#199e70;--s-GOLD:#c98500;--s-JPY:#d55181;--st-grid:#232830;--st-faint:#6F7782}}
:root[data-theme="dark"] .stc{--s-USD:#3987e5;--s-OIL:#d95926;--s-EUR:#199e70;--s-GOLD:#c98500;--s-JPY:#d55181;--st-grid:#232830;--st-faint:#6F7782}
.stc{display:flex;flex-direction:column;gap:12px}
.stc .ctrls{display:flex;gap:14px;flex-wrap:wrap;align-items:center}
.stc .segs{display:flex;border:1px solid var(--line);border-radius:8px;overflow:hidden;background:var(--surface)}
.stc .segs button{border:0;background:none;padding:5px 16px;font:inherit;font-weight:700;font-size:14px;color:var(--ink);cursor:pointer;border-right:1px solid var(--line)}
.stc .segs button:last-child{border-right:0}
.stc .segs button[aria-pressed="true"]{background:var(--gold);color:var(--bg)}
.stc .ctl{display:flex;gap:8px;align-items:center;font-size:14px;color:var(--muted)}
.stc select{font:inherit;background:var(--surface);border:1px solid var(--line);border-radius:6px;padding:3px 8px;color:var(--ink)}
.stc .stamp{font-size:12.5px;color:var(--muted);margin-left:auto}
.stc .box{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:14px 16px}
.stc .sub{font-size:12.5px;color:var(--muted);margin-bottom:4px}
.stc .legend{display:flex;gap:14px;flex-wrap:wrap;font-size:13.5px;margin-bottom:4px}
.stc .legend span{display:inline-flex;align-items:center;gap:6px}
.stc .legend i,.stc .sw{width:16px;height:3px;border-radius:2px;display:inline-block}
.stc .chart{position:relative}
.stc svg{display:block;width:100%;height:auto;overflow:visible}
.stc .num{font-family:var(--f-mono);font-variant-numeric:tabular-nums}
.stc .tip{position:absolute;pointer-events:none;background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:8px 10px;
  font-size:13px;line-height:1.5;box-shadow:0 4px 18px rgba(0,0,0,.12);min-width:150px;display:none;z-index:2}
.stc .tip .h{color:var(--muted);font-size:12px;margin-bottom:2px}
.stc .tip .r{display:grid;grid-template-columns:12px 1fr auto;gap:6px;align-items:center}
.stc .tip i{width:10px;height:3px;border-radius:2px}
.stc table{border-collapse:collapse;width:100%;font-size:14px}
.stc th,.stc td{padding:8px 10px;border-bottom:1px solid var(--line);text-align:left}
.stc th{font-size:12.5px;color:var(--muted);font-weight:500}
.stc td.n,.stc th.n{text-align:right}
.stc .sw{width:12px;margin-right:8px;vertical-align:middle}
.stc .up{color:var(--bull,var(--up))} .stc .dn{color:var(--bear,var(--dn))}
@media (max-width:640px){.stc .stamp{margin-left:0;width:100%}}`;

  const ORDER = ["USD", "OIL", "EUR", "GOLD", "JPY"];
  const fmt = v => (v > 0 ? "+" : v < 0 ? "−" : "±") + Math.abs(v).toFixed(2) + "%";
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const jst = (ms, withDate) => {
    const d = new Date(ms + 9 * 3600e3), p = n => String(n).padStart(2, "0");
    const hm = `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
    return withDate ? `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${hm}` : hm;
  };
  const store = {
    get(k, d) { try { return localStorage.getItem(k) || d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  };

  function xTicks(P) {
    const t0 = P.t[0], t1 = P.t[P.t.length - 1], ticks = [];
    if (P.id === "day") {
      const first = Math.ceil((t0 + 9 * 3600e3) / 3600e3) * 3600e3 - 9 * 3600e3;
      for (let h = 0; h < 48; h++) {
        const ms = first + h * 3600e3;
        if (ms <= t1 && new Date(ms + 9 * 3600e3).getUTCHours() % 3 === 0) ticks.push([ms, jst(ms)]);
      }
    } else {
      const dayMs = 86400e3, step = P.id === "week" ? 1 : 5;
      const d = new Date(t0 + 9 * 3600e3); d.setUTCHours(0, 0, 0, 0);
      let ms = d.getTime() - 9 * 3600e3 + dayMs, n = 0;
      while (ms <= t1) {
        const dd = new Date(ms + 9 * 3600e3);
        const ok = P.id === "year" ? dd.getUTCDate() === 1 : n % step === 0;
        if (ok) ticks.push([ms, P.id === "year" ? `${dd.getUTCMonth() + 1}月` : `${dd.getUTCMonth() + 1}/${dd.getUTCDate()}`]);
        ms += dayMs; n++;
      }
    }
    return ticks;
  }

  window.StrengthChart = function (root, opts) {
    opts = Object.assign({ rank: true, src: "strength.json", refreshMs: 2 * 60e3 }, opts || {});
    if (!document.getElementById("stc-css")) {
      const st = document.createElement("style"); st.id = "stc-css"; st.textContent = CSS; document.head.appendChild(st);
    }
    let DATA = null, period = store.get("st-period", "day"), base = store.get("st-base", "avg");
    const name = id => (DATA.assets.find(a => a.id === id) || {}).name || id;

    root.classList.add("stc");
    root.innerHTML = `
      <div class="ctrls">
        <div class="segs" role="group" aria-label="期間"></div>
        <label class="ctl">基準
          <select>
            <option value="avg">5つの平均</option><option value="GOLD">金</option><option value="USD">ドル</option>
            <option value="JPY">円</option><option value="EUR">ユーロ</option><option value="OIL">原油</option>
          </select></label>
        <span class="stamp">読み込み中…</span>
      </div>
      <div class="box">
        <div class="sub"></div>
        <div class="legend"></div>
        <div class="chart"></div>
      </div>
      ${opts.rank ? `<div class="box"><table><thead><tr><th>順位</th><th>名前</th><th class="n th-s">強さ</th><th class="n">ドル建ての動き</th></tr></thead><tbody></tbody></table></div>` : ""}`;
    const $ = s => root.querySelector(s);
    const sel = $("select");
    sel.addEventListener("change", () => { base = sel.value; store.set("st-base", base); render(); });

    function seriesFor(P) {
      const s = {};
      ORDER.forEach(k => { s[k] = base === "avg" ? P.s[k] : P.s[k].map((v, i) => +(v - P.s[base][i]).toFixed(3)); });
      return s;
    }

    function renderSegs() {
      const el = $(".segs");
      el.innerHTML = DATA.periods.map(p => `<button data-p="${p.id}" aria-pressed="${p.id === period}">${p.label}</button>`).join("");
      el.querySelectorAll("button").forEach(b => b.onclick = () => { period = b.dataset.p; store.set("st-period", period); render(); });
    }

    function render() {
      const P = DATA.periods.find(p => p.id === period) || DATA.periods[0];
      root.querySelectorAll(".segs button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.p === P.id)));
      const S = seriesFor(P), n = P.t.length;
      const baseName = base === "avg" ? "5つの平均" : name(base);
      $(".sub").textContent = `${jst(P.t[0], true)} 〜 ${jst(P.t[n - 1], true)}（日本時間）・基準 ${baseName}。上ほど強い`;
      $(".legend").innerHTML = ORDER.map(k => `<span><i style="background:var(--s-${k})"></i>${esc(name(k))}</span>`).join("");

      const box = $(".chart");
      const W = Math.max(300, box.clientWidth), MH = W < 600 ? 280 : 360;
      const Y10 = P.y10 && P.y10.t.length > 1 ? P.y10 : null, PH = W < 600 ? 90 : 110;
      const H = MH + (Y10 ? PH + 34 : 0);
      const m = { l: 40, r: W < 600 ? 84 : 110, t: 10, b: 26 };
      const iw = W - m.l - m.r, ih = MH - m.t - m.b;
      const hitBot = Y10 ? H - 8 : m.t + ih;
      let lo = 0, hi = 0;
      ORDER.forEach(k => S[k].forEach(v => { if (v < lo) lo = v; if (v > hi) hi = v; }));
      const pad = (hi - lo) * 0.06 || 0.5; lo -= pad; hi += pad;
      const yStep = [0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5, 10, 20, 25, 50].find(s => (hi - lo) / s <= 6) || 100;
      const t0 = P.t[0], t1 = P.t[n - 1];
      const X = ms => m.l + (t1 === t0 ? 0 : (ms - t0) / (t1 - t0) * iw);
      const Y = v => m.t + (hi - v) / (hi - lo) * ih;

      let g = "";
      for (let v = Math.ceil(lo / yStep) * yStep; v <= hi; v += yStep) {
        const y = Y(v).toFixed(1), z = Math.abs(v) < 1e-9;
        g += `<line x1="${m.l}" x2="${m.l + iw}" y1="${y}" y2="${y}" stroke="${z ? "var(--st-faint)" : "var(--st-grid)"}"/>`;
        g += `<text x="${m.l - 8}" y="${+y + 4}" text-anchor="end" font-size="11" fill="var(--muted)" class="num">${z ? "0" : (v > 0 ? "+" : "−") + +Math.abs(v).toFixed(2)}</text>`;
      }
      let lastX = -1e9;
      xTicks(P).filter(([ms]) => { const x = X(ms); if (x - lastX < 46) return false; lastX = x; return true; }).forEach(([ms, lab]) => {
        const x = X(ms).toFixed(1);
        g += `<line x1="${x}" x2="${x}" y1="${m.t}" y2="${m.t + ih}" stroke="var(--st-grid)"/>`;
        g += `<text x="${x}" y="${MH - 6}" text-anchor="middle" font-size="11" fill="var(--muted)">${lab}</text>`;
      });
      ORDER.forEach(k => {
        const d = S[k].map((v, i) => `${i ? "L" : "M"}${X(P.t[i]).toFixed(1)},${Y(v).toFixed(1)}`).join("");
        g += `<path d="${d}" fill="none" stroke="var(--s-${k})" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
      });
      const ends = ORDER.map(k => ({ k, v: S[k][n - 1], y: Y(S[k][n - 1]) })).sort((a, b) => a.y - b.y);
      const gap = 16;
      for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < gap) ends[i].y = ends[i - 1].y + gap;
      const over = ends[ends.length - 1].y - (m.t + ih);
      if (over > 0) ends.forEach(e => e.y -= over);
      for (let i = ends.length - 2; i >= 0; i--) if (ends[i + 1].y - ends[i].y < gap) ends[i].y = ends[i + 1].y - gap;
      ends.forEach(e => {
        const x = m.l + iw;
        g += `<circle cx="${x}" cy="${Y(e.v).toFixed(1)}" r="4" fill="var(--s-${e.k})" stroke="var(--surface)" stroke-width="2"/>`;
        g += `<text x="${x + 10}" y="${(e.y + 4).toFixed(1)}" font-size="12" fill="var(--ink)"><tspan font-weight="700">${esc(name(e.k))}</tspan> <tspan class="num" fill="var(--muted)">${fmt(e.v)}</tspan></text>`;
      });
      // 米10年債利回り（別の目盛りの小さいグラフ。時間の軸は上と同じ）
      let yAt = null;
      if (Y10) {
        const top = MH + 30, bot = H - 8;
        let a = Math.min(...Y10.v), b = Math.max(...Y10.v);
        const pd = (b - a) * 0.12 || 0.02; a -= pd; b += pd;
        const YY = v => top + (b - v) / (b - a) * (bot - top);
        const XX = ms => X(Math.min(Math.max(ms, t0), t1));
        const v0 = Y10.v[0], v1 = Y10.v[Y10.v.length - 1], bp = Math.round((v1 - v0) * 100);
        g += `<text x="${m.l}" y="${top - 10}" font-size="12.5" fill="var(--ink)"><tspan font-weight="700">米10年債利回り</tspan><tspan fill="var(--muted)">　上がると金に逆風</tspan></text>`;
        const st = [0.01, 0.02, 0.05, 0.1, 0.2, 0.25, 0.5, 1].find(s => (b - a) / s <= 3) || 2;
        for (let v = Math.ceil(a / st) * st; v <= b; v += st) {
          const y = YY(v).toFixed(1);
          g += `<line x1="${m.l}" x2="${m.l + iw}" y1="${y}" y2="${y}" stroke="var(--st-grid)"/>`;
          g += `<text x="${m.l - 8}" y="${+y + 4}" text-anchor="end" font-size="11" fill="var(--muted)" class="num">${v.toFixed(2)}</text>`;
        }
        const d = Y10.v.map((v, i) => `${i ? "L" : "M"}${XX(Y10.t[i]).toFixed(1)},${YY(v).toFixed(1)}`).join("");
        g += `<path d="${d}" fill="none" stroke="var(--ink)" stroke-width="1.5" stroke-linejoin="round"/>`;
        const ex = XX(Y10.t[Y10.t.length - 1]);
        g += `<circle cx="${ex}" cy="${YY(v1).toFixed(1)}" r="3.5" fill="var(--ink)" stroke="var(--surface)" stroke-width="2"/>`;
        g += `<text x="${m.l + iw + 10}" y="${(YY(v1) + 4).toFixed(1)}" font-size="12" fill="var(--ink)"><tspan class="num" font-weight="700">${v1.toFixed(2)}%</tspan> <tspan class="num" fill="var(--muted)">${bp > 0 ? "+" : bp < 0 ? "−" : "±"}${Math.abs(bp)}bp</tspan></text>`;
        yAt = ms => { let j = -1; for (let k = 0; k < Y10.t.length && Y10.t[k] <= ms; k++) j = k; return j < 0 ? null : Y10.v[j]; };
      }
      g += `<line class="xh" x1="0" x2="0" y1="${m.t}" y2="${hitBot}" stroke="var(--st-faint)" stroke-dasharray="3 3" visibility="hidden"/><g class="dots"></g>`;
      g += `<rect class="hit" x="${m.l}" y="${m.t}" width="${iw}" height="${hitBot - m.t}" fill="transparent"/>`;
      box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="強さの推移（${P.label}）">${g}</svg><div class="tip"></div>`;

      const svg = box.querySelector("svg"), tip = box.querySelector(".tip"), xh = svg.querySelector(".xh"), dots = svg.querySelector(".dots");
      const move = ev => {
        const r = svg.getBoundingClientRect(), sx = (ev.clientX - r.left) * W / r.width;
        const ms = t0 + (sx - m.l) / iw * (t1 - t0);
        let a = 0, b = n - 1;
        while (b - a > 1) { const mid = (a + b) >> 1; if (P.t[mid] < ms) a = mid; else b = mid; }
        const i = Math.abs(P.t[a] - ms) < Math.abs(P.t[b] - ms) ? a : b, x = X(P.t[i]);
        xh.setAttribute("x1", x); xh.setAttribute("x2", x); xh.setAttribute("visibility", "visible");
        dots.innerHTML = ORDER.map(k => `<circle cx="${x}" cy="${Y(S[k][i])}" r="4" fill="var(--s-${k})" stroke="var(--surface)" stroke-width="2"/>`).join("");
        tip.innerHTML = `<div class="h">${jst(P.t[i], true)}</div>` + ORDER.map(k => [k, S[k][i]]).sort((p, q) => q[1] - p[1]).map(([k, v]) =>
          `<div class="r"><i style="background:var(--s-${k})"></i><span>${esc(name(k))}</span><span class="num">${fmt(v)}</span></div>`).join("")
          + (yAt && yAt(P.t[i]) != null ? `<div class="r" style="margin-top:4px;border-top:1px solid var(--line);padding-top:4px"><i style="background:var(--ink)"></i><span>米10年</span><span class="num">${yAt(P.t[i]).toFixed(3)}%</span></div>` : "");
        tip.style.display = "block";
        const px = x * r.width / W, tw = tip.offsetWidth;
        tip.style.left = (px + 14 + tw > r.width ? px - tw - 14 : px + 14) + "px";
        tip.style.top = "12px";
      };
      const leave = () => { tip.style.display = "none"; xh.setAttribute("visibility", "hidden"); dots.innerHTML = ""; };
      const hit = svg.querySelector(".hit");
      hit.addEventListener("pointermove", move);
      hit.addEventListener("pointerdown", move);
      hit.addEventListener("pointerleave", leave);

      if (opts.rank) {
        $(".th-s").textContent = base === "avg" ? "強さ（平均との差）" : `強さ（${name(base)}との差）`;
        const rows = ORDER.map(k => [k, S[k][n - 1], P.raw[k]]).sort((a, b) => b[1] - a[1]);
        $("tbody").innerHTML = rows.map(([k, v, raw], i) =>
          `<tr><td class="num">${i + 1}</td><td><span class="sw" style="background:var(--s-${k})"></span>${esc(name(k))}</td>
           <td class="n num ${v > 0 ? "up" : v < 0 ? "dn" : ""}">${fmt(v)}</td>
           <td class="n num" style="color:var(--muted)">${k === "USD" ? "—" : fmt(raw)}</td></tr>`).join("");
      }
    }

    async function load() {
      try {
        const r = await fetch(opts.src + "?t=" + Date.now(), { cache: "no-store" });
        DATA = await r.json();
        if (!DATA.periods.find(p => p.id === period)) period = DATA.periods[0].id;
        sel.value = base;
        $(".stamp").textContent = `最後の値 ${jst(DATA.last, true)}・更新 ${jst(Date.parse(DATA.updatedAt), true)}（日本時間）`;
        renderSegs(); render();
      } catch (e) {
        $(".stamp").textContent = "強弱のデータを読み込めませんでした";
      }
    }
    load();
    setInterval(load, opts.refreshMs);
    let rt; addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => DATA && render(), 150); });
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => DATA && render());
  };
})();
