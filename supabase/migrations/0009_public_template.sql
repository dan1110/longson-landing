-- Lấy mẫu tin nhắn xác nhận cho trang landing (anon) — để sale copy gửi khách.
create or replace function public_template()
returns text
language sql stable security definer set search_path = public as $$
  select body from message_templates where name = 'confirm' limit 1
$$;
grant execute on function public_template() to anon;
