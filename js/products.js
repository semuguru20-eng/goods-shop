const grid = document.getElementById("product-grid");
const errorMsg = document.getElementById("error-msg");

async function loadProducts() {
  const { data, error } = await sb
    .from("products")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    errorMsg.textContent = "상품을 불러오지 못했습니다: " + error.message;
    return;
  }

  grid.innerHTML = data
    .map(
      (p) => `
      <a class="card product-card" href="product.html?id=${p.id}">
        <img src="${p.image_url}" alt="${p.name}">
        <h3>${p.name}</h3>
        <p>${p.description ?? ""}</p>
        <p class="price">${p.price.toLocaleString()}원</p>
      </a>
    `
    )
    .join("");
}

loadProducts();
