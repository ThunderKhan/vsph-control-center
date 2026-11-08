const {test,expect}=require('@playwright/test');
const origin='http://127.0.0.1:3100';
const cookie=token=>({name:'vsph.portal.sid',value:token,url:origin,httpOnly:true,sameSite:'Lax'});

test('linked employees see work activity first on the dashboard; customers cannot',async({page,context},info)=>{
 test.skip(!process.env.PROJECT_E2E_DATABASE,'Requires isolated native PostgreSQL');
 await context.addCookies([cookie('fixture-hrms-staff-'+info.project.name)]);
 await page.goto('/dashboard');
 await expect(page.locator('.crm-avatar-status')).toHaveCount(1);
 await expect(page.locator('.overview-help')).toHaveCount(0);
 await expect(page.getByText('Account active',{exact:true})).toHaveCount(0);
 await expect(page.locator('#overviewDetails')).toBeHidden();
 await expect(page.locator('#employeeDashboard')).toBeVisible();
 await expect(page.locator('#employeeDashboardTitle')).toHaveText('My dashboard.');
 await expect(page.locator('#workActivity[data-state="loaded"]')).toBeVisible();
 await expect(page.locator('.work-activity-heading')).toContainText('1 recorded task completion');
 await expect(page.locator('.work-activity-day[data-level]:not([data-level="0"])')).toHaveCount(1);
 await page.locator('.work-activity-toggle').click();
 await expect(page.locator('.work-activity-project-list')).toContainText('Assigned delivery '+info.project.name);
 await page.locator('.work-activity-toggle').click();
 await expect(page.locator('#employeeDashboardWork')).toBeVisible();
 await expect(page.locator('#hrContent')).toBeVisible();
 await expect(page.locator('#ownTasks')).toContainText('Implement assigned feature '+info.project.name);
 await expect(page.locator('#employeeTasksMetric')).toHaveText(/^[0-9]+$/);
 await expect(page.locator('#employeeAttendanceMetric')).not.toHaveText('—');
 await expect(page.locator('#employeeLeaveMetric')).toHaveText(/^[0-9]+$/);
 await expect(page.locator('#leaveForm')).toBeVisible();
 await expect(page.locator('#refreshHr')).toBeEnabled();
 // Native details provide keyboard state while custom chevrons communicate the action.
 const notifications=page.locator('#employeeTasksPanel .employee-work-details');
 const notificationTrigger=notifications.locator('summary');
 await expect(notifications).not.toHaveAttribute('open');
 await expect(notificationTrigger.locator('.employee-details-chevron')).toBeVisible();
 await expect(page.locator('#ownNotifications')).toBeHidden();
 await notificationTrigger.click();
 await expect(notifications).toHaveAttribute('open','');
 await expect(page.locator('#ownNotifications')).toBeVisible();
 await notificationTrigger.focus();
 await notificationTrigger.press('Enter');
 await expect(notifications).not.toHaveAttribute('open');

 const attendanceHistory=page.locator('#employeeAttendancePanel .employee-work-details');
 const attendanceTrigger=attendanceHistory.locator('summary');
 await expect(attendanceHistory).not.toHaveAttribute('open');
 await expect(attendanceTrigger.locator('.employee-details-chevron')).toBeVisible();
 await attendanceTrigger.press('Enter');
 await expect(attendanceHistory).toHaveAttribute('open','');
 await expect(page.locator('#ownAttendance')).toBeVisible();
 await attendanceTrigger.click();
 await expect(attendanceHistory).not.toHaveAttribute('open');
 await expect(page.locator('.employee-dashboard-actions')).toHaveCount(0);
 await expect(page.locator('.employee-activity-note')).toHaveCount(0);
 await expect(page.locator('#workActivity')).toBeVisible();

 await context.clearCookies();
 await context.addCookies([cookie('fixture-music-customer-session')]);
 await page.goto('/dashboard');
 await expect(page.locator('#myWorkShortcut')).toBeHidden();
 await expect(page.locator('#employeeDashboard')).toBeHidden();
 await expect(page.locator('#workActivity')).toHaveCount(1);
 await expect(page.locator('#workActivity')).toBeHidden();
 await expect(page.locator('.crm-avatar-status')).toHaveCount(1);
 expect((await context.request.get('/my-work')).status()).toBe(403);
});

test('linked account still onboarding gets an explanatory dashboard rather than a silently missing heatmap',async({page,context},info)=>{
 test.skip(!process.env.PROJECT_E2E_DATABASE,'Requires isolated native PostgreSQL');
 await context.addCookies([cookie('fixture-hrms-staff-'+info.project.name)]);
 await page.route('**/api/hrms/access',route=>route.fulfill({
  status:200,contentType:'application/json',body:JSON.stringify({employee:false,management:false,governHr:false,pendingLink:false})
 }));
 await page.route('**/api/employee-identity/mine',route=>route.fulfill({
  status:200,contentType:'application/json',
  body:JSON.stringify({employment:[{status:'onboarding'}],requests:[]})
 }));
 await page.goto('/dashboard');
 await expect(page.locator('#employeeDashboard')).toBeVisible();
 await expect(page.locator('#employeeActivitySetup')).toBeVisible();
 await expect(page.locator('#employeeActivitySetupTitle')).toHaveText('Your employee record is still onboarding');
 await expect(page.locator('#workActivity')).toBeHidden();
 await expect(page.locator('.work-activity-day')).toHaveCount(0);
 await expect(page.locator('#employeeActivitySetupAction')).toHaveAttribute('href','/employment');
 await expect(page.locator('#employeeDashboardWork')).toBeHidden();
 await page.unroute('**/api/hrms/access');
 await page.unroute('**/api/employee-identity/mine');
});
