/* ==========================================
   L'ORÉAL SMART ROUTINE & PRODUCT ADVISOR
   ========================================== */

// Your existing Cloudflare Worker
const WORKER_URL = "https://smart-product-advisor.echang2245.workers.dev/";

// LocalStorage keys
const STORAGE_KEY = "loreal-selected-products";

// DOM elements
const categoryFilter = document.getElementById("categoryFilter");
const productSearch = document.getElementById("productSearch");
const productsContainer = document.getElementById("productsContainer");
const selectedProductsList = document.getElementById("selectedProductsList");
const selectedCount = document.getElementById("selectedCount");
const generateBtn = document.getElementById("generateRoutine");
const clearAllBtn = document.getElementById("clearAllBtn");
const chatWindow = document.getElementById("chatWindow");
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const webSearchToggle = document.getElementById("webSearchToggle");
const appStatus = document.getElementById("appStatus");

// Application state
let allProducts = [];
let selectedIds = new Set();
let routineProducts = [];
let conversationHistory = [];
let isLoading = false;

/* ==========================================
   HELPER FUNCTIONS
   ========================================== */

function createElement(tag, className = "", text = "") {
  const element = document.createElement(tag);

  if (className) {
    element.className = className;
  }

  if (text !== "") {
    element.textContent = text;
  }

  return element;
}

function safeUrl(value) {
  try {
    const url = new URL(value);

    if (url.protocol === "https:" || url.protocol === "http:") {
      return url.href;
    }
  } catch (error) {
    return null;
  }

  return null;
}

function setStatus(message = "", isError = false) {
  appStatus.textContent = message;
  appStatus.classList.toggle("is-error", isError);
}

function normalize(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/* ==========================================
   LOCAL STORAGE
   ========================================== */

function saveSelections() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...selectedIds]));
  } catch (error) {
    console.error("Could not save selections:", error);
  }
}

function loadSavedSelections() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");

    if (Array.isArray(saved)) {
      selectedIds = new Set(saved.map(String));
    }
  } catch (error) {
    selectedIds = new Set();
  }
}

/* ==========================================
   LOAD PRODUCT DATA
   ========================================== */

async function loadProducts() {
  try {
    const response = await fetch("products.json");

    if (!response.ok) {
      throw new Error("Unable to load products.json");
    }

    const data = await response.json();

    allProducts = data.products;

    if (!Array.isArray(allProducts)) {
      throw new Error("Invalid products.json format");
    }

    loadSavedSelections();

    // Only restore IDs that still exist in the catalog
    const validIds = new Set(allProducts.map((product) => String(product.id)));

    selectedIds = new Set([...selectedIds].filter((id) => validIds.has(id)));

    displayProducts();
    updateSelectedProducts();
  } catch (error) {
    console.error(error);

    productsContainer.replaceChildren(
      createElement(
        "p",
        "placeholder-message",
        "Unable to load products. Please check products.json.",
      ),
    );

    setStatus(error.message, true);
  }
}

/* ==========================================
   FILTER AND DISPLAY PRODUCTS
   ========================================== */

function displayProducts() {
  const selectedCategory = categoryFilter.value;
  const searchTerm = normalize(productSearch.value.trim());

  const filteredProducts = allProducts.filter((product) => {
    const matchesCategory =
      selectedCategory === "" || product.category === selectedCategory;

    const searchableText = normalize(`
      ${product.name}
      ${product.brand}
      ${product.category}
      ${product.description}
    `);

    const matchesSearch =
      searchTerm === "" || searchableText.includes(searchTerm);

    return matchesCategory && matchesSearch;
  });

  document.getElementById("productCount").textContent = filteredProducts.length;

  productsContainer.replaceChildren();

  if (filteredProducts.length === 0) {
    productsContainer.appendChild(
      createElement("p", "placeholder-message", "No matching products found."),
    );

    return;
  }

  filteredProducts.forEach((product) => {
    productsContainer.appendChild(createProductCard(product));
  });
}

/* ==========================================
   CREATE PRODUCT CARDS
   ========================================== */

function createProductCard(product) {
  const isSelected = selectedIds.has(String(product.id));

  const card = createElement(
    "div",
    isSelected ? "product-card is-selected" : "product-card",
  );

  const button = createElement("button", "product-main");

  button.type = "button";
  button.setAttribute("aria-pressed", String(isSelected));
  button.setAttribute(
    "aria-label",
    `${isSelected ? "Remove" : "Select"} ${product.name}`,
  );

  // Product image
  const imageWrapper = createElement("div", "product-image-wrap");

  const image = document.createElement("img");

  const imageUrl = safeUrl(product.image);

  if (imageUrl) {
    image.src = imageUrl;
  }

  image.alt = product.name;
  image.loading = "lazy";

  imageWrapper.appendChild(image);

  // Product information
  const brand = createElement("span", "product-brand", product.brand);

  const name = createElement("h3", "", product.name);

  const category = createElement("span", "product-category", product.category);

  button.append(imageWrapper, brand, name, category);

  // Visual indicator for selected products
  if (isSelected) {
    button.appendChild(createElement("span", "selected-indicator", "✓"));
  }

  // Select or unselect product
  button.addEventListener("click", () => {
    toggleProduct(product.id);
  });

  card.appendChild(button);

  // Expandable product description
  const details = document.createElement("details");

  const summary = createElement("summary", "", "View description");

  const description = createElement(
    "p",
    "product-description",
    product.description || "No description available.",
  );

  details.append(summary, description);

  card.appendChild(details);

  return card;
}

/* ==========================================
   SELECT / UNSELECT PRODUCTS
   ========================================== */

function toggleProduct(productId) {
  const id = String(productId);

  if (selectedIds.has(id)) {
    selectedIds.delete(id);
  } else {
    selectedIds.add(id);
  }

  saveSelections();
  displayProducts();
  updateSelectedProducts();
}

function getSelectedProducts() {
  return allProducts.filter((product) => selectedIds.has(String(product.id)));
}

/* ==========================================
   UPDATE SELECTED PRODUCTS SECTION
   ========================================== */

function updateSelectedProducts() {
  const products = getSelectedProducts();

  selectedCount.textContent = products.length;

  generateBtn.disabled = products.length === 0 || isLoading;

  clearAllBtn.disabled = products.length === 0 || isLoading;

  selectedProductsList.replaceChildren();

  if (products.length === 0) {
    selectedProductsList.appendChild(
      createElement(
        "p",
        "empty-list",
        "Your edit is waiting. Choose a product to begin.",
      ),
    );

    return;
  }

  products.forEach((product) => {
    const row = createElement("div", "selected-row");

    const image = document.createElement("img");

    const imageUrl = safeUrl(product.image);

    if (imageUrl) {
      image.src = imageUrl;
    }

    image.alt = "";
    image.className = "selected-thumb";

    const text = createElement("div", "selected-text");

    const name = createElement("strong", "", product.name);

    const brand = createElement("span", "", product.brand);

    text.append(name, brand);

    // Remove individual selected product
    const removeButton = createElement("button", "remove-btn", "×");

    removeButton.type = "button";
    removeButton.disabled = isLoading;

    removeButton.setAttribute("aria-label", `Remove ${product.name}`);

    removeButton.addEventListener("click", () => {
      toggleProduct(product.id);
    });

    row.append(image, text, removeButton);

    selectedProductsList.appendChild(row);
  });
}

/* ==========================================
   CLEAR ALL PRODUCTS
   ========================================== */

clearAllBtn.addEventListener("click", () => {
  if (isLoading) {
    return;
  }

  selectedIds.clear();

  saveSelections();
  displayProducts();
  updateSelectedProducts();

  setStatus("All selected products cleared.");
});

/* ==========================================
   FORMAT PRODUCT DATA FOR AI
   ========================================== */

function formatProducts(products) {
  return products.map((product) => ({
    id: product.id,
    name: product.name,
    brand: product.brand,
    category: product.category,
    description: product.description,
  }));
}

// Read text from both OpenAI and simple Worker response formats.
function extractReply(data) {
  const directReply =
    data.reply ||
    data.response ||
    data.answer ||
    data.output_text ||
    data.message?.content ||
    data.choices?.[0]?.message?.content;

  if (typeof directReply === "string") {
    return directReply;
  }

  if (Array.isArray(directReply)) {
    return directReply
      .map((part) => (typeof part === "string" ? part : part.text))
      .filter(Boolean)
      .join("\n\n");
  }

  if (Array.isArray(data.output)) {
    return data.output
      .filter((item) => item.type === "message")
      .flatMap((item) => item.content || [])
      .map((part) => (typeof part === "string" ? part : part.text))
      .filter(Boolean)
      .join("\n\n");
  }

  return "";
}

/* ==========================================
   DISPLAY CHAT MESSAGES
   ========================================== */

function addChatMessage(role, message, citations = []) {
  const messageElement = createElement(
    "div",
    role === "user" ? "message message-user" : "message message-assistant",
  );

  const label = createElement(
    "div",
    "message-label",
    role === "user" ? "YOU" : "YOUR ADVISOR",
  );

  const content = createElement("div", "message-content", message);

  messageElement.append(label, content);

  // Display links returned by web search
  const validCitations = citations.filter(
    (source) => source && safeUrl(source.url),
  );

  if (validCitations.length > 0) {
    const sourcesContainer = createElement("div", "message-sources");

    validCitations.forEach((source, index) => {
      const link = document.createElement("a");

      link.href = safeUrl(source.url);
      link.target = "_blank";
      link.rel = "noopener noreferrer";

      link.textContent = source.title || `Source ${index + 1}`;

      sourcesContainer.appendChild(link);
    });

    messageElement.appendChild(sourcesContainer);
  }

  chatWindow.appendChild(messageElement);

  chatWindow.scrollTop = chatWindow.scrollHeight;

  return messageElement;
}

/* ==========================================
   LOADING STATE
   ========================================== */

function setLoading(loading) {
  isLoading = loading;

  userInput.disabled = loading;
  sendBtn.disabled = loading;

  updateSelectedProducts();

  generateBtn.textContent = loading
    ? "Generating your routine..."
    : "✦ Generate my routine ↗";
}

/* ==========================================
   CONNECT TO YOUR CLOUDFLARE WORKER
   ========================================== */

async function sendToAI(message, mode, products) {
  // Include selected product data in the conversation.
  // This helps compatibility with older Workers that
  // only forward a "messages" array to OpenAI.

  const productData = formatProducts(products);

  let finalMessage = message;

  if (mode === "generate") {
    finalMessage += `

Selected product data (JSON):
${JSON.stringify(productData, null, 2)}

IMPORTANT:
Create the routine using ONLY these selected products.
Do not invent additional selected products.
`;
  }

  const messages = [
    ...conversationHistory,
    {
      role: "user",
      content: finalMessage,
    },
  ];

  // Send the full conversation and selected products
  const response = await fetch(WORKER_URL, {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify({
      mode: mode,
      messages: messages,
      selectedProducts: productData,
      useWebSearch: webSearchToggle.checked,
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.error?.message || data.error || `Worker error: ${response.status}`,
    );
  }

  // Support common Worker response formats
  const reply = extractReply(data);

  if (!reply || typeof reply !== "string") {
    throw new Error(
      "Worker returned no readable response. Check your Worker's response format.",
    );
  }

  // Support source citations from an updated Worker
  const citations = Array.isArray(data.citations) ? data.citations : [];

  return {
    reply,
    citations,
    sentMessage: finalMessage,
  };
}

/* ==========================================
   PROCESS AI REQUESTS
   ========================================== */

async function processAIRequest(message, mode, products) {
  if (isLoading) {
    return;
  }

  setLoading(true);

  setStatus("Consulting your beauty advisor...");

  const displayMessage =
    mode === "generate"
      ? `Generate my personalized routine using ${products.length} selected products.`
      : message;

  addChatMessage("user", displayMessage);

  const pendingMessage = addChatMessage(
    "assistant",
    "Creating your personalized response...",
  );

  try {
    const result = await sendToAI(message, mode, products);

    pendingMessage.remove();

    addChatMessage("assistant", result.reply, result.citations);

    // Remember conversation history for follow-up chat
    conversationHistory.push(
      {
        role: "user",
        content: result.sentMessage,
      },
      {
        role: "assistant",
        content: result.reply,
      },
    );

    setStatus("Your advisor is ready for follow-up questions.");
  } catch (error) {
    pendingMessage.remove();

    console.error("AI request failed:", error);

    addChatMessage(
      "assistant",
      `Sorry, I couldn't complete that request. ${error.message}`,
    );

    setStatus(error.message, true);
  } finally {
    setLoading(false);
    userInput.focus();
  }
}

/* ==========================================
   GENERATE PERSONALIZED ROUTINE
   ========================================== */

generateBtn.addEventListener("click", () => {
  if (isLoading) {
    return;
  }

  const selectedProducts = getSelectedProducts();

  if (selectedProducts.length === 0) {
    setStatus("Please select at least one product first.", true);

    return;
  }

  // Store the products used in this routine
  routineProducts = [...selectedProducts];

  // Clear conversation when starting a new routine
  conversationHistory = [];
  chatWindow.replaceChildren();

  const prompt = `
You are an expert beauty routine advisor.

Create a personalized beauty routine using the
selected L'Oréal-family products provided below.

Requirements:

1. Create a morning routine when appropriate.
2. Create an evening routine when appropriate.
3. Explain the application order.
4. Explain how frequently each product should be used.
5. Explain the benefits of each product.
6. Identify any ingredients that should not be combined.
7. Include safety tips for skincare products.
8. Organize haircare, makeup, fragrance, and grooming
   separately when applicable.
9. Use only the selected products in the routine.
10. Do not invent products.
11. Ask one helpful follow-up question.

Make the routine easy to understand using clear headings
and numbered steps.
`;

  processAIRequest(prompt, "generate", routineProducts);
});

/* ==========================================
   FOLLOW-UP CHAT
   ========================================== */

chatForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const message = userInput.value.trim();

  if (!message || isLoading) {
    return;
  }

  const chatProducts =
    routineProducts.length > 0 ? routineProducts : getSelectedProducts();

  if (chatProducts.length === 0) {
    setStatus("Please select at least one product before chatting.", true);
    addChatMessage(
      "assistant",
      "Choose at least one product above, then ask me about it.",
    );
    return;
  }

  userInput.value = "";

  processAIRequest(message, "chat", chatProducts);
});

/* ==========================================
   PRODUCT SEARCH AND CATEGORY FILTER
   ========================================== */

categoryFilter.addEventListener("change", () => {
  displayProducts();
});

productSearch.addEventListener("input", () => {
  displayProducts();
});

/* ==========================================
   INITIALIZE APPLICATION
   ========================================== */

loadProducts();
