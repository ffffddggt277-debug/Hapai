// виртуальное время для покадровой записи
(() => {
  const nperf = performance.now.bind(performance), nDate = Date.now;
  let vt = 0, base = 0, rafQ = [], timers = new Map(), tid = 1e6, on = false;
  window.__VT = {
    install() { if (on) return; on = true; base = nperf(); vt = base; const d0 = nDate();
      performance.now = () => vt; Date.now = () => d0 + (vt - base);
      window.requestAnimationFrame = cb => { rafQ.push(cb); return rafQ.length; }; window.cancelAnimationFrame = () => {};
      window.setTimeout = (f, ms = 0, ...a) => { const id = ++tid; timers.set(id, { f, at: vt + (+ms || 0), a }); return id; };
      window.setInterval = (f, ms = 0, ...a) => { const id = ++tid; timers.set(id, { f, at: vt + (+ms || 0), ms: Math.max(1, +ms || 1), a }); return id; };
      window.clearTimeout = window.clearInterval = id => timers.delete(id);
    },
    step(ms) {
      const end = vt + ms;
      for (;;) { let nx = null; for (const [id, t] of timers) if (t.at <= end && (!nx || t.at < nx[1].at)) nx = [id, t]; if (!nx) break; const [id, t] = nx; vt = Math.max(vt, t.at); if (t.ms) t.at += t.ms; else timers.delete(id); try { typeof t.f === 'function' && t.f(...t.a); } catch (e) { console.error(e); } }
      vt = end; const q = rafQ; rafQ = []; for (const cb of q) { try { cb(vt); } catch (e) { console.error(e); } }
      for (const a of document.getAnimations()) { if (a.__vt0 === undefined) { a.__vt0 = vt; a.pause(); } try { a.currentTime = vt - a.__vt0; } catch {} }
    },
    now: () => vt,
  };
})();
