const params = new URLSearchParams(window.location.search);
const productId = params.get("id");

const hero = document.getElementById("hero");
const errorMsg = document.getElementById("error-msg");

let currentProduct = null;

async function loadProduct() {
  if (!productId) {
    errorMsg.textContent = "잘못된 접근입니다. 상품 목록에서 다시 시도해주세요.";
    return;
  }

  const { data: product, error } = await sb
    .from("products")
    .select("*")
    .eq("id", productId)
    .single();

  if (error || !product) {
    errorMsg.textContent = "상품을 불러오지 못했습니다.";
    return;
  }

  currentProduct = product;
  document.title = product.name + " - 굿즈샵";

  const img = document.getElementById("detail-image");
  img.src = product.image_url;
  img.alt = product.name;
  document.getElementById("detail-name").textContent = product.name;
  document.getElementById("detail-price").textContent = product.price.toLocaleString() + "원";
  document.getElementById("detail-description").textContent = product.description ?? "";
  hero.style.display = "flex";

  document.getElementById("buy-btn").addEventListener("click", buyProduct);
}

async function buyProduct() {
  if (!currentProduct) return;

  const session = await getSession();
  if (!session) {
    window.location.href = "login.html";
    return;
  }

  const tossOrderId = crypto.randomUUID();

  const { error: insertError } = await sb.from("orders").insert({
    user_id: session.user.id,
    user_email: session.user.email,
    product_id: currentProduct.id,
    order_name: currentProduct.name,
    amount: currentProduct.price,
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
      amount: { currency: "KRW", value: currentProduct.price },
      orderId: tossOrderId,
      orderName: currentProduct.name,
      successUrl: new URL("payment-success.html", window.location.href).href,
      failUrl: new URL("payment-fail.html", window.location.href).href,
      customerEmail: session.user.email,
    });
  } catch (e) {
    errorMsg.textContent = "결제 요청이 취소되었거나 실패했습니다.";
  }
}

loadProduct();
