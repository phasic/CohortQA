# Banking & Insurance for private individuals & business - ING Belgium Test Plan

The Banking & Insurance for private individuals & business - ING Belgium application provides the following functionality:

**Explored Pages:** 4 page(s) were analyzed during exploration.


**Pages Explored:**
1. Banking & Insurance for private individuals & business - ING Belgium (https://www.ing.be/en/individuals)
2. Investing money - ING Belgium (https://www.ing.be/en/individuals/investing)
3. Want to grow your money? Discover ING's investment solutions. - ING Belgium (https://www.ing.be/en/individuals/investing/grow-your-money)
4. Investment calculator - ING Belgium (https://www.ing.be/en/individuals/investing/investment-calculator)


## Test Scenarios

### 1. Verify Banking & Insurance for private individuals & business - ING Belgium Loads Correctly

**Seed Test**: `tests/seed/seed.spec.ts`

**Steps:**
1. Navigate to https://www.ing.be/en/individuals

**Expected Results:**
- Page loads without errors
- Page title is "Banking & Insurance for private individuals & business - ING Belgium"
- Key elements are visible

### 2. Verify Investing money - ING Belgium Loads Correctly

**Seed Test**: `tests/seed/seed.spec.ts`

**Steps:**
1. Navigate to https://www.ing.be/en/individuals/investing

**Expected Results:**
- Page loads without errors
- Page title is "Investing money - ING Belgium"
- Key elements are visible

### 3. Verify Want to grow your money? Discover ING's investment solutions. - ING Belgium Loads Correctly

**Seed Test**: `tests/seed/seed.spec.ts`

**Steps:**
1. Navigate to https://www.ing.be/en/individuals/investing/grow-your-money

**Expected Results:**
- Page loads without errors
- Page title is "Want to grow your money? Discover ING's investment solutions. - ING Belgium"
- Key elements are visible

### 4. Verify Investment calculator - ING Belgium Loads Correctly

**Seed Test**: `tests/seed/seed.spec.ts`

**Steps:**
1. Navigate to https://www.ing.be/en/individuals/investing/investment-calculator

**Expected Results:**
- Page loads without errors
- Page title is "Investment calculator - ING Belgium"
- Key elements are visible

### 5. Navigate from Banking & Insurance for private individuals & business - ING Belgium to Investing money - ING Belgium

**Seed Test**: `tests/seed/seed.spec.ts`

**Steps:**
1. Navigate to https://www.ing.be/en/individuals
2. Click on the "link" link that navigates to Investing money - ING Belgium
3. Wait for navigation to complete

**Expected Results:**
- Link with text "link" is visible and clickable
- Navigation completes without errors
- Page title is "Investing money - ING Belgium"
- URL changes to the target page
- Target page loads successfully

### 6. Navigate from Investing money - ING Belgium to Want to grow your money? Discover ING's investment solutions. - ING Belgium

**Seed Test**: `tests/seed/seed.spec.ts`

**Steps:**
1. Navigate to https://www.ing.be/en/individuals/investing
2. Click on the "link" link that navigates to Want to grow your money? Discover ING's investment solutions. - ING Belgium
3. Wait for navigation to complete

**Expected Results:**
- Link with text "link" is visible and clickable
- Navigation completes without errors
- Page title is "Want to grow your money? Discover ING's investment solutions. - ING Belgium"
- URL changes to the target page
- Target page loads successfully

### 7. Navigate from Want to grow your money? Discover ING's investment solutions. - ING Belgium to Investment calculator - ING Belgium

**Seed Test**: `tests/seed/seed.spec.ts`

**Steps:**
1. Navigate to https://www.ing.be/en/individuals/investing/grow-your-money
2. Click on the "link" link that navigates to Investment calculator - ING Belgium
3. Wait for navigation to complete

**Expected Results:**
- Link with text "link" is visible and clickable
- Navigation completes without errors
- Page title is "Investment calculator - ING Belgium"
- URL changes to the target page
- Target page loads successfully

