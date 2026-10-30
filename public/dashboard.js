
const appGrid = document.getElementById("appGrid");
const searchInput = document.getElementById("appSearch");
const errorMessage = document.getElementById("errorMessage");
const emptyMessage = document.getElementById("emptyMessage");

let allApps = [];

const appDesign = {
  MUSIC: {
    icon: "♫", color: "music", category: "EVENTS & ENTERTAINMENT",
    description: "Manage live music, events, bookings, and celebrations."
  },
  CRM: {
    icon: "◎", color: "crm", category: "CUSTOMER MANAGEMENT",
    description: "Manage customer relationships, leads, and interactions."
  },
  CMS: {
    icon: "▤", color: "cms", category: "CONTENT MANAGEMENT",
    description: "Create, organize, and manage your website content."
  },
  HR: {
    icon: "♙", color: "hr", category: "PEOPLE & PAYROLL",
    description: "Manage employees, attendance, and payroll records."
  },
  PROJECTS: {
    icon: "◈", color: "projects", category: "WORK MANAGEMENT",
    description: "Organize projects, tasks, teams, and progress."
  }
};

async function loadDashboard() {
  try {
    const meResponse = await fetch("/api/auth/me");

    if (!meResponse.ok) {
      window.location.href = "/login";
      return;
    }

    const { user } = await meResponse.json();
    const firstName = user.name.split(" ")[0];

    document.getElementById("greetingName").textContent = firstName;
    document.getElementById("sideName").textContent = user.name;
    document.getElementById("sideRole").textContent =
      user.platformRole === "super_admin" ? "Super Administrator" : "Client User";
    document.getElementById("adminNav").hidden = user.platformRole !== "super_admin";

    document.getElementById("avatar").textContent = firstName.charAt(0).toUpperCase();
    document.getElementById("topAvatar").textContent = firstName.charAt(0).toUpperCase();

    const appsResponse = await fetch("/api/apps");

    if (!appsResponse.ok) {
      throw new Error("Could not load applications.");
    }

    const data = await appsResponse.json();
    allApps = data.applications || [];

    document.getElementById("appCount").textContent = allApps.length;

    if (user.platformRole === "super_admin") {
      document.getElementById("workspaceCount").textContent = "All";
    } else {
      const response = await fetch("/api/workspaces");
      if (response.ok) {
        const workspaceData = await response.json();
        document.getElementById("workspaceCount").textContent =
          workspaceData.count ?? "—";
      } else {
        document.getElementById("workspaceCount").textContent = "—";
      }
    }

    renderApps();
  } catch (error) {
    errorMessage.textContent = error.message;
    appGrid.innerHTML = "";
  }
}

function renderApps() {
  const query = searchInput.value.trim().toLowerCase();

  const filtered = allApps.filter(app =>
    `${app.name} ${app.code}`.toLowerCase().includes(query)
  );

  appGrid.innerHTML = "";
  emptyMessage.hidden = filtered.length !== 0;

  filtered.forEach(app => {
    const design = appDesign[app.code] || {
      icon: "▦",
      color: "default",
      category: "BUSINESS APPLICATION",
      description: "Open your application workspace."
    };

    const card = document.createElement("article");
    card.className = "app-card";

    const icon = document.createElement("div");
    icon.className = `app-icon ${design.color}`;
    icon.textContent = design.icon;

    const category = document.createElement("span");
    category.className = "app-category";
    category.textContent = design.category;

    const title = document.createElement("h3");
    title.textContent = app.name;

    const description = document.createElement("p");
    description.className = "app-description";
    description.textContent = design.description;

    const footer = document.createElement("div");
    footer.className = "app-card-footer";

    const status = document.createElement("span");
    status.className = "app-status";
    status.textContent = "● Available";

    const openLink = document.createElement("a");
    openLink.className = "app-open";
    openLink.href = app.login_path;
    openLink.textContent = "Open app →";
    openLink.setAttribute("aria-label", `Open ${app.name}`);

    footer.append(status, openLink);
    card.append(icon, category, title, description, footer);
    appGrid.appendChild(card);
  });
}

searchInput.addEventListener("input", renderApps);

document.getElementById("logoutButton").addEventListener("click", async () => {
  await fetch("/api/auth/logout", { method: "POST" });
  window.location.href = "/login";
});

loadDashboard();
