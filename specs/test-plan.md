# Banking & Insurance for private individuals & business - ING Belgium Test Plan

The Banking & Insurance for private individuals & business - ING Belgium application provides the following functionality:

**Explored Pages:** 4 page(s) were analyzed during exploration.


**Pages Explored:**
1. Banking & Insurance for private individuals & business - ING Belgium (https://www.ing.be/en/individuals)
2. Calculate your Insurance premium - ING Belgium (https://www.ing.be/en/individuals/insurance)
3. Car insurance - ING Belgium (https://www.ing.be/en/individuals/insurance/insure-my-car/car-insurance)
4. Accident assistance with ING: what you should do? - ING Belgium (https://www.ing.be/en/individuals/my-life/mobility/car-insurance-claim)


## Test Scenarios

### 1. Verify Banking & Insurance for private individuals & business - ING Belgium Loads Correctly

**Seed Test**: `tests/seed/seed.spec.ts`

**Steps:**
1. Navigate to https://www.ing.be/en/individuals

**Expected Results:**
- Page loads without errors
- Page title is "Banking & Insurance for private individuals & business - ING Belgium"
- Key elements are visible

### 2. Verify Calculate your Insurance premium - ING Belgium Loads Correctly

**Seed Test**: `tests/seed/seed.spec.ts`

**Steps:**
1. Navigate to https://www.ing.be/en/individuals/insurance

**Expected Results:**
- Page loads without errors
- Page title is "Calculate your Insurance premium - ING Belgium"
- Key elements are visible

### 3. Verify Car insurance - ING Belgium Loads Correctly

**Seed Test**: `tests/seed/seed.spec.ts`

**Steps:**
1. Navigate to https://www.ing.be/en/individuals/insurance/insure-my-car/car-insurance

**Expected Results:**
- Page loads without errors
- Page title is "Car insurance - ING Belgium"
- Key elements are visible

### 4. Verify Accident assistance with ING: what you should do? - ING Belgium Loads Correctly

**Seed Test**: `tests/seed/seed.spec.ts`

**Steps:**
1. Navigate to https://www.ing.be/en/individuals/my-life/mobility/car-insurance-claim

**Expected Results:**
- Page loads without errors
- Page title is "Accident assistance with ING: what you should do? - ING Belgium"
- Key elements are visible

### 5. Navigate from Banking & Insurance for private individuals & business - ING Belgium to Calculate your Insurance premium - ING Belgium

**Seed Test**: `tests/seed/seed.spec.ts`

**Steps:**
1. Navigate to https://www.ing.be/en/individuals
2. Click on the "link" link that navigates to Calculate your Insurance premium - ING Belgium
3. Wait for navigation to complete

**Expected Results:**
- Link with text "link" is visible and clickable
- Navigation completes without errors
- Page title is "Calculate your Insurance premium - ING Belgium"
- URL changes to the target page
- Target page loads successfully

### 6. Navigate from Calculate your Insurance premium - ING Belgium to Car insurance - ING Belgium

**Seed Test**: `tests/seed/seed.spec.ts`

**Steps:**
1. Navigate to https://www.ing.be/en/individuals/insurance
2. Click on the "link" link that navigates to Car insurance - ING Belgium
3. Wait for navigation to complete

**Expected Results:**
- Link with text "link" is visible and clickable
- Navigation completes without errors
- Page title is "Car insurance - ING Belgium"
- URL changes to the target page
- Target page loads successfully

### 7. Navigate from Car insurance - ING Belgium to Accident assistance with ING: what you should do? - ING Belgium

**Seed Test**: `tests/seed/seed.spec.ts`

**Steps:**
1. Navigate to https://www.ing.be/en/individuals/insurance/insure-my-car/car-insurance
2. Click on the "link" link that navigates to Accident assistance with ING: what you should do? - ING Belgium
3. Wait for navigation to complete

**Expected Results:**
- Link with text "link" is visible and clickable
- Navigation completes without errors
- Page title is "Accident assistance with ING: what you should do? - ING Belgium"
- URL changes to the target page
- Target page loads successfully

