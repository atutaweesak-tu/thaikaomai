import React from 'react';

/** ฉากหลังต่อเนื่องทั้งหน้าแรก (Digital Journey) — อยู่หลังทุก section (main เป็น isolate + -z-10)
 *  1) หมอกลึก (คาบ 2600px) + โซนแสงซ้ำทุก 1800px จากซ้ายบน — สม่ำเสมอไม่ว่า admin จะจัด/ซ่อน section อย่างไร
 *  2) grid บางมากจางที่ขอบ  3) light trail แนวตั้งซ้ายมือ (เดสก์ท็อป ≥1280)  4) เส้นแสงทแยงบางๆ
 *  + รอยต่อแสงระหว่าง section (CSS `.uf-home > section + section::before`) — ทั้งหมดเป็น CSS ล้วน ไม่มีแสงทับข้อความยาว */
export default function JourneyBackdrop() {
  return (
    <div aria-hidden className="uf-journey pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 uf-journey-fog" />
      <div className="absolute inset-0 uf-journey-zones" />
      <div className="absolute inset-0 uf-journey-grid" />
      {/* เส้นทางแสงแนวตั้ง — วางในช่องว่างซ้ายของ container (เฉพาะจอกว้างที่มีที่ว่างพอ) */}
      <div className="hidden xl:block absolute top-[820px] bottom-[600px] uf-journey-rail">
        <span className="uf-journey-comet" />
      </div>
      {/* เส้นแสงทแยงช่วงรอยต่อ — ตำแหน่งเป็น % ของความสูงหน้า จึงไม่ผูกกับลำดับ block ที่ admin จัด */}
      <span className="uf-trail" style={{ top: '22%', left: '-10%', transform: 'rotate(-8deg)' }} />
      <span className="uf-trail" style={{ top: '48%', right: '-10%', transform: 'rotate(7deg)' }} />
      <span className="uf-trail" style={{ top: '74%', left: '-10%', transform: 'rotate(-6deg)' }} />
    </div>
  );
}
