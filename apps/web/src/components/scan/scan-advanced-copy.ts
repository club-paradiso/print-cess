import type { SupportedLocale } from "@print-cess/i18n";

type AdvancedScanCopy = {
  adjustCrop: string;
  autoCrop: string;
  apply: string;
  cancel: string;
  filter: string;
  auto: string;
  color: string;
  grayscale: string;
  blackWhite: string;
  detecting: string;
  processing: string;
  edgeFound: string;
  edgeNotFound: string;
  cropHelp: string;
};

const en: AdvancedScanCopy = {
  adjustCrop: "Adjust edges",
  autoCrop: "Detect again",
  apply: "Apply",
  cancel: "Cancel",
  filter: "Document look",
  auto: "Auto clean",
  color: "Color",
  grayscale: "Grayscale",
  blackWhite: "Black & white",
  detecting: "Finding document edges…",
  processing: "Correcting perspective…",
  edgeFound: "Document edges detected",
  edgeNotFound: "Edges need a quick check",
  cropHelp: "Drag the four corners to the edges of the paper.",
};

const ko: AdvancedScanCopy = {
  adjustCrop: "문서 영역 조정",
  autoCrop: "다시 자동 인식",
  apply: "적용",
  cancel: "취소",
  filter: "문서 보정",
  auto: "자동 선명화",
  color: "컬러",
  grayscale: "그레이스케일",
  blackWhite: "흑백",
  detecting: "문서 경계를 찾는 중…",
  processing: "원근을 보정하는 중…",
  edgeFound: "문서 경계를 자동으로 찾았어요",
  edgeNotFound: "문서 경계를 확인해 주세요",
  cropHelp: "네 모서리를 종이 끝에 맞게 끌어 옮기세요.",
};

const zhCN: AdvancedScanCopy = {
  adjustCrop: "调整边缘",
  autoCrop: "重新检测",
  apply: "应用",
  cancel: "取消",
  filter: "文档效果",
  auto: "自动增强",
  color: "彩色",
  grayscale: "灰度",
  blackWhite: "黑白",
  detecting: "正在检测文档边缘…",
  processing: "正在校正透视…",
  edgeFound: "已检测到文档边缘",
  edgeNotFound: "请检查文档边缘",
  cropHelp: "拖动四个角，使其贴合纸张边缘。",
};

const id: AdvancedScanCopy = {
  adjustCrop: "Atur tepi",
  autoCrop: "Deteksi lagi",
  apply: "Terapkan",
  cancel: "Batal",
  filter: "Tampilan dokumen",
  auto: "Bersihkan otomatis",
  color: "Warna",
  grayscale: "Skala abu-abu",
  blackWhite: "Hitam putih",
  detecting: "Mencari tepi dokumen…",
  processing: "Memperbaiki perspektif…",
  edgeFound: "Tepi dokumen terdeteksi",
  edgeNotFound: "Periksa tepi dokumen",
  cropHelp: "Geser keempat sudut ke tepi kertas.",
};

const fil: AdvancedScanCopy = {
  adjustCrop: "Ayusin ang mga gilid",
  autoCrop: "Tukuyin muli",
  apply: "Ilapat",
  cancel: "Kanselahin",
  filter: "Itsura ng dokumento",
  auto: "Auto linaw",
  color: "Kulay",
  grayscale: "Grayscale",
  blackWhite: "Itim at puti",
  detecting: "Hinahanap ang gilid ng dokumento…",
  processing: "Itinutuwid ang perspektibo…",
  edgeFound: "Nakita ang gilid ng dokumento",
  edgeNotFound: "Pakisuri ang mga gilid",
  cropHelp: "I-drag ang apat na sulok sa gilid ng papel.",
};

const vi: AdvancedScanCopy = {
  adjustCrop: "Chỉnh mép",
  autoCrop: "Nhận diện lại",
  apply: "Áp dụng",
  cancel: "Hủy",
  filter: "Kiểu tài liệu",
  auto: "Tự động làm rõ",
  color: "Màu",
  grayscale: "Thang xám",
  blackWhite: "Đen trắng",
  detecting: "Đang tìm mép tài liệu…",
  processing: "Đang chỉnh phối cảnh…",
  edgeFound: "Đã nhận diện mép tài liệu",
  edgeNotFound: "Hãy kiểm tra lại các mép",
  cropHelp: "Kéo bốn góc vào đúng mép giấy.",
};

const th: AdvancedScanCopy = {
  adjustCrop: "ปรับขอบเอกสาร",
  autoCrop: "ตรวจจับอีกครั้ง",
  apply: "ใช้",
  cancel: "ยกเลิก",
  filter: "รูปแบบเอกสาร",
  auto: "ปรับอัตโนมัติ",
  color: "สี",
  grayscale: "ระดับเทา",
  blackWhite: "ขาวดำ",
  detecting: "กำลังค้นหาขอบเอกสาร…",
  processing: "กำลังแก้มุมมอง…",
  edgeFound: "ตรวจพบขอบเอกสารแล้ว",
  edgeNotFound: "โปรดตรวจสอบขอบเอกสาร",
  cropHelp: "ลากมุมทั้งสี่ให้ตรงกับขอบกระดาษ",
};

const ne: AdvancedScanCopy = {
  adjustCrop: "किनारा मिलाउनुहोस्",
  autoCrop: "फेरि पत्ता लगाउनुहोस्",
  apply: "लागू गर्नुहोस्",
  cancel: "रद्द गर्नुहोस्",
  filter: "कागजात रूप",
  auto: "स्वतः सफा",
  color: "रङ्गीन",
  grayscale: "ग्रे स्केल",
  blackWhite: "कालो र सेतो",
  detecting: "कागजातको किनारा खोज्दै…",
  processing: "परिप्रेक्ष्य सच्याउँदै…",
  edgeFound: "कागजातको किनारा भेटियो",
  edgeNotFound: "किनाराहरू जाँच गर्नुहोस्",
  cropHelp: "चारवटै कुनालाई कागजको किनारामा तान्नुहोस्।",
};

const km: AdvancedScanCopy = {
  adjustCrop: "កែសម្រួលគែម",
  autoCrop: "ស្វែងរកម្ដងទៀត",
  apply: "អនុវត្ត",
  cancel: "បោះបង់",
  filter: "រូបរាងឯកសារ",
  auto: "កែលម្អស្វ័យប្រវត្តិ",
  color: "ពណ៌",
  grayscale: "ប្រផេះ",
  blackWhite: "សខ្មៅ",
  detecting: "កំពុងស្វែងរកគែមឯកសារ…",
  processing: "កំពុងកែទស្សនវិស័យ…",
  edgeFound: "បានរកឃើញគែមឯកសារ",
  edgeNotFound: "សូមពិនិត្យគែមឯកសារ",
  cropHelp: "អូសជ្រុងទាំងបួនទៅគែមក្រដាស។",
};

const ar: AdvancedScanCopy = {
  adjustCrop: "ضبط الحواف",
  autoCrop: "اكتشاف مرة أخرى",
  apply: "تطبيق",
  cancel: "إلغاء",
  filter: "مظهر المستند",
  auto: "تحسين تلقائي",
  color: "ملون",
  grayscale: "تدرج رمادي",
  blackWhite: "أبيض وأسود",
  detecting: "جارٍ اكتشاف حواف المستند…",
  processing: "جارٍ تصحيح المنظور…",
  edgeFound: "تم اكتشاف حواف المستند",
  edgeNotFound: "يرجى التحقق من الحواف",
  cropHelp: "اسحب الزوايا الأربع إلى حواف الورقة.",
};

const ru: AdvancedScanCopy = {
  adjustCrop: "Настроить края",
  autoCrop: "Найти заново",
  apply: "Применить",
  cancel: "Отмена",
  filter: "Вид документа",
  auto: "Автоулучшение",
  color: "Цвет",
  grayscale: "Оттенки серого",
  blackWhite: "Чёрно-белый",
  detecting: "Поиск границ документа…",
  processing: "Исправление перспективы…",
  edgeFound: "Границы документа найдены",
  edgeNotFound: "Проверьте границы документа",
  cropHelp: "Перетащите четыре угла к краям листа.",
};

const mn: AdvancedScanCopy = {
  adjustCrop: "Ирмэг тохируулах",
  autoCrop: "Дахин илрүүлэх",
  apply: "Хэрэглэх",
  cancel: "Цуцлах",
  filter: "Баримтын харагдац",
  auto: "Автомат цэвэрлэх",
  color: "Өнгөт",
  grayscale: "Саарал",
  blackWhite: "Хар цагаан",
  detecting: "Баримтын ирмэг хайж байна…",
  processing: "Перспектив засаж байна…",
  edgeFound: "Баримтын ирмэг илэрлээ",
  edgeNotFound: "Ирмэгийг шалгана уу",
  cropHelp: "Дөрвөн буланг цаасны ирмэгт чирж тааруулна уу.",
};

const uk: AdvancedScanCopy = {
  adjustCrop: "Налаштувати краї",
  autoCrop: "Знайти знову",
  apply: "Застосувати",
  cancel: "Скасувати",
  filter: "Вигляд документа",
  auto: "Автопокращення",
  color: "Колір",
  grayscale: "Відтінки сірого",
  blackWhite: "Чорно-білий",
  detecting: "Пошук меж документа…",
  processing: "Виправлення перспективи…",
  edgeFound: "Межі документа знайдено",
  edgeNotFound: "Перевірте межі документа",
  cropHelp: "Перетягніть чотири кути до країв аркуша.",
};

const COPY: Record<SupportedLocale, AdvancedScanCopy> = {
  en,
  ko,
  "zh-CN": zhCN,
  id,
  fil,
  vi,
  th,
  ne,
  km,
  ar,
  ru,
  mn,
  uk,
};

export function advancedScanCopy(locale: SupportedLocale): AdvancedScanCopy {
  return COPY[locale];
}
