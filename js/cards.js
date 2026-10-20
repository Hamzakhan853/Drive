const driveCards = document.querySelectorAll(".drive-card");

driveCards.forEach((card) => {
  card.addEventListener("click", () => {
    card.style.transform = "scale(.95)";

    setTimeout(() => {
      card.style.transform = "";
    }, 150);
  });
});
