/**
 * Generates a sample HDFC-style bank statement text file for testing.
 * Run with: ts-node prisma/sample-data/generate-sample-pdf.ts
 *
 * This creates a .txt file with a realistic statement format.
 * To test PDF parsing, convert the text to PDF using any text-to-PDF tool
 * or use this as a reference for manual test data.
 */

import * as fs from 'fs';
import * as path from 'path';

const statement = `HDFC Bank
Statement of Account
Account Number: XXXX1234
Account Holder: Test User
Statement Period: 01/01/2024 to 31/01/2024

Date          Narration                              Chq/Ref No.    Value Dt    Withdrawal    Deposit    Closing Bal
01/01/24  Opening Balance                                                                              45000.00
02/01/24  SALARY CREDIT JAN 2024                  REF001234      02/01/24                 85000.00   130000.00
03/01/24  SWIGGY ORDER 9876543210                 UPI9001        03/01/24     450.00                 129550.00
04/01/24  AMAZON PAY-IN TXID887766               AMZN8877       04/01/24    2399.00                 127151.00
05/01/24  ATM WITHDRAWAL BANGALORE                ATM4567        05/01/24    5000.00                 122151.00
06/01/24  ZOMATO FOOD DELIVERY                    UPI7654        06/01/24     380.00                 121771.00
07/01/24  NETFLIX SUBSCRIPTION                    NF12345        07/01/24     649.00                 121122.00
08/01/24  UBER TECHNOLOGIES INDIA                 UB99001        08/01/24     245.00                 120877.00
09/01/24  AIRTEL BROADBAND RECHARGE               AIR3456        09/01/24     999.00                 119878.00
10/01/24  BESCOM ELECTRICITY BILL                 BSC7890        10/01/24    2200.00                 117678.00
12/01/24  BIGBASKET ONLINE GROCERY                BB23456        12/01/24    1850.00                 115828.00
13/01/24  PVRINOX CINEMAS BOOKING                 BMS5678        13/01/24    1200.00                 114628.00
14/01/24  APOLLO PHARMACY PURCHASE                APL1234        14/01/24     580.00                 114048.00
15/01/24  RENT PAYMENT NEFT                       NEFT0015       15/01/24   20000.00                  94048.00
16/01/24  OYO HOTEL BOOKING                       OYO9001        16/01/24    3500.00                  90548.00
17/01/24  NEFT TRANSFER TO SAVINGS                NFT2345        17/01/24   10000.00                  80548.00
18/01/24  ZERODHA SECURITIES MF                   ZRD5678        18/01/24    5000.00                  75548.00
19/01/24  FLIPKART INTERNET PVTLTD                FK98765        19/01/24    1599.00                  73949.00
20/01/24  DOMINOS PIZZA ORDER                     DOM4321        20/01/24     650.00                  73299.00
22/01/24  IRCTC RAIL TICKET BOOKING               IRCTC789       22/01/24    2400.00                  70899.00
23/01/24  DMART RETAIL PURCHASE                   DMT5432        23/01/24    3200.00                  67699.00
24/01/24  EMI PAYMENT HDFC CREDIT CARD            EMI1234        24/01/24   12000.00                  55699.00
25/01/24  BANK ANNUAL CHARGES                     CHG5555        25/01/24     295.00                  55404.00
26/01/24  RAPIDO BIKE TAXI                        RAP7890        26/01/24     120.00                  55284.00
27/01/24  KFC RESTAURANT ORDER                    KFC1234        27/01/24     540.00                  54744.00
28/01/24  STARBUCKS COFFEE SHOP                   STB5678        28/01/24     420.00                  54324.00
29/01/24  GROWW MUTUAL FUND SIP                   GRW9012        29/01/24    3000.00                  51324.00
30/01/24  MYNTRA FASHION STORE                    MYN3456        30/01/24    2199.00                  49125.00
31/01/24  Closing Balance                                                                               49125.00
`;

const outputPath = path.join(__dirname, 'sample-hdfc-statement.txt');
fs.writeFileSync(outputPath, statement);
console.log(`Sample statement written to: ${outputPath}`);
console.log('Use this text content as a basis to create a test PDF.');
