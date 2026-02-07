# Banking & Insurance for private individuals & business - ING Belgium Test Plan

The Banking & Insurance for private individuals & business - ING Belgium application provides the following functionality:

**Explored Pages:** 4 page(s) were analyzed during exploration.


**Pages Explored:**
1. Banking & Insurance for private individuals & business - ING Belgium (https://www.ing.be/en/individuals)
2. When should you give your child a bank card? - ING Belgium (https://www.ing.be/en/individuals/daily-banking/what-is-the-best-age-to-give-a-child-a-bank-card)
3. Get in touch - ING Belgium (https://www.ing.be/en/individuals/services/get-in-touch)
4. Not completely satisfied with our services? Contact us! - ING Belgium (https://www.ing.be/en/individuals/services/complaint-handling)


## Test Scenarios

### 1. Verify Banking & Insurance for private individuals & business - ING Belgium Loads Correctly

**Seed Test**: `tests/seed/seed.spec.ts`

**Steps:**
1. Navigate to https://www.ing.be/en/individuals

**Expected Results:**
- Page loads without errors
- Page title is "Banking & Insurance for private individuals & business - ING Belgium"
- Key elements are visible

### 2. Verify When should you give your child a bank card? - ING Belgium Loads Correctly

**Seed Test**: `tests/seed/seed.spec.ts`

**Steps:**
1. Navigate to https://www.ing.be/en/individuals/daily-banking/what-is-the-best-age-to-give-a-child-a-bank-card

**Expected Results:**
- Page loads without errors
- Page title is "When should you give your child a bank card? - ING Belgium"
- Key elements are visible

### 3. Verify Get in touch - ING Belgium Loads Correctly

**Seed Test**: `tests/seed/seed.spec.ts`

**Steps:**
1. Navigate to https://www.ing.be/en/individuals/services/get-in-touch

**Expected Results:**
- Page loads without errors
- Page title is "Get in touch - ING Belgium"
- Key elements are visible

### 4. Verify Not completely satisfied with our services? Contact us! - ING Belgium Loads Correctly

**Seed Test**: `tests/seed/seed.spec.ts`

**Steps:**
1. Navigate to https://www.ing.be/en/individuals/services/complaint-handling

**Expected Results:**
- Page loads without errors
- Page title is "Not completely satisfied with our services? Contact us! - ING Belgium"
- Key elements are visible

### 5. Navigate from Banking & Insurance for private individuals & business - ING Belgium to When should you give your child a bank card? - ING Belgium

**Seed Test**: `tests/seed/seed.spec.ts`

**Steps:**
1. Navigate to https://www.ing.be/en/individuals
2. Click on the "link" link that navigates to When should you give your child a bank card? - ING Belgium
3. Wait for navigation to complete

**Expected Results:**
- Link with text "link" is visible and clickable
- Navigation completes without errors
- Page title is "When should you give your child a bank card? - ING Belgium"
- URL changes to the target page
- Target page loads successfully

### 6. Navigate from When should you give your child a bank card? - ING Belgium to Get in touch - ING Belgium

**Seed Test**: `tests/seed/seed.spec.ts`

**Steps:**
1. Navigate to https://www.ing.be/en/individuals/daily-banking/what-is-the-best-age-to-give-a-child-a-bank-card
2. Click on the "link" link that navigates to Get in touch - ING Belgium
3. Wait for navigation to complete

**Expected Results:**
- Link with text "link" is visible and clickable
- Navigation completes without errors
- Page title is "Get in touch - ING Belgium"
- URL changes to the target page
- Target page loads successfully

### 7. Navigate from Get in touch - ING Belgium to Not completely satisfied with our services? Contact us! - ING Belgium

**Seed Test**: `tests/seed/seed.spec.ts`

**Steps:**
1. Navigate to https://www.ing.be/en/individuals/services/get-in-touch
2. Click on the "link" link that navigates to Not completely satisfied with our services? Contact us! - ING Belgium
3. Wait for navigation to complete

**Expected Results:**
- Link with text "link" is visible and clickable
- Navigation completes without errors
- Page title is "Not completely satisfied with our services? Contact us! - ING Belgium"
- URL changes to the target page
- Target page loads successfully

