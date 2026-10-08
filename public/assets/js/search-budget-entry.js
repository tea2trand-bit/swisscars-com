/* Shared search form: one full-width field for a manually entered budget. */
(() => {
  'use strict';
  Object.assign(window.EV_DICT || {}, {
    'Iznos za ulaganje': ['Investitionsbetrag', 'Investment amount'],
    'Cilj zarade po autu': ['Gewinnziel pro Auto', 'Profit target per car'],
    'Model pretrage': ['Suchmodus', 'Search mode'],
    'Najtraženiji': ['Am beliebtesten', 'Most in demand'],
    'Najmanja kilometraža': ['Niedrigste Laufleistung', 'Lowest mileage'],
    'Najnovije godište': ['Neuestes Baujahr', 'Newest year'],
    'Najmanje km': ['Wenigste km', 'Lowest km'],
    'Najnovije god.': ['Neuestes Bj.', 'Newest year'],
    'SWISCARS analiza': ['SWISCARS Analyse', 'SWISCARS analysis'],
    'Analiza ulaganja': ['Investitionsanalyse', 'Investment analysis'],
    'Analiziraj model': ['Modell analysieren', 'Analyze model']
  });
  const input = document.querySelector('input[name="searchBudgetAmount"]');
  const control = input?.closest('.company-search-number-control');
  if (!input) return;
  input.placeholder = '10.000';
  control?.classList.add('budget-manual-entry');
  control?.querySelectorAll('[data-number-step]').forEach(button => {
    button.hidden = true;
  });
  if (control) {
    const currency = document.createElement('span');
    currency.className = 'budget-entry-currency';
    currency.textContent = '€';
    currency.setAttribute('aria-hidden', 'true');
    control.append(currency);
  }
  window.EV?.apply();
})();
