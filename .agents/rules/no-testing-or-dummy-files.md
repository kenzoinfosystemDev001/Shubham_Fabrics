# Workspace Rule: No Testing or Dummy Files

## Policy
1. **Never Create Dummy or Testing Files**:
   - Do NOT create test scripts, dummy data generators, mock payloads, or temporary test reports anywhere in the repository.
   - All code, components, endpoints, and scripts must be pure production-grade implementation.
2. **Never Insert Dummy / Test Data into the Database**:
   - Do NOT insert fake/mock production sheets, challans, rolls, or transactions into PostgreSQL.
   - The database must only contain official production records created by authenticated users through the production UI and endpoints.
3. **No Test Folders or Test Suites in Repository**:
   - Do NOT commit test folders (`__tests__`, `test/`, `tests/`) or test reporting documents.
