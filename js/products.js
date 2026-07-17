// 토스페이먼츠 공식 샘플 저장소(tosspayments/tosspayments-sample)에 공개된 테스트 클라이언트 키.
const TOSS_CLIENT_KEY = "test_ck_D5GePWvyJnrK0W0k6q8gLzN97Eoq";

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
      <div class="card">
        <img src="${p.image_url}" alt="${p.name}">
        <h3>${p.name}</h3>
        <p>${p.description ?? ""}</p>
        <p class="price">${p.price.toLocaleString()}원</p>
        <button class="primary" data-id="${p.id}">구매하기</button>
      </div>
    `
    )
    .join("");

  grid.querySelectorAll("button[data-id]").forEach((btn) => {
    btn.addEventListener("click", () => buyProduct(btn.dataset.id, data));
  });
}

async function buyProduct(productId, products) {
  const session = await getSession();
  if (!session) {
    window.location.href = "login.html";
    return;
  }

  const product = products.find((p) => p.id === productId);
  if (!product) return;

  const tossOrderId = crypto.randomUUID();

  const { error: insertError } = await sb.from("orders").insert({
    user_id: session.user.id,
    user_email: session.user.email,
    product_id: product.id,
    order_name: product.name,
    amount: product.price,
    toss_order_id: tossOrderId,
    status: "pending",
  });

  if (insertError) {
    errorMsg.textContent = "주문 생성 실패: " + insertError.message;
    return;
  }

  const tossPayments = TossPayments(TOSS_CLIENT_KEY);
  const payment = tossPayments.payment({ customerKey: session.user.id });

  try {
    await payment.requestPayment({
      method: "CARD",
      amount: { currency: "KRW", value: product.price },
      orderId: tossOrderId,
      orderName: product.name,
      successUrl: new URL("payment-success.html", window.location.href).href,
      failUrl: new URL("payment-fail.html", window.location.href).href,
      customerEmail: session.user.email,
    });
  } catch (e) {
    errorMsg.textContent = "결제 요청이 취소되었거나 실패했습니다.";
  }
}

loadProducts();
