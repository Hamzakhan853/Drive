const searchInput = document.getElementById("search");

const cards = document.querySelectorAll(".drive-card");

if (searchInput) {
  searchInput.addEventListener("keyup", () => {
    let value = searchInput.value.toLowerCase();

    cards.forEach((card) => {
      let text = card.innerText.toLowerCase();

      if (text.includes(value)) {
        card.style.display = "block";
      } else {
        card.style.display = "none";
      }
    });
  });
}
