import 'server-only';
// Xếp hàng đồng bộ Google Sheet chạy NỀN (sau khi response đã trả về) để không
// làm chậm thao tác của người dùng. Trên Vercel dùng waitUntil bảo đảm hoàn tất;
// ở môi trường dev thì promise vẫn chạy vì tiến trình còn sống.
import { waitUntil } from '@vercel/functions';
import { sheetsConfigured, syncAllToSheets } from './sheets';

export function queueSheetSync(): void {
  if (!sheetsConfigured()) return; // chưa cấu hình → bỏ qua im lặng
  const task = syncAllToSheets()
    .then((r) => {
      if (!r.ok) console.error('[sheets] sync lỗi:', r.error);
    })
    .catch((e) => console.error('[sheets] sync ném lỗi:', e));
  try {
    waitUntil(task);
  } catch {
    // Không chạy trên Vercel → cứ để promise tự chạy.
  }
}
