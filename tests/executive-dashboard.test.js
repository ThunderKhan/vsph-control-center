const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('executive bento is explicitly demo-only, separated from regular users and apps', () => {
  const html = read('public/dashboard.html');
  const js = read('public/executive-dashboard.js');
  const controller = read('public/dashboard.js');
  const css = read('public/executive-dashboard.css');
  assert.match(html, /id="executiveDashboard"[^>]*hidden/);
  assert.match(html, /Illustrative data only\./);
  assert.match(html, /fictional placeholders, not VSPH clients/);
  assert.match(html, /id="executiveRevenueChart"/);
  assert.match(html, /href="\/projects"/);
  assert.match(html, /src="\/executive-dashboard\.js"/);
  assert.match(html, /href="\/executive-dashboard\.css"/);
  assert.match(controller, /isPlatformAdmin && !isApplicationsView/);
  assert.match(controller, /get\('preview'\) === 'executive' && window\.VSPHExecutiveDashboard/);
  assert.match(controller, /window\.VSPHOwnerOverview\?\.activate/);
  assert.match(js, /\/api\/auth\/me confirms platform super_admin/);
  assert.doesNotMatch(js, /\bfetch\s*\(|Math\.random|setInterval/);
  assert.match(css, /html\[data-executive="true"\] \[data-view="overview"\]/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  const brand = read('DESIGN.md');
  assert.match(brand, /brand-navy.*#00255A/);
  assert.match(brand, /brand-core-blue.*#0069C8/);
  assert.match(brand, /brand-light-blue.*#50C0E8/);
  for (const hex of ['#00255A','#0069C8','#50C0E8','#F1F2F2']) {
    assert.ok(css.includes(hex), 'executive stylesheet uses approved brand color ' + hex);
  }
  assert.doesNotMatch(css + js + html, /#(?:b4f34b|a9f14b|a68ada|0c0d0d|111312)\b/i);
  assert.match(css, /\.exec-hero\{background:radial-gradient/);
  assert.match(css, /\.exec-highlight\{background:#EAF3FA/);
  assert.doesNotThrow(() => new Function(js));
});

test('preview chart changes range and refuses to activate on Applications', () => {
  const chart = { innerHTML:'', attributes:{}, setAttribute(k,v){ this.attributes[k] = v; } };
  const labels = {children:[],replaceChildren(){this.children=[];},append(node){this.children.push(node);}};
  const section = {hidden:true};
  const summary = {textContent:''};
  const date = {textContent:''};
  const greeting = {textContent:''};
  const elements = {
    executiveDashboard:section,executiveRevenueChart:chart,
    executiveChartLabels:labels,executiveChartSummary:summary,
    executiveDate:date,executiveGreeting:greeting
  };
  const buttons = ['1M','3M','6M'].map(value => ({
    value,attributes:{},listeners:{},
    getAttribute(k){return k==='data-exec-range'?this.value:this.attributes[k];},
    setAttribute(k,v){this.attributes[k]=v;},
    addEventListener(k,listener){this.listeners[k]=listener;}
  }));
  const document = {
    documentElement:{dataset:{}},
    title:'',
    getElementById:id=>elements[id],
    querySelectorAll:q=>q==='[data-exec-range]'?buttons:[],
    createElement:()=>({textContent:''})
  };
  const window = {location:{pathname:'/dashboard'}};
  vm.runInNewContext(read('public/executive-dashboard.js'),{document,window,Intl,Date});
  const activate = window.VSPHExecutiveDashboard.activate;
  assert.equal(activate(),true);
  assert.equal(section.hidden,false);
  assert.equal(document.documentElement.dataset.executive,'true');
  assert.match(document.title,/Executive overview \(demo\)/);
  assert.equal(labels.children.length,6);
  assert.match(chart.attributes['aria-label'],/May ₹2,40,000/);
  assert.equal(buttons[2].attributes['aria-pressed'],'true');
  buttons[0].listeners.click();
  assert.equal(labels.children.length,4);
  assert.equal(buttons[0].attributes['aria-pressed'],'true');
  assert.match(summary.textContent,/October weekly revenue/);
  window.location.pathname='/applications';
  section.hidden=true;
  assert.equal(activate(),false);
  assert.equal(section.hidden,true);
});
