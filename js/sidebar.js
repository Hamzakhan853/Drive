const menuItems = document.querySelectorAll(".menu li");

menuItems.forEach((item) => {
  item.addEventListener("click", () => {
    menuItems.forEach((i) => {
      i.classList.remove("active");
    });

    item.classList.add("active");
  });
});
const sidebar = document.querySelector(".sidebar");
const overlay = document.querySelector(".overlay");

function toggleSidebar() {
  sidebar.classList.toggle("active");
  overlay.classList.toggle("active");
}

function openLogin() {
  window.location.href = "login.html";
}
