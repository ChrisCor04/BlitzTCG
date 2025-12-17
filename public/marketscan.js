// public/marketscan.js

const cardInput = document.getElementById("cardIdInput");
const addCardButton = document.getElementById("addCardButton");
const cardTableBody = document.querySelector("#cardTable tbody");
const emptyRow = document.getElementById("emptyRow");

// Modal elements (shared for card + variant selection)
const cardSelectOverlay = document.getElementById("cardSelectOverlay");
const cardSelectTitle = document.getElementById("cardSelectTitle");
const cardSelectList = document.getElementById("cardSelectList");
const cardSelectClose = document.getElementById("cardSelectClose");

let collectionChart; // Global chart instance

addCardButton.addEventListener("click", async () => {
  const userQuery = cardInput.value.trim();

  if (!userQuery) {
    alert("Please enter a card name to look up.");
    return;
  }

  try {
    // 1. Ask your backend to search JustTCG
    const response = await fetch("/search-card", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: userQuery,
        gameName: "pokemon", // can make dynamic later
      }),
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(errBody.error || "Failed to search card");
    }

    const result = await response.json();
    const cards = result.data || [];

    if (!cards.length) {
      alert(`No cards found for "${userQuery}". Try a more specific name.`);
      return;
    }

    // 2. Disambiguate card using modal if needed
    const selection = pickOrDisambiguate(cards, userQuery);
    let chosenCard;

    if (selection.type === "chosen") {
      chosenCard = selection.card;
    } else {
      chosenCard = await showCardSelectionModal(selection.cards, userQuery);
      if (!chosenCard) {
        // User canceled
        return;
      }
    }

    if (!chosenCard.variants || !chosenCard.variants.length) {
      alert("No variants found for this card.");
      return;
    }

    // 3. Let user pick the variant if more than one
    let chosenVariant;
    if (chosenCard.variants.length === 1) {
      chosenVariant = chosenCard.variants[0];
    } else {
      chosenVariant = await showVariantSelectionModal(chosenCard);
      if (!chosenVariant) {
        // User canceled
        return;
      }
    }

    // 4. Add to the table UI
    addCardToTable(chosenCard, chosenVariant);
    cardInput.value = "";
  } catch (err) {
    console.error("Error looking up card:", err);
    alert("Something went wrong while fetching card data. Check console.");
  }
});

function updateTotalValue() {
  let total = 0;

  // Loop through all rows in the table
  const rows = document.querySelectorAll("#cardTable tbody tr");

  rows.forEach(row => {
    const priceTd = row.children[1]; // 2nd column = price

    if (!priceTd) return;

    const text = priceTd.textContent.trim(); // "$12.34"

    if (text.startsWith("$")) {
      const value = parseFloat(text.replace("$", ""));
      if (!isNaN(value)) total += value;
    }
  });

  // Update UI
  const totalDiv = document.getElementById("totalValue");
  if (totalDiv) {
    totalDiv.textContent = `Total Collection Value: $${total.toFixed(2)}`;
  }

  // Update chart with new total
  updateChart(total);
}

// Decide if we can auto-pick a card or show the modal
function pickOrDisambiguate(cards, userQuery) {
  const normalizedQuery = userQuery.trim().toLowerCase();

  const exactMatches = cards.filter(
    (c) => c.name && c.name.toLowerCase() === normalizedQuery
  );

  if (exactMatches.length === 1) {
    return { type: "chosen", card: exactMatches[0] };
  }

  return { type: "choices", cards };
}

// Helper: add delete button to a row
function addDeleteButton(tr, variantId) {
  const deleteTd = document.createElement("td");
  deleteTd.innerHTML = "❌";
  deleteTd.style.cursor = "pointer";

  deleteTd.onclick = () => {
    tr.remove();
    deleteCardFromLocal(variantId);
    updateTotalValue();

    // If table is empty again, show the emptyRow
    if (!cardTableBody.querySelector("tr")) {
      if (emptyRow) {
        cardTableBody.appendChild(emptyRow);
      }
    }
  };

  tr.appendChild(deleteTd);
}

// Add row to table
function addCardToTable(card, variant) {
  if (emptyRow) {
    emptyRow.remove();
  }

  const tr = document.createElement("tr");

  const nameTd = document.createElement("td");
  nameTd.textContent = `${card.name} — ${card.set_name} (#${card.number || "N/A"})`;

  const priceTd = document.createElement("td");
  const priceValue =
    typeof variant.price === "number" ? variant.price.toFixed(2) : "N/A";
  priceTd.textContent = priceValue === "N/A" ? "N/A" : `$${priceValue}`;

  const imageTd = document.createElement("td");
  imageTd.textContent = "Loading…";

  tr.appendChild(nameTd);
  tr.appendChild(priceTd);
  tr.appendChild(imageTd);
  cardTableBody.appendChild(tr);

  // ---- Pokémon images via TCGdex ----
  if (card.game === "Pokemon") {
    const params = new URLSearchParams({
      setName: card.set_name || "",
      number: card.number || "",
    });

    fetch(`/pokemon-image?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        imageTd.textContent = "";

        let imageUrl = null;

        if (data.imageUrl) {
          imageUrl = data.imageUrl;
          const img = document.createElement("img");
          img.src = imageUrl;
          img.alt = card.name;
          img.className = "card-image";
          imageTd.appendChild(img);
        } else {
          imageTd.textContent = "No image";
        }

        // SAVE TO LOCAL STORAGE
        saveCardLocally(card, variant, imageUrl);
        addDeleteButton(tr, variant.id);
        updateTotalValue();               
      })
      .catch((err) => {
        console.error("Error fetching Pokémon image:", err);
        imageTd.textContent = "No image";

        // Save even without image
        saveCardLocally(card, variant, null);
        addDeleteButton(tr, variant.id);
        updateTotalValue();               
      });
  } else {
    // Non-Pokémon, just save without image
    imageTd.textContent = "No image";
    saveCardLocally(card, variant, null);
    addDeleteButton(tr, variant.id);
    updateTotalValue();                   
  }
}

/**
 * Show the modal with a clickable list of cards.
 * Returns a Promise that resolves to the chosen card (or null if canceled).
 */
function showCardSelectionModal(cards, userQuery) {
  return new Promise((resolve) => {
    // Clear previous content
    cardSelectList.innerHTML = "";

    // Set title
    cardSelectTitle.textContent = `Multiple results for "${userQuery}"`;

    // Build list items
    cards.forEach((card) => {
      const option = document.createElement("div");
      option.className = "modal-card-option";

      const title = document.createElement("div");
      title.className = "modal-card-title";
      title.textContent = card.name;

      const meta = document.createElement("div");
      meta.className = "modal-card-meta";
      meta.textContent = `${card.set_name} • #${card.number || "N/A"} • ${
        card.rarity || "Unknown rarity"
      }`;

      const extra = document.createElement("div");
      extra.className = "modal-card-extra";
      extra.textContent = `Variants: ${
        card.variants ? card.variants.length : 0
      }`;

      option.appendChild(title);
      option.appendChild(meta);
      option.appendChild(extra);

      option.addEventListener("click", () => {
        hideCardSelectionModal();
        cleanup();
        resolve(card);
      });

      cardSelectList.appendChild(option);
    });

    // Cancel / close handlers
    const onClose = () => {
      hideCardSelectionModal();
      cleanup();
      resolve(null);
    };

    cardSelectClose.addEventListener("click", onClose);

    const onOverlayClick = (e) => {
      if (e.target === cardSelectOverlay) {
        onClose();
      }
    };
    cardSelectOverlay.addEventListener("click", onOverlayClick);

    function cleanup() {
      cardSelectClose.removeEventListener("click", onClose);
      cardSelectOverlay.removeEventListener("click", onOverlayClick);
    }

    showModalOverlay();
  });
}

/**
 * Show the modal with a clickable list of variants for a given card.
 * Returns a Promise that resolves to the chosen variant (or null if canceled).
 */
function showVariantSelectionModal(card) {
  return new Promise((resolve) => {
    const variants = card.variants || [];

    cardSelectList.innerHTML = "";
    cardSelectTitle.textContent = `Select variant for "${card.name}"`;

    variants.forEach((variant) => {
      const option = document.createElement("div");
      option.className = "modal-card-option";

      const title = document.createElement("div");
      title.className = "modal-card-title";
      title.textContent = `${variant.condition} • ${variant.printing}`;

      const meta = document.createElement("div");
      meta.className = "modal-card-meta";
      const priceText =
        typeof variant.price === "number"
          ? `$${variant.price.toFixed(2)}`
          : "Price: N/A";
      meta.textContent = `${priceText} • ${
        variant.language || "Unknown language"
      }`;

      const extra = document.createElement("div");
      extra.className = "modal-card-extra";
      extra.textContent = `Variant ID: ${variant.id}`;

      option.appendChild(title);
      option.appendChild(meta);
      option.appendChild(extra);

      option.addEventListener("click", () => {
        hideCardSelectionModal();
        cleanup();
        resolve(variant);
      });

      cardSelectList.appendChild(option);
    });

    const onClose = () => {
      hideCardSelectionModal();
      cleanup();
      resolve(null);
    };

    cardSelectClose.addEventListener("click", onClose);

    const onOverlayClick = (e) => {
      if (e.target === cardSelectOverlay) {
        onClose();
      }
    };
    cardSelectOverlay.addEventListener("click", onOverlayClick);

    function cleanup() {
      cardSelectClose.removeEventListener("click", onClose);
      cardSelectOverlay.removeEventListener("click", onOverlayClick);
    }

    showModalOverlay();
  });
}

function showModalOverlay() {
  cardSelectOverlay.classList.remove("hidden");
}

function hideCardSelectionModal() {
  cardSelectOverlay.classList.add("hidden");
}

// ===============================
// Local Storage Helpers
// ===============================

function saveCardLocally(card, variant, imageUrl) {
  const email = localStorage.getItem("userEmail");
  if (!email) return; // no logged-in user → do nothing

  const key = `userCards_${email}`;
  const saved = JSON.parse(localStorage.getItem(key)) || [];

  saved.push({
    id: card.id,
    variantId: variant.id,
    name: card.name,
    setName: card.set_name,
    number: card.number,
    game: card.game,
    price: variant.price ?? null,
    condition: variant.condition,
    printing: variant.printing,
    imageUrl: imageUrl || null,
  });

  localStorage.setItem(key, JSON.stringify(saved));
}

function deleteCardFromLocal(variantId) {
  const email = localStorage.getItem("userEmail");
  if (!email) return;

  const key = `userCards_${email}`;
  let saved = JSON.parse(localStorage.getItem(key)) || [];

  saved = saved.filter((card) => card.variantId !== variantId);
  localStorage.setItem(key, JSON.stringify(saved));
}

function restoreCardToTable(item) {
  const tr = document.createElement("tr");

  const nameTd = document.createElement("td");
  nameTd.textContent = `${item.name} — ${item.setName} (#${item.number})`;

  const priceTd = document.createElement("td");
  priceTd.textContent =
    typeof item.price === "number" ? `$${item.price.toFixed(2)}` : "N/A";

  const imageTd = document.createElement("td");

  if (item.imageUrl) {
    const img = document.createElement("img");
    img.src = item.imageUrl;
    img.alt = item.name;
    img.className = "card-image";
    imageTd.appendChild(img);
  } else {
    imageTd.textContent = "No image";
  }

  tr.appendChild(nameTd);
  tr.appendChild(priceTd);
  tr.appendChild(imageTd);

  addDeleteButton(tr, item.variantId);

  cardTableBody.appendChild(tr); 
}



// Restore cards when page loads
window.addEventListener("DOMContentLoaded", () => {
  const email = localStorage.getItem("userEmail");
  if (!email) return;

  const key = `userCards_${email}`;
  const saved = JSON.parse(localStorage.getItem(key)) || [];

  if (saved.length && emptyRow) {
    emptyRow.remove();
  }

  saved.forEach((item) => restoreCardToTable(item));
  updateTotalValue();

  // Initialize the chart
  initializeChart();
});

// Function to initialize the line chart
function initializeChart() {
  const ctx = document.getElementById('collectionLineChart').getContext('2d');
  
  // Get historical data from localStorage
  const email = localStorage.getItem("userEmail");
  const historyKey = `priceHistory_${email}`;
  let history = JSON.parse(localStorage.getItem(historyKey)) || [];
  
  // Ensure we have 7 days
  const now = new Date();
  const labels = [];
  const data = [];
  
  for (let i = 6; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(now.getDate() - i);
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
    labels.push(date.toLocaleDateString());
    
    const entry = history.find(h => h.date === dateStr);
    data.push(entry ? entry.total : 0);
  }
  
  collectionChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Total Collection Value ($)',
        data: data,
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          grid: {
            color: 'rgba(255, 255, 255, 0.1)'
          },
          ticks: {
            color: '#e5e7eb'
          }
        },
        x: {
          grid: {
            color: 'rgba(255, 255, 255, 0.1)'
          },
          ticks: {
            color: '#e5e7eb'
          }
        }
      },
      plugins: {
        legend: {
          labels: {
            color: '#e5e7eb'
          }
        }
      }
    }
  });
}

// Function to update the chart with new total value
function updateChart(newTotal) {
  if (!collectionChart) return;
  
  // Save today's total
  const email = localStorage.getItem("userEmail");
  if (!email) return;
  
  const historyKey = `priceHistory_${email}`;
  let history = JSON.parse(localStorage.getItem(historyKey)) || [];
  
  const today = new Date().toISOString().split('T')[0];
  const existing = history.find(h => h.date === today);
  if (existing) {
    existing.total = newTotal;
  } else {
    history.push({ date: today, total: newTotal });
  }
  
  // Keep only last 7 days
  history = history.filter(h => {
    const d = new Date(h.date);
    const diff = (new Date() - d) / (1000 * 60 * 60 * 24);
    return diff <= 7;
  });
  
  localStorage.setItem(historyKey, JSON.stringify(history));
  
  // Update chart data
  const now = new Date();
  for (let i = 0; i < 7; i++) {
    const date = new Date(now);
    date.setDate(now.getDate() - (6 - i));
    const dateStr = date.toISOString().split('T')[0];
    const entry = history.find(h => h.date === dateStr);
    collectionChart.data.datasets[0].data[i] = entry ? entry.total : 0;
  }
  
  collectionChart.update();
}
