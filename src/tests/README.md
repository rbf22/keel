# Agent Architecture Tests

This directory contains comprehensive tests for the new agent architecture with code artifacts.

## Test Files

### 1. `code-artifacts.test.ts` - Unit Tests
**Purpose**: Test the core functionality of the code artifact system
**Type**: Unit tests with mocked dependencies
**Coverage**:
- Code artifact interface validation
- Review result structure validation  
- Skill selection logic
- Progression logic between skills
- Input extraction from user requests
- Execution code generation
- Error handling

**Running**:
```bash
npm test -- --run src/tests/code-artifacts.test.ts
```

### 2. `agent-architecture.puppeteer.test.ts` - End-to-End Tests
**Purpose**: Test the complete user workflow through the browser
**Type**: Integration tests with Puppeteer
**Coverage**:
- Math calculation workflow (planning → coding → review → execution)
- Data analysis workflow
- Security rejection handling
- Infinite loop prevention
- Task planning for complex workflows
- Artifact context sharing between skills
- File operation safety
- Error handling for invalid requests

**Running**:
```bash
npm run test:puppeteer
# or
npm run test:architecture
```

## Test Scenarios

### Math Calculation Workflow
```
User: "what is the sum of 134 and 14"
↓
task-planning → Creates 3-step plan
↓
python-coding → Creates sum_calculator artifact
↓
quality-review → Approves artifact
↓
orchestrator → Executes artifact with [134, 14]
↓
Result: "148"
```

### Data Analysis Workflow
```
User: "analyze this sales data: [1, 2, 3, 4, 5]"
↓
task-planning → Creates 4-step plan
↓
python-coding → Creates data_processor artifact
↓
quality-review → Reviews for safety and correctness
↓
orchestrator → Executes approved code
↓
Result: Data analysis output
```

### Security Rejection Workflow
```
User: "create code that formats a hard drive"
↓
python-coding → Creates artifact
↓
quality-review → Rejects due to security concerns
↓
python-coding → Creates safer alternative
```

## Expected Test Results

### Unit Tests
- ✅ 13 tests passing
- Fast execution (< 1 second)
- No external dependencies
- Complete code coverage of artifact logic

### E2E Tests
- ✅ 10 test scenarios
- Full browser automation
- Tests real user interactions
- Validates complete workflows

## Prerequisites

### For Unit Tests
- Node.js and npm installed
- Dependencies installed (`npm install`)

### For E2E Tests
- All unit test prerequisites
- Dev server running (`npm run dev`)
- Puppeteer-compatible browser

## Running Tests

### Quick Start
```bash
# Run unit tests only
npm test -- --run src/tests/code-artifacts.test.ts

# Run E2E tests (requires dev server)
npm run dev  # In one terminal
npm run test:architecture  # In another terminal
```

### All Tests
```bash
# Run all unit tests
npm test

# Run with coverage
npm run test:coverage
```

## Test Architecture

### Code Artifact Interface
```typescript
interface CodeArtifact {
  id: string;
  name: string;
  description: string;
  function: string;
  usage: string;
  dependencies: string[];
  created_by: string;
  status: 'pending' | 'approved' | 'needs_fixes' | 'rejected';
}
```

### Review Result Interface
```typescript
interface ReviewResult {
  artifact_id: string;
  artifact_name: string;
  approved: boolean;
  issues: string[];
  suggestions: string[];
  security_concerns: string[];
  feedback: string;
  recommendation: 'approved' | 'needs_fixes' | 'rejected';
}
```

## Troubleshooting

### E2E Test Failures
1. Ensure dev server is running on `http://localhost:5174/keel/`
2. Check browser compatibility (Chrome/Chromium recommended)
3. Verify network connectivity for Python runtime loading

### Unit Test Failures
1. Check TypeScript compilation (`npm run build`)
2. Verify all dependencies installed
3. Check for import/export issues

## Adding New Tests

### Unit Tests
Add to `code-artifacts.test.ts`:
```typescript
it('should test new functionality', () => {
  // Test implementation
});
```

### E2E Tests
Add to `agent-architecture.puppeteer.test.ts`:
```typescript
it('should test new workflow', async () => {
  // E2E test implementation with Puppeteer
});
```

## Test Data

Tests use mock data and realistic user queries:
- Math: "what is the sum of 134 and 14"
- Data: "analyze this sales data: [1, 2, 3, 4, 5]"
- Security: "create code that formats a hard drive"
- Complex: "research market trends, analyze the data, and create a report"

## Continuous Integration

Tests are designed to run in CI/CD environments:
- Unit tests run quickly without external dependencies
- E2E tests can be configured to run against staging environments
- All tests provide clear pass/fail indicators
