# Price Book Functionality Parity Audit: Salesforce vs. SaaS

This document provides a detailed technical comparison of the **Price Book Management** functionality between the original Salesforce package and the current NestJS/Prisma/Next.js SaaS implementation.

---

## Technical Comparison Matrix

| Feature | Salesforce Package (`AddFeesController.cls`) | SaaS Implementation (`Prisma Schema & NestJS`) | Parity Status & Action Required |
| :--- | :--- | :--- | :--- |
| **Price Book Object** | `Pricebook2` (Standard) | `Pricebook` (Prisma Model) | **Equivalent**. Both represent a set of product prices. |
| **Price Book Entries** | `PricebookEntry` (Standard) | `PricebookEntry` (Prisma Model) | **Equivalent**. Both link a Product to a Price Book with a `UnitPrice`. |
| **Products (Fee Types)** | `Product2` (Standard) with `Family = 'Fee'` | `Product` (Prisma Model) | **Equivalent**. Both store fee product definitions. |
| **Class Linkage** | **Name-Based Matching**: No lookup field. Queries by `Name LIKE ClassName + '%'`. | **ID-Based Relationship** (Target): We will add `classId` to the `Pricebook` table. | **Gap Identified**. SaaS must use `classId` for strong relational integrity, avoiding fragile name matching. |
| **Academic Year Linkage** | `Academic_Year__c` (Custom Lookup field) | `academicYearId` (Prisma Relation) | **Equivalent**. Both link the price book to a specific academic year. |
| **Standard/Custom Entry Requirement** | Strict Salesforce validation requiring a Standard Pricebook entry before a Custom Pricebook entry. | No such requirement. Direct mapping of `PricebookEntry` is sufficient. | **Simplified**. SaaS does not need standard price books, keeping queries simpler. |
| **Loading Existing Prices** | Queries `PricebookEntry` linked to the class's Price Book for the selected Academic Year. | Mocks default prices on the frontend; does not fetch from the database. | **Major Gap**. SaaS must implement an API to load existing price items and their values when class + year are selected. |
| **Preventing Duplicates** | Queries by exact name and academic year before inserting a new `Pricebook2`. | Will query by `classId`, `academicYearId`, and `tenantId` (the true relational key). | **Improved**. SaaS will use composite queries to prevent duplicate price books. |
| **Upsert Logic** | Updates the price if the entry exists, otherwise inserts a new entry. | Not implemented in SaaS backend. | **Major Gap**. SaaS backend must implement `upsert` for price book entries. |
| **Validations** | Validates that academic year and class are selected, and prices are positive (> 0). | Mocks simple validation on the frontend. | **Gap**. Need to implement comprehensive backend validations. |

---

## Detailed Salesforce Package Analysis

In the Salesforce package:
1. **Fee Products** are standard `Product2` records categorized with `Family = 'Fee'`.
2. **Standard Pricebook entries** are created for each fee product with their respective price because Salesforce requires standard prices before custom prices can be set.
3. **Class Pricebooks** are retrieved or created by name (`"Grade 10 - 2026-27"`).
4. **Custom Pricebook entries** are then created or updated to assign the specific fee price for that Class and Academic Year.
5. When a class is selected, `getExistingPrices` converts the class name, finds the pricebook, and fetches existing prices.

---

## Gap Analysis & Refinement Plan

Based on the parity audit, the following adjustments are required in the SaaS implementation:

### 1. Schema Modifications (Database Level)
* We must add a direct relationship from `Pricebook` to `Class` using `classId` to avoid name-based matching:
  ```prisma
  model Pricebook {
    id             String        @id @default(uuid())
    name           String
    isActive       Boolean       @default(true)
    academicYearId String?
    academicYear   AcademicYear? @relation(fields: [academicYearId], references: [id], onDelete: SetNull)
    classId        String?
    class          Class?        @relation(fields: [classId], references: [id], onDelete: SetNull)
    tenantId       String
    tenant         Tenant        @relation(fields: [tenantId], references: [id], onDelete: Cascade)
    pricebookEntries PricebookEntry[]
    ...
  }
  ```

### 2. NestJS Backend APIs
* **`GET /billing/pricebook`**: Fetch the existing pricebook entries for a given `classId` and `academicYearId` to populate the frontend table.
* **`POST /billing/pricebook`**: Upsert the pricebook and its corresponding pricebook entries. If a pricebook already exists, update the prices of the checked products, deactivate unchecked products, and insert any new products.
* **`GET /billing/products`**: Fetch all active fee products (from the `Product` table) to display in the "Set Price Book" tab.
* **`POST /billing/products`**: Save new products to the database with a generated product code (replacing the current frontend timeout mock).

### 3. Next.js Frontend Updates
* Load active classes and academic years from the APIs (already partially queryable, but needs backend table synchronization).
* Trigger a fetch to load existing price items when a Class and Academic Year are selected in the "Set Price Book" tab.
* Display custom Toast notifications instead of browser `alert()` popups upon successful save/creation.
* Automatically close modals and refresh lists.
