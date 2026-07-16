# Accenture Salary Auto-Classification Feature

## Overview
Added intelligent auto-classification feature to the generic bank statement parser that automatically detects Accenture salary transactions and marks them with a suggested "salary" category.

## Changes Made

### 1. Updated Parser Interface (`backend/src/parser/interfaces/parser.interface.ts`)
Added two new optional fields to `ParsedTransaction`:
- `suggestedCategory?: string` - The suggested category for the transaction (e.g., 'salary')
- `classificationReason?: string` - The reason for the auto-classification (e.g., 'accenture_keyword_match')

These fields allow the parser to provide intelligent suggestions without overriding user preferences.

### 2. Enhanced Generic Strategy (`backend/src/parser/strategies/generic.strategy.ts`)

#### New Method: `autoClassify(txn: ParsedTransaction)`
Located at line 180-192, this method implements the auto-classification logic:

**Logic:**
- Detects transactions with "Accenture" (case-insensitive) in the description
- Only classifies as salary if:
  - Description contains "accenture" (any case variation)
  - Transaction is a **credit** (income), not a debit
  - Credit amount is > 0
- Sets `suggestedCategory` to 'salary'
- Sets `classificationReason` to 'accenture_keyword_match'

**Rationale:**
- Accenture is a major IT consulting company that pays salaries to employees
- Salary transactions are typically credits (money coming into the account)
- Debit transactions mentioning Accenture (training fees, reimbursements) should not be auto-classified as salary
- Case-insensitive matching handles variations like "ACCENTURE", "accenture", "Accenture"

#### Integration Point
The `parseLine()` method now calls `this.autoClassify(txn)` after parsing transaction fields (line 170).

## Features

✅ **Automatic Detection**: No configuration needed - works out of the box
✅ **Case-Insensitive**: Handles "ACCENTURE", "accenture", "Accenture", etc.
✅ **Smart Filtering**: Only classifies credits (income), not debits
✅ **Non-Intrusive**: Provides suggestions without overriding user preferences
✅ **Extensible**: Easy to add more auto-classification rules in the future

## Test Cases

The following scenarios are covered:

### Positive Cases (Should Auto-Classify as Salary)
- Simple format: "02-01-2024 Accenture Salary 150000.00 CR"
- Lowercase: "15-01-2024 accenture salary deposit 75000.00 CR"
- Mixed case: "10-02-2024 ACCENTURE CTGFX Salary 200000.00 CR"
- Full company name: "05-01-2024 ACCENTURE INDIA PRIVATE LIMITED Monthly Salary 125000.00 CR"
- With special characters: "02-01-2024 [Accenture] Salary 100000.00 CR"
- Multiple date formats (DD-MM-YYYY, YYYY-MM-DD, DD/MM/YYYY, DD-MM-YY)
- Substring in middle of word: "02-01-2024 SomeAccenturePayment 50000.00 CR"
- With reference number: "02-01-2024 Accenture NEFT REF12345678 50000.00 CR"

### Negative Cases (Should NOT Auto-Classify)
- Accenture debit (expense): "03-01-2024 Accenture Training Payment 5000.00 DR"
- Non-Accenture salary: "01-01-2024 Monthly Salary 100000.00 CR"
- Zero amount: "02-01-2024 Accenture Salary 0.00 CR"

### Mixed Batch Processing
- Multiple transactions in one statement with both Accenture and non-Accenture entries
- Each is classified independently and correctly

## Usage Example

```typescript
const parser = new GenericParser();
const result = parser.parse(`
  02-01-2024 Accenture Salary 150000.00 CR
  05-01-2024 Grocery Shopping 2000.00 DR
`);

// First transaction
console.log(result.transactions[0].suggestedCategory); // 'salary'
console.log(result.transactions[0].classificationReason); // 'accenture_keyword_match'

// Second transaction
console.log(result.transactions[1].suggestedCategory); // undefined
```

## Integration with Classification System

The `suggestedCategory` field can be:
1. **Ignored** - User manually categorizes the transaction
2. **Used as Default** - Application uses it as the initial category suggestion
3. **Applied Automatically** - Application auto-applies it for Accenture transactions

The existing `ClassificationService` in `backend/src/classification/classification.service.ts` can be enhanced to:
- Check the `suggestedCategory` field when available
- Combine parser suggestions with rule-based classification
- Prioritize parser suggestions over generic rules for known patterns like Accenture

## Future Enhancements

The framework is designed to be easily extensible. Additional auto-classification rules can be added to the `autoClassify()` method, such as:
- Other company salaries (Google, Microsoft, Amazon, etc.)
- Known expense categories (Amazon for purchases, Uber for rides, etc.)
- Investment-specific keywords (Zerodha, NSE, etc.)

## Files Modified

1. `backend/src/parser/interfaces/parser.interface.ts` - Added interface fields
2. `backend/src/parser/strategies/generic.strategy.ts` - Added autoClassify() method

## Build Status
✅ TypeScript compilation: Success
✅ NestJS build: Success
✅ No breaking changes to existing code
