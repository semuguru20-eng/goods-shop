import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { paymentKey, orderId, amount } = await req.json();

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ message: "인증에 실패했습니다." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: order, error: orderErr } = await admin
      .from("orders")
      .select("*")
      .eq("toss_order_id", orderId)
      .single();

    if (orderErr || !order) {
      return new Response(JSON.stringify({ message: "주문을 찾을 수 없습니다." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (order.user_id !== userData.user.id) {
      return new Response(JSON.stringify({ message: "본인의 주문이 아닙니다." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (order.status !== "pending") {
      return new Response(JSON.stringify({ message: "이미 처리된 주문입니다." }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 클라이언트가 주문 생성 시 보낸 amount는 조작될 수 있으므로,
    // 실제 결제 승인 금액은 반드시 상품 테이블의 원본 가격과 대조한다.
    const { data: product, error: productErr } = await admin
      .from("products")
      .select("price")
      .eq("id", order.product_id)
      .single();

    if (productErr || !product) {
      return new Response(JSON.stringify({ message: "상품 정보를 찾을 수 없습니다." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (Number(amount) !== product.price || order.amount !== product.price) {
      return new Response(JSON.stringify({ message: "결제 금액이 상품 가격과 일치하지 않습니다." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const secretKey = Deno.env.get("TOSS_SECRET_KEY")!;
    const encryptedSecretKey = "Basic " + btoa(secretKey + ":");

    const tossRes = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
      method: "POST",
      headers: {
        Authorization: encryptedSecretKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    });
    const tossResult = await tossRes.json();

    if (!tossRes.ok) {
      await admin.from("orders").update({ status: "failed" }).eq("id", order.id);
      return new Response(JSON.stringify(tossResult), {
        status: tossRes.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await admin
      .from("orders")
      .update({ status: "paid", toss_payment_key: paymentKey, paid_at: new Date().toISOString() })
      .eq("id", order.id);

    return new Response(JSON.stringify({ success: true, payment: tossResult }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ message: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
