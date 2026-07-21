/** true ถ้าเป็น URL http/https ที่ปลอดภัยจะใช้เป็น href/window.open — กัน scheme อันตราย
 *  เช่น javascript: จากลิงก์ที่ admin กรอกเอง (โซเชียล, popup, ปุ่ม Hero, banner ฯลฯ) */
export function isSafeHttpUrl(value: string | undefined | null): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

/** เปิดลิงก์ในแท็บใหม่ก็ต่อเมื่อผ่าน isSafeHttpUrl เท่านั้น — เงียบๆ ไม่ทำอะไรถ้า URL ไม่ปลอดภัย */
export function openSafeUrl(value: string | undefined | null) {
  if (isSafeHttpUrl(value)) window.open(value!, '_blank', 'noopener,noreferrer');
}
