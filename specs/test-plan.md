# Banking & Insurance for private individuals & business - ING Belgium Test Plan

The Banking & Insurance for private individuals & business - ING Belgium application provides the following functionality:

**Explored Pages:** 4 page(s) were analyzed during exploration.


**Pages Explored:**
1. Banking & Insurance for private individuals & business - ING Belgium (https://www.ing.be/en/individuals)
2. start to invest - ING Belgium (https://www.ing.be/en/individuals/investing/start-to-invest)
3. Easy online investment plan from €10/month - ING Belgium (https://www.ing.be/en/individuals/investing/easy-invest)
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

### 2. Verify start to invest - ING Belgium Loads Correctly

**Seed Test**: `tests/seed/seed.spec.ts`

**Steps:**
1. Navigate to https://www.ing.be/en/individuals/investing/start-to-invest

**Expected Results:**
- Page loads without errors
- Page title is "start to invest - ING Belgium"
- Key elements are visible

### 3. Verify Easy online investment plan from €10/month - ING Belgium Loads Correctly

**Seed Test**: `tests/seed/seed.spec.ts`

**Steps:**
1. Navigate to https://www.ing.be/en/individuals/investing/easy-invest

**Expected Results:**
- Page loads without errors
- Page title is "Easy online investment plan from €10/month - ING Belgium"
- Key elements are visible

### 4. Verify Investment calculator - ING Belgium Loads Correctly

**Seed Test**: `tests/seed/seed.spec.ts`

**Steps:**
1. Navigate to https://www.ing.be/en/individuals/investing/investment-calculator

**Expected Results:**
- Page loads without errors
- Page title is "Investment calculator - ING Belgium"
- Key elements are visible

### 5. Navigate from Banking & Insurance for private individuals & business - ING Belgium to start to invest - ING Belgium

**Seed Test**: `tests/seed/seed.spec.ts`

**Steps:**
1. Navigate to https://www.ing.be/en/individuals
2. Click on the "link" link that navigates to start to invest - ING Belgium
3. Wait for navigation to complete

**Expected Results:**
- Link with text "link" is visible and clickable
- Navigation completes without errors
- Page title is "start to invest - ING Belgium"
- URL changes to the target page
- Target page loads successfully

### 6. Navigate from start to invest - ING Belgium to Easy online investment plan from €10/month - ING Belgium

**Seed Test**: `tests/seed/seed.spec.ts`

**Steps:**
1. Navigate to https://www.ing.be/en/individuals/investing/start-to-invest
2. Click on the "link" link that navigates to Easy online investment plan from €10/month - ING Belgium
3. Wait for navigation to complete

**Expected Results:**
- Link with text "link" is visible and clickable
- Navigation completes without errors
- Page title is "Easy online investment plan from €10/month - ING Belgium"
- URL changes to the target page
- Target page loads successfully

### 7. Navigate from Easy online investment plan from €10/month - ING Belgium to Investment calculator - ING Belgium

**Seed Test**: `tests/seed/seed.spec.ts`

**Steps:**
1. Navigate to https://www.ing.be/en/individuals/investing/easy-invest
2. Click on the "link" link that navigates to Investment calculator - ING Belgium
3. Wait for navigation to complete

**Expected Results:**
- Link with text "link" is visible and clickable
- Navigation completes without errors
- Page title is "Investment calculator - ING Belgium"
- URL changes to the target page
- Target page loads successfully

