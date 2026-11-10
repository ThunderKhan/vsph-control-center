const { test, expect } = require("@playwright/test");

test("Projects portfolio keeps correct filter values, clear action and mobile-safe table", async ({page,context},info) => {
  test.skip(!process.env.PROJECT_E2E_DATABASE,"Requires isolated PostgreSQL fixture");
  await context.addCookies([{name:"vsph.portal.sid",value:"fixture-admin-session",url:"http://127.0.0.1:3100",httpOnly:true,sameSite:"Lax"}]);
  await page.goto("/projects");
  await expect(page.locator("#projectSubtitle")).toBeHidden();
  await expect(page.locator("#portfolioCount")).not.toHaveText("—");
  await expect(page.locator("#projectResultsCount")).not.toHaveText("Loading Projects…");
  await expect(page.locator("#projectFilters select[name=status] option[value=active]")).toHaveText("Active");
  await expect(page.locator("#projectFilters select[name=status] option[value=archived]")).toHaveText("Archived");
  await page.locator("#projectFilters select[name=status]").selectOption("active");
  await page.locator("#projectFilters").getByRole("button",{name:"Apply Filters",exact:true}).click();
  await expect(page.locator("#projectList")).toHaveAttribute("aria-busy","false");
  const pills=await page.locator("#projectList .project-portfolio-pill").allTextContents();
  expect(pills.every(text=>text==="Active")).toBe(true);
  const count=Number(await page.locator("#portfolioCount").textContent());
  expect(count).toBe(pills.length);
  await page.getByRole("button",{name:"Clear",exact:true}).click();
  await expect(page.locator("#projectFilters select[name=status]")).toHaveValue("");
  await expect(page.locator("#projectList")).toHaveAttribute("aria-busy","false");
  const extra=await page.locator("html").evaluate(root=>root.scrollWidth-innerWidth);
  expect(extra,"Portfolio must not create document-wide horizontal scrolling").toBeLessThanOrEqual(1);
  await info.attach("project-portfolio-"+info.project.name,{body:await page.screenshot({fullPage:false}),contentType:"image/png"});
});
