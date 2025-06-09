# Bold Payment Integration - Implementation Guide

## Overview
This guide provides step-by-step instructions for implementing Bold terminal payment integration into the Sonik platform. All integration files have been corrected to match Sonik's actual codebase patterns.

## ✅ Corrections Made to Integration Files

### Backend Corrections:
1. **Import/Export Patterns**: Changed from CommonJS to ES6 modules
2. **Model Field Names**: Updated to match Sonik conventions (`_transaction` instead of `orderId`, `_tickettier` instead of `ticketTierId`)
3. **Service References**: Fixed import paths and service method calls
4. **Response Formatting**: Updated to use `GlobalUtils.formatResponse()` pattern
5. **API Endpoints**: Aligned with Sonik's `/api/v1/` structure

### Frontend Corrections:
1. **API Client**: Updated to use Sonik's `https.js` client
2. **Endpoint URLs**: Changed from `/scanner/pos/` to `/api/v1/payments/bold-terminal/`
3. **Data Fields**: Updated to use `transaction_id` instead of `order_id`

## 📁 Files to Add to Main Codebase

### Backend Files (sonik-node-api/src/):

#### 1. Models
```
src/models/BoldTerminalCharge.model.js
```
- Copy from: `Bold Integration code - backend/bold-terminal-charge-model.js`
- **Action**: Add to models directory

#### 2. Services
```
src/services/boldPayment.service.js
```
- Copy from: `Bold Integration code - backend/bold-payment-service.js`
- **Action**: Add to services directory

#### 3. Controllers
```
src/controllers/boldTerminal.controller.js
```
- Copy from: `Bold Integration code - backend/bold-terminal-controller.js`
- **Action**: Add to controllers directory

#### 4. Routes
```
src/routes/boldPayment.route.js
```
- Copy from: `Bold Integration code - backend/bold-payment-routes.js`
- **Action**: Add to routes directory

### Frontend Files (scanner-web/src/):

#### 1. Services
```
src/services/pos.service.js
```
- Copy from: `Bold integration code - POS Frontend/pos-service-web.js`
- **Action**: Add to services directory

#### 2. Components
```
src/components/pos/
├── POSScreen.jsx
├── OrderCard.jsx
├── TicketTierModal.jsx
├── LoadingSpinner.jsx
└── EmptyState.jsx
```
- Copy from: `Bold integration code - POS Frontend/` (convert .js to .jsx)
- **Action**: Create pos directory and add components

#### 3. Pages
```
src/pages/POS/
└── index.jsx
```
- **Action**: Create POS page directory

## 🔧 Required Changes to Existing Files

### 1. Backend Route Registration
**File**: `sonik-node-api/src/routes/index.js`

**Add after line 91** (after payment-methods route):
```javascript
import BoldPaymentRoutes from "./boldPayment.route.js";

// Add this route registration:
router.use(
  "/api/v1/payments/bold-terminal",
  AuthMiddleware.authenticate,
  BoldPaymentRoutes,
);
```

### 2. Frontend App Routes
**File**: `scanner-web/src/App.jsx`

**Add POS route** inside the `/:eventId` route group:
```jsx
<Route path="pos" element={<Layout><POSScreen /></Layout>} />
```

### 3. Frontend Navigation
**File**: `scanner-web/src/components/common/Layout.jsx` (or bottom navigation component)

**Add POS navigation item**:
```jsx
<NavItem to={`/${eventId}/pos`} icon="terminal" label="POS" />
```

## 🌍 Environment Variables

### Required .env Variables:
```bash
# Bold Payment Integration
BOLD_ENVIRONMENT=sandbox
BOLD_CLIENT_ID=your_bold_client_id
BOLD_CLIENT_SECRET=your_bold_client_secret
BOLD_WEBHOOK_SECRET=your_bold_webhook_secret
```

### Development Values:
```bash
# For testing/development
BOLD_ENVIRONMENT=sandbox
BOLD_CLIENT_ID=test_client_id
BOLD_CLIENT_SECRET=test_client_secret
BOLD_WEBHOOK_SECRET=test_webhook_secret
```

## 📦 Dependencies

### Backend Dependencies:
```bash
cd sonik-node-api
npm install axios crypto-js
```

### Frontend Dependencies:
```bash
cd scanner-web
npm install lucide-react  # For POS icons
```

## 🗄️ Database Setup

### 1. Model Registration
**File**: `sonik-node-api/src/models/index.js`

**Add**:
```javascript
import "./BoldTerminalCharge.model.js";
```

### 2. Database Migration
The `BoldTerminalCharge` model will auto-create its collection. No manual migration needed.

## 🔗 API Endpoints

### Bold Terminal Payment Endpoints:
```
POST   /api/v1/payments/bold-terminal/charge
GET    /api/v1/payments/bold-terminal/charge/:chargeId
POST   /api/v1/payments/bold-terminal/reconcile/:chargeId
```

### Required Existing Endpoints:
```
GET    /api/v1/events/:eventId/transactions?status=pending
GET    /api/v1/events/:eventId/ticket-tiers?door_sales=true
```

## 🧪 Testing Checklist

### Backend Testing:
- [ ] Bold API authentication works
- [ ] Charge creation endpoint responds correctly
- [ ] Charge status polling works
- [ ] Webhook endpoint receives events
- [ ] Database models save correctly
- [ ] Error handling works for all scenarios

### Frontend Testing:
- [ ] POS screen loads correctly
- [ ] Terminal selection works
- [ ] Transaction creation flow works
- [ ] Payment status updates in real-time
- [ ] Error messages display properly
- [ ] Navigation between screens works

### Integration Testing:
- [ ] End-to-end payment flow works
- [ ] Webhook events update charge status
- [ ] Reconciliation job processes pending charges
- [ ] Error scenarios handled gracefully

## 🚀 Deployment Steps

### 1. Backend Deployment:
1. Add all backend files to respective directories
2. Update routes/index.js with new route registration
3. Add environment variables
4. Install dependencies
5. Test API endpoints

### 2. Frontend Deployment:
1. Add all frontend files to respective directories
2. Update App.jsx with POS route
3. Update navigation component
4. Install dependencies
5. Test POS interface

### 3. Production Setup:
1. Update BOLD_ENVIRONMENT to "production"
2. Add real Bold API credentials
3. Configure webhook URL in Bold dashboard
4. Test with real terminal devices

## 🔍 Key Integration Points

### 1. Transaction Flow:
```
Scanner App → Create Transaction → Bold Terminal → Payment → Update Status
```

### 2. Data Flow:
```
TicketTransaction → BoldTerminalCharge → Bold API → Webhook → Status Update
```

### 3. Error Handling:
- Network timeouts
- Terminal offline scenarios
- Payment declined cases
- Webhook delivery failures

## 📞 Support & Troubleshooting

### Common Issues:
1. **Authentication Errors**: Check Bold API credentials
2. **Webhook Not Received**: Verify webhook URL and secret
3. **Terminal Offline**: Implement retry logic
4. **Payment Timeout**: Check reconciliation job

### Debug Tools:
- Bold API logs
- Application logs
- Database query logs
- Network request logs

## 🔐 Security Considerations

1. **API Keys**: Store securely in environment variables
2. **Webhook Verification**: Always verify webhook signatures
3. **PCI Compliance**: Bold handles card data, but ensure secure transmission
4. **Access Control**: Restrict POS access to authorized users

---

## 📋 Implementation Priority

### Phase 1 (Core):
1. Add backend models and services
2. Register routes
3. Test API endpoints

### Phase 2 (Frontend):
1. Add POS components
2. Integrate with backend APIs
3. Test payment flow

### Phase 3 (Polish):
1. Error handling improvements
2. UI/UX enhancements
3. Performance optimizations

---

**Note**: All integration files have been corrected to match Sonik's actual codebase patterns. The developer should be able to implement this with minimal additional changes. 