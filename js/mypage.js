const STATUS_LABELS = {
  pending: "결제대기",
  paid: "결제완료",
  failed: "결제실패",
  canceled: "취소됨",
};

async function loadOrders(session) {
  const { data, error } = await sb
    .from("orders")
    .select("*")
    .eq("user_id", session.user.id)
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
        <td>${o.order_name}</td>
        <td>${o.amount.toLocaleString()}원</td>
        <td class="status-${o.status}">${STATUS_LABELS[o.status] ?? o.status}</td>
        <td>${new Date(o.created_at).toLocaleString("ko-KR")}</td>
      </tr>
    `
    )
    .join("");
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

async function initPushSettings(session) {
  const card = document.getElementById("push-card");
  const statusMsg = document.getElementById("push-status-msg");
  const enableBtn = document.getElementById("push-enable-btn");
  const testBtn = document.getElementById("push-test-btn");

  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return;
  }
  card.style.display = "block";

  if (Notification.permission === "denied") {
    statusMsg.textContent =
      "알림 권한이 차단되어 있습니다. 브라우저 설정에서 이 사이트의 알림 권한을 허용한 뒤 다시 시도해주세요.";
    statusMsg.className = "error";
    return;
  }

  const registration = await navigator.serviceWorker.ready;
  const existingSub = await registration.pushManager.getSubscription();

  async function subscribe() {
    try {
      const sub =
        existingSub ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        }));
      const json = sub.toJSON();
      const { error } = await sb.from("push_subscriptions").upsert(
        {
          user_id: session.user.id,
          endpoint: json.endpoint,
          p256dh: json.keys.p256dh,
          auth: json.keys.auth,
        },
        { onConflict: "endpoint" }
      );
      if (error) throw error;

      statusMsg.textContent = "알림 구독 완료! 이제 테스트 알림을 받아볼 수 있습니다.";
      statusMsg.className = "message";
      enableBtn.style.display = "none";
      testBtn.style.display = "inline-block";
    } catch (e) {
      statusMsg.textContent = "알림 구독 실패: " + (e.message ?? String(e));
      statusMsg.className = "error";
    }
  }

  if (Notification.permission === "granted" && existingSub) {
    statusMsg.textContent = "알림 구독이 되어 있습니다.";
    statusMsg.className = "message";
    testBtn.style.display = "inline-block";
  } else if (Notification.permission === "granted") {
    await subscribe();
  } else {
    enableBtn.style.display = "inline-block";
    enableBtn.addEventListener("click", async () => {
      const permission = await Notification.requestPermission();
      if (permission === "denied") {
        statusMsg.textContent =
          "알림 권한이 차단되어 있습니다. 브라우저 설정에서 이 사이트의 알림 권한을 허용한 뒤 다시 시도해주세요.";
        statusMsg.className = "error";
        return;
      }
      if (permission === "granted") {
        await subscribe();
      }
    });
  }

  testBtn.addEventListener("click", async () => {
    const { error } = await sb.functions.invoke("send-push");
    if (error) {
      statusMsg.textContent = "테스트 알림 전송 실패: " + (error.message ?? String(error));
      statusMsg.className = "error";
      return;
    }
    statusMsg.textContent = "테스트 알림 전송 완료!";
    statusMsg.className = "message";
  });
}

async function init() {
  const session = await requireLogin();
  if (!session) return;
  await loadOrders(session);
  await initPushSettings(session);
}

init();
