const {test,expect}=require('@playwright/test');

test('Feedback #05: key URLs, responsive project views and durable checklist, risks, links, updates',async({page,context},info)=>{
  test.skip(!process.env.PROJECT_E2E_DATABASE,'Requires isolated PostgreSQL fixture');
  test.setTimeout(90000);
  await context.addCookies([{name:'vsph.portal.sid',value:'fixture-admin-session',url:'http://127.0.0.1:3100',httpOnly:true,sameSite:'Lax'}]);
  const key='V2-'+info.project.name.toUpperCase()+'-'+info.retry;
  const created=await context.request.post('/api/projects',{data:{key,name:'V2 project workspace '+info.project.name,kind:'internal'}});
  expect(created.status()).toBe(201);
  const project=await created.json();
  const byKey=await context.request.get('/api/projects/by-key/'+key);
  expect(byKey.status()).toBe(200);
  expect((await byKey.json()).project.id).toBe(project.id);
  await page.goto('/projects/'+project.id);
  await expect(page).toHaveURL('/projects/'+key);
  await expect(page.locator('#projectTitle')).toContainText('V2 project workspace');
  await expect(page.locator('#projectOperations')).toBeHidden();
  await expect(page.locator('#accountSessions')).toBeHidden();
  await expect(page.locator('#projectSummary')).toContainText('Not started');

  // Old UUID bookmarks resolve to the same project, while the key is the display URL.
  await page.locator('[data-project-view="milestones"]').click();
  await expect(page).toHaveURL('/projects/'+key+'?view=milestones');
  await page.locator('#milestoneEditor summary').click();
  await page.getByLabel('Milestone title').fill('Implementation');
  await page.getByRole('button',{name:'Create milestone',exact:true}).click();
  await expect(page.locator('#milestoneList')).toContainText('Implementation');
  await expect(page.locator('#milestoneChecklistPanel')).toContainText('Implementation');
  await page.locator('#milestoneChecklistPanel .project-v2-milestone').first().locator('summary').click();
  const form=page.locator('#milestoneChecklistPanel .project-v2-mini-form');
  await page.locator('#milestoneChecklistPanel .project-v2-editor summary').first().click();
  await form.locator('input[name="title"]').fill('Implement authentication');
  await form.getByRole('button',{name:'Add item'}).click();
  await expect(page.locator('#milestoneChecklistPanel .project-v2-check-row')).toHaveCount(1);
  const tick=page.locator('#milestoneChecklistPanel .project-v2-circle-tick');
  await tick.click();
  await expect(page.locator('#milestoneChecklistPanel .project-v2-progress')).toHaveAttribute('aria-valuenow','100');
  const checklist=await (await context.request.get('/api/projects/'+project.id+'/workspace')).json();
  expect(checklist.checklist[0].completed).toBe(true);
  const detail=await (await context.request.get('/api/projects/'+project.id)).json();
  expect(detail.milestones[0].status).not.toBe('done');

  await page.locator('[data-project-view="overview"]').click();
  await expect(page.locator('#projectRoadmap')).toContainText('Implementation');
  // All additional data must be committed through the live isolated PostgreSQL fixture.
  await page.locator('#projectRisks .project-v2-editor summary').click();
  await page.locator('#projectRisks input[name="title"]').fill('Payment provider approval pending');
  await page.locator('#projectRisks select[name="severity"]').selectOption('high');
  await page.locator('#projectRisks button[type="submit"]').click();
  await expect(page.locator('#projectRisks')).toContainText('Payment provider approval pending');

  await page.locator('#projectResources .project-v2-editor summary').click();
  await page.locator('#projectResources input[name="label"]').fill('Project specification');
  await page.locator('#projectResources input[name="url"]').fill('https://example.test/project-spec');
  await page.locator('#projectResources button[type="submit"]').click();
  await expect(page.locator('#projectResources')).toContainText('Project specification');

  await page.locator('#projectWeeklyUpdates .project-v2-editor summary').click();
  await page.locator('#projectWeeklyUpdates textarea[name="summary"]').fill('Completed phase one project planning and milestone checklist.');
  await page.locator('#projectWeeklyUpdates button[type="submit"]').click();
  await expect(page.locator('#projectWeeklyUpdates')).toContainText('Completed phase one project planning');

  await page.reload();
  await expect(page.locator('#projectRisks')).toContainText('Payment provider approval pending');
  await expect(page.locator('#projectResources')).toContainText('Project specification');
  await expect(page.locator('#projectWeeklyUpdates')).toContainText('Completed phase one project planning');
  await expect(page.locator('#projectRoadmap .project-v2-progress')).toHaveAttribute('aria-valuenow','100');
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);

  await context.clearCookies();
  await context.addCookies([{name:'vsph.portal.sid',value:'fixture-outsider-session',url:'http://127.0.0.1:3100'}]);
  expect((await context.request.get('/api/projects/by-key/'+key)).status()).toBe(403);
  expect((await context.request.get('/api/projects/'+project.id+'/workspace')).status()).toBe(403);
});
