function toggleAccordion(trigger) {
  const content = trigger.nextElementSibling;
  const chevron = trigger.querySelector(".chevron");
  const isOpen = content.classList.contains("open");

  // Close all other accordions
  document.querySelectorAll(".accordion-content.open").forEach((item) => {
    if (item !== content) {
      item.classList.remove("open");
      item.previousElementSibling
        .querySelector(".chevron")
        .classList.remove("open");
    }
  });

  // Toggle current accordion
  if (isOpen) {
    content.classList.remove("open");
    chevron.classList.remove("open");
  } else {
    content.classList.add("open");
    chevron.classList.add("open");
  }
}
