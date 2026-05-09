import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const PAIRS = [
  { from: 'USD', to: 'KGS' },
  { from: 'USD', to: 'KZT' },
  { from: 'USD', to: 'RUB' },
  { from: 'USD', to: 'CNY' },
  { from: 'USD', to: 'AMD' },
  { from: 'USD', to: 'UZS' },
  { from: 'EUR', to: 'USD' },
  { from: 'EUR', to: 'KGS' },
  { from: 'EUR', to: 'KZT' },
  { from: 'EUR', to: 'RUB' },
  { from: 'CNY', to: 'USD' },
  { from: 'JPY', to: 'USD' },
];

export async function updateExchangeRates(): Promise<void> {
  console.log('💱 Updating exchange rates...');

  try {
    // Frankfurter API — официальные данные ЕЦБ, без API ключа
    const res = await fetch(
      'https://api.frankfurter.app/latest?from=USD&to=KGS,KZT,RUB,CNY,EUR,AMD,UZS,JPY'
    );

    if (!res.ok) throw new Error(`Frankfurter API error: ${res.status}`);

    const data = await res.json() as {
      base: string;
      rates: Record<string, number>;
    };

    const now = new Date();
    const inserts = [];

    // USD → все валюты
    for (const [to, rate] of Object.entries(data.rates)) {
      inserts.push({
        from_cur: 'USD' as any,
        to_cur: to as any,
        rate,
        recorded_at: now,
      });

      // Обратный курс (валюта → USD)
      inserts.push({
        from_cur: to as any,
        to_cur: 'USD' as any,
        rate: 1 / rate,
        recorded_at: now,
      });
    }

    // EUR → KGS (через USD)
    if (data.rates['EUR'] && data.rates['KGS']) {
      const eurToKgs = data.rates['KGS'] / data.rates['EUR'];
      inserts.push({
        from_cur: 'EUR' as any,
        to_cur: 'KGS' as any,
        rate: eurToKgs,
        recorded_at: now,
      });
    }

    // EUR → KZT
    if (data.rates['EUR'] && data.rates['KZT']) {
      const eurToKzt = data.rates['KZT'] / data.rates['EUR'];
      inserts.push({
        from_cur: 'EUR' as any,
        to_cur: 'KZT' as any,
        rate: eurToKzt,
        recorded_at: now,
      });
    }

    // EUR → RUB
    if (data.rates['EUR'] && data.rates['RUB']) {
      const eurToRub = data.rates['RUB'] / data.rates['EUR'];
      inserts.push({
        from_cur: 'EUR' as any,
        to_cur: 'RUB' as any,
        rate: eurToRub,
        recorded_at: now,
      });
    }

    await prisma.exchangeRate.createMany({
      data: inserts,
      skipDuplicates: false,
    });

    console.log(`✅ Updated ${inserts.length} exchange rates`);

  } catch (err) {
    console.error('❌ Exchange rate update failed:', err);
    // Не бросаем ошибку — используем старые курсы
  }
}

// Получить актуальный курс из БД
export async function getRate(
  fromCur: string,
  toCur: string
): Promise<number> {
  if (fromCur === toCur) return 1;

  const rate = await prisma.exchangeRate.findFirst({
    where: {
      from_cur: fromCur as any,
      to_cur: toCur as any,
    },
    orderBy: { recorded_at: 'desc' },
  });

  if (!rate) {
    console.warn(`Rate not found: ${fromCur} → ${toCur}, using 1`);
    return 1;
  }

  return Number(rate.rate);
}