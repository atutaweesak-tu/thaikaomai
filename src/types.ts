/** ใครสร้าง/แก้ไขล่าสุด — ประทับอัตโนมัติโดย server จาก session ที่ login อยู่ */
export interface AuditFields {
  createdBy?: string;
  createdAt?: string;
  updatedBy?: string;
  updatedAt?: string;
}

export interface Policy extends AuditFields {
  id: string;
  title: string;
  description: string;
  icon: string;
  iconImage?: string;
  color: string;
  order?: number;
  published?: boolean;
  publishAt?: string;
  unpublishAt?: string;
  featuredHome?: boolean;
}

export interface TeamMember extends AuditFields {
  id: string;
  name: string;
  role: string;
  image: string;
  bio: string;
  category: 'chairman' | 'leader' | 'expert';
  order?: number;
  published?: boolean;
  featuredHome?: boolean;
}

export interface NewsItem extends AuditFields {
  id: string;
  title: string;
  summary: string;
  content: string;
  date: string;
  image: string;
  category: string;
  published?: boolean;
  publishAt?: string;
  unpublishAt?: string;
}

export interface EventItem extends AuditFields {
  id: string;
  title: string;
  date: string;
  location: string;
  time: string;
  published?: boolean;
  publishAt?: string;
  unpublishAt?: string;
}

/** หมวดหมู่ข่าว — จัดการได้จากหน้า Admin แทนการพิมพ์ freetext */
export interface NewsCategory {
  id: string;
  name: string;
  order?: number;
}

/** ลำดับ section ของหน้าแรก — 5 ชนิดคงที่ (แก้ไม่ได้/ลบไม่ได้) + 'promo' ที่ admin เพิ่มเองได้หลายอัน */
export type HomeBlockType = 'hero' | 'policies' | 'team' | 'news' | 'cta' | 'promo';

export interface PageBlock extends AuditFields {
  id: string;
  type: HomeBlockType;
  order: number;
  published?: boolean;
  publishAt?: string;
  unpublishAt?: string;
  // ── ใช้เฉพาะ type: 'promo' ──
  title?: string;
  description?: string;
  image?: string;
  link?: string;
  buttonText?: string;
}

export interface NewsletterSubscriber {
  id: string;
  email: string;
  subscribedAt: string;
}

export interface PopupSettings {
  enabled: boolean;
  image: string;
  link: string;
  startDate: string;
  endDate: string;
}

/** ปรับขนาด/สี/เปิดปิดของข้อความแต่ละชิ้นใน Hero — ไม่ตั้งค่า = ใช้ค่า default เดิมของ element นั้น */
export interface TextStyle {
  fontSize?: string;
  color?: string;
  visible?: boolean;
}

export interface SiteSettings {
  popup: PopupSettings;
  about: {
    history: string;
    ideology: string;
    vision: string;
    image: string;
  };
  privacy: {
    content: string;
    updatedAt: string;
  };
  hero: {
    badge: string;
    heading1: string;
    heading2: string;
    heading3: string;
    description: string;
    buttonPrimary: string;
    buttonSecondary: string;
    buttonPrimaryLink?: string;
    buttonSecondaryLink?: string;
    leaderImage: string;
    leaderName: string;
    leaderTitle: string;
    textStyle?: {
      badge?: TextStyle;
      heading1?: TextStyle;
      heading2?: TextStyle;
      heading3?: TextStyle;
      description?: TextStyle;
    };
  };
  cta: {
    heading1: string;
    heading2: string;
    description: string;
  };
  contact: {
    address: string;
    email: string;
    phone: string;
    facebook: string;
    twitter: string;
    instagram: string;
    youtube: string;
    qrCode: string;
  };
  footer: {
    description: string;
    copyright: string;
  };
  pages: {
    teamHeading: string;
    teamDescription: string;
    teamImage: string;
    teamImagePos: string;
    newsHeading: string;
    newsDescription: string;
    newsImage: string;
    newsImagePos: string;
    policiesHeading: string;
    policiesDescription: string;
    policiesImage: string;
    policiesImagePos: string;
    contactHeading: string;
    contactDescription: string;
    contactImage: string;
    contactImagePos: string;
  };
}

export const DEFAULT_SETTINGS: SiteSettings = {
  popup: {
    enabled: false,
    image: '',
    link: '',
    startDate: '',
    endDate: '',
  },
  about: {
    history: 'พรรคไทยก้าวใหม่ ก่อตั้งขึ้นจากความมุ่งมั่นที่จะสร้างการเปลี่ยนแปลงที่แท้จริงให้กับประเทศไทย โดยมี ดร.สุชัชวีร์ สุวรรณสวัสดิ์ เป็นแกนนำในการก่อตั้ง',
    ideology: 'พรรคไทยก้าวใหม่ยึดมั่นในหลักการประชาธิปไตย ความเท่าเทียม ความโปร่งใส และการพัฒนาที่ยั่งยืน เพื่อให้คนไทยทุกคนมีคุณภาพชีวิตที่ดีขึ้น',
    vision: 'ประเทศไทยที่ก้าวหน้า เข้มแข็ง และเป็นธรรม โดยมีประชาชนเป็นศูนย์กลางของการพัฒนา',
    image: '',
  },
  privacy: {
    content: `นโยบายความเป็นส่วนตัว (Privacy Policy)\n\nพรรคไทยก้าวใหม่ให้ความสำคัญกับการคุ้มครองข้อมูลส่วนบุคคลของท่าน ตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA)\n\n1. ข้อมูลที่เก็บรวบรวม\nเราอาจเก็บข้อมูล ชื่อ อีเมล หมายเลขโทรศัพท์ และข้อมูลที่ท่านกรอกในแบบฟอร์มต่างๆ บนเว็บไซต์\n\n2. วัตถุประสงค์การใช้ข้อมูล\nเพื่อการสื่อสาร การส่งข่าวสาร และการดำเนินกิจกรรมของพรรคการเมือง\n\n3. การเปิดเผยข้อมูล\nเราจะไม่เปิดเผยข้อมูลส่วนบุคคลของท่านแก่บุคคลภายนอก ยกเว้นที่กฎหมายกำหนด\n\n4. สิทธิของเจ้าของข้อมูล\nท่านมีสิทธิเข้าถึง แก้ไข ลบ และขอให้ระงับการใช้ข้อมูลของท่านได้ โดยติดต่อเราที่ contact@thaikaomai.or.th\n\n5. การใช้คุกกี้\nเว็บไซต์นี้ใช้คุกกี้เพื่อปรับปรุงประสบการณ์การใช้งาน`,
    updatedAt: '2568-04-01',
  },
  hero: {
    badge: 'พรรคไทยก้าวใหม่ เบอร์ 49',
    heading1: 'ก้าวใหม่',
    heading2: 'ให้ไทย',
    heading3: 'สตรอง',
    description: 'พรรคไทยก้าวใหม่ มุ่งมั่นพลิกโฉมประเทศไทยด้วยนโยบาย "ธนู 4 ดอก" สร้างคนใหม่ เศรษฐกิจใหม่ คุณภาพชีวิตใหม่ และค่านิยมใหม่ เพื่อให้ไทยกลับมาเป็นผู้นำในอาเซียน',
    buttonPrimary: 'ดูนโยบาย ธนู 4 ดอก',
    buttonSecondary: 'วิสัยทัศน์พรรค',
    buttonPrimaryLink: '/policies',
    buttonSecondaryLink: '/team',
    leaderImage: '',
    leaderName: 'ดร.สุชัชวีร์ สุวรรณสวัสดิ์',
    leaderTitle: 'หัวหน้าพรรค',
    textStyle: {},
  },
  cta: {
    heading1: 'ร่วมก้าวใหม่',
    heading2: 'ไปกับเรา',
    description: 'ร่วมเป็นส่วนหนึ่งของการเปลี่ยนแปลง ด้วยกันเราจะสร้างประเทศไทยที่ดีกว่าสำหรับทุกคน ก้าวใหม่ให้ไทยสตรอง',
  },
  contact: {
    address: 'กรุงเทพมหานคร ประเทศไทย',
    email: 'contact@thaikaomai.or.th',
    phone: '',
    facebook: '#',
    twitter: '#',
    instagram: '#',
    youtube: '#',
    qrCode: '',
  },
  footer: {
    description: 'ก้าวใหม่ให้ไทยสตรอง พรรคไทยก้าวใหม่ เบอร์ 49 มุ่งพลิกโฉมประเทศไทยด้วยนโยบาย "ธนู 4 ดอก" เพื่ออนาคตที่ดีกว่าของคนไทยทุกคน',
    copyright: '© 2569 พรรคไทยก้าวใหม่ สงวนลิขสิทธิ์',
  },
  pages: {
    teamHeading: 'ทีมพรรคไทยก้าวใหม่.',
    teamDescription: 'ทีมนักวิชาการ นักการศึกษา และผู้เชี่ยวชาญที่มุ่งมั่นพัฒนาประเทศไทยให้ก้าวหน้า สร้างอนาคตที่ดีกว่าสำหรับคนไทยทุกคน',
    teamImage: '',
    teamImagePos: '50% 50%',
    newsHeading: 'ข่าวสาร & กิจกรรม.',
    newsDescription: 'ติดตามข่าวสาร กิจกรรม และนโยบายล่าสุดของพรรคไทยก้าวใหม่',
    newsImage: '',
    newsImagePos: '50% 50%',
    policiesHeading: 'ธนู 4 ดอก นโยบายพรรค.',
    policiesDescription: '4 นโยบายหลักที่ออกแบบมาเพื่อแก้ปัญหาสำคัญของประเทศ สร้างคนใหม่ เศรษฐกิจใหม่ คุณภาพชีวิตใหม่ และค่านิยมใหม่ เพื่อให้ไทยกลับมาเป็นผู้นำในอาเซียน',
    policiesImage: '',
    policiesImagePos: '50% 50%',
    contactHeading: 'ติดต่อเรา.',
    contactDescription: 'มีคำถามหรือข้อเสนอแนะ? เราพร้อมรับฟังทุกความคิดเห็นของคุณ',
    contactImage: '',
    contactImagePos: '50% 50%',
  },
};

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  message: string;
  sentAt?: string;
}

export interface VolunteerItem {
  id: string;
  name: string;
  phone: string;
  email: string;
  province: string;
  skills: string;
  message: string;
  submittedAt: string;
}
