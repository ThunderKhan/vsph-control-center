
const loginForm = document.getElementById("loginForm");

if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const message = document.getElementById("message");
    message.textContent = "Signing in...";

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          email: document.getElementById("email").value,
          password: document.getElementById("password").value
        })
      });

      const data = await response.json();

      if (!response.ok) {
        message.textContent = data.message || "Login failed.";
        return;
      }

      window.location.href = "/dashboard.html";
    } catch {
      message.textContent = "Cannot connect to the server.";
    }
  });
}
