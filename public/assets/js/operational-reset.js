(function (root) {
  'use strict';
  const collections = Object.freeze(['cars', 'costs', 'leads', 'events', 'finds', 'prices', 'runs', 'settlements', 'inspections']);
  const countKeys = Object.freeze([...collections, 'messages', 'mailQueue']);
  const bindings = new WeakMap();
  function confirmedResult(data) {
    if (!data || data.version !== 1 || data.ok !== true || !data.counts || typeof data.counts !== 'object' || Array.isArray(data.counts)) throw new Error('reset_not_confirmed');
    if (Object.keys(data.counts).length !== countKeys.length || Object.keys(data.counts).some(key => !countKeys.includes(key))) throw new Error('reset_not_confirmed');
    const counts = {};
    for (const key of countKeys) {
      const value = data.counts[key];
      if (!Number.isSafeInteger(value) || value < 0) throw new Error('reset_not_confirmed');
      counts[key] = value;
    }
    const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
    if (!Number.isSafeInteger(total) || data.total !== total) throw new Error('reset_not_confirmed');
    return Object.freeze({ version: 1, ok: true, counts: Object.freeze(counts), total });
  }
  function bind({ input, button, status, allowed, rpc, onSuccess, onFailure }) {
    if (!input || !button || !status || typeof allowed !== 'function' || typeof rpc !== 'function') throw new Error('reset_configuration');
    if (bindings.has(button)) return bindings.get(button);
    let busy = false, refreshRequired = false;
    const permitted = () => { try { return allowed() === true; } catch (_) { return false; } };
    function refresh() { button.disabled = busy || refreshRequired || !permitted() || input.value.trim() !== 'RESET'; }
    async function request(event) {
      event?.preventDefault();
      if (busy) return null;
      if (refreshRequired) { status.textContent = 'Reset nije potvrđen. Osveži prikaz pre ponovnog pokušaja.'; refresh(); return null; }
      if (!permitted()) { status.textContent = 'Reset može izvršiti samo aktivni administrator.'; refresh(); return null; }
      if (input.value.trim() !== 'RESET') { status.textContent = 'Za potvrdu upiši RESET.'; refresh(); return null; }
      busy = true;
      const previousLabel = button.textContent, previousInputDisabled = input.disabled;
      button.disabled = true; input.disabled = true; button.textContent = 'Čistim evidenciju…';
      button.setAttribute('aria-busy', 'true');
      status.textContent = 'Reset je u toku. Sačekaj potvrdu.';
      let result;
      try {
        const response = await rpc('sc_reset_operational', { p_confirmation: 'RESET' });
        if (!response || response.error) throw response?.error || new Error('reset_not_confirmed');
        result = confirmedResult(response.data);
      } catch (error) {
        // A lost response can follow a committed transaction. Do not invent a
        // partial count or claim that no deletion happened.
        refreshRequired = true;
        status.textContent = 'Reset nije potvrđen. Osveži prikaz pre ponovnog pokušaja.';
        try { onFailure?.(error); } catch (_) { /* Keep the accurate uncertainty message. */ }
      } finally {
        input.value = ''; input.disabled = previousInputDisabled;
        button.textContent = previousLabel; button.removeAttribute('aria-busy');
        busy = false; refresh();
      }
      if (result) {
        status.textContent = `Obrisano ${result.total} operativnih stavki. Podešavanja i tim su sačuvani.`;
        try { onSuccess?.(result); }
        catch (_) { status.textContent += ' Osveži prikaz.'; }
      }
      return result || null;
    }
    input.addEventListener('input', refresh);
    button.addEventListener('click', request);
    const api = Object.freeze({ request, refresh, get busy() { return busy; } });
    bindings.set(button, api); refresh();
    return api;
  }
  const api = Object.freeze({ collections, countKeys, confirmedResult, bind });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SCOperationalReset = api;
})(typeof window === 'undefined' ? this : window);
