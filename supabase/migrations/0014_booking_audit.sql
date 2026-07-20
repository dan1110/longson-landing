-- ── Lịch sử sửa đơn: ai, lúc nào, đổi gì ───────────────────────────
-- Ghi ở TẦNG DATABASE (trigger) chứ không ở code app, để mọi đường ghi
-- đều bị bắt: server action, RPC public của sale, sửa tay trong SQL editor.
--
-- CỐ Ý KHÔNG có foreign key tới bookings: xóa hẳn đơn thì lịch sử vẫn
-- phải còn lại để biết ai đã xóa và đơn đó vốn là của khách nào.

create table if not exists booking_audit (
  id           bigserial primary key,
  booking_id   uuid,                 -- không FK (xem ghi chú trên)
  booking_code text,
  action       text not null check (action in ('created', 'updated', 'deleted')),
  changes      jsonb not null default '{}'::jsonb,  -- {cột: [giá trị cũ, giá trị mới]}
  actor_id     uuid,
  actor_name   text,
  created_at   timestamptz not null default now()
);

create index if not exists booking_audit_booking_idx
  on booking_audit (booking_id, created_at desc);

/**
 * Ghi 1 dòng lịch sử cho mỗi lần đơn thay đổi.
 * Với UPDATE chỉ ghi những cột THỰC SỰ đổi; không đổi gì thì không ghi,
 * tránh rác khi app gọi update mà giá trị y hệt.
 */
create or replace function log_booking_change()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_actor   uuid := auth.uid();
  v_name    text;
  v_changes jsonb := '{}'::jsonb;
  v_action  text;
  v_id      uuid;
  v_code    text;
begin
  select name into v_name from profiles where id = v_actor;

  if TG_OP = 'INSERT' then
    v_action := 'created';
    v_id     := new.id;
    v_code   := new.code;

  elsif TG_OP = 'DELETE' then
    v_action := 'deleted';
    v_id     := old.id;
    v_code   := old.code;
    -- Lưu ảnh chụp đơn bị xóa để còn truy lại được.
    v_changes := jsonb_build_object(
      'snapshot', to_jsonb(old) - 'id'
    );

  else
    v_action := 'updated';
    v_id     := new.id;
    v_code   := new.code;

    -- So từng cột quan trọng. NULL-safe nhờ "is distinct from".
    if new.checkin_date    is distinct from old.checkin_date    then v_changes := v_changes || jsonb_build_object('checkin_date',    jsonb_build_array(old.checkin_date,    new.checkin_date));    end if;
    if new.checkout_date   is distinct from old.checkout_date   then v_changes := v_changes || jsonb_build_object('checkout_date',   jsonb_build_array(old.checkout_date,   new.checkout_date));   end if;
    if new.price_per_night is distinct from old.price_per_night then v_changes := v_changes || jsonb_build_object('price_per_night', jsonb_build_array(old.price_per_night, new.price_per_night)); end if;
    if new.deposit_amount  is distinct from old.deposit_amount  then v_changes := v_changes || jsonb_build_object('deposit_amount',  jsonb_build_array(old.deposit_amount,  new.deposit_amount));  end if;
    if new.guests_adult    is distinct from old.guests_adult    then v_changes := v_changes || jsonb_build_object('guests_adult',    jsonb_build_array(old.guests_adult,    new.guests_adult));    end if;
    if new.guests_child    is distinct from old.guests_child    then v_changes := v_changes || jsonb_build_object('guests_child',    jsonb_build_array(old.guests_child,    new.guests_child));    end if;
    if new.status          is distinct from old.status          then v_changes := v_changes || jsonb_build_object('status',          jsonb_build_array(old.status,          new.status));          end if;
    if new.unit_id         is distinct from old.unit_id         then v_changes := v_changes || jsonb_build_object('unit_id',         jsonb_build_array(old.unit_id,         new.unit_id));         end if;
    if new.customer_id     is distinct from old.customer_id     then v_changes := v_changes || jsonb_build_object('customer_id',     jsonb_build_array(old.customer_id,     new.customer_id));     end if;
    if new.sale_id         is distinct from old.sale_id         then v_changes := v_changes || jsonb_build_object('sale_id',         jsonb_build_array(old.sale_id,         new.sale_id));         end if;
    if new.note            is distinct from old.note            then v_changes := v_changes || jsonb_build_object('note',            jsonb_build_array(old.note,            new.note));            end if;
    if new.code            is distinct from old.code            then v_changes := v_changes || jsonb_build_object('code',            jsonb_build_array(old.code,            new.code));            end if;

    -- Không có gì đổi (vd chỉ đụng hold_expires_at) → bỏ qua.
    if v_changes = '{}'::jsonb then
      return new;
    end if;
  end if;

  insert into booking_audit (booking_id, booking_code, action, changes, actor_id, actor_name)
  values (v_id, v_code, v_action, v_changes, v_actor, coalesce(v_name, 'Hệ thống'));

  if TG_OP = 'DELETE' then
    return old;
  end if;
  return new;
end $$;

drop trigger if exists trg_booking_audit on bookings;
create trigger trg_booking_audit
  after insert or update or delete on bookings
  for each row execute function log_booking_change();

-- ── RLS: chỉ owner/manager ĐỌC, không ai sửa/xóa được lịch sử ───────
alter table booking_audit enable row level security;

drop policy if exists audit_read on booking_audit;
create policy audit_read on booking_audit for select
  using (my_role() in ('owner', 'manager'));
-- Cố ý KHÔNG tạo policy insert/update/delete: trigger chạy security definer
-- nên vẫn ghi được, còn client thì không thể sửa lịch sử.
