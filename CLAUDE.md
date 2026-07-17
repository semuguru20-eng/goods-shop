# 굿즈샵 (goods-shop)

작은 굿즈 판매 테스트 사이트. 정적 프론트엔드(GitHub Pages) + Supabase(인증/DB/Edge Function)
+ 토스페이먼츠 테스트 결제로 구성.

## 라이브 사이트
https://semuguru20-eng.github.io/goods-shop/

## 페이지 구성
- `login.html` — 회원가입 / 로그인 (이메일+비밀번호, 이메일 인증 없이 즉시 로그인)
- `products.html` — 상품 목록, 구매 버튼 → 토스 결제창 호출
- `payment-success.html` / `payment-fail.html` — 토스 결제 리다이렉트 처리
- `mypage.html` — 로그인한 본인의 결제 내역
- `admin.html` — `admin@admin.com` 계정 전용, 전체 사용자 결제 내역

## 기술 스택
- 프론트엔드: 순수 HTML/CSS/JS (프레임워크 없음), GitHub Pages 정적 호스팅
- 백엔드: Supabase (Auth, Postgres + RLS, Edge Functions)
- 결제: 토스페이먼츠 SDK v2 (standard), 테스트 모드

## 계정 정보
- 관리자: `admin@admin.com` (비밀번호는 별도 관리, 이 문서에는 기록하지 않음)
- 일반 회원: 사이트에서 자유롭게 가입 가능 (이메일 인증 없음)

## Supabase 프로젝트
- 프로젝트명: `supabase-test`
- Project Ref: `bgybaskntgqxumuayoti` (서울 리전)
- 로컬에서 CLI로 이미 `supabase link` 되어 있음

## 배포 방법
- 프론트엔드: `git push` 하면 GitHub Pages가 자동으로 반영 (몇 초~1분 소요)
- DB 스키마 변경: `supabase/migrations/`에 새 SQL 파일 추가 후 `supabase db push`
- Edge Function 변경: `supabase functions deploy confirm-payment`
- Auth 설정 변경: `supabase/config.toml` 수정 후 `supabase config push`

## 상세 아키텍처
DB 스키마, RLS 정책, 결제 흐름 시퀀스는 [ARCH.md](./ARCH.md) 참고.
