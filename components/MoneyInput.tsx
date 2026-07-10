'use client';

// Ô nhập tiền: hiển thị có dấu chấm ngăn cách nghìn (1.000.000) + đơn vị VNĐ,
// nhưng lưu ra số nguyên. Bàn phím số trên điện thoại.
export function MoneyInput({
  value,
  onChange,
  className = '',
  placeholder,
}: {
  value: number;
  onChange: (n: number) => void;
  className?: string;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <input
        type="text"
        inputMode="numeric"
        value={value ? value.toLocaleString('vi-VN') : ''}
        onChange={(e) => onChange(Number(e.target.value.replace(/\D/g, '')) || 0)}
        placeholder={placeholder}
        className={`${className} pr-14`}
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] font-semibold text-[var(--ink-3)] pointer-events-none">
        VNĐ
      </span>
    </div>
  );
}
