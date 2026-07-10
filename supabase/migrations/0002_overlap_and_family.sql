-- ═══════════════════════════════════════════════════════════════════
-- Mốc 1 · Chống trùng lịch — Ở TẦNG DATABASE, không phải client (mục 6)
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Không cho 2 booking CÙNG unit chồng ngày ────────────────────
-- Nửa mở [ci, co): trả sáng - nhận chiều CÙNG ngày là OK.
-- pending VẪN khóa ngày; chỉ chừa rejected & cancelled.
alter table bookings add constraint no_overlap
exclude using gist (
  unit_id with =,
  daterange(checkin_date, checkout_date, '[)') with &&
) where (status not in ('rejected', 'cancelled'));

-- ── 2. Ràng buộc CHA ↔ CON ─────────────────────────────────────────
-- Đặt nguyên căn Long Sơn 2 → khóa cả 4 phòng con, và ngược lại.
-- EXCLUDE ở trên chỉ chặn trùng trong cùng unit; quan hệ cha/con cần trigger.

-- Trả về "family" của 1 unit = { chính nó, cha nó, các con của nó }.
-- Lưu ý: không xử lý nhiều tầng (cháu) vì mô hình chỉ 2 tầng cha-con.
create or replace function unit_family(p_unit_id uuid)
returns setof uuid
language sql stable as $$
  select p_unit_id
  union
  select parent_unit_id from units where id = p_unit_id and parent_unit_id is not null
  union
  select id from units where parent_unit_id = p_unit_id
$$;

-- Trigger: trước khi ghi booking, kiểm tra chồng ngày với MỌI booking
-- thuộc unit trong family (trạng thái ≠ rejected/cancelled).
create or replace function check_family_overlap()
returns trigger
language plpgsql as $$
declare
  conflict_row bookings%rowtype;
begin
  -- Booking bị hủy/từ chối thì không khóa ngày → bỏ qua kiểm tra.
  if new.status in ('rejected', 'cancelled') then
    return new;
  end if;

  select b.* into conflict_row
  from bookings b
  where b.id <> new.id
    and b.status not in ('rejected', 'cancelled')
    and b.unit_id in (
      -- Family của unit đang đặt, BỎ chính unit đó (EXCLUDE đã lo unit đó rồi).
      select fid from unit_family(new.unit_id) fid where fid <> new.unit_id
    )
    and daterange(b.checkin_date, b.checkout_date, '[)')
        && daterange(new.checkin_date, new.checkout_date, '[)')
  limit 1;

  if found then
    raise exception 'TRUNG_LICH: đơn vị này (hoặc căn/phòng liên quan) đã có khách từ % đến % (đơn %)',
      to_char(conflict_row.checkin_date, 'DD/MM/YYYY'),
      to_char(conflict_row.checkout_date, 'DD/MM/YYYY'),
      coalesce(conflict_row.code, conflict_row.id::text)
      using errcode = 'exclusion_violation';
  end if;

  return new;
end;
$$;

create trigger trg_family_overlap
  before insert or update of unit_id, checkin_date, checkout_date, status
  on bookings
  for each row execute function check_family_overlap();

-- ── 3. Sinh mã booking 'LS' + ddMM + STT trong ngày (mục 7) ────────
-- Ví dụ: LS260701 = ngày 07/06?  → quy ước: dd = ngày checkin? Không.
-- Plan: 'LS' + ddMM + số thứ tự trong ngày. LS260701 minh họa.
-- Ta dùng ddMM của NGÀY DUYỆT (created_at của lần confirmed) cho ổn định đối soát.
create or replace function gen_booking_code(p_when date)
returns text
language plpgsql as $$
declare
  ddmm text := to_char(p_when, 'DDMM');
  seq  int;
begin
  select count(*) + 1 into seq
  from bookings
  where code like 'LS' || ddmm || '%';
  return 'LS' || ddmm || lpad(seq::text, 2, '0');
end;
$$;
