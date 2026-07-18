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

## PWA (Progressive Web App)

사이트 전체가 PWA로 동작한다. 모바일 브라우저에서 홈 화면에 설치할 수 있고,
정적 리소스는 오프라인에서도 열린다. 백엔드(Supabase/Toss)는 이 확장과 무관하게
그대로 사용한다.

- `manifest.webmanifest` — 앱 이름("TuringShop", 홈 화면 설치 라벨 전용 — 페이지 내부
  표기는 계속 "굿즈샵")/아이콘/테마 색/`start_url`(=`products.html`) 정의.
  `display: "standalone"`을 안전한 기본값으로 유지하고 `display_override:
  ["fullscreen", "standalone"]`로 지원 플랫폼에서만 기회적으로 풀스크린 사용 (결제
  리다이렉트 중 시스템 UI가 완전히 사라지는 위험을 피하기 위한 결정). 모든 페이지
  `<head>`에서 `<link rel="manifest">`로 연결.
- `sw.js` — 서비스 워커. 같은 출처(same-origin)의 정적 리소스(HTML/CSS/JS/아이콘)만
  캐시하고, Supabase·Toss·CDN 등 외부 요청은 절대 가로채지 않는다(`fetch` 핸들러에서
  origin이 다르면 그냥 통과). 페이지 이동(navigate)은 네트워크 우선 + 오프라인 시
  캐시 폴백, 정적 자산은 캐시 우선 + 백그라운드 네트워크 갱신. 캐시 이름은
  `CACHE_NAME`(`goods-shop-v2`) 하나로 관리하며, 정적 자산 목록을 바꾸면(새 페이지
  추가 등) 이 상수를 올려서 이전 캐시를 정리한다. `push`/`notificationclick` 이벤트
  리스너도 이 파일에 포함(아래 푸시 알림 절 참고).
- `js/pwa.js` — 모든 페이지에 공통으로 로드되는 서비스 워커 등록 스크립트
  (`navigator.serviceWorker.register("sw.js")`).
- `js/install-banner.js` — 모바일 첫 방문 시 "홈 화면에 추가" 배너. Android/Chrome은
  `beforeinstallprompt`를 캡처해 네이티브 설치 프롬프트를 띄우고, iOS Safari는
  안내 문구만 표시(`beforeinstallprompt` 미지원). 이미 standalone으로 실행 중이거나
  localStorage에 dismiss 기록이 있으면 표시하지 않는다. `index.html`(즉시 리다이렉트
  스텁)에는 넣지 않음.
- `icons/` — `icon-192.png`, `icon-512.png`(설치 아이콘, `any`+`maskable` 겸용),
  `apple-touch-icon.png`(iOS 홈 화면), `favicon.png`. 선물 상자 모티프, 사이트 색상
  변수(`--card`, `--bg`, `--accent`, `--text`)로만 구성. `scripts/generate-icons.ps1`
  (PowerShell + `System.Drawing`)로 재생성 가능.
- 노치/홈 인디케이터 대응: 모든 페이지 viewport에 `viewport-fit=cover`, `header`와
  `.install-banner`에 `env(safe-area-inset-*)` 패딩 적용.
- 새 페이지를 추가할 때는 `PRECACHE_URLS`(`sw.js`)와 `signup.html` 템플릿의 PWA
  태그를 그대로 유지해서 캐시 대상에서 빠지지 않게 한다.

### 푸시 알림 (Web Push)

동의 UI + 테스트 발송 버튼까지 구현됨. 실제 비즈니스 이벤트(결제 완료 등)와의 자동
연동은 하지 않음 — 아래 "향후 과제" 참고.

- DB: `push_subscriptions`(user_id, endpoint unique, p256dh, auth) — RLS는 `orders`와
  동일하게 `auth.uid() = user_id`만 select/insert/update/delete 허용. update 정책은
  재구독 시 `upsert(onConflict: endpoint)` 충돌 처리를 위해 추가.
- Edge Function `send-push` — `confirm-payment`와 동일한 인증 패턴(`admin.auth.getUser`).
  호출자 본인의 구독 행만 조회해 `npm:web-push`로 발송(Deno의 `npm:` 스펙 지원 활용,
  VAPID 서명/암호화를 직접 구현하지 않음). 410/404 응답을 받은 구독은 자동 삭제.
- 클라이언트: `mypage.html`의 "알림 설정" 카드에서 `Notification.requestPermission()`
  (사용자 클릭 안에서 호출) → `pushManager.subscribe()` → `push_subscriptions`에 upsert.
  "테스트 알림 보내기"는 `sb.functions.invoke("send-push")`를 호출자 본인 대상으로만 호출.
- `sw.js`의 `push`/`notificationclick` 리스너가 실제 알림 표시/클릭 처리 담당.
- **향후 과제(미구현)**: 관리자 전체 발송, 실제 이벤트(결제 완료 등) 발생 시
  `confirm-payment`가 `send-push`를 자동 호출하도록 연동.
- **알려진 단순화**: 같은 기기에서 다른 계정으로 재로그인 후 구독 갱신 시, 기존 구독
  행이 이전 계정 소유라 RLS update 정책에 막혀 실패할 수 있음 — 개인 테스트 버튼
  범위에서는 허용 가능한 단순화로 남겨둠.

## 필요한 시크릿 (값은 이 문서에 기록하지 않음)
- `TOSS_SECRET_KEY` — `supabase secrets set TOSS_SECRET_KEY=test_sk_...`로 설정,
  Edge Function에서만 사용, 절대 프론트엔드 코드에 넣지 않음
- Supabase `service_role` 키 — Edge Function 실행 환경에 `SUPABASE_SERVICE_ROLE_KEY`로
  자동 주입됨 (별도 설정 불필요)
- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` — Web Push 발신자 키. `supabase secrets set
  VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=...`로 설정, `send-push` Edge Function에서만
  사용. 공개키는 비밀이 아니므로 `js/config.js`에도 상수로 포함(발급된 값으로 반드시
  교체 — 저장소에는 `REPLACE_WITH_GENERATED_VAPID_PUBLIC_KEY` 플레이스홀더가 커밋되어
  있을 수 있음)
- 프론트엔드에 포함된 Supabase URL / anon key / Toss client key는 모두 "공개되어도
  안전하도록 설계된" 값 (실제 보안 경계는 RLS와 시크릿 키 분리)

## 알려진 단순화 지점
- 결제 실패 시 주문을 `failed`로 마킹하지 않고 `pending`으로 남겨둠 (클라이언트에
  update 권한이 없어서 의도적으로 단순화; 재구매 시 새 주문 행이 생성되므로 실사용에 문제 없음)
- 결제 수단은 `CARD` 카드 결제만 지원 (계좌이체/가상계좌 등은 미구현)
- 관리자 역할은 이메일 하드코딩 방식 (다중 관리자가 필요해지면 `is_admin` 컬럼이 있는
  `profiles` 테이블로 전환 권장)
