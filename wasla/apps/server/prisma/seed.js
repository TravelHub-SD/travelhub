/* eslint-disable no-console */
const bcrypt = require('bcryptjs');
const prisma = require('../src/prisma');

// الأسعار بالقرش (أصغر وحدة) لتفادي أخطاء الفاصلة العائمة — 250000 = 2500 ج.س
const img = (id) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=800&q=60`;

const CATEGORIES = [
  { name: 'مطاعم', slug: 'restaurants', icon: '🍔', sort: 1 },
  { name: 'بقالة', slug: 'grocery', icon: '🛒', sort: 2 },
  { name: 'حلويات', slug: 'sweets', icon: '🍰', sort: 3 },
  { name: 'صيدلية', slug: 'pharmacy', icon: '💊', sort: 4 },
  { name: 'مشروبات', slug: 'drinks', icon: '🥤', sort: 5 },
];

const STORES = [
  {
    slug: 'bait-alshawarma',
    name: 'بيت الشاورما',
    category: 'restaurants',
    description: 'شاورما شامية على الفحم، مشاوي وسندويتشات طازجة',
    area: 'الرياض',
    imageUrl: img('1529006557810-274b9b2fc783'),
    logoUrl: img('1561758033-d89a9ad46330'),
    rating: 4.6,
    ratingCount: 218,
    deliveryFee: 50000,
    minOrder: 100000,
    etaMinutes: 30,
    isFeatured: true,
    sections: [
      {
        name: 'السندويتشات',
        items: [
          { name: 'شاورما دجاج', description: 'خبز صاج، دجاج مشوي، ثومية ومخلل', price: 90000, isPopular: true },
          { name: 'شاورما لحم', description: 'لحم بلدي مع طحينة وبقدونس', price: 120000, isPopular: true },
          { name: 'ساندويتش فلافل', description: 'فلافل مقرمشة مع سلطة وطحينة', price: 45000 },
          { name: 'برجر دجاج', description: 'صدر دجاج مقرمش مع صوص خاص', price: 105000 },
        ],
      },
      {
        name: 'الوجبات',
        items: [
          { name: 'صحن شاورما دجاج', description: 'مع بطاطس وثومية وسلطة', price: 180000, isPopular: true },
          { name: 'مشاوي مشكّلة', description: 'كباب، شيش طاووق وكفتة مع الأرز', price: 320000 },
          { name: 'نصف فروج مشوي', description: 'مع بطاطس وصوص', price: 240000 },
        ],
      },
      {
        name: 'الإضافات',
        items: [
          { name: 'بطاطس مقلية', description: 'وسط', price: 40000 },
          { name: 'سلطة خضراء', description: 'خس، طماطم، خيار', price: 35000 },
          { name: 'ثومية إضافية', description: '', price: 10000 },
        ],
      },
    ],
  },
  {
    slug: 'mataam-alnile',
    name: 'مطعم النيل',
    category: 'restaurants',
    description: 'أكلات سودانية بيتية: فول، عصيدة، مُلاح وأسماك النيل',
    area: 'الخرطوم بحري',
    imageUrl: img('1504674900247-0877df9cc836'),
    logoUrl: img('1517248135467-4c7edcad34c4'),
    rating: 4.8,
    ratingCount: 342,
    deliveryFee: 60000,
    minOrder: 120000,
    etaMinutes: 40,
    isFeatured: true,
    sections: [
      {
        name: 'الأطباق الرئيسية',
        items: [
          { name: 'فول بالجبنة', description: 'فول مدمس مع جبنة بيضاء وزيت سمسم', price: 70000, isPopular: true },
          { name: 'عصيدة بالملاح', description: 'عصيدة ذرة مع ملاح روب', price: 150000, isPopular: true },
          { name: 'سمك بلطي مقلي', description: 'من النيل، مع سلطة وخبز', price: 380000 },
          { name: 'كسرة بالويكة', description: 'كسرة ذرة مع ملاح ويكة ولحم', price: 190000 },
          { name: 'شية لحم', description: 'لحم ضاني مشوي على الفحم', price: 350000 },
        ],
      },
      {
        name: 'المقبلات',
        items: [
          { name: 'سلطة أسود', description: 'باذنجان مشوي مع الروب والطحينة', price: 60000 },
          { name: 'دمعة', description: 'سلطة طماطم حارة', price: 40000 },
        ],
      },
    ],
  },
  {
    slug: 'pizza-corner',
    name: 'بيتزا كورنر',
    category: 'restaurants',
    description: 'بيتزا إيطالية بعجينة طازجة يومياً وباستا',
    area: 'أم درمان',
    imageUrl: img('1513104890138-7c749659a591'),
    logoUrl: img('1590947132387-155cc02f3212'),
    rating: 4.3,
    ratingCount: 156,
    deliveryFee: 55000,
    minOrder: 150000,
    etaMinutes: 35,
    sections: [
      {
        name: 'البيتزا',
        items: [
          { name: 'بيتزا مارجريتا', description: 'صلصة طماطم وموزاريلا وريحان', price: 220000, isPopular: true },
          { name: 'بيتزا بيبروني', description: 'بيبروني حار مع جبنة إضافية', price: 280000, isPopular: true },
          { name: 'بيتزا دجاج باربكيو', description: 'دجاج مشوي، بصل وصوص باربكيو', price: 300000 },
          { name: 'بيتزا خضار', description: 'فلفل، زيتون، فطر وذرة', price: 240000 },
        ],
      },
      {
        name: 'الباستا',
        items: [
          { name: 'باستا ألفريدو', description: 'كريمة، دجاج وفطر', price: 260000 },
          { name: 'باستا بولونيز', description: 'صلصة لحم مفروم', price: 270000 },
        ],
      },
    ],
  },
  {
    slug: 'super-albaraka',
    name: 'سوبرماركت البركة',
    category: 'grocery',
    description: 'كل احتياجات البيت — خضار، ألبان، معلبات ومنظفات',
    area: 'الرياض',
    imageUrl: img('1542838132-92c53300491e'),
    logoUrl: img('1583258292688-d0213dc5a3a8'),
    rating: 4.4,
    ratingCount: 97,
    deliveryFee: 40000,
    minOrder: 200000,
    etaMinutes: 45,
    isFeatured: true,
    sections: [
      {
        name: 'خضار وفواكه',
        items: [
          { name: 'طماطم — كيلو', description: 'طازجة من المزرعة', price: 35000, isPopular: true },
          { name: 'بصل — كيلو', description: '', price: 30000 },
          { name: 'موز — كيلو', description: '', price: 55000 },
          { name: 'ليمون — نصف كيلو', description: '', price: 25000 },
        ],
      },
      {
        name: 'ألبان وبيض',
        items: [
          { name: 'حليب طويل الأجل — لتر', description: '', price: 60000, isPopular: true },
          { name: 'بيض — طبق 30', description: '', price: 180000 },
          { name: 'جبنة بيضاء — نصف كيلو', description: '', price: 120000 },
          { name: 'زبادي — 4 حبات', description: '', price: 70000 },
        ],
      },
      {
        name: 'أساسيات',
        items: [
          { name: 'سكر — كيلو', description: '', price: 45000 },
          { name: 'أرز — 2 كيلو', description: '', price: 140000 },
          { name: 'زيت طعام — لتر', description: '', price: 130000 },
          { name: 'شاي — علبة', description: '', price: 65000 },
        ],
      },
    ],
  },
  {
    slug: 'halawiyat-alsharq',
    name: 'حلويات الشرق',
    category: 'sweets',
    description: 'كنافة، بسبوسة وبقلاوة تُخبز يومياً',
    area: 'الخرطوم',
    imageUrl: img('1488477181946-6428a0291777'),
    logoUrl: img('1509440159596-0249088772ff'),
    rating: 4.7,
    ratingCount: 203,
    deliveryFee: 45000,
    minOrder: 80000,
    etaMinutes: 25,
    sections: [
      {
        name: 'حلويات شرقية',
        items: [
          { name: 'كنافة بالجبنة', description: 'صينية وسط، تُقدّم ساخنة', price: 250000, isPopular: true },
          { name: 'بقلاوة مشكّلة', description: 'نصف كيلو', price: 220000, isPopular: true },
          { name: 'بسبوسة بالقشطة', description: 'قطعة كبيرة', price: 90000 },
          { name: 'زلابية', description: 'علبة صغيرة', price: 70000 },
        ],
      },
      {
        name: 'كيك',
        items: [
          { name: 'كيكة شوكولاتة', description: 'قطعة', price: 110000 },
          { name: 'تشيز كيك', description: 'قطعة بالتوت', price: 130000 },
        ],
      },
    ],
  },
  {
    slug: 'saydaliyat-alshifa',
    name: 'صيدلية الشفاء',
    category: 'pharmacy',
    description: 'أدوية، مستلزمات طبية ومنتجات عناية — توصيل سريع',
    area: 'الخرطوم',
    imageUrl: img('1576602976047-174e57a47881'),
    logoUrl: img('1587854692152-cbe660dbde88'),
    rating: 4.5,
    ratingCount: 64,
    deliveryFee: 50000,
    minOrder: 50000,
    etaMinutes: 30,
    sections: [
      {
        name: 'أدوية بدون وصفة',
        items: [
          { name: 'باراسيتامول 500 — شريط', description: 'خافض حرارة ومسكن', price: 30000, isPopular: true },
          { name: 'فيتامين سي — علبة', description: '20 قرص فوار', price: 90000 },
          { name: 'محلول معالجة الجفاف', description: '5 أكياس', price: 40000 },
        ],
      },
      {
        name: 'مستلزمات',
        items: [
          { name: 'كمامات طبية — 50 حبة', description: '', price: 110000 },
          { name: 'شاش وضمادات', description: 'طقم إسعافات أولية', price: 85000 },
          { name: 'ميزان حرارة رقمي', description: '', price: 160000 },
        ],
      },
    ],
  },
  {
    slug: 'asir-alwadi',
    name: 'عصير الوادي',
    category: 'drinks',
    description: 'عصائر طبيعية طازجة وميلك شيك',
    area: 'بحري',
    imageUrl: img('1600271886742-f049cd451bba'),
    logoUrl: img('1497534446932-c925b458314e'),
    rating: 4.2,
    ratingCount: 88,
    deliveryFee: 40000,
    minOrder: 60000,
    etaMinutes: 20,
    isOpen: false,
    sections: [
      {
        name: 'عصائر طبيعية',
        items: [
          { name: 'عصير مانجو', description: 'مانجو طازج بدون سكر مضاف', price: 80000, isPopular: true },
          { name: 'عصير برتقال', description: 'معصور في الحال', price: 70000 },
          { name: 'كركديه', description: 'مثلج', price: 50000 },
          { name: 'عصير جوافة', description: '', price: 75000 },
        ],
      },
      {
        name: 'ميلك شيك',
        items: [
          { name: 'ميلك شيك شوكولاتة', description: '', price: 120000 },
          { name: 'ميلك شيك فراولة', description: '', price: 120000 },
        ],
      },
    ],
  },
];

async function main() {
  console.log('🌱 تهيئة بيانات وصلة...');

  // ترتيب الحذف يحترم المفاتيح الأجنبية
  await prisma.orderEvent.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.review.deleteMany();
  await prisma.order.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.menuSection.deleteMany();
  await prisma.store.deleteMany();
  await prisma.category.deleteMany();
  await prisma.address.deleteMany();
  await prisma.user.deleteMany();

  const categoryBySlug = new Map();
  for (const category of CATEGORIES) {
    const created = await prisma.category.create({ data: category });
    categoryBySlug.set(created.slug, created);
  }
  console.log(`  ✓ ${CATEGORIES.length} تصنيفات`);

  let itemCount = 0;
  for (const store of STORES) {
    const { sections, category, ...storeData } = store;
    const created = await prisma.store.create({
      data: { ...storeData, categoryId: categoryBySlug.get(category).id },
    });

    for (const [sectionIndex, section] of sections.entries()) {
      const createdSection = await prisma.menuSection.create({
        data: { storeId: created.id, name: section.name, sort: sectionIndex },
      });

      for (const [itemIndex, item] of section.items.entries()) {
        await prisma.menuItem.create({
          data: {
            ...item,
            description: item.description || '',
            storeId: created.id,
            sectionId: createdSection.id,
            sort: itemIndex,
          },
        });
        itemCount++;
      }
    }
  }
  console.log(`  ✓ ${STORES.length} متاجر و ${itemCount} صنف`);

  const demo = await prisma.user.create({
    data: {
      name: 'أحمد التجريبي',
      phone: '0912345678',
      email: 'demo@wasla.app',
      passwordHash: await bcrypt.hash('123456', 10),
      addresses: {
        create: [
          {
            label: 'البيت',
            area: 'الرياض',
            city: 'الخرطوم',
            details: 'مربع 5، منزل رقم 12، خلف مسجد النور',
            isDefault: true,
          },
          {
            label: 'الشغل',
            area: 'المقرن',
            city: 'الخرطوم',
            details: 'برج النيل، الطابق الثالث، مكتب 305',
          },
        ],
      },
    },
  });
  console.log(`  ✓ مستخدم تجريبي: ${demo.phone} / 123456`);

  console.log('✅ اكتملت التهيئة');
}

main()
  .catch((err) => {
    console.error('❌ فشلت التهيئة:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
