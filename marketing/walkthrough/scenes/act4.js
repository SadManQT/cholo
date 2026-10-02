actCard('card4', '04', 'Operations', 'The চলো admin centre', { label: '04 · Operations' });
const O4 = '04 · Operations';
function lpScene(id, clip, rate, num, eyebrow, title, caps, url = 'cholo-cholo7.vercel.app/admin', dur) {
  scene({ id, dur: dur ?? (() => Math.min(7.5, clipDur(clip, rate) + 0.6)), act: 4, label: O4,
    html: `${laptop('lp', { x: 362, y: 128, scale: 0.92, url })}<div class="abs" id="hd" style="left:366px;top:62px;display:flex;align-items:baseline;gap:22px"><span class="eyebrow"><span class="n">${num}</span>${eyebrow}</span><span style="font-size:34px;font-weight:800;letter-spacing:-1px">${title}</span></div>`,
    play: [{ el: 'lp', clip, start: 0.3, rate }], caps,
    update(lt, d, r) { const k = P(lt, 0, 0.9, E.out5); const el = $('#lp', r); el.style.transform = `translate(0,${(1 - k) * 200}px) scale(${0.91 + P(lt, 0, d, E.lin) * 0.015})`; el.style.opacity = clamp(k * 2); S($('#hd', r), { op: P(lt, 0.4, 0.9), x: (1 - P(lt, 0.4, 0.9)) * -20 }); } });
}
function lpSplit(id, a, b, num, eyebrow, title, caps, ra = 1.6, rb = 1.6, dur = 6.5) {
  scene({ id, dur, act: 4, label: O4,
    html: `${laptop('la', { x: 120, y: 260, scale: 0.65, url: 'cholo-cholo7.vercel.app/admin' })}${laptop('lb', { x: 990, y: 260, scale: 0.65, url: 'cholo-cholo7.vercel.app/admin' })}
      <div class="abs" id="hd" style="left:120px;top:110px"><span class="eyebrow"><span class="n">${num}</span>${eyebrow}</span><div style="font-size:56px;font-weight:900;letter-spacing:-2px;margin-top:12px">${title}</div></div>`,
    play: [{ el: 'la', clip: a, start: 0.3, rate: ra }, { el: 'lb', clip: b, start: 0.6, rate: rb }], caps,
    update(lt, d, r) { ['#la', '#lb'].forEach((s, i) => { const k = P(lt, 0.1 + i * 0.15, 1.0 + i * 0.15, E.out5); const el = $(s, r); el.style.transform = `translate(0,${(1 - k) * 220}px) scale(0.65)`; el.style.opacity = clamp(k * 2); }); S($('#hd', r), { op: P(lt, 0.3, 0.8) }); } });
}
lpScene('a-dash', 'a-dash', 2.3, '01', 'Dashboard', 'Live operations', [[0.4, 10.6, 'The operations dashboard: today’s trips, drivers, revenue and live SOS — per city or all.']]);
lpScene('a-analytics', 'a-analytics', 2.6, '02', 'Analytics', 'Ten reports', [[0.4, 7.9, 'Monthly revenue, where the money goes, busiest hours, best days, top drivers and riders.']]);
lpScene('a-comm', 'a-comm', 2.5, '03', 'Commissions', 'Any day, any city', [[0.4, 8.8, 'The commissions report: search any date range or city for rides, ride cost and commission earned.']]);
lpScene('a-drivers', 'a-drivers', 1.8, '04', 'Approvals', 'Verify every driver', [[0.4, 8.2, 'Review each licence, NID and photo — then approve the driver or vehicle in one click.']]);
lpScene('a-zones', 'a-zones', 2.4, '05', 'Zones', 'Draw the map', [[0.4, 3.9, 'Zones for every city: regular areas, airports, stations and restricted no-go areas.'], [4.0, 7.4, 'Draw a new zone right on the map — it’s live the moment you save.']]);
lpScene('a-payouts', 'a-payouts', 1.8, '06', 'Withdrawals', 'Payouts, reviewed', [[0.4, 8.3, 'Driver withdrawals wait for finance: approve to send, or reject with a reason.']]);
lpSplit('a-price', 'a-pricing', 'a-surge', '07', 'Pricing & surge', 'Every fare under control.', [[0.4, 7.7, 'Effective-dated rate cards for every city and vehicle, and surge you can start or end per zone.']]);
lpSplit('a-safety', 'a-sos', 'a-disputes', '08', 'Trust & safety', 'Nothing slips through.', [[0.4, 7.7, 'The SOS board shows live alerts on a map. Disputes and refunds are handled in one queue.']]);
lpSplit('a-gov', 'a-support', 'a-audit', '09', 'Support & audit', 'A complete audit trail.', [[0.4, 7.7, 'Support tickets for every rider and driver — and an audit log no one can edit or delete.']]);
