const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname,'..','public','admin.html'),'utf8');

function formMarkup(id) {
  const open = html.indexOf('<form id="' + id + '"');
  assert.ok(open >= 0, 'Missing ' + id);
  const close = html.indexOf('</form>',open);
  assert.ok(close > open,'Unclosed ' + id);
  return html.slice(open,close+7);
}

test('admin forms do not inherit old global input and label spacing',()=>{
  assert.doesNotMatch(html, /<link[^>]+href="\/style\.css"/);
  assert.match(html, /\.form-grid\{[^}]*align-items:start/);
  assert.match(html, /\.form-grid>div>label\{[^}]*margin:0 0 8px/);
  assert.match(html, /\.form-grid>div>input,\.form-grid>div>select\{[^}]*height:48px;min-height:48px;margin:0/);
});

test('all subscription labels and fields stay in the same consistent grid row',()=>{
  const form = formMarkup('subscriptionForm');
  for (const field of ['subOrg','subApp','subPlan','subStatus','subEnd']) {
    assert.match(form, new RegExp('<label for="' + field + '">'));
    assert.match(form, new RegExp('id="' + field + '"'));
  }
  assert.match(html, /#subscriptionForm\{grid-template-columns:repeat\(auto-fit,minmax\(195px,1fr\)\)\}/);
  assert.match(form,/aria-describedby="subscriptionHelp"/);
  assert.match(html,/id="subscriptionHelp"/);
  assert.match(form, /class="form-actions"><button class="primary" type="submit">Save subscription<\/button>/);
});

test('other admin forms also have a separate, centered save action row',()=>{
  for (const id of ['applicationForm','userForm','accessForm','roleForm']) {
    const form=formMarkup(id);
    assert.match(form,/class="form-actions"><button class="primary" type="submit">/);
  }
  assert.match(html,/\.form-grid>\.form-actions\{grid-column:1\/-1/);
  assert.match(html,/\.form-grid>\.form-actions \.primary\{[^}]*justify-content:center;text-align:center/);
  assert.match(html, /\.form-grid,#subscriptionForm\{grid-template-columns:1fr\}/);
});

test('changes preserve existing form IDs and admin controller integration',()=>{
  for (const id of ['applicationForm','userForm','subscriptionForm','accessForm','roleForm'])
    assert.match(html,new RegExp('<form id="' + id + '"'));
  assert.match(html,/<script src="\/admin\.js"><\/script>/);
  assert.match(html,/id="section-subscriptions"/);
  assert.match(html,/id="subscriptionsTable"/);
  assert.match(html,/href="\/admin\/onboarding"/);
  assert.doesNotMatch(html,/id="clientPassword"/);
});
