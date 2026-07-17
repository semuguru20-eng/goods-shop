# 아키텍처 상세

## 전체 구조

```
[브라우저: 정적 HTML/CSS/JS, GitHub Pages]
        │  supabase-js (anon key)
        ▼
[Supabase Auth + Postgres (RLS)]
        │
        ▼
[Supabase Edge Function: confirm-payment]  ← 유일한 "서버" 코드
        │  Basic Auth (TOSS_SECRET_KEY)
        ▼
[Toss Payments API]
```

GitHub Pages는 정적 파일만 서빙하므로 서버 로직이 없다. 따라서:
- 인증/조회/입력은 클라이언트에서 supabase-js로 Supabase에 직접 접근 (RLS로 접근 제어)
- 토스 시크릿 키가 필요한 "결제 승인" 단계만 Supabase Edge Function이 서버 역할 수행

## 폴더 구조

```
goods-shop/
├── index.html             → products.html로 리다이렉트
├── login.html / js/login.js
├── products.html / js/products.js
├── payment-success.html / js/payment-result.js
├── payment-fail.html
├── mypage.html / js/mypage.js
├── admin.html / js/admin.js
├── js/supabaseClient.js   (Supabase URL + anon key)
├── js/auth.js             (세션 확인, 네비게이션, 로그아웃, requireLogin/requireAdmin)
├── css/style.css
└── supabase/
    ├── config.toml
    ├── migrations/        (products, orders 테이블 + RLS)
    ├── seed.sql
    └── functions/confirm-payment/index.ts
```

## DB 스키마

```sql
products (id, name, description, price, image_url, created_at)
orders (
  id, user_id, user_email, product_id, order_name, amount,
  toss_order_id (unique), toss_payment_key,
  status: pending | paid | failed | canceled,
  created_at, paid_at
)
```

### RLS 정책
- `products`: 누구나 `select` 가능 (읽기 전용, insert/update/delete 정책 없음 → 클라이언트는 상품 추가/수정 불가)
- `orders`:
  - `select`: 본인 행(`auth.uid() = user_id`) 또는 관리자(`auth.jwt() ->> 'email' = 'admin@admin.com'`)
  - `insert`: 본인 행 + `status = 'pending'`인 경우만 허용
  - **update/delete는 클라이언트 role에 전혀 부여되지 않음** — 주문 상태 변경은 오직
    Edge Function이 `service_role` 키로 수행 (RLS 우회). 즉 클라이언트가 자기 주문을
    직접 "결제완료"로 조작하는 것이 원천 차단됨.
- 관리자 판별은 별도 role 테이블 없이 이메일 하드코딩. 프론트엔드(`requireAdmin()`)의
  체크는 UI 노출 제어용일 뿐이며, 실제 데이터 보호는 RLS가 담당.

## 결제 흐름 (Toss Payments v2 SDK, 테스트 모드)

1. `products.js`: 로그인 확인 → `orders`에 `status='pending'` 행 insert (토스에 보낼 `orderId`는
   `crypto.randomUUID()`로 생성)
2. `payment.requestPayment({ method: "CARD", amount, orderId, orderName, successUrl, failUrl, customerEmail })` 호출
   → 토스 결제창 표시
3. 결제 성공 시 토스가 `payment-success.html?paymentKey=...&orderId=...&amount=...`로 리다이렉트
4. `payment-result.js`가 로그인 세션의 access token을 실어 Edge Function `confirm-payment` 호출
   (`supabase.functions.invoke`는 Authorization 헤더에 자동으로 현재 세션 토큰을 포함시킴)
5. Edge Function 내부 처리:
   - Authorization 토큰으로 사용자 신원 확인 (`admin.auth.getUser(token)`)
   - `toss_order_id`로 주문 조회, 본인 소유·`pending` 상태인지 확인
   - **`order.product_id`로 실제 상품 가격을 다시 조회하여, 클라이언트가 보낸 금액이
     상품 원가와 정확히 일치하는지 검증** (주문 생성 시 클라이언트가 보낸 `amount`는
     조작 가능하므로 신뢰하지 않고, 상품 테이블을 유일한 가격 근거로 삼음)
   - Toss `POST /v1/payments/confirm` 호출 (`Authorization: Basic base64(시크릿키:)`)
   - 성공 시 `service_role`로 주문을 `status='paid'`로 업데이트
6. 실패 시 `payment-fail.html`에서 토스가 전달한 `code`/`message`를 표시 (DB 상태는
   변경하지 않음 — 실제 결제가 이뤄지지 않았기 때문)

## 필요한 시크릿 (값은 이 문서에 기록하지 않음)
- `TOSS_SECRET_KEY` — `supabase secrets set TOSS_SECRET_KEY=test_sk_...`로 설정,
  Edge Function에서만 사용, 절대 프론트엔드 코드에 넣지 않음
- Supabase `service_role` 키 — Edge Function 실행 환경에 `SUPABASE_SERVICE_ROLE_KEY`로
  자동 주입됨 (별도 설정 불필요)
- 프론트엔드에 포함된 Supabase URL / anon key / Toss client key는 모두 "공개되어도
  안전하도록 설계된" 값 (실제 보안 경계는 RLS와 시크릿 키 분리)

## 알려진 단순화 지점
- 결제 실패 시 주문을 `failed`로 마킹하지 않고 `pending`으로 남겨둠 (클라이언트에
  update 권한이 없어서 의도적으로 단순화; 재구매 시 새 주문 행이 생성되므로 실사용에 문제 없음)
- 결제 수단은 `CARD` 카드 결제만 지원 (계좌이체/가상계좌 등은 미구현)
- 관리자 역할은 이메일 하드코딩 방식 (다중 관리자가 필요해지면 `is_admin` 컬럼이 있는
  `profiles` 테이블로 전환 권장)
