# Tóm Tắt Hệ Thống Quản Lý Bookmark Bằng AI (Phiên Bản Tái Thiết Kế - Cập Nhật)

Dựa trên phiên bản trước, tóm tắt này được cập nhật để tích hợp yêu cầu xử lý phân mục lại với AI một cách nhất quán hơn. Cụ thể, luồng AI restructuring sẽ duy trì và gửi cấu trúc thư mục hiện có (danh mục phân cấp) vào các prompt batch sau lần đầu tiên. Điều này giúp AI gợi ý thêm bookmark vào các thư mục phù hợp mà không tạo ra các folder trùng lặp về ý nghĩa nhưng khác tên (ví dụ: tránh tạo "AI" và "Agent Intelligent" riêng biệt; thay vào đó, gợi ý merge vào một thư mục như "AI & Agents"). Hệ thống vẫn giữ nguyên mô hình client-side, tập trung vào mục tiêu đơn giản và tối ưu request.

## 1. Tổng Quan Hệ Thống

Dự án là một ứng dụng web phía client (client-side) được thiết kế để giúp người dùng quản lý và tái cấu trúc bộ sưu tập bookmark bằng AI, với trọng tâm chính là tự động phân loại và tổ chức lại cấu trúc thư mục. Ứng dụng hỗ trợ nhập bookmark từ trình duyệt, sử dụng AI để phân tích và đề xuất/mở rộng cấu trúc phân cấp (ví dụ: tạo thư mục con logic từ danh sách phẳng), đồng thời cung cấp công cụ quản lý trực quan đơn giản. Tối ưu hóa nhằm tránh tạo folder trùng lặp thông qua việc truyền cấu trúc hiện có vào các batch AI sau.

### Công nghệ sử dụng

- **Framework chính:** React (với Vite)
- **Ngôn ngữ:** TypeScript
- **Styling:** Tailwind CSS
- **Tích hợp AI:**
  - Hỗ trợ chính: Google Gemini (qua thư viện `@google/generative-ai`) và OpenRouter (làm proxy cho nhiều models như GPT, Claude, để dễ dàng fallback hoặc thử nghiệm).
  - Tối ưu: Sử dụng batch processing (gửi nhiều bookmark trong một prompt duy nhất) để giảm số request API, tránh rate limiting. Ví dụ: Một prompt có thể xử lý 10-20 bookmarks cùng lúc, sau đó lặp lại nếu cần. Các batch sau sẽ bao gồm cấu trúc thư mục hiện tại để đảm bảo tính nhất quán.
- **Lưu trữ dữ liệu:**
  - Sử dụng `localStorage` cho cấu hình và bookmark nhỏ.
  - Bổ sung **IndexedDB** (qua thư viện như `idb` hoặc Dexie.js) để lưu trữ bookmark lớn (hàng nghìn item) với hiệu suất cao hơn, hỗ trợ query nhanh và không mất dữ liệu khi reload. Đồng bộ giữa IndexedDB và localStorage để backup. Lưu thêm "cấu trúc thư mục hiện tại" (`CurrentFolderStructure`) vào IndexedDB để dễ dàng truy xuất cho các batch AI.

## 2. Luồng Hoạt Động Chính

### Luồng Nhập và Hiển Thị Bookmark

1. **Nhập file:** Người dùng chọn và tải lên file `bookmarks.html` được xuất từ trình duyệt.
2. **Phân tích (Parsing):** `services/bookmarkParser.ts` đọc nội dung file HTML và phân tích cấu trúc DOM để chuyển đổi thành một mảng dữ liệu có cấu trúc (`BookmarkNode[]`). Mỗi `BookmarkNode` có thể là một thư mục (`folder`) hoặc một bookmark (`bookmark`).
3. **Lưu trạng thái:** Dữ liệu sau khi phân tích được lưu vào state của component `App.tsx`.
4. **Lưu vào IndexedDB/localStorage:** Trạng thái bookmark được đồng bộ vào IndexedDB (ưu tiên cho dữ liệu lớn) và localStorage (backup), đảm bảo dữ liệu bền vững ngay cả với bộ sưu tập lớn. Lưu thêm `CurrentFolderStructure` (JSON đại diện cho cây thư mục hiện tại) để hỗ trợ AI.
5. **Hiển thị:** Giao diện người dùng render cấu trúc cây bookmark dựa trên dữ liệu từ state, với lazy loading cho các thư mục con lớn để tối ưu hiệu suất.

### Luồng Phân Loại và Tái Cấu Trúc Bằng AI (AI Restructuring)

1. **Kích hoạt:** Người dùng nhấn nút "AI Restructure" (tái cấu trúc) cho toàn bộ bookmark hoặc một thư mục cụ thể. Trọng tâm là phân loại danh sách và đề xuất/tạo cấu trúc phân cấp mới (ví dụ: từ danh sách phẳng thành cây thư mục logic như `Programming > JavaScript > Frameworks`), với cơ chế tránh trùng lặp folder qua các batch.
2. **Thu thập Bookmark:** Ứng dụng thu thập danh sách các bookmark cần xử lý (toàn bộ hoặc subset), giới hạn batch (ví dụ: 10-20 item/batch) để giảm request. Khởi tạo `CurrentFolderStructure` rỗng nếu batch đầu, hoặc tải từ IndexedDB nếu tiếp tục.
3. **Gọi API Hook:** Hàm xử lý sự kiện gọi đến `useAiApi.ts`, một custom hook quản lý tương tác AI với fallback giữa Gemini và OpenRouter.
4. **Chọn Model AI:** Hook sử dụng `services/ai/modelFactory.ts` để lấy cấu hình AI đang hoạt động (API key, model name – ưu tiên Gemini cho tốc độ, OpenRouter cho đa dạng models). Cấu hình được lưu an toàn trong IndexedDB.
5. **Tạo Prompt Tổng Hợp:** Thay vì prompt riêng lẻ, tạo một prompt batch chứa:
   - Danh sách bookmark (tiêu đề + URL của batch).
   - **Cấu trúc thư mục hiện có (`CurrentFolderStructure`):** Đối với batch đầu tiên, prompt yêu cầu AI tạo cấu trúc ban đầu từ batch (ví dụ: "Tạo cây thư mục JSON từ các bookmark này"). Đối với các batch sau (batch 2+), gửi thêm JSON của `CurrentFolderStructure` (danh sách thư mục cha/con hiện tại) và hướng dẫn AI: "Sử dụng cấu trúc thư mục hiện có sau: [JSON]. Phân loại các bookmark mới này bằng cách thêm chúng vào thư mục phù hợp (ưu tiên merge vào folder tương đồng về ý nghĩa, ví dụ: gộp 'AI' và 'Agent Intelligent' vào một folder 'AI & Intelligent Agents'). Tránh tạo folder trùng lặp; chỉ thêm mới nếu không khớp. Output JSON cập nhật toàn bộ cấu trúc."
   - Yêu cầu AI output JSON có cấu trúc (dễ parse), với hướng dẫn ngắn gọn để merge: { folders: [{name: 'Category', children: [...], suggestions: {merges: [], newFolders: []}} ] } – phần `suggestions` giúp ghi lại lý do merge để debug.
   - Điều này giảm 80-90% số request so với per-bookmark, đồng thời đảm bảo tính nhất quán toàn cục qua các batch.
6. **Gửi yêu cầu đến AI:** Yêu cầu batch được gửi tuần tự với delay ngắn (1-2 giây giữa batch) qua Gemini hoặc OpenRouter API. Sử dụng web workers nếu cần để tránh block UI. Sau mỗi batch, cập nhật `CurrentFolderStructure` tạm thời trong state để dùng cho batch tiếp theo.
7. **Xử lý kết quả:**
   - Parse JSON từ AI: Merge gợi ý phân loại/thư mục mới với `CurrentFolderStructure` hiện tại (ví dụ: di chuyển bookmark vào thư mục khớp, apply merge nếu AI gợi ý trùng lặp như "AI" và "Agent Intelligent" thành một, tạo thư mục con mới nếu cần chiều sâu).
   - Nếu phát hiện trùng lặp URL hoặc folder ý nghĩa, áp dụng merge tự động (giữ bookmark mới nhất) và cập nhật `CurrentFolderStructure`.
   - Cập nhật state và IndexedDB ngay lập tức, lưu phiên bản mới của `CurrentFolderStructure`.
8. **Cập nhật giao diện:** State được cập nhật, giao diện render lại với animation mượt (ví dụ: unfold thư mục mới hoặc highlight merge). Thêm progress bar cho batch processing (hiển thị "Batch 1/5: Xử lý với cấu trúc hiện có"), tùy chọn dừng/khôi phục, và toast thông báo merge (ví dụ: "Đã merge 'AI' và 'Agent Intelligent'").

## 3. Chức Năng Chính

### Quản lý Bookmark Cơ bản

- **Nhập/Xuất:** Nhập từ file `bookmarks.html` và xuất ra định dạng tương tự, hỗ trợ export cấu trúc AI đã tái tổ chức (bao gồm `CurrentFolderStructure` nếu cần).
- **CRUD:**
  - **Tạo:** Thêm thư mục mới ở bất kỳ cấp nào, với gợi ý tên từ AI nếu kích hoạt (sử dụng cấu trúc hiện có để tránh trùng).
  - **Đọc:** Xem bookmark và thư mục dưới dạng cây phân cấp, hỗ trợ collapse/expand và virtualization cho list lớn (sử dụng react-window).
  - **Cập nhật:** Chỉnh sửa tiêu đề, URL của bookmark.
  - **Xóa:** Xóa bookmark hoặc thư mục (và nội dung bên trong), với xác nhận; tự động cập nhật `CurrentFolderStructure`.
- **Kéo và Thả (Drag & Drop):** Sắp xếp lại bookmark/thư mục bằng kéo thả, dễ dàng chỉnh sửa sau khi AI restructure, và cập nhật `CurrentFolderStructure` sau mỗi thay đổi.
- **Tìm kiếm:** Lọc dựa trên từ khóa, với tùy chọn tìm trong cấu trúc AI (ví dụ: theo thư mục đã phân loại hoặc merge).

### Chức Năng Tích hợp AI (Tập Trung Restructuring với Nhất Quán Folder)

- **Cấu hình AI (AI Configuration):**
  - Giao diện đơn giản để thêm/sửa/xóa cấu hình: Tên, Nhà cung cấp (Gemini hoặc OpenRouter), API Key, Model ID (mặc định Gemini 1.5 Flash cho tốc độ).
  - Validate key ngay lập tức (test call nhỏ). Lưu vào IndexedDB với mã hóa cơ bản (nếu sử dụng Crypto API).
  - Hỗ trợ fallback: Nếu Gemini hết quota, tự chuyển sang OpenRouter (config chung một key). Thêm tùy chọn "Merge Threshold" (mức độ tương đồng folder, ví dụ: 80% để gộp tên tương tự).
- **Tái Cấu Trúc Tự Động (AI Restructuring):**
  - **Phân loại và Tổ Chức:** AI phân tích batch bookmark để di chuyển chúng vào thư mục phù hợp và đề xuất tạo cấu trúc phân cấp (tập trung vào việc biến danh sách phẳng thành cây logic, dựa trên chủ đề từ tiêu đề/URL). Các batch sau sử dụng `CurrentFolderStructure` để đảm bảo nhất quán, tránh tạo folder trùng lặp (ví dụ: AI sẽ gợi ý thêm vào "AI" thay vì tạo "Intelligent Agents" mới).
  - Áp dụng cho toàn bộ hoặc thư mục cụ thể, với xem trước (preview modal hiển thị cấu trúc trước/sau, highlight merge và new folders).
  - Tối ưu request: Batch processing tự động, với tùy chọn "Max Batches" để kiểm soát (mặc định 5-10 batch cho bộ sưu tập trung bình). Duy trì `CurrentFolderStructure` qua các batch để AI "học" từ tiến trình.
  - **Xử Lý Trùng Lặp:** AI tự detect và gợi ý merge bookmark trùng URL hoặc folder tương đồng về ý nghĩa (dựa trên semantic similarity từ prompt), áp dụng trong JSON output.
  - Không thêm tags hoặc tóm tắt phức tạp để giữ đơn giản, nhưng có thể mở rộng sau nếu cần.
- **Xem Trước và Phê Duyệt:** Sau khi AI trả về plan (toàn bộ sau tất cả batch), hiển thị diff view (cây cũ vs. cây mới, với chi tiết merge như "Gộp 2 folders thành 'AI & Agents'") trong modal, cho phép chỉnh sửa thủ công trước khi apply. Lưu lịch sử thay đổi vào IndexedDB để undo nếu cần, bao gồm backup `CurrentFolderStructure` cũ.

### Các Tối Ưu Hóa Chung

- **Hiệu Suất AI:** Giảm request bằng batch/prompt tổng hợp; thêm retry logic cho lỗi API (tối đa 3 lần/batch). Progress indicator chi tiết (ví dụ: "Batch 2: Đang merge với cấu trúc hiện có") và error logging (console + UI toast, như "AI không gợi ý merge – kiểm tra prompt").
- **Bảo Mật:** API key chỉ lưu local (IndexedDB), hướng dẫn người dùng không chia sẻ file export chứa key hoặc `CurrentFolderStructure`.
- **UX Đơn Giản:** Giao diện tập trung vào nút "AI Restructure" lớn, với tooltip giải thích quy trình batch và merge (ví dụ: "Sử dụng cấu trúc hiện có để tránh trùng lặp folder"). Hỗ trợ dark mode và responsive cho mobile.
- **Giới Hạn:** Không hỗ trợ advanced như generate tags hoặc semantic search để giữ mục tiêu đơn giản; có thể thêm sau qua config toggle. Nếu bộ sưu tập rất lớn, cảnh báo về thời gian xử lý batch.
