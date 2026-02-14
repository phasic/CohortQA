# Test Plan

**Start URL**: https://www.ing.be/en/individuals

## Steps to Reproduce

### Step 2: CLICK

**Action:** click on element
- **Selector**: `a.link-unstyled.font-md`
- **Text**: "Investing"
- **Link**: https://www.ing.be/en/individuals/investing

**Expected Results:**
- **URL**: https://www.ing.be/en/individuals/investing
- **Page Title**: "Investing money - ING Belgium"

---

### Step 3: CLICK

**Action:** click on element
- **Selector**: `ing-accordion-invoker-button`
- **Text**: "What is investing?"

---

### Step 4: CLICK

**Action:** click on element
- **Selector**: `ing-accordion-invoker-button`
- **Text**: "How do I start to invest?"

---

### Step 5: CLICK

**Action:** click on element
- **Selector**: `ing-accordion-invoker-button`
- **Text**: "What is investing?"

---

### Step 6: CLICK

**Action:** click on element
- **Selector**: `a.card__anchor`
- **Text**: "Economy and financial markets"
- **Link**: https://www.ing.be/en/individuals/news/economy-and-financial-markets

**Expected Results:**
- **URL**: https://www.ing.be/en/individuals/news/economy-and-financial-markets
- **Page Title**: "Economy: publications from our experts to understand the news - ING Belgium"
- **Notable Elements**:
  - `#articles-and-forecasts` "Articles and forecasts" - Main content section heading
  - `#ecocheck-podcast` "EcoCheck podcast" - Key content section heading
  - `#meet-our-experts` "Meet our experts" - Key content section heading
  - `#get-more-info-and-tips` "Get more info and tips" - Key content section heading
  - `.link-unstyled.font-md[href='https://www.ing.be/en/individuals']` "Home" - Primary navigation link
  - `.link-unstyled.font-md[href='https://www.ing.be/en/individuals/services/get-in-touch']` "Contact" - Important navigation link

