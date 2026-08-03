const express = require('express');
const prisma = require('../prisma');
const { HttpError, asyncHandler } = require('../lib/http');

const router = express.Router();

router.get(
  '/categories',
  asyncHandler(async (_req, res) => {
    const categories = await prisma.category.findMany({
      orderBy: { sort: 'asc' },
      include: { _count: { select: { stores: true } } },
    });

    res.json({
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        icon: c.icon,
        storeCount: c._count.stores,
      })),
    });
  })
);

router.get(
  '/stores',
  asyncHandler(async (req, res) => {
    const { category, q, featured } = req.query;

    const where = {
      ...(category && { category: { slug: String(category) } }),
      ...(featured === 'true' && { isFeatured: true }),
      // SQLite في Prisma لا يدعم mode:'insensitive'، والبحث العربي حساس للحروف أصلاً
      ...(q && {
        OR: [
          { name: { contains: String(q) } },
          { description: { contains: String(q) } },
          { area: { contains: String(q) } },
        ],
      }),
    };

    const stores = await prisma.store.findMany({
      where,
      orderBy: [{ isOpen: 'desc' }, { isFeatured: 'desc' }, { rating: 'desc' }],
      include: { category: true },
    });

    res.json({ stores: stores.map(serializeStore) });
  })
);

router.get(
  '/stores/:slug',
  asyncHandler(async (req, res) => {
    const store = await prisma.store.findUnique({
      where: { slug: req.params.slug },
      include: {
        category: true,
        menuSections: {
          orderBy: { sort: 'asc' },
          include: {
            items: {
              where: { isAvailable: true },
              orderBy: { sort: 'asc' },
            },
          },
        },
      },
    });

    if (!store) throw new HttpError(404, 'المتجر غير موجود', 'STORE_NOT_FOUND');

    res.json({
      store: {
        ...serializeStore(store),
        sections: store.menuSections.map((section) => ({
          id: section.id,
          name: section.name,
          items: section.items.map(serializeItem),
        })),
      },
    });
  })
);

/** أشهر الأصناف عبر كل المتاجر — تغذّي قسم "الأكثر طلباً" في الرئيسية */
router.get(
  '/popular-items',
  asyncHandler(async (_req, res) => {
    const items = await prisma.menuItem.findMany({
      where: { isPopular: true, isAvailable: true },
      take: 12,
      include: { store: { select: { name: true, slug: true } } },
    });

    res.json({
      items: items.map((item) => ({
        ...serializeItem(item),
        storeName: item.store.name,
        storeSlug: item.store.slug,
      })),
    });
  })
);

function serializeStore(store) {
  return {
    id: store.id,
    name: store.name,
    slug: store.slug,
    description: store.description,
    imageUrl: store.imageUrl,
    logoUrl: store.logoUrl,
    area: store.area,
    rating: store.rating,
    ratingCount: store.ratingCount,
    deliveryFee: store.deliveryFee,
    minOrder: store.minOrder,
    etaMinutes: store.etaMinutes,
    isOpen: store.isOpen,
    isFeatured: store.isFeatured,
    category: store.category ? { name: store.category.name, slug: store.category.slug } : null,
  };
}

function serializeItem(item) {
  return {
    id: item.id,
    name: item.name,
    description: item.description,
    price: item.price,
    imageUrl: item.imageUrl,
    isPopular: item.isPopular,
  };
}

module.exports = router;
