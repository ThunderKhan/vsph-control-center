/* Executive demo dashboard. No network calls, no credentials and no financial-data claims.
   Activation is called only AFTER /api/auth/me confirms platform super_admin. */
(() => {
  'use strict';
  const samples = Object.freeze({
    '6M': {labels:['May','Jun','Jul','Aug','Sep','Oct'],values:[240000,315000,362000,418000,486000,524000]},
    '3M': {labels:['Aug','Sep','Oct'],values:[418000,486000,524000]},
    '1M': {labels:['W1','W2','W3','W4'],values:[110000,124000,132000,158000]}
  });
  function byId(id) { return document.getElementById(id); }
  function formatMoney(amount) {
    return '₹' + new Intl.NumberFormat('en-IN',{maximumFractionDigits:0}).format(amount);
  }
  function renderChart(range) {
    const chart = byId('executiveRevenueChart');
    const label = byId('executiveChartLabels');
    const summary = byId('executiveChartSummary');
    if (!chart || !label || !summary) return;
    const data = samples[range] || samples['6M'];
    const width = 640, height = 238, pad = 19;
    const top = Math.max(...data.values) * 1.22;
    const points = data.values.map((value,index) => {
      const x = pad + index * (width - 2 * pad) / (data.values.length - 1);
      const y = height - pad - value / top * (height - 2 * pad);
      return [Number(x.toFixed(1)), Number(y.toFixed(1))];
    });
    const line = points.map((point,index) => (index ? 'L ' : 'M ') + point.join(' ')).join(' ');
    const area = line + ' L ' + points[points.length-1][0] + ' ' + (height-pad) +
      ' L ' + points[0][0] + ' ' + (height-pad) + ' Z';
    const grid = [0.25,0.5,0.75].map(f => {
      const y = (height * f).toFixed(1);
      return '<path d="M '+pad+' '+y+' H '+(width-pad)+'" stroke="#373d32" stroke-dasharray="2 7" fill="none"/>';
    }).join('');
    const dots = points.map((p,index) => '<circle cx="'+p[0]+'" cy="'+p[1]+
      '" r="'+(index===points.length-1?6:3.5)+'" fill="#b4f34b" stroke="#191b1a" stroke-width="2"/>').join('');
    chart.innerHTML = '<defs><linearGradient id="execRevenueFill" x1="0" y1="0" x2="0" y2="1">'+
      '<stop offset="0" stop-color="#b4f34b" stop-opacity=".33"/>'+
      '<stop offset="1" stop-color="#b4f34b" stop-opacity="0"/></linearGradient></defs>'+
      grid+'<path d="'+area+'" fill="url(#execRevenueFill)"/>'+
      '<path d="'+line+'" fill="none" stroke="#b4f34b" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>'+dots;
    chart.setAttribute('role','img');
    chart.setAttribute('aria-label','Illustrative revenue trend for '+range+': '+data.labels.map((x,i)=>x+' '+formatMoney(data.values[i])).join(', '));
    label.replaceChildren();
    for (const month of data.labels) {
      const element=document.createElement('span');
      element.textContent=month;
      label.append(element);
    }
    summary.textContent = range === '1M' ? 'October weekly revenue · sample' : 'Monthly revenue · sample';
    for (const button of document.querySelectorAll('[data-exec-range]')) {
      button.setAttribute('aria-pressed',String(button.getAttribute('data-exec-range')===range));
    }
  }
  function activate() {
    if (!/^\/dashboard\/?$/.test(window.location.pathname)) return false;
    const section=byId('executiveDashboard');
    if (!section) return false;
    const date=byId('executiveDate');
    if (date) date.textContent=new Intl.DateTimeFormat('en-IN',{day:'numeric',month:'short',year:'numeric'}).format(new Date());
    const timeOfDay = new Date().getHours();
    const greeting=byId('executiveGreeting');
    if(greeting) greeting.textContent=timeOfDay<12?'Good morning,':timeOfDay<17?'Good afternoon,':'Good evening,';
    for (const button of document.querySelectorAll('[data-exec-range]')) {
      button.addEventListener('click',()=>renderChart(button.getAttribute('data-exec-range')));
    }
    renderChart('6M');
    section.hidden=false;
    document.documentElement.dataset.executive='true';
    document.title='Executive overview (demo) | VSPH Control Center';
    return true;
  }
  window.VSPHExecutiveDashboard=Object.freeze({activate});
})();
