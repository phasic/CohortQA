# Banking & Insurance for private individuals & business - ING Belgium Test Plan

The Banking & Insurance for private individuals & business - ING Belgium application provides the following functionality:

**Explored Pages:** 4 page(s) were analyzed during exploration.


**Pages Explored:**
1. Banking & Insurance for private individuals & business - ING Belgium (https://www.ing.be/en/individuals)
2. start to invest - ING Belgium (https://www.ing.be/en/individuals/investing/start-to-invest)
3. Safe and easy online investing - ING Belgium (https://www.ing.be/en/individuals/investing/ing-self-invest)
4. Investing by yourself - ING Belgium (https://www.ing.be/en/individuals/investing/frequently-asked-questions-ing-self-invest)


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

### 3. Verify Safe and easy online investing - ING Belgium Loads Correctly

**Seed Test**: `tests/seed/seed.spec.ts`

**Steps:**
1. Navigate to https://www.ing.be/en/individuals/investing/ing-self-invest

**Expected Results:**
- Page loads without errors
- Page title is "Safe and easy online investing - ING Belgium"
- Key elements are visible

### 4. Verify Investing by yourself - ING Belgium Loads Correctly

**Seed Test**: `tests/seed/seed.spec.ts`

**Steps:**
1. Navigate to https://www.ing.be/en/individuals/investing/frequently-asked-questions-ing-self-invest

**Expected Results:**
- Page loads without errors
- Page title is "Investing by yourself - ING Belgium"
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

### 6. Navigate from start to invest - ING Belgium to Safe and easy online investing - ING Belgium

**Seed Test**: `tests/seed/seed.spec.ts`

**Steps:**
1. Navigate to https://www.ing.be/en/individuals/investing/start-to-invest
2. Click on the "link" link that navigates to Safe and easy online investing - ING Belgium
3. Wait for navigation to complete

**Expected Results:**
- Link with text "link" is visible and clickable
- Navigation completes without errors
- Page title is "Safe and easy online investing - ING Belgium"
- URL changes to the target page
- Target page loads successfully

### 7. Navigate from Safe and easy online investing - ING Belgium to Investing by yourself - ING Belgium

**Seed Test**: `tests/seed/seed.spec.ts`

**Steps:**
1. Navigate to https://www.ing.be/en/individuals/investing/ing-self-invest
2. Click on the "link" link that navigates to Investing by yourself - ING Belgium
3. Wait for navigation to complete

**Expected Results:**
- Link with text "link" is visible and clickable
- Navigation completes without errors
- Page title is "Investing by yourself - ING Belgium"
- URL changes to the target page
- Target page loads successfully

