import { PrismaClient, PatternType, CategoryType } from '@prisma/client';

const prisma = new PrismaClient();

const categories = [
  { name: 'Food & Dining', type: CategoryType.EXPENSE, color: '#ef4444', icon: '🍔' },
  { name: 'Entertainment', type: CategoryType.EXPENSE, color: '#8b5cf6', icon: '🎬' },
  { name: 'Transport', type: CategoryType.EXPENSE, color: '#3b82f6', icon: '🚗' },
  { name: 'Shopping', type: CategoryType.EXPENSE, color: '#f59e0b', icon: '🛍️' },
  { name: 'Bills & Utilities', type: CategoryType.EXPENSE, color: '#6b7280', icon: '⚡' },
  { name: 'Health', type: CategoryType.EXPENSE, color: '#10b981', icon: '💊' },
  { name: 'Travel', type: CategoryType.EXPENSE, color: '#06b6d4', icon: '✈️' },
  { name: 'Groceries', type: CategoryType.EXPENSE, color: '#84cc16', icon: '🛒' },
  { name: 'Income', type: CategoryType.INCOME, color: '#22c55e', icon: '💰' },
  { name: 'Transfers', type: CategoryType.NEUTRAL, color: '#64748b', icon: '↔️' },
  { name: 'Cash Withdrawal', type: CategoryType.EXPENSE, color: '#a3a3a3', icon: '💵' },
  { name: 'Fees & Charges', type: CategoryType.EXPENSE, color: '#dc2626', icon: '💸' },
  { name: 'Rent', type: CategoryType.EXPENSE, color: '#7c3aed', icon: '🏠' },
  { name: 'EMI / Loans', type: CategoryType.EXPENSE, color: '#b45309', icon: '🏦' },
  { name: 'Investments', type: CategoryType.EXPENSE, color: '#0891b2', icon: '📈' },
  { name: 'Uncategorized', type: CategoryType.NEUTRAL, color: '#9ca3af', icon: '❓' },
];

// priority: higher = matched first
const systemRules = [
  // Income
  { pattern: 'salary', patternType: PatternType.KEYWORD, category: 'Income', priority: 100, isSystem: true },
  { pattern: 'payroll', patternType: PatternType.KEYWORD, category: 'Income', priority: 100, isSystem: true },
  { pattern: 'credited by', patternType: PatternType.KEYWORD, category: 'Income', priority: 90, isSystem: true },
  { pattern: '\\bsal\\b', patternType: PatternType.REGEX, category: 'Income', priority: 90, isSystem: true },

  // Food & Dining
  { pattern: 'swiggy', patternType: PatternType.KEYWORD, category: 'Food & Dining', priority: 80, isSystem: true },
  { pattern: 'zomato', patternType: PatternType.KEYWORD, category: 'Food & Dining', priority: 80, isSystem: true },
  { pattern: 'dominos', patternType: PatternType.KEYWORD, category: 'Food & Dining', priority: 80, isSystem: true },
  { pattern: 'pizza hut', patternType: PatternType.KEYWORD, category: 'Food & Dining', priority: 80, isSystem: true },
  { pattern: 'mcdonalds', patternType: PatternType.KEYWORD, category: 'Food & Dining', priority: 80, isSystem: true },
  { pattern: 'mcdonald', patternType: PatternType.KEYWORD, category: 'Food & Dining', priority: 80, isSystem: true },
  { pattern: 'kfc', patternType: PatternType.KEYWORD, category: 'Food & Dining', priority: 80, isSystem: true },
  { pattern: 'restaurant', patternType: PatternType.KEYWORD, category: 'Food & Dining', priority: 70, isSystem: true },
  { pattern: 'cafe', patternType: PatternType.KEYWORD, category: 'Food & Dining', priority: 70, isSystem: true },
  { pattern: 'starbucks', patternType: PatternType.KEYWORD, category: 'Food & Dining', priority: 80, isSystem: true },
  { pattern: 'blinkit', patternType: PatternType.KEYWORD, category: 'Food & Dining', priority: 80, isSystem: true },
  { pattern: 'zepto', patternType: PatternType.KEYWORD, category: 'Food & Dining', priority: 80, isSystem: true },

  // Groceries
  { pattern: 'bigbasket', patternType: PatternType.KEYWORD, category: 'Groceries', priority: 80, isSystem: true },
  { pattern: 'dmart', patternType: PatternType.KEYWORD, category: 'Groceries', priority: 80, isSystem: true },
  { pattern: 'd-mart', patternType: PatternType.KEYWORD, category: 'Groceries', priority: 80, isSystem: true },
  { pattern: 'reliance fresh', patternType: PatternType.KEYWORD, category: 'Groceries', priority: 80, isSystem: true },
  { pattern: 'more supermarket', patternType: PatternType.KEYWORD, category: 'Groceries', priority: 80, isSystem: true },
  { pattern: 'grofers', patternType: PatternType.KEYWORD, category: 'Groceries', priority: 80, isSystem: true },
  { pattern: 'jiomart', patternType: PatternType.KEYWORD, category: 'Groceries', priority: 80, isSystem: true },

  // Entertainment
  { pattern: 'inox', patternType: PatternType.KEYWORD, category: 'Entertainment', priority: 80, isSystem: true },
  { pattern: 'pvr', patternType: PatternType.KEYWORD, category: 'Entertainment', priority: 80, isSystem: true },
  { pattern: 'cinepolis', patternType: PatternType.KEYWORD, category: 'Entertainment', priority: 80, isSystem: true },
  { pattern: 'cinema', patternType: PatternType.KEYWORD, category: 'Entertainment', priority: 75, isSystem: true },
  { pattern: 'netflix', patternType: PatternType.KEYWORD, category: 'Entertainment', priority: 80, isSystem: true },
  { pattern: 'hotstar', patternType: PatternType.KEYWORD, category: 'Entertainment', priority: 80, isSystem: true },
  { pattern: 'disney', patternType: PatternType.KEYWORD, category: 'Entertainment', priority: 80, isSystem: true },
  { pattern: 'spotify', patternType: PatternType.KEYWORD, category: 'Entertainment', priority: 80, isSystem: true },
  { pattern: 'prime video', patternType: PatternType.KEYWORD, category: 'Entertainment', priority: 80, isSystem: true },
  { pattern: 'bookmyshow', patternType: PatternType.KEYWORD, category: 'Entertainment', priority: 80, isSystem: true },

  // Transport
  { pattern: 'uber', patternType: PatternType.KEYWORD, category: 'Transport', priority: 80, isSystem: true },
  { pattern: 'ola', patternType: PatternType.KEYWORD, category: 'Transport', priority: 80, isSystem: true },
  { pattern: 'rapido', patternType: PatternType.KEYWORD, category: 'Transport', priority: 80, isSystem: true },
  { pattern: 'namma yatri', patternType: PatternType.KEYWORD, category: 'Transport', priority: 80, isSystem: true },
  { pattern: 'irctc', patternType: PatternType.KEYWORD, category: 'Transport', priority: 80, isSystem: true },
  { pattern: 'indigo', patternType: PatternType.KEYWORD, category: 'Transport', priority: 80, isSystem: true },
  { pattern: 'air india', patternType: PatternType.KEYWORD, category: 'Transport', priority: 80, isSystem: true },
  { pattern: 'spicejet', patternType: PatternType.KEYWORD, category: 'Transport', priority: 80, isSystem: true },
  { pattern: 'metro', patternType: PatternType.KEYWORD, category: 'Transport', priority: 60, isSystem: true },
  { pattern: 'petrol', patternType: PatternType.KEYWORD, category: 'Transport', priority: 70, isSystem: true },
  { pattern: 'fuel', patternType: PatternType.KEYWORD, category: 'Transport', priority: 70, isSystem: true },

  // Shopping
  { pattern: 'amazon', patternType: PatternType.KEYWORD, category: 'Shopping', priority: 80, isSystem: true },
  { pattern: 'flipkart', patternType: PatternType.KEYWORD, category: 'Shopping', priority: 80, isSystem: true },
  { pattern: 'myntra', patternType: PatternType.KEYWORD, category: 'Shopping', priority: 80, isSystem: true },
  { pattern: 'ajio', patternType: PatternType.KEYWORD, category: 'Shopping', priority: 80, isSystem: true },
  { pattern: 'nykaa', patternType: PatternType.KEYWORD, category: 'Shopping', priority: 80, isSystem: true },
  { pattern: 'meesho', patternType: PatternType.KEYWORD, category: 'Shopping', priority: 80, isSystem: true },
  { pattern: 'snapdeal', patternType: PatternType.KEYWORD, category: 'Shopping', priority: 80, isSystem: true },

  // Bills & Utilities
  { pattern: 'electricity', patternType: PatternType.KEYWORD, category: 'Bills & Utilities', priority: 80, isSystem: true },
  { pattern: 'bescom', patternType: PatternType.KEYWORD, category: 'Bills & Utilities', priority: 80, isSystem: true },
  { pattern: 'mseb', patternType: PatternType.KEYWORD, category: 'Bills & Utilities', priority: 80, isSystem: true },
  { pattern: 'tata power', patternType: PatternType.KEYWORD, category: 'Bills & Utilities', priority: 80, isSystem: true },
  { pattern: 'broadband', patternType: PatternType.KEYWORD, category: 'Bills & Utilities', priority: 80, isSystem: true },
  { pattern: 'wifi', patternType: PatternType.KEYWORD, category: 'Bills & Utilities', priority: 80, isSystem: true },
  { pattern: 'internet', patternType: PatternType.KEYWORD, category: 'Bills & Utilities', priority: 70, isSystem: true },
  { pattern: 'airtel', patternType: PatternType.KEYWORD, category: 'Bills & Utilities', priority: 80, isSystem: true },
  { pattern: 'jio', patternType: PatternType.KEYWORD, category: 'Bills & Utilities', priority: 80, isSystem: true },
  { pattern: 'vodafone', patternType: PatternType.KEYWORD, category: 'Bills & Utilities', priority: 80, isSystem: true },
  { pattern: 'bsnl', patternType: PatternType.KEYWORD, category: 'Bills & Utilities', priority: 80, isSystem: true },
  { pattern: 'recharge', patternType: PatternType.KEYWORD, category: 'Bills & Utilities', priority: 70, isSystem: true },
  { pattern: 'gas bill', patternType: PatternType.KEYWORD, category: 'Bills & Utilities', priority: 80, isSystem: true },
  { pattern: 'water bill', patternType: PatternType.KEYWORD, category: 'Bills & Utilities', priority: 80, isSystem: true },

  // Health
  { pattern: 'pharmacy', patternType: PatternType.KEYWORD, category: 'Health', priority: 80, isSystem: true },
  { pattern: 'medical', patternType: PatternType.KEYWORD, category: 'Health', priority: 80, isSystem: true },
  { pattern: 'hospital', patternType: PatternType.KEYWORD, category: 'Health', priority: 80, isSystem: true },
  { pattern: 'clinic', patternType: PatternType.KEYWORD, category: 'Health', priority: 80, isSystem: true },
  { pattern: 'apollo', patternType: PatternType.KEYWORD, category: 'Health', priority: 80, isSystem: true },
  { pattern: 'medplus', patternType: PatternType.KEYWORD, category: 'Health', priority: 80, isSystem: true },
  { pattern: 'netmeds', patternType: PatternType.KEYWORD, category: 'Health', priority: 80, isSystem: true },
  { pattern: 'pharmeasy', patternType: PatternType.KEYWORD, category: 'Health', priority: 80, isSystem: true },
  { pattern: 'tata 1mg', patternType: PatternType.KEYWORD, category: 'Health', priority: 80, isSystem: true },
  { pattern: 'doctor', patternType: PatternType.KEYWORD, category: 'Health', priority: 70, isSystem: true },

  // Travel
  { pattern: 'hotel', patternType: PatternType.KEYWORD, category: 'Travel', priority: 80, isSystem: true },
  { pattern: 'oyo', patternType: PatternType.KEYWORD, category: 'Travel', priority: 80, isSystem: true },
  { pattern: 'makemytrip', patternType: PatternType.KEYWORD, category: 'Travel', priority: 80, isSystem: true },
  { pattern: 'goibibo', patternType: PatternType.KEYWORD, category: 'Travel', priority: 80, isSystem: true },
  { pattern: 'yatra', patternType: PatternType.KEYWORD, category: 'Travel', priority: 80, isSystem: true },
  { pattern: 'cleartrip', patternType: PatternType.KEYWORD, category: 'Travel', priority: 80, isSystem: true },

  // Cash Withdrawal
  { pattern: 'atm', patternType: PatternType.KEYWORD, category: 'Cash Withdrawal', priority: 85, isSystem: true },
  { pattern: 'cash withdrawal', patternType: PatternType.KEYWORD, category: 'Cash Withdrawal', priority: 85, isSystem: true },
  { pattern: 'cash wtdl', patternType: PatternType.KEYWORD, category: 'Cash Withdrawal', priority: 85, isSystem: true },

  // Fees & Charges
  { pattern: 'annual fee', patternType: PatternType.KEYWORD, category: 'Fees & Charges', priority: 80, isSystem: true },
  { pattern: 'bank charge', patternType: PatternType.KEYWORD, category: 'Fees & Charges', priority: 80, isSystem: true },
  { pattern: 'service charge', patternType: PatternType.KEYWORD, category: 'Fees & Charges', priority: 80, isSystem: true },
  { pattern: 'late fee', patternType: PatternType.KEYWORD, category: 'Fees & Charges', priority: 80, isSystem: true },
  { pattern: 'gst', patternType: PatternType.KEYWORD, category: 'Fees & Charges', priority: 60, isSystem: true },
  { pattern: 'interest charge', patternType: PatternType.KEYWORD, category: 'Fees & Charges', priority: 80, isSystem: true },

  // Rent
  { pattern: 'rent', patternType: PatternType.KEYWORD, category: 'Rent', priority: 80, isSystem: true },
  { pattern: 'house rent', patternType: PatternType.KEYWORD, category: 'Rent', priority: 85, isSystem: true },
  { pattern: 'maintenance charges', patternType: PatternType.KEYWORD, category: 'Rent', priority: 75, isSystem: true },

  // EMI / Loans
  { pattern: 'emi', patternType: PatternType.KEYWORD, category: 'EMI / Loans', priority: 85, isSystem: true },
  { pattern: 'loan', patternType: PatternType.KEYWORD, category: 'EMI / Loans', priority: 80, isSystem: true },
  { pattern: 'repayment', patternType: PatternType.KEYWORD, category: 'EMI / Loans', priority: 80, isSystem: true },

  // Investments
  { pattern: 'mutual fund', patternType: PatternType.KEYWORD, category: 'Investments', priority: 85, isSystem: true },
  { pattern: 'zerodha', patternType: PatternType.KEYWORD, category: 'Investments', priority: 85, isSystem: true },
  { pattern: 'groww', patternType: PatternType.KEYWORD, category: 'Investments', priority: 85, isSystem: true },
  { pattern: 'upstox', patternType: PatternType.KEYWORD, category: 'Investments', priority: 85, isSystem: true },
  { pattern: 'nps', patternType: PatternType.KEYWORD, category: 'Investments', priority: 85, isSystem: true },
  { pattern: 'ppf', patternType: PatternType.KEYWORD, category: 'Investments', priority: 85, isSystem: true },
  { pattern: 'sip', patternType: PatternType.KEYWORD, category: 'Investments', priority: 85, isSystem: true },
  { pattern: 'fd booking', patternType: PatternType.KEYWORD, category: 'Investments', priority: 85, isSystem: true },

  // Transfers
  { pattern: 'neft', patternType: PatternType.KEYWORD, category: 'Transfers', priority: 70, isSystem: true },
  { pattern: 'imps', patternType: PatternType.KEYWORD, category: 'Transfers', priority: 70, isSystem: true },
  { pattern: 'rtgs', patternType: PatternType.KEYWORD, category: 'Transfers', priority: 70, isSystem: true },
  { pattern: 'upi', patternType: PatternType.KEYWORD, category: 'Transfers', priority: 50, isSystem: true },
  { pattern: 'transfer', patternType: PatternType.KEYWORD, category: 'Transfers', priority: 50, isSystem: true },
];

async function main() {
  console.log('Seeding database...');

  // Upsert categories
  const categoryMap: Record<string, string> = {};
  for (const cat of categories) {
    const created = await prisma.category.upsert({
      where: { name: cat.name },
      update: {},
      create: cat,
    });
    categoryMap[cat.name] = created.id;
  }
  console.log(`Created ${categories.length} categories`);

  // Delete existing system rules then recreate
  await prisma.classificationRule.deleteMany({ where: { isSystem: true } });
  for (const rule of systemRules) {
    const categoryId = categoryMap[rule.category];
    if (!categoryId) {
      console.warn(`Category not found for rule: ${rule.pattern}`);
      continue;
    }
    await prisma.classificationRule.create({
      data: {
        pattern: rule.pattern,
        patternType: rule.patternType,
        categoryId,
        priority: rule.priority,
        isSystem: true,
        isActive: true,
      },
    });
  }
  console.log(`Created ${systemRules.length} system classification rules`);
  console.log('Seeding complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
