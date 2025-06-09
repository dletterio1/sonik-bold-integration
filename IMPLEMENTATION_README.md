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
src/models/TerminalAssignment.model.js
```
- Copy from: `Bold Integration code - backend/bold-terminal-charge-model.js`
- Copy from: `Bold Integration Code - Terminal Pairing Front : Back End/terminal-assignment-model.js`
- **Action**: Add to models directory

#### 2. Services
```
src/services/boldPayment.service.js
src/services/terminalAssignment.service.js
```
- Copy from: `Bold Integration code - backend/bold-payment-service.js`
- Copy from: `Bold Integration Code - Terminal Pairing Front : Back End/terminal-assignment-service.js`
- **Action**: Add to services directory
- **Note**: Also merge methods from `bold-payment-service-update.js` and `live-order-service-update.js` into existing services

#### 3. Controllers
```
src/controllers/boldTerminal.controller.js
```
- Copy from: `Bold Integration code - backend/bold-terminal-controller.js`
- **Action**: Add to controllers directory

#### 4. Routes
```
src/routes/boldPayment.route.js
src/routes/terminalScanner.route.js
```
- Copy from: `Bold Integration code - backend/bold-payment-routes.js`
- Copy from: `Bold Integration Code - Terminal Pairing Front : Back End/terminal-scanner-routes.js`
- **Action**: Add to routes directory

### Frontend Files (scanner-web/src/):

#### 1. Services
```
src/services/pos.service.js
src/services/terminal.service.js
```
- Copy from: `Bold integration code - POS Frontend/pos-service-web.js`
- Copy from: `Bold Integration Code - Terminal Pairing Front : Back End/terminal-service-frontend.js`
- **Action**: Add to services directory

#### 2. Components
```
src/components/pos/
├── POSScreen.jsx
├── OrderCard.jsx
├── TicketTierModal.jsx
├── LoadingSpinner.jsx
└── EmptyState.jsx

src/components/terminal/
├── TerminalSettings.jsx
├── TerminalStatusIndicator.jsx
└── TerminalSelectorModal.jsx
```
- Copy from: `Bold integration code - POS Frontend/` (convert .js to .jsx)
- Copy from: `Bold Integration Code - Terminal Pairing Front : Back End/` (convert .js to .jsx)
- **Action**: Create pos and terminal directories and add components

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
import TerminalScannerRoutes from "./terminalScanner.route.js";

// Add these route registrations:
router.use(
  "/api/v1/payments/bold-terminal",
  AuthMiddleware.authenticate,
  BoldPaymentRoutes,
);

router.use(
  "/api/v1/scanner/terminals",
  AuthMiddleware.authenticate,
  TerminalScannerRoutes,
);
```

### 2. Organization Model Update
**File**: `sonik-node-api/src/models/Organization.model.js`

**Add terminal fields** from `organization-model-update.js`:
```javascript
// Add to OrganizationSchema:
terminals: [{
  terminalId: { type: String, required: true, unique: true },
  serialNumber: { type: String, required: true, unique: true },
  location: { type: String, default: '' },
  active: { type: Boolean, default: true },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  lastActivity: { type: Date, default: Date.now },
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  addedAt: { type: Date, default: Date.now }
}]

// Add these methods:
OrganizationSchema.methods.getActiveTerminals = function() {
  return this.terminals.filter(terminal => terminal.active);
};

OrganizationSchema.methods.hasTerminal = function(terminalId) {
  return this.terminals.some(terminal => 
    terminal.terminalId === terminalId && terminal.active
  );
};
```

### 3. Frontend App Routes
**File**: `scanner-web/src/App.jsx`

**Add POS route** inside the `/:eventId` route group:
```jsx
<Route path="pos" element={<Layout><POSScreen /></Layout>} />
```

### 4. Frontend Navigation
**File**: `scanner-web/src/components/common/Layout.jsx` (or bottom navigation component)

**Add POS navigation item**:
```jsx
<NavItem to={`/${eventId}/pos`} icon="terminal" label="POS" />
```

### 5. Settings Page Integration
**File**: `scanner-web/src/pages/Settings/index.jsx`

**Add terminal settings section** using code from `settings-page-update.js`:
```jsx
import TerminalSettings from '../../components/terminal/TerminalSettings';

// Add this section to your settings page:
<div className="bg-white rounded-lg shadow">
  <div className="px-6 py-4 border-b border-gray-200">
    <h2 className="text-lg font-medium text-gray-900">Payment Terminal</h2>
    <p className="text-sm text-gray-500">
      Configure and manage your Bold payment terminal for this event
    </p>
  </div>
  <div className="p-6">
    <TerminalSettings eventId={eventId} />
  </div>
</div>
```

## 🌍 Environment Variables

### Required .env Variables:
```bash
# Bold Payment Integration
BOLD_ENVIRONMENT=sandbox
BOLD_CLIENT_ID=your_bold_client_id
BOLD_CLIENT_SECRET=your_bold_client_secret
BOLD_WEBHOOK_SECRET=your_bold_webhook_secret
BOLD_TERMINAL_PREFIX=SONIK-

# Terminal Management
TERMINAL_STATUS_CACHE_TTL=30
TERMINAL_ASSIGNMENT_TTL=86400
```

### Development Values:
```bash
# For testing/development
BOLD_ENVIRONMENT=sandbox
BOLD_CLIENT_ID=test_client_id
BOLD_CLIENT_SECRET=test_client_secret
BOLD_WEBHOOK_SECRET=test_webhook_secret
BOLD_TERMINAL_PREFIX=TEST-
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
npm install lucide-react react-hot-toast  # For POS icons and notifications
```

## 🗄️ Database Setup

### 1. Model Registration
**File**: `sonik-node-api/src/models/index.js`

**Add**:
```javascript
import "./BoldTerminalCharge.model.js";
import "./TerminalAssignment.model.js";
```

### 2. Database Migration
Both models will auto-create their collections. No manual migration needed.

## 🔗 API Endpoints

### Bold Terminal Payment Endpoints:
```
POST   /api/v1/payments/bold-terminal/charge
GET    /api/v1/payments/bold-terminal/charge/:chargeId
POST   /api/v1/payments/bold-terminal/reconcile/:chargeId
```

### Terminal Assignment Endpoints:
```
GET    /api/v1/scanner/terminals/available/:eventId
POST   /api/v1/scanner/terminals/assign
GET    /api/v1/scanner/terminals/assignment/:eventId
DELETE /api/v1/scanner/terminals/assignment/:eventId
GET    /api/v1/scanner/terminals/:terminalId/status
POST   /api/v1/scanner/terminals/:terminalId/test
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
- [ ] Terminal assignment endpoints work
- [ ] Terminal status checking works
- [ ] Terminal test connection works

### Frontend Testing:
- [ ] POS screen loads correctly
- [ ] Terminal selection works
- [ ] Transaction creation flow works
- [ ] Payment status updates in real-time
- [ ] Error messages display properly
- [ ] Navigation between screens works
- [ ] Terminal settings component works
- [ ] Terminal status indicator updates
- [ ] Terminal assignment/release works

### Integration Testing:
- [ ] End-to-end payment flow works
- [ ] Webhook events update charge status
- [ ] Reconciliation job processes pending charges
- [ ] Error scenarios handled gracefully
- [ ] Terminal assignment flow works
- [ ] Terminal status updates in real-time
- [ ] Multiple users can't assign same terminal

## 🚀 Deployment Steps

### 1. Backend Deployment:
1. Add all backend files to respective directories
2. Update routes/index.js with new route registrations
3. Update Organization model with terminal fields
4. Add environment variables
5. Install dependencies
6. Test API endpoints

### 2. Frontend Deployment:
1. Add all frontend files to respective directories
2. Update App.jsx with POS route
3. Update navigation component
4. Update Settings page with terminal settings
5. Install dependencies
6. Test POS interface and terminal management

### 3. Production Setup:
1. Update BOLD_ENVIRONMENT to "production"
2. Add real Bold API credentials
3. Configure webhook URL in Bold dashboard
4. Test with real terminal devices
5. Set up terminal cleanup cron job

## 🔍 Key Integration Points

### 1. Terminal Assignment Flow:
```
Settings → Select Terminal → Assign → POS → Payment → Release
```

### 2. Transaction Flow:
```
Scanner App → Create Transaction → Bold Terminal → Payment → Update Status
```

### 3. Data Flow:
```
Organization → Terminals → Assignment → TicketTransaction → BoldTerminalCharge → Bold API
```

### 4. Error Handling:
- Network timeouts
- Terminal offline scenarios
- Payment declined cases
- Webhook delivery failures
- Terminal assignment conflicts
- Terminal connectivity issues

## 📞 Support & Troubleshooting

### Common Issues:
1. **Authentication Errors**: Check Bold API credentials
2. **Webhook Not Received**: Verify webhook URL and secret
3. **Terminal Offline**: Implement retry logic
4. **Payment Timeout**: Check reconciliation job
5. **Terminal Assignment Conflicts**: Check Redis cache and database
6. **Terminal Not Found**: Verify terminal is registered in organization

### Debug Tools:
- Bold API logs
- Application logs
- Database query logs
- Network request logs
- Redis cache inspection
- Terminal status monitoring

## 🔐 Security Considerations

1. **API Keys**: Store securely in environment variables
2. **Webhook Verification**: Always verify webhook signatures
3. **PCI Compliance**: Bold handles card data, but ensure secure transmission
4. **Access Control**: Restrict POS access to authorized users
5. **Terminal Security**: Validate terminal ownership before assignment
6. **Session Management**: Properly handle terminal assignment sessions

---

## 📋 Implementation Priority

### Phase 1 (Core):
1. Add backend models and services
2. Register routes
3. Test API endpoints
4. Update Organization model

### Phase 2 (Terminal Management):
1. Add terminal assignment functionality
2. Test terminal assignment flow
3. Add terminal status monitoring

### Phase 3 (Frontend):
1. Add POS components
2. Add terminal management components
3. Integrate with backend APIs
4. Test payment flow

### Phase 4 (Polish):
1. Error handling improvements
2. UI/UX enhancements
3. Performance optimizations
4. Real-time status updates

---

**Note**: All integration files have been corrected to match Sonik's actual codebase patterns, including the complete Terminal Pairing functionality. The developer should be able to implement this with minimal additional changes. 