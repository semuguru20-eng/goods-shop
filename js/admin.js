const STATUS_LABELS = {
  pending: "결제대기",
  paid: "결제완료",
  failed: "결제실패",
  canceled: "취소됨",
};

async function loadAllOrders() {
  const session = await requireAdmin();
  if (!session) return;

  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });

  const body = document.getElementById("orders-body");
  const emptyMsg = document.getElementById("empty-msg");

  if (error || !data || data.length === 0) {
    emptyMsg.style.display = "block";
    return;
  }

  body.innerHTML = data
    .map(
      (o) => `
      <tr>
        <td>${o.user_email}</td>
        <td>${o.order_name}</td>
        <td>${o.amount.toLocaleString()}원</td>
        <td class="status-${o.status}">${STATUS_LABELS[o.status] ?? o.status}</td>
        <td>${new Date(o.created_at).toLocaleString("ko-KR")}</td>
      </tr>
    `
    )
    .join("");
}

loadAllOrders();
