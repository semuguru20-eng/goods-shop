-- 참고: 실제 상품 이미지는 supabase/migrations/20260718000003_inline_svg_images.sql 에서
-- 외부 이미지 서비스 의존성 없이 인라인 SVG(data URI)로 교체되어 있다.
insert into public.products (name, description, price, image_url) values
  ('스티커 세트', '귀여운 캐릭터 스티커 5매 세트', 5000, 'https://placehold.co/300x300?text=Sticker'),
  ('에코백', '튼튼한 캔버스 에코백', 15000, 'https://placehold.co/300x300?text=Eco+Bag'),
  ('텀블러', '보온보냉 스테인리스 텀블러', 22000, 'https://placehold.co/300x300?text=Tumbler'),
  ('키링', '아크릴 키링', 8000, 'https://placehold.co/300x300?text=Keyring'),
  ('후드티', '기본 로고 후드티', 39000, 'https://placehold.co/300x300?text=Hoodie');
