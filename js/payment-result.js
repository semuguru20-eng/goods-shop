const title = document.getElementById("title");
const detail = document.getElementById("detail");
const errorMsg = document.getElementById("error-msg");
const mypageLink = document.getElementById("mypage-link");

async function confirmPayment() {
  const params = new URLSearchParams(window.location.search);
  const paymentKey = params.get("paymentKey");
  const orderId = params.get("orderId");
  const amount = params.get("amount");

  const session = await getSession();
  if (!session) {
    title.textContent = "로그인이 필요합니다.";
    return;
  }

  const { data, error } = await supabase.functions.invoke("confirm-payment", {
    body: { paymentKey, orderId, amount: Number(amount) },
  });

  if (error) {
    title.textContent = "결제 승인에 실패했습니다.";
    errorMsg.textContent = error.message ?? String(error);
    return;
  }

  title.textContent = "결제가 완료되었습니다!";
  detail.textContent = `주문번호: ${orderId} / 결제금액: ${Number(amount).toLocaleString()}원`;
  mypageLink.style.display = "inline";
}

confirmPayment();
