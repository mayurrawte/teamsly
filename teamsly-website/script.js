const header = document.querySelector(".site-header");
const tabs = document.querySelectorAll(".status-tab");
const statusCopy = document.querySelector("#status-copy");

const statusText = {
  demo:
    "`/demo` is the current verification path. It uses mock teams, channels, DMs, reactions, threads, presence, search, and launch UI without requiring Microsoft auth.",
  real:
    "Real mode requires Azure AD credentials. The smoke test should verify sign-in, teams, channels, chats, messages, sends, reactions, replies, and presence against Microsoft Graph.",
  build:
    "`npm run build` compiles and then stops on the documented NextAuth `tenantId` type mismatch. Keep that decision explicit before deployment.",
};

function updateHeader() {
  if (!header) return;
  header.dataset.elevated = window.scrollY > 8 ? "true" : "false";
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((item) => item.classList.remove("active"));
    tab.classList.add("active");
    statusCopy.textContent = statusText[tab.dataset.tab];
  });
});

window.addEventListener("scroll", updateHeader, { passive: true });
updateHeader();
